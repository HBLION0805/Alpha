import {
  AIRuntimeAuditFailureMode,
  AIRuntimeWorkflowErrorCategory,
  AIRuntimeWorkflowStage,
  type AIRuntimeWorkflowConfiguration,
  type AIRuntimeWorkflowError,
  type AIRuntimeWorkflowRequest,
} from "./AIRuntimeWorkflow";
import { AIAuditTraceStatus } from "./AIAuditRepository";
import { validateAIAuditPolicy } from "./AIAuditRepositoryValidation";
import { validateAICostLedgerPolicy } from "./AICostLedgerValidation";
import { validateBudgetUsageSnapshot, validateCostGovernorPolicy } from "./AICostGovernorValidation";
import { validateAIExecutionPolicy } from "./AIExecutionCoordinatorValidation";
import { AIExecutionInputType } from "./AIProviderAdapter";
import { validateAIProviderTimeoutPolicy } from "./AIProviderAdapterValidation";
import { validateAIReservationPolicy } from "./AIReservationManagerValidation";
import { validateAIRequest, validateAIRouterConfiguration } from "./AIRouterValidation";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function identifier(name: string, value: string): void {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${name}: expected a deterministic identifier.`);
  }
}

function timestamp(name: string, value: string): void {
  if (!Number.isFinite(Date.parse(value)) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error(`Invalid ${name}: expected an ISO-8601 timestamp with explicit timezone.`);
  }
}

export function validateAIRuntimeWorkflowConfiguration(configuration: AIRuntimeWorkflowConfiguration): void {
  validateAIRouterConfiguration(configuration.router);
  validateAIReservationPolicy(configuration.reservationPolicy);
  validateCostGovernorPolicy(configuration.costGovernorPolicy);
  validateBudgetUsageSnapshot(configuration.costGovernorBudgetUsage, configuration.costGovernorPolicy);
  validateAIExecutionPolicy(configuration.executionPolicy);
  validateAICostLedgerPolicy(configuration.costLedgerPolicy);
  validateAIAuditPolicy(configuration.auditPolicy);
  identifier("workflowPolicy.policyId", configuration.workflowPolicy.policyId);
  identifier("workflowPolicy.version", configuration.workflowPolicy.version);
  if (![0, 1].includes(configuration.workflowPolicy.maximumLowCostReroutes)) {
    throw new Error("Invalid workflowPolicy.maximumLowCostReroutes: v1 permits zero or one.");
  }
  if (!configuration.workflowPolicy.requirePreExecutionAudit) {
    throw new Error("Invalid workflowPolicy.requirePreExecutionAudit: v1 requires fail-closed pre-execution evidence.");
  }
  if (!Object.values(AIRuntimeAuditFailureMode).includes(configuration.workflowPolicy.auditFailureMode)) {
    throw new Error("Invalid workflowPolicy.auditFailureMode.");
  }
  if (configuration.workflowPolicy.acceptedFinalTraceStatuses.length === 0) {
    throw new Error("Invalid workflowPolicy.acceptedFinalTraceStatuses: at least one status is required.");
  }
  for (const status of configuration.workflowPolicy.acceptedFinalTraceStatuses) {
    if (!Object.values(AIAuditTraceStatus).includes(status)) throw new Error("Invalid accepted final trace status.");
  }
  if (
    configuration.reservationPolicy.version !== configuration.costGovernorPolicy.version ||
    configuration.costGovernorPolicy.version !== configuration.router.budgetPolicy.version
  ) {
    throw new Error("Invalid runtime configuration: reservation, Cost Governor, and Router budget policy versions must match.");
  }
}

export function validateAIRuntimeWorkflowRequest(request: AIRuntimeWorkflowRequest): void {
  if (request.contractVersion !== "1.0") throw new Error("Invalid workflow contractVersion.");
  for (const [name, value] of [
    ["workflowId", request.workflowId], ["idempotencyKey", request.idempotencyKey],
    ["requestId", request.requestId], ["correlationId", request.correlationId], ["traceId", request.traceId],
    ...Object.entries(request.identifiers),
  ]) identifier(name, value);
  const identifiers = Object.values(request.identifiers);
  if (new Set(identifiers).size !== identifiers.length) throw new Error("Invalid workflow identifiers: values must be unique.");
  validateAIRequest(request.originalRequest);
  validateAIRuntimeWorkflowConfiguration(request.configuration);
  validateAIProviderTimeoutPolicy(request.timeoutPolicy);
  if (!Object.values(AIExecutionInputType).includes(request.executionInput.type)) {
    throw new Error("Invalid executionInput.type.");
  }
  if (request.executionInput.schemaId !== undefined) identifier("executionInput.schemaId", request.executionInput.schemaId);
  identifier("cancellation.cancellationId", request.cancellation.cancellationId);
  if (typeof request.cancellation.requested !== "boolean") throw new Error("Invalid cancellation.requested.");
  if (request.cancellation.requestedAt !== undefined) timestamp("cancellation.requestedAt", request.cancellation.requestedAt);
  if (request.cancellation.reason !== undefined && request.cancellation.reason.trim().length === 0) {
    throw new Error("Invalid cancellation.reason: expected a non-empty string when supplied.");
  }
  if (request.configuration.budgetUsage.currency.trim().length === 0) throw new Error("Invalid budgetUsage.currency.");
  for (const [name, value] of [["dailyCost", request.configuration.budgetUsage.dailyCost], ["monthlyCost", request.configuration.budgetUsage.monthlyCost]] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid budgetUsage.${name}: expected a non-negative finite number.`);
  }
  timestamp("budgetUsage.capturedAt", request.configuration.budgetUsage.capturedAt);
  if (request.originalRequest.requestId !== request.requestId) throw new Error("Invalid workflow requestId: original request mismatch.");
  if (request.originalRequest.correlationId !== undefined && request.originalRequest.correlationId !== request.correlationId) {
    throw new Error("Invalid workflow correlationId: original request mismatch.");
  }
  timestamp("originalRequest.requestedAt", request.originalRequest.requestedAt);
}

export function validateAIRuntimeWorkflowTimestamp(value: string): void {
  timestamp("workflow timestamp", value);
}

export function workflowValidationError(message: string, occurredAt: string): AIRuntimeWorkflowError {
  return {
    category: AIRuntimeWorkflowErrorCategory.InvalidRequest,
    code: "WORKFLOW_REQUEST_INVALID",
    safeMessage: message,
    retryable: false,
    occurredAt,
    stage: AIRuntimeWorkflowStage.RequestValidation,
  };
}
