import {
  DEFAULT_PREDICTION_LIFECYCLE,
  PredictionAccuracy,
  PredictionCategory,
  PredictionDirection,
  PredictionErrorCode,
  PredictionProfitability,
  PredictionReviewResult,
  PredictionReviewStatus,
  PredictionStatus,
  PredictionSubjectType,
  type Prediction,
  type PredictionError,
  type PredictionHistory,
  type PredictionOutcome,
  type PredictionReview,
  type PredictionReviewStart,
  type PredictionSnapshot,
  type PredictionValidation,
} from "./PredictionRecord";
import { ConfidenceLevel } from "./ResearchRecord";
import { ReasoningLevel } from "./AIRouter";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function canonical(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function createPredictionId(snapshot: PredictionSnapshot): string {
  const identitySnapshot: PredictionSnapshot = {
    createdAt: snapshot.createdAt,
    predictionType: snapshot.predictionType,
    market: snapshot.market,
    ...(snapshot.ticker === undefined ? {} : { ticker: snapshot.ticker }),
    ...(snapshot.asset === undefined ? {} : { asset: snapshot.asset }),
    category: snapshot.category,
    statement: snapshot.statement,
    expectedDirection: snapshot.expectedDirection,
    confidence: snapshot.confidence,
    expectedTimeHorizon: snapshot.expectedTimeHorizon,
    expectedCatalyst: snapshot.expectedCatalyst,
    evidence: snapshot.evidence,
    version: snapshot.version,
    strategy: snapshot.strategy,
    decisionSnapshot: snapshot.decisionSnapshot,
    owner: snapshot.owner,
    aiVersion: snapshot.aiVersion,
    reviewRequired: snapshot.reviewRequired,
  };
  return `prediction:${fnv1a64(canonical(identitySnapshot))}`;
}

function error(
  errors: PredictionError[],
  code: PredictionErrorCode,
  message: string,
  field?: string,
): void {
  errors.push(field === undefined ? { code, message } : { code, message, field });
}

function nonEmpty(
  errors: PredictionError[],
  field: string,
  value: string,
): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    error(errors, PredictionErrorCode.InvalidPrediction, `${field} must be non-empty.`, field);
  }
}

function identifier(
  errors: PredictionError[],
  field: string,
  value: string,
): void {
  nonEmpty(errors, field, value);
  if (typeof value === "string" && !ID_PATTERN.test(value)) {
    error(errors, PredictionErrorCode.InvalidPrediction, `${field} has unsupported characters.`, field);
  }
}

function timestamp(
  errors: PredictionError[],
  field: string,
  value: string,
  now: string,
): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    error(errors, PredictionErrorCode.InvalidPrediction, `${field} must be an ISO-8601 timestamp with timezone.`, field);
  } else if (parsed > Date.parse(now)) {
    error(errors, PredictionErrorCode.FutureTimestamp, `${field} cannot be in the future.`, field);
  }
}

function uniqueIds(
  errors: PredictionError[],
  field: string,
  values: ReadonlyArray<string>,
  required = false,
): void {
  if (!Array.isArray(values) || (required && values.length === 0)) {
    error(errors, PredictionErrorCode.InvalidPrediction, `${field} must contain evidence references.`, field);
    return;
  }
  for (const value of values) identifier(errors, field, value);
  if (new Set(values).size !== values.length) {
    error(errors, PredictionErrorCode.InvalidPrediction, `${field} contains duplicates.`, field);
  }
}

export function validatePredictionSnapshot(
  snapshot: PredictionSnapshot,
  now: string,
): PredictionValidation {
  const errors: PredictionError[] = [];
  timestamp(errors, "createdAt", snapshot.createdAt, now);
  for (const [field, value] of [
    ["market", snapshot.market],
    ["statement", snapshot.statement],
    ["expectedTimeHorizon", snapshot.expectedTimeHorizon],
    ["expectedCatalyst", snapshot.expectedCatalyst],
    ["owner", snapshot.owner],
    ["aiVersion", snapshot.aiVersion],
    ["version.predictionVersion", snapshot.version.predictionVersion],
    ["strategy.strategyId", snapshot.strategy.strategyId],
    ["strategy.strategyVersion", snapshot.strategy.strategyVersion],
  ] as const) nonEmpty(errors, field, value);
  if (snapshot.ticker !== undefined) nonEmpty(errors, "ticker", snapshot.ticker);
  if (snapshot.asset !== undefined) nonEmpty(errors, "asset", snapshot.asset);
  if (!Object.values(PredictionSubjectType).includes(snapshot.predictionType)) {
    error(errors, PredictionErrorCode.InvalidPrediction, "predictionType is invalid.", "predictionType");
  }
  if (!Object.values(PredictionCategory).includes(snapshot.category)) {
    error(errors, PredictionErrorCode.InvalidPrediction, "category is invalid.", "category");
  }
  if (!Object.values(PredictionDirection).includes(snapshot.expectedDirection)) {
    error(errors, PredictionErrorCode.InvalidPrediction, "expectedDirection is invalid.", "expectedDirection");
  }
  if (!Number.isFinite(snapshot.confidence.value) || snapshot.confidence.value < 0 || snapshot.confidence.value > 100) {
    error(errors, PredictionErrorCode.InvalidPrediction, "confidence.value must be between 0 and 100.", "confidence.value");
  }
  if (!Object.values(ConfidenceLevel).includes(snapshot.confidence.level)) {
    error(errors, PredictionErrorCode.InvalidPrediction, "confidence.level is invalid.", "confidence.level");
  }
  nonEmpty(errors, "confidence.rationale", snapshot.confidence.rationale);
  if (snapshot.version.schemaVersion !== "1.0") {
    error(errors, PredictionErrorCode.InvalidPrediction, "version.schemaVersion must be 1.0.", "version.schemaVersion");
  }
  uniqueIds(errors, "evidence.researchReferences", snapshot.evidence.researchReferences.map((value) => value.researchId), true);
  uniqueIds(errors, "evidence.auditReferences", snapshot.evidence.auditReferences.map((value) => value.auditId), true);
  uniqueIds(errors, "evidence.journalReferences", snapshot.evidence.journalReferences.map((value) => value.journalId));
  uniqueIds(errors, "evidence.strategyReferences", snapshot.evidence.strategyReferences.map((value) => `${value.strategyId}:${value.strategyVersion}`), true);
  uniqueIds(errors, "evidence.tradeReferences", snapshot.evidence.tradeReferences.map((value) => value.tradeId));
  uniqueIds(errors, "evidence.reviewReferences", snapshot.evidence.reviewReferences.map((value) => value.reviewId));
  if (!Array.isArray(snapshot.evidence.supportingEvidence) || snapshot.evidence.supportingEvidence.length === 0) {
    error(errors, PredictionErrorCode.InvalidPrediction, "supporting evidence is required.", "evidence.supportingEvidence");
  } else {
    for (const evidence of snapshot.evidence.supportingEvidence) nonEmpty(errors, "evidence.supportingEvidence", evidence);
  }
  const decision = snapshot.decisionSnapshot;
  identifier(errors, "decisionSnapshot.opportunityScore.opportunityId", decision.opportunityScore.opportunityId);
  if (!Number.isFinite(decision.opportunityScore.score) || decision.opportunityScore.score < 0 || decision.opportunityScore.score > 100) {
    error(errors, PredictionErrorCode.InvalidPrediction, "opportunity score must be between 0 and 100.", "decisionSnapshot.opportunityScore.score");
  }
  for (const [field, value] of [
    ["decisionSnapshot.opportunityScore.scoringPolicyVersion", decision.opportunityScore.scoringPolicyVersion],
    ["decisionSnapshot.risk.riskAssessmentId", decision.risk.riskAssessmentId],
    ["decisionSnapshot.risk.riskPolicyVersion", decision.risk.riskPolicyVersion],
    ["decisionSnapshot.routerDecision.decisionId", decision.routerDecision.decisionId],
    ["decisionSnapshot.selectedModelId", decision.selectedModelId],
    ["decisionSnapshot.configurationVersion", decision.configurationVersion],
    ["decisionSnapshot.policyVersion", decision.policyVersion],
  ] as const) identifier(errors, field, value);
  if (!Object.values(ReasoningLevel).includes(decision.reasoningLevel)) {
    error(errors, PredictionErrorCode.InvalidPrediction, "reasoning level is invalid.", "decisionSnapshot.reasoningLevel");
  }
  timestamp(errors, "decisionSnapshot.predictionTimestamp", decision.predictionTimestamp, now);
  timestamp(errors, "decisionSnapshot.marketTimestamp", decision.marketTimestamp, now);
  if (decision.predictionTimestamp !== snapshot.createdAt) {
    error(errors, PredictionErrorCode.InvalidPrediction, "prediction timestamp must equal createdAt.", "decisionSnapshot.predictionTimestamp");
  }
  if (Date.parse(decision.marketTimestamp) > Date.parse(decision.predictionTimestamp)) {
    error(errors, PredictionErrorCode.FutureTimestamp, "market timestamp cannot be after prediction timestamp.", "decisionSnapshot.marketTimestamp");
  }
  return { valid: errors.length === 0, errors };
}

export function validatePrediction(prediction: Prediction, now: string): PredictionValidation {
  const validation = validatePredictionSnapshot(prediction, now);
  const errors = [...validation.errors];
  identifier(errors, "predictionId", prediction.predictionId);
  if (prediction.predictionId !== createPredictionId(prediction)) {
    error(errors, PredictionErrorCode.InvalidPrediction, "predictionId does not match the deterministic snapshot identity.", "predictionId");
  }
  if (!Object.values(PredictionStatus).includes(prediction.status)) {
    error(errors, PredictionErrorCode.InvalidLifecycle, "prediction status is invalid.", "status");
  }
  if (prediction.history.length === 0) {
    error(errors, PredictionErrorCode.InvalidLifecycle, "prediction history is required.", "history");
  }
  let previous: PredictionStatus | null = null;
  prediction.history.forEach((entry, index) => {
    if (entry.sequence !== index + 1 || entry.predictionId !== prediction.predictionId || entry.fromStatus !== previous) {
      error(errors, PredictionErrorCode.InvalidLifecycle, "prediction history is not a contiguous lifecycle.", "history");
    }
    if (index === 0) {
      if (entry.toStatus !== PredictionStatus.Draft) error(errors, PredictionErrorCode.InvalidLifecycle, "history must begin at DRAFT.", "history");
    } else if (previous !== null && !DEFAULT_PREDICTION_LIFECYCLE.allowedTransitions[previous].includes(entry.toStatus)) {
      error(errors, PredictionErrorCode.IllegalTransition, "history contains an illegal lifecycle transition.", "history");
    }
    timestamp(errors, "history.occurredAt", entry.occurredAt, now);
    previous = entry.toStatus;
  });
  if (previous !== prediction.status) error(errors, PredictionErrorCode.InvalidLifecycle, "status must match the latest history entry.", "status");
  const lock = prediction.history.find((entry) => entry.toStatus === PredictionStatus.Locked);
  if (lock?.occurredAt !== prediction.lockedAt) {
    error(errors, PredictionErrorCode.InvalidLifecycle, "lockedAt must match the lock history event.", "lockedAt");
  }
  return { valid: errors.length === 0, errors };
}

export function validatePredictionHistory(
  history: PredictionHistory,
  current: Prediction,
  now: string,
): PredictionValidation {
  const errors: PredictionError[] = [];
  identifier(errors, "historyId", history.historyId);
  if (history.predictionId !== current.predictionId) error(errors, PredictionErrorCode.InvalidLifecycle, "history predictionId does not match.", "predictionId");
  if (history.sequence !== current.history.length + 1) error(errors, PredictionErrorCode.InvalidLifecycle, "history sequence is not contiguous.", "sequence");
  if (history.fromStatus !== current.status || !DEFAULT_PREDICTION_LIFECYCLE.allowedTransitions[current.status].includes(history.toStatus)) {
    error(errors, PredictionErrorCode.IllegalTransition, "lifecycle transition is illegal.", "toStatus");
  }
  timestamp(errors, "occurredAt", history.occurredAt, now);
  if (Date.parse(history.occurredAt) < Date.parse(current.history[current.history.length - 1]?.occurredAt ?? current.createdAt)) {
    error(errors, PredictionErrorCode.InvalidLifecycle, "history timestamp cannot move backward.", "occurredAt");
  }
  nonEmpty(errors, "reason", history.reason);
  return { valid: errors.length === 0, errors };
}

export function validatePredictionOutcome(outcome: PredictionOutcome, prediction: Prediction, now: string): PredictionValidation {
  const errors: PredictionError[] = [];
  identifier(errors, "outcomeId", outcome.outcomeId);
  if (outcome.predictionId !== prediction.predictionId) error(errors, PredictionErrorCode.InvalidPrediction, "outcome predictionId does not match.", "predictionId");
  if (prediction.status !== PredictionStatus.Locked) error(errors, PredictionErrorCode.UnlockedReview, "outcome requires a locked prediction.", "predictionId");
  timestamp(errors, "knownAt", outcome.knownAt, now);
  timestamp(errors, "marketTimestamp", outcome.marketTimestamp, now);
  if (Date.parse(outcome.marketTimestamp) < Date.parse(prediction.lockedAt ?? prediction.createdAt)) error(errors, PredictionErrorCode.InvalidPrediction, "outcome market timestamp cannot precede the lock.", "marketTimestamp");
  if (!Object.values(PredictionDirection).includes(outcome.actualDirection)) error(errors, PredictionErrorCode.InvalidPrediction, "actualDirection is invalid.", "actualDirection");
  nonEmpty(errors, "actualResult", outcome.actualResult);
  uniqueIds(errors, "evidenceReferences", outcome.evidenceReferences.map((value) => value.auditId), true);
  return { valid: errors.length === 0, errors };
}

export function validatePredictionReviewStart(start: PredictionReviewStart, prediction: Prediction, outcome: PredictionOutcome, now: string): PredictionValidation {
  const errors: PredictionError[] = [];
  identifier(errors, "reviewId", start.reviewId);
  if (start.predictionId !== prediction.predictionId || start.outcomeId !== outcome.outcomeId) error(errors, PredictionErrorCode.InvalidPrediction, "review references do not match prediction and outcome.");
  if (prediction.status !== PredictionStatus.OutcomeKnown) error(errors, PredictionErrorCode.OutcomeMissing, "review requires OUTCOME_KNOWN status.");
  timestamp(errors, "startedAt", start.startedAt, now);
  if (Date.parse(start.startedAt) < Date.parse(outcome.knownAt)) error(errors, PredictionErrorCode.InvalidLifecycle, "review cannot start before outcome.", "startedAt");
  nonEmpty(errors, "reviewer", start.reviewer);
  if (start.status !== PredictionReviewStatus.Started) error(errors, PredictionErrorCode.InvalidLifecycle, "review start status is invalid.", "status");
  return { valid: errors.length === 0, errors };
}

export function validatePredictionReview(review: PredictionReview, start: PredictionReviewStart, prediction: Prediction, now: string): PredictionValidation {
  const errors: PredictionError[] = [];
  if (review.reviewId !== start.reviewId || review.predictionId !== prediction.predictionId || review.outcomeId !== start.outcomeId || review.startedAt !== start.startedAt || review.reviewer !== start.reviewer) {
    error(errors, PredictionErrorCode.InvalidPrediction, "completed review must preserve its start references.");
  }
  if (prediction.status !== PredictionStatus.OutcomeKnown) error(errors, PredictionErrorCode.OutcomeMissing, "review completion requires OUTCOME_KNOWN status.");
  timestamp(errors, "completedAt", review.completedAt, now);
  if (Date.parse(review.completedAt) < Date.parse(start.startedAt)) error(errors, PredictionErrorCode.InvalidLifecycle, "review cannot complete before it starts.", "completedAt");
  if (review.status !== PredictionReviewStatus.Completed) error(errors, PredictionErrorCode.InvalidLifecycle, "review status is invalid.", "status");
  if (!Object.values(PredictionAccuracy).includes(review.accuracy)) error(errors, PredictionErrorCode.InvalidPrediction, "accuracy is invalid.", "accuracy");
  if (!Object.values(PredictionProfitability).includes(review.profitability)) error(errors, PredictionErrorCode.InvalidPrediction, "profitability is invalid.", "profitability");
  if (!Object.values(PredictionReviewResult).includes(review.result)) error(errors, PredictionErrorCode.InvalidPrediction, "review result is invalid.", "result");
  for (const [field, value] of Object.entries(review.score)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) error(errors, PredictionErrorCode.InvalidPrediction, `${field} must be between 0 and 100.`, `score.${field}`);
  }
  nonEmpty(errors, "accuracyRationale", review.accuracyRationale);
  nonEmpty(errors, "profitabilityRationale", review.profitabilityRationale);
  return { valid: errors.length === 0, errors };
}

export function throwIfInvalid(validation: PredictionValidation): void {
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(`${first?.code ?? PredictionErrorCode.InvalidPrediction}: ${first?.message ?? "Prediction validation failed."}`);
  }
}
