/**
 * Provenance for a daily bar already in the brief. Prices are never invented.
 * stale = the bar date is older than that market's last completed session.
 * A weekend rerun of Friday's US cash close is not stale (it is the last session) and is also not a new live print;
 * callers say so when the run day is not an NYSE session (nyse.ts).
 * Korea: weekends only. This repo has no KRX holiday table.
 */
import type { Obs } from "./fetch.ts";
import { addDays, etDate, isTradingDay, prevTradingDay } from "./nyse.ts";

export interface QuoteStamp {
  source: string;
  asOf: string;
  session: string;
  stale: boolean;
}

const FUTURES = new Set(["CL", "BZ", "WTI", "BRENT", "ES", "NQ", "RTY", "GOLD", "COPPER", "RBOB"]);
const FX = new Set(["DXY", "USDCAD", "USDJPY"]);
const KR = new Set(["KOSPI"]);
const FRED = new Set(["UST2Y", "UST10Y_FRED", "UST30Y_FRED", "EFFR", "REAL10Y", "HYOAS", "FEDFUNDS", "BE5Y", "BE10Y", "NFCI", "USD_BROAD", "VIX_FRED"]);
const CBOE = new Set(["VIX", "VIX3M"]);
const CRYPTO = new Set(["BTC"]);

export function sessionOf(id: string): string {
  if (KR.has(id)) return "韩国现金";
  if (FRED.has(id)) return "FRED发布";
  if (FUTURES.has(id)) return "美国期货";
  if (FX.has(id)) return "外汇";
  if (CRYPTO.has(id)) return "加密UTC";
  if (CBOE.has(id)) return "美股现金/CBOE";
  return "美股现金";
}

export function sourceOf(id: string): string {
  return FRED.has(id) ? "fred" : "yahoo";
}

function clock(now: Date, tz: string): { date: string; minutes: number } {
  const date = now.toLocaleDateString("en-CA", { timeZone: tz });
  const hm = now.toLocaleTimeString("en-GB", { timeZone: tz, hour12: false });
  const [h, m] = hm.split(":");
  return { date, minutes: Number(h) * 60 + Number(m) };
}

/** Last completed NYSE cash session (16:00 ET). Holidays follow nyse.ts for 2026–2028. */
export function lastUsCashSession(now: Date): string {
  const { date, minutes } = clock(now, "America/New_York");
  if (isTradingDay(date) && minutes >= 16 * 60) return date;
  return prevTradingDay(date);
}

/** Last completed KRX cash session (15:30 Asia/Seoul), weekends only. */
export function lastKrCashSession(now: Date): string {
  const { date, minutes } = clock(now, "Asia/Seoul");
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (dow !== 0 && dow !== 6 && minutes >= 15 * 60 + 30) return date;
  let x = date;
  do x = addDays(x, -1); while ([0, 6].includes(new Date(`${x}T12:00:00Z`).getUTCDay()));
  return x;
}

function freshThrough(id: string, now: Date): string {
  if (KR.has(id)) return lastKrCashSession(now);
  if (FRED.has(id)) return addDays(lastUsCashSession(now), -5);
  if (FUTURES.has(id) || FX.has(id) || CRYPTO.has(id)) return addDays(etDate(now), -2);
  return lastUsCashSession(now);
}

const CASH = new Set(["美股现金", "美股现金/CBOE", "韩国现金"]);

export function quoteStamp(id: string, obs: Obs[] | undefined, now: Date, source?: string): QuoteStamp {
  const asOf = obs?.at(-1)?.t.slice(0, 10) ?? "n/a";
  let session = sessionOf(id);
  const src = source ?? sourceOf(id);
  if (asOf === "n/a") return { source: src, asOf, session, stale: true };
  const through = freshThrough(id, now);
  // A daily bar dated after the last completed cash session is still printing (e.g. KOSPI Monday morning vs Friday US close).
  if (CASH.has(session) && asOf > through) session = `${session}未收盘`;
  return { source: src, asOf, session, stale: asOf < through };
}

export function stampText(q: QuoteStamp): string {
  return `source=${q.source} asOf=${q.asOf} session=${q.session} stale=${q.stale}`;
}
