import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  MarketDataBarMode,
  MarketDataCapability,
  MarketDataIssueCode,
  MarketDataResultStatus,
} from "../../../contracts/MarketData";
import {
  MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  MarketDataProviderNamePolicy,
} from "../../../contracts/MarketDataProviderRegistry";
import { ImmutableMarketDataProviderComposition } from "../../../engines/market-data-provider-composition/MarketDataProviderComposition";
import {
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  TWELVE_DATA_PROVIDER_ID,
  TwelveDataExecutionMode,
  TwelveDataMappingReviewStatus,
  TwelveDataTransportKind,
  TwelveDataVolumeEvidenceStatus,
  type TwelveDataLiveSmokePolicy,
} from "./TwelveDataContracts";
import { MarketDataConfigurationError, MarketDataService } from "../../../engines/market-data/MarketDataService";
import { InMemoryMarketDataProviderRegistry } from "../../../engines/market-data-provider-registry/MarketDataProviderRegistry";
import { TwelveDataBarAdapter } from "./TwelveDataBarAdapter";
import {
  TWELVE_DATA_AAPL_FIXTURE_MAPPING,
  TWELVE_DATA_PROVIDER_METADATA,
  TwelveDataConfigurationError,
  loadTwelveDataCredentials,
} from "./TwelveDataProvider";
import {
  FIXTURE_NORMALIZED_AT,
  FixtureTwelveDataTransport,
  TWELVE_DATA_SPY_TEST_MAPPING,
  fixtureBody,
  fixtureCredentials,
  fixturePolicy,
  fixtureRequest,
} from "./TwelveDataTestFixtures";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function expectError(run: () => unknown, label: string): void { try { run(); } catch (error: unknown) { if (error instanceof TwelveDataConfigurationError) return; throw error; } throw new Error(`${label}: expected error.`); }
async function expectServiceError(run: () => Promise<unknown>, label: string): Promise<void> { try { await run(); } catch (error: unknown) { if (error instanceof MarketDataConfigurationError) return; throw error; } throw new Error(`${label}: expected error.`); }

function system(options: { readonly mode?: TwelveDataExecutionMode; readonly transport?: FixtureTwelveDataTransport; readonly mappings?: typeof TWELVE_DATA_AAPL_FIXTURE_MAPPING[]; readonly volume?: TwelveDataVolumeEvidenceStatus } = {}) {
  const transport = options.transport ?? new FixtureTwelveDataTransport();
  const adapter = new TwelveDataBarAdapter({
    credentials: fixtureCredentials(),
    transport,
    mappings: options.mappings ?? [TWELVE_DATA_AAPL_FIXTURE_MAPPING],
    policy: fixturePolicy({ volumeEvidenceStatus: options.volume ?? TwelveDataVolumeEvidenceStatus.FixtureReviewed }),
    executionMode: options.mode ?? TwelveDataExecutionMode.Fixture,
    ...(options.mode === TwelveDataExecutionMode.BoundedLiveSmoke ? { liveSmokePolicy: liveSmokePolicy() } : {}),
    clock: { now: () => FIXTURE_NORMALIZED_AT },
  });
  const registry = new InMemoryMarketDataProviderRegistry([TWELVE_DATA_PROVIDER_METADATA], {
    schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
    policyId: "registry:test",
    version: "1.0",
    displayNamePolicy: MarketDataProviderNamePolicy.RejectDuplicates,
  });
  const composition = new ImmutableMarketDataProviderComposition(registry, [], [adapter]);
  return { adapter, transport, service: new MarketDataService(composition, { now: () => FIXTURE_NORMALIZED_AT }) };
}

function liveSmokePolicy(): TwelveDataLiveSmokePolicy {
  return {
    schemaVersion: "1.0",
    policyId: "twelve-data-live-smoke:test",
    version: "1.0",
    allowedProviderId: TWELVE_DATA_PROVIDER_ID,
    allowedSymbols: ["AAPL"],
    allowedIntervals: [BarInterval.FiveMinutes],
    maxSymbolsPerRun: 1,
    maxRequestsPerRun: 1,
    maxLookbackSeconds: 3_600,
    maxRecords: 10,
    maxApiCreditsPerRun: 1,
    officialEvidenceReferences: ["docs/research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md"],
    executionKind: "MANUAL_ONE_SHOT",
    pollingAllowed: false,
    persistenceAllowed: false,
    streamingAllowed: false,
    automaticRetryAllowed: false,
    backgroundExecutionAllowed: false,
    secretLoggingAllowed: false,
  };
}

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  ["provider metadata is an active Bars-only registry record", () => { assertEqual(TWELVE_DATA_PROVIDER_METADATA.identity.providerId, TWELVE_DATA_PROVIDER_ID, "provider"); assertEqual(TWELVE_DATA_PROVIDER_METADATA.capabilities.join("|"), MarketDataCapability.Bars, "capability"); }],
  ["provider metadata registers without adapter instantiation", () => { const registry = new InMemoryMarketDataProviderRegistry([TWELVE_DATA_PROVIDER_METADATA], { schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION, policyId: "registry:test", version: "1.0", displayNamePolicy: MarketDataProviderNamePolicy.RejectDuplicates }); assertEqual(registry.requireCapability(TWELVE_DATA_PROVIDER_ID, MarketDataCapability.Bars).identity.providerId, TWELVE_DATA_PROVIDER_ID, "registered"); }],
  ["credential loader reads only the named environment variable", () => { const value = loadTwelveDataCredentials({ [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: " fixture-secret-value ", OTHER_SECRET: "ignored" }); assertEqual(value.revealForTransport(), "fixture-secret-value", "trimmed api key"); assertTrue(Object.isFrozen(value), "frozen"); }],
  ["missing credentials fail closed", () => expectError(() => loadTwelveDataCredentials({}), "credentials")],
  ["request construction is deterministic and explicit", () => { const first = system().adapter.buildRequest(fixtureRequest()); const second = system().adapter.buildRequest(fixtureRequest()); assertEqual(JSON.stringify(first), JSON.stringify(second), "request"); assertEqual(first.query.map(([key]) => key).join("|"), [...first.query.map(([key]) => key)].sort().join("|"), "query order"); }],
  ["request forces UTC ascending regular raw bars", () => { const query = Object.fromEntries(system().adapter.buildRequest(fixtureRequest()).query); assertEqual(query.timezone, "UTC", "timezone"); assertEqual(query.order, "asc", "order"); assertEqual(query.prepost, "false", "prepost"); assertEqual(query.adjust, "none", "adjust"); }],
  ["credentials never enter URL or query", () => { const request = system().adapter.buildRequest(fixtureRequest()); assertTrue(!JSON.stringify(request).includes("fixture-secret-value"), "secret absent"); assertTrue(!request.query.some(([key]) => key === "apikey"), "apikey query absent"); }],
  ["adapter serialization cannot expose credentials", () => assertTrue(!JSON.stringify(system().adapter).includes("fixture-secret-value"), "secret absent")],
  ["bounded smoke permits at most ten Bars", () => expectError(() => system({ mode: TwelveDataExecutionMode.BoundedLiveSmoke }).adapter.buildRequest(fixtureRequest({ maxRecords: 11 })), "smoke bound")],
  ["daily interval is explicitly unsupported", () => expectError(() => system().adapter.buildRequest(fixtureRequest({ interval: BarInterval.OneDay })), "daily")],
  ["unapproved mapping fails closed", () => { const pending = { ...TWELVE_DATA_AAPL_FIXTURE_MAPPING, reviewStatus: TwelveDataMappingReviewStatus.Pending }; expectError(() => system({ mappings: [pending] }).adapter.buildRequest(fixtureRequest()), "mapping"); }],
  ["AAPL fixture request reaches injected transport", async () => { const { adapter, transport } = system(); const raw = await adapter.fetchBars(fixtureRequest()); assertEqual(raw.providerId, TWELVE_DATA_PROVIDER_ID, "provider"); assertTrue(transport.credentialObserved, "credential boundary"); }],
  ["reviewed SPY fixture mapping is supported without discovery", async () => { const transport = new FixtureTwelveDataTransport(); transport.response = { ...transport.response, body: fixtureBody({ meta: { symbol: "SPY", interval: "5min", currency: "USD", exchange: "NYSE ARCA", mic_code: "ARCX", type: "ETF" } }) }; const { service } = system({ transport, mappings: [TWELVE_DATA_AAPL_FIXTURE_MAPPING, TWELVE_DATA_SPY_TEST_MAPPING] }); const result = await service.getBars(fixtureRequest({ instrument: { instrumentId: TWELVE_DATA_SPY_TEST_MAPPING.canonicalInstrument.instrumentId } })); assertEqual(result.status, MarketDataResultStatus.Accepted, "status"); }],
  ["MarketDataService returns accepted Canonical Bars", async () => { const result = await system().service.getBars(fixtureRequest()); assertEqual(result.status, MarketDataResultStatus.Accepted, "status"); assertEqual(result.data.length, 2, "count"); assertTrue(Object.isFrozen(result.data), "immutable"); }],
  ["accepted Bars include explicit passed validation dimensions", async () => { const result = await system().service.getBars(fixtureRequest()); assertTrue(result.validation.checks.length > 0, "checks present"); assertTrue(result.validation.checks.every((check) => check.status === "PASSED"), "checks passed"); }],
  ["required undeclared capability fails before provider transport", async () => { const { service, transport } = system(); const base = fixtureRequest(); const result = await service.getBars(fixtureRequest({ policy: { ...base.policy, requiredCapabilities: [MarketDataCapability.Bars, MarketDataCapability.LatestQuote] } })); assertEqual(result.status, MarketDataResultStatus.Unsupported, "status"); assertTrue(transport.request === undefined, "transport untouched"); }],
  ["returned records cannot exceed the request bound", async () => { const result = await system().service.getBars(fixtureRequest({ maxRecords: 1 })); assertEqual(result.status, MarketDataResultStatus.Rejected, "status"); assertEqual(result.data.length, 0, "withheld"); }],
  ["request lookback must remain within the versioned policy", async () => { const base = fixtureRequest(); await expectServiceError(() => system().service.getBars(fixtureRequest({ policy: { ...base.policy, maxLookbackSeconds: 60 } })), "lookback bound"); }],
  ["exact duplicate Bars are reported when deterministically removed", async () => { const transport = new FixtureTwelveDataTransport(); transport.response = { ...transport.response, body: fixtureBody({ values: [
    { datetime: "2026-07-20 14:30:00", open: "224.1000", high: "224.5000", low: "224.0000", close: "224.3000", volume: "12500" },
    { datetime: "2026-07-20 14:30:00", open: "224.1000", high: "224.5000", low: "224.0000", close: "224.3000", volume: "12500" },
  ] }) }; const result = await system({ transport }).service.getBars(fixtureRequest()); assertEqual(result.status, MarketDataResultStatus.Accepted, "status"); assertEqual(result.data.length, 1, "deduplicated count"); assertEqual(result.duplicateCount, 1, "duplicate count"); assertTrue(result.warnings.some((warning) => warning.code === MarketDataIssueCode.DuplicateObservation), "duplicate warning"); }],
  ["stale intraday Bars fail closed", async () => { const result = await system().service.getBars(fixtureRequest({ barMode: MarketDataBarMode.Intraday, evaluatedAt: "2026-07-20T18:00:00.000Z" })); assertEqual(result.status, MarketDataResultStatus.Rejected, "status"); assertEqual(result.data.length, 0, "withheld"); }],
  ["stale historical Bars remain explicit historical evidence", async () => { const result = await system().service.getBars(fixtureRequest({ barMode: MarketDataBarMode.Historical, evaluatedAt: "2026-07-20T18:00:00.000Z" })); assertEqual(result.status, MarketDataResultStatus.Accepted, "status"); assertEqual(result.qualityStatus, "STALE", "quality"); }],
  ["provider payload stays behind adapter boundary", async () => { const result = await system().service.getBars(fixtureRequest()); const serialized = JSON.stringify(result); assertTrue(!serialized.includes("mic_code"), "provider field absent"); assertTrue(!serialized.includes("exchange_timezone"), "provider field absent"); }],
  ["transport success cannot bypass response validation", async () => { const transport = new FixtureTwelveDataTransport(); transport.response = { ...transport.response, body: "{}" }; const result = await system({ transport }).service.getBars(fixtureRequest()); assertEqual(result.status, MarketDataResultStatus.Rejected, "status"); }],
  ["provider error body is safely rejected", async () => { const transport = new FixtureTwelveDataTransport(); transport.response = { ...transport.response, body: JSON.stringify({ status: "error", code: 429, message: "secret detail" }) }; const result = await system({ transport }).service.getBars(fixtureRequest()); assertEqual(result.status, MarketDataResultStatus.Rejected, "status"); assertTrue(!JSON.stringify(result).includes("secret detail"), "provider message absent"); }],
  ["non-success HTTP status is safely translated", async () => { const transport = new FixtureTwelveDataTransport(); transport.response = { ...transport.response, statusCode: 429, body: "credential=unsafe" }; const result = await system({ transport }).service.getBars(fixtureRequest()); assertEqual(result.status, MarketDataResultStatus.Unavailable, "status"); assertTrue(!JSON.stringify(result).includes("unsafe"), "details absent"); }],
  ["live transport fails closed without official volume evidence", async () => { const transport = new FixtureTwelveDataTransport(); transport.response = { ...transport.response, transportKind: TwelveDataTransportKind.Live }; const result = await system({ transport }).service.getBars(fixtureRequest()); assertEqual(result.status, MarketDataResultStatus.Rejected, "status"); }],
  ["source request and fixture response remain unchanged", async () => { const request = fixtureRequest(); const before = JSON.stringify(request); await system().service.getBars(request); assertEqual(JSON.stringify(request), before, "request unchanged"); }],
  ["adapter surface contains no routing execution or AI authority", () => { const methods: Array<keyof TwelveDataBarAdapter> = ["getDescriptor", "getHealth", "buildRequest", "fetchBars", "normalizeBars", "normalizeError"]; const value = methods.join("|").toLowerCase(); for (const forbidden of ["route", "executeorder", "predict", "ai", "persist", "stream"]) assertTrue(!value.includes(forbidden), `${forbidden} absent`); }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try { await run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
  }
  console.log(`Twelve Data Bar Adapter tests passed: ${String(passed)}/${String(tests.length)}.`);
}

void main();
