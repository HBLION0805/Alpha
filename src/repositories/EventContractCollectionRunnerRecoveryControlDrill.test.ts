import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
  CollectionRunnerClockHealth,
  CollectionRunnerEmergencyStopTrigger,
  CollectionRunnerOwnerDecisionAction,
  CollectionRunnerPilotState,
} from "../contracts";
import {
  EventContractCollectionRunnerRecoveryControlEngine,
} from "../engines/event-contract-collection-runner-recovery-control";
import {
  EventContractCollectionRunnerRecoveryControlOperator,
  type CollectionRunnerLocalOwnerVerifier,
} from "../engines/event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import {
  CollectionRunnerRecoveryControlRepositoryError,
  CollectionRunnerRecoveryControlRepositoryErrorCode,
  type CollectionRunnerRecoverySessionAuthorization,
  type EventContractCollectionRunnerRecoveryControlRepository,
  type ExecuteEmergencyStopTransaction,
} from "./EventContractCollectionRunnerRecoveryControlRepository";
import {
  CollectionRunnerRepositoryError,
  CollectionRunnerRepositoryErrorCode,
} from "./EventContractCollectionRunnerRepository";
import {
  EventContractCollectionRunnerSqliteStore,
  EventContractCollectionRunnerSqliteStoreError,
  EventContractCollectionRunnerSqliteStoreErrorCode,
} from "./EventContractCollectionRunnerSqliteStore";
import {
  CollectionRunnerProcessStopBarrier,
} from "./SessionGatedEventContractCollectionRunnerRepository";

const BUILD = "fnv1a64:1111111111111111";
const ACTIVATION_FINGERPRINT = "fnv1a64:2222222222222222";
const RUNNER_FINGERPRINT = "fnv1a64:3333333333333333";
const CREATED = "2026-07-25T12:00:00.000Z";
const FIRST_INSPECTION = "2026-07-25T13:00:00.000Z";
const RESTART_INSPECTION = "2026-07-25T13:00:10.000Z";

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function expectControlError(
  run: () => unknown,
  code: CollectionRunnerRecoveryControlRepositoryErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof CollectionRunnerRecoveryControlRepositoryError,
      "typed recovery-control error",
    );
    assertEqual(
      (error as CollectionRunnerRecoveryControlRepositoryError).code,
      code,
      "recovery-control error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function expectRunnerError(
  run: () => unknown,
  code: CollectionRunnerRepositoryErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof CollectionRunnerRepositoryError,
      "typed runner error",
    );
    assertEqual(
      (error as CollectionRunnerRepositoryError).code,
      code,
      "runner error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function expectStoreError(
  run: () => unknown,
  code: EventContractCollectionRunnerSqliteStoreErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof EventContractCollectionRunnerSqliteStoreError,
      "typed store error",
    );
    assertEqual(
      (error as EventContractCollectionRunnerSqliteStoreError).code,
      code,
      "store error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function withRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-recovery-drill-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function openStore(
  root: string,
  recoveryInspectedAtUtc = FIRST_INSPECTION,
): EventContractCollectionRunnerSqliteStore {
  return EventContractCollectionRunnerSqliteStore.open({
    rootDirectory: root,
    applicationBuildFingerprint: BUILD,
    appliedAtUtc: CREATED,
    recoveryInspectedAtUtc,
  });
}

function seedActivePilot(path: string): void {
  const database = new DatabaseSync(path);
  try {
    database
      .prepare(`
INSERT INTO runner_definitions
(runner_definition_id, version, fingerprint, build_fingerprint, canonical_record_json, created_at_utc)
VALUES ('runner-1', '1.0', ?, ?, ?, ?)
`)
      .run(
        RUNNER_FINGERPRINT,
        BUILD,
        `{"fingerprint":"${RUNNER_FINGERPRINT}"}`,
        CREATED,
      );
    database
      .prepare(`
INSERT INTO pilot_activations
(activation_id, activation_fingerprint, owner_id, approved_at_utc, starts_at_utc,
 stops_at_utc, frozen_plan_id, frozen_plan_fingerprint, runner_definition_id,
 runner_definition_version, maximum_events, maximum_requests, current_state,
 aggregate_version, canonical_record_json, created_at_utc)
VALUES ('pilot-1', ?, 'owner-1', ?, ?, '2026-07-25T20:00:00.000Z',
 'plan-1', ?, 'runner-1', '1.0', 1, 2, 'ACTIVE', 1, ?, ?)
`)
      .run(
        ACTIVATION_FINGERPRINT,
        CREATED,
        CREATED,
        RUNNER_FINGERPRINT,
        `{"fingerprint":"${ACTIVATION_FINGERPRINT}"}`,
        CREATED,
      );
    database
      .prepare(`
INSERT INTO pilot_transitions
(activation_id, from_state, to_state, from_aggregate_version, to_aggregate_version,
 occurred_at_utc, reason_code, transition_fingerprint)
VALUES ('pilot-1', 'DRAFT', 'ACTIVE', 0, 1, ?, 'TEST_FIXTURE', ?)
`)
      .run(CREATED, RUNNER_FINGERPRINT);
    database
      .prepare(`
INSERT INTO activation_budget_counters
(activation_id, aggregate_version, events_scheduled, requests_started, bytes_received,
 records_received, retries_started, evidence_committed, tasks_missed, updated_at_utc)
VALUES ('pilot-1', 1, 0, 0, 0, 0, 0, 0, 0, ?)
`)
      .run(CREATED);
  } finally {
    database.close();
  }
}

function prepareActiveStore(
  root: string,
): EventContractCollectionRunnerSqliteStore {
  const initial = openStore(root);
  const path = initial.getStorePath();
  initial.close();
  seedActivePilot(path);
  return openStore(root);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function createAssessment(store: EventContractCollectionRunnerSqliteStore) {
  const readiness = store.getReadiness();
  const recovery = store.getStartupRecoveryReport();
  return new EventContractCollectionRunnerRecoveryControlEngine()
    .createRecoveryAssessment({
      schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
      assessmentId: "assessment:drill",
      policyVersion: "1.0",
      storeId: "collection-runner",
      storePathIdentity: sha256(resolve(store.getStorePath())),
      schemaCatalogChecksum: readiness.schemaCatalogChecksum,
      recoveryReportFingerprint: recovery.fingerprint,
      inspectedAtUtc: recovery.inspectedAtUtc,
      activation: {
        activationId: "pilot-1",
        ownerId: "owner-1",
        state: CollectionRunnerPilotState.Active,
        aggregateVersion: 1,
        fingerprint: ACTIVATION_FINGERPRINT,
        startsAtUtc: CREATED,
        stopsAtUtc: "2026-07-25T20:00:00.000Z",
      },
      priorBootIdentity: null,
      proposedBootIdentity: "boot:drill",
      proposedProcessSessionId: "process:drill",
      clockHealth: CollectionRunnerClockHealth.Healthy,
      absoluteClockOffsetMilliseconds: 0,
      maximumClockOffsetMilliseconds: 1000,
      openLeaseCount: 0,
      unresolvedAttemptCount: 0,
      integrityBlockerCodes: [],
      restoredStorePendingSwitch: false,
      assessedAtUtc: "2026-07-25T13:00:01.000Z",
      expiresAtUtc: "2026-07-25T13:10:00.000Z",
    });
}

function createResumeDecision(
  assessment: ReturnType<typeof createAssessment>,
  decisionId = "decision:drill",
) {
  return new EventContractCollectionRunnerRecoveryControlEngine()
    .createOwnerRecoveryDecision({
      schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
      decisionId,
      assessment,
      expectedActivationAggregateVersion: 1,
      ownerAuthorization: {
        authorityKind: "LOCAL_OWNER_VERIFIED",
        ownerId: "owner-1",
        verifierId: "local-owner-verifier",
        verifierVersion: "1.0",
        authorizationReference: `authorization:${decisionId}`,
        challengeFingerprint: BUILD,
        verifiedAtUtc: "2026-07-25T13:00:02.000Z",
        expiresAtUtc: "2026-07-25T13:09:00.000Z",
      },
      action: CollectionRunnerOwnerDecisionAction.ApproveResume,
      reasonCode: "OWNER_REVIEWED_RECOVERY",
      decidedAtUtc: "2026-07-25T13:00:03.000Z",
      expiresAtUtc: "2026-07-25T13:08:00.000Z",
      proposedBootIdentity: "boot:drill",
      proposedProcessSessionId: "process:drill",
      emergencyStopObserved: false,
    });
}

function persistResumeEvidence(
  store: EventContractCollectionRunnerSqliteStore,
) {
  const repository = store.createRecoveryControlRepository();
  const assessment = createAssessment(store);
  repository.persistRecoveryAssessment({
    assessment,
    recordedAtUtc: "2026-07-25T13:00:01.000Z",
  });
  const decision = createResumeDecision(assessment);
  repository.persistOwnerRecoveryDecision({
    decision,
    recordedAtUtc: "2026-07-25T13:00:03.000Z",
  });
  return { repository, assessment, decision };
}

function executeResume(
  store: EventContractCollectionRunnerSqliteStore,
  repository: EventContractCollectionRunnerRecoveryControlRepository,
  decision: ReturnType<typeof createResumeDecision>,
): CollectionRunnerRecoverySessionAuthorization {
  repository.executeOwnerRecoveryDecision({
    decisionId: decision.decisionId,
    expectedDecisionFingerprint: decision.fingerprint,
    currentRecoveryReportFingerprint:
      store.getStartupRecoveryReport().fingerprint,
    currentStorePathIdentity: sha256(resolve(store.getStorePath())),
    currentSchemaCatalogChecksum: store.getReadiness().schemaCatalogChecksum,
    executedAtUtc: "2026-07-25T13:00:04.000Z",
  });
  const session = repository.getSessionAuthorization("process:drill");
  if (session === null) throw new Error("Resume did not create a session.");
  return session;
}

function createStop(
  expectedActivationAggregateVersion = 1,
  executedAtUtc = "2026-07-25T13:00:05.000Z",
): ExecuteEmergencyStopTransaction {
  return {
    stopEventId: "stop:drill",
    idempotencyKey: "fnv1a64:4444444444444444",
    activationId: "pilot-1",
    expectedActivationAggregateVersion,
    assessment:
      new EventContractCollectionRunnerRecoveryControlEngine()
        .evaluateEmergencyStop({
          activationState: CollectionRunnerPilotState.Active,
          triggers: [CollectionRunnerEmergencyStopTrigger.OwnerRequest],
          evaluatedAtUtc: executedAtUtc,
        }),
    executedAtUtc,
  };
}

function sessionIdentity(session: CollectionRunnerRecoverySessionAuthorization) {
  return {
    sessionAuthorizationId: session.sessionAuthorizationId,
    authorizationFingerprint: session.authorizationFingerprint,
    activationId: session.activationId,
    bootIdentity: session.bootIdentity,
    processSessionId: session.processSessionId,
  };
}

function tripDurableStop(
  repository: EventContractCollectionRunnerRecoveryControlRepository,
): void {
  repository.executeEmergencyStop(createStop());
}

const unusedVerifier: CollectionRunnerLocalOwnerVerifier = {
  verify: () => {
    throw new Error("Drill verifier must not be called.");
  },
};

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "concurrent stop-first ordering invalidates an unconsumed resume",
    () =>
      withRoot((root) => {
        const first = prepareActiveStore(root);
        const second = openStore(root);
        try {
          const { repository, decision } = persistResumeEvidence(first);
          tripDurableStop(second.createRecoveryControlRepository());
          expectControlError(
            () =>
              repository.executeOwnerRecoveryDecision({
                decisionId: decision.decisionId,
                expectedDecisionFingerprint: decision.fingerprint,
                currentRecoveryReportFingerprint:
                  first.getStartupRecoveryReport().fingerprint,
                currentStorePathIdentity: sha256(resolve(first.getStorePath())),
                currentSchemaCatalogChecksum:
                  first.getReadiness().schemaCatalogChecksum,
                executedAtUtc: "2026-07-25T13:00:06.000Z",
              }),
            CollectionRunnerRecoveryControlRepositoryErrorCode.DecisionInvalidated,
          );
          assertEqual(
            repository.getSessionAuthorization("process:drill"),
            null,
            "no session survives stop-first ordering",
          );
          assertEqual(
            repository.getOwnerRecoveryDecision(decision.decisionId)?.action,
            CollectionRunnerOwnerDecisionAction.ApproveResume,
            "immutable decision remains evidence",
          );
        } finally {
          second.close();
          first.close();
        }
      }),
  ],
  [
    "concurrent resume-first ordering is revoked by the winning stop",
    () =>
      withRoot((root) => {
        const first = prepareActiveStore(root);
        const second = openStore(root);
        try {
          const { repository, decision } = persistResumeEvidence(first);
          const session = executeResume(first, repository, decision);
          const barrier = new CollectionRunnerProcessStopBarrier();
          const gated = first.createAuthorizedRunnerRepository(
            sessionIdentity(session),
            "2026-07-25T13:00:04.500Z",
            barrier,
          );
          tripDurableStop(second.createRecoveryControlRepository());
          expectRunnerError(
            () =>
              gated.transitionPilot({
                activationId: "pilot-1",
                expectedAggregateVersion: 1,
                nextState: CollectionRunnerPilotState.StopRequested,
                clock: {
                  observedAtUtc: "2026-07-25T13:00:06.000Z",
                  absoluteOffsetMilliseconds: 0,
                  healthy: true,
                },
                recoveryBlockerCount: 0,
                evidence: {
                  occurredAtUtc: "2026-07-25T13:00:06.000Z",
                  reasonCode: "STALE_RESUMED_PROCESS",
                },
              }),
            CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
          );
          assertTrue(
            repository.getSessionAuthorization("process:drill")
              ?.revokedAtUtc !== null,
            "resume session revoked",
          );
        } finally {
          second.close();
          first.close();
        }
      }),
  ],
  [
    "crash after resume commit preserves evidence but invalidates old session",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
        const { repository, decision } = persistResumeEvidence(store);
        const session = executeResume(store, repository, decision);
        store.close();

        const restarted = openStore(root, RESTART_INSPECTION);
        try {
          assertTrue(
            restarted.createRecoveryControlRepository()
              .getSessionAuthorization("process:drill") !== null,
            "session evidence survives crash",
          );
          expectControlError(
            () =>
              restarted.createAuthorizedRunnerRepository(
                sessionIdentity(session),
                "2026-07-25T13:00:11.000Z",
                new CollectionRunnerProcessStopBarrier(),
              ),
            CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch,
          );
          expectStoreError(
            () => restarted.createRunnerRepository(),
            EventContractCollectionRunnerSqliteStoreErrorCode.IntegrityFailed,
          );
        } finally {
          restarted.close();
        }
      }),
  ],
  [
    "crash after durable stop preserves STOP_REQUESTED and revoked authority",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
        const { repository, decision } = persistResumeEvidence(store);
        const session = executeResume(store, repository, decision);
        tripDurableStop(repository);
        store.close();

        const restarted = openStore(root, RESTART_INSPECTION);
        try {
          const restartedControl =
            restarted.createRecoveryControlRepository();
          assertEqual(
            restartedControl.getSessionAuthorization("process:drill")
              ?.revocationReasonCode,
            "EMERGENCY_STOP",
            "revocation survives crash",
          );
          expectControlError(
            () =>
              restarted.createAuthorizedRunnerRepository(
                sessionIdentity(session),
                "2026-07-25T13:00:11.000Z",
                new CollectionRunnerProcessStopBarrier(),
              ),
            CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch,
          );
          expectStoreError(
            () => restarted.createRunnerRepository(),
            EventContractCollectionRunnerSqliteStoreErrorCode.IntegrityFailed,
          );
        } finally {
          restarted.close();
        }
      }),
  ],
  [
    "injected resume transaction failure rolls back every partial mutation",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
        const { repository, decision } = persistResumeEvidence(store);
        const injector = new DatabaseSync(store.getStorePath());
        try {
          injector.exec(`
CREATE TRIGGER drill_abort_resume
BEFORE INSERT ON recovery_session_authorizations
BEGIN
  SELECT RAISE(ABORT, 'T4D injected resume failure');
END;
`);
          expectControlError(
            () =>
              repository.executeOwnerRecoveryDecision({
                decisionId: decision.decisionId,
                expectedDecisionFingerprint: decision.fingerprint,
                currentRecoveryReportFingerprint:
                  store.getStartupRecoveryReport().fingerprint,
                currentStorePathIdentity: sha256(resolve(store.getStorePath())),
                currentSchemaCatalogChecksum:
                  store.getReadiness().schemaCatalogChecksum,
                executedAtUtc: "2026-07-25T13:00:04.000Z",
              }),
            CollectionRunnerRecoveryControlRepositoryErrorCode.TransactionFailed,
          );
          const state = injector
            .prepare(`
SELECT
  (SELECT COUNT(*) FROM recovery_session_authorizations) AS sessions,
  (SELECT COUNT(*) FROM control_execution_receipts) AS receipts,
  (SELECT consumed_at_utc FROM owner_recovery_decisions WHERE decision_id = ?) AS consumed
`)
            .get(decision.decisionId) as {
              readonly sessions: number;
              readonly receipts: number;
              readonly consumed: string | null;
            };
          assertEqual(state.sessions, 0, "session insert rolled back");
          assertEqual(state.receipts, 0, "receipt insert rolled back");
          assertEqual(state.consumed, null, "decision consumption rolled back");
          injector.exec("DROP TRIGGER drill_abort_resume");
        } finally {
          injector.close();
          store.close();
        }

        const restarted = openStore(root, RESTART_INSPECTION);
        try {
          assertEqual(
            restarted.createRecoveryControlRepository()
              .getSessionAuthorization("process:drill"),
            null,
            "restart observes no partial session",
          );
        } finally {
          restarted.close();
        }
      }),
  ],
  [
    "durable stop failure still trips the process barrier before crash",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
        const { repository, decision } = persistResumeEvidence(store);
        const session = executeResume(store, repository, decision);
        const barrier = new CollectionRunnerProcessStopBarrier();
        const gated = store.createAuthorizedRunnerRepository(
          sessionIdentity(session),
          "2026-07-25T13:00:04.500Z",
          barrier,
        );
        const failingRepository = new Proxy(repository, {
          get(target, property, receiver) {
            if (property === "executeEmergencyStop") {
              return () => {
                throw new CollectionRunnerRecoveryControlRepositoryError(
                  CollectionRunnerRecoveryControlRepositoryErrorCode.TransactionFailed,
                  "T4D injected durable stop failure.",
                );
              };
            }
            const value = Reflect.get(target, property, receiver) as unknown;
            return typeof value === "function"
              ? value.bind(target) as unknown
              : value;
          },
        });
        const operator =
          new EventContractCollectionRunnerRecoveryControlOperator(
            failingRepository,
            unusedVerifier,
          );
        expectControlError(
          () => operator.executeEmergencyStop(createStop(), barrier),
          CollectionRunnerRecoveryControlRepositoryErrorCode.TransactionFailed,
        );
        assertTrue(barrier.isTripped(), "process barrier remains tripped");
        assertEqual(
          repository.getSessionAuthorization("process:drill")?.revokedAtUtc,
          null,
          "failed durable transaction does not invent revocation",
        );
        expectRunnerError(
          () =>
            gated.transitionPilot({
              activationId: "pilot-1",
              expectedAggregateVersion: 1,
              nextState: CollectionRunnerPilotState.StopRequested,
              clock: {
                observedAtUtc: "2026-07-25T13:00:06.000Z",
                absoluteOffsetMilliseconds: 0,
                healthy: true,
              },
              recoveryBlockerCount: 0,
              evidence: {
                occurredAtUtc: "2026-07-25T13:00:06.000Z",
                reasonCode: "POST_FAILURE_WRITE",
              },
            }),
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
        );
        store.close();

        const restarted = openStore(root, RESTART_INSPECTION);
        try {
          expectStoreError(
            () => restarted.createRunnerRepository(),
            EventContractCollectionRunnerSqliteStoreErrorCode.IntegrityFailed,
          );
          assertEqual(
            restarted.createRecoveryControlRepository()
              .getSessionAuthorization("process:drill")?.revokedAtUtc,
            null,
            "restart preserves unresolved durable ambiguity",
          );
        } finally {
          restarted.close();
        }
      }),
  ],
];

function main(): void {
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
    `Recovery-control race/crash drills passed: ${String(passed)}/${String(tests.length)}.`,
  );
}

main();
