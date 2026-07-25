import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { env } from "node:process";
import { dirname, join, resolve, sep } from "node:path";

import {
  COLLECTION_RUNNER_REHEARSAL_MAX_JSON_BYTES,
  COLLECTION_RUNNER_REHEARSAL_MAX_PACKAGE_BYTES,
  COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
  CollectionRunnerRehearsalLifecycleState,
  CollectionRunnerRehearsalVerificationDisposition,
  type CollectionRunnerRehearsalEvidencePackage,
  type CollectionRunnerRehearsalLifecycleTransition,
  type CollectionRunnerRehearsalOutboxIdentity,
  type CollectionRunnerRehearsalPackageInventoryEntry,
  type CollectionRunnerRehearsalPreparationResult,
  type CollectionRunnerRehearsalStepResult,
  type CollectionRunnerRehearsalTerminalSummary,
  type CollectionRunnerRehearsalVerificationResult,
} from "../../contracts";
import {
  createCollectionRunnerRehearsalEvidencePackage,
  createCollectionRunnerRehearsalLifecycleTransition,
  verifyCollectionRunnerRehearsalEvidencePackage,
} from "./EventContractCollectionRunnerFixtureRehearsalEngine";
import { createCollectionRunnerRuntimeTerminalReport } from "../event-contract-collection-runner-runtime";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ARTIFACT_FILES = Object.freeze([
  "archive.json",
  "backup-evidence.json",
  "catalog-identity.json",
  "invocation-receipts.json",
  "lifecycle.json",
  "manifest.json",
  "non-authority.json",
  "outbox-index.json",
  "ownership-receipts.json",
  "preparation-receipt.json",
  "recovery-reports.json",
  "sqlite-verification.json",
  "terminal-reports.json",
  "terminal-summary.json",
  "validation.json",
] as const);
const CONTROL_FILES = Object.freeze([
  "build-record.json",
  "evidence-package.json",
] as const);

export enum CollectionRunnerRehearsalPackageErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  UnsafeRoot = "UNSAFE_ROOT",
  StateConflict = "STATE_CONFLICT",
  PackageConflict = "PACKAGE_CONFLICT",
  LeakageDetected = "LEAKAGE_DETECTED",
  VerificationFailed = "VERIFICATION_FAILED",
}

export class CollectionRunnerRehearsalPackageError extends Error {
  public constructor(
    public readonly code: CollectionRunnerRehearsalPackageErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerRehearsalPackageError";
  }
}

export interface CollectionRunnerRehearsalPackageEvidence {
  readonly terminalSummary: CollectionRunnerRehearsalTerminalSummary;
  readonly outboxRecords: readonly CollectionRunnerRehearsalOutboxIdentity[];
  readonly recoveryReportFingerprints: readonly string[];
  readonly ownershipReceiptIds: readonly string[];
  readonly sqliteQuickCheckPassed: boolean;
  readonly sqliteIntegrityCheckPassed: boolean;
  readonly backupManifestFingerprint: string;
  readonly backupDigest: string;
  readonly validationSuiteFingerprint: string;
  readonly validationPassed: boolean;
  readonly archiveDisposition: string;
}

export interface CollectionRunnerRehearsalPackageBuildRequest {
  readonly preparation: CollectionRunnerRehearsalPreparationResult;
  readonly stepResults: readonly CollectionRunnerRehearsalStepResult[];
  readonly evidence: CollectionRunnerRehearsalPackageEvidence;
  readonly packageRootId: string;
  readonly packageCreatedAtUtc: string;
  readonly stopBarrierTripped: boolean;
}

export interface CollectionRunnerRehearsalPackageRoot {
  readonly packageRootId: string;
  readonly path: string;
}

export interface CollectionRunnerRehearsalPackageBuildObserver {
  reached(checkpoint: "ARTIFACTS_DURABLE" | "PACKAGE_COMMITTED"): void;
}

export interface CollectionRunnerRehearsalPackageEvidenceVerifierPort {
  verifyBoundEvidence(
    preparation: CollectionRunnerRehearsalPreparationResult,
    evidence: CollectionRunnerRehearsalPackageEvidence,
  ): boolean;
}

export interface CollectionRunnerRehearsalPackageBuildResult {
  readonly packageDirectory: string;
  readonly evidencePackage: CollectionRunnerRehearsalEvidencePackage;
  readonly verification: CollectionRunnerRehearsalVerificationResult;
  readonly replayed: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}

interface PackageBuildRecord {
  readonly requestFingerprint: string;
  readonly packageFingerprint: string;
  readonly inventoryFingerprint: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function shaBytes(value: string | Uint8Array): string {
  const hash = createHash("sha256");
  if (typeof value === "string") hash.update(value, "utf8");
  else hash.update(value);
  return `sha256:${hash.digest("hex")}`;
}

function sha(value: unknown): string {
  return shaBytes(canonical(value));
}

function freeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function fail(
  code: CollectionRunnerRehearsalPackageErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new CollectionRunnerRehearsalPackageError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function exact(value: unknown, keys: readonly string[], label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, `${label} does not match the closed contract.`);
  }
}

function canonicalRoot(path: string, label: string): string {
  if (path.trim() === "" || path.includes("\0") || path.startsWith("\\\\") || path.startsWith("//")) {
    fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, `${label} is unsafe.`);
  }
  const requested = resolve(path);
  if (!existsSync(requested)) fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, `${label} must already exist.`);
  const entry = lstatSync(requested);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, `${label} must be a real directory.`);
  }
  const actual = realpathSync(requested);
  if (actual.toLocaleLowerCase() !== requested.toLocaleLowerCase()) {
    fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, `${label} may not traverse a substituted path.`);
  }
  const userProfile = env.USERPROFILE ?? env.HOME;
  if (
    dirname(actual).toLocaleLowerCase() === actual.toLocaleLowerCase() ||
    (userProfile !== undefined &&
      actual.toLocaleLowerCase() === resolve(userProfile).toLocaleLowerCase())
  ) fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, `${label} is too broad.`);
  return actual;
}

function contained(parent: string, child: string): boolean {
  return child.toLocaleLowerCase().startsWith(`${parent.toLocaleLowerCase()}${sep.toLocaleLowerCase()}`);
}

function writeExclusive(path: string, value: unknown): number {
  const text = `${canonical(value)}\n`;
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > COLLECTION_RUNNER_REHEARSAL_MAX_JSON_BYTES) {
    fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, "Package JSON artifact exceeds the reviewed bound.");
  }
  const descriptor = openSync(path, "wx");
  try {
    writeFileSync(descriptor, text, { encoding: "utf8" });
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  return bytes;
}

function forbidden(value: unknown): boolean {
  const forbiddenKey = /^(credential|secret|cookie|header|url|rawPayload|payload|account|portfolio|pnl|position|probability|recommendation|broker|order|execution)$/iu;
  if (typeof value === "string") {
    return /(?:https?:\/\/|bearer\s|api[_-]?key|private[_-]?key|session[_-]?cookie)/iu.test(value);
  }
  if (Array.isArray(value)) return value.some(forbidden);
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).some(([key, nested]) => forbiddenKey.test(key) || forbidden(nested));
}

function verification(
  disposition: CollectionRunnerRehearsalVerificationDisposition,
  issueCodes: readonly string[],
  scenarioResultFingerprint: string | null,
): CollectionRunnerRehearsalVerificationResult {
  const body = {
    disposition,
    issueCodes: [...new Set(issueCodes)].sort(),
    scenarioResultFingerprint,
    deterministic: true as const,
  };
  return freeze({ ...body, fingerprint: sha(body) }) as CollectionRunnerRehearsalVerificationResult;
}

function parseJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export class EventContractCollectionRunnerFixtureRehearsalPackageVerifier {
  public verify(packageDirectory: string): CollectionRunnerRehearsalVerificationResult {
    try {
      const canonicalDirectory = realpathSync(packageDirectory);
      const names = (nodeFs as unknown as {
        readdirSync(path: string): string[];
      }).readdirSync(canonicalDirectory).sort();
      const expectedNames = [...ARTIFACT_FILES, ...CONTROL_FILES].sort();
      if (expectedNames.some((name) => !names.includes(name))) {
        return verification(CollectionRunnerRehearsalVerificationDisposition.Incomplete, ["PACKAGE_FILE_SET_INCOMPLETE"], null);
      }
      if (names.length !== expectedNames.length) {
        return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["PACKAGE_FILE_SET_MISMATCH"], null);
      }
      const value = parseJson(join(canonicalDirectory, "evidence-package.json")) as CollectionRunnerRehearsalEvidencePackage;
      const pure = verifyCollectionRunnerRehearsalEvidencePackage(value);
      if (pure.disposition !== CollectionRunnerRehearsalVerificationDisposition.Pass) return pure;
      const inventoryNames = value.inventory.map((entry) => entry.relativePath).sort();
      if (
        inventoryNames.length !== ARTIFACT_FILES.length ||
        inventoryNames.some((name, index) => name !== ARTIFACT_FILES[index])
      ) {
        return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["INVENTORY_FILE_SET_MISMATCH"], pure.scenarioResultFingerprint);
      }
      let packageBytes = 0;
      const artifacts = new Map<string, unknown>();
      for (const entry of value.inventory) {
        const artifactPath = resolve(canonicalDirectory, entry.relativePath);
        if (!contained(canonicalDirectory, artifactPath) || !existsSync(artifactPath)) {
          return verification(CollectionRunnerRehearsalVerificationDisposition.Incomplete, ["ARTIFACT_MISSING"], pure.scenarioResultFingerprint);
        }
        const stats = statSync(artifactPath);
        const bytes = readFileSync(artifactPath);
        packageBytes += stats.size;
        if (!lstatSync(artifactPath).isFile() || stats.size !== entry.byteLength || shaBytes(bytes) !== entry.digest) {
          return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["ARTIFACT_DIGEST_MISMATCH"], pure.scenarioResultFingerprint);
        }
        const artifact = parseJson(artifactPath);
        artifacts.set(entry.relativePath, artifact);
        if (forbidden(artifact)) {
          return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["EXCLUDED_DATA_PRESENT"], pure.scenarioResultFingerprint);
        }
      }
      if (packageBytes !== value.packageBytesExcludingBackup) {
        return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["PACKAGE_BYTE_COUNT_MISMATCH"], pure.scenarioResultFingerprint);
      }
      const build = parseJson(join(canonicalDirectory, "build-record.json")) as PackageBuildRecord;
      const buildKeys = Object.keys(build).sort();
      if (
        canonical(buildKeys) !== canonical(["inventoryFingerprint", "packageFingerprint", "requestFingerprint"]) ||
        forbidden(build) ||
        !FP.test(build.requestFingerprint) ||
        build.packageFingerprint !== value.fingerprint ||
        build.inventoryFingerprint !== sha(value.inventory)
      ) {
        return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["BUILD_RECORD_MISMATCH"], pure.scenarioResultFingerprint);
      }
      if (!this.#artifactsBindEnvelope(artifacts, value)) {
        return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["ARTIFACT_SEMANTIC_MISMATCH"], pure.scenarioResultFingerprint);
      }
      return pure;
    } catch {
      return verification(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["MALFORMED_PACKAGE_DIRECTORY"], null);
    }
  }

  #artifactsBindEnvelope(
    artifacts: ReadonlyMap<string, unknown>,
    value: CollectionRunnerRehearsalEvidencePackage,
  ): boolean {
    try {
      const expected: Readonly<Record<string, unknown>> = {
        "archive.json": { disposition: value.archiveDisposition },
        "backup-evidence.json": {
          manifestFingerprint: value.backupManifestFingerprint,
          backupDigest: value.backupDigest,
        },
        "invocation-receipts.json": value.invocationReceipts,
        "lifecycle.json": value.lifecycleTransitions,
        "manifest.json": value.manifest,
        "non-authority.json": { declaration: value.nonAuthorityDeclaration },
        "outbox-index.json": value.outboxRecords,
        "ownership-receipts.json": value.ownershipReceiptIds,
        "preparation-receipt.json": value.preparationReceipt,
        "recovery-reports.json": value.recoveryReportFingerprints,
        "sqlite-verification.json": {
          quickCheckPassed: value.sqliteQuickCheckPassed,
          integrityCheckPassed: value.sqliteIntegrityCheckPassed,
        },
        "terminal-summary.json": value.terminalSummary,
        "validation.json": {
          suiteFingerprint: value.validationSuiteFingerprint,
          passed: value.validationPassed,
        },
      };
      for (const [path, expectedValue] of Object.entries(expected)) {
        if (canonical(artifacts.get(path)) !== canonical(expectedValue)) return false;
      }
      const catalog = artifacts.get("catalog-identity.json") as Record<string, unknown>;
      if (
        canonical(Object.keys(catalog).sort()) !== canonical(["catalogEntryId", "fingerprint"]) ||
        typeof catalog.catalogEntryId !== "string" ||
        !ID.test(catalog.catalogEntryId) ||
        catalog.fingerprint !== value.fixtureCatalogEntryFingerprint
      ) return false;
      const reports = artifacts.get("terminal-reports.json");
      if (!Array.isArray(reports) || reports.length !== value.terminalReportFingerprints.length) return false;
      return reports.every((report, index) => {
        if (typeof report !== "object" || report === null || Array.isArray(report)) return false;
        const {
          deterministic,
          fingerprint,
          ...input
        } = report as unknown as import("../../contracts").CollectionRunnerRuntimeTerminalReport;
        const verified = createCollectionRunnerRuntimeTerminalReport(input);
        return deterministic === true &&
          verified.fingerprint === fingerprint &&
          fingerprint === value.terminalReportFingerprints[index];
      });
    } catch {
      return false;
    }
  }
}

export class EventContractCollectionRunnerFixtureRehearsalPackageBuilder {
  readonly #roots: ReadonlyMap<string, string>;

  public constructor(
    repositoryRoot: string,
    roots: readonly CollectionRunnerRehearsalPackageRoot[],
    private readonly evidenceVerifier: CollectionRunnerRehearsalPackageEvidenceVerifierPort,
    private readonly verifier = new EventContractCollectionRunnerFixtureRehearsalPackageVerifier(),
    private readonly observer?: CollectionRunnerRehearsalPackageBuildObserver,
  ) {
    const repository = canonicalRoot(repositoryRoot, "Repository root");
    const entries = roots.map((root) => {
      exact(root, ["packageRootId", "path"], "package root");
      if (!ID.test(root.packageRootId)) fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, "Package root identity is invalid.");
      const packageRoot = canonicalRoot(root.path, "Package root");
      if (
        packageRoot.toLocaleLowerCase() === repository.toLocaleLowerCase() ||
        contained(repository, packageRoot) ||
        contained(packageRoot, repository)
      ) fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, "Package root must be disjoint from the repository.");
      return [root.packageRootId, packageRoot] as const;
    });
    if (new Set(entries.map(([id]) => id)).size !== entries.length) {
      fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, "Package root identities must be unique.");
    }
    if (new Set(entries.map(([, path]) => path.toLocaleLowerCase())).size !== entries.length) {
      fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, "Package root paths must be unique.");
    }
    this.#roots = new Map(entries);
  }

  public build(request: CollectionRunnerRehearsalPackageBuildRequest): CollectionRunnerRehearsalPackageBuildResult {
    this.#validate(request);
    if (request.stopBarrierTripped) {
      fail(CollectionRunnerRehearsalPackageErrorCode.StateConflict, "Stop barrier blocks package construction.");
    }
    try {
      if (!this.evidenceVerifier.verifyBoundEvidence(request.preparation, request.evidence)) {
        fail(CollectionRunnerRehearsalPackageErrorCode.VerificationFailed, "Bound SQLite, backup, and validation evidence did not verify.");
      }
    } catch (error) {
      if (error instanceof CollectionRunnerRehearsalPackageError) throw error;
      fail(CollectionRunnerRehearsalPackageErrorCode.VerificationFailed, "Bound evidence verification failed closed.", error);
    }
    const root = this.#roots.get(request.packageRootId);
    if (root === undefined) fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, "Package root is not registered.");
    const suffix = request.preparation.manifest.fingerprint.slice(7, 31);
    const packageDirectory = resolve(root, `rehearsal-${suffix}-evidence`);
    const stagingDirectory = resolve(root, `rehearsal-${suffix}-evidence.staging`);
    if (!contained(root, packageDirectory) || !contained(root, stagingDirectory)) {
      fail(CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot, "Resolved package path escapes its registered root.");
    }
    const requestFingerprint = sha(request);
    if (existsSync(packageDirectory)) return this.#replay(packageDirectory, requestFingerprint);
    if (existsSync(stagingDirectory)) {
      const quarantine = resolve(root, `rehearsal-${suffix}-evidence.quarantine-${requestFingerprint.slice(7, 19)}`);
      if (existsSync(quarantine)) fail(CollectionRunnerRehearsalPackageErrorCode.PackageConflict, "Incomplete package quarantine already exists.");
      renameSync(stagingDirectory, quarantine);
    }
    mkdirSync(stagingDirectory, { recursive: false });
    try {
      const lifecycle = this.#lifecycle(request);
      const artifacts = this.#artifacts(request, lifecycle);
      if (Object.values(artifacts).some(forbidden)) {
        fail(CollectionRunnerRehearsalPackageErrorCode.LeakageDetected, "Excluded data was found in package artifacts.");
      }
      const inventory: CollectionRunnerRehearsalPackageInventoryEntry[] = [];
      let packageBytes = 0;
      for (const relativePath of ARTIFACT_FILES) {
        const value = artifacts[relativePath];
        const path = join(stagingDirectory, relativePath);
        const byteLength = writeExclusive(path, value);
        const digest = shaBytes(readFileSync(path));
        packageBytes += byteLength;
        inventory.push({ relativePath, byteLength, digest });
      }
      if (packageBytes > COLLECTION_RUNNER_REHEARSAL_MAX_PACKAGE_BYTES) {
        fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, "Evidence package exceeds the reviewed bound.");
      }
      this.observer?.reached("ARTIFACTS_DURABLE");
      const evidencePackage = createCollectionRunnerRehearsalEvidencePackage({
        manifest: request.preparation.manifest,
        fixtureCatalogEntryFingerprint: request.preparation.catalogEntry.fingerprint,
        preparationReceipt: request.preparation.preparationReceipt,
        lifecycleTransitions: lifecycle,
        invocationReceipts: request.stepResults.map((result) => result.invocationReceipt),
        terminalReportFingerprints: request.stepResults.map((result) => result.terminalReport.fingerprint),
        recoveryReportFingerprints: request.evidence.recoveryReportFingerprints,
        ownershipReceiptIds: request.evidence.ownershipReceiptIds,
        terminalSummary: request.evidence.terminalSummary,
        outboxRecords: request.evidence.outboxRecords,
        sqliteQuickCheckPassed: request.evidence.sqliteQuickCheckPassed,
        sqliteIntegrityCheckPassed: request.evidence.sqliteIntegrityCheckPassed,
        backupManifestFingerprint: request.evidence.backupManifestFingerprint,
        backupDigest: request.evidence.backupDigest,
        validationSuiteFingerprint: request.evidence.validationSuiteFingerprint,
        validationPassed: request.evidence.validationPassed,
        archiveDisposition: request.evidence.archiveDisposition,
        inventory,
        packageBytesExcludingBackup: packageBytes,
        workspaceIdentity: request.preparation.workspace.workspaceIdentity,
        storeIdentity: request.preparation.runtimePaths.storePathIdentity,
        packageCreatedAtUtc: request.packageCreatedAtUtc,
        nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
      });
      if (
        verifyCollectionRunnerRehearsalEvidencePackage(evidencePackage).disposition !==
        CollectionRunnerRehearsalVerificationDisposition.Pass
      ) {
        fail(CollectionRunnerRehearsalPackageErrorCode.VerificationFailed, "Package contract preflight did not pass.");
      }
      writeExclusive(join(stagingDirectory, "evidence-package.json"), evidencePackage);
      writeExclusive(join(stagingDirectory, "build-record.json"), {
        requestFingerprint,
        packageFingerprint: evidencePackage.fingerprint,
        inventoryFingerprint: sha(evidencePackage.inventory),
      } satisfies PackageBuildRecord);
      renameSync(stagingDirectory, packageDirectory);
      this.observer?.reached("PACKAGE_COMMITTED");
      return this.#verifiedResult(packageDirectory, evidencePackage, false);
    } catch (error) {
      throw error instanceof CollectionRunnerRehearsalPackageError
        ? error
        : new CollectionRunnerRehearsalPackageError(
            CollectionRunnerRehearsalPackageErrorCode.VerificationFailed,
            "Package construction failed closed.",
            { cause: error },
          );
    }
  }

  #validate(request: CollectionRunnerRehearsalPackageBuildRequest): void {
    exact(request, ["preparation", "stepResults", "evidence", "packageRootId", "packageCreatedAtUtc", "stopBarrierTripped"], "package request");
    exact(request.evidence, ["terminalSummary", "outboxRecords", "recoveryReportFingerprints", "ownershipReceiptIds", "sqliteQuickCheckPassed", "sqliteIntegrityCheckPassed", "backupManifestFingerprint", "backupDigest", "validationSuiteFingerprint", "validationPassed", "archiveDisposition"], "package evidence");
    if (!ID.test(request.packageRootId) || !UTC.test(request.packageCreatedAtUtc) || typeof request.stopBarrierTripped !== "boolean") {
      fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, "Package request identity or time is invalid.");
    }
    const manifest = request.preparation.manifest;
    if (
      request.preparation.catalogEntry.catalogFingerprint !== manifest.fixtureCatalogFingerprint ||
      request.preparation.catalogEntry.fixturePackageFingerprint !== manifest.fixturePackageFingerprint ||
      request.preparation.catalogEntry.fingerprint !==
        request.preparation.preparationReceipt.fixtureCatalogEntryFingerprint
    ) {
      fail(CollectionRunnerRehearsalPackageErrorCode.StateConflict, "Prepared fixture catalog identities do not match the manifest and receipt.");
    }
    if (
      request.stepResults.length !== manifest.expectedInvocations.length ||
      request.stepResults.some((result, index) =>
        result.replayed ||
        result.request.rehearsalId !== manifest.rehearsalId ||
        result.request.manifestFingerprint !== manifest.fingerprint ||
        result.request.expectedInvocationOrdinal !== index + 1 ||
        result.invocationReceipt.ordinal !== index + 1
      )
    ) fail(CollectionRunnerRehearsalPackageErrorCode.StateConflict, "Step results do not form one complete exact sequence.");
    const final = request.stepResults.at(-1);
    if (final?.resultingLifecycleState !== CollectionRunnerRehearsalLifecycleState.Completed) {
      fail(CollectionRunnerRehearsalPackageErrorCode.StateConflict, "Only a completed rehearsal can be packaged.");
    }
    for (const value of [
      request.evidence.backupManifestFingerprint,
      request.evidence.backupDigest,
      request.evidence.validationSuiteFingerprint,
    ]) if (!FP.test(value)) fail(CollectionRunnerRehearsalPackageErrorCode.InvalidRequest, "Package evidence fingerprint is invalid.");
  }

  #lifecycle(request: CollectionRunnerRehearsalPackageBuildRequest): readonly CollectionRunnerRehearsalLifecycleTransition[] {
    const transitions = [
      request.preparation.lifecycleTransition,
      ...request.stepResults.flatMap((result) => result.lifecycleTransitions),
    ];
    const final = request.stepResults.at(-1)!;
    return [
      ...transitions,
      createCollectionRunnerRehearsalLifecycleTransition({
        rehearsalId: request.preparation.manifest.rehearsalId,
        manifestFingerprint: request.preparation.manifest.fingerprint,
        ordinal: request.stepResults.length,
        fromState: CollectionRunnerRehearsalLifecycleState.Completed,
        fromVersion: final.resultingLifecycleVersion,
        toState: CollectionRunnerRehearsalLifecycleState.Packaged,
        reasonCode: "EVIDENCE_PACKAGE_COMMITTED",
      }),
    ];
  }

  #artifacts(
    request: CollectionRunnerRehearsalPackageBuildRequest,
    lifecycle: readonly CollectionRunnerRehearsalLifecycleTransition[],
  ): Record<(typeof ARTIFACT_FILES)[number], unknown> {
    return {
      "archive.json": { disposition: request.evidence.archiveDisposition },
      "backup-evidence.json": {
        manifestFingerprint: request.evidence.backupManifestFingerprint,
        backupDigest: request.evidence.backupDigest,
      },
      "catalog-identity.json": {
        catalogEntryId: request.preparation.catalogEntry.catalogEntryId,
        fingerprint: request.preparation.catalogEntry.fingerprint,
      },
      "invocation-receipts.json": request.stepResults.map((result) => result.invocationReceipt),
      "lifecycle.json": lifecycle,
      "manifest.json": request.preparation.manifest,
      "non-authority.json": { declaration: COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION },
      "outbox-index.json": request.evidence.outboxRecords,
      "ownership-receipts.json": request.evidence.ownershipReceiptIds,
      "preparation-receipt.json": request.preparation.preparationReceipt,
      "recovery-reports.json": request.evidence.recoveryReportFingerprints,
      "sqlite-verification.json": {
        quickCheckPassed: request.evidence.sqliteQuickCheckPassed,
        integrityCheckPassed: request.evidence.sqliteIntegrityCheckPassed,
      },
      "terminal-reports.json": request.stepResults.map((result) => result.terminalReport),
      "terminal-summary.json": request.evidence.terminalSummary,
      "validation.json": {
        suiteFingerprint: request.evidence.validationSuiteFingerprint,
        passed: request.evidence.validationPassed,
      },
    };
  }

  #replay(packageDirectory: string, requestFingerprint: string): CollectionRunnerRehearsalPackageBuildResult {
    const record = parseJson(join(packageDirectory, "build-record.json")) as PackageBuildRecord;
    if (record.requestFingerprint !== requestFingerprint) {
      fail(CollectionRunnerRehearsalPackageErrorCode.PackageConflict, "Changed package replay is forbidden.");
    }
    const evidencePackage = parseJson(join(packageDirectory, "evidence-package.json")) as CollectionRunnerRehearsalEvidencePackage;
    if (record.packageFingerprint !== evidencePackage.fingerprint) {
      fail(CollectionRunnerRehearsalPackageErrorCode.PackageConflict, "Package replay identity is inconsistent.");
    }
    return this.#verifiedResult(packageDirectory, evidencePackage, true);
  }

  #verifiedResult(
    packageDirectory: string,
    evidencePackage: CollectionRunnerRehearsalEvidencePackage,
    replayed: boolean,
  ): CollectionRunnerRehearsalPackageBuildResult {
    const checked = this.verifier.verify(packageDirectory);
    if (checked.disposition !== CollectionRunnerRehearsalVerificationDisposition.Pass) {
      fail(CollectionRunnerRehearsalPackageErrorCode.VerificationFailed, "Independent package verification did not pass.");
    }
    const body = {
      packageDirectory,
      evidencePackage,
      verification: checked,
      replayed,
      deterministic: true as const,
    };
    return freeze({ ...body, fingerprint: sha(body) }) as CollectionRunnerRehearsalPackageBuildResult;
  }
}
