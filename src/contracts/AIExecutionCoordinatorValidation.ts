import { RoutingDecisionStatus } from "./AIRouter";
import {
  validateAIRequest,
  validateRoutingAuditRecord,
  validateRoutingDecision,
} from "./AIRouterValidation";
import {
  AIProviderAdapterErrorCategory,
  AIProviderHealthStatus,
} from "./AIProviderAdapter";
import {
  validateAIExecutionRequest,
  validateAIProviderExecutionContext,
  validateAIProviderTimeoutPolicy,
} from "./AIProviderAdapterValidation";
import {
  type AIExecutionCoordinatorRequest,
  type AIExecutionPolicy,
} from "./AIExecutionCoordinator";

function validateNonEmptyString(name: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${name}: expected a non-empty string.`);
  }
}

function validatePositiveInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `Invalid ${name}: expected a positive safe integer; received ${String(value)}.`,
    );
  }
}

function validateUniqueStrings(
  name: string,
  values: ReadonlyArray<string>,
): void {
  for (const value of values) {
    validateNonEmptyString(name, value);
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Invalid ${name}: duplicate values are not allowed.`);
  }
}

function validateUniqueEnumValues<T extends string>(
  name: string,
  values: ReadonlyArray<T>,
  allowed: ReadonlyArray<T>,
  allowEmpty: boolean,
): void {
  if (!allowEmpty && values.length === 0) {
    throw new Error(`Invalid ${name}: expected at least one value.`);
  }
  for (const value of values) {
    if (!allowed.includes(value)) {
      throw new Error(`Invalid ${name}: received ${String(value)}.`);
    }
  }
  if (new Set(values).size !== values.length) {
    throw new Error(`Invalid ${name}: duplicate values are not allowed.`);
  }
}

export function validateAIExecutionPolicy(policy: AIExecutionPolicy): void {
  validateNonEmptyString("policy.policyId", policy.policyId);
  validateNonEmptyString("policy.version", policy.version);
  validatePositiveInteger("policy.maximumAttempts", policy.maximumAttempts);
  validateUniqueEnumValues(
    "policy.acceptedHealthStatuses",
    policy.acceptedHealthStatuses,
    Object.values(AIProviderHealthStatus),
    false,
  );
  validateUniqueStrings(
    "policy.lowCostEligibleModelIds",
    policy.lowCostEligibleModelIds,
  );
  validateUniqueEnumValues(
    "policy.retrySameAdapterOn",
    policy.retrySameAdapterOn,
    Object.values(AIProviderAdapterErrorCategory),
    true,
  );
  validateUniqueEnumValues(
    "policy.returnToRouterOn",
    policy.returnToRouterOn,
    Object.values(AIProviderAdapterErrorCategory),
    true,
  );
}

export function validateAIExecutionCoordinatorRequest(
  request: AIExecutionCoordinatorRequest,
): void {
  validateAIRequest(request.originalRequest);
  validateRoutingDecision(request.routingDecision);
  validateRoutingAuditRecord(request.routingAuditRecord);
  validateAIProviderTimeoutPolicy(request.timeoutPolicy);
  validatePositiveInteger("request.attemptNumber", request.attemptNumber);
  validateNonEmptyString("request.traceId", request.traceId);
  if (request.correlationId !== undefined) {
    validateNonEmptyString("request.correlationId", request.correlationId);
  }
  validateAIExecutionPolicy(request.policy);

  validateAIProviderExecutionContext({
    attemptNumber: request.attemptNumber,
    invokedAt: request.originalRequest.requestedAt,
    timeoutPolicy: request.timeoutPolicy,
    cancellation: request.cancellation,
  });

  if (request.plannedReservation !== undefined) {
    validateNonEmptyString(
      "request.plannedReservation.reservationId",
      request.plannedReservation.reservationId,
    );
    validateNonEmptyString(
      "request.plannedReservation.requestId",
      request.plannedReservation.requestId,
    );
    validateNonEmptyString(
      "request.plannedReservation.amount.currency",
      request.plannedReservation.amount.currency,
    );
    if (
      !Number.isSafeInteger(
        request.plannedReservation.amount.minorUnits,
      ) ||
      request.plannedReservation.amount.minorUnits < 0
    ) {
      throw new Error(
        "Invalid request.plannedReservation.amount.minorUnits: expected a non-negative safe integer.",
      );
    }
  }

  if (request.routingDecision.status === RoutingDecisionStatus.AiSelected) {
    const executionRequest = {
      contractVersion: "1.0" as const,
      requestId: request.originalRequest.requestId,
      providerId: request.routingDecision.selectedProviderId,
      modelId: request.routingDecision.selectedModelId,
      taskType: request.originalRequest.taskType,
      input: request.executionInput,
      expectedOutputType: request.originalRequest.constraints.expectedOutputType,
      requiredCapabilities: request.originalRequest.requiredCapabilities,
      reasoningLevel: request.originalRequest.reasoningLevel,
      privacyLevel: request.originalRequest.constraints.privacyLevel,
      contextTokenLimit:
        request.originalRequest.constraints.estimatedInputTokens +
        request.originalRequest.constraints.reservedOutputTokens,
      maximumOutputTokens:
        request.originalRequest.constraints.reservedOutputTokens,
      timeoutPolicy: request.timeoutPolicy,
      cancellationId: request.cancellation.cancellationId,
      routingDecisionId: request.routingDecision.decisionId,
      costGovernorDecisionId: request.costDecision.decisionId,
      reservationId:
        request.plannedReservation?.reservationId ?? "MISSING_RESERVATION",
      requestedAt: request.originalRequest.requestedAt,
      traceId: request.traceId,
      ...(request.correlationId === undefined
        ? {}
        : { correlationId: request.correlationId }),
    };
    validateAIExecutionRequest(executionRequest);
  }
}
