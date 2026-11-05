/**
 * 今日交易计划 — conditional if-then candidates derived from the leading scenario + reference levels (user rule 2026-10-15).
 * Only these planned triggers may be entered intraday. Each candidate: trigger, direction + defined-risk structure,
 * entry zone, stop/invalidation, size (≤1%), trend-confirmation score (bonds / USD / oil / flows agreeing).
 * A candidate qualifies only with ≥3 of 4 confirmations. None qualifying → NO_TRADE with the reason.
 */
import type { Obs } from "./fetch.ts";
import type { RefLevels } from "../levels.ts";
import { SCENARIOS, type ScenarioId } from "./scenarios.ts";

export const PLAN_RULE = "规则：盘中只允许执行这里事先写好的触发条件；没写的、没触发的，一律不做（纪律 #07 不追；NO_TRADE 是合法结果）。";
const MAP: Array<[string, string]> = [["SPY", "SPX"], ["QQQ", "NDX"], ["IWM", "RUT"], ["TLT", "TLT"]];
export interface Candidate {
  ticker: string; side: "long" | "short"; structure: string; trigger: string; entryZone: [number, number]; stop: string; invalidation: string;
  size: string; confirm: { score: number; of: number; factors: Array<{ name: string; agree: boolean | null; detail: string }> }; qualifies: boolean; why?: string;
}
export interface PlanInput { leader: ScenarioId | null; verdict: string; noTrade: string[]; levels: Record<string, RefLevels | undefined>; data: Record<string, Obs[]>; bars5d: Record<string, number | null>; capital?: number | null; capPct?: number }

const ch5 = (o?: Obs[], bp = false) => (!o || o.length < 6 ? null : bp ? (o.at(-1)!.v - o[o.length - 6]!.v) * 100 : ((o.at(-1)!.v - o[o.length - 6]!.v) / o[o.length - 6]!.v) * 100);
const fx = (x: number | null, u: string) => (x == null ? "n/a" : `${x > 0 ? "+" : ""}${x.toFixed(u === "bp" ? 1 : 2)}${u}`);

export function buildTradePlan(i: PlanInput): { candidates: Candidate[]; qualified: Candidate[]; lines: string[] } {
  const sc = i.leader ? SCENARIOS.find((s) => s.id === i.leader) : null;
  const y5 = ch5(i.data.UST10Y, true), d5 = ch5(i.data.DXY), o5 = ch5(i.data.WTI);
  const cands: Candidate[] = [];
  if (sc) for (const [tk, col] of MAP) {
    const dir = (sc.dirs as Record<string, string>)[col];
    if (dir !== "↑" && dir !== "↓") continue;
    const side = dir === "↑" ? "long" : "short", L = i.levels[tk];
    // "pressure up" = yields, USD, oil rising. It hurts equities and TLT → agrees with shorts, disagrees with longs.
    const want = side === "short" ? 1 : -1;
    const agree = (x: number | null, eps: number) => (x == null ? null : Math.abs(x) < eps ? false : Math.sign(x) === want);
    const own = i.bars5d[tk] ?? null;
    const factors = [
      { name: "债券（10Y 5日）", agree: agree(y5, 3), detail: fx(y5, "bp") },
      { name: "美元（DXY 5日）", agree: agree(d5, 0.3), detail: fx(d5, "%") },
      { name: "原油（WTI 5日）", agree: agree(o5, 1.5), detail: fx(o5, "%") },
      { name: `资金流（${tk} 5日走势）`, agree: own == null ? null : Math.abs(own) < 0.5 ? false : (own > 0) === (side === "long"), detail: fx(own, "%") },
    ];
    const score = factors.filter((f) => f.agree === true).length;
    const struct = side === "long" ? "看涨借方价差 call debit spread（定义风险）" : "看跌借方价差 put debit spread（定义风险）";
    const size = i.capital ? `最大亏损 ≤ 置信度「中」${i.capPct ?? 1}% × 权益 = $${Math.round(i.capital * (i.capPct ?? 1) / 100)}（按价差最大亏损算张数；4/4 确认 + 情景计划 + 技术入场都对齐时可用「高」1.5% $${Math.round(i.capital * 1.5 / 100)} /「最高」2% $${Math.round(i.capital * 2 / 100)}；开仓前写好大跌/慢跌/横盘/上涨情景计划）` : `最大亏损 ≤ 账户 ${i.capPct ?? 1}%（按价差最大亏损算张数）`;
    if (!L?.priorDay) { cands.push({ ticker: tk, side, structure: struct, trigger: "—", entryZone: [0, 0], stop: "—", invalidation: sc.invalidation.join("；"), size, confirm: { score, of: 4, factors }, qualifies: false, why: "没有价位数据" }); continue; }
    const pd = L.priorDay, r = (x: number) => Number(x.toFixed(2));
    const c: Candidate = side === "short"
      ? { ticker: tk, side, structure: struct, trigger: `15 分钟收盘跌破前日低点 ${r(pd.l)}，且回抽不收回`, entryZone: [r(pd.l * 0.997), r(pd.l)], stop: `15 分钟收盘重新站上前日高点 ${r(pd.h)} → 离场`, invalidation: sc.invalidation.join("；"), size, confirm: { score, of: 4, factors }, qualifies: score >= 3 }
      : { ticker: tk, side, structure: struct, trigger: `15 分钟收盘站上前日高点 ${r(pd.h)}，且回踩不跌破`, entryZone: [r(pd.h), r(pd.h * 1.003)], stop: `15 分钟收盘跌回前日低点 ${r(pd.l)} 之下 → 离场`, invalidation: sc.invalidation.join("；"), size, confirm: { score, of: 4, factors }, qualifies: score >= 3 };
    if (!c.qualifies) c.why = `趋势确认只有 ${score}/4（需要 ≥3）`;
    cands.push(c);
  }
  const q = cands.filter((c) => c.qualifies);
  const L: string[] = [PLAN_RULE, ""];
  if (i.verdict === "NO_TRADE") L.push(`**当前结论 NO_TRADE。** 下列候选只在这些条件全部解除后才有效：`, ...i.noTrade.map((n) => `- ${n}`), "");
  if (!sc) L.push("**NO_TRADE：没有单一领先情景（信号并列）→ 方向不清，今天没有计划内触发。**");
  else if (!q.length) L.push(`**NO_TRADE：领先情景「${sc.name}」下没有候选通过趋势确认（≥3/4）。**`, ...cands.map((c) => `- ${c.ticker} ${c.side === "long" ? "多" : "空"}：${c.why}（${c.confirm.factors.map((f) => `${f.name} ${f.agree == null ? "n/a" : f.agree ? "✓" : "✗"}`).join("，")}）`));
  else {
    L.push(`领先情景：「${sc.name}」`, "", "| # | 标的 / 方向 | 结构 | 触发条件（if） | 入场区 | 止损 / 失效 | 仓位 | 趋势确认 |", "|---|---|---|---|---|---|---|---|");
    q.forEach((c, n) => L.push(`| ${n + 1} | ${c.ticker} ${c.side === "long" ? "多" : "空"} | ${c.structure} | ${c.trigger} | ${c.entryZone[0]}–${c.entryZone[1]} | ${c.stop}；论点失效：${c.invalidation} | ${c.size} | ${c.confirm.score}/4（${c.confirm.factors.map((f) => `${f.name} ${f.detail} ${f.agree == null ? "n/a" : f.agree ? "✓" : "✗"}`).join("；")}） |`));
    const out = cands.filter((c) => !c.qualifies);
    if (out.length) L.push("", `未入选：${out.map((c) => `${c.ticker} ${c.side === "long" ? "多" : "空"}（${c.why}）`).join("；")}`);
  }
  L.push("", "**明确不做的情况：**", "- 触发条件没有出现，或只是盘中刺破、15 分钟收盘没确认", "- 开盘前 30 分钟追价；期货跳空 ≥1.5% 时开盘直接追", "- 48 小时内有高影响数据（CPI / PPI / FOMC / NFP）", "- 价格已经离开入场区（错过不是亏损）", "- 任何一项盘前自检是“不好”，或当日已亏到 2%", "- 每笔都要先过 `npm run paper -- open`（唱反调 + 风险计划 + pretrade 闸门）");
  return { candidates: cands, qualified: q, lines: L };
}
