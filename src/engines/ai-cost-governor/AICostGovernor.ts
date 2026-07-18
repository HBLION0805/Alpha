import {
  BudgetReservationStatus,
  BudgetScope,
  BudgetStatus,
  CostDecisionReason,
  CostDecisionStatus,
  CostGovernorErrorCategory,
  type BudgetLimit,
  type BudgetReservation,
  type BudgetScopeEvaluation,
  type BudgetScopeReference,
  type BudgetUsageSnapshot,
  type CostAuditRecord,
  type CostGovernorDecision,
  type CostGovernorError,
  type CostGovernorPolicy,
  type CostGovernorRequest,
  type MinorUnitAmount,
  validateBudgetUsageSnapshot,
  validateCostGovernorPolicy,
  validateCostGovernorRequest,
} from "../../contracts";

export interface CostGovernorClock {
  now(): string;
}

export interface CostGovernorInput {
  readonly request: CostGovernorRequest;
  readonly policy: CostGovernorPolicy;
  readonly budgetUsage: BudgetUsageSnapshot;
}

export interface CostGovernorResult {
  readonly decision: CostGovernorDecision;
  readonly auditRecord: CostAuditRecord;
  readonly error?: CostGovernorError;
}

interface OverrideEvaluation {
  readonly allowed: boolean;
  readonly reasons: ReadonlyArray<CostDecisionReason>;
}

const SYSTEM_CLOCK: CostGovernorClock = {
  now: () => new Date().toISOString(),
};

function uniqueValues<T>(values: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...new Set(values)];
}

function scopeKey(reference: BudgetScopeReference): string {
  return `${reference.scope}:${reference.scopeId ?? ""}`;
}

function matchesRequestScope(
  limit: BudgetLimit,
  request: CostGovernorRequest,
): boolean {
  if (
    limit.scope === BudgetScope.PerRequest ||
    limit.scope === BudgetScope.Daily ||
    limit.scope === BudgetScope.Monthly
  ) {
    return true;
  }
  if (limit.scope === BudgetScope.TaskCategory) {
    return limit.scopeId === request.taskType;
  }
  if (limit.scope === BudgetScope.Provider) {
    return request.providerId !== undefined && limit.scopeId === request.providerId;
  }
  return request.modelId !== undefined && limit.scopeId === request.modelId;
}

function safeAdd(name: string, values: ReadonlyArray<number>): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error(`Invalid ${name}: monetary arithmetic exceeded safe integer range.`);
  }
  return total;
}

function evaluateScopes(
  request: CostGovernorRequest,
  policy: CostGovernorPolicy,
  budgetUsage: BudgetUsageSnapshot,
): {
  readonly evaluations: ReadonlyArray<BudgetScopeEvaluation>;
  readonly missingScopes: ReadonlyArray<BudgetScopeReference>;
} {
  const usageByScope = new Map(
    budgetUsage.usages.map((usage) => [scopeKey(usage), usage]),
  );
  const evaluations: BudgetScopeEvaluation[] = [];
  const missingScopes: BudgetScopeReference[] = [];

  for (const limit of policy.limits.filter((candidate) =>
    matchesRequestScope(candidate, request),
  )) {
    const reference: BudgetScopeReference = {
      scope: limit.scope,
      ...(limit.scopeId === undefined ? {} : { scopeId: limit.scopeId }),
    };
    const usage = usageByScope.get(scopeKey(limit));
    const usageRequired = limit.enabled && limit.scope !== BudgetScope.PerRequest;
    if (usageRequired && usage === undefined) {
      missingScopes.push(reference);
      continue;
    }

    const committedMinorUnits = usage?.committedMinorUnits ?? 0;
    const reservedMinorUnits = usage?.reservedMinorUnits ?? 0;
    const projectedMinorUnits = safeAdd("projected usage", [
      committedMinorUnits,
      reservedMinorUnits,
      request.estimatedCost.minorUnits,
    ]);
    const softThresholdExceeded =
      limit.enabled &&
      limit.softLimitMinorUnits !== undefined &&
      projectedMinorUnits > limit.softLimitMinorUnits;
    const hardLimitExceeded =
      limit.enabled &&
      limit.hardLimitMinorUnits !== null &&
      projectedMinorUnits > limit.hardLimitMinorUnits;
    const remainingMinorUnits =
      limit.hardLimitMinorUnits === null
        ? null
        : limit.hardLimitMinorUnits - projectedMinorUnits;
    if (
      remainingMinorUnits !== null &&
      !Number.isSafeInteger(remainingMinorUnits)
    ) {
      throw new Error(
        "Invalid remaining budget: monetary arithmetic exceeded safe integer range.",
      );
    }
    const status = !limit.enabled
      ? BudgetStatus.Disabled
      : limit.hardLimitMinorUnits === null
        ? BudgetStatus.Unlimited
        : hardLimitExceeded
          ? BudgetStatus.HardLimitExceeded
          : softThresholdExceeded
            ? BudgetStatus.SoftLimitExceeded
            : BudgetStatus.Available;

    evaluations.push({
      ...reference,
      enabled: limit.enabled,
      status,
      currency: limit.currency,
      policyVersion: limit.policyVersion,
      ...(limit.softLimitMinorUnits === undefined
        ? {}
        : { softLimitMinorUnits: limit.softLimitMinorUnits }),
      hardLimitMinorUnits: limit.hardLimitMinorUnits,
      committedMinorUnits,
      reservedMinorUnits,
      estimatedNewMinorUnits: request.estimatedCost.minorUnits,
      projectedMinorUnits,
      remainingMinorUnits,
      softThresholdExceeded,
      hardLimitExceeded,
    });
  }

  return { evaluations, missingScopes };
}

function referencesEqual(
  left: BudgetScopeReference,
  right: BudgetScopeReference,
): boolean {
  return left.scope === right.scope && left.scopeId === right.scopeId;
}

function evaluateOverride(
  request: CostGovernorRequest,
  policy: CostGovernorPolicy,
  exceededScopes: ReadonlyArray<BudgetScopeEvaluation>,
  requiredOverrideMinorUnits: number,
  now: string,
): OverrideEvaluation {
  const criticalRequest =
    policy.criticalTaskTypes.includes(request.taskType) ||
    policy.criticalReasoningLevels.includes(request.reasoningLevel);
  const authorization = request.overrideAuthorization;

  if (!policy.criticalOverrideFeatureEnabled || !policy.criticalOverrideAllowed) {
    return {
      allowed: false,
      reasons:
        authorization === undefined
          ? []
          : [CostDecisionReason.OverrideDisabled],
    };
  }
  if (!criticalRequest) {
    return {
      allowed: false,
      reasons:
        authorization === undefined
          ? []
          : [CostDecisionReason.OverrideTaskUnauthorized],
    };
  }
  if (authorization === undefined) {
    return { allowed: false, reasons: [CostDecisionReason.OverrideMissing] };
  }
  if (!authorization.allowedTaskTypes.includes(request.taskType)) {
    return {
      allowed: false,
      reasons: [CostDecisionReason.OverrideTaskUnauthorized],
    };
  }
  if (Date.parse(authorization.expiresAt) <= Date.parse(now)) {
    return { allowed: false, reasons: [CostDecisionReason.OverrideExpired] };
  }
  if (
    authorization.maximumOverrideMinorUnits < requiredOverrideMinorUnits
  ) {
    return {
      allowed: false,
      reasons: [CostDecisionReason.OverrideAmountInsufficient],
    };
  }
  if (
    exceededScopes.some(
      (evaluation) =>
        !authorization.authorizedScopes.some((scope) =>
          referencesEqual(scope, evaluation),
        ),
    )
  ) {
    return {
      allowed: false,
      reasons: [CostDecisionReason.OverrideScopeUnauthorized],
    };
  }

  return { allowed: true, reasons: [CostDecisionReason.OverrideApplied] };
}

function createReservation(
  request: CostGovernorRequest,
  policy: CostGovernorPolicy,
  evaluations: ReadonlyArray<BudgetScopeEvaluation>,
  now: string,
): BudgetReservation {
  const expiresAt =
    policy.reservationTtlMs === undefined
      ? undefined
      : new Date(Date.parse(now) + policy.reservationTtlMs).toISOString();

  return {
    reservationId: request.reservationId,
    requestId: request.requestId,
    amount: request.estimatedCost,
    applicableScopes: evaluations
      .filter((evaluation) => evaluation.enabled)
      .map((evaluation) => ({
        scope: evaluation.scope,
        ...(evaluation.scopeId === undefined
          ? {}
          : { scopeId: evaluation.scopeId }),
      })),
    createdAt: now,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    status: BudgetReservationStatus.Planned,
    policyVersion: policy.version,
  };
}

function finalResultForStatus(
  status: CostDecisionStatus,
): CostAuditRecord["finalResult"] {
  if (status === CostDecisionStatus.DeferredBudgetUnavailable) {
    return "DEFERRED";
  }
  if (
    status === CostDecisionStatus.Allowed ||
    status === CostDecisionStatus.AllowedLowCostOnly ||
    status === CostDecisionStatus.AllowedWithOverride
  ) {
    return "ALLOWED";
  }
  return "REJECTED";
}

function createResult(
  request: CostGovernorRequest,
  policy: CostGovernorPolicy,
  now: string,
  status: CostDecisionStatus,
  reasons: ReadonlyArray<CostDecisionReason>,
  evaluations: ReadonlyArray<BudgetScopeEvaluation>,
  requiredOverrideMinorUnits: number,
  reservation?: BudgetReservation,
  error?: CostGovernorError,
  unavailableScopes: ReadonlyArray<BudgetScopeReference> = [],
): CostGovernorResult {
  const requestId = request.requestId.trim().length === 0
    ? "INVALID_REQUEST"
    : request.requestId;
  const policyVersion = policy.version.trim().length === 0
    ? "INVALID_POLICY"
    : policy.version;
  const decisionId = `${requestId}:cost:${policyVersion}`;
  const lowCostRequired = status === CostDecisionStatus.AllowedLowCostOnly;
  const decision: CostGovernorDecision = {
    decisionId,
    requestId,
    timestamp: now,
    policyVersion,
    status,
    reasons: uniqueValues(reasons),
    estimatedCost: request.estimatedCost,
    scopeEvaluations: evaluations,
    unavailableScopes,
    lowCostRequired,
    requiredOverrideMinorUnits,
    ...(status === CostDecisionStatus.AllowedWithOverride &&
    request.overrideAuthorization !== undefined
      ? { overrideAuthorizationId: request.overrideAuthorization.authorizationId }
      : {}),
    ...(reservation === undefined ? {} : { reservation }),
  };
  const auditRecord: CostAuditRecord = {
    auditId: `${decisionId}:audit`,
    decisionId,
    requestId,
    timestamp: now,
    policyVersion,
    estimatedCost: request.estimatedCost,
    scopeEvaluations: evaluations,
    unavailableScopes,
    decisionStatus: status,
    decisionReasons: decision.reasons,
    lowCostRequired,
    ...(decision.overrideAuthorizationId === undefined
      ? {}
      : { overrideAuthorizationId: decision.overrideAuthorizationId }),
    ...(reservation === undefined ? {} : { reservation }),
    finalResult: finalResultForStatus(status),
    ...(error === undefined ? {} : { error }),
  };
  return {
    decision,
    auditRecord,
    ...(error === undefined ? {} : { error }),
  };
}

function createError(
  category: CostGovernorErrorCategory,
  message: string,
  now: string,
  retryable: boolean,
): CostGovernorError {
  return {
    category,
    code: category,
    safeMessage: message,
    retryable,
    occurredAt: now,
  };
}

function validationFailure(
  request: CostGovernorRequest,
  policy: CostGovernorPolicy,
  now: string,
  status: CostDecisionStatus,
  reason: CostDecisionReason,
  category: CostGovernorErrorCategory,
  message: string,
  retryable = false,
): CostGovernorResult {
  const error = createError(category, message, now, retryable);
  return createResult(
    request,
    policy,
    now,
    status,
    [reason],
    [],
    0,
    undefined,
    error,
  );
}

export function evaluateAICost(
  input: CostGovernorInput,
  clock: CostGovernorClock = SYSTEM_CLOCK,
): CostGovernorResult {
  const now = clock.now();

  try {
    validateCostGovernorRequest(input.request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const invalidCost = message.includes("estimatedCost");
    const invalidOverride = message.includes("overrideAuthorization");
    return validationFailure(
      input.request,
      input.policy,
      now,
      invalidCost
        ? CostDecisionStatus.RejectedInvalidCost
        : invalidOverride
          ? CostDecisionStatus.RejectedOverrideInvalid
          : CostDecisionStatus.RejectedInvalidRequest,
      invalidCost
        ? CostDecisionReason.InvalidEstimatedCost
        : invalidOverride
          ? CostDecisionReason.OverrideMetadataInvalid
          : CostDecisionReason.InvalidRequest,
      invalidCost
        ? CostGovernorErrorCategory.InvalidCost
        : invalidOverride
          ? CostGovernorErrorCategory.OverrideInvalid
          : CostGovernorErrorCategory.InvalidRequest,
      `Cost Governor request validation failed: ${message}`,
    );
  }

  try {
    validateCostGovernorPolicy(input.policy);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return validationFailure(
      input.request,
      input.policy,
      now,
      CostDecisionStatus.RejectedInvalidPolicy,
      CostDecisionReason.InvalidPolicy,
      CostGovernorErrorCategory.InvalidPolicy,
      `Cost Governor policy validation failed: ${message}`,
    );
  }

  if (input.request.estimatedCost.currency !== input.policy.currency) {
    return validationFailure(
      input.request,
      input.policy,
      now,
      CostDecisionStatus.RejectedCurrencyMismatch,
      CostDecisionReason.CurrencyMismatch,
      CostGovernorErrorCategory.CurrencyMismatch,
      "Estimated cost currency does not match policy currency.",
    );
  }

  try {
    validateBudgetUsageSnapshot(input.budgetUsage, input.policy);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const currencyMismatch = message.includes("currency");
    return validationFailure(
      input.request,
      input.policy,
      now,
      currencyMismatch
        ? CostDecisionStatus.RejectedCurrencyMismatch
        : CostDecisionStatus.DeferredBudgetUnavailable,
      currencyMismatch
        ? CostDecisionReason.CurrencyMismatch
        : CostDecisionReason.InvalidUsage,
      currencyMismatch
        ? CostGovernorErrorCategory.CurrencyMismatch
        : CostGovernorErrorCategory.InvalidUsage,
      `Budget usage validation failed: ${message}`,
      !currencyMismatch,
    );
  }

  let evaluations: ReadonlyArray<BudgetScopeEvaluation>;
  let missingScopes: ReadonlyArray<BudgetScopeReference>;
  try {
    ({ evaluations, missingScopes } = evaluateScopes(
      input.request,
      input.policy,
      input.budgetUsage,
    ));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return validationFailure(
      input.request,
      input.policy,
      now,
      CostDecisionStatus.RejectedInvalidCost,
      CostDecisionReason.InvalidEstimatedCost,
      CostGovernorErrorCategory.InvalidCost,
      message,
    );
  }

  if (missingScopes.length > 0) {
    const error = createError(
      CostGovernorErrorCategory.BudgetUnavailable,
      `Budget usage is unavailable for: ${missingScopes.map(scopeKey).join(", ")}.`,
      now,
      true,
    );
    return createResult(
      input.request,
      input.policy,
      now,
      CostDecisionStatus.DeferredBudgetUnavailable,
      [CostDecisionReason.BudgetUsageUnavailable],
      evaluations,
      0,
      undefined,
      error,
      missingScopes,
    );
  }

  const exceededScopes = evaluations.filter(
    (evaluation) => evaluation.hardLimitExceeded,
  );
  const softExceeded = evaluations.some(
    (evaluation) => evaluation.softThresholdExceeded,
  );
  const exactHardLimit = evaluations.some(
    (evaluation) =>
      evaluation.enabled &&
      evaluation.hardLimitMinorUnits !== null &&
      evaluation.projectedMinorUnits === evaluation.hardLimitMinorUnits,
  );
  const unlimitedScope = evaluations.some(
    (evaluation) => evaluation.enabled && evaluation.hardLimitMinorUnits === null,
  );
  const disabledScope = evaluations.some((evaluation) => !evaluation.enabled);
  const baseReasons: CostDecisionReason[] = [
    ...(softExceeded ? [CostDecisionReason.SoftThresholdExceeded] : []),
    ...(exactHardLimit ? [CostDecisionReason.ExactHardLimitAllowed] : []),
    ...(unlimitedScope ? [CostDecisionReason.UnlimitedScope] : []),
    ...(disabledScope ? [CostDecisionReason.DisabledScopeIgnored] : []),
  ];

  if (exceededScopes.length === 0) {
    const lowCostRequired = softExceeded && input.policy.lowCostModeEnabled;
    const status = lowCostRequired
      ? CostDecisionStatus.AllowedLowCostOnly
      : CostDecisionStatus.Allowed;
    const reasons = [
      CostDecisionReason.AllHardLimitsSatisfied,
      ...baseReasons,
      ...(lowCostRequired ? [CostDecisionReason.LowCostModeRequired] : []),
    ];
    const reservation = createReservation(
      input.request,
      input.policy,
      evaluations,
      now,
    );
    return createResult(
      input.request,
      input.policy,
      now,
      status,
      reasons,
      evaluations,
      0,
      reservation,
    );
  }

  const requiredOverrideMinorUnits = Math.max(
    ...exceededScopes.map((evaluation) =>
      Math.abs(evaluation.remainingMinorUnits ?? 0),
    ),
  );
  const override = evaluateOverride(
    input.request,
    input.policy,
    exceededScopes,
    requiredOverrideMinorUnits,
    now,
  );

  if (override.allowed) {
    const reservation = createReservation(
      input.request,
      input.policy,
      evaluations,
      now,
    );
    return createResult(
      input.request,
      input.policy,
      now,
      CostDecisionStatus.AllowedWithOverride,
      [CostDecisionReason.HardLimitExceeded, ...baseReasons, ...override.reasons],
      evaluations,
      requiredOverrideMinorUnits,
      reservation,
    );
  }

  const invalidOverride = override.reasons.length > 0;
  const status = invalidOverride
    ? CostDecisionStatus.RejectedOverrideInvalid
    : CostDecisionStatus.RejectedBudgetExceeded;
  const category = invalidOverride
    ? CostGovernorErrorCategory.OverrideInvalid
    : CostGovernorErrorCategory.BudgetExceeded;
  const error = createError(
    category,
    invalidOverride
      ? "Hard budget limit exceeded and the critical override is invalid."
      : "Hard budget limit exceeded.",
    now,
    false,
  );
  return createResult(
    input.request,
    input.policy,
    now,
    status,
    [CostDecisionReason.HardLimitExceeded, ...baseReasons, ...override.reasons],
    evaluations,
    requiredOverrideMinorUnits,
    undefined,
    error,
  );
}
