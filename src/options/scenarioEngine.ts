/**
 * 情景推演 (scenario engine, user 2026-10-20 — inspired by a trader's RVMD hedge: list the scenarios FIRST, then make sure
 * each one is handled and the max loss is known). For any proposed or open position: P&L at expiry and at the mid-point
 * date under 大跌 / 慢跌 / 横盘 / 上涨, using the expected move from IV (else ATR, else ±5%) and key levels as targets.
 * One defined-risk hedge suggestion at most, only if the combined max loss stays within the confidence cap
 * (src/options/confidence.ts) and no naked short is created (FORBIDDEN in matrix.ts). Display only; never trades.
 * Phase 2 idea (not offered now): the 4-leg bearish diagonal + call-spread + crash-put combo.
 */
import { bs, yearFrac, expectedMove } from "./bs.ts";
import { analyze, nakedShorts, type Leg } from "./payoff.ts";
import { FORBIDDEN } from "./matrix.ts";

export type ScenarioId = "crash" | "slow_down" | "flat" | "rally";
export const SCENARIO_ZH: Record<ScenarioId, string> = { crash: "大跌", slow_down: "慢跌", flat: "横盘", rally: "上涨" };
export interface ELeg extends Leg { expiration: string }
export interface Levels { supports?: number[]; resistances?: number[]; source?: string }
export interface EngineInput { legs: ELeg[]; spot: number; asOf: string; iv?: number | null; atr?: number | null; levels?: Levels | null; capUsd: number; label?: string }
export interface ScenarioRow { id: ScenarioId; zh: string; price: number; target: string; pnlExpiry: number; pnlMid: number; carry: string; hurt: string; action: string }
export interface ScenarioResult { label: string; spot: number; em: number; emSource: string; front: string; mid: string; maxLoss: number | null; maxGain: number | null; rows: ScenarioRow[]; worst: ScenarioRow; capUsd: number; notes: string[] }
export interface Hedge { ok: boolean; text: string; legs: ELeg[]; before: number | null; after: number | null; table?: ScenarioResult }
/** written scenario plan stored on a journal entry / card (must exist before entry) */
export interface ScenarioPlan { at: string; source: "user" | "card" | "engine"; rows: Array<{ id: ScenarioId; price?: number; pnl?: number; action: string }> }

const MULT = 100, r2 = (x: number) => Math.round(x * 100) / 100;
const DEFAULT_IV = 0.35;
const legIv = (l: ELeg, iv?: number | null) => l.iv ?? iv ?? DEFAULT_IV;
const legName = (l: ELeg) => `${l.qty > 0 ? "+" : ""}${l.qty} ${l.strike}${l.type === "call" ? "C" : l.type === "put" ? "P" : " 股"}${l.type === "stock" ? "" : ` ${l.expiration.slice(5)}`}`;

/** each leg's P&L ($) with the underlying at S on date `at` (expired legs at intrinsic, others Black-Scholes) */
export function legPnl(l: ELeg, S: number, at: string, iv?: number | null): number {
  if (l.type === "stock") return l.qty * (S - l.premium);
  const T = Date.parse(`${l.expiration}T20:00:00Z`) - Date.parse(at.length <= 10 ? `${at}T20:00:00Z` : at);
  const v = T <= 0 ? (l.type === "call" ? Math.max(0, S - l.strike) : Math.max(0, l.strike - S)) : bs({ S, K: l.strike, T: yearFrac(at.length <= 10 ? `${at}T20:00:00Z` : at, l.expiration), sigma: legIv(l, iv), right: l.type }).price;
  return l.qty * (v - l.premium) * MULT;
}
export const pnlAt = (legs: ELeg[], S: number, at: string, iv?: number | null) => legs.reduce((s, l) => s + legPnl(l, S, at, iv), 0);

/** max loss / gain at the FRONT expiry: exact for single-expiry structures, grid scan for time spreads */
export function riskAtFront(legs: ELeg[], spot: number, iv?: number | null): { maxLoss: number | null; maxGain: number | null } {
  const exps = [...new Set(legs.filter((l) => l.type !== "stock").map((l) => l.expiration))].sort();
  if (exps.length <= 1) { const a = analyze(legs); return { maxLoss: a.maxLoss == null ? null : r2(Math.abs(a.maxLoss)), maxGain: a.maxGain == null ? null : r2(a.maxGain) }; }
  const n = nakedShorts(legs); if (n.calls || n.puts) return { maxLoss: null, maxGain: null };
  let lo = Infinity, hi = -Infinity; for (let k = 1; k <= 400; k++) { const S = spot * (0.2 + k * 0.01); const v = pnlAt(legs, S, exps[0]!, iv); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return { maxLoss: r2(Math.max(0, -lo)), maxGain: r2(hi) };
}

/** FORBIDDEN guard: any uncovered short option (naked call/put, short straddle/strangle, uncovered ratio) */
export function forbiddenGuard(legs: Leg[]): string | null {
  const n = nakedShorts(legs);
  return n.calls || n.puts ? `🛑 禁止结构（${FORBIDDEN.join(" / ")}）：有 ${n.calls} 张裸卖 call、${n.puts} 张裸卖 put` : null;
}

function targets(spot: number, em: number, lv?: Levels | null): Record<ScenarioId, { price: number; why: string }> {
  const near = (xs: number[] | undefined, want: number, lo: number, hi: number) => (xs ?? []).filter((x) => x >= lo && x <= hi).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
  const sup = near(lv?.supports, spot - 1.5 * em, spot - 2.5 * em, spot - 0.75 * em), res = near(lv?.resistances, spot + em, spot + 0.5 * em, spot + 1.5 * em);
  return { crash: sup != null ? { price: sup, why: `关键支撑 ${sup}${lv?.source ? `（${lv.source}）` : ""}` } : { price: spot - 1.5 * em, why: "−1.5× 预期波动" },
    slow_down: { price: spot - 0.5 * em, why: "−0.5× 预期波动" }, flat: { price: spot, why: "不动" },
    rally: res != null ? { price: res, why: `关键阻力 ${res}${lv?.source ? `（${lv.source}）` : ""}` } : { price: spot + em, why: "+1× 预期波动" } };
}
function action(pnl: number, maxLoss: number | null, maxGain: number | null, id: ScenarioId): string {
  if (maxGain != null && maxGain > 0 && pnl >= 0.5 * maxGain) return "止盈：已到最大盈利一半以上 → 分批了结";
  if (pnl > 0) return "持有：按止盈计划走";
  if (maxLoss != null && -pnl >= 0.5 * maxLoss) return id === "flat" ? "调整/时间止损：不动也在亏 → 到中点仍不动就平仓" : "止损：亏到最大亏损一半以上 → 按止损平仓，不加仓";
  return id === "flat" ? "持有到中点：时间价值在流失，到中点仍不动就平仓" : "持有：小亏，盯失效位";
}

export function runScenarios(i: EngineInput): ScenarioResult {
  const opts = i.legs.filter((l) => l.type !== "stock"), front = opts.map((l) => l.expiration).sort()[0] ?? i.asOf.slice(0, 10);
  const days = Math.max(1, (Date.parse(`${front}T20:00:00Z`) - Date.parse(i.asOf.length <= 10 ? `${i.asOf}T14:00:00Z` : i.asOf)) / 864e5);
  const notes: string[] = [];
  let em: number, emSource: string;
  if (i.iv != null && i.iv > 0) { em = expectedMove(i.spot, i.iv, days); emSource = `IV ${(i.iv * 100).toFixed(0)}% → 预期波动`; }
  else if (i.atr != null && i.atr > 0) { em = i.atr * Math.sqrt(days); emSource = "ATR×√天数（无 IV）"; }
  else { em = i.spot * 0.05; emSource = "无 IV/ATR → 按 ±5%"; notes.push("没有 IV 也没有 ATR，预期波动按 5% 估"); }
  const mid = new Date(Date.parse(i.asOf.length <= 10 ? `${i.asOf}T14:00:00Z` : i.asOf) + (days / 2) * 864e5).toISOString().slice(0, 10);
  const { maxLoss, maxGain } = riskAtFront(i.legs, i.spot, i.iv);
  const T = targets(i.spot, em, i.levels);
  const rows: ScenarioRow[] = (Object.keys(SCENARIO_ZH) as ScenarioId[]).map((id) => {
    const S = r2(T[id].price), per = i.legs.map((l) => ({ l, v: legPnl(l, S, front, i.iv) })), pe = per.reduce((s, x) => s + x.v, 0);
    const best = per.slice().sort((a, b) => b.v - a.v)[0]!, worst = per.slice().sort((a, b) => a.v - b.v)[0]!;
    return { id, zh: SCENARIO_ZH[id], price: S, target: T[id].why, pnlExpiry: r2(pe), pnlMid: r2(pnlAt(i.legs, S, mid, i.iv)),
      carry: best.v > 0 ? `${legName(best.l)} +$${r2(best.v)}` : "—", hurt: worst.v < 0 ? `${legName(worst.l)} −$${r2(-worst.v)}` : "—", action: action(pe, maxLoss, maxGain, id) };
  });
  if (opts.some((l) => l.iv == null) && i.iv == null) notes.push(`中点估值用默认 IV ${DEFAULT_IV * 100}%`);
  const g = forbiddenGuard(i.legs); if (g) notes.push(g);
  return { label: i.label ?? "", spot: r2(i.spot), em: r2(em), emSource, front, mid, maxLoss, maxGain, rows, worst: rows.slice().sort((a, b) => a.pnlExpiry - b.pnlExpiry || a.pnlMid - b.pnlMid)[0]!, capUsd: i.capUsd, notes };
}

const step = (S: number) => (S < 25 ? 0.5 : S < 100 ? 1 : S < 250 ? 2.5 : 5);
const rnd = (x: number, s: number) => Math.round(x / s) * s;
/** at most one defined-risk hedge for the worst scenario; refused when it would breach the cap or create a naked short */
export function suggestHedge(i: EngineInput, base = runScenarios(i)): Hedge {
  const before = base.maxLoss, w = base.worst;
  if (forbiddenGuard(i.legs)) return { ok: false, text: "🛑 现有结构有裸卖腿（禁止）→ 先改成定义风险，不谈对冲", legs: [], before, after: null };
  if (before == null) return { ok: false, text: "最大亏损无法确定 → 不做", legs: [], before, after: null };
  if (before > i.capUsd) return { ok: false, text: `现有最大亏损 $${before} 已超单笔上限 $${i.capUsd} → 对冲成本超出上限 → 缩小仓位或 NO_TRADE`, legs: [], before, after: null };
  if (w.pnlExpiry >= 0) return { ok: false, text: "所有情景都不亏 → 不需要对冲", legs: [], before, after: null };
  const down = w.price < i.spot, s = step(i.spot), exp = base.front, qty = Math.max(1, ...i.legs.filter((l) => l.type !== "stock").map((l) => Math.abs(l.qty)));
  const kLong = rnd(down ? i.spot - 0.5 * base.em : i.spot + 0.5 * base.em, s), kShort = rnd(w.price, s) === kLong ? kLong + (down ? -s : s) : rnd(w.price, s);
  const type = down ? "put" : "call", iv = i.iv ?? DEFAULT_IV;
  const px = (K: number) => r2(bs({ S: i.spot, K, T: yearFrac(i.asOf.length <= 10 ? `${i.asOf}T14:00:00Z` : i.asOf, exp), sigma: iv, right: type }).price);
  const H: ELeg[] = [{ type, strike: kLong, qty, premium: px(kLong), expiration: exp }, { type, strike: kShort, qty: -qty, premium: px(kShort), expiration: exp }];
  const all = [...i.legs, ...H];
  if (forbiddenGuard(all)) return { ok: false, text: "对冲会产生裸卖腿 → 不做", legs: [], before, after: null };
  const after = riskAtFront(all, i.spot, i.iv).maxLoss, name = `${type === "put" ? "看跌" : "看涨"}借方价差 +${kLong}/−${kShort}${type === "put" ? "P" : "C"} ×${qty}（${exp}，BS 估价 $${r2((H[0]!.premium - H[1]!.premium) * 100 * qty)}）`;
  if (after == null || after > i.capUsd) return { ok: false, text: `对冲「${name}」后最大亏损 $${after ?? "∞"} > 单笔上限 $${i.capUsd} → 对冲成本超出上限 → 缩小仓位或 NO_TRADE`, legs: H, before, after };
  const table = runScenarios({ ...i, legs: all });
  if (table.worst.pnlExpiry <= w.pnlExpiry) return { ok: false, text: `「${name}」改善不了最差情景（${w.zh}）→ 不对冲；控制仓位即可`, legs: H, before, after };
  return { ok: true, text: `对冲最差情景「${w.zh}」：买 ${name}；最大亏损 $${before} → $${after}（上限 $${i.capUsd}）`, legs: H, before, after, table };
}

const sg = (x: number) => `${x >= 0 ? "+" : "−"}$${Math.abs(x).toFixed(0)}`;
export function renderScenarioTable(r: ScenarioResult, title = "情景推演"): string[] {
  return [`**${title}${r.label ? ` · ${r.label}` : ""}**（现价 ${r.spot} · 预期波动 ±${r.em}（${r.emSource}）· 最大亏损 ${r.maxLoss == null ? "无限" : `$${r.maxLoss}`} · 上限 $${r.capUsd}）`, "",
    `| 情景 | 标的价 | 到期 ${r.front.slice(5)} | 中点 ${r.mid.slice(5)} | 赚钱腿 / 拖累腿 | 动作 |`, "|---|---|---|---|---|---|",
    ...r.rows.map((x) => `| ${x.zh} | ${x.price}（${x.target}） | ${sg(x.pnlExpiry)} | ${sg(x.pnlMid)} | ${x.carry} / ${x.hurt} | ${x.action} |`),
    ...r.notes.map((n) => `- _${n}_`), ""];
}
export function renderWithHedge(i: EngineInput, title = "情景推演"): string[] {
  const r = runScenarios(i), h = suggestHedge(i, r);
  return [...renderScenarioTable(r, title), `- **对冲建议**：${h.text}`, ...(h.ok && h.table ? ["", ...renderScenarioTable(h.table, `${title}（对冲后）`)] : []), "- _只显示，不自动下单；完整 4 腿对冲组合（看跌对角 + 看涨价差 + 崩盘保护 put）留到第二阶段。_", ""];
}
/** default written plan from the engine's actions (the user may override per scenario) */
export const planFromResult = (r: ScenarioResult, at: string, source: ScenarioPlan["source"] = "engine"): ScenarioPlan =>
  ({ at, source, rows: r.rows.map((x) => ({ id: x.id, price: x.price, pnl: x.pnlExpiry, action: x.action })) });
/** "大跌:止损;慢跌:持有;横盘:时间止损;上涨:止盈" → plan; null when unparsable */
export function parsePlan(s: string | undefined, at: string): ScenarioPlan | null {
  if (!s?.trim()) return null;
  const inv = Object.fromEntries(Object.entries(SCENARIO_ZH).map(([k, v]) => [v, k])) as Record<string, ScenarioId>;
  const rows = s.split(/[;；]/).map((x) => x.split(/[:：]/)).filter((x) => x.length >= 2 && inv[x[0]!.trim()] && x[1]!.trim()).map((x) => ({ id: inv[x[0]!.trim()]!, action: x.slice(1).join(":").trim() }));
  return rows.length ? { at, source: "user", rows } : null;
}
/** discipline: a plan needs ≥3 scenarios incl. a down move, 横盘 and 上涨, each with an action, written at or before entry */
export function planProblems(p: ScenarioPlan | null | undefined, openedAt: string): string[] {
  if (!p) return ["没有情景计划（大跌/慢跌/横盘/上涨 各自怎么做）"];
  const ids = new Set(p.rows.filter((r) => r.action?.trim()).map((r) => r.id)), out: string[] = [];
  if (ids.size < 3) out.push(`情景计划只有 ${ids.size} 个情景（至少 3 个）`);
  if (!ids.has("crash") && !ids.has("slow_down")) out.push("缺下跌情景"); if (!ids.has("flat")) out.push("缺横盘情景"); if (!ids.has("rally")) out.push("缺上涨情景");
  if (Date.parse(p.at) > Date.parse(openedAt)) out.push("情景计划写于进场之后");
  return out;
}
