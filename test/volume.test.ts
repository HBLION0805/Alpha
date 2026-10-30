import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stockVolume, optionAnomalies, buildVolumeReport, volumeAlarmItems, TAG, type Bar } from "../src/macro/volume.ts";
import { premarketAlarmAlerts } from "../src/alerts.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { parseChain, type Chain } from "../src/options/chain.ts";

const bars = (n: number, lastV: number, lastC: number): Bar[] => Array.from({ length: n }, (_, i) => ({ t: `2026-09-${String(i + 1).padStart(2, "0")}`, c: 100, h: 101, l: 99, v: 1e6 })).map((b, i, a) => (i === a.length - 1 ? { ...b, c: lastC, h: Math.max(lastC, 101), l: Math.min(lastC, 99), v: lastV } : b));

test("relative volume and 20-day break verdicts", () => {
  const s = stockVolume("SMH", bars(25, 3.5e6, 103))!; assert.equal(s.rvol, 3.5); assert.equal(s.breakout, "high"); assert.ok(s.strong); assert.match(s.verdict, /确认/);
  const w = stockVolume("X", bars(25, 0.5e6, 103))!; assert.match(w.verdict, /可疑/); assert.ok(!w.strong);
  const n = stockVolume("Y", bars(25, 2.5e6, 100))!; assert.equal(n.breakout, null); assert.match(n.verdict, /排查/);
  assert.equal(stockVolume("Z", bars(10, 1, 1)), null);
});
test("option anomalies, P/C ratio, strong ≥5x", () => {
  const ch: Chain = { symbol: "SPY", underlyingPrice: 600, asOf: "2026-10-14T20:00:00Z", contracts: [
    { expiration: "2026-10-16", strike: 600, type: "put", bid: 1, ask: 1.1, mark: 1.05, iv: 0.2, delta: -0.5, gamma: 0, theta: 0, vega: 0, volume: 6000, openInterest: 1000 },
    { expiration: "2026-10-16", strike: 610, type: "call", bid: 1, ask: 1.1, mark: 1.05, iv: 0.2, delta: 0.3, gamma: 0, theta: 0, vega: 0, volume: 3000, openInterest: 2500 },
    { expiration: "2026-11-20", strike: 650, type: "call", bid: 1, ask: 1.1, mark: 1.05, iv: 0.2, delta: 0.1, gamma: 0, theta: 0, vega: 0, volume: 100, openInterest: 0 } ] };
  const o = optionAnomalies(ch);
  assert.equal(o.anomalies.length, 2); assert.equal(o.pcr, 1.94); assert.equal(o.anomalies[0]!.dte, 2);
  assert.ok(o.anomalies[0]!.strong); assert.ok(!o.anomalies[1]!.strong);
});
test("report: every flagged line carries the tag; strong anomalies → alerts at 60", () => {
  const r = buildVolumeReport({ now: new Date("2026-10-14T20:30:00Z"), bars: { SMH: bars(25, 3.5e6, 103), TLT: bars(25, 1e6, 100) }, chains: [parseChain(JSON.parse(readFileSync(new URL("./fixtures/spy-chain-robinhood-2026-10-14.json", import.meta.url), "utf8")))] });
  for (const l of r.md.split("\n").filter((x) => /^- /.test(x))) assert.ok(l.includes(TAG), l);
  assert.match(r.md, /Put\/Call 成交量比/); assert.match(r.md, /方向（买\/卖）无法推断|无成交量 > OI/);
  assert.ok(r.strong.some((s) => /SMH/.test(s.title)));
  const items = volumeAlarmItems(r.strong, new Date()).map((x, i) => ({ ...x, id: i + 1 }));
  const a = premarketAlarmAlerts(items, { priorAlertScore: () => null }, 60);
  assert.equal(a[0]!.alert.score, 60); assert.deepEqual(a[0]!.alert.topics, ["volume"]);
  assert.equal(premarketAlarmAlerts(items, { priorAlertScore: () => null }, 61).length, 0);
});
test("premarket shows prior-session volume lines", () => {
  const pm = buildPremarket({ now: new Date(), data: {}, volumeLines: ["- 🚨 **SMH** RVOL 3.5x _（成交量仅用于确认/排查，不单独下单）_"] });
  assert.match(pm.md, /前一交易日成交量异常[\s\S]*SMH RVOL|前一交易日成交量异常[\s\S]*\*\*SMH\*\*/);
});
test("catalog has the DK volume item", () => {
  const cat = JSON.parse(readFileSync(new URL("../knowledge/catalog.json", import.meta.url), "utf8")) as { items: Array<{ id: string; principle: string }> };
  assert.match(cat.items.find((i) => i.id === "volume-confirmation")!.principle, /DK's addition/);
});
