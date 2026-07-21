import { BarInterval } from "../../contracts/CanonicalBar";
import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";
import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataAdapterErrorCategory,
  MarketDataCapability,
  MarketDataNormalizationStatus,
  MarketDataProviderHealthStatus,
  type MarketDataBarProviderAdapter,
  type MarketDataProviderAdapter,
  type MarketDataProviderDescriptor,
} from "../../contracts/MarketData";
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
} from "./MarketDataProviderComposition";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function expectError(run: () => unknown, label: string): void {
  try { run(); } catch (error: unknown) { if (error instanceof MarketDataProviderCompositionError) return; throw error; }
  throw new Error(`${label}: expected composition error.`);
}

const PROVIDER = "provider:composition-test";
const NOW = "2026-07-21T12:00:00.000Z";

function metadata(overrides: Partial<MarketDataProviderMetadata> = {}): MarketDataProviderMetadata {
  return {
    schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
    metadataVersion: "1.0",
    identity: { providerId: PROVIDER, displayName: "Composition Test" },
    status: MarketDataProviderStatus.Active,
    supportedAssetClasses: [InstrumentAssetClass.Equity],
    capabilities: [MarketDataCapability.LatestQuote, MarketDataCapability.Bars],
    priority: 1,
    defaultEnabled: true,
    documentationReference: "docs/specifications/MARKET_DATA_LAYER.md",
    ...overrides,
  };
}

function registry(provider = metadata()) {
  return new InMemoryMarketDataProviderRegistry([provider], {
    schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
    policyId: "composition-policy:test",
    version: "1.0",
    displayNamePolicy: MarketDataProviderNamePolicy.RejectDuplicates,
  });
}

function descriptor(capability: MarketDataCapability.LatestQuote | MarketDataCapability.Bars): MarketDataProviderDescriptor {
  return {
    schemaVersion: MARKET_DATA_SCHEMA_VERSION,
    adapterId: capability === MarketDataCapability.Bars ? "adapter:test:bars" : "adapter:test:quote",
    adapterVersion: "1.0",
    providerId: PROVIDER,
    capability,
    supportedAssetClasses: [InstrumentAssetClass.Equity],
    ...(capability === MarketDataCapability.Bars ? { supportedBarIntervals: [BarInterval.FiveMinutes] } : {}),
  };
}

function quoteAdapter(value = descriptor(MarketDataCapability.LatestQuote)): MarketDataProviderAdapter {
  return {
    getDescriptor: () => value,
    getHealth: () => ({ providerId: value.providerId, status: MarketDataProviderHealthStatus.Available, observedAt: NOW }),
    fetchLatestQuote: async () => { throw new Error("not called"); },
    normalizeLatestQuote: () => ({ providerId: value.providerId, status: MarketDataNormalizationStatus.Rejected, blockers: [], warnings: [] }),
    normalizeError: (_error, _request, occurredAt) => ({ providerId: value.providerId, category: MarketDataAdapterErrorCategory.Unknown, safeCode: "TEST", safeMessage: "Test.", retryable: false, occurredAt }),
  };
}

function barAdapter(value = descriptor(MarketDataCapability.Bars)): MarketDataBarProviderAdapter {
  return {
    getDescriptor: () => value,
    getHealth: () => ({ providerId: value.providerId, status: MarketDataProviderHealthStatus.Available, observedAt: NOW }),
    fetchBars: async () => { throw new Error("not called"); },
    normalizeBars: () => ({ providerId: value.providerId, status: MarketDataNormalizationStatus.Rejected, bars: [], duplicateCount: 0, blockers: [], warnings: [] }),
    normalizeError: (_error, _request, occurredAt) => ({ providerId: value.providerId, category: MarketDataAdapterErrorCategory.Unknown, safeCode: "TEST", safeMessage: "Test.", retryable: false, occurredAt }),
  };
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["one provider binds Quote only", () => { const value = new ImmutableMarketDataProviderComposition(registry(), [quoteAdapter()], []); assertTrue(value.getQuoteAdapter(PROVIDER) !== undefined, "quote"); assertTrue(value.getBarAdapter(PROVIDER) === undefined, "bar absent"); }],
  ["one provider binds Bar only", () => { const value = new ImmutableMarketDataProviderComposition(registry(), [], [barAdapter()]); assertTrue(value.getBarAdapter(PROVIDER) !== undefined, "bar"); assertTrue(value.getQuoteAdapter(PROVIDER) === undefined, "quote absent"); }],
  ["one provider binds Quote and Bar", () => { const value = new ImmutableMarketDataProviderComposition(registry(), [quoteAdapter()], [barAdapter()]); assertTrue(value.getQuoteAdapter(PROVIDER) !== undefined, "quote"); assertTrue(value.getBarAdapter(PROVIDER) !== undefined, "bar"); }],
  ["duplicate Quote binding is rejected", () => expectError(() => new ImmutableMarketDataProviderComposition(registry(), [quoteAdapter(), quoteAdapter()], []), "quote duplicate")],
  ["duplicate Bar binding is rejected", () => expectError(() => new ImmutableMarketDataProviderComposition(registry(), [], [barAdapter(), barAdapter()]), "bar duplicate")],
  ["undeclared capability is rejected", () => expectError(() => new ImmutableMarketDataProviderComposition(registry(metadata({ capabilities: [MarketDataCapability.Bars] })), [quoteAdapter()], []), "capability")],
  ["unknown provider is rejected", () => expectError(() => new ImmutableMarketDataProviderComposition(registry(), [quoteAdapter({ ...descriptor(MarketDataCapability.LatestQuote), providerId: "provider:unknown" })], []), "provider")],
  ["adapter asset class disagreement is rejected", () => expectError(() => new ImmutableMarketDataProviderComposition(registry(), [quoteAdapter({ ...descriptor(MarketDataCapability.LatestQuote), supportedAssetClasses: [InstrumentAssetClass.Crypto] })], []), "asset class")],
  ["inactive provider fails normal composition", () => expectError(() => new ImmutableMarketDataProviderComposition(registry(metadata({ status: MarketDataProviderStatus.Inactive, defaultEnabled: false })), [quoteAdapter()], []), "inactive")],
  ["administrative test scope may bind disabled metadata", () => { const value = new ImmutableMarketDataProviderComposition(registry(metadata({ defaultEnabled: false })), [quoteAdapter()], [], MarketDataCompositionScope.AdministrativeTest); assertTrue(value.getQuoteAdapter(PROVIDER) !== undefined, "admin binding"); }],
  ["registry metadata remains the listed authority", () => { const value = new ImmutableMarketDataProviderComposition(registry(), [quoteAdapter()], [barAdapter()]); const listed = value.listProviders(); assertEqual(listed.length, 1, "provider count"); assertEqual(listed[0]?.capabilities.length, 2, "registry capabilities"); assertTrue(Object.isFrozen(listed), "list frozen"); }],
  ["composition exposes no routing or selection method", () => { const methods = Object.getOwnPropertyNames(ImmutableMarketDataProviderComposition.prototype).join("|").toLowerCase(); assertTrue(!methods.includes("route") && !methods.includes("select") && !methods.includes("fallback"), "no selection"); }],
];

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Market Data Provider Composition tests passed: ${String(passed)}/${String(tests.length)}.`);
