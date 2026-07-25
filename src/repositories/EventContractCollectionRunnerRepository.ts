import type {
  CollectionRunnerDefinition,
  CollectionRunnerPilotActivation,
  CollectionRunnerPilotState,
  CollectionRunnerScheduledTask,
  CollectionRunnerTaskState,
} from "../contracts/EventContractCollectionRunner";
import type { EventContractSourceSnapshot } from "../contracts/EventContractSource";

export enum CollectionRunnerRepositoryErrorCode {
  InvalidInput = "INVALID_INPUT",
  NotFound = "NOT_FOUND",
  IdentityConflict = "IDENTITY_CONFLICT",
  VersionConflict = "VERSION_CONFLICT",
  InvalidState = "INVALID_STATE",
  AuthorityMismatch = "AUTHORITY_MISMATCH",
  BudgetExceeded = "BUDGET_EXCEEDED",
  LeaseConflict = "LEASE_CONFLICT",
  AttemptConflict = "ATTEMPT_CONFLICT",
  EvidenceConflict = "EVIDENCE_CONFLICT",
  DeadlineExceeded = "DEADLINE_EXCEEDED",
  TransactionFailed = "TRANSACTION_FAILED",
}

export class CollectionRunnerRepositoryError extends Error {
  public constructor(
    public readonly code: CollectionRunnerRepositoryErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerRepositoryError";
  }
}

export interface CollectionRunnerTransactionEvidence {
  readonly occurredAtUtc: string;
  readonly reasonCode: string;
}

export interface CollectionRunnerClockEvidence {
  readonly observedAtUtc: string;
  readonly absoluteOffsetMilliseconds: number;
  readonly healthy: true;
}

export interface CollectionRunnerLeaseInput {
  readonly leaseToken: string;
  readonly workerId: string;
  readonly processSessionId: string;
  readonly bootIdentity: string;
  readonly acquiredAtUtc: string;
  readonly heartbeatAtUtc: string;
  readonly expiresAtUtc: string;
  readonly acquiredMonotonicNanoseconds: number;
  readonly heartbeatMonotonicNanoseconds: number;
  readonly expiresMonotonicNanoseconds: number;
}

export interface CollectionRunnerAttemptClaimInput {
  readonly attemptId: string;
  readonly leaseToken: string;
  readonly startedAtUtc: string;
  readonly adapterVersion: string;
  readonly policyVersion: string;
}

export interface CollectionRunnerAttemptResultInput {
  readonly finishedAtUtc: string;
  readonly receivedAtUtc: string | null;
  readonly normalizedAtUtc: string | null;
  readonly outcomeCode: string;
  readonly retryDisposition: string;
  readonly rawPayloadBytes: number;
  readonly recordCount: number;
  readonly responseFingerprint: string | null;
  readonly normalizedSnapshotFingerprint: string | null;
}

export interface CollectionRunnerStoredAttemptResult
  extends CollectionRunnerAttemptResultInput {
  readonly attemptId: string;
  readonly resultFingerprint: string;
  readonly createdAtUtc: string;
}

export interface CollectionRunnerStoredEvidence {
  readonly evidenceId: string;
  readonly taskId: string;
  readonly taskIdempotencyKey: string;
  readonly attemptId: string;
  readonly providerFingerprint: string;
  readonly mappingFingerprint: string | null;
  readonly sourceSnapshotFingerprint: string;
  readonly payloadFingerprint: string;
  readonly capability: string;
  readonly sourceLane: string;
  readonly observedAtUtc: string;
  readonly receivedAtUtc: string;
  readonly normalizedAtUtc: string;
  readonly rawPayloadBytes: number;
  readonly recordCount: number;
  readonly committedAtUtc: string;
}

export interface RegisterRunnerDefinitionTransaction {
  readonly definition: CollectionRunnerDefinition;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface CreatePilotArtifactTransaction {
  readonly activation: CollectionRunnerPilotActivation;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface MaterializeTasksTransaction {
  readonly activationId: string;
  readonly expectedBudgetVersion: number;
  readonly tasks: readonly CollectionRunnerScheduledTask[];
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface TransitionPilotTransaction {
  readonly activationId: string;
  readonly expectedAggregateVersion: number;
  readonly nextState: CollectionRunnerPilotState;
  readonly clock: CollectionRunnerClockEvidence;
  readonly recoveryBlockerCount: number;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface TransitionTaskTransaction {
  readonly taskId: string;
  readonly expectedAggregateVersion: number;
  readonly nextState:
    | CollectionRunnerTaskState.Due
    | CollectionRunnerTaskState.Missed
    | CollectionRunnerTaskState.TerminalFailed
    | CollectionRunnerTaskState.Cancelled;
  readonly clock: CollectionRunnerClockEvidence;
  readonly expectedBudgetVersion: number;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface AcquireTaskLeaseTransaction {
  readonly taskId: string;
  readonly expectedTaskVersion: number;
  readonly expectedBudgetVersion: number;
  readonly clock: CollectionRunnerClockEvidence;
  readonly lease: CollectionRunnerLeaseInput;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface StartTaskAttemptTransaction {
  readonly taskId: string;
  readonly expectedTaskVersion: number;
  readonly expectedBudgetVersion: number;
  readonly clock: CollectionRunnerClockEvidence;
  readonly claim: CollectionRunnerAttemptClaimInput;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface MarkTaskValidatingTransaction {
  readonly taskId: string;
  readonly expectedTaskVersion: number;
  readonly attemptId: string;
  readonly leaseToken: string;
  readonly clock: CollectionRunnerClockEvidence;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface FinalizeTaskFailureTransaction {
  readonly taskId: string;
  readonly expectedTaskVersion: number;
  readonly expectedBudgetVersion: number;
  readonly attemptId: string;
  readonly leaseToken: string;
  readonly nextState:
    | CollectionRunnerTaskState.RetryWait
    | CollectionRunnerTaskState.Missed
    | CollectionRunnerTaskState.TerminalFailed
    | CollectionRunnerTaskState.Cancelled;
  readonly result: CollectionRunnerAttemptResultInput;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface CommitTaskEvidenceTransaction {
  readonly evidenceId: string;
  readonly taskId: string;
  readonly expectedTaskVersion: number;
  readonly expectedBudgetVersion: number;
  readonly attemptId: string;
  readonly leaseToken: string;
  readonly snapshot: EventContractSourceSnapshot;
  readonly result: CollectionRunnerAttemptResultInput;
  readonly committedAtUtc: string;
  readonly evidence: CollectionRunnerTransactionEvidence;
}

export interface CollectionRunnerBudgetCounters {
  readonly activationId: string;
  readonly aggregateVersion: number;
  readonly eventsScheduled: number;
  readonly requestsStarted: number;
  readonly bytesReceived: number;
  readonly recordsReceived: number;
  readonly retriesStarted: number;
  readonly evidenceCommitted: number;
  readonly tasksMissed: number;
  readonly updatedAtUtc: string;
}

export interface EventContractCollectionRunnerRepository {
  registerRunnerDefinition(
    transaction: RegisterRunnerDefinitionTransaction,
  ): CollectionRunnerDefinition;
  createPilotArtifact(
    transaction: CreatePilotArtifactTransaction,
  ): CollectionRunnerPilotActivation;
  materializeTasks(
    transaction: MaterializeTasksTransaction,
  ): readonly CollectionRunnerScheduledTask[];
  transitionPilot(
    transaction: TransitionPilotTransaction,
  ): Readonly<{
    activationId: string;
    state: CollectionRunnerPilotState;
    aggregateVersion: number;
  }>;
  transitionTask(
    transaction: TransitionTaskTransaction,
  ): Readonly<{
    taskId: string;
    state: CollectionRunnerTaskState;
    aggregateVersion: number;
  }>;
  acquireTaskLease(
    transaction: AcquireTaskLeaseTransaction,
  ): Readonly<CollectionRunnerLeaseInput & {
    taskId: string;
    aggregateVersion: 1;
  }>;
  startTaskAttempt(
    transaction: StartTaskAttemptTransaction,
  ): Readonly<{
    attemptId: string;
    taskId: string;
    attemptNumber: number;
    attemptFingerprint: string;
  }>;
  markTaskValidating(
    transaction: MarkTaskValidatingTransaction,
  ): Readonly<{
    taskId: string;
    state: CollectionRunnerTaskState.Validating;
    aggregateVersion: number;
  }>;
  finalizeTaskFailure(
    transaction: FinalizeTaskFailureTransaction,
  ): CollectionRunnerStoredAttemptResult;
  commitTaskEvidence(
    transaction: CommitTaskEvidenceTransaction,
  ): CollectionRunnerStoredEvidence;
  getRunnerDefinition(
    runnerDefinitionId: string,
    version: string,
  ): CollectionRunnerDefinition | null;
  getPilotState(
    activationId: string,
  ): Readonly<{
    activationId: string;
    state: CollectionRunnerPilotState;
    aggregateVersion: number;
  }> | null;
  getTaskState(
    taskId: string,
  ): Readonly<{
    taskId: string;
    state: CollectionRunnerTaskState;
    aggregateVersion: number;
  }> | null;
  getBudgetCounters(activationId: string): CollectionRunnerBudgetCounters | null;
  getEvidenceByTaskId(taskId: string): CollectionRunnerStoredEvidence | null;
}
