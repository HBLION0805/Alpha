/**
 * Daily risk cap (user rule 2026-10-29). ONE place for the paper account's daily cap; every consumer (pretrade daily_loss_limit,
 * live 🚨 breach, plan-card / paper-gate daily budget, reviews, 暴怒 tag, mentor reminder, readiness, dashboard) calls this.
 *  - before 2026-10-30 (ET trade date): 2% of equity (纪律 #11, user-confirmed 2026-10-14)
 *  - from 2026-10-30: 10% of equity (≈ $500 on $5k) while equity ≤ $10,000; above $10,000 it reverts to 2% automatically
 *  - a user rule-card override may only LOWER it (rules.ts NEVER_LOOSEN)
 * The per-trade cap is unchanged (confidence.ts: 0.5–2% of equity).
 * Every trade needs a hard stop or a fixed max loss; without one it is a violation and its risk is not "defined".
 */
import { type RuleCard } from "./rules.ts";

export const DAILY_CAP_BASE_PCT = 2;
export const DAILY_CAP_SMALL_ACCOUNT_PCT = 10;
export const DAILY_CAP_SMALL_ACCOUNT_FROM = "2026-10-30"; // ET trade date
export const DAILY_CAP_SMALL_ACCOUNT_MAX_EQUITY = 10_000; // equity strictly above this → base 2%

const ET = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
/** ET calendar date. A bare YYYY-MM-DD is taken as already an ET date; an ISO timestamp (2026-10-30T02:00:00Z) is CONVERTED to ET (→ 2026-10-29). */
export function etDate(d: string | Date | null | undefined): string {
  if (d == null) return "";
  if (typeof d !== "string") return ET(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d.slice(0, 10) : ET(t);
}

/** daily cap in % of equity for ET date `date` and current equity */
export function dailyRiskCapPct(date: string | Date, equity: number, rules?: Partial<Pick<RuleCard, "dailyLossLimitPct">>): number {
  const d = etDate(date);
  const sched = d >= DAILY_CAP_SMALL_ACCOUNT_FROM && equity <= DAILY_CAP_SMALL_ACCOUNT_MAX_EQUITY ? DAILY_CAP_SMALL_ACCOUNT_PCT : DAILY_CAP_BASE_PCT;
  const o = rules?.dailyLossLimitPct;
  return o != null && Number.isFinite(o) && o >= 0 ? Math.min(sched, o) : sched; // an override can only lower the dated cap (5% card in the 10% regime → 5%; 0% card = no new risk)
}
/** daily cap in dollars (rounded to cents) */
export const dailyRiskCapUsd = (date: string | Date, equity: number, rules?: Partial<Pick<RuleCard, "dailyLossLimitPct">>) =>
  Math.round(equity * dailyRiskCapPct(date, equity, rules)) / 100;

export const RISK_UNDEFINED_VIOLATION = "no_hard_stop_or_max_loss";
/** a hard stop (written stop) or a fixed positive max loss */
export function hasDefinedRisk(e: { maxLoss?: number | null; stop?: string | null }): boolean {
  return (typeof e.maxLoss === "number" && Number.isFinite(e.maxLoss) && e.maxLoss > 0) || realStop(e.stop);
}
/** placeholder stops (empty, 无, none, n/a, -, not recorded, …) are NOT a hard stop */
const PLACEHOLDER_STOP = /^(?:|[-—–_.?？]+|无|没有|未设|暂无|none|nil|null|undefined|na|n\/a|tbd|not recorded.*|no stop)$/i;
export const realStop = (s?: string | null) => typeof s === "string" && !PLACEHOLDER_STOP.test(s.trim());
/** max loss that may be counted as defined risk; null when the trade has no hard stop / fixed max loss */
export const definedRiskUsd = (e: { maxLoss?: number | null; stop?: string | null }) => (hasDefinedRisk(e) && typeof e.maxLoss === "number" && e.maxLoss > 0 ? e.maxLoss : null);

type RiskEntry = { id?: string; openedAt: string; closedAt?: string; pnl?: number | null; maxLoss?: number | null; stop?: string | null; source?: string; mode?: string };
const simulated = (e: RiskEntry) => e.source !== "real_practice" && (e.mode == null || e.mode === "paper"); // journal.ts countsTowardDailyCap
/** paper equity at the START of ET day `day`: capital + P&L of simulated trades closed before that day */
export const equityAtStartOf = (entries: RiskEntry[], capital: number, day: string) =>
  Math.round((capital + entries.filter((e) => simulated(e) && e.closedAt && e.pnl != null && etDate(e.closedAt) < day).reduce((s, e) => s + (e.pnl ?? 0), 0)) * 100) / 100;
/** NEW risk opened on ET day `day`: Σ definedRiskUsd of simulated entries opened that day (undefined-risk entries listed separately — they are violations, not "defined") */
export function newRiskOpened(entries: RiskEntry[], day: string): { usd: number; ids: string[]; undefinedIds: string[] } {
  const xs = entries.filter((e) => simulated(e) && etDate(e.openedAt) === day);
  const usd = xs.reduce((s, e) => s + (definedRiskUsd(e) ?? 0), 0);
  return { usd: Math.round(usd * 100) / 100, ids: xs.filter((e) => definedRiskUsd(e) != null).map((e) => e.id ?? "?"), undefinedIds: xs.filter((e) => definedRiskUsd(e) == null).map((e) => e.id ?? "?") };
}
/** user rule 2026-10-29: new risk opened per ET day (already opened + the proposed trade) ≤ that day's cap. Separate from the realized-loss stop. */
export function newRiskCheck(i: { entries: RiskEntry[]; day: string; equity: number; proposedUsd: number | null; rules?: Partial<Pick<RuleCard, "dailyLossLimitPct">> }) {
  const day = etDate(i.day), cap = dailyRiskCapUsd(day, i.equity, i.rules), opened = newRiskOpened(i.entries, day);
  const proposed = i.proposedUsd != null && Number.isFinite(i.proposedUsd) && i.proposedUsd > 0 ? i.proposedUsd : null;
  const total = Math.round((opened.usd + (proposed ?? 0)) * 100) / 100;
  const ok = proposed != null && total <= cap + 0.005;
  return { id: "daily_new_risk" as const, ok, day, cap, pct: dailyRiskCapPct(day, i.equity, i.rules), opened: opened.usd, proposed, total, remaining: Math.max(0, Math.round((cap - opened.usd) * 100) / 100), undefinedIds: opened.undefinedIds,
    detail: proposed == null ? `proposed trade has no defined max loss → ${RISK_UNDEFINED_VIOLATION}; cannot count toward the daily new-risk cap`
      : `new risk ${day}: opened $${opened.usd} + this $${proposed} = $${total} ${ok ? "≤" : ">"} daily cap $${cap} (${dailyRiskCapPct(day, i.equity, i.rules)}% of $${i.equity})` };
}
