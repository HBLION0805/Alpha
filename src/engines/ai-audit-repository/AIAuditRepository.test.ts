import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AICostLedgerAuditOperationType,
  AICostLedgerRepositoryType,
  AICostLedgerSourceSubsystem,
  AIAuditActorType,
  AIAuditAppendStatus,
  AIAuditExportDestination,
  AIAuditExportFormat,
  AIAuditExportStatus,
  AIAuditImportOrderStatus,
  AIAuditIntegrityIssueCode,
  AIAuditIntegrityStatus,
  AIAuditRecordType,
  AIAuditRepositoryErrorCategory,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  AIAuditTraceStatus,
  AITaskType,
  PrivacyLevel,
  type AIAuditPolicy,
  type AIAuditRecordInput,
  type AIAuditTranslationContext,
  type AICostLedgerAuditRecord,
  type AIExecutionAuditRecord,
  type AIReservationAuditRecord,
  type CostAuditRecord,
  type RoutingAuditRecord,
} from "../../contracts";
import {
  AIAuditRepositoryCorruptionError,
  AIAuditRepositoryPathError,
  InMemoryAIAuditRepository,
  LocalNdjsonAIAuditRepository,
} from "../../repositories";
import {
  DeterministicAIAuditRepository,
  auditRecordFromCostGovernorAudit,
  auditRecordFromCostLedgerAudit,
  auditRecordFromExecutionAudit,
  auditRecordFromReservationAudit,
  auditRecordFromRoutingAudit,
} from "./index";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

const policy: AIAuditPolicy = {
  policyId: "audit-policy",
  version: "audit-v1",
  requireUniqueSourceIdentity: true,
  allowStaleImports: false,
  rejectSecretMetadataKeys: true,
  preventPrivacyDowngrade: true,
  allowExternalExports: true,
  requireSensitiveExportAuthorization: true,
  sensitiveExportAuthorizationReferences: ["owner-export-approval"],
};

const context: AIAuditTranslationContext = {
  idempotencyKey: "translated-idem",
  correlationId: "corr-1",
  traceId: "trace-1",
  parentAuditRecordIds: [],
  relatedAuditRecordIds: [],
  privacyLevel: PrivacyLevel.Internal,
  retention: AIAuditRetentionClassification.LongTerm,
  actor: { type: AIAuditActorType.AlphaSubsystem, actorId: "alpha" },
};

function record(
  suffix = "1",
  overrides: Partial<AIAuditRecordInput> = {},
): AIAuditRecordInput {
  return {
    schemaVersion: "1.0",
    recordId: `audit-${suffix}`,
    idempotencyKey: `idem-${suffix}`,
    recordType: AIAuditRecordType.SystemValidation,
    sourceSubsystem: AIAuditSourceSubsystem.AuditRepository,
    sourceRecordId: `source-${suffix}`,
    sourceRecordVersion: "v1",
    timestamp: "2026-07-18T20:00:00.000Z",
    requestId: "request-1",
    correlationId: "corr-1",
    traceId: "trace-1",
    parentAuditRecordIds: [],
    relatedAuditRecordIds: [],
    ledgerEntryIds: [],
    providerId: "provider-safe",
    modelId: "model-safe",
    taskType: AITaskType.GeneralChat,
    policyVersions: { audit: "v1" },
    status: "VALID",
    reasonCodes: ["VALIDATED"],
    actor: { type: AIAuditActorType.System },
    privacyLevel: PrivacyLevel.Internal,
    retention: AIAuditRetentionClassification.Standard,
    metadata: { test_case: suffix },
    payloadIntegrityReference: `integrity-${suffix}`,
    sourceAuditReferences: [`source-audit-${suffix}`],
    finalOutcome: "VALID",
    ...overrides,
  };
}

function append(
  service: DeterministicAIAuditRepository,
  input: AIAuditRecordInput,
  selectedPolicy: AIAuditPolicy = policy,
) {
  return service.append({ record: input, policy: selectedPolicy });
}

function service(): DeterministicAIAuditRepository {
  return new DeterministicAIAuditRepository(new InMemoryAIAuditRepository());
}

function routerAudit(): RoutingAuditRecord {
  return {
    auditId: "router-audit-1",
    requestId: "request-1",
    decisionId: "route-1",
    timestamp: "2026-07-18T20:00:00.000Z",
    taskType: AITaskType.GeneralChat,
    requiredCapabilities: [],
    reasoningLevel: "LOW",
    privacyLevel: PrivacyLevel.Internal,
    contextFingerprint: "context-safe",
    eligibleCandidates: [{ providerId: "provider-safe", modelId: "model-safe" }],
    rejectedCandidates: [],
    selectedProviderId: "provider-safe",
    selectedModelId: "model-safe",
    routingReason: {
      summary: "Best eligible candidate",
      reasonCodes: ["BEST_ELIGIBLE"],
      satisfiedConstraints: [],
      observedAt: "2026-07-18T20:00:00.000Z",
      rateLimited: false,
      source: "registry",
    },
    policyVersion: "router-v1",
    registryVersion: "registry-v1",
    budgetPolicyVersion: "budget-v1",
    estimatedCost: {
      currency: "USD",
      estimatedInputCost: 0.001,
      estimatedOutputCost: 0.002,
      estimatedFixedCost: 0,
      estimatedTotalCost: 0.003,
      pricingVersion: "pricing-v1",
    },
    finalStatus: "SELECTED",
    fallbackPlan: [],
    attempts: [],
    retryCount: 0,
    fallbackCount: 0,
  } as unknown as RoutingAuditRecord;
}

function costAudit(): CostAuditRecord {
  return {
    auditId: "cost-audit-1",
    decisionId: "cost-1",
    requestId: "request-1",
    timestamp: "2026-07-18T20:00:01.000Z",
    policyVersion: "budget-v1",
    estimatedCost: { minorUnits: 3, currency: "USD" },
    scopeEvaluations: [],
    unavailableScopes: [],
    decisionStatus: "ALLOWED",
    decisionReasons: ["WITHIN_BUDGET"],
    lowCostRequired: false,
    finalResult: "ALLOWED",
  } as unknown as CostAuditRecord;
}

function reservationAudit(): AIReservationAuditRecord {
  return {
    auditId: "reservation-audit-1",
    reservationId: "reservation-1",
    requestId: "request-1",
    operationId: "reservation-operation-1",
    operationType: "ACQUIRE",
    timestamp: "2026-07-18T20:00:02.000Z",
    idempotencyKey: "reservation-source-idem",
    policyVersion: "reservation-v1",
    stateBefore: null,
    stateAfter: "RESERVED",
    versionBefore: null,
    versionAfter: 1,
    reservedAmount: { minorUnits: 3, currency: "USD" },
    committedAmount: { minorUnits: 0, currency: "USD" },
    releasedAmount: { minorUnits: 0, currency: "USD" },
    remainingAmount: { minorUnits: 3, currency: "USD" },
    validationChecks: [],
    decisionReasons: ["RESERVATION_ACQUIRED"],
    ledgerInstructionId: "ledger-instruction-1",
    finalResult: "APPLIED",
  } as unknown as AIReservationAuditRecord;
}

function executionAudit(): AIExecutionAuditRecord {
  return {
    auditId: "execution-audit-1",
    executionId: "execution-1",
    requestId: "request-1",
    traceId: "trace-1",
    correlationId: "corr-1",
    timestamp: "2026-07-18T20:00:03.000Z",
    routingDecisionId: "route-1",
    selectedProviderId: "provider-safe",
    selectedModelId: "model-safe",
    routingPolicyVersion: "router-v1",
    costGovernorDecisionId: "cost-1",
    costGovernorStatus: "ALLOWED",
    budgetPolicyVersion: "budget-v1",
    reservationId: "reservation-1",
    preconditionChecks: [],
    attempts: [],
    outputStatus: "EXECUTION_SUCCEEDED",
    retryPlan: { action: "NO_RETRY", reason: "Complete", currentAttempt: 1, remainingAttempts: 0, retryable: false },
    reservationInstructions: [],
    usageSettlementInstructions: [],
    finalResult: "SUCCEEDED",
  } as unknown as AIExecutionAuditRecord;
}

function ledgerAudit(operationType = AICostLedgerAuditOperationType.Append): AICostLedgerAuditRecord {
  return {
    auditId: `ledger-audit-${operationType}`,
    operationType,
    operationId: `ledger-operation-${operationType}`,
    timestamp: "2026-07-18T20:00:04.000Z",
    sourceSubsystem: AICostLedgerSourceSubsystem.ReservationManager,
    policyVersion: "ledger-v1",
    requestedEntryId: "ledger-entry-1",
    reservationId: "reservation-1",
    validationChecks: [],
    idempotencyOutcome: "NEW",
    assignedSequence: 1,
    repositoryType: AICostLedgerRepositoryType.InMemory,
    resultingBalances: [],
    reconciliationIssues: [],
    sourceAuditReferences: ["reservation-audit-1"],
    finalResult: operationType === AICostLedgerAuditOperationType.Append ? "APPLIED" : "RECONCILED",
  } as AICostLedgerAuditRecord;
}

const tests: TestCase[] = [
  { name: "Router translation appends", run: () => {
    const translated = auditRecordFromRoutingAudit(routerAudit(), context);
    assertEqual(append(service(), translated).status, AIAuditAppendStatus.Appended, "router append");
    assertEqual(translated.routingDecisionId, "route-1", "routing reference");
  } },
  { name: "Cost Governor translation appends", run: () => {
    const translated = auditRecordFromCostGovernorAudit(costAudit(), { ...context, idempotencyKey: "cost-translation" });
    const result = append(service(), translated);
    assertEqual(result.status, AIAuditAppendStatus.Appended, `cost append ${result.error?.safeMessage ?? ""}`);
    assertEqual(translated.budgetDecisionId, "cost-1", "cost reference");
  } },
  { name: "Reservation translation appends", run: () => {
    const translated = auditRecordFromReservationAudit(reservationAudit(), { ...context, idempotencyKey: "reservation-translation" });
    assertEqual(append(service(), translated).status, AIAuditAppendStatus.Appended, "reservation append");
    assertEqual(translated.reservationId, "reservation-1", "reservation reference");
  } },
  { name: "Execution translation appends", run: () => {
    const translated = auditRecordFromExecutionAudit(executionAudit(), { ...context, idempotencyKey: "execution-translation" });
    assertEqual(append(service(), translated).status, AIAuditAppendStatus.Appended, "execution append");
    assertEqual(translated.executionId, "execution-1", "execution reference");
  } },
  { name: "Cost Ledger append translation appends", run: () => {
    const translated = auditRecordFromCostLedgerAudit(ledgerAudit(), { ...context, idempotencyKey: "ledger-translation" });
    assertEqual(append(service(), translated).status, AIAuditAppendStatus.Appended, "ledger append");
    assertEqual(translated.recordType, AIAuditRecordType.CostLedgerAppend, "ledger type");
  } },
  { name: "Cost Ledger reconciliation translation selects reconciliation type", run: () => {
    const translated = auditRecordFromCostLedgerAudit(ledgerAudit(AICostLedgerAuditOperationType.Reconcile), { ...context, idempotencyKey: "reconcile-translation" });
    assertEqual(translated.recordType, AIAuditRecordType.CostLedgerReconciliation, "reconciliation type");
  } },
  { name: "Translations do not mutate source records", run: () => {
    const source = routerAudit();
    const before = JSON.stringify(source);
    auditRecordFromRoutingAudit(source, context);
    assertEqual(JSON.stringify(source), before, "source mutation");
  } },
  { name: "Sequence numbers increase monotonically", run: () => {
    const instance = service();
    assertEqual(append(instance, record("1")).record?.sequence, 1, "first sequence");
    assertEqual(append(instance, record("2")).record?.sequence, 2, "second sequence");
  } },
  { name: "Equal timestamps are ordered by sequence", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2"));
    assertDeepEqual(instance.query().records.map((value) => value.recordId), ["audit-1", "audit-2"], "stable equal timestamp ordering");
  } },
  { name: "Repeated identical append is idempotent", run: () => {
    const instance = service(); const input = record("1");
    const first = append(instance, input); const replay = append(instance, input);
    assertEqual(replay.record?.sequence, first.record?.sequence, "replay sequence");
    assertEqual(instance.query().count, 1, "replay count");
    assertEqual(replay.operationAudit.idempotencyOutcome, "REPLAY", "replay outcome");
  } },
  { name: "Conflicting idempotency payload is rejected", run: () => {
    const instance = service(); append(instance, record("1"));
    const result = append(instance, record("2", { idempotencyKey: "idem-1" }));
    assertEqual(result.error?.category, AIAuditRepositoryErrorCategory.IdempotencyConflict, "idempotency conflict");
  } },
  { name: "Duplicate audit record ID is rejected", run: () => {
    const instance = service(); append(instance, record("1"));
    const result = append(instance, record("2", { recordId: "audit-1" }));
    assertEqual(result.error?.category, AIAuditRepositoryErrorCategory.DuplicateRecord, "record conflict");
  } },
  { name: "Duplicate source identity is rejected", run: () => {
    const instance = service(); append(instance, record("1"));
    const result = append(instance, record("2", { sourceRecordId: "source-1" }));
    assertEqual(result.error?.category, AIAuditRepositoryErrorCategory.DuplicateSourceIdentity, "source conflict");
  } },
  { name: "Source identity duplicates can be policy-authorized", run: () => {
    const instance = service(); const relaxed = { ...policy, requireUniqueSourceIdentity: false };
    append(instance, record("1"), relaxed);
    assertEqual(append(instance, record("2", { sourceRecordId: "source-1" }), relaxed).status, AIAuditAppendStatus.Appended, "relaxed source uniqueness");
  } },
  { name: "Returned records are defensively copied", run: () => {
    const repository = new InMemoryAIAuditRepository(); const instance = new DeterministicAIAuditRepository(repository);
    append(instance, record("1"));
    const copy = repository.getById("audit-1") as { status: string }; copy.status = "MUTATED";
    assertEqual(repository.getById("audit-1")?.status, "VALID", "defensive copy");
  } },
  { name: "Query by request ID works", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { requestId: "request-2" }));
    assertEqual(instance.query({ requestId: "request-2" }).count, 1, "request query");
  } },
  { name: "Query by trace ID works", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { traceId: "trace-2" }));
    assertEqual(instance.query({ traceId: "trace-2" }).count, 1, "trace query");
  } },
  { name: "Query by correlation ID works", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { correlationId: "corr-2" }));
    assertEqual(instance.query({ correlationId: "corr-2" }).count, 1, "correlation query");
  } },
  { name: "Query by source subsystem works", run: () => {
    const instance = service(); append(instance, record("1"));
    assertEqual(instance.query({ sourceSubsystems: [AIAuditSourceSubsystem.AuditRepository] }).count, 1, "subsystem query");
  } },
  { name: "Query by record type works", run: () => {
    const instance = service(); append(instance, record("1"));
    assertEqual(instance.query({ recordTypes: [AIAuditRecordType.SystemValidation] }).count, 1, "type query");
  } },
  { name: "Query by sequence range works", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2")); append(instance, record("3"));
    assertDeepEqual(instance.query({ fromSequence: 2, toSequence: 2 }).records.map((value) => value.sequence), [2], "sequence query");
  } },
  { name: "Query by timestamp range works", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { timestamp: "2026-07-18T21:00:00.000Z" }));
    assertEqual(instance.query({ fromTimestamp: "2026-07-18T20:30:00.000Z", toTimestamp: "2026-07-18T21:30:00.000Z" }).count, 1, "timestamp query");
  } },
  { name: "Query by reservation ID works", run: () => {
    const instance = service(); append(instance, record("1", { reservationId: "reservation-1" }));
    assertEqual(instance.query({ reservationId: "reservation-1" }).count, 1, "reservation query");
  } },
  { name: "Query by execution ID works", run: () => {
    const instance = service(); append(instance, record("1", { executionId: "execution-1" }));
    assertEqual(instance.query({ executionId: "execution-1" }).count, 1, "execution query");
  } },
  { name: "Query by ledger reference works", run: () => {
    const instance = service(); append(instance, record("1", { ledgerEntryIds: ["ledger-1"] }));
    assertEqual(instance.query({ ledgerEntryId: "ledger-1" }).count, 1, "ledger query");
  } },
  { name: "Query by provider model and task works", run: () => {
    const instance = service(); append(instance, record("1"));
    assertEqual(instance.query({ providerId: "provider-safe", modelId: "model-safe", taskType: AITaskType.GeneralChat }).count, 1, "provider query");
  } },
  { name: "Query by privacy level works", run: () => {
    const instance = service(); append(instance, record("1"));
    assertEqual(instance.query({ privacyLevels: [PrivacyLevel.Internal] }).count, 1, "privacy query");
  } },
  { name: "Trace reconstruction orders nodes by sequence", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    const trace = instance.reconstructTrace({ operationId: "trace-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "audit-v1", traceId: "trace-1" });
    assertDeepEqual(trace.nodes.filter((value) => !value.missing).map((value) => value.sequence), [1, 2], "node order");
  } },
  { name: "Missing parent record is detected", run: () => {
    const instance = service(); append(instance, record("1", { parentAuditRecordIds: ["missing-parent"] }));
    const trace = instance.reconstructTrace({ operationId: "trace-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "audit-v1", traceId: "trace-1" });
    assertTrue(trace.issues.some((value) => value.code === AIAuditIntegrityIssueCode.MissingParent), "missing parent issue");
  } },
  { name: "Missing related record is detected", run: () => {
    const instance = service(); append(instance, record("1", { relatedAuditRecordIds: ["missing-related"] }));
    const result = instance.checkIntegrity({ operationId: "integrity-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "audit-v1" });
    assertTrue(result.issues.some((value) => value.code === AIAuditIntegrityIssueCode.MissingRelatedRecord), "missing related issue");
  } },
  { name: "Cyclic parent references are detected", run: () => {
    const instance = service(); append(instance, record("1", { parentAuditRecordIds: ["audit-2"] })); append(instance, record("2", { parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    const trace = instance.reconstructTrace({ operationId: "trace-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "audit-v1", traceId: "trace-1" });
    assertTrue(trace.issues.some((value) => value.code === AIAuditIntegrityIssueCode.CyclicParentReference), "cycle issue");
  } },
  { name: "Trace ID mismatch is detected", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { traceId: "trace-2", parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    const result = instance.reconstructTrace({ operationId: "trace-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "audit-v1", traceId: "trace-2" });
    assertTrue(result.issues.some((value) => value.code === AIAuditIntegrityIssueCode.TraceMismatch), "trace mismatch");
  } },
  { name: "Request ID mismatch is detected", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { requestId: "request-2", parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    const result = instance.checkIntegrity({ operationId: "integrity-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "audit-v1" });
    assertTrue(result.issues.some((value) => value.code === AIAuditIntegrityIssueCode.RequestMismatch), "request mismatch");
  } },
  { name: "Correlation ID mismatch is detected", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { correlationId: "corr-2", parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    const result = instance.checkIntegrity({ operationId: "integrity-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "audit-v1" });
    assertTrue(result.issues.some((value) => value.code === AIAuditIntegrityIssueCode.CorrelationMismatch), "correlation mismatch");
  } },
  { name: "Reservation reference mismatch is detected", run: () => {
    const instance = service(); append(instance, record("1", { reservationId: "reservation-1" })); append(instance, record("2", { reservationId: "reservation-2", parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    assertTrue(instance.checkIntegrity({ operationId: "i", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1" }).issues.some((value) => value.code === AIAuditIntegrityIssueCode.ReservationMismatch), "reservation mismatch");
  } },
  { name: "Execution reference mismatch is detected", run: () => {
    const instance = service(); append(instance, record("1", { executionId: "execution-1" })); append(instance, record("2", { executionId: "execution-2", parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    assertTrue(instance.checkIntegrity({ operationId: "i", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1" }).issues.some((value) => value.code === AIAuditIntegrityIssueCode.ExecutionMismatch), "execution mismatch");
  } },
  { name: "Ledger reference mismatch is detected", run: () => {
    const instance = service(); append(instance, record("1", { ledgerEntryIds: ["ledger-1"] })); append(instance, record("2", { ledgerEntryIds: ["ledger-2"], parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    assertTrue(instance.checkIntegrity({ operationId: "i", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1" }).issues.some((value) => value.code === AIAuditIntegrityIssueCode.LedgerReferenceMismatch), "ledger mismatch");
  } },
  { name: "Policy version conflict is detected", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2", { parentAuditRecordIds: ["audit-1"], policyVersions: { audit: "v2" }, recordType: AIAuditRecordType.Error }));
    assertTrue(instance.checkIntegrity({ operationId: "i", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1" }).issues.some((value) => value.code === AIAuditIntegrityIssueCode.PolicyVersionConflict), "policy mismatch");
  } },
  { name: "Invalid subsystem ordering is detected", run: () => {
    const instance = service(); append(instance, record("1", { sourceSubsystem: AIAuditSourceSubsystem.CostLedger })); append(instance, record("2", { sourceSubsystem: AIAuditSourceSubsystem.Router, parentAuditRecordIds: ["audit-1"], recordType: AIAuditRecordType.Error }));
    assertTrue(instance.checkIntegrity({ operationId: "i", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1" }).issues.some((value) => value.code === AIAuditIntegrityIssueCode.InvalidSubsystemOrder), "order issue");
  } },
  { name: "Incomplete trace returns explicit incomplete status", run: () => {
    const instance = service(); append(instance, record("1"));
    const result = instance.reconstructTrace({ operationId: "trace-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", traceId: "trace-1" });
    assertEqual(result.status, AIAuditTraceStatus.Incomplete, "incomplete status");
  } },
  { name: "Empty trace returns explicit empty status", run: () => {
    const result = service().reconstructTrace({ operationId: "trace-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", traceId: "trace-empty" });
    assertEqual(result.status, AIAuditTraceStatus.Empty, "empty status");
  } },
  { name: "Valid full trace reconstructs successfully", run: () => {
    const instance = service();
    append(instance, record("1", { sourceSubsystem: AIAuditSourceSubsystem.Router, recordType: AIAuditRecordType.RoutingDecision }));
    append(instance, record("2", { sourceSubsystem: AIAuditSourceSubsystem.CostGovernor, recordType: AIAuditRecordType.CostGovernorDecision, parentAuditRecordIds: ["audit-1"] }));
    append(instance, record("3", { sourceSubsystem: AIAuditSourceSubsystem.ReservationManager, recordType: AIAuditRecordType.ReservationOperation, parentAuditRecordIds: ["audit-2"] }));
    append(instance, record("4", { sourceSubsystem: AIAuditSourceSubsystem.ExecutionCoordinator, recordType: AIAuditRecordType.ExecutionCoordinatorResult, parentAuditRecordIds: ["audit-3"], finalOutcome: "SUCCEEDED" }));
    const result = instance.reconstructTrace({ operationId: "trace-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", traceId: "trace-1" });
    assertEqual(result.status, AIAuditTraceStatus.Complete, "complete trace");
    assertEqual(result.finalOutcome, "SUCCEEDED", "final outcome");
  } },
  { name: "Privacy downgrade is rejected", run: () => {
    const instance = service(); append(instance, record("1", { privacyLevel: PrivacyLevel.Sensitive }));
    const result = append(instance, record("2", { privacyLevel: PrivacyLevel.Internal, parentAuditRecordIds: ["audit-1"] }));
    assertEqual(result.error?.category, AIAuditRepositoryErrorCategory.PrivacyDowngrade, "privacy downgrade");
  } },
  { name: "LOCAL_ONLY external export is rejected", run: () => {
    const instance = service(); append(instance, record("1", { privacyLevel: PrivacyLevel.LocalOnly }));
    const result = instance.exportSnapshot({ operationId: "export-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", query: {}, format: AIAuditExportFormat.Ndjson, destination: AIAuditExportDestination.ExternalTransfer }, policy);
    assertEqual(result.status, AIAuditExportStatus.Rejected, "local-only export");
  } },
  { name: "SENSITIVE external export requires authorization", run: () => {
    const instance = service(); append(instance, record("1", { privacyLevel: PrivacyLevel.Sensitive }));
    const result = instance.exportSnapshot({ operationId: "export-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", query: {}, format: AIAuditExportFormat.Ndjson, destination: AIAuditExportDestination.ExternalTransfer }, policy);
    assertEqual(result.error?.category, AIAuditRepositoryErrorCategory.SensitiveExportUnauthorized, "sensitive export");
  } },
  { name: "Authorized SENSITIVE external export succeeds", run: () => {
    const instance = service(); append(instance, record("1", { privacyLevel: PrivacyLevel.Sensitive }));
    const result = instance.exportSnapshot({ operationId: "export-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", query: {}, format: AIAuditExportFormat.Ndjson, destination: AIAuditExportDestination.ExternalTransfer, sensitiveAuthorizationReference: "owner-export-approval" }, policy);
    assertEqual(result.status, AIAuditExportStatus.Exported, "authorized export");
  } },
  { name: "Policy can forbid all external exports", run: () => {
    const instance = service(); append(instance, record("1"));
    const result = instance.exportSnapshot({ operationId: "export-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", query: {}, format: AIAuditExportFormat.Ndjson, destination: AIAuditExportDestination.ExternalTransfer }, { ...policy, allowExternalExports: false });
    assertEqual(result.status, AIAuditExportStatus.Rejected, "external policy");
  } },
  { name: "Export ordering is deterministic", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2"));
    const result = instance.exportSnapshot({ operationId: "export-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", query: {}, format: AIAuditExportFormat.JsonArray, destination: AIAuditExportDestination.LocalSnapshot }, policy);
    assertDeepEqual(result.records.map((value) => value.sequence), [1, 2], "export ordering");
    assertTrue(result.serialized?.startsWith("[") ?? false, "JSON array export");
  } },
  { name: "NDJSON export has one canonical record per line", run: () => {
    const instance = service(); append(instance, record("1")); append(instance, record("2"));
    const result = instance.exportSnapshot({ operationId: "export-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1", query: {}, format: AIAuditExportFormat.Ndjson, destination: AIAuditExportDestination.LocalSnapshot }, policy);
    assertEqual(result.serialized?.trim().split("\n").length, 2, "NDJSON lines");
  } },
  { name: "Corrupt NDJSON record is rejected", run: () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-audit-corrupt-"));
    try {
      new LocalNdjsonAIAuditRepository(directory, "store");
      writeFileSync(join(directory, "store.ndjson"), "{}\n");
      let caught = false;
      try { new LocalNdjsonAIAuditRepository(directory, "store"); } catch (error: unknown) { caught = error instanceof AIAuditRepositoryCorruptionError; }
      assertTrue(caught, "corruption error");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  } },
  { name: "Truncated NDJSON record is rejected", run: () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-audit-truncated-"));
    try {
      new LocalNdjsonAIAuditRepository(directory, "store");
      writeFileSync(join(directory, "store.ndjson"), "{\"schemaVersion\":\"1.0\"}");
      let caught = false;
      try { new LocalNdjsonAIAuditRepository(directory, "store"); } catch (error: unknown) { caught = error instanceof AIAuditRepositoryCorruptionError; }
      assertTrue(caught, "truncation error");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  } },
  { name: "Durable repository reload preserves entries", run: () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-audit-reload-"));
    try {
      append(new DeterministicAIAuditRepository(new LocalNdjsonAIAuditRepository(directory, "store")), record("1"));
      const reloaded = new DeterministicAIAuditRepository(new LocalNdjsonAIAuditRepository(directory, "store"));
      assertEqual(reloaded.query().records[0]?.recordId, "audit-1", "reload");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  } },
  { name: "Durable append does not rewrite prior entries", run: () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-audit-append-"));
    try {
      const repository = new LocalNdjsonAIAuditRepository(directory, "store"); const instance = new DeterministicAIAuditRepository(repository);
      append(instance, record("1")); const before = readFileSync(repository.getStoragePath(), "utf8"); const beforeSize = statSync(repository.getStoragePath()).size;
      append(instance, record("2")); const after = readFileSync(repository.getStoragePath(), "utf8");
      assertTrue(after.startsWith(before) && statSync(repository.getStoragePath()).size > beforeSize, "append-only bytes");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  } },
  { name: "Path traversal is rejected", run: () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-audit-path-"));
    try {
      let caught = false;
      try { new LocalNdjsonAIAuditRepository(directory, "../escape"); } catch (error: unknown) { caught = error instanceof AIAuditRepositoryPathError; }
      assertTrue(caught, "path error");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  } },
  { name: "Runtime audit directory is Git-ignored", run: () => {
    assertTrue(readFileSync(".gitignore", "utf8").includes("data/runtime/ai-audit/"), "audit runtime ignore");
  } },
  { name: "Owner approval record appends successfully", run: () => {
    const approval = record("approval", {
      recordType: AIAuditRecordType.OwnerApproval,
      sourceSubsystem: AIAuditSourceSubsystem.Owner,
      actor: { type: AIAuditActorType.Owner, actorId: "owner-1" },
      ownerApproval: { approvalId: "approval-1", ownerReference: "owner-1", approvedSubject: "Day4-T10", decision: "APPROVED", conditions: [], reason: "Reviewed", gitReference: "abc123" },
      retention: AIAuditRetentionClassification.Permanent,
    });
    assertEqual(append(service(), approval).status, AIAuditAppendStatus.Appended, "owner approval");
  } },
  { name: "Secret-bearing metadata keys are rejected", run: () => {
    const result = append(service(), record("1", { metadata: { api_key: "forbidden" } }));
    assertEqual(result.status, AIAuditAppendStatus.Rejected, "secret metadata");
  } },
  { name: "Stale import is rejected by default", run: () => {
    const instance = service(); append(instance, record("1", { timestamp: "2026-07-18T21:00:00.000Z" }));
    const result = append(instance, record("2", { timestamp: "2026-07-18T20:00:00.000Z" }));
    assertEqual(result.error?.category, AIAuditRepositoryErrorCategory.StaleRecord, "stale rejection");
  } },
  { name: "Stale import can be explicitly allowed and flagged", run: () => {
    const instance = service(); const stalePolicy = { ...policy, allowStaleImports: true };
    append(instance, record("1", { timestamp: "2026-07-18T21:00:00.000Z" }), stalePolicy);
    const result = append(instance, record("2", { timestamp: "2026-07-18T20:00:00.000Z" }), stalePolicy);
    assertEqual(result.record?.importOrderStatus, AIAuditImportOrderStatus.StaleAllowed, "stale flag");
  } },
  { name: "Integrity checks report terminal result missing without mutation", run: () => {
    const instance = service(); append(instance, record("1")); const before = JSON.stringify(instance.query().records);
    const result = instance.checkIntegrity({ operationId: "integrity-op", requestedAt: "2026-07-18T22:00:00.000Z", policyVersion: "v1" });
    assertEqual(result.status, AIAuditIntegrityStatus.IssuesDetected, "integrity status");
    assertTrue(result.issues.some((value) => value.code === AIAuditIntegrityIssueCode.TerminalResultMissing), "terminal issue");
    assertEqual(JSON.stringify(instance.query().records), before, "history mutation");
  } },
  { name: "Repository operation audits are not recursively persisted", run: () => {
    const instance = service(); const result = append(instance, record("1"));
    assertEqual(instance.query().count, 1, "record count");
    assertTrue(result.operationAudit.operationId.length > 0, "operation audit returned");
  } },
];

let passed = 0;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error: unknown) {
    console.error(`FAIL ${test.name}`);
    throw error;
  }
}
console.log(`Unified Audit Repository tests: ${passed}/${tests.length} passed.`);
