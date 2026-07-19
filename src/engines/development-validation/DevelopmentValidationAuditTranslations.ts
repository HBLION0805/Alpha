import {
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  DevelopmentActorType,
  DevelopmentOwnerDecision,
  type AIAuditOwnerApproval,
  type AIAuditRecordInput,
  type DevelopmentAuditTranslationContext,
  type DevelopmentValidationRecord,
} from "../../contracts";

function safeCode(value: string, index: number): string { const normalized = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "_").slice(0, 180); return normalized.length === 0 ? `DEVELOPMENT_REASON_${String(index + 1)}` : normalized; }
function ownerApproval(source: DevelopmentValidationRecord): AIAuditOwnerApproval | undefined { const approval = source.ownerApproval; if (approval === undefined) return undefined; const decision = approval.decision === DevelopmentOwnerDecision.Approved ? "APPROVED" : approval.decision === DevelopmentOwnerDecision.ApprovedWithConditions ? "APPROVED_WITH_CONDITIONS" : "REJECTED"; return { approvalId: approval.approvalId, ownerReference: approval.ownerReference, approvedSubject: source.taskId, decision, conditions: structuredClone(approval.conditions), reason: approval.reason, ...(approval.gitReference === undefined ? {} : { gitReference: approval.gitReference }) }; }

export function auditRecordFromDevelopmentValidation(source: Readonly<DevelopmentValidationRecord>, context: Readonly<DevelopmentAuditTranslationContext>): AIAuditRecordInput {
  const approval = ownerApproval(source);
  const reasonCodes = [source.recordType, ...source.failures.map((failure) => failure.category), ...source.validationChecks.filter((check) => check.blocksApproval).map((check) => check.checkId)].map(safeCode);
  return { schemaVersion: "1.0", recordId: `development-audit:${source.recordId}`, idempotencyKey: context.idempotencyKey, recordType: AIAuditRecordType.DevelopmentValidation, sourceSubsystem: AIAuditSourceSubsystem.DevelopmentValidation, sourceRecordId: source.recordId, sourceRecordVersion: String(source.sequence), timestamp: source.timestamp, requestId: source.taskId, correlationId: source.correlationId, traceId: source.traceId, parentAuditRecordIds: structuredClone(context.parentAuditRecordIds), relatedAuditRecordIds: structuredClone(context.relatedAuditRecordIds), ledgerEntryIds: [], policyVersions: structuredClone(source.policyVersions), status: source.status, reasonCodes, actor: structuredClone(context.actor), ...(approval === undefined ? {} : { ownerApproval: approval }), privacyLevel: source.privacyLevel, retention: source.retention, metadata: { ...structuredClone(source.metadata), development_record_type: source.recordType, development_project_day: source.projectDay, development_actor_type: source.actorType, development_file_change_count: source.fileChanges.length, development_test_run_count: source.testRuns.length, development_defect_count: source.defects.length, development_follow_up_count: source.followUps.length, owner_action: source.actorType === DevelopmentActorType.Owner }, payloadIntegrityReference: source.payloadFingerprint, sourceAuditReferences: structuredClone(source.sourceAuditReferences), finalOutcome: source.status };
}
