import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
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
  CollectionRunnerRehearsalOperationFreshProcessVerifier,
  FixedActualAlphaValidationAdapter,
  type FixedValidationProcessPort,
  type FixedValidationProcessResult,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";

const root = realpathSync(resolve("."));
const commit = "a".repeat(40);
const fp = (value: string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
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
    if (args[0] === "rev-parse") {
      return { status: 0, signal: null, stdout: `${commit}\n`, stderr: "", errorCode: null };
    }
    if (args[0] === "status") {
      return { status: 0, signal: null, stdout: "", stderr: "", errorCode: null };
    }
    return {
      status: 0, signal: null, stdout: this.validationOutput,
      stderr: "", errorCode: null,
    };
  }
}

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
      root, registry, process, () => "2026-07-25T20:02:00.000Z",
    ).run(request());
    if (!receipt.passed || receipt.failedCount !== 0 ||
      receipt.validationAuthorityFingerprint !== authority.fingerprint) {
      throw new Error("Validation receipt did not bind exact authority.");
    }
    if (process.calls.length !== 3 ||
      process.calls[2]!.environment.ALPHA_FIXED_VALIDATION_PROCESS !== "1" ||
      process.calls[2]!.environment.ALPHA_NETWORK_DISABLED !== "1") {
      throw new Error("Fixed process boundary was not enforced.");
    }
    if (Object.keys(process.calls[2]!.environment)
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
      new FixedActualAlphaValidationAdapter(root, registry, process).run(request());
    } catch { rejected = true; }
    if (!rejected) throw new Error("Changed test total was accepted.");
  }],
  ["rejects ambiguous validation accounting", () => {
    const report = '{"overall":{"testsExecuted":2434,"passed":2434,"failed":0}}';
    let rejected = false;
    try {
      new FixedActualAlphaValidationAdapter(
        root, registry, new ProcessFixture(`${report}\n${report}`),
      ).run(request());
    } catch { rejected = true; }
    if (!rejected) throw new Error("Ambiguous accounting was accepted.");
  }],
  ["binds operation validation to fresh-process envelope verification", () => {
    const validationReceipt = {
      ...request(),
      rehearsalId: "rehearsal:test",
      validationAuthorityFingerprint: authority.fingerprint,
      registeredTestTotal: 2434,
      passedCount: 2434,
      failedCount: 0,
      passed: true,
      fingerprint: fp("validation-receipt"),
    } as unknown as CollectionRunnerRehearsalOperationValidationReceipt;
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
      registry, evidence, [validationReceipt],
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
  }],
];

for (const [name, run] of tests) {
  run();
  console.log(`PASS ${name}`);
}
console.log(`${tests.length}/${tests.length} tests passed`);
