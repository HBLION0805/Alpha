import {
  AICapability,
  AIOutputType,
  AITaskType,
  BudgetScope,
  CostDecisionReason,
  CostDecisionStatus,
  LatencyPriority,
  PrivacyLevel,
  ReasoningLevel,
  type AIRequest,
  type AIRouterConfiguration,
  type BudgetLimit,
  type BudgetUsageSnapshot,
  type CostGovernorPolicy,
  type CostGovernorRequest,
} from "../../contracts";
import {
  evaluateAICost,
  type CostGovernorInput,
  type CostGovernorResult,
} from "./AICostGovernor";
import {
  ROUTER_COST_MINOR_UNIT_SCALE,
  createCostGovernorInputFromRouter,
} from "./AIRouterCostBoundary";

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

const now = "2026-07-18T16:00:00.000Z";
const clock = { now: () => now };

function limit(
  scope: BudgetScope,
  hardLimitMinorUnits: number | null,
  softLimitMinorUnits?: number,
  scopeId?: string,
): BudgetLimit {
  return {
    scope,
    ...(scopeId === undefined ? {} : { scopeId }),
    enabled: true,
    currency: "USD",
    ...(softLimitMinorUnits === undefined ? {} : { softLimitMinorUnits }),
    hardLimitMinorUnits,
    policyVersion: "cost-policy-v1",
  };
}

const request: CostGovernorRequest = {
  contractVersion: "1.0",
  requestId: "cost-request-1",
  requestedAt: now,
  taskType: AITaskType.Summary,
  reasoningLevel: ReasoningLevel.Medium,
  providerId: "provider-a",
  modelId: "model-a",
  estimatedCost: { minorUnits: 100, currency: "USD" },
  reservationId: "reservation-1",
};

const policy: CostGovernorPolicy = {
  policyId: "cost-policy",
  version: "cost-policy-v1",
  currency: "USD",
  minorUnitScale: 1_000_000,
  limits: [
    limit(BudgetScope.PerRequest, 500, 400),
    limit(BudgetScope.Daily, 1_000, 800),
    limit(BudgetScope.Monthly, 5_000, 4_000),
  ],
  lowCostModeEnabled: true,
  criticalOverrideFeatureEnabled: true,
  criticalOverrideAllowed: true,
  criticalTaskTypes: [AITaskType.Strategy],
  criticalReasoningLevels: [ReasoningLevel.Critical],
  reservationTtlMs: 60_000,
};

const budgetUsage: BudgetUsageSnapshot = {
  snapshotId: "usage-1",
  capturedAt: now,
  currency: "USD",
  usages: [
    {
      scope: BudgetScope.Daily,
      committedMinorUnits: 100,
      reservedMinorUnits: 50,
    },
    {
      scope: BudgetScope.Monthly,
      committedMinorUnits: 500,
      reservedMinorUnits: 100,
    },
  ],
};

function evaluate(overrides: Partial<CostGovernorInput> = {}): CostGovernorResult {
  return evaluateAICost(
    {
      request,
      policy,
      budgetUsage,
      ...overrides,
    },
    clock,
  );
}

function usage(
  dailyCommitted: number,
  dailyReserved: number,
  monthlyCommitted = 500,
  monthlyReserved = 100,
): BudgetUsageSnapshot {
  return {
    ...budgetUsage,
    usages: [
      {
        scope: BudgetScope.Daily,
        committedMinorUnits: dailyCommitted,
        reservedMinorUnits: dailyReserved,
      },
      {
        scope: BudgetScope.Monthly,
        committedMinorUnits: monthlyCommitted,
        reservedMinorUnits: monthlyReserved,
      },
    ],
  };
}

function criticalRequest(
  authorizationOverrides: Partial<NonNullable<CostGovernorRequest["overrideAuthorization"]>> = {},
): CostGovernorRequest {
  return {
    ...request,
    taskType: AITaskType.Strategy,
    reasoningLevel: ReasoningLevel.Critical,
    overrideAuthorization: {
      authorizationId: "override-1",
      approvedBy: "owner",
      allowedTaskTypes: [AITaskType.Strategy],
      authorizedScopes: [{ scope: BudgetScope.Daily }],
      maximumOverrideMinorUnits: 100,
      expiresAt: "2026-07-19T16:00:00.000Z",
      reason: "Owner-approved critical task.",
      ...authorizationOverrides,
    },
  };
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "normal request is allowed and receives a reservation plan",
    run: () => {
      const result = evaluate();
      assertEqual(result.decision.status, CostDecisionStatus.Allowed, "status");
      assertEqual(result.decision.reservation?.status, "PLANNED", "reservation");
    },
  },
  {
    name: "cost exactly equal to remaining hard budget is allowed",
    run: () => {
      const exactPolicy = {
        ...policy,
        limits: policy.limits.map((item) =>
          item.scope === BudgetScope.Daily
            ? { ...item, softLimitMinorUnits: 1_000 }
            : item,
        ),
      };
      const result = evaluate({ policy: exactPolicy, budgetUsage: usage(850, 50) });
      assertTrue(
        result.decision.status !== CostDecisionStatus.RejectedBudgetExceeded,
        "exact boundary must not be rejected",
      );
      assertTrue(
        result.decision.reasons.includes(CostDecisionReason.ExactHardLimitAllowed),
        "exact boundary reason",
      );
    },
  },
  {
    name: "per-request hard limit rejects the request",
    run: () => {
      const result = evaluate({
        policy: { ...policy, limits: [limit(BudgetScope.PerRequest, 99)] },
        budgetUsage: { ...budgetUsage, usages: [] },
      });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedBudgetExceeded, "status");
    },
  },
  {
    name: "daily hard limit rejects projected usage",
    run: () => {
      const result = evaluate({ budgetUsage: usage(901, 0) });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedBudgetExceeded, "status");
    },
  },
  {
    name: "monthly hard limit rejects projected usage",
    run: () => {
      const result = evaluate({ budgetUsage: usage(0, 0, 4_901, 0) });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedBudgetExceeded, "status");
    },
  },
  {
    name: "task-category scope rejects matching task usage",
    run: () => {
      const taskLimit = limit(BudgetScope.TaskCategory, 200, undefined, AITaskType.Summary);
      const result = evaluate({
        policy: { ...policy, limits: [...policy.limits, taskLimit] },
        budgetUsage: {
          ...budgetUsage,
          usages: [
            ...budgetUsage.usages,
            { scope: BudgetScope.TaskCategory, scopeId: AITaskType.Summary, committedMinorUnits: 101, reservedMinorUnits: 0 },
          ],
        },
      });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedBudgetExceeded, "status");
    },
  },
  {
    name: "provider and model scopes reject matching identifiers",
    run: () => {
      const scopedLimits = [
        limit(BudgetScope.Provider, 100, undefined, "provider-a"),
        limit(BudgetScope.Model, 100, undefined, "model-a"),
      ];
      const result = evaluate({
        policy: { ...policy, limits: [...policy.limits, ...scopedLimits] },
        budgetUsage: {
          ...budgetUsage,
          usages: [
            ...budgetUsage.usages,
            { scope: BudgetScope.Provider, scopeId: "provider-a", committedMinorUnits: 1, reservedMinorUnits: 0 },
            { scope: BudgetScope.Model, scopeId: "model-a", committedMinorUnits: 1, reservedMinorUnits: 0 },
          ],
        },
      });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedBudgetExceeded, "status");
      assertEqual(result.decision.scopeEvaluations.filter((item) => item.hardLimitExceeded).length, 2, "scope count");
    },
  },
  {
    name: "soft threshold requires low-cost mode without exceeding hard limit",
    run: () => {
      const result = evaluate({ budgetUsage: usage(750, 0) });
      assertEqual(result.decision.status, CostDecisionStatus.AllowedLowCostOnly, "status");
      assertTrue(result.decision.lowCostRequired, "low-cost flag");
    },
  },
  {
    name: "non-critical hard-limit breach cannot use an override",
    run: () => {
      const result = evaluate({ budgetUsage: usage(950, 0) });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedBudgetExceeded, "status");
    },
  },
  {
    name: "valid critical override allows a bounded hard-limit breach",
    run: () => {
      const result = evaluate({ request: criticalRequest(), budgetUsage: usage(950, 0) });
      assertEqual(result.decision.status, CostDecisionStatus.AllowedWithOverride, "status");
      assertEqual(result.decision.requiredOverrideMinorUnits, 50, "override amount");
      assertEqual(result.auditRecord.overrideAuthorizationId, "override-1", "audit override");
    },
  },
  {
    name: "critical hard-limit breach without authorization is rejected",
    run: () => {
      const result = evaluate({
        request: {
          ...request,
          taskType: AITaskType.Strategy,
          reasoningLevel: ReasoningLevel.Critical,
        },
        budgetUsage: usage(950, 0),
      });
      assertTrue(result.decision.reasons.includes(CostDecisionReason.OverrideMissing), "missing reason");
      assertEqual(result.decision.status, CostDecisionStatus.RejectedOverrideInvalid, "status");
    },
  },
  {
    name: "policy-disabled critical override is rejected",
    run: () => {
      const result = evaluate({
        request: criticalRequest(),
        policy: { ...policy, criticalOverrideAllowed: false },
        budgetUsage: usage(950, 0),
      });
      assertTrue(result.decision.reasons.includes(CostDecisionReason.OverrideDisabled), "disabled reason");
    },
  },
  {
    name: "override authorization for the wrong task is rejected",
    run: () => {
      const result = evaluate({
        request: criticalRequest({ allowedTaskTypes: [AITaskType.Coding] }),
        budgetUsage: usage(950, 0),
      });
      assertTrue(result.decision.reasons.includes(CostDecisionReason.OverrideTaskUnauthorized), "task reason");
    },
  },
  {
    name: "empty override metadata returns a normalized invalid-override failure",
    run: () => {
      const result = evaluate({
        request: criticalRequest({ authorizationId: "" }),
        budgetUsage: usage(950, 0),
      });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedOverrideInvalid, "status");
      assertTrue(result.error !== undefined, "normalized error");
    },
  },
  {
    name: "expired critical override is rejected",
    run: () => {
      const result = evaluate({
        request: criticalRequest({ expiresAt: "2026-07-17T16:00:00.000Z" }),
        budgetUsage: usage(950, 0),
      });
      assertTrue(result.decision.reasons.includes(CostDecisionReason.OverrideExpired), "expired reason");
      assertEqual(result.decision.status, CostDecisionStatus.RejectedOverrideInvalid, "status");
    },
  },
  {
    name: "insufficient critical override amount is rejected",
    run: () => {
      const result = evaluate({
        request: criticalRequest({ maximumOverrideMinorUnits: 49 }),
        budgetUsage: usage(950, 0),
      });
      assertTrue(result.decision.reasons.includes(CostDecisionReason.OverrideAmountInsufficient), "amount reason");
    },
  },
  {
    name: "unauthorized override scope is rejected",
    run: () => {
      const result = evaluate({
        request: criticalRequest({ authorizedScopes: [{ scope: BudgetScope.Monthly }] }),
        budgetUsage: usage(950, 0),
      });
      assertTrue(result.decision.reasons.includes(CostDecisionReason.OverrideScopeUnauthorized), "scope reason");
    },
  },
  {
    name: "currency mismatch returns a normalized rejection",
    run: () => {
      const result = evaluate({ request: { ...request, estimatedCost: { minorUnits: 100, currency: "EUR" } } });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedCurrencyMismatch, "status");
    },
  },
  {
    name: "negative estimated cost returns a normalized rejection",
    run: () => {
      const result = evaluate({ request: { ...request, estimatedCost: { minorUnits: -1, currency: "USD" } } });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedInvalidCost, "status");
    },
  },
  {
    name: "non-finite estimated cost returns a normalized rejection",
    run: () => {
      const result = evaluate({ request: { ...request, estimatedCost: { minorUnits: Number.NaN, currency: "USD" } } });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedInvalidCost, "status");
    },
  },
  {
    name: "reserved usage participates in hard-limit enforcement",
    run: () => {
      const result = evaluate({ budgetUsage: usage(800, 101) });
      const daily = result.decision.scopeEvaluations.find((item) => item.scope === BudgetScope.Daily);
      assertEqual(daily?.projectedMinorUnits, 1_001, "projected usage");
      assertTrue(daily?.hardLimitExceeded === true, "hard limit flag");
    },
  },
  {
    name: "reservation plan is deterministic and includes a deterministic expiry",
    run: () => {
      const first = evaluate();
      const second = evaluate();
      assertDeepEqual(first.decision.reservation, second.decision.reservation, "reservations");
      assertEqual(first.decision.reservation?.expiresAt, "2026-07-18T16:01:00.000Z", "expiry");
    },
  },
  {
    name: "identical inputs and clock produce identical full results",
    run: () => assertDeepEqual(evaluate(), evaluate(), "governor results"),
  },
  {
    name: "evaluation does not mutate request, policy, or usage inputs",
    run: () => {
      const input = { request, policy, budgetUsage };
      const before = JSON.stringify(input);
      evaluateAICost(input, clock);
      assertEqual(JSON.stringify(input), before, "input snapshot");
    },
  },
  {
    name: "audit record contains policy, scope, reservation, and final result",
    run: () => {
      const result = evaluate();
      assertEqual(result.auditRecord.policyVersion, policy.version, "policy version");
      assertEqual(result.auditRecord.scopeEvaluations.length, 3, "scope evaluations");
      assertEqual(result.auditRecord.reservation?.reservationId, request.reservationId, "reservation id");
      assertEqual(result.auditRecord.finalResult, "ALLOWED", "final result");
      const daily = result.auditRecord.scopeEvaluations.find((item) => item.scope === BudgetScope.Daily);
      assertEqual(daily?.committedMinorUnits, 100, "committed usage");
      assertEqual(daily?.reservedMinorUnits, 50, "reserved usage");
      assertEqual(daily?.projectedMinorUnits, 250, "projected usage");
      assertEqual(daily?.remainingMinorUnits, 750, "remaining usage");
      assertTrue(result.auditRecord.decisionReasons.length > 0, "decision reasons");
    },
  },
  {
    name: "planning result contains no provider execution or AI output",
    run: () => {
      const result = evaluate() as unknown as Record<string, unknown>;
      assertTrue(!("output" in result), "no output");
      assertTrue(!("providerResponse" in result), "no provider response");
      assertTrue(!("attempts" in result), "no execution attempts");
    },
  },
  {
    name: "missing required budget usage defers deterministically",
    run: () => {
      const result = evaluate({ budgetUsage: { ...budgetUsage, usages: [] } });
      assertEqual(result.decision.status, CostDecisionStatus.DeferredBudgetUnavailable, "status");
      assertTrue(result.error?.retryable === true, "retryable error");
      assertEqual(result.auditRecord.unavailableScopes.length, 2, "unavailable scopes");
    },
  },
  {
    name: "zero budget permits exactly zero cost",
    run: () => {
      const zeroRequest = { ...request, estimatedCost: { minorUnits: 0, currency: "USD" } };
      const zeroPolicy = { ...policy, limits: [limit(BudgetScope.PerRequest, 0)] };
      const result = evaluate({ request: zeroRequest, policy: zeroPolicy, budgetUsage: { ...budgetUsage, usages: [] } });
      assertEqual(result.decision.status, CostDecisionStatus.Allowed, "status");
    },
  },
  {
    name: "soft limit above hard limit returns normalized invalid-policy failure",
    run: () => {
      const result = evaluate({ policy: { ...policy, limits: [limit(BudgetScope.PerRequest, 100, 101)] } });
      assertEqual(result.decision.status, CostDecisionStatus.RejectedInvalidPolicy, "status");
    },
  },
  {
    name: "invalid usage returns a normalized deferred failure",
    run: () => {
      const result = evaluate({ budgetUsage: usage(-1, 0) });
      assertEqual(result.decision.status, CostDecisionStatus.DeferredBudgetUnavailable, "status");
    },
  },
  {
    name: "disabled and unlimited scopes are handled explicitly",
    run: () => {
      const result = evaluate({
        policy: {
          ...policy,
          limits: [
            { ...limit(BudgetScope.Daily, 0), enabled: false },
            limit(BudgetScope.Monthly, null),
          ],
        },
        budgetUsage: {
          ...budgetUsage,
          usages: [{ scope: BudgetScope.Monthly, committedMinorUnits: 9_000, reservedMinorUnits: 1_000 }],
        },
      });
      assertEqual(result.decision.status, CostDecisionStatus.Allowed, "status");
      assertTrue(result.decision.reasons.includes(CostDecisionReason.DisabledScopeIgnored), "disabled reason");
      assertTrue(result.decision.reasons.includes(CostDecisionReason.UnlimitedScope), "unlimited reason");
    },
  },
  {
    name: "Router cost boundary maps estimates and aggregate usage into minor units",
    run: () => {
      const routerRequest = {
        contractVersion: "1.0",
        requestId: "router-request-1",
        requestedAt: now,
        requestedBy: "summary-module",
        taskType: AITaskType.Summary,
        requiredCapabilities: [AICapability.Fast],
        reasoningLevel: ReasoningLevel.Low,
        constraints: {
          estimatedInputTokens: 1_000,
          reservedOutputTokens: 500,
          maximumEstimatedCost: 0.01,
          currency: "USD",
          latencyPriority: LatencyPriority.Normal,
          privacyLevel: PrivacyLevel.Internal,
          externalProcessingAllowed: true,
          retentionAllowed: false,
          deterministicAllowed: true,
          contextReductionAllowed: false,
          expectedOutputType: AIOutputType.Text,
          strictSchema: false,
          functionCallingRequired: false,
        },
        contextFingerprint: "sha256:test",
      } satisfies AIRequest;
      const routerConfiguration = {
        budgetPolicy: {
          policyId: "router-budget",
          version: "router-budget-v1",
          currency: "USD",
          perRequestLimit: 0.02,
          dailyBudget: 1,
          monthlyBudget: 10,
          lowCostMode: false,
          warningThresholdPercentage: 80,
          criticalOverrideAllowed: true,
        },
        featureFlags: { criticalOverridesEnabled: true },
      } as AIRouterConfiguration;
      const mapped = createCostGovernorInputFromRouter({
        request: routerRequest,
        estimatedCost: {
          currency: "USD",
          estimatedInputCost: 0.001,
          estimatedOutputCost: 0.001,
          estimatedFixedCost: 0,
          estimatedTotalCost: 0.002,
          pricingVersion: "pricing-v1",
        },
        selectedProviderId: "provider-a",
        selectedModelId: "model-a",
        reservationId: "router-reservation-1",
        configuration: routerConfiguration,
        budgetUsage: { currency: "USD", dailyCost: 0.1, monthlyCost: 0.2, capturedAt: now },
      });
      assertEqual(mapped.request.estimatedCost.minorUnits, 2_000, "mapped cost");
      assertEqual(mapped.policy.minorUnitScale, ROUTER_COST_MINOR_UNIT_SCALE, "scale");
      assertEqual(mapped.budgetUsage.usages[0]?.committedMinorUnits, 100_000, "daily usage");
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
  `AI Cost Governor: ${String(passed)}/${String(tests.length)} tests passed.`,
);
