/** Adapter: yahoo-finance2 (MIT) — the only file that imports it. Returns plain bars; no library types leak out. */
import YahooFinance from "yahoo-finance2";

export interface YBar { t: string; o: number; h: number; l: number; c: number; v: number }
type Quote = { date: Date; open?: number | null; high?: number | null; low?: number | null; close?: number | null; volume?: number | null };

let yf: InstanceType<typeof YahooFinance> | undefined;
const client = () => (yf ??= new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] }));

/** Pure: library quotes → bars. Daily dates in the exchange time zone (UTC for crypto); last value per date wins (Yahoo appends a live bar). */
export function toBars(quotes: Quote[], daily: boolean, tz = "America/New_York"): YBar[] {
  const out = new Map<string, YBar>();
  for (const q of quotes) {
    if (q.close == null || !Number.isFinite(q.close)) continue;
    const t = daily ? q.date.toLocaleDateString("en-CA", { timeZone: tz }) : q.date.toISOString();
    out.set(t, { t, o: q.open ?? q.close, h: q.high ?? q.close, l: q.low ?? q.close, c: q.close, v: q.volume ?? 0 });
  }
  return [...out.values()];
}

async function chart(symbol: string, days: number, interval: "1d" | "15m" | "1h", timeoutMs: number): Promise<YBar[]> {
  const p = client().chart(symbol, { period1: new Date(Date.now() - days * 86_400_000), interval });
  const r = await Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout ${timeoutMs}ms`)), timeoutMs).unref())]);
  return toBars(r.quotes as Quote[], interval === "1d", r.meta.exchangeTimezoneName ?? "America/New_York");
}

/** Crypto (UTC, 7 days a week): Yahoo sometimes returns a null daily bar around the UTC rollover. Fill missing recent days from hourly closes. */
export function fillCryptoGaps(daily: YBar[], hourly: YBar[]): YBar[] {
  const have = new Set(daily.map((b) => b.t));
  const byDay = new Map<string, YBar>();
  for (const h of hourly) { const t = h.t.slice(0, 10); if (!have.has(t) && t >= (daily[0]?.t ?? "")) byDay.set(t, { ...h, t }); }
  return [...daily, ...byDay.values()].sort((a, b) => a.t.localeCompare(b.t));
}

export async function yahooDaily(symbol: string, days = 730, timeoutMs = 12_000): Promise<YBar[]> {
  const d = await chart(symbol, days, "1d", timeoutMs);
  if (!/-USD$/.test(symbol) || d.length < 2) return d;
  const gap = (Date.parse(d.at(-1)!.t) - Date.parse(d.at(-2)!.t)) / 86_400_000;
  return gap > 1 ? fillCryptoGaps(d, await chart(symbol, 4, "1h", timeoutMs)) : d;
}
export const yahooIntraday = (symbol: string, days = 5, timeoutMs = 12_000) => chart(symbol, days, "15m", timeoutMs);
