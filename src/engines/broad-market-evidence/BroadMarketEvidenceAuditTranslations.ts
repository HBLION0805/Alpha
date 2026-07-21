import {
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  type AIAuditRecordInput,
  type BroadMarketEvidenceAssessment,
  type BroadMarketEvidenceAuditTranslationContext,
} from "../../contracts";

/** Deterministic translation only; persistence remains owned by Unified Audit Repository. */
export function auditRecordFromBroadMarketEvidenceAssessment(
  assessment: Readonly<BroadMarketEvidenceAssessment>,
  context: Readonly<BroadMarketEvidenceAuditTranslationContext>,
): AIAuditRecordInput {
  return {
    schemaVersion: "1.0",
    recordId: context.recordId,
    idempotencyKey: context.idempotencyKey,
    recordType: AIAuditRecordType.BroadMarketEvidenceAssessment,
    sourceSubsystem: AIAuditSourceSubsystem.BroadMarketEvidence,
    sourceRecordId: assessment.assessmentId,
    sourceRecordVersion: assessment.schemaVersion,
    timestamp: assessment.createdAt,
    correlationId: assessment.trace.correlationId,
    traceId: assessment.trace.traceId,
    parentAuditRecordIds: structuredClone(context.parentAuditRecordIds),
    relatedAuditRecordIds: structuredClone(context.relatedAuditRecordIds),
    ledgerEntryIds: [],
    policyVersions: {
      broad_market_evidence_policy: assessment.policyVersion,
      broad_market_evidence_rules: assessment.ruleSetVersion,
      broad_market_feature_calculation: assessment.featureCalculationVersion,
    },
    status: assessment.quality,
    reasonCodes: [...new Set([...assessment.issues, ...assessment.warnings].map((entry) => entry.code))].sort(),
    actor: structuredClone(context.actor),
    privacyLevel: context.privacyLevel,
    retention: context.retention,
    metadata: {
      ...structuredClone(context.metadata ?? {}),
      evidence_strength: assessment.evidenceStrength,
      total_benchmark_count: assessment.aggregateFacts.totalBenchmarkCount,
      accepted_benchmark_count: assessment.aggregateFacts.acceptedBenchmarkCount,
      missing_benchmark_count: assessment.aggregateFacts.missingBenchmarkCount,
      stale_benchmark_count: assessment.aggregateFacts.staleBenchmarkCount,
      issue_count: assessment.issues.length,
      warning_count: assessment.warnings.length,
    },
    payloadIntegrityReference: assessment.inputSnapshotFingerprint,
    sourceAuditReferences: structuredClone(assessment.trace.auditReferenceIds),
    finalOutcome: assessment.quality,
  };
}
