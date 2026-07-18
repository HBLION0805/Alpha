export enum AITaskType {
  Research = "RESEARCH",
  MarketAnalysis = "MARKET_ANALYSIS",
  Prediction = "PREDICTION",
  Strategy = "STRATEGY",
  Journal = "JOURNAL",
  Summary = "SUMMARY",
  Coding = "CODING",
  Documentation = "DOCUMENTATION",
  Translation = "TRANSLATION",
  GeneralChat = "GENERAL_CHAT",
}

export enum AICapability {
  Fast = "FAST",
  LowCost = "LOW_COST",
  HighReasoning = "HIGH_REASONING",
  LongContext = "LONG_CONTEXT",
  Coding = "CODING",
  Vision = "VISION",
  Research = "RESEARCH",
  CriticalDecision = "CRITICAL_DECISION",
}

export enum ReasoningLevel {
  None = "NONE",
  Low = "LOW",
  Medium = "MEDIUM",
  High = "HIGH",
  Critical = "CRITICAL",
}

export enum LatencyPriority {
  Batch = "BATCH",
  Low = "LOW",
  Normal = "NORMAL",
  High = "HIGH",
  Realtime = "REALTIME",
}

export enum PrivacyLevel {
  Public = "PUBLIC",
  Internal = "INTERNAL",
  Sensitive = "SENSITIVE",
  LocalOnly = "LOCAL_ONLY",
}

export enum AIOutputType {
  Text = "TEXT",
  StructuredJson = "STRUCTURED_JSON",
  Report = "REPORT",
  Code = "CODE",
  Patch = "PATCH",
  Translation = "TRANSLATION",
  Image = "IMAGE",
  Multimodal = "MULTIMODAL",
}

export enum ModelAvailability {
  Available = "AVAILABLE",
  Degraded = "DEGRADED",
  RateLimited = "RATE_LIMITED",
  Unavailable = "UNAVAILABLE",
  Unknown = "UNKNOWN",
}

export enum ProviderProcessingBoundary {
  Local = "LOCAL",
  External = "EXTERNAL",
}

export enum RoutingDecisionStatus {
  AiSelected = "AI_SELECTED",
  DeterministicSelected = "DETERMINISTIC_SELECTED",
  Rejected = "REJECTED",
}

export enum AIResponseStatus {
  Completed = "COMPLETED",
  Failed = "FAILED",
}

export enum RoutingAuditStatus {
  Selected = "SELECTED",
  Completed = "COMPLETED",
  Rejected = "REJECTED",
  Failed = "FAILED",
}

export enum RoutingAttemptStatus {
  Succeeded = "SUCCEEDED",
  Failed = "FAILED",
  TimedOut = "TIMED_OUT",
  Cancelled = "CANCELLED",
}

export enum AIErrorCategory {
  InvalidRequest = "INVALID_REQUEST",
  NoEligibleProvider = "NO_ELIGIBLE_PROVIDER",
  NoEligibleModel = "NO_ELIGIBLE_MODEL",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  RateLimited = "RATE_LIMITED",
  ModelUnavailable = "MODEL_UNAVAILABLE",
  ContextLimitExceeded = "CONTEXT_LIMIT_EXCEEDED",
  Timeout = "TIMEOUT",
  AuthenticationFailed = "AUTHENTICATION_FAILED",
  ConfigurationInvalid = "CONFIGURATION_INVALID",
  BudgetExceeded = "BUDGET_EXCEEDED",
  PrivacyPolicyRejected = "PRIVACY_POLICY_REJECTED",
  CapabilityUnavailable = "CAPABILITY_UNAVAILABLE",
  OutputInvalid = "OUTPUT_INVALID",
  ToolExecutionFailed = "TOOL_EXECUTION_FAILED",
  ContentPolicyRejected = "CONTENT_POLICY_REJECTED",
  RequestCancelled = "REQUEST_CANCELLED",
  UnknownProviderError = "UNKNOWN_PROVIDER_ERROR",
}

export interface RoutingConstraints {
  readonly estimatedInputTokens: number;
  readonly reservedOutputTokens: number;
  readonly maximumEstimatedCost: number;
  readonly currency: string;
  readonly latencyPriority: LatencyPriority;
  readonly deadlineMs?: number;
  readonly privacyLevel: PrivacyLevel;
  readonly externalProcessingAllowed: boolean;
  readonly allowedProcessingRegions?: ReadonlyArray<string>;
  readonly retentionAllowed: boolean;
  readonly deterministicAllowed: boolean;
  readonly contextReductionAllowed: boolean;
  readonly expectedOutputType: AIOutputType;
  readonly outputSchemaId?: string;
  readonly strictSchema: boolean;
  readonly functionCallingRequired: boolean;
}

export interface CriticalOverrideMetadata {
  readonly authorizationId: string;
  readonly approvedBy: string;
  readonly maximumAdditionalCost: number;
  readonly expiresAt: string;
  readonly reason: string;
}

export interface AIRequest {
  readonly contractVersion: "1.0";
  readonly requestId: string;
  readonly correlationId?: string;
  readonly parentRequestId?: string;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly taskType: AITaskType;
  readonly requiredCapabilities: ReadonlyArray<AICapability>;
  readonly reasoningLevel: ReasoningLevel;
  readonly constraints: RoutingConstraints;
  readonly criticalOverride?: CriticalOverrideMetadata;
  readonly contextFingerprint: string;
}

export interface ModelCostDefinition {
  readonly currency: string;
  readonly inputPerMillionTokens: number;
  readonly outputPerMillionTokens: number;
  readonly cachedInputPerMillionTokens?: number;
  readonly fixedRequestCost?: number;
  readonly pricingVersion: string;
  readonly effectiveAt: string;
}

export interface ProviderDefinition {
  readonly providerId: string;
  readonly name: string;
  readonly adapterId: string;
  readonly enabled: boolean;
  readonly processingBoundary: ProviderProcessingBoundary;
  readonly supportedPrivacyLevels: ReadonlyArray<PrivacyLevel>;
  readonly supportedProcessingRegions: ReadonlyArray<string>;
  readonly zeroRetentionSupported: boolean;
  readonly reliability: number;
  readonly availability: ModelAvailability;
  readonly modelIds: ReadonlyArray<string>;
}

export interface ModelDefinition {
  readonly modelId: string;
  readonly providerId: string;
  readonly providerModelReference: string;
  readonly enabled: boolean;
  readonly capabilities: ReadonlyArray<AICapability>;
  readonly supportedReasoningLevels: ReadonlyArray<ReasoningLevel>;
  readonly supportedPrivacyLevels: ReadonlyArray<PrivacyLevel>;
  readonly supportedOutputTypes: ReadonlyArray<AIOutputType>;
  readonly contextLimitTokens: number;
  readonly maximumOutputTokens: number;
  readonly visionSupport: boolean;
  readonly functionCallingSupport: boolean;
  readonly strictStructuredOutputSupport: boolean;
  readonly reliability: number;
  readonly availability: ModelAvailability;
  readonly estimatedP95LatencyMs: number;
  readonly cost: ModelCostDefinition;
}

export interface CostEstimate {
  readonly currency: string;
  readonly estimatedInputCost: number;
  readonly estimatedOutputCost: number;
  readonly estimatedFixedCost: number;
  readonly estimatedTotalCost: number;
  readonly pricingVersion: string;
}

export interface RoutingCandidate {
  readonly providerId: string;
  readonly modelId: string;
}

export interface RejectedRoutingCandidate extends RoutingCandidate {
  readonly reasons: ReadonlyArray<string>;
}

export interface RoutingReason {
  readonly summary: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly satisfiedConstraints: ReadonlyArray<string>;
  readonly policyName: string;
}

export interface FallbackCandidate extends RoutingCandidate {
  readonly order: number;
  readonly eligibleErrorCategories: ReadonlyArray<AIErrorCategory>;
  readonly estimatedCost: CostEstimate;
  readonly selectionReason: RoutingReason;
}

interface RoutingDecisionBase {
  readonly decisionId: string;
  readonly requestId: string;
  readonly createdAt: string;
  readonly policyVersion: string;
  readonly registryVersion: string;
  readonly routingReason: RoutingReason;
  readonly routingConfidence: number;
  readonly eligibleCandidates: ReadonlyArray<RoutingCandidate>;
  readonly rejectedCandidates: ReadonlyArray<RejectedRoutingCandidate>;
  readonly estimatedCost: CostEstimate;
  readonly estimatedLatencyMs: number;
  readonly fallbackChain: ReadonlyArray<FallbackCandidate>;
}

export interface AISelectedRoutingDecision extends RoutingDecisionBase {
  readonly status: RoutingDecisionStatus.AiSelected;
  readonly selectedProviderId: string;
  readonly selectedModelId: string;
}

export interface DeterministicRoutingDecision extends RoutingDecisionBase {
  readonly status: RoutingDecisionStatus.DeterministicSelected;
  readonly deterministicHandlerId: string;
}

export interface RejectedRoutingDecision extends RoutingDecisionBase {
  readonly status: RoutingDecisionStatus.Rejected;
  readonly rejectionReasons: ReadonlyArray<string>;
}

export type RoutingDecision =
  | AISelectedRoutingDecision
  | DeterministicRoutingDecision
  | RejectedRoutingDecision;

export interface AIOutput {
  readonly type: AIOutputType;
  readonly content: unknown;
  readonly schemaId?: string;
}

export interface AIUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly actualCost: number;
  readonly currency: string;
  readonly latencyMs: number;
}

export interface NormalizedAIError {
  readonly category: AIErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly attemptNumber: number;
  readonly occurredAt: string;
}

export interface SuccessfulAIResponse {
  readonly requestId: string;
  readonly status: AIResponseStatus.Completed;
  readonly routingDecision: RoutingDecision;
  readonly output: AIOutput;
  readonly usage: AIUsage;
  readonly retryCount: number;
  readonly usedFallback: boolean;
}

export interface FailedAIResponse {
  readonly requestId: string;
  readonly status: AIResponseStatus.Failed;
  readonly routingDecision: RoutingDecision;
  readonly error: NormalizedAIError;
  readonly retryCount: number;
  readonly usedFallback: boolean;
}

export type AIResponse = SuccessfulAIResponse | FailedAIResponse;

export interface RoutingAttemptMetadata extends RoutingCandidate {
  readonly attemptNumber: number;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: RoutingAttemptStatus;
  readonly latencyMs?: number;
  readonly cost?: CostEstimate;
  readonly errorCategory?: AIErrorCategory;
  readonly retryOfAttempt?: number;
  readonly fallbackOrder?: number;
}

export interface RoutingAuditRecord {
  readonly auditId: string;
  readonly requestId: string;
  readonly decisionId: string;
  readonly timestamp: string;
  readonly taskType: AITaskType;
  readonly requiredCapabilities: ReadonlyArray<AICapability>;
  readonly reasoningLevel: ReasoningLevel;
  readonly privacyLevel: PrivacyLevel;
  readonly contextFingerprint: string;
  readonly eligibleCandidates: ReadonlyArray<RoutingCandidate>;
  readonly rejectedCandidates: ReadonlyArray<RejectedRoutingCandidate>;
  readonly selectedProviderId?: string;
  readonly selectedModelId?: string;
  readonly deterministicHandlerId?: string;
  readonly routingReason: RoutingReason;
  readonly policyVersion: string;
  readonly registryVersion: string;
  readonly budgetPolicyVersion: string;
  readonly estimatedCost: CostEstimate;
  readonly finalStatus: RoutingAuditStatus;
  readonly fallbackPlan: ReadonlyArray<FallbackCandidate>;
  readonly criticalOverride?: CriticalOverrideMetadata;
  readonly attempts: ReadonlyArray<RoutingAttemptMetadata>;
  readonly retryCount: number;
  readonly fallbackCount: number;
  readonly failure?: NormalizedAIError;
}
