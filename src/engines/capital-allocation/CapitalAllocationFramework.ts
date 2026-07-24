import {
  CAPITAL_ALLOCATION_FRAMEWORK_VERSION,
  CAPITAL_ALLOCATION_SCHEMA_VERSION,
  AllocationAssetType,
  AllocationCandidateStatus,
  AllocationCashAction,
  AllocationCategory,
  AllocationConfidence,
  AllocationEvidenceQuality,
  AllocationHoldingPeriod,
  AllocationPortfolioState,
  AllocationPriority,
  AllocationRecommendedAction,
  AllocationRiskGateStatus,
  AllocationRiskLevel,
  AllocationSourceState,
  AllocationSourceType,
  CapitalAllocationAuthorizationStatus,
  CapitalAllocationValidationIssueCode,
  type AllocationCandidate,
  type AllocationCashRecommendation,
  type AllocationEvidenceReference,
  type AllocationRecommendation,
  type CapitalAllocationEvidenceFusionInput,
  type CapitalAllocationMarketRegimeInput,
  type CapitalAllocationPortfolioInput,
  type CapitalAllocationRecommendationRequest,
  type CapitalAllocationRiskInput,
  type CapitalAllocationValidationIssue,
  type CapitalAllocationValidationResult,
} from "../../contracts/CapitalAllocation";
import {
  EvidenceFusionAssessmentStatus,
  EvidenceFusionCompleteness,
  EvidenceFusionFreshness,
  EvidenceFusionQuality,
} from "../../contracts/EvidenceFusion";
import {
  MarketRegimeDataQualityStatus,
  MarketRegimeEvidenceStrength,
  MarketRegimePrimary,
} from "../../contracts/MarketRegime";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const DISPLAY_TICKER = /^[A-Z0-9][A-Z0-9.-]{0,19}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const REQUEST_KEYS = ["schemaVersion", "frameworkVersion", "recommendationId", "timestamp", "createdAt", "portfolio", "evidenceFusion", "marketRegime", "overallRisk", "recommendedAction", "topCandidates", "avoidList", "cashRecommendation", "notes", "extensionEvidence", "trace"] as const;
const PORTFOLIO_KEYS = ["snapshotId", "schemaVersion", "asOfTime", "state", "evidenceReferenceIds"] as const;
const FUSION_KEYS = ["assessmentId", "snapshotId", "snapshotFingerprint", "status", "completeness", "freshness", "quality", "evaluatedAt", "schemaVersion", "policyVersion", "ruleSetVersion", "evidenceReferenceIds"] as const;
const REGIME_KEYS = ["assessmentId", "schemaVersion", "assessedAt", "primaryRegime", "evidenceStrength", "dataQualityStatus", "policyVersion", "ruleSetVersion", "evidenceReferenceIds"] as const;
const RISK_KEYS = ["assessmentId", "schemaVersion", "evaluatedAt", "status", "riskLevel", "policyVersion", "constraints", "evidenceReferenceIds"] as const;
const CANDIDATE_KEYS = ["candidateId", "canonicalInstrumentId", "ticker", "assetType", "category", "sector", "confidence", "evidenceQuality", "riskLevel", "expectedHoldingPeriod", "primaryCatalyst", "supportingEvidence", "recommendationReason", "suggestedWeight", "priority", "status"] as const;
const EVIDENCE_KEYS = ["sourceType", "recordId", "snapshotId", "schemaVersion", "state", "assessedAt", "fingerprint", "policyVersion", "ruleSetVersion", "evidenceReferenceIds"] as const;
const WEIGHT_KEYS = ["basisPoints"] as const;
const CASH_KEYS = ["action", "reason", "suggestedWeight"] as const;
const TRACE_KEYS = ["correlationId", "traceId", "auditReferenceIds"] as const;

export class CapitalAllocationValidationError extends Error {
  public constructor(public readonly issues: readonly CapitalAllocationValidationIssue[]) {
    super("Capital allocation validation failed.");
    this.name = "CapitalAllocationValidationError";
  }
}

/**
 * Deterministic construction boundary only. It validates reviewed inputs and
 * creates an immutable recommendation; it performs no ranking, sizing, trade,
 * portfolio mutation, leverage decision, AI call, or external access.
 */
export class CapitalAllocationFramework {
  public recommend(value: unknown): AllocationRecommendation {
    const validation = validateCapitalAllocationRecommendationRequest(value);
    if (!validation.valid) throw new CapitalAllocationValidationError(validation.issues);
    const request = value as CapitalAllocationRecommendationRequest;
    const topCandidates = request.topCandidates.map(canonicalCandidate).sort(candidateOrder);
    const avoidList = request.avoidList.map(canonicalCandidate).sort(candidateOrder);
    const extensionEvidence = request.extensionEvidence.map(canonicalEvidenceReference).sort(evidenceOrder);
    const evidenceReferences = uniqueSorted([
      ...request.portfolio.evidenceReferenceIds,
      ...request.evidenceFusion.evidenceReferenceIds,
      ...request.marketRegime.evidenceReferenceIds,
      ...request.overallRisk.evidenceReferenceIds,
      ...topCandidates.flatMap((candidate) => candidate.supportingEvidence.flatMap((reference) => reference.evidenceReferenceIds)),
      ...avoidList.flatMap((candidate) => candidate.supportingEvidence.flatMap((reference) => reference.evidenceReferenceIds)),
      ...extensionEvidence.flatMap((reference) => reference.evidenceReferenceIds),
    ]);
    const base = {
      schemaVersion: CAPITAL_ALLOCATION_SCHEMA_VERSION,
      frameworkVersion: CAPITAL_ALLOCATION_FRAMEWORK_VERSION,
      recommendationId: request.recommendationId,
      timestamp: request.timestamp,
      createdAt: request.createdAt,
      portfolio: canonicalPortfolio(request.portfolio),
      evidenceFusion: canonicalFusion(request.evidenceFusion),
      marketRegime: canonicalRegime(request.marketRegime),
      overallRisk: canonicalRisk(request.overallRisk),
      recommendedAction: request.recommendedAction,
      topCandidates,
      avoidList,
      cashRecommendation: canonicalCash(request.cashRecommendation),
      notes: uniqueSorted(request.notes),
      extensionEvidence,
      evidenceReferences,
      trace: {
        correlationId: request.trace.correlationId,
        traceId: request.trace.traceId,
        auditReferenceIds: uniqueSorted(request.trace.auditReferenceIds),
      },
      authorizationStatus: CapitalAllocationAuthorizationStatus.FrameworkOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: `fnv1a64:${fnv1a64(canonicalize(base))}` });
  }
}

export function validateCapitalAllocationRecommendationRequest(value: unknown): CapitalAllocationValidationResult {
  const issues: CapitalAllocationValidationIssue[] = [];
  if (!isRecord(value)) return result([issue(CapitalAllocationValidationIssueCode.InvalidRecord, "request", "Request must be an object.")]);
  validateExactKeys(issues, value, REQUEST_KEYS, "request", CapitalAllocationValidationIssueCode.InvalidRecord);

  if (value.schemaVersion !== CAPITAL_ALLOCATION_SCHEMA_VERSION) add(issues, CapitalAllocationValidationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported.");
  if (value.frameworkVersion !== CAPITAL_ALLOCATION_FRAMEWORK_VERSION) add(issues, CapitalAllocationValidationIssueCode.InvalidFrameworkVersion, "frameworkVersion", "Framework version is unsupported.");
  validateIdentifier(issues, value.recommendationId, "recommendationId");
  validateTimestamp(issues, value.timestamp, "timestamp");
  validateTimestamp(issues, value.createdAt, "createdAt");
  if (isTimestamp(value.timestamp) && isTimestamp(value.createdAt) && Date.parse(value.createdAt) < Date.parse(value.timestamp)) add(issues, CapitalAllocationValidationIssueCode.InvalidTimestamp, "createdAt", "Creation time cannot precede recommendation time.");

  validatePortfolio(issues, value.portfolio, value.timestamp);
  validateEvidenceFusion(issues, value.evidenceFusion, value.timestamp);
  validateMarketRegime(issues, value.marketRegime, value.timestamp);
  validateRisk(issues, value.overallRisk, value.timestamp);

  const topCandidates = Array.isArray(value.topCandidates) ? value.topCandidates : [];
  const avoidList = Array.isArray(value.avoidList) ? value.avoidList : [];
  if (!Array.isArray(value.topCandidates)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, "topCandidates", "Top candidates must be an array.");
  if (!Array.isArray(value.avoidList)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, "avoidList", "Avoid list must be an array.");
  topCandidates.forEach((candidate, index) => validateCandidate(issues, candidate, `topCandidates.${String(index)}`, true, value.timestamp, value.evidenceFusion));
  avoidList.forEach((candidate, index) => validateCandidate(issues, candidate, `avoidList.${String(index)}`, false, value.timestamp, value.evidenceFusion));
  validateCandidateUniqueness(issues, [...topCandidates, ...avoidList]);
  validateWeights(issues, topCandidates);

  if (!isEnumValue(AllocationRecommendedAction, value.recommendedAction)) add(issues, CapitalAllocationValidationIssueCode.InvalidAction, "recommendedAction", "Recommended action is unsupported.");
  if (value.recommendedAction === AllocationRecommendedAction.ReviewCandidates && topCandidates.length === 0) add(issues, CapitalAllocationValidationIssueCode.InvalidAction, "recommendedAction", "REVIEW_CANDIDATES requires at least one eligible candidate.");
  if (value.recommendedAction === AllocationRecommendedAction.NoAllocation && topCandidates.length > 0) add(issues, CapitalAllocationValidationIssueCode.InvalidAction, "recommendedAction", "NO_ALLOCATION cannot contain top candidates.");

  validateCash(issues, value.cashRecommendation);
  validateTextArray(issues, value.notes, "notes", false);
  validateExtensions(issues, value.extensionEvidence, value.timestamp);
  validateTrace(issues, value.trace);
  validateRiskOrdering(issues, value.evidenceFusion, value.marketRegime, value.overallRisk);
  return result(issues);
}

function validatePortfolio(issues: CapitalAllocationValidationIssue[], value: unknown, recommendationTime: unknown): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.InvalidPortfolio, "portfolio", "Portfolio input must be an object."); return; }
  validateExactKeys(issues, value, PORTFOLIO_KEYS, "portfolio", CapitalAllocationValidationIssueCode.InvalidPortfolio);
  validateIdentifier(issues, value.snapshotId, "portfolio.snapshotId");
  validateVersion(issues, value.schemaVersion, "portfolio.schemaVersion");
  validateTimestamp(issues, value.asOfTime, "portfolio.asOfTime");
  validateNotFuture(issues, value.asOfTime, recommendationTime, "portfolio.asOfTime");
  if (value.state !== AllocationPortfolioState.Current) add(issues, CapitalAllocationValidationIssueCode.InvalidPortfolio, "portfolio.state", "Portfolio snapshot must be CURRENT.");
  validateReferenceIds(issues, value.evidenceReferenceIds, "portfolio.evidenceReferenceIds", true);
}

function validateEvidenceFusion(issues: CapitalAllocationValidationIssue[], value: unknown, recommendationTime: unknown): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.EvidenceGateBlocked, "evidenceFusion", "Evidence Fusion input must be an object."); return; }
  validateExactKeys(issues, value, FUSION_KEYS, "evidenceFusion", CapitalAllocationValidationIssueCode.EvidenceGateBlocked);
  validateIdentifier(issues, value.assessmentId, "evidenceFusion.assessmentId");
  validateIdentifier(issues, value.snapshotId, "evidenceFusion.snapshotId");
  if (typeof value.snapshotFingerprint !== "string" || !FINGERPRINT.test(value.snapshotFingerprint)) add(issues, CapitalAllocationValidationIssueCode.InvalidIdentifier, "evidenceFusion.snapshotFingerprint", "Fusion fingerprint is invalid.");
  validateVersion(issues, value.schemaVersion, "evidenceFusion.schemaVersion");
  validateVersion(issues, value.policyVersion, "evidenceFusion.policyVersion");
  validateVersion(issues, value.ruleSetVersion, "evidenceFusion.ruleSetVersion");
  validateTimestamp(issues, value.evaluatedAt, "evidenceFusion.evaluatedAt");
  validateNotFuture(issues, value.evaluatedAt, recommendationTime, "evidenceFusion.evaluatedAt");
  if (value.status !== EvidenceFusionAssessmentStatus.Ready || value.completeness !== EvidenceFusionCompleteness.Complete || value.freshness !== EvidenceFusionFreshness.Current || value.quality !== EvidenceFusionQuality.Accepted) add(issues, CapitalAllocationValidationIssueCode.EvidenceGateBlocked, "evidenceFusion", "Evidence Fusion must be READY, COMPLETE, CURRENT, and ACCEPTED.");
  validateReferenceIds(issues, value.evidenceReferenceIds, "evidenceFusion.evidenceReferenceIds", true);
}

function validateMarketRegime(issues: CapitalAllocationValidationIssue[], value: unknown, recommendationTime: unknown): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.MarketRegimeRejected, "marketRegime", "Market Regime input must be an object."); return; }
  validateExactKeys(issues, value, REGIME_KEYS, "marketRegime", CapitalAllocationValidationIssueCode.MarketRegimeRejected);
  validateIdentifier(issues, value.assessmentId, "marketRegime.assessmentId");
  validateVersion(issues, value.schemaVersion, "marketRegime.schemaVersion");
  validateVersion(issues, value.policyVersion, "marketRegime.policyVersion");
  validateVersion(issues, value.ruleSetVersion, "marketRegime.ruleSetVersion");
  validateTimestamp(issues, value.assessedAt, "marketRegime.assessedAt");
  validateNotFuture(issues, value.assessedAt, recommendationTime, "marketRegime.assessedAt");
  if (!isEnumValue(MarketRegimePrimary, value.primaryRegime) || value.primaryRegime === MarketRegimePrimary.InsufficientEvidence) add(issues, CapitalAllocationValidationIssueCode.MarketRegimeRejected, "marketRegime.primaryRegime", "Market Regime must contain a supported sufficient primary regime.");
  if (!isEnumValue(MarketRegimeEvidenceStrength, value.evidenceStrength) || value.evidenceStrength === MarketRegimeEvidenceStrength.Insufficient) add(issues, CapitalAllocationValidationIssueCode.MarketRegimeRejected, "marketRegime.evidenceStrength", "Market Regime evidence strength is insufficient.");
  if (value.dataQualityStatus !== MarketRegimeDataQualityStatus.Accepted) add(issues, CapitalAllocationValidationIssueCode.MarketRegimeRejected, "marketRegime.dataQualityStatus", "Market Regime data quality must be ACCEPTED.");
  validateReferenceIds(issues, value.evidenceReferenceIds, "marketRegime.evidenceReferenceIds", true);
}

function validateRisk(issues: CapitalAllocationValidationIssue[], value: unknown, recommendationTime: unknown): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.RiskGateBlocked, "overallRisk", "Risk input must be an object."); return; }
  validateExactKeys(issues, value, RISK_KEYS, "overallRisk", CapitalAllocationValidationIssueCode.RiskGateBlocked);
  validateIdentifier(issues, value.assessmentId, "overallRisk.assessmentId");
  validateVersion(issues, value.schemaVersion, "overallRisk.schemaVersion");
  validateVersion(issues, value.policyVersion, "overallRisk.policyVersion");
  validateTimestamp(issues, value.evaluatedAt, "overallRisk.evaluatedAt");
  validateNotFuture(issues, value.evaluatedAt, recommendationTime, "overallRisk.evaluatedAt");
  if (value.status !== AllocationRiskGateStatus.Cleared && value.status !== AllocationRiskGateStatus.Constrained) add(issues, CapitalAllocationValidationIssueCode.RiskGateBlocked, "overallRisk.status", "Risk must be CLEARED or CONSTRAINED before allocation.");
  if (!isEnumValue(AllocationRiskLevel, value.riskLevel) || value.riskLevel === AllocationRiskLevel.Prohibited || value.riskLevel === AllocationRiskLevel.Unknown) add(issues, CapitalAllocationValidationIssueCode.RiskGateBlocked, "overallRisk.riskLevel", "Overall risk level is not allocatable.");
  validateTextArray(issues, value.constraints, "overallRisk.constraints", value.status === AllocationRiskGateStatus.Constrained, true);
  validateReferenceIds(issues, value.evidenceReferenceIds, "overallRisk.evidenceReferenceIds", true);
}

function validateCandidate(issues: CapitalAllocationValidationIssue[], value: unknown, field: string, eligible: boolean, recommendationTime: unknown, gatedFusion: unknown): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, field, "Candidate must be an object."); return; }
  validateExactKeys(issues, value, CANDIDATE_KEYS, field, CapitalAllocationValidationIssueCode.InvalidCandidate);
  validateIdentifier(issues, value.candidateId, `${field}.candidateId`);
  validateIdentifier(issues, value.canonicalInstrumentId, `${field}.canonicalInstrumentId`);
  if (typeof value.ticker !== "string" || !DISPLAY_TICKER.test(value.ticker)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.ticker`, "Ticker display metadata is invalid.");
  if (!isEnumValue(AllocationAssetType, value.assetType)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.assetType`, "Asset type is unsupported.");
  if (!isEnumValue(AllocationCategory, value.category)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.category`, "Category is unsupported.");
  validateText(issues, value.sector, `${field}.sector`);
  if (!isEnumValue(AllocationConfidence, value.confidence)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.confidence`, "Confidence classification is unsupported.");
  if (!isEnumValue(AllocationEvidenceQuality, value.evidenceQuality)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.evidenceQuality`, "Evidence quality is unsupported.");
  if (!isEnumValue(AllocationRiskLevel, value.riskLevel)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.riskLevel`, "Risk level is unsupported.");
  if (!isEnumValue(AllocationHoldingPeriod, value.expectedHoldingPeriod)) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.expectedHoldingPeriod`, "Holding period is unsupported.");
  validateText(issues, value.primaryCatalyst, `${field}.primaryCatalyst`);
  validateText(issues, value.recommendationReason, `${field}.recommendationReason`);
  if (!Array.isArray(value.supportingEvidence) || value.supportingEvidence.length === 0) add(issues, CapitalAllocationValidationIssueCode.InvalidEvidenceReference, `${field}.supportingEvidence`, "At least one supporting evidence reference is required.");
  else {
    value.supportingEvidence.forEach((reference, index) => validateEvidenceReference(issues, reference, `${field}.supportingEvidence.${String(index)}`, recommendationTime));
    validateSupportingEvidenceUniqueness(issues, value.supportingEvidence, `${field}.supportingEvidence`);
  }
  if (value.priority !== AllocationPriority.Unranked) add(issues, CapitalAllocationValidationIssueCode.RankingNotSupported, `${field}.priority`, "V1 candidates must remain UNRANKED.");
  if (value.suggestedWeight !== undefined) validateWeight(issues, value.suggestedWeight, `${field}.suggestedWeight`);
  if (eligible) {
    if (value.status !== AllocationCandidateStatus.EligibleForReview) add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.status`, "Top candidates must be ELIGIBLE_FOR_REVIEW.");
    if (value.evidenceQuality !== AllocationEvidenceQuality.Sufficient || value.confidence === AllocationConfidence.InsufficientEvidence) add(issues, CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient, field, "Top candidate evidence must be sufficient.");
    if (value.riskLevel === AllocationRiskLevel.Prohibited || value.riskLevel === AllocationRiskLevel.Unknown) add(issues, CapitalAllocationValidationIssueCode.CandidateRiskProhibited, field, "Top candidate risk cannot be prohibited or unknown.");
    validateExactFusionBinding(issues, value.supportingEvidence, gatedFusion, `${field}.supportingEvidence`);
  } else if (value.status !== AllocationCandidateStatus.Avoid && value.status !== AllocationCandidateStatus.Blocked) {
    add(issues, CapitalAllocationValidationIssueCode.InvalidCandidate, `${field}.status`, "Avoid-list candidates must be AVOID or BLOCKED.");
  }
}

function validateCandidateUniqueness(issues: CapitalAllocationValidationIssue[], candidates: unknown[]): void {
  const candidateIds = new Set<string>(); const instrumentIds = new Set<string>();
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    if (typeof candidate.candidateId === "string") {
      if (candidateIds.has(candidate.candidateId)) add(issues, CapitalAllocationValidationIssueCode.DuplicateCandidate, "candidates", `Duplicate candidate ID: ${candidate.candidateId}.`);
      candidateIds.add(candidate.candidateId);
    }
    if (typeof candidate.canonicalInstrumentId === "string") {
      if (instrumentIds.has(candidate.canonicalInstrumentId)) add(issues, CapitalAllocationValidationIssueCode.DuplicateInstrument, "candidates", `Duplicate canonical instrument: ${candidate.canonicalInstrumentId}.`);
      instrumentIds.add(candidate.canonicalInstrumentId);
    }
  }
}

function validateWeights(issues: CapitalAllocationValidationIssue[], candidates: unknown[]): void {
  let total = 0;
  for (const candidate of candidates) if (isRecord(candidate) && isRecord(candidate.suggestedWeight) && Number.isSafeInteger(candidate.suggestedWeight.basisPoints)) total += candidate.suggestedWeight.basisPoints as number;
  if (total > 10_000) add(issues, CapitalAllocationValidationIssueCode.WeightLimitExceeded, "topCandidates", "Supplied candidate weights exceed 100%.");
}

function validateRiskOrdering(issues: CapitalAllocationValidationIssue[], fusion: unknown, regime: unknown, risk: unknown): void {
  if (!isRecord(fusion) || !isRecord(regime) || !isRecord(risk) || !isTimestamp(fusion.evaluatedAt) || !isTimestamp(regime.assessedAt) || !isTimestamp(risk.evaluatedAt)) return;
  const riskTime = Date.parse(risk.evaluatedAt);
  if (riskTime < Date.parse(fusion.evaluatedAt)) add(issues, CapitalAllocationValidationIssueCode.RiskGateBlocked, "overallRisk.evaluatedAt", "Risk evaluation cannot predate the gated Evidence Fusion assessment.");
  if (riskTime < Date.parse(regime.assessedAt)) add(issues, CapitalAllocationValidationIssueCode.RiskGateBlocked, "overallRisk.evaluatedAt", "Risk evaluation cannot predate the accepted Market Regime assessment.");
}

function validateSupportingEvidenceUniqueness(issues: CapitalAllocationValidationIssue[], references: readonly unknown[], field: string): void {
  const identities = references.filter(isRecord).map((reference) => `${String(reference.sourceType)}|${String(reference.recordId)}|${String(reference.snapshotId ?? "")}`);
  if (new Set(identities).size !== identities.length) add(issues, CapitalAllocationValidationIssueCode.InvalidEvidenceReference, field, "Supporting evidence references must be unique.");
}

function validateExactFusionBinding(issues: CapitalAllocationValidationIssue[], references: unknown, gatedFusion: unknown, field: string): void {
  if (!Array.isArray(references) || !isRecord(gatedFusion)) {
    add(issues, CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient, field, "Every eligible candidate requires the exact gated Evidence Fusion record.");
    return;
  }
  const fusionReferences = references.filter((reference) => isRecord(reference) && reference.sourceType === AllocationSourceType.EvidenceFusion);
  if (fusionReferences.length !== 1) {
    add(issues, CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient, field, "Every eligible candidate requires exactly one gated Evidence Fusion reference.");
    return;
  }
  const reference = fusionReferences[0] as Record<string, unknown>;
  const expectedEvidence = Array.isArray(gatedFusion.evidenceReferenceIds) ? [...gatedFusion.evidenceReferenceIds].sort() : [];
  const actualEvidence = Array.isArray(reference.evidenceReferenceIds) ? [...reference.evidenceReferenceIds].sort() : [];
  const matches = reference.recordId === gatedFusion.assessmentId
    && reference.snapshotId === gatedFusion.snapshotId
    && reference.fingerprint === gatedFusion.snapshotFingerprint
    && reference.schemaVersion === gatedFusion.schemaVersion
    && reference.policyVersion === gatedFusion.policyVersion
    && reference.ruleSetVersion === gatedFusion.ruleSetVersion
    && reference.assessedAt === gatedFusion.evaluatedAt
    && reference.state === AllocationSourceState.Accepted
    && canonicalize(actualEvidence) === canonicalize(expectedEvidence);
  if (!matches) add(issues, CapitalAllocationValidationIssueCode.CandidateEvidenceInsufficient, field, "Candidate Fusion evidence must exactly match the gated assessment, snapshot, versions, timestamp, fingerprint, state, and authoritative evidence references.");
}

function validateCash(issues: CapitalAllocationValidationIssue[], value: unknown): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.InvalidCashRecommendation, "cashRecommendation", "Cash recommendation must be an object."); return; }
  validateExactKeys(issues, value, CASH_KEYS, "cashRecommendation", CapitalAllocationValidationIssueCode.InvalidCashRecommendation);
  if (!isEnumValue(AllocationCashAction, value.action)) add(issues, CapitalAllocationValidationIssueCode.InvalidCashRecommendation, "cashRecommendation.action", "Cash action is unsupported.");
  validateText(issues, value.reason, "cashRecommendation.reason");
  if (value.suggestedWeight !== undefined) validateWeight(issues, value.suggestedWeight, "cashRecommendation.suggestedWeight");
  if (value.action === AllocationCashAction.NotEvaluated && value.suggestedWeight !== undefined) add(issues, CapitalAllocationValidationIssueCode.InvalidCashRecommendation, "cashRecommendation.suggestedWeight", "NOT_EVALUATED cannot include a suggested weight.");
}

function validateExtensions(issues: CapitalAllocationValidationIssue[], value: unknown, recommendationTime: unknown): void {
  if (!Array.isArray(value)) { add(issues, CapitalAllocationValidationIssueCode.InvalidExtension, "extensionEvidence", "Extension evidence must be an array."); return; }
  value.forEach((reference, index) => validateEvidenceReference(issues, reference, `extensionEvidence.${String(index)}`, recommendationTime, true));
  const keys = value.filter(isRecord).map((entry) => `${String(entry.sourceType)}|${String(entry.recordId)}`);
  if (new Set(keys).size !== keys.length) add(issues, CapitalAllocationValidationIssueCode.InvalidExtension, "extensionEvidence", "Extension evidence references must be unique.");
}

function validateEvidenceReference(issues: CapitalAllocationValidationIssue[], value: unknown, field: string, recommendationTime?: unknown, extension = false): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.InvalidEvidenceReference, field, "Evidence reference must be an object."); return; }
  validateExactKeys(issues, value, EVIDENCE_KEYS, field, CapitalAllocationValidationIssueCode.InvalidEvidenceReference);
  if (!isEnumValue(AllocationSourceType, value.sourceType)) add(issues, CapitalAllocationValidationIssueCode.InvalidEvidenceReference, `${field}.sourceType`, "Evidence source type is unsupported.");
  if (extension && value.sourceType !== AllocationSourceType.EarningsResearch && value.sourceType !== AllocationSourceType.CapitalRotation) add(issues, CapitalAllocationValidationIssueCode.InvalidExtension, `${field}.sourceType`, "Only future Earnings Research and Capital Rotation extension references are accepted upstream in v1.");
  if (!extension && (value.sourceType === AllocationSourceType.EarningsResearch || value.sourceType === AllocationSourceType.CapitalRotation)) add(issues, CapitalAllocationValidationIssueCode.InvalidExtension, `${field}.sourceType`, "Future evidence sources are accepted only through extensionEvidence.");
  validateIdentifier(issues, value.recordId, `${field}.recordId`);
  if (value.snapshotId !== undefined) validateIdentifier(issues, value.snapshotId, `${field}.snapshotId`);
  validateVersion(issues, value.schemaVersion, `${field}.schemaVersion`);
  validateTimestamp(issues, value.assessedAt, `${field}.assessedAt`);
  if (recommendationTime !== undefined) validateNotFuture(issues, value.assessedAt, recommendationTime, `${field}.assessedAt`);
  if (!isEnumValue(AllocationSourceState, value.state) || value.state === AllocationSourceState.Blocked || value.state === AllocationSourceState.Unavailable) add(issues, CapitalAllocationValidationIssueCode.InvalidEvidenceReference, `${field}.state`, "Supporting evidence must be ACCEPTED or LIMITED.");
  if (value.sourceType === AllocationSourceType.EventAnalyzer && value.state !== AllocationSourceState.Limited) add(issues, CapitalAllocationValidationIssueCode.InvalidEvidenceReference, `${field}.state`, "Event Analyzer is prototype-only and may be referenced only as LIMITED supplemental evidence.");
  if (value.fingerprint !== undefined && (typeof value.fingerprint !== "string" || !FINGERPRINT.test(value.fingerprint))) add(issues, CapitalAllocationValidationIssueCode.InvalidIdentifier, `${field}.fingerprint`, "Evidence fingerprint is invalid.");
  if (value.policyVersion !== undefined) validateVersion(issues, value.policyVersion, `${field}.policyVersion`);
  if (value.ruleSetVersion !== undefined) validateVersion(issues, value.ruleSetVersion, `${field}.ruleSetVersion`);
  validateReferenceIds(issues, value.evidenceReferenceIds, `${field}.evidenceReferenceIds`, true);
}

function validateTrace(issues: CapitalAllocationValidationIssue[], value: unknown): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.InvalidTrace, "trace", "Trace must be an object."); return; }
  validateExactKeys(issues, value, TRACE_KEYS, "trace", CapitalAllocationValidationIssueCode.InvalidTrace);
  validateIdentifier(issues, value.correlationId, "trace.correlationId");
  validateIdentifier(issues, value.traceId, "trace.traceId");
  validateReferenceIds(issues, value.auditReferenceIds, "trace.auditReferenceIds", false);
}

function validateWeight(issues: CapitalAllocationValidationIssue[], value: unknown, field: string): void {
  if (!isRecord(value)) { add(issues, CapitalAllocationValidationIssueCode.InvalidWeight, field, "Weight must be integer basis points from 0 through 10,000."); return; }
  validateExactKeys(issues, value, WEIGHT_KEYS, field, CapitalAllocationValidationIssueCode.InvalidWeight);
  if (!Number.isSafeInteger(value.basisPoints) || (value.basisPoints as number) < 0 || (value.basisPoints as number) > 10_000) add(issues, CapitalAllocationValidationIssueCode.InvalidWeight, field, "Weight must be integer basis points from 0 through 10,000.");
}

function validateIdentifier(issues: CapitalAllocationValidationIssue[], value: unknown, field: string): void { if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, CapitalAllocationValidationIssueCode.InvalidIdentifier, field, "Identifier is invalid."); }
function validateVersion(issues: CapitalAllocationValidationIssue[], value: unknown, field: string): void { if (typeof value !== "string" || !VERSION.test(value)) add(issues, CapitalAllocationValidationIssueCode.InvalidIdentifier, field, "Version is invalid."); }
function validateTimestamp(issues: CapitalAllocationValidationIssue[], value: unknown, field: string): void { if (!isTimestamp(value)) add(issues, CapitalAllocationValidationIssueCode.InvalidTimestamp, field, "Timestamp must be canonical UTC."); }
function validateNotFuture(issues: CapitalAllocationValidationIssue[], value: unknown, comparison: unknown, field: string): void { if (isTimestamp(value) && isTimestamp(comparison) && Date.parse(value) > Date.parse(comparison)) add(issues, CapitalAllocationValidationIssueCode.InvalidTimestamp, field, "Upstream timestamp cannot be later than recommendation time."); }
function validateText(issues: CapitalAllocationValidationIssue[], value: unknown, field: string): void { if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) add(issues, CapitalAllocationValidationIssueCode.InvalidText, field, "Text must contain 1 through 500 characters."); }
function validateTextArray(issues: CapitalAllocationValidationIssue[], value: unknown, field: string, requireOne: boolean, requireUnique = false): void { if (!Array.isArray(value) || (requireOne && value.length === 0) || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0 || entry.length > 500) || (requireUnique && new Set(value).size !== value.length)) add(issues, CapitalAllocationValidationIssueCode.InvalidText, field, "Text list must contain valid unique values and satisfy required cardinality."); }
function validateReferenceIds(issues: CapitalAllocationValidationIssue[], value: unknown, field: string, requireOne: boolean): void { if (!Array.isArray(value) || (requireOne && value.length === 0) || value.some((entry) => typeof entry !== "string" || !IDENTIFIER.test(entry)) || new Set(value).size !== value.length) add(issues, CapitalAllocationValidationIssueCode.InvalidEvidenceReference, field, "Evidence references must be unique valid identifiers."); }
function validateExactKeys(issues: CapitalAllocationValidationIssue[], value: Record<string, unknown>, allowed: readonly string[], field: string, code: CapitalAllocationValidationIssueCode): void {
  const unknownKeys = Object.keys(value).filter((key) => !allowed.includes(key)).sort();
  for (const key of unknownKeys) add(issues, code, `${field}.${key}`, "Undeclared fields are not permitted at this boundary.");
}

function canonicalPortfolio(value: CapitalAllocationPortfolioInput): CapitalAllocationPortfolioInput {
  return { snapshotId: value.snapshotId, schemaVersion: value.schemaVersion, asOfTime: value.asOfTime, state: value.state, evidenceReferenceIds: uniqueSorted(value.evidenceReferenceIds) };
}
function canonicalFusion(value: CapitalAllocationEvidenceFusionInput): CapitalAllocationEvidenceFusionInput {
  return { assessmentId: value.assessmentId, snapshotId: value.snapshotId, snapshotFingerprint: value.snapshotFingerprint, status: value.status, completeness: value.completeness, freshness: value.freshness, quality: value.quality, evaluatedAt: value.evaluatedAt, schemaVersion: value.schemaVersion, policyVersion: value.policyVersion, ruleSetVersion: value.ruleSetVersion, evidenceReferenceIds: uniqueSorted(value.evidenceReferenceIds) };
}
function canonicalRegime(value: CapitalAllocationMarketRegimeInput): CapitalAllocationMarketRegimeInput {
  return { assessmentId: value.assessmentId, schemaVersion: value.schemaVersion, assessedAt: value.assessedAt, primaryRegime: value.primaryRegime, evidenceStrength: value.evidenceStrength, dataQualityStatus: value.dataQualityStatus, policyVersion: value.policyVersion, ruleSetVersion: value.ruleSetVersion, evidenceReferenceIds: uniqueSorted(value.evidenceReferenceIds) };
}
function canonicalRisk(value: CapitalAllocationRiskInput): CapitalAllocationRiskInput {
  return { assessmentId: value.assessmentId, schemaVersion: value.schemaVersion, evaluatedAt: value.evaluatedAt, status: value.status, riskLevel: value.riskLevel, policyVersion: value.policyVersion, constraints: uniqueSorted(value.constraints), evidenceReferenceIds: uniqueSorted(value.evidenceReferenceIds) };
}

function canonicalCandidate(candidate: AllocationCandidate): AllocationCandidate {
  const value: AllocationCandidate = {
    candidateId: candidate.candidateId,
    canonicalInstrumentId: candidate.canonicalInstrumentId,
    ticker: candidate.ticker,
    assetType: candidate.assetType,
    category: candidate.category,
    sector: candidate.sector,
    confidence: candidate.confidence,
    evidenceQuality: candidate.evidenceQuality,
    riskLevel: candidate.riskLevel,
    expectedHoldingPeriod: candidate.expectedHoldingPeriod,
    primaryCatalyst: candidate.primaryCatalyst,
    supportingEvidence: candidate.supportingEvidence.map(canonicalEvidenceReference).sort(evidenceOrder),
    recommendationReason: candidate.recommendationReason,
    ...(candidate.suggestedWeight === undefined ? {} : { suggestedWeight: { basisPoints: candidate.suggestedWeight.basisPoints } }),
    priority: AllocationPriority.Unranked,
    status: candidate.status,
  };
  return value;
}
function canonicalEvidenceReference(reference: AllocationEvidenceReference): AllocationEvidenceReference {
  return {
    sourceType: reference.sourceType,
    recordId: reference.recordId,
    ...(reference.snapshotId === undefined ? {} : { snapshotId: reference.snapshotId }),
    schemaVersion: reference.schemaVersion,
    state: reference.state,
    assessedAt: reference.assessedAt,
    ...(reference.fingerprint === undefined ? {} : { fingerprint: reference.fingerprint }),
    ...(reference.policyVersion === undefined ? {} : { policyVersion: reference.policyVersion }),
    ...(reference.ruleSetVersion === undefined ? {} : { ruleSetVersion: reference.ruleSetVersion }),
    evidenceReferenceIds: uniqueSorted(reference.evidenceReferenceIds),
  };
}
function canonicalCash(value: AllocationCashRecommendation): AllocationCashRecommendation { return value.suggestedWeight === undefined ? { action: value.action, reason: value.reason } : { action: value.action, reason: value.reason, suggestedWeight: { basisPoints: value.suggestedWeight.basisPoints } }; }
function candidateOrder(left: AllocationCandidate, right: AllocationCandidate): number { return left.candidateId.localeCompare(right.candidateId); }
function evidenceOrder(left: AllocationEvidenceReference, right: AllocationEvidenceReference): number { return `${left.sourceType}|${left.recordId}`.localeCompare(`${right.sourceType}|${right.recordId}`); }
function uniqueSorted(values: readonly string[]): string[] { return [...new Set(values)].sort(); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isTimestamp(value: unknown): value is string { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false; const time = Date.parse(value); return Number.isFinite(time) && new Date(time).toISOString() === value; }
function isEnumValue<T extends Record<string, string>>(enumValue: T, value: unknown): value is T[keyof T] { return typeof value === "string" && Object.values(enumValue).includes(value); }
function add(issues: CapitalAllocationValidationIssue[], code: CapitalAllocationValidationIssueCode, field: string, message: string): void { issues.push(issue(code, field, message)); }
function issue(code: CapitalAllocationValidationIssueCode, field: string, message: string): CapitalAllocationValidationIssue { return { code, field, message }; }
function result(issues: CapitalAllocationValidationIssue[]): CapitalAllocationValidationResult { const ordered = issues.map((entry) => ({ ...entry })).sort((a, b) => a.code.localeCompare(b.code) || a.field.localeCompare(b.field) || a.message.localeCompare(b.message)); return deepFreeze({ valid: ordered.length === 0, issues: ordered }); }

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return hash.toString(16).padStart(16, "0");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
