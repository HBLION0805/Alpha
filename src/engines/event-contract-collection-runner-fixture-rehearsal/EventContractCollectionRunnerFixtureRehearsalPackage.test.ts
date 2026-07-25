import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import * as nodeFs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process, { cwd } from "node:process";

import {
  COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalFaultScenario,
  CollectionRunnerRehearsalLifecycleState,
  CollectionRunnerRehearsalScenarioPhase,
  CollectionRunnerRehearsalVerificationDisposition,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeCleanupDisposition,
  CollectionRunnerRuntimeHealthStatus,
  CollectionRunnerRuntimeInvocationState,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type CollectionRunnerRehearsalPackageInventoryEntry,
  type CollectionRunnerRehearsalPreparationResult,
  type CollectionRunnerRehearsalStepResult,
} from "../../contracts";
import { createCollectionRunnerRuntimeTerminalReport } from "../event-contract-collection-runner-runtime";
import {
  createCollectionRunnerRehearsalInvocationReceipt,
  createCollectionRunnerRehearsalLifecycleTransition,
  createCollectionRunnerRehearsalManifest,
  createCollectionRunnerRehearsalPreparationReceipt,
} from "./EventContractCollectionRunnerFixtureRehearsalEngine";
import {
  CollectionRunnerRehearsalPackageError,
  CollectionRunnerRehearsalPackageErrorCode,
  EventContractCollectionRunnerFixtureRehearsalPackageBuilder,
  EventContractCollectionRunnerFixtureRehearsalPackageVerifier,
  type CollectionRunnerRehearsalPackageBuildRequest,
} from "./EventContractCollectionRunnerFixtureRehearsalPackage";

const FNV_A = "fnv1a64:aaaaaaaaaaaaaaaa";
const FNV_B = "fnv1a64:bbbbbbbbbbbbbbbb";
const SHA_A = `sha256:${"a".repeat(64)}`;
const SHA_B = `sha256:${"b".repeat(64)}`;
const SHA_C = `sha256:${"c".repeat(64)}`;
const SHA_D = `sha256:${"d".repeat(64)}`;
const SHA_E = `sha256:${"e".repeat(64)}`;
const NOW = "2026-07-25T16:00:00.000Z";

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
}

function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function throws(run: () => unknown, code: CollectionRunnerRehearsalPackageErrorCode, label: string): void {
  try {
    run();
  } catch (error) {
    if (error instanceof CollectionRunnerRehearsalPackageError && error.code === code) return;
    throw error;
  }
  throw new Error(`${label}: expected ${code}.`);
}

export const packageTestManifest = createCollectionRunnerRehearsalManifest({
  schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  policyVersion: "1.0",
  scenarioId: "scenario:package",
  scenarioPurpose: "Package one completed fixture rehearsal",
  ownerApprovalId: "approval:package",
  ownerApprovalFingerprint: SHA_A,
  ownerApprovalExpiresAtUtc: "2026-07-26T16:00:00.000Z",
  buildFingerprint: FNV_A,
  runnerFingerprint: FNV_B,
  frozenPlanFingerprint: SHA_B,
  fixtureCatalogFingerprint: SHA_C,
  fixturePackageFingerprint: SHA_D,
  providerFingerprint: FNV_A,
  mappingFingerprint: FNV_B,
  syntheticActivationFingerprint: SHA_A,
  syntheticTaskFingerprint: SHA_B,
  runtimeConfigurationTemplateFingerprint: SHA_C,
  expectedInvocations: [{
    ordinal: 1,
    action: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
    resultingTaskState: CollectionRunnerTaskState.Committed,
  }],
  expectedPilotState: CollectionRunnerPilotState.Completed,
  expectedTaskState: CollectionRunnerTaskState.Committed,
  expectedOutboxRecordIds: [],
  maximumInvocations: 1,
  faultScenario: CollectionRunnerRehearsalFaultScenario.None,
  evidencePackagePolicyVersion: "1.0",
  retentionPolicyVersion: "1.0",
  nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
});

const manifest = packageTestManifest;
const prepared = createCollectionRunnerRehearsalLifecycleTransition({
  rehearsalId: packageTestManifest.rehearsalId,
  manifestFingerprint: packageTestManifest.fingerprint,
  ordinal: 1,
  fromState: CollectionRunnerRehearsalLifecycleState.Planned,
  fromVersion: 1,
  toState: CollectionRunnerRehearsalLifecycleState.Prepared,
  reasonCode: "WORKSPACE_PREPARED",
});
const ready = createCollectionRunnerRehearsalLifecycleTransition({
  rehearsalId: manifest.rehearsalId,
  manifestFingerprint: manifest.fingerprint,
  ordinal: 1,
  fromState: CollectionRunnerRehearsalLifecycleState.Prepared,
  fromVersion: prepared.toVersion,
  toState: CollectionRunnerRehearsalLifecycleState.Ready,
  reasonCode: "PREPARATION_VERIFIED",
});
const stepping = createCollectionRunnerRehearsalLifecycleTransition({
  rehearsalId: manifest.rehearsalId,
  manifestFingerprint: manifest.fingerprint,
  ordinal: 1,
  fromState: CollectionRunnerRehearsalLifecycleState.Ready,
  fromVersion: ready.toVersion,
  toState: CollectionRunnerRehearsalLifecycleState.Stepping,
  reasonCode: "FOREGROUND_ACTION_STARTED",
});
const stepReady = createCollectionRunnerRehearsalLifecycleTransition({
  rehearsalId: manifest.rehearsalId,
  manifestFingerprint: manifest.fingerprint,
  ordinal: 1,
  fromState: CollectionRunnerRehearsalLifecycleState.Stepping,
  fromVersion: stepping.toVersion,
  toState: CollectionRunnerRehearsalLifecycleState.Ready,
  reasonCode: "FOREGROUND_ACTION_COMPLETED",
});
const completed = createCollectionRunnerRehearsalLifecycleTransition({
  rehearsalId: manifest.rehearsalId,
  manifestFingerprint: manifest.fingerprint,
  ordinal: 1,
  fromState: CollectionRunnerRehearsalLifecycleState.Ready,
  fromVersion: stepReady.toVersion,
  toState: CollectionRunnerRehearsalLifecycleState.Completed,
  reasonCode: "REHEARSAL_ACTIONS_COMPLETED",
});

const preparationReceipt = createCollectionRunnerRehearsalPreparationReceipt(manifest, {
  rehearsalId: manifest.rehearsalId,
  manifestFingerprint: manifest.fingerprint,
  fixtureCatalogEntryFingerprint: SHA_E,
  runtimeConfigurationFingerprint: SHA_A,
  seededStoreFingerprint: SHA_B,
  preparationTransitionFingerprint: prepared.fingerprint,
  workspaceIdentity: "workspace:package",
  storePathIdentity: SHA_C,
  schemaCatalogFingerprint: SHA_D,
});

const preparation = {
  manifest,
  catalogEntry: {
    catalogEntryId: "catalog:package",
    catalogFingerprint: SHA_C,
    fixturePackageFingerprint: SHA_D,
    fingerprint: SHA_E,
  },
  workspace: { workspaceIdentity: "workspace:package" },
  runtimePaths: { storePathIdentity: SHA_C },
  lifecycleTransition: prepared,
  preparationReceipt,
} as unknown as CollectionRunnerRehearsalPreparationResult;

const terminalReport = createCollectionRunnerRuntimeTerminalReport({
  schemaVersion: "1.0",
  configurationFingerprint: SHA_A,
  pathFingerprint: SHA_B,
  storeIdentity: SHA_C,
  lockFingerprint: SHA_D,
  bootIdentity: "boot:package",
  processSessionId: "process:package",
  activationId: "activation:package",
  buildFingerprint: FNV_A,
  invocationId: "invocation:package:1",
  startedAtUtc: NOW,
  endedAtUtc: "2026-07-25T16:00:01.000Z",
  elapsedMonotonicMilliseconds: 1_000,
  finalState: CollectionRunnerRuntimeInvocationState.Closed,
  outcome: CollectionRunnerRuntimeStepOutcome.NoWork,
  healthStatus: CollectionRunnerRuntimeHealthStatus.Healthy,
  blockerCodes: [],
  action: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
  taskId: null,
  reasonCode: "REHEARSAL_COMPLETE",
  durableMutationAttempted: false,
  durableReceiptFingerprint: null,
  stopBarrierTripped: false,
  cleanupDisposition: CollectionRunnerRuntimeCleanupDisposition.VerifiedCleanRelease,
  ambiguityPreserved: false,
  recoveryRequired: false,
});
const invocationReceipt = createCollectionRunnerRehearsalInvocationReceipt(manifest, {
  rehearsalId: manifest.rehearsalId,
  manifestFingerprint: manifest.fingerprint,
  ordinal: 1,
  expectedStateVersion: prepared.toVersion,
  recoveryFingerprint: SHA_B,
  selectedAction: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
  resultingTaskState: CollectionRunnerTaskState.Committed,
  outcome: CollectionRunnerRuntimeStepOutcome.NoWork,
  durableTransitionFingerprint: null,
  terminalReportFingerprint: terminalReport.fingerprint,
  processSessionId: "process:package",
  bootIdentity: "boot:package",
  observedAtUtc: terminalReport.endedAtUtc,
  elapsedMonotonicMilliseconds: terminalReport.elapsedMonotonicMilliseconds,
});
const stepResult = {
  request: {
    rehearsalId: manifest.rehearsalId,
    manifestFingerprint: manifest.fingerprint,
    expectedInvocationOrdinal: 1,
    expectedLifecycleVersion: prepared.toVersion,
    expectedRecoveryFingerprint: SHA_B,
    scenarioPhase: CollectionRunnerRehearsalScenarioPhase.TerminalObservation,
    invocationId: "invocation:package:1",
    maximumTasks: 1,
    ownerAuthorizationId: null,
  },
  terminalReport,
  durableState: {
    pilotState: CollectionRunnerPilotState.Completed,
    taskState: CollectionRunnerTaskState.Committed,
  },
  invocationReceipt,
  lifecycleTransitions: [ready, stepping, stepReady, completed],
  resultingLifecycleState: CollectionRunnerRehearsalLifecycleState.Completed,
  resultingLifecycleVersion: completed.toVersion,
  replayed: false,
} as unknown as CollectionRunnerRehearsalStepResult;

export function createPackageTestRequest(rootId = "root:package", changes: Partial<CollectionRunnerRehearsalPackageBuildRequest> = {}): CollectionRunnerRehearsalPackageBuildRequest {
  return {
    preparation,
    stepResults: [stepResult],
    evidence: {
      terminalSummary: {
        pilotState: CollectionRunnerPilotState.Completed,
        taskState: CollectionRunnerTaskState.Committed,
        budgetFingerprint: SHA_A,
        leaseOpen: false,
        attemptOpen: false,
      },
      outboxRecords: [],
      recoveryReportFingerprints: [SHA_B],
      ownershipReceiptIds: ["ownership:package"],
      sqliteQuickCheckPassed: true,
      sqliteIntegrityCheckPassed: true,
      backupManifestFingerprint: SHA_C,
      backupDigest: SHA_D,
      validationSuiteFingerprint: SHA_A,
      validationPassed: true,
      archiveDisposition: "RETAINED_FOR_OWNER_REVIEW",
    },
    packageRootId: rootId,
    packageCreatedAtUtc: "2026-07-25T16:01:00.000Z",
    stopBarrierTripped: false,
    ...changes,
  };
}

function withRoot(run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-rehearsal-package-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const VERIFIED_EVIDENCE = {
  verifyBoundEvidence: () => true,
};

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["repository paths cannot become package roots", () => {
    throws(
      () => new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
        { packageRootId: "root:repository", path: cwd() },
      ], VERIFIED_EVIDENCE),
      CollectionRunnerRehearsalPackageErrorCode.UnsafeRoot,
      "repository root",
    );
  }],
  ["unverified SQLite backup or validation evidence is rejected before mutation", () => withRoot((root) => {
    const builder = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(
      cwd(),
      [{ packageRootId: "root:package", path: root }],
      { verifyBoundEvidence: () => false },
    );
    throws(
      () => builder.build(createPackageTestRequest()),
      CollectionRunnerRehearsalPackageErrorCode.VerificationFailed,
      "evidence gate",
    );
    equal(
      existsSync(join(root, `rehearsal-${manifest.fingerprint.slice(7, 31)}-evidence`)),
      false,
      "no package",
    );
  })],
  ["builds and independently verifies one bounded package", () => withRoot((root) => {
    const result = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE).build(createPackageTestRequest());
    equal(result.verification.disposition, CollectionRunnerRehearsalVerificationDisposition.Pass, "verification");
    equal(result.evidencePackage.inventory.length, 15, "inventory");
    truth(existsSync(join(result.packageDirectory, "evidence-package.json")), "package envelope");
  })],
  ["exact replay returns the same package without rewriting", () => withRoot((root) => {
    const builder = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE);
    const first = builder.build(createPackageTestRequest());
    const before = readFileSync(join(first.packageDirectory, "evidence-package.json"), "utf8");
    const replay = builder.build(createPackageTestRequest());
    equal(replay.replayed, true, "replayed");
    equal(replay.evidencePackage.fingerprint, first.evidencePackage.fingerprint, "package identity");
    equal(readFileSync(join(first.packageDirectory, "evidence-package.json"), "utf8"), before, "unchanged envelope");
  })],
  ["changed package replay is rejected", () => withRoot((root) => {
    const builder = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE);
    builder.build(createPackageTestRequest());
    throws(
      () => builder.build(createPackageTestRequest("root:package", { packageCreatedAtUtc: "2026-07-25T16:02:00.000Z" })),
      CollectionRunnerRehearsalPackageErrorCode.PackageConflict,
      "changed replay",
    );
  })],
  ["Stop barrier blocks package creation before filesystem mutation", () => withRoot((root) => {
    const builder = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE);
    throws(
      () => builder.build(createPackageTestRequest("root:package", { stopBarrierTripped: true })),
      CollectionRunnerRehearsalPackageErrorCode.StateConflict,
      "Stop",
    );
    equal((existsSync(join(root, `rehearsal-${manifest.fingerprint.slice(7, 31)}-evidence`))), false, "no package");
  })],
  ["incomplete staging is quarantined without deletion", () => withRoot((root) => {
    const suffix = manifest.fingerprint.slice(7, 31);
    const staging = join(root, `rehearsal-${suffix}-evidence.staging`);
    mkdirSync(staging);
    writeFileSync(join(staging, "partial.json"), "{}\n", { encoding: "utf8" });
    const result = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE).build(createPackageTestRequest());
    truth(existsSync(result.packageDirectory), "package");
    const names = (nodeFs as unknown as { readdirSync(path: string): string[] }).readdirSync(root);
    truth(names.some((name) => name.startsWith(`rehearsal-${suffix}-evidence.quarantine-`)), "quarantine retained");
    truth(existsSync(staging) === false, "staging moved");
  })],
  ["artifact digest substitution fails independent verification", () => withRoot((root) => {
    const result = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE).build(createPackageTestRequest());
    writeFileSync(join(result.packageDirectory, "archive.json"), "{\"disposition\":\"ALTERED\"}\n", { encoding: "utf8" });
    const verified = new EventContractCollectionRunnerFixtureRehearsalPackageVerifier().verify(result.packageDirectory);
    equal(verified.disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "tamper disposition");
    truth(verified.issueCodes.includes("ARTIFACT_DIGEST_MISMATCH"), "tamper issue");
  })],
  ["unexpected artifact fails independent verification", () => withRoot((root) => {
    const result = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE).build(createPackageTestRequest());
    writeFileSync(join(result.packageDirectory, "secret.json"), "{\"secret\":\"forbidden\"}\n", { encoding: "utf8" });
    const verified = new EventContractCollectionRunnerFixtureRehearsalPackageVerifier().verify(result.packageDirectory);
    equal(verified.disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "unexpected disposition");
    truth(verified.issueCodes.includes("PACKAGE_FILE_SET_MISMATCH"), "unexpected issue");
  })],
  ["leakage in a terminal report is rejected before commit", () => withRoot((root) => {
    const leakedStep = {
      ...stepResult,
      terminalReport: { ...terminalReport, secret: "api-key" },
    } as unknown as CollectionRunnerRehearsalStepResult;
    const builder = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE);
    throws(
      () => builder.build(createPackageTestRequest("root:package", { stepResults: [leakedStep] })),
      CollectionRunnerRehearsalPackageErrorCode.LeakageDetected,
      "leakage",
    );
  })],
  ["scenario fingerprint is stable across execution time and root", () => {
    const firstRoot = mkdtempSync(join(tmpdir(), "alpha-rehearsal-package-a-"));
    const secondRoot = mkdtempSync(join(tmpdir(), "alpha-rehearsal-package-b-"));
    try {
      const first = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
        { packageRootId: "root:a", path: firstRoot },
      ], VERIFIED_EVIDENCE).build(createPackageTestRequest("root:a"));
      const second = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
        { packageRootId: "root:b", path: secondRoot },
      ], VERIFIED_EVIDENCE).build(createPackageTestRequest("root:b", { packageCreatedAtUtc: "2026-07-25T16:03:00.000Z" }));
      equal(first.evidencePackage.scenarioResultFingerprint, second.evidencePackage.scenarioResultFingerprint, "scenario");
      truth(first.evidencePackage.executionPackageFingerprint !== second.evidencePackage.executionPackageFingerprint, "execution identity");
    } finally {
      rmSync(firstRoot, { recursive: true, force: true });
      rmSync(secondRoot, { recursive: true, force: true });
    }
  }],
  ["inventory remains bounded and content addressed", () => withRoot((root) => {
    const result = new EventContractCollectionRunnerFixtureRehearsalPackageBuilder(cwd(), [
      { packageRootId: "root:package", path: root },
    ], VERIFIED_EVIDENCE).build(createPackageTestRequest());
    truth(result.evidencePackage.inventory.every((entry: CollectionRunnerRehearsalPackageInventoryEntry) =>
      entry.byteLength > 0 && entry.digest.startsWith("sha256:")
    ), "inventory entries");
    truth(result.evidencePackage.packageBytesExcludingBackup > 0, "package bytes");
  })],
];

if (process.argv[1]?.endsWith("EventContractCollectionRunnerFixtureRehearsalPackage.test.ts")) {
  let passed = 0;
  for (const [name, run] of tests) {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  }
  console.log(`Event Contract Collection Runner fixture rehearsal package: ${passed}/${tests.length} passed.`);
}
