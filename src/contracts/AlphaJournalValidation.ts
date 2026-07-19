import {
  AlphaJournalAmendmentType,
  AlphaJournalAuthorType,
  AlphaJournalEntryType,
  AlphaJournalErrorCategory,
  AlphaJournalQuality,
  AlphaJournalReferenceResolution,
  AlphaJournalReferenceType,
  AlphaJournalStatus,
  DEFAULT_ALPHA_JOURNAL_LIFECYCLE,
  type AlphaJournalAmendment,
  type AlphaJournalContent,
  type AlphaJournalEntry,
  type AlphaJournalEntrySnapshot,
  type AlphaJournalError,
  type AlphaJournalEvidenceReference,
  type AlphaJournalHistory,
  type AlphaJournalQuery,
  type AlphaJournalReview,
  type AlphaJournalValidation,
} from "./AlphaJournal";
import { AIAuditRetentionClassification } from "./AIAuditRepository";
import { PrivacyLevel } from "./AIRouter";
import {
  PredictionAccuracy,
  PredictionProfitability,
} from "./PredictionRecord";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SECRET_KEY_PATTERN = /(api.?key|secret|password|credential|authorization|bearer|private.?key|access.?token)/i;

export function canonicalizeAlphaJournalValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return '"[Undefined]"';
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(`[${String(value)}]`);
  }
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeAlphaJournalValue).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeAlphaJournalValue(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function createAlphaJournalEntryId(snapshot: AlphaJournalEntrySnapshot): string {
  const identity: AlphaJournalEntrySnapshot = {
    schemaVersion: snapshot.schemaVersion,
    createdAt: snapshot.createdAt,
    eventTimestamp: snapshot.eventTimestamp,
    entryType: snapshot.entryType,
    title: snapshot.title,
    content: snapshot.content,
    ...(snapshot.confidence === undefined ? {} : { confidence: snapshot.confidence }),
    ...(snapshot.market === undefined ? {} : { market: snapshot.market }),
    ...(snapshot.ticker === undefined ? {} : { ticker: snapshot.ticker }),
    ...(snapshot.asset === undefined ? {} : { asset: snapshot.asset }),
    tags: snapshot.tags,
    ownerReference: snapshot.ownerReference,
    authorType: snapshot.authorType,
    privacyLevel: snapshot.privacyLevel,
    retention: snapshot.retention,
    evidence: snapshot.evidence,
    context: snapshot.context,
    correlationId: snapshot.correlationId,
    traceId: snapshot.traceId,
    metadata: snapshot.metadata,
  };
  return `journal:${fnv1a64(canonicalizeAlphaJournalValue(identity))}`;
}

export function alphaJournalFingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalizeAlphaJournalValue(value))}`;
}

function add(
  errors: AlphaJournalError[],
  category: AlphaJournalErrorCategory,
  message: string,
  field?: string,
): void {
  errors.push(field === undefined ? { category, message } : { category, message, field });
}

function nonEmpty(errors: AlphaJournalError[], field: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    add(errors, AlphaJournalErrorCategory.InvalidEntry, `${field} must be non-empty.`, field);
  }
}

function identifier(errors: AlphaJournalError[], field: string, value: string): void {
  nonEmpty(errors, field, value);
  if (typeof value === "string" && !ID_PATTERN.test(value)) {
    add(errors, AlphaJournalErrorCategory.InvalidId, `${field} contains unsupported characters.`, field);
  }
}

function timestamp(
  errors: AlphaJournalError[],
  field: string,
  value: string,
  now: string,
): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    add(errors, AlphaJournalErrorCategory.InvalidTimestamp, `${field} must be an ISO-8601 timestamp with timezone.`, field);
  } else if (parsed > Date.parse(now)) {
    add(errors, AlphaJournalErrorCategory.FutureTimestamp, `${field} cannot be in the future.`, field);
  }
}

function strings(errors: AlphaJournalError[], field: string, values: ReadonlyArray<string>): void {
  if (!Array.isArray(values)) {
    add(errors, AlphaJournalErrorCategory.InvalidEntry, `${field} must be an array.`, field);
    return;
  }
  for (const value of values) nonEmpty(errors, field, value);
  if (new Set(values).size !== values.length) {
    add(errors, AlphaJournalErrorCategory.InvalidEntry, `${field} contains duplicate values.`, field);
  }
}

function validateContent(
  content: AlphaJournalContent,
  errors: AlphaJournalError[],
  field = "content",
): void {
  strings(errors, `${field}.factualObservations`, content.factualObservations);
  strings(errors, `${field}.assumptions`, content.assumptions);
  strings(errors, `${field}.riskNotes`, content.riskNotes);
  for (const [name, value] of [
    ["interpretation", content.interpretation],
    ["uncertainty", content.uncertainty],
    ["decisionRationale", content.decisionRationale],
    ["plannedAction", content.plannedAction],
    ["expectedOutcome", content.expectedOutcome],
  ] as const) {
    if (typeof value !== "string") add(errors, AlphaJournalErrorCategory.InvalidEntry, `${field}.${name} must be a string.`, `${field}.${name}`);
  }
  if (content.actualActionReference !== undefined) identifier(errors, `${field}.actualActionReference`, content.actualActionReference);
  const substantive = [
    ...content.factualObservations,
    content.interpretation,
    ...content.assumptions,
    content.uncertainty,
    content.decisionRationale,
    content.plannedAction,
    content.actualActionReference ?? "",
    content.expectedOutcome,
    ...content.riskNotes,
  ].some((value) => value.trim().length > 0);
  if (!substantive) add(errors, AlphaJournalErrorCategory.EmptyContent, "authoritative journal content cannot be empty.", field);
}

function validateReference(
  reference: AlphaJournalEvidenceReference,
  errors: AlphaJournalError[],
  field: string,
): void {
  identifier(errors, `${field}.referenceId`, reference.referenceId);
  if (!Object.values(AlphaJournalReferenceType).includes(reference.recordType)) {
    add(errors, AlphaJournalErrorCategory.InvalidReference, `${field}.recordType is invalid.`, `${field}.recordType`);
  }
  if (!Object.values(AlphaJournalReferenceResolution).includes(reference.resolution)) {
    add(errors, AlphaJournalErrorCategory.InvalidReference, `${field}.resolution is invalid.`, `${field}.resolution`);
  }
  if (reference.version !== undefined) identifier(errors, `${field}.version`, reference.version);
}

function validateReferences(snapshot: AlphaJournalEntrySnapshot, errors: AlphaJournalError[]): void {
  const groups: ReadonlyArray<readonly [string, ReadonlyArray<AlphaJournalEvidenceReference>, AlphaJournalReferenceType]> = [
    ["evidence.predictions", snapshot.evidence.predictions, AlphaJournalReferenceType.Prediction],
    ["evidence.research", snapshot.evidence.research, AlphaJournalReferenceType.Research],
    ["evidence.decisions", snapshot.evidence.decisions, AlphaJournalReferenceType.Decision],
    ["evidence.trades", snapshot.evidence.trades, AlphaJournalReferenceType.Trade],
    ["evidence.strategies", snapshot.evidence.strategies, AlphaJournalReferenceType.Strategy],
    ["evidence.portfolios", snapshot.evidence.portfolios, AlphaJournalReferenceType.Portfolio],
    ["evidence.audits", snapshot.evidence.audits, AlphaJournalReferenceType.Audit],
    ["evidence.journalEntries", snapshot.evidence.journalEntries, AlphaJournalReferenceType.Journal],
    ["evidence.developmentValidations", snapshot.evidence.developmentValidations, AlphaJournalReferenceType.DevelopmentValidation],
  ];
  for (const [field, references, expectedType] of groups) {
    const identities = new Set<string>();
    for (const reference of references) {
      validateReference(reference, errors, field);
      if (reference.recordType !== expectedType) add(errors, AlphaJournalErrorCategory.InvalidReference, `${field} contains a mismatched typed reference.`, field);
      const identity = `${reference.recordType}:${reference.referenceId}:${reference.version ?? ""}`;
      if (identities.has(identity)) add(errors, AlphaJournalErrorCategory.InvalidReference, `${field} contains a duplicate reference.`, field);
      identities.add(identity);
    }
  }
}

function validateMetadata(snapshot: AlphaJournalEntrySnapshot, errors: AlphaJournalError[]): void {
  for (const [key, value] of Object.entries(snapshot.metadata)) {
    identifier(errors, "metadata key", key);
    if (SECRET_KEY_PATTERN.test(key)) add(errors, AlphaJournalErrorCategory.SecretMetadata, "secret-bearing metadata keys are prohibited.", `metadata.${key}`);
    if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isSafeInteger(value))) {
      add(errors, AlphaJournalErrorCategory.InvalidEntry, "metadata values must be scalar and finite.", `metadata.${key}`);
    }
  }
}

export function validateAlphaJournalSnapshot(
  snapshot: AlphaJournalEntrySnapshot,
  now: string,
): AlphaJournalValidation {
  const errors: AlphaJournalError[] = [];
  if (snapshot.schemaVersion !== "1.0") add(errors, AlphaJournalErrorCategory.InvalidEntry, "schemaVersion must be 1.0.", "schemaVersion");
  timestamp(errors, "createdAt", snapshot.createdAt, now);
  timestamp(errors, "eventTimestamp", snapshot.eventTimestamp, now);
  if (!Object.values(AlphaJournalEntryType).includes(snapshot.entryType)) add(errors, AlphaJournalErrorCategory.InvalidEntry, "entryType is invalid.", "entryType");
  nonEmpty(errors, "title", snapshot.title);
  validateContent(snapshot.content, errors);
  if (snapshot.confidence !== undefined && (!Number.isFinite(snapshot.confidence) || snapshot.confidence < 0 || snapshot.confidence > 100)) {
    add(errors, AlphaJournalErrorCategory.InvalidEntry, "confidence must be between 0 and 100.", "confidence");
  }
  for (const [field, value] of [["market", snapshot.market], ["ticker", snapshot.ticker], ["asset", snapshot.asset]] as const) {
    if (value !== undefined) nonEmpty(errors, field, value);
  }
  strings(errors, "tags", snapshot.tags);
  identifier(errors, "ownerReference", snapshot.ownerReference);
  identifier(errors, "correlationId", snapshot.correlationId);
  identifier(errors, "traceId", snapshot.traceId);
  if (!Object.values(AlphaJournalAuthorType).includes(snapshot.authorType)) add(errors, AlphaJournalErrorCategory.InvalidEntry, "authorType is invalid.", "authorType");
  if (!Object.values(PrivacyLevel).includes(snapshot.privacyLevel) || snapshot.privacyLevel === PrivacyLevel.Public) {
    add(errors, AlphaJournalErrorCategory.InvalidPrivacy, "journal evidence cannot default to PUBLIC privacy.", "privacyLevel");
  }
  if (!Object.values(AIAuditRetentionClassification).includes(snapshot.retention)) add(errors, AlphaJournalErrorCategory.InvalidEntry, "retention is invalid.", "retention");
  validateReferences(snapshot, errors);
  validateMetadata(snapshot, errors);
  const context = snapshot.context;
  timestamp(errors, "context.capturedAt", context.capturedAt, now);
  if (context.marketTimestamp !== undefined) timestamp(errors, "context.marketTimestamp", context.marketTimestamp, now);
  if (context.marketTimestamp !== undefined && Date.parse(context.marketTimestamp) > Date.parse(context.capturedAt)) {
    add(errors, AlphaJournalErrorCategory.InvalidTimestamp, "marketTimestamp cannot be after context capture.", "context.marketTimestamp");
  }
  for (const [key, value] of Object.entries(context.sourceDataTimestamps)) {
    identifier(errors, "context.sourceDataTimestamps key", key);
    timestamp(errors, `context.sourceDataTimestamps.${key}`, value, now);
  }
  for (const [key, value] of Object.entries(context.policyVersions)) {
    identifier(errors, "context.policyVersions key", key);
    identifier(errors, `context.policyVersions.${key}`, value);
  }
  nonEmpty(errors, "context.ownerDecisionState", context.ownerDecisionState);
  if (context.opportunityScore !== undefined) {
    identifier(errors, "context.opportunityScore.opportunityId", context.opportunityScore.opportunityId);
    identifier(errors, "context.opportunityScore.policyVersion", context.opportunityScore.policyVersion);
    if (!Number.isFinite(context.opportunityScore.score) || context.opportunityScore.score < 0 || context.opportunityScore.score > 100) {
      add(errors, AlphaJournalErrorCategory.InvalidEntry, "opportunity score must be between 0 and 100.", "context.opportunityScore.score");
    }
  }
  if (context.riskSnapshot !== undefined) {
    identifier(errors, "context.riskSnapshot.riskAssessmentId", context.riskSnapshot.riskAssessmentId);
    identifier(errors, "context.riskSnapshot.policyVersion", context.riskSnapshot.policyVersion);
  }
  if (context.aiContribution !== undefined) {
    identifier(errors, "context.aiContribution.routingDecisionId", context.aiContribution.routingDecisionId);
    identifier(errors, "context.aiContribution.modelId", context.aiContribution.modelId);
  }
  return { valid: errors.length === 0, errors };
}

export function validateAlphaJournalEntry(entry: AlphaJournalEntry, now: string): AlphaJournalValidation {
  const base = validateAlphaJournalSnapshot(entry, now);
  const errors = [...base.errors];
  identifier(errors, "entryId", entry.entryId);
  if (entry.entryId !== createAlphaJournalEntryId(entry)) add(errors, AlphaJournalErrorCategory.InvalidId, "entryId does not match deterministic snapshot content.", "entryId");
  if (entry.status !== AlphaJournalStatus.Finalized || entry.history.length !== 1) {
    add(errors, AlphaJournalErrorCategory.InvalidLifecycle, "new authoritative entries must begin FINALIZED with one history record.", "status");
  }
  const initial = entry.history[0];
  if (initial !== undefined && (initial.entryId !== entry.entryId || initial.lifecycleSequence !== 1 || initial.fromStatus !== AlphaJournalStatus.Draft || initial.toStatus !== AlphaJournalStatus.Finalized)) {
    add(errors, AlphaJournalErrorCategory.InvalidLifecycle, "initial lifecycle history is invalid.", "history");
  }
  if (entry.evidence.journalEntries.some((reference) => reference.referenceId === entry.entryId)) {
    add(errors, AlphaJournalErrorCategory.InvalidReference, "journal entries cannot reference themselves.", "evidence.journalEntries");
  }
  return { valid: errors.length === 0, errors };
}

export function validateAlphaJournalHistory(
  history: AlphaJournalHistory,
  entry: AlphaJournalEntry,
  now: string,
): AlphaJournalValidation {
  const errors: AlphaJournalError[] = [];
  identifier(errors, "historyId", history.historyId);
  if (history.entryId !== entry.entryId || history.lifecycleSequence !== entry.history.length + 1 || history.fromStatus !== entry.status || !DEFAULT_ALPHA_JOURNAL_LIFECYCLE.allowedTransitions[entry.status].includes(history.toStatus)) {
    add(errors, AlphaJournalErrorCategory.InvalidLifecycle, "journal lifecycle transition is invalid.");
  }
  timestamp(errors, "history.occurredAt", history.occurredAt, now);
  if (Date.parse(history.occurredAt) < Date.parse(entry.history[entry.history.length - 1]?.occurredAt ?? entry.createdAt)) {
    add(errors, AlphaJournalErrorCategory.InvalidLifecycle, "lifecycle timestamps cannot move backward.", "history.occurredAt");
  }
  nonEmpty(errors, "history.reason", history.reason);
  return { valid: errors.length === 0, errors };
}

export function validateAlphaJournalAmendment(
  amendment: AlphaJournalAmendment,
  entry: AlphaJournalEntry,
  now: string,
): AlphaJournalValidation {
  const errors: AlphaJournalError[] = [];
  identifier(errors, "amendmentId", amendment.amendmentId);
  if (amendment.entryId !== entry.entryId) add(errors, AlphaJournalErrorCategory.InvalidReference, "amendment entry reference does not match.");
  if (amendment.parentAmendmentId !== undefined) {
    identifier(errors, "parentAmendmentId", amendment.parentAmendmentId);
    if (amendment.parentAmendmentId === amendment.amendmentId) add(errors, AlphaJournalErrorCategory.InvalidReference, "amendment cannot reference itself.");
  }
  timestamp(errors, "amendment.createdAt", amendment.createdAt, now);
  if (!Object.values(AlphaJournalAmendmentType).includes(amendment.amendmentType)) add(errors, AlphaJournalErrorCategory.InvalidEntry, "amendmentType is invalid.");
  nonEmpty(errors, "amendment.reason", amendment.reason);
  nonEmpty(errors, "amendment.authorReference", amendment.authorReference);
  validateContent(amendment.content, errors, "amendment.content");
  for (const reference of amendment.evidenceReferences) validateReference(reference, errors, "amendment.evidenceReferences");
  validateReference(amendment.auditReference, errors, "amendment.auditReference");
  return { valid: errors.length === 0, errors };
}

export function validateAlphaJournalReview(
  review: AlphaJournalReview,
  entry: AlphaJournalEntry,
  now: string,
): AlphaJournalValidation {
  const errors: AlphaJournalError[] = [];
  identifier(errors, "reviewId", review.reviewId);
  if (review.entryId !== entry.entryId) add(errors, AlphaJournalErrorCategory.InvalidReference, "review entry reference does not match.");
  if (entry.status !== AlphaJournalStatus.Finalized) add(errors, AlphaJournalErrorCategory.InvalidLifecycle, "review requires a FINALIZED entry.");
  timestamp(errors, "review.createdAt", review.createdAt, now);
  nonEmpty(errors, "review.reviewer", review.reviewer);
  for (const [field, value] of [
    ["whatHappened", review.whatHappened], ["whatWasExpected", review.whatWasExpected],
    ["whatWasCorrect", review.whatWasCorrect], ["whatWasIncorrect", review.whatWasIncorrect],
    ["emotionalObservation", review.emotionalObservation], ["futureRuleOrExperiment", review.futureRuleOrExperiment],
  ] as const) nonEmpty(errors, `review.${field}`, value);
  strings(errors, "review.controllableFactors", review.controllableFactors);
  strings(errors, "review.uncontrollableFactors", review.uncontrollableFactors);
  if (!Object.values(AlphaJournalQuality).includes(review.processQuality) || !Object.values(AlphaJournalQuality).includes(review.outcomeQuality)) add(errors, AlphaJournalErrorCategory.InvalidEntry, "review quality is invalid.");
  if (review.predictionAccuracyReference !== undefined) {
    identifier(errors, "review.predictionAccuracyReference.predictionId", review.predictionAccuracyReference.predictionId);
    identifier(errors, "review.predictionAccuracyReference.predictionReviewId", review.predictionAccuracyReference.predictionReviewId);
    if (!Object.values(PredictionAccuracy).includes(review.predictionAccuracyReference.accuracy)) add(errors, AlphaJournalErrorCategory.InvalidEntry, "prediction accuracy is invalid.");
  }
  if (review.tradingProfitabilityReference !== undefined) {
    if (review.tradingProfitabilityReference.tradeId !== undefined) identifier(errors, "review.tradingProfitabilityReference.tradeId", review.tradingProfitabilityReference.tradeId);
    if (review.tradingProfitabilityReference.predictionReviewId !== undefined) identifier(errors, "review.tradingProfitabilityReference.predictionReviewId", review.tradingProfitabilityReference.predictionReviewId);
    if (review.tradingProfitabilityReference.tradeId === undefined && review.tradingProfitabilityReference.predictionReviewId === undefined) add(errors, AlphaJournalErrorCategory.InvalidReference, "profitability reference requires a trade or prediction-review ID.");
    if (!Object.values(PredictionProfitability).includes(review.tradingProfitabilityReference.profitability)) add(errors, AlphaJournalErrorCategory.InvalidEntry, "trading profitability is invalid.");
  }
  const lessonIds = new Set<string>();
  for (const lesson of review.lessons) {
    identifier(errors, "review.lessonId", lesson.lessonId);
    nonEmpty(errors, "review.lesson.statement", lesson.statement);
    strings(errors, "review.lesson.tags", lesson.tags);
    nonEmpty(errors, "review.lesson.futureRuleOrExperiment", lesson.futureRuleOrExperiment);
    if (lessonIds.has(lesson.lessonId)) add(errors, AlphaJournalErrorCategory.DuplicateId, "review contains duplicate lesson IDs.");
    lessonIds.add(lesson.lessonId);
  }
  validateReference(review.auditReference, errors, "review.auditReference");
  return { valid: errors.length === 0, errors };
}

export function validateAlphaJournalQuery(query: AlphaJournalQuery): AlphaJournalValidation {
  const errors: AlphaJournalError[] = [];
  const offset = query.offset ?? 0;
  const limit = query.limit ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit <= 0) add(errors, AlphaJournalErrorCategory.InvalidEntry, "query pagination is invalid.");
  const filter = query.filter;
  if (filter?.fromEventTimestamp !== undefined && !Number.isFinite(Date.parse(filter.fromEventTimestamp))) add(errors, AlphaJournalErrorCategory.InvalidTimestamp, "query from timestamp is invalid.");
  if (filter?.toEventTimestamp !== undefined && !Number.isFinite(Date.parse(filter.toEventTimestamp))) add(errors, AlphaJournalErrorCategory.InvalidTimestamp, "query to timestamp is invalid.");
  if (filter?.fromEventTimestamp !== undefined && filter.toEventTimestamp !== undefined && Date.parse(filter.fromEventTimestamp) > Date.parse(filter.toEventTimestamp)) add(errors, AlphaJournalErrorCategory.InvalidTimestamp, "query timestamp range is invalid.");
  return { valid: errors.length === 0, errors };
}

export function throwIfInvalidAlphaJournal(validation: AlphaJournalValidation): void {
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(`${first?.category ?? AlphaJournalErrorCategory.InvalidEntry}: ${first?.message ?? "journal validation failed."}`);
  }
}
