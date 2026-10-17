/**
 * Per-proposal plan printed with the pre-trade checks: management triggers (rules.managementPlan), Kelly as an UPPER
 * reference only (kelly.ts, mentor critique), and the take-profit ladder from 止盈学 (takeprofit.ts). Frozen options layer:
 * this only wires existing modules into the proposal output.
 */
import type { Proposal } from "./pretrade.ts";
import { analyze, type Leg } from "./payoff.ts";
import { OWNERSHIP_PROMPT } from "./discipline.ts";
import { managementPlan, DEFAULT_RULES, type RuleCard } from "./rules.ts";
import { kellyReference, type KellyResult } from "./kelly.ts";
import { takeProfitAdvice } from "./takeprofit.ts";
import { daysTo } from "./bs.ts";

export interface ProposalPlan { kind: "credit" | "debit"; management: string[]; kelly: KellyResult | null; kellyNote: string; takeProfit: Array<{ at: string; action: string; sell: string }> }
export const TP_LEVELS = [30, 50, 80, 100, 200];

export function proposalPlan(p: Proposal & { pAssumed?: number; winPerContract?: number }, R: RuleCard = DEFAULT_RULES): ProposalPlan {
  const legs = p.legs.filter((l) => l.type !== "stock") as Leg[];
  const a = analyze(legs);
  const kind: "credit" | "debit" = a.netDebit < 0 ? "credit" : "debit";
  const qty = Math.max(1, ...legs.map((l) => Math.abs(l.qty)));
  const per = (x: number | null) => (x == null ? null : Math.abs(x) / qty);
  const exp = legs.map((l) => l.expiration).filter(Boolean).sort()[0];
  const dte = exp ? daysTo(p.asOf, exp) : p.thesisHorizonDays;
  const management = managementPlan(kind, Math.abs(a.netDebit), dte, R);
  let kelly: KellyResult | null = null, kellyNote: string;
  const L = per(a.maxLoss), W = p.winPerContract ?? per(a.maxGain);
  if (p.pAssumed == null) kellyNote = "未给 pAssumed（胜率假设）→ 不计算 Kelly；仓位只按规则卡上限。p 是假设，和 DCF 输入一样敏感（大佬 Kelly 批评）。";
  else if (L == null || !(L > 0) || W == null) kellyNote = "最大亏损/盈利未定义 → 不计算 Kelly（只做定义风险）。";
  else { const l0 = p.legs.find((l) => l.type !== "stock" && l.qty > 0) ?? p.legs[0]!;
    kelly = kellyReference({ capital: p.capital, p: p.pAssumed, winPerContract: W, maxLossPerContract: L, buyingPower: p.buyingPower, openInterest: l0.openInterest ?? null, bid: l0.bid ?? null, ask: l0.ask ?? null }, R); kellyNote = `Kelly 只是上限参考，不是仓位：最多 ${kelly.maxContracts} 张（约束：${kelly.binding}）。`; }
  const structure = kind === "debit" && legs.some((l) => l.qty < 0) ? "debit_spread" : "long_option";
  const takeProfit = kind === "credit" ? [{ at: `权利金 ${R.creditTakeProfitPct}%`, action: "TAKE_PROFIT", sell: "全部（14.7）" }] : TP_LEVELS.map((x) => {
    const adv = takeProfitAdvice({ pnlPct: x, contracts: qty, structure, spreadMaxProfitCapturedPct: structure === "debit_spread" && a.maxGain ? Math.min(100, (x / 100) * a.netDebit / a.maxGain * 100) : undefined, dte, thesisIntact: true }, R);
    return { at: `+${x}%`, action: adv.action, sell: `${Math.round(adv.targetSoldFrac * 100)}%（留 ${adv.runner} 张）` };
  });
  return { kind, management, kelly, kellyNote, takeProfit };
}

export function renderPlan(pl: ProposalPlan): string[] {
  return ["", `### 交易计划（${pl.kind === "credit" ? "信用" : "借方"}）`, ...pl.management.map((m) => `- ${m}`), "", "**Kelly（上限参考）：** " + pl.kellyNote,
    ...(pl.kelly ? pl.kelly.sensitivity.map((s) => `- p ${s.dp >= 0 ? "+" : ""}${s.dp} → ${s.p.toFixed(2)}：full Kelly ${s.fullKelly.toFixed(3)}，上限 ${s.contracts} 张`).concat(pl.kelly.warnings.map((w) => `- ${w.severity} ${w.id}: ${w.detail}`)) : []),
    "", "**止盈计划（止盈学，严格者优先）：**", "| 盈利 | 动作 | 累计卖出 |", "|---|---|---|", ...pl.takeProfit.map((t) => `| ${t.at} | ${t.action} | ${t.sell} |`), "", `**提前离场：** 逻辑失效条件未触发、时间止损未到 → 不要为了避免小亏提前离场（大佬复盘 mentor-winrate-review）。`, `**责任：** ${OWNERSHIP_PROMPT}`];
}
