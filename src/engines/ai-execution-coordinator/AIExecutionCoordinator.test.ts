import {
  AICapability,
  AIErrorCategory,
  AIExecutionCoordinatorErrorCategory,
  AIExecutionCoordinatorStatus,
  AIExecutionFinishReason,
  AIExecutionInputType,
  AIExecutionStatus,
  AIOutputType,
  AIProviderAdapterErrorCategory,
  AIProviderHealthStatus,
  AIReservationInstructionType,
  AIRetryAction,
  AIUsageSettlementInstructionType,
  AITaskType,
  BudgetScope,
  CostDecisionReason,
  CostDecisionStatus,
  LatencyPriority,
  ModelAvailability,
  PrivacyLevel,
  ProviderProcessingBoundary,
  ReasoningLevel,
  RoutingAuditStatus,
  RoutingCostMode,
  RoutingDecisionStatus,
  RoutingTieBreakField,
  type AIAdapterCompatibility,
  type AIExecutionCoordinatorRequest,
  type AIExecutionResponse,
  type AIProviderAdapter,
  type AIProviderAdapterDescriptor,
  type AIProviderAdapterError,
  type AIProviderCancellation,
  type AIProviderExecutionContext,
  type AIProviderHealth,
  type AIRequest,
  type AIRouterConfiguration,
  type RoutingDecision,
} from "../../contracts";
import { evaluateAICost } from "../ai-cost-governor";
import {
  InMemoryAIProviderAdapterRegistry,
  evaluateAdapterCompatibility,
} from "../ai-provider-adapter";
import { routeAIRequest } from "../ai-router";
import { DeterministicAIExecutionCoordinator } from "./AIExecutionCoordinator";

interface TestCase {
  readonly name: string;
  readonly run: () => void | Promise<void>;
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message);
  }
}

const now = "2026-07-18T18:00:00.000Z";
const providerId = "neutral-provider-a";
const modelId = "neutral-model-a";

const originalRequest: AIRequest = {
  contractVersion: "1.0",
  requestId: "coordinator-request-1",
  requestedAt: now,
  requestedBy: "fixture-module",
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
    allowedProcessingRegions: ["fixture-region"],
    retentionAllowed: false,
    deterministicAllowed: true,
    contextReductionAllowed: false,
    expectedOutputType: AIOutputType.Text,
    strictSchema: false,
    functionCallingRequired: false,
  },
  contextFingerprint: "sha256:coordinator-fixture",
};

const routerConfiguration: AIRouterConfiguration = {
  contractVersion: "1.0",
  configurationVersion: "coordinator-router-v1",
  providerRegistry: {
    version: "coordinator-providers-v1",
    providers: [
      {
        providerId,
        name: "Neutral Fixture Provider",
        adapterId: "neutral-fixture-adapter",
        enabled: true,
        processingBoundary: ProviderProcessingBoundary.External,
        supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
        supportedProcessingRegions: ["fixture-region"],
        zeroRetentionSupported: true,
        reliability: 1,
        availability: ModelAvailability.Available,
        modelIds: [modelId],
      },
    ],
  },
  modelRegistry: {
    version: "coordinator-models-v1",
    models: [
      {
        modelId,
        providerId,
        providerModelReference: "neutral-model-reference",
        enabled: true,
        capabilities: [AICapability.Fast, AICapability.LowCost],
        supportedReasoningLevels: [ReasoningLevel.Low],
        supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
        supportedOutputTypes: [AIOutputType.Text],
        contextLimitTokens: 16_000,
        maximumOutputTokens: 2_000,
        visionSupport: false,
        functionCallingSupport: false,
        strictStructuredOutputSupport: false,
        reliability: 1,
        availability: ModelAvailability.Available,
        estimatedP95LatencyMs: 20,
        cost: {
          currency: "USD",
          inputPerMillionTokens: 1,
          outputPerMillionTokens: 2,
          fixedRequestCost: 0,
          pricingVersion: "fixture-pricing-v1",
          effectiveAt: now,
        },
      },
    ],
  },
  routingPolicy: {
    version: "coordinator-routing-v1",
    capabilityProfiles: [
      {
        capability: AICapability.Fast,
        minimumReliability: 0.9,
        functionCallingRequired: false,
        visionRequired: false,
      },
    ],
    taskPolicies: [
      {
        taskType: AITaskType.Summary,
        requiredCapabilities: [AICapability.Fast],
        minimumReasoningLevel: ReasoningLevel.Low,
        allowedOutputTypes: [AIOutputType.Text],
        minimumReliability: 0.9,
        costMode: RoutingCostMode.Balanced,
        deterministicOnly: false,
      },
    ],
    contextSafetyMarginTokens: 100,
    staleHealthAfterMs: 60_000,
    stableTieBreakOrder: [
      RoutingTieBreakField.Reliability,
      RoutingTieBreakField.Latency,
      RoutingTieBreakField.EstimatedCost,
      RoutingTieBreakField.ProviderId,
      RoutingTieBreakField.ModelId,
    ],
  },
  budgetPolicy: {
    policyId: "router-budget",
    version: "router-budget-v1",
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
    version: "coordinator-fallback-v1",
    maximumTotalAttempts: 2,
    maximumRetriesPerCandidate: 1,
    outputRepairRetries: 0,
    retryableErrorCategories: [
      AIErrorCategory.ProviderUnavailable,
      AIErrorCategory.RateLimited,
      AIErrorCategory.Timeout,
    ],
    baseBackoffMs: 100,
    maximumBackoffMs: 1_000,
  },
  featureFlags: {
    deterministicGateEnabled: true,
    providerExecutionEnabled: false,
    fallbackEnabled: true,
    costGovernanceEnabled: true,
    auditLoggingEnabled: true,
    criticalOverridesEnabled: false,
  },
};

const routed = routeAIRequest(
  { request: originalRequest, configuration: routerConfiguration },
  { now: () => now },
);
if (!routed.success) {
  throw new Error("Coordinator fixture Router decision must succeed.");
}

const governed = evaluateAICost(
  {
    request: {
      contractVersion: "1.0",
      requestId: originalRequest.requestId,
      requestedAt: now,
      taskType: originalRequest.taskType,
      reasoningLevel: originalRequest.reasoningLevel,
      providerId,
      modelId,
      estimatedCost: { minorUnits: 100, currency: "USD" },
      reservationId: "reservation-1",
    },
    policy: {
      policyId: "cost-policy",
      version: "cost-policy-v1",
      currency: "USD",
      minorUnitScale: 1_000_000,
      limits: [
        {
          scope: BudgetScope.PerRequest,
          enabled: true,
          currency: "USD",
          softLimitMinorUnits: 800,
          hardLimitMinorUnits: 1_000,
          policyVersion: "cost-policy-v1",
        },
      ],
      lowCostModeEnabled: true,
      criticalOverrideFeatureEnabled: false,
      criticalOverrideAllowed: false,
      criticalTaskTypes: [],
      criticalReasoningLevels: [],
      reservationTtlMs: 60_000,
    },
    budgetUsage: {
      snapshotId: "cost-usage-1",
      capturedAt: now,
      currency: "USD",
      usages: [],
    },
  },
  { now: () => now },
);
if (governed.decision.reservation === undefined) {
  throw new Error("Coordinator fixture Cost Governor must create a reservation.");
}

const executionPolicy = {
  policyId: "execution-policy",
  version: "execution-policy-v1",
  reservationRequired: true,
  maximumAttempts: 2,
  acceptedHealthStatuses: [
    AIProviderHealthStatus.Available,
    AIProviderHealthStatus.Degraded,
  ],
  lowCostEligibleModelIds: [modelId],
  retrySameAdapterOn: [
    AIProviderAdapterErrorCategory.Timeout,
    AIProviderAdapterErrorCategory.RateLimited,
    AIProviderAdapterErrorCategory.ProviderError,
  ],
  returnToRouterOn: [
    AIProviderAdapterErrorCategory.RateLimited,
    AIProviderAdapterErrorCategory.ProviderUnavailable,
  ],
  retainReservationForRetry: true,
  releaseUnusedReservation: true,
} as const;

const coordinatorRequest: AIExecutionCoordinatorRequest = {
  originalRequest,
  routingDecision: routed.decision,
  routingAuditRecord: routed.auditRecord,
  costDecision: governed.decision,
  costAuditRecord: governed.auditRecord,
  plannedReservation: governed.decision.reservation,
  executionInput: {
    type: AIExecutionInputType.Structured,
    content: { fixture: "neutral coordinator input" },
    schemaId: "fixture-input-v1",
  },
  timeoutPolicy: {
    timeoutMs: 5_000,
    deadlineAt: "2026-07-18T18:00:05.000Z",
  },
  cancellation: {
    cancellationId: "coordinator-cancellation-1",
    requested: false,
  },
  attemptNumber: 1,
  traceId: "coordinator-trace-1",
  correlationId: "coordinator-correlation-1",
  policy: executionPolicy,
};

type FixtureMode =
  | "SUCCESS"
  | "TIMEOUT"
  | "CANCELLED"
  | "RATE_LIMITED"
  | "AUTHENTICATION_FAILED"
  | "PROVIDER_ERROR_RETRYABLE"
  | "PROVIDER_ERROR_FINAL"
  | "MALFORMED_OUTPUT"
  | "EMPTY_RESPONSE"
  | "PROVIDER_MISMATCH"
  | "MODEL_MISMATCH"
  | "NEGATIVE_USAGE"
  | "NONFINITE_USAGE"
  | "CURRENCY_MISMATCH";

class CoordinatorFixtureAdapter implements AIProviderAdapter {
  executeCount = 0;
  readonly executedSelections: Array<{ providerId: string; modelId: string }> = [];

  constructor(
    private readonly mode: FixtureMode = "SUCCESS",
    private readonly descriptor: AIProviderAdapterDescriptor = {
      adapterId: "neutral-fixture-adapter",
      providerId,
      displayName: "Neutral Coordinator Fixture",
      version: "fixture-v1",
      enabled: true,
      supportedModelIds: [modelId],
      capabilities: {
        supportedCapabilities: [AICapability.Fast, AICapability.LowCost],
        supportedOutputTypes: [AIOutputType.Text],
        supportedReasoningLevels: [ReasoningLevel.Low],
        supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
        maximumContextTokens: 16_000,
        maximumOutputTokens: 2_000,
        timeoutSupported: true,
        cancellationSupported: true,
        structuredOutputSupported: true,
      },
    },
    private readonly health: AIProviderHealth = {
      providerId,
      status: AIProviderHealthStatus.Available,
      observedAt: now,
      estimatedLatencyMs: 20,
      reliability: 1,
      rateLimited: false,
      source: "TEST_FIXTURE",
      expiresAt: "2026-07-18T18:01:00.000Z",
    },
  ) {}

  getDescriptor(): Readonly<AIProviderAdapterDescriptor> {
    return this.descriptor;
  }

  getHealth(): Readonly<AIProviderHealth> {
    return this.health;
  }

  supports(request: Readonly<Parameters<AIProviderAdapter["supports"]>[0]>): AIAdapterCompatibility {
    return evaluateAdapterCompatibility(this.descriptor, request);
  }

  normalizeError(
    error: unknown,
    request: Readonly<Parameters<AIProviderAdapter["execute"]>[0]>,
    context: Readonly<AIProviderExecutionContext>,
  ): AIProviderAdapterError {
    const category =
      error instanceof Error &&
      Object.values(AIProviderAdapterErrorCategory).includes(
        error.message as AIProviderAdapterErrorCategory,
      )
        ? (error.message as AIProviderAdapterErrorCategory)
        : AIProviderAdapterErrorCategory.Unknown;
    return this.error(category, request, context);
  }

  async execute(
    request: Readonly<Parameters<AIProviderAdapter["execute"]>[0]>,
    context: Readonly<AIProviderExecutionContext>,
  ): Promise<AIExecutionResponse> {
    this.executeCount += 1;
    this.executedSelections.push({
      providerId: request.providerId,
      modelId: request.modelId,
    });
    if (this.mode === "TIMEOUT") {
      return this.failure(AIExecutionStatus.TimedOut, AIProviderAdapterErrorCategory.Timeout, request, context);
    }
    if (this.mode === "CANCELLED") {
      return this.failure(AIExecutionStatus.Cancelled, AIProviderAdapterErrorCategory.Cancelled, request, context);
    }
    if (this.mode === "RATE_LIMITED") {
      return this.failure(AIExecutionStatus.Failed, AIProviderAdapterErrorCategory.RateLimited, request, context);
    }
    if (this.mode === "AUTHENTICATION_FAILED") {
      return this.failure(AIExecutionStatus.Failed, AIProviderAdapterErrorCategory.AuthenticationFailed, request, context);
    }
    if (this.mode === "PROVIDER_ERROR_RETRYABLE") {
      return this.failure(AIExecutionStatus.Failed, AIProviderAdapterErrorCategory.ProviderError, request, context, true);
    }
    if (this.mode === "PROVIDER_ERROR_FINAL") {
      return this.failure(AIExecutionStatus.Failed, AIProviderAdapterErrorCategory.ProviderError, request, context, false);
    }
    if (this.mode === "EMPTY_RESPONSE") {
      return {} as AIExecutionResponse;
    }

    const response: AIExecutionResponse = {
      requestId: request.requestId,
      providerId:
        this.mode === "PROVIDER_MISMATCH" ? "neutral-provider-b" : request.providerId,
      modelId:
        this.mode === "MODEL_MISMATCH" ? "neutral-model-b" : request.modelId,
      status: AIExecutionStatus.Completed,
      metadata: {
        startedAt: context.invokedAt,
        completedAt: "2026-07-18T18:00:00.020Z",
        latencyMs: 20,
        attemptNumber: context.attemptNumber,
        providerRequestId: "fixture-provider-request-1",
      },
      audit: {
        traceId: request.traceId,
        ...(request.correlationId === undefined
          ? {}
          : { correlationId: request.correlationId }),
        routingDecisionId: request.routingDecisionId,
        costGovernorDecisionId: request.costGovernorDecisionId,
        reservationId: request.reservationId,
        adapterId: this.descriptor.adapterId,
        adapterVersion: this.descriptor.version,
      },
      retryable: false,
      warnings: [],
      output: {
        type:
          this.mode === "MALFORMED_OUTPUT"
            ? AIOutputType.StructuredJson
            : request.expectedOutputType,
        content: "Deterministic coordinator fixture output.",
      },
      usage: {
        inputTokens:
          this.mode === "NEGATIVE_USAGE"
            ? -1
            : this.mode === "NONFINITE_USAGE"
              ? Number.NaN
              : 20,
        outputTokens: 5,
        totalTokens:
          this.mode === "NEGATIVE_USAGE"
            ? 4
            : this.mode === "NONFINITE_USAGE"
              ? Number.NaN
              : 25,
        reportedCost: {
          minorUnits: 25,
          currency: this.mode === "CURRENCY_MISMATCH" ? "EUR" : "USD",
        },
      },
      finishReason: AIExecutionFinishReason.Completed,
    };
    return response;
  }

  private failure(
    status:
      | AIExecutionStatus.Failed
      | AIExecutionStatus.TimedOut
      | AIExecutionStatus.Cancelled,
    category: AIProviderAdapterErrorCategory,
    request: Readonly<Parameters<AIProviderAdapter["execute"]>[0]>,
    context: Readonly<AIProviderExecutionContext>,
    retryableOverride?: boolean,
  ): AIExecutionResponse {
    const error = this.error(category, request, context, retryableOverride);
    return {
      requestId: request.requestId,
      providerId: request.providerId,
      modelId: request.modelId,
      status,
      metadata: {
        startedAt: context.invokedAt,
        completedAt: "2026-07-18T18:00:00.020Z",
        latencyMs: 20,
        attemptNumber: context.attemptNumber,
      },
      audit: {
        traceId: request.traceId,
        ...(request.correlationId === undefined
          ? {}
          : { correlationId: request.correlationId }),
        routingDecisionId: request.routingDecisionId,
        costGovernorDecisionId: request.costGovernorDecisionId,
        reservationId: request.reservationId,
        adapterId: this.descriptor.adapterId,
        adapterVersion: this.descriptor.version,
      },
      retryable: error.retryable,
      warnings: [],
      error,
      finishReason:
        status === AIExecutionStatus.TimedOut
          ? AIExecutionFinishReason.Timeout
          : status === AIExecutionStatus.Cancelled
            ? AIExecutionFinishReason.Cancelled
            : AIExecutionFinishReason.Error,
    };
  }

  private error(
    category: AIProviderAdapterErrorCategory,
    request: Readonly<Parameters<AIProviderAdapter["execute"]>[0]>,
    context: Readonly<AIProviderExecutionContext>,
    retryableOverride?: boolean,
  ): AIProviderAdapterError {
    const retryable =
      retryableOverride ??
      [
        AIProviderAdapterErrorCategory.Timeout,
        AIProviderAdapterErrorCategory.RateLimited,
      ].includes(category);
    return {
      category,
      code: `FIXTURE_${category}`,
      safeMessage: `Fixture normalized ${category.toLowerCase()}.`,
      retryable,
      occurredAt: context.invokedAt,
      providerId: request.providerId,
      modelId: request.modelId,
      ...(category === AIProviderAdapterErrorCategory.RateLimited
        ? { retryAfterMs: 1_000 }
        : {}),
    };
  }
}

function createRegistry(adapter?: AIProviderAdapter): InMemoryAIProviderAdapterRegistry {
  const registry = new InMemoryAIProviderAdapterRegistry();
  if (adapter !== undefined) {
    registry.register(adapter);
  }
  return registry;
}

function createCoordinator(): DeterministicAIExecutionCoordinator {
  return new DeterministicAIExecutionCoordinator({
    clock: { now: () => now },
    executionIdSource: {
      nextId: (requestId) => `execution:${requestId}`,
    },
  });
}

async function coordinate(
  request: AIExecutionCoordinatorRequest = coordinatorRequest,
  adapter: AIProviderAdapter = new CoordinatorFixtureAdapter(),
) {
  return createCoordinator().execute(request, createRegistry(adapter));
}

function rejectedRoutingRequest(): AIExecutionCoordinatorRequest {
  const decision: RoutingDecision = {
    ...routed.decision,
    status: RoutingDecisionStatus.Rejected,
    rejectionReasons: ["TEST_REJECTION"],
  };
  return {
    ...coordinatorRequest,
    routingDecision: decision,
    routingAuditRecord: {
      ...routed.auditRecord,
      finalStatus: RoutingAuditStatus.Rejected,
    },
  };
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "approved Router and Governor decisions execute successfully",
    run: async () => {
      const result = await coordinate();
      assertEqual(result.status, AIExecutionCoordinatorStatus.ExecutionSucceeded, "status");
      assertEqual(result.attempts.length, 1, "attempts");
    },
  },
  {
    name: "routing rejection prevents execution",
    run: async () => {
      const adapter = new CoordinatorFixtureAdapter();
      const result = await coordinate(rejectedRoutingRequest(), adapter);
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.RoutingNotApproved, "error");
      assertEqual(adapter.executeCount, 0, "execution count");
    },
  },
  {
    name: "cost rejection prevents execution",
    run: async () => {
      const adapter = new CoordinatorFixtureAdapter();
      const rejectedCost = {
        ...governed.decision,
        status: CostDecisionStatus.RejectedBudgetExceeded,
        reasons: [CostDecisionReason.HardLimitExceeded],
      };
      const result = await coordinate({
        ...coordinatorRequest,
        costDecision: rejectedCost,
        costAuditRecord: {
          ...governed.auditRecord,
          decisionStatus: CostDecisionStatus.RejectedBudgetExceeded,
        },
      }, adapter);
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.CostNotApproved, "error");
      assertEqual(adapter.executeCount, 0, "execution count");
    },
  },
  {
    name: "low-cost-only mismatch prevents execution",
    run: async () => {
      const lowCostDecision = {
        ...governed.decision,
        status: CostDecisionStatus.AllowedLowCostOnly,
        lowCostRequired: true,
      };
      const result = await coordinate({
        ...coordinatorRequest,
        costDecision: lowCostDecision,
        costAuditRecord: {
          ...governed.auditRecord,
          decisionStatus: CostDecisionStatus.AllowedLowCostOnly,
          lowCostRequired: true,
        },
        policy: { ...executionPolicy, lowCostEligibleModelIds: [] },
      });
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.LowCostConstraintViolated, "error");
    },
  },
  {
    name: "missing required reservation is rejected",
    run: async () => {
      const { plannedReservation: _reservation, ...withoutReservation } = coordinatorRequest;
      const result = await coordinate(withoutReservation);
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.ReservationMissing, "error");
    },
  },
  {
    name: "reservation request mismatch is rejected",
    run: async () => {
      const result = await coordinate({
        ...coordinatorRequest,
        plannedReservation: {
          ...coordinatorRequest.plannedReservation!,
          requestId: "different-request",
        },
      });
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.ReservationMismatch, "error");
    },
  },
  {
    name: "reservation currency mismatch is rejected",
    run: async () => {
      const result = await coordinate({
        ...coordinatorRequest,
        plannedReservation: {
          ...coordinatorRequest.plannedReservation!,
          amount: {
            ...coordinatorRequest.plannedReservation!.amount,
            currency: "EUR",
          },
        },
      });
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.CurrencyMismatch, "error");
    },
  },
  {
    name: "adapter not found is rejected",
    run: async () => {
      const result = await createCoordinator().execute(
        coordinatorRequest,
        createRegistry(),
      );
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.AdapterNotFound, "error");
    },
  },
  {
    name: "adapter incompatibility is rejected",
    run: async () => {
      const descriptor = new CoordinatorFixtureAdapter().getDescriptor();
      const adapter = new CoordinatorFixtureAdapter("SUCCESS", {
        ...descriptor,
        capabilities: {
          ...descriptor.capabilities,
          supportedCapabilities: [AICapability.LowCost],
        },
      });
      const result = await coordinate(coordinatorRequest, adapter);
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.AdapterIncompatible, "error");
      assertEqual(adapter.executeCount, 0, "execution count");
    },
  },
  {
    name: "unavailable provider is rejected before execution",
    run: async () => {
      const adapter = new CoordinatorFixtureAdapter("SUCCESS", undefined, {
        providerId,
        status: AIProviderHealthStatus.Unavailable,
        observedAt: now,
        rateLimited: false,
        source: "TEST_FIXTURE",
      });
      const result = await coordinate(coordinatorRequest, adapter);
      assertTrue([
        AIExecutionCoordinatorStatus.ExecutionDeferred,
        AIExecutionCoordinatorStatus.ExecutionRequiresReroute,
      ].includes(result.status), "unavailable status");
      assertEqual(adapter.executeCount, 0, "execution count");
    },
  },
  {
    name: "adapter executes only the selected provider and model",
    run: async () => {
      const adapter = new CoordinatorFixtureAdapter();
      await coordinate(coordinatorRequest, adapter);
      assertDeepEqual(adapter.executedSelections, [{ providerId, modelId }], "selection");
    },
  },
  {
    name: "provider mismatch in response is rejected",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("PROVIDER_MISMATCH"));
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.ProviderModelMismatch, "error");
      assertEqual(result.status, AIExecutionCoordinatorStatus.ExecutionInvalidResponse, "status");
    },
  },
  {
    name: "model mismatch in response is rejected",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("MODEL_MISMATCH"));
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.ProviderModelMismatch, "error");
    },
  },
  {
    name: "successful response generates commit and release instructions",
    run: async () => {
      const result = await coordinate();
      assertEqual(result.usageSettlementInstructions[0]?.type, AIUsageSettlementInstructionType.CommitUsage, "usage instruction");
      assertEqual(result.reservationInstructions[0]?.type, AIReservationInstructionType.ReleaseUnusedReservation, "reservation instruction");
    },
  },
  {
    name: "failed final response releases the reservation",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("AUTHENTICATION_FAILED"));
      assertEqual(result.reservationInstructions[0]?.type, AIReservationInstructionType.ReleaseReservation, "instruction");
    },
  },
  {
    name: "retryable failure retains the reservation",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("PROVIDER_ERROR_RETRYABLE"));
      assertEqual(result.retryPlan.action, AIRetryAction.RetrySameAdapter, "retry action");
      assertEqual(result.reservationInstructions[0]?.type, AIReservationInstructionType.RetainForRetry, "instruction");
    },
  },
  {
    name: "timeout is normalized",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("TIMEOUT"));
      assertEqual(result.status, AIExecutionCoordinatorStatus.ExecutionTimedOut, "status");
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.Timeout, "error");
    },
  },
  {
    name: "pre-execution cancellation is normalized",
    run: async () => {
      const adapter = new CoordinatorFixtureAdapter();
      const cancellation: AIProviderCancellation = {
        cancellationId: coordinatorRequest.cancellation.cancellationId,
        requested: true,
        requestedAt: now,
        reason: "Fixture cancellation.",
      };
      const result = await coordinate({ ...coordinatorRequest, cancellation }, adapter);
      assertEqual(result.status, AIExecutionCoordinatorStatus.ExecutionCancelled, "status");
      assertEqual(adapter.executeCount, 0, "execution count");
    },
  },
  {
    name: "adapter cancellation is normalized",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("CANCELLED"));
      assertEqual(result.status, AIExecutionCoordinatorStatus.ExecutionCancelled, "status");
    },
  },
  {
    name: "rate limit follows bounded same-adapter retry policy",
    run: async () => {
      const adapter = new CoordinatorFixtureAdapter("RATE_LIMITED");
      const result = await coordinate(coordinatorRequest, adapter);
      assertEqual(result.retryPlan.action, AIRetryAction.RetrySameAdapter, "retry action");
      assertEqual(adapter.executeCount, 1, "single invocation");
    },
  },
  {
    name: "exhausted rate limit returns control to Router",
    run: async () => {
      const result = await coordinate(
        { ...coordinatorRequest, attemptNumber: 2 },
        new CoordinatorFixtureAdapter("RATE_LIMITED"),
      );
      assertEqual(result.status, AIExecutionCoordinatorStatus.ExecutionRequiresReroute, "status");
      assertTrue(result.fallbackPlan?.returnToRouter === true, "fallback plan");
    },
  },
  {
    name: "authentication failure is non-retryable",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("AUTHENTICATION_FAILED"));
      assertEqual(result.retryPlan.action, AIRetryAction.RejectFinal, "retry action");
      assertTrue(!result.retryPlan.retryable, "not retryable");
    },
  },
  {
    name: "malformed output response is rejected",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("MALFORMED_OUTPUT"));
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.MalformedProviderResponse, "error");
    },
  },
  {
    name: "missing response metadata is normalized without a secondary failure",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("EMPTY_RESPONSE"));
      assertEqual(result.status, AIExecutionCoordinatorStatus.ExecutionInvalidResponse, "status");
      assertEqual(result.attempts[0]?.latencyMs, 0, "safe latency");
    },
  },
  {
    name: "negative usage metadata is rejected",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("NEGATIVE_USAGE"));
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.UsageMetadataInvalid, "error");
    },
  },
  {
    name: "non-finite usage metadata is rejected",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("NONFINITE_USAGE"));
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.UsageMetadataInvalid, "error");
    },
  },
  {
    name: "reported cost currency mismatch is rejected",
    run: async () => {
      const result = await coordinate(coordinatorRequest, new CoordinatorFixtureAdapter("CURRENCY_MISMATCH"));
      assertEqual(result.error?.category, AIExecutionCoordinatorErrorCategory.CurrencyMismatch, "error");
    },
  },
  {
    name: "same input and fixture behavior produce the same result",
    run: async () => {
      assertDeepEqual(await coordinate(), await coordinate(), "coordinator result");
    },
  },
  {
    name: "coordinator does not mutate inputs",
    run: async () => {
      const before = JSON.stringify(coordinatorRequest);
      await coordinate();
      assertEqual(JSON.stringify(coordinatorRequest), before, "input snapshot");
    },
  },
  {
    name: "audit record contains every upstream and execution reference",
    run: async () => {
      const result = await coordinate();
      const audit = result.auditRecord;
      assertEqual(audit.executionId, result.executionId, "execution reference");
      assertEqual(audit.routingDecisionId, routed.decision.decisionId, "routing reference");
      assertEqual(audit.costGovernorDecisionId, governed.decision.decisionId, "cost reference");
      assertEqual(audit.reservationId, governed.decision.reservation?.reservationId, "reservation reference");
      assertEqual(audit.traceId, coordinatorRequest.traceId, "trace reference");
      assertEqual(audit.attempts.length, 1, "attempt audit");
      assertTrue(audit.adapterDescriptor !== undefined, "adapter descriptor");
      assertTrue(audit.providerHealth !== undefined, "provider health");
    },
  },
  {
    name: "coordinator never chooses a different provider or model",
    run: async () => {
      const result = await coordinate();
      assertEqual(result.executionPlan?.providerId, providerId, "provider");
      assertEqual(result.executionPlan?.modelId, modelId, "model");
      assertTrue(result.fallbackPlan === undefined, "no hidden fallback");
    },
  },
  {
    name: "coordinator returns instructions without ledger or budget mutation",
    run: async () => {
      const beforeReservation = JSON.stringify(coordinatorRequest.plannedReservation);
      const result = await coordinate();
      assertEqual(JSON.stringify(coordinatorRequest.plannedReservation), beforeReservation, "reservation snapshot");
      assertTrue(!("ledger" in (result as unknown as Record<string, unknown>)), "no ledger");
    },
  },
  {
    name: "coordinator performs no live retry loop",
    run: async () => {
      const adapter = new CoordinatorFixtureAdapter("RATE_LIMITED");
      const result = await coordinate(coordinatorRequest, adapter);
      assertEqual(adapter.executeCount, 1, "single invocation");
      assertEqual(result.attempts.length, 1, "single attempt record");
    },
  },
  {
    name: "fixture and coordinator contain no network activity",
    run: () => {
      const fixtureSource = CoordinatorFixtureAdapter.prototype.execute.toString();
      const coordinatorSource = DeterministicAIExecutionCoordinator.prototype.execute.toString();
      assertTrue(!/fetch|XMLHttpRequest|WebSocket|https?\.request|axios/i.test(fixtureSource), "fixture network-free");
      assertTrue(!/fetch|XMLHttpRequest|WebSocket|https?\.request|axios/i.test(coordinatorSource), "coordinator network-free");
    },
  },
];

async function runTests(): Promise<void> {
  let passed = 0;
  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`FAIL: ${test.name}: ${message}`);
      throw error;
    }
  }
  console.log(
    `AI Execution Coordinator: ${String(passed)}/${String(tests.length)} tests passed.`,
  );
}

void runTests();
