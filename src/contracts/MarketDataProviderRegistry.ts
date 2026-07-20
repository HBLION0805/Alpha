import type { MarketAssetClass, MarketDataCapability } from "./MarketData";

export const MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION = "1.0" as const;

export enum MarketDataProviderStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Planned = "PLANNED",
  Deprecated = "DEPRECATED",
}

export enum MarketDataProviderNamePolicy {
  RejectDuplicates = "REJECT_DUPLICATES",
  AllowDuplicates = "ALLOW_DUPLICATES",
}

export enum MarketDataProviderQueryScope {
  EnabledOnly = "ENABLED_ONLY",
  All = "ALL",
}

export enum MarketDataProviderRegistryErrorCode {
  InvalidPolicy = "INVALID_POLICY",
  InvalidProvider = "INVALID_PROVIDER",
  DuplicateRegistration = "DUPLICATE_REGISTRATION",
  DuplicateProviderId = "DUPLICATE_PROVIDER_ID",
  DuplicateDisplayName = "DUPLICATE_DISPLAY_NAME",
  UnknownProvider = "UNKNOWN_PROVIDER",
  UnknownCapability = "UNKNOWN_CAPABILITY",
  UnknownAssetClass = "UNKNOWN_ASSET_CLASS",
  ProviderDisabled = "PROVIDER_DISABLED",
  CapabilityUnsupported = "CAPABILITY_UNSUPPORTED",
  AssetClassUnsupported = "ASSET_CLASS_UNSUPPORTED",
}

export interface MarketDataProviderIdentity {
  readonly providerId: string;
  readonly displayName: string;
}

export interface MarketDataProviderMetadata {
  readonly schemaVersion: typeof MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION;
  readonly metadataVersion: string;
  readonly identity: MarketDataProviderIdentity;
  readonly status: MarketDataProviderStatus;
  readonly supportedAssetClasses: readonly MarketAssetClass[];
  readonly capabilities: readonly MarketDataCapability[];
  /** Static discovery order only. Lower values are listed first; this is not routing authority. */
  readonly priority: number;
  readonly defaultEnabled: boolean;
  readonly documentationReference: string;
}

export interface MarketDataProviderRegistryPolicy {
  readonly schemaVersion: typeof MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION;
  readonly policyId: string;
  readonly version: string;
  readonly displayNamePolicy: MarketDataProviderNamePolicy;
}

export interface MarketDataProviderRegistry {
  listProviders(scope?: MarketDataProviderQueryScope): readonly MarketDataProviderMetadata[];
  getProvider(providerId: unknown): MarketDataProviderMetadata;
  requireEnabledProvider(providerId: unknown): MarketDataProviderMetadata;
  findByCapability(
    capability: unknown,
    scope?: MarketDataProviderQueryScope,
  ): readonly MarketDataProviderMetadata[];
  findByAssetClass(
    assetClass: unknown,
    scope?: MarketDataProviderQueryScope,
  ): readonly MarketDataProviderMetadata[];
  requireCapability(providerId: unknown, capability: unknown): MarketDataProviderMetadata;
  requireAssetClass(providerId: unknown, assetClass: unknown): MarketDataProviderMetadata;
}
