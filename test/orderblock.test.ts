import { test } from "node:test";
import assert from "node:assert/strict";
import { occSymbol, cardOrderBlock, renderOrderBlock, reservedRiskUsd } from "../src/review/orderBlock.ts";
import { dailyBudget } from "../src/review/card.ts";

const leg = (qty: number, type: "call" | "put", strike: number, mid: number | null) => ({ type, strike, qty, expiration: "2026-11-20", bid: null, ask: null, mid, src: "test" });

test("OCC symbol (Alpaca options format)", () => {
  assert.equal(occSymbol("mrvl", "2026-11-20", "call", 247.5), "MRVL261120C00247500");
  assert.equal(occSymbol("SPY", "2026-11-06", "put", 700), "SPY261106P00700000");
});

test("card order block: debit spread → mleg limit at net mid, client_order_id = card id; single leg → simple; missing quote → reason", () => {
  const b = cardOrderBlock({ id: "C20261029-MRVL", sym: "MRVL", trade: { contracts: 1, legs: [leg(1, "call", 247.5, 0.9), leg(-1, "call", 250, 0.47)] } });
  assert.ok(!("reason" in b));
  assert.deepEqual(b.body, { qty: "1", type: "limit", time_in_force: "day", limit_price: "0.43", client_order_id: "card-C20261029-MRVL", order_class: "mleg",
    legs: [{ symbol: "MRVL261120C00247500", side: "buy", position_intent: "buy_to_open", ratio_qty: "1" }, { symbol: "MRVL261120C00250000", side: "sell", position_intent: "sell_to_open", ratio_qty: "1" }] });
  assert.match(b.endpoint, /paper-api\.alpaca\.markets/);
  assert.match(renderOrderBlock(b).join("\n"), /```json[\s\S]*"order_class": "mleg"/);
  const one = cardOrderBlock({ id: "X", sym: "QQQ", trade: { contracts: 2, legs: [leg(1, "put", 690, 3.1)] } });
  assert.ok(!("reason" in one)); assert.equal(one.body.symbol, "QQQ261120P00690000"); assert.equal(one.body.qty, "2"); assert.equal(one.body.order_class, undefined);
  assert.ok("reason" in cardOrderBlock({ id: "Y", sym: "QQQ", trade: { contracts: 1, legs: [leg(1, "put", 690, null)] } }));
  assert.ok("reason" in cardOrderBlock({ id: "Z", sym: "QQQ", trade: { contracts: 0, legs: [leg(1, "put", 690, 1)] } }));
});

test("risk reservation: today's saved, unopened cards hold their max loss against the new-risk cap", () => {
  const now = new Date("2026-10-30T15:00:00Z");
  const cards = [
    { id: "A", createdAt: "2026-10-30T13:50:00Z", verdict: "practice", trade: { maxLoss: 45 } },
    { id: "B", createdAt: "2026-10-30T14:00:00Z", verdict: "formal", trade: { maxLoss: 80 } }, // opened below → released
    { id: "C", createdAt: "2026-10-29T17:00:00Z", verdict: "formal", trade: { maxLoss: 50 } }, // yesterday → expired
    { id: "D", createdAt: "2026-10-30T14:10:00Z", verdict: "no", trade: { maxLoss: 99 } },
  ];
  const r = reservedRiskUsd(cards, [{ cardId: "B" }], now);
  assert.deepEqual(r, { usd: 45, ids: ["A"] });
  assert.equal(reservedRiskUsd(cards, [{ cardId: "B" }], now, "A").usd, 0, "re-rendering the same card doesn't reserve against itself");
  const b0 = dailyBudget([], 5000, now), b1 = dailyBudget([], 5000, now, undefined, r.usd);
  assert.equal(b0.newRiskRemaining, 500); assert.equal(b1.newRiskRemaining, 455); assert.equal(b1.newRisk, 45);
});

test("re-saving a card (review #27): excludeId drops the superseded card's own reservation", () => {
  const now = new Date("2026-10-30T15:00:00Z"), cards = [{ id: "OLD", createdAt: "2026-10-30T14:00:00Z", verdict: "formal", trade: { maxLoss: 90 } }, { id: "OTHER", createdAt: "2026-10-30T14:05:00Z", verdict: "formal", trade: { maxLoss: 40 } }];
  assert.equal(reservedRiskUsd(cards, [], now).usd, 130);
  assert.deepEqual(reservedRiskUsd(cards, [], now, "OLD"), { usd: 40, ids: ["OTHER"] });
});
