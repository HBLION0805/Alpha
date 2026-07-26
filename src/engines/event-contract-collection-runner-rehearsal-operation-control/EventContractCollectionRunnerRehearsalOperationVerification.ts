import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
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
  type DurableFixtureRehearsalEnvelopeVerificationResult,
} from "../../contracts";
import {
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationResultDisposition,
} from "../../contracts";
import {
  DurableFixtureRehearsalFreshProcessVerifier,
} from "../event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence";
import {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation/EventContractCollectionRunnerRehearsalOperationEngine";

const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const DIGEST_INPUT_BYTES = 64 * 1024;
const PROCESS_MARKER = "ALPHA_FIXED_VALIDATION_PROCESS";

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

function isolatedEnvironment(repositoryRoot: string): Readonly<Record<string, string>> {
  const allowed = [
    "PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR",
    "TEMP", "TMP", "TMPDIR", "ComSpec",
  ] as const;
  const clean: Record<string, string> = {};
  for (const key of allowed) {
    if (typeof env[key] === "string") clean[key] = env[key]!;
  }
  clean[PROCESS_MARKER] = "1";
  clean.ALPHA_NETWORK_DISABLED = "1";
  clean.NODE_OPTIONS =
    `--require=${join(repositoryRoot, "scripts", "network-disabled-bootstrap.cjs")}`;
  clean.PYTHONPATH = join(
    repositoryRoot,
    "scripts",
    "network-disabled-python",
  );
  clean.NO_PROXY = "*";
  clean.no_proxy = "*";
  return freeze(clean);
}

function npmInvocation(): { readonly executable: string; readonly args: readonly string[] } {
  const windows = env.OS === "Windows_NT" ||
    execPath.toLocaleLowerCase().endsWith("\\node.exe");
  const npmCli = typeof env.npm_execpath === "string" &&
    env.npm_execpath.endsWith("npm-cli.js") &&
    existsSync(env.npm_execpath)
    ? env.npm_execpath
    : join(dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
  return windows && existsSync(npmCli)
    ? { executable: execPath, args: [npmCli, "run", "alpha:validate"] }
    : { executable: "npm", args: ["run", "alpha:validate"] };
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
  public constructor(
    private readonly repositoryRoot: string,
    private readonly registry: CollectionRunnerRehearsalOperationRegistry,
    private readonly process: FixedValidationProcessPort =
      new LocalFixedValidationProcess(),
    private readonly endedAtUtc: () => string = () => new Date().toISOString(),
  ) {}

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
      environment: isolatedEnvironment(root),
      timeoutMs: 600_000,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    };
    const commit = this.process.run("git", ["rev-parse", "HEAD"], fixed);
    const clean = this.process.run(
      "git", ["status", "--porcelain", "--untracked-files=no"], fixed,
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
      commit.status !== 0 || commit.signal !== null || commit.errorCode !== null ||
      clean.status !== 0 || clean.signal !== null || clean.errorCode !== null ||
      commit.stdout.trim() !== authority.alphaCommit ||
      clean.stdout.trim() !== "" ||
      sha(packageBytes) !== authority.packageFingerprint ||
      `sha256:${suiteHash}` !== authority.validationSuiteFingerprint
    ) throw new Error("Repository, commit, tree, package, or suite identity drifted.");
    const invocation = npmInvocation();
    const result = this.process.run(invocation.executable, invocation.args, fixed);
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
      deterministic: true as const,
    };
    return freeze({ ...body, fingerprint: sha(body) });
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

export interface CollectionRunnerRehearsalValidationLifecycleSnapshot {
  readonly lifecycleVersion: number;
  readonly lifecycleFingerprint: string;
}

export interface CollectionRunnerRehearsalValidationLifecyclePort {
  read(rehearsalId: string): CollectionRunnerRehearsalValidationLifecycleSnapshot;
}

export class CollectionRunnerRehearsalOperationValidationPhaseAdapter {
  public constructor(
    private readonly validation: FixedActualAlphaValidationAdapter,
    private readonly lifecycle: CollectionRunnerRehearsalValidationLifecyclePort,
    private readonly now: () => string = () => new Date().toISOString(),
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
}

export class CollectionRunnerRehearsalOperationFreshProcessVerifier {
  readonly #receipts: ReadonlyMap<string, CollectionRunnerRehearsalOperationValidationReceipt>;

  public constructor(
    private readonly registry: CollectionRunnerRehearsalOperationRegistry,
    private readonly evidenceVerifier: DurableFixtureRehearsalFreshProcessVerifier,
    receipts: readonly CollectionRunnerRehearsalOperationValidationReceipt[],
  ) {
    this.#receipts = new Map(receipts.map((receipt) => [receipt.fingerprint, receipt]));
    if (this.#receipts.size !== receipts.length) {
      throw new Error("Validation receipt authority is ambiguous.");
    }
  }

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
      const receipt = this.#receipts.get(request.validationReceiptFingerprint);
      if (
        manifest === null ||
        manifest.fingerprint !== request.manifestFingerprint ||
        receipt === undefined ||
        receipt.operationId !== request.operationId ||
        receipt.manifestFingerprint !== request.manifestFingerprint ||
        receipt.validationAuthorityFingerprint !==
          manifest.proposal.validationAuthorityFingerprint ||
        receipt.registeredTestTotal !== receipt.passedCount ||
        receipt.failedCount !== 0 ||
        receipt.passed !== true
      ) issues.push("OPERATION_VALIDATION_BINDING_FAILED");
      envelope = this.evidenceVerifier.verify(
        request.evidenceRootId,
        request.envelopeFingerprint,
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
