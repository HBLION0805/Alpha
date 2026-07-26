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
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { env, execPath } from "node:process";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_VALIDATION_POLICY,
  CollectionRunnerRehearsalOperationVerificationDisposition,
  DurableFixtureRehearsalEvidenceDisposition,
  type CollectionRunnerRehearsalOperationFinalVerificationReport,
  type CollectionRunnerRehearsalOperationFinalVerificationRequest,
  type CollectionRunnerRehearsalOperationValidationReceipt,
  type CollectionRunnerRehearsalOperationValidationRequest,
  type CollectionRunnerRehearsalOperationValidationAuthority,
  type CollectionRunnerRehearsalOperationAuthorizationReceipt,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommand,
  type CollectionRunnerRehearsalOperationPhaseEvidence,
  type CollectionRunnerRehearsalOperationResultReceipt,
  type CollectionRunnerRehearsalOperationStopReceipt,
  type DurableFixtureRehearsalEnvelopeVerificationResult,
} from "../../contracts";
import {
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationResultDisposition,
} from "../../contracts";
import {
  DurableFixtureRehearsalFreshProcessVerifier,
  type DurableFixtureRehearsalEnvelopeRoot,
  type DurableFixtureRehearsalValidationAuthority,
} from "../event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence";
import {
  EventContractCollectionRunnerFixtureRehearsalSqliteStore,
} from "../../repositories/EventContractCollectionRunnerFixtureRehearsalSqliteStore";
import {
  EventContractCollectionRunnerRehearsalOperationControlSqliteStore,
} from "../../repositories/EventContractCollectionRunnerRehearsalOperationControlSqliteStore";
import {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation/EventContractCollectionRunnerRehearsalOperationEngine";
import type {
  CollectionRunnerRehearsalOperationFixedGitPort,
} from "./EventContractCollectionRunnerRehearsalOperationPreflight";

const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const DIGEST_INPUT_BYTES = 64 * 1024;
const PROCESS_MARKER = "ALPHA_FIXED_VALIDATION_PROCESS";
const FINAL_VERIFY_PROCESS_MARKER = "ALPHA_REHEARSAL_FINAL_VERIFY_PROCESS";

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function sha(value: string | Uint8Array | object): string {
  const bytes = typeof value === "string" || value instanceof Uint8Array
    ? value
    : canonical(value);
  const hash = createHash("sha256");
  if (typeof bytes === "string") hash.update(bytes, "utf8");
  else hash.update(bytes);
  return `sha256:${hash.digest("hex")}`;
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

export interface FixedLocalFileIdentity {
  readonly canonicalPath: string;
  readonly fingerprint: string;
  assertCurrent(): void;
}

export class DigestBoundLocalFileIdentity implements FixedLocalFileIdentity {
  public readonly canonicalPath: string;
  public readonly fingerprint: string;

  public constructor(path: string, expectedFingerprint?: string) {
    if (!existsSync(path)) throw new Error("Registered local file is unavailable.");
    const status = lstatSync(path);
    const canonicalPath = realpathSync(path);
    const fingerprint = sha(readFileSync(canonicalPath));
    if (
      !status.isFile() ||
      status.isSymbolicLink() ||
      (
        expectedFingerprint !== undefined &&
        expectedFingerprint !== fingerprint
      )
    ) {
      throw new Error("Registered local file identity is invalid.");
    }
    this.canonicalPath = canonicalPath;
    this.fingerprint = fingerprint;
    Object.freeze(this);
  }

  public assertCurrent(): void {
    const status = lstatSync(this.canonicalPath);
    if (
      !status.isFile() ||
      status.isSymbolicLink() ||
      realpathSync(this.canonicalPath) !== this.canonicalPath ||
      sha(readFileSync(this.canonicalPath)) !== this.fingerprint
    ) {
      throw new Error("Registered local file identity changed.");
    }
  }
}

function exact(value: unknown, keys: readonly string[]): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Request does not match the closed contract.");
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) throw new Error("Request does not match the closed contract.");
}

export interface FixedValidationProcessResult {
  readonly status: number | null;
  readonly signal: string | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly errorCode: string | null;
}

export interface FixedValidationProcessPort {
  run(
    executable: string,
    args: readonly string[],
    options: {
      readonly cwd: string;
      readonly environment: Readonly<Record<string, string>>;
      readonly timeoutMs: number;
      readonly maxOutputBytes: number;
    },
  ): FixedValidationProcessResult;
}

class LocalFixedValidationProcess implements FixedValidationProcessPort {
  public run(
    executable: string,
    args: readonly string[],
    options: {
      readonly cwd: string;
      readonly environment: Readonly<Record<string, string>>;
      readonly timeoutMs: number;
      readonly maxOutputBytes: number;
    },
  ): FixedValidationProcessResult {
    const result = spawnSync(executable, [...args], {
      cwd: options.cwd,
      env: options.environment,
      input: "",
      encoding: "utf8",
      shell: false,
      timeout: options.timeoutMs,
      windowsHide: true,
      maxBuffer: options.maxOutputBytes,
      killSignal: "SIGTERM",
    });
    return {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      errorCode: result.error?.code ?? null,
    };
  }
}

function isolatedEnvironment(
  repositoryRoot: string,
  git: CollectionRunnerRehearsalOperationFixedGitPort,
  node: FixedLocalFileIdentity,
  python: FixedLocalFileIdentity,
  nodeGuard: FixedLocalFileIdentity,
  pythonGuard: FixedLocalFileIdentity,
): Readonly<Record<string, string>> {
  const allowed = [
    "PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR",
    "TEMP", "TMP", "TMPDIR", "ComSpec",
  ] as const;
  const clean: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof env[key] === "string") clean[key] = env[key]!;
  }
  clean[PROCESS_MARKER] = "1";
  for (const identity of [node, python, nodeGuard, pythonGuard]) {
    identity.assertCurrent();
  }
  clean.ALPHA_NETWORK_DISABLED = "1";
  clean.ALPHA_VALIDATION_REPOSITORY_ROOT = repositoryRoot;
  clean.ALPHA_FIXED_GIT_EXECUTABLE = git.canonicalExecutablePath;
  clean.ALPHA_FIXED_GIT_FINGERPRINT = git.executableFingerprint;
  clean.ALPHA_ALLOWED_NODE_EXECUTABLE = node.canonicalPath;
  clean.ALPHA_ALLOWED_NODE_FINGERPRINT = node.fingerprint;
  clean.ALPHA_ALLOWED_GIT_EXECUTABLE = git.canonicalExecutablePath;
  clean.ALPHA_ALLOWED_GIT_FINGERPRINT = git.executableFingerprint;
  clean.ALPHA_ALLOWED_PYTHON_EXECUTABLE = python.canonicalPath;
  clean.ALPHA_ALLOWED_PYTHON_FINGERPRINT = python.fingerprint;
  clean.ALPHA_PYTHON_EXECUTABLE = python.canonicalPath;
  clean.ALPHA_NODE_GUARD_PATH = nodeGuard.canonicalPath;
  clean.ALPHA_NODE_GUARD_FINGERPRINT = nodeGuard.fingerprint;
  clean.ALPHA_PYTHON_GUARD_PATH = pythonGuard.canonicalPath;
  clean.ALPHA_PYTHON_GUARD_FINGERPRINT = pythonGuard.fingerprint;
  clean.NODE_OPTIONS = `--require=${nodeGuard.canonicalPath}`;
  clean.PYTHONPATH = dirname(pythonGuard.canonicalPath);
  clean.GIT_CONFIG_NOSYSTEM = "1";
  clean.GIT_CONFIG_GLOBAL = "NUL";
  clean.NO_PROXY = "*";
  clean.no_proxy = "*";
  return freeze(clean);
}

function alphaValidationInvocation(
  repositoryRoot: string,
): { readonly executable: string; readonly args: readonly string[] } {
  const validationEntry = realpathSync(
    join(repositoryRoot, "scripts", "alpha-validate.mjs"),
  );
  return {
    executable: realpathSync(execPath),
    args: [validationEntry],
  };
}

function parseOverall(output: string): {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
} {
  const matches = [...output.matchAll(
    /"overall"\s*:\s*\{\s*"testsExecuted"\s*:\s*(\d+)\s*,\s*"passed"\s*:\s*(\d+)\s*,\s*"failed"\s*:\s*(\d+)/gu,
  )];
  if (matches.length !== 1) throw new Error("Validation accounting is missing or ambiguous.");
  const values = matches[0]!.slice(1, 4).map(Number);
  if (values.some((value) => !Number.isSafeInteger(value))) {
    throw new Error("Validation accounting is unsafe.");
  }
  return { total: values[0]!, passed: values[1]!, failed: values[2]! };
}

export class FixedActualAlphaValidationAdapter {
  readonly #node: FixedLocalFileIdentity;
  readonly #python: FixedLocalFileIdentity;
  readonly #nodeGuard: FixedLocalFileIdentity;
  readonly #pythonGuard: FixedLocalFileIdentity;

  public constructor(
    private readonly repositoryRoot: string,
    private readonly registry: CollectionRunnerRehearsalOperationRegistry,
    private readonly git: CollectionRunnerRehearsalOperationFixedGitPort,
    private readonly pythonExecutablePath: string,
    private readonly process: FixedValidationProcessPort =
      new LocalFixedValidationProcess(),
    private readonly endedAtUtc: () => string = () => new Date().toISOString(),
  ) {
    this.#node = new DigestBoundLocalFileIdentity(execPath);
    this.#python = new DigestBoundLocalFileIdentity(pythonExecutablePath);
    this.#nodeGuard = new DigestBoundLocalFileIdentity(
      join(repositoryRoot, "scripts", "network-disabled-bootstrap.cjs"),
    );
    this.#pythonGuard = new DigestBoundLocalFileIdentity(
      join(
        repositoryRoot,
        "scripts",
        "network-disabled-python",
        "sitecustomize.py",
      ),
    );
  }

  public run(
    request: CollectionRunnerRehearsalOperationValidationRequest,
  ): CollectionRunnerRehearsalOperationValidationReceipt {
    exact(request, [
      "receiptId", "operationId", "manifestFingerprint", "startedAtUtc",
    ]);
    if (
      !ID.test(request.receiptId) ||
      !ID.test(request.operationId) ||
      !FP.test(request.manifestFingerprint) ||
      !UTC.test(request.startedAtUtc) ||
      env[PROCESS_MARKER] === "1"
    ) throw new Error("Validation request or recursion state is invalid.");
    const manifest = this.registry.getOperation(request.operationId);
    if (manifest === null || manifest.fingerprint !== request.manifestFingerprint) {
      throw new Error("Validation request is not bound to the registered manifest.");
    }
    const authority = this.registry.getValidationAuthority(
      manifest.proposal.validationAuthorityFingerprint,
    );
    if (authority === null) throw new Error("Validation authority is unavailable.");
    this.#assertAuthority(authority);
    const rootRegistration = this.registry.getRoot(authority.repositoryRootId);
    if (rootRegistration === null) throw new Error("Alpha repository root is unavailable.");
    const root = realpathSync(this.repositoryRoot);
    if (root !== realpathSync(rootRegistration.canonicalPath)) {
      throw new Error("Actual Alpha repository root does not match the registry.");
    }
    const fixed = {
      cwd: root,
      environment: isolatedEnvironment(
        root,
        this.git,
        this.#node,
        this.#python,
        this.#nodeGuard,
        this.#pythonGuard,
      ),
      timeoutMs: 600_000,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    };
    const commit = this.git.run(root, ["rev-parse", "HEAD"]);
    const clean = this.git.run(
      root,
      ["status", "--porcelain", "--untracked-files=all"],
    );
    const packageBytes = readFileSync(join(root, "package.json"));
    const validationBytes = readFileSync(join(root, "scripts", "alpha-validate.mjs"));
    const networkGuardBytes = readFileSync(
      join(root, "scripts", "network-disabled-bootstrap.cjs"),
    );
    const pythonNetworkGuardBytes = readFileSync(
      join(root, "scripts", "network-disabled-python", "sitecustomize.py"),
    );
    const suiteHash = createHash("sha256")
      .update(validationBytes)
      .update(networkGuardBytes)
      .update(pythonNetworkGuardBytes)
      .update(packageBytes)
      .digest("hex");
    if (
      commit.status !== 0 || commit.errorCode !== null ||
      clean.status !== 0 || clean.errorCode !== null ||
      commit.stdout.trim() !== authority.alphaCommit ||
      clean.stdout.trim() !== "" ||
      sha(packageBytes) !== authority.packageFingerprint ||
      `sha256:${suiteHash}` !== authority.validationSuiteFingerprint
    ) throw new Error("Repository, commit, tree, package, or suite identity drifted.");
    const invocation = alphaValidationInvocation(root);
    for (
      const identity of [
        this.#node,
        this.#python,
        this.#nodeGuard,
        this.#pythonGuard,
      ]
    ) {
      identity.assertCurrent();
    }
    const result = this.process.run(invocation.executable, invocation.args, fixed);
    for (
      const identity of [
        this.#node,
        this.#python,
        this.#nodeGuard,
        this.#pythonGuard,
      ]
    ) {
      identity.assertCurrent();
    }
    const raw = `${result.stdout}\n${result.stderr}`;
    const outputBytes = new TextEncoder().encode(raw).byteLength;
    if (
      result.status !== 0 ||
      result.signal !== null ||
      result.errorCode !== null ||
      outputBytes > MAX_OUTPUT_BYTES
    ) throw new Error("Fixed Alpha validation process failed closed.");
    const counts = parseOverall(raw);
    if (
      counts.total !== authority.registeredTestTotal ||
      counts.passed !== authority.registeredTestTotal ||
      counts.failed !== 0
    ) throw new Error("Alpha validation total does not match exact authority.");
    const endedAtUtc = this.endedAtUtc();
    if (!UTC.test(endedAtUtc) || Date.parse(endedAtUtc) < Date.parse(request.startedAtUtc)) {
      throw new Error("Validation time boundary is invalid.");
    }
    const sanitized = raw
      .replaceAll(root, "<alpha-repository>")
      .slice(0, DIGEST_INPUT_BYTES);
    const body = {
      ...request,
      rehearsalId: manifest.proposal.rehearsalId,
      validationAuthorityFingerprint: authority.fingerprint,
      repositoryCommit: authority.alphaCommit,
      packageFingerprint: authority.packageFingerprint,
      validationSuiteFingerprint: authority.validationSuiteFingerprint,
      validationPolicyVersion:
        COLLECTION_RUNNER_REHEARSAL_OPERATION_VALIDATION_POLICY,
      recursionPolicyVersion:
        COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
      registeredTestTotal: authority.registeredTestTotal,
      passedCount: counts.passed,
      failedCount: counts.failed,
      exitStatus: result.status,
      endedAtUtc,
      sanitizedOutputDigest: sha(sanitized),
      outputBytes,
      networkPermitted: false as const,
      credentialAccessPermitted: false as const,
      passed: true as const,
    };
    return freeze({
      ...body,
      deterministic: true as const,
      fingerprint: sha(body),
    });
  }

  #assertAuthority(
    authority: CollectionRunnerRehearsalOperationValidationAuthority,
  ): void {
    if (
      authority.cleanTreeRequired !== true ||
      authority.networkPermitted !== false ||
      authority.credentialAccessPermitted !== false ||
      authority.recursionPolicyVersion !==
        COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY ||
      !COMMIT.test(authority.alphaCommit)
    ) throw new Error("Validation authority policy is not the fixed T4 policy.");
  }
}

/**
 * Append-only local bridge between the actual validation process and the
 * independent query-only phase observer. An interrupted validation may leave
 * an orphan file, but that file can never authorize a Control result.
 */
export class FixedOperationValidationReceiptJournal {
  public readonly root: string;

  public constructor(root: string) {
    mkdirSync(root, { recursive: true });
    this.root = realpathSync(root);
    Object.freeze(this);
  }

  public append(
    authorizationId: string,
    receipt: CollectionRunnerRehearsalOperationValidationReceipt,
  ): void {
    if (
      !ID.test(authorizationId) ||
      receipt.deterministic !== true ||
      receipt.fingerprint !== sha(validationReceiptBody(receipt))
    ) throw new Error("Validation journal receipt is invalid.");
    const descriptor = openSync(this.#path(authorizationId), "wx");
    try {
      writeFileSync(descriptor, `${JSON.stringify(receipt)}\n`, {
        encoding: "utf8",
      });
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }

  public read(
    authorizationId: string,
  ): CollectionRunnerRehearsalOperationValidationReceipt {
    if (!ID.test(authorizationId)) {
      throw new Error("Validation journal authorization is invalid.");
    }
    const receipt = JSON.parse(
      readFileSync(this.#path(authorizationId), "utf8"),
    ) as CollectionRunnerRehearsalOperationValidationReceipt;
    if (
      receipt.deterministic !== true ||
      receipt.fingerprint !== sha(validationReceiptBody(receipt))
    ) throw new Error("Validation journal receipt integrity failed.");
    return freeze(receipt);
  }

  #path(authorizationId: string): string {
    return join(this.root, `validation-${sha(authorizationId).slice(7)}.json`);
  }
}

export interface CollectionRunnerRehearsalValidationLifecycleSnapshot {
  readonly lifecycleVersion: number;
  readonly lifecycleFingerprint: string;
}

export interface CollectionRunnerRehearsalValidationLifecyclePort {
  read(rehearsalId: string): CollectionRunnerRehearsalValidationLifecycleSnapshot;
}

export class CollectionRunnerRehearsalOperationValidationPhaseAdapter {
  readonly #pending = new Map<
    string,
    CollectionRunnerRehearsalOperationValidationReceipt
  >();

  public constructor(
    private readonly validation: FixedActualAlphaValidationAdapter,
    private readonly lifecycle: CollectionRunnerRehearsalValidationLifecyclePort,
    private readonly now: () => string = () => new Date().toISOString(),
    private readonly journal?: FixedOperationValidationReceiptJournal,
  ) {}

  public invokeOne(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt,
  ): CollectionRunnerRehearsalOperationPhaseEvidence {
    if (
      command.phase !== CollectionRunnerRehearsalOperationPhase.Validate ||
      authorization.phase !== CollectionRunnerRehearsalOperationPhase.Validate ||
      authorization.commandFingerprint !== command.fingerprint ||
      authorization.manifestFingerprint !== manifest.fingerprint
    ) throw new Error("Validation phase bindings are invalid.");
    const before = this.lifecycle.read(manifest.proposal.rehearsalId);
    const receipt = this.validation.run({
      receiptId: `operation-validation:${authorization.fingerprint.slice(7, 39)}`,
      operationId: manifest.operationId,
      manifestFingerprint: manifest.fingerprint,
      startedAtUtc: this.now(),
    });
    const after = this.lifecycle.read(manifest.proposal.rehearsalId);
    if (
      before.lifecycleVersion !== after.lifecycleVersion ||
      before.lifecycleFingerprint !== after.lifecycleFingerprint
    ) throw new Error("Validation changed durable rehearsal lifecycle state.");
    if (this.#pending.has(receipt.fingerprint)) {
      throw new Error("Validation receipt is already staged.");
    }
    this.journal?.append(authorization.authorizationId, receipt);
    this.#pending.set(receipt.fingerprint, receipt);
    return freeze({
      disposition: CollectionRunnerRehearsalOperationResultDisposition.Completed,
      priorLifecycleVersion: before.lifecycleVersion,
      resultingLifecycleVersion: after.lifecycleVersion,
      priorLifecycleFingerprint: before.lifecycleFingerprint,
      resultingLifecycleFingerprint: after.lifecycleFingerprint,
      authorityEvidenceFingerprint: receipt.fingerprint,
      sanitizedOutputDigest: receipt.sanitizedOutputDigest,
      startedAtUtc: receipt.startedAtUtc,
      completedAtUtc: receipt.endedAtUtc,
    });
  }

  public take(
    fingerprint: string,
  ): CollectionRunnerRehearsalOperationValidationReceipt {
    const receipt = this.#pending.get(fingerprint);
    if (receipt === undefined) {
      throw new Error("Validation receipt is not staged in this process.");
    }
    this.#pending.delete(fingerprint);
    return receipt;
  }
}

export interface CollectionRunnerRehearsalOperationVerificationControlHistory {
  readonly authorizations:
    readonly CollectionRunnerRehearsalOperationAuthorizationReceipt[];
  readonly results: readonly CollectionRunnerRehearsalOperationResultReceipt[];
  readonly stopReceipt: CollectionRunnerRehearsalOperationStopReceipt | null;
}

export interface CollectionRunnerRehearsalOperationVerificationControlPort {
  readValidationReceipt(
    fingerprint: string,
  ): CollectionRunnerRehearsalOperationValidationReceipt;
  readHistory(
    operationId: string,
  ): CollectionRunnerRehearsalOperationVerificationControlHistory;
}

function validationReceiptBody(
  receipt: CollectionRunnerRehearsalOperationValidationReceipt,
): object {
  const {
    deterministic: _deterministic,
    fingerprint: _fingerprint,
    ...body
  } = receipt;
  return body;
}

function immutableRecordBody(
  record: { readonly deterministic: true; readonly fingerprint: string },
): object {
  const {
    deterministic: _deterministic,
    fingerprint: _fingerprint,
    ...body
  } = record;
  return body;
}

function verifyControlHistory(
  manifest: CollectionRunnerRehearsalOperationManifest,
  validationReceipt: CollectionRunnerRehearsalOperationValidationReceipt,
  history: CollectionRunnerRehearsalOperationVerificationControlHistory,
): boolean {
  const plan = manifest.proposal.phasePlan.filter(
    (entry) => entry.phase !== CollectionRunnerRehearsalOperationPhase.Verify,
  );
  if (
    history.stopReceipt !== null ||
    history.authorizations.length !== plan.length ||
    history.results.length !== plan.length
  ) return false;
  let validationBound = false;
  for (let index = 0; index < plan.length; index += 1) {
    const expected = plan[index]!;
    const authorization = history.authorizations[index]!;
    const result = history.results[index]!;
    if (
      authorization.operationId !== manifest.operationId ||
      authorization.manifestFingerprint !== manifest.fingerprint ||
      authorization.phasePlanOrdinal !== expected.ordinal ||
      authorization.phase !== expected.phase ||
      authorization.expectedInvocationOrdinal !== expected.expectedStepOrdinal ||
      !FP.test(authorization.authoritySnapshotFingerprint) ||
      authorization.consumed !== true ||
      authorization.deterministic !== true ||
      authorization.fingerprint !== sha(immutableRecordBody(authorization)) ||
      result.operationId !== manifest.operationId ||
      result.manifestFingerprint !== manifest.fingerprint ||
      result.phasePlanOrdinal !== expected.ordinal ||
      result.phase !== expected.phase ||
      result.expectedInvocationOrdinal !== expected.expectedStepOrdinal ||
      result.authorizationId !== authorization.authorizationId ||
      result.authorizationFingerprint !== authorization.fingerprint ||
      result.commandFingerprint !== authorization.commandFingerprint ||
      result.deterministic !== true ||
      result.fingerprint !== sha(immutableRecordBody(result)) ||
      result.disposition !==
        CollectionRunnerRehearsalOperationResultDisposition.Completed
    ) return false;
    if (result.phase === CollectionRunnerRehearsalOperationPhase.Validate) {
      if (
        validationBound ||
        result.authorityEvidenceFingerprint !== validationReceipt.fingerprint
      ) return false;
      validationBound = true;
    }
  }
  return validationBound;
}

export class CollectionRunnerRehearsalOperationFreshProcessVerifier {
  public constructor(
    private readonly registry: CollectionRunnerRehearsalOperationRegistry,
    private readonly evidenceVerifier: DurableFixtureRehearsalFreshProcessVerifier,
    private readonly control: CollectionRunnerRehearsalOperationVerificationControlPort,
  ) {}

  public verify(
    request: CollectionRunnerRehearsalOperationFinalVerificationRequest,
  ): CollectionRunnerRehearsalOperationFinalVerificationReport {
    let envelope: DurableFixtureRehearsalEnvelopeVerificationResult | null = null;
    const issues: string[] = [];
    try {
      exact(request, [
        "operationId", "manifestFingerprint", "evidenceRootId",
        "envelopeFingerprint", "validationReceiptFingerprint", "observedAtUtc",
      ]);
      if (
        !ID.test(request.operationId) || !ID.test(request.evidenceRootId) ||
        !FP.test(request.manifestFingerprint) ||
        !FP.test(request.envelopeFingerprint) ||
        !FP.test(request.validationReceiptFingerprint) ||
        !UTC.test(request.observedAtUtc)
      ) throw new Error();
      const manifest = this.registry.getOperation(request.operationId);
      const receipt = this.control.readValidationReceipt(
        request.validationReceiptFingerprint,
      );
      const authority = manifest === null
        ? null
        : this.registry.getValidationAuthority(
          manifest.proposal.validationAuthorityFingerprint,
        );
      if (
        manifest === null ||
        manifest.fingerprint !== request.manifestFingerprint ||
        authority === null ||
        receipt.operationId !== request.operationId ||
        receipt.rehearsalId !== manifest.proposal.rehearsalId ||
        receipt.manifestFingerprint !== request.manifestFingerprint ||
        receipt.validationAuthorityFingerprint !==
          manifest.proposal.validationAuthorityFingerprint ||
        receipt.repositoryCommit !== authority.alphaCommit ||
        receipt.packageFingerprint !== authority.packageFingerprint ||
        receipt.validationSuiteFingerprint !==
          authority.validationSuiteFingerprint ||
        receipt.validationPolicyVersion !==
          COLLECTION_RUNNER_REHEARSAL_OPERATION_VALIDATION_POLICY ||
        receipt.recursionPolicyVersion !==
          COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY ||
        receipt.registeredTestTotal !== authority.registeredTestTotal ||
        receipt.registeredTestTotal !== receipt.passedCount ||
        receipt.failedCount !== 0 ||
        receipt.exitStatus !== 0 ||
        receipt.networkPermitted !== false ||
        receipt.credentialAccessPermitted !== false ||
        receipt.passed !== true ||
        receipt.deterministic !== true ||
        receipt.fingerprint !== sha(validationReceiptBody(receipt))
      ) issues.push("OPERATION_VALIDATION_BINDING_FAILED");
      if (
        manifest !== null &&
        !verifyControlHistory(
          manifest,
          receipt,
          this.control.readHistory(request.operationId),
        )
      ) issues.push("OPERATION_CONTROL_HISTORY_FAILED");
      envelope = this.evidenceVerifier.verify(
        request.evidenceRootId,
        request.envelopeFingerprint,
        manifest?.proposal.rehearsalManifestFingerprint ??
          request.manifestFingerprint,
      );
      if (envelope.disposition === DurableFixtureRehearsalEvidenceDisposition.FailClosed) {
        issues.push("EVIDENCE_ENVELOPE_FAILED");
      } else if (
        envelope.disposition === DurableFixtureRehearsalEvidenceDisposition.Incomplete
      ) issues.push("EVIDENCE_ENVELOPE_INCOMPLETE");
    } catch {
      issues.push("FINAL_VERIFICATION_REQUEST_INVALID");
    }
    const disposition = issues.length === 0
      ? CollectionRunnerRehearsalOperationVerificationDisposition.Pass
      : issues.every((issue) => issue === "EVIDENCE_ENVELOPE_INCOMPLETE")
        ? CollectionRunnerRehearsalOperationVerificationDisposition.Incomplete
        : CollectionRunnerRehearsalOperationVerificationDisposition.FailClosed;
    const body = {
      operationId: request.operationId,
      manifestFingerprint: request.manifestFingerprint,
      validationReceiptFingerprint: request.validationReceiptFingerprint,
      envelopeVerification: envelope ?? {
        disposition: DurableFixtureRehearsalEvidenceDisposition.FailClosed,
        issueCodes: ["NOT_EXECUTED"],
        envelopeFingerprint: null,
        manifestFingerprint: null,
        scenarioResultFingerprint: null,
        deterministic: true as const,
        fingerprint: sha({ disposition: "FAIL_CLOSED", issueCodes: ["NOT_EXECUTED"] }),
      },
      disposition,
      issueCodes: [...new Set(issues)].sort(),
      observedAtUtc: request.observedAtUtc,
      nonAuthorityDeclaration:
        COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
      deterministic: true as const,
    };
    return freeze({ ...body, fingerprint: sha(body) });
  }
}

/**
 * Concrete child-process final-verification entry.
 *
 * It cannot run in the phase process. The child independently reopens the
 * live rehearsal store and Control store query-only, while the envelope
 * verifier independently reopens the packaged backup.
 */
export class FixedFreshProcessDualStoreOperationVerifier {
  readonly #evidenceVerifier: DurableFixtureRehearsalFreshProcessVerifier;
  readonly #controlRoot: string;
  readonly #rehearsalRoot: string;

  public constructor(
    private readonly registry: CollectionRunnerRehearsalOperationRegistry,
    evidenceRoots: readonly DurableFixtureRehearsalEnvelopeRoot[],
    validationAuthorities:
      readonly DurableFixtureRehearsalValidationAuthority[],
    controlRoot: string,
    rehearsalRoot: string,
    private readonly rehearsalStoreId: string,
  ) {
    this.#evidenceVerifier = new DurableFixtureRehearsalFreshProcessVerifier(
      evidenceRoots,
      validationAuthorities,
    );
    this.#controlRoot = realpathSync(controlRoot);
    this.#rehearsalRoot = realpathSync(rehearsalRoot);
  }

  public verify(
    request: CollectionRunnerRehearsalOperationFinalVerificationRequest,
  ): CollectionRunnerRehearsalOperationFinalVerificationReport {
    if (env[FINAL_VERIFY_PROCESS_MARKER] !== "1") {
      throw new Error("Final verification requires a dedicated fresh process.");
    }
    const manifest = this.registry.getOperation(request.operationId);
    if (
      manifest === null ||
      manifest.fingerprint !== request.manifestFingerprint
    ) {
      throw new Error("Final verification manifest is unavailable.");
    }
    const rehearsal =
      EventContractCollectionRunnerFixtureRehearsalSqliteStore.openReadOnly({
        rootDirectory: this.#rehearsalRoot,
        storeId: this.rehearsalStoreId,
      });
    const control =
      EventContractCollectionRunnerRehearsalOperationControlSqliteStore
        .openReadOnly(this.#controlRoot);
    try {
      const snapshot = rehearsal
        .createReadOnlyDurableRehearsalRepository()
        .readSnapshot(manifest.proposal.rehearsalId);
      if (
        snapshot === null ||
        snapshot.registry.manifestFingerprint !==
          manifest.proposal.rehearsalManifestFingerprint
      ) {
        throw new Error("Final verification rehearsal truth is unavailable.");
      }
      return new CollectionRunnerRehearsalOperationFreshProcessVerifier(
        this.registry,
        this.#evidenceVerifier,
        control,
      ).verify(request);
    } finally {
      control.close();
      rehearsal.close();
    }
  }
}
