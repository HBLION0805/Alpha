/**
 * Forward (out-of-sample) shadow tracking of the two pre-registered backtest hypotheses (/workspace/vibe-trial, round 2, 2026-10-17).
 * Spec: docs/SHADOW_TRACKS.md. Rules are copied from runs/{v2a_spy_longonly_event,v2b_spy_longshort_event}/code/signal_engine.py — NOT retuned.
 *  Track A = v2a: SPY long-only + leader/confirmation macro gate + 48h FOMC/CPI/NFP event gate.
 *  Track B = v2b long/short + the same gates, plus ONE added condition: shorts only while SPY close < its 200-day SMA (signal close).
 * Virtual only: a separate ledger (data/out/shadow/ledger.json), never the paper journal; not counted toward readiness, caps or sins.
 * Pure: bars, the day's leader snapshot, confirmations and events are passed in. Idempotent: a bar date is processed once, in order.
 */
import { etToIso } from "../options/psych.ts";

export const SHADOW = { capital: 5000, riskUsd: 50, costBp: 7, timeStopBars: 10, eventHours: 48, sma: 200,
  eps: { y10bp: 3, dxyPct: 0.3, wtiPct: 1.5, ownPct: 0.5 }, minConfirm: 3, eventSeries: ["FOMC", "CPI", "NFP"] } as const;
export type TrackId = "A" | "B";
export interface Bar { t: string; o: number; h: number; l: number; c: number }
export interface DayInput { date: string; leader: string | null | undefined; verdict?: string | null; briefAt?: string | null; y10_5d: number | null; dxy_5d: number | null; wti_5d: number | null }
export interface ShadowEvent { at: string; title: string; series?: string }
export interface Position { side: 1 | -1; shares: number; entryDate: string; entryFill: number; stop: number; held: number; signalDate: string; weight: number; entryCost: number }
export interface Trade { track: TrackId; side: 1 | -1; signalDate: string; entryDate: string; entryFill: number; exitSignalDate: string; exitDate: string; exitFill: number; shares: number; reason: "stop" | "time_stop"; pnl: number; costs: number }
export interface TrackState { pos: Position | null; pending: { side: 1 | -1; stop: number; weight: number; signalDate: string } | null; pendingExit: { reason: "stop" | "time_stop"; signalDate: string } | null; realized: number; trades: Trade[]; daily: Array<{ date: string; equity: number }> }
export interface DayLog { date: string; spy: Bar & { sma200: number | null }; leader: string | null; verdict: string | null; briefAt: string | null; confirm: { y10_5d: number | null; dxy_5d: number | null; wti_5d: number | null; own_5d: number | null }; actions: Record<TrackId, string[]> }
export interface Ledger { version: 1; spec: string; startDate: string; capital: number; tracks: Record<TrackId, TrackState>; days: DayLog[]; lastDate: string | null }

export const LEADER_SIDE: Record<string, 1 | -1 | null> = { hawkish: -1, risk_off: -1, melt_up: 1, base: null };
const r2 = (x: number) => Math.round(x * 100) / 100, r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const emptyTrack = (): TrackState => ({ pos: null, pending: null, pendingExit: null, realized: 0, trades: [], daily: [] });
export const newLedger = (startDate: string): Ledger => ({ version: 1, spec: "docs/SHADOW_TRACKS.md", startDate, capital: SHADOW.capital, tracks: { A: emptyTrack(), B: emptyTrack() }, days: [], lastDate: null });

/** confirmations (tradeplan.ts L166-194 as translated in signal_engine.py): pressure-up (yields, USD, oil rising) agrees with shorts */
export function confirmations(side: 1 | -1, d: { y10_5d: number | null; dxy_5d: number | null; wti_5d: number | null; own_5d: number | null }): boolean[] {
  const want = side === -1 ? 1 : -1, E = SHADOW.eps;
  const agree = (x: number | null, eps: number) => x != null && Math.abs(x) >= eps && Math.sign(x) === want;
  return [agree(d.y10_5d, E.y10bp), agree(d.dxy_5d, E.dxyPct), agree(d.wti_5d, E.wtiPct), d.own_5d != null && Math.abs(d.own_5d) >= E.ownPct && (d.own_5d > 0) === (side === 1)];
}
export function sma(bars: Bar[], k: number, n: number): number | null {
  if (k + 1 < n) return null; let s = 0; for (let i = k - n + 1; i <= k; i++) s += bars[i]!.c; return s / n;
}
/** 48h event gate (risk.ts upcomingHighImpact as used in v2): blocked if a FOMC/CPI/NFP time lies in [entry 09:30 ET, +48h] */
export function eventBlock(entryDate: string, events: ShadowEvent[]): ShadowEvent | null {
  const lo = Date.parse(etToIso(entryDate, "09:30")), hi = lo + SHADOW.eventHours * 3600_000;
  return events.filter((e) => !e.series || (SHADOW.eventSeries as readonly string[]).includes(e.series)).find((e) => Date.parse(e.at) >= lo && Date.parse(e.at) <= hi) ?? null;
}
/** signal at close of bars[k] for a track (no position, nothing pending). Returns the pending entry or the reason it was skipped. */
export function evaluateSignal(track: TrackId, bars: Bar[], k: number, day: DayInput): { entry: { side: 1 | -1; stop: number; weight: number } | null; why: string } {
  const sd = day.leader ? LEADER_SIDE[day.leader] ?? null : null;
  if (day.leader === undefined || day.leader === null && !day.briefAt) return { entry: null, why: "无当日收盘后简报（领先情景缺）→ 不开新仓" };
  if (sd == null) return { entry: null, why: `领先情景 ${day.leader ?? "无（并列）"} → SPY 无方向` };
  if (track === "A" && sd === -1) return { entry: null, why: `领先情景 ${day.leader}（↓）→ A 只做多` };
  const b = bars[k]!, prev = bars[k - 1];
  if (!prev) return { entry: null, why: "没有前一日 K 线" };
  if (track === "B" && sd === -1) { const m = sma(bars, k, SHADOW.sma); if (m == null || !(b.c < m)) return { entry: null, why: m == null ? "200 日均线数据不足 → 不做空" : `SPY ${r2(b.c)} ≥ 200 日均线 ${r2(m)} → 不做空（B 的附加条件）` }; }
  const own5 = k >= 5 ? (b.c / bars[k - 5]!.c - 1) * 100 : null;
  const f = confirmations(sd, { ...day, own_5d: own5 }), n = f.filter(Boolean).length;
  if (n < SHADOW.minConfirm) return { entry: null, why: `确认 ${n}/4 < 3（10Y/DXY/WTI/自身 5 日：${f.map((x) => (x ? "✓" : "✗")).join("")}）` };
  const trig = sd === 1 ? b.c > prev.h : b.c < prev.l;
  if (!trig) return { entry: null, why: `确认 ${n}/4，但收盘 ${r2(b.c)} 未${sd === 1 ? `站上前日高点 ${r2(prev.h)}` : `跌破前日低点 ${r2(prev.l)}`}` };
  const stop = sd === 1 ? prev.l : prev.h, risk = Math.abs(b.c - stop);
  if (!(risk > 0)) return { entry: null, why: "风险距离为 0" };
  const weight = Math.min(1, (SHADOW.riskUsd / risk) * b.c / SHADOW.capital);
  return { entry: { side: sd, stop, weight }, why: `${sd === 1 ? "做多" : "做空"}信号：确认 ${n}/4，收盘 ${r2(b.c)} ${sd === 1 ? ">" : "<"} 前日${sd === 1 ? "高" : "低"} ${r2(sd === 1 ? prev.h : prev.l)}，止损 ${r2(stop)}，权重 ${r4(weight)} → 下一交易日开盘成交（事件闸门在成交日检查）` };
}

/** process every final bar after ledger.lastDate (bars sorted ascending; `days` = leader/confirmation snapshot per date) */
export function processBars(L: Ledger, bars: Bar[], days: Record<string, DayInput>, events: ShadowEvent[]): string[] {
  const out: string[] = [], cost = SHADOW.costBp / 1e4;
  for (let k = 0; k < bars.length; k++) {
    const b = bars[k]!;
    if (b.t < L.startDate || (L.lastDate && b.t <= L.lastDate)) continue;
    const day = days[b.t] ?? { date: b.t, leader: undefined, y10_5d: null, dxy_5d: null, wti_5d: null };
    const m200 = sma(bars, k, SHADOW.sma), own5 = k >= 5 ? (b.c / bars[k - 5]!.c - 1) * 100 : null;
    const log: DayLog = { date: b.t, spy: { ...b, sma200: m200 != null ? r2(m200) : null }, leader: day.leader ?? null, verdict: day.verdict ?? null, briefAt: day.briefAt ?? null,
      confirm: { y10_5d: day.y10_5d, dxy_5d: day.dxy_5d, wti_5d: day.wti_5d, own_5d: own5 != null ? r4(own5) : null }, actions: { A: [], B: [] } };
    for (const id of ["A", "B"] as TrackId[]) {
      const T = L.tracks[id], act = log.actions[id];
      // 1) exits signalled at the previous close fill at this open
      if (T.pendingExit && T.pos) {
        const p = T.pos, fill = b.o * (1 - p.side * cost), exitCost = p.shares * b.o * cost;
        const pnl = r2(p.side * p.shares * (fill - p.entryFill));
        T.trades.push({ track: id, side: p.side, signalDate: p.signalDate, entryDate: p.entryDate, entryFill: r4(p.entryFill), exitSignalDate: T.pendingExit.signalDate, exitDate: b.t, exitFill: r4(fill), shares: r4(p.shares), reason: T.pendingExit.reason, pnl, costs: r2(p.entryCost + exitCost) });
        T.realized = r2(T.realized + pnl); act.push(`平仓 @${r2(fill)}（${T.pendingExit.reason === "stop" ? "止损" : "10 日时间止损"}）P&L $${pnl}`);
        T.pos = null; T.pendingExit = null;
      }
      // 2) entries signalled at the previous close fill at this open unless an event is within 48h of it
      if (T.pending) {
        const blk = eventBlock(b.t, events), P = T.pending; T.pending = null;
        if (blk) act.push(`信号 ${P.signalDate} 未成交：${blk.title} 在开盘后 48 小时内（事件闸门）`);
        else {
          const fill = b.o * (1 + P.side * cost), shares = P.weight * SHADOW.capital / b.o;
          T.pos = { side: P.side, shares, entryDate: b.t, entryFill: fill, stop: P.stop, held: 0, signalDate: P.signalDate, weight: P.weight, entryCost: shares * b.o * cost };
          act.push(`${P.side === 1 ? "买入" : "卖空"} ${r4(shares)} 股 @${r2(fill)}（含 ${SHADOW.costBp}bp），止损 ${r2(P.stop)}`);
        }
      }
      // 3) this close: stop / time stop for an open position, else a new signal (not on the bar that signalled an exit)
      if (T.pos) {
        const p = T.pos; p.held += 1;
        const hit = p.side === 1 ? b.c < p.stop : b.c > p.stop;
        if (hit || p.held >= SHADOW.timeStopBars) { T.pendingExit = { reason: hit ? "stop" : "time_stop", signalDate: b.t }; act.push(`${hit ? `收盘 ${r2(b.c)} 越过止损 ${r2(p.stop)}` : `持有 ${p.held} 日`} → 下一交易日开盘平仓`); }
        else act.push(`持仓第 ${p.held} 日`);
      } else {
        const s = evaluateSignal(id, bars, k, day);
        if (s.entry) T.pending = { ...s.entry, signalDate: b.t };
        act.push(s.why);
      }
      // 4) mark to market at the close
      const open = T.pos ? T.pos.side * T.pos.shares * (b.c - T.pos.entryFill) : 0;
      T.daily.push({ date: b.t, equity: r2(SHADOW.capital + T.realized + open) });
    }
    L.days.push(log); L.lastDate = b.t;
    out.push(`${b.t} SPY ${r2(b.c)}（200 日均线 ${log.spy.sma200 ?? "缺"}）· 领先情景 ${log.leader ?? "缺"}${log.verdict ? ` · 简报 ${log.verdict}（只记录）` : ""}`, ...(["A", "B"] as TrackId[]).map((id) => `  ${id}: ${log.actions[id].join("；")} · 权益 $${L.tracks[id].daily.at(-1)!.equity}`));
  }
  return out;
}

// ---------- report ----------
export interface TrackStats { equity: number; ret: number; trades: number; winRate: number | null; expectancy: number | null; tStat: number | null; maxDD: number; open: string | null }
export function trackStats(T: TrackState): TrackStats {
  const p = T.trades.map((x) => x.pnl), n = p.length, mean = n ? p.reduce((s, x) => s + x, 0) / n : null;
  const sd = n > 1 ? Math.sqrt(p.reduce((s, x) => s + (x - mean!) ** 2, 0) / (n - 1)) : null;
  let peak: number = SHADOW.capital, dd = 0; for (const d of T.daily) { peak = Math.max(peak, d.equity); dd = Math.min(dd, d.equity / peak - 1); }
  const eq = T.daily.at(-1)?.equity ?? SHADOW.capital;
  return { equity: eq, ret: r2((eq / SHADOW.capital - 1) * 100), trades: n, winRate: n ? r2(p.filter((x) => x > 0).length / n * 100) : null, expectancy: mean != null ? r2(mean) : null,
    tStat: sd && sd > 0 ? r2(mean! / (sd / Math.sqrt(n))) : null, maxDD: r2(dd * 100),
    open: T.pos ? `${T.pos.side === 1 ? "多" : "空"} ${r4(T.pos.shares)} 股 @${r2(T.pos.entryFill)} 止损 ${r2(T.pos.stop)} 第 ${T.pos.held} 日` : T.pending ? `待成交（信号 ${T.pending.signalDate}）` : null };
}
export function buyHold(L: Ledger): { ret: number; maxDD: number; equity: number } | null {
  const d = L.days; if (!d.length) return null;
  const c0 = d[0]!.spy.c; let peak = c0, dd = 0; for (const x of d) { peak = Math.max(peak, x.spy.c); dd = Math.min(dd, x.spy.c / peak - 1); }
  const last = d.at(-1)!.spy.c; return { ret: r2((last / c0 - 1) * 100), maxDD: r2(dd * 100), equity: r2(SHADOW.capital * last / c0) };
}
export function shadowReport(L: Ledger): string[] {
  const bh = buyHold(L), fmt = (x: number | null, s = "") => (x == null ? "—" : `${x}${s}`);
  const row = (name: string, s: TrackStats) => `| ${name} | $${s.equity} | ${s.ret}% | ${s.trades} | ${fmt(s.winRate, "%")} | ${s.expectancy == null ? "—" : `$${s.expectancy}`} | ${fmt(s.tStat)} | ${s.maxDD}% | ${s.open ?? "空仓"} |`;
  return [`_影子跟踪（向前样本外，虚拟 $${SHADOW.capital}/轨道，${SHADOW.costBp}bp/边）。起点 ${L.startDate} 收盘 · 最新 ${L.lastDate ?? "—"}（${L.days.length} 个交易日）。只做观察：不计入准备度、上限、七宗罪；规则见 docs/SHADOW_TRACKS.md。_`,
    "| 轨道 | 权益 | 收益 | 交易 | 胜率 | 期望值/笔 | t 值 | 最大回撤 | 当前 |", "|---|---|---|---|---|---|---|---|---|",
    row("A：SPY 只做多 + 宏观 + 48h 事件闸门（v2a）", trackStats(L.tracks.A)), row("B：多空 + 宏观 + 48h 事件闸门 + 200 日均线下才做空（v2b+）", trackStats(L.tracks.B)),
    `| SPY 买入持有（价格，不含股息） | ${bh ? `$${bh.equity}` : "—"} | ${bh ? `${bh.ret}%` : "—"} | | | | | ${bh ? `${bh.maxDD}%` : "—"} | |`,
    ...(L.tracks.A.trades.length + L.tracks.B.trades.length < 30 ? [`- 样本太少（${L.tracks.A.trades.length + L.tracks.B.trades.length} 笔）：结论至少要等 30 笔以上；回测的 t 值 A 1.46 / B 0.05。`] : [])];
}
