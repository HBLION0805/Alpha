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
  FixedFreshProcessDualStoreOperationVerifier,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";
import {
  FixedQueryOnlyRehearsalOperationDurableTruth,
} from "./EventContractCollectionRunnerRehearsalOperationDurableObservation";
import {
  EventContractCollectionRunnerRehearsalOperationControlSqliteStore,
} from "../../repositories/EventContractCollectionRunnerRehearsalOperationControlSqliteStore";
import type {
  DurableFixtureRehearsalEnvelopeRoot,
  DurableFixtureRehearsalValidationAuthority,
} from "../event-contract-collection-runner-durable-fixture-rehearsal";
import type {
  CollectionRunnerRehearsalOperationMutationPhaseSet,
} from "./EventContractCollectionRunnerRehearsalOperationComposition";
import type {
  CollectionRunnerLocalOwnerVerifier,
} from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import type {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation";

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_RUNTIME_DISPOSITION =
  "NON_EXECUTABLE_PENDING_INDEPENDENT_MR3" as const;

export interface CollectionRunnerRehearsalOperationFinalVerifierPort {
  verify(
    request: CollectionRunnerRehearsalOperationFinalVerificationRequest,
  ): CollectionRunnerRehearsalOperationFinalVerificationReport;
}

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
    CollectionRunnerRehearsalOperationFinalVerifierPort;
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
    CollectionRunnerRehearsalOperationFinalVerifierPort;

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

export interface FixedClosedCollectionRunnerRehearsalOperationAuthority {
  readonly registry: CollectionRunnerRehearsalOperationRegistry;
  readonly controlRoot: string;
  readonly rehearsalRoot: string;
  readonly rehearsalStoreId: string;
  readonly evidenceRoots: readonly DurableFixtureRehearsalEnvelopeRoot[];
  readonly evidenceValidationAuthorities:
    readonly DurableFixtureRehearsalValidationAuthority[];
  readonly readiness: CollectionRunnerRehearsalOperationReadinessPort;
  readonly ownerVerifier: CollectionRunnerLocalOwnerVerifier;
  readonly stop: CollectionRunnerRehearsalOperationStopPort;
  readonly ownership: CollectionRunnerRehearsalOperationOwnershipPort;
  readonly mutationPhases:
    CollectionRunnerRehearsalOperationMutationPhaseSet;
  readonly validationReceipts:
    CollectionRunnerRehearsalOperationValidationReceiptStagingPort;
}

/**
 * C3 fixed non-executable composition root.
 *
 * The caller supplies the reviewed phase capabilities and local Owner
 * authorities, but cannot inject a Control repository, durable observer, or
 * final verifier. Those authorities are constructed here from fixed roots.
 */
export class FixedClosedNonExecutableCollectionRunnerRehearsalOperationRuntime {
  public readonly disposition =
    "NON_EXECUTABLE_PENDING_INDEPENDENT_MR4" as const;
  readonly #runtime: ClosedNonExecutableCollectionRunnerRehearsalOperationRuntime;
  readonly #control:
    EventContractCollectionRunnerRehearsalOperationControlSqliteStore;

  public constructor(
    authority: FixedClosedCollectionRunnerRehearsalOperationAuthority,
  ) {
    const control =
      EventContractCollectionRunnerRehearsalOperationControlSqliteStore
        .open(authority.controlRoot, { createIfMissing: false });
    try {
      const mutation =
        new ClosedCollectionRunnerRehearsalOperationMutationComposition(
          authority.mutationPhases,
        );
      const durableObserver =
        new FixedQueryOnlyRehearsalOperationDurableTruth(
          authority.rehearsalRoot,
          authority.rehearsalStoreId,
        );
      const durableTruth =
        new ClosedCollectionRunnerRehearsalOperationDurableTruthComposition({
          PREPARE: durableObserver,
          STEP: durableObserver,
          VALIDATE: durableObserver,
          FREEZE: durableObserver,
          PACKAGE: durableObserver,
        });
      const finalVerifier = new FixedFreshProcessDualStoreOperationVerifier(
        authority.registry,
        authority.evidenceRoots,
        authority.evidenceValidationAuthorities,
        authority.controlRoot,
        authority.rehearsalRoot,
        authority.rehearsalStoreId,
      );
      this.#runtime =
        new ClosedNonExecutableCollectionRunnerRehearsalOperationRuntime({
          registry: authority.registry,
          repository: control,
          readiness: authority.readiness,
          ownerVerifier: authority.ownerVerifier,
          stop: authority.stop,
          ownership: authority.ownership,
          mutation,
          durableTruth,
          validationReceipts: authority.validationReceipts,
          finalVerifier,
        });
      this.#control = control;
      Object.freeze(this);
    } catch (error) {
      control.close();
      throw error;
    }
  }

  public preflight(
    command: CollectionRunnerRehearsalOperationPhaseCommandInput,
  ): CollectionRunnerRehearsalOperationPreflightReport {
    return this.#runtime.preflight(command);
  }

  public status(
    command: CollectionRunnerRehearsalOperationPhaseCommandInput,
  ): CollectionRunnerRehearsalOperationStatusReport {
    return this.#runtime.status(command);
  }

  public verifyFinal(
    request: CollectionRunnerRehearsalOperationFinalVerificationRequest,
  ): CollectionRunnerRehearsalOperationFinalVerificationReport {
    return this.#runtime.verifyFinal(request);
  }

  public close(): void {
    this.#control.close();
  }
}
