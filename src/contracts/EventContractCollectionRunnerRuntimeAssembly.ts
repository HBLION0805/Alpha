import type {
  CollectionRunnerPilotState,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
} from "./EventContractCollectionRunner";
import type {
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeMode,
} from "./EventContractCollectionRunnerRuntime";

export const EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION =
  "1.0" as const;

export const COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS = 10_000;

export enum CollectionRunnerRuntimeInvocationState {
  Created = "CREATED",
  ConfigurationVerified = "CONFIGURATION_VERIFIED",
  OwnershipAcquired = "OWNERSHIP_ACQUIRED",
  StoreInspected = "STORE_INSPECTED",
  SessionAuthorized = "SESSION_AUTHORIZED",
  PreflightReady = "PREFLIGHT_READY",
  ActionSelected = "ACTION_SELECTED",
  ActionExecuting = "ACTION_EXECUTING",
  Reporting = "REPORTING",
  Closing = "CLOSING",
  Closed = "CLOSED",
  StartBlocked = "START_BLOCKED",
  RecoveryBlocked = "RECOVERY_BLOCKED",
  FailedClosed = "FAILED_CLOSED",
  Stopping = "STOPPING",
}

export enum CollectionRunnerRuntimeAssemblyAction {
  FailClosed = "FAIL_CLOSED",
  TripEmergencyStop = "TRIP_EMERGENCY_STOP",
  RequestGracefulCompletion = "REQUEST_GRACEFUL_COMPLETION",
  TransitionExactTaskDue = "TRANSITION_EXACT_TASK_DUE",
  MarkExactTaskMissed = "MARK_EXACT_TASK_MISSED",
  ExecuteExactFixtureTask = "EXECUTE_EXACT_FIXTURE_TASK",
  WaitAndExit = "WAIT_AND_EXIT",
  CompleteAndExit = "COMPLETE_AND_EXIT",
}

export enum CollectionRunnerRuntimeCleanupDisposition {
  VerifiedCleanRelease = "VERIFIED_CLEAN_RELEASE",
  OwnershipPreservedForRecovery = "OWNERSHIP_PRESERVED_FOR_RECOVERY",
  NoOwnershipAcquired = "NO_OWNERSHIP_ACQUIRED",
}

export enum CollectionRunnerRuntimeStepOutcome {
  Completed = "COMPLETED",
  NoWork = "NO_WORK",
  Stopped = "STOPPED",
  Blocked = "BLOCKED",
  FailedClosed = "FAILED_CLOSED",
  Ambiguous = "AMBIGUOUS",
}

export interface CollectionRunnerRuntimeWorkSnapshotTaskInput {
  readonly taskId: string;
  readonly sourceLane: CollectionRunnerSourceLane;
  readonly state: CollectionRunnerTaskState;
  readonly aggregateVersion: number;
  readonly requiredActionAtUtc: string;
  readonly evidenceCutoffAtUtc: string;
  readonly deadlineAtUtc: string;
  readonly retryEligibleAtUtc: string | null;
  readonly attemptsStarted: number;
  readonly taskFingerprint: string;
}

export interface CollectionRunnerRuntimeWorkSnapshotTask
  extends CollectionRunnerRuntimeWorkSnapshotTaskInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeWorkSnapshotBudgetInput {
  readonly aggregateVersion: number;
  readonly maximumEvents: number;
  readonly eventsScheduled: number;
  readonly tasksMissed: number;
  readonly maximumRequests: number;
  readonly requestsStarted: number;
  readonly maximumRetries: number;
  readonly retriesStarted: number;
}

export interface CollectionRunnerRuntimeWorkSnapshotLeaseInput {
  readonly taskId: string;
  readonly leaseToken: string;
  readonly bootIdentity: string;
  readonly processSessionId: string;
  readonly acquiredAtUtc: string;
  readonly expiresAtUtc: string;
}

export interface CollectionRunnerRuntimeWorkSnapshotInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION;
  readonly activationId: string;
  readonly pilotState: CollectionRunnerPilotState;
  readonly pilotAggregateVersion: number;
  readonly activationStopsAtUtc: string;
  readonly sessionAuthorizationId: string;
  readonly sessionAuthorizationExpiresAtUtc: string;
  readonly emergencyStopObserved: boolean;
  readonly budget: CollectionRunnerRuntimeWorkSnapshotBudgetInput;
  readonly currentLease: CollectionRunnerRuntimeWorkSnapshotLeaseInput | null;
  readonly openAttemptId: string | null;
  readonly tasks: readonly CollectionRunnerRuntimeWorkSnapshotTaskInput[];
  readonly observedAtUtc: string;
}

export interface CollectionRunnerRuntimeWorkSnapshot
  extends Omit<CollectionRunnerRuntimeWorkSnapshotInput, "tasks"> {
  readonly tasks: readonly CollectionRunnerRuntimeWorkSnapshotTask[];
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeWorkSnapshotRequest {
  readonly activationId: string;
  readonly observedAtUtc: string;
  readonly maximumTasks: number;
}

export interface CollectionRunnerRuntimeAssemblyPlannerInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION;
  readonly runtimeMode: CollectionRunnerRuntimeMode;
  readonly configurationIdentityVerified: boolean;
  readonly lockOwnershipVerified: boolean;
  readonly processSessionAuthorized: boolean;
  readonly clockHealthy: boolean;
  readonly stopBarrierTripped: boolean;
  readonly nowUtc: string;
  readonly snapshot: CollectionRunnerRuntimeWorkSnapshot;
}

export interface CollectionRunnerRuntimeAssemblyDecision {
  readonly action: CollectionRunnerRuntimeAssemblyAction;
  readonly taskId: string | null;
  readonly expectedTaskVersion: number | null;
  readonly expectedBudgetVersion: number | null;
  readonly waitUntilUtc: string | null;
  readonly reasonCode: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeT6ExecutionRequest {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION;
  readonly activationId: string;
  readonly action:
    | CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue
    | CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed;
  readonly taskId: string;
  readonly expectedTaskVersion: number;
  readonly expectedBudgetVersion: number;
  readonly observedAtUtc: string;
  readonly workSnapshotFingerprint: string;
  readonly plannerDecisionFingerprint: string;
  readonly reasonCode: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeT6ExecutionResult {
  readonly taskId: string;
  readonly resultingState:
    | CollectionRunnerTaskState.Due
    | CollectionRunnerTaskState.Missed;
  readonly resultingAggregateVersion: number;
  readonly transitionReceiptFingerprint: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeTerminalReportInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION;
  readonly configurationFingerprint: string;
  readonly pathFingerprint: string;
  readonly storeIdentity: string;
  readonly lockFingerprint: string | null;
  readonly bootIdentity: string | null;
  readonly processSessionId: string | null;
  readonly activationId: string;
  readonly buildFingerprint: string;
  readonly invocationId: string;
  readonly startedAtUtc: string;
  readonly endedAtUtc: string;
  readonly elapsedMonotonicMilliseconds: number;
  readonly finalState: CollectionRunnerRuntimeInvocationState;
  readonly outcome: CollectionRunnerRuntimeStepOutcome;
  readonly healthStatus: CollectionRunnerRuntimeHealthStatus;
  readonly blockerCodes: readonly string[];
  readonly action: CollectionRunnerRuntimeAssemblyAction | null;
  readonly taskId: string | null;
  readonly reasonCode: string;
  readonly durableMutationAttempted: boolean;
  readonly durableReceiptFingerprint: string | null;
  readonly stopBarrierTripped: boolean;
  readonly cleanupDisposition: CollectionRunnerRuntimeCleanupDisposition;
  readonly ambiguityPreserved: boolean;
  readonly recoveryRequired: boolean;
}

export interface CollectionRunnerRuntimeTerminalReport
  extends CollectionRunnerRuntimeTerminalReportInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}
