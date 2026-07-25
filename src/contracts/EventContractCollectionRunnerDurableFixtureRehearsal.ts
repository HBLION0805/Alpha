import type {
  CollectionRunnerPilotState,
  CollectionRunnerTaskState,
} from "./EventContractCollectionRunner";
import type {
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
} from "./EventContractCollectionRunnerRuntimeAssembly";

export const EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION =
  "1.0" as const;

export const COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE =
  "FIXTURE_REHEARSAL_V3" as const;

export enum DurableFixtureRehearsalLifecycleState {
  Planned = "PLANNED",
  Preparing = "PREPARING",
  Prepared = "PREPARED",
  Ready = "READY",
  Stepping = "STEPPING",
  Completed = "COMPLETED",
  Validated = "VALIDATED",
  EvidenceFrozen = "EVIDENCE_FROZEN",
  PreparationBlocked = "PREPARATION_BLOCKED",
  FailedClosed = "FAILED_CLOSED",
  RecoveryRequired = "RECOVERY_REQUIRED",
  VerificationFailed = "VERIFICATION_FAILED",
  Incomplete = "INCOMPLETE",
}

export enum DurableFixtureRehearsalPhase {
  Prepare = "PREPARE",
  Step = "STEP",
  Recover = "RECOVER",
  Validate = "VALIDATE",
  Freeze = "FREEZE",
  Package = "PACKAGE",
  Verify = "VERIFY",
  ArchiveInventory = "ARCHIVE_INVENTORY",
}

export enum DurableFixtureRehearsalFailureDisposition {
  PreparationBlocked = "PREPARATION_BLOCKED",
  FailedClosed = "FAILED_CLOSED",
  RecoveryRequired = "RECOVERY_REQUIRED",
  VerificationFailed = "VERIFICATION_FAILED",
  Incomplete = "INCOMPLETE",
}

export interface DurableFixtureRehearsalRegistryInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly buildFingerprint: string;
  readonly runnerFingerprint: string;
  readonly frozenPlanFingerprint: string;
  readonly catalogFingerprint: string;
  readonly providerFingerprint: string;
  readonly mappingFingerprint: string;
  readonly activationId: string;
  readonly taskSetFingerprint: string;
  readonly workspaceIdentity: string;
  readonly storeIdentity: string;
  readonly lifecycleState: DurableFixtureRehearsalLifecycleState;
  readonly lifecycleVersion: number;
  readonly nextInvocationOrdinal: number;
  readonly recoveryFingerprint: string;
  readonly maximumInvocations: number;
  readonly scenarioResultFingerprint: string | null;
  readonly executionPackageFingerprint: string | null;
  readonly nonAuthorityDeclaration: string;
  readonly createdAtUtc: string;
}

export interface DurableFixtureRehearsalRegistry
  extends DurableFixtureRehearsalRegistryInput {
  readonly schemaProfile:
    typeof COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalTransitionInput {
  readonly transitionId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly ordinal: number;
  readonly fromState: DurableFixtureRehearsalLifecycleState;
  readonly fromVersion: number;
  readonly toState: DurableFixtureRehearsalLifecycleState;
  readonly reasonCode: string;
  readonly occurredAtUtc: string;
}

export interface DurableFixtureRehearsalTransition
  extends DurableFixtureRehearsalTransitionInput {
  readonly toVersion: number;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalOperationClaimInput {
  readonly claimId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly phase: DurableFixtureRehearsalPhase;
  readonly invocationOrdinal: number | null;
  readonly expectedLifecycleVersion: number;
  readonly expectedRecoveryFingerprint: string;
  readonly requestFingerprint: string;
  readonly processSessionId: string;
  readonly bootIdentity: string;
  readonly ownerAuthorizationId: string | null;
  readonly claimedAtUtc: string;
}

export interface DurableFixtureRehearsalOperationClaim
  extends DurableFixtureRehearsalOperationClaimInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalInvocationReceiptInput {
  readonly receiptId: string;
  readonly claimId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly invocationOrdinal: number;
  readonly selectedAction: CollectionRunnerRuntimeAssemblyAction;
  readonly resultingPilotState: CollectionRunnerPilotState;
  readonly resultingTaskState: CollectionRunnerTaskState;
  readonly outcome: CollectionRunnerRuntimeStepOutcome;
  readonly terminalReportFingerprint: string;
  readonly durableTransitionFingerprint: string | null;
  readonly outboxChronologyFingerprint: string;
  readonly recoveryFingerprint: string;
  readonly observedAtUtc: string;
}

export interface DurableFixtureRehearsalInvocationReceipt
  extends DurableFixtureRehearsalInvocationReceiptInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalFailureReceiptInput {
  readonly failureId: string;
  readonly claimId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly phase: DurableFixtureRehearsalPhase;
  readonly disposition: DurableFixtureRehearsalFailureDisposition;
  readonly reasonCode: string;
  readonly terminalReportFingerprint: string | null;
  readonly observedRecoveryFingerprint: string;
  readonly occurredAtUtc: string;
}

export interface DurableFixtureRehearsalFailureReceipt
  extends DurableFixtureRehearsalFailureReceiptInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalEvidencePlanInput {
  readonly evidencePlanId: string;
  readonly freezeClaimId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly validationReceiptFingerprint: string;
  readonly validationSuiteFingerprint: string;
  readonly plannedBackupId: string;
  readonly plannedPackageId: string;
  readonly plannedEnvelopeId: string;
  readonly retentionPolicyVersion: string;
  readonly terminalFreezeFingerprint: string;
  readonly nonAuthorityDeclaration: string;
  readonly frozenAtUtc: string;
}

export interface DurableFixtureRehearsalEvidencePlan
  extends DurableFixtureRehearsalEvidencePlanInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalSnapshot {
  readonly registry: DurableFixtureRehearsalRegistry;
  readonly transitions: readonly DurableFixtureRehearsalTransition[];
  readonly claims: readonly DurableFixtureRehearsalOperationClaim[];
  readonly invocationReceipts:
    readonly DurableFixtureRehearsalInvocationReceipt[];
  readonly failureReceipts: readonly DurableFixtureRehearsalFailureReceipt[];
  readonly evidencePlan: DurableFixtureRehearsalEvidencePlan | null;
}

export interface DurableFixtureRehearsalVerificationResult {
  readonly valid: boolean;
  readonly issueCodes: readonly string[];
  readonly reconstructedLifecycleState:
    | DurableFixtureRehearsalLifecycleState
    | null;
  readonly reconstructedLifecycleVersion: number | null;
  readonly nextInvocationOrdinal: number | null;
  readonly deterministic: true;
  readonly fingerprint: string;
}
