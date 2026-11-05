/**
 * Formal paper trades must come from the premarket plan (brief §2.1 今日交易计划). User-approved 2026-10-15: strict.
 * Plan ids are `${YYYY-MM-DD ET}-${TICKER}-${side}`, written to data/out/brief-latest.json → plan[].id.
 * Without a matching qualified plan item, `paper open` refuses formal → use --kind practice.
 */
import type { Candidate } from "../macro/tradeplan.ts";
export type PlanItem = Candidate & { id: string };
export const planId = (dateEt: string, c: Pick<Candidate, "ticker" | "side">) => `${dateEt}-${c.ticker}-${c.side}`;
export function checkPlanLink(a: { kind: "formal" | "practice"; planId?: string; plan: PlanItem[]; symbol: string; side: "long" | "short"; spot: number | null; todayEt: string }): string[] {
  if (a.kind !== "formal") return [];
  const hint = "（正式单必须来自盘前计划 §2.1；否则用 --kind practice）";
  if (!a.planId) return [`缺少 --plan-id${hint}`];
  if (!a.planId.startsWith(a.todayEt)) return [`--plan-id ${a.planId} 不是今天（${a.todayEt}）的计划${hint}`];
  const p = a.plan.find((x) => x.id === a.planId);
  if (!p) return [`今日计划里没有 ${a.planId}（只有：${a.plan.map((x) => x.id).join("、") || "无，今天 NO_TRADE"}）${hint}`];
  const errs: string[] = [];
  if (p.ticker !== a.symbol) errs.push(`标的 ${a.symbol} ≠ 计划 ${p.ticker}`);
  if (p.side !== a.side) errs.push(`方向 ${a.side} ≠ 计划 ${p.side}`);
  if (a.spot != null && (a.spot < p.entryZone[0] || a.spot > p.entryZone[1])) errs.push(`现价 ${a.spot} 不在计划进场区间 ${p.entryZone[0]}–${p.entryZone[1]}（纪律 #07 不追）`);
  return errs.map((e) => e + hint);
}
