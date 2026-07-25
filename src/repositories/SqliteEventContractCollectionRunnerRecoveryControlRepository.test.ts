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
import { EventContractCollectionRunnerRecoveryControlEngine } from "../engines/event-contract-collection-runner-recovery-control";
import {
  CollectionRunnerLocalOwnerAuthenticationError,
  CollectionRunnerLocalOwnerAuthenticationErrorCode,
  deriveCollectionRunnerLocalOwnerSecretForProvisioning,
  EventContractCollectionRunnerRecoveryControlOperator,
  ScryptCollectionRunnerLocalOwnerVerifier,
} from "../engines/event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import {
  COLLECTION_RUNNER_RECOVERY_CONTROL_HELP,
  runCollectionRunnerRecoveryControlConsole,
} from "../engines/event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlConsole";
import {
  CollectionRunnerRecoveryControlRepositoryError,
  CollectionRunnerRecoveryControlRepositoryErrorCode,
} from "./EventContractCollectionRunnerRecoveryControlRepository";
import {
  CollectionRunnerRepositoryError,
  CollectionRunnerRepositoryErrorCode,
} from "./EventContractCollectionRunnerRepository";
import { EventContractCollectionRunnerSqliteStore } from "./EventContractCollectionRunnerSqliteStore";
import {
  CollectionRunnerProcessStopBarrier,
} from "./SessionGatedEventContractCollectionRunnerRepository";

const BUILD = "fnv1a64:1111111111111111";
const ACTIVATION_FINGERPRINT = "fnv1a64:2222222222222222";
const RUNNER_FINGERPRINT = "fnv1a64:3333333333333333";
const CREATED = "2026-07-25T12:00:00.000Z";
const INSPECTED = "2026-07-25T13:00:00.000Z";

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

function expectRepositoryError(
  run: () => unknown,
  code: CollectionRunnerRecoveryControlRepositoryErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof CollectionRunnerRecoveryControlRepositoryError,
      "typed repository error",
    );
    assertEqual(
      (error as CollectionRunnerRecoveryControlRepositoryError).code,
      code,
      "repository error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function expectAuthenticationError(
  run: () => unknown,
  code: CollectionRunnerLocalOwnerAuthenticationErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof CollectionRunnerLocalOwnerAuthenticationError,
      "typed authentication error",
    );
    assertEqual(
      (error as CollectionRunnerLocalOwnerAuthenticationError).code,
      code,
      "authentication error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function expectRunnerRepositoryError(
  run: () => unknown,
  code: CollectionRunnerRepositoryErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof CollectionRunnerRepositoryError,
      "typed runner repository error",
    );
    assertEqual(
      (error as CollectionRunnerRepositoryError).code,
      code,
      "runner repository error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function expectErrorMessage(run: () => unknown, fragment: string): void {
  try {
    run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assertTrue(message.includes(fragment), `error contains ${fragment}`);
    return;
  }
  throw new Error(`Expected error containing ${fragment}.`);
}

function withRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-recovery-control-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function openStore(root: string): EventContractCollectionRunnerSqliteStore {
  return EventContractCollectionRunnerSqliteStore.open({
    rootDirectory: root,
    applicationBuildFingerprint: BUILD,
    appliedAtUtc: CREATED,
    recoveryInspectedAtUtc: INSPECTED,
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

function prepareActiveStore(root: string): EventContractCollectionRunnerSqliteStore {
  const initial = openStore(root);
  const path = initial.getStorePath();
  initial.close();
  seedActivePilot(path);
  return openStore(root);
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function createAssessment(
  store: EventContractCollectionRunnerSqliteStore,
) {
  const readiness = store.getReadiness();
  const recovery = store.getStartupRecoveryReport();
  return new EventContractCollectionRunnerRecoveryControlEngine()
    .createRecoveryAssessment({
      schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
      assessmentId: "assessment:1",
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
      proposedBootIdentity: "boot:new",
      proposedProcessSessionId: "process:new",
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
) {
  return new EventContractCollectionRunnerRecoveryControlEngine()
    .createOwnerRecoveryDecision({
      schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
      decisionId: "decision:1",
      assessment,
      expectedActivationAggregateVersion: 1,
      ownerAuthorization: {
        authorityKind: "LOCAL_OWNER_VERIFIED",
        ownerId: "owner-1",
        verifierId: "local-owner-verifier",
        verifierVersion: "1.0",
        authorizationReference: "authorization:1",
        challengeFingerprint: BUILD,
        verifiedAtUtc: "2026-07-25T13:00:02.000Z",
        expiresAtUtc: "2026-07-25T13:09:00.000Z",
      },
      action: CollectionRunnerOwnerDecisionAction.ApproveResume,
      reasonCode: "OWNER_REVIEWED_RECOVERY",
      decidedAtUtc: "2026-07-25T13:00:03.000Z",
      expiresAtUtc: "2026-07-25T13:08:00.000Z",
      proposedBootIdentity: "boot:new",
      proposedProcessSessionId: "process:new",
      emergencyStopObserved: false,
    });
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "local recovery-control command keeps secrets off arguments",
    () => {
      const help = runCollectionRunnerRecoveryControlConsole(["--help"]);
      assertEqual(
        help,
        COLLECTION_RUNNER_RECOVERY_CONTROL_HELP,
        "help output",
      );
      assertTrue(help.includes("standard input"), "secret input boundary");
      assertTrue(!help.includes("--secret"), "no secret option");
    },
  ],
  [
    "local recovery-control command rejects unknown options before work",
    () =>
      expectErrorMessage(
        () =>
          runCollectionRunnerRecoveryControlConsole([
            "owner-decision",
            "--secret=forbidden",
          ]),
        "Unknown option",
      ),
  ],
  [
    "approved resume is durable, idempotent, and does not mutate Pilot state",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
        try {
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
          const context = {
          decisionId: decision.decisionId,
          expectedDecisionFingerprint: decision.fingerprint,
          currentRecoveryReportFingerprint:
            store.getStartupRecoveryReport().fingerprint,
          currentStorePathIdentity: sha256(resolve(store.getStorePath())),
          currentSchemaCatalogChecksum:
            store.getReadiness().schemaCatalogChecksum,
          executedAtUtc: "2026-07-25T13:00:04.000Z",
          };
          const first = repository.executeOwnerRecoveryDecision(context);
          const replay = repository.executeOwnerRecoveryDecision(context);
          assertEqual(replay.receiptId, first.receiptId, "idempotent receipt");
          assertEqual(first.fromState, CollectionRunnerPilotState.Active, "from");
          assertEqual(first.toState, CollectionRunnerPilotState.Active, "to");
          assertEqual(first.fromAggregateVersion, 1, "from version");
          assertEqual(first.toAggregateVersion, 1, "to version");
          assertTrue(first.sessionAuthorizationId !== null, "session authority");
          const authorization =
            repository.getSessionAuthorization("process:new");
          assertTrue(authorization !== null, "session persisted");
          const barrier = new CollectionRunnerProcessStopBarrier();
          const gated = store.createAuthorizedRunnerRepository(
          {
            sessionAuthorizationId:
              authorization?.sessionAuthorizationId ?? "",
            authorizationFingerprint:
              authorization?.authorizationFingerprint ?? "",
            activationId: "pilot-1",
            bootIdentity: "boot:new",
            processSessionId: "process:new",
          },
          "2026-07-25T13:00:05.000Z",
          barrier,
          );
          assertEqual(
          gated.getPilotState("pilot-1")?.state,
          CollectionRunnerPilotState.Active,
          "authorized read",
          );
          expectRepositoryError(
          () =>
            repository.validateRecoverySessionGate({
              sessionAuthorizationId:
                authorization?.sessionAuthorizationId ?? "",
              authorizationFingerprint:
                authorization?.authorizationFingerprint ?? "",
              activationId: "pilot-1",
              bootIdentity: "boot:new",
              processSessionId: "process:wrong",
              observedAtUtc: "2026-07-25T13:00:05.000Z",
              taskId: null,
            }),
          CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch,
          );
          expectRepositoryError(
          () =>
            repository.validateRecoverySessionGate({
              sessionAuthorizationId:
                authorization?.sessionAuthorizationId ?? "",
              authorizationFingerprint:
                authorization?.authorizationFingerprint ?? "",
              activationId: "pilot-1",
              bootIdentity: "boot:new",
              processSessionId: "process:new",
              observedAtUtc: "2026-07-25T13:08:00.000Z",
              taskId: null,
            }),
          CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch,
          );
          barrier.trip("OWNER_STOP");
          assertTrue(barrier.isTripped(), "barrier is irreversible");
          expectRunnerRepositoryError(
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
                reasonCode: "OWNER_STOP",
              },
            }),
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
          );
        } finally {
          store.close();
        }
      }),
  ],
  [
    "Emergency Stop has precedence and atomically requests durable stop",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
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
        const stopAssessment =
          new EventContractCollectionRunnerRecoveryControlEngine()
            .evaluateEmergencyStop({
              activationState: CollectionRunnerPilotState.Active,
              triggers: [CollectionRunnerEmergencyStopTrigger.OwnerRequest],
              evaluatedAtUtc: "2026-07-25T13:00:04.000Z",
            });
        const stop = {
          stopEventId: "stop:1",
          idempotencyKey: "fnv1a64:4444444444444444",
          activationId: "pilot-1",
          expectedActivationAggregateVersion: 1,
          assessment: stopAssessment,
          executedAtUtc: "2026-07-25T13:00:04.000Z",
        };
        const receipt = repository.executeEmergencyStop(stop);
        assertEqual(
          receipt.toState,
          CollectionRunnerPilotState.StopRequested,
          "stop state",
        );
        assertEqual(receipt.toAggregateVersion, 2, "stop version");
        assertEqual(
          repository.executeEmergencyStop(stop).receiptId,
          receipt.receiptId,
          "stop replay",
        );
        expectRepositoryError(
          () =>
            repository.executeOwnerRecoveryDecision({
              decisionId: decision.decisionId,
              expectedDecisionFingerprint: decision.fingerprint,
              currentRecoveryReportFingerprint:
                store.getStartupRecoveryReport().fingerprint,
              currentStorePathIdentity: sha256(resolve(store.getStorePath())),
              currentSchemaCatalogChecksum:
                store.getReadiness().schemaCatalogChecksum,
              executedAtUtc: "2026-07-25T13:00:05.000Z",
            }),
          CollectionRunnerRecoveryControlRepositoryErrorCode.DecisionInvalidated,
        );
        store.close();
      }),
  ],
  [
    "local Owner verifier executes an exact command and rejects bad secrets",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
        try {
          const repository = store.createRecoveryControlRepository();
          const assessment = createAssessment(store);
          repository.persistRecoveryAssessment({
            assessment,
            recordedAtUtc: "2026-07-25T13:00:01.000Z",
          });
          const secret = "correct horse battery staple";
          const saltHex = "11".repeat(16);
          const verifier =
            new ScryptCollectionRunnerLocalOwnerVerifier({
            schemaVersion: "1.0",
            ownerId: "owner-1",
            verifierId: "local-owner-verifier",
            verifierVersion: "1.0",
            algorithm: "SCRYPT_SHA256",
            saltHex,
            derivedKeyHex:
              deriveCollectionRunnerLocalOwnerSecretForProvisioning(
                secret,
                saltHex,
              ),
              cost: 16384,
              blockSize: 8,
              parallelization: 1,
              keyLength: 32,
            });
          const operator =
            new EventContractCollectionRunnerRecoveryControlOperator(
              repository,
              verifier,
            );
          const command = {
          schemaVersion: "1.0",
          commandId: "command:resume-1",
          assessmentId: assessment.assessmentId,
          expectedAssessmentFingerprint: assessment.fingerprint,
          decisionId: "decision:operator-1",
          expectedActivationAggregateVersion: 1,
          action: CollectionRunnerOwnerDecisionAction.ApproveResume,
          reasonCode: "OWNER_REVIEWED_RECOVERY",
          proposedBootIdentity: "boot:new",
          proposedProcessSessionId: "process:new",
          verifiedAtUtc: "2026-07-25T13:00:02.000Z",
          authorizationExpiresAtUtc: "2026-07-25T13:04:00.000Z",
          decidedAtUtc: "2026-07-25T13:00:03.000Z",
          decisionExpiresAtUtc: "2026-07-25T13:03:00.000Z",
          currentRecoveryReportFingerprint:
            store.getStartupRecoveryReport().fingerprint,
          currentStorePathIdentity: sha256(resolve(store.getStorePath())),
          currentSchemaCatalogChecksum:
            store.getReadiness().schemaCatalogChecksum,
          executedAtUtc: "2026-07-25T13:00:04.000Z",
          } as const;
          expectAuthenticationError(
            () => operator.executeOwnerCommand(command, "wrong secret value"),
            CollectionRunnerLocalOwnerAuthenticationErrorCode.AuthenticationFailed,
          );
          assertEqual(
            repository.getOwnerRecoveryDecision("decision:operator-1"),
            null,
            "bad secret creates no decision",
          );
          const receipt = operator.executeOwnerCommand(command, secret);
          assertEqual(
            receipt.action,
            CollectionRunnerOwnerDecisionAction.ApproveResume,
            "owner command action",
          );
          assertTrue(
            repository.getSessionAuthorization("process:new") !== null,
            "owner command session",
          );
        } finally {
          store.close();
        }
      }),
  ],
  [
    "execution rejects a changed recovery identity before mutation",
    () =>
      withRoot((root) => {
        const store = prepareActiveStore(root);
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
        expectRepositoryError(
          () =>
            repository.executeOwnerRecoveryDecision({
              decisionId: decision.decisionId,
              expectedDecisionFingerprint: decision.fingerprint,
              currentRecoveryReportFingerprint:
                "fnv1a64:ffffffffffffffff",
              currentStorePathIdentity: sha256(resolve(store.getStorePath())),
              currentSchemaCatalogChecksum:
                store.getReadiness().schemaCatalogChecksum,
              executedAtUtc: "2026-07-25T13:00:04.000Z",
            }),
          CollectionRunnerRecoveryControlRepositoryErrorCode.RecoveryContextMismatch,
        );
        assertEqual(
          repository.getSessionAuthorization("process:new"),
          null,
          "no session mutation",
        );
        store.close();
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
    `Recovery-control SQLite tests passed: ${String(passed)}/${String(tests.length)}.`,
  );
}

main();
