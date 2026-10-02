export type EventIntelligenceCaseType = "SCHEDULED" | "UNSCHEDULED";

export type EventIntelligenceEvidenceKind =
  | "EXPECTATION_SNAPSHOT"
  | "PRE_EVENT_STATE"
  | "SOURCE_OBSERVATION"
  | "CORRECTION"
  | "INTERPRETATION"
  | "HYPOTHESIS"
  | "MARKET_OBSERVATION"
  | "SOURCE_STATUS";

export type EvidenceAvailability = "CURRENT" | "STALE" | "MISSING" | "UNKNOWN";
export type ThesisState = "MAINTAIN" | "DEGRADE" | "INVALIDATE" | "UNEVALUABLE";
export type EvidenceCompleteness = "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
export type MarketSession = "REGULAR" | "PREMARKET" | "AFTER_HOURS" | "TWENTY_FOUR_SEVEN" | "UNKNOWN";
export type MarketComparability = "COMPARABLE" | "LIMITED" | "NOT_COMPARABLE";
export type EventArrivalOrder = "PRICE_LEADS_NEWS" | "NEWS_LEADS_PRICE" | "SIMULTANEOUS_WITHIN_CLOCK_RESOLUTION" | "ORDER_UNKNOWN";
export type EventExpectationType = "CONSENSUS" | "SINGLE_FORECAST" | "MODEL_ESTIMATE" | "MARKET_IMPLIED" | "OWNER_EXPECTATION" | "UNKNOWN";
export type EventExpectationStage = "RESEARCH" | "FINAL_PRE_ENTRY";

export interface MarketObservationMetadata {
  readonly detectedMovement?: { readonly detectedAt: string; readonly ruleVersion: string } | null;
  readonly instrument: string;
  readonly quoteObservedAt: string;
  readonly declaredDelayMs: number | null;
  readonly session: MarketSession;
  readonly comparability: MarketComparability;
  readonly comparabilityReason: string;
}

export interface EventExpectationRow {
  readonly id: string;
  readonly metric: string;
  readonly period: string;
  readonly unit: string;
  readonly adjustment: string;
  readonly releaseVersion: string;
  readonly valueMeaning: string;
  readonly expectationType: EventExpectationType;
  readonly value: string | null;
  readonly selected: boolean;
  readonly source: string;
  readonly sourcePublishedAt: string | null;
  readonly sourceReceivedAt: string;
  readonly methodology: string;
  readonly sampleInfo: string | null;
}

export interface EventExpectationSnapshot {
  readonly stage: EventExpectationStage;
  readonly ownerConfirmed: boolean;
  readonly rows: readonly EventExpectationRow[];
}

export interface EventIntelligenceEvidence {
  readonly evidenceId: string;
  readonly eventId: string;
  readonly kind: EventIntelligenceEvidenceKind;
  readonly sourceId: string;
  readonly sourceUrl: string | null;
  readonly occurredAt: string | null;
  readonly sourcePublishedAt: string | null;
  readonly vendorReceivedAt: string | null;
  readonly receivedAt: string;
  readonly parsedAt: string | null;
  readonly availability: EvidenceAvailability;
  readonly summary: string;
  readonly supersedesEvidenceId: string | null;
  readonly expectationSnapshot: EventExpectationSnapshot | null;
  readonly marketObservation: MarketObservationMetadata | null;
}
export interface HistoricalDecisionArtifact {
  readonly decisionId: string;
  readonly eventId: string;
  readonly generatedAt: string;
  readonly evidenceCutoffAt: string;
  readonly inputEvidenceIds: readonly string[];
  readonly decisionVersion: string;
  readonly ruleVersion: string;
  readonly modelVersion: string;
  readonly thesisVersion: string;
  readonly thesisState: ThesisState;
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly reason: string;
  readonly blockers: readonly string[];
}

export interface RecomputedDecisionArtifact extends HistoricalDecisionArtifact {
  readonly recomputedAt: string;
  readonly replacesHistoricalDecision: false;
}

export type InvalidationOperator = "GT" | "GTE" | "LT" | "LTE";

export interface NumericInvalidationRule {
  readonly ruleId: string;
  readonly thesisVersion: string;
  readonly definedAt: string;
  readonly metric: string;
  readonly sourceId: string;
  readonly operator: InvalidationOperator;
  readonly threshold: number;
  readonly windowSeconds: number;
  readonly requiredObservations: number;
  readonly observationIntervalSeconds: number;
}
export interface EventIntelligenceCase {
  readonly eventId: string;
  readonly caseType: EventIntelligenceCaseType;
  readonly title: string;
  readonly eventTime: string | null;
  readonly createdAt: string;
  readonly evidence: readonly EventIntelligenceEvidence[];
  readonly historicalDecisions: readonly HistoricalDecisionArtifact[];
  readonly recomputedDecisions: readonly RecomputedDecisionArtifact[];
  readonly invalidationRules: readonly NumericInvalidationRule[];
  readonly requiredEvidenceIds: readonly string[];
}

export interface PointInTimeReplayView {
  readonly eventId: string;
  readonly asOf: string;
  readonly visibleEvidence: readonly EventIntelligenceEvidence[];
  readonly hiddenFutureEvidenceCount: number;
  readonly visibleHistoricalDecisions: readonly HistoricalDecisionArtifact[];
  readonly hiddenFutureDecisionCount: number;
  readonly latestHistoricalDecision: HistoricalDecisionArtifact | null;
  readonly recomputedDecisions: readonly RecomputedDecisionArtifact[];
  readonly hiddenFutureRecomputedDecisionCount: number;
  readonly evidenceCompleteness: EvidenceCompleteness;
  readonly unavailableRequiredEvidenceIds: readonly string[];
  readonly unseenRequiredEvidenceCount: number;
  readonly thesisState: ThesisState | null;
  readonly arrivalOrder: EventArrivalOrder;
  readonly executionAllowed: false;
}

export interface NumericObservation {
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly metric: string;
  readonly sourceId: string;
  readonly value: number;
}
