/**
 * Volume anomalies (DK addition, user-approved 2026-10-14). Read-only data: Yahoo chart OHLCV, Robinhood option chains saved in data/in/*-chain.json.
 * Volume only confirms or rules things out; it never triggers an order. Buyer vs seller cannot be inferred from volume or OI
 * (catalog `mechanisms`: "Open interest and volume alone do not identify dealer direction").
 */
import type { Chain } from "../options/chain.ts";
import { daysTo } from "../options/bs.ts";

export const TAG = "成交量仅用于确认/排查，不单独下单";
export const DEFAULT_WATCHLIST = ["SPY", "QQQ", "IWM", "DIA", "SMH", "HYG", "TLT", "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "AVGO", "TSLA"];
export interface Bar { t: string; c: number; h: number; l: number; v: number }

export interface StockVol { symbol: string; date: string; rvol: number; volume: number; avg20: number; chgPct: number; breakout: "high" | "low" | null; verdict: string; strong: boolean }
/** Relative volume of the last completed bar vs the prior 20 bars; price break of the prior 20-day high/low. */
export function stockVolume(symbol: string, bars: Bar[], minRvol = 2): StockVol | null {
  if (bars.length < 22) return null;
  const last = bars.at(-1)!, prior = bars.slice(-21, -1);
  const avg20 = prior.reduce((s, b) => s + b.v, 0) / 20;
  const rvol = last.v / avg20;
  const hi = Math.max(...prior.map((b) => b.h)), lo = Math.min(...prior.map((b) => b.l));
  const breakout = last.c > hi ? "high" : last.c < lo ? "low" : null;
  const chgPct = (last.c / bars.at(-2)!.c - 1) * 100;
  const verdict = breakout ? (rvol >= minRvol ? `放量突破 20 日${breakout === "high" ? "新高" : "新低"} = 确认` : rvol < 1 ? `缩量突破 20 日${breakout === "high" ? "新高" : "新低"} = 可疑` : `突破 20 日${breakout === "high" ? "新高" : "新低"}，量能一般`) : rvol >= minRvol ? "放量但未突破区间：排查原因（新闻/财报/调仓）" : "正常";
  return { symbol, date: last.t, rvol: Math.round(rvol * 100) / 100, volume: last.v, avg20: Math.round(avg20), chgPct: Math.round(chgPct * 100) / 100, breakout, verdict, strong: rvol >= 3 && breakout != null };
}

export interface OptAnomaly { symbol: string; expiration: string; dte: number; strike: number; type: "call" | "put"; volume: number; oi: number; ratio: number; strong: boolean }
export function optionAnomalies(ch: Chain, minVolume = 500, strongRatio = 5): { anomalies: OptAnomaly[]; callVol: number; putVol: number; pcr: number | null } {
  let callVol = 0, putVol = 0; const anomalies: OptAnomaly[] = [];
  for (const c of ch.contracts) {
    const v = c.volume ?? 0, oi = c.openInterest ?? 0;
    if (c.type === "call") callVol += v; else putVol += v;
    if (v >= minVolume && v > oi) {
      const ratio = oi > 0 ? v / oi : Infinity;
      anomalies.push({ symbol: ch.symbol, expiration: c.expiration, dte: Math.max(0, Math.round(daysTo(ch.asOf, c.expiration))), strike: c.strike, type: c.type, volume: v, oi, ratio: ratio === Infinity ? 999 : Math.round(ratio * 10) / 10, strong: ratio >= strongRatio });
    }
  }
  anomalies.sort((a, b) => b.volume - a.volume);
  return { anomalies, callVol, putVol, pcr: callVol > 0 ? Math.round((putVol / callVol) * 100) / 100 : null };
}

export interface VolumeReport { md: string; strong: Array<{ title: string; detail: string }>; stocks: StockVol[]; failed: Record<string, string> }
export function buildVolumeReport(inp: { now: Date; bars: Record<string, Bar[]>; chains: Chain[]; failed?: Record<string, string>; minRvol?: number; minOptVolume?: number }): VolumeReport {
  const T = ` _（${TAG}）_`;
  const stocks = Object.entries(inp.bars).map(([s, b]) => stockVolume(s, b, inp.minRvol ?? 2)).filter((x): x is StockVol => x != null).sort((a, b) => b.rvol - a.rvol);
  const flagged = stocks.filter((s) => s.rvol >= (inp.minRvol ?? 2) || s.breakout);
  const strong: VolumeReport["strong"] = [];
  const L = [`# 成交量异常 Volume anomalies — ${inp.now.toLocaleString("en-CA", { timeZone: "America/New_York", hour12: false }).slice(0, 17)} ET`, "", `> ${TAG}。买方还是卖方无法从成交量/未平仓量推断。DK 补充模块，不是大佬原流程。`, "",
    "## 股票 / ETF 相对成交量（今日 ÷ 20 日均量，上一完整交易日）", ""];
  if (!flagged.length) L.push(`- 无 ≥${inp.minRvol ?? 2}x 或突破 20 日区间的标的${T}`);
  for (const s of flagged) {
    L.push(`- ${s.strong ? "🚨" : s.rvol >= (inp.minRvol ?? 2) ? "⚠️" : "•"} **${s.symbol}** ${s.date} RVOL ${s.rvol}x（${(s.volume / 1e6).toFixed(1)}M vs 均 ${(s.avg20 / 1e6).toFixed(1)}M）· ${s.chgPct > 0 ? "+" : ""}${s.chgPct}% · ${s.verdict}${T}`);
    if (s.strong) strong.push({ title: `${s.symbol} 放量 ${s.rvol}x 突破 20 日${s.breakout === "high" ? "新高" : "新低"}`, detail: `${s.chgPct}% · ${TAG}` });
  }
  L.push("", `<details><summary>全部 ${stocks.length} 个标的</summary>`, "", "| 标的 | RVOL | 涨跌% | 突破 |", "|---|---|---|---|", ...stocks.map((s) => `| ${s.symbol} | ${s.rvol} | ${s.chgPct} | ${s.breakout ?? "—"} |`), "", "</details>", "");
  L.push("## 期权异常（成交量 > 未平仓量）", "");
  if (!inp.chains.length) L.push(`- data/in/ 下没有 *-chain.json（需 routine 用 Robinhood MCP 保存）${T}`);
  for (const ch of inp.chains) {
    const o = optionAnomalies(ch, inp.minOptVolume ?? 500);
    L.push(`### ${ch.symbol}（链时间 ${ch.asOf}）`, `- 认购量 ${o.callVol.toLocaleString()} · 认沽量 ${o.putVol.toLocaleString()} · **Put/Call 成交量比 ${o.pcr ?? "n/a"}**${T}`);
    if (!o.anomalies.length) L.push(`- 无成交量 > OI 且 ≥${inp.minOptVolume ?? 500} 张的合约${T}`);
    for (const a of o.anomalies.slice(0, 12)) {
      L.push(`- ${a.strong ? "🚨" : "⚠️"} ${a.expiration}（${a.dte} DTE）${a.strike} ${a.type === "call" ? "Call" : "Put"} · 量 ${a.volume.toLocaleString()} / OI ${a.oi.toLocaleString()} = ${a.ratio === 999 ? "OI=0" : a.ratio + "x"} · 方向（买/卖）无法推断${T}`);
      if (a.strong) strong.push({ title: `${a.symbol} ${a.expiration} ${a.strike}${a.type === "call" ? "C" : "P"} 量/OI ${a.ratio === 999 ? "OI=0" : a.ratio + "x"}`, detail: `vol ${a.volume} OI ${a.oi} · ${a.dte} DTE · ${TAG}` });
    }
    L.push("");
  }
  const failed = Object.entries(inp.failed ?? {});
  if (failed.length) L.push("## 数据失败", "", ...failed.map(([k, e]) => `- ${k}: ${e}`), "");
  return { md: L.join("\n"), strong, stocks, failed: inp.failed ?? {} };
}

export const VOLUME_ALARM_SOURCE = "volume-alarm";
export function volumeAlarmItems(strong: VolumeReport["strong"], now: Date) {
  const day = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return strong.map((s) => ({ sourceId: VOLUME_ALARM_SOURCE, title: `[成交量 ${day}] ${s.title}`, url: `alpha://volume/${day}/${encodeURIComponent(s.title)}`, publishedAt: now.toISOString(), summary: s.detail }));
}
