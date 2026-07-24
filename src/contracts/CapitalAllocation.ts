import type {
  EvidenceFusionAssessmentStatus,
  EvidenceFusionCompleteness,
  EvidenceFusionFreshness,
  EvidenceFusionQuality,
} from "./EvidenceFusion";
import type {
  MarketRegimeDataQualityStatus,
  MarketRegimeEvidenceStrength,
  MarketRegimePrimary,
} from "./MarketRegime";

export const CAPITAL_ALLOCATION_SCHEMA_VERSION = "1.0" as const;
export const CAPITAL_ALLOCATION_FRAMEWORK_VERSION = "1.0" as const;

export enum AllocationAssetType {
  Equity = "EQUITY",
  Etf = "ETF",
  Crypto = "CRYPTO",
  EventContract = "EVENT_CONTRACT",
  CashEquivalent = "CASH_EQUIVALENT",
}

export enum AllocationCategory {
  Core = "CORE",
  Tactical = "TACTICAL",
  Defensive = "DEFENSIVE",
  EventDriven = "EVENT_DRIVEN",
  CashReserve = "CASH_RESERVE",
  Watchlist = "WATCHLIST",
}

/** Evidence-strength classification only; never probability or expected return. */
export enum AllocationConfidence {
  StrongEvidence = "STRONG_EVIDENCE",
  ModerateEvidence = "MODERATE_EVIDENCE",
  WeakEvidence = "WEAK_EVIDENCE",
  InsufficientEvidence = "INSUFFICIENT_EVIDENCE",
}

export enum AllocationEvidenceQuality {
  Sufficient = "SUFFICIENT",
  Limited = "LIMITED",
  Conflicting = "CONFLICTING",
  Insufficient = "INSUFFICIENT",
  Unavailable = "UNAVAILABLE",
}

export enum AllocationRiskLevel {
  Low = "LOW",
  Moderate = "MODERATE",
  High = "HIGH",
  Prohibited = "PROHIBITED",
  Unknown = "UNKNOWN",
}

export enum AllocationHoldingPeriod {
  Intraday = "INTRADAY",
  ShortTerm = "SHORT_TERM",
  Swing = "SWING",
  MediumTerm = "MEDIUM_TERM",
  LongTerm = "LONG_TERM",
  Undetermined = "UNDETERMINED",
}

/** V1 deliberately has no ranking authority. */
export enum AllocationPriority {
  Unranked = "UNRANKED",
}

export enum AllocationCandidateStatus {
  EligibleForReview = "ELIGIBLE_FOR_REVIEW",
  Watch = "WATCH",
  Avoid = "AVOID",
  Blocked = "BLOCKED",
}

export enum AllocationRecommendedAction {
  ReviewCandidates = "REVIEW_CANDIDATES",
  MaintainAllocation = "MAINTAIN_ALLOCATION",
  IncreaseCash = "INCREASE_CASH",
  NoAllocation = "NO_ALLOCATION",
}

export enum AllocationCashAction {
  Maintain = "MAINTAIN",
  Increase = "INCREASE",
  Decrease = "DECREASE",
  NotEvaluated = "NOT_EVALUATED",
}

export enum AllocationRiskGateStatus {
  Cleared = "CLEARED",
  Constrained = "CONSTRAINED",
  Blocked = "BLOCKED",
  Unavailable = "UNAVAILABLE",
}

export enum AllocationPortfolioState {
  Current = "CURRENT",
  Stale = "STALE",
  Unavailable = "UNAVAILABLE",
}

export enum AllocationSourceType {
  Portfolio = "PORTFOLIO",
  Risk = "RISK",
  MarketRegime = "MARKET_REGIME",
  EvidenceFusion = "EVIDENCE_FUSION",
  EventAnalyzer = "EVENT_ANALYZER",
  EarningsResearch = "EARNINGS_RESEARCH",
  CapitalRotation = "CAPITAL_ROTATION",
}

export enum AllocationSourceState {
  Accepted = "ACCEPTED",
  Limited = "LIMITED",
  Blocked = "BLOCKED",
  Unavailable = "UNAVAILABLE",
}

export enum CapitalAllocationAuthorizationStatus {
  FrameworkOnly = "FRAMEWORK_ONLY_NOT_EXECUTION_AUTHORITY",
}

export enum CapitalAllocationValidationIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidFrameworkVersion = "INVALID_FRAMEWORK_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidText = "INVALID_TEXT",
  InvalidPortfolio = "INVALID_PORTFOLIO",
  EvidenceGateBlocked = "EVIDENCE_GATE_BLOCKED",
  MarketRegimeRejected = "MARKET_REGIME_REJECTED",
  RiskGateBlocked = "RISK_GATE_BLOCKED",
  InvalidEvidenceReference = "INVALID_EVIDENCE_REFERENCE",
  InvalidCandidate = "INVALID_CANDIDATE",
  DuplicateCandidate = "DUPLICATE_CANDIDATE",
  DuplicateInstrument = "DUPLICATE_INSTRUMENT",
  CandidateEvidenceInsufficient = "CANDIDATE_EVIDENCE_INSUFFICIENT",
  CandidateRiskProhibited = "CANDIDATE_RISK_PROHIBITED",
  RankingNotSupported = "RANKING_NOT_SUPPORTED",
  InvalidWeight = "INVALID_WEIGHT",
  WeightLimitExceeded = "WEIGHT_LIMIT_EXCEEDED",
  InvalidCashRecommendation = "INVALID_CASH_RECOMMENDATION",
  InvalidAction = "INVALID_ACTION",
  InvalidExtension = "INVALID_EXTENSION",
  InvalidTrace = "INVALID_TRACE",
}

export interface AllocationEvidenceReference {
  readonly sourceType: AllocationSourceType;
  readonly recordId: string;
  readonly snapshotId?: string;
  readonly schemaVersion: string;
  readonly state: AllocationSourceState;
  readonly assessedAt: string;
  readonly fingerprint?: string;
  readonly policyVersion?: string;
  readonly ruleSetVersion?: string;
  readonly evidenceReferenceIds: readonly string[];
}

export interface AllocationWeight {
  /** Integer portfolio basis points. V1 validates but never calculates this value. */
  readonly basisPoints: number;
}

export interface AllocationCandidate {
  readonly candidateId: string;
  readonly canonicalInstrumentId: string;
  /** Display metadata only; never canonical identity or provider symbol authority. */
  readonly ticker: string;
  readonly assetType: AllocationAssetType;
  readonly category: AllocationCategory;
  readonly sector: string;
  readonly confidence: AllocationConfidence;
  readonly evidenceQuality: AllocationEvidenceQuality;
  readonly riskLevel: AllocationRiskLevel;
  readonly expectedHoldingPeriod: AllocationHoldingPeriod;
  readonly primaryCatalyst: string;
  readonly supportingEvidence: readonly AllocationEvidenceReference[];
  readonly recommendationReason: string;
  readonly suggestedWeight?: AllocationWeight;
  readonly priority: AllocationPriority.Unranked;
  readonly status: AllocationCandidateStatus;
}

export interface CapitalAllocationPortfolioInput {
  readonly snapshotId: string;
  readonly schemaVersion: string;
  readonly asOfTime: string;
  readonly state: AllocationPortfolioState;
  readonly evidenceReferenceIds: readonly string[];
}

export interface CapitalAllocationEvidenceFusionInput {
  readonly assessmentId: string;
  readonly snapshotId: string;
  readonly snapshotFingerprint: string;
  readonly status: EvidenceFusionAssessmentStatus;
  readonly completeness: EvidenceFusionCompleteness;
  readonly freshness: EvidenceFusionFreshness;
  readonly quality: EvidenceFusionQuality;
  readonly evaluatedAt: string;
  readonly schemaVersion: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly evidenceReferenceIds: readonly string[];
}

export interface CapitalAllocationMarketRegimeInput {
  readonly assessmentId: string;
  readonly schemaVersion: string;
  readonly assessedAt: string;
  readonly primaryRegime: MarketRegimePrimary;
  readonly evidenceStrength: MarketRegimeEvidenceStrength;
  readonly dataQualityStatus: MarketRegimeDataQualityStatus;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly evidenceReferenceIds: readonly string[];
}

export interface CapitalAllocationRiskInput {
  readonly assessmentId: string;
  readonly schemaVersion: string;
  readonly evaluatedAt: string;
  readonly status: AllocationRiskGateStatus;
  readonly riskLevel: AllocationRiskLevel;
  readonly policyVersion: string;
  readonly constraints: readonly string[];
  readonly evidenceReferenceIds: readonly string[];
}

export interface AllocationCashRecommendation {
  readonly action: AllocationCashAction;
  readonly reason: string;
  readonly suggestedWeight?: AllocationWeight;
}

export interface CapitalAllocationTraceReference {
  readonly correlationId: string;
  readonly traceId: string;
  readonly auditReferenceIds: readonly string[];
}

export interface CapitalAllocationRecommendationRequest {
  readonly schemaVersion: typeof CAPITAL_ALLOCATION_SCHEMA_VERSION;
  readonly frameworkVersion: typeof CAPITAL_ALLOCATION_FRAMEWORK_VERSION;
  readonly recommendationId: string;
  readonly timestamp: string;
  readonly createdAt: string;
  readonly portfolio: CapitalAllocationPortfolioInput;
  readonly evidenceFusion: CapitalAllocationEvidenceFusionInput;
  readonly marketRegime: CapitalAllocationMarketRegimeInput;
  readonly overallRisk: CapitalAllocationRiskInput;
  readonly recommendedAction: AllocationRecommendedAction;
  readonly topCandidates: readonly AllocationCandidate[];
  readonly avoidList: readonly AllocationCandidate[];
  readonly cashRecommendation: AllocationCashRecommendation;
  readonly notes: readonly string[];
  readonly extensionEvidence: readonly AllocationEvidenceReference[];
  readonly trace: CapitalAllocationTraceReference;
}

export interface AllocationRecommendation {
  readonly schemaVersion: typeof CAPITAL_ALLOCATION_SCHEMA_VERSION;
  readonly frameworkVersion: typeof CAPITAL_ALLOCATION_FRAMEWORK_VERSION;
  readonly recommendationId: string;
  readonly fingerprint: string;
  readonly timestamp: string;
  readonly createdAt: string;
  readonly portfolio: CapitalAllocationPortfolioInput;
  readonly evidenceFusion: CapitalAllocationEvidenceFusionInput;
  readonly marketRegime: CapitalAllocationMarketRegimeInput;
  readonly overallRisk: CapitalAllocationRiskInput;
  readonly recommendedAction: AllocationRecommendedAction;
  readonly topCandidates: readonly AllocationCandidate[];
  readonly avoidList: readonly AllocationCandidate[];
  readonly cashRecommendation: AllocationCashRecommendation;
  readonly notes: readonly string[];
  readonly extensionEvidence: readonly AllocationEvidenceReference[];
  readonly evidenceReferences: readonly string[];
  readonly trace: CapitalAllocationTraceReference;
  readonly authorizationStatus: CapitalAllocationAuthorizationStatus.FrameworkOnly;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface CapitalAllocationValidationIssue {
  readonly code: CapitalAllocationValidationIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface CapitalAllocationValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CapitalAllocationValidationIssue[];
}
