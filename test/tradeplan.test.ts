import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTradePlan, PLAN_RULE } from "../src/macro/tradeplan.ts";
import type { Obs } from "../src/macro/fetch.ts";
import type { RefLevels } from "../src/levels.ts";

const ser = (a: number, b: number): Obs[] => Array.from({ length: 10 }, (_, i) => ({ t: `2026-10-0${i}`, v: a + ((b - a) * i) / 9 }));
const lv = (h: number, l: number) => ({ last: (h + l) / 2, asOf: "2026-10-14", priorDay: { h, l, c: (h + l) / 2, date: "2026-10-14" }, week: null, priorWeek: null, sma: { ma20: null, ma50: null, ma200: null }, pivots: [], fib: null }) as RefLevels;
const levels = { SPY: lv(600, 590), QQQ: lv(520, 510), IWM: lv(250, 245), TLT: lv(88, 86) };
const hawkData = { UST10Y: ser(4.3, 4.5), DXY: ser(98, 100), WTI: ser(85, 94) };

test("trade plan: hawkish + confirming bonds/USD/oil/flows → defined-risk short candidates with trigger, zone, stop, ≤1% size", () => {
  const p = buildTradePlan({ leader: "hawkish", verdict: "RESEARCH_OK", noTrade: [], levels, data: hawkData, bars5d: { SPY: -2, QQQ: -3, IWM: -4, TLT: -2 }, capital: 50000 });
  assert.equal(p.qualified.length, 4);
  const iwm = p.qualified.find((c) => c.ticker === "IWM")!;
  assert.equal(iwm.side, "short"); assert.match(iwm.structure, /put debit spread/);
  assert.match(iwm.trigger, /跌破前日低点 245/); assert.deepEqual(iwm.entryZone, [244.26, 245]);
  assert.match(iwm.stop, /250/); assert.match(iwm.size, /\$500/);
  assert.equal(iwm.confirm.score, 4);
  const md = p.lines.join("\n");
  assert.ok(md.startsWith(PLAN_RULE)); assert.match(md, /只允许执行这里事先写好的触发条件/); assert.match(md, /明确不做的情况/);
});

test("trade plan: weak confirmation or no leader → NO_TRADE with the reason; NO_TRADE verdict gates candidates", () => {
  const weak = buildTradePlan({ leader: "hawkish", verdict: "RESEARCH_OK", noTrade: [], levels, data: { UST10Y: ser(4.5, 4.3), DXY: ser(100, 98), WTI: ser(94, 85) }, bars5d: { SPY: 1, QQQ: 1, IWM: 1, TLT: 1 } });
  assert.equal(weak.qualified.length, 0);
  assert.match(weak.lines.join("\n"), /NO_TRADE：领先情景.*没有候选通过趋势确认/);
  assert.match(weak.lines.join("\n"), /趋势确认只有 0\/4/);
  const none = buildTradePlan({ leader: null, verdict: "NO_TRADE", noTrade: ["48h 内 PPI"], levels, data: hawkData, bars5d: {} });
  assert.equal(none.candidates.length, 0);
  assert.match(none.lines.join("\n"), /没有单一领先情景/);
  const gated = buildTradePlan({ leader: "hawkish", verdict: "NO_TRADE", noTrade: ["48h 内 PPI"], levels, data: hawkData, bars5d: { SPY: -2, QQQ: -3, IWM: -4, TLT: -2 } });
  assert.match(gated.lines.join("\n"), /当前结论 NO_TRADE。.*条件全部解除后才有效[\s\S]*48h 内 PPI/);
  const nolv = buildTradePlan({ leader: "hawkish", verdict: "RESEARCH_OK", noTrade: [], levels: {}, data: hawkData, bars5d: {} });
  assert.ok(nolv.candidates.every((c) => !c.qualifies && /没有价位数据/.test(c.why!)));
});
