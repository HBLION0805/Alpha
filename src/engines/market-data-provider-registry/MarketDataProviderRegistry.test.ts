import {
  MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  MarketDataProviderNamePolicy,
  MarketDataProviderQueryScope,
  MarketDataProviderRegistryErrorCode,
  MarketDataProviderStatus,
  type MarketDataProviderMetadata,
  type MarketDataProviderRegistryPolicy,
} from "../../contracts/MarketDataProviderRegistry";
import { MarketAssetClass, MarketDataCapability } from "../../contracts/MarketData";
import {
  InMemoryMarketDataProviderRegistry,
  MarketDataProviderRegistryError,
} from "./MarketDataProviderRegistry";

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

function expectError(run: () => unknown, code: MarketDataProviderRegistryErrorCode): void {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof MarketDataProviderRegistryError && error.code === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const policy: MarketDataProviderRegistryPolicy = {
  schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  policyId: "market-data-provider-registry:default",
  version: "1.0",
  displayNamePolicy: MarketDataProviderNamePolicy.RejectDuplicates,
};

function provider(overrides: Partial<MarketDataProviderMetadata> = {}): MarketDataProviderMetadata {
  return {
    schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
    metadataVersion: "1.0",
    identity: {
      providerId: "provider:fixture-equities",
      displayName: "Fixture Equities",
    },
    status: MarketDataProviderStatus.Active,
    supportedAssetClasses: [MarketAssetClass.Equity, MarketAssetClass.Etf],
    capabilities: [
      MarketDataCapability.LatestQuote,
      MarketDataCapability.ResolveInstrument,
      MarketDataCapability.Health,
    ],
    priority: 100,
    defaultEnabled: true,
    documentationReference: "docs/specifications/PROVIDER_REGISTRY.md#fixture-equities",
    ...overrides,
  };
}

function secondProvider(overrides: Partial<MarketDataProviderMetadata> = {}): MarketDataProviderMetadata {
  return provider({
    identity: {
      providerId: "provider:fixture-crypto",
      displayName: "Fixture Crypto",
    },
    supportedAssetClasses: [MarketAssetClass.Crypto],
    capabilities: [MarketDataCapability.LatestQuote, MarketDataCapability.LatestTrade],
    priority: 50,
    documentationReference: "docs/specifications/PROVIDER_REGISTRY.md#fixture-crypto",
    ...overrides,
  });
}

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }

test("successful registration exposes canonical provider metadata", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  assertEqual(registry.getProvider("provider:fixture-equities").identity.displayName, "Fixture Equities", "display name");
});

test("identical duplicate registration is rejected explicitly", () => {
  const value = provider();
  expectError(() => new InMemoryMarketDataProviderRegistry([value, value], policy), MarketDataProviderRegistryErrorCode.DuplicateRegistration);
});

test("conflicting duplicate provider ID is rejected explicitly", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider(), provider({ metadataVersion: "2.0" })], policy),
    MarketDataProviderRegistryErrorCode.DuplicateProviderId,
  );
});

test("duplicate display names are rejected case-insensitively when policy requires", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([
      provider(),
      secondProvider({ identity: { providerId: "provider:second", displayName: "fixture equities" } }),
    ], policy),
    MarketDataProviderRegistryErrorCode.DuplicateDisplayName,
  );
});

test("duplicate display names may be allowed explicitly", () => {
  const registry = new InMemoryMarketDataProviderRegistry([
    provider(),
    secondProvider({ identity: { providerId: "provider:second", displayName: "Fixture Equities" } }),
  ], { ...policy, displayNamePolicy: MarketDataProviderNamePolicy.AllowDuplicates });
  assertEqual(registry.listProviders().length, 2, "provider count");
});

test("lookup by provider ID fails explicitly when unknown", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  expectError(() => registry.getProvider("provider:unknown"), MarketDataProviderRegistryErrorCode.UnknownProvider);
});

test("lookup by capability returns enabled matches", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider(), secondProvider()], policy);
  assertDeepEqual(
    registry.findByCapability(MarketDataCapability.LatestTrade).map((value) => value.identity.providerId),
    ["provider:fixture-crypto"],
    "capability matches",
  );
});

test("lookup by asset class returns enabled matches", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider(), secondProvider()], policy);
  assertDeepEqual(
    registry.findByAssetClass(MarketAssetClass.Equity).map((value) => value.identity.providerId),
    ["provider:fixture-equities"],
    "asset matches",
  );
});

test("provider ordering uses priority then provider ID", () => {
  const samePriority = provider({
    identity: { providerId: "provider:fixture-a", displayName: "Fixture A" },
    priority: 100,
    documentationReference: "docs/specifications/PROVIDER_REGISTRY.md#fixture-a",
  });
  const registry = new InMemoryMarketDataProviderRegistry([provider(), samePriority, secondProvider()], policy);
  assertDeepEqual(
    registry.listProviders().map((value) => value.identity.providerId),
    ["provider:fixture-crypto", "provider:fixture-a", "provider:fixture-equities"],
    "provider order",
  );
});

test("capabilities and asset classes are normalized deterministically", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  const value = registry.getProvider("provider:fixture-equities");
  assertDeepEqual(value.capabilities, [MarketDataCapability.Health, MarketDataCapability.LatestQuote, MarketDataCapability.ResolveInstrument], "capabilities");
  assertDeepEqual(value.supportedAssetClasses, [MarketAssetClass.Equity, MarketAssetClass.Etf], "asset classes");
});

test("registry results are deeply immutable", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  const result = registry.listProviders();
  assertTrue(Object.isFrozen(result), "list frozen");
  assertTrue(Object.isFrozen(result[0]), "metadata frozen");
  assertTrue(Object.isFrozen(result[0]?.identity), "identity frozen");
  assertTrue(Object.isFrozen(result[0]?.capabilities), "capabilities frozen");
});

test("registry policy is copied and immutable", () => {
  const mutablePolicy = { ...policy };
  const registry = new InMemoryMarketDataProviderRegistry([provider()], mutablePolicy);
  mutablePolicy.version = "changed";
  assertEqual(registry.policy.version, "1.0", "policy copy");
  assertTrue(Object.isFrozen(registry.policy), "policy frozen");
});

test("registry output is serializable", () => {
  const result = new InMemoryMarketDataProviderRegistry([provider(), secondProvider()], policy).listProviders();
  assertDeepEqual(JSON.parse(JSON.stringify(result)), result, "serialized registry");
});

test("disabled provider is excluded by default", () => {
  const disabled = provider({ defaultEnabled: false });
  const registry = new InMemoryMarketDataProviderRegistry([disabled], policy);
  assertEqual(registry.listProviders().length, 0, "enabled list");
  assertEqual(registry.listProviders(MarketDataProviderQueryScope.All).length, 1, "all list");
});

test("disabled provider fails the enabled-provider gate", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider({ defaultEnabled: false })], policy);
  expectError(() => registry.requireEnabledProvider("provider:fixture-equities"), MarketDataProviderRegistryErrorCode.ProviderDisabled);
});

test("inactive provider cannot be enabled by default", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider({ status: MarketDataProviderStatus.Inactive })], policy),
    MarketDataProviderRegistryErrorCode.InvalidProvider,
  );
});

test("unsupported provider capability fails explicitly", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  expectError(
    () => registry.requireCapability("provider:fixture-equities", MarketDataCapability.Bars),
    MarketDataProviderRegistryErrorCode.CapabilityUnsupported,
  );
});

test("unknown capability fails explicitly", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  expectError(() => registry.findByCapability("UNKNOWN"), MarketDataProviderRegistryErrorCode.UnknownCapability);
});

test("unsupported asset class fails explicitly", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  expectError(
    () => registry.requireAssetClass("provider:fixture-equities", MarketAssetClass.Crypto),
    MarketDataProviderRegistryErrorCode.AssetClassUnsupported,
  );
});

test("unknown asset class fails explicitly", () => {
  const registry = new InMemoryMarketDataProviderRegistry([provider()], policy);
  expectError(() => registry.findByAssetClass("UNKNOWN"), MarketDataProviderRegistryErrorCode.UnknownAssetClass);
});

test("invalid capability declarations are rejected", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider({ capabilities: ["UNKNOWN" as MarketDataCapability] })], policy),
    MarketDataProviderRegistryErrorCode.InvalidProvider,
  );
});

test("duplicate capability declarations are rejected", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider({ capabilities: [MarketDataCapability.LatestQuote, MarketDataCapability.LatestQuote] })], policy),
    MarketDataProviderRegistryErrorCode.InvalidProvider,
  );
});

test("unsupported asset-class declarations are rejected", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider({ supportedAssetClasses: ["COMMODITY" as MarketAssetClass] })], policy),
    MarketDataProviderRegistryErrorCode.InvalidProvider,
  );
});

test("duplicate asset-class declarations are rejected", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider({ supportedAssetClasses: [MarketAssetClass.Equity, MarketAssetClass.Equity] })], policy),
    MarketDataProviderRegistryErrorCode.InvalidProvider,
  );
});

test("malformed provider identity is rejected", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider({ identity: { providerId: "", displayName: "Fixture" } })], policy),
    MarketDataProviderRegistryErrorCode.InvalidProvider,
  );
});

test("documentation traversal is rejected", () => {
  expectError(
    () => new InMemoryMarketDataProviderRegistry([provider({ documentationReference: "docs/../secret.md" })], policy),
    MarketDataProviderRegistryErrorCode.InvalidProvider,
  );
});

test("input metadata remains unchanged", () => {
  const input = provider();
  const before = JSON.stringify(input);
  new InMemoryMarketDataProviderRegistry([input], policy);
  assertEqual(JSON.stringify(input), before, "input metadata");
});

test("registry exposes no adapter, network, routing, or selection methods", () => {
  const methods = Object.getOwnPropertyNames(InMemoryMarketDataProviderRegistry.prototype).join("|").toLowerCase();
  for (const forbidden of ["adapter", "fetch", "network", "route", "select", "failover", "register"]) {
    assertTrue(!methods.includes(forbidden), `${forbidden} method absent`);
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

console.log(`Market Data Provider Registry tests passed: ${String(passed)}/${String(tests.length)}.`);
