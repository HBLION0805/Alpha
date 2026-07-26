import type {
  CollectionRunnerRehearsalOperationFinalVerificationReport,
  CollectionRunnerRehearsalOperationFinalVerificationRequest,
  CollectionRunnerRehearsalOperationPhaseCommandInput,
  CollectionRunnerRehearsalOperationPreflightReport,
  CollectionRunnerRehearsalOperationStatusReport,
} from "../../contracts";
import {
  EventContractCollectionRunnerRehearsalOperationPhaseGate,
  type CollectionRunnerRehearsalOperationControlRepository,
  type CollectionRunnerRehearsalOperationOwnershipPort,
  type CollectionRunnerRehearsalOperationReadinessPort,
  type CollectionRunnerRehearsalOperationStopPort,
  type CollectionRunnerRehearsalOperationValidationReceiptStagingPort,
} from "./EventContractCollectionRunnerRehearsalOperationControlEngine";
import {
  ClosedCollectionRunnerRehearsalOperationDurableTruthComposition,
  ClosedCollectionRunnerRehearsalOperationMutationComposition,
  FixedCollectionRunnerRehearsalOperationCapabilityInspection,
} from "./EventContractCollectionRunnerRehearsalOperationComposition";
import {
  CollectionRunnerRehearsalOperationFreshProcessVerifier,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";
import type {
  CollectionRunnerLocalOwnerVerifier,
} from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import type {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation";

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_RUNTIME_DISPOSITION =
  "NON_EXECUTABLE_PENDING_INDEPENDENT_MR3" as const;

export interface ClosedCollectionRunnerRehearsalOperationRuntimeDependencies {
  readonly registry: CollectionRunnerRehearsalOperationRegistry;
  readonly repository: CollectionRunnerRehearsalOperationControlRepository;
  readonly readiness: CollectionRunnerRehearsalOperationReadinessPort;
  readonly ownerVerifier: CollectionRunnerLocalOwnerVerifier;
  readonly stop: CollectionRunnerRehearsalOperationStopPort;
  readonly ownership: CollectionRunnerRehearsalOperationOwnershipPort;
  readonly mutation:
    ClosedCollectionRunnerRehearsalOperationMutationComposition;
  readonly durableTruth:
    ClosedCollectionRunnerRehearsalOperationDurableTruthComposition;
  readonly validationReceipts:
    CollectionRunnerRehearsalOperationValidationReceiptStagingPort;
  readonly finalVerifier:
    CollectionRunnerRehearsalOperationFreshProcessVerifier;
}

/**
 * C2's one closed production-shaped assembly.
 *
 * It deliberately exposes only read-only preflight/status/final verification.
 * No execute method or package command exists until an independent MR3 returns
 * an explicit GO decision for one exact network-free rehearsal.
 */
export class ClosedNonExecutableCollectionRunnerRehearsalOperationRuntime {
  public readonly disposition =
    COLLECTION_RUNNER_REHEARSAL_OPERATION_RUNTIME_DISPOSITION;
  readonly #gate: EventContractCollectionRunnerRehearsalOperationPhaseGate;
  readonly #finalVerifier:
    CollectionRunnerRehearsalOperationFreshProcessVerifier;

  public constructor(
    dependencies: ClosedCollectionRunnerRehearsalOperationRuntimeDependencies,
  ) {
    new FixedCollectionRunnerRehearsalOperationCapabilityInspection(
      dependencies.mutation,
      dependencies.durableTruth,
    );
    this.#gate = new EventContractCollectionRunnerRehearsalOperationPhaseGate({
      registry: dependencies.registry,
      repository: dependencies.repository,
      readiness: dependencies.readiness,
      verifier: dependencies.ownerVerifier,
      stop: dependencies.stop,
      ownership: dependencies.ownership,
      phase: dependencies.mutation,
      durableTruth: dependencies.durableTruth,
      validationReceipts: dependencies.validationReceipts,
    });
    this.#finalVerifier = dependencies.finalVerifier;
    Object.freeze(this);
  }

  public preflight(
    command: CollectionRunnerRehearsalOperationPhaseCommandInput,
  ): CollectionRunnerRehearsalOperationPreflightReport {
    return this.#gate.preflight(command);
  }

  public status(
    command: CollectionRunnerRehearsalOperationPhaseCommandInput,
  ): CollectionRunnerRehearsalOperationStatusReport {
    return this.#gate.status(command);
  }

  public verifyFinal(
    request: CollectionRunnerRehearsalOperationFinalVerificationRequest,
  ): CollectionRunnerRehearsalOperationFinalVerificationReport {
    return this.#finalVerifier.verify(request);
  }
}
