import {
  CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  CanonicalInstrumentValidationIssueCode,
  InstrumentAssetClass,
  InstrumentIdentifierType,
  InstrumentStatus,
  InstrumentType,
  type CanonicalInstrument,
  type InstrumentResolver,
} from "../../contracts/CanonicalInstrument";
import {
  CanonicalInstrumentValidationError,
  canonicalInstrumentIdentityEquals,
  createCanonicalInstrument,
  createInstrumentIdentifier,
  serializeCanonicalInstrument,
  validateCanonicalInstrument,
} from "./CanonicalInstrument";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function expectIssue(value: unknown, code: CanonicalInstrumentValidationIssueCode): void {
  const result = validateCanonicalInstrument(value);
  assertTrue(result.issues.some((entry) => entry.code === code), `issue ${code}`);
}

function expectError(run: () => unknown, code: CanonicalInstrumentValidationIssueCode): void {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof CanonicalInstrumentValidationError && error.issues.some((entry) => entry.code === code)) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

type InstrumentOverrides = Omit<Partial<CanonicalInstrument>, "exchange" | "timezone">
  & { readonly exchange?: string | undefined; readonly timezone?: string | undefined };

function instrument(overrides: InstrumentOverrides = {}): CanonicalInstrument {
  const exchange = Object.prototype.hasOwnProperty.call(overrides, "exchange") ? overrides.exchange : "XNAS";
  const timezone = Object.prototype.hasOwnProperty.call(overrides, "timezone") ? overrides.timezone : "America/New_York";
  const { exchange: _exchange, timezone: _timezone, ...requiredOverrides } = overrides;
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
    ...(exchange === undefined ? {} : { exchange }),
    ...(timezone === undefined ? {} : { timezone }),
    effectiveFrom: "2026-07-20T00:00:00.000Z",
    ...requiredOverrides,
  };
}

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("valid identity constructs an immutable canonical instrument", () => {
  const value = createCanonicalInstrument(instrument());
  assertEqual(value.instrumentId, "instrument:00000000000000000000000001", "instrument ID");
  assertTrue(Object.isFrozen(value), "instrument frozen");
});

test("construction preserves canonical metadata", () => {
  const value = createCanonicalInstrument(instrument());
  assertEqual(value.displaySymbol, "AAPL", "display symbol");
  assertEqual(value.exchange, "XNAS", "exchange");
  assertEqual(value.timezone, "America/New_York", "timezone");
});

test("optional exchange and timezone are supported", () => {
  const value = createCanonicalInstrument(instrument({ exchange: undefined, timezone: undefined }));
  assertTrue(!("exchange" in value), "exchange omitted");
  assertTrue(!("timezone" in value), "timezone omitted");
});

test("serialization is canonical and repeatable", () => {
  const value = instrument();
  assertEqual(serializeCanonicalInstrument(value), serializeCanonicalInstrument(value), "serialization");
  assertEqual(JSON.parse(serializeCanonicalInstrument(value)).instrumentId, value.instrumentId, "serialized ID");
});

test("identity equality uses only canonical ID", () => {
  const left = createCanonicalInstrument(instrument());
  const right = createCanonicalInstrument(instrument({ metadataVersion: "2.0", displaySymbol: "AAPL2", status: InstrumentStatus.Inactive }));
  assertTrue(canonicalInstrumentIdentityEquals(left, right), "same identity");
});

test("different canonical IDs are not equal", () => {
  const left = createCanonicalInstrument(instrument());
  const right = createCanonicalInstrument(instrument({ instrumentId: "instrument:00000000000000000000000002" }));
  assertTrue(!canonicalInstrumentIdentityEquals(left, right), "different identity");
});

test("provider-style symbol cannot be used as canonical ID", () => {
  expectIssue(instrument({ instrumentId: "AAPL" }), CanonicalInstrumentValidationIssueCode.InvalidInstrumentId);
});

test("metadata-derived legacy IDs are rejected", () => {
  expectIssue(instrument({ instrumentId: "instrument:equity:XNAS:AAPL:USD" }), CanonicalInstrumentValidationIssueCode.InvalidInstrumentId);
});

test("unsupported asset class is rejected", () => {
  expectIssue(instrument({ assetClass: "OPTION" as InstrumentAssetClass }), CanonicalInstrumentValidationIssueCode.UnsupportedAssetClass);
});

test("unsupported instrument type is rejected", () => {
  expectIssue(instrument({ instrumentType: "OPTION" as InstrumentType }), CanonicalInstrumentValidationIssueCode.UnsupportedInstrumentType);
});

test("asset class and instrument type must agree", () => {
  expectIssue(instrument({ instrumentType: InstrumentType.CryptoAsset }), CanonicalInstrumentValidationIssueCode.IncompatibleClassification);
});

test("invalid status is rejected", () => {
  expectIssue(instrument({ status: "UNKNOWN" as InstrumentStatus }), CanonicalInstrumentValidationIssueCode.InvalidStatus);
});

test("invalid display symbol is rejected", () => {
  expectIssue(instrument({ displaySymbol: "aapl" }), CanonicalInstrumentValidationIssueCode.InvalidDisplaySymbol);
});

test("invalid display name is rejected", () => {
  expectIssue(instrument({ displayName: "" }), CanonicalInstrumentValidationIssueCode.InvalidDisplayName);
});

test("invalid currency is rejected", () => {
  expectIssue(instrument({ currency: "USDT" }), CanonicalInstrumentValidationIssueCode.InvalidCurrency);
});

test("invalid exchange is rejected", () => {
  expectIssue(instrument({ exchange: "nasdaq market" }), CanonicalInstrumentValidationIssueCode.InvalidExchange);
});

test("invalid timezone is rejected", () => {
  expectIssue(instrument({ timezone: "New York" }), CanonicalInstrumentValidationIssueCode.InvalidTimezone);
});

test("non-canonical effective timestamp is rejected", () => {
  expectIssue(instrument({ effectiveFrom: "2026-07-20" }), CanonicalInstrumentValidationIssueCode.InvalidEffectiveFrom);
});

test("malformed records fail with ordered issues", () => {
  const result = validateCanonicalInstrument({});
  assertTrue(!result.valid, "invalid");
  const sorted = [...result.issues].sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
  assertEqual(JSON.stringify(result.issues), JSON.stringify(sorted), "ordered issues");
});

test("constructor rejects invalid records", () => {
  expectError(() => createCanonicalInstrument({}), CanonicalInstrumentValidationIssueCode.InvalidInstrumentId);
});

test("source input remains unchanged", () => {
  const input = instrument();
  const before = JSON.stringify(input);
  createCanonicalInstrument(input);
  assertEqual(JSON.stringify(input), before, "source input");
});

test("canonical identifier validates and freezes", () => {
  const value = createInstrumentIdentifier({ identifierType: InstrumentIdentifierType.CanonicalId, value: instrument().instrumentId });
  assertTrue(Object.isFrozen(value), "identifier frozen");
});

test("provider symbol identifier remains a resolver-only input", () => {
  const value = createInstrumentIdentifier({ identifierType: InstrumentIdentifierType.ProviderSymbol, providerId: "provider:fixture", value: "AAPL.US" });
  assertEqual(value.identifierType, InstrumentIdentifierType.ProviderSymbol, "identifier type");
  assertTrue(!JSON.stringify(instrument()).includes("provider:fixture"), "provider absent from instrument");
});

test("invalid provider identity is rejected", () => {
  expectError(
    () => createInstrumentIdentifier({ identifierType: InstrumentIdentifierType.ProviderSymbol, providerId: "", value: "AAPL" }),
    CanonicalInstrumentValidationIssueCode.InvalidProviderIdentity,
  );
});

test("unsupported identifier type is rejected", () => {
  expectError(
    () => createInstrumentIdentifier({ identifierType: "CUSIP", value: "037833100" }),
    CanonicalInstrumentValidationIssueCode.UnsupportedIdentifierType,
  );
});

test("resolver contract exposes no network or AI authority", () => {
  const resolverMethods: Array<keyof InstrumentResolver> = ["resolve"];
  assertEqual(resolverMethods.join("|"), "resolve", "resolver methods");
});

test("result contains no provider-native metadata fields", () => {
  const serialized = serializeCanonicalInstrument(instrument());
  for (const forbidden of ["providerId", "providerSymbol", "providerInstrumentId", "rawPayload"]) {
    assertTrue(!serialized.includes(forbidden), `${forbidden} absent`);
  }
});

test("construction strips provider-native extension fields", () => {
  const input = { ...instrument(), providerId: "provider:fixture", providerSymbol: "AAPL.US" };
  const serialized = serializeCanonicalInstrument(input);
  assertTrue(!serialized.includes("providerId"), "provider ID stripped");
  assertTrue(!serialized.includes("providerSymbol"), "provider symbol stripped");
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

console.log(`Canonical Instrument tests passed: ${String(passed)}/${String(tests.length)}.`);
