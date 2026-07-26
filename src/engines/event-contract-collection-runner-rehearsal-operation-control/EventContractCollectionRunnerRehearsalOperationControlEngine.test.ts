import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationPreflightDisposition,
  CollectionRunnerRehearsalOperationResultDisposition,
  CollectionRunnerRehearsalOperationRootPurpose,
  CollectionRunnerRehearsalOperationStopMode,
  EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerRehearsalOperationAuthorizationReceipt,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommandInput,
  type CollectionRunnerRehearsalOperationReadinessObservation,
  type CollectionRunnerRehearsalOperationResultReceipt,
  type CollectionRunnerRehearsalOperationStopReceipt,
  type CollectionRunnerRehearsalOperationRootRegistration,
} from "../../contracts";
import {
  CollectionRunnerRehearsalOperationControlStoreError,
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
  CollectionRunnerRehearsalOperationControlError,
  CollectionRunnerRehearsalOperationControlErrorCode,
  EventContractCollectionRunnerRehearsalOperationPhaseGate,
  createCollectionRunnerRehearsalOperationPhaseCommand,
  type CollectionRunnerRehearsalOperationControlRepository,
  type CollectionRunnerRehearsalOperationControlSnapshot,
  type CollectionRunnerRehearsalOperationOwnershipHandle,
} from "./EventContractCollectionRunnerRehearsalOperationControlEngine";
import {
  runCollectionRunnerRehearsalOperationControlConsole,
} from "./EventContractCollectionRunnerRehearsalOperationControlConsole";
import {
  CollectionRunnerRehearsalOperationFixedRootResolver,
  FixedLocalCollectionRunnerRehearsalOperationAlphaInspection,
} from "./EventContractCollectionRunnerRehearsalOperationPreflight";

const FP = (character: string) => `sha256:${character.repeat(64)}`;
const COMMIT = "a".repeat(40);
const CREATED = "2026-07-25T20:00:00.000Z";
const INVOKED = "2026-07-25T20:01:00.000Z";
const EXPIRES = "2026-07-25T20:05:00.000Z";

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function controlError(
  run: () => unknown,
  code: CollectionRunnerRehearsalOperationControlErrorCode,
): void {
  try {
    run();
  } catch (error) {
    if (
      error instanceof CollectionRunnerRehearsalOperationControlError &&
      error.code === code
    ) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const manifest = {
  operationId: "rehearsal-operation:test",
  fingerprint: FP("1"),
  deterministic: true,
  ownerApproval: {
    ownerId: "owner:test",
    expiresAtUtc: "2026-07-26T20:00:00.000Z",
  },
  proposal: {
    alphaCommit: COMMIT,
    rootRegistryFingerprint: FP("2"),
    validationAuthorityFingerprint: FP("3"),
    phasePlan: [
      {
        ordinal: 1,
        phase: CollectionRunnerRehearsalOperationPhase.Prepare,
        expectedStepOrdinal: null,
      },
      {
        ordinal: 2,
        phase: CollectionRunnerRehearsalOperationPhase.Step,
        expectedStepOrdinal: 1,
      },
      {
        ordinal: 3,
        phase: CollectionRunnerRehearsalOperationPhase.Validate,
        expectedStepOrdinal: null,
      },
      {
        ordinal: 4,
        phase: CollectionRunnerRehearsalOperationPhase.Freeze,
        expectedStepOrdinal: null,
      },
      {
        ordinal: 5,
        phase: CollectionRunnerRehearsalOperationPhase.Package,
        expectedStepOrdinal: null,
      },
      {
        ordinal: 6,
        phase: CollectionRunnerRehearsalOperationPhase.Verify,
        expectedStepOrdinal: null,
      },
    ],
  },
} as unknown as CollectionRunnerRehearsalOperationManifest;

function command(
  changes: Partial<CollectionRunnerRehearsalOperationPhaseCommandInput> = {},
): CollectionRunnerRehearsalOperationPhaseCommandInput {
  return {
    schemaVersion:
      EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
    commandId: "command:prepare:1",
    operationId: manifest.operationId,
    manifestFingerprint: manifest.fingerprint,
    phase: CollectionRunnerRehearsalOperationPhase.Prepare,
    expectedLifecycleVersion: 1,
    expectedInvocationOrdinal: null,
    expectedRecoveryFingerprint: FP("4"),
    alphaCommit: COMMIT,
    rootRegistryFingerprint: FP("2"),
    bootIdentity: "boot:test",
    processSessionId: "session:test",
    createdAtUtc: CREATED,
    expiresAtUtc: EXPIRES,
    challengeNonce: "nonce-operation-0001",
    ...changes,
  };
}

function observation(
  changes: Partial<CollectionRunnerRehearsalOperationReadinessObservation> = {},
): CollectionRunnerRehearsalOperationReadinessObservation {
  return {
    operationId: manifest.operationId,
    manifestFingerprint: manifest.fingerprint,
    observedAtUtc: INVOKED,
    alphaCommit: COMMIT,
    trackedTreeClean: true,
    packageFingerprint: FP("5"),
    validationSuiteFingerprint: FP("6"),
    registeredTestTotal: 2408,
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
    ownershipAvailable: true,
    processStopTripped: false,
    durableStopTripped: false,
    blockerCodes: [],
    incompleteCodes: [],
    ...changes,
  };
}

class FakeVerifier implements CollectionRunnerLocalOwnerVerifier {
  public calls = 0;
  public verify(
    input: VerifyCollectionRunnerLocalOwnerInput,
  ): CollectionRunnerLocalOwnerAuthorizationEvidence {
    this.calls += 1;
    if (input.secret !== "correct owner secret") throw new Error("rejected");
    return Object.freeze({
      authorityKind: "LOCAL_OWNER_VERIFIED",
      ownerId: input.ownerId,
      verifierId: "verifier:test",
      verifierVersion: "1.0",
      authorizationReference: FP("7"),
      challengeFingerprint: input.challengeFingerprint,
      verifiedAtUtc: input.verifiedAtUtc,
      expiresAtUtc: input.expiresAtUtc,
    });
  }
}

class InMemoryControlRepository
  implements CollectionRunnerRehearsalOperationControlRepository {
  public authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt | null = null;
  public result: CollectionRunnerRehearsalOperationResultReceipt | null = null;
  public stop: CollectionRunnerRehearsalOperationStopReceipt | null = null;

  public readSnapshot(): CollectionRunnerRehearsalOperationControlSnapshot {
    return {
      authorizationCount: this.authorization === null ? 0 : 1,
      resultCount: this.result === null ? 0 : 1,
      latestAuthorization: this.authorization,
      latestResult: this.result,
      stopReceipt: this.stop,
    };
  }
  public authorizeAndConsume(
    receipt: CollectionRunnerRehearsalOperationAuthorizationReceipt,
  ) {
    if (this.authorization !== null) throw new Error("duplicate");
    this.authorization = receipt;
    return receipt;
  }
  public appendResult(receipt: CollectionRunnerRehearsalOperationResultReceipt) {
    if (this.result !== null) throw new Error("duplicate");
    this.result = receipt;
    return receipt;
  }
  public appendStop(receipt: CollectionRunnerRehearsalOperationStopReceipt) {
    this.stop = receipt;
    return receipt;
  }
}

function registry(): CollectionRunnerRehearsalOperationRegistry {
  return {
    getOperation: (operationId: string) =>
      operationId === manifest.operationId ? structuredClone(manifest) : null,
    getValidationAuthority: (fingerprint: string) =>
      fingerprint === FP("3")
        ? {
          packageFingerprint: FP("5"),
          validationSuiteFingerprint: FP("6"),
          registeredTestTotal: 2408,
        }
        : null,
  } as unknown as CollectionRunnerRehearsalOperationRegistry;
}

function gate(options: {
  readonly repository?: CollectionRunnerRehearsalOperationControlRepository;
  readonly readiness?: CollectionRunnerRehearsalOperationReadinessObservation;
  readonly phaseFailure?: boolean;
  readonly stopInitially?: boolean;
} = {}) {
  const repository = options.repository ?? new InMemoryControlRepository();
  const verifier = new FakeVerifier();
  let stopped = options.stopInitially ?? false;
  let phaseCalls = 0;
  let released = 0;
  let ambiguous = 0;
  const ownership: CollectionRunnerRehearsalOperationOwnershipHandle = {
    releaseClean: () => { released += 1; },
    preserveAmbiguity: () => { ambiguous += 1; },
  };
  const service = new EventContractCollectionRunnerRehearsalOperationPhaseGate({
    registry: registry(),
    repository,
    readiness: {
      inspect: () => options.readiness ?? observation({
        durableStopTripped: stopped,
      }),
    },
    verifier,
    stop: {
      assertClear: () => {
        if (stopped) throw new Error("stopped");
      },
      trip: () => {
        stopped = true;
        return FP("8");
      },
    },
    ownership: { acquire: () => ownership },
    phase: {
      invokeOne: () => {
        phaseCalls += 1;
        if (options.phaseFailure) throw new Error("phase crashed");
        return {
          disposition: CollectionRunnerRehearsalOperationResultDisposition.Completed,
          priorLifecycleVersion: 1,
          resultingLifecycleVersion: 3,
          priorLifecycleFingerprint: FP("9"),
          resultingLifecycleFingerprint: FP("a"),
          authorityEvidenceFingerprint: FP("b"),
          sanitizedOutputDigest: FP("c"),
          startedAtUtc: INVOKED,
          completedAtUtc: "2026-07-25T20:01:01.000Z",
        };
      },
    },
  });
  return {
    service,
    repository,
    verifier,
    counters: {
      phaseCalls: () => phaseCalls,
      released: () => released,
      ambiguous: () => ambiguous,
    },
  };
}

function phaseArgs(action: "preflight" | "status" | "phase"): readonly string[] {
  return [
    action,
    `--operation-id=${manifest.operationId}`,
    `--manifest-fingerprint=${manifest.fingerprint}`,
    `--alpha-commit=${COMMIT}`,
    `--root-registry-fingerprint=${FP("2")}`,
    "--command-id=command:prepare:1",
    `--created-at=${CREATED}`,
    `--expires-at=${EXPIRES}`,
    "--nonce=nonce-operation-0001",
    "--phase=PREPARE",
    "--expected-lifecycle-version=1",
    "--expected-ordinal=null",
    `--expected-recovery-fingerprint=${FP("4")}`,
  ];
}

function rootResolver(changedIdentity = false) {
  const registrations = Object.values(CollectionRunnerRehearsalOperationRootPurpose)
    .map((purpose, index) => ({
      rootId: `root:${index}`,
      purpose,
      canonicalPath: `C:\\fixed-root-${index}`,
      pathIdentity: `path:${index}`,
      filesystemIdentityFingerprint: FP(String(index)),
      inspectionEvidenceFingerprint: FP(String(index + 1)),
      fingerprint: FP("d"),
    })) as unknown as readonly CollectionRunnerRehearsalOperationRootRegistration[];
  const rootManifest = {
    ...manifest,
    proposal: {
      ...manifest.proposal,
      rootBindings: registrations.map((root) => ({
        purpose: root.purpose,
        rootId: root.rootId,
        rootFingerprint: root.fingerprint,
      })),
    },
  } as CollectionRunnerRehearsalOperationManifest;
  const rootRegistry = {
    getRoot: (rootId: string) =>
      registrations.find((root) => root.rootId === rootId) ?? null,
  } as unknown as CollectionRunnerRehearsalOperationRegistry;
  return {
    manifest: rootManifest,
    resolver: new CollectionRunnerRehearsalOperationFixedRootResolver(
      rootRegistry,
      {
        inspect: (registration) => ({
          canonicalPath: registration.canonicalPath,
          filesystemIdentityFingerprint: changedIdentity
            ? FP("f")
            : registration.filesystemIdentityFingerprint,
          inspectionEvidenceFingerprint:
            registration.inspectionEvidenceFingerprint,
          linkOrReparsePointDetected: false,
        }),
      },
    ),
  };
}

const tests: readonly [string, () => void][] = [
  ["phase command is immutable and deterministic", () => {
    const value = createCollectionRunnerRehearsalOperationPhaseCommand(command());
    truth(Object.isFrozen(value), "command frozen");
    equal(
      value.fingerprint,
      createCollectionRunnerRehearsalOperationPhaseCommand(command()).fingerprint,
      "command fingerprint",
    );
  }],
  ["phase command rejects unknown fields", () => controlError(
    () => createCollectionRunnerRehearsalOperationPhaseCommand({
      ...command(),
      path: "C:\\escape",
    } as unknown as CollectionRunnerRehearsalOperationPhaseCommandInput),
    CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
  )],
  ["phase command rejects deferred RECOVER and VERIFY authority", () => {
    for (const phase of [
      CollectionRunnerRehearsalOperationPhase.Recover,
      CollectionRunnerRehearsalOperationPhase.Verify,
    ]) {
      controlError(
        () => createCollectionRunnerRehearsalOperationPhaseCommand(command({
          phase,
        })),
        CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      );
    }
  }],
  ["phase command rejects lifetime above five minutes", () => controlError(
    () => createCollectionRunnerRehearsalOperationPhaseCommand(command({
      expiresAtUtc: "2026-07-25T20:05:00.001Z",
    })),
    CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
  )],
  ["STEP requires one explicit ordinal", () => controlError(
    () => createCollectionRunnerRehearsalOperationPhaseCommand(command({
      phase: CollectionRunnerRehearsalOperationPhase.Step,
      expectedInvocationOrdinal: null,
    })),
    CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
  )],
  ["preflight is eligible for exact PREPARE", () => {
    equal(
      gate().service.preflight(command()).disposition,
      CollectionRunnerRehearsalOperationPreflightDisposition.Eligible,
      "preflight",
    );
  }],
  ["preflight blocks dirty Alpha tree", () => {
    equal(
      gate({ readiness: observation({ trackedTreeClean: false }) })
        .service.preflight(command()).disposition,
      CollectionRunnerRehearsalOperationPreflightDisposition.Blocked,
      "dirty tree",
    );
  }],
  ["preflight blocks network capability", () => {
    const report = gate({
      readiness: observation({ networkCapabilityAbsent: false }),
    }).service.preflight(command());
    truth(report.blockerCodes.includes("NETWORK_CAPABILITY_PRESENT"), "network");
  }],
  ["preflight records missing-store incompleteness and blocks an out-of-order phase", () => {
    const later = command({
      commandId: "command:step:1",
      phase: CollectionRunnerRehearsalOperationPhase.Step,
      expectedInvocationOrdinal: 1,
    });
    const report = gate({
      readiness: observation({
        storeState: "MISSING",
        lifecycleVersion: 1,
        nextInvocationOrdinal: 1,
      }),
    }).service.preflight(later);
    equal(
      report.disposition,
      CollectionRunnerRehearsalOperationPreflightDisposition.Blocked,
      "missing store",
    );
    truth(report.incompleteCodes.includes("STORE_MISSING"), "store incomplete");
  }],
  ["status is bounded and does not invoke a phase", () => {
    const fixture = gate();
    const report = fixture.service.status(command());
    equal(fixture.counters.phaseCalls(), 0, "phase calls");
    equal(
      report.nonAuthorityDeclaration,
      COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
      "declaration",
    );
    truth(!("secret" in report), "secret absent");
  }],
  ["console preflight never reads the Owner secret", () => {
    const fixture = gate();
    let secretReads = 0;
    const output = runCollectionRunnerRehearsalOperationControlConsole(
      phaseArgs("preflight"),
      {
        gate: fixture.service,
        readOwnerSecret: () => {
          secretReads += 1;
          return "correct owner secret";
        },
        bootIdentity: () => "boot:test",
        mintProcessSessionId: () => "session:test",
        invokedAtUtc: () => INVOKED,
      },
    );
    equal(secretReads, 0, "secret reads");
    truth(output.includes('"disposition": "ELIGIBLE"'), "preflight output");
  }],
  ["console phase reads the Owner secret exactly once", () => {
    const fixture = gate();
    let secretReads = 0;
    runCollectionRunnerRehearsalOperationControlConsole(
      phaseArgs("phase"),
      {
        gate: fixture.service,
        readOwnerSecret: () => {
          secretReads += 1;
          return "correct owner secret";
        },
        bootIdentity: () => "boot:test",
        mintProcessSessionId: () => "session:test",
        invokedAtUtc: () => INVOKED,
      },
    );
    equal(secretReads, 1, "secret reads");
    equal(fixture.counters.phaseCalls(), 1, "phase calls");
  }],
  ["console rejects caller-selected paths", () => {
    const fixture = gate();
    let rejected = false;
    try {
      runCollectionRunnerRehearsalOperationControlConsole(
        [...phaseArgs("preflight"), "--control-root=C:\\escape"],
        {
          gate: fixture.service,
          readOwnerSecret: () => "correct owner secret",
          bootIdentity: () => "boot:test",
          mintProcessSessionId: () => "session:test",
          invokedAtUtc: () => INVOKED,
        },
      );
    } catch {
      rejected = true;
    }
    truth(rejected, "caller-selected path rejected");
  }],
  ["fixed-root resolver accepts only registered identities", () => {
    const fixture = rootResolver();
    const roots = fixture.resolver.resolve(fixture.manifest);
    equal(roots.controlRoot, "C:\\fixed-root-0", "control root");
    equal(roots.alphaRepositoryRoot, "C:\\fixed-root-5", "repository root");
  }],
  ["fixed-root resolver rejects filesystem identity substitution", () => {
    const fixture = rootResolver(true);
    let rejected = false;
    try {
      fixture.resolver.resolve(fixture.manifest);
    } catch {
      rejected = true;
    }
    truth(rejected, "identity substitution rejected");
  }],
  ["fixed Alpha inspector is read-only and reports the actual commit", () => {
    const report =
      new FixedLocalCollectionRunnerRehearsalOperationAlphaInspection(2408)
        .inspect(resolve("."));
    truth(/^[0-9a-f]{40}$/u.test(report.alphaCommit), "full commit");
    equal(report.registeredTestTotal, 2408, "registered total");
    truth(report.packageFingerprint.startsWith("sha256:"), "package fingerprint");
  }],
  ["one eligible invocation appends authorization and result", () => {
    const fixture = gate();
    const result = fixture.service.executeOne(
      command(),
      "correct owner secret",
      INVOKED,
    );
    equal(result.disposition, CollectionRunnerRehearsalOperationResultDisposition.Completed, "result");
    equal(fixture.counters.phaseCalls(), 1, "phase calls");
    equal(fixture.counters.released(), 1, "clean release");
    equal(fixture.repository.readSnapshot(manifest.operationId).authorizationCount, 1, "authorization count");
    equal(fixture.repository.readSnapshot(manifest.operationId).resultCount, 1, "result count");
  }],
  ["authentication failure mutates nothing", () => {
    const fixture = gate();
    controlError(
      () => fixture.service.executeOne(command(), "wrong", INVOKED),
      CollectionRunnerRehearsalOperationControlErrorCode.AuthenticationFailed,
    );
    equal(fixture.repository.readSnapshot(manifest.operationId).authorizationCount, 0, "authorization count");
    equal(fixture.counters.phaseCalls(), 0, "phase calls");
  }],
  ["preflight failure occurs before authentication", () => {
    const fixture = gate({
      readiness: observation({ trackedTreeClean: false }),
    });
    controlError(
      () => fixture.service.executeOne(command(), "correct owner secret", INVOKED),
      CollectionRunnerRehearsalOperationControlErrorCode.PreflightRejected,
    );
    equal(fixture.verifier.calls, 0, "verifier calls");
  }],
  ["phase crash preserves authorization ambiguity", () => {
    const fixture = gate({ phaseFailure: true });
    controlError(
      () => fixture.service.executeOne(command(), "correct owner secret", INVOKED),
      CollectionRunnerRehearsalOperationControlErrorCode.PhaseFailed,
    );
    equal(fixture.repository.readSnapshot(manifest.operationId).authorizationCount, 1, "authorization count");
    equal(fixture.repository.readSnapshot(manifest.operationId).resultCount, 0, "result count");
    equal(fixture.counters.ambiguous(), 1, "ambiguity preserved");
    const report = fixture.service.preflight(command());
    truth(
      report.blockerCodes.includes("OPERATION_AUTHORIZATION_UNRESOLVED"),
      "ambiguity blocker",
    );
  }],
  ["Stop preempts authentication and phase mutation", () => {
    const fixture = gate({ stopInitially: true });
    controlError(
      () => fixture.service.executeOne(command(), "correct owner secret", INVOKED),
      CollectionRunnerRehearsalOperationControlErrorCode.PreflightRejected,
    );
    equal(fixture.verifier.calls, 0, "verifier calls");
    equal(fixture.counters.phaseCalls(), 0, "phase calls");
  }],
  ["authenticated Stop becomes durable and idempotent", () => {
    const fixture = gate();
    const stopCommand = {
      schemaVersion:
        EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
      commandId: "command:stop:1",
      operationId: manifest.operationId,
      manifestFingerprint: manifest.fingerprint,
      alphaCommit: COMMIT,
      rootRegistryFingerprint: FP("2"),
      mode: CollectionRunnerRehearsalOperationStopMode.Emergency,
      reasonCode: "OWNER_REQUEST",
      createdAtUtc: CREATED,
      expiresAtUtc: EXPIRES,
      challengeNonce: "nonce-stop-command-0001",
    } as const;
    const first = fixture.service.requestStop(
      stopCommand,
      "correct owner secret",
      INVOKED,
    );
    const second = fixture.service.requestStop(
      stopCommand,
      "correct owner secret",
      INVOKED,
    );
    equal(first.fingerprint, second.fingerprint, "Stop replay");
  }],
  ["SQLite store uses one fixed filename", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-operation-control-"));
    try {
      const store =
        EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
          root,
          { createIfMissing: true },
        );
      truth(store.getStorePath().endsWith("rehearsal-operation-control.sqlite3"), "fixed path");
      store.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["SQLite control store persists exact authorization and result", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-operation-control-"));
    try {
      const store =
        EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
          root,
          { createIfMissing: true },
        );
      const fixture = gate({ repository: store });
      fixture.service.executeOne(command(), "correct owner secret", INVOKED);
      store.close();
      const reopened =
        EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
          root,
          { createIfMissing: false },
        );
      const snapshot = reopened.readSnapshot(manifest.operationId);
      equal(snapshot.authorizationCount, 1, "authorization count");
      equal(snapshot.resultCount, 1, "result count");
      reopened.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["SQLite store rejects one-use authorization replay", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-operation-control-"));
    try {
      const store =
        EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
          root,
          { createIfMissing: true },
        );
      const fixture = gate({ repository: store });
      fixture.service.executeOne(command(), "correct owner secret", INVOKED);
      controlError(
        () => fixture.service.executeOne(command(), "correct owner secret", INVOKED),
        CollectionRunnerRehearsalOperationControlErrorCode.PreflightRejected,
      );
      store.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["read-only open rejects missing control store", () => {
    const root = mkdtempSync(join(tmpdir(), "alpha-operation-control-"));
    try {
      let rejected = false;
      try {
        EventContractCollectionRunnerRehearsalOperationControlSqliteStore.open(
          root,
          { createIfMissing: false },
        );
      } catch (error) {
        rejected =
          error instanceof CollectionRunnerRehearsalOperationControlStoreError &&
          error.code === "STORE_MISSING";
      }
      truth(rejected, "missing store rejected");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
];

let passed = 0;
for (const [name, run] of tests) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`Rehearsal Operation Control: ${passed}/${tests.length} passed.`);
