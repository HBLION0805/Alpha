import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_COMMAND_IDENTITY,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationRootCreationPolicy,
  CollectionRunnerRehearsalOperationRootPurpose,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
  EventContractSourceCapability,
  EventContractSourceExecutionMode,
  type CollectionRunnerRehearsalOperationManifestProposalInput,
  type CollectionRunnerRehearsalOperationRootRegistrationInput,
} from "../../contracts";
import {
  KalshiEventContractFixtureAdapter,
  KalshiEventContractFixtureStatus,
} from "../../integration/event-contract/kalshi";
import {
  KALSHI_BTC_15M_MARKET_FIXTURE_NORMALIZED_AT,
  KALSHI_BTC_15M_MARKET_FIXTURE_OBSERVED_AT,
  KALSHI_BTC_15M_MARKET_FIXTURE_RECEIVED_AT,
  kalshiBtcFifteenMinuteMarketBody,
  kalshiBtcFifteenMinuteSeriesBody,
  robinhoodBtcFifteenMinuteEventBody,
} from "../../integration/event-contract/kalshi/KalshiEventContractTestFixtures";
import { EventContractCollectionRunnerEngine } from "../event-contract-collection-runner";
import { createCollectionRunnerRehearsalFixtureCatalogEntry } from "../event-contract-collection-runner-fixture-rehearsal";
import {
  CollectionRunnerRehearsalOperationContractError,
  CollectionRunnerRehearsalOperationRegistry,
  createCollectionRunnerRehearsalOperationManifest,
  createCollectionRunnerRehearsalOperationManifestProposal,
  createCollectionRunnerRehearsalOperationOwnerApproval,
  createCollectionRunnerRehearsalOperationRootRegistration,
  createCollectionRunnerRehearsalOperationRootRegistry,
  createCollectionRunnerRehearsalOperationValidationAuthority,
  verifyCollectionRunnerRehearsalOperationManifest,
} from "./EventContractCollectionRunnerRehearsalOperationEngine";

const FP = (character: string) => `sha256:${character.repeat(64)}`;
const COMMIT = "a".repeat(40);
const CREATED = "2026-07-25T20:00:00.000Z";
const APPROVED = "2026-07-25T20:01:00.000Z";
const EXPIRES = "2026-07-26T20:01:00.000Z";

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
    if (error instanceof CollectionRunnerRehearsalOperationContractError && error.code === code) return;
    throw error;
  }
  throw new Error(`${label}: expected ${code}.`);
}

function fixtureCatalogEntry() {
  const fixture = new KalshiEventContractFixtureAdapter().normalize({
    marketBody: kalshiBtcFifteenMinuteMarketBody(),
    seriesBody: kalshiBtcFifteenMinuteSeriesBody(),
    robinhoodBody: robinhoodBtcFifteenMinuteEventBody(),
    observedAt: KALSHI_BTC_15M_MARKET_FIXTURE_OBSERVED_AT,
    receivedAt: KALSHI_BTC_15M_MARKET_FIXTURE_RECEIVED_AT,
    normalizedAt: KALSHI_BTC_15M_MARKET_FIXTURE_NORMALIZED_AT,
  });
  if (fixture.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) {
    throw new Error("Reviewed fixture rejected.");
  }
  const engine = new EventContractCollectionRunnerEngine();
  const definition = engine.createRunnerDefinition({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    runnerDefinitionId: "runner:operation-test",
    version: "1.0",
    buildFingerprint: "fnv1a64:1111111111111111",
    supportedCapabilities: [EventContractSourceCapability.Settlement],
    maximumActivePilots: 1,
    maximumWorkers: 1,
    maximumInFlightRequests: 1,
    maximumRequestsPerSecond: 1,
    maximumClockOffsetMilliseconds: 1000,
  });
  const activation = engine.createPilotActivation({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    activationId: "activation:operation-test",
    ownerId: "owner:operation-test",
    approvedAt: "2026-07-23T23:45:00.000Z",
    startsAt: "2026-07-23T23:50:00.000Z",
    stopsAt: "2026-07-24T01:00:00.000Z",
    frozenPlanId: "plan:operation-test",
    frozenPlanFingerprint: "fnv1a64:2222222222222222",
    runnerDefinition: definition,
    admittedProviderFingerprints: [fixture.provider.fingerprint],
    admittedMappingFingerprints: [fixture.mapping.fingerprint],
    maximumEvents: 1,
    maximumRequests: 1,
  });
  const task = engine.createScheduledTask({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    taskId: "task:operation-test",
    observationSlot: "2026-07-24T00:45:00.000Z",
    scheduledAt: "2026-07-24T00:44:00.000Z",
    deadlineAt: "2026-07-24T00:46:00.000Z",
    runnerDefinitionVersion: definition.version,
    admission: {
      frozenPlanId: activation.frozenPlanId,
      frozenPlanFingerprint: activation.frozenPlanFingerprint,
      plannedEventId: "event:operation-test",
      evidenceCutoffAt: "2026-07-24T00:46:00.000Z",
      providerId: fixture.provider.providerId,
      providerFingerprint: fixture.provider.fingerprint,
      capability: EventContractSourceCapability.Settlement,
      executionMode: EventContractSourceExecutionMode.Fixture,
      sourceLane: "EXCHANGE",
      mappingId: fixture.mapping.mappingId,
      mappingVersion: fixture.mapping.version,
      mappingFingerprint: fixture.mapping.fingerprint,
      sourceRecordId: fixture.sourceSnapshot.sourceRecordId,
      requestPolicyId: "policy:operation-test",
      requestPolicyVersion: "1.0",
      bounds: {
        maximumAttempts: 1,
        maximumRawPayloadBytes: 100_000,
        maximumRecordCount: 3,
        requestDeadlineMilliseconds: 5_000,
      },
      activationId: activation.activationId,
      activationExpiresAt: activation.stopsAt,
    },
  }, activation);
  return createCollectionRunnerRehearsalFixtureCatalogEntry({
    catalogVersion: "1.0",
    catalogEntryId: "kalshi-btc15m-operation-test",
    catalogFingerprint: FP("3"),
    fixturePackageFingerprint: FP("4"),
    fixtureAdapterIdentity: "adapter:kalshi-operation-test",
    fixtureAdapterVersion: "1.0",
    sourceRecordId: fixture.sourceSnapshot.sourceRecordId,
    payloadFingerprint: fixture.sourceSnapshot.payloadFingerprint,
    rawPayloadBytes: fixture.sourceSnapshot.rawPayloadBytes,
    recordCount: fixture.sourceSnapshot.recordCount,
    runnerDefinition: definition,
    pilotActivation: activation,
    scheduledTasks: [task],
    sourceSnapshot: fixture.sourceSnapshot,
    expectedTaskTransitions: [
      CollectionRunnerTaskState.Scheduled,
      CollectionRunnerTaskState.Due,
      CollectionRunnerTaskState.Leased,
      CollectionRunnerTaskState.InFlight,
      CollectionRunnerTaskState.Validating,
      CollectionRunnerTaskState.Committed,
    ],
  });
}

const ROOT_PATHS: Readonly<Record<CollectionRunnerRehearsalOperationRootPurpose, string>> = {
  [CollectionRunnerRehearsalOperationRootPurpose.Control]: "C:\\alpha-operation\\control",
  [CollectionRunnerRehearsalOperationRootPurpose.Workspace]: "C:\\alpha-operation\\workspace",
  [CollectionRunnerRehearsalOperationRootPurpose.Sqlite]: "C:\\alpha-operation\\sqlite",
  [CollectionRunnerRehearsalOperationRootPurpose.Backup]: "C:\\alpha-operation\\backup",
  [CollectionRunnerRehearsalOperationRootPurpose.Evidence]: "C:\\alpha-operation\\evidence",
  [CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository]: "C:\\projects\\Alpha",
};

function rootInput(
  purpose: CollectionRunnerRehearsalOperationRootPurpose,
  changes: Partial<CollectionRunnerRehearsalOperationRootRegistrationInput> = {},
): CollectionRunnerRehearsalOperationRootRegistrationInput {
  return {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
    rootId: `root:${purpose.toLocaleLowerCase()}`,
    purpose,
    canonicalPath: ROOT_PATHS[purpose],
    pathIdentity: `path:${purpose.toLocaleLowerCase()}`,
    filesystemIdentityFingerprint: FP("5"),
    inspectionEvidenceFingerprint: FP("6"),
    inspectedAtUtc: CREATED,
    creationPolicy:
      purpose === CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository
        ? CollectionRunnerRehearsalOperationRootCreationPolicy.ExistingReadOnlyRepository
        : CollectionRunnerRehearsalOperationRootCreationPolicy.ExistingRegisteredRoot,
    linkOrReparsePointDetected: false,
    ...changes,
  };
}

function rootRegistry() {
  return createCollectionRunnerRehearsalOperationRootRegistry({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
    policyVersion: "1.0",
    registrations: Object.values(CollectionRunnerRehearsalOperationRootPurpose).map(
      (purpose) => createCollectionRunnerRehearsalOperationRootRegistration(rootInput(purpose)),
    ),
  });
}

function validationAuthority() {
  return createCollectionRunnerRehearsalOperationValidationAuthority({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
    policyVersion: "1.0",
    repositoryRootId: "root:alpha_repository_root",
    alphaCommit: COMMIT,
    cleanTreeRequired: true,
    packageFingerprint: FP("7"),
    validationSuiteFingerprint: FP("8"),
    registeredTestTotal: 2377,
    commandIdentity: COLLECTION_RUNNER_REHEARSAL_OPERATION_COMMAND_IDENTITY,
    recursionPolicyVersion: "1.0",
    networkPermitted: false,
    credentialAccessPermitted: false,
  });
}

function proposalInput(
  catalog = fixtureCatalogEntry(),
  roots = rootRegistry(),
  validation = validationAuthority(),
  changes: Partial<CollectionRunnerRehearsalOperationManifestProposalInput> = {},
): CollectionRunnerRehearsalOperationManifestProposalInput {
  return {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
    policyVersion: "1.0",
    rehearsalId: "rehearsal:operation-test",
    rehearsalManifestFingerprint: FP("9"),
    alphaCommit: COMMIT,
    runtimeBuildFingerprint: "fnv1a64:1111111111111111",
    fixtureCatalogEntryId: catalog.catalogEntryId,
    fixtureCatalogEntryFingerprint: catalog.fingerprint,
    providerFingerprint: catalog.sourceSnapshot.providerFingerprint,
    mappingFingerprint: catalog.sourceSnapshot.mappingFingerprint!,
    runnerDefinitionFingerprint: catalog.runnerDefinition.fingerprint,
    frozenPlanFingerprint: catalog.pilotActivation.frozenPlanFingerprint,
    rootRegistryFingerprint: roots.fingerprint,
    rootBindings: roots.registrations.map((root) => ({
      purpose: root.purpose,
      rootId: root.rootId,
      rootFingerprint: root.fingerprint,
    })),
    validationAuthorityFingerprint: validation.fingerprint,
    phasePlan: [
      { ordinal: 1, phase: CollectionRunnerRehearsalOperationPhase.Prepare, expectedStepOrdinal: null },
      { ordinal: 2, phase: CollectionRunnerRehearsalOperationPhase.Step, expectedStepOrdinal: 1 },
      { ordinal: 3, phase: CollectionRunnerRehearsalOperationPhase.Step, expectedStepOrdinal: 2 },
      { ordinal: 4, phase: CollectionRunnerRehearsalOperationPhase.Step, expectedStepOrdinal: 3 },
      { ordinal: 5, phase: CollectionRunnerRehearsalOperationPhase.Validate, expectedStepOrdinal: null },
      { ordinal: 6, phase: CollectionRunnerRehearsalOperationPhase.Freeze, expectedStepOrdinal: null },
      { ordinal: 7, phase: CollectionRunnerRehearsalOperationPhase.Package, expectedStepOrdinal: null },
      { ordinal: 8, phase: CollectionRunnerRehearsalOperationPhase.Verify, expectedStepOrdinal: null },
    ],
    maximumPhaseInvocations: 8,
    recoveryPolicyVersion: "1.0",
    maximumRecoveryInvocations: 1,
    plannedBackupId: "backup:operation-test",
    plannedPackageId: "package:operation-test",
    plannedEnvelopeId: "envelope:operation-test",
    retentionPolicyVersion: "1.0",
    createdAtUtc: CREATED,
    nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
    ...changes,
  };
}

function completeFixture() {
  const catalog = fixtureCatalogEntry();
  const roots = rootRegistry();
  const validation = validationAuthority();
  const proposal = createCollectionRunnerRehearsalOperationManifestProposal(
    proposalInput(catalog, roots, validation),
  );
  const approval = createCollectionRunnerRehearsalOperationOwnerApproval({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
    approvalId: "approval:operation-test",
    ownerId: catalog.pilotActivation.ownerId,
    approvedProposalFingerprint: proposal.fingerprint,
    approvedAtUtc: APPROVED,
    expiresAtUtc: EXPIRES,
    localAuthenticationPolicyVersion: "1.0",
    nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
  });
  const manifest = createCollectionRunnerRehearsalOperationManifest(proposal, approval);
  return { catalog, roots, validation, proposal, approval, manifest };
}

const tests: readonly [string, () => void][] = [
  ["root registration is immutable and deterministic", () => {
    const root = createCollectionRunnerRehearsalOperationRootRegistration(rootInput(CollectionRunnerRehearsalOperationRootPurpose.Control));
    truth(Object.isFrozen(root), "root frozen");
    equal(root.fingerprint, createCollectionRunnerRehearsalOperationRootRegistration(rootInput(CollectionRunnerRehearsalOperationRootPurpose.Control)).fingerprint, "root fingerprint");
  }],
  ["root registration rejects unknown fields", () => throws(
    () => createCollectionRunnerRehearsalOperationRootRegistration({ ...rootInput(CollectionRunnerRehearsalOperationRootPurpose.Control), rank: 1 } as unknown as CollectionRunnerRehearsalOperationRootRegistrationInput),
    "UNKNOWN_FIELD",
    "unknown root field",
  )],
  ["root registration rejects relative paths", () => throws(
    () => createCollectionRunnerRehearsalOperationRootRegistration(rootInput(CollectionRunnerRehearsalOperationRootPurpose.Control, { canonicalPath: "relative\\control" })),
    "INVALID_PATH",
    "relative root",
  )],
  ["root registration rejects reparse evidence", () => throws(
    () => createCollectionRunnerRehearsalOperationRootRegistration(rootInput(CollectionRunnerRehearsalOperationRootPurpose.Control, { linkOrReparsePointDetected: true as false })),
    "UNSAFE_ROOT",
    "reparse root",
  )],
  ["repository root requires read-only policy", () => throws(
    () => createCollectionRunnerRehearsalOperationRootRegistration(rootInput(CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository, { creationPolicy: CollectionRunnerRehearsalOperationRootCreationPolicy.ExistingRegisteredRoot })),
    "INVALID_ROOT_POLICY",
    "repository root policy",
  )],
  ["root registry requires every exact purpose", () => throws(
    () => createCollectionRunnerRehearsalOperationRootRegistry({
      schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
      policyVersion: "1.0",
      registrations: rootRegistry().registrations.slice(0, 5),
    }),
    "INVALID_ROOT_SET",
    "missing root",
  )],
  ["root registry rejects duplicate purpose", () => {
    const roots = rootRegistry().registrations;
    throws(
      () => createCollectionRunnerRehearsalOperationRootRegistry({
        schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
        policyVersion: "1.0",
        registrations: [...roots.slice(0, 5), createCollectionRunnerRehearsalOperationRootRegistration(rootInput(CollectionRunnerRehearsalOperationRootPurpose.Control, { rootId: "root:other", canonicalPath: "C:\\alpha-operation\\other" }))],
      }),
      "DUPLICATE_ROOT",
      "duplicate purpose",
    );
  }],
  ["root registry rejects overlap", () => {
    const roots = rootRegistry().registrations;
    const changed = roots.map((root) => root.purpose === CollectionRunnerRehearsalOperationRootPurpose.Backup
      ? createCollectionRunnerRehearsalOperationRootRegistration(rootInput(root.purpose, { canonicalPath: "C:\\alpha-operation\\workspace\\backup" }))
      : root);
    throws(
      () => createCollectionRunnerRehearsalOperationRootRegistry({
        schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
        policyVersion: "1.0",
        registrations: changed,
      }),
      "OVERLAPPING_ROOT",
      "overlap",
    );
  }],
  ["root registry order is deterministic", () => {
    const roots = rootRegistry();
    const reversed = createCollectionRunnerRehearsalOperationRootRegistry({
      schemaVersion: roots.schemaVersion,
      policyVersion: roots.policyVersion,
      registrations: [...roots.registrations].reverse(),
    });
    equal(reversed.fingerprint, roots.fingerprint, "root registry fingerprint");
  }],
  ["validation authority is fixed and network-free", () => {
    const authority = validationAuthority();
    equal(authority.commandIdentity, COLLECTION_RUNNER_REHEARSAL_OPERATION_COMMAND_IDENTITY, "command");
    equal(authority.networkPermitted, false, "network");
    equal(authority.registeredTestTotal, 2377, "test total");
  }],
  ["validation authority rejects commit shorthand", () => throws(
    () => {
      const { deterministic: _deterministic, fingerprint: _fingerprint, ...input } = validationAuthority();
      return createCollectionRunnerRehearsalOperationValidationAuthority({ ...input, alphaCommit: "b27687c" });
    },
    "INVALID_FIELD",
    "commit shorthand",
  )],
  ["validation authority rejects network permission", () => {
    const { deterministic: _deterministic, fingerprint: _fingerprint, ...input } = validationAuthority();
    throws(
      () => createCollectionRunnerRehearsalOperationValidationAuthority({ ...input, networkPermitted: true as false }),
      "INVALID_VALIDATION_AUTHORITY",
      "network permission",
    );
  }],
  ["proposal is immutable and deterministic", () => {
    const input = proposalInput();
    const proposal = createCollectionRunnerRehearsalOperationManifestProposal(input);
    truth(Object.isFrozen(proposal.phasePlan), "phase plan frozen");
    equal(proposal.fingerprint, createCollectionRunnerRehearsalOperationManifestProposal(input).fingerprint, "proposal fingerprint");
  }],
  ["proposal rejects unknown fields", () => throws(
    () => createCollectionRunnerRehearsalOperationManifestProposal({ ...proposalInput(), runAll: true } as unknown as CollectionRunnerRehearsalOperationManifestProposalInput),
    "UNKNOWN_FIELD",
    "unknown proposal field",
  )],
  ["proposal rejects Recovery in normal phase plan", () => {
    const input = proposalInput();
    const plan = input.phasePlan.map((entry, index) => index === 1
      ? { ...entry, phase: CollectionRunnerRehearsalOperationPhase.Recover }
      : entry);
    throws(() => createCollectionRunnerRehearsalOperationManifestProposal({ ...input, phasePlan: plan as CollectionRunnerRehearsalOperationManifestProposalInput["phasePlan"] }), "INVALID_PHASE_PLAN", "recovery phase");
  }],
  ["proposal rejects skipped STEP ordinal", () => {
    const input = proposalInput();
    const plan = input.phasePlan.map((entry, index) => index === 2 ? { ...entry, expectedStepOrdinal: 4 } : entry);
    throws(() => createCollectionRunnerRehearsalOperationManifestProposal({ ...input, phasePlan: plan }), "INVALID_PHASE_PLAN", "step ordinal");
  }],
  ["proposal rejects changed terminal phase order", () => {
    const input = proposalInput();
    const plan = [...input.phasePlan];
    [plan[6], plan[7]] = [plan[7]!, plan[6]!];
    throws(() => createCollectionRunnerRehearsalOperationManifestProposal({ ...input, phasePlan: plan }), "INVALID_PHASE_PLAN", "phase order");
  }],
  ["proposal rejects authority overclaim", () => throws(
    () => createCollectionRunnerRehearsalOperationManifestProposal({ ...proposalInput(), nonAuthorityDeclaration: "TRADING_AUTHORITY" as typeof COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION }),
    "INVALID_AUTHORITY",
    "authority",
  )],
  ["owner approval is proposal-bound", () => {
    const fixture = completeFixture();
    equal(fixture.approval.approvedProposalFingerprint, fixture.proposal.fingerprint, "approval proposal");
  }],
  ["owner approval rejects non-forward expiry", () => {
    const proposal = createCollectionRunnerRehearsalOperationManifestProposal(proposalInput());
    throws(() => createCollectionRunnerRehearsalOperationOwnerApproval({
      schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
      approvalId: "approval:bad-time",
      ownerId: "owner:test",
      approvedProposalFingerprint: proposal.fingerprint,
      approvedAtUtc: APPROVED,
      expiresAtUtc: APPROVED,
      localAuthenticationPolicyVersion: "1.0",
      nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
    }), "INVALID_CHRONOLOGY", "approval chronology");
  }],
  ["manifest derives content identity", () => {
    const fixture = completeFixture();
    truth(fixture.manifest.operationId.startsWith("rehearsal-operation:"), "operation ID");
    truth(verifyCollectionRunnerRehearsalOperationManifest(fixture.manifest), "manifest verifies");
  }],
  ["manifest rejects approval for another proposal", () => {
    const fixture = completeFixture();
    const changedProposal = createCollectionRunnerRehearsalOperationManifestProposal({
      ...proposalInput(fixture.catalog, fixture.roots, fixture.validation),
      plannedEnvelopeId: "envelope:changed",
    });
    throws(() => createCollectionRunnerRehearsalOperationManifest(changedProposal, fixture.approval), "APPROVAL_MISMATCH", "approval mismatch");
  }],
  ["manifest verification rejects fingerprint tampering", () => {
    const fixture = completeFixture();
    equal(verifyCollectionRunnerRehearsalOperationManifest({ ...fixture.manifest, fingerprint: FP("f") }), false, "tampered manifest");
  }],
  ["registry resolves exact operation root and validation authority", () => {
    const fixture = completeFixture();
    const registry = new CollectionRunnerRehearsalOperationRegistry({
      rootRegistry: fixture.roots,
      fixtureCatalogEntries: [fixture.catalog],
      validationAuthorities: [fixture.validation],
      manifests: [fixture.manifest],
    });
    equal(registry.getOperation(fixture.manifest.operationId)?.fingerprint, fixture.manifest.fingerprint, "operation");
    equal(registry.getRoot("root:alpha_repository_root")?.purpose, CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository, "repository root");
    equal(registry.getValidationAuthority(fixture.validation.fingerprint)?.registeredTestTotal, 2377, "validation");
  }],
  ["registry snapshot is deterministic and immutable", () => {
    const fixture = completeFixture();
    const registry = new CollectionRunnerRehearsalOperationRegistry({
      rootRegistry: fixture.roots,
      fixtureCatalogEntries: [fixture.catalog],
      validationAuthorities: [fixture.validation],
      manifests: [fixture.manifest],
    });
    const snapshot = registry.getSnapshot();
    truth(Object.isFrozen(snapshot), "snapshot frozen");
    equal(snapshot.operationManifestFingerprints.length, 1, "operation count");
  }],
  ["registry rejects root registry substitution", () => {
    const fixture = completeFixture();
    const changedRoots = createCollectionRunnerRehearsalOperationRootRegistry({
      schemaVersion: fixture.roots.schemaVersion,
      policyVersion: "1.1",
      registrations: fixture.roots.registrations,
    });
    throws(() => new CollectionRunnerRehearsalOperationRegistry({
      rootRegistry: changedRoots,
      fixtureCatalogEntries: [fixture.catalog],
      validationAuthorities: [fixture.validation],
      manifests: [fixture.manifest],
    }), "ROOT_REGISTRY_MISMATCH", "root registry mismatch");
  }],
  ["registry rejects validation authority substitution", () => {
    const fixture = completeFixture();
    const { deterministic: _deterministic, fingerprint: _fingerprint, ...input } = fixture.validation;
    const changed = createCollectionRunnerRehearsalOperationValidationAuthority({ ...input, registeredTestTotal: 2378 });
    throws(() => new CollectionRunnerRehearsalOperationRegistry({
      rootRegistry: fixture.roots,
      fixtureCatalogEntries: [fixture.catalog],
      validationAuthorities: [changed],
      manifests: [fixture.manifest],
    }), "VALIDATION_AUTHORITY_MISMATCH", "validation mismatch");
  }],
  ["registry rejects fixture catalog substitution", () => {
    const fixture = completeFixture();
    throws(() => new CollectionRunnerRehearsalOperationRegistry({
      rootRegistry: fixture.roots,
      fixtureCatalogEntries: [],
      validationAuthorities: [fixture.validation],
      manifests: [fixture.manifest],
    }), "CATALOG_MISMATCH", "catalog mismatch");
  }],
  ["registry rejects duplicate rehearsal identity", () => {
    const fixture = completeFixture();
    throws(() => new CollectionRunnerRehearsalOperationRegistry({
      rootRegistry: fixture.roots,
      fixtureCatalogEntries: [fixture.catalog],
      validationAuthorities: [fixture.validation],
      manifests: [fixture.manifest, fixture.manifest],
    }), "DUPLICATE_OPERATION", "duplicate operation");
  }],
  ["registry reads return defensive immutable values", () => {
    const fixture = completeFixture();
    const registry = new CollectionRunnerRehearsalOperationRegistry({
      rootRegistry: fixture.roots,
      fixtureCatalogEntries: [fixture.catalog],
      validationAuthorities: [fixture.validation],
      manifests: [fixture.manifest],
    });
    const first = registry.getOperation(fixture.manifest.operationId)!;
    const second = registry.getOperation(fixture.manifest.operationId)!;
    truth(first !== second, "defensive clone");
    truth(Object.isFrozen(first.proposal), "defensive clone frozen");
  }],
  ["registry exposes no command or phase execution methods", () => {
    const methods = Object.getOwnPropertyNames(CollectionRunnerRehearsalOperationRegistry.prototype);
    equal(methods.includes("run"), false, "run absent");
    equal(methods.includes("executePhase"), false, "phase absent");
    equal(methods.includes("start"), false, "start absent");
  }],
];

let passed = 0;
for (const [name, run] of tests) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`Rehearsal Operation Manifest and Registry tests passed: ${passed}/${tests.length}.`);
