import type {
  BudgetReservation,
  CostGovernorDecision,
  MinorUnitAmount,
} from "./AICostGovernor";

export enum AIReservationState {
  Planned = "PLANNED",
  Reserved = "RESERVED",
  PartiallyCommitted = "PARTIALLY_COMMITTED",
  Committed = "COMMITTED",
  Released = "RELEASED",
  Expired = "EXPIRED",
  Cancelled = "CANCELLED",
  Rejected = "REJECTED",
}

export enum AIReservationOperationType {
  Acquire = "ACQUIRE",
  Commit = "COMMIT",
  Release = "RELEASE",
  Expire = "EXPIRE",
  Cancel = "CANCEL",
  Reject = "REJECT",
}

export enum AIReservationResultStatus {
  Applied = "APPLIED",
  Rejected = "REJECTED",
}

export enum AIReservationErrorCategory {
  InvalidRequest = "INVALID_REQUEST",
  CostNotApproved = "COST_NOT_APPROVED",
  ReservationMissing = "RESERVATION_MISSING",
  ReservationMismatch = "RESERVATION_MISMATCH",
  DuplicateReservation = "DUPLICATE_RESERVATION",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  AmountInvalid = "AMOUNT_INVALID",
  AmountExceedsReservation = "AMOUNT_EXCEEDS_RESERVATION",
  InvalidStateTransition = "INVALID_STATE_TRANSITION",
  ReservationNotFound = "RESERVATION_NOT_FOUND",
  VersionConflict = "VERSION_CONFLICT",
  NotExpired = "NOT_EXPIRED",
  ReservationExpired = "RESERVATION_EXPIRED",
  ExecutionReferenceMismatch = "EXECUTION_REFERENCE_MISMATCH",
  RepositoryConflict = "REPOSITORY_CONFLICT",
  Unknown = "UNKNOWN",
}

export enum AIReservationLedgerInstructionType {
  ReservationAcquired = "RESERVATION_ACQUIRED",
  UsagePartiallyCommitted = "USAGE_PARTIALLY_COMMITTED",
  UsageCommitted = "USAGE_COMMITTED",
  ReservationReleased = "RESERVATION_RELEASED",
  ReservationExpired = "RESERVATION_EXPIRED",
  ReservationCancelled = "RESERVATION_CANCELLED",
  ReservationRejected = "RESERVATION_REJECTED",
}

export enum AIReservationValidationStatus {
  Passed = "PASSED",
  Failed = "FAILED",
}

export type AIReservationIdempotencyKey = string;
export type AIReservationVersion = number;

export interface AIReservationExpirationPolicy {
  readonly allowAdministrativeEarlyExpiration: boolean;
  readonly allowCommitAfterExpiration: boolean;
}

export interface AIReservationPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly allowPartialCommit: boolean;
  readonly expiration: AIReservationExpirationPolicy;
}

export interface AIReservationRecord {
  readonly reservationId: string;
  readonly requestId: string;
  readonly costGovernorDecisionId: string;
  readonly state: AIReservationState;
  readonly version: AIReservationVersion;
  readonly reservedAmount: MinorUnitAmount;
  readonly committedAmount: MinorUnitAmount;
  readonly releasedAmount: MinorUnitAmount;
  readonly remainingAmount: MinorUnitAmount;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly expiresAt?: string;
  readonly policyVersion: string;
  readonly committedExecutionIds: ReadonlyArray<string>;
}

interface AIReservationRequestBase {
  readonly operationId: string;
  readonly idempotencyKey: AIReservationIdempotencyKey;
  readonly operationType: AIReservationOperationType;
  readonly reservationId: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly expectedVersion: AIReservationVersion;
  readonly policy: AIReservationPolicy;
  readonly reason: string;
}

export interface AIAcquireReservationRequest extends AIReservationRequestBase {
  readonly operationType: AIReservationOperationType.Acquire;
  readonly costDecision: CostGovernorDecision;
  readonly reservationPlan: BudgetReservation;
}

export interface AICommitReservationRequest extends AIReservationRequestBase {
  readonly operationType: AIReservationOperationType.Commit;
  readonly executionId: string;
  readonly actualUsage: MinorUnitAmount;
}

export interface AIReleaseReservationRequest extends AIReservationRequestBase {
  readonly operationType: AIReservationOperationType.Release;
  readonly executionId?: string;
}

export interface AIExpireReservationRequest extends AIReservationRequestBase {
  readonly operationType: AIReservationOperationType.Expire;
  readonly administrative: boolean;
}

export interface AICancelReservationRequest extends AIReservationRequestBase {
  readonly operationType: AIReservationOperationType.Cancel;
  readonly costDecision: CostGovernorDecision;
  readonly reservationPlan: BudgetReservation;
}

export interface AIRejectReservationRequest extends AIReservationRequestBase {
  readonly operationType: AIReservationOperationType.Reject;
  readonly costDecision: CostGovernorDecision;
  readonly reservationPlan: BudgetReservation;
}

export type AIReservationRequest =
  | AIAcquireReservationRequest
  | AICommitReservationRequest
  | AIReleaseReservationRequest
  | AIExpireReservationRequest
  | AICancelReservationRequest
  | AIRejectReservationRequest;

export interface AIReservationValidationCheck {
  readonly name: string;
  readonly status: AIReservationValidationStatus;
  readonly reason: string;
}

export interface AIReservationError {
  readonly category: AIReservationErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
  readonly currentVersion?: AIReservationVersion;
}

export interface AIReservationLedgerInstruction {
  readonly instructionId: string;
  readonly type: AIReservationLedgerInstructionType;
  readonly reservationId: string;
  readonly requestId: string;
  readonly executionId?: string;
  readonly operationId: string;
  readonly idempotencyKey: AIReservationIdempotencyKey;
  readonly amount: MinorUnitAmount;
  readonly stateBefore: AIReservationState;
  readonly stateAfter: AIReservationState;
  readonly timestamp: string;
  readonly policyVersion: string;
  readonly reason: string;
  readonly resultingVersion: AIReservationVersion;
}

export interface AIReservationAuditRecord {
  readonly auditId: string;
  readonly reservationId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly operationType: AIReservationOperationType;
  readonly timestamp: string;
  readonly idempotencyKey: AIReservationIdempotencyKey;
  readonly policyVersion: string;
  readonly stateBefore: AIReservationState | null;
  readonly stateAfter: AIReservationState | null;
  readonly versionBefore: AIReservationVersion | null;
  readonly versionAfter: AIReservationVersion | null;
  readonly reservedAmount: MinorUnitAmount;
  readonly committedAmount: MinorUnitAmount;
  readonly releasedAmount: MinorUnitAmount;
  readonly remainingAmount: MinorUnitAmount;
  readonly expiresAt?: string;
  readonly validationChecks: ReadonlyArray<AIReservationValidationCheck>;
  readonly decisionReasons: ReadonlyArray<string>;
  readonly error?: AIReservationError;
  readonly ledgerInstructionId?: string;
  readonly finalResult: "APPLIED" | "REJECTED";
}

export interface AIReservationResult {
  readonly status: AIReservationResultStatus;
  readonly operationId: string;
  readonly reservationId: string;
  readonly reasons: ReadonlyArray<string>;
  readonly record?: AIReservationRecord;
  readonly ledgerInstruction?: AIReservationLedgerInstruction;
  readonly auditRecord: AIReservationAuditRecord;
  readonly error?: AIReservationError;
}

export interface AIReservationOperation {
  readonly operationId: string;
  readonly idempotencyKey: AIReservationIdempotencyKey;
  readonly operationType: AIReservationOperationType;
  readonly reservationId: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly payloadFingerprint: string;
  readonly result: AIReservationResult;
}

export interface AIReservationCompareAndSetResult {
  readonly updated: boolean;
  readonly current?: AIReservationRecord;
}

export interface AIReservationRepository {
  getById(reservationId: string): AIReservationRecord | undefined;
  getByRequestId(requestId: string): ReadonlyArray<AIReservationRecord>;
  create(record: AIReservationRecord): boolean;
  compareAndSet(
    reservationId: string,
    expectedVersion: AIReservationVersion,
    nextRecord: AIReservationRecord,
  ): AIReservationCompareAndSetResult;
  appendOperation(operation: AIReservationOperation): boolean;
  getOperationById(operationId: string): AIReservationOperation | undefined;
  getOperationByIdempotencyKey(
    idempotencyKey: AIReservationIdempotencyKey,
  ): AIReservationOperation | undefined;
  listExpiredActive(asOf: string): ReadonlyArray<AIReservationRecord>;
}

export interface AIReservationManager {
  process(request: Readonly<AIReservationRequest>): AIReservationResult;
}
