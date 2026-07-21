import {
  InstrumentAssetClass,
  type CanonicalInstrument,
} from "./CanonicalInstrument";

export const MARKET_DATA_SCHEMA_VERSION = "1.0" as const;

export enum MarketDataOperation {
  LatestQuote = "LATEST_QUOTE",
}

export enum MarketDataType {
  Quote = "QUOTE",
}

/** @deprecated Use InstrumentAssetClass from CanonicalInstrument for new code. */
export const MarketAssetClass = InstrumentAssetClass;
/** @deprecated Use InstrumentAssetClass from CanonicalInstrument for new code. */
export type MarketAssetClass = InstrumentAssetClass;

export enum MarketDataCapability {
  LatestQuote = "LATEST_QUOTE",
  LatestTrade = "LATEST_TRADE",
  Bars = "BARS",
  ResolveInstrument = "RESOLVE_INSTRUMENT",
  MarketStatus = "MARKET_STATUS",
  Health = "HEALTH",
}

export enum MarketDataProviderHealthStatus {
  Available = "AVAILABLE",
  Degraded = "DEGRADED",
  Unavailable = "UNAVAILABLE",
}

export enum MarketDataTransportStatus {
  NotAttempted = "NOT_ATTEMPTED",
  Succeeded = "SUCCEEDED",
  Failed = "FAILED",
  Unavailable = "UNAVAILABLE",
}

export enum MarketDataNormalizationStatus {
  NotAttempted = "NOT_ATTEMPTED",
  Normalized = "NORMALIZED",
  Rejected = "REJECTED",
}

export enum MarketDataValidationStatus {
  NotRun = "NOT_RUN",
  Passed = "PASSED",
  Failed = "FAILED",
}

export enum MarketDataResultStatus {
  Accepted = "ACCEPTED",
  Rejected = "REJECTED",
  Unavailable = "UNAVAILABLE",
  Unsupported = "UNSUPPORTED",
}

export enum MarketDataQualityStatus {
  Valid = "VALID",
  Invalid = "INVALID",
  Stale = "STALE",
  Incomplete = "INCOMPLETE",
  Unavailable = "UNAVAILABLE",
  Unsupported = "UNSUPPORTED",
  OutOfOrder = "OUT_OF_ORDER",
  Conflicting = "CONFLICTING",
}

export enum MarketDataValidationDimension {
  Schema = "SCHEMA",
  ProviderIdentity = "PROVIDER_IDENTITY",
  InstrumentIdentity = "INSTRUMENT_IDENTITY",
  Provenance = "PROVENANCE",
  Timestamp = "TIMESTAMP",
  Freshness = "FRESHNESS",
  Numeric = "NUMERIC",
  Precision = "PRECISION",
  Ordering = "ORDERING",
  InternalConsistency = "INTERNAL_CONSISTENCY",
  Duplicate = "DUPLICATE",
}

export enum MarketDataDimensionStatus {
  Passed = "PASSED",
  Failed = "FAILED",
  NotAssessed = "NOT_ASSESSED",
}

export enum MarketDataDuplicatePolicy {
  RejectExact = "REJECT_EXACT",
  AllowExactWithWarning = "ALLOW_EXACT_WITH_WARNING",
}

export enum MarketDataQuantityUnit {
  BaseUnits = "BASE_UNITS",
}

export enum MarketDataAdapterErrorCategory {
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  TransportFailure = "TRANSPORT_FAILURE",
  MalformedResponse = "MALFORMED_RESPONSE",
  InvalidRequest = "INVALID_REQUEST",
  Unknown = "UNKNOWN",
}

export enum MarketDataIssueCode {
  ProviderNotRegistered = "PROVIDER_NOT_REGISTERED",
  ProviderNotAllowed = "PROVIDER_NOT_ALLOWED",
  ProviderDisabled = "PROVIDER_DISABLED",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  CapabilityUnsupported = "CAPABILITY_UNSUPPORTED",
  TransportFailure = "TRANSPORT_FAILURE",
  NormalizationRejected = "NORMALIZATION_REJECTED",
  ConflictingFields = "CONFLICTING_FIELDS",
  MissingRequiredField = "MISSING_REQUIRED_FIELD",
  InvalidProviderIdentity = "INVALID_PROVIDER_IDENTITY",
  InvalidInstrumentIdentity = "INVALID_INSTRUMENT_IDENTITY",
  MissingProvenance = "MISSING_PROVENANCE",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  MissingObservationTime = "MISSING_OBSERVATION_TIME",
  StaleObservation = "STALE_OBSERVATION",
  FutureObservation = "FUTURE_OBSERVATION",
  InvalidNumericValue = "INVALID_NUMERIC_VALUE",
  InvalidPrecision = "INVALID_PRECISION",
  InvalidCurrency = "INVALID_CURRENCY",
  AmbiguousUnits = "AMBIGUOUS_UNITS",
  OutOfOrderObservation = "OUT_OF_ORDER_OBSERVATION",
  DuplicateObservation = "DUPLICATE_OBSERVATION",
  InvalidQuoteRelationship = "INVALID_QUOTE_RELATIONSHIP",
}

export interface MarketDecimal {
  readonly atomicValue: string;
  readonly scale: number;
}

/** Compatibility alias; canonical identity is owned by the Canonical Instrument foundation. */
export type CanonicalInstrumentIdentity = CanonicalInstrument;

export interface MarketDataInstrumentRequest {
  readonly instrumentId: string;
}

export interface MarketDataProviderDescriptor {
  readonly schemaVersion: typeof MARKET_DATA_SCHEMA_VERSION;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly providerId: string;
  readonly enabled: boolean;
  readonly capabilities: readonly MarketDataCapability[];
  readonly supportedAssetClasses: readonly InstrumentAssetClass[];
}

export interface MarketDataProviderHealth {
  readonly providerId: string;
  readonly status: MarketDataProviderHealthStatus;
  readonly observedAt: string;
  readonly reason?: string;
}

export interface MarketDataFreshnessRule {
  readonly assetClass: InstrumentAssetClass;
  readonly dataType: MarketDataType.Quote;
  readonly maxAgeSeconds: number;
  readonly maxPriceScale: number;
  readonly allowedCurrencies: readonly string[];
  readonly requireObservationTime: boolean;
}

export interface MarketDataPolicy {
  readonly schemaVersion: typeof MARKET_DATA_SCHEMA_VERSION;
  readonly policyId: string;
  readonly version: string;
  readonly allowedProviderIds: readonly string[];
  readonly requiredCapabilities: readonly MarketDataCapability[];
  readonly duplicatePolicy: MarketDataDuplicatePolicy;
  readonly freshnessRules: readonly MarketDataFreshnessRule[];
}

export interface MarketDataTraceMetadata {
  readonly correlationId: string;
  readonly causationId?: string;
}

export interface LatestQuoteRequest {
  readonly schemaVersion: typeof MARKET_DATA_SCHEMA_VERSION;
  readonly requestId: string;
  readonly operation: MarketDataOperation.LatestQuote;
  readonly providerId: string;
  readonly instrument: MarketDataInstrumentRequest;
  readonly requestedAt: string;
  readonly evaluatedAt: string;
  readonly policy: MarketDataPolicy;
  readonly trace: MarketDataTraceMetadata;
  readonly previousObservationTime?: string;
  readonly previousFingerprint?: string;
}

export interface MarketDataRawResponse {
  readonly providerId: string;
  readonly receivedAt: string;
  readonly payload: unknown;
}

export interface MarketDataSourceMetadata {
  readonly providerId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly providerInstrumentId: string;
  readonly providerSymbol: string;
  readonly sourceReference: string;
  readonly contentIntegrityReference: string;
}

export interface NormalizedQuoteCandidate {
  readonly instrument?: CanonicalInstrumentIdentity;
  readonly bidPrice?: MarketDecimal;
  readonly askPrice?: MarketDecimal;
  readonly bidSize?: MarketDecimal;
  readonly askSize?: MarketDecimal;
  readonly quantityUnit?: MarketDataQuantityUnit;
  readonly observationTime?: string;
  readonly providerPublishedAt?: string;
  readonly receivedAt?: string;
  readonly normalizedAt?: string;
  readonly source?: MarketDataSourceMetadata;
}

export interface MarketDataNormalizationIssue {
  readonly code: MarketDataIssueCode;
  readonly message: string;
  readonly field?: string;
}

export interface MarketDataNormalizationResult {
  readonly providerId: string;
  readonly status: MarketDataNormalizationStatus.Normalized | MarketDataNormalizationStatus.Rejected;
  readonly data?: NormalizedQuoteCandidate;
  readonly blockers: readonly MarketDataNormalizationIssue[];
  readonly warnings: readonly MarketDataNormalizationIssue[];
}

export interface MarketDataAdapterError {
  readonly providerId: string;
  readonly category: MarketDataAdapterErrorCategory;
  readonly safeCode: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface MarketDataProviderAdapter {
  getDescriptor(): MarketDataProviderDescriptor;
  getHealth(): MarketDataProviderHealth;
  fetchLatestQuote(request: Readonly<LatestQuoteRequest>): Promise<MarketDataRawResponse>;
  normalizeLatestQuote(
    raw: Readonly<MarketDataRawResponse>,
    request: Readonly<LatestQuoteRequest>,
  ): MarketDataNormalizationResult;
  normalizeError(
    error: unknown,
    request: Readonly<LatestQuoteRequest>,
    occurredAt: string,
  ): MarketDataAdapterError;
}

export interface CanonicalMarketQuote {
  readonly schemaVersion: typeof MARKET_DATA_SCHEMA_VERSION;
  readonly dataType: MarketDataType.Quote;
  readonly instrument: CanonicalInstrumentIdentity;
  readonly bidPrice: MarketDecimal;
  readonly askPrice: MarketDecimal;
  readonly bidSize?: MarketDecimal;
  readonly askSize?: MarketDecimal;
  readonly quantityUnit?: MarketDataQuantityUnit;
  readonly observationTime?: string;
  readonly providerPublishedAt?: string;
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly source: MarketDataSourceMetadata;
  readonly fingerprint: string;
}

export interface MarketDataValidationCheck {
  readonly dimension: MarketDataValidationDimension;
  readonly status: MarketDataDimensionStatus;
  readonly issueCodes: readonly MarketDataIssueCode[];
}

export interface MarketDataValidationResult {
  readonly status: MarketDataValidationStatus;
  readonly checks: readonly MarketDataValidationCheck[];
}

export interface MarketDataProcessingMetadata {
  readonly requestedAt: string;
  readonly evaluatedAt: string;
  readonly processedAt: string;
  readonly durationMs: number;
}

export interface MarketDataResult {
  readonly schemaVersion: typeof MARKET_DATA_SCHEMA_VERSION;
  readonly requestId: string;
  readonly operation: MarketDataOperation.LatestQuote;
  readonly status: MarketDataResultStatus;
  readonly qualityStatus: MarketDataQualityStatus;
  readonly providerId: string;
  readonly capability: MarketDataCapability.LatestQuote;
  readonly requestedInstrument: MarketDataInstrumentRequest;
  readonly canonicalInstrument?: CanonicalInstrumentIdentity;
  readonly observationTime?: string;
  readonly receivedAt?: string;
  readonly data?: CanonicalMarketQuote;
  readonly transportStatus: MarketDataTransportStatus;
  readonly normalizationStatus: MarketDataNormalizationStatus;
  readonly validation: MarketDataValidationResult;
  readonly blockers: readonly MarketDataNormalizationIssue[];
  readonly warnings: readonly MarketDataNormalizationIssue[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly trace: MarketDataTraceMetadata;
  readonly processing: MarketDataProcessingMetadata;
}

export interface MarketDataClock {
  now(): string;
}
