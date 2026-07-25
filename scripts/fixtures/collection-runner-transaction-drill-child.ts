import { argv, stderr, stdout } from "node:process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  CollectionRunnerRuntimeMode,
  type CollectionRunnerBootIdentityPort,
  type CollectionRunnerProcessNoncePort,
  type CollectionRunnerWallClock,
} from "../../src/contracts";
import {
  acquireCollectionRunnerRuntimeOwnership,
  createCollectionRunnerRuntimeConfiguration,
  resolveCollectionRunnerRuntimePaths,
} from "../../src/engines/event-contract-collection-runner-runtime/EventContractCollectionRunnerRuntimeFoundation";
import { EventContractCollectionRunnerSqliteStore } from "../../src/repositories";
import { CollectionRunnerProcessStopBarrier } from "../../src/repositories/SessionGatedEventContractCollectionRunnerRepository";
import { executeQuarantineTransactionDrill } from "./collection-runner-quarantine-drill-fixture";
import { createAuthenticatedSessionTransactionDrill } from "./collection-runner-session-drill-fixture";
import {
  acquireTransactionDrillLease,
  commitTransactionDrillEvidence,
  createCollectionRunnerTransactionDrillFixture,
  markTransactionDrillValidating,
  startTransactionDrillAttempt,
  TRANSACTION_DRILL_APPLIED_AT,
  TRANSACTION_DRILL_BUILD,
  transitionTransactionDrillTaskDue,
} from "./collection-runner-transaction-drill-fixture";

const [mode, sqliteRoot] = argv.slice(2);
const modes = new Set([
  "before-lock",
  "after-lock",
  "after-store",
  "after-t6",
  "after-t7",
  "after-t8",
  "during-validation",
  "during-stop",
  "after-quarantine",
  "after-session-auth",
  "after-t10",
]);

function createStartupBoundary(sqliteRoot: string, mode: string): string {
  const runtimeControlRoot = join(sqliteRoot, "control");
  const storeRoot = join(sqliteRoot, "sqlite");
  if (mode === "before-lock") return sqliteRoot;
  mkdirSync(runtimeControlRoot);
  mkdirSync(storeRoot);
  const configuration = createCollectionRunnerRuntimeConfiguration({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    runtimeId: "runtime:transaction-drill",
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    runtimeControlRoot,
    sqliteRoot: storeRoot,
    storeId: "collection-runner",
    activationId: "activation:transaction-drill",
    applicationBuildFingerprint: TRANSACTION_DRILL_BUILD,
    runnerDefinitionFingerprint: "fnv1a64:2222222222222222",
    frozenPlanFingerprint: "fnv1a64:3333333333333333",
    fixtureProviderFingerprint: "fnv1a64:4444444444444444",
    maximumClockOffsetMilliseconds: 1_000,
    maximumClockHealthAgeMilliseconds: 5_000,
  });
  const paths = resolveCollectionRunnerRuntimePaths(configuration);
  const bootIdentityPort: CollectionRunnerBootIdentityPort = {
    readBootIdentity: () => ({
      bootIdentity: "boot:transaction-drill",
      source: "TRANSACTION_DRILL",
      sourceVersion: "1.0",
    }),
  };
  const processNoncePort: CollectionRunnerProcessNoncePort = {
    createNonce: () => "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  };
  const wallClock: CollectionRunnerWallClock = {
    nowUtc: () => "2026-07-25T13:00:00.000Z",
  };
  acquireCollectionRunnerRuntimeOwnership({
    configuration,
    paths,
    bootIdentityPort,
    processNoncePort,
    wallClock,
  });
  if (mode === "after-store") {
    EventContractCollectionRunnerSqliteStore.open({
      rootDirectory: storeRoot,
      applicationBuildFingerprint: TRANSACTION_DRILL_BUILD,
      appliedAtUtc: TRANSACTION_DRILL_APPLIED_AT,
    });
  }
  return JSON.stringify({
    storePath: paths.storePath,
    lockDirectory: paths.lockDirectory,
    ownerRecordPath: paths.lockOwnerRecordPath,
  });
}

if (sqliteRoot === undefined || mode === undefined || !modes.has(mode)) {
  stderr.write("INVALID_ARGUMENTS\n");
  process.exitCode = 64;
} else {
  try {
    if (
      mode === "before-lock" ||
      mode === "after-lock" ||
      mode === "after-store"
    ) {
      stdout.write(
        `CHECKPOINT ${mode} ${createStartupBoundary(sqliteRoot, mode)}\n`,
      );
      setInterval(() => undefined, 1_000);
    } else if (mode === "after-quarantine") {
      stdout.write(
        `CHECKPOINT ${mode} ${JSON.stringify(
          executeQuarantineTransactionDrill(sqliteRoot),
        )}\n`,
      );
      setInterval(() => undefined, 1_000);
    } else if (mode === "after-session-auth") {
      const sessionDrill = createAuthenticatedSessionTransactionDrill(
        sqliteRoot,
      );
      stdout.write(
        `CHECKPOINT ${mode} ${JSON.stringify(sessionDrill.checkpoint)}\n`,
      );
      setInterval(() => undefined, 1_000);
    } else {
      const fixture =
        createCollectionRunnerTransactionDrillFixture(sqliteRoot);
      if (mode === "during-stop") {
        const barrier = new CollectionRunnerProcessStopBarrier();
        barrier.trip("EMERGENCY_STOP_PENDING");
        const database = new DatabaseSync(fixture.storePath);
        database.exec("BEGIN IMMEDIATE");
        database.prepare(`
INSERT INTO emergency_stop_events (
  stop_event_id,
  stop_fingerprint,
  idempotency_key,
  activation_id,
  expected_activation_aggregate_version,
  directive,
  trigger_codes_json,
  evaluated_at_utc,
  executed_at_utc,
  canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
          "stop:transaction-drill",
          "fnv1a64:aaaaaaaaaaaaaaaa",
          "fnv1a64:bbbbbbbbbbbbbbbb",
          fixture.activation.activationId,
          2,
          "REQUEST_STOP",
          '["OWNER_REQUEST"]',
          "2026-07-25T13:04:00.000Z",
          "2026-07-25T13:04:00.100Z",
          "{}",
        );
        stdout.write(
          `CHECKPOINT ${mode} ${JSON.stringify({
            storePath: fixture.storePath,
            barrierTripped: barrier.isTripped(),
          })}\n`,
        );
        setInterval(() => undefined, 1_000);
      } else {
        transitionTransactionDrillTaskDue(fixture);
        if (mode !== "after-t6") {
          acquireTransactionDrillLease(fixture);
        }
        if (
          mode === "after-t8" ||
          mode === "during-validation" ||
          mode === "after-t10"
        ) {
          startTransactionDrillAttempt(fixture);
        }
        if (mode === "during-validation" || mode === "after-t10") {
          markTransactionDrillValidating(fixture);
        }
        if (mode === "after-t10") {
          commitTransactionDrillEvidence(fixture);
        }
        stdout.write(`CHECKPOINT ${mode} ${fixture.storePath}\n`);
        setInterval(() => undefined, 1_000);
      }
    }
  } catch (error) {
    stderr.write(
      `ERROR ${error instanceof Error ? error.message : "unknown"}\n`,
    );
    process.exitCode = 2;
  }
}
