import {
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeMode,
  CollectionRunnerClockSynchronizationStatus,
  CollectionRunnerRuntimeStopMode,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerRuntimePreflightInput,
  type CollectionRunnerRuntimeStatusInput,
  type CollectionRunnerRuntimeStopCommand,
} from "../../contracts";
import type {
  CollectionRunnerLocalOwnerVerifier,
  VerifyCollectionRunnerLocalOwnerInput,
} from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import { CollectionRunnerProcessStopBarrier } from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";
import { EventContractCollectionRunnerRuntimeFoundationError } from "./EventContractCollectionRunnerRuntimeFoundation";
import {
  EventContractCollectionRunnerRuntimeOperator,
  EventContractCollectionRunnerRuntimeOperatorService,
  InMemoryCollectionRunnerRuntimeStopNotificationPort,
  CollectionRunnerRuntimeRepositoryStopPort,
  type CollectionRunnerRuntimeDurableStopPort,
} from "./EventContractCollectionRunnerRuntimeOperator";
import type {
  EventContractCollectionRunnerRepository,
} from "../../repositories/EventContractCollectionRunnerRepository";
import type {
  EventContractCollectionRunnerRecoveryControlRepository,
} from "../../repositories/EventContractCollectionRunnerRecoveryControlRepository";
import type {
  CollectionRunnerRuntimeOwnershipHandle,
} from "./EventContractCollectionRunnerRuntimeFoundation";
import type {
  EventContractCollectionRunnerRuntimeProjectionRepository,
} from "../../repositories/EventContractCollectionRunnerRuntimeProjectionRepository";

const SHA_A =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const SHA_D =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
const SHA_E =
  "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function expectFoundationError(
  run: () => unknown,
  code: CollectionRunnerRuntimeFoundationErrorCode,
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
  throw new Error(`Expected ${code}.`);
}

function safety(
  changes: Partial<CollectionRunnerRuntimePreflightInput["safety"]> = {},
) {
  return {
    configurationVerified: true,
    ownershipVerified: true,
    storeReady: true,
    integrityVerified: true,
    clockHealthy: true,
    sessionAuthorized: true,
    stopBarrierTripped: false,
    blockerCodes: [],
    ...changes,
  };
}

function preflight(
  changes: Partial<CollectionRunnerRuntimePreflightInput> = {},
): CollectionRunnerRuntimePreflightInput {
  return {
    observedAtUtc: "2026-07-25T14:00:00.000Z",
    configurationFingerprint: SHA_A,
    pathFingerprint: SHA_B,
    storeIdentity: SHA_C,
    schemaCatalogChecksum: SHA_D,
    recoveryReportFingerprint: SHA_E,
    safety: safety(),
    ...changes,
  };
}

function status(
  changes: Partial<CollectionRunnerRuntimeStatusInput> = {},
): CollectionRunnerRuntimeStatusInput {
  return {
    observedAtUtc: "2026-07-25T14:00:00.000Z",
    configurationFingerprint: SHA_A,
    buildFingerprint: SHA_B,
    lockFingerprint: SHA_C,
    bootIdentity: "boot:test",
    processSessionId: "process-session:test",
    processStartedAtUtc: "2026-07-25T13:55:00.000Z",
    activationId: "activation:test",
    pilotState: "ACTIVE",
    activationStopsAtUtc: "2026-07-25T15:00:00.000Z",
    taskCounts: [
      { sourceLane: "PLATFORM", state: "DUE", count: 1 },
      { sourceLane: "EXCHANGE", state: "COMMITTED", count: 2 },
    ],
    budget: {
      maximumEvents: 10,
      maximumRequests: 20,
      eventsScheduled: 3,
      requestsStarted: 2,
      retriesStarted: 0,
      evidenceCommitted: 2,
      tasksMissed: 0,
    },
    currentLease: {
      taskId: "task:1",
      workerId: "worker:1",
      acquiredAtUtc: "2026-07-25T13:59:00.000Z",
      heartbeatAtUtc: "2026-07-25T13:59:30.000Z",
      expiresAtUtc: "2026-07-25T14:00:30.000Z",
    },
    lastReceiptAtUtc: "2026-07-25T13:59:40.000Z",
    lastCommitAtUtc: "2026-07-25T13:59:50.000Z",
    clockOffsetMilliseconds: 12,
    outboxBacklog: 1,
    outbox: [
      {
        sequence: 7,
        outboxId: "outbox:7",
        aggregateType: "TASK",
        aggregateId: "task:1",
        aggregateVersion: 4,
        eventType: "EVIDENCE_COMMITTED",
        eventFingerprint: SHA_D,
        createdAtUtc: "2026-07-25T13:59:50.000Z",
        publishedAtUtc: null,
        publishAttempts: 0,
        lastFailureCode: null,
      },
    ],
    recoveryDisposition: "RESUME_ELIGIBLE",
    safety: safety(),
    ...changes,
  };
}

function stopCommand(
  changes: Partial<CollectionRunnerRuntimeStopCommand> = {},
): CollectionRunnerRuntimeStopCommand {
  return {
    schemaVersion: "1.0",
    commandId: "command:stop:1",
    mode: CollectionRunnerRuntimeStopMode.Graceful,
    ownerId: "owner:test",
    activationId: "activation:test",
    expectedActivationAggregateVersion: 3,
    configurationFingerprint: SHA_A,
    storeIdentity: SHA_C,
    processSessionId: "process-session:test",
    reasonCode: "OWNER_REQUEST",
    verifiedAtUtc: "2026-07-25T14:00:00.000Z",
    authorizationExpiresAtUtc: "2026-07-25T14:05:00.000Z",
    requestedAtUtc: "2026-07-25T14:00:01.000Z",
    ...changes,
  };
}

class FakeVerifier implements CollectionRunnerLocalOwnerVerifier {
  public calls = 0;
  public fail = false;
  public verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence {
    this.calls += 1;
    if (this.fail || input.secret !== "owner-secret") {
      throw new Error("authentication failed");
    }
    return Object.freeze({
      authorityKind: "LOCAL_OWNER_VERIFIED",
      ownerId: input.ownerId,
      verifierId: "verifier:test",
      verifierVersion: "1.0",
      authorizationReference: "authorization:test",
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
  }
}

class FakeDurableStop implements CollectionRunnerRuntimeDurableStopPort {
  public calls = 0;
  public fail = false;
  public requestStop() {
    this.calls += 1;
    if (this.fail) throw new Error("store unavailable");
    return { receiptFingerprint: SHA_E };
  }
}

const operator = new EventContractCollectionRunnerRuntimeOperator();

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "preflight is ready only when every safety gate is current",
    () => {
      const report = operator.createPreflightReport(preflight());
      assertEqual(report.ready, true, "ready");
      assertEqual(report.health, CollectionRunnerRuntimeHealthStatus.Healthy, "health");
      assertTrue(Object.isFrozen(report), "immutable");
    },
  ],
  [
    "preflight fails closed on ownership loss",
    () => {
      const report = operator.createPreflightReport(
        preflight({ safety: safety({ ownershipVerified: false }) }),
      );
      assertEqual(report.ready, false, "ready");
      assertEqual(report.health, CollectionRunnerRuntimeHealthStatus.FailClosed, "health");
    },
  ],
  [
    "preflight reports degraded clock without claiming readiness",
    () => {
      const report = operator.createPreflightReport(
        preflight({ safety: safety({ clockHealthy: false }) }),
      );
      assertEqual(report.ready, false, "ready");
      assertEqual(report.health, CollectionRunnerRuntimeHealthStatus.Degraded, "health");
    },
  ],
  [
    "status is deterministic sanitized and computes remaining time",
    () => {
      const first = operator.createStatusReport(status());
      const second = operator.createStatusReport(status());
      assertEqual(first.fingerprint, second.fingerprint, "fingerprint");
      assertEqual(first.remainingActivationMilliseconds, 3_600_000, "remaining");
      assertEqual(first.health, CollectionRunnerRuntimeHealthStatus.Healthy, "health");
      assertEqual("sanitizedEventJson" in first.outbox[0]!, false, "no payload");
    },
  ],
  [
    "status rejects an undeclared secret field",
    () =>
      expectFoundationError(
        () =>
          operator.createStatusReport({
            ...status(),
            token: "secret",
          } as unknown as CollectionRunnerRuntimeStatusInput),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      ),
  ],
  [
    "status rejects duplicate task count authority",
    () =>
      expectFoundationError(
        () =>
          operator.createStatusReport(
            status({
              taskCounts: [
                { sourceLane: "PLATFORM", state: "DUE", count: 1 },
                { sourceLane: "PLATFORM", state: "DUE", count: 2 },
              ],
            }),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      ),
  ],
  [
    "authenticated graceful Stop persists then notifies",
    () => {
      const verifier = new FakeVerifier();
      const durable = new FakeDurableStop();
      const notification =
        new InMemoryCollectionRunnerRuntimeStopNotificationPort();
      const barrier = new CollectionRunnerProcessStopBarrier();
      const result = operator.executeStop(
        stopCommand(),
        "owner-secret",
        verifier,
        durable,
        notification,
        barrier,
      );
      assertEqual(result.durableStopRecorded, true, "durable");
      assertEqual(result.processNotified, true, "notified");
      assertEqual(barrier.isTripped(), true, "barrier");
      assertEqual(notification.read()?.authorizationReference, "authorization:test", "authorization");
    },
  ],
  [
    "failed authentication performs no Stop action",
    () => {
      const verifier = new FakeVerifier();
      const durable = new FakeDurableStop();
      const notification =
        new InMemoryCollectionRunnerRuntimeStopNotificationPort();
      const barrier = new CollectionRunnerProcessStopBarrier();
      let failed = false;
      try {
        operator.executeStop(
          stopCommand(),
          "wrong-secret",
          verifier,
          durable,
          notification,
          barrier,
        );
      } catch {
        failed = true;
      }
      assertEqual(failed, true, "authentication failed");
      assertEqual(durable.calls, 0, "no durable call");
      assertEqual(barrier.isTripped(), false, "barrier untouched");
      assertEqual(notification.read(), null, "no notification");
    },
  ],
  [
    "durable Stop failure still trips barrier and notifies",
    () => {
      const verifier = new FakeVerifier();
      const durable = new FakeDurableStop();
      durable.fail = true;
      const notification =
        new InMemoryCollectionRunnerRuntimeStopNotificationPort();
      const barrier = new CollectionRunnerProcessStopBarrier();
      expectFoundationError(
        () =>
          operator.executeStop(
            stopCommand({ mode: CollectionRunnerRuntimeStopMode.Emergency }),
            "owner-secret",
            verifier,
            durable,
            notification,
            barrier,
          ),
        CollectionRunnerRuntimeFoundationErrorCode.StopPersistenceFailed,
      );
      assertEqual(barrier.isTripped(), true, "barrier");
      assertTrue(notification.read() !== null, "notification attempted");
    },
  ],
  [
    "notification failure cannot undo durable Stop",
    () => {
      const barrier = new CollectionRunnerProcessStopBarrier();
      const result = operator.executeStop(
        stopCommand(),
        "owner-secret",
        new FakeVerifier(),
        new FakeDurableStop(),
        {
          notify: () => {
            throw new Error("notification unavailable");
          },
        },
        barrier,
      );
      assertEqual(result.durableStopRecorded, true, "durable");
      assertEqual(result.processNotified, false, "notification");
      assertEqual(barrier.isTripped(), true, "barrier");
    },
  ],
  [
    "Stop command rejects unknown authority fields before authentication",
    () => {
      const verifier = new FakeVerifier();
      expectFoundationError(
        () =>
          operator.executeStop(
            { ...stopCommand(), remoteHost: "example.test" } as unknown as CollectionRunnerRuntimeStopCommand,
            "owner-secret",
            verifier,
            new FakeDurableStop(),
            new InMemoryCollectionRunnerRuntimeStopNotificationPort(),
            new CollectionRunnerProcessStopBarrier(),
          ),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidOperatorInput,
      );
      assertEqual(verifier.calls, 0, "no authentication");
    },
  ],
  [
    "repository Stop port persists graceful Stop through exact Pilot CAS",
    () => {
      let transitionCalls = 0;
      const runner = {
        getPilotState: () => ({
          activationId: "activation:test",
          state: "ACTIVE",
          aggregateVersion: 3,
        }),
        transitionPilot: (transaction: {
          readonly nextState: string;
          readonly expectedAggregateVersion: number;
        }) => {
          transitionCalls += 1;
          assertEqual(transaction.nextState, "STOP_REQUESTED", "state");
          assertEqual(transaction.expectedAggregateVersion, 3, "version");
          return {
            activationId: "activation:test",
            state: "STOP_REQUESTED",
            aggregateVersion: 4,
          };
        },
      } as unknown as EventContractCollectionRunnerRepository;
      const port = new CollectionRunnerRuntimeRepositoryStopPort(
        runner,
        {} as EventContractCollectionRunnerRecoveryControlRepository,
        {
          evidence: (observedAtUtc) => ({
            observedAtUtc,
            absoluteOffsetMilliseconds: 10,
            healthy: true,
          }),
        },
      );
      const receipt = port.requestStop(stopCommand(), "authorization:test");
      assertEqual(transitionCalls, 1, "transition");
      assertTrue(receipt.receiptFingerprint.startsWith("sha256:"), "receipt");
    },
  ],
  [
    "repository Stop port uses recovery-control transaction for Emergency Stop",
    () => {
      let emergencyCalls = 0;
      const runner = {
        getPilotState: () => ({
          activationId: "activation:test",
          state: "ACTIVE",
          aggregateVersion: 3,
        }),
      } as unknown as EventContractCollectionRunnerRepository;
      const recovery = {
        executeEmergencyStop: () => {
          emergencyCalls += 1;
          return { fingerprint: SHA_E };
        },
      } as unknown as EventContractCollectionRunnerRecoveryControlRepository;
      const port = new CollectionRunnerRuntimeRepositoryStopPort(
        runner,
        recovery,
        {
          evidence: (observedAtUtc) => ({
            observedAtUtc,
            absoluteOffsetMilliseconds: 10,
            healthy: true,
          }),
        },
      );
      const receipt = port.requestStop(
        stopCommand({ mode: CollectionRunnerRuntimeStopMode.Emergency }),
        "authorization:test",
      );
      assertEqual(emergencyCalls, 1, "emergency transaction");
      assertEqual(receipt.receiptFingerprint, SHA_E, "receipt");
    },
  ],
  [
    "operator service binds current ownership clock session and store projection",
    () => {
      const ownership = {
        ownership: {
          fingerprint: SHA_C,
          configurationFingerprint: SHA_A,
          pathFingerprint: SHA_B,
          storePathIdentity: SHA_C,
          bootIdentity: "boot:test",
          processSessionId: "process-session:test",
          acquiredAtUtc: "2026-07-25T13:55:00.000Z",
        },
        verify: () => undefined,
      } as unknown as CollectionRunnerRuntimeOwnershipHandle;
      const projection = {
        readRuntimeProjection: () => ({
          activationId: "activation:test",
          pilotState: "ACTIVE",
          activationStopsAtUtc: "2026-07-25T15:00:00.000Z",
          aggregateVersion: 3,
          taskCounts: status().taskCounts,
          budget: status().budget,
          currentLease: status().currentLease,
          lastReceiptAtUtc: status().lastReceiptAtUtc,
          lastCommitAtUtc: status().lastCommitAtUtc,
          outboxBacklog: status().outboxBacklog,
          outbox: status().outbox,
        }),
      } as EventContractCollectionRunnerRuntimeProjectionRepository;
      const service = new EventContractCollectionRunnerRuntimeOperatorService(
        {
          schemaVersion: "1.0",
          runtimeId: "runtime:test",
          runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
          runtimeControlRoot: "C:\\alpha\\control",
          sqliteRoot: "C:\\alpha\\sqlite",
          storeId: "runner",
          activationId: "activation:test",
          applicationBuildFingerprint: SHA_B,
          runnerDefinitionFingerprint: SHA_D,
          frozenPlanFingerprint: SHA_E,
          fixtureProviderFingerprint: SHA_D,
          maximumClockOffsetMilliseconds: 1_000,
          maximumClockHealthAgeMilliseconds: 60_000,
          deterministic: true,
          networkPermitted: false,
          continuousRunPermitted: false,
          maximumWorkers: 1,
          fingerprint: SHA_A,
        },
        {
          runtimeControlRoot: "C:\\alpha\\control",
          sqliteRoot: "C:\\alpha\\sqlite",
          storePath: "C:\\alpha\\sqlite\\runner.sqlite3",
          storePathIdentity: SHA_C,
          lockDirectory: "C:\\alpha\\control\\lock",
          lockOwnerRecordPath: "C:\\alpha\\control\\lock\\owner.json",
          pathFingerprint: SHA_B,
        },
        ownership,
        {
          schemaVersion: 2,
          foreignKeys: 1,
          journalMode: "wal",
          schemaCatalogChecksum: SHA_D,
        } as never,
        {
          inspectedAtUtc: "2026-07-25T13:54:00.000Z",
          storePath: "C:\\alpha\\sqlite\\runner.sqlite3",
          mutationAllowed: false,
          ownerResumeRequired: true,
          issueCount: 1,
          issues: [
            {
              code: "OPERATIONAL_PILOT_REQUIRES_OWNER_RESUME",
              count: 1,
              blocker: true,
            },
          ],
          fingerprint: SHA_E,
        } as never,
        projection,
        {
          validateRecoverySessionGate: () => ({
            sessionAuthorizationId: "session-auth:test",
          }),
        } as unknown as EventContractCollectionRunnerRecoveryControlRepository,
        {
          sessionAuthorizationId: "session-auth:test",
          authorizationFingerprint: SHA_E,
          activationId: "activation:test",
          bootIdentity: "boot:test",
          processSessionId: "process-session:test",
        },
        new CollectionRunnerProcessStopBarrier(),
        { nowUtc: () => "2026-07-25T14:00:00.000Z" },
        { nowNanoseconds: () => 1n },
        {
          observe: () => ({
            observedAtUtc: "2026-07-25T13:59:59.000Z",
            synchronizationStatus:
              CollectionRunnerClockSynchronizationStatus.Synchronized,
            estimatedAbsoluteUtcOffsetMilliseconds: 12,
            source: "TEST_CLOCK",
            policyVersion: "1.0",
            freshnessDeadlineUtc: "2026-07-25T14:01:00.000Z",
          }),
        },
      );
      assertEqual(
        service.preflight("2026-07-25T14:00:00.000Z").ready,
        true,
        "preflight",
      );
      const report = service.status("2026-07-25T14:00:00.000Z");
      assertEqual(report.health, CollectionRunnerRuntimeHealthStatus.Healthy, "health");
      assertEqual(report.recoveryDisposition, "OWNER_RESUME_AUTHORIZED", "recovery");
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
  `Event Contract Collection Runner Runtime Operator tests passed: ${String(passed)}/${String(tests.length)}.`,
);
