import {
  ANALOGY_SCORE_SCALE,
  AnalogyBiasRiskType,
  AnalogyComparisonMethod,
  AnalogyConfidenceLevel,
  AnalogyDimensionType,
  AnalogyDimensionValueType,
  AnalogyExclusionReason,
  AnalogyMissingDataPolicy,
  AnalogyMissingDataState,
  AnalogyQualityClassification,
  AnalogyRiskSeverity,
  AnalogyScoreMethod,
  AnalogyWeightProfileStatus,
  HistoricalAnalogyErrorCategory,
  HistoricalAnalogyStatus,
  HistoricalCandidateType,
  HistoricalEventStatus,
  HistoricalPatternStatus,
  HistoricalRecordKind,
  regimeTypeToAnalogyDimension,
  missingState,
  throwIfInvalidHistoricalAnalogy,
  validateAnalogyLifecycle,
  validateAnalogyWeightProfile,
  validateCurrentSituationSnapshot,
  validateHistoricalAnalogyRecord,
  validateHistoricalAnalogyRequest,
  validateHistoricalCandidate,
  type AnalogyAmendment,
  type AnalogyAppendStatus,
  type AnalogyBiasRisk,
  type AnalogyDifferenceEvidence,
  type AnalogyDimensionResult,
  type AnalogyDimensionValue,
  type AnalogyExclusion,
  type AnalogyHistory,
  type AnalogyInvalidationCondition,
  type AnalogyLimitation,
  type AnalogyMissingData,
  type AnalogyOutcomeEvidence,
  type AnalogyQuery,
  type AnalogyReview,
  type AnalogyScore,
  type AnalogyScoreComponent,
  type AnalogySimilarityEvidence,
  type AnalogyStatistics,
  type AnalogySummary,
  type AnalogySupersession,
  type AnalogyWeightProfile,
  type CurrentSituationSnapshot,
  type HistoricalAnalogyAppendResult,
  type HistoricalAnalogyLifecycle,
  type HistoricalAnalogyRecord,
  type HistoricalAnalogyRepository,
  type HistoricalAnalogyRequest,
  type HistoricalCandidateReference,
  type HistoricalPatternQuery,
  type HistoricalPatternRepository,
} from "../../contracts";

export interface HistoricalAnalogyClock { now(): string; }
export class SystemHistoricalAnalogyClock implements HistoricalAnalogyClock { now(): string { return new Date().toISOString(); } }
export interface HistoricalAnalogyCompletionInput {
  readonly analogyId: string;
  readonly recordVersion: string;
  readonly requestId: string;
  readonly candidateId: string;
  readonly limitations?: ReadonlyArray<AnalogyLimitation>;
  readonly biasRisks?: ReadonlyArray<AnalogyBiasRisk>;
  readonly invalidationConditions?: ReadonlyArray<AnalogyInvalidationCondition>;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}
export interface HistoricalCandidateSelection { readonly eventQuery?: HistoricalPatternQuery; readonly patternQuery?: HistoricalPatternQuery; }

function fail(category: HistoricalAnalogyErrorCategory, message: string): never { const error = new Error(`${category}: ${message}`); Object.assign(error, { category }); throw error; }
function roundRatio(numerator: number, denominator: number): number { if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) fail(HistoricalAnalogyErrorCategory.InvalidScore, "Fixed-scale arithmetic received invalid integers."); const product = numerator * ANALOGY_SCORE_SCALE; if (!Number.isSafeInteger(product)) fail(HistoricalAnalogyErrorCategory.InvalidScore, "Fixed-scale arithmetic overflow."); return Math.min(ANALOGY_SCORE_SCALE, Math.floor((product + Math.floor(denominator / 2)) / denominator)); }
function weightedBasisPoints(weight: number, basisPoints: number): number { const product = weight * basisPoints; if (!Number.isSafeInteger(product) || product < 0) fail(HistoricalAnalogyErrorCategory.InvalidScore, "Weighted score arithmetic overflow."); return Math.floor((product + Math.floor(ANALOGY_SCORE_SCALE / 2)) / ANALOGY_SCORE_SCALE); }
function normalizedText(value: AnalogyDimensionValue): string | undefined { return value.normalizedValue?.trim().toUpperCase(); }
function similarityFor(current: AnalogyDimensionValue, historical: AnalogyDimensionValue, method: AnalogyComparisonMethod): number {
  if (current.valueType !== historical.valueType) return 0;
  if (method === AnalogyComparisonMethod.Exact) {
    if (current.valueType === AnalogyDimensionValueType.Number) return current.numericValue === historical.numericValue ? ANALOGY_SCORE_SCALE : 0;
    if (current.valueType === AnalogyDimensionValueType.Boolean) return current.booleanValue === historical.booleanValue ? ANALOGY_SCORE_SCALE : 0;
    if (current.valueType === AnalogyDimensionValueType.Set) return JSON.stringify([...(current.setValues ?? [])].sort()) === JSON.stringify([...(historical.setValues ?? [])].sort()) ? ANALOGY_SCORE_SCALE : 0;
    return normalizedText(current) === normalizedText(historical) ? ANALOGY_SCORE_SCALE : 0;
  }
  if (method === AnalogyComparisonMethod.NumericDistance || method === AnalogyComparisonMethod.Ordinal) {
    if (current.numericValue === undefined || historical.numericValue === undefined) return 0;
    const denominator = Math.max(Math.abs(current.numericValue), Math.abs(historical.numericValue), 1);
    const distance = Math.abs(current.numericValue - historical.numericValue);
    const penalty = Math.min(ANALOGY_SCORE_SCALE, Math.round(distance / denominator * ANALOGY_SCORE_SCALE));
    return ANALOGY_SCORE_SCALE - penalty;
  }
  if (method === AnalogyComparisonMethod.SetOverlap) {
    const currentSet = new Set((current.setValues ?? []).map((item) => item.trim().toUpperCase()));
    const historicalSet = new Set((historical.setValues ?? []).map((item) => item.trim().toUpperCase()));
    const union = new Set([...currentSet, ...historicalSet]);
    if (union.size === 0) return 0;
    const intersection = [...currentSet].filter((item) => historicalSet.has(item)).length;
    return roundRatio(intersection, union.size);
  }
  return 0;
}
function severityFor(difference: number): AnalogyRiskSeverity { return difference >= 8000 ? AnalogyRiskSeverity.Critical : difference >= 6000 ? AnalogyRiskSeverity.High : difference >= 3000 ? AnalogyRiskSeverity.Medium : AnalogyRiskSeverity.Low; }
function levelFor(value: number): AnalogyConfidenceLevel { return value >= 8000 ? AnalogyConfidenceLevel.High : value >= 6000 ? AnalogyConfidenceLevel.Moderate : value >= 3000 ? AnalogyConfidenceLevel.Low : AnalogyConfidenceLevel.Insufficient; }
function bucket(value: number): string { return value >= 8000 ? "8000-10000" : value >= 6000 ? "6000-7999" : value >= 3000 ? "3000-5999" : "0-2999"; }

export class HistoricalAnalogyEngine {
  constructor(
    private readonly repository: HistoricalAnalogyRepository,
    private readonly historicalRepository?: HistoricalPatternRepository,
    private readonly clock: HistoricalAnalogyClock = new SystemHistoricalAnalogyClock(),
  ) {}

  createRequest(value: HistoricalAnalogyRequest): HistoricalAnalogyAppendResult<HistoricalAnalogyRequest> { throwIfInvalidHistoricalAnalogy(validateHistoricalAnalogyRequest(value)); return this.repository.appendRequest(structuredClone(value), this.clock.now()); }
  freezeSnapshot(value: CurrentSituationSnapshot): HistoricalAnalogyAppendResult<CurrentSituationSnapshot> { throwIfInvalidHistoricalAnalogy(validateCurrentSituationSnapshot(value, this.clock.now())); return this.repository.appendSnapshot(structuredClone(value), this.clock.now()); }
  registerWeightProfile(value: AnalogyWeightProfile): HistoricalAnalogyAppendResult<AnalogyWeightProfile> { throwIfInvalidHistoricalAnalogy(validateAnalogyWeightProfile(value)); return this.repository.appendWeightProfile(structuredClone(value), this.clock.now()); }

  selectCandidates(selection: HistoricalCandidateSelection): ReadonlyArray<HistoricalCandidateReference> {
    if (this.historicalRepository === undefined) fail(HistoricalAnalogyErrorCategory.InvalidReference, "Historical Pattern repository is required for candidate selection.");
    const events = selection.eventQuery === undefined ? [] : this.historicalRepository.queryEvents(selection.eventQuery).map((value) => this.candidateFromHistorical(HistoricalCandidateType.Event, value.eventId));
    const patterns = selection.patternQuery === undefined ? [] : this.historicalRepository.queryPatterns(selection.patternQuery).map((value) => this.candidateFromHistorical(HistoricalCandidateType.Pattern, value.patternId));
    return [...events, ...patterns].sort((a, b) => a.recordId.localeCompare(b.recordId)).map((value) => structuredClone(value));
  }

  candidateFromHistorical(type: HistoricalCandidateType, id: string): HistoricalCandidateReference {
    if (this.historicalRepository === undefined) fail(HistoricalAnalogyErrorCategory.InvalidReference, "Historical Pattern repository is required to freeze candidates.");
    if (type === HistoricalCandidateType.Event) {
      const value = this.historicalRepository.getEventById(id); if (value === undefined) fail(HistoricalAnalogyErrorCategory.RecordNotFound, "Historical Event candidate does not exist.");
      const dimensionValues = value.marketRegime.dimensions.map((item) => ({ dimension: regimeTypeToAnalogyDimension(item.dimension), value: item.state === "UNKNOWN" ? { valueType: AnalogyDimensionValueType.Category, missing: true } as const : { valueType: AnalogyDimensionValueType.Category, normalizedValue: item.value ?? item.competingValues?.join("|") ?? item.state, missing: false } as const, evidenceReferenceIds: structuredClone(item.evidenceReferenceIds), confidence: Math.round(item.confidence * 100) }));
      const eventType = { dimension: AnalogyDimensionType.EventType, value: { valueType: AnalogyDimensionValueType.Set, setValues: value.eventCategories.map(String), missing: false } as const, evidenceReferenceIds: value.evidence.map((item) => item.evidenceId), confidence: Math.round(Math.max(...value.evidence.map((item) => item.confidence), 0) * 100) };
      const candidate: HistoricalCandidateReference = { candidateType: type, recordId: value.eventId, recordVersion: value.recordVersion, lifecycleStatus: value.status, title: value.title, summary: value.factualDescription, ...(value.start.value === undefined ? {} : { applicablePeriod: value.start.value }), regimeSummary: value.marketRegime.summary, dimensionValues: [eventType, ...dimensionValues], evidenceReferenceIds: value.evidence.map((item) => item.evidenceId), sourceCount: value.sources.length, supportingEventCount: 1, limitations: structuredClone(value.uncertainties), superseded: value.status === HistoricalEventStatus.Superseded, historicalOutcomeEvidence: value.outcomes.map((item) => ({ outcomeId: item.outcomeId, observation: item.statement, ...(item.horizon === undefined ? {} : { horizon: item.horizon }), evidenceReferenceIds: structuredClone(item.evidenceReferenceIds), explicitlyNotForecast: true })), qualityScore: Math.round(value.sources.reduce((sum, source) => sum + source.reliabilityScore, 0) / Math.max(value.sources.length, 1) * 100) };
      throwIfInvalidHistoricalAnalogy(validateHistoricalCandidate(candidate, false)); return structuredClone(candidate);
    }
    const value = this.historicalRepository.getPatternById(id); if (value === undefined) fail(HistoricalAnalogyErrorCategory.RecordNotFound, "Historical Pattern candidate does not exist.");
    const dimensionValues = value.regimeDependencies.map((item) => ({ dimension: regimeTypeToAnalogyDimension(item.dimension), value: item.state === "UNKNOWN" ? { valueType: AnalogyDimensionValueType.Category, missing: true } as const : { valueType: AnalogyDimensionValueType.Category, normalizedValue: item.value ?? item.competingValues?.join("|") ?? item.state, missing: false } as const, evidenceReferenceIds: structuredClone(item.evidenceReferenceIds), confidence: Math.round(item.confidence * 100) }));
    const sourceIds = new Set(value.evidence.flatMap((item) => item.sourceReferenceIds));
    const candidate: HistoricalCandidateReference = { candidateType: type, recordId: value.patternId, recordVersion: value.recordVersion, lifecycleStatus: value.status, title: value.title, summary: value.description, regimeSummary: value.regimeDependencies.map((item) => `${item.dimension}:${item.value ?? item.state}`).join(", "), dimensionValues, evidenceReferenceIds: value.evidence.map((item) => item.evidenceId), sourceCount: sourceIds.size, supportingEventCount: value.sourceEventIds.length, limitations: value.limitations.map((item) => item.statement), superseded: value.status === HistoricalPatternStatus.Superseded, historicalOutcomeEvidence: value.typicalAssetReactions.map((item) => ({ outcomeId: item.reactionId, observation: `Historical pattern reaction observed as ${item.direction} over ${item.observationWindow.horizon}.`, horizon: item.observationWindow.horizon, evidenceReferenceIds: structuredClone(item.dataSourceReferenceIds), explicitlyNotForecast: true })), qualityScore: Math.round(value.confidence.score * 100) };
    throwIfInvalidHistoricalAnalogy(validateHistoricalCandidate(candidate, false)); return structuredClone(candidate);
  }

  complete(input: HistoricalAnalogyCompletionInput): HistoricalAnalogyAppendResult<HistoricalAnalogyRecord> {
    const request = this.repository.getRequestById(input.requestId); if (request === undefined) fail(HistoricalAnalogyErrorCategory.RecordNotFound, "Analogy request does not exist.");
    const snapshot = this.repository.getSnapshotById(request.currentSnapshotId); if (snapshot === undefined) fail(HistoricalAnalogyErrorCategory.RecordNotFound, "Current-situation snapshot does not exist.");
    const profile = this.repository.getWeightProfile(request.weightProfileId, request.weightProfileVersion); if (profile === undefined) fail(HistoricalAnalogyErrorCategory.RecordNotFound, "Weight profile does not exist.");
    if (profile.status !== AnalogyWeightProfileStatus.Active) fail(HistoricalAnalogyErrorCategory.InvalidWeightProfile, "Only owner-approved active weight profiles may score analogies.");
    const candidate = request.candidateReferences.find((item) => item.recordId === input.candidateId); if (candidate === undefined) fail(HistoricalAnalogyErrorCategory.InvalidCandidate, "Candidate is not frozen in the request.");
    throwIfInvalidHistoricalAnalogy(validateHistoricalCandidate(candidate, request.requireCurrentCandidates));
    if (candidate.qualityScore < profile.minimumCandidateQuality || candidate.evidenceReferenceIds.length < profile.minimumEvidenceReferences) fail(HistoricalAnalogyErrorCategory.InvalidCandidate, "Candidate does not meet profile quality or evidence requirements.");
    if (this.historicalRepository !== undefined) { const frozen = this.candidateFromHistorical(candidate.candidateType, candidate.recordId); if (frozen.recordVersion !== candidate.recordVersion || frozen.lifecycleStatus !== candidate.lifecycleStatus) fail(HistoricalAnalogyErrorCategory.InvalidCandidate, "Historical candidate version or lifecycle no longer matches the frozen request."); }

    const currentByDimension = new Map(snapshot.regime.dimensions.map((item) => [item.dimension, item]));
    const historicalByDimension = new Map(candidate.dimensionValues.map((item) => [item.dimension, item]));
    const dimensionResults: AnalogyDimensionResult[] = []; const missingDimensions: AnalogyMissingData[] = []; const exclusions: AnalogyExclusion[] = []; const components: AnalogyScoreComponent[] = [];
    let totalEligibleWeight = 0; let comparedWeight = 0; let missingWeight = 0; let similarityPoints = 0; let differencePoints = 0; let evidenceWeighted = 0;
    for (const weight of profile.weights) {
      if (profile.excludedDimensions.includes(weight.dimension)) { exclusions.push({ dimension: weight.dimension, reason: AnalogyExclusionReason.ProfileExcluded, reasonCode: "PROFILE_DIMENSION_EXCLUDED" }); dimensionResults.push({ dimension: weight.dimension, comparisonMethod: weight.comparisonMethod, weight: weight.weight, similarityContribution: 0, differenceContribution: 0, confidence: 0, evidenceReferenceIds: [], missingDataState: AnalogyMissingDataState.MissingBoth, excluded: true, explanationCode: "PROFILE_EXCLUDED", limitations: ["Excluded by the frozen weight profile."] }); continue; }
      totalEligibleWeight += weight.weight;
      const current = currentByDimension.get(weight.dimension); const historical = historicalByDimension.get(weight.dimension); const state = missingState(current?.value, historical?.value); const required = profile.requiredDimensions.includes(weight.dimension);
      if (state !== AnalogyMissingDataState.Present) {
        missingWeight += weight.weight; missingDimensions.push({ dimension: weight.dimension, state, required, policyApplied: profile.missingDataPolicy, weight: weight.weight });
        if (required && profile.missingDataPolicy === AnalogyMissingDataPolicy.FailClosed) fail(HistoricalAnalogyErrorCategory.MissingData, `Required dimension ${weight.dimension} is missing under FAIL_CLOSED policy.`);
        const penalized = profile.missingDataPolicy === AnalogyMissingDataPolicy.PenalizeScore;
        if (penalized) { differencePoints += weight.weight; components.push({ dimension: weight.dimension, weight: weight.weight, similarityBasisPoints: 0, differenceBasisPoints: ANALOGY_SCORE_SCALE, similarityPoints: 0, differencePoints: weight.weight }); }
        else exclusions.push({ dimension: weight.dimension, reason: AnalogyExclusionReason.MissingData, reasonCode: `MISSING_${state}` });
        dimensionResults.push({ dimension: weight.dimension, ...(current === undefined ? {} : { currentValue: structuredClone(current.value) }), ...(historical === undefined ? {} : { historicalValue: structuredClone(historical.value) }), comparisonMethod: weight.comparisonMethod, weight: weight.weight, similarityContribution: 0, differenceContribution: penalized ? weight.weight : 0, confidence: 0, evidenceReferenceIds: [...(current?.evidenceReferenceIds ?? []), ...(historical?.evidenceReferenceIds ?? [])], missingDataState: state, excluded: !penalized, explanationCode: penalized ? "MISSING_DATA_PENALIZED" : "MISSING_DATA_EXCLUDED", limitations: ["Missing data was preserved explicitly and did not become a neutral match."] });
        continue;
      }
      const similarity = similarityFor(current!.value, historical!.value, weight.comparisonMethod); const difference = ANALOGY_SCORE_SCALE - similarity;
      const similarityContribution = weightedBasisPoints(weight.weight, similarity); const differenceContribution = weight.weight - similarityContribution; const confidence = Math.min(current!.confidence, historical!.confidence);
      comparedWeight += weight.weight; similarityPoints += similarityContribution; differencePoints += differenceContribution; evidenceWeighted += weight.weight * confidence;
      components.push({ dimension: weight.dimension, weight: weight.weight, similarityBasisPoints: similarity, differenceBasisPoints: difference, similarityPoints: similarityContribution, differencePoints: differenceContribution });
      dimensionResults.push({ dimension: weight.dimension, currentValue: structuredClone(current!.value), historicalValue: structuredClone(historical!.value), comparisonMethod: weight.comparisonMethod, weight: weight.weight, similarityContribution, differenceContribution, confidence, evidenceReferenceIds: [...current!.evidenceReferenceIds, ...historical!.evidenceReferenceIds], missingDataState: state, excluded: false, explanationCode: similarity === ANALOGY_SCORE_SCALE ? "EXACT_MATCH" : similarity === 0 ? "MATERIAL_DIFFERENCE" : "PARTIAL_MATCH", limitations: current!.disputed ? ["Current interpretation is disputed."] : [] });
    }
    if (totalEligibleWeight <= 0) fail(HistoricalAnalogyErrorCategory.ZeroDenominator, "No eligible weighted dimensions remain.");
    const similarityDenominator = profile.missingDataPolicy === AnalogyMissingDataPolicy.PenalizeScore ? totalEligibleWeight : comparedWeight;
    if (similarityDenominator <= 0) fail(HistoricalAnalogyErrorCategory.ZeroDenominator, "No comparable dimensions remain after missing-data policy.");
    const similarityScore = roundRatio(similarityPoints, similarityDenominator); const differenceScore = ANALOGY_SCORE_SCALE - similarityScore; const completenessScore = roundRatio(comparedWeight, totalEligibleWeight); const evidenceQualityScore = comparedWeight === 0 ? 0 : Math.floor((evidenceWeighted + Math.floor(comparedWeight / 2)) / comparedWeight); const candidateQualityScore = candidate.qualityScore;
    const score: AnalogyScore = { scale: ANALOGY_SCORE_SCALE, totalEligibleWeight, comparedWeight, missingWeight, similarityPoints, differencePoints, normalizedSimilarityScore: similarityScore, normalizedDifferenceScore: differenceScore, completenessScore, evidenceQualityScore, candidateQualityScore, components };
    const requiresMissingReview = missingDimensions.length > 0 && [AnalogyMissingDataPolicy.RequireReview, AnalogyMissingDataPolicy.IncompleteResult].includes(profile.missingDataPolicy);
    const criticalBias = (input.biasRisks ?? []).some((risk) => risk.severity === AnalogyRiskSeverity.Critical);
    const classification = completenessScore < 5000 || evidenceQualityScore < 3000 ? AnalogyQualityClassification.Insufficient : similarityScore >= profile.highQualityThreshold && completenessScore >= 8000 && evidenceQualityScore >= 7000 && candidateQualityScore >= 7000 ? AnalogyQualityClassification.High : similarityScore >= profile.moderateQualityThreshold && completenessScore >= 6000 ? AnalogyQualityClassification.Moderate : AnalogyQualityClassification.Low;
    const reviewRequired = requiresMissingReview || criticalBias || classification === AnalogyQualityClassification.Insufficient;
    const confidenceScore = Math.min(completenessScore, evidenceQualityScore, candidateQualityScore);
    const strongestSimilarities: AnalogySimilarityEvidence[] = dimensionResults.filter((item) => !item.excluded && item.similarityContribution > 0).sort((a, b) => b.similarityContribution - a.similarityContribution || a.dimension.localeCompare(b.dimension)).slice(0, 5).map((item, index) => ({ evidenceId: `${input.analogyId}:similarity:${String(index + 1)}`, dimension: item.dimension, statementCode: item.explanationCode, evidenceReferenceIds: structuredClone(item.evidenceReferenceIds), contribution: item.similarityContribution }));
    const strongestDifferences: AnalogyDifferenceEvidence[] = dimensionResults.filter((item) => !item.excluded && item.differenceContribution > 0).sort((a, b) => b.differenceContribution - a.differenceContribution || a.dimension.localeCompare(b.dimension)).slice(0, 5).map((item, index) => ({ evidenceId: `${input.analogyId}:difference:${String(index + 1)}`, dimension: item.dimension, statementCode: item.explanationCode, evidenceReferenceIds: structuredClone(item.evidenceReferenceIds), contribution: item.differenceContribution, severity: severityFor(item.excluded ? 0 : ANALOGY_SCORE_SCALE - (components.find((component) => component.dimension === item.dimension)?.similarityBasisPoints ?? 0)) }));
    const regimeDifferences = strongestDifferences.filter((item) => [AnalogyDimensionType.MonetaryPolicy, AnalogyDimensionType.Inflation, AnalogyDimensionType.Growth, AnalogyDimensionType.Liquidity, AnalogyDimensionType.Credit, AnalogyDimensionType.Volatility, AnalogyDimensionType.Valuation, AnalogyDimensionType.FiscalPolicy].includes(item.dimension));
    const limitations: AnalogyLimitation[] = [...candidate.limitations.map((statement, index) => ({ limitationId: `${input.analogyId}:candidate-limitation:${String(index + 1)}`, statement, material: true })), ...(input.limitations ?? []).map((item) => structuredClone(item)), { limitationId: `${input.analogyId}:limitation:noncausal`, statement: "Historical similarity is evidence, not proof of causation or future recurrence.", material: true }, { limitationId: `${input.analogyId}:limitation:not-signal`, statement: "Comparison quality is not trading profitability and creates no trading signal.", material: true }];
    const now = this.clock.now(); const history: HistoricalAnalogyLifecycle[] = [{ historyId: `${input.analogyId}:history:1`, analogyId: input.analogyId, lifecycleSequence: 1, fromStatus: HistoricalAnalogyStatus.Proposed, toStatus: HistoricalAnalogyStatus.Validating, occurredAt: now, reason: "Analogy entered deterministic validation." }, { historyId: `${input.analogyId}:history:2`, analogyId: input.analogyId, lifecycleSequence: 2, fromStatus: HistoricalAnalogyStatus.Validating, toStatus: HistoricalAnalogyStatus.Completed, occurredAt: now, reason: "Deterministic comparison completed without prediction or trading authority." }];
    const record: HistoricalAnalogyRecord = { analogyId: input.analogyId, schemaVersion: "1.0", recordVersion: input.recordVersion, requestId: request.requestId, currentSnapshotReference: { snapshotId: snapshot.snapshotId, snapshotVersion: snapshot.snapshotVersion, asOfTimestamp: snapshot.asOfTimestamp }, candidateReference: structuredClone(candidate), weightProfileReference: { profileId: profile.profileId, profileVersion: profile.version, fingerprint: profile.fingerprint }, scoringMethod: AnalogyScoreMethod.WeightedDimensionV1, scoringMethodVersion: "1.0", comparisonTimestamp: now, dimensionResults, strongestSimilarities, strongestDifferences, missingDimensions, exclusions, score, confidence: { score: confidenceScore, level: levelFor(confidenceScore), policyVersion: profile.policyVersion, reasonCodes: ["MIN_COMPLETENESS_EVIDENCE_CANDIDATE"] }, quality: { classification, eligibleForRanking: true, reviewRequired, reasonCodes: [classification, ...(requiresMissingReview ? ["MISSING_DATA_REVIEW"] : []), ...(criticalBias ? ["CRITICAL_BIAS_REVIEW"] : [])] }, historicalOutcomeEvidence: structuredClone(candidate.historicalOutcomeEvidence), regimeDifferences, limitations, biasRisks: structuredClone(input.biasRisks ?? []), invalidationConditions: structuredClone(input.invalidationConditions ?? []), sourceReferences: structuredClone(snapshot.sourceReferences), ...(request.researchReference === undefined ? {} : { researchReference: structuredClone(request.researchReference) }), journalReferences: [], predictionReferences: [], strategyReferences: [], replayCompatibilityReferences: [], reviewRequired, privacyLevel: request.privacyLevel, retention: request.retention, correlationId: request.correlationId, traceId: request.traceId, status: HistoricalAnalogyStatus.Completed, history, metadata: structuredClone(input.metadata ?? {}) };
    throwIfInvalidHistoricalAnalogy(validateHistoricalAnalogyRecord(record)); return this.repository.appendAnalogy(record, now);
  }

  review(value: AnalogyReview): HistoricalAnalogyAppendResult<AnalogyReview> { const current = this.requiredAnalogy(value.analogyId); const history = this.lifecycle(current, HistoricalAnalogyStatus.Reviewed, value.createdAt, "Research or owner review appended.", value.reviewId); throwIfInvalidHistoricalAnalogy(validateAnalogyLifecycle(history, current)); return this.repository.appendReview(structuredClone(value), history, this.clock.now()); }
  amend(value: AnalogyAmendment): HistoricalAnalogyAppendResult<AnalogyAmendment> { this.requiredAnalogy(value.analogyId); return this.repository.appendAmendment(structuredClone(value), this.clock.now()); }
  supersede(value: AnalogySupersession): HistoricalAnalogyAppendResult<AnalogySupersession> { const prior = this.requiredAnalogy(value.priorAnalogyId); this.requiredAnalogy(value.successorAnalogyId); const history = this.lifecycle(prior, HistoricalAnalogyStatus.Superseded, value.createdAt, value.reason, value.supersessionId); throwIfInvalidHistoricalAnalogy(validateAnalogyLifecycle(history, prior)); return this.repository.appendSupersession(structuredClone(value), history, this.clock.now()); }
  archive(id: string, occurredAt: string, reason: string): HistoricalAnalogyAppendResult<HistoricalAnalogyLifecycle> { const current = this.requiredAnalogy(id); const history = this.lifecycle(current, HistoricalAnalogyStatus.Archived, occurredAt, reason); throwIfInvalidHistoricalAnalogy(validateAnalogyLifecycle(history, current)); return this.repository.appendArchive(history, this.clock.now()); }
  get(id: string): HistoricalAnalogyRecord | undefined { return this.repository.getAnalogyById(id); }
  history(id: string): AnalogyHistory | undefined { return this.repository.getHistory(id); }
  query(query: AnalogyQuery = {}): ReadonlyArray<HistoricalAnalogyRecord> { return this.repository.query(query); }
  rank(query: AnalogyQuery = {}, maximumResultCount = 10): ReadonlyArray<HistoricalAnalogyRecord> { return this.repository.rank(query, maximumResultCount); }
  summary(id: string): AnalogySummary | undefined { const value = this.repository.getAnalogyById(id); if (value === undefined) return undefined; return { analogyId: value.analogyId, requestId: value.requestId, currentSnapshotId: value.currentSnapshotReference.snapshotId, candidateType: value.candidateReference.candidateType, candidateId: value.candidateReference.recordId, status: value.status, quality: value.quality.classification, similarityScore: value.score.normalizedSimilarityScore, completenessScore: value.score.completenessScore, evidenceQualityScore: value.score.evidenceQualityScore, reviewRequired: value.reviewRequired, limitations: value.limitations.map((item) => item.statement) }; }

  statistics(): AnalogyStatistics {
    const requestValues = this.repository.listRequests(); const values = this.repository.query(); const profiles = this.repository.listWeightProfiles(); const requestsByStatus: Record<string, number> = {}; const comparisonsByCandidateType: Record<string, number> = {}; const comparisonsByHistoricalEvent: Record<string, number> = {}; const comparisonsByHistoricalPattern: Record<string, number> = {}; const resultsByQuality: Record<string, number> = {}; const resultsBySimilarityRange: Record<string, number> = {}; const resultsByCompletenessRange: Record<string, number> = {}; const missingDimensionsByType: Record<string, number> = {}; const excludedDimensionsByType: Record<string, number> = {}; const weightProfilesByStatus: Record<string, number> = {};
    let reviewedCount = 0; let researchLinkedCount = 0; let predictionLinkedCount = 0; let criticalBiasRiskCount = 0; let similarityTotal = 0; let completenessTotal = 0;
    for (const value of values) { const candidate = value.candidateReference; comparisonsByCandidateType[candidate.candidateType] = (comparisonsByCandidateType[candidate.candidateType] ?? 0) + 1; const byCandidate = candidate.candidateType === HistoricalCandidateType.Event ? comparisonsByHistoricalEvent : comparisonsByHistoricalPattern; byCandidate[candidate.recordId] = (byCandidate[candidate.recordId] ?? 0) + 1; resultsByQuality[value.quality.classification] = (resultsByQuality[value.quality.classification] ?? 0) + 1; const similarityBucket = bucket(value.score.normalizedSimilarityScore); const completenessBucket = bucket(value.score.completenessScore); resultsBySimilarityRange[similarityBucket] = (resultsBySimilarityRange[similarityBucket] ?? 0) + 1; resultsByCompletenessRange[completenessBucket] = (resultsByCompletenessRange[completenessBucket] ?? 0) + 1; for (const missing of value.missingDimensions) missingDimensionsByType[missing.dimension] = (missingDimensionsByType[missing.dimension] ?? 0) + 1; for (const exclusion of value.exclusions) if (exclusion.dimension !== undefined) excludedDimensionsByType[exclusion.dimension] = (excludedDimensionsByType[exclusion.dimension] ?? 0) + 1; if (value.status === HistoricalAnalogyStatus.Reviewed || (this.repository.getHistory(value.analogyId)?.reviews.length ?? 0) > 0) reviewedCount += 1; if (value.researchReference !== undefined) researchLinkedCount += 1; if (value.predictionReferences.length > 0) predictionLinkedCount += 1; criticalBiasRiskCount += value.biasRisks.filter((risk) => risk.severity === AnalogyRiskSeverity.Critical).length; similarityTotal += value.score.normalizedSimilarityScore; completenessTotal += value.score.completenessScore; }
    for (const profile of profiles) weightProfilesByStatus[profile.status] = (weightProfilesByStatus[profile.status] ?? 0) + 1;
    for (const request of requestValues) { const completed = values.filter((value) => value.requestId === request.requestId).length; const status = completed === 0 ? "CREATED" : completed >= request.candidateReferences.length ? "COMPLETED" : "PARTIALLY_COMPLETED"; requestsByStatus[status] = (requestsByStatus[status] ?? 0) + 1; }
    const sampleSize = values.length; const currentCount = values.filter((value) => ![HistoricalAnalogyStatus.Superseded, HistoricalAnalogyStatus.Archived].includes(value.status)).length; const base = { generatedAt: this.clock.now(), requestCount: requestValues.length, comparisonCount: values.length, requestsByStatus, comparisonsByCandidateType, comparisonsByHistoricalEvent, comparisonsByHistoricalPattern, resultsByQuality, resultsBySimilarityRange, resultsByCompletenessRange, missingDimensionsByType, excludedDimensionsByType, weightProfilesByStatus, reviewedCount, unreviewedCount: values.length - reviewedCount, supersededCount: values.filter((value) => value.status === HistoricalAnalogyStatus.Superseded).length, currentCount, researchLinkedCount, predictionLinkedCount, criticalBiasRiskCount, sampleSize };
    return sampleSize === 0 ? base : { ...base, averageSimilarityScore: Math.floor((similarityTotal + Math.floor(sampleSize / 2)) / sampleSize), averageCompletenessScore: Math.floor((completenessTotal + Math.floor(sampleSize / 2)) / sampleSize) };
  }

  private requiredAnalogy(id: string): HistoricalAnalogyRecord { const value = this.repository.getAnalogyById(id); if (value === undefined) fail(HistoricalAnalogyErrorCategory.RecordNotFound, "Historical analogy does not exist."); return value; }
  private lifecycle(value: HistoricalAnalogyRecord, toStatus: HistoricalAnalogyStatus, occurredAt: string, reason: string, referenceId?: string): HistoricalAnalogyLifecycle { const base = { historyId: `${value.analogyId}:history:${String(value.history.length + 1)}`, analogyId: value.analogyId, lifecycleSequence: value.history.length + 1, fromStatus: value.status, toStatus, occurredAt, reason }; return referenceId === undefined ? base : { ...base, referenceId }; }
}

export function defaultAnalogyBiasRisks(analogyId: string): ReadonlyArray<AnalogyBiasRisk> {
  return [AnalogyBiasRiskType.Hindsight, AnalogyBiasRiskType.Selection, AnalogyBiasRiskType.CausalityOverstatement].map((riskType, index) => ({ riskId: `${analogyId}:bias:${String(index + 1)}`, riskType, severity: AnalogyRiskSeverity.Medium, statement: `${riskType} must be reviewed before interpreting the comparison.`, evidenceReferenceIds: [], requiresReview: false }));
}
