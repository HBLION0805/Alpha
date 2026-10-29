/**
 * Daily risk cap (user rule 2026-10-29). ONE place for the paper account's daily cap; every consumer (pretrade daily_loss_limit,
 * live 🚨 breach, plan-card / paper-gate daily budget, reviews, 暴怒 tag, mentor reminder, readiness, dashboard) calls this.
 *  - before 2026-10-30 (ET trade date): 2% of equity (纪律 #11, user-confirmed 2026-10-14)
 *  - from 2026-10-30: 10% of equity (≈ $500 on $5k) while equity ≤ $10,000; above $10,000 it reverts to 2% automatically
 *  - a user rule-card override may only LOWER it (rules.ts NEVER_LOOSEN)
 * The per-trade cap is unchanged (confidence.ts: 0.5–2% of equity).
 * Every trade needs a hard stop or a fixed max loss; without one it is a violation and its risk is not "defined".
 */
import { DEFAULT_RULES, type RuleCard } from "./rules.ts";

export const DAILY_CAP_BASE_PCT = 2;
export const DAILY_CAP_SMALL_ACCOUNT_PCT = 10;
export const DAILY_CAP_SMALL_ACCOUNT_FROM = "2026-10-30"; // ET trade date
export const DAILY_CAP_SMALL_ACCOUNT_MAX_EQUITY = 10_000; // equity strictly above this → base 2%

const etDate = (d: string | Date) => (typeof d === "string" ? d.slice(0, 10) : d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }));

/** daily cap in % of equity for ET date `date` and current equity */
export function dailyRiskCapPct(date: string | Date, equity: number, rules?: Partial<Pick<RuleCard, "dailyLossLimitPct">>): number {
  const d = etDate(date);
  const sched = d >= DAILY_CAP_SMALL_ACCOUNT_FROM && equity <= DAILY_CAP_SMALL_ACCOUNT_MAX_EQUITY ? DAILY_CAP_SMALL_ACCOUNT_PCT : DAILY_CAP_BASE_PCT;
  const o = rules?.dailyLossLimitPct;
  return o != null && Number.isFinite(o) && o < DEFAULT_RULES.dailyLossLimitPct ? Math.min(sched, o) : sched; // overrides only lower
}
/** daily cap in dollars (rounded to cents) */
export const dailyRiskCapUsd = (date: string | Date, equity: number, rules?: Partial<Pick<RuleCard, "dailyLossLimitPct">>) =>
  Math.round(equity * dailyRiskCapPct(date, equity, rules)) / 100;

export const RISK_UNDEFINED_VIOLATION = "no_hard_stop_or_max_loss";
/** a hard stop (written stop) or a fixed positive max loss */
export function hasDefinedRisk(e: { maxLoss?: number | null; stop?: string | null }): boolean {
  return (typeof e.maxLoss === "number" && Number.isFinite(e.maxLoss) && e.maxLoss > 0) || (typeof e.stop === "string" && e.stop.trim().length > 0 && !/^not recorded/i.test(e.stop.trim()));
}
/** max loss that may be counted as defined risk; null when the trade has no hard stop / fixed max loss */
export const definedRiskUsd = (e: { maxLoss?: number | null; stop?: string | null }) => (hasDefinedRisk(e) && typeof e.maxLoss === "number" && e.maxLoss > 0 ? e.maxLoss : null);
