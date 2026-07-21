import {
  CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  InstrumentAssetClass,
  InstrumentStatus,
  InstrumentType,
  type CanonicalInstrument,
} from "../../contracts/CanonicalInstrument";
import {
  CANONICAL_QUOTE_SCHEMA_VERSION,
  CanonicalQuoteStatus,
  CanonicalQuoteValidationIssueCode,
  QuoteQualityReasonCode,
  QuoteQuantityUnit,
  type CanonicalQuote,
  type CanonicalQuoteInput,
} from "../../contracts/CanonicalQuote";
import {
  CanonicalQuoteValidationError,
  canonicalQuoteContentEquals,
  canonicalQuoteIdentityEquals,
  createCanonicalQuote,
  isCanonicalQuoteId,
  serializeCanonicalQuote,
  validateCanonicalQuote,
  validateCanonicalQuoteInput,
} from "./CanonicalQuote";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function expectIssue(value: unknown, code: CanonicalQuoteValidationIssueCode): void {
  const result = validateCanonicalQuoteInput(value);
  assertTrue(result.issues.some((entry) => entry.code === code), `issue ${code}`);
}

function expectRecordIssue(value: unknown, code: CanonicalQuoteValidationIssueCode): void {
  const result = validateCanonicalQuote(value);
  assertTrue(result.issues.some((entry) => entry.code === code), `record issue ${code}`);
}

function expectError(run: () => unknown, code: CanonicalQuoteValidationIssueCode): void {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof CanonicalQuoteValidationError && error.issues.some((entry) => entry.code === code)) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

function instrument(): CanonicalInstrument {
  return {
    schemaVersion: CANONICAL_INSTRUMENT_SCHEMA_VERSION,
    instrumentId: "instrument:00000000000000000000000001",
    metadataVersion: "1.0",
    displaySymbol: "AAPL",
    displayName: "Apple Inc.",
    assetClass: InstrumentAssetClass.Equity,
    instrumentType: InstrumentType.CommonStock,
    status: InstrumentStatus.Active,
    currency: "USD",
    exchange: "XNAS",
    timezone: "America/New_York",
    effectiveFrom: "2026-07-20T00:00:00.000Z",
  };
}

function input(overrides: Partial<CanonicalQuoteInput> = {}): CanonicalQuoteInput {
  return {
    schemaVersion: CANONICAL_QUOTE_SCHEMA_VERSION,
    instrument: instrument(),
    value: {
      bidPrice: { atomicValue: "2241234", scale: 4 },
      askPrice: { atomicValue: "2241300", scale: 4 },
      bidSize: { atomicValue: "100", scale: 0 },
      askSize: { atomicValue: "120", scale: 0 },
      quantityUnit: QuoteQuantityUnit.BaseUnits,
    },
    currency: "USD",
    status: CanonicalQuoteStatus.Current,
    observationTime: "2026-07-20T11:59:30.000Z",
    providerPublishedAt: "2026-07-20T11:59:30.500Z",
    receivedAt: "2026-07-20T11:59:31.000Z",
    normalizedAt: "2026-07-20T11:59:32.000Z",
    quality: {
      policyId: "market-data-policy:default",
      policyVersion: "1.0",
      evaluatedAt: "2026-07-20T12:00:00.000Z",
      maxAgeSeconds: 60,
      reasonCodes: [],
    },
    source: {
      providerId: "provider:fixture",
      adapterId: "adapter:fixture",
      adapterVersion: "1.0",
      providerInstrumentId: "provider-instrument:123",
      providerSymbol: "AAPL.US",
      sourceReference: "fixture:quote:1",
      contentIntegrityReference: "sha256:fixture-quote-1",
    },
    ...overrides,
  };
}

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("valid quote constructs with deterministic identifier", () => {
  const quote = createCanonicalQuote(input());
  assertTrue(isCanonicalQuoteId(quote.quoteId), "canonical quote ID");
  assertTrue(quote.fingerprint.startsWith("fnv1a64:"), "fingerprint");
});

test("identical input produces identical ID and fingerprint", () => {
  const left = createCanonicalQuote(input());
  const right = createCanonicalQuote(input());
  assertEqual(left.quoteId, right.quoteId, "quote ID");
  assertEqual(left.fingerprint, right.fingerprint, "fingerprint");
});

test("observation fingerprint excludes local ingestion timestamps", () => {
  const left = createCanonicalQuote(input());
  const right = createCanonicalQuote(input({
    receivedAt: "2026-07-20T11:59:33.000Z",
    normalizedAt: "2026-07-20T11:59:34.000Z",
    quality: { ...input().quality, evaluatedAt: "2026-07-20T12:00:05.000Z" },
  }));
  assertEqual(left.quoteId, right.quoteId, "stable quote ID");
  assertEqual(left.fingerprint, right.fingerprint, "stable observation fingerprint");
});

test("quote identity changes with source observation", () => {
  const left = createCanonicalQuote(input());
  const right = createCanonicalQuote(input({ observationTime: "2026-07-20T11:59:29.000Z" }));
  assertTrue(!canonicalQuoteIdentityEquals(left, right), "different quote identity");
});

test("same quote identity may expose a changed content fingerprint", () => {
  const left = createCanonicalQuote(input());
  const right = createCanonicalQuote(input({ value: { ...input().value, askPrice: { atomicValue: "2241400", scale: 4 } } }));
  assertTrue(canonicalQuoteIdentityEquals(left, right), "same source identity");
  assertTrue(!canonicalQuoteContentEquals(left, right), "different content");
});

test("quote is deeply immutable", () => {
  const quote = createCanonicalQuote(input());
  assertTrue(Object.isFrozen(quote), "quote frozen");
  assertTrue(Object.isFrozen(quote.instrument), "instrument frozen");
  assertTrue(Object.isFrozen(quote.value), "value frozen");
  assertTrue(Object.isFrozen(quote.quality.reasonCodes), "reasons frozen");
});

test("source input remains unchanged", () => {
  const source = input();
  const before = JSON.stringify(source);
  createCanonicalQuote(source);
  assertEqual(JSON.stringify(source), before, "source input");
});

test("serialization is deterministic and round-trippable", () => {
  const quote = createCanonicalQuote(input());
  assertEqual(serializeCanonicalQuote(quote), serializeCanonicalQuote(quote), "serialized quote");
  assertEqual(JSON.parse(serializeCanonicalQuote(quote)).quoteId, quote.quoteId, "round trip ID");
});

test("invalid canonical instrument is rejected", () => {
  expectIssue(input({ instrument: { ...instrument(), instrumentId: "AAPL" } }), CanonicalQuoteValidationIssueCode.InvalidInstrument);
});

test("zero bid price is rejected", () => {
  expectIssue(input({ value: { ...input().value, bidPrice: { atomicValue: "0", scale: 4 } } }), CanonicalQuoteValidationIssueCode.InvalidPrice);
});

test("non-integer fixed decimal is rejected", () => {
  expectIssue(input({ value: { ...input().value, askPrice: { atomicValue: "224.13", scale: 2 } } }), CanonicalQuoteValidationIssueCode.InvalidPrice);
});

test("unsafe decimal scale is rejected", () => {
  expectIssue(input({ value: { ...input().value, askPrice: { atomicValue: "22413", scale: 19 } } }), CanonicalQuoteValidationIssueCode.InvalidPrice);
});

test("bid above ask is rejected", () => {
  expectIssue(input({ value: { ...input().value, bidPrice: { atomicValue: "2250000", scale: 4 } } }), CanonicalQuoteValidationIssueCode.InvalidQuoteRelationship);
});

test("sizes require both sides and explicit units", () => {
  expectIssue(input({ value: { bidPrice: input().value.bidPrice, askPrice: input().value.askPrice, bidSize: { atomicValue: "100", scale: 0 } } }), CanonicalQuoteValidationIssueCode.InvalidQuantityUnit);
});

test("negative size is rejected", () => {
  expectIssue(input({ value: { ...input().value, bidSize: { atomicValue: "-1", scale: 0 } } }), CanonicalQuoteValidationIssueCode.InvalidSize);
});

test("quote without sizes requires explicit quality reason", () => {
  const value = input({
    value: { bidPrice: input().value.bidPrice, askPrice: input().value.askPrice },
    quality: { ...input().quality, reasonCodes: [] },
  });
  expectIssue(value, CanonicalQuoteValidationIssueCode.QualityStatusMismatch);
});

test("quote without sizes is valid when quality records it", () => {
  const quote = createCanonicalQuote(input({
    value: { bidPrice: input().value.bidPrice, askPrice: input().value.askPrice },
    quality: { ...input().quality, reasonCodes: [QuoteQualityReasonCode.MissingSize] },
  }));
  assertEqual(quote.quality.reasonCodes[0], QuoteQualityReasonCode.MissingSize, "missing-size reason");
});

test("invalid quote currency is rejected", () => {
  expectIssue(input({ currency: "USDT" }), CanonicalQuoteValidationIssueCode.InvalidCurrency);
});

test("quote currency must match canonical instrument", () => {
  expectIssue(input({ currency: "EUR" }), CanonicalQuoteValidationIssueCode.CurrencyMismatch);
});

test("missing observation time is rejected", () => {
  expectIssue({ ...input(), observationTime: undefined }, CanonicalQuoteValidationIssueCode.InvalidTimestamp);
});

test("receipt cannot precede observation", () => {
  expectIssue(input({ receivedAt: "2026-07-20T11:59:29.000Z" }), CanonicalQuoteValidationIssueCode.InvalidTimestampOrder);
});

test("publication must follow observation", () => {
  expectIssue(input({ providerPublishedAt: "2026-07-20T11:59:29.000Z" }), CanonicalQuoteValidationIssueCode.InvalidTimestampOrder);
});

test("normalization cannot precede receipt", () => {
  expectIssue(input({ normalizedAt: "2026-07-20T11:59:30.000Z" }), CanonicalQuoteValidationIssueCode.InvalidTimestampOrder);
});

test("quality evaluation cannot precede normalization", () => {
  expectIssue(input({ quality: { ...input().quality, evaluatedAt: "2026-07-20T11:59:31.000Z" } }), CanonicalQuoteValidationIssueCode.InvalidTimestampOrder);
});

test("stale quote classification is deterministic", () => {
  const quote = createCanonicalQuote(input({
    status: CanonicalQuoteStatus.Stale,
    quality: { ...input().quality, maxAgeSeconds: 10, reasonCodes: [QuoteQualityReasonCode.StaleObservation] },
  }));
  assertEqual(quote.status, CanonicalQuoteStatus.Stale, "stale status");
});

test("stale observation cannot be marked current", () => {
  expectIssue(input({ quality: { ...input().quality, maxAgeSeconds: 10 } }), CanonicalQuoteValidationIssueCode.QualityStatusMismatch);
});

test("current quote cannot carry stale reason", () => {
  expectIssue(input({ quality: { ...input().quality, reasonCodes: [QuoteQualityReasonCode.StaleObservation] } }), CanonicalQuoteValidationIssueCode.QualityStatusMismatch);
});

test("duplicate quality reason is rejected", () => {
  expectIssue(input({ quality: { ...input().quality, reasonCodes: [QuoteQualityReasonCode.MissingSize, QuoteQualityReasonCode.MissingSize] } }), CanonicalQuoteValidationIssueCode.DuplicateReasonCode);
});

test("missing provider identity is rejected", () => {
  expectIssue(input({ source: { ...input().source, providerId: "" } }), CanonicalQuoteValidationIssueCode.InvalidSource);
});

test("provider source remains traceable without raw payload", () => {
  const quote = createCanonicalQuote(input());
  assertEqual(quote.source.providerId, "provider:fixture", "provider ID");
  const serialized = JSON.stringify(quote);
  for (const forbidden of ["rawPayload", "headers", "credential", "apiKey"]) assertTrue(!serialized.includes(forbidden), `${forbidden} absent`);
});

test("provider-native extension fields are stripped", () => {
  const quote = createCanonicalQuote({ ...input(), providerPayload: { bid_px: "224.1234" } });
  assertTrue(!JSON.stringify(quote).includes("bid_px"), "provider field absent");
});

test("tampered quote ID is rejected", () => {
  const quote = createCanonicalQuote(input());
  expectRecordIssue({ ...quote, quoteId: "quote:0000000000000000" }, CanonicalQuoteValidationIssueCode.InvalidQuoteId);
});

test("tampered fingerprint is rejected", () => {
  const quote = createCanonicalQuote(input());
  expectRecordIssue({ ...quote, fingerprint: "fnv1a64:0000000000000000" }, CanonicalQuoteValidationIssueCode.InvalidFingerprint);
});

test("constructor rejects malformed input", () => {
  expectError(() => createCanonicalQuote({}), CanonicalQuoteValidationIssueCode.InvalidInstrument);
});

test("validation issues have deterministic ordering", () => {
  const result = validateCanonicalQuoteInput({});
  const sorted = [...result.issues].sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
  assertEqual(JSON.stringify(result.issues), JSON.stringify(sorted), "issue order");
});

test("canonical quote module exposes no AI, network, routing, or execution API", () => {
  const functions = [createCanonicalQuote, validateCanonicalQuote, serializeCanonicalQuote].map((entry) => entry.name).join("|").toLowerCase();
  for (const forbidden of ["ai", "fetch", "network", "route", "execute", "trade"]) assertTrue(!functions.includes(forbidden), `${forbidden} absent`);
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error: unknown) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`Canonical Quote tests passed: ${String(passed)}/${String(tests.length)}.`);
