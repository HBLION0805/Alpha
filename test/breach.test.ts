import { test } from "node:test";
import assert from "node:assert/strict";
import { capFlags } from "../src/options/breach.ts";
const now = new Date("2026-10-16T18:00:00Z");
const e = (o: object) => ({ id: "x", symbol: "S", mode: "paper", maxLoss: 40, ...o }) as never;
const mk = (pnl: number) => [{ at: now.toISOString(), value: 0, pnl, spot: null, sources: [] }];
test("cap flags at $5k: $50/trade open loss, $100/day realized+unrealized, mentor max loss over cap", () => {
  assert.deepEqual(capFlags([e({ marks: mk(-30) })], 5000, now), []);
  const a = e({ marks: mk(-60) }); const f = capFlags([a], 5000, now);
  assert.match(f[0]!, /🚨 超限.*\$60/); assert.ok((a as { violations: string[] }).violations.includes("open_loss_over_cap"));
  const d = capFlags([e({ id: "c", closedAt: "2026-10-16T15:00:00Z", pnl: -45 }), e({ id: "o", marks: mk(-49) }), e({ id: "o2", marks: mk(-10) })], 5000, now);
  assert.ok(d.some((x) => /日亏上限/.test(x)));
  const m = e({ source: "mentor_shadow", maxLoss: 160, marks: mk(8) }); const g = capFlags([m], 5000, now);
  assert.match(g[0]!, /大佬影子单/); assert.ok((m as { violations: string[] }).violations.includes("exceeds_1pct_cap"));
  assert.deepEqual(capFlags([e({ source: "real_practice", closedAt: "2026-10-16T15:00:00Z", pnl: -200, maxLoss: 0 })], 5000, now), [], "real trades don't count toward the sim daily cap");
});
