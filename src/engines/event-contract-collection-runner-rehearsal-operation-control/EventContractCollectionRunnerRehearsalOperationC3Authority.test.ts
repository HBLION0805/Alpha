import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process, { argv, env, execPath } from "node:process";
import { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationResultDisposition,
  CollectionRunnerRehearsalOperationVerificationDisposition,
  DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  DurableFixtureRehearsalLifecycleState,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type CollectionRunnerRehearsalOperationAuthorizationReceipt,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommand,
  type CollectionRunnerRehearsalOperationPhaseEvidence,
} from "../../contracts";
import {
  EventContractCollectionRunnerFixtureRehearsalSqliteStore,
} from "../../repositories/EventContractCollectionRunnerFixtureRehearsalSqliteStore";
import {
  EventContractCollectionRunnerRehearsalOperationControlSqliteStore,
} from "../../repositories/EventContractCollectionRunnerRehearsalOperationControlSqliteStore";
import {
  createDurableFixtureRehearsalRegistry,
  createDurableFixtureRehearsalTransition,
} from "../event-contract-collection-runner-durable-fixture-rehearsal";
import {
  FixedQueryOnlyRehearsalOperationDurableTruth,
} from "./EventContractCollectionRunnerRehearsalOperationDurableObservation";
import {
  FixedClosedNonExecutableCollectionRunnerRehearsalOperationRuntime,
} from "./EventContractCollectionRunnerRehearsalOperationRuntimeComposition";
import {
  DigestBoundLocalFileIdentity,
  FixedFreshProcessDualStoreOperationVerifier,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";

const FP = (character: string) => `sha256:${character.repeat(64)}`;
const AT = "2026-07-26T14:00:00.000Z";

function sha(path: string): string {
  return `sha256:${createHash("sha256")
    .update(readFileSync(path))
    .digest("hex")}`;
}

function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function dualStoreChild(
  rehearsalRoot: string,
  controlRoot: string,
  evidenceRoot: string,
): void {
  const manifest = {
    operationId: "operation:observer",
    fingerprint: FP("b"),
    proposal: {
      rehearsalId: "rehearsal:observer",
      rehearsalManifestFingerprint: FP("1"),
    },
  } as CollectionRunnerRehearsalOperationManifest;
  const registry = {
    getOperation: (operationId: string) =>
      operationId === manifest.operationId ? manifest : null,
  } as unknown as import(
    "../event-contract-collection-runner-rehearsal-operation"
  ).CollectionRunnerRehearsalOperationRegistry;
  const verifier = new FixedFreshProcessDualStoreOperationVerifier(
    registry,
    [{ evidenceRootId: "evidence:observer", path: evidenceRoot }],
    [{
      manifestFingerprint: FP("b"),
      repositoryCommit: "a".repeat(40),
      validationPolicyVersion: DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
      validationSuiteFingerprint: FP("f"),
      registeredTestTotal: 1,
    }],
    controlRoot,
    rehearsalRoot,
    "rehearsal-observer",
  );
  const report = verifier.verify({
    operationId: manifest.operationId,
    manifestFingerprint: manifest.fingerprint,
    evidenceRootId: "evidence:observer",
    envelopeFingerprint: FP("e"),
    validationReceiptFingerprint: FP("d"),
    observedAtUtc: AT,
  });
  (process as unknown as { exit(code: number): never }).exit(
    report.disposition ===
      CollectionRunnerRehearsalOperationVerificationDisposition.FailClosed
      ? 0
      : 8,
  );
}

if (argv[2] === "--dual-store-child") {
  dualStoreChild(argv[3]!, argv[4]!, argv[5]!);
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["query-only rehearsal observer reconstructs durable phase truth", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-c3-durable-observer-"));
    let writableStore:
      EventContractCollectionRunnerFixtureRehearsalSqliteStore | null = null;
    try {
      const store = EventContractCollectionRunnerFixtureRehearsalSqliteStore
        .open({
          rootDirectory: root,
          storeId: "rehearsal-observer",
          applicationBuildFingerprint: "fnv1a64:aaaaaaaaaaaaaaaa",
          appliedAtUtc: AT,
        });
      writableStore = store;
      const storePath = store.getReadiness().storePath;
      const registry = createDurableFixtureRehearsalRegistry({
        schemaVersion:
          EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
        rehearsalId: "rehearsal:observer",
        manifestFingerprint: FP("1"),
        buildFingerprint: FP("2"),
        runnerFingerprint: FP("3"),
        frozenPlanFingerprint: FP("4"),
        catalogFingerprint: FP("5"),
        providerFingerprint: FP("6"),
        mappingFingerprint: FP("7"),
        activationId: "activation:observer",
        taskSetFingerprint: FP("8"),
        workspaceIdentity: "workspace:observer",
        storeIdentity: "store:observer",
        lifecycleState: DurableFixtureRehearsalLifecycleState.Prepared,
        lifecycleVersion: 3,
        nextInvocationOrdinal: 1,
        recoveryFingerprint: FP("9"),
        maximumInvocations: 1,
        scenarioResultFingerprint: null,
        executionPackageFingerprint: null,
        nonAuthorityDeclaration: "FIXTURE_ONLY",
        createdAtUtc: AT,
      });
      const preparing = createDurableFixtureRehearsalTransition({
        transitionId: "transition:observer:1",
        rehearsalId: "rehearsal:observer",
        manifestFingerprint: FP("1"),
        ordinal: 0,
        fromState: DurableFixtureRehearsalLifecycleState.Planned,
        fromVersion: 1,
        toState: DurableFixtureRehearsalLifecycleState.Preparing,
        reasonCode: "PREPARATION_STARTED",
        occurredAtUtc: AT,
      });
      const prepared = createDurableFixtureRehearsalTransition({
        transitionId: "transition:observer:2",
        rehearsalId: "rehearsal:observer",
        manifestFingerprint: FP("1"),
        ordinal: 0,
        fromState: DurableFixtureRehearsalLifecycleState.Preparing,
        fromVersion: 2,
        toState: DurableFixtureRehearsalLifecycleState.Prepared,
        reasonCode: "PREPARATION_COMPLETED",
        occurredAtUtc: AT,
      });
      store.close();
      writableStore = null;
      const seed = new DatabaseSync(storePath);
      try {
        seed.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;");
        seed.prepare(`
INSERT INTO runner_definitions (
 runner_definition_id, version, fingerprint, build_fingerprint,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?)
`).run(
          "runner:observer", "1.0", "fnv1a64:1111111111111111",
          "fnv1a64:2222222222222222", "{}", AT,
        );
        seed.prepare(`
INSERT INTO pilot_activations (
 activation_id, activation_fingerprint, owner_id, approved_at_utc,
 starts_at_utc, stops_at_utc, frozen_plan_id, frozen_plan_fingerprint,
 runner_definition_id, runner_definition_version, maximum_events,
 maximum_requests, current_state, aggregate_version,
 canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
          "activation:observer", "fnv1a64:3333333333333333",
          "owner:observer", AT, AT, "2026-07-26T15:00:00.000Z",
          "plan:observer", "fnv1a64:4444444444444444",
          "runner:observer", "1.0", 1, 1, "COMPLETED", 1, "{}", AT,
        );
        seed.prepare(`
INSERT INTO fixture_rehearsals (
 rehearsal_id, manifest_fingerprint, schema_version, schema_profile,
 build_fingerprint, runner_fingerprint, frozen_plan_fingerprint,
 catalog_fingerprint, provider_fingerprint, mapping_fingerprint,
 activation_id, task_set_fingerprint, workspace_identity, store_identity,
 lifecycle_state, lifecycle_version, next_invocation_ordinal,
 recovery_fingerprint, maximum_invocations, scenario_result_fingerprint,
 execution_package_fingerprint, non_authority_declaration,
 canonical_record_json, record_fingerprint, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
          registry.rehearsalId, registry.manifestFingerprint,
          registry.schemaVersion, registry.schemaProfile,
          registry.buildFingerprint, registry.runnerFingerprint,
          registry.frozenPlanFingerprint, registry.catalogFingerprint,
          registry.providerFingerprint, registry.mappingFingerprint,
          registry.activationId, registry.taskSetFingerprint,
          registry.workspaceIdentity, registry.storeIdentity,
          registry.lifecycleState, registry.lifecycleVersion,
          registry.nextInvocationOrdinal, registry.recoveryFingerprint,
          registry.maximumInvocations, registry.scenarioResultFingerprint,
          registry.executionPackageFingerprint, registry.nonAuthorityDeclaration,
          JSON.stringify(registry), registry.fingerprint, registry.createdAtUtc,
        );
        const insertTransition = seed.prepare(`
INSERT INTO fixture_rehearsal_transitions (
 transition_id, rehearsal_id, manifest_fingerprint, ordinal, from_state,
 to_state, from_version, to_version, reason_code, transition_fingerprint,
 occurred_at_utc, canonical_record_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
        for (const transition of [preparing, prepared]) {
          insertTransition.run(
            transition.transitionId, transition.rehearsalId,
            transition.manifestFingerprint, transition.ordinal,
            transition.fromState, transition.toState,
            transition.fromVersion, transition.toVersion,
            transition.reasonCode, transition.fingerprint,
            transition.occurredAtUtc, JSON.stringify(transition),
          );
        }
        seed.exec("COMMIT;");
      } finally {
        seed.close();
      }
      const manifest = {
        operationId: "operation:observer",
        fingerprint: FP("b"),
        proposal: {
          rehearsalId: "rehearsal:observer",
          rehearsalManifestFingerprint: FP("1"),
        },
      } as CollectionRunnerRehearsalOperationManifest;
      const command = {
        operationId: "operation:observer",
        manifestFingerprint: FP("b"),
        fingerprint: FP("c"),
        phase: CollectionRunnerRehearsalOperationPhase.Prepare,
        expectedInvocationOrdinal: null,
      } as CollectionRunnerRehearsalOperationPhaseCommand;
      const authorization = {
        commandFingerprint: FP("c"),
        manifestFingerprint: FP("b"),
      } as CollectionRunnerRehearsalOperationAuthorizationReceipt;
      const evidence: CollectionRunnerRehearsalOperationPhaseEvidence = {
        disposition: CollectionRunnerRehearsalOperationResultDisposition.Completed,
        priorLifecycleVersion: 1,
        resultingLifecycleVersion: 3,
        priorLifecycleFingerprint: preparing.fingerprint,
        resultingLifecycleFingerprint: registry.fingerprint,
        authorityEvidenceFingerprint: registry.fingerprint,
        sanitizedOutputDigest: FP("d"),
        startedAtUtc: AT,
        completedAtUtc: AT,
      };
      const observer = new FixedQueryOnlyRehearsalOperationDurableTruth(
        root,
        "rehearsal-observer",
      );
      const reconstructed = observer.observe(
        manifest,
        command,
        authorization,
        evidence,
      );
      truth(
        reconstructed.resultingLifecycleFingerprint === registry.fingerprint,
        "durable registry reconstructed",
      );
      let rejected = false;
      try {
        observer.observe(manifest, command, authorization, {
          ...evidence,
          authorityEvidenceFingerprint: FP("e"),
        });
      } catch {
        rejected = true;
      }
      truth(rejected, "claimed in-memory authority substitution rejected");
      const controlRoot = join(root, "control");
      const evidenceRoot = join(root, "evidence");
      mkdirSync(controlRoot);
      mkdirSync(evidenceRoot);
      EventContractCollectionRunnerRehearsalOperationControlSqliteStore
        .open(controlRoot, { createIfMissing: true })
        .close();
      const child = spawnSync(
        execPath,
        [
          "--import", "tsx",
          realpathSync(argv[1]!),
          "--dual-store-child",
          root,
          controlRoot,
          evidenceRoot,
        ],
        {
          cwd: resolve("."),
          env: { ...env, ALPHA_REHEARSAL_FINAL_VERIFY_PROCESS: "1" },
          input: "",
          encoding: "utf8",
          shell: false,
          windowsHide: true,
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
          killSignal: "SIGTERM",
        },
      );
      truth(
        child.status === 0,
        `fresh-process dual-store verification (${child.stderr})`,
      );
      const fixedRegistry = {
        getOperation: () => manifest,
      } as unknown as import(
        "../event-contract-collection-runner-rehearsal-operation"
      ).CollectionRunnerRehearsalOperationRegistry;
      const phase = {
        invokeOne: () => evidence,
      };
      const fixedRuntime =
        new FixedClosedNonExecutableCollectionRunnerRehearsalOperationRuntime({
          registry: fixedRegistry,
          controlRoot,
          rehearsalRoot: root,
          rehearsalStoreId: "rehearsal-observer",
          evidenceRoots: [{
            evidenceRootId: "evidence:observer",
            path: evidenceRoot,
          }],
          evidenceValidationAuthorities: [{
            manifestFingerprint: manifest.fingerprint,
            repositoryCommit: "a".repeat(40),
            validationPolicyVersion:
              DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
            validationSuiteFingerprint: FP("f"),
            registeredTestTotal: 1,
          }],
          readiness: { inspect: () => { throw new Error("not invoked"); } },
          ownerVerifier: { verify: () => { throw new Error("not invoked"); } },
          stop: {
            assertClear: () => undefined,
            trip: () => "stop:not-invoked",
          },
          ownership: { acquire: () => { throw new Error("not invoked"); } },
          mutationPhases: {
            PREPARE: phase,
            STEP: phase,
            VALIDATE: phase,
            FREEZE: phase,
            PACKAGE: phase,
          },
          validationReceipts: {
            take: () => { throw new Error("not invoked"); },
          },
        });
      truth(
        fixedRuntime.disposition === "NON_EXECUTABLE_PENDING_INDEPENDENT_MR4",
        "fixed runtime remains non-executable",
      );
      fixedRuntime.close();
    } finally {
      writableStore?.close();
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["digest-bound local identity rejects same-path substitution", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-c3-file-identity-"));
    const path = join(root, "executable.bin");
    try {
      writeFileSync(path, "reviewed");
      const identity = new DigestBoundLocalFileIdentity(path, sha(path));
      identity.assertCurrent();
      writeFileSync(path, "substituted");
      let rejected = false;
      try {
        identity.assertCurrent();
      } catch {
        rejected = true;
      }
      truth(rejected, "substitution rejected");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["network bootstrap enforces exact guard and Git invocation authority", () => {
    const repositoryRoot = realpathSync(resolve("."));
    const node = realpathSync(execPath);
    const gitLookup = spawnSync("where.exe", ["git"], {
      cwd: repositoryRoot,
      input: "",
      encoding: "utf8",
      shell: false,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      killSignal: "SIGTERM",
    });
    const gitCandidate = gitLookup.stdout
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .find(Boolean);
    truth(gitLookup.status === 0 && gitCandidate !== undefined, "Git available");
    const git = realpathSync(gitCandidate!);
    const nodeGuard = realpathSync(
      join(repositoryRoot, "scripts", "network-disabled-bootstrap.cjs"),
    );
    const pythonGuard = realpathSync(
      join(
        repositoryRoot,
        "scripts",
        "network-disabled-python",
        "sitecustomize.py",
      ),
    );
    const clean: Record<string, string> = {};
    for (const key of [
      "Path", "PATH", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR",
      "TEMP", "TMP", "ComSpec",
    ]) {
      if (typeof env[key] === "string") clean[key] = env[key]!;
    }
    Object.assign(clean, {
      ALPHA_NETWORK_DISABLED: "1",
      ALPHA_VALIDATION_REPOSITORY_ROOT: repositoryRoot,
      ALPHA_ALLOWED_NODE_EXECUTABLE: node,
      ALPHA_ALLOWED_NODE_FINGERPRINT: sha(node),
      ALPHA_ALLOWED_GIT_EXECUTABLE: git,
      ALPHA_ALLOWED_GIT_FINGERPRINT: sha(git),
      ALPHA_ALLOWED_PYTHON_EXECUTABLE: node,
      ALPHA_ALLOWED_PYTHON_FINGERPRINT: sha(node),
      ALPHA_NODE_GUARD_PATH: nodeGuard,
      ALPHA_NODE_GUARD_FINGERPRINT: sha(nodeGuard),
      ALPHA_PYTHON_GUARD_PATH: pythonGuard,
      ALPHA_PYTHON_GUARD_FINGERPRINT: sha(pythonGuard),
      NODE_OPTIONS: `--require=${nodeGuard}`,
      PYTHONPATH: resolve(pythonGuard, ".."),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "NUL",
    });
    const probe = spawnSync(node, ["-e", `
const cp = require("node:child_process");
let helperDenied = false;
try {
  cp.spawnSync(process.env.ALPHA_ALLOWED_GIT_EXECUTABLE,
    ["-c", "core.fsmonitor=malicious", "status", "--short"]);
} catch { helperDenied = true; }
let helperEnvironmentDenied = false;
try {
  cp.spawnSync(process.env.ALPHA_ALLOWED_GIT_EXECUTABLE,
    ["status", "--short"], {
      cwd: process.cwd(),
      env: {...process.env, GIT_EXTERNAL_DIFF: "malicious-helper"}
    });
} catch { helperEnvironmentDenied = true; }
let alteredGuardDenied = false;
try {
  cp.spawnSync(process.execPath, ["scripts/validation-reporting.test.mjs"], {
    env: {...process.env, NODE_OPTIONS: "--require=unreviewed.cjs"}
  });
} catch { alteredGuardDenied = true; }
const allowed = cp.spawnSync(process.env.ALPHA_ALLOWED_GIT_EXECUTABLE,
  ["status", "--short"], {encoding: "utf8"});
console.log(JSON.stringify({
  helperDenied,
  helperEnvironmentDenied,
  alteredGuardDenied,
  allowedStatus: allowed.status,
  allowedError: allowed.error?.code ?? null,
  allowedStderr: allowed.stderr
}));
process.exit(
  helperDenied && helperEnvironmentDenied && alteredGuardDenied &&
  allowed.error === undefined && allowed.status !== null
    ? 0
    : 9
);
`], {
      cwd: repositoryRoot,
      env: clean,
      input: "",
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
      killSignal: "SIGTERM",
    });
    truth(
      probe.status === 0,
      `exact bootstrap authority (${probe.stdout} ${probe.stderr})`,
    );
  }],
];

for (const [name, run] of tests) {
  run();
  console.log(`PASS ${name}`);
}
console.log(`Rehearsal Operation C3 Authority: ${tests.length}/${tests.length} passed.`);
