import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseInput, issues, ProposalSchema, WatchlistSchema, CalendarFileSchema } from "../src/adapters/schemas.ts";
import { parseChain } from "../src/options/chain.ts";
import { parseEarnings } from "../src/options/events.ts";

test("zod inputs: bad data fails loudly with 'provide X'", () => {
  assert.throws(() => parseChain({ symbol: "SPY", contracts: [] }), /chain: provide underlyingPrice/);
  assert.throws(() => parseChain({ symbol: "SPY", underlyingPrice: 600, asOf: "x", contracts: [{ expiration: "2026-11-20", strike: "abc", type: "call" }] }), /provide contracts\.0\.strike/);
  const ok = parseChain({ symbol: "SPY", underlyingPrice: 600, asOf: "x", contracts: [{ expiration: "2026-11-20", strike: "600", type: "put", iv: null }] });
  assert.equal(ok.contracts[0]!.strike, 600); assert.equal(ok.contracts[0]!.bid, null);
  assert.ok(issues(ProposalSchema, { symbol: "SPY", strategy: "x", asOf: "d", underlyingPrice: 1, thesisHorizonDays: 5, capital: 1, buyingPower: 1, legs: [] }).some((e) => /provide legs/.test(e)));
  assert.throws(() => parseInput(ProposalSchema, { symbol: "SPY" }, "proposal"), /proposal: provide/);
  assert.deepEqual(parseInput(WatchlistSchema, { symbols: ["intc"] }, "w"), ["INTC"]);
  assert.throws(() => parseInput(WatchlistSchema, { tickers: ["x"] }, "watchlist.json"));
  assert.deepEqual(parseEarnings({ data: { results: [{ symbol: "INTC", report: { date: "2026-10-23", timing: "pm" } }] } }), [{ symbol: "INTC", date: "2026-10-23", timing: "pm" }]);
  assert.throws(() => parseEarnings({ foo: 1 }), /earnings:/);
});
test("zod inputs: committed fixtures and calendars still validate", () => {
  parseChain(JSON.parse(readFileSync(new URL("./fixtures/spy-chain-robinhood-2026-10-14.json", import.meta.url), "utf8")));
  parseEarnings(JSON.parse(readFileSync(new URL("./fixtures/earnings-2026-10-15.json", import.meta.url), "utf8")));
  parseInput(CalendarFileSchema, JSON.parse(readFileSync(new URL("../calendar/releases-2026.json", import.meta.url), "utf8")), "calendar");
  for (const f of ["options-proposal-hyg-style.json"]) parseInput(ProposalSchema, JSON.parse(readFileSync(new URL(`../examples/${f}`, import.meta.url), "utf8")), f);
});
