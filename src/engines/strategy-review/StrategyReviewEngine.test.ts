import {
  EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
  EvidenceAssessmentBlockerCode,
  EvidenceAssessmentStatus,
  EvidenceConflictReason,
  EvidenceEntityResolutionStatus,
  EvidenceEntityType,
  EvidenceLinkResolutionStatus,
  EvidenceRelationType,
  EvidenceRequirement,
  EventReplayLifecycleStatus,
  ExecutionQualityStatus,
  ExecutionReviewCriterion,
  FrozenPlanReviewStatus,
  OutcomeFinalizationStatus,
  PredictionAccuracy,
  PredictionQualityStatus,
  PredictionReviewStatus,
  PredictionStatus,
  ReplayReviewAvailability,
  ReviewFindingStatus,
  RiskDisciplineStatus,
  RiskReviewCriterion,
  STRATEGY_REVIEW_SCHEMA_VERSION,
  StrategyReviewBlockerCode,
  StrategyReviewErrorCode,
  StrategyReviewSourceAvailability,
  StrategyReviewSourceType,
  StrategyReviewStatus,
  StrategyReviewWarningCode,
  TradeStatus,
  TradingProfitabilityStatus,
  type EvidenceAssessment,
  type StrategyReviewRequest,
  type StrategyReviewSourceReference,
} from "../../contracts";
import { EvidenceEngine } from "../evidence-engine";
import { StrategyReviewEngine, StrategyReviewError } from "./StrategyReviewEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function hasKey(value: unknown, prohibited: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, prohibited));
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(([key, child]) => prohibited.has(key) || hasKey(child, prohibited));
}

function expectError(run: () => void, code: StrategyReviewErrorCode): void {
  try {
    run();
  } catch (error) {
    if (error instanceof StrategyReviewError && error.code === code) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const evidenceEngine = new EvidenceEngine();
const reviewEngine = new StrategyReviewEngine();

function sufficientEvidence(): EvidenceAssessment {
  return evidenceEngine.assess({
    schemaVersion: EVIDENCE_ASSESSMENT_SCHEMA_VERSION,
    assessmentId: "evidence-assessment:strategy-review",
    subject: { entityType: EvidenceEntityType.Prediction, entityId: "prediction:reviewed", version: "1.0" },
    evaluatedAt: "2026-07-20T11:00:00.000Z",
    policy: {
      policyId: "evidence-policy:review",
      version: "1.0",
      minimumRequiredEvidence: 1,
      requireProvenanceForRequiredEvidence: true,
      requireExplicitVersionForRequiredEvidence: true,
      freshnessRules: [],
    },
    linkedEvidence: {
      links: [{
        linkId: "evidence-link:review",
        source: {
          reference: { entityType: EvidenceEntityType.Prediction, entityId: "prediction:reviewed", version: "1.0" },
          status: EvidenceEntityResolutionStatus.Resolved,
          resolvedVersion: "1.0",
          audit: { correlationIds: ["correlation:evidence"], traceIds: ["trace:evidence"], auditReferenceIds: ["audit:evidence-source"] },
          warnings: [],
        },
        relation: EvidenceRelationType.SupportedBy,
        target: {
          reference: { entityType: EvidenceEntityType.HistoricalPattern, entityId: "historical-pattern:review", version: "1.0" },
          status: EvidenceEntityResolutionStatus.Resolved,
          resolvedVersion: "1.0",
          audit: { correlationIds: ["correlation:evidence"], traceIds: ["trace:evidence"], auditReferenceIds: ["audit:evidence-target"] },
          warnings: [],
        },
        status: EvidenceLinkResolutionStatus.Resolved,
        warnings: [],
      }],
      warnings: [],
      deterministic: true,
      readOnly: true,
    },
    evidenceItems: [{ itemId: "evidence-item:review", linkId: "evidence-link:review", requirement: EvidenceRequirement.Required }],
    conflicts: [],
  });
}

function evidenceWithStatus(status: EvidenceAssessmentStatus): EvidenceAssessment {
  const sufficient = sufficientEvidence();
  if (status === EvidenceAssessmentStatus.Sufficient) return sufficient;
  const blockerCode = status === EvidenceAssessmentStatus.Insufficient
    ? EvidenceAssessmentBlockerCode.RequiredEvidenceUnresolved
    : status === EvidenceAssessmentStatus.Conflicting
      ? EvidenceAssessmentBlockerCode.RequiredEvidenceConflicting
      : EvidenceAssessmentBlockerCode.RequiredSourceUnavailable;
  return Object.freeze({
    ...sufficient,
    overallStatus: status,
    blockers: [{ code: blockerCode, itemIds: ["evidence-item:review"], message: "Test evidence gate state." }],
    unresolvedEvidenceItemIds: status === EvidenceAssessmentStatus.Insufficient ? ["evidence-item:review"] : [],
    conflicts: status === EvidenceAssessmentStatus.Conflicting
      ? [{ conflictId: "conflict:review", itemIds: ["evidence-item:review", "evidence-item:other"], field: "outcome.direction", reason: EvidenceConflictReason.ContradictoryFact }]
      : [],
  });
}

function source(
  referenceId: string,
  sourceType: StrategyReviewSourceType,
  sourceId: string,
  status: string,
  availability = StrategyReviewSourceAvailability.Available,
): StrategyReviewSourceReference {
  return { referenceId, sourceType, sourceId, version: "1.0", status, availability, auditReferenceIds: [`audit:${referenceId}`] };
}

function sources(): StrategyReviewSourceReference[] {
  return [
    source("source:prediction", StrategyReviewSourceType.Prediction, "prediction:reviewed", PredictionStatus.Reviewed),
    source("source:prediction-outcome", StrategyReviewSourceType.PredictionOutcome, "prediction-outcome:reviewed", "FINALIZED"),
    source("source:prediction-review", StrategyReviewSourceType.PredictionReview, "prediction-review:completed", PredictionReviewStatus.Completed),
    source("source:strategy", StrategyReviewSourceType.StrategyVersion, "strategy-version:one", "ACTIVE"),
    source("source:plan", StrategyReviewSourceType.FrozenPlan, "frozen-plan:one", FrozenPlanReviewStatus.ReleasedAfterCompletion),
    source("source:execution", StrategyReviewSourceType.Execution, "trade:one", TradeStatus.Closed),
    source("source:trade-outcome", StrategyReviewSourceType.TradeOutcome, "trade-outcome:one", OutcomeFinalizationStatus.Finalized),
    source("source:risk", StrategyReviewSourceType.RiskAssessment, "risk-assessment:one", "COMPLETED"),
    source("source:replay", StrategyReviewSourceType.EventReplay, "replay-session:one", EventReplayLifecycleStatus.Completed),
    source("source:evidence", StrategyReviewSourceType.EvidenceAssessment, "evidence-assessment:strategy-review", EvidenceAssessmentStatus.Sufficient),
  ];
}

function executionFindings(status = ReviewFindingStatus.Compliant) {
  return [
    { findingId: "execution-finding:entry", criterion: ExecutionReviewCriterion.Entry, status, sourceReferenceIds: ["source:execution", "source:plan"] },
    { findingId: "execution-finding:size", criterion: ExecutionReviewCriterion.PositionSizing, status: ReviewFindingStatus.Compliant, sourceReferenceIds: ["source:execution", "source:plan"] },
    { findingId: "execution-finding:stop", criterion: ExecutionReviewCriterion.StopLoss, status: ReviewFindingStatus.Compliant, sourceReferenceIds: ["source:execution", "source:plan"] },
  ];
}

function riskFindings(status = ReviewFindingStatus.Compliant) {
  return [
    { findingId: "risk-finding:limits", criterion: RiskReviewCriterion.RiskEngineLimits, status, sourceReferenceIds: ["source:risk"] },
    { findingId: "risk-finding:size", criterion: RiskReviewCriterion.PositionSize, status: ReviewFindingStatus.Compliant, sourceReferenceIds: ["source:risk"] },
  ];
}

function request(): StrategyReviewRequest {
  return {
    schemaVersion: STRATEGY_REVIEW_SCHEMA_VERSION,
    reviewId: "strategy-review:one",
    evaluatedAt: "2026-07-20T12:00:00.000Z",
    policy: {
      policyId: "strategy-review-policy:default",
      version: "1.0",
      requireReplay: false,
      requiredExecutionCriteria: [ExecutionReviewCriterion.Entry, ExecutionReviewCriterion.PositionSizing, ExecutionReviewCriterion.StopLoss],
      hardExecutionCriteria: [ExecutionReviewCriterion.PositionSizing, ExecutionReviewCriterion.StopLoss],
      requiredRiskCriteria: [RiskReviewCriterion.RiskEngineLimits, RiskReviewCriterion.PositionSize],
    },
    evidenceAssessment: sufficientEvidence(),
    prediction: {
      predictionId: "prediction:reviewed",
      predictionVersion: "1.0",
      status: PredictionStatus.Reviewed,
      outcomeId: "prediction-outcome:reviewed",
      reviewId: "prediction-review:completed",
      reviewStatus: PredictionReviewStatus.Completed,
      accuracy: PredictionAccuracy.Accurate,
      sourceReferenceIds: ["source:prediction", "source:prediction-outcome", "source:prediction-review"],
    },
    strategyVersion: { versionId: "strategy-version:one", semanticVersion: "2.1.0", sourceReferenceIds: ["source:strategy"] },
    frozenPlan: { planId: "frozen-plan:one", frozenAt: "2026-07-19T12:00:00.000Z", status: FrozenPlanReviewStatus.ReleasedAfterCompletion, sourceReferenceIds: ["source:plan"] },
    execution: { tradeId: "trade:one", tradeStatus: TradeStatus.Closed, availability: StrategyReviewSourceAvailability.Available, findings: executionFindings(), sourceReferenceIds: ["source:execution", "source:plan"] },
    profitability: { outcomeId: "trade-outcome:one", finalizationStatus: OutcomeFinalizationStatus.Finalized, availability: StrategyReviewSourceAvailability.Available, realized: true, grossResult: 125, netResult: 100, fees: 20, slippage: 5, returnPercentage: 10, maximumCapitalEmployed: 1000, currency: "USD", sourceReferenceIds: ["source:trade-outcome", "source:execution"] },
    risk: { riskAssessmentId: "risk-assessment:one", riskPolicyVersion: "3.0", availability: StrategyReviewSourceAvailability.Available, findings: riskFindings(), sourceReferenceIds: ["source:risk"] },
    replay: { availability: ReplayReviewAvailability.Available, sessionId: "replay-session:one", sessionVersion: "1.0", status: EventReplayLifecycleStatus.Completed, sourceReferenceIds: ["source:replay"] },
    sourceReferences: sources(),
    trace: { correlationIds: ["correlation:review"], traceIds: ["trace:review"], auditReferenceIds: ["audit:review"] },
  };
}

const tests: ReadonlyArray<{ readonly name: string; readonly run: () => void }> = [
  {
    name: "completed cycle produces four independent formal conclusions",
    run: () => {
      const result = reviewEngine.review(request());
      assertEqual(result.status, StrategyReviewStatus.Complete, "review status");
      assertEqual(result.predictionQuality.status, PredictionQualityStatus.Correct, "prediction quality");
      assertEqual(result.executionQuality.status, ExecutionQualityStatus.Compliant, "execution quality");
      assertEqual(result.riskDiscipline.status, RiskDisciplineStatus.Compliant, "risk discipline");
      assertEqual(result.tradingProfitability.status, TradingProfitabilityStatus.Profit, "profitability");
    },
  },
  {
    name: "active prediction is blocked",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, prediction: { ...value.prediction, status: PredictionStatus.Locked } });
      assertEqual(result.status, StrategyReviewStatus.Blocked, "review status");
      assertTrue(result.blockers.some((item) => item.code === StrategyReviewBlockerCode.ActivePrediction), "active blocker");
    },
  },
  {
    name: "incomplete prediction review is blocked",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, prediction: { ...value.prediction, reviewStatus: PredictionReviewStatus.Started } });
      assertEqual(result.status, StrategyReviewStatus.Blocked, "review status");
      assertTrue(result.blockers.some((item) => item.code === StrategyReviewBlockerCode.PredictionReviewIncomplete), "prediction review blocker");
    },
  },
  {
    name: "incomplete execution is blocked",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, execution: { ...value.execution, tradeStatus: TradeStatus.Open } });
      assertEqual(result.status, StrategyReviewStatus.Blocked, "review status");
      assertTrue(result.blockers.some((item) => item.code === StrategyReviewBlockerCode.ExecutionIncomplete), "execution blocker");
    },
  },
  {
    name: "unfinalized outcome is blocked",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, profitability: { ...value.profitability, finalizationStatus: OutcomeFinalizationStatus.Pending, realized: false } });
      assertEqual(result.status, StrategyReviewStatus.Blocked, "review status");
      assertTrue(result.blockers.some((item) => item.code === StrategyReviewBlockerCode.OutcomeNotFinalized), "outcome blocker");
    },
  },
  {
    name: "sufficient evidence permits formal review",
    run: () => assertEqual(reviewEngine.review(request()).eligible, true, "eligibility"),
  },
  {
    name: "insufficient evidence leaves review incomplete",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, evidenceAssessment: evidenceWithStatus(EvidenceAssessmentStatus.Insufficient) });
      assertEqual(result.status, StrategyReviewStatus.Incomplete, "review status");
      assertEqual(result.predictionQuality.status, PredictionQualityStatus.Indeterminate, "prediction conclusion withheld");
    },
  },
  {
    name: "conflicting evidence remains explicit and blocks review",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, evidenceAssessment: evidenceWithStatus(EvidenceAssessmentStatus.Conflicting) });
      assertEqual(result.status, StrategyReviewStatus.Blocked, "review status");
      assertDeepEqual(result.evidenceGate.conflictIds, ["conflict:review"], "conflicts");
    },
  },
  {
    name: "unavailable evidence withholds dependent conclusions",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, evidenceAssessment: evidenceWithStatus(EvidenceAssessmentStatus.Unavailable) });
      assertEqual(result.status, StrategyReviewStatus.Unavailable, "review status");
      assertEqual(result.predictionQuality.status, PredictionQualityStatus.Unavailable, "prediction unavailable");
      assertEqual(result.tradingProfitability.status, TradingProfitabilityStatus.Unavailable, "profitability unavailable");
    },
  },
  {
    name: "prediction quality is independent from profitability",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, profitability: { ...value.profitability, netResult: -100, returnPercentage: -10 } });
      assertEqual(result.predictionQuality.status, PredictionQualityStatus.Correct, "prediction quality");
      assertEqual(result.tradingProfitability.status, TradingProfitabilityStatus.Loss, "profitability");
    },
  },
  {
    name: "execution quality is independent from prediction quality",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, prediction: { ...value.prediction, accuracy: PredictionAccuracy.Inaccurate } });
      assertEqual(result.predictionQuality.status, PredictionQualityStatus.Incorrect, "prediction quality");
      assertEqual(result.executionQuality.status, ExecutionQualityStatus.Compliant, "execution quality");
    },
  },
  {
    name: "risk discipline is independent from profitability",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, risk: { ...value.risk, findings: riskFindings(ReviewFindingStatus.Violation) } });
      assertEqual(result.riskDiscipline.status, RiskDisciplineStatus.Violation, "risk discipline");
      assertEqual(result.tradingProfitability.status, TradingProfitabilityStatus.Profit, "profitability");
    },
  },
  {
    name: "profitable risk violation remains a violation",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, risk: { ...value.risk, findings: riskFindings(ReviewFindingStatus.Violation) } });
      assertEqual(result.riskDiscipline.status, RiskDisciplineStatus.Violation, "risk discipline");
      assertTrue(result.warnings.some((item) => item.code === StrategyReviewWarningCode.ProfitableRiskViolation), "profit-risk warning");
    },
  },
  {
    name: "correct prediction with a loss remains possible",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, profitability: { ...value.profitability, netResult: -1, returnPercentage: -0.1 } });
      assertEqual(result.predictionQuality.status, PredictionQualityStatus.Correct, "prediction");
      assertEqual(result.tradingProfitability.status, TradingProfitabilityStatus.Loss, "profitability");
      assertTrue(result.warnings.some((item) => item.code === StrategyReviewWarningCode.CorrectPredictionWithLoss), "independence warning");
    },
  },
  {
    name: "incorrect prediction with a profit remains possible",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, prediction: { ...value.prediction, accuracy: PredictionAccuracy.Inaccurate } });
      assertEqual(result.predictionQuality.status, PredictionQualityStatus.Incorrect, "prediction");
      assertEqual(result.tradingProfitability.status, TradingProfitabilityStatus.Profit, "profitability");
      assertTrue(result.warnings.some((item) => item.code === StrategyReviewWarningCode.IncorrectPredictionWithProfit), "independence warning");
    },
  },
  {
    name: "non-hard execution deviation is partial even when profitable",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, execution: { ...value.execution, findings: executionFindings(ReviewFindingStatus.Violation) } });
      assertEqual(result.executionQuality.status, ExecutionQualityStatus.PartiallyCompliant, "execution quality");
      assertEqual(result.tradingProfitability.status, TradingProfitabilityStatus.Profit, "profitability");
    },
  },
  {
    name: "hard execution deviation is non-compliant",
    run: () => {
      const value = request();
      const findings = executionFindings();
      findings[1] = { ...findings[1]!, status: ReviewFindingStatus.Violation };
      const result = reviewEngine.review({ ...value, execution: { ...value.execution, findings } });
      assertEqual(result.executionQuality.status, ExecutionQualityStatus.NonCompliant, "execution quality");
    },
  },
  {
    name: "no aggregate strategy score exists",
    run: () => {
      const result = reviewEngine.review(request()) as unknown as Record<string, unknown>;
      assertEqual("score" in result, false, "score");
      assertEqual("overallQuality" in result, false, "overall quality");
      assertEqual("ranking" in result, false, "ranking");
    },
  },
  {
    name: "no AI path exists",
    run: () => assertEqual(hasKey(reviewEngine.review(request()), new Set(["provider", "providerId", "modelId", "aiSummary", "semanticSimilarity", "fuzzyMatch"])), false, "AI fields"),
  },
  {
    name: "strategy source remains unchanged",
    run: () => {
      const value = request();
      const before = JSON.stringify(value.strategyVersion);
      reviewEngine.review(value);
      assertEqual(JSON.stringify(value.strategyVersion), before, "strategy source");
    },
  },
  {
    name: "active frozen plan is blocked without mutation",
    run: () => {
      const value = request();
      const frozenPlan = { ...value.frozenPlan, status: FrozenPlanReviewStatus.FrozenActive };
      const before = JSON.stringify(frozenPlan);
      const result = reviewEngine.review({ ...value, frozenPlan });
      assertEqual(result.status, StrategyReviewStatus.Blocked, "review status");
      assertEqual(JSON.stringify(frozenPlan), before, "plan unchanged");
    },
  },
  {
    name: "no execution or reopening instruction is emitted",
    run: () => {
      const result = reviewEngine.review(request()) as unknown as Record<string, unknown>;
      assertEqual("executionInstruction" in result, false, "execution instruction");
      assertEqual("reopenTrade" in result, false, "reopen trade");
      assertEqual((result.protections as { tradeReopeningProhibited: boolean }).tradeReopeningProhibited, true, "reopening protection");
    },
  },
  {
    name: "output is deterministic and serializable",
    run: () => {
      const value = request();
      assertEqual(JSON.stringify(reviewEngine.review(value)), JSON.stringify(reviewEngine.review(value)), "repeat output");
    },
  },
  {
    name: "output ordering is deterministic",
    run: () => {
      const value = request();
      const result = reviewEngine.review({
        ...value,
        execution: { ...value.execution, findings: [...value.execution.findings].reverse() },
        sourceReferences: [...value.sourceReferences].reverse(),
      });
      assertDeepEqual(result.executionQuality.findings.map((item) => item.criterion), [ExecutionReviewCriterion.Entry, ExecutionReviewCriterion.PositionSizing, ExecutionReviewCriterion.StopLoss], "finding order");
      assertDeepEqual(result.sourceReferences.map((item) => item.referenceId), [...result.sourceReferences.map((item) => item.referenceId)].sort(), "source order");
    },
  },
  {
    name: "policy and source versions are preserved",
    run: () => {
      const result = reviewEngine.review(request());
      assertEqual(result.policy.version, "1.0", "review policy version");
      assertEqual(result.evidenceGate.policyVersion, "1.0", "evidence policy version");
      assertEqual(result.strategyVersion.semanticVersion, "2.1.0", "strategy version");
      assertEqual(result.sourceReferences.find((item) => item.referenceId === "source:strategy")?.version, "1.0", "source version");
    },
  },
  {
    name: "all source records remain unchanged",
    run: () => {
      const value = request();
      const before = JSON.stringify(value);
      reviewEngine.review(value);
      assertEqual(JSON.stringify(value), before, "request sources");
    },
  },
  {
    name: "result is deeply immutable",
    run: () => {
      const result = reviewEngine.review(request());
      assertTrue(Object.isFrozen(result), "result frozen");
      assertTrue(Object.isFrozen(result.executionQuality.findings), "findings frozen");
      assertTrue(Object.isFrozen(result.sourceReferences[0]), "source frozen");
    },
  },
  {
    name: "optional unavailable replay permits review with warning",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, replay: { availability: ReplayReviewAvailability.ExplicitlyUnavailable, sourceReferenceIds: ["source:replay"] } });
      assertEqual(result.status, StrategyReviewStatus.Complete, "review status");
      assertTrue(result.warnings.some((item) => item.code === StrategyReviewWarningCode.ReplayExplicitlyUnavailable), "replay warning");
    },
  },
  {
    name: "required unavailable replay prevents formal review",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, policy: { ...value.policy, requireReplay: true }, replay: { availability: ReplayReviewAvailability.ExplicitlyUnavailable, sourceReferenceIds: ["source:replay"] } });
      assertEqual(result.status, StrategyReviewStatus.Unavailable, "review status");
    },
  },
  {
    name: "unresolved replay blocks formal review",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, replay: { availability: ReplayReviewAvailability.Unresolved, sourceReferenceIds: ["source:replay"] } });
      assertEqual(result.status, StrategyReviewStatus.Blocked, "review status");
      assertTrue(result.blockers.some((item) => item.code === StrategyReviewBlockerCode.ReplayUnresolved), "replay blocker");
    },
  },
  {
    name: "missing required execution finding leaves review incomplete",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, execution: { ...value.execution, findings: value.execution.findings.slice(0, 2) } });
      assertEqual(result.status, StrategyReviewStatus.Incomplete, "review status");
      assertEqual(result.executionQuality.status, ExecutionQualityStatus.Indeterminate, "execution quality");
    },
  },
  {
    name: "unknown required risk finding leaves review incomplete",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, risk: { ...value.risk, findings: riskFindings(ReviewFindingStatus.Unknown) } });
      assertEqual(result.status, StrategyReviewStatus.Incomplete, "review status");
      assertEqual(result.riskDiscipline.status, RiskDisciplineStatus.PartialOrUnknown, "risk status");
    },
  },
  {
    name: "unavailable dimension source is preserved explicitly",
    run: () => {
      const value = request();
      const result = reviewEngine.review({ ...value, risk: { ...value.risk, availability: StrategyReviewSourceAvailability.Unavailable, findings: [] } });
      assertEqual(result.status, StrategyReviewStatus.Unavailable, "review status");
      assertEqual(result.riskDiscipline.status, RiskDisciplineStatus.Unavailable, "risk status");
    },
  },
  {
    name: "malformed source reference is rejected",
    run: () => {
      const value = request();
      expectError(() => reviewEngine.review({ ...value, sourceReferences: [{ ...value.sourceReferences[0], referenceId: "" }] }), StrategyReviewErrorCode.InvalidSourceReference);
    },
  },
  {
    name: "hard execution policy must be a subset of required criteria",
    run: () => {
      const value = request();
      expectError(() => reviewEngine.review({ ...value, policy: { ...value.policy, hardExecutionCriteria: [ExecutionReviewCriterion.TakeProfit] } }), StrategyReviewErrorCode.InvalidPolicy);
    },
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`Strategy Review: ${passed}/${tests.length} tests passed`);
