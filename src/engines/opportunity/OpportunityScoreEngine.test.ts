import {
  ConfidenceLevel,
  OpportunityDecision,
  OpportunityState,
} from "../../contracts";
import {
  DEFAULT_OPPORTUNITY_SCORING_POLICY,
  evaluateOpportunity,
  type OpportunityEvaluationInput,
  type OpportunityScoringPolicy,
} from "./OpportunityScoreEngine";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message);
  }
}

function expectError(action: () => void, expectedMessage: string): void {
  try {
    action();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    assertTrue(
      message.includes(expectedMessage),
      `Expected error containing "${expectedMessage}", received "${message}".`,
    );
    return;
  }

  throw new Error(`Expected error containing "${expectedMessage}".`);
}

const strongOpportunity: OpportunityEvaluationInput = {
  evidenceQuality: 90,
  thesisClarity: 88,
  timingRelevance: 82,
  marketAlignment: 78,
  sectorAlignment: 80,
  relativeStrength: 84,
  catalystQuality: 75,
  riskContext: 92,
  scenarioBalance: 85,
  unknownsControl: 86,
  requiredEvidencePresent: true,
  dataFresh: true,
  riskBlocked: false,
};

const watchOpportunity: OpportunityEvaluationInput = {
  evidenceQuality: 65,
  thesisClarity: 65,
  timingRelevance: 62,
  marketAlignment: 60,
  sectorAlignment: 60,
  relativeStrength: 65,
  catalystQuality: 60,
  riskContext: 70,
  scenarioBalance: 65,
  unknownsControl: 60,
  requiredEvidencePresent: true,
  dataFresh: true,
  riskBlocked: false,
};

const weakOpportunity: OpportunityEvaluationInput = {
  evidenceQuality: 30,
  thesisClarity: 35,
  timingRelevance: 30,
  marketAlignment: 25,
  sectorAlignment: 25,
  relativeStrength: 30,
  catalystQuality: 20,
  riskContext: 35,
  scenarioBalance: 30,
  unknownsControl: 25,
  requiredEvidencePresent: true,
  dataFresh: true,
  riskBlocked: false,
};

function createUniformOpportunity(value: number): OpportunityEvaluationInput {
  return {
    evidenceQuality: value,
    thesisClarity: value,
    timingRelevance: value,
    marketAlignment: value,
    sectorAlignment: value,
    relativeStrength: value,
    catalystQuality: value,
    riskContext: value,
    scenarioBalance: value,
    unknownsControl: value,
    requiredEvidencePresent: true,
    dataFresh: true,
    riskBlocked: false,
  };
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "strong opportunity advances to prediction",
    run: () => {
      const result = evaluateOpportunity(strongOpportunity);
      assertEqual(result.state, OpportunityState.Actionable, "state");
      assertEqual(
        result.decision,
        OpportunityDecision.AdvanceToPrediction,
        "decision",
      );
      assertEqual(result.confidence, ConfidenceLevel.High, "confidence");
      assertTrue(result.score >= 75, "score must meet the actionable threshold");
      assertEqual(result.blockingReasons.length, 0, "blocking reason count");
    },
  },
  {
    name: "risk block overrides strong score",
    run: () => {
      const result = evaluateOpportunity({
        ...strongOpportunity,
        riskBlocked: true,
      });
      assertEqual(result.decision, OpportunityDecision.Cash, "decision");
      assertTrue(
        result.state !== OpportunityState.Actionable,
        "risk-blocked state must not be actionable",
      );
      assertTrue(result.score >= 75, "raw score should remain high");
      assertTrue(result.blockingReasons.length > 0, "risk block must be explained");
    },
  },
  {
    name: "missing evidence returns wait",
    run: () => {
      const result = evaluateOpportunity({
        ...strongOpportunity,
        requiredEvidencePresent: false,
      });
      assertEqual(result.state, OpportunityState.Wait, "state");
      assertEqual(result.decision, OpportunityDecision.Wait, "decision");
      assertEqual(result.confidence, ConfidenceLevel.Low, "confidence");
      assertTrue(
        result.blockingReasons.some((reason) => reason.includes("evidence")),
        "missing evidence must be explained",
      );
    },
  },
  {
    name: "stale data returns wait",
    run: () => {
      const result = evaluateOpportunity({
        ...strongOpportunity,
        dataFresh: false,
      });
      assertEqual(result.state, OpportunityState.Wait, "state");
      assertEqual(result.decision, OpportunityDecision.Wait, "decision");
      assertTrue(
        result.blockingReasons.some((reason) => reason.includes("stale")),
        "stale data must be explained",
      );
    },
  },
  {
    name: "moderate opportunity returns watch",
    run: () => {
      const result = evaluateOpportunity(watchOpportunity);
      assertEqual(result.state, OpportunityState.Watch, "state");
      assertEqual(result.decision, OpportunityDecision.Watch, "decision");
      assertTrue(result.score >= 60 && result.score < 75, "watch score range");
    },
  },
  {
    name: "weak opportunity is rejected",
    run: () => {
      const result = evaluateOpportunity(weakOpportunity);
      assertEqual(result.state, OpportunityState.Rejected, "state");
      assertEqual(result.decision, OpportunityDecision.Reject, "decision");
      assertTrue(result.score < 40, "weak score must be below 40");
    },
  },
  {
    name: "score uses unrounded weighted factors",
    run: () => {
      const result = evaluateOpportunity(createUniformOpportunity(1 / 3));
      assertEqual(result.score, 0.33, "score");
    },
  },
  {
    name: "score-driven wait applies when all gates pass",
    run: () => {
      const result = evaluateOpportunity(createUniformOpportunity(50));
      assertEqual(result.score, 50, "score");
      assertEqual(result.state, OpportunityState.Wait, "state");
      assertEqual(result.decision, OpportunityDecision.Wait, "decision");
      assertEqual(result.blockingReasons.length, 0, "blocking reason count");
    },
  },
  {
    name: "actionable threshold is inclusive",
    run: () => {
      const result = evaluateOpportunity(createUniformOpportunity(75));
      assertEqual(result.score, 75, "score");
      assertEqual(result.state, OpportunityState.Actionable, "state");
      assertEqual(
        result.decision,
        OpportunityDecision.AdvanceToPrediction,
        "decision",
      );
    },
  },
  {
    name: "watch threshold is inclusive",
    run: () => {
      const result = evaluateOpportunity(createUniformOpportunity(60));
      assertEqual(result.score, 60, "score");
      assertEqual(result.state, OpportunityState.Watch, "state");
      assertEqual(result.decision, OpportunityDecision.Watch, "decision");
    },
  },
  {
    name: "wait threshold is inclusive",
    run: () => {
      const result = evaluateOpportunity(createUniformOpportunity(40));
      assertEqual(result.score, 40, "score");
      assertEqual(result.state, OpportunityState.Wait, "state");
      assertEqual(result.decision, OpportunityDecision.Wait, "decision");
    },
  },
  {
    name: "invalid factor throws",
    run: () => {
      expectError(
        () =>
          evaluateOpportunity({
            ...strongOpportunity,
            evidenceQuality: 101,
          }),
        "expected a finite number from 0 to 100",
      );
    },
  },
  {
    name: "invalid policy weight total throws",
    run: () => {
      const invalidPolicy: OpportunityScoringPolicy = {
        ...DEFAULT_OPPORTUNITY_SCORING_POLICY,
        weights: {
          ...DEFAULT_OPPORTUNITY_SCORING_POLICY.weights,
          evidenceQuality: 19,
        },
      };
      expectError(
        () => evaluateOpportunity(strongOpportunity, invalidPolicy),
        "weights must sum to 100",
      );
    },
  },
  {
    name: "invalid policy threshold ordering throws",
    run: () => {
      const invalidPolicy: OpportunityScoringPolicy = {
        ...DEFAULT_OPPORTUNITY_SCORING_POLICY,
        decisionThresholds: {
          actionableMinimum: 60,
          watchMinimum: 60,
          waitMinimum: 40,
        },
      };
      expectError(
        () => evaluateOpportunity(strongOpportunity, invalidPolicy),
        "actionableMinimum > watchMinimum > waitMinimum",
      );
    },
  },
  {
    name: "identical inputs produce identical outputs",
    run: () => {
      const first = evaluateOpportunity(strongOpportunity);
      const second = evaluateOpportunity(strongOpportunity);
      assertDeepEqual(first, second, "identical evaluations must match");
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

console.log(`Opportunity Score Engine: ${String(passed)}/${String(tests.length)} tests passed.`);
