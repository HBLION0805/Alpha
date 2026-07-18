import {
  AICapability,
  AIErrorCategory,
  AIOutputType,
  AIResponseStatus,
  AITaskType,
  LatencyPriority,
  ModelAvailability,
  PrivacyLevel,
  ProviderProcessingBoundary,
  ReasoningLevel,
  RoutingAttemptStatus,
  RoutingAuditStatus,
  RoutingCostMode,
  RoutingDecisionStatus,
  RoutingTieBreakField,
  type AIRequest,
  type AIRouterConfiguration,
  type AIResponse,
  type BudgetPolicy,
  type CostEstimate,
  type ModelDefinition,
  type NormalizedAIError,
  type ProviderDefinition,
  type RoutingAuditRecord,
  type RoutingDecision,
  validateAIRequest,
  validateAIRouterConfiguration,
  validateBudgetPolicy,
  validateCostEstimate,
  validateModelDefinition,
  validateProviderDefinition,
  validateRoutingAuditRecord,
  validateRoutingDecision,
} from "./index";

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

function expectError(action: () => void, expectedMessage: string): void {
  try {
    action();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    assertTrue(
      message.includes(expectedMessage),
      `Expected error containing "${expectedMessage}", received "${message}".`,
    );
    return;
  }

  throw new Error(`Expected error containing "${expectedMessage}".`);
}

const now = "2026-07-18T12:00:00.000Z";

const costEstimate: CostEstimate = {
  currency: "USD",
  estimatedInputCost: 0.001,
  estimatedOutputCost: 0.002,
  estimatedFixedCost: 0,
  estimatedTotalCost: 0.003,
  pricingVersion: "pricing-v1",
};

const provider: ProviderDefinition = {
  providerId: "provider-a",
  name: "Provider A",
  adapterId: "adapter-a",
  enabled: true,
  processingBoundary: ProviderProcessingBoundary.External,
  supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
  supportedProcessingRegions: ["region-a"],
  zeroRetentionSupported: true,
  reliability: 0.99,
  availability: ModelAvailability.Available,
  modelIds: ["model-a"],
};

const model: ModelDefinition = {
  modelId: "model-a",
  providerId: provider.providerId,
  providerModelReference: "provider-model-a",
  enabled: true,
  capabilities: [AICapability.Fast, AICapability.LowCost],
  supportedReasoningLevels: [ReasoningLevel.Low, ReasoningLevel.Medium],
  supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
  supportedOutputTypes: [AIOutputType.Text, AIOutputType.StructuredJson],
  contextLimitTokens: 32_000,
  maximumOutputTokens: 4_000,
  visionSupport: false,
  functionCallingSupport: true,
  strictStructuredOutputSupport: true,
  reliability: 0.98,
  availability: ModelAvailability.Available,
  estimatedP95LatencyMs: 2_000,
  cost: {
    currency: "USD",
    inputPerMillionTokens: 1,
    outputPerMillionTokens: 2,
    fixedRequestCost: 0,
    pricingVersion: "pricing-v1",
    effectiveAt: now,
  },
};

const request: AIRequest = {
  contractVersion: "1.0",
  requestId: "request-1",
  requestedAt: now,
  requestedBy: "research-module",
  taskType: AITaskType.Summary,
  requiredCapabilities: [AICapability.Fast, AICapability.LowCost],
  reasoningLevel: ReasoningLevel.Low,
  constraints: {
    estimatedInputTokens: 1_000,
    reservedOutputTokens: 500,
    maximumEstimatedCost: 0.01,
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
  contextFingerprint: "sha256:request-context",
};

const budgetPolicy: BudgetPolicy = {
  policyId: "default-budget",
  version: "budget-v1",
  currency: "USD",
  perRequestLimit: 1,
  dailyBudget: 10,
  monthlyBudget: 100,
  lowCostMode: true,
  warningThresholdPercentage: 80,
  criticalOverrideAllowed: true,
  criticalOverrideLimit: 5,
  accountingTimezone: "America/New_York",
};

const configuration: AIRouterConfiguration = {
  contractVersion: "1.0",
  configurationVersion: "router-config-v1",
  providerRegistry: {
    version: "providers-v1",
    providers: [provider],
  },
  modelRegistry: {
    version: "models-v1",
    models: [model],
  },
  routingPolicy: {
    version: "routing-v1",
    capabilityProfiles: [
      {
        capability: AICapability.Fast,
        minimumReliability: 0.95,
        maximumP95LatencyMs: 3_000,
        functionCallingRequired: false,
        visionRequired: false,
      },
      {
        capability: AICapability.LowCost,
        minimumReliability: 0.9,
        functionCallingRequired: false,
        visionRequired: false,
      },
    ],
    taskPolicies: [
      {
        taskType: AITaskType.Summary,
        requiredCapabilities: [AICapability.LowCost],
        minimumReasoningLevel: ReasoningLevel.Low,
        allowedOutputTypes: [AIOutputType.Text, AIOutputType.StructuredJson],
        minimumReliability: 0.9,
        costMode: RoutingCostMode.LowCost,
        deterministicOnly: false,
      },
    ],
    contextSafetyMarginTokens: 500,
    staleHealthAfterMs: 60_000,
    stableTieBreakOrder: [
      RoutingTieBreakField.EstimatedCost,
      RoutingTieBreakField.Reliability,
      RoutingTieBreakField.ProviderId,
      RoutingTieBreakField.ModelId,
    ],
  },
  budgetPolicy,
  fallbackPolicy: {
    version: "fallback-v1",
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

const routingDecision: RoutingDecision = {
  decisionId: "decision-1",
  requestId: request.requestId,
  createdAt: now,
  status: RoutingDecisionStatus.AiSelected,
  selectedProviderId: provider.providerId,
  selectedModelId: model.modelId,
  policyVersion: configuration.routingPolicy.version,
  registryVersion: configuration.providerRegistry.version,
  routingReason: {
    summary: "Lowest-cost eligible model selected.",
    reasonCodes: ["ALL_HARD_CONSTRAINTS_PASSED", "LOWEST_COST"],
    satisfiedConstraints: ["CAPABILITY", "PRIVACY", "BUDGET"],
    policyName: RoutingCostMode.LowCost,
  },
  routingConfidence: 95,
  eligibleCandidates: [
    { providerId: provider.providerId, modelId: model.modelId },
  ],
  rejectedCandidates: [
    {
      providerId: "provider-b",
      modelId: "model-b",
      reasons: ["CONTEXT_LIMIT"],
    },
  ],
  estimatedCost: costEstimate,
  estimatedLatencyMs: 2_000,
  fallbackChain: [
    {
      order: 1,
      providerId: "provider-c",
      modelId: "model-c",
      eligibleErrorCategories: [AIErrorCategory.ProviderUnavailable],
      estimatedCost: costEstimate,
      selectionReason: {
        summary: "Next eligible route in deterministic order.",
        reasonCodes: ["FALLBACK_ORDER_1"],
        satisfiedConstraints: ["ALL_HARD_CONSTRAINTS_PASSED"],
        policyName: RoutingCostMode.LowCost,
      },
    },
  ],
};

const auditRecord: RoutingAuditRecord = {
  auditId: "audit-1",
  requestId: request.requestId,
  decisionId: routingDecision.decisionId,
  timestamp: now,
  taskType: request.taskType,
  requiredCapabilities: request.requiredCapabilities,
  reasoningLevel: request.reasoningLevel,
  privacyLevel: request.constraints.privacyLevel,
  contextFingerprint: request.contextFingerprint,
  eligibleCandidates: routingDecision.eligibleCandidates,
  rejectedCandidates: routingDecision.rejectedCandidates,
  selectedProviderId: provider.providerId,
  selectedModelId: model.modelId,
  routingReason: routingDecision.routingReason,
  policyVersion: routingDecision.policyVersion,
  registryVersion: routingDecision.registryVersion,
  budgetPolicyVersion: budgetPolicy.version,
  estimatedCost: costEstimate,
  finalStatus: RoutingAuditStatus.Completed,
  fallbackPlan: routingDecision.fallbackChain,
  attempts: [
    {
      providerId: provider.providerId,
      modelId: model.modelId,
      attemptNumber: 1,
      startedAt: now,
      completedAt: now,
      status: RoutingAttemptStatus.Succeeded,
      latencyMs: 1_500,
      cost: costEstimate,
    },
  ],
  retryCount: 0,
  fallbackCount: 0,
};

const tests: ReadonlyArray<TestCase> = [
  {
    name: "valid provider-independent request is accepted",
    run: () => {
      validateAIRequest(request);
      const serialized = JSON.stringify(request);
      for (const providerSpecificName of [
        "OpenAI",
        "Anthropic",
        "Claude",
        "Gemini",
      ]) {
        assertTrue(
          !serialized.includes(providerSpecificName),
          `request must not require ${providerSpecificName}`,
        );
      }
    },
  },
  {
    name: "negative token counts are rejected",
    run: () => {
      expectError(
        () =>
          validateAIRequest({
            ...request,
            constraints: {
              ...request.constraints,
              estimatedInputTokens: -1,
            },
          }),
        "finite non-negative number",
      );
    },
  },
  {
    name: "local-only privacy rejects external processing",
    run: () => {
      expectError(
        () =>
          validateAIRequest({
            ...request,
            constraints: {
              ...request.constraints,
              privacyLevel: PrivacyLevel.LocalOnly,
              externalProcessingAllowed: true,
            },
          }),
        "LOCAL_ONLY privacy",
      );
    },
  },
  {
    name: "strict structured output requires a schema ID",
    run: () => {
      const constraints = {
        ...request.constraints,
        outputSchemaId: undefined,
      } as unknown as AIRequest["constraints"];
      expectError(
        () => validateAIRequest({ ...request, constraints }),
        "strictSchema requires outputSchemaId",
      );
    },
  },
  {
    name: "provider and model definitions are valid without vendor types",
    run: () => {
      validateProviderDefinition(provider);
      validateModelDefinition(model);
      assertEqual(model.providerId, provider.providerId, "provider link");
    },
  },
  {
    name: "empty provider IDs are rejected",
    run: () => {
      expectError(
        () => validateProviderDefinition({ ...provider, providerId: "   " }),
        "provider.providerId",
      );
    },
  },
  {
    name: "invalid model context limits are rejected",
    run: () => {
      expectError(
        () => validateModelDefinition({ ...model, contextLimitTokens: 0 }),
        "contextLimitTokens",
      );
      expectError(
        () =>
          validateModelDefinition({
            ...model,
            maximumOutputTokens: model.contextLimitTokens + 1,
          }),
        "cannot exceed contextLimitTokens",
      );
    },
  },
  {
    name: "cost fields are non-negative and additive",
    run: () => {
      validateCostEstimate(costEstimate);
      expectError(
        () =>
          validateCostEstimate({
            ...costEstimate,
            estimatedInputCost: -0.01,
          }),
        "estimatedInputCost",
      );
      expectError(
        () =>
          validateCostEstimate({
            ...costEstimate,
            estimatedTotalCost: 1,
          }),
        "sum of cost components",
      );
    },
  },
  {
    name: "budget policy represents all governance limits",
    run: () => {
      validateBudgetPolicy(budgetPolicy);
      assertTrue(budgetPolicy.lowCostMode, "low-cost mode");
      assertEqual(budgetPolicy.dailyBudget, 10, "daily budget");
      assertEqual(budgetPolicy.monthlyBudget, 100, "monthly budget");
      assertEqual(budgetPolicy.criticalOverrideLimit, 5, "override limit");
    },
  },
  {
    name: "impossible budget ordering is rejected",
    run: () => {
      expectError(
        () =>
          validateBudgetPolicy({
            ...budgetPolicy,
            perRequestLimit: budgetPolicy.dailyBudget + 1,
          }),
        "perRequestLimit cannot exceed dailyBudget",
      );
      expectError(
        () =>
          validateBudgetPolicy({
            ...budgetPolicy,
            dailyBudget: budgetPolicy.monthlyBudget + 1,
          }),
        "dailyBudget cannot exceed monthlyBudget",
      );
    },
  },
  {
    name: "provider and model registries validate as one configuration",
    run: () => {
      validateAIRouterConfiguration(configuration);
      expectError(
        () =>
          validateAIRouterConfiguration({
            ...configuration,
            modelRegistry: {
              ...configuration.modelRegistry,
              models: [{ ...model, providerId: "missing-provider" }],
            },
          }),
        "not registered",
      );
    },
  },
  {
    name: "routing decision records rejection and fallback order",
    run: () => {
      validateRoutingDecision(routingDecision);
      assertEqual(routingDecision.rejectedCandidates.length, 1, "rejections");
      assertEqual(routingDecision.fallbackChain[0]?.order, 1, "fallback order");
      expectError(
        () =>
          validateRoutingDecision({
            ...routingDecision,
            fallbackChain: [
              { ...routingDecision.fallbackChain[0]!, order: 2 },
            ],
          }),
        "order must be consecutive",
      );
    },
  },
  {
    name: "audit record captures selection, cost, status, and attempts",
    run: () => {
      validateRoutingAuditRecord(auditRecord);
      assertEqual(auditRecord.finalStatus, RoutingAuditStatus.Completed, "status");
      assertEqual(auditRecord.attempts.length, 1, "attempt count");
      assertTrue(
        !("credentials" in auditRecord),
        "audit contract must not expose credentials",
      );
    },
  },
  {
    name: "audit records reject partial provider selections",
    run: () => {
      const invalidAudit = {
        ...auditRecord,
        selectedModelId: undefined,
      } as unknown as RoutingAuditRecord;
      expectError(
        () => validateRoutingAuditRecord(invalidAudit),
        "provider and model must be recorded together",
      );
    },
  },
  {
    name: "normalized failures and failed responses remain provider-neutral",
    run: () => {
      const error: NormalizedAIError = {
        category: AIErrorCategory.RateLimited,
        code: "RATE_LIMITED",
        safeMessage: "The selected route is temporarily rate limited.",
        retryable: true,
        attemptNumber: 1,
        occurredAt: now,
      };
      const response: AIResponse = {
        requestId: request.requestId,
        status: AIResponseStatus.Failed,
        routingDecision,
        error,
        retryCount: 0,
        usedFallback: false,
      };
      assertEqual(response.error.category, AIErrorCategory.RateLimited, "error");
      assertTrue(response.error.retryable, "retryable failure");
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

console.log(`AI Router Contracts: ${String(passed)}/${String(tests.length)} tests passed.`);
