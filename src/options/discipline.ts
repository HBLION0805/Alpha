/**
 * 纪律系列 01–20 (knowledge/mentor/discipline/discipline-01-20.md), cited as "纪律 #NN".
 * Only mechanizable rules that were not already enforced elsewhere live here. Already-enforced ones are cited in place:
 *   #14 no widening stops → stops.ts stopMoveCheck / costAndStopChecks (止损学 §Stop Hunting)
 *   #17 exit plan before entry → journal.ts exitRules + invalidation, pretrade newDecision, stops.ts thesisStop
 *   #5 correlation → kelly.ts correlation_stress (per-trade) + sameDirectionExposure below (book level)
 * Every check returns a signal; the user executes. Caps are never loosened here.
 */
import { etDate, DAILY_CAP_BASE_PCT } from "./riskCap.ts";
import { DEFAULT_RULES, type RuleCard } from "./rules.ts";
/** 情景推演 written before entry (user 2026-10-20): problems from scenarioEngine.planProblems → BLOCK (practice: warn tag + violation no_scenario_plan_at_entry) */
export function scenarioPlanCheck(problems: string[]): DiscSignal {
  return problems.length ? { id: "scenario_plan", severity: "BLOCK", detail: `进场前没有写好情景计划：${problems.join("；")} → 先写大跌/慢跌/横盘/上涨各自怎么做（paper open --scenarios 或计划卡）`, cite: "情景推演 (src/options/scenarioEngine.ts, DECISIONS 2026-10-20)" }
    : { id: "scenario_plan", severity: "OK", detail: "情景计划已在进场前写好", cite: "情景推演 (src/options/scenarioEngine.ts)" };
}

export const D = (n: number, quote: string) => `纪律 #${String(n).padStart(2, "0")}: ${quote} (knowledge/mentor/discipline/discipline-01-20.md)`;
export interface DiscSignal { id: string; severity: "NO_TRADE" | "EXIT" | "BLOCK" | "WARN" | "OK" | "INFO"; detail: string; cite: string }

export interface TradeLog { id: string; openedAt: string; closedAt?: string; is0dte?: boolean; pnl?: number; maxLoss?: number; stop?: string; source?: string }
const day = (iso: string) => etDate(iso); // ISO timestamps → ET date (riskCap.ts)

// #4 0DTE: one trade per day
export function zeroDteCheck(log: TradeLog[], todayEt: string): DiscSignal {
  const n = log.filter((t) => t.is0dte && day(t.openedAt) === todayEt).length;
  return n >= 1
    ? { id: "0dte_one_per_day", severity: "BLOCK", detail: `already ${n} 0DTE trade today, so today's 0DTE is done (win, loss or flat)`, cite: D(4, "一天只做一笔…一笔结束，今天的 0DTE 就结束") }
    : { id: "0dte_one_per_day", severity: "OK", detail: "first 0DTE trade today", cite: D(4, "一天只做一笔") };
}

// #11 daily max loss: callers pass riskCap.ts dailyRiskCapPct(date, equity) (2% before 2026-10-30; 10% while equity ≤ $10k after)
export function dailyLossCheck(log: TradeLog[], todayEt: string, capital: number, openPnlToday = 0, limitPct: number = DAILY_CAP_BASE_PCT) /* callers pass riskCap.ts dailyRiskCapPct(today, equity, R) */: DiscSignal {
  // simulated trades only (formal + practice + mentor_shadow); real_practice never counts toward the $5k sim cap (DECISIONS 2026-10-17)
  const realized = log.filter((t) => t.source !== "real_practice" && t.closedAt && day(t.closedAt) === todayEt).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const total = realized + openPnlToday; const lim = (capital * limitPct) / 100;
  return -total >= lim
    ? { id: "daily_loss_limit", severity: "BLOCK", detail: `today's P&L $${total.toFixed(0)} hit the daily limit −$${lim.toFixed(0)} (${limitPct}%). Today is over; close the software`, cite: D(11, "到了这个数字，今天结束。不管你觉得下一笔有多好") }
    : { id: "daily_loss_limit", severity: "OK", detail: `today $${total.toFixed(0)} vs limit −$${lim.toFixed(0)} (${limitPct}%)`, cite: D(11, "今天最多只能亏到这里") };
}

// #5 aggregate same-direction exposure (book level; per-trade version is kelly.ts correlation_stress)
export interface ExposurePos { symbol: string; direction: "long" | "short"; maxLoss: number; beta?: number }
export function sameDirectionExposure(book: ExposurePos[], capital: number, R: RuleCard = DEFAULT_RULES, maxSameDir = 3): DiscSignal[] {
  const out: DiscSignal[] = [];
  for (const dir of ["long", "short"] as const) {
    const ps = book.filter((p) => p.direction === dir); if (!ps.length) continue;
    const loss = ps.reduce((s, p) => s + p.maxLoss, 0);
    const beta = ps.reduce((s, p) => s + p.maxLoss * (p.beta ?? 1), 0);
    const bad = ps.length >= maxSameDir || loss > (capital * R.commonBetMaxLossPct) / 100;
    out.push({ id: "same_direction_exposure", severity: bad ? "WARN" : "INFO", detail: `${ps.length} ${dir} positions (${ps.map((p) => p.symbol).join(", ")}): if correlations go to 1 they lose $${loss.toFixed(0)} together (${((loss / capital) * 100).toFixed(2)}%, β-weighted $${beta.toFixed(0)}) vs common-bet cap ${R.commonBetMaxLossPct}%${bad ? ". That's really one trade; don't add more in this direction" : ""}`, cite: `${D(5, "自己以为有十笔交易，其实只有一个交易")} / 大佬 Kelly critique: correlations converge toward 1` });
  }
  return out;
}

// #10 adds must be planned at entry. Reconciled: allowed adds = min(plan.maxAdds, 1 if losing [止损学], rule-card adjustment cap)
export interface AddPlan { price: number; qty: number; maxAdds: number; totalCapQty: number; maxLoss: number }
export function addPlanCheck(plan: AddPlan | undefined, s: { addsDone: number; currentQty: number; addQty: number; price: number; side: "long" | "short"; losing: boolean; newTotalMaxLoss: number }, R: RuleCard = DEFAULT_RULES): DiscSignal {
  const cite = D(10, "只有一个合理前提：你在开仓之前，就已经计划好了 (什么价格补/补多少/最多补几次/总仓位上限/最大允许亏损)");
  if (!plan || !(plan.maxAdds > 0) || !(plan.qty > 0) || !(plan.totalCapQty > 0) || !(plan.maxLoss > 0) || !(plan.price > 0)) return { id: "add_plan", severity: "BLOCK", detail: "unplanned add: no add plan written at entry (price, size, max adds, total cap, max loss)", cite };
  const allowed = Math.min(plan.maxAdds, R.maxAdjustmentsPerPosition, s.losing ? 1 : Infinity);
  const errs: string[] = [];
  if (s.addsDone >= allowed) errs.push(`adds used ${s.addsDone}/${allowed} (plan ${plan.maxAdds}, rule-card cap ${R.maxAdjustmentsPerPosition}${s.losing ? ", losing ≤1" : ""})`);
  if (s.addQty > plan.qty) errs.push(`size ${s.addQty} > planned ${plan.qty}`);
  if (s.currentQty + s.addQty > plan.totalCapQty) errs.push(`total ${s.currentQty + s.addQty} > cap ${plan.totalCapQty}`);
  if (s.newTotalMaxLoss > plan.maxLoss) errs.push(`max loss $${s.newTotalMaxLoss} > planned $${plan.maxLoss}`);
  const off = Math.abs(s.price / plan.price - 1) > 0.01;
  if (off) errs.push(`price ${s.price} is not the planned add price ${plan.price}`);
  return errs.length ? { id: "add_plan", severity: "BLOCK", detail: `add outside plan: ${errs.join("; ")}`, cite } : { id: "add_plan", severity: "OK", detail: `planned add ${s.addsDone + 1}/${allowed}`, cite };
}

// #13 two hesitations → exit (take profit if winning)
export function hesitationCheck(count: number, pnl: number): DiscSignal {
  const cite = D(13, "两次犹豫，就退出。有利润，就把利润带走");
  if (count >= 2) return { id: "two_hesitations", severity: "EXIT", detail: pnl > 0 ? `hesitated ${count}× about taking profit, so take the profit` : `hesitated ${count}× about stopping out, so exit`, cite };
  return { id: "two_hesitations", severity: count === 1 ? "WARN" : "OK", detail: `${count} hesitation logged${count === 1 ? ". One more means exit" : ""}`, cite };
}

// #9 / #15 size must follow the plan, not emotion (after a loss or a win streak)
export function sizeDisciplineCheck(s: { plannedMaxLoss: number; proposedMaxLoss: number; recent: TradeLog[] }, streakN = 3): DiscSignal {
  const closed = s.recent.filter((t) => t.closedAt).sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
  const last = closed.at(-1); const afterLoss = !!last && (last.pnl ?? 0) < 0;
  let streak = 0; for (let i = closed.length - 1; i >= 0 && (closed[i]!.pnl ?? 0) > 0; i--) streak++;
  const typical = closed.slice(-5).map((t) => t.maxLoss ?? 0).filter((x) => x > 0);
  const avg = typical.length ? typical.reduce((a, b) => a + b, 0) / typical.length : null;
  const cite = `${D(9, "永远不要因为情绪放大仓位")} / ${D(15, "永远不要报复性交易")}`;
  if (s.proposedMaxLoss > s.plannedMaxLoss) return { id: "size_vs_plan", severity: "BLOCK", detail: `risk $${s.proposedMaxLoss} > planned $${s.plannedMaxLoss}${afterLoss ? " right after a loss (revenge)" : streak >= streakN ? ` after ${streak} wins (euphoria)` : ""}`, cite };
  if ((afterLoss || streak >= streakN) && avg != null && s.proposedMaxLoss > avg * 1.2) return { id: "size_vs_plan", severity: "WARN", detail: `size up ${((s.proposedMaxLoss / avg - 1) * 100).toFixed(0)}% vs recent average ${afterLoss ? "after a loss" : `after ${streak} wins`}. Is it the system or the emotion?`, cite };
  return { id: "size_vs_plan", severity: "OK", detail: "size within plan", cite };
}

// #16 complexity: no unplanned legs/rolls/hedges on a losing trade
export function complexityCheck(s: { action: "add_leg" | "roll" | "hedge" | "new_expiry" | "related_position"; losing: boolean; plannedAtEntry: boolean }): DiscSignal {
  const cite = D(16, "它们必须是计划的一部分。而不是你亏损以后，临时想办法“救回来”");
  return s.losing && !s.plannedAtEntry
    ? { id: "rescue_complexity", severity: "BLOCK", detail: `unplanned ${s.action} on a losing trade. First answer "should I still hold this?"; exit is the simple option`, cite }
    : { id: "rescue_complexity", severity: "OK", detail: `${s.action} ${s.plannedAtEntry ? "was planned at entry" : "on a non-losing trade"} (still counts toward the 1-adjustment cap)`, cite };
}

// #19 thesis vs position
export function thesisPositionVerdict(thesisValid: boolean, positionValid: boolean): DiscSignal {
  const cite = D(19, "逻辑可以继续存在。仓位可以重新选择");
  if (!thesisValid) return { id: "thesis_position", severity: "EXIT", detail: "thesis broken, so exit (纪律 #18: 固执 ≠ 信念)", cite };
  if (!positionValid) return { id: "thesis_position", severity: "EXIT", detail: "thesis still valid but this position (expiry/strike/timing/size/structure) is wrong: close it, re-enter later with a fresh plan", cite };
  return { id: "thesis_position", severity: "OK", detail: "thesis and position both valid", cite };
}

// #2 / #20 pre-session state + #2 market-worth-trading → NO_TRADE
export interface SessionState { emotion: "ok" | "bad"; sleep: "ok" | "bad"; health: "ok" | "bad"; lifeEvents: "ok" | "bad" }
export interface MarketState { lowVolume?: boolean; unclearDirection?: boolean; chop?: boolean; poorRR?: boolean }
export const SESSION_QUESTIONS = ["情绪：生气/焦虑/失恋/吵架？ Emotion OK?", "睡眠足够？ Slept enough?", "身体舒服？ Feeling healthy?", "生活里有重大事件？ Any major life event right now?"];
export function sessionGate(s: Partial<SessionState>, m: MarketState = {}): DiscSignal {
  const missing = (["emotion", "sleep", "health", "lifeEvents"] as const).filter((k) => s[k] == null);
  const bad = (["emotion", "sleep", "health", "lifeEvents"] as const).filter((k) => s[k] === "bad");
  const mk = (Object.entries(m) as [string, boolean][]).filter(([, v]) => v).map(([k]) => k);
  if (missing.length) return { id: "session_gate", severity: "NO_TRADE", detail: `self-check unanswered: ${missing.join(", ")}`, cite: D(2, "学会什么时候不交易") };
  if (bad.length) return { id: "session_gate", severity: "NO_TRADE", detail: `state: ${bad.join(", ")} not OK. 这不是懦弱，这是纪律`, cite: `${D(2, "如果你的情绪正在影响判断，就不要交易")} / ${D(20, "交易不是你的人生")}` };
  if (mk.length) return { id: "session_gate", severity: "NO_TRADE", detail: `market not worth trading: ${mk.join(", ")}. 你不欠市场一笔交易`, cite: D(2, "市场本身不值得交易的时候，也不要交易") };
  return { id: "session_gate", severity: "OK", detail: "state and market OK", cite: D(2, "") };
}

// #3 EUPHORIA_GATE
export function euphoriaGate(s: { todayWins: number; streak: number; bigWinPctToday: number; answer?: "real_opportunity" | "want_more" }, bigWin = 1, streakN = 3): DiscSignal {
  const cite = D(3, "我现在继续交易，是因为还有真正好的机会？还是因为我舍不得结束今天这种赢钱的感觉？");
  const triggered = s.bigWinPctToday >= bigWin || s.streak >= streakN;
  if (!triggered) return { id: "euphoria_gate", severity: "OK", detail: "gate not triggered", cite };
  if (s.answer === "real_opportunity") return { id: "euphoria_gate", severity: "WARN", detail: "gate passed by your answer. Same size and standards as before the wins (no size-up)", cite };
  return { id: "euphoria_gate", severity: "BLOCK", detail: `after ${s.bigWinPctToday >= bigWin ? `a +${s.bigWinPctToday}% day` : `${s.streak} straight wins`}: ${s.answer === "want_more" ? "you said it's the feeling, so stop for today" : "answer the gate question first"}`, cite };
}

// #7 no chasing outside the planned entry range
export function entryRangeCheck(price: number, range: { low: number; high: number } | undefined, side: "long" | "short"): DiscSignal {
  const cite = D(7, "不要追高：错过不是亏损");
  if (!range) return { id: "entry_range", severity: "BLOCK", detail: "write the planned entry range before entering", cite };
  const out = side === "long" ? price > range.high : price < range.low;
  return out ? { id: "entry_range", severity: "BLOCK", detail: `${price} is outside the planned range ${range.low}–${range.high}. Missing it is not a loss`, cite } : { id: "entry_range", severity: "OK", detail: `${price} in plan ${range.low}–${range.high}`, cite };
}

// #12 cash is a position (digest note)
export const CASH_NOTE = "现金也是一种仓位 / Cash is a position: no good setup → let it sit. It keeps buying power and choice (纪律 #12)";

/** 大佬复盘 (knowledge/mentor/reviews/winrate-drop-review.md, mentor-winrate-review). */
export const WINRATE_REVIEW = "大佬复盘 胜率85%→20% (knowledge/mentor/reviews/winrate-drop-review.md)";
export type Motive = "thesis" | "share" | "entertain" | "excitement";
/** 「为了满足一些人想看交易、想找刺激的需求，我做了不必要的单子」 → only a thesis is a reason to trade. */
export function motiveCheck(m: Motive | undefined): DiscSignal {
  if (!m) return { id: "motive", severity: "BLOCK", detail: "provide discipline.motive: thesis | share | entertain | excitement (why this trade, honestly)", cite: WINRATE_REVIEW };
  return m === "thesis" ? { id: "motive", severity: "OK", detail: "motive: thesis", cite: WINRATE_REVIEW }
    : { id: "motive", severity: "BLOCK", detail: `motive "${m}": no trades made to share, entertain or chase excitement — 不会为了有东西跟大家分享而硬做交易`, cite: WINRATE_REVIEW };
}
/** 「把同时管理的仓位降回10个以下」 — cap from the rule card (default 10; can only be lowered). */
export function concurrentCheck(openPositions: number, cap: number): DiscSignal {
  return openPositions + 1 > cap ? { id: "max_concurrent_positions", severity: "BLOCK", detail: `${openPositions} open + this one > cap ${cap}: close or skip — 每一个仓位都必须有值得持有的理由`, cite: WINRATE_REVIEW }
    : { id: "max_concurrent_positions", severity: "OK", detail: `${openPositions} open + 1 ≤ cap ${cap}`, cite: WINRATE_REVIEW };
}
/** Ownership prompt printed with every pre-trade check (「这些都是我自己的决定。改正，也是我的责任。」). */
export const OWNERSHIP_PROMPT = "这是我自己的决定：判断、执行和离场都由我负责，结果不归咎于任何人。";
