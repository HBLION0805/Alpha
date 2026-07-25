import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerRecoveryError,
  CollectionRunnerRecoveryIssueCode,
  EventContractCollectionRunnerSqliteRecoveryManager,
} from "./EventContractCollectionRunnerSqliteRecovery";
import {
  EventContractCollectionRunnerSqliteStore,
  EventContractCollectionRunnerSqliteStoreError,
  EventContractCollectionRunnerSqliteStoreErrorCode,
} from "./EventContractCollectionRunnerSqliteStore";

const BUILD = "fnv1a64:1111111111111111";
const TIME = "2026-07-24T18:00:00.000Z";
const LATER = "2026-07-24T18:01:00.000Z";
const F1 = "fnv1a64:1111111111111111";
const F2 = "fnv1a64:2222222222222222";

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

async function expectRecoveryError(
  run: () => Promise<unknown>,
  code: CollectionRunnerRecoveryError["code"],
): Promise<void> {
  try {
    await run();
  } catch (error) {
    assertTrue(error instanceof CollectionRunnerRecoveryError, "typed error");
    assertEqual((error as CollectionRunnerRecoveryError).code, code, "code");
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function withRaw(path: string, run: (database: DatabaseSync) => void): void {
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    run(database);
  } finally {
    database.close();
  }
}

async function withRoot(
  run: (root: string) => Promise<void> | void,
): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "alpha-runner-recovery-"));
  try {
    await run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function openStore(
  root: string,
  storeId = "collection-runner",
): EventContractCollectionRunnerSqliteStore {
  return EventContractCollectionRunnerSqliteStore.open({
    rootDirectory: root,
    storeId,
    applicationBuildFingerprint: BUILD,
    appliedAtUtc: TIME,
    recoveryInspectedAtUtc: LATER,
  });
}

function insertActivePilot(path: string): void {
  withRaw(path, (database) => {
    database
      .prepare(`
INSERT INTO runner_definitions
(runner_definition_id, version, fingerprint, build_fingerprint, canonical_record_json, created_at_utc)
VALUES ('runner-1', '1.0', ?, ?, ?, ?)
`)
      .run(F1, F1, `{"fingerprint":"${F1}"}`, TIME);
    database
      .prepare(`
INSERT INTO pilot_activations
(activation_id, activation_fingerprint, owner_id, approved_at_utc, starts_at_utc,
 stops_at_utc, frozen_plan_id, frozen_plan_fingerprint, runner_definition_id,
 runner_definition_version, maximum_events, maximum_requests, current_state,
 aggregate_version, canonical_record_json, created_at_utc)
VALUES ('pilot-1', ?, 'owner-1', ?, ?, '2026-07-24T19:00:00.000Z',
 'plan-1', ?, 'runner-1', '1.0', 1, 2, 'ACTIVE', 1, ?, ?)
`)
      .run(F2, TIME, TIME, F1, `{"fingerprint":"${F2}"}`, TIME);
    database
      .prepare(`
INSERT INTO pilot_transitions
(activation_id, from_state, to_state, from_aggregate_version, to_aggregate_version,
 occurred_at_utc, reason_code, transition_fingerprint)
VALUES ('pilot-1', 'DRAFT', 'ACTIVE', 0, 1, ?, 'RECOVERED_FIXTURE', ?)
`)
      .run(TIME, "fnv1a64:3333333333333333");
    database
      .prepare(`
INSERT INTO activation_budget_counters
(activation_id, aggregate_version, events_scheduled, requests_started, bytes_received,
 records_received, retries_started, evidence_committed, tasks_missed, updated_at_utc)
VALUES ('pilot-1', 1, 0, 0, 0, 0, 0, 0, 0, ?)
`)
      .run(TIME);
  });
}

const tests: ReadonlyArray<
  readonly [string, () => Promise<void> | void]
> = [
  [
    "clean startup recovery allows mutation",
    () =>
      withRoot((root) => {
        const store = openStore(root);
        const report = store.getStartupRecoveryReport();
        assertEqual(report.mutationAllowed, true, "mutation");
        assertEqual(report.issueCount, 0, "issues");
        assertTrue(Object.isFrozen(report), "immutable");
        store.createRunnerRepository();
        store.close();
      }),
  ],
  [
    "operational pilot requires explicit owner resume and blocks repository",
    () =>
      withRoot((root) => {
        const initial = openStore(root);
        const path = initial.getStorePath();
        initial.close();
        insertActivePilot(path);
        const reopened = openStore(root);
        const report = reopened.getStartupRecoveryReport();
        assertEqual(report.mutationAllowed, false, "mutation blocked");
        assertEqual(report.ownerResumeRequired, true, "owner resume");
        assertTrue(
          report.issues.some(
            ({ code }) =>
              code ===
              CollectionRunnerRecoveryIssueCode.OperationalPilotRequiresOwnerResume,
          ),
          "active issue",
        );
        try {
          reopened.createRunnerRepository();
          throw new Error("Expected mutation gate.");
        } catch (error) {
          assertTrue(
            error instanceof EventContractCollectionRunnerSqliteStoreError,
            "typed store error",
          );
          assertEqual(
            (error as EventContractCollectionRunnerSqliteStoreError).code,
            EventContractCollectionRunnerSqliteStoreErrorCode.IntegrityFailed,
            "store code",
          );
        }
        reopened.close();
      }),
  ],
  [
    "canonical fingerprint drift blocks mutation",
    () =>
      withRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRaw(path, (database) =>
          database
            .prepare(`
INSERT INTO runner_definitions
(runner_definition_id, version, fingerprint, build_fingerprint, canonical_record_json, created_at_utc)
VALUES ('runner-1', '1.0', ?, ?, ?, ?)
`)
            .run(F1, F1, `{"fingerprint":"${F2}"}`, TIME),
        );
        const reopened = openStore(root);
        assertTrue(
          reopened
            .getStartupRecoveryReport()
            .issues.some(
              ({ code }) =>
                code ===
                CollectionRunnerRecoveryIssueCode.CanonicalFingerprintMismatch,
            ),
          "fingerprint issue",
        );
        reopened.close();
      }),
  ],
  [
    "budget recomputation detects drift",
    () =>
      withRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        insertActivePilot(path);
        withRaw(path, (database) =>
          database
            .prepare(
              "UPDATE activation_budget_counters SET events_scheduled = 1 WHERE activation_id = 'pilot-1'",
            )
            .run(),
        );
        const reopened = openStore(root);
        assertTrue(
          reopened
            .getStartupRecoveryReport()
            .issues.some(
              ({ code }) =>
                code ===
                CollectionRunnerRecoveryIssueCode.BudgetCounterMismatch,
            ),
          "budget issue",
        );
        reopened.close();
      }),
  ],
  [
    "online backup is independently verified and manifest bound",
    () =>
      withRoot(async (root) => {
        const store = openStore(join(root, "runtime"));
        const manifest = await store
          .createRecoveryManager()
          .createVerifiedBackup({
            backupRootDirectory: join(root, "backups"),
            backupId: "backup-1",
            createdAtUtc: LATER,
            retentionCount: 3,
          });
        assertTrue(existsSync(manifest.backupPath), "backup");
        assertTrue(existsSync(manifest.manifestPath), "manifest");
        assertTrue(manifest.backupBytes > 0, "bytes");
        assertTrue(manifest.pageCount > 0, "pages");
        assertTrue(Object.isFrozen(manifest), "immutable manifest");
        store.close();
      }),
  ],
  [
    "backup identities never overwrite",
    () =>
      withRoot(async (root) => {
        const store = openStore(join(root, "runtime"));
        const manager = store.createRecoveryManager();
        const options = {
          backupRootDirectory: join(root, "backups"),
          backupId: "backup-1",
          createdAtUtc: LATER,
          retentionCount: 1,
        } as const;
        await manager.createVerifiedBackup(options);
        await expectRecoveryError(
          () => manager.createVerifiedBackup(options),
          "BACKUP_CONFLICT",
        );
        store.close();
      }),
  ],
  [
    "restore creates a new verified path and requires owner switch",
    () =>
      withRoot(async (root) => {
        const store = openStore(join(root, "runtime"));
        const manifest = await store
          .createRecoveryManager()
          .createVerifiedBackup({
            backupRootDirectory: join(root, "backups"),
            backupId: "backup-1",
            createdAtUtc: LATER,
            retentionCount: 2,
          });
        store.close();
        const restored =
          await EventContractCollectionRunnerSqliteRecoveryManager.restoreVerifiedBackup(
            {
              backupRootDirectory: join(root, "backups"),
              manifest,
              targetRootDirectory: join(root, "restored"),
              targetStoreId: "restored-1",
              verifiedAtUtc: LATER,
            },
          );
        assertTrue(existsSync(restored.targetStorePath), "restored file");
        assertEqual(restored.verification.mutationAllowed, true, "verified");
        assertEqual(restored.ownerSwitchRequired, true, "owner switch");
        assertEqual(restored.operatorResumeRequired, true, "operator resume");
      }),
  ],
  [
    "restore refuses to overwrite an existing target",
    () =>
      withRoot(async (root) => {
        const store = openStore(join(root, "runtime"));
        const manifest = await store
          .createRecoveryManager()
          .createVerifiedBackup({
            backupRootDirectory: join(root, "backups"),
            backupId: "backup-1",
            createdAtUtc: LATER,
            retentionCount: 1,
          });
        store.close();
        openStore(join(root, "restored"), "restored-1").close();
        await expectRecoveryError(
          () =>
            EventContractCollectionRunnerSqliteRecoveryManager.restoreVerifiedBackup(
              {
                backupRootDirectory: join(root, "backups"),
                manifest,
                targetRootDirectory: join(root, "restored"),
                targetStoreId: "restored-1",
                verifiedAtUtc: LATER,
              },
            ),
          "RESTORE_CONFLICT",
        );
      }),
  ],
  [
    "tampered backup digest blocks restore",
    () =>
      withRoot(async (root) => {
        const store = openStore(join(root, "runtime"));
        const manifest = await store
          .createRecoveryManager()
          .createVerifiedBackup({
            backupRootDirectory: join(root, "backups"),
            backupId: "backup-1",
            createdAtUtc: LATER,
            retentionCount: 1,
          });
        store.close();
        appendFileSync(manifest.backupPath, "tamper");
        await expectRecoveryError(
          () =>
            EventContractCollectionRunnerSqliteRecoveryManager.restoreVerifiedBackup(
              {
                backupRootDirectory: join(root, "backups"),
                manifest,
                targetRootDirectory: join(root, "restored"),
                targetStoreId: "restored-1",
                verifiedAtUtc: LATER,
              },
            ),
          "BACKUP_VERIFICATION_FAILED",
        );
      }),
  ],
  [
    "truncated database is rejected before recovery mutation",
    () =>
      withRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        truncateSync(path, 128);
        try {
          openStore(root);
          throw new Error("Expected corrupt store rejection.");
        } catch (error) {
          assertTrue(
            error instanceof EventContractCollectionRunnerSqliteStoreError,
            "typed corrupt error",
          );
        }
      }),
  ],
  [
    "manifest file tampering blocks restore",
    () =>
      withRoot(async (root) => {
        const store = openStore(join(root, "runtime"));
        const manifest = await store
          .createRecoveryManager()
          .createVerifiedBackup({
            backupRootDirectory: join(root, "backups"),
            backupId: "backup-1",
            createdAtUtc: LATER,
            retentionCount: 1,
          });
        store.close();
        const text = readFileSync(manifest.manifestPath, "utf8");
        writeFileSync(
          manifest.manifestPath,
          text.replace('"retentionCount":1', '"retentionCount":2'),
        );
        await expectRecoveryError(
          () =>
            EventContractCollectionRunnerSqliteRecoveryManager.restoreVerifiedBackup(
              {
                backupRootDirectory: join(root, "backups"),
                manifest,
                targetRootDirectory: join(root, "restored"),
                targetStoreId: "restored-1",
                verifiedAtUtc: LATER,
              },
            ),
          "BACKUP_VERIFICATION_FAILED",
        );
      }),
  ],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(
    `SQLite Event Contract Collection Runner recovery tests passed: ${String(passed)}/${String(tests.length)}.`,
  );
}

void main();
