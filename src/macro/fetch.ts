import type { SeriesDef } from "./series.ts";
import { USER_AGENT } from "../ingest/rss.ts";

export interface Obs {
  t: string; // YYYY-MM-DD for daily; ISO for intraday
  v: number;
}

export function parseFredCsv(csv: string): Obs[] {
  const out: Obs[] = [];
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(",");
    const n = Number(v);
    if (d && v && v !== "." && Number.isFinite(n)) out.push({ t: d, v: n });
  }
  return out;
}

export function parseYahooChart(json: unknown, daily: boolean): Obs[] {
  const r = (json as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: Array<number | null> }> }; meta?: { exchangeTimezoneName?: string } }> } }).chart?.result?.[0];
  const ts = r?.timestamp ?? [];
  const cl = r?.indicators?.quote?.[0]?.close ?? [];
  const tz = r?.meta?.exchangeTimezoneName ?? "America/New_York";
  const out: Obs[] = [];
  ts.forEach((s, i) => {
    const v = cl[i];
    if (v == null || !Number.isFinite(v)) return;
    const d = new Date(s * 1000);
    out.push({ t: daily ? d.toLocaleDateString("en-CA", { timeZone: tz }) : d.toISOString(), v });
  });
  // daily: keep last value per date (Yahoo appends a live bar)
  if (daily) {
    const m = new Map(out.map((o) => [o.t, o.v]));
    return [...m].map(([t, v]) => ({ t, v }));
  }
  return out;
}

/** Coinbase Exchange candles: [[time, low, high, open, close, volume], ...] newest first. */
export function parseCoinbaseCandles(json: unknown, daily: boolean): Obs[] {
  if (!Array.isArray(json)) return [];
  return (json as number[][])
    .map((c) => ({ t: daily ? new Date(c[0]! * 1000).toISOString().slice(0, 10) : new Date(c[0]! * 1000).toISOString(), v: Number(c[4]) }))
    .filter((o) => Number.isFinite(o.v))
    .sort((a, b) => a.t.localeCompare(b.t));
}

async function get(url: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": url.includes("yahoo") ? "Mozilla/5.0" : USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function fetchDaily(s: SeriesDef, since: string, timeoutMs = 12_000): Promise<Obs[]> {
  if (s.provider === "fred") return parseFredCsv(await (await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s.ref}&cosd=${since}`, timeoutMs)).text());
  if (s.provider === "yahoo") return parseYahooChart(await (await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.ref)}?range=2y&interval=1d`, timeoutMs)).json(), true);
  // coinbase: 300 candles max per call
  const end = Math.floor(Date.now() / 1000);
  const out: Obs[] = [];
  for (let k = 0; k < 2; k++) {
    const e = end - k * 300 * 86400, st = e - 299 * 86400;
    out.push(...parseCoinbaseCandles(await (await get(`https://api.exchange.coinbase.com/products/${s.ref}/candles?granularity=86400&start=${st}&end=${e}`, timeoutMs)).json(), true));
  }
  const m = new Map(out.map((o) => [o.t, o.v]));
  return [...m].map(([t, v]) => ({ t, v })).sort((a, b) => a.t.localeCompare(b.t));
}

export async function fetchIntraday(s: SeriesDef, timeoutMs = 12_000): Promise<Obs[]> {
  if (s.provider === "yahoo") return parseYahooChart(await (await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.ref)}?range=5d&interval=15m`, timeoutMs)).json(), false);
  if (s.provider === "coinbase") return parseCoinbaseCandles(await (await get(`https://api.exchange.coinbase.com/products/${s.ref}/candles?granularity=900`, timeoutMs)).json(), false);
  return [];
}

/** Robinhood quotes passed in as a JSON file (MCP output). Returns {SYMBOL: last price}. */
export function parseRobinhoodQuotes(json: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    const sym = o.symbol;
    const p = o.last_trade_price ?? o.last_extended_hours_trade_price ?? o.mark_price ?? o.price;
    if (typeof sym === "string" && p != null && Number.isFinite(Number(p))) out[sym] = Number(p);
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  };
  walk(json);
  return out;
}
