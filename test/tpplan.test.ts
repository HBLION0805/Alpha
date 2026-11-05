import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTakeProfit, checkTakeProfit, costBasis, TP_ALERT } from "../src/options/tpplan.ts";
import { paperOpen } from "../src/options/paper.ts";

test("take-profit plan: required, defaults by type, ≤14 DTE forces short_dated + close-by", () => {
  assert.match(buildTakeProfit(undefined, ["2026-12-18"], "2026-10-15").errors[0]!, /--tp/);
  assert.ok(buildTakeProfit("yolo", ["2026-12-18"], "2026-10-15").errors.length);
  const n = buildTakeProfit("narrative", ["2026-12-18"], "2026-10-15").plan!;
  assert.deepEqual(n.targets.map((t) => [t.gainPct, t.sellPct]), [[100, 50], [200, 25]]); assert.equal(n.closeBy, null);
  assert.match(n.source, /take-profit\.md/);
  assert.deepEqual(buildTakeProfit("windfall", ["2026-12-18"], "2026-10-15").plan!.targets.map((t) => t.sellPct), [90]);
  assert.match(buildTakeProfit("narrative", ["2026-10-23"], "2026-10-15").errors[0]!, /short_dated/);
  const s = buildTakeProfit("short_dated", ["2026-10-23"], "2026-10-15").plan!;
  assert.equal(s.targets[0]!.gainPct, 30); assert.ok(s.targets[0]!.sellPct >= 50); assert.equal(s.closeBy, "2026-10-22");
});

test("paper mark flags TP hits once, plus the close-by day", () => {
  const s = buildTakeProfit("short_dated", ["2026-10-23"], "2026-10-15").plan!;
  const basis = costBasis([{ type: "call", qty: 1, premium: 1.6 }, { type: "call", qty: -1, premium: 0 }])!;
  assert.equal(basis, 160);
  assert.deepEqual(checkTakeProfit(s, basis, 20, "2026-10-16"), []);
  const h = checkTakeProfit(s, basis, 60, "2026-10-16");
  assert.deepEqual(h.map((x) => x.gainPct), [30]); assert.ok(h[0]!.text.startsWith(TP_ALERT));
  assert.deepEqual(checkTakeProfit(s, basis, 90, "2026-10-16", [30]).map((x) => x.gainPct), [50]);
  assert.deepEqual(checkTakeProfit(s, basis, -10, "2026-10-22", [30, 50]).map((x) => x.gainPct), [-1]);
});

test("paper open refuses without --tp", () => {
  const r = paperOpen({ capital: 5000, entries: [] }, { symbol: "X", strategy: "long_call", legs: [{ type: "call", strike: 10, qty: 1, premium: 0.2, expiration: "2026-12-18" }], underlyingPrice: 10 } as never, { now: new Date("2026-10-15T14:00:00Z") });
  assert.ok(r.refused.some((x) => /--tp/.test(x)));
});

test("real_practice records are not open simulated positions (never marked, not in the position cap)", async () => {
  const { openPaper } = await import("../src/options/paper.ts");
  const j = { capital: 5000, entries: [{ id: "r", mode: "paper", kind: "practice", source: "real_practice" }, { id: "s", mode: "paper", kind: "practice", source: "mentor_shadow" }] } as never;
  assert.deepEqual(openPaper(j).map((e) => e.id), ["s"]);
});
