/**
 * Mandatory take-profit plan at entry (paper open refuses without one).
 * Source: knowledge/mentor/discipline/take-profit.md (大佬 止盈学):
 *  - short_dated (≤14 DTE, §5/§9): +30–50% → sell ≥50%; close everything by the day before expiry
 *  - narrative/catalyst (§8): +100% sell 50% (recover cost), +200% sell 25%, last 25% lottery runner
 *  - windfall (§2/§5): sudden big gain → take ≥90% off, runner ≤10% (trigger: +80%, "80%–100% 果断退出")
 */
export type TPKind = "short_dated" | "narrative" | "windfall";
export interface TPTarget { gainPct: number; sellPct: number; note: string }
export interface TakeProfitPlan { kind: TPKind; targets: TPTarget[]; closeBy: string | null; source: string }
export const TP_ALERT = "止盈触发：按计划执行";
const SRC = "knowledge/mentor/discipline/take-profit.md";
const DAY = 86400_000;
export function minDte(exps: Array<string | undefined>, asOf: string): number | null {
  const d = exps.filter(Boolean).map((e) => Math.round((Date.parse(e!) - Date.parse(asOf)) / DAY));
  return d.length ? Math.min(...d) : null;
}
export function buildTakeProfit(kind: string | undefined, exps: Array<string | undefined>, asOf: string): { plan: TakeProfitPlan | null; errors: string[] } {
  if (!kind) return { plan: null, errors: [`缺少 --tp short_dated|narrative|windfall（开仓前必须写死止盈计划，见 ${SRC}）`] };
  const dte = minDte(exps, asOf);
  const firstExp = exps.filter(Boolean).sort()[0];
  const dayBefore = firstExp ? new Date(Date.parse(firstExp) - DAY).toISOString().slice(0, 10) : null;
  let targets: TPTarget[];
  if (kind === "short_dated") targets = [{ gainPct: 30, sellPct: 50, note: "+30% 卖出 ≥50%" }, { gainPct: 50, sellPct: 100, note: "+50% 卖出其余" }];
  else if (kind === "narrative") targets = [{ gainPct: 100, sellPct: 50, note: "+100% 卖 50%（收回本金）" }, { gainPct: 200, sellPct: 25, note: "+200% 再卖 25%" }];
  else if (kind === "windfall") targets = [{ gainPct: 80, sellPct: 90, note: "暴利 +80% 先止盈 ≥90%，Runner ≤10%" }];
  else return { plan: null, errors: [`--tp ${kind} 无效：short_dated | narrative | windfall`] };
  const errors: string[] = [];
  if (kind !== "short_dated" && dte != null && dte <= 14) errors.push(`DTE ${dte} ≤ 14 → 必须用 --tp short_dated（近期到期，止盈学 §9）`);
  // ≤14 DTE: always close by the day before expiry
  return errors.length ? { plan: null, errors } : { plan: { kind, targets, closeBy: dte != null && dte <= 14 ? dayBefore : null, source: SRC }, errors };
}
/** Net debit basis in $ (premium × qty × multiplier); null when credit or unknown. */
export function costBasis(legs: Array<{ type: string; qty: number; premium: number }>): number | null {
  const c = legs.reduce((s, l) => s + l.premium * l.qty * (l.type === "stock" ? 1 : 100), 0);
  return c > 0 ? c : null;
}
/** New TP hits for this mark (targets already in `done` are skipped). */
export function checkTakeProfit(plan: TakeProfitPlan | undefined, basis: number | null, pnl: number, todayEt: string, done: number[] = []): Array<{ gainPct: number; text: string }> {
  if (!plan) return [];
  const out: Array<{ gainPct: number; text: string }> = [];
  const g = basis ? (pnl / basis) * 100 : null;
  for (const t of plan.targets) if (g != null && g >= t.gainPct && !done.includes(t.gainPct)) out.push({ gainPct: t.gainPct, text: `${TP_ALERT}（${t.note}；当前 +${g.toFixed(0)}%）` });
  if (plan.closeBy && todayEt >= plan.closeBy && !done.includes(-1)) out.push({ gainPct: -1, text: `${TP_ALERT}（到期前一天 ${plan.closeBy} 全部平仓）` });
  return out;
}
export function renderTakeProfit(p: TakeProfitPlan): string {
  return `止盈计划（${p.kind}）：${p.targets.map((t) => t.note).join("；")}${p.closeBy ? `；${p.closeBy} 前全部平仓` : ""} · 来源 ${p.source}`;
}
