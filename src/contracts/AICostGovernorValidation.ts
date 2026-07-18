import {
  AITaskType,
  ReasoningLevel,
} from "./AIRouter";
import {
  BudgetScope,
  type BudgetLimit,
  type BudgetScopeReference,
  type BudgetUsageSnapshot,
  type CostGovernorPolicy,
  type CostGovernorRequest,
  type CriticalOverrideAuthorization,
} from "./AICostGovernor";

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

function validateNonNegativeSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `Invalid ${name}: expected a non-negative safe integer; received ${String(value)}.`,
    );
  }
}

function validatePositiveSafeInteger(name: string, value: number): void {
  validateNonNegativeSafeInteger(name, value);
  if (value === 0) {
    throw new Error(`Invalid ${name}: expected an integer greater than zero.`);
  }
}

function scopeKey(reference: BudgetScopeReference): string {
  return `${reference.scope}:${reference.scopeId ?? ""}`;
}

function scopeRequiresId(scope: BudgetScope): boolean {
  return [
    BudgetScope.TaskCategory,
    BudgetScope.Provider,
    BudgetScope.Model,
  ].includes(scope);
}

function validateScopeReference(
  name: string,
  reference: BudgetScopeReference,
): void {
  if (!Object.values(BudgetScope).includes(reference.scope)) {
    throw new Error(`Invalid ${name}.scope: received ${String(reference.scope)}.`);
  }
  if (scopeRequiresId(reference.scope)) {
    if (reference.scopeId === undefined) {
      throw new Error(`Invalid ${name}.scopeId: required for ${reference.scope}.`);
    }
    validateNonEmptyString(`${name}.scopeId`, reference.scopeId);
  } else if (reference.scopeId !== undefined) {
    throw new Error(`Invalid ${name}.scopeId: not allowed for ${reference.scope}.`);
  }
}

function validateBudgetLimit(limit: BudgetLimit): void {
  validateScopeReference("budgetLimit", limit);
  validateNonEmptyString("budgetLimit.currency", limit.currency);
  validateNonEmptyString("budgetLimit.policyVersion", limit.policyVersion);
  if (limit.softLimitMinorUnits !== undefined) {
    validateNonNegativeSafeInteger(
      "budgetLimit.softLimitMinorUnits",
      limit.softLimitMinorUnits,
    );
  }
  if (limit.hardLimitMinorUnits !== null) {
    validateNonNegativeSafeInteger(
      "budgetLimit.hardLimitMinorUnits",
      limit.hardLimitMinorUnits,
    );
    if (
      limit.softLimitMinorUnits !== undefined &&
      limit.softLimitMinorUnits > limit.hardLimitMinorUnits
    ) {
      throw new Error(
        "Invalid budgetLimit: softLimitMinorUnits cannot exceed hardLimitMinorUnits.",
      );
    }
  }
}

function validateOverride(
  authorization: CriticalOverrideAuthorization,
): void {
  validateNonEmptyString(
    "overrideAuthorization.authorizationId",
    authorization.authorizationId,
  );
  validateNonEmptyString(
    "overrideAuthorization.approvedBy",
    authorization.approvedBy,
  );
  validateNonEmptyString("overrideAuthorization.reason", authorization.reason);
  validateTimestamp(
    "overrideAuthorization.expiresAt",
    authorization.expiresAt,
  );
  validatePositiveSafeInteger(
    "overrideAuthorization.maximumOverrideMinorUnits",
    authorization.maximumOverrideMinorUnits,
  );
  if (authorization.allowedTaskTypes.length === 0) {
    throw new Error(
      "Invalid overrideAuthorization.allowedTaskTypes: expected at least one task.",
    );
  }
  for (const taskType of authorization.allowedTaskTypes) {
    if (!Object.values(AITaskType).includes(taskType)) {
      throw new Error(
        `Invalid overrideAuthorization.allowedTaskTypes: received ${String(taskType)}.`,
      );
    }
  }
  if (authorization.authorizedScopes.length === 0) {
    throw new Error(
      "Invalid overrideAuthorization.authorizedScopes: expected at least one scope.",
    );
  }
  for (const scope of authorization.authorizedScopes) {
    validateScopeReference("overrideAuthorization.authorizedScope", scope);
  }
  if (
    new Set(authorization.authorizedScopes.map(scopeKey)).size !==
    authorization.authorizedScopes.length
  ) {
    throw new Error(
      "Invalid overrideAuthorization.authorizedScopes: duplicate scopes are not allowed.",
    );
  }
}

export function validateCostGovernorRequest(
  request: CostGovernorRequest,
): void {
  if (request.contractVersion !== "1.0") {
    throw new Error("Invalid contractVersion: expected 1.0.");
  }
  validateNonEmptyString("requestId", request.requestId);
  validateTimestamp("requestedAt", request.requestedAt);
  validateNonEmptyString("reservationId", request.reservationId);
  if (!Object.values(AITaskType).includes(request.taskType)) {
    throw new Error(`Invalid taskType: received ${String(request.taskType)}.`);
  }
  if (!Object.values(ReasoningLevel).includes(request.reasoningLevel)) {
    throw new Error(
      `Invalid reasoningLevel: received ${String(request.reasoningLevel)}.`,
    );
  }
  if (request.providerId !== undefined) {
    validateNonEmptyString("providerId", request.providerId);
  }
  if (request.modelId !== undefined) {
    validateNonEmptyString("modelId", request.modelId);
  }
  validateNonEmptyString("estimatedCost.currency", request.estimatedCost.currency);
  validateNonNegativeSafeInteger(
    "estimatedCost.minorUnits",
    request.estimatedCost.minorUnits,
  );
  if (request.overrideAuthorization !== undefined) {
    validateOverride(request.overrideAuthorization);
  }
}

export function validateCostGovernorPolicy(
  policy: CostGovernorPolicy,
): void {
  validateNonEmptyString("policy.policyId", policy.policyId);
  validateNonEmptyString("policy.version", policy.version);
  validateNonEmptyString("policy.currency", policy.currency);
  validatePositiveSafeInteger("policy.minorUnitScale", policy.minorUnitScale);
  if (policy.limits.length === 0) {
    throw new Error("Invalid policy.limits: expected at least one limit.");
  }
  for (const limit of policy.limits) {
    validateBudgetLimit(limit);
    if (limit.currency !== policy.currency) {
      throw new Error(
        "Invalid policy.limits: every limit currency must match policy currency.",
      );
    }
    if (limit.policyVersion !== policy.version) {
      throw new Error(
        "Invalid policy.limits: every limit policyVersion must match policy version.",
      );
    }
  }
  if (new Set(policy.limits.map(scopeKey)).size !== policy.limits.length) {
    throw new Error("Invalid policy.limits: duplicate scopes are not allowed.");
  }
  for (const taskType of policy.criticalTaskTypes) {
    if (!Object.values(AITaskType).includes(taskType)) {
      throw new Error(
        `Invalid policy.criticalTaskTypes: received ${String(taskType)}.`,
      );
    }
  }
  for (const level of policy.criticalReasoningLevels) {
    if (!Object.values(ReasoningLevel).includes(level)) {
      throw new Error(
        `Invalid policy.criticalReasoningLevels: received ${String(level)}.`,
      );
    }
  }
  if (policy.reservationTtlMs !== undefined) {
    validatePositiveSafeInteger(
      "policy.reservationTtlMs",
      policy.reservationTtlMs,
    );
  }
}

export function validateBudgetUsageSnapshot(
  snapshot: BudgetUsageSnapshot,
  policy: CostGovernorPolicy,
): void {
  validateNonEmptyString("budgetUsage.snapshotId", snapshot.snapshotId);
  validateTimestamp("budgetUsage.capturedAt", snapshot.capturedAt);
  validateNonEmptyString("budgetUsage.currency", snapshot.currency);
  if (snapshot.currency !== policy.currency) {
    throw new Error(
      "Invalid budgetUsage.currency: it must match policy currency.",
    );
  }
  for (const usage of snapshot.usages) {
    validateScopeReference("budgetUsage.usage", usage);
    validateNonNegativeSafeInteger(
      "budgetUsage.committedMinorUnits",
      usage.committedMinorUnits,
    );
    validateNonNegativeSafeInteger(
      "budgetUsage.reservedMinorUnits",
      usage.reservedMinorUnits,
    );
  }
  if (new Set(snapshot.usages.map(scopeKey)).size !== snapshot.usages.length) {
    throw new Error(
      "Invalid budgetUsage.usages: duplicate scopes are not allowed.",
    );
  }
}
