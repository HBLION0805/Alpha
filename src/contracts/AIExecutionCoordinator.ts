import type {
  AIRequest,
  RoutingAuditRecord,
  RoutingDecision,
} from "./AIRouter";
import type {
  BudgetReservation,
  CostAuditRecord,
  CostDecisionStatus,
  CostGovernorDecision,
  MinorUnitAmount,
} from "./AICostGovernor";
import type {
  AIExecutionInput,
  AIExecutionRequest,
  AIExecutionResponse,
  AIProviderAdapterDescriptor,
  AIProviderAdapterErrorCategory,
  AIProviderAdapterRegistry,
  AIProviderCancellation,
  AIProviderHealth,
  AIProviderHealthStatus,
  AIProviderTimeoutPolicy,
  AIUsageRecord,
} from "./AIProviderAdapter";

export enum AIExecutionCoordinatorStatus {
  ExecutionSucceeded = "EXECUTION_SUCCEEDED",
  ExecutionRejectedPrecondition = "EXECUTION_REJECTED_PRECONDITION",
  ExecutionFailedAdapter = "EXECUTION_FAILED_ADAPTER",
  ExecutionCancelled = "EXECUTION_CANCELLED",
  ExecutionTimedOut = "EXECUTION_TIMED_OUT",
  ExecutionDeferred = "EXECUTION_DEFERRED",
  ExecutionRequiresReroute = "EXECUTION_REQUIRES_REROUTE",
  ExecutionInvalidResponse = "EXECUTION_INVALID_RESPONSE",
}

export enum AIExecutionCoordinatorErrorCategory {
  InvalidCoordinatorRequest = "INVALID_COORDINATOR_REQUEST",
  RoutingNotApproved = "ROUTING_NOT_APPROVED",
  CostNotApproved = "COST_NOT_APPROVED",
  LowCostConstraintViolated = "LOW_COST_CONSTRAINT_VIOLATED",
  ReservationMissing = "RESERVATION_MISSING",
  ReservationMismatch = "RESERVATION_MISMATCH",
  AdapterNotFound = "ADAPTER_NOT_FOUND",
  AdapterIncompatible = "ADAPTER_INCOMPATIBLE",
  ProviderUnavailable = "PROVIDER_UNAVAILABLE",
  Cancelled = "CANCELLED",
  Timeout = "TIMEOUT",
  ProviderExecutionFailed = "PROVIDER_EXECUTION_FAILED",
  MalformedProviderResponse = "MALFORMED_PROVIDER_RESPONSE",
  UsageMetadataInvalid = "USAGE_METADATA_INVALID",
  ProviderModelMismatch = "PROVIDER_MODEL_MISMATCH",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  InternalReferenceMismatch = "INTERNAL_REFERENCE_MISMATCH",
  Unknown = "UNKNOWN",
}

export enum AIExecutionAttemptStatus {
  Succeeded = "SUCCEEDED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
  TimedOut = "TIMED_OUT",
  InvalidResponse = "INVALID_RESPONSE",
}

export enum AIRetryAction {
  NoRetry = "NO_RETRY",
  RetrySameAdapter = "RETRY_SAME_ADAPTER",
  ReturnToRouterForFallback = "RETURN_TO_ROUTER_FOR_FALLBACK",
  RejectFinal = "REJECT_FINAL",
  Defer = "DEFER",
}

export enum AIReservationInstructionType {
  ReleaseUnusedReservation = "RELEASE_UNUSED_RESERVATION",
  ReleaseReservation = "RELEASE_RESERVATION",
  RetainForRetry = "RETAIN_FOR_RETRY",
  ExpireReservation = "EXPIRE_RESERVATION",
  NoAction = "NO_ACTION",
}

export enum AIUsageSettlementInstructionType {
  CommitUsage = "COMMIT_USAGE",
  NoAction = "NO_ACTION",
}

export enum AIExecutionPreconditionStatus {
  Passed = "PASSED",
  Failed = "FAILED",
}

export interface AIExecutionPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly reservationRequired: boolean;
  readonly maximumAttempts: number;
  readonly acceptedHealthStatuses: ReadonlyArray<AIProviderHealthStatus>;
  readonly lowCostEligibleModelIds: ReadonlyArray<string>;
  readonly retrySameAdapterOn: ReadonlyArray<AIProviderAdapterErrorCategory>;
  readonly returnToRouterOn: ReadonlyArray<AIProviderAdapterErrorCategory>;
  readonly retainReservationForRetry: boolean;
  readonly releaseUnusedReservation: boolean;
}

export interface AIExecutionCoordinatorRequest {
  readonly originalRequest: AIRequest;
  readonly routingDecision: RoutingDecision;
  readonly routingAuditRecord: RoutingAuditRecord;
  readonly costDecision: CostGovernorDecision;
  readonly costAuditRecord: CostAuditRecord;
  readonly plannedReservation?: BudgetReservation;
  readonly executionInput: AIExecutionInput;
  readonly timeoutPolicy: AIProviderTimeoutPolicy;
  readonly cancellation: AIProviderCancellation;
  readonly attemptNumber: number;
  readonly traceId: string;
  readonly correlationId?: string;
  readonly policy: AIExecutionPolicy;
}

export interface AIExecutionPlan {
  readonly executionId: string;
  readonly createdAt: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly executionRequest: AIExecutionRequest;
}

export interface AIExecutionAttempt {
  readonly executionId: string;
  readonly attemptNumber: number;
  readonly providerId: string;
  readonly modelId: string;
  readonly adapterId: string;
  readonly status: AIExecutionAttemptStatus;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly adapterErrorCategory?: AIProviderAdapterErrorCategory;
}

export interface AIRetryPlan {
  readonly action: AIRetryAction;
  readonly reason: string;
  readonly currentAttempt: number;
  readonly remainingAttempts: number;
  readonly retryable: boolean;
  readonly nextAttemptNumber?: number;
}

export interface AIFallbackExecutionPlan {
  readonly returnToRouter: boolean;
  readonly routingDecisionId: string;
  readonly excludedProviderId: string;
  readonly excludedModelId: string;
  readonly reason: string;
}

interface AISettlementInstructionBase {
  readonly reservationId: string;
  readonly requestId: string;
  readonly estimatedReservedAmount: MinorUnitAmount;
  readonly actualReportedAmount?: MinorUnitAmount;
  readonly reason: string;
  readonly timestamp: string;
  readonly executionId: string;
  readonly policyVersion: string;
}

export interface AIReservationInstruction
  extends AISettlementInstructionBase {
  readonly type: AIReservationInstructionType;
}

export interface AIUsageSettlementInstruction
  extends AISettlementInstructionBase {
  readonly type: AIUsageSettlementInstructionType;
}

export interface AIExecutionPreconditionCheck {
  readonly name: string;
  readonly status: AIExecutionPreconditionStatus;
  readonly reason: string;
}

export interface AIExecutionCoordinatorError {
  readonly category: AIExecutionCoordinatorErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface AIExecutionAuditRecord {
  readonly auditId: string;
  readonly executionId: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly correlationId?: string;
  readonly timestamp: string;
  readonly routingDecisionId: string;
  readonly selectedProviderId?: string;
  readonly selectedModelId?: string;
  readonly routingPolicyVersion: string;
  readonly costGovernorDecisionId: string;
  readonly costGovernorStatus: CostDecisionStatus;
  readonly budgetPolicyVersion: string;
  readonly reservationId?: string;
  readonly adapterDescriptor?: Readonly<AIProviderAdapterDescriptor>;
  readonly providerHealth?: Readonly<AIProviderHealth>;
  readonly preconditionChecks: ReadonlyArray<AIExecutionPreconditionCheck>;
  readonly executionPlan?: AIExecutionPlan;
  readonly attempts: ReadonlyArray<AIExecutionAttempt>;
  readonly outputStatus: AIExecutionCoordinatorStatus;
  readonly usage?: AIUsageRecord;
  readonly latencyMs?: number;
  readonly reportedCost?: MinorUnitAmount;
  readonly retryPlan: AIRetryPlan;
  readonly fallbackPlan?: AIFallbackExecutionPlan;
  readonly reservationInstructions: ReadonlyArray<AIReservationInstruction>;
  readonly usageSettlementInstructions: ReadonlyArray<AIUsageSettlementInstruction>;
  readonly error?: AIExecutionCoordinatorError;
  readonly finalResult:
    | "SUCCEEDED"
    | "REJECTED"
    | "FAILED"
    | "CANCELLED"
    | "TIMED_OUT"
    | "DEFERRED"
    | "REROUTE"
    | "INVALID_RESPONSE";
}

export interface AIExecutionCoordinatorResult {
  readonly executionId: string;
  readonly status: AIExecutionCoordinatorStatus;
  readonly reasons: ReadonlyArray<string>;
  readonly executionPlan?: AIExecutionPlan;
  readonly response?: AIExecutionResponse;
  readonly attempts: ReadonlyArray<AIExecutionAttempt>;
  readonly retryPlan: AIRetryPlan;
  readonly fallbackPlan?: AIFallbackExecutionPlan;
  readonly reservationInstructions: ReadonlyArray<AIReservationInstruction>;
  readonly usageSettlementInstructions: ReadonlyArray<AIUsageSettlementInstruction>;
  readonly auditRecord: AIExecutionAuditRecord;
  readonly error?: AIExecutionCoordinatorError;
}

export interface AIExecutionCoordinator {
  execute(
    request: Readonly<AIExecutionCoordinatorRequest>,
    adapterRegistry: AIProviderAdapterRegistry,
  ): Promise<AIExecutionCoordinatorResult>;
}
