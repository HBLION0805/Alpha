import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cwd, env, execPath } from "node:process";
import process from "node:process";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationResultDisposition,
  EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommandInput,
  type CollectionRunnerRehearsalOperationReadinessObservation,
  type CollectionRunnerRehearsalOperationValidationAuthority,
} from "../../contracts";
import {
  EventContractCollectionRunnerRehearsalOperationControlSqliteStore,
} from "../../repositories/EventContractCollectionRunnerRehearsalOperationControlSqliteStore";
import type {
  CollectionRunnerLocalOwnerVerifier,
  VerifyCollectionRunnerLocalOwnerInput,
} from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation";
import {
  EventContractCollectionRunnerRehearsalOperationPhaseGate,
  type CollectionRunnerRehearsalOperationControlRepository,
} from "./EventContractCollectionRunnerRehearsalOperationControlEngine";
import {
  FixedActualAlphaValidationAdapter,
  type FixedValidationProcessPort,
  type FixedValidationProcessResult,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";

const FP = (character: string) => `sha256:${character.repeat(64)}`;
const COMMIT = "a".repeat(40);
const OPERATION = "operation:security-drill";
const MANIFEST = FP("1");
const CONTROL_FILE = "rehearsal-operation-control.sqlite3";
const ARTIFACT = "phase-artifact.json";
const STOP = "durable-stop.marker";
const LOCK = "operation-owner.lock";
const CREATED = "2026-07-26T14:00:00.000Z";
const INVOKED = "2026-07-26T14:01:00.000Z";
const EXPIRES = "2026-07-26T14:05:00.000Z";

const manifest = {
  operationId: OPERATION,
  fingerprint: MANIFEST,
  deterministic: true,
  ownerApproval: {
    ownerId: "owner:security-drill",
    expiresAtUtc: "2026-07-27T14:00:00.000Z",
  },
  proposal: {
    rehearsalId: "rehearsal:security-drill",
    alphaCommit: COMMIT,
    rootRegistryFingerprint: FP("2"),
    validationAuthorityFingerprint: FP("3"),
    phasePlan: [{
      ordinal: 1,
      phase: CollectionRunnerRehearsalOperationPhase.Prepare,
      expectedStepOrdinal: null,
    }],
  },
} as unknown as CollectionRunnerRehearsalOperationManifest;

function registry(): CollectionRunnerRehearsalOperationRegistry {
  return {
    getOperation: (operationId: string) =>
      operationId === OPERATION ? structuredClone(manifest) : null,
    getValidationAuthority: (fingerprint: string) =>
      fingerprint === FP("3")
        ? {
          packageFingerprint: FP("5"),
          validationSuiteFingerprint: FP("6"),
          registeredTestTotal: 2438,
        }
        : null,
  } as unknown as CollectionRunnerRehearsalOperationRegistry;
}

function command(variant = "exact"): CollectionRunnerRehearsalOperationPhaseCommandInput {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
    commandId: variant === "exact" ? "command:prepare:1" : `command:prepare:${variant}`,
    operationId: OPERATION,
    manifestFingerprint: MANIFEST,
    phase: CollectionRunnerRehearsalOperationPhase.Prepare,
    expectedLifecycleVersion: 1,
    expectedInvocationOrdinal: null,
    expectedRecoveryFingerprint: FP("4"),
    alphaCommit: COMMIT,
    rootRegistryFingerprint: FP("2"),
    bootIdentity: variant === "exact" ? "boot:security-drill" : `boot:${variant}`,
    processSessionId: variant === "exact"
      ? "session:security-drill"
      : `session:${variant}`,
    createdAtUtc: CREATED,
    expiresAtUtc: EXPIRES,
    challengeNonce: variant === "exact"
      ? "nonce-security-drill-0001"
      : `nonce-security-${variant}-0001`,
  };
}

function observation(
  root: string,
): CollectionRunnerRehearsalOperationReadinessObservation {
  return {
    operationId: OPERATION,
    manifestFingerprint: MANIFEST,
    observedAtUtc: INVOKED,
    alphaCommit: COMMIT,
    trackedTreeClean: true,
    packageFingerprint: FP("5"),
    validationSuiteFingerprint: FP("6"),
    registeredTestTotal: 2438,
    rootRegistryFingerprint: FP("2"),
    rootsVerified: true,
    fixtureBindingsVerified: true,
    networkCapabilityAbsent: true,
    credentialCapabilityAbsent: true,
    approvalValid: true,
    storeState: "ABSENT",
    lifecycleState: null,
    lifecycleVersion: null,
    nextInvocationOrdinal: null,
    recoveryFingerprint: FP("4"),
    unresolvedClaim: false,
    ownershipAvailable: !existsSync(join(root, LOCK)),
    processStopTripped: false,
    durableStopTripped: existsSync(join(root, STOP)),
    blockerCodes: [],
    incompleteCodes: [],
  };
}

class Verifier implements CollectionRunnerLocalOwnerVerifier {
  public verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence {
    if (input.secret !== "owner-secret") throw new Error("Owner rejected.");
    return Object.freeze({
      authorityKind: "LOCAL_OWNER_VERIFIED",
      ownerId: input.ownerId,
      verifierId: "verifier:security-drill",
      verifierVersion: "1.0",
      authorizationReference: FP("7"),
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
  }
}

function childResult(root: string) {
  const storeExists = existsSync(join(root, CONTROL_FILE));
  const store = storeExists
    ? EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
      root, { createIfMissing: false },
    )
    : null;
  try {
    const snapshot = store?.readSnapshot(OPERATION);
    return {
      authorizationCount: snapshot?.authorizationCount ?? 0,
      resultCount: snapshot?.resultCount ?? 0,
      stopReceiptCount: snapshot?.stopReceipt === null ||
        snapshot?.stopReceipt === undefined ? 0 : 1,
      artifactExists: existsSync(join(root, ARTIFACT)),
      stopMarkerExists: existsSync(join(root, STOP)),
      ownershipPreserved: existsSync(join(root, LOCK)),
      latestCommandId: snapshot?.latestAuthorization?.commandId ?? null,
      latestDisposition: snapshot?.latestResult?.disposition ?? null,
    };
  } finally {
    store?.close();
  }
}

function childMain(mode: string, root: string, resultPath: string, variant: string): void {
  if (mode === "inspect") {
    writeFileSync(resultPath, JSON.stringify(childResult(root)), { flag: "wx" });
    return;
  }
  if (mode === "crash-before-authorization") {
    process.exitCode = 80;
    throw new Error("Injected crash before authorization.");
  }
  if (mode === "stop-before-authorization") {
    writeFileSync(join(root, STOP), "STOP\n", { flag: "wx" });
  }
  const store =
    EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
      root, { createIfMissing: true },
    );
  let stopChecks = 0;
  const repository: CollectionRunnerRehearsalOperationControlRepository =
    mode === "crash-after-result"
      ? {
        readSnapshot: (operationId) => store.readSnapshot(operationId),
        authorizeAndConsume: (receipt) => store.authorizeAndConsume(receipt),
        appendStop: (receipt) => store.appendStop(receipt),
        appendResult: (receipt) => {
          store.appendResult(receipt);
          store.close();
          process.exitCode = 83;
          throw new Error("Injected crash after result.");
        },
      }
      : store;
  const gate = new EventContractCollectionRunnerRehearsalOperationPhaseGate({
    registry: registry(),
    repository,
    readiness: { inspect: () => observation(root) },
    verifier: new Verifier(),
    stop: {
      assertClear: () => {
        stopChecks += 1;
        if (mode === "stop-after-authorization" && stopChecks === 3) {
          writeFileSync(join(root, STOP), "STOP\n", { flag: "wx" });
        }
        if (existsSync(join(root, STOP))) throw new Error("Stop tripped.");
      },
      trip: () => {
        if (!existsSync(join(root, STOP))) {
          writeFileSync(join(root, STOP), "STOP\n", { flag: "wx" });
        }
        return FP("8");
      },
    },
    ownership: {
      acquire: () => {
        writeFileSync(join(root, LOCK), "OWNER\n", { flag: "wx" });
        return {
          releaseClean: () => unlinkSync(join(root, LOCK)),
          preserveAmbiguity: () => undefined,
        };
      },
    },
    phase: {
      invokeOne: () => {
        if (mode === "crash-after-authorization") {
          store.close();
          process.exitCode = 81;
          throw new Error("Injected crash after authorization.");
        }
        writeFileSync(join(root, ARTIFACT), '{"fixtureOnly":true}\n', {
          flag: "wx",
        });
        if (mode === "crash-after-artifact") {
          store.close();
          process.exitCode = 82;
          throw new Error("Injected crash after artifact.");
        }
        return {
          disposition: CollectionRunnerRehearsalOperationResultDisposition.Completed,
          priorLifecycleVersion: 1,
          resultingLifecycleVersion: 2,
          priorLifecycleFingerprint: FP("9"),
          resultingLifecycleFingerprint: FP("a"),
          authorityEvidenceFingerprint: FP("b"),
          sanitizedOutputDigest: FP("c"),
          startedAtUtc: INVOKED,
          completedAtUtc: "2026-07-26T14:01:01.000Z",
        };
      },
    },
  });
  try {
    const result = gate.executeOne(command(variant), "owner-secret", INVOKED);
    writeFileSync(resultPath, JSON.stringify(result), { flag: "wx" });
  } finally {
    store.close();
  }
}

interface Inspection {
  readonly authorizationCount: number;
  readonly resultCount: number;
  readonly stopReceiptCount: number;
  readonly artifactExists: boolean;
  readonly stopMarkerExists: boolean;
  readonly ownershipPreserved: boolean;
  readonly latestCommandId: string | null;
  readonly latestDisposition: string | null;
}

const SELF = join(
  cwd(), "src", "engines",
  "event-contract-collection-runner-rehearsal-operation-control",
  "EventContractCollectionRunnerRehearsalOperationSecurityProcessDrill.test.ts",
);
const TSX = join(cwd(), "node_modules", "tsx", "dist", "cli.mjs");

function invoke(
  root: string,
  mode: string,
  sequence: number,
  expectedSuccess: boolean,
  variant = "exact",
): void {
  const result = spawnSync(
    execPath,
    [TSX, SELF, "__child", mode, root, join(root, `${sequence}-${mode}.json`), variant],
    {
      cwd: cwd(), input: "", encoding: "utf8", shell: false,
      timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
      windowsHide: true, killSignal: "SIGTERM",
    },
  );
  if (expectedSuccess !== (result.status === 0)) {
    throw new Error(`${mode} unexpected exit ${String(result.status)}: ${result.stderr}`);
  }
}

function inspect(root: string, sequence: number): Inspection {
  const path = join(root, `${sequence}-inspect.json`);
  const result = spawnSync(
    execPath,
    [TSX, SELF, "__child", "inspect", root, path, "exact"],
    {
      cwd: cwd(), input: "", encoding: "utf8", shell: false,
      timeout: 30_000, maxBuffer: 4 * 1024 * 1024,
      windowsHide: true, killSignal: "SIGTERM",
    },
  );
  if (result.status !== 0) throw new Error(`inspect failed: ${result.stderr}`);
  return JSON.parse(readFileSync(path, "utf8")) as Inspection;
}

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

class OsEnvironmentProbeProcess implements FixedValidationProcessPort {
  private calls = 0;
  public run(
    _executable: string,
    args: readonly string[],
    options: {
      readonly cwd: string;
      readonly environment: Readonly<Record<string, string>>;
      readonly timeoutMs: number;
      readonly maxOutputBytes: number;
    },
  ): FixedValidationProcessResult {
    this.calls += 1;
    if (this.calls === 1) {
      return { status: 0, signal: null, stdout: `${COMMIT}\n`, stderr: "", errorCode: null };
    }
    if (this.calls === 2) {
      return { status: 0, signal: null, stdout: "", stderr: "", errorCode: null };
    }
    const pythonProbe = spawnSync("python", ["-c", `
import os, socket
denied = False
try:
    socket.socket()
except RuntimeError:
    denied = True
active = os.environ.get("ALPHA_PYTHON_NETWORK_GUARD_ACTIVE") == "1"
raise SystemExit(0 if denied and active else 8)
`], {
      cwd: options.cwd, env: options.environment, input: "", encoding: "utf8",
      shell: false, timeout: options.timeoutMs, maxBuffer: options.maxOutputBytes,
      windowsHide: true, killSignal: "SIGTERM",
    });
    if (pythonProbe.status !== 0) {
      return {
        status: pythonProbe.status,
        signal: pythonProbe.signal,
        stdout: pythonProbe.stdout,
        stderr: pythonProbe.stderr,
        errorCode: pythonProbe.error?.code ?? null,
      };
    }
    const probe = spawnSync(execPath, ["-e", `
const forbidden = Object.keys(process.env).filter((key) =>
  /TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|PROXY/i.test(key) &&
  !/NO_PROXY/i.test(key));
let networkDenied = false;
try { require("node:net").connect({host:"127.0.0.1",port:9}); }
catch { networkDenied = true; }
const ok = process.env.ALPHA_FIXED_VALIDATION_PROCESS === "1" &&
  process.env.ALPHA_NETWORK_DISABLED === "1" &&
  process.env.ALPHA_NETWORK_GUARD_ACTIVE === "1" &&
  process.env.NO_PROXY === "*" && forbidden.length === 0 && networkDenied;
console.log(JSON.stringify({overall:{testsExecuted:2438,passed:2438,failed:0},ok}));
process.exit(ok ? 0 : 9);
`], {
      cwd: options.cwd, env: options.environment, input: "", encoding: "utf8",
      shell: false, timeout: options.timeoutMs, maxBuffer: options.maxOutputBytes,
      windowsHide: true, killSignal: "SIGTERM",
    });
    return {
      status: probe.status, signal: probe.signal,
      stdout: probe.stdout, stderr: probe.stderr,
      errorCode: probe.error?.code ?? null,
    };
  }
}

function validationRegistry(): CollectionRunnerRehearsalOperationRegistry {
  const packageBytes = readFileSync(join(cwd(), "package.json"));
  const validationBytes = readFileSync(join(cwd(), "scripts", "alpha-validate.mjs"));
  const networkGuardBytes = readFileSync(
    join(cwd(), "scripts", "network-disabled-bootstrap.cjs"),
  );
  const pythonNetworkGuardBytes = readFileSync(
    join(cwd(), "scripts", "network-disabled-python", "sitecustomize.py"),
  );
  const sha = (value: Uint8Array) =>
    `sha256:${createHash("sha256").update(value).digest("hex")}`;
  const suite = createHash("sha256")
    .update(validationBytes)
    .update(networkGuardBytes)
    .update(pythonNetworkGuardBytes)
    .update(packageBytes);
  const authority = {
    fingerprint: FP("d"),
    repositoryRootId: "alpha-root",
    alphaCommit: COMMIT,
    cleanTreeRequired: true,
    packageFingerprint: sha(packageBytes),
    validationSuiteFingerprint: `sha256:${suite.digest("hex")}`,
    registeredTestTotal: 2438,
    recursionPolicyVersion:
      COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
    networkPermitted: false,
    credentialAccessPermitted: false,
  } as unknown as CollectionRunnerRehearsalOperationValidationAuthority;
  const operation = {
    ...manifest,
    proposal: {
      ...manifest.proposal,
      validationAuthorityFingerprint: authority.fingerprint,
    },
  } as CollectionRunnerRehearsalOperationManifest;
  return {
    getOperation: (id: string) => id === OPERATION ? operation : null,
    getValidationAuthority: (fingerprint: string) =>
      fingerprint === authority.fingerprint ? authority : null,
    getRoot: (id: string) => id === "alpha-root"
      ? { canonicalPath: cwd() }
      : null,
  } as unknown as CollectionRunnerRehearsalOperationRegistry;
}

async function parentMain(): Promise<void> {
  const mutableEnv = env as Record<string, string | undefined>;
  const roots: string[] = [];
  const root = (label: string) => {
    const value = mkdtempSync(join(tmpdir(), `alpha-operation-${label}-`));
    roots.push(value);
    return value;
  };
  let passed = 0;
  const pass = (name: string) => {
    passed += 1;
    console.log(`PASS ${name}`);
  };
  try {
    {
      const value = root("pre-auth");
      invoke(value, "crash-before-authorization", 1, false);
      const state = inspect(value, 2);
      equal(state.authorizationCount, 0, "pre-auth authorization");
      equal(state.artifactExists, false, "pre-auth artifact");
      pass("process crash before authorization leaves no durable authority or artifact");
    }
    {
      const value = root("post-auth");
      invoke(value, "crash-after-authorization", 1, false);
      const state = inspect(value, 2);
      equal(state.authorizationCount, 1, "post-auth authorization");
      equal(state.resultCount, 0, "post-auth result");
      equal(state.artifactExists, false, "post-auth artifact");
      equal(state.ownershipPreserved, true, "post-auth ownership");
      invoke(value, "clean", 3, false);
      equal(inspect(value, 4).authorizationCount, 1, "post-auth replay");
      pass("post-authorization crash is ambiguous and cannot replay");
    }
    {
      const value = root("post-artifact");
      invoke(value, "crash-after-artifact", 1, false);
      const state = inspect(value, 2);
      equal(state.authorizationCount, 1, "post-artifact authorization");
      equal(state.resultCount, 0, "post-artifact result");
      equal(state.artifactExists, true, "post-artifact evidence");
      invoke(value, "clean", 3, false, "changed");
      equal(inspect(value, 4).resultCount, 0, "changed replay result");
      pass("artifact-before-result crash preserves evidence and rejects changed replay");
    }
    {
      const value = root("post-result");
      invoke(value, "crash-after-result", 1, false);
      const state = inspect(value, 2);
      equal(state.authorizationCount, 1, "post-result authorization");
      equal(state.resultCount, 1, "post-result result");
      equal(state.artifactExists, true, "post-result artifact");
      invoke(value, "clean", 3, false);
      const replayed = inspect(value, 4);
      equal(replayed.authorizationCount, 1, "post-result replay authorization");
      equal(replayed.resultCount, 1, "post-result replay result");
      pass("result-before-process-crash remains terminal and non-duplicated");
    }
    {
      const value = root("stop-before");
      invoke(value, "stop-before-authorization", 1, false);
      const state = inspect(value, 2);
      equal(state.authorizationCount, 0, "Stop-before authorization");
      equal(state.artifactExists, false, "Stop-before artifact");
      pass("durable Stop before authentication blocks authorization and mutation");
    }
    {
      const value = root("stop-after");
      invoke(value, "stop-after-authorization", 1, false);
      const state = inspect(value, 2);
      equal(state.authorizationCount, 1, "Stop-after authorization");
      equal(state.resultCount, 0, "Stop-after result");
      equal(state.artifactExists, false, "Stop-after artifact");
      equal(state.stopMarkerExists, true, "Stop-after marker");
      pass("Stop racing authorization prevents phase artifact and preserves ambiguity");
    }
    {
      const value = root("clean");
      invoke(value, "clean", 1, true);
      const state = inspect(value, 2);
      equal(state.authorizationCount, 1, "clean authorization");
      equal(state.resultCount, 1, "clean result");
      equal(state.latestDisposition, "COMPLETED", "clean disposition");
      equal(state.ownershipPreserved, false, "clean ownership");
      pass("clean process commits one authorization result and artifact");
    }
    {
      const previous = env.ALPHA_REHEARSAL_OPERATION_PROCESS;
      delete mutableEnv.ALPHA_REHEARSAL_OPERATION_PROCESS;
      mutableEnv.ALPHA_DEMO_SECRET = "must-not-cross";
      try {
        const receipt = new FixedActualAlphaValidationAdapter(
          cwd(), validationRegistry(), new OsEnvironmentProbeProcess(),
          () => "2026-07-26T14:02:00.000Z",
        ).run({
          receiptId: "validation:environment-drill",
          operationId: OPERATION,
          manifestFingerprint: MANIFEST,
          startedAtUtc: INVOKED,
        });
        equal(receipt.passedCount, 2438, "environment probe total");
      } finally {
        delete mutableEnv.ALPHA_DEMO_SECRET;
        if (previous !== undefined) {
          mutableEnv.ALPHA_REHEARSAL_OPERATION_PROCESS = previous;
        }
      }
      pass("OS child receives fixed network-disabled credential-scrubbed environment");
    }
    {
      mutableEnv.ALPHA_FIXED_VALIDATION_PROCESS = "1";
      let rejected = false;
      try {
        new FixedActualAlphaValidationAdapter(
          cwd(), validationRegistry(), new OsEnvironmentProbeProcess(),
        ).run({
          receiptId: "validation:recursive",
          operationId: OPERATION,
          manifestFingerprint: MANIFEST,
          startedAtUtc: INVOKED,
        });
      } catch { rejected = true; }
      delete mutableEnv.ALPHA_FIXED_VALIDATION_PROCESS;
      equal(rejected, true, "recursive validation");
      pass("recursive validation process fails before child execution");
    }
    console.log(`Rehearsal Operation Security Process Drills: ${passed}/${passed} passed.`);
  } finally {
    for (const value of roots) rmSync(value, { recursive: true, force: true });
  }
}

if (process.argv[2] === "__child") {
  const [, , , mode, root, resultPath, variant] = process.argv;
  childMain(mode!, root!, resultPath!, variant!);
} else {
  void parentMain();
}
