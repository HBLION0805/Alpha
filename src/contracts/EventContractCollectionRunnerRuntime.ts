export const EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION =
  "1.0" as const;

export enum CollectionRunnerRuntimeMode {
  FixtureOnly = "FIXTURE_ONLY",
}

export enum CollectionRunnerClockSynchronizationStatus {
  Synchronized = "SYNCHRONIZED",
  Unsynchronized = "UNSYNCHRONIZED",
  Unknown = "UNKNOWN",
}

export enum CollectionRunnerRuntimeFoundationErrorCode {
  InvalidConfiguration = "INVALID_CONFIGURATION",
  UnknownField = "UNKNOWN_FIELD",
  InvalidPath = "INVALID_PATH",
  UnsafeFilesystemEntry = "UNSAFE_FILESYSTEM_ENTRY",
  DuplicateProcess = "DUPLICATE_PROCESS",
  OwnershipInitializationFailed = "OWNERSHIP_INITIALIZATION_FAILED",
  OwnershipLost = "OWNERSHIP_LOST",
  InvalidBootIdentity = "INVALID_BOOT_IDENTITY",
  InvalidProcessIdentity = "INVALID_PROCESS_IDENTITY",
  InvalidClockEvidence = "INVALID_CLOCK_EVIDENCE",
  ClockUnhealthy = "CLOCK_UNHEALTHY",
  InvalidSchedulerInput = "INVALID_SCHEDULER_INPUT",
  InvalidWorkerInput = "INVALID_WORKER_INPUT",
  AdapterBindingMismatch = "ADAPTER_BINDING_MISMATCH",
  WorkerPersistenceFailed = "WORKER_PERSISTENCE_FAILED",
  InvalidOperatorInput = "INVALID_OPERATOR_INPUT",
  StopPersistenceFailed = "STOP_PERSISTENCE_FAILED",
}

export enum CollectionRunnerSchedulerAction {
  AcquireExactTask = "ACQUIRE_EXACT_TASK",
  WaitUntil = "WAIT_UNTIL",
  MarkExactTaskMissed = "MARK_EXACT_TASK_MISSED",
  RequestGracefulCompletion = "REQUEST_GRACEFUL_COMPLETION",
  TripEmergencyStop = "TRIP_EMERGENCY_STOP",
  FailClosed = "FAIL_CLOSED",
}

export enum CollectionRunnerFixtureAdapterOutcome {
  Snapshot = "SNAPSHOT",
  Failure = "FAILURE",
}

export enum CollectionRunnerFixtureWorkerOutcome {
  EvidenceCommitted = "EVIDENCE_COMMITTED",
  RetryWait = "RETRY_WAIT",
  TerminalFailed = "TERMINAL_FAILED",
  Cancelled = "CANCELLED",
}

export interface CollectionRunnerRuntimeConfigurationInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION;
  readonly runtimeId: string;
  readonly runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly;
  readonly runtimeControlRoot: string;
  readonly sqliteRoot: string;
  readonly storeId: string;
  readonly activationId: string;
  readonly applicationBuildFingerprint: string;
  readonly runnerDefinitionFingerprint: string;
  readonly frozenPlanFingerprint: string;
  readonly fixtureProviderFingerprint: string;
  readonly maximumClockOffsetMilliseconds: number;
  readonly maximumClockHealthAgeMilliseconds: number;
}

export interface CollectionRunnerRuntimeConfiguration
  extends CollectionRunnerRuntimeConfigurationInput {
  readonly deterministic: true;
  readonly networkPermitted: false;
  readonly continuousRunPermitted: false;
  readonly maximumWorkers: 1;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimePaths {
  readonly runtimeControlRoot: string;
  readonly sqliteRoot: string;
  readonly storePath: string;
  readonly storePathIdentity: string;
  readonly lockDirectory: string;
  readonly lockOwnerRecordPath: string;
  readonly pathFingerprint: string;
}

export interface CollectionRunnerBootIdentity {
  readonly bootIdentity: string;
  readonly source: string;
  readonly sourceVersion: string;
}

export interface CollectionRunnerBootIdentityPort {
  readBootIdentity(): CollectionRunnerBootIdentity;
}

export interface CollectionRunnerProcessLivenessPort {
  isProcessAlive(processId: number): boolean;
}

export interface CollectionRunnerProcessNoncePort {
  createNonce(): string;
}

export interface CollectionRunnerWallClock {
  nowUtc(): string;
}

export interface CollectionRunnerMonotonicClock {
  nowNanoseconds(): bigint;
}

export interface CollectionRunnerClockHealthObservationInput {
  readonly observedAtUtc: string;
  readonly synchronizationStatus: CollectionRunnerClockSynchronizationStatus;
  readonly estimatedAbsoluteUtcOffsetMilliseconds: number | null;
  readonly source: string;
  readonly policyVersion: string;
  readonly freshnessDeadlineUtc: string;
}

export interface CollectionRunnerClockHealthObservation
  extends CollectionRunnerClockHealthObservationInput {
  readonly fingerprint: string;
}

export interface CollectionRunnerClockHealthProbe {
  observe(): CollectionRunnerClockHealthObservationInput;
}

export interface CollectionRunnerRuntimeClockSnapshot {
  readonly wallClockUtc: string;
  readonly monotonicNanoseconds: bigint;
  readonly health: CollectionRunnerClockHealthObservation;
  readonly healthy: true;
}

export interface CollectionRunnerRuntimeOwnership {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION;
  readonly lockId: string;
  readonly configurationFingerprint: string;
  readonly pathFingerprint: string;
  readonly storePathIdentity: string;
  readonly activationId: string;
  readonly bootIdentity: string;
  readonly bootIdentitySource: string;
  readonly bootIdentitySourceVersion: string;
  readonly processId: number;
  readonly processNonceFingerprint: string;
  readonly processSessionId: string;
  readonly acquiredAtUtc: string;
  readonly fingerprint: string;
}

export interface CollectionRunnerSchedulerTaskView {
  readonly taskId: string;
  readonly sourceLane: "PLATFORM" | "EXCHANGE";
  readonly state:
    | "SCHEDULED"
    | "DUE"
    | "RETRY_WAIT"
    | "COMMITTED"
    | "MISSED"
    | "TERMINAL_FAILED"
    | "CANCELLED";
  readonly requiredActionAtUtc: string;
  readonly evidenceCutoffAtUtc: string;
  readonly deadlineAtUtc: string;
  readonly retryEligibleAtUtc: string | null;
}

export interface CollectionRunnerSchedulerInput {
  readonly nowUtc: string;
  readonly stopBarrierTripped: boolean;
  readonly lockOwnershipVerified: boolean;
  readonly configurationIdentityVerified: boolean;
  readonly clockHealthy: boolean;
  readonly processSessionAuthorized: boolean;
  readonly pilotState:
    | "ACTIVE"
    | "STOP_REQUESTED"
    | "STOPPED"
    | "REVOKED"
    | "COMPLETED"
    | "FAILED_CLOSED";
  readonly emergencyStopObserved: boolean;
  readonly budgetAvailable: boolean;
  readonly tasks: readonly CollectionRunnerSchedulerTaskView[];
}

export interface CollectionRunnerSchedulerDecision {
  readonly action: CollectionRunnerSchedulerAction;
  readonly taskId: string | null;
  readonly waitUntilUtc: string | null;
  readonly reasonCode: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerFixtureAdapterFailure {
  readonly outcome: CollectionRunnerFixtureAdapterOutcome.Failure;
  readonly outcomeCode: string;
  readonly retryable: boolean;
  readonly finishedAtUtc: string;
}

export interface CollectionRunnerFixtureAdapterSnapshot {
  readonly outcome: CollectionRunnerFixtureAdapterOutcome.Snapshot;
  readonly snapshot: import("./EventContractSource").EventContractSourceSnapshot;
  readonly finishedAtUtc: string;
}

export type CollectionRunnerFixtureAdapterResult =
  | CollectionRunnerFixtureAdapterFailure
  | CollectionRunnerFixtureAdapterSnapshot;

export interface CollectionRunnerFixtureWorkerResult {
  readonly outcome: CollectionRunnerFixtureWorkerOutcome;
  readonly taskId: string;
  readonly attemptId: string;
  readonly evidenceId: string | null;
  readonly reasonCode: string;
  readonly deterministic: true;
}

export enum CollectionRunnerRuntimeHealthStatus {
  Healthy = "HEALTHY",
  Degraded = "DEGRADED",
  FailClosed = "FAIL_CLOSED",
}

export enum CollectionRunnerRuntimeStopMode {
  Graceful = "GRACEFUL",
  Emergency = "EMERGENCY",
}

export interface CollectionRunnerRuntimeSafetyEvidence {
  readonly configurationVerified: boolean;
  readonly ownershipVerified: boolean;
  readonly storeReady: boolean;
  readonly integrityVerified: boolean;
  readonly clockHealthy: boolean;
  readonly sessionAuthorized: boolean;
  readonly stopBarrierTripped: boolean;
  readonly blockerCodes: readonly string[];
}

export interface CollectionRunnerRuntimePreflightInput {
  readonly observedAtUtc: string;
  readonly configurationFingerprint: string;
  readonly pathFingerprint: string;
  readonly storeIdentity: string;
  readonly schemaCatalogChecksum: string;
  readonly recoveryReportFingerprint: string;
  readonly safety: CollectionRunnerRuntimeSafetyEvidence;
}

export interface CollectionRunnerRuntimePreflightReport
  extends CollectionRunnerRuntimePreflightInput {
  readonly ready: boolean;
  readonly health: CollectionRunnerRuntimeHealthStatus;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeTaskCount {
  readonly sourceLane: "PLATFORM" | "EXCHANGE";
  readonly state: string;
  readonly count: number;
}

export interface CollectionRunnerRuntimeBudgetProjection {
  readonly maximumEvents: number;
  readonly maximumRequests: number;
  readonly eventsScheduled: number;
  readonly requestsStarted: number;
  readonly retriesStarted: number;
  readonly evidenceCommitted: number;
  readonly tasksMissed: number;
}

export interface CollectionRunnerRuntimeLeaseProjection {
  readonly taskId: string;
  readonly workerId: string;
  readonly acquiredAtUtc: string;
  readonly heartbeatAtUtc: string;
  readonly expiresAtUtc: string;
}

export interface CollectionRunnerRuntimeOutboxProjection {
  readonly sequence: number;
  readonly outboxId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly eventType: string;
  readonly eventFingerprint: string;
  readonly createdAtUtc: string;
  readonly publishedAtUtc: string | null;
  readonly publishAttempts: number;
  readonly lastFailureCode: string | null;
}

export interface CollectionRunnerRuntimeStatusInput {
  readonly observedAtUtc: string;
  readonly configurationFingerprint: string;
  readonly buildFingerprint: string;
  readonly lockFingerprint: string;
  readonly bootIdentity: string;
  readonly processSessionId: string;
  readonly processStartedAtUtc: string;
  readonly activationId: string;
  readonly pilotState: string;
  readonly activationStopsAtUtc: string;
  readonly taskCounts: readonly CollectionRunnerRuntimeTaskCount[];
  readonly budget: CollectionRunnerRuntimeBudgetProjection;
  readonly currentLease: CollectionRunnerRuntimeLeaseProjection | null;
  readonly lastReceiptAtUtc: string | null;
  readonly lastCommitAtUtc: string | null;
  readonly clockOffsetMilliseconds: number | null;
  readonly outboxBacklog: number;
  readonly outbox: readonly CollectionRunnerRuntimeOutboxProjection[];
  readonly recoveryDisposition: string;
  readonly safety: CollectionRunnerRuntimeSafetyEvidence;
}

export interface CollectionRunnerRuntimeStatusReport
  extends CollectionRunnerRuntimeStatusInput {
  readonly remainingActivationMilliseconds: number;
  readonly health: CollectionRunnerRuntimeHealthStatus;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeStopCommand {
  readonly schemaVersion: "1.0";
  readonly commandId: string;
  readonly mode: CollectionRunnerRuntimeStopMode;
  readonly ownerId: string;
  readonly activationId: string;
  readonly expectedActivationAggregateVersion: number;
  readonly configurationFingerprint: string;
  readonly storeIdentity: string;
  readonly processSessionId: string;
  readonly reasonCode: string;
  readonly verifiedAtUtc: string;
  readonly authorizationExpiresAtUtc: string;
  readonly requestedAtUtc: string;
}

export interface CollectionRunnerRuntimeStopSignal {
  readonly commandId: string;
  readonly mode: CollectionRunnerRuntimeStopMode;
  readonly activationId: string;
  readonly configurationFingerprint: string;
  readonly storeIdentity: string;
  readonly processSessionId: string;
  readonly authorizationReference: string;
  readonly reasonCode: string;
  readonly requestedAtUtc: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeStopResult {
  readonly commandId: string;
  readonly mode: CollectionRunnerRuntimeStopMode;
  readonly barrierTripped: true;
  readonly durableStopRecorded: boolean;
  readonly processNotified: boolean;
  readonly receiptFingerprint: string | null;
  readonly reasonCode: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}
