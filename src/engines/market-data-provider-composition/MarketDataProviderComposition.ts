import { BarInterval } from "../../contracts/CanonicalBar";
import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataCapability,
  type MarketDataBarProviderAdapter,
  type MarketDataProviderAdapter,
  type MarketDataProviderDescriptor,
} from "../../contracts/MarketData";
import {
  MarketDataCompositionScope,
  type MarketDataProviderComposition,
} from "../../contracts/MarketDataProviderComposition";
import {
  MarketDataProviderQueryScope,
  MarketDataProviderStatus,
  type MarketDataProviderMetadata,
  type MarketDataProviderRegistry,
} from "../../contracts/MarketDataProviderRegistry";
import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;

export class MarketDataProviderCompositionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MarketDataProviderCompositionError";
  }
}

/** Binds authoritative registry metadata to capability-specific adapter implementations. */
export class ImmutableMarketDataProviderComposition implements MarketDataProviderComposition {
  public readonly scope: MarketDataCompositionScope;
  private readonly providers = new Map<string, MarketDataProviderMetadata>();
  private readonly quoteAdapters = new Map<string, MarketDataProviderAdapter>();
  private readonly barAdapters = new Map<string, MarketDataBarProviderAdapter>();

  public constructor(
    public readonly registry: MarketDataProviderRegistry,
    quoteAdapters: readonly MarketDataProviderAdapter[],
    barAdapters: readonly MarketDataBarProviderAdapter[],
    scope: MarketDataCompositionScope = MarketDataCompositionScope.EnabledActiveOnly,
  ) {
    if (!Object.values(MarketDataCompositionScope).includes(scope)) {
      throw new MarketDataProviderCompositionError("Composition scope is invalid.");
    }
    this.scope = scope;
    for (const provider of registry.listProviders(MarketDataProviderQueryScope.All)) {
      this.providers.set(provider.identity.providerId, provider);
    }
    for (const adapter of quoteAdapters) {
      this.attach(adapter, MarketDataCapability.LatestQuote, this.quoteAdapters);
    }
    for (const adapter of barAdapters) {
      this.attach(adapter, MarketDataCapability.Bars, this.barAdapters);
    }
  }

  public listProviders(): readonly MarketDataProviderMetadata[] {
    const attached = new Set([...this.quoteAdapters.keys(), ...this.barAdapters.keys()]);
    return deepFreeze(
      [...this.providers.values()]
        .filter((provider) => attached.has(provider.identity.providerId))
        .map(copyProvider)
        .sort((left, right) => left.priority - right.priority
          || left.identity.providerId.localeCompare(right.identity.providerId)),
    );
  }

  public getProvider(providerId: string): MarketDataProviderMetadata | undefined {
    const provider = this.providers.get(providerId);
    return provider === undefined ? undefined : deepFreeze(copyProvider(provider));
  }

  public getQuoteAdapter(providerId: string): MarketDataProviderAdapter | undefined {
    return this.quoteAdapters.get(providerId);
  }

  public getBarAdapter(providerId: string): MarketDataBarProviderAdapter | undefined {
    return this.barAdapters.get(providerId);
  }

  private attach<T extends MarketDataProviderAdapter | MarketDataBarProviderAdapter>(
    adapter: T,
    capability: MarketDataCapability.LatestQuote | MarketDataCapability.Bars,
    target: Map<string, T>,
  ): void {
    const descriptor = validateDescriptor(adapter.getDescriptor(), capability);
    if (target.has(descriptor.providerId)) {
      throw new MarketDataProviderCompositionError(
        `Duplicate ${capability} adapter for provider ${descriptor.providerId}.`,
      );
    }
    const provider = this.providers.get(descriptor.providerId);
    if (provider === undefined) {
      throw new MarketDataProviderCompositionError(
        `Adapter provider ${descriptor.providerId} is not registered.`,
      );
    }
    if (this.scope === MarketDataCompositionScope.EnabledActiveOnly
      && (provider.status !== MarketDataProviderStatus.Active || !provider.defaultEnabled)) {
      throw new MarketDataProviderCompositionError(
        `Provider ${descriptor.providerId} is not active and enabled for runtime composition.`,
      );
    }
    if (!provider.capabilities.includes(capability)) {
      throw new MarketDataProviderCompositionError(
        `Adapter capability ${capability} is not declared by provider ${descriptor.providerId}.`,
      );
    }
    const unsupportedAssetClass = descriptor.supportedAssetClasses.find(
      (assetClass) => !provider.supportedAssetClasses.includes(assetClass),
    );
    if (unsupportedAssetClass !== undefined) {
      throw new MarketDataProviderCompositionError(
        `Adapter asset class ${unsupportedAssetClass} is not declared by provider ${descriptor.providerId}.`,
      );
    }
    target.set(descriptor.providerId, adapter);
  }
}

function validateDescriptor(
  value: MarketDataProviderDescriptor,
  expectedCapability: MarketDataCapability.LatestQuote | MarketDataCapability.Bars,
): MarketDataProviderDescriptor {
  if (!isRecord(value)
    || value.schemaVersion !== MARKET_DATA_SCHEMA_VERSION
    || !validIdentifier(value.adapterId)
    || !validIdentifier(value.adapterVersion)
    || !validIdentifier(value.providerId)
    || value.capability !== expectedCapability
    || !Array.isArray(value.supportedAssetClasses)
    || value.supportedAssetClasses.length === 0
    || !value.supportedAssetClasses.every((entry) => Object.values(InstrumentAssetClass).includes(entry))
    || new Set(value.supportedAssetClasses).size !== value.supportedAssetClasses.length) {
    throw new MarketDataProviderCompositionError("Adapter compatibility descriptor is malformed.");
  }
  if (expectedCapability === MarketDataCapability.Bars) {
    if (!Array.isArray(value.supportedBarIntervals)
      || value.supportedBarIntervals.length === 0
      || !value.supportedBarIntervals.every((entry) => Object.values(BarInterval).includes(entry))
      || new Set(value.supportedBarIntervals).size !== value.supportedBarIntervals.length) {
      throw new MarketDataProviderCompositionError("Bar adapter interval declaration is malformed.");
    }
  } else if (value.supportedBarIntervals !== undefined) {
    throw new MarketDataProviderCompositionError("Non-Bar adapter cannot declare Bar intervals.");
  }
  return value;
}

function copyProvider(value: MarketDataProviderMetadata): MarketDataProviderMetadata {
  return {
    ...value,
    identity: { ...value.identity },
    supportedAssetClasses: [...value.supportedAssetClasses],
    capabilities: [...value.capabilities],
  };
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
