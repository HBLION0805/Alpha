import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";
import type { BarDecimal } from "./CanonicalBar";
import type { InstrumentAssetClass } from "./CanonicalInstrument";

export const MARKET_REGIME_SCHEMA_VERSION = "1.0" as const;

export enum MarketRegimePrimary {
  BullTrend = "BULL_TREND",
  BearTrend = "BEAR_TREND",
  Correction = "CORRECTION",
  ReliefRally = "RELIEF_RALLY",
  RangeBound = "RANGE_BOUND",
  InsufficientEvidence = "INSUFFICIENT_EVIDENCE",
}

export enum MarketRegimeCondition {
  HighVolatility = "HIGH_VOLATILITY",
  DistributionRisk = "DISTRIBUTION_RISK",
  AccumulationCandidate = "ACCUMULATION_CANDIDATE",
}

export enum MarketRegimeEvidenceStrength {
  Strong = "STRONG_EVIDENCE",
  Moderate = "MODERATE_EVIDENCE",
  Weak = "WEAK_EVIDENCE",
  Insufficient = "INSUFFICIENT_EVIDENCE",
}

export enum MarketRegimeDataQualityStatus {
  Accepted = "ACCEPTED",
  Limited = "LIMITED",
  Stale = "STALE",
  Rejected = "REJECTED",
  Conflicting = "CONFLICTING",
  Unavailable = "UNAVAILABLE",
}

export enum RegimeCanonicalIdentityStatus {
  Resolved = "RESOLVED",
  Unresolved = "UNRESOLVED",
}

export enum RegimeBenchmarkScope {
  BroadMarket = "BROAD_MARKET",
}

export enum RegimeObservationQualityStatus {
  Accepted = "ACCEPTED",
  Rejected = "REJECTED",
  Conflicting = "CONFLICTING",
  Unavailable = "UNAVAILABLE",
}

export enum RegimeSupplementalEvidenceStatus {
  Verified = "VERIFIED",
  Unverified = "UNVERIFIED",
  Unavailable = "UNAVAILABLE",
  Conflicting = "CONFLICTING",
}

export enum RegimeVolumeSignal {
  Distribution = "DISTRIBUTION",
  Accumulation = "ACCUMULATION",
  Neutral = "NEUTRAL",
}

export enum RegimeBreadthSignal {
  Positive = "POSITIVE",
  Negative = "NEGATIVE",
  Neutral = "NEUTRAL",
}

export enum MarketRegimeVolatilityMetric {
  MaximumAbsoluteReturnBasisPoints = "MAXIMUM_ABSOLUTE_RETURN_BASIS_POINTS",
}

export enum MarketRegimeReasonCode {
  ShortTrendPositive = "SHORT_TREND_POSITIVE",
  ShortTrendNegative = "SHORT_TREND_NEGATIVE",
  MediumTrendPositive = "MEDIUM_TREND_POSITIVE",
  MediumTrendNegative = "MEDIUM_TREND_NEGATIVE",
  DirectionalStrengthLow = "DIRECTIONAL_STRENGTH_LOW",
  DrawdownThresholdExceeded = "DRAWDOWN_THRESHOLD_EXCEEDED",
  ReboundAfterDecline = "REBOUND_AFTER_DECLINE",
  VolatilityThresholdExceeded = "VOLATILITY_THRESHOLD_EXCEEDED",
  RequiredObservationsMissing = "REQUIRED_OBSERVATIONS_MISSING",
  DataStale = "DATA_STALE",
  DataQualityRejected = "DATA_QUALITY_REJECTED",
  DataQualityConflicting = "DATA_QUALITY_CONFLICTING",
  CanonicalIdentityUnresolved = "CANONICAL_IDENTITY_UNRESOLVED",
  EvidenceReferencesMissing = "EVIDENCE_REFERENCES_MISSING",
  ObservationOrderingInvalid = "OBSERVATION_ORDERING_INVALID",
  ContradictoryInputs = "CONTRADICTORY_INPUTS",
  DirectionalStructureUnresolved = "DIRECTIONAL_STRUCTURE_UNRESOLVED",
  VolumeEvidenceUnavailable = "VOLUME_EVIDENCE_UNAVAILABLE",
  VolumeSemanticsUnverified = "VOLUME_SEMANTICS_UNVERIFIED",
  BreadthEvidenceUnavailable = "BREADTH_EVIDENCE_UNAVAILABLE",
  DistributionEvidenceSatisfied = "DISTRIBUTION_EVIDENCE_SATISFIED",
  AccumulationEvidenceSatisfied = "ACCUMULATION_EVIDENCE_SATISFIED",
}

export enum MarketRegimeValidationIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidObservationWindow = "INVALID_OBSERVATION_WINDOW",
  InvalidCanonicalIdentity = "INVALID_CANONICAL_IDENTITY",
  InvalidObservation = "INVALID_OBSERVATION",
  InvalidDecimal = "INVALID_DECIMAL",
  InvalidQualityStatus = "INVALID_QUALITY_STATUS",
  InvalidEvidenceReference = "INVALID_EVIDENCE_REFERENCE",
  InvalidRequestedCondition = "INVALID_REQUESTED_CONDITION",
  InvalidSupplementalEvidence = "INVALID_SUPPLEMENTAL_EVIDENCE",
  InvalidPolicy = "INVALID_POLICY",
  InvalidThreshold = "INVALID_THRESHOLD",
}

export interface MarketRegimeObservationWindow {
  readonly start: string;
  readonly end: string;
}

export interface RegimeBenchmarkIdentity {
  readonly status: RegimeCanonicalIdentityStatus;
  readonly instrumentId?: string;
  readonly assetClass?: InstrumentAssetClass.Etf | InstrumentAssetClass.Index;
  readonly scope?: RegimeBenchmarkScope;
}

/** Provider-independent close observation; source payloads and symbols are forbidden. */
export interface RegimePriceObservation {
  readonly observationId: string;
  readonly observedAt: string;
  readonly close: BarDecimal;
  readonly qualityStatus: RegimeObservationQualityStatus;
  readonly evidenceReferences: readonly string[];
}

export interface RegimeVolumeEvidence {
  readonly status: RegimeSupplementalEvidenceStatus;
  readonly signal?: RegimeVolumeSignal;
  readonly unitSemanticsVersion?: string;
  readonly observedAt?: string;
  readonly evidenceReferences: readonly string[];
}

export interface RegimeBreadthEvidence {
  readonly status: RegimeSupplementalEvidenceStatus;
  readonly signal?: RegimeBreadthSignal;
  readonly observedAt?: string;
  readonly evidenceReferences: readonly string[];
}

export interface RegimeVolatilityIndexObservation {
  readonly instrumentId: string;
  readonly observedAt: string;
  readonly value: BarDecimal;
  readonly qualityStatus: RegimeObservationQualityStatus;
  readonly evidenceReferences: readonly string[];
}

export interface MarketRegimeTraceMetadata {
  readonly correlationId: string;
  readonly traceId: string;
  readonly auditReferenceIds: readonly string[];
}

export interface RegimeInputSnapshotInput {
  readonly schemaVersion: typeof MARKET_REGIME_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly benchmark: RegimeBenchmarkIdentity;
  readonly observationWindow: MarketRegimeObservationWindow;
  readonly observations: readonly RegimePriceObservation[];
  readonly dataQualityStatus: MarketRegimeDataQualityStatus;
  readonly requestedSecondaryConditions: readonly MarketRegimeCondition[];
  readonly volumeEvidence?: RegimeVolumeEvidence;
  readonly breadthEvidence?: RegimeBreadthEvidence;
  readonly volatilityIndexObservation?: RegimeVolatilityIndexObservation;
  readonly evidenceReferences: readonly string[];
  readonly trace: MarketRegimeTraceMetadata;
  readonly createdAt: string;
}

export interface RegimeInputSnapshot extends RegimeInputSnapshotInput {
  readonly fingerprint: string;
}

export interface MarketRegimePolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly shortTrendWindow: number;
  readonly mediumTrendWindow: number;
  readonly correctionDrawdownThresholdBasisPoints: number;
  readonly reliefRallyReboundThresholdBasisPoints: number;
  readonly highVolatilityThresholdBasisPoints: number;
  readonly rangeBoundThresholdBasisPoints: number;
  readonly freshnessThresholdSeconds: number;
  readonly minimumRequiredObservations: number;
  readonly strongEvidenceMinimumObservations: number;
  readonly volatilityMetric: MarketRegimeVolatilityMetric;
}

export interface MarketRegimeFeatureSet {
  readonly shortTrendBasisPoints: number;
  readonly mediumTrendBasisPoints: number;
  readonly currentDrawdownBasisPoints: number;
  readonly reboundFromWindowLowBasisPoints: number;
  readonly maximumAbsoluteReturnBasisPoints: number;
  readonly windowRangeBasisPoints: number;
  readonly observationCount: number;
}

export interface MarketRegimeUnresolvedRequirement {
  readonly code: MarketRegimeReasonCode;
  readonly message: string;
}

export interface MarketRegimeAssessmentRequest {
  readonly schemaVersion: typeof MARKET_REGIME_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly assessedAt: string;
  readonly createdAt: string;
  readonly snapshot: RegimeInputSnapshot;
  readonly policy: MarketRegimePolicy;
}

export interface MarketRegimeAssessment {
  readonly schemaVersion: typeof MARKET_REGIME_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly assessedAt: string;
  readonly createdAt: string;
  readonly observationWindow: MarketRegimeObservationWindow;
  readonly benchmarkInstrumentId?: string;
  readonly primaryRegime: MarketRegimePrimary;
  readonly secondaryConditions: readonly MarketRegimeCondition[];
  /** Evidence strength only; never a probability or prediction-confidence value. */
  readonly evidenceStrength: MarketRegimeEvidenceStrength;
  readonly reasonCodes: readonly MarketRegimeReasonCode[];
  readonly inputSnapshotId: string;
  readonly inputSnapshotFingerprint: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly features?: MarketRegimeFeatureSet;
  readonly evidenceReferences: readonly string[];
  readonly dataQualityStatus: MarketRegimeDataQualityStatus;
  readonly unresolvedRequirements: readonly MarketRegimeUnresolvedRequirement[];
  readonly trace: MarketRegimeTraceMetadata;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface MarketRegimeValidationIssue {
  readonly code: MarketRegimeValidationIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface MarketRegimeValidationResult {
  readonly valid: boolean;
  readonly issues: readonly MarketRegimeValidationIssue[];
}

export interface MarketRegimeAuditTranslationContext {
  readonly recordId: string;
  readonly idempotencyKey: string;
  readonly parentAuditRecordIds: readonly string[];
  readonly relatedAuditRecordIds: readonly string[];
  readonly actor: AIAuditActor;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly metadata?: AIAuditMetadata;
}

export type MarketRegimeAuditTranslator = (
  assessment: Readonly<MarketRegimeAssessment>,
  context: Readonly<MarketRegimeAuditTranslationContext>,
) => AIAuditRecordInput;
