import { readFileSync } from "node:fs";
import {
  AICapability,
  AICostLedgerAppendStatus,
  AICostLedgerEntryType,
  AICostLedgerErrorCategory,
  AICostLedgerRepositoryType,
  AIAuditActorType,
  AIAuditAppendStatus,
  AIAuditExportFormat,
  AIAuditIntegrityIssueCode,
  AIAuditOperationType,
  AIAuditRecordType,
  AIAuditRepositoryErrorCategory,
  AIAuditRepositoryType,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  AIAuditTraceStatus,
  AIAuditValidationStatus,
  AIErrorCategory,
  AIExecutionFinishReason,
  AIExecutionInputType,
  AIExecutionStatus,
  AIOutputType,
  AIProviderAdapterErrorCategory,
  AIProviderHealthStatus,
  AIReservationState,
  AIRuntimeAuditFailureMode,
  AIRuntimeCompensationAction,
  AIRuntimeWorkflowStage,
  AIRuntimeWorkflowStatus,
  AIRuntimeWorkflowRetryDisposition,
  AITaskType,
  BudgetScope,
  LatencyPriority,
  ModelAvailability,
  PrivacyLevel,
  ProviderProcessingBoundary,
  ReasoningLevel,
  RoutingCostMode,
  RoutingTieBreakField,
  type AIAuditAppendRequest,
  type AIAuditAppendResult,
  type AIAuditExportRequest,
  type AIAuditExportResult,
  type AIAuditIntegrityCheck,
  type AIAuditIntegrityCheckResult,
  type AIAuditQuery,
  type AIAuditQueryResult,
  type AIAuditRepository,
  type AIAuditTrace,
  type AIAuditTraceRequest,
  type AICostLedgerRepositoryAppendRequest,
  type AICostLedgerRepositoryAppendResult,
  type AIExecutionRequest,
  type AIExecutionResponse,
  type AIProviderAdapter,
  type AIProviderCancellation,
  type AIProviderExecutionContext,
  type AIProviderHealth,
  type AIRouterConfiguration,
  type AIRuntimeWorkflowRequest,
} from "../../contracts";
import {
  InMemoryAIAuditRepository,
  InMemoryAICostLedgerRepository,
  InMemoryAIReservationRepository,
  InMemoryAIRuntimeWorkflowRepository,
} from "../../repositories";
import { DeterministicAIAuditRepository } from "../ai-audit-repository";
import { InMemoryAIProviderAdapterRegistry } from "../ai-provider-adapter";
import { DeterministicAIRuntimeWorkflow } from "./AIRuntimeWorkflow";

interface TestCase {
  readonly name: string;
  readonly run: () => Promise<void> | void;
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

const now = "2026-07-18T23:00:00.000Z";

type AdapterMode = "success" | "timeout" | "rate-limit" | "cancelled" | "malformed" | "provider-mismatch";

class NeutralFixtureAdapter implements AIProviderAdapter {
  invocationCount = 0;

  constructor(
    readonly mode: AdapterMode,
    readonly actualMinorUnits: number,
    private readonly onExecute?: () => void,
  ) {}

  getDescriptor() {
    return {
      adapterId: "neutral-fixture-adapter",
      providerId: "provider-neutral",
      displayName: "Neutral Test Adapter",
      version: "fixture-v1",
      enabled: true,
      supportedModelIds: ["model-quality", "model-cheap"],
      capabilities: {
        supportedCapabilities: [AICapability.Fast, AICapability.LowCost],
        supportedOutputTypes: [AIOutputType.Text],
        supportedReasoningLevels: [ReasoningLevel.Low, ReasoningLevel.Medium],
        supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
        maximumContextTokens: 20_000,
        maximumOutputTokens: 4_000,
        timeoutSupported: true,
        cancellationSupported: true,
        structuredOutputSupported: true,
      },
    } as const;
  }

  getHealth(): AIProviderHealth {
    return {
      providerId: "provider-neutral",
      status: AIProviderHealthStatus.Available,
      observedAt: now,
      estimatedLatencyMs: 25,
      reliability: 0.99,
      rateLimited: false,
      source: "fixture",
      expiresAt: "2026-07-19T00:00:00.000Z",
    };
  }

  supports() {
    return { compatible: true, reasons: [] };
  }

  async execute(request: Readonly<AIExecutionRequest>, context: Readonly<AIProviderExecutionContext>): Promise<AIExecutionResponse> {
    this.invocationCount += 1;
    this.onExecute?.();
    const metadata = { startedAt: now, completedAt: now, latencyMs: 25, attemptNumber: context.attemptNumber };
    const audit = {
      traceId: request.traceId,
      ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
      routingDecisionId: request.routingDecisionId,
      costGovernorDecisionId: request.costGovernorDecisionId,
      reservationId: request.reservationId,
      adapterId: "neutral-fixture-adapter",
      adapterVersion: "fixture-v1",
    };
    if (this.mode === "success") {
      return {
        requestId: request.requestId,
        providerId: request.providerId,
        modelId: request.modelId,
        status: AIExecutionStatus.Completed,
        metadata,
        audit,
        retryable: false,
        warnings: [],
        output: { type: AIOutputType.Text, content: "fixture output" },
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          reportedCost: { minorUnits: this.actualMinorUnits, currency: "USD" },
        },
        finishReason: AIExecutionFinishReason.Completed,
      };
    }
    if (this.mode === "malformed") {
      return {
        requestId: request.requestId,
        providerId: request.providerId,
        modelId: request.modelId,
        status: AIExecutionStatus.Completed,
        metadata,
        audit,
        retryable: false,
        warnings: [],
        output: { type: AIOutputType.Text, content: "invalid" },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 99 },
        finishReason: AIExecutionFinishReason.Completed,
      } as AIExecutionResponse;
    }
    if (this.mode === "provider-mismatch") {
      return {
        requestId: request.requestId,
        providerId: "provider-changed",
        modelId: request.modelId,
        status: AIExecutionStatus.Completed,
        metadata,
        audit,
        retryable: false,
        warnings: [],
        output: { type: AIOutputType.Text, content: "invalid" },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, reportedCost: { minorUnits: this.actualMinorUnits, currency: "USD" } },
        finishReason: AIExecutionFinishReason.Completed,
      } as AIExecutionResponse;
    }
    const category = this.mode === "timeout"
      ? AIProviderAdapterErrorCategory.Timeout
      : this.mode === "rate-limit"
        ? AIProviderAdapterErrorCategory.RateLimited
        : AIProviderAdapterErrorCategory.Cancelled;
    const status = this.mode === "timeout"
      ? AIExecutionStatus.TimedOut
      : this.mode === "cancelled"
        ? AIExecutionStatus.Cancelled
        : AIExecutionStatus.Failed;
    return {
      requestId: request.requestId,
      providerId: request.providerId,
      modelId: request.modelId,
      status,
      metadata,
      audit,
      retryable: this.mode !== "cancelled",
      warnings: [],
      error: {
        category,
        code: category,
        safeMessage: `Neutral fixture ${category}.`,
        retryable: this.mode !== "cancelled",
        occurredAt: now,
        providerId: request.providerId,
        modelId: request.modelId,
      },
      finishReason: this.mode === "timeout" ? AIExecutionFinishReason.Timeout : this.mode === "cancelled" ? AIExecutionFinishReason.Cancelled : AIExecutionFinishReason.Error,
    };
  }

  normalizeError(_error: unknown, request: Readonly<AIExecutionRequest>) {
    return {
      category: AIProviderAdapterErrorCategory.Unknown,
      code: "FIXTURE_ERROR",
      safeMessage: "Neutral fixture error.",
      retryable: false,
      occurredAt: now,
      providerId: request.providerId,
      modelId: request.modelId,
    };
  }
}

class ControlledLedgerRepository extends InMemoryAICostLedgerRepository {
  appendCalls = 0;
  constructor(private readonly failAt?: number, private readonly hideAcquisition = false) { super(); }

  override appendAtomically(request: AICostLedgerRepositoryAppendRequest): AICostLedgerRepositoryAppendResult {
    this.appendCalls += 1;
    if (this.failAt === this.appendCalls) return { appended: false, conflictCategory: AICostLedgerErrorCategory.RepositoryConflict };
    return super.appendAtomically(request);
  }

  override listByReservationId(reservationId: string) {
    const values = super.listByReservationId(reservationId);
    return this.hideAcquisition ? values.filter((entry) => entry.entryType !== AICostLedgerEntryType.ReservationAcquired) : values;
  }
}

class NonStoringReservationRepository extends InMemoryAIReservationRepository {
  override create(): boolean { return true; }
}

class RejectingReservationRepository extends InMemoryAIReservationRepository {
  override create(): boolean { return false; }
}

class ControlledAuditRepository implements AIAuditRepository {
  lastAppendResult?: AIAuditAppendResult;

  constructor(
    private readonly delegate: AIAuditRepository,
    private readonly rejectedType?: AIAuditRecordType,
    private readonly brokenTrace = false,
  ) {}

  append(request: Readonly<AIAuditAppendRequest>): AIAuditAppendResult {
    if (request.record.recordType !== this.rejectedType) {
      const result = this.delegate.append(request);
      this.lastAppendResult = result;
      return result;
    }
    const error = {
      category: AIAuditRepositoryErrorCategory.RepositoryConflict,
      code: "FIXTURE_AUDIT_REJECTION",
      safeMessage: "Fixture rejected the selected audit record.",
      retryable: true,
      occurredAt: request.record.timestamp,
    };
    const result: AIAuditAppendResult = {
      status: AIAuditAppendStatus.Rejected,
      reasons: [error.safeMessage],
      operationAudit: {
        operationId: request.record.recordId,
        operationType: AIAuditOperationType.Append,
        timestamp: request.record.timestamp,
        actor: request.record.actor,
        policyVersion: request.policy.version,
        recordId: request.record.recordId,
        validationChecks: [{ name: "FIXTURE", status: AIAuditValidationStatus.Failed, reason: error.safeMessage }],
        idempotencyOutcome: "NEW",
        repositoryType: AIAuditRepositoryType.InMemory,
        integrityIssues: [],
        exportRestrictions: [],
        error,
        finalResult: "REJECTED",
      },
      error,
    };
    this.lastAppendResult = result;
    return result;
  }

  query(query?: Readonly<AIAuditQuery>): AIAuditQueryResult { return this.delegate.query(query); }

  reconstructTrace(request: Readonly<AIAuditTraceRequest>): AIAuditTrace {
    const trace = this.delegate.reconstructTrace(request);
    if (!this.brokenTrace) return trace;
    return {
      ...trace,
      status: AIAuditTraceStatus.Inconsistent,
      issues: [...trace.issues, { code: AIAuditIntegrityIssueCode.MissingParent, relatedRecordId: "fixture-missing", reason: "Fixture missing audit parent." }],
    };
  }

  checkIntegrity(request: Readonly<AIAuditIntegrityCheck>): AIAuditIntegrityCheckResult { return this.delegate.checkIntegrity(request); }
  exportSnapshot(request: Readonly<AIAuditExportRequest>, policy: Parameters<AIAuditRepository["exportSnapshot"]>[1]): AIAuditExportResult { return this.delegate.exportSnapshot(request, policy); }
}

interface FixtureOptions {
  readonly costMode?: "normal" | "low-cost" | "reject" | "defer";
  readonly adapterMode?: AdapterMode;
  readonly actualMinorUnits?: number;
  readonly noCheapModel?: boolean;
  readonly routingRejected?: boolean;
  readonly ledgerFailAt?: number;
  readonly reconciliationBroken?: boolean;
  readonly reservationNotStored?: boolean;
  readonly reservationCreateRejected?: boolean;
  readonly auditRejectedType?: AIAuditRecordType;
  readonly brokenTrace?: boolean;
  readonly auditFailureMode?: AIRuntimeAuditFailureMode;
  readonly cancellation?: AIProviderCancellation;
  readonly onExecute?: () => void;
}

function fixture(options: FixtureOptions = {}) {
  const qualityModel = {
    modelId: "model-quality",
    providerId: "provider-neutral",
    providerModelReference: "quality-reference",
    enabled: true,
    capabilities: [AICapability.Fast, AICapability.LowCost],
    supportedReasoningLevels: [ReasoningLevel.Low, ReasoningLevel.Medium],
    supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
    supportedOutputTypes: [AIOutputType.Text],
    contextLimitTokens: 20_000,
    maximumOutputTokens: 4_000,
    visionSupport: false,
    functionCallingSupport: false,
    strictStructuredOutputSupport: true,
    reliability: 0.99,
    availability: ModelAvailability.Available,
    estimatedP95LatencyMs: 50,
    cost: {
      currency: "USD",
      inputPerMillionTokens: 2,
      outputPerMillionTokens: 4,
      fixedRequestCost: 0,
      pricingVersion: "pricing-v1",
      effectiveAt: now,
    },
  } as const;
  const cheapModel = {
    ...qualityModel,
    modelId: "model-cheap",
    providerModelReference: "cheap-reference",
    reliability: 0.95,
    estimatedP95LatencyMs: 80,
    cost: { ...qualityModel.cost, inputPerMillionTokens: 1, outputPerMillionTokens: 1 },
  } as const;
  const models = options.noCheapModel ? [qualityModel] : [qualityModel, cheapModel];
  const router: AIRouterConfiguration = {
    contractVersion: "1.0",
    configurationVersion: "runtime-router-v1",
    providerRegistry: {
      version: "providers-v1",
      providers: [{
        providerId: "provider-neutral",
        name: "Neutral Fixture Provider",
        adapterId: "neutral-fixture-adapter",
        enabled: !options.routingRejected,
        processingBoundary: ProviderProcessingBoundary.External,
        supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
        supportedProcessingRegions: ["region-a"],
        zeroRetentionSupported: true,
        reliability: 0.99,
        availability: ModelAvailability.Available,
        modelIds: models.map((model) => model.modelId),
      }],
    },
    modelRegistry: { version: "models-v1", models },
    routingPolicy: {
      version: "routing-v1",
      capabilityProfiles: [
        { capability: AICapability.Fast, minimumReliability: 0.9, functionCallingRequired: false, visionRequired: false },
        { capability: AICapability.LowCost, minimumReliability: 0.9, functionCallingRequired: false, visionRequired: false },
      ],
      taskPolicies: [{
        taskType: AITaskType.Summary,
        requiredCapabilities: [AICapability.Fast],
        minimumReasoningLevel: ReasoningLevel.Low,
        allowedOutputTypes: [AIOutputType.Text],
        minimumReliability: 0.9,
        costMode: RoutingCostMode.QualityFirst,
        deterministicOnly: false,
      }],
      contextSafetyMarginTokens: 100,
      staleHealthAfterMs: 60_000,
      stableTieBreakOrder: [
        RoutingTieBreakField.Reliability,
        RoutingTieBreakField.EstimatedCost,
        RoutingTieBreakField.Latency,
        RoutingTieBreakField.ProviderId,
        RoutingTieBreakField.ModelId,
      ],
    },
    budgetPolicy: {
      policyId: "budget-policy",
      version: "budget-v1",
      currency: "USD",
      perRequestLimit: 1,
      dailyBudget: 10,
      monthlyBudget: 100,
      lowCostMode: false,
      warningThresholdPercentage: 80,
      criticalOverrideAllowed: false,
      accountingTimezone: "America/New_York",
    },
    fallbackPolicy: {
      version: "fallback-v1",
      maximumTotalAttempts: 2,
      maximumRetriesPerCandidate: 1,
      outputRepairRetries: 0,
      retryableErrorCategories: [AIErrorCategory.Timeout, AIErrorCategory.RateLimited],
      baseBackoffMs: 10,
      maximumBackoffMs: 100,
    },
    featureFlags: {
      deterministicGateEnabled: false,
      providerExecutionEnabled: false,
      fallbackEnabled: true,
      costGovernanceEnabled: true,
      auditLoggingEnabled: true,
      criticalOverridesEnabled: false,
    },
  };
  const hardLimit = options.costMode === "reject" ? 3_000 : 10_000;
  const softLimit = options.costMode === "low-cost" ? 3_000 : options.costMode === "reject" ? 2_000 : 8_000;
  const costGovernorPolicy = {
    policyId: "budget-policy",
    version: "budget-v1",
    currency: "USD",
    minorUnitScale: 1_000_000,
    limits: [
      { scope: BudgetScope.PerRequest, enabled: true, currency: "USD", softLimitMinorUnits: softLimit, hardLimitMinorUnits: hardLimit, policyVersion: "budget-v1" },
      { scope: BudgetScope.Daily, enabled: true, currency: "USD", softLimitMinorUnits: 80_000, hardLimitMinorUnits: 100_000, policyVersion: "budget-v1" },
      { scope: BudgetScope.Monthly, enabled: true, currency: "USD", softLimitMinorUnits: 800_000, hardLimitMinorUnits: 1_000_000, policyVersion: "budget-v1" },
    ],
    lowCostModeEnabled: true,
    criticalOverrideFeatureEnabled: false,
    criticalOverrideAllowed: false,
    criticalTaskTypes: [],
    criticalReasoningLevels: [],
  } as const;
  const costGovernorBudgetUsage = {
    snapshotId: "cost-usage-v1",
    capturedAt: now,
    currency: "USD",
    usages: options.costMode === "defer"
      ? [{ scope: BudgetScope.Monthly, committedMinorUnits: 0, reservedMinorUnits: 0 }]
      : [
          { scope: BudgetScope.Daily, committedMinorUnits: 0, reservedMinorUnits: 0 },
          { scope: BudgetScope.Monthly, committedMinorUnits: 0, reservedMinorUnits: 0 },
        ],
  } as const;
  const request: AIRuntimeWorkflowRequest = {
    contractVersion: "1.0",
    workflowId: "workflow-1",
    idempotencyKey: "workflow-idem-1",
    requestId: "request-1",
    correlationId: "correlation-1",
    traceId: "trace-1",
    originalRequest: {
      contractVersion: "1.0",
      requestId: "request-1",
      correlationId: "correlation-1",
      requestedAt: now,
      requestedBy: "runtime-test",
      taskType: AITaskType.Summary,
      requiredCapabilities: [AICapability.Fast],
      reasoningLevel: ReasoningLevel.Low,
      constraints: {
        estimatedInputTokens: 1_000,
        reservedOutputTokens: 500,
        maximumEstimatedCost: 1,
        currency: "USD",
        latencyPriority: LatencyPriority.Normal,
        privacyLevel: PrivacyLevel.Internal,
        externalProcessingAllowed: true,
        allowedProcessingRegions: ["region-a"],
        retentionAllowed: false,
        deterministicAllowed: false,
        contextReductionAllowed: false,
        expectedOutputType: AIOutputType.Text,
        strictSchema: false,
        functionCallingRequired: false,
      },
      contextFingerprint: "context-fixture-1",
    },
    executionInput: { type: AIExecutionInputType.Text, content: "fixture request payload" },
    timeoutPolicy: { timeoutMs: 1_000 },
    cancellation: options.cancellation ?? { cancellationId: "cancel-1", requested: false },
    identifiers: {
      reservationId: "reservation-1",
      executionId: "execution-1",
      acquireOperationId: "operation-acquire-1",
      acquireIdempotencyKey: "idem-acquire-1",
      acquisitionLedgerEntryId: "ledger-acquire-1",
      commitOperationId: "operation-commit-1",
      commitIdempotencyKey: "idem-commit-1",
      commitLedgerEntryId: "ledger-commit-1",
      releaseOperationId: "operation-release-1",
      releaseIdempotencyKey: "idem-release-1",
      releaseLedgerEntryId: "ledger-release-1",
      compensationReleaseOperationId: "operation-compensation-1",
      compensationReleaseIdempotencyKey: "idem-compensation-1",
      compensationReleaseLedgerEntryId: "ledger-compensation-1",
      reconciliationOperationId: "operation-reconcile-1",
      finalAuditRecordId: "workflow-final-audit-1",
      finalAuditIdempotencyKey: "workflow-final-idem-1",
      traceOperationId: "operation-trace-1",
    },
    configuration: {
      router,
      budgetUsage: { currency: "USD", dailyCost: 0, monthlyCost: 0, capturedAt: now },
      costGovernorPolicy,
      costGovernorBudgetUsage,
      reservationPolicy: {
        policyId: "reservation-policy",
        version: "budget-v1",
        allowPartialCommit: true,
        expiration: { allowAdministrativeEarlyExpiration: true, allowCommitAfterExpiration: false },
      },
      executionPolicy: {
        policyId: "execution-policy",
        version: "execution-v1",
        reservationRequired: true,
        maximumAttempts: 2,
        acceptedHealthStatuses: [AIProviderHealthStatus.Available],
        lowCostEligibleModelIds: ["model-cheap"],
        retrySameAdapterOn: [AIProviderAdapterErrorCategory.Timeout],
        returnToRouterOn: [AIProviderAdapterErrorCategory.RateLimited],
        retainReservationForRetry: true,
        releaseUnusedReservation: true,
      },
      costLedgerPolicy: {
        policyId: "ledger-policy",
        version: "ledger-v1",
        allowOutOfOrderEvents: false,
        allowManualAdjustments: false,
        authorizedManualAdjustmentReferences: [],
        rejectSecretMetadataKeys: true,
      },
      auditPolicy: {
        policyId: "audit-policy",
        version: "audit-v1",
        requireUniqueSourceIdentity: true,
        allowStaleImports: false,
        rejectSecretMetadataKeys: true,
        preventPrivacyDowngrade: true,
        allowExternalExports: false,
        requireSensitiveExportAuthorization: true,
        sensitiveExportAuthorizationReferences: [],
      },
      workflowPolicy: {
        policyId: "workflow-policy",
        version: "workflow-v1",
        maximumLowCostReroutes: 1,
        rerunCostGovernorAfterLowCostRoute: true,
        requirePreExecutionAudit: true,
        auditFailureMode: options.auditFailureMode ?? AIRuntimeAuditFailureMode.FailClosed,
        acceptedFinalTraceStatuses: [AIAuditTraceStatus.Complete],
        auditPrivacyLevel: PrivacyLevel.Internal,
        auditRetention: AIAuditRetentionClassification.LongTerm,
        auditActor: { type: AIAuditActorType.System, actorId: "runtime-workflow" },
      },
    },
  };
  const reservationRepository = options.reservationNotStored
    ? new NonStoringReservationRepository()
    : options.reservationCreateRejected
      ? new RejectingReservationRepository()
      : new InMemoryAIReservationRepository();
  const ledgerRepository = new ControlledLedgerRepository(options.ledgerFailAt, options.reconciliationBroken);
  const auditPort = new InMemoryAIAuditRepository();
  const baseAudit = new DeterministicAIAuditRepository(auditPort);
  const auditRepository = new ControlledAuditRepository(baseAudit, options.auditRejectedType, options.brokenTrace);
  const workflowRepository = new InMemoryAIRuntimeWorkflowRepository();
  const adapter = new NeutralFixtureAdapter(options.adapterMode ?? "success", options.actualMinorUnits ?? 1_000, options.onExecute);
  const adapterRegistry = new InMemoryAIProviderAdapterRegistry();
  adapterRegistry.register(adapter);
  const workflow = new DeterministicAIRuntimeWorkflow({
    clock: { now: () => now },
    adapterRegistry,
    reservationRepository,
    costLedgerRepository: ledgerRepository,
    auditRepository,
    workflowRepository,
  });
  return { workflow, request, adapter, reservationRepository, ledgerRepository, auditRepository, workflowRepository };
}

const tests: TestCase[] = [
  { name: "Full successful workflow completes", run: async () => {
    const f = fixture(); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.CompletedSuccess, `workflow status ${result.error?.safeMessage ?? ""}`);
  } },
  { name: "Same input and fresh fixture state produce the same result", run: async () => {
    const first = fixture(); const second = fixture();
    assertDeepEqual(await first.workflow.execute(first.request), await second.workflow.execute(second.request), "deterministic result");
  } },
  { name: "Caller inputs are not mutated", run: async () => {
    const f = fixture(); const before = JSON.stringify(f.request); await f.workflow.execute(f.request);
    assertEqual(JSON.stringify(f.request), before, "request mutation");
  } },
  { name: "Invalid execution controls stop before reservation", run: async () => {
    const f = fixture();
    const result = await f.workflow.execute({ ...f.request, timeoutPolicy: { timeoutMs: 0 } });
    assertEqual(result.status, AIRuntimeWorkflowStatus.InvalidRequest, "invalid timeout status");
    assertEqual(f.reservationRepository.getById("reservation-1"), undefined, "invalid request reservation");
    assertEqual(f.adapter.invocationCount, 0, "invalid request adapter count");
  } },
  { name: "Routing rejection stops before Cost Governor", run: async () => {
    const f = fixture({ routingRejected: true }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.RejectedRouting, "routing status");
    assertEqual(result.costDecisions.length, 0, "cost decision count");
    assertEqual(f.adapter.invocationCount, 0, "adapter count");
  } },
  { name: "Cost rejection stops before reservation", run: async () => {
    const f = fixture({ costMode: "reject" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.RejectedCost, "cost rejection");
    assertEqual(result.reservationResults.length, 0, "reservation count");
  } },
  { name: "Deferred cost returns deferred workflow", run: async () => {
    const f = fixture({ costMode: "defer" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.DeferredBudgetUnavailable, "deferred status");
    assertEqual(f.adapter.invocationCount, 0, "deferred adapter count");
  } },
  { name: "Low-cost result triggers exactly one reroute", run: async () => {
    const f = fixture({ costMode: "low-cost" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.routingDecisions.length, 2, "routing attempt count");
    assertEqual(result.stages.filter((stage) => stage.stage === AIRuntimeWorkflowStage.LowCostRerouting).length, 1, "reroute stage count");
    assertEqual(result.auditTrace?.trace.status, AIAuditTraceStatus.Complete, `low-cost trace status ${JSON.stringify(result.auditTrace?.trace.issues ?? [])}`);
  } },
  { name: "Low-cost reroute selects a cheaper compliant model", run: async () => {
    const f = fixture({ costMode: "low-cost" }); const result = await f.workflow.execute(f.request);
    const first = result.routingDecisions[0]; const second = result.routingDecisions[1];
    assertTrue((second?.estimatedCost.estimatedTotalCost ?? Infinity) < (first?.estimatedCost.estimatedTotalCost ?? 0), "cheaper route");
    assertTrue(second !== undefined && "selectedModelId" in second && second.selectedModelId === "model-cheap", "cheap model selected");
  } },
  { name: "No compliant low-cost route is rejected", run: async () => {
    const f = fixture({ costMode: "low-cost", noCheapModel: true }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.RejectedCost, "no low-cost status");
    assertEqual(f.adapter.invocationCount, 0, "no low-cost execution");
  } },
  { name: "Reservation exists before adapter execution", run: async () => {
    let f: ReturnType<typeof fixture>;
    let observed = false;
    f = fixture({ onExecute: () => { observed = f.reservationRepository.getById("reservation-1")?.state === AIReservationState.Reserved; } });
    await f.workflow.execute(f.request);
    assertTrue(observed, "reservation not acquired before execution");
  } },
  { name: "Reservation persistence mismatch stops execution", run: async () => {
    const f = fixture({ reservationNotStored: true }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.RejectedReservation, "reservation mismatch status");
    assertEqual(f.adapter.invocationCount, 0, "mismatch execution count");
  } },
  { name: "Reservation acquisition failure stops execution", run: async () => {
    const f = fixture({ reservationCreateRejected: true }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.RejectedReservation, "reservation rejection status");
    assertEqual(f.adapter.invocationCount, 0, "reservation rejection execution count");
  } },
  { name: "Workflow replay is idempotent", run: async () => {
    const f = fixture(); const first = await f.workflow.execute(f.request); const second = await f.workflow.execute(f.request);
    assertDeepEqual(second, first, "workflow replay result");
    assertEqual(f.adapter.invocationCount, 1, "replay adapter count");
  } },
  { name: "Reservation-acquired ledger entry appends", run: async () => {
    const f = fixture(); await f.workflow.execute(f.request);
    assertEqual(f.ledgerRepository.allEntries()[0]?.entryType, AICostLedgerEntryType.ReservationAcquired, "acquisition entry");
  } },
  { name: "Acquisition ledger failure triggers explicit compensation", run: async () => {
    const f = fixture({ ledgerFailAt: 1 }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.FailedLedger, "ledger failure status");
    assertTrue(result.compensations.some((value) => value.action === AIRuntimeCompensationAction.ReleaseReservation), "release compensation");
    assertEqual(f.adapter.invocationCount, 0, "compensation execution count");
  } },
  { name: "Required pre-execution audit failure stops execution", run: async () => {
    const f = fixture({ auditRejectedType: AIAuditRecordType.ReservationOperation }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.RejectedAudit, "pre-execution audit status");
    assertEqual(f.adapter.invocationCount, 0, "pre-execution audit adapter count");
  } },
  { name: "Coordinator invokes exactly one selected adapter", run: async () => {
    const f = fixture(); const result = await f.workflow.execute(f.request);
    assertEqual(f.adapter.invocationCount, 1, "adapter invocation count");
    assertEqual(result.executionResult?.executionPlan?.providerId, "provider-neutral", "selected provider");
  } },
  { name: "Provider/model cannot change", run: async () => {
    const f = fixture({ adapterMode: "provider-mismatch" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.FailedExecution, "provider mismatch status");
    assertTrue(!result.ledgerResults.some((value) => value.entry?.entryType === AICostLedgerEntryType.UsageCommitted || value.entry?.entryType === AICostLedgerEntryType.UsagePartiallyCommitted), "mismatch usage commit");
  } },
  { name: "Successful execution commits actual usage", run: async () => {
    const f = fixture({ actualMinorUnits: 1_000 }); const result = await f.workflow.execute(f.request);
    assertTrue(result.ledgerResults.some((value) => value.entry?.amount.minorUnits === 1_000 && value.entry.entryType === AICostLedgerEntryType.UsagePartiallyCommitted), "usage commit");
  } },
  { name: "Unused reservation is released", run: async () => {
    const f = fixture({ actualMinorUnits: 1_000 }); const result = await f.workflow.execute(f.request);
    assertTrue(result.ledgerResults.some((value) => value.entry?.entryType === AICostLedgerEntryType.ReservationReleased), "release entry");
  } },
  { name: "Partial commit is supported", run: async () => {
    const f = fixture({ actualMinorUnits: 1_000 }); const result = await f.workflow.execute(f.request);
    assertTrue(result.reservationResults.some((value) => value.record?.state === AIReservationState.PartiallyCommitted), "partial state");
    assertEqual(result.reservationResults.at(-1)?.record?.state, AIReservationState.Released, "released final state");
  } },
  { name: "Failed execution releases reservation when retry is not retained", run: async () => {
    const f = fixture({ adapterMode: "rate-limit" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.reservationResults.at(-1)?.record?.state, AIReservationState.Released, "failed release");
  } },
  { name: "Timeout returns explicit retry recommendation", run: async () => {
    const f = fixture({ adapterMode: "timeout" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.retryDisposition, AIRuntimeWorkflowRetryDisposition.RetrySameAdapterExplicitly, "timeout retry");
    assertTrue(result.settlement?.retainedForRetry ?? false, "reservation retention");
  } },
  { name: "Rate limit returns control to Router", run: async () => {
    const f = fixture({ adapterMode: "rate-limit" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.RequiresRouterFallback, "rate-limit status");
    assertEqual(result.retryDisposition, AIRuntimeWorkflowRetryDisposition.ReturnToRouter, "rate-limit disposition");
  } },
  { name: "Cancellation produces no provider retry", run: async () => {
    const f = fixture({ cancellation: { cancellationId: "cancel-1", requested: true, requestedAt: now, reason: "Owner cancelled" } }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.Cancelled, "cancelled status");
    assertEqual(f.adapter.invocationCount, 0, "cancelled adapter invocation");
    assertEqual(result.retryDisposition, AIRuntimeWorkflowRetryDisposition.None, "cancelled retry");
  } },
  { name: "Malformed response prevents usage commit", run: async () => {
    const f = fixture({ adapterMode: "malformed" }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.FailedExecution, "malformed status");
    assertTrue(!result.ledgerResults.some((value) => [AICostLedgerEntryType.UsageCommitted, AICostLedgerEntryType.UsagePartiallyCommitted].includes(value.entry?.entryType as AICostLedgerEntryType)), "malformed usage");
  } },
  { name: "Provider mismatch prevents usage settlement", run: async () => {
    const f = fixture({ adapterMode: "provider-mismatch" }); const result = await f.workflow.execute(f.request);
    assertTrue(result.settlement?.reservationResults.every((value) => value.auditRecord.operationType !== "COMMIT") ?? true, "provider mismatch commit");
  } },
  { name: "Duplicate workflow cannot double-commit usage", run: async () => {
    const f = fixture(); await f.workflow.execute(f.request); await f.workflow.execute(f.request);
    assertEqual(f.ledgerRepository.listByExecutionId("execution-1").filter((entry) => [AICostLedgerEntryType.UsageCommitted, AICostLedgerEntryType.UsagePartiallyCommitted].includes(entry.entryType)).length, 1, "duplicate usage count");
  } },
  { name: "Settlement ledger entries append exactly once", run: async () => {
    const f = fixture(); await f.workflow.execute(f.request); await f.workflow.execute(f.request);
    assertEqual(f.ledgerRepository.allEntries().length, 3, "ledger event count");
  } },
  { name: "Reconciliation succeeds for valid lifecycle", run: async () => {
    const f = fixture({ actualMinorUnits: 4_000 }); const result = await f.workflow.execute(f.request);
    assertEqual(result.reconciliation?.status, "RECONCILED", "full reconciliation");
  } },
  { name: "Reconciliation succeeds for partial commit plus release", run: async () => {
    const f = fixture({ actualMinorUnits: 1_000 }); const result = await f.workflow.execute(f.request);
    assertEqual(result.reconciliation?.status, "RECONCILED", "partial reconciliation");
    assertEqual(result.reconciliation?.committedMinorUnits, 1_000, "committed total");
  } },
  { name: "Reconciliation failure is normalized", run: async () => {
    const f = fixture({ reconciliationBroken: true }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.FailedReconciliation, `reconciliation failure status ${f.auditRepository.lastAppendResult?.error?.safeMessage ?? ""}`);
    assertEqual(result.retryDisposition, AIRuntimeWorkflowRetryDisposition.ManualReconciliation, "reconciliation disposition");
  } },
  { name: "All required audit record types append", run: async () => {
    const f = fixture(); await f.workflow.execute(f.request);
    const types = f.auditRepository.query().records.map((value) => value.recordType);
    for (const type of [AIAuditRecordType.RoutingDecision, AIAuditRecordType.CostGovernorDecision, AIAuditRecordType.ReservationOperation, AIAuditRecordType.CostLedgerAppend, AIAuditRecordType.ExecutionCoordinatorResult, AIAuditRecordType.CostLedgerReconciliation, AIAuditRecordType.RuntimeWorkflowResult]) assertTrue(types.includes(type), `missing audit type ${type}`);
  } },
  { name: "Final trace reconstructs in stable order", run: async () => {
    const f = fixture(); const result = await f.workflow.execute(f.request);
    const sequences = result.auditTrace?.trace.nodes.filter((node) => !node.missing).map((node) => node.sequence) ?? [];
    assertDeepEqual(sequences, [...sequences].sort((left, right) => (left ?? 0) - (right ?? 0)), "trace order");
  } },
  { name: "Broken trace exposes missing parent issue", run: async () => {
    const f = fixture({ brokenTrace: true }); const result = await f.workflow.execute(f.request);
    assertTrue(result.auditTrace?.trace.issues.some((value) => value.code === AIAuditIntegrityIssueCode.MissingParent) ?? false, "missing parent issue");
  } },
  { name: "Broken trace cannot silently pass", run: async () => {
    const f = fixture({ brokenTrace: true }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.FailedTraceIntegrity, "broken trace status");
  } },
  { name: "Cost Ledger remains accounting source of truth", run: async () => {
    const f = fixture({ actualMinorUnits: 1_000 }); const result = await f.workflow.execute(f.request);
    const committed = f.ledgerRepository.allEntries().filter((entry) => [AICostLedgerEntryType.UsageCommitted, AICostLedgerEntryType.UsagePartiallyCommitted].includes(entry.entryType)).reduce((sum, entry) => sum + entry.amount.minorUnits, 0);
    assertEqual(committed, result.reconciliation?.committedMinorUnits, "ledger accounting total");
  } },
  { name: "Audit Repository does not recalculate monetary totals", run: async () => {
    const f = fixture(); await f.workflow.execute(f.request);
    const auditRecords = f.auditRepository.query().records;
    assertTrue(auditRecords.every((record) => !("committedMinorUnits" in record.metadata)), "audit monetary calculation");
  } },
  { name: "Compensation never re-executes provider", run: async () => {
    const f = fixture({ ledgerFailAt: 1 }); await f.workflow.execute(f.request);
    assertEqual(f.adapter.invocationCount, 0, "compensation adapter execution");
  } },
  { name: "Audit failure after monetary success is explicit", run: async () => {
    const f = fixture({ auditRejectedType: AIAuditRecordType.ExecutionCoordinatorResult, auditFailureMode: AIRuntimeAuditFailureMode.WarnAfterMonetarySuccess }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.CompletedWithWarning, "post-monetary audit warning");
    assertTrue(result.reasons.includes("POST_MONETARY_AUDIT_FAILURE"), "audit warning reason");
  } },
  { name: "Settlement ledger failure recommends idempotent replay", run: async () => {
    const f = fixture({ ledgerFailAt: 2 }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.FailedLedger, "settlement ledger failure");
    assertEqual(result.retryDisposition, AIRuntimeWorkflowRetryDisposition.ManualLedgerReplay, "ledger replay disposition");
  } },
  { name: "Actual usage above reservation fails settlement without re-execution", run: async () => {
    const f = fixture({ actualMinorUnits: 9_000 }); const result = await f.workflow.execute(f.request);
    assertEqual(result.status, AIRuntimeWorkflowStatus.FailedSettlement, "overrun settlement");
    assertEqual(f.adapter.invocationCount, 1, "overrun execution count");
  } },
  { name: "Stage ordering is stable", run: async () => {
    const first = fixture(); const second = fixture();
    const left = (await first.workflow.execute(first.request)).stages.map((stage) => stage.stage);
    const right = (await second.workflow.execute(second.request)).stages.map((stage) => stage.stage);
    assertDeepEqual(left, right, "stage order");
  } },
  { name: "No provider SDK network credential or Python integration exists", run: () => {
    const implementation = readFileSync("src/engines/ai-runtime-workflow/AIRuntimeWorkflow.ts", "utf8");
    assertTrue(!/from ["'](?:openai|@anthropic|@google)|\bfetch\s*\(|XMLHttpRequest|WebSocket|https?\.request|axios|api.?key|access.?token|\.py\b/i.test(implementation), "forbidden runtime integration");
  } },
  { name: "Runtime repositories remain provider-neutral", run: () => {
    assertEqual(new InMemoryAICostLedgerRepository().repositoryType, AICostLedgerRepositoryType.InMemory, "ledger repository type");
    assertEqual(new InMemoryAIAuditRepository().repositoryType, AIAuditRepositoryType.InMemory, "audit repository type");
  } },
];

async function runTests(): Promise<void> {
  let passed = 0;
  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`PASS ${test.name}`);
    } catch (error: unknown) {
      console.error(`FAIL ${test.name}`);
      throw error;
    }
  }
  console.log(`AI Runtime Workflow tests: ${passed}/${tests.length} passed.`);
}

void runTests();
