import {
  COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalFaultScenario,
  CollectionRunnerRehearsalLifecycleState,
  CollectionRunnerRehearsalVerificationDisposition,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type CollectionRunnerRehearsalEvidencePackage,
  type CollectionRunnerRehearsalEvidencePackageInput,
  type CollectionRunnerRehearsalInvocationReceiptInput,
  type CollectionRunnerRehearsalManifestInput,
} from "../../contracts";
import {
  CollectionRunnerRehearsalContractError,
  createCollectionRunnerRehearsalEvidencePackage,
  createCollectionRunnerRehearsalInvocationReceipt,
  createCollectionRunnerRehearsalLifecycleTransition,
  createCollectionRunnerRehearsalManifest,
  createCollectionRunnerRehearsalPreparationReceipt,
  verifyCollectionRunnerRehearsalEvidencePackage,
  verifyCollectionRunnerRehearsalManifest,
} from "./EventContractCollectionRunnerFixtureRehearsalEngine";

const A = `sha256:${"a".repeat(64)}`;
const B = `sha256:${"b".repeat(64)}`;
const C = `sha256:${"c".repeat(64)}`;
const D = `sha256:${"d".repeat(64)}`;
const E = `sha256:${"e".repeat(64)}`;
const NOW = "2026-07-25T14:00:00.000Z";

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
}
function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}
function throws(run: () => unknown, code: string, label: string): void {
  try {
    run();
  } catch (error) {
    if (error instanceof CollectionRunnerRehearsalContractError && error.code === code) return;
    throw error;
  }
  throw new Error(`${label}: expected ${code}.`);
}

function manifestInput(
  changes: Partial<CollectionRunnerRehearsalManifestInput> = {},
): CollectionRunnerRehearsalManifestInput {
  return {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
    policyVersion: "1.0",
    scenarioId: "scenario:happy-path",
    scenarioPurpose: "Deterministic fixture rehearsal",
    ownerApprovalId: "approval:fixture",
    ownerApprovalFingerprint: A,
    ownerApprovalExpiresAtUtc: "2026-07-26T14:00:00.000Z",
    buildFingerprint: B,
    runnerFingerprint: C,
    frozenPlanFingerprint: D,
    fixtureCatalogFingerprint: E,
    fixturePackageFingerprint: A,
    providerFingerprint: B,
    mappingFingerprint: C,
    syntheticActivationFingerprint: D,
    syntheticTaskFingerprint: E,
    runtimeConfigurationTemplateFingerprint: A,
    expectedInvocations: [
      {
        ordinal: 1,
        action: CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue,
        resultingTaskState: CollectionRunnerTaskState.Due,
      },
      {
        ordinal: 2,
        action: CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask,
        resultingTaskState: CollectionRunnerTaskState.Committed,
      },
      {
        ordinal: 3,
        action: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
        resultingTaskState: CollectionRunnerTaskState.Committed,
      },
    ],
    expectedPilotState: CollectionRunnerPilotState.Completed,
    expectedTaskState: CollectionRunnerTaskState.Committed,
    expectedOutboxRecordIds: ["outbox:1"],
    maximumInvocations: 3,
    faultScenario: CollectionRunnerRehearsalFaultScenario.None,
    evidencePackagePolicyVersion: "1.0",
    retentionPolicyVersion: "1.0",
    nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
    ...changes,
  };
}

function receiptInput(
  ordinal: number,
  changes: Partial<CollectionRunnerRehearsalInvocationReceiptInput> = {},
): CollectionRunnerRehearsalInvocationReceiptInput {
  const expected = manifestInput().expectedInvocations[ordinal - 1]!;
  return {
    rehearsalId: manifest.rehearsalId,
    manifestFingerprint: manifest.fingerprint,
    ordinal,
    expectedStateVersion: ordinal,
    recoveryFingerprint: A,
    selectedAction: expected.action,
    resultingTaskState: expected.resultingTaskState,
    outcome: CollectionRunnerRuntimeStepOutcome.Completed,
    durableTransitionFingerprint: B,
    terminalReportFingerprint: C,
    processSessionId: `session:${ordinal}`,
    bootIdentity: `boot:${ordinal}`,
    observedAtUtc: NOW,
    elapsedMonotonicMilliseconds: 10,
    ...changes,
  };
}

const manifest = createCollectionRunnerRehearsalManifest(manifestInput());
const receipts = [1, 2, 3].map((ordinal) =>
  createCollectionRunnerRehearsalInvocationReceipt(manifest, receiptInput(ordinal)),
);
const transitions = [
  createCollectionRunnerRehearsalLifecycleTransition({
    rehearsalId: manifest.rehearsalId,
    manifestFingerprint: manifest.fingerprint,
    ordinal: 1,
    fromState: CollectionRunnerRehearsalLifecycleState.Planned,
    fromVersion: 1,
    toState: CollectionRunnerRehearsalLifecycleState.Prepared,
    reasonCode: "PREPARED",
  }),
];
const preparationReceipt = createCollectionRunnerRehearsalPreparationReceipt(manifest, {
  rehearsalId: manifest.rehearsalId,
  manifestFingerprint: manifest.fingerprint,
  fixtureCatalogEntryFingerprint: E,
  runtimeConfigurationFingerprint: A,
  seededStoreFingerprint: B,
  preparationTransitionFingerprint: transitions[0]!.fingerprint,
});

function packageInput(
  changes: Partial<CollectionRunnerRehearsalEvidencePackageInput> = {},
): CollectionRunnerRehearsalEvidencePackageInput {
  return {
    manifest,
    fixtureCatalogEntryFingerprint: E,
    preparationReceipt,
    lifecycleTransitions: transitions,
    invocationReceipts: receipts,
    terminalReportFingerprints: [A, B, C],
    recoveryReportFingerprints: [D],
    ownershipReceiptIds: ["ownership:1"],
    terminalSummary: {
      pilotState: CollectionRunnerPilotState.Completed,
      taskState: CollectionRunnerTaskState.Committed,
      budgetFingerprint: E,
      leaseOpen: false,
      attemptOpen: false,
    },
    outboxRecords: [{ recordId: "outbox:1", ordinal: 1, occurredAtUtc: NOW, fingerprint: D }],
    sqliteQuickCheckPassed: true,
    sqliteIntegrityCheckPassed: true,
    backupManifestFingerprint: A,
    backupDigest: B,
    validationSuiteFingerprint: C,
    validationPassed: true,
    archiveDisposition: "RETAINED",
    inventory: [{ relativePath: "records/manifest.json", byteLength: 100, digest: D }],
    packageBytesExcludingBackup: 1_000,
    workspaceIdentity: "workspace:one",
    storeIdentity: "store:one",
    packageCreatedAtUtc: NOW,
    nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
    ...changes,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["manifest is deterministic", () => equal(createCollectionRunnerRehearsalManifest(manifestInput()).fingerprint, manifest.fingerprint, "fingerprint")],
  ["manifest identity derives from content", () => truth(manifest.rehearsalId.includes(manifest.fingerprint.slice(7, 31)), "derived identity")],
  ["manifest is deeply immutable", () => truth(Object.isFrozen(manifest) && Object.isFrozen(manifest.expectedInvocations), "immutable")],
  ["manifest verifies", () => truth(verifyCollectionRunnerRehearsalManifest(manifest), "verification")],
  ["manifest rejects unknown root field", () => throws(() => createCollectionRunnerRehearsalManifest({ ...manifestInput(), rank: 1 } as CollectionRunnerRehearsalManifestInput), "UNKNOWN_FIELD", "unknown root")],
  ["manifest rejects unknown nested field", () => throws(() => createCollectionRunnerRehearsalManifest({ ...manifestInput(), expectedInvocations: [{ ...manifestInput().expectedInvocations[0]!, leverage: 3 }] } as unknown as CollectionRunnerRehearsalManifestInput), "UNKNOWN_FIELD", "unknown nested")],
  ["manifest rejects wrong schema", () => throws(() => createCollectionRunnerRehearsalManifest({ ...manifestInput(), schemaVersion: "2.0" } as unknown as CollectionRunnerRehearsalManifestInput), "INVALID_SCHEMA_VERSION", "schema")],
  ["manifest rejects bad fingerprint", () => throws(() => createCollectionRunnerRehearsalManifest(manifestInput({ buildFingerprint: "bad" })), "INVALID_FIELD", "fingerprint")],
  ["manifest rejects undeclared action", () => throws(() => createCollectionRunnerRehearsalManifest(manifestInput({ expectedInvocations: [{ ...manifestInput().expectedInvocations[0]!, action: "TRADE" as CollectionRunnerRuntimeAssemblyAction }] })), "INVALID_ENUM", "action enum")],
  ["manifest rejects undeclared fault scenario", () => throws(() => createCollectionRunnerRehearsalManifest(manifestInput({ faultScenario: "LIVE_RUN" as CollectionRunnerRehearsalFaultScenario })), "INVALID_ENUM", "fault enum")],
  ["manifest rejects skipped ordinal", () => throws(() => createCollectionRunnerRehearsalManifest(manifestInput({ expectedInvocations: [{ ...manifestInput().expectedInvocations[0]!, ordinal: 2 }] })), "INVALID_ORDINAL", "ordinal")],
  ["manifest rejects invocation overflow", () => throws(() => createCollectionRunnerRehearsalManifest(manifestInput({ maximumInvocations: 1 })), "INVALID_BOUND", "overflow")],
  ["manifest rejects duplicate Outbox identities", () => throws(() => createCollectionRunnerRehearsalManifest(manifestInput({ expectedOutboxRecordIds: ["outbox:1", "outbox:1"] })), "DUPLICATE_IDENTITY", "duplicate")],
  ["manifest rejects authority substitution", () => throws(() => createCollectionRunnerRehearsalManifest({ ...manifestInput(), nonAuthorityDeclaration: "TRADING_AUTHORITY" } as unknown as CollectionRunnerRehearsalManifestInput), "INVALID_AUTHORITY", "authority")],
  ["lifecycle permits planned to prepared", () => equal(transitions[0]!.toVersion, 2, "version")],
  ["lifecycle rejects backward move", () => throws(() => createCollectionRunnerRehearsalLifecycleTransition({ rehearsalId: manifest.rehearsalId, manifestFingerprint: manifest.fingerprint, ordinal: 1, fromState: CollectionRunnerRehearsalLifecycleState.Prepared, fromVersion: 2, toState: CollectionRunnerRehearsalLifecycleState.Planned, reasonCode: "BACKWARD" }), "INVALID_TRANSITION", "backward")],
  ["lifecycle rejects terminal reopen", () => throws(() => createCollectionRunnerRehearsalLifecycleTransition({ rehearsalId: manifest.rehearsalId, manifestFingerprint: manifest.fingerprint, ordinal: 1, fromState: CollectionRunnerRehearsalLifecycleState.VerificationFailed, fromVersion: 2, toState: CollectionRunnerRehearsalLifecycleState.Planned, reasonCode: "REOPEN" }), "INVALID_TRANSITION", "reopen")],
  ["receipt is immutable", () => truth(Object.isFrozen(receipts[0]!), "receipt immutable")],
  ["receipt rejects action substitution", () => throws(() => createCollectionRunnerRehearsalInvocationReceipt(manifest, receiptInput(1, { selectedAction: CollectionRunnerRuntimeAssemblyAction.WaitAndExit })), "INVOCATION_MISMATCH", "action")],
  ["receipt rejects task-state substitution", () => throws(() => createCollectionRunnerRehearsalInvocationReceipt(manifest, receiptInput(1, { resultingTaskState: CollectionRunnerTaskState.Committed })), "INVOCATION_MISMATCH", "state")],
  ["receipt rejects out-of-range ordinal", () => throws(() => createCollectionRunnerRehearsalInvocationReceipt(manifest, receiptInput(1, { ordinal: 9 })), "INVOCATION_MISMATCH", "range")],
  ["complete package passes", () => equal(verifyCollectionRunnerRehearsalEvidencePackage(createCollectionRunnerRehearsalEvidencePackage(packageInput())).disposition, CollectionRunnerRehearsalVerificationDisposition.Pass, "pass")],
  ["missing receipt is incomplete", () => equal(verifyCollectionRunnerRehearsalEvidencePackage(createCollectionRunnerRehearsalEvidencePackage(packageInput({ invocationReceipts: receipts.slice(0, 2), terminalReportFingerprints: [A, B] }))).disposition, CollectionRunnerRehearsalVerificationDisposition.Incomplete, "incomplete")],
  ["missing inventory is incomplete", () => equal(verifyCollectionRunnerRehearsalEvidencePackage(createCollectionRunnerRehearsalEvidencePackage(packageInput({ inventory: [] }))).disposition, CollectionRunnerRehearsalVerificationDisposition.Incomplete, "inventory")],
  ["failed SQLite quick check fails closed", () => equal(verifyCollectionRunnerRehearsalEvidencePackage(createCollectionRunnerRehearsalEvidencePackage(packageInput({ sqliteQuickCheckPassed: false }))).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "quick check")],
  ["failed validation suite fails closed", () => equal(verifyCollectionRunnerRehearsalEvidencePackage(createCollectionRunnerRehearsalEvidencePackage(packageInput({ validationPassed: false }))).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "validation")],
  ["open lease fails closed", () => equal(verifyCollectionRunnerRehearsalEvidencePackage(createCollectionRunnerRehearsalEvidencePackage(packageInput({ terminalSummary: { ...packageInput().terminalSummary, leaseOpen: true } }))).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "lease")],
  ["Outbox mismatch fails closed", () => equal(verifyCollectionRunnerRehearsalEvidencePackage(createCollectionRunnerRehearsalEvidencePackage(packageInput({ outboxRecords: [] }))).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "outbox")],
  ["changed action in package fails closed", () => {
    const changed = clone(createCollectionRunnerRehearsalEvidencePackage(packageInput()));
    (changed.invocationReceipts as unknown as Array<{ selectedAction: CollectionRunnerRuntimeAssemblyAction }>)[0]!.selectedAction = CollectionRunnerRuntimeAssemblyAction.WaitAndExit;
    equal(verifyCollectionRunnerRehearsalEvidencePackage(changed).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "changed action");
  }],
  ["tampered scenario fingerprint fails closed", () => {
    const changed = { ...createCollectionRunnerRehearsalEvidencePackage(packageInput()), scenarioResultFingerprint: A };
    equal(verifyCollectionRunnerRehearsalEvidencePackage(changed).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "scenario tamper");
  }],
  ["tampered package fingerprint fails closed", () => {
    const changed = { ...createCollectionRunnerRehearsalEvidencePackage(packageInput()), fingerprint: A };
    equal(verifyCollectionRunnerRehearsalEvidencePackage(changed).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "package tamper");
  }],
  ["tampered receipt fingerprint fails closed", () => {
    const changedReceipt = { ...receipts[0]!, fingerprint: A };
    const changed = createCollectionRunnerRehearsalEvidencePackage(packageInput({ invocationReceipts: [changedReceipt, ...receipts.slice(1)] }));
    equal(verifyCollectionRunnerRehearsalEvidencePackage(changed).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "receipt tamper");
  }],
  ["unknown package field fails closed", () => {
    const changed = { ...createCollectionRunnerRehearsalEvidencePackage(packageInput()), probability: 0.9 } as unknown as CollectionRunnerRehearsalEvidencePackage;
    equal(verifyCollectionRunnerRehearsalEvidencePackage(changed).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "unknown package field");
  }],
  ["changed lifecycle fingerprint fails closed", () => {
    const changedTransition = { ...transitions[0]!, fingerprint: A };
    const changed = createCollectionRunnerRehearsalEvidencePackage(packageInput({ lifecycleTransitions: [changedTransition] }));
    equal(verifyCollectionRunnerRehearsalEvidencePackage(changed).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "lifecycle tamper");
  }],
  ["execution fingerprint changes with workspace", () => {
    const one = createCollectionRunnerRehearsalEvidencePackage(packageInput());
    const two = createCollectionRunnerRehearsalEvidencePackage(packageInput({ workspaceIdentity: "workspace:two" }));
    truth(one.executionPackageFingerprint !== two.executionPackageFingerprint, "execution differs");
  }],
  ["scenario fingerprint excludes workspace", () => {
    const one = createCollectionRunnerRehearsalEvidencePackage(packageInput());
    const two = createCollectionRunnerRehearsalEvidencePackage(packageInput({ workspaceIdentity: "workspace:two", storeIdentity: "store:two", packageCreatedAtUtc: "2026-07-25T15:00:00.000Z" }));
    equal(one.scenarioResultFingerprint, two.scenarioResultFingerprint, "scenario stable");
  }],
  ["scenario fingerprint excludes process identity and timing", () => {
    const altered = receipts.map((receipt) => ({ ...receipt, processSessionId: `other:${receipt.ordinal}`, bootIdentity: `other-boot:${receipt.ordinal}`, observedAtUtc: "2026-07-25T15:00:00.000Z", elapsedMonotonicMilliseconds: 999 }));
    equal(createCollectionRunnerRehearsalEvidencePackage(packageInput({ invocationReceipts: altered })).scenarioResultFingerprint, createCollectionRunnerRehearsalEvidencePackage(packageInput()).scenarioResultFingerprint, "environment excluded");
  }],
  ["malformed package fails closed", () => equal(verifyCollectionRunnerRehearsalEvidencePackage({} as CollectionRunnerRehearsalEvidencePackage).disposition, CollectionRunnerRehearsalVerificationDisposition.FailClosed, "malformed")],
];

let passed = 0;
for (const [name, run] of tests) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`Event Contract Collection Runner fixture rehearsal: ${passed}/${tests.length} passed.`);
