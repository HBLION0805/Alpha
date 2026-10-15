/**
 * Options trade journal — schema from 期权课 14.8 / 附录 D.3, plus full-accounting rules from
 * 复盘 HYG/IWM/TLT/TQQQ (knowledge/mentor/reviews/REVIEW_HYG_IWM_TLT_TQQQ.md, 以后我会调整什么 8–9).
 */
import { issues, JournalCoreSchema } from "../adapters/schemas.ts";
export interface JournalEntry {
  id: string; openedAt: string; closedAt?: string; symbol: string; strategy: string;
  /** D.3 三句话 */
  view: { direction: string; magnitudeTime?: string; volatility: string; time?: string };
  ivRank: number | null; ivPercentile?: number | null; termStructure?: string; skew?: number | null; impliedVsRealized?: string;
  greeks: { delta: number; gamma: number; theta: number; vega: number };
  expectedMove: number | null; myExpectedMove?: string; event?: string | null;
  matrixRecommendation?: string; structureRationale: string;
  maxLoss: number; invalidation: string;
  exitRules: string[]; // pre-written before entry (14.7)
  emotion?: 1 | 2 | 3 | 4 | 5; impulseSource?: string;
  ruleCardChecks?: { single: boolean; total: boolean; commonBet: boolean; stress: boolean; liquidity: boolean };
  assignmentPlan?: string; // required when short American legs exist (pretrade.ts)
  // --- exit / review ---
  pnl?: number; commissions?: number; exitReason?: string;
  attribution?: { direction: "win" | "lose"; time: "win" | "lose"; volatility: "win" | "lose" }; // 三维归因每笔必填
  errorType?: "logic" | "early" | "new_info" | "execution";
  quadrant?: "good_good" | "good_bad" | "bad_good" | "bad_bad";
  followedRules?: boolean; lesson?: string;
  /** every adjustment is its own decision with its own risk (复盘 8) */
  adjustments?: Array<{ at: string; action: string; maxLoss: number; pnl?: number; commissions?: number }>;
  /** assigned shares held after the original trade: tracked SEPARATELY, never credited back (复盘 9) */
  assignedFollowUp?: { shares: number; costBasis: number; pnl?: number; note?: string };
  // --- 纪律系列 (knowledge/mentor/discipline/discipline-01-20.md) ---
  is0dte?: boolean;                                   // #4 one 0DTE per day
  entryRange?: { low: number; high: number };         // #7 no chasing outside plan
  addPlan?: { price: number; qty: number; maxAdds: number; totalCapQty: number; maxLoss: number }; // #10
  hesitations?: Array<{ at: string; about: "stop" | "take_profit"; note?: string }>; // #13 second → EXIT
  /** #19 thesis and position judged separately at every review */
  reviews?: Array<{ at: string; thesisValid: boolean; positionValid: boolean; note?: string }>;
  // --- paper trading + live-readiness (src/options/readiness.ts) ---
  /** "paper" = simulated entry on real data; default "live" */
  mode?: "paper" | "live";
  /** account size when the trade was opened (for the 1% / 2% checks) */
  capitalAtEntry?: number;
  /** timestamps proving thesis and stop were written BEFORE entry (must be ≤ openedAt) */
  thesisRecordedAt?: string; stopRecordedAt?: string; thesis?: string; stop?: string;
  /** discipline violations found at review: chasing, unplanned_add, emotional_sizing, motive_share, ... */
  violations?: string[];
  /** every loss: judgment (thesis/selection) vs execution (sizing, entry, exit, rules) + tags for repeated-error detection */
  lossReview?: { at: string; errorClass: "judgment" | "execution"; errorTags: string[]; note?: string };
  /** exit kind; "discretionary" before invalidation and before the time stop = premature (大佬复盘 mentor-winrate-review) */
  exitKind?: "invalidation" | "time_stop" | "take_profit" | "max_loss" | "discretionary";
  timeStopAt?: string;
  /** open positions (including this one) at entry */
  concurrentAtEntry?: number;
  motive?: "thesis" | "share" | "entertain" | "excitement";
  /** paper.ts: legs at the simulated fill, and every mark-to-market */
  legs?: Array<{ underlying?: string; type: "call" | "put" | "stock"; strike: number; qty: number; premium: number; expiration?: string; iv?: number }>;
  underlyingAtEntry?: number;
  marks?: Array<{ at: string; value: number; pnl: number; spot: number | null; sources: string[] }>;
}

export function validateEntry(e: Partial<JournalEntry>): string[] {
  const errs: string[] = issues(JournalCoreSchema, e);
  if (e.view) {
    if (!e.view.direction?.trim()) errs.push("view.direction empty");
    if (!(e.view.magnitudeTime ?? e.view.time)?.trim()) errs.push("view.magnitudeTime (幅度与时间) empty — 很多失败来自只有第一句 (14.2)");
    if (!e.view.volatility?.trim()) errs.push("view.volatility empty — 很多失败来自只有第一句 (14.2)");
  }
  if (e.exitRules && e.exitRules.length === 0) errs.push("exitRules must be written before entry (14.7)");
  if (e.maxLoss != null && !(e.maxLoss > 0)) errs.push("maxLoss must be a positive dollar amount (defined risk)");
  if (e.closedAt && !e.attribution) errs.push("closed without 三维归因 (清单 14-3: 每笔必填)");
  if (e.closedAt && e.commissions == null) errs.push("closed without commissions — full accounting (复盘 9)");
  for (const a of e.adjustments ?? []) if (!(a.maxLoss > 0)) errs.push(`adjustment ${a.at} has no own maxLoss — each adjustment is a new trade (复盘 8)`);
  for (const r of e.reviews ?? []) if (typeof r.thesisValid !== "boolean" || typeof r.positionValid !== "boolean") errs.push(`review ${r.at} must judge thesis and position separately (纪律 #19)`);
  return errs;
}

/** Full-accounting P&L of the ORIGINAL trade: pnl + adjustments − commissions. Assigned-share recovery excluded. */
export function fullPnl(e: JournalEntry): number {
  const adj = (e.adjustments ?? []).reduce((s, a) => s + (a.pnl ?? 0) - (a.commissions ?? 0), 0);
  return (e.pnl ?? 0) + adj - (e.commissions ?? 0);
}

export interface StrategyStats { strategy: string; n: number; winRate: number; avgWin: number; avgLoss: number; expectancy: number; expectancyPerRisk: number; total: number; worst: number; commissions: number; ruleBreaks: number; assignedFollowUpPnl: number }
/** EV = 胜率 × 平均盈利 − 败率 × 平均亏损 (14.9), on full-accounting P&L; sorted worst first (losses reviewed first). */
export function strategyStats(entries: JournalEntry[]): StrategyStats[] {
  const by = new Map<string, JournalEntry[]>();
  for (const e of entries) if (e.pnl != null) by.set(e.strategy, [...(by.get(e.strategy) ?? []), e]);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return [...by].map(([strategy, es]) => {
    const ps = es.map(fullPnl);
    const w = ps.filter((x) => x > 0), l = ps.filter((x) => x <= 0);
    const winRate = w.length / ps.length;
    const avgWin = w.length ? w.reduce((s, x) => s + x, 0) / w.length : 0;
    const avgLoss = l.length ? -l.reduce((s, x) => s + x, 0) / l.length : 0;
    const ev = winRate * avgWin - (1 - winRate) * avgLoss;
    const avgRisk = es.reduce((s, e) => s + e.maxLoss, 0) / es.length;
    return { strategy, n: ps.length, winRate: r2(winRate), avgWin: r2(avgWin), avgLoss: r2(avgLoss), expectancy: r2(ev), expectancyPerRisk: r2(avgRisk ? ev / avgRisk : 0), total: r2(ps.reduce((s, x) => s + x, 0)), worst: r2(Math.min(...ps)),
      commissions: r2(es.reduce((s, e) => s + (e.commissions ?? 0) + (e.adjustments ?? []).reduce((t, a) => t + (a.commissions ?? 0), 0), 0)),
      ruleBreaks: es.filter((e) => e.followedRules === false).length, assignedFollowUpPnl: r2(es.reduce((s, e) => s + (e.assignedFollowUp?.pnl ?? 0), 0)) };
  }).sort((a, b) => a.expectancy - b.expectancy);
}

/** D.3 月度统计 extras: rule compliance and current streak (D.2: 连胜超过 10 次 → 强制压力测试 + 复核本卡). */
export function journalHealth(entries: JournalEntry[], winStreakReview = 10): { compliancePct: number | null; streak: number; streakAlert: boolean } {
  const closed = entries.filter((e) => e.pnl != null).sort((a, b) => (a.closedAt ?? a.openedAt).localeCompare(b.closedAt ?? b.openedAt));
  const rated = closed.filter((e) => e.followedRules != null);
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) { const win = fullPnl(closed[i]!) > 0; if (streak === 0) streak = win ? 1 : -1; else if (win === streak > 0) streak += win ? 1 : -1; else break; }
  return { compliancePct: rated.length ? Math.round((rated.filter((e) => e.followedRules).length / rated.length) * 100) : null, streak, streakAlert: streak > winStreakReview };
}
