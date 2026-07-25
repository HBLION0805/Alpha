import { createHash } from "node:crypto";

import {
  DurableFixtureRehearsalFailureDisposition,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  DurableFixtureRehearsalPhaseOutcome,
  DurableFixtureRehearsalReconciliationDisposition,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
  type DurableFixtureRehearsalFailureReceipt,
  type DurableFixtureRehearsalOperationClaim,
  type DurableFixtureRehearsalPhaseRequest,
  type DurableFixtureRehearsalPhaseResult,
  type DurableFixtureRehearsalPreparationEvidence,
  type DurableFixtureRehearsalProcessContext,
  type DurableFixtureRehearsalReconciliationEvidence,
  type DurableFixtureRehearsalRegistry,
  type DurableFixtureRehearsalRegistryInput,
  type DurableFixtureRehearsalSnapshot,
  type DurableFixtureRehearsalStepEvidence,
  type DurableFixtureRehearsalTransition,
} from "../../contracts";
import type {
  CollectionRunnerRuntimeAssemblyAction,
} from "../../contracts/EventContractCollectionRunnerRuntimeAssembly";
import type {
  DurableFixtureRehearsalRepository,
} from "../../repositories/SqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository";
import {
  createDurableFixtureRehearsalFailureReceipt,
  createDurableFixtureRehearsalInvocationReceipt,
  createDurableFixtureRehearsalOperationClaim,
  createDurableFixtureRehearsalRegistry,
  createDurableFixtureRehearsalTransition,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalEngine";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export enum DurableFixtureRehearsalCoordinatorErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  UnsupportedPhase = "UNSUPPORTED_PHASE",
  AuthorizationRejected = "AUTHORIZATION_REJECTED",
  StopTripped = "STOP_TRIPPED",
  StateConflict = "STATE_CONFLICT",
  ReplayConflict = "REPLAY_CONFLICT",
  ActionMismatch = "ACTION_MISMATCH",
  RecoveryRequired = "RECOVERY_REQUIRED",
  FailedClosed = "FAILED_CLOSED",
}

export class DurableFixtureRehearsalCoordinatorError extends Error {
  public constructor(
    public readonly code: DurableFixtureRehearsalCoordinatorErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "DurableFixtureRehearsalCoordinatorError";
  }
}

export interface DurableFixtureRehearsalStopPort {
  assertClear(): void;
}

export interface DurableFixtureRehearsalOwnerAuthorizationPort {
  verify(
    request: DurableFixtureRehearsalPhaseRequest,
    context: DurableFixtureRehearsalProcessContext,
  ): boolean;
}

export interface DurableFixtureRehearsalOwnershipLease {
  readonly context: DurableFixtureRehearsalProcessContext;
  releaseClean(): void;
  preserveAmbiguity(): void;
}

export interface DurableFixtureRehearsalOwnershipPort {
  acquire(request: DurableFixtureRehearsalPhaseRequest):
    DurableFixtureRehearsalOwnershipLease;
}

export interface DurableFixtureRehearsalPreparationPort {
  prepare(
    request: DurableFixtureRehearsalPhaseRequest,
    context: DurableFixtureRehearsalProcessContext,
  ): DurableFixtureRehearsalPreparationEvidence;
}

export interface DurableFixtureRehearsalStepPort {
  executeOne(
    request: DurableFixtureRehearsalPhaseRequest,
    claim: DurableFixtureRehearsalOperationClaim,
  ): DurableFixtureRehearsalStepEvidence;
}

export interface DurableFixtureRehearsalReconciliationPort {
  reconcile(
    request: DurableFixtureRehearsalPhaseRequest,
    snapshot: DurableFixtureRehearsalSnapshot,
    originalStepClaim: DurableFixtureRehearsalOperationClaim,
  ): DurableFixtureRehearsalReconciliationEvidence;
}

export interface DurableFixtureRehearsalScenarioPolicyPort {
  expectedAction(
    request: DurableFixtureRehearsalPhaseRequest,
  ): CollectionRunnerRuntimeAssemblyAction;
  isFinalOrdinal(
    request: DurableFixtureRehearsalPhaseRequest,
    registry: DurableFixtureRehearsalRegistry,
  ): boolean;
}

export interface DurableFixtureRehearsalRepositoryResolverPort {
  resolveExisting(
    request: DurableFixtureRehearsalPhaseRequest,
  ): DurableFixtureRehearsalRepository | null;
  resolvePrepared(
    request: DurableFixtureRehearsalPhaseRequest,
    evidence: DurableFixtureRehearsalPreparationEvidence,
  ): DurableFixtureRehearsalRepository;
}

export interface DurableFixtureRehearsalCoordinatorDependencies {
  readonly repositories: DurableFixtureRehearsalRepositoryResolverPort;
  readonly stop: DurableFixtureRehearsalStopPort;
  readonly ownerAuthorization: DurableFixtureRehearsalOwnerAuthorizationPort;
  readonly ownership: DurableFixtureRehearsalOwnershipPort;
  readonly preparation: DurableFixtureRehearsalPreparationPort;
  readonly step: DurableFixtureRehearsalStepPort;
  readonly reconciliation: DurableFixtureRehearsalReconciliationPort;
  readonly scenarioPolicy: DurableFixtureRehearsalScenarioPolicyPort;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function sha(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`;
}

function freeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function fail(
  code: DurableFixtureRehearsalCoordinatorErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new DurableFixtureRehearsalCoordinatorError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function validateRequest(request: DurableFixtureRehearsalPhaseRequest): void {
  const expected = [
    "schemaVersion", "registeredManifestId", "registeredPhaseId",
    "rehearsalId", "manifestFingerprint", "phase",
    "expectedLifecycleVersion", "expectedInvocationOrdinal",
    "expectedRecoveryFingerprint", "invocationId", "ownerAuthorizationId",
  ].sort();
  const actual = Object.keys(request).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index]) ||
    request.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION ||
    !ID.test(request.registeredManifestId) ||
    !ID.test(request.registeredPhaseId) ||
    !ID.test(request.rehearsalId) ||
    !FP.test(request.manifestFingerprint) ||
    !Object.values(DurableFixtureRehearsalPhase).includes(request.phase) ||
    !Number.isSafeInteger(request.expectedLifecycleVersion) ||
    request.expectedLifecycleVersion < 1 ||
    !FP.test(request.expectedRecoveryFingerprint) ||
    !ID.test(request.invocationId) ||
    (request.ownerAuthorizationId !== null &&
      !ID.test(request.ownerAuthorizationId))
  ) {
    fail(
      DurableFixtureRehearsalCoordinatorErrorCode.InvalidRequest,
      "Durable rehearsal phase request is invalid or undeclared.",
    );
  }
  const step = request.phase === DurableFixtureRehearsalPhase.Step;
  if (
    step !== (request.expectedInvocationOrdinal !== null) ||
    (
      request.expectedInvocationOrdinal !== null &&
      (
        !Number.isSafeInteger(request.expectedInvocationOrdinal) ||
        request.expectedInvocationOrdinal < 1
      )
    ) ||
    (
      request.phase === DurableFixtureRehearsalPhase.Recover
    ) !== (request.ownerAuthorizationId !== null)
  ) {
    fail(
      DurableFixtureRehearsalCoordinatorErrorCode.InvalidRequest,
      "Phase ordinal or Owner-authorization presence is invalid.",
    );
  }
  if (
    ![
      DurableFixtureRehearsalPhase.Prepare,
      DurableFixtureRehearsalPhase.Step,
      DurableFixtureRehearsalPhase.Recover,
    ].includes(request.phase)
  ) {
    fail(
      DurableFixtureRehearsalCoordinatorErrorCode.UnsupportedPhase,
      "T3B14-T3 permits only PREPARE, STEP, or RECOVER.",
    );
  }
}

function validateContext(context: DurableFixtureRehearsalProcessContext): void {
  if (
    Object.keys(context).sort().join(",") !==
      "bootIdentity,observedAtUtc,processSessionId" ||
    !ID.test(context.processSessionId) ||
    !ID.test(context.bootIdentity) ||
    !UTC.test(context.observedAtUtc) ||
    new Date(context.observedAtUtc).toISOString() !== context.observedAtUtc
  ) {
    fail(
      DurableFixtureRehearsalCoordinatorErrorCode.InvalidRequest,
      "Trusted process context is invalid.",
    );
  }
}

function registryInput(
  registry: DurableFixtureRehearsalRegistry,
  changes: Partial<DurableFixtureRehearsalRegistryInput>,
): DurableFixtureRehearsalRegistryInput {
  const {
    schemaProfile: _schemaProfile,
    deterministic: _deterministic,
    fingerprint: _fingerprint,
    ...input
  } = registry;
  return { ...input, ...changes };
}

function transition(
  registry: DurableFixtureRehearsalRegistry,
  ordinal: number,
  fromState: DurableFixtureRehearsalLifecycleState,
  fromVersion: number,
  toState: DurableFixtureRehearsalLifecycleState,
  reasonCode: string,
  occurredAtUtc: string,
): DurableFixtureRehearsalTransition {
  return createDurableFixtureRehearsalTransition({
    transitionId: `transition:${sha({
      rehearsalId: registry.rehearsalId,
      fromVersion,
      toState,
      reasonCode,
    }).slice(7, 39)}`,
    rehearsalId: registry.rehearsalId,
    manifestFingerprint: registry.manifestFingerprint,
    ordinal,
    fromState,
    fromVersion,
    toState,
    reasonCode,
    occurredAtUtc,
  });
}

function result(
  request: DurableFixtureRehearsalPhaseRequest,
  registry: DurableFixtureRehearsalRegistry,
  outcome: DurableFixtureRehearsalPhaseOutcome,
  receiptFingerprint: string | null,
): DurableFixtureRehearsalPhaseResult {
  const body = {
    rehearsalId: registry.rehearsalId,
    manifestFingerprint: registry.manifestFingerprint,
    phase: request.phase,
    invocationId: request.invocationId,
    outcome,
    lifecycleVersion: registry.lifecycleVersion,
    nextInvocationOrdinal: registry.nextInvocationOrdinal,
    recoveryFingerprint: registry.recoveryFingerprint,
    receiptFingerprint,
    deterministic: true as const,
  };
  return freeze({ ...body, fingerprint: sha(body) });
}

function validateStepEvidence(
  evidence: DurableFixtureRehearsalStepEvidence,
): void {
  const expected = [
    "selectedAction", "resultingPilotState", "resultingTaskState", "outcome",
    "terminalReportFingerprint", "durableTransitionFingerprint",
    "outboxChronologyFingerprint", "recoveryFingerprint",
  ].sort();
  if (
    Object.keys(evidence).sort().join(",") !== expected.join(",") ||
    !FP.test(evidence.terminalReportFingerprint) ||
    (
      evidence.durableTransitionFingerprint !== null &&
      !FP.test(evidence.durableTransitionFingerprint)
    ) ||
    !FP.test(evidence.outboxChronologyFingerprint) ||
    !FP.test(evidence.recoveryFingerprint)
  ) {
    fail(
      DurableFixtureRehearsalCoordinatorErrorCode.ActionMismatch,
      "Step evidence is malformed or incomplete.",
    );
  }
}

export class EventContractCollectionRunnerDurableFixtureRehearsalCoordinator {
  public constructor(
    private readonly dependencies:
      DurableFixtureRehearsalCoordinatorDependencies,
  ) {}

  public execute(
    request: DurableFixtureRehearsalPhaseRequest,
  ): DurableFixtureRehearsalPhaseResult {
    validateRequest(request);
    this.dependencies.stop.assertClear();
    const lease = this.dependencies.ownership.acquire(request);
    validateContext(lease.context);
    let mutationStarted = false;
    let clean = false;
    try {
      if (
        request.ownerAuthorizationId !== null &&
        !this.dependencies.ownerAuthorization.verify(request, lease.context)
      ) {
        fail(
          DurableFixtureRehearsalCoordinatorErrorCode.AuthorizationRejected,
          "Local Owner authorization is invalid or expired.",
        );
      }
      let phaseResult: DurableFixtureRehearsalPhaseResult;
      if (request.phase === DurableFixtureRehearsalPhase.Prepare) {
        mutationStarted = true;
        phaseResult = this.#prepare(request, lease.context);
      } else if (request.phase === DurableFixtureRehearsalPhase.Step) {
        phaseResult = this.#step(request, lease.context, () => {
          mutationStarted = true;
        });
      } else {
        phaseResult = this.#recover(request, lease.context, () => {
          mutationStarted = true;
        });
      }
      clean = true;
      lease.releaseClean();
      return phaseResult;
    } catch (error) {
      if (mutationStarted && !clean) lease.preserveAmbiguity();
      else if (!clean) lease.releaseClean();
      throw error;
    }
  }

  #prepare(
    request: DurableFixtureRehearsalPhaseRequest,
    context: DurableFixtureRehearsalProcessContext,
  ): DurableFixtureRehearsalPhaseResult {
    const existingRepository =
      this.dependencies.repositories.resolveExisting(request);
    const existing = existingRepository?.readSnapshot(request.rehearsalId) ??
      null;
    if (existing !== null) {
      if (
        existing.registry.manifestFingerprint !== request.manifestFingerprint ||
        request.expectedLifecycleVersion !== 1 ||
        request.expectedRecoveryFingerprint !==
          existing.registry.recoveryFingerprint
      ) {
        fail(
          DurableFixtureRehearsalCoordinatorErrorCode.ReplayConflict,
          "Changed preparation replay is forbidden.",
        );
      }
      return result(
        request,
        existing.registry,
        DurableFixtureRehearsalPhaseOutcome.Replayed,
        null,
      );
    }
    if (request.expectedLifecycleVersion !== 1) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.StateConflict,
        "Preparation must begin at lifecycle version 1.",
      );
    }
    this.dependencies.stop.assertClear();
    const evidence = this.dependencies.preparation.prepare(request, context);
    if (
      evidence.registry.rehearsalId !== request.rehearsalId ||
      evidence.registry.manifestFingerprint !== request.manifestFingerprint ||
      evidence.registry.lifecycleState !==
        DurableFixtureRehearsalLifecycleState.Prepared ||
      evidence.registry.lifecycleVersion !== 3 ||
      evidence.registry.nextInvocationOrdinal !== 1 ||
      evidence.registry.recoveryFingerprint !==
        request.expectedRecoveryFingerprint
    ) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.ActionMismatch,
        "Preparation evidence does not match the registered request.",
      );
    }
    const registry = createDurableFixtureRehearsalRegistry(evidence.registry);
    const planned = createDurableFixtureRehearsalRegistry({
      ...evidence.registry,
      lifecycleState: DurableFixtureRehearsalLifecycleState.Planned,
      lifecycleVersion: 1,
    });
    const preparing = transition(
      planned,
      0,
      DurableFixtureRehearsalLifecycleState.Planned,
      1,
      DurableFixtureRehearsalLifecycleState.Preparing,
      evidence.preparingReasonCode,
      context.observedAtUtc,
    );
    const prepared = transition(
      planned,
      0,
      DurableFixtureRehearsalLifecycleState.Preparing,
      2,
      DurableFixtureRehearsalLifecycleState.Prepared,
      evidence.preparedReasonCode,
      context.observedAtUtc,
    );
    this.dependencies.stop.assertClear();
    const repository = this.dependencies.repositories.resolvePrepared(
      request,
      evidence,
    );
    const snapshot = repository.initializePrepared(
      registry,
      [preparing, prepared],
    );
    return result(
      request,
      snapshot.registry,
      DurableFixtureRehearsalPhaseOutcome.Prepared,
      null,
    );
  }

  #step(
    request: DurableFixtureRehearsalPhaseRequest,
    context: DurableFixtureRehearsalProcessContext,
    mutation: () => void,
  ): DurableFixtureRehearsalPhaseResult {
    const repository = this.#requireRepository(request);
    const requestFingerprint = sha(request);
    const prior = repository.findClaimByRequestFingerprint(
      request.rehearsalId,
      requestFingerprint,
    );
    const initial = this.#boundSnapshot(request, repository);
    if (prior !== null) {
      const receipt = initial.invocationReceipts.find(
        ({ claimId }) => claimId === prior.claimId,
      );
      if (receipt !== undefined) {
        return result(
          request,
          initial.registry,
          DurableFixtureRehearsalPhaseOutcome.Replayed,
          receipt.fingerprint,
        );
      }
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.RecoveryRequired,
        "The exact step claim is unresolved and must be reconciled.",
      );
    }
    if (
      initial.registry.lifecycleVersion !== request.expectedLifecycleVersion ||
      initial.registry.nextInvocationOrdinal !==
        request.expectedInvocationOrdinal ||
      initial.registry.recoveryFingerprint !==
        request.expectedRecoveryFingerprint ||
      ![
        DurableFixtureRehearsalLifecycleState.Prepared,
        DurableFixtureRehearsalLifecycleState.Ready,
      ].includes(initial.registry.lifecycleState)
    ) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.StateConflict,
        "Step request disagrees with durable rehearsal state.",
      );
    }
    const claim = this.#claim(request, context, requestFingerprint);
    const entering: DurableFixtureRehearsalTransition[] = [];
    let state = initial.registry.lifecycleState;
    let version = initial.registry.lifecycleVersion;
    if (state === DurableFixtureRehearsalLifecycleState.Prepared) {
      const ready = transition(
        initial.registry,
        request.expectedInvocationOrdinal!,
        state,
        version,
        DurableFixtureRehearsalLifecycleState.Ready,
        "PREPARATION_VERIFIED",
        context.observedAtUtc,
      );
      entering.push(ready);
      state = ready.toState;
      version = ready.toVersion;
    }
    const stepping = transition(
      initial.registry,
      request.expectedInvocationOrdinal!,
      state,
      version,
      DurableFixtureRehearsalLifecycleState.Stepping,
      "FOREGROUND_ACTION_CLAIMED",
      context.observedAtUtc,
    );
    entering.push(stepping);
    const claimedRegistry = createDurableFixtureRehearsalRegistry(
      registryInput(initial.registry, {
        lifecycleState: DurableFixtureRehearsalLifecycleState.Stepping,
        lifecycleVersion: stepping.toVersion,
      }),
    );
    this.dependencies.stop.assertClear();
    mutation();
    repository.claimStep(
      initial.registry.lifecycleVersion,
      claim,
      entering,
      claimedRegistry,
    );
    this.dependencies.stop.assertClear();
    const evidence = this.dependencies.step.executeOne(request, claim);
    validateStepEvidence(evidence);
    if (
      evidence.selectedAction !==
        this.dependencies.scenarioPolicy.expectedAction(request)
    ) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.ActionMismatch,
        "The foreground action does not match the registered scenario.",
      );
    }
    return this.#completeStep(
      request,
      claim,
      claimedRegistry,
      evidence,
      context,
      false,
      repository,
    );
  }

  #recover(
    request: DurableFixtureRehearsalPhaseRequest,
    context: DurableFixtureRehearsalProcessContext,
    mutation: () => void,
  ): DurableFixtureRehearsalPhaseResult {
    const repository = this.#requireRepository(request);
    const requestFingerprint = sha(request);
    const prior = repository.findClaimByRequestFingerprint(
      request.rehearsalId,
      requestFingerprint,
    );
    const snapshot = this.#boundSnapshot(request, repository);
    if (prior !== null) {
      const failure = snapshot.failureReceipts.find(
        ({ claimId }) => claimId === prior.claimId,
      );
      if (failure !== undefined) {
        return result(
          request,
          snapshot.registry,
          DurableFixtureRehearsalPhaseOutcome.Replayed,
          failure.fingerprint,
        );
      }
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.RecoveryRequired,
        "The exact recovery claim remains unresolved.",
      );
    }
    if (
      snapshot.registry.lifecycleState !==
        DurableFixtureRehearsalLifecycleState.Stepping ||
      snapshot.registry.lifecycleVersion !== request.expectedLifecycleVersion ||
      snapshot.registry.recoveryFingerprint !==
        request.expectedRecoveryFingerprint
    ) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.StateConflict,
        "Recovery request disagrees with durable STEPPING truth.",
      );
    }
    const original = snapshot.claims.find(
      ({ phase, claimId }) =>
        phase === DurableFixtureRehearsalPhase.Step &&
        !snapshot.invocationReceipts.some(
          ({ claimId: settled }) => settled === claimId,
        ) &&
        !snapshot.failureReceipts.some(
          ({ claimId: settled }) => settled === claimId,
        ),
    );
    if (original === undefined) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.StateConflict,
        "Recovery found no exact unresolved STEP claim.",
      );
    }
    const recoveryClaim = this.#claim(request, context, requestFingerprint);
    this.dependencies.stop.assertClear();
    mutation();
    const claimed = repository.claimRecovery(
      snapshot.registry.lifecycleVersion,
      recoveryClaim,
    );
    const evidence = this.dependencies.reconciliation.reconcile(
      request,
      claimed,
      original,
    );
    this.#validateReconciliation(evidence);
    this.dependencies.stop.assertClear();
    if (
      evidence.disposition ===
      DurableFixtureRehearsalReconciliationDisposition.ProvenSuccess
    ) {
      validateStepEvidence(evidence.stepEvidence!);
      if (
        evidence.stepEvidence!.selectedAction !==
          this.dependencies.scenarioPolicy.expectedAction({
            ...request,
            phase: DurableFixtureRehearsalPhase.Step,
            expectedInvocationOrdinal: original.invocationOrdinal,
            ownerAuthorizationId: null,
          })
      ) {
        fail(
          DurableFixtureRehearsalCoordinatorErrorCode.ActionMismatch,
          "Recovered action does not match the registered scenario.",
        );
      }
      return this.#completeStep(
        request,
        original,
        snapshot.registry,
        evidence.stepEvidence!,
        context,
        true,
        repository,
        recoveryClaim,
        evidence,
      );
    }
    const terminal =
      evidence.disposition ===
      DurableFixtureRehearsalReconciliationDisposition.FailedClosed
        ? DurableFixtureRehearsalLifecycleState.FailedClosed
        : DurableFixtureRehearsalLifecycleState.RecoveryRequired;
    const originalFailure = this.#failure(
      original,
      evidence,
      context,
      "original",
    );
    const recoveryFailure = this.#failure(
      recoveryClaim,
      evidence,
      context,
      "recovery",
    );
    const failed = transition(
      snapshot.registry,
      original.invocationOrdinal!,
      DurableFixtureRehearsalLifecycleState.Stepping,
      snapshot.registry.lifecycleVersion,
      terminal,
      evidence.reasonCode,
      context.observedAtUtc,
    );
    const terminalRegistry = createDurableFixtureRehearsalRegistry(
      registryInput(snapshot.registry, {
        lifecycleState: terminal,
        lifecycleVersion: failed.toVersion,
      }),
    );
    const committed = repository.failRecovery(
      snapshot.registry.lifecycleVersion,
      [originalFailure, recoveryFailure],
      failed,
      terminalRegistry,
    );
    return result(
      request,
      committed.registry,
      terminal === DurableFixtureRehearsalLifecycleState.FailedClosed
        ? DurableFixtureRehearsalPhaseOutcome.FailedClosed
        : DurableFixtureRehearsalPhaseOutcome.RecoveryRequired,
      recoveryFailure.fingerprint,
    );
  }

  #completeStep(
    request: DurableFixtureRehearsalPhaseRequest,
    originalClaim: DurableFixtureRehearsalOperationClaim,
    steppingRegistry: DurableFixtureRehearsalRegistry,
    evidence: DurableFixtureRehearsalStepEvidence,
    context: DurableFixtureRehearsalProcessContext,
    recovered: boolean,
    repository: DurableFixtureRehearsalRepository,
    recoveryClaim?: DurableFixtureRehearsalOperationClaim,
    reconciliation?: DurableFixtureRehearsalReconciliationEvidence,
  ): DurableFixtureRehearsalPhaseResult {
    const ordinal = originalClaim.invocationOrdinal!;
    const invocation = createDurableFixtureRehearsalInvocationReceipt({
      receiptId: `receipt:${originalClaim.claimId.slice(-32)}`,
      claimId: originalClaim.claimId,
      rehearsalId: originalClaim.rehearsalId,
      manifestFingerprint: originalClaim.manifestFingerprint,
      invocationOrdinal: ordinal,
      ...evidence,
      observedAtUtc: context.observedAtUtc,
    });
    const ready = transition(
      steppingRegistry,
      ordinal,
      DurableFixtureRehearsalLifecycleState.Stepping,
      steppingRegistry.lifecycleVersion,
      DurableFixtureRehearsalLifecycleState.Ready,
      recovered ? "RECOVERED_EXACT_SUCCESS" : "FOREGROUND_ACTION_COMPLETED",
      context.observedAtUtc,
    );
    const final = this.dependencies.scenarioPolicy.isFinalOrdinal(
      {
        ...request,
        phase: DurableFixtureRehearsalPhase.Step,
        expectedInvocationOrdinal: ordinal,
        ownerAuthorizationId: null,
      },
      steppingRegistry,
    );
    const completed = final
      ? transition(
          steppingRegistry,
          ordinal,
          DurableFixtureRehearsalLifecycleState.Ready,
          ready.toVersion,
          DurableFixtureRehearsalLifecycleState.Completed,
          "REHEARSAL_ACTIONS_COMPLETED",
          context.observedAtUtc,
        )
      : null;
    const last = completed ?? ready;
    const nextRegistry = createDurableFixtureRehearsalRegistry(
      registryInput(steppingRegistry, {
        lifecycleState: last.toState,
        lifecycleVersion: last.toVersion,
        nextInvocationOrdinal: ordinal + 1,
        recoveryFingerprint: evidence.recoveryFingerprint,
      }),
    );
    let committed: DurableFixtureRehearsalSnapshot;
    let receiptFingerprint = invocation.fingerprint;
    if (recovered) {
      const recoveryReceipt = this.#failure(
        recoveryClaim!,
        reconciliation!,
        context,
        "recovered",
      );
      committed = repository.completeRecovery(
        steppingRegistry.lifecycleVersion,
        invocation,
        recoveryReceipt,
        completed === null ? [ready] : [ready, completed],
        nextRegistry,
      );
      receiptFingerprint = recoveryReceipt.fingerprint;
    } else {
      committed = repository.completeStep(
        steppingRegistry.lifecycleVersion,
        invocation,
        completed === null ? [ready] : [ready, completed],
        nextRegistry,
      );
    }
    return result(
      request,
      committed.registry,
      recovered
        ? DurableFixtureRehearsalPhaseOutcome.Recovered
        : DurableFixtureRehearsalPhaseOutcome.StepCompleted,
      receiptFingerprint,
    );
  }

  #claim(
    request: DurableFixtureRehearsalPhaseRequest,
    context: DurableFixtureRehearsalProcessContext,
    requestFingerprint: string,
  ): DurableFixtureRehearsalOperationClaim {
    return createDurableFixtureRehearsalOperationClaim({
      claimId: `claim:${sha({
        rehearsalId: request.rehearsalId,
        invocationId: request.invocationId,
        phase: request.phase,
      }).slice(7, 39)}`,
      rehearsalId: request.rehearsalId,
      manifestFingerprint: request.manifestFingerprint,
      phase: request.phase,
      invocationOrdinal: request.expectedInvocationOrdinal,
      expectedLifecycleVersion: request.expectedLifecycleVersion,
      expectedRecoveryFingerprint: request.expectedRecoveryFingerprint,
      requestFingerprint,
      processSessionId: context.processSessionId,
      bootIdentity: context.bootIdentity,
      ownerAuthorizationId: request.ownerAuthorizationId,
      claimedAtUtc: context.observedAtUtc,
    });
  }

  #failure(
    claim: DurableFixtureRehearsalOperationClaim,
    evidence: DurableFixtureRehearsalReconciliationEvidence,
    context: DurableFixtureRehearsalProcessContext,
    suffix: string,
  ): DurableFixtureRehearsalFailureReceipt {
    return createDurableFixtureRehearsalFailureReceipt({
      failureId: `failure:${sha({
        claimId: claim.claimId,
        reasonCode: evidence.reasonCode,
        suffix,
      }).slice(7, 39)}`,
      claimId: claim.claimId,
      rehearsalId: claim.rehearsalId,
      manifestFingerprint: claim.manifestFingerprint,
      phase: claim.phase,
      disposition: evidence.triggeringDisposition,
      reasonCode: evidence.reasonCode,
      terminalReportFingerprint:
        evidence.stepEvidence?.terminalReportFingerprint ?? null,
      observedRecoveryFingerprint:
        evidence.stepEvidence?.recoveryFingerprint ??
        claim.expectedRecoveryFingerprint,
      occurredAtUtc: context.observedAtUtc,
    });
  }

  #boundSnapshot(
    request: DurableFixtureRehearsalPhaseRequest,
    repository: DurableFixtureRehearsalRepository,
  ): DurableFixtureRehearsalSnapshot {
    const snapshot = repository.readSnapshot(
      request.rehearsalId,
    );
    if (
      snapshot === null ||
      snapshot.registry.manifestFingerprint !== request.manifestFingerprint
    ) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.StateConflict,
        "Durable rehearsal identity is missing or changed.",
      );
    }
    return snapshot;
  }

  #requireRepository(
    request: DurableFixtureRehearsalPhaseRequest,
  ): DurableFixtureRehearsalRepository {
    const repository = this.dependencies.repositories.resolveExisting(request);
    if (repository === null) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.StateConflict,
        "Registered durable rehearsal store is unavailable.",
      );
    }
    return repository;
  }

  #validateReconciliation(
    evidence: DurableFixtureRehearsalReconciliationEvidence,
  ): void {
    const expected = [
      "disposition", "reasonCode", "triggeringDisposition", "stepEvidence",
    ].sort();
    if (
      Object.keys(evidence).sort().join(",") !== expected.join(",") ||
      !Object.values(DurableFixtureRehearsalReconciliationDisposition)
        .includes(evidence.disposition) ||
      !Object.values(DurableFixtureRehearsalFailureDisposition)
        .includes(evidence.triggeringDisposition) ||
      !ID.test(evidence.reasonCode) ||
      (
        evidence.disposition ===
        DurableFixtureRehearsalReconciliationDisposition.ProvenSuccess
      ) !== (evidence.stepEvidence !== null)
      ||
      (
        evidence.disposition ===
          DurableFixtureRehearsalReconciliationDisposition.FailedClosed
          ? evidence.triggeringDisposition !==
            DurableFixtureRehearsalFailureDisposition.FailedClosed
          : evidence.triggeringDisposition !==
            DurableFixtureRehearsalFailureDisposition.RecoveryRequired
      )
    ) {
      fail(
        DurableFixtureRehearsalCoordinatorErrorCode.ActionMismatch,
        "Recovery reconciliation evidence is invalid.",
      );
    }
  }
}
