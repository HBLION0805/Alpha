import {
  OPTIONS_NEWS_DOMAIN_VERSION,
  NewsEventStatus,
  NewsEvidenceRelation,
  NewsImpactHypothesis,
  NewsLatencyState,
  NewsObservationStatus,
  NewsSourceTier,
  NewsSummaryProvider,
  NewsSummaryStatus,
  type CanonicalNewsEvent,
  type EventEvidenceLink,
  type NewsEvidenceRecord,
  type SummaryEnvelope,
  type VerificationTransitionRecord,
} from "../../contracts/OptionsNewsDomain";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export class OptionsNewsContractError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "OptionsNewsContractError";
  }
}

export function validateNewsEvidenceRecord(value: unknown): asserts value is NewsEvidenceRecord {
  const v = record(value, "INVALID_EVIDENCE", "evidence must be an object");
  exactKeys(v, ["domainVersion","evidenceId","providerObservationId","sourceId","sourceTier","providerId","publisherId","sourceFamily","upstreamOriginId","independenceKey","primaryDocumentFingerprint","originalHeadlineEnglish","originalUrl","originalPublishedAt","originalTimezone","publishedAtUtc","receivedAtUtc","ingestedAtUtc","normalizedAtUtc","rawPayloadHash","rawPayloadReference","entityCandidates","eventTypeCandidate","topicCandidates","keyFacts","observationStatus","adapterName","adapterVersion","providerSchemaVersion","normalizationVersion","cost","latency"], "INVALID_EVIDENCE");
  if (v.domainVersion !== OPTIONS_NEWS_DOMAIN_VERSION) fail("INVALID_EVIDENCE", "unsupported domain version");
  for (const key of ["evidenceId","providerObservationId","sourceId","providerId","publisherId","sourceFamily","independenceKey","adapterName","adapterVersion","providerSchemaVersion","normalizationVersion"] as const) id(v[key], "INVALID_EVIDENCE", key);
  if (!Object.values(NewsSourceTier).includes(v.sourceTier as NewsSourceTier)) fail("INVALID_EVIDENCE", "invalid source tier");
  nullableId(v.upstreamOriginId, "INVALID_EVIDENCE", "upstreamOriginId");
  if (v.primaryDocumentFingerprint !== null && (typeof v.primaryDocumentFingerprint !== "string" || !SHA256.test(v.primaryDocumentFingerprint))) fail("INVALID_EVIDENCE", "invalid primary document fingerprint");
  nonEmpty(v.originalHeadlineEnglish, "INVALID_EVIDENCE", "headline");
  url(v.originalUrl, "INVALID_EVIDENCE");
  nonEmpty(v.originalPublishedAt, "INVALID_EVIDENCE", "originalPublishedAt");
  nonEmpty(v.originalTimezone, "INVALID_EVIDENCE", "originalTimezone");
  for (const key of ["publishedAtUtc","receivedAtUtc","ingestedAtUtc","normalizedAtUtc"] as const) utc(v[key], "INVALID_EVIDENCE", key);
  chronological([v.publishedAtUtc, v.receivedAtUtc, v.ingestedAtUtc, v.normalizedAtUtc], "INVALID_EVIDENCE");
  if (typeof v.rawPayloadHash !== "string" || !SHA256.test(v.rawPayloadHash)) fail("INVALID_EVIDENCE", "invalid raw payload hash");
  nonEmpty(v.rawPayloadReference, "INVALID_EVIDENCE", "rawPayloadReference");
  if (!Array.isArray(v.entityCandidates) || !Array.isArray(v.topicCandidates)) fail("INVALID_EVIDENCE", "candidate arrays required");
  for (const candidate of v.entityCandidates) {
    const entity = record(candidate, "INVALID_EVIDENCE", "entity candidate must be an object");
    exactKeys(entity, ["entityId","symbol","alias","mappingSource","mappingVersion","effectiveFromUtc","effectiveToUtc"], "INVALID_EVIDENCE");
    for (const key of ["entityId","symbol","mappingSource","mappingVersion"] as const) id(entity[key], "INVALID_EVIDENCE", `entity.${key}`);
    nonEmpty(entity.alias, "INVALID_EVIDENCE", "entity.alias"); utc(entity.effectiveFromUtc, "INVALID_EVIDENCE", "entity.effectiveFromUtc"); if (entity.effectiveToUtc !== null) utc(entity.effectiveToUtc, "INVALID_EVIDENCE", "entity.effectiveToUtc");
  }
  if (!v.topicCandidates.every((topic) => ["TECH","GOLD","TREASURY"].includes(String(topic))) || new Set(v.topicCandidates).size !== v.topicCandidates.length) fail("INVALID_EVIDENCE", "topic candidates are invalid or duplicated");
  if (!Object.values(NewsObservationStatus).includes(v.observationStatus as NewsObservationStatus)) fail("INVALID_EVIDENCE", "invalid observation status");
  nonEmpty(v.eventTypeCandidate, "INVALID_EVIDENCE", "eventTypeCandidate");
  const facts = record(v.keyFacts, "INVALID_EVIDENCE", "keyFacts required"); if (Object.keys(facts).length === 0 || !Object.values(facts).every((fact) => typeof fact === "string" && fact.length > 0)) fail("INVALID_EVIDENCE", "key facts require non-empty string values");
  const cost = record(v.cost, "INVALID_EVIDENCE", "cost required");
  exactKeys(cost, ["currency","estimatedMinorUnits","actualMinorUnits","simulated"], "INVALID_EVIDENCE");
  if (cost.currency !== "USD" || cost.simulated !== true || !nonNegativeInteger(cost.estimatedMinorUnits) || !nonNegativeInteger(cost.actualMinorUnits)) fail("INVALID_EVIDENCE", "cost must be simulated non-negative USD minor units");
  validateLatency(v.latency);
}

export function validateCanonicalNewsEvent(value: unknown): asserts value is CanonicalNewsEvent {
  const v = record(value, "INVALID_EVENT", "event must be an object");
  exactKeys(v, ["domainVersion","eventId","canonicalFingerprint","fingerprintAlgorithm","fingerprintVersion","canonicalFacts","linkedEntities","symbols","topics","eventType","novelty","relevance","impactHypothesis","verificationStatus","verificationConfidence","supportingEvidenceIds","conflictingEvidenceIds","retractingEvidenceIds","discoveredAtUtc","normalizedAtUtc","verificationStartedAtUtc","verifiedAtUtc","displayTimezone","summary","currentStateReasonCode"], "INVALID_EVENT");
  for (const key of ["eventId","canonicalFingerprint","fingerprintAlgorithm","fingerprintVersion","eventType","currentStateReasonCode"] as const) nonEmpty(v[key], "INVALID_EVENT", key);
  if (v.domainVersion !== OPTIONS_NEWS_DOMAIN_VERSION || v.fingerprintAlgorithm !== "SHA-256" || typeof v.canonicalFingerprint !== "string" || !SHA256.test(v.canonicalFingerprint)) fail("INVALID_EVENT", "invalid event identity");
  if (!Object.values(NewsEventStatus).includes(v.verificationStatus as NewsEventStatus) || !Object.values(NewsImpactHypothesis).includes(v.impactHypothesis as NewsImpactHypothesis)) fail("INVALID_EVENT", "invalid event state");
  if (typeof v.verificationConfidence !== "number" || v.verificationConfidence < 0 || v.verificationConfidence > 1) fail("INVALID_EVENT", "verification confidence out of range");
  for (const key of ["supportingEvidenceIds","conflictingEvidenceIds","retractingEvidenceIds","linkedEntities","symbols","topics"] as const) if (!Array.isArray(v[key])) fail("INVALID_EVENT", `${key} must be an array`);
  for (const key of ["discoveredAtUtc","normalizedAtUtc","verificationStartedAtUtc"] as const) utc(v[key], "INVALID_EVENT", key);
  if (v.verifiedAtUtc !== null) utc(v.verifiedAtUtc, "INVALID_EVENT", "verifiedAtUtc");
  if (v.verificationStatus === NewsEventStatus.Verified && v.verifiedAtUtc === null) fail("INVALID_EVENT", "verified event requires verifiedAtUtc");
  if (v.displayTimezone !== "America/New_York") fail("INVALID_EVENT", "display timezone must be America/New_York");
  validateSummary(v.summary);
}

export function validateEventEvidenceLink(value: unknown): asserts value is EventEvidenceLink {
  const v = record(value, "INVALID_LINK", "link must be an object");
  exactKeys(v, ["domainVersion","linkId","eventId","evidenceId","relation","relationshipReasonCode","checkedFacts","createdAtUtc","ruleVersion"], "INVALID_LINK");
  for (const key of ["linkId","eventId","evidenceId","relationshipReasonCode","ruleVersion"] as const) id(v[key], "INVALID_LINK", key);
  if (v.domainVersion !== OPTIONS_NEWS_DOMAIN_VERSION || !Object.values(NewsEvidenceRelation).includes(v.relation as NewsEvidenceRelation) || !Array.isArray(v.checkedFacts)) fail("INVALID_LINK", "invalid evidence link");
  utc(v.createdAtUtc, "INVALID_LINK", "createdAtUtc");
}

export function validateTransition(value: unknown): asserts value is VerificationTransitionRecord {
  const v = record(value, "INVALID_TRANSITION", "transition must be an object");
  exactKeys(v, ["domainVersion","transitionId","eventId","fromState","toState","transitionReasonCode","triggeringEvidenceIds","occurredAtUtc","verificationRuleVersion","deterministicActor"], "INVALID_TRANSITION");
  for (const key of ["transitionId","eventId","transitionReasonCode","verificationRuleVersion","deterministicActor"] as const) id(v[key], "INVALID_TRANSITION", key);
  if (v.domainVersion !== OPTIONS_NEWS_DOMAIN_VERSION || (v.fromState !== null && !Object.values(NewsEventStatus).includes(v.fromState as NewsEventStatus)) || !Object.values(NewsEventStatus).includes(v.toState as NewsEventStatus) || !Array.isArray(v.triggeringEvidenceIds)) fail("INVALID_TRANSITION", "invalid transition state");
  utc(v.occurredAtUtc, "INVALID_TRANSITION", "occurredAtUtc");
}

export function validateSummary(value: unknown): asserts value is SummaryEnvelope {
  const v = record(value, "INVALID_SUMMARY", "summary must be an object");
  exactKeys(v, ["chineseSummary","summaryStatus","summaryProvider","providerModelId","algorithmVersion","inputEvidenceIds","generatedAtUtc","validationResult"], "INVALID_SUMMARY");
  if (!Object.values(NewsSummaryStatus).includes(v.summaryStatus as NewsSummaryStatus) || !Object.values(NewsSummaryProvider).includes(v.summaryProvider as NewsSummaryProvider) || !Array.isArray(v.inputEvidenceIds)) fail("INVALID_SUMMARY", "invalid summary metadata");
  if (v.summaryStatus === NewsSummaryStatus.Generated && (typeof v.chineseSummary !== "string" || v.chineseSummary.trim().length === 0 || v.validationResult !== "VALID")) fail("INVALID_SUMMARY", "generated summary must contain validated text");
  if (v.summaryStatus !== NewsSummaryStatus.Generated && v.chineseSummary !== null) fail("INVALID_SUMMARY", "failed or unavailable summary cannot contain text");
  nonEmpty(v.algorithmVersion, "INVALID_SUMMARY", "algorithmVersion");
  utc(v.generatedAtUtc, "INVALID_SUMMARY", "generatedAtUtc");
}

export function validateLatency(value: unknown): void {
  const v = record(value, "INVALID_LATENCY", "latency must be an object");
  exactKeys(v, ["state","reasonCode","publishToProviderReceiveMs","providerReceiveToIngestMs","ingestToNormalizeMs","normalizeToVerifyMs","publishToVerifyMs"], "INVALID_LATENCY");
  if (!Object.values(NewsLatencyState).includes(v.state as NewsLatencyState)) fail("INVALID_LATENCY", "invalid state");
  for (const key of ["publishToProviderReceiveMs","providerReceiveToIngestMs","ingestToNormalizeMs","normalizeToVerifyMs","publishToVerifyMs"] as const) if (v[key] !== null && !nonNegativeInteger(v[key])) fail("INVALID_LATENCY", `${key} must be null or non-negative integer`);
  if (v.state === NewsLatencyState.Unmeasured && (typeof v.reasonCode !== "string" || v.reasonCode.length === 0)) fail("INVALID_LATENCY", "unmeasured latency requires reason");
}

function exactKeys(v: Record<string, unknown>, keys: readonly string[], code: string): void { const expected = [...keys].sort(); const actual = Object.keys(v).sort(); if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code, "unknown or missing fields"); }
function chronological(values: readonly unknown[], code: string): void { const times = values.map((value) => Date.parse(value as string)); for (let i = 1; i < times.length; i += 1) if ((times[i] as number) < (times[i - 1] as number)) fail(code, "timestamps are not chronological"); }
function url(value: unknown, code: string): void { try { const parsed = new URL(String(value)); if (parsed.protocol !== "https:") fail(code, "URL must use HTTPS"); } catch { fail(code, "invalid URL"); } }
function utc(value: unknown, code: string, field: string): void { if (typeof value !== "string" || !value.endsWith("Z") || Number.isNaN(Date.parse(value))) fail(code, `${field} must be UTC ISO-8601`); }
function id(value: unknown, code: string, field: string): asserts value is string { if (typeof value !== "string" || !ID.test(value)) fail(code, `${field} is invalid`); }
function nullableId(value: unknown, code: string, field: string): void { if (value !== null) id(value, code, field); }
function nonEmpty(value: unknown, code: string, field: string): asserts value is string { if (typeof value !== "string" || value.trim().length === 0) fail(code, `${field} is required`); }
function nonNegativeInteger(value: unknown): boolean { return Number.isSafeInteger(value) && (value as number) >= 0; }
function record(value: unknown, code: string, message: string): Record<string, unknown> { if (typeof value !== "object" || value === null || Array.isArray(value)) fail(code, message); return value as Record<string, unknown>; }
function fail(code: string, message: string): never { throw new OptionsNewsContractError(code, message); }
