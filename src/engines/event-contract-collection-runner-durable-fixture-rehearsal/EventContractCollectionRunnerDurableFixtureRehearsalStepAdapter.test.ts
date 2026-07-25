import {
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeCleanupDisposition,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeInvocationState,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerTaskState,
  DurableFixtureRehearsalPhase,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
  type DurableFixtureRehearsalOperationClaim,
  type DurableFixtureRehearsalPhaseRequest,
} from "../../contracts";
import { createCollectionRunnerRuntimeTerminalReport } from "../event-contract-collection-runner-runtime";
import {
  EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter,
  type DurableFixtureRehearsalAfterStepObservation,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter";

const FP1 = "fnv1a64:1111111111111111";
const FP2 = "fnv1a64:2222222222222222";
const FP3 = "fnv1a64:3333333333333333";
const FP4 = "fnv1a64:4444444444444444";
const AT = "2026-07-25T18:00:00.000Z";

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function throws(run: () => unknown, expected: string): void {
  try {
    run();
  } catch (error) {
    assertTrue(error instanceof Error, "typed error");
    assertTrue((error as Error).message.includes(expected), "error message");
    return;
  }
  throw new Error(`Expected error containing ${expected}.`);
}

const request: DurableFixtureRehearsalPhaseRequest = {
  schemaVersion:
    EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
  registeredManifestId: "registered-manifest-1",
  registeredPhaseId: "registered-step-1",
  rehearsalId: "rehearsal-1",
  manifestFingerprint: FP1,
  phase: DurableFixtureRehearsalPhase.Step,
  expectedLifecycleVersion: 4,
  expectedInvocationOrdinal: 1,
  expectedRecoveryFingerprint: FP2,
  invocationId: "invocation-1",
  ownerAuthorizationId: null,
};

const claim = {
  claimId: "claim-1",
  rehearsalId: "rehearsal-1",
  manifestFingerprint: FP1,
  phase: DurableFixtureRehearsalPhase.Step,
  invocationOrdinal: 1,
  expectedLifecycleVersion: 4,
  expectedRecoveryFingerprint: FP2,
  requestFingerprint: FP3,
  processSessionId: "session-1",
  bootIdentity: "boot-1",
  ownerAuthorizationId: null,
  claimedAtUtc: AT,
  deterministic: true,
  fingerprint: FP4,
} satisfies DurableFixtureRehearsalOperationClaim;

function terminalReport(
  changes: Partial<Parameters<typeof createCollectionRunnerRuntimeTerminalReport>[0]> = {},
) {
  return createCollectionRunnerRuntimeTerminalReport({
    schemaVersion: "1.0",
    configurationFingerprint: FP1,
    pathFingerprint: FP2,
    storeIdentity: FP3,
    lockFingerprint: FP4,
    bootIdentity: claim.bootIdentity,
    processSessionId: claim.processSessionId,
    activationId: "activation-1",
    buildFingerprint: FP1,
    invocationId: request.invocationId,
    startedAtUtc: AT,
    endedAtUtc: "2026-07-25T18:00:01.000Z",
    elapsedMonotonicMilliseconds: 1_000,
    finalState: CollectionRunnerRuntimeInvocationState.Closed,
    outcome: CollectionRunnerRuntimeStepOutcome.Completed,
    healthStatus: CollectionRunnerRuntimeHealthStatus.Healthy,
    blockerCodes: [],
    action: CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask,
    taskId: "task-1",
    reasonCode: "STEP_COMPLETED",
    durableMutationAttempted: true,
    durableReceiptFingerprint: FP4,
    stopBarrierTripped: false,
    cleanupDisposition:
      CollectionRunnerRuntimeCleanupDisposition.VerifiedCleanRelease,
    ambiguityPreserved: false,
    recoveryRequired: false,
    ...changes,
  });
}

const observation: DurableFixtureRehearsalAfterStepObservation = {
  resultingPilotState: CollectionRunnerPilotState.Active,
  resultingTaskState: CollectionRunnerTaskState.Committed,
  outboxChronologyFingerprint: FP3,
  recoveryFingerprint: FP4,
};

function harness(report = terminalReport(), observed = observation) {
  const counters = { foreground: 0, observation: 0 };
  const adapter =
    new EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter(
      {
        run: () => {
          counters.foreground += 1;
          return report;
        },
      },
      {
        resolve: (input) => ({
          schemaVersion: "1.0",
          invocationId: input.invocationId,
          activationId: "activation-1",
          maximumTasks: 1,
        }),
      },
      {
        read: () => {
          counters.observation += 1;
          return observed;
        },
      },
    );
  return { adapter, counters };
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["one foreground invocation produces strict durable evidence", () => {
    const value = harness();
    const evidence = value.adapter.executeOne(request, claim);
    assertEqual(value.counters.foreground, 1, "foreground calls");
    assertEqual(value.counters.observation, 1, "observation calls");
    assertEqual(
      evidence.selectedAction,
      CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask,
      "action",
    );
    assertEqual(evidence.terminalReportFingerprint, terminalReport().fingerprint, "report");
    assertEqual(evidence.recoveryFingerprint, FP4, "recovery");
  }],
  ["registered request cannot change invocation identity", () => {
    const value = harness();
    const changed =
      new EventContractCollectionRunnerDurableFixtureRehearsalStepAdapter(
        { run: () => terminalReport() },
        {
          resolve: () => ({
            schemaVersion: "1.0",
            invocationId: "changed",
            activationId: "activation-1",
            maximumTasks: 1,
          }),
        },
        { read: () => observation },
      );
    throws(
      () => changed.executeOne(request, claim),
      "changed the invocation identity",
    );
    assertEqual(value.counters.foreground, 0, "unrelated harness");
  }],
  ["tampered terminal report fails before observation", () => {
    const valid = terminalReport();
    const value = harness({ ...valid, fingerprint: FP1 });
    throws(
      () => value.adapter.executeOne(request, claim),
      "fingerprint is invalid",
    );
    assertEqual(value.counters.foreground, 1, "foreground calls");
    assertEqual(value.counters.observation, 0, "observation calls");
  }],
  ["claim process identity must match terminal report", () => {
    const value = harness(terminalReport({ processSessionId: "changed-session" }));
    throws(
      () => value.adapter.executeOne(request, claim),
      "cannot prove one clean fixture action",
    );
    assertEqual(value.counters.observation, 0, "observation calls");
  }],
  ["recovery-required terminal report cannot become step evidence", () => {
    const value = harness(terminalReport({
      finalState: CollectionRunnerRuntimeInvocationState.RecoveryBlocked,
      outcome: CollectionRunnerRuntimeStepOutcome.Ambiguous,
      healthStatus: CollectionRunnerRuntimeHealthStatus.FailClosed,
      blockerCodes: ["RECOVERY_REQUIRED"],
      cleanupDisposition:
        CollectionRunnerRuntimeCleanupDisposition.OwnershipPreservedForRecovery,
      ambiguityPreserved: true,
      recoveryRequired: true,
    }));
    throws(
      () => value.adapter.executeOne(request, claim),
      "cannot prove one clean fixture action",
    );
    assertEqual(value.counters.observation, 0, "observation calls");
  }],
  ["stop-tripped terminal report cannot become step evidence", () => {
    const value = harness(terminalReport({
      finalState: CollectionRunnerRuntimeInvocationState.Closed,
      outcome: CollectionRunnerRuntimeStepOutcome.Stopped,
      healthStatus: CollectionRunnerRuntimeHealthStatus.Degraded,
      blockerCodes: ["STOP_BARRIER_TRIPPED"],
      action: null,
      taskId: null,
      durableMutationAttempted: false,
      durableReceiptFingerprint: null,
      stopBarrierTripped: true,
    }));
    throws(
      () => value.adapter.executeOne(request, claim),
      "cannot prove one clean fixture action",
    );
    assertEqual(value.counters.observation, 0, "observation calls");
  }],
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
console.log(`Durable Fixture Rehearsal step adapter: ${passed}/${tests.length} passed.`);
