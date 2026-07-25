import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

import {
  COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE,
  DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
  DURABLE_FIXTURE_REHEARSAL_EVIDENCE_VERSION,
  DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  DurableFixtureRehearsalEvidenceDisposition,
  DurableFixtureRehearsalLifecycleState,
  type DurableFixtureRehearsalBackupManifest,
  type DurableFixtureRehearsalBackupManifestInput,
  type DurableFixtureRehearsalEnvelopeManifest,
  type DurableFixtureRehearsalEnvelopeManifestInput,
  type DurableFixtureRehearsalEnvelopeVerificationResult,
  type DurableFixtureRehearsalFrozenEvidence,
  type DurableFixtureRehearsalValidationReceipt,
  type DurableFixtureRehearsalValidationReceiptInput,
} from "../../contracts";
import {
  inspectCollectionRunnerFixtureRehearsalSqliteProfile,
} from "../../repositories/EventContractCollectionRunnerFixtureRehearsalSqliteMigrationV3";
import {
  createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository,
} from "../../repositories/SqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository";
import { verifyDurableFixtureRehearsalSnapshot } from "./EventContractCollectionRunnerDurableFixtureRehearsalEngine";

const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const MAX_JSON_BYTES = 2_000_000;
const PACKAGE_FILES = Object.freeze([
  "build-record.json",
  "evidence-package.json",
  "evidence-plan.json",
  "snapshot.json",
  "validation-receipt.json",
] as const);

export enum DurableFixtureRehearsalEvidenceErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  ValidationFailed = "VALIDATION_FAILED",
  UnsafeRoot = "UNSAFE_ROOT",
  StateConflict = "STATE_CONFLICT",
  EnvelopeConflict = "ENVELOPE_CONFLICT",
  VerificationFailed = "VERIFICATION_FAILED",
}

export class DurableFixtureRehearsalEvidenceError extends Error {
  public constructor(
    public readonly code: DurableFixtureRehearsalEvidenceErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "DurableFixtureRehearsalEvidenceError";
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
  const hash = createHash("sha256");
  if (typeof value === "string") hash.update(value);
  else if (value instanceof Uint8Array) hash.update(value);
  else hash.update(canonical(value));
  return `sha256:${hash.digest("hex")}`;
}

function seal<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value as object)) seal(nested);
    Object.freeze(value);
  }
  return value;
}

function exact(value: object, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonical(actual) !== canonical(expected)) {
    throw new DurableFixtureRehearsalEvidenceError(
      DurableFixtureRehearsalEvidenceErrorCode.InvalidRequest,
      `${label} does not match the closed contract.`,
    );
  }
}

function contained(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function safeRoot(path: string, repositoryRoot?: string): string {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink()) {
    throw new DurableFixtureRehearsalEvidenceError(
      DurableFixtureRehearsalEvidenceErrorCode.UnsafeRoot,
      "Registered evidence root is missing or substituted.",
    );
  }
  const root = realpathSync(path);
  if (!lstatSync(root).isDirectory() || root === resolve(root, sep)) {
    throw new DurableFixtureRehearsalEvidenceError(
      DurableFixtureRehearsalEvidenceErrorCode.UnsafeRoot,
      "Registered evidence root is unsafe.",
    );
  }
  if (repositoryRoot !== undefined) {
    const repository = realpathSync(repositoryRoot);
    if (contained(root, repository) || contained(repository, root)) {
      throw new DurableFixtureRehearsalEvidenceError(
        DurableFixtureRehearsalEvidenceErrorCode.UnsafeRoot,
        "Evidence root must be disjoint from the repository.",
      );
    }
  }
  return root;
}

function regular(path: string): void {
  if (
    !existsSync(path) ||
    lstatSync(path).isSymbolicLink() ||
    !lstatSync(path).isFile()
  ) {
    throw new Error("Required evidence file is missing or substituted.");
  }
}

function forbidden(value: unknown): boolean {
  const forbiddenKey =
    /^(credential|secret|cookie|header|url|rawPayload|payload|account|portfolio|pnl|position|probability|recommendation|broker|order|execution)$/iu;
  if (typeof value === "string") {
    return /(?:https?:\/\/|bearer\s|api[_-]?key|private[_-]?key|session[_-]?cookie)/iu.test(value);
  }
  if (Array.isArray(value)) return value.some(forbidden);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(
    ([key, nested]) => forbiddenKey.test(key) || forbidden(nested),
  );
}

function writeJson(path: string, value: unknown): number {
  const text = `${canonical(value)}\n`;
  const byteLength = new TextEncoder().encode(text).length;
  if (byteLength > MAX_JSON_BYTES) throw new Error("Evidence JSON exceeds its bound.");
  const handle = openSync(path, "wx");
  try {
    writeFileSync(handle, text, { encoding: "utf8" });
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  return byteLength;
}

function fileIdentity(path: string): string {
  const stat = statSync(path, { bigint: true });
  return sha({
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    size: stat.size.toString(),
    modifiedNanoseconds: stat.mtimeNs.toString(),
  });
}

export function createDurableFixtureRehearsalValidationReceipt(
  input: DurableFixtureRehearsalValidationReceiptInput,
): DurableFixtureRehearsalValidationReceipt {
  exact(input, [
    "receiptId", "rehearsalId", "manifestFingerprint", "repositoryCommit",
    "validationPolicyVersion", "validationSuiteFingerprint",
    "registeredTestTotal", "exitStatus", "startedAtUtc", "endedAtUtc",
    "sanitizedOutputDigest",
  ], "validation receipt");
  if (
    !ID.test(input.receiptId) ||
    !ID.test(input.rehearsalId) ||
    !FP.test(input.manifestFingerprint) ||
    !COMMIT.test(input.repositoryCommit) ||
    input.validationPolicyVersion !== DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY ||
    !FP.test(input.validationSuiteFingerprint) ||
    !Number.isSafeInteger(input.registeredTestTotal) ||
    input.registeredTestTotal < 1 ||
    !Number.isSafeInteger(input.exitStatus) ||
    !UTC.test(input.startedAtUtc) ||
    !UTC.test(input.endedAtUtc) ||
    input.endedAtUtc < input.startedAtUtc ||
    !FP.test(input.sanitizedOutputDigest)
  ) throw new DurableFixtureRehearsalEvidenceError(
    DurableFixtureRehearsalEvidenceErrorCode.InvalidRequest,
    "Validation receipt is invalid.",
  );
  const body = { ...structuredClone(input), passed: input.exitStatus === 0, deterministic: true as const };
  return seal({ ...body, fingerprint: sha(body) });
}

export function createDurableFixtureRehearsalBackupManifest(
  input: DurableFixtureRehearsalBackupManifestInput,
): DurableFixtureRehearsalBackupManifest {
  exact(input, [
    "backupId", "rehearsalId", "manifestFingerprint", "storeIdentity",
    "schemaProfile", "migrationNames", "schemaCatalogChecksum",
    "terminalFreezeFingerprint", "sourceFileIdentity", "backupFileIdentity",
    "pageCount", "backupBytes", "backupDigest", "createdAtUtc",
    "retentionPolicyVersion", "nonAuthorityDeclaration",
  ], "backup manifest");
  if (
    !ID.test(input.backupId) || !ID.test(input.rehearsalId) ||
    !FP.test(input.manifestFingerprint) || !FP.test(input.storeIdentity) ||
    input.schemaProfile !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE ||
    canonical(input.migrationNames) !== canonical([
      "001_collection_runner_core",
      "002_collection_runner_recovery_control",
      "003_fixture_rehearsal_durability",
    ]) ||
    [input.schemaCatalogChecksum, input.terminalFreezeFingerprint,
      input.sourceFileIdentity, input.backupFileIdentity, input.backupDigest]
      .some((value) => !FP.test(value)) ||
    !Number.isSafeInteger(input.pageCount) || input.pageCount < 1 ||
    !Number.isSafeInteger(input.backupBytes) || input.backupBytes < 1 ||
    !UTC.test(input.createdAtUtc) ||
    input.nonAuthorityDeclaration !== DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY
  ) throw new DurableFixtureRehearsalEvidenceError(
    DurableFixtureRehearsalEvidenceErrorCode.InvalidRequest,
    "Backup manifest is invalid.",
  );
  const body = { ...structuredClone(input), deterministic: true as const };
  return seal({ ...body, fingerprint: sha(body) });
}

export function createDurableFixtureRehearsalEnvelopeManifest(
  input: DurableFixtureRehearsalEnvelopeManifestInput,
): DurableFixtureRehearsalEnvelopeManifest {
  exact(input, [
    "envelopeId", "rehearsalId", "manifestFingerprint",
    "evidencePlanFingerprint", "backupManifestFingerprint",
    "validationReceiptFingerprint", "snapshotFingerprint", "backupBytes",
    "backupDigest", "packageBytesExcludingBackup", "packageInventory",
    "publishedAtUtc", "nonAuthorityDeclaration",
  ], "envelope manifest");
  if (
    !ID.test(input.envelopeId) || !ID.test(input.rehearsalId) ||
    [input.manifestFingerprint, input.evidencePlanFingerprint,
      input.backupManifestFingerprint, input.validationReceiptFingerprint,
      input.snapshotFingerprint, input.backupDigest]
      .some((value) => !FP.test(value)) ||
    !Number.isSafeInteger(input.backupBytes) || input.backupBytes < 1 ||
    !Number.isSafeInteger(input.packageBytesExcludingBackup) ||
    input.packageBytesExcludingBackup < 1 ||
    !UTC.test(input.publishedAtUtc) ||
    input.nonAuthorityDeclaration !== DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY
  ) throw new DurableFixtureRehearsalEvidenceError(
    DurableFixtureRehearsalEvidenceErrorCode.InvalidRequest,
    "Envelope manifest is invalid.",
  );
  const body = { ...structuredClone(input), deterministic: true as const };
  return seal({ ...body, fingerprint: sha(body) });
}

export interface DurableFixtureRehearsalValidationRequest {
  readonly receiptId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly startedAtUtc: string;
  readonly endedAtUtc: string;
}

export class FixedLocalDurableFixtureRehearsalValidationAdapter {
  public constructor(
    private readonly repositoryRoot: string,
    private readonly registeredRepositoryCommit: string,
    private readonly registeredTestTotal: number,
    private readonly validationSuiteFingerprint: string,
  ) {
    if (
      !COMMIT.test(registeredRepositoryCommit) ||
      !Number.isSafeInteger(registeredTestTotal) ||
      registeredTestTotal < 1 ||
      !FP.test(validationSuiteFingerprint)
    ) throw new DurableFixtureRehearsalEvidenceError(
      DurableFixtureRehearsalEvidenceErrorCode.InvalidRequest,
      "Registered validation identity is invalid.",
    );
  }

  public run(request: DurableFixtureRehearsalValidationRequest):
    DurableFixtureRehearsalValidationReceipt {
    exact(request, [
      "receiptId", "rehearsalId", "manifestFingerprint", "startedAtUtc",
      "endedAtUtc",
    ], "validation request");
    const processOptions = {
      cwd: this.repositoryRoot, input: "", encoding: "utf8" as const,
      shell: false as const, timeout: 600_000, maxBuffer: 16 * 1024 * 1024,
      windowsHide: true, killSignal: "SIGTERM" as const,
    };
    const commit = spawnSync("git", ["rev-parse", "HEAD"], processOptions);
    const clean = spawnSync("git", ["status", "--porcelain"], processOptions);
    const suiteHash = createHash("sha256");
    suiteHash.update(readFileSync(join(this.repositoryRoot, "scripts", "alpha-validate.mjs")));
    suiteHash.update(readFileSync(join(this.repositoryRoot, "package.json")));
    const suite = `sha256:${suiteHash.digest("hex")}`;
    if (
      commit.status !== 0 ||
      commit.stdout.trim() !== this.registeredRepositoryCommit ||
      clean.status !== 0 ||
      clean.stdout.trim() !== "" ||
      suite !== this.validationSuiteFingerprint
    ) throw new DurableFixtureRehearsalEvidenceError(
      DurableFixtureRehearsalEvidenceErrorCode.ValidationFailed,
      "Repository identity, cleanliness, or fixed validation suite changed.",
    );
    const execution = spawnSync("npm.cmd", ["run", "alpha:validate"], {
      cwd: this.repositoryRoot,
      input: "",
      encoding: "utf8",
      shell: false,
      timeout: 600_000,
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      killSignal: "SIGTERM",
    });
    const output = `${execution.stdout ?? ""}\n${execution.stderr ?? ""}`
      .replaceAll(realpathSync(this.repositoryRoot), "<repository>");
    const receipt = createDurableFixtureRehearsalValidationReceipt({
      ...request,
      repositoryCommit: commit.stdout.trim(),
      validationPolicyVersion: DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
      validationSuiteFingerprint: suite,
      registeredTestTotal: this.registeredTestTotal,
      exitStatus: execution.status ?? -1,
      sanitizedOutputDigest: sha(output),
    });
    const totalPattern = new RegExp(
      `"testsExecuted"\\s*:\\s*${this.registeredTestTotal}(?:\\D|$)`,
      "u",
    );
    if (!receipt.passed || !totalPattern.test(output) || !/"failed"\s*:\s*0(?:\D|$)/u.test(output)) {
      throw new DurableFixtureRehearsalEvidenceError(
        DurableFixtureRehearsalEvidenceErrorCode.ValidationFailed,
        "Fixed local validation did not prove the registered passing total.",
      );
    }
    return receipt;
  }
}

export interface DurableFixtureRehearsalEnvelopeRoot {
  readonly evidenceRootId: string;
  readonly path: string;
}

export interface DurableFixtureRehearsalSourceStore {
  readonly storeId: string;
  readonly path: string;
  readonly schemaCatalogChecksum: string;
}

export interface DurableFixtureRehearsalEnvelopeBuildRequest {
  readonly evidenceRootId: string;
  readonly storeId: string;
  readonly envelopeId: string;
  readonly publishedAtUtc: string;
  readonly frozenEvidence: DurableFixtureRehearsalFrozenEvidence;
}

export interface DurableFixtureRehearsalEnvelopeBuildObserver {
  reached(
    checkpoint:
      | "BACKUP_DURABLE"
      | "ENVELOPE_STAGED"
      | "ENVELOPE_PUBLISHED",
  ): void;
}

export class DurableFixtureRehearsalEnvelopeBuilder {
  readonly #roots: ReadonlyMap<string, string>;
  readonly #stores: ReadonlyMap<string, DurableFixtureRehearsalSourceStore>;

  public constructor(
    repositoryRoot: string,
    roots: readonly DurableFixtureRehearsalEnvelopeRoot[],
    stores: readonly DurableFixtureRehearsalSourceStore[],
    private readonly observer?: DurableFixtureRehearsalEnvelopeBuildObserver,
  ) {
    this.#roots = new Map(roots.map((item) => [
      item.evidenceRootId,
      safeRoot(item.path, repositoryRoot),
    ]));
    this.#stores = new Map(stores.map((item) => [item.storeId, item]));
  }

  public async build(request: DurableFixtureRehearsalEnvelopeBuildRequest):
    Promise<DurableFixtureRehearsalEnvelopeManifest> {
    exact(request, ["evidenceRootId", "storeId", "envelopeId", "publishedAtUtc", "frozenEvidence"], "envelope request");
    const root = this.#roots.get(request.evidenceRootId);
    const store = this.#stores.get(request.storeId);
    if (
      root === undefined || store === undefined || !ID.test(request.envelopeId) ||
      !UTC.test(request.publishedAtUtc)
    ) throw new DurableFixtureRehearsalEvidenceError(
      DurableFixtureRehearsalEvidenceErrorCode.InvalidRequest,
      "Envelope request identity is invalid.",
    );
    const { evidencePlan, validationReceipt, snapshot } = request.frozenEvidence;
    if (
      snapshot.registry.lifecycleState !== DurableFixtureRehearsalLifecycleState.EvidenceFrozen ||
      !verifyDurableFixtureRehearsalSnapshot(snapshot).valid ||
      evidencePlan.fingerprint !== snapshot.evidencePlan?.fingerprint ||
      evidencePlan.validationReceiptFingerprint !== validationReceipt.fingerprint ||
      !validationReceipt.passed ||
      evidencePlan.plannedEnvelopeId !== request.envelopeId
    ) throw new DurableFixtureRehearsalEvidenceError(
      DurableFixtureRehearsalEvidenceErrorCode.StateConflict,
      "Only exact verified frozen evidence may be packaged.",
    );
    regular(store.path);
    const sourceReadiness = inspectCollectionRunnerFixtureRehearsalSqliteProfile({
      rootDirectory: dirname(store.path),
      storeId: basename(store.path, ".sqlite3"),
    });
    if (sourceReadiness.schemaCatalogChecksum !== store.schemaCatalogChecksum) {
      throw new DurableFixtureRehearsalEvidenceError(
        DurableFixtureRehearsalEvidenceErrorCode.StateConflict,
        "Registered source schema identity changed.",
      );
    }
    const finalDirectory = join(root, `rehearsal-${request.envelopeId}-evidence`);
    const staging = `${finalDirectory}.staging`;
    if (existsSync(finalDirectory)) {
      throw new DurableFixtureRehearsalEvidenceError(
        DurableFixtureRehearsalEvidenceErrorCode.EnvelopeConflict,
        "Envelope identity already exists and will not be overwritten.",
      );
    }
    if (existsSync(staging)) {
      const quarantine = `${staging}.quarantine-${sha({
        envelopeId: request.envelopeId,
        publishedAtUtc: request.publishedAtUtc,
      }).slice(-16)}`;
      if (existsSync(quarantine)) {
        throw new DurableFixtureRehearsalEvidenceError(
          DurableFixtureRehearsalEvidenceErrorCode.EnvelopeConflict,
          "Incomplete envelope quarantine identity already exists.",
        );
      }
      renameSync(staging, quarantine);
    }
    mkdirSync(join(staging, "backup"), { recursive: true });
    mkdirSync(join(staging, "package"));
    const backupPath = join(staging, "backup", "runner.sqlite3");
    const source = new DatabaseSync(store.path, {
      readOnly: true, defensive: true, enableForeignKeyConstraints: true,
    });
    try {
      const sourceSnapshot =
        createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(
          source,
        ).readSnapshot(snapshot.registry.rehearsalId);
      if (sourceSnapshot === null || canonical(sourceSnapshot) !== canonical(snapshot)) {
        throw new DurableFixtureRehearsalEvidenceError(
          DurableFixtureRehearsalEvidenceErrorCode.StateConflict,
          "Frozen source does not match the supplied durable snapshot.",
        );
      }
      await backup(source, backupPath);
    } finally {
      source.close();
    }
    const backupDatabase = new DatabaseSync(backupPath, {
      readOnly: false, defensive: true, enableForeignKeyConstraints: true,
    });
    let pageCount: number;
    try {
      backupDatabase.exec("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;");
      pageCount = Number(Object.values(
        backupDatabase.prepare("PRAGMA page_count").get() ?? {},
      )[0]);
    } finally {
      backupDatabase.close();
    }
    const backupBytes = statSync(backupPath).size;
    const backupDigest = sha(readFileSync(backupPath));
    this.observer?.reached("BACKUP_DURABLE");
    const backupManifest = createDurableFixtureRehearsalBackupManifest({
      backupId: evidencePlan.plannedBackupId,
      rehearsalId: snapshot.registry.rehearsalId,
      manifestFingerprint: snapshot.registry.manifestFingerprint,
      storeIdentity: snapshot.registry.storeIdentity,
      schemaProfile: COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE,
      migrationNames: [
        "001_collection_runner_core",
        "002_collection_runner_recovery_control",
        "003_fixture_rehearsal_durability",
      ],
      schemaCatalogChecksum: store.schemaCatalogChecksum,
      terminalFreezeFingerprint: evidencePlan.terminalFreezeFingerprint,
      sourceFileIdentity: fileIdentity(store.path),
      backupFileIdentity: fileIdentity(backupPath),
      pageCount,
      backupBytes,
      backupDigest,
      createdAtUtc: request.publishedAtUtc,
      retentionPolicyVersion: evidencePlan.retentionPolicyVersion,
      nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
    });
    writeJson(join(staging, "backup", "backup-manifest.json"), backupManifest);
    const packageValues: Record<(typeof PACKAGE_FILES)[number], unknown> = {
      "validation-receipt.json": validationReceipt,
      "evidence-plan.json": evidencePlan,
      "snapshot.json": snapshot,
      "evidence-package.json": {
        version: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_VERSION,
        rehearsalId: snapshot.registry.rehearsalId,
        manifestFingerprint: snapshot.registry.manifestFingerprint,
        scenarioResultFingerprint: snapshot.registry.scenarioResultFingerprint,
        executionPackageFingerprint: snapshot.registry.executionPackageFingerprint,
        backupManifestFingerprint: backupManifest.fingerprint,
        nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
      },
      "build-record.json": {
        evidencePlanFingerprint: evidencePlan.fingerprint,
        validationReceiptFingerprint: validationReceipt.fingerprint,
        snapshotFingerprint: sha(snapshot),
      },
    };
    const inventory = [];
    let packageBytes = 0;
    for (const name of PACKAGE_FILES) {
      const value = packageValues[name];
      const path = join(staging, "package", name);
      const byteLength = writeJson(path, value);
      packageBytes += byteLength;
      inventory.push({ relativePath: `package/${name}`, byteLength, digest: sha(readFileSync(path)) });
    }
    const manifest = createDurableFixtureRehearsalEnvelopeManifest({
      envelopeId: request.envelopeId,
      rehearsalId: snapshot.registry.rehearsalId,
      manifestFingerprint: snapshot.registry.manifestFingerprint,
      evidencePlanFingerprint: evidencePlan.fingerprint,
      backupManifestFingerprint: backupManifest.fingerprint,
      validationReceiptFingerprint: validationReceipt.fingerprint,
      snapshotFingerprint: sha(snapshot),
      backupBytes,
      backupDigest,
      packageBytesExcludingBackup: packageBytes,
      packageInventory: inventory,
      publishedAtUtc: request.publishedAtUtc,
      nonAuthorityDeclaration: DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY,
    });
    writeJson(join(staging, "envelope-manifest.json"), manifest);
    this.observer?.reached("ENVELOPE_STAGED");
    renameSync(staging, finalDirectory);
    this.observer?.reached("ENVELOPE_PUBLISHED");
    return manifest;
  }
}

function verification(
  disposition: DurableFixtureRehearsalEvidenceDisposition,
  issues: readonly string[],
  envelopeFingerprint: string | null,
  manifestFingerprint: string | null,
  scenarioResultFingerprint: string | null,
): DurableFixtureRehearsalEnvelopeVerificationResult {
  const body = {
    disposition, issueCodes: [...new Set(issues)].sort(), envelopeFingerprint,
    manifestFingerprint, scenarioResultFingerprint, deterministic: true as const,
  };
  return seal({ ...body, fingerprint: sha(body) });
}

export class DurableFixtureRehearsalFreshProcessVerifier {
  readonly #roots: ReadonlyMap<string, string>;
  public constructor(roots: readonly DurableFixtureRehearsalEnvelopeRoot[]) {
    this.#roots = new Map(roots.map((item) => [
      item.evidenceRootId, safeRoot(item.path),
    ]));
  }

  public verify(
    evidenceRootId: string,
    expectedEnvelopeFingerprint: string,
    expectedManifestFingerprint: string,
  ): DurableFixtureRehearsalEnvelopeVerificationResult {
    let stage = "REQUEST";
    try {
      const root = this.#roots.get(evidenceRootId);
      if (root === undefined || !FP.test(expectedEnvelopeFingerprint) || !FP.test(expectedManifestFingerprint)) {
        return verification(DurableFixtureRehearsalEvidenceDisposition.FailClosed, ["INVALID_VERIFIER_REQUEST"], null, null, null);
      }
      const candidates = readdirSync(root)
        .filter((name) => name.startsWith("rehearsal-") && name.endsWith("-evidence"))
        .map((name) => join(root, name));
      const matches = candidates.filter((directory) => {
        try {
          const value = JSON.parse(readFileSync(join(directory, "envelope-manifest.json"), "utf8")) as { fingerprint?: unknown };
          return value.fingerprint === expectedEnvelopeFingerprint;
        } catch { return false; }
      });
      if (matches.length === 0) return verification(DurableFixtureRehearsalEvidenceDisposition.Incomplete, ["ENVELOPE_MISSING"], null, null, null);
      if (matches.length !== 1) return verification(DurableFixtureRehearsalEvidenceDisposition.FailClosed, ["ENVELOPE_IDENTITY_AMBIGUOUS"], null, null, null);
      stage = "FILE_SET";
      const directory = realpathSync(matches[0]!);
      if (!contained(root, directory) || lstatSync(directory).isSymbolicLink()) throw new Error();
      const top = readdirSync(directory).sort();
      if (canonical(top) !== canonical(["backup", "envelope-manifest.json", "package"])) throw new Error();
      const backupNames = readdirSync(join(directory, "backup")).sort();
      const packageNames = readdirSync(join(directory, "package")).sort();
      const backupMissing = !backupNames.includes("runner.sqlite3");
      if (
        canonical(backupNames) !== canonical(
          backupMissing
            ? ["backup-manifest.json"]
            : ["backup-manifest.json", "runner.sqlite3"],
        ) ||
        canonical(packageNames) !== canonical([...PACKAGE_FILES].sort())
      ) throw new Error();
      const envelope = JSON.parse(readFileSync(join(directory, "envelope-manifest.json"), "utf8")) as DurableFixtureRehearsalEnvelopeManifest;
      stage = "ENVELOPE_MANIFEST";
      const { deterministic: _ed, fingerprint: _ef, ...envelopeInput } = envelope;
      const rebuiltEnvelope = createDurableFixtureRehearsalEnvelopeManifest(envelopeInput);
      if (
        envelope.deterministic !== true ||
        envelope.fingerprint !== rebuiltEnvelope.fingerprint ||
        rebuiltEnvelope.fingerprint !== expectedEnvelopeFingerprint ||
        envelope.manifestFingerprint !== expectedManifestFingerprint
      ) throw new Error();
      const expectedInventory = PACKAGE_FILES.map((name) => `package/${name}`).sort();
      if (
        canonical(envelope.packageInventory.map(({ relativePath }) => relativePath).sort()) !==
        canonical(expectedInventory)
      ) throw new Error();
      let packageBytes = 0;
      stage = "PACKAGE";
      for (const entry of envelope.packageInventory) {
        const path = resolve(directory, entry.relativePath);
        regular(path);
        if (!contained(directory, path) || statSync(path).size !== entry.byteLength || sha(readFileSync(path)) !== entry.digest) throw new Error();
        packageBytes += entry.byteLength;
        if (forbidden(JSON.parse(readFileSync(path, "utf8")))) throw new Error();
      }
      if (packageBytes !== envelope.packageBytesExcludingBackup) throw new Error();
      const backupPath = join(directory, "backup", "runner.sqlite3");
      if (backupMissing || !existsSync(backupPath)) {
        return verification(
          DurableFixtureRehearsalEvidenceDisposition.Incomplete,
          ["BACKUP_MISSING"],
          envelope.fingerprint,
          envelope.manifestFingerprint,
          null,
        );
      }
      regular(backupPath);
      stage = "BACKUP_MANIFEST";
      if (statSync(backupPath).size !== envelope.backupBytes || sha(readFileSync(backupPath)) !== envelope.backupDigest) throw new Error();
      const backupManifestPath = join(directory, "backup", "backup-manifest.json");
      regular(backupManifestPath);
      const backupManifest = JSON.parse(
        readFileSync(backupManifestPath, "utf8"),
      ) as DurableFixtureRehearsalBackupManifest;
      const { deterministic: _bd, fingerprint: _bf, ...backupInput } = backupManifest;
      const rebuiltBackup = createDurableFixtureRehearsalBackupManifest(backupInput);
      if (
        backupManifest.deterministic !== true ||
        backupManifest.fingerprint !== rebuiltBackup.fingerprint ||
        rebuiltBackup.fingerprint !== envelope.backupManifestFingerprint ||
        backupManifest.backupBytes !== envelope.backupBytes ||
        backupManifest.backupDigest !== envelope.backupDigest ||
        backupManifest.manifestFingerprint !== expectedManifestFingerprint
      ) throw new Error();
      const validation = JSON.parse(
        readFileSync(join(directory, "package", "validation-receipt.json"), "utf8"),
      ) as DurableFixtureRehearsalValidationReceipt;
      const { deterministic: _vd, fingerprint: _vf, passed: _vp, ...validationInput } = validation;
      const rebuiltValidation =
        createDurableFixtureRehearsalValidationReceipt(validationInput);
      if (
        validation.deterministic !== true ||
        validation.passed !== rebuiltValidation.passed ||
        validation.fingerprint !== rebuiltValidation.fingerprint ||
        !rebuiltValidation.passed ||
        rebuiltValidation.fingerprint !== envelope.validationReceiptFingerprint
      ) throw new Error();
      stage = "BACKUP_PROFILE";
      inspectCollectionRunnerFixtureRehearsalSqliteProfile({
        rootDirectory: join(directory, "backup"),
        storeId: "runner",
      });
      const database = new DatabaseSync(backupPath, {
        readOnly: true, defensive: true, enableForeignKeyConstraints: true,
      });
      try {
        stage = "DURABLE_SNAPSHOT";
        const snapshotJson = JSON.parse(readFileSync(join(directory, "package", "snapshot.json"), "utf8")) as DurableFixtureRehearsalFrozenEvidence["snapshot"];
        const snapshot = createSqliteEventContractCollectionRunnerDurableFixtureRehearsalRepository(database)
          .readSnapshot(snapshotJson.registry.rehearsalId);
        if (
          snapshot === null ||
          !verifyDurableFixtureRehearsalSnapshot(snapshot).valid ||
          sha(snapshot) !== envelope.snapshotFingerprint ||
          canonical(snapshot) !== canonical(snapshotJson)
        ) throw new Error();
        const scalar = (sql: string, ...parameters: readonly unknown[]): number =>
          Number(Object.values(database.prepare(sql).get(...parameters) ?? {})[0]);
        const activationId = snapshot.registry.activationId;
        if (
          scalar(
            "SELECT COUNT(*) FROM pilot_activations WHERE activation_id = ? AND current_state = 'COMPLETED'",
            activationId,
          ) !== 1 ||
          scalar(
            "SELECT COUNT(*) FROM scheduled_tasks WHERE activation_id = ?",
            activationId,
          ) < 1 ||
          scalar(
            "SELECT COUNT(*) FROM scheduled_tasks WHERE activation_id = ? AND current_state NOT IN ('COMMITTED','MISSED','TERMINAL_FAILED','CANCELLED')",
            activationId,
          ) !== 0 ||
          scalar(
            "SELECT COUNT(*) FROM task_leases l JOIN scheduled_tasks t ON t.task_id = l.task_id WHERE t.activation_id = ?",
            activationId,
          ) !== 0 ||
          scalar(`
SELECT COUNT(*) FROM attempt_records a
JOIN scheduled_tasks t ON t.task_id = a.task_id
LEFT JOIN attempt_results r ON r.attempt_id = a.attempt_id
WHERE t.activation_id = ? AND r.attempt_id IS NULL
`, activationId) !== 0 ||
          scalar(`
SELECT COUNT(*) FROM scheduled_tasks t
LEFT JOIN normalized_source_evidence e ON e.task_id = t.task_id
WHERE t.activation_id = ? AND t.current_state = 'COMMITTED' AND e.evidence_id IS NULL
`, activationId) !== 0 ||
          scalar(
            "SELECT COUNT(*) FROM activation_budget_counters WHERE activation_id = ? AND evidence_committed >= 1",
            activationId,
          ) !== 1 ||
          scalar(
            "SELECT COUNT(*) FROM transactional_outbox WHERE aggregate_id IN (SELECT task_id FROM scheduled_tasks WHERE activation_id = ?)",
            activationId,
          ) < 1
        ) throw new Error();
        return verification(
          DurableFixtureRehearsalEvidenceDisposition.Pass, [],
          envelope.fingerprint, envelope.manifestFingerprint,
          snapshot.registry.scenarioResultFingerprint,
        );
      } finally {
        database.close();
      }
    } catch {
      return verification(
        DurableFixtureRehearsalEvidenceDisposition.FailClosed,
        [`EVIDENCE_VERIFICATION_FAILED_${stage}`],
        null,
        null,
        null,
      );
    }
  }
}
