/**
 * Unified Chinese daily brief (P3, 2026-10-14): ONE report, ONE NO_TRADE verdict. Replaces the separate macro /
 * premarket / scenarios reports. Pure: takes the already-built parts; the CLI fetches each series once.
 * Order: 1 结论+领先情景 (+ 今日能不能睡, src/macro/sleepday.ts, flag only) · 1.1 导师提醒 (src/review/mentor.ts) · 1.2 流动性观察 (src/macro/liquidity.ts, flag only) · 2 警报 · 2.1 今日交易计划 · 3【大佬流程】①国债 · 3.1【用户要求】原油 · 3.2【大佬流程】续 · 4【DK 补充】 · 5 价位（择时） · 6 日历 · 7 盘前自检 (纪律 #2/#20).
 */
import type { MacroReport } from "./build.ts";
import { BY, OIL_HEAD, type PremarketResult } from "./premarket.ts";
import type { ScenarioResult } from "./scenarios.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import { SESSION_QUESTIONS } from "../options/discipline.ts";
import { MECHANICS_QUESTIONS } from "./render.ts";
import { reminderSection, type ReminderState } from "../review/mentor.ts";

const LABEL_ZH: Record<string, string> = { RISK_ON: "风险偏好", RISK_OFF: "避险", HAWKISH_TIGHTENING: "鹰派收紧", STAGFLATION_ISH: "类滞胀", DISINFLATION_EASING: "通胀回落/宽松", MIXED: "信号混杂" };
export type Verdict = "NO_TRADE" | "CAUTION" | "RESEARCH_OK";
export interface BriefInput { now: Date; macro: MacroReport; pm: PremarketResult; sc: ScenarioResult; levelsMd?: string | null; planLines?: string[]; matrixLines?: string[]; gexLines?: string[]; calendar: CalendarEvent[]; failed?: Record<string, string>;
  /** 导师提醒 inputs (events, paper ledger, previous regime/leader); omitted → section skipped */
  mentor?: Omit<ReminderState, "now" | "verdict" | "leader" | "regime" | "leaderChanged">;
  /** §1.2 流动性观察 (src/macro/liquidity.ts renderLiquidity) — flag only; omitted → section skipped */
  liquidityLines?: string[];
  /** 大佬 10/19 经济情景表 + 死猫 vs 见底清单 (src/macro/deadcat.ts renderDeadCat) — display only; omitted → section skipped */
  deadCatLines?: string[];
  /** 地缘/选举事件 (src/macro/geoEvents.ts) — display + 72h reminder only; never in the verdict */
  geo?: { reminder: string[]; calendar: string[] };
  /** 今日能不能睡 (src/macro/sleepday.ts renderSleep) — flag only; omitted → section skipped */
  sleepLines?: string[] }
export interface BriefResult { md: string; verdict: Verdict; reasons: string[] }

/** Single verdict: any NO_TRADE reason from macro risk, premarket or scenarios → NO_TRADE; else macro CAUTION → CAUTION. */
export function briefVerdict(i: Pick<BriefInput, "macro" | "pm" | "sc">): { verdict: Verdict; reasons: string[] } {
  const macroR = i.macro.risk.overall === "NO_TRADE" ? i.macro.risk.noTradeReasons : [];
  // the 48h event window is computed by risk.ts for both macro and scenarios → print it once
  const scR = macroR.some((r) => /高影响事件 48/.test(r)) ? i.sc.noTrade.filter((r) => !/^48h 内高影响事件/.test(r)) : i.sc.noTrade;
  const reasons = [...new Set([...macroR, ...i.pm.noTrade, ...scR])];
  const verdict: Verdict = reasons.length ? "NO_TRADE" : i.macro.risk.overall === "CAUTION" ? "CAUTION" : "RESEARCH_OK";
  return { verdict, reasons: reasons.length ? reasons : i.macro.risk.overall === "CAUTION" ? i.macro.risk.noTradeReasons : [] };
}

export function buildBrief(i: BriefInput): BriefResult {
  const { verdict, reasons } = briefVerdict(i);
  const day = i.now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const hm = i.now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
  const g = i.macro.regime, lead = i.sc.ranked[0]!;
  const V = { NO_TRADE: "🛑 NO_TRADE 不交易", CAUTION: "⚠️ CAUTION 谨慎", RESEARCH_OK: "✅ RESEARCH_OK 可研究" }[verdict];
  const scen = i.sc.leader ? `${lead.s.name}（支持：${lead.pro.map((p) => p.label.split("（")[0]).join("、") || "—"}${lead.con.length ? `；反对：${lead.con.map((p) => p.id).join("、")}` : ""}）` : "无单一领先情景（信号并列 → 方向不清）";
  const alarms = [...i.pm.alarms.map((a) => `${a.level === "ALARM" ? "🚨" : "⚠️"} ${a.title}：${a.detail}（${BY[a.by]}）`), ...(i.sc.changed ? [`⚠️ 领先情景切换 → ${i.sc.leader ?? "无"}`] : [])];
  const upcoming = i.calendar.filter((e) => e.date > day).sort((a, b) => (a.date + a.timeEt).localeCompare(b.date + b.timeEt)).slice(0, 10);
  const todayCal = i.calendar.filter((e) => e.date === day).sort((a, b) => a.timeEt.localeCompare(b.timeEt));
  const minor = (e: CalendarEvent) => (e.tier === 2 ? "（次要）" : "");
  const failed = Object.entries(i.failed ?? {});
  const mentorState = i.mentor ? { ...i.mentor, oilVix: i.mentor.oilVix ?? { fast: i.pm.oilVix?.fast ?? false, driver: i.pm.oilVix?.driver ?? "no_data", vix: i.pm.oilVix?.vix.label ?? "unclear" } } : null;
  const L = [
    `# 每日简报 Daily brief — ${day}（${hm} ET）`, "",
    "_宏观先行：方向来自宏观与情景；技术面只用于择时。不是交易建议。数据：Yahoo / FRED（FRED 为 T-1）。_", "",
    "## 1. 结论", "",
    `**${V}**`, ...reasons.map((r) => `- ${r}`), "",
    `- 宏观状态：**${g.label}**（${LABEL_ZH[g.label] ?? g.label}，置信度 ${g.confidence}）`,
    `- 领先情景：${scen}`,
    ...(i.sc.leader ? [`- 若做（仍需过 pretrade 闸门）：${lead.s.expressions[0]}`, `- 失效条件：${lead.s.invalidation.join("；")}`] : []),
    "- 情景权重为定性排序，不是概率。详见 4.3。", "",
    ...(i.sleepLines?.length ? i.sleepLines : []),
    ...(mentorState ? reminderSection({ ...mentorState, now: i.now, verdict, leader: i.sc.leader, regime: g.label, leaderChanged: i.sc.changed }) : []),
    ...(i.geo?.reminder.length ? [...i.geo.reminder, ""] : []),
    ...(i.liquidityLines?.length ? i.liquidityLines : []),
    ...(i.matrixLines?.length ? [...i.matrixLines, ""] : []),
    ...(i.deadCatLines?.length ? i.deadCatLines : []),
    "## 2. 警报", "", ...(alarms.length ? alarms.map((a) => `- ${a}`) : ["- 无"]), "",
    "## 2.1 今日交易计划", "", ...(i.planLines ?? ["- 未生成（缺少价位/数据）→ 今天没有计划内触发，NO_TRADE"]), "",
    "## 3. 【大佬流程】", "_来源：knowledge/mentor/discipline/premarket-routine.md_", "", ...i.pm.mentorLines.slice(0, i.pm.bondLines), "",
    "## 3.1 【用户要求】原油", OIL_HEAD[1]!, "", ...i.pm.oilLines, "",
    "## 3.2 【大佬流程】（续）", "", ...i.pm.mentorLines.slice(i.pm.bondLines), "",
    "## 4. 【DK 补充】", "_以下为 DK 的补充，不是大佬原流程。_", "", ...i.pm.dkLines, "",
    "### 4.2 宏观各维度（确定性规则）", "", "| 维度 | 状态 | 证据 |", "|---|---|---|", ...g.axes.map((a) => `| ${a.id} | ${a.label} | ${a.evidence} |`), "",
    ...(i.macro.confirmations.length ? ["**新闻 vs 市场反应：**", ...i.macro.confirmations.map((c) => `- ${c.c.verdict} — ${c.headline}（${c.sources} 家）`), ""] : []),
    "### 4.3 情景（定性）", "", "| 情景 | 权重 | 支持 | 反对 |", "|---|---|---|---|",
    ...i.sc.ranked.map((x) => `| ${x.s.name} | ${x.weight} | ${x.pro.map((p) => p.id).join(", ") || "—"} | ${x.con.map((p) => p.id).join(", ") || "—"} |`), "",
    "**市场机制（How / When）：**", ...MECHANICS_QUESTIONS.map((q) => `- [ ] ${q}`), "",
    "## 5. 价位（只用于择时）", "", ...(i.levelsMd ? [i.levelsMd.replace(/^# .*\n+/, "").replace(/^## /gm, "### ")] : ["- 无（npm run levels 未产出）"]), "",
    ...(i.gexLines?.length ? i.gexLines : []),
    "## 6. 日历", "", ...(i.geo?.calendar ?? []), ...(todayCal.length ? todayCal.map((e) => `- **今天 ${e.timeEt.replace(/^0/, "")}：${e.title}**${minor(e)}`) : ["- 今天：无已登记的数据"]), ...(upcoming.length ? upcoming.map((e) => `- ${e.date} ${e.timeEt} ET · ${e.title}${minor(e)}`) : ["- 之后：无"]), "_（次要）= 初请 / 新屋开工 / 耐用品 / 贸易差额：只列出，不触发 48h/72h 事件规则、NO_TRADE 或「不能睡」。_", "",
    "## 7. 盘前自检（纪律 #2 / #20）", "_任何一项是“不好” → 今天 NO_TRADE（pretrade 的 sessionGate 会强制执行）。_", "",
    ...SESSION_QUESTIONS.map((q) => `- [ ] ${q}`), "- [ ] 今天的市场值得交易吗？（成交清淡 / 方向不清 / 来回震荡 / 盈亏比差 → NO_TRADE）", "",
    ...(failed.length ? ["_数据失败：" + failed.map(([k, e]) => `${k} (${e})`).join("; ") + "_"] : []),
  ];
  return { md: L.join("\n"), verdict, reasons };
}
