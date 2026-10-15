/**
 * Adjustment playbook from the 大佬's INTC case (knowledge/mentor/MENTOR_KELLY_INTC_2026-10-14.md):
 *   "错的时候控制风险，对的时候增加敞口；不抢确认，不死守结构。"
 * In the case, "Naked Put" means an outright LONG put on a bearish view, not a short put. The flow is defined-risk at every step:
 *   long put → (not confirmed: wait; do not add because it got cheaper) → confirmed: add →
 *   near support / room shrinking: convert to PDS (sell a lower-strike put against it) → confirmed again: re-add long puts only.
 * Every adjustment is still a new trade with its own max loss (复盘 HYG/IWM/TLT/TQQQ 8, enforced in pretrade.ts).
 */
import type { PosLeg } from "./rules.ts";
import { addPlanCheck, complexityCheck, type AddPlan } from "./discipline.ts";

export const INTC_CITE = "大佬 INTC 案例 2026-10-14 (knowledge/mentor/MENTOR_KELLY_INTC_2026-10-14.md)";
export type AdjustAction = "add" | "convert_to_spread" | "readd_long" | "reduce" | "hold";
export interface AdjustmentContext {
  action: AdjustAction;
  direction: "bearish" | "bullish";
  /** has the market confirmed the thesis since the last step? evidence = what you saw (break, close below level...) */
  confirmation?: { confirmed: boolean; evidence?: string };
  /** why you want to add, for example "confirmed breakdown" or "cheaper". Price getting cheaper is not a reason */
  reason?: string;
  /** nearest support (bearish) / resistance (bullish) and the original target, used to measure the remaining room */
  supportLevel?: number; targetLevel?: number; entryPrice?: number;
  /** 止损学 §Re-Entering & Adding: is the position currently losing? how many disciplined adds already made while losing? */
  positionPnl?: number; losingAddsUsed?: number; thesisIntact?: boolean;
  /** 纪律 #10: the add plan written at entry + this add's numbers. Every add/readd is checked against it */
  addPlan?: AddPlan; addState?: { addsDone: number; currentQty: number; addQty: number; price: number; side: "long" | "short"; newTotalMaxLoss: number };
  /** 纪律 #16: structural changes (legs/rolls/hedges) on a losing trade must have been planned at entry */
  complexity?: { action: "add_leg" | "roll" | "hedge" | "new_expiry" | "related_position"; plannedAtEntry: boolean };
}
export interface AdjCheck { id: string; severity: "BLOCK" | "WARN" | "OK" | "INFO"; detail: string; cite: string }

const asAdj = (d: { id: string; severity: string; detail: string; cite: string }): AdjCheck => ({ ...d, severity: d.severity === "OK" ? "OK" : d.severity === "WARN" || d.severity === "INFO" ? d.severity : "BLOCK" });
const CHEAP = /cheap|便宜|averag|摊|lower price|better price|补仓摊/i;
/** fraction of the original room (entry → target) still left; also distance to support as % of spot */
export function remainingRoom(spot: number, c: AdjustmentContext): { roomFrac: number | null; toLevelPct: number | null } {
  const lvl = c.supportLevel; const tgt = c.targetLevel ?? lvl; const e = c.entryPrice;
  const roomFrac = tgt != null && e != null && e !== tgt ? Math.max(0, (spot - tgt) / (e - tgt)) : null;
  const toLevelPct = lvl != null ? (Math.abs(spot - lvl) / spot) * 100 : null;
  return { roomFrac, toLevelPct };
}

export function adjustmentPlaybookChecks(legs: PosLeg[], spot: number, c: AdjustmentContext, nearPct = 3, roomLeft = 0.33): AdjCheck[] {
  const out: AdjCheck[] = [];
  const opts = legs.filter((l) => l.type !== "stock");
  const wantRight = c.direction === "bearish" ? "put" : "call";
  const { roomFrac, toLevelPct } = remainingRoom(spot, c);
  const tight = (toLevelPct != null && toLevelPct <= nearPct) || (roomFrac != null && roomFrac <= roomLeft);

  if (c.complexity) out.push(asAdj(complexityCheck({ ...c.complexity, losing: (c.positionPnl ?? 0) < 0 })));
  if (c.action === "add" || c.action === "readd_long") {
    out.push(asAdj(c.addState ? addPlanCheck(c.addPlan, { ...c.addState, losing: (c.positionPnl ?? 0) < 0 }) : addPlanCheck(c.addPlan, { addsDone: 0, currentQty: 0, addQty: 0, price: c.addPlan?.price ?? 0, side: "long", losing: (c.positionPnl ?? 0) < 0, newTotalMaxLoss: 0 })));
    const conf = c.confirmation;
    if (!conf?.confirmed || !conf.evidence?.trim()) out.push({ id: "add_needs_confirmation", severity: "BLOCK", detail: "adding exposure needs written market confirmation (what the market did that proves the thesis). Without it, wait: 不抢确认", cite: `${INTC_CITE}: 等到下跌方向得到进一步确认，我才开始加大敞口` });
    else out.push({ id: "add_needs_confirmation", severity: "OK", detail: `confirmation: ${conf.evidence}`, cite: INTC_CITE });
    if (c.reason && CHEAP.test(c.reason)) out.push({ id: "no_add_because_cheaper", severity: "BLOCK", detail: `reason "${c.reason}": price getting cheaper is not confirmation. No averaging into a trade the market has not proven`, cite: `${INTC_CITE}: 我也没有因为价格变便宜就急着补仓，因为这时候市场还没有证明我是对的` });
    // 止损学 §Re-Entering & Adding: 亏损仓位最多一次纪律性加仓; 盈利仓位只在市场确认时加. Combined with the INTC rule, the stricter one wins:
    // a losing add ALSO needs confirmation (above), a written reason that is more than "cheaper", and the thesis intact. It also counts against the 1-adjustment cap in pretrade.
    if (c.positionPnl != null && c.positionPnl < 0) {
      const SLC = "止损学 §Re-Entering & Adding (knowledge/mentor/discipline/stop-loss.md): 对于正在亏损的仓位，我最多允许自己进行 一次高度纪律性的加仓 / 不要用更多的钱证明自己没有错";
      if ((c.losingAddsUsed ?? 0) >= 1) out.push({ id: "losing_add_limit", severity: "BLOCK", detail: "already used the one disciplined add on this losing position. No more averaging down", cite: SLC });
      else if (!c.reason?.trim() || c.thesisIntact !== true) out.push({ id: "losing_add_limit", severity: "BLOCK", detail: "the one add to a losing position needs a written reason (key support / thesis still holds) and thesisIntact=true", cite: SLC });
      else out.push({ id: "losing_add_limit", severity: "WARN", detail: `losing position: this is the ONE disciplined add (reason: ${c.reason}). If it is wrong again, reduce; do not add`, cite: SLC });
    }
    if (opts.some((l) => l.qty < 0) || legs.some((l) => l.type === "stock")) out.push({ id: "readd_long_only", severity: "BLOCK", detail: "re-adding exposure must be long options only (no short legs, no stock)", cite: `${INTC_CITE}: 我就只补 Long Put，重新放大空头敞口` });
    else if (opts.some((l) => l.type !== wantRight)) out.push({ id: "readd_long_only", severity: "WARN", detail: `adding ${c.direction} exposure with a non-${wantRight} leg`, cite: INTC_CITE });
    else out.push({ id: "readd_long_only", severity: "OK", detail: `long ${wantRight}s only: max loss = premium paid`, cite: INTC_CITE });
    if (tight) out.push({ id: "room_shrinking", severity: "WARN", detail: `near support/target (${toLevelPct?.toFixed(1) ?? "—"}% away, ${roomFrac != null ? (roomFrac * 100).toFixed(0) + "% of room left" : "room —"}). The de-risk path is converting to a spread, not adding outright longs`, cite: `${INTC_CITE}: 股价接近支撑位，下跌空间开始收窄，我就…改成 PDS` });
  }

  if (c.action === "convert_to_spread") {
    const longs = opts.filter((l) => l.qty > 0 && l.type === wantRight);
    const shorts = opts.filter((l) => l.qty < 0);
    const covered = shorts.every((s) => s.type === wantRight && longs.some((l) => (wantRight === "put" ? l.strike > s.strike : l.strike < s.strike)) && longs.reduce((a, l) => a + l.qty, 0) >= -shorts.reduce((a, l) => a + l.qty, 0));
    out.push(shorts.length && covered
      ? { id: "convert_defined_risk", severity: "OK", detail: `sold ${wantRight}(s) ${shorts.map((s) => s.strike).join("/")} against the long(s): becomes a ${wantRight === "put" ? "PDS" : "call debit spread"}, which cuts cost and risk`, cite: `${INTC_CITE}: 把 Naked Put 改成 PDS，降低风险和成本` }
      : { id: "convert_defined_risk", severity: "BLOCK", detail: `the conversion must sell a further-OTM ${wantRight} covered by your long ${wantRight}(s). Any other structure is not a defined-risk spread`, cite: `${INTC_CITE} / owner rule: defined-risk only` });
    out.push({ id: "convert_trigger", severity: tight ? "OK" : "INFO", detail: tight ? "near support / room shrinking: converting to a spread is the de-risk path" : "not yet near support. Converting early caps the upside; that's fine if risk control is the goal (不死守结构)", cite: INTC_CITE });
  }

  if (c.action === "hold" && !c.confirmation?.confirmed) out.push({ id: "wait_for_confirmation", severity: "INFO", detail: "not yet confirmed. Waiting is a valid action; do not restructure just because it has not worked yet if the thesis still holds, and do not add", cite: `${INTC_CITE}: 所以我选择等` });
  return out;
}

/** Suggest the next step in the INTC flow. Advisory only. */
export function suggestNextStep(s: { holding: "none" | "long" | "spread"; confirmed: boolean; thesisInvalidated: boolean; nearSupport: boolean }): { action: AdjustAction | "enter_long" | "exit" | "no_trade"; why: string } {
  if (s.thesisInvalidated) return { action: s.holding === "none" ? "no_trade" : "exit", why: "错的时候控制风险" };
  if (s.holding === "none") return { action: "enter_long", why: "enter with a defined-risk long option (or a debit spread) sized ≤ 1% max loss" };
  if (s.holding === "long" && s.nearSupport) return { action: "convert_to_spread", why: "room shrinking near support → PDS lowers risk and cost" };
  if (!s.confirmed) return { action: "hold", why: "不抢确认: wait; don't add because it is cheaper" };
  return { action: s.holding === "spread" ? "readd_long" : "add", why: s.holding === "spread" ? "confirmed again → re-add long options only" : "对的时候增加敞口: add after confirmation" };
}
