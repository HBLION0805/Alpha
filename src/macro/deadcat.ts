/**
 * 大佬 2026-10-19「死猫反弹，还是市场见底？」(knowledge/mentor/market-calls/dead-cat-2026-10-19/) applied in the brief.
 * Two blocks, DISPLAY ONLY: nothing here feeds briefVerdict, alarms, sizing, plan qualification or the 能不能睡 label.
 *  A) 【大佬经济情景表】 (fig8): 5-day direction of WTI / DXY / 30Y / stocks → the closest of the 4 rows + match score.
 *     Stocks = SPY direction + defensives (XLP/XLV/XLU) vs growth (QQQ/SMH) 5-day spread. Small dead-bands = "flat".
 *  B) 死猫 vs 见底 checklist: WTI vs 100, KOSPI vs 5266.12, EWF (or RSP proxy), the VIX Friday-spike rhythm, NQ vs 30000/28500;
 *     plus DK's devil's-advocate "bottom" conditions (NOT the mentor's): ≥3 of 4 → 「死猫判断可能错了」.
 * Pure: data in, lines out. Missing series → n/a, never guessed.
 */
import type { Obs } from "./fetch.ts";
import type { SeriesDef } from "./series.ts";
import type { MatrixResult } from "./matrix.ts";

export const DC_FILE = "knowledge/mentor/market-calls/dead-cat-2026-10-19/article.md";
const y = (id: string, ref: string, label: string): SeriesDef => ({ id, provider: "yahoo", ref, label, unit: "price", frequency: "daily" });
/** extra series fetched for these blocks only (kept out of the premarket/matrix data so nothing else changes) */
export const DEADCAT_SERIES: SeriesDef[] = [y("SPY", "SPY", "SPY"), y("QQQ", "QQQ", "QQQ"), y("XLP", "XLP", "XLP 必需消费"), y("XLV", "XLV", "XLV 医疗"), y("XLU", "XLU", "XLU 公用事业"),
  y("RSP", "RSP", "RSP 标普等权 ETF（EWF 代理）"), y("EWF", "EWF=F", "EWF1! 标普500 等权期货")];
/** levels from the post's figures */
export const LV = { wtiResist: 100, kospiSupport: 5266.12, nqReclaim: 30000, nqSupport: 28500, nqLow: 26830, vixHigh: 20, vixLow: 17, spikeDate: "2026-10-16" } as const;
/** DK's devil's-advocate bottom conditions (not the mentor's) */
export const BOTTOM = { wtiBelow: 95, vixBelow: 17, need: 3 } as const;
/** dead-bands for "flat" (5-day changes) */
export const BAND = { oil: 1.0, dxy: 0.3, y30: 5, spy: 0.5, spread: 1.0 } as const;

export type Dir = "up" | "down" | "flat" | "unknown";
export type StockState = "broad_up" | "mixed" | "defensive_lead" | "broad_down" | "unknown";
export interface EconRow { id: "growth" | "inflation" | "stagflation" | "recession"; name: string; oil: Dir[]; dxy: Dir; y30: Dir; stocks: StockState; stocksText: string }
/** fig8, transcribed (oil for growth = ↓ or —) */
export const ECON_TABLE: EconRow[] = [
  { id: "growth", name: "经济增长", oil: ["down", "flat"], dxy: "up", y30: "up", stocks: "broad_up", stocksText: "↑" },
  { id: "inflation", name: "通货膨胀", oil: ["up"], dxy: "up", y30: "up", stocks: "mixed", stocksText: "↑有定价权的企业 / ↓其他股票" },
  { id: "stagflation", name: "滞胀", oil: ["up"], dxy: "down", y30: "down", stocks: "defensive_lead", stocksText: "↑防御股／价值股 / ↓其他股票" },
  { id: "recession", name: "经济衰退", oil: ["down"], dxy: "down", y30: "down", stocks: "broad_down", stocksText: "↓" },
];
/** DK's rough correspondence to the older 【大佬情景对照】 stages (matrix.ts), for the agree/disagree note only */
export const ECON_TO_STAGE: Record<EconRow["id"], string[]> = { growth: ["bull"], inflation: ["bear1"], stagflation: ["bear2"], recession: ["bear3"] };

const lastV = (o?: Obs[]) => (o?.length ? o.at(-1)!.v : null);
/** % change (or bp when bp=true) over k observations */
export function chgK(o: Obs[] | undefined, k: number, bp = false): number | null {
  if (!o || o.length <= k) return null;
  const a = o[o.length - 1 - k]!.v, b = o.at(-1)!.v;
  return bp ? (b - a) * 100 : ((b - a) / a) * 100;
}
export const dirOf = (x: number | null, band: number): Dir => (x == null ? "unknown" : x > band ? "up" : x < -band ? "down" : "flat");
const avg = (xs: Array<number | null>) => { const v = xs.filter((x): x is number => x != null); return v.length === xs.length && v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

export interface EconInput { wti5: number | null; dxy5: number | null; y30bp5: number | null; spy5: number | null; def5: number | null; growth5: number | null }
export function econInputs(d: Record<string, Obs[]>): EconInput {
  const c5 = (id: string) => chgK(d[id], 5);
  return { wti5: c5("WTI"), dxy5: c5("DXY"), y30bp5: chgK(d.UST30Y?.length ? d.UST30Y : d.UST30Y_FRED, 5, true), spy5: c5("SPY"),
    def5: avg([c5("XLP"), c5("XLV"), c5("XLU")]), growth5: avg([c5("QQQ"), c5("SMH")]) };
}
export function stockState(i: Pick<EconInput, "spy5" | "def5" | "growth5">): StockState {
  if (i.spy5 == null || i.def5 == null || i.growth5 == null) return "unknown";
  const spy = dirOf(i.spy5, BAND.spy), spread = i.def5 - i.growth5;
  if (spread > BAND.spread && i.def5 > 0 && spy !== "up") return "defensive_lead";
  if (spy === "up" && spread <= BAND.spread) return "broad_up";
  if (spy === "down" && i.def5 < 0) return "broad_down";
  return "mixed";
}
export interface EconResult { input: EconInput; dims: { oil: Dir; dxy: Dir; y30: Dir; stocks: StockState }; rows: Array<{ row: EconRow; score: number; match: string[]; mismatch: string[] }>; best: EconRow[]; score: number; known: number }
export function matchEcon(i: EconInput): EconResult {
  const dims = { oil: dirOf(i.wti5, BAND.oil), dxy: dirOf(i.dxy5, BAND.dxy), y30: dirOf(i.y30bp5, BAND.y30), stocks: stockState(i) };
  const known = [dims.oil, dims.dxy, dims.y30, dims.stocks].filter((x) => x !== "unknown").length;
  const rows = ECON_TABLE.map((row) => {
    const match: string[] = [], mismatch: string[] = [];
    const chk = (name: string, v: string, ok: boolean) => { if (v === "unknown") return; (ok ? match : mismatch).push(name); };
    chk("原油", dims.oil, row.oil.includes(dims.oil)); chk("美元", dims.dxy, dims.dxy === row.dxy); chk("30Y", dims.y30, dims.y30 === row.y30); chk("股票", dims.stocks, dims.stocks === row.stocks);
    return { row, score: match.length, match, mismatch };
  });
  const score = Math.max(...rows.map((r) => r.score));
  return { input: i, dims, rows, best: known ? rows.filter((r) => r.score === score).map((r) => r.row) : [], score, known };
}

const ARROW: Record<string, string> = { up: "↑", down: "↓", flat: "—", unknown: "?" };
const STOCK_ZH: Record<StockState, string> = { broad_up: "普涨", mixed: "分化（防御不领先）", defensive_lead: "防御领涨、其他跌", broad_down: "普跌", unknown: "?" };
const pct = (x: number | null, d = 2) => (x == null ? "n/a" : `${x > 0 ? "+" : ""}${x.toFixed(d)}%`);
const bp = (x: number | null) => (x == null ? "n/a" : `${x > 0 ? "+" : ""}${x.toFixed(0)}bp`);
export function renderEcon(r: EconResult, older?: MatrixResult | null): string[] {
  const i = r.input;
  if (r.known === 0) return ["- **【大佬经济情景表】** 数据不可用（n/a）", `  - _大佬原表（只显示，不改结论）：${DC_FILE.replace("article.md", "assets/fig8.png")}_`];
  const head = r.known === 0 ? "- **【大佬经济情景表】** 数据不可用（n/a）" :
    `- **【大佬经济情景表】**（图八，5 日方向）最接近：**${r.best.map((b) => b.name).join(" / ")}**（匹配 ${r.score}/4${r.known < 4 ? `，已知 ${r.known}/4` : ""}）`;
  const L = [head,
    `  - 当前：原油 ${ARROW[r.dims.oil]} WTI ${pct(i.wti5, 1)} · 美元 ${ARROW[r.dims.dxy]} DXY ${pct(i.dxy5)} · 30Y ${ARROW[r.dims.y30]} ${bp(i.y30bp5)} · 股票 ${STOCK_ZH[r.dims.stocks]}（SPY ${pct(i.spy5, 1)}；防御 XLP/XLV/XLU ${pct(i.def5, 1)} vs QQQ/SMH ${pct(i.growth5, 1)}）`,
    ...r.rows.filter((x) => r.best.includes(x.row)).map((x) => `  - ${x.row.name}（表：原油 ${x.row.oil.map((d) => ARROW[d]).join("/")} · 美元 ${ARROW[x.row.dxy]} · 30Y ${ARROW[x.row.y30]} · 股票 ${x.row.stocksText}）：吻合 ${x.match.join("、") || "—"}；不吻合 ${x.mismatch.join("、") || "—"}`),
    `  - 其他：${r.rows.filter((x) => !r.best.includes(x.row)).map((x) => `${x.row.name} ${x.score}/4`).join(" · ")}`,
    `  - 「持平」阈值：原油 ±${BAND.oil}% · DXY ±${BAND.dxy}% · 30Y ±${BAND.y30}bp · SPY ±${BAND.spy}% · 防御−科技 ±${BAND.spread}pp`,
  ];
  if (r.score < 3 && r.known) L.push("  - 匹配不足 3/4：没有清楚对应的一行，不据此下结论");
  if (older && r.best.length && older.best.length) {
    const agree = r.best.some((b) => older.best.some((s) => ECON_TO_STAGE[b.id].includes(s.id)));
    L.push(`  - 对照 【大佬情景对照】（${older.best.map((s) => s.name).join(" / ")}，${older.matches}/4）：${agree ? "✅ 两张表方向一致" : "⚠️ 两张表不一致 → 方向不清，降低信心"}（对应关系是 DK 的：增长≈牛市、通胀≈熊市一、滞胀≈熊市二、衰退≈熊市三）`);
  }
  L.push(`  - _大佬原表（只显示，不改结论）：${DC_FILE.replace("article.md", "assets/fig8.png")}_`);
  return L;
}

// ---------- B) 死猫 vs 见底 checklist ----------
export type St = "dead_cat" | "bottom" | "neutral" | "na";
export interface CheckItem { id: string; label: string; value: string; status: St; note: string; proxy?: string }
export interface CheckResult { items: CheckItem[]; bottom: Array<{ id: string; label: string; met: boolean | null; value: string }>; met: number; known: number; wrongFlag: boolean }
const ICON: Record<St, string> = { dead_cat: "🔴", bottom: "🟢", neutral: "🟡", na: "➖" };
const f2 = (x: number | null, d = 2) => (x == null ? "n/a" : x.toFixed(d));

export function deadCatChecklist(d: Record<string, Obs[]>): CheckResult {
  const items: CheckItem[] = [];
  // 1) WTI vs 100
  const wti = lastV(d.WTI), w1 = chgK(d.WTI, 1);
  items.push(wti == null ? { id: "wti", label: "原油 WTI vs 100", value: "n/a", status: "na", note: "无数据" }
    : wti >= LV.wtiResist ? { id: "wti", label: "原油 WTI vs 100", value: `${f2(wti)}（1日 ${pct(w1)}）`, status: "dead_cat", note: "重新涨破 100 → 纳指很可能还得继续跌" }
    : w1 != null && w1 < 0 ? { id: "wti", label: "原油 WTI vs 100", value: `${f2(wti)}（1日 ${pct(w1)}）`, status: "bottom", note: "在 100 下方继续回落 → 抛售短期可能结束" }
    : { id: "wti", label: "原油 WTI vs 100", value: `${f2(wti)}（1日 ${pct(w1)}）`, status: "neutral", note: "在 100 下方，但在回升 → 油价重新上涨，市场可能又要卖下来" });
  // 2) KOSPI vs 5266.12 + bounce strength (EWY = proxy without the level)
  const kos = lastV(d.KOSPI), k1 = chgK(d.KOSPI, 1), ewy1 = chgK(d.EWY, 1);
  if (kos != null) {
    const strong = k1 != null && k1 >= 1.5, below = kos < LV.kospiSupport;
    items.push({ id: "kospi", label: "KOSPI vs 5266.12 支撑", value: `${f2(kos)}（1日 ${pct(k1)}；距支撑 ${pct(((kos - LV.kospiSupport) / LV.kospiSupport) * 100, 1)}）`,
      status: below ? "dead_cat" : strong ? "bottom" : "neutral", note: below ? "跌破头肩顶支撑 → 韩国再拉稀，纳指很可能跟着拉" : strong ? "守住支撑，反弹有力度（≥ +1.5%）" : `守住支撑，但反弹偏弱（< +1.5%；大佬：+0.6% 「没什么说服力」）` });
  } else if (ewy1 != null) items.push({ id: "kospi", label: "KOSPI vs 5266.12 支撑", value: `EWY 1日 ${pct(ewy1)}`, status: ewy1 >= 1.5 ? "bottom" : ewy1 < 0 ? "dead_cat" : "neutral", note: "KOSPI 不可用，只看 EWY 当日方向，无法对照 5266 支撑", proxy: "EWY 韩国 ETF 替代 ^KS11" });
  else items.push({ id: "kospi", label: "KOSPI vs 5266.12 支撑", value: "n/a", status: "na", note: "KOSPI 和 EWY 都无数据" });
  // 3) EWF (equal weight) direction — rotation-reversal tell; RSP proxy when EWF=F has no history
  const ewfOk = (d.EWF?.length ?? 0) >= 2, eq = ewfOk ? d.EWF : d.RSP, e1 = chgK(eq, 1);
  items.push(e1 == null ? { id: "ewf", label: "等权 EWF 方向（轮动是否反转）", value: "n/a", status: "na", note: "EWF 和 RSP 都无数据" }
    : { id: "ewf", label: "等权 EWF 方向（轮动是否反转）", value: `${ewfOk ? "EWF1!" : "RSP"} ${f2(lastV(eq))}（1日 ${pct(e1)}）`, status: e1 < -0.2 ? "dead_cat" : e1 > 0.2 ? "bottom" : "neutral",
      note: e1 < -0.2 ? "等权在跌 → 这轮轮动可能要结束，开始往回转" : e1 > 0.2 ? "等权在涨 → 轮动还在" : "持平（±0.2%）", ...(ewfOk ? {} : { proxy: "RSP 标普等权 ETF 替代 EWF1!；Yahoo EWF=F 没有历史日线" }) });
  // 4) VIX rhythm: Friday spike 10/16 → Monday cool-down → re-spike?
  const vix = d.VIX ?? [], vLast = lastV(vix), sIdx = vix.findIndex((o) => o.t.slice(0, 10) === LV.spikeDate);
  if (vLast == null || sIdx < 0) items.push({ id: "vix", label: "VIX 节奏（10/16 周五飙升）", value: vLast == null ? "n/a" : f2(vLast), status: "na", note: vLast == null ? "无数据" : `没有 ${LV.spikeDate} 的收盘` });
  else {
    const spike = vix[sIdx]!.v, days = vix.length - 1 - sIdx, after = vix.slice(sIdx + 1), cooled = after.some((o) => o.v < spike);
    const re = days > 0 && (vLast > spike || vLast > LV.vixHigh);
    items.push({ id: "vix", label: "VIX 节奏（10/16 周五飙升）", value: `${f2(vLast)}（10/16 收 ${f2(spike)}；飙升后第 ${days} 个交易日）`,
      status: re ? "dead_cat" : vLast < LV.vixLow ? "bottom" : "neutral",
      note: days === 0 ? "今天就是飙升日" : re ? `⚠️ 再次飙升（高于 10/16 收盘或 > ${LV.vixHigh}）→ 和去年一样的节奏 = 死猫反弹` : cooled ? `降温中（去年此后又往上冲了一波）；再飙升线：> ${f2(spike)} 或 > ${LV.vixHigh}` : "尚未降温" });
  }
  // 5) NQ vs 30000 / 28500 (QQQ-equivalent when NQ futures are unavailable)
  const nq = lastV(d.NQ), ndx = lastV(d.NDX), qqq = lastV(d.QQQ);
  const lvl = nq != null ? { v: nq, r: 1, src: "NQ" } : qqq != null && ndx != null ? { v: qqq, r: qqq / ndx, src: "QQQ" } : null;
  if (!lvl) items.push({ id: "nq", label: "纳指 NQ vs 30000 / 28500", value: "n/a", status: "na", note: "NQ 和 QQQ/NDX 都无数据" });
  else {
    const hi = LV.nqReclaim * lvl.r, lo = LV.nqSupport * lvl.r;
    items.push({ id: "nq", label: "纳指 NQ vs 30000 / 28500", value: `${lvl.src} ${f2(lvl.v)}${lvl.r !== 1 ? `（等效 30000 ≈ ${f2(hi)} / 28500 ≈ ${f2(lo)}）` : ""}`,
      status: lvl.v >= hi ? "bottom" : lvl.v < lo ? "dead_cat" : "neutral",
      note: lvl.v >= hi ? "收复 30000" : lvl.v < lo ? `跌破 28500，下一个价位 ${LV.nqLow}` : "在 28500 和 30000 之间：反弹还没收复 30000", ...(lvl.r !== 1 ? { proxy: "QQQ 等效价位（按 QQQ/NDX 比例换算）替代 NQ 期货" } : {}) });
  }
  // DK's devil's-advocate bottom conditions
  const nqLvl = lvl ? lvl.v >= LV.nqReclaim * lvl.r : null;
  const bottom = [
    { id: "wti", label: `WTI < ${BOTTOM.wtiBelow}`, met: wti == null ? null : wti < BOTTOM.wtiBelow, value: f2(wti) },
    { id: "vix", label: `VIX < ${BOTTOM.vixBelow}`, met: vLast == null ? null : vLast < BOTTOM.vixBelow, value: f2(vLast) },
    { id: "kospi", label: "KOSPI 守住 5266", met: kos == null ? null : kos >= LV.kospiSupport, value: f2(kos) },
    { id: "nq", label: "NQ 收复 30000", met: nqLvl, value: lvl ? `${lvl.src} ${f2(lvl.v)}` : "n/a" },
  ];
  const met = bottom.filter((b) => b.met === true).length, known = bottom.filter((b) => b.met != null).length;
  return { items, bottom, met, known, wrongFlag: met >= BOTTOM.need };
}

export function renderChecklist(c: CheckResult): string[] {
  const dc = c.items.filter((x) => x.status === "dead_cat").length, bt = c.items.filter((x) => x.status === "bottom").length;
  return ["- **死猫 vs 见底清单**（大佬 10/19 的看点；🔴 偏死猫 · 🟢 偏见底 · 🟡 中性 · ➖ 无数据）",
    ...c.items.map((x) => `  - ${ICON[x.status]} ${x.label}：${x.value} — ${x.note}${x.proxy ? `（代理：${x.proxy}）` : ""}`),
    `  - 合计：🔴 ${dc} · 🟢 ${bt} · 🟡 ${c.items.filter((x) => x.status === "neutral").length} · ➖ ${c.items.filter((x) => x.status === "na").length}`,
    `  - 【DK 唱反调】见底条件（不是大佬的）：${c.bottom.map((b) => `${b.met == null ? "➖" : b.met ? "✅" : "❌"} ${b.label}（${b.value}）`).join(" · ")} → ${c.met}/4${c.known < 4 ? `（已知 ${c.known}）` : ""}`,
    ...(c.wrongFlag ? ["  - ⚠️ **「死猫判断可能错了」**：DK 的 4 个见底条件满足 ≥3 个"] : c.known === 0 ? ["  - 见底条件：无数据，不判断"] : [`  - 见底条件满足 ${c.met}/4（< ${BOTTOM.need}）→ 死猫判断暂未被推翻`]),
  ];
}

export function renderDeadCat(d: Record<string, Obs[]>, older?: MatrixResult | null): { lines: string[]; econ: EconResult; check: CheckResult } {
  const econ = matchEcon(econInputs(d)), check = deadCatChecklist(d);
  return { econ, check, lines: ["## 1.3 大佬：死猫反弹，还是市场见底？（10/19 帖 · 只显示）",
    "_大佬 2026-10-19 的帖子，原文在 knowledge/mentor/market-calls/dead-cat-2026-10-19/。只显示：不改结论、提醒、仓位，也不改「能不能睡」。_", "",
    ...renderEcon(econ, older), ...renderChecklist(check), ""] };
}
/** brief-latest.json `deadCat` — read by plan cards (WTI for the defensive-stock reminder); informational only */
export function deadCatJson(r: { econ: EconResult; check: CheckResult }, d: Record<string, Obs[]>) {
  return { econ: r.econ.best.map((b) => b.id), score: r.econ.score, known: r.econ.known, wti: lastV(d.WTI), bottomMet: r.check.met, deadCatWrong: r.check.wrongFlag, items: Object.fromEntries(r.check.items.map((x) => [x.id, x.status])) };
}
