import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
} from "node:fs";
import { basename, resolve, sep } from "node:path";
import { versions } from "node:process";
import { backup, DatabaseSync } from "node:sqlite";

import {
  COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL,
  COLLECTION_RUNNER_SQLITE_MIGRATION_NAME as COLLECTION_RUNNER_SQLITE_MIGRATION_V1_NAME,
  COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION as COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_V1,
  COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION as COLLECTION_RUNNER_SQLITE_SCHEMA_V1,
} from "./EventContractCollectionRunnerSqliteMigrationV1";
import {
  COLLECTION_RUNNER_SQLITE_MIGRATION_V2_NAME,
  COLLECTION_RUNNER_SQLITE_MIGRATION_V2_SQL,
  COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION,
  COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
  COLLECTION_RUNNER_SQLITE_TABLES,
} from "./EventContractCollectionRunnerRecoveryControlSqliteMigrationV2";
import type { EventContractCollectionRunnerRepository } from "./EventContractCollectionRunnerRepository";
import type { EventContractCollectionRunnerRecoveryControlRepository } from "./EventContractCollectionRunnerRecoveryControlRepository";
import { createSqliteEventContractCollectionRunnerRepository } from "./SqliteEventContractCollectionRunnerRepository";
import { createSqliteEventContractCollectionRunnerRecoveryControlRepository } from "./SqliteEventContractCollectionRunnerRecoveryControlRepository";
import {
  CollectionRunnerProcessStopBarrier,
  SessionGatedEventContractCollectionRunnerRepository,
  type CollectionRunnerProcessSessionIdentity,
} from "./SessionGatedEventContractCollectionRunnerRepository";
import {
  EventContractCollectionRunnerSqliteRecoveryManager,
  inspectCollectionRunnerStartupRecovery,
  type CollectionRunnerStartupRecoveryReport,
} from "./EventContractCollectionRunnerSqliteRecovery";

const MINIMUM_NODE_VERSION = Object.freeze([24, 12, 0] as const);
const STORE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const UTC_MILLISECOND_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const BUILD_FINGERPRINT_PATTERN = /^fnv1a64:[0-9a-f]{16}$/u;

export const COLLECTION_RUNNER_SQLITE_DEPENDENCY_DECISION = Object.freeze({
  binding: "node:sqlite",
  dependencyKind: "NODE_STANDARD_LIBRARY",
  minimumNodeVersion: "24.12.0",
  thirdPartyPackage: null,
  productionApproved: false,
  scope: "LOCAL_RESEARCH_PILOT",
} as const);

export enum EventContractCollectionRunnerSqliteStoreErrorCode {
  UnsupportedRuntime = "UNSUPPORTED_RUNTIME",
  InvalidConfiguration = "INVALID_CONFIGURATION",
  InvalidPath = "INVALID_PATH",
  UnsafeFilesystemEntry = "UNSAFE_FILESYSTEM_ENTRY",
  OpenFailed = "OPEN_FAILED",
  PragmaMismatch = "PRAGMA_MISMATCH",
  UnsupportedSqlite = "UNSUPPORTED_SQLITE",
  IntegrityFailed = "INTEGRITY_FAILED",
  MigrationConflict = "MIGRATION_CONFLICT",
  FutureSchema = "FUTURE_SCHEMA",
  SchemaMismatch = "SCHEMA_MISMATCH",
}

export class EventContractCollectionRunnerSqliteStoreError extends Error {
  public constructor(
    public readonly code: EventContractCollectionRunnerSqliteStoreErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "EventContractCollectionRunnerSqliteStoreError";
  }
}

export interface OpenEventContractCollectionRunnerSqliteStoreOptions {
  readonly rootDirectory: string;
  readonly storeId?: string;
  readonly applicationBuildFingerprint: string;
  readonly appliedAtUtc: string;
  readonly recoveryInspectedAtUtc?: string;
}

export interface EventContractCollectionRunnerSqliteReadiness {
  readonly binding: "node:sqlite";
  readonly dependencyKind: "NODE_STANDARD_LIBRARY";
  readonly thirdPartyPackage: null;
  readonly scope: "LOCAL_RESEARCH_PILOT";
  readonly productionApproved: false;
  readonly nodeVersion: string;
  readonly sqliteVersion: string;
  readonly schemaVersion: 2;
  readonly schemaContractVersion: "2.0";
  readonly migrationName: "002_collection_runner_recovery_control";
  readonly migrationChecksum: string;
  readonly schemaCatalogChecksum: string;
  readonly journalMode: "wal";
  readonly synchronous: 2;
  readonly foreignKeys: 1;
  readonly busyTimeoutMilliseconds: 5000;
  readonly trustedSchema: 0;
  readonly recursiveTriggers: 0;
  readonly tempStore: 2;
  readonly defensive: true;
  readonly onlineBackupAvailable: true;
  readonly walCheckpointAvailable: true;
}

interface SqliteVersionRow {
  readonly sqlite_version: unknown;
}

interface PragmaValueRow {
  readonly value: unknown;
}

interface MigrationRow {
  readonly migration_version: unknown;
  readonly migration_name: unknown;
  readonly migration_checksum: unknown;
  readonly application_build_fingerprint: unknown;
  readonly schema_contract_version: unknown;
}

function parseVersion(value: string): readonly number[] {
  return value.split(".").map((part) => Number.parseInt(part, 10));
}

function isAtLeastVersion(
  actual: readonly number[],
  minimum: readonly number[],
): boolean {
  const length = Math.max(actual.length, minimum.length);
  for (let index = 0; index < length; index += 1) {
    const actualPart = actual[index] ?? 0;
    const minimumPart = minimum[index] ?? 0;
    if (actualPart > minimumPart) return true;
    if (actualPart < minimumPart) return false;
  }
  return true;
}

function migrationV1Checksum(): string {
  return `sha256:${createHash("sha256")
    .update(COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL, "utf8")
    .digest("hex")}`;
}

export const COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM =
  migrationV1Checksum();

export const COLLECTION_RUNNER_SQLITE_MIGRATION_V2_CHECKSUM =
  `sha256:${createHash("sha256")
    .update(COLLECTION_RUNNER_SQLITE_MIGRATION_V2_SQL, "utf8")
    .digest("hex")}`;

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function assertConfiguration(
  options: OpenEventContractCollectionRunnerSqliteStoreOptions,
): string {
  if (
    typeof options.rootDirectory !== "string" ||
    options.rootDirectory.trim() === ""
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.InvalidConfiguration,
      "SQLite runtime root must be a non-empty path.",
    );
  }
  const storeId = options.storeId ?? "collection-runner";
  if (!STORE_ID_PATTERN.test(storeId)) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.InvalidConfiguration,
      "SQLite store ID must be a lowercase, traversal-free identifier.",
    );
  }
  if (!BUILD_FINGERPRINT_PATTERN.test(options.applicationBuildFingerprint)) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.InvalidConfiguration,
      "Application build fingerprint must use canonical fnv1a64 form.",
    );
  }
  const appliedAt = new Date(options.appliedAtUtc);
  if (
    !UTC_MILLISECOND_PATTERN.test(options.appliedAtUtc) ||
    !Number.isFinite(appliedAt.getTime()) ||
    appliedAt.toISOString() !== options.appliedAtUtc
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.InvalidConfiguration,
      "Migration time must be a real canonical millisecond UTC timestamp.",
    );
  }
  return storeId;
}

function assertRuntime(): void {
  if (!isAtLeastVersion(parseVersion(versions.node), MINIMUM_NODE_VERSION)) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.UnsupportedRuntime,
      `node:sqlite foundation requires Node >= ${MINIMUM_NODE_VERSION.join(".")}.`,
    );
  }
}

function resolveSafeStorePath(rootDirectory: string, storeId: string): string {
  mkdirSync(rootDirectory, { recursive: true });
  const canonicalRoot = realpathSync(rootDirectory);
  if (canonicalRoot.startsWith("\\\\")) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.InvalidPath,
      "SQLite collection-runner stores may not use a UNC network path.",
    );
  }
  const storePath = resolve(canonicalRoot, `${storeId}.sqlite3`);
  if (!storePath.startsWith(`${canonicalRoot}${sep}`)) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.InvalidPath,
      "Resolved SQLite store path escapes its approved runtime root.",
    );
  }
  for (const path of [storePath, `${storePath}-wal`, `${storePath}-shm`]) {
    if (!existsSync(path)) continue;
    const entry = lstatSync(path);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.UnsafeFilesystemEntry,
        "SQLite store and sidecar paths must be regular non-symbolic-link files.",
      );
    }
  }
  return storePath;
}

function scalar(database: DatabaseSync, sql: string): unknown {
  const row = database.prepare(sql).get() as PragmaValueRow | undefined;
  return row?.value;
}

function assertPragma(
  database: DatabaseSync,
  name: string,
  expected: string | number,
): void {
  const row = database.prepare(`PRAGMA ${name}`).get();
  const actual = Object.values(row ?? {})[0];
  if (actual !== expected) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.PragmaMismatch,
      `SQLite pragma ${name} did not read back as required.`,
    );
  }
}

function configureAndVerifyConnection(database: DatabaseSync): void {
  database.exec(`
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;
PRAGMA trusted_schema = OFF;
PRAGMA recursive_triggers = OFF;
PRAGMA temp_store = MEMORY;
`);
  assertPragma(database, "foreign_keys", 1);
  assertPragma(database, "journal_mode", "wal");
  assertPragma(database, "synchronous", 2);
  assertPragma(database, "busy_timeout", 5000);
  assertPragma(database, "trusted_schema", 0);
  assertPragma(database, "recursive_triggers", 0);
  assertPragma(database, "temp_store", 2);
}

function verifyCapabilities(database: DatabaseSync): string {
  const row = database
    .prepare("SELECT sqlite_version() AS sqlite_version")
    .get() as SqliteVersionRow | undefined;
  if (typeof row?.sqlite_version !== "string") {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.UnsupportedSqlite,
      "SQLite version could not be read.",
    );
  }
  if (!isAtLeastVersion(parseVersion(row.sqlite_version), [3, 37, 0])) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.UnsupportedSqlite,
      "Collection runner schema requires SQLite >= 3.37.0.",
    );
  }
  const jsonValid = scalar(
    database,
    "SELECT json_valid('{}') AS value",
  );
  if (jsonValid !== 1) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.UnsupportedSqlite,
      "SQLite JSON validation functions are unavailable.",
    );
  }
  if (typeof backup !== "function") {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.UnsupportedSqlite,
      "Node SQLite online backup API is unavailable.",
    );
  }
  const checkpoint = database.prepare("PRAGMA wal_checkpoint(PASSIVE)").get();
  if (
    checkpoint === undefined ||
    typeof checkpoint.busy !== "number" ||
    typeof checkpoint.log !== "number" ||
    typeof checkpoint.checkpointed !== "number"
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.UnsupportedSqlite,
      "SQLite WAL checkpoint capability is unavailable.",
    );
  }
  return row.sqlite_version;
}

function userTables(database: DatabaseSync): readonly string[] {
  const rows = database
    .prepare(`
SELECT name
FROM sqlite_schema
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name
`)
    .all() as unknown as ReadonlyArray<{ readonly name: unknown }>;
  return rows.map(({ name }) => String(name));
}

function hasMigrationTable(database: DatabaseSync): boolean {
  return (
    database
      .prepare(`
SELECT 1 AS value
FROM sqlite_schema
WHERE type = 'table' AND name = 'schema_migrations'
`)
      .get() !== undefined
  );
}

function applyFirstMigration(
  database: DatabaseSync,
  options: OpenEventContractCollectionRunnerSqliteStoreOptions,
): void {
  if (userTables(database).length !== 0) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
      "Unversioned SQLite store contains unexpected user tables.",
    );
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL);
    database
      .prepare(`
INSERT INTO schema_migrations (
  migration_version,
  migration_name,
  migration_checksum,
  applied_at_utc,
  application_build_fingerprint,
  schema_contract_version
) VALUES (?, ?, ?, ?, ?, ?)
`)
      .run(
        COLLECTION_RUNNER_SQLITE_SCHEMA_V1,
        COLLECTION_RUNNER_SQLITE_MIGRATION_V1_NAME,
        COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM,
        options.appliedAtUtc,
        options.applicationBuildFingerprint,
        COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_V1,
      );
    database.exec(
      `PRAGMA user_version = ${COLLECTION_RUNNER_SQLITE_SCHEMA_V1}`,
    );
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the original migration error.
    }
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
      "SQLite migration 001 failed and was rolled back.",
      { cause: error },
    );
  }
}

function isEmptyV1Store(database: DatabaseSync): boolean {
  return [
    "runner_definitions",
    "pilot_activations",
    "pilot_transitions",
    "scheduled_tasks",
    "task_transitions",
    "task_leases",
    "attempt_records",
    "attempt_results",
    "normalized_source_evidence",
    "transactional_outbox",
  ].every((table) => {
    const row = database
      .prepare(`SELECT count(*) AS count FROM ${table}`)
      .get() as { readonly count?: unknown } | undefined;
    return row?.count === 0;
  });
}

function applySecondMigration(
  database: DatabaseSync,
  options: OpenEventContractCollectionRunnerSqliteStoreOptions,
): void {
  const userVersion = Object.values(
    database.prepare("PRAGMA user_version").get() ?? {},
  )[0];
  if (userVersion !== COLLECTION_RUNNER_SQLITE_SCHEMA_V1) return;
  if (!isEmptyV1Store(database)) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
      "Populated migration 001 stores require a separately verified pre-migration backup before migration 002.",
    );
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(COLLECTION_RUNNER_SQLITE_MIGRATION_V2_SQL);
    database
      .prepare(`
INSERT INTO schema_migrations (
  migration_version,
  migration_name,
  migration_checksum,
  applied_at_utc,
  application_build_fingerprint,
  schema_contract_version
) VALUES (?, ?, ?, ?, ?, ?)
`)
      .run(
        COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
        COLLECTION_RUNNER_SQLITE_MIGRATION_V2_NAME,
        COLLECTION_RUNNER_SQLITE_MIGRATION_V2_CHECKSUM,
        options.appliedAtUtc,
        options.applicationBuildFingerprint,
        COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION,
      );
    database.exec(
      `PRAGMA user_version = ${COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION}`,
    );
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the original migration error.
    }
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
      "SQLite migration 002 failed and was rolled back.",
      { cause: error },
    );
  }
}

function verifyMigrationChain(database: DatabaseSync): void {
  const userVersionRow = database.prepare("PRAGMA user_version").get();
  const userVersion = Object.values(userVersionRow ?? {})[0];
  if (
    typeof userVersion === "number" &&
    userVersion > COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.FutureSchema,
      "SQLite store was created by a newer schema version.",
    );
  }
  if (userVersion !== COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
      "SQLite diagnostic user_version disagrees with the supported migration.",
    );
  }
  const rows = database
    .prepare(`
SELECT
  migration_version,
  migration_name,
  migration_checksum,
  application_build_fingerprint,
  schema_contract_version
FROM schema_migrations
ORDER BY migration_version
`)
    .all() as unknown as ReadonlyArray<MigrationRow>;
  const first = rows[0];
  const second = rows[1];
  if (
    rows.length !== 2 ||
    first?.migration_version !== COLLECTION_RUNNER_SQLITE_SCHEMA_V1 ||
    first.migration_name !== COLLECTION_RUNNER_SQLITE_MIGRATION_V1_NAME ||
    first.migration_checksum !== COLLECTION_RUNNER_SQLITE_MIGRATION_V1_CHECKSUM ||
    first.schema_contract_version !== COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_V1 ||
    typeof first.application_build_fingerprint !== "string" ||
    !BUILD_FINGERPRINT_PATTERN.test(first.application_build_fingerprint) ||
    second?.migration_version !== COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION ||
    second.migration_name !== COLLECTION_RUNNER_SQLITE_MIGRATION_V2_NAME ||
    second.migration_checksum !== COLLECTION_RUNNER_SQLITE_MIGRATION_V2_CHECKSUM ||
    second.schema_contract_version !==
      COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION ||
    typeof second.application_build_fingerprint !== "string" ||
    !BUILD_FINGERPRINT_PATTERN.test(second.application_build_fingerprint)
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.MigrationConflict,
      "SQLite migration history is missing, altered, or unsupported.",
    );
  }
}

interface SchemaCatalogRow {
  readonly type: unknown;
  readonly name: unknown;
  readonly table_name: unknown;
  readonly sql: unknown;
}

function schemaCatalog(database: DatabaseSync): readonly SchemaCatalogRow[] {
  return database
    .prepare(`
SELECT type, name, tbl_name AS table_name, sql
FROM sqlite_schema
WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
ORDER BY type, name
`)
    .all() as unknown as ReadonlyArray<SchemaCatalogRow>;
}

function schemaCatalogChecksum(database: DatabaseSync): string {
  return sha256(JSON.stringify(schemaCatalog(database)));
}

function expectedSchemaCatalogChecksum(): string {
  const expected = new DatabaseSync(":memory:", {
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    defensive: true,
  });
  try {
    expected.exec(COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL);
    expected.exec(COLLECTION_RUNNER_SQLITE_MIGRATION_V2_SQL);
    return schemaCatalogChecksum(expected);
  } finally {
    expected.close();
  }
}

const EXPECTED_SCHEMA_CATALOG_CHECKSUM = expectedSchemaCatalogChecksum();

function verifySchema(database: DatabaseSync): string {
  const actualTables = userTables(database);
  const expectedTables = [...COLLECTION_RUNNER_SQLITE_TABLES];
  if (
    actualTables.length !== expectedTables.length ||
    actualTables.some((table, index) => table !== expectedTables[index])
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.SchemaMismatch,
      "SQLite user-table catalog does not match schema contract v2.",
    );
  }
  const strictRows = database
    .prepare(`
SELECT name, strict
FROM pragma_table_list
WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%'
`)
    .all() as unknown as ReadonlyArray<{
    readonly name: unknown;
    readonly strict: unknown;
  }>;
  if (
    strictRows.length !== expectedTables.length ||
    strictRows.some(
      ({ name, strict }) =>
        !expectedTables.includes(String(name) as (typeof expectedTables)[number]) ||
        strict !== 1,
    )
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.SchemaMismatch,
      "Every collection-runner table must exist and use STRICT typing.",
    );
  }
  const actualCatalogChecksum = schemaCatalogChecksum(database);
  if (actualCatalogChecksum !== EXPECTED_SCHEMA_CATALOG_CHECKSUM) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.SchemaMismatch,
      "SQLite tables, columns, constraints, or indexes differ from migrations 001-002.",
    );
  }
  return actualCatalogChecksum;
}

function verifyIntegrity(database: DatabaseSync): void {
  const quickCheckRows = database.prepare("PRAGMA quick_check").all() as ReadonlyArray<
    Record<string, unknown>
  >;
  if (
    quickCheckRows.length !== 1 ||
    Object.values(quickCheckRows[0] ?? {})[0] !== "ok"
  ) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.IntegrityFailed,
      "SQLite quick_check did not return ok.",
    );
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new EventContractCollectionRunnerSqliteStoreError(
      EventContractCollectionRunnerSqliteStoreErrorCode.IntegrityFailed,
      "SQLite foreign_key_check found violations.",
    );
  }
}

export class EventContractCollectionRunnerSqliteStore {
  readonly #database: DatabaseSync;
  readonly #storePath: string;
  readonly #readiness: EventContractCollectionRunnerSqliteReadiness;
  readonly #recovery: CollectionRunnerStartupRecoveryReport;
  #closed = false;

  private constructor(
    database: DatabaseSync,
    storePath: string,
    sqliteVersion: string,
    schemaChecksum: string,
    recovery: CollectionRunnerStartupRecoveryReport,
  ) {
    this.#database = database;
    this.#storePath = storePath;
    this.#readiness = Object.freeze({
      ...COLLECTION_RUNNER_SQLITE_DEPENDENCY_DECISION,
      nodeVersion: versions.node,
      sqliteVersion,
      schemaVersion: COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
      schemaContractVersion:
        COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION,
      migrationName: COLLECTION_RUNNER_SQLITE_MIGRATION_V2_NAME,
      migrationChecksum: COLLECTION_RUNNER_SQLITE_MIGRATION_V2_CHECKSUM,
      schemaCatalogChecksum: schemaChecksum,
      journalMode: "wal",
      synchronous: 2,
      foreignKeys: 1,
      busyTimeoutMilliseconds: 5000,
      trustedSchema: 0,
      recursiveTriggers: 0,
      tempStore: 2,
      defensive: true,
      onlineBackupAvailable: true,
      walCheckpointAvailable: true,
    });
    this.#recovery = recovery;
  }

  public static open(
    options: OpenEventContractCollectionRunnerSqliteStoreOptions,
  ): EventContractCollectionRunnerSqliteStore {
    assertRuntime();
    const storeId = assertConfiguration(options);
    let storePath: string;
    try {
      storePath = resolveSafeStorePath(options.rootDirectory, storeId);
    } catch (error) {
      if (error instanceof EventContractCollectionRunnerSqliteStoreError) {
        throw error;
      }
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.InvalidPath,
        "SQLite runtime root or store identity could not be resolved safely.",
        { cause: error },
      );
    }
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(storePath, {
        open: true,
        readOnly: false,
        enableForeignKeyConstraints: true,
        enableDoubleQuotedStringLiterals: false,
        allowExtension: false,
        timeout: 5000,
        readBigInts: false,
        returnArrays: false,
        allowBareNamedParameters: false,
        allowUnknownNamedParameters: false,
        defensive: true,
      });
      configureAndVerifyConnection(database);
      const sqliteVersion = verifyCapabilities(database);
      verifyIntegrity(database);
      if (!hasMigrationTable(database)) {
        applyFirstMigration(database, options);
      }
      applySecondMigration(database, options);
      verifyMigrationChain(database);
      const schemaChecksum = verifySchema(database);
      verifyIntegrity(database);
      const recovery = inspectCollectionRunnerStartupRecovery(
        database,
        storePath,
        options.recoveryInspectedAtUtc ?? options.appliedAtUtc,
      );
      return new EventContractCollectionRunnerSqliteStore(
        database,
        storePath,
        sqliteVersion,
        schemaChecksum,
        recovery,
      );
    } catch (error) {
      try {
        database?.close();
      } catch {
        // Preserve the original fail-closed error.
      }
      if (error instanceof EventContractCollectionRunnerSqliteStoreError) {
        throw error;
      }
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.OpenFailed,
        "SQLite collection-runner store could not be opened safely.",
        { cause: error },
      );
    }
  }

  public getStorePath(): string {
    return this.#storePath;
  }

  public getReadiness(): EventContractCollectionRunnerSqliteReadiness {
    return this.#readiness;
  }

  public getStartupRecoveryReport(): CollectionRunnerStartupRecoveryReport {
    return this.#recovery;
  }

  public createRecoveryManager(): EventContractCollectionRunnerSqliteRecoveryManager {
    if (this.#closed) {
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.OpenFailed,
        "Closed SQLite store cannot create a recovery manager.",
      );
    }
    return new EventContractCollectionRunnerSqliteRecoveryManager(
      this.#database,
      this.#storePath,
      this.#readiness,
      this.#recovery,
    );
  }

  public createRunnerRepository(): EventContractCollectionRunnerRepository {
    if (this.#closed) {
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.OpenFailed,
        "Closed SQLite store cannot create a runner repository.",
      );
    }
    if (!this.#recovery.mutationAllowed) {
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.IntegrityFailed,
        "SQLite startup recovery blockers prohibit repository mutation.",
      );
    }
    return createSqliteEventContractCollectionRunnerRepository(this.#database);
  }

  public createRecoveryControlRepository(): EventContractCollectionRunnerRecoveryControlRepository {
    if (this.#closed) {
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.OpenFailed,
        "Closed SQLite store cannot create a recovery-control repository.",
      );
    }
    return createSqliteEventContractCollectionRunnerRecoveryControlRepository(
      this.#database,
      Object.freeze({
        storeId: basename(this.#storePath, ".sqlite3"),
        storePathIdentity: sha256(resolve(this.#storePath)),
        schemaCatalogChecksum: this.#readiness.schemaCatalogChecksum,
        recoveryReportFingerprint: this.#recovery.fingerprint,
        recoveryInspectedAtUtc: this.#recovery.inspectedAtUtc,
      }),
    );
  }

  public createAuthorizedRunnerRepository(
    session: CollectionRunnerProcessSessionIdentity,
    observedAtUtc: string,
    stopBarrier: CollectionRunnerProcessStopBarrier,
  ): EventContractCollectionRunnerRepository {
    if (this.#closed) {
      throw new EventContractCollectionRunnerSqliteStoreError(
        EventContractCollectionRunnerSqliteStoreErrorCode.OpenFailed,
        "Closed SQLite store cannot create an authorized runner repository.",
      );
    }
    const control = this.createRecoveryControlRepository();
    control.validateRecoverySessionGate({
      ...session,
      observedAtUtc,
      taskId: null,
    });
    return new SessionGatedEventContractCollectionRunnerRepository(
      createSqliteEventContractCollectionRunnerRepository(this.#database),
      control,
      session,
      stopBarrier,
    );
  }

  public close(): void {
    if (this.#closed) return;
    this.#database.close();
    this.#closed = true;
  }
}
