import {
  HistoricalClaimClassification, HistoricalDatePrecision, HistoricalEventStatus,
  HistoricalMissingDataState, HistoricalPatternErrorCategory, HistoricalPatternStatus,
  HistoricalReactionDirection, HistoricalReferenceResolution, HistoricalRegimeState,
  type HistoricalAssetReaction, type HistoricalDateValue, type HistoricalEvent,
  type HistoricalEventAmendment, type HistoricalEventHistory, type HistoricalEventReview,
  type HistoricalPattern, type HistoricalPatternAmendment, type HistoricalPatternError,
  type HistoricalPatternEvidence, type HistoricalPatternHistoryEntry, type HistoricalPatternQuery,
  type HistoricalPatternReview, type HistoricalPatternSupersession, type HistoricalPatternValidation,
  type HistoricalReferenceGraph, type HistoricalRegimeDimension,
} from "./HistoricalPattern";

const EVENT_ID = /^historical-event:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const PATTERN_ID = /^historical-pattern:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,159}$/;
const SECRET_KEY = /(api[_-]?key|secret|token|password|credential|private[_-]?key|authorization|bearer)/i;
const GUARANTEE = /\b(guarantee(?:d|s)?|will always|certain to|must recur|cannot fail)\b/i;
const INFERENCE_WORDING = /\b(may|might|could|likely|suggests?|appears?|probably|possibly)\b/i;

const eventTransitions: Readonly<Record<HistoricalEventStatus, ReadonlyArray<HistoricalEventStatus>>> = {
  [HistoricalEventStatus.Proposed]: [HistoricalEventStatus.Validating, HistoricalEventStatus.Rejected],
  [HistoricalEventStatus.Validating]: [HistoricalEventStatus.Finalized, HistoricalEventStatus.Rejected],
  [HistoricalEventStatus.Finalized]: [HistoricalEventStatus.Reviewed, HistoricalEventStatus.Superseded, HistoricalEventStatus.Archived],
  [HistoricalEventStatus.Reviewed]: [HistoricalEventStatus.Superseded, HistoricalEventStatus.Archived],
  [HistoricalEventStatus.Superseded]: [HistoricalEventStatus.Archived],
  [HistoricalEventStatus.Archived]: [], [HistoricalEventStatus.Rejected]: [],
};
const patternTransitions: Readonly<Record<HistoricalPatternStatus, ReadonlyArray<HistoricalPatternStatus>>> = {
  [HistoricalPatternStatus.Proposed]: [HistoricalPatternStatus.Validating, HistoricalPatternStatus.Rejected],
  [HistoricalPatternStatus.Validating]: [HistoricalPatternStatus.Finalized, HistoricalPatternStatus.Rejected],
  [HistoricalPatternStatus.Finalized]: [HistoricalPatternStatus.Reviewed, HistoricalPatternStatus.Superseded, HistoricalPatternStatus.Archived],
  [HistoricalPatternStatus.Reviewed]: [HistoricalPatternStatus.Superseded, HistoricalPatternStatus.Archived],
  [HistoricalPatternStatus.Superseded]: [HistoricalPatternStatus.Archived],
  [HistoricalPatternStatus.Archived]: [], [HistoricalPatternStatus.Rejected]: [],
};

function error(category: HistoricalPatternErrorCategory, message: string, field?: string): HistoricalPatternError { return field === undefined ? { category, message } : { category, message, field }; }
function result(errors: HistoricalPatternError[]): HistoricalPatternValidation { return { valid: errors.length === 0, errors }; }
function nonEmpty(value: string): boolean { return value.trim().length > 0; }
function timestamp(value: string): boolean { return Number.isFinite(Date.parse(value)); }
function confidence(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 100; }
function unique(values: ReadonlyArray<string>): boolean { return new Set(values).size === values.length; }

export function canonicalizeHistoricalValue(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") { if (!Number.isFinite(value)) throw new Error("Non-finite numbers cannot be canonicalized."); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonicalizeHistoricalValue).join(",")}]`;
  if (typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalizeHistoricalValue(item)}`).join(",")}}`;
  throw new Error("Unsupported value cannot be canonicalized.");
}

export function historicalFingerprint(value: unknown): string {
  const text = canonicalizeHistoricalValue(value); let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) { hash ^= BigInt(text.charCodeAt(index)); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function validateDate(value: HistoricalDateValue, field: string, errors: HistoricalPatternError[]): void {
  if (value.precision === HistoricalDatePrecision.Unknown) { if (value.value !== undefined || value.earliest !== undefined || value.latest !== undefined) errors.push(error(HistoricalPatternErrorCategory.InvalidDatePrecision, "UNKNOWN date cannot contain a value or bounds.", field)); return; }
  if (value.precision === HistoricalDatePrecision.BoundedRange) {
    if (value.earliest === undefined || value.latest === undefined || !timestamp(value.earliest) || !timestamp(value.latest) || Date.parse(value.earliest) > Date.parse(value.latest)) errors.push(error(HistoricalPatternErrorCategory.InvalidDateRange, "Bounded date requires valid ordered earliest and latest values.", field));
    return;
  }
  if (value.value === undefined || !nonEmpty(value.value)) { errors.push(error(HistoricalPatternErrorCategory.InvalidDatePrecision, "Date precision requires a value.", field)); return; }
  const valid = value.precision === HistoricalDatePrecision.Year ? /^\d{4}$/.test(value.value)
    : value.precision === HistoricalDatePrecision.Quarter ? /^\d{4}-Q[1-4]$/.test(value.value)
    : value.precision === HistoricalDatePrecision.Month ? /^\d{4}-(0[1-9]|1[0-2])$/.test(value.value)
    : value.precision === HistoricalDatePrecision.ExactDate ? /^\d{4}-\d{2}-\d{2}$/.test(value.value) && timestamp(`${value.value}T00:00:00.000Z`)
    : timestamp(value.value);
  if (!valid) errors.push(error(HistoricalPatternErrorCategory.InvalidDatePrecision, "Date value does not match its precision.", field));
}

function bounds(value: HistoricalDateValue): readonly [number, number] | undefined {
  if (value.precision === HistoricalDatePrecision.Unknown) return undefined;
  if (value.precision === HistoricalDatePrecision.BoundedRange) return value.earliest === undefined || value.latest === undefined ? undefined : [Date.parse(value.earliest), Date.parse(value.latest)];
  if (value.value === undefined) return undefined;
  if (value.precision === HistoricalDatePrecision.Year) return [Date.parse(`${value.value}-01-01T00:00:00.000Z`), Date.parse(`${value.value}-12-31T23:59:59.999Z`)];
  if (value.precision === HistoricalDatePrecision.Quarter) { const [yearText, quarterText] = value.value.split("-Q"); const year = Number(yearText); const quarter = Number(quarterText); return [Date.UTC(year, (quarter - 1) * 3, 1), Date.UTC(year, quarter * 3, 0, 23, 59, 59, 999)]; }
  if (value.precision === HistoricalDatePrecision.Month) { const [yearText, monthText] = value.value.split("-"); const year = Number(yearText); const month = Number(monthText); return [Date.UTC(year, month - 1, 1), Date.UTC(year, month, 0, 23, 59, 59, 999)]; }
  const parsed = Date.parse(value.precision === HistoricalDatePrecision.ExactDate ? `${value.value}T00:00:00.000Z` : value.value); return [parsed, parsed];
}

function validateEvidence(values: ReadonlyArray<HistoricalPatternEvidence>, sourceIds: Set<string>, dataIds: Set<string>, errors: HistoricalPatternError[], field: string): void {
  const ids = values.map((value) => value.evidenceId); if (!unique(ids) || ids.some((id) => !RECORD_ID.test(id))) errors.push(error(HistoricalPatternErrorCategory.InvalidId, "Evidence IDs must be valid and unique.", field));
  for (const value of values) {
    if (!nonEmpty(value.statement) || !confidence(value.confidence)) errors.push(error(HistoricalPatternErrorCategory.InvalidConfidence, "Evidence requires a statement and confidence from 0 through 100.", `${field}.${value.evidenceId}`));
    if (value.sourceReferenceIds.some((id) => !sourceIds.has(id)) || value.dataReferenceIds.some((id) => !dataIds.has(id))) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Evidence references an unknown source or data record.", `${field}.${value.evidenceId}`));
    if ([HistoricalClaimClassification.HistoricalFact, HistoricalClaimClassification.QuantitativeObservation, HistoricalClaimClassification.SourceClaim].includes(value.classification) && value.sourceReferenceIds.length === 0) errors.push(error(HistoricalPatternErrorCategory.MissingEvidence, "Fact, observation, and source claims require a source.", `${field}.${value.evidenceId}`));
    if (value.classification === HistoricalClaimClassification.HistoricalFact && INFERENCE_WORDING.test(value.statement)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Inference language cannot be classified as historical fact.", `${field}.${value.evidenceId}`));
  }
}

function validateReferences(graph: HistoricalReferenceGraph, errors: HistoricalPatternError[]): void {
  const all = [...graph.research, ...graph.journals, ...graph.predictions, ...graph.strategies, ...graph.audits]; const ids = all.map((value) => `${value.recordType}:${value.referenceId}`);
  if (!unique(ids) || all.some((value) => !RECORD_ID.test(value.referenceId))) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Typed references must be valid and unique."));
  if (all.some((value) => value.resolution === HistoricalReferenceResolution.Resolved && (value.version === undefined || !nonEmpty(value.version)))) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Resolved references must freeze a version."));
  if (all.some((value) => value.resolution === HistoricalReferenceResolution.Unresolved && value.version !== undefined)) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Unresolved references cannot claim a frozen version."));
}

function validateRegime(value: HistoricalRegimeDimension, errors: HistoricalPatternError[], field: string): void {
  if (!confidence(value.confidence)) errors.push(error(HistoricalPatternErrorCategory.InvalidConfidence, "Regime confidence must be from 0 through 100.", field));
  validateDate(value.period, `${field}.period`, errors);
  if (value.state === HistoricalRegimeState.Known && (value.value === undefined || !nonEmpty(value.value))) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Known regime requires a value.", field));
  if (value.state === HistoricalRegimeState.Unknown && value.value !== undefined) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Unknown regime cannot collapse to a value.", field));
  if (value.state === HistoricalRegimeState.Disputed && (value.competingValues === undefined || value.competingValues.length < 2)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Disputed regime requires competing values.", field));
}

export function validateHistoricalAssetReaction(value: HistoricalAssetReaction): HistoricalPatternValidation {
  const errors: HistoricalPatternError[] = []; if (!RECORD_ID.test(value.reactionId)) errors.push(error(HistoricalPatternErrorCategory.InvalidId, "Invalid reaction ID.")); validateDate(value.observationWindow.start, "observationWindow.start", errors); validateDate(value.observationWindow.end, "observationWindow.end", errors);
  const start = value.startValue; const end = value.endValue; const missing = value.missingDataState === HistoricalMissingDataState.Missing;
  if (missing && (value.absoluteChange !== undefined || value.percentageChange !== undefined)) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Missing observations cannot contain calculated changes."));
  if (start?.value !== undefined && !Number.isFinite(start.value) || end?.value !== undefined && !Number.isFinite(end.value)) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Asset values must be finite."));
  for (const numeric of [value.absoluteChange, value.percentageChange, value.maximumDrawdown, value.maximumGain, value.realizedVolatility]) if (numeric !== undefined && !Number.isFinite(numeric)) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Reaction calculations must be finite."));
  if (value.percentageChange !== undefined) {
    if (start?.value === undefined || end?.value === undefined || start.missing || end.missing) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Percentage change requires supplied start and end values."));
    else if (start.value === 0) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Percentage change cannot use a zero denominator."));
    else if (Math.abs(((end.value - start.value) / start.value) * 100 - value.percentageChange) > 1e-9) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Percentage change does not match deterministic calculation."));
  }
  if (value.absoluteChange !== undefined && start?.value !== undefined && end?.value !== undefined && Math.abs((end.value - start.value) - value.absoluteChange) > 1e-9) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Absolute change does not match deterministic calculation."));
  const startCurrency = start?.currency ?? value.marketIndex?.currency ?? value.sector?.currency ?? value.instrument?.currency; const endCurrency = end?.currency ?? startCurrency;
  if (startCurrency !== undefined && endCurrency !== undefined && startCurrency !== endCurrency && value.currencyConversionEvidenceReference === undefined) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Cross-currency comparison requires conversion evidence."));
  if ((value.absoluteChange !== undefined || value.percentageChange !== undefined) && (value.calculationMethodReference === undefined || !nonEmpty(value.calculationMethodReference))) errors.push(error(HistoricalPatternErrorCategory.InvalidCalculation, "Calculated fields require a method reference."));
  if (value.direction === HistoricalReactionDirection.Unknown && value.missingDataState === HistoricalMissingDataState.Complete) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Complete reaction data cannot use UNKNOWN direction."));
  return result(errors);
}

function validateMetadata(metadata: Readonly<Record<string, unknown>>, errors: HistoricalPatternError[]): void { if (Object.keys(metadata).some((key) => SECRET_KEY.test(key))) errors.push(error(HistoricalPatternErrorCategory.SecretMetadata, "Secret-bearing metadata keys are forbidden.", "metadata")); }

function validateHistory(history: ReadonlyArray<HistoricalEventHistory | HistoricalPatternHistoryEntry>, kind: "event" | "pattern", id: string, status: HistoricalEventStatus | HistoricalPatternStatus, errors: HistoricalPatternError[]): void {
  if (history.length < 2) { errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Finalized record requires proposal and validation provenance.")); return; }
  for (let index = 0; index < history.length; index += 1) { const item = history[index]; if (item === undefined) continue; const itemId = "eventId" in item ? item.eventId : item.patternId; if (itemId !== id || item.lifecycleSequence !== index + 1 || !timestamp(item.occurredAt)) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Lifecycle identity, sequence, or timestamp is invalid.")); const allowed = kind === "event" ? eventTransitions[item.fromStatus as HistoricalEventStatus] : patternTransitions[item.fromStatus as HistoricalPatternStatus]; if (!allowed.includes(item.toStatus as never)) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Lifecycle transition is not allowed.")); if (index > 0 && history[index - 1]?.toStatus !== item.fromStatus) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Lifecycle chain is discontinuous.")); }
  if (history.at(-1)?.toStatus !== status) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Lifecycle terminal status does not match record status."));
}

export function validateHistoricalEvent(record: HistoricalEvent): HistoricalPatternValidation {
  const errors: HistoricalPatternError[] = [];
  if (!EVENT_ID.test(record.eventId)) errors.push(error(HistoricalPatternErrorCategory.InvalidId, "Historical event ID is malformed.", "eventId"));
  if (record.schemaVersion !== "1.0" || !nonEmpty(record.recordVersion) || !nonEmpty(record.title) || !nonEmpty(record.factualDescription)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Event requires schema/version, title, and factual description."));
  if (record.status !== HistoricalEventStatus.Finalized) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "New authoritative event must be FINALIZED."));
  if (record.eventCategories.length === 0 || !unique(record.eventCategories)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Event categories must be non-empty and unique."));
  validateDate(record.start, "start", errors); if (record.peak !== undefined) validateDate(record.peak, "peak", errors); if (record.end !== undefined) validateDate(record.end, "end", errors);
  const start = bounds(record.start); const end = record.end === undefined ? undefined : bounds(record.end); if (start !== undefined && end !== undefined && end[1] < start[0]) errors.push(error(HistoricalPatternErrorCategory.InvalidDateRange, "Event end cannot precede start.")); if (record.openEnded && record.end !== undefined) errors.push(error(HistoricalPatternErrorCategory.InvalidDateRange, "Open-ended event cannot contain an end date.")); if (!record.openEnded && record.end === undefined) errors.push(error(HistoricalPatternErrorCategory.InvalidDateRange, "Closed event requires an end date."));
  const sourceIds = new Set(record.sources.map((value) => value.sourceReferenceId)); const dataIds = new Set(record.dataReferences.map((value) => value.dataReferenceId));
  if (sourceIds.size !== record.sources.length || [...sourceIds].some((id) => !RECORD_ID.test(id))) errors.push(error(HistoricalPatternErrorCategory.InvalidId, "Source IDs must be valid and unique."));
  for (const source of record.sources) if (!nonEmpty(source.title) || !nonEmpty(source.locationReference) || !confidence(source.reliabilityScore)) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Source metadata is invalid.", source.sourceReferenceId));
  if (dataIds.size !== record.dataReferences.length || record.dataReferences.some((value) => !sourceIds.has(value.sourceReferenceId) || value.value !== undefined && !Number.isFinite(value.value))) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Data references must be unique, finite, and source-backed."));
  validateEvidence(record.evidence, sourceIds, dataIds, errors, "evidence"); validateEvidence(record.disputedInterpretations, sourceIds, dataIds, errors, "disputedInterpretations");
  if (!record.evidence.some((value) => [HistoricalClaimClassification.HistoricalFact, HistoricalClaimClassification.QuantitativeObservation].includes(value.classification) && value.sourceReferenceIds.length > 0)) errors.push(error(HistoricalPatternErrorCategory.MissingEvidence, "Finalized event requires factual source evidence."));
  for (const cause of record.causes) if (!confidence(cause.confidence) || cause.evidenceReferenceIds.length === 0 || cause.classification === HistoricalClaimClassification.HistoricalFact && INFERENCE_WORDING.test(cause.statement)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Cause classification, confidence, or evidence is invalid."));
  for (const dimension of record.marketRegime.dimensions) validateRegime(dimension, errors, `marketRegime.${dimension.dimension}`);
  const regimeTypes = record.marketRegime.dimensions.map((value) => value.dimension); if (!unique(regimeTypes)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Regime dimensions must be unique."));
  for (const reaction of record.assetReactions) errors.push(...validateHistoricalAssetReaction(reaction).errors);
  if (record.relatedEventIds.includes(record.eventId) || !unique(record.relatedEventIds)) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Related events cannot self-reference or duplicate."));
  validateReferences(record.references, errors); validateMetadata(record.metadata, errors); validateHistory(record.history, "event", record.eventId, record.status, errors);
  return result(errors);
}

export function validateHistoricalPattern(record: HistoricalPattern): HistoricalPatternValidation {
  const errors: HistoricalPatternError[] = [];
  if (!PATTERN_ID.test(record.patternId)) errors.push(error(HistoricalPatternErrorCategory.InvalidId, "Historical pattern ID is malformed.", "patternId"));
  if (record.schemaVersion !== "1.0" || !nonEmpty(record.recordVersion) || !nonEmpty(record.title) || !nonEmpty(record.description)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Pattern requires schema/version, title, and description."));
  if (record.status !== HistoricalPatternStatus.Finalized) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "New authoritative pattern must be FINALIZED."));
  if (!Number.isSafeInteger(record.minimumSupportingEventCount) || record.minimumSupportingEventCount < 1 || record.sourceEventIds.length < record.minimumSupportingEventCount || !unique(record.sourceEventIds) || record.sourceEventIds.some((id) => !EVENT_ID.test(id))) errors.push(error(HistoricalPatternErrorCategory.MissingSupportingEvent, "Pattern requires unique supporting events meeting the minimum count."));
  if (!confidence(record.confidence.score)) errors.push(error(HistoricalPatternErrorCategory.InvalidConfidence, "Pattern confidence must be from 0 through 100."));
  const sourceIds = new Set(record.evidence.flatMap((value) => value.sourceReferenceIds)); const dataIds = new Set(record.evidence.flatMap((value) => value.dataReferenceIds)); validateEvidence(record.evidence, sourceIds, dataIds, errors, "evidence"); validateEvidence([record.causalMechanism], new Set([...sourceIds, ...record.causalMechanism.sourceReferenceIds]), new Set([...dataIds, ...record.causalMechanism.dataReferenceIds]), errors, "causalMechanism");
  if (record.evidence.length === 0) errors.push(error(HistoricalPatternErrorCategory.MissingEvidence, "Finalized pattern requires evidence."));
  if (GUARANTEE.test(`${record.description} ${record.causalMechanism.statement} ${record.qualifyingConditions.join(" ")} ${record.typicalSequence.join(" ")}`)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Pattern cannot claim guaranteed future recurrence."));
  if (record.relatedPatternIds.includes(record.patternId) || !unique(record.relatedPatternIds)) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Related patterns cannot self-reference or duplicate."));
  for (const reaction of record.typicalAssetReactions) errors.push(...validateHistoricalAssetReaction(reaction).errors); for (const dimension of record.regimeDependencies) validateRegime(dimension, errors, `regimeDependencies.${dimension.dimension}`);
  validateReferences(record.references, errors); validateMetadata(record.metadata, errors); validateHistory(record.history, "pattern", record.patternId, record.status, errors);
  return result(errors);
}

function validateAppendRecord(id: string, createdAt: string, reason: string, auditVersion: string | undefined, errors: HistoricalPatternError[]): void { if (!RECORD_ID.test(id)) errors.push(error(HistoricalPatternErrorCategory.InvalidId, "Append record ID is malformed.")); if (!timestamp(createdAt)) errors.push(error(HistoricalPatternErrorCategory.InvalidTimestamp, "Append record timestamp is invalid.")); if (!nonEmpty(reason)) errors.push(error(HistoricalPatternErrorCategory.InvalidRecord, "Append record requires a reason.")); if (auditVersion === undefined) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Audit reference must be resolved with a version.")); }
export function validateHistoricalEventAmendment(value: HistoricalEventAmendment, original?: HistoricalEvent): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; validateAppendRecord(value.amendmentId, value.createdAt, value.reason, value.auditReference.version, errors); if (original === undefined || value.eventId !== original.eventId) errors.push(error(HistoricalPatternErrorCategory.RecordNotFound, "Event amendment requires its original event.")); if (value.parentAmendmentId === value.amendmentId) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Amendment cannot self-reference.")); return result(errors); }
export function validateHistoricalPatternAmendment(value: HistoricalPatternAmendment, original?: HistoricalPattern): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; validateAppendRecord(value.amendmentId, value.createdAt, value.reason, value.auditReference.version, errors); if (original === undefined || value.patternId !== original.patternId) errors.push(error(HistoricalPatternErrorCategory.RecordNotFound, "Pattern amendment requires its original pattern.")); if (value.confidence !== undefined && !confidence(value.confidence.score)) errors.push(error(HistoricalPatternErrorCategory.InvalidConfidence, "Amendment confidence is invalid.")); if (value.parentAmendmentId === value.amendmentId) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Amendment cannot self-reference.")); return result(errors); }
export function validateHistoricalEventReview(value: HistoricalEventReview, original?: HistoricalEvent): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; validateAppendRecord(value.reviewId, value.createdAt, value.missingDataImpact, value.auditReference.version, errors); if (original === undefined || value.eventId !== original.eventId || ![HistoricalEventStatus.Finalized, HistoricalEventStatus.Reviewed].includes(original.status)) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Event review requires a finalized event.")); return result(errors); }
export function validateHistoricalPatternReview(value: HistoricalPatternReview, original?: HistoricalPattern): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; validateAppendRecord(value.reviewId, value.createdAt, value.missingDataImpact, value.auditReference.version, errors); if (original === undefined || value.patternId !== original.patternId || ![HistoricalPatternStatus.Finalized, HistoricalPatternStatus.Reviewed].includes(original.status)) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Pattern review requires a finalized pattern.")); return result(errors); }
export function validateHistoricalPatternSupersession(value: HistoricalPatternSupersession, prior?: HistoricalPattern, successor?: HistoricalPattern): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; validateAppendRecord(value.supersessionId, value.createdAt, value.reason, value.auditReference.version, errors); if (prior === undefined || successor === undefined) errors.push(error(HistoricalPatternErrorCategory.RecordNotFound, "Supersession requires prior and successor patterns.")); if (value.priorPatternId === value.successorPatternId) errors.push(error(HistoricalPatternErrorCategory.InvalidReference, "Pattern cannot supersede itself.")); if (successor !== undefined && successor.status !== HistoricalPatternStatus.Finalized) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Successor pattern must be finalized.")); return result(errors); }
export function validateHistoricalEventHistory(value: HistoricalEventHistory, current: HistoricalEvent): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; if (value.eventId !== current.eventId || value.lifecycleSequence !== current.history.length + 1 || value.fromStatus !== current.status || !eventTransitions[current.status].includes(value.toStatus) || !timestamp(value.occurredAt)) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Event lifecycle transition is invalid.")); return result(errors); }
export function validateHistoricalPatternHistory(value: HistoricalPatternHistoryEntry, current: HistoricalPattern): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; if (value.patternId !== current.patternId || value.lifecycleSequence !== current.history.length + 1 || value.fromStatus !== current.status || !patternTransitions[current.status].includes(value.toStatus) || !timestamp(value.occurredAt)) errors.push(error(HistoricalPatternErrorCategory.InvalidLifecycle, "Pattern lifecycle transition is invalid.")); return result(errors); }
export function validateHistoricalPatternQuery(query: HistoricalPatternQuery): HistoricalPatternValidation { const errors: HistoricalPatternError[] = []; if (query.offset !== undefined && (!Number.isSafeInteger(query.offset) || query.offset < 0) || query.limit !== undefined && (!Number.isSafeInteger(query.limit) || query.limit <= 0)) errors.push(error(HistoricalPatternErrorCategory.InvalidPagination, "Pagination must use non-negative offset and positive limit.")); if (query.filter?.fromDate !== undefined && !timestamp(query.filter.fromDate) || query.filter?.toDate !== undefined && !timestamp(query.filter.toDate)) errors.push(error(HistoricalPatternErrorCategory.InvalidTimestamp, "Query date is invalid.")); if (query.filter?.fromDate !== undefined && query.filter.toDate !== undefined && Date.parse(query.filter.fromDate) > Date.parse(query.filter.toDate)) errors.push(error(HistoricalPatternErrorCategory.InvalidDateRange, "Query date range is reversed.")); return result(errors); }
export function throwIfInvalidHistorical(validation: HistoricalPatternValidation): void { if (!validation.valid) { const first = validation.errors[0] as HistoricalPatternError; const failure = new Error(`${first.category}: ${first.message}`); Object.assign(failure, { category: first.category }); throw failure; } }
