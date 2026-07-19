import {
  DEFAULT_RESEARCH_LIFECYCLE,
  ResearchAmendmentType,
  ResearchAssumptionImportance,
  ResearchAuthorType,
  ResearchErrorCategory,
  ResearchEvidenceType,
  ResearchObservationClassification,
  ResearchQuality,
  ResearchRecordType,
  ResearchReferenceResolution,
  ResearchReferenceType,
  ResearchScenarioType,
  ResearchSourceType,
  ResearchStatus,
  ResearchUncertaintyCategory,
  type ResearchAmendment,
  type ResearchError,
  type ResearchEvidence,
  type ResearchHistory,
  type ResearchQuery,
  type ResearchRecord,
  type ResearchRecordSnapshot,
  type ResearchReview,
  type ResearchSourceReference,
  type ResearchSupersession,
  type ResearchTypedReference,
  type ResearchValidation,
} from "./ResearchRecord";
import { AIAuditRetentionClassification } from "./AIAuditRepository";
import { PrivacyLevel } from "./AIRouter";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SECRET_KEY_PATTERN = /(api.?key|secret|password|credential|authorization|bearer|private.?key|access.?token)/i;

export function canonicalizeResearchValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return '"[Undefined]"';
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(`[${String(value)}]`);
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeResearchValue).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeResearchValue(entry)}`).join(",")}}`;
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

export function createResearchId(snapshot: ResearchRecordSnapshot): string {
  const authoritative = snapshot as ResearchRecordSnapshot & Partial<Pick<ResearchRecord, "researchId" | "status" | "history">>;
  const { researchId: _researchId, status: _status, history: _history, ...identity } = authoritative;
  return `research:${fnv1a64(canonicalizeResearchValue(identity))}`;
}

export function researchFingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalizeResearchValue(value))}`;
}

function add(errors: ResearchError[], category: ResearchErrorCategory, message: string, field?: string): void {
  errors.push(field === undefined ? { category, message } : { category, message, field });
}

function nonEmpty(errors: ResearchError[], field: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) add(errors, ResearchErrorCategory.InvalidRecord, `${field} must be non-empty.`, field);
}

function identifier(errors: ResearchError[], field: string, value: string): void {
  nonEmpty(errors, field, value);
  if (typeof value === "string" && !ID_PATTERN.test(value)) add(errors, ResearchErrorCategory.InvalidId, `${field} contains unsupported characters.`, field);
}

function timestamp(errors: ResearchError[], field: string, value: string, now: string): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) add(errors, ResearchErrorCategory.InvalidTimestamp, `${field} must be an ISO-8601 timestamp with timezone.`, field);
  else if (parsed > Date.parse(now)) add(errors, ResearchErrorCategory.FutureTimestamp, `${field} cannot be in the future.`, field);
}

function strings(errors: ResearchError[], field: string, values: ReadonlyArray<string>): void {
  if (!Array.isArray(values)) { add(errors, ResearchErrorCategory.InvalidRecord, `${field} must be an array.`, field); return; }
  for (const value of values) nonEmpty(errors, field, value);
  if (new Set(values).size !== values.length) add(errors, ResearchErrorCategory.InvalidRecord, `${field} contains duplicate values.`, field);
}

function score(errors: ResearchError[], field: string, value: number, category = ResearchErrorCategory.InvalidConfidence): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) add(errors, category, `${field} must be between 0 and 100.`, field);
}

function validateSource(source: ResearchSourceReference, errors: ResearchError[], now: string): void {
  identifier(errors, "sources.sourceReferenceId", source.sourceReferenceId);
  if (!Object.values(ResearchSourceType).includes(source.sourceType)) add(errors, ResearchErrorCategory.InvalidSource, "sourceType is invalid.");
  nonEmpty(errors, "sources.title", source.title); nonEmpty(errors, "sources.publisherOrOwner", source.publisherOrOwner);
  timestamp(errors, "sources.observedAt", source.observedAt, now);
  if (source.publishedAt !== undefined) timestamp(errors, "sources.publishedAt", source.publishedAt, now);
  if (source.retrievedAt !== undefined) timestamp(errors, "sources.retrievedAt", source.retrievedAt, now);
  nonEmpty(errors, "sources.locationReference", source.locationReference);
  if (!Object.values(PrivacyLevel).includes(source.privacyLevel)) add(errors, ResearchErrorCategory.InvalidPrivacy, "source privacy is invalid.");
  score(errors, "sources.reliabilityScore", source.reliabilityScore, ResearchErrorCategory.InvalidSource);
  score(errors, "sources.freshnessScore", source.freshnessScore, ResearchErrorCategory.InvalidSource);
}

function validateEvidence(evidence: ResearchEvidence, errors: ResearchError[]): void {
  identifier(errors, "evidence.evidenceId", evidence.evidenceId);
  if (!Object.values(ResearchEvidenceType).includes(evidence.evidenceType)) add(errors, ResearchErrorCategory.InvalidRecord, "evidenceType is invalid.");
  if (!Object.values(ResearchObservationClassification).includes(evidence.classification)) add(errors, ResearchErrorCategory.InvalidRecord, "evidence classification is invalid.");
  nonEmpty(errors, "evidence.statement", evidence.statement);
  strings(errors, "evidence.sourceReferenceIds", evidence.sourceReferenceIds);
  strings(errors, "evidence.dataPointReferences", evidence.dataPointReferences);
  if (evidence.evidenceType === ResearchEvidenceType.Fact && evidence.classification !== ResearchObservationClassification.Fact) add(errors, ResearchErrorCategory.InvalidRecord, "FACT evidence must be classified as fact.");
  if (evidence.evidenceType === ResearchEvidenceType.Inference && evidence.classification !== ResearchObservationClassification.Inference) add(errors, ResearchErrorCategory.InvalidRecord, "INFERENCE evidence must be classified as inference.");
  if (evidence.evidenceType === ResearchEvidenceType.Assumption && evidence.classification !== ResearchObservationClassification.Assumption) add(errors, ResearchErrorCategory.InvalidRecord, "ASSUMPTION evidence must be classified as assumption.");
}

function validateReference(reference: ResearchTypedReference, errors: ResearchError[], field: string): void {
  identifier(errors, `${field}.referenceId`, reference.referenceId);
  if (!Object.values(ResearchReferenceType).includes(reference.recordType)) add(errors, ResearchErrorCategory.InvalidReference, `${field}.recordType is invalid.`);
  if (!Object.values(ResearchReferenceResolution).includes(reference.resolution)) add(errors, ResearchErrorCategory.InvalidReference, `${field}.resolution is invalid.`);
  if (reference.version !== undefined) identifier(errors, `${field}.version`, reference.version);
  if (reference.resolution === ResearchReferenceResolution.Resolved && reference.version === undefined) add(errors, ResearchErrorCategory.InvalidReference, "resolved references must freeze a version.", field);
}

function validateReferences(snapshot: ResearchRecordSnapshot, errors: ResearchError[]): void {
  const groups: ReadonlyArray<readonly [string, ReadonlyArray<ResearchTypedReference>, ResearchReferenceType]> = [
    ["references.predictions", snapshot.references.predictions, ResearchReferenceType.Prediction], ["references.journals", snapshot.references.journals, ResearchReferenceType.Journal],
    ["references.strategies", snapshot.references.strategies, ResearchReferenceType.Strategy], ["references.portfolios", snapshot.references.portfolios, ResearchReferenceType.Portfolio],
    ["references.audits", snapshot.references.audits, ResearchReferenceType.Audit], ["references.historicalPatterns", snapshot.references.historicalPatterns, ResearchReferenceType.HistoricalPattern],
    ["references.research", snapshot.references.research, ResearchReferenceType.Research], ["references.decisions", snapshot.references.decisions, ResearchReferenceType.Decision],
    ["references.trades", snapshot.references.trades, ResearchReferenceType.Trade], ["references.developmentValidations", snapshot.references.developmentValidations, ResearchReferenceType.DevelopmentValidation],
    ["references.marketSnapshots", snapshot.references.marketSnapshots, ResearchReferenceType.MarketSnapshot], ["references.catalystEvents", snapshot.references.catalystEvents, ResearchReferenceType.CatalystEvent],
    ["references.eventReplayTimelines", snapshot.references.eventReplayTimelines, ResearchReferenceType.EventReplay],
  ];
  for (const [field, references, expected] of groups) {
    const identities = new Set<string>();
    for (const reference of references) {
      validateReference(reference, errors, field);
      if (reference.recordType !== expected) add(errors, ResearchErrorCategory.InvalidReference, `${field} contains a mismatched typed reference.`);
      const identity = `${reference.recordType}:${reference.referenceId}:${reference.version ?? ""}`;
      if (identities.has(identity)) add(errors, ResearchErrorCategory.InvalidReference, `${field} contains a duplicate reference.`);
      identities.add(identity);
    }
  }
}

export function validateResearchSnapshot(snapshot: ResearchRecordSnapshot, now: string): ResearchValidation {
  const errors: ResearchError[] = [];
  if (snapshot.schemaVersion !== "1.0") add(errors, ResearchErrorCategory.InvalidRecord, "schemaVersion must be 1.0.");
  identifier(errors, "researchVersion", snapshot.researchVersion);
  timestamp(errors, "createdAt", snapshot.createdAt, now); timestamp(errors, "finalizedAt", snapshot.finalizedAt, now);
  if (snapshot.eventTimestamp !== undefined) timestamp(errors, "eventTimestamp", snapshot.eventTimestamp, now);
  if (Date.parse(snapshot.finalizedAt) < Date.parse(snapshot.createdAt)) add(errors, ResearchErrorCategory.InvalidLifecycle, "finalizedAt cannot precede createdAt.");
  if (!Object.values(ResearchRecordType).includes(snapshot.researchType)) add(errors, ResearchErrorCategory.InvalidRecord, "researchType is invalid.");
  nonEmpty(errors, "title", snapshot.title);
  if (typeof snapshot.question?.statement !== "string" || snapshot.question.statement.trim().length === 0) add(errors, ResearchErrorCategory.EmptyQuestion, "authoritative research question cannot be empty.", "question.statement");
  strings(errors, "scope.included", snapshot.scope.included); strings(errors, "scope.excluded", snapshot.scope.excluded);
  nonEmpty(errors, "timeHorizon", snapshot.timeHorizon); strings(errors, "factualObservations", snapshot.factualObservations);
  strings(errors, "counterarguments", snapshot.counterarguments); strings(errors, "invalidationConditions", snapshot.invalidationConditions); strings(errors, "tags", snapshot.tags);
  const sourceIds = new Set<string>(); for (const source of snapshot.sources) { validateSource(source, errors, now); if (sourceIds.has(source.sourceReferenceId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate source reference ID."); sourceIds.add(source.sourceReferenceId); }
  const dataPointIds = new Set<string>(); for (const point of snapshot.dataPoints) { identifier(errors, "dataPoints.dataPointId", point.dataPointId); nonEmpty(errors, "dataPoints.name", point.name); timestamp(errors, "dataPoints.observedAt", point.observedAt, now); identifier(errors, "dataPoints.sourceReferenceId", point.sourceReferenceId); if (!sourceIds.has(point.sourceReferenceId)) add(errors, ResearchErrorCategory.InvalidReference, "data point source does not exist."); if (dataPointIds.has(point.dataPointId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate data point ID."); dataPointIds.add(point.dataPointId); }
  const evidenceIds = new Set<string>(); for (const evidence of snapshot.evidence) { validateEvidence(evidence, errors); if (evidenceIds.has(evidence.evidenceId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate evidence ID."); evidenceIds.add(evidence.evidenceId); for (const id of evidence.sourceReferenceIds) if (!sourceIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "evidence source does not exist."); for (const id of evidence.dataPointReferences) if (!dataPointIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "evidence data point does not exist."); }
  if (snapshot.evidence.length === 0) add(errors, ResearchErrorCategory.EmptyEvidence, "finalized research requires evidence.");
  if (snapshot.conclusion.statement.trim().length === 0) add(errors, ResearchErrorCategory.EmptyConclusion, "finalized research requires a conclusion.");
  strings(errors, "conclusion.limitations", snapshot.conclusion.limitations); nonEmpty(errors, "thesis.statement", snapshot.thesis.statement);
  for (const id of [...snapshot.thesis.supportingEvidenceIds, ...snapshot.thesis.counterEvidenceIds]) if (!evidenceIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "thesis evidence reference does not exist.");
  score(errors, "confidence.score", snapshot.confidence.score); nonEmpty(errors, "confidence.rationale", snapshot.confidence.rationale);
  const hypothesisIds = new Set<string>(); for (const hypothesis of snapshot.hypotheses) { identifier(errors, "hypotheses.hypothesisId", hypothesis.hypothesisId); if (hypothesisIds.has(hypothesis.hypothesisId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate hypothesis ID."); hypothesisIds.add(hypothesis.hypothesisId); nonEmpty(errors, "hypotheses.statement", hypothesis.statement); for (const id of [...hypothesis.supportingEvidenceIds, ...hypothesis.contradictingEvidenceIds]) if (!evidenceIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "hypothesis evidence reference does not exist."); }
  const assumptionIds = new Set<string>(); for (const assumption of snapshot.assumptions) { identifier(errors, "assumptions.assumptionId", assumption.assumptionId); if (assumptionIds.has(assumption.assumptionId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate assumption ID."); assumptionIds.add(assumption.assumptionId); nonEmpty(errors, "assumptions.statement", assumption.statement); if (!Object.values(ResearchAssumptionImportance).includes(assumption.importance)) add(errors, ResearchErrorCategory.InvalidRecord, "assumption importance is invalid."); score(errors, "assumptions.confidence", assumption.confidence); for (const id of assumption.sourceReferenceIds) if (!sourceIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "assumption source does not exist."); nonEmpty(errors, "assumptions.invalidationCondition", assumption.invalidationCondition); }
  const uncertaintyIds = new Set<string>(); for (const uncertainty of snapshot.uncertainties) { identifier(errors, "uncertainties.uncertaintyId", uncertainty.uncertaintyId); if (uncertaintyIds.has(uncertainty.uncertaintyId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate uncertainty ID."); uncertaintyIds.add(uncertainty.uncertaintyId); if (!Object.values(ResearchUncertaintyCategory).includes(uncertainty.category)) add(errors, ResearchErrorCategory.InvalidRecord, "uncertainty category is invalid."); nonEmpty(errors, "uncertainties.statement", uncertainty.statement); strings(errors, "uncertainties.unknowns", uncertainty.unknowns); strings(errors, "uncertainties.missingData", uncertainty.missingData); strings(errors, "uncertainties.unresolvedQuestions", uncertainty.unresolvedQuestions); }
  const riskIds = new Set<string>(); for (const risk of snapshot.risks) { identifier(errors, "risks.riskId", risk.riskId); if (riskIds.has(risk.riskId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate risk ID."); riskIds.add(risk.riskId); nonEmpty(errors, "risks.statement", risk.statement); nonEmpty(errors, "risks.impact", risk.impact); if (risk.likelihood !== undefined) score(errors, "risks.likelihood", risk.likelihood); for (const id of risk.evidenceReferences) if (!evidenceIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "risk evidence reference does not exist."); }
  const catalystIds = new Set<string>(); for (const catalyst of snapshot.catalysts) { identifier(errors, "catalysts.catalystId", catalyst.catalystId); if (catalystIds.has(catalyst.catalystId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate catalyst ID."); catalystIds.add(catalyst.catalystId); nonEmpty(errors, "catalysts.statement", catalyst.statement); if (catalyst.expectedAt !== undefined && (!Number.isFinite(Date.parse(catalyst.expectedAt)) || !/(Z|[+-]\d{2}:\d{2})$/.test(catalyst.expectedAt))) add(errors, ResearchErrorCategory.InvalidTimestamp, "catalyst expectedAt must be an ISO-8601 timestamp with timezone."); for (const id of catalyst.evidenceReferences) if (!evidenceIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "catalyst evidence reference does not exist."); }
  const scenarioIds = new Set<string>(); for (const scenario of snapshot.scenarios) { identifier(errors, "scenarios.scenarioId", scenario.scenarioId); if (scenarioIds.has(scenario.scenarioId)) add(errors, ResearchErrorCategory.DuplicateId, "duplicate scenario ID."); scenarioIds.add(scenario.scenarioId); if (!Object.values(ResearchScenarioType).includes(scenario.scenarioType)) add(errors, ResearchErrorCategory.InvalidRecord, "scenario type is invalid."); nonEmpty(errors, "scenarios.description", scenario.description); if (scenario.probability !== undefined) score(errors, "scenarios.probability", scenario.probability, ResearchErrorCategory.InvalidProbability); for (const id of scenario.supportingEvidenceIds) if (!evidenceIds.has(id)) add(errors, ResearchErrorCategory.InvalidReference, "scenario evidence reference does not exist."); }
  identifier(errors, "ownerReference", snapshot.ownerReference); identifier(errors, "correlationId", snapshot.correlationId); identifier(errors, "traceId", snapshot.traceId);
  if (!Object.values(ResearchAuthorType).includes(snapshot.authorType)) add(errors, ResearchErrorCategory.InvalidRecord, "authorType is invalid.");
  if (!Object.values(PrivacyLevel).includes(snapshot.privacyLevel) || snapshot.privacyLevel === PrivacyLevel.Public) add(errors, ResearchErrorCategory.InvalidPrivacy, "authoritative research cannot default to PUBLIC.");
  if (!Object.values(AIAuditRetentionClassification).includes(snapshot.retention)) add(errors, ResearchErrorCategory.InvalidRecord, "retention is invalid.");
  validateReferences(snapshot, errors);
  if (snapshot.supersedesResearchId !== undefined) identifier(errors, "supersedesResearchId", snapshot.supersedesResearchId);
  for (const [key, value] of Object.entries(snapshot.policyVersions)) { identifier(errors, "policyVersions key", key); identifier(errors, `policyVersions.${key}`, value); }
  for (const [key, value] of Object.entries(snapshot.metadata)) { identifier(errors, "metadata key", key); if (SECRET_KEY_PATTERN.test(key)) add(errors, ResearchErrorCategory.SecretMetadata, "secret-bearing metadata keys are prohibited.", `metadata.${key}`); if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isSafeInteger(value))) add(errors, ResearchErrorCategory.InvalidRecord, "metadata values must be scalar and finite."); }
  return { valid: errors.length === 0, errors };
}

export function validateResearchRecord(record: ResearchRecord, now: string): ResearchValidation {
  const base = validateResearchSnapshot(record, now); const errors = [...base.errors];
  identifier(errors, "researchId", record.researchId);
  if (record.researchId !== createResearchId(record)) add(errors, ResearchErrorCategory.InvalidId, "researchId does not match deterministic snapshot content.");
  if (record.status !== ResearchStatus.Finalized || record.history.length !== 3) add(errors, ResearchErrorCategory.InvalidLifecycle, "new authoritative research must begin FINALIZED with complete draft-to-finalized provenance.");
  const expected: ReadonlyArray<readonly [ResearchStatus, ResearchStatus]> = [[ResearchStatus.Draft, ResearchStatus.Collecting], [ResearchStatus.Collecting, ResearchStatus.Analyzing], [ResearchStatus.Analyzing, ResearchStatus.Finalized]];
  record.history.forEach((history, index) => { const pair = expected[index]; if (pair === undefined || history.researchId !== record.researchId || history.lifecycleSequence !== index + 1 || history.fromStatus !== pair[0] || history.toStatus !== pair[1]) add(errors, ResearchErrorCategory.InvalidLifecycle, "initial research lifecycle history is invalid."); });
  if (record.references.research.some((reference) => reference.referenceId === record.researchId) || record.supersedesResearchId === record.researchId) add(errors, ResearchErrorCategory.InvalidReference, "research cannot reference or supersede itself.");
  return { valid: errors.length === 0, errors };
}

export function validateResearchHistory(history: ResearchHistory, record: ResearchRecord, now: string): ResearchValidation {
  const errors: ResearchError[] = []; identifier(errors, "historyId", history.historyId);
  if (history.researchId !== record.researchId || history.lifecycleSequence !== record.history.length + 1 || history.fromStatus !== record.status || !DEFAULT_RESEARCH_LIFECYCLE.allowedTransitions[record.status].includes(history.toStatus)) add(errors, ResearchErrorCategory.InvalidLifecycle, "research lifecycle transition is invalid.");
  timestamp(errors, "history.occurredAt", history.occurredAt, now); if (Date.parse(history.occurredAt) < Date.parse(record.history.at(-1)?.occurredAt ?? record.finalizedAt)) add(errors, ResearchErrorCategory.InvalidLifecycle, "lifecycle timestamps cannot move backward."); nonEmpty(errors, "history.reason", history.reason);
  return { valid: errors.length === 0, errors };
}

export function validateResearchAmendment(amendment: ResearchAmendment, record: ResearchRecord, now: string): ResearchValidation {
  const errors: ResearchError[] = []; identifier(errors, "amendmentId", amendment.amendmentId); if (amendment.researchId !== record.researchId) add(errors, ResearchErrorCategory.InvalidReference, "amendment research reference does not match.");
  if (amendment.parentAmendmentId !== undefined) { identifier(errors, "parentAmendmentId", amendment.parentAmendmentId); if (amendment.parentAmendmentId === amendment.amendmentId) add(errors, ResearchErrorCategory.InvalidReference, "amendment cannot reference itself."); }
  timestamp(errors, "amendment.createdAt", amendment.createdAt, now); if (!Object.values(ResearchAmendmentType).includes(amendment.amendmentType)) add(errors, ResearchErrorCategory.InvalidRecord, "amendmentType is invalid."); nonEmpty(errors, "amendment.reason", amendment.reason); strings(errors, "amendment.changedFields", amendment.changedFields); identifier(errors, "amendment.authorReference", amendment.authorReference); validateReference(amendment.auditReference, errors, "amendment.auditReference"); for (const evidence of amendment.additionalEvidence) validateEvidence(evidence, errors); if (amendment.confidence !== undefined) { score(errors, "amendment.confidence.score", amendment.confidence.score); nonEmpty(errors, "amendment.confidence.rationale", amendment.confidence.rationale); }
  return { valid: errors.length === 0, errors };
}

export function validateResearchReview(review: ResearchReview, record: ResearchRecord, now: string): ResearchValidation {
  const errors: ResearchError[] = []; identifier(errors, "reviewId", review.reviewId); if (review.researchId !== record.researchId) add(errors, ResearchErrorCategory.InvalidReference, "review research reference does not match."); if (record.status !== ResearchStatus.Finalized) add(errors, ResearchErrorCategory.InvalidLifecycle, "review requires FINALIZED research."); timestamp(errors, "review.createdAt", review.createdAt, now); nonEmpty(errors, "review.reviewer", review.reviewer); nonEmpty(errors, "review.whatHeldUp", review.whatHeldUp); nonEmpty(errors, "review.whatFailed", review.whatFailed); strings(errors, "review.correctAssumptions", review.correctAssumptions); strings(errors, "review.incorrectAssumptions", review.incorrectAssumptions); strings(errors, "review.lessons", review.lessons); strings(errors, "review.futureResearchQuestions", review.futureResearchQuestions); for (const quality of [review.sourceQuality, review.processQuality, review.conclusionQuality]) if (!Object.values(ResearchQuality).includes(quality)) add(errors, ResearchErrorCategory.InvalidRecord, "review quality is invalid."); for (const reference of [...review.predictionReferences, ...review.profitabilityReferences]) validateReference(reference, errors, "review.references"); validateReference(review.auditReference, errors, "review.auditReference");
  return { valid: errors.length === 0, errors };
}

export function validateResearchSupersession(value: ResearchSupersession, prior: ResearchRecord, next: ResearchRecord, now: string): ResearchValidation {
  const errors: ResearchError[] = []; identifier(errors, "supersessionId", value.supersessionId); if (value.priorResearchId !== prior.researchId || value.newResearchId !== next.researchId) add(errors, ResearchErrorCategory.InvalidReference, "supersession references do not match records."); if (value.priorResearchId === value.newResearchId) add(errors, ResearchErrorCategory.InvalidReference, "research cannot supersede itself."); if (next.supersedesResearchId !== prior.researchId) add(errors, ResearchErrorCategory.InvalidReference, "new research must freeze the prior research ID."); if (![ResearchStatus.Finalized, ResearchStatus.Reviewed].includes(prior.status)) add(errors, ResearchErrorCategory.InvalidLifecycle, "only current finalized or reviewed research can be superseded."); timestamp(errors, "supersession.createdAt", value.createdAt, now); nonEmpty(errors, "supersession.reason", value.reason); strings(errors, "supersession.changedFacts", value.changedFacts); strings(errors, "supersession.changedAssumptions", value.changedAssumptions); nonEmpty(errors, "supersession.changedMarketRegime", value.changedMarketRegime); nonEmpty(errors, "supersession.changedThesis", value.changedThesis); identifier(errors, "supersession.ownerReference", value.ownerReference); validateReference(value.auditReference, errors, "supersession.auditReference");
  return { valid: errors.length === 0, errors };
}

export function validateResearchQuery(query: ResearchQuery): ResearchValidation {
  const errors: ResearchError[] = []; const offset = query.offset ?? 0; const limit = query.limit ?? Number.MAX_SAFE_INTEGER; if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit <= 0) add(errors, ResearchErrorCategory.InvalidRecord, "query pagination is invalid."); const from = query.filter?.fromEventTimestamp; const to = query.filter?.toEventTimestamp; if (from !== undefined && !Number.isFinite(Date.parse(from))) add(errors, ResearchErrorCategory.InvalidTimestamp, "query from timestamp is invalid."); if (to !== undefined && !Number.isFinite(Date.parse(to))) add(errors, ResearchErrorCategory.InvalidTimestamp, "query to timestamp is invalid."); if (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to)) add(errors, ResearchErrorCategory.InvalidTimestamp, "query timestamp range is invalid."); return { valid: errors.length === 0, errors };
}

export function throwIfInvalidResearch(validation: ResearchValidation): void {
  if (!validation.valid) { const first = validation.errors[0]; throw new Error(`${first?.category ?? ResearchErrorCategory.InvalidRecord}: ${first?.message ?? "research validation failed."}`); }
}
