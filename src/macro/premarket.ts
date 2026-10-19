/**
 * Premarket routine. Part 1 【大佬流程】 follows knowledge/mentor/discipline/premarket-routine.md (video transcription, near-verbatim; source `mentor-premarket`).
 * Part 2 【DK 补充】 holds DK's own additions and is labeled as such. Pure functions: data in, markdown and alarms out. The CLI does the fetching.
 * Macro first: technicals are for timing only, never direction (better-macro-trader.md #9).
 */
import { eventUtcMs } from "./risk.ts";
import { buildOil, type OilAlarm } from "./oil.ts";
import { buildOilVix, type OilVixResult } from "./oilvix.ts";
import type { Obs } from "./fetch.ts";
import type { SeriesDef } from "./series.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import type { Earnings } from "../options/events.ts";

const y = (id: string, ref: string, label: string, unit: SeriesDef["unit"] = "price"): SeriesDef => ({ id, provider: "yahoo", ref, label, unit, frequency: "daily" });
const f = (id: string, ref: string, label: string): SeriesDef => ({ id, provider: "fred", ref, label, unit: "pct", frequency: "daily" });
export const PM_SERIES: SeriesDef[] = [
  f("UST2Y", "DGS2", "2Y 美债收益率 (FRED, T-1)"), y("UST10Y", "^TNX", "10Y 美债收益率", "pct"), y("UST30Y", "^TYX", "30Y 美债收益率", "pct"),
  f("UST10Y_FRED", "DGS10", "10Y (FRED)"), f("UST30Y_FRED", "DGS30", "30Y (FRED)"),
  y("HYG", "HYG", "HYG 高收益债 ETF"), y("SPX", "^GSPC", "标普500"), y("NDX", "^NDX", "纳斯达克100"), y("RUT", "^RUT", "罗素2000"),
  y("ES", "ES=F", "ES 标普期货"), y("NQ", "NQ=F", "NQ 纳指期货"), y("RTY", "RTY=F", "RTY 罗素期货"),
  y("KOSPI", "^KS11", "KOSPI"), y("EWY", "EWY", "EWY 韩国 ETF"), y("SMH", "SMH", "SMH 半导体 ETF"), y("SOX", "^SOX", "费城半导体 SOX"),
  y("DXY", "DX-Y.NYB", "美元指数 DXY"), y("USDCAD", "CAD=X", "USDCAD"), y("USDJPY", "JPY=X", "USDJPY"),
  // DK 补充
  // 【用户要求】原油 (src/macro/oil.ts)
  y("BRENT", "BZ=F", "Brent 原油"), y("RBOB", "RB=F", "RBOB 汽油"), y("XLE", "XLE", "XLE 能源股"), y("COPPER", "HG=F", "铜 HG（原油驱动判断用）"),
  y("VIX", "^VIX", "VIX"), y("VIX3M", "^VIX3M", "VIX3M"), y("WTI", "CL=F", "WTI 原油"), y("GOLD", "GC=F", "黄金"),
  { id: "BTC", provider: "yahoo", ref: "BTC-USD", label: "比特币", unit: "price", frequency: "daily" },
  f("EFFR", "DFF", "有效联邦基金利率"), f("REAL10Y", "DFII10", "10Y 实际利率 (TIPS)"),
];
const YIELD = new Set(["UST2Y", "UST10Y", "UST30Y", "UST10Y_FRED", "UST30Y_FRED", "EFFR", "REAL10Y"]);

export interface Alarm { kind: "CARRY_UNWIND" | "HYG_DIVERGENCE" | "UST10Y_SPIKE" | "VIX_BACKWARDATION" | OilAlarm["kind"]; level: "ALARM" | "WARNING"; title: string; detail: string; by: "mentor" | "dk" | "user"; score?: number }
export interface PremarketInput { now: Date; data: Record<string, Obs[]>; failed?: Record<string, string>; calendar?: CalendarEvent[]; earnings?: Earnings[] | null; headlines?: string[]; regimeLabel?: string | null; volumeLines?: string[] | null; fedLines?: string[] | null }
export interface PremarketResult { md: string; alarms: Alarm[]; noTrade: string[]; mentorLines: string[]; dkLines: string[]; oilLines: string[]; bondLines: number;
  /** mentor premarket video (oilvix.ts): oil speed / driver heuristic / VIX-vs-index confirmation — flag only */ oilVix: OilVixResult }

const last = (o?: Obs[]) => (o?.length ? o.at(-1)!.v : null);
/** change over k observations: bp for yields, % otherwise */
export function chg(id: string, o: Obs[] | undefined, k: number): number | null {
  if (!o || o.length <= k) return null;
  const a = o[o.length - 1 - k]!.v, b = o.at(-1)!.v;
  return YIELD.has(id) ? (b - a) * 100 : ((b - a) / a) * 100;
}
const nearHigh = (o: Obs[] | undefined, pct = 1, n = 20) => { if (!o || o.length < n) return null; const hi = Math.max(...o.slice(-n).map((x) => x.v)); return o.at(-1)!.v >= hi * (1 - pct / 100); };
const fmt = (x: number | null, unit: "bp" | "%", d = 2) => (x == null ? "n/a" : `${x > 0 ? "+" : ""}${x.toFixed(unit === "bp" ? 1 : d)}${unit}`);

export const BY = { mentor: "大佬流程", dk: "DK 补充", user: "用户要求" } as const;
export const OIL_HEAD = ["## 【用户要求】原油", "_用户本人的要求（2026-10-15）：原油是核心盘前指标。不是大佬流程，也不是 DK 补充。_"];
export function buildPremarket(inp: PremarketInput): PremarketResult {
  const D = inp.data; const alarms: Alarm[] = []; const M: string[] = []; const K: string[] = []; const noTrade: string[] = [];
  const day = inp.now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const c = (id: string, k = 1) => chg(id, D[id], k);
  const v = (id: string) => last(D[id]);

  // ── 大佬流程 ① 国债 ──
  M.push("### ① 美国国债 2Y / 10Y / 30Y", "> 很多时候股票市场的答案其实藏在债券市场里。");
  for (const id of ["UST2Y", "UST10Y", "UST30Y"]) {
    const alt = id === "UST10Y" ? "UST10Y_FRED" : id === "UST30Y" ? "UST30Y_FRED" : null;
    const use = D[id]?.length ? id : alt && D[alt]?.length ? alt : id;
    M.push(`- ${id.replace("UST", "")}: ${v(use)?.toFixed(3) ?? "n/a"}% · 1日 ${fmt(c(use), "bp")} · 5日 ${fmt(c(use, 5), "bp")}${use !== id ? "（Yahoo 失败，用 FRED T-1）" : ""}`);
  }
  const t1 = c("UST10Y") ?? c("UST10Y_FRED"), t5 = c("UST10Y", 5) ?? c("UST10Y_FRED", 5);
  if ((t1 != null && t1 >= 10) || (t5 != null && t5 >= 25)) {
    alarms.push({ kind: "UST10Y_SPIKE", level: "WARNING", title: `10Y 快速上冲 1日 ${fmt(t1, "bp")} / 5日 ${fmt(t5, "bp")}`, detail: "十年期是不是突然间上去了？高风险资产（科技、crypto）可能被抽走资金", by: "mentor" });
    M.push(`- ⚠️ **10Y 快速上冲**（1日 ≥ +10bp 或 5日 ≥ +25bp）→ 先看债市，再看个股`);
  }
  // ② HYG 信用确认
  const bondLines = M.length;
  M.push("", "### ② HYG 信用确认", "> 信用市场到底相不相信股票市场正在讲的故事。");
  const hyg5 = c("HYG", 5), spxHigh = nearHigh(D.SPX);
  M.push(`- HYG ${v("HYG")?.toFixed(2) ?? "n/a"} · 1日 ${fmt(c("HYG"), "%")} · 5日 ${fmt(hyg5, "%")} · 标普${spxHigh ? "接近 20 日新高" : spxHigh === false ? "未在 20 日高位" : "n/a"}`);
  if (spxHigh && hyg5 != null && hyg5 <= -0.5) {
    alarms.push({ kind: "HYG_DIVERGENCE", level: "WARNING", title: `HYG 背离：标普近 20 日高位但 HYG 5日 ${fmt(hyg5, "%")}`, detail: "股票创高、信用走弱：债市没那么放心", by: "mentor" });
    M.push("- ⚠️ **WARNING：股票接近新高、HYG 走弱 → 信用不确认**");
  } else if (hyg5 != null) M.push(`- 信用${hyg5 >= 0 ? "确认风险偏好" : "略弱，未构成背离"}`);
  // ③ 指数广度
  M.push("", "### ③ 指数广度 SPX / NDX / RUT");
  M.push(`- 1日: SPX ${fmt(c("SPX"), "%")} · NDX ${fmt(c("NDX"), "%")} · RUT ${fmt(c("RUT"), "%")}；5日: SPX ${fmt(c("SPX", 5), "%")} · NDX ${fmt(c("NDX", 5), "%")} · RUT ${fmt(c("RUT", 5), "%")}`);
  const narrow = nearHigh(D.SPX) && nearHigh(D.NDX) && (nearHigh(D.RUT, 3) === false || ((c("RUT", 5) ?? 0) < (c("SPX", 5) ?? 0) - 2));
  M.push(narrow ? "- ⚠️ **窄幅上涨**：标普/纳指在高位，罗素明显落后 → 上涨到底有多广？" : "- 广度：未见 RUT 明显掉队（或指数不在高位）");
  // ④ 期货焦虑度
  M.push("", "### ④ 盘前期货 ES / NQ / RTY（焦虑度）", "> 期货更加在告诉我，市场到底有多焦虑。");
  const fut = ["ES", "NQ", "RTY"].map((id) => ({ id, x: c(id) }));
  M.push(`- ${fut.map((x) => `${x.id} ${fmt(x.x, "%")}`).join(" · ")}`);
  const maxAbs = Math.max(0, ...fut.map((x) => Math.abs(x.x ?? 0)));
  const up = fut.every((x) => (x.x ?? 0) > 0);
  if (maxAbs >= 1) {
    M.push(`- 🔥 **大幅${up ? "高开 → FOMO" : "低开 → 恐慌"}**（|期货| ≥ 1%）`);
    M.push(`- 开盘策略：${up ? "有盈利的仓位考虑止盈；想卖 call 只能在有限风险结构里（例如把 long call 改成价差），**绝不裸卖**" : "不抢反弹；先等开盘 30 分钟后的确认；新仓只用有限风险结构"}`);
  } else M.push(`- 期货${maxAbs >= 0.5 ? "有一定情绪（≥0.5%）" : "平静"}`);
  // ⑤ 韩国半导体温度计
  M.push("", "### ⑤ KOSPI / EWY vs 美国半导体（SMH / SOX）", "> 韩国可以给我一个美国开盘之前的半导体温度计。");
  const kr = [c("KOSPI"), c("EWY")].filter((x): x is number => x != null), us = [c("SMH"), c("SOX")].filter((x): x is number => x != null);
  const krA = kr.length ? kr.reduce((a, b) => a + b) / kr.length : null, usA = us.length ? us.reduce((a, b) => a + b) / us.length : null;
  M.push(`- KOSPI ${fmt(c("KOSPI"), "%")} · EWY ${fmt(c("EWY"), "%")} vs SMH ${fmt(c("SMH"), "%")} · SOX ${fmt(c("SOX"), "%")} · NQ ${fmt(c("NQ"), "%")}`);
  if (krA != null && usA != null) M.push(Math.sign(krA) !== Math.sign(usA) && Math.abs(krA - usA) >= 1.5 ? `- ⚠️ **背离**：韩国 ${fmt(krA, "%")} vs 美国半导体 ${fmt(usA, "%")} → 半导体链风险偏好不一致` : krA > 0 && usA > 0 ? "- 韩国与美国半导体同向走强 → 产业链风险偏好一致" : krA < 0 && usA < 0 ? "- 韩国与美国半导体同向走弱" : "- 无明显背离");
  M.push("- 注：SOX 期货没有免费数据，用 SMH / ^SOX 现货收盘代替");
  // ⑥ 美元
  M.push("", "### ⑥ 美元 DXY / USDCAD / USDJPY", "> 美元为什么在动？其他资产有没有确认？");
  const dxy1 = c("DXY");
  const conf = dxy1 == null ? [] : [["黄金", -(c("GOLD") ?? 0)], ["BTC", -(c("BTC") ?? 0)], ["2Y", (c("UST2Y") ?? 0) / 10], ["USDCAD", c("USDCAD") ?? 0]].filter(([, x]) => Math.sign(x as number) === Math.sign(dxy1) && Math.abs(x as number) > 0.05).map(([n]) => n);
  M.push(`- DXY ${v("DXY")?.toFixed(2) ?? "n/a"} · 1日 ${fmt(dxy1, "%")} · 5日 ${fmt(c("DXY", 5), "%")} · 跨资产确认: ${dxy1 == null ? "n/a" : conf.length >= 2 ? `✅ ${conf.join("、")}` : `❌ 仅 ${conf.join("、") || "无"}（不机械解读）`}`);
  const cad1 = c("USDCAD"), oil1 = c("WTI");
  M.push(`- USDCAD ${v("USDCAD")?.toFixed(4) ?? "n/a"} · 1日 ${fmt(cad1, "%")} · WTI ${fmt(oil1, "%")} → ${cad1 == null || oil1 == null ? "n/a" : Math.sign(cad1) === -Math.sign(oil1) ? "CAD 与油价一致（油涨 CAD 强 / 油跌 CAD 弱）" : "CAD 与油价不一致：看其他驱动（利差、风险偏好）"}`);
  const jpy1 = c("USDJPY"), jpy5 = c("USDJPY", 5);
  M.push(`- USDJPY ${v("USDJPY")?.toFixed(2) ?? "n/a"} · 1日 ${fmt(jpy1, "%")} · 5日 ${fmt(jpy5, "%")}`);
  if ((jpy1 != null && jpy1 <= -1) || (jpy5 != null && jpy5 <= -2)) {
    alarms.push({ kind: "CARRY_UNWIND", level: "ALARM", title: `CARRY UNWIND 警报：USDJPY 1日 ${fmt(jpy1, "%")} / 5日 ${fmt(jpy5, "%")}`, detail: "日元快速升值，套息交易可能正在解除 → 股票、crypto、高风险资产可能受冲击", by: "mentor" });
    M.push("- 🚨 **CARRY UNWIND 警报**（日元 1日升 ≥1% 或 5日 ≥2%）");
  }

  // ── DK 补充 ──
  const vix = v("VIX"), v3 = v("VIX3M"), ratio = vix != null && v3 ? vix / v3 : null;
  K.push("### VIX 与期限结构", `- VIX ${vix?.toFixed(2) ?? "n/a"} · VIX3M ${v3?.toFixed(2) ?? "n/a"} · VIX/VIX3M ${ratio?.toFixed(3) ?? "n/a"} → ${ratio == null ? "n/a" : ratio >= 1 ? "🚨 **倒挂（backwardation）= 压力**" : ratio >= 0.95 ? "接近倒挂" : "正常升水（contango）"}`);
  // mentor premarket video (原油与 VIX): VIX trend vs index trend — flag only
  const ov = buildOilVix(D);
  K.push("", "### VIX 分档（用户分享的信息图 · 只标记）", ...ov.lines.regime);
  K.push("", "### VIX 与指数是否互相确认（导师盘前视频 · 只标记）", ...ov.lines.vix);
  if (ratio != null && ratio >= 1) alarms.push({ kind: "VIX_BACKWARDATION", level: "ALARM", title: `VIX 期限结构倒挂 VIX/VIX3M ${ratio.toFixed(3)}`, detail: "近端恐慌高于远端：市场压力", by: "dk" });
  const todays = (inp.calendar ?? []).filter((e) => e.date === day).sort((a, b) => a.timeEt.localeCompare(b.timeEt));
  K.push("", "### 今日经济日历（ET）", ...(todays.length ? todays.map((e) => `- ${e.timeEt} ${e.title}${e.tier === 2 ? "（次要）" : ""}${eventUtcMs(e) <= inp.now.getTime() ? "（已公布）" : e.timeEt < "09:30" ? " **（盘前）**" : ""}`) : ["- 今日无已登记的重要数据"]));
  K.push("", "### 美联储官员讲话（未来 14 天，ET）", ...(inp.fedLines ?? ["- 不可用（未获取 Fed 官方日历）"]));
  // only releases still ahead: an evening run must not warn about this morning's 08:30 print
  const pre = todays.filter((e) => e.tier !== 2 && e.timeEt < "09:30" && eventUtcMs(e) > inp.now.getTime() && ["CPI", "NFP", "PCE", "PPI", "FOMC", "GDP"].some((k) => e.kind.includes(k)));
  if (pre.length) noTrade.push(`盘前重大数据 ${pre.map((e) => `${e.kind} ${e.timeEt}`).join("、")}：数据公布前不新开仓`);
  if (todays.some((e) => e.kind === "FOMC" && eventUtcMs(e) > inp.now.getTime())) noTrade.push("今日 FOMC：决议前不新开方向仓");
  K.push("", "### 财报（今日盘前 / 盘后）");
  if (inp.earnings == null) K.push("- 无缓存的 Robinhood 财报数据（data/in/earnings.json），跳过");
  else { const e = inp.earnings.filter((x) => x.date === day); K.push(...(e.length ? e.map((x) => `- ${x.symbol} ${x.timing ?? ""}`) : ["- 今日无"])); }
  K.push("", "### 隔夜：黄金 / BTC（原油见【用户要求】原油）", `- 黄金 ${v("GOLD")?.toFixed(1) ?? "n/a"} (${fmt(c("GOLD"), "%")}) · BTC ${v("BTC")?.toFixed(0) ?? "n/a"} (${fmt(c("BTC"), "%")})`);
  const two = v("UST2Y"), ff = v("EFFR"), spread = two != null && ff != null ? (two - ff) * 100 : null;
  K.push("", "### 利率预期代理（2Y − 联邦基金，类 FedWatch）", `- 2Y ${two?.toFixed(2) ?? "n/a"}% − EFFR ${ff?.toFixed(2) ?? "n/a"}% = ${spread == null ? "n/a" : `${spread.toFixed(0)}bp → ${spread <= -25 ? "市场定价降息" : spread >= 25 ? "市场定价加息" : "大致按兵不动"}`}（粗略代理，非 CME FedWatch）`);
  K.push("", "### 实际利率", `- 10Y TIPS ${v("REAL10Y")?.toFixed(2) ?? "n/a"}% · 5日 ${fmt(c("REAL10Y", 5), "bp")}`);
  K.push("", "### 前一交易日成交量异常（src/macro/volume.ts · 成交量仅用于确认/排查，不单独下单）", ...(inp.volumeLines == null ? ["- 无最新 volume 报告（npm run volume）"] : inp.volumeLines.length ? inp.volumeLines : ["- 无异常"]));
  K.push("", "### 隔夜新闻（alert store）", ...((inp.headlines ?? []).length ? inp.headlines!.slice(0, 6).map((h) => `- ${h}`) : ["- 无"]));

  // 【用户要求】原油 — right after the bonds; its alarms feed the alert flow
  const oil = buildOil(D, { now: inp.now, headlines: inp.headlines, calendar: inp.calendar });
  alarms.push(...oil.alarms);
  const oilLines = [...oil.lines, "", "**价格 · 速度 · 原因**（导师盘前视频；驱动判断为启发式，规则见 docs/OIL_VIX.md）", ...ov.lines.oil];
  // synthesis
  if (alarms.some((a) => a.level === "ALARM")) noTrade.push(`警报未解除：${alarms.filter((a) => a.level === "ALARM").map((a) => a.kind).join("、")}`);
  if (maxAbs >= 1.5) noTrade.push("期货跳空 ≥1.5%：开盘不追，等确认");
  const risks = alarms.map((a) => a.title);
  const syn = `宏观状态：${inp.regimeLabel ?? "（无 macro-latest，未判定）"}。关键风险：${risks.length ? risks.join("；") : "暂无警报"}${narrow ? "；上涨偏窄" : ""}。改变看法的条件：10Y 回落且 HYG 收复、RUT 跟上、USDJPY 企稳、VIX 回到升水；反之任一恶化都要降低敞口。NO_TRADE 条件：${noTrade.length ? noTrade.join("；") : "无硬性 NO_TRADE，但不交易永远是合法结果"}。方向由宏观决定，技术面（K线/FIB）只用于择时。`;
  const failed = Object.entries(inp.failed ?? {});
  const md = [
    `# 盘前流程 Premarket — ${day}（${inp.now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false })} ET）`, "",
    "_数据：Yahoo (yahoo-finance2) / FRED（免费，可能有延迟；FRED 为 T-1）。不是交易建议。_", "",
    "## 【大佬流程】", "_来源：knowledge/mentor/discipline/premarket-routine.md（视频转写，近似原文）_", "", ...M.slice(0, bondLines), "",
    ...OIL_HEAD, "", ...oilLines, "",
    "## 【大佬流程】（续）", "", ...M.slice(bondLines), "",
    "---", "", "## 【DK 补充】", "_以下为 DK 的补充，不是大佬原流程。_", "", ...K, "",
    "## 综合判断", "", syn, "",
    ...(alarms.length ? ["## 警报（已交给 30 分钟 alert 流程）", "", ...alarms.map((a) => `- ${a.level === "ALARM" ? "🚨" : "⚠️"} ${a.title}：${a.detail}（${BY[a.by]}）`), ""] : []),
    ...(failed.length ? ["## 数据失败", "", ...failed.map(([k, e]) => `- ${k}: ${e}`), ""] : []),
  ].join("\n");
  return { md, alarms, noTrade, mentorLines: M, dkLines: K, oilLines, bondLines, oilVix: ov };
}

/** Alarm → FeedItem so the existing store / 30-min alert routine can surface it (sourceId "premarket-alarm"). */
export const ALARM_SOURCE = "premarket-alarm";
export function alarmItems(alarms: Alarm[], now: Date) {
  const day = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return alarms.map((a) => ({ sourceId: ALARM_SOURCE, title: `[盘前 ${day}] ${a.level} ${a.kind}${a.score != null ? `(${a.score})` : ""}: ${a.title}`, url: `alpha://premarket/${day}/${a.kind}`, publishedAt: now.toISOString(), summary: a.detail, guid: `premarket:${day}:${a.kind}` }));
}
