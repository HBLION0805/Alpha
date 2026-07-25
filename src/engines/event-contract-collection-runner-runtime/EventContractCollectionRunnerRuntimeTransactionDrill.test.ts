import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process, { cwd, execPath } from "node:process";
import { DatabaseSync } from "node:sqlite";

import { CollectionRunnerTaskState } from "../../contracts";
import { EventContractCollectionRunnerSqliteStore } from "../../repositories";
import {
  TRANSACTION_DRILL_APPLIED_AT,
  TRANSACTION_DRILL_BUILD,
  replayTransactionDrillEvidence,
} from "../../../scripts/fixtures/collection-runner-transaction-drill-fixture";
import {
  replayQuarantineTransactionDrill,
  type QuarantineTransactionDrillCheckpoint,
} from "../../../scripts/fixtures/collection-runner-quarantine-drill-fixture";
import type { AuthenticatedSessionTransactionDrillCheckpoint } from "../../../scripts/fixtures/collection-runner-session-drill-fixture";
import {
  CollectionRunnerRecoveryControlRepositoryError,
  CollectionRunnerRecoveryControlRepositoryErrorCode,
} from "../../repositories/EventContractCollectionRunnerRecoveryControlRepository";
import { CollectionRunnerProcessStopBarrier } from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";

const CHILD = join(
  cwd(),
  "scripts",
  "fixtures",
  "collection-runner-transaction-drill-child.ts",
);
const TSX = join(cwd(), "node_modules", "tsx", "dist", "cli.mjs");

type DrillMode =
  | "before-lock"
  | "after-lock"
  | "after-store"
  | "after-t6"
  | "after-t7"
  | "after-t8"
  | "during-validation"
  | "during-stop"
  | "after-quarantine"
  | "after-session-auth"
  | "after-t10";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}.`,
    );
  }
}

interface StartupCheckpoint {
  readonly storePath: string;
  readonly lockDirectory: string;
  readonly ownerRecordPath: string;
}

async function runStartupCrashDrill(
  mode: "before-lock" | "after-lock" | "after-store",
  inspect: (
    root: string,
    checkpoint: StartupCheckpoint | null,
  ) => void | Promise<void>,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), `alpha-${mode}-`));
  const child = spawn(execPath, [TSX, CHILD, mode, root], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let exited = false;
  try {
    const payload = await waitForCheckpoint(child, mode);
    const checkpoint =
      mode === "before-lock"
        ? null
        : (JSON.parse(payload) as StartupCheckpoint);
    const exit = once(child, "exit");
    assertTrue(child.kill(), `${mode} child kill accepted`);
    await exit;
    exited = true;
    await inspect(root, checkpoint);
  } finally {
    if (!exited && child.exitCode === null) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

async function waitForCheckpoint(
  child: ChildProcessWithoutNullStreams,
  mode: DrillMode,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let output = "";
    let errors = "";
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for ${mode}; stderr=${errors.slice(0, 500)}`,
        ),
      );
    }, 10_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      errors += chunk;
    });
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
      const line = output
        .split(/\r?\n/u)
        .find((candidate) => candidate.startsWith(`CHECKPOINT ${mode} `));
      if (line !== undefined) {
        clearTimeout(timeout);
        resolve(line.slice(`CHECKPOINT ${mode} `.length));
      }
    });
    child.once("exit", (code) => {
      if (!output.includes(`CHECKPOINT ${mode} `)) {
        clearTimeout(timeout);
        reject(
          new Error(
            `Child exited ${String(code)} before ${mode}; stderr=${errors.slice(0, 500)}`,
          ),
        );
      }
    });
  });
}

function scalar(
  database: DatabaseSync,
  sql: string,
): string | number | null {
  const row = database.prepare(sql).get();
  return row === undefined ? null : (Object.values(row)[0] as string | number);
}

async function openRecoveredStore(
  root: string,
): Promise<EventContractCollectionRunnerSqliteStore> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return EventContractCollectionRunnerSqliteStore.open({
        rootDirectory: root,
        applicationBuildFingerprint: TRANSACTION_DRILL_BUILD,
        appliedAtUtc: TRANSACTION_DRILL_APPLIED_AT,
        recoveryInspectedAtUtc: "2026-07-25T13:30:00.000Z",
      });
    } catch (error) {
      lastError = error;
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
  }
  throw lastError;
}

async function runCrashDrill(
  mode: DrillMode,
  inspect: (database: DatabaseSync) => void,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), `alpha-${mode}-`));
  const child = spawn(execPath, [TSX, CHILD, mode, root], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let exited = false;
  try {
    const storePath = await waitForCheckpoint(child, mode);
    const exit = once(child, "exit");
    assertTrue(child.kill(), `${mode} child kill accepted`);
    await exit;
    exited = true;

    const recovered = await openRecoveredStore(root);
    assertEqual(recovered.getStorePath(), storePath, `${mode} store identity`);
    recovered.close();
    if (mode === "after-t10") {
      const replay = replayTransactionDrillEvidence(root);
      assertEqual(
        replay.evidenceId,
        "evidence:transaction-drill",
        "exact evidence replay",
      );
    }
    const database = new DatabaseSync(storePath, { readOnly: true });
    try {
      assertEqual(
        scalar(database, "PRAGMA quick_check"),
        "ok",
        `${mode} quick check`,
      );
      inspect(database);
    } finally {
      database.close();
    }
  } finally {
    if (!exited && child.exitCode === null) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

async function runStopPersistenceCrashDrill(): Promise<void> {
  const mode: DrillMode = "during-stop";
  const root = mkdtempSync(join(tmpdir(), "alpha-during-stop-"));
  const child = spawn(execPath, [TSX, CHILD, mode, root], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let exited = false;
  try {
    const payload = JSON.parse(
      await waitForCheckpoint(child, mode),
    ) as {
      readonly storePath: string;
      readonly barrierTripped: boolean;
    };
    assertTrue(payload.barrierTripped, "process Stop barrier");
    const exit = once(child, "exit");
    assertTrue(child.kill(), "during-stop child kill accepted");
    await exit;
    exited = true;
    const recovered = await openRecoveredStore(root);
    recovered.close();
    const database = new DatabaseSync(payload.storePath, { readOnly: true });
    try {
      assertEqual(
        scalar(database, "SELECT count(*) FROM emergency_stop_events"),
        0,
        "rolled-back Stop rows",
      );
      assertEqual(
        scalar(
          database,
          "SELECT current_state FROM pilot_activations LIMIT 1",
        ),
        "ACTIVE",
        "pilot remains active",
      );
      assertEqual(
        scalar(database, "SELECT count(*) FROM control_execution_receipts"),
        0,
        "partial control receipts",
      );
    } finally {
      database.close();
    }
  } finally {
    if (!exited && child.exitCode === null) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

async function runQuarantineCrashDrill(): Promise<void> {
  const mode: DrillMode = "after-quarantine";
  const root = mkdtempSync(join(tmpdir(), "alpha-after-quarantine-"));
  const child = spawn(execPath, [TSX, CHILD, mode, root], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let exited = false;
  try {
    const checkpoint = JSON.parse(
      await waitForCheckpoint(child, mode),
    ) as QuarantineTransactionDrillCheckpoint;
    const exit = once(child, "exit");
    assertTrue(child.kill(), "after-quarantine child kill accepted");
    await exit;
    exited = true;
    assertEqual(
      existsSync(checkpoint.lockDirectory),
      false,
      "active ownership lock",
    );
    const replay = replayQuarantineTransactionDrill(root, checkpoint);
    assertEqual(
      replay.fingerprint,
      checkpoint.receiptFingerprint,
      "quarantine receipt replay",
    );
    assertEqual(
      existsSync(`${checkpoint.lockDirectory}.recovery-guard`),
      false,
      "recovery guard released",
    );
  } finally {
    if (!exited && child.exitCode === null) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

async function runAuthenticatedSessionCrashDrill(): Promise<void> {
  const mode: DrillMode = "after-session-auth";
  const root = mkdtempSync(join(tmpdir(), "alpha-after-session-auth-"));
  const child = spawn(execPath, [TSX, CHILD, mode, root], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let exited = false;
  try {
    const checkpoint = JSON.parse(
      await waitForCheckpoint(child, mode),
    ) as AuthenticatedSessionTransactionDrillCheckpoint;
    const exit = once(child, "exit");
    assertTrue(child.kill(), "after-session-auth child kill accepted");
    await exit;
    exited = true;
    const restarted = await openRecoveredStore(root);
    try {
      const control = restarted.createRecoveryControlRepository();
      assertTrue(
        control.getSessionAuthorization(checkpoint.session.processSessionId) !==
          null,
        "session evidence survives",
      );
      let rejected = false;
      try {
        restarted.createAuthorizedRunnerRepository(
          {
            sessionAuthorizationId:
              checkpoint.session.sessionAuthorizationId,
            authorizationFingerprint:
              checkpoint.session.authorizationFingerprint,
            activationId: checkpoint.session.activationId,
            bootIdentity: checkpoint.session.bootIdentity,
            processSessionId: checkpoint.session.processSessionId,
          },
          "2026-07-25T13:00:11.000Z",
          new CollectionRunnerProcessStopBarrier(),
        );
      } catch (error) {
        rejected =
          error instanceof CollectionRunnerRecoveryControlRepositoryError &&
          error.code ===
            CollectionRunnerRecoveryControlRepositoryErrorCode.AuthorityMismatch;
      }
      assertTrue(rejected, "old process session rejected after restart");
    } finally {
      restarted.close();
    }
  } finally {
    if (!exited && child.exitCode === null) {
      const exit = once(child, "exit");
      child.kill();
      await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
}

const tests: ReadonlyArray<
  readonly [string, () => Promise<void>]
> = [
  [
    "crash before ownership leaves no lock or store mutation",
    () =>
      runStartupCrashDrill("before-lock", (root, checkpoint) => {
        assertEqual(checkpoint, null, "before-lock checkpoint");
        assertEqual(existsSync(join(root, "control")), false, "control absent");
        assertEqual(existsSync(join(root, "sqlite")), false, "sqlite absent");
      }),
  ],
  [
    "crash after ownership preserves immutable stale owner evidence",
    () =>
      runStartupCrashDrill("after-lock", (_root, checkpoint) => {
        assertTrue(checkpoint !== null, "after-lock checkpoint");
        assertTrue(
          existsSync(checkpoint!.lockDirectory),
          "stale lock directory",
        );
        assertTrue(
          existsSync(checkpoint!.ownerRecordPath),
          "stale owner record",
        );
        assertEqual(existsSync(checkpoint!.storePath), false, "store absent");
      }),
  ],
  [
    "crash after store open preserves stale ownership without session authority",
    () =>
      runStartupCrashDrill("after-store", async (root, checkpoint) => {
        assertTrue(checkpoint !== null, "after-store checkpoint");
        assertTrue(existsSync(checkpoint!.ownerRecordPath), "owner record");
        assertTrue(existsSync(checkpoint!.storePath), "store present");
        const recovered = await openRecoveredStore(join(root, "sqlite"));
        recovered.close();
        const database = new DatabaseSync(checkpoint!.storePath, {
          readOnly: true,
        });
        try {
          assertEqual(
            scalar(database, "SELECT count(*) FROM pilot_activations"),
            0,
            "pilot rows",
          );
          assertEqual(
            scalar(
              database,
              "SELECT count(*) FROM recovery_session_authorizations",
            ),
            0,
            "session authorizations",
          );
        } finally {
          database.close();
        }
      }),
  ],
  [
    "crash after T6 preserves DUE without lease or attempt",
    () =>
      runCrashDrill("after-t6", (database) => {
        assertEqual(
          scalar(
            database,
            "SELECT current_state FROM scheduled_tasks LIMIT 1",
          ),
          CollectionRunnerTaskState.Due,
          "task state",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM task_leases"),
          0,
          "leases",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM attempt_records"),
          0,
          "attempts",
        );
      }),
  ],
  [
    "crash after T7 preserves lease ambiguity without attempt",
    () =>
      runCrashDrill("after-t7", (database) => {
        assertEqual(
          scalar(
            database,
            "SELECT current_state FROM scheduled_tasks LIMIT 1",
          ),
          CollectionRunnerTaskState.Leased,
          "task state",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM task_leases"),
          1,
          "leases",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM attempt_records"),
          0,
          "attempts",
        );
      }),
  ],
  [
    "crash after T8 preserves unknown request outcome without result",
    () =>
      runCrashDrill("after-t8", (database) => {
        assertEqual(
          scalar(
            database,
            "SELECT current_state FROM scheduled_tasks LIMIT 1",
          ),
          CollectionRunnerTaskState.InFlight,
          "task state",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM attempt_records"),
          1,
          "attempts",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM attempt_results"),
          0,
          "results",
        );
      }),
  ],
  [
    "crash during validation persists no raw body or evidence",
    () =>
      runCrashDrill("during-validation", (database) => {
        assertEqual(
          scalar(
            database,
            "SELECT current_state FROM scheduled_tasks LIMIT 1",
          ),
          CollectionRunnerTaskState.Validating,
          "task state",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM attempt_results"),
          0,
          "results",
        );
        assertEqual(
          scalar(
            database,
            "SELECT count(*) FROM normalized_source_evidence",
          ),
          0,
          "evidence",
        );
      }),
  ],
  [
    "crash after session authorization preserves evidence but rejects old authority",
    runAuthenticatedSessionCrashDrill,
  ],
  [
    "crash during Stop persistence rolls back the complete control transaction",
    runStopPersistenceCrashDrill,
  ],
  [
    "crash after quarantine rename replays the exact durable receipt",
    runQuarantineCrashDrill,
  ],
  [
    "crash after T10 preserves committed evidence and removes lease",
    () =>
      runCrashDrill("after-t10", (database) => {
        assertEqual(
          scalar(
            database,
            "SELECT current_state FROM scheduled_tasks LIMIT 1",
          ),
          CollectionRunnerTaskState.Committed,
          "task state",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM attempt_results"),
          1,
          "results",
        );
        assertEqual(
          scalar(
            database,
            "SELECT count(*) FROM normalized_source_evidence",
          ),
          1,
          "evidence",
        );
        assertEqual(
          scalar(database, "SELECT count(*) FROM task_leases"),
          0,
          "leases",
        );
        assertEqual(
          scalar(
            database,
            "SELECT evidence_committed FROM activation_budget_counters LIMIT 1",
          ),
          1,
          "evidence counter",
        );
      }),
  ],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    await run();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(
    `Event Contract Collection Runner transaction-boundary process drills: ${passed}/${tests.length} passed.`,
  );
}

const keepAlive = setInterval(() => undefined, 1_000);
main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    clearInterval(keepAlive);
  });
