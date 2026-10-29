import { test } from "node:test";
import assert from "node:assert/strict";
import { paperGate, renderGate } from "../src/macro/paperGate.ts";
import { mentorSignals, renderMentorSignals } from "../src/macro/mentorSignals.ts";
import { buildDashboard, renderDashboard } from "../src/options/readinessDashboard.ts";
import { buildTradePlan } from "../src/macro/tradeplan.ts";
import type { Obs } from "../src/macro/fetch.ts";
import type { RefLevels } from "../src/levels.ts";

const ser = (a: number, b: number, n = 60): Obs[] => Array.from({ length: n }, (_, i) => ({ t: `d${String(i).padStart(3, "0")}`, v: a + ((b - a) * i) / (n - 1) }));
const lv = (h: number, l: number) => ({ last: (h + l) / 2, asOf: "x", priorDay: { h, l, c: (h + l) / 2, date: "x" }, week: null, priorWeek: null, sma: { ma20: null, ma50: null, ma200: null }, pivots: [], fib: null }) as RefLevels;
const levels = { SPY: lv(600, 590), QQQ: lv(520, 510), IWM: lv(250, 245), TLT: lv(88, 86) };
const bear = { NQ: ser(29500, 28800), WTI: ser(95, 102), VIX: ser(16, 22), GOLD: ser(4000, 4300) };

test("mentor signals: distances, VIX breakout, gold trend, bearish tilt", () => {
  const s = mentorSignals(bear);
  assert.ok(s.nq && !s.nq.above && Math.abs(s.nq.distPct - (28800 / 30000 - 1) * 100) < 1e-9);
  assert.ok(s.wti?.above); assert.ok(s.vix?.breakout && s.vix.aboveLevel && s.vix.above20dHigh);
  assert.equal(s.gold?.trend, "up"); assert.equal(s.tilt, "bearish");
  const md = renderMentorSignals(s).join("\n");
  assert.match(md, /导师的分析框架推导/); assert.match(md, /由 Alpha 撰写/);
});

test("paper gate: soft NO_TRADE reasons → still one $25 card with stop, TP, 4 scenarios and hedges", () => {
  const plan = buildTradePlan({ leader: "hawkish", verdict: "NO_TRADE", noTrade: ["信号冲突"], levels, data: bear, bars5d: { SPY: -1, QQQ: -1, IWM: -1, TLT: -1 }, capital: 5000 });
  const g = paperGate({ verdict: "NO_TRADE", reasons: ["信号冲突", "期货跳空 ≥1.5%"], leader: "hawkish", candidates: plan.candidates, levels, data: bear, signals: mentorSignals(bear), equity: 5000, lossToday: 0 });
  assert.equal(g.decision, "PAPER_TRADE"); assert.equal(g.card!.riskUsd, 25); assert.equal(g.card!.side, "short");
  assert.deepEqual(g.card!.scenarios.map((s) => s.id), ["big_drop", "slow_drop", "sideways", "rally"]);
  assert.ok(g.card!.scenarios.filter((s) => s.pnl < 0).every((s) => s.hedge));
  assert.ok(g.card!.scenarios.every((s) => s.pnl >= -25));
  assert.match(renderGate(g).join("\n"), /止损（入场即设）[\s\S]*止盈（入场即设）/);
});

test("paper gate: hard reasons → NO_TRADE (daily cap, extreme VIX, no direction)", () => {
  const sig = mentorSignals(bear);
  assert.equal(paperGate({ verdict: "OK", reasons: [], leader: "hawkish", candidates: [], levels, data: bear, signals: sig, equity: 5000, lossToday: 90 }).decision, "NO_TRADE");
  const hot = { ...bear, VIX: ser(20, 35) };
  assert.match(paperGate({ verdict: "OK", reasons: [], leader: null, candidates: [], levels, data: hot, signals: sig, equity: 5000, lossToday: 0 }).hardReasons.join(), /VIX/);
  const flat = { NQ: ser(30100, 30100), WTI: ser(90, 90), VIX: ser(21, 21) };
  const g = paperGate({ verdict: "OK", reasons: [], leader: null, candidates: [], levels, data: flat, signals: mentorSignals(flat), equity: 5000, lossToday: 0 });
  assert.equal(g.decision, "NO_TRADE"); assert.match(g.hardReasons.join(), /没有方向/);
  // no leader but a clear tilt → QQQ card at the lowest tier
  const t = paperGate({ verdict: "OK", reasons: [], leader: null, candidates: [], levels, data: bear, signals: sig, equity: 5000, lossToday: 0 });
  assert.equal(t.card?.ticker, "QQQ"); assert.equal(t.card?.riskUsd, 25);
});

test("readiness dashboard: count vs 30, top-trade dependence, cap breaches, discipline, error tallies", () => {
  const e = (id: string, pnl: number, day: string, x: object = {}) => ({ id, mode: "paper", kind: "formal", source: "paper_sim", openedAt: `${day}T14:00:00Z`, closedAt: `${day}T19:00:00Z`, pnl, symbol: "QQQ", thesis: "t", stop: "s", maxLoss: 25, ...x }) as never;
  const d = buildDashboard([e("a", 300, "2026-09-01"), e("b", -30, "2026-09-02", { thesis: "", stop: "" }), e("c", -120, "2026-09-03", { lossReview: { errorClass: "execution" } }), e("d", 10, "2026-09-04", { errorType: "logic" })], 5000, new Date("2026-10-22T12:00:00Z"));
  assert.equal(d.trades.simulated, 4); assert.ok(d.expectancy!.dependsOnTop);
  assert.equal(d.capBreaches.perTrade.length, 2); // own tier $25: b (−30) and c (−120) assert.equal(d.capBreaches.daily.length, 1);
  assert.deepEqual(d.discipline.missingThesis, ["b"]); assert.equal(d.errors.execution, 1); assert.equal(d.errors.judgment, 1);
  assert.equal(d.maxDrawdown, 150); assert.match(renderDashboard(d), /4 \/ 30/);
});

test("liveFirst: fresh quote replaces today's bar with a 实时 timestamp; stale quote / no quote → 过时 label, close kept", async () => {
  const { liveFirst } = await import("../src/macro/mentorSignals.ts");
  const d: Obs[] = [{ t: "2026-10-21", v: 16.68 }, { t: "2026-10-22", v: 18.24 }];
  const now = new Date("2026-10-22T18:05:00Z");
  const a = liveFirst(d, { price: 19.12, at: "2026-10-22T18:04:00Z" }, now);
  assert.equal(a.series.at(-1)!.v, 19.12); assert.equal(a.series.length, 2); assert.ok(a.stamp.live); assert.match(a.stamp.label, /实时 10-22 14:04 ET/);
  const b = liveFirst(d, { price: 19.12, at: "2026-10-22T16:00:00Z" }, now);
  assert.equal(b.series.at(-1)!.v, 18.24); assert.ok(!b.stamp.live); assert.match(b.stamp.label, /过时/);
  assert.match(liveFirst(d, null, now).stamp.label, /过时：日线收盘 2026-10-22/);
  assert.equal(liveFirst([{ t: "2026-10-21", v: 16.68 }], { price: 19, at: "2026-10-22T18:04:00Z" }, now).series.length, 2);
  const s = mentorSignals({ VIX: a.series, NQ: ser(29000, 29300) }, null, { vix: a.stamp });
  assert.match(renderMentorSignals(s).join("\n"), /19\.12（实时 10-22 14:04 ET）/);
});
