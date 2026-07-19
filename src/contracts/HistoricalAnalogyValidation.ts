import { AIAuditActorType } from "./AIAuditRepository";
import { PrivacyLevel } from "./AIRouter";
import {
  ANALOGY_SCORE_SCALE,
  AnalogyComparisonMethod,
  AnalogyDimensionValueType,
  AnalogyMissingDataPolicy,
  AnalogyMissingDataState,
  AnalogyNormalizationPolicy,
  AnalogyQualityClassification,
  AnalogyWeightProfileStatus,
  HistoricalAnalogyErrorCategory,
  HistoricalAnalogyStatus,
  HistoricalCandidateType,
  type AnalogyAmendment,
  type AnalogyDimensionValue,
  type AnalogyFilter,
  type AnalogyQuery,
  type AnalogyReview,
  type AnalogyScore,
  type AnalogySupersession,
  type AnalogyWeightProfile,
  type CurrentSituationSnapshot,
  type HistoricalAnalogyError,
  type HistoricalAnalogyLifecycle,
  type HistoricalAnalogyRecord,
  type HistoricalAnalogyRequest,
  type HistoricalAnalogyValidation,
  type HistoricalCandidateReference,
} from "./HistoricalAnalogy";
import { HistoricalEventStatus, HistoricalPatternStatus } from "./HistoricalPattern";
import { canonicalizeHistoricalValue, historicalFingerprint } from "./HistoricalPatternValidation";

const REQUEST_ID = /^analogy-request:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const ANALOGY_ID = /^historical-analogy:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SNAPSHOT_ID = /^current-situation:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const PROFILE_ID = /^analogy-weight-profile:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,179}$/;
const SECRET_KEY = /(api[_-]?key|secret|token|password|credential|private[_-]?key|authorization|bearer)/i;
const GUARANTEE = /\b(guarantee(?:d|s)?|will repeat|will recur|certain to|must recur|cannot fail|history repeats)\b/i;
const TRADE = /\b(buy|sell|short|long position|enter (?:a )?trade|execute (?:a )?trade|trading signal|recommended trade)\b/i;

const transitions: Readonly<Record<HistoricalAnalogyStatus, ReadonlyArray<HistoricalAnalogyStatus>>> = {
  [HistoricalAnalogyStatus.Proposed]: [HistoricalAnalogyStatus.Validating, HistoricalAnalogyStatus.Rejected],
  [HistoricalAnalogyStatus.Validating]: [HistoricalAnalogyStatus.Completed, HistoricalAnalogyStatus.Rejected],
  [HistoricalAnalogyStatus.Completed]: [HistoricalAnalogyStatus.Reviewed, HistoricalAnalogyStatus.Superseded, HistoricalAnalogyStatus.Archived],
  [HistoricalAnalogyStatus.Reviewed]: [HistoricalAnalogyStatus.Superseded, HistoricalAnalogyStatus.Archived],
  [HistoricalAnalogyStatus.Superseded]: [HistoricalAnalogyStatus.Archived],
  [HistoricalAnalogyStatus.Archived]: [],
  [HistoricalAnalogyStatus.Rejected]: [],
};

function err(category: HistoricalAnalogyErrorCategory, message: string, field?: string): HistoricalAnalogyError { return field === undefined ? { category, message } : { category, message, field }; }
function result(errors: HistoricalAnalogyError[]): HistoricalAnalogyValidation { return { valid: errors.length === 0, errors }; }
function nonEmpty(value: string): boolean { return value.trim().length > 0; }
function validTimestamp(value: string): boolean { return Number.isFinite(Date.parse(value)); }
function validScore(value: number): boolean { return Number.isSafeInteger(value) && value >= 0 && value <= ANALOGY_SCORE_SCALE; }
function unique<T>(values: ReadonlyArray<T>): boolean { return new Set(values).size === values.length; }
function validateMetadata(metadata: Readonly<Record<string, unknown>>, errors: HistoricalAnalogyError[]): void { if (Object.keys(metadata).some((key) => SECRET_KEY.test(key))) errors.push(err(HistoricalAnalogyErrorCategory.SecretMetadata, "Secret-bearing metadata keys are forbidden.", "metadata")); }

export function canonicalizeHistoricalAnalogyValue(value: unknown): string { return canonicalizeHistoricalValue(value); }
export function historicalAnalogyFingerprint(value: unknown): string { return historicalFingerprint(value); }

export function validateAnalogyDimensionValue(value: AnalogyDimensionValue): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  const supplied = [value.normalizedValue !== undefined, value.numericValue !== undefined, value.booleanValue !== undefined, value.setValues !== undefined].filter(Boolean).length;
  if (value.missing && supplied > 0) errors.push(err(HistoricalAnalogyErrorCategory.MissingData, "Missing dimension value cannot contain a supplied value."));
  if (!value.missing && supplied !== 1) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Present dimension value must contain exactly one typed value."));
  if (value.numericValue !== undefined && !Number.isFinite(value.numericValue)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "Numeric dimension value must be finite."));
  if (value.setValues !== undefined && (!unique(value.setValues) || value.setValues.some((item) => !nonEmpty(item)))) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Set dimension values must be non-empty and unique."));
  const expected = value.valueType === AnalogyDimensionValueType.Number ? value.numericValue !== undefined
    : value.valueType === AnalogyDimensionValueType.Boolean ? value.booleanValue !== undefined
    : value.valueType === AnalogyDimensionValueType.Set ? value.setValues !== undefined
    : value.normalizedValue !== undefined;
  if (!value.missing && !expected) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Dimension value does not match its declared type."));
  return result(errors);
}

export function validateCurrentSituationSnapshot(value: CurrentSituationSnapshot, now?: string): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  if (!SNAPSHOT_ID.test(value.snapshotId)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidId, "Current-situation snapshot ID is malformed.", "snapshotId"));
  if (value.schemaVersion !== "1.0" || !nonEmpty(value.snapshotVersion)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Snapshot schema and version are required."));
  if (!validTimestamp(value.asOfTimestamp)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidTimestamp, "Snapshot as-of timestamp is invalid."));
  if (now !== undefined && validTimestamp(now) && Date.parse(value.asOfTimestamp) > Date.parse(now)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidTimestamp, "Future as-of timestamp is not allowed."));
  const dimensions = value.regime.dimensions.map((item) => item.dimension);
  if (!unique(dimensions)) errors.push(err(HistoricalAnalogyErrorCategory.DuplicateDimension, "Snapshot dimensions must be unique."));
  for (const feature of value.regime.dimensions) {
    if (!RECORD_ID.test(feature.featureId) || !validScore(feature.confidence)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Snapshot feature identity or confidence is invalid.", feature.featureId));
    errors.push(...validateAnalogyDimensionValue(feature.value).errors);
  }
  if (!unique(value.missingDimensions)) errors.push(err(HistoricalAnalogyErrorCategory.DuplicateDimension, "Missing snapshot dimensions must be unique."));
  if (value.missingDimensions.some((dimension) => value.regime.dimensions.some((item) => item.dimension === dimension && !item.value.missing))) errors.push(err(HistoricalAnalogyErrorCategory.MissingData, "A present snapshot dimension cannot also be declared missing."));
  if (value.sourceReferences.some((reference) => reference.resolved && reference.version === undefined)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidReference, "Resolved source references must freeze a version."));
  validateMetadata(value.metadata, errors);
  return result(errors);
}

export function validateHistoricalCandidate(value: HistoricalCandidateReference, requireCurrent = true): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  if (!RECORD_ID.test(value.recordId) || !nonEmpty(value.recordVersion) || !nonEmpty(value.title) || !nonEmpty(value.summary)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Candidate identity, version, title, and summary are required."));
  const allowedEvent = [HistoricalEventStatus.Finalized, HistoricalEventStatus.Reviewed];
  const allowedPattern = [HistoricalPatternStatus.Finalized, HistoricalPatternStatus.Reviewed];
  if (value.candidateType === HistoricalCandidateType.Event && !allowedEvent.includes(value.lifecycleStatus as HistoricalEventStatus)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Historical Event candidate must be finalized or reviewed."));
  if (value.candidateType === HistoricalCandidateType.Pattern && !allowedPattern.includes(value.lifecycleStatus as HistoricalPatternStatus)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Historical Pattern candidate must be finalized or reviewed."));
  if (requireCurrent && value.superseded) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Superseded candidate is not eligible under current-only policy."));
  if (value.evidenceReferenceIds.length === 0 || value.sourceCount < 1) errors.push(err(HistoricalAnalogyErrorCategory.MissingEvidence, "Candidate requires historical evidence and at least one source."));
  if (value.candidateType === HistoricalCandidateType.Pattern && value.supportingEventCount < 1) errors.push(err(HistoricalAnalogyErrorCategory.MissingEvidence, "Historical Pattern candidate requires supporting events."));
  if (!validScore(value.qualityScore)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Candidate quality score is invalid."));
  const dimensions = value.dimensionValues.map((item) => item.dimension);
  if (!unique(dimensions)) errors.push(err(HistoricalAnalogyErrorCategory.DuplicateDimension, "Candidate dimensions must be unique."));
  for (const item of value.dimensionValues) { if (!validScore(item.confidence)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Candidate dimension confidence is invalid.")); errors.push(...validateAnalogyDimensionValue(item.value).errors); }
  if (value.historicalOutcomeEvidence.some((item) => item.explicitlyNotForecast !== true || GUARANTEE.test(item.observation) || TRADE.test(item.observation))) errors.push(err(HistoricalAnalogyErrorCategory.ProhibitedConclusion, "Historical outcomes must remain observations, not forecasts or trade recommendations."));
  return result(errors);
}

export function weightProfileFingerprint(value: Omit<AnalogyWeightProfile, "fingerprint">): string { return historicalAnalogyFingerprint(value); }

export function validateAnalogyWeightProfile(value: AnalogyWeightProfile): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  if (!PROFILE_ID.test(value.profileId) || value.schemaVersion !== "1.0" || !nonEmpty(value.version) || !nonEmpty(value.title) || !nonEmpty(value.purpose)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidWeightProfile, "Weight profile identity and description are required."));
  if (value.normalizationScale !== ANALOGY_SCORE_SCALE) errors.push(err(HistoricalAnalogyErrorCategory.InvalidNormalization, "Weight profile must use the 10,000-point scale."));
  const dimensions = value.weights.map((item) => item.dimension);
  if (!unique(dimensions)) errors.push(err(HistoricalAnalogyErrorCategory.DuplicateDimension, "Weight profile dimensions must be unique."));
  if (value.weights.length === 0 || value.weights.some((item) => !Number.isSafeInteger(item.weight) || item.weight < 0)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidWeight, "Weights must be finite non-negative safe integers."));
  const sum = value.weights.reduce((total, item) => total + item.weight, 0);
  if (!Number.isSafeInteger(sum) || sum <= 0) errors.push(err(HistoricalAnalogyErrorCategory.ZeroDenominator, "Weight profile must have a positive eligible denominator."));
  if (value.normalizationPolicy === AnalogyNormalizationPolicy.SumToScale && sum !== ANALOGY_SCORE_SCALE) errors.push(err(HistoricalAnalogyErrorCategory.InvalidNormalization, "SUM_TO_SCALE weights must total 10,000."));
  if (!unique(value.requiredDimensions) || !unique(value.optionalDimensions) || !unique(value.excludedDimensions)) errors.push(err(HistoricalAnalogyErrorCategory.DuplicateDimension, "Required, optional, and excluded dimensions must be unique."));
  if (value.requiredDimensions.some((dimension) => value.excludedDimensions.includes(dimension))) errors.push(err(HistoricalAnalogyErrorCategory.InvalidWeightProfile, "Required dimensions cannot also be excluded."));
  if (value.weights.some((item) => !Object.values(AnalogyComparisonMethod).includes(item.comparisonMethod))) errors.push(err(HistoricalAnalogyErrorCategory.InvalidWeightProfile, "Comparison method is invalid."));
  if (value.minimumEvidenceReferences < 1 || !Number.isSafeInteger(value.minimumEvidenceReferences) || !validScore(value.minimumCandidateQuality) || !validScore(value.highQualityThreshold) || !validScore(value.moderateQualityThreshold) || value.highQualityThreshold < value.moderateQualityThreshold) errors.push(err(HistoricalAnalogyErrorCategory.InvalidWeightProfile, "Weight profile evidence and threshold policy is invalid."));
  if (value.status === AnalogyWeightProfileStatus.Active && (value.ownerApprovalReference === undefined || value.ownerApproverActorType !== AIAuditActorType.Owner || value.effectiveAt === undefined || !validTimestamp(value.effectiveAt))) errors.push(err(HistoricalAnalogyErrorCategory.OwnerApprovalRequired, "Active weight profile requires explicit owner approval and effective timestamp."));
  if (value.retiredAt !== undefined && (!validTimestamp(value.retiredAt) || value.effectiveAt === undefined || Date.parse(value.retiredAt) < Date.parse(value.effectiveAt))) errors.push(err(HistoricalAnalogyErrorCategory.InvalidTimestamp, "Weight profile retirement timestamp is invalid."));
  const { fingerprint: _fingerprint, ...payload } = value;
  if (value.fingerprint !== weightProfileFingerprint(payload)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidWeightProfile, "Weight profile fingerprint does not match canonical content."));
  return result(errors);
}

export function validateHistoricalAnalogyRequest(value: HistoricalAnalogyRequest): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  if (!REQUEST_ID.test(value.requestId) || value.schemaVersion !== "1.0" || !nonEmpty(value.requestVersion)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidId, "Analogy request identity is malformed."));
  if (!validTimestamp(value.createdAt) || !SNAPSHOT_ID.test(value.currentSnapshotId) || !PROFILE_ID.test(value.weightProfileId) || !nonEmpty(value.weightProfileVersion)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Analogy request timestamp and frozen references are required."));
  if (value.candidateReferences.length === 0) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Analogy request requires at least one candidate."));
  const candidates = value.candidateReferences.map((candidate) => `${candidate.candidateType}:${candidate.recordId}:${candidate.recordVersion}`);
  if (!unique(candidates)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidCandidate, "Analogy request candidates must be unique."));
  for (const candidate of value.candidateReferences) errors.push(...validateHistoricalCandidate(candidate, value.requireCurrentCandidates).errors);
  if (!Number.isSafeInteger(value.maximumResultCount) || value.maximumResultCount <= 0 || value.maximumResultCount > 1000) errors.push(err(HistoricalAnalogyErrorCategory.InvalidPagination, "Maximum result count must be from 1 through 1,000."));
  validateMetadata(value.metadata, errors);
  return result(errors);
}

export function validateAnalogyScore(value: AnalogyScore): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  if (value.scale !== ANALOGY_SCORE_SCALE) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "Analogy score scale must be 10,000."));
  const integers = [value.totalEligibleWeight, value.comparedWeight, value.missingWeight, value.similarityPoints, value.differencePoints];
  if (integers.some((item) => !Number.isSafeInteger(item) || item < 0)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "Score weights and points must be non-negative safe integers."));
  if (value.totalEligibleWeight <= 0) errors.push(err(HistoricalAnalogyErrorCategory.ZeroDenominator, "Analogy score has zero eligible denominator."));
  if (value.comparedWeight > value.totalEligibleWeight || value.missingWeight > value.totalEligibleWeight || value.comparedWeight + value.missingWeight > value.totalEligibleWeight) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "Compared and missing weights exceed eligible weight."));
  for (const score of [value.normalizedSimilarityScore, value.normalizedDifferenceScore, value.completenessScore, value.evidenceQualityScore, value.candidateQualityScore]) if (!validScore(score)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "All normalized scores must be integer basis points from 0 through 10,000."));
  if (value.components.some((component) => component.similarityBasisPoints + component.differenceBasisPoints !== ANALOGY_SCORE_SCALE || !validScore(component.similarityBasisPoints) || !validScore(component.differenceBasisPoints))) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "Score components must preserve separate complementary similarity and difference values."));
  return result(errors);
}

function validateLifecycle(history: ReadonlyArray<HistoricalAnalogyLifecycle>, analogyId: string, status: HistoricalAnalogyStatus, errors: HistoricalAnalogyError[]): void {
  if (history.length < 2) { errors.push(err(HistoricalAnalogyErrorCategory.InvalidLifecycle, "Completed analogy requires proposed and validating provenance.")); return; }
  for (let index = 0; index < history.length; index += 1) { const item = history[index]; if (item === undefined || item.analogyId !== analogyId || item.lifecycleSequence !== index + 1 || !validTimestamp(item.occurredAt) || !transitions[item.fromStatus].includes(item.toStatus) || index > 0 && history[index - 1]?.toStatus !== item.fromStatus) errors.push(err(HistoricalAnalogyErrorCategory.InvalidLifecycle, "Analogy lifecycle is invalid.")); }
  if (history.at(-1)?.toStatus !== status) errors.push(err(HistoricalAnalogyErrorCategory.InvalidLifecycle, "Analogy lifecycle terminal status does not match record status."));
}

export function validateHistoricalAnalogyRecord(value: HistoricalAnalogyRecord): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  if (!ANALOGY_ID.test(value.analogyId) || !REQUEST_ID.test(value.requestId) || value.schemaVersion !== "1.0" || !nonEmpty(value.recordVersion)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidId, "Historical analogy identity is malformed."));
  if (value.status !== HistoricalAnalogyStatus.Completed) errors.push(err(HistoricalAnalogyErrorCategory.InvalidLifecycle, "New authoritative analogy must be COMPLETED."));
  if (!validTimestamp(value.comparisonTimestamp)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidTimestamp, "Comparison timestamp is invalid."));
  errors.push(...validateHistoricalCandidate(value.candidateReference, false).errors, ...validateAnalogyScore(value.score).errors);
  const dimensions = value.dimensionResults.map((item) => item.dimension);
  if (!unique(dimensions)) errors.push(err(HistoricalAnalogyErrorCategory.DuplicateDimension, "Analogy dimension results must be unique."));
  if (value.dimensionResults.some((item) => item.missingDataState !== AnalogyMissingDataState.Present && item.similarityContribution > 0 && !item.excluded)) errors.push(err(HistoricalAnalogyErrorCategory.MissingData, "Missing dimensions cannot create positive similarity."));
  if (value.quality.classification === AnalogyQualityClassification.High && value.score.completenessScore < 8000) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "Low completeness cannot be classified as high comparison quality."));
  const text = [value.candidateReference.summary, ...value.historicalOutcomeEvidence.map((item) => item.observation)].join(" ");
  if (GUARANTEE.test(text)) errors.push(err(HistoricalAnalogyErrorCategory.ProhibitedConclusion, "Analogy output cannot claim guaranteed recurrence."));
  if (TRADE.test(text)) errors.push(err(HistoricalAnalogyErrorCategory.ProhibitedConclusion, "Analogy output cannot contain a trading recommendation."));
  if (value.historicalOutcomeEvidence.some((item) => item.explicitlyNotForecast !== true)) errors.push(err(HistoricalAnalogyErrorCategory.ProhibitedConclusion, "Historical outcome evidence must be explicitly marked as not a forecast."));
  if (value.reviewRequired !== value.quality.reviewRequired) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Review-required state must match quality assessment."));
  validateLifecycle(value.history, value.analogyId, value.status, errors);
  validateMetadata(value.metadata, errors);
  return result(errors);
}

export function validateAnalogyLifecycle(value: HistoricalAnalogyLifecycle, current: HistoricalAnalogyRecord): HistoricalAnalogyValidation { const errors: HistoricalAnalogyError[] = []; if (value.analogyId !== current.analogyId || value.lifecycleSequence !== current.history.length + 1 || value.fromStatus !== current.status || !transitions[current.status].includes(value.toStatus) || !validTimestamp(value.occurredAt)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidLifecycle, "Analogy lifecycle transition is invalid.")); return result(errors); }
export function validateAnalogyReview(value: AnalogyReview, current?: HistoricalAnalogyRecord): HistoricalAnalogyValidation { const errors: HistoricalAnalogyError[] = []; if (!RECORD_ID.test(value.reviewId) || !validTimestamp(value.createdAt) || !nonEmpty(value.reviewer) || !nonEmpty(value.rationale)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Analogy review is malformed.")); if (current === undefined || value.analogyId !== current.analogyId || ![HistoricalAnalogyStatus.Completed, HistoricalAnalogyStatus.Reviewed].includes(current.status)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidLifecycle, "Review requires a completed analogy.")); return result(errors); }
export function validateAnalogyAmendment(value: AnalogyAmendment, current?: HistoricalAnalogyRecord): HistoricalAnalogyValidation { const errors: HistoricalAnalogyError[] = []; if (!RECORD_ID.test(value.amendmentId) || !validTimestamp(value.createdAt) || !nonEmpty(value.reason) || !nonEmpty(value.authorReference)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Analogy amendment is malformed.")); if (current === undefined || value.analogyId !== current.analogyId) errors.push(err(HistoricalAnalogyErrorCategory.RecordNotFound, "Amendment requires its original analogy.")); if (value.parentAmendmentId === value.amendmentId) errors.push(err(HistoricalAnalogyErrorCategory.InvalidReference, "Amendment cannot self-reference.")); return result(errors); }
export function validateAnalogySupersession(value: AnalogySupersession, prior?: HistoricalAnalogyRecord, successor?: HistoricalAnalogyRecord): HistoricalAnalogyValidation { const errors: HistoricalAnalogyError[] = []; if (!RECORD_ID.test(value.supersessionId) || !validTimestamp(value.createdAt) || !nonEmpty(value.reason) || !nonEmpty(value.ownerReference)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Analogy supersession is malformed.")); if (prior === undefined || successor === undefined) errors.push(err(HistoricalAnalogyErrorCategory.RecordNotFound, "Supersession requires prior and successor analogy records.")); if (value.priorAnalogyId === value.successorAnalogyId) errors.push(err(HistoricalAnalogyErrorCategory.InvalidReference, "Analogy cannot supersede itself.")); if (![value.changedSnapshot, value.changedCandidateVersion, value.changedWeightProfile, value.changedScoringMethod].some(Boolean)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidRecord, "Supersession must identify a material frozen-input change.")); return result(errors); }

export function validateAnalogyQuery(value: AnalogyQuery): HistoricalAnalogyValidation {
  const errors: HistoricalAnalogyError[] = [];
  if (value.offset !== undefined && (!Number.isSafeInteger(value.offset) || value.offset < 0) || value.limit !== undefined && (!Number.isSafeInteger(value.limit) || value.limit <= 0 || value.limit > 1000)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidPagination, "Pagination requires non-negative offset and limit from 1 through 1,000."));
  const filter: AnalogyFilter | undefined = value.filter;
  const ranges = [[filter?.minimumSimilarityScore, filter?.maximumSimilarityScore], [filter?.minimumCompletenessScore, filter?.maximumCompletenessScore]] as const;
  for (const [minimum, maximum] of ranges) { if (minimum !== undefined && !validScore(minimum) || maximum !== undefined && !validScore(maximum) || minimum !== undefined && maximum !== undefined && minimum > maximum) errors.push(err(HistoricalAnalogyErrorCategory.InvalidScore, "Query score range is invalid.")); }
  if (filter?.fromTimestamp !== undefined && !validTimestamp(filter.fromTimestamp) || filter?.toTimestamp !== undefined && !validTimestamp(filter.toTimestamp) || filter?.fromTimestamp !== undefined && filter.toTimestamp !== undefined && Date.parse(filter.fromTimestamp) > Date.parse(filter.toTimestamp)) errors.push(err(HistoricalAnalogyErrorCategory.InvalidTimestamp, "Query timestamp range is invalid."));
  return result(errors);
}

export function missingState(current?: AnalogyDimensionValue, historical?: AnalogyDimensionValue): AnalogyMissingDataState {
  const currentMissing = current === undefined || current.missing;
  const historicalMissing = historical === undefined || historical.missing;
  if (currentMissing && historicalMissing) return AnalogyMissingDataState.MissingBoth;
  if (currentMissing) return AnalogyMissingDataState.MissingCurrent;
  if (historicalMissing) return AnalogyMissingDataState.MissingHistorical;
  return AnalogyMissingDataState.Present;
}

export function throwIfInvalidHistoricalAnalogy(validation: HistoricalAnalogyValidation): void {
  if (!validation.valid) { const first = validation.errors[0] as HistoricalAnalogyError; const failure = new Error(`${first.category}: ${first.message}`); Object.assign(failure, { category: first.category }); throw failure; }
}
