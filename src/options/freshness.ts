/**
 * Option-chain freshness (QA C7: data/in/{avgo,nvda,jpm}-chain.json from 10-22 were still read on 10-30, so volume alerts
 * listed the expired 10-23 contracts). Pure: refresh list, staleness in NYSE trading days, expired-contract filter.
 */
import type { Chain } from "./chain.ts";
import { isTradingDay, addDays, etDate } from "../macro/nyse.ts";

/** Always refreshed (what the routine did before), then every optionable watchlist symbol. */
export const CHAIN_BASE = ["SPY", "QQQ", "IWM"];
/** Listed-option tickers only: drops Yahoo-style index/futures/crypto/FX symbols (^VIX, CL=F, BTC-USD, EURUSD=X). */
export const hasListedOptions = (s: string) => /^[A-Z][A-Z.]{0,5}$/.test(s);
export function chainRefreshSymbols(watchlist: string[]): string[] {
  return [...new Set([...CHAIN_BASE, ...watchlist.map((s) => s.trim().toUpperCase()).filter(hasListedOptions)])];
}
export const chainFile = (sym: string, dir = "data/in") => `${dir}/${sym.toLowerCase()}-chain.json`;

/** ET calendar date of a chain asOf ("2026-10-22" stays as is; ISO times are converted to New York). */
export const asOfEtDate = (asOf: string) => (/^\d{4}-\d\d-\d\d$/.test(asOf) ? asOf : etDate(new Date(asOf)));
/** NYSE sessions after asOfDate up to and including today. */
export function tradingDaysSince(asOfDate: string, today: string): number {
  let n = 0;
  for (let d = addDays(asOfDate, 1); d <= today; d = addDays(d, 1)) if (isTradingDay(d)) n++;
  return n;
}

export interface ChainFreshness { asOfDate: string; today: string; tradingDaysOld: number; stale: boolean; droppedExpired: number }
/** Stale = more than 1 trading day old (Thursday's chain is fine on Friday premarket; the 10-22 chain on 10-30 is 6 days old). */
export function chainFreshness(asOf: string, today: string): Omit<ChainFreshness, "droppedExpired"> {
  const asOfDate = asOfEtDate(asOf), tradingDaysOld = tradingDaysSince(asOfDate, today);
  return { asOfDate, today, tradingDaysOld, stale: tradingDaysOld > 1 };
}
/** Contracts expiring before today (ET) are gone; today's expiries still trade. */
export const dropExpired = (ch: Chain, today: string): Chain => ({ ...ch, contracts: ch.contracts.filter((c) => c.expiration >= today) });

export type FreshChain = Chain & { freshness: ChainFreshness };
/** Expired contracts dropped + freshness attached (serialised into the JSON outputs). Idempotent. */
export function prepareChain(ch: Chain, now: Date): FreshChain {
  const today = etDate(now), live = dropExpired(ch, today);
  const prior = (ch as Partial<FreshChain>).freshness?.droppedExpired ?? 0;
  return { ...live, freshness: { ...chainFreshness(ch.asOf, today), droppedExpired: prior + ch.contracts.length - live.contracts.length } };
}
/** "过时（asOf 2026-10-22，6 个交易日前）" when stale, else "". */
export const staleLabel = (f: ChainFreshness | undefined) => (f?.stale ? `过时（asOf ${f.asOfDate}，${f.tradingDaysOld} 个交易日前）` : "");
