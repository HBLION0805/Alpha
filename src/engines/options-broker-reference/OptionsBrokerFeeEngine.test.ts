import { estimateRobinhoodOptionFees as estimate, type RobinhoodOptionFeeEstimate, type RobinhoodOptionFeeInput } from "./OptionsBrokerFeeEngine";

let passed = 0;
function test(label: string, run: () => void): void { run(); passed++; console.log("PASS " + label); }
function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Expected " + JSON.stringify(expected) + "; got " + JSON.stringify(actual));
}
function truth(value: unknown): asserts value { if (!value) throw new Error("Assertion failed."); }
function rejects(input: unknown): void {
  let caught = false;
  try { estimate(input); } catch (error) { truth(error instanceof Error && error.message.startsWith("INVALID_OPTION_FEE_INPUT")); caught = true; }
  truth(caught);
}
function fees(result: RobinhoodOptionFeeEstimate) { truth(result.fees !== null); return result.fees; }
const base: RobinhoodOptionFeeInput = { symbol: "GLD", tradeDate: "2026-09-04", side: "BUY", quantity: 1,
  grossPremiumCents: 2000, executionCount: 1, customerClassification: "NONPROFESSIONAL" };
function changed(overrides: Partial<RobinhoodOptionFeeInput> = {}) { return { ...base, ...overrides }; }

test("one opening contract costs four cents with subcent fees waived", () => {
  const result = estimate(base);
  equal(result.status, "ESTIMATED"); equal(result.blockers, []);
  equal(fees(result), { commissionCents: 0, optionsRegulatoryAndOccCents: 4, secCents: 0,
    tradingActivityCents: 0, consolidatedAuditTrailCents: 0, totalCents: 4 });
});
test("one small closing sale adds one SEC cent and the round trip totals nine cents", () => {
  const buy = fees(estimate(base)), sell = fees(estimate(changed({ side: "SELL", grossPremiumCents: 3000 })));
  equal(sell.totalCents, 5); equal(sell.secCents, 1); equal(sell.tradingActivityCents, 0);
  equal(buy.totalCents + sell.totalCents, 9);
});
test("GLD and IBIT use the same reviewed ordinary ETF option schedule", () => {
  equal(fees(estimate(changed({ symbol: "IBIT", side: "SELL" }))), fees(estimate(changed({ side: "SELL" }))));
});
test("SEC rounding changes at gross proceeds of 48543 versus 48544 cents", () => {
  equal(fees(estimate(changed({ side: "SELL", grossPremiumCents: 48_543 }))).secCents, 1);
  equal(fees(estimate(changed({ side: "SELL", grossPremiumCents: 48_544 }))).secCents, 2);
});
test("SEC exact-cent boundaries never round one extra cent before the boundary", () => {
  equal(fees(estimate(changed({ side: "SELL", grossPremiumCents: 5_000_000 }))).secCents, 103);
  equal(fees(estimate(changed({ side: "SELL", grossPremiumCents: 5_000_001 }))).secCents, 104);
  equal(fees(estimate(changed({ side: "SELL", grossPremiumCents: 1 }))).secCents, 1);
});
test("TAF below one cent is zero for one through three contracts", () => {
  for (const quantity of [1, 2, 3]) equal(fees(estimate(changed({ side: "SELL", quantity }))).tradingActivityCents, 0);
});
test("TAF four and five contracts round to one and two cents", () => {
  equal(fees(estimate(changed({ side: "SELL", quantity: 4 }))).tradingActivityCents, 1);
  equal(fees(estimate(changed({ side: "SELL", quantity: 5 }))).tradingActivityCents, 2);
});
test("CAT 33 and 34 contracts distinguish the subcent waiver from nearest-cent rounding", () => {
  for (const side of ["BUY", "SELL"] as const) {
    equal(fees(estimate(changed({ side, quantity: 33 }))).consolidatedAuditTrailCents, 0);
    equal(fees(estimate(changed({ side, quantity: 34 }))).consolidatedAuditTrailCents, 1);
  }
});
test("CAT rounds a half cent upward at 50 contracts", () => {
  equal(fees(estimate(changed({ quantity: 49 }))).consolidatedAuditTrailCents, 1);
  equal(fees(estimate(changed({ quantity: 50 }))).consolidatedAuditTrailCents, 2);
});
test("maximum supported inputs calculate integer fees without overflow or extra multiplication", () => {
  const result = fees(estimate(changed({ side: "SELL", quantity: 100, grossPremiumCents: 100_000_000 })));
  equal(result, { commissionCents: 0, optionsRegulatoryAndOccCents: 400, secCents: 2060,
    tradingActivityCents: 33, consolidatedAuditTrailCents: 3, totalCents: 2496 });
  truth(Object.values(result).every((amount) => Number.isSafeInteger(amount)));
});
test("opening buys never add sell-only SEC or TAF at any supported proceeds", () => {
  const result = fees(estimate(changed({ quantity: 100, grossPremiumCents: 100_000_000 })));
  equal(result.totalCents, 403); equal(result.secCents, 0); equal(result.tradingActivityCents, 0);
});
test("past future and valid leap dates outside the reviewed session return blocked without fees", () => {
  for (const tradeDate of ["2024-02-29", "2026-09-03", "2026-09-05", "2026-10-15", "2027-01-01"]) {
    const result = estimate(changed({ tradeDate })); equal(result.status, "BLOCKED"); equal(result.fees, null);
    equal(result.blockers, ["TRADE_DATE_OUTSIDE_REVIEWED_PROFILE"]);
  }
});
test("fragmented executions are blocked without silently assuming an aggregation", () => {
  for (const executionCount of [2, 100]) {
    const result = estimate(changed({ executionCount })); equal(result.status, "BLOCKED"); equal(result.fees, null);
    equal(result.blockers, ["FRAGMENTED_EXECUTIONS_UNSUPPORTED"]);
  }
});
test("unknown customer classification cannot adopt ordinary-customer fees", () => {
  const result = estimate(changed({ customerClassification: "UNKNOWN" })); equal(result.status, "BLOCKED"); equal(result.fees, null);
  equal(result.blockers, ["CUSTOMER_CLASSIFICATION_UNKNOWN"]);
});
test("all supported but unreviewed conditions are reported in deterministic order", () => {
  const result = estimate(changed({ tradeDate: "2027-01-01", executionCount: 2, customerClassification: "UNKNOWN" }));
  equal(result.blockers, ["TRADE_DATE_OUTSIDE_REVIEWED_PROFILE", "FRAGMENTED_EXECUTIONS_UNSUPPORTED", "CUSTOMER_CLASSIFICATION_UNKNOWN"]);
  equal(result.fees, null);
});
test("dated source reference is explicit and does not imply broker account or billed fee proof", () => {
  for (const result of [estimate(base), estimate(changed({ customerClassification: "UNKNOWN" }))]) {
    equal(result.executionAllowed, false); equal(result.marketValidated, false); equal(result.brokerAccountVerified, false);
    equal(result.brokerFeesConfirmed, false); equal(result.existingReplayFeeAssumptionsChanged, false);
    equal(result.profile.applicableTradeDate, "2026-09-04"); equal(result.profile.reviewedOn, "2026-09-06");
    equal(result.profile.feeScheduleVersion, "20260831"); equal(result.profile.executionModel, "SINGLE_EXECUTION");
    truth(result.sourceReferences.some((source) => source.url === "https://cdn.robinhood.com/assets/robinhood/legal/RHF%20Fee%20Schedule.pdf"));
    truth(result.limitations.some((item) => item.includes("Fragmented fills")));
    truth(result.limitations.some((item) => item.includes("fixed fee assumptions")));
  }
});
test("input remains caller-owned and results do not alias later caller mutations", () => {
  const input = changed(), before = JSON.stringify(input), result = estimate(input);
  equal(JSON.stringify(input), before); equal(Object.isFrozen(input), false);
  input.quantity = 50; input.side = "SELL";
  equal(result.input.quantity, 1); equal(result.input.side, "BUY"); equal(fees(result).totalCents, 4);
});
test("the complete estimate is frozen and deterministic", () => {
  const result = estimate(base);
  for (const value of [result, result.input, result.profile, result.fees, result.blockers, result.sourceReferences,
    ...result.sourceReferences, result.limitations]) truth(Object.isFrozen(value));
  equal(estimate(base), result);
});
test("a plain null-prototype object is accepted without inheriting authority", () => {
  const input = Object.assign(Object.create(null) as object, base);
  equal(estimate(input), estimate(base));
});
test("null arrays primitives class objects and inherited input fields are rejected", () => {
  class Input { symbol = "GLD"; }
  for (const input of [null, undefined, [], "input", 1, true, new Date(), new Input(), Object.create(base)]) rejects(input);
});
test("every required field must be present", () => {
  for (const key of Object.keys(base)) { const input: Record<string, unknown> = { ...base }; delete input[key]; rejects(input); }
});
test("additional authority probability and arbitrary fields are rejected", () => {
  for (const key of ["executionAllowed", "marketValidated", "brokerAccountVerified", "winProbability", "sourceReferences", "feeOverride"]) {
    rejects({ ...base, [key]: true });
  }
});
test("getters are rejected without evaluating them", () => {
  let read = false;
  const input = { ...base };
  Object.defineProperty(input, "quantity", { enumerable: true, get() { read = true; return 1; } });
  rejects(input); equal(read, false);
});
test("hidden symbol and nonenumerable fields cannot bypass exact-field validation", () => {
  rejects(Object.defineProperty({ ...base }, "symbol", { value: "GLD", enumerable: false }));
  rejects(Object.defineProperty({ ...base }, "hidden", { value: true, enumerable: false }));
  rejects({ ...base, [Symbol("authority")]: true });
});
test("all numeric inputs reject zero negative zero fractions unsafe integers and coercion", () => {
  for (const key of ["quantity", "grossPremiumCents", "executionCount"]) {
    for (const value of [0, -0, -1, 1.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, "1", 1n, null, undefined, true]) rejects({ ...base, [key]: value });
  }
});
test("quantity execution count and total premium bounds are enforced before any arithmetic", () => {
  rejects(changed({ quantity: 101 })); rejects(changed({ executionCount: 101 })); rejects(changed({ grossPremiumCents: 100_000_001 }));
  equal(estimate(changed({ grossPremiumCents: 1 })).status, "ESTIMATED");
});
test("malformed impossible and noncanonical calendar dates are invalid inputs", () => {
  for (const tradeDate of ["2026-9-04", "2026-09-4", "2026-09-04 ", "2026-09-04T00:00:00.000Z", "2026-02-29",
    "2026-02-30", "2026-00-01", "2026-13-01", "2026-09-00", "2026-09-31", "not-a-date"]) rejects(changed({ tradeDate }));
  rejects({ ...base, tradeDate: new Date("2026-09-04T00:00:00Z") });
});
test("unknown symbols sides and classifications cannot use the reviewed profile", () => {
  for (const symbol of ["QQQ", "gld", "GLD1", "GLD ", null]) rejects({ ...base, symbol });
  for (const side of ["SELL_TO_CLOSE", "SHORT", "buy", null]) rejects({ ...base, side });
  for (const customerClassification of ["PROFESSIONAL", "nonprofessional", null]) rejects({ ...base, customerClassification });
});
test("unsupported profile conditions never hide malformed economics", () => {
  rejects(changed({ tradeDate: "2027-01-01", customerClassification: "UNKNOWN", executionCount: 2, grossPremiumCents: -1 }));
});

console.log(`Options broker fee estimate: ${passed}/${passed} passed.`);
