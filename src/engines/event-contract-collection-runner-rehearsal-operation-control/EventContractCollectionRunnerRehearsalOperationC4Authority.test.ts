import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process, { argv, env, execPath } from "node:process";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_VALIDATION_POLICY,
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationResultDisposition,
  CollectionRunnerRehearsalOperationVerificationDisposition,
  DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
  type CollectionRunnerRehearsalOperationAuthorizationReceipt,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationResultReceipt,
  type CollectionRunnerRehearsalOperationValidationAuthority,
  type CollectionRunnerRehearsalOperationValidationReceipt,
} from "../../contracts";
import {
  EventContractCollectionRunnerRehearsalOperationControlSqliteStore,
} from "../../repositories/EventContractCollectionRunnerRehearsalOperationControlSqliteStore";
import type {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation";
import {
  packageC1Phase,
  prepareC1Phase,
  readC1PhaseState,
  stepC1Phase,
  validateC1Phase,
  freezeC1Phase,
} from "../../../scripts/fixtures/collection-runner-durable-rehearsal-c1-phase-fixture";
import {
  FixedOperationValidationReceiptJournal,
  FixedFreshProcessDualStoreOperationVerifier,
} from "./EventContractCollectionRunnerRehearsalOperationVerification";

const AT = "2026-07-26T18:00:00.000Z";
const REHEARSAL_MANIFEST = `fnv1a64:${"1".repeat(16)}`;
const FP = (value: string): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function seal<T extends object>(body: T): T & {
  readonly deterministic: true;
  readonly fingerprint: string;
} {
  return Object.freeze({
    ...body,
    deterministic: true as const,
    fingerprint: `sha256:${createHash("sha256")
      .update(canonical(body), "utf8")
      .digest("hex")}`,
  });
}

function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

interface ChildAuthorityFile {
  readonly manifest: CollectionRunnerRehearsalOperationManifest;
  readonly authority: CollectionRunnerRehearsalOperationValidationAuthority;
  readonly repositoryCommit: string;
  readonly validationSuiteFingerprint: string;
  readonly envelopeFingerprint: string;
  readonly validationReceiptFingerprint: string;
}

function runPositiveVerifierChild(
  root: string,
  authorityPath: string,
): void {
  const value = JSON.parse(
    readFileSync(authorityPath, "utf8"),
  ) as ChildAuthorityFile;
  const registry = {
    getOperation: (operationId: string) =>
      operationId === value.manifest.operationId ? value.manifest : null,
    getValidationAuthority: (fingerprint: string) =>
      fingerprint === value.authority.fingerprint ? value.authority : null,
  } as unknown as CollectionRunnerRehearsalOperationRegistry;
  const verifier = new FixedFreshProcessDualStoreOperationVerifier(
    registry,
    [{
      evidenceRootId: "evidence-root-c1",
      path: join(root, "evidence"),
    }],
    [{
      manifestFingerprint: REHEARSAL_MANIFEST,
      repositoryCommit: value.repositoryCommit,
      validationPolicyVersion: DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY,
      validationSuiteFingerprint: value.validationSuiteFingerprint,
      registeredTestTotal: 1,
    }],
    join(root, "control"),
    join(root, "source"),
    "runner",
  );
  const report = verifier.verify({
    operationId: value.manifest.operationId,
    manifestFingerprint: value.manifest.fingerprint,
    evidenceRootId: "evidence-root-c1",
    envelopeFingerprint: value.envelopeFingerprint,
    validationReceiptFingerprint: value.validationReceiptFingerprint,
    observedAtUtc: AT,
  });
  if (
    report.disposition !==
      CollectionRunnerRehearsalOperationVerificationDisposition.Pass
  ) {
    console.error(JSON.stringify(report));
  }
  (process as unknown as { exit(code: number): never }).exit(
    report.disposition ===
      CollectionRunnerRehearsalOperationVerificationDisposition.Pass
      ? 0
      : 9,
  );
}

if (argv[2] === "--positive-verifier-child") {
  runPositiveVerifierChild(argv[3]!, argv[4]!);
}

function operationManifest(): CollectionRunnerRehearsalOperationManifest {
  const phasePlan: Array<{
    ordinal: number;
    phase: CollectionRunnerRehearsalOperationPhase;
    expectedStepOrdinal: number | null;
  }> = ([
    [CollectionRunnerRehearsalOperationPhase.Prepare, null],
    [CollectionRunnerRehearsalOperationPhase.Step, 1],
    [CollectionRunnerRehearsalOperationPhase.Step, 2],
    [CollectionRunnerRehearsalOperationPhase.Step, 3],
    [CollectionRunnerRehearsalOperationPhase.Validate, null],
    [CollectionRunnerRehearsalOperationPhase.Freeze, null],
    [CollectionRunnerRehearsalOperationPhase.Package, null],
    [CollectionRunnerRehearsalOperationPhase.Verify, null],
  ] as const).map(([phase, expectedStepOrdinal], index) => ({
    ordinal: index + 1,
    phase,
    expectedStepOrdinal,
  }));
  return {
    operationId: "operation:c4-positive",
    fingerprint: FP("operation-manifest"),
    deterministic: true,
    ownerApproval: {
      expiresAtUtc: "2026-07-27T18:00:00.000Z",
    },
    proposal: {
      rehearsalId: "rehearsal-1",
      rehearsalManifestFingerprint: REHEARSAL_MANIFEST,
      validationAuthorityFingerprint: FP("operation-validation-authority"),
      phasePlan,
    },
  } as unknown as CollectionRunnerRehearsalOperationManifest;
}

function authorization(
  manifest: CollectionRunnerRehearsalOperationManifest,
  ordinal: number,
  phase: CollectionRunnerRehearsalOperationPhase,
  expectedStepOrdinal: number | null,
): CollectionRunnerRehearsalOperationAuthorizationReceipt {
  const body = {
    authorizationId: `authorization:c4:${String(ordinal)}`,
    commandId: `command:c4:${String(ordinal)}`,
    commandFingerprint: FP(`command-${String(ordinal)}`),
    operationId: manifest.operationId,
    manifestFingerprint: manifest.fingerprint,
    phase,
    phasePlanOrdinal: ordinal,
    expectedLifecycleVersion: Math.max(1, ordinal),
    expectedInvocationOrdinal: expectedStepOrdinal,
    expectedRecoveryFingerprint: FP(`recovery-${String(ordinal)}`),
    authoritySnapshotFingerprint: FP(`authority-${String(ordinal)}`),
    ownerId: "owner:c4",
    ownerAuthorizationReference: `owner-reference:c4:${String(ordinal)}`,
    bootIdentity: "boot:c4",
    processSessionId: `session:c4:${String(ordinal)}`,
    authorizedAtUtc: AT,
    expiresAtUtc: "2026-07-27T18:00:00.000Z",
    consumedAtUtc: AT,
    consumed: true as const,
  };
  return seal(body);
}

function result(
  manifest: CollectionRunnerRehearsalOperationManifest,
  auth: CollectionRunnerRehearsalOperationAuthorizationReceipt,
  authorityEvidenceFingerprint: string,
): CollectionRunnerRehearsalOperationResultReceipt {
  return seal({
    resultId: `result:c4:${String(auth.phasePlanOrdinal)}`,
    authorizationId: auth.authorizationId,
    authorizationFingerprint: auth.fingerprint,
    commandId: auth.commandId,
    commandFingerprint: auth.commandFingerprint,
    operationId: manifest.operationId,
    manifestFingerprint: manifest.fingerprint,
    phase: auth.phase,
    phasePlanOrdinal: auth.phasePlanOrdinal,
    expectedInvocationOrdinal: auth.expectedInvocationOrdinal,
    processSessionId: auth.processSessionId,
    bootIdentity: auth.bootIdentity,
    disposition: CollectionRunnerRehearsalOperationResultDisposition.Completed,
    priorLifecycleVersion: auth.expectedLifecycleVersion,
    resultingLifecycleVersion: auth.expectedLifecycleVersion,
    priorLifecycleFingerprint: FP(`prior-${String(auth.phasePlanOrdinal)}`),
    resultingLifecycleFingerprint:
      FP(`resulting-${String(auth.phasePlanOrdinal)}`),
    authorityEvidenceFingerprint,
    sanitizedOutputDigest: FP(`output-${String(auth.phasePlanOrdinal)}`),
    startedAtUtc: AT,
    completedAtUtc: AT,
    nonAuthorityDeclaration:
      "FIXTURE_REHEARSAL_OPERATION_ONLY_NOT_LIVE_DATA_DATASET_RECOMMENDATION_OR_TRADING_AUTHORITY",
  });
}

async function positiveFreshProcessTest(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "alpha-c4-positive-"));
  try {
    prepareC1Phase(root, "a");
    stepC1Phase(root);
    stepC1Phase(root);
    stepC1Phase(root);
    validateC1Phase(root);
    freezeC1Phase(root);
    await packageC1Phase(root);
    const state = readC1PhaseState(root);
    truth(state.envelopeFingerprint !== null, "real envelope published");
    const envelopeFingerprint = state.envelopeFingerprint;
    if (envelopeFingerprint === null) {
      throw new Error("Real envelope was not published.");
    }

    const manifest = operationManifest();
    const authority = {
      fingerprint: manifest.proposal.validationAuthorityFingerprint,
      alphaCommit: state.repositoryCommit,
      packageFingerprint: FP("package"),
      validationSuiteFingerprint: state.validationSuiteFingerprint,
      registeredTestTotal: 1,
    } as CollectionRunnerRehearsalOperationValidationAuthority;
    const validationBody = {
      receiptId: "operation-validation:c4",
      operationId: manifest.operationId,
      rehearsalId: manifest.proposal.rehearsalId,
      manifestFingerprint: manifest.fingerprint,
      validationAuthorityFingerprint: authority.fingerprint,
      repositoryCommit: authority.alphaCommit,
      packageFingerprint: authority.packageFingerprint,
      validationSuiteFingerprint: authority.validationSuiteFingerprint,
      validationPolicyVersion:
        COLLECTION_RUNNER_REHEARSAL_OPERATION_VALIDATION_POLICY,
      recursionPolicyVersion:
        COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY,
      registeredTestTotal: 1,
      passedCount: 1,
      failedCount: 0,
      exitStatus: 0,
      startedAtUtc: AT,
      endedAtUtc: AT,
      sanitizedOutputDigest: FP("validation-output"),
      outputBytes: 1,
      networkPermitted: false as const,
      credentialAccessPermitted: false as const,
      passed: true as const,
    };
    const validationReceipt:
      CollectionRunnerRehearsalOperationValidationReceipt =
        seal(validationBody);
    const validationJournalRoot = join(root, "operation-validation-journal");
    const validationJournal =
      new FixedOperationValidationReceiptJournal(validationJournalRoot);
    validationJournal.append("authorization:c4:5", validationReceipt);
    truth(
      validationJournal.read("authorization:c4:5").fingerprint ===
        validationReceipt.fingerprint,
      "journaled validation receipt reopens exactly",
    );

    const controlRoot = join(root, "control");
    mkdirSync(controlRoot);
    const control =
      EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
        controlRoot,
        { createIfMissing: true },
      );
    try {
      for (const entry of manifest.proposal.phasePlan.slice(0, -1)) {
        const auth = authorization(
          manifest,
          entry.ordinal,
          entry.phase,
          entry.expectedStepOrdinal,
        );
        control.authorizeAndConsume(auth);
        const receipt = result(
          manifest,
          auth,
          entry.phase === CollectionRunnerRehearsalOperationPhase.Validate
            ? validationReceipt.fingerprint
            : FP(`phase-authority-${String(entry.ordinal)}`),
        );
        if (entry.phase === CollectionRunnerRehearsalOperationPhase.Validate) {
          control.appendValidationResult(validationReceipt, receipt);
        } else {
          control.appendResult(receipt);
        }
      }
    } finally {
      control.close();
    }

    const authorityPath = join(root, "c4-authority.json");
    writeFileSync(authorityPath, JSON.stringify({
      manifest,
      authority,
      repositoryCommit: state.repositoryCommit,
      validationSuiteFingerprint: state.validationSuiteFingerprint,
      envelopeFingerprint,
      validationReceiptFingerprint: validationReceipt.fingerprint,
    } satisfies ChildAuthorityFile));
    const child = spawnSync(
      execPath,
      [
        "--import",
        "tsx",
        realpathSync(argv[1]!),
        "--positive-verifier-child",
        root,
        authorityPath,
      ],
      {
        cwd: resolve("."),
        env: { ...env, ALPHA_REHEARSAL_FINAL_VERIFY_PROCESS: "1" },
        input: "",
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        killSignal: "SIGTERM",
      },
    );
    truth(
      child.status === 0,
      `positive fresh-process verifier (${child.stdout} ${child.stderr})`,
    );

    const journalPath = join(
      validationJournalRoot,
      readdirSync(validationJournalRoot)[0]!,
    );
    const journaled = JSON.parse(
      readFileSync(journalPath, "utf8"),
    ) as Record<string, unknown>;
    writeFileSync(
      journalPath,
      JSON.stringify({ ...journaled, passedCount: 0 }),
    );
    let journalTamperRejected = false;
    try {
      validationJournal.read("authorization:c4:5");
    } catch {
      journalTamperRejected = true;
    }
    truth(journalTamperRejected, "validation journal tamper rejected");

    const packageArtifact = join(
      root,
      "evidence",
      "rehearsal-envelope-c1-evidence",
      "package",
      "build-record.json",
    );
    const packageBody = JSON.parse(
      readFileSync(packageArtifact, "utf8"),
    ) as Record<string, unknown>;
    writeFileSync(
      packageArtifact,
      JSON.stringify({ ...packageBody, substitutedByC4: true }),
    );
    const substitutedPackageChild = spawnSync(
      execPath,
      [
        "--import",
        "tsx",
        realpathSync(argv[1]!),
        "--positive-verifier-child",
        root,
        authorityPath,
      ],
      {
        cwd: resolve("."),
        env: { ...env, ALPHA_REHEARSAL_FINAL_VERIFY_PROCESS: "1" },
        input: "",
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
        killSignal: "SIGTERM",
      },
    );
    truth(
      substitutedPackageChild.status !== 0,
      "substituted package rejected by fresh-process verifier",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

positiveFreshProcessTest()
  .then(() => {
    console.log(
      "PASS real rehearsal, Control, envelope, and backup verify in a fresh process",
    );
    console.log("PASS validation journal rejects durable receipt substitution");
    console.log("PASS fresh-process verifier rejects package substitution");
    console.log("Rehearsal Operation C4 Authority: 3/3 passed.");
  })
  .catch((error: unknown) => {
    console.error(error);
    (process as unknown as { exit(code: number): never }).exit(1);
  });
