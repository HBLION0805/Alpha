import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
  EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
  EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
  CollectionRunnerClockSynchronizationStatus,
  CollectionRunnerFixtureAdapterOutcome,
  CollectionRunnerFixtureWorkerOutcome,
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerRuntimeMode,
  CollectionRunnerSchedulerAction,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  EventContractEvaluationMethod,
  EventContractObservationEventType,
  EventContractSourceCapability,
  EventContractSourceClass,
  EventContractSourceCredentialMode,
  EventContractSourceExecutionMode,
  EventContractSourceMappingReviewStatus,
  EventContractThresholdOperator,
  type CollectionRunnerClockHealthProbe,
  type CollectionRunnerFixtureAdapterResult,
  type CollectionRunnerMonotonicClock,
  type CollectionRunnerPilotActivation,
  type CollectionRunnerRuntimeConfiguration,
  type CollectionRunnerScheduledTask,
  type CollectionRunnerSchedulerInput,
  type CollectionRunnerWallClock,
  type EventContractSourceMapping,
  type EventContractSourceProvider,
  type EventContractSourceSnapshot,
} from "../../contracts";
import {
  CollectionRunnerProcessStopBarrier,
  SessionGatedEventContractCollectionRunnerRepository,
  type CollectionRunnerProcessSessionIdentity,
} from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";
import type {
  AcquireTaskLeaseTransaction,
  CollectionRunnerBudgetCounters,
  CommitTaskEvidenceTransaction,
  CreatePilotArtifactTransaction,
  EventContractCollectionRunnerRepository,
  FinalizeTaskFailureTransaction,
  MaterializeTasksTransaction,
  MarkTaskValidatingTransaction,
  RegisterRunnerDefinitionTransaction,
  StartTaskAttemptTransaction,
  TransitionPilotTransaction,
  TransitionTaskTransaction,
} from "../../repositories/EventContractCollectionRunnerRepository";
import type {
  CollectionRunnerControlExecutionReceipt,
  CollectionRunnerRecoverySessionAuthorization,
  EventContractCollectionRunnerRecoveryControlRepository,
  ExecuteEmergencyStopTransaction,
  ExecuteOwnerRecoveryDecisionTransaction,
  PersistOwnerRecoveryDecisionTransaction,
  PersistRecoveryAssessmentTransaction,
  ValidateRecoverySessionGateInput,
} from "../../repositories/EventContractCollectionRunnerRecoveryControlRepository";
import { EventContractCollectionRunnerEngine } from "../event-contract-collection-runner/EventContractCollectionRunnerEngine";
import { EventContractSourceEngine } from "../event-contract-source/EventContractSourceEngine";
import {
  EventContractCollectionRunnerFixtureWorker,
  type CollectionRunnerFixtureCancellationPort,
  type CollectionRunnerFixtureOnlyAdapter,
} from "./EventContractCollectionRunnerFixtureWorker";
import {
  EventContractCollectionRunnerRuntimeFoundationError,
  acquireCollectionRunnerRuntimeOwnership,
  createCollectionRunnerRuntimeConfiguration,
  resolveCollectionRunnerRuntimePaths,
} from "./EventContractCollectionRunnerRuntimeFoundation";
import { EventContractCollectionRunnerScheduler } from "./EventContractCollectionRunnerScheduler";

const FP_BUILD = "fnv1a64:1111111111111111";
const FP_PLAN = "fnv1a64:2222222222222222";
const NOW = "2026-07-24T13:06:00.000Z";
const runnerEngine = new EventContractCollectionRunnerEngine();
const sourceEngine = new EventContractSourceEngine();

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function expectFoundationError(
  run: () => unknown,
  code: CollectionRunnerRuntimeFoundationErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof EventContractCollectionRunnerRuntimeFoundationError,
      "typed runtime error",
    );
    assertEqual(
      (error as EventContractCollectionRunnerRuntimeFoundationError).code,
      code,
      "runtime error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function schedulerInput(
  changes: Partial<CollectionRunnerSchedulerInput> = {},
): CollectionRunnerSchedulerInput {
  return {
    nowUtc: NOW,
    stopBarrierTripped: false,
    lockOwnershipVerified: true,
    configurationIdentityVerified: true,
    clockHealthy: true,
    processSessionAuthorized: true,
    pilotState: "ACTIVE",
    emergencyStopObserved: false,
    budgetAvailable: true,
    tasks: [
      {
        taskId: "task:exchange",
        sourceLane: "EXCHANGE",
        state: "DUE",
        requiredActionAtUtc: "2026-07-24T13:05:00.000Z",
        evidenceCutoffAtUtc: "2026-07-24T13:15:00.000Z",
        deadlineAtUtc: "2026-07-24T13:20:00.000Z",
        retryEligibleAtUtc: null,
      },
      {
        taskId: "task:platform",
        sourceLane: "PLATFORM",
        state: "DUE",
        requiredActionAtUtc: "2026-07-24T13:05:00.000Z",
        evidenceCutoffAtUtc: "2026-07-24T13:15:00.000Z",
        deadlineAtUtc: "2026-07-24T13:20:00.000Z",
        retryEligibleAtUtc: null,
      },
    ],
    ...changes,
  };
}

class SequenceWallClock implements CollectionRunnerWallClock {
  #index = 0;
  public constructor(private readonly values: readonly string[]) {}
  public nowUtc(): string {
    const value = this.values[this.#index] ?? this.values.at(-1);
    if (value === undefined) throw new Error("No wall-clock fixture.");
    this.#index += 1;
    return value;
  }
}

class SequenceMonotonicClock implements CollectionRunnerMonotonicClock {
  #index = 0;
  public constructor(private readonly values: readonly bigint[]) {}
  public nowNanoseconds(): bigint {
    const value = this.values[this.#index] ?? this.values.at(-1);
    if (value === undefined) throw new Error("No monotonic fixture.");
    this.#index += 1;
    return value;
  }
}

class FixedHealthProbe implements CollectionRunnerClockHealthProbe {
  public observe() {
    return {
      observedAtUtc: "2026-07-24T13:05:59.000Z",
      synchronizationStatus:
        CollectionRunnerClockSynchronizationStatus.Synchronized,
      estimatedAbsoluteUtcOffsetMilliseconds: 10,
      source: "TEST_CLOCK",
      policyVersion: "1.0",
      freshnessDeadlineUtc: "2026-07-24T13:10:00.000Z",
    };
  }
}

class ToggleCancellation implements CollectionRunnerFixtureCancellationPort {
  public cancelled = false;
  public isCancellationRequested(): boolean {
    return this.cancelled;
  }
}

function createProvider(): EventContractSourceProvider {
  return sourceEngine.createProvider({
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    providerId: "provider:exchange:fixture",
    displayName: "Fixture Exchange",
    sourceClass: EventContractSourceClass.Exchange,
    exchangeId: "exchange:fixture",
    capabilities: [EventContractSourceCapability.TopOfBook],
    executionModes: [EventContractSourceExecutionMode.Fixture],
    credentialMode: EventContractSourceCredentialMode.None,
    documentationReferences: ["https://example.test/official-api"],
    active: true,
  });
}

function terms() {
  return {
    title: "Will BTC be above the target at 13:15 UTC?",
    termsVersion: "1.0",
    eventType: EventContractObservationEventType.BtcFifteenMinute,
    instrumentId: EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
    outcomePair: EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
    windowStartsAt: "2026-07-24T13:00:00.000Z",
    tradingClosesAt: "2026-07-24T13:14:59.000Z",
    evaluatesAt: "2026-07-24T13:15:00.000Z",
    evaluationMethod: EventContractEvaluationMethod.AtScheduledTime,
    thresholdOperator: EventContractThresholdOperator.Above,
    targetPrice: { atomicValue: "6500000", scale: 2 },
    settlementSourceId: "source:brti",
  };
}

function createMapping(
  provider: EventContractSourceProvider,
): EventContractSourceMapping {
  return sourceEngine.createMapping({
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    mappingId: "mapping:fixture:btc:1315",
    version: "1.0",
    createdAt: "2026-07-24T12:00:00.000Z",
    reviewStatus: EventContractSourceMappingReviewStatus.ReviewedExact,
    reviewedAt: "2026-07-24T12:15:00.000Z",
    reviewerId: "owner:alpha",
    evidenceIds: ["evidence:exchange-terms", "evidence:platform-terms"],
    provider,
    robinhoodIdentity: {
      exchangeId: "exchange:fixture",
      marketId: "rh-market:btc:1315",
      contractId: "rh-contract:btc:1315",
      termsId: "rh-terms:btc:1315",
    },
    externalIdentity: {
      providerId: provider.providerId,
      exchangeId: "exchange:fixture",
      eventId: "event:btc:20260724",
      marketId: "market:btc:1315",
      contractId: "contract:btc:1315",
      nativeTicker: "BTC-26JUL241315",
    },
    robinhoodTerms: terms(),
    externalTerms: terms(),
  });
}

function createActivation(
  provider: EventContractSourceProvider,
  mapping: EventContractSourceMapping,
): CollectionRunnerPilotActivation {
  const definition = runnerEngine.createRunnerDefinition({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    runnerDefinitionId: "event-contract-runner:pilot",
    version: "1.0",
    buildFingerprint: FP_BUILD,
    supportedCapabilities: [EventContractSourceCapability.TopOfBook],
    maximumActivePilots: 1,
    maximumWorkers: 1,
    maximumInFlightRequests: 1,
    maximumRequestsPerSecond: 1,
    maximumClockOffsetMilliseconds: 1000,
  });
  return runnerEngine.createPilotActivation({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    activationId: "activation:pilot-1",
    ownerId: "owner:alpha",
    approvedAt: "2026-07-24T12:30:00.000Z",
    startsAt: "2026-07-24T13:00:00.000Z",
    stopsAt: "2026-07-24T14:00:00.000Z",
    frozenPlanId: "plan:btc15m:1",
    frozenPlanFingerprint: FP_PLAN,
    runnerDefinition: definition,
    admittedProviderFingerprints: [provider.fingerprint],
    admittedMappingFingerprints: [mapping.fingerprint],
    maximumEvents: 2,
    maximumRequests: 4,
  });
}

function createTask(
  activation: CollectionRunnerPilotActivation,
  provider: EventContractSourceProvider,
  mapping: EventContractSourceMapping,
): CollectionRunnerScheduledTask {
  return runnerEngine.createScheduledTask(
    {
      schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
      taskId: "task:event-1:top-of-book",
      observationSlot: "pre-close",
      scheduledAt: "2026-07-24T13:05:00.000Z",
      deadlineAt: "2026-07-24T13:20:00.000Z",
      runnerDefinitionVersion: "1.0",
      admission: {
        frozenPlanId: activation.frozenPlanId,
        frozenPlanFingerprint: activation.frozenPlanFingerprint,
        plannedEventId: "event:btc15m:1",
        evidenceCutoffAt: "2026-07-24T13:15:00.000Z",
        providerId: provider.providerId,
        providerFingerprint: provider.fingerprint,
        capability: EventContractSourceCapability.TopOfBook,
        executionMode: EventContractSourceExecutionMode.Fixture,
        sourceLane: CollectionRunnerSourceLane.Exchange,
        mappingId: mapping.mappingId,
        mappingVersion: mapping.version,
        mappingFingerprint: mapping.fingerprint,
        sourceRecordId: "source-record:fixture:001",
        requestPolicyId: "event-contract-source:fixture-only:1",
        requestPolicyVersion: "1.0",
        bounds: {
          maximumAttempts: 2,
          maximumRawPayloadBytes: 100_000,
          maximumRecordCount: 10,
          requestDeadlineMilliseconds: 5_000,
        },
        activationId: activation.activationId,
        activationExpiresAt: activation.stopsAt,
      },
    },
    activation,
  );
}

function createSnapshot(
  provider: EventContractSourceProvider,
  mapping: EventContractSourceMapping,
  task: CollectionRunnerScheduledTask,
  changes: Readonly<Record<string, unknown>> = {},
): EventContractSourceSnapshot {
  return sourceEngine.createSnapshot({
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    snapshotId: "snapshot:fixture:btc:001",
    provider,
    mapping,
    capability: EventContractSourceCapability.TopOfBook,
    executionMode: EventContractSourceExecutionMode.Fixture,
    sourceRecordId: task.admission.sourceRecordId,
    observedAt: "2026-07-24T13:06:00.200Z",
    publishedAt: "2026-07-24T13:06:00.250Z",
    receivedAt: "2026-07-24T13:06:00.300Z",
    normalizedAt: "2026-07-24T13:06:00.400Z",
    payloadFingerprint: "fnv1a64:0123456789abcdef",
    rawPayloadBytes: 2_048,
    recordCount: 1,
    ...changes,
  });
}

class FakeRunnerRepository implements EventContractCollectionRunnerRepository {
  public readonly calls: string[] = [];
  public taskState = CollectionRunnerTaskState.Due;
  public taskVersion = 2;
  public budgetVersion = 2;
  public requestsStarted = 0;
  public evidenceCommitted = 0;
  public failMethod: string | null = null;

  public constructor(
    private readonly activation: CollectionRunnerPilotActivation,
    private readonly task: CollectionRunnerScheduledTask,
  ) {}

  public registerRunnerDefinition(_value: RegisterRunnerDefinitionTransaction): never {
    throw new Error("unsupported");
  }
  public createPilotArtifact(_value: CreatePilotArtifactTransaction): never {
    throw new Error("unsupported");
  }
  public materializeTasks(_value: MaterializeTasksTransaction): never {
    throw new Error("unsupported");
  }
  public transitionPilot(_value: TransitionPilotTransaction): never {
    throw new Error("unsupported");
  }
  public transitionTask(_value: TransitionTaskTransaction): never {
    throw new Error("unsupported");
  }
  public acquireTaskLease(value: AcquireTaskLeaseTransaction) {
    this.#maybeFail("acquireTaskLease");
    this.calls.push("T7");
    assertEqual(value.expectedTaskVersion, this.taskVersion, "T7 task version");
    this.taskState = CollectionRunnerTaskState.Leased;
    this.taskVersion += 1;
    return Object.freeze({ ...value.lease, taskId: value.taskId, aggregateVersion: 1 as const });
  }
  public startTaskAttempt(value: StartTaskAttemptTransaction) {
    this.#maybeFail("startTaskAttempt");
    this.calls.push("T8");
    assertEqual(value.expectedTaskVersion, this.taskVersion, "T8 task version");
    this.taskState = CollectionRunnerTaskState.InFlight;
    this.taskVersion += 1;
    this.budgetVersion += 1;
    this.requestsStarted += 1;
    return Object.freeze({
      attemptId: value.claim.attemptId,
      taskId: value.taskId,
      attemptNumber: this.requestsStarted,
      attemptFingerprint: "fnv1a64:aaaaaaaaaaaaaaaa",
    });
  }
  public markTaskValidating(value: MarkTaskValidatingTransaction) {
    this.#maybeFail("markTaskValidating");
    this.calls.push("T8B");
    assertEqual(value.expectedTaskVersion, this.taskVersion, "T8B task version");
    this.taskState = CollectionRunnerTaskState.Validating;
    this.taskVersion += 1;
    return Object.freeze({
      taskId: value.taskId,
      state: CollectionRunnerTaskState.Validating,
      aggregateVersion: this.taskVersion,
    });
  }
  public finalizeTaskFailure(value: FinalizeTaskFailureTransaction) {
    this.#maybeFail("finalizeTaskFailure");
    this.calls.push("T9");
    assertEqual(value.expectedTaskVersion, this.taskVersion, "T9 task version");
    this.taskState = value.nextState;
    this.taskVersion += 1;
    this.budgetVersion += 1;
    return Object.freeze({
      ...value.result,
      attemptId: value.attemptId,
      resultFingerprint: "fnv1a64:bbbbbbbbbbbbbbbb",
      createdAtUtc: value.evidence.occurredAtUtc,
    });
  }
  public commitTaskEvidence(value: CommitTaskEvidenceTransaction) {
    this.#maybeFail("commitTaskEvidence");
    this.calls.push("T10");
    assertEqual(value.expectedTaskVersion, this.taskVersion, "T10 task version");
    this.taskState = CollectionRunnerTaskState.Committed;
    this.taskVersion += 1;
    this.budgetVersion += 1;
    this.evidenceCommitted += 1;
    return Object.freeze({
      evidenceId: value.evidenceId,
      taskId: value.taskId,
      taskIdempotencyKey: this.task.idempotencyKey,
      attemptId: value.attemptId,
      providerFingerprint: value.snapshot.providerFingerprint,
      mappingFingerprint: value.snapshot.mappingFingerprint,
      sourceSnapshotFingerprint: value.snapshot.fingerprint,
      payloadFingerprint: value.snapshot.payloadFingerprint,
      capability: value.snapshot.capability,
      sourceLane: this.task.admission.sourceLane,
      observedAtUtc: value.snapshot.observedAt,
      receivedAtUtc: value.snapshot.receivedAt,
      normalizedAtUtc: value.snapshot.normalizedAt,
      rawPayloadBytes: value.snapshot.rawPayloadBytes,
      recordCount: value.snapshot.recordCount,
      committedAtUtc: value.committedAtUtc,
    });
  }
  public getRunnerDefinition() {
    return this.activation.runnerDefinition;
  }
  public getPilotState() {
    return Object.freeze({
      activationId: this.activation.activationId,
      state: CollectionRunnerPilotState.Active,
      aggregateVersion: 2,
    });
  }
  public getTaskState() {
    return Object.freeze({
      taskId: this.task.taskId,
      state: this.taskState,
      aggregateVersion: this.taskVersion,
    });
  }
  public getBudgetCounters(): CollectionRunnerBudgetCounters {
    return Object.freeze({
      activationId: this.activation.activationId,
      aggregateVersion: this.budgetVersion,
      eventsScheduled: 1,
      requestsStarted: this.requestsStarted,
      bytesReceived: 0,
      recordsReceived: 0,
      retriesStarted: 0,
      evidenceCommitted: this.evidenceCommitted,
      tasksMissed: 0,
      updatedAtUtc: NOW,
    });
  }
  public getEvidenceByTaskId() {
    return null;
  }
  #maybeFail(method: string): void {
    if (this.failMethod === method) throw new Error(`Injected ${method} failure.`);
  }
}

class FakeRecoveryControl
  implements EventContractCollectionRunnerRecoveryControlRepository
{
  public gateCount = 0;
  public constructor(
    private readonly session: CollectionRunnerProcessSessionIdentity,
  ) {}
  public persistRecoveryAssessment(_value: PersistRecoveryAssessmentTransaction): never {
    throw new Error("unsupported");
  }
  public persistOwnerRecoveryDecision(_value: PersistOwnerRecoveryDecisionTransaction): never {
    throw new Error("unsupported");
  }
  public executeOwnerRecoveryDecision(_value: ExecuteOwnerRecoveryDecisionTransaction): CollectionRunnerControlExecutionReceipt {
    throw new Error("unsupported");
  }
  public executeEmergencyStop(_value: ExecuteEmergencyStopTransaction): CollectionRunnerControlExecutionReceipt {
    throw new Error("unsupported");
  }
  public validateRecoverySessionGate(
    input: ValidateRecoverySessionGateInput,
  ): CollectionRunnerRecoverySessionAuthorization {
    this.gateCount += 1;
    assertEqual(input.processSessionId, this.session.processSessionId, "session gate");
    return Object.freeze({
      sessionAuthorizationId: this.session.sessionAuthorizationId,
      authorizationFingerprint: this.session.authorizationFingerprint,
      decisionId: "decision:test",
      assessmentId: "assessment:test",
      activationId: this.session.activationId,
      expectedActivationAggregateVersion: 2,
      bootIdentity: this.session.bootIdentity,
      processSessionId: this.session.processSessionId,
      authorizedAtUtc: "2026-07-24T13:00:00.000Z",
      expiresAtUtc: "2026-07-24T14:00:00.000Z",
      revokedAtUtc: null,
      revocationReasonCode: null,
    });
  }
  public getRecoveryAssessment() {
    return null;
  }
  public getOwnerRecoveryDecision() {
    return null;
  }
  public getSessionAuthorization() {
    return null;
  }
  public getControlExecutionReceipt() {
    return null;
  }
}

class FakeAdapter implements CollectionRunnerFixtureOnlyAdapter {
  public calls = 0;
  public result: CollectionRunnerFixtureAdapterResult;
  public onCollect: (() => void) | null = null;
  public readonly adapterId = "adapter:fixture:test";
  public readonly adapterVersion = "1.0";
  public policyVersion = "1.0";
  public readonly executionMode = EventContractSourceExecutionMode.Fixture;
  public constructor(
    public providerFingerprint: string,
    public mappingFingerprint: string | null,
    public capability: EventContractSourceCapability,
    public sourceRecordId: string,
    result: CollectionRunnerFixtureAdapterResult,
  ) {
    this.result = result;
  }
  public collect(): CollectionRunnerFixtureAdapterResult {
    this.calls += 1;
    this.onCollect?.();
    return this.result;
  }
}

interface WorkerContext {
  readonly root: string;
  readonly activation: CollectionRunnerPilotActivation;
  readonly task: CollectionRunnerScheduledTask;
  readonly snapshot: EventContractSourceSnapshot;
  readonly configuration: CollectionRunnerRuntimeConfiguration;
  readonly baseRepository: FakeRunnerRepository;
  readonly recovery: FakeRecoveryControl;
  readonly stopBarrier: CollectionRunnerProcessStopBarrier;
  readonly cancellation: ToggleCancellation;
  readonly adapter: FakeAdapter;
  readonly worker: EventContractCollectionRunnerFixtureWorker;
  release(): void;
}

function withWorker(
  run: (context: WorkerContext) => void,
  adapterResult?: (
    snapshot: EventContractSourceSnapshot,
  ) => CollectionRunnerFixtureAdapterResult,
): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-runner-worker-"));
  const provider = createProvider();
  const mapping = createMapping(provider);
  const activation = createActivation(provider, mapping);
  const task = createTask(activation, provider, mapping);
  const snapshot = createSnapshot(provider, mapping, task);
  const configuration = createCollectionRunnerRuntimeConfiguration({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_SCHEMA_VERSION,
    runtimeId: "runtime:fixture-test",
    runtimeMode: CollectionRunnerRuntimeMode.FixtureOnly,
    runtimeControlRoot: join(root, "control"),
    sqliteRoot: join(root, "sqlite"),
    storeId: "collection-runner",
    activationId: activation.activationId,
    applicationBuildFingerprint: activation.runnerDefinition.buildFingerprint,
    runnerDefinitionFingerprint: activation.runnerDefinition.fingerprint,
    frozenPlanFingerprint: activation.frozenPlanFingerprint,
    fixtureProviderFingerprint: provider.fingerprint,
    maximumClockOffsetMilliseconds: 1_000,
    maximumClockHealthAgeMilliseconds: 300_000,
  });
  const paths = resolveCollectionRunnerRuntimePaths(configuration);
  const ownership = acquireCollectionRunnerRuntimeOwnership({
    configuration,
    paths,
    bootIdentityPort: {
      readBootIdentity: () => ({
        bootIdentity: "boot:test",
        source: "TEST_BOOT",
        sourceVersion: "1.0",
      }),
    },
    processNoncePort: {
      createNonce: () =>
        "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    processId: 1234,
    wallClock: { nowUtc: () => "2026-07-24T13:00:00.000Z" },
  });
  const session: CollectionRunnerProcessSessionIdentity = Object.freeze({
    sessionAuthorizationId: "session-auth:test",
    authorizationFingerprint: "fnv1a64:cccccccccccccccc",
    activationId: activation.activationId,
    bootIdentity: ownership.ownership.bootIdentity,
    processSessionId: ownership.ownership.processSessionId,
  });
  const baseRepository = new FakeRunnerRepository(activation, task);
  const recovery = new FakeRecoveryControl(session);
  const stopBarrier = new CollectionRunnerProcessStopBarrier();
  const repository = new SessionGatedEventContractCollectionRunnerRepository(
    baseRepository,
    recovery,
    session,
    stopBarrier,
  );
  const cancellation = new ToggleCancellation();
  const adapter = new FakeAdapter(
    provider.fingerprint,
    mapping.fingerprint,
    EventContractSourceCapability.TopOfBook,
    task.admission.sourceRecordId,
    adapterResult?.(snapshot) ?? {
      outcome: CollectionRunnerFixtureAdapterOutcome.Snapshot,
      snapshot,
      finishedAtUtc: "2026-07-24T13:06:00.500Z",
    },
  );
  const worker = new EventContractCollectionRunnerFixtureWorker(
    repository,
    ownership,
    stopBarrier,
    configuration,
    new SequenceWallClock([
      "2026-07-24T13:06:00.000Z",
      "2026-07-24T13:06:00.100Z",
      "2026-07-24T13:06:00.500Z",
      "2026-07-24T13:06:00.600Z",
    ]),
    new SequenceMonotonicClock([
      0n,
      1_000_000_000n,
      1_100_000_000n,
      1_500_000_000n,
      1_600_000_000n,
    ]),
    new FixedHealthProbe(),
    adapter,
    cancellation,
  );
  try {
    run({
      root,
      activation,
      task,
      snapshot,
      configuration,
      baseRepository,
      recovery,
      stopBarrier,
      cancellation,
      adapter,
      worker,
      release: () => ownership.releaseCleanly(),
    });
  } finally {
    if (!stopBarrier.isTripped()) {
      try {
        ownership.releaseCleanly();
      } catch {
        // A test may already release exact ownership.
      }
    }
    rmSync(root, { recursive: true, force: true });
  }
}

function cycleInput(context: WorkerContext, completedAttemptCount = 0) {
  return {
    activation: context.activation,
    task: context.task,
    expectedTaskVersion: 2,
    expectedBudgetVersion: 2,
    completedAttemptCount,
    workerId: "worker:fixture:1",
    leaseDurationMilliseconds: 5_000,
  };
}

const scheduler = new EventContractCollectionRunnerScheduler();

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "scheduler chooses one stable platform-first task",
    () => {
      const result = scheduler.plan(schedulerInput());
      assertEqual(result.action, CollectionRunnerSchedulerAction.AcquireExactTask, "action");
      assertEqual(result.taskId, "task:platform", "task");
    },
  ],
  [
    "scheduler is independent of caller task order",
    () => {
      const input = schedulerInput();
      const reversed = scheduler.plan({ ...input, tasks: [...input.tasks].reverse() });
      assertEqual(reversed.fingerprint, scheduler.plan(input).fingerprint, "fingerprint");
    },
  ],
  [
    "scheduler marks earliest expired task missed",
    () => {
      const input = schedulerInput({ nowUtc: "2026-07-24T13:15:00.000Z" });
      const result = scheduler.plan(input);
      assertEqual(result.action, CollectionRunnerSchedulerAction.MarkExactTaskMissed, "miss");
      assertEqual(result.taskId, "task:platform", "missed task");
    },
  ],
  [
    "scheduler waits until the next future action",
    () => {
      const input = schedulerInput({
        nowUtc: "2026-07-24T13:00:00.000Z",
        tasks: [schedulerInput().tasks[0]!],
      });
      const result = scheduler.plan(input);
      assertEqual(result.action, CollectionRunnerSchedulerAction.WaitUntil, "wait");
      assertEqual(result.waitUntilUtc, "2026-07-24T13:05:00.000Z", "wake");
    },
  ],
  [
    "scheduler never acquires RETRY_WAIT directly",
    () => {
      const task = {
        ...schedulerInput().tasks[0]!,
        state: "RETRY_WAIT" as const,
        retryEligibleAtUtc: "2026-07-24T13:05:30.000Z",
      };
      const result = scheduler.plan(schedulerInput({ tasks: [task] }));
      assertEqual(result.action, CollectionRunnerSchedulerAction.WaitUntil, "wait");
      assertEqual(result.reasonCode, "RETRY_REQUIRES_DUE_TRANSITION", "reason");
    },
  ],
  [
    "scheduler fails closed on lock loss",
    () => {
      const result = scheduler.plan(schedulerInput({ lockOwnershipVerified: false }));
      assertEqual(result.action, CollectionRunnerSchedulerAction.FailClosed, "lock");
    },
  ],
  [
    "scheduler fails closed on configuration drift",
    () => {
      const result = scheduler.plan(schedulerInput({ configurationIdentityVerified: false }));
      assertEqual(result.action, CollectionRunnerSchedulerAction.FailClosed, "config");
    },
  ],
  [
    "scheduler fails closed on stale session",
    () => {
      const result = scheduler.plan(schedulerInput({ processSessionAuthorized: false }));
      assertEqual(result.action, CollectionRunnerSchedulerAction.FailClosed, "session");
    },
  ],
  [
    "scheduler requests Emergency Stop for unhealthy clock",
    () => {
      const result = scheduler.plan(schedulerInput({ clockHealthy: false }));
      assertEqual(result.action, CollectionRunnerSchedulerAction.TripEmergencyStop, "clock");
    },
  ],
  [
    "scheduler respects process Stop before acquisition",
    () => {
      const result = scheduler.plan(schedulerInput({ stopBarrierTripped: true }));
      assertEqual(result.action, CollectionRunnerSchedulerAction.RequestGracefulCompletion, "stop");
    },
  ],
  [
    "scheduler stops when budget is exhausted",
    () => {
      const result = scheduler.plan(schedulerInput({ budgetAvailable: false }));
      assertEqual(result.action, CollectionRunnerSchedulerAction.RequestGracefulCompletion, "budget");
    },
  ],
  [
    "scheduler rejects undeclared input fields",
    () => {
      expectFoundationError(
        () => scheduler.plan({ ...schedulerInput(), hiddenTimer: 1 } as unknown as CollectionRunnerSchedulerInput),
        CollectionRunnerRuntimeFoundationErrorCode.InvalidSchedulerInput,
      );
    },
  ],
  [
    "fixture Worker commits one snapshot through T7 T8 T8B T10",
    () =>
      withWorker((context) => {
        const result = context.worker.runOneCycle(cycleInput(context));
        assertEqual(result.outcome, CollectionRunnerFixtureWorkerOutcome.EvidenceCommitted, "outcome");
        assertEqual(context.adapter.calls, 1, "adapter calls");
        assertEqual(context.baseRepository.calls.join(","), "T7,T8,T8B,T10", "transactions");
        assertEqual(context.recovery.gateCount, 4, "session gates");
      }),
  ],
  [
    "fixture Worker rejects adapter drift before mutation",
    () =>
      withWorker((context) => {
        context.adapter.providerFingerprint = "fnv1a64:9999999999999999";
        expectFoundationError(
          () => context.worker.runOneCycle(cycleInput(context)),
          CollectionRunnerRuntimeFoundationErrorCode.AdapterBindingMismatch,
        );
        assertEqual(context.baseRepository.calls.length, 0, "no writes");
      }),
  ],
  [
    "fixture Worker rejects request-policy drift before mutation",
    () =>
      withWorker((context) => {
        context.adapter.policyVersion = "2.0";
        expectFoundationError(
          () => context.worker.runOneCycle(cycleInput(context)),
          CollectionRunnerRuntimeFoundationErrorCode.AdapterBindingMismatch,
        );
        assertEqual(context.baseRepository.calls.length, 0, "no writes");
      }),
  ],
  [
    "fixture Worker rejects cancellation before lease",
    () =>
      withWorker((context) => {
        context.cancellation.cancelled = true;
        expectFoundationError(
          () => context.worker.runOneCycle(cycleInput(context)),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        );
        assertEqual(context.baseRepository.calls.length, 0, "no writes");
      }),
  ],
  [
    "fixture Worker rejects process Stop before lease",
    () =>
      withWorker((context) => {
        context.stopBarrier.trip("OWNER_EMERGENCY_STOP");
        expectFoundationError(
          () => context.worker.runOneCycle(cycleInput(context)),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        );
        assertEqual(context.baseRepository.calls.length, 0, "no writes");
      }),
  ],
  [
    "fixture Worker rejects a tampered task artifact",
    () =>
      withWorker((context) => {
        const input = cycleInput(context);
        expectFoundationError(
          () =>
            context.worker.runOneCycle({
              ...input,
              task: {
                ...input.task,
                hiddenAuthority: "NETWORK",
              } as unknown as CollectionRunnerScheduledTask,
            }),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        );
        assertEqual(context.baseRepository.calls.length, 0, "no writes");
      }),
  ],
  [
    "fixture Worker rejects exhausted request budget",
    () =>
      withWorker((context) => {
        context.baseRepository.requestsStarted =
          context.activation.maximumRequests;
        expectFoundationError(
          () => context.worker.runOneCycle(cycleInput(context)),
          CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        );
        assertEqual(context.baseRepository.calls.length, 0, "no writes");
      }),
  ],
  [
    "fixture Worker records one bounded retry",
    () =>
      withWorker(
        (context) => {
          const result = context.worker.runOneCycle(cycleInput(context));
          assertEqual(result.outcome, CollectionRunnerFixtureWorkerOutcome.RetryWait, "retry");
          assertEqual(context.baseRepository.calls.join(","), "T7,T8,T9", "transactions");
        },
        () => ({
          outcome: CollectionRunnerFixtureAdapterOutcome.Failure,
          outcomeCode: "FIXTURE_TEMPORARY_FAILURE",
          retryable: true,
          finishedAtUtc: "2026-07-24T13:06:00.500Z",
        }),
      ),
  ],
  [
    "fixture Worker stops retry at the attempt ceiling",
    () =>
      withWorker(
        (context) => {
          const result = context.worker.runOneCycle(cycleInput(context, 1));
          assertEqual(result.outcome, CollectionRunnerFixtureWorkerOutcome.TerminalFailed, "terminal");
        },
        () => ({
          outcome: CollectionRunnerFixtureAdapterOutcome.Failure,
          outcomeCode: "FIXTURE_TEMPORARY_FAILURE",
          retryable: true,
          finishedAtUtc: "2026-07-24T13:06:00.500Z",
        }),
      ),
  ],
  [
    "fixture Worker persists cancellation after attempt claim",
    () =>
      withWorker((context) => {
        context.adapter.onCollect = () => {
          context.cancellation.cancelled = true;
        };
        const result = context.worker.runOneCycle(cycleInput(context));
        assertEqual(result.outcome, CollectionRunnerFixtureWorkerOutcome.Cancelled, "cancelled");
        assertEqual(context.baseRepository.calls.join(","), "T7,T8,T9", "transactions");
      }),
  ],
  [
    "fixture Worker persists invalid snapshot as terminal failure",
    () =>
      withWorker(
        (context) => {
          const result = context.worker.runOneCycle(cycleInput(context));
          assertEqual(result.outcome, CollectionRunnerFixtureWorkerOutcome.TerminalFailed, "terminal");
          assertEqual(context.baseRepository.calls.join(","), "T7,T8,T8B,T9", "transactions");
        },
        (snapshot) => ({
          outcome: CollectionRunnerFixtureAdapterOutcome.Snapshot,
          snapshot: { ...snapshot, sourceRecordId: "source-record:wrong" },
          finishedAtUtc: "2026-07-24T13:06:00.500Z",
        }),
      ),
  ],
  [
    "fixture Worker converts adapter exception to terminal T9",
    () =>
      withWorker((context) => {
        context.adapter.onCollect = () => {
          throw new Error("fixture exploded");
        };
        const result = context.worker.runOneCycle(cycleInput(context));
        assertEqual(result.outcome, CollectionRunnerFixtureWorkerOutcome.TerminalFailed, "terminal");
        assertEqual(context.baseRepository.calls.join(","), "T7,T8,T9", "transactions");
      }),
  ],
  [
    "fixture Worker trips barrier when persistence fails after lease",
    () =>
      withWorker((context) => {
        context.baseRepository.failMethod = "startTaskAttempt";
        expectFoundationError(
          () => context.worker.runOneCycle(cycleInput(context)),
          CollectionRunnerRuntimeFoundationErrorCode.WorkerPersistenceFailed,
        );
        assertEqual(context.stopBarrier.isTripped(), true, "barrier");
      }),
  ],
  [
    "fixture Worker preserves ambiguity when Stop wins after adapter",
    () =>
      withWorker((context) => {
        context.adapter.onCollect = () => {
          context.stopBarrier.trip("OWNER_EMERGENCY_STOP");
        };
        expectFoundationError(
          () => context.worker.runOneCycle(cycleInput(context)),
          CollectionRunnerRuntimeFoundationErrorCode.WorkerPersistenceFailed,
        );
        assertEqual(context.baseRepository.taskState, CollectionRunnerTaskState.InFlight, "ambiguous state");
      }),
  ],
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

console.log(
  `Event Contract Collection Runner Runtime Execution tests passed: ${String(passed)}/${String(tests.length)}.`,
);
