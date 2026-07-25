import {
  CollectionRunnerFixtureWorkerOutcome,
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeCleanupDisposition,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeMode,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
  type CollectionRunnerRuntimeAssemblyDecision,
  type CollectionRunnerRuntimeForegroundStepRequest,
  type CollectionRunnerRuntimePreflightReport,
  type CollectionRunnerRuntimeWorkSnapshotInput,
} from "../../contracts";
import {
  createCollectionRunnerRuntimeWorkSnapshot,
  EventContractCollectionRunnerRuntimeAssemblyPlanner,
} from "./EventContractCollectionRunnerRuntimeAssemblyPlanner";
import {
  EventContractCollectionRunnerRuntimeForegroundStep,
  type EventContractCollectionRunnerRuntimeForegroundStepDependencies,
} from "./EventContractCollectionRunnerRuntimeForegroundStep";

const SHA_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const SHA_D =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const START = Date.parse("2026-07-25T14:00:00.000Z");

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}.`,
    );
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function request(): CollectionRunnerRuntimeForegroundStepRequest {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
    invocationId: "invocation:foreground",
    activationId: "activation:foreground",
    maximumTasks: 10,
  };
}

function workInput(
  state: CollectionRunnerTaskState,
  changes: Partial<CollectionRunnerRuntimeWorkSnapshotInput> = {},
): CollectionRunnerRuntimeWorkSnapshotInput {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_SCHEMA_VERSION,
    activationId: "activation:foreground",
    pilotState: CollectionRunnerPilotState.Active,
    pilotAggregateVersion: 2,
    activationStopsAtUtc: "2026-07-25T15:00:00.000Z",
    sessionAuthorizationId: "authorization:foreground",
    sessionAuthorizationExpiresAtUtc: "2026-07-25T14:30:00.000Z",
    emergencyStopObserved: false,
    budget: {
      aggregateVersion: 2,
      maximumEvents: 4,
      eventsScheduled: 1,
      tasksMissed: 0,
      maximumRequests: 4,
      requestsStarted: 0,
      maximumRetries: 1,
      retriesStarted: 0,
    },
    currentLease: null,
    openAttemptId: null,
    tasks: [
      {
        taskId: "task:foreground",
        sourceLane: CollectionRunnerSourceLane.Exchange,
        state,
        aggregateVersion: 1,
        requiredActionAtUtc: "2026-07-25T13:59:00.000Z",
        evidenceCutoffAtUtc: "2026-07-25T14:05:00.000Z",
        deadlineAtUtc: "2026-07-25T14:06:00.000Z",
        retryEligibleAtUtc: null,
        attemptsStarted: 0,
        taskFingerprint: SHA_A,
      },
    ],
    observedAtUtc: "2026-07-25T14:00:00.002Z",
    ...changes,
  };
}

function preflight(
  observedAtUtc: string,
  ready = true,
): CollectionRunnerRuntimePreflightReport {
  return {
    observedAtUtc,
    configurationFingerprint: SHA_A,
    pathFingerprint: SHA_B,
    storeIdentity: SHA_C,
    schemaCatalogChecksum: SHA_D,
    recoveryReportFingerprint: SHA_A,
    safety: {
      configurationVerified: true,
      ownershipVerified: true,
      storeReady: ready,
      integrityVerified: ready,
      clockHealthy: true,
      sessionAuthorized: true,
      stopBarrierTripped: false,
      blockerCodes: ready ? [] : ["STORE_NOT_READY"],
    },
    ready,
    health: ready
      ? CollectionRunnerRuntimeHealthStatus.Healthy
      : CollectionRunnerRuntimeHealthStatus.FailClosed,
    deterministic: true,
    fingerprint: SHA_D,
  };
}

interface Harness {
  readonly step: EventContractCollectionRunnerRuntimeForegroundStep;
  readonly calls: string[];
  readonly setCloseFailure: () => void;
}

function harness(
  state: CollectionRunnerTaskState,
  changes: Readonly<{
    preflightReady?: boolean;
    snapshotChanges?: Partial<CollectionRunnerRuntimeWorkSnapshotInput>;
    activationId?: string;
    planner?: EventContractCollectionRunnerRuntimeAssemblyPlanner;
    terminalHealthy?: boolean;
  }> = {},
): Harness {
  const calls: string[] = [];
  let clockIndex = 0;
  let closeFailure = false;
  const dependencies: EventContractCollectionRunnerRuntimeForegroundStepDependencies = {
      startup: {
        start: () => {
          calls.push("startup");
          return {
            identity: {
              configurationFingerprint: SHA_A,
              pathFingerprint: SHA_B,
              storeIdentity: SHA_C,
              lockFingerprint: SHA_D,
              bootIdentity: "boot:foreground",
              processSessionId: "process:foreground",
              activationId:
                changes.activationId ?? "activation:foreground",
              buildFingerprint: SHA_A,
              runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
            },
            createPreflight: (observedAtUtc) => {
              calls.push("preflight");
              return preflight(
                observedAtUtc,
                changes.preflightReady ?? true,
              );
            },
            workSnapshots: {
              readWorkSnapshot: (input) => {
                calls.push("snapshot");
                return createCollectionRunnerRuntimeWorkSnapshot(
                  workInput(state, {
                    ...changes.snapshotChanges,
                    observedAtUtc: input.observedAtUtc,
                  }),
                );
              },
            },
            t6Executor: {
              execute: (input) => {
                calls.push("t6");
                return {
                  taskId: input.taskId,
                  resultingState:
                    input.action ===
                    CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue
                      ? CollectionRunnerTaskState.Due
                      : CollectionRunnerTaskState.Missed,
                  resultingAggregateVersion: input.expectedTaskVersion + 1,
                  transitionReceiptFingerprint: SHA_B,
                  deterministic: true,
                  fingerprint: SHA_C,
                };
              },
            },
            fixtureExecutor: {
              execute: (decision) => {
                calls.push("fixture");
                return {
                  workerResult: {
                    outcome:
                      CollectionRunnerFixtureWorkerOutcome.EvidenceCommitted,
                    taskId: decision.taskId!,
                    attemptId: "attempt:foreground",
                    evidenceId: "evidence:foreground",
                    reasonCode: "FIXTURE_EVIDENCE_COMMITTED",
                    deterministic: true,
                  },
                  receiptFingerprint: SHA_C,
                };
              },
            },
            stopExecutor: {
              execute: () => {
                calls.push("stop");
                return { taskId: null, receiptFingerprint: SHA_D };
              },
            },
            terminalState: {
              read: () => {
                calls.push("terminal");
                const stopped = calls.includes("stop");
                return {
                  healthStatus:
                    changes.terminalHealthy === false
                      ? CollectionRunnerRuntimeHealthStatus.FailClosed
                      : stopped
                        ? CollectionRunnerRuntimeHealthStatus.FailClosed
                        : CollectionRunnerRuntimeHealthStatus.Healthy,
                  blockerCodes:
                    changes.terminalHealthy === false
                      ? ["TERMINAL_STATE_UNSAFE"]
                      : stopped
                        ? ["OWNER_STOP_ACTIVE"]
                        : [],
                  stopBarrierTripped: stopped,
                };
              },
            },
            resources: {
              close: () => {
                calls.push("close");
                if (closeFailure) throw new Error("simulated close failure");
              },
              releaseOwnership: () => {
                calls.push("release");
              },
            },
          };
        },
      },
      clock: {
        sample: () => {
          const current = clockIndex++;
          return {
            observedAtUtc: new Date(START + current).toISOString(),
            monotonicMilliseconds: current,
            healthy: true,
          };
        },
      },
      planner:
        changes.planner ??
        new EventContractCollectionRunnerRuntimeAssemblyPlanner(),
    };
  return {
    step: new EventContractCollectionRunnerRuntimeForegroundStep(dependencies),
    calls,
    setCloseFailure: () => {
      closeFailure = true;
    },
  };
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "scheduled task performs one T6 transition and exits",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled);
      const report = context.step.run(request());
      assertEqual(report.outcome, CollectionRunnerRuntimeStepOutcome.Completed, "outcome");
      assertEqual(
        report.action,
        CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
        "action",
      );
      assertEqual(context.calls.filter((value) => value === "t6").length, 1, "t6");
      assertEqual(context.calls.includes("fixture"), false, "fixture");
      assertEqual(context.calls.at(-1), "release", "clean release");
    },
  ],
  [
    "due task performs exactly one fixture cycle and exits",
    () => {
      const context = harness(CollectionRunnerTaskState.Due);
      const report = context.step.run(request());
      assertEqual(
        report.action,
        CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask,
        "action",
      );
      assertEqual(
        context.calls.filter((value) => value === "fixture").length,
        1,
        "fixture",
      );
      assertEqual(context.calls.includes("t6"), false, "t6");
      assertEqual(report.durableReceiptFingerprint, SHA_C, "receipt");
    },
  ],
  [
    "closed evidence window performs one missed transition",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled, {
        snapshotChanges: {
          tasks: [
            {
              ...workInput(CollectionRunnerTaskState.Scheduled).tasks[0]!,
              evidenceCutoffAtUtc: "2026-07-25T14:00:00.001Z",
              deadlineAtUtc: "2026-07-25T14:00:00.005Z",
            },
          ],
        },
      });
      const report = context.step.run(request());
      assertEqual(
        report.action,
        CollectionRunnerRuntimeAssemblyAction.MarkExactTaskMissed,
        "action",
      );
      assertEqual(context.calls.filter((value) => value === "t6").length, 1, "t6");
    },
  ],
  [
    "future task reports no work without mutation",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled, {
        snapshotChanges: {
          tasks: [
            {
              ...workInput(CollectionRunnerTaskState.Scheduled).tasks[0]!,
              requiredActionAtUtc: "2026-07-25T14:01:00.000Z",
              evidenceCutoffAtUtc: "2026-07-25T14:05:00.000Z",
              deadlineAtUtc: "2026-07-25T14:06:00.000Z",
            },
          ],
        },
      });
      const report = context.step.run(request());
      assertEqual(report.outcome, CollectionRunnerRuntimeStepOutcome.NoWork, "outcome");
      assertEqual(report.durableMutationAttempted, false, "mutation");
      assertEqual(context.calls.includes("t6"), false, "t6");
      assertEqual(context.calls.includes("fixture"), false, "fixture");
    },
  ],
  [
    "no open tasks completes without mutation",
    () => {
      const context = harness(CollectionRunnerTaskState.Committed);
      const report = context.step.run(request());
      assertEqual(
        report.action,
        CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
        "action",
      );
      assertEqual(report.durableMutationAttempted, false, "mutation");
    },
  ],
  [
    "durable stop executes only the stop boundary",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled, {
        snapshotChanges: {
          pilotState: CollectionRunnerPilotState.StopRequested,
        },
      });
      const report = context.step.run(request());
      assertEqual(report.outcome, CollectionRunnerRuntimeStepOutcome.Stopped, "outcome");
      assertEqual(context.calls.filter((value) => value === "stop").length, 1, "stop");
      assertEqual(context.calls.includes("t6"), false, "t6");
      assertEqual(context.calls.includes("fixture"), false, "fixture");
    },
  ],
  [
    "emergency stop evidence executes only emergency stop",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled, {
        snapshotChanges: { emergencyStopObserved: true },
      });
      const report = context.step.run(request());
      assertEqual(
        report.action,
        CollectionRunnerRuntimeAssemblyAction.TripEmergencyStop,
        "action",
      );
      assertEqual(report.stopBarrierTripped, true, "barrier");
      assertEqual(context.calls.filter((value) => value === "stop").length, 1, "stop");
    },
  ],
  [
    "preflight blocker prevents snapshot planner and mutation",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled, {
        preflightReady: false,
      });
      const report = context.step.run(request());
      assertEqual(report.outcome, CollectionRunnerRuntimeStepOutcome.Blocked, "outcome");
      assertEqual(context.calls.includes("snapshot"), false, "snapshot");
      assertEqual(context.calls.includes("t6"), false, "t6");
      assertEqual(report.blockerCodes[0], "STORE_NOT_READY", "blocker");
    },
  ],
  [
    "planner is called exactly once",
    () => {
      let count = 0;
      const base = new EventContractCollectionRunnerRuntimeAssemblyPlanner();
      const planner = {
        plan: (input: Parameters<typeof base.plan>[0]): CollectionRunnerRuntimeAssemblyDecision => {
          count += 1;
          return base.plan(input);
        },
      } as EventContractCollectionRunnerRuntimeAssemblyPlanner;
      const context = harness(CollectionRunnerTaskState.Scheduled, { planner });
      context.step.run(request());
      assertEqual(count, 1, "planner calls");
    },
  ],
  [
    "snapshot is read exactly once",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled);
      context.step.run(request());
      assertEqual(
        context.calls.filter((value) => value === "snapshot").length,
        1,
        "snapshot calls",
      );
    },
  ],
  [
    "close precedes ownership release",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled);
      context.step.run(request());
      assertTrue(
        context.calls.indexOf("close") < context.calls.indexOf("release"),
        "order",
      );
    },
  ],
  [
    "terminal durable state is reread exactly once before close",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled);
      context.step.run(request());
      assertEqual(
        context.calls.filter((value) => value === "terminal").length,
        1,
        "terminal reads",
      );
      assertTrue(
        context.calls.indexOf("terminal") < context.calls.indexOf("close"),
        "terminal before close",
      );
    },
  ],
  [
    "unsafe terminal reread preserves mutation ambiguity and ownership",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled, {
        terminalHealthy: false,
      });
      const report = context.step.run(request());
      assertEqual(report.outcome, CollectionRunnerRuntimeStepOutcome.Ambiguous, "outcome");
      assertEqual(report.recoveryRequired, true, "recovery");
      assertEqual(context.calls.includes("release"), false, "release");
    },
  ],
  [
    "post-mutation close failure preserves ambiguity and ownership",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled);
      context.setCloseFailure();
      const report = context.step.run(request());
      assertEqual(report.outcome, CollectionRunnerRuntimeStepOutcome.Ambiguous, "outcome");
      assertEqual(report.recoveryRequired, true, "recovery");
      assertEqual(
        report.cleanupDisposition,
        CollectionRunnerRuntimeCleanupDisposition.OwnershipPreservedForRecovery,
        "cleanup",
      );
      assertEqual(context.calls.includes("release"), false, "release");
    },
  ],
  [
    "activation identity mismatch fails before any work read",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled, {
        activationId: "activation:different",
      });
      const report = context.step.run(request());
      assertEqual(
        report.outcome,
        CollectionRunnerRuntimeStepOutcome.FailedClosed,
        "outcome",
      );
      assertEqual(context.calls.includes("snapshot"), false, "snapshot");
      assertEqual(context.calls.includes("release"), false, "release");
    },
  ],
  [
    "closed request rejects unknown fields",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled);
      let threw = false;
      try {
        context.step.run({
          ...request(),
          providerUrl: "https://example.invalid",
        } as CollectionRunnerRuntimeForegroundStepRequest);
      } catch {
        threw = true;
      }
      assertTrue(threw, "unknown field");
      assertEqual(context.calls.length, 0, "side effects");
    },
  ],
  [
    "closed request rejects excessive snapshot bound",
    () => {
      const context = harness(CollectionRunnerTaskState.Scheduled);
      let threw = false;
      try {
        context.step.run({ ...request(), maximumTasks: 10_001 });
      } catch {
        threw = true;
      }
      assertTrue(threw, "maximum tasks");
      assertEqual(context.calls.length, 0, "side effects");
    },
  ],
];

let passed = 0;
for (const [name, run] of tests) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(
  `Event Contract Collection Runner foreground step tests: ${passed}/${tests.length} passed.`,
);
