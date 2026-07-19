import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";

// Retained for the existing Opportunity, Decision, and Learning contracts.
export enum ConfidenceLevel {
  Low = "LOW",
  Medium = "MEDIUM",
  High = "HIGH",
}

export interface EvidenceItem {
  readonly statement: string;
  readonly source: string;
  readonly sourceTimestamp: string;
  readonly dataPeriod?: string;
  readonly confidence: ConfidenceLevel;
}

export interface EvidenceSnapshot {
  readonly verifiedFacts: ReadonlyArray<EvidenceItem>;
  readonly calculatedMetrics: ReadonlyArray<EvidenceItem>;
  readonly inferences: ReadonlyArray<string>;
  readonly assumptions: ReadonlyArray<string>;
  readonly unknowns: ReadonlyArray<string>;
}

export enum ResearchRecordType {
  Stock = "STOCK", Etf = "ETF", Company = "COMPANY", Sector = "SECTOR",
  Industry = "INDUSTRY", Macro = "MACRO", Policy = "POLICY",
  FederalReserve = "FEDERAL_RESERVE", EventContract = "EVENT_CONTRACT",
  Crypto = "CRYPTO", Commodity = "COMMODITY", Bond = "BOND",
  Currency = "CURRENCY", Catalyst = "CATALYST", Earnings = "EARNINGS",
  Geopolitical = "GEOPOLITICAL", HistoricalPattern = "HISTORICAL_PATTERN",
  HistoricalAnalogy = "HISTORICAL_ANALOGY", MarketStructure = "MARKET_STRUCTURE",
  TechnicalStructure = "TECHNICAL_STRUCTURE", Portfolio = "PORTFOLIO",
  StrategyResearch = "STRATEGY_RESEARCH", SystemResearch = "SYSTEM_RESEARCH",
}

export enum ResearchStatus {
  Draft = "DRAFT", Collecting = "COLLECTING", Analyzing = "ANALYZING",
  Finalized = "FINALIZED", Reviewed = "REVIEWED", Superseded = "SUPERSEDED",
  Archived = "ARCHIVED",
}

export enum ResearchAuthorType {
  Owner = "OWNER", AlphaSubsystem = "ALPHA_SUBSYSTEM", System = "SYSTEM",
  ScheduledJob = "SCHEDULED_JOB",
}

export enum ResearchSourceType {
  CompanyFiling = "COMPANY_FILING", CompanyInvestorRelations = "COMPANY_INVESTOR_RELATIONS",
  GovernmentRelease = "GOVERNMENT_RELEASE", CentralBankRelease = "CENTRAL_BANK_RELEASE",
  RegulatoryFiling = "REGULATORY_FILING", ExchangeData = "EXCHANGE_DATA",
  MarketData = "MARKET_DATA", News = "NEWS", ResearchPaper = "RESEARCH_PAPER",
  Dataset = "DATASET", Transcript = "TRANSCRIPT", Chart = "CHART",
  OwnerScreenshot = "OWNER_SCREENSHOT", OwnerObservation = "OWNER_OBSERVATION",
  HistoricalDatabase = "HISTORICAL_DATABASE", SystemOutput = "SYSTEM_OUTPUT", Other = "OTHER",
}

export enum ResearchEvidenceType {
  Fact = "FACT", QuantitativeData = "QUANTITATIVE_DATA", PriceObservation = "PRICE_OBSERVATION",
  VolumeObservation = "VOLUME_OBSERVATION", FundamentalMetric = "FUNDAMENTAL_METRIC",
  MacroMetric = "MACRO_METRIC", PolicyStatement = "POLICY_STATEMENT", Event = "EVENT",
  Catalyst = "CATALYST", TechnicalStructure = "TECHNICAL_STRUCTURE",
  HistoricalComparison = "HISTORICAL_COMPARISON", Counterevidence = "COUNTEREVIDENCE",
  Assumption = "ASSUMPTION", Inference = "INFERENCE",
}

export enum ResearchObservationClassification {
  Fact = "FACT", Interpretation = "INTERPRETATION", Assumption = "ASSUMPTION", Inference = "INFERENCE",
}

export enum ResearchReferenceType {
  Prediction = "PREDICTION", Journal = "JOURNAL", Strategy = "STRATEGY",
  Portfolio = "PORTFOLIO", Audit = "AUDIT", HistoricalPattern = "HISTORICAL_PATTERN",
  Research = "RESEARCH", Decision = "DECISION", Trade = "TRADE",
  DevelopmentValidation = "DEVELOPMENT_VALIDATION", MarketSnapshot = "MARKET_SNAPSHOT",
  CatalystEvent = "CATALYST_EVENT", EventReplay = "EVENT_REPLAY",
}

export enum ResearchReferenceResolution { Resolved = "RESOLVED", Unresolved = "UNRESOLVED" }
export enum ResearchScenarioType { Base = "BASE_CASE", Bull = "BULL_CASE", Bear = "BEAR_CASE", Alternative = "ALTERNATIVE_CASE" }
export enum ResearchAssumptionImportance { Low = "LOW", Medium = "MEDIUM", High = "HIGH", Critical = "CRITICAL" }
export enum ResearchUncertaintyCategory { MissingData = "MISSING_DATA", ConflictingEvidence = "CONFLICTING_EVIDENCE", ModelRisk = "MODEL_RISK", Timing = "TIMING", Unknown = "UNKNOWN" }
export enum ResearchAmendmentType { FactualCorrection = "FACTUAL_CORRECTION", SourceCorrection = "SOURCE_CORRECTION", Clarification = "CLARIFICATION", AdditionalEvidence = "ADDITIONAL_EVIDENCE", ChangedInterpretation = "CHANGED_INTERPRETATION", ChangedConfidence = "CHANGED_CONFIDENCE", RetractedConclusion = "RETRACTED_CONCLUSION" }
export enum ResearchQuality { Excellent = "EXCELLENT", Good = "GOOD", Mixed = "MIXED", Poor = "POOR", NotAssessed = "NOT_ASSESSED" }
export enum ResearchAppendStatus { Appended = "APPENDED", Replayed = "REPLAYED" }
export enum ResearchExportFormat { Json = "JSON", Ndjson = "NDJSON" }
export enum ResearchExportDestination { LocalSnapshot = "LOCAL_SNAPSHOT", ExternalTransfer = "EXTERNAL_TRANSFER" }
export enum ResearchExportStatus { Exported = "EXPORTED", Rejected = "REJECTED" }
export enum ResearchAuditOperationType { Finalized = "RESEARCH_FINALIZED", AmendmentAppended = "AMENDMENT_APPENDED", ReviewAppended = "REVIEW_APPENDED", SupersessionAppended = "SUPERSESSION_APPENDED", Archived = "RESEARCH_ARCHIVED", Exported = "EXPORTED", ValidationRejected = "VALIDATION_REJECTED" }
export enum ResearchErrorCategory { InvalidRecord = "INVALID_RECORD", InvalidId = "INVALID_ID", InvalidTimestamp = "INVALID_TIMESTAMP", FutureTimestamp = "FUTURE_TIMESTAMP", EmptyQuestion = "EMPTY_QUESTION", EmptyEvidence = "EMPTY_EVIDENCE", EmptyConclusion = "EMPTY_CONCLUSION", RecordNotFound = "RECORD_NOT_FOUND", DuplicateId = "DUPLICATE_ID", IdempotencyConflict = "IDEMPOTENCY_CONFLICT", InvalidLifecycle = "INVALID_LIFECYCLE", InvalidReference = "INVALID_REFERENCE", InvalidConfidence = "INVALID_CONFIDENCE", InvalidProbability = "INVALID_PROBABILITY", InvalidSource = "INVALID_SOURCE", InvalidPrivacy = "INVALID_PRIVACY", ExportRestricted = "EXPORT_RESTRICTED", SensitiveExportUnauthorized = "SENSITIVE_EXPORT_UNAUTHORIZED", SecretMetadata = "SECRET_METADATA", RepositoryCorrupt = "REPOSITORY_CORRUPT", InvalidPath = "INVALID_PATH" }

export interface ResearchScope { readonly included: ReadonlyArray<string>; readonly excluded: ReadonlyArray<string>; }
export interface ResearchQuestion { readonly statement: string; }
export interface ResearchHypothesis { readonly hypothesisId: string; readonly statement: string; readonly supportingEvidenceIds: ReadonlyArray<string>; readonly contradictingEvidenceIds: ReadonlyArray<string>; }
export interface ResearchThesis { readonly statement: string; readonly supportingEvidenceIds: ReadonlyArray<string>; readonly counterEvidenceIds: ReadonlyArray<string>; }
export interface ResearchConclusion { readonly statement: string; readonly limitations: ReadonlyArray<string>; }
export interface ResearchConfidence { readonly score: number; readonly rationale: string; }

export interface ResearchSourceReference {
  readonly sourceReferenceId: string; readonly sourceType: ResearchSourceType; readonly title: string;
  readonly publisherOrOwner: string; readonly publishedAt?: string; readonly observedAt: string;
  readonly retrievedAt?: string; readonly version?: string; readonly locationReference: string;
  readonly privacyLevel: PrivacyLevel; readonly reliabilityScore: number; readonly freshnessScore: number;
  readonly contentIntegrityReference?: string;
}

export interface ResearchDataPoint {
  readonly dataPointId: string; readonly name: string; readonly value: string | number | boolean;
  readonly unit?: string; readonly observedAt: string; readonly sourceReferenceId: string;
}

export interface ResearchEvidence {
  readonly evidenceId: string; readonly evidenceType: ResearchEvidenceType;
  readonly classification: ResearchObservationClassification; readonly statement: string;
  readonly sourceReferenceIds: ReadonlyArray<string>; readonly dataPointReferences: ReadonlyArray<string>;
  readonly interpretation?: string;
}

export interface ResearchAssumption { readonly assumptionId: string; readonly statement: string; readonly importance: ResearchAssumptionImportance; readonly confidence: number; readonly sourceReferenceIds: ReadonlyArray<string>; readonly testable: boolean; readonly invalidationCondition: string; }
export interface ResearchUncertainty { readonly uncertaintyId: string; readonly category: ResearchUncertaintyCategory; readonly statement: string; readonly unknowns: ReadonlyArray<string>; readonly missingData: ReadonlyArray<string>; readonly unresolvedQuestions: ReadonlyArray<string>; }
export interface ResearchRisk { readonly riskId: string; readonly statement: string; readonly likelihood?: number; readonly impact: string; readonly evidenceReferences: ReadonlyArray<string>; }
export interface ResearchCatalyst { readonly catalystId: string; readonly statement: string; readonly expectedAt?: string; readonly evidenceReferences: ReadonlyArray<string>; }

export interface ResearchScenario {
  readonly scenarioId: string; readonly scenarioType: ResearchScenarioType; readonly description: string;
  readonly probability?: number; readonly catalysts: ReadonlyArray<string>; readonly invalidationConditions: ReadonlyArray<string>;
  readonly expectedMarketBehavior: string; readonly timeHorizon: string; readonly supportingEvidenceIds: ReadonlyArray<string>;
}

export interface ResearchTypedReference { readonly referenceId: string; readonly recordType: ResearchReferenceType; readonly resolution: ResearchReferenceResolution; readonly version?: string; readonly frozenStatus?: string; readonly summary?: string; }
export interface ResearchPredictionReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Prediction; }
export interface ResearchJournalReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Journal; }
export interface ResearchStrategyReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Strategy; }
export interface ResearchPortfolioReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Portfolio; }
export interface ResearchAuditReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Audit; }
export interface ResearchHistoricalPatternReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.HistoricalPattern; }
export interface ResearchRelatedReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Research; }
export interface ResearchDecisionReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Decision; }
export interface ResearchTradeReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.Trade; }
export interface ResearchDevelopmentValidationReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.DevelopmentValidation; }
export interface ResearchMarketSnapshotReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.MarketSnapshot; readonly marketTimestamp?: string; }
export interface ResearchCatalystEventReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.CatalystEvent; }
export interface ResearchEventReplayReference extends ResearchTypedReference { readonly recordType: ResearchReferenceType.EventReplay; }

export interface ResearchEvidenceGraph {
  readonly predictions: ReadonlyArray<ResearchPredictionReference>; readonly journals: ReadonlyArray<ResearchJournalReference>;
  readonly strategies: ReadonlyArray<ResearchStrategyReference>; readonly portfolios: ReadonlyArray<ResearchPortfolioReference>;
  readonly audits: ReadonlyArray<ResearchAuditReference>; readonly historicalPatterns: ReadonlyArray<ResearchHistoricalPatternReference>;
  readonly research: ReadonlyArray<ResearchRelatedReference>; readonly decisions: ReadonlyArray<ResearchDecisionReference>;
  readonly trades: ReadonlyArray<ResearchTradeReference>; readonly developmentValidations: ReadonlyArray<ResearchDevelopmentValidationReference>;
  readonly marketSnapshots: ReadonlyArray<ResearchMarketSnapshotReference>; readonly catalystEvents: ReadonlyArray<ResearchCatalystEventReference>;
  readonly eventReplayTimelines: ReadonlyArray<ResearchEventReplayReference>;
}

export interface ResearchHistory { readonly historyId: string; readonly researchId: string; readonly lifecycleSequence: number; readonly fromStatus: ResearchStatus; readonly toStatus: ResearchStatus; readonly occurredAt: string; readonly reason: string; readonly referenceId?: string; }
export interface ResearchLifecycle { readonly authoritativeInitialStatus: ResearchStatus.Finalized; readonly allowedTransitions: Readonly<Record<ResearchStatus, ReadonlyArray<ResearchStatus>>>; }

export interface ResearchRecordSnapshot {
  readonly schemaVersion: "1.0"; readonly researchVersion: string; readonly createdAt: string;
  readonly eventTimestamp?: string; readonly finalizedAt: string; readonly researchType: ResearchRecordType;
  readonly title: string; readonly question: ResearchQuestion; readonly scope: ResearchScope; readonly market?: string;
  readonly ticker?: string; readonly asset?: string; readonly company?: string; readonly sector?: string;
  readonly industry?: string; readonly theme?: string; readonly timeHorizon: string;
  readonly factualObservations: ReadonlyArray<string>; readonly sources: ReadonlyArray<ResearchSourceReference>;
  readonly evidence: ReadonlyArray<ResearchEvidence>; readonly dataPoints: ReadonlyArray<ResearchDataPoint>;
  readonly hypotheses: ReadonlyArray<ResearchHypothesis>; readonly assumptions: ReadonlyArray<ResearchAssumption>;
  readonly uncertainties: ReadonlyArray<ResearchUncertainty>; readonly counterarguments: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<ResearchRisk>; readonly catalysts: ReadonlyArray<ResearchCatalyst>;
  readonly thesis: ResearchThesis; readonly conclusion: ResearchConclusion; readonly confidence: ResearchConfidence;
  readonly scenarios: ReadonlyArray<ResearchScenario>; readonly invalidationConditions: ReadonlyArray<string>;
  readonly references: ResearchEvidenceGraph; readonly supersedesResearchId?: string; readonly tags: ReadonlyArray<string>;
  readonly authorType: ResearchAuthorType; readonly ownerReference: string; readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification; readonly correlationId: string; readonly traceId: string;
  readonly policyVersions: Readonly<Record<string, string>>; readonly metadata: AIAuditMetadata;
}

export interface ResearchRecord extends ResearchRecordSnapshot { readonly researchId: string; readonly status: ResearchStatus; readonly history: ReadonlyArray<ResearchHistory>; }

export interface ResearchAmendment { readonly amendmentId: string; readonly researchId: string; readonly parentAmendmentId?: string; readonly createdAt: string; readonly amendmentType: ResearchAmendmentType; readonly reason: string; readonly changedFields: ReadonlyArray<string>; readonly additionalEvidence: ReadonlyArray<ResearchEvidence>; readonly confidence?: ResearchConfidence; readonly authorReference: string; readonly auditReference: ResearchAuditReference; }
export interface ResearchReview { readonly reviewId: string; readonly researchId: string; readonly createdAt: string; readonly reviewer: string; readonly whatHeldUp: string; readonly whatFailed: string; readonly correctAssumptions: ReadonlyArray<string>; readonly incorrectAssumptions: ReadonlyArray<string>; readonly sourceQuality: ResearchQuality; readonly processQuality: ResearchQuality; readonly conclusionQuality: ResearchQuality; readonly predictionReferences: ReadonlyArray<ResearchPredictionReference>; readonly profitabilityReferences: ReadonlyArray<ResearchTradeReference>; readonly lessons: ReadonlyArray<string>; readonly futureResearchQuestions: ReadonlyArray<string>; readonly strategyChangeCandidate?: string; readonly auditReference: ResearchAuditReference; }
export interface ResearchSupersession { readonly supersessionId: string; readonly priorResearchId: string; readonly newResearchId: string; readonly reason: string; readonly changedFacts: ReadonlyArray<string>; readonly changedAssumptions: ReadonlyArray<string>; readonly changedMarketRegime: string; readonly changedThesis: string; readonly createdAt: string; readonly ownerReference: string; readonly auditReference: ResearchAuditReference; }

export interface ResearchFilter { readonly fromEventTimestamp?: string; readonly toEventTimestamp?: string; readonly researchTypes?: ReadonlyArray<ResearchRecordType>; readonly statuses?: ReadonlyArray<ResearchStatus>; readonly market?: string; readonly ticker?: string; readonly asset?: string; readonly company?: string; readonly sector?: string; readonly industry?: string; readonly theme?: string; readonly catalystId?: string; readonly predictionId?: string; readonly journalId?: string; readonly strategyId?: string; readonly historicalPatternId?: string; readonly tags?: ReadonlyArray<string>; readonly correlationId?: string; readonly traceId?: string; readonly currentOnly?: boolean; }
export interface ResearchQuery { readonly filter?: ResearchFilter; readonly offset?: number; readonly limit?: number; }
export interface ResearchSummary { readonly researchId: string; readonly researchVersion: string; readonly finalizedAt: string; readonly researchType: ResearchRecordType; readonly title: string; readonly status: ResearchStatus; readonly conclusion: string; readonly confidence: number; readonly ticker?: string; readonly sector?: string; readonly theme?: string; readonly tags: ReadonlyArray<string>; readonly amendmentCount: number; readonly reviewed: boolean; }
export interface ResearchStatistics { readonly generatedAt: string; readonly totalRecords: number; readonly finalizedRecords: number; readonly reviewedRecords: number; readonly currentRecords: number; readonly supersededRecords: number; readonly predictionLinkedRecords: number; readonly journalLinkedRecords: number; readonly unresolvedQuestionCount: number; readonly assumptionCount: number; readonly byCategory: Readonly<Partial<Record<ResearchRecordType, number>>>; readonly byStatus: Readonly<Partial<Record<ResearchStatus, number>>>; readonly byDay: Readonly<Record<string, number>>; readonly byMonth: Readonly<Record<string, number>>; readonly bySubject: Readonly<Record<string, number>>; readonly evidenceBySourceType: Readonly<Partial<Record<ResearchSourceType, number>>>; readonly sourceReliabilityDistribution: Readonly<Record<string, number>>; readonly processQualityDistribution: Readonly<Partial<Record<ResearchQuality, number>>>; }
export interface ResearchRecordHistory { readonly record: ResearchRecord; readonly lifecycle: ReadonlyArray<ResearchHistory>; readonly amendments: ReadonlyArray<ResearchAmendment>; readonly reviews: ReadonlyArray<ResearchReview>; readonly supersessions: ReadonlyArray<ResearchSupersession>; }
export interface ResearchPredictionEvidenceReference { readonly researchId: string; readonly researchVersion: string; readonly frozenStatus: ResearchStatus.Finalized | ResearchStatus.Reviewed; readonly conclusionSummary: string; readonly confidenceScore: number; }
export interface ResearchPredictionLinkPolicy { readonly required: boolean; readonly rejectNonFinalized: boolean; }
export interface ResearchPredictionLinkResult { readonly accepted: boolean; readonly warnings: ReadonlyArray<string>; readonly reference?: ResearchPredictionEvidenceReference; }
export interface ResearchError { readonly category: ResearchErrorCategory; readonly message: string; readonly field?: string; }
export interface ResearchValidation { readonly valid: boolean; readonly errors: ReadonlyArray<ResearchError>; }
export interface ResearchAppendResult<T> { readonly status: ResearchAppendStatus; readonly record: T; readonly repositorySequence: number; }
export interface ResearchExportRequest { readonly exportId: string; readonly requestedAt: string; readonly query: ResearchQuery; readonly format: ResearchExportFormat; readonly destination: ResearchExportDestination; readonly sensitiveAuthorizationReference?: string; }
export interface ResearchExportResult { readonly status: ResearchExportStatus; readonly exportId: string; readonly exportedAt: string; readonly format: ResearchExportFormat; readonly recordCount: number; readonly content?: string; readonly error?: ResearchError; }
export interface ResearchExportPolicy { readonly allowExternalExports: boolean; readonly requireSensitiveAuthorization: boolean; readonly sensitiveAuthorizationReferences: ReadonlyArray<string>; }
export interface ResearchAuditRecord { readonly auditId: string; readonly operationType: ResearchAuditOperationType; readonly sourceRecordId: string; readonly researchId?: string; readonly researchVersion?: string; readonly timestamp: string; readonly status: string; readonly reasonCodes: ReadonlyArray<string>; readonly evidenceReferences: ReadonlyArray<string>; readonly privacyLevel: PrivacyLevel; readonly retention: AIAuditRetentionClassification; readonly correlationId: string; readonly traceId: string; readonly policyVersions: Readonly<Record<string, string>>; readonly metadata: AIAuditMetadata; }
export interface ResearchAuditTranslationContext { readonly idempotencyKey: string; readonly actor: AIAuditActor; readonly parentAuditRecordIds: ReadonlyArray<string>; readonly relatedAuditRecordIds: ReadonlyArray<string>; }
export type ResearchAuditTranslation = (source: Readonly<ResearchAuditRecord>, context: Readonly<ResearchAuditTranslationContext>) => AIAuditRecordInput;

export const DEFAULT_RESEARCH_LIFECYCLE: ResearchLifecycle = {
  authoritativeInitialStatus: ResearchStatus.Finalized,
  allowedTransitions: {
    [ResearchStatus.Draft]: [ResearchStatus.Collecting],
    [ResearchStatus.Collecting]: [ResearchStatus.Analyzing],
    [ResearchStatus.Analyzing]: [ResearchStatus.Finalized],
    [ResearchStatus.Finalized]: [ResearchStatus.Reviewed, ResearchStatus.Superseded, ResearchStatus.Archived],
    [ResearchStatus.Reviewed]: [ResearchStatus.Superseded, ResearchStatus.Archived],
    [ResearchStatus.Superseded]: [ResearchStatus.Archived],
    [ResearchStatus.Archived]: [],
  },
};
