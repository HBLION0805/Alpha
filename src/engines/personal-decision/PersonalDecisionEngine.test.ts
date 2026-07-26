import {
  EvidenceAssessmentStatus,
  PERSONAL_DECISION_SCHEMA_VERSION,
  PersonalDecisionAuthorizationStatus,
  PersonalDecisionBlockerCode,
  PersonalDecisionCalibrationStatus,
  PersonalDecisionDirection,
  PersonalDecisionLiquidityStatus,
  PersonalDecisionMarketDataStatus,
  PersonalDecisionRiskStatus,
  PersonalDecisionThesisDirection,
  PersonalDecisionValidationIssueCode,
  type PersonalDecisionRequest,
} from "../../contracts";
import {
  createPersonalDecisionCard,
  PersonalDecisionValidationError,
} from "./PersonalDecisionEngine";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

function expectBlocker(request: PersonalDecisionRequest, blocker: PersonalDecisionBlockerCode): void {
  const card = createPersonalDecisionCard(request);
  assertEqual(card.decision, PersonalDecisionDirection.NoTrade, "decision");
  assertTrue(card.blockerCodes.includes(blocker), `Expected blocker ${blocker}.`);
}

function expectValidationIssue(action: () => void, code: PersonalDecisionValidationIssueCode): void {
  try {
    action();
  } catch (error: unknown) {
    if (!(error instanceof PersonalDecisionValidationError)) {
      throw new Error("Expected PersonalDecisionValidationError.");
    }
    assertTrue(error.issues.some((item) => item.code === code), `Expected validation issue ${code}.`);
    return;
  }
  throw new Error(`Expected validation issue ${code}.`);
}

const longRequest: PersonalDecisionRequest = {
  schemaVersion: PERSONAL_DECISION_SCHEMA_VERSION,
  requestId: "personal-request:soxl:001",
  evaluatedAt: "2026-07-24T14:35:00.000Z",
  instrument: {
    instrumentId: "instrument:etf:soxl",
    symbol: "SOXL",
    assetClass: "ETF",
    currency: "USD",
  },
  evidence: {
    assessmentId: "evidence-assessment:soxl:001",
    status: EvidenceAssessmentStatus.Sufficient,
    evaluatedAt: "2026-07-24T14:34:00.000Z",
    policyVersion: "evidence-policy:1",
    references: ["canonical-bars:soxl:2026-07-24T14:30Z", "market-regime:001"],
  },
  market: {
    snapshotId: "market-snapshot:soxl:001",
    observedAt: "2026-07-24T14:34:30.000Z",
    status: PersonalDecisionMarketDataStatus.Current,
    spreadBasisPoints: 8,
    liquidity: PersonalDecisionLiquidityStatus.Sufficient,
  },
  probability: {
    thesisId: "prediction-thesis:soxl:001",
    direction: PersonalDecisionThesisDirection.Long,
    probabilityBasisPoints: 6_100,
    calibrationStatus: PersonalDecisionCalibrationStatus.Calibrated,
    calibrationPolicyVersion: "walk-forward:intraday-etf:1",
    calibrationSampleSize: 250,
    outOfSampleValidated: true,
  },
  tradePlan: {
    entryLower: { atomicValue: "14000", scale: 2 },
    entryUpper: { atomicValue: "14100", scale: 2 },
    stop: { atomicValue: "13800", scale: 2 },
    targets: [{ atomicValue: "14600", scale: 2 }],
    maximumHoldingUntil: "2026-07-24T19:45:00.000Z",
  },
  risk: {
    assessmentId: "risk-assessment:soxl:001",
    status: PersonalDecisionRiskStatus.Approved,
    maximumCapitalLossBasisPoints: 50,
    constraints: [],
    policyVersion: "personal-risk:1",
  },
};

const shortRequest: PersonalDecisionRequest = {
  ...structuredClone(longRequest),
  requestId: "personal-request:sqqq:001",
  instrument: {
    instrumentId: "instrument:etf:sqqq",
    symbol: "SQQQ",
    assetClass: "ETF",
    currency: "USD",
  },
  probability: {
    ...structuredClone(longRequest.probability),
    thesisId: "prediction-thesis:sqqq:001",
    direction: PersonalDecisionThesisDirection.Short,
  },
  tradePlan: {
    entryLower: { atomicValue: "4400", scale: 2 },
    entryUpper: { atomicValue: "4420", scale: 2 },
    stop: { atomicValue: "4500", scale: 2 },
    targets: [{ atomicValue: "4200", scale: 2 }],
    maximumHoldingUntil: "2026-07-24T19:45:00.000Z",
  },
  risk: {
    ...structuredClone(longRequest.risk),
    assessmentId: "risk-assessment:sqqq:001",
  },
};

const tests: readonly TestCase[] = [
  {
    name: "valid calibrated long setup creates an advisory LONG card",
    run: () => {
      const card = createPersonalDecisionCard(longRequest);
      assertEqual(card.decision, PersonalDecisionDirection.Long, "decision");
      assertEqual(card.worstEntryRewardToRiskBasisPoints, 16_666, "reward-to-risk");
      assertEqual(card.blockerCodes.length, 0, "blocker count");
      assertEqual(card.authorizationStatus, PersonalDecisionAuthorizationStatus.AdvisoryOnlyManualExecution, "authorization");
      assertEqual(card.automatedExecutionAllowed, false, "automatic execution");
      assertTrue(Object.isFrozen(card) && Object.isFrozen(card.tradePlan), "Card must be deeply frozen.");
    },
  },
  {
    name: "valid calibrated short setup creates an advisory SHORT card",
    run: () => {
      const card = createPersonalDecisionCard(shortRequest);
      assertEqual(card.decision, PersonalDecisionDirection.Short, "decision");
      assertEqual(card.worstEntryRewardToRiskBasisPoints, 20_000, "reward-to-risk");
      assertEqual(card.blockerCodes.length, 0, "blocker count");
    },
  },
  {
    name: "insufficient evidence produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      evidence: { ...longRequest.evidence, status: EvidenceAssessmentStatus.Insufficient },
    }, PersonalDecisionBlockerCode.EvidenceNotSufficient),
  },
  {
    name: "stale evidence produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      evidence: { ...longRequest.evidence, evaluatedAt: "2026-07-24T14:00:00.000Z" },
    }, PersonalDecisionBlockerCode.EvidenceStale),
  },
  {
    name: "conflicting evidence produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      evidence: { ...longRequest.evidence, status: EvidenceAssessmentStatus.Conflicting },
    }, PersonalDecisionBlockerCode.EvidenceNotSufficient),
  },
  {
    name: "stale market data produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      market: { ...longRequest.market, observedAt: "2026-07-24T14:30:00.000Z" },
    }, PersonalDecisionBlockerCode.MarketDataStale),
  },
  {
    name: "wide spread produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      market: { ...longRequest.market, spreadBasisPoints: 21 },
    }, PersonalDecisionBlockerCode.SpreadTooWide),
  },
  {
    name: "unknown liquidity produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      market: { ...longRequest.market, liquidity: PersonalDecisionLiquidityStatus.Unknown },
    }, PersonalDecisionBlockerCode.LiquidityNotSufficient),
  },
  {
    name: "uncalibrated probability produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      probability: { ...longRequest.probability, calibrationStatus: PersonalDecisionCalibrationStatus.Uncalibrated },
    }, PersonalDecisionBlockerCode.ProbabilityNotCalibrated),
  },
  {
    name: "probability below threshold produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      probability: { ...longRequest.probability, probabilityBasisPoints: 5_499 },
    }, PersonalDecisionBlockerCode.ProbabilityBelowThreshold),
  },
  {
    name: "risk block overrides an otherwise valid setup",
    run: () => expectBlocker({
      ...longRequest,
      risk: { ...longRequest.risk, status: PersonalDecisionRiskStatus.Blocked },
    }, PersonalDecisionBlockerCode.RiskNotApproved),
  },
  {
    name: "constrained risk requires an explicit constraint",
    run: () => expectBlocker({
      ...longRequest,
      risk: { ...longRequest.risk, status: PersonalDecisionRiskStatus.Constrained },
    }, PersonalDecisionBlockerCode.ConstrainedRiskMissingConstraint),
  },
  {
    name: "poor reward-to-risk produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      tradePlan: {
        ...longRequest.tradePlan,
        targets: [{ atomicValue: "14500", scale: 2 }],
      },
    }, PersonalDecisionBlockerCode.RewardToRiskBelowThreshold),
  },
  {
    name: "stop on the wrong side produces NO_TRADE",
    run: () => expectBlocker({
      ...longRequest,
      tradePlan: {
        ...longRequest.tradePlan,
        stop: { atomicValue: "14200", scale: 2 },
      },
    }, PersonalDecisionBlockerCode.InvalidDirectionalPlan),
  },
  {
    name: "undeclared order field fails closed",
    run: () => {
      const injected = {
        ...structuredClone(longRequest),
        order: { type: "MARKET", quantity: 100 },
      };
      expectValidationIssue(
        () => createPersonalDecisionCard(injected),
        PersonalDecisionValidationIssueCode.UndeclaredField,
      );
    },
  },
  {
    name: "nested leverage field fails closed",
    run: () => {
      const injected = structuredClone(longRequest) as unknown as {
        risk: Record<string, unknown>;
      };
      injected.risk.leverageRatio = 3;
      expectValidationIssue(
        () => createPersonalDecisionCard(injected),
        PersonalDecisionValidationIssueCode.UndeclaredField,
      );
    },
  },
  {
    name: "future evidence fails closed",
    run: () => {
      expectValidationIssue(
        () => createPersonalDecisionCard({
          ...longRequest,
          evidence: { ...longRequest.evidence, evaluatedAt: "2026-07-24T14:36:00.000Z" },
        }),
        PersonalDecisionValidationIssueCode.InvalidTimestamp,
      );
    },
  },
  {
    name: "future market observation fails closed",
    run: () => {
      expectValidationIssue(
        () => createPersonalDecisionCard({
          ...longRequest,
          market: { ...longRequest.market, observedAt: "2026-07-24T14:36:00.000Z" },
        }),
        PersonalDecisionValidationIssueCode.InvalidTimestamp,
      );
    },
  },
  {
    name: "identical inputs create identical immutable cards",
    run: () => {
      const first = createPersonalDecisionCard(longRequest);
      const second = createPersonalDecisionCard(longRequest);
      assertDeepEqual(first, second, "Cards must be deterministic.");
    },
  },
];

let passed = 0;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${test.name}: ${message}`);
    throw error;
  }
}

console.log(`Personal Decision Engine: ${String(passed)}/${String(tests.length)} tests passed.`);
