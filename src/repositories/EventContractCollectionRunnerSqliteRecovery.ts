import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import {
  COLLECTION_RUNNER_SQLITE_MIGRATION_NAME,
  COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL,
  COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION,
  COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
  COLLECTION_RUNNER_SQLITE_TABLES,
} from "./EventContractCollectionRunnerSqliteMigrationV1";
import type { EventContractCollectionRunnerSqliteReadiness } from "./EventContractCollectionRunnerSqliteStore";

const SAFE_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const UTC_MILLISECONDS =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TERMINAL_TASK_STATES =
  "'COMMITTED','MISSED','TERMINAL_FAILED','CANCELLED'";
const MIGRATION_CHECKSUM = `sha256:${createHash("sha256")
  .update(COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL, "utf8")
  .digest("hex")}`;

export enum CollectionRunnerRecoveryIssueCode {
  IntegrityCheckFailed = "INTEGRITY_CHECK_FAILED",
  ForeignKeyViolation = "FOREIGN_KEY_VIOLATION",
  MigrationMismatch = "MIGRATION_MISMATCH",
  SchemaMismatch = "SCHEMA_MISMATCH",
  CanonicalFingerprintMismatch = "CANONICAL_FINGERPRINT_MISMATCH",
  TransitionHistoryMismatch = "TRANSITION_HISTORY_MISMATCH",
  AuthorityMismatch = "AUTHORITY_MISMATCH",
  EvidenceStateMismatch = "EVIDENCE_STATE_MISMATCH",
  AttemptMismatch = "ATTEMPT_MISMATCH",
  LeaseMismatch = "LEASE_MISMATCH",
  ExpiredLease = "EXPIRED_LEASE",
  AbandonedAttempt = "ABANDONED_ATTEMPT",
  BudgetCounterMismatch = "BUDGET_COUNTER_MISMATCH",
  OutboxMismatch = "OUTBOX_MISMATCH",
  OperationalPilotRequiresOwnerResume =
    "OPERATIONAL_PILOT_REQUIRES_OWNER_RESUME",
  InspectionFailed = "INSPECTION_FAILED",
}

export interface CollectionRunnerRecoveryIssue {
  readonly code: CollectionRunnerRecoveryIssueCode;
  readonly count: number;
  readonly blocker: true;
}

export interface CollectionRunnerStartupRecoveryReport {
  readonly inspectedAtUtc: string;
  readonly storePath: string;
  readonly mutationAllowed: boolean;
  readonly ownerResumeRequired: boolean;
  readonly issueCount: number;
  readonly issues: readonly CollectionRunnerRecoveryIssue[];
}

export interface CreateCollectionRunnerBackupOptions {
  readonly backupRootDirectory: string;
  readonly backupId: string;
  readonly createdAtUtc: string;
  readonly retentionCount: number;
}

export interface CollectionRunnerBackupManifest {
  readonly manifestVersion: "1.0";
  readonly backupId: string;
  readonly sourceStoreId: string;
  readonly sourceStorePath: string;
  readonly sourceFileIdentity: string;
  readonly backupPath: string;
  readonly manifestPath: string;
  readonly createdAtUtc: string;
  readonly schemaVersion: 1;
  readonly schemaContractVersion: "1.0";
  readonly migrationName: "001_collection_runner_foundation";
  readonly migrationChecksum: string;
  readonly schemaCatalogChecksum: string;
  readonly sqliteVersion: string;
  readonly pageCount: number;
  readonly backupBytes: number;
  readonly backupDigest: string;
  readonly retentionCount: number;
  readonly manifestFingerprint: string;
}

export interface RestoreCollectionRunnerBackupOptions {
  readonly backupRootDirectory: string;
  readonly manifest: CollectionRunnerBackupManifest;
  readonly targetRootDirectory: string;
  readonly targetStoreId: string;
  readonly verifiedAtUtc: string;
}

export interface CollectionRunnerRestoreResult {
  readonly targetStorePath: string;
  readonly backupDigest: string;
  readonly verification: CollectionRunnerStartupRecoveryReport;
  readonly ownerSwitchRequired: true;
  readonly operatorResumeRequired: true;
}

export class CollectionRunnerRecoveryError extends Error {
  public constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "RECOVERY_BLOCKED"
      | "BACKUP_CONFLICT"
      | "BACKUP_VERIFICATION_FAILED"
      | "RESTORE_CONFLICT"
      | "RESTORE_VERIFICATION_FAILED",
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerRecoveryError";
  }
}

function freeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function assertUtc(value: string, field: string): void {
  const parsed = new Date(value);
  if (
    !UTC_MILLISECONDS.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    throw new CollectionRunnerRecoveryError(
      "INVALID_INPUT",
      `${field} must be canonical millisecond UTC.`,
    );
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function recordFingerprint(record: Readonly<Record<string, unknown>>): string {
  const unsigned = { ...record };
  delete unsigned.fingerprint;
  return `fnv1a64:${fnv1a64(canonicalize(unsigned))}`;
}

function sha256Bytes(value: Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function regularFile(path: string, label: string): void {
  if (!existsSync(path)) {
    throw new CollectionRunnerRecoveryError("INVALID_INPUT", `${label} is missing.`);
  }
  const entry = lstatSync(path);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new CollectionRunnerRecoveryError(
      "INVALID_INPUT",
      `${label} must be a regular non-symbolic-link file.`,
    );
  }
}

function safePath(rootDirectory: string, id: string, suffix: string): string {
  if (!SAFE_ID.test(id)) {
    throw new CollectionRunnerRecoveryError(
      "INVALID_INPUT",
      "Backup and restore IDs must be lowercase traversal-free identifiers.",
    );
  }
  mkdirSync(rootDirectory, { recursive: true });
  const root = realpathSync(rootDirectory);
  if (root.startsWith("\\\\")) {
    throw new CollectionRunnerRecoveryError(
      "INVALID_INPUT",
      "Backup and restore roots may not use UNC paths.",
    );
  }
  const path = resolve(root, `${id}${suffix}`);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new CollectionRunnerRecoveryError(
      "INVALID_INPUT",
      "Resolved backup or restore path escapes its approved root.",
    );
  }
  return path;
}

function scalarCount(database: DatabaseSync, sql: string): number {
  const row = database.prepare(sql).get() as
    | { readonly count: unknown }
    | undefined;
  return typeof row?.count === "number" ? row.count : 0;
}

function issue(
  issues: CollectionRunnerRecoveryIssue[],
  code: CollectionRunnerRecoveryIssueCode,
  count: number,
): void {
  if (count > 0) issues.push(freeze({ code, count, blocker: true }));
}

function canonicalMismatchCount(database: DatabaseSync): number {
  let count = 0;
  for (const [table, jsonColumn, fingerprintColumn] of [
    ["runner_definitions", "canonical_record_json", "fingerprint"],
    ["pilot_activations", "canonical_record_json", "activation_fingerprint"],
    ["scheduled_tasks", "canonical_record_json", "task_fingerprint"],
    [
      "normalized_source_evidence",
      "canonical_snapshot_json",
      "source_snapshot_fingerprint",
    ],
  ] as const) {
    const rows = database
      .prepare(
        `SELECT ${jsonColumn} AS json_value, ${fingerprintColumn} AS fingerprint FROM ${table}`,
      )
      .all() as unknown as ReadonlyArray<{
      readonly json_value: unknown;
      readonly fingerprint: unknown;
    }>;
    for (const row of rows) {
      try {
        const record = JSON.parse(String(row.json_value)) as Record<
          string,
          unknown
        >;
        if (
          canonicalize(record) !== row.json_value ||
          record.fingerprint !== row.fingerprint ||
          recordFingerprint(record) !== row.fingerprint
        ) {
          count += 1;
        }
      } catch {
        count += 1;
      }
    }
  }
  return count;
}

function migrationMismatchCount(database: DatabaseSync): number {
  const row = database.prepare(`
SELECT migration_version, migration_name, migration_checksum, schema_contract_version
FROM schema_migrations
`).get() as Record<string, unknown> | undefined;
  const userVersion = Object.values(
    database.prepare("PRAGMA user_version").get() ?? {},
  )[0];
  return row !== undefined &&
    row.migration_version === COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION &&
    row.migration_name === COLLECTION_RUNNER_SQLITE_MIGRATION_NAME &&
    row.migration_checksum === MIGRATION_CHECKSUM &&
    row.schema_contract_version ===
      COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION &&
    userVersion === COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION
    ? 0
    : 1;
}

function schemaMismatchCount(database: DatabaseSync): number {
  const rows = database.prepare(`
SELECT name, strict FROM pragma_table_list
WHERE schema = 'main' AND type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`).all() as ReadonlyArray<Record<string, unknown>>;
  return rows.length === COLLECTION_RUNNER_SQLITE_TABLES.length &&
    rows.every(
      (row, index) =>
        row.name === COLLECTION_RUNNER_SQLITE_TABLES[index] && row.strict === 1,
    )
    ? 0
    : 1;
}

function budgetMismatchCount(database: DatabaseSync): number {
  return scalarCount(
    database,
    `
SELECT count(*) AS count
FROM activation_budget_counters b
WHERE b.events_scheduled != (SELECT count(*) FROM scheduled_tasks t WHERE t.activation_id = b.activation_id)
   OR b.requests_started != (
     SELECT coalesce(sum(a.request_count), 0)
     FROM attempt_records a JOIN scheduled_tasks t ON t.task_id = a.task_id
     WHERE t.activation_id = b.activation_id
   )
   OR b.bytes_received != (
     SELECT coalesce(sum(r.raw_payload_bytes), 0)
     FROM attempt_results r
     JOIN attempt_records a ON a.attempt_id = r.attempt_id
     JOIN scheduled_tasks t ON t.task_id = a.task_id
     WHERE t.activation_id = b.activation_id
   )
   OR b.records_received != (
     SELECT coalesce(sum(r.record_count), 0)
     FROM attempt_results r
     JOIN attempt_records a ON a.attempt_id = r.attempt_id
     JOIN scheduled_tasks t ON t.task_id = a.task_id
     WHERE t.activation_id = b.activation_id
   )
   OR b.retries_started != (
     SELECT count(*) FROM attempt_records a
     JOIN scheduled_tasks t ON t.task_id = a.task_id
     WHERE t.activation_id = b.activation_id AND a.attempt_number > 1
   )
   OR b.evidence_committed != (
     SELECT count(*) FROM normalized_source_evidence e
     JOIN scheduled_tasks t ON t.task_id = e.task_id
     WHERE t.activation_id = b.activation_id
   )
   OR b.tasks_missed != (
     SELECT count(*) FROM scheduled_tasks t
     WHERE t.activation_id = b.activation_id AND t.current_state = 'MISSED'
   )
`,
  );
}

export function inspectCollectionRunnerStartupRecovery(
  database: DatabaseSync,
  storePath: string,
  inspectedAtUtc: string,
): CollectionRunnerStartupRecoveryReport {
  assertUtc(inspectedAtUtc, "inspectedAtUtc");
  const issues: CollectionRunnerRecoveryIssue[] = [];
  try {
    const integrity = database.prepare("PRAGMA integrity_check").all();
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.IntegrityCheckFailed,
      integrity.length === 1 &&
        Object.values(integrity[0] ?? {})[0] === "ok"
        ? 0
        : integrity.length,
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.ForeignKeyViolation,
      database.prepare("PRAGMA foreign_key_check").all().length,
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.MigrationMismatch,
      migrationMismatchCount(database),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.SchemaMismatch,
      schemaMismatchCount(database),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.CanonicalFingerprintMismatch,
      canonicalMismatchCount(database),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.TransitionHistoryMismatch,
      scalarCount(
        database,
        `
SELECT count(*) AS count FROM pilot_activations p
WHERE NOT EXISTS (
  SELECT 1 FROM pilot_transitions x
  WHERE x.activation_id = p.activation_id AND x.to_aggregate_version = p.aggregate_version
)
`) +
        scalarCount(
          database,
          `
SELECT count(*) AS count FROM scheduled_tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM task_transitions x
  WHERE x.task_id = t.task_id AND x.to_aggregate_version = t.aggregate_version
)
`,
        ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.AuthorityMismatch,
      scalarCount(
        database,
        `
SELECT count(*) AS count FROM scheduled_tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM pilot_activation_providers p
  WHERE p.activation_id = t.activation_id AND p.provider_fingerprint = t.provider_fingerprint
)
OR (t.source_lane = 'EXCHANGE' AND NOT EXISTS (
  SELECT 1 FROM pilot_activation_mappings m
  WHERE m.activation_id = t.activation_id AND m.mapping_fingerprint = t.mapping_fingerprint
))
OR (t.source_lane = 'PLATFORM' AND t.mapping_fingerprint IS NOT NULL)
`,
      ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.EvidenceStateMismatch,
      scalarCount(
        database,
        `
SELECT count(*) AS count FROM scheduled_tasks t
WHERE (t.current_state = 'COMMITTED') != EXISTS (
  SELECT 1 FROM normalized_source_evidence e WHERE e.task_id = t.task_id
)
`,
      ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.AttemptMismatch,
      scalarCount(
        database,
        `
SELECT count(*) AS count FROM attempt_records a
JOIN scheduled_tasks t ON t.task_id = a.task_id
WHERE a.attempt_number > t.maximum_attempts
`,
      ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.LeaseMismatch,
      scalarCount(
        database,
        `
SELECT count(*) AS count FROM task_leases l
JOIN scheduled_tasks t ON t.task_id = l.task_id
WHERE t.current_state IN (${TERMINAL_TASK_STATES})
   OR (t.current_state IN ('IN_FLIGHT','VALIDATING') AND NOT EXISTS (
     SELECT 1 FROM attempt_records a
     WHERE a.task_id = l.task_id AND a.lease_token = l.lease_token
   ))
`,
      ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.ExpiredLease,
      scalarCount(
        database,
        `SELECT count(*) AS count FROM task_leases WHERE expires_at_utc <= '${inspectedAtUtc}'`,
      ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.AbandonedAttempt,
      scalarCount(
        database,
        `
SELECT count(*) AS count FROM attempt_records a
LEFT JOIN attempt_results r ON r.attempt_id = a.attempt_id
WHERE r.attempt_id IS NULL
`,
      ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.BudgetCounterMismatch,
      budgetMismatchCount(database),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.OutboxMismatch,
      scalarCount(
        database,
        `
SELECT count(*) AS count FROM scheduled_tasks t
WHERE t.current_state = 'COMMITTED' AND NOT EXISTS (
  SELECT 1 FROM transactional_outbox o
  WHERE o.aggregate_type = 'TASK'
    AND o.aggregate_id = t.task_id
    AND o.aggregate_version = t.aggregate_version
)
`,
      ),
    );
    issue(
      issues,
      CollectionRunnerRecoveryIssueCode.OperationalPilotRequiresOwnerResume,
      scalarCount(
        database,
        `SELECT count(*) AS count FROM pilot_activations WHERE current_state IN ('ACTIVE','STOP_REQUESTED')`,
      ),
    );
  } catch {
    issue(issues, CollectionRunnerRecoveryIssueCode.InspectionFailed, 1);
  }
  issues.sort((left, right) => left.code.localeCompare(right.code));
  return freeze({
    inspectedAtUtc,
    storePath,
    mutationAllowed: issues.length === 0,
    ownerResumeRequired: issues.some(
      ({ code }) =>
        code ===
        CollectionRunnerRecoveryIssueCode.OperationalPilotRequiresOwnerResume,
    ),
    issueCount: issues.reduce((sum, value) => sum + value.count, 0),
    issues,
  });
}

function fileIdentity(path: string): string {
  const value = statSync(path, { bigint: true });
  return sha256Text(
    canonicalize({
      device: value.dev.toString(),
      inode: value.ino.toString(),
      size: value.size.toString(),
      modifiedNanoseconds: value.mtimeNs.toString(),
    }),
  );
}

function unsignedManifest(
  manifest: Omit<CollectionRunnerBackupManifest, "manifestFingerprint">,
): string {
  return canonicalize(manifest);
}

export class EventContractCollectionRunnerSqliteRecoveryManager {
  public constructor(
    private readonly database: DatabaseSync,
    private readonly storePath: string,
    private readonly readiness: EventContractCollectionRunnerSqliteReadiness,
    private readonly recovery: CollectionRunnerStartupRecoveryReport,
  ) {}

  public getStartupRecoveryReport(): CollectionRunnerStartupRecoveryReport {
    return this.recovery;
  }

  public async createVerifiedBackup(
    options: CreateCollectionRunnerBackupOptions,
  ): Promise<CollectionRunnerBackupManifest> {
    if (!this.recovery.mutationAllowed) {
      throw new CollectionRunnerRecoveryError(
        "RECOVERY_BLOCKED",
        "A store with recovery blockers cannot produce a verified backup.",
      );
    }
    assertUtc(options.createdAtUtc, "createdAtUtc");
    if (!Number.isSafeInteger(options.retentionCount) || options.retentionCount < 1) {
      throw new CollectionRunnerRecoveryError(
        "INVALID_INPUT",
        "retentionCount must be a positive safe integer.",
      );
    }
    const backupPath = safePath(
      options.backupRootDirectory,
      options.backupId,
      ".sqlite3",
    );
    const manifestPath = safePath(
      options.backupRootDirectory,
      options.backupId,
      ".manifest.json",
    );
    if (existsSync(backupPath) || existsSync(manifestPath)) {
      throw new CollectionRunnerRecoveryError(
        "BACKUP_CONFLICT",
        "Backup identity already exists and will not be overwritten.",
      );
    }
    await backup(this.database, backupPath);
    try {
      regularFile(backupPath, "Backup database");
      const verificationDatabase = new DatabaseSync(backupPath, {
        readOnly: true,
        enableForeignKeyConstraints: true,
        defensive: true,
      });
      let report: CollectionRunnerStartupRecoveryReport;
      let pageCount: number;
      try {
        report = inspectCollectionRunnerStartupRecovery(
          verificationDatabase,
          backupPath,
          options.createdAtUtc,
        );
        pageCount = Number(
          Object.values(
            verificationDatabase.prepare("PRAGMA page_count").get() ?? {},
          )[0],
        );
      } finally {
        verificationDatabase.close();
      }
      if (!report.mutationAllowed) {
        throw new CollectionRunnerRecoveryError(
          "BACKUP_VERIFICATION_FAILED",
          "Independent backup verification found recovery blockers.",
        );
      }
      const backupBytes = statSync(backupPath).size;
      const backupDigest = sha256Bytes(readFileSync(backupPath));
      const sourceStoreId = basename(this.storePath, ".sqlite3");
      const base = {
        manifestVersion: "1.0" as const,
        backupId: options.backupId,
        sourceStoreId,
        sourceStorePath: this.storePath,
        sourceFileIdentity: fileIdentity(this.storePath),
        backupPath,
        manifestPath,
        createdAtUtc: options.createdAtUtc,
        schemaVersion: COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION,
        schemaContractVersion:
          COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION,
        migrationName: COLLECTION_RUNNER_SQLITE_MIGRATION_NAME,
        migrationChecksum: MIGRATION_CHECKSUM,
        schemaCatalogChecksum: this.readiness.schemaCatalogChecksum,
        sqliteVersion: this.readiness.sqliteVersion,
        pageCount,
        backupBytes,
        backupDigest,
        retentionCount: options.retentionCount,
      };
      const manifest = freeze({
        ...base,
        manifestFingerprint: sha256Text(unsignedManifest(base)),
      });
      const temporaryManifestPath = `${manifestPath}.tmp`;
      writeFileSync(temporaryManifestPath, `${canonicalize(manifest)}\n`, {
        encoding: "utf8",
        flag: "wx",
      });
      renameSync(temporaryManifestPath, manifestPath);
      return manifest;
    } catch (error) {
      throw error instanceof CollectionRunnerRecoveryError
        ? error
        : new CollectionRunnerRecoveryError(
            "BACKUP_VERIFICATION_FAILED",
            "Backup creation or verification failed closed.",
            { cause: error },
          );
    }
  }

  public static async restoreVerifiedBackup(
    options: RestoreCollectionRunnerBackupOptions,
  ): Promise<CollectionRunnerRestoreResult> {
    assertUtc(options.verifiedAtUtc, "verifiedAtUtc");
    const manifest = options.manifest;
    if (
      manifest.manifestFingerprint !==
      sha256Text(
        unsignedManifest(
          Object.fromEntries(
            Object.entries(manifest).filter(
              ([key]) => key !== "manifestFingerprint",
            ),
          ) as Omit<CollectionRunnerBackupManifest, "manifestFingerprint">,
        ),
      )
    ) {
      throw new CollectionRunnerRecoveryError(
        "BACKUP_VERIFICATION_FAILED",
        "Backup manifest fingerprint is invalid.",
      );
    }
    const expectedBackupPath = safePath(
      options.backupRootDirectory,
      manifest.backupId,
      ".sqlite3",
    );
    const expectedManifestPath = safePath(
      options.backupRootDirectory,
      manifest.backupId,
      ".manifest.json",
    );
    if (
      manifest.backupPath !== expectedBackupPath ||
      manifest.manifestPath !== expectedManifestPath
    ) {
      throw new CollectionRunnerRecoveryError(
        "BACKUP_VERIFICATION_FAILED",
        "Manifest paths do not bind to the approved backup root.",
      );
    }
    regularFile(expectedBackupPath, "Backup database");
    regularFile(expectedManifestPath, "Backup manifest");
    if (sha256Bytes(readFileSync(expectedBackupPath)) !== manifest.backupDigest) {
      throw new CollectionRunnerRecoveryError(
        "BACKUP_VERIFICATION_FAILED",
        "Backup file digest does not match its manifest.",
      );
    }
    const onDiskManifest = JSON.parse(
      readFileSync(expectedManifestPath, "utf8"),
    ) as unknown;
    if (canonicalize(onDiskManifest) !== canonicalize(manifest)) {
      throw new CollectionRunnerRecoveryError(
        "BACKUP_VERIFICATION_FAILED",
        "Backup manifest file differs from the approved manifest.",
      );
    }
    const targetPath = safePath(
      options.targetRootDirectory,
      options.targetStoreId,
      ".sqlite3",
    );
    if (
      existsSync(targetPath) ||
      existsSync(`${targetPath}-wal`) ||
      existsSync(`${targetPath}-shm`)
    ) {
      throw new CollectionRunnerRecoveryError(
        "RESTORE_CONFLICT",
        "Restore target already exists and will not be overwritten.",
      );
    }
    const source = new DatabaseSync(expectedBackupPath, {
      readOnly: true,
      enableForeignKeyConstraints: true,
      defensive: true,
    });
    try {
      await backup(source, targetPath);
    } finally {
      source.close();
    }
    const restored = new DatabaseSync(targetPath, {
      readOnly: true,
      enableForeignKeyConstraints: true,
      defensive: true,
    });
    let verification: CollectionRunnerStartupRecoveryReport;
    try {
      verification = inspectCollectionRunnerStartupRecovery(
        restored,
        targetPath,
        options.verifiedAtUtc,
      );
    } finally {
      restored.close();
    }
    if (!verification.mutationAllowed) {
      throw new CollectionRunnerRecoveryError(
        "RESTORE_VERIFICATION_FAILED",
        "Restored database failed independent recovery verification.",
      );
    }
    return freeze({
      targetStorePath: targetPath,
      backupDigest: manifest.backupDigest,
      verification,
      ownerSwitchRequired: true,
      operatorResumeRequired: true,
    });
  }
}
