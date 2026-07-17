import {
  ConfidenceLevel,
  OpportunityDecision,
  OpportunityState,
} from "../../contracts";

export const OPPORTUNITY_FACTOR_NAMES = [
  "evidenceQuality",
  "thesisClarity",
  "timingRelevance",
  "marketAlignment",
  "sectorAlignment",
  "relativeStrength",
  "catalystQuality",
  "riskContext",
  "scenarioBalance",
  "unknownsControl",
] as const;

export type OpportunityFactorName =
  (typeof OPPORTUNITY_FACTOR_NAMES)[number];

export interface OpportunityEvaluationInput {
  readonly evidenceQuality: number;
  readonly thesisClarity: number;
  readonly timingRelevance: number;
  readonly marketAlignment: number;
  readonly sectorAlignment: number;
  readonly relativeStrength: number;
  readonly catalystQuality: number;
  readonly riskContext: number;
  readonly scenarioBalance: number;
  readonly unknownsControl: number;
  readonly requiredEvidencePresent: boolean;
  readonly dataFresh: boolean;
  readonly riskBlocked: boolean;
}

export type OpportunityFactorWeights = Readonly<
  Record<OpportunityFactorName, number>
>;

export interface OpportunityDecisionThresholds {
  readonly actionableMinimum: number;
  readonly watchMinimum: number;
  readonly waitMinimum: number;
}

export interface OpportunityConfidenceThresholds {
  readonly highEvidenceMinimum: number;
  readonly highUnknownsControlMinimum: number;
  readonly highFactorSpreadMaximum: number;
  readonly mediumEvidenceMinimum: number;
  readonly mediumUnknownsControlMinimum: number;
  readonly mediumFactorSpreadMaximum: number;
}

export interface OpportunityFactorClassificationThresholds {
  readonly positiveMinimum: number;
  readonly limitingMaximum: number;
}

export interface OpportunityScoringPolicy {
  readonly version: string;
  readonly weights: OpportunityFactorWeights;
  readonly decisionThresholds: OpportunityDecisionThresholds;
  readonly confidenceThresholds: OpportunityConfidenceThresholds;
  readonly factorClassificationThresholds: OpportunityFactorClassificationThresholds;
}

export interface OpportunityFactorContribution {
  readonly factor: OpportunityFactorName;
  readonly value: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface OpportunityScoreResult {
  readonly score: number;
  readonly state: OpportunityState;
  readonly decision: OpportunityDecision;
  readonly confidence: ConfidenceLevel;
  readonly contributions: ReadonlyArray<OpportunityFactorContribution>;
  readonly positiveFactors: ReadonlyArray<OpportunityFactorContribution>;
  readonly limitingFactors: ReadonlyArray<OpportunityFactorContribution>;
  readonly blockingReasons: ReadonlyArray<string>;
  readonly decisionReason: string;
  readonly policyVersion: string;
}

export const DEFAULT_OPPORTUNITY_SCORING_POLICY = {
  version: "1.0",
  weights: {
    evidenceQuality: 18,
    thesisClarity: 12,
    timingRelevance: 8,
    marketAlignment: 7,
    sectorAlignment: 7,
    relativeStrength: 6,
    catalystQuality: 6,
    riskContext: 16,
    scenarioBalance: 10,
    unknownsControl: 10,
  },
  decisionThresholds: {
    actionableMinimum: 75,
    watchMinimum: 60,
    waitMinimum: 40,
  },
  confidenceThresholds: {
    highEvidenceMinimum: 80,
    highUnknownsControlMinimum: 75,
    highFactorSpreadMaximum: 20,
    mediumEvidenceMinimum: 60,
    mediumUnknownsControlMinimum: 50,
    mediumFactorSpreadMaximum: 35,
  },
  factorClassificationThresholds: {
    positiveMinimum: 70,
    limitingMaximum: 50,
  },
} as const satisfies OpportunityScoringPolicy;

const REQUIRED_WEIGHT_TOTAL = 100;
const ROUNDING_DECIMAL_PLACES = 2;
const HIGHLIGHT_FACTOR_COUNT = 3;
const WEIGHT_TOTAL_TOLERANCE = 0.000000001;

function roundTo(value: number, decimalPlaces: number): number {
  const multiplier = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function validateNormalizedValue(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `Invalid ${name}: expected a finite number from 0 to 100; received ${String(value)}.`,
    );
  }
}

function validateGate(name: string, value: boolean): void {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid ${name}: expected a boolean value.`);
  }
}

function validateInput(input: OpportunityEvaluationInput): void {
  for (const factor of OPPORTUNITY_FACTOR_NAMES) {
    validateNormalizedValue(`opportunity factor "${factor}"`, input[factor]);
  }

  validateGate("requiredEvidencePresent", input.requiredEvidencePresent);
  validateGate("dataFresh", input.dataFresh);
  validateGate("riskBlocked", input.riskBlocked);
}

function validatePolicy(policy: OpportunityScoringPolicy): void {
  if (policy.version.trim().length === 0) {
    throw new Error("Invalid scoring policy: version must not be empty.");
  }

  let weightTotal = 0;
  for (const factor of OPPORTUNITY_FACTOR_NAMES) {
    const weight = policy.weights[factor];
    validateNormalizedValue(`policy weight "${factor}"`, weight);
    weightTotal += weight;
  }

  if (Math.abs(weightTotal - REQUIRED_WEIGHT_TOTAL) > WEIGHT_TOTAL_TOLERANCE) {
    throw new Error(
      `Invalid scoring policy: weights must sum to 100; received ${String(weightTotal)}.`,
    );
  }

  const { actionableMinimum, watchMinimum, waitMinimum } =
    policy.decisionThresholds;
  validateNormalizedValue("actionableMinimum threshold", actionableMinimum);
  validateNormalizedValue("watchMinimum threshold", watchMinimum);
  validateNormalizedValue("waitMinimum threshold", waitMinimum);

  if (!(actionableMinimum > watchMinimum && watchMinimum > waitMinimum)) {
    throw new Error(
      "Invalid scoring policy: decision thresholds must satisfy actionableMinimum > watchMinimum > waitMinimum.",
    );
  }

  const confidence = policy.confidenceThresholds;
  validateNormalizedValue(
    "highEvidenceMinimum confidence threshold",
    confidence.highEvidenceMinimum,
  );
  validateNormalizedValue(
    "highUnknownsControlMinimum confidence threshold",
    confidence.highUnknownsControlMinimum,
  );
  validateNormalizedValue(
    "highFactorSpreadMaximum confidence threshold",
    confidence.highFactorSpreadMaximum,
  );
  validateNormalizedValue(
    "mediumEvidenceMinimum confidence threshold",
    confidence.mediumEvidenceMinimum,
  );
  validateNormalizedValue(
    "mediumUnknownsControlMinimum confidence threshold",
    confidence.mediumUnknownsControlMinimum,
  );
  validateNormalizedValue(
    "mediumFactorSpreadMaximum confidence threshold",
    confidence.mediumFactorSpreadMaximum,
  );

  if (
    confidence.highEvidenceMinimum < confidence.mediumEvidenceMinimum ||
    confidence.highUnknownsControlMinimum <
      confidence.mediumUnknownsControlMinimum ||
    confidence.highFactorSpreadMaximum > confidence.mediumFactorSpreadMaximum
  ) {
    throw new Error(
      "Invalid scoring policy: high confidence requirements must be at least as strict as medium confidence requirements.",
    );
  }

  const classification = policy.factorClassificationThresholds;
  validateNormalizedValue(
    "positiveMinimum factor threshold",
    classification.positiveMinimum,
  );
  validateNormalizedValue(
    "limitingMaximum factor threshold",
    classification.limitingMaximum,
  );

  if (classification.positiveMinimum <= classification.limitingMaximum) {
    throw new Error(
      "Invalid scoring policy: positiveMinimum must be greater than limitingMaximum.",
    );
  }
}

function createContributions(
  input: OpportunityEvaluationInput,
  weights: OpportunityFactorWeights,
): ReadonlyArray<OpportunityFactorContribution> {
  return OPPORTUNITY_FACTOR_NAMES.map((factor) => ({
    factor,
    value: input[factor],
    weight: weights[factor],
    contribution: roundTo(
      (input[factor] * weights[factor]) / REQUIRED_WEIGHT_TOTAL,
      ROUNDING_DECIMAL_PLACES,
    ),
  }));
}

function factorOrder(factor: OpportunityFactorName): number {
  return OPPORTUNITY_FACTOR_NAMES.indexOf(factor);
}

function selectPositiveFactors(
  contributions: ReadonlyArray<OpportunityFactorContribution>,
  minimum: number,
): ReadonlyArray<OpportunityFactorContribution> {
  return contributions
    .filter(({ value }) => value >= minimum)
    .slice()
    .sort(
      (left, right) =>
        right.contribution - left.contribution ||
        factorOrder(left.factor) - factorOrder(right.factor),
    )
    .slice(0, HIGHLIGHT_FACTOR_COUNT);
}

function selectLimitingFactors(
  contributions: ReadonlyArray<OpportunityFactorContribution>,
  maximum: number,
): ReadonlyArray<OpportunityFactorContribution> {
  return contributions
    .filter(({ value }) => value <= maximum)
    .slice()
    .sort(
      (left, right) =>
        left.value - right.value ||
        factorOrder(left.factor) - factorOrder(right.factor),
    )
    .slice(0, HIGHLIGHT_FACTOR_COUNT);
}

function deriveConfidence(
  input: OpportunityEvaluationInput,
  policy: OpportunityScoringPolicy,
): ConfidenceLevel {
  if (!input.requiredEvidencePresent || !input.dataFresh) {
    return ConfidenceLevel.Low;
  }

  const factorValues = OPPORTUNITY_FACTOR_NAMES.map((factor) => input[factor]);
  const factorSpread = Math.max(...factorValues) - Math.min(...factorValues);
  const thresholds = policy.confidenceThresholds;

  if (
    input.evidenceQuality >= thresholds.highEvidenceMinimum &&
    input.unknownsControl >= thresholds.highUnknownsControlMinimum &&
    factorSpread <= thresholds.highFactorSpreadMaximum
  ) {
    return ConfidenceLevel.High;
  }

  if (
    input.evidenceQuality >= thresholds.mediumEvidenceMinimum &&
    input.unknownsControl >= thresholds.mediumUnknownsControlMinimum &&
    factorSpread <= thresholds.mediumFactorSpreadMaximum
  ) {
    return ConfidenceLevel.Medium;
  }

  return ConfidenceLevel.Low;
}

interface DecisionSelection {
  readonly state: OpportunityState;
  readonly decision: OpportunityDecision;
  readonly reason: string;
}

function selectDecision(
  input: OpportunityEvaluationInput,
  score: number,
  policy: OpportunityScoringPolicy,
): DecisionSelection {
  if (input.riskBlocked) {
    return {
      state: OpportunityState.Rejected,
      decision: OpportunityDecision.Cash,
      reason: "Risk controls block this opportunity; capital remains in Cash.",
    };
  }

  if (!input.requiredEvidencePresent) {
    return {
      state: OpportunityState.Wait,
      decision: OpportunityDecision.Wait,
      reason: "Required evidence is missing; the opportunity must wait.",
    };
  }

  if (!input.dataFresh) {
    return {
      state: OpportunityState.Wait,
      decision: OpportunityDecision.Wait,
      reason: "Input data is stale; the opportunity must wait for fresh data.",
    };
  }

  const { actionableMinimum, watchMinimum, waitMinimum } =
    policy.decisionThresholds;

  if (score >= actionableMinimum) {
    return {
      state: OpportunityState.Actionable,
      decision: OpportunityDecision.AdvanceToPrediction,
      reason: `Score ${String(score)} meets the actionable threshold ${String(actionableMinimum)}.`,
    };
  }

  if (score >= watchMinimum) {
    return {
      state: OpportunityState.Watch,
      decision: OpportunityDecision.Watch,
      reason: `Score ${String(score)} meets the watch threshold ${String(watchMinimum)} but not the actionable threshold.`,
    };
  }

  if (score >= waitMinimum) {
    return {
      state: OpportunityState.Wait,
      decision: OpportunityDecision.Wait,
      reason: `Score ${String(score)} is unresolved and remains below the watch threshold ${String(watchMinimum)}.`,
    };
  }

  return {
    state: OpportunityState.Rejected,
    decision: OpportunityDecision.Reject,
    reason: `Score ${String(score)} is below the minimum consideration threshold ${String(waitMinimum)}.`,
  };
}

function createBlockingReasons(
  input: OpportunityEvaluationInput,
): ReadonlyArray<string> {
  const reasons: string[] = [];

  if (input.riskBlocked) {
    reasons.push("Risk Engine output blocks the opportunity.");
  }
  if (!input.requiredEvidencePresent) {
    reasons.push("Required evidence is missing.");
  }
  if (!input.dataFresh) {
    reasons.push("Input data is stale.");
  }

  return reasons;
}

export function evaluateOpportunity(
  input: OpportunityEvaluationInput,
  policy: OpportunityScoringPolicy = DEFAULT_OPPORTUNITY_SCORING_POLICY,
): OpportunityScoreResult {
  validateInput(input);
  validatePolicy(policy);

  const contributions = createContributions(input, policy.weights);
  const score = roundTo(
    OPPORTUNITY_FACTOR_NAMES.reduce(
      (total, factor) =>
        total +
        (input[factor] * policy.weights[factor]) / REQUIRED_WEIGHT_TOTAL,
      0,
    ),
    ROUNDING_DECIMAL_PLACES,
  );
  const selection = selectDecision(input, score, policy);

  return {
    score,
    state: selection.state,
    decision: selection.decision,
    confidence: deriveConfidence(input, policy),
    contributions,
    positiveFactors: selectPositiveFactors(
      contributions,
      policy.factorClassificationThresholds.positiveMinimum,
    ),
    limitingFactors: selectLimitingFactors(
      contributions,
      policy.factorClassificationThresholds.limitingMaximum,
    ),
    blockingReasons: createBlockingReasons(input),
    decisionReason: selection.reason,
    policyVersion: policy.version,
  };
}
