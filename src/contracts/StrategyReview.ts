import type { EvidenceAssessment, EvidenceAssessmentStatus } from "./EvidenceEngine";
import type { EventReplayLifecycleStatus } from "./EventReplay";
import type { PredictionAccuracy, PredictionReviewStatus, PredictionStatus } from "./PredictionRecord";
import type { TradeStatus } from "./TradeRecord";

export const STRATEGY_REVIEW_SCHEMA_VERSION = "1.0" as const;

export enum StrategyReviewStatus {
  Complete = "COMPLETE",
  Incomplete = "INCOMPLETE",
  Blocked = "BLOCKED",
  Unavailable = "UNAVAILABLE",
}

export enum StrategyReviewSourceType {
  Prediction = "PREDICTION",
  PredictionOutcome = "PREDICTION_OUTCOME",
  PredictionReview = "PREDICTION_REVIEW",
  StrategyVersion = "STRATEGY_VERSION",
  FrozenPlan = "FROZEN_PLAN",
  Execution = "EXECUTION",
  TradeOutcome = "TRADE_OUTCOME",
  RiskAssessment = "RISK_ASSESSMENT",
  EventReplay = "EVENT_REPLAY",
  EvidenceAssessment = "EVIDENCE_ASSESSMENT",
}

export enum StrategyReviewSourceAvailability {
  Available = "AVAILABLE",
  Unavailable = "UNAVAILABLE",
}

export enum FrozenPlanReviewStatus {
  FrozenActive = "FROZEN_ACTIVE",
  ReleasedAfterCompletion = "RELEASED_AFTER_COMPLETION",
}

export enum OutcomeFinalizationStatus {
  Pending = "PENDING",
  Finalized = "FINALIZED",
  Unavailable = "UNAVAILABLE",
}

export enum ReplayReviewAvailability {
  Available = "AVAILABLE",
  ExplicitlyUnavailable = "EXPLICITLY_UNAVAILABLE",
  Unresolved = "UNRESOLVED",
}

export enum ReviewFindingStatus {
  Compliant = "COMPLIANT",
  Violation = "VIOLATION",
  Unknown = "UNKNOWN",
}

export enum ExecutionReviewCriterion {
  Entry = "ENTRY",
  PositionSizing = "POSITION_SIZING",
  StopLoss = "STOP_LOSS",
  TakeProfit = "TAKE_PROFIT",
  PartialExits = "PARTIAL_EXITS",
  MaximumHoldingPeriod = "MAXIMUM_HOLDING_PERIOD",
  Invalidation = "INVALIDATION",
  NoRiskIncreaseAfterEntry = "NO_RISK_INCREASE_AFTER_ENTRY",
  NoEmotionalPlanChange = "NO_EMOTIONAL_PLAN_CHANGE",
  ExceptionalRules = "EXCEPTIONAL_RULES",
  NoUnauthorizedReentry = "NO_UNAUTHORIZED_REENTRY",
}

export enum RiskReviewCriterion {
  PositionSize = "POSITION_SIZE",
  MaximumLoss = "MAXIMUM_LOSS",
  RiskBudget = "RISK_BUDGET",
  RiskEngineLimits = "RISK_ENGINE_LIMITS",
  FrozenPlanProtection = "FROZEN_PLAN_PROTECTION",
  NoUnauthorizedAveraging = "NO_UNAUTHORIZED_AVERAGING",
  NoAdditionalExposure = "NO_ADDITIONAL_EXPOSURE",
  NoProhibitedReentry = "NO_PROHIBITED_REENTRY",
  RiskVetoRespected = "RISK_VETO_RESPECTED",
  CapitalAllocation = "CAPITAL_ALLOCATION",
}

export enum PredictionQualityStatus {
  Correct = "CORRECT",
  Incorrect = "INCORRECT",
  PartiallyCorrect = "PARTIALLY_CORRECT",
  Indeterminate = "INDETERMINATE",
  Unavailable = "UNAVAILABLE",
}

export enum ExecutionQualityStatus {
  Compliant = "COMPLIANT",
  PartiallyCompliant = "PARTIALLY_COMPLIANT",
  NonCompliant = "NON_COMPLIANT",
  Indeterminate = "INDETERMINATE",
  Unavailable = "UNAVAILABLE",
}

export enum RiskDisciplineStatus {
  Compliant = "COMPLIANT",
  Violation = "VIOLATION",
  PartialOrUnknown = "PARTIAL_OR_UNKNOWN",
  Unavailable = "UNAVAILABLE",
}

export enum TradingProfitabilityStatus {
  Profit = "PROFIT",
  Loss = "LOSS",
  BreakEven = "BREAK_EVEN",
  Unavailable = "UNAVAILABLE",
}

export enum StrategyReviewBlockerCode {
  ActivePrediction = "ACTIVE_PREDICTION",
  PredictionReviewIncomplete = "PREDICTION_REVIEW_INCOMPLETE",
  ExecutionIncomplete = "EXECUTION_INCOMPLETE",
  OutcomeNotFinalized = "OUTCOME_NOT_FINALIZED",
  OutcomeUnavailable = "OUTCOME_UNAVAILABLE",
  FrozenPlanActive = "FROZEN_PLAN_ACTIVE",
  ReplayUnresolved = "REPLAY_UNRESOLVED",
  RequiredReplayUnavailable = "REQUIRED_REPLAY_UNAVAILABLE",
  EvidenceInsufficient = "EVIDENCE_INSUFFICIENT",
  EvidenceConflicting = "EVIDENCE_CONFLICTING",
  EvidenceUnavailable = "EVIDENCE_UNAVAILABLE",
  DimensionSourceUnavailable = "DIMENSION_SOURCE_UNAVAILABLE",
  RequiredExecutionFindingMissing = "REQUIRED_EXECUTION_FINDING_MISSING",
  RequiredExecutionFindingUnknown = "REQUIRED_EXECUTION_FINDING_UNKNOWN",
  RequiredRiskFindingMissing = "REQUIRED_RISK_FINDING_MISSING",
  RequiredRiskFindingUnknown = "REQUIRED_RISK_FINDING_UNKNOWN",
}

export enum StrategyReviewWarningCode {
  ReplayExplicitlyUnavailable = "REPLAY_EXPLICITLY_UNAVAILABLE",
  NonHardExecutionDeviation = "NON_HARD_EXECUTION_DEVIATION",
  ProfitableRiskViolation = "PROFITABLE_RISK_VIOLATION",
  CorrectPredictionWithLoss = "CORRECT_PREDICTION_WITH_LOSS",
  IncorrectPredictionWithProfit = "INCORRECT_PREDICTION_WITH_PROFIT",
  HumanReviewRequired = "HUMAN_REVIEW_REQUIRED",
}

export enum StrategyReviewErrorCode {
  MalformedRequest = "MALFORMED_REQUEST",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidPolicy = "INVALID_POLICY",
  InvalidSourceReference = "INVALID_SOURCE_REFERENCE",
  DuplicateSourceReference = "DUPLICATE_SOURCE_REFERENCE",
  MissingSourceReference = "MISSING_SOURCE_REFERENCE",
  InvalidFinding = "INVALID_FINDING",
  DuplicateFinding = "DUPLICATE_FINDING",
  InvalidEvidenceAssessment = "INVALID_EVIDENCE_ASSESSMENT",
  InvalidEconomicResult = "INVALID_ECONOMIC_RESULT",
}

export interface StrategyReviewSourceReference {
  readonly referenceId: string;
  readonly sourceType: StrategyReviewSourceType;
  readonly sourceId: string;
  readonly version: string;
  readonly status: string;
  readonly availability: StrategyReviewSourceAvailability;
  readonly auditReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewFinding<TCriterion extends string> {
  readonly findingId: string;
  readonly criterion: TCriterion;
  readonly status: ReviewFindingStatus;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export type ExecutionReviewFinding = StrategyReviewFinding<ExecutionReviewCriterion>;
export type RiskReviewFinding = StrategyReviewFinding<RiskReviewCriterion>;

export interface StrategyReviewPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly requireReplay: boolean;
  readonly requiredExecutionCriteria: ReadonlyArray<ExecutionReviewCriterion>;
  readonly hardExecutionCriteria: ReadonlyArray<ExecutionReviewCriterion>;
  readonly requiredRiskCriteria: ReadonlyArray<RiskReviewCriterion>;
}

export interface StrategyReviewPredictionEvidence {
  readonly predictionId: string;
  readonly predictionVersion: string;
  readonly status: PredictionStatus;
  readonly outcomeId: string;
  readonly reviewId: string;
  readonly reviewStatus: PredictionReviewStatus;
  readonly accuracy: PredictionAccuracy;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewStrategyReference {
  readonly versionId: string;
  readonly semanticVersion: string;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewFrozenPlanReference {
  readonly planId: string;
  readonly frozenAt: string;
  readonly status: FrozenPlanReviewStatus;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewExecutionEvidence {
  readonly tradeId: string;
  readonly tradeStatus: TradeStatus;
  readonly availability: StrategyReviewSourceAvailability;
  readonly findings: ReadonlyArray<ExecutionReviewFinding>;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewProfitabilityEvidence {
  readonly outcomeId: string;
  readonly finalizationStatus: OutcomeFinalizationStatus;
  readonly availability: StrategyReviewSourceAvailability;
  readonly realized: boolean;
  readonly grossResult?: number;
  readonly netResult?: number;
  readonly fees?: number;
  readonly slippage?: number;
  readonly returnPercentage?: number;
  readonly maximumCapitalEmployed?: number;
  readonly currency?: string;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewRiskEvidence {
  readonly riskAssessmentId: string;
  readonly riskPolicyVersion: string;
  readonly availability: StrategyReviewSourceAvailability;
  readonly findings: ReadonlyArray<RiskReviewFinding>;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewReplayReference {
  readonly availability: ReplayReviewAvailability;
  readonly sessionId?: string;
  readonly sessionVersion?: string;
  readonly status?: EventReplayLifecycleStatus;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewTraceMetadata {
  readonly correlationIds: ReadonlyArray<string>;
  readonly traceIds: ReadonlyArray<string>;
  readonly auditReferenceIds: ReadonlyArray<string>;
}

export interface StrategyReviewRequest {
  readonly schemaVersion: typeof STRATEGY_REVIEW_SCHEMA_VERSION;
  readonly reviewId: string;
  readonly evaluatedAt: string;
  readonly policy: StrategyReviewPolicy;
  readonly evidenceAssessment: EvidenceAssessment;
  readonly prediction: StrategyReviewPredictionEvidence;
  readonly strategyVersion: StrategyReviewStrategyReference;
  readonly frozenPlan: StrategyReviewFrozenPlanReference;
  readonly execution: StrategyReviewExecutionEvidence;
  readonly profitability: StrategyReviewProfitabilityEvidence;
  readonly risk: StrategyReviewRiskEvidence;
  readonly replay: StrategyReviewReplayReference;
  readonly sourceReferences: ReadonlyArray<StrategyReviewSourceReference>;
  readonly trace: StrategyReviewTraceMetadata;
}

export interface StrategyReviewIssue<TCode extends string> {
  readonly code: TCode;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly message: string;
}

export interface PredictionQualityReview {
  readonly status: PredictionQualityStatus;
  readonly sourceAccuracy: PredictionAccuracy;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface ExecutionQualityReview {
  readonly status: ExecutionQualityStatus;
  readonly findings: ReadonlyArray<ExecutionReviewFinding>;
  readonly compliantFindingIds: ReadonlyArray<string>;
  readonly violationFindingIds: ReadonlyArray<string>;
  readonly unknownFindingIds: ReadonlyArray<string>;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface RiskDisciplineReview {
  readonly status: RiskDisciplineStatus;
  readonly findings: ReadonlyArray<RiskReviewFinding>;
  readonly compliantFindingIds: ReadonlyArray<string>;
  readonly violationFindingIds: ReadonlyArray<string>;
  readonly unknownFindingIds: ReadonlyArray<string>;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface TradingProfitabilityReview {
  readonly status: TradingProfitabilityStatus;
  readonly realized: boolean;
  readonly grossResult?: number;
  readonly netResult?: number;
  readonly fees?: number;
  readonly slippage?: number;
  readonly returnPercentage?: number;
  readonly maximumCapitalEmployed?: number;
  readonly currency?: string;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface StrategyReviewEvidenceGate {
  readonly assessmentId: string;
  readonly schemaVersion: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly status: EvidenceAssessmentStatus;
  readonly blockerCodes: ReadonlyArray<string>;
  readonly unresolvedEvidenceItemIds: ReadonlyArray<string>;
  readonly conflictIds: ReadonlyArray<string>;
}

export interface StrategyReviewProtections {
  readonly authoritativeSourcesReadOnly: true;
  readonly activePlanMutationProhibited: true;
  readonly tradeReopeningProhibited: true;
  readonly executionInstructionsProhibited: true;
}

export interface StrategyReview {
  readonly schemaVersion: typeof STRATEGY_REVIEW_SCHEMA_VERSION;
  readonly reviewId: string;
  readonly evaluatedAt: string;
  readonly status: StrategyReviewStatus;
  readonly eligible: boolean;
  readonly policy: StrategyReviewPolicy;
  readonly evidenceGate: StrategyReviewEvidenceGate;
  readonly strategyVersion: StrategyReviewStrategyReference;
  readonly predictionQuality: PredictionQualityReview;
  readonly executionQuality: ExecutionQualityReview;
  readonly riskDiscipline: RiskDisciplineReview;
  readonly tradingProfitability: TradingProfitabilityReview;
  readonly blockers: ReadonlyArray<StrategyReviewIssue<StrategyReviewBlockerCode>>;
  readonly warnings: ReadonlyArray<StrategyReviewIssue<StrategyReviewWarningCode>>;
  readonly unresolvedSourceReferenceIds: ReadonlyArray<string>;
  readonly sourceReferences: ReadonlyArray<StrategyReviewSourceReference>;
  readonly trace: StrategyReviewTraceMetadata;
  readonly humanReviewRequired: true;
  readonly protections: StrategyReviewProtections;
  readonly deterministic: true;
  readonly readOnly: true;
}
