import {
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  type AIAuditRecordInput,
  type AlphaJournalAuditRecord,
  type AlphaJournalAuditTranslationContext,
} from "../../contracts";

function safeCode(value: string, index: number): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "_").slice(0, 180);
  return normalized.length === 0 ? `JOURNAL_REASON_${String(index + 1)}` : normalized;
}

export function auditRecordFromAlphaJournal(
  source: Readonly<AlphaJournalAuditRecord>,
  context: Readonly<AlphaJournalAuditTranslationContext>,
): AIAuditRecordInput {
  return {
    schemaVersion: "1.0",
    recordId: source.auditId,
    idempotencyKey: context.idempotencyKey,
    recordType: AIAuditRecordType.JournalEntry,
    sourceSubsystem: AIAuditSourceSubsystem.Journal,
    sourceRecordId: source.sourceRecordId,
    sourceRecordVersion: "1.0",
    timestamp: source.timestamp,
    correlationId: source.correlationId,
    traceId: source.traceId,
    parentAuditRecordIds: structuredClone(context.parentAuditRecordIds),
    relatedAuditRecordIds: structuredClone(context.relatedAuditRecordIds),
    ledgerEntryIds: [],
    policyVersions: structuredClone(source.policyVersions),
    status: source.status,
    reasonCodes: source.reasonCodes.map(safeCode),
    actor: structuredClone(context.actor),
    privacyLevel: source.privacyLevel,
    retention: source.retention,
    metadata: {
      ...structuredClone(source.metadata),
      journal_operation: source.operationType,
      journal_entry_id: source.entryId ?? null,
    },
    payloadIntegrityReference: `journal:${source.sourceRecordId}`,
    sourceAuditReferences: [source.auditId],
    finalOutcome: source.status,
  };
}
