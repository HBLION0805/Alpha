import { readFileSync } from "node:fs";
import { assessRobinhoodCapture as assess, ROBINHOOD_CAPTURE_MAX_BYTES } from "./RobinhoodCaptureEngine";

const source = readFileSync("fixtures/options-robinhood-data/capture.synthetic.json", "utf8");
const now = "2026-09-04T14:00:10.000Z";
const same = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("Values differ"); };
const assert = Object.assign((v: unknown) => { if (!v) throw new Error("Assertion failed"); }, {
  equal: same, deepEqual: same,
  notEqual: (a: unknown, b: unknown) => { if (a === b) throw new Error("Values must differ"); },
  throws: (work: () => unknown, pattern: RegExp) => { let error: unknown; try { work(); } catch (e) { error = e; } if (!(error instanceof Error) || !pattern.test(error.message)) throw new Error("Expected rejection: " + pattern); },
});
const sample = () => JSON.parse(source);
let passed = 0;
function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }
function check(change: (input: ReturnType<typeof sample>) => void, at = now) { const input = sample(); change(input); return assess(JSON.stringify(input), at); }
function rejected(change: (input: ReturnType<typeof sample>) => void, code: string) { assert.throws(() => check(change), new RegExp(code)); }
const quote = (v: ReturnType<typeof sample>) => v.calls[2].data.results[0].quote;
const bars = (v: ReturnType<typeof sample>) => v.calls[3].data.results[0].bars;

test("fresh source data preserves nanosecond clock, half-cent mark and exact contract cash", () => {
  const r = assess(source, now), q = r.quotes[0]!;
  assert.equal(q.sourceQuoteAt, "2026-09-04T13:59:59.900123456Z"); assert.equal(q.ageAtReceiptMs, 1100);
  assert.equal(q.markPrice, "0.245000"); assert.equal(q.oneContractPremiumCents, 2500); assert.equal(q.oneContractSpreadCents, 200);
  assert.deepEqual(q.blockers, []); assert.equal(r.status, "NO_REPLAY"); assert.equal(r.executionAllowed, false); assert.equal(r.tradeCount, 0);
  assert.equal(r.declarationAuthenticatedByParser, false); assert(Object.isFrozen(r.quotes));
});
test("recent receipt never refreshes an old source quote", () => {
  const r = check(v => { quote(v).updated_at = "2026-09-03T20:00:00Z"; });
  assert(r.quotes[0]!.blockers.includes("STALE_ON_RECEIPT")); assert(r.quotes[0]!.blockers.includes("STALE_AT_ASSESSMENT"));
});
test("reassessment ages previously fresh data without changing receipt age", () => {
  const a = assess(source, now), b = assess(source, "2026-09-04T14:02:00.000Z");
  assert.equal(a.quotes[0]!.ageAtReceiptMs, b.quotes[0]!.ageAtReceiptMs); assert(b.quotes[0]!.blockers.includes("STALE_AT_ASSESSMENT"));
});
test("missing invalid calendar and future quote clocks cannot qualify", () => {
  for (const time of [null, "yesterday", "2026-02-30T13:00:00Z", "2026-09-04T25:00:00Z"]) assert(check(v => { quote(v).updated_at = time; }).quotes[0]!.blockers.includes("QUOTE_CLOCK_UNKNOWN"));
  assert(check(v => { quote(v).updated_at = "2026-09-04T14:00:02Z"; }).quotes[0]!.blockers.includes("QUOTE_CLOCK_IN_FUTURE"));
});
test("missing side does not fall back to mark, last, or fast-fill price", () => {
  const r = check(v => { delete quote(v).bid_price; quote(v).high_fill_rate_buy_price = "0.25"; });
  assert.equal(r.quotes[0]!.bidPerUnitCents, null); assert.equal(r.quotes[0]!.budgetScenario, null);
});
test("zero and crossed quotes remain visibly unusable", () => {
  assert(check(v => { quote(v).bid_price = "0"; }).quotes[0]!.blockers.includes("ZERO_QUOTE_SIDE"));
  assert(check(v => { quote(v).bid_price = "0.26"; }).quotes[0]!.blockers.includes("CROSSED_QUOTE"));
});
test("sub-cent source side is rejected without rounding", () => {
  const r = check(v => { quote(v).ask_price = "0.251"; }); assert.equal(r.quotes[0]!.askPerUnitCents, null);
  assert(r.quotes[0]!.blockers.includes("QUOTE_SIDES_OR_CENT_PRECISION_UNAVAILABLE"));
});
test("unknown zero and malformed sizes are distinct from volume/open interest", () => {
  for (const value of [null, undefined, -1, 0.5, "12"]) {
    const r = check(v => { quote(v).bid_size = value; quote(v).volume = 100000; });
    assert.equal(r.quotes[0]!.bidSize, null); assert(r.quotes[0]!.blockers.includes("SIZE_UNKNOWN"));
  }
  const zero = check(v => { quote(v).ask_size = 0; }); assert.equal(zero.quotes[0]!.askSize, 0); assert(zero.quotes[0]!.blockers.includes("ZERO_DISPLAYED_SIZE"));
});
test("USD 50 allocation and USD 25 stress lower bounds remain independent", () => {
  const r = check(v => { quote(v).ask_price = "0.30"; });
  assert(r.quotes[0]!.blockers.includes("PREMIUM_ALONE_EXCEEDS_STRESS_CAP")); assert(!r.quotes[0]!.blockers.includes("PREMIUM_ALONE_EXCEEDS_ALLOCATION"));
  const expensive = check(v => { quote(v).ask_price = "1.00"; }); assert(expensive.quotes[0]!.blockers.includes("PREMIUM_ALONE_EXCEEDS_ALLOCATION"));
});
test("unknown fees and provider 99% expiry estimate never become zero costs or outcome confidence", () => {
  const r = assess(source, now), q = r.quotes[0]!;
  assert.equal(q.providerExpiryProfitProbability, "0.990000"); assert.equal(r.winProbability, null);
  assert.equal(q.budgetScenario!.scenario!.mode, "NORMAL"); assert.equal(q.budgetScenario!.economics!.plannedStopCents, null);
  assert(q.budgetScenario!.blockers.some(v => v.code === "COSTS_UNKNOWN"));
});
test("each quote uses its own tick regime", () => {
  const r = check(v => { quote(v).ask_price = "3.01"; }); assert(r.quotes[0]!.blockers.includes("PRICE_TICK_UNVERIFIED"));
});
test("nonstandard multiplier and inactive contract cannot qualify", () => {
  const r = check(v => { v.calls[0].data.chains[0].trade_value_multiplier = "150"; v.calls[1].data.instruments[0].trade_value_multiplier = "150"; v.calls[1].data.instruments[0].tradability = "untradable"; });
  assert(r.quotes[0]!.blockers.includes("NONSTANDARD_MULTIPLIER")); assert(r.quotes[0]!.blockers.includes("CONTRACT_NOT_ACTIVE_TRADABLE")); assert.equal(r.quotes[0]!.budgetScenario, null);
});
test("unknown and explicit interpolated bars never count as observed bars", () => {
  const r = check(v => { delete bars(v)[0].interpolated; }); const h = r.histories[0]!;
  assert.equal(h.explicitNonInterpolatedCount, 0); assert.equal(h.unknownInterpolationCount, 1); assert.equal(h.interpolatedCount, 1);
});
test("all interpolated history cannot become a price path", () => {
  const h = check(v => { bars(v).forEach((b: Record<string, unknown>) => { b.interpolated = true; }); }).histories[0]!;
  assert(h.blockers.includes("ALL_BARS_INTERPOLATED")); assert.equal(h.historicalBidAskAvailable, false); assert.equal(h.barVolumeAvailable, false);
});
test("explicit observed OHLC still cannot authorize quote replay", () => {
  const r = check(v => { bars(v).forEach((b: Record<string, unknown>) => { b.interpolated = false; }); });
  assert.equal(r.histories[0]!.explicitNonInterpolatedCount, 2); assert.equal(r.status, "NO_REPLAY"); assert(r.histories[0]!.blockers.includes("OHLC_IS_NOT_EXECUTION_QUOTE_HISTORY"));
});
test("history gaps and empty windows are reported", () => {
  assert(check(v => { bars(v).pop(); }).histories[0]!.blockers.includes("REQUESTED_WINDOW_INCOMPLETE"));
  assert(check(v => { v.calls[3].data.results[0].bars = []; }).histories[0]!.blockers.includes("EMPTY_HISTORY"));
});
test("missing requested quotes cannot silently drop a contract", () => {
  const r = check(v => { v.calls[2].data.results = []; }); assert(r.captureIssues.includes("REQUESTED_OPTION_QUOTE_MISSING")); assert(r.captureIssues.includes("CONTRACT_WITHOUT_QUOTE"));
});
test("missing historical contracts and pagination remain explicit blockers", () => {
  const r = check(v => { v.calls[3].data.not_found = [v.calls[2].args.instrument_ids[0]]; v.calls[3].data.results = []; v.calls[1].data.next = "https://example.invalid/?cursor=bounded"; });
  assert(r.captureIssues.includes("HISTORICAL_IDS_NOT_FOUND")); assert(r.captureIssues.includes("REQUESTED_HISTORY_MISSING")); assert(r.captureIssues.includes("INSTRUMENT_RESPONSE_PAGINATED"));
});
test("tool and symbol scopes reject account calls and other tickers", () => {
  rejected(v => { v.calls[2].tool = "get_option_positions"; }, "TOOL_OUTSIDE_SCOPE");
  rejected(v => { v.calls[0].args.underlying_symbol = "AAPL"; }, "SYMBOL_OUTSIDE_SCOPE");
  rejected(v => { v.calls[4].data.results[0].quote.symbol = "BTC"; }, "SYMBOL_OUTSIDE_SCOPE");
});
test("credentials unexpected envelope fields and hostile structures are rejected", () => {
  rejected(v => { v.calls[2].data.access_token = "DO_NOT_ECHO"; }, "FORBIDDEN_DATA_FIELD");
  rejected(v => { v.confirmedLive = true; }, "UNEXPECTED_FIELD");
  assert.throws(() => assess('{"__proto__":{}}', now), /FORBIDDEN_DATA_FIELD/);
  assert.throws(() => assess('x'.repeat(ROBINHOOD_CAPTURE_MAX_BYTES + 1), now), /BYTE_LIMIT/);
  assert.throws(() => assess('{', now), /INVALID_JSON/);
});
test("request receipt and assessment chronology are strict", () => {
  rejected(v => { v.calls[0].receivedAt = "2026-09-04T13:59:00.000Z"; }, "CAPTURE_CHRONOLOGY");
  assert.throws(() => assess(source, "2026-09-04T13:59:00.000Z"), /CAPTURE_CHRONOLOGY/);
  rejected(v => { v.calls[0].requestedAt = "2026-02-30T14:00:00.000Z"; }, "INVALID_CAPTURE_CLOCK");
});
test("chain expiry strike and requested side identities must agree", () => {
  rejected(v => { v.calls[1].data.instruments[0].expiration_date = "2026-09-26"; }, "CONTRACT_CHAIN_MISMATCH");
  rejected(v => { v.calls[1].data.instruments[0].strike_price = "411"; }, "INSTRUMENT_FILTER_MISMATCH");
  rejected(v => { v.calls[1].args.type = "put"; }, "INSTRUMENT_FILTER_MISMATCH");
  rejected(v => { v.calls[1].data.instruments.push(v.calls[1].data.instruments[0]); }, "DUPLICATE_INSTRUMENT");
});
test("quote and official close match UUID and underlying independently", () => {
  rejected(v => { quote(v).instrument_id = v.calls[0].data.chains[0].id; }, "QUOTE_IDENTITY_MISMATCH");
  rejected(v => { v.calls[2].data.results[0].close.symbol = "IBIT"; }, "CLOSE_IDENTITY_MISMATCH");
  rejected(v => { v.calls[2].data.results.push(v.calls[2].data.results[0]); }, "QUOTE_IDENTITY_MISMATCH");
});
test("OCC identity and interval must match the requested contract", () => {
  rejected(v => { v.calls[3].data.results[0].occ_symbol = "GLD   260925P00410000"; }, "HISTORY_CONTRACT_OR_INTERVAL_MISMATCH");
  rejected(v => { v.calls[3].data.results[0].interval = "5minute"; }, "HISTORY_CONTRACT_OR_INTERVAL_MISMATCH");
});
test("bar order duplicate time range and OHLC consistency reject malformed history", () => {
  rejected(v => { bars(v).reverse(); }, "BAR_CLOCK_OR_ORDER");
  rejected(v => { bars(v)[1].begins_at = bars(v)[0].begins_at; }, "BAR_CLOCK_OR_ORDER");
  rejected(v => { bars(v)[1].begins_at = "2026-09-04T14:00:00Z"; }, "BAR_CLOCK_OR_ORDER");
  rejected(v => { bars(v)[0].high_price = "0.10"; }, "BAR_OHLC");
  rejected(v => { bars(v)[0].interpolated = "false"; }, "BAR_INTERPOLATION_FLAG");
});
test("extended hours and oversized history ranges are outside this capture scope", () => {
  rejected(v => { v.calls[3].args.bounds = "24_7"; }, "HISTORY_SCOPE");
  rejected(v => { v.calls[3].args.start_time = "2026-09-01T13:58:00Z"; }, "HISTORY_RANGE");
});
test("candidate lessons have no trade outcome or strategy authority", () => {
  const r = assess(source, now); assert.equal(r.candidateLessons.length, 4);
  for (const l of r.candidateLessons) { assert.equal(l.tradeOutcome, null); assert.equal(l.strategyChangeAllowed, false); }
});
test("source byte fingerprint changes independently of semantic contents", () => {
  assert.notEqual(assess(source, now).sourceSha256, assess(JSON.stringify(sample()), now).sourceSha256);
});
test("history cannot report the same contract found and not found", () => {
  rejected(v => { v.calls[3].data.not_found = [v.calls[2].args.instrument_ids[0]]; }, "HISTORY_FOUND_NOT_FOUND_CONFLICT");
});
test("call and structural limits reject expanding captures", () => {
  rejected(v => { v.calls = Array(13).fill(v.calls[0]); }, "INVALID_ROWS");
  rejected(v => { v.calls[2].args.instrument_ids = Array(5).fill(v.calls[2].args.instrument_ids[0]); }, "CONTRACT_LIMIT");
  rejected(v => { let target = v; for (let i = 0; i < 18; i++) { target.nested = {}; target = target.nested; } }, "STRUCTURE_LIMIT");
});
console.log(`${passed}/${passed} tests passed.`);
