import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  CollectionRunnerRehearsalOperationAuthorizationReceipt,
  CollectionRunnerRehearsalOperationResultReceipt,
  CollectionRunnerRehearsalOperationStopReceipt,
  CollectionRunnerRehearsalOperationValidationReceipt,
} from "../contracts";
import type {
  CollectionRunnerRehearsalOperationControlRepository,
  CollectionRunnerRehearsalOperationControlSnapshot,
} from "../engines/event-contract-collection-runner-rehearsal-operation-control";

const STORE_FILENAME = "rehearsal-operation-control.sqlite3";
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SQLITE_SCHEMA =
  "1.1" as const;

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SQL = `
CREATE TABLE IF NOT EXISTS operation_control_metadata (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version TEXT NOT NULL CHECK (schema_version = '1.1')
) STRICT;
INSERT OR IGNORE INTO operation_control_metadata (singleton, schema_version)
VALUES (1, '1.1');

CREATE TABLE IF NOT EXISTS operation_phase_authorizations (
  authorization_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  manifest_fingerprint TEXT NOT NULL,
  command_id TEXT NOT NULL,
  command_fingerprint TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL CHECK (
    phase IN ('PREPARE', 'STEP', 'RECOVER', 'VALIDATE', 'FREEZE', 'PACKAGE')
  ),
  phase_plan_ordinal INTEGER NOT NULL CHECK (phase_plan_ordinal > 0),
  process_session_id TEXT NOT NULL UNIQUE,
  consumed_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL CHECK (
    json_valid(canonical_record_json)
    AND json_type(canonical_record_json) = 'object'
  ),
  record_fingerprint TEXT NOT NULL UNIQUE,
  UNIQUE (operation_id, phase_plan_ordinal)
) STRICT;

CREATE TABLE IF NOT EXISTS operation_phase_results (
  result_id TEXT PRIMARY KEY,
  authorization_id TEXT NOT NULL UNIQUE,
  operation_id TEXT NOT NULL,
  manifest_fingerprint TEXT NOT NULL,
  command_fingerprint TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL,
  phase_plan_ordinal INTEGER NOT NULL CHECK (phase_plan_ordinal > 0),
  disposition TEXT NOT NULL CHECK (
    disposition IN ('COMPLETED', 'FAILED_CLOSED', 'RECOVERY_REQUIRED', 'INCOMPLETE')
  ),
  completed_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL CHECK (
    json_valid(canonical_record_json)
    AND json_type(canonical_record_json) = 'object'
  ),
  record_fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY (authorization_id)
    REFERENCES operation_phase_authorizations (authorization_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (operation_id, phase_plan_ordinal)
) STRICT;

CREATE TABLE IF NOT EXISTS operation_stop_receipts (
  stop_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  manifest_fingerprint TEXT NOT NULL,
  command_fingerprint TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL CHECK (mode IN ('GRACEFUL', 'EMERGENCY')),
  requested_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL CHECK (
    json_valid(canonical_record_json)
    AND json_type(canonical_record_json) = 'object'
  ),
  record_fingerprint TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE IF NOT EXISTS operation_validation_receipts (
  receipt_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  manifest_fingerprint TEXT NOT NULL,
  record_fingerprint TEXT NOT NULL UNIQUE,
  canonical_record_json TEXT NOT NULL CHECK (
    json_valid(canonical_record_json)
    AND json_type(canonical_record_json) = 'object'
  )
) STRICT;

CREATE TRIGGER IF NOT EXISTS operation_authorizations_no_update
BEFORE UPDATE ON operation_phase_authorizations
BEGIN SELECT RAISE(ABORT, 'append-only operation authorizations'); END;
CREATE TRIGGER IF NOT EXISTS operation_authorizations_no_delete
BEFORE DELETE ON operation_phase_authorizations
BEGIN SELECT RAISE(ABORT, 'append-only operation authorizations'); END;
CREATE TRIGGER IF NOT EXISTS operation_results_no_update
BEFORE UPDATE ON operation_phase_results
BEGIN SELECT RAISE(ABORT, 'append-only operation results'); END;
CREATE TRIGGER IF NOT EXISTS operation_results_no_delete
BEFORE DELETE ON operation_phase_results
BEGIN SELECT RAISE(ABORT, 'append-only operation results'); END;
CREATE TRIGGER IF NOT EXISTS operation_stops_no_update
BEFORE UPDATE ON operation_stop_receipts
BEGIN SELECT RAISE(ABORT, 'append-only operation stops'); END;
CREATE TRIGGER IF NOT EXISTS operation_stops_no_delete
BEFORE DELETE ON operation_stop_receipts
BEGIN SELECT RAISE(ABORT, 'append-only operation stops'); END;
CREATE TRIGGER IF NOT EXISTS operation_validation_receipts_no_update
BEFORE UPDATE ON operation_validation_receipts
BEGIN SELECT RAISE(ABORT, 'append-only operation validation receipts'); END;
CREATE TRIGGER IF NOT EXISTS operation_validation_receipts_no_delete
BEFORE DELETE ON operation_validation_receipts
BEGIN SELECT RAISE(ABORT, 'append-only operation validation receipts'); END;
`;

type Row = Readonly<Record<string, unknown>>;

export class CollectionRunnerRehearsalOperationControlStoreError extends Error {
  public constructor(
    public readonly code:
      | "INVALID_CONFIGURATION"
      | "STORE_MISSING"
      | "UNSAFE_PATH"
      | "INTEGRITY_FAILURE"
      | "AUTHORIZATION_CONFLICT"
      | "RESULT_CONFLICT"
      | "STOP_TRIPPED"
      | "MIGRATION_REQUIRED"
      | "TRANSACTION_FAILURE",
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerRehearsalOperationControlStoreError";
  }
}

function fail(
  code: CollectionRunnerRehearsalOperationControlStoreError["code"],
  message: string,
  cause?: unknown,
): never {
  throw new CollectionRunnerRehearsalOperationControlStoreError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
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
  return `sha256:${createHash("sha256")
    .update(canonical(value), "utf8")
    .digest("hex")}`;
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function resolveStorePath(controlRoot: string): string {
  if (!existsSync(controlRoot)) {
    fail("STORE_MISSING", "Registered operation control root is missing.");
  }
  const entry = lstatSync(controlRoot);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    fail("UNSAFE_PATH", "Operation control root must be a real local directory.");
  }
  const root = realpathSync(controlRoot);
  if (root.startsWith("\\\\")) {
    fail("UNSAFE_PATH", "Operation control root cannot be a UNC path.");
  }
  const path = resolve(root, STORE_FILENAME);
  if (!path.startsWith(`${root}${sep}`)) {
    fail("UNSAFE_PATH", "Operation control store escapes its registered root.");
  }
  for (const candidate of [path, `${path}-wal`, `${path}-shm`]) {
    if (!existsSync(candidate)) continue;
    const status = lstatSync(candidate);
    if (!status.isFile() || status.isSymbolicLink()) {
      fail("UNSAFE_PATH", "Operation control store entries must be regular files.");
    }
  }
  return path;
}

function verifyRecord<T extends {
  readonly deterministic: true;
  readonly fingerprint: string;
}>(
  row: Row | undefined,
  label: string,
): T {
  if (
    row === undefined ||
    typeof row.canonical_record_json !== "string" ||
    typeof row.record_fingerprint !== "string"
  ) {
    fail("INTEGRITY_FAILURE", `${label} is missing.`);
  }
  let value: T;
  try {
    value = JSON.parse(row.canonical_record_json) as T;
  } catch (cause) {
    fail("INTEGRITY_FAILURE", `${label} JSON is invalid.`, cause);
  }
  const {
    deterministic,
    fingerprint,
    ...body
  } = value;
  if (
    deterministic !== true ||
    !FP.test(fingerprint) ||
    fingerprint !== row.record_fingerprint ||
    fingerprint !== sha(body)
  ) {
    fail("INTEGRITY_FAILURE", `${label} fingerprint is invalid.`);
  }
  return freeze(structuredClone(value));
}

function validateReceipt(
  value: {
    readonly operationId: string;
    readonly manifestFingerprint: string;
    readonly fingerprint: string;
    readonly deterministic: true;
  },
  label: string,
): void {
  if (
    !ID.test(value.operationId) ||
    !FP.test(value.manifestFingerprint) ||
    !FP.test(value.fingerprint) ||
    value.deterministic !== true
  ) {
    fail("INTEGRITY_FAILURE", `${label} is malformed.`);
  }
}

function tableExists(database: DatabaseSync, table: string): boolean {
  return database.prepare(
    "SELECT 1 AS present FROM sqlite_schema WHERE type = 'table' AND name = ?",
  ).get(table) !== undefined;
}

function readSchemaVersion(database: DatabaseSync): string | null {
  if (!tableExists(database, "operation_control_metadata")) return null;
  const metadata = database.prepare(
    "SELECT schema_version FROM operation_control_metadata WHERE singleton = 1",
  ).get() as Row | undefined;
  return typeof metadata?.schema_version === "string"
    ? metadata.schema_version
    : null;
}

function migrateEmptyV10ToV11(database: DatabaseSync): void {
  const requiredV10Tables = [
    "operation_phase_authorizations",
    "operation_phase_results",
    "operation_stop_receipts",
  ] as const;
  if (requiredV10Tables.some((table) => !tableExists(database, table))) {
    fail("INTEGRITY_FAILURE", "Control 1.0 schema is incomplete.");
  }
  const populated = requiredV10Tables.some((table) => {
    const row = database.prepare(
      `SELECT COUNT(*) AS count FROM ${table}`,
    ).get() as Row;
    return row.count !== 0;
  });
  if (populated) {
    fail(
      "MIGRATION_REQUIRED",
      "Non-empty Control 1.0 requires explicit Owner-reviewed recovery.",
    );
  }
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
CREATE TABLE operation_control_metadata_v11 (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_version TEXT NOT NULL CHECK (schema_version = '1.1')
) STRICT;
INSERT INTO operation_control_metadata_v11 (singleton, schema_version)
VALUES (1, '1.1');
DROP TABLE operation_control_metadata;
ALTER TABLE operation_control_metadata_v11 RENAME TO operation_control_metadata;

CREATE TABLE operation_validation_receipts (
  receipt_id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL UNIQUE,
  manifest_fingerprint TEXT NOT NULL,
  record_fingerprint TEXT NOT NULL UNIQUE,
  canonical_record_json TEXT NOT NULL CHECK (
    json_valid(canonical_record_json)
    AND json_type(canonical_record_json) = 'object'
  )
) STRICT;
CREATE TRIGGER operation_validation_receipts_no_update
BEFORE UPDATE ON operation_validation_receipts
BEGIN SELECT RAISE(ABORT, 'append-only operation validation receipts'); END;
CREATE TRIGGER operation_validation_receipts_no_delete
BEFORE DELETE ON operation_validation_receipts
BEGIN SELECT RAISE(ABORT, 'append-only operation validation receipts'); END;
`);
    database.exec("COMMIT");
  } catch (cause) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the migration failure.
    }
    fail("INTEGRITY_FAILURE", "Control 1.0 migration failed atomically.", cause);
  }
}

export class EventContractCollectionRunnerRehearsalOperationControlSqliteStore
  implements CollectionRunnerRehearsalOperationControlRepository {
  readonly #database: DatabaseSync;
  readonly #path: string;

  private constructor(database: DatabaseSync, path: string) {
    this.#database = database;
    this.#path = path;
  }

  public static open(
    controlRoot: string,
    options: { readonly createIfMissing: boolean },
  ): EventContractCollectionRunnerRehearsalOperationControlSqliteStore {
    if (
      typeof options !== "object" ||
      options === null ||
      Object.keys(options).join(",") !== "createIfMissing" ||
      typeof options.createIfMissing !== "boolean"
    ) {
      fail("INVALID_CONFIGURATION", "Control-store open options are invalid.");
    }
    const path = resolveStorePath(controlRoot);
    const existed = existsSync(path);
    if (!options.createIfMissing && !existed) {
      fail("STORE_MISSING", "Operation control store does not exist.");
    }
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
      if (!existed && options.createIfMissing) {
        database.exec(COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SQL);
      }
      let schemaVersion = readSchemaVersion(database);
      if (schemaVersion === "1.0") {
        if (!options.createIfMissing) {
          fail(
            "MIGRATION_REQUIRED",
            "Control 1.0 cannot be opened without explicit migration authority.",
          );
        }
        migrateEmptyV10ToV11(database);
        schemaVersion = readSchemaVersion(database);
      }
      if (
        schemaVersion !==
        COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SQLITE_SCHEMA
      ) {
        fail("INTEGRITY_FAILURE", "Operation control schema is not exact.");
      }
      return new EventContractCollectionRunnerRehearsalOperationControlSqliteStore(
        database,
        path,
      );
    } catch (error) {
      database.close();
      if (error instanceof CollectionRunnerRehearsalOperationControlStoreError) {
        throw error;
      }
      fail("INTEGRITY_FAILURE", "Operation control store failed verification.", error);
    }
  }

  public static openReadOnly(
    controlRoot: string,
  ): EventContractCollectionRunnerRehearsalOperationControlSqliteStore {
    const path = resolveStorePath(controlRoot);
    if (!existsSync(path)) {
      fail("STORE_MISSING", "Operation control store does not exist.");
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
      database.exec(`
PRAGMA foreign_keys = ON;
PRAGMA trusted_schema = OFF;
PRAGMA query_only = ON;
`);
      if (
        readSchemaVersion(database) !==
          COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SQLITE_SCHEMA
      ) {
        fail("INTEGRITY_FAILURE", "Operation control schema is not exact.");
      }
      return new EventContractCollectionRunnerRehearsalOperationControlSqliteStore(
        database,
        path,
      );
    } catch (error) {
      database.close();
      if (error instanceof CollectionRunnerRehearsalOperationControlStoreError) {
        throw error;
      }
      fail(
        "INTEGRITY_FAILURE",
        "Read-only operation control store failed verification.",
        error,
      );
    }
  }

  public getStorePath(): string {
    return this.#path;
  }

  public close(): void {
    this.#database.close();
  }

  public readSnapshot(
    operationId: string,
  ): CollectionRunnerRehearsalOperationControlSnapshot {
    if (!ID.test(operationId)) {
      fail("INTEGRITY_FAILURE", "Operation identity is invalid.");
    }
    const authorizations = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_phase_authorizations
WHERE operation_id = ?
ORDER BY phase_plan_ordinal
`).all(operationId) as unknown as readonly Row[];
    const results = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_phase_results
WHERE operation_id = ?
ORDER BY phase_plan_ordinal
`).all(operationId) as unknown as readonly Row[];
    const stopRow = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_stop_receipts
WHERE operation_id = ?
`).get(operationId) as Row | undefined;
    const parsedAuthorizations = authorizations.map((row) =>
      verifyRecord<CollectionRunnerRehearsalOperationAuthorizationReceipt>(
        row,
        "Operation authorization",
      ),
    );
    const parsedResults = results.map((row) =>
      verifyRecord<CollectionRunnerRehearsalOperationResultReceipt>(
        row,
        "Operation result",
      ),
    );
    if (
      parsedResults.length > parsedAuthorizations.length ||
      parsedResults.some(
        (result, index) =>
          result.authorizationId !== parsedAuthorizations[index]?.authorizationId ||
          result.phasePlanOrdinal !== parsedAuthorizations[index]?.phasePlanOrdinal,
      )
    ) {
      fail("INTEGRITY_FAILURE", "Operation result chronology is invalid.");
    }
    return freeze({
      authorizationCount: parsedAuthorizations.length,
      resultCount: parsedResults.length,
      latestAuthorization:
        parsedAuthorizations[parsedAuthorizations.length - 1] ?? null,
      latestResult: parsedResults[parsedResults.length - 1] ?? null,
      stopReceipt: stopRow === undefined
        ? null
        : verifyRecord<CollectionRunnerRehearsalOperationStopReceipt>(
          stopRow,
          "Operation Stop receipt",
        ),
    });
  }

  public readHistory(operationId: string): {
    readonly authorizations:
      readonly CollectionRunnerRehearsalOperationAuthorizationReceipt[];
    readonly results: readonly CollectionRunnerRehearsalOperationResultReceipt[];
    readonly stopReceipt: CollectionRunnerRehearsalOperationStopReceipt | null;
  } {
    if (!ID.test(operationId)) {
      fail("INTEGRITY_FAILURE", "Operation identity is invalid.");
    }
    const authorizations = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_phase_authorizations
WHERE operation_id = ?
ORDER BY phase_plan_ordinal
`).all(operationId) as unknown as readonly Row[];
    const results = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_phase_results
WHERE operation_id = ?
ORDER BY phase_plan_ordinal
`).all(operationId) as unknown as readonly Row[];
    const stop = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_stop_receipts
WHERE operation_id = ?
`).get(operationId) as Row | undefined;
    return freeze({
      authorizations: authorizations.map((row) =>
        verifyRecord<CollectionRunnerRehearsalOperationAuthorizationReceipt>(
          row, "Operation authorization",
        ),
      ),
      results: results.map((row) =>
        verifyRecord<CollectionRunnerRehearsalOperationResultReceipt>(
          row, "Operation result",
        ),
      ),
      stopReceipt: stop === undefined
        ? null
        : verifyRecord<CollectionRunnerRehearsalOperationStopReceipt>(
          stop, "Operation Stop receipt",
        ),
    });
  }

  public appendValidationReceipt(
    receipt: CollectionRunnerRehearsalOperationValidationReceipt,
  ): CollectionRunnerRehearsalOperationValidationReceipt {
    validateReceipt(receipt, "Operation validation receipt");
    return this.#transaction(() => {
      const existing = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_validation_receipts
WHERE operation_id = ?
`).get(receipt.operationId) as Row | undefined;
      if (existing !== undefined) {
        const stored =
          verifyRecord<CollectionRunnerRehearsalOperationValidationReceipt>(
            existing, "Operation validation receipt",
          );
        if (stored.fingerprint === receipt.fingerprint) return stored;
        fail(
          "RESULT_CONFLICT",
          "A different operation validation receipt already exists.",
        );
      }
      this.#database.prepare(`
INSERT INTO operation_validation_receipts (
  receipt_id, operation_id, manifest_fingerprint, record_fingerprint,
  canonical_record_json
) VALUES (?, ?, ?, ?, ?)
`).run(
        receipt.receiptId,
        receipt.operationId,
        receipt.manifestFingerprint,
        receipt.fingerprint,
        JSON.stringify(receipt),
      );
      return this.readValidationReceipt(receipt.fingerprint);
    });
  }

  public appendValidationResult(
    validationReceipt: CollectionRunnerRehearsalOperationValidationReceipt,
    resultReceipt: CollectionRunnerRehearsalOperationResultReceipt,
  ): CollectionRunnerRehearsalOperationResultReceipt {
    validateReceipt(validationReceipt, "Operation validation receipt");
    validateReceipt(resultReceipt, "Operation result");
    if (
      resultReceipt.phase !== "VALIDATE" ||
      validationReceipt.operationId !== resultReceipt.operationId ||
      validationReceipt.manifestFingerprint !==
        resultReceipt.manifestFingerprint ||
      validationReceipt.fingerprint !==
        resultReceipt.authorityEvidenceFingerprint
    ) {
      fail(
        "RESULT_CONFLICT",
        "Validation receipt and operation result are not exactly bound.",
      );
    }
    return this.#transaction(() => {
      const existingValidation = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_validation_receipts
WHERE operation_id = ?
`).get(validationReceipt.operationId) as Row | undefined;
      if (existingValidation !== undefined) {
        const stored =
          verifyRecord<CollectionRunnerRehearsalOperationValidationReceipt>(
            existingValidation,
            "Operation validation receipt",
          );
        if (stored.fingerprint !== validationReceipt.fingerprint) {
          fail(
            "RESULT_CONFLICT",
            "A different operation validation receipt already exists.",
          );
        }
      } else {
        this.#database.prepare(`
INSERT INTO operation_validation_receipts (
  receipt_id, operation_id, manifest_fingerprint, record_fingerprint,
  canonical_record_json
) VALUES (?, ?, ?, ?, ?)
`).run(
          validationReceipt.receiptId,
          validationReceipt.operationId,
          validationReceipt.manifestFingerprint,
          validationReceipt.fingerprint,
          JSON.stringify(validationReceipt),
        );
      }
      this.#insertResult(resultReceipt);
      return this.#requireResult(resultReceipt.resultId);
    });
  }

  public readValidationReceipt(
    fingerprint: string,
  ): CollectionRunnerRehearsalOperationValidationReceipt {
    if (!FP.test(fingerprint)) {
      fail("INTEGRITY_FAILURE", "Validation receipt fingerprint is invalid.");
    }
    return verifyRecord<CollectionRunnerRehearsalOperationValidationReceipt>(
      this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_validation_receipts
WHERE record_fingerprint = ?
`).get(fingerprint) as Row | undefined,
      "Operation validation receipt",
    );
  }

  public authorizeAndConsume(
    receipt: CollectionRunnerRehearsalOperationAuthorizationReceipt,
  ): CollectionRunnerRehearsalOperationAuthorizationReceipt {
    validateReceipt(receipt, "Operation authorization");
    return this.#transaction(() => {
      const stop = this.#database.prepare(
        "SELECT stop_id FROM operation_stop_receipts WHERE operation_id = ?",
      ).get(receipt.operationId);
      if (stop !== undefined) {
        fail("STOP_TRIPPED", "Durable operation Stop has precedence.");
      }
      const snapshot = this.readSnapshot(receipt.operationId);
      if (
        snapshot.authorizationCount !== snapshot.resultCount ||
        receipt.phasePlanOrdinal !== snapshot.resultCount + 1
      ) {
        fail(
          "AUTHORIZATION_CONFLICT",
          "A prior authorization is unresolved or phase order changed.",
        );
      }
      try {
        this.#database.prepare(`
INSERT INTO operation_phase_authorizations (
  authorization_id, operation_id, manifest_fingerprint, command_id,
  command_fingerprint, phase, phase_plan_ordinal, process_session_id,
  consumed_at_utc, canonical_record_json, record_fingerprint
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
          receipt.authorizationId,
          receipt.operationId,
          receipt.manifestFingerprint,
          receipt.commandId,
          receipt.commandFingerprint,
          receipt.phase,
          receipt.phasePlanOrdinal,
          receipt.processSessionId,
          receipt.consumedAtUtc,
          JSON.stringify(receipt),
          receipt.fingerprint,
        );
      } catch (cause) {
        fail(
          "AUTHORIZATION_CONFLICT",
          "One-use operation authorization conflicts with durable truth.",
          cause,
        );
      }
      return this.#requireAuthorization(receipt.authorizationId);
    });
  }

  public appendResult(
    receipt: CollectionRunnerRehearsalOperationResultReceipt,
  ): CollectionRunnerRehearsalOperationResultReceipt {
    validateReceipt(receipt, "Operation result");
    return this.#transaction(() => {
      this.#insertResult(receipt);
      return this.#requireResult(receipt.resultId);
    });
  }

  public appendStop(
    receipt: CollectionRunnerRehearsalOperationStopReceipt,
  ): CollectionRunnerRehearsalOperationStopReceipt {
    validateReceipt(receipt, "Operation Stop receipt");
    return this.#transaction(() => {
      const existing = this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_stop_receipts WHERE operation_id = ?
`).get(receipt.operationId) as Row | undefined;
      if (existing !== undefined) {
        const stored = verifyRecord<CollectionRunnerRehearsalOperationStopReceipt>(
          existing,
          "Operation Stop receipt",
        );
        if (stored.fingerprint === receipt.fingerprint) return stored;
        fail("STOP_TRIPPED", "A different durable Stop already exists.");
      }
      this.#database.prepare(`
INSERT INTO operation_stop_receipts (
  stop_id, operation_id, manifest_fingerprint, command_fingerprint,
  mode, requested_at_utc, canonical_record_json, record_fingerprint
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
        receipt.stopId,
        receipt.operationId,
        receipt.manifestFingerprint,
        receipt.commandFingerprint,
        receipt.mode,
        receipt.requestedAtUtc,
        JSON.stringify(receipt),
        receipt.fingerprint,
      );
      return verifyRecord<CollectionRunnerRehearsalOperationStopReceipt>(
        this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_stop_receipts WHERE stop_id = ?
`).get(receipt.stopId) as Row | undefined,
        "Operation Stop receipt",
      );
    });
  }

  #requireAuthorization(
    authorizationId: string,
  ): CollectionRunnerRehearsalOperationAuthorizationReceipt {
    const receipt =
      verifyRecord<CollectionRunnerRehearsalOperationAuthorizationReceipt>(
      this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_phase_authorizations WHERE authorization_id = ?
`).get(authorizationId) as Row | undefined,
      "Operation authorization",
    );
    if (receipt.consumed !== true) {
      fail("INTEGRITY_FAILURE", "Operation authorization is not consumed.");
    }
    return receipt;
  }

  #insertResult(
    receipt: CollectionRunnerRehearsalOperationResultReceipt,
  ): void {
    const stop = this.#database.prepare(
      "SELECT stop_id FROM operation_stop_receipts WHERE operation_id = ?",
    ).get(receipt.operationId);
    if (stop !== undefined) {
      fail("STOP_TRIPPED", "Durable operation Stop precedes result commit.");
    }
    const authorization = this.#requireAuthorization(receipt.authorizationId);
    if (
      authorization.fingerprint !== receipt.authorizationFingerprint ||
      authorization.commandFingerprint !== receipt.commandFingerprint ||
      authorization.operationId !== receipt.operationId ||
      authorization.manifestFingerprint !== receipt.manifestFingerprint ||
      authorization.phase !== receipt.phase ||
      authorization.phasePlanOrdinal !== receipt.phasePlanOrdinal
    ) {
      fail("RESULT_CONFLICT", "Operation result does not bind its authorization.");
    }
    try {
      this.#database.prepare(`
INSERT INTO operation_phase_results (
  result_id, authorization_id, operation_id, manifest_fingerprint,
  command_fingerprint, phase, phase_plan_ordinal, disposition,
  completed_at_utc, canonical_record_json, record_fingerprint
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
        receipt.resultId,
        receipt.authorizationId,
        receipt.operationId,
        receipt.manifestFingerprint,
        receipt.commandFingerprint,
        receipt.phase,
        receipt.phasePlanOrdinal,
        receipt.disposition,
        receipt.completedAtUtc,
        JSON.stringify(receipt),
        receipt.fingerprint,
      );
    } catch (cause) {
      fail(
        "RESULT_CONFLICT",
        "Operation result conflicts with durable truth.",
        cause,
      );
    }
  }

  #requireResult(resultId: string): CollectionRunnerRehearsalOperationResultReceipt {
    return verifyRecord<CollectionRunnerRehearsalOperationResultReceipt>(
      this.#database.prepare(`
SELECT canonical_record_json, record_fingerprint
FROM operation_phase_results WHERE result_id = ?
`).get(resultId) as Row | undefined,
      "Operation result",
    );
  }

  #transaction<T>(operation: () => T): T {
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.#database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.#database.exec("ROLLBACK");
      } catch {
        // Preserve the original failure.
      }
      if (error instanceof CollectionRunnerRehearsalOperationControlStoreError) {
        throw error;
      }
      fail("TRANSACTION_FAILURE", "Operation control transaction failed.", error);
    }
  }
}
