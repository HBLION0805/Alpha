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
  readonly maximumWorkers: 0;
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
