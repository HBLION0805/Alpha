import {
  COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeCleanupDisposition,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeInvocationState,
  CollectionRunnerRuntimeStepOutcome,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
  type CollectionRunnerRuntimeAssemblyDecision,
  type CollectionRunnerRuntimeForegroundClockPort,
  type CollectionRunnerRuntimeForegroundFixtureExecutor,
  type CollectionRunnerRuntimeForegroundResourcePort,
  type CollectionRunnerRuntimeForegroundStepSession,
  type CollectionRunnerRuntimeForegroundStepRequest,
  type CollectionRunnerRuntimeForegroundStopExecutor,
  type CollectionRunnerRuntimeForegroundTerminalStatePort,
  type CollectionRunnerRuntimeT6ExecutionResult,
  type CollectionRunnerRuntimeTerminalReport,
} from "../../contracts";
import type {
  EventContractCollectionRunnerRuntimeT6Executor,
  EventContractCollectionRunnerRuntimeWorkSnapshotRepository,
} from "../../repositories";
import {
  createCollectionRunnerRuntimeT6ExecutionRequest,
  createCollectionRunnerRuntimeTerminalReport,
  EventContractCollectionRunnerRuntimeAssemblyPlanner,
  transitionCollectionRunnerRuntimeInvocation,
  verifyCollectionRunnerRuntimeWorkSnapshot,
} from "./EventContractCollectionRunnerRuntimeAssemblyPlanner";
import { EventContractCollectionRunnerRuntimeFoundationError } from "./EventContractCollectionRunnerRuntimeFoundation";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const FINGERPRINT =
  /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export interface EventContractCollectionRunnerRuntimeForegroundStepDependencies {
  readonly startup: EventContractCollectionRunnerRuntimeForegroundStartupPort;
  readonly clock: CollectionRunnerRuntimeForegroundClockPort;
  readonly planner: EventContractCollectionRunnerRuntimeAssemblyPlanner;
}

export interface EventContractCollectionRunnerRuntimeForegroundStartedSession
  extends CollectionRunnerRuntimeForegroundStepSession {
  readonly workSnapshots: EventContractCollectionRunnerRuntimeWorkSnapshotRepository;
  readonly t6Executor: EventContractCollectionRunnerRuntimeT6Executor;
  readonly fixtureExecutor: CollectionRunnerRuntimeForegroundFixtureExecutor;
  readonly stopExecutor: CollectionRunnerRuntimeForegroundStopExecutor;
  readonly terminalState: CollectionRunnerRuntimeForegroundTerminalStatePort;
  readonly resources: CollectionRunnerRuntimeForegroundResourcePort;
}

export interface EventContractCollectionRunnerRuntimeForegroundStartupPort {
  start(
    request: Readonly<CollectionRunnerRuntimeForegroundStepRequest>,
  ): EventContractCollectionRunnerRuntimeForegroundStartedSession;
}

function fail(message: string): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(
    CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
    message,
  );
}

function validateRequest(
  request: CollectionRunnerRuntimeForegroundStepRequest,
): CollectionRunnerRuntimeForegroundStepRequest {
  const keys = Object.keys(request).sort();
  const expected = [
    "activationId",
    "invocationId",
    "maximumTasks",
    "schemaVersion",
  ].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    fail("Foreground step request fields do not match the closed contract.");
  }
  if (
    request.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION ||
    !IDENTIFIER.test(request.invocationId) ||
    !IDENTIFIER.test(request.activationId) ||
    !Number.isSafeInteger(request.maximumTasks) ||
    request.maximumTasks < 1 ||
    request.maximumTasks >
      COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS
  ) {
    fail("Foreground step request is invalid.");
  }
  return Object.freeze(structuredClone(request));
}

function validateClock(
  observedAtUtc: string,
  monotonicMilliseconds: number,
): void {
  if (
    !UTC_MILLISECOND.test(observedAtUtc) ||
    new Date(Date.parse(observedAtUtc)).toISOString() !== observedAtUtc ||
    !Number.isSafeInteger(monotonicMilliseconds) ||
    monotonicMilliseconds < 0
  ) {
    fail("Foreground step clock sample is invalid.");
  }
}

function receiptFingerprint(
  result:
    | CollectionRunnerRuntimeT6ExecutionResult
    | Readonly<{ receiptFingerprint: string }>,
): string {
  const value =
    "transitionReceiptFingerprint" in result
      ? result.transitionReceiptFingerprint
      : result.receiptFingerprint;
  if (!FINGERPRINT.test(value)) {
    fail("Foreground step mutation receipt fingerprint is invalid.");
  }
  return value;
}

function validateIdentity(
  identity: EventContractCollectionRunnerRuntimeForegroundStartedSession["identity"],
  activationId: string,
): void {
  for (const value of [
    identity.configurationFingerprint,
    identity.pathFingerprint,
    identity.storeIdentity,
    identity.lockFingerprint,
    identity.buildFingerprint,
  ]) {
    if (!FINGERPRINT.test(value)) fail("Foreground startup identity is invalid.");
  }
  if (
    identity.activationId !== activationId ||
    !IDENTIFIER.test(identity.bootIdentity) ||
    !IDENTIFIER.test(identity.processSessionId)
  ) {
    fail("Foreground startup returned a different or invalid identity.");
  }
}

function actionMutates(action: CollectionRunnerRuntimeAssemblyAction): boolean {
  return (
    action === CollectionRunnerRuntimeAssemblyAction.TripEmergencyStop ||
    action ===
      CollectionRunnerRuntimeAssemblyAction.RequestGracefulCompletion ||
    action ===
      CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue ||
    action === CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed ||
    action ===
      CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask
  );
}

function noWorkOutcome(
  action: CollectionRunnerRuntimeAssemblyAction,
): CollectionRunnerRuntimeStepOutcome {
  return action === CollectionRunnerRuntimeAssemblyAction.WaitAndExit
    ? CollectionRunnerRuntimeStepOutcome.NoWork
    : CollectionRunnerRuntimeStepOutcome.Completed;
}

export class EventContractCollectionRunnerRuntimeForegroundStep {
  public constructor(
    private readonly dependencies:
      EventContractCollectionRunnerRuntimeForegroundStepDependencies,
  ) {}

  public run(
    requestValue: CollectionRunnerRuntimeForegroundStepRequest,
  ): CollectionRunnerRuntimeTerminalReport {
    const request = validateRequest(requestValue);
    const started = this.dependencies.clock.sample();
    validateClock(started.observedAtUtc, started.monotonicMilliseconds);

    let state = CollectionRunnerRuntimeInvocationState.Created;
    let session:
      | EventContractCollectionRunnerRuntimeForegroundStartedSession
      | null = null;
    let decision: CollectionRunnerRuntimeAssemblyDecision | null = null;
    let outcome = CollectionRunnerRuntimeStepOutcome.FailedClosed;
    let health = CollectionRunnerRuntimeHealthStatus.FailClosed;
    let blockerCodes: string[] = [];
    let durableMutationAttempted = false;
    let durableReceiptFingerprint: string | null = null;
    let ambiguityPreserved = false;
    let cleanupDisposition =
      CollectionRunnerRuntimeCleanupDisposition.NoOwnershipAcquired;
    let reasonCode = "STARTUP_FAILED";
    let stopBarrierTripped = false;
    let closed = false;

    try {
      state = transitionCollectionRunnerRuntimeInvocation(
        state,
        CollectionRunnerRuntimeInvocationState.ConfigurationVerified,
      );
      session = this.dependencies.startup.start(request);
      validateIdentity(session.identity, request.activationId);
      state = transitionCollectionRunnerRuntimeInvocation(
        state,
        CollectionRunnerRuntimeInvocationState.OwnershipAcquired,
      );
      cleanupDisposition =
        CollectionRunnerRuntimeCleanupDisposition.OwnershipPreservedForRecovery;
      state = transitionCollectionRunnerRuntimeInvocation(
        state,
        CollectionRunnerRuntimeInvocationState.StoreInspected,
      );
      state = transitionCollectionRunnerRuntimeInvocation(
        state,
        CollectionRunnerRuntimeInvocationState.SessionAuthorized,
      );

      const preflightClock = this.dependencies.clock.sample();
      validateClock(
        preflightClock.observedAtUtc,
        preflightClock.monotonicMilliseconds,
      );
      const preflight = session.createPreflight(preflightClock.observedAtUtc);
      if (
        preflight.observedAtUtc !== preflightClock.observedAtUtc ||
        preflight.configurationFingerprint !==
          session.identity.configurationFingerprint ||
        preflight.pathFingerprint !== session.identity.pathFingerprint ||
        preflight.storeIdentity !== session.identity.storeIdentity
      ) {
        fail("Foreground Preflight identity or observation time is inconsistent.");
      }
      if (!preflight.ready) {
        blockerCodes = [...preflight.safety.blockerCodes].sort();
        if (blockerCodes.length === 0) blockerCodes = ["PREFLIGHT_NOT_READY"];
        outcome = CollectionRunnerRuntimeStepOutcome.Blocked;
        health = preflight.health;
        reasonCode = "PREFLIGHT_BLOCKED";
        state = CollectionRunnerRuntimeInvocationState.RecoveryBlocked;
      } else {
        state = transitionCollectionRunnerRuntimeInvocation(
          state,
          CollectionRunnerRuntimeInvocationState.PreflightReady,
        );
        const actionClock = this.dependencies.clock.sample();
        validateClock(
          actionClock.observedAtUtc,
          actionClock.monotonicMilliseconds,
        );
        const snapshot = verifyCollectionRunnerRuntimeWorkSnapshot(
          session.workSnapshots.readWorkSnapshot({
            activationId: request.activationId,
            observedAtUtc: actionClock.observedAtUtc,
            maximumTasks: request.maximumTasks,
          }),
        );
        if (
          snapshot.activationId !== request.activationId ||
          snapshot.observedAtUtc !== actionClock.observedAtUtc
        ) {
          fail("Foreground work snapshot identity or time is inconsistent.");
        }
        decision = this.dependencies.planner.plan({
          schemaVersion:
            EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
          runtimeMode: session.identity.runtimeMode,
          configurationIdentityVerified:
            preflight.safety.configurationVerified,
          lockOwnershipVerified: preflight.safety.ownershipVerified,
          processSessionAuthorized: preflight.safety.sessionAuthorized,
          clockHealthy:
            preflight.safety.clockHealthy && actionClock.healthy,
          stopBarrierTripped: preflight.safety.stopBarrierTripped,
          nowUtc: actionClock.observedAtUtc,
          snapshot,
        });
        state = transitionCollectionRunnerRuntimeInvocation(
          state,
          CollectionRunnerRuntimeInvocationState.ActionSelected,
        );
        reasonCode = decision.reasonCode;

        if (decision.action === CollectionRunnerRuntimeAssemblyAction.FailClosed) {
          blockerCodes = [decision.reasonCode];
          outcome = CollectionRunnerRuntimeStepOutcome.FailedClosed;
          health = CollectionRunnerRuntimeHealthStatus.FailClosed;
          ambiguityPreserved = true;
          state = CollectionRunnerRuntimeInvocationState.FailedClosed;
        } else if (
          decision.action === CollectionRunnerRuntimeAssemblyAction.WaitAndExit ||
          decision.action ===
            CollectionRunnerRuntimeAssemblyAction.CompleteAndExit
        ) {
          outcome = noWorkOutcome(decision.action);
          health = CollectionRunnerRuntimeHealthStatus.Healthy;
          state = transitionCollectionRunnerRuntimeInvocation(
            state,
            CollectionRunnerRuntimeInvocationState.Reporting,
          );
        } else {
          state = transitionCollectionRunnerRuntimeInvocation(
            state,
            CollectionRunnerRuntimeInvocationState.ActionExecuting,
          );
          durableMutationAttempted = actionMutates(decision.action);
          if (
            decision.action ===
              CollectionRunnerRuntimeAssemblyAction.TripEmergencyStop ||
            decision.action ===
              CollectionRunnerRuntimeAssemblyAction.RequestGracefulCompletion
          ) {
            durableReceiptFingerprint = receiptFingerprint(
              session.stopExecutor.execute(
                decision.action,
                decision.reasonCode,
                actionClock.observedAtUtc,
              ),
            );
            outcome = CollectionRunnerRuntimeStepOutcome.Stopped;
          } else if (
            decision.action ===
              CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue ||
            decision.action ===
              CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed
          ) {
            durableReceiptFingerprint = receiptFingerprint(
              session.t6Executor.execute(
                createCollectionRunnerRuntimeT6ExecutionRequest(
                  decision,
                  snapshot,
                ),
              ),
            );
            outcome = CollectionRunnerRuntimeStepOutcome.Completed;
          } else {
            const fixture = session.fixtureExecutor.execute(
              decision,
              snapshot,
            );
            if (
              fixture.workerResult.taskId !== decision.taskId ||
              fixture.workerResult.deterministic !== true
            ) {
              fail("Fixture executor result does not match the selected task.");
            }
            durableReceiptFingerprint = receiptFingerprint(fixture);
            outcome = CollectionRunnerRuntimeStepOutcome.Completed;
          }
          health = CollectionRunnerRuntimeHealthStatus.Healthy;
          state = transitionCollectionRunnerRuntimeInvocation(
            state,
            CollectionRunnerRuntimeInvocationState.Reporting,
          );
        }
      }

      if (
        state === CollectionRunnerRuntimeInvocationState.Reporting
      ) {
        const terminalClock = this.dependencies.clock.sample();
        validateClock(
          terminalClock.observedAtUtc,
          terminalClock.monotonicMilliseconds,
        );
        const terminal = session.terminalState.read(
          terminalClock.observedAtUtc,
        );
        stopBarrierTripped = terminal.stopBarrierTripped;
        health = terminal.healthStatus;
        blockerCodes = [...terminal.blockerCodes].sort();
        if (outcome === CollectionRunnerRuntimeStepOutcome.Stopped) {
          if (!terminal.stopBarrierTripped) {
            fail("Foreground Stop did not remain authoritative at shutdown.");
          }
        } else if (
          terminal.healthStatus !== CollectionRunnerRuntimeHealthStatus.Healthy ||
          terminal.blockerCodes.length > 0 ||
          terminal.stopBarrierTripped
        ) {
          fail("Foreground terminal state is not verified clean.");
        }
        state = transitionCollectionRunnerRuntimeInvocation(
          state,
          CollectionRunnerRuntimeInvocationState.Closing,
        );
      }
      session.resources.close();
      closed = true;
      if (
        state === CollectionRunnerRuntimeInvocationState.Closing ||
        state === CollectionRunnerRuntimeInvocationState.RecoveryBlocked
      ) {
        session.resources.releaseOwnership();
        cleanupDisposition =
          CollectionRunnerRuntimeCleanupDisposition.VerifiedCleanRelease;
        if (state === CollectionRunnerRuntimeInvocationState.Closing) {
          state = transitionCollectionRunnerRuntimeInvocation(
            state,
            CollectionRunnerRuntimeInvocationState.Closed,
          );
        }
      }
    } catch {
      blockerCodes = ["FOREGROUND_STEP_FAILED"];
      reasonCode = durableMutationAttempted
        ? "MUTATION_OUTCOME_AMBIGUOUS"
        : "FOREGROUND_STEP_FAILED";
      outcome = durableMutationAttempted
        ? CollectionRunnerRuntimeStepOutcome.Ambiguous
        : CollectionRunnerRuntimeStepOutcome.FailedClosed;
      ambiguityPreserved =
        durableMutationAttempted ||
        cleanupDisposition ===
          CollectionRunnerRuntimeCleanupDisposition.OwnershipPreservedForRecovery;
      if (ambiguityPreserved) {
        outcome = CollectionRunnerRuntimeStepOutcome.Ambiguous;
        reasonCode = durableMutationAttempted
          ? "MUTATION_OUTCOME_AMBIGUOUS"
          : "RUNTIME_STATE_AMBIGUOUS";
      }
      health = CollectionRunnerRuntimeHealthStatus.FailClosed;
      state = CollectionRunnerRuntimeInvocationState.FailedClosed;
      if (!closed && session !== null) {
        try {
          session.resources.close();
        } catch {
          // Preserve the original failure and ownership for recovery.
        }
      }
    }

    const ended = this.dependencies.clock.sample();
    validateClock(ended.observedAtUtc, ended.monotonicMilliseconds);
    if (ended.monotonicMilliseconds < started.monotonicMilliseconds) {
      fail("Foreground step monotonic clock moved backwards.");
    }
    const identity = session?.identity;
    return createCollectionRunnerRuntimeTerminalReport({
      schemaVersion:
        EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
      configurationFingerprint:
        identity?.configurationFingerprint ??
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      pathFingerprint:
        identity?.pathFingerprint ??
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      storeIdentity:
        identity?.storeIdentity ??
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      lockFingerprint: identity?.lockFingerprint ?? null,
      bootIdentity: identity?.bootIdentity ?? null,
      processSessionId: identity?.processSessionId ?? null,
      activationId: request.activationId,
      buildFingerprint:
        identity?.buildFingerprint ??
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      invocationId: request.invocationId,
      startedAtUtc: started.observedAtUtc,
      endedAtUtc: ended.observedAtUtc,
      elapsedMonotonicMilliseconds:
        ended.monotonicMilliseconds - started.monotonicMilliseconds,
      finalState: state,
      outcome,
      healthStatus: health,
      blockerCodes: [...new Set(blockerCodes)].sort(),
      action: decision?.action ?? null,
      taskId: decision?.taskId ?? null,
      reasonCode,
      durableMutationAttempted,
      durableReceiptFingerprint,
      stopBarrierTripped,
      cleanupDisposition,
      ambiguityPreserved,
      recoveryRequired: ambiguityPreserved,
    });
  }
}
