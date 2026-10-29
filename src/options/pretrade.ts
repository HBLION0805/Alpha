/**
 * Pre-trade checks enforced before any options entry or adjustment.
 * Each check cites its source. Lessons from the mentor's review:
 *   knowledge/mentor/reviews/REVIEW_HYG_IWM_TLT_TQQQ.md  (cited as "复盘 HYG/IWM/TLT/TQQQ")
 * plus 期权课 第13章 / 14.5 / 附录 D.2.
 */
import { dailyRiskCapPct } from "./riskCap.ts";
import { daysTo } from "./bs.ts";
import { analyze, type Leg } from "./payoff.ts";
import { DEFAULT_RULES, type RuleCard, type PosLeg } from "./rules.ts";
import { multiLegChecklist, thesisStop, type MultiLegChecklist, type ThesisRecord } from "./stops.ts";
import { motiveCheck, concurrentCheck, type Motive, zeroDteCheck, dailyLossCheck, euphoriaGate, sessionGate, sizeDisciplineCheck, entryRangeCheck, type TradeLog, type SessionState, type MarketState } from "./discipline.ts";
import { adjustmentPlaybookChecks, type AdjustmentContext } from "./adjust.ts";
import { tradeCap, capLabel, type Tier } from "./confidence.ts";
import { planProblems, type ScenarioPlan } from "./scenarioEngine.ts";
import { scenarioPlanCheck } from "./discipline.ts";

const REVIEW = "复盘 HYG/IWM/TLT/TQQQ (knowledge/mentor/reviews/REVIEW_HYG_IWM_TLT_TQQQ.md)";

export interface ProposalLeg extends PosLeg { underlying?: string; delta?: number | null; openInterest?: number | null; bid?: number | null; ask?: number | null; style?: "american" | "european" }
export interface AssignmentPlan { ifAssigned: string; protectiveLeg: string; buyingPowerNeeded: number | null; exit: string }
export interface Proposal {
  symbol: string; strategy: string; asOf: string; underlyingPrice: number | Record<string, number>;
  /** assumed win probability, an ASSUMPTION used only for the Kelly upper reference (plan.ts) */
  pAssumed?: number; winPerContract?: number;
  thesisHorizonDays: number; legs: ProposalLeg[]; capital: number; buyingPower: number; broker?: string;
  assignmentPlan?: AssignmentPlan;
  /** set when this is an adjustment (holding assigned shares, adding/rolling legs) */
  adjustmentOf?: string; adjustmentCount?: number;
  newDecision?: { thesis: string; maxLoss: number; exit: string; invalidation: string };
  /** INTC playbook context (大佬 2026-10-14): add only after confirmation; convert to spread near support; re-add long options only */
  adjustment?: AdjustmentContext;
  /** 止损学 §Time-Based Stop Loss checklist: required for every multi-leg trade */
  checklist?: MultiLegChecklist;
  /** 止损学 §Thesis Stop Loss: when set (new entries should set it), thesis + invalidation are required */
  thesisRecord?: ThesisRecord;
  /** confidence tier for the per-trade cap (src/options/confidence.ts; default medium 1%); high/highest need macro + scenario plan + technical entry aligned */
  confidence?: { tier?: Tier; macro?: boolean; technical?: boolean };
  /** 情景推演 written before entry (src/options/scenarioEngine.ts); missing → BLOCK scenario_plan */
  scenarioPlan?: ScenarioPlan | null;
  /** 纪律系列 inputs (knowledge/mentor/discipline/discipline-01-20.md). Missing inputs → BLOCK / NO_TRADE with "provide X". */
  discipline?: {
    todayEt?: string; journal?: TradeLog[]; openPnlToday?: number;
    session?: Partial<SessionState>; market?: MarketState;
    euphoriaAnswer?: "real_opportunity" | "want_more";
    plannedMaxLoss?: number;
    entryRange?: { low: number; high: number }; side?: "long" | "short";
    /** 大佬复盘 mentor-winrate-review: why this trade; only "thesis" passes */
    motive?: Motive;
    /** positions open right now (cap rules.maxConcurrentPositions, default 10) */
    openPositions?: number;
  };
}
export type Severity = "NO_TRADE" | "BLOCK" | "WARN" | "OK" | "INFO";
export interface PreCheck { id: string; severity: Severity; detail: string; cite: string }

const isShortOpt = (l: ProposalLeg) => l.type !== "stock" && l.qty < 0;
const und = (p: Proposal, l: ProposalLeg) => l.underlying ?? p.symbol;
const spot = (p: Proposal, u: string) => (typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[u] ?? NaN);

export function preTradeChecks(p: Proposal, R0: RuleCard = DEFAULT_RULES): { checks: PreCheck[]; blocked: boolean } {
  const out: PreCheck[] = [];
  // per-trade cap scales with confidence (0.5–2% of equity); without a tier the rule card's value applies (medium = 1%)
  let R = R0;
  if (p.confidence) { const c = tradeCap(p.capital, p.confidence.tier, { macro: p.confidence.macro, technical: p.confidence.technical, scenarioPlan: planProblems(p.scenarioPlan, `${p.asOf.slice(0, 10)}T23:59:59Z`).length === 0 });
    R = { ...R0, sellerMaxLossPerTradePct: c.pct, buyerPremiumPerTradePct: c.pct };
    out.push({ id: "confidence_cap", severity: "INFO", detail: capLabel(c), cite: "src/options/confidence.ts (user 2026-10-20)" }); }
  const shorts = p.legs.filter(isShortOpt);
  const americanShorts = shorts.filter((l) => l.style !== "european");

  // (1) written assignment plan for any short leg with assignment risk
  if (americanShorts.length) {
    const a = p.assignmentPlan;
    const missing: string[] = !a ? ["ifAssigned", "protectiveLeg", "buyingPowerNeeded", "exit"] : [...(["ifAssigned", "protectiveLeg", "exit"] as const).filter((k) => !a[k]?.trim()), ...(a.buyingPowerNeeded == null ? ["buyingPowerNeeded"] : [])];
    out.push(missing.length
      ? { id: "assignment_plan", severity: "BLOCK", detail: `short American-style leg(s) without a written assignment plan — missing: ${missing.join(", ")}. 有保护腿，不代表指派后产生的现股仓位就会自动被处理掉。`, cite: `${REVIEW} 以后我会调整什么 6` }
      : { id: "assignment_plan", severity: "OK", detail: "assignment plan written (if assigned / protective leg / buying power / exit)", cite: `${REVIEW} 6` });
  }

  // (2) per-leg capital / assignment, per-underlying risk; premium from one leg does not cancel another leg's risk
  const byU = new Map<string, ProposalLeg[]>();
  for (const l of p.legs) byU.set(und(p, l), [...(byU.get(und(p, l)) ?? []), l]);
  let worstAll = 0;
  for (const [u, legs] of byU) {
    const exps = new Set(legs.filter((l) => l.type !== "stock").map((l) => l.expiration));
    const ml = exps.size <= 1 ? analyze(legs as Leg[]).maxLoss : null;
    const ownPremium = legs.reduce((s, l) => s + (l.type === "stock" ? 0 : -l.qty * l.premium * 100), 0);
    if (ml == null) out.push({ id: "per_leg_risk", severity: exps.size > 1 ? "WARN" : "BLOCK", detail: `${u}: max loss not defined on its own${exps.size > 1 ? " (multi-expiry — value with time-spread model)" : ""}; another leg's premium does not cover it`, cite: `${REVIEW} 问题出在哪里 / 期权课 13.3` });
    else {
      worstAll += -ml;
      out.push({ id: "per_leg_risk", severity: -ml > p.capital * R.sellerMaxLossPerTradePct / 100 ? "WARN" : "INFO", detail: `${u}: own max loss $${(-ml).toFixed(0)} (${((-ml / p.capital) * 100).toFixed(2)}%), own net premium ${ownPremium >= 0 ? "+" : ""}$${ownPremium.toFixed(0)} — judged on its own, not netted against other legs`, cite: `${REVIEW}: 一个仓位收来的权利金…不会消除指派风险、保证金要求` });
    }
  }
  if (byU.size > 1) out.push({ id: "simultaneous_adverse", severity: worstAll > p.capital * R.commonBetMaxLossPct / 100 ? "BLOCK" : "WARN", detail: `${byU.size} underlyings in one combo: if all move against you at once, total loss $${worstAll.toFixed(0)} = ${((worstAll / p.capital) * 100).toFixed(2)}% (common-bet cap ${R.commonBetMaxLossPct}%)`, cite: `${REVIEW}: 也不会阻止多个仓位同时向不利方向移动 / 期权课 清单 13-3` });

  // (7) buying power for assignment of FULL short notional (all short legs assigned together)
  const notional = shorts.reduce((s, l) => s + l.strike * 100 * Math.abs(l.qty), 0);
  if (shorts.length) {
    const rh = (p.broker ?? "robinhood").toLowerCase() === "robinhood";
    out.push({ id: "assignment_buying_power", severity: notional > p.buyingPower ? "BLOCK" : "OK", detail: `full short notional if every short leg is assigned: $${notional.toFixed(0)} vs buying power $${p.buyingPower.toFixed(0)}${rh ? " · Robinhood handles assignment and protective legs its own way (it may not auto-exercise your long leg or net the spread) — confirm buying power covers the assigned shares before entry" : ""}`, cite: `${REVIEW} 问题出在哪里 1、4 / 以后我会调整什么 2、7` });
  }

  // (6) near-ATM short legs in credit structures
  for (const l of shorts) {
    const d = l.delta != null ? Math.abs(l.delta) : null;
    const dist = Math.abs(l.strike / spot(p, und(p, l)) - 1) * 100;
    if ((d != null && d >= 0.4) || dist < 1) out.push({ id: "near_atm_short", severity: "BLOCK", detail: `${und(p, l)} short ${l.type} ${l.strike}: near ATM (|Δ| ${d ?? "—"}, ${dist.toFixed(1)}% from spot) — assignment-prone`, cite: `${REVIEW} 问题出在哪里 1（接近平值的 Put Credit Spread 被指派）` });
    else if (d != null && d > 0.3) out.push({ id: "near_atm_short", severity: "WARN", detail: `${und(p, l)} short ${l.type} ${l.strike}: |Δ| ${d} above 0.30 (期权课 14.5 卖出腿 0.16–0.30)`, cite: `期权课 14.5 / ${REVIEW}` });
  }

  // (3) time buffer: expiry must allow for being early
  const optExps = p.legs.filter((l) => l.type !== "stock" && l.expiration).map((l) => daysTo(p.asOf, l.expiration!));
  if (optExps.length) {
    const front = Math.min(...optExps);
    const longPremium = p.legs.some((l) => l.type !== "stock" && l.qty > 0) && !shorts.length;
    const need = p.thesisHorizonDays + (longPremium ? 30 : Math.max(7, Math.round(p.thesisHorizonDays * 0.5)));
    out.push(front < need
      ? { id: "time_buffer", severity: front < p.thesisHorizonDays ? "BLOCK" : "WARN", detail: `front expiry ${front.toFixed(0)} DTE vs thesis horizon ${p.thesisHorizonDays}d — need ≥ ${need} DTE to survive being ~1 week early`, cite: `${REVIEW} 问题出在哪里 5（判断早了大约一周）/ 期权课 14.5 时间窗口 + 1 个月` }
      : { id: "time_buffer", severity: "OK", detail: `front expiry ${front.toFixed(0)} DTE ≥ ${need} (horizon ${p.thesisHorizonDays}d + buffer)`, cite: `${REVIEW} 以后我会调整什么 4` });
  }

  // (4) adjustments are NEW trade decisions
  if (p.adjustmentOf) {
    const nd = p.newDecision;
    const ok = nd && nd.thesis?.trim() && nd.exit?.trim() && nd.invalidation?.trim() && nd.maxLoss > 0;
    out.push({ id: "adjustment_is_new_trade", severity: ok ? "OK" : "BLOCK", detail: ok ? `adjustment of ${p.adjustmentOf} logged as a new decision (max loss $${nd!.maxLoss})` : `adjustment of ${p.adjustmentOf} needs its own thesis, max loss, invalidation and exit (holding assigned shares / adding legs = new exposure)`, cite: `${REVIEW} 以后我会调整什么 8 / 期权课 12 章 滚动检验` });
    if ((p.adjustmentCount ?? 1) > R.maxAdjustmentsPerPosition) out.push({ id: "adjustment_count", severity: "BLOCK", detail: `adjustment #${p.adjustmentCount} > max ${R.maxAdjustmentsPerPosition} per position`, cite: "期权课 附录 D.2【调仓】" });
    if (p.legs.some((l) => l.type !== "stock" && l.qty < 0) && p.legs.filter(isShortOpt).some((l) => !p.legs.some((x) => x.type === l.type && x.qty > 0 && und(p, x) === und(p, l))) && !p.legs.some((l) => l.type === "stock"))
      out.push({ id: "adjustment_naked", severity: "BLOCK", detail: "adjustment adds an uncovered short option", cite: `${REVIEW}（裸 Call 补救）/ 期权课 13.3` });
  }

  // (8) 止损学: multi-leg checklist + thesis record
  const ml = multiLegChecklist(p.legs.filter((l) => l.type !== "stock").length, p.checklist);
  if (ml) out.push({ ...ml, severity: ml.severity === "BLOCK" ? "BLOCK" : "OK" });
  if (p.thesisRecord) for (const t of thesisStop(p.thesisRecord, { invalidated: false })) out.push({ ...t, severity: t.severity === "BLOCK" ? "BLOCK" : "INFO" });

  // (5) INTC adjustment playbook — src/options/adjust.ts
  if (p.adjustment) out.push(...adjustmentPlaybookChecks(p.legs, spot(p, p.symbol), p.adjustment));
  else if (p.adjustmentOf) out.push({ id: "adjustment_context", severity: "WARN", detail: "adjustment without playbook context (add / convert_to_spread / readd_long + confirmation)", cite: "大佬 INTC 案例 2026-10-14" });

  // liquidity (D.1 第五步)
  for (const l of p.legs.filter((x) => x.type !== "stock")) {
    const spr = l.bid != null && l.ask != null && l.ask > 0 ? ((l.ask - l.bid) / ((l.ask + l.bid) / 2)) * 100 : null;
    if ((l.openInterest != null && l.openInterest < R.minOpenInterest) || (spr != null && spr > R.maxBidAskPct)) out.push({ id: "liquidity", severity: "WARN", detail: `${und(p, l)} ${l.type} ${l.strike}: OI ${l.openInterest ?? "—"}, spread ${spr?.toFixed(1) ?? "—"}%`, cite: "期权课 附录 D.1 第五步 / 13.7" });
  }
  out.push(...disciplineChecks(p, worstAll, R));
  return { checks: out, blocked: out.some((c) => c.severity === "BLOCK" || c.severity === "NO_TRADE") };
}

/** 纪律系列 checks wired into every entry. Missing inputs never pass silently. */
export function disciplineChecks(p: Proposal, proposedMaxLoss: number, R: RuleCard = DEFAULT_RULES): PreCheck[] {
  const d = p.discipline ?? {};
  const DC = "纪律系列 (knowledge/mentor/discipline/discipline-01-20.md)";
  const out: PreCheck[] = [];
  const need = (id: string, sev: "BLOCK" | "NO_TRADE", what: string) => out.push({ id, severity: sev, detail: `provide ${what}`, cite: DC });
  const conv = (x: { id: string; severity: string; detail: string; cite: string }): PreCheck => ({ ...x, severity: (x.severity === "EXIT" ? "BLOCK" : x.severity) as Severity });
  // #2 / #20 session state + market worth trading
  if (!d.session) need("session_gate", "NO_TRADE", "discipline.session {emotion, sleep, health, lifeEvents} (纪律 #02/#20 self-check)");
  else if (!d.market) need("market_worth_trading", "NO_TRADE", "discipline.market {lowVolume, unclearDirection, chop, poorRR} (纪律 #02)");
  else out.push(conv(sessionGate(d.session, d.market)));
  // journal-based checks: #4, #11, #3, #9/#15
  const today = d.todayEt ?? p.asOf.slice(0, 10);
  if (!d.journal) need("journal_inputs", "BLOCK", "discipline.journal (today's and recent trades) for the 0DTE, daily-loss, euphoria and size checks");
  else {
    const is0dte = p.legs.some((l) => l.type !== "stock" && l.expiration?.slice(0, 10) === p.asOf.slice(0, 10));
    if (is0dte) out.push(conv(zeroDteCheck(d.journal, today)));
    if (d.openPnlToday == null) need("daily_loss_limit", "BLOCK", "discipline.openPnlToday (today's unrealized P&L; 0 if flat)");
    else out.push(conv(dailyLossCheck(d.journal, today, p.capital, d.openPnlToday, dailyRiskCapPct(today, p.capital, R))));
    const closed = d.journal.filter((t) => t.closedAt).sort((a, b) => a.closedAt!.localeCompare(b.closedAt!));
    let streak = 0; for (let i = closed.length - 1; i >= 0 && (closed[i]!.pnl ?? 0) > 0; i--) streak++;
    const todays = closed.filter((t) => t.closedAt!.slice(0, 10) === today);
    const dayPct = (todays.reduce((s, t) => s + (t.pnl ?? 0), 0) / p.capital) * 100;
    out.push(conv(euphoriaGate({ todayWins: todays.filter((t) => (t.pnl ?? 0) > 0).length, streak, bigWinPctToday: dayPct, answer: d.euphoriaAnswer })));
    if (d.plannedMaxLoss == null) need("size_vs_plan", "BLOCK", "discipline.plannedMaxLoss (the planned $ risk written before emotion gets a vote)");
    else out.push(conv(sizeDisciplineCheck({ plannedMaxLoss: d.plannedMaxLoss, proposedMaxLoss, recent: d.journal })));
  }
  // 大佬复盘 (mentor-winrate-review): motive + concurrent positions
  out.push(conv(motiveCheck(d.motive)));
  if (d.openPositions == null) need("max_concurrent_positions", "BLOCK", `discipline.openPositions (cap ${R.maxConcurrentPositions})`);
  else out.push(conv(concurrentCheck(d.openPositions, R.maxConcurrentPositions)));
  // 情景推演 written before entry
  out.push(conv(scenarioPlanCheck(planProblems(p.scenarioPlan, p.thesisRecord?.recordedAt ?? `${p.asOf.slice(0, 10)}T23:59:59Z`))));
  // #7 entry range on the underlying
  if (!d.entryRange || !d.side) need("entry_range", "BLOCK", "discipline.entryRange {low, high} and discipline.side (纪律 #07 no chasing)");
  else if (!Number.isFinite(spot(p, p.symbol))) need("entry_range", "BLOCK", `underlyingPrice for ${p.symbol} (entry range is checked on the proposal symbol's price)`);
  else out.push(conv(entryRangeCheck(spot(p, p.symbol), d.entryRange, d.side)));
  return out;
}
