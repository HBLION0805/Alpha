import type {
  CollectionRunnerDefinition,
  CollectionRunnerPilotState,
  CollectionRunnerPilotActivation,
  CollectionRunnerScheduledTask,
  CollectionRunnerTaskState,
} from "./EventContractCollectionRunner";
import type { EventContractSourceSnapshot } from "./EventContractSource";
import type {
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
} from "./EventContractCollectionRunnerRuntimeAssembly";
import type {
  CollectionRunnerRuntimeConfiguration,
  CollectionRunnerRuntimePaths,
} from "./EventContractCollectionRunnerRuntime";

export const EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION =
  "1.0" as const;
export const COLLECTION_RUNNER_REHEARSAL_MAX_INVOCATIONS = 16;
export const COLLECTION_RUNNER_REHEARSAL_MAX_OUTBOX_RECORDS = 64;
export const COLLECTION_RUNNER_REHEARSAL_MAX_JSON_BYTES = 64 * 1024;
export const COLLECTION_RUNNER_REHEARSAL_MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
export const COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION =
  "FIXTURE_REHEARSAL_ONLY_NOT_LIVE_DATA_DATASET_RECOMMENDATION_OR_TRADING_AUTHORITY" as const;

export enum CollectionRunnerRehearsalLifecycleState {
  Planned = "PLANNED",
  Prepared = "PREPARED",
  Ready = "READY",
  Stepping = "STEPPING",
  Completed = "COMPLETED",
  Packaged = "PACKAGED",
  Verified = "VERIFIED",
  Archived = "ARCHIVED",
  PreparationBlocked = "PREPARATION_BLOCKED",
  FailedClosed = "FAILED_CLOSED",
  RecoveryRequired = "RECOVERY_REQUIRED",
  VerificationFailed = "VERIFICATION_FAILED",
}

export enum CollectionRunnerRehearsalVerificationDisposition {
  Pass = "PASS",
  FailClosed = "FAIL_CLOSED",
  Incomplete = "INCOMPLETE",
}

export enum CollectionRunnerRehearsalFaultScenario {
  None = "NONE",
  StopBeforeT6 = "STOP_BEFORE_T6",
  CrashAfterLease = "CRASH_AFTER_LEASE",
  CrashAfterAttemptClaim = "CRASH_AFTER_ATTEMPT_CLAIM",
  CrashDuringValidation = "CRASH_DURING_VALIDATION",
  CrashAfterT10 = "CRASH_AFTER_T10_BEFORE_REPORT",
  StaleOwnership = "STALE_OWNERSHIP_AUTHENTICATED_QUARANTINE",
  ExactReplay = "EXACT_REPLAY",
  ChangedReplay = "CHANGED_REPLAY_REJECTION",
}

export enum CollectionRunnerRehearsalScenarioPhase {
  DueTransition = "DUE_TRANSITION",
  FixtureWorker = "FIXTURE_WORKER",
  TerminalObservation = "TERMINAL_OBSERVATION",
  Stop = "STOP",
  Recovery = "RECOVERY",
}

export interface CollectionRunnerRehearsalExpectedInvocation {
  readonly ordinal: number;
  readonly action: CollectionRunnerRuntimeAssemblyAction;
  readonly resultingTaskState: CollectionRunnerTaskState;
}

export interface CollectionRunnerRehearsalManifestInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly scenarioId: string;
  readonly scenarioPurpose: string;
  readonly ownerApprovalId: string;
  readonly ownerApprovalFingerprint: string;
  readonly ownerApprovalExpiresAtUtc: string;
  readonly buildFingerprint: string;
  readonly runnerFingerprint: string;
  readonly frozenPlanFingerprint: string;
  readonly fixtureCatalogFingerprint: string;
  readonly fixturePackageFingerprint: string;
  readonly providerFingerprint: string;
  readonly mappingFingerprint: string;
  readonly syntheticActivationFingerprint: string;
  readonly syntheticTaskFingerprint: string;
  readonly runtimeConfigurationTemplateFingerprint: string;
  readonly expectedInvocations: readonly CollectionRunnerRehearsalExpectedInvocation[];
  readonly expectedPilotState: CollectionRunnerPilotState;
  readonly expectedTaskState: CollectionRunnerTaskState;
  readonly expectedOutboxRecordIds: readonly string[];
  readonly maximumInvocations: number;
  readonly faultScenario: CollectionRunnerRehearsalFaultScenario;
  readonly evidencePackagePolicyVersion: string;
  readonly retentionPolicyVersion: string;
  readonly nonAuthorityDeclaration:
    typeof COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION;
}

export interface CollectionRunnerRehearsalManifest
  extends CollectionRunnerRehearsalManifestInput {
  readonly rehearsalId: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalLifecycleTransitionInput {
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly ordinal: number;
  readonly fromState: CollectionRunnerRehearsalLifecycleState;
  readonly fromVersion: number;
  readonly toState: CollectionRunnerRehearsalLifecycleState;
  readonly reasonCode: string;
}

export interface CollectionRunnerRehearsalLifecycleTransition
  extends CollectionRunnerRehearsalLifecycleTransitionInput {
  readonly toVersion: number;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalPreparationReceiptInput {
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly fixtureCatalogEntryFingerprint: string;
  readonly runtimeConfigurationFingerprint: string;
  readonly seededStoreFingerprint: string;
  readonly preparationTransitionFingerprint: string;
  readonly workspaceIdentity: string;
  readonly storePathIdentity: string;
  readonly schemaCatalogFingerprint: string;
}

export interface CollectionRunnerRehearsalPreparationReceipt
  extends CollectionRunnerRehearsalPreparationReceiptInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalInvocationReceiptInput {
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly ordinal: number;
  readonly expectedStateVersion: number;
  readonly recoveryFingerprint: string;
  readonly selectedAction: CollectionRunnerRuntimeAssemblyAction;
  readonly resultingTaskState: CollectionRunnerTaskState;
  readonly outcome: CollectionRunnerRuntimeStepOutcome;
  readonly durableTransitionFingerprint: string | null;
  readonly terminalReportFingerprint: string;
  readonly processSessionId: string;
  readonly bootIdentity: string;
  readonly observedAtUtc: string;
  readonly elapsedMonotonicMilliseconds: number;
}

export interface CollectionRunnerRehearsalInvocationReceipt
  extends CollectionRunnerRehearsalInvocationReceiptInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOutboxIdentity {
  readonly recordId: string;
  readonly ordinal: number;
  readonly occurredAtUtc: string;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalPackageInventoryEntry {
  readonly relativePath: string;
  readonly byteLength: number;
  readonly digest: string;
}

export interface CollectionRunnerRehearsalTerminalSummary {
  readonly pilotState: CollectionRunnerPilotState;
  readonly taskState: CollectionRunnerTaskState;
  readonly budgetFingerprint: string;
  readonly leaseOpen: boolean;
  readonly attemptOpen: boolean;
}

export interface CollectionRunnerRehearsalEvidencePackageInput {
  readonly manifest: CollectionRunnerRehearsalManifest;
  readonly fixtureCatalogEntryFingerprint: string;
  readonly preparationReceipt: CollectionRunnerRehearsalPreparationReceipt;
  readonly lifecycleTransitions: readonly CollectionRunnerRehearsalLifecycleTransition[];
  readonly invocationReceipts: readonly CollectionRunnerRehearsalInvocationReceipt[];
  readonly terminalReportFingerprints: readonly string[];
  readonly recoveryReportFingerprints: readonly string[];
  readonly ownershipReceiptIds: readonly string[];
  readonly terminalSummary: CollectionRunnerRehearsalTerminalSummary;
  readonly outboxRecords: readonly CollectionRunnerRehearsalOutboxIdentity[];
  readonly sqliteQuickCheckPassed: boolean;
  readonly sqliteIntegrityCheckPassed: boolean;
  readonly backupManifestFingerprint: string;
  readonly backupDigest: string;
  readonly validationSuiteFingerprint: string;
  readonly validationPassed: boolean;
  readonly archiveDisposition: string;
  readonly inventory: readonly CollectionRunnerRehearsalPackageInventoryEntry[];
  readonly packageBytesExcludingBackup: number;
  readonly workspaceIdentity: string;
  readonly storeIdentity: string;
  readonly packageCreatedAtUtc: string;
  readonly nonAuthorityDeclaration:
    typeof COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION;
}

export interface CollectionRunnerRehearsalEvidencePackage
  extends CollectionRunnerRehearsalEvidencePackageInput {
  readonly scenarioResultFingerprint: string;
  readonly executionPackageFingerprint: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalVerificationResult {
  readonly disposition: CollectionRunnerRehearsalVerificationDisposition;
  readonly issueCodes: readonly string[];
  readonly scenarioResultFingerprint: string | null;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalFixtureCatalogEntry {
  readonly catalogVersion: string;
  readonly catalogEntryId: string;
  readonly catalogFingerprint: string;
  readonly fixturePackageFingerprint: string;
  readonly fixtureAdapterIdentity: string;
  readonly fixtureAdapterVersion: string;
  readonly sourceRecordId: string;
  readonly payloadFingerprint: string;
  readonly rawPayloadBytes: number;
  readonly recordCount: number;
  readonly runnerDefinition: CollectionRunnerDefinition;
  readonly pilotActivation: CollectionRunnerPilotActivation;
  readonly scheduledTasks: readonly CollectionRunnerScheduledTask[];
  readonly sourceSnapshot: EventContractSourceSnapshot;
  readonly expectedTaskTransitions: readonly CollectionRunnerTaskState[];
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalPreparationRequest {
  readonly manifest: CollectionRunnerRehearsalManifest;
  readonly catalogEntryId: string;
  readonly allowedRootId: string;
  readonly preparedAtUtc: string;
}

export interface CollectionRunnerRehearsalWorkspace {
  readonly allowedRootId: string;
  readonly workspaceRoot: string;
  readonly runtimeControlRoot: string;
  readonly sqliteRoot: string;
  readonly workspaceIdentity: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalPreparationResult {
  readonly manifest: CollectionRunnerRehearsalManifest;
  readonly catalogEntry: CollectionRunnerRehearsalFixtureCatalogEntry;
  readonly workspace: CollectionRunnerRehearsalWorkspace;
  readonly runtimeConfiguration: CollectionRunnerRuntimeConfiguration;
  readonly runtimePaths: CollectionRunnerRuntimePaths;
  readonly lifecycleTransition: CollectionRunnerRehearsalLifecycleTransition;
  readonly preparationReceipt: CollectionRunnerRehearsalPreparationReceipt;
  readonly replayed: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalStepRequest {
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly expectedInvocationOrdinal: number;
  readonly expectedLifecycleVersion: number;
  readonly expectedRecoveryFingerprint: string;
  readonly scenarioPhase: CollectionRunnerRehearsalScenarioPhase;
  readonly invocationId: string;
  readonly maximumTasks: number;
  readonly ownerAuthorizationId: string | null;
}

export interface CollectionRunnerRehearsalDurableStateObservation {
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly invocationOrdinal: number;
  readonly pilotState: CollectionRunnerPilotState;
  readonly taskState: CollectionRunnerTaskState;
  readonly recoveryFingerprint: string;
  readonly stateVersion: number;
  readonly observedAtUtc: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalStepResult {
  readonly request: CollectionRunnerRehearsalStepRequest;
  readonly terminalReport: import("./EventContractCollectionRunnerRuntimeAssembly").CollectionRunnerRuntimeTerminalReport;
  readonly durableState: CollectionRunnerRehearsalDurableStateObservation;
  readonly invocationReceipt: CollectionRunnerRehearsalInvocationReceipt;
  readonly lifecycleTransitions: readonly CollectionRunnerRehearsalLifecycleTransition[];
  readonly resultingLifecycleState: CollectionRunnerRehearsalLifecycleState;
  readonly resultingLifecycleVersion: number;
  readonly replayed: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}
