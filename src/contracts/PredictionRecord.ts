import type { ReasoningLevel } from "./AIRouter";
import type { ConfidenceLevel } from "./ResearchRecord";

export enum PredictionSubjectType {
  Market = "MARKET",
  Macro = "MACRO",
  Sector = "SECTOR",
  Company = "COMPANY",
  Etf = "ETF",
  Event = "EVENT",
}

export enum PredictionDirection {
  Up = "UP",
  Down = "DOWN",
  Neutral = "NEUTRAL",
  RangeBound = "RANGE_BOUND",
}

export enum PredictionCategory {
  Market = "MARKET",
  Macro = "MACRO",
  Sector = "SECTOR",
  Company = "COMPANY",
  Etf = "ETF",
  Event = "EVENT",
  Volatility = "VOLATILITY",
  Liquidity = "LIQUIDITY",
  Other = "OTHER",
}

export enum PredictionStatus {
  Draft = "DRAFT",
  Submitted = "SUBMITTED",
  Locked = "LOCKED",
  OutcomeKnown = "OUTCOME_KNOWN",
  Reviewed = "REVIEWED",
  Archived = "ARCHIVED",
}

export enum PredictionAccuracy {
  Accurate = "ACCURATE",
  PartiallyAccurate = "PARTIALLY_ACCURATE",
  Inaccurate = "INACCURATE",
  Indeterminate = "INDETERMINATE",
}

export enum PredictionProfitability {
  Profitable = "PROFITABLE",
  BreakEven = "BREAK_EVEN",
  Unprofitable = "UNPROFITABLE",
  NotApplicable = "NOT_APPLICABLE",
  Indeterminate = "INDETERMINATE",
}

export enum PredictionReviewResult {
  Validated = "VALIDATED",
  PartiallyValidated = "PARTIALLY_VALIDATED",
  Invalidated = "INVALIDATED",
  Inconclusive = "INCONCLUSIVE",
}

export enum PredictionReviewStatus {
  Started = "STARTED",
  Completed = "COMPLETED",
}

export enum PredictionExportFormat {
  Json = "JSON",
  Ndjson = "NDJSON",
  Csv = "CSV",
}

export enum PredictionErrorCode {
  InvalidPrediction = "INVALID_PREDICTION",
  DuplicatePredictionId = "DUPLICATE_PREDICTION_ID",
  PredictionNotFound = "PREDICTION_NOT_FOUND",
  InvalidLifecycle = "INVALID_LIFECYCLE",
  IllegalTransition = "ILLEGAL_TRANSITION",
  FutureTimestamp = "FUTURE_TIMESTAMP",
  UnlockedReview = "UNLOCKED_REVIEW",
  OutcomeMissing = "OUTCOME_MISSING",
  ReviewNotStarted = "REVIEW_NOT_STARTED",
  DuplicateOutcome = "DUPLICATE_OUTCOME",
  DuplicateReview = "DUPLICATE_REVIEW",
  RepositoryCorrupt = "REPOSITORY_CORRUPT",
}

export interface PredictionConfidence {
  readonly value: number;
  readonly level: ConfidenceLevel;
  readonly rationale: string;
}

export interface PredictionScenario {
  readonly name: string;
  readonly confidence: ConfidenceLevel;
  readonly expectedMove: string;
  readonly expectedDuration: string;
  readonly supportingEvidence: ReadonlyArray<string>;
  readonly failureConditions: ReadonlyArray<string>;
}

export interface PredictionVersionReference {
  readonly predictionVersion: string;
  readonly schemaVersion: "1.0";
}

export interface PredictionStrategyReference {
  readonly strategyId: string;
  readonly strategyVersion: string;
}

export interface PredictionResearchReference {
  readonly researchId: string;
  readonly researchVersion?: string;
}

export interface PredictionJournalReference {
  readonly journalId: string;
  readonly entryId?: string;
}

export interface PredictionAuditReference {
  readonly auditId: string;
  readonly traceId?: string;
}

export interface PredictionTradeReference {
  readonly tradeId: string;
}

export interface PredictionReviewReference {
  readonly reviewId: string;
}

export interface PredictionOpportunityScoreReference {
  readonly opportunityId: string;
  readonly score: number;
  readonly scoringPolicyVersion: string;
}

export interface PredictionRiskSnapshot {
  readonly riskAssessmentId: string;
  readonly riskPolicyVersion: string;
  readonly output: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PredictionRouterDecisionReference {
  readonly decisionId: string;
  readonly providerId?: string;
  readonly modelId?: string;
}

export interface PredictionEvidence {
  readonly supportingEvidence: ReadonlyArray<string>;
  readonly researchReferences: ReadonlyArray<PredictionResearchReference>;
  readonly journalReferences: ReadonlyArray<PredictionJournalReference>;
  readonly auditReferences: ReadonlyArray<PredictionAuditReference>;
  readonly strategyReferences: ReadonlyArray<PredictionStrategyReference>;
  readonly tradeReferences: ReadonlyArray<PredictionTradeReference>;
  readonly reviewReferences: ReadonlyArray<PredictionReviewReference>;
}

export interface PredictionDecisionSnapshot {
  readonly opportunityScore: PredictionOpportunityScoreReference;
  readonly risk: PredictionRiskSnapshot;
  readonly routerDecision: PredictionRouterDecisionReference;
  readonly selectedModelId: string;
  readonly configurationVersion: string;
  readonly policyVersion: string;
  readonly reasoningLevel: ReasoningLevel;
  readonly predictionTimestamp: string;
  readonly marketTimestamp: string;
}

export interface PredictionSnapshot {
  readonly createdAt: string;
  readonly predictionType: PredictionSubjectType;
  readonly market: string;
  readonly ticker?: string;
  readonly asset?: string;
  readonly category: PredictionCategory;
  readonly statement: string;
  readonly expectedDirection: PredictionDirection;
  readonly confidence: PredictionConfidence;
  readonly expectedTimeHorizon: string;
  readonly expectedCatalyst: string;
  readonly evidence: PredictionEvidence;
  readonly version: PredictionVersionReference;
  readonly strategy: PredictionStrategyReference;
  readonly decisionSnapshot: PredictionDecisionSnapshot;
  readonly owner: string;
  readonly aiVersion: string;
  readonly reviewRequired: boolean;
}

export interface PredictionHistory {
  readonly historyId: string;
  readonly predictionId: string;
  readonly sequence: number;
  readonly fromStatus: PredictionStatus | null;
  readonly toStatus: PredictionStatus;
  readonly occurredAt: string;
  readonly reason: string;
  readonly referenceId?: string;
}

export interface Prediction extends PredictionSnapshot {
  readonly predictionId: string;
  readonly lockedAt?: string;
  readonly status: PredictionStatus;
  readonly history: ReadonlyArray<PredictionHistory>;
}

/** Compatibility name retained for existing contract consumers. */
export type PredictionRecord = Prediction;

export interface PredictionOutcome {
  readonly outcomeId: string;
  readonly predictionId: string;
  readonly knownAt: string;
  readonly marketTimestamp: string;
  readonly actualDirection: PredictionDirection;
  readonly actualResult: string;
  readonly benchmarkResult?: string;
  readonly evidenceReferences: ReadonlyArray<PredictionAuditReference>;
}

export interface PredictionScore {
  readonly directionScore: number;
  readonly timingScore: number;
  readonly magnitudeScore: number;
  readonly catalystScore: number;
  readonly overallScore: number;
}

export interface PredictionReviewStart {
  readonly reviewId: string;
  readonly predictionId: string;
  readonly outcomeId: string;
  readonly startedAt: string;
  readonly reviewer: string;
  readonly status: PredictionReviewStatus.Started;
}

export interface PredictionReview {
  readonly reviewId: string;
  readonly predictionId: string;
  readonly outcomeId: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly reviewer: string;
  readonly status: PredictionReviewStatus.Completed;
  readonly accuracy: PredictionAccuracy;
  readonly profitability: PredictionProfitability;
  readonly result: PredictionReviewResult;
  readonly score: PredictionScore;
  readonly accuracyRationale: string;
  readonly profitabilityRationale: string;
  readonly lessonReferences: ReadonlyArray<string>;
}

export interface PredictionLifecycle {
  readonly initialStatus: PredictionStatus.Draft;
  readonly allowedTransitions: Readonly<
    Record<PredictionStatus, ReadonlyArray<PredictionStatus>>
  >;
}

export interface PredictionFilter {
  readonly statuses?: ReadonlyArray<PredictionStatus>;
  readonly categories?: ReadonlyArray<PredictionCategory>;
  readonly directions?: ReadonlyArray<PredictionDirection>;
  readonly markets?: ReadonlyArray<string>;
  readonly ticker?: string;
  readonly owner?: string;
  readonly strategyId?: string;
  readonly researchId?: string;
  readonly createdFrom?: string;
  readonly createdTo?: string;
  readonly reviewRequired?: boolean;
}

export interface PredictionQuery {
  readonly filter?: PredictionFilter;
  readonly offset?: number;
  readonly limit?: number;
}

export interface PredictionMetrics {
  readonly total: number;
  readonly reviewed: number;
  readonly accurate: number;
  readonly partiallyAccurate: number;
  readonly inaccurate: number;
  readonly accuracyRate?: number;
  readonly profitable: number;
  readonly breakEven: number;
  readonly unprofitable: number;
  readonly profitabilityRate?: number;
  readonly averageConfidence?: number;
  readonly averageScore?: number;
}

export interface PredictionStatistics {
  readonly generatedAt: string;
  readonly filter?: PredictionFilter;
  readonly metrics: PredictionMetrics;
  readonly byStatus: Readonly<Record<PredictionStatus, number>>;
  readonly byCategory: Readonly<Partial<Record<PredictionCategory, number>>>;
}

export interface PredictionSummary {
  readonly predictionId: string;
  readonly createdAt: string;
  readonly lockedAt?: string;
  readonly market: string;
  readonly ticker?: string;
  readonly statement: string;
  readonly expectedDirection: PredictionDirection;
  readonly confidence: number;
  readonly status: PredictionStatus;
  readonly outcomeKnown: boolean;
  readonly reviewed: boolean;
}

export interface PredictionValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<PredictionError>;
}

export interface PredictionError {
  readonly code: PredictionErrorCode;
  readonly message: string;
  readonly field?: string;
}

export interface PredictionTranslation {
  readonly contractVersion: "1.0";
  readonly translatedAt: string;
  readonly sourcePredictionId: string;
  readonly summary: PredictionSummary;
}

export interface PredictionExports {
  readonly format: PredictionExportFormat;
  readonly generatedAt: string;
  readonly recordCount: number;
  readonly content: string;
}

export const DEFAULT_PREDICTION_LIFECYCLE: PredictionLifecycle = {
  initialStatus: PredictionStatus.Draft,
  allowedTransitions: {
    [PredictionStatus.Draft]: [PredictionStatus.Submitted],
    [PredictionStatus.Submitted]: [PredictionStatus.Locked],
    [PredictionStatus.Locked]: [PredictionStatus.OutcomeKnown],
    [PredictionStatus.OutcomeKnown]: [PredictionStatus.Reviewed],
    [PredictionStatus.Reviewed]: [PredictionStatus.Archived],
    [PredictionStatus.Archived]: [],
  },
};
