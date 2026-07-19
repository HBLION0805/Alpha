import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";

export type HistoricalEventId = string;
export type HistoricalPatternId = string;

export enum HistoricalRecordKind { Event = "EVENT", Pattern = "PATTERN" }

export enum HistoricalEventType {
  MonetaryTightening = "MONETARY_TIGHTENING", MonetaryEasing = "MONETARY_EASING",
  RateHikeCycle = "RATE_HIKE_CYCLE", RateCutCycle = "RATE_CUT_CYCLE",
  LiquidityCrisis = "LIQUIDITY_CRISIS", CreditCrisis = "CREDIT_CRISIS", BankingCrisis = "BANKING_CRISIS",
  Recession = "RECESSION", InflationShock = "INFLATION_SHOCK", DeflationShock = "DEFLATION_SHOCK",
  MarketCrash = "MARKET_CRASH", BearMarket = "BEAR_MARKET", BullMarket = "BULL_MARKET",
  AssetBubble = "ASSET_BUBBLE", BubbleCollapse = "BUBBLE_COLLAPSE", War = "WAR",
  GeopoliticalCrisis = "GEOPOLITICAL_CRISIS", Sanctions = "SANCTIONS", EnergyShock = "ENERGY_SHOCK",
  CommodityShock = "COMMODITY_SHOCK", CurrencyCrisis = "CURRENCY_CRISIS",
  SovereignDebtCrisis = "SOVEREIGN_DEBT_CRISIS", FiscalStimulus = "FISCAL_STIMULUS",
  RegulatoryChange = "REGULATORY_CHANGE", TechnologyBoom = "TECHNOLOGY_BOOM",
  SectorRotation = "SECTOR_ROTATION", Pandemic = "PANDEMIC", SupplyChainShock = "SUPPLY_CHAIN_SHOCK",
  CorporateFailure = "CORPORATE_FAILURE", MarketStructureEvent = "MARKET_STRUCTURE_EVENT", Other = "OTHER",
}

export enum HistoricalEventStatus { Proposed = "PROPOSED", Validating = "VALIDATING", Finalized = "FINALIZED", Reviewed = "REVIEWED", Superseded = "SUPERSEDED", Archived = "ARCHIVED", Rejected = "REJECTED" }
export enum HistoricalPatternStatus { Proposed = "PROPOSED", Validating = "VALIDATING", Finalized = "FINALIZED", Reviewed = "REVIEWED", Superseded = "SUPERSEDED", Archived = "ARCHIVED", Rejected = "REJECTED" }

export enum HistoricalPatternType {
  LiquidityRelease = "LIQUIDITY_RELEASE", PolicyPivot = "POLICY_PIVOT", CreditStress = "CREDIT_STRESS",
  ForcedDeleveraging = "FORCED_DELEVERAGING", VolatilitySpike = "VOLATILITY_SPIKE",
  BubbleExpansion = "BUBBLE_EXPANSION", BubbleDeflation = "BUBBLE_DEFLATION", ReliefRally = "RELIEF_RALLY",
  BearMarketRally = "BEAR_MARKET_RALLY", EarningsRepricing = "EARNINGS_REPRICING",
  SectorRotation = "SECTOR_ROTATION", QualityFlight = "QUALITY_FLIGHT", SafeHavenFlow = "SAFE_HAVEN_FLOW",
  DollarLiquidityStress = "DOLLAR_LIQUIDITY_STRESS", CommoditySupplyShock = "COMMODITY_SUPPLY_SHOCK",
  GeopoliticalRiskRelease = "GEOPOLITICAL_RISK_RELEASE", TechnologyAdoptionCycle = "TECHNOLOGY_ADOPTION_CYCLE",
  Capitulation = "CAPITULATION", Recovery = "RECOVERY", RegimeTransition = "REGIME_TRANSITION", Other = "OTHER",
}

export enum HistoricalClaimClassification {
  HistoricalFact = "HISTORICAL_FACT", QuantitativeObservation = "QUANTITATIVE_OBSERVATION",
  SourceClaim = "SOURCE_CLAIM", Interpretation = "INTERPRETATION", Inference = "INFERENCE",
  Hypothesis = "HYPOTHESIS", DisputedClaim = "DISPUTED_CLAIM", Counterevidence = "COUNTEREVIDENCE", Unknown = "UNKNOWN",
}

export enum HistoricalDatePrecision { ExactTimestamp = "EXACT_TIMESTAMP", ExactDate = "EXACT_DATE", Month = "MONTH", Quarter = "QUARTER", Year = "YEAR", Approximate = "APPROXIMATE", BoundedRange = "BOUNDED_RANGE", Unknown = "UNKNOWN" }
export enum HistoricalTimeHorizon { PreEvent = "PRE_EVENT", EventDay = "EVENT_DAY", FirstTradingDay = "FIRST_TRADING_DAY", ThreeTradingDays = "THREE_TRADING_DAYS", OneWeek = "ONE_WEEK", OneMonth = "ONE_MONTH", ThreeMonths = "THREE_MONTHS", SixMonths = "SIX_MONTHS", OneYear = "ONE_YEAR", MultiYear = "MULTI_YEAR", Custom = "CUSTOM" }
export enum HistoricalAssetClass { Equity = "EQUITY", FixedIncome = "FIXED_INCOME", Commodity = "COMMODITY", Currency = "CURRENCY", Crypto = "CRYPTO", RealEstate = "REAL_ESTATE", Cash = "CASH", Volatility = "VOLATILITY", Credit = "CREDIT", Other = "OTHER" }
export enum HistoricalReactionDirection { Up = "UP", Down = "DOWN", Flat = "FLAT", Mixed = "MIXED", Unknown = "UNKNOWN" }
export enum HistoricalMissingDataState { Complete = "COMPLETE", Partial = "PARTIAL", Missing = "MISSING", NotApplicable = "NOT_APPLICABLE" }

export enum HistoricalRegimeType { MonetaryPolicy = "MONETARY_POLICY", Inflation = "INFLATION", Growth = "GROWTH", Liquidity = "LIQUIDITY", Credit = "CREDIT", Volatility = "VOLATILITY", Valuation = "VALUATION", FiscalPolicy = "FISCAL_POLICY", Currency = "CURRENCY", Commodity = "COMMODITY", MarketConcentration = "MARKET_CONCENTRATION", InvestorPositioning = "INVESTOR_POSITIONING" }
export enum HistoricalRegimeState { Known = "KNOWN", Unknown = "UNKNOWN", Disputed = "DISPUTED" }

export enum HistoricalSourceType { GovernmentRelease = "GOVERNMENT_RELEASE", CentralBankRelease = "CENTRAL_BANK_RELEASE", RegulatoryFiling = "REGULATORY_FILING", ExchangeData = "EXCHANGE_DATA", MarketData = "MARKET_DATA", CompanyFiling = "COMPANY_FILING", ResearchPaper = "RESEARCH_PAPER", Dataset = "DATASET", HistoricalDatabase = "HISTORICAL_DATABASE", NewsArchive = "NEWS_ARCHIVE", Book = "BOOK", OwnerObservation = "OWNER_OBSERVATION", SystemOutput = "SYSTEM_OUTPUT", Other = "OTHER" }
export enum HistoricalReferenceResolution { Resolved = "RESOLVED", Unresolved = "UNRESOLVED" }
export enum HistoricalReferenceType { Research = "RESEARCH", Journal = "JOURNAL", Prediction = "PREDICTION", Strategy = "STRATEGY", Audit = "AUDIT" }
export enum HistoricalAmendmentType { FactualCorrection = "FACTUAL_CORRECTION", DateCorrection = "DATE_CORRECTION", SourceCorrection = "SOURCE_CORRECTION", AssetReactionCorrection = "ASSET_REACTION_CORRECTION", AdditionalEvidence = "ADDITIONAL_EVIDENCE", ChangedInterpretation = "CHANGED_INTERPRETATION", ChangedConfidence = "CHANGED_CONFIDENCE", ChangedRegimeClassification = "CHANGED_REGIME_CLASSIFICATION", RetractedConclusion = "RETRACTED_CONCLUSION" }
export enum HistoricalReviewQuality { Excellent = "EXCELLENT", Good = "GOOD", Mixed = "MIXED", Poor = "POOR", NotAssessed = "NOT_ASSESSED" }
export enum HistoricalAppendStatus { Appended = "APPENDED", Replayed = "REPLAYED" }
export enum HistoricalExportFormat { Json = "JSON", Ndjson = "NDJSON" }
export enum HistoricalExportDestination { LocalSnapshot = "LOCAL_SNAPSHOT", ExternalTransfer = "EXTERNAL_TRANSFER" }
export enum HistoricalExportStatus { Exported = "EXPORTED", Rejected = "REJECTED" }
export enum HistoricalAuditOperationType { EventFinalized = "HISTORICAL_EVENT_FINALIZED", EventAmended = "HISTORICAL_EVENT_AMENDED", EventReviewed = "HISTORICAL_EVENT_REVIEWED", PatternFinalized = "HISTORICAL_PATTERN_FINALIZED", PatternAmended = "HISTORICAL_PATTERN_AMENDED", PatternReviewed = "HISTORICAL_PATTERN_REVIEWED", RecordSuperseded = "HISTORICAL_RECORD_SUPERSEDED", Archived = "HISTORICAL_RECORD_ARCHIVED", Exported = "HISTORICAL_RECORD_EXPORTED", ValidationRejected = "HISTORICAL_VALIDATION_REJECTED" }
export enum HistoricalPatternErrorCategory { InvalidRecord = "INVALID_RECORD", InvalidId = "INVALID_ID", InvalidTimestamp = "INVALID_TIMESTAMP", InvalidDateRange = "INVALID_DATE_RANGE", InvalidDatePrecision = "INVALID_DATE_PRECISION", MissingEvidence = "MISSING_EVIDENCE", MissingSupportingEvent = "MISSING_SUPPORTING_EVENT", InvalidCalculation = "INVALID_CALCULATION", InvalidLifecycle = "INVALID_LIFECYCLE", InvalidReference = "INVALID_REFERENCE", InvalidConfidence = "INVALID_CONFIDENCE", InvalidPrivacy = "INVALID_PRIVACY", RecordNotFound = "RECORD_NOT_FOUND", DuplicateId = "DUPLICATE_ID", IdempotencyConflict = "IDEMPOTENCY_CONFLICT", ExportRestricted = "EXPORT_RESTRICTED", SensitiveExportUnauthorized = "SENSITIVE_EXPORT_UNAUTHORIZED", SecretMetadata = "SECRET_METADATA", RepositoryCorrupt = "REPOSITORY_CORRUPT", InvalidPath = "INVALID_PATH", InvalidPagination = "INVALID_PAGINATION" }

export interface HistoricalDateValue { readonly value?: string; readonly precision: HistoricalDatePrecision; readonly earliest?: string; readonly latest?: string; readonly note?: string; }
export interface HistoricalEventScope { readonly included: ReadonlyArray<string>; readonly excluded: ReadonlyArray<string>; }
export interface HistoricalEventCause { readonly causeId: string; readonly statement: string; readonly classification: HistoricalClaimClassification; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly confidence: number; }
export interface HistoricalEventOutcome { readonly outcomeId: string; readonly statement: string; readonly classification: HistoricalClaimClassification; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly horizon?: HistoricalTimeHorizon; }

export interface HistoricalSourceReference { readonly sourceReferenceId: string; readonly sourceType: HistoricalSourceType; readonly title: string; readonly publisherOrOwner: string; readonly publishedAt?: string; readonly observedAt?: string; readonly retrievedAt?: string; readonly version?: string; readonly locationReference: string; readonly privacyLevel: PrivacyLevel; readonly reliabilityScore: number; readonly contentIntegrityReference?: string; }
export interface HistoricalDataReference { readonly dataReferenceId: string; readonly value?: number; readonly unit?: string; readonly currency?: string; readonly observedAt?: string; readonly sourceReferenceId: string; readonly missing: boolean; }
export interface HistoricalPatternEvidence { readonly evidenceId: string; readonly classification: HistoricalClaimClassification; readonly statement: string; readonly sourceReferenceIds: ReadonlyArray<string>; readonly dataReferenceIds: ReadonlyArray<string>; readonly confidence: number; readonly competingInterpretationIds: ReadonlyArray<string>; }
export type HistoricalPatternConfidence = { readonly score: number; readonly rationale: string };
export interface HistoricalPatternLimitation { readonly limitationId: string; readonly statement: string; readonly material: boolean; readonly evidenceReferenceIds: ReadonlyArray<string>; }
export interface HistoricalPatternInvalidationCondition { readonly conditionId: string; readonly statement: string; readonly evidenceRequired: ReadonlyArray<string>; }

export interface HistoricalMarketIndexReference { readonly referenceId: string; readonly market: string; readonly indexName: string; readonly currency?: string; }
export interface HistoricalSectorReference { readonly referenceId: string; readonly market: string; readonly sector: string; readonly currency?: string; }
export interface HistoricalInstrumentReference { readonly referenceId: string; readonly instrumentName: string; readonly ticker?: string; readonly market?: string; readonly currency?: string; }
export interface HistoricalObservationWindow { readonly windowId: string; readonly horizon: HistoricalTimeHorizon; readonly start: HistoricalDateValue; readonly end: HistoricalDateValue; readonly tradingDayBasis?: string; readonly customLabel?: string; }
export interface HistoricalAssetReaction { readonly reactionId: string; readonly assetClass: HistoricalAssetClass; readonly marketIndex?: HistoricalMarketIndexReference; readonly sector?: HistoricalSectorReference; readonly instrument?: HistoricalInstrumentReference; readonly observationWindow: HistoricalObservationWindow; readonly startValue?: HistoricalDataReference; readonly endValue?: HistoricalDataReference; readonly absoluteChange?: number; readonly percentageChange?: number; readonly maximumDrawdown?: number; readonly maximumGain?: number; readonly realizedVolatility?: number; readonly volumeOrLiquidityObservation?: string; readonly direction: HistoricalReactionDirection; readonly recoveryDuration?: string; readonly sourceDataTimestamp?: string; readonly dataSourceReferenceIds: ReadonlyArray<string>; readonly missingDataState: HistoricalMissingDataState; readonly calculationMethodReference?: string; readonly currencyConversionEvidenceReference?: string; }

export interface HistoricalRegimeDimension { readonly dimension: HistoricalRegimeType; readonly state: HistoricalRegimeState; readonly value?: string; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly confidence: number; readonly period: HistoricalDateValue; readonly competingValues?: ReadonlyArray<string>; }
export interface HistoricalMarketRegime { readonly regimeId: string; readonly dimensions: ReadonlyArray<HistoricalRegimeDimension>; readonly summary: string; }
export interface HistoricalMacroContext { readonly inflation: HistoricalRegimeDimension; readonly growth: HistoricalRegimeDimension; }
export interface HistoricalPolicyContext { readonly monetaryPolicy?: HistoricalRegimeDimension; readonly fiscalPolicy?: HistoricalRegimeDimension; readonly responses: ReadonlyArray<string>; }
export interface HistoricalLiquidityContext { readonly dimension: HistoricalRegimeDimension; readonly observations: ReadonlyArray<string>; }
export interface HistoricalVolatilityContext { readonly dimension: HistoricalRegimeDimension; readonly observations: ReadonlyArray<string>; }
export interface HistoricalCreditContext { readonly dimension: HistoricalRegimeDimension; readonly observations: ReadonlyArray<string>; }

export interface HistoricalTypedReference { readonly referenceId: string; readonly recordType: HistoricalReferenceType; readonly resolution: HistoricalReferenceResolution; readonly version?: string; readonly frozenStatus?: string; readonly summary?: string; }
export interface HistoricalResearchReference extends HistoricalTypedReference { readonly recordType: HistoricalReferenceType.Research; }
export interface HistoricalJournalReference extends HistoricalTypedReference { readonly recordType: HistoricalReferenceType.Journal; }
export interface HistoricalPredictionReference extends HistoricalTypedReference { readonly recordType: HistoricalReferenceType.Prediction; }
export interface HistoricalStrategyReference extends HistoricalTypedReference { readonly recordType: HistoricalReferenceType.Strategy; }
export interface HistoricalAuditReference extends HistoricalTypedReference { readonly recordType: HistoricalReferenceType.Audit; }
export interface HistoricalReferenceGraph { readonly research: ReadonlyArray<HistoricalResearchReference>; readonly journals: ReadonlyArray<HistoricalJournalReference>; readonly predictions: ReadonlyArray<HistoricalPredictionReference>; readonly strategies: ReadonlyArray<HistoricalStrategyReference>; readonly audits: ReadonlyArray<HistoricalAuditReference>; }

export interface HistoricalEventHistory { readonly historyId: string; readonly eventId: HistoricalEventId; readonly lifecycleSequence: number; readonly fromStatus: HistoricalEventStatus; readonly toStatus: HistoricalEventStatus; readonly occurredAt: string; readonly reason: string; readonly referenceId?: string; }
export interface HistoricalPatternHistoryEntry { readonly historyId: string; readonly patternId: HistoricalPatternId; readonly lifecycleSequence: number; readonly fromStatus: HistoricalPatternStatus; readonly toStatus: HistoricalPatternStatus; readonly occurredAt: string; readonly reason: string; readonly referenceId?: string; }
export interface HistoricalEventLifecycle { readonly authoritativeInitialStatus: HistoricalEventStatus.Finalized; readonly history: ReadonlyArray<HistoricalEventHistory>; }

export interface HistoricalEvent {
  readonly eventId: HistoricalEventId; readonly schemaVersion: "1.0"; readonly recordVersion: string; readonly title: string;
  readonly eventCategories: ReadonlyArray<HistoricalEventType>; readonly start: HistoricalDateValue; readonly peak?: HistoricalDateValue;
  readonly end?: HistoricalDateValue; readonly openEnded: boolean; readonly geography: ReadonlyArray<string>; readonly affectedMarkets: ReadonlyArray<string>;
  readonly affectedAssetClasses: ReadonlyArray<HistoricalAssetClass>; readonly scope: HistoricalEventScope; readonly factualDescription: string;
  readonly causes: ReadonlyArray<HistoricalEventCause>; readonly outcomes: ReadonlyArray<HistoricalEventOutcome>; readonly contributingFactors: ReadonlyArray<string>;
  readonly policyContext: HistoricalPolicyContext; readonly macroContext: HistoricalMacroContext; readonly liquidityContext: HistoricalLiquidityContext;
  readonly creditContext: HistoricalCreditContext; readonly volatilityContext: HistoricalVolatilityContext; readonly marketRegime: HistoricalMarketRegime;
  readonly observationWindows: ReadonlyArray<HistoricalObservationWindow>; readonly assetReactions: ReadonlyArray<HistoricalAssetReaction>;
  readonly sources: ReadonlyArray<HistoricalSourceReference>; readonly dataReferences: ReadonlyArray<HistoricalDataReference>; readonly evidence: ReadonlyArray<HistoricalPatternEvidence>;
  readonly uncertainties: ReadonlyArray<string>; readonly disputedInterpretations: ReadonlyArray<HistoricalPatternEvidence>; readonly relatedEventIds: ReadonlyArray<HistoricalEventId>;
  readonly references: HistoricalReferenceGraph; readonly tags: ReadonlyArray<string>; readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification; readonly correlationId: string; readonly traceId: string;
  readonly policyVersions: Readonly<Record<string, string>>; readonly metadata: AIAuditMetadata; readonly status: HistoricalEventStatus;
  readonly history: ReadonlyArray<HistoricalEventHistory>;
}

export interface HistoricalPatternFeature { readonly featureId: string; readonly name: string; readonly description: string; readonly classification: HistoricalClaimClassification; readonly evidenceReferenceIds: ReadonlyArray<string>; }
export interface HistoricalPatternDimension { readonly dimensionId: string; readonly name: string; readonly required: boolean; readonly expectedValues: ReadonlyArray<string>; readonly evidenceReferenceIds: ReadonlyArray<string>; }
export interface HistoricalPattern {
  readonly patternId: HistoricalPatternId; readonly schemaVersion: "1.0"; readonly recordVersion: string; readonly title: string;
  readonly patternType: HistoricalPatternType; readonly description: string; readonly qualifyingConditions: ReadonlyArray<string>;
  readonly causalMechanism: HistoricalPatternEvidence; readonly typicalSequence: ReadonlyArray<string>;
  readonly features: ReadonlyArray<HistoricalPatternFeature>; readonly dimensions: ReadonlyArray<HistoricalPatternDimension>;
  readonly sourceEventIds: ReadonlyArray<HistoricalEventId>; readonly evidence: ReadonlyArray<HistoricalPatternEvidence>;
  readonly counterexamples: ReadonlyArray<HistoricalEventId>; readonly knownExceptions: ReadonlyArray<string>;
  readonly regimeDependencies: ReadonlyArray<HistoricalRegimeDimension>; readonly typicalAssetReactions: ReadonlyArray<HistoricalAssetReaction>;
  readonly confidence: HistoricalPatternConfidence; readonly limitations: ReadonlyArray<HistoricalPatternLimitation>;
  readonly invalidationConditions: ReadonlyArray<HistoricalPatternInvalidationCondition>; readonly minimumSupportingEventCount: number;
  readonly ownerApprovalReference?: string; readonly relatedPatternIds: ReadonlyArray<HistoricalPatternId>;
  readonly references: HistoricalReferenceGraph; readonly tags: ReadonlyArray<string>; readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification; readonly correlationId: string; readonly traceId: string;
  readonly policyVersions: Readonly<Record<string, string>>; readonly metadata: AIAuditMetadata; readonly status: HistoricalPatternStatus;
  readonly history: ReadonlyArray<HistoricalPatternHistoryEntry>;
}

export interface HistoricalEventAmendment { readonly amendmentId: string; readonly eventId: HistoricalEventId; readonly parentAmendmentId?: string; readonly createdAt: string; readonly amendmentType: HistoricalAmendmentType; readonly reason: string; readonly changedFields: ReadonlyArray<string>; readonly evidence: ReadonlyArray<HistoricalPatternEvidence>; readonly authorReference: string; readonly auditReference: HistoricalAuditReference; }
export interface HistoricalPatternAmendment { readonly amendmentId: string; readonly patternId: HistoricalPatternId; readonly parentAmendmentId?: string; readonly createdAt: string; readonly amendmentType: HistoricalAmendmentType; readonly reason: string; readonly changedFields: ReadonlyArray<string>; readonly evidence: ReadonlyArray<HistoricalPatternEvidence>; readonly confidence?: HistoricalPatternConfidence; readonly authorReference: string; readonly auditReference: HistoricalAuditReference; }
export interface HistoricalEventReview { readonly reviewId: string; readonly eventId: HistoricalEventId; readonly createdAt: string; readonly reviewer: string; readonly sourceQuality: HistoricalReviewQuality; readonly evidenceCompleteness: HistoricalReviewQuality; readonly hindsightBiasRisk: HistoricalReviewQuality; readonly survivorshipBiasRisk: HistoricalReviewQuality; readonly selectionBiasRisk: HistoricalReviewQuality; readonly regimeClassificationQuality: HistoricalReviewQuality; readonly causalInferenceQuality: HistoricalReviewQuality; readonly calculationQuality: HistoricalReviewQuality; readonly missingDataImpact: string; readonly applicabilityLimitations: ReadonlyArray<string>; readonly futureResearchQuestions: ReadonlyArray<string>; readonly auditReference: HistoricalAuditReference; }
export interface HistoricalPatternReview extends Omit<HistoricalEventReview, "eventId"> { readonly patternId: HistoricalPatternId; }
export interface HistoricalPatternSupersession { readonly supersessionId: string; readonly priorPatternId: HistoricalPatternId; readonly successorPatternId: HistoricalPatternId; readonly createdAt: string; readonly reason: string; readonly changedEvidence: ReadonlyArray<string>; readonly changedMethodology: ReadonlyArray<string>; readonly ownerReference: string; readonly auditReference: HistoricalAuditReference; }

export interface HistoricalPatternFilter { readonly recordKinds?: ReadonlyArray<HistoricalRecordKind>; readonly eventCategories?: ReadonlyArray<HistoricalEventType>; readonly patternTypes?: ReadonlyArray<HistoricalPatternType>; readonly statuses?: ReadonlyArray<HistoricalEventStatus | HistoricalPatternStatus>; readonly fromDate?: string; readonly toDate?: string; readonly geography?: string; readonly market?: string; readonly assetClass?: HistoricalAssetClass; readonly regimeDimension?: HistoricalRegimeType; readonly regimeValue?: string; readonly sourceEventId?: string; readonly researchId?: string; readonly strategyId?: string; readonly tags?: ReadonlyArray<string>; readonly currentOnly?: boolean; }
export interface HistoricalPatternQuery { readonly filter?: HistoricalPatternFilter; readonly offset?: number; readonly limit?: number; }
export type HistoricalPatternSummary = { readonly recordKind: HistoricalRecordKind.Event; readonly recordId: HistoricalEventId; readonly recordVersion: string; readonly title: string; readonly status: HistoricalEventStatus; readonly categories: ReadonlyArray<HistoricalEventType>; readonly reviewed: boolean; readonly amendmentCount: number } | { readonly recordKind: HistoricalRecordKind.Pattern; readonly recordId: HistoricalPatternId; readonly recordVersion: string; readonly title: string; readonly status: HistoricalPatternStatus; readonly patternType: HistoricalPatternType; readonly supportingEventCount: number; readonly reviewed: boolean; readonly amendmentCount: number };
export interface HistoricalPatternStatistics { readonly generatedAt: string; readonly eventCount: number; readonly patternCount: number; readonly eventsByCategory: Readonly<Partial<Record<HistoricalEventType, number>>>; readonly patternsByType: Readonly<Partial<Record<HistoricalPatternType, number>>>; readonly eventsByDecade: Readonly<Record<string, number>>; readonly eventsByGeography: Readonly<Record<string, number>>; readonly recordsByStatus: Readonly<Record<string, number>>; readonly eventsByRegime: Readonly<Record<string, number>>; readonly eventsByAssetClass: Readonly<Partial<Record<HistoricalAssetClass, number>>>; readonly sourcesByType: Readonly<Partial<Record<HistoricalSourceType, number>>>; readonly patternsBySupportingEventCount: Readonly<Record<string, number>>; readonly currentRecordCount: number; readonly supersededRecordCount: number; readonly reviewedRecordCount: number; readonly unreviewedRecordCount: number; readonly missingDataCount: number; readonly disputedClaimCount: number; readonly evidenceCount: number; readonly researchLinkedRecordCount: number; readonly strategyLinkedRecordCount: number; }
export interface HistoricalPatternHistory { readonly record: HistoricalPattern; readonly lifecycle: ReadonlyArray<HistoricalPatternHistoryEntry>; readonly amendments: ReadonlyArray<HistoricalPatternAmendment>; readonly reviews: ReadonlyArray<HistoricalPatternReview>; readonly supersessions: ReadonlyArray<HistoricalPatternSupersession>; }
export interface HistoricalEventRecordHistory { readonly record: HistoricalEvent; readonly lifecycle: ReadonlyArray<HistoricalEventHistory>; readonly amendments: ReadonlyArray<HistoricalEventAmendment>; readonly reviews: ReadonlyArray<HistoricalEventReview>; }

export interface HistoricalPatternError { readonly category: HistoricalPatternErrorCategory; readonly message: string; readonly field?: string; }
export interface HistoricalPatternValidation { readonly valid: boolean; readonly errors: ReadonlyArray<HistoricalPatternError>; }
export interface HistoricalAppendResult<T> { readonly status: HistoricalAppendStatus; readonly record: T; readonly repositorySequence: number; }
export interface HistoricalPatternExportRequest { readonly exportId: string; readonly requestedAt: string; readonly query: HistoricalPatternQuery; readonly format: HistoricalExportFormat; readonly destination: HistoricalExportDestination; readonly sensitiveAuthorizationReference?: string; }
export interface HistoricalPatternExportPolicy { readonly allowExternalExports: boolean; readonly requireSensitiveAuthorization: boolean; readonly sensitiveAuthorizationReferences: ReadonlyArray<string>; }
export interface HistoricalPatternExportResult { readonly status: HistoricalExportStatus; readonly exportId: string; readonly exportedAt: string; readonly format: HistoricalExportFormat; readonly recordCount: number; readonly content?: string; readonly error?: HistoricalPatternError; }

export interface HistoricalAnalogyInputBoundary { readonly candidateEventIds: ReadonlyArray<HistoricalEventId>; readonly candidatePatternIds: ReadonlyArray<HistoricalPatternId>; readonly currentEventFeatureReferences: ReadonlyArray<string>; readonly comparisonDimensions: ReadonlyArray<string>; readonly requiredRegimeDimensions: ReadonlyArray<HistoricalRegimeType>; readonly observationHorizons: ReadonlyArray<HistoricalTimeHorizon>; readonly similarityWeightProfileReference: string; readonly excludedDimensions: ReadonlyArray<string>; readonly missingDataPolicy: "REPORT" | "EXCLUDE_CANDIDATE" | "FAIL"; readonly evidenceRequirements: ReadonlyArray<string>; }
export interface HistoricalFrozenReference { readonly recordKind: HistoricalRecordKind; readonly recordId: HistoricalEventId | HistoricalPatternId; readonly recordVersion: string; readonly frozenStatus: HistoricalEventStatus.Finalized | HistoricalEventStatus.Reviewed | HistoricalPatternStatus.Finalized | HistoricalPatternStatus.Reviewed; readonly summary: string; readonly sourceEventCount: number; readonly limitationSummaries: ReadonlyArray<string>; readonly regimeSummary?: string; readonly assetReactionIds: ReadonlyArray<string>; }

export interface HistoricalAuditRecord { readonly auditId: string; readonly operationType: HistoricalAuditOperationType; readonly sourceRecordId: string; readonly recordId?: string; readonly recordVersion?: string; readonly recordKind: HistoricalRecordKind; readonly timestamp: string; readonly status: string; readonly reasonCodes: ReadonlyArray<string>; readonly sourceReferenceIds: ReadonlyArray<string>; readonly evidenceReferenceIds: ReadonlyArray<string>; readonly privacyLevel: PrivacyLevel; readonly retention: AIAuditRetentionClassification; readonly correlationId: string; readonly traceId: string; readonly policyVersions: Readonly<Record<string, string>>; readonly metadata: AIAuditMetadata; }
export interface HistoricalAuditTranslationContext { readonly idempotencyKey: string; readonly actor: AIAuditActor; readonly parentAuditRecordIds: ReadonlyArray<string>; readonly relatedAuditRecordIds: ReadonlyArray<string>; }
export interface HistoricalAuditTranslation { readonly source: HistoricalAuditRecord; readonly input: AIAuditRecordInput; }

export interface HistoricalPatternRepository {
  appendEvent(record: HistoricalEvent, acceptedAt: string): HistoricalAppendResult<HistoricalEvent>;
  appendPattern(record: HistoricalPattern, acceptedAt: string): HistoricalAppendResult<HistoricalPattern>;
  appendEventAmendment(value: HistoricalEventAmendment, acceptedAt: string): HistoricalAppendResult<HistoricalEventAmendment>;
  appendPatternAmendment(value: HistoricalPatternAmendment, acceptedAt: string): HistoricalAppendResult<HistoricalPatternAmendment>;
  appendEventReview(value: HistoricalEventReview, history: HistoricalEventHistory, acceptedAt: string): HistoricalAppendResult<HistoricalEventReview>;
  appendPatternReview(value: HistoricalPatternReview, history: HistoricalPatternHistoryEntry, acceptedAt: string): HistoricalAppendResult<HistoricalPatternReview>;
  appendSupersession(value: HistoricalPatternSupersession, history: HistoricalPatternHistoryEntry, acceptedAt: string): HistoricalAppendResult<HistoricalPatternSupersession>;
  appendEventArchive(history: HistoricalEventHistory, acceptedAt: string): HistoricalAppendResult<HistoricalEventHistory>;
  appendPatternArchive(history: HistoricalPatternHistoryEntry, acceptedAt: string): HistoricalAppendResult<HistoricalPatternHistoryEntry>;
  getEventById(id: HistoricalEventId): HistoricalEvent | undefined;
  getPatternById(id: HistoricalPatternId): HistoricalPattern | undefined;
  getEventHistory(id: HistoricalEventId): HistoricalEventRecordHistory | undefined;
  getPatternHistory(id: HistoricalPatternId): HistoricalPatternHistory | undefined;
  queryEvents(query?: HistoricalPatternQuery): ReadonlyArray<HistoricalEvent>;
  queryPatterns(query?: HistoricalPatternQuery): ReadonlyArray<HistoricalPattern>;
  listRelatedEvents(id: HistoricalEventId): ReadonlyArray<HistoricalEvent>;
  listRelatedPatterns(id: HistoricalPatternId): ReadonlyArray<HistoricalPattern>;
}
