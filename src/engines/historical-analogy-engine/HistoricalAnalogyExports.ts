import {
  HistoricalAnalogyErrorCategory,
  HistoricalAnalogyExportDestination,
  HistoricalAnalogyExportFormat,
  HistoricalAnalogyExportStatus,
  PrivacyLevel,
  canonicalizeHistoricalAnalogyValue,
  type HistoricalAnalogyError,
  type HistoricalAnalogyExportPolicy,
  type HistoricalAnalogyExportRequest,
  type HistoricalAnalogyExportResult,
  type HistoricalAnalogyRepository,
} from "../../contracts";

function rejected(request: HistoricalAnalogyExportRequest, category: HistoricalAnalogyErrorCategory, message: string): HistoricalAnalogyExportResult { const error: HistoricalAnalogyError = { category, message }; return { status: HistoricalAnalogyExportStatus.Rejected, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: 0, error }; }
export function exportHistoricalAnalogies(repository: HistoricalAnalogyRepository, request: HistoricalAnalogyExportRequest, policy: HistoricalAnalogyExportPolicy): HistoricalAnalogyExportResult { const histories = repository.query(request.query).map((value) => repository.getHistory(value.analogyId)).filter((value) => value !== undefined); if (request.destination === HistoricalAnalogyExportDestination.ExternalTransfer) { if (!policy.allowExternalExports) return rejected(request, HistoricalAnalogyErrorCategory.ExportRestricted, "External analogy exports are disabled."); if (histories.some((value) => value.record.privacyLevel === PrivacyLevel.LocalOnly)) return rejected(request, HistoricalAnalogyErrorCategory.ExportRestricted, "LOCAL_ONLY analogies cannot be externally exported."); if (policy.requireSensitiveAuthorization && histories.some((value) => value.record.privacyLevel === PrivacyLevel.Sensitive) && (request.sensitiveAuthorizationReference === undefined || !policy.sensitiveAuthorizationReferences.includes(request.sensitiveAuthorizationReference))) return rejected(request, HistoricalAnalogyErrorCategory.SensitiveExportUnauthorized, "Sensitive analogy export requires authorization."); } const content = request.format === HistoricalAnalogyExportFormat.Json ? JSON.stringify(histories, null, 2) : histories.map((value) => canonicalizeHistoricalAnalogyValue(value)).join("\n") + (histories.length === 0 ? "" : "\n"); return { status: HistoricalAnalogyExportStatus.Exported, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: histories.length, content }; }
