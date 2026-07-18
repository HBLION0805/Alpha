import type {
  AICapability,
  AIOutputType,
  AITaskType,
  PrivacyLevel,
  ReasoningLevel,
} from "./AIRouter";
import type { MinorUnitAmount } from "./AICostGovernor";

export enum AIExecutionStatus {
  Completed = "COMPLETED",
  Failed = "FAILED",
  TimedOut = "TIMED_OUT",
  Cancelled = "CANCELLED",
}

export enum AIProviderHealthStatus {
  Available = "AVAILABLE",
  Degraded = "DEGRADED",
  RateLimited = "RATE_LIMITED",
  Unavailable = "UNAVAILABLE",
  Unknown = "UNKNOWN",
}

export enum AIProviderAdapterErrorCategory {
  InvalidRequest = "INVALID_REQUEST",
  AdapterNotFound = "ADAPTER_NOT_FOUND",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  ModelUnavailable = "MODEL_UNAVAILABLE",
  UnsupportedCapability = "UNSUPPORTED_CAPABILITY",
  PrivacyRejected = "PRIVACY_REJECTED",
  Timeout = "TIMEOUT",
  Cancelled = "CANCELLED",
  RateLimited = "RATE_LIMITED",
  AuthenticationFailed = "AUTHENTICATION_FAILED",
  ProviderError = "PROVIDER_ERROR",
  MalformedResponse = "MALFORMED_RESPONSE",
  UsageMetadataUnavailable = "USAGE_METADATA_UNAVAILABLE",
  Unknown = "UNKNOWN",
}

export enum AIProviderCompatibilityReason {
  ProviderMismatch = "PROVIDER_MISMATCH",
  ModelUnsupported = "MODEL_UNSUPPORTED",
  CapabilityUnsupported = "CAPABILITY_UNSUPPORTED",
  ReasoningUnsupported = "REASONING_UNSUPPORTED",
  PrivacyUnsupported = "PRIVACY_UNSUPPORTED",
  OutputUnsupported = "OUTPUT_UNSUPPORTED",
  ContextLimitExceeded = "CONTEXT_LIMIT_EXCEEDED",
  OutputLimitExceeded = "OUTPUT_LIMIT_EXCEEDED",
  TimeoutUnsupported = "TIMEOUT_UNSUPPORTED",
  CancellationUnsupported = "CANCELLATION_UNSUPPORTED",
  AdapterDisabled = "ADAPTER_DISABLED",
}

export enum AIExecutionFinishReason {
  Completed = "COMPLETED",
  Stop = "STOP",
  Length = "LENGTH",
  ToolCall = "TOOL_CALL",
  ContentFiltered = "CONTENT_FILTERED",
  Cancelled = "CANCELLED",
  Timeout = "TIMEOUT",
  Error = "ERROR",
  Unknown = "UNKNOWN",
}

export enum AIExecutionInputType {
  Text = "TEXT",
  Structured = "STRUCTURED",
  Multimodal = "MULTIMODAL",
}

export interface AIExecutionInput {
  readonly type: AIExecutionInputType;
  readonly content: unknown;
  readonly schemaId?: string;
}

export interface AIProviderCapabilities {
  readonly supportedCapabilities: ReadonlyArray<AICapability>;
  readonly supportedOutputTypes: ReadonlyArray<AIOutputType>;
  readonly supportedReasoningLevels: ReadonlyArray<ReasoningLevel>;
  readonly supportedPrivacyLevels: ReadonlyArray<PrivacyLevel>;
  readonly maximumContextTokens: number;
  readonly maximumOutputTokens: number;
  readonly timeoutSupported: boolean;
  readonly cancellationSupported: boolean;
  readonly structuredOutputSupported: boolean;
}

export interface AIProviderAdapterDescriptor {
  readonly adapterId: string;
  readonly providerId: string;
  readonly displayName: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly supportedModelIds: ReadonlyArray<string>;
  readonly capabilities: AIProviderCapabilities;
  readonly publicConfiguration?: Readonly<Record<string, unknown>>;
}

export interface AIProviderHealth {
  readonly providerId: string;
  readonly status: AIProviderHealthStatus;
  readonly observedAt: string;
  readonly estimatedLatencyMs?: number;
  readonly reliability?: number;
  readonly rateLimited: boolean;
  readonly retryAfterMs?: number;
  readonly source: string;
  readonly expiresAt?: string;
}

export interface AIProviderTimeoutPolicy {
  readonly timeoutMs: number;
  readonly deadlineAt?: string;
}

export interface AIProviderCancellation {
  readonly cancellationId: string;
  readonly requested: boolean;
  readonly requestedAt?: string;
  readonly reason?: string;
}

export interface AIExecutionRequest {
  readonly contractVersion: "1.0";
  readonly requestId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly taskType: AITaskType;
  readonly input: AIExecutionInput;
  readonly expectedOutputType: AIOutputType;
  readonly requiredCapabilities: ReadonlyArray<AICapability>;
  readonly reasoningLevel: ReasoningLevel;
  readonly privacyLevel: PrivacyLevel;
  readonly contextTokenLimit: number;
  readonly maximumOutputTokens: number;
  readonly timeoutPolicy: AIProviderTimeoutPolicy;
  readonly cancellationId: string;
  readonly routingDecisionId: string;
  readonly costGovernorDecisionId: string;
  readonly reservationId: string;
  readonly requestedAt: string;
  readonly traceId: string;
  readonly correlationId?: string;
}

export interface AIProviderExecutionContext {
  readonly attemptNumber: number;
  readonly invokedAt: string;
  readonly timeoutPolicy: AIProviderTimeoutPolicy;
  readonly cancellation: AIProviderCancellation;
}

export interface AIAdapterCompatibility {
  readonly compatible: boolean;
  readonly reasons: ReadonlyArray<AIProviderCompatibilityReason>;
}

export interface AIUsageRecord {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly reportedCost?: MinorUnitAmount;
}

export interface AIExecutionMetadata {
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly attemptNumber: number;
  readonly providerRequestId?: string;
}

export interface AIExecutionAuditMetadata {
  readonly traceId: string;
  readonly correlationId?: string;
  readonly routingDecisionId: string;
  readonly costGovernorDecisionId: string;
  readonly reservationId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
}

export interface AIProviderAdapterError {
  readonly category: AIProviderAdapterErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly retryAfterMs?: number;
}

interface AIExecutionResponseBase {
  readonly requestId: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly status: AIExecutionStatus;
  readonly metadata: AIExecutionMetadata;
  readonly audit: AIExecutionAuditMetadata;
  readonly retryable: boolean;
  readonly warnings: ReadonlyArray<string>;
}

export interface SuccessfulAIExecutionResponse
  extends AIExecutionResponseBase {
  readonly status: AIExecutionStatus.Completed;
  readonly output: {
    readonly type: AIOutputType;
    readonly content: unknown;
    readonly schemaId?: string;
  };
  readonly usage: AIUsageRecord;
  readonly finishReason: AIExecutionFinishReason;
}

export interface FailedAIExecutionResponse extends AIExecutionResponseBase {
  readonly status:
    | AIExecutionStatus.Failed
    | AIExecutionStatus.TimedOut
    | AIExecutionStatus.Cancelled;
  readonly error: AIProviderAdapterError;
  readonly usage?: AIUsageRecord;
  readonly finishReason: AIExecutionFinishReason;
}

export type AIExecutionResponse =
  | SuccessfulAIExecutionResponse
  | FailedAIExecutionResponse;

export interface AIProviderAdapter {
  getDescriptor(): Readonly<AIProviderAdapterDescriptor>;
  getHealth(): Readonly<AIProviderHealth>;
  supports(request: Readonly<AIExecutionRequest>): AIAdapterCompatibility;
  execute(
    request: Readonly<AIExecutionRequest>,
    context: Readonly<AIProviderExecutionContext>,
  ): Promise<AIExecutionResponse>;
  normalizeError(
    error: unknown,
    request: Readonly<AIExecutionRequest>,
    context: Readonly<AIProviderExecutionContext>,
  ): AIProviderAdapterError;
}

export interface AIProviderAdapterRegistry {
  register(adapter: AIProviderAdapter): void;
  getByProviderId(providerId: string): AIProviderAdapter | undefined;
  listDescriptors(): ReadonlyArray<Readonly<AIProviderAdapterDescriptor>>;
  findCompatibleAdapters(
    request: Readonly<AIExecutionRequest>,
  ): ReadonlyArray<AIProviderAdapter>;
}
