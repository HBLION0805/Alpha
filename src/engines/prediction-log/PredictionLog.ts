import {
  PredictionAccuracy,
  PredictionCategory,
  PredictionErrorCode,
  PredictionProfitability,
  PredictionStatus,
  createPredictionId,
  throwIfInvalid,
  validatePredictionHistory,
  validatePredictionOutcome,
  validatePredictionReview,
  validatePredictionReviewStart,
  validatePredictionSnapshot,
  type Prediction,
  type PredictionFilter,
  type PredictionHistory,
  type PredictionMetrics,
  type PredictionOutcome,
  type PredictionQuery,
  type PredictionReview,
  type PredictionReviewStart,
  type PredictionSnapshot,
  type PredictionStatistics,
} from "../../contracts";
import type { PredictionLogRepository } from "../../repositories";

export interface PredictionClock {
  now(): string;
}

export class SystemPredictionClock implements PredictionClock {
  now(): string {
    return new Date().toISOString();
  }
}

function requirePrediction(
  repository: PredictionLogRepository,
  predictionId: string,
): Prediction {
  const prediction = repository.getById(predictionId);
  if (prediction === undefined) {
    throw new Error(`${PredictionErrorCode.PredictionNotFound}: prediction does not exist.`);
  }
  return prediction;
}

function average(values: ReadonlyArray<number>): number | undefined {
  if (values.length === 0) return undefined;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export class PredictionLog {
  constructor(
    private readonly repository: PredictionLogRepository,
    private readonly clock: PredictionClock = new SystemPredictionClock(),
  ) {}

  createDraft(snapshot: PredictionSnapshot): Prediction {
    const now = this.clock.now();
    throwIfInvalid(validatePredictionSnapshot(snapshot, now));
    const predictionId = createPredictionId(snapshot);
    const history: PredictionHistory = {
      historyId: `${predictionId}:history:1`,
      predictionId,
      sequence: 1,
      fromStatus: null,
      toStatus: PredictionStatus.Draft,
      occurredAt: snapshot.createdAt,
      reason: "Prediction draft created from an immutable evidence snapshot.",
    };
    const prediction: Prediction = {
      ...structuredClone(snapshot),
      predictionId,
      status: PredictionStatus.Draft,
      history: [history],
    };
    this.repository.appendPrediction(prediction, now);
    return structuredClone(prediction);
  }

  submit(predictionId: string, occurredAt: string, reason: string): Prediction {
    return this.transition(predictionId, PredictionStatus.Submitted, occurredAt, reason);
  }

  lock(predictionId: string, occurredAt: string, reason: string): Prediction {
    return this.transition(predictionId, PredictionStatus.Locked, occurredAt, reason);
  }

  recordOutcome(outcome: PredictionOutcome): Prediction {
    const prediction = requirePrediction(this.repository, outcome.predictionId);
    const now = this.clock.now();
    throwIfInvalid(validatePredictionOutcome(outcome, prediction, now));
    const transition = this.createHistory(prediction, PredictionStatus.OutcomeKnown, outcome.knownAt, "Prediction outcome recorded without modifying the forecast.", outcome.outcomeId);
    throwIfInvalid(validatePredictionHistory(transition, prediction, now));
    this.repository.appendOutcome(structuredClone(outcome));
    this.repository.appendHistory(transition, now);
    return requirePrediction(this.repository, outcome.predictionId);
  }

  beginReview(start: PredictionReviewStart): PredictionReviewStart {
    const prediction = requirePrediction(this.repository, start.predictionId);
    const outcome = this.repository.getOutcome(start.predictionId);
    if (outcome === undefined) throw new Error(`${PredictionErrorCode.OutcomeMissing}: prediction outcome does not exist.`);
    throwIfInvalid(validatePredictionReviewStart(start, prediction, outcome, this.clock.now()));
    this.repository.appendReviewStart(structuredClone(start));
    return structuredClone(start);
  }

  completeReview(review: PredictionReview): Prediction {
    const prediction = requirePrediction(this.repository, review.predictionId);
    const start = this.repository.getReviewStart(review.predictionId);
    if (start === undefined) throw new Error(`${PredictionErrorCode.ReviewNotStarted}: review has not started.`);
    const now = this.clock.now();
    throwIfInvalid(validatePredictionReview(review, start, prediction, now));
    const transition = this.createHistory(prediction, PredictionStatus.Reviewed, review.completedAt, "Prediction accuracy and profitability reviewed independently.", review.reviewId);
    throwIfInvalid(validatePredictionHistory(transition, prediction, now));
    this.repository.appendReview(structuredClone(review));
    this.repository.appendHistory(transition, now);
    return requirePrediction(this.repository, review.predictionId);
  }

  archive(predictionId: string, occurredAt: string, reason: string): Prediction {
    return this.transition(predictionId, PredictionStatus.Archived, occurredAt, reason);
  }

  get(predictionId: string): Prediction | undefined {
    return this.repository.getById(predictionId);
  }

  search(query: PredictionQuery = {}): ReadonlyArray<Prediction> {
    return this.repository.query(query);
  }

  history(predictionId: string): ReadonlyArray<PredictionHistory> {
    return this.repository.history(predictionId);
  }

  statistics(filter?: PredictionFilter): PredictionStatistics {
    const predictions = this.repository.query(filter === undefined ? {} : { filter });
    const includedIds = new Set(predictions.map((prediction) => prediction.predictionId));
    const reviews = this.repository.allReviews().filter((review) => includedIds.has(review.predictionId));
    const accurate = reviews.filter((review) => review.accuracy === PredictionAccuracy.Accurate).length;
    const partiallyAccurate = reviews.filter((review) => review.accuracy === PredictionAccuracy.PartiallyAccurate).length;
    const inaccurate = reviews.filter((review) => review.accuracy === PredictionAccuracy.Inaccurate).length;
    const accuracyDenominator = accurate + partiallyAccurate + inaccurate;
    const profitable = reviews.filter((review) => review.profitability === PredictionProfitability.Profitable).length;
    const breakEven = reviews.filter((review) => review.profitability === PredictionProfitability.BreakEven).length;
    const unprofitable = reviews.filter((review) => review.profitability === PredictionProfitability.Unprofitable).length;
    const profitabilityDenominator = profitable + breakEven + unprofitable;
    const optionalMetrics = {
      ...(accuracyDenominator === 0 ? {} : { accuracyRate: Number(((accurate + partiallyAccurate * 0.5) / accuracyDenominator).toFixed(4)) }),
      ...(profitabilityDenominator === 0 ? {} : { profitabilityRate: Number((profitable / profitabilityDenominator).toFixed(4)) }),
      ...(average(predictions.map((prediction) => prediction.confidence.value)) === undefined ? {} : { averageConfidence: average(predictions.map((prediction) => prediction.confidence.value)) as number }),
      ...(average(reviews.map((review) => review.score.overallScore)) === undefined ? {} : { averageScore: average(reviews.map((review) => review.score.overallScore)) as number }),
    };
    const metrics: PredictionMetrics = {
      total: predictions.length,
      reviewed: reviews.length,
      accurate,
      partiallyAccurate,
      inaccurate,
      profitable,
      breakEven,
      unprofitable,
      ...optionalMetrics,
    };
    const byStatus = {
      [PredictionStatus.Draft]: 0,
      [PredictionStatus.Submitted]: 0,
      [PredictionStatus.Locked]: 0,
      [PredictionStatus.OutcomeKnown]: 0,
      [PredictionStatus.Reviewed]: 0,
      [PredictionStatus.Archived]: 0,
    };
    const byCategory: Partial<Record<PredictionCategory, number>> = {};
    for (const prediction of predictions) {
      byStatus[prediction.status] += 1;
      byCategory[prediction.category] = (byCategory[prediction.category] ?? 0) + 1;
    }
    return {
      generatedAt: this.clock.now(),
      ...(filter === undefined ? {} : { filter: structuredClone(filter) }),
      metrics,
      byStatus,
      byCategory,
    };
  }

  private transition(
    predictionId: string,
    toStatus: PredictionStatus,
    occurredAt: string,
    reason: string,
  ): Prediction {
    const prediction = requirePrediction(this.repository, predictionId);
    const now = this.clock.now();
    const history = this.createHistory(prediction, toStatus, occurredAt, reason);
    throwIfInvalid(validatePredictionHistory(history, prediction, now));
    this.repository.appendHistory(history, now);
    return requirePrediction(this.repository, predictionId);
  }

  private createHistory(
    prediction: Prediction,
    toStatus: PredictionStatus,
    occurredAt: string,
    reason: string,
    referenceId?: string,
  ): PredictionHistory {
    const sequence = prediction.history.length + 1;
    const base = {
      historyId: `${prediction.predictionId}:history:${String(sequence)}`,
      predictionId: prediction.predictionId,
      sequence,
      fromStatus: prediction.status,
      toStatus,
      occurredAt,
      reason,
    };
    return referenceId === undefined ? base : { ...base, referenceId };
  }
}
