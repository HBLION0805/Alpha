import {
  AICapability,
  AIExecutionFinishReason,
  AIExecutionInputType,
  AIExecutionStatus,
  AIOutputType,
  AIProviderAdapterErrorCategory,
  AIProviderCompatibilityReason,
  AIProviderHealthStatus,
  AITaskType,
  PrivacyLevel,
  ReasoningLevel,
  type AIAdapterCompatibility,
  type AIExecutionRequest,
  type AIExecutionResponse,
  type AIProviderAdapter,
  type AIProviderAdapterDescriptor,
  type AIProviderAdapterError,
  type AIProviderExecutionContext,
  type AIProviderHealth,
  validateAIExecutionResponse,
  validateAIProviderAdapterDescriptor,
  validateAIProviderExecutionContext,
  validateAIProviderHealth,
  validateAIProviderTimeoutPolicy,
  validateAIUsageRecord,
} from "../../contracts";
import {
  InMemoryAIProviderAdapterRegistry,
  evaluateAdapterCompatibility,
} from "./AIProviderAdapterRegistry";

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

function assertThrows(run: () => void, expectedText: string): void {
  try {
    run();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    assertTrue(message.includes(expectedText), `expected error containing ${expectedText}`);
    return;
  }
  throw new Error(`Expected error containing ${expectedText}.`);
}

const now = "2026-07-18T17:00:00.000Z";

const request: AIExecutionRequest = {
  contractVersion: "1.0",
  requestId: "execution-request-1",
  providerId: "neutral-provider-a",
  modelId: "neutral-model-a",
  taskType: AITaskType.Summary,
  input: {
    type: AIExecutionInputType.Structured,
    content: { prompt: "Summarize the supplied fixture." },
    schemaId: "summary-input-v1",
  },
  expectedOutputType: AIOutputType.Text,
  requiredCapabilities: [AICapability.Fast],
  reasoningLevel: ReasoningLevel.Low,
  privacyLevel: PrivacyLevel.Internal,
  contextTokenLimit: 8_000,
  maximumOutputTokens: 1_000,
  timeoutPolicy: {
    timeoutMs: 5_000,
    deadlineAt: "2026-07-18T17:00:05.000Z",
  },
  cancellationId: "cancellation-1",
  routingDecisionId: "routing-decision-1",
  costGovernorDecisionId: "cost-decision-1",
  reservationId: "reservation-1",
  requestedAt: now,
  traceId: "trace-1",
  correlationId: "correlation-1",
};

const context: AIProviderExecutionContext = {
  attemptNumber: 1,
  invokedAt: now,
  timeoutPolicy: request.timeoutPolicy,
  cancellation: {
    cancellationId: request.cancellationId,
    requested: false,
  },
};

function createDescriptor(
  providerId = "neutral-provider-a",
  modelId = "neutral-model-a",
  overrides: Partial<AIProviderAdapterDescriptor> = {},
): AIProviderAdapterDescriptor {
  return {
    adapterId: `${providerId}-fixture-adapter`,
    providerId,
    displayName: `Fixture ${providerId}`,
    version: "fixture-v1",
    enabled: true,
    supportedModelIds: [modelId],
    capabilities: {
      supportedCapabilities: [AICapability.Fast, AICapability.LowCost],
      supportedOutputTypes: [AIOutputType.Text, AIOutputType.StructuredJson],
      supportedReasoningLevels: [ReasoningLevel.None, ReasoningLevel.Low],
      supportedPrivacyLevels: [PrivacyLevel.Public, PrivacyLevel.Internal],
      maximumContextTokens: 16_000,
      maximumOutputTokens: 2_000,
      timeoutSupported: true,
      cancellationSupported: true,
      structuredOutputSupported: true,
    },
    publicConfiguration: { region: "fixture-region" },
    ...overrides,
  };
}

type FixtureMode =
  | "SUCCESS"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE";

class FixtureFault extends Error {
  constructor(readonly category: AIProviderAdapterErrorCategory) {
    super(`Fixture fault: ${category}`);
  }
}

class FixtureAIProviderAdapter implements AIProviderAdapter {
  constructor(
    private readonly descriptor: AIProviderAdapterDescriptor = createDescriptor(),
    private readonly mode: FixtureMode = "SUCCESS",
    private readonly health: AIProviderHealth = {
      providerId: descriptor.providerId,
      status: AIProviderHealthStatus.Available,
      observedAt: now,
      estimatedLatencyMs: 25,
      reliability: 1,
      rateLimited: false,
      source: "TEST_FIXTURE",
      expiresAt: "2026-07-18T17:01:00.000Z",
    },
  ) {}

  getDescriptor(): Readonly<AIProviderAdapterDescriptor> {
    return this.descriptor;
  }

  getHealth(): Readonly<AIProviderHealth> {
    return this.health;
  }

  supports(executionRequest: Readonly<AIExecutionRequest>): AIAdapterCompatibility {
    return evaluateAdapterCompatibility(this.descriptor, executionRequest);
  }

  normalizeError(
    error: unknown,
    executionRequest: Readonly<AIExecutionRequest>,
    executionContext: Readonly<AIProviderExecutionContext>,
  ): AIProviderAdapterError {
    const category =
      error instanceof FixtureFault
        ? error.category
        : AIProviderAdapterErrorCategory.Unknown;
    const retryable = [
      AIProviderAdapterErrorCategory.Timeout,
      AIProviderAdapterErrorCategory.RateLimited,
      AIProviderAdapterErrorCategory.ProviderUnavailable,
    ].includes(category);
    return {
      category,
      code: `FIXTURE_${category}`,
      safeMessage: `Fixture normalized ${category.toLowerCase()}.`,
      retryable,
      occurredAt: executionContext.invokedAt,
      providerId: executionRequest.providerId,
      modelId: executionRequest.modelId,
      ...(category === AIProviderAdapterErrorCategory.RateLimited
        ? { retryAfterMs: 1_000 }
        : {}),
    };
  }

  async execute(
    executionRequest: Readonly<AIExecutionRequest>,
    executionContext: Readonly<AIProviderExecutionContext>,
  ): Promise<AIExecutionResponse> {
    validateAIProviderExecutionContext(executionContext, executionRequest);
    const compatibility = this.supports(executionRequest);
    if (!compatibility.compatible) {
      return this.failure(
        executionRequest,
        executionContext,
        AIExecutionStatus.Failed,
        new FixtureFault(AIProviderAdapterErrorCategory.InvalidRequest),
        AIExecutionFinishReason.Error,
      );
    }
    if (executionContext.cancellation.requested) {
      return this.failure(
        executionRequest,
        executionContext,
        AIExecutionStatus.Cancelled,
        new FixtureFault(AIProviderAdapterErrorCategory.Cancelled),
        AIExecutionFinishReason.Cancelled,
      );
    }
    if (this.mode === "TIMEOUT") {
      return this.failure(
        executionRequest,
        executionContext,
        AIExecutionStatus.TimedOut,
        new FixtureFault(AIProviderAdapterErrorCategory.Timeout),
        AIExecutionFinishReason.Timeout,
      );
    }
    if (this.mode === "RATE_LIMITED") {
      return this.failure(
        executionRequest,
        executionContext,
        AIExecutionStatus.Failed,
        new FixtureFault(AIProviderAdapterErrorCategory.RateLimited),
        AIExecutionFinishReason.Error,
      );
    }
    if (this.mode === "PROVIDER_UNAVAILABLE") {
      return this.failure(
        executionRequest,
        executionContext,
        AIExecutionStatus.Failed,
        new FixtureFault(AIProviderAdapterErrorCategory.ProviderUnavailable),
        AIExecutionFinishReason.Error,
      );
    }

    return {
      requestId: executionRequest.requestId,
      providerId: executionRequest.providerId,
      modelId: executionRequest.modelId,
      status: AIExecutionStatus.Completed,
      metadata: this.metadata(executionContext),
      audit: this.audit(executionRequest),
      retryable: false,
      warnings: [],
      output: {
        type: executionRequest.expectedOutputType,
        content: "Deterministic fixture response.",
      },
      usage: {
        inputTokens: 20,
        outputTokens: 5,
        totalTokens: 25,
        reportedCost: { minorUnits: 25, currency: "USD" },
      },
      finishReason: AIExecutionFinishReason.Completed,
    };
  }

  private failure(
    executionRequest: Readonly<AIExecutionRequest>,
    executionContext: Readonly<AIProviderExecutionContext>,
    status:
      | AIExecutionStatus.Failed
      | AIExecutionStatus.TimedOut
      | AIExecutionStatus.Cancelled,
    fault: FixtureFault,
    finishReason: AIExecutionFinishReason,
  ): AIExecutionResponse {
    const error = this.normalizeError(
      fault,
      executionRequest,
      executionContext,
    );
    return {
      requestId: executionRequest.requestId,
      providerId: executionRequest.providerId,
      modelId: executionRequest.modelId,
      status,
      metadata: this.metadata(executionContext),
      audit: this.audit(executionRequest),
      retryable: error.retryable,
      warnings: [],
      error,
      finishReason,
    };
  }

  private metadata(
    executionContext: Readonly<AIProviderExecutionContext>,
  ): AIExecutionResponse["metadata"] {
    return {
      startedAt: executionContext.invokedAt,
      completedAt: "2026-07-18T17:00:00.025Z",
      latencyMs: 25,
      attemptNumber: executionContext.attemptNumber,
      providerRequestId: "fixture-request-1",
    };
  }

  private audit(
    executionRequest: Readonly<AIExecutionRequest>,
  ): AIExecutionResponse["audit"] {
    return {
      traceId: executionRequest.traceId,
      ...(executionRequest.correlationId === undefined
        ? {}
        : { correlationId: executionRequest.correlationId }),
      routingDecisionId: executionRequest.routingDecisionId,
      costGovernorDecisionId: executionRequest.costGovernorDecisionId,
      reservationId: executionRequest.reservationId,
      adapterId: this.descriptor.adapterId,
      adapterVersion: this.descriptor.version,
    };
  }
}

async function execute(
  adapter = new FixtureAIProviderAdapter(),
  executionRequest: AIExecutionRequest = request,
  executionContext: AIProviderExecutionContext = context,
): Promise<AIExecutionResponse> {
  const response = await adapter.execute(executionRequest, executionContext);
  validateAIExecutionResponse(response, executionRequest);
  return response;
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "registry registers and retrieves an adapter",
    run: () => {
      const registry = new InMemoryAIProviderAdapterRegistry();
      const adapter = new FixtureAIProviderAdapter();
      registry.register(adapter);
      assertEqual(registry.getByProviderId(request.providerId), adapter, "adapter");
    },
  },
  {
    name: "registry rejects duplicate provider IDs",
    run: () => {
      const registry = new InMemoryAIProviderAdapterRegistry();
      registry.register(new FixtureAIProviderAdapter());
      assertThrows(
        () => registry.register(new FixtureAIProviderAdapter()),
        "Duplicate provider adapter",
      );
    },
  },
  {
    name: "registry rejects empty provider IDs",
    run: () => {
      const descriptor = createDescriptor("neutral-provider-a", "neutral-model-a", {
        providerId: "",
      });
      assertThrows(
        () =>
          new InMemoryAIProviderAdapterRegistry().register(
            new FixtureAIProviderAdapter(descriptor),
          ),
        "descriptor.providerId",
      );
      assertThrows(
        () => new InMemoryAIProviderAdapterRegistry().getByProviderId(""),
        "providerId",
      );
    },
  },
  {
    name: "adapter compatibility is deterministic",
    run: () => {
      const adapter = new FixtureAIProviderAdapter();
      assertDeepEqual(adapter.supports(request), adapter.supports(request), "compatibility");
      assertTrue(adapter.supports(request).compatible, "compatible request");
    },
  },
  {
    name: "response validation prevents adapter provider or model changes",
    run: async () => {
      const response = await execute();
      assertThrows(
        () =>
          validateAIExecutionResponse(
            { ...response, providerId: "neutral-provider-b" },
            request,
          ),
        "cannot change the selected provider",
      );
      assertThrows(
        () =>
          validateAIExecutionResponse(
            { ...response, modelId: "neutral-model-b" },
            request,
          ),
        "cannot change the selected model",
      );
    },
  },
  {
    name: "unsupported capability is rejected",
    run: () => {
      const result = evaluateAdapterCompatibility(createDescriptor(), {
        ...request,
        requiredCapabilities: [AICapability.Vision],
      });
      assertTrue(!result.compatible, "incompatible capability");
      assertTrue(result.reasons.includes(AIProviderCompatibilityReason.CapabilityUnsupported), "reason");
    },
  },
  {
    name: "privacy incompatibility is rejected",
    run: () => {
      const result = evaluateAdapterCompatibility(createDescriptor(), {
        ...request,
        privacyLevel: PrivacyLevel.LocalOnly,
      });
      assertTrue(result.reasons.includes(AIProviderCompatibilityReason.PrivacyUnsupported), "reason");
    },
  },
  {
    name: "timeout is represented deterministically",
    run: async () => {
      const response = await execute(new FixtureAIProviderAdapter(createDescriptor(), "TIMEOUT"));
      assertEqual(response.status, AIExecutionStatus.TimedOut, "status");
      assertTrue(response.status !== AIExecutionStatus.Completed && response.error.category === AIProviderAdapterErrorCategory.Timeout, "timeout error");
    },
  },
  {
    name: "cancellation is represented deterministically",
    run: async () => {
      const cancelledContext: AIProviderExecutionContext = {
        ...context,
        cancellation: {
          cancellationId: request.cancellationId,
          requested: true,
          requestedAt: now,
          reason: "Caller cancelled fixture.",
        },
      };
      const response = await execute(new FixtureAIProviderAdapter(), request, cancelledContext);
      assertEqual(response.status, AIExecutionStatus.Cancelled, "status");
    },
  },
  {
    name: "rate-limit error is normalized",
    run: async () => {
      const response = await execute(new FixtureAIProviderAdapter(createDescriptor(), "RATE_LIMITED"));
      assertTrue(response.status !== AIExecutionStatus.Completed, "failure response");
      assertEqual(response.status === AIExecutionStatus.Completed ? undefined : response.error.category, AIProviderAdapterErrorCategory.RateLimited, "category");
      assertTrue(response.retryable, "retryable");
    },
  },
  {
    name: "provider-unavailable error is normalized",
    run: async () => {
      const response = await execute(new FixtureAIProviderAdapter(createDescriptor(), "PROVIDER_UNAVAILABLE"));
      assertTrue(response.status !== AIExecutionStatus.Completed, "failure response");
      assertEqual(response.status === AIExecutionStatus.Completed ? undefined : response.error.category, AIProviderAdapterErrorCategory.ProviderUnavailable, "category");
    },
  },
  {
    name: "malformed response is rejected",
    run: async () => {
      const response = await execute();
      if (response.status !== AIExecutionStatus.Completed) {
        throw new Error("Expected successful fixture response.");
      }
      assertThrows(
        () =>
          validateAIExecutionResponse(
            { ...response, usage: { ...response.usage, totalTokens: 999 } },
            request,
          ),
        "usage.totalTokens",
      );
    },
  },
  {
    name: "negative token usage is rejected",
    run: () =>
      assertThrows(
        () => validateAIUsageRecord({ inputTokens: -1, outputTokens: 0, totalTokens: -1 }),
        "usage.inputTokens",
      ),
  },
  {
    name: "non-finite token usage is rejected",
    run: () =>
      assertThrows(
        () => validateAIUsageRecord({ inputTokens: Number.NaN, outputTokens: 0, totalTokens: 0 }),
        "usage.inputTokens",
      ),
  },
  {
    name: "negative latency is rejected",
    run: async () => {
      const response = await execute();
      assertThrows(
        () => validateAIExecutionResponse({ ...response, metadata: { ...response.metadata, latencyMs: -1 } }, request),
        "metadata.latencyMs",
      );
    },
  },
  {
    name: "non-finite latency is rejected",
    run: async () => {
      const response = await execute();
      assertThrows(
        () => validateAIExecutionResponse({ ...response, metadata: { ...response.metadata, latencyMs: Number.NaN } }, request),
        "metadata.latencyMs",
      );
    },
  },
  {
    name: "all provider health states validate",
    run: () => {
      for (const status of Object.values(AIProviderHealthStatus)) {
        validateAIProviderHealth({
          providerId: request.providerId,
          status,
          observedAt: now,
          rateLimited: status === AIProviderHealthStatus.RateLimited,
          source: "TEST_FIXTURE",
        });
      }
    },
  },
  {
    name: "invalid provider health values are rejected",
    run: () =>
      assertThrows(
        () => validateAIProviderHealth({
          providerId: request.providerId,
          status: AIProviderHealthStatus.Available,
          observedAt: now,
          estimatedLatencyMs: Number.POSITIVE_INFINITY,
          rateLimited: false,
          source: "TEST_FIXTURE",
        }),
        "health.estimatedLatencyMs",
      ),
  },
  {
    name: "registry descriptor ordering is deterministic",
    run: () => {
      const registry = new InMemoryAIProviderAdapterRegistry();
      registry.register(new FixtureAIProviderAdapter(createDescriptor("neutral-provider-z", "neutral-model-z")));
      registry.register(new FixtureAIProviderAdapter(createDescriptor("neutral-provider-a", "neutral-model-a")));
      assertDeepEqual(
        registry.listDescriptors().map((descriptor) => descriptor.providerId),
        ["neutral-provider-a", "neutral-provider-z"],
        "descriptor order",
      );
    },
  },
  {
    name: "fixture adapter contains no network activity",
    run: () => {
      const implementation = FixtureAIProviderAdapter.prototype.execute.toString();
      assertTrue(!/fetch|XMLHttpRequest|WebSocket|https?\.request|axios/i.test(implementation), "network-free fixture");
    },
  },
  {
    name: "routing decision reference is preserved",
    run: async () => {
      const response = await execute();
      assertEqual(response.audit.routingDecisionId, request.routingDecisionId, "routing reference");
    },
  },
  {
    name: "cost-governor and reservation references are preserved",
    run: async () => {
      const response = await execute();
      assertEqual(response.audit.costGovernorDecisionId, request.costGovernorDecisionId, "cost reference");
      assertEqual(response.audit.reservationId, request.reservationId, "reservation reference");
    },
  },
  {
    name: "adapter output contains no ledger commit or budget mutation",
    run: async () => {
      const response = await execute();
      const serialized = JSON.stringify(response);
      assertTrue(!serialized.includes("ledgerEntry"), "no ledger entry");
      assertTrue(!serialized.includes("budgetCommit"), "no budget commit");
    },
  },
  {
    name: "adapter execution does not mutate inputs",
    run: async () => {
      const before = JSON.stringify({ request, context });
      await execute();
      assertEqual(JSON.stringify({ request, context }), before, "input snapshot");
    },
  },
  {
    name: "same input produces the same fixture response",
    run: async () => {
      assertDeepEqual(await execute(), await execute(), "fixture response");
    },
  },
  {
    name: "incompatible selected model is rejected",
    run: () => {
      const result = evaluateAdapterCompatibility(createDescriptor(), {
        ...request,
        modelId: "neutral-model-b",
      });
      assertTrue(result.reasons.includes(AIProviderCompatibilityReason.ModelUnsupported), "model reason");
    },
  },
  {
    name: "secret-bearing public adapter configuration is rejected",
    run: () => {
      const descriptor = createDescriptor();
      assertThrows(
        () => validateAIProviderAdapterDescriptor({
          ...descriptor,
          publicConfiguration: { nested: { apiKey: "forbidden-fixture-value" } },
        }),
        "secret-bearing keys",
      );
    },
  },
  {
    name: "invalid timeout is rejected",
    run: () =>
      assertThrows(
        () => validateAIProviderTimeoutPolicy({ timeoutMs: 0 }),
        "timeoutPolicy.timeoutMs",
      ),
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
    `AI Provider Adapter: ${String(passed)}/${String(tests.length)} tests passed.`,
  );
}

void runTests();
