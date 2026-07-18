import type {
  AIRequest,
  PrivacyLevel,
  RoutingAuditRecord,
  RoutingDecision,
} from "./AIRouter";
import type { AIRouterConfiguration } from "./AIRouterConfig";
import type {
  BudgetUsageSnapshot,
  CostAuditRecord,
  CostGovernorDecision,
  CostGovernorPolicy,
} from "./AICostGovernor";
import type {
  AIExecutionCoordinatorResult,
  AIExecutionPolicy,
} from "./AIExecutionCoordinator";
import type {
  AIExecutionInput,
  AIProviderAdapterRegistry,
  AIProviderCancellation,
  AIProviderTimeoutPolicy,
} from "./AIProviderAdapter";
import type {
  AIReservationAuditRecord,
  AIReservationPolicy,
  AIReservationRepository,
  AIReservationResult,
} from "./AIReservationManager";
import type {
  AICostLedgerAppendResult,
  AICostLedgerPolicy,
  AICostLedgerReconciliationResult,
  AICostLedgerRepository,
} from "./AICostLedger";
import type {
  AIAuditActor,
  AIAuditPolicy,
  AIAuditRepository,
  AIAuditRetentionClassification,
  AIAuditTrace,
  AIAuditTraceStatus,
} from "./AIAuditRepository";

export enum AIRuntimeWorkflowStatus {
  CompletedSuccess = "COMPLETED_SUCCESS",
  CompletedWithWarning = "COMPLETED_WITH_WARNING",
  RejectedRouting = "REJECTED_ROUTING",
  RejectedCost = "REJECTED_COST",
  RejectedReservation = "REJECTED_RESERVATION",
  RejectedAudit = "REJECTED_AUDIT",
  FailedExecution = "FAILED_EXECUTION",
  FailedSettlement = "FAILED_SETTLEMENT",
  FailedLedger = "FAILED_LEDGER",
  FailedReconciliation = "FAILED_RECONCILIATION",
  FailedTraceIntegrity = "FAILED_TRACE_INTEGRITY",
  DeferredBudgetUnavailable = "DEFERRED_BUDGET_UNAVAILABLE",
  RequiresRouterFallback = "REQUIRES_ROUTER_FALLBACK",
  Cancelled = "CANCELLED",
  InvalidRequest = "INVALID_REQUEST",
  InternalInconsistency = "INTERNAL_INCONSISTENCY",
}

export enum AIRuntimeWorkflowStage {
  RequestValidation = "REQUEST_VALIDATION",
  Routing = "ROUTING",
  CostGovernance = "COST_GOVERNANCE",
  LowCostRerouting = "LOW_COST_REROUTING",
  ReservationAcquisition = "RESERVATION_ACQUISITION",
  ReservationLedgerAppend = "RESERVATION_LEDGER_APPEND",
  PreExecutionAudit = "PRE_EXECUTION_AUDIT",
  ProviderExecution = "PROVIDER_EXECUTION",
  ReservationSettlement = "RESERVATION_SETTLEMENT",
  SettlementLedgerAppend = "SETTLEMENT_LEDGER_APPEND",
  LedgerReconciliation = "LEDGER_RECONCILIATION",
  FinalAuditAppend = "FINAL_AUDIT_APPEND",
  TraceValidation = "TRACE_VALIDATION",
  Compensation = "COMPENSATION",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Deferred = "DEFERRED",
  RequiresReroute = "REQUIRES_REROUTE",
}

export enum AIRuntimeWorkflowStageStatus {
  Succeeded = "SUCCEEDED",
  Failed = "FAILED",
  Deferred = "DEFERRED",
  Compensated = "COMPENSATED",
  NotRequired = "NOT_REQUIRED",
}

export enum AIRuntimeWorkflowErrorCategory {
  InvalidRequest = "INVALID_REQUEST",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  RoutingRejected = "ROUTING_REJECTED",
  CostRejected = "COST_REJECTED",
  CostDeferred = "COST_DEFERRED",
  LowCostRouteUnavailable = "LOW_COST_ROUTE_UNAVAILABLE",
  ReservationFailed = "RESERVATION_FAILED",
  LedgerAppendFailed = "LEDGER_APPEND_FAILED",
  AuditAppendFailed = "AUDIT_APPEND_FAILED",
  ExecutionFailed = "EXECUTION_FAILED",
  SettlementFailed = "SETTLEMENT_FAILED",
  ReconciliationFailed = "RECONCILIATION_FAILED",
  TraceIntegrityFailed = "TRACE_INTEGRITY_FAILED",
  CompensationFailed = "COMPENSATION_FAILED",
  RepositoryConflict = "REPOSITORY_CONFLICT",
  InternalInconsistency = "INTERNAL_INCONSISTENCY",
}

export enum AIRuntimeWorkflowRetryDisposition {
  None = "NONE",
  RetrySameAdapterExplicitly = "RETRY_SAME_ADAPTER_EXPLICITLY",
  ReturnToRouter = "RETURN_TO_ROUTER",
  ManualLedgerReplay = "MANUAL_LEDGER_REPLAY",
  ManualReconciliation = "MANUAL_RECONCILIATION",
}

export enum AIRuntimeAuditFailureMode {
  FailClosed = "FAIL_CLOSED",
  WarnAfterMonetarySuccess = "WARN_AFTER_MONETARY_SUCCESS",
}

export enum AIRuntimeCompensationAction {
  ReleaseReservation = "RELEASE_RESERVATION",
  AppendReleaseLedgerEntry = "APPEND_RELEASE_LEDGER_ENTRY",
  PreserveForManualReconciliation = "PRESERVE_FOR_MANUAL_RECONCILIATION",
  ReplayLedgerAppend = "REPLAY_LEDGER_APPEND",
  RetryAuditAppend = "RETRY_AUDIT_APPEND",
}

export interface AIRuntimeWorkflowError {
  readonly category: AIRuntimeWorkflowErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
  readonly stage: AIRuntimeWorkflowStage;
}

export interface AIRuntimeWorkflowStageResult {
  readonly stage: AIRuntimeWorkflowStage;
  readonly status: AIRuntimeWorkflowStageStatus;
  readonly timestamp: string;
  readonly inputReferences: ReadonlyArray<string>;
  readonly outputReferences: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly sourceAuditReferences: ReadonlyArray<string>;
  readonly error?: AIRuntimeWorkflowError;
}

export interface AIRuntimeCompensationResult {
  readonly action: AIRuntimeCompensationAction;
  readonly status: "APPLIED" | "FAILED" | "RECOMMENDED" | "NOT_REQUIRED";
  readonly timestamp: string;
  readonly operationId?: string;
  readonly sourceAuditReferences: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly error?: AIRuntimeWorkflowError;
}

export interface AIRuntimeWorkflowPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly maximumLowCostReroutes: 0 | 1;
  readonly rerunCostGovernorAfterLowCostRoute: boolean;
  readonly requirePreExecutionAudit: boolean;
  readonly auditFailureMode: AIRuntimeAuditFailureMode;
  readonly acceptedFinalTraceStatuses: ReadonlyArray<AIAuditTraceStatus>;
  readonly auditPrivacyLevel: PrivacyLevel;
  readonly auditRetention: AIAuditRetentionClassification;
  readonly auditActor: AIAuditActor;
}

export interface AIRuntimeRouterBudgetUsage {
  readonly currency: string;
  readonly dailyCost: number;
  readonly monthlyCost: number;
  readonly capturedAt: string;
}

export interface AIRuntimeWorkflowConfiguration {
  readonly router: AIRouterConfiguration;
  readonly budgetUsage: AIRuntimeRouterBudgetUsage;
  readonly costGovernorPolicy: CostGovernorPolicy;
  readonly costGovernorBudgetUsage: BudgetUsageSnapshot;
  readonly reservationPolicy: AIReservationPolicy;
  readonly executionPolicy: AIExecutionPolicy;
  readonly costLedgerPolicy: AICostLedgerPolicy;
  readonly auditPolicy: AIAuditPolicy;
  readonly workflowPolicy: AIRuntimeWorkflowPolicy;
}

export interface AIRuntimeWorkflowIdentifiers {
  readonly reservationId: string;
  readonly executionId: string;
  readonly acquireOperationId: string;
  readonly acquireIdempotencyKey: string;
  readonly acquisitionLedgerEntryId: string;
  readonly commitOperationId: string;
  readonly commitIdempotencyKey: string;
  readonly commitLedgerEntryId: string;
  readonly releaseOperationId: string;
  readonly releaseIdempotencyKey: string;
  readonly releaseLedgerEntryId: string;
  readonly compensationReleaseOperationId: string;
  readonly compensationReleaseIdempotencyKey: string;
  readonly compensationReleaseLedgerEntryId: string;
  readonly reconciliationOperationId: string;
  readonly finalAuditRecordId: string;
  readonly finalAuditIdempotencyKey: string;
  readonly traceOperationId: string;
}

export interface AIRuntimeWorkflowRequest {
  readonly contractVersion: "1.0";
  readonly workflowId: string;
  readonly idempotencyKey: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly originalRequest: AIRequest;
  readonly executionInput: AIExecutionInput;
  readonly timeoutPolicy: AIProviderTimeoutPolicy;
  readonly cancellation: AIProviderCancellation;
  readonly identifiers: AIRuntimeWorkflowIdentifiers;
  readonly configuration: AIRuntimeWorkflowConfiguration;
}

export interface AIRuntimeWorkflowSettlementResult {
  readonly reservationResults: ReadonlyArray<AIReservationResult>;
  readonly ledgerResults: ReadonlyArray<AICostLedgerAppendResult>;
  readonly finalReservationAudit?: AIReservationAuditRecord;
  readonly completed: boolean;
  readonly retainedForRetry: boolean;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface AIRuntimeWorkflowTrace {
  readonly trace: AIAuditTrace;
  readonly acceptable: boolean;
  readonly finalOutcome: string | undefined;
}

export interface AIRuntimeWorkflowAuditRecord {
  readonly auditId: string;
  readonly workflowId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly timestamp: string;
  readonly policyVersion: string;
  readonly status: AIRuntimeWorkflowStatus;
  readonly lastCompletedStage: AIRuntimeWorkflowStage;
  readonly completedStages: ReadonlyArray<AIRuntimeWorkflowStage>;
  readonly routingDecisionIds: ReadonlyArray<string>;
  readonly costDecisionIds: ReadonlyArray<string>;
  readonly reservationId: string;
  readonly executionId?: string;
  readonly ledgerEntryIds: ReadonlyArray<string>;
  readonly sourceAuditReferences: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly compensationActions: ReadonlyArray<AIRuntimeCompensationAction>;
  readonly finalResult: string;
}

export interface AIRuntimeWorkflowResult {
  readonly workflowId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly status: AIRuntimeWorkflowStatus;
  readonly lastCompletedStage: AIRuntimeWorkflowStage;
  readonly stages: ReadonlyArray<AIRuntimeWorkflowStageResult>;
  readonly reasons: ReadonlyArray<string>;
  readonly routingDecisions: ReadonlyArray<RoutingDecision>;
  readonly routingAuditRecords: ReadonlyArray<RoutingAuditRecord>;
  readonly costDecisions: ReadonlyArray<CostGovernorDecision>;
  readonly costAuditRecords: ReadonlyArray<CostAuditRecord>;
  readonly reservationResults: ReadonlyArray<AIReservationResult>;
  readonly ledgerResults: ReadonlyArray<AICostLedgerAppendResult>;
  readonly executionResult?: AIExecutionCoordinatorResult;
  readonly settlement?: AIRuntimeWorkflowSettlementResult;
  readonly reconciliation?: AICostLedgerReconciliationResult;
  readonly auditTrace?: AIRuntimeWorkflowTrace;
  readonly compensations: ReadonlyArray<AIRuntimeCompensationResult>;
  readonly retryDisposition: AIRuntimeWorkflowRetryDisposition;
  readonly workflowAuditRecord: AIRuntimeWorkflowAuditRecord;
  readonly error?: AIRuntimeWorkflowError;
}

export interface AIRuntimeWorkflowStoredOperation {
  readonly workflowId: string;
  readonly idempotencyKey: string;
  readonly requestFingerprint: string;
  readonly result: AIRuntimeWorkflowResult;
}

export interface AIRuntimeWorkflowRepository {
  getByWorkflowId(workflowId: string): AIRuntimeWorkflowStoredOperation | undefined;
  getByIdempotencyKey(idempotencyKey: string): AIRuntimeWorkflowStoredOperation | undefined;
  append(operation: Readonly<AIRuntimeWorkflowStoredOperation>): boolean;
}

export interface AIRuntimeWorkflowClock {
  now(): string;
}

export interface AIRuntimeWorkflowDependencies {
  readonly clock: AIRuntimeWorkflowClock;
  readonly adapterRegistry: AIProviderAdapterRegistry;
  readonly reservationRepository: AIReservationRepository;
  readonly costLedgerRepository: AICostLedgerRepository;
  readonly auditRepository: AIAuditRepository;
  readonly workflowRepository: AIRuntimeWorkflowRepository;
}

export interface AIRuntimeWorkflow {
  execute(request: Readonly<AIRuntimeWorkflowRequest>): Promise<AIRuntimeWorkflowResult>;
}
