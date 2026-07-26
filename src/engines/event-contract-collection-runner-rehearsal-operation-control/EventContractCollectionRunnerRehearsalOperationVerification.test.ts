import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execPath } from "node:process";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationResultDisposition,
  CollectionRunnerRehearsalOperationVerificationDisposition,
  DurableFixtureRehearsalEvidenceDisposition,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationValidationAuthority,
  type CollectionRunnerRehearsalOperationValidationReceipt,
  type CollectionRunnerRehearsalOperationRootRegistration,
  type DurableFixtureRehearsalEnvelopeVerificationResult,
} from "../../contracts";
import {
  DurableFixtureRehearsalFreshProcessVerifier,
} from "../event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalEvidence";
import {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation";
import {
  EventContractCollectionRunnerRehearsalOperationControlSqliteStore,
} from "../../repositories/EventContractCollectionRunnerRehearsalOperationControlSqliteStore";
import {
  CollectionRunnerRehearsalOperationFreshProcessVerifier,
  FixedActualAlphaValidationAdapter,
  type FixedValidationProcessPort,
  type FixedValidationProcessResult,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";
import type {
  CollectionRunnerRehearsalOperationFixedGitPort,
} from "./EventContractCollectionRunnerRehearsalOperationPreflight";

const root = realpathSync(resolve("."));
const commit = "a".repeat(40);
const fp = (value: string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}
const recordFingerprint = (value: object) =>
  `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
const packageBytes = readFileSync(resolve("package.json"));
const validationBytes = readFileSync(resolve("scripts", "alpha-validate.mjs"));
const networkGuardBytes = readFileSync(
  resolve("scripts", "network-disabled-bootstrap.cjs"),
);
const pythonNetworkGuardBytes = readFileSync(
  resolve("scripts", "network-disabled-python", "sitecustomize.py"),
);
const suite = `sha256:${createHash("sha256")
  .update(validationBytes).update(networkGuardBytes)
  .update(pythonNetworkGuardBytes)
  .update(packageBytes).digest("hex")}`;
const authority = {
  fingerprint: fp("authority"),
  repositoryRootId: "alpha-root",
  alphaCommit: commit,
  cleanTreeRequired: true,
  packageFingerprint: fpBytes(packageBytes),
  validationSuiteFingerprint: suite,
  registeredTestTotal: 2434,
  recursionPolicyVersion:
    COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
  networkPermitted: false,
  credentialAccessPermitted: false,
} as unknown as CollectionRunnerRehearsalOperationValidationAuthority;
const manifest = {
  operationId: "operation:test",
  fingerprint: fp("manifest"),
  proposal: {
    rehearsalId: "rehearsal:test",
    validationAuthorityFingerprint: authority.fingerprint,
    phasePlan: [
      {
        ordinal: 1,
        phase: CollectionRunnerRehearsalOperationPhase.Validate,
        expectedStepOrdinal: null,
      },
      {
        ordinal: 2,
        phase: CollectionRunnerRehearsalOperationPhase.Verify,
        expectedStepOrdinal: null,
      },
    ],
  },
} as unknown as CollectionRunnerRehearsalOperationManifest;
const rootRegistration = {
  canonicalPath: root,
} as unknown as CollectionRunnerRehearsalOperationRootRegistration;
const registry = {
  getOperation: (id: string) => id === manifest.operationId ? manifest : null,
  getValidationAuthority: (fingerprint: string) =>
    fingerprint === authority.fingerprint ? authority : null,
  getRoot: (id: string) => id === "alpha-root" ? rootRegistration : null,
} as unknown as CollectionRunnerRehearsalOperationRegistry;

function fpBytes(value: Uint8Array): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

class ProcessFixture implements FixedValidationProcessPort {
  public readonly calls: {
    readonly executable: string;
    readonly args: readonly string[];
    readonly environment: Readonly<Record<string, string>>;
  }[] = [];
  public constructor(private readonly validationOutput: string) {}
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
    this.calls.push({ executable, args, environment: options.environment });
    return {
      status: 0, signal: null, stdout: this.validationOutput,
      stderr: "", errorCode: null,
    };
  }
}

const git: CollectionRunnerRehearsalOperationFixedGitPort = {
  canonicalExecutablePath: realpathSync(execPath),
  executableFingerprint: fp("fixed-git"),
  run: (_repositoryRoot, args) => ({
    status: 0,
    stdout: args[0] === "rev-parse" ? `${commit}\n` : "",
    stderr: "",
    errorCode: null,
  }),
};

function request() {
  return {
    receiptId: "validation:test",
    operationId: manifest.operationId,
    manifestFingerprint: manifest.fingerprint,
    startedAtUtc: "2026-07-25T20:00:00.000Z",
  };
}

const tests: readonly [string, () => void][] = [
  ["binds the fixed command, exact total, scrubbed environment, and receipt", () => {
    const process = new ProcessFixture(
      '{"overall":{"testsExecuted":2434,"passed":2434,"failed":0}}',
    );
    const receipt = new FixedActualAlphaValidationAdapter(
      root, registry, git, execPath, process,
      () => "2026-07-25T20:02:00.000Z",
    ).run(request());
    if (!receipt.passed || receipt.failedCount !== 0 ||
      receipt.validationAuthorityFingerprint !== authority.fingerprint) {
      throw new Error("Validation receipt did not bind exact authority.");
    }
    if (process.calls.length !== 1 ||
      process.calls[0]!.environment.ALPHA_FIXED_VALIDATION_PROCESS !== "1" ||
      process.calls[0]!.environment.ALPHA_NETWORK_DISABLED !== "1") {
      throw new Error("Fixed process boundary was not enforced.");
    }
    if (
      process.calls[0]!.executable !== realpathSync(execPath) ||
      !process.calls[0]!.args[0]?.endsWith("alpha-validate.mjs")
    ) throw new Error("Clean-tree or executable identity is not fixed.");
    if (Object.keys(process.calls[0]!.environment)
      .some((key) => /TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH/u.test(key))) {
      throw new Error("Credential-like environment leaked.");
    }
  }],
  ["rejects changed exact test accounting", () => {
    const process = new ProcessFixture(
      '{"overall":{"testsExecuted":2435,"passed":2435,"failed":0}}',
    );
    let rejected = false;
    try {
      new FixedActualAlphaValidationAdapter(root, registry, git, execPath, process)
        .run(request());
    } catch { rejected = true; }
    if (!rejected) throw new Error("Changed test total was accepted.");
  }],
  ["rejects ambiguous validation accounting", () => {
    const report = '{"overall":{"testsExecuted":2434,"passed":2434,"failed":0}}';
    let rejected = false;
    try {
      new FixedActualAlphaValidationAdapter(
        root, registry, git, execPath,
        new ProcessFixture(`${report}\n${report}`),
      ).run(request());
    } catch { rejected = true; }
    if (!rejected) throw new Error("Ambiguous accounting was accepted.");
  }],
  ["binds operation validation to fresh-process envelope verification", () => {
    const validationReceipt = new FixedActualAlphaValidationAdapter(
      root,
      registry,
      git,
      execPath,
      new ProcessFixture(
        '{"overall":{"testsExecuted":2434,"passed":2434,"failed":0}}',
      ),
      () => "2026-07-25T20:02:00.000Z",
    ).run(request());
    const authorizationBody = {
      authorizationId: "authorization:validate",
      commandId: "command:validate",
      commandFingerprint: fp("command"),
      operationId: manifest.operationId,
      manifestFingerprint: manifest.fingerprint,
      phase: CollectionRunnerRehearsalOperationPhase.Validate,
      phasePlanOrdinal: 1,
      expectedLifecycleVersion: 1,
      expectedInvocationOrdinal: null,
      expectedRecoveryFingerprint: fp("recovery"),
      authoritySnapshotFingerprint: fp("authority-snapshot"),
      ownerId: "owner:test",
      ownerAuthorizationReference: fp("owner-authorization"),
      bootIdentity: "boot:test",
      processSessionId: "session:test",
      authorizedAtUtc: "2026-07-25T20:00:00.000Z",
      expiresAtUtc: "2026-07-25T20:05:00.000Z",
      consumedAtUtc: "2026-07-25T20:00:00.000Z",
      consumed: true,
    } as const;
    const authorization = {
      ...authorizationBody,
      deterministic: true,
      fingerprint: recordFingerprint(authorizationBody),
    } as const;
    const operationResultBody = {
      resultId: "result:validate",
      authorizationId: authorization.authorizationId,
      authorizationFingerprint: authorization.fingerprint,
      commandId: authorization.commandId,
      commandFingerprint: authorization.commandFingerprint,
      operationId: manifest.operationId,
      manifestFingerprint: manifest.fingerprint,
      phase: CollectionRunnerRehearsalOperationPhase.Validate,
      phasePlanOrdinal: 1,
      expectedInvocationOrdinal: null,
      processSessionId: authorization.processSessionId,
      bootIdentity: authorization.bootIdentity,
      disposition: CollectionRunnerRehearsalOperationResultDisposition.Completed,
      priorLifecycleVersion: 1,
      resultingLifecycleVersion: 1,
      priorLifecycleFingerprint: fp("lifecycle"),
      resultingLifecycleFingerprint: fp("lifecycle"),
      authorityEvidenceFingerprint: validationReceipt.fingerprint,
      sanitizedOutputDigest: fp("output"),
      startedAtUtc: "2026-07-25T20:00:00.000Z",
      completedAtUtc: "2026-07-25T20:02:00.000Z",
      nonAuthorityDeclaration: "fixture-only",
    } as const;
    const operationResult = {
      ...operationResultBody,
      deterministic: true,
      fingerprint: recordFingerprint(operationResultBody),
    } as const;
    const envelopeResult = {
      disposition: DurableFixtureRehearsalEvidenceDisposition.Pass,
      issueCodes: [],
      envelopeFingerprint: fp("envelope"),
      manifestFingerprint: manifest.fingerprint,
      scenarioResultFingerprint: fp("scenario"),
      deterministic: true,
      fingerprint: fp("envelope-result"),
    } satisfies DurableFixtureRehearsalEnvelopeVerificationResult;
    const evidence = {
      verify: () => envelopeResult,
    } as unknown as DurableFixtureRehearsalFreshProcessVerifier;
    const result = new CollectionRunnerRehearsalOperationFreshProcessVerifier(
      registry,
      evidence,
      {
        readValidationReceipt: () => validationReceipt,
        readHistory: () => ({
          authorizations: [authorization],
          results: [operationResult],
          stopReceipt: null,
        }),
      },
    ).verify({
      operationId: manifest.operationId,
      manifestFingerprint: manifest.fingerprint,
      evidenceRootId: "evidence-root",
      envelopeFingerprint: envelopeResult.envelopeFingerprint!,
      validationReceiptFingerprint: validationReceipt.fingerprint,
      observedAtUtc: "2026-07-25T20:03:00.000Z",
    });
    if (result.disposition !==
      CollectionRunnerRehearsalOperationVerificationDisposition.Pass) {
      throw new Error("Exact operation/envelope binding did not pass.");
    }
    const verifyWith = (
      receipt: CollectionRunnerRehearsalOperationValidationReceipt,
      results: readonly (typeof operationResult)[],
      stopped = false,
    ) => new CollectionRunnerRehearsalOperationFreshProcessVerifier(
      registry,
      evidence,
      {
        readValidationReceipt: () => receipt,
        readHistory: () => ({
          authorizations: [authorization],
          results,
          stopReceipt: stopped ? ({} as never) : null,
        }),
      },
    ).verify({
      operationId: manifest.operationId,
      manifestFingerprint: manifest.fingerprint,
      evidenceRootId: "evidence-root",
      envelopeFingerprint: envelopeResult.envelopeFingerprint!,
      validationReceiptFingerprint: receipt.fingerprint,
      observedAtUtc: "2026-07-25T20:03:00.000Z",
    });
    const forged = {
      ...validationReceipt,
      repositoryCommit: "b".repeat(40),
    };
    if (
      verifyWith(forged, [operationResult]).disposition !==
        CollectionRunnerRehearsalOperationVerificationDisposition.FailClosed
    ) throw new Error("Forged validation receipt was accepted.");
    if (
      verifyWith(validationReceipt, []).disposition !==
        CollectionRunnerRehearsalOperationVerificationDisposition.FailClosed
    ) throw new Error("Unresolved operation history was accepted.");
    if (
      verifyWith(validationReceipt, [operationResult], true).disposition !==
        CollectionRunnerRehearsalOperationVerificationDisposition.FailClosed
    ) throw new Error("Stopped operation history was accepted.");
  }],
];

for (const [name, run] of tests) {
  run();
  console.log(`PASS ${name}`);
}
console.log(`${tests.length}/${tests.length} tests passed`);
