import {
  MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  MarketDataProviderNamePolicy,
  MarketDataProviderQueryScope,
  MarketDataProviderRegistryErrorCode,
  MarketDataProviderStatus,
  type MarketDataProviderMetadata,
  type MarketDataProviderRegistry,
  type MarketDataProviderRegistryPolicy,
} from "../../contracts/MarketDataProviderRegistry";
import { MarketAssetClass, MarketDataCapability } from "../../contracts/MarketData";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const DISPLAY_NAME = /^[A-Za-z0-9][A-Za-z0-9 .&()'/-]{0,119}$/u;
const DOCUMENTATION_REFERENCE = /^docs\/[A-Za-z0-9][A-Za-z0-9._/#-]{0,239}$/u;

export class MarketDataProviderRegistryError extends Error {
  public constructor(
    public readonly code: MarketDataProviderRegistryErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "MarketDataProviderRegistryError";
  }
}

/** Immutable, deterministic provider metadata registry. It contains no adapter instances. */
export class InMemoryMarketDataProviderRegistry implements MarketDataProviderRegistry {
  private readonly providersById: ReadonlyMap<string, MarketDataProviderMetadata>;
  private readonly orderedProviders: readonly MarketDataProviderMetadata[];
  public readonly policy: MarketDataProviderRegistryPolicy;

  public constructor(
    registrations: readonly MarketDataProviderMetadata[],
    policy: MarketDataProviderRegistryPolicy,
  ) {
    validatePolicy(policy);
    this.policy = deepFreeze({ ...policy });
    const providers = new Map<string, MarketDataProviderMetadata>();
    const names = new Map<string, string>();

    for (const registration of registrations) {
      const provider = validateAndCopyProvider(registration);
      const existing = providers.get(provider.identity.providerId);
      if (existing !== undefined) {
        const code = stableProviderValue(existing) === stableProviderValue(provider)
          ? MarketDataProviderRegistryErrorCode.DuplicateRegistration
          : MarketDataProviderRegistryErrorCode.DuplicateProviderId;
        throw registryError(code, `Provider ID ${provider.identity.providerId} is already registered.`);
      }

      const normalizedName = normalizeDisplayName(provider.identity.displayName);
      const existingNameId = names.get(normalizedName);
      if (existingNameId !== undefined && policy.displayNamePolicy === MarketDataProviderNamePolicy.RejectDuplicates) {
        throw registryError(
          MarketDataProviderRegistryErrorCode.DuplicateDisplayName,
          `Display name is already registered by ${existingNameId}.`,
        );
      }

      providers.set(provider.identity.providerId, provider);
      if (existingNameId === undefined) names.set(normalizedName, provider.identity.providerId);
    }

    this.orderedProviders = deepFreeze([...providers.values()].sort(compareProviders));
    this.providersById = new Map(this.orderedProviders.map((provider) => [provider.identity.providerId, provider]));
    Object.freeze(this);
  }

  public listProviders(scope: MarketDataProviderQueryScope = MarketDataProviderQueryScope.EnabledOnly): readonly MarketDataProviderMetadata[] {
    validateScope(scope);
    return freezeProviderList(this.orderedProviders.filter((provider) => scope === MarketDataProviderQueryScope.All || isEnabled(provider)));
  }

  public getProvider(providerId: unknown): MarketDataProviderMetadata {
    const id = validateProviderId(providerId);
    const provider = this.providersById.get(id);
    if (provider === undefined) {
      throw registryError(MarketDataProviderRegistryErrorCode.UnknownProvider, `Provider ${id} is not registered.`);
    }
    return deepFreeze(copyProvider(provider));
  }

  public requireEnabledProvider(providerId: unknown): MarketDataProviderMetadata {
    const provider = this.getProvider(providerId);
    if (!isEnabled(provider)) {
      throw registryError(
        MarketDataProviderRegistryErrorCode.ProviderDisabled,
        `Provider ${provider.identity.providerId} is not active and enabled by default.`,
      );
    }
    return provider;
  }

  public findByCapability(
    capability: unknown,
    scope: MarketDataProviderQueryScope = MarketDataProviderQueryScope.EnabledOnly,
  ): readonly MarketDataProviderMetadata[] {
    const requiredCapability = validateCapability(capability);
    validateScope(scope);
    return freezeProviderList(
      this.orderedProviders.filter((provider) =>
        (scope === MarketDataProviderQueryScope.All || isEnabled(provider))
        && provider.capabilities.includes(requiredCapability)),
    );
  }

  public findByAssetClass(
    assetClass: unknown,
    scope: MarketDataProviderQueryScope = MarketDataProviderQueryScope.EnabledOnly,
  ): readonly MarketDataProviderMetadata[] {
    const requiredAssetClass = validateAssetClass(assetClass);
    validateScope(scope);
    return freezeProviderList(
      this.orderedProviders.filter((provider) =>
        (scope === MarketDataProviderQueryScope.All || isEnabled(provider))
        && provider.supportedAssetClasses.includes(requiredAssetClass)),
    );
  }

  public requireCapability(providerId: unknown, capability: unknown): MarketDataProviderMetadata {
    const requiredCapability = validateCapability(capability);
    const provider = this.requireEnabledProvider(providerId);
    if (!provider.capabilities.includes(requiredCapability)) {
      throw registryError(
        MarketDataProviderRegistryErrorCode.CapabilityUnsupported,
        `Provider ${provider.identity.providerId} does not declare ${requiredCapability}.`,
      );
    }
    return provider;
  }

  public requireAssetClass(providerId: unknown, assetClass: unknown): MarketDataProviderMetadata {
    const requiredAssetClass = validateAssetClass(assetClass);
    const provider = this.requireEnabledProvider(providerId);
    if (!provider.supportedAssetClasses.includes(requiredAssetClass)) {
      throw registryError(
        MarketDataProviderRegistryErrorCode.AssetClassUnsupported,
        `Provider ${provider.identity.providerId} does not declare ${requiredAssetClass}.`,
      );
    }
    return provider;
  }
}

function validatePolicy(value: unknown): asserts value is MarketDataProviderRegistryPolicy {
  if (!isRecord(value)
    || value.schemaVersion !== MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION
    || !validIdentifier(value.policyId)
    || !validIdentifier(value.version)
    || !Object.values(MarketDataProviderNamePolicy).includes(value.displayNamePolicy as MarketDataProviderNamePolicy)) {
    throw registryError(MarketDataProviderRegistryErrorCode.InvalidPolicy, "Registry policy is malformed.");
  }
}

function validateAndCopyProvider(value: unknown): MarketDataProviderMetadata {
  if (!isRecord(value)
    || value.schemaVersion !== MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION
    || !validIdentifier(value.metadataVersion)
    || !isRecord(value.identity)
    || !validIdentifier(value.identity.providerId)
    || typeof value.identity.displayName !== "string"
    || value.identity.displayName !== value.identity.displayName.trim()
    || !DISPLAY_NAME.test(value.identity.displayName)
    || !Object.values(MarketDataProviderStatus).includes(value.status as MarketDataProviderStatus)
    || !Array.isArray(value.supportedAssetClasses)
    || value.supportedAssetClasses.length === 0
    || !value.supportedAssetClasses.every((assetClass) => Object.values(MarketAssetClass).includes(assetClass as MarketAssetClass))
    || new Set(value.supportedAssetClasses).size !== value.supportedAssetClasses.length
    || !Array.isArray(value.capabilities)
    || value.capabilities.length === 0
    || !value.capabilities.every((capability) => Object.values(MarketDataCapability).includes(capability as MarketDataCapability))
    || new Set(value.capabilities).size !== value.capabilities.length
    || !Number.isSafeInteger(value.priority)
    || (value.priority as number) < 0
    || (value.priority as number) > 10_000
    || typeof value.defaultEnabled !== "boolean"
    || typeof value.documentationReference !== "string"
    || !DOCUMENTATION_REFERENCE.test(value.documentationReference)
    || value.documentationReference.includes("..")) {
    throw registryError(MarketDataProviderRegistryErrorCode.InvalidProvider, "Provider metadata is malformed.");
  }
  if (value.defaultEnabled && value.status !== MarketDataProviderStatus.Active) {
    throw registryError(
      MarketDataProviderRegistryErrorCode.InvalidProvider,
      "Only an ACTIVE provider may be enabled by default.",
    );
  }
  return deepFreeze(copyProvider(value as unknown as MarketDataProviderMetadata));
}

function copyProvider(provider: MarketDataProviderMetadata): MarketDataProviderMetadata {
  return {
    schemaVersion: provider.schemaVersion,
    metadataVersion: provider.metadataVersion,
    identity: { ...provider.identity },
    status: provider.status,
    supportedAssetClasses: [...provider.supportedAssetClasses].sort(),
    capabilities: [...provider.capabilities].sort(),
    priority: provider.priority,
    defaultEnabled: provider.defaultEnabled,
    documentationReference: provider.documentationReference,
  };
}

function freezeProviderList(providers: readonly MarketDataProviderMetadata[]): readonly MarketDataProviderMetadata[] {
  return deepFreeze(providers.map(copyProvider));
}

function stableProviderValue(provider: MarketDataProviderMetadata): string {
  return JSON.stringify(copyProvider(provider));
}

function compareProviders(left: MarketDataProviderMetadata, right: MarketDataProviderMetadata): number {
  return left.priority - right.priority || left.identity.providerId.localeCompare(right.identity.providerId);
}

function isEnabled(provider: MarketDataProviderMetadata): boolean {
  return provider.status === MarketDataProviderStatus.Active && provider.defaultEnabled;
}

function validateProviderId(value: unknown): string {
  if (!validIdentifier(value)) {
    throw registryError(MarketDataProviderRegistryErrorCode.UnknownProvider, "Provider ID is invalid or unknown.");
  }
  return value;
}

function validateCapability(value: unknown): MarketDataCapability {
  if (!Object.values(MarketDataCapability).includes(value as MarketDataCapability)) {
    throw registryError(MarketDataProviderRegistryErrorCode.UnknownCapability, "Capability is invalid or unknown.");
  }
  return value as MarketDataCapability;
}

function validateAssetClass(value: unknown): MarketAssetClass {
  if (!Object.values(MarketAssetClass).includes(value as MarketAssetClass)) {
    throw registryError(MarketDataProviderRegistryErrorCode.UnknownAssetClass, "Asset class is invalid or unknown.");
  }
  return value as MarketAssetClass;
}

function validateScope(value: unknown): asserts value is MarketDataProviderQueryScope {
  if (!Object.values(MarketDataProviderQueryScope).includes(value as MarketDataProviderQueryScope)) {
    throw registryError(MarketDataProviderRegistryErrorCode.InvalidPolicy, "Query scope is invalid.");
  }
}

function normalizeDisplayName(value: string): string {
  return value.toLowerCase();
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function registryError(code: MarketDataProviderRegistryErrorCode, message: string): MarketDataProviderRegistryError {
  return new MarketDataProviderRegistryError(code, message);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
