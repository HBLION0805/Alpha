import type { AIAuditActor, AIAuditMetadata, AIAuditRecordInput, AIAuditRetentionClassification } from "./AIAuditRepository";
import type { BarDecimal, BarInterval } from "./CanonicalBar";
import type { InstrumentAssetClass } from "./CanonicalInstrument";
import type { PrivacyLevel } from "./AIRouter";

export const BROAD_MARKET_EVIDENCE_SCHEMA_VERSION = "1.0" as const;

export enum BroadMarketBenchmarkClassification {
  BroadMarket = "BROAD_MARKET",
  GrowthMarket = "GROWTH_MARKET",
  SectorMarket = "SECTOR_MARKET",
}

export enum BroadMarketBenchmarkRequirement {
  Required = "REQUIRED",
  Optional = "OPTIONAL",
}

export enum BroadMarketBenchmarkAvailability {
  Available = "AVAILABLE",
  Missing = "MISSING",
}

export enum BroadMarketObservationQuality {
  Accepted = "ACCEPTED",
  Rejected = "REJECTED",
  Conflicting = "CONFLICTING",
  Unavailable = "UNAVAILABLE",
}

export enum BroadMarketBenchmarkStatus {
  Accepted = "ACCEPTED",
  Missing = "MISSING",
  Stale = "STALE",
  Rejected = "REJECTED",
  Insufficient = "INSUFFICIENT",
}

export enum BroadMarketEvidenceQuality {
  Complete = "COMPLETE",
  Partial = "PARTIAL",
  Stale = "STALE",
  Contradictory = "CONTRADICTORY",
  Insufficient = "INSUFFICIENT",
}

/** Evidence strength is a deterministic adequacy band, never a probability. */
export enum BroadMarketEvidenceStrength {
  Strong = "STRONG_EVIDENCE",
  Moderate = "MODERATE_EVIDENCE",
  Weak = "WEAK_EVIDENCE",
  Insufficient = "INSUFFICIENT_EVIDENCE",
}

export enum BroadMarketTrendDirection {
  Positive = "POSITIVE",
  Negative = "NEGATIVE",
  Neutral = "NEUTRAL",
}

export enum BroadMarketEvidenceIssueSeverity {
  Blocker = "BLOCKER",
  Warning = "WARNING",
}

export enum BroadMarketEvidenceIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidWindow = "INVALID_WINDOW",
  InvalidDecimal = "INVALID_DECIMAL",
  InvalidBenchmark = "INVALID_BENCHMARK",
  UnsupportedBenchmarkAssetClass = "UNSUPPORTED_BENCHMARK_ASSET_CLASS",
  PolicyBenchmarkMismatch = "POLICY_BENCHMARK_MISMATCH",
  InvalidChronology = "INVALID_CHRONOLOGY",
  DuplicateTimestamp = "DUPLICATE_TIMESTAMP",
  ObservationOutsideWindow = "OBSERVATION_OUTSIDE_WINDOW",
  MissingRequiredBenchmark = "MISSING_REQUIRED_BENCHMARK",
  MissingOptionalBenchmark = "MISSING_OPTIONAL_BENCHMARK",
  InsufficientObservations = "INSUFFICIENT_OBSERVATIONS",
  DataStale = "DATA_STALE",
  DataQualityRejected = "DATA_QUALITY_REJECTED",
  DataQualityConflicting = "DATA_QUALITY_CONFLICTING",
  StrongBenchmarkDisagreement = "STRONG_BENCHMARK_DISAGREEMENT",
  InvalidPolicy = "INVALID_POLICY",
}

export interface BroadMarketTraceReference {
  readonly correlationId: string;
  readonly traceId: string;
  readonly auditReferenceIds: readonly string[];
}

export interface BroadMarketEvidenceWindow {
  readonly start: string;
  readonly end: string;
}

export interface BroadMarketBenchmarkReference {
  readonly instrumentId: string;
  readonly assetClass: InstrumentAssetClass.Etf | InstrumentAssetClass.Index;
  readonly classification: BroadMarketBenchmarkClassification;
  readonly metadataVersion: string;
  readonly reviewReference: string;
}

/** Provider-neutral observation reference copied from a reviewed Canonical Bar read model. */
export interface BroadMarketBenchmarkObservation {
  readonly observationId: string;
  readonly canonicalBarId: string;
  readonly canonicalBarFingerprint: string;
  readonly instrumentId: string;
  readonly observedAt: string;
  readonly close: BarDecimal;
  readonly qualityStatus: BroadMarketObservationQuality;
  readonly evidenceReferences: readonly string[];
}

export interface BroadMarketBenchmarkSeries {
  readonly benchmark: BroadMarketBenchmarkReference;
  readonly availability: BroadMarketBenchmarkAvailability;
  readonly observations: readonly BroadMarketBenchmarkObservation[];
}

export interface BroadMarketEvidenceSnapshotInput {
  readonly schemaVersion: typeof BROAD_MARKET_EVIDENCE_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly asOf: string;
  readonly evidenceWindow: BroadMarketEvidenceWindow;
  readonly interval: BarInterval;
  readonly benchmarkSeries: readonly BroadMarketBenchmarkSeries[];
  readonly trace: BroadMarketTraceReference;
  readonly createdAt: string;
}

export interface BroadMarketEvidenceSnapshot extends BroadMarketEvidenceSnapshotInput {
  readonly fingerprint: string;
}

export interface BroadMarketBenchmarkPolicyRequirement {
  readonly benchmark: BroadMarketBenchmarkReference;
  readonly requirement: BroadMarketBenchmarkRequirement;
}

export interface BroadMarketEvidencePolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly featureCalculationVersion: string;
  readonly expectedInterval: BarInterval;
  readonly benchmarkRequirements: readonly BroadMarketBenchmarkPolicyRequirement[];
  readonly shortWindow: number;
  readonly mediumWindow: number;
  readonly minimumObservationsPerBenchmark: number;
  readonly freshnessThresholdSeconds: number;
  readonly positiveTrendThresholdBasisPoints: number;
  readonly negativeTrendThresholdBasisPoints: number;
  readonly drawdownThresholdBasisPoints: number;
  readonly reboundThresholdBasisPoints: number;
  readonly highVolatilityThresholdBasisPoints: number;
  readonly minimumRequiredBenchmarks: number;
  readonly contradictionMinimumOpposingCount: number;
  readonly moderateAgreementCount: number;
  readonly strongAgreementCount: number;
}

export interface BroadMarketBenchmarkFeatureSet {
  readonly shortReturnBasisPoints: number;
  readonly mediumReturnBasisPoints: number;
  readonly drawdownFromWindowHighBasisPoints: number;
  readonly reboundFromWindowLowBasisPoints: number;
  readonly maximumAbsoluteReturnBasisPoints: number;
  readonly windowRangeBasisPoints: number;
  readonly recoveryPercentageBasisPoints: number;
  readonly observationCount: number;
  readonly latestObservedAt: string;
}

export interface BroadMarketEvidenceIssue {
  readonly code: BroadMarketEvidenceIssueCode;
  readonly severity: BroadMarketEvidenceIssueSeverity;
  readonly benchmarkInstrumentId?: string;
  readonly field: string;
  readonly message: string;
}

export interface BroadMarketBenchmarkFeatureSummary {
  readonly benchmark: BroadMarketBenchmarkReference;
  readonly requirement: BroadMarketBenchmarkRequirement;
  readonly status: BroadMarketBenchmarkStatus;
  readonly trendDirection?: BroadMarketTrendDirection;
  readonly features?: BroadMarketBenchmarkFeatureSet;
  readonly observationReferences: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly issues: readonly BroadMarketEvidenceIssue[];
}

export interface BroadMarketAggregateFacts {
  readonly totalBenchmarkCount: number;
  readonly requiredBenchmarkCount: number;
  readonly optionalBenchmarkCount: number;
  readonly acceptedBenchmarkCount: number;
  readonly agreementCount: number;
  readonly disagreementCount: number;
  readonly positiveTrendCount: number;
  readonly negativeTrendCount: number;
  readonly neutralTrendCount: number;
  readonly reboundCount: number;
  readonly drawdownCount: number;
  readonly highVolatilityCount: number;
  readonly staleBenchmarkCount: number;
  readonly missingBenchmarkCount: number;
}

export interface BroadMarketEvidenceAssessmentRequest {
  readonly schemaVersion: typeof BROAD_MARKET_EVIDENCE_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly assessedAt: string;
  readonly createdAt: string;
  readonly snapshot: BroadMarketEvidenceSnapshot;
  readonly policy: BroadMarketEvidencePolicy;
}

export interface BroadMarketEvidenceAssessment {
  readonly schemaVersion: typeof BROAD_MARKET_EVIDENCE_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly assessedAt: string;
  readonly createdAt: string;
  readonly asOf: string;
  readonly evidenceWindow: BroadMarketEvidenceWindow;
  readonly interval: BarInterval;
  readonly inputSnapshotId: string;
  readonly inputSnapshotFingerprint: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly featureCalculationVersion: string;
  readonly quality: BroadMarketEvidenceQuality;
  readonly evidenceStrength: BroadMarketEvidenceStrength;
  readonly benchmarkSummaries: readonly BroadMarketBenchmarkFeatureSummary[];
  readonly aggregateFacts: BroadMarketAggregateFacts;
  readonly issues: readonly BroadMarketEvidenceIssue[];
  readonly warnings: readonly BroadMarketEvidenceIssue[];
  readonly evidenceReferences: readonly string[];
  readonly trace: BroadMarketTraceReference;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface BroadMarketEvidenceValidationResult {
  readonly valid: boolean;
  readonly issues: readonly BroadMarketEvidenceIssue[];
}

export interface BroadMarketEvidenceAuditTranslationContext {
  readonly recordId: string;
  readonly idempotencyKey: string;
  readonly parentAuditRecordIds: readonly string[];
  readonly relatedAuditRecordIds: readonly string[];
  readonly actor: AIAuditActor;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly metadata?: AIAuditMetadata;
}

export type BroadMarketEvidenceAuditTranslator = (
  assessment: Readonly<BroadMarketEvidenceAssessment>,
  context: Readonly<BroadMarketEvidenceAuditTranslationContext>,
) => AIAuditRecordInput;
