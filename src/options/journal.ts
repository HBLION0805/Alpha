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
  /** formal = counts toward readiness; practice = shown separately, excluded from readiness stats/expectancy */
  kind?: "formal" | "practice";
  /** formal only: id of the brief §2.1 plan item this trade executes (src/options/planlink.ts) */
  planId?: string;
  /** pre-trade plan card this trade was opened from (src/review/card.ts, data/journal/pending-cards.json) */
  cardId?: string;
  /** mentor_shadow = shadowing a mentor call (thesis verbatim, never readiness); real_practice = a small REAL-account trade (e.g. Robinhood) logged here for review only; always kind=practice, never readiness */
  source?: "paper_sim" | "real_practice" | "mentor_shadow";
  /** 宏观单 (user 2026-10-22): mentor trades the user forwards. Always source=mentor_shadow + kind=practice → never in the formal 30 / readiness */
  category?: "macro";
  /** real_practice: broker-reported P&L snapshots (entry cost may be unknown → costUnknown, premiums null) */
  pnlSnapshots?: Array<{ at: string; pnl: number; spot?: number; note?: string }>; costUnknown?: boolean;
  /** per-trade post-mortem (src/options/postmortem.ts) and, for mentor_shadow, the mentor's actual result */
  postMortem?: import("./postmortem.ts").PostMortem; mentorOutcome?: import("./postmortem.ts").MentorOutcome;
  /** mandatory take-profit plan at entry (src/options/tpplan.ts); tpHits = gainPct targets already alerted (-1 = close-by date) */
  takeProfit?: import("./tpplan.ts").TakeProfitPlan; tpHits?: number[];
  /** mandatory risk plan at entry (src/options/riskplan.ts) */
  riskPlan?: import("./riskplan.ts").RiskPlan;
  /** "paper" = simulated entry on real data; default "live" */
  mode?: "paper" | "live";
  /** confidence-scaled per-trade cap at open (src/options/confidence.ts): tier, % of equity, $ cap, equity used */
  confidence?: { tier: import("./confidence.ts").Tier; pct: number; capUsd: number; equity: number; downgraded?: boolean };
  /** 情景推演 written before entry (src/options/scenarios.ts ScenarioPlan); missing on a new entry = violation no_scenario_plan_at_entry */
  scenarioPlan?: import("./scenarioEngine.ts").ScenarioPlan;
  /** account size when the trade was opened (for the 1% / 2% checks) */
  capitalAtEntry?: number;
  /** timestamps proving thesis and stop were written BEFORE entry (must be ≤ openedAt) */
  thesisRecordedAt?: string; stopRecordedAt?: string; thesis?: string; stop?: string;
  /** discipline violations found at review: chasing, unplanned_add, emotional_sizing, motive_share, ... */
  violations?: string[];
  /** practice trades: rules that would have blocked a formal trade, recorded instead of blocking (warn_over_cap, warn_no_hedge, …) */
  warnTags?: string[]; warnDetails?: string[];
  /** every loss: judgment (thesis/selection) vs execution (sizing, entry, exit, rules) + tags for repeated-error detection */
  /** 股市七宗罪 behaviour tags (src/options/sins.ts): manual or backfilled auto candidates; live auto-derivation is merged at review */
  behaviorSins?: import("./sins.ts").StoredSin[];
  /** bearish entries: 做空清单 snapshot at entry (src/options/shortside.ts); tags are warnings, manual = items Alpha cannot check */
  shortChecklist?: { tags: string[]; details: string[]; info: string[]; manual: string[]; metrics: import("./shortside.ts").ShortMetrics };
  /** 亏损归因 (knowledge/mentor/psychology/why-new-members-lose.md): judgment / execution / risk (sizing, stop) / variance (normal probability); tags see psych.ts LOSS_TAGS */
  lossReview?: { at: string; errorClass: "judgment" | "execution" | "risk" | "variance"; errorTags: string[]; note?: string };
  /** 交易日记 6 问 (knowledge/mentor/psychology/journal-and-outcome-bias.md); profitableButWrong = 赚钱但做错 confirmed at review (null/undefined = not judged) */
  tradeJournal?: { at: string; why?: string; thesis?: string; right?: string; wrong?: string; violated?: string; redo?: string };
  profitableButWrong?: boolean;
  /** psychology entry tags (src/options/psych.ts), warn-only; confirmNote = confirmation signal written for an add to a loser; target = price target (Put 要尊重价格) */
  psychTags?: string[]; confirmNote?: string; priceTarget?: number;
  /** losing close: the four attribution questions (chosen class ticked) + repeat-error callouts (src/review/mentor.ts lossPrompt) */
  lossPrompt?: { at: string; questions: string[]; repeats: string[]; mentor?: string[] };
  /** exit kind; "discretionary" before invalidation and before the time stop = premature (大佬复盘 mentor-winrate-review) */
  exitKind?: "invalidation" | "time_stop" | "take_profit" | "max_loss" | "discretionary" | "expiry" | "weekend_rule";
  /** net debit per contract at entry and where it came from */
  entryPrice?: number | null; entryPriceSource?: "paper_fill" | "robinhood_orders" | "broker" | "user" | "unknown";
  /** settlement used by paper expire (equity close or VIX AM VRO) */
  /** paper expire could not settle yet (e.g. VIX AM settlement value missing) */
  settlePending?: string;
  settlement?: { at: string; prices: Record<string, number>; kind: "PM_close" | "AM_VRO"; value: number };
  timeStopAt?: string;
  /** open positions (including this one) at entry */
  concurrentAtEntry?: number;
  motive?: "thesis" | "share" | "entertain" | "excitement";
  /** paper.ts: legs at the simulated fill, and every mark-to-market */
  legs?: Array<{ underlying?: string; type: "call" | "put" | "stock"; strike: number; qty: number; premium: number; expiration?: string; iv?: number }>;
  underlyingAtEntry?: number;
  /** 唱反调 critique shown before entry (src/review/critique.ts); acked = WARNs were overridden with --ack */
  critique?: { at: string; objections: Array<{ id: string; severity: "BLOCK" | "WARN"; text: string; cite: string }>; blocks: number; warns: number; acked?: boolean };
  marks?: Array<{ at: string; value: number; pnl: number; spot: number | null; sources: string[]; estimated?: boolean }>;
}

/** Daily loss cap (rules.ts dailyLossLimitPct, $100 on $5k) counts every SIMULATED trade: formal, practice AND mentor_shadow
 *  (user decision 2026-10-17). real_practice records are real-account trades logged for review and stay out. */
export const countsTowardDailyCap = (e: Pick<JournalEntry, "source">) => e.source !== "real_practice";

type JLeg = NonNullable<JournalEntry["legs"]>[number];
/** Stock legs are also written by hand / routines as { type: "stock", qty, price } (no premium, no strike). Every valuer
 *  (paperMark, expireEntry, analyze, costBasis) reads premium/strike, so such a leg was "entry price unknown" / NaN.
 *  Normalize: premium = price (else the entry's entryPrice), strike = premium (payoff.ts convention: stock strike = entry). */
export function normalizeLeg(l: JLeg, entryPrice?: number | null): JLeg {
  if (l.type !== "stock") return l;
  const raw = l as JLeg & { price?: number };
  const premium = Number.isFinite(raw.premium) ? raw.premium : Number.isFinite(raw.price) ? raw.price! : Number.isFinite(entryPrice) ? entryPrice! : raw.premium;
  const strike = Number.isFinite(raw.strike) ? raw.strike : premium;
  return premium === raw.premium && strike === raw.strike ? l : { ...l, premium, strike };
}
export const normalizedLegs = (e: Pick<JournalEntry, "legs" | "entryPrice">): JLeg[] => {
  const legs = e.legs ?? [], ep = legs.length && legs.every((l) => l.type === "stock") ? e.entryPrice : null; // entryPrice of a combo is the net debit, not the stock price
  return legs.map((l) => normalizeLeg(l, ep));
};
/** in place (cli load); returns the ids whose legs changed */
export function normalizeJournalLegs(entries: JournalEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) { if (!e.legs) continue; const n = normalizedLegs(e); if (n.some((l, i) => l !== e.legs![i])) { e.legs = n; out.push(e.id); } }
  return out;
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
