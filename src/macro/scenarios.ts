/**
 * Scenario analysis, Oct → year-end 2026 (DK addition, user-requested 2026-10-14). Pure: data in, Chinese markdown out.
 * Macro-first (mentor-better-macro-trader): scenarios explain WHY; premarket/regime signals say WHEN they are confirmed.
 * Weights are QUALITATIVE ranks justified by which live signals agree. They are not probabilities and not data.
 * Every expression respects the rule card (src/options/rules.ts): defined-risk only, 1% max loss per trade, 3% per underlying,
 * 1 adjustment, 2% daily loss; NO_TRADE inside the 48h high-impact event window (risk.ts) and when no scenario leads.
 */
import type { Obs } from "./fetch.ts";
import { chg } from "./premarket.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import { upcomingHighImpact, knowledgeRef } from "./risk.ts";
import { DEFAULT_RULES } from "../options/rules.ts";

export type ScenarioId = "base" | "hawkish" | "risk_off" | "melt_up";
export type Dir = "↑" | "↓" | "→" | "↕";
export const ASSETS = ["SPX", "NDX", "RUT", "TLT", "DXY", "黄金", "BTC"] as const;

export interface SignalResult { id: string; label: string; hit: boolean | null; evidence: string }
export interface Scenario {
  id: ScenarioId; name: string; drivers: string[];
  /** signal ids that support (+) or contradict (−) this scenario */
  supports: string[]; contradicts: string[];
  dirs: Record<(typeof ASSETS)[number], Dir>;
  expressions: string[]; invalidation: string[];
  catalog: string[]; worldLines: Array<{ n: number; title: string; watch: string }>;
}
export interface ScenarioInput { now: Date; data: Record<string, Obs[]>; calendar?: CalendarEvent[]; headlines?: string[]; earningsCount?: number | null; regimeLabel?: string | null; previousLeader?: ScenarioId | null;
  /** series ids whose older history is back-adjusted continuous (futContract.ts): multi-day details labelled 回溯调整 */ adjusted?: ReadonlySet<string>;
  /** futures whose same-contract quote failed (futContract.ts) → visible 数据不完整 flag */ incomplete?: string[];
  /** reason to not count a leader change this run (e.g. first same-contract run: history shifted by back-adjustment) */ suppressChange?: string | null }
export interface Ranked { s: Scenario; score: number; pro: SignalResult[]; con: SignalResult[]; weight: string }
export interface ScenarioResult { md: string; ranked: Ranked[]; leader: ScenarioId | null; changed: boolean; signals: SignalResult[]; noTrade: string[] }

const lastV = (o?: Obs[]) => (o?.length ? o.at(-1)!.v : null);
const ma = (o: Obs[] | undefined, n: number) => (o && o.length >= n ? o.slice(-n).reduce((s, x) => s + x.v, 0) / n : null);
const f = (x: number | null, u: string, d = 1) => (x == null ? "n/a" : `${x > 0 ? "+" : ""}${x.toFixed(d)}${u}`);

/** Live signals, each tied to an existing premarket/regime check. null = data missing (never counted). */
export function computeSignals(inp: ScenarioInput): SignalResult[] {
  const d = inp.data; const S: SignalResult[] = [];
  const adj = (id: string) => (inp.adjusted?.has(id) && d[id]?.length ? "（回溯调整连续合约）" : "");
  const add = (id: string, label: string, hit: boolean | null, evidence: string) => S.push({ id, label, hit, evidence });
  const y2 = chg("UST2Y", d.UST2Y, 20), y10 = chg("UST10Y", d.UST10Y, 5), r10 = chg("REAL10Y", d.REAL10Y, 20);
  add("front_end_up", "2Y 20 日上行 >10bp（加息/更久高息定价）", y2 == null ? null : y2 > 10, `2Y 20日 ${f(y2, "bp")}`);
  add("long_end_up", "10Y 5 日上行 >10bp（期限溢价/财政）", y10 == null ? null : y10 > 10, `10Y 5日 ${f(y10, "bp")}`);
  add("real_yields_up", "10Y 实际利率 20 日上行 >15bp", r10 == null ? null : r10 > 15, `实际利率 20日 ${f(r10, "bp")}`);
  const dxy = chg("DXY", d.DXY, 20);
  add("usd_up", "DXY 20 日 >+1%", dxy == null ? null : dxy > 1, `DXY 20日 ${f(dxy, "%", 2)}`);
  const vix = lastV(d.VIX), v3 = lastV(d.VIX3M);
  add("vix_high", "VIX >20 或 VIX/VIX3M >1（倒挂）", vix == null ? null : vix > 20 || (v3 != null && vix / v3 > 1), `VIX ${vix?.toFixed(1) ?? "n/a"}${v3 ? ` · VIX/VIX3M ${(vix! / v3).toFixed(2)}` : ""}`);
  add("vix_low", "VIX <15", vix == null ? null : vix < 15, `VIX ${vix?.toFixed(1) ?? "n/a"}`);
  const hyg = chg("HYG", d.HYG, 5);
  add("credit_stress", "HYG 5 日 < −1%（信用走弱）", hyg == null ? null : hyg < -1, `HYG 5日 ${f(hyg, "%", 2)}`);
  const spx = lastV(d.SPX), m50 = ma(d.SPX, 50);
  add("spx_above_50", "SPX 在 50 日均线上方", spx == null || m50 == null ? null : spx > m50, `SPX ${spx?.toFixed(0) ?? "n/a"} vs 50MA ${m50?.toFixed(0) ?? "n/a"}`);
  const rut = chg("RUT", d.RUT, 20), sp20 = chg("SPX", d.SPX, 20);
  add("breadth_up", "RUT 20 日跑赢 SPX（广度扩散）", rut == null || sp20 == null ? null : rut - sp20 > 1, `RUT ${f(rut, "%")} vs SPX ${f(sp20, "%")}`);
  add("breadth_down", "RUT 20 日跑输 SPX >2%（窄幅/融资压力）", rut == null || sp20 == null ? null : sp20 - rut > 2, `RUT ${f(rut, "%")} vs SPX ${f(sp20, "%")}`);
  const jpy = chg("USDJPY", d.USDJPY, 5);
  add("carry_unwind", "USDJPY 5 日 < −2%（日元套利平仓，主线 20）", jpy == null ? null : jpy < -2, `USDJPY 5日 ${f(jpy, "%", 2)}`);
  const oil = chg("WTI", d.WTI, 20);
  add("oil_up", "WTI 20 日 >+10%（通胀压力，主线 11）", oil == null ? null : oil > 10, `WTI 20日 ${f(oil, "%")}${adj("WTI")}`);
  const gold = chg("GOLD", d.GOLD, 20);
  add("gold_bid", "黄金 20 日 >+3%（避险/去美元化需求）", gold == null ? null : gold > 3, `黄金 20日 ${f(gold, "%")}${adj("GOLD")}`);
  const hot = (inp.headlines ?? []).find((h) => /(cpi|inflation|consumer prices?)[^|]*(hot|faster|more than expected|above|accelerat|sharply)|(hotter|faster)[^|]*(cpi|inflation)/i.test(h));
  add("cpi_hot", "CPI 偏热（新闻标题，非数据）", inp.headlines ? !!hot : null, hot ? `标题: ${hot.slice(0, 90)}` : "近 48h 标题中未见 CPI 偏热");
  return S;
}

const WL = (n: number, title: string, watch: string) => ({ n, title, watch });
export const SCENARIOS: Scenario[] = [
  { id: "base", name: "基准：高位震荡、通胀黏性、Fed 观望",
    drivers: ["CPI 偏热但不失控，Fed 10/28 与 12/9 按兵不动", "财报季（10–11 月）盈利托底，AI 资本开支继续", "利率与美元在高位区间震荡"],
    supports: ["spx_above_50"], contradicts: ["vix_high", "credit_stress", "carry_unwind", "front_end_up"],
    dirs: { SPX: "→", NDX: "↕", RUT: "→", TLT: "→", DXY: "→", "黄金": "→", BTC: "↕" },
    expressions: ["默认 NO_TRADE 或小仓：区间内的方向不清（entry-market-worth-trading）", "若做：对称、定义风险的结构（铁鹰/蝶式），单笔最大亏损 ≤1%，FOMC/CPI 前 48h 不开新仓", "财报个股：只用借方价差，按 events.ts 的隐含 vs 历史事件波动筛选"],
    invalidation: ["SPX 收盘跌破 50 日均线且 HYG 同步走弱 → 转向避险情景", "2Y 20 日上行 >10bp + DXY >+1% → 转向鹰派情景"],
    catalog: ["patience", "expectations", "entry-market-worth-trading", "review-no-trade"], worldLines: [WL(16, "AI、电力与数据中心", "真实资本开支、付费需求与设备利用率")] },
  { id: "hawkish", name: "鹰派 / 更久高息（higher-for-longer）",
    drivers: ["CPI 连续偏热 + 油价上行，市场把降息推迟或计价加息", "财政赤字与期限溢价推高长端（主线 18）", "实际利率上行压估值，美元走强"],
    supports: ["front_end_up", "long_end_up", "real_yields_up", "usd_up", "cpi_hot", "oil_up", "breadth_down"], contradicts: ["breadth_up"],
    dirs: { SPX: "↓", NDX: "↓", RUT: "↓", TLT: "↓", DXY: "↑", "黄金": "↕", BTC: "↓" },
    expressions: ["TLT 看跌借方价差（put debit spread），定义风险，单笔 ≤1%", "RUT/IWM 看跌借方价差（对利率最敏感），同一标的合计 ≤3%", "长 put → 等确认再加 → 近支撑转 PDS（INTC 流程，adjust.ts），只加一次"],
    invalidation: ["2Y 与 10Y 回落到 20 日区间内，且 DXY 转跌", "下一次 CPI（11/10）降温"],
    catalog: ["expectations", "mechanisms", "horizons", "psych-second-order", "thesis-stop"], worldLines: [WL(18, "债务与财政主导", "期限溢价、通胀预期与央行政策可信度"), WL(11, "石油就是权力", "Brent／WTI 期限结构和炼油价差"), WL(12, "美元体系与金融制裁", "美联储政策、美元融资成本及跨币种基差")] },
  { id: "risk_off", name: "增长恐慌 / 避险（growth scare）",
    drivers: ["信用利差走阔、波动率倒挂", "日元套利平仓引发去杠杆（主线 20）", "AI 资本开支回报受质疑，半导体领跌"],
    supports: ["vix_high", "credit_stress", "carry_unwind", "breadth_down", "gold_bid"], contradicts: ["spx_above_50", "vix_low", "breadth_up"],
    dirs: { SPX: "↓", NDX: "↓", RUT: "↓", TLT: "↑", DXY: "↕", "黄金": "↑", BTC: "↓" },
    expressions: ["SPY/QQQ 看跌借方价差，小仓；VIX 已高时不追买 put（IV 贵，cost 规则）", "现金也是仓位：先减仓、不开新多（mentor-discipline #12）", "触发 HYG 背离 / carry unwind 警报当天 NO_TRADE，等收盘确认"],
    invalidation: ["VIX 回到 VIX3M 之下（期限结构恢复正常）且 HYG 收复 5 日跌幅", "SPX 重新站上 50 日均线"],
    catalog: ["discipline-survive-first", "size", "overnight", "hedge", "patience"], worldLines: [WL(20, "日元 Carry Trade", "美日预期利差和 USD/JPY"), WL(16, "AI、电力与数据中心", "推理单位成本、毛利率和资本回报"), WL(9, "中国、台湾与半导体", "出口管制生效文本、范围和许可证")] },
  { id: "melt_up", name: "软着陆 / 年末冲高（melt-up）",
    drivers: ["通胀回落、Fed 12 月释放宽松信号", "盈利超预期 + 广度扩散到小盘", "波动率压低，季节性年末资金流"],
    supports: ["spx_above_50", "vix_low", "breadth_up"], contradicts: ["front_end_up", "real_yields_up", "credit_stress", "vix_high", "cpi_hot"],
    dirs: { SPX: "↑", NDX: "↑", RUT: "↑", TLT: "↑", DXY: "↓", "黄金": "→", BTC: "↑" },
    expressions: ["SPY/IWM 看涨借方价差，突破 + 放量确认后再进（volume-confirmation）", "不因“便宜”加仓；盈利按止盈学分批（takeprofit.ts）", "欣快闸门：大赢之后先回答“真实机会还是想要更多”（entry-euphoria-gate）"],
    invalidation: ["CPI 再次偏热或 2Y 重新上行 >10bp/20 日", "RUT 突破失败回到区间内（量能不足）"],
    catalog: ["volume-confirmation", "entry-euphoria-gate", "catalyst-runner", "psych-extreme-point-precision"], worldLines: [WL(16, "AI、电力与数据中心", "真实资本开支、付费需求与设备利用率")] },
];

/** Qualitative weight: rank by (# supporting − # contradicting) live signals. Words only; never a percentage. */
export function rankScenarios(sig: SignalResult[]): Ranked[] {
  const by = new Map(sig.map((s) => [s.id, s]));
  const r = SCENARIOS.map((s) => {
    const pro = s.supports.map((id) => by.get(id)).filter((x): x is SignalResult => !!x && x.hit === true);
    const con = s.contradicts.map((id) => by.get(id)).filter((x): x is SignalResult => !!x && x.hit === true);
    return { s, score: pro.length - con.length, pro, con, weight: "" };
  }).sort((a, b) => b.score - a.score || SCENARIOS.indexOf(a.s) - SCENARIOS.indexOf(b.s));
  const top = r[0]!.score, tie = r.filter((x) => x.score === top).length > 1;
  for (const x of r) x.weight = x.score === top ? (tie ? "并列领先（信号不分胜负）" : "领先") : x.score >= top - 1 ? "次要（差一项信号）" : x.score > 0 ? "较低" : "当前缺乏支持";
  return r;
}

export function buildScenarios(inp: ScenarioInput): ScenarioResult {
  const signals = computeSignals(inp);
  const ranked = rankScenarios(signals);
  const tie = ranked[0]!.score === ranked[1]!.score;
  const leader = tie ? null : ranked[0]!.s.id;
  const rawChanged = inp.previousLeader !== undefined && inp.previousLeader !== null && leader !== inp.previousLeader;
  const changed = rawChanged && !inp.suppressChange;
  const events = upcomingHighImpact(inp.calendar ?? [], inp.now);
  const noTrade: string[] = [];
  if (events.length) noTrade.push(`48h 内高影响事件：${events.map((e) => `${e.kind} ${e.date}`).join("、")} → 不开新仓（risk.ts）`);
  if (!leader) noTrade.push("没有单一领先情景（信号并列）→ 方向不清，NO_TRADE（entry-market-worth-trading）");
  const missing = signals.filter((s) => s.hit === null).map((s) => s.id);
  const R = DEFAULT_RULES;
  const ref = (id: string) => { const k = knowledgeRef(id); return k ? `\`${id}\` ${k.title}` : `\`${id}\`(未找到)`; };
  const day = inp.now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const nextEvents = (inp.calendar ?? []).filter((e) => e.date >= day && e.date <= "2026-12-31" && ["FOMC", "CPI", "NFP", "PCE"].includes(e.kind)).map((e) => `${e.kind} ${e.date.slice(5)}`);
  const L: string[] = [
    `# 情景分析 Scenarios：2026 年 10 月 → 年底（${day}）`, "",
    "_来源：大佬《better-macro-trader》宏观先行（catalog source `mentor-better-macro-trader`）+ 世界 20 条主线；情景与权重为 DK 补充。_", "",
    "_权重是**定性排序**，依据下列实时信号有多少支持/反对每个情景；**不是概率，也不是数据**。宏观先行：情景解释 Why，信号确认 When。不是交易建议。_", "",
    `**领先情景：** ${leader ? `${ranked[0]!.s.name}` : "无（并列）"}${changed ? ` ⚠️ 已从 \`${inp.previousLeader}\` 切换` : rawChanged ? `（ℹ️ 与上次 \`${inp.previousLeader}\` 不同，但不计为切换：${inp.suppressChange}）` : ""}${inp.regimeLabel ? ` · 宏观 regime：${inp.regimeLabel}` : ""}`,
    `**年底前关键日程：** ${nextEvents.join(" · ") || "n/a"}${inp.earningsCount ? ` · 财报季：data/in/earnings.json 中 ${inp.earningsCount} 家` : " · 财报季进行中（未提供 earnings.json）"}`, "",
    ...(inp.incomplete?.length ? [`> ⚠️ **数据不完整**：${inp.incomplete.join("、")} 同合约报价失败 → 相关信号为 n/a（不用连续合约补），情景排序可能偏差`, ""] : []),
    "## 实时信号", "",
    ...signals.map((s) => `- ${s.hit === true ? "✅" : s.hit === false ? "▫️" : "❔"} ${s.label} — ${s.evidence}`), "",
    "## 情景排序（定性）", "", "| 情景 | 定性权重 | 支持信号 | 反对信号 |", "|---|---|---|---|",
    ...ranked.map((x) => `| ${x.s.name} | ${x.weight} | ${x.pro.map((p) => p.id).join(", ") || "—"} | ${x.con.map((p) => p.id).join(", ") || "—"} |`), "",
    `## 方向预期`, "", `| 情景 | ${ASSETS.join(" | ")} |`, `|---|${ASSETS.map(() => "---").join("|")}|`,
    ...ranked.map((x) => `| ${x.s.name} | ${ASSETS.map((a) => x.s.dirs[a]).join(" | ")} |`), "", "_↑ 上 · ↓ 下 · → 区间 · ↕ 方向不确定/双向波动_", "",
  ];
  for (const x of ranked) {
    L.push(`## ${x.s.name}（${x.weight}）`, "", "**驱动：**", ...x.s.drivers.map((d) => `- ${d}`), "",
      "**确认信号（来自盘前/regime 检查）：**", ...x.s.supports.map((id) => { const s = signals.find((y) => y.id === id)!; return `- ${s.hit === true ? "✅" : s.hit === false ? "▫️" : "❔"} ${s.label}`; }), "",
      `**定义风险的表达（规则卡：单笔 ≤${Math.max(R.sellerMaxLossPerTradePct, R.buyerPremiumPerTradePct)}%，同标的 ≤${R.perUnderlyingMaxLossPct}%，最多 ${R.maxAdjustmentsPerPosition} 次调整，日亏 ${R.dailyLossLimitPct}% 停手）：**`,
      ...x.s.expressions.map((e) => `- ${e}`), ...(x.s.id === leader ? [] : ["- 非领先情景：只观察，不预先建仓（NO_TRADE）"]), "",
      "**失效条件：**", ...x.s.invalidation.map((e) => `- ${e}`), "",
      `**引用：** catalog ${x.s.catalog.map(ref).join(" ")} · 世界主线 ${x.s.worldLines.map((w) => `#${w.n} ${w.title}（观察：${w.watch}）`).join("；")}`, "");
  }
  L.push("## NO_TRADE", "", ...(noTrade.length ? noTrade.map((n) => `- ⛔ ${n}`) : ["- 无强制 NO_TRADE；仍以盘前流程与 pretrade 闸门为准"]), "");
  if (missing.length) L.push(`_缺数据信号（不计分）：${missing.join(", ")}_`, "");
  L.push("_世界主线：knowledge/mentor/world-lines.md（大佬推荐）。catalog：knowledge/catalog.json。_");
  return { md: L.join("\n"), ranked, leader, changed, signals, noTrade };
}

export const SCENARIO_ALARM_SOURCE = "scenario-alarm";
export function scenarioAlarmItems(r: ScenarioResult, previous: ScenarioId | null, now: Date) {
  if (!r.changed) return [];
  const day = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const name = r.leader ? SCENARIOS.find((s) => s.id === r.leader)!.name : "无（并列）";
  return [{ sourceId: SCENARIO_ALARM_SOURCE, title: `[情景 ${day}] 领先情景切换：${previous} → ${r.leader ?? "none"}（${name}）`, url: `alpha://scenarios/${day}/${previous}-${r.leader ?? "none"}`, publishedAt: now.toISOString(), summary: r.ranked.slice(0, 2).map((x) => `${x.s.name}: ${x.weight}，支持 ${x.pro.map((p) => p.id).join(",") || "—"}`).join("；") }];
}
