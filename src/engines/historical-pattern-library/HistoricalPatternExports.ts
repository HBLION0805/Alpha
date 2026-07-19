import {
  HistoricalExportDestination, HistoricalExportFormat, HistoricalExportStatus,
  HistoricalPatternErrorCategory, PrivacyLevel,
  canonicalizeHistoricalValue,
  type HistoricalPatternError, type HistoricalPatternExportPolicy,
  type HistoricalPatternExportRequest, type HistoricalPatternExportResult,
  type HistoricalPatternRepository,
} from "../../contracts";

function rejected(request: HistoricalPatternExportRequest, category: HistoricalPatternErrorCategory, message: string): HistoricalPatternExportResult { const error: HistoricalPatternError = { category, message }; return { status: HistoricalExportStatus.Rejected, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: 0, error }; }
export function exportHistoricalPatterns(repository: HistoricalPatternRepository, request: HistoricalPatternExportRequest, policy: HistoricalPatternExportPolicy): HistoricalPatternExportResult {
  const eventHistories = repository.queryEvents(request.query).map((value) => repository.getEventHistory(value.eventId)); const patternHistories = repository.queryPatterns(request.query).map((value) => repository.getPatternHistory(value.patternId)); const histories = [...eventHistories, ...patternHistories].filter((value) => value !== undefined);
  if (request.destination === HistoricalExportDestination.ExternalTransfer) {
    if (!policy.allowExternalExports) return rejected(request, HistoricalPatternErrorCategory.ExportRestricted, "External historical exports are disabled.");
    if (histories.some((value) => value.record.privacyLevel === PrivacyLevel.LocalOnly)) return rejected(request, HistoricalPatternErrorCategory.ExportRestricted, "LOCAL_ONLY historical records cannot be externally exported.");
    if (policy.requireSensitiveAuthorization && histories.some((value) => value.record.privacyLevel === PrivacyLevel.Sensitive) && (request.sensitiveAuthorizationReference === undefined || !policy.sensitiveAuthorizationReferences.includes(request.sensitiveAuthorizationReference))) return rejected(request, HistoricalPatternErrorCategory.SensitiveExportUnauthorized, "Sensitive historical export requires authorization.");
  }
  const content = request.format === HistoricalExportFormat.Json ? JSON.stringify(histories, null, 2) : histories.map((value) => canonicalizeHistoricalValue(value)).join("\n") + (histories.length === 0 ? "" : "\n");
  return { status: HistoricalExportStatus.Exported, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: histories.length, content };
}
