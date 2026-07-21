import {
  CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  InstrumentAssetClass,
  InstrumentStatus,
  InstrumentType,
} from "../../contracts/CanonicalInstrument";
import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataAdapterErrorCategory,
  MarketDataCapability,
  MarketDataDuplicatePolicy,
  MarketDataIssueCode,
  MarketDataNormalizationStatus,
  MarketDataOperation,
  MarketDataProviderHealthStatus,
  MarketDataQualityStatus,
  MarketDataQuantityUnit,
  MarketDataResultStatus,
  MarketDataTransportStatus,
  MarketDataType,
  MarketDataValidationStatus,
  type LatestQuoteRequest,
  type MarketDataNormalizationResult,
  type MarketDataProviderAdapter,
  type MarketDataProviderDescriptor,
  type MarketDataProviderHealth,
  type MarketDataRawResponse,
} from "../../contracts/MarketData";
import { MarketDataConfigurationError, MarketDataService } from "./MarketDataService";
import { MarketDataCompositionScope } from "../../contracts/MarketDataProviderComposition";
import {
  MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  MarketDataProviderNamePolicy,
  MarketDataProviderStatus,
  type MarketDataProviderMetadata,
} from "../../contracts/MarketDataProviderRegistry";
import { InMemoryMarketDataProviderRegistry } from "../market-data-provider-registry/MarketDataProviderRegistry";
import {
  ImmutableMarketDataProviderComposition,
  MarketDataProviderCompositionError,
} from "../market-data-provider-composition/MarketDataProviderComposition";

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

function assertIssue(result: Awaited<ReturnType<MarketDataService["getLatestQuote"]>>, code: MarketDataIssueCode): void {
  assertTrue(result.blockers.some((blocker) => blocker.code === code), `blocker ${code}`);
}

const NOW = "2026-07-20T12:00:00.000Z";
const OBSERVED = "2026-07-20T11:59:30.000Z";
const RECEIVED = "2026-07-20T11:59:31.000Z";
const NORMALIZED = "2026-07-20T11:59:32.000Z";

function request(overrides: Record<string, unknown> = {}): LatestQuoteRequest {
  return {
    schemaVersion: MARKET_DATA_SCHEMA_VERSION,
    requestId: "request:quote:1",
    operation: MarketDataOperation.LatestQuote,
    providerId: "provider:fixture",
    instrument: { instrumentId: "instrument:00000000000000000000000001" },
    requestedAt: "2026-07-20T11:59:29.000Z",
    evaluatedAt: NOW,
    policy: {
      schemaVersion: MARKET_DATA_SCHEMA_VERSION,
      policyId: "market-data-policy:default",
      version: "1.0",
      allowedProviderIds: ["provider:fixture", "provider:secondary"],
      requiredCapabilities: [MarketDataCapability.LatestQuote],
      duplicatePolicy: MarketDataDuplicatePolicy.RejectExact,
      freshnessRules: [{
        assetClass: InstrumentAssetClass.Equity,
        dataType: MarketDataType.Quote,
        maxAgeSeconds: 60,
        maxPriceScale: 4,
        allowedCurrencies: ["USD"],
        requireObservationTime: true,
      }],
    },
    trace: { correlationId: "correlation:market-data:1" },
    ...overrides,
  } as LatestQuoteRequest;
}

function normalized(overrides: Record<string, unknown> = {}): MarketDataNormalizationResult {
  return {
    providerId: "provider:fixture",
    status: MarketDataNormalizationStatus.Normalized,
    data: {
      instrument: {
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
      },
      bidPrice: { atomicValue: "2241234", scale: 4 },
      askPrice: { atomicValue: "2241300", scale: 4 },
      bidSize: { atomicValue: "100", scale: 0 },
      askSize: { atomicValue: "120", scale: 0 },
      quantityUnit: MarketDataQuantityUnit.BaseUnits,
      observationTime: OBSERVED,
      providerPublishedAt: "2026-07-20T11:59:30.500Z",
      receivedAt: RECEIVED,
      normalizedAt: NORMALIZED,
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
    },
    blockers: [],
    warnings: [],
  };
}

class FixtureAdapter implements MarketDataProviderAdapter {
  public fetchCount = 0;
  public shouldThrow = false;
  public shouldThrowDuringNormalization = false;
  public raw: MarketDataRawResponse = {
    providerId: "provider:fixture",
    receivedAt: RECEIVED,
    payload: { bid_px: "224.1234", secret_provider_field: "must-not-leak" },
  };
  public normalization: MarketDataNormalizationResult = normalized();

  public constructor(
    public descriptor: MarketDataProviderDescriptor = {
      schemaVersion: MARKET_DATA_SCHEMA_VERSION,
      adapterId: "adapter:fixture",
      adapterVersion: "1.0",
      providerId: "provider:fixture",
      capability: MarketDataCapability.LatestQuote,
      supportedAssetClasses: [InstrumentAssetClass.Equity],
    },
    public health: MarketDataProviderHealth = {
      providerId: "provider:fixture",
      status: MarketDataProviderHealthStatus.Available,
      observedAt: NOW,
    },
  ) {}

  public getDescriptor() { return this.descriptor; }
  public getHealth() { return this.health; }
  public async fetchLatestQuote(): Promise<MarketDataRawResponse> {
    this.fetchCount += 1;
    if (this.shouldThrow) throw new Error("credential=secret-value; filesystem=C:\\private");
    return this.raw;
  }
  public normalizeLatestQuote() {
    if (this.shouldThrowDuringNormalization) throw new Error("unsafe normalization details");
    return this.normalization;
  }
  public normalizeError(_error: unknown, _request: Readonly<LatestQuoteRequest>, occurredAt: string) {
    return {
      providerId: this.descriptor.providerId,
      category: MarketDataAdapterErrorCategory.TransportFailure,
      safeCode: "UPSTREAM_FAILURE",
      safeMessage: "Provider request failed safely.",
      retryable: true,
      occurredAt,
    };
  }
}

function providerMetadata(overrides: Partial<MarketDataProviderMetadata> = {}): MarketDataProviderMetadata {
  return {
    schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
    metadataVersion: "1.0",
    identity: { providerId: "provider:fixture", displayName: "Fixture Provider" },
    status: MarketDataProviderStatus.Active,
    supportedAssetClasses: [InstrumentAssetClass.Equity],
    capabilities: [MarketDataCapability.Health, MarketDataCapability.LatestQuote],
    priority: 1,
    defaultEnabled: true,
    documentationReference: "docs/specifications/MARKET_DATA_LAYER.md",
    ...overrides,
  };
}

function system(
  adapter = new FixtureAdapter(),
  metadata = providerMetadata(),
  scope = MarketDataCompositionScope.EnabledActiveOnly,
): { service: MarketDataService; adapter: FixtureAdapter } {
  const registry = new InMemoryMarketDataProviderRegistry([metadata], {
    schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
    policyId: "provider-registry-policy:test",
    version: "1.0",
    displayNamePolicy: MarketDataProviderNamePolicy.RejectDuplicates,
  });
  const composition = new ImmutableMarketDataProviderComposition(registry, [adapter], [], scope);
  return { service: new MarketDataService(composition, { now: () => NOW }), adapter };
}

type Test = readonly [string, () => void | Promise<void>];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("provider capability declaration is validated and ordered", () => {
  const descriptor = system().service.listProviders()[0];
  assertDeepEqual(descriptor?.capabilities, [MarketDataCapability.Health, MarketDataCapability.LatestQuote], "capabilities");
  assertTrue(Object.isFrozen(descriptor), "descriptor immutable");
});

test("unsupported capability is explicit and avoids transport", async () => {
  let failed = false;
  try {
    system(new FixtureAdapter(), providerMetadata({ capabilities: [MarketDataCapability.Health] }));
  } catch (error) {
    failed = error instanceof MarketDataProviderCompositionError;
  }
  assertTrue(failed, "undeclared adapter capability rejected");
});

test("every policy-required capability must be declared", async () => {
  const value = request({ policy: { ...request().policy, requiredCapabilities: [MarketDataCapability.LatestQuote, MarketDataCapability.ResolveInstrument] } });
  const { service, adapter } = system();
  const result = await service.getLatestQuote(value);
  assertEqual(result.status, MarketDataResultStatus.Unsupported, "status");
  assertEqual(adapter.fetchCount, 0, "fetch count");
});

test("valid raw quote normalizes to a canonical quote", async () => {
  const result = await system().service.getLatestQuote(request());
  assertEqual(result.status, MarketDataResultStatus.Accepted, "status");
  assertEqual(result.validation.status, MarketDataValidationStatus.Passed, "validation");
  assertEqual(result.data?.value.bidPrice.atomicValue, "2241234", "bid atomic value");
});

test("provider payload remains behind the adapter boundary", async () => {
  const result = await system().service.getLatestQuote(request());
  const serialized = JSON.stringify(result);
  assertTrue(!serialized.includes("secret_provider_field"), "raw field absent");
  assertTrue(!serialized.includes("bid_px"), "provider schema absent");
});

test("missing required quote field fails closed", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ bidPrice: undefined });
  const result = await system(adapter).service.getLatestQuote(request());
  assertIssue(result, MarketDataIssueCode.InvalidNumericValue);
});

test("missing asset-class policy rule fails closed", async () => {
  const result = await system().service.getLatestQuote(request({ policy: { ...request().policy, freshnessRules: [{ ...request().policy.freshnessRules[0]!, assetClass: InstrumentAssetClass.Crypto }] } }));
  assertIssue(result, MarketDataIssueCode.MissingRequiredField);
});

test("undeclared provider asset class fails closed", async () => {
  const adapter = new FixtureAdapter({ ...new FixtureAdapter().descriptor, supportedAssetClasses: [InstrumentAssetClass.Crypto] });
  assertIssue(await system(adapter, providerMetadata({ supportedAssetClasses: [InstrumentAssetClass.Crypto] })).service.getLatestQuote(request()), MarketDataIssueCode.InvalidInstrumentIdentity);
});

test("invalid numeric value fails closed", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ askPrice: { atomicValue: "NaN", scale: 4 } });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.InvalidNumericValue);
});

test("ambiguous quantity units fail closed", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ quantityUnit: undefined });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.AmbiguousUnits);
});

test("invalid currency fails closed", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ instrument: { ...normalized().data!.instrument!, currency: "USDT" } });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.InvalidCurrency);
});

test("missing provider identity is rejected during registration", () => {
  const adapter = new FixtureAdapter({ ...new FixtureAdapter().descriptor, providerId: "" });
  let failed = false;
  try { system(adapter); } catch (error) { failed = error instanceof MarketDataProviderCompositionError; }
  assertTrue(failed, "registration rejected");
});

test("missing provenance fails closed", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ source: { ...normalized().data!.source!, sourceReference: "" } });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.MissingProvenance);
});

test("missing observation timestamp fails when policy requires it", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ observationTime: undefined });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.MissingObservationTime);
});

test("canonical quote rejects a missing observation timestamp even when legacy policy makes it optional", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ observationTime: undefined });
  const value = request({
    policy: {
      ...request().policy,
      freshnessRules: [{ ...request().policy.freshnessRules[0]!, requireObservationTime: false }],
    },
  });
  assertIssue(await system(adapter).service.getLatestQuote(value), MarketDataIssueCode.MissingObservationTime);
});

test("observation and receipt timestamps remain distinct", async () => {
  const result = await system().service.getLatestQuote(request());
  assertEqual(result.observationTime, OBSERVED, "observation");
  assertEqual(result.receivedAt, RECEIVED, "receipt");
});

test("stale data classification is deterministic", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ observationTime: "2026-07-20T11:58:00.000Z" });
  const result = await system(adapter).service.getLatestQuote(request());
  assertEqual(result.qualityStatus, MarketDataQualityStatus.Stale, "quality");
  assertIssue(result, MarketDataIssueCode.StaleObservation);
});

test("out-of-order observations are rejected", async () => {
  const result = await system().service.getLatestQuote(request({ previousObservationTime: "2026-07-20T11:59:45.000Z" }));
  assertEqual(result.qualityStatus, MarketDataQualityStatus.OutOfOrder, "quality");
});

test("exact duplicate observations are rejected by policy", async () => {
  const first = await system().service.getLatestQuote(request());
  const second = await system().service.getLatestQuote(request({ previousFingerprint: first.data?.fingerprint }));
  assertIssue(second, MarketDataIssueCode.DuplicateObservation);
});

test("exact duplicates may be accepted with an explicit warning", async () => {
  const first = await system().service.getLatestQuote(request());
  const duplicateRequest = request({
    previousFingerprint: first.data?.fingerprint,
    policy: { ...request().policy, duplicatePolicy: MarketDataDuplicatePolicy.AllowExactWithWarning },
  });
  const second = await system().service.getLatestQuote(duplicateRequest);
  assertEqual(second.status, MarketDataResultStatus.Accepted, "accepted");
  assertTrue(second.warnings.some((warning) => warning.code === MarketDataIssueCode.DuplicateObservation), "duplicate warning");
});

test("canonical instrument identity is provider independent", async () => {
  const result = await system().service.getLatestQuote(request());
  assertEqual(result.data?.instrument.instrumentId, "instrument:00000000000000000000000001", "canonical ID");
  assertTrue(result.data?.instrument.instrumentId !== result.data?.source.providerInstrumentId, "not provider ID");
});

test("different aliases map to the same canonical identity", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ source: { ...normalized().data!.source!, providerSymbol: "US0378331005" } });
  const result = await system(adapter).service.getLatestQuote(request());
  assertEqual(result.data?.instrument.instrumentId, "instrument:00000000000000000000000001", "canonical ID");
  assertEqual(result.data?.source.providerSymbol, "US0378331005", "source alias");
});

test("fixed-decimal price precision is preserved", async () => {
  const result = await system().service.getLatestQuote(request());
  assertDeepEqual(result.data?.value.bidPrice, { atomicValue: "2241234", scale: 4 }, "fixed decimal");
});

test("result is serializable", async () => {
  const result = await system().service.getLatestQuote(request());
  assertDeepEqual(JSON.parse(JSON.stringify(result)), result, "serialized result");
});

test("result and canonical data are deeply immutable", async () => {
  const result = await system().service.getLatestQuote(request());
  assertTrue(Object.isFrozen(result), "result frozen");
  assertTrue(Object.isFrozen(result.data), "data frozen");
  assertTrue(Object.isFrozen(result.data?.instrument), "instrument frozen");
});

test("result ordering is deterministic", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ bidPrice: undefined, askPrice: undefined });
  const left = await system(adapter).service.getLatestQuote(request());
  const right = await system(adapter).service.getLatestQuote(request());
  assertEqual(JSON.stringify(left), JSON.stringify(right), "identical result");
});

test("transport success cannot bypass validation failure", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ bidPrice: { atomicValue: "0", scale: 4 } });
  const result = await system(adapter).service.getLatestQuote(request());
  assertEqual(result.transportStatus, MarketDataTransportStatus.Succeeded, "transport");
  assertEqual(result.status, MarketDataResultStatus.Rejected, "result");
});

test("normalization exceptions fail closed without leaking details", async () => {
  const adapter = new FixtureAdapter();
  adapter.shouldThrowDuringNormalization = true;
  const result = await system(adapter).service.getLatestQuote(request());
  assertEqual(result.status, MarketDataResultStatus.Rejected, "status");
  assertTrue(!JSON.stringify(result).includes("unsafe normalization details"), "details absent");
});

test("no opaque confidence score is exposed", async () => {
  assertTrue(!JSON.stringify(await system().service.getLatestQuote(request())).includes("confidence"), "confidence absent");
});

test("no AI, decision, risk, or execution methods exist", () => {
  const methods = Object.getOwnPropertyNames(MarketDataService.prototype).join("|").toLowerCase();
  for (const term of ["ai", "decision", "risk", "execute", "trade"]) assertTrue(!methods.includes(term), `method ${term} absent`);
});

test("no production persistence methods exist", () => {
  const methods = Object.getOwnPropertyNames(MarketDataService.prototype).join("|").toLowerCase();
  for (const term of ["save", "persist", "database", "repository"]) assertTrue(!methods.includes(term), `method ${term} absent`);
});

test("transport errors are safely normalized without credential leakage", async () => {
  const adapter = new FixtureAdapter();
  adapter.shouldThrow = true;
  const serialized = JSON.stringify(await system(adapter).service.getLatestQuote(request()));
  assertTrue(!serialized.includes("secret-value"), "secret absent");
  assertTrue(!serialized.includes("C:\\private"), "path absent");
  assertTrue(serialized.includes("Provider request failed safely."), "safe error present");
});

test("policy identity and version are preserved", async () => {
  const result = await system().service.getLatestQuote(request());
  assertEqual(result.policyId, "market-data-policy:default", "policy ID");
  assertEqual(result.policyVersion, "1.0", "policy version");
});

test("source raw fixtures are not mutated", async () => {
  const { service, adapter } = system();
  const before = JSON.stringify(adapter.raw);
  await service.getLatestQuote(request());
  assertEqual(JSON.stringify(adapter.raw), before, "raw fixture");
});

test("adapter-reported conflicts remain explicit", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = {
    providerId: "provider:fixture",
    status: MarketDataNormalizationStatus.Rejected,
    blockers: [{ code: MarketDataIssueCode.ConflictingFields, message: "Provider fields conflict." }],
    warnings: [],
  };
  const result = await system(adapter).service.getLatestQuote(request());
  assertEqual(result.qualityStatus, MarketDataQualityStatus.Conflicting, "quality");
});

test("provider unavailability returns UNAVAILABLE", async () => {
  const adapter = new FixtureAdapter(undefined, { providerId: "provider:fixture", status: MarketDataProviderHealthStatus.Unavailable, observedAt: NOW, reason: "Maintenance." });
  const result = await system(adapter).service.getLatestQuote(request());
  assertEqual(result.status, MarketDataResultStatus.Unavailable, "status");
  assertEqual(adapter.fetchCount, 0, "fetch count");
});

test("disabled provider fails before transport", async () => {
  const adapter = new FixtureAdapter();
  const metadata = providerMetadata({ defaultEnabled: false });
  const result = await system(adapter, metadata, MarketDataCompositionScope.AdministrativeTest).service.getLatestQuote(request());
  assertIssue(result, MarketDataIssueCode.ProviderDisabled);
  assertEqual(adapter.fetchCount, 0, "fetch count");
});

test("provider outside policy fails before transport", async () => {
  const { service, adapter } = system();
  const result = await service.getLatestQuote(request({ policy: { ...request().policy, allowedProviderIds: ["provider:secondary"] } }));
  assertIssue(result, MarketDataIssueCode.ProviderNotAllowed);
  assertEqual(adapter.fetchCount, 0, "fetch count");
});

test("bid above ask fails internal consistency", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ bidPrice: { atomicValue: "2250000", scale: 4 } });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.InvalidQuoteRelationship);
});

test("price scale above policy fails precision", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ bidPrice: { atomicValue: "22412340", scale: 5 } });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.InvalidPrecision);
});

test("provider publication chronology is validated", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ providerPublishedAt: "2026-07-20T11:59:29.000Z" });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.InvalidTimestamp);
});

test("raw response provider mismatch is rejected", async () => {
  const adapter = new FixtureAdapter();
  adapter.raw = { ...adapter.raw, providerId: "provider:other" };
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.InvalidProviderIdentity);
});

test("normalized receipt time must preserve raw receipt time", async () => {
  const adapter = new FixtureAdapter();
  adapter.normalization = normalized({ receivedAt: "2026-07-20T11:59:31.500Z" });
  assertIssue(await system(adapter).service.getLatestQuote(request()), MarketDataIssueCode.MissingProvenance);
});

test("malformed service request is rejected", async () => {
  let failed = false;
  try { await system().service.getLatestQuote({}); } catch (error) { failed = error instanceof MarketDataConfigurationError; }
  assertTrue(failed, "request rejected");
});

test("provider symbol cannot replace canonical request identity", async () => {
  let failed = false;
  try {
    await system().service.getLatestQuote(request({ instrument: { instrumentId: "AAPL" } }));
  } catch (error) {
    failed = error instanceof MarketDataConfigurationError;
  }
  assertTrue(failed, "provider symbol rejected");
});

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`Market Data Layer tests passed: ${String(passed)}/${String(tests.length)}.`);
}

void main();
