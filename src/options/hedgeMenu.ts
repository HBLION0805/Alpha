/**
 * 情景对冲菜单 (user 2026-10-20 follow-up): for EVERY scenario where the position loses (or gives back most of its
 * mid-point gain), 1–3 defined-risk hedge / adjustment candidates chosen for that scenario:
 *   上涨 vs a bearish position → narrow cheap OTM call debit spread, or a pre-set stop on the underlying;
 *   下跌 vs a bullish position → narrow put debit spread, or a stop;
 *   横盘 → sell a further-OTM leg against the long (covered: long option → vertical, vertical → butterfly), or a calendar;
 *   慢跌/慢涨 not enough → time stop, butterfly / covered short leg to cut theta;
 *   crash beyond a short leg → further-OTM long to cap it.
 * Covered-leg sales count as hedges because they cut max loss. Each candidate: legs, est. cost (Robinhood mark when that exact
 * contract is in data/in/rh-option-quotes.json, else Black-Scholes — marked), new max loss, P&L in all 4 scenarios, cap fit
 * (confidence tier, src/options/confidence.ts) — over-cap ones are shown as 超上限, never hidden. FORBIDDEN (naked shorts)
 * candidates are never generated. Display only; never trades.
 */
import { bs, yearFrac } from "./bs.ts";
import { analyze } from "./payoff.ts";
import { runScenarios, renderScenarioTable, pnlAt, forbiddenGuard, SCENARIO_ZH, type ELeg, type EngineInput, type ScenarioId, type ScenarioResult } from "./scenarioEngine.ts";

export type RhQuote = { underlying?: string; type: string; strike: number; expiration: string; mark?: number | null; bid?: number | null; ask?: number | null; iv?: number | null };
export interface Candidate {
  kind: "debit_spread" | "covered_short" | "butterfly" | "calendar" | "crash_wing" | "stop" | "time_stop";
  name: string; legs: ELeg[]; rule?: string;
  /** + debit paid / − credit received, $ */ cost: number; src: "RH" | "BS" | "—";
  newMaxLoss: number | null; approx: boolean; pnl: Record<ScenarioId, number>; fits: boolean; why: string;
}
export interface ScenarioHedges { id: ScenarioId; zh: string; basePnl: number; reason: string; picks: Candidate[] }

const r2 = (x: number) => Math.round(x * 100) / 100, IDS = Object.keys(SCENARIO_ZH) as ScenarioId[];
const iso = (a: string) => (a.length <= 10 ? `${a}T14:00:00Z` : a);
const nm = (l: ELeg) => `${l.qty > 0 ? "+" : "−"}${Math.abs(l.qty)} ${l.strike}${l.type === "call" ? "C" : "P"} ${l.expiration.slice(5)}`;

/** strike grid step: smallest gap between existing strikes, else by price */
function strikeStep(legs: ELeg[], S: number): number {
  const ks = [...new Set(legs.filter((l) => l.type !== "stock").map((l) => l.strike))].sort((a, b) => a - b);
  const gaps = ks.slice(1).map((k, j) => r2(k - ks[j]!)).filter((g) => g > 0);
  return gaps.length ? Math.min(...gaps) : S < 25 ? 0.5 : S < 100 ? 1 : S < 250 ? 2.5 : 5;
}
/** a Friday ≥5 days after asOf and before `before` (weekly expiry; confirm on Robinhood) */
function nearerFriday(asOf: string, before: string): string | null {
  const d = new Date(Date.parse(iso(asOf)) + 5 * 864e5); while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  const s = d.toISOString().slice(0, 10); return s < before ? s : null;
}
/** max loss over the life of the position: exact for one expiry, else a price grid at every expiry date */
function maxLossOf(legs: ELeg[], spot: number, iv: number | null | undefined): number | null {
  if (forbiddenGuard(legs)) return null;
  const exps = [...new Set(legs.filter((l) => l.type !== "stock").map((l) => l.expiration))].sort();
  if (exps.length <= 1) { const a = analyze(legs); return a.maxLoss == null ? null : r2(Math.abs(a.maxLoss)); }
  let lo = Infinity; for (const e of exps) for (let k = 1; k <= 400; k++) lo = Math.min(lo, pnlAt(legs, spot * (0.2 + k * 0.01), e, iv));
  return r2(Math.max(0, -lo));
}

export function hedgeMenu(i: EngineInput, quotes: RhQuote[] = [], sym?: string, base: ScenarioResult = runScenarios(i)): ScenarioHedges[] {
  if (forbiddenGuard(i.legs)) return [];
  const opts = i.legs.filter((l) => l.type !== "stock"), q = Math.max(1, ...opts.map((l) => Math.abs(l.qty)));
  const k = strikeStep(i.legs, i.spot), rnd = (x: number) => r2(Math.round(x / k) * k), front = base.front;
  const ivOf = (t: string, K: number, exp: string) => opts.find((l) => l.type === t && l.strike === K && l.expiration === exp)?.iv ?? i.iv ?? 0.35;
  const bsPx = (t: "call" | "put", K: number, exp: string) => r2(bs({ S: i.spot, K, T: yearFrac(iso(i.asOf), exp), sigma: ivOf(t, K, exp), right: t }).price);
  const price = (t: "call" | "put", K: number, exp: string): { px: number; src: "RH" | "BS" } => {
    const qq = quotes.find((x) => (!sym || !x.underlying || x.underlying === sym) && x.type === t && x.strike === K && x.expiration === exp);
    const m = qq?.mark ?? (qq?.bid != null && qq?.ask != null ? (qq.bid + qq.ask) / 2 : null);
    if (m != null && m > 0) return { px: r2(m), src: "RH" };
    return { px: bsPx(t, K, exp), src: "BS" };
  };
  const leg = (t: "call" | "put", K: number, qty: number, exp = front) => { const p = price(t, K, exp); return { l: { type: t, strike: K, qty, premium: p.px, expiration: exp, iv: ivOf(t, K, exp) } as ELeg, src: p.src }; };
  const baseP = Object.fromEntries(base.rows.map((x) => [x.id, x.pnlExpiry])) as Record<ScenarioId, number>;
  const at = Object.fromEntries(base.rows.map((x) => [x.id, x.price])) as Record<ScenarioId, number>;
  const pool: Candidate[] = [];
  const addLegs = (kind: Candidate["kind"], name: string, made0: Array<{ l: ELeg; src: "RH" | "BS" }>, why0: string) => {
    let why = why0;
    // one pricing source per candidate: Robinhood only when every leg has a quote, else Black-Scholes for all (no mixing)
    const made = made0.every((m) => m.src === "RH") ? made0 : made0.map((m) => ({ l: { ...m.l, premium: bsPx(m.l.type as "call" | "put", m.l.strike, m.l.expiration) }, src: "BS" as const }));
    const H = made.map((m) => m.l), all = [...i.legs, ...H];
    if (H.some((h) => h.strike <= 0) || forbiddenGuard(all)) return; // never a naked short
    const newMaxLoss = maxLossOf(all, i.spot, i.iv); if (newMaxLoss == null) return;
    const srcs = new Set(made.map((m) => m.src)), cost = r2(H.reduce((s, h) => s + h.qty * h.premium * 100, 0));
    const pv = IDS.map((id) => pnlAt(all, at[id], front, i.iv)); if (Math.max(...pv) - Math.min(...pv) < 5) why += "（各情景结果几乎一样 ≈ 等于现在平仓锁定）";
    pool.push({ kind, name, legs: H, cost, src: [...srcs][0] as "RH" | "BS", newMaxLoss, approx: false,
      pnl: Object.fromEntries(IDS.map((id) => [id, r2(pnlAt(all, at[id], front, i.iv))])) as Record<ScenarioId, number>, fits: newMaxLoss <= i.capUsd, why });
  };
  const bearish = baseP.crash > baseP.rally;
  // 1) narrow debit spreads against the adverse direction (near = long at ±0.5EM; far/cheap = long at the scenario target)
  for (const [t, sgn] of [["call", 1], ["put", -1]] as const) {
    if ((t === "call") !== bearish) continue; // only against the side that hurts
    const tgt = t === "call" ? at.rally : at.crash;
    for (const [lbl, K] of [["近", rnd(i.spot + sgn * 0.5 * base.em)], ["远（更便宜）", rnd(tgt)]] as const) {
      const K2 = r2(K + sgn * k);
      addLegs("debit_spread", `${lbl}${t === "call" ? "看涨" : "看跌"}借方价差 +${K}/−${K2}${t === "call" ? "C" : "P"} ×${q}`, [leg(t, K, q), leg(t, K2, -q)],
        `${t === "call" ? "涨" : "跌"}过 ${K} 后由这个窄价差补一部分亏损；宽度只 ${k}，成本小`);
    }
  }
  // 2) covered short against each long option leg: long single → vertical; long leg of a vertical → butterfly
  for (const L of opts.filter((l) => l.qty > 0)) {
    const t = L.type as "call" | "put", sgn = t === "call" ? 1 : -1;
    const shorts = opts.filter((s) => s.type === t && s.qty < 0 && s.expiration === L.expiration);
    if (!shorts.length) for (const m of [0.5, 1]) { const K = rnd(L.strike + sgn * Math.max(k, m * base.em)); if (K === L.strike) continue;
      addLegs("covered_short", `卖出备兑 ${K}${t === "call" ? "C" : "P"} ×${L.qty}（${L.expiration.slice(5)}，变成垂直价差）`, [leg(t, K, -L.qty, L.expiration)],
        `用远一点的${t === "call" ? "看涨" : "看跌"}收权利金，抵掉一部分成本 → 最大亏损变小；代价是 ${K} 以外的收益封顶`); }
    else { const S0 = shorts[0]!, w = Math.abs(L.strike - S0.strike), wing = r2(S0.strike + sgn * w);
      addLegs("butterfly", `改蝶式：再卖 ${S0.strike}${t === "call" ? "C" : "P"}、买 ${wing}${t === "call" ? "C" : "P"} ×${Math.abs(S0.qty)}`, [leg(t, S0.strike, S0.qty, S0.expiration), leg(t, wing, -S0.qty, S0.expiration)],
        `把价差改成 ${L.strike}/${S0.strike}/${wing} 蝶式：收一点权利金、降低最大亏损和时间损耗；代价是走过头时收益回吐`); }
    // calendar: sell a nearer weekly at the same strike (covered by the later-dated long)
    const ne = nearerFriday(i.asOf, L.expiration);
    if (ne && ne < L.expiration && !opts.some((s) => s.qty < 0 && s.expiration < L.expiration))
      addLegs("calendar", `日历：卖 ${ne.slice(5)} ${L.strike}${t === "call" ? "C" : "P"} ×${L.qty}（近周到期，需在 RH 确认有这一档）`, [leg(t, L.strike, -L.qty, ne)],
        "近周的时间价值掉得快，卖掉它补贴远月多头的时间损耗；横盘时最有用");
  }
  // 3) crash beyond a short put / rally beyond a short call: further-OTM long to cap it (only if that tail loses)
  for (const S0 of opts.filter((l) => l.qty < 0)) {
    const t = S0.type as "call" | "put", tail: ScenarioId = t === "put" ? "crash" : "rally";
    if (baseP[tail] >= 0) continue;
    const K = rnd(t === "put" ? Math.min(at.crash, S0.strike - k) : Math.max(at.rally, S0.strike + k));
    addLegs("crash_wing", `买更远的保护 ${K}${t === "call" ? "C" : "P"} ×${Math.abs(S0.qty)}`, [leg(t, K, -S0.qty, S0.expiration)], `${t === "put" ? "跌穿" : "涨穿"} ${S0.strike} 之后的亏损由 ${K} 封住`);
  }
  // 4) rules that cost nothing: stop on the underlying (adverse direction), time stop at the mid-point
  const adverse: ScenarioId = bearish ? "rally" : "crash", stopLvl = rnd(i.spot + (bearish ? 0.5 : -0.5) * base.em);
  const stopP = r2(pnlAt(i.legs, stopLvl, base.mid, i.iv));
  const ruled = (f: (id: ScenarioId) => number) => Object.fromEntries(IDS.map((id) => [id, r2(f(id))])) as Record<ScenarioId, number>;
  { const pnl = ruled((id) => ((bearish ? at[id] >= stopLvl : at[id] <= stopLvl) ? Math.max(baseP[id], stopP) : baseP[id])), worst = Math.max(0, -Math.min(...Object.values(pnl)));
    pool.push({ kind: "stop", name: `预设止损：标的${bearish ? "站上" : "跌破"} ${stopLvl} 就平仓`, legs: [], rule: `close if ${bearish ? ">" : "<"} ${stopLvl}`, cost: 0, src: "—", newMaxLoss: r2(worst), approx: true, pnl, fits: worst <= i.capUsd,
      why: `不花钱；${SCENARIO_ZH[adverse]}时在 ${stopLvl} 附近离场，约 ${stopP >= 0 ? "+" : "−"}$${Math.abs(stopP).toFixed(0)}（跳空不保证）` }); }
  { const mid = Object.fromEntries(base.rows.map((x) => [x.id, x.pnlMid])) as Record<ScenarioId, number>;
    const pnl = ruled((id) => (baseP[id] < 0 && mid[id] > baseP[id] ? mid[id] : baseP[id])), worst = Math.max(0, -Math.min(...Object.values(pnl)));
    pool.push({ kind: "time_stop", name: `时间止损：到中点 ${base.mid.slice(5)} 还没走出来就平仓`, legs: [], rule: `close at ${base.mid} if not working`, cost: 0, src: "—", newMaxLoss: r2(worst), approx: true, pnl, fits: worst <= i.capUsd,
      why: "不花钱；把横盘/慢走的时间损耗截在一半" }); }
  // per losing scenario: candidates that improve it, ranked (fits cap → improvement − harm elsewhere − cost)
  const out: ScenarioHedges[] = [];
  for (const row of base.rows) {
    const giveBack = row.pnlMid > 0 && row.pnlExpiry < 0.5 * row.pnlMid;
    if (row.pnlExpiry >= 0 && !giveBack) continue;
    const score = (c: Candidate) => (c.pnl[row.id] - row.pnlExpiry) + 0.5 * Math.min(0, ...IDS.map((id) => c.pnl[id] - baseP[id])) - 0.1 * Math.max(0, c.cost);
    const picks = pool.filter((c) => c.pnl[row.id] > row.pnlExpiry + 0.5).sort((a, b) => Number(b.fits) - Number(a.fits) || score(b) - score(a)).slice(0, 3);
    out.push({ id: row.id, zh: row.zh, basePnl: row.pnlExpiry, reason: giveBack ? `中点 +$${row.pnlMid.toFixed(0)} 到期只剩 ${row.pnlExpiry >= 0 ? "+" : "−"}$${Math.abs(row.pnlExpiry).toFixed(0)}（回吐）` : `到期 −$${Math.abs(row.pnlExpiry).toFixed(0)}`, picks });
  }
  return out;
}

const sg = (x: number) => `${x >= 0 ? "+" : "−"}$${Math.abs(x).toFixed(0)}`;
export function renderHedgeMenu(m: ScenarioHedges[], base: ScenarioResult, capUsd: number): string[] {
  if (!m.length) return ["- **分情景对冲**：没有亏损/回吐的情景 → 不需要对冲"];
  const o: string[] = [`**分情景对冲 / 调整候选**（上限 $${capUsd}；现最大亏损 ${base.maxLoss == null ? "无限" : `$${base.maxLoss}`}；成本 + = 付出 / − = 收入；RH = Robinhood 报价，BS = 模型估价）`, ""];
  for (const s of m) {
    o.push(`*${s.zh}（${s.reason}）*`, "", "| # | 候选 | 成本 | 新最大亏损 | 大跌 | 慢跌 | 横盘 | 上涨 | 上限 | 为什么 |", "|---|---|---|---|---|---|---|---|---|---|");
    if (!s.picks.length) o.push("| — | 没有能改善这个情景的定义风险方案 | | | | | | | | 缩小仓位或 NO_TRADE |");
    s.picks.forEach((c, n) => o.push(`| ${n + 1} | ${c.name}${c.legs.length ? `（${c.legs.map(nm).join(", ")}）` : ""} | ${c.legs.length ? `${sg(c.cost)} ${c.src}` : "$0"} | ${c.approx ? "≈" : ""}$${c.newMaxLoss?.toFixed(0)} | ${IDS.map((id) => sg(c.pnl[id])).join(" | ")} | ${c.fits ? "✅" : "超上限"} | ${c.why} |`));
    o.push("");
  }
  o.push("- _P&L 按到期日（各情景目标价）计；≈ 为规则型（止损/时间止损），跳空可能超出；不会生成裸卖腿（FORBIDDEN）。只显示，不下单。_");
  return o;
}
/** 情景推演 table + per-scenario hedge menu (plan card section 10, `paper scenarios`) */
export function renderScenariosWithMenu(i: EngineInput, quotes: RhQuote[] = [], sym?: string, title = "情景推演"): string[] {
  const r = runScenarios(i);
  return [...renderScenarioTable(r, title), ...renderHedgeMenu(hedgeMenu(i, quotes, sym, r), r, i.capUsd), "- _完整 4 腿对冲组合（看跌对角 + 看涨价差 + 崩盘保护 put）留到第二阶段。_", ""];
}
