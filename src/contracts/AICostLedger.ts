import type { AITaskType } from "./AIRouter";
import type { MinorUnitAmount } from "./AICostGovernor";
import type {
  AIReservationLedgerInstruction,
  AIReservationState,
} from "./AIReservationManager";

export type AICostLedgerSequence = number;
export type AICostLedgerIdempotencyKey = string;
export type AICostLedgerMetadataValue = string | number | boolean | null;
export type AICostLedgerMetadata = Readonly<
  Record<string, AICostLedgerMetadataValue>
>;

export enum AICostLedgerEntryType {
  ReservationAcquired = "RESERVATION_ACQUIRED",
  UsagePartiallyCommitted = "USAGE_PARTIALLY_COMMITTED",
  UsageCommitted = "USAGE_COMMITTED",
  ReservationReleased = "RESERVATION_RELEASED",
  ReservationExpired = "RESERVATION_EXPIRED",
  ReservationCancelled = "RESERVATION_CANCELLED",
  ReservationRejected = "RESERVATION_REJECTED",
  CriticalOverrideUsed = "CRITICAL_OVERRIDE_USED",
  ManualAdjustment = "MANUAL_ADJUSTMENT",
}

export enum AICostLedgerSourceSubsystem {
  CostGovernor = "AI_COST_GOVERNOR",
  ReservationManager = "AI_RESERVATION_MANAGER",
  ExecutionCoordinator = "AI_EXECUTION_COORDINATOR",
  OwnerAdjustment = "OWNER_ADJUSTMENT",
}

export enum AICostLedgerBusinessOrderStatus {
  InOrder = "IN_ORDER",
  OutOfOrderAllowed = "OUT_OF_ORDER_ALLOWED",
}

export enum AICostLedgerRepositoryType {
  InMemory = "IN_MEMORY",
  LocalNdjson = "LOCAL_NDJSON",
}

export enum AICostLedgerAppendStatus {
  Appended = "APPENDED",
  IdempotentReplay = "IDEMPOTENT_REPLAY",
  Rejected = "REJECTED",
}

export enum AICostLedgerErrorCategory {
  InvalidRequest = "INVALID_REQUEST",
  InvalidPolicy = "INVALID_POLICY",
  InvalidAmount = "INVALID_AMOUNT",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  DuplicateEntry = "DUPLICATE_ENTRY",
  DuplicateOperation = "DUPLICATE_OPERATION",
  DuplicateReservationSettlement = "DUPLICATE_RESERVATION_SETTLEMENT",
  DuplicateExecutionSettlement = "DUPLICATE_EXECUTION_SETTLEMENT",
  OutOfOrderEvent = "OUT_OF_ORDER_EVENT",
  ManualAdjustmentNotAllowed = "MANUAL_ADJUSTMENT_NOT_ALLOWED",
  RepositoryConflict = "REPOSITORY_CONFLICT",
  CorruptRepository = "CORRUPT_REPOSITORY",
  InvalidPath = "INVALID_PATH",
  Unknown = "UNKNOWN",
}

export enum AICostLedgerValidationStatus {
  Passed = "PASSED",
  Failed = "FAILED",
}

export enum AICostLedgerAuditOperationType {
  Append = "APPEND",
  Reconcile = "RECONCILE",
}

export enum AICostLedgerReconciliationStatus {
  Reconciled = "RECONCILED",
  IssuesDetected = "ISSUES_DETECTED",
  NoEntries = "NO_ENTRIES",
}

export enum AICostLedgerReconciliationIssueCode {
  CommitWithoutAcquisition = "COMMIT_WITHOUT_ACQUISITION",
  ReleaseWithoutActiveReservation = "RELEASE_WITHOUT_ACTIVE_RESERVATION",
  ExpirationWithoutAcquisition = "EXPIRATION_WITHOUT_ACQUISITION",
  DuplicateAcquisition = "DUPLICATE_ACQUISITION",
  DuplicateFullSettlement = "DUPLICATE_FULL_SETTLEMENT",
  CommittedExceedsReserved = "COMMITTED_EXCEEDS_RESERVED",
  SettlementExceedsReserved = "SETTLEMENT_EXCEEDS_RESERVED",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  RequestMismatch = "REQUEST_MISMATCH",
  InvalidTransitionOrder = "INVALID_TRANSITION_ORDER",
  MissingFinalSettlement = "MISSING_FINAL_SETTLEMENT",
  PolicyVersionConflict = "POLICY_VERSION_CONFLICT",
  DuplicateExecutionSettlement = "DUPLICATE_EXECUTION_SETTLEMENT",
  SequenceInconsistency = "SEQUENCE_INCONSISTENCY",
}

export interface AICostLedgerManualAdjustment {
  readonly deltaMinorUnits: number;
  readonly authorizationReference: string;
  readonly ownerReason: string;
  readonly targetScope: string;
}

export interface AICostLedgerEntryInput {
  readonly schemaVersion: "1.0";
  readonly integrityVersion: "1.0";
  readonly entryId: string;
  readonly requestId: string;
  readonly reservationId?: string;
  readonly executionId?: string;
  readonly operationId: string;
  readonly idempotencyKey: AICostLedgerIdempotencyKey;
  readonly entryType: AICostLedgerEntryType;
  readonly amount: MinorUnitAmount;
  readonly timestamp: string;
  readonly policyVersion: string;
  readonly reservationStateBefore?: AIReservationState;
  readonly reservationStateAfter?: AIReservationState;
  readonly reservationVersion?: number;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly taskType?: AITaskType;
  readonly reasonCode: string;
  readonly sourceSubsystem: AICostLedgerSourceSubsystem;
  readonly sourceAuditRecordId: string;
  readonly correlationId: string;
  readonly traceId?: string;
  readonly metadata: AICostLedgerMetadata;
  readonly manualAdjustment?: AICostLedgerManualAdjustment;
}

export interface AICostLedgerEntry extends AICostLedgerEntryInput {
  readonly sequence: AICostLedgerSequence;
  readonly businessOrderStatus: AICostLedgerBusinessOrderStatus;
  readonly payloadFingerprint: string;
}

export interface AICostLedgerPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly allowOutOfOrderEvents: boolean;
  readonly allowManualAdjustments: boolean;
  readonly authorizedManualAdjustmentReferences: ReadonlyArray<string>;
  readonly rejectSecretMetadataKeys: boolean;
}

export interface AICostLedgerAppendRequest {
  readonly entry: AICostLedgerEntryInput;
  readonly policy: AICostLedgerPolicy;
}

export interface AICostLedgerValidationCheck {
  readonly name: string;
  readonly status: AICostLedgerValidationStatus;
  readonly reason: string;
}

export interface AICostLedgerError {
  readonly category: AICostLedgerErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface AICostLedgerBalance {
  readonly currency: string;
  readonly acquiredMinorUnits: number;
  readonly committedMinorUnits: number;
  readonly releasedMinorUnits: number;
  readonly expiredMinorUnits: number;
  readonly cancelledMinorUnits: number;
  readonly rejectedMinorUnits: number;
  readonly overrideMinorUnits: number;
  readonly manualAdjustmentMinorUnits: number;
}

export interface AICostLedgerUsageBucket {
  readonly key: string;
  readonly currency: string;
  readonly committedMinorUnits: number;
}

export interface AICostLedgerUsageSummary {
  readonly balances: ReadonlyArray<AICostLedgerBalance>;
  readonly byDay: ReadonlyArray<AICostLedgerUsageBucket>;
  readonly byMonth: ReadonlyArray<AICostLedgerUsageBucket>;
  readonly byTaskType: ReadonlyArray<AICostLedgerUsageBucket>;
  readonly byProvider: ReadonlyArray<AICostLedgerUsageBucket>;
  readonly byModel: ReadonlyArray<AICostLedgerUsageBucket>;
  readonly byRequest: ReadonlyArray<AICostLedgerUsageBucket>;
  readonly byReservation: ReadonlyArray<AICostLedgerUsageBucket>;
  readonly byExecution: ReadonlyArray<AICostLedgerUsageBucket>;
}

export interface AICostLedgerQuery {
  readonly fromSequence?: AICostLedgerSequence;
  readonly toSequence?: AICostLedgerSequence;
  readonly requestId?: string;
  readonly reservationId?: string;
  readonly executionId?: string;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly taskType?: AITaskType;
  readonly currency?: string;
  readonly entryTypes?: ReadonlyArray<AICostLedgerEntryType>;
}

export interface AICostLedgerQueryResult {
  readonly entries: ReadonlyArray<AICostLedgerEntry>;
  readonly count: number;
  readonly latestSequence: AICostLedgerSequence;
}

export interface AICostLedgerReconciliationIssue {
  readonly code: AICostLedgerReconciliationIssueCode;
  readonly sequence: AICostLedgerSequence | null;
  readonly entryId?: string;
  readonly reason: string;
}

export interface AICostLedgerAuditRecord {
  readonly auditId: string;
  readonly operationType: AICostLedgerAuditOperationType;
  readonly operationId: string;
  readonly timestamp: string;
  readonly sourceSubsystem: AICostLedgerSourceSubsystem;
  readonly policyVersion: string;
  readonly requestedEntryId?: string;
  readonly reservationId?: string;
  readonly validationChecks: ReadonlyArray<AICostLedgerValidationCheck>;
  readonly idempotencyOutcome: "NEW" | "REPLAY" | "CONFLICT" | "NOT_APPLICABLE";
  readonly assignedSequence?: AICostLedgerSequence;
  readonly appendStatus?: AICostLedgerAppendStatus;
  readonly repositoryType: AICostLedgerRepositoryType;
  readonly resultingBalances: ReadonlyArray<AICostLedgerBalance>;
  readonly reconciliationIssues: ReadonlyArray<AICostLedgerReconciliationIssue>;
  readonly sourceAuditReferences: ReadonlyArray<string>;
  readonly error?: AICostLedgerError;
  readonly finalResult: "APPLIED" | "REPLAYED" | "REJECTED" | "RECONCILED" | "ISSUES";
}

export interface AICostLedgerAppendResult {
  readonly status: AICostLedgerAppendStatus;
  readonly reasons: ReadonlyArray<string>;
  readonly entry?: AICostLedgerEntry;
  readonly auditRecord: AICostLedgerAuditRecord;
  readonly error?: AICostLedgerError;
}

export interface AICostLedgerReconciliationResult {
  readonly status: AICostLedgerReconciliationStatus;
  readonly reservationId: string;
  readonly requestId?: string;
  readonly currency?: string;
  readonly reservedMinorUnits: number;
  readonly committedMinorUnits: number;
  readonly releasedMinorUnits: number;
  readonly remainingMinorUnits: number;
  readonly terminalState?: AIReservationState;
  readonly issues: ReadonlyArray<AICostLedgerReconciliationIssue>;
  readonly sourceEntryIds: ReadonlyArray<string>;
  readonly auditRecord: AICostLedgerAuditRecord;
}

export interface AICostLedgerRepositoryAppendRequest {
  readonly entry: AICostLedgerEntryInput;
  readonly businessOrderStatus: AICostLedgerBusinessOrderStatus;
  readonly payloadFingerprint: string;
}

export interface AICostLedgerRepositoryAppendResult {
  readonly appended: boolean;
  readonly entry?: AICostLedgerEntry;
  readonly conflictCategory?: AICostLedgerErrorCategory;
}

export interface AICostLedgerRepository {
  readonly repositoryType: AICostLedgerRepositoryType;
  appendAtomically(
    request: AICostLedgerRepositoryAppendRequest,
  ): AICostLedgerRepositoryAppendResult;
  getById(entryId: string): AICostLedgerEntry | undefined;
  getByIdempotencyKey(
    idempotencyKey: AICostLedgerIdempotencyKey,
  ): AICostLedgerEntry | undefined;
  getBySourceOperationId(operationId: string): AICostLedgerEntry | undefined;
  listBySequenceRange(fromInclusive: number, toInclusive: number): ReadonlyArray<AICostLedgerEntry>;
  listByRequestId(requestId: string): ReadonlyArray<AICostLedgerEntry>;
  listByReservationId(reservationId: string): ReadonlyArray<AICostLedgerEntry>;
  listByExecutionId(executionId: string): ReadonlyArray<AICostLedgerEntry>;
  listByTimestampRange(fromInclusive: string, toInclusive: string): ReadonlyArray<AICostLedgerEntry>;
  listByProviderModelTask(
    providerId?: string,
    modelId?: string,
    taskType?: AITaskType,
  ): ReadonlyArray<AICostLedgerEntry>;
  latestSequence(): AICostLedgerSequence;
  allEntries(): ReadonlyArray<AICostLedgerEntry>;
}

export interface AICostLedger {
  append(request: Readonly<AICostLedgerAppendRequest>): AICostLedgerAppendResult;
  query(query?: Readonly<AICostLedgerQuery>): AICostLedgerQueryResult;
  summarize(query?: Readonly<AICostLedgerQuery>): AICostLedgerUsageSummary;
  listUnresolvedReservationIds(
    query?: Readonly<AICostLedgerQuery>,
  ): ReadonlyArray<string>;
  reconcileReservation(
    reservationId: string,
    operationId: string,
    timestamp: string,
    policyVersion: string,
  ): AICostLedgerReconciliationResult;
}

export interface AICostLedgerReservationInstructionContext {
  readonly entryId: string;
  readonly sourceAuditRecordId: string;
  readonly correlationId: string;
  readonly traceId?: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly taskType?: AITaskType;
  readonly metadata?: AICostLedgerMetadata;
}

export interface AICostLedgerCheckpoint {
  readonly checkpointId: string;
  readonly throughSequence: AICostLedgerSequence;
  readonly createdAt: string;
  readonly policyVersion: string;
}

export type AIReservationLedgerInstructionTranslator = (
  instruction: Readonly<AIReservationLedgerInstruction>,
  context: Readonly<AICostLedgerReservationInstructionContext>,
) => AICostLedgerEntryInput;
