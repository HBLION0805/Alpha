import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE,
} from "../contracts";
import {
  COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM,
  COLLECTION_RUNNER_SQLITE_MIGRATION_V2_CHECKSUM,
  EventContractCollectionRunnerSqliteStore,
} from "./EventContractCollectionRunnerSqliteStore";
import {
  COLLECTION_RUNNER_SQLITE_MIGRATION_NAME as COLLECTION_RUNNER_SQLITE_MIGRATION_V1_NAME,
  COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL,
  COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION as COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_V1,
  COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION as COLLECTION_RUNNER_SQLITE_SCHEMA_V1,
} from "./EventContractCollectionRunnerSqliteMigrationV1";
import {
  COLLECTION_RUNNER_SQLITE_MIGRATION_V2_NAME,
  COLLECTION_RUNNER_SQLITE_MIGRATION_V2_SQL,
  COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION as COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_V2,
  COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION as COLLECTION_RUNNER_SQLITE_SCHEMA_V2,
  COLLECTION_RUNNER_SQLITE_TABLES as COLLECTION_RUNNER_SQLITE_TABLES_V2,
} from "./EventContractCollectionRunnerRecoveryControlSqliteMigrationV2";

export const COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION =
  3 as const;
export const COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_CONTRACT_VERSION =
  "3.0" as const;
export const COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME =
  "003_collection_runner_fixture_rehearsal" as const;

const STORE_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const BUILD_FP = /^fnv1a64:[0-9a-f]{16}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const FP = (column: string): string => `
  CHECK (
    (
      length(${column}) = 24
      AND substr(${column}, 1, 8) = 'fnv1a64:'
      AND substr(${column}, 9) NOT GLOB '*[^0-9a-f]*'
    )
    OR (
      length(${column}) = 71
      AND substr(${column}, 1, 7) = 'sha256:'
      AND substr(${column}, 8) NOT GLOB '*[^0-9a-f]*'
    )
  )`;

export const COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_SQL = `
CREATE TABLE fixture_rehearsals (
  rehearsal_id TEXT PRIMARY KEY,
  manifest_fingerprint TEXT NOT NULL UNIQUE ${FP("manifest_fingerprint")},
  schema_version TEXT NOT NULL CHECK (schema_version = '1.0'),
  schema_profile TEXT NOT NULL CHECK (schema_profile = 'FIXTURE_REHEARSAL_V3'),
  build_fingerprint TEXT NOT NULL ${FP("build_fingerprint")},
  runner_fingerprint TEXT NOT NULL ${FP("runner_fingerprint")},
  frozen_plan_fingerprint TEXT NOT NULL ${FP("frozen_plan_fingerprint")},
  catalog_fingerprint TEXT NOT NULL ${FP("catalog_fingerprint")},
  provider_fingerprint TEXT NOT NULL ${FP("provider_fingerprint")},
  mapping_fingerprint TEXT NOT NULL ${FP("mapping_fingerprint")},
  activation_id TEXT NOT NULL UNIQUE,
  task_set_fingerprint TEXT NOT NULL ${FP("task_set_fingerprint")},
  workspace_identity TEXT NOT NULL,
  store_identity TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL CHECK (
    lifecycle_state IN (
      'PLANNED', 'PREPARING', 'PREPARED', 'READY', 'STEPPING',
      'COMPLETED', 'VALIDATED', 'EVIDENCE_FROZEN',
      'PREPARATION_BLOCKED', 'FAILED_CLOSED', 'RECOVERY_REQUIRED',
      'VERIFICATION_FAILED', 'INCOMPLETE'
    )
  ),
  lifecycle_version INTEGER NOT NULL CHECK (lifecycle_version > 0),
  next_invocation_ordinal INTEGER NOT NULL CHECK (next_invocation_ordinal > 0),
  recovery_fingerprint TEXT NOT NULL ${FP("recovery_fingerprint")},
  maximum_invocations INTEGER NOT NULL
    CHECK (maximum_invocations BETWEEN 1 AND 16),
  scenario_result_fingerprint TEXT ${FP("scenario_result_fingerprint")},
  execution_package_fingerprint TEXT ${FP("execution_package_fingerprint")},
  non_authority_declaration TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  record_fingerprint TEXT NOT NULL UNIQUE ${FP("record_fingerprint")},
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (next_invocation_ordinal <= maximum_invocations + 1)
) STRICT;

CREATE TABLE fixture_rehearsal_transitions (
  transition_id TEXT PRIMARY KEY,
  rehearsal_id TEXT NOT NULL,
  manifest_fingerprint TEXT NOT NULL ${FP("manifest_fingerprint")},
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  from_state TEXT NOT NULL CHECK (
    from_state IN (
      'PLANNED', 'PREPARING', 'PREPARED', 'READY', 'STEPPING',
      'COMPLETED', 'VALIDATED', 'EVIDENCE_FROZEN',
      'PREPARATION_BLOCKED', 'FAILED_CLOSED', 'RECOVERY_REQUIRED',
      'VERIFICATION_FAILED', 'INCOMPLETE'
    )
  ),
  to_state TEXT NOT NULL CHECK (
    to_state IN (
      'PLANNED', 'PREPARING', 'PREPARED', 'READY', 'STEPPING',
      'COMPLETED', 'VALIDATED', 'EVIDENCE_FROZEN',
      'PREPARATION_BLOCKED', 'FAILED_CLOSED', 'RECOVERY_REQUIRED',
      'VERIFICATION_FAILED', 'INCOMPLETE'
    )
  ),
  from_version INTEGER NOT NULL CHECK (from_version > 0),
  to_version INTEGER NOT NULL CHECK (to_version = from_version + 1),
  reason_code TEXT NOT NULL,
  transition_fingerprint TEXT NOT NULL UNIQUE ${FP("transition_fingerprint")},
  occurred_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  FOREIGN KEY (rehearsal_id) REFERENCES fixture_rehearsals (rehearsal_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (rehearsal_id, to_version)
) STRICT;

CREATE TABLE fixture_rehearsal_operation_claims (
  claim_id TEXT PRIMARY KEY,
  rehearsal_id TEXT NOT NULL,
  manifest_fingerprint TEXT NOT NULL ${FP("manifest_fingerprint")},
  phase TEXT NOT NULL CHECK (
    phase IN (
      'PREPARE', 'STEP', 'RECOVER', 'VALIDATE',
      'FREEZE', 'PACKAGE', 'VERIFY', 'ARCHIVE_INVENTORY'
    )
  ),
  invocation_ordinal INTEGER CHECK (invocation_ordinal > 0),
  expected_lifecycle_version INTEGER NOT NULL
    CHECK (expected_lifecycle_version > 0),
  expected_recovery_fingerprint TEXT NOT NULL
    ${FP("expected_recovery_fingerprint")},
  request_fingerprint TEXT NOT NULL UNIQUE ${FP("request_fingerprint")},
  process_session_id TEXT NOT NULL,
  boot_identity TEXT NOT NULL,
  owner_authorization_id TEXT,
  claim_fingerprint TEXT NOT NULL UNIQUE ${FP("claim_fingerprint")},
  claimed_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  FOREIGN KEY (rehearsal_id) REFERENCES fixture_rehearsals (rehearsal_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (rehearsal_id, expected_lifecycle_version),
  CHECK ((phase = 'STEP') = (invocation_ordinal IS NOT NULL)),
  CHECK ((phase = 'RECOVER') = (owner_authorization_id IS NOT NULL))
) STRICT;

CREATE TABLE fixture_rehearsal_invocation_receipts (
  receipt_id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE,
  rehearsal_id TEXT NOT NULL,
  manifest_fingerprint TEXT NOT NULL ${FP("manifest_fingerprint")},
  invocation_ordinal INTEGER NOT NULL CHECK (invocation_ordinal > 0),
  selected_action TEXT NOT NULL CHECK (
    selected_action IN (
      'FAIL_CLOSED', 'TRIP_EMERGENCY_STOP', 'REQUEST_GRACEFUL_COMPLETION',
      'TRANSITION_EXACT_TASK_DUE', 'MARK_EXACT_TASK_MISSED',
      'EXECUTE_EXACT_FIXTURE_TASK', 'WAIT_AND_EXIT', 'COMPLETE_AND_EXIT'
    )
  ),
  resulting_pilot_state TEXT NOT NULL CHECK (
    resulting_pilot_state IN (
      'DRAFT', 'OWNER_APPROVED', 'ACTIVE', 'STOP_REQUESTED',
      'STOPPED', 'REVOKED', 'COMPLETED', 'FAILED_CLOSED'
    )
  ),
  resulting_task_state TEXT NOT NULL CHECK (
    resulting_task_state IN (
      'SCHEDULED', 'BLOCKED', 'DUE', 'LEASED', 'IN_FLIGHT',
      'VALIDATING', 'RETRY_WAIT', 'COMMITTED', 'MISSED',
      'TERMINAL_FAILED', 'CANCELLED'
    )
  ),
  outcome TEXT NOT NULL CHECK (
    outcome IN (
      'COMPLETED', 'NO_WORK', 'STOPPED', 'BLOCKED',
      'FAILED_CLOSED', 'AMBIGUOUS'
    )
  ),
  terminal_report_fingerprint TEXT NOT NULL ${FP("terminal_report_fingerprint")},
  durable_transition_fingerprint TEXT ${FP("durable_transition_fingerprint")},
  outbox_chronology_fingerprint TEXT NOT NULL ${FP("outbox_chronology_fingerprint")},
  recovery_fingerprint TEXT NOT NULL ${FP("recovery_fingerprint")},
  receipt_fingerprint TEXT NOT NULL UNIQUE ${FP("receipt_fingerprint")},
  observed_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  FOREIGN KEY (claim_id) REFERENCES fixture_rehearsal_operation_claims (claim_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (rehearsal_id) REFERENCES fixture_rehearsals (rehearsal_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (rehearsal_id, invocation_ordinal)
) STRICT;

CREATE TABLE fixture_rehearsal_failure_receipts (
  failure_id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL UNIQUE,
  rehearsal_id TEXT NOT NULL,
  manifest_fingerprint TEXT NOT NULL ${FP("manifest_fingerprint")},
  phase TEXT NOT NULL CHECK (
    phase IN (
      'PREPARE', 'STEP', 'RECOVER', 'VALIDATE',
      'FREEZE', 'PACKAGE', 'VERIFY', 'ARCHIVE_INVENTORY'
    )
  ),
  disposition TEXT NOT NULL CHECK (
    disposition IN (
      'PREPARATION_BLOCKED', 'FAILED_CLOSED', 'RECOVERY_REQUIRED',
      'VERIFICATION_FAILED', 'INCOMPLETE'
    )
  ),
  reason_code TEXT NOT NULL,
  terminal_report_fingerprint TEXT ${FP("terminal_report_fingerprint")},
  observed_recovery_fingerprint TEXT NOT NULL
    ${FP("observed_recovery_fingerprint")},
  failure_fingerprint TEXT NOT NULL UNIQUE ${FP("failure_fingerprint")},
  occurred_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  FOREIGN KEY (claim_id) REFERENCES fixture_rehearsal_operation_claims (claim_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (rehearsal_id) REFERENCES fixture_rehearsals (rehearsal_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE fixture_rehearsal_evidence_plans (
  evidence_plan_id TEXT PRIMARY KEY,
  rehearsal_id TEXT NOT NULL UNIQUE,
  manifest_fingerprint TEXT NOT NULL ${FP("manifest_fingerprint")},
  validation_receipt_fingerprint TEXT NOT NULL
    ${FP("validation_receipt_fingerprint")},
  validation_suite_fingerprint TEXT NOT NULL ${FP("validation_suite_fingerprint")},
  planned_backup_id TEXT NOT NULL UNIQUE,
  planned_package_id TEXT NOT NULL UNIQUE,
  planned_envelope_id TEXT NOT NULL UNIQUE,
  retention_policy_version TEXT NOT NULL,
  terminal_freeze_fingerprint TEXT NOT NULL ${FP("terminal_freeze_fingerprint")},
  non_authority_declaration TEXT NOT NULL,
  evidence_plan_fingerprint TEXT NOT NULL UNIQUE ${FP("evidence_plan_fingerprint")},
  frozen_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  FOREIGN KEY (rehearsal_id) REFERENCES fixture_rehearsals (rehearsal_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE INDEX fixture_rehearsal_transition_order
ON fixture_rehearsal_transitions (rehearsal_id, to_version);

CREATE INDEX fixture_rehearsal_claim_order
ON fixture_rehearsal_operation_claims (
  rehearsal_id, expected_lifecycle_version, claim_id
);

CREATE TRIGGER fixture_rehearsal_transitions_no_update
BEFORE UPDATE ON fixture_rehearsal_transitions
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal transitions'); END;
CREATE TRIGGER fixture_rehearsal_transitions_no_delete
BEFORE DELETE ON fixture_rehearsal_transitions
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal transitions'); END;
CREATE TRIGGER fixture_rehearsal_claims_no_update
BEFORE UPDATE ON fixture_rehearsal_operation_claims
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal claims'); END;
CREATE TRIGGER fixture_rehearsal_claims_no_delete
BEFORE DELETE ON fixture_rehearsal_operation_claims
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal claims'); END;
CREATE TRIGGER fixture_rehearsal_invocations_no_update
BEFORE UPDATE ON fixture_rehearsal_invocation_receipts
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal invocation receipts'); END;
CREATE TRIGGER fixture_rehearsal_invocations_no_delete
BEFORE DELETE ON fixture_rehearsal_invocation_receipts
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal invocation receipts'); END;
CREATE TRIGGER fixture_rehearsal_failures_no_update
BEFORE UPDATE ON fixture_rehearsal_failure_receipts
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal failure receipts'); END;
CREATE TRIGGER fixture_rehearsal_failures_no_delete
BEFORE DELETE ON fixture_rehearsal_failure_receipts
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal failure receipts'); END;
CREATE TRIGGER fixture_rehearsal_evidence_no_update
BEFORE UPDATE ON fixture_rehearsal_evidence_plans
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal evidence plans'); END;
CREATE TRIGGER fixture_rehearsal_evidence_no_delete
BEFORE DELETE ON fixture_rehearsal_evidence_plans
BEGIN SELECT RAISE(ABORT, 'append-only rehearsal evidence plans'); END;
`;

export const COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_TABLES =
  Object.freeze([
    ...COLLECTION_RUNNER_SQLITE_TABLES_V2,
    "fixture_rehearsal_evidence_plans",
    "fixture_rehearsal_failure_receipts",
    "fixture_rehearsal_invocation_receipts",
    "fixture_rehearsal_operation_claims",
    "fixture_rehearsal_transitions",
    "fixture_rehearsals",
  ].sort());

export const COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_CHECKSUM =
  `sha256:${createHash("sha256")
    .update(COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_SQL, "utf8")
    .digest("hex")}`;

export interface CreateCollectionRunnerFixtureRehearsalSqliteProfileOptions {
  readonly rootDirectory: string;
  readonly storeId: string;
  readonly applicationBuildFingerprint: string;
  readonly appliedAtUtc: string;
}

export interface CollectionRunnerFixtureRehearsalSqliteProfileReadiness {
  readonly schemaProfile:
    typeof COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE;
  readonly storePath: string;
  readonly schemaVersion:
    typeof COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION;
  readonly schemaContractVersion:
    typeof COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_CONTRACT_VERSION;
  readonly migrationName:
    typeof COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME;
  readonly migrationChecksum: string;
  readonly schemaCatalogChecksum: string;
  readonly quickCheckPassed: true;
  readonly foreignKeyCheckPassed: true;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export class CollectionRunnerFixtureRehearsalSqliteProfileError extends Error {
  public constructor(
    public readonly code:
      | "INVALID_CONFIGURATION"
      | "STORE_ALREADY_EXISTS"
      | "PROFILE_MISMATCH"
      | "MIGRATION_FAILED"
      | "VERIFICATION_FAILED",
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerFixtureRehearsalSqliteProfileError";
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function sha(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value), "utf8").digest("hex")}`;
}

function freeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function assertOptions(
  options: CreateCollectionRunnerFixtureRehearsalSqliteProfileOptions,
  createRoot: boolean,
): string {
  const actual = Object.keys(options).sort();
  const expected = [
    "applicationBuildFingerprint", "appliedAtUtc", "rootDirectory", "storeId",
  ].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index]) ||
    options.rootDirectory.trim() === "" ||
    !STORE_ID.test(options.storeId) ||
    !BUILD_FP.test(options.applicationBuildFingerprint) ||
    !UTC.test(options.appliedAtUtc) ||
    new Date(options.appliedAtUtc).toISOString() !== options.appliedAtUtc
  ) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "INVALID_CONFIGURATION",
      "Fixture rehearsal SQLite profile configuration is invalid.",
    );
  }
  if (!existsSync(options.rootDirectory)) {
    if (!createRoot) {
      throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
        "PROFILE_MISMATCH",
        "Fixture rehearsal SQLite profile root is missing.",
      );
    }
    mkdirSync(options.rootDirectory, { recursive: true });
  }
  const rootEntry = lstatSync(options.rootDirectory);
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "INVALID_CONFIGURATION",
      "Fixture rehearsal SQLite profile root must be a real directory.",
    );
  }
  const root = realpathSync(options.rootDirectory);
  if (root.startsWith("\\\\")) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "INVALID_CONFIGURATION",
      "Fixture rehearsal SQLite profile cannot use a UNC root.",
    );
  }
  const path = resolve(root, `${options.storeId}.sqlite3`);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "INVALID_CONFIGURATION",
      "Fixture rehearsal SQLite profile path escapes its root.",
    );
  }
  return path;
}

function userTables(database: DatabaseSync): readonly string[] {
  return (database.prepare(`
SELECT name FROM sqlite_schema
WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`).all() as unknown as ReadonlyArray<{ readonly name: unknown }>)
    .map(({ name }) => String(name));
}

function schemaCatalog(database: DatabaseSync): readonly unknown[] {
  return database.prepare(`
SELECT type, name, tbl_name AS table_name, sql
FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
ORDER BY type, name
`).all();
}

function schemaCatalogChecksum(database: DatabaseSync): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(schemaCatalog(database)), "utf8")
    .digest("hex")}`;
}

function expectedCatalogChecksum(): string {
  const database = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    defensive: true,
  });
  try {
    database.exec(COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL);
    database.exec(COLLECTION_RUNNER_SQLITE_MIGRATION_V2_SQL);
    database.exec(COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_SQL);
    return schemaCatalogChecksum(database);
  } finally {
    database.close();
  }
}

const EXPECTED_CATALOG_CHECKSUM = expectedCatalogChecksum();

function verifyProfile(
  database: DatabaseSync,
  storePath: string,
): CollectionRunnerFixtureRehearsalSqliteProfileReadiness {
  const migrations = database.prepare(`
SELECT migration_version, migration_name, migration_checksum,
       application_build_fingerprint, schema_contract_version
FROM schema_migrations
ORDER BY migration_version
`).all() as ReadonlyArray<Record<string, unknown>>;
  const third = migrations[2];
  const buildFingerprints = migrations.map(
    (migration) => migration.application_build_fingerprint,
  );
  const userVersion = Object.values(
    database.prepare("PRAGMA user_version").get() ?? {},
  )[0];
  if (
    migrations.length !== 3 ||
    migrations[0]?.migration_version !== COLLECTION_RUNNER_SQLITE_SCHEMA_V1 ||
    migrations[0]?.migration_name !== COLLECTION_RUNNER_SQLITE_MIGRATION_V1_NAME ||
    migrations[0]?.migration_checksum !== COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM ||
    migrations[0]?.schema_contract_version !== COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_V1 ||
    migrations[1]?.migration_version !== COLLECTION_RUNNER_SQLITE_SCHEMA_V2 ||
    migrations[1]?.migration_name !== COLLECTION_RUNNER_SQLITE_MIGRATION_V2_NAME ||
    migrations[1]?.migration_checksum !== COLLECTION_RUNNER_SQLITE_MIGRATION_V2_CHECKSUM ||
    migrations[1]?.schema_contract_version !== COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_V2 ||
    third?.migration_version !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION ||
    third.migration_name !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME ||
    third.migration_checksum !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_CHECKSUM ||
    third.schema_contract_version !==
      COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_CONTRACT_VERSION ||
    buildFingerprints.some(
      (build) => typeof build !== "string" || !BUILD_FP.test(build),
    ) ||
    new Set(buildFingerprints).size !== 1 ||
    userVersion !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION
  ) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "PROFILE_MISMATCH",
      "Fixture rehearsal SQLite migration history is missing, altered, or unsupported.",
    );
  }
  const tables = userTables(database);
  if (
    tables.length !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_TABLES.length ||
    tables.some(
      (table, index) =>
        table !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_TABLES[index],
    )
  ) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "VERIFICATION_FAILED",
      "Fixture rehearsal SQLite table catalog is not exact.",
    );
  }
  const strict = database.prepare(`
SELECT name, strict FROM pragma_table_list
WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`).all() as ReadonlyArray<Record<string, unknown>>;
  if (
    strict.length !== tables.length ||
    strict.some((row, index) => row.name !== tables[index] || row.strict !== 1)
  ) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "VERIFICATION_FAILED",
      "Every fixture rehearsal SQLite table must use STRICT typing.",
    );
  }
  const quick = database.prepare("PRAGMA quick_check").all();
  const foreignKeysEnabled = Object.values(
    database.prepare("PRAGMA foreign_keys").get() ?? {},
  )[0];
  if (
    quick.length !== 1 ||
    Object.values(quick[0] ?? {})[0] !== "ok" ||
    foreignKeysEnabled !== 1 ||
    database.prepare("PRAGMA foreign_key_check").all().length !== 0
  ) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "VERIFICATION_FAILED",
      "Fixture rehearsal SQLite integrity verification failed.",
    );
  }
  const catalog = schemaCatalogChecksum(database);
  if (catalog !== EXPECTED_CATALOG_CHECKSUM) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "VERIFICATION_FAILED",
      "Fixture rehearsal SQLite schema catalog differs from migrations 001-003.",
    );
  }
  const body = {
    schemaProfile: COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE,
    storePath,
    schemaVersion: COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION,
    schemaContractVersion:
      COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_CONTRACT_VERSION,
    migrationName:
      COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME,
    migrationChecksum:
      COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_CHECKSUM,
    schemaCatalogChecksum: catalog,
    quickCheckPassed: true as const,
    foreignKeyCheckPassed: true as const,
    deterministic: true as const,
  };
  return freeze({ ...body, fingerprint: sha(body) });
}

export function createNewCollectionRunnerFixtureRehearsalSqliteProfile(
  options: CreateCollectionRunnerFixtureRehearsalSqliteProfileOptions,
): CollectionRunnerFixtureRehearsalSqliteProfileReadiness {
  const path = assertOptions(options, true);
  if (
    existsSync(path) ||
    existsSync(`${path}-wal`) ||
    existsSync(`${path}-shm`)
  ) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "STORE_ALREADY_EXISTS",
      "Fixture rehearsal profile may be created only for a new store.",
    );
  }
  const base = EventContractCollectionRunnerSqliteStore.open(options);
  base.close();
  const database = new DatabaseSync(path, {
    open: true,
    readOnly: false,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    timeout: 5000,
    defensive: true,
  });
  try {
    database.exec(`
PRAGMA foreign_keys = ON;
PRAGMA trusted_schema = OFF;
PRAGMA recursive_triggers = OFF;
`);
    if (
      Object.values(database.prepare("PRAGMA user_version").get() ?? {})[0] !==
        COLLECTION_RUNNER_SQLITE_SCHEMA_V2 ||
      userTables(database).some((table) =>
        !COLLECTION_RUNNER_SQLITE_TABLES_V2.includes(
          table as (typeof COLLECTION_RUNNER_SQLITE_TABLES_V2)[number],
        ))
    ) {
      throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
        "PROFILE_MISMATCH",
        "Migration 003 requires the exact newly created empty v2 foundation.",
      );
    }
    for (const table of COLLECTION_RUNNER_SQLITE_TABLES_V2) {
      if (table === "schema_migrations") continue;
      const count = database
        .prepare(`SELECT count(*) AS count FROM ${table}`)
        .get() as { readonly count?: unknown } | undefined;
      if (count?.count !== 0) {
        throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
          "PROFILE_MISMATCH",
          "Migration 003 cannot upgrade a populated runner store.",
        );
      }
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_SQL);
      database.prepare(`
INSERT INTO schema_migrations (
  migration_version, migration_name, migration_checksum, applied_at_utc,
  application_build_fingerprint, schema_contract_version
) VALUES (?, ?, ?, ?, ?, ?)
`).run(
        COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION,
        COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_NAME,
        COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_MIGRATION_V3_CHECKSUM,
        options.appliedAtUtc,
        options.applicationBuildFingerprint,
        COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_CONTRACT_VERSION,
      );
      database.exec(
        `PRAGMA user_version = ${COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_VERSION}`,
      );
      database.exec("COMMIT");
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Preserve the original migration failure.
      }
      throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
        "MIGRATION_FAILED",
        "Fixture rehearsal SQLite migration 003 failed and rolled back.",
        { cause: error },
      );
    }
    return verifyProfile(database, path);
  } finally {
    database.close();
  }
}

export function inspectCollectionRunnerFixtureRehearsalSqliteProfile(
  options: Pick<
    CreateCollectionRunnerFixtureRehearsalSqliteProfileOptions,
    "rootDirectory" | "storeId"
  >,
): CollectionRunnerFixtureRehearsalSqliteProfileReadiness {
  const path = assertOptions({
    ...options,
    applicationBuildFingerprint: "fnv1a64:0000000000000000",
    appliedAtUtc: "1970-01-01T00:00:00.000Z",
  }, false);
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) {
    throw new CollectionRunnerFixtureRehearsalSqliteProfileError(
      "PROFILE_MISMATCH",
      "Fixture rehearsal SQLite profile store is missing or unsafe.",
    );
  }
  const database = new DatabaseSync(path, {
    open: true,
    readOnly: true,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    timeout: 5000,
    defensive: true,
  });
  try {
    database.exec("PRAGMA trusted_schema = OFF");
    return verifyProfile(database, path);
  } finally {
    database.close();
  }
}
