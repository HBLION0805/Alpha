import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeLevels, parseBars, sma, swings, volumeProfile, roundNumbers, type Bar } from "../src/levels.ts";

const mk = (closes: number[], vol = 1000): Bar[] => closes.map((c, i) => ({ t: `2026-01-${String(i + 1).padStart(2, "0")}`, o: c, h: c + 1, l: c - 1, c, v: vol }));

test("sma and swings", () => {
  assert.equal(sma([1, 2, 3, 4], 2), 3.5);
  assert.equal(sma([1], 2), null);
  const s = swings(mk([10, 11, 12, 15, 12, 11, 10, 8, 5, 8, 10, 11]), 2);
  assert.deepEqual(s.map((x) => [x.kind, x.price]), [["swing_high", 16], ["swing_low", 4]]);
});

test("volume profile finds the heavy-traded node", () => {
  const bars = [...mk(Array(20).fill(100), 10_000), ...mk([90, 95, 105, 110], 100)];
  const vp = volumeProfile(bars, 20);
  assert.ok(vp.nodes.some((n) => Math.abs(n.price - 100) < 2));
});

test("round numbers scale with price", () => {
  assert.ok(roundNumbers(778).includes(800));
  assert.ok(roundNumbers(2650).includes(2750));
  assert.ok(roundNumbers(105_000).includes(110_000));
});

test("parses Robinhood MCP envelope and produces two-sided levels on real SPY bars", () => {
  const bars = parseBars(JSON.parse(readFileSync(new URL("./fixtures/spy-daily-robinhood.json", import.meta.url), "utf8")));
  assert.ok(bars.length > 250);
  const r = computeLevels(bars);
  assert.ok(r.ma.ma200 !== null);
  assert.ok(r.levels.some((l) => l.side === "support") && r.levels.some((l) => l.side === "resistance"));
  for (const l of r.levels) assert.ok(l.score >= 0 && l.score <= 100);
  const top = [...r.levels].sort((a, b) => b.score - a.score)[0]!;
  assert.ok(top.kinds.length >= 2, "strongest level should have confluence");
});

test("parseBars rejects garbage", () => {
  assert.throws(() => parseBars({ nope: 1 }));
});
