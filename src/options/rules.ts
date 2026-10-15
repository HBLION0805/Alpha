import { bs, yearFrac, type Right } from "./bs.ts";
import { analyze, nakedShorts, type Leg } from "./payoff.ts";

/**
 * Options position rule card — defaults from 期权课 第13章 13.2–13.4 / 13.9 and 附录 D.2 (knowledge/courses/options/).
 * Where the course gives a range, the owner's risk-first rule picks the conservative end.
 * Management defaults from 14.7 管理规则的事先设定.
 */
export interface RuleCard {
  buyerPremiumPerTradePct: number;    // 13.2 单笔权利金 0.5–2%
  buyerPremiumTotalPct: number;       // 13.2 总买方权利金 5–10%
  tailHedgeBudgetPct: number;         // 13.2 尾部保护年度预算 1–2%，单列
  sellerMaxLossPerTradePct: number;   // 13.3 单笔最大亏损 1–2%
  sellerMaxLossTotalPct: number;      // 13.3 卖方最大亏损之和 10–20%
  perUnderlyingMaxLossPct: number;    // 13.3 单一标的 3–5%
  commonBetMaxLossPct: number;        // D.2 共同赌注 3–5%
  minCreditPctOfWidth: number;        // D.2 权利金 ≥ 翼宽的 20%
  undefinedRiskSelling: false;        // D.2 【未定义风险的卖方】□ 不做 — owner rule: always 不做
  stressGapIv30MaxPct: number;        // 13.4 −20% & IV +30 点 ≤ 10–15%
  stressIvX2MaxPct: number;           // 13.4 IV 翻倍 ≤ 5%
  stressCombinedMaxPct: number;       // 13.4 复合 ≤ 15–20%
  minOpenInterest: number; maxBidAskPct: number; // D.1 第五步 OI < 1000 或价差 > 10%
  maxAdjustmentsPerPosition: number;  // D.2 调仓 每个仓位最多调整 1 次
  winStreakReview: number;            // D.2 连胜超过 10 次 → 强制压力测试 + 复核
  creditTakeProfitPct: number;        // 14.7 信用价差/铁鹰 权利金的 50%
  creditManageAtDte: number;          // 14.7 21 天处理
  creditStopMultipleOfCredit: number; // 14.7 权利金的 2 倍
  buyerTakeProfitPct: number;         // 14.7 买入单腿 50–100% 时了结一半
  buyerTimeStopFraction: number;      // 14.7 到期时间过半无进展 → 退出
  debitSpreadTakeProfitPct: number;   // 14.7 借记价差 最大盈利的 50–75%
  calendarTakeProfitPct: number; calendarStopPct: number; // 14.7 日历 25–50% / 净支出 50%
  forbidden: string[];
}
export const DEFAULT_RULES: RuleCard = {
  buyerPremiumPerTradePct: 1, buyerPremiumTotalPct: 5, tailHedgeBudgetPct: 1,
  sellerMaxLossPerTradePct: 1, sellerMaxLossTotalPct: 10, perUnderlyingMaxLossPct: 3, commonBetMaxLossPct: 3, minCreditPctOfWidth: 20,
  undefinedRiskSelling: false, stressGapIv30MaxPct: 10, stressIvX2MaxPct: 5, stressCombinedMaxPct: 15,
  minOpenInterest: 1000, maxBidAskPct: 10, maxAdjustmentsPerPosition: 1, winStreakReview: 10,
  creditTakeProfitPct: 50, creditManageAtDte: 21, creditStopMultipleOfCredit: 2, buyerTakeProfitPct: 50, buyerTimeStopFraction: 0.5,
  debitSpreadTakeProfitPct: 50, calendarTakeProfitPct: 25, calendarStopPct: 50,
  forbidden: ["naked_call", "naked_put", "short_straddle", "short_strangle"],
};

export interface PosLeg { type: Right | "stock"; strike: number; qty: number; premium: number; expiration?: string; iv?: number; mark?: number }
export interface Position { id?: string; symbol: string; strategy: string; underlyingPrice: number; openedAt?: string; legs: PosLeg[] }
export interface Book { capital: number; asOf: string; positions: Position[]; rules?: Partial<RuleCard> }

const MULT = 100;
function legValue(l: PosLeg, S: number, asOf: string, ivMult = 1, ivAdd = 0): number {
  if (l.type === "stock") return S;
  const T = l.expiration ? yearFrac(asOf, l.expiration) : 0;
  const iv = (l.iv ?? 0.2) * ivMult + ivAdd;
  return bs({ S, K: l.strike, T, sigma: iv, right: l.type }).price;
}
export function positionValue(p: Position, asOf: string, S = p.underlyingPrice, ivMult = 1, ivAdd = 0): number {
  return p.legs.reduce((s, l) => s + l.qty * legValue(l, S, asOf, ivMult, ivAdd) * (l.type === "stock" ? 1 : MULT), 0);
}

export interface StressRow { id: string; symbol: string; base: number; gapDown20: number; ivX2: number; both: number; gapUp10: number }
/** Weekly stress test (期权课 13.4 / 清单 13-2): 跳空 −20% & IV +30 点; IV 翻倍; 复合 −20% & IV 翻倍; plus +10% for short calls. */
export function stressTest(book: Book): { rows: StressRow[]; total: Omit<StressRow, "id" | "symbol">; worst: number; worstPct: number } {
  const rows = book.positions.map((p, i) => {
    const base = positionValue(p, book.asOf);
    const d = (S: number, m: number, add = 0) => Math.round(positionValue(p, book.asOf, S, m, add) - base);
    const S = p.underlyingPrice;
    return { id: p.id ?? `#${i + 1}`, symbol: p.symbol, base: Math.round(base), gapDown20: d(S * 0.8, 1, 0.30), ivX2: d(S, 2), both: d(S * 0.8, 2), gapUp10: d(S * 1.1, 1) };
  });
  const sum = (k: keyof Omit<StressRow, "id" | "symbol">) => rows.reduce((s, r) => s + r[k], 0);
  const total = { base: sum("base"), gapDown20: sum("gapDown20"), ivX2: sum("ivX2"), both: sum("both"), gapUp10: sum("gapUp10") };
  const worst = Math.min(total.gapDown20, total.ivX2, total.both, total.gapUp10, 0);
  return { rows, total, worst, worstPct: Number(((worst / book.capital) * 100).toFixed(2)) };
}

export interface RuleCheck { rule: string; ok: boolean; detail: string }
const isOption = (l: PosLeg) => l.type !== "stock";
/** Max loss of a position at expiry if all option legs share an expiry; time spreads fall back to net debit. */
export function maxLossOf(p: Position): number | null {
  const opts = p.legs.filter(isOption);
  const exps = new Set(opts.map((l) => l.expiration));
  if (exps.size <= 1) return analyze(p.legs as Leg[]).maxLoss;
  const debit = p.legs.reduce((s, l) => s + l.qty * l.premium * (l.type === "stock" ? 1 : MULT), 0);
  return debit > 0 ? -debit : null;
}

export function checkBook(book: Book): { rules: RuleCard; checks: RuleCheck[] } {
  const R = { ...DEFAULT_RULES, ...(book.rules ?? {}) };
  const cap = book.capital, pct = (x: number) => ((x / cap) * 100).toFixed(2) + "%";
  const checks: RuleCheck[] = [];
  let total = 0; const byU = new Map<string, number>(); let buyers = 0; let buyerPremium = 0;
  for (const p of book.positions) {
    const ml = maxLossOf(p);
    const n = nakedShorts(p.legs);
    if ((n.calls > 0 || (n.puts > 0 && p.strategy !== "cash_secured_put"))) { checks.push({ rule: "defined_risk", ok: false, detail: `${p.symbol} ${p.strategy}: uncovered short option(s) (${n.calls} call, ${n.puts} put) — not allowed` }); continue; }
    if (ml == null) { checks.push({ rule: "defined_risk", ok: false, detail: `${p.symbol} ${p.strategy}: UNDEFINED max loss — not allowed (naked/short-vol)` }); continue; }
    const loss = -ml; total += loss; byU.set(p.symbol, (byU.get(p.symbol) ?? 0) + loss);
    const net = p.legs.reduce((s, l) => s + l.qty * l.premium * (l.type === "stock" ? 0 : MULT), 0);
    const hasStock = p.legs.some((l) => l.type === "stock");
    if (net > 0 && !hasStock) {
      buyers++; buyerPremium += net;
      checks.push({ rule: "buyer_premium_per_trade", ok: net <= cap * R.buyerPremiumPerTradePct / 100, detail: `${p.symbol} ${p.strategy}: premium $${net.toFixed(0)} = ${pct(net)} (cap ${R.buyerPremiumPerTradePct}%, 13.2)` });
    } else if (!hasStock) {
      checks.push({ rule: "seller_max_loss_per_trade", ok: loss <= cap * R.sellerMaxLossPerTradePct / 100, detail: `${p.symbol} ${p.strategy}: max loss $${loss.toFixed(0)} = ${pct(loss)} (cap ${R.sellerMaxLossPerTradePct}%, 13.3)` });
    }
  }
  checks.push({ rule: "total_max_loss", ok: total <= cap * R.sellerMaxLossTotalPct / 100, detail: `sum of max losses $${total.toFixed(0)} = ${pct(total)} (cap ${R.sellerMaxLossTotalPct}%, 期权课 13.3)` });
  checks.push({ rule: "buyer_premium_total", ok: buyerPremium <= cap * R.buyerPremiumTotalPct / 100, detail: `all long premium $${buyerPremium.toFixed(0)} = ${pct(buyerPremium)} (cap ${R.buyerPremiumTotalPct}%, 13.2 "如果它们全部归零，我亏多少？")` });
  for (const [u, l] of byU) checks.push({ rule: "concentration", ok: l <= cap * R.perUnderlyingMaxLossPct / 100, detail: `${u}: $${l.toFixed(0)} = ${pct(l)} (cap ${R.perUnderlyingMaxLossPct}%, 13.3 集中度)` });
  const st = stressTest(book);
  const sp = (x: number) => Number(((-x / cap) * 100).toFixed(2));
  checks.push({ rule: "stress_gap20_iv+30", ok: sp(st.total.gapDown20) <= R.stressGapIv30MaxPct, detail: `−20% & IV +30: $${st.total.gapDown20} (${-sp(st.total.gapDown20)}%, cap −${R.stressGapIv30MaxPct}%, 13.4)` });
  checks.push({ rule: "stress_iv_x2", ok: sp(st.total.ivX2) <= R.stressIvX2MaxPct, detail: `IV×2: $${st.total.ivX2} (${-sp(st.total.ivX2)}%, cap −${R.stressIvX2MaxPct}%, 13.4)` });
  checks.push({ rule: "stress_combined", ok: sp(st.total.both) <= R.stressCombinedMaxPct, detail: `−20% & IV×2: $${st.total.both} (${-sp(st.total.both)}%, cap −${R.stressCombinedMaxPct}%, 13.4) — 超限当周减仓` });
  for (const p of book.positions) for (const f of R.forbidden) if (p.strategy === f) checks.push({ rule: "forbidden_structure", ok: false, detail: `${p.symbol}: ${f} is forbidden by the rule card` });
  return { rules: R, checks };
}

/** Pre-written management triggers for a new position (copied into the journal at entry). */
export function managementPlan(kind: "credit" | "debit", credit: number, dte: number, R: RuleCard = DEFAULT_RULES): string[] {
  if (kind === "credit") return [
    `Take profit when ${R.creditTakeProfitPct}% of the $${credit.toFixed(0)} credit is captured (buy back at $${(credit * (1 - R.creditTakeProfitPct / 100)).toFixed(0)}).`,
    `At ${R.creditManageAtDte} DTE: close or roll — gamma risk rises; a roll is a NEW trade and must pass entry rules.`,
    `Stop when loss reaches ${R.creditStopMultipleOfCredit}× credit = $${(credit * R.creditStopMultipleOfCredit).toFixed(0)} (spread worth $${(credit * (1 + R.creditStopMultipleOfCredit)).toFixed(0)}).`,
    `Close immediately if the thesis invalidation level trades.`,
  ];
  return [
    `At +${R.buyerTakeProfitPct}%–100% on premium take half off (期权课 14.7).`,
    `Time stop: if the move hasn't come by ${Math.round(dte * R.buyerTimeStopFraction)} days (${Math.round(R.buyerTimeStopFraction * 100)}% of ${Math.round(dte)} DTE), exit — theta accelerates.`,
    `Premium is sized to go to zero; never add to a losing long option.`,
    `Close immediately if the thesis invalidation level trades.`,
  ];
}
