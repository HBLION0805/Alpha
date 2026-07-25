import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerPilotState,
  CollectionRunnerTaskState,
  DurableFixtureRehearsalFailureDisposition,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  DurableFixtureRehearsalPhaseOutcome,
  DurableFixtureRehearsalReconciliationDisposition,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type DurableFixtureRehearsalPhaseRequest,
  type DurableFixtureRehearsalProcessContext,
  type DurableFixtureRehearsalReconciliationEvidence,
  type DurableFixtureRehearsalStepEvidence,
} from "../../contracts";
import {
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
} from "../../contracts/EventContractCollectionRunnerRuntimeAssembly";
import {
  createNewCollectionRunnerFixtureRehearsalSqliteProfile,
  createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository,
  type DurableFixtureRehearsalRepository,
} from "../../repositories";
import {
  DurableFixtureRehearsalCoordinatorError,
  DurableFixtureRehearsalCoordinatorErrorCode,
  EventContractCollectionRunnerDurableFixtureRehearsalCoordinator,
  type DurableFixtureRehearsalCoordinatorDependencies,
  type DurableFixtureRehearsalOwnershipLease,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalCoordinator";

const FP1 = "fnv1a64:1111111111111111";
const FP2 = "fnv1a64:2222222222222222";
const FP3 = "fnv1a64:3333333333333333";
const FP4 = "fnv1a64:4444444444444444";
const FP5 = "fnv1a64:5555555555555555";
const AT = "2026-07-25T18:00:00.000Z";

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectCoordinatorError(
  run: () => unknown,
  code: DurableFixtureRehearsalCoordinatorErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(error instanceof DurableFixtureRehearsalCoordinatorError, "typed error");
    assertEqual(
      (error as DurableFixtureRehearsalCoordinatorError).code,
      code,
      "error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

interface Harness {
  readonly root: string;
  readonly database: DatabaseSync;
  readonly repository: DurableFixtureRehearsalRepository;
  readonly dependencies: DurableFixtureRehearsalCoordinatorDependencies;
  readonly counters: {
    step: number;
    reconcile: number;
    released: number;
    preserved: number;
    stopChecks: number;
  };
  close(): void;
}

function seedActivation(database: DatabaseSync): void {
  database.prepare(`
INSERT INTO runner_definitions (
 runner_definition_id, version, fingerprint, build_fingerprint,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, '{}', ?)
`).run("runner-1", "1.0", FP2, FP1, AT);
  database.prepare(`
INSERT INTO pilot_activations (
 activation_id, activation_fingerprint, owner_id, approved_at_utc,
 starts_at_utc, stops_at_utc, frozen_plan_id, frozen_plan_fingerprint,
 runner_definition_id, runner_definition_version, maximum_events,
 maximum_requests, current_state, aggregate_version,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'COMPLETED', 1, '{}', ?)
`).run(
    "activation-1",
    FP3,
    "owner-1",
    "2026-07-25T17:00:00.000Z",
    "2026-07-25T17:30:00.000Z",
    "2026-07-25T19:00:00.000Z",
    "plan-1",
    FP4,
    "runner-1",
    "1.0",
    AT,
  );
}

function stepEvidence(): DurableFixtureRehearsalStepEvidence {
  return {
    selectedAction: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
    resultingPilotState: CollectionRunnerPilotState.Completed,
    resultingTaskState: CollectionRunnerTaskState.Committed,
    outcome: CollectionRunnerRuntimeStepOutcome.Completed,
    terminalReportFingerprint: FP1,
    durableTransitionFingerprint: FP2,
    outboxChronologyFingerprint: FP3,
    recoveryFingerprint: FP5,
  };
}

function createHarness(options: {
  readonly throwStep?: boolean;
  readonly reconciliation?: DurableFixtureRehearsalReconciliationEvidence;
  readonly stopTripped?: boolean;
  readonly stopAtCheck?: number;
  readonly authorization?: boolean;
  readonly repositoryAbsentBeforePrepare?: boolean;
} = {}): Harness {
  const root = mkdtempSync(join(tmpdir(), "alpha-durable-coordinator-"));
  const readiness = createNewCollectionRunnerFixtureRehearsalSqliteProfile({
    rootDirectory: root,
    storeId: "fixture-rehearsal",
    applicationBuildFingerprint: FP1,
    appliedAtUtc: AT,
  });
  const database = new DatabaseSync(readiness.storePath, {
    open: true,
    readOnly: false,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    defensive: true,
  });
  database.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA trusted_schema = OFF;
`);
  seedActivation(database);
  const repository =
    createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
      database,
    );
  const counters = {
    step: 0,
    reconcile: 0,
    released: 0,
    preserved: 0,
    stopChecks: 0,
  };
  const context: DurableFixtureRehearsalProcessContext = {
    processSessionId: "session-1",
    bootIdentity: "boot-1",
    observedAtUtc: AT,
  };
  const dependencies: DurableFixtureRehearsalCoordinatorDependencies = {
    repositories: {
      resolveExisting: () =>
        options.repositoryAbsentBeforePrepare ? null : repository,
      resolvePrepared: () => repository,
    },
    stop: {
      assertClear() {
        counters.stopChecks += 1;
        if (
          options.stopTripped ||
          options.stopAtCheck === counters.stopChecks
        ) {
          throw new DurableFixtureRehearsalCoordinatorError(
            DurableFixtureRehearsalCoordinatorErrorCode.StopTripped,
            "Stop is tripped.",
          );
        }
      },
    },
    ownerAuthorization: {
      verify: () => options.authorization ?? true,
    },
    ownership: {
      acquire: (): DurableFixtureRehearsalOwnershipLease => ({
        context,
        releaseClean() {
          counters.released += 1;
        },
        preserveAmbiguity() {
          counters.preserved += 1;
        },
      }),
    },
    preparation: {
      prepare: () => ({
        registry: {
          schemaVersion:
            EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
          rehearsalId: "rehearsal-1",
          manifestFingerprint: FP1,
          buildFingerprint: FP1,
          runnerFingerprint: FP2,
          frozenPlanFingerprint: FP4,
          catalogFingerprint: FP3,
          providerFingerprint: FP2,
          mappingFingerprint: FP3,
          activationId: "activation-1",
          taskSetFingerprint: FP4,
          workspaceIdentity: "workspace-1",
          storeIdentity: "store-1",
          lifecycleState: DurableFixtureRehearsalLifecycleState.Prepared,
          lifecycleVersion: 3,
          nextInvocationOrdinal: 1,
          recoveryFingerprint: FP4,
          maximumInvocations: 1,
          scenarioResultFingerprint: null,
          executionPackageFingerprint: null,
          nonAuthorityDeclaration: "FIXTURE_ONLY",
          createdAtUtc: AT,
        },
        preparingReasonCode: "PREPARATION_STARTED",
        preparedReasonCode: "PREPARATION_COMPLETED",
      }),
    },
    step: {
      executeOne: () => {
        counters.step += 1;
        if (options.throwStep) throw new Error("simulated process loss");
        return stepEvidence();
      },
    },
    reconciliation: {
      reconcile: () => {
        counters.reconcile += 1;
        return options.reconciliation ?? {
          disposition:
            DurableFixtureRehearsalReconciliationDisposition.ProvenSuccess,
          reasonCode: "RECOVERED_EXACT_SUCCESS",
          triggeringDisposition:
            DurableFixtureRehearsalFailureDisposition.RecoveryRequired,
          stepEvidence: stepEvidence(),
        };
      },
    },
    scenarioPolicy: {
      expectedAction: () =>
        CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
      isFinalOrdinal: () => true,
    },
  };
  return {
    root,
    database,
    repository,
    dependencies,
    counters,
    close() {
      database.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

function request(
  phase: DurableFixtureRehearsalPhase,
  changes: Partial<DurableFixtureRehearsalPhaseRequest> = {},
): DurableFixtureRehearsalPhaseRequest {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
    registeredManifestId: "manifest-1",
    registeredPhaseId: `phase-${phase.toLocaleLowerCase()}`,
    rehearsalId: "rehearsal-1",
    manifestFingerprint: FP1,
    phase,
    expectedLifecycleVersion: phase === DurableFixtureRehearsalPhase.Prepare ? 1 : 3,
    expectedInvocationOrdinal:
      phase === DurableFixtureRehearsalPhase.Step ? 1 : null,
    expectedRecoveryFingerprint: FP4,
    invocationId: `invocation-${phase.toLocaleLowerCase()}`,
    ownerAuthorizationId:
      phase === DurableFixtureRehearsalPhase.Recover ? "authorization-1" : null,
    ...changes,
  };
}

function prepare(harness: Harness): void {
  const coordinator =
    new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
      harness.dependencies,
    );
  assertEqual(
    coordinator.execute(request(DurableFixtureRehearsalPhase.Prepare)).outcome,
    DurableFixtureRehearsalPhaseOutcome.Prepared,
    "prepared",
  );
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["PREPARE persists exact durable lifecycle history", () => {
    const harness = createHarness();
    try {
      prepare(harness);
      const snapshot = harness.repository.readSnapshot("rehearsal-1")!;
      assertEqual(snapshot.registry.lifecycleState, DurableFixtureRehearsalLifecycleState.Prepared, "state");
      assertEqual(snapshot.registry.lifecycleVersion, 3, "version");
      assertEqual(snapshot.transitions.length, 2, "transitions");
      assertEqual(harness.counters.released, 1, "released");
    } finally {
      harness.close();
    }
  }],
  ["PREPARE resolves the newly created repository after preparation", () => {
    const harness = createHarness({ repositoryAbsentBeforePrepare: true });
    try {
      prepare(harness);
      const snapshot = harness.repository.readSnapshot("rehearsal-1")!;
      assertEqual(
        snapshot.registry.lifecycleState,
        DurableFixtureRehearsalLifecycleState.Prepared,
        "state",
      );
      assertEqual(snapshot.transitions.length, 2, "transitions");
    } finally {
      harness.close();
    }
  }],
  ["PREPARE exact replay does not rewrite history", () => {
    const harness = createHarness();
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      const replay = coordinator.execute(request(DurableFixtureRehearsalPhase.Prepare));
      assertEqual(replay.outcome, DurableFixtureRehearsalPhaseOutcome.Replayed, "outcome");
      assertEqual(harness.repository.readSnapshot("rehearsal-1")!.transitions.length, 2, "transitions");
    } finally {
      harness.close();
    }
  }],
  ["STEP claims before exactly one foreground action and completes", () => {
    const harness = createHarness();
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      const phaseResult = coordinator.execute(request(DurableFixtureRehearsalPhase.Step));
      const snapshot = harness.repository.readSnapshot("rehearsal-1")!;
      assertEqual(phaseResult.outcome, DurableFixtureRehearsalPhaseOutcome.StepCompleted, "outcome");
      assertEqual(harness.counters.step, 1, "step count");
      assertEqual(snapshot.registry.lifecycleState, DurableFixtureRehearsalLifecycleState.Completed, "state");
      assertEqual(snapshot.registry.lifecycleVersion, 7, "version");
      assertEqual(snapshot.registry.nextInvocationOrdinal, 2, "next ordinal");
      assertEqual(snapshot.claims.length, 1, "claims");
      assertEqual(snapshot.invocationReceipts.length, 1, "receipts");
    } finally {
      harness.close();
    }
  }],
  ["STEP exact replay never repeats foreground work", () => {
    const harness = createHarness();
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      const stepRequest = request(DurableFixtureRehearsalPhase.Step);
      coordinator.execute(stepRequest);
      const replay = coordinator.execute(stepRequest);
      assertEqual(replay.outcome, DurableFixtureRehearsalPhaseOutcome.Replayed, "outcome");
      assertEqual(harness.counters.step, 1, "step count");
    } finally {
      harness.close();
    }
  }],
  ["crash after claim preserves STEPPING ambiguity", () => {
    const harness = createHarness({ throwStep: true });
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      let failed = false;
      try {
        coordinator.execute(request(DurableFixtureRehearsalPhase.Step));
      } catch {
        failed = true;
      }
      assertTrue(failed, "failed");
      const snapshot = harness.repository.readSnapshot("rehearsal-1")!;
      assertEqual(snapshot.registry.lifecycleState, DurableFixtureRehearsalLifecycleState.Stepping, "state");
      assertEqual(snapshot.claims.length, 1, "claim");
      assertEqual(snapshot.invocationReceipts.length, 0, "receipt");
      assertEqual(harness.counters.preserved, 1, "ambiguity");
    } finally {
      harness.close();
    }
  }],
  ["unresolved STEP replay requires RECOVER and does not repeat work", () => {
    const harness = createHarness({ throwStep: true });
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      try {
        coordinator.execute(request(DurableFixtureRehearsalPhase.Step));
      } catch {
        // Expected simulated loss.
      }
      expectCoordinatorError(
        () => coordinator.execute(request(DurableFixtureRehearsalPhase.Step)),
        DurableFixtureRehearsalCoordinatorErrorCode.RecoveryRequired,
      );
      assertEqual(harness.counters.step, 1, "step count");
    } finally {
      harness.close();
    }
  }],
  ["RECOVER proves exact success without a second action", () => {
    const harness = createHarness({ throwStep: true });
    try {
      prepare(harness);
      const first =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      try {
        first.execute(request(DurableFixtureRehearsalPhase.Step));
      } catch {
        // Expected simulated loss.
      }
      const recoveryDependencies = {
        ...harness.dependencies,
        step: {
          executeOne: () => {
            throw new Error("recovery must not execute work");
          },
        },
      };
      const recovery =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          recoveryDependencies,
        );
      const recovered = recovery.execute(request(
        DurableFixtureRehearsalPhase.Recover,
        { expectedLifecycleVersion: 5 },
      ));
      const snapshot = harness.repository.readSnapshot("rehearsal-1")!;
      assertEqual(recovered.outcome, DurableFixtureRehearsalPhaseOutcome.Recovered, "outcome");
      assertEqual(snapshot.registry.lifecycleState, DurableFixtureRehearsalLifecycleState.Completed, "state");
      assertEqual(snapshot.claims.length, 2, "claims");
      assertEqual(snapshot.invocationReceipts.length, 1, "invocation receipts");
      assertEqual(snapshot.failureReceipts.length, 1, "recovery receipt");
      assertEqual(harness.counters.step, 1, "original step count");
      assertEqual(harness.counters.reconcile, 1, "reconcile count");
    } finally {
      harness.close();
    }
  }],
  ["RECOVER unresolved evidence becomes terminal recovery-required", () => {
    const harness = createHarness({
      throwStep: true,
      reconciliation: {
        disposition:
          DurableFixtureRehearsalReconciliationDisposition.RecoveryRequired,
        reasonCode: "AMBIGUOUS_DURABLE_OUTCOME",
        triggeringDisposition:
          DurableFixtureRehearsalFailureDisposition.RecoveryRequired,
        stepEvidence: null,
      },
    });
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      try {
        coordinator.execute(request(DurableFixtureRehearsalPhase.Step));
      } catch {
        // Expected simulated loss.
      }
      const outcome = coordinator.execute(request(
        DurableFixtureRehearsalPhase.Recover,
        { expectedLifecycleVersion: 5 },
      ));
      const snapshot = harness.repository.readSnapshot("rehearsal-1")!;
      assertEqual(outcome.outcome, DurableFixtureRehearsalPhaseOutcome.RecoveryRequired, "outcome");
      assertEqual(snapshot.registry.lifecycleState, DurableFixtureRehearsalLifecycleState.RecoveryRequired, "state");
      assertEqual(snapshot.failureReceipts.length, 2, "failure receipts");
    } finally {
      harness.close();
    }
  }],
  ["RECOVER conflicting evidence fails closed", () => {
    const harness = createHarness({
      throwStep: true,
      reconciliation: {
        disposition:
          DurableFixtureRehearsalReconciliationDisposition.FailedClosed,
        reasonCode: "CONFLICTING_DURABLE_EVIDENCE",
        triggeringDisposition:
          DurableFixtureRehearsalFailureDisposition.FailedClosed,
        stepEvidence: null,
      },
    });
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      try {
        coordinator.execute(request(DurableFixtureRehearsalPhase.Step));
      } catch {
        // Expected simulated loss.
      }
      coordinator.execute(request(
        DurableFixtureRehearsalPhase.Recover,
        { expectedLifecycleVersion: 5 },
      ));
      assertEqual(
        harness.repository.readSnapshot("rehearsal-1")!.registry.lifecycleState,
        DurableFixtureRehearsalLifecycleState.FailedClosed,
        "state",
      );
    } finally {
      harness.close();
    }
  }],
  ["RECOVER requires valid local Owner authorization", () => {
    const harness = createHarness({ throwStep: true, authorization: false });
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      try {
        coordinator.execute(request(DurableFixtureRehearsalPhase.Step));
      } catch {
        // Expected simulated loss.
      }
      expectCoordinatorError(
        () => coordinator.execute(request(
          DurableFixtureRehearsalPhase.Recover,
          { expectedLifecycleVersion: 5 },
        )),
        DurableFixtureRehearsalCoordinatorErrorCode.AuthorizationRejected,
      );
      assertEqual(harness.counters.reconcile, 0, "reconcile count");
    } finally {
      harness.close();
    }
  }],
  ["Stop before ownership prevents all phase mutation", () => {
    const harness = createHarness({ stopTripped: true });
    try {
      expectCoordinatorError(
        () => new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        ).execute(request(DurableFixtureRehearsalPhase.Prepare)),
        DurableFixtureRehearsalCoordinatorErrorCode.StopTripped,
      );
      assertEqual(harness.repository.readSnapshot("rehearsal-1"), null, "snapshot");
      assertEqual(harness.counters.released, 0, "release");
    } finally {
      harness.close();
    }
  }],
  ["Stop after STEP claim prevents action and preserves ambiguity", () => {
    const controls: { stopAtCheck?: number } = {};
    const harness = createHarness(controls);
    try {
      prepare(harness);
      harness.counters.stopChecks = 0;
      controls.stopAtCheck = 3;
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      expectCoordinatorError(
        () => coordinator.execute(request(DurableFixtureRehearsalPhase.Step)),
        DurableFixtureRehearsalCoordinatorErrorCode.StopTripped,
      );
      const snapshot = harness.repository.readSnapshot("rehearsal-1")!;
      assertEqual(
        snapshot.registry.lifecycleState,
        DurableFixtureRehearsalLifecycleState.Stepping,
        "state",
      );
      assertEqual(harness.counters.step, 0, "step count");
      assertEqual(harness.counters.preserved, 1, "ambiguity");
    } finally {
      harness.close();
    }
  }],
  ["unsupported phase fails before ownership or mutation", () => {
    const harness = createHarness();
    try {
      expectCoordinatorError(
        () => new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        ).execute(request(DurableFixtureRehearsalPhase.Validate)),
        DurableFixtureRehearsalCoordinatorErrorCode.UnsupportedPhase,
      );
      assertEqual(harness.repository.readSnapshot("rehearsal-1"), null, "snapshot");
    } finally {
      harness.close();
    }
  }],
  ["unknown request fields fail closed", () => {
    const harness = createHarness();
    try {
      expectCoordinatorError(
        () => new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        ).execute({
          ...request(DurableFixtureRehearsalPhase.Prepare),
          injected: true,
        } as never),
        DurableFixtureRehearsalCoordinatorErrorCode.InvalidRequest,
      );
    } finally {
      harness.close();
    }
  }],
  ["repository compare-and-swap rejects stale step claim", () => {
    const harness = createHarness();
    try {
      prepare(harness);
      const coordinator =
        new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
          harness.dependencies,
        );
      expectCoordinatorError(
        () => coordinator.execute(request(
          DurableFixtureRehearsalPhase.Step,
          { expectedLifecycleVersion: 2 },
        )),
        DurableFixtureRehearsalCoordinatorErrorCode.StateConflict,
      );
      assertEqual(harness.counters.step, 0, "step count");
    } finally {
      harness.close();
    }
  }],
  ["SQLite history is append-only and projection-column tamper fails closed", () => {
    const harness = createHarness();
    try {
      prepare(harness);
      new EventContractCollectionRunnerDurableFixtureRehearsalCoordinator(
        harness.dependencies,
      ).execute(request(DurableFixtureRehearsalPhase.Step));
      let rejected = false;
      try {
        harness.database.prepare(
          "DELETE FROM fixture_rehearsal_operation_claims",
        ).run();
      } catch {
        rejected = true;
      }
      assertTrue(rejected, "delete rejected");
      harness.database.prepare(`
UPDATE fixture_rehearsals
SET recovery_fingerprint = ?
WHERE rehearsal_id = ?
`).run(FP1, "rehearsal-1");
      let tamperRejected = false;
      try {
        harness.repository.readSnapshot("rehearsal-1");
      } catch {
        tamperRejected = true;
      }
      assertTrue(tamperRejected, "projection tamper rejected");
    } finally {
      harness.close();
    }
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
console.log(`Durable Fixture Rehearsal coordinator: ${passed}/${tests.length} passed.`);
