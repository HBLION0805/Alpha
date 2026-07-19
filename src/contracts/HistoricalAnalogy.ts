import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";
import type {
  HistoricalAssetClass,
  HistoricalEventStatus,
  HistoricalPatternStatus,
  HistoricalRegimeType,
  HistoricalTimeHorizon,
} from "./HistoricalPattern";

export type HistoricalAnalogyRequestId = string;
export type HistoricalAnalogyId = string;
export type CurrentSituationSnapshotId = string;
export type AnalogyWeightProfileId = string;

export enum HistoricalAnalogyStatus {
  Proposed = "PROPOSED",
  Validating = "VALIDATING",
  Completed = "COMPLETED",
  Reviewed = "REVIEWED",
  Superseded = "SUPERSEDED",
  Archived = "ARCHIVED",
  Rejected = "REJECTED",
}

export enum HistoricalCandidateType { Event = "EVENT", Pattern = "PATTERN" }
export enum AnalogyDimensionType {
  EventType = "EVENT_TYPE", MonetaryPolicy = "MONETARY_POLICY", Inflation = "INFLATION",
  Growth = "GROWTH", Liquidity = "LIQUIDITY", Credit = "CREDIT", Volatility = "VOLATILITY",
  Valuation = "VALUATION", FiscalPolicy = "FISCAL_POLICY", Currency = "CURRENCY",
  Commodity = "COMMODITY", Geopolitics = "GEOPOLITICS", MarketConcentration = "MARKET_CONCENTRATION",
  InvestorPositioning = "INVESTOR_POSITIONING", Catalyst = "CATALYST", MarketStructure = "MARKET_STRUCTURE",
  AssetReaction = "ASSET_REACTION", TimeHorizon = "TIME_HORIZON", Geography = "GEOGRAPHY",
  PolicyResponse = "POLICY_RESPONSE", Other = "OTHER",
}
export enum AnalogyDimensionValueType { Category = "CATEGORY", Number = "NUMBER", Boolean = "BOOLEAN", Set = "SET", Text = "TEXT" }
export enum AnalogyComparisonMethod { Exact = "EXACT", NumericDistance = "NUMERIC_DISTANCE", SetOverlap = "SET_OVERLAP", Ordinal = "ORDINAL" }
export enum AnalogyMissingDataPolicy { FailClosed = "FAIL_CLOSED", ExcludeDimension = "EXCLUDE_DIMENSION", PenalizeScore = "PENALIZE_SCORE", RequireReview = "REQUIRE_REVIEW", IncompleteResult = "INCOMPLETE_RESULT" }
export enum AnalogyNormalizationPolicy { SumToScale = "SUM_TO_SCALE", EligibleWeight = "ELIGIBLE_WEIGHT" }
export enum AnalogyWeightProfileStatus { Proposed = "PROPOSED", Active = "ACTIVE", Retired = "RETIRED", Rejected = "REJECTED" }
export enum AnalogyScoreMethod { WeightedDimensionV1 = "WEIGHTED_DIMENSION_V1" }
export enum AnalogyQualityClassification { High = "HIGH", Moderate = "MODERATE", Low = "LOW", Insufficient = "INSUFFICIENT", Invalid = "INVALID" }
export enum AnalogyConfidenceLevel { High = "HIGH", Moderate = "MODERATE", Low = "LOW", Insufficient = "INSUFFICIENT" }
export enum AnalogyMissingDataState { Present = "PRESENT", MissingCurrent = "MISSING_CURRENT", MissingHistorical = "MISSING_HISTORICAL", MissingBoth = "MISSING_BOTH" }
export enum AnalogyExclusionReason { ProfileExcluded = "PROFILE_EXCLUDED", MissingData = "MISSING_DATA", InsufficientEvidence = "INSUFFICIENT_EVIDENCE", InvalidCandidate = "INVALID_CANDIDATE" }
export enum AnalogyBiasRiskType {
  Hindsight = "HINDSIGHT_BIAS", Survivorship = "SURVIVORSHIP_BIAS", Selection = "SELECTION_BIAS",
  Confirmation = "CONFIRMATION_BIAS", RegimeMismatch = "REGIME_MISMATCH", PolicyResponseMismatch = "POLICY_RESPONSE_MISMATCH",
  GeographyMismatch = "GEOGRAPHY_MISMATCH", MarketStructureMismatch = "MARKET_STRUCTURE_MISMATCH",
  DataQualityWeakness = "DATA_QUALITY_WEAKNESS", MissingData = "MISSING_DATA_BIAS",
  SmallSupportingEventCount = "SMALL_SUPPORTING_EVENT_COUNT", OverlappingCandidateEvents = "OVERLAPPING_CANDIDATE_EVENTS",
  OutcomeCherryPicking = "OUTCOME_CHERRY_PICKING", CausalityOverstatement = "CAUSALITY_OVERSTATEMENT",
}
export enum AnalogyRiskSeverity { Low = "LOW", Medium = "MEDIUM", High = "HIGH", Critical = "CRITICAL" }
export enum AnalogyReviewDecision { Useful = "USEFUL", Limited = "LIMITED", Rejected = "REJECTED" }
export enum AnalogyAppendStatus { Appended = "APPENDED", Replayed = "REPLAYED" }
export enum HistoricalAnalogyExportFormat { Json = "JSON", Ndjson = "NDJSON" }
export enum HistoricalAnalogyExportDestination { LocalSnapshot = "LOCAL_SNAPSHOT", ExternalTransfer = "EXTERNAL_TRANSFER" }
export enum HistoricalAnalogyExportStatus { Exported = "EXPORTED", Rejected = "REJECTED" }
export enum HistoricalAnalogyAuditOperationType {
  RequestCreated = "HISTORICAL_ANALOGY_REQUEST_CREATED", SnapshotFrozen = "HISTORICAL_ANALOGY_SNAPSHOT_FROZEN",
  WeightProfileProposed = "HISTORICAL_ANALOGY_WEIGHT_PROFILE_PROPOSED", WeightProfileApproved = "HISTORICAL_ANALOGY_WEIGHT_PROFILE_APPROVED",
  WeightProfileRejected = "HISTORICAL_ANALOGY_WEIGHT_PROFILE_REJECTED", AnalogyCompleted = "HISTORICAL_ANALOGY_COMPLETED",
  AnalogyReviewed = "HISTORICAL_ANALOGY_REVIEWED", AnalogyAmended = "HISTORICAL_ANALOGY_AMENDED",
  AnalogySuperseded = "HISTORICAL_ANALOGY_SUPERSEDED", AnalogyArchived = "HISTORICAL_ANALOGY_ARCHIVED",
  ExportGenerated = "HISTORICAL_ANALOGY_EXPORT_GENERATED", ValidationRejected = "HISTORICAL_ANALOGY_VALIDATION_REJECTED",
}
export enum HistoricalAnalogyErrorCategory {
  InvalidRecord = "INVALID_RECORD", InvalidId = "INVALID_ID", InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidCandidate = "INVALID_CANDIDATE", MissingEvidence = "MISSING_EVIDENCE", InvalidWeightProfile = "INVALID_WEIGHT_PROFILE",
  InvalidWeight = "INVALID_WEIGHT", InvalidNormalization = "INVALID_NORMALIZATION", DuplicateDimension = "DUPLICATE_DIMENSION",
  MissingData = "MISSING_DATA", ZeroDenominator = "ZERO_DENOMINATOR", InvalidScore = "INVALID_SCORE",
  InvalidLifecycle = "INVALID_LIFECYCLE", InvalidReference = "INVALID_REFERENCE", InvalidPrivacy = "INVALID_PRIVACY",
  RecordNotFound = "RECORD_NOT_FOUND", DuplicateId = "DUPLICATE_ID", IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  ExportRestricted = "EXPORT_RESTRICTED", SensitiveExportUnauthorized = "SENSITIVE_EXPORT_UNAUTHORIZED",
  SecretMetadata = "SECRET_METADATA", RepositoryCorrupt = "REPOSITORY_CORRUPT", InvalidPath = "INVALID_PATH",
  InvalidPagination = "INVALID_PAGINATION", ProhibitedConclusion = "PROHIBITED_CONCLUSION", OwnerApprovalRequired = "OWNER_APPROVAL_REQUIRED",
}

export interface AnalogyDimensionValue {
  readonly valueType: AnalogyDimensionValueType;
  readonly normalizedValue?: string;
  readonly numericValue?: number;
  readonly booleanValue?: boolean;
  readonly setValues?: ReadonlyArray<string>;
  readonly unit?: string;
  readonly missing: boolean;
}

export interface CurrentSituationFeature {
  readonly featureId: string;
  readonly dimension: AnalogyDimensionType;
  readonly value: AnalogyDimensionValue;
  readonly observedAt?: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly confidence: number;
  readonly disputed: boolean;
}

export interface CurrentSituationRegime {
  readonly regimeId: string;
  readonly dimensions: ReadonlyArray<CurrentSituationFeature>;
  readonly summary: string;
}

export interface AnalogySourceReference {
  readonly referenceId: string;
  readonly referenceType: string;
  readonly version?: string;
  readonly resolved: boolean;
  readonly summary?: string;
}

export interface CurrentSituationSnapshot {
  readonly snapshotId: CurrentSituationSnapshotId;
  readonly schemaVersion: "1.0";
  readonly snapshotVersion: string;
  readonly asOfTimestamp: string;
  readonly marketDataTimestampReferences: ReadonlyArray<string>;
  readonly geography: ReadonlyArray<string>;
  readonly markets: ReadonlyArray<string>;
  readonly assetClasses: ReadonlyArray<HistoricalAssetClass>;
  readonly eventCategories: ReadonlyArray<string>;
  readonly factualObservations: ReadonlyArray<string>;
  readonly quantitativeObservations: ReadonlyArray<string>;
  readonly regime: CurrentSituationRegime;
  readonly macroContext: ReadonlyArray<string>;
  readonly monetaryPolicyContext: ReadonlyArray<string>;
  readonly fiscalPolicyContext: ReadonlyArray<string>;
  readonly inflationContext: ReadonlyArray<string>;
  readonly growthContext: ReadonlyArray<string>;
  readonly liquidityContext: ReadonlyArray<string>;
  readonly creditContext: ReadonlyArray<string>;
  readonly volatilityContext: ReadonlyArray<string>;
  readonly valuationContext: ReadonlyArray<string>;
  readonly currencyContext: ReadonlyArray<string>;
  readonly commodityContext: ReadonlyArray<string>;
  readonly marketConcentration: ReadonlyArray<string>;
  readonly positioning: ReadonlyArray<string>;
  readonly catalysts: ReadonlyArray<string>;
  readonly knownRisks: ReadonlyArray<string>;
  readonly uncertainties: ReadonlyArray<string>;
  readonly disputedInterpretations: ReadonlyArray<string>;
  readonly missingDimensions: ReadonlyArray<AnalogyDimensionType>;
  readonly researchReferences: ReadonlyArray<AnalogyResearchReference>;
  readonly sourceReferences: ReadonlyArray<AnalogySourceReference>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata: AIAuditMetadata;
}

export interface HistoricalCandidateReference {
  readonly candidateType: HistoricalCandidateType;
  readonly recordId: string;
  readonly recordVersion: string;
  readonly lifecycleStatus: HistoricalEventStatus | HistoricalPatternStatus;
  readonly title: string;
  readonly summary: string;
  readonly applicablePeriod?: string;
  readonly regimeSummary?: string;
  readonly dimensionValues: ReadonlyArray<{ readonly dimension: AnalogyDimensionType; readonly value: AnalogyDimensionValue; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly confidence: number }>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly sourceCount: number;
  readonly supportingEventCount: number;
  readonly limitations: ReadonlyArray<string>;
  readonly superseded: boolean;
  readonly historicalOutcomeEvidence: ReadonlyArray<AnalogyOutcomeEvidence>;
  readonly qualityScore: number;
}

export interface AnalogyWeight {
  readonly dimension: AnalogyDimensionType;
  readonly weight: number;
  readonly comparisonMethod: AnalogyComparisonMethod;
}

export interface AnalogyWeightProfile {
  readonly profileId: AnalogyWeightProfileId;
  readonly schemaVersion: "1.0";
  readonly version: string;
  readonly title: string;
  readonly purpose: string;
  readonly applicableComparisonType: string;
  readonly weights: ReadonlyArray<AnalogyWeight>;
  readonly requiredDimensions: ReadonlyArray<AnalogyDimensionType>;
  readonly optionalDimensions: ReadonlyArray<AnalogyDimensionType>;
  readonly excludedDimensions: ReadonlyArray<AnalogyDimensionType>;
  readonly missingDataPolicy: AnalogyMissingDataPolicy;
  readonly normalizationPolicy: AnalogyNormalizationPolicy;
  readonly normalizationScale: 10000;
  readonly minimumEvidenceReferences: number;
  readonly minimumCandidateQuality: number;
  readonly highQualityThreshold: number;
  readonly moderateQualityThreshold: number;
  readonly ownerApprovalReference?: string;
  readonly ownerApproverActorType?: "OWNER";
  readonly status: AnalogyWeightProfileStatus;
  readonly effectiveAt?: string;
  readonly retiredAt?: string;
  readonly policyVersion: string;
  readonly fingerprint: string;
}

export interface HistoricalAnalogyRequest {
  readonly requestId: HistoricalAnalogyRequestId;
  readonly schemaVersion: "1.0";
  readonly requestVersion: string;
  readonly createdAt: string;
  readonly currentSnapshotId: CurrentSituationSnapshotId;
  readonly candidateReferences: ReadonlyArray<HistoricalCandidateReference>;
  readonly weightProfileId: AnalogyWeightProfileId;
  readonly weightProfileVersion: string;
  readonly maximumResultCount: number;
  readonly requireCurrentCandidates: boolean;
  readonly researchReference?: AnalogyResearchReference;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata: AIAuditMetadata;
}

export interface AnalogySimilarityEvidence { readonly evidenceId: string; readonly dimension: AnalogyDimensionType; readonly statementCode: string; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly contribution: number; }
export interface AnalogyDifferenceEvidence { readonly evidenceId: string; readonly dimension: AnalogyDimensionType; readonly statementCode: string; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly contribution: number; readonly severity: AnalogyRiskSeverity; }
export interface AnalogyMissingData { readonly dimension: AnalogyDimensionType; readonly state: AnalogyMissingDataState; readonly required: boolean; readonly policyApplied: AnalogyMissingDataPolicy; readonly weight: number; }
export interface AnalogyExclusion { readonly dimension?: AnalogyDimensionType; readonly reason: AnalogyExclusionReason; readonly reasonCode: string; }
export interface AnalogyScoreComponent { readonly dimension: AnalogyDimensionType; readonly weight: number; readonly similarityBasisPoints: number; readonly differenceBasisPoints: number; readonly similarityPoints: number; readonly differencePoints: number; }
export interface AnalogyScore {
  readonly scale: 10000;
  readonly totalEligibleWeight: number;
  readonly comparedWeight: number;
  readonly missingWeight: number;
  readonly similarityPoints: number;
  readonly differencePoints: number;
  readonly normalizedSimilarityScore: number;
  readonly normalizedDifferenceScore: number;
  readonly completenessScore: number;
  readonly evidenceQualityScore: number;
  readonly candidateQualityScore: number;
  readonly components: ReadonlyArray<AnalogyScoreComponent>;
}
export interface AnalogyConfidence { readonly score: number; readonly level: AnalogyConfidenceLevel; readonly policyVersion: string; readonly reasonCodes: ReadonlyArray<string>; }
export interface AnalogyQualityAssessment { readonly classification: AnalogyQualityClassification; readonly eligibleForRanking: boolean; readonly reviewRequired: boolean; readonly reasonCodes: ReadonlyArray<string>; }
export interface AnalogyDimensionResult {
  readonly dimension: AnalogyDimensionType;
  readonly currentValue?: AnalogyDimensionValue;
  readonly historicalValue?: AnalogyDimensionValue;
  readonly comparisonMethod: AnalogyComparisonMethod;
  readonly weight: number;
  readonly similarityContribution: number;
  readonly differenceContribution: number;
  readonly confidence: number;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly missingDataState: AnalogyMissingDataState;
  readonly excluded: boolean;
  readonly explanationCode: string;
  readonly limitations: ReadonlyArray<string>;
}
export interface AnalogyOutcomeEvidence { readonly outcomeId: string; readonly observation: string; readonly horizon?: HistoricalTimeHorizon; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly explicitlyNotForecast: true; }
export interface AnalogyLimitation { readonly limitationId: string; readonly statement: string; readonly material: boolean; readonly dimension?: AnalogyDimensionType; }
export interface AnalogyBiasRisk { readonly riskId: string; readonly riskType: AnalogyBiasRiskType; readonly severity: AnalogyRiskSeverity; readonly statement: string; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly requiresReview: boolean; }
export interface AnalogyInvalidationCondition { readonly conditionId: string; readonly statement: string; readonly evidenceRequired: ReadonlyArray<string>; }
export interface AnalogyResearchReference { readonly researchId: string; readonly researchVersion: string; readonly frozenStatus: string; readonly summary?: string; }
export interface AnalogyHistoricalEventReference { readonly eventId: string; readonly eventVersion: string; readonly frozenStatus: HistoricalEventStatus; readonly limitations: ReadonlyArray<string>; }
export interface AnalogyHistoricalPatternReference { readonly patternId: string; readonly patternVersion: string; readonly frozenStatus: HistoricalPatternStatus; readonly supportingEventCount: number; readonly limitations: ReadonlyArray<string>; }
export interface AnalogyJournalReference { readonly journalId: string; readonly journalVersion: string; readonly frozenStatus: string; }
export interface AnalogyPredictionReference { readonly predictionId: string; readonly predictionVersion: string; readonly frozenStatus: string; readonly analogyScoreMethod: AnalogyScoreMethod; readonly weightProfileId: string; readonly weightProfileVersion: string; readonly limitationIds: ReadonlyArray<string>; }
export interface AnalogyStrategyReference { readonly strategyId: string; readonly strategyVersion: string; readonly frozenStatus: string; readonly limitationIds: ReadonlyArray<string>; readonly regimeDifferenceIds: ReadonlyArray<string>; }
export interface AnalogyAuditReference { readonly auditId: string; readonly auditVersion: string; }
export interface AnalogyReplayCompatibilityReference { readonly replayId: string; readonly replayVersion: string; readonly observationWindowReference: string; readonly priceTimelineReference?: string; readonly eventTimelineReference?: string; readonly executionContextReference?: string; readonly replayQualityStatus: string; }
export interface HistoricalAnalogyLifecycle { readonly historyId: string; readonly analogyId: HistoricalAnalogyId; readonly lifecycleSequence: number; readonly fromStatus: HistoricalAnalogyStatus; readonly toStatus: HistoricalAnalogyStatus; readonly occurredAt: string; readonly reason: string; readonly referenceId?: string; }

export interface HistoricalAnalogyRecord {
  readonly analogyId: HistoricalAnalogyId;
  readonly schemaVersion: "1.0";
  readonly recordVersion: string;
  readonly requestId: HistoricalAnalogyRequestId;
  readonly currentSnapshotReference: { readonly snapshotId: string; readonly snapshotVersion: string; readonly asOfTimestamp: string };
  readonly candidateReference: HistoricalCandidateReference;
  readonly weightProfileReference: { readonly profileId: string; readonly profileVersion: string; readonly fingerprint: string };
  readonly scoringMethod: AnalogyScoreMethod;
  readonly scoringMethodVersion: "1.0";
  readonly comparisonTimestamp: string;
  readonly dimensionResults: ReadonlyArray<AnalogyDimensionResult>;
  readonly strongestSimilarities: ReadonlyArray<AnalogySimilarityEvidence>;
  readonly strongestDifferences: ReadonlyArray<AnalogyDifferenceEvidence>;
  readonly missingDimensions: ReadonlyArray<AnalogyMissingData>;
  readonly exclusions: ReadonlyArray<AnalogyExclusion>;
  readonly score: AnalogyScore;
  readonly confidence: AnalogyConfidence;
  readonly quality: AnalogyQualityAssessment;
  readonly historicalOutcomeEvidence: ReadonlyArray<AnalogyOutcomeEvidence>;
  readonly regimeDifferences: ReadonlyArray<AnalogyDifferenceEvidence>;
  readonly limitations: ReadonlyArray<AnalogyLimitation>;
  readonly biasRisks: ReadonlyArray<AnalogyBiasRisk>;
  readonly invalidationConditions: ReadonlyArray<AnalogyInvalidationCondition>;
  readonly sourceReferences: ReadonlyArray<AnalogySourceReference>;
  readonly researchReference?: AnalogyResearchReference;
  readonly journalReferences: ReadonlyArray<AnalogyJournalReference>;
  readonly predictionReferences: ReadonlyArray<AnalogyPredictionReference>;
  readonly strategyReferences: ReadonlyArray<AnalogyStrategyReference>;
  readonly auditReference?: AnalogyAuditReference;
  readonly replayCompatibilityReferences: ReadonlyArray<AnalogyReplayCompatibilityReference>;
  readonly reviewRequired: boolean;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly correlationId: string;
  readonly traceId: string;
  readonly status: HistoricalAnalogyStatus;
  readonly history: ReadonlyArray<HistoricalAnalogyLifecycle>;
  readonly metadata: AIAuditMetadata;
}

export interface AnalogyReview { readonly reviewId: string; readonly analogyId: string; readonly createdAt: string; readonly reviewer: string; readonly reviewerActorType: "OWNER" | "RESEARCHER"; readonly decision: AnalogyReviewDecision; readonly rationale: string; readonly acceptedSimilarityIds: ReadonlyArray<string>; readonly acceptedDifferenceIds: ReadonlyArray<string>; readonly unresolvedQuestionIds: ReadonlyArray<string>; readonly auditReference?: AnalogyAuditReference; }
export interface AnalogyAmendment { readonly amendmentId: string; readonly analogyId: string; readonly parentAmendmentId?: string; readonly createdAt: string; readonly reason: string; readonly changedInterpretationFields: ReadonlyArray<string>; readonly addedLimitations: ReadonlyArray<AnalogyLimitation>; readonly authorReference: string; readonly auditReference?: AnalogyAuditReference; }
export interface AnalogySupersession { readonly supersessionId: string; readonly priorAnalogyId: string; readonly successorAnalogyId: string; readonly createdAt: string; readonly reason: string; readonly changedSnapshot: boolean; readonly changedCandidateVersion: boolean; readonly changedWeightProfile: boolean; readonly changedScoringMethod: boolean; readonly ownerReference: string; readonly auditReference?: AnalogyAuditReference; }
export interface AnalogyHistory { readonly record: HistoricalAnalogyRecord; readonly lifecycle: ReadonlyArray<HistoricalAnalogyLifecycle>; readonly reviews: ReadonlyArray<AnalogyReview>; readonly amendments: ReadonlyArray<AnalogyAmendment>; readonly supersessions: ReadonlyArray<AnalogySupersession>; }

export interface AnalogyFilter {
  readonly currentSnapshotId?: string;
  readonly historicalEventId?: string;
  readonly historicalPatternId?: string;
  readonly weightProfileId?: string;
  readonly researchId?: string;
  readonly statuses?: ReadonlyArray<HistoricalAnalogyStatus>;
  readonly qualityClassifications?: ReadonlyArray<AnalogyQualityClassification>;
  readonly minimumSimilarityScore?: number;
  readonly maximumSimilarityScore?: number;
  readonly minimumCompletenessScore?: number;
  readonly maximumCompletenessScore?: number;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly currentOnly?: boolean;
}
export interface AnalogyQuery { readonly filter?: AnalogyFilter; readonly offset?: number; readonly limit?: number; }
export interface AnalogySummary { readonly analogyId: string; readonly requestId: string; readonly currentSnapshotId: string; readonly candidateType: HistoricalCandidateType; readonly candidateId: string; readonly status: HistoricalAnalogyStatus; readonly quality: AnalogyQualityClassification; readonly similarityScore: number; readonly completenessScore: number; readonly evidenceQualityScore: number; readonly reviewRequired: boolean; readonly limitations: ReadonlyArray<string>; }
export interface AnalogyStatistics {
  readonly generatedAt: string;
  readonly requestCount: number;
  readonly comparisonCount: number;
  readonly requestsByStatus: Readonly<Record<string, number>>;
  readonly comparisonsByCandidateType: Readonly<Record<string, number>>;
  readonly comparisonsByHistoricalEvent: Readonly<Record<string, number>>;
  readonly comparisonsByHistoricalPattern: Readonly<Record<string, number>>;
  readonly resultsByQuality: Readonly<Record<string, number>>;
  readonly resultsBySimilarityRange: Readonly<Record<string, number>>;
  readonly resultsByCompletenessRange: Readonly<Record<string, number>>;
  readonly missingDimensionsByType: Readonly<Record<string, number>>;
  readonly excludedDimensionsByType: Readonly<Record<string, number>>;
  readonly weightProfilesByStatus: Readonly<Record<string, number>>;
  readonly reviewedCount: number;
  readonly unreviewedCount: number;
  readonly supersededCount: number;
  readonly currentCount: number;
  readonly researchLinkedCount: number;
  readonly predictionLinkedCount: number;
  readonly criticalBiasRiskCount: number;
  readonly averageSimilarityScore?: number;
  readonly averageCompletenessScore?: number;
  readonly sampleSize: number;
}

export interface HistoricalAnalogyError { readonly category: HistoricalAnalogyErrorCategory; readonly message: string; readonly field?: string; }
export interface HistoricalAnalogyValidation { readonly valid: boolean; readonly errors: ReadonlyArray<HistoricalAnalogyError>; }
export interface HistoricalAnalogyAppendResult<T> { readonly status: AnalogyAppendStatus; readonly record: T; readonly repositorySequence: number; }
export interface HistoricalAnalogyExportRequest { readonly exportId: string; readonly requestedAt: string; readonly query: AnalogyQuery; readonly format: HistoricalAnalogyExportFormat; readonly destination: HistoricalAnalogyExportDestination; readonly sensitiveAuthorizationReference?: string; }
export interface HistoricalAnalogyExportPolicy { readonly allowExternalExports: boolean; readonly requireSensitiveAuthorization: boolean; readonly sensitiveAuthorizationReferences: ReadonlyArray<string>; }
export interface HistoricalAnalogyExportResult { readonly status: HistoricalAnalogyExportStatus; readonly exportId: string; readonly exportedAt: string; readonly format: HistoricalAnalogyExportFormat; readonly recordCount: number; readonly content?: string; readonly error?: HistoricalAnalogyError; }

export interface HistoricalAnalogyAuditRecord { readonly auditId: string; readonly operationType: HistoricalAnalogyAuditOperationType; readonly sourceRecordId: string; readonly recordVersion?: string; readonly timestamp: string; readonly status: string; readonly reasonCodes: ReadonlyArray<string>; readonly requestId?: string; readonly snapshotId?: string; readonly candidateId?: string; readonly profileId?: string; readonly profileVersion?: string; readonly scoringMethodVersion?: string; readonly score?: AnalogyScore; readonly limitations: ReadonlyArray<string>; readonly privacyLevel: PrivacyLevel; readonly retention: AIAuditRetentionClassification; readonly correlationId: string; readonly traceId: string; readonly policyVersions: Readonly<Record<string, string>>; readonly metadata: AIAuditMetadata; }
export interface HistoricalAnalogyAuditTranslationContext { readonly idempotencyKey: string; readonly actor: AIAuditActor; readonly parentAuditRecordIds: ReadonlyArray<string>; readonly relatedAuditRecordIds: ReadonlyArray<string>; }
export interface HistoricalAnalogyAuditTranslation { readonly source: HistoricalAnalogyAuditRecord; readonly input: AIAuditRecordInput; }

export interface HistoricalAnalogyRepository {
  appendRequest(value: HistoricalAnalogyRequest, acceptedAt: string): HistoricalAnalogyAppendResult<HistoricalAnalogyRequest>;
  appendSnapshot(value: CurrentSituationSnapshot, acceptedAt: string): HistoricalAnalogyAppendResult<CurrentSituationSnapshot>;
  appendWeightProfile(value: AnalogyWeightProfile, acceptedAt: string): HistoricalAnalogyAppendResult<AnalogyWeightProfile>;
  appendAnalogy(value: HistoricalAnalogyRecord, acceptedAt: string): HistoricalAnalogyAppendResult<HistoricalAnalogyRecord>;
  appendReview(value: AnalogyReview, history: HistoricalAnalogyLifecycle, acceptedAt: string): HistoricalAnalogyAppendResult<AnalogyReview>;
  appendAmendment(value: AnalogyAmendment, acceptedAt: string): HistoricalAnalogyAppendResult<AnalogyAmendment>;
  appendSupersession(value: AnalogySupersession, history: HistoricalAnalogyLifecycle, acceptedAt: string): HistoricalAnalogyAppendResult<AnalogySupersession>;
  appendArchive(history: HistoricalAnalogyLifecycle, acceptedAt: string): HistoricalAnalogyAppendResult<HistoricalAnalogyLifecycle>;
  getRequestById(id: string): HistoricalAnalogyRequest | undefined;
  getSnapshotById(id: string): CurrentSituationSnapshot | undefined;
  getWeightProfile(id: string, version: string): AnalogyWeightProfile | undefined;
  getAnalogyById(id: string): HistoricalAnalogyRecord | undefined;
  getHistory(id: string): AnalogyHistory | undefined;
  query(query?: AnalogyQuery): ReadonlyArray<HistoricalAnalogyRecord>;
  rank(query?: AnalogyQuery, maximumResultCount?: number): ReadonlyArray<HistoricalAnalogyRecord>;
  listRequests(): ReadonlyArray<HistoricalAnalogyRequest>;
  listWeightProfiles(): ReadonlyArray<AnalogyWeightProfile>;
}

export const ANALOGY_SCORE_SCALE = 10000 as const;

export function regimeTypeToAnalogyDimension(value: HistoricalRegimeType): AnalogyDimensionType {
  const mapped: Partial<Record<HistoricalRegimeType, AnalogyDimensionType>> = {
    MONETARY_POLICY: AnalogyDimensionType.MonetaryPolicy, INFLATION: AnalogyDimensionType.Inflation,
    GROWTH: AnalogyDimensionType.Growth, LIQUIDITY: AnalogyDimensionType.Liquidity, CREDIT: AnalogyDimensionType.Credit,
    VOLATILITY: AnalogyDimensionType.Volatility, VALUATION: AnalogyDimensionType.Valuation,
    FISCAL_POLICY: AnalogyDimensionType.FiscalPolicy, CURRENCY: AnalogyDimensionType.Currency,
    COMMODITY: AnalogyDimensionType.Commodity, MARKET_CONCENTRATION: AnalogyDimensionType.MarketConcentration,
    INVESTOR_POSITIONING: AnalogyDimensionType.InvestorPositioning,
  };
  return mapped[value] ?? AnalogyDimensionType.Other;
}
