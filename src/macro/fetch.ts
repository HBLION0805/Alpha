import type { SeriesDef } from "./series.ts";
import { USER_AGENT } from "../ingest/rss.ts";
import { yahooDaily, yahooIntraday } from "../adapters/yahoo.ts";

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

async function get(url: string, timeoutMs: number): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function fetchDaily(s: SeriesDef, since: string, timeoutMs = 12_000): Promise<Obs[]> {
  if (s.provider === "fred") return parseFredCsv(await (await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s.ref}&cosd=${since}`, timeoutMs)).text());
  return (await yahooDaily(s.ref, 730, timeoutMs)).map((b) => ({ t: b.t, v: b.c }));
}

/** One fetch per provider:ref per process (800 days); the daily brief shares it between macro, premarket and scenarios. */
const once = new Map<string, Promise<Obs[]>>();
export function fetchDailyOnce(s: SeriesDef, timeoutMs = 12_000): Promise<Obs[]> {
  const k = `${s.provider}:${s.ref}`;
  if (!once.has(k)) once.set(k, fetchDaily(s, new Date(Date.now() - 800 * 86400_000).toISOString().slice(0, 10), timeoutMs));
  return once.get(k)!;
}
export const fetchCount = () => once.size;

export async function fetchIntraday(s: SeriesDef, timeoutMs = 12_000): Promise<Obs[]> {
  if (s.provider !== "yahoo") return [];
  return (await yahooIntraday(s.ref, 5, timeoutMs)).map((b) => ({ t: b.t, v: b.c }));
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
