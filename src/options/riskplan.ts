/**
 * Mandatory risk plan for every `paper open` (user rule 2026-10-15). Rejects when anything is missing.
 * - hedge: built_in_spread | direct (protective put / collar) | portfolio (SPY/QQQ put spread) + detail.
 *   Options default suggestion: built_in_spread.
 * - stocks: mechanical stop (default −7%, knowledge/mentor/discipline/stop-loss.md 「一般是 -7%」) AND thesis invalidation.
 * - options: structure max loss, thesis invalidation, 30/30 reference (30% of remaining DTE from entry; −30% value),
 *   computed and stored. Per mentor, the live 30/30 clock restarts when the thesis breaks (stops.ts rule3030).
 * - hard cap: per-trade loss ≤ 1% of the account, regardless of anything else.
 * - whichever stop triggers first wins; a stop is never widened.
 */
import { analyze } from "./payoff.ts";
import { effectiveRules, type RuleCard } from "./rules.ts";

export type HedgeMethod = "built_in_spread" | "direct" | "portfolio";
export const HEDGE_METHODS: HedgeMethod[] = ["built_in_spread", "direct", "portfolio"];
export const STOP_RULE = "哪个止损先触发就执行哪个（机械止损 / 论点失效 / 30/30 / 最大亏损）；止损只能收紧，永不放宽。";
export interface RiskPlan {
  instrument: "stock" | "option";
  hedge: { method: HedgeMethod; detail: string };
  invalidation: string;
  maxLoss: number; maxLossPct: number; capPct: number;
  stock?: { entry: number; stopPct: number; stopPrice: number; side: "long" | "short" };
  option?: { entryValue: number; dteAtEntry: number; rule3030Date: string; loss30Value: number; loss30Pnl: number };
  rule: string;
}
type L = { type: "call" | "put" | "stock"; strike: number; qty: number; premium: number; expiration?: string };
export interface RiskArgs { hedge?: string; hedgeDetail?: string; invalidation?: string; stopPct?: number; capital: number; asOf: string; rules?: Partial<RuleCard> }

export function buildRiskPlan(legs: L[], a: RiskArgs): { plan: RiskPlan | null; errors: string[] } {
  const E: string[] = [];
  const R = effectiveRules(a.rules), capPct = R.sellerMaxLossPerTradePct;
  const isStock = legs.every((l) => l.type === "stock");
  if (!a.hedge) E.push(`缺少 --hedge（${HEDGE_METHODS.join(" | ")}）${isStock ? "" : "；期权建议 built_in_spread（价差本身就是对冲）"}`);
  else if (!HEDGE_METHODS.includes(a.hedge as HedgeMethod)) E.push(`--hedge ${a.hedge} 无效：只能是 ${HEDGE_METHODS.join(" | ")}`);
  if (!a.hedgeDetail?.trim()) E.push("缺少 --hedge-detail（对冲细节：哪条腿 / 哪个保护 put / 哪个 SPY/QQQ put spread）");
  if (!a.invalidation?.trim()) E.push("缺少论点失效条件 --invalidation");
  if (a.hedge === "built_in_spread" && !legs.some((l) => l.type !== "stock" && l.qty < 0) ) E.push("hedge=built_in_spread 但结构里没有卖出腿（不是价差）→ 改成价差，或选 direct / portfolio");
  if (a.hedge === "built_in_spread" && isStock) E.push("股票不能用 built_in_spread → 选 direct（保护 put / collar）或 portfolio");
  let plan: RiskPlan | null = null;
  if (isStock) {
    const stopPct = a.stopPct ?? 7;
    if (!(stopPct > 0)) E.push("机械止损 --stop-pct 必须 > 0");
    const qty = legs.reduce((s, l) => s + l.qty, 0), entry = legs[0]!.premium;
    const side = qty >= 0 ? "long" : "short";
    const stopPrice = Number((side === "long" ? entry * (1 - stopPct / 100) : entry * (1 + stopPct / 100)).toFixed(2));
    const maxLoss = Math.abs(qty) * entry * stopPct / 100;
    plan = { instrument: "stock", hedge: { method: a.hedge as HedgeMethod, detail: a.hedgeDetail ?? "" }, invalidation: a.invalidation ?? "", maxLoss: Math.round(maxLoss), maxLossPct: Number(((maxLoss / a.capital) * 100).toFixed(2)), capPct,
      stock: { entry, stopPct, stopPrice, side }, rule: STOP_RULE };
  } else {
    const an = analyze(legs as never);
    if (an.maxLoss == null) E.push("期权结构最大亏损未定义 → 只做定义风险");
    const opts = legs.filter((l) => l.type !== "stock" && l.expiration);
    const exp = opts.map((l) => l.expiration!).sort()[0];
    if (an.maxLoss != null && exp) {
      const maxLoss = Math.abs(an.maxLoss), dte = Math.max(1, Math.round((Date.parse(exp) - Date.parse(a.asOf)) / 864e5));
      const entryValue = Math.abs(an.netDebit);
      const d3030 = new Date(Date.parse(a.asOf) + Math.round(dte * 0.3) * 864e5).toISOString().slice(0, 10);
      plan = { instrument: "option", hedge: { method: a.hedge as HedgeMethod, detail: a.hedgeDetail ?? "" }, invalidation: a.invalidation ?? "", maxLoss: Math.round(maxLoss), maxLossPct: Number(((maxLoss / a.capital) * 100).toFixed(2)), capPct,
        option: { entryValue: Math.round(entryValue), dteAtEntry: dte, rule3030Date: d3030, loss30Value: Math.round(entryValue * 0.7), loss30Pnl: -Math.round(entryValue * 0.3) }, rule: STOP_RULE };
    }
  }
  if (plan && plan.maxLoss > a.capital * capPct / 100) E.push(`单笔最大亏损 $${plan.maxLoss}（${plan.maxLossPct}%）> 硬上限 ${capPct}%（$${Math.round(a.capital * capPct / 100)}）→ 减少数量`);
  return { plan: E.length ? null : plan, errors: E };
}

/** A stop update may only tighten: long stock stop can only rise, short only fall; max loss can only shrink. */
export function tightenOnly(plan: RiskPlan, next: { stopPrice?: number; maxLoss?: number }): string | null {
  if (next.maxLoss != null && next.maxLoss > plan.maxLoss) return `最大亏损只能减少（$${plan.maxLoss} → $${next.maxLoss} 是放宽）`;
  if (plan.stock && next.stopPrice != null && (plan.stock.side === "long" ? next.stopPrice < plan.stock.stopPrice : next.stopPrice > plan.stock.stopPrice)) return `止损 ${plan.stock.stopPrice} → ${next.stopPrice} 是放宽：永不放宽止损`;
  return null;
}

export function renderRiskPlan(p: RiskPlan): string {
  return ["### 风险计划", `- 对冲：${p.hedge.method} — ${p.hedge.detail}`, `- 论点失效：${p.invalidation}`,
    `- 最大亏损 $${p.maxLoss}（${p.maxLossPct}%，硬上限 ${p.capPct}%）`,
    ...(p.stock ? [`- 机械止损 ${p.stock.side === "long" ? "−" : "+"}${p.stock.stopPct}% → ${p.stock.stopPrice}（stop-loss.md：一般是 -7%）`] : []),
    ...(p.option ? [`- 30/30 参考：${p.option.rule3030Date}（剩余 ${p.option.dteAtEntry} 天的 30%）或价值跌到 $${p.option.loss30Value}（−30%，$${p.option.loss30Pnl}）；论点一旦出问题，时钟从那一刻重算（stops.ts）`] : []),
    `- ${p.rule}`].join("\n");
}
