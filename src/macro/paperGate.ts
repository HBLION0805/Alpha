/**
 * 纸面交易闸门 (user-approved 2026-10-22): PAPER ONLY. The brief verdict (briefVerdict) stays as the research stance, but it no longer
 * blocks paper practice by itself. On most trading days the gate proposes ONE small defined-risk paper card aligned with the
 * macro direction (leading scenario → else mentor-framework tilt). Intraday allowed.
 * Hard NO_TRADE only for real reasons: daily loss cap hit · extreme event · no instrument aligned with a direction.
 * Everything else (mixed regime, 48h event, gap, unconfirmed headline, credit widening, weak 2–3/4 confirmation) → lowest tier $25.
 * Hard caps unchanged: per-trade ≤ confidence tier (0.5/1/1.5/2% of equity), daily loss ≤ riskCap.ts dailyRiskCapPct (2% before 2026-10-30; 10% while equity ≤ $10k after), defined risk, no naked shorts.
 */
import { dailyRiskCapPct } from "../options/riskCap.ts";
import type { Obs } from "./fetch.ts";
import type { RefLevels } from "../levels.ts";
import type { Candidate } from "./tradeplan.ts";
import type { MentorSignals } from "./mentorSignals.ts";

export const TIERS = [{ id: "low", pct: 0.5, zh: "低" }, { id: "medium", pct: 1, zh: "中" }, { id: "high", pct: 1.5, zh: "高" }, { id: "max", pct: 2, zh: "最高" }] as const;
export const EXTREME = { vix: 30, vix1dPct: 20, index1dPct: 3 };
export interface GateInput { verdict: string; reasons: string[]; leader: string | null; candidates: Candidate[]; levels: Record<string, RefLevels | undefined>;
  data: Record<string, Obs[] | undefined>; signals: MentorSignals; equity: number; lossToday: number; dailyCapPct?: number; /** trade date for the daily cap (riskCap.ts) */ now?: Date; bars5d?: Record<string, number | null> }
export interface Scenario { id: "big_drop" | "slow_drop" | "sideways" | "rally"; name: string; pnl: number; note: string; hedge?: string }
export interface PaperCard { ticker: string; side: "long" | "short"; structure: string; direction: string; source: "scenario" | "mentor_tilt"; trigger: string; entryZone: [number, number];
  stop: string; takeProfit: string; timeStop: string; tier: (typeof TIERS)[number]["id"]; riskUsd: number; confirm: string; why: string[]; scenarios: Scenario[] }
export interface GateResult { decision: "PAPER_TRADE" | "NO_TRADE"; hardReasons: string[]; softReasons: string[]; card: PaperCard | null; dailyCapUsd: number; dailyRemainingUsd: number }

const ch1 = (o?: Obs[]) => (o && o.length > 1 ? ((o.at(-1)!.v - o.at(-2)!.v) / o.at(-2)!.v) * 100 : null);
const r2 = (x: number) => Number(x.toFixed(2));
const money = (x: number) => `${x < 0 ? "−" : "+"}$${Math.abs(Math.round(x))}`;

export function extremeReasons(d: GateInput["data"], reasons: string[]): string[] {
  const out: string[] = [], v = d.VIX?.at(-1)?.v, v1 = ch1(d.VIX), n1 = ch1(d.NQ?.length ? d.NQ : d.NDX), e1 = ch1(d.ES?.length ? d.ES : d.SPX);
  if (v != null && v >= EXTREME.vix) out.push(`极端事件：VIX ${v.toFixed(2)} ≥ ${EXTREME.vix}`);
  if (v1 != null && v1 >= EXTREME.vix1dPct) out.push(`极端事件：VIX 单日 +${v1.toFixed(1)}% ≥ ${EXTREME.vix1dPct}%`);
  for (const [k, x] of [["NQ/NDX", n1], ["ES/SPX", e1]] as const) if (x != null && Math.abs(x) >= EXTREME.index1dPct) out.push(`极端事件：${k} 单日 ${x.toFixed(2)}%（|≥${EXTREME.index1dPct}%|）`);
  if (reasons.some((r) => /VIX STRESS/.test(r))) out.push("极端事件：VIX 状态 STRESS");
  return out;
}

export function scenarioTable(side: "long" | "short", R: number, ticker: string): Scenario[] {
  // debit spread sized so max loss = R; stop at −50% of debit; TP at +80% of debit; max profit ≈ 1.5R (width ≈ 2.5× debit)
  const fav = side === "short", s = (x: number) => Math.round(x * R);
  const adverse = `止损在入场时已设（价差 −50% 或 15 分钟收盘越过止损位）；跳空最坏亏满 $${R}`;
  return [
    { id: "big_drop", name: "大跌", pnl: fav ? s(0.8) : -s(0.5), note: fav ? "触及止盈（+80% 借方）" : adverse, ...(fav ? {} : { hedge: `同到期小额 ${ticker} 看跌借方价差（≤ $${Math.round(R / 4)}，计入同一笔上限），或在止损位直接离场` }) },
    { id: "slow_drop", name: "慢跌", pnl: fav ? s(0.3) : -s(0.4), note: fav ? "方向对但慢：部分盈利，时间止损离场" : "缓慢不利 + 时间价值损耗", ...(fav ? {} : { hedge: "卖出更远价外一档把价差改成蝶式降低成本，或收盘前时间止损" }) },
    { id: "sideways", name: "横盘", pnl: -s(0.35), note: "时间价值损耗；收盘前/到期前时间止损", hedge: "卖出更远一档同向期权（改成蝶式/收回部分权利金），或到时间止损直接离场" },
    { id: "rally", name: "上涨", pnl: fav ? -s(0.5) : s(0.8), note: fav ? adverse : "触及止盈（+80% 借方）", ...(fav ? { hedge: `同到期小额 ${ticker} 看涨借方价差（≤ $${Math.round(R / 4)}，计入同一笔上限），或在止损位直接离场` } : {}) },
  ];
}

export function paperGate(i: GateInput): GateResult {
  const dailyCapUsd = Math.round(i.equity * (i.dailyCapPct ?? dailyRiskCapPct(i.now ?? new Date(), i.equity))) / 100, remaining = Math.max(0, dailyCapUsd - Math.max(0, i.lossToday));
  const lowUsd = Math.round(i.equity * TIERS[0].pct) / 100;
  const hard: string[] = [];
  if (remaining < lowUsd) hard.push(`单日亏损上限：今日已亏 $${r2(i.lossToday)}，剩余 $${r2(remaining)} < 最低档 $${lowUsd}`);
  hard.push(...extremeReasons(i.data, i.reasons));
  const soft = i.reasons.filter((r) => !/VIX STRESS/.test(r));
  // direction: leading-scenario candidates (best confirmation first), else mentor tilt on QQQ
  const withLv = i.candidates.filter((c) => c.trigger !== "—").sort((a, b) => b.confirm.score - a.confirm.score);
  let pick: { c: Candidate; source: PaperCard["source"] } | null = withLv[0] ? { c: withLv[0], source: "scenario" } : null;
  if (!pick && (i.signals.tilt === "bearish" || i.signals.tilt === "bullish")) {
    const L = i.levels.QQQ?.priorDay, side = i.signals.tilt === "bearish" ? "short" as const : "long" as const;
    if (L) pick = { source: "mentor_tilt", c: { ticker: "QQQ", side, structure: side === "long" ? "看涨借方价差 call debit spread（定义风险）" : "看跌借方价差 put debit spread（定义风险）",
      trigger: side === "short" ? `15 分钟收盘跌破前日低点 ${r2(L.l)}，且回抽不收回` : `15 分钟收盘站上前日高点 ${r2(L.h)}，且回踩不跌破`,
      entryZone: side === "short" ? [r2(L.l * 0.997), r2(L.l)] : [r2(L.h), r2(L.h * 1.003)],
      stop: side === "short" ? `15 分钟收盘重新站上前日高点 ${r2(L.h)} → 离场` : `15 分钟收盘跌回前日低点 ${r2(L.l)} 之下 → 离场`,
      invalidation: "导师框架倾向反转", size: "", confirm: { score: 0, of: 4, factors: [] }, qualifies: false } };
  }
  if (!pick) hard.push(i.leader ? "没有与方向一致、且有价位数据的标的" : "没有方向：无领先情景，导师框架倾向为中性/数据不足");
  if (hard.length || !pick) return { decision: "NO_TRADE", hardReasons: hard, softReasons: soft, card: null, dailyCapUsd, dailyRemainingUsd: remaining };
  const { c, source } = pick, sc = c.confirm.score;
  const tiltAgrees = (i.signals.tilt === "bearish" && c.side === "short") || (i.signals.tilt === "bullish" && c.side === "long");
  const tierIdx = soft.length || source === "mentor_tilt" || sc <= 2 ? 0 : sc === 3 ? 1 : tiltAgrees ? 2 : 1;
  const tier = TIERS[tierIdx]!; let riskUsd = Math.round(i.equity * tier.pct) / 100; riskUsd = Math.min(riskUsd, remaining);
  const why = [source === "scenario" ? `领先情景「${i.leader}」方向，趋势确认 ${sc}/4` : `无领先情景 → 导师框架倾向 ${i.signals.tilt}`,
    ...(tiltAgrees ? ["导师框架倾向一致"] : source === "scenario" ? [`导师框架倾向 ${i.signals.tilt}（不一致或中性 → 不加档）`] : []),
    ...(soft.length ? [`存在软性风险 ${soft.length} 条 → 只用最低档 $${Math.round(i.equity * TIERS[0].pct) / 100}`] : [])];
  return { decision: "PAPER_TRADE", hardReasons: [], softReasons: soft, dailyCapUsd, dailyRemainingUsd: remaining, card: {
    ticker: c.ticker, side: c.side, structure: c.structure, direction: c.side === "long" ? "多" : "空", source, trigger: c.trigger, entryZone: c.entryZone, stop: `${c.stop}；或价差 −50%`,
    takeProfit: "价差 +80% 借方全部止盈（或 +40% 先平一半）", timeStop: "日内单：15:45 ET 前未触及止盈/止损则平仓；隔夜持有需 ≥7 DTE", tier: tier.id, riskUsd,
    confirm: `${sc}/4`, why, scenarios: scenarioTable(c.side, riskUsd, c.ticker) } };
}

export function renderGate(g: GateResult): string[] {
  const L = ["## 2.0 纸面交易闸门（只限模拟盘）", "_研究结论（§1）不再单独否决模拟练习；只有单日亏损上限、极端事件、或没有方向一致的标的才是 NO_TRADE。仍需 `npm run paper -- open` 的 pretrade 检查。_", ""];
  L.push(`- 单日亏损上限 $${g.dailyCapUsd}，今日剩余 $${r2(g.dailyRemainingUsd)}`);
  if (g.decision === "NO_TRADE" || !g.card) { L.push("", "**🛑 模拟盘 NO_TRADE（硬性原因）：**", ...g.hardReasons.map((r) => `- ${r}`), ""); return L; }
  const c = g.card, t = TIERS.find((x) => x.id === c.tier)!;
  L.push("", `**📝 模拟交易卡：${c.ticker} ${c.direction} · ${c.structure}**`, "",
    `- 来源：${c.why.join("；")}`, `- 触发（可日内）：${c.trigger}；入场区 ${c.entryZone[0]}–${c.entryZone[1]}`,
    `- 置信度档：${t.zh}（${t.pct}% 权益）→ 最大亏损 **$${c.riskUsd}**（按价差最大亏损算张数）`,
    `- 止损（入场即设）：${c.stop}`, `- 止盈（入场即设）：${c.takeProfit}`, `- 时间止损：${c.timeStop}`, "",
    "| 情景 | 预计盈亏 | 说明 | 对冲（亏损情景） |", "|---|---|---|---|",
    ...c.scenarios.map((s) => `| ${s.name} | ${money(s.pnl)} | ${s.note} | ${s.hedge ?? "—"} |`), "",
    ...(g.softReasons.length ? ["软性风险（已降到最低档，不阻止模拟）：", ...g.softReasons.map((r) => `- ${r}`), ""] : []));
  return L;
}
