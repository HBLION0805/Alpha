/**
 * 止盈学 (knowledge/mentor/discipline/take-profit.md, verbatim: take-profit.verbatim.md), cited as "止盈学 §N".
 *
 * Reconciliation with the rule card / 期权课 14.7 (stricter rule wins, capital preservation first):
 *  - Long premium: course "+50%–100% take half off" (buyerTakeProfitPct 50) and mentor §5 "+30–50% consider TP, +80–100% exit (≥90% out, runner ≤10%)".
 *      → +30%: CONSIDER_TP; +50%: sell ≥50% (course); +80%: sell ≥90% (mentor). Each threshold only ever raises the fraction sold.
 *  - Catalyst ladder §8 (+100% sell 50%, +200% sell 25%, runner 25%) is read as CUMULATIVE minimums. The course's half-off at +50% still applies,
 *      so ≥50% is out from +50% on, ≥75% from +200%. Runner ≤25% only while the catalyst is confirmed.
 *  - Technical confirmation §7 ("more room") needs ≥3 independent confirmations; it relaxes ONLY the +80% step from ≥90% to ≥75% out. The course half-off still applies.
 *  - Lottery §2, near expiry §9, bull trap §6, catastrophic §3 and turbulent loss §10 override everything above.
 *  - Debit spreads: also close at debitSpreadTakeProfitPct (50%) of max profit. Credit spreads: rule-card creditTakeProfitPct (50% of credit) is unchanged.
 *  - Whole contracts: the amount to sell is rounded UP (runner rounded down). Never buy more to manufacture a runner.
 */
import { DEFAULT_RULES, type RuleCard } from "./rules.ts";

export const TP = (n: number, q: string) => `止盈学 §${n}: ${q} (knowledge/mentor/discipline/take-profit.md)`;
export type Curve = "lottery" | "catastrophic_loss" | "standard" | "standard_variant" | "bull_trap" | "technical_confirmation" | "narrative_catalyst" | "near_term_expiry" | "turbulent_loss" | "turbulent_gain" | "general";

const signFlips = (xs: number[]) => { let n = 0; for (let i = 2; i < xs.length; i++) if (Math.sign(xs[i]! - xs[i - 1]!) * Math.sign(xs[i - 1]! - xs[i - 2]!) < 0) n++; return n; };

/** Classify an option P&L path (% of premium, oldest first) into one of the 止盈学 curves. Context flags refine it. */
export function classifyCurve(path: number[], ctx: { dte?: number; catalystConfirmed?: boolean; technicalConfirmations?: number } = {}): Curve {
  if (path.length < 3) return ctx.dte != null && ctx.dte <= 7 && (path.at(-1) ?? 0) > 0 ? "near_term_expiry" : ctx.catalystConfirmed && (path.at(-1) ?? 0) > 0 ? "narrative_catalyst" : "general";
  const now = path.at(-1)!, max = Math.max(...path), min = Math.min(...path);
  const n = path.length, flips = signFlips(path);
  if (now <= -50 && min <= -60 && flips <= Math.max(2, n / 4)) return "catastrophic_loss";
  if (now <= -20 && flips > Math.max(2, n / 4)) return "turbulent_loss";
  const iMax = path.indexOf(max);
  if (ctx.catalystConfirmed && now > 0) return "narrative_catalyst"; // a confirmed catalyst burst is §8, not a random §2 windfall
  if (max >= 100 && iMax <= Math.max(2, Math.floor(n * 0.2)) && path.slice(0, iMax + 1).every((x) => x >= -5)) return "lottery";
  if (ctx.dte != null && ctx.dte <= 7 && now > 0) return "near_term_expiry";
  const firstNeg = path.findIndex((x) => x < 0);
  const recrossed = firstNeg >= 0 && path.slice(firstNeg).some((x) => x > 0);
  if (recrossed && (ctx.technicalConfirmations ?? 0) >= 3 && now > 0) return "technical_confirmation";
  if (max >= 30 && now < max * 0.35 && iMax < n - 1) return "standard_variant";
  const half = path.slice(0, Math.ceil(n / 2));
  if (half.every((x) => Math.abs(x) < 15) && now >= 20) return "turbulent_gain";
  if (recrossed) {
    const after = path.slice(path.findIndex((x, i) => i > firstNeg && x > 0));
    const peakAfter = Math.max(...after);
    if (peakAfter < 30 && (now <= 0 || now < peakAfter * 0.5 || after.length <= 3)) return "bull_trap";
    return "standard";
  }
  return "general";
}

export interface TPInput {
  pnlPct: number;                // current P&L % of premium paid (long premium) or of debit (spread)
  path?: number[];               // P&L % history for the curve classifier
  contracts: number; soldContracts?: number;
  structure: "long_option" | "debit_spread";
  spreadMaxProfitCapturedPct?: number; // debit spread: % of max profit captured
  dte?: number;
  daysHeld?: number;
  catalystConfirmed?: boolean;
  technicalConfirmations?: number;     // count of independent confirmations (price action, volume, indicators...)
  volumeConfirmed?: boolean; holdConfirmed?: boolean; // bull-trap test after returning to profit
  thesisIntact?: boolean;
}
export interface TPAdvice { curve: Curve; action: "HOLD" | "CONSIDER_TP" | "SELL" | "EXIT"; targetSoldFrac: number; sellNow: number; runner: number; addBlocked: boolean; reasons: string[]; cites: string[] }

export function takeProfitAdvice(x: TPInput, R: RuleCard = DEFAULT_RULES): TPAdvice {
  const curve = classifyCurve(x.path ?? [x.pnlPct], { dte: x.dte, catalystConfirmed: x.catalystConfirmed, technicalConfirmations: x.technicalConfirmations });
  const reasons: string[] = [], cites: string[] = [];
  let target = 0; let action: TPAdvice["action"] = "HOLD"; let addBlocked = false;
  const raise = (f: number, a: TPAdvice["action"], why: string, cite: string) => { if (f > target || (f === target && a === "EXIT")) { target = f; action = a; } else if (action === "HOLD" && a === "CONSIDER_TP") action = a; reasons.push(why); cites.push(cite); };
  const p = x.pnlPct;

  if (curve === "catastrophic_loss" || curve === "turbulent_loss" || x.thesisIntact === false) {
    raise(1, "EXIT", curve === "turbulent_loss" ? "turbulent loss: stop, exit, keep the remaining capital" : x.thesisIntact === false ? "thesis is dead: don't get attached to the position" : "catastrophic loss: save what can be saved", curve === "turbulent_loss" ? TP(10, "止损，退出，保住剩余资本") : TP(3, "当 Thesis 已经死亡，就不要再和仓位谈感情"));
    addBlocked = true;
  }
  const path = x.path ?? [];
  const backInProfitAfterDD = path.some((v) => v < 0) && p > 0;
  if ((curve === "bull_trap" || backInProfitAfterDD) && !(x.volumeConfirmed && x.holdConfirmed) && (x.technicalConfirmations ?? 0) < 3 && !x.catalystConfirmed) {
    addBlocked = true;
    if (p >= -5) raise(1, "EXIT", "back in profit after a drawdown without volume + hold confirmation: use the escape window, exit flat or small", TP(6, "仓位既然已经给了你一次逃生机会…小赚就走，或者以极小的亏损退出。不要把一次逃生机会，当成再次加仓的理由"));
  }
  if (x.dte != null && x.dte <= 7 && p > 0) raise(1, "SELL", `near expiry (${x.dte} DTE) with profit: take it`, TP(9, "交易已经成功，就把利润拿走"));
  if (curve === "lottery" || (!x.catalystConfirmed && p >= 100 && (x.daysHeld ?? Infinity) <= 3)) raise(0.9, "SELL", "fast big gain: lock ≥90%, runner ≤10%", TP(2, "可以先止盈 90%，留下 10% Runner"));

  // tiered / general thresholds (cumulative minimums; course half-off at +50% always applies)
  if (p >= R.buyerTakeProfitPct) raise(0.5, "SELL", `+${p.toFixed(0)}% ≥ +${R.buyerTakeProfitPct}%: take at least half off`, "期权课 14.7 买入单腿 50–100% 时了结一半 (rules.ts buyerTakeProfitPct)");
  if (x.catalystConfirmed) {
    if (p >= 100) raise(0.5, "SELL", "catalyst confirmed, +100%: ≥50% sold (principal back)", TP(8, "盈利 +100%：卖出 50% → 收回全部本金"));
    if (p >= 200) raise(0.75, "SELL", "catalyst confirmed, +200%: ≥75% sold; last ≤25% is the lottery runner", TP(8, "盈利 +200%：再卖出 25%…最后 25%：作为 Lottery Runner"));
  } else if (p >= 80) {
    const tech = (x.technicalConfirmations ?? 0) >= 3;
    raise(tech ? 0.75 : 0.9, "SELL", tech ? `+${p.toFixed(0)}% with ${x.technicalConfirmations} confirmations: some extra room, still ≥75% out` : `+${p.toFixed(0)}% ≥ +80%: exit ≥90%, runner ≤10%`, tech ? TP(7, "当价格行为、成交量以及多个技术指标开始共同确认…可以给盈利仓位更多空间") : TP(5, "如果已经达到 80%–100%，通常应该果断退出…先止盈至少 90%，Runner 不超过 10%"));
  } else if (p >= 30 && target === 0) raise(0, "CONSIDER_TP", `+${p.toFixed(0)}%: in the +30–50% zone, consider taking profit`, TP(5, "已经获得 30%–50% 的利润，就应该认真考虑止盈"));
  if (x.structure === "debit_spread" && (x.spreadMaxProfitCapturedPct ?? 0) >= R.debitSpreadTakeProfitPct) raise(1, "SELL", `debit spread at ${x.spreadMaxProfitCapturedPct}% of max profit ≥ ${R.debitSpreadTakeProfitPct}%: close`, "期权课 14.7 借记价差 最大盈利的 50–75% (rules.ts debitSpreadTakeProfitPct)");
  if (curve === "standard_variant") reasons.push("profit was given back: next time act at the thresholds above");
  if (curve === "standard_variant") cites.push(TP(5, "不要让一笔已经成功的交易，重新变成一笔失败的交易"));

  const sold = x.soldContracts ?? 0;
  const mustHaveSold = Math.ceil(x.contracts * target - 1e-9);
  const sellNow = Math.max(0, Math.min(x.contracts - sold, mustHaveSold - sold));
  if (action === "HOLD" && !reasons.length) reasons.push("no take-profit trigger");
  return { curve, action, targetSoldFrac: target, sellNow, runner: x.contracts - Math.max(sold, mustHaveSold), addBlocked, reasons, cites: [...new Set(cites)] };
}
