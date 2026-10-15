import type { MacroReport } from "./build.ts";
import { SERIES } from "./series.ts";
import { et } from "../digest.ts";

const LABEL_ZH: Record<string, string> = { RISK_ON: "风险偏好", RISK_OFF: "避险", HAWKISH_TIGHTENING: "鹰派收紧", STAGFLATION_ISH: "类滞胀", DISINFLATION_EASING: "通胀回落/宽松", MIXED: "信号混杂" };
const AXIS_ZH: Record<string, string> = { rates: "利率方向 Rates", expectations: "政策预期 Expectations", usd: "美元 USD", realYields: "实际利率 Real yields", inflationExp: "通胀预期 Breakevens", volatility: "波动率 Volatility", credit: "信用/风险偏好 Credit", liquidity: "流动性 Liquidity", equities: "股市趋势 Equities" };
const STANCE_ZH: Record<string, string> = { NO_TRADE: "🛑 NO_TRADE 不交易", CAUTION: "⚠️ CAUTION 谨慎", RESEARCH_OK: "✅ RESEARCH_OK 可研究" };

export const MECHANICS_NOTE = "宏观告诉你：为什么它应该动。市场机制告诉你：它可能怎么动，以及什么时候动。 (knowledge/mentor/better-macro-trader.md #9). The user trades macro first: the regime above is the direction; K-line/FIB technicals are for entry timing only, never direction.";
export const MECHANICS_QUESTIONS = [
  "Positioning / crowding: is the move the macro story, or a squeeze? (空头仓位, market positioning)",
  "Dealer hedging & options OI: big gamma/OI near strikes that could pin or accelerate price? (Dealer Hedging, 期权未平仓量)",
  "Liquidity: thin book, holiday or after-hours conditions that exaggerate moves? (做市商, 流动性)",
  "Greeks of your expression: Delta / Gamma / Theta / Vega: can you be right on the macro and still lose on the trade?",
];
export function renderMacro(r: MacroReport, full = true): string {
  const g = r.regime;
  const L: string[] = [];
  if (full) L.push(`# 宏观状态 / Macro regime — ${et(r.generatedAt)}`, "", "_确定性规则，无 AI 计算 / Deterministic rules, no AI in calculations. Not trade advice._", "");
  L.push(`${full ? "## " : "### "}宏观 Why · 结论 / Regime: **${g.label}** (${LABEL_ZH[g.label]}) · confidence ${g.confidence}`, "");
  L.push(`**总体 / Overall: ${STANCE_ZH[r.risk.overall]}**`);
  for (const x of r.risk.noTradeReasons) L.push(`- ${x}`);
  L.push("");
  if (full) {
    L.push("Evidence for:", ...g.support.map((s) => `- ✔ ${s}`), "", "Evidence against:", ...g.against.map((s) => `- ✘ ${s}`), "");
    L.push(`Candidates: ${g.candidates.map((c) => `${c.label} ${c.score}`).join(" · ")}`, "");
  }
  L.push(`${full ? "## " : "#### "}各维度 / Axes`, "", "| axis | state | evidence |", "|---|---|---|");
  for (const a of g.axes) L.push(`| ${AXIS_ZH[a.id] ?? a.id} | ${a.label} | ${a.evidence} |`);
  L.push("");
  L.push(`${full ? "## " : "#### "}新闻与市场确认 / News vs market reaction`, "");
  if (!r.confirmations.length) L.push("_No multi-source macro clusters in window._");
  for (const c of r.confirmations) {
    L.push(`- **${c.c.verdict}** — ${c.headline} (${c.sources} src, ${et(c.firstSeen)}; read as ${c.c.direction}) — ${c.c.reason}`);
    if (full) L.push(`  ${c.c.moves.map((m) => `${m.series} ${m.result === "NO_DATA" ? "n/a" : `${m.pct > 0 ? "+" : ""}${m.pct}%`}${m.result === "CONSISTENT" ? "✔" : m.result === "INCONSISTENT" ? "✘" : ""}`).join(" · ")} (window ${et(c.c.windowFrom)} → ${et(c.c.windowTo)}; ZT is 2Y futures price: down = yield up)`);
  }
  L.push("");
  // 大佬 如何成为更好的宏观交易员 #9: 宏观告诉你为什么它应该动；市场机制告诉你它可能怎么动、什么时候动
  L.push(`${full ? "## " : "#### "}市场机制 How / When (separate from the macro Why above)`, "", `> ${MECHANICS_NOTE}`, "");
  for (const q of MECHANICS_QUESTIONS) L.push(`- [ ] ${q}`);
  if (r.risk.eventRisk.length) L.push(`- When: scheduled catalysts in window: ${r.risk.eventRisk.map((e) => `${e.kind} ${e.date} ${e.timeEt} ET`).join(" · ")}`);
  L.push("");
  L.push(`${full ? "## " : "#### "}风险视角 / Risk view (risk first)`, "");
  for (const a of r.risk.assets) {
    L.push(`- **${a.asset}** — ${STANCE_ZH[a.stance]}`);
    for (const n of a.notes) L.push(`  - ${n}`);
  }
  L.push("", "Checklist:", ...r.risk.checklist.map((c) => `- [ ] ${c}`), "");
  const ac = r.risk.actors;
  if (ac) {
    L.push(`${full ? "### " : "#### "}参与者 / Actors behind the numbers`, "", `> ${ac.quote} — _${ac.source}_`, "", `Actors: ${ac.actors.join(" · ")}`, "");
    for (const q of ac.questions) L.push(`- [ ] ${q}`);
    L.push("");
  }
  if (full) {
    L.push("## 经验提醒 / From the playbook (verbatim, knowledge/catalog.json)", "");
    for (const k of r.risk.knowledge) L.push(`- **${k.title}** (\`${k.id}\`, ${k.kind}) — ${k.text}`);
    L.push("", "## 数据 / Data", "", "| series | source | last | date | 1d | 5d | 20d | z20 | status |", "|---|---|---|---|---|---|---|---|---|");
    const src = new Map(r.sources.map((s) => [s.series, s]));
    for (const s of SERIES) {
      const st = r.stats[s.id];
      const f = src.get(s.id);
      const u = s.unit === "pct" || s.id === "NFCI" ? "bp" : "%";
      L.push(`| ${s.label} | ${s.provider}:${s.ref} | ${st?.last != null ? Number(st.last.toPrecision(6)) : "n/a"} | ${st?.lastDate ?? ""} | ${st?.chg1 ?? ""}${u} | ${st?.chg5 ?? ""}${u} | ${st?.chg20 ?? ""}${u} | ${st?.z20 ?? ""} | ${f ? (f.ok ? "ok" : `FAIL ${f.error}`) : "cached"}${r.overrides[s.id] !== undefined ? " (Robinhood override)" : ""} |`);
    }
    L.push("", "_FRED daily series lag ~1 business day; market series (Yahoo/Coinbase) are current._");
  }
  return L.join("\n") + "\n";
}
