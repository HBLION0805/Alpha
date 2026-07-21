export const CANONICAL_INSTRUMENT_SCHEMA_VERSION = "1.0" as const;

export enum InstrumentAssetClass {
  Equity = "EQUITY",
  Etf = "ETF",
  Crypto = "CRYPTO",
  Index = "INDEX",
}

export enum InstrumentType {
  CommonStock = "COMMON_STOCK",
  ExchangeTradedFund = "EXCHANGE_TRADED_FUND",
  CryptoAsset = "CRYPTO_ASSET",
  MarketIndex = "MARKET_INDEX",
}

export enum InstrumentStatus {
  Active = "ACTIVE",
  Inactive = "INACTIVE",
  Delisted = "DELISTED",
  Deprecated = "DEPRECATED",
}

export enum InstrumentIdentifierType {
  CanonicalId = "CANONICAL_ID",
  ProviderSymbol = "PROVIDER_SYMBOL",
}

export interface CanonicalIdIdentifier {
  readonly identifierType: InstrumentIdentifierType.CanonicalId;
  readonly value: string;
}

/** Provider aliases are resolver inputs only and never become canonical instrument metadata. */
export interface ProviderSymbolIdentifier {
  readonly identifierType: InstrumentIdentifierType.ProviderSymbol;
  readonly providerId: string;
  readonly value: string;
}

export type InstrumentIdentifier = CanonicalIdIdentifier | ProviderSymbolIdentifier;

/** One immutable version of an Alpha-owned instrument identity record. */
export interface CanonicalInstrument {
  readonly schemaVersion: typeof CANONICAL_INSTRUMENT_SCHEMA_VERSION;
  readonly instrumentId: string;
  readonly metadataVersion: string;
  readonly displaySymbol: string;
  readonly displayName: string;
  readonly assetClass: InstrumentAssetClass;
  readonly instrumentType: InstrumentType;
  readonly status: InstrumentStatus;
  readonly currency: string;
  readonly exchange?: string;
  readonly timezone?: string;
  readonly effectiveFrom: string;
}

export enum CanonicalInstrumentValidationIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidInstrumentId = "INVALID_INSTRUMENT_ID",
  InvalidMetadataVersion = "INVALID_METADATA_VERSION",
  InvalidDisplaySymbol = "INVALID_DISPLAY_SYMBOL",
  InvalidDisplayName = "INVALID_DISPLAY_NAME",
  UnsupportedAssetClass = "UNSUPPORTED_ASSET_CLASS",
  UnsupportedInstrumentType = "UNSUPPORTED_INSTRUMENT_TYPE",
  IncompatibleClassification = "INCOMPATIBLE_CLASSIFICATION",
  InvalidStatus = "INVALID_STATUS",
  InvalidCurrency = "INVALID_CURRENCY",
  InvalidExchange = "INVALID_EXCHANGE",
  InvalidTimezone = "INVALID_TIMEZONE",
  InvalidEffectiveFrom = "INVALID_EFFECTIVE_FROM",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  UnsupportedIdentifierType = "UNSUPPORTED_IDENTIFIER_TYPE",
  InvalidProviderIdentity = "INVALID_PROVIDER_IDENTITY",
}

export interface CanonicalInstrumentValidationIssue {
  readonly code: CanonicalInstrumentValidationIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface CanonicalInstrumentValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CanonicalInstrumentValidationIssue[];
}

export enum InstrumentResolutionStatus {
  Resolved = "RESOLVED",
  NotFound = "NOT_FOUND",
  Ambiguous = "AMBIGUOUS",
  Invalid = "INVALID",
  Unsupported = "UNSUPPORTED",
}

export interface InstrumentResolutionRequest {
  readonly schemaVersion: typeof CANONICAL_INSTRUMENT_SCHEMA_VERSION;
  readonly requestId: string;
  readonly identifier: InstrumentIdentifier;
  readonly asOf?: string;
}

export interface InstrumentResolutionResult {
  readonly schemaVersion: typeof CANONICAL_INSTRUMENT_SCHEMA_VERSION;
  readonly requestId: string;
  readonly status: InstrumentResolutionStatus;
  readonly requestedIdentifier: InstrumentIdentifier;
  readonly instrument?: CanonicalInstrument;
  readonly candidateInstrumentIds: readonly string[];
  readonly blockers: readonly CanonicalInstrumentValidationIssue[];
  readonly warnings: readonly CanonicalInstrumentValidationIssue[];
}

/** Deterministic read port. Implementations must use an explicit local mapping snapshot. */
export interface InstrumentResolver {
  resolve(request: Readonly<InstrumentResolutionRequest>): InstrumentResolutionResult;
}
