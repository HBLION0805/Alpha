import {
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  type AIAuditRecordInput,
  type MarketRegimeAssessment,
  type MarketRegimeAuditTranslationContext,
} from "../../contracts";

/** Deterministic translation only; persistence remains owned by Unified Audit Repository. */
export function auditRecordFromMarketRegimeAssessment(
  assessment: Readonly<MarketRegimeAssessment>,
  context: Readonly<MarketRegimeAuditTranslationContext>,
): AIAuditRecordInput {
  return {
    schemaVersion: "1.0",
    recordId: context.recordId,
    idempotencyKey: context.idempotencyKey,
    recordType: AIAuditRecordType.MarketRegimeAssessment,
    sourceSubsystem: AIAuditSourceSubsystem.MarketRegimeEngine,
    sourceRecordId: assessment.assessmentId,
    sourceRecordVersion: assessment.schemaVersion,
    timestamp: assessment.createdAt,
    correlationId: assessment.trace.correlationId,
    traceId: assessment.trace.traceId,
    parentAuditRecordIds: structuredClone(context.parentAuditRecordIds),
    relatedAuditRecordIds: structuredClone(context.relatedAuditRecordIds),
    ledgerEntryIds: [],
    policyVersions: {
      market_regime_policy: assessment.policyVersion,
      market_regime_rules: assessment.ruleSetVersion,
    },
    status: assessment.primaryRegime,
    reasonCodes: structuredClone(assessment.reasonCodes),
    actor: structuredClone(context.actor),
    privacyLevel: context.privacyLevel,
    retention: context.retention,
    metadata: {
      ...structuredClone(context.metadata ?? {}),
      benchmark_instrument_id: assessment.benchmarkInstrumentId ?? null,
      evidence_strength: assessment.evidenceStrength,
      secondary_condition_count: assessment.secondaryConditions.length,
      unresolved_requirement_count: assessment.unresolvedRequirements.length,
      data_quality_status: assessment.dataQualityStatus,
    },
    payloadIntegrityReference: assessment.inputSnapshotFingerprint,
    sourceAuditReferences: structuredClone(assessment.trace.auditReferenceIds),
    finalOutcome: assessment.primaryRegime,
  };
}
