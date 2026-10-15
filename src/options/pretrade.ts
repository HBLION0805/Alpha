/**
 * Pre-trade checks enforced before any options entry or adjustment.
 * Each check cites its source. Lessons from the mentor's review:
 *   knowledge/mentor/reviews/REVIEW_HYG_IWM_TLT_TQQQ.md  (cited as "复盘 HYG/IWM/TLT/TQQQ")
 * plus 期权课 第13章 / 14.5 / 附录 D.2.
 */
import { daysTo } from "./bs.ts";
import { analyze, type Leg } from "./payoff.ts";
import { DEFAULT_RULES, type RuleCard, type PosLeg } from "./rules.ts";
import { multiLegChecklist, thesisStop, type MultiLegChecklist, type ThesisRecord } from "./stops.ts";
import { adjustmentPlaybookChecks, type AdjustmentContext } from "./adjust.ts";

const REVIEW = "复盘 HYG/IWM/TLT/TQQQ (knowledge/mentor/reviews/REVIEW_HYG_IWM_TLT_TQQQ.md)";

export interface ProposalLeg extends PosLeg { underlying?: string; delta?: number | null; openInterest?: number | null; bid?: number | null; ask?: number | null; style?: "american" | "european" }
export interface AssignmentPlan { ifAssigned: string; protectiveLeg: string; buyingPowerNeeded: number | null; exit: string }
export interface Proposal {
  symbol: string; strategy: string; asOf: string; underlyingPrice: number | Record<string, number>;
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
}
export type Severity = "BLOCK" | "WARN" | "OK" | "INFO";
export interface PreCheck { id: string; severity: Severity; detail: string; cite: string }

const isShortOpt = (l: ProposalLeg) => l.type !== "stock" && l.qty < 0;
const und = (p: Proposal, l: ProposalLeg) => l.underlying ?? p.symbol;
const spot = (p: Proposal, u: string) => (typeof p.underlyingPrice === "number" ? p.underlyingPrice : p.underlyingPrice[u] ?? NaN);

export function preTradeChecks(p: Proposal, R: RuleCard = DEFAULT_RULES): { checks: PreCheck[]; blocked: boolean } {
  const out: PreCheck[] = [];
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
  return { checks: out, blocked: out.some((c) => c.severity === "BLOCK") };
}
