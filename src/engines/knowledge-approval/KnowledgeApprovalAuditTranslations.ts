import {
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  KnowledgeActorType,
  KnowledgeAuditOperationType,
  type AIAuditOwnerApproval,
  type AIAuditRecordInput,
  type KnowledgeAuditEvent,
  type KnowledgeAuditTranslationContext,
} from "../../contracts";

function ownerApproval(source: Readonly<KnowledgeAuditEvent>): AIAuditOwnerApproval | undefined {
  if (source.operationType !== KnowledgeAuditOperationType.CandidateApproved || source.actor.actorType !== KnowledgeActorType.Owner) return undefined;
  return {
    approvalId: source.auditId,
    ownerReference: source.actor.actorId,
    approvedSubject: source.sourceRecordId,
    decision: "APPROVED",
    conditions: [],
    reason: "Owner approved Candidate Knowledge under the recorded policy versions.",
  };
}

export function auditRecordFromKnowledgeApproval(
  source: Readonly<KnowledgeAuditEvent>,
  context: Readonly<KnowledgeAuditTranslationContext>,
): AIAuditRecordInput {
  const approval = ownerApproval(source);
  return {
    schemaVersion: "1.0",
    recordId: source.auditId,
    idempotencyKey: context.idempotencyKey,
    recordType: AIAuditRecordType.LearningReview,
    sourceSubsystem: AIAuditSourceSubsystem.LearningLoop,
    sourceRecordId: source.sourceRecordId,
    sourceRecordVersion: source.sourceRecordVersion,
    timestamp: source.timestamp,
    correlationId: source.trace.correlationId,
    traceId: source.trace.traceId,
    parentAuditRecordIds: structuredClone(context.parentAuditRecordIds),
    relatedAuditRecordIds: structuredClone(context.relatedAuditRecordIds),
    ledgerEntryIds: [],
    policyVersions: structuredClone(source.policyVersions),
    status: source.status,
    reasonCodes: structuredClone(source.reasonCodes),
    actor: structuredClone(context.actor),
    ...(approval === undefined ? {} : { ownerApproval: approval }),
    privacyLevel: source.privacyLevel,
    retention: source.retention,
    metadata: {
      ...structuredClone(source.metadata),
      knowledge_operation: source.operationType,
      knowledge_actor_type: source.actor.actorType,
    },
    sourceAuditReferences: structuredClone(source.trace.auditReferenceIds),
    finalOutcome: source.status,
  };
}
