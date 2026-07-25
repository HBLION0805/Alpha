import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalFaultScenario,
  CollectionRunnerRehearsalLifecycleState,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
  EventContractSourceCapability,
  EventContractSourceExecutionMode,
} from "../../contracts";
import { EventContractCollectionRunnerEngine } from "../event-contract-collection-runner/EventContractCollectionRunnerEngine";
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
import {
  createCollectionRunnerRehearsalManifest,
} from "./EventContractCollectionRunnerFixtureRehearsalEngine";
import {
  CollectionRunnerRehearsalPreparationError,
  CollectionRunnerRehearsalPreparationErrorCode,
  EventContractCollectionRunnerFixtureRehearsalPreparation,
  createCollectionRunnerRehearsalFixtureCatalogEntry,
  createCollectionRunnerRehearsalRuntimeTemplateFingerprint,
} from "./EventContractCollectionRunnerFixtureRehearsalPreparation";
import {
  EventContractCollectionRunnerFixtureRehearsalSqliteStore,
} from "../../repositories/EventContractCollectionRunnerFixtureRehearsalSqliteStore";
import {
  EventContractCollectionRunnerDurableFixtureRehearsalPreparationAdapter,
} from "../event-contract-collection-runner-durable-fixture-rehearsal/EventContractCollectionRunnerDurableFixtureRehearsalPreparationAdapter";

const BUILD = "fnv1a64:aaaaaaaaaaaaaaaa";
const PLAN = "fnv1a64:bbbbbbbbbbbbbbbb";
const CATALOG = `sha256:${"c".repeat(64)}`;
const PACKAGE = `sha256:${"d".repeat(64)}`;
const APPROVAL = `sha256:${"e".repeat(64)}`;
const PREPARED_AT = "2026-07-23T23:50:00.000Z";

function equal<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
}
function truth(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}
function throws(run: () => unknown, code: CollectionRunnerRehearsalPreparationErrorCode, label: string): void {
  try {
    run();
  } catch (error) {
    if (error instanceof CollectionRunnerRehearsalPreparationError && error.code === code) return;
    throw error;
  }
  throw new Error(`${label}: expected ${code}.`);
}

function buildFixture() {
  const fixture = new KalshiEventContractFixtureAdapter().normalize({
    marketBody: kalshiBtcFifteenMinuteMarketBody(),
    seriesBody: kalshiBtcFifteenMinuteSeriesBody(),
    robinhoodBody: robinhoodBtcFifteenMinuteEventBody(),
    observedAt: KALSHI_BTC_15M_MARKET_FIXTURE_OBSERVED_AT,
    receivedAt: KALSHI_BTC_15M_MARKET_FIXTURE_RECEIVED_AT,
    normalizedAt: KALSHI_BTC_15M_MARKET_FIXTURE_NORMALIZED_AT,
  });
  if (fixture.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) throw new Error("Reviewed fixture rejected.");
  const engine = new EventContractCollectionRunnerEngine();
  const definition = engine.createRunnerDefinition({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    runnerDefinitionId: "runner:fixture-rehearsal",
    version: "1.0",
    buildFingerprint: BUILD,
    supportedCapabilities: [EventContractSourceCapability.Settlement],
    maximumActivePilots: 1,
    maximumWorkers: 1,
    maximumInFlightRequests: 1,
    maximumRequestsPerSecond: 1,
    maximumClockOffsetMilliseconds: 1000,
  });
  const activation = engine.createPilotActivation({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    activationId: "activation:fixture-rehearsal",
    ownerId: "owner:fixture-rehearsal",
    approvedAt: "2026-07-23T23:45:00.000Z",
    startsAt: "2026-07-23T23:50:00.000Z",
    stopsAt: "2026-07-24T01:00:00.000Z",
    frozenPlanId: "plan:fixture-rehearsal",
    frozenPlanFingerprint: PLAN,
    runnerDefinition: definition,
    admittedProviderFingerprints: [fixture.provider.fingerprint],
    admittedMappingFingerprints: [fixture.mapping.fingerprint],
    maximumEvents: 1,
    maximumRequests: 1,
  });
  const task = engine.createScheduledTask({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    taskId: "task:fixture-rehearsal",
    observationSlot: "2026-07-24T00:45:00.000Z",
    scheduledAt: "2026-07-24T00:44:00.000Z",
    deadlineAt: "2026-07-24T00:46:00.000Z",
    runnerDefinitionVersion: definition.version,
    admission: {
      frozenPlanId: activation.frozenPlanId,
      frozenPlanFingerprint: activation.frozenPlanFingerprint,
      plannedEventId: "event:fixture-rehearsal",
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
      requestPolicyId: "policy:fixture-rehearsal",
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
  const entry = createCollectionRunnerRehearsalFixtureCatalogEntry({
    catalogVersion: "1.0",
    catalogEntryId: "kalshi-btc15m-settlement",
    catalogFingerprint: CATALOG,
    fixturePackageFingerprint: PACKAGE,
    fixtureAdapterIdentity: "adapter:kalshi-event-contract-fixture",
    fixtureAdapterVersion: "1.1",
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
  const manifest = createCollectionRunnerRehearsalManifest({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
    policyVersion: "1.0",
    scenarioId: "scenario:fixture-preparation",
    scenarioPurpose: "Prepare one isolated fixture store",
    ownerApprovalId: "approval:fixture-preparation",
    ownerApprovalFingerprint: APPROVAL,
    ownerApprovalExpiresAtUtc: "2026-07-26T00:00:00.000Z",
    buildFingerprint: BUILD,
    runnerFingerprint: definition.fingerprint,
    frozenPlanFingerprint: PLAN,
    fixtureCatalogFingerprint: CATALOG,
    fixturePackageFingerprint: PACKAGE,
    providerFingerprint: fixture.provider.fingerprint,
    mappingFingerprint: fixture.mapping.fingerprint,
    syntheticActivationFingerprint: activation.fingerprint,
    syntheticTaskFingerprint: task.fingerprint,
    runtimeConfigurationTemplateFingerprint: createCollectionRunnerRehearsalRuntimeTemplateFingerprint(entry),
    expectedInvocations: [
      { ordinal: 1, action: CollectionRunnerRuntimeAssemblyAction.TransitionExactTaskDue, resultingTaskState: CollectionRunnerTaskState.Due },
      { ordinal: 2, action: CollectionRunnerRuntimeAssemblyAction.ExecuteExactFixtureTask, resultingTaskState: CollectionRunnerTaskState.Committed },
      { ordinal: 3, action: CollectionRunnerRuntimeAssemblyAction.CompleteAndExit, resultingTaskState: CollectionRunnerTaskState.Committed },
    ],
    expectedPilotState: CollectionRunnerPilotState.Completed,
    expectedTaskState: CollectionRunnerTaskState.Committed,
    expectedOutboxRecordIds: [],
    maximumInvocations: 3,
    faultScenario: CollectionRunnerRehearsalFaultScenario.None,
    evidencePackagePolicyVersion: "1.0",
    retentionPolicyVersion: "1.0",
    nonAuthorityDeclaration: COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
  });
  return { entry, manifest };
}

function harness() {
  const root = mkdtempSync(resolve(tmpdir(), "alpha-rehearsal-preparation-"));
  const allowed = resolve(root, "allowed");
  mkdirSync(allowed);
  const fixture = buildFixture();
  const preparation = new EventContractCollectionRunnerFixtureRehearsalPreparation({
    repositoryRoot: resolve("."),
    allowedRoots: [{ allowedRootId: "root:test", path: allowed }],
    catalog: [fixture.entry],
  });
  return {
    root,
    allowed,
    fixture,
    preparation,
    request: {
      manifest: fixture.manifest,
      catalogEntryId: fixture.entry.catalogEntryId,
      allowedRootId: "root:test",
      preparedAtUtc: PREPARED_AT,
    },
  };
}

function withHarness(run: (value: ReturnType<typeof harness>) => void): void {
  const value = harness();
  try {
    run(value);
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
}

function changedManifest(
  manifest: ReturnType<typeof createCollectionRunnerRehearsalManifest>,
  changes: Partial<Omit<typeof manifest, "rehearsalId" | "deterministic" | "fingerprint">>,
) {
  const { rehearsalId: _rehearsalId, deterministic: _deterministic, fingerprint: _fingerprint, ...input } = manifest;
  return createCollectionRunnerRehearsalManifest({ ...input, ...changes });
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["prepares one isolated migrated synthetic store", () => withHarness(({ preparation, request }) => {
    const result = preparation.prepare(request);
    equal(result.replayed, false, "first preparation");
    equal(result.lifecycleTransition.toState, CollectionRunnerRehearsalLifecycleState.Prepared, "lifecycle");
    truth(existsSync(result.runtimePaths.storePath), "SQLite store exists");
    truth(existsSync(resolve(result.workspace.workspaceRoot, "preparation.json")), "receipt record exists");
  })],
  ["preparation seeds the explicit v3 rehearsal profile through the reviewed adapter", () => {
    const root = mkdtempSync(resolve(tmpdir(), "alpha-rehearsal-v3-preparation-"));
    const allowed = resolve(root, "allowed");
    mkdirSync(allowed);
    const fixture = buildFixture();
    try {
      const preparation = new EventContractCollectionRunnerFixtureRehearsalPreparation({
        repositoryRoot: resolve("."),
        allowedRoots: [{ allowedRootId: "root:test", path: allowed }],
        catalog: [fixture.entry],
        openStore: EventContractCollectionRunnerFixtureRehearsalSqliteStore.open,
      });
      const preparationRequest = {
        manifest: fixture.manifest,
        catalogEntryId: fixture.entry.catalogEntryId,
        allowedRootId: "root:test",
        preparedAtUtc: PREPARED_AT,
      };
      const adapter =
        new EventContractCollectionRunnerDurableFixtureRehearsalPreparationAdapter(
          preparation,
          {
            resolve: () => preparationRequest,
          },
        );
      const evidence = adapter.prepare({
        schemaVersion:
          EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COORDINATOR_SCHEMA_VERSION,
        registeredManifestId: "manifest:test",
        registeredPhaseId: "phase:prepare",
        rehearsalId: fixture.manifest.rehearsalId,
        manifestFingerprint: fixture.manifest.fingerprint,
        phase: DurableFixtureRehearsalPhase.Prepare,
        expectedLifecycleVersion: 1,
        expectedInvocationOrdinal: null,
        expectedRecoveryFingerprint: APPROVAL,
        invocationId: "invocation:prepare",
        ownerAuthorizationId: null,
      }, {
        processSessionId: "session:test",
        bootIdentity: "boot:test",
        observedAtUtc: PREPARED_AT,
      });
      equal(
        evidence.registry.lifecycleState,
        DurableFixtureRehearsalLifecycleState.Prepared,
        "durable lifecycle",
      );
      equal(evidence.registry.lifecycleVersion, 3, "durable lifecycle version");
      const result = preparation.prepare(preparationRequest);
      equal(result.replayed, true, "adapter prepared exact workspace");
      const store = EventContractCollectionRunnerFixtureRehearsalSqliteStore.open({
        rootDirectory: result.runtimeConfiguration.sqliteRoot,
        storeId: result.runtimeConfiguration.storeId,
        applicationBuildFingerprint: result.manifest.buildFingerprint,
        appliedAtUtc: PREPARED_AT,
      });
      try {
        equal(store.getReadiness().schemaVersion, 3, "schema version");
        equal(
          store.createRunnerRepository().getPilotState(
            fixture.entry.pilotActivation.activationId,
          )?.state,
          CollectionRunnerPilotState.Active,
          "seeded pilot",
        );
        equal(
          store.createDurableRehearsalRepository().readSnapshot(
            fixture.manifest.rehearsalId,
          ),
          null,
          "coordinator owns registry initialization",
        );
      } finally {
        store.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["preparation is deeply immutable", () => withHarness(({ preparation, request }) => {
    const result = preparation.prepare(request);
    truth(Object.isFrozen(result) && Object.isFrozen(result.workspace) && Object.isFrozen(result.preparationReceipt), "immutable");
  })],
  ["exact replay returns the same durable receipt", () => withHarness(({ preparation, request }) => {
    const first = preparation.prepare(request);
    const replay = preparation.prepare(request);
    equal(replay.replayed, true, "replayed");
    equal(replay.preparationReceipt.fingerprint, first.preparationReceipt.fingerprint, "receipt");
  })],
  ["changed replay time fails closed", () => withHarness(({ preparation, request }) => {
    preparation.prepare(request);
    throws(() => preparation.prepare({ ...request, preparedAtUtc: "2026-07-23T23:51:00.000Z" }), CollectionRunnerRehearsalPreparationErrorCode.ReplayConflict, "changed time");
  })],
  ["unknown catalog entry fails before workspace creation", () => withHarness(({ preparation, request, allowed }) => {
    throws(() => preparation.prepare({ ...request, catalogEntryId: "catalog:unknown" }), CollectionRunnerRehearsalPreparationErrorCode.InvalidRequest, "unknown catalog");
    equal(existsSync(resolve(allowed, `rehearsal-${request.manifest.fingerprint.split(":")[1]}`)), false, "no workspace");
  })],
  ["unknown allowed root fails closed", () => withHarness(({ preparation, request }) => {
    throws(() => preparation.prepare({ ...request, allowedRootId: "root:unknown" }), CollectionRunnerRehearsalPreparationErrorCode.InvalidRequest, "unknown root");
  })],
  ["manifest catalog substitution fails closed", () => withHarness(({ preparation, request }) => {
    const changed = changedManifest(request.manifest, { fixtureCatalogFingerprint: APPROVAL });
    throws(() => preparation.prepare({ ...request, manifest: changed }), CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "catalog substitution");
  })],
  ["manifest build substitution fails closed", () => withHarness(({ preparation, request }) => {
    const changed = changedManifest(request.manifest, { buildFingerprint: "fnv1a64:cccccccccccccccc" });
    throws(() => preparation.prepare({ ...request, manifest: changed }), CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "build substitution");
  })],
  ["runtime template substitution fails closed", () => withHarness(({ preparation, request }) => {
    const changed = changedManifest(request.manifest, { runtimeConfigurationTemplateFingerprint: APPROVAL });
    throws(() => preparation.prepare({ ...request, manifest: changed }), CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "template substitution");
  })],
  ["pre-existing unrelated workspace is preserved and blocked", () => withHarness(({ preparation, request, allowed }) => {
    const workspace = resolve(allowed, `rehearsal-${request.manifest.fingerprint.split(":")[1]}`);
    mkdirSync(workspace);
    writeFileSync(resolve(workspace, "unrelated.txt"), "preserve", { encoding: "utf8" });
    throws(() => preparation.prepare(request), CollectionRunnerRehearsalPreparationErrorCode.WorkspaceConflict, "workspace conflict");
    truth(existsSync(resolve(workspace, "unrelated.txt")), "unrelated content preserved");
  })],
  ["repository root cannot be an allowed root", () => {
    const fixture = buildFixture();
    throws(() => new EventContractCollectionRunnerFixtureRehearsalPreparation({
      repositoryRoot: resolve("."),
      allowedRoots: [{ allowedRootId: "root:repo", path: resolve(".") }],
      catalog: [fixture.entry],
    }), CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, "repository overlap");
  }],
  ["missing allowed root is not created", () => {
    const fixture = buildFixture();
    const parent = mkdtempSync(resolve(tmpdir(), "alpha-rehearsal-missing-"));
    const missing = resolve(parent, "missing");
    try {
      throws(() => new EventContractCollectionRunnerFixtureRehearsalPreparation({
        repositoryRoot: resolve("."),
        allowedRoots: [{ allowedRootId: "root:missing", path: missing }],
        catalog: [fixture.entry],
      }), CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, "missing root");
      equal(existsSync(missing), false, "not created");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }],
  ["catalog entry fingerprint substitution is rejected", () => {
    const fixture = buildFixture();
    const parent = mkdtempSync(resolve(tmpdir(), "alpha-rehearsal-catalog-"));
    try {
      throws(() => new EventContractCollectionRunnerFixtureRehearsalPreparation({
        repositoryRoot: resolve("."),
        allowedRoots: [{ allowedRootId: "root:test", path: parent }],
        catalog: [{ ...fixture.entry, fingerprint: APPROVAL }],
      }), CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "catalog fingerprint");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }],
  ["allowed root must be a directory", () => {
    const fixture = buildFixture();
    const parent = mkdtempSync(resolve(tmpdir(), "alpha-rehearsal-root-file-"));
    const file = resolve(parent, "root.txt");
    writeFileSync(file, "not a directory", { encoding: "utf8" });
    try {
      throws(() => new EventContractCollectionRunnerFixtureRehearsalPreparation({
        repositoryRoot: resolve("."),
        allowedRoots: [{ allowedRootId: "root:file", path: file }],
        catalog: [fixture.entry],
      }), CollectionRunnerRehearsalPreparationErrorCode.UnsafeRoot, "root file");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }],
  ["duplicate allowed-root identity is rejected", () => withHarness(({ allowed, fixture }) => {
    throws(() => new EventContractCollectionRunnerFixtureRehearsalPreparation({
      repositoryRoot: resolve("."),
      allowedRoots: [
        { allowedRootId: "root:duplicate", path: allowed },
        { allowedRootId: "root:duplicate", path: allowed },
      ],
      catalog: [fixture.entry],
    }), CollectionRunnerRehearsalPreparationErrorCode.InvalidRequest, "duplicate root");
  })],
  ["duplicate catalog identity is rejected", () => withHarness(({ allowed, fixture }) => {
    throws(() => new EventContractCollectionRunnerFixtureRehearsalPreparation({
      repositoryRoot: resolve("."),
      allowedRoots: [{ allowedRootId: "root:test", path: allowed }],
      catalog: [fixture.entry, fixture.entry],
    }), CollectionRunnerRehearsalPreparationErrorCode.CatalogMismatch, "duplicate catalog");
  })],
  ["store preparation failure quarantines rather than deletes evidence", () => {
    const root = mkdtempSync(resolve(tmpdir(), "alpha-rehearsal-failure-"));
    const allowed = resolve(root, "allowed");
    mkdirSync(allowed);
    const fixture = buildFixture();
    const workspace = resolve(allowed, `rehearsal-${fixture.manifest.fingerprint.split(":")[1]}`);
    const originalNow = Date.now;
    try {
      Date.now = () => 123;
      const preparation = new EventContractCollectionRunnerFixtureRehearsalPreparation({
        repositoryRoot: resolve("."),
        allowedRoots: [{ allowedRootId: "root:test", path: allowed }],
        catalog: [fixture.entry],
        openStore: () => { throw new Error("injected preparation failure"); },
      });
      throws(() => preparation.prepare({
        manifest: fixture.manifest,
        catalogEntryId: fixture.entry.catalogEntryId,
        allowedRootId: "root:test",
        preparedAtUtc: PREPARED_AT,
      }), CollectionRunnerRehearsalPreparationErrorCode.PreparationFailed, "injected failure");
      truth(existsSync(`${workspace}.blocked-123`), "quarantine retained");
    } finally {
      Date.now = originalNow;
      rmSync(root, { recursive: true, force: true });
    }
  }],
  ["altered replay record fails closed", () => withHarness(({ preparation, request }) => {
    const result = preparation.prepare(request);
    writeFileSync(resolve(result.workspace.workspaceRoot, "preparation.json"), "{}\n", { encoding: "utf8" });
    throws(() => preparation.prepare(request), CollectionRunnerRehearsalPreparationErrorCode.ReplayConflict, "altered record");
  })],
];

let passed = 0;
for (const [name, run] of tests) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(`Event Contract Collection Runner fixture rehearsal preparation: ${passed}/${tests.length} passed.`);
