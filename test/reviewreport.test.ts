import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReview } from "../src/options/reviewreport.ts";
test("review report: summary (sim vs real, breaches, repeated tags, pending reviews) + per-trade cards", () => {
  const base = { mode: "paper", kind: "practice", view: {}, greeks: {}, exitRules: [], invalidation: "n/a", legs: [{ type: "put", strike: 55, qty: 1, premium: 0.17, expiration: "2026-10-16" }] };
  const md = renderReview([
    { ...base, id: "a", symbol: "CRWV", strategy: "pds", source: "real_practice", openedAt: "2026-10-14T19:38:00Z", closedAt: "2026-10-16T20:05:00Z", pnl: -12, exitKind: "expiry", entryPrice: 0.12, entryPriceSource: "robinhood_orders", lossReview: { at: "x", errorClass: "execution", errorTags: ["no_pre_set_take_profit"] } },
    { ...base, id: "b", symbol: "AAPL", strategy: "pds", source: "real_practice", openedAt: "2026-10-13T19:21:00Z", closedAt: "2026-10-15T19:12:00Z", pnl: -31, violations: ["exceeds_1pct_cap_at_5000"], lossReview: { at: "x", errorClass: "execution", errorTags: ["no_pre_set_take_profit"] } },
    { ...base, id: "c", symbol: "NVDA", strategy: "cds", source: "mentor_shadow", openedAt: "2026-10-15T14:35:00Z", entryPrice: 1.6, marks: [{ at: "x", value: 168, pnl: 8, spot: 217, sources: [], estimated: false }], violations: ["exceeds_1pct_cap"] },
  ] as never, 5000, "2026-10-13", "2026-10-16");
  assert.match(md, /真实账户练习单已实现：\$-43/);
  assert.match(md, /未实现 \$8/);
  assert.match(md, /重复错误：no_pre_set_take_profit×2/);
  assert.match(md, /超限：2 笔/);
  assert.match(md, /### CRWV pds · 真实账户练习/);
  assert.match(md, /大佬实际：未记录/);
});
