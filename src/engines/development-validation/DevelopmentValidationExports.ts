import {
  DevelopmentExportDestination,
  DevelopmentExportFormat,
  DevelopmentExportStatus,
  DevelopmentValidationErrorCategory,
  PrivacyLevel,
  canonicalizeDevelopmentValue,
  type DevelopmentExportPolicy,
  type DevelopmentExportRequest,
  type DevelopmentExportResult,
  type DevelopmentValidationError,
} from "../../contracts";
import type { DevelopmentValidationRepository } from "../../repositories";

function rejected(request: DevelopmentExportRequest, category: DevelopmentValidationErrorCategory, message: string): DevelopmentExportResult {
  const error: DevelopmentValidationError = { category, message };
  return { status: DevelopmentExportStatus.Rejected, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: 0, error };
}

export function exportDevelopmentValidation(repository: DevelopmentValidationRepository, request: DevelopmentExportRequest, policy: DevelopmentExportPolicy): DevelopmentExportResult {
  const records = repository.query(request.query);
  if (request.destination === DevelopmentExportDestination.ExternalTransfer) {
    if (!policy.allowExternalExports) return rejected(request, DevelopmentValidationErrorCategory.ExportRestricted, "external development validation exports are disabled.");
    if (records.some((record) => record.privacyLevel === PrivacyLevel.LocalOnly)) return rejected(request, DevelopmentValidationErrorCategory.ExportRestricted, "LOCAL_ONLY development validation evidence cannot be externally exported.");
    if (policy.requireSensitiveAuthorization && records.some((record) => record.privacyLevel === PrivacyLevel.Sensitive) && (request.sensitiveAuthorizationReference === undefined || !policy.sensitiveAuthorizationReferences.includes(request.sensitiveAuthorizationReference))) return rejected(request, DevelopmentValidationErrorCategory.SensitiveExportUnauthorized, "sensitive development validation export requires authorization.");
  }
  const content = request.format === DevelopmentExportFormat.Json ? JSON.stringify(records, null, 2) : records.map(canonicalizeDevelopmentValue).join("\n") + (records.length === 0 ? "" : "\n");
  return { status: DevelopmentExportStatus.Exported, exportId: request.exportId, exportedAt: request.requestedAt, format: request.format, recordCount: records.length, content };
}
