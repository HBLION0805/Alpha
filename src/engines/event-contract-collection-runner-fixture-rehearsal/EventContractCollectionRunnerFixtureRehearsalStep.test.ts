import {
  COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalFaultScenario,
  CollectionRunnerRehearsalLifecycleState,
  CollectionRunnerRehearsalScenarioPhase,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeCleanupDisposition,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeInvocationState,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type CollectionRunnerRehearsalPreparationResult,
  type CollectionRunnerRehearsalStepRequest,
  type CollectionRunnerRuntimeTerminalReport,
} from "../../contracts";
import { createCollectionRunnerRuntimeTerminalReport } from "../event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeAssemblyPlanner";
import { createCollectionRunnerRehearsalManifest } from "./EventContractCollectionRunnerFixtureRehearsalEngine";
import {
  CollectionRunnerRehearsalStepError,
  CollectionRunnerRehearsalStepErrorCode,
  EventContractCollectionRunnerFixtureRehearsalStep,
  InMemoryCollectionRunnerRehearsalStepLedger,
  createCollectionRunnerRehearsalDurableStateObservation,
  type CollectionRunnerRehearsalDurableStatePort,
  type CollectionRunnerRehearsalForegroundStepPort,
  type CollectionRunnerRehearsalOwnerAuthorizationPort,
} from "./EventContractCollectionRunnerFixtureRehearsalStep";

const FNV_A = "fnv1a64:aaaaaaaaaaaaaaaa";
const FNV_B = "fnv1a64:bbbbbbbbbbbbbbbb";
const SHA_A = `sha256:${"a".repeat(64)}`;
const SHA_B = `sha256:${"b".repeat(64)}`;
const SHA_C = `sha256:${"c".repeat(64)}`;
const SHA_D = `sha256:${"d".repeat(64)}`;
const NOW = "2026-07-25T14:00:00.000Z";

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
}
function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}
function throws(run: () => unknown, code: CollectionRunnerRehearsalStepErrorCode, label: string): void {
  try {
    run();
  } catch (error) {
    if (error instanceof CollectionRunnerRehearsalStepError && error.code === code) return;
    throw error;
  }
  throw new Error(`${label}: expected ${code}.`);
}

const manifest = createCollectionRunnerRehearsalManifest({
  schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  policyVersion: "1.0",
  scenarioId: "scenario:step",
  scenarioPurpose: "Run explicit fixture actions",
  ownerApprovalId: "approval:step",
  ownerApprovalFingerprint: SHA_A,
  ownerApprovalExpiresAtUtc: "2026-07-26T14:00:00.000Z",
  buildFingerprint: FNV_A,
  runnerFingerprint: FNV_B,
  frozenPlanFingerprint: SHA_B,
  fixtureCatalogFingerprint: SHA_C,
  fixturePackageFingerprint: SHA_D,
  providerFingerprint: FNV_A,
  mappingFingerprint: FNV_B,
  syntheticActivationFingerprint: SHA_A,
  syntheticTaskFingerprint: SHA_B,
  runtimeConfigurationTemplateFingerprint: SHA_C,
  expectedInvocations: [
    { ordinal: 1, action: CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue, resultingTaskState: CollectionRunnerTaskState.Due },
    { ordinal: 2, action: CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask, resultingTaskState: CollectionRunnerTaskState.Committed },
    { ordinal: 3, action: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit, resultingTaskState: CollectionRunnerTaskState.Committed },
  ],
  expectedPilotState: CollectionRunnerPilotState.Completed,
  expectedTaskState: CollectionRunnerTaskState.Committed,
  expectedOutboxRecordIds: [],
  maximumInvocations: 3,
  faultScenario: CollectionRunnerRehearsalFaultScenario.None,
  evidencePackagePolicyVersion: "1.0",
  retentionPolicyVersion: "1.0",
  nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
});

const preparation = {
  manifest,
  catalogEntry: {
    pilotActivation: { activationId: "activation:step" },
  },
  runtimeConfiguration: { fingerprint: SHA_A },
  runtimePaths: {
    pathFingerprint: SHA_B,
    storePathIdentity: SHA_C,
  },
  preparationReceipt: {
    seededStoreFingerprint: SHA_A,
  },
  lifecycleTransition: {
    toVersion: 2,
  },
} as unknown as CollectionRunnerRehearsalPreparationResult;

function request(
  ordinal = 1,
  changes: Partial<CollectionRunnerRehearsalStepRequest> = {},
): CollectionRunnerRehearsalStepRequest {
  const versions = [2, 5, 7];
  const recoveries = [SHA_A, SHA_B, SHA_C];
  const phases = [
    CollectionRunnerRehearsalScenarioPhase.DueTransition,
    CollectionRunnerRehearsalScenarioPhase.FixtureWorker,
    CollectionRunnerRehearsalScenarioPhase.TerminalObservation,
  ];
  return {
    rehearsalId: manifest.rehearsalId,
    manifestFingerprint: manifest.fingerprint,
    expectedInvocationOrdinal: ordinal,
    expectedLifecycleVersion: versions[ordinal - 1]!,
    expectedRecoveryFingerprint: recoveries[ordinal - 1]!,
    scenarioPhase: phases[ordinal - 1]!,
    invocationId: `invocation:step:${ordinal}`,
    maximumTasks: 1,
    ownerAuthorizationId: null,
    ...changes,
  };
}

function report(
  ordinal: number,
  changes: Partial<CollectionRunnerRuntimeTerminalReport> = {},
): CollectionRunnerRuntimeTerminalReport {
  const expected = manifest.expectedInvocations[ordinal - 1]!;
  const {
    deterministic: changedDeterministic,
    fingerprint: changedFingerprint,
    ...inputChanges
  } = changes;
  const created = createCollectionRunnerRuntimeTerminalReport({
    schemaVersion: "1.0",
    configurationFingerprint: SHA_A,
    pathFingerprint: SHA_B,
    storeIdentity: SHA_C,
    lockFingerprint: SHA_D,
    bootIdentity: `boot:step:${ordinal}`,
    processSessionId: `process:step:${ordinal}`,
    activationId: "activation:step",
    buildFingerprint: FNV_A,
    invocationId: `invocation:step:${ordinal}`,
    startedAtUtc: NOW,
    endedAtUtc: "2026-07-25T14:00:01.000Z",
    elapsedMonotonicMilliseconds: 1_000,
    finalState: CollectionRunnerRuntimeInvocationState.Closed,
    outcome: CollectionRunnerRuntimeStepOutcome.Completed,
    healthStatus: CollectionRunnerRuntimeHealthStatus.Healthy,
    blockerCodes: [],
    action: expected.action,
    taskId: expected.action === CollectionRunnerRuntimeAssemblyAction.CompleteAndExit ? null : "task:step",
    reasonCode: "STEP_COMPLETED",
    durableMutationAttempted: expected.action !== CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
    durableReceiptFingerprint: expected.action === CollectionRunnerRuntimeAssemblyAction.CompleteAndExit ? null : SHA_D,
    stopBarrierTripped: false,
    cleanupDisposition: CollectionRunnerRuntimeCleanupDisposition.VerifiedCleanRelease,
    ambiguityPreserved: false,
    recoveryRequired: false,
    ...inputChanges,
  });
  return {
    ...created,
    ...(changedDeterministic === undefined ? {} : { deterministic: changedDeterministic }),
    ...(changedFingerprint === undefined ? {} : { fingerprint: changedFingerprint }),
  };
}

interface Harness {
  readonly coordinator: EventContractCollectionRunnerFixtureRehearsalStep;
  readonly ledger: InMemoryCollectionRunnerRehearsalStepLedger;
  readonly foregroundCalls: number[];
  readonly authorizationChecks: string[];
  setAuthorizationAccepted(value: boolean): void;
  setReportChanges(value: Partial<CollectionRunnerRuntimeTerminalReport>): void;
  setDurableChanges(value: Record<string, unknown>): void;
}

function harness(): Harness {
  const ledger = new InMemoryCollectionRunnerRehearsalStepLedger(preparation);
  const foregroundCalls: number[] = [];
  let reportChanges: Partial<CollectionRunnerRuntimeTerminalReport> = {};
  let durableChanges: Record<string, unknown> = {};
  let authorizationAccepted = true;
  const authorizationChecks: string[] = [];
  const foreground: CollectionRunnerRehearsalForegroundStepPort = {
    run: (input) => {
      const ordinal = Number(input.invocationId.split(":").at(-1));
      foregroundCalls.push(ordinal);
      return report(ordinal, reportChanges);
    },
  };
  const durable: CollectionRunnerRehearsalDurableStatePort = {
    readAfterStep: (stepRequest) => {
      const ordinal = stepRequest.expectedInvocationOrdinal;
      const states = [CollectionRunnerTaskState.Due, CollectionRunnerTaskState.Committed, CollectionRunnerTaskState.Committed];
      const pilots = [CollectionRunnerPilotState.Active, CollectionRunnerPilotState.Active, CollectionRunnerPilotState.Completed];
      const recoveries = [SHA_B, SHA_C, SHA_D];
      const observed = createCollectionRunnerRehearsalDurableStateObservation({
        rehearsalId: manifest.rehearsalId,
        manifestFingerprint: manifest.fingerprint,
        invocationOrdinal: ordinal,
        pilotState: pilots[ordinal - 1]!,
        taskState: states[ordinal - 1]!,
        recoveryFingerprint: recoveries[ordinal - 1]!,
        stateVersion: ordinal + 2,
        observedAtUtc: "2026-07-25T14:00:02.000Z",
      });
      return { ...observed, ...durableChanges } as typeof observed;
    },
  };
  const authorization: CollectionRunnerRehearsalOwnerAuthorizationPort = {
    verifyUnexpiredLocalOwnerAuthorization: (stepRequest) => {
      authorizationChecks.push(stepRequest.ownerAuthorizationId!);
      return authorizationAccepted;
    },
  };
  return {
    coordinator: new EventContractCollectionRunnerFixtureRehearsalStep(
      preparation,
      foreground,
      durable,
      ledger,
      authorization,
    ),
    ledger,
    foregroundCalls,
    authorizationChecks,
    setAuthorizationAccepted: (value) => { authorizationAccepted = value; },
    setReportChanges: (value) => { reportChanges = value; },
    setDurableChanges: (value) => { durableChanges = value; },
  };
}

function advance(h: Harness, through: number): void {
  for (let ordinal = 1; ordinal <= through; ordinal += 1) h.coordinator.run(request(ordinal));
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["first explicit invocation performs one foreground call", () => {
    const h = harness();
    const result = h.coordinator.run(request());
    equal(h.foregroundCalls.length, 1, "foreground count");
    equal(result.invocationReceipt.selectedAction, CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue, "action");
    equal(result.resultingLifecycleState, CollectionRunnerRehearsalLifecycleState.Ready, "state");
  }],
  ["three separate invocations complete the frozen sequence", () => {
    const h = harness();
    advance(h, 2);
    const result = h.coordinator.run(request(3));
    equal(h.foregroundCalls.length, 3, "foreground calls");
    equal(result.resultingLifecycleState, CollectionRunnerRehearsalLifecycleState.Completed, "completed");
    equal(result.resultingLifecycleVersion, 10, "lifecycle version");
  }],
  ["result and nested receipt are immutable", () => {
    const result = harness().coordinator.run(request());
    truth(Object.isFrozen(result) && Object.isFrozen(result.invocationReceipt) && Object.isFrozen(result.lifecycleTransitions), "immutable");
  }],
  ["exact replay returns receipt without another foreground call", () => {
    const h = harness();
    const first = h.coordinator.run(request());
    const replay = h.coordinator.run(request());
    equal(replay.replayed, true, "replay");
    equal(replay.invocationReceipt.fingerprint, first.invocationReceipt.fingerprint, "receipt");
    equal(h.foregroundCalls.length, 1, "one execution");
  }],
  ["changed replay fails closed", () => {
    const h = harness();
    h.coordinator.run(request());
    throws(() => h.coordinator.run(request(1, { invocationId: "invocation:changed" })), CollectionRunnerRehearsalStepErrorCode.ReplayConflict, "changed replay");
  }],
  ["ordinal skipping fails before foreground execution", () => {
    const h = harness();
    throws(() => h.coordinator.run(request(2)), CollectionRunnerRehearsalStepErrorCode.StateConflict, "ordinal skip");
    equal(h.foregroundCalls.length, 0, "no foreground");
  }],
  ["stale lifecycle version fails closed", () => {
    const h = harness();
    throws(() => h.coordinator.run(request(1, { expectedLifecycleVersion: 9 })), CollectionRunnerRehearsalStepErrorCode.StateConflict, "version");
  }],
  ["changed recovery identity fails closed", () => {
    const h = harness();
    throws(() => h.coordinator.run(request(1, { expectedRecoveryFingerprint: SHA_D })), CollectionRunnerRehearsalStepErrorCode.StateConflict, "recovery");
  }],
  ["scenario phase must match frozen action", () => {
    const h = harness();
    throws(() => h.coordinator.run(request(1, { scenarioPhase: CollectionRunnerRehearsalScenarioPhase.FixtureWorker })), CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "phase");
  }],
  ["ordinary phase rejects owner authorization injection", () => {
    const h = harness();
    throws(() => h.coordinator.run(request(1, { ownerAuthorizationId: "authorization:injected" })), CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "authorization");
  }],
  ["Stop phase requires owner authorization", () => {
    const h = harness();
    throws(
      () => h.coordinator.run(request(1, {
        scenarioPhase: CollectionRunnerRehearsalScenarioPhase.Stop,
      })),
      CollectionRunnerRehearsalStepErrorCode.InvalidRequest,
      "missing Stop authorization",
    );
  }],
  ["expired local Owner authorization is rejected", () => {
    const h = harness();
    h.setAuthorizationAccepted(false);
    throws(
      () => h.coordinator.run(request(1, {
        scenarioPhase: CollectionRunnerRehearsalScenarioPhase.Stop,
        ownerAuthorizationId: "authorization:expired",
      })),
      CollectionRunnerRehearsalStepErrorCode.AuthorizationRejected,
      "expired authorization",
    );
    equal(h.authorizationChecks.length, 1, "authorization check");
    equal(h.foregroundCalls.length, 0, "no foreground");
  }],
  ["unknown request field is rejected", () => {
    const h = harness();
    throws(() => h.coordinator.run({ ...request(), leverage: 3 } as unknown as CollectionRunnerRehearsalStepRequest), CollectionRunnerRehearsalStepErrorCode.InvalidRequest, "unknown field");
  }],
  ["foreground action substitution fails closed and records failure", () => {
    const h = harness();
    h.setReportChanges({ action: CollectionRunnerRuntimeAssemblyAction.WaitAndExit });
    throws(() => h.coordinator.run(request()), CollectionRunnerRehearsalStepErrorCode.ForegroundMismatch, "action mismatch");
    equal(h.ledger.read(manifest.rehearsalId)?.lifecycleState, CollectionRunnerRehearsalLifecycleState.FailedClosed, "failed state");
    equal(h.ledger.getFailureReports().length, 1, "failure evidence");
  }],
  ["ambiguous mutation enters recovery required", () => {
    const h = harness();
    h.setReportChanges({
      outcome: CollectionRunnerRuntimeStepOutcome.Ambiguous,
      healthStatus: CollectionRunnerRuntimeHealthStatus.FailClosed,
      ambiguityPreserved: true,
      recoveryRequired: true,
      cleanupDisposition: CollectionRunnerRuntimeCleanupDisposition.OwnershipPreservedForRecovery,
      finalState: CollectionRunnerRuntimeInvocationState.FailedClosed,
    });
    throws(() => h.coordinator.run(request()), CollectionRunnerRehearsalStepErrorCode.RecoveryRequired, "recovery required");
    equal(h.ledger.read(manifest.rehearsalId)?.lifecycleState, CollectionRunnerRehearsalLifecycleState.RecoveryRequired, "recovery state");
  }],
  ["configuration identity mismatch requires recovery", () => {
    const h = harness();
    h.setReportChanges({ configurationFingerprint: SHA_D });
    throws(() => h.coordinator.run(request()), CollectionRunnerRehearsalStepErrorCode.RecoveryRequired, "identity");
  }],
  ["tampered terminal report fingerprint requires recovery", () => {
    const h = harness();
    h.setReportChanges({ fingerprint: SHA_D });
    throws(() => h.coordinator.run(request()), CollectionRunnerRehearsalStepErrorCode.RecoveryRequired, "report fingerprint");
  }],
  ["durable task-state mismatch requires recovery", () => {
    const h = harness();
    h.setDurableChanges({ taskState: CollectionRunnerTaskState.Committed });
    throws(() => h.coordinator.run(request()), CollectionRunnerRehearsalStepErrorCode.RecoveryRequired, "task state");
  }],
  ["durable observation fingerprint substitution requires recovery", () => {
    const h = harness();
    h.setDurableChanges({ fingerprint: SHA_D });
    throws(() => h.coordinator.run(request()), CollectionRunnerRehearsalStepErrorCode.RecoveryRequired, "durable fingerprint");
  }],
  ["unknown durable observation field requires recovery", () => {
    const h = harness();
    h.setDurableChanges({ providerPayload: "forbidden" });
    throws(() => h.coordinator.run(request()), CollectionRunnerRehearsalStepErrorCode.RecoveryRequired, "durable unknown field");
  }],
  ["final Pilot state must match the manifest", () => {
    const h = harness();
    advance(h, 2);
    h.setDurableChanges({ pilotState: CollectionRunnerPilotState.Active });
    throws(() => h.coordinator.run(request(3)), CollectionRunnerRehearsalStepErrorCode.RecoveryRequired, "pilot state");
  }],
  ["successful receipt binds terminal report and resulting recovery", () => {
    const result = harness().coordinator.run(request());
    equal(result.invocationReceipt.terminalReportFingerprint, result.terminalReport.fingerprint, "report binding");
    equal(result.invocationReceipt.recoveryFingerprint, SHA_B, "recovery binding");
  }],
];

let passed = 0;
for (const [name, run] of tests) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`Event Contract Collection Runner fixture rehearsal step: ${passed}/${tests.length} passed.`);
