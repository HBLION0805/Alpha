import {
  ConfidenceLevel,
  PredictionDirection,
  PredictionStatus,
  PredictionSubjectType,
} from "../../contracts";
import {
  evaluatePrediction,
  type PredictionEngineInput,
  type PredictionEngineResult,
  type PredictionEngineScenario,
} from "./PredictionEngine";

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

function createInput(
  value: number,
  opportunityConfidence: ConfidenceLevel,
  expectedDirection: PredictionDirection = PredictionDirection.Up,
): PredictionEngineInput {
  return {
    subject: "Synthetic Opportunity",
    subjectType: PredictionSubjectType.Market,
    expectedDirection,
    expectedMagnitude: "Research-supplied move range",
    expectedDuration: "Research-supplied duration",
    directionalEvidence: ["Synthetic directional evidence"],
    opportunityScore: value,
    opportunityConfidence,
    evidenceQuality: value,
    unknownsControl: value,
    marketAlignment: value,
    scenarioBalance: value,
    timingRelevance: value,
    thesisClarity: value,
    catalystQuality: value,
    riskContext: value,
  };
}

function assertScenarioComplete(
  scenario: PredictionEngineScenario,
  name: string,
): void {
  assertTrue(scenario.summary.length > 0, `${name} summary must be present`);
  assertTrue(
    scenario.expectedMove.length > 0,
    `${name} expected move must be present`,
  );
  assertTrue(
    scenario.expectedDuration.length > 0,
    `${name} expected duration must be present`,
  );
  assertTrue(
    scenario.failureConditions.length > 0,
    `${name} failure conditions must be present`,
  );
}

function assertStableScenarioDirections(
  result: PredictionEngineResult,
  expectedBaseDirection: PredictionDirection,
): void {
  assertEqual(
    result.bullScenario.expectedMove,
    "UP / stronger-market alternative",
    "bull direction semantics",
  );
  assertTrue(
    result.baseScenario.expectedMove.includes(expectedBaseDirection),
    "base scenario must identify the supplied direction",
  );
  assertEqual(
    result.bearScenario.expectedMove,
    "DOWN / weaker-market alternative",
    "bear direction semantics",
  );
}

const strongOpportunity = createInput(85, ConfidenceLevel.High);
const mediumOpportunity = createInput(60, ConfidenceLevel.Medium);
const weakOpportunity = createInput(30, ConfidenceLevel.Low);

const tests: ReadonlyArray<TestCase> = [
  {
    name: "strong opportunity creates active high-confidence prediction",
    run: () => {
      const result = evaluatePrediction(strongOpportunity);
      assertEqual(result.predictionState, PredictionStatus.Active, "state");
      assertEqual(
        result.predictionConfidence,
        ConfidenceLevel.High,
        "confidence",
      );
      assertEqual(
        result.expectedDirection,
        PredictionDirection.Up,
        "direction",
      );
      assertEqual(result.activationBlockers.length, 0, "activation blockers");
      assertTrue(
        result.predictionReason.includes(PredictionDirection.Up),
        "active reason must identify supplied direction",
      );
      assertTrue(
        result.predictionReason.includes("high confidence"),
        "active reason must identify prediction confidence",
      );
      assertTrue(
        result.predictionReason.includes("research-supplied directional forecast"),
        "active reason must identify the source of direction",
      );
      assertTrue(
        result.predictionReason.includes("not quality scoring"),
        "active reason must separate direction from quality scoring",
      );
    },
  },
  {
    name: "medium opportunity creates active medium-confidence prediction",
    run: () => {
      const result = evaluatePrediction({
        ...mediumOpportunity,
        expectedDirection: PredictionDirection.Down,
      });
      assertEqual(result.predictionState, PredictionStatus.Active, "state");
      assertEqual(
        result.predictionConfidence,
        ConfidenceLevel.Medium,
        "confidence",
      );
      assertEqual(
        result.expectedDirection,
        PredictionDirection.Down,
        "direction",
      );
    },
  },
  {
    name: "weak opportunity remains draft with activation blockers",
    run: () => {
      const result = evaluatePrediction(weakOpportunity);
      assertEqual(
        result.predictionState,
        PredictionStatus.Draft,
        "state",
      );
      assertEqual(
        result.predictionConfidence,
        ConfidenceLevel.Low,
        "confidence",
      );
      assertTrue(
        result.activationBlockers.length > 0,
        "draft must identify activation blockers",
      );
      assertTrue(
        result.predictionReason.includes("activation is blocked"),
        "draft reason must explain blocked activation",
      );
      assertTrue(
        !result.predictionReason.includes("invalidat"),
        "draft reason must not describe invalidation",
      );
    },
  },
  {
    name: "range-bound direction is preserved",
    run: () => {
      const result = evaluatePrediction(
        createInput(85, ConfidenceLevel.High, PredictionDirection.RangeBound),
      );
      assertEqual(
        result.expectedDirection,
        PredictionDirection.RangeBound,
        "direction",
      );
    },
  },
  {
    name: "quality factors do not override supplied direction",
    run: () => {
      const result = evaluatePrediction(
        createInput(30, ConfidenceLevel.Low, PredictionDirection.Down),
      );
      assertEqual(
        result.expectedDirection,
        PredictionDirection.Down,
        "direction",
      );
      assertEqual(result.predictionState, PredictionStatus.Draft, "state");
    },
  },
  {
    name: "normalized input above 100 is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            opportunityScore: 101,
          }),
        "expected a finite number from 0 to 100",
      );
    },
  },
  {
    name: "non-finite normalized input is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            evidenceQuality: Number.NaN,
          }),
        "expected a finite number from 0 to 100",
      );
    },
  },
  {
    name: "empty subject is rejected",
    run: () => {
      expectError(
        () => evaluatePrediction({ ...strongOpportunity, subject: "   " }),
        "expected a non-empty string",
      );
    },
  },
  {
    name: "unsupported subject type is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            subjectType: "INVALID" as PredictionSubjectType,
          }),
        "Invalid subjectType",
      );
    },
  },
  {
    name: "unsupported opportunity confidence is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            opportunityConfidence: "INVALID" as ConfidenceLevel,
          }),
        "Invalid opportunityConfidence",
      );
    },
  },
  {
    name: "invalid expected direction is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            expectedDirection: "INVALID" as PredictionDirection,
          }),
        "Invalid expectedDirection",
      );
    },
  },
  {
    name: "empty expected magnitude is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            expectedMagnitude: "   ",
          }),
        "Invalid expectedMagnitude",
      );
    },
  },
  {
    name: "empty expected duration is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            expectedDuration: "   ",
          }),
        "Invalid expectedDuration",
      );
    },
  },
  {
    name: "missing directional evidence is rejected",
    run: () => {
      expectError(
        () =>
          evaluatePrediction({
            ...strongOpportunity,
            directionalEvidence: [],
          }),
        "Invalid directionalEvidence",
      );
    },
  },
  {
    name: "high confidence threshold is inclusive",
    run: () => {
      const result = evaluatePrediction(createInput(75, ConfidenceLevel.High));
      assertEqual(
        result.predictionConfidence,
        ConfidenceLevel.High,
        "confidence",
      );
    },
  },
  {
    name: "medium confidence threshold is inclusive",
    run: () => {
      const result = evaluatePrediction(
        createInput(55, ConfidenceLevel.Medium),
      );
      assertEqual(
        result.predictionConfidence,
        ConfidenceLevel.Medium,
        "confidence",
      );
    },
  },
  {
    name: "prediction confidence cannot exceed opportunity confidence",
    run: () => {
      const result = evaluatePrediction(createInput(90, ConfidenceLevel.Medium));
      assertEqual(
        result.predictionConfidence,
        ConfidenceLevel.Medium,
        "confidence",
      );
    },
  },
  {
    name: "insufficient unknowns control lowers prediction confidence",
    run: () => {
      const result = evaluatePrediction({
        ...strongOpportunity,
        unknownsControl: 54,
      });
      assertEqual(
        result.predictionConfidence,
        ConfidenceLevel.Low,
        "confidence",
      );
    },
  },
  {
    name: "exactly three complete scenarios are generated",
    run: () => {
      const result = evaluatePrediction(strongOpportunity);
      const scenarios = [
        result.bullScenario,
        result.baseScenario,
        result.bearScenario,
      ];
      assertEqual(scenarios.length, 3, "scenario count");
      assertScenarioComplete(result.bullScenario, "bull");
      assertScenarioComplete(result.baseScenario, "base");
      assertScenarioComplete(result.bearScenario, "bear");
      assertTrue(
        scenarios.every((scenario) =>
          scenario.summary.includes(strongOpportunity.subject),
        ),
        "every scenario must identify the subject",
      );
    },
  },
  {
    name: "base scenario reflects the supplied forecast",
    run: () => {
      const result = evaluatePrediction(strongOpportunity);
      assertTrue(
        result.baseScenario.summary.includes(
          strongOpportunity.expectedDirection,
        ),
        "base summary must identify supplied direction",
      );
      assertTrue(
        result.baseScenario.expectedMove.includes(
          strongOpportunity.expectedMagnitude,
        ),
        "base expected move must identify supplied magnitude",
      );
      assertEqual(
        result.baseScenario.expectedDuration,
        strongOpportunity.expectedDuration,
        "base expected duration",
      );
      assertEqual(
        result.expectedMagnitude,
        strongOpportunity.expectedMagnitude,
        "result expected magnitude",
      );
      assertEqual(
        result.expectedDuration,
        strongOpportunity.expectedDuration,
        "result expected duration",
      );
      assertDeepEqual(
        result.directionalEvidence,
        strongOpportunity.directionalEvidence,
        "result directional evidence",
      );
    },
  },
  {
    name: "up base preserves stable bull and bear meanings",
    run: () => {
      const result = evaluatePrediction(
        createInput(85, ConfidenceLevel.High, PredictionDirection.Up),
      );
      assertStableScenarioDirections(result, PredictionDirection.Up);
    },
  },
  {
    name: "down base preserves stable bull and bear meanings",
    run: () => {
      const result = evaluatePrediction(
        createInput(85, ConfidenceLevel.High, PredictionDirection.Down),
      );
      assertStableScenarioDirections(result, PredictionDirection.Down);
    },
  },
  {
    name: "range-bound and neutral bases preserve stable scenario meanings",
    run: () => {
      for (const direction of [
        PredictionDirection.RangeBound,
        PredictionDirection.Neutral,
      ]) {
        const result = evaluatePrediction(
          createInput(85, ConfidenceLevel.High, direction),
        );
        assertStableScenarioDirections(result, direction);
      }
    },
  },
  {
    name: "scenario direction semantics do not reverse with base direction",
    run: () => {
      const upResult = evaluatePrediction(
        createInput(85, ConfidenceLevel.High, PredictionDirection.Up),
      );
      const downResult = evaluatePrediction(
        createInput(85, ConfidenceLevel.High, PredictionDirection.Down),
      );
      assertEqual(
        upResult.bullScenario.expectedMove,
        downResult.bullScenario.expectedMove,
        "bull semantics",
      );
      assertEqual(
        upResult.bearScenario.expectedMove,
        downResult.bearScenario.expectedMove,
        "bear semantics",
      );
    },
  },
  {
    name: "invalidation conditions are complete and unique",
    run: () => {
      const result = evaluatePrediction(strongOpportunity);
      assertEqual(result.invalidationConditions.length, 5, "condition count");
      assertEqual(
        new Set(result.invalidationConditions).size,
        result.invalidationConditions.length,
        "unique condition count",
      );
      assertTrue(
        result.invalidationConditions.every((condition) => condition.length > 0),
        "every invalidation condition must be complete",
      );
    },
  },
  {
    name: "failed risk condition blocks activation",
    run: () => {
      const result = evaluatePrediction({
        ...strongOpportunity,
        riskContext: 39,
      });
      assertEqual(
        result.predictionState,
        PredictionStatus.Draft,
        "state",
      );
      assertTrue(
        result.activationBlockers.includes("riskContext"),
        "blockers must identify the failed risk condition",
      );
    },
  },
  {
    name: "identical inputs produce identical outputs",
    run: () => {
      const first = evaluatePrediction(strongOpportunity);
      const second = evaluatePrediction(strongOpportunity);
      assertDeepEqual(first, second, "identical predictions must match");
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

console.log(
  `Prediction Engine: ${String(passed)}/${String(tests.length)} tests passed.`,
);
