/**
 * 导师框架信号 (derived from the mentor's framework; rule text written by Alpha, not quoted). Pure, display + gate input.
 * NQ distance to 30000 · WTI distance to 100 (oil/NQ seesaw) · VIX level + breakout (>20 or > prior 20-day high) · gold trend.
 * Inputs are the series the brief already fetches (PM_SERIES: NQ=F, NDX, CL=F / WTI front, ^VIX, GC=F). Missing → n/a, never invented.
 */
import type { Obs } from "./fetch.ts";

export const NQ_LEVEL = 30000, WTI_LEVEL = 100, VIX_LEVEL = 20;
export type Tilt = "bearish" | "bullish" | "neutral" | "unknown";
export interface MentorSignals {
  nq: { src: string; last: number; distPct: number; above: boolean } | null;
  wti: { src: string; last: number; distPct: number; above: boolean } | null;
  vix: { last: number; prior20High: number | null; aboveLevel: boolean; above20dHigh: boolean; breakout: boolean } | null;
  gold: { last: number; sma20: number | null; sma50: number | null; chg20Pct: number | null; trend: "up" | "down" | "flat" | "unknown" } | null;
  /** net tilt for NQ implied by the four signals (Alpha's own rule, see RULES) */
  tilt: Tilt; votes: Array<{ id: string; vote: -1 | 0 | 1; why: string }>;
}
export const RULES = [
  "NQ 在 30000 之上视为多头控制区，之下视为反弹未收复（距离用百分比表示）。",
  "原油与纳指的跷跷板：WTI 站上 100 对 NQ 偏空；在 100 下方且回落对 NQ 偏多。",
  "VIX 突破：收盘 > 20，或高于此前 20 个交易日最高收盘 → 风险升温，对 NQ 偏空。",
  "黄金趋势：价格在 20 日与 50 日均线之上且 20 日上涨 = 上行（避险/实际利率信号，单独不决定 NQ 方向，只作旁证）。",
];
const lastV = (o?: Obs[]) => (o?.length ? o.at(-1)!.v : null);
const sma = (o: Obs[], n: number) => (o.length >= n ? o.slice(-n).reduce((s, x) => s + x.v, 0) / n : null);
const pct = (a: number, b: number) => ((a - b) / b) * 100;
const f2 = (x: number | null | undefined) => (x == null ? "n/a" : x.toFixed(2));
const sp = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(2)}%`;

export function mentorSignals(d: Record<string, Obs[] | undefined>, wtiOverride?: { series: Obs[]; src: string } | null): MentorSignals {
  const nqV = lastV(d.NQ), ndxV = lastV(d.NDX);
  const nq = nqV != null ? { src: "NQ=F", last: nqV } : ndxV != null ? { src: "NDX（NQ 无数据时代用）", last: ndxV } : null;
  const wS = wtiOverride?.series?.length ? wtiOverride : d.WTI?.length ? { series: d.WTI, src: "CL=F" } : null;
  const wV = wS ? lastV(wS.series) : null;
  const vx = d.VIX ?? [], vLast = lastV(vx), prior = vx.length > 1 ? vx.slice(-21, -1) : [];
  const p20 = prior.length ? Math.max(...prior.map((o) => o.v)) : null;
  const g = d.GOLD ?? [], gLast = lastV(g);
  const s: MentorSignals = {
    nq: nq ? { ...nq, distPct: pct(nq.last, NQ_LEVEL), above: nq.last >= NQ_LEVEL } : null,
    wti: wS && wV != null ? { src: wS.src, last: wV, distPct: pct(wV, WTI_LEVEL), above: wV >= WTI_LEVEL } : null,
    vix: vLast != null ? { last: vLast, prior20High: p20, aboveLevel: vLast > VIX_LEVEL, above20dHigh: p20 != null && vLast > p20, breakout: vLast > VIX_LEVEL || (p20 != null && vLast > p20) } : null,
    gold: gLast != null ? (() => { const a = sma(g, 20), b = sma(g, 50), c = g.length > 20 ? pct(gLast, g[g.length - 21]!.v) : null;
      const trend = a == null || b == null || c == null ? "unknown" as const : gLast > a && gLast > b && c > 1 ? "up" as const : gLast < a && gLast < b && c < -1 ? "down" as const : "flat" as const;
      return { last: gLast, sma20: a, sma50: b, chg20Pct: c, trend }; })() : null,
    tilt: "unknown", votes: [],
  };
  if (s.nq) s.votes.push({ id: "nq", vote: s.nq.above ? 1 : -1, why: s.nq.above ? "NQ 在 30000 之上" : "NQ 未收复 30000" });
  if (s.wti) { const w1 = wS!.series.length > 1 ? s.wti.last - wS!.series.at(-2)!.v : 0;
    s.votes.push({ id: "wti", vote: s.wti.above ? -1 : w1 < 0 ? 1 : 0, why: s.wti.above ? "WTI ≥ 100（跷跷板对 NQ 偏空）" : w1 < 0 ? "WTI 在 100 下方且回落" : "WTI 在 100 下方但未回落" }); }
  if (s.vix) s.votes.push({ id: "vix", vote: s.vix.breakout ? -1 : s.vix.last < 17 ? 1 : 0, why: s.vix.breakout ? "VIX 突破（>20 或 >20 日高点）" : s.vix.last < 17 ? "VIX < 17，风险偏低" : "VIX 中性区间" });
  const known = s.votes.length, net = s.votes.reduce((a, v) => a + v.vote, 0);
  s.tilt = known < 2 ? "unknown" : net <= -1 ? "bearish" : net >= 1 ? "bullish" : "neutral";
  return s;
}

export function renderMentorSignals(s: MentorSignals): string[] {
  const TZ = { bearish: "偏空", bullish: "偏多", neutral: "中性", unknown: "数据不足" }[s.tilt];
  return [
    "## 1.3a 导师框架信号（每日计算）", "_依据导师的分析框架推导；下列规则文字由 Alpha 撰写，并非导师原话。只作方向参考，进入 §2.0 纸面交易闸门。_", "",
    "| 信号 | 当前 | 状态 |", "|---|---|---|",
    `| NQ 距 30000 | ${s.nq ? `${s.nq.src} ${f2(s.nq.last)}` : "n/a"} | ${s.nq ? `${sp(s.nq.distPct)}（${s.nq.above ? "在上方" : "在下方"}）` : "无数据"} |`,
    `| WTI 距 100 | ${s.wti ? `${s.wti.src} ${f2(s.wti.last)}` : "n/a"} | ${s.wti ? `${sp(s.wti.distPct)}（${s.wti.above ? "≥100：对 NQ 偏空" : "<100"}）` : "无数据"} |`,
    `| VIX 水平 / 突破 | ${s.vix ? f2(s.vix.last) : "n/a"} | ${s.vix ? `20 日前高 ${f2(s.vix.prior20High)}；>20：${s.vix.aboveLevel ? "是" : "否"}；破 20 日高：${s.vix.above20dHigh ? "是" : "否"} → ${s.vix.breakout ? "**突破**" : "未突破"}` : "无数据"} |`,
    `| 黄金趋势 | ${s.gold ? f2(s.gold.last) : "n/a"} | ${s.gold ? `${{ up: "上行", down: "下行", flat: "震荡", unknown: "n/a" }[s.gold.trend]}（MA20 ${f2(s.gold.sma20)} / MA50 ${f2(s.gold.sma50)}，20 日 ${s.gold.chg20Pct == null ? "n/a" : sp(s.gold.chg20Pct)}）` : "无数据"} |`,
    "", `- 对 NQ 的合成倾向：**${TZ}**（${s.votes.map((v) => `${v.why} ${v.vote > 0 ? "+1" : v.vote < 0 ? "−1" : "0"}`).join("；") || "无"}）`,
    "- 规则（Alpha 撰写）：", ...RULES.map((r) => `  - ${r}`), "",
  ];
}

export const mentorSignalsJson = (s: MentorSignals) => ({ nq: s.nq, wti: s.wti, vix: s.vix, gold: s.gold, tilt: s.tilt, votes: s.votes });
