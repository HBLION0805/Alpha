/**
 * Live cap breaches at mark time. Per trade = the confidence-scaled cap recorded at open (0.5–2% of paper equity, src/options/confidence.ts;
 * entries before 2026-10-20 = medium 1% of capital at entry); per day = 2% of LIVE paper equity.
 * (violation ids keep their historical names: exceeds_1pct_cap = over the entry's own cap)
 * - per trade: open loss beyond the 1% cap → 🚨 and violation "open_loss_over_cap"
 * - per day: today's realized + current unrealized beyond the 2% cap → 🚨 (all simulated trades incl. mentor_shadow; journal.ts countsTowardDailyCap)
 * - at entry: max loss beyond the 1% cap → "exceeds_1pct_cap" (mentor_shadow trades are allowed to be logged but are flagged)
 */
import { dailyRiskCapUsd, hasDefinedRisk, RISK_UNDEFINED_VIOLATION } from "./riskCap.ts";
import { countsTowardDailyCap, type JournalEntry } from "./journal.ts";
import { effectiveRules, type RuleCard } from "./rules.ts";
import { entryCapUsd, paperEquity } from "./confidence.ts";
const etDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const add = (e: JournalEntry, v: string) => { if (!(e.violations ?? []).includes(v)) (e.violations ??= []).push(v); };
export function capFlags(entries: JournalEntry[], capital: number, now: Date, rules?: Partial<RuleCard>): string[] {
  const R = effectiveRules(rules), today = etDay(now.toISOString()), perDay = dailyRiskCapUsd(today, paperEquity(entries, capital), R);
  const out: string[] = [];
  for (const e of entries) {
    const perTrade = entryCapUsd(e, capital);
    if (!hasDefinedRisk(e)) add(e, RISK_UNDEFINED_VIOLATION);
    if ((e.maxLoss ?? 0) > perTrade) { add(e, "exceeds_1pct_cap"); }
    const m = e.marks?.at(-1);
    if (!e.closedAt && m && -m.pnl > perTrade) { add(e, "open_loss_over_cap"); out.push(`🚨 超限 ${e.id} ${e.symbol} 浮亏 $${-m.pnl} > 单笔上限 $${perTrade}`); }
    else if ((e.maxLoss ?? 0) > perTrade && !e.closedAt) out.push(`⚠️ ${e.id} ${e.symbol} 最大亏损 $${e.maxLoss} > 单笔上限 $${perTrade}${e.source === "mentor_shadow" ? "（大佬影子单，超出 Alpha 风控）" : ""}`);
  }
  const sim = entries.filter(countsTowardDailyCap);
  const realized = sim.filter((e) => e.closedAt && etDay(e.closedAt) === today).reduce((s, e) => s + (e.pnl ?? 0), 0);
  const unreal = sim.filter((e) => !e.closedAt).reduce((s, e) => s + (e.marks?.at(-1)?.pnl ?? 0), 0);
  const dayPnl = Math.round((realized + unreal) * 100) / 100;
  if (-dayPnl > perDay) out.push(`🚨 超限 今日（已实现 $${realized} + 未实现 $${Math.round(unreal * 100) / 100}）= $${dayPnl} < −$${perDay} 日亏上限 → 今天停止开新仓`);
  return out;
}
