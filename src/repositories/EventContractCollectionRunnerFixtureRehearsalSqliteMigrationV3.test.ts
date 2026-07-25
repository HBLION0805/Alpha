import {
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  EventContractCollectionRunnerSqliteStore,
  EventContractCollectionRunnerSqliteStoreError,
  EventContractCollectionRunnerSqliteStoreErrorCode,
} from "./EventContractCollectionRunnerSqliteStore";
import {
  COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_CHECKSUM,
  COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME,
  COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION,
  COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_TABLES,
  CollectionRunnerFixtureRehearsalSqliteProfileError,
  createNewCollectionRunnerFixtureRehearsalSqliteProfile,
  inspectCollectionRunnerFixtureRehearsalSqliteProfile,
} from "./EventContractCollectionRunnerFixtureRehearsalSqliteMigrationV3";
import {
  EventContractCollectionRunnerFixtureRehearsalSqliteStore,
} from "./EventContractCollectionRunnerFixtureRehearsalSqliteStore";

const BUILD = "fnv1a64:1111111111111111";
const AT = "2026-07-25T16:00:00.000Z";

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function withRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-rehearsal-v3-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function options(root: string) {
  return {
    rootDirectory: root,
    storeId: "fixture-rehearsal",
    applicationBuildFingerprint: BUILD,
    appliedAtUtc: AT,
  };
}

function expectProfileError(run: () => unknown, code: string): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof CollectionRunnerFixtureRehearsalSqliteProfileError,
      "typed profile error",
    );
    assertEqual(
      (error as CollectionRunnerFixtureRehearsalSqliteProfileError).code,
      code,
      "error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function raw(path: string, run: (database: DatabaseSync) => void): void {
  const database = new DatabaseSync(path);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    run(database);
  } finally {
    database.close();
  }
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["new isolated store receives exact v3 profile", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      assertEqual(result.schemaVersion, 3, "schema version");
      assertEqual(result.migrationName, COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME, "migration");
      assertEqual(result.migrationChecksum, COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_CHECKSUM, "checksum");
      assertTrue(Object.isFrozen(result), "readiness");
    })],
  ["fixture-profile store exposes existing runner and durable repositories", () =>
    withRoot((root) => {
      const store = EventContractCollectionRunnerFixtureRehearsalSqliteStore.open(
        options(root),
      );
      try {
        assertEqual(store.getReadiness().schemaVersion, 3, "schema version");
        assertEqual(
          store.createRunnerRepository().getRunnerDefinition("missing", "1.0"),
          null,
          "runner repository",
        );
        assertEqual(
          store.createDurableRehearsalRepository().readSnapshot("missing"),
          null,
          "durable repository",
        );
      } finally {
        store.close();
      }
    })],
  ["migration creates the exact strict table catalog", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) => {
        const rows = database.prepare(`
SELECT name, strict FROM pragma_table_list
WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`).all();
        assertEqual(rows.length, COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_TABLES.length, "count");
        assertEqual(rows.map(({ name }) => name).join(","), COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_TABLES.join(","), "tables");
        assertTrue(rows.every(({ strict }) => strict === 1), "strict");
      });
    })],
  ["migration history is exactly 001 through 003", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) => {
        const rows = database.prepare(
          "SELECT migration_version, migration_name FROM schema_migrations ORDER BY migration_version",
        ).all();
        assertEqual(rows.length, 3, "migration count");
        assertEqual(rows[2]?.migration_version, COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION, "version");
        assertEqual(rows[2]?.migration_name, COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME, "name");
        assertEqual(database.prepare("PRAGMA user_version").get()?.user_version, 3, "user version");
      });
    })],
  ["read-only profile inspection is deterministic", () =>
    withRoot((root) => {
      const created = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      const first = inspectCollectionRunnerFixtureRehearsalSqliteProfile({
        rootDirectory: root,
        storeId: "fixture-rehearsal",
      });
      const second = inspectCollectionRunnerFixtureRehearsalSqliteProfile({
        rootDirectory: root,
        storeId: "fixture-rehearsal",
      });
      assertEqual(first.fingerprint, second.fingerprint, "inspection");
      assertEqual(first.fingerprint, created.fingerprint, "creation");
    })],
  ["ordinary v2 store rejects the v3 profile as future schema", () =>
    withRoot((root) => {
      createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      try {
        EventContractCollectionRunnerSqliteStore.open({
          rootDirectory: root,
          storeId: "fixture-rehearsal",
          applicationBuildFingerprint: BUILD,
          appliedAtUtc: AT,
        });
      } catch (error) {
        assertTrue(error instanceof EventContractCollectionRunnerSqliteStoreError, "typed store");
        assertEqual(
          (error as EventContractCollectionRunnerSqliteStoreError).code,
          EventContractCollectionRunnerSqliteStoreErrorCode.FutureSchema,
          "future schema",
        );
        return;
      }
      throw new Error("Expected ordinary store to reject v3.");
    })],
  ["existing empty v2 store cannot be upgraded", () =>
    withRoot((root) => {
      EventContractCollectionRunnerSqliteStore.open({
        rootDirectory: root,
        storeId: "fixture-rehearsal",
        applicationBuildFingerprint: BUILD,
        appliedAtUtc: AT,
      }).close();
      expectProfileError(
        () => createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root)),
        "STORE_ALREADY_EXISTS",
      );
    })],
  ["existing unversioned database cannot be replaced", () =>
    withRoot((root) => {
      const path = join(root, "fixture-rehearsal.sqlite3");
      raw(path, (database) => database.exec("CREATE TABLE prior_data (value TEXT) STRICT"));
      expectProfileError(
        () => createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root)),
        "STORE_ALREADY_EXISTS",
      );
      raw(path, (database) =>
        assertTrue(
          database.prepare("SELECT 1 FROM prior_data").all().length === 0,
          "prior table preserved",
        ));
    })],
  ["invalid store identity fails before creation", () =>
    withRoot((root) =>
      expectProfileError(
        () => createNewCollectionRunnerFixtureRehearsalSqliteProfile({
          ...options(root),
          storeId: "../escape",
        }),
        "INVALID_CONFIGURATION",
      ))],
  ["missing inspection root is not created", () =>
    withRoot((root) => {
      const missing = join(root, "missing");
      expectProfileError(
        () => inspectCollectionRunnerFixtureRehearsalSqliteProfile({
          rootDirectory: missing,
          storeId: "fixture-rehearsal",
        }),
        "PROFILE_MISMATCH",
      );
      assertTrue(!existsSync(missing), "root absent");
    })],
  ["tampered migration checksum fails inspection", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) =>
        database.prepare(
          "UPDATE schema_migrations SET migration_checksum = ? WHERE migration_version = 3",
        ).run("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));
      expectProfileError(
        () => inspectCollectionRunnerFixtureRehearsalSqliteProfile({
          rootDirectory: root,
          storeId: "fixture-rehearsal",
        }),
        "PROFILE_MISMATCH",
      );
    })],
  ["migration build lineage must remain exact", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) =>
        database.prepare(
          "UPDATE schema_migrations SET application_build_fingerprint = ? WHERE migration_version = 1",
        ).run("fnv1a64:2222222222222222"));
      expectProfileError(
        () => inspectCollectionRunnerFixtureRehearsalSqliteProfile({
          rootDirectory: root,
          storeId: "fixture-rehearsal",
        }),
        "PROFILE_MISMATCH",
      );
    })],
  ["unexpected table fails exact inspection", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) =>
        database.exec("CREATE TABLE rogue_data (value TEXT) STRICT"));
      expectProfileError(
        () => inspectCollectionRunnerFixtureRehearsalSqliteProfile({
          rootDirectory: root,
          storeId: "fixture-rehearsal",
        }),
        "VERIFICATION_FAILED",
      );
    })],
  ["altered column fails schema checksum inspection", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) =>
        database.exec("ALTER TABLE fixture_rehearsals ADD COLUMN injected TEXT"));
      expectProfileError(
        () => inspectCollectionRunnerFixtureRehearsalSqliteProfile({
          rootDirectory: root,
          storeId: "fixture-rehearsal",
        }),
        "VERIFICATION_FAILED",
      );
    })],
  ["append-only transition triggers reject update and delete", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) => {
        const triggerNames = database.prepare(`
SELECT name FROM sqlite_schema
WHERE type = 'trigger' AND tbl_name = 'fixture_rehearsal_transitions'
ORDER BY name
`).all().map(({ name }) => name);
        assertEqual(triggerNames.length, 2, "trigger count");
        database.exec("PRAGMA foreign_keys = OFF");
        database.prepare(`
INSERT INTO fixture_rehearsals (
 rehearsal_id, manifest_fingerprint, schema_version, schema_profile,
 build_fingerprint, runner_fingerprint, frozen_plan_fingerprint,
 catalog_fingerprint, provider_fingerprint, mapping_fingerprint,
 activation_id, task_set_fingerprint, workspace_identity, store_identity,
 lifecycle_state, lifecycle_version, next_invocation_ordinal,
 recovery_fingerprint, maximum_invocations, scenario_result_fingerprint,
 execution_package_fingerprint, non_authority_declaration,
 canonical_record_json, record_fingerprint, created_at_utc
) VALUES (
 ?, ?, '1.0', 'FIXTURE_REHEARSAL_V3', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
 'PLANNED', 1, 1, ?, 3, NULL, NULL, 'FIXTURE_ONLY', '{}', ?, ?
)
`).run(
          "rehearsal-1", BUILD, BUILD, BUILD, BUILD, BUILD, BUILD, BUILD,
          "activation-1", BUILD, "workspace-1", "store-1", BUILD,
          "fnv1a64:2222222222222222", AT,
        );
        database.prepare(`
INSERT INTO fixture_rehearsal_transitions (
 transition_id, rehearsal_id, manifest_fingerprint, ordinal, from_state,
 to_state, from_version, to_version, reason_code, transition_fingerprint,
 occurred_at_utc, canonical_record_json
) VALUES (?, ?, ?, 0, 'PLANNED', 'PREPARING', 1, 2, ?, ?, ?, '{}')
`).run(
          "transition-1", "rehearsal-1", BUILD, "PREPARE",
          "fnv1a64:3333333333333333", AT,
        );
        let updateRejected = false;
        let deleteRejected = false;
        try {
          database.prepare(
            "UPDATE fixture_rehearsal_transitions SET reason_code = 'CHANGED' WHERE transition_id = 'transition-1'",
          ).run();
        } catch {
          updateRejected = true;
        }
        try {
          database.prepare(
            "DELETE FROM fixture_rehearsal_transitions WHERE transition_id = 'transition-1'",
          ).run();
        } catch {
          deleteRejected = true;
        }
        assertTrue(updateRejected, "update rejected");
        assertTrue(deleteRejected, "delete rejected");
      });
    })],
  ["foreign keys reject an orphan transition", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) => {
        let rejected = false;
        try {
          database.prepare(`
INSERT INTO fixture_rehearsal_transitions (
 transition_id, rehearsal_id, manifest_fingerprint, ordinal, from_state,
 to_state, from_version, to_version, reason_code, transition_fingerprint,
 occurred_at_utc, canonical_record_json
) VALUES (?, ?, ?, 0, 'PLANNED', 'PREPARING', 1, 2, ?, ?, ?, '{}')
`).run("transition-1", "missing", BUILD, "TEST", BUILD, AT);
        } catch {
          rejected = true;
        }
        assertTrue(rejected, "foreign key");
      });
    })],
  ["closed enums reject undeclared transition and failure values", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) => {
        database.exec("PRAGMA foreign_keys = OFF");
        let transitionRejected = false;
        let failureRejected = false;
        try {
          database.prepare(`
INSERT INTO fixture_rehearsal_transitions (
 transition_id, rehearsal_id, manifest_fingerprint, ordinal, from_state,
 to_state, from_version, to_version, reason_code, transition_fingerprint,
 occurred_at_utc, canonical_record_json
) VALUES (?, ?, ?, 0, 'INJECTED', 'PREPARING', 1, 2, ?, ?, ?, '{}')
`).run("transition-1", "missing", BUILD, "TEST", BUILD, AT);
        } catch {
          transitionRejected = true;
        }
        try {
          database.prepare(`
INSERT INTO fixture_rehearsal_failure_receipts (
 failure_id, claim_id, rehearsal_id, manifest_fingerprint, phase,
 disposition, reason_code, terminal_report_fingerprint,
 observed_recovery_fingerprint, failure_fingerprint, occurred_at_utc,
 canonical_record_json
) VALUES (?, ?, ?, ?, 'INJECTED', 'FAILED_CLOSED', ?, NULL, ?, ?, ?, '{}')
`).run("failure-1", "claim-1", "missing", BUILD, "TEST", BUILD, BUILD, AT);
        } catch {
          failureRejected = true;
        }
        assertTrue(transitionRejected, "transition state rejected");
        assertTrue(failureRejected, "failure phase rejected");
      });
    })],
  ["fingerprint checks reject malformed registry evidence", () =>
    withRoot((root) => {
      const result = createNewCollectionRunnerFixtureRehearsalSqliteProfile(options(root));
      raw(result.storePath, (database) => {
        let rejected = false;
        try {
          database.prepare(`
INSERT INTO fixture_rehearsal_evidence_plans (
 evidence_plan_id, rehearsal_id, manifest_fingerprint,
 validation_receipt_fingerprint, validation_suite_fingerprint,
 planned_backup_id, planned_package_id, planned_envelope_id,
 retention_policy_version, terminal_freeze_fingerprint,
 non_authority_declaration, evidence_plan_fingerprint, frozen_at_utc,
 canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}')
`).run(
            "plan-1", "missing", "bad", BUILD, BUILD, "backup-1", "package-1",
            "envelope-1", "1.0", BUILD, "FIXTURE_ONLY", BUILD, AT,
          );
        } catch {
          rejected = true;
        }
        assertTrue(rejected, "fingerprint rejected");
      });
    })],
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
console.log(`Fixture Rehearsal SQLite migration v3: ${passed}/${tests.length} passed.`);
