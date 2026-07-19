import {
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  type EventReplayAuditRecord,
  type EventReplayAuditTranslation,
  type EventReplayAuditTranslationContext,
} from "../../contracts";

export function translateEventReplayAuditRecord(source: EventReplayAuditRecord, context: EventReplayAuditTranslationContext): EventReplayAuditTranslation {
  return {
    source,
    input: {
      schemaVersion: "1.0",
      recordId: source.auditId,
      idempotencyKey: context.idempotencyKey,
      recordType: AIAuditRecordType.EventReplay,
      sourceSubsystem: AIAuditSourceSubsystem.EventReplay,
      sourceRecordId: source.sourceRecordId,
      ...(source.recordVersion === undefined ? {} : { sourceRecordVersion: source.recordVersion }),
      timestamp: source.timestamp,
      correlationId: source.correlationId,
      traceId: source.traceId,
      parentAuditRecordIds: context.parentAuditRecordIds,
      relatedAuditRecordIds: context.relatedAuditRecordIds,
      ledgerEntryIds: [],
      policyVersions: source.policyVersions,
      status: source.status,
      reasonCodes: source.reasonCodes,
      actor: context.actor,
      privacyLevel: source.privacyLevel,
      retention: source.retention,
      metadata: source.metadata,
      ...(source.statistics === undefined ? {} : { payloadIntegrityReference: `${source.operationType}:${source.qualityStatus ?? "UNKNOWN"}:${String(source.statistics.completenessScore)}` }),
      sourceAuditReferences: [],
      finalOutcome: source.status,
    },
  };
}
