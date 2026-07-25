import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
  EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
  CollectionRunnerPilotState,
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
  type CollectionRunnerPilotActivation,
  type CollectionRunnerScheduledTask,
  type EventContractSourceMapping,
  type EventContractSourceProvider,
  type EventContractSourceSnapshot,
  type EventContractSourceTerms,
} from "../contracts";
import { EventContractCollectionRunnerEngine } from "../engines/event-contract-collection-runner/EventContractCollectionRunnerEngine";
import { EventContractSourceEngine } from "../engines/event-contract-source/EventContractSourceEngine";
import {
  CollectionRunnerRepositoryError,
  CollectionRunnerRepositoryErrorCode,
  type EventContractCollectionRunnerRepository,
} from "./EventContractCollectionRunnerRepository";
import { EventContractCollectionRunnerSqliteStore } from "./EventContractCollectionRunnerSqliteStore";

const runnerEngine = new EventContractCollectionRunnerEngine();
const sourceEngine = new EventContractSourceEngine();
const FP_BUILD = "fnv1a64:1111111111111111";
const FP_PLAN = "fnv1a64:2222222222222222";
const APPLIED_AT = "2026-07-24T12:00:00.000Z";

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

function expectRepositoryError(
  run: () => unknown,
  code: CollectionRunnerRepositoryErrorCode,
): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof CollectionRunnerRepositoryError,
      "typed repository error",
    );
    assertEqual(
      (error as CollectionRunnerRepositoryError).code,
      code,
      "repository error code",
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

interface TestContext {
  readonly root: string;
  readonly store: EventContractCollectionRunnerSqliteStore;
  readonly repository: EventContractCollectionRunnerRepository;
  readonly path: string;
  readonly provider: EventContractSourceProvider;
  readonly mapping: EventContractSourceMapping;
  readonly activation: CollectionRunnerPilotActivation;
  readonly task: CollectionRunnerScheduledTask;
}

function withContext(run: (context: TestContext) => void): void {
  const root = mkdtempSync(join(tmpdir(), "alpha-runner-repository-"));
  const store = EventContractCollectionRunnerSqliteStore.open({
    rootDirectory: root,
    applicationBuildFingerprint: FP_BUILD,
    appliedAtUtc: APPLIED_AT,
  });
  try {
    const provider = createProvider();
    const mapping = createMapping(provider);
    const definition = createDefinition();
    const activation = runnerEngine.createPilotActivation({
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
    const task = createTask(activation, provider, mapping);
    run({
      root,
      store,
      repository: store.createRunnerRepository(),
      path: store.getStorePath(),
      provider,
      mapping,
      activation,
      task,
    });
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
}

function createDefinition(
  capabilities: readonly EventContractSourceCapability[] = [
    EventContractSourceCapability.TopOfBook,
  ],
) {
  return runnerEngine.createRunnerDefinition({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    runnerDefinitionId: "event-contract-runner:pilot",
    version: "1.0",
    buildFingerprint: FP_BUILD,
    supportedCapabilities: capabilities,
    maximumActivePilots: 1,
    maximumWorkers: 1,
    maximumInFlightRequests: 1,
    maximumRequestsPerSecond: 1,
    maximumClockOffsetMilliseconds: 1000,
  });
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

function terms(): EventContractSourceTerms {
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

function createTask(
  activation: CollectionRunnerPilotActivation,
  provider: EventContractSourceProvider,
  mapping: EventContractSourceMapping,
  changes: Readonly<Record<string, unknown>> = {},
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
      ...changes,
    },
    activation,
  );
}

function evidence(occurredAtUtc: string, reasonCode: string) {
  return { occurredAtUtc, reasonCode };
}

function clock(observedAtUtc: string) {
  return {
    observedAtUtc,
    absoluteOffsetMilliseconds: 10,
    healthy: true as const,
  };
}

function registerAndCreate(context: TestContext): void {
  context.repository.registerRunnerDefinition({
    definition: context.activation.runnerDefinition,
    evidence: evidence("2026-07-24T12:31:00.000Z", "DEFINITION_REVIEWED"),
  });
  context.repository.createPilotArtifact({
    activation: context.activation,
    evidence: evidence("2026-07-24T12:32:00.000Z", "OWNER_APPROVAL_RECORDED"),
  });
}

function materialize(context: TestContext): void {
  context.repository.materializeTasks({
    activationId: context.activation.activationId,
    expectedBudgetVersion: 1,
    tasks: [context.task],
    evidence: evidence("2026-07-24T12:33:00.000Z", "TASK_SET_FROZEN"),
  });
}

function activate(context: TestContext): void {
  context.repository.transitionPilot({
    activationId: context.activation.activationId,
    expectedAggregateVersion: 1,
    nextState: CollectionRunnerPilotState.Active,
    clock: clock("2026-07-24T13:00:00.000Z"),
    recoveryBlockerCount: 0,
    evidence: evidence("2026-07-24T13:00:00.000Z", "OWNER_ACTIVATED"),
  });
}

function markDue(context: TestContext): void {
  context.repository.transitionTask({
    taskId: context.task.taskId,
    expectedAggregateVersion: 1,
    nextState: CollectionRunnerTaskState.Due,
    clock: clock("2026-07-24T13:05:00.000Z"),
    expectedBudgetVersion: 2,
    evidence: evidence("2026-07-24T13:05:00.000Z", "TASK_DUE"),
  });
}

function acquire(context: TestContext): void {
  context.repository.acquireTaskLease({
    taskId: context.task.taskId,
    expectedTaskVersion: 2,
    expectedBudgetVersion: 2,
    clock: clock("2026-07-24T13:06:00.000Z"),
    lease: {
      leaseToken: "lease:task-1:attempt-1",
      workerId: "worker:local:1",
      processSessionId: "process:session:1",
      bootIdentity: "boot:local:1",
      acquiredAtUtc: "2026-07-24T13:06:00.000Z",
      heartbeatAtUtc: "2026-07-24T13:06:00.000Z",
      expiresAtUtc: "2026-07-24T13:10:00.000Z",
      acquiredMonotonicNanoseconds: 1_000,
      heartbeatMonotonicNanoseconds: 1_000,
      expiresMonotonicNanoseconds: 241_000_000_000,
    },
    evidence: evidence("2026-07-24T13:06:00.000Z", "LEASE_ACQUIRED"),
  });
}

function startAttempt(context: TestContext): void {
  context.repository.startTaskAttempt({
    taskId: context.task.taskId,
    expectedTaskVersion: 3,
    expectedBudgetVersion: 2,
    clock: clock("2026-07-24T13:06:00.100Z"),
    claim: {
      attemptId: "attempt:task-1:1",
      leaseToken: "lease:task-1:attempt-1",
      startedAtUtc: "2026-07-24T13:06:00.100Z",
      adapterVersion: "1.0",
      policyVersion: "1.0",
    },
    evidence: evidence("2026-07-24T13:06:00.100Z", "ATTEMPT_STARTED"),
  });
}

function markValidating(context: TestContext): void {
  context.repository.markTaskValidating({
    taskId: context.task.taskId,
    expectedTaskVersion: 4,
    attemptId: "attempt:task-1:1",
    leaseToken: "lease:task-1:attempt-1",
    clock: clock("2026-07-24T13:06:00.500Z"),
    evidence: evidence("2026-07-24T13:06:00.500Z", "RESPONSE_RECEIVED"),
  });
}

function bootstrapToDue(context: TestContext): void {
  registerAndCreate(context);
  materialize(context);
  activate(context);
  markDue(context);
}

function bootstrapToAttempt(context: TestContext): void {
  bootstrapToDue(context);
  acquire(context);
  startAttempt(context);
}

function createSnapshot(context: TestContext): EventContractSourceSnapshot {
  return sourceEngine.createSnapshot({
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    snapshotId: "snapshot:fixture:btc:001",
    provider: context.provider,
    mapping: context.mapping,
    capability: EventContractSourceCapability.TopOfBook,
    executionMode: EventContractSourceExecutionMode.Fixture,
    sourceRecordId: context.task.admission.sourceRecordId,
    observedAt: "2026-07-24T13:06:00.200Z",
    publishedAt: "2026-07-24T13:06:00.250Z",
    receivedAt: "2026-07-24T13:06:00.300Z",
    normalizedAt: "2026-07-24T13:06:00.400Z",
    payloadFingerprint: "fnv1a64:0123456789abcdef",
    rawPayloadBytes: 2_048,
    recordCount: 1,
  });
}

function successResult(snapshot: EventContractSourceSnapshot) {
  return {
    finishedAtUtc: "2026-07-24T13:06:00.500Z",
    receivedAtUtc: snapshot.receivedAt,
    normalizedAtUtc: snapshot.normalizedAt,
    outcomeCode: "NORMALIZED_SUCCESS",
    retryDisposition: "NO_RETRY",
    rawPayloadBytes: snapshot.rawPayloadBytes,
    recordCount: snapshot.recordCount,
    responseFingerprint: snapshot.payloadFingerprint,
    normalizedSnapshotFingerprint: snapshot.fingerprint,
  };
}

function rawCount(path: string, table: string): number {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    return Number(
      database.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count ?? 0,
    );
  } finally {
    database.close();
  }
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "store creates a named repository without exposing SQL",
    () =>
      withContext(({ repository }) => {
        assertTrue(typeof repository.registerRunnerDefinition === "function", "T2");
        assertTrue(typeof repository.commitTaskEvidence === "function", "T10");
        const keys = Object.getOwnPropertyNames(
          Object.getPrototypeOf(repository) as object,
        );
        assertTrue(!keys.includes("exec") && !keys.includes("prepare"), "no SQL");
      }),
  ],
  [
    "T2 registers and reads an exact definition with outbox evidence",
    () =>
      withContext((context) => {
        const stored = context.repository.registerRunnerDefinition({
          definition: context.activation.runnerDefinition,
          evidence: evidence(
            "2026-07-24T12:31:00.000Z",
            "DEFINITION_REVIEWED",
          ),
        });
        assertEqual(
          stored.fingerprint,
          context.activation.runnerDefinition.fingerprint,
          "definition",
        );
        assertEqual(rawCount(context.path, "runner_definitions"), 1, "definitions");
        assertEqual(rawCount(context.path, "transactional_outbox"), 1, "outbox");
      }),
  ],
  [
    "T2 identical replay is idempotent",
    () =>
      withContext((context) => {
        const transaction = {
          definition: context.activation.runnerDefinition,
          evidence: evidence(
            "2026-07-24T12:31:00.000Z",
            "DEFINITION_REVIEWED",
          ),
        };
        context.repository.registerRunnerDefinition(transaction);
        context.repository.registerRunnerDefinition(transaction);
        assertEqual(rawCount(context.path, "runner_definitions"), 1, "definitions");
        assertEqual(rawCount(context.path, "transactional_outbox"), 1, "outbox");
      }),
  ],
  [
    "T2 conflicting identity fails without an extra row",
    () =>
      withContext((context) => {
        context.repository.registerRunnerDefinition({
          definition: context.activation.runnerDefinition,
          evidence: evidence(
            "2026-07-24T12:31:00.000Z",
            "DEFINITION_REVIEWED",
          ),
        });
        const conflict = createDefinition([
          EventContractSourceCapability.TopOfBook,
          EventContractSourceCapability.Settlement,
        ]);
        expectRepositoryError(
          () =>
            context.repository.registerRunnerDefinition({
              definition: conflict,
              evidence: evidence(
                "2026-07-24T12:31:01.000Z",
                "CONFLICT",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.IdentityConflict,
        );
        assertEqual(rawCount(context.path, "runner_definitions"), 1, "definitions");
      }),
  ],
  [
    "T3 requires the exact registered runner definition",
    () =>
      withContext((context) => {
        expectRepositoryError(
          () =>
            context.repository.createPilotArtifact({
              activation: context.activation,
              evidence: evidence(
                "2026-07-24T12:32:00.000Z",
                "OWNER_APPROVAL_RECORDED",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
        );
        assertEqual(rawCount(context.path, "pilot_activations"), 0, "pilots");
      }),
  ],
  [
    "T3 atomically creates authority sets counters transition and outbox",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        assertEqual(rawCount(context.path, "pilot_activations"), 1, "pilot");
        assertEqual(
          rawCount(context.path, "pilot_activation_providers"),
          1,
          "providers",
        );
        assertEqual(
          rawCount(context.path, "pilot_activation_mappings"),
          1,
          "mappings",
        );
        assertEqual(rawCount(context.path, "activation_budget_counters"), 1, "budget");
        assertEqual(rawCount(context.path, "pilot_transitions"), 1, "transition");
      }),
  ],
  [
    "T3 identical replay remains one artifact",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        context.repository.createPilotArtifact({
          activation: context.activation,
          evidence: evidence(
            "2026-07-24T12:32:00.000Z",
            "OWNER_APPROVAL_RECORDED",
          ),
        });
        assertEqual(rawCount(context.path, "pilot_activations"), 1, "pilot");
        assertEqual(rawCount(context.path, "pilot_transitions"), 1, "transition");
      }),
  ],
  [
    "T4 materializes the complete task set and advances budget CAS",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        materialize(context);
        assertEqual(rawCount(context.path, "scheduled_tasks"), 1, "tasks");
        assertEqual(rawCount(context.path, "task_transitions"), 1, "transitions");
        assertEqual(
          context.repository.getBudgetCounters(context.activation.activationId)
            ?.eventsScheduled,
          1,
          "events scheduled",
        );
        assertEqual(
          context.repository.getBudgetCounters(context.activation.activationId)
            ?.aggregateVersion,
          2,
          "budget version",
        );
      }),
  ],
  [
    "T4 identical complete set replay is idempotent",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        materialize(context);
        materialize(context);
        assertEqual(rawCount(context.path, "scheduled_tasks"), 1, "tasks");
        assertEqual(rawCount(context.path, "task_transitions"), 1, "transitions");
      }),
  ],
  [
    "T4 stale budget rolls back all task inserts",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        expectRepositoryError(
          () =>
            context.repository.materializeTasks({
              activationId: context.activation.activationId,
              expectedBudgetVersion: 2,
              tasks: [context.task],
              evidence: evidence(
                "2026-07-24T12:33:00.000Z",
                "TASK_SET_FROZEN",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.VersionConflict,
        );
        assertEqual(rawCount(context.path, "scheduled_tasks"), 0, "tasks");
        assertEqual(rawCount(context.path, "task_transitions"), 0, "transitions");
      }),
  ],
  [
    "T5 activation rejects incomplete task materialization",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        expectRepositoryError(
          () => activate(context),
          CollectionRunnerRepositoryErrorCode.InvalidState,
        );
        assertEqual(
          context.repository.getPilotState(context.activation.activationId)?.state,
          CollectionRunnerPilotState.OwnerApproved,
          "pilot state",
        );
      }),
  ],
  [
    "T5 activates with CAS and transition evidence",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        materialize(context);
        activate(context);
        const state = context.repository.getPilotState(
          context.activation.activationId,
        );
        assertEqual(state?.state, CollectionRunnerPilotState.Active, "pilot state");
        assertEqual(state?.aggregateVersion, 2, "pilot version");
        assertEqual(rawCount(context.path, "pilot_transitions"), 2, "transitions");
      }),
  ],
  [
    "T5 stale pilot version rolls back",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        materialize(context);
        expectRepositoryError(
          () =>
            context.repository.transitionPilot({
              activationId: context.activation.activationId,
              expectedAggregateVersion: 2,
              nextState: CollectionRunnerPilotState.Active,
              clock: clock("2026-07-24T13:00:00.000Z"),
              recoveryBlockerCount: 0,
              evidence: evidence(
                "2026-07-24T13:00:00.000Z",
                "STALE_ACTIVATION",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.VersionConflict,
        );
        assertEqual(rawCount(context.path, "pilot_transitions"), 1, "transitions");
      }),
  ],
  [
    "T6 marks due only inside the evidence window",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        materialize(context);
        activate(context);
        expectRepositoryError(
          () =>
            context.repository.transitionTask({
              taskId: context.task.taskId,
              expectedAggregateVersion: 1,
              nextState: CollectionRunnerTaskState.Due,
              clock: clock("2026-07-24T13:04:59.999Z"),
              expectedBudgetVersion: 2,
              evidence: evidence(
                "2026-07-24T13:04:59.999Z",
                "TOO_EARLY",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.DeadlineExceeded,
        );
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Scheduled,
          "task unchanged",
        );
        markDue(context);
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Due,
          "task due",
        );
      }),
  ],
  [
    "T6 missed task requires elapsed cutoff and updates counters atomically",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        materialize(context);
        activate(context);
        expectRepositoryError(
          () =>
            context.repository.transitionTask({
              taskId: context.task.taskId,
              expectedAggregateVersion: 1,
              nextState: CollectionRunnerTaskState.Missed,
              clock: clock("2026-07-24T13:14:59.999Z"),
              expectedBudgetVersion: 2,
              evidence: evidence(
                "2026-07-24T13:14:59.999Z",
                "NOT_MISSED_YET",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.InvalidState,
        );
        context.repository.transitionTask({
          taskId: context.task.taskId,
          expectedAggregateVersion: 1,
          nextState: CollectionRunnerTaskState.Missed,
          clock: clock("2026-07-24T13:15:00.001Z"),
          expectedBudgetVersion: 2,
          evidence: evidence(
            "2026-07-24T13:15:00.001Z",
            "CUTOFF_ELAPSED",
          ),
        });
        assertEqual(
          context.repository.getBudgetCounters(context.activation.activationId)
            ?.tasksMissed,
          1,
          "missed counter",
        );
      }),
  ],
  [
    "T7 acquires one durable lease without starting a request",
    () =>
      withContext((context) => {
        bootstrapToDue(context);
        acquire(context);
        assertEqual(rawCount(context.path, "task_leases"), 1, "lease");
        assertEqual(rawCount(context.path, "attempt_records"), 0, "attempts");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Leased,
          "task leased",
        );
      }),
  ],
  [
    "T7 duplicate or stale lease acquisition rolls back",
    () =>
      withContext((context) => {
        bootstrapToDue(context);
        acquire(context);
        expectRepositoryError(
          () => acquire(context),
          CollectionRunnerRepositoryErrorCode.InvalidState,
        );
        assertEqual(rawCount(context.path, "task_leases"), 1, "one lease");
        assertEqual(rawCount(context.path, "task_transitions"), 3, "transitions");
      }),
  ],
  [
    "T8 persists the attempt claim before transport and consumes request budget",
    () =>
      withContext((context) => {
        bootstrapToDue(context);
        acquire(context);
        startAttempt(context);
        assertEqual(rawCount(context.path, "attempt_records"), 1, "attempt claim");
        assertEqual(rawCount(context.path, "attempt_results"), 0, "result");
        assertEqual(
          context.repository.getBudgetCounters(context.activation.activationId)
            ?.requestsStarted,
          1,
          "requests",
        );
      }),
  ],
  [
    "T8 stale budget rolls back attempt and task transition",
    () =>
      withContext((context) => {
        bootstrapToDue(context);
        acquire(context);
        expectRepositoryError(
          () =>
            context.repository.startTaskAttempt({
              taskId: context.task.taskId,
              expectedTaskVersion: 3,
              expectedBudgetVersion: 99,
              clock: clock("2026-07-24T13:06:00.100Z"),
              claim: {
                attemptId: "attempt:task-1:1",
                leaseToken: "lease:task-1:attempt-1",
                startedAtUtc: "2026-07-24T13:06:00.100Z",
                adapterVersion: "1.0",
                policyVersion: "1.0",
              },
              evidence: evidence(
                "2026-07-24T13:06:00.100Z",
                "ATTEMPT_STARTED",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
        );
        assertEqual(rawCount(context.path, "attempt_records"), 0, "attempts");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Leased,
          "task state",
        );
      }),
  ],
  [
    "T8B makes the T10 VALIDATING precondition durably reachable",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        markValidating(context);
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Validating,
          "task validating",
        );
        assertEqual(rawCount(context.path, "attempt_results"), 0, "no result yet");
      }),
  ],
  [
    "T9 atomically stores failure result state counters and lease removal",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        const stored = context.repository.finalizeTaskFailure({
          taskId: context.task.taskId,
          expectedTaskVersion: 4,
          expectedBudgetVersion: 3,
          attemptId: "attempt:task-1:1",
          leaseToken: "lease:task-1:attempt-1",
          nextState: CollectionRunnerTaskState.RetryWait,
          result: {
            finishedAtUtc: "2026-07-24T13:06:00.500Z",
            receivedAtUtc: null,
            normalizedAtUtc: null,
            outcomeCode: "TRANSPORT_TIMEOUT",
            retryDisposition: "BOUNDED_RETRY_ALLOWED",
            rawPayloadBytes: 0,
            recordCount: 0,
            responseFingerprint: null,
            normalizedSnapshotFingerprint: null,
          },
          evidence: evidence(
            "2026-07-24T13:06:00.500Z",
            "RETRYABLE_FAILURE",
          ),
        });
        assertTrue(
          /^fnv1a64:[0-9a-f]{16}$/u.test(stored.resultFingerprint),
          "result fingerprint",
        );
        assertEqual(rawCount(context.path, "attempt_results"), 1, "result");
        assertEqual(rawCount(context.path, "task_leases"), 0, "lease removed");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.RetryWait,
          "retry state",
        );
        assertEqual(
          context.repository.getBudgetCounters(context.activation.activationId)
            ?.retriesStarted,
          1,
          "retry counter",
        );
      }),
  ],
  [
    "T9 invalid result rolls back every mutation",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        expectRepositoryError(
          () =>
            context.repository.finalizeTaskFailure({
              taskId: context.task.taskId,
              expectedTaskVersion: 4,
              expectedBudgetVersion: 3,
              attemptId: "attempt:task-1:1",
              leaseToken: "lease:task-1:attempt-1",
              nextState: CollectionRunnerTaskState.RetryWait,
              result: {
                finishedAtUtc: "2026-07-24T13:06:00.000Z",
                receivedAtUtc: null,
                normalizedAtUtc: null,
                outcomeCode: "TRANSPORT_TIMEOUT",
                retryDisposition: "BOUNDED_RETRY_ALLOWED",
                rawPayloadBytes: 0,
                recordCount: 0,
                responseFingerprint: null,
                normalizedSnapshotFingerprint: null,
              },
              evidence: evidence(
                "2026-07-24T13:06:00.500Z",
                "INVALID_FAILURE",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.InvalidInput,
        );
        assertEqual(rawCount(context.path, "attempt_results"), 0, "result");
        assertEqual(rawCount(context.path, "task_leases"), 1, "lease retained");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.InFlight,
          "task unchanged",
        );
      }),
  ],
  [
    "T10 commits result evidence task counter lease and outbox atomically",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        markValidating(context);
        const snapshot = createSnapshot(context);
        const stored = context.repository.commitTaskEvidence({
          evidenceId: "evidence:task-1:attempt-1",
          taskId: context.task.taskId,
          expectedTaskVersion: 5,
          expectedBudgetVersion: 3,
          attemptId: "attempt:task-1:1",
          leaseToken: "lease:task-1:attempt-1",
          snapshot,
          result: successResult(snapshot),
          committedAtUtc: "2026-07-24T13:06:00.600Z",
          evidence: evidence(
            "2026-07-24T13:06:00.600Z",
            "EVIDENCE_COMMITTED",
          ),
        });
        assertEqual(stored.sourceSnapshotFingerprint, snapshot.fingerprint, "snapshot");
        assertEqual(rawCount(context.path, "attempt_results"), 1, "result");
        assertEqual(rawCount(context.path, "normalized_source_evidence"), 1, "evidence");
        assertEqual(rawCount(context.path, "task_leases"), 0, "lease removed");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Committed,
          "task committed",
        );
        const budget = context.repository.getBudgetCounters(
          context.activation.activationId,
        );
        assertEqual(budget?.evidenceCommitted, 1, "evidence counter");
        assertEqual(budget?.bytesReceived, snapshot.rawPayloadBytes, "bytes");
        assertEqual(budget?.recordsReceived, snapshot.recordCount, "records");
      }),
  ],
  [
    "T10 exact replay is idempotent after lease removal",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        markValidating(context);
        const snapshot = createSnapshot(context);
        const transaction = {
          evidenceId: "evidence:task-1:attempt-1",
          taskId: context.task.taskId,
          expectedTaskVersion: 5,
          expectedBudgetVersion: 3,
          attemptId: "attempt:task-1:1",
          leaseToken: "lease:task-1:attempt-1",
          snapshot,
          result: successResult(snapshot),
          committedAtUtc: "2026-07-24T13:06:00.600Z",
          evidence: evidence(
            "2026-07-24T13:06:00.600Z",
            "EVIDENCE_COMMITTED",
          ),
        };
        const first = context.repository.commitTaskEvidence(transaction);
        const second = context.repository.commitTaskEvidence(transaction);
        assertEqual(first.sourceSnapshotFingerprint, second.sourceSnapshotFingerprint, "replay");
        assertEqual(rawCount(context.path, "normalized_source_evidence"), 1, "evidence");
        assertEqual(rawCount(context.path, "attempt_results"), 1, "result");
      }),
  ],
  [
    "T10 changed replay is an evidence conflict",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        markValidating(context);
        const snapshot = createSnapshot(context);
        const transaction = {
          evidenceId: "evidence:task-1:attempt-1",
          taskId: context.task.taskId,
          expectedTaskVersion: 5,
          expectedBudgetVersion: 3,
          attemptId: "attempt:task-1:1",
          leaseToken: "lease:task-1:attempt-1",
          snapshot,
          result: successResult(snapshot),
          committedAtUtc: "2026-07-24T13:06:00.600Z",
          evidence: evidence(
            "2026-07-24T13:06:00.600Z",
            "EVIDENCE_COMMITTED",
          ),
        };
        context.repository.commitTaskEvidence(transaction);
        expectRepositoryError(
          () =>
            context.repository.commitTaskEvidence({
              ...transaction,
              result: { ...transaction.result, outcomeCode: "ALTERED_SUCCESS" },
            }),
          CollectionRunnerRepositoryErrorCode.EvidenceConflict,
        );
        assertEqual(rawCount(context.path, "normalized_source_evidence"), 1, "evidence");
        assertEqual(rawCount(context.path, "attempt_results"), 1, "result");
      }),
  ],
  [
    "T10 mismatched result binding rolls back the critical transaction",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        markValidating(context);
        const snapshot = createSnapshot(context);
        expectRepositoryError(
          () =>
            context.repository.commitTaskEvidence({
              evidenceId: "evidence:task-1:attempt-1",
              taskId: context.task.taskId,
              expectedTaskVersion: 5,
              expectedBudgetVersion: 3,
              attemptId: "attempt:task-1:1",
              leaseToken: "lease:task-1:attempt-1",
              snapshot,
              result: {
                ...successResult(snapshot),
                rawPayloadBytes: snapshot.rawPayloadBytes + 1,
              },
              committedAtUtc: "2026-07-24T13:06:00.600Z",
              evidence: evidence(
                "2026-07-24T13:06:00.600Z",
                "BAD_BINDING",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
        );
        assertEqual(rawCount(context.path, "attempt_results"), 0, "result");
        assertEqual(rawCount(context.path, "normalized_source_evidence"), 0, "evidence");
        assertEqual(rawCount(context.path, "task_leases"), 1, "lease retained");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Validating,
          "task unchanged",
        );
        assertEqual(
          context.repository.getBudgetCounters(context.activation.activationId)
            ?.evidenceCommitted,
          0,
          "counter unchanged",
        );
      }),
  ],
  [
    "T10 rejects a valid snapshot from the wrong source record",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        markValidating(context);
        const original = createSnapshot(context);
        const wrong = sourceEngine.createSnapshot({
          schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
          snapshotId: "snapshot:fixture:btc:wrong-source",
          provider: context.provider,
          mapping: context.mapping,
          capability: EventContractSourceCapability.TopOfBook,
          executionMode: EventContractSourceExecutionMode.Fixture,
          sourceRecordId: "source-record:fixture:other",
          observedAt: original.observedAt,
          publishedAt: original.publishedAt,
          receivedAt: original.receivedAt,
          normalizedAt: original.normalizedAt,
          payloadFingerprint: original.payloadFingerprint,
          rawPayloadBytes: original.rawPayloadBytes,
          recordCount: original.recordCount,
        });
        expectRepositoryError(
          () =>
            context.repository.commitTaskEvidence({
              evidenceId: "evidence:task-1:attempt-1",
              taskId: context.task.taskId,
              expectedTaskVersion: 5,
              expectedBudgetVersion: 3,
              attemptId: "attempt:task-1:1",
              leaseToken: "lease:task-1:attempt-1",
              snapshot: wrong,
              result: successResult(wrong),
              committedAtUtc: "2026-07-24T13:06:00.600Z",
              evidence: evidence(
                "2026-07-24T13:06:00.600Z",
                "WRONG_SOURCE",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
        );
        assertEqual(rawCount(context.path, "normalized_source_evidence"), 0, "evidence");
      }),
  ],
  [
    "late outbox failure rolls back every T10 write",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        markValidating(context);
        const injector = new DatabaseSync(context.path);
        try {
          injector.exec(`
CREATE TRIGGER injected_outbox_failure
BEFORE INSERT ON transactional_outbox
WHEN NEW.event_type = 'TASK_STATE_CHANGED' AND NEW.aggregate_version = 6
BEGIN
  SELECT RAISE(ABORT, 'injected outbox failure');
END
`);
        } finally {
          injector.close();
        }
        const snapshot = createSnapshot(context);
        expectRepositoryError(
          () =>
            context.repository.commitTaskEvidence({
              evidenceId: "evidence:task-1:attempt-1",
              taskId: context.task.taskId,
              expectedTaskVersion: 5,
              expectedBudgetVersion: 3,
              attemptId: "attempt:task-1:1",
              leaseToken: "lease:task-1:attempt-1",
              snapshot,
              result: successResult(snapshot),
              committedAtUtc: "2026-07-24T13:06:00.600Z",
              evidence: evidence(
                "2026-07-24T13:06:00.600Z",
                "INJECTED_FAILURE",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.TransactionFailed,
        );
        assertEqual(rawCount(context.path, "attempt_results"), 0, "result rollback");
        assertEqual(
          rawCount(context.path, "normalized_source_evidence"),
          0,
          "evidence rollback",
        );
        assertEqual(rawCount(context.path, "task_leases"), 1, "lease rollback");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.Validating,
          "state rollback",
        );
        assertEqual(
          context.repository.getBudgetCounters(context.activation.activationId)
            ?.aggregateVersion,
          3,
          "budget rollback",
        );
      }),
  ],
  [
    "attempt three is impossible after two durable claims",
    () =>
      withContext((context) => {
        bootstrapToAttempt(context);
        context.repository.finalizeTaskFailure({
          taskId: context.task.taskId,
          expectedTaskVersion: 4,
          expectedBudgetVersion: 3,
          attemptId: "attempt:task-1:1",
          leaseToken: "lease:task-1:attempt-1",
          nextState: CollectionRunnerTaskState.RetryWait,
          result: {
            finishedAtUtc: "2026-07-24T13:06:00.500Z",
            receivedAtUtc: null,
            normalizedAtUtc: null,
            outcomeCode: "TRANSPORT_TIMEOUT",
            retryDisposition: "BOUNDED_RETRY_ALLOWED",
            rawPayloadBytes: 0,
            recordCount: 0,
            responseFingerprint: null,
            normalizedSnapshotFingerprint: null,
          },
          evidence: evidence(
            "2026-07-24T13:06:00.500Z",
            "FIRST_RETRY",
          ),
        });
        context.repository.transitionTask({
          taskId: context.task.taskId,
          expectedAggregateVersion: 5,
          nextState: CollectionRunnerTaskState.Due,
          clock: clock("2026-07-24T13:07:00.000Z"),
          expectedBudgetVersion: 4,
          evidence: evidence("2026-07-24T13:07:00.000Z", "RETRY_DUE"),
        });
        context.repository.acquireTaskLease({
          taskId: context.task.taskId,
          expectedTaskVersion: 6,
          expectedBudgetVersion: 4,
          clock: clock("2026-07-24T13:07:00.100Z"),
          lease: {
            leaseToken: "lease:task-1:attempt-2",
            workerId: "worker:local:1",
            processSessionId: "process:session:1",
            bootIdentity: "boot:local:1",
            acquiredAtUtc: "2026-07-24T13:07:00.100Z",
            heartbeatAtUtc: "2026-07-24T13:07:00.100Z",
            expiresAtUtc: "2026-07-24T13:11:00.100Z",
            acquiredMonotonicNanoseconds: 242_000_000_000,
            heartbeatMonotonicNanoseconds: 242_000_000_000,
            expiresMonotonicNanoseconds: 482_000_000_000,
          },
          evidence: evidence(
            "2026-07-24T13:07:00.100Z",
            "SECOND_LEASE",
          ),
        });
        context.repository.startTaskAttempt({
          taskId: context.task.taskId,
          expectedTaskVersion: 7,
          expectedBudgetVersion: 4,
          clock: clock("2026-07-24T13:07:00.200Z"),
          claim: {
            attemptId: "attempt:task-1:2",
            leaseToken: "lease:task-1:attempt-2",
            startedAtUtc: "2026-07-24T13:07:00.200Z",
            adapterVersion: "1.0",
            policyVersion: "1.0",
          },
          evidence: evidence(
            "2026-07-24T13:07:00.200Z",
            "SECOND_ATTEMPT",
          ),
        });
        expectRepositoryError(
          () =>
            context.repository.finalizeTaskFailure({
              taskId: context.task.taskId,
              expectedTaskVersion: 8,
              expectedBudgetVersion: 5,
              attemptId: "attempt:task-1:2",
              leaseToken: "lease:task-1:attempt-2",
              nextState: CollectionRunnerTaskState.RetryWait,
              result: {
                finishedAtUtc: "2026-07-24T13:07:00.500Z",
                receivedAtUtc: null,
                normalizedAtUtc: null,
                outcomeCode: "SECOND_TIMEOUT",
                retryDisposition: "NO_RETRY_BUDGET",
                rawPayloadBytes: 0,
                recordCount: 0,
                responseFingerprint: null,
                normalizedSnapshotFingerprint: null,
              },
              evidence: evidence(
                "2026-07-24T13:07:00.500Z",
                "SECOND_FAILURE",
              ),
            }),
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
        );
        assertEqual(rawCount(context.path, "attempt_results"), 1, "rollback result");
        assertEqual(rawCount(context.path, "task_leases"), 1, "lease retained");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.InFlight,
          "task remains in flight",
        );
        context.repository.finalizeTaskFailure({
          taskId: context.task.taskId,
          expectedTaskVersion: 8,
          expectedBudgetVersion: 5,
          attemptId: "attempt:task-1:2",
          leaseToken: "lease:task-1:attempt-2",
          nextState: CollectionRunnerTaskState.TerminalFailed,
          result: {
            finishedAtUtc: "2026-07-24T13:07:00.500Z",
            receivedAtUtc: null,
            normalizedAtUtc: null,
            outcomeCode: "SECOND_TIMEOUT",
            retryDisposition: "NO_RETRY_BUDGET",
            rawPayloadBytes: 0,
            recordCount: 0,
            responseFingerprint: null,
            normalizedSnapshotFingerprint: null,
          },
          evidence: evidence(
            "2026-07-24T13:07:00.500Z",
            "SECOND_FAILURE",
          ),
        });
        assertEqual(rawCount(context.path, "attempt_records"), 2, "two attempts");
        assertEqual(rawCount(context.path, "attempt_results"), 2, "two results");
        assertEqual(rawCount(context.path, "task_leases"), 0, "lease removed");
        assertEqual(
          context.repository.getTaskState(context.task.taskId)?.state,
          CollectionRunnerTaskState.TerminalFailed,
          "task terminal",
        );
      }),
  ],
  [
    "transaction envelopes reject unknown authority-bearing fields",
    () =>
      withContext((context) => {
        expectRepositoryError(
          () =>
            context.repository.registerRunnerDefinition({
              definition: context.activation.runnerDefinition,
              evidence: evidence(
                "2026-07-24T12:31:00.000Z",
                "DEFINITION_REVIEWED",
              ),
              executeTrade: true,
            } as never),
          CollectionRunnerRepositoryErrorCode.InvalidInput,
        );
        assertEqual(rawCount(context.path, "runner_definitions"), 0, "definitions");
      }),
  ],
  [
    "read results are immutable and expose no raw canonical JSON",
    () =>
      withContext((context) => {
        registerAndCreate(context);
        materialize(context);
        const definition = context.repository.getRunnerDefinition(
          context.activation.runnerDefinition.runnerDefinitionId,
          context.activation.runnerDefinition.version,
        );
        const budget = context.repository.getBudgetCounters(
          context.activation.activationId,
        );
        assertTrue(Object.isFrozen(definition), "definition immutable");
        assertTrue(Object.isFrozen(budget), "budget immutable");
        assertTrue(
          !JSON.stringify(budget).includes("canonical_record_json"),
          "no raw JSON",
        );
      }),
  ],
];

function main(): void {
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
    `SQLite Event Contract Collection Runner Repository tests passed: ${String(passed)}/${String(tests.length)}.`,
  );
}

main();
