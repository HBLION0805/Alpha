import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";
import type {
  PredictionAccuracy,
  PredictionProfitability,
} from "./PredictionRecord";

export enum AlphaJournalEntryType {
  MarketObservation = "MARKET_OBSERVATION",
  ResearchNote = "RESEARCH_NOTE",
  DecisionRationale = "DECISION_RATIONALE",
  PredictionNote = "PREDICTION_NOTE",
  PreTradePlan = "PRE_TRADE_PLAN",
  ExecutionObservation = "EXECUTION_OBSERVATION",
  PostTradeReview = "POST_TRADE_REVIEW",
  RiskObservation = "RISK_OBSERVATION",
  PortfolioReview = "PORTFOLIO_REVIEW",
  StrategyNote = "STRATEGY_NOTE",
  LessonLearned = "LESSON_LEARNED",
  SystemValidation = "SYSTEM_VALIDATION",
  DevelopmentNote = "DEVELOPMENT_NOTE",
  OwnerReflection = "OWNER_REFLECTION",
}

export enum AlphaJournalStatus {
  Draft = "DRAFT",
  Finalized = "FINALIZED",
  Reviewed = "REVIEWED",
  Archived = "ARCHIVED",
}

export enum AlphaJournalAuthorType {
  Owner = "OWNER",
  AlphaSubsystem = "ALPHA_SUBSYSTEM",
  System = "SYSTEM",
  ScheduledJob = "SCHEDULED_JOB",
}

export enum AlphaJournalReferenceType {
  Prediction = "PREDICTION",
  Research = "RESEARCH",
  Decision = "DECISION",
  Trade = "TRADE",
  Strategy = "STRATEGY",
  Portfolio = "PORTFOLIO",
  Audit = "AUDIT",
  Journal = "JOURNAL",
  DevelopmentValidation = "DEVELOPMENT_VALIDATION",
}

export enum AlphaJournalReferenceResolution {
  Resolved = "RESOLVED",
  Unresolved = "UNRESOLVED",
}

export enum AlphaJournalAmendmentType {
  FactualCorrection = "FACTUAL_CORRECTION",
  Clarification = "CLARIFICATION",
  AdditionalContext = "ADDITIONAL_CONTEXT",
  ChangedInterpretation = "CHANGED_INTERPRETATION",
  LaterOutcome = "LATER_OUTCOME",
  RetractedConclusion = "RETRACTED_CONCLUSION",
}

export enum AlphaJournalQuality {
  Excellent = "EXCELLENT",
  Good = "GOOD",
  Mixed = "MIXED",
  Poor = "POOR",
  NotAssessed = "NOT_ASSESSED",
}

export enum AlphaJournalAppendStatus {
  Appended = "APPENDED",
  Replayed = "REPLAYED",
}

export enum AlphaJournalErrorCategory {
  InvalidEntry = "INVALID_ENTRY",
  InvalidId = "INVALID_ID",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  FutureTimestamp = "FUTURE_TIMESTAMP",
  EmptyContent = "EMPTY_CONTENT",
  EntryNotFound = "ENTRY_NOT_FOUND",
  DuplicateId = "DUPLICATE_ID",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  InvalidLifecycle = "INVALID_LIFECYCLE",
  InvalidReference = "INVALID_REFERENCE",
  InvalidPrivacy = "INVALID_PRIVACY",
  ExportRestricted = "EXPORT_RESTRICTED",
  SensitiveExportUnauthorized = "SENSITIVE_EXPORT_UNAUTHORIZED",
  SecretMetadata = "SECRET_METADATA",
  RepositoryCorrupt = "REPOSITORY_CORRUPT",
  InvalidPath = "INVALID_PATH",
}

export enum AlphaJournalExportFormat {
  Json = "JSON",
  Ndjson = "NDJSON",
}

export enum AlphaJournalExportDestination {
  LocalSnapshot = "LOCAL_SNAPSHOT",
  ExternalTransfer = "EXTERNAL_TRANSFER",
}

export enum AlphaJournalExportStatus {
  Exported = "EXPORTED",
  Rejected = "REJECTED",
}

export enum AlphaJournalAuditOperationType {
  EntryFinalized = "ENTRY_FINALIZED",
  ReviewAppended = "REVIEW_APPENDED",
  AmendmentAppended = "AMENDMENT_APPENDED",
  EntryArchived = "ENTRY_ARCHIVED",
  Exported = "EXPORTED",
  ValidationRejected = "VALIDATION_REJECTED",
}

export interface AlphaJournalContent {
  readonly factualObservations: ReadonlyArray<string>;
  readonly interpretation: string;
  readonly assumptions: ReadonlyArray<string>;
  readonly uncertainty: string;
  readonly decisionRationale: string;
  readonly plannedAction: string;
  readonly actualActionReference?: string;
  readonly expectedOutcome: string;
  readonly riskNotes: ReadonlyArray<string>;
}

export interface AlphaJournalEvidenceReference {
  readonly referenceId: string;
  readonly recordType: AlphaJournalReferenceType;
  readonly resolution: AlphaJournalReferenceResolution;
  readonly version?: string;
}

export interface AlphaJournalPredictionReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Prediction;
}

export interface AlphaJournalResearchReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Research;
}

export interface AlphaJournalDecisionReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Decision;
}

export interface AlphaJournalTradeReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Trade;
}

export interface AlphaJournalStrategyReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Strategy;
}

export interface AlphaJournalPortfolioReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Portfolio;
}

export interface AlphaJournalAuditReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Audit;
}

export interface AlphaJournalEntryReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.Journal;
}

export interface AlphaJournalDevelopmentValidationReference
  extends AlphaJournalEvidenceReference {
  readonly recordType: AlphaJournalReferenceType.DevelopmentValidation;
}

export interface AlphaJournalEvidenceGraph {
  readonly predictions: ReadonlyArray<AlphaJournalPredictionReference>;
  readonly research: ReadonlyArray<AlphaJournalResearchReference>;
  readonly decisions: ReadonlyArray<AlphaJournalDecisionReference>;
  readonly trades: ReadonlyArray<AlphaJournalTradeReference>;
  readonly strategies: ReadonlyArray<AlphaJournalStrategyReference>;
  readonly portfolios: ReadonlyArray<AlphaJournalPortfolioReference>;
  readonly audits: ReadonlyArray<AlphaJournalAuditReference>;
  readonly journalEntries: ReadonlyArray<AlphaJournalEntryReference>;
  readonly developmentValidations: ReadonlyArray<AlphaJournalDevelopmentValidationReference>;
}

export interface AlphaJournalOpportunityScoreReference {
  readonly opportunityId: string;
  readonly score: number;
  readonly policyVersion: string;
}

export interface AlphaJournalRiskSnapshotReference {
  readonly riskAssessmentId: string;
  readonly policyVersion: string;
}

export interface AlphaJournalAIContributionReference {
  readonly routingDecisionId: string;
  readonly modelId: string;
}

export interface AlphaJournalContextSnapshot {
  readonly capturedAt: string;
  readonly marketTimestamp?: string;
  readonly portfolioSnapshot?: AlphaJournalPortfolioReference;
  readonly opportunityScore?: AlphaJournalOpportunityScoreReference;
  readonly riskSnapshot?: AlphaJournalRiskSnapshotReference;
  readonly prediction?: AlphaJournalPredictionReference;
  readonly configurationVersion?: string;
  readonly strategy?: AlphaJournalStrategyReference;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly aiContribution?: AlphaJournalAIContributionReference;
  readonly sourceDataTimestamps: Readonly<Record<string, string>>;
  readonly ownerDecisionState: string;
}

export interface AlphaJournalHistory {
  readonly historyId: string;
  readonly entryId: string;
  readonly lifecycleSequence: number;
  readonly fromStatus: AlphaJournalStatus;
  readonly toStatus: AlphaJournalStatus;
  readonly occurredAt: string;
  readonly reason: string;
  readonly referenceId?: string;
}

export interface AlphaJournalLifecycle {
  readonly authoritativeInitialStatus: AlphaJournalStatus.Finalized;
  readonly allowedTransitions: Readonly<
    Record<AlphaJournalStatus, ReadonlyArray<AlphaJournalStatus>>
  >;
}

export interface AlphaJournalEntrySnapshot {
  readonly schemaVersion: "1.0";
  readonly createdAt: string;
  readonly eventTimestamp: string;
  readonly entryType: AlphaJournalEntryType;
  readonly title: string;
  readonly content: AlphaJournalContent;
  readonly confidence?: number;
  readonly market?: string;
  readonly ticker?: string;
  readonly asset?: string;
  readonly tags: ReadonlyArray<string>;
  readonly ownerReference: string;
  readonly authorType: AlphaJournalAuthorType;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly evidence: AlphaJournalEvidenceGraph;
  readonly context: AlphaJournalContextSnapshot;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata: AIAuditMetadata;
}

export interface AlphaJournalEntry extends AlphaJournalEntrySnapshot {
  readonly entryId: string;
  readonly status: AlphaJournalStatus;
  readonly history: ReadonlyArray<AlphaJournalHistory>;
}

export interface AlphaJournalLesson {
  readonly lessonId: string;
  readonly statement: string;
  readonly tags: ReadonlyArray<string>;
  readonly futureRuleOrExperiment: string;
  readonly strategyChangeCandidate?: string;
}

export interface AlphaJournalPredictionAccuracyReference {
  readonly predictionId: string;
  readonly predictionReviewId: string;
  readonly accuracy: PredictionAccuracy;
}

export interface AlphaJournalTradingProfitabilityReference {
  readonly tradeId?: string;
  readonly predictionReviewId?: string;
  readonly profitability: PredictionProfitability;
}

export interface AlphaJournalReview {
  readonly reviewId: string;
  readonly entryId: string;
  readonly createdAt: string;
  readonly reviewer: string;
  readonly whatHappened: string;
  readonly whatWasExpected: string;
  readonly whatWasCorrect: string;
  readonly whatWasIncorrect: string;
  readonly controllableFactors: ReadonlyArray<string>;
  readonly uncontrollableFactors: ReadonlyArray<string>;
  readonly processQuality: AlphaJournalQuality;
  readonly outcomeQuality: AlphaJournalQuality;
  readonly predictionAccuracyReference?: AlphaJournalPredictionAccuracyReference;
  readonly tradingProfitabilityReference?: AlphaJournalTradingProfitabilityReference;
  readonly emotionalObservation: string;
  readonly lessons: ReadonlyArray<AlphaJournalLesson>;
  readonly futureRuleOrExperiment: string;
  readonly strategyChangeCandidate?: string;
  readonly auditReference: AlphaJournalAuditReference;
}

export interface AlphaJournalAmendment {
  readonly amendmentId: string;
  readonly entryId: string;
  readonly parentAmendmentId?: string;
  readonly createdAt: string;
  readonly amendmentType: AlphaJournalAmendmentType;
  readonly reason: string;
  readonly content: AlphaJournalContent;
  readonly authorReference: string;
  readonly evidenceReferences: ReadonlyArray<AlphaJournalEvidenceReference>;
  readonly auditReference: AlphaJournalAuditReference;
}

export interface AlphaJournalFilter {
  readonly fromEventTimestamp?: string;
  readonly toEventTimestamp?: string;
  readonly entryTypes?: ReadonlyArray<AlphaJournalEntryType>;
  readonly statuses?: ReadonlyArray<AlphaJournalStatus>;
  readonly ticker?: string;
  readonly asset?: string;
  readonly predictionId?: string;
  readonly researchId?: string;
  readonly tradeId?: string;
  readonly strategyId?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly privacyLevels?: ReadonlyArray<PrivacyLevel>;
}

export interface AlphaJournalQuery {
  readonly filter?: AlphaJournalFilter;
  readonly offset?: number;
  readonly limit?: number;
}

export interface AlphaJournalSummary {
  readonly entryId: string;
  readonly eventTimestamp: string;
  readonly entryType: AlphaJournalEntryType;
  readonly title: string;
  readonly status: AlphaJournalStatus;
  readonly market?: string;
  readonly ticker?: string;
  readonly asset?: string;
  readonly tags: ReadonlyArray<string>;
  readonly reviewed: boolean;
  readonly amendmentCount: number;
}

export interface AlphaJournalStatistics {
  readonly generatedAt: string;
  readonly totalEntries: number;
  readonly reviewedEntries: number;
  readonly unreviewedEntries: number;
  readonly predictionLinkedEntries: number;
  readonly strategyLinkedEntries: number;
  readonly byCategory: Readonly<Partial<Record<AlphaJournalEntryType, number>>>;
  readonly byDay: Readonly<Record<string, number>>;
  readonly byMonth: Readonly<Record<string, number>>;
  readonly byTickerOrAsset: Readonly<Record<string, number>>;
  readonly lessonsByTag: Readonly<Record<string, number>>;
  readonly processQualityDistribution: Readonly<Partial<Record<AlphaJournalQuality, number>>>;
}

export interface AlphaJournalEntryHistory {
  readonly entry: AlphaJournalEntry;
  readonly lifecycle: ReadonlyArray<AlphaJournalHistory>;
  readonly amendments: ReadonlyArray<AlphaJournalAmendment>;
  readonly reviews: ReadonlyArray<AlphaJournalReview>;
}

export interface AlphaJournalError {
  readonly category: AlphaJournalErrorCategory;
  readonly message: string;
  readonly field?: string;
}

export interface AlphaJournalValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<AlphaJournalError>;
}

export interface AlphaJournalAppendResult<T> {
  readonly status: AlphaJournalAppendStatus;
  readonly record: T;
  readonly repositorySequence: number;
}

export interface AlphaJournalExportRequest {
  readonly exportId: string;
  readonly requestedAt: string;
  readonly query: AlphaJournalQuery;
  readonly format: AlphaJournalExportFormat;
  readonly destination: AlphaJournalExportDestination;
  readonly sensitiveAuthorizationReference?: string;
}

export interface AlphaJournalExportResult {
  readonly status: AlphaJournalExportStatus;
  readonly exportId: string;
  readonly exportedAt: string;
  readonly format: AlphaJournalExportFormat;
  readonly recordCount: number;
  readonly content?: string;
  readonly error?: AlphaJournalError;
}

export interface AlphaJournalExportPolicy {
  readonly allowExternalExports: boolean;
  readonly requireSensitiveAuthorization: boolean;
  readonly sensitiveAuthorizationReferences: ReadonlyArray<string>;
}

export interface AlphaJournalAuditRecord {
  readonly auditId: string;
  readonly operationType: AlphaJournalAuditOperationType;
  readonly sourceRecordId: string;
  readonly entryId?: string;
  readonly timestamp: string;
  readonly status: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly correlationId: string;
  readonly traceId: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly metadata: AIAuditMetadata;
}

export interface AlphaJournalAuditTranslationContext {
  readonly idempotencyKey: string;
  readonly actor: AIAuditActor;
  readonly parentAuditRecordIds: ReadonlyArray<string>;
  readonly relatedAuditRecordIds: ReadonlyArray<string>;
}

export type AlphaJournalAuditTranslation = (
  source: Readonly<AlphaJournalAuditRecord>,
  context: Readonly<AlphaJournalAuditTranslationContext>,
) => AIAuditRecordInput;

export const DEFAULT_ALPHA_JOURNAL_LIFECYCLE: AlphaJournalLifecycle = {
  authoritativeInitialStatus: AlphaJournalStatus.Finalized,
  allowedTransitions: {
    [AlphaJournalStatus.Draft]: [AlphaJournalStatus.Finalized],
    [AlphaJournalStatus.Finalized]: [
      AlphaJournalStatus.Reviewed,
      AlphaJournalStatus.Archived,
    ],
    [AlphaJournalStatus.Reviewed]: [AlphaJournalStatus.Archived],
    [AlphaJournalStatus.Archived]: [],
  },
};
