import {
  PredictionStatus,
  type Prediction,
  type PredictionSummary,
  type PredictionTranslation,
} from "../../contracts";

export function summarizePrediction(prediction: Prediction): PredictionSummary {
  const outcomeKnown = [
    PredictionStatus.OutcomeKnown,
    PredictionStatus.Reviewed,
    PredictionStatus.Archived,
  ].includes(prediction.status);
  const base = {
    predictionId: prediction.predictionId,
    createdAt: prediction.createdAt,
    market: prediction.market,
    statement: prediction.statement,
    expectedDirection: prediction.expectedDirection,
    confidence: prediction.confidence.value,
    status: prediction.status,
    outcomeKnown,
    reviewed: [PredictionStatus.Reviewed, PredictionStatus.Archived].includes(prediction.status),
  };
  return {
    ...base,
    ...(prediction.lockedAt === undefined ? {} : { lockedAt: prediction.lockedAt }),
    ...(prediction.ticker === undefined ? {} : { ticker: prediction.ticker }),
  };
}

export function translatePrediction(
  prediction: Prediction,
  translatedAt: string,
): PredictionTranslation {
  return {
    contractVersion: "1.0",
    translatedAt,
    sourcePredictionId: prediction.predictionId,
    summary: summarizePrediction(prediction),
  };
}
