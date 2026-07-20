import {
  STRATEGY_REVIEW_SCHEMA_VERSION,
  ExecutionQualityStatus,
  ExecutionReviewCriterion,
  FrozenPlanReviewStatus,
  OutcomeFinalizationStatus,
  PredictionQualityStatus,
  ReplayReviewAvailability,
  ReviewFindingStatus,
  RiskDisciplineStatus,
  RiskReviewCriterion,
  StrategyReviewBlockerCode,
  StrategyReviewErrorCode,
  StrategyReviewSourceAvailability,
  StrategyReviewSourceType,
  StrategyReviewStatus,
  StrategyReviewWarningCode,
  TradingProfitabilityStatus,
  type ExecutionQualityReview,
  type ExecutionReviewFinding,
  type PredictionQualityReview,
  type RiskDisciplineReview,
  type RiskReviewFinding,
  type StrategyReview,
  type StrategyReviewIssue,
  type StrategyReviewPolicy,
  type StrategyReviewRequest,
  type StrategyReviewSourceReference,
  type StrategyReviewTraceMetadata,
  type TradingProfitabilityReview,
} from "../../contracts/StrategyReview";
import { EvidenceAssessmentStatus } from "../../contracts/EvidenceEngine";
import { EvidenceEntityType } from "../../contracts/CrossSystemEvidenceLink";
import { EventReplayLifecycleStatus } from "../../contracts/EventReplay";
import {
  PredictionAccuracy,
  PredictionReviewStatus,
  PredictionStatus,
} from "../../contracts/PredictionRecord";
import { TradeStatus } from "../../contracts/TradeRecord";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/u;
const MAX_COLLECTION_SIZE = 1000;
const enumSet = <T extends string>(value: Record<string, T>): ReadonlySet<string> => new Set(Object.values(value));
const sourceTypes = enumSet(StrategyReviewSourceType);
const sourceAvailabilities = enumSet(StrategyReviewSourceAvailability);
const executionCriteria = enumSet(ExecutionReviewCriterion);
const riskCriteria = enumSet(RiskReviewCriterion);
const findingStatuses = enumSet(ReviewFindingStatus);
const predictionStatuses = enumSet(PredictionStatus);
const predictionReviewStatuses = enumSet(PredictionReviewStatus);
const predictionAccuracies = enumSet(PredictionAccuracy);
const tradeStatuses = enumSet(TradeStatus);
const replayStatuses = enumSet(EventReplayLifecycleStatus);
const evidenceStatuses = enumSet(EvidenceAssessmentStatus);
const completedTradeStatuses = new Set<TradeStatus>([
  TradeStatus.Closed,
  TradeStatus.StoppedOut,
  TradeStatus.Invalidated,
  TradeStatus.Archived,
]);
const completedReplayStatuses = new Set<EventReplayLifecycleStatus>([
  EventReplayLifecycleStatus.Completed,
  EventReplayLifecycleStatus.Reviewed,
  EventReplayLifecycleStatus.Superseded,
  EventReplayLifecycleStatus.Archived,
]);

export class StrategyReviewError extends Error {
  public constructor(
    public readonly code: StrategyReviewErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "StrategyReviewError";
  }
}

/** Deterministic post-completion review over explicit, read-only source snapshots. */
export class StrategyReviewEngine {
  public review(value: unknown): StrategyReview {
    const request = validateRequest(value);
    const policy = copyPolicy(request.policy);
    const sources = [...request.sourceReferences].map(copySource).sort((left, right) => left.referenceId.localeCompare(right.referenceId));
    const blockers = buildGateBlockers(request);
    const gateOpen = blockers.length === 0;
    const predictionQuality = gateOpen ? reviewPrediction(request) : closedPredictionReview(request);
    const executionResult = gateOpen ? reviewExecution(request, policy) : { review: closedExecutionReview(request), blockers: [] };
    const riskResult = gateOpen ? reviewRisk(request, policy) : { review: closedRiskReview(request), blockers: [] };
    const tradingProfitability = gateOpen ? reviewProfitability(request) : closedProfitabilityReview(request);
    blockers.push(...executionResult.blockers, ...riskResult.blockers);
    if (gateOpen) blockers.push(...dimensionAvailabilityBlockers(request));
    const warnings = buildWarnings(request, executionResult.review, riskResult.review, tradingProfitability, predictionQuality);
    const sortedBlockers = sortIssues(blockers);
    const status = determineStatus(sortedBlockers);

    return deepFreeze({
      schemaVersion: STRATEGY_REVIEW_SCHEMA_VERSION,
      reviewId: request.reviewId,
      evaluatedAt: request.evaluatedAt,
      status,
      eligible: gateOpen,
      policy,
      evidenceGate: {
        assessmentId: request.evidenceAssessment.assessmentId,
        schemaVersion: request.evidenceAssessment.schemaVersion,
        policyId: request.evidenceAssessment.policy.policyId,
        policyVersion: request.evidenceAssessment.policy.version,
        status: request.evidenceAssessment.overallStatus,
        blockerCodes: uniqueSorted(request.evidenceAssessment.blockers.map((blocker) => blocker.code)),
        unresolvedEvidenceItemIds: uniqueSorted(request.evidenceAssessment.unresolvedEvidenceItemIds),
        conflictIds: uniqueSorted(request.evidenceAssessment.conflicts.map((conflict) => conflict.conflictId)),
      },
      strategyVersion: {
        versionId: request.strategyVersion.versionId,
        semanticVersion: request.strategyVersion.semanticVersion,
        sourceReferenceIds: uniqueSorted(request.strategyVersion.sourceReferenceIds),
      },
      predictionQuality,
      executionQuality: executionResult.review,
      riskDiscipline: riskResult.review,
      tradingProfitability,
      blockers: sortedBlockers,
      warnings,
      unresolvedSourceReferenceIds: unresolvedSourceIds(request, sources),
      sourceReferences: sources,
      trace: mergeTrace(request, sources),
      humanReviewRequired: true,
      protections: {
        authoritativeSourcesReadOnly: true,
        activePlanMutationProhibited: true,
        tradeReopeningProhibited: true,
        executionInstructionsProhibited: true,
      },
      deterministic: true,
      readOnly: true,
    });
  }
}

function buildGateBlockers(request: StrategyReviewRequest): Array<StrategyReviewIssue<StrategyReviewBlockerCode>> {
  const blockers: Array<StrategyReviewIssue<StrategyReviewBlockerCode>> = [];
  if (request.prediction.status !== PredictionStatus.Reviewed && request.prediction.status !== PredictionStatus.Archived) {
    blockers.push(blocker(StrategyReviewBlockerCode.ActivePrediction, request.prediction.sourceReferenceIds, "Prediction lifecycle is not reviewed or archived."));
  }
  if (request.prediction.reviewStatus !== PredictionReviewStatus.Completed) {
    blockers.push(blocker(StrategyReviewBlockerCode.PredictionReviewIncomplete, request.prediction.sourceReferenceIds, "Prediction review is not complete."));
  }
  if (!completedTradeStatuses.has(request.execution.tradeStatus)) {
    blockers.push(blocker(StrategyReviewBlockerCode.ExecutionIncomplete, request.execution.sourceReferenceIds, "Execution lifecycle is not explicitly complete."));
  }
  if (request.frozenPlan.status === FrozenPlanReviewStatus.FrozenActive) {
    blockers.push(blocker(StrategyReviewBlockerCode.FrozenPlanActive, request.frozenPlan.sourceReferenceIds, "Frozen plan remains active and cannot be reviewed or modified."));
  }
  if (request.profitability.finalizationStatus === OutcomeFinalizationStatus.Pending
    || (request.profitability.finalizationStatus === OutcomeFinalizationStatus.Finalized && !request.profitability.realized)) {
    blockers.push(blocker(StrategyReviewBlockerCode.OutcomeNotFinalized, request.profitability.sourceReferenceIds, "Trade outcome is not finalized and realized."));
  }
  if (request.profitability.finalizationStatus === OutcomeFinalizationStatus.Unavailable) {
    blockers.push(blocker(StrategyReviewBlockerCode.OutcomeUnavailable, request.profitability.sourceReferenceIds, "Finalized trade outcome is unavailable."));
  }
  if (request.replay.availability === ReplayReviewAvailability.Unresolved
    || (request.replay.availability === ReplayReviewAvailability.Available
      && request.replay.status !== undefined
      && !completedReplayStatuses.has(request.replay.status))) {
    blockers.push(blocker(StrategyReviewBlockerCode.ReplayUnresolved, request.replay.sourceReferenceIds, "Replay state is unresolved or incomplete."));
  }
  if (request.policy.requireReplay && request.replay.availability === ReplayReviewAvailability.ExplicitlyUnavailable) {
    blockers.push(blocker(StrategyReviewBlockerCode.RequiredReplayUnavailable, request.replay.sourceReferenceIds, "Review policy requires an available completed replay."));
  }
  if (request.evidenceAssessment.overallStatus === EvidenceAssessmentStatus.Insufficient) {
    blockers.push(blocker(StrategyReviewBlockerCode.EvidenceInsufficient, evidenceSourceIds(request), "Evidence assessment is insufficient for formal review."));
  } else if (request.evidenceAssessment.overallStatus === EvidenceAssessmentStatus.Conflicting) {
    blockers.push(blocker(StrategyReviewBlockerCode.EvidenceConflicting, evidenceSourceIds(request), "Evidence assessment contains unresolved required conflicts."));
  } else if (request.evidenceAssessment.overallStatus === EvidenceAssessmentStatus.Unavailable) {
    blockers.push(blocker(StrategyReviewBlockerCode.EvidenceUnavailable, evidenceSourceIds(request), "Evidence assessment reports required evidence unavailable."));
  }
  return blockers;
}

function dimensionAvailabilityBlockers(request: StrategyReviewRequest): Array<StrategyReviewIssue<StrategyReviewBlockerCode>> {
  const blockers: Array<StrategyReviewIssue<StrategyReviewBlockerCode>> = [];
  if (request.execution.availability === StrategyReviewSourceAvailability.Unavailable) {
    blockers.push(blocker(StrategyReviewBlockerCode.DimensionSourceUnavailable, request.execution.sourceReferenceIds, "Execution evidence is unavailable."));
  }
  if (request.risk.availability === StrategyReviewSourceAvailability.Unavailable) {
    blockers.push(blocker(StrategyReviewBlockerCode.DimensionSourceUnavailable, request.risk.sourceReferenceIds, "Risk-compliance evidence is unavailable."));
  }
  if (request.profitability.availability === StrategyReviewSourceAvailability.Unavailable) {
    blockers.push(blocker(StrategyReviewBlockerCode.DimensionSourceUnavailable, request.profitability.sourceReferenceIds, "Finalized profitability evidence is unavailable."));
  }
  return blockers;
}

function reviewPrediction(request: StrategyReviewRequest): PredictionQualityReview {
  const status = request.prediction.accuracy === PredictionAccuracy.Accurate
    ? PredictionQualityStatus.Correct
    : request.prediction.accuracy === PredictionAccuracy.PartiallyAccurate
      ? PredictionQualityStatus.PartiallyCorrect
      : request.prediction.accuracy === PredictionAccuracy.Inaccurate
        ? PredictionQualityStatus.Incorrect
        : PredictionQualityStatus.Indeterminate;
  return {
    status,
    sourceAccuracy: request.prediction.accuracy,
    sourceReferenceIds: uniqueSorted(request.prediction.sourceReferenceIds),
    reasonCodes: [`PREDICTION_LOG_ACCURACY:${request.prediction.accuracy}`],
  };
}

function reviewExecution(
  request: StrategyReviewRequest,
  policy: StrategyReviewPolicy,
): { readonly review: ExecutionQualityReview; readonly blockers: ReadonlyArray<StrategyReviewIssue<StrategyReviewBlockerCode>> } {
  const findings = copyExecutionFindings(request.execution.findings);
  if (request.execution.availability === StrategyReviewSourceAvailability.Unavailable) {
    return { review: executionReview(ExecutionQualityStatus.Unavailable, findings, request.execution.sourceReferenceIds, ["EXECUTION_EVIDENCE_UNAVAILABLE"]), blockers: [] };
  }
  const byCriterion = new Map(findings.map((finding) => [finding.criterion, finding]));
  const missing = policy.requiredExecutionCriteria.filter((criterion) => !byCriterion.has(criterion));
  const unknown = policy.requiredExecutionCriteria
    .map((criterion) => byCriterion.get(criterion))
    .filter((finding): finding is ExecutionReviewFinding => finding?.status === ReviewFindingStatus.Unknown);
  const blockers: Array<StrategyReviewIssue<StrategyReviewBlockerCode>> = [];
  if (missing.length > 0) blockers.push(blocker(StrategyReviewBlockerCode.RequiredExecutionFindingMissing, request.execution.sourceReferenceIds, `Missing required execution findings: ${missing.join(", ")}.`));
  if (unknown.length > 0) blockers.push(blocker(StrategyReviewBlockerCode.RequiredExecutionFindingUnknown, request.execution.sourceReferenceIds, `Required execution findings remain unknown: ${unknown.map((finding) => finding.criterion).join(", ")}.`));
  const violations = findings.filter((finding) => finding.status === ReviewFindingStatus.Violation);
  const hardViolation = violations.some((finding) => policy.hardExecutionCriteria.includes(finding.criterion));
  const status = missing.length > 0 || unknown.length > 0
    ? ExecutionQualityStatus.Indeterminate
    : hardViolation
      ? ExecutionQualityStatus.NonCompliant
      : violations.length > 0
        ? ExecutionQualityStatus.PartiallyCompliant
        : ExecutionQualityStatus.Compliant;
  return {
    review: executionReview(status, findings, request.execution.sourceReferenceIds, findings.map((finding) => `${finding.criterion}:${finding.status}`)),
    blockers,
  };
}

function reviewRisk(
  request: StrategyReviewRequest,
  policy: StrategyReviewPolicy,
): { readonly review: RiskDisciplineReview; readonly blockers: ReadonlyArray<StrategyReviewIssue<StrategyReviewBlockerCode>> } {
  const findings = copyRiskFindings(request.risk.findings);
  if (request.risk.availability === StrategyReviewSourceAvailability.Unavailable) {
    return { review: riskReview(RiskDisciplineStatus.Unavailable, findings, request.risk.sourceReferenceIds, ["RISK_EVIDENCE_UNAVAILABLE"]), blockers: [] };
  }
  const byCriterion = new Map(findings.map((finding) => [finding.criterion, finding]));
  const missing = policy.requiredRiskCriteria.filter((criterion) => !byCriterion.has(criterion));
  const unknown = policy.requiredRiskCriteria
    .map((criterion) => byCriterion.get(criterion))
    .filter((finding): finding is RiskReviewFinding => finding?.status === ReviewFindingStatus.Unknown);
  const blockers: Array<StrategyReviewIssue<StrategyReviewBlockerCode>> = [];
  if (missing.length > 0) blockers.push(blocker(StrategyReviewBlockerCode.RequiredRiskFindingMissing, request.risk.sourceReferenceIds, `Missing required risk findings: ${missing.join(", ")}.`));
  if (unknown.length > 0) blockers.push(blocker(StrategyReviewBlockerCode.RequiredRiskFindingUnknown, request.risk.sourceReferenceIds, `Required risk findings remain unknown: ${unknown.map((finding) => finding.criterion).join(", ")}.`));
  const violations = findings.filter((finding) => finding.status === ReviewFindingStatus.Violation);
  const status = violations.length > 0
    ? RiskDisciplineStatus.Violation
    : missing.length > 0 || unknown.length > 0
      ? RiskDisciplineStatus.PartialOrUnknown
      : RiskDisciplineStatus.Compliant;
  return {
    review: riskReview(status, findings, request.risk.sourceReferenceIds, findings.map((finding) => `${finding.criterion}:${finding.status}`)),
    blockers,
  };
}

function reviewProfitability(request: StrategyReviewRequest): TradingProfitabilityReview {
  const value = request.profitability;
  if (value.availability === StrategyReviewSourceAvailability.Unavailable
    || value.finalizationStatus !== OutcomeFinalizationStatus.Finalized
    || !value.realized
    || value.netResult === undefined) {
    return closedProfitabilityReview(request);
  }
  const status = value.netResult > 0
    ? TradingProfitabilityStatus.Profit
    : value.netResult < 0
      ? TradingProfitabilityStatus.Loss
      : TradingProfitabilityStatus.BreakEven;
  return {
    status,
    realized: true,
    ...(value.grossResult === undefined ? {} : { grossResult: value.grossResult }),
    netResult: value.netResult,
    ...(value.fees === undefined ? {} : { fees: value.fees }),
    ...(value.slippage === undefined ? {} : { slippage: value.slippage }),
    ...(value.returnPercentage === undefined ? {} : { returnPercentage: value.returnPercentage }),
    ...(value.maximumCapitalEmployed === undefined ? {} : { maximumCapitalEmployed: value.maximumCapitalEmployed }),
    ...(value.currency === undefined ? {} : { currency: value.currency }),
    sourceReferenceIds: uniqueSorted(value.sourceReferenceIds),
    reasonCodes: [`REALIZED_NET_RESULT:${status}`],
  };
}

function buildWarnings(
  request: StrategyReviewRequest,
  execution: ExecutionQualityReview,
  risk: RiskDisciplineReview,
  profitability: TradingProfitabilityReview,
  prediction: PredictionQualityReview,
): ReadonlyArray<StrategyReviewIssue<StrategyReviewWarningCode>> {
  const warnings: Array<StrategyReviewIssue<StrategyReviewWarningCode>> = [
    warning(StrategyReviewWarningCode.HumanReviewRequired, [], "Any lesson or future strategy change requires separate human review."),
  ];
  if (!request.policy.requireReplay && request.replay.availability === ReplayReviewAvailability.ExplicitlyUnavailable) {
    warnings.push(warning(StrategyReviewWarningCode.ReplayExplicitlyUnavailable, request.replay.sourceReferenceIds, "Replay was explicitly unavailable and optional under this policy."));
  }
  if (execution.status === ExecutionQualityStatus.PartiallyCompliant) {
    warnings.push(warning(StrategyReviewWarningCode.NonHardExecutionDeviation, execution.sourceReferenceIds, "Execution contains a declared non-hard deviation."));
  }
  if (profitability.status === TradingProfitabilityStatus.Profit && risk.status === RiskDisciplineStatus.Violation) {
    warnings.push(warning(StrategyReviewWarningCode.ProfitableRiskViolation, risk.sourceReferenceIds, "Profit does not excuse a risk violation."));
  }
  if (prediction.status === PredictionQualityStatus.Correct && profitability.status === TradingProfitabilityStatus.Loss) {
    warnings.push(warning(StrategyReviewWarningCode.CorrectPredictionWithLoss, prediction.sourceReferenceIds, "A correct prediction and a trading loss are preserved independently."));
  }
  if (prediction.status === PredictionQualityStatus.Incorrect && profitability.status === TradingProfitabilityStatus.Profit) {
    warnings.push(warning(StrategyReviewWarningCode.IncorrectPredictionWithProfit, prediction.sourceReferenceIds, "An incorrect prediction and a trading profit are preserved independently."));
  }
  return sortIssues(warnings);
}

function determineStatus(blockers: ReadonlyArray<StrategyReviewIssue<StrategyReviewBlockerCode>>): StrategyReviewStatus {
  const codes = new Set(blockers.map((value) => value.code));
  if ([
    StrategyReviewBlockerCode.ActivePrediction,
    StrategyReviewBlockerCode.PredictionReviewIncomplete,
    StrategyReviewBlockerCode.ExecutionIncomplete,
    StrategyReviewBlockerCode.OutcomeNotFinalized,
    StrategyReviewBlockerCode.FrozenPlanActive,
    StrategyReviewBlockerCode.ReplayUnresolved,
    StrategyReviewBlockerCode.EvidenceConflicting,
  ].some((code) => codes.has(code))) return StrategyReviewStatus.Blocked;
  if ([
    StrategyReviewBlockerCode.OutcomeUnavailable,
    StrategyReviewBlockerCode.RequiredReplayUnavailable,
    StrategyReviewBlockerCode.EvidenceUnavailable,
    StrategyReviewBlockerCode.DimensionSourceUnavailable,
  ].some((code) => codes.has(code))) return StrategyReviewStatus.Unavailable;
  return blockers.length > 0 ? StrategyReviewStatus.Incomplete : StrategyReviewStatus.Complete;
}

function closedPredictionReview(request: StrategyReviewRequest): PredictionQualityReview {
  return {
    status: request.evidenceAssessment.overallStatus === EvidenceAssessmentStatus.Unavailable ? PredictionQualityStatus.Unavailable : PredictionQualityStatus.Indeterminate,
    sourceAccuracy: request.prediction.accuracy,
    sourceReferenceIds: uniqueSorted(request.prediction.sourceReferenceIds),
    reasonCodes: ["FORMAL_REVIEW_GATE_CLOSED"],
  };
}

function closedExecutionReview(request: StrategyReviewRequest): ExecutionQualityReview {
  return executionReview(
    request.evidenceAssessment.overallStatus === EvidenceAssessmentStatus.Unavailable ? ExecutionQualityStatus.Unavailable : ExecutionQualityStatus.Indeterminate,
    copyExecutionFindings(request.execution.findings),
    request.execution.sourceReferenceIds,
    ["FORMAL_REVIEW_GATE_CLOSED"],
  );
}

function closedRiskReview(request: StrategyReviewRequest): RiskDisciplineReview {
  return riskReview(
    request.evidenceAssessment.overallStatus === EvidenceAssessmentStatus.Unavailable ? RiskDisciplineStatus.Unavailable : RiskDisciplineStatus.PartialOrUnknown,
    copyRiskFindings(request.risk.findings),
    request.risk.sourceReferenceIds,
    ["FORMAL_REVIEW_GATE_CLOSED"],
  );
}

function closedProfitabilityReview(request: StrategyReviewRequest): TradingProfitabilityReview {
  return {
    status: TradingProfitabilityStatus.Unavailable,
    realized: false,
    sourceReferenceIds: uniqueSorted(request.profitability.sourceReferenceIds),
    reasonCodes: ["FORMAL_REVIEW_OR_FINALIZED_OUTCOME_UNAVAILABLE"],
  };
}

function executionReview(
  status: ExecutionQualityStatus,
  findings: ReadonlyArray<ExecutionReviewFinding>,
  sourceReferenceIds: ReadonlyArray<string>,
  reasonCodes: ReadonlyArray<string>,
): ExecutionQualityReview {
  return {
    status,
    findings,
    compliantFindingIds: findingIds(findings, ReviewFindingStatus.Compliant),
    violationFindingIds: findingIds(findings, ReviewFindingStatus.Violation),
    unknownFindingIds: findingIds(findings, ReviewFindingStatus.Unknown),
    sourceReferenceIds: uniqueSorted(sourceReferenceIds),
    reasonCodes: uniqueSorted(reasonCodes),
  };
}

function riskReview(
  status: RiskDisciplineStatus,
  findings: ReadonlyArray<RiskReviewFinding>,
  sourceReferenceIds: ReadonlyArray<string>,
  reasonCodes: ReadonlyArray<string>,
): RiskDisciplineReview {
  return {
    status,
    findings,
    compliantFindingIds: findingIds(findings, ReviewFindingStatus.Compliant),
    violationFindingIds: findingIds(findings, ReviewFindingStatus.Violation),
    unknownFindingIds: findingIds(findings, ReviewFindingStatus.Unknown),
    sourceReferenceIds: uniqueSorted(sourceReferenceIds),
    reasonCodes: uniqueSorted(reasonCodes),
  };
}

function validateRequest(value: unknown): StrategyReviewRequest {
  if (!isRecord(value)
    || value.schemaVersion !== STRATEGY_REVIEW_SCHEMA_VERSION
    || !validId(value.reviewId)
    || !validTimestamp(value.evaluatedAt)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Strategy Review identity, schema version, or evaluation timestamp is invalid.");
  }
  const policy = validatePolicy(value.policy);
  const sourceReferences = validateSources(value.sourceReferences);
  const sourceIds = new Set(sourceReferences.map((source) => source.referenceId));
  const prediction = validatePrediction(value.prediction, sourceIds);
  const strategyVersion = validateStrategy(value.strategyVersion, sourceIds);
  const frozenPlan = validateFrozenPlan(value.frozenPlan, sourceIds, value.evaluatedAt);
  const execution = validateExecution(value.execution, sourceIds);
  const profitability = validateProfitability(value.profitability, sourceIds);
  const risk = validateRisk(value.risk, sourceIds);
  const replay = validateReplay(value.replay, sourceIds);
  const evidenceAssessment = validateEvidenceAssessment(value.evidenceAssessment, prediction.predictionId, value.evaluatedAt);
  const trace = validateTrace(value.trace, "trace");
  requireSource(sourceReferences, StrategyReviewSourceType.Prediction, prediction.predictionId);
  requireSource(sourceReferences, StrategyReviewSourceType.PredictionOutcome, prediction.outcomeId);
  requireSource(sourceReferences, StrategyReviewSourceType.PredictionReview, prediction.reviewId);
  requireSource(sourceReferences, StrategyReviewSourceType.StrategyVersion, strategyVersion.versionId);
  requireSource(sourceReferences, StrategyReviewSourceType.FrozenPlan, frozenPlan.planId);
  requireSource(sourceReferences, StrategyReviewSourceType.Execution, execution.tradeId);
  requireSource(sourceReferences, StrategyReviewSourceType.TradeOutcome, profitability.outcomeId);
  requireSource(sourceReferences, StrategyReviewSourceType.RiskAssessment, risk.riskAssessmentId);
  requireSource(sourceReferences, StrategyReviewSourceType.EvidenceAssessment, evidenceAssessment.assessmentId);
  if (replay.sessionId !== undefined) requireSource(sourceReferences, StrategyReviewSourceType.EventReplay, replay.sessionId);

  return {
    schemaVersion: STRATEGY_REVIEW_SCHEMA_VERSION,
    reviewId: value.reviewId,
    evaluatedAt: value.evaluatedAt,
    policy,
    evidenceAssessment,
    prediction,
    strategyVersion,
    frozenPlan,
    execution,
    profitability,
    risk,
    replay,
    sourceReferences,
    trace,
  };
}

function validatePolicy(value: unknown): StrategyReviewPolicy {
  if (!isRecord(value) || !validId(value.policyId) || !validVersion(value.version) || typeof value.requireReplay !== "boolean") {
    throw new StrategyReviewError(StrategyReviewErrorCode.InvalidPolicy, "Strategy Review policy identity or replay rule is invalid.");
  }
  const requiredExecutionCriteria = validateEnumArray(value.requiredExecutionCriteria, executionCriteria, "requiredExecutionCriteria") as ExecutionReviewCriterion[];
  const hardExecutionCriteria = validateEnumArray(value.hardExecutionCriteria, executionCriteria, "hardExecutionCriteria") as ExecutionReviewCriterion[];
  const requiredRiskCriteria = validateEnumArray(value.requiredRiskCriteria, riskCriteria, "requiredRiskCriteria") as RiskReviewCriterion[];
  if (requiredExecutionCriteria.length === 0 || requiredRiskCriteria.length === 0 || hardExecutionCriteria.some((criterion) => !requiredExecutionCriteria.includes(criterion))) {
    throw new StrategyReviewError(StrategyReviewErrorCode.InvalidPolicy, "Review policy requires non-empty criteria and every hard execution criterion must also be required.");
  }
  return { policyId: value.policyId, version: value.version, requireReplay: value.requireReplay, requiredExecutionCriteria, hardExecutionCriteria, requiredRiskCriteria };
}

function validateSources(value: unknown): ReadonlyArray<StrategyReviewSourceReference> {
  if (!Array.isArray(value) || value.length > MAX_COLLECTION_SIZE) throw new StrategyReviewError(StrategyReviewErrorCode.InvalidSourceReference, "sourceReferences must be a bounded array.");
  const ids = new Set<string>();
  return value.map((candidate, index) => {
    if (!isRecord(candidate)
      || !validId(candidate.referenceId)
      || typeof candidate.sourceType !== "string" || !sourceTypes.has(candidate.sourceType)
      || !validId(candidate.sourceId)
      || !validVersion(candidate.version)
      || !validStatus(candidate.status)
      || typeof candidate.availability !== "string" || !sourceAvailabilities.has(candidate.availability)
      || !validIdArray(candidate.auditReferenceIds)) {
      throw new StrategyReviewError(StrategyReviewErrorCode.InvalidSourceReference, `sourceReferences[${index}] is invalid.`);
    }
    if (ids.has(candidate.referenceId)) throw new StrategyReviewError(StrategyReviewErrorCode.DuplicateSourceReference, `Duplicate source reference '${candidate.referenceId}'.`);
    ids.add(candidate.referenceId);
    return {
      referenceId: candidate.referenceId,
      sourceType: candidate.sourceType as StrategyReviewSourceType,
      sourceId: candidate.sourceId,
      version: candidate.version,
      status: candidate.status,
      availability: candidate.availability as StrategyReviewSourceAvailability,
      auditReferenceIds: uniqueSorted(candidate.auditReferenceIds),
    };
  });
}

function validatePrediction(value: unknown, sourceIds: ReadonlySet<string>): StrategyReviewRequest["prediction"] {
  if (!isRecord(value)
    || !validId(value.predictionId) || !validVersion(value.predictionVersion)
    || typeof value.status !== "string" || !predictionStatuses.has(value.status)
    || !validId(value.outcomeId) || !validId(value.reviewId)
    || typeof value.reviewStatus !== "string" || !predictionReviewStatuses.has(value.reviewStatus)
    || typeof value.accuracy !== "string" || !predictionAccuracies.has(value.accuracy)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Prediction review evidence is invalid.");
  }
  const sourceReferenceIds = validateReferencedIds(value.sourceReferenceIds, sourceIds, "prediction.sourceReferenceIds");
  return { predictionId: value.predictionId, predictionVersion: value.predictionVersion, status: value.status as PredictionStatus, outcomeId: value.outcomeId, reviewId: value.reviewId, reviewStatus: value.reviewStatus as PredictionReviewStatus, accuracy: value.accuracy as PredictionAccuracy, sourceReferenceIds };
}

function validateStrategy(value: unknown, sourceIds: ReadonlySet<string>): StrategyReviewRequest["strategyVersion"] {
  if (!isRecord(value) || !validId(value.versionId) || !validVersion(value.semanticVersion)) throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Strategy version reference is invalid.");
  return { versionId: value.versionId, semanticVersion: value.semanticVersion, sourceReferenceIds: validateReferencedIds(value.sourceReferenceIds, sourceIds, "strategyVersion.sourceReferenceIds") };
}

function validateFrozenPlan(value: unknown, sourceIds: ReadonlySet<string>, evaluatedAt: string): StrategyReviewRequest["frozenPlan"] {
  if (!isRecord(value) || !validId(value.planId) || !validTimestamp(value.frozenAt) || Date.parse(value.frozenAt) > Date.parse(evaluatedAt) || !Object.values(FrozenPlanReviewStatus).includes(value.status as FrozenPlanReviewStatus)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Frozen-plan reference is invalid.");
  }
  return { planId: value.planId, frozenAt: value.frozenAt, status: value.status as FrozenPlanReviewStatus, sourceReferenceIds: validateReferencedIds(value.sourceReferenceIds, sourceIds, "frozenPlan.sourceReferenceIds") };
}

function validateExecution(value: unknown, sourceIds: ReadonlySet<string>): StrategyReviewRequest["execution"] {
  if (!isRecord(value) || !validId(value.tradeId) || typeof value.tradeStatus !== "string" || !tradeStatuses.has(value.tradeStatus) || typeof value.availability !== "string" || !sourceAvailabilities.has(value.availability)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Execution evidence is invalid.");
  }
  return {
    tradeId: value.tradeId,
    tradeStatus: value.tradeStatus as TradeStatus,
    availability: value.availability as StrategyReviewSourceAvailability,
    findings: validateFindings(value.findings, executionCriteria, sourceIds, "execution.findings") as ExecutionReviewFinding[],
    sourceReferenceIds: validateReferencedIds(value.sourceReferenceIds, sourceIds, "execution.sourceReferenceIds"),
  };
}

function validateProfitability(value: unknown, sourceIds: ReadonlySet<string>): StrategyReviewRequest["profitability"] {
  if (!isRecord(value)
    || !validId(value.outcomeId)
    || !Object.values(OutcomeFinalizationStatus).includes(value.finalizationStatus as OutcomeFinalizationStatus)
    || typeof value.availability !== "string" || !sourceAvailabilities.has(value.availability)
    || typeof value.realized !== "boolean") {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Profitability evidence identity or lifecycle is invalid.");
  }
  const available = value.availability === StrategyReviewSourceAvailability.Available;
  if (available && (!finite(value.grossResult) || !finite(value.netResult) || !nonNegative(value.fees) || !finite(value.returnPercentage) || !validCurrency(value.currency))) {
    throw new StrategyReviewError(StrategyReviewErrorCode.InvalidEconomicResult, "Available profitability evidence requires finite economic values, non-negative fees, and a currency.");
  }
  if ((value.slippage !== undefined && !nonNegative(value.slippage)) || (value.maximumCapitalEmployed !== undefined && !nonNegative(value.maximumCapitalEmployed))) {
    throw new StrategyReviewError(StrategyReviewErrorCode.InvalidEconomicResult, "Slippage and maximum capital employed must be non-negative when supplied.");
  }
  return {
    outcomeId: value.outcomeId,
    finalizationStatus: value.finalizationStatus as OutcomeFinalizationStatus,
    availability: value.availability as StrategyReviewSourceAvailability,
    realized: value.realized,
    ...(value.grossResult === undefined ? {} : { grossResult: value.grossResult as number }),
    ...(value.netResult === undefined ? {} : { netResult: value.netResult as number }),
    ...(value.fees === undefined ? {} : { fees: value.fees as number }),
    ...(value.slippage === undefined ? {} : { slippage: value.slippage as number }),
    ...(value.returnPercentage === undefined ? {} : { returnPercentage: value.returnPercentage as number }),
    ...(value.maximumCapitalEmployed === undefined ? {} : { maximumCapitalEmployed: value.maximumCapitalEmployed as number }),
    ...(value.currency === undefined ? {} : { currency: value.currency as string }),
    sourceReferenceIds: validateReferencedIds(value.sourceReferenceIds, sourceIds, "profitability.sourceReferenceIds"),
  };
}

function validateRisk(value: unknown, sourceIds: ReadonlySet<string>): StrategyReviewRequest["risk"] {
  if (!isRecord(value) || !validId(value.riskAssessmentId) || !validVersion(value.riskPolicyVersion) || typeof value.availability !== "string" || !sourceAvailabilities.has(value.availability)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Risk evidence is invalid.");
  }
  return {
    riskAssessmentId: value.riskAssessmentId,
    riskPolicyVersion: value.riskPolicyVersion,
    availability: value.availability as StrategyReviewSourceAvailability,
    findings: validateFindings(value.findings, riskCriteria, sourceIds, "risk.findings") as RiskReviewFinding[],
    sourceReferenceIds: validateReferencedIds(value.sourceReferenceIds, sourceIds, "risk.sourceReferenceIds"),
  };
}

function validateReplay(value: unknown, sourceIds: ReadonlySet<string>): StrategyReviewRequest["replay"] {
  if (!isRecord(value) || !Object.values(ReplayReviewAvailability).includes(value.availability as ReplayReviewAvailability)) throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Replay reference is invalid.");
  if (value.availability === ReplayReviewAvailability.Available
    && (!validId(value.sessionId) || !validVersion(value.sessionVersion) || typeof value.status !== "string" || !replayStatuses.has(value.status))) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Available replay requires a valid session, version, and lifecycle status.");
  }
  if (value.availability !== ReplayReviewAvailability.Available && (value.sessionId !== undefined || value.sessionVersion !== undefined || value.status !== undefined)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, "Unavailable or unresolved replay cannot claim resolved session data.");
  }
  return {
    availability: value.availability as ReplayReviewAvailability,
    ...(value.sessionId === undefined ? {} : { sessionId: value.sessionId as string }),
    ...(value.sessionVersion === undefined ? {} : { sessionVersion: value.sessionVersion as string }),
    ...(value.status === undefined ? {} : { status: value.status as EventReplayLifecycleStatus }),
    sourceReferenceIds: validateReferencedIds(value.sourceReferenceIds, sourceIds, "replay.sourceReferenceIds"),
  };
}

function validateEvidenceAssessment(value: unknown, predictionId: string, evaluatedAt: string): StrategyReviewRequest["evidenceAssessment"] {
  if (!isRecord(value)
    || value.schemaVersion !== "1.0"
    || !validId(value.assessmentId)
    || !validTimestamp(value.evaluatedAt)
    || Date.parse(value.evaluatedAt) > Date.parse(evaluatedAt)
    || value.deterministic !== true
    || value.readOnly !== true
    || typeof value.overallStatus !== "string" || !evidenceStatuses.has(value.overallStatus)
    || !isRecord(value.subject) || value.subject.entityType !== EvidenceEntityType.Prediction || value.subject.entityId !== predictionId
    || !isRecord(value.policy) || !validId(value.policy.policyId) || !validVersion(value.policy.version)
    || !Array.isArray(value.blockers) || !Array.isArray(value.conflicts) || !Array.isArray(value.unresolvedEvidenceItemIds)
    || !isRecord(value.trace)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.InvalidEvidenceAssessment, "Evidence assessment is malformed, non-deterministic, future-dated, or not scoped to the reviewed prediction.");
  }
  return value as unknown as StrategyReviewRequest["evidenceAssessment"];
}

function validateFindings(value: unknown, criteria: ReadonlySet<string>, sourceIds: ReadonlySet<string>, path: string): ReadonlyArray<StrategyReviewFindingShape> {
  if (!Array.isArray(value) || value.length > MAX_COLLECTION_SIZE) throw new StrategyReviewError(StrategyReviewErrorCode.InvalidFinding, `${path} must be a bounded array.`);
  const ids = new Set<string>();
  const criterionIds = new Set<string>();
  return value.map((candidate, index) => {
    if (!isRecord(candidate) || !validId(candidate.findingId) || typeof candidate.criterion !== "string" || !criteria.has(candidate.criterion) || typeof candidate.status !== "string" || !findingStatuses.has(candidate.status)) {
      throw new StrategyReviewError(StrategyReviewErrorCode.InvalidFinding, `${path}[${index}] is invalid.`);
    }
    if (ids.has(candidate.findingId) || criterionIds.has(candidate.criterion)) throw new StrategyReviewError(StrategyReviewErrorCode.DuplicateFinding, `${path}[${index}] duplicates a finding or criterion.`);
    ids.add(candidate.findingId);
    criterionIds.add(candidate.criterion);
    return { findingId: candidate.findingId, criterion: candidate.criterion, status: candidate.status as ReviewFindingStatus, sourceReferenceIds: validateReferencedIds(candidate.sourceReferenceIds, sourceIds, `${path}[${index}].sourceReferenceIds`) };
  });
}

interface StrategyReviewFindingShape {
  readonly findingId: string;
  readonly criterion: string;
  readonly status: ReviewFindingStatus;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

function requireSource(sources: ReadonlyArray<StrategyReviewSourceReference>, type: StrategyReviewSourceType, sourceId: string): void {
  if (!sources.some((source) => source.sourceType === type && source.sourceId === sourceId)) {
    throw new StrategyReviewError(StrategyReviewErrorCode.MissingSourceReference, `Missing ${type} source reference for '${sourceId}'.`);
  }
}

function validateReferencedIds(value: unknown, sourceIds: ReadonlySet<string>, path: string): ReadonlyArray<string> {
  if (!validIdArray(value) || value.length === 0 || value.some((id) => !sourceIds.has(id))) throw new StrategyReviewError(StrategyReviewErrorCode.InvalidSourceReference, `${path} must contain known source reference IDs.`);
  return uniqueSorted(value);
}

function validateTrace(value: unknown, path: string): StrategyReviewTraceMetadata {
  if (!isRecord(value) || !validIdArray(value.correlationIds) || !validIdArray(value.traceIds) || !validIdArray(value.auditReferenceIds)) throw new StrategyReviewError(StrategyReviewErrorCode.MalformedRequest, `${path} is invalid.`);
  return { correlationIds: uniqueSorted(value.correlationIds), traceIds: uniqueSorted(value.traceIds), auditReferenceIds: uniqueSorted(value.auditReferenceIds) };
}

function validateEnumArray(value: unknown, allowed: ReadonlySet<string>, path: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_COLLECTION_SIZE || !value.every((item) => typeof item === "string" && allowed.has(item)) || new Set(value).size !== value.length) {
    throw new StrategyReviewError(StrategyReviewErrorCode.InvalidPolicy, `${path} is invalid or contains duplicates.`);
  }
  return [...value].sort((left, right) => left.localeCompare(right));
}

function copyPolicy(value: StrategyReviewPolicy): StrategyReviewPolicy {
  return { policyId: value.policyId, version: value.version, requireReplay: value.requireReplay, requiredExecutionCriteria: [...value.requiredExecutionCriteria].sort(), hardExecutionCriteria: [...value.hardExecutionCriteria].sort(), requiredRiskCriteria: [...value.requiredRiskCriteria].sort() };
}

function copySource(value: StrategyReviewSourceReference): StrategyReviewSourceReference {
  return { referenceId: value.referenceId, sourceType: value.sourceType, sourceId: value.sourceId, version: value.version, status: value.status, availability: value.availability, auditReferenceIds: uniqueSorted(value.auditReferenceIds) };
}

function copyExecutionFindings(values: ReadonlyArray<ExecutionReviewFinding>): ReadonlyArray<ExecutionReviewFinding> {
  return [...values].sort(compareFindings).map((value) => ({ findingId: value.findingId, criterion: value.criterion, status: value.status, sourceReferenceIds: uniqueSorted(value.sourceReferenceIds) }));
}

function copyRiskFindings(values: ReadonlyArray<RiskReviewFinding>): ReadonlyArray<RiskReviewFinding> {
  return [...values].sort(compareFindings).map((value) => ({ findingId: value.findingId, criterion: value.criterion, status: value.status, sourceReferenceIds: uniqueSorted(value.sourceReferenceIds) }));
}

function compareFindings(left: StrategyReviewFindingShape, right: StrategyReviewFindingShape): number {
  return left.criterion.localeCompare(right.criterion) || left.findingId.localeCompare(right.findingId);
}

function findingIds(values: ReadonlyArray<StrategyReviewFindingShape>, status: ReviewFindingStatus): ReadonlyArray<string> {
  return values.filter((finding) => finding.status === status).map((finding) => finding.findingId).sort();
}

function evidenceSourceIds(request: StrategyReviewRequest): ReadonlyArray<string> {
  return request.sourceReferences.filter((source) => source.sourceType === StrategyReviewSourceType.EvidenceAssessment).map((source) => source.referenceId);
}

function unresolvedSourceIds(
  request: StrategyReviewRequest,
  sources: ReadonlyArray<StrategyReviewSourceReference>,
): ReadonlyArray<string> {
  return uniqueSorted([
    ...sources.filter((source) => source.availability === StrategyReviewSourceAvailability.Unavailable).map((source) => source.referenceId),
    ...(request.execution.availability === StrategyReviewSourceAvailability.Unavailable ? request.execution.sourceReferenceIds : []),
    ...(request.risk.availability === StrategyReviewSourceAvailability.Unavailable ? request.risk.sourceReferenceIds : []),
    ...(request.profitability.availability === StrategyReviewSourceAvailability.Unavailable ? request.profitability.sourceReferenceIds : []),
    ...(request.replay.availability === ReplayReviewAvailability.Unresolved ? request.replay.sourceReferenceIds : []),
  ]);
}

function mergeTrace(request: StrategyReviewRequest, sources: ReadonlyArray<StrategyReviewSourceReference>): StrategyReviewTraceMetadata {
  return {
    correlationIds: uniqueSorted([...request.trace.correlationIds, ...request.evidenceAssessment.trace.correlationIds]),
    traceIds: uniqueSorted([...request.trace.traceIds, ...request.evidenceAssessment.trace.traceIds]),
    auditReferenceIds: uniqueSorted([...request.trace.auditReferenceIds, ...request.evidenceAssessment.trace.auditReferenceIds, ...sources.flatMap((source) => source.auditReferenceIds)]),
  };
}

function blocker(code: StrategyReviewBlockerCode, sourceReferenceIds: ReadonlyArray<string>, message: string): StrategyReviewIssue<StrategyReviewBlockerCode> {
  return { code, sourceReferenceIds: uniqueSorted(sourceReferenceIds), message };
}

function warning(code: StrategyReviewWarningCode, sourceReferenceIds: ReadonlyArray<string>, message: string): StrategyReviewIssue<StrategyReviewWarningCode> {
  return { code, sourceReferenceIds: uniqueSorted(sourceReferenceIds), message };
}

function sortIssues<TCode extends string>(values: ReadonlyArray<StrategyReviewIssue<TCode>>): ReadonlyArray<StrategyReviewIssue<TCode>> {
  return [...values].sort((left, right) => left.code.localeCompare(right.code) || left.sourceReferenceIds.join("|").localeCompare(right.sourceReferenceIds.join("|")));
}

function validId(value: unknown): value is string { return typeof value === "string" && IDENTIFIER.test(value); }
function validVersion(value: unknown): value is string { return typeof value === "string" && VERSION.test(value); }
function validStatus(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 100; }
function validCurrency(value: unknown): value is string { return typeof value === "string" && /^[A-Z]{3,5}$/u.test(value); }
function validTimestamp(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value)); }
function validIdArray(value: unknown): value is ReadonlyArray<string> { return Array.isArray(value) && value.length <= MAX_COLLECTION_SIZE && value.every(validId) && new Set(value).size === value.length; }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function nonNegative(value: unknown): value is number { return finite(value) && value >= 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function uniqueSorted(values: ReadonlyArray<string>): ReadonlyArray<string> { return [...new Set(values)].sort((left, right) => left.localeCompare(right)); }

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}
