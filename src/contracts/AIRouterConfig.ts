import type {
  AICapability,
  AIErrorCategory,
  AIOutputType,
  AITaskType,
  ModelDefinition,
  ProviderDefinition,
  ReasoningLevel,
} from "./AIRouter";

export enum RoutingCostMode {
  LowCost = "LOW_COST",
  Balanced = "BALANCED",
  QualityFirst = "QUALITY_FIRST",
}

export enum RoutingTieBreakField {
  EstimatedCost = "ESTIMATED_COST",
  Reliability = "RELIABILITY",
  Latency = "LATENCY",
  ProviderId = "PROVIDER_ID",
  ModelId = "MODEL_ID",
}

export interface ProviderRegistryConfiguration {
  readonly version: string;
  readonly providers: ReadonlyArray<ProviderDefinition>;
}

export interface ModelRegistryConfiguration {
  readonly version: string;
  readonly models: ReadonlyArray<ModelDefinition>;
}

export interface CapabilityProfileConfiguration {
  readonly capability: AICapability;
  readonly minimumReliability: number;
  readonly maximumP95LatencyMs?: number;
  readonly minimumContextTokens?: number;
  readonly functionCallingRequired: boolean;
  readonly visionRequired: boolean;
}

export interface TaskRoutingPolicy {
  readonly taskType: AITaskType;
  readonly requiredCapabilities: ReadonlyArray<AICapability>;
  readonly minimumReasoningLevel: ReasoningLevel;
  readonly allowedOutputTypes: ReadonlyArray<AIOutputType>;
  readonly minimumReliability: number;
  readonly costMode: RoutingCostMode;
  readonly deterministicOnly: boolean;
}

export interface RoutingPolicyConfiguration {
  readonly version: string;
  readonly capabilityProfiles: ReadonlyArray<CapabilityProfileConfiguration>;
  readonly taskPolicies: ReadonlyArray<TaskRoutingPolicy>;
  readonly contextSafetyMarginTokens: number;
  readonly staleHealthAfterMs: number;
  readonly stableTieBreakOrder: ReadonlyArray<RoutingTieBreakField>;
}

export interface BudgetPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly currency: string;
  readonly perRequestLimit: number;
  readonly dailyBudget: number;
  readonly monthlyBudget: number;
  readonly lowCostMode: boolean;
  readonly warningThresholdPercentage: number;
  readonly criticalOverrideAllowed: boolean;
  readonly criticalOverrideLimit?: number;
  readonly accountingTimezone: string;
}

export interface FallbackPolicyConfiguration {
  readonly version: string;
  readonly maximumTotalAttempts: number;
  readonly maximumRetriesPerCandidate: number;
  readonly outputRepairRetries: number;
  readonly retryableErrorCategories: ReadonlyArray<AIErrorCategory>;
  readonly baseBackoffMs: number;
  readonly maximumBackoffMs: number;
}

export interface AIRouterFeatureFlags {
  readonly deterministicGateEnabled: boolean;
  readonly providerExecutionEnabled: boolean;
  readonly fallbackEnabled: boolean;
  readonly costGovernanceEnabled: boolean;
  readonly auditLoggingEnabled: boolean;
  readonly criticalOverridesEnabled: boolean;
}

export interface AIRouterConfiguration {
  readonly contractVersion: "1.0";
  readonly configurationVersion: string;
  readonly providerRegistry: ProviderRegistryConfiguration;
  readonly modelRegistry: ModelRegistryConfiguration;
  readonly routingPolicy: RoutingPolicyConfiguration;
  readonly budgetPolicy: BudgetPolicy;
  readonly fallbackPolicy: FallbackPolicyConfiguration;
  readonly featureFlags: AIRouterFeatureFlags;
}
