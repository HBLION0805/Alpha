/**
 * Stop-loss discipline from the 大佬's 止损学 (纪律 channel series):
 *   knowledge/mentor/discipline/stop-loss.md  (cited as "止损学 §<section>")
 * Each check names the section it enforces. These are signals and prompts; the user executes.
 */
import type { Bar } from "../levels.ts";
import { swings, roundNumbers } from "../levels.ts";
import { sma, rsi, macdHist, vortexLast } from "../adapters/indicators.ts";
import { DEFAULT_RULES, type RuleCard } from "./rules.ts";

export const SL = (s: string) => `止损学 §${s} (knowledge/mentor/discipline/stop-loss.md)`;
export interface StopSignal { id: string; severity: "EXIT" | "BLOCK" | "WARN" | "OK" | "INFO"; detail: string; cite: string; suggestions?: string[] }

/** Hedging Stop Loss is always offered alongside reduce/close (止损学 §Hedging Stop Loss). */
export const HEDGE_SUGGESTIONS = ["reduce size", "close", "long stock → buy puts / short → buy calls", "turn a long option into a spread (sell a further-OTM leg)", "hedge with SPY/QQQ puts", "partial hedge (it doesn't have to be 100%)", "lower leverage"];

// ── Mechanical Stop Loss: stocks only ─────────────────────────────────────
export function mechanicalStop(p: { instrument: "stock" | "option"; entry: number; last: number; side?: "long" | "short" }, pct = 7): StopSignal {
  if (p.instrument !== "stock") return { id: "mechanical_stop", severity: "INFO", detail: "the -7% mechanical stop is not applied to options (IV/Theta/Delta move them 20–30% routinely). Use the 30/30 rule, thesis, time and vol stops", cite: SL("Mechanical Stop Loss: 机械止损更适合股票，不适合直接套用在期权上") };
  const ch = ((p.last - p.entry) / p.entry) * 100 * (p.side === "short" ? -1 : 1);
  return ch <= -pct
    ? { id: "mechanical_stop", severity: "EXIT", detail: `${ch.toFixed(1)}% from entry ≤ -${pct}%: entry timing was wrong. Exit, observe, re-enter later`, cite: SL("Mechanical Stop Loss: 股票跌 7% → 先退出 → 等待重新入场") }
    : { id: "mechanical_stop", severity: "OK", detail: `${ch.toFixed(1)}% from entry (stop at -${pct}%)`, cite: SL("Mechanical Stop Loss") };
}

// ── 30/30 Rule: options, once the thesis is flagged broken ───────────────
export function rule3030(o: { thesisBrokenAt: string | null; expiration: string; asOf: string; valueAtBreak: number; valueNow: number }): StopSignal {
  const cite = SL("30/30 Rule: Thesis 出现问题 → 30% 剩余时间或 30% 期权亏损 → 哪个先到，就退出");
  if (!o.thesisBrokenAt) return { id: "rule_30_30", severity: "INFO", detail: "thesis not flagged broken. 30/30 clock not running", cite };
  const d = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000;
  const remainingAtBreak = d(o.thesisBrokenAt, o.expiration);
  const used = d(o.thesisBrokenAt, o.asOf);
  const timeFrac = remainingAtBreak > 0 ? used / remainingAtBreak : 1;
  const loss = o.valueAtBreak > 0 ? 1 - o.valueNow / o.valueAtBreak : 0;
  const deadline = new Date(Date.parse(o.thesisBrokenAt) + remainingAtBreak * 0.3 * 86400000).toISOString().slice(0, 10);
  if (loss >= 0.3) return { id: "rule_30_30", severity: "EXIT", detail: `option value down ${(loss * 100).toFixed(0)}% since thesis broke (≥30%). Exit now, don't wait for the time leg`, cite };
  if (timeFrac >= 0.3) return { id: "rule_30_30", severity: "EXIT", detail: `${(timeFrac * 100).toFixed(0)}% of remaining time used since thesis broke (≥30%, deadline ${deadline}) with no re-proof. Exit`, cite };
  return { id: "rule_30_30", severity: "WARN", detail: `thesis broken: exit by ${deadline} or at −30% value (now ${(timeFrac * 100).toFixed(0)}% time, −${(Math.max(0, loss) * 100).toFixed(0)}% value)`, cite };
}

// ── Multi-leg pre-trade checklist (Time-Based / Built-In Stop Loss) ──────
export interface MultiLegChecklist { maxLoss?: number | null; maxProfit?: number | null; breakevens?: number[] | null; maxLossConditions?: string; beforeExpiryPlan?: string }
export function multiLegChecklist(legCount: number, c: MultiLegChecklist | undefined): StopSignal | null {
  if (legCount < 2) return null;
  const miss: string[] = [];
  if (c?.maxLoss == null || !Number.isFinite(c.maxLoss)) miss.push("maxLoss");
  if (c?.maxProfit == null) miss.push("maxProfit");
  if (!c?.breakevens?.length) miss.push("breakevens");
  if (!c?.maxLossConditions?.trim()) miss.push("maxLossConditions (which price/time cause max loss)");
  if (!c?.beforeExpiryPlan?.trim()) miss.push("beforeExpiryPlan (close or adjust before expiry?)");
  const cite = SL("Time-Based Stop Loss: 对于组合期权交易，必须在下单前明确计算 最大亏损/最大盈利/盈亏平衡点/哪些价格和时间条件会导致最大亏损/到期前是否需要主动平仓或调整");
  return miss.length ? { id: "multileg_checklist", severity: "BLOCK", detail: `multi-leg checklist incomplete: ${miss.join(", ")}`, cite } : { id: "multileg_checklist", severity: "OK", detail: "max loss / max profit / breakeven / max-loss conditions / pre-expiry plan written", cite };
}

// ── Thesis Stop Loss ──────────────────────────────────────────────────────
export interface ThesisRecord { thesis: string; invalidation: string; recordedAt: string }
export function thesisStop(entry: ThesisRecord | undefined, now: { thesis?: string; invalidated: boolean }): StopSignal[] {
  const cite = SL("Thesis Stop Loss: 理由消失就走。不要为了仓位重新编一个理由");
  const out: StopSignal[] = [];
  if (!entry?.thesis?.trim() || !entry.invalidation?.trim()) out.push({ id: "thesis_record", severity: "BLOCK", detail: "record the thesis and its invalidation condition at entry", cite });
  if (entry && now.thesis != null && now.thesis.trim() !== entry.thesis.trim()) out.push({ id: "thesis_changed", severity: "BLOCK", detail: `thesis changed after entry ("${entry.thesis}" → "${now.thesis}"). Don't invent a new reason to keep the position; judge it on the original`, cite });
  if (now.invalidated) out.push({ id: "thesis_stop", severity: "EXIT", detail: `invalidation hit: "${entry?.invalidation ?? "?"}". Exit`, cite, suggestions: ["close"] });
  return out;
}

// ── Time-Based Stop Loss ──────────────────────────────────────────────────
export function timeStop(t: { entryDate: string; windowDays: number; asOf: string; followThrough: boolean }): StopSignal {
  const cite = SL("Time-Based Stop Loss: 行情迟迟不兑现 → 通过时间止损减仓或退出");
  if (!(t.windowDays > 0)) return { id: "time_stop", severity: "BLOCK", detail: "record the expected time window at entry", cite };
  const used = (Date.parse(t.asOf) - Date.parse(t.entryDate)) / 86400000;
  if (used > t.windowDays && !t.followThrough) return { id: "time_stop", severity: "WARN", detail: `window ${t.windowDays}d passed (${used.toFixed(0)}d) with no follow-through. Reduce or exit; Theta keeps charging`, cite, suggestions: ["reduce", "close", "convert to spread"] };
  return { id: "time_stop", severity: "OK", detail: `${used.toFixed(0)}/${t.windowDays}d of window`, cite };
}

// ── Volatility Stop Loss ──────────────────────────────────────────────────
export function volStop(v: { premium: "long" | "short"; ivEntry: number; ivNow: number; volThesis: string }, crush = 0.25, spike = 0.3): StopSignal {
  const cite = SL("Volatility Stop Loss: 方向没有错 ≠ 期权交易没有错 → 波动率环境改变 → 减仓、调整结构或退出");
  if (!(v.ivEntry > 0) || !v.volThesis?.trim()) return { id: "vol_stop", severity: "BLOCK", detail: "record IV at entry and the vol thesis", cite };
  const ch = v.ivNow / v.ivEntry - 1;
  if (v.premium === "long" && ch <= -crush) return { id: "vol_stop", severity: "WARN", detail: `IV crush ${(ch * 100).toFixed(0)}% on long premium (thesis: ${v.volThesis})`, cite, suggestions: ["reduce", "close", "convert to spread"] };
  if (v.premium === "short" && ch >= spike) return { id: "vol_stop", severity: "WARN", detail: `IV spike +${(ch * 100).toFixed(0)}% on short premium (thesis: ${v.volThesis})`, cite, suggestions: ["reduce", "close", "buy protective wing", ...HEDGE_SUGGESTIONS.slice(4, 5)] };
  return { id: "vol_stop", severity: "OK", detail: `IV ${(v.ivEntry * 100).toFixed(0)}→${(v.ivNow * 100).toFixed(0)}`, cite };
}

// ── Overnight Stop Loss ───────────────────────────────────────────────────
export interface OvernightInput {
  nowEt: string;                    // "YYYY-MM-DDTHH:MM" America/New_York
  symbol: string; capital: number;
  worstGapLoss: number;             // $ loss if the worst gap happens (caller: stress test / defined max loss)
  earnings?: { symbol: string; date: string; timing: string | null }[];
  macro?: { kind: string; title: string; date: string; timeEt: string }[];
  closeEt?: string;                 // default 16:00; check window opens 60 min before
}
const nextBizDay = (d: string) => { const x = new Date(d + "T12:00:00Z"); do x.setUTCDate(x.getUTCDate() + 1); while ([0, 6].includes(x.getUTCDay())); return x.toISOString().slice(0, 10); };
export function overnightCheck(o: OvernightInput, R: RuleCard = DEFAULT_RULES): StopSignal {
  const cite = SL("Overnight Stop Loss: Daytime Size ≠ Overnight Size / 如果明天出现最坏的情况，我能不能承受？");
  const [day, hm] = o.nowEt.split("T"); const [H, M] = (hm ?? "00:00").split(":").map(Number);
  const [cH, cM] = (o.closeEt ?? "16:00").split(":").map(Number);
  const minsToClose = (cH! * 60 + cM!) - (H! * 60 + M!);
  if (minsToClose > 60 || minsToClose < 0) return { id: "overnight", severity: "INFO", detail: `overnight check runs in the hour before the close (${minsToClose} min to close)`, cite };
  const nd = nextBizDay(day!);
  const events: string[] = [];
  for (const e of o.earnings ?? []) if (e.symbol.toUpperCase() === o.symbol.toUpperCase() && ((e.date === day && !/bmo|pre|before/i.test(e.timing ?? "")) || (e.date === nd && !/amc|post|after/i.test(e.timing ?? "")))) events.push(`earnings ${e.date} ${e.timing ?? ""}`.trim());
  for (const m of o.macro ?? []) if (m.date === nd && m.timeEt < "09:30") events.push(`${m.title} ${m.date} ${m.timeEt} ET`);
  const pct = (o.worstGapLoss / o.capital) * 100;
  const cap = R.perUnderlyingMaxLossPct;
  const survive = pct <= cap;
  return {
    id: "overnight", severity: !survive ? "WARN" : events.length ? "WARN" : "OK",
    detail: `${minsToClose} min to close. Worst-gap loss $${o.worstGapLoss.toFixed(0)} = ${pct.toFixed(2)}% of capital (cap ${cap}%) → ${survive ? "survivable" : "NOT survivable, cut before the close"}${events.length ? `; overnight events: ${events.join("; ")}` : ""}. Stop price ≠ guaranteed exit price`,
    cite, suggestions: survive && !events.length ? undefined : ["reduce size", "close", "convert to a defined-risk spread", ...HEDGE_SUGGESTIONS.slice(2, 3), ...HEDGE_SUGGESTIONS.slice(4)],
  };
}

// ── Technical Stop Loss: count deteriorating signals from bars ───────────
export interface TechSignal { id: string; deteriorating: boolean | null; detail: string }
export function technicalSignals(bars: Bar[], side: "long" | "short" = "long"): TechSignal[] {
  const s = side === "long" ? 1 : -1;
  const c = bars.map((b) => b.c); const last = c.at(-1)!; const prev = c.at(-2) ?? last;
  const out: TechSignal[] = [];
  const sw = swings(bars.slice(0, -1)).filter((x) => x.kind === (side === "long" ? "swing_low" : "swing_high"));
  const key = sw.at(-1)?.price;
  out.push({ id: "support_break", deteriorating: key == null ? null : s * (last - key) < 0, detail: key == null ? "no swing level" : `last ${last} vs key ${side === "long" ? "support" : "resistance"} ${key}` });
  if (c.length >= 35) {
    const h = macdHist(c);
    out.push({ id: "macd", deteriorating: s * h.at(-1)! < 0 && s * (h.at(-1)! - h.at(-2)!) < 0, detail: `hist ${h.at(-1)!.toFixed(3)}` });
  } else out.push({ id: "macd", deteriorating: null, detail: "need ≥35 bars" });
  const r = rsi(c);
  out.push(r.length >= 6 ? { id: "rsi", deteriorating: s * (r.at(-1)! - 50) < 0 && s * (r.at(-1)! - r.at(-6)!) < 0, detail: `RSI ${r.at(-1)!.toFixed(1)} (5 bars ago ${r.at(-6)!.toFixed(1)})` } : { id: "rsi", deteriorating: null, detail: "need ≥20 bars" });
  const mid = sma(c, 20), midPrev = sma(c.slice(0, -5), 20);
  out.push(mid != null && midPrev != null ? { id: "bollinger", deteriorating: s * (mid - midPrev) < 0 && s * (last - mid) < 0, detail: `mid ${mid.toFixed(2)} (5 bars ago ${midPrev.toFixed(2)})` } : { id: "bollinger", deteriorating: null, detail: "need ≥25 bars" });
  const m50 = sma(c, 50), m200 = sma(c, 200);
  out.push({ id: "ma50_200", deteriorating: m50 == null ? null : s * (last - m50) < 0 || (m200 != null && s * (last - m200) < 0), detail: `50MA ${m50?.toFixed(2) ?? "—"}, 200MA ${m200?.toFixed(2) ?? "—"}` });
  if (bars.length >= 15) {
    const v = vortexLast(bars.map((b) => b.h), bars.map((b) => b.l), c);
    out.push({ id: "vortex", deteriorating: s * (v.plus - v.minus) < 0, detail: `VI+ ${v.plus.toFixed(2)} VI- ${v.minus.toFixed(2)}` });
  } else out.push({ id: "vortex", deteriorating: null, detail: "need ≥15 bars" });
  let gap: number | null = null;
  for (let i = bars.length - 1; i > 0 && gap == null; i--) {
    const b = bars[i]!, p = bars[i - 1]!;
    const g = side === "long" ? (b.l > p.h ? p.h : null) : (b.h < p.l ? p.l : null);
    if (g != null && bars.slice(i).every((x) => (side === "long" ? x.l > g : x.h < g))) gap = g;
  }
  out.push({ id: "gap_fill", deteriorating: gap == null ? false : Math.abs(last - gap) / last < 0.05 && s * (last - prev) < 0, detail: gap == null ? "no unfilled gap behind price" : `unfilled gap at ${gap}` });
  return out;
}
export function technicalStop(bars: Bar[], side: "long" | "short" = "long", warnAt = 3): StopSignal {
  const sig = technicalSignals(bars, side); const bad = sig.filter((x) => x.deteriorating);
  const cite = SL("Technical Stop Loss: 多个技术信号同时恶化时…不要跟图表争论。根据风险程度减仓或退出");
  return { id: "technical_stop", severity: bad.length >= warnAt ? "WARN" : "INFO", detail: `${bad.length}/${sig.filter((x) => x.deteriorating != null).length} deteriorating: ${bad.map((x) => x.id).join(", ") || "none"}`, cite, suggestions: bad.length >= warnAt ? ["reduce", "close", ...HEDGE_SUGGESTIONS.slice(3, 5)] : undefined };
}

// ── Cost Control + Stop placement (Stop Hunting) ─────────────────────────
export interface EntryPlan { side: "long" | "short"; entry: number; structuralStop: number; plannedStop?: number; orderType: "limit" | "market"; capital: number; qty: number; isOptionBuyer?: boolean; ivRank?: number | null; recentRunPct?: number | null; priorHighsLows?: number[] }
export function costAndStopChecks(e: EntryPlan, R: RuleCard = DEFAULT_RULES): StopSignal[] {
  const out: StopSignal[] = [];
  const riskPct = Math.abs(e.entry - e.structuralStop) / e.entry * 100;
  const riskDollars = Math.abs(e.entry - e.structuralStop) * e.qty;
  out.push({ id: "entry_risk", severity: riskDollars > e.capital * R.sellerMaxLossPerTradePct / 100 ? "BLOCK" : "INFO", detail: `entry risk = distance to structural stop ${riskPct.toFixed(1)}% ($${riskDollars.toFixed(0)} on ${e.qty})`, cite: SL("Cost Control: 好的成本本身就是一种风险控制") });
  if (e.orderType !== "limit") out.push({ id: "limit_order", severity: "BLOCK", detail: "use a limit order", cite: SL("Cost Control: 使用 Limit Order 控制成交价格") });
  if (e.recentRunPct != null && e.recentRunPct >= 15) out.push({ id: "chasing", severity: "WARN", detail: `up ${e.recentRunPct}% recently. Don't chase; wait for a pullback or skip`, cite: SL("Cost Control: 股票已经暴涨后不要盲目追高 / 宁愿错过交易") });
  if (e.isOptionBuyer && e.ivRank != null && e.ivRank >= 80) out.push({ id: "high_iv_buyer", severity: "WARN", detail: `IV rank ${e.ivRank}: very expensive premium. Use a spread or skip`, cite: SL("Cost Control: IV 极高时谨慎买入期权 / 用 Spread 降低期权成本") });
  const stop = e.plannedStop ?? e.structuralStop;
  const near = (a: number, b: number) => Math.abs(a - b) / a < 0.003;
  const obvious = [...roundNumbers(stop, 0.02), ...(e.priorHighsLows ?? [])].filter((x) => near(stop, x));
  if (obvious.length) out.push({ id: "stop_hunting", severity: "WARN", detail: `stop ${stop} sits on an obvious level (${[...new Set(obvious)].join(", ")}). Place it by structure/volatility and size down; don't push it further out`, cite: SL("Fighting Against Stop Hunting: 不要把止损直接放在明显的整数位、前高前低") });
  if (e.plannedStop != null && Math.abs(e.entry - e.plannedStop) > Math.abs(e.entry - e.structuralStop) + 1e-9) out.push({ id: "stop_widened", severity: "BLOCK", detail: `planned stop ${e.plannedStop} is wider than the structural stop ${e.structuralStop}. Never widen beyond plan; skip the trade instead`, cite: SL("Fighting Against Stop Hunting: 不要为了避免止损猎杀而无限扩大止损距离；如果风险超出计划，应直接放弃交易") });
  return out;
}
/** A live stop must never move further from entry than the plan. */
export function stopMoveCheck(side: "long" | "short", planned: number, proposed: number): StopSignal {
  const wider = side === "long" ? proposed < planned : proposed > planned;
  return { id: "stop_widened", severity: wider ? "BLOCK" : "OK", detail: wider ? `moving stop ${planned} → ${proposed} widens risk beyond plan. Not allowed; exit instead` : "stop tightened or unchanged", cite: SL("Fighting Against Stop Hunting") };
}
