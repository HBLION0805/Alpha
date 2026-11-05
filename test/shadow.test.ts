import { test } from "node:test";
import assert from "node:assert/strict";
import { newLedger, processBars, evaluateSignal, eventBlock, confirmations, shadowReport, trackStats, buyHold, SHADOW, type Bar, type DayInput } from "../src/shadow/engine.ts";
import { weeklyReport } from "../src/options/weekly.ts";
import { readiness } from "../src/options/readiness.ts";

/** n weekday bars from 2025-06-02; close path from fn; open = previous close; high/low = close ± 0.5 */
function mk(n: number, fn: (i: number) => number): Bar[] {
  const out: Bar[] = []; let d = Date.parse("2025-06-02T00:00:00Z");
  for (let i = 0; i < n; i++) { while ([0, 6].includes(new Date(d).getUTCDay())) d += 864e5; const c = fn(i), o = i ? out[i - 1]!.c : c;
    out.push({ t: new Date(d).toISOString().slice(0, 10), o, h: Math.max(o, c) + 0.5, l: Math.min(o, c) - 0.5, c }); d += 864e5; }
  return out;
}
const LONG = { y10_5d: -5, dxy_5d: -0.5, wti_5d: -2 }, SHORT = { y10_5d: 5, dxy_5d: 0.5, wti_5d: 2 };
const day = (date: string, leader: string | null, conf = LONG): DayInput => ({ date, leader, verdict: "NO_TRADE", briefAt: `${date}T20:30:00Z`, ...conf });

test("confirmations: pressure-up agrees with shorts; eps from tradeplan.ts", () => {
  assert.deepEqual(confirmations(1, { ...LONG, own_5d: 1 }), [true, true, true, true]);
  assert.deepEqual(confirmations(-1, { ...LONG, own_5d: 1 }), [false, false, false, false]);
  assert.deepEqual(confirmations(-1, { y10_5d: 2.9, dxy_5d: 0.3, wti_5d: 1.5, own_5d: -0.5 }), [false, true, true, true]);
  assert.deepEqual(confirmations(1, { y10_5d: null, dxy_5d: null, wti_5d: null, own_5d: null }), [false, false, false, false]);
});
test("signal: A long-only; B shorts only below the 200-day SMA; ties/base/missing brief → no trade", () => {
  const up = mk(260, (i) => (i === 259 ? 100 + 0.1 * 258 + 2 : 100 + 0.1 * i)), k = 259;
  const a = evaluateSignal("A", up, k, day(up[k]!.t, "melt_up"));
  assert.ok(a.entry, a.why); assert.equal(a.entry!.side, 1); assert.equal(a.entry!.stop, up[k - 1]!.l);
  assert.equal(a.entry!.weight, Math.min(1, (50 / (up[k]!.c - up[k - 1]!.l)) * up[k]!.c / 5000));
  // falling close below the prior low but still far above the 200-day SMA (uptrend)
  const dip = mk(260, (i) => (i === 259 ? 100 + 0.1 * 258 - 2 : 100 + 0.1 * i));
  assert.match(evaluateSignal("A", dip, k, day(dip[k]!.t, "hawkish", SHORT)).why, /A 只做多/);
  assert.match(evaluateSignal("B", dip, k, day(dip[k]!.t, "hawkish", SHORT)).why, /≥ 200 日均线 .* 不做空/);
  // downtrend: SPY below its 200-day SMA → B may short (hawkish or risk_off alike — no leader filter added)
  const down = mk(260, (i) => (i === 259 ? 200 - 0.1 * 258 - 2 : 200 - 0.1 * i));
  for (const ld of ["hawkish", "risk_off"]) { const b = evaluateSignal("B", down, k, day(down[k]!.t, ld, SHORT)); assert.ok(b.entry, b.why); assert.equal(b.entry!.side, -1); assert.equal(b.entry!.stop, down[k - 1]!.h); }
  assert.match(evaluateSignal("B", mk(150, (i) => 200 - i), 149, day("2025-12-01", "hawkish", SHORT)).why, /200 日均线数据不足/);
  assert.match(evaluateSignal("A", up, k, day(up[k]!.t, "base")).why, /无方向/);
  assert.match(evaluateSignal("A", up, k, day(up[k]!.t, null)).why, /并列/);
  assert.match(evaluateSignal("A", up, k, { date: up[k]!.t, leader: undefined, y10_5d: null, dxy_5d: null, wti_5d: null }).why, /无当日收盘后简报/);
  assert.match(evaluateSignal("A", up, k, day(up[k]!.t, "melt_up", { y10_5d: 0, dxy_5d: 0, wti_5d: -2 })).why, /确认 2\/4 < 3/);
  assert.match(evaluateSignal("A", mk(260, (i) => 100 + 0.1 * i), k, day(up[k]!.t, "melt_up")).why, /未站上前日高点/);
});
test("lifecycle: next-open fill with 7bp, held counter, 10-day time stop, next-open exit; 48h event gate at the fill", () => {
  const bars = mk(275, (i) => (i < 259 ? 100 + 0.1 * i : i === 259 ? 100 + 0.1 * 258 + 2 : 100 + 0.1 * 258 + 2 + 0.05 * (i - 259)));
  const sig = bars[259]!.t, days = { [sig]: day(sig, "melt_up") };
  const L = newLedger(bars[258]!.t);
  processBars(L, bars, days, []);
  const A = L.tracks.A, t = A.trades[0]!;
  assert.equal(A.trades.length, 1); assert.equal(t.reason, "time_stop"); assert.equal(t.entryDate, bars[260]!.t);
  assert.equal(t.exitSignalDate, bars[269]!.t, "10th bar after the signal bar"); assert.equal(t.exitDate, bars[270]!.t);
  assert.ok(Math.abs(t.entryFill - bars[260]!.o * 1.0007) < 1e-3); assert.ok(Math.abs(t.exitFill - bars[270]!.o * 0.9993) < 1e-3);
  assert.ok(t.pnl > 0); assert.equal(L.tracks.B.trades.length, 1, "B takes the same long");
  assert.equal(A.daily.length, 275 - 258); assert.equal(A.daily.at(-1)!.equity, Math.round((5000 + t.pnl) * 100) / 100);
  // same signal, FOMC 26h after the entry open → not filled (exits are never gated)
  const L2 = newLedger(bars[258]!.t);
  processBars(L2, bars, days, [{ at: `${bars[261]!.t}T15:30:00Z`, title: "FOMC 利率决议", series: "FOMC" }]);
  assert.equal(L2.tracks.A.trades.length, 0); assert.match(L2.days.find((d) => d.date === bars[260]!.t)!.actions.A.join(), /事件闸门/);
  assert.equal(eventBlock(bars[260]!.t, [{ at: `${bars[263]!.t}T15:30:00Z`, title: "x", series: "CPI" }]), null, "> 48h");
  assert.equal(eventBlock("2026-11-09", [{ at: "2026-11-10T13:30:00Z", title: "CPI", series: "CPI" }])!.title, "CPI");
  assert.equal(eventBlock("2026-11-09", [{ at: "2026-11-10T13:30:00Z", title: "bailout", series: "OTHER" }]), null, "only FOMC/CPI/NFP");
});
test("stop: close below the prior-day low → exit next open at a loss", () => {
  const bars = mk(265, (i) => (i < 259 ? 100 + 0.1 * i : i === 259 ? 100 + 0.1 * 258 + 2 : i === 260 ? 100 + 0.1 * 258 + 2.2 : 100 + 0.1 * 258 - 1));
  const L = newLedger(bars[259]!.t); processBars(L, bars, { [bars[259]!.t]: day(bars[259]!.t, "melt_up") }, []);
  const t = L.tracks.A.trades[0]!; assert.equal(t.reason, "stop"); assert.equal(t.exitSignalDate, bars[261]!.t); assert.ok(t.pnl < 0);
  const s = trackStats(L.tracks.A); assert.equal(s.trades, 1); assert.equal(s.winRate, 0); assert.ok(s.maxDD < 0);
});
test("idempotent per trading day: re-running with the same bars changes nothing; new bars append in order", () => {
  const bars = mk(265, (i) => 100 + 0.1 * i), L = newLedger(bars[262]!.t);
  assert.equal(processBars(L, bars.slice(0, 263), {}, []).length, 3);
  const snap = JSON.stringify(L);
  assert.deepEqual(processBars(L, bars.slice(0, 263), {}, []), []); assert.equal(JSON.stringify(L), snap);
  assert.equal(processBars(L, bars, {}, []).length, 3 * 2); assert.equal(L.lastDate, bars[264]!.t); assert.equal(L.days.length, 3);
  assert.match(L.days[0]!.actions.A[0]!, /无当日收盘后简报/);
  const r = shadowReport(L).join("\n"); assert.match(r, /\| A：SPY 只做多/); assert.match(r, /SPY 买入持有/); assert.equal(buyHold(L)!.ret, Math.round((bars[264]!.c / bars[262]!.c - 1) * 1e4) / 100);
  const w = weeklyReport({ entries: [], capital: 5000, from: "2026-10-12", to: "2026-10-16", readiness: readiness({ journal: [], capital: 5000, shockDates: [] }), shadowLines: shadowReport(L) });
  assert.match(w.md, /八之五、影子跟踪/); assert.equal(SHADOW.costBp, 7);
});
