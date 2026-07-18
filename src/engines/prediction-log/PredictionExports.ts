import {
  PredictionExportFormat,
  type Prediction,
  type PredictionExports,
} from "../../contracts";
import { summarizePrediction } from "./PredictionTranslations";

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportPredictions(
  predictions: ReadonlyArray<Prediction>,
  format: PredictionExportFormat,
  generatedAt: string,
): PredictionExports {
  const ordered = [...predictions].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.predictionId.localeCompare(right.predictionId),
  );
  let content: string;
  if (format === PredictionExportFormat.Json) {
    content = JSON.stringify(ordered, null, 2);
  } else if (format === PredictionExportFormat.Ndjson) {
    content = ordered.map((prediction) => JSON.stringify(prediction)).join("\n");
    if (content.length > 0) content += "\n";
  } else if (format === PredictionExportFormat.Csv) {
    const header = [
      "predictionId",
      "createdAt",
      "lockedAt",
      "market",
      "ticker",
      "statement",
      "expectedDirection",
      "confidence",
      "status",
      "outcomeKnown",
      "reviewed",
    ];
    const rows = ordered.map((prediction) => {
      const summary = summarizePrediction(prediction);
      return [
        summary.predictionId,
        summary.createdAt,
        summary.lockedAt ?? "",
        summary.market,
        summary.ticker ?? "",
        summary.statement,
        summary.expectedDirection,
        summary.confidence,
        summary.status,
        summary.outcomeKnown,
        summary.reviewed,
      ].map(csvCell).join(",");
    });
    content = [header.join(","), ...rows].join("\n") + "\n";
  } else {
    throw new Error("INVALID_PREDICTION: unsupported prediction export format.");
  }
  return { format, generatedAt, recordCount: ordered.length, content };
}
