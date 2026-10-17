/**
 * Expiry + weekend handling for journal entries (paper, mentor_shadow and real_practice records).
 * - Equity/ETF options: PM-settled. Settle at the official close on the expiration date, from 16:00 ET.
 * - VIX options: AM-settled (VRO, Special Opening Quotation) on the expiration date. The last trading day is the
 *   business day before. Settling requires the VRO value, which must be passed explicitly. It is never guessed from the VIX close.
 * - Weekend rule (user-approved 2026-10-15): a mentor_shadow trade losing at Friday ≥15:45 ET is closed at its
 *   latest mark (exitKind weekend_rule). Winners are kept.
 */
import type { JournalEntry } from "./journal.ts";
type Leg = NonNullable<JournalEntry["legs"]>[number];
export const AM_SETTLED = new Set(["VIX", "SPX_AM", "RUT_AM", "NDX_AM"]);
const etParts = (d: Date) => {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: Number(p.hour) % 24 * 100 + Number(p.minute), wd: p.weekday };
};
export const isAm = (sym: string) => AM_SETTLED.has(sym.toUpperCase());
/** null = not yet settleable; otherwise the settlement kind. */
export function settleable(e: JournalEntry, now: Date): "PM_close" | "AM_VRO" | null {
  const exps = (e.legs ?? []).map((l) => l.expiration).filter(Boolean) as string[];
  if (!exps.length || e.closedAt) return null;
  const last = exps.sort().at(-1)!, { date, hm } = etParts(now);
  if (isAm(e.symbol)) return date > last || (date === last && hm >= 930) ? "AM_VRO" : null;
  return date > last || (date === last && hm >= 1600) ? "PM_close" : null;
}
export const intrinsic = (l: Leg, S: number) => l.type === "stock" ? S : Math.max(0, l.type === "call" ? S - l.strike : l.strike - S);
export const legMult = (l: Leg) => (l.type === "stock" ? 1 : 100);
export function expireEntry(e: JournalEntry, settle: Record<string, number>, now: Date): { entry: JournalEntry | null; error?: string } {
  const kind = settleable(e, now);
  if (!kind) return { entry: null, error: `${e.id} 未到结算时间` };
  if ((e.legs ?? []).some((l) => l.premium == null)) return { entry: null, error: `${e.id} 缺开仓价，无法结算（先从券商订单回填）` };
  const prices: Record<string, number> = {};
  for (const l of e.legs ?? []) {
    const u = (l.underlying ?? e.symbol).toUpperCase(), S = settle[u];
    if (S == null || !Number.isFinite(S)) return { entry: null, error: kind === "AM_VRO" ? `${u} 是上午结算（VRO）：需要 --settle ${u}=<VRO>，不能用收盘价代替` : `缺 ${u} 到期日收盘价` };
    prices[u] = S;
  }
  const value = (e.legs ?? []).reduce((s, l) => s + l.qty * intrinsic(l, prices[(l.underlying ?? e.symbol).toUpperCase()]!) * legMult(l), 0);
  const cost = (e.legs ?? []).reduce((s, l) => s + l.qty * l.premium * legMult(l), 0);
  const pnl = Math.round((value - cost) * 100) / 100;
  return { entry: { ...e, closedAt: now.toISOString(), pnl, exitKind: "expiry", exitReason: `expired ${kind}`, settlement: { at: now.toISOString(), prices, kind, value: Math.round(value * 100) / 100 } } };
}
export function weekendRule(e: JournalEntry, now: Date): JournalEntry | null {
  const { wd, hm } = etParts(now);
  const m = e.marks?.at(-1);
  if (e.source !== "mentor_shadow" || e.closedAt || wd !== "Fri" || hm < 1545 || !m || m.pnl >= 0 || etParts(new Date(m.at)).date !== etParts(now).date) return null; // mark must be from today
  return { ...e, closedAt: now.toISOString(), pnl: m.pnl, exitKind: "weekend_rule", exitReason: `周五 15:45 ET 仍亏损 → 按 mark 模拟平仓（${m.at}）` };
}
