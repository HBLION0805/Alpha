import {
  COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS,
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeCleanupDisposition,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeInvocationState,
  CollectionRunnerRuntimeMode,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
  type CollectionRunnerRuntimeAssemblyPlannerInput,
  type CollectionRunnerRuntimeTerminalReportInput,
  type CollectionRunnerRuntimeWorkSnapshot,
  type CollectionRunnerRuntimeWorkSnapshotInput,
  type CollectionRunnerRuntimeWorkSnapshotTaskInput,
} from "../../contracts";
import {
  createCollectionRunnerRuntimeT6ExecutionRequest,
  createCollectionRunnerRuntimeTerminalReport,
  createCollectionRunnerRuntimeWorkSnapshot,
  EventContractCollectionRunnerRuntimeAssemblyPlanner,
  transitionCollectionRunnerRuntimeInvocation,
  verifyCollectionRunnerRuntimeWorkSnapshot,
} from "./EventContractCollectionRunnerRuntimeAssemblyPlanner";
import { EventContractCollectionRunnerRuntimeFoundationError } from "./EventContractCollectionRunnerRuntimeFoundation";

const SHA_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const NOW = "2026-07-25T14:00:00.000Z";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertThrows(
  run: () => unknown,
  code: CollectionRunnerRuntimeFoundationErrorCode,
  label: string,
): void {
  try {
    run();
  } catch (error) {
    if (
      error instanceof EventContractCollectionRunnerRuntimeFoundationError &&
      error.code === code
    ) {
      return;
    }
    throw error;
  }
  throw new Error(`${label}: expected ${code}.`);
}

function task(
  changes: Partial<CollectionRunnerRuntimeWorkSnapshotTaskInput> = {},
): CollectionRunnerRuntimeWorkSnapshotTaskInput {
  return {
    taskId: "task:assembly",
    sourceLane: CollectionRunnerSourceLane.Exchange,
    state: CollectionRunnerTaskState.Scheduled,
    aggregateVersion: 1,
    requiredActionAtUtc: "2026-07-25T13:59:00.000Z",
    evidenceCutoffAtUtc: "2026-07-25T14:05:00.000Z",
    deadlineAtUtc: "2026-07-25T14:06:00.000Z",
    retryEligibleAtUtc: null,
    attemptsStarted: 0,
    taskFingerprint: SHA_A,
    ...changes,
  };
}

function snapshotInput(
  changes: Partial<CollectionRunnerRuntimeWorkSnapshotInput> = {},
): CollectionRunnerRuntimeWorkSnapshotInput {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
    activationId: "activation:assembly",
    pilotState: CollectionRunnerPilotState.Active,
    pilotAggregateVersion: 3,
    activationStopsAtUtc: "2026-07-25T15:00:00.000Z",
    sessionAuthorizationId: "authorization:assembly",
    sessionAuthorizationExpiresAtUtc: "2026-07-25T14:30:00.000Z",
    emergencyStopObserved: false,
    budget: {
      aggregateVersion: 2,
      maximumEvents: 10,
      eventsScheduled: 1,
      tasksMissed: 0,
      maximumRequests: 10,
      requestsStarted: 0,
      maximumRetries: 2,
      retriesStarted: 0,
    },
    currentLease: null,
    openAttemptId: null,
    tasks: [task()],
    observedAtUtc: NOW,
    ...changes,
  };
}

function snapshot(
  changes: Partial<CollectionRunnerRuntimeWorkSnapshotInput> = {},
): CollectionRunnerRuntimeWorkSnapshot {
  return createCollectionRunnerRuntimeWorkSnapshot(snapshotInput(changes));
}

function plannerInput(
  changes: Partial<CollectionRunnerRuntimeAssemblyPlannerInput> = {},
): CollectionRunnerRuntimeAssemblyPlannerInput {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    configurationIdentityVerified: true,
    lockOwnershipVerified: true,
    processSessionAuthorized: true,
    clockHealthy: true,
    stopBarrierTripped: false,
    nowUtc: NOW,
    snapshot: snapshot(),
    ...changes,
  };
}

function terminalInput(
  changes: Partial<CollectionRunnerRuntimeTerminalReportInput> = {},
): CollectionRunnerRuntimeTerminalReportInput {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
    configurationFingerprint: SHA_A,
    pathFingerprint: SHA_B,
    storeIdentity: SHA_C,
    lockFingerprint: SHA_A,
    bootIdentity: "boot:assembly",
    processSessionId: "process:assembly",
    activationId: "activation:assembly",
    buildFingerprint: SHA_B,
    invocationId: "invocation:assembly",
    startedAtUtc: NOW,
    endedAtUtc: "2026-07-25T14:00:01.000Z",
    elapsedMonotonicMilliseconds: 1_000,
    finalState: CollectionRunnerRuntimeInvocationState.Closed,
    outcome: CollectionRunnerRuntimeStepOutcome.Completed,
    healthStatus: CollectionRunnerRuntimeHealthStatus.Healthy,
    blockerCodes: [],
    action: CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
    taskId: "task:assembly",
    reasonCode: "STEP_COMPLETED",
    durableMutationAttempted: true,
    durableReceiptFingerprint: SHA_C,
    stopBarrierTripped: false,
    cleanupDisposition:
      CollectionRunnerRuntimeCleanupDisposition.VerifiedCleanRelease,
    ambiguityPreserved: false,
    recoveryRequired: false,
    ...changes,
  };
}

const planner = new EventContractCollectionRunnerRuntimeAssemblyPlanner();

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "work snapshot is deterministic deeply immutable and verifiable",
    () => {
      const first = snapshot();
      const second = snapshot();
      assertEqual(first.fingerprint, second.fingerprint, "fingerprint");
      assertTrue(Object.isFrozen(first), "snapshot frozen");
      assertTrue(Object.isFrozen(first.tasks), "tasks frozen");
      assertTrue(Object.isFrozen(first.tasks[0]!), "task frozen");
      assertEqual(
        verifyCollectionRunnerRuntimeWorkSnapshot(first),
        first,
        "verify",
      );
    },
  ],
  [
    "work snapshot does not mutate caller input",
    () => {
      const input = snapshotInput();
      const before = JSON.stringify(input);
      createCollectionRunnerRuntimeWorkSnapshot(input);
      assertEqual(JSON.stringify(input), before, "source");
    },
  ],
  [
    "work snapshot rejects unknown fields",
    () => {
      assertThrows(
        () =>
          createCollectionRunnerRuntimeWorkSnapshot({
            ...snapshotInput(),
            providerUrl: "https://example.invalid",
          } as CollectionRunnerRuntimeWorkSnapshotInput),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "unknown",
      );
    },
  ],
  [
    "work snapshot rejects unsupported schema",
    () => {
      assertThrows(
        () =>
          createCollectionRunnerRuntimeWorkSnapshot({
            ...snapshotInput(),
            schemaVersion: "2.0",
          } as unknown as CollectionRunnerRuntimeWorkSnapshotInput),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "schema",
      );
    },
  ],
  [
    "work snapshot rejects duplicate tasks",
    () => {
      assertThrows(
        () =>
          snapshot({
            tasks: [task(), task()],
            budget: { ...snapshotInput().budget, eventsScheduled: 2 },
          }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "duplicate",
      );
    },
  ],
  [
    "work snapshot enforces activation task bound",
    () => {
      assertThrows(
        () =>
          snapshot({
            tasks: [task(), task({ taskId: "task:second" })],
            budget: {
              ...snapshotInput().budget,
              maximumEvents: 1,
              eventsScheduled: 1,
            },
          }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "bound",
      );
    },
  ],
  [
    "work snapshot enforces hard task bound",
    () => {
      assertThrows(
        () =>
          snapshot({
            budget: {
              ...snapshotInput().budget,
              maximumEvents:
                COLLECTION_RUNNER_RUNTIME_MAXIMUM_WORK_SNAPSHOT_TASKS + 1,
            },
          }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "hard bound",
      );
    },
  ],
  [
    "work snapshot rejects invalid budget counters",
    () => {
      assertThrows(
        () =>
          snapshot({
            budget: {
              ...snapshotInput().budget,
              requestsStarted: 11,
            },
          }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "budget",
      );
    },
  ],
  [
    "work snapshot rejects malformed task fingerprint",
    () => {
      assertThrows(
        () => snapshot({ tasks: [task({ taskFingerprint: "secret" })] }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "fingerprint",
      );
    },
  ],
  [
    "work snapshot requires retry eligibility for RETRY_WAIT",
    () => {
      assertThrows(
        () =>
          snapshot({
            tasks: [task({ state: CollectionRunnerTaskState.RetryWait })],
          }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "retry",
      );
    },
  ],
  [
    "work snapshot lease must bind a listed task",
    () => {
      assertThrows(
        () =>
          snapshot({
            currentLease: {
              taskId: "task:missing",
              leaseToken: "lease:assembly",
              bootIdentity: "boot:assembly",
              processSessionId: "process:assembly",
              acquiredAtUtc: NOW,
              expiresAtUtc: "2026-07-25T14:01:00.000Z",
            },
          }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "lease",
      );
    },
  ],
  [
    "work snapshot open attempt requires a lease",
    () => {
      assertThrows(
        () => snapshot({ openAttemptId: "attempt:assembly" }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "attempt",
      );
    },
  ],
  [
    "tampered work snapshot fails verification",
    () => {
      const valid = snapshot();
      assertThrows(
        () =>
          verifyCollectionRunnerRuntimeWorkSnapshot({
            ...valid,
            activationId: "activation:tampered",
          }),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkSnapshot,
        "tamper",
      );
    },
  ],
  [
    "scheduled task at required time produces one T6 action",
    () => {
      const result = planner.plan(plannerInput());
      assertEqual(
        result.action,
        CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
        "action",
      );
      assertEqual(result.taskId, "task:assembly", "task");
    },
  ],
  [
    "eligible retry produces one T6 action",
    () => {
      const result = planner.plan(
        plannerInput({
          snapshot: snapshot({
            tasks: [
              task({
                state: CollectionRunnerTaskState.RetryWait,
                retryEligibleAtUtc: "2026-07-25T13:59:30.000Z",
                attemptsStarted: 1,
              }),
            ],
          }),
        }),
      );
      assertEqual(
        result.action,
        CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
        "action",
      );
      assertEqual(
        result.reasonCode,
        "EXACT_RETRY_TASK_REQUIRES_DUE_TRANSITION",
        "reason",
      );
    },
  ],
  [
    "DUE task produces one fixture action without T6",
    () => {
      const result = planner.plan(
        plannerInput({
          snapshot: snapshot({
            tasks: [task({ state: CollectionRunnerTaskState.Due })],
          }),
        }),
      );
      assertEqual(
        result.action,
        CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask,
        "action",
      );
    },
  ],
  [
    "cutoff produces one missed action",
    () => {
      const atCutoff = "2026-07-25T14:05:00.000Z";
      const result = planner.plan(
        plannerInput({
          nowUtc: atCutoff,
          snapshot: snapshot({ observedAtUtc: atCutoff }),
        }),
      );
      assertEqual(
        result.action,
        CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed,
        "action",
      );
    },
  ],
  [
    "future task produces wait and exit",
    () => {
      const result = planner.plan(
        plannerInput({
          snapshot: snapshot({
            tasks: [
              task({ requiredActionAtUtc: "2026-07-25T14:01:00.000Z" }),
            ],
          }),
        }),
      );
      assertEqual(
        result.action,
        CollectionRunnerRuntimeAssemblyAction.WaitAndExit,
        "action",
      );
      assertEqual(
        result.waitUntilUtc,
        "2026-07-25T14:01:00.000Z",
        "wait",
      );
    },
  ],
  [
    "no open tasks produces complete and exit",
    () => {
      const result = planner.plan(
        plannerInput({
          snapshot: snapshot({
            tasks: [task({ state: CollectionRunnerTaskState.Committed })],
          }),
        }),
      );
      assertEqual(
        result.action,
        CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
        "action",
      );
    },
  ],
  [
    "platform lane wins deterministic tie",
    () => {
      const result = planner.plan(
        plannerInput({
          snapshot: snapshot({
            budget: {
              ...snapshotInput().budget,
              eventsScheduled: 2,
            },
            tasks: [
              task({ taskId: "task:exchange" }),
              task({
                taskId: "task:platform",
                sourceLane: CollectionRunnerSourceLane.Platform,
              }),
            ],
          }),
        }),
      );
      assertEqual(result.taskId, "task:platform", "platform task");
    },
  ],
  [
    "planner result is stable across caller task order",
    () => {
      const platform = task({
        taskId: "task:platform",
        sourceLane: CollectionRunnerSourceLane.Platform,
      });
      const exchange = task({ taskId: "task:exchange" });
      const budget = { ...snapshotInput().budget, eventsScheduled: 2 };
      const first = planner.plan(
        plannerInput({ snapshot: snapshot({ budget, tasks: [platform, exchange] }) }),
      );
      const second = planner.plan(
        plannerInput({ snapshot: snapshot({ budget, tasks: [exchange, platform] }) }),
      );
      assertEqual(first.fingerprint, second.fingerprint, "planner fingerprint");
    },
  ],
  [
    "configuration drift fails closed",
    () => {
      assertEqual(
        planner.plan(
          plannerInput({ configurationIdentityVerified: false }),
        ).action,
        CollectionRunnerRuntimeAssemblyAction.FailClosed,
        "action",
      );
    },
  ],
  [
    "ownership loss fails closed",
    () => {
      assertEqual(
        planner.plan(plannerInput({ lockOwnershipVerified: false })).reasonCode,
        "LOCK_OWNERSHIP_UNVERIFIED",
        "reason",
      );
    },
  ],
  [
    "stale session fails closed",
    () => {
      assertEqual(
        planner.plan(
          plannerInput({ processSessionAuthorized: false }),
        ).reasonCode,
        "PROCESS_SESSION_UNAUTHORIZED",
        "reason",
      );
    },
  ],
  [
    "unhealthy clock trips Emergency Stop",
    () => {
      assertEqual(
        planner.plan(plannerInput({ clockHealthy: false })).action,
        CollectionRunnerRuntimeAssemblyAction.TripEmergencyStop,
        "action",
      );
    },
  ],
  [
    "durable Emergency Stop trips Emergency Stop",
    () => {
      assertEqual(
        planner.plan(
          plannerInput({
            snapshot: snapshot({ emergencyStopObserved: true }),
          }),
        ).reasonCode,
        "EMERGENCY_STOP_OBSERVED",
        "reason",
      );
    },
  ],
  [
    "process barrier requests graceful completion",
    () => {
      assertEqual(
        planner.plan(plannerInput({ stopBarrierTripped: true })).action,
        CollectionRunnerRuntimeAssemblyAction.RequestGracefulCompletion,
        "action",
      );
    },
  ],
  [
    "non-active Pilot exits without work",
    () => {
      assertEqual(
        planner.plan(
          plannerInput({
            snapshot: snapshot({
              pilotState: CollectionRunnerPilotState.Completed,
            }),
          }),
        ).action,
        CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
        "action",
      );
    },
  ],
  [
    "expired activation requests graceful completion",
    () => {
      const later = "2026-07-25T15:00:00.001Z";
      assertEqual(
        planner.plan(
          plannerInput({
            nowUtc: later,
            snapshot: snapshot({ observedAtUtc: later }),
          }),
        ).reasonCode,
        "ACTIVATION_WINDOW_CLOSED",
        "reason",
      );
    },
  ],
  [
    "expired session fails closed",
    () => {
      const later = "2026-07-25T14:30:00.001Z";
      assertEqual(
        planner.plan(
          plannerInput({
            nowUtc: later,
            snapshot: snapshot({ observedAtUtc: later }),
          }),
        ).reasonCode,
        "PROCESS_SESSION_EXPIRED",
        "reason",
      );
    },
  ],
  [
    "current lease requires reconciliation",
    () => {
      const currentLease = {
        taskId: "task:assembly",
        leaseToken: "lease:assembly",
        bootIdentity: "boot:assembly",
        processSessionId: "process:assembly",
        acquiredAtUtc: "2026-07-25T13:59:30.000Z",
        expiresAtUtc: "2026-07-25T14:00:30.000Z",
      };
      assertEqual(
        planner.plan(
          plannerInput({
            snapshot: snapshot({
              currentLease,
              tasks: [task({ state: CollectionRunnerTaskState.Leased })],
            }),
          }),
        ).reasonCode,
        "RECOVERY_RECONCILIATION_REQUIRED",
        "reason",
      );
    },
  ],
  [
    "reconciliation task state fails closed",
    () => {
      assertEqual(
        planner.plan(
          plannerInput({
            snapshot: snapshot({
              tasks: [task({ state: CollectionRunnerTaskState.Blocked })],
            }),
          }),
        ).reasonCode,
        "TASK_RECONCILIATION_REQUIRED",
        "reason",
      );
    },
  ],
  [
    "request budget exhaustion stops acquisition",
    () => {
      assertEqual(
        planner.plan(
          plannerInput({
            snapshot: snapshot({
              budget: {
                ...snapshotInput().budget,
                maximumRequests: 1,
                requestsStarted: 1,
              },
            }),
          }),
        ).reasonCode,
        "BUDGET_EXHAUSTED",
        "reason",
      );
    },
  ],
  [
    "planner rejects unknown fields",
    () => {
      assertThrows(
        () =>
          planner.plan({
            ...plannerInput(),
            startRuntime: true,
          } as CollectionRunnerRuntimeAssemblyPlannerInput),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "unknown",
      );
    },
  ],
  [
    "planner rejects a time not bound to the snapshot",
    () => {
      assertThrows(
        () =>
          planner.plan(
            plannerInput({ nowUtc: "2026-07-25T14:00:00.001Z" }),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "time",
      );
    },
  ],
  [
    "T6 request binds exact planner and work snapshot",
    () => {
      const work = snapshot();
      const result = planner.plan(plannerInput({ snapshot: work }));
      const request = createCollectionRunnerRuntimeT6ExecutionRequest(
        result,
        work,
      );
      assertEqual(
        request.action,
        CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
        "action",
      );
      assertEqual(request.taskId, "task:assembly", "task");
      assertEqual(request.workSnapshotFingerprint, work.fingerprint, "snapshot");
      assertTrue(Object.isFrozen(request), "frozen");
    },
  ],
  [
    "T6 request rejects a Worker action",
    () => {
      const work = snapshot({
        tasks: [task({ state: CollectionRunnerTaskState.Due })],
      });
      const result = planner.plan(plannerInput({ snapshot: work }));
      assertThrows(
        () => createCollectionRunnerRuntimeT6ExecutionRequest(result, work),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "worker",
      );
    },
  ],
  [
    "T6 request rejects a tampered decision",
    () => {
      const work = snapshot();
      const result = planner.plan(plannerInput({ snapshot: work }));
      assertThrows(
        () =>
          createCollectionRunnerRuntimeT6ExecutionRequest(
            { ...result, expectedTaskVersion: 2 },
            work,
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "decision",
      );
    },
  ],
  [
    "lifecycle accepts the reviewed startup chain",
    () => {
      let state = CollectionRunnerRuntimeInvocationState.Created;
      for (const next of [
        CollectionRunnerRuntimeInvocationState.ConfigurationVerified,
        CollectionRunnerRuntimeInvocationState.OwnershipAcquired,
        CollectionRunnerRuntimeInvocationState.StoreInspected,
        CollectionRunnerRuntimeInvocationState.SessionAuthorized,
        CollectionRunnerRuntimeInvocationState.PreflightReady,
        CollectionRunnerRuntimeInvocationState.ActionSelected,
        CollectionRunnerRuntimeInvocationState.ActionExecuting,
        CollectionRunnerRuntimeInvocationState.Reporting,
        CollectionRunnerRuntimeInvocationState.Closing,
        CollectionRunnerRuntimeInvocationState.Closed,
      ]) {
        state = transitionCollectionRunnerRuntimeInvocation(state, next);
      }
      assertEqual(state, CollectionRunnerRuntimeInvocationState.Closed, "state");
    },
  ],
  [
    "lifecycle rejects a skipped authority phase",
    () => {
      assertThrows(
        () =>
          transitionCollectionRunnerRuntimeInvocation(
            CollectionRunnerRuntimeInvocationState.Created,
            CollectionRunnerRuntimeInvocationState.PreflightReady,
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidLifecycleTransition,
        "skip",
      );
    },
  ],
  [
    "lifecycle rejects reopening a terminal invocation",
    () => {
      assertThrows(
        () =>
          transitionCollectionRunnerRuntimeInvocation(
            CollectionRunnerRuntimeInvocationState.Closed,
            CollectionRunnerRuntimeInvocationState.Created,
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidLifecycleTransition,
        "terminal",
      );
    },
  ],
  [
    "terminal report is deterministic immutable and sanitized",
    () => {
      const first = createCollectionRunnerRuntimeTerminalReport(terminalInput());
      const second = createCollectionRunnerRuntimeTerminalReport(terminalInput());
      assertEqual(first.fingerprint, second.fingerprint, "fingerprint");
      assertTrue(Object.isFrozen(first), "frozen");
      assertEqual("providerPayload" in first, false, "payload");
      assertEqual("secret" in first, false, "secret");
    },
  ],
  [
    "terminal report rejects unordered blocker codes",
    () => {
      assertThrows(
        () =>
          createCollectionRunnerRuntimeTerminalReport(
            terminalInput({ blockerCodes: ["Z_BLOCKER", "A_BLOCKER"] }),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "blockers",
      );
    },
  ],
  [
    "terminal report rejects clean release with recovery required",
    () => {
      assertThrows(
        () =>
          createCollectionRunnerRuntimeTerminalReport(
            terminalInput({
              outcome: CollectionRunnerRuntimeStepOutcome.Ambiguous,
              ambiguityPreserved: true,
              recoveryRequired: true,
            }),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "cleanup",
      );
    },
  ],
  [
    "terminal report cannot claim healthy with blockers",
    () => {
      assertThrows(
        () =>
          createCollectionRunnerRuntimeTerminalReport(
            terminalInput({ blockerCodes: ["LOCK_UNVERIFIED"] }),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "healthy blockers",
      );
    },
  ],
  [
    "terminal report requires fail-closed health for fail-closed outcome",
    () => {
      assertThrows(
        () =>
          createCollectionRunnerRuntimeTerminalReport(
            terminalInput({
              finalState: CollectionRunnerRuntimeInvocationState.FailedClosed,
              outcome: CollectionRunnerRuntimeStepOutcome.FailedClosed,
            }),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "fail-closed health",
      );
    },
  ],
  [
    "terminal report requires a receipt for an unambiguous mutation",
    () => {
      assertThrows(
        () =>
          createCollectionRunnerRuntimeTerminalReport(
            terminalInput({ durableReceiptFingerprint: null }),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidAssemblyInput,
        "mutation receipt",
      );
    },
  ],
];

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(
  `Event Contract Collection Runner Runtime Assembly Planner tests passed: ${String(passed)}/${String(tests.length)}.`,
);
