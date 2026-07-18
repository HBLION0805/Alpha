import {
  AICostLedgerAuditOperationType,
  AIAuditRecordType,
  AIAuditSourceSubsystem,
  type AIAuditMetadata,
  type AIAuditNormalizedError,
  type AIAuditRecordInput,
  type AIAuditTranslationContext,
  type AICostLedgerAuditRecord,
  type AIExecutionAuditRecord,
  type AIReservationAuditRecord,
  type CostAuditRecord,
  type RoutingAuditRecord,
} from "../../contracts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizedError(
  error: Readonly<{
    category: string;
    code: string;
    safeMessage: string;
    retryable: boolean;
    occurredAt: string;
  }> | undefined,
): AIAuditNormalizedError | undefined {
  return error === undefined
    ? undefined
    : {
        category: error.category,
        code: error.code,
        safeMessage: error.safeMessage,
        retryable: error.retryable,
        occurredAt: error.occurredAt,
      };
}

function safeCode(value: string, index: number): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._:-]+/g, "_").slice(0, 180);
  return normalized.length > 0 ? normalized : `SOURCE_REASON_${index + 1}`;
}

function reasonMetadata(reasons: ReadonlyArray<string>): AIAuditMetadata {
  return Object.fromEntries(reasons.map((reason, index) => [`source_reason_${index + 1}`, reason]));
}

function unique(values: ReadonlyArray<string | undefined>): ReadonlyArray<string> {
  return [...new Set(values.filter((value): value is string => value !== undefined))];
}

function base(
  context: Readonly<AIAuditTranslationContext>,
  source: {
    auditId: string;
    timestamp: string;
    requestId?: string;
  },
): Pick<
  AIAuditRecordInput,
  | "schemaVersion"
  | "recordId"
  | "idempotencyKey"
  | "sourceRecordId"
  | "sourceRecordVersion"
  | "timestamp"
  | "requestId"
  | "correlationId"
  | "traceId"
  | "parentAuditRecordIds"
  | "relatedAuditRecordIds"
  | "actor"
  | "privacyLevel"
  | "retention"
  | "payloadIntegrityReference"
> {
  return {
    schemaVersion: "1.0",
    recordId: source.auditId,
    idempotencyKey: context.idempotencyKey,
    sourceRecordId: source.auditId,
    sourceRecordVersion: context.sourceRecordVersion ?? "1.0",
    timestamp: source.timestamp,
    ...(source.requestId === undefined ? {} : { requestId: source.requestId }),
    correlationId: context.correlationId,
    traceId: context.traceId,
    parentAuditRecordIds: clone(context.parentAuditRecordIds),
    relatedAuditRecordIds: clone(context.relatedAuditRecordIds),
    actor: clone(context.actor),
    privacyLevel: context.privacyLevel,
    retention: context.retention,
    payloadIntegrityReference: `source-audit:${source.auditId}`,
  };
}

export function auditRecordFromRoutingAudit(
  source: Readonly<RoutingAuditRecord>,
  context: Readonly<AIAuditTranslationContext>,
): AIAuditRecordInput {
  const reasons = [source.routingReason.summary, ...source.routingReason.reasonCodes];
  return {
    ...base(context, source),
    recordType: AIAuditRecordType.RoutingDecision,
    sourceSubsystem: AIAuditSourceSubsystem.Router,
    routingDecisionId: source.decisionId,
    ledgerEntryIds: [],
    ...(source.selectedProviderId === undefined ? {} : { providerId: source.selectedProviderId }),
    ...(source.selectedModelId === undefined ? {} : { modelId: source.selectedModelId }),
    taskType: source.taskType,
    policyVersions: {
      routing: source.policyVersion,
      registry: source.registryVersion,
      budget: source.budgetPolicyVersion,
    },
    status: source.finalStatus,
    reasonCodes: reasons.map(safeCode),
    ...(source.failure === undefined ? {} : { error: normalizedError(source.failure) as AIAuditNormalizedError }),
    metadata: {
      ...clone(context.metadata ?? {}),
      ...reasonMetadata(reasons),
      required_capability_count: source.requiredCapabilities.length,
      eligible_candidate_count: source.eligibleCandidates.length,
      rejected_candidate_count: source.rejectedCandidates.length,
      fallback_count: source.fallbackCount,
      retry_count: source.retryCount,
      estimated_cost: source.estimatedCost.estimatedTotalCost.toString(),
      estimated_cost_currency: source.estimatedCost.currency,
      reasoning_level: source.reasoningLevel,
      context_fingerprint: source.contextFingerprint,
      deterministic_handler_id: source.deterministicHandlerId ?? null,
    },
    sourceAuditReferences: [source.auditId],
    finalOutcome: source.finalStatus,
  };
}

export function auditRecordFromCostGovernorAudit(
  source: Readonly<CostAuditRecord>,
  context: Readonly<AIAuditTranslationContext>,
): AIAuditRecordInput {
  const reasons = source.decisionReasons.map(String);
  return {
    ...base(context, source),
    recordType: AIAuditRecordType.CostGovernorDecision,
    sourceSubsystem: AIAuditSourceSubsystem.CostGovernor,
    budgetDecisionId: source.decisionId,
    ...(source.reservation === undefined ? {} : { reservationId: source.reservation.reservationId }),
    ledgerEntryIds: [],
    policyVersions: { budget: source.policyVersion },
    status: source.decisionStatus,
    reasonCodes: reasons.map(safeCode),
    ...(source.error === undefined ? {} : { error: normalizedError(source.error) as AIAuditNormalizedError }),
    metadata: {
      ...clone(context.metadata ?? {}),
      ...reasonMetadata(reasons),
      estimated_minor_units: source.estimatedCost.minorUnits,
      currency: source.estimatedCost.currency,
      scope_evaluation_count: source.scopeEvaluations.length,
      unavailable_scope_count: source.unavailableScopes.length,
      low_cost_required: source.lowCostRequired,
      override_reference: source.overrideAuthorizationId ?? null,
    },
    sourceAuditReferences: [source.auditId],
    finalOutcome: source.finalResult,
  };
}

export function auditRecordFromReservationAudit(
  source: Readonly<AIReservationAuditRecord>,
  context: Readonly<AIAuditTranslationContext>,
): AIAuditRecordInput {
  const reasons = source.decisionReasons.map(String);
  return {
    ...base(context, source),
    recordType: AIAuditRecordType.ReservationOperation,
    sourceSubsystem: AIAuditSourceSubsystem.ReservationManager,
    reservationId: source.reservationId,
    ledgerEntryIds: [],
    policyVersions: { reservation: source.policyVersion },
    status: source.operationType,
    reasonCodes: reasons.map(safeCode),
    ...(source.error === undefined ? {} : { error: normalizedError(source.error) as AIAuditNormalizedError }),
    metadata: {
      ...clone(context.metadata ?? {}),
      ...reasonMetadata(reasons),
      operation_id: source.operationId,
      source_idempotency_key: source.idempotencyKey,
      state_before: source.stateBefore,
      state_after: source.stateAfter,
      version_before: source.versionBefore,
      version_after: source.versionAfter,
      reserved_minor_units: source.reservedAmount.minorUnits,
      committed_minor_units: source.committedAmount.minorUnits,
      released_minor_units: source.releasedAmount.minorUnits,
      remaining_minor_units: source.remainingAmount.minorUnits,
      currency: source.reservedAmount.currency,
      validation_check_count: source.validationChecks.length,
      ledger_instruction_id: source.ledgerInstructionId ?? null,
    },
    sourceAuditReferences: [source.auditId],
    finalOutcome: source.finalResult,
  };
}

export function auditRecordFromExecutionAudit(
  source: Readonly<AIExecutionAuditRecord>,
  context: Readonly<AIAuditTranslationContext>,
): AIAuditRecordInput {
  const reasons = [source.outputStatus, source.retryPlan.action];
  return {
    ...base(context, source),
    correlationId: source.correlationId ?? context.correlationId,
    traceId: source.traceId,
    recordType: AIAuditRecordType.ExecutionCoordinatorResult,
    sourceSubsystem: AIAuditSourceSubsystem.ExecutionCoordinator,
    routingDecisionId: source.routingDecisionId,
    budgetDecisionId: source.costGovernorDecisionId,
    ...(source.reservationId === undefined ? {} : { reservationId: source.reservationId }),
    executionId: source.executionId,
    ledgerEntryIds: [],
    ...(source.selectedProviderId === undefined ? {} : { providerId: source.selectedProviderId }),
    ...(source.selectedModelId === undefined ? {} : { modelId: source.selectedModelId }),
    policyVersions: {
      routing: source.routingPolicyVersion,
      budget: source.budgetPolicyVersion,
    },
    status: source.outputStatus,
    reasonCodes: reasons.map(safeCode),
    ...(source.error === undefined ? {} : { error: normalizedError(source.error) as AIAuditNormalizedError }),
    metadata: {
      ...clone(context.metadata ?? {}),
      ...reasonMetadata(reasons),
      cost_governor_status: source.costGovernorStatus,
      attempt_count: source.attempts.length,
      latency_ms: source.latencyMs ?? null,
      reported_cost_minor_units: source.reportedCost?.minorUnits ?? null,
      reported_cost_currency: source.reportedCost?.currency ?? null,
      retry_action: source.retryPlan.action,
      retryable: source.retryPlan.retryable,
      reservation_instruction_count: source.reservationInstructions.length,
      settlement_instruction_count: source.usageSettlementInstructions.length,
      adapter_id: source.adapterDescriptor?.adapterId ?? null,
      adapter_version: source.adapterDescriptor?.version ?? null,
    },
    sourceAuditReferences: [source.auditId],
    finalOutcome: source.finalResult,
  };
}

export function auditRecordFromCostLedgerAudit(
  source: Readonly<AICostLedgerAuditRecord>,
  context: Readonly<AIAuditTranslationContext>,
): AIAuditRecordInput {
  const reasons = source.reconciliationIssues.map((value) => String(value.code));
  return {
    ...base(context, source),
    recordType: source.operationType === AICostLedgerAuditOperationType.Append
      ? AIAuditRecordType.CostLedgerAppend
      : AIAuditRecordType.CostLedgerReconciliation,
    sourceSubsystem: AIAuditSourceSubsystem.CostLedger,
    ...(source.reservationId === undefined ? {} : { reservationId: source.reservationId }),
    ledgerEntryIds: source.requestedEntryId === undefined ? [] : [source.requestedEntryId],
    policyVersions: { ledger: source.policyVersion },
    status: source.appendStatus ?? source.operationType,
    reasonCodes: reasons.map(safeCode),
    ...(source.error === undefined ? {} : { error: normalizedError(source.error) as AIAuditNormalizedError }),
    metadata: {
      ...clone(context.metadata ?? {}),
      ...reasonMetadata(reasons),
      operation_id: source.operationId,
      source_subsystem: source.sourceSubsystem,
      idempotency_outcome: source.idempotencyOutcome,
      assigned_sequence: source.assignedSequence ?? null,
      repository_type: source.repositoryType,
      resulting_balance_count: source.resultingBalances.length,
      reconciliation_issue_count: source.reconciliationIssues.length,
    },
    sourceAuditReferences: unique([source.auditId, ...source.sourceAuditReferences]),
    finalOutcome: source.finalResult,
  };
}
