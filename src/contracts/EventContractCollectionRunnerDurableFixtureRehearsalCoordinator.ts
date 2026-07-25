import type {
  CollectionRunnerPilotState,
  CollectionRunnerTaskState,
} from "./EventContractCollectionRunner";
import type {
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
} from "./EventContractCollectionRunnerRuntimeAssembly";
import type {
  DurableFixtureRehearsalFailureDisposition,
  DurableFixtureRehearsalPhase,
  DurableFixtureRehearsalRegistryInput,
} from "./EventContractCollectionRunnerDurableFixtureRehearsal";

export const EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION =
  "1.0" as const;

export interface DurableFixtureRehearsalPhaseRequest {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION;
  readonly registeredManifestId: string;
  readonly registeredPhaseId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly phase: DurableFixtureRehearsalPhase;
  readonly expectedLifecycleVersion: number;
  readonly expectedInvocationOrdinal: number | null;
  readonly expectedRecoveryFingerprint: string;
  readonly invocationId: string;
  readonly ownerAuthorizationId: string | null;
}

export interface DurableFixtureRehearsalProcessContext {
  readonly processSessionId: string;
  readonly bootIdentity: string;
  readonly observedAtUtc: string;
}

export interface DurableFixtureRehearsalPreparationEvidence {
  readonly registry: DurableFixtureRehearsalRegistryInput;
  readonly preparingReasonCode: string;
  readonly preparedReasonCode: string;
}

export interface DurableFixtureRehearsalStepEvidence {
  readonly selectedAction: CollectionRunnerRuntimeAssemblyAction;
  readonly resultingPilotState: CollectionRunnerPilotState;
  readonly resultingTaskState: CollectionRunnerTaskState;
  readonly outcome: CollectionRunnerRuntimeStepOutcome;
  readonly terminalReportFingerprint: string;
  readonly durableTransitionFingerprint: string | null;
  readonly outboxChronologyFingerprint: string;
  readonly recoveryFingerprint: string;
}

export enum DurableFixtureRehearsalReconciliationDisposition {
  ProvenSuccess = "PROVEN_SUCCESS",
  RecoveryRequired = "RECOVERY_REQUIRED",
  FailedClosed = "FAILED_CLOSED",
}

export interface DurableFixtureRehearsalReconciliationEvidence {
  readonly disposition: DurableFixtureRehearsalReconciliationDisposition;
  readonly reasonCode: string;
  readonly triggeringDisposition:
    DurableFixtureRehearsalFailureDisposition;
  readonly stepEvidence: DurableFixtureRehearsalStepEvidence | null;
}

export enum DurableFixtureRehearsalPhaseOutcome {
  Prepared = "PREPARED",
  StepCompleted = "STEP_COMPLETED",
  Recovered = "RECOVERED",
  RecoveryRequired = "RECOVERY_REQUIRED",
  FailedClosed = "FAILED_CLOSED",
  Replayed = "REPLAYED",
}

export interface DurableFixtureRehearsalPhaseResult {
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly phase: DurableFixtureRehearsalPhase;
  readonly invocationId: string;
  readonly outcome: DurableFixtureRehearsalPhaseOutcome;
  readonly lifecycleVersion: number;
  readonly nextInvocationOrdinal: number;
  readonly recoveryFingerprint: string;
  readonly receiptFingerprint: string | null;
  readonly deterministic: true;
  readonly fingerprint: string;
}
