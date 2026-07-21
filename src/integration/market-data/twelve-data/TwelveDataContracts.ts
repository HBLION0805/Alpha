import type { CanonicalInstrument, InstrumentAssetClass } from "../../../contracts/CanonicalInstrument";
import type { BarInterval, CanonicalBar } from "../../../contracts/CanonicalBar";
import type { MarketDataNormalizationIssue } from "../../../contracts/MarketData";

export const TWELVE_DATA_ADAPTER_SCHEMA_VERSION = "1.0" as const;
export const TWELVE_DATA_PROVIDER_ID = "provider:twelve-data" as const;
export const TWELVE_DATA_ADAPTER_ID = "adapter:twelve-data:bars" as const;
export const TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE = "ALPHA_TWELVE_DATA_API_KEY" as const;

export enum TwelveDataExecutionMode {
  Fixture = "FIXTURE",
  BoundedLiveSmoke = "BOUNDED_LIVE_SMOKE",
}

export enum TwelveDataTransportKind {
  Fixture = "FIXTURE",
  Live = "LIVE",
}

export enum TwelveDataMappingReviewStatus {
  Approved = "APPROVED",
  Pending = "PENDING",
}

export enum TwelveDataVolumeEvidenceStatus {
  FixtureReviewed = "FIXTURE_REVIEWED",
  OfficiallyVerified = "OFFICIALLY_VERIFIED",
  Unresolved = "UNRESOLVED",
}

export enum TwelveDataValidationIssueCode {
  InvalidRequest = "INVALID_REQUEST",
  InvalidCredentials = "INVALID_CREDENTIALS",
  UnsupportedInstrument = "UNSUPPORTED_INSTRUMENT",
  MappingNotApproved = "MAPPING_NOT_APPROVED",
  UnsupportedAssetClass = "UNSUPPORTED_ASSET_CLASS",
  UnsupportedInterval = "UNSUPPORTED_INTERVAL",
  InvalidWindow = "INVALID_WINDOW",
  SmokeLimitExceeded = "SMOKE_LIMIT_EXCEEDED",
  MalformedJson = "MALFORMED_JSON",
  ProviderError = "PROVIDER_ERROR",
  InvalidMetadata = "INVALID_METADATA",
  InvalidRow = "INVALID_ROW",
  AmbiguousTimestamp = "AMBIGUOUS_TIMESTAMP",
  CurrentOrUnclosedBar = "CURRENT_OR_UNCLOSED_BAR",
  VolumeUnitUnverified = "VOLUME_UNIT_UNVERIFIED",
  ProviderIdentityMismatch = "PROVIDER_IDENTITY_MISMATCH",
}

export interface TwelveDataCredentialDiagnostic {
  readonly environmentVariable: typeof TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE;
  readonly configured: true;
  readonly value: "[REDACTED]";
}

/** Opaque credential handle. Serialization and diagnostics are always redacted. */
export interface TwelveDataCredentials {
  revealForTransport(): string;
  toRedactedDiagnostic(): TwelveDataCredentialDiagnostic;
  toJSON(): TwelveDataCredentialDiagnostic;
  toString(): string;
}

export interface TwelveDataInstrumentMapping {
  readonly schemaVersion: typeof TWELVE_DATA_ADAPTER_SCHEMA_VERSION;
  readonly mappingId: string;
  readonly mappingVersion: string;
  readonly providerId: typeof TWELVE_DATA_PROVIDER_ID;
  readonly providerSymbol: "AAPL" | "SPY";
  readonly providerExchangeId: string;
  readonly providerMic: string;
  readonly providerAssetType: "Common Stock" | "ETF";
  readonly canonicalInstrument: CanonicalInstrument;
  readonly effectiveFrom: string;
  readonly sourceReference: string;
  readonly reviewStatus: TwelveDataMappingReviewStatus;
}

export interface TwelveDataNormalizationPolicy {
  readonly schemaVersion: typeof TWELVE_DATA_ADAPTER_SCHEMA_VERSION;
  readonly policyId: string;
  readonly version: string;
  readonly closureBufferSeconds: number;
  readonly maxAgeSeconds: number;
  readonly allowedAssetClasses: readonly InstrumentAssetClass[];
  readonly allowedIntervals: readonly BarInterval[];
  readonly volumeEvidenceStatus: TwelveDataVolumeEvidenceStatus;
}

export interface TwelveDataHttpRequest {
  readonly method: "GET";
  readonly endpoint: "https://api.twelvedata.com/time_series";
  readonly query: readonly (readonly [string, string])[];
  readonly timeoutMs: number;
}

export interface TwelveDataHttpResponse {
  readonly statusCode: number;
  readonly receivedAt: string;
  readonly transportKind: TwelveDataTransportKind;
  readonly body: string;
}

export interface TwelveDataHttpTransport {
  execute(
    request: Readonly<TwelveDataHttpRequest>,
    credentials: Readonly<TwelveDataCredentials>,
    options?: Readonly<TwelveDataTransportExecutionOptions>,
  ): Promise<TwelveDataHttpResponse>;
}

export interface TwelveDataTransportExecutionOptions {
  readonly signal?: AbortSignal;
}

export interface TwelveDataProviderMetadataPayload {
  readonly symbol: string;
  readonly interval: string;
  readonly currency: string;
  readonly exchange: string;
  readonly mic_code?: string;
  readonly exchange_timezone?: string;
  readonly type?: string;
}

export interface TwelveDataProviderBarRow {
  readonly datetime: string;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly volume: string;
}

export interface TwelveDataValidatedResponse {
  readonly meta: TwelveDataProviderMetadataPayload;
  readonly values: readonly TwelveDataProviderBarRow[];
  readonly status: "ok";
}

export interface TwelveDataParsedResponse {
  readonly status: "PARSED" | "REJECTED";
  readonly payload?: unknown;
  readonly blockers: readonly TwelveDataAdapterIssue[];
}

export interface TwelveDataResponseValidationResult {
  readonly status: "VALID" | "INVALID";
  readonly data?: TwelveDataValidatedResponse;
  readonly blockers: readonly TwelveDataAdapterIssue[];
  readonly warnings: readonly TwelveDataAdapterIssue[];
}

export interface TwelveDataNormalizationResult {
  readonly providerId: typeof TWELVE_DATA_PROVIDER_ID;
  readonly status: "NORMALIZED" | "REJECTED";
  readonly bars: readonly CanonicalBar[];
  readonly duplicateCount: number;
  readonly blockers: readonly MarketDataNormalizationIssue[];
  readonly warnings: readonly MarketDataNormalizationIssue[];
}

export interface TwelveDataAdapterIssue {
  readonly code: TwelveDataValidationIssueCode;
  readonly message: string;
  readonly field?: string;
  readonly rowIndex?: number;
}

export interface TwelveDataBarAdapterDependencies {
  readonly credentials: TwelveDataCredentials;
  readonly transport: TwelveDataHttpTransport;
  readonly mappings: readonly TwelveDataInstrumentMapping[];
  readonly policy: TwelveDataNormalizationPolicy;
  readonly executionMode: TwelveDataExecutionMode;
  readonly liveSmokePolicy?: TwelveDataLiveSmokePolicy;
  readonly clock: { now(): string };
}

export interface TwelveDataLiveSmokePolicy {
  readonly schemaVersion: typeof TWELVE_DATA_ADAPTER_SCHEMA_VERSION;
  readonly policyId: string;
  readonly version: string;
  readonly allowedProviderId: typeof TWELVE_DATA_PROVIDER_ID;
  readonly allowedSymbols: readonly ("AAPL" | "SPY")[];
  readonly allowedIntervals: readonly BarInterval[];
  readonly maxSymbolsPerRun: 1;
  readonly maxRequestsPerRun: 1;
  readonly maxLookbackSeconds: number;
  readonly maxRecords: number;
  readonly maxApiCreditsPerRun: number;
  readonly officialEvidenceReferences: readonly string[];
  readonly executionKind: "MANUAL_ONE_SHOT";
  readonly pollingAllowed: false;
  readonly persistenceAllowed: false;
  readonly streamingAllowed: false;
  readonly automaticRetryAllowed: false;
  readonly backgroundExecutionAllowed: false;
  readonly secretLoggingAllowed: false;
}
