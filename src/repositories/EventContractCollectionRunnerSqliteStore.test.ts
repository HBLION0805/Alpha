import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  COLLECTION_RUNNER_SQLITE_DEPENDENCY_DECISION,
  COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM,
  EventContractCollectionRunnerSqliteStore,
  EventContractCollectionRunnerSqliteStoreError,
  EventContractCollectionRunnerSqliteStoreErrorCode,
} from "./EventContractCollectionRunnerSqliteStore";
import {
  COLLECTION_RUNNER_SQLITE_MIGRATION_NAME,
  COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
  COLLECTION_RUNNER_SQLITE_TABLES,
} from "./EventContractCollectionRunnerSqliteMigrationV1";

const BUILD_FINGERPRINT = "fnv1a64:1111111111111111";
const APPLIED_AT = "2026-07-24T15:00:00.000Z";

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
      "error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function withTemporaryRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-runner-sqlite-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function openStore(root: string): EventContractCollectionRunnerSqliteStore {
  return EventContractCollectionRunnerSqliteStore.open({
    rootDirectory: root,
    applicationBuildFingerprint: BUILD_FINGERPRINT,
    appliedAtUtc: APPLIED_AT,
  });
}

function withRawDatabase(path: string, run: (database: DatabaseSync) => void): void {
  const database = new DatabaseSync(path);
  try {
    run(database);
  } finally {
    database.close();
  }
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "dependency decision uses the Node standard library only",
    () => {
      assertEqual(
        COLLECTION_RUNNER_SQLITE_DEPENDENCY_DECISION.binding,
        "node:sqlite",
        "binding",
      );
      assertEqual(
        COLLECTION_RUNNER_SQLITE_DEPENDENCY_DECISION.thirdPartyPackage,
        null,
        "third-party package",
      );
      assertEqual(
        COLLECTION_RUNNER_SQLITE_DEPENDENCY_DECISION.productionApproved,
        false,
        "production approval",
      );
    },
  ],
  [
    "new store is created beneath the approved root",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        assertEqual(
          store.getStorePath(),
          join(root, "collection-runner.sqlite3"),
          "store path",
        );
        store.close();
        assertTrue(
          statSync(join(root, "collection-runner.sqlite3")).size > 0,
          "database file",
        );
      }),
  ],
  [
    "readiness proves all safety-critical pragmas",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const readiness = store.getReadiness();
        assertEqual(readiness.journalMode, "wal", "journal mode");
        assertEqual(readiness.synchronous, 2, "synchronous");
        assertEqual(readiness.foreignKeys, 1, "foreign keys");
        assertEqual(readiness.busyTimeoutMilliseconds, 5000, "busy timeout");
        assertEqual(readiness.trustedSchema, 0, "trusted schema");
        assertEqual(readiness.recursiveTriggers, 0, "recursive triggers");
        assertEqual(readiness.tempStore, 2, "temp store");
        assertEqual(readiness.defensive, true, "defensive mode");
        assertEqual(
          readiness.onlineBackupAvailable,
          true,
          "online backup capability",
        );
        assertEqual(
          readiness.walCheckpointAvailable,
          true,
          "WAL checkpoint capability",
        );
        assertTrue(Object.isFrozen(readiness), "immutable readiness");
        store.close();
      }),
  ],
  [
    "migration creates the exact fourteen-table STRICT schema",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) => {
          const rows = database
            .prepare(`
SELECT name, strict
FROM pragma_table_list
WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`)
            .all();
          assertEqual(
            rows.length,
            COLLECTION_RUNNER_SQLITE_TABLES.length,
            "table count",
          );
          assertEqual(
            rows.map(({ name }) => name).join(","),
            COLLECTION_RUNNER_SQLITE_TABLES.join(","),
            "table catalog",
          );
          assertTrue(rows.every(({ strict }) => strict === 1), "STRICT tables");
        });
      }),
  ],
  [
    "migration history is checksum and version bound",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) => {
          const row = database
            .prepare("SELECT * FROM schema_migrations")
            .get();
          assertEqual(
            row?.migration_version,
            COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
            "migration version",
          );
          assertEqual(
            row?.migration_name,
            COLLECTION_RUNNER_SQLITE_MIGRATION_NAME,
            "migration name",
          );
          assertEqual(
            row?.migration_checksum,
            COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM,
            "migration checksum",
          );
          assertEqual(
            database.prepare("PRAGMA user_version").get()?.user_version,
            COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
            "user version",
          );
        });
      }),
  ],
  [
    "reopening is idempotent and does not append migration history",
    () =>
      withTemporaryRoot((root) => {
        openStore(root).close();
        const reopened = openStore(root);
        const path = reopened.getStorePath();
        reopened.close();
        withRawDatabase(path, (database) => {
          assertEqual(
            database
              .prepare("SELECT count(*) AS count FROM schema_migrations")
              .get()?.count,
            1,
            "migration count",
          );
        });
      }),
  ],
  [
    "store ID rejects traversal and ambiguous names",
    () =>
      withTemporaryRoot((root) => {
        for (const storeId of [
          "../escape",
          "UPPER",
          "-leading",
          "trailing-",
          "two..dots",
          "",
        ]) {
          expectStoreError(
            () =>
              EventContractCollectionRunnerSqliteStore.open({
                rootDirectory: root,
                storeId,
                applicationBuildFingerprint: BUILD_FINGERPRINT,
                appliedAtUtc: APPLIED_AT,
              }),
            EventContractCollectionRunnerSqliteStoreErrorCode.InvalidConfiguration,
          );
        }
      }),
  ],
  [
    "configuration rejects invented time and malformed build lineage",
    () =>
      withTemporaryRoot((root) => {
        expectStoreError(
          () =>
            EventContractCollectionRunnerSqliteStore.open({
              rootDirectory: root,
              applicationBuildFingerprint: "sha256:not-build-lineage",
              appliedAtUtc: APPLIED_AT,
            }),
          EventContractCollectionRunnerSqliteStoreErrorCode.InvalidConfiguration,
        );
        expectStoreError(
          () =>
            EventContractCollectionRunnerSqliteStore.open({
              rootDirectory: root,
              applicationBuildFingerprint: BUILD_FINGERPRINT,
              appliedAtUtc: "2026-99-30T15:00:00.000Z",
            }),
          EventContractCollectionRunnerSqliteStoreErrorCode.InvalidConfiguration,
        );
      }),
  ],
  [
    "non-file store identity fails closed",
    () =>
      withTemporaryRoot((root) => {
        mkdirSync(join(root, "collection-runner.sqlite3"));
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.UnsafeFilesystemEntry,
        );
      }),
  ],
  [
    "non-directory runtime root returns a sanitized path error",
    () =>
      withTemporaryRoot((root) => {
        const fileRoot = join(root, "not-a-directory");
        writeFileSync(fileRoot, "occupied");
        expectStoreError(
          () =>
            EventContractCollectionRunnerSqliteStore.open({
              rootDirectory: fileRoot,
              applicationBuildFingerprint: BUILD_FINGERPRINT,
              appliedAtUtc: APPLIED_AT,
            }),
          EventContractCollectionRunnerSqliteStoreErrorCode.InvalidPath,
        );
      }),
  ],
  [
    "future schema version fails closed",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) =>
          database.exec("PRAGMA user_version = 2"),
        );
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.FutureSchema,
        );
      }),
  ],
  [
    "altered migration checksum fails closed",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) =>
          database.exec(
            "UPDATE schema_migrations SET migration_checksum = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'",
          ),
        );
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
        );
      }),
  ],
  [
    "missing migration history fails closed",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) =>
          database.exec("DELETE FROM schema_migrations"),
        );
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
        );
      }),
  ],
  [
    "unexpected table fails exact schema verification",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) =>
          database.exec("CREATE TABLE rogue_data (value TEXT) STRICT"),
        );
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.SchemaMismatch,
        );
      }),
  ],
  [
    "altered column catalog fails exact migration verification",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) =>
          database.exec(
            "ALTER TABLE activation_budget_counters ADD COLUMN injected_value TEXT",
          ),
        );
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.SchemaMismatch,
        );
      }),
  ],
  [
    "unversioned preexisting table blocks migration without deletion",
    () =>
      withTemporaryRoot((root) => {
        const path = join(root, "collection-runner.sqlite3");
        withRawDatabase(path, (database) =>
          database.exec("CREATE TABLE prior_data (value TEXT) STRICT"),
        );
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
        );
        withRawDatabase(path, (database) => {
          assertTrue(
            database
              .prepare(
                "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'prior_data'",
              )
              .get() !== undefined,
            "prior table preserved",
          );
          assertTrue(
            database
              .prepare(
                "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'",
              )
              .get() === undefined,
            "no partial migration",
          );
        });
      }),
  ],
  [
    "STRICT typing rejects a text migration version",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        withRawDatabase(path, (database) => {
          let rejected = false;
          try {
            database.exec(`
INSERT INTO schema_migrations VALUES (
  'not-an-integer',
  'bad',
  'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '${APPLIED_AT}',
  '${BUILD_FINGERPRINT}',
  '1.0'
)
`);
          } catch {
            rejected = true;
          }
          assertTrue(rejected, "strict type rejection");
        });
      }),
  ],
  [
    "foreign-key enforcement rejects an orphan provider",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const path = store.getStorePath();
        store.close();
        const database = new DatabaseSync(path, {
          enableForeignKeyConstraints: true,
        });
        try {
          let rejected = false;
          try {
            database.exec(`
INSERT INTO pilot_activation_providers
VALUES ('missing-activation', 'fnv1a64:2222222222222222')
`);
          } catch {
            rejected = true;
          }
          assertTrue(rejected, "foreign key rejection");
        } finally {
          database.close();
        }
      }),
  ],
  [
    "malformed database bytes fail closed",
    () =>
      withTemporaryRoot((root) => {
        writeFileSync(
          join(root, "collection-runner.sqlite3"),
          "not a sqlite database",
        );
        expectStoreError(
          () => openStore(root),
          EventContractCollectionRunnerSqliteStoreErrorCode.OpenFailed,
        );
      }),
  ],
  [
    "migration checksum uses canonical sha256 form",
    () => {
      assertTrue(
        /^sha256:[0-9a-f]{64}$/u.test(
          COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM,
        ),
        "checksum form",
      );
    },
  ],
  [
    "foundation does not expose a raw database or mutation operation",
    () =>
      withTemporaryRoot((root) => {
        const store = openStore(root);
        const publicKeys = Object.getOwnPropertyNames(
          Object.getPrototypeOf(store) as object,
        );
        for (const forbidden of [
          "database",
          "query",
          "exec",
          "prepare",
          "save",
          "append",
          "activate",
          "schedule",
        ]) {
          assertTrue(!publicKeys.includes(forbidden), `no ${forbidden}`);
        }
        store.close();
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
    `Event Contract Collection Runner SQLite tests passed: ${String(passed)}/${String(tests.length)}.`,
  );
}

main();
