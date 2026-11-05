import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { buildPremarket, alarmItems, chg, PM_SERIES } from "../src/macro/premarket.ts";
import { premarketAlarmAlerts } from "../src/alerts.ts";
import type { Obs } from "../src/macro/fetch.ts";

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10));
const ser = (vals: number[]): Obs[] => days(vals.length).map((t, i) => ({ t, v: vals[i]! }));
const flat = (v: number, n = 30) => ser(Array(n).fill(v));
const ramp = (a: number, b: number, n = 30) => ser(Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));
const now = new Date("2026-10-15T11:30:00Z");

function base(): Record<string, Obs[]> {
  const d: Record<string, Obs[]> = {};
  for (const s of PM_SERIES) d[s.id] = flat(100);
  Object.assign(d, { UST2Y: flat(4.5), UST10Y: flat(4.8), UST30Y: flat(5), EFFR: flat(4.33), REAL10Y: flat(2.1), VIX: flat(15), VIX3M: flat(17), USDJPY: flat(150) });
  return d;
}

test("calm fixture: no alarms, two labeled parts, macro-first synthesis", () => {
  const r = buildPremarket({ now, data: base(), calendar: [], earnings: null, headlines: ["h1"] , regimeLabel: "GOLDILOCKS" });
  assert.equal(r.alarms.length, 0);
  assert.ok(r.md.indexOf("## 【大佬流程】") < r.md.indexOf("## 【DK 补充】"));
  assert.match(r.md, /以下为 DK 的补充，不是大佬原流程/);
  assert.match(r.md, /技术面（K线\/FIB）只用于择时/);
  assert.match(r.md, /GOLDILOCKS/);
  assert.match(r.md, /跳过/); // no earnings cache
});
test("alarms: carry unwind, HYG divergence, 10Y spike, VIX backwardation", () => {
  const d = base();
  d.USDJPY = ser([...Array(29).fill(150), 148.2]);            // −1.2% in a day
  d.UST10Y = ser([...Array(29).fill(4.8), 4.92]);             // +12bp
  d.SPX = ramp(95, 100); d.NDX = ramp(95, 100);                // at highs
  d.HYG = ser([...Array(25).fill(80), 80, 79.8, 79.6, 79.5, 79.4]); // 5d −0.75%
  d.RUT = ramp(100, 90);                                        // lagging
  d.VIX = flat(25); d.VIX3M = flat(22);
  const r = buildPremarket({ now, data: d });
  const kinds = r.alarms.map((a) => a.kind).sort();
  assert.deepEqual(kinds, ["CARRY_UNWIND", "HYG_DIVERGENCE", "UST10Y_SPIKE", "VIX_BACKWARDATION"]);
  assert.equal(r.alarms.find((a) => a.kind === "VIX_BACKWARDATION")!.by, "dk");
  assert.equal(r.alarms.find((a) => a.kind === "CARRY_UNWIND")!.by, "mentor");
  assert.match(r.md, /窄幅上涨/);
  assert.ok(r.noTrade.some((x) => /CARRY_UNWIND/.test(x)));
});
test("futures anxiety, Korea divergence, DXY confirmation, calendar NO_TRADE", () => {
  const d = base();
  d.ES = ser([...Array(29).fill(100), 101.6]); d.NQ = ser([...Array(29).fill(100), 102]); d.RTY = ser([...Array(29).fill(100), 101.2]);
  d.KOSPI = ser([...Array(29).fill(100), 97]); d.EWY = ser([...Array(29).fill(100), 98]); d.SMH = ser([...Array(29).fill(100), 101]); d.SOX = ser([...Array(29).fill(100), 101]);
  d.DXY = ser([...Array(29).fill(100), 100.6]); d.GOLD = ser([...Array(29).fill(100), 99]); d.BTC = ser([...Array(29).fill(100), 98]);
  const r = buildPremarket({ now, data: d, calendar: [{ kind: "CPI", title: "CPI (BLS)", date: "2026-10-15", timeEt: "08:30", source: "x" }] });
  assert.match(r.md, /大幅高开 → FOMO/); assert.match(r.md, /绝不裸卖/);
  assert.match(r.md, /背离/);
  assert.match(r.md, /跨资产确认: ✅/);
  assert.ok(r.noTrade.some((x) => /CPI 08:30/.test(x)));
  assert.ok(r.noTrade.some((x) => /期货跳空/.test(x)));
});
test("chg: bp for yields, % for prices; missing data shows n/a", () => {
  assert.equal(Math.round(chg("UST10Y", ser([4.8, 4.9]), 1)!), 10);
  assert.equal(chg("SPX", ser([100, 101]), 1)!.toFixed(2), "1.00");
  const r = buildPremarket({ now, data: {}, failed: { "HYG (yahoo:HYG)": "HTTP 429" } });
  assert.match(r.md, /n\/a/); assert.match(r.md, /数据失败[\s\S]*HTTP 429/);
});
test("alarms reach the 30-minute alert routine once", () => {
  const items = alarmItems([{ kind: "CARRY_UNWIND", level: "ALARM", title: "t", detail: "d", by: "mentor" }, { kind: "HYG_DIVERGENCE", level: "WARNING", title: "t2", detail: "d2", by: "mentor" }], now)
    .map((x, i) => ({ ...x, id: i + 1 }));
  let seen = new Set<number>();
  const store = { priorAlertScore: (ids: number[]) => (ids.some((i) => seen.has(i)) ? 85 : null) };
  const a = premarketAlarmAlerts(items, store, 60);
  assert.deepEqual(a.map((x) => x.alert.score), [85, 70]);
  assert.match(a[0]!.alert.headline, /ALARM CARRY_UNWIND/);
  seen = new Set([1, 2]);
  assert.equal(premarketAlarmAlerts(items, store, 60).length, 0);
  assert.equal(premarketAlarmAlerts(items, { priorAlertScore: () => null }, 80).length, 1);
  void DatabaseSync;
});
