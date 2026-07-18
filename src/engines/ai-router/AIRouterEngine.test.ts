import {
  AICapability,
  AIErrorCategory,
  AIOutputType,
  AITaskType,
  LatencyPriority,
  ModelAvailability,
  PrivacyLevel,
  ProviderProcessingBoundary,
  ReasoningLevel,
  RoutingCostMode,
  RoutingDecisionStatus,
  RoutingTieBreakField,
  type AIRequest,
  type AIRouterConfiguration,
  type ModelDefinition,
  type ProviderDefinition,
} from "../../contracts";
import {
  CandidateRejectionReason,
  estimateModelCost,
  routeAIRequest,
  type AIRouterEngineClock,
  type AIRouterEngineResult,
  type BudgetUsageSnapshot,
} from "./AIRouterEngine";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
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

function assertSuccess(
  result: AIRouterEngineResult,
): asserts result is Extract<AIRouterEngineResult, { readonly success: true }> {
  assertTrue(
    result.success,
    result.success ? "" : `Expected success, received ${result.error.category}.`,
  );
}

function assertFailure(
  result: AIRouterEngineResult,
): asserts result is Extract<AIRouterEngineResult, { readonly success: false }> {
  assertTrue(!result.success, "Expected routing failure.");
}

const now = "2026-07-18T16:00:00.000Z";
const clock: AIRouterEngineClock = { now: () => now };

function createProvider(
  providerId: string,
  modelId: string,
  overrides: Partial<ProviderDefinition> = {},
): ProviderDefinition {
  return {
    providerId,
    name: `Neutral ${providerId}`,
    adapterId: `${providerId}-adapter`,
    enabled: true,
    processingBoundary: ProviderProcessingBoundary.External,
    supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
    supportedProcessingRegions: ["region-a"],
    zeroRetentionSupported: true,
    reliability: 0.999,
    availability: ModelAvailability.Available,
    modelIds: [modelId],
    ...overrides,
  };
}

function createModel(
  providerId: string,
  modelId: string,
  overrides: Partial<ModelDefinition> = {},
): ModelDefinition {
  return {
    modelId,
    providerId,
    providerModelReference: `${modelId}-reference`,
    enabled: true,
    capabilities: [
      AICapability.Fast,
      AICapability.LowCost,
      AICapability.CriticalDecision,
    ],
    supportedReasoningLevels: [
      ReasoningLevel.Low,
      ReasoningLevel.Medium,
      ReasoningLevel.High,
      ReasoningLevel.Critical,
    ],
    supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
    supportedOutputTypes: [AIOutputType.Text, AIOutputType.StructuredJson],
    contextLimitTokens: 32_000,
    maximumOutputTokens: 4_000,
    visionSupport: false,
    functionCallingSupport: true,
    strictStructuredOutputSupport: true,
    reliability: 0.95,
    availability: ModelAvailability.Available,
    estimatedP95LatencyMs: 1_500,
    cost: {
      currency: "USD",
      inputPerMillionTokens: 1.5,
      outputPerMillionTokens: 3,
      fixedRequestCost: 0,
      pricingVersion: "test-pricing-v1",
      effectiveAt: now,
    },
    ...overrides,
  };
}

const modelA = createModel("provider-a", "model-a", {
  reliability: 0.99,
  estimatedP95LatencyMs: 2_000,
  cost: {
    currency: "USD",
    inputPerMillionTokens: 2,
    outputPerMillionTokens: 4,
    fixedRequestCost: 0,
    pricingVersion: "test-pricing-v1",
    effectiveAt: now,
  },
});
const modelB = createModel("provider-b", "model-b", {
  reliability: 0.97,
  estimatedP95LatencyMs: 1_000,
  cost: {
    currency: "USD",
    inputPerMillionTokens: 1,
    outputPerMillionTokens: 2,
    fixedRequestCost: 0,
    pricingVersion: "test-pricing-v1",
    effectiveAt: now,
  },
});
const modelC = createModel("provider-c", "model-c", {
  reliability: 0.95,
  estimatedP95LatencyMs: 1_500,
});

const providerA = createProvider("provider-a", modelA.modelId);
const providerB = createProvider("provider-b", modelB.modelId);
const providerC = createProvider("provider-c", modelC.modelId);

const request: AIRequest = {
  contractVersion: "1.0",
  requestId: "request-route-1",
  requestedAt: now,
  requestedBy: "summary-module",
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
    deterministicAllowed: true,
    contextReductionAllowed: false,
    expectedOutputType: AIOutputType.StructuredJson,
    outputSchemaId: "summary-v1",
    strictSchema: true,
    functionCallingRequired: false,
  },
  contextFingerprint: "sha256:router-engine-test",
};

const configuration: AIRouterConfiguration = {
  contractVersion: "1.0",
  configurationVersion: "router-test-v1",
  providerRegistry: {
    version: "providers-test-v1",
    providers: [providerA, providerB, providerC],
  },
  modelRegistry: {
    version: "models-test-v1",
    models: [modelA, modelB, modelC],
  },
  routingPolicy: {
    version: "routing-test-v1",
    capabilityProfiles: [
      {
        capability: AICapability.Fast,
        minimumReliability: 0.9,
        functionCallingRequired: false,
        visionRequired: false,
      },
      {
        capability: AICapability.LowCost,
        minimumReliability: 0.9,
        functionCallingRequired: false,
        visionRequired: false,
      },
      {
        capability: AICapability.CriticalDecision,
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
        allowedOutputTypes: [AIOutputType.Text, AIOutputType.StructuredJson],
        minimumReliability: 0.9,
        costMode: RoutingCostMode.Balanced,
        deterministicOnly: false,
      },
    ],
    contextSafetyMarginTokens: 500,
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
    policyId: "budget-test",
    version: "budget-test-v1",
    currency: "USD",
    perRequestLimit: 1,
    dailyBudget: 10,
    monthlyBudget: 100,
    lowCostMode: false,
    warningThresholdPercentage: 80,
    criticalOverrideAllowed: true,
    criticalOverrideLimit: 0.01,
    accountingTimezone: "America/New_York",
  },
  fallbackPolicy: {
    version: "fallback-test-v1",
    maximumTotalAttempts: 3,
    maximumRetriesPerCandidate: 1,
    outputRepairRetries: 1,
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
    criticalOverridesEnabled: true,
  },
};

function route(
  requestOverride: AIRequest = request,
  configurationOverride: AIRouterConfiguration = configuration,
  budgetUsage?: BudgetUsageSnapshot,
): AIRouterEngineResult {
  return routeAIRequest(
    {
      request: requestOverride,
      configuration: configurationOverride,
      ...(budgetUsage === undefined ? {} : { budgetUsage }),
    },
    clock,
  );
}

function withProvidersAndModels(
  providers: ReadonlyArray<ProviderDefinition>,
  models: ReadonlyArray<ModelDefinition>,
): AIRouterConfiguration {
  return {
    ...configuration,
    providerRegistry: {
      ...configuration.providerRegistry,
      providers,
    },
    modelRegistry: {
      ...configuration.modelRegistry,
      models,
    },
  };
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "identical inputs produce identical routing decisions",
    run: () => {
      const first = route();
      const second = route();
      assertSuccess(first);
      assertSuccess(second);
      assertDeepEqual(first, second, "routing results must be deterministic");
    },
  },
  {
    name: "disabled providers and models are explicitly rejected",
    run: () => {
      const disabledProvider = { ...providerA, enabled: false };
      const disabledModel = { ...modelB, enabled: false };
      const result = route(
        request,
        withProvidersAndModels(
          [disabledProvider, providerB, providerC],
          [modelA, disabledModel, modelC],
        ),
      );
      assertSuccess(result);
      assertEqual(result.decision.selectedModelId, modelC.modelId, "selection");
      assertTrue(
        result.decision.rejectedCandidates.some((candidate) =>
          candidate.reasons.includes(CandidateRejectionReason.ProviderDisabled),
        ),
        "disabled provider rejection",
      );
      assertTrue(
        result.decision.rejectedCandidates.some((candidate) =>
          candidate.reasons.includes(CandidateRejectionReason.ModelDisabled),
        ),
        "disabled model rejection",
      );
    },
  },
  {
    name: "unavailable providers and models are explicitly rejected",
    run: () => {
      const unavailableProvider = {
        ...providerA,
        availability: ModelAvailability.Unavailable,
      };
      const unavailableModel = {
        ...modelB,
        availability: ModelAvailability.RateLimited,
      };
      const result = route(
        request,
        withProvidersAndModels(
          [unavailableProvider, providerB, providerC],
          [modelA, unavailableModel, modelC],
        ),
      );
      assertSuccess(result);
      assertEqual(result.decision.selectedModelId, modelC.modelId, "selection");
      assertTrue(
        result.decision.rejectedCandidates.some((candidate) =>
          candidate.reasons.includes(
            CandidateRejectionReason.ProviderUnavailable,
          ),
        ),
        "provider availability rejection",
      );
      assertTrue(
        result.decision.rejectedCandidates.some((candidate) =>
          candidate.reasons.includes(CandidateRejectionReason.ModelUnavailable),
        ),
        "model availability rejection",
      );
    },
  },
  {
    name: "missing capability rejects every incompatible model",
    run: () => {
      const result = route({
        ...request,
        requiredCapabilities: [AICapability.Vision],
      });
      assertFailure(result);
      assertEqual(
        result.error.category,
        AIErrorCategory.CapabilityUnavailable,
        "error category",
      );
      assertTrue(
        result.decision.rejectedCandidates.every((candidate) =>
          candidate.reasons.includes(
            CandidateRejectionReason.RequiredCapabilityUnavailable,
          ),
        ),
        "capability rejection reasons",
      );
    },
  },
  {
    name: "context requirement is enforced",
    run: () => {
      const result = route({
        ...request,
        constraints: {
          ...request.constraints,
          estimatedInputTokens: 32_000,
        },
      });
      assertFailure(result);
      assertEqual(
        result.error.category,
        AIErrorCategory.ContextLimitExceeded,
        "error category",
      );
    },
  },
  {
    name: "local-only privacy excludes external providers",
    run: () => {
      const result = route({
        ...request,
        constraints: {
          ...request.constraints,
          privacyLevel: PrivacyLevel.LocalOnly,
          externalProcessingAllowed: false,
          allowedProcessingRegions: undefined,
        } as unknown as AIRequest["constraints"],
      });
      assertFailure(result);
      assertEqual(
        result.error.category,
        AIErrorCategory.PrivacyPolicyRejected,
        "error category",
      );
    },
  },
  {
    name: "per-request budget is enforced",
    run: () => {
      const result = route({
        ...request,
        constraints: {
          ...request.constraints,
          maximumEstimatedCost: 0.001,
        },
      });
      assertFailure(result);
      assertEqual(result.error.category, AIErrorCategory.BudgetExceeded, "error");
      assertTrue(
        result.decision.rejectedCandidates.every((candidate) =>
          candidate.reasons.includes(
            CandidateRejectionReason.RequestBudgetExceeded,
          ),
        ),
        "request budget reasons",
      );
    },
  },
  {
    name: "daily remaining budget is enforced",
    run: () => {
      const result = route(request, configuration, {
        currency: "USD",
        dailyCost: 9.999,
        monthlyCost: 9.999,
        capturedAt: now,
      });
      assertFailure(result);
      assertEqual(result.error.category, AIErrorCategory.BudgetExceeded, "error");
      assertTrue(
        result.decision.rejectedCandidates.every((candidate) =>
          candidate.reasons.includes(CandidateRejectionReason.DailyBudgetExceeded),
        ),
        "daily budget reasons",
      );
    },
  },
  {
    name: "monthly remaining budget is enforced",
    run: () => {
      const result = route(request, configuration, {
        currency: "USD",
        dailyCost: 0,
        monthlyCost: 99.999,
        capturedAt: now,
      });
      assertFailure(result);
      assertEqual(result.error.category, AIErrorCategory.BudgetExceeded, "error");
      assertTrue(
        result.decision.rejectedCandidates.every((candidate) =>
          candidate.reasons.includes(
            CandidateRejectionReason.MonthlyBudgetExceeded,
          ),
        ),
        "monthly budget reasons",
      );
    },
  },
  {
    name: "low-cost mode selects the cheapest eligible model",
    run: () => {
      const result = route(request, {
        ...configuration,
        budgetPolicy: {
          ...configuration.budgetPolicy,
          lowCostMode: true,
        },
      });
      assertSuccess(result);
      assertEqual(result.decision.selectedModelId, modelB.modelId, "model");
      assertEqual(
        result.decision.estimatedCost.estimatedTotalCost,
        0.002,
        "cost",
      );
    },
  },
  {
    name: "critical override requires explicit policy, flag, and authorization",
    run: () => {
      const criticalRequest: AIRequest = {
        ...request,
        requiredCapabilities: [AICapability.CriticalDecision],
        reasoningLevel: ReasoningLevel.Critical,
        constraints: {
          ...request.constraints,
          maximumEstimatedCost: 0,
        },
        criticalOverride: {
          authorizationId: "override-1",
          approvedBy: "owner",
          maximumAdditionalCost: 0.01,
          expiresAt: "2026-07-19T16:00:00.000Z",
          reason: "Approved critical analysis.",
        },
      };
      const allowed = route(criticalRequest);
      assertSuccess(allowed);
      assertTrue(
        allowed.decision.routingReason.reasonCodes.includes(
          "CRITICAL_OVERRIDE_APPLIED",
        ),
        "override reason",
      );
      assertEqual(
        allowed.auditRecord.criticalOverride?.authorizationId,
        "override-1",
        "audit override",
      );

      const disabled = route(criticalRequest, {
        ...configuration,
        featureFlags: {
          ...configuration.featureFlags,
          criticalOverridesEnabled: false,
        },
      });
      assertFailure(disabled);
      assertEqual(disabled.error.category, AIErrorCategory.BudgetExceeded, "error");

      const unauthorized = route({
        ...criticalRequest,
        criticalOverride: undefined,
      } as unknown as AIRequest);
      assertFailure(unauthorized);
      assertEqual(
        unauthorized.error.category,
        AIErrorCategory.BudgetExceeded,
        "authorization error",
      );

      const expired = route({
        ...criticalRequest,
        criticalOverride: {
          ...criticalRequest.criticalOverride!,
          expiresAt: "2026-07-17T16:00:00.000Z",
        },
      });
      assertFailure(expired);
      assertEqual(
        expired.error.category,
        AIErrorCategory.BudgetExceeded,
        "expired override error",
      );
    },
  },
  {
    name: "balanced routing prefers reliability deterministically",
    run: () => {
      const result = route();
      assertSuccess(result);
      assertEqual(result.decision.selectedModelId, modelA.modelId, "model");
    },
  },
  {
    name: "high latency priority prefers the fastest eligible model",
    run: () => {
      const result = route({
        ...request,
        constraints: {
          ...request.constraints,
          latencyPriority: LatencyPriority.High,
        },
      });
      assertSuccess(result);
      assertEqual(result.decision.selectedModelId, modelB.modelId, "model");
    },
  },
  {
    name: "stable IDs break otherwise exact ties",
    run: () => {
      const tiedModelB: ModelDefinition = {
        ...modelB,
        reliability: modelA.reliability,
        estimatedP95LatencyMs: modelA.estimatedP95LatencyMs,
        cost: modelA.cost,
      };
      const result = route(
        request,
        withProvidersAndModels(
          [providerB, providerA],
          [tiedModelB, modelA],
        ),
      );
      assertSuccess(result);
      assertEqual(result.decision.selectedProviderId, "provider-a", "provider");
      assertEqual(result.decision.selectedModelId, "model-a", "model");
    },
  },
  {
    name: "fallback order is deterministic and excludes the primary",
    run: () => {
      const first = route();
      const second = route();
      assertSuccess(first);
      assertSuccess(second);
      assertEqual(first.decision.fallbackChain.length, 2, "fallback count");
      assertEqual(first.decision.fallbackChain[0]?.modelId, modelB.modelId, "first");
      assertEqual(first.decision.fallbackChain[1]?.modelId, modelC.modelId, "second");
      assertTrue(
        first.decision.fallbackChain.every(
          (candidate) => candidate.selectionReason.reasonCodes.length > 0,
        ),
        "fallback reasons",
      );
      assertTrue(
        first.decision.fallbackChain.every(
          (candidate) => candidate.modelId !== first.decision.selectedModelId,
        ),
        "fallback must exclude primary",
      );
      assertDeepEqual(
        first.decision.fallbackChain,
        second.decision.fallbackChain,
        "fallback plans must match",
      );
    },
  },
  {
    name: "all unavailable providers return normalized no-provider failure",
    run: () => {
      const providers = [providerA, providerB, providerC].map((provider) => ({
        ...provider,
        availability: ModelAvailability.Unavailable,
      }));
      const result = route(
        request,
        withProvidersAndModels(providers, [modelA, modelB, modelC]),
      );
      assertFailure(result);
      assertEqual(
        result.error.category,
        AIErrorCategory.NoEligibleProvider,
        "error category",
      );
      assertEqual(result.decision.status, RoutingDecisionStatus.Rejected, "status");
    },
  },
  {
    name: "audit record contains the deterministic planning result",
    run: () => {
      const result = route();
      assertSuccess(result);
      assertEqual(result.auditRecord.timestamp, now, "timestamp");
      assertEqual(result.auditRecord.requestId, request.requestId, "request ID");
      assertEqual(
        result.auditRecord.selectedProviderId,
        result.decision.selectedProviderId,
        "provider",
      );
      assertEqual(
        result.auditRecord.selectedModelId,
        result.decision.selectedModelId,
        "model",
      );
      assertEqual(
        result.auditRecord.fallbackPlan.length,
        result.decision.fallbackChain.length,
        "fallback plan",
      );
      assertEqual(result.auditRecord.attempts.length, 0, "execution attempts");
    },
  },
  {
    name: "provider display names receive no routing preference",
    run: () => {
      const providerZ = createProvider("provider-z", "model-z", {
        name: "Appears Preferred",
      });
      const providerD = createProvider("provider-d", "model-d", {
        name: "Appears Ordinary",
      });
      const modelZ = createModel("provider-z", "model-z", {
        reliability: 0.98,
        estimatedP95LatencyMs: 1_000,
      });
      const modelD = createModel("provider-d", "model-d", {
        reliability: 0.98,
        estimatedP95LatencyMs: 1_000,
      });
      const result = route(
        request,
        withProvidersAndModels([providerZ, providerD], [modelZ, modelD]),
      );
      assertSuccess(result);
      assertEqual(result.decision.selectedProviderId, "provider-d", "provider");
    },
  },
  {
    name: "engine plans only and never creates an execution attempt",
    run: () => {
      const executionFlagConfiguration: AIRouterConfiguration = {
        ...configuration,
        featureFlags: {
          ...configuration.featureFlags,
          providerExecutionEnabled: true,
        },
      };
      const result = route(request, executionFlagConfiguration);
      assertSuccess(result);
      assertEqual(result.auditRecord.attempts.length, 0, "attempt count");
      assertTrue(
        !("output" in result),
        "planning engine must not return provider output",
      );
    },
  },
  {
    name: "invalid requests and configurations return normalized failures",
    run: () => {
      const invalidRequest = route({
        ...request,
        constraints: {
          ...request.constraints,
          estimatedInputTokens: -1,
        },
      });
      assertFailure(invalidRequest);
      assertEqual(
        invalidRequest.error.category,
        AIErrorCategory.InvalidRequest,
        "request error",
      );

      const invalidConfiguration = route(request, {
        ...configuration,
        modelRegistry: {
          ...configuration.modelRegistry,
          models: [{ ...modelA, providerId: "missing-provider" }],
        },
      });
      assertFailure(invalidConfiguration);
      assertEqual(
        invalidConfiguration.error.category,
        AIErrorCategory.ConfigurationInvalid,
        "configuration error",
      );
    },
  },
  {
    name: "cost estimation is isolated and deterministic",
    run: () => {
      const first = estimateModelCost(request, modelA);
      const second = estimateModelCost(request, modelA);
      assertDeepEqual(first, second, "cost estimates must match");
      assertEqual(first.estimatedInputCost, 0.002, "input cost");
      assertEqual(first.estimatedOutputCost, 0.002, "output cost");
      assertEqual(first.estimatedTotalCost, 0.004, "total cost");
    },
  },
];

let passed = 0;

for (const test of tests) {
  try {
    test.run();
    passed += 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${test.name}: ${message}`);
    throw error;
  }
}

console.log(
  `AI Router Engine: ${String(passed)}/${String(tests.length)} tests passed.`,
);
