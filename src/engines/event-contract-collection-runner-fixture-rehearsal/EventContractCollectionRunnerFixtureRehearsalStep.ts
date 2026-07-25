import { createHash } from "node:crypto";

import {
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalLifecycleState,
  CollectionRunnerRehearsalScenarioPhase,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
  type CollectionRunnerRehearsalDurableStateObservation,
  type CollectionRunnerRehearsalInvocationReceipt,
  type CollectionRunnerRehearsalLifecycleTransition,
  type CollectionRunnerRehearsalPreparationResult,
  type CollectionRunnerRehearsalStepRequest,
  type CollectionRunnerRehearsalStepResult,
  type CollectionRunnerRuntimeForegroundStepRequest,
  type CollectionRunnerRuntimeTerminalReport,
} from "../../contracts";
import { createCollectionRunnerRuntimeTerminalReport } from "../event-contract-collection-runner-runtime";
import {
  createCollectionRunnerRehearsalInvocationReceipt,
  createCollectionRunnerRehearsalLifecycleTransition,
  verifyCollectionRunnerRehearsalManifest,
} from "./EventContractCollectionRunnerFixtureRehearsalEngine";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export enum CollectionRunnerRehearsalStepErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  StateConflict = "STATE_CONFLICT",
  ReplayConflict = "REPLAY_CONFLICT",
  AuthorizationRejected = "AUTHORIZATION_REJECTED",
  ForegroundMismatch = "FOREGROUND_MISMATCH",
  DurableStateMismatch = "DURABLE_STATE_MISMATCH",
  RecoveryRequired = "RECOVERY_REQUIRED",
}

export class CollectionRunnerRehearsalStepError extends Error {
  public constructor(
    public readonly code: CollectionRunnerRehearsalStepErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CollectionRunnerRehearsalStepError";
  }
}

export interface CollectionRunnerRehearsalForegroundStepPort {
  run(request: CollectionRunnerRuntimeForegroundStepRequest): CollectionRunnerRuntimeTerminalReport;
}

export interface CollectionRunnerRehearsalDurableStatePort {
  readAfterStep(
    request: CollectionRunnerRehearsalStepRequest,
    terminalReport: CollectionRunnerRuntimeTerminalReport,
  ): CollectionRunnerRehearsalDurableStateObservation;
}

export interface CollectionRunnerRehearsalOwnerAuthorizationPort {
  verifyUnexpiredLocalOwnerAuthorization(
    request: CollectionRunnerRehearsalStepRequest,
  ): boolean;
}

export interface CollectionRunnerRehearsalStepLedgerSnapshot {
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly lifecycleState: CollectionRunnerRehearsalLifecycleState;
  readonly lifecycleVersion: number;
  readonly nextInvocationOrdinal: number;
  readonly recoveryFingerprint: string;
}

export interface CollectionRunnerRehearsalStepLedgerPort {
  read(rehearsalId: string): CollectionRunnerRehearsalStepLedgerSnapshot | null;
  findResult(rehearsalId: string, ordinal: number): CollectionRunnerRehearsalStepResult | null;
  commitSuccess(
    expectedLifecycleVersion: number,
    result: CollectionRunnerRehearsalStepResult,
  ): CollectionRunnerRehearsalStepResult;
  commitFailure(
    expectedLifecycleVersion: number,
    transitions: readonly CollectionRunnerRehearsalLifecycleTransition[],
    terminalReport: CollectionRunnerRuntimeTerminalReport,
  ): void;
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

function fail(code: CollectionRunnerRehearsalStepErrorCode, message: string): never {
  throw new CollectionRunnerRehearsalStepError(code, message);
}

function validateRequest(request: CollectionRunnerRehearsalStepRequest): void {
  const expected = [
    "rehearsalId", "manifestFingerprint", "expectedInvocationOrdinal",
    "expectedLifecycleVersion", "expectedRecoveryFingerprint", "scenarioPhase",
    "invocationId", "maximumTasks", "ownerAuthorizationId",
  ].sort();
  const actual = Object.keys(request).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "Step request does not match the closed contract.");
  }
  if (
    !ID.test(request.rehearsalId) ||
    !FP.test(request.manifestFingerprint) ||
    !Number.isSafeInteger(request.expectedInvocationOrdinal) ||
    request.expectedInvocationOrdinal < 1 ||
    !Number.isSafeInteger(request.expectedLifecycleVersion) ||
    request.expectedLifecycleVersion < 1 ||
    !FP.test(request.expectedRecoveryFingerprint) ||
    !Object.values(CollectionRunnerRehearsalScenarioPhase).includes(request.scenarioPhase) ||
    !ID.test(request.invocationId) ||
    !Number.isSafeInteger(request.maximumTasks) ||
    request.maximumTasks < 1 ||
    request.maximumTasks > 10_000 ||
    (request.ownerAuthorizationId !== null && !ID.test(request.ownerAuthorizationId))
  ) fail(CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "Step request is invalid.");
  const authorizationRequired =
    request.scenarioPhase === CollectionRunnerRehearsalScenarioPhase.Stop ||
    request.scenarioPhase === CollectionRunnerRehearsalScenarioPhase.Recovery;
  if (authorizationRequired !== (request.ownerAuthorizationId !== null)) {
    fail(CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "Owner authorization presence does not match the scenario phase.");
  }
}

function phaseMatches(
  phase: CollectionRunnerRehearsalScenarioPhase,
  action: CollectionRunnerRuntimeAssemblyAction,
): boolean {
  if (phase === CollectionRunnerRehearsalScenarioPhase.DueTransition) {
    return action === CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue ||
      action === CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed;
  }
  if (phase === CollectionRunnerRehearsalScenarioPhase.FixtureWorker) {
    return action === CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask;
  }
  if (phase === CollectionRunnerRehearsalScenarioPhase.TerminalObservation) {
    return action === CollectionRunnerRuntimeAssemblyAction.CompleteAndExit ||
      action === CollectionRunnerRuntimeAssemblyAction.WaitAndExit;
  }
  if (phase === CollectionRunnerRehearsalScenarioPhase.Stop) {
    return action === CollectionRunnerRuntimeAssemblyAction.TripEmergencyStop ||
      action === CollectionRunnerRuntimeAssemblyAction.RequestGracefulCompletion;
  }
  return action === CollectionRunnerRuntimeAssemblyAction.FailClosed;
}

export function createCollectionRunnerRehearsalDurableStateObservation(
  input: Omit<CollectionRunnerRehearsalDurableStateObservation, "deterministic" | "fingerprint">,
): CollectionRunnerRehearsalDurableStateObservation {
  const expected = [
    "invocationOrdinal", "manifestFingerprint", "observedAtUtc", "pilotState",
    "recoveryFingerprint", "rehearsalId", "stateVersion", "taskState",
  ].sort();
  const actual = Object.keys(input).sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index]) ||
    !ID.test(input.rehearsalId) ||
    !FP.test(input.manifestFingerprint) ||
    !Number.isSafeInteger(input.invocationOrdinal) ||
    input.invocationOrdinal < 1 ||
    !FP.test(input.recoveryFingerprint) ||
    !Number.isSafeInteger(input.stateVersion) ||
    input.stateVersion < 1 ||
    !UTC.test(input.observedAtUtc) ||
    !Object.values(CollectionRunnerPilotState).includes(input.pilotState) ||
    !Object.values(CollectionRunnerTaskState).includes(input.taskState)
  ) fail(CollectionRunnerRehearsalStepErrorCode.DurableStateMismatch, "Durable-state observation is invalid.");
  const body = { ...input, deterministic: true as const };
  return freeze({ ...body, fingerprint: sha(body) }) as CollectionRunnerRehearsalDurableStateObservation;
}

export class EventContractCollectionRunnerFixtureRehearsalStep {
  public constructor(
    private readonly preparation: CollectionRunnerRehearsalPreparationResult,
    private readonly foreground: CollectionRunnerRehearsalForegroundStepPort,
    private readonly durableState: CollectionRunnerRehearsalDurableStatePort,
    private readonly ledger: CollectionRunnerRehearsalStepLedgerPort,
    private readonly ownerAuthorization: CollectionRunnerRehearsalOwnerAuthorizationPort,
  ) {
    if (!verifyCollectionRunnerRehearsalManifest(preparation.manifest)) {
      fail(CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "Prepared manifest is invalid.");
    }
  }

  public run(request: CollectionRunnerRehearsalStepRequest): CollectionRunnerRehearsalStepResult {
    validateRequest(request);
    const manifest = this.preparation.manifest;
    if (request.rehearsalId !== manifest.rehearsalId || request.manifestFingerprint !== manifest.fingerprint) {
      fail(CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "Step request does not bind the prepared manifest.");
    }
    if (
      request.ownerAuthorizationId !== null &&
      !this.ownerAuthorization.verifyUnexpiredLocalOwnerAuthorization(request)
    ) {
      fail(
        CollectionRunnerRehearsalStepErrorCode.AuthorizationRejected,
        "Local Owner authorization is invalid or expired.",
      );
    }
    const prior = this.ledger.findResult(request.rehearsalId, request.expectedInvocationOrdinal);
    if (prior !== null) {
      if (canonical(prior.request) !== canonical(request)) fail(CollectionRunnerRehearsalStepErrorCode.ReplayConflict, "Changed invocation replay is forbidden.");
      return this.#replayed(prior);
    }
    const state = this.ledger.read(request.rehearsalId);
    if (
      state === null ||
      state.manifestFingerprint !== manifest.fingerprint ||
      state.lifecycleVersion !== request.expectedLifecycleVersion ||
      state.nextInvocationOrdinal !== request.expectedInvocationOrdinal ||
      state.recoveryFingerprint !== request.expectedRecoveryFingerprint ||
      ![CollectionRunnerRehearsalLifecycleState.Prepared, CollectionRunnerRehearsalLifecycleState.Ready].includes(state.lifecycleState)
    ) fail(CollectionRunnerRehearsalStepErrorCode.StateConflict, "Step request disagrees with durable rehearsal state.");
    const expected = manifest.expectedInvocations[request.expectedInvocationOrdinal - 1];
    if (expected === undefined || !phaseMatches(request.scenarioPhase, expected.action)) {
      fail(CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "Scenario phase does not match the frozen action.");
    }

    const entering = this.#enteringTransitions(state, request.expectedInvocationOrdinal);
    const terminalReport = this.foreground.run({
      schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
      invocationId: request.invocationId,
      activationId: this.preparation.catalogEntry.pilotActivation.activationId,
      maximumTasks: request.maximumTasks,
    });
    const verifiedTerminalReport = this.#verifyTerminalReport(terminalReport);
    if (
      verifiedTerminalReport === null ||
      !this.#terminalIdentityMatches(request, verifiedTerminalReport)
    ) {
      this.#commitFailure(state.lifecycleVersion, entering, terminalReport, true);
    }
    if (
      verifiedTerminalReport.healthStatus !== CollectionRunnerRuntimeHealthStatus.Healthy ||
      verifiedTerminalReport.recoveryRequired ||
      verifiedTerminalReport.ambiguityPreserved ||
      verifiedTerminalReport.action !== expected.action ||
      (verifiedTerminalReport.outcome !== CollectionRunnerRuntimeStepOutcome.Completed &&
        verifiedTerminalReport.outcome !== CollectionRunnerRuntimeStepOutcome.NoWork)
    ) this.#commitFailure(
      state.lifecycleVersion,
      entering,
      verifiedTerminalReport,
      verifiedTerminalReport.recoveryRequired || verifiedTerminalReport.ambiguityPreserved,
    );

    const durable = this.durableState.readAfterStep(request, verifiedTerminalReport);
    const verifiedDurable = this.#verifyDurableState(durable);
    if (
      verifiedDurable === null ||
      verifiedDurable.rehearsalId !== manifest.rehearsalId ||
      verifiedDurable.manifestFingerprint !== manifest.fingerprint ||
      verifiedDurable.invocationOrdinal !== request.expectedInvocationOrdinal ||
      verifiedDurable.taskState !== expected.resultingTaskState ||
      (request.expectedInvocationOrdinal === manifest.expectedInvocations.length &&
        verifiedDurable.pilotState !== manifest.expectedPilotState)
    ) this.#commitFailure(state.lifecycleVersion, entering, verifiedTerminalReport, true);

    const completedAll =
      request.expectedInvocationOrdinal === manifest.expectedInvocations.length;
    const ready = createCollectionRunnerRehearsalLifecycleTransition({
      rehearsalId: manifest.rehearsalId,
      manifestFingerprint: manifest.fingerprint,
      ordinal: request.expectedInvocationOrdinal,
      fromState: CollectionRunnerRehearsalLifecycleState.Stepping,
      fromVersion: entering[entering.length - 1]!.toVersion,
      toState: CollectionRunnerRehearsalLifecycleState.Ready,
      reasonCode: "FOREGROUND_ACTION_COMPLETED",
    });
    const completed = completedAll
      ? createCollectionRunnerRehearsalLifecycleTransition({
          rehearsalId: manifest.rehearsalId,
          manifestFingerprint: manifest.fingerprint,
          ordinal: request.expectedInvocationOrdinal,
          fromState: CollectionRunnerRehearsalLifecycleState.Ready,
          fromVersion: ready.toVersion,
          toState: CollectionRunnerRehearsalLifecycleState.Completed,
          reasonCode: "REHEARSAL_ACTIONS_COMPLETED",
        })
      : null;
    const transitions = completed === null
      ? [...entering, ready]
      : [...entering, ready, completed];
    const finalState = completed?.toState ?? ready.toState;
    const finalVersion = completed?.toVersion ?? ready.toVersion;
    const receipt = createCollectionRunnerRehearsalInvocationReceipt(manifest, {
      rehearsalId: manifest.rehearsalId,
      manifestFingerprint: manifest.fingerprint,
      ordinal: request.expectedInvocationOrdinal,
      expectedStateVersion: request.expectedLifecycleVersion,
      recoveryFingerprint: verifiedDurable.recoveryFingerprint,
      selectedAction: expected.action,
      resultingTaskState: verifiedDurable.taskState,
      outcome: verifiedTerminalReport.outcome,
      durableTransitionFingerprint: verifiedTerminalReport.durableReceiptFingerprint,
      terminalReportFingerprint: verifiedTerminalReport.fingerprint,
      processSessionId: verifiedTerminalReport.processSessionId!,
      bootIdentity: verifiedTerminalReport.bootIdentity!,
      observedAtUtc: verifiedTerminalReport.endedAtUtc,
      elapsedMonotonicMilliseconds: verifiedTerminalReport.elapsedMonotonicMilliseconds,
    });
    const body = {
      request: freeze(structuredClone(request)),
      terminalReport: verifiedTerminalReport,
      durableState: verifiedDurable,
      invocationReceipt: receipt,
      lifecycleTransitions: transitions,
      resultingLifecycleState: finalState,
      resultingLifecycleVersion: finalVersion,
      replayed: false,
      deterministic: true as const,
    };
    const result = freeze({ ...body, fingerprint: sha(body) }) as CollectionRunnerRehearsalStepResult;
    return this.ledger.commitSuccess(state.lifecycleVersion, result);
  }

  #enteringTransitions(
    state: CollectionRunnerRehearsalStepLedgerSnapshot,
    ordinal: number,
  ): readonly CollectionRunnerRehearsalLifecycleTransition[] {
    const transitions: CollectionRunnerRehearsalLifecycleTransition[] = [];
    let current = state.lifecycleState;
    let version = state.lifecycleVersion;
    if (current === CollectionRunnerRehearsalLifecycleState.Prepared) {
      const ready = createCollectionRunnerRehearsalLifecycleTransition({
        rehearsalId: state.rehearsalId,
        manifestFingerprint: state.manifestFingerprint,
        ordinal,
        fromState: current,
        fromVersion: version,
        toState: CollectionRunnerRehearsalLifecycleState.Ready,
        reasonCode: "PREPARATION_VERIFIED",
      });
      transitions.push(ready);
      current = ready.toState;
      version = ready.toVersion;
    }
    const stepping = createCollectionRunnerRehearsalLifecycleTransition({
      rehearsalId: state.rehearsalId,
      manifestFingerprint: state.manifestFingerprint,
      ordinal,
      fromState: current,
      fromVersion: version,
      toState: CollectionRunnerRehearsalLifecycleState.Stepping,
      reasonCode: "FOREGROUND_ACTION_STARTED",
    });
    transitions.push(stepping);
    return transitions;
  }

  #terminalIdentityMatches(
    request: CollectionRunnerRehearsalStepRequest,
    report: CollectionRunnerRuntimeTerminalReport,
  ): boolean {
    return (
      report.invocationId === request.invocationId &&
      report.activationId === this.preparation.catalogEntry.pilotActivation.activationId &&
      report.configurationFingerprint === this.preparation.runtimeConfiguration.fingerprint &&
      report.pathFingerprint === this.preparation.runtimePaths.pathFingerprint &&
      report.storeIdentity === this.preparation.runtimePaths.storePathIdentity &&
      report.buildFingerprint === this.preparation.manifest.buildFingerprint &&
      report.processSessionId !== null &&
      report.bootIdentity !== null
    );
  }

  #verifyTerminalReport(
    report: CollectionRunnerRuntimeTerminalReport,
  ): CollectionRunnerRuntimeTerminalReport | null {
    try {
      const {
        deterministic,
        fingerprint,
        ...input
      } = report;
      const verified = createCollectionRunnerRuntimeTerminalReport(input);
      return deterministic === true && verified.fingerprint === fingerprint
        ? verified
        : null;
    } catch {
      return null;
    }
  }

  #verifyDurableState(
    observation: CollectionRunnerRehearsalDurableStateObservation,
  ): CollectionRunnerRehearsalDurableStateObservation | null {
    try {
      const {
        deterministic,
        fingerprint,
        ...input
      } = observation;
      const verified = createCollectionRunnerRehearsalDurableStateObservation(input);
      return deterministic === true && verified.fingerprint === fingerprint
        ? verified
        : null;
    } catch {
      return null;
    }
  }

  #commitFailure(
    expectedVersion: number,
    entering: readonly CollectionRunnerRehearsalLifecycleTransition[],
    report: CollectionRunnerRuntimeTerminalReport,
    recovery: boolean,
  ): never {
    const last = entering[entering.length - 1]!;
    const failed = createCollectionRunnerRehearsalLifecycleTransition({
      rehearsalId: this.preparation.manifest.rehearsalId,
      manifestFingerprint: this.preparation.manifest.fingerprint,
      ordinal: last.ordinal,
      fromState: CollectionRunnerRehearsalLifecycleState.Stepping,
      fromVersion: last.toVersion,
      toState: recovery
        ? CollectionRunnerRehearsalLifecycleState.RecoveryRequired
        : CollectionRunnerRehearsalLifecycleState.FailedClosed,
      reasonCode: recovery ? "FOREGROUND_RECOVERY_REQUIRED" : "FOREGROUND_FAILED_CLOSED",
    });
    this.ledger.commitFailure(expectedVersion, [...entering, failed], report);
    fail(
      recovery
        ? CollectionRunnerRehearsalStepErrorCode.RecoveryRequired
        : CollectionRunnerRehearsalStepErrorCode.ForegroundMismatch,
      recovery ? "Foreground step requires recovery." : "Foreground step failed closed.",
    );
  }

  #replayed(prior: CollectionRunnerRehearsalStepResult): CollectionRunnerRehearsalStepResult {
    const { fingerprint: _fingerprint, replayed: _replayed, ...body } = prior;
    const replayBody = { ...body, replayed: true };
    return freeze({ ...replayBody, fingerprint: sha(replayBody) }) as CollectionRunnerRehearsalStepResult;
  }
}

export class InMemoryCollectionRunnerRehearsalStepLedger
  implements CollectionRunnerRehearsalStepLedgerPort {
  #snapshot: CollectionRunnerRehearsalStepLedgerSnapshot;
  readonly #results = new Map<number, CollectionRunnerRehearsalStepResult>();
  readonly #failureReports: CollectionRunnerRuntimeTerminalReport[] = [];

  public constructor(preparation: CollectionRunnerRehearsalPreparationResult) {
    this.#snapshot = freeze({
      rehearsalId: preparation.manifest.rehearsalId,
      manifestFingerprint: preparation.manifest.fingerprint,
      lifecycleState: CollectionRunnerRehearsalLifecycleState.Prepared,
      lifecycleVersion: preparation.lifecycleTransition.toVersion,
      nextInvocationOrdinal: 1,
      recoveryFingerprint: preparation.preparationReceipt.seededStoreFingerprint,
    });
  }

  public read(rehearsalId: string): CollectionRunnerRehearsalStepLedgerSnapshot | null {
    return rehearsalId === this.#snapshot.rehearsalId ? this.#snapshot : null;
  }

  public findResult(rehearsalId: string, ordinal: number): CollectionRunnerRehearsalStepResult | null {
    return rehearsalId === this.#snapshot.rehearsalId ? this.#results.get(ordinal) ?? null : null;
  }

  public commitSuccess(expectedLifecycleVersion: number, result: CollectionRunnerRehearsalStepResult): CollectionRunnerRehearsalStepResult {
    if (
      this.#snapshot.lifecycleVersion !== expectedLifecycleVersion ||
      result.request.expectedInvocationOrdinal !== this.#snapshot.nextInvocationOrdinal ||
      this.#results.has(result.request.expectedInvocationOrdinal)
    ) fail(CollectionRunnerRehearsalStepErrorCode.StateConflict, "Step commit lost its compare-and-swap boundary.");
    this.#results.set(result.request.expectedInvocationOrdinal, result);
    this.#snapshot = freeze({
      ...this.#snapshot,
      lifecycleState: result.resultingLifecycleState,
      lifecycleVersion: result.resultingLifecycleVersion,
      nextInvocationOrdinal: this.#snapshot.nextInvocationOrdinal + 1,
      recoveryFingerprint: result.durableState.recoveryFingerprint,
    });
    return result;
  }

  public commitFailure(
    expectedLifecycleVersion: number,
    transitions: readonly CollectionRunnerRehearsalLifecycleTransition[],
    terminalReport: CollectionRunnerRuntimeTerminalReport,
  ): void {
    if (this.#snapshot.lifecycleVersion !== expectedLifecycleVersion) {
      fail(CollectionRunnerRehearsalStepErrorCode.StateConflict, "Failure commit lost its compare-and-swap boundary.");
    }
    const last = transitions[transitions.length - 1]!;
    this.#failureReports.push(terminalReport);
    this.#snapshot = freeze({
      ...this.#snapshot,
      lifecycleState: last.toState,
      lifecycleVersion: last.toVersion,
    });
  }

  public getFailureReports(): readonly CollectionRunnerRuntimeTerminalReport[] {
    return freeze([...this.#failureReports]);
  }
}
