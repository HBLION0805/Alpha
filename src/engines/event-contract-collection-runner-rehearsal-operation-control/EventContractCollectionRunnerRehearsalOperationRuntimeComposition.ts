import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { execPath } from "node:process";

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
  type CollectionRunnerRehearsalOperationPhaseAuthorityPort,
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
import {
  CollectionRunnerRehearsalOperationRootPurpose,
} from "../../contracts";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function sha(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonical(value), "utf8")
    .digest("hex")}`;
}

function fileDigest(path: string): string {
  return `sha256:${createHash("sha256")
    .update(readFileSync(path))
    .digest("hex")}`;
}

const REAL_PHASE_AUTHORITY_FILES = Object.freeze([
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalPreparationAdapter.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalCoordinator.ts",
  "src/engines/event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence.ts",
  "src/engines/event-contract-collection-runner-rehearsal-operation-control/EventContractCollectionRunnerRehearsalOperationVerification.ts",
  "scripts/network-disabled-bootstrap.cjs",
  "scripts/network-disabled-python/sitecustomize.py",
] as const);

/**
 * Rebuilds one complete phase authority fingerprint at every phase boundary.
 * It binds all six registered roots plus the reviewed real PREPARE/STEP/
 * VALIDATE/FREEZE/PACKAGE source files, Node, guards, mutation composition,
 * and query-only observer.
 */
export class FixedDigestBoundOperationPhaseAuthority
  implements CollectionRunnerRehearsalOperationPhaseAuthorityPort {
  public constructor(
    private readonly registry: CollectionRunnerRehearsalOperationRegistry,
    private readonly mutation:
      ClosedCollectionRunnerRehearsalOperationMutationComposition,
    private readonly durableTruth:
      ClosedCollectionRunnerRehearsalOperationDurableTruthComposition,
  ) {}

  public inspect(
    manifest: import("../../contracts")
      .CollectionRunnerRehearsalOperationManifest,
    command: import("../../contracts")
      .CollectionRunnerRehearsalOperationPhaseCommand,
  ): string {
    if (
      command.operationId !== manifest.operationId ||
      command.manifestFingerprint !== manifest.fingerprint
    ) throw new Error("Phase authority command binding is invalid.");
    const roots = manifest.proposal.rootBindings.map((binding) => {
      const registration = this.registry.getRoot(binding.rootId);
      if (
        registration === null ||
        registration.purpose !== binding.purpose ||
        registration.fingerprint !== binding.rootFingerprint ||
        realpathSync(registration.canonicalPath) !==
          registration.canonicalPath
      ) throw new Error("Registered phase root authority changed.");
      return {
        purpose: binding.purpose,
        rootId: binding.rootId,
        registrationFingerprint: registration.fingerprint,
        filesystemIdentityFingerprint:
          registration.filesystemIdentityFingerprint,
        canonicalPath: registration.canonicalPath,
      };
    }).sort((left, right) => left.purpose.localeCompare(right.purpose));
    const repository = roots.find(({ purpose }) =>
      purpose === CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository
    );
    if (repository === undefined || roots.length !== 6) {
      throw new Error("Complete registered phase roots are unavailable.");
    }
    const files = REAL_PHASE_AUTHORITY_FILES.map((relativePath) => {
      const path = realpathSync(join(repository.canonicalPath, relativePath));
      return { relativePath, path, fingerprint: fileDigest(path) };
    });
    const node = realpathSync(execPath);
    return sha({
      policy: "FIXED_REAL_DURABLE_REHEARSAL_PHASE_AUTHORITY_V1",
      manifestFingerprint: manifest.fingerprint,
      commandFingerprint: command.fingerprint,
      roots,
      files,
      node: { path: node, fingerprint: fileDigest(node) },
      mutationCompositionFingerprint: this.mutation.fingerprint,
      durableTruthCompositionFingerprint: this.durableTruth.fingerprint,
    });
  }
}

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
  readonly phaseAuthority?:
    CollectionRunnerRehearsalOperationPhaseAuthorityPort;
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
      ...(dependencies.phaseAuthority === undefined
        ? {}
        : { phaseAuthority: dependencies.phaseAuthority }),
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
    "NON_EXECUTABLE_PENDING_INDEPENDENT_MR5" as const;
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
          phaseAuthority: new FixedDigestBoundOperationPhaseAuthority(
            authority.registry,
            mutation,
            durableTruth,
          ),
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
