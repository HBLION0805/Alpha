import {
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  type AIAuditRecordInput,
  type EvidenceFusionAssessment,
  type EvidenceFusionAuditTranslationContext,
} from "../../contracts";

/** Deterministic translation only; Unified Audit remains the persistence authority. */
export function auditRecordFromEvidenceFusionAssessment(
  assessment: Readonly<EvidenceFusionAssessment>,
  context: Readonly<EvidenceFusionAuditTranslationContext>,
): AIAuditRecordInput {
  const snapshot = assessment.snapshot;
  const reasons = [...snapshot.blockers.map((entry) => entry.code), ...snapshot.contradictions.map((entry) => entry.sourceCode), ...snapshot.warnings.map((entry) => entry.sourceCode ?? entry.code)].sort();
  return {
    schemaVersion: "1.0",
    recordId: context.recordId,
    idempotencyKey: context.idempotencyKey,
    recordType: AIAuditRecordType.EvidenceFusionAssessment,
    sourceSubsystem: AIAuditSourceSubsystem.EvidenceFusion,
    sourceRecordId: assessment.assessmentId,
    sourceRecordVersion: assessment.schemaVersion,
    timestamp: assessment.createdAt,
    correlationId: snapshot.trace.correlationId,
    traceId: snapshot.trace.traceId,
    parentAuditRecordIds: structuredClone(context.parentAuditRecordIds),
    relatedAuditRecordIds: structuredClone(context.relatedAuditRecordIds),
    ledgerEntryIds: [],
    policyVersions: { evidence_fusion_policy: snapshot.policyVersion, evidence_fusion_rules: snapshot.ruleSetVersion },
    status: assessment.status,
    reasonCodes: [...new Set(reasons)],
    actor: structuredClone(context.actor),
    privacyLevel: context.privacyLevel,
    retention: context.retention,
    metadata: {
      ...structuredClone(context.metadata ?? {}),
      fusion_quality: snapshot.quality,
      fusion_completeness: snapshot.completeness,
      fusion_freshness: snapshot.freshness,
      source_count: snapshot.provenance.length,
      evidence_reference_count: snapshot.evidenceReferences.length,
      blocker_count: snapshot.blockers.length,
      contradiction_count: snapshot.contradictions.length,
      warning_count: snapshot.warnings.length,
    },
    payloadIntegrityReference: snapshot.fingerprint,
    sourceAuditReferences: structuredClone(snapshot.trace.auditReferenceIds),
    finalOutcome: assessment.status,
  };
}
