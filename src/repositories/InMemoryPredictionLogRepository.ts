import {
  PredictionErrorCode,
  PredictionStatus,
  throwIfInvalid,
  validatePrediction,
  validatePredictionHistory,
  validatePredictionOutcome,
  validatePredictionReview,
  validatePredictionReviewStart,
  type Prediction,
  type PredictionHistory,
  type PredictionOutcome,
  type PredictionQuery,
  type PredictionReview,
  type PredictionReviewStart,
} from "../contracts";
import {
  matchesPredictionFilter,
  type PredictionLogEvent,
  type PredictionLogRepository,
} from "./PredictionRepository";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fail(code: PredictionErrorCode, message: string): never {
  throw new Error(`${code}: ${message}`);
}

export class InMemoryPredictionLogRepository implements PredictionLogRepository {
  private readonly predictions = new Map<string, Prediction>();
  private readonly outcomes = new Map<string, PredictionOutcome>();
  private readonly outcomeIds = new Set<string>();
  private readonly reviewStarts = new Map<string, PredictionReviewStart>();
  private readonly reviewIds = new Set<string>();
  private readonly reviews = new Map<string, PredictionReview>();
  private readonly events: PredictionLogEvent[] = [];

  constructor(seedEvents: ReadonlyArray<PredictionLogEvent> = []) {
    for (const event of seedEvents) this.applyEvent(clone(event), false);
  }

  protected persistEvent(_event: PredictionLogEvent): void {}

  protected importEvent(event: PredictionLogEvent): void {
    this.applyEvent(clone(event), false);
  }

  private applyEvent(event: PredictionLogEvent, persist: boolean): void {
    switch (event.eventType) {
      case "PREDICTION_APPENDED":
        this.applyPrediction(event, persist);
        break;
      case "HISTORY_APPENDED":
        this.applyHistory(event, persist);
        break;
      case "OUTCOME_APPENDED":
        this.applyOutcome(event, persist);
        break;
      case "REVIEW_STARTED":
        this.applyReviewStart(event, persist);
        break;
      case "REVIEW_APPENDED":
        this.applyReview(event, persist);
        break;
      default:
        fail(PredictionErrorCode.RepositoryCorrupt, "prediction log contains an unsupported event type.");
    }
  }

  private commit(event: PredictionLogEvent, persist: boolean): void {
    if (persist) this.persistEvent(clone(event));
    this.events.push(clone(event));
  }

  private applyPrediction(
    event: Extract<PredictionLogEvent, { eventType: "PREDICTION_APPENDED" }>,
    persist: boolean,
  ): void {
    const prediction = event.prediction;
    throwIfInvalid(validatePrediction(prediction, event.acceptedAt));
    if (
      prediction.status !== PredictionStatus.Draft ||
      prediction.history.length !== 1 ||
      prediction.history[0]?.fromStatus !== null ||
      prediction.history[0]?.toStatus !== PredictionStatus.Draft
    ) {
      fail(PredictionErrorCode.InvalidLifecycle, "new predictions must begin with exactly one DRAFT history event.");
    }
    if (this.predictions.has(prediction.predictionId)) {
      fail(PredictionErrorCode.DuplicatePredictionId, "predictionId already exists.");
    }
    this.commit(event, persist);
    this.predictions.set(prediction.predictionId, clone(prediction));
  }

  private applyHistory(
    event: Extract<PredictionLogEvent, { eventType: "HISTORY_APPENDED" }>,
    persist: boolean,
  ): void {
    const current = this.predictions.get(event.history.predictionId);
    if (current === undefined) fail(PredictionErrorCode.PredictionNotFound, "prediction does not exist.");
    throwIfInvalid(validatePredictionHistory(event.history, current, event.acceptedAt));
    if (event.history.toStatus === PredictionStatus.OutcomeKnown && !this.outcomes.has(current.predictionId)) {
      fail(PredictionErrorCode.OutcomeMissing, "OUTCOME_KNOWN requires an appended outcome.");
    }
    if (event.history.toStatus === PredictionStatus.Reviewed && !this.reviews.has(current.predictionId)) {
      fail(PredictionErrorCode.ReviewNotStarted, "REVIEWED requires an appended completed review.");
    }
    this.commit(event, persist);
    const history = [...current.history.map(clone), clone(event.history)];
    const next: Prediction = event.history.toStatus === PredictionStatus.Locked
      ? { ...clone(current), lockedAt: event.history.occurredAt, status: event.history.toStatus, history }
      : { ...clone(current), status: event.history.toStatus, history };
    this.predictions.set(current.predictionId, next);
  }

  private applyOutcome(
    event: Extract<PredictionLogEvent, { eventType: "OUTCOME_APPENDED" }>,
    persist: boolean,
  ): void {
    if (this.outcomes.has(event.outcome.predictionId) || this.outcomeIds.has(event.outcome.outcomeId)) {
      fail(PredictionErrorCode.DuplicateOutcome, "outcome identity already exists.");
    }
    const prediction = this.predictions.get(event.outcome.predictionId);
    if (prediction === undefined) fail(PredictionErrorCode.PredictionNotFound, "outcome prediction does not exist.");
    throwIfInvalid(validatePredictionOutcome(event.outcome, prediction, event.outcome.knownAt));
    this.commit(event, persist);
    this.outcomes.set(event.outcome.predictionId, clone(event.outcome));
    this.outcomeIds.add(event.outcome.outcomeId);
  }

  private applyReviewStart(
    event: Extract<PredictionLogEvent, { eventType: "REVIEW_STARTED" }>,
    persist: boolean,
  ): void {
    if (this.reviewStarts.has(event.start.predictionId) || this.reviewIds.has(event.start.reviewId)) {
      fail(PredictionErrorCode.DuplicateReview, "review identity already exists.");
    }
    const prediction = this.predictions.get(event.start.predictionId);
    const outcome = this.outcomes.get(event.start.predictionId);
    if (prediction === undefined) fail(PredictionErrorCode.PredictionNotFound, "review prediction does not exist.");
    if (outcome === undefined) fail(PredictionErrorCode.OutcomeMissing, "review outcome does not exist.");
    throwIfInvalid(validatePredictionReviewStart(event.start, prediction, outcome, event.start.startedAt));
    this.commit(event, persist);
    this.reviewStarts.set(event.start.predictionId, clone(event.start));
    this.reviewIds.add(event.start.reviewId);
  }

  private applyReview(
    event: Extract<PredictionLogEvent, { eventType: "REVIEW_APPENDED" }>,
    persist: boolean,
  ): void {
    if (this.reviews.has(event.review.predictionId)) {
      fail(PredictionErrorCode.DuplicateReview, "completed review already exists.");
    }
    const prediction = this.predictions.get(event.review.predictionId);
    const start = this.reviewStarts.get(event.review.predictionId);
    if (prediction === undefined) fail(PredictionErrorCode.PredictionNotFound, "review prediction does not exist.");
    if (start === undefined) fail(PredictionErrorCode.ReviewNotStarted, "review must be started before completion.");
    throwIfInvalid(validatePredictionReview(event.review, start, prediction, event.review.completedAt));
    if (start.reviewId !== event.review.reviewId) {
      fail(PredictionErrorCode.ReviewNotStarted, "review must be started before completion.");
    }
    this.commit(event, persist);
    this.reviews.set(event.review.predictionId, clone(event.review));
  }

  appendPrediction(prediction: Prediction, acceptedAt: string): void {
    this.applyEvent({ schemaVersion: "1.0", eventType: "PREDICTION_APPENDED", acceptedAt, prediction: clone(prediction) }, true);
  }

  appendHistory(history: PredictionHistory, acceptedAt: string): void {
    this.applyEvent({ schemaVersion: "1.0", eventType: "HISTORY_APPENDED", acceptedAt, history: clone(history) }, true);
  }

  appendOutcome(outcome: PredictionOutcome): void {
    this.applyEvent({ schemaVersion: "1.0", eventType: "OUTCOME_APPENDED", outcome: clone(outcome) }, true);
  }

  appendReviewStart(start: PredictionReviewStart): void {
    this.applyEvent({ schemaVersion: "1.0", eventType: "REVIEW_STARTED", start: clone(start) }, true);
  }

  appendReview(review: PredictionReview): void {
    this.applyEvent({ schemaVersion: "1.0", eventType: "REVIEW_APPENDED", review: clone(review) }, true);
  }

  getById(predictionId: string): Prediction | undefined {
    const value = this.predictions.get(predictionId);
    return value === undefined ? undefined : clone(value);
  }

  exists(predictionId: string): boolean {
    return this.predictions.has(predictionId);
  }

  query(query: PredictionQuery = {}): ReadonlyArray<Prediction> {
    const offset = query.offset ?? 0;
    const limit = query.limit ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit <= 0) {
      fail(PredictionErrorCode.InvalidPrediction, "query pagination is invalid.");
    }
    return [...this.predictions.values()]
      .filter((value) => matchesPredictionFilter(value, query.filter))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.predictionId.localeCompare(right.predictionId))
      .slice(offset, offset + limit)
      .map(clone);
  }

  history(predictionId: string): ReadonlyArray<PredictionHistory> {
    return this.getById(predictionId)?.history ?? [];
  }

  getOutcome(predictionId: string): PredictionOutcome | undefined {
    const value = this.outcomes.get(predictionId);
    return value === undefined ? undefined : clone(value);
  }

  getReviewStart(predictionId: string): PredictionReviewStart | undefined {
    const value = this.reviewStarts.get(predictionId);
    return value === undefined ? undefined : clone(value);
  }

  getReview(predictionId: string): PredictionReview | undefined {
    const value = this.reviews.get(predictionId);
    return value === undefined ? undefined : clone(value);
  }

  allOutcomes(): ReadonlyArray<PredictionOutcome> {
    return [...this.outcomes.values()].sort((a, b) => a.knownAt.localeCompare(b.knownAt) || a.outcomeId.localeCompare(b.outcomeId)).map(clone);
  }

  allReviews(): ReadonlyArray<PredictionReview> {
    return [...this.reviews.values()].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.reviewId.localeCompare(b.reviewId)).map(clone);
  }

  allEvents(): ReadonlyArray<PredictionLogEvent> {
    return this.events.map(clone);
  }
}
