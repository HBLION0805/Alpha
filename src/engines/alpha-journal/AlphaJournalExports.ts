import {
  AlphaJournalErrorCategory,
  AlphaJournalExportDestination,
  AlphaJournalExportFormat,
  AlphaJournalExportStatus,
  PrivacyLevel,
  type AlphaJournalEntryHistory,
  type AlphaJournalError,
  type AlphaJournalExportPolicy,
  type AlphaJournalExportRequest,
  type AlphaJournalExportResult,
} from "../../contracts";
import type { AlphaJournalRepository } from "../../repositories";

function rejected(request: AlphaJournalExportRequest, category: AlphaJournalErrorCategory, message: string): AlphaJournalExportResult {
  const error: AlphaJournalError = { category, message };
  return { status: AlphaJournalExportStatus.Rejected, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: 0, error };
}

export function exportAlphaJournal(
  repository: AlphaJournalRepository,
  request: AlphaJournalExportRequest,
  policy: AlphaJournalExportPolicy,
): AlphaJournalExportResult {
  const entries = repository.query(request.query);
  if (request.destination === AlphaJournalExportDestination.ExternalTransfer) {
    if (!policy.allowExternalExports) return rejected(request, AlphaJournalErrorCategory.ExportRestricted, "external journal exports are disabled.");
    if (entries.some((entry) => entry.privacyLevel === PrivacyLevel.LocalOnly)) return rejected(request, AlphaJournalErrorCategory.ExportRestricted, "LOCAL_ONLY journal evidence cannot be externally exported.");
    if (policy.requireSensitiveAuthorization && entries.some((entry) => entry.privacyLevel === PrivacyLevel.Sensitive) && (request.sensitiveAuthorizationReference === undefined || !policy.sensitiveAuthorizationReferences.includes(request.sensitiveAuthorizationReference))) {
      return rejected(request, AlphaJournalErrorCategory.SensitiveExportUnauthorized, "sensitive journal export requires authorization.");
    }
  }
  const records = entries.map((entry) => repository.getEntryHistory(entry.entryId) as AlphaJournalEntryHistory);
  const content = request.format === AlphaJournalExportFormat.Json
    ? JSON.stringify(records, null, 2)
    : records.map((record) => JSON.stringify(record)).join("\n") + (records.length === 0 ? "" : "\n");
  return { status: AlphaJournalExportStatus.Exported, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: records.length, content };
}
