import type { BarInterval } from "./CanonicalBar";

export const VERIFIED_MARKET_SNAPSHOT_SCHEMA_VERSION = "1.0" as const;

export enum VerifiedMarketSnapshotStatus {
  Verified = "VERIFIED",
  Blocked = "BLOCKED",
}
export enum VerifiedMarketEvidenceStatus {
  Available = "AVAILABLE",
  Unavailable = "UNAVAILABLE",
  Missing = "MISSING",
  Blocked = "BLOCKED",
  Stale = "STALE",
  Invalid = "INVALID",
}
export enum VerifiedMarketProviderCapability {
  Bars = "BARS",
  LatestQuote = "LATEST_QUOTE",
}
export enum VerifiedMarketProviderAttemptResult {
  Succeeded = "SUCCEEDED",
  Rejected = "REJECTED",
}
export enum VerifiedMarketEvidenceResolutionResult {
  Resolved = "RESOLVED",
}
export enum VerifiedMarketDataOrigin {
  Fixture = "FIXTURE",
  Network = "NETWORK",
}
export enum VerifiedMarketCalendarSessionStatus {
  Completed = "COMPLETED_TRADING_SESSION",
  Scheduled = "SCHEDULED_TRADING_SESSION",
  HolidayClosed = "MARKET_HOLIDAY",
}

export interface VerifiedMarketSessionIdentity {
  readonly calendarId: string;
  readonly sessionId: string;
  readonly sessionDate: string;
  /** Phase 1A supports completed US-equities regular sessions only. */
  readonly sessionType: "REGULAR";
  readonly timezone: string;
}
export interface VerifiedMarketCalendarSessionEvidence
  extends VerifiedMarketSessionIdentity {
  readonly calendarEvidenceId: string;
  readonly calendarEvidenceFingerprint: string;
  readonly marketOpen: string;
  readonly marketClose: string;
  readonly closureBufferSeconds: number;
  readonly status: VerifiedMarketCalendarSessionStatus;
  readonly provenanceReference: string;
  readonly dataOrigin: VerifiedMarketDataOrigin;
}
export interface CanonicalBarReference {
  readonly canonicalBarId: string;
  readonly canonicalBarFingerprint: string;
  readonly canonicalInstrumentId: string;
  readonly interval: BarInterval;
  readonly intervalStart: string;
  readonly intervalEnd: string;
  readonly observationTime: string;
  readonly sessionDate: string;
  readonly status: "FINAL";
  readonly freshness: "CURRENT" | "STALE";
  readonly provenanceReference: string;
}
export interface CanonicalQuoteReference {
  readonly canonicalQuoteId: string;
  readonly canonicalQuoteFingerprint: string;
  readonly canonicalInstrumentId: string;
  readonly observationTime: string;
  readonly status: "CURRENT" | "STALE";
  readonly provenanceReference: string;
}
/** One record represents one real transport attempt, including a batch request. */
export interface ProviderRequestAttempt {
  readonly requestAttemptId: string;
  readonly requestId: string;
  readonly requestedProvider: string;
  readonly actualProvider: string;
  readonly capability: VerifiedMarketProviderCapability;
  readonly interval?: BarInterval;
  readonly requestedSymbolScope: readonly string[];
  readonly mappingRegistryVersion: string;
  readonly requestWindowStart: string;
  readonly requestWindowEnd: string;
  readonly requestFingerprint: string;
  readonly attemptOrder: number;
  readonly result: VerifiedMarketProviderAttemptResult;
  readonly failureReason?: string;
  readonly receivedAt: string;
  readonly responseSourceReference: string;
  readonly dataOrigin: VerifiedMarketDataOrigin;
  readonly adapterUnderTest: string;
}
/** One successful resolution binds one Snapshot evidence item to its real batch request. */
export interface EvidenceResolution {
  readonly resolutionId: string;
  readonly resolutionFingerprint: string;
  readonly result: VerifiedMarketEvidenceResolutionResult;
  readonly requestAttemptId: string;
  readonly evidenceId: string;
  readonly evidenceFingerprint: string;
  readonly canonicalInstrumentId: string;
  readonly providerSymbol: string;
  readonly providerSymbolMappingVersion: string;
  readonly providerSymbolMappingFingerprint: string;
  readonly capability: VerifiedMarketProviderCapability;
  readonly interval?: BarInterval;
  readonly evidenceWindowStart: string;
  readonly evidenceWindowEnd: string;
  readonly observedAt: string;
  readonly provenanceReference: string;
  readonly responseSourceReference: string;
}
export interface VerifiedMarketSnapshotTimeframeBinding {
  readonly interval: BarInterval;
  readonly startBarId: string;
  readonly startBarFingerprint: string;
  readonly endBarId: string;
  readonly endBarFingerprint: string;
}
export interface VerifiedMarketSnapshotCandidateBinding {
  readonly candidateId: string;
  readonly analysisInstrumentId: string;
  readonly tradeVehicleId: string;
  readonly timeframes: readonly VerifiedMarketSnapshotTimeframeBinding[];
  readonly quoteId: string;
  readonly quoteFingerprint: string;
}
/** Exact evidence that Personal Market Data Composition will consume; no extras are accepted. */
export interface VerifiedMarketSnapshotCompositionBinding {
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly candidates: readonly VerifiedMarketSnapshotCandidateBinding[];
}
export interface VerifiedMarketFreshnessQualityPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly closureBufferSeconds: number;
  readonly quoteMaxAgeSeconds: number;
  readonly barMaxAgeSeconds: Readonly<{
    readonly P1D: number;
    readonly PT1H: number;
    readonly PT15M: number;
    readonly PT5M: number;
  }>;
}
export interface VerifiedMarketRequiredEvidence {
  readonly analysisBars: VerifiedMarketEvidenceStatus;
  readonly tradeVehicleQuotes: VerifiedMarketEvidenceStatus;
  readonly benchmarks: VerifiedMarketEvidenceStatus;
  readonly provenance: VerifiedMarketEvidenceStatus;
}
export interface VerifiedMarketSnapshotInput {
  readonly schemaVersion: typeof VERIFIED_MARKET_SNAPSHOT_SCHEMA_VERSION;
  readonly asOf: string;
  readonly session: VerifiedMarketSessionIdentity;
  readonly sessionCalendarEvidence: readonly VerifiedMarketCalendarSessionEvidence[];
  readonly analysisInstrumentIds: readonly string[];
  readonly tradeVehicleIds: readonly string[];
  readonly benchmarkInstrumentIds: readonly string[];
  readonly canonicalBarReferences: readonly CanonicalBarReference[];
  readonly canonicalQuoteReferences: readonly CanonicalQuoteReference[];
  readonly providerRequestAttempts: readonly ProviderRequestAttempt[];
  readonly evidenceResolutions: readonly EvidenceResolution[];
  readonly freshnessQualityPolicy: VerifiedMarketFreshnessQualityPolicy;
  readonly compositionBinding: VerifiedMarketSnapshotCompositionBinding;
  readonly requiredEvidenceStatus: VerifiedMarketRequiredEvidence;
  readonly volatilityEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly blockingReasons: readonly string[];
}
export interface VerifiedMarketSnapshot extends VerifiedMarketSnapshotInput {
  readonly snapshotId: string;
  readonly status: VerifiedMarketSnapshotStatus;
  readonly snapshotFingerprint: string;
  readonly deterministic: true;
  readonly readOnly: true;
  readonly providerNativePayloadStored: false;
}
export enum VerifiedMarketSnapshotIssueCode {
  InvalidRecord = "INVALID_RECORD",
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  FutureObservation = "FUTURE_OBSERVATION",
  IncompleteBar = "INCOMPLETE_BAR",
  StaleObservation = "STALE_OBSERVATION",
  MissingProvenance = "MISSING_PROVENANCE",
  IdentityMismatch = "IDENTITY_MISMATCH",
  MissingRequiredEvidence = "MISSING_REQUIRED_EVIDENCE",
  SilentProviderFallback = "SILENT_PROVIDER_FALLBACK",
  InvalidProviderTrace = "INVALID_PROVIDER_TRACE",
  CoverageMissing = "COVERAGE_MISSING",
  CompositionBindingMismatch = "COMPOSITION_BINDING_MISMATCH",
  InvalidSessionEvidence = "INVALID_SESSION_EVIDENCE",
  UnsupportedSessionType = "UNSUPPORTED_SESSION_TYPE",
  RequestWindowMismatch = "REQUEST_WINDOW_MISMATCH",
  EvidenceCoverageMismatch = "EVIDENCE_COVERAGE_MISMATCH",
  TimeframeBarCountMismatch = "TIMEFRAME_BAR_COUNT_MISMATCH",
  TimeframeBarBindingInvalid = "TIMEFRAME_BAR_BINDING_INVALID",
}
export interface VerifiedMarketSnapshotIssue {
  readonly code: VerifiedMarketSnapshotIssueCode;
  readonly field: string;
  readonly message: string;
}
export interface VerifiedMarketSnapshotValidationResult {
  readonly valid: boolean;
  readonly issues: readonly VerifiedMarketSnapshotIssue[];
}
