import {
  AICapability,
  ReasoningLevel,
  BudgetScope,
  type AIRequest,
  type AIRouterConfiguration,
  type BudgetLimit,
  type BudgetUsageSnapshot,
  type CostEstimate,
  type CostGovernorPolicy,
  type CostGovernorRequest,
  type CriticalOverrideAuthorization,
} from "../../contracts";
import type { BudgetUsageSnapshot as RouterBudgetUsageSnapshot } from "../ai-router";
import type { CostGovernorInput } from "./AICostGovernor";

export const ROUTER_COST_MINOR_UNIT_SCALE = 1_000_000;

function toMinorUnits(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid ${name}: expected a finite non-negative number; received ${String(value)}.`,
    );
  }
  const minorUnits = Math.round(value * ROUTER_COST_MINOR_UNIT_SCALE);
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error(`Invalid ${name}: value exceeds safe minor-unit range.`);
  }
  return minorUnits;
}

function createLimit(
  scope: BudgetScope,
  hardLimit: number,
  configuration: AIRouterConfiguration,
  scopeId?: string,
): BudgetLimit {
  const warningPercentage =
    configuration.budgetPolicy.warningThresholdPercentage / 100;
  const softLimit = configuration.budgetPolicy.lowCostMode
    ? 0
    : hardLimit * warningPercentage;
  return {
    scope,
    ...(scopeId === undefined ? {} : { scopeId }),
    enabled: true,
    currency: configuration.budgetPolicy.currency,
    softLimitMinorUnits: toMinorUnits("soft budget limit", softLimit),
    hardLimitMinorUnits: toMinorUnits("hard budget limit", hardLimit),
    policyVersion: configuration.budgetPolicy.version,
  };
}

function createOverride(
  request: AIRequest,
): CriticalOverrideAuthorization | undefined {
  const override = request.criticalOverride;
  if (override === undefined) {
    return undefined;
  }
  return {
    authorizationId: override.authorizationId,
    approvedBy: override.approvedBy,
    allowedTaskTypes: [request.taskType],
    authorizedScopes: [
      { scope: BudgetScope.PerRequest },
      { scope: BudgetScope.Daily },
      { scope: BudgetScope.Monthly },
    ],
    maximumOverrideMinorUnits: toMinorUnits(
      "critical override maximum",
      override.maximumAdditionalCost,
    ),
    expiresAt: override.expiresAt,
    reason: override.reason,
  };
}

export interface AIRouterCostBoundaryInput {
  readonly request: AIRequest;
  readonly estimatedCost: CostEstimate;
  readonly selectedProviderId: string;
  readonly selectedModelId: string;
  readonly reservationId: string;
  readonly configuration: AIRouterConfiguration;
  readonly budgetUsage: RouterBudgetUsageSnapshot;
}

export function createCostGovernorInputFromRouter(
  input: AIRouterCostBoundaryInput,
): CostGovernorInput {
  if (
    input.estimatedCost.currency !== input.request.constraints.currency ||
    input.estimatedCost.currency !== input.configuration.budgetPolicy.currency
  ) {
    throw new Error(
      "Invalid Router cost boundary: request, estimate, and policy currencies must match.",
    );
  }

  const request: CostGovernorRequest = {
    contractVersion: "1.0",
    requestId: input.request.requestId,
    requestedAt: input.request.requestedAt,
    taskType: input.request.taskType,
    reasoningLevel: input.request.reasoningLevel,
    providerId: input.selectedProviderId,
    modelId: input.selectedModelId,
    estimatedCost: {
      minorUnits: toMinorUnits(
        "estimated total cost",
        input.estimatedCost.estimatedTotalCost,
      ),
      currency: input.estimatedCost.currency,
    },
    reservationId: input.reservationId,
    ...(input.request.criticalOverride === undefined
      ? {}
      : { overrideAuthorization: createOverride(input.request)! }),
  };
  const limits: ReadonlyArray<BudgetLimit> = [
    createLimit(
      BudgetScope.PerRequest,
      Math.min(
        input.request.constraints.maximumEstimatedCost,
        input.configuration.budgetPolicy.perRequestLimit,
      ),
      input.configuration,
    ),
    createLimit(
      BudgetScope.Daily,
      input.configuration.budgetPolicy.dailyBudget,
      input.configuration,
    ),
    createLimit(
      BudgetScope.Monthly,
      input.configuration.budgetPolicy.monthlyBudget,
      input.configuration,
    ),
  ];
  const criticalTaskTypes = input.request.requiredCapabilities.includes(
    AICapability.CriticalDecision,
  )
    ? [input.request.taskType]
    : [];
  const policy: CostGovernorPolicy = {
    policyId: input.configuration.budgetPolicy.policyId,
    version: input.configuration.budgetPolicy.version,
    currency: input.configuration.budgetPolicy.currency,
    minorUnitScale: ROUTER_COST_MINOR_UNIT_SCALE,
    limits,
    lowCostModeEnabled: true,
    criticalOverrideFeatureEnabled:
      input.configuration.featureFlags.criticalOverridesEnabled,
    criticalOverrideAllowed:
      input.configuration.budgetPolicy.criticalOverrideAllowed,
    criticalTaskTypes,
    criticalReasoningLevels: [ReasoningLevel.Critical],
  };
  const budgetUsage: BudgetUsageSnapshot = {
    snapshotId: `router:${input.budgetUsage.capturedAt}`,
    capturedAt: input.budgetUsage.capturedAt,
    currency: input.budgetUsage.currency,
    usages: [
      {
        scope: BudgetScope.Daily,
        committedMinorUnits: toMinorUnits(
          "daily budget usage",
          input.budgetUsage.dailyCost,
        ),
        reservedMinorUnits: 0,
      },
      {
        scope: BudgetScope.Monthly,
        committedMinorUnits: toMinorUnits(
          "monthly budget usage",
          input.budgetUsage.monthlyCost,
        ),
        reservedMinorUnits: 0,
      },
    ],
  };

  return { request, policy, budgetUsage };
}
