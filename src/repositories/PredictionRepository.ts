import type {
  Prediction,
  PredictionFilter,
  PredictionHistory,
  PredictionOutcome,
  PredictionQuery,
  PredictionReview,
  PredictionReviewStart,
} from "../contracts";

export interface PredictionRepository {
  appendPrediction(prediction: Prediction, acceptedAt: string): void;
  appendHistory(history: PredictionHistory, acceptedAt: string): void;
  getById(predictionId: string): Prediction | undefined;
  exists(predictionId: string): boolean;
  query(query?: PredictionQuery): ReadonlyArray<Prediction>;
  history(predictionId: string): ReadonlyArray<PredictionHistory>;
}

export interface PredictionReviewRepository {
  appendOutcome(outcome: PredictionOutcome): void;
  appendReviewStart(start: PredictionReviewStart): void;
  appendReview(review: PredictionReview): void;
  getOutcome(predictionId: string): PredictionOutcome | undefined;
  getReviewStart(predictionId: string): PredictionReviewStart | undefined;
  getReview(predictionId: string): PredictionReview | undefined;
  allOutcomes(): ReadonlyArray<PredictionOutcome>;
  allReviews(): ReadonlyArray<PredictionReview>;
}

export interface PredictionLogRepository
  extends PredictionRepository,
    PredictionReviewRepository {}

export type PredictionLogEvent =
  | {
      readonly schemaVersion: "1.0";
      readonly eventType: "PREDICTION_APPENDED";
      readonly acceptedAt: string;
      readonly prediction: Prediction;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly eventType: "HISTORY_APPENDED";
      readonly acceptedAt: string;
      readonly history: PredictionHistory;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly eventType: "OUTCOME_APPENDED";
      readonly outcome: PredictionOutcome;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly eventType: "REVIEW_STARTED";
      readonly start: PredictionReviewStart;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly eventType: "REVIEW_APPENDED";
      readonly review: PredictionReview;
    };

export function matchesPredictionFilter(
  prediction: Prediction,
  filter: PredictionFilter = {},
): boolean {
  return (
    (filter.statuses === undefined || filter.statuses.includes(prediction.status)) &&
    (filter.categories === undefined || filter.categories.includes(prediction.category)) &&
    (filter.directions === undefined || filter.directions.includes(prediction.expectedDirection)) &&
    (filter.markets === undefined || filter.markets.includes(prediction.market)) &&
    (filter.ticker === undefined || prediction.ticker === filter.ticker) &&
    (filter.owner === undefined || prediction.owner === filter.owner) &&
    (filter.strategyId === undefined || prediction.strategy.strategyId === filter.strategyId) &&
    (filter.researchId === undefined || prediction.evidence.researchReferences.some((reference) => reference.researchId === filter.researchId)) &&
    (filter.createdFrom === undefined || Date.parse(prediction.createdAt) >= Date.parse(filter.createdFrom)) &&
    (filter.createdTo === undefined || Date.parse(prediction.createdAt) <= Date.parse(filter.createdTo)) &&
    (filter.reviewRequired === undefined || prediction.reviewRequired === filter.reviewRequired)
  );
}
