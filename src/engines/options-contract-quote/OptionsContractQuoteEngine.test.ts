import type { OptionContract, OptionQuote } from "../../contracts/OptionsContractQuote";
import { qualifyOptionQuote, validateOptionContract, validateOptionQuote } from "./OptionsContractQuoteEngine";

let passed = 0;
function test(label: string, run: () => void): void { run(); passed++; console.log(`PASS ${label}`); }
function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
}
function truth(value: unknown): asserts value { if (!value) throw new Error("Assertion failed."); }
function rejects(run: () => unknown, message?: string): void {
  try { run(); } catch (error) {
    truth(error instanceof Error);
    if (message !== undefined) equal(error.message, message);
    return;
  }
  throw new Error("Expected rejection.");
}
const baseContract: OptionContract = {
  contractId: "GLD:2026-09-18:CALL:48000", symbol: "GLD", optionType: "CALL",
  strikePriceCents: 48000, expiryDate: "2026-09-18", multiplier: 100,
  minimumPriceTickCents: 1, deliverable: "STANDARD_100_SHARES_USD", exerciseStyle: "AMERICAN",
};
const baseQuote: OptionQuote = {
  quoteId: "synthetic:quote-1", contractId: baseContract.contractId,
  observedAt: "2026-09-08T14:00:00.000Z", receivedAt: "2026-09-08T14:00:00.100Z",
  bidPerShareCents: 24, askPerShareCents: 25, bidSizeContracts: 2, askSizeContracts: 1,
  underlyingPriceCents: 47000, sourceId: "synthetic:lifecycle-demo",
  origin: "SYNTHETIC_FIXTURE", session: "REGULAR", ivBps: 3000, deltaBps: 2000,
};
function contract(change: Partial<OptionContract> = {}): OptionContract {
  const value = { ...baseContract, ...change };
  return validateOptionContract({ ...value, contractId: `${value.symbol}:${value.expiryDate}:${value.optionType}:${value.strikePriceCents}` });
}
function quote(change: Partial<OptionQuote> = {}, identity = baseContract): OptionQuote {
  return validateOptionQuote({ ...baseQuote, contractId: identity.contractId, ...change }, identity);
}
function qualify(change: Partial<OptionQuote> = {}, asOf = "2026-09-08T14:00:00.100Z", identity = baseContract) {
  return qualifyOptionQuote(quote(change, identity), identity, asOf);
}
function has(result: ReturnType<typeof qualifyOptionQuote>, reason: string): boolean {
  return result.reasons.includes(reason);
}

test("standard GLD call and IBIT put preserve exact instrument identity", () => {
  equal(validateOptionContract(baseContract), baseContract);
  const put = contract({ symbol: "IBIT", optionType: "PUT", strikePriceCents: 6000 });
  equal(put.contractId, "IBIT:2026-09-18:PUT:6000");
  equal(quote({ deltaBps: -4200 }, put).deltaBps, -4200);
});
test("an id cannot disguise a changed symbol, strike, expiry or option type", () => {
  for (const change of [{ symbol: "IBIT" }, { strikePriceCents: 48001 }, { expiryDate: "2026-09-19" }, { optionType: "PUT" }]) {
    rejects(() => validateOptionContract({ ...baseContract, ...change }), "OPTION_CONTRACT_ID_MISMATCH");
  }
});
test("adjusted deliverables and nonstandard exercise or multiplier are refused", () => {
  for (const change of [{ deliverable: "ADJUSTED" }, { multiplier: 10 }, { exerciseStyle: "EUROPEAN" }, { symbol: "BTC" }]) {
    rejects(() => validateOptionContract({ ...baseContract, ...change }), "INVALID_OPTION_CONTRACT");
  }
});
test("invalid calendar dates cannot be normalized into another expiry", () => {
  for (const expiryDate of ["2026-02-29", "2026-09-31", "2026-13-01", "2026-9-18", "2026-09-18T00:00:00.000Z"]) {
    rejects(() => contract({ expiryDate }), "INVALID_OPTION_CONTRACT");
  }
  equal(contract({ expiryDate: "2028-02-29" }).expiryDate, "2028-02-29");
});
test("invalid or unsafe strike and tick amounts fail before arithmetic", () => {
  for (const value of [-1, -0, 0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER, 100_000_001]) {
    rejects(() => contract({ strikePriceCents: value }), "INVALID_OPTION_CONTRACT");
  }
  for (const value of [0, 0.1, 101, Number.NaN]) rejects(() => contract({ minimumPriceTickCents: value }), "INVALID_OPTION_CONTRACT");
});
test("unexpected contract authority fields and missing fields are rejected", () => {
  rejects(() => validateOptionContract({ ...baseContract, verified: true }), "INVALID_OPTION_CONTRACT_FIELDS");
  const { multiplier: _unused, ...partial } = baseContract;
  rejects(() => validateOptionContract(partial), "INVALID_OPTION_CONTRACT_FIELDS");
  rejects(() => validateOptionContract(null), "INVALID_OPTION_CONTRACT");
  rejects(() => validateOptionContract([]), "INVALID_OPTION_CONTRACT");
});
test("quote contract binding is checked even when prices are otherwise valid", () => {
  rejects(() => quote({ contractId: "IBIT:2026-09-18:CALL:48000" }), "OPTION_QUOTE_CONTRACT_MISMATCH");
});
test("canonical timestamps retain receipt latency and reject ambiguous zones", () => {
  equal(quote().receivedAt, baseQuote.receivedAt);
  for (const observedAt of ["2026-09-08T14:00:00Z", "2026-09-08T14:00:00.000", "2026-09-08T10:00:00.000-04:00", "2026-02-30T14:00:00.000Z", "2026-09-08T14:00:60.000Z"]) {
    rejects(() => quote({ observedAt }), "INVALID_OPTION_QUOTE");
  }
  rejects(() => quote({ receivedAt: "2026-09-08T13:59:59.999Z" }), "OPTION_QUOTE_TIME_ORDER_INVALID");
});
test("quote structure can store future observations but qualification cannot use them", () => {
  const future = quote({ observedAt: "2026-09-08T14:01:00.000Z", receivedAt: "2026-09-08T14:01:00.100Z" });
  const result = qualifyOptionQuote(future, baseContract, "2026-09-08T14:00:00.000Z");
  equal(result.eligible, false); truth(has(result, "OPTION_QUOTE_NOT_YET_RECEIVED")); truth(has(result, "OPTION_QUOTE_OBSERVED_IN_FUTURE"));
});
test("a quote observed before the decision remains unavailable until actually received", () => {
  const result = qualify({ receivedAt: "2026-09-08T14:00:20.000Z" }, "2026-09-08T14:00:10.000Z");
  equal(result.eligible, false); equal(result.reasons, ["OPTION_QUOTE_NOT_YET_RECEIVED"]);
});
test("crossed markets are rejected and locked markets may be represented", () => {
  rejects(() => quote({ bidPerShareCents: 26 }), "OPTION_QUOTE_CROSSED_MARKET");
  equal(quote({ bidPerShareCents: 25 }).bidPerShareCents, 25);
});
test("both sides of a five-cent quote must respect the contract grid", () => {
  const coarse = contract({ minimumPriceTickCents: 5 });
  rejects(() => quote({}, coarse), "OPTION_QUOTE_OFF_TICK");
  equal(quote({ bidPerShareCents: 20 }, coarse).askPerShareCents, 25);
  rejects(() => quote({ bidPerShareCents: 20, askPerShareCents: 26 }, coarse), "OPTION_QUOTE_OFF_TICK");
});
test("invalid prices and negative or fractional sizes cannot be accepted", () => {
  for (const change of [{ bidPerShareCents: -1 }, { bidPerShareCents: -0 }, { askPerShareCents: 0 }, { askPerShareCents: 1.5 },
    { askPerShareCents: Number.NaN }, { askPerShareCents: Number.POSITIVE_INFINITY }, { bidSizeContracts: 0.5 },
    { bidSizeContracts: -1 }, { askSizeContracts: 100_001 }, { underlyingPriceCents: 0 }, { underlyingPriceCents: 100_000_001 }]) {
    rejects(() => quote(change), "INVALID_OPTION_QUOTE");
  }
});
test("zero displayed sizes are preserved and do not imply executable liquidity", () => {
  const result = qualify({ bidPerShareCents: 0, bidSizeContracts: 0, askSizeContracts: 0 });
  equal(result.eligible, true); equal(result.reasons, []);
  equal(quote({ bidSizeContracts: 0, askSizeContracts: 0 }).askSizeContracts, 0);
});
test("unverified imported prices stay in their explicit origin namespace", () => {
  const imported = quote({ origin: "UNVERIFIED_IMPORT", sourceId: "import:manual-csv" });
  equal(imported.origin, "UNVERIFIED_IMPORT"); equal(imported.sourceId, "import:manual-csv");
  equal(qualifyOptionQuote(imported, baseContract, imported.receivedAt).eligible, true);
});
test("source names cannot promote synthetic data or claim verified authority", () => {
  for (const change of [{ sourceId: "live:robinhood" }, { sourceId: "import:manual" }, { sourceId: "synthetic:" }, { origin: "UNVERIFIED_IMPORT" }]) {
    rejects(() => validateOptionQuote({ ...baseQuote, ...change }, baseContract), "OPTION_QUOTE_SOURCE_ORIGIN_MISMATCH");
  }
  rejects(() => validateOptionQuote({ ...baseQuote, origin: "VERIFIED_LIVE" }, baseContract), "INVALID_OPTION_QUOTE");
});
test("unknown Greeks remain null instead of fabricated zero values", () => {
  const result = quote({ ivBps: null, deltaBps: null });
  equal(result.ivBps, null); equal(result.deltaBps, null); equal(qualifyOptionQuote(result, baseContract, result.receivedAt).eligible, true);
});
test("Greeks are bounded and option delta has the correct sign", () => {
  for (const change of [{ ivBps: -1 }, { ivBps: 1_000_001 }, { deltaBps: 10001 }, { deltaBps: 0.5 }]) {
    rejects(() => quote(change), "INVALID_OPTION_QUOTE");
  }
  rejects(() => quote({ deltaBps: -1 }), "OPTION_QUOTE_DELTA_SIGN_INVALID");
  const put = contract({ optionType: "PUT" });
  rejects(() => quote({ deltaBps: 1 }, put), "OPTION_QUOTE_DELTA_SIGN_INVALID");
  equal(quote({ deltaBps: 0 }, put).deltaBps, 0);
});
test("quote identity and source reject control characters and oversized strings", () => {
  for (const change of [{ quoteId: "bad\nquote" }, { quoteId: "a".repeat(161) }, { sourceId: "synthetic:bad source" }, { sourceId: "https://example.com/feed?live=true" }]) {
    rejects(() => quote(change), "INVALID_OPTION_QUOTE");
  }
});
test("extra permissions and omitted nullable quote fields fail strict shape validation", () => {
  rejects(() => validateOptionQuote({ ...baseQuote, executionAllowed: true }, baseContract), "INVALID_OPTION_QUOTE_FIELDS");
  const { ivBps: _unused, ...partial } = baseQuote;
  rejects(() => validateOptionQuote(partial, baseContract), "INVALID_OPTION_QUOTE_FIELDS");
});
test("accessors and symbol fields are rejected without executing injected getters", () => {
  let called = false;
  const accessor = { ...baseQuote };
  Object.defineProperty(accessor, "bidPerShareCents", { get() { called = true; return 24; } });
  rejects(() => validateOptionQuote(accessor, baseContract), "INVALID_OPTION_QUOTE_FIELDS");
  equal(called, false);
  rejects(() => validateOptionQuote({ ...baseQuote, [Symbol("permission")]: true }, baseContract), "INVALID_OPTION_QUOTE_FIELDS");
});
test("strict prototype validation prevents inherited quote metadata", () => {
  rejects(() => validateOptionQuote(Object.assign(Object.create({ authority: "live" }), baseQuote), baseContract), "INVALID_OPTION_QUOTE");
  equal(validateOptionQuote(Object.assign(Object.create(null), baseQuote), baseContract), baseQuote);
});
test("quotes remain fresh through exactly sixty seconds of observation age", () => {
  equal(qualify({}, "2026-09-08T14:01:00.000Z").eligible, true);
  const result = qualify({}, "2026-09-08T14:01:00.001Z");
  equal(result.eligible, false); equal(result.reasons, ["OPTION_QUOTE_STALE"]);
});
test("receipt timestamp cannot make an old quote fresh again", () => {
  const result = qualify({ receivedAt: "2026-09-08T14:02:00.000Z" }, "2026-09-08T14:02:00.000Z");
  equal(result.eligible, false); truth(has(result, "OPTION_QUOTE_STALE"));
});
test("closed session flags override plausible weekday timestamps", () => {
  const result = qualify({ session: "CLOSED" });
  equal(result.eligible, false); equal(result.reasons, ["OPTION_QUOTE_SESSION_CLOSED"]);
});
test("weekday clock inference is not claimed as verified holiday evidence", () => {
  const labourDay = quote({ observedAt: "2026-09-07T14:00:00.000Z", receivedAt: "2026-09-07T14:00:00.000Z", session: "CLOSED" });
  equal(qualifyOptionQuote(labourDay, baseContract, labourDay.receivedAt).eligible, false);
  // Inputs are local scenarios: the caller's holiday/early-close classification stays unverified.
  truth(!Object.hasOwn(qualify(), "marketSessionVerified"));
});
test("DST daylight opening boundary uses New York time rather than a fixed UTC hour", () => {
  const open = { observedAt: "2026-09-08T13:30:00.000Z", receivedAt: "2026-09-08T13:30:00.000Z" };
  equal(qualify(open, open.receivedAt).eligible, true);
  const early = { observedAt: "2026-09-08T13:29:59.999Z", receivedAt: "2026-09-08T13:29:59.999Z" };
  truth(has(qualify(early, early.receivedAt), "OPTION_QUOTE_OUTSIDE_REGULAR_WINDOW"));
});
test("standard-time opening boundary shifts by one UTC hour", () => {
  const winter = contract({ expiryDate: "2026-12-18" });
  const open = { observedAt: "2026-12-08T14:30:00.000Z", receivedAt: "2026-12-08T14:30:00.000Z" };
  equal(qualify(open, open.receivedAt, winter).eligible, true);
  const early = { observedAt: "2026-12-08T13:30:00.000Z", receivedAt: "2026-12-08T13:30:00.000Z" };
  truth(has(qualify(early, early.receivedAt, winter), "OPTION_QUOTE_OUTSIDE_REGULAR_WINDOW"));
});
test("sixteen hundred ET is excluded even when a fresh quote arrives at the close", () => {
  const before = { observedAt: "2026-09-08T19:59:59.999Z", receivedAt: "2026-09-08T19:59:59.999Z" };
  equal(qualify(before, before.receivedAt).eligible, true);
  truth(has(qualify(before, "2026-09-08T20:00:00.000Z"), "OPTION_QUOTE_OUTSIDE_REGULAR_WINDOW"));
  const at = { observedAt: "2026-09-08T20:00:00.000Z", receivedAt: "2026-09-08T20:00:00.000Z" };
  truth(has(qualify(at, at.receivedAt), "OPTION_QUOTE_OUTSIDE_REGULAR_WINDOW"));
});
test("a premarket quote cannot become eligible merely by waiting until regular hours", () => {
  const result = qualify({ observedAt: "2026-09-08T13:29:59.999Z", receivedAt: "2026-09-08T13:30:00.000Z" }, "2026-09-08T13:30:00.000Z");
  equal(result.eligible, false); truth(has(result, "OPTION_QUOTE_OUTSIDE_REGULAR_WINDOW"));
});
test("weekend observations are excluded even if a caller labels them regular", () => {
  for (const day of ["2026-09-12", "2026-09-13"]) {
    const at = `${day}T14:00:00.000Z`;
    truth(has(qualify({ observedAt: at, receivedAt: at }, at), "OPTION_QUOTE_OUTSIDE_REGULAR_WINDOW"));
  }
});
test("contract expiration is evaluated using New York date and conservative closing cutoff", () => {
  const expired = contract({ expiryDate: "2026-09-04" });
  truth(has(qualify({}, baseQuote.receivedAt, expired), "OPTION_CONTRACT_EXPIRED"));
  const today = contract({ expiryDate: "2026-09-08" });
  equal(qualify({}, baseQuote.receivedAt, today).eligible, true);
  const close = "2026-09-08T20:00:00.000Z";
  truth(has(qualify({ observedAt: close, receivedAt: close }, close, today), "OPTION_CONTRACT_EXPIRED"));
});
test("as-of clock must itself be canonical and the validator rechecks caller-typed objects", () => {
  rejects(() => qualifyOptionQuote(baseQuote, baseContract, "2026-09-08"), "INVALID_OPTION_QUOTE_AS_OF");
  rejects(() => qualifyOptionQuote({ ...baseQuote, contractId: "wrong" }, baseContract, baseQuote.receivedAt), "OPTION_QUOTE_CONTRACT_MISMATCH");
  rejects(() => qualifyOptionQuote(baseQuote, { ...baseContract, contractId: "wrong" }, baseQuote.receivedAt), "OPTION_CONTRACT_ID_MISMATCH");
});
test("validated snapshots are frozen copies and independent of caller mutations", () => {
  const inputContract = { ...baseContract }; const frozenContract = validateOptionContract(inputContract);
  const inputQuote = { ...baseQuote }; const frozenQuote = validateOptionQuote(inputQuote, frozenContract);
  inputContract.strikePriceCents = 1; inputQuote.askPerShareCents = 999;
  equal(frozenContract.strikePriceCents, 48000); equal(frozenQuote.askPerShareCents, 25);
  truth(Object.isFrozen(frozenContract)); truth(Object.isFrozen(frozenQuote));
  const result = qualifyOptionQuote(frozenQuote, frozenContract, frozenQuote.receivedAt);
  truth(Object.isFrozen(result)); truth(Object.isFrozen(result.reasons));
});
test("JSON roundtrips preserve exact snapshots and deterministic qualification", () => {
  const identity = validateOptionContract(JSON.parse(JSON.stringify(baseContract)));
  const observation = validateOptionQuote(JSON.parse(JSON.stringify(baseQuote)), identity);
  equal(identity, baseContract); equal(observation, baseQuote);
  equal(qualifyOptionQuote(observation, identity, observation.receivedAt), qualify());
});

console.log(`Options Contract Quote: ${passed}/${passed} passed.`);
