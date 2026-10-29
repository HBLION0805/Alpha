/**
 * Confidence-scaled per-trade cap (user 2026-10-20, replaces the fixed 1% = $50): 0.5%–2% of CURRENT paper account
 * equity. low 0.5% · medium 1% (default) · high 1.5% · highest 2%. high/highest only when macro direction, the written
 * scenario plan and the technical entry ALL align; otherwise downgraded to medium. NO_TRADE still applies on top.
 * Daily cap: riskCap.ts dailyRiskCapPct (2% before 2026-10-30; 10% while equity ≤ $10k after). Equity = starting capital + realized P&L of simulated trades + open marks.
 */
import { dailyRiskCapUsd } from "./riskCap.ts";
import { countsTowardDailyCap, type JournalEntry } from "./journal.ts";

export const TIERS = { low: 0.5, medium: 1, high: 1.5, highest: 2 } as const;
export type Tier = keyof typeof TIERS;
export const TIER_ZH: Record<Tier, string> = { low: "低", medium: "中", high: "高", highest: "最高" };
export const DEFAULT_TIER: Tier = "medium";
export interface Alignment { macro?: boolean | null; scenarioPlan?: boolean | null; technical?: boolean | null }
export interface TradeCap { tier: Tier; requested: Tier; pct: number; usd: number; equity: number; downgraded: boolean; why: string }

export const isTier = (x: unknown): x is Tier => typeof x === "string" && x in TIERS;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** live paper equity: capital + realized (closed simulated trades) + unrealized (last mark of open ones) */
export function paperEquity(entries: JournalEntry[], capital: number): number {
  const sim = entries.filter((e) => countsTowardDailyCap(e) && (e.mode === "paper" || e.source === "mentor_shadow"));
  return r2(capital + sim.filter((e) => e.closedAt).reduce((s, e) => s + (e.pnl ?? 0), 0) + sim.filter((e) => !e.closedAt).reduce((s, e) => s + (e.marks?.at(-1)?.pnl ?? 0), 0));
}
export function tradeCap(equity: number, requested: Tier | null | undefined = DEFAULT_TIER, align: Alignment = {}): TradeCap {
  const req = isTier(requested) ? requested : DEFAULT_TIER;
  const missing = [align.macro ? null : "宏观方向", align.scenarioPlan ? null : "情景计划", align.technical ? null : "技术入场"].filter(Boolean) as string[];
  const down = (req === "high" || req === "highest") && missing.length > 0, tier: Tier = down ? "medium" : req, pct = TIERS[tier];
  return { tier, requested: req, pct, usd: r2(equity * pct / 100), equity: r2(equity), downgraded: down,
    why: down ? `要求「${TIER_ZH[req]}」但${missing.join("、")}没对齐 → 降为「中」` : tier === "high" || tier === "highest" ? "宏观方向 + 情景计划 + 技术入场三者对齐" : tier === "low" ? "低置信度" : "默认置信度" };
}
/** daily cap in $ for `date` (riskCap.ts): 2% before 2026-10-30, 10% while equity ≤ $10k after */
export const dayCapUsd = (equity: number, date: string | Date = new Date()) => dailyRiskCapUsd(date, equity);
export const capLabel = (c: TradeCap) => `置信度「${TIER_ZH[c.tier]}」${c.pct}% × 权益 $${c.equity.toLocaleString("en-US")} = 单笔上限 $${c.usd}${c.downgraded ? `（${c.why}）` : ""}`;
/** cap recorded on a journal entry at open; old entries (before 2026-10-20) = medium on their capital at entry */
export function entryCapUsd(e: Pick<JournalEntry, "confidence" | "capitalAtEntry"> & { maxLoss?: number }, capital: number): number {
  if (e.confidence?.capUsd != null) return e.confidence.capUsd;
  // no tier recorded (2026-10-22 fix, was a fixed medium 1% = $50): the trade's own max-loss tier = smallest 0.5/1/1.5/2% tier
  // covering its recorded max loss, never above 2% of capital at entry
  const base = e.capitalAtEntry ?? capital, tiers = Object.values(TIERS).map((p) => r2(base * p / 100));
  return e.maxLoss != null && e.maxLoss > 0 ? tiers.find((c) => c >= e.maxLoss!) ?? tiers.at(-1)! : r2(base * TIERS.medium / 100);
}
