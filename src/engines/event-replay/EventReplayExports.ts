import {
  EventReplayErrorCategory,
  EventReplayExportDestination,
  EventReplayExportFormat,
  EventReplayExportStatus,
  PrivacyLevel,
  canonicalizeEventReplayValue,
  type EventReplayError,
  type EventReplayExportPolicy,
  type EventReplayExportRequest,
  type EventReplayExportResult,
  type EventReplayRepository,
} from "../../contracts";

function rejected(request: EventReplayExportRequest, category: EventReplayErrorCategory, message: string): EventReplayExportResult {
  const error: EventReplayError = { category, message };
  return { status: EventReplayExportStatus.Rejected, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: 0, error };
}

export function exportEventReplays(repository: EventReplayRepository, request: EventReplayExportRequest, policy: EventReplayExportPolicy): EventReplayExportResult {
  const histories = repository.query(request.query).map((value) => repository.getHistory(value.sessionId)).filter((value) => value !== undefined);
  if (request.destination === EventReplayExportDestination.ExternalTransfer) {
    if (!policy.allowExternalExports) return rejected(request, EventReplayErrorCategory.ExportRestricted, "External replay exports are disabled.");
    if (histories.some((value) => value.session.privacyLevel === PrivacyLevel.LocalOnly)) return rejected(request, EventReplayErrorCategory.ExportRestricted, "LOCAL_ONLY replay sessions cannot be externally exported.");
    if (policy.requireSensitiveAuthorization && histories.some((value) => value.session.privacyLevel === PrivacyLevel.Sensitive) && (request.sensitiveAuthorizationReference === undefined || !policy.sensitiveAuthorizationReferences.includes(request.sensitiveAuthorizationReference))) return rejected(request, EventReplayErrorCategory.SensitiveExportUnauthorized, "Sensitive replay export requires authorization.");
  }
  const content = request.format === EventReplayExportFormat.Json ? JSON.stringify(histories, null, 2) : histories.map((value) => canonicalizeEventReplayValue(value)).join("\n") + (histories.length === 0 ? "" : "\n");
  return { status: EventReplayExportStatus.Exported, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: histories.length, content };
}
