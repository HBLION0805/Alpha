import {
  CollectionRunnerPilotState,
  CollectionRunnerTaskState,
  DurableFixtureRehearsalFailureDisposition,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type DurableFixtureRehearsalSnapshot,
} from "../../contracts";
import {
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
} from "../../contracts/EventContractCollectionRunnerRuntimeAssembly";
import {
  createDurableFixtureRehearsalEvidencePlan,
  createDurableFixtureRehearsalFailureReceipt,
  createDurableFixtureRehearsalInvocationReceipt,
  createDurableFixtureRehearsalOperationClaim,
  createDurableFixtureRehearsalRegistry,
  createDurableFixtureRehearsalTransition,
  DurableFixtureRehearsalContractError,
  verifyDurableFixtureRehearsalSnapshot,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalEngine";

const FP1 = "fnv1a64:1111111111111111";
const FP2 = "fnv1a64:2222222222222222";
const FP3 = "fnv1a64:3333333333333333";
const FP4 = "fnv1a64:4444444444444444";
const FP5 = "fnv1a64:5555555555555555";
const NOW = "2026-07-25T16:00:00.000Z";

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function throws(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    assertTrue(error instanceof DurableFixtureRehearsalContractError, "typed error");
    return;
  }
  throw new Error("Expected durable fixture rehearsal contract error.");
}

function registryInput(
  overrides: Partial<Parameters<typeof createDurableFixtureRehearsalRegistry>[0]> = {},
) {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
    rehearsalId: "rehearsal-1",
    manifestFingerprint: FP1,
    buildFingerprint: FP2,
    runnerFingerprint: FP3,
    frozenPlanFingerprint: FP4,
    catalogFingerprint: FP5,
    providerFingerprint: FP1,
    mappingFingerprint: FP2,
    activationId: "activation-1",
    taskSetFingerprint: FP3,
    workspaceIdentity: "workspace-1",
    storeIdentity: "store-1",
    lifecycleState: DurableFixtureRehearsalLifecycleState.Completed,
    lifecycleVersion: 6,
    nextInvocationOrdinal: 2,
    recoveryFingerprint: FP4,
    maximumInvocations: 3,
    scenarioResultFingerprint: null,
    executionPackageFingerprint: null,
    nonAuthorityDeclaration: "FIXTURE_ONLY",
    createdAtUtc: NOW,
    ...overrides,
  };
}

function transition(
  id: string,
  ordinal: number,
  fromState: DurableFixtureRehearsalLifecycleState,
  fromVersion: number,
  toState: DurableFixtureRehearsalLifecycleState,
) {
  return createDurableFixtureRehearsalTransition({
    transitionId: id,
    rehearsalId: "rehearsal-1",
    manifestFingerprint: FP1,
    ordinal,
    fromState,
    fromVersion,
    toState,
    reasonCode: `REASON_${fromVersion}`,
    occurredAtUtc: NOW,
  });
}

function claimInput(
  overrides: Partial<Parameters<typeof createDurableFixtureRehearsalOperationClaim>[0]> = {},
) {
  return {
    claimId: "claim-1",
    rehearsalId: "rehearsal-1",
    manifestFingerprint: FP1,
    phase: DurableFixtureRehearsalPhase.Step,
    invocationOrdinal: 1,
    expectedLifecycleVersion: 4,
    expectedRecoveryFingerprint: FP4,
    requestFingerprint: FP5,
    processSessionId: "session-1",
    bootIdentity: "boot-1",
    ownerAuthorizationId: null,
    claimedAtUtc: NOW,
    ...overrides,
  };
}

function claim() {
  return createDurableFixtureRehearsalOperationClaim(claimInput());
}

function receiptInput(
  overrides: Partial<Parameters<typeof createDurableFixtureRehearsalInvocationReceipt>[0]> = {},
) {
  return {
    receiptId: "receipt-1",
    claimId: "claim-1",
    rehearsalId: "rehearsal-1",
    manifestFingerprint: FP1,
    invocationOrdinal: 1,
    selectedAction: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit,
    resultingPilotState: CollectionRunnerPilotState.Completed,
    resultingTaskState: CollectionRunnerTaskState.Committed,
    outcome: CollectionRunnerRuntimeStepOutcome.Completed,
    terminalReportFingerprint: FP2,
    durableTransitionFingerprint: FP3,
    outboxChronologyFingerprint: FP4,
    recoveryFingerprint: FP5,
    observedAtUtc: NOW,
    ...overrides,
  };
}

function receipt() {
  return createDurableFixtureRehearsalInvocationReceipt(receiptInput());
}

function transitions() {
  return [
    transition("transition-1", 0, DurableFixtureRehearsalLifecycleState.Planned, 1, DurableFixtureRehearsalLifecycleState.Preparing),
    transition("transition-2", 0, DurableFixtureRehearsalLifecycleState.Preparing, 2, DurableFixtureRehearsalLifecycleState.Prepared),
    transition("transition-3", 1, DurableFixtureRehearsalLifecycleState.Prepared, 3, DurableFixtureRehearsalLifecycleState.Ready),
    transition("transition-4", 1, DurableFixtureRehearsalLifecycleState.Ready, 4, DurableFixtureRehearsalLifecycleState.Stepping),
    transition("transition-5", 1, DurableFixtureRehearsalLifecycleState.Stepping, 5, DurableFixtureRehearsalLifecycleState.Completed),
  ];
}

function validSnapshot(): DurableFixtureRehearsalSnapshot {
  return {
    registry: createDurableFixtureRehearsalRegistry(registryInput()),
    transitions: transitions(),
    claims: [claim()],
    invocationReceipts: [receipt()],
    failureReceipts: [],
    evidencePlan: null,
  };
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["registry is deterministic", () => {
    assertEqual(
      createDurableFixtureRehearsalRegistry(registryInput()).fingerprint,
      createDurableFixtureRehearsalRegistry(registryInput()).fingerprint,
      "fingerprint",
    );
  }],
  ["registry is deeply immutable", () => {
    const value = createDurableFixtureRehearsalRegistry(registryInput());
    assertTrue(Object.isFrozen(value), "registry");
  }],
  ["registry rejects unknown fields", () =>
    throws(() => createDurableFixtureRehearsalRegistry({
      ...registryInput(),
      injected: true,
    } as never))],
  ["registry rejects unsafe invocation bounds", () =>
    throws(() => createDurableFixtureRehearsalRegistry(
      registryInput({ maximumInvocations: 17 }),
    ))],
  ["registry rejects invalid scenario fingerprint", () =>
    throws(() => createDurableFixtureRehearsalRegistry(
      registryInput({ scenarioResultFingerprint: "bad" }),
    ))],
  ["transition increments the version", () =>
    assertEqual(transitions()[0]!.toVersion, 2, "to version")],
  ["transition rejects backward lifecycle", () =>
    throws(() => transition(
      "transition-bad",
      1,
      DurableFixtureRehearsalLifecycleState.Ready,
      4,
      DurableFixtureRehearsalLifecycleState.Prepared,
    ))],
  ["transition rejects terminal reopen", () =>
    throws(() => transition(
      "transition-bad",
      1,
      DurableFixtureRehearsalLifecycleState.EvidenceFrozen,
      8,
      DurableFixtureRehearsalLifecycleState.Ready,
    ))],
  ["step claim requires an ordinal", () =>
    throws(() => createDurableFixtureRehearsalOperationClaim(
      claimInput({ invocationOrdinal: null }),
    ))],
  ["ordinary claim rejects owner authorization", () =>
    throws(() => createDurableFixtureRehearsalOperationClaim({
      claimId: "claim-2",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      phase: DurableFixtureRehearsalPhase.Validate,
      invocationOrdinal: null,
      expectedLifecycleVersion: 6,
      expectedRecoveryFingerprint: FP2,
      requestFingerprint: FP3,
      processSessionId: "session-1",
      bootIdentity: "boot-1",
      ownerAuthorizationId: "owner-auth-1",
      claimedAtUtc: NOW,
    }))],
  ["recovery claim requires owner authorization", () =>
    throws(() => createDurableFixtureRehearsalOperationClaim({
      claimId: "claim-2",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      phase: DurableFixtureRehearsalPhase.Recover,
      invocationOrdinal: null,
      expectedLifecycleVersion: 5,
      expectedRecoveryFingerprint: FP2,
      requestFingerprint: FP3,
      processSessionId: "session-1",
      bootIdentity: "boot-1",
      ownerAuthorizationId: null,
      claimedAtUtc: NOW,
    }))],
  ["valid recovery claim is accepted", () =>
    assertEqual(createDurableFixtureRehearsalOperationClaim({
      claimId: "claim-2",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      phase: DurableFixtureRehearsalPhase.Recover,
      invocationOrdinal: null,
      expectedLifecycleVersion: 5,
      expectedRecoveryFingerprint: FP2,
      requestFingerprint: FP3,
      processSessionId: "session-1",
      bootIdentity: "boot-1",
      ownerAuthorizationId: "owner-auth-1",
      claimedAtUtc: NOW,
    }).phase, DurableFixtureRehearsalPhase.Recover, "phase")],
  ["invocation receipt is immutable", () =>
    assertTrue(Object.isFrozen(receipt()), "receipt")],
  ["invocation receipt rejects unknown action", () =>
    throws(() => createDurableFixtureRehearsalInvocationReceipt(
      receiptInput({ selectedAction: "INJECTED" as never }),
    ))],
  ["failure receipt is deterministic", () => {
    const input = {
      failureId: "failure-1",
      claimId: "claim-2",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      phase: DurableFixtureRehearsalPhase.Recover,
      disposition: DurableFixtureRehearsalFailureDisposition.RecoveryRequired,
      reasonCode: "AMBIGUOUS_ACTION",
      terminalReportFingerprint: null,
      observedRecoveryFingerprint: FP2,
      occurredAtUtc: NOW,
    };
    assertEqual(
      createDurableFixtureRehearsalFailureReceipt(input).fingerprint,
      createDurableFixtureRehearsalFailureReceipt(input).fingerprint,
      "failure fingerprint",
    );
  }],
  ["failure receipt rejects invalid disposition", () =>
    throws(() => createDurableFixtureRehearsalFailureReceipt({
      failureId: "failure-1",
      claimId: "claim-2",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      phase: DurableFixtureRehearsalPhase.Recover,
      disposition: "SUCCESS",
      reasonCode: "BAD",
      terminalReportFingerprint: null,
      observedRecoveryFingerprint: FP2,
      occurredAtUtc: NOW,
    } as never))],
  ["evidence plan binds planned immutable identities", () => {
    const plan = createDurableFixtureRehearsalEvidencePlan({
      evidencePlanId: "plan-1",
      freezeClaimId: "claim-freeze-1",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      validationReceiptFingerprint: FP2,
      validationSuiteFingerprint: FP3,
      plannedBackupId: "backup-1",
      plannedPackageId: "package-1",
      plannedEnvelopeId: "envelope-1",
      retentionPolicyVersion: "1.0",
      terminalFreezeFingerprint: FP4,
      nonAuthorityDeclaration: "FIXTURE_ONLY",
      frozenAtUtc: NOW,
    });
    assertTrue(Object.isFrozen(plan), "evidence plan");
  }],
  ["complete snapshot verifies", () =>
    assertEqual(verifyDurableFixtureRehearsalSnapshot(validSnapshot()).valid, true, "valid")],
  ["snapshot verification is deterministic", () =>
    assertEqual(
      verifyDurableFixtureRehearsalSnapshot(validSnapshot()).fingerprint,
      verifyDurableFixtureRehearsalSnapshot(validSnapshot()).fingerprint,
      "verification fingerprint",
    )],
  ["tampered registry fingerprint fails", () => {
    const value = validSnapshot();
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      registry: { ...value.registry, fingerprint: FP5 },
    });
    assertTrue(result.issueCodes.includes("REGISTRY_FINGERPRINT_MISMATCH"), "issue");
  }],
  ["transition gap fails", () => {
    const value = validSnapshot();
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      transitions: value.transitions.filter((item) => item.toVersion !== 3),
    });
    assertTrue(result.issueCodes.includes("TRANSITION_HISTORY_MISMATCH"), "issue");
  }],
  ["projection mismatch fails", () => {
    const value = validSnapshot();
    const registry = createDurableFixtureRehearsalRegistry(registryInput({
      lifecycleState: DurableFixtureRehearsalLifecycleState.Ready,
    }));
    const result = verifyDurableFixtureRehearsalSnapshot({ ...value, registry });
    assertTrue(result.issueCodes.includes("REGISTRY_PROJECTION_MISMATCH"), "issue");
  }],
  ["duplicate lifecycle claim fails", () => {
    const value = validSnapshot();
    const duplicate = createDurableFixtureRehearsalOperationClaim(claimInput({
      claimId: "claim-duplicate",
      requestFingerprint: FP1,
    }));
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      claims: [...value.claims, duplicate],
    });
    assertTrue(result.issueCodes.includes("CLAIM_BINDING_MISMATCH"), "issue");
  }],
  ["receipt must bind a step claim", () => {
    const value = validSnapshot();
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      claims: [],
    });
    assertTrue(result.issueCodes.includes("INVOCATION_RECEIPT_BINDING_MISMATCH"), "issue");
  }],
  ["invocation ordinals must be contiguous", () => {
    const value = validSnapshot();
    const changed = createDurableFixtureRehearsalInvocationReceipt(receiptInput({
      receiptId: "receipt-2",
      invocationOrdinal: 2,
    }));
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      invocationReceipts: [changed],
      registry: createDurableFixtureRehearsalRegistry(registryInput({
        nextInvocationOrdinal: 2,
      })),
    });
    assertTrue(result.issueCodes.includes("INVOCATION_ORDINAL_GAP"), "issue");
  }],
  ["next invocation projection must match receipts", () => {
    const value = validSnapshot();
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      registry: createDurableFixtureRehearsalRegistry(registryInput({
        nextInvocationOrdinal: 3,
      })),
    });
    assertTrue(result.issueCodes.includes("NEXT_INVOCATION_ORDINAL_MISMATCH"), "issue");
  }],
  ["unresolved claim requires STEPPING", () => {
    const value = validSnapshot();
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      invocationReceipts: [],
      registry: createDurableFixtureRehearsalRegistry(registryInput({
        nextInvocationOrdinal: 1,
      })),
    });
    assertTrue(result.issueCodes.includes("UNRESOLVED_CLAIM_MISMATCH"), "issue");
  }],
  ["STEPPING permits one unresolved STEP and one unresolved RECOVER claim", () => {
    const value = validSnapshot();
    const recoveryClaim = createDurableFixtureRehearsalOperationClaim(claimInput({
      claimId: "claim-recover",
      phase: DurableFixtureRehearsalPhase.Recover,
      invocationOrdinal: null,
      expectedLifecycleVersion: 5,
      requestFingerprint: FP1,
      ownerAuthorizationId: "authorization-1",
    }));
    const steppingTransitions = transitions().slice(0, 4);
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      transitions: steppingTransitions,
      claims: [claim(), recoveryClaim],
      invocationReceipts: [],
      registry: createDurableFixtureRehearsalRegistry(registryInput({
        lifecycleState: DurableFixtureRehearsalLifecycleState.Stepping,
        lifecycleVersion: 5,
        nextInvocationOrdinal: 1,
      })),
    });
    assertEqual(result.valid, true, "valid");
  }],
  ["READY may complete without entering another step", () => {
    const completed = createDurableFixtureRehearsalTransition({
      transitionId: "transition-ready-complete",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      ordinal: 1,
      fromState: DurableFixtureRehearsalLifecycleState.Ready,
      fromVersion: 4,
      toState: DurableFixtureRehearsalLifecycleState.Completed,
      reasonCode: "SCENARIO_COMPLETE",
      occurredAtUtc: NOW,
    });
    assertEqual(
      completed.toState,
      DurableFixtureRehearsalLifecycleState.Completed,
      "to state",
    );
    assertEqual(completed.toVersion, 5, "to version");
  }],
  ["evidence-frozen registry requires a plan", () => {
    const value = validSnapshot();
    const extra = [
      transition("transition-6", 1, DurableFixtureRehearsalLifecycleState.Completed, 6, DurableFixtureRehearsalLifecycleState.Validated),
      transition("transition-7", 1, DurableFixtureRehearsalLifecycleState.Validated, 7, DurableFixtureRehearsalLifecycleState.EvidenceFrozen),
    ];
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...value,
      transitions: [...value.transitions, ...extra],
      registry: createDurableFixtureRehearsalRegistry(registryInput({
        lifecycleState: DurableFixtureRehearsalLifecycleState.EvidenceFrozen,
        lifecycleVersion: 8,
      })),
    });
    assertTrue(result.issueCodes.includes("EVIDENCE_PLAN_MISSING"), "issue");
  }],
  ["plan before evidence freeze fails", () => {
    const value = validSnapshot();
    const plan = createDurableFixtureRehearsalEvidencePlan({
      evidencePlanId: "plan-1",
      freezeClaimId: "claim-freeze-1",
      rehearsalId: "rehearsal-1",
      manifestFingerprint: FP1,
      validationReceiptFingerprint: FP2,
      validationSuiteFingerprint: FP3,
      plannedBackupId: "backup-1",
      plannedPackageId: "package-1",
      plannedEnvelopeId: "envelope-1",
      retentionPolicyVersion: "1.0",
      terminalFreezeFingerprint: FP4,
      nonAuthorityDeclaration: "FIXTURE_ONLY",
      frozenAtUtc: NOW,
    });
    const result = verifyDurableFixtureRehearsalSnapshot({ ...value, evidencePlan: plan });
    assertTrue(result.issueCodes.includes("EVIDENCE_PLAN_MISMATCH"), "issue");
  }],
  ["unknown snapshot field fails closed", () => {
    const result = verifyDurableFixtureRehearsalSnapshot({
      ...validSnapshot(),
      injected: true,
    } as never);
    assertEqual(result.valid, false, "valid");
  }],
];

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`Durable Fixture Rehearsal contracts: ${passed}/${tests.length} passed.`);
