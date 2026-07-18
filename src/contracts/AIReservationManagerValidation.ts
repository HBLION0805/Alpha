import {
  AIReservationOperationType,
  type AIReservationPolicy,
  type AIReservationRequest,
} from "./AIReservationManager";

function nonEmpty(name: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${name}: expected a non-empty string.`);
  }
}

function timestamp(name: string, value: string): void {
  nonEmpty(name, value);
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ${name}: expected an ISO-8601 timestamp.`);
  }
}

function nonNegativeVersion(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid ${name}: expected a non-negative safe integer.`);
  }
}

export function validateAIReservationPolicy(
  policy: AIReservationPolicy,
): void {
  nonEmpty("policy.policyId", policy.policyId);
  nonEmpty("policy.version", policy.version);
}

export function validateAIReservationRequest(
  request: AIReservationRequest,
): void {
  nonEmpty("request.operationId", request.operationId);
  nonEmpty("request.idempotencyKey", request.idempotencyKey);
  nonEmpty("request.reservationId", request.reservationId);
  nonEmpty("request.requestId", request.requestId);
  nonEmpty("request.reason", request.reason);
  timestamp("request.timestamp", request.timestamp);
  nonNegativeVersion("request.expectedVersion", request.expectedVersion);
  validateAIReservationPolicy(request.policy);
  if (!Object.values(AIReservationOperationType).includes(request.operationType)) {
    throw new Error(
      `Invalid request.operationType: received ${String(request.operationType)}.`,
    );
  }
  if (request.operationType === AIReservationOperationType.Commit) {
    nonEmpty("request.executionId", request.executionId);
  }
  if (
    request.operationType === AIReservationOperationType.Release &&
    request.executionId !== undefined
  ) {
    nonEmpty("request.executionId", request.executionId);
  }
}
