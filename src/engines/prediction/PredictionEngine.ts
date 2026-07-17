import {
  ConfidenceLevel,
  PredictionDirection,
  PredictionStatus,
  PredictionSubjectType,
} from "../../contracts";

export interface PredictionEngineInput {
  readonly subject: string;
  readonly subjectType: PredictionSubjectType;
  readonly expectedDirection: PredictionDirection;
  readonly expectedMagnitude: string;
  readonly expectedDuration: string;
  readonly directionalEvidence: ReadonlyArray<string>;
  readonly opportunityScore: number;
  readonly opportunityConfidence: ConfidenceLevel;
  readonly evidenceQuality: number;
  readonly unknownsControl: number;
  readonly marketAlignment: number;
  readonly scenarioBalance: number;
  readonly timingRelevance: number;
  readonly thesisClarity: number;
  readonly catalystQuality: number;
  readonly riskContext: number;
}

export interface PredictionEngineScenario {
  readonly summary: string;
  readonly expectedMove: string;
  readonly expectedDuration: string;
  readonly failureConditions: ReadonlyArray<string>;
}

export interface PredictionEngineResult {
  readonly expectedDirection: PredictionDirection;
  readonly expectedMagnitude: string;
  readonly expectedDuration: string;
  readonly directionalEvidence: ReadonlyArray<string>;
  readonly predictionConfidence: ConfidenceLevel;
  readonly bullScenario: PredictionEngineScenario;
  readonly baseScenario: PredictionEngineScenario;
  readonly bearScenario: PredictionEngineScenario;
  readonly invalidationConditions: ReadonlyArray<string>;
  readonly activationBlockers: ReadonlyArray<string>;
  readonly predictionReason: string;
  readonly predictionState: PredictionStatus;
}

const NORMALIZED_INPUT_NAMES = [
  "opportunityScore",
  "evidenceQuality",
  "unknownsControl",
  "marketAlignment",
  "scenarioBalance",
  "timingRelevance",
  "thesisClarity",
  "catalystQuality",
  "riskContext",
] as const;

type NormalizedInputName = (typeof NORMALIZED_INPUT_NAMES)[number];

const REQUIRED_CONDITION_MINIMUM = 40;
const HIGH_CONFIDENCE_MINIMUM = 75;
const MEDIUM_CONFIDENCE_MINIMUM = 55;

const CONFIDENCE_RANK: Readonly<Record<ConfidenceLevel, number>> = {
  [ConfidenceLevel.Low]: 1,
  [ConfidenceLevel.Medium]: 2,
  [ConfidenceLevel.High]: 3,
};

function validateNormalizedValue(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(
      `Invalid ${name}: expected a finite number from 0 to 100; received ${String(value)}.`,
    );
  }
}

interface ValidatedForecast {
  readonly subject: string;
  readonly expectedMagnitude: string;
  readonly expectedDuration: string;
  readonly directionalEvidence: ReadonlyArray<string>;
}

function validateInput(input: PredictionEngineInput): ValidatedForecast {
  if (typeof input.subject !== "string" || input.subject.trim().length === 0) {
    throw new Error("Invalid subject: expected a non-empty string.");
  }

  if (
    !Object.values(PredictionSubjectType).some(
      (subjectType) => subjectType === input.subjectType,
    )
  ) {
    throw new Error(
      `Invalid subjectType: received ${String(input.subjectType)}.`,
    );
  }

  if (
    !Object.values(ConfidenceLevel).some(
      (confidence) => confidence === input.opportunityConfidence,
    )
  ) {
    throw new Error(
      `Invalid opportunityConfidence: received ${String(input.opportunityConfidence)}.`,
    );
  }

  if (
    !Object.values(PredictionDirection).some(
      (direction) => direction === input.expectedDirection,
    )
  ) {
    throw new Error(
      `Invalid expectedDirection: received ${String(input.expectedDirection)}.`,
    );
  }

  if (
    typeof input.expectedMagnitude !== "string" ||
    input.expectedMagnitude.trim().length === 0
  ) {
    throw new Error("Invalid expectedMagnitude: expected a non-empty string.");
  }

  if (
    typeof input.expectedDuration !== "string" ||
    input.expectedDuration.trim().length === 0
  ) {
    throw new Error("Invalid expectedDuration: expected a non-empty string.");
  }

  if (!Array.isArray(input.directionalEvidence)) {
    throw new Error(
      "Invalid directionalEvidence: expected at least one non-empty item.",
    );
  }

  const directionalEvidence = input.directionalEvidence
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (directionalEvidence.length === 0) {
    throw new Error(
      "Invalid directionalEvidence: expected at least one non-empty item.",
    );
  }

  for (const name of NORMALIZED_INPUT_NAMES) {
    validateNormalizedValue(name, input[name]);
  }

  return {
    subject: input.subject.trim(),
    expectedMagnitude: input.expectedMagnitude.trim(),
    expectedDuration: input.expectedDuration.trim(),
    directionalEvidence,
  };
}

function derivePredictionConfidence(
  input: PredictionEngineInput,
): ConfidenceLevel {
  const confidenceFactors = [
    input.evidenceQuality,
    input.unknownsControl,
    input.scenarioBalance,
  ];

  if (
    input.opportunityConfidence === ConfidenceLevel.High &&
    confidenceFactors.every((value) => value >= HIGH_CONFIDENCE_MINIMUM)
  ) {
    return ConfidenceLevel.High;
  }

  if (
    input.opportunityConfidence !== ConfidenceLevel.Low &&
    confidenceFactors.every((value) => value >= MEDIUM_CONFIDENCE_MINIMUM)
  ) {
    return ConfidenceLevel.Medium;
  }

  return ConfidenceLevel.Low;
}

function validateConfidenceConsistency(
  predictionConfidence: ConfidenceLevel,
  opportunityConfidence: ConfidenceLevel,
): void {
  if (
    CONFIDENCE_RANK[predictionConfidence] >
    CONFIDENCE_RANK[opportunityConfidence]
  ) {
    throw new Error(
      "Invalid prediction confidence: it cannot exceed opportunity confidence.",
    );
  }
}

function createScenarios(
  subject: string,
  expectedDirection: PredictionDirection,
  expectedMagnitude: string,
  expectedDuration: string,
): readonly [
  PredictionEngineScenario,
  PredictionEngineScenario,
  PredictionEngineScenario,
] {
  return [
    {
      summary: `${subject} follows an UP or stronger-market Bull alternative.`,
      expectedMove: "UP / stronger-market alternative",
      expectedDuration,
      failureConditions: [
        "The subject does not sustain the UP or stronger-market alternative.",
        "A DOWN or weaker-market outcome replaces the Bull scenario.",
      ],
    },
    {
      summary: `${subject} follows the research-supplied ${expectedDirection} base forecast.`,
      expectedMove: `${expectedDirection} with research-supplied magnitude: ${expectedMagnitude}`,
      expectedDuration,
      failureConditions: [
        "The subject no longer follows the research-supplied base forecast.",
      ],
    },
    {
      summary: `${subject} follows a DOWN or weaker-market Bear alternative.`,
      expectedMove: "DOWN / weaker-market alternative",
      expectedDuration,
      failureConditions: [
        "The subject does not sustain the DOWN or weaker-market alternative.",
        "An UP or stronger-market outcome replaces the Bear scenario.",
      ],
    },
  ];
}

function validateScenario(
  name: string,
  scenario: PredictionEngineScenario,
): void {
  if (
    scenario.summary.trim().length === 0 ||
    scenario.expectedMove.trim().length === 0 ||
    scenario.expectedDuration.trim().length === 0 ||
    scenario.failureConditions.length === 0 ||
    scenario.failureConditions.some((condition) => condition.trim().length === 0)
  ) {
    throw new Error(`Invalid ${name} scenario: all fields must be complete.`);
  }
}

function createInvalidationConditions(
  subject: string,
): ReadonlyArray<string> {
  return [
    `${subject} opportunity score falls below ${String(REQUIRED_CONDITION_MINIMUM)}.`,
    `Evidence quality falls below ${String(REQUIRED_CONDITION_MINIMUM)}.`,
    `Unknowns control falls below ${String(REQUIRED_CONDITION_MINIMUM)}.`,
    `Scenario balance falls below ${String(REQUIRED_CONDITION_MINIMUM)}.`,
    `Risk context falls below ${String(REQUIRED_CONDITION_MINIMUM)}.`,
  ];
}

function validateInvalidationConditions(
  conditions: ReadonlyArray<string>,
): void {
  if (
    conditions.length === 0 ||
    conditions.some((condition) => condition.trim().length === 0) ||
    new Set(conditions).size !== conditions.length
  ) {
    throw new Error(
      "Invalid invalidation conditions: conditions must be complete and unique.",
    );
  }
}

function createActivationBlockers(
  input: PredictionEngineInput,
): ReadonlyArray<NormalizedInputName> {
  const requiredConditions: ReadonlyArray<NormalizedInputName> = [
    "opportunityScore",
    "evidenceQuality",
    "unknownsControl",
    "scenarioBalance",
    "riskContext",
  ];

  return requiredConditions.filter(
    (name) => input[name] < REQUIRED_CONDITION_MINIMUM,
  );
}

function createPredictionReason(
  subject: string,
  confidence: ConfidenceLevel,
  expectedDirection: PredictionDirection,
  activationBlockers: ReadonlyArray<string>,
): string {
  if (activationBlockers.length > 0) {
    return `${subject} prediction remains draft because activation is blocked by: ${activationBlockers.join(
      ", ",
    )}.`;
  }

  return `${subject} prediction is active with research-supplied direction ${expectedDirection} and ${confidence.toLowerCase()} confidence. Direction comes from the research-supplied directional forecast, not quality scoring.`;
}

export function evaluatePrediction(
  input: PredictionEngineInput,
): PredictionEngineResult {
  const validatedForecast = validateInput(input);
  const predictionConfidence = derivePredictionConfidence(input);
  validateConfidenceConsistency(
    predictionConfidence,
    input.opportunityConfidence,
  );

  const [bullScenario, baseScenario, bearScenario] = createScenarios(
    validatedForecast.subject,
    input.expectedDirection,
    validatedForecast.expectedMagnitude,
    validatedForecast.expectedDuration,
  );
  validateScenario("bull", bullScenario);
  validateScenario("base", baseScenario);
  validateScenario("bear", bearScenario);

  const invalidationConditions = createInvalidationConditions(
    validatedForecast.subject,
  );
  validateInvalidationConditions(invalidationConditions);

  const activationBlockers = createActivationBlockers(input);
  const predictionState =
    activationBlockers.length === 0
      ? PredictionStatus.Active
      : PredictionStatus.Draft;

  return {
    expectedDirection: input.expectedDirection,
    expectedMagnitude: validatedForecast.expectedMagnitude,
    expectedDuration: validatedForecast.expectedDuration,
    directionalEvidence: validatedForecast.directionalEvidence,
    predictionConfidence,
    bullScenario,
    baseScenario,
    bearScenario,
    invalidationConditions,
    activationBlockers,
    predictionReason: createPredictionReason(
      validatedForecast.subject,
      predictionConfidence,
      input.expectedDirection,
      activationBlockers,
    ),
    predictionState,
  };
}
