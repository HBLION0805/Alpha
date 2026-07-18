import {
  AICapability,
  AIOutputType,
  AITaskType,
  PrivacyLevel,
  ReasoningLevel,
} from "./AIRouter";
import {
  AIExecutionFinishReason,
  AIExecutionInputType,
  AIExecutionStatus,
  AIProviderAdapterErrorCategory,
  AIProviderCompatibilityReason,
  AIProviderHealthStatus,
  type AIAdapterCompatibility,
  type AIExecutionRequest,
  type AIExecutionResponse,
  type AIProviderAdapterDescriptor,
  type AIProviderExecutionContext,
  type AIProviderHealth,
  type AIProviderTimeoutPolicy,
  type AIUsageRecord,
} from "./AIProviderAdapter";

function validateNonEmptyString(name: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${name}: expected a non-empty string.`);
  }
}

function validateTimestamp(name: string, value: string): void {
  validateNonEmptyString(name, value);
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${name}: expected an ISO-8601 timestamp.`);
  }
}

function validateNonNegativeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `Invalid ${name}: expected a non-negative safe integer; received ${String(value)}.`,
    );
  }
}

function validatePositiveInteger(name: string, value: number): void {
  validateNonNegativeInteger(name, value);
  if (value === 0) {
    throw new Error(`Invalid ${name}: expected an integer greater than zero.`);
  }
}

function validateNonNegativeNumber(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid ${name}: expected a finite non-negative number; received ${String(value)}.`,
    );
  }
}

function validateEnumValue<T extends string>(
  name: string,
  value: T,
  values: ReadonlyArray<T>,
): void {
  if (!values.includes(value)) {
    throw new Error(`Invalid ${name}: received ${String(value)}.`);
  }
}

function validateEnumArray<T extends string>(
  name: string,
  values: ReadonlyArray<T>,
  allowed: ReadonlyArray<T>,
  allowEmpty = false,
): void {
  if (!allowEmpty && values.length === 0) {
    throw new Error(`Invalid ${name}: expected at least one item.`);
  }
  for (const value of values) {
    validateEnumValue(name, value, allowed);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Invalid ${name}: duplicate values are not allowed.`);
  }
}

function validateUniqueStrings(
  name: string,
  values: ReadonlyArray<string>,
): void {
  if (values.length === 0) {
    throw new Error(`Invalid ${name}: expected at least one item.`);
  }
  for (const value of values) {
    validateNonEmptyString(name, value);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Invalid ${name}: duplicate values are not allowed.`);
  }
}

const SENSITIVE_CONFIGURATION_KEY =
  /^(api[-_]?key|secret|client[-_]?secret|credential|password|authorization|access[-_]?token|private[-_]?key)$/i;

function validatePublicConfiguration(
  value: unknown,
  path = "descriptor.publicConfiguration",
): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    if (SENSITIVE_CONFIGURATION_KEY.test(key)) {
      throw new Error(`Invalid ${path}.${key}: secret-bearing keys are forbidden.`);
    }
    validatePublicConfiguration(nestedValue, `${path}.${key}`);
  }
}

export function validateAIProviderTimeoutPolicy(
  policy: AIProviderTimeoutPolicy,
): void {
  validatePositiveInteger("timeoutPolicy.timeoutMs", policy.timeoutMs);
  if (policy.deadlineAt !== undefined) {
    validateTimestamp("timeoutPolicy.deadlineAt", policy.deadlineAt);
  }
}

export function validateAIProviderAdapterDescriptor(
  descriptor: AIProviderAdapterDescriptor,
): void {
  validateNonEmptyString("descriptor.adapterId", descriptor.adapterId);
  validateNonEmptyString("descriptor.providerId", descriptor.providerId);
  validateNonEmptyString("descriptor.displayName", descriptor.displayName);
  validateNonEmptyString("descriptor.version", descriptor.version);
  validateUniqueStrings(
    "descriptor.supportedModelIds",
    descriptor.supportedModelIds,
  );

  const capabilities = descriptor.capabilities;
  validateEnumArray(
    "descriptor.capabilities.supportedCapabilities",
    capabilities.supportedCapabilities,
    Object.values(AICapability),
  );
  validateEnumArray(
    "descriptor.capabilities.supportedOutputTypes",
    capabilities.supportedOutputTypes,
    Object.values(AIOutputType),
  );
  validateEnumArray(
    "descriptor.capabilities.supportedReasoningLevels",
    capabilities.supportedReasoningLevels,
    Object.values(ReasoningLevel),
  );
  validateEnumArray(
    "descriptor.capabilities.supportedPrivacyLevels",
    capabilities.supportedPrivacyLevels,
    Object.values(PrivacyLevel),
  );
  validatePositiveInteger(
    "descriptor.capabilities.maximumContextTokens",
    capabilities.maximumContextTokens,
  );
  validatePositiveInteger(
    "descriptor.capabilities.maximumOutputTokens",
    capabilities.maximumOutputTokens,
  );
  if (descriptor.publicConfiguration !== undefined) {
    validatePublicConfiguration(descriptor.publicConfiguration);
  }
}

export function validateAIProviderHealth(health: AIProviderHealth): void {
  validateNonEmptyString("health.providerId", health.providerId);
  validateEnumValue(
    "health.status",
    health.status,
    Object.values(AIProviderHealthStatus),
  );
  validateTimestamp("health.observedAt", health.observedAt);
  validateNonEmptyString("health.source", health.source);
  if (health.estimatedLatencyMs !== undefined) {
    validateNonNegativeNumber(
      "health.estimatedLatencyMs",
      health.estimatedLatencyMs,
    );
  }
  if (health.reliability !== undefined) {
    if (
      !Number.isFinite(health.reliability) ||
      health.reliability < 0 ||
      health.reliability > 1
    ) {
      throw new Error(
        "Invalid health.reliability: expected a finite number from 0 to 1.",
      );
    }
  }
  if (health.retryAfterMs !== undefined) {
    validateNonNegativeInteger("health.retryAfterMs", health.retryAfterMs);
  }
  if (health.expiresAt !== undefined) {
    validateTimestamp("health.expiresAt", health.expiresAt);
    if (Date.parse(health.expiresAt) < Date.parse(health.observedAt)) {
      throw new Error(
        "Invalid health.expiresAt: it cannot precede health.observedAt.",
      );
    }
  }
  if (
    health.rateLimited !==
    (health.status === AIProviderHealthStatus.RateLimited)
  ) {
    throw new Error(
      "Invalid health.rateLimited: it must be true exactly for RATE_LIMITED status.",
    );
  }
  if (health.retryAfterMs !== undefined && !health.rateLimited) {
    throw new Error(
      "Invalid health.retryAfterMs: it is allowed only when rate limited.",
    );
  }
}

export function validateAIExecutionRequest(request: AIExecutionRequest): void {
  if (request.contractVersion !== "1.0") {
    throw new Error("Invalid request.contractVersion: expected 1.0.");
  }
  validateNonEmptyString("request.requestId", request.requestId);
  validateNonEmptyString("request.providerId", request.providerId);
  validateNonEmptyString("request.modelId", request.modelId);
  validateNonEmptyString("request.cancellationId", request.cancellationId);
  validateNonEmptyString("request.routingDecisionId", request.routingDecisionId);
  validateNonEmptyString(
    "request.costGovernorDecisionId",
    request.costGovernorDecisionId,
  );
  validateNonEmptyString("request.reservationId", request.reservationId);
  validateNonEmptyString("request.traceId", request.traceId);
  validateTimestamp("request.requestedAt", request.requestedAt);
  if (request.correlationId !== undefined) {
    validateNonEmptyString("request.correlationId", request.correlationId);
  }
  validateEnumValue(
    "request.taskType",
    request.taskType,
    Object.values(AITaskType),
  );
  validateEnumValue(
    "request.input.type",
    request.input.type,
    Object.values(AIExecutionInputType),
  );
  if (request.input.schemaId !== undefined) {
    validateNonEmptyString("request.input.schemaId", request.input.schemaId);
  }
  validateEnumValue(
    "request.expectedOutputType",
    request.expectedOutputType,
    Object.values(AIOutputType),
  );
  validateEnumArray(
    "request.requiredCapabilities",
    request.requiredCapabilities,
    Object.values(AICapability),
  );
  validateEnumValue(
    "request.reasoningLevel",
    request.reasoningLevel,
    Object.values(ReasoningLevel),
  );
  validateEnumValue(
    "request.privacyLevel",
    request.privacyLevel,
    Object.values(PrivacyLevel),
  );
  validatePositiveInteger(
    "request.contextTokenLimit",
    request.contextTokenLimit,
  );
  validatePositiveInteger(
    "request.maximumOutputTokens",
    request.maximumOutputTokens,
  );
  validateAIProviderTimeoutPolicy(request.timeoutPolicy);
}

export function validateAIProviderExecutionContext(
  context: AIProviderExecutionContext,
  request?: AIExecutionRequest,
): void {
  validatePositiveInteger("context.attemptNumber", context.attemptNumber);
  validateTimestamp("context.invokedAt", context.invokedAt);
  validateAIProviderTimeoutPolicy(context.timeoutPolicy);
  validateNonEmptyString(
    "context.cancellation.cancellationId",
    context.cancellation.cancellationId,
  );
  if (context.cancellation.requested) {
    if (context.cancellation.requestedAt === undefined) {
      throw new Error(
        "Invalid context.cancellation.requestedAt: required when cancellation is requested.",
      );
    }
    validateTimestamp(
      "context.cancellation.requestedAt",
      context.cancellation.requestedAt,
    );
  } else if (context.cancellation.requestedAt !== undefined) {
    throw new Error(
      "Invalid context.cancellation.requestedAt: not allowed when cancellation is not requested.",
    );
  }
  if (context.cancellation.reason !== undefined) {
    validateNonEmptyString(
      "context.cancellation.reason",
      context.cancellation.reason,
    );
  }
  if (
    request !== undefined &&
    context.cancellation.cancellationId !== request.cancellationId
  ) {
    throw new Error(
      "Invalid context.cancellation.cancellationId: it must match the request reference.",
    );
  }
  if (
    request !== undefined &&
    (context.timeoutPolicy.timeoutMs !== request.timeoutPolicy.timeoutMs ||
      context.timeoutPolicy.deadlineAt !== request.timeoutPolicy.deadlineAt)
  ) {
    throw new Error(
      "Invalid context.timeoutPolicy: adapters cannot alter the request timeout.",
    );
  }
}

export function validateAIUsageRecord(usage: AIUsageRecord): void {
  validateNonNegativeInteger("usage.inputTokens", usage.inputTokens);
  validateNonNegativeInteger("usage.outputTokens", usage.outputTokens);
  validateNonNegativeInteger("usage.totalTokens", usage.totalTokens);
  if (usage.totalTokens !== usage.inputTokens + usage.outputTokens) {
    throw new Error(
      "Invalid usage.totalTokens: expected inputTokens plus outputTokens.",
    );
  }
  if (usage.reportedCost !== undefined) {
    validateNonNegativeInteger(
      "usage.reportedCost.minorUnits",
      usage.reportedCost.minorUnits,
    );
    validateNonEmptyString(
      "usage.reportedCost.currency",
      usage.reportedCost.currency,
    );
  }
}

export function validateAIAdapterCompatibility(
  compatibility: AIAdapterCompatibility,
): void {
  validateEnumArray(
    "compatibility.reasons",
    compatibility.reasons,
    Object.values(AIProviderCompatibilityReason),
    true,
  );
  if (compatibility.compatible !== (compatibility.reasons.length === 0)) {
    throw new Error(
      "Invalid compatibility: compatible must be true exactly when reasons are empty.",
    );
  }
}

export function validateAIExecutionResponse(
  response: AIExecutionResponse,
  request: AIExecutionRequest,
): void {
  validateNonEmptyString("response.requestId", response.requestId);
  validateNonEmptyString("response.providerId", response.providerId);
  validateNonEmptyString("response.modelId", response.modelId);
  if (response.requestId !== request.requestId) {
    throw new Error("Invalid response.requestId: it must match the request.");
  }
  if (response.providerId !== request.providerId) {
    throw new Error(
      "Invalid response.providerId: adapters cannot change the selected provider.",
    );
  }
  if (response.modelId !== request.modelId) {
    throw new Error(
      "Invalid response.modelId: adapters cannot change the selected model.",
    );
  }
  validateEnumValue(
    "response.status",
    response.status,
    Object.values(AIExecutionStatus),
  );
  validateTimestamp("response.metadata.startedAt", response.metadata.startedAt);
  validateTimestamp(
    "response.metadata.completedAt",
    response.metadata.completedAt,
  );
  validateNonNegativeNumber(
    "response.metadata.latencyMs",
    response.metadata.latencyMs,
  );
  validatePositiveInteger(
    "response.metadata.attemptNumber",
    response.metadata.attemptNumber,
  );
  if (response.metadata.providerRequestId !== undefined) {
    validateNonEmptyString(
      "response.metadata.providerRequestId",
      response.metadata.providerRequestId,
    );
  }
  validateNonEmptyString("response.audit.adapterId", response.audit.adapterId);
  validateNonEmptyString(
    "response.audit.adapterVersion",
    response.audit.adapterVersion,
  );
  if (
    response.audit.traceId !== request.traceId ||
    response.audit.routingDecisionId !== request.routingDecisionId ||
    response.audit.costGovernorDecisionId !== request.costGovernorDecisionId ||
    response.audit.reservationId !== request.reservationId ||
    response.audit.correlationId !== request.correlationId
  ) {
    throw new Error(
      "Invalid response.audit: execution references must match the request.",
    );
  }
  for (const warning of response.warnings) {
    validateNonEmptyString("response.warnings", warning);
  }
  validateEnumValue(
    "response.finishReason",
    response.finishReason,
    Object.values(AIExecutionFinishReason),
  );

  if (response.status === AIExecutionStatus.Completed) {
    if (response.retryable) {
      throw new Error("Invalid response.retryable: completed responses cannot retry.");
    }
    if (response.output.type !== request.expectedOutputType) {
      throw new Error(
        "Invalid response.output.type: it must match the requested output type.",
      );
    }
    validateAIUsageRecord(response.usage);
    return;
  }

  validateEnumValue(
    "response.error.category",
    response.error.category,
    Object.values(AIProviderAdapterErrorCategory),
  );
  validateNonEmptyString("response.error.code", response.error.code);
  validateNonEmptyString(
    "response.error.safeMessage",
    response.error.safeMessage,
  );
  validateTimestamp("response.error.occurredAt", response.error.occurredAt);
  if (
    response.error.providerId !== request.providerId ||
    response.error.modelId !== request.modelId
  ) {
    throw new Error(
      "Invalid response.error: provider and model must match the request.",
    );
  }
  if (response.retryable !== response.error.retryable) {
    throw new Error(
      "Invalid response.retryable: it must match the normalized error.",
    );
  }
  if (response.error.retryAfterMs !== undefined) {
    validateNonNegativeInteger(
      "response.error.retryAfterMs",
      response.error.retryAfterMs,
    );
  }
  if (response.usage !== undefined) {
    validateAIUsageRecord(response.usage);
  }
  if (
    response.status === AIExecutionStatus.TimedOut &&
    response.error.category !== AIProviderAdapterErrorCategory.Timeout
  ) {
    throw new Error("Invalid timed-out response: expected TIMEOUT error.");
  }
  if (
    response.status === AIExecutionStatus.Cancelled &&
    response.error.category !== AIProviderAdapterErrorCategory.Cancelled
  ) {
    throw new Error("Invalid cancelled response: expected CANCELLED error.");
  }
}
