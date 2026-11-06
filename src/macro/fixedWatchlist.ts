/**
 * 每日简报固定栏 (knowledge/macro/fixed-watchlist-and-flows.md; docs/FIXED_WATCHLIST_BRIEF_WIRING.md): 【宏观盯盘】 + 【资金流】.
 * DISPLAY ONLY: nothing here feeds briefVerdict / NO_TRADE, alarms, sizing or plan qualification.
 *  【宏观盯盘】 fixed ETF groups, 1d % = (last − prev) / prev of the daily price series the brief already fetched.
 *  【资金流】 relative strength only (NOT ETF create/redeem flow data, no $ figures): 板块轮动 / 广度 / 风险 vs 避险 / 成交量确认
 *   → deterministic 1d vote → 偏进攻 / 偏防守 / 混乱并列 (+ one evidence sentence).
 * Pure: data in, lines out. Missing series → 数据不足, never guessed. Price Obs.v is the CLOSE (fetchDailyOnce drops volume);
 * volume confirmation needs separate OHLCV bars (yahooDaily `v`).
 */
import type { Obs } from "./fetch.ts";
import type { SeriesDef } from "./series.ts";
import { PM_SERIES } from "./premarket.ts";

export const FW_FILE = "knowledge/macro/fixed-watchlist-and-flows.md";
export const WATCH_HEAD = "## 【宏观盯盘】", FLOW_HEAD = "## 【资金流】";
export const NA = "数据不足";
export const WATCH_GROUPS: Array<{ name: string; syms: string[] }> = [
  { name: "大盘/广度", syms: ["SPY", "QQQ", "IWM", "DIA", "RSP", "VIX"] },
  { name: "利率/美元/信用", syms: ["TLT", "IEF", "SHY", "UUP", "DXY", "HYG", "LQD"] },
  { name: "商品", syms: ["CL", "BZ", "USO", "UCO", "GLD", "GLDM", "CPER"] },
  { name: "板块", syms: ["SMH", "XLK", "XLE", "XLF", "XLI", "XLB", "XLY", "XLP", "XLV", "XLU", "XLRE", "XLC", "IYT", "JETS"] },
  { name: "地区/领先", syms: ["EWY", "FXI", "KWEB", "LEN", "KRE"] },
];
/** watchlist symbol → brief series id where the brief already fetches it under another name (PM_SERIES) */
export const ALIAS: Record<string, string> = { VIX: "VIX", DXY: "DXY", CL: "WTI", BZ: "BRENT" };
export const keyOf = (sym: string) => ALIAS[sym] ?? sym;
/** DEADCAT_SERIES ids (not imported: the 死猫 module is brief-only by a static display-only test; test/fixedWatchlist.test.ts keeps them in sync) */
export const DEADCAT_IDS = ["SPY", "QQQ", "XLP", "XLV", "XLU", "RSP", "EWF"];
const have = new Set([...PM_SERIES.map((s) => s.id), ...DEADCAT_IDS]);
/** Yahoo series for watchlist symbols NOT already in PM_SERIES / DEADCAT_SERIES (id = symbol); fetched with fetchDailyOnce */
export const FW_EXTRA_SERIES: SeriesDef[] = WATCH_GROUPS.flatMap((g) => g.syms).filter((s) => !have.has(keyOf(s)))
  .map((s) => ({ id: s, provider: "yahoo", ref: s, label: s, unit: "price", frequency: "daily" }));
/** 1d spread (pp) beyond this = one side leads; inside = 持平 */
export const BAND = 0.3;
export const VOL = { days: 20, high: 1.2, low: 0.8 } as const;

export interface VolBar { t: string; c: number; v: number }
export interface FwExtras {
  /** OHLCV bars (yahooDaily) for volume confirmation, e.g. SPY / QQQ; missing → 成交量确认：数据不足 */
  volume?: Record<string, VolBar[] | undefined>;
  /** one auxiliary sentence (GEX / 0DTE put/call) ONLY if already in the brief inputs */
  aux?: string | null;
}
export type FlowLabel = "偏进攻" | "偏防守" | "混乱并列" | "数据不足";
export interface FixedWatchlist { watchLines: string[]; flowLines: string[]; label: FlowLabel; votes: Array<{ id: string; vote: 1 | 0 | -1; text: string }>; chg: Record<string, number | null> }

/** 1d % change of the last two observations; never fabricated */
export function day1(o: Obs[] | undefined): number | null {
  if (!o || o.length < 2) return null;
  const a = o[o.length - 2]!.v, b = o.at(-1)!.v;
  return Number.isFinite(a) && Number.isFinite(b) && a !== 0 ? ((b - a) / a) * 100 : null;
}
const pct = (x: number | null) => (x == null ? NA : `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`);
const avg = (xs: Array<number | null>) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const voteOf = (d: number | null): 1 | 0 | -1 | null => (d == null ? null : d > BAND ? 1 : d < -BAND ? -1 : 0);

/** last bar volume vs the previous VOL.days average (bars with v > 0 only) */
export function relVolume(bars: VolBar[] | undefined): { t: string; pct: number; ratio: number } | null {
  const b = (bars ?? []).filter((x) => Number.isFinite(x.v) && x.v > 0 && Number.isFinite(x.c));
  if (b.length < VOL.days + 2) return null;
  const last = b.at(-1)!, prev = b[b.length - 2]!, base = b.slice(-VOL.days - 1, -1);
  const a = base.reduce((s, x) => s + x.v, 0) / base.length;
  return a > 0 && prev.c ? { t: last.t.slice(0, 10), pct: ((last.c - prev.c) / prev.c) * 100, ratio: last.v / a } : null;
}

export function buildFixedWatchlist(data: Record<string, Obs[] | undefined>, extras: FwExtras = {}): FixedWatchlist {
  const chg: Record<string, number | null> = {};
  for (const s of WATCH_GROUPS.flatMap((g) => g.syms)) chg[s] = day1(data[keyOf(s)]);
  const c = (s: string) => chg[s] ?? null;
  const lastDates = WATCH_GROUPS.flatMap((g) => g.syms).map((s) => data[keyOf(s)]?.at(-1)?.t.slice(0, 10)).filter((t): t is string => !!t);
  const asOf = lastDates.length ? lastDates.sort().at(-1)! : null;
  const watchLines = [
    WATCH_HEAD,
    `_固定盯盘清单（${FW_FILE}）。日涨跌 = 最后一根日线 vs 前一根（Yahoo 日线，期货为同合约序列）${asOf ? `，最新日线 ${asOf}` : ""}；盘前看到的是上一交易日收盘。只看清单，不做个股深挖。${NA} = 未取到数据，不估算。_`, "",
    ...WATCH_GROUPS.map((g) => `- **${g.name}**：${g.syms.map((s) => `${s} ${pct(c(s))}`).join(" · ")}`), "",
  ];

  // 板块轮动
  const rot = ["SMH", "XLE", "XLF", "XLU"].filter((s) => c(s) != null).sort((a, b) => c(b)! - c(a)!);
  const smhXlu = c("SMH") != null && c("XLU") != null ? c("SMH")! - c("XLU")! : null, xlyXlp = c("XLY") != null && c("XLP") != null ? c("XLY")! - c("XLP")! : null;
  const rotText = rot.length >= 2 ? `${rot.map((s) => `${s} ${pct(c(s))}`).join(" > ")}（领涨 ${rot[0]}，领跌 ${rot.at(-1)}）` : NA;
  const yp = xlyXlp == null ? `XLY vs XLP ${NA}` : `XLY ${pct(c("XLY"))} vs XLP ${pct(c("XLP"))} → ${xlyXlp > BAND ? "可选消费强" : xlyXlp < -BAND ? "必需消费强" : "持平"}`;
  // 广度
  const rspD = c("RSP") != null && c("SPY") != null ? c("RSP")! - c("SPY")! : null, iwmD = c("IWM") != null && c("SPY") != null ? c("IWM")! - c("SPY")! : null;
  const breadth = rspD == null && iwmD == null ? null : avg([rspD, iwmD]);
  const rel = (d: number | null) => (d == null ? NA : d > BAND ? "强于 SPY" : d < -BAND ? "弱于 SPY" : "≈ SPY");
  const brText = c("SPY") == null ? NA : `SPY ${pct(c("SPY"))}；RSP ${pct(c("RSP"))}（${rel(rspD)}）· IWM ${pct(c("IWM"))}（${rel(iwmD)}）`;
  // 风险 vs 避险
  const haven = avg([c("TLT"), c("GLD")]), riskD = c("HYG") != null && haven != null ? c("HYG")! - haven : null;
  const rkText = c("HYG") == null || haven == null ? NA : `HYG ${pct(c("HYG"))} vs TLT ${pct(c("TLT"))} / GLD ${pct(c("GLD"))} → ${riskD! > BAND ? "风险资产占优" : riskD! < -BAND ? "避险资产占优" : "持平"}`;
  // 成交量确认 (OHLCV bars only)
  const vols = ["SPY", "QQQ"].map((s) => [s, relVolume(extras.volume?.[s])] as const).filter((x) => x[1] != null);
  const volText = vols.length ? vols.map(([s, r]) => {
    const kind = r!.ratio >= VOL.high ? "放量" : r!.ratio <= VOL.low ? "缩量" : "量能平常", up = r!.pct >= 0;
    const read = kind === "放量" ? (up ? "放量涨，更像真流入" : "放量跌，抛压是真的") : kind === "缩量" ? (up ? "缩量反弹，偏空头回补" : "缩量跌，抛压有限") : "量能不给额外确认";
    return `${s} ${r!.t} ${pct(r!.pct)}，成交量 ${r!.ratio.toFixed(2)}× ${VOL.days}日均量（${read}）`;
  }).join("；") : NA;

  const votes = ([
    ["SMH vs XLU", voteOf(smhXlu), smhXlu! > 0 ? "SMH 强于 XLU" : "XLU 强于 SMH"],
    ["XLY vs XLP", voteOf(xlyXlp), xlyXlp! > 0 ? "XLY 强于 XLP" : "XLP 强于 XLY"],
    ["广度", voteOf(breadth), breadth! > 0 ? "RSP/IWM 强于 SPY" : "RSP/IWM 弱于 SPY"],
    ["HYG vs TLT/GLD", voteOf(riskD), riskD! > 0 ? "HYG 强于 TLT/GLD" : "TLT/GLD 强于 HYG"],
  ] as const).filter((v) => v[1] != null).map(([id, vote, text]) => ({ id, vote: vote!, text: vote === 0 ? `${id} 持平` : text }));
  const off = votes.filter((v) => v.vote === 1).length, def = votes.filter((v) => v.vote === -1).length;
  const label: FlowLabel = votes.length < 2 ? NA : off >= def + 2 ? "偏进攻" : def >= off + 2 ? "偏防守" : "混乱并列";
  const evidence = label === NA ? `可比较的相对强弱少于 2 组（${votes.length} 组），不下结论。` : `依据（1日，±${BAND}pp 内算持平）：${votes.map((v) => v.text).join("、")}（进攻 ${off} 票 / 防守 ${def} 票）。`;
  const flowLines = [
    FLOW_HEAD,
    "_相对强弱推断资金偏向，不是 ETF 申赎净额；不给金额。只显示，不改变上面的结论。_", "",
    `- 板块轮动：${rotText}；${yp}`,
    `- 广度：${brText}`,
    `- 风险 vs 避险：${rkText}`,
    `- 成交量确认：${volText}`,
    ...(extras.aux ? [`- 辅助：${extras.aux}`] : []),
    `- **资金流：${label}** — ${evidence}`, "",
  ];
  return { watchLines, flowLines, label, votes, chg };
}
