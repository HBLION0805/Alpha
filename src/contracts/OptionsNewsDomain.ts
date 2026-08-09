export const OPTIONS_NEWS_DOMAIN_VERSION = "1.0" as const;

export enum NewsSourceTier { Tier0 = "TIER_0", Tier1 = "TIER_1", Tier2 = "TIER_2", Tier3 = "TIER_3" }
export enum NewsObservationStatus { Received = "RECEIVED", Validated = "VALIDATED", Invalid = "INVALID", Normalized = "NORMALIZED", Unique = "UNIQUE", Duplicate = "DUPLICATE" }
export enum NewsEventStatus { Discovered = "DISCOVERED", Normalized = "NORMALIZED", Verifying = "VERIFYING", Verified = "VERIFIED", Conflicted = "CONFLICTED", Unavailable = "UNAVAILABLE", Retracted = "RETRACTED", Expired = "EXPIRED" }
export enum NewsEvidenceRelation { Supports = "SUPPORTS", Conflicts = "CONFLICTS", Retracts = "RETRACTS", Duplicates = "DUPLICATES", CitesPrimary = "CITES_PRIMARY" }
export enum NewsImpactHypothesis { Positive = "POSITIVE", Negative = "NEGATIVE", Mixed = "MIXED", Unknown = "UNKNOWN" }
export enum NewsSummaryStatus { Generated = "GENERATED", Unavailable = "UNAVAILABLE", FailedValidation = "FAILED_VALIDATION" }
export enum NewsSummaryProvider { Fixture = "FIXTURE", Deterministic = "DETERMINISTIC", Llm = "LLM" }
export enum NewsLatencyState { Measured = "MEASURED", Unmeasured = "UNMEASURED", SlaNotMet = "SLA_NOT_MET" }
export type NewsTopic = "TECH" | "GOLD" | "TREASURY";

export interface NewsEntityCandidate {
  readonly entityId: string;
  readonly symbol: string;
  readonly alias: string;
  readonly mappingSource: string;
  readonly mappingVersion: string;
  readonly effectiveFromUtc: string;
  readonly effectiveToUtc: string | null;
}

export interface NewsLatencyMeasurement {
  readonly state: NewsLatencyState;
  readonly reasonCode: string | null;
  readonly publishToProviderReceiveMs: number | null;
  readonly providerReceiveToIngestMs: number | null;
  readonly ingestToNormalizeMs: number | null;
  readonly normalizeToVerifyMs: number | null;
  readonly publishToVerifyMs: number | null;
}

export interface NewsCostMetadata {
  readonly currency: "USD";
  readonly estimatedMinorUnits: number;
  readonly actualMinorUnits: number;
  readonly simulated: true;
}

/** Immutable source observation. Duplicate observations remain auditable. */
export interface NewsEvidenceRecord {
  readonly domainVersion: typeof OPTIONS_NEWS_DOMAIN_VERSION;
  readonly evidenceId: string;
  readonly providerObservationId: string;
  readonly sourceId: string;
  readonly sourceTier: NewsSourceTier;
  readonly providerId: string;
  readonly publisherId: string;
  readonly sourceFamily: string;
  readonly upstreamOriginId: string | null;
  readonly independenceKey: string;
  readonly primaryDocumentFingerprint: string | null;
  readonly originalHeadlineEnglish: string;
  readonly originalUrl: string;
  readonly originalPublishedAt: string;
  readonly originalTimezone: string;
  readonly publishedAtUtc: string;
  readonly receivedAtUtc: string;
  readonly ingestedAtUtc: string;
  readonly normalizedAtUtc: string;
  readonly rawPayloadHash: string;
  readonly rawPayloadReference: string;
  readonly entityCandidates: readonly NewsEntityCandidate[];
  readonly eventTypeCandidate: string;
  readonly topicCandidates: readonly NewsTopic[];
  readonly keyFacts: Readonly<Record<string, string>>;
  readonly observationStatus: NewsObservationStatus;
  readonly adapterName: string;
  readonly adapterVersion: string;
  readonly providerSchemaVersion: string;
  readonly normalizationVersion: string;
  readonly cost: NewsCostMetadata;
  readonly latency: NewsLatencyMeasurement;
}

export interface SummaryEnvelope {
  readonly chineseSummary: string | null;
  readonly summaryStatus: NewsSummaryStatus;
  readonly summaryProvider: NewsSummaryProvider;
  readonly providerModelId: string | null;
  readonly algorithmVersion: string;
  readonly inputEvidenceIds: readonly string[];
  readonly generatedAtUtc: string;
  readonly validationResult: "VALID" | "INVALID" | "UNAVAILABLE";
}

export interface CanonicalNewsEvent {
  readonly domainVersion: typeof OPTIONS_NEWS_DOMAIN_VERSION;
  readonly eventId: string;
  readonly canonicalFingerprint: string;
  readonly fingerprintAlgorithm: "SHA-256";
  readonly fingerprintVersion: string;
  readonly canonicalFacts: Readonly<Record<string, string>>;
  readonly linkedEntities: readonly NewsEntityCandidate[];
  readonly symbols: readonly string[];
  readonly topics: readonly NewsTopic[];
  readonly eventType: string;
  readonly novelty: "NEW" | "UPDATE" | "UNKNOWN";
  readonly relevance: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  readonly impactHypothesis: NewsImpactHypothesis;
  readonly verificationStatus: NewsEventStatus;
  readonly verificationConfidence: number;
  readonly supportingEvidenceIds: readonly string[];
  readonly conflictingEvidenceIds: readonly string[];
  readonly retractingEvidenceIds: readonly string[];
  readonly discoveredAtUtc: string;
  readonly normalizedAtUtc: string;
  readonly verificationStartedAtUtc: string;
  readonly verifiedAtUtc: string | null;
  readonly displayTimezone: "America/New_York";
  readonly summary: SummaryEnvelope;
  readonly currentStateReasonCode: string;
}

export interface EventEvidenceLink {
  readonly domainVersion: typeof OPTIONS_NEWS_DOMAIN_VERSION;
  readonly linkId: string;
  readonly eventId: string;
  readonly evidenceId: string;
  readonly relation: NewsEvidenceRelation;
  readonly relationshipReasonCode: string;
  readonly checkedFacts: readonly string[];
  readonly createdAtUtc: string;
  readonly ruleVersion: string;
}

export interface VerificationTransitionRecord {
  readonly domainVersion: typeof OPTIONS_NEWS_DOMAIN_VERSION;
  readonly transitionId: string;
  readonly eventId: string;
  readonly fromState: NewsEventStatus | null;
  readonly toState: NewsEventStatus;
  readonly transitionReasonCode: string;
  readonly triggeringEvidenceIds: readonly string[];
  readonly occurredAtUtc: string;
  readonly verificationRuleVersion: string;
  readonly deterministicActor: string;
}
