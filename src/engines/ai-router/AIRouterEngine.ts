import {
  AICapability,
  AIErrorCategory,
  AIOutputType,
  LatencyPriority,
  ModelAvailability,
  PrivacyLevel,
  ProviderProcessingBoundary,
  ReasoningLevel,
  RoutingAuditStatus,
  RoutingDecisionStatus,
  RoutingCostMode,
  type AIRequest,
  type AIRouterConfiguration,
  type AISelectedRoutingDecision,
  type CapabilityProfileConfiguration,
  type CostEstimate,
  type FallbackCandidate,
  type ModelDefinition,
  type NormalizedAIError,
  type ProviderDefinition,
  type RejectedRoutingCandidate,
  type RejectedRoutingDecision,
  type RoutingAuditRecord,
  type RoutingCandidate,
  type RoutingReason,
  type TaskRoutingPolicy,
  validateAIRequest,
  validateAIRouterConfiguration,
  validateModelDefinition,
} from "../../contracts";

export enum CandidateRejectionReason {
  ProviderDisabled = "PROVIDER_DISABLED",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  ModelDisabled = "MODEL_DISABLED",
  ModelUnavailable = "MODEL_UNAVAILABLE",
  RequiredCapabilityUnavailable = "REQUIRED_CAPABILITY_UNAVAILABLE",
  ReasoningLevelUnsupported = "REASONING_LEVEL_UNSUPPORTED",
  ContextLimitExceeded = "CONTEXT_LIMIT_EXCEEDED",
  OutputLimitExceeded = "OUTPUT_LIMIT_EXCEEDED",
  OutputTypeUnsupported = "OUTPUT_TYPE_UNSUPPORTED",
  FunctionCallingUnsupported = "FUNCTION_CALLING_UNSUPPORTED",
  VisionUnsupported = "VISION_UNSUPPORTED",
  PrivacyLevelUnsupported = "PRIVACY_LEVEL_UNSUPPORTED",
  ExternalProcessingProhibited = "EXTERNAL_PROCESSING_PROHIBITED",
  ProcessingRegionUnsupported = "PROCESSING_REGION_UNSUPPORTED",
  ZeroRetentionUnsupported = "ZERO_RETENTION_UNSUPPORTED",
  ReliabilityBelowMinimum = "RELIABILITY_BELOW_MINIMUM",
  LatencyRequirementUnsupported = "LATENCY_REQUIREMENT_UNSUPPORTED",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  CostGovernanceDisabled = "COST_GOVERNANCE_DISABLED",
  RequestBudgetExceeded = "REQUEST_BUDGET_EXCEEDED",
  DailyBudgetExceeded = "DAILY_BUDGET_EXCEEDED",
  MonthlyBudgetExceeded = "MONTHLY_BUDGET_EXCEEDED",
  CriticalOverrideNotAuthorized = "CRITICAL_OVERRIDE_NOT_AUTHORIZED",
}

export interface BudgetUsageSnapshot {
  readonly currency: string;
  readonly dailyCost: number;
  readonly monthlyCost: number;
  readonly capturedAt: string;
}

export interface AIRouterEngineClock {
  now(): string;
}

export interface AIRouterEngineInput {
  readonly request: AIRequest;
  readonly configuration: AIRouterConfiguration;
  readonly budgetUsage?: BudgetUsageSnapshot;
}

export interface AIRouterEngineSuccess {
  readonly success: true;
  readonly decision: AISelectedRoutingDecision;
  readonly auditRecord: RoutingAuditRecord;
}

export interface AIRouterEngineFailure {
  readonly success: false;
  readonly decision: RejectedRoutingDecision;
  readonly error: NormalizedAIError;
  readonly auditRecord: RoutingAuditRecord;
}

export type AIRouterEngineResult =
  | AIRouterEngineSuccess
  | AIRouterEngineFailure;

interface EvaluatedCandidate {
  readonly provider: ProviderDefinition;
  readonly model: ModelDefinition;
  readonly cost: CostEstimate;
  readonly effectiveReliability: number;
  readonly reasoningHeadroom: number;
  readonly contextHeadroom: number;
  readonly overrideApplied: boolean;
  readonly rejectionReasons: ReadonlyArray<CandidateRejectionReason>;
}

interface ResolvedRequirements {
  readonly taskPolicy: TaskRoutingPolicy;
  readonly requiredCapabilities: ReadonlyArray<AICapability>;
  readonly minimumReasoningRank: number;
  readonly minimumReliability: number;
  readonly minimumContextTokens: number;
  readonly maximumP95LatencyMs?: number;
  readonly functionCallingRequired: boolean;
  readonly visionRequired: boolean;
  readonly lowCostMode: boolean;
}

interface BudgetEvaluation {
  readonly rejectionReasons: ReadonlyArray<CandidateRejectionReason>;
  readonly overrideApplied: boolean;
}

const REASONING_RANK: Readonly<Record<ReasoningLevel, number>> = {
  [ReasoningLevel.None]: 0,
  [ReasoningLevel.Low]: 1,
  [ReasoningLevel.Medium]: 2,
  [ReasoningLevel.High]: 3,
  [ReasoningLevel.Critical]: 4,
};

const SYSTEM_CLOCK: AIRouterEngineClock = {
  now: () => new Date().toISOString(),
};

const COST_DECIMAL_PLACES = 12;

function roundCost(value: number): number {
  const factor = 10 ** COST_DECIMAL_PLACES;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validateBudgetUsage(
  usage: BudgetUsageSnapshot,
  budgetCurrency: string,
): void {
  if (usage.currency.trim().length === 0 || usage.currency !== budgetCurrency) {
    throw new Error(
      "Invalid budget usage: currency must match the budget policy currency.",
    );
  }
  if (!Number.isFinite(usage.dailyCost) || usage.dailyCost < 0) {
    throw new Error(
      "Invalid budget usage: dailyCost must be a finite non-negative number.",
    );
  }
  if (!Number.isFinite(usage.monthlyCost) || usage.monthlyCost < 0) {
    throw new Error(
      "Invalid budget usage: monthlyCost must be a finite non-negative number.",
    );
  }
  if (usage.dailyCost > usage.monthlyCost) {
    throw new Error(
      "Invalid budget usage: dailyCost cannot exceed monthlyCost.",
    );
  }
  if (!Number.isFinite(Date.parse(usage.capturedAt))) {
    throw new Error(
      "Invalid budget usage: capturedAt must be an ISO-8601 timestamp.",
    );
  }
}

function uniqueValues<T>(values: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...new Set(values)];
}

function maximumReasoningRank(
  levels: ReadonlyArray<ReasoningLevel>,
): number {
  return Math.max(...levels.map((level) => REASONING_RANK[level]));
}

function isOperational(availability: ModelAvailability): boolean {
  return (
    availability === ModelAvailability.Available ||
    availability === ModelAvailability.Degraded
  );
}

function compareNumberAscending(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareNumberDescending(left: number, right: number): number {
  return compareNumberAscending(right, left);
}

function compareStringAscending(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function firstNonZero(comparisons: ReadonlyArray<number>): number {
  return comparisons.find((comparison) => comparison !== 0) ?? 0;
}

function resolvedCapabilityProfiles(
  requiredCapabilities: ReadonlyArray<AICapability>,
  profiles: ReadonlyArray<CapabilityProfileConfiguration>,
): ReadonlyArray<CapabilityProfileConfiguration> {
  const required = new Set(requiredCapabilities);
  return profiles.filter((profile) => required.has(profile.capability));
}

function resolveRequirements(
  request: AIRequest,
  configuration: AIRouterConfiguration,
): ResolvedRequirements {
  const taskPolicy = configuration.routingPolicy.taskPolicies.find(
    (policy) => policy.taskType === request.taskType,
  );
  if (taskPolicy === undefined) {
    throw new Error(
      `Invalid routing configuration: no task policy for ${request.taskType}.`,
    );
  }
  if (!taskPolicy.allowedOutputTypes.includes(request.constraints.expectedOutputType)) {
    throw new Error(
      `Invalid request: output type ${request.constraints.expectedOutputType} is not allowed for ${request.taskType}.`,
    );
  }
  if (taskPolicy.deterministicOnly) {
    throw new Error(
      `Invalid request: task ${request.taskType} is configured as deterministic-only.`,
    );
  }

  const requiredCapabilities = uniqueValues([
    ...taskPolicy.requiredCapabilities,
    ...request.requiredCapabilities,
  ]);
  const capabilityProfiles = resolvedCapabilityProfiles(
    requiredCapabilities,
    configuration.routingPolicy.capabilityProfiles,
  );
  const minimumReasoningRank = Math.max(
    REASONING_RANK[request.reasoningLevel],
    REASONING_RANK[taskPolicy.minimumReasoningLevel],
  );
  const minimumReliability = Math.max(
    taskPolicy.minimumReliability,
    ...capabilityProfiles.map((profile) => profile.minimumReliability),
  );
  const requestContextTokens =
    request.constraints.estimatedInputTokens +
    request.constraints.reservedOutputTokens +
    configuration.routingPolicy.contextSafetyMarginTokens;
  const minimumContextTokens = Math.max(
    requestContextTokens,
    ...capabilityProfiles.map((profile) => profile.minimumContextTokens ?? 0),
  );
  const latencyLimits = capabilityProfiles
    .map((profile) => profile.maximumP95LatencyMs)
    .filter((value): value is number => value !== undefined);
  const configuredLatencyLimit =
    latencyLimits.length === 0 ? undefined : Math.min(...latencyLimits);
  const maximumP95LatencyMs =
    request.constraints.deadlineMs === undefined
      ? configuredLatencyLimit
      : configuredLatencyLimit === undefined
        ? request.constraints.deadlineMs
        : Math.min(request.constraints.deadlineMs, configuredLatencyLimit);

  return {
    taskPolicy,
    requiredCapabilities,
    minimumReasoningRank,
    minimumReliability,
    minimumContextTokens,
    ...(maximumP95LatencyMs === undefined
      ? {}
      : { maximumP95LatencyMs }),
    functionCallingRequired:
      request.constraints.functionCallingRequired ||
      capabilityProfiles.some((profile) => profile.functionCallingRequired),
    visionRequired:
      requiredCapabilities.includes(AICapability.Vision) ||
      capabilityProfiles.some((profile) => profile.visionRequired),
    lowCostMode:
      configuration.budgetPolicy.lowCostMode ||
      taskPolicy.costMode === RoutingCostMode.LowCost,
  };
}

function calculateModelCost(
  request: AIRequest,
  model: ModelDefinition,
): CostEstimate {
  const estimatedInputCost = roundCost(
    (request.constraints.estimatedInputTokens / 1_000_000) *
      model.cost.inputPerMillionTokens,
  );
  const estimatedOutputCost = roundCost(
    (request.constraints.reservedOutputTokens / 1_000_000) *
      model.cost.outputPerMillionTokens,
  );
  const estimatedFixedCost = roundCost(model.cost.fixedRequestCost ?? 0);
  const estimatedTotalCost = roundCost(
    estimatedInputCost + estimatedOutputCost + estimatedFixedCost,
  );

  return {
    currency: model.cost.currency,
    estimatedInputCost,
    estimatedOutputCost,
    estimatedFixedCost,
    estimatedTotalCost,
    pricingVersion: model.cost.pricingVersion,
  };
}

export function estimateModelCost(
  request: AIRequest,
  model: ModelDefinition,
): CostEstimate {
  validateAIRequest(request);
  validateModelDefinition(model);
  return calculateModelCost(request, model);
}

function canUseCriticalOverride(
  request: AIRequest,
  configuration: AIRouterConfiguration,
  requiredCapabilities: ReadonlyArray<AICapability>,
  requiredAdditionalCost: number,
  now: string,
): boolean {
  const override = request.criticalOverride;
  const policyLimit = configuration.budgetPolicy.criticalOverrideLimit ?? 0;
  const criticalTask =
    request.reasoningLevel === ReasoningLevel.Critical ||
    requiredCapabilities.includes(AICapability.CriticalDecision);

  return (
    requiredAdditionalCost > 0 &&
    criticalTask &&
    configuration.featureFlags.criticalOverridesEnabled &&
    configuration.budgetPolicy.criticalOverrideAllowed &&
    override !== undefined &&
    Date.parse(override.expiresAt) >= Date.parse(now) &&
    requiredAdditionalCost <= override.maximumAdditionalCost &&
    requiredAdditionalCost <= policyLimit
  );
}

function evaluateBudget(
  request: AIRequest,
  configuration: AIRouterConfiguration,
  usage: BudgetUsageSnapshot,
  cost: CostEstimate,
  requiredCapabilities: ReadonlyArray<AICapability>,
  now: string,
): BudgetEvaluation {
  if (!configuration.featureFlags.costGovernanceEnabled) {
    return {
      rejectionReasons: [CandidateRejectionReason.CostGovernanceDisabled],
      overrideApplied: false,
    };
  }

  const reasons: CandidateRejectionReason[] = [];
  const requestLimit = Math.min(
    request.constraints.maximumEstimatedCost,
    configuration.budgetPolicy.perRequestLimit,
  );
  const dailyRemaining = Math.max(
    0,
    configuration.budgetPolicy.dailyBudget - usage.dailyCost,
  );
  const monthlyRemaining = Math.max(
    0,
    configuration.budgetPolicy.monthlyBudget - usage.monthlyCost,
  );

  if (cost.estimatedTotalCost > requestLimit) {
    reasons.push(CandidateRejectionReason.RequestBudgetExceeded);
  }
  if (cost.estimatedTotalCost > dailyRemaining) {
    reasons.push(CandidateRejectionReason.DailyBudgetExceeded);
  }
  if (cost.estimatedTotalCost > monthlyRemaining) {
    reasons.push(CandidateRejectionReason.MonthlyBudgetExceeded);
  }

  if (reasons.length === 0) {
    return { rejectionReasons: [], overrideApplied: false };
  }

  const requiredAdditionalCost = Math.max(
    cost.estimatedTotalCost - requestLimit,
    cost.estimatedTotalCost - dailyRemaining,
    cost.estimatedTotalCost - monthlyRemaining,
    0,
  );
  if (
    canUseCriticalOverride(
      request,
      configuration,
      requiredCapabilities,
      requiredAdditionalCost,
      now,
    )
  ) {
    return { rejectionReasons: [], overrideApplied: true };
  }

  return {
    rejectionReasons: [
      ...reasons,
      ...(request.criticalOverride === undefined
        ? []
        : [CandidateRejectionReason.CriticalOverrideNotAuthorized]),
    ],
    overrideApplied: false,
  };
}

function evaluateCandidate(
  provider: ProviderDefinition,
  model: ModelDefinition,
  request: AIRequest,
  configuration: AIRouterConfiguration,
  requirements: ResolvedRequirements,
  usage: BudgetUsageSnapshot,
  now: string,
): EvaluatedCandidate {
  const reasons: CandidateRejectionReason[] = [];
  const cost = calculateModelCost(request, model);
  const effectiveReliability = Math.min(
    provider.reliability,
    model.reliability,
  );
  const modelReasoningRank = maximumReasoningRank(
    model.supportedReasoningLevels,
  );
  const reasoningHeadroom =
    modelReasoningRank - requirements.minimumReasoningRank;
  const contextHeadroom =
    model.contextLimitTokens - requirements.minimumContextTokens;

  if (!provider.enabled) {
    reasons.push(CandidateRejectionReason.ProviderDisabled);
  }
  if (!isOperational(provider.availability)) {
    reasons.push(CandidateRejectionReason.ProviderUnavailable);
  }
  if (!model.enabled) {
    reasons.push(CandidateRejectionReason.ModelDisabled);
  }
  if (!isOperational(model.availability)) {
    reasons.push(CandidateRejectionReason.ModelUnavailable);
  }

  const missingCapabilities = requirements.requiredCapabilities.filter(
    (capability) => !model.capabilities.includes(capability),
  );
  if (missingCapabilities.length > 0) {
    reasons.push(CandidateRejectionReason.RequiredCapabilityUnavailable);
  }
  if (reasoningHeadroom < 0) {
    reasons.push(CandidateRejectionReason.ReasoningLevelUnsupported);
  }
  if (contextHeadroom < 0) {
    reasons.push(CandidateRejectionReason.ContextLimitExceeded);
  }
  if (
    model.maximumOutputTokens < request.constraints.reservedOutputTokens
  ) {
    reasons.push(CandidateRejectionReason.OutputLimitExceeded);
  }
  if (!model.supportedOutputTypes.includes(request.constraints.expectedOutputType)) {
    reasons.push(CandidateRejectionReason.OutputTypeUnsupported);
  }
  if (
    requirements.functionCallingRequired &&
    !model.functionCallingSupport
  ) {
    reasons.push(CandidateRejectionReason.FunctionCallingUnsupported);
  }
  if (requirements.visionRequired && !model.visionSupport) {
    reasons.push(CandidateRejectionReason.VisionUnsupported);
  }
  if (
    request.constraints.strictSchema &&
    !model.strictStructuredOutputSupport
  ) {
    reasons.push(CandidateRejectionReason.OutputTypeUnsupported);
  }

  if (
    !provider.supportedPrivacyLevels.includes(
      request.constraints.privacyLevel,
    ) ||
    !model.supportedPrivacyLevels.includes(request.constraints.privacyLevel)
  ) {
    reasons.push(CandidateRejectionReason.PrivacyLevelUnsupported);
  }
  if (
    (!request.constraints.externalProcessingAllowed ||
      request.constraints.privacyLevel === PrivacyLevel.LocalOnly) &&
    provider.processingBoundary !== ProviderProcessingBoundary.Local
  ) {
    reasons.push(CandidateRejectionReason.ExternalProcessingProhibited);
  }
  if (
    request.constraints.allowedProcessingRegions !== undefined &&
    !request.constraints.allowedProcessingRegions.some((region) =>
      provider.supportedProcessingRegions.includes(region),
    )
  ) {
    reasons.push(CandidateRejectionReason.ProcessingRegionUnsupported);
  }
  if (
    !request.constraints.retentionAllowed &&
    !provider.zeroRetentionSupported
  ) {
    reasons.push(CandidateRejectionReason.ZeroRetentionUnsupported);
  }
  if (effectiveReliability < requirements.minimumReliability) {
    reasons.push(CandidateRejectionReason.ReliabilityBelowMinimum);
  }
  if (
    requirements.maximumP95LatencyMs !== undefined &&
    model.estimatedP95LatencyMs > requirements.maximumP95LatencyMs
  ) {
    reasons.push(CandidateRejectionReason.LatencyRequirementUnsupported);
  }
  if (
    cost.currency !== request.constraints.currency ||
    cost.currency !== configuration.budgetPolicy.currency
  ) {
    reasons.push(CandidateRejectionReason.CurrencyMismatch);
  }

  const budgetEvaluation = evaluateBudget(
    request,
    configuration,
    usage,
    cost,
    requirements.requiredCapabilities,
    now,
  );
  reasons.push(...budgetEvaluation.rejectionReasons);

  return {
    provider,
    model,
    cost,
    effectiveReliability,
    reasoningHeadroom,
    contextHeadroom,
    overrideApplied: budgetEvaluation.overrideApplied,
    rejectionReasons: uniqueValues(reasons),
  };
}

function compareEligibleCandidates(
  left: EvaluatedCandidate,
  right: EvaluatedCandidate,
  request: AIRequest,
  requirements: ResolvedRequirements,
): number {
  const stableIds = [
    compareStringAscending(left.provider.providerId, right.provider.providerId),
    compareStringAscending(left.model.modelId, right.model.modelId),
  ];
  if (requirements.lowCostMode) {
    return firstNonZero([
      compareNumberAscending(
        left.cost.estimatedTotalCost,
        right.cost.estimatedTotalCost,
      ),
      compareNumberDescending(
        left.effectiveReliability,
        right.effectiveReliability,
      ),
      compareNumberAscending(
        left.model.estimatedP95LatencyMs,
        right.model.estimatedP95LatencyMs,
      ),
      compareNumberDescending(left.reasoningHeadroom, right.reasoningHeadroom),
      compareNumberDescending(left.contextHeadroom, right.contextHeadroom),
      ...stableIds,
    ]);
  }

  if (
    request.constraints.latencyPriority === LatencyPriority.High ||
    request.constraints.latencyPriority === LatencyPriority.Realtime
  ) {
    return firstNonZero([
      compareNumberAscending(
        left.model.estimatedP95LatencyMs,
        right.model.estimatedP95LatencyMs,
      ),
      compareNumberDescending(
        left.effectiveReliability,
        right.effectiveReliability,
      ),
      compareNumberAscending(
        left.cost.estimatedTotalCost,
        right.cost.estimatedTotalCost,
      ),
      compareNumberDescending(left.reasoningHeadroom, right.reasoningHeadroom),
      compareNumberDescending(left.contextHeadroom, right.contextHeadroom),
      ...stableIds,
    ]);
  }

  if (
    requirements.taskPolicy.costMode === RoutingCostMode.QualityFirst ||
    request.reasoningLevel === ReasoningLevel.Critical
  ) {
    return firstNonZero([
      compareNumberDescending(
        left.effectiveReliability,
        right.effectiveReliability,
      ),
      compareNumberDescending(left.reasoningHeadroom, right.reasoningHeadroom),
      compareNumberDescending(left.contextHeadroom, right.contextHeadroom),
      compareNumberAscending(
        left.model.estimatedP95LatencyMs,
        right.model.estimatedP95LatencyMs,
      ),
      compareNumberAscending(
        left.cost.estimatedTotalCost,
        right.cost.estimatedTotalCost,
      ),
      ...stableIds,
    ]);
  }

  return firstNonZero([
    compareNumberDescending(
      left.effectiveReliability,
      right.effectiveReliability,
    ),
    compareNumberDescending(left.reasoningHeadroom, right.reasoningHeadroom),
    compareNumberAscending(
      left.model.estimatedP95LatencyMs,
      right.model.estimatedP95LatencyMs,
    ),
    compareNumberAscending(
      left.cost.estimatedTotalCost,
      right.cost.estimatedTotalCost,
    ),
    compareNumberDescending(left.contextHeadroom, right.contextHeadroom),
    ...stableIds,
  ]);
}

function candidateReference(candidate: EvaluatedCandidate): RoutingCandidate {
  return {
    providerId: candidate.provider.providerId,
    modelId: candidate.model.modelId,
  };
}

function createSelectionReason(
  candidate: EvaluatedCandidate,
  requirements: ResolvedRequirements,
  isFallback: boolean,
  fallbackOrder?: number,
): RoutingReason {
  const policyName = requirements.lowCostMode
    ? RoutingCostMode.LowCost
    : requirements.taskPolicy.costMode;
  const reasonCodes = [
    "ALL_HARD_CONSTRAINTS_PASSED",
    requirements.lowCostMode
      ? "LOWEST_COST_ELIGIBLE_ORDER"
      : policyName === RoutingCostMode.QualityFirst
        ? "QUALITY_FIRST_ELIGIBLE_ORDER"
        : "BALANCED_ELIGIBLE_ORDER",
    ...(candidate.overrideApplied ? ["CRITICAL_OVERRIDE_APPLIED"] : []),
    ...(isFallback && fallbackOrder !== undefined
      ? [`FALLBACK_ORDER_${String(fallbackOrder)}`]
      : []),
  ];

  return {
    summary: isFallback
      ? `Candidate is fallback ${String(fallbackOrder)} in deterministic eligible order.`
      : "Candidate is first in deterministic eligible order.",
    reasonCodes,
    satisfiedConstraints: [
      "CAPABILITIES",
      "REASONING",
      "CONTEXT",
      "PRIVACY",
      "OUTPUT",
      "RELIABILITY",
      "LATENCY",
      "BUDGET",
    ],
    policyName,
  };
}

function createFallbackChain(
  eligible: ReadonlyArray<EvaluatedCandidate>,
  configuration: AIRouterConfiguration,
  requirements: ResolvedRequirements,
): ReadonlyArray<FallbackCandidate> {
  if (!configuration.featureFlags.fallbackEnabled) {
    return [];
  }
  const maximumFallbacks = Math.max(
    0,
    configuration.fallbackPolicy.maximumTotalAttempts - 1,
  );
  return eligible.slice(1, maximumFallbacks + 1).map((candidate, index) => {
    const order = index + 1;
    return {
      ...candidateReference(candidate),
      order,
      eligibleErrorCategories:
        configuration.fallbackPolicy.retryableErrorCategories,
      estimatedCost: candidate.cost,
      selectionReason: createSelectionReason(
        candidate,
        requirements,
        true,
        order,
      ),
    };
  });
}

function createRejectedCandidates(
  evaluated: ReadonlyArray<EvaluatedCandidate>,
): ReadonlyArray<RejectedRoutingCandidate> {
  return evaluated
    .filter((candidate) => candidate.rejectionReasons.length > 0)
    .sort((left, right) =>
      firstNonZero([
        compareStringAscending(
          left.provider.providerId,
          right.provider.providerId,
        ),
        compareStringAscending(left.model.modelId, right.model.modelId),
      ]),
    )
    .map((candidate) => ({
      ...candidateReference(candidate),
      reasons: candidate.rejectionReasons,
    }));
}

function zeroCostEstimate(currency: string): CostEstimate {
  return {
    currency,
    estimatedInputCost: 0,
    estimatedOutputCost: 0,
    estimatedFixedCost: 0,
    estimatedTotalCost: 0,
    pricingVersion: "NOT_SELECTED",
  };
}

function safeIdentifier(value: string, fallback: string): string {
  return value.trim().length === 0 ? fallback : value;
}

function deriveNoCandidateCategory(
  rejected: ReadonlyArray<RejectedRoutingCandidate>,
): AIErrorCategory {
  if (
    rejected.length > 0 &&
    rejected.every((candidate) =>
      candidate.reasons.includes(
        CandidateRejectionReason.CostGovernanceDisabled,
      ),
    )
  ) {
    return AIErrorCategory.ConfigurationInvalid;
  }

  if (
    rejected.length > 0 &&
    rejected.every((candidate) =>
      candidate.reasons.some((reason) =>
        [
          CandidateRejectionReason.ProviderDisabled,
          CandidateRejectionReason.ProviderUnavailable,
        ].includes(reason as CandidateRejectionReason),
      ),
    )
  ) {
    return AIErrorCategory.NoEligibleProvider;
  }

  const categoryRules: ReadonlyArray<{
    readonly category: AIErrorCategory;
    readonly reasons: ReadonlyArray<CandidateRejectionReason>;
  }> = [
    {
      category: AIErrorCategory.BudgetExceeded,
      reasons: [
        CandidateRejectionReason.RequestBudgetExceeded,
        CandidateRejectionReason.DailyBudgetExceeded,
        CandidateRejectionReason.MonthlyBudgetExceeded,
      ],
    },
    {
      category: AIErrorCategory.PrivacyPolicyRejected,
      reasons: [
        CandidateRejectionReason.PrivacyLevelUnsupported,
        CandidateRejectionReason.ExternalProcessingProhibited,
        CandidateRejectionReason.ProcessingRegionUnsupported,
        CandidateRejectionReason.ZeroRetentionUnsupported,
      ],
    },
    {
      category: AIErrorCategory.ContextLimitExceeded,
      reasons: [
        CandidateRejectionReason.ContextLimitExceeded,
        CandidateRejectionReason.OutputLimitExceeded,
      ],
    },
    {
      category: AIErrorCategory.CapabilityUnavailable,
      reasons: [
        CandidateRejectionReason.RequiredCapabilityUnavailable,
        CandidateRejectionReason.ReasoningLevelUnsupported,
        CandidateRejectionReason.OutputTypeUnsupported,
        CandidateRejectionReason.FunctionCallingUnsupported,
        CandidateRejectionReason.VisionUnsupported,
      ],
    },
  ];

  for (const rule of categoryRules) {
    if (
      rejected.length > 0 &&
      rejected.every((candidate) =>
        candidate.reasons.some((reason) =>
          rule.reasons.includes(reason as CandidateRejectionReason),
        ),
      )
    ) {
      return rule.category;
    }
  }

  return AIErrorCategory.NoEligibleModel;
}

function createFailure(
  request: AIRequest,
  configuration: AIRouterConfiguration,
  now: string,
  category: AIErrorCategory,
  safeMessage: string,
  rejectedCandidates: ReadonlyArray<RejectedRoutingCandidate>,
): AIRouterEngineFailure {
  const requestId = safeIdentifier(request.requestId, "INVALID_REQUEST");
  const policyVersion = safeIdentifier(
    configuration.routingPolicy.version,
    "INVALID_POLICY",
  );
  const providerRegistryVersion = safeIdentifier(
    configuration.providerRegistry.version,
    "INVALID_REGISTRY",
  );
  const modelRegistryVersion = safeIdentifier(
    configuration.modelRegistry.version,
    "INVALID_MODEL_REGISTRY",
  );
  const registryVersion = `${providerRegistryVersion}:${modelRegistryVersion}`;
  const decisionId = `${requestId}:route:${policyVersion}:${registryVersion}`;
  const reasonCodes = uniqueValues([
    category,
    ...rejectedCandidates.flatMap((candidate) => candidate.reasons),
  ]);
  const routingReason: RoutingReason = {
    summary: safeMessage,
    reasonCodes: reasonCodes.length === 0 ? [category] : reasonCodes,
    satisfiedConstraints: [],
    policyName: "REJECTED",
  };
  const estimatedCost = zeroCostEstimate(
    request.constraints.currency.trim().length === 0
      ? configuration.budgetPolicy.currency
      : request.constraints.currency,
  );
  const decision: RejectedRoutingDecision = {
    decisionId,
    requestId,
    createdAt: now,
    status: RoutingDecisionStatus.Rejected,
    rejectionReasons: reasonCodes,
    policyVersion,
    registryVersion,
    routingReason,
    routingConfidence: 100,
    eligibleCandidates: [],
    rejectedCandidates,
    estimatedCost,
    estimatedLatencyMs: 0,
    fallbackChain: [],
  };
  const error: NormalizedAIError = {
    category,
    code: category,
    safeMessage,
    retryable: false,
    attemptNumber: 0,
    occurredAt: now,
  };
  const auditRecord: RoutingAuditRecord = {
    auditId: `${decisionId}:audit`,
    requestId,
    decisionId,
    timestamp: now,
    taskType: request.taskType,
    requiredCapabilities: request.requiredCapabilities,
    reasoningLevel: request.reasoningLevel,
    privacyLevel: request.constraints.privacyLevel,
    contextFingerprint: safeIdentifier(
      request.contextFingerprint,
      "INVALID_CONTEXT",
    ),
    eligibleCandidates: [],
    rejectedCandidates,
    routingReason,
    policyVersion,
    registryVersion,
    budgetPolicyVersion: safeIdentifier(
      configuration.budgetPolicy.version,
      "INVALID_BUDGET_POLICY",
    ),
    estimatedCost,
    finalStatus: RoutingAuditStatus.Rejected,
    fallbackPlan: [],
    attempts: [],
    retryCount: 0,
    fallbackCount: 0,
    failure: error,
  };

  return { success: false, decision, error, auditRecord };
}

export function routeAIRequest(
  input: AIRouterEngineInput,
  clock: AIRouterEngineClock = SYSTEM_CLOCK,
): AIRouterEngineResult {
  const now = clock.now();

  try {
    validateAIRequest(input.request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return createFailure(
      input.request,
      input.configuration,
      now,
      AIErrorCategory.InvalidRequest,
      `Router request validation failed: ${message}`,
      [],
    );
  }

  try {
    validateAIRouterConfiguration(input.configuration);
    if (input.budgetUsage !== undefined) {
      validateBudgetUsage(
        input.budgetUsage,
        input.configuration.budgetPolicy.currency,
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return createFailure(
      input.request,
      input.configuration,
      now,
      AIErrorCategory.ConfigurationInvalid,
      `Router configuration validation failed: ${message}`,
      [],
    );
  }

  let requirements: ResolvedRequirements;
  try {
    requirements = resolveRequirements(input.request, input.configuration);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const category = message.startsWith("Invalid request")
      ? AIErrorCategory.InvalidRequest
      : AIErrorCategory.ConfigurationInvalid;
    return createFailure(
      input.request,
      input.configuration,
      now,
      category,
      message,
      [],
    );
  }

  const usage: BudgetUsageSnapshot = input.budgetUsage ?? {
    currency: input.configuration.budgetPolicy.currency,
    dailyCost: 0,
    monthlyCost: 0,
    capturedAt: now,
  };
  const providersById = new Map(
    input.configuration.providerRegistry.providers.map((provider) => [
      provider.providerId,
      provider,
    ]),
  );
  const evaluated = input.configuration.modelRegistry.models.map((model) => {
    const provider = providersById.get(model.providerId);
    if (provider === undefined) {
      throw new Error(
        `Validated model ${model.modelId} has no provider ${model.providerId}.`,
      );
    }
    return evaluateCandidate(
      provider,
      model,
      input.request,
      input.configuration,
      requirements,
      usage,
      now,
    );
  });
  const rejectedCandidates = createRejectedCandidates(evaluated);
  const eligible = evaluated
    .filter((candidate) => candidate.rejectionReasons.length === 0)
    .sort((left, right) =>
      compareEligibleCandidates(left, right, input.request, requirements),
    );

  if (eligible.length === 0) {
    const category = deriveNoCandidateCategory(rejectedCandidates);
    return createFailure(
      input.request,
      input.configuration,
      now,
      category,
      "No provider/model candidate satisfies all routing constraints.",
      rejectedCandidates,
    );
  }

  const selected = eligible[0];
  if (selected === undefined) {
    return createFailure(
      input.request,
      input.configuration,
      now,
      AIErrorCategory.NoEligibleModel,
      "No eligible model was selected.",
      rejectedCandidates,
    );
  }

  const fallbackChain = createFallbackChain(
    eligible,
    input.configuration,
    requirements,
  );
  const eligibleCandidates = eligible.map(candidateReference);
  const routingReason = createSelectionReason(
    selected,
    requirements,
    false,
  );
  const policyVersion = input.configuration.routingPolicy.version;
  const registryVersion = `${input.configuration.providerRegistry.version}:${input.configuration.modelRegistry.version}`;
  const decisionId = `${input.request.requestId}:route:${policyVersion}:${registryVersion}`;
  const decision: AISelectedRoutingDecision = {
    decisionId,
    requestId: input.request.requestId,
    createdAt: now,
    status: RoutingDecisionStatus.AiSelected,
    selectedProviderId: selected.provider.providerId,
    selectedModelId: selected.model.modelId,
    policyVersion,
    registryVersion,
    routingReason,
    routingConfidence: 100,
    eligibleCandidates,
    rejectedCandidates,
    estimatedCost: selected.cost,
    estimatedLatencyMs: selected.model.estimatedP95LatencyMs,
    fallbackChain,
  };
  const auditRecord: RoutingAuditRecord = {
    auditId: `${decisionId}:audit`,
    requestId: input.request.requestId,
    decisionId,
    timestamp: now,
    taskType: input.request.taskType,
    requiredCapabilities: requirements.requiredCapabilities,
    reasoningLevel: input.request.reasoningLevel,
    privacyLevel: input.request.constraints.privacyLevel,
    contextFingerprint: input.request.contextFingerprint,
    eligibleCandidates,
    rejectedCandidates,
    selectedProviderId: selected.provider.providerId,
    selectedModelId: selected.model.modelId,
    routingReason,
    policyVersion,
    registryVersion,
    budgetPolicyVersion: input.configuration.budgetPolicy.version,
    estimatedCost: selected.cost,
    finalStatus: RoutingAuditStatus.Selected,
    fallbackPlan: fallbackChain,
    ...(selected.overrideApplied && input.request.criticalOverride !== undefined
      ? { criticalOverride: input.request.criticalOverride }
      : {}),
    attempts: [],
    retryCount: 0,
    fallbackCount: 0,
  };

  return { success: true, decision, auditRecord };
}
