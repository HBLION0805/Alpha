import {
  CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  InstrumentAssetClass,
  InstrumentStatus,
  InstrumentType,
  type CanonicalInstrument,
} from "../../contracts/CanonicalInstrument";
import {
  CANONICAL_BAR_SCHEMA_VERSION,
  BarAdjustmentState,
  BarDeliveryTiming,
  BarDerivationStatus,
  BarFreshnessStatus,
  BarInterval,
  BarMarketCoverage,
  BarQualityReasonCode,
  BarQuantityUnit,
  BarSessionType,
  CanonicalBarStatus,
  CanonicalBarValidationIssueCode,
  type CanonicalBar,
  type CanonicalBarInput,
} from "../../contracts/CanonicalBar";
import type { CanonicalMarketBar } from "../../contracts/MarketData";
import {
  CanonicalBarValidationError,
  canonicalBarContentEquals,
  canonicalBarFingerprintEquals,
  canonicalBarIdentityEquals,
  createCanonicalBar,
  isCanonicalBarId,
  serializeCanonicalBar,
  validateCanonicalBar,
  validateCanonicalBarInput,
} from "./CanonicalBar";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function expectIssue(value: unknown, code: CanonicalBarValidationIssueCode): void {
  const result = validateCanonicalBarInput(value);
  assertTrue(result.issues.some((entry) => entry.code === code), `issue ${code}`);
}

function expectRecordIssue(value: unknown, code: CanonicalBarValidationIssueCode): void {
  const result = validateCanonicalBar(value);
  assertTrue(result.issues.some((entry) => entry.code === code), `record issue ${code}`);
}

function expectError(run: () => unknown, code: CanonicalBarValidationIssueCode): void {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof CanonicalBarValidationError && error.issues.some((entry) => entry.code === code)) return;
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

function input(overrides: Partial<CanonicalBarInput> = {}): CanonicalBarInput {
  return {
    schemaVersion: CANONICAL_BAR_SCHEMA_VERSION,
    instrument: instrument(),
    interval: BarInterval.FiveMinutes,
    intervalStart: "2026-07-20T14:30:00.000Z",
    intervalEnd: "2026-07-20T14:35:00.000Z",
    observationTime: "2026-07-20T14:35:00.000Z",
    providerPublishedAt: "2026-07-20T14:35:00.500Z",
    receivedAt: "2026-07-20T14:35:01.000Z",
    normalizedAt: "2026-07-20T14:35:02.000Z",
    value: {
      open: { atomicValue: "2240000", scale: 4 },
      high: { atomicValue: "2245000", scale: 4 },
      low: { atomicValue: "2239000", scale: 4 },
      close: { atomicValue: "2243000", scale: 4 },
      volume: { atomicValue: "12500", scale: 0 },
    },
    currency: "USD",
    quantityUnit: BarQuantityUnit.BaseUnits,
    status: CanonicalBarStatus.Final,
    session: {
      sessionType: BarSessionType.Regular,
      sessionDate: "2026-07-20",
      timezone: "America/New_York",
    },
    adjustment: BarAdjustmentState.Raw,
    quality: {
      policyId: "market-data-policy:default",
      policyVersion: "1.0",
      evaluatedAt: "2026-07-20T14:35:10.000Z",
      maxAgeSeconds: 60,
      freshness: BarFreshnessStatus.Current,
      deliveryTiming: BarDeliveryTiming.RealTime,
      marketCoverage: BarMarketCoverage.FullMarket,
      derivation: BarDerivationStatus.ProviderReported,
      reasonCodes: [],
    },
    source: {
      providerId: "provider:fixture",
      adapterId: "adapter:fixture",
      adapterVersion: "1.0",
      sourceReference: "fixture:bar:1",
      contentIntegrityReference: "sha256:fixture-bar-1",
    },
    ...overrides,
  };
}

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("valid bar constructs with deterministic identity", () => {
  const bar = createCanonicalBar(input());
  assertTrue(isCanonicalBarId(bar.barId), "canonical bar ID");
  assertTrue(bar.fingerprint.startsWith("fnv1a64:"), "fingerprint");
});

test("all initial intraday intervals enforce their exact duration", () => {
  const intervals: ReadonlyArray<readonly [BarInterval, string]> = [
    [BarInterval.OneMinute, "2026-07-20T14:31:00.000Z"],
    [BarInterval.FiveMinutes, "2026-07-20T14:35:00.000Z"],
    [BarInterval.FifteenMinutes, "2026-07-20T14:45:00.000Z"],
    [BarInterval.OneHour, "2026-07-20T15:30:00.000Z"],
  ];
  for (const [interval, intervalEnd] of intervals) {
    const bar = createCanonicalBar(input({
      interval,
      intervalEnd,
      observationTime: intervalEnd,
      providerPublishedAt: intervalEnd,
      receivedAt: intervalEnd,
      normalizedAt: intervalEnd,
      quality: { ...input().quality, evaluatedAt: intervalEnd },
    }));
    assertEqual(bar.interval, interval, `interval ${interval}`);
  }
});

test("one-day interval preserves explicit session boundaries without a 24-hour assumption", () => {
  const bar = createCanonicalBar(input({
    interval: BarInterval.OneDay,
    intervalStart: "2026-07-20T13:30:00.000Z",
    intervalEnd: "2026-07-20T20:00:00.000Z",
    observationTime: "2026-07-20T20:00:00.000Z",
    providerPublishedAt: "2026-07-20T20:00:01.000Z",
    receivedAt: "2026-07-20T20:00:02.000Z",
    normalizedAt: "2026-07-20T20:00:03.000Z",
    quality: { ...input().quality, evaluatedAt: "2026-07-20T20:00:10.000Z" },
  }));
  assertEqual(bar.interval, BarInterval.OneDay, "daily interval");
});

test("bar and nested values are deeply immutable", () => {
  const bar = createCanonicalBar(input());
  assertTrue(Object.isFrozen(bar), "bar frozen");
  assertTrue(Object.isFrozen(bar.instrument), "instrument frozen");
  assertTrue(Object.isFrozen(bar.value), "value frozen");
  assertTrue(Object.isFrozen(bar.session), "session frozen");
  assertTrue(Object.isFrozen(bar.quality.reasonCodes), "reason codes frozen");
});

test("serialization is deterministic and round-trippable", () => {
  const bar = createCanonicalBar(input());
  const serialized = serializeCanonicalBar(bar);
  assertEqual(serialized, serializeCanonicalBar(bar), "serialization");
  assertEqual(JSON.parse(serialized).barId, bar.barId, "round-trip ID");
});

test("identical input produces deterministic ID and fingerprint", () => {
  const left = createCanonicalBar(input());
  const right = createCanonicalBar(input());
  assertEqual(left.barId, right.barId, "bar ID");
  assertEqual(left.fingerprint, right.fingerprint, "fingerprint");
});

test("identity equality is separate from content equality", () => {
  const left = createCanonicalBar(input());
  const right = createCanonicalBar(input({
    value: { ...input().value, close: { atomicValue: "2242000", scale: 4 } },
  }));
  assertTrue(canonicalBarIdentityEquals(left, right), "same identity");
  assertTrue(!canonicalBarContentEquals(left, right), "different content");
  assertTrue(!canonicalBarFingerprintEquals(left, right), "different fingerprint");
});

test("different source observation changes canonical identity", () => {
  const left = createCanonicalBar(input());
  const right = createCanonicalBar(input({ source: { ...input().source, sourceReference: "fixture:bar:2" } }));
  assertTrue(!canonicalBarIdentityEquals(left, right), "different identity");
});

test("invalid canonical instrument is rejected", () => {
  expectIssue(input({ instrument: { ...instrument(), instrumentId: "AAPL" } }), CanonicalBarValidationIssueCode.InvalidInstrument);
});

test("invalid provider identity is rejected", () => {
  expectIssue(input({ source: { ...input().source, providerId: "" } }), CanonicalBarValidationIssueCode.InvalidSource);
});

test("invalid currency is rejected", () => {
  expectIssue(input({ currency: "USDT" }), CanonicalBarValidationIssueCode.InvalidCurrency);
});

test("currency must match canonical instrument", () => {
  expectIssue(input({ currency: "EUR" }), CanonicalBarValidationIssueCode.CurrencyMismatch);
});

test("invalid quantity unit is rejected", () => {
  expectIssue({ ...input(), quantityUnit: "SHARES" }, CanonicalBarValidationIssueCode.InvalidQuantityUnit);
});

test("negative price is rejected", () => {
  expectIssue(input({ value: { ...input().value, open: { atomicValue: "-1", scale: 4 } } }), CanonicalBarValidationIssueCode.InvalidPrice);
});

test("negative volume is rejected", () => {
  expectIssue(input({ value: { ...input().value, volume: { atomicValue: "-1", scale: 0 } } }), CanonicalBarValidationIssueCode.InvalidVolume);
});

test("high below open is rejected", () => {
  expectIssue(input({ value: { ...input().value, high: { atomicValue: "2239500", scale: 4 } } }), CanonicalBarValidationIssueCode.InvalidOhlcRelationship);
});

test("high below close is rejected", () => {
  expectIssue(input({ value: { ...input().value, high: { atomicValue: "2242000", scale: 4 } } }), CanonicalBarValidationIssueCode.InvalidOhlcRelationship);
});

test("low above open is rejected", () => {
  expectIssue(input({ value: { ...input().value, low: { atomicValue: "2241000", scale: 4 } } }), CanonicalBarValidationIssueCode.InvalidOhlcRelationship);
});

test("low above close is rejected", () => {
  expectIssue(input({ value: { ...input().value, low: { atomicValue: "2244000", scale: 4 } } }), CanonicalBarValidationIssueCode.InvalidOhlcRelationship);
});

test("high below low is rejected", () => {
  expectIssue(input({ value: { ...input().value, high: { atomicValue: "2238000", scale: 4 } } }), CanonicalBarValidationIssueCode.InvalidOhlcRelationship);
});

test("interval end must follow interval start", () => {
  expectIssue(input({ intervalEnd: input().intervalStart }), CanonicalBarValidationIssueCode.InvalidIntervalOrder);
});

test("intraday interval duration must match its canonical code", () => {
  expectIssue(input({ intervalEnd: "2026-07-20T14:36:00.000Z", observationTime: "2026-07-20T14:36:00.000Z" }), CanonicalBarValidationIssueCode.IntervalDurationMismatch);
});

test("unsupported interval is rejected", () => {
  expectIssue({ ...input(), interval: "PT2M" }, CanonicalBarValidationIssueCode.UnsupportedInterval);
});

test("invalid timestamps are rejected", () => {
  expectIssue({ ...input(), intervalStart: "2026-07-20 14:30" }, CanonicalBarValidationIssueCode.InvalidTimestamp);
});

test("observation cannot precede interval start", () => {
  expectIssue(input({ observationTime: "2026-07-20T14:29:59.000Z" }), CanonicalBarValidationIssueCode.InvalidTimestampOrder);
});

test("final bar cannot be observed before interval end", () => {
  expectIssue(input({ observationTime: "2026-07-20T14:34:59.000Z" }), CanonicalBarValidationIssueCode.InvalidTimestampOrder);
});

test("partial bar cannot be observed at or after interval end", () => {
  expectIssue(input({
    status: CanonicalBarStatus.Partial,
    quality: { ...input().quality, reasonCodes: [BarQualityReasonCode.PartialBar] },
  }), CanonicalBarValidationIssueCode.InvalidTimestampOrder);
});

test("valid partial bar preserves explicit lifecycle quality", () => {
  const bar = createCanonicalBar(input({
    status: CanonicalBarStatus.Partial,
    observationTime: "2026-07-20T14:34:00.000Z",
    providerPublishedAt: "2026-07-20T14:34:00.500Z",
    receivedAt: "2026-07-20T14:34:01.000Z",
    normalizedAt: "2026-07-20T14:34:02.000Z",
    quality: { ...input().quality, evaluatedAt: "2026-07-20T14:34:10.000Z", reasonCodes: [BarQualityReasonCode.PartialBar] },
  }));
  assertEqual(bar.status, CanonicalBarStatus.Partial, "partial status");
});

test("provider publication chronology is validated", () => {
  expectIssue(input({ providerPublishedAt: "2026-07-20T14:34:59.000Z" }), CanonicalBarValidationIssueCode.InvalidTimestampOrder);
});

test("receipt cannot precede observation", () => {
  expectIssue(input({ receivedAt: "2026-07-20T14:34:59.000Z" }), CanonicalBarValidationIssueCode.InvalidTimestampOrder);
});

test("normalization cannot precede receipt", () => {
  expectIssue(input({ normalizedAt: "2026-07-20T14:35:00.750Z" }), CanonicalBarValidationIssueCode.InvalidTimestampOrder);
});

test("quality evaluation cannot precede normalization", () => {
  expectIssue(input({ quality: { ...input().quality, evaluatedAt: "2026-07-20T14:35:01.500Z" } }), CanonicalBarValidationIssueCode.InvalidTimestampOrder);
});

test("stale quality classification is deterministic", () => {
  const bar = createCanonicalBar(input({
    quality: {
      ...input().quality,
      maxAgeSeconds: 5,
      freshness: BarFreshnessStatus.Stale,
      reasonCodes: [BarQualityReasonCode.StaleInterval],
    },
  }));
  assertEqual(bar.quality.freshness, BarFreshnessStatus.Stale, "stale freshness");
});

test("stale observation cannot be marked current", () => {
  expectIssue(input({ quality: { ...input().quality, maxAgeSeconds: 5 } }), CanonicalBarValidationIssueCode.QualityStatusMismatch);
});

test("partial status requires an explicit reason", () => {
  expectIssue(input({ status: CanonicalBarStatus.Partial, observationTime: "2026-07-20T14:34:00.000Z" }), CanonicalBarValidationIssueCode.QualityStatusMismatch);
});

test("unknown market coverage requires an explicit reason", () => {
  expectIssue(input({ quality: { ...input().quality, marketCoverage: BarMarketCoverage.Unknown } }), CanonicalBarValidationIssueCode.QualityStatusMismatch);
});

test("derived values require an explicit reason", () => {
  expectIssue(input({ quality: { ...input().quality, derivation: BarDerivationStatus.Derived } }), CanonicalBarValidationIssueCode.QualityStatusMismatch);
});

test("invalid quality metadata is rejected", () => {
  expectIssue({ ...input(), quality: { ...input().quality, deliveryTiming: "FAST" } }, CanonicalBarValidationIssueCode.InvalidQuality);
});

test("duplicate quality reasons are rejected", () => {
  expectIssue(input({ quality: { ...input().quality, reasonCodes: [BarQualityReasonCode.PartialBar, BarQualityReasonCode.PartialBar] } }), CanonicalBarValidationIssueCode.DuplicateReasonCode);
});

test("invalid adjustment state is rejected", () => {
  expectIssue({ ...input(), adjustment: "ADJUSTED" }, CanonicalBarValidationIssueCode.InvalidAdjustmentState);
});

test("unknown adjustment state requires an explicit reason", () => {
  expectIssue(input({ adjustment: BarAdjustmentState.Unknown }), CanonicalBarValidationIssueCode.QualityStatusMismatch);
});

test("unknown adjustment can be represented without pretending it is raw", () => {
  const bar = createCanonicalBar(input({
    adjustment: BarAdjustmentState.Unknown,
    quality: { ...input().quality, reasonCodes: [BarQualityReasonCode.UnknownAdjustment] },
  }));
  assertEqual(bar.adjustment, BarAdjustmentState.Unknown, "unknown adjustment");
});

test("invalid session date is rejected", () => {
  expectIssue(input({ session: { ...input().session, sessionDate: "2026-02-30" } }), CanonicalBarValidationIssueCode.InvalidSession);
});

test("implicit timezone text is rejected", () => {
  expectIssue(input({ session: { ...input().session, timezone: "EST" } }), CanonicalBarValidationIssueCode.InvalidSession);
});

test("provider-native payload is excluded", () => {
  const bar = createCanonicalBar({ ...input(), rawPayload: { o: "224.00", secret_header: "value" } });
  const serialized = JSON.stringify(bar);
  for (const forbidden of ["rawPayload", "secret_header", "providerBarId", "apiKey"]) {
    assertTrue(!serialized.includes(forbidden), `${forbidden} absent`);
  }
});

test("provider-native extension fields are stripped", () => {
  const bar = createCanonicalBar({
    ...input(),
    providerInterval: "5min",
    source: { ...input().source, providerSymbol: "AAPL.US", providerInstrumentId: "provider-instrument:123" },
  });
  const serialized = JSON.stringify(bar);
  assertTrue(!serialized.includes("providerInterval"), "provider interval absent");
  assertTrue(!serialized.includes("providerSymbol"), "provider symbol absent");
  assertTrue(!serialized.includes("providerInstrumentId"), "provider instrument ID absent");
});

test("fixed-decimal OHLCV precision is preserved", () => {
  const bar = createCanonicalBar(input());
  assertDeepEqual(bar.value.open, { atomicValue: "2240000", scale: 4 }, "open precision");
  assertDeepEqual(bar.value.volume, { atomicValue: "12500", scale: 0 }, "volume precision");
});

test("source input remains unchanged", () => {
  const source = input();
  const before = JSON.stringify(source);
  createCanonicalBar(source);
  assertEqual(JSON.stringify(source), before, "source input");
});

test("tampered bar ID is rejected", () => {
  const bar = createCanonicalBar(input());
  expectRecordIssue({ ...bar, barId: "bar:0000000000000000" }, CanonicalBarValidationIssueCode.InvalidBarId);
});

test("tampered fingerprint is rejected", () => {
  const bar = createCanonicalBar(input());
  expectRecordIssue({ ...bar, fingerprint: "fnv1a64:0000000000000000" }, CanonicalBarValidationIssueCode.InvalidFingerprint);
});

test("constructor rejects malformed input", () => {
  expectError(() => createCanonicalBar({}), CanonicalBarValidationIssueCode.InvalidInstrument);
});

test("validation issues have deterministic ordering", () => {
  const result = validateCanonicalBarInput({});
  const sorted = [...result.issues].sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
  assertEqual(JSON.stringify(result.issues), JSON.stringify(sorted), "issue order");
});

test("Market Data compatibility uses the authoritative Canonical Bar type", () => {
  const bar: CanonicalMarketBar = createCanonicalBar(input());
  assertEqual(bar.schemaVersion, CANONICAL_BAR_SCHEMA_VERSION, "Market Data bar schema");
});

test("canonical bar module exposes no AI, network, provider retrieval, or execution API", () => {
  const functions = [createCanonicalBar, validateCanonicalBar, serializeCanonicalBar].map((entry) => entry.name).join("|").toLowerCase();
  for (const forbidden of ["ai", "fetch", "network", "route", "execute", "stream", "persist"]) {
    assertTrue(!functions.includes(forbidden), `${forbidden} absent`);
  }
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

console.log(`Canonical Bar tests passed: ${String(passed)}/${String(tests.length)}.`);
