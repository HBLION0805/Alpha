import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCard, perContractLoss, priceLegs, suggestVerticals, dailyBudget, type Quote, type CardInput } from "../src/review/card.ts";

const EXP = "2026-10-23";
const q = (type: "call" | "put", strike: number, bid: number, ask: number): Quote => ({ type, strike, expiration: EXP, bid, ask, src: "test" });
const QUOTES = [q("put", 100, 3.0, 3.2), q("put", 99, 2.4, 2.6), q("put", 98, 2.0, 2.2), q("put", 97, 1.7, 1.9), q("put", 95, 1.0, 1.2)];
const NOW = new Date("2026-10-15T14:00:00Z");
const base = (o: Partial<CardInput> = {}): CardInput => ({ now: NOW, sym: "XYZ", dir: "bear", exp: EXP, spot: 100, bars: [], levels: null, quotes: QUOTES,
  brief: { generatedAt: NOW.toISOString(), leader: null, verdict: "TRADE", plan: [] }, gex: null, calendar: [], earnings: [], journal: [], capital: 5000,
  thesis: "因为 X 所以 Y", ...o });

test("perContractLoss: debit put spread = net debit × 100", () => {
  assert.equal(perContractLoss(priceLegs([{ qty: 1, type: "put", strike: 100 }, { qty: -1, type: "put", strike: 98 }], EXP, QUOTES)), 100);
});
test("perContractLoss: missing quote → null (never filled)", () => {
  assert.equal(perContractLoss(priceLegs([{ qty: 1, type: "put", strike: 101 }, { qty: -1, type: "put", strike: 98 }], EXP, QUOTES)), null);
});
test("suggestVerticals respects budget", () => {
  const s = suggestVerticals("bear", 100, EXP, QUOTES, 50);
  assert.ok(s.length > 0); for (const x of s) assert.ok(x.loss <= 50);
  assert.equal(suggestVerticals("bear", 100, EXP, QUOTES, 10).length, 0);
});
test("dailyBudget: empty journal → full $100", () => assert.deepEqual(dailyBudget([], 5000, NOW), { used: 0, remaining: 100 }));
test("naked short → hedge fail → 不做", () => {
  const c = buildCard(base({ legs: [{ qty: -1, type: "put", strike: 95 }] }));
  assert.equal(c.verdict, "no"); assert.equal(c.sections.find((s) => s.n === 3)!.status, "fail");
});
test("over budget spread → 不做", () => {
  const c = buildCard(base({ legs: [{ qty: 1, type: "put", strike: 100 }, { qty: -1, type: "put", strike: 95 }] }));
  assert.equal(c.verdict, "no"); assert.ok(c.failing.some((f) => f.includes("最大亏损")));
});
test("not in plan → at best 仅练习", () => {
  const c = buildCard(base({ legs: [{ qty: 1, type: "put", strike: 100 }, { qty: -1, type: "put", strike: 99 }] }));
  assert.notEqual(c.verdict, "formal");
});
test("missing quotes → not formal, marked missing", () => {
  const c = buildCard(base({ quotes: [], legs: [{ qty: 1, type: "put", strike: 100 }, { qty: -1, type: "put", strike: 99 }] }));
  assert.equal(c.verdict, "no"); assert.equal(c.sections.find((s) => s.n === 6)!.status, "missing");
});
test("earnings inside expiry → risk item; fed blackout shown", () => {
  const c = buildCard(base({ legs: [{ qty: 1, type: "put", strike: 100 }, { qty: -1, type: "put", strike: 99 }],
    earningsNext: { symbol: "XYZ", date: "2026-10-20", timing: "am", confirmed: false, source: "t" },
    fed: { fetchedAt: "t", speeches: [], blackouts: [{ meetingStart: "2026-10-27", meetingEnd: "2026-10-28", from: "2026-10-17", to: "2026-10-29" }] } }));
  const s7 = c.sections.find((s) => s.n === 7)!, s8 = c.sections.find((s) => s.n === 8)!;
  assert.equal(s7.status, "warn"); assert.ok(s7.lines.some((l) => /预估（未确认）.*在到期前/.test(l))); assert.ok(s7.lines.some((l) => /静默期 2026-10-17/.test(l)));
  assert.ok(s8.lines.some((l) => /财报.*在到期前/.test(l)));
});
