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
} from "../../src/contracts";
import { DatabaseSync } from "node:sqlite";
import { EventContractCollectionRunnerEngine } from "../../src/engines/event-contract-collection-runner/EventContractCollectionRunnerEngine";
import { EventContractSourceEngine } from "../../src/engines/event-contract-source/EventContractSourceEngine";
import type { EventContractCollectionRunnerRepository } from "../../src/repositories/EventContractCollectionRunnerRepository";
import { EventContractCollectionRunnerSqliteStore } from "../../src/repositories/EventContractCollectionRunnerSqliteStore";
import { createSqliteEventContractCollectionRunnerRepository } from "../../src/repositories/SqliteEventContractCollectionRunnerRepository";

export const TRANSACTION_DRILL_BUILD = "fnv1a64:1111111111111111";
export const TRANSACTION_DRILL_APPLIED_AT =
  "2026-07-25T12:00:00.000Z";
const PLAN_FINGERPRINT = "fnv1a64:2222222222222222";

const runnerEngine = new EventContractCollectionRunnerEngine();
const sourceEngine = new EventContractSourceEngine();

export interface CollectionRunnerTransactionDrillFixture {
  readonly store: EventContractCollectionRunnerSqliteStore;
  readonly repository: EventContractCollectionRunnerRepository;
  readonly storePath: string;
  readonly provider: EventContractSourceProvider;
  readonly mapping: EventContractSourceMapping;
  readonly activation: CollectionRunnerPilotActivation;
  readonly task: CollectionRunnerScheduledTask;
}

type TransactionDrillEvidenceContext = Pick<
  CollectionRunnerTransactionDrillFixture,
  "repository" | "provider" | "mapping" | "task"
>;

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

function createProvider(): EventContractSourceProvider {
  return sourceEngine.createProvider({
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    providerId: "provider:transaction-drill:fixture",
    displayName: "Transaction Drill Fixture",
    sourceClass: EventContractSourceClass.Exchange,
    exchangeId: "exchange:transaction-drill",
    capabilities: [EventContractSourceCapability.TopOfBook],
    executionModes: [EventContractSourceExecutionMode.Fixture],
    credentialMode: EventContractSourceCredentialMode.None,
    documentationReferences: ["https://example.test/transaction-drill"],
    active: true,
  });
}

function terms(): EventContractSourceTerms {
  return {
    title: "Will BTC be above the fixture target?",
    termsVersion: "1.0",
    eventType: EventContractObservationEventType.BtcFifteenMinute,
    instrumentId: EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
    outcomePair: EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR,
    windowStartsAt: "2026-07-25T13:00:00.000Z",
    tradingClosesAt: "2026-07-25T13:14:59.000Z",
    evaluatesAt: "2026-07-25T13:15:00.000Z",
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
    mappingId: "mapping:transaction-drill",
    version: "1.0",
    createdAt: "2026-07-25T12:00:00.000Z",
    reviewStatus: EventContractSourceMappingReviewStatus.ReviewedExact,
    reviewedAt: "2026-07-25T12:05:00.000Z",
    reviewerId: "owner:transaction-drill",
    evidenceIds: ["evidence:transaction-drill"],
    provider,
    robinhoodIdentity: {
      exchangeId: "exchange:transaction-drill",
      marketId: "rh-market:transaction-drill",
      contractId: "rh-contract:transaction-drill",
      termsId: "rh-terms:transaction-drill",
    },
    externalIdentity: {
      providerId: provider.providerId,
      exchangeId: "exchange:transaction-drill",
      eventId: "event:transaction-drill",
      marketId: "market:transaction-drill",
      contractId: "contract:transaction-drill",
      nativeTicker: "BTC-TRANSACTION-DRILL",
    },
    robinhoodTerms: terms(),
    externalTerms: terms(),
  });
}

export function createCollectionRunnerTransactionDrillDomain() {
  const provider = createProvider();
  const mapping = createMapping(provider);
  const definition = runnerEngine.createRunnerDefinition({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    runnerDefinitionId: "runner:transaction-drill",
    version: "1.0",
    buildFingerprint: TRANSACTION_DRILL_BUILD,
    supportedCapabilities: [EventContractSourceCapability.TopOfBook],
    maximumActivePilots: 1,
    maximumWorkers: 1,
    maximumInFlightRequests: 1,
    maximumRequestsPerSecond: 1,
    maximumClockOffsetMilliseconds: 1_000,
  });
  const activation = runnerEngine.createPilotActivation({
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    activationId: "activation:transaction-drill",
    ownerId: "owner:transaction-drill",
    approvedAt: "2026-07-25T12:30:00.000Z",
    startsAt: "2026-07-25T13:00:00.000Z",
    stopsAt: "2026-07-25T14:00:00.000Z",
    frozenPlanId: "plan:transaction-drill",
    frozenPlanFingerprint: PLAN_FINGERPRINT,
    runnerDefinition: definition,
    admittedProviderFingerprints: [provider.fingerprint],
    admittedMappingFingerprints: [mapping.fingerprint],
    maximumEvents: 1,
    maximumRequests: 2,
  });
  const task = runnerEngine.createScheduledTask(
    {
      schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
      taskId: "task:transaction-drill",
      observationSlot: "pre-close",
      scheduledAt: "2026-07-25T13:05:00.000Z",
      deadlineAt: "2026-07-25T13:20:00.000Z",
      runnerDefinitionVersion: "1.0",
      admission: {
        frozenPlanId: activation.frozenPlanId,
        frozenPlanFingerprint: activation.frozenPlanFingerprint,
        plannedEventId: "event:transaction-drill",
        evidenceCutoffAt: "2026-07-25T13:15:00.000Z",
        providerId: provider.providerId,
        providerFingerprint: provider.fingerprint,
        capability: EventContractSourceCapability.TopOfBook,
        executionMode: EventContractSourceExecutionMode.Fixture,
        sourceLane: CollectionRunnerSourceLane.Exchange,
        mappingId: mapping.mappingId,
        mappingVersion: mapping.version,
        mappingFingerprint: mapping.fingerprint,
        sourceRecordId: "source-record:transaction-drill",
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
  return { provider, mapping, definition, activation, task };
}

export function createCollectionRunnerTransactionDrillFixture(
  sqliteRoot: string,
): CollectionRunnerTransactionDrillFixture {
  const store = EventContractCollectionRunnerSqliteStore.open({
    rootDirectory: sqliteRoot,
    applicationBuildFingerprint: TRANSACTION_DRILL_BUILD,
    appliedAtUtc: TRANSACTION_DRILL_APPLIED_AT,
  });
  const repository = store.createRunnerRepository();
  const { provider, mapping, definition, activation, task } =
    createCollectionRunnerTransactionDrillDomain();

  repository.registerRunnerDefinition({
    definition,
    evidence: evidence("2026-07-25T12:31:00.000Z", "DEFINITION_REVIEWED"),
  });
  repository.createPilotArtifact({
    activation,
    evidence: evidence("2026-07-25T12:32:00.000Z", "OWNER_APPROVAL_RECORDED"),
  });
  repository.materializeTasks({
    activationId: activation.activationId,
    expectedBudgetVersion: 1,
    tasks: [task],
    evidence: evidence("2026-07-25T12:33:00.000Z", "TASK_SET_FROZEN"),
  });
  repository.transitionPilot({
    activationId: activation.activationId,
    expectedAggregateVersion: 1,
    nextState: CollectionRunnerPilotState.Active,
    clock: clock("2026-07-25T13:00:00.000Z"),
    recoveryBlockerCount: 0,
    evidence: evidence("2026-07-25T13:00:00.000Z", "OWNER_ACTIVATED"),
  });

  return {
    store,
    repository,
    storePath: store.getStorePath(),
    provider,
    mapping,
    activation,
    task,
  };
}

export function transitionTransactionDrillTaskDue(
  fixture: CollectionRunnerTransactionDrillFixture,
): void {
  fixture.repository.transitionTask({
    taskId: fixture.task.taskId,
    expectedAggregateVersion: 1,
    nextState: CollectionRunnerTaskState.Due,
    clock: clock("2026-07-25T13:05:00.000Z"),
    expectedBudgetVersion: 2,
    evidence: evidence("2026-07-25T13:05:00.000Z", "TASK_DUE"),
  });
}

export function acquireTransactionDrillLease(
  fixture: CollectionRunnerTransactionDrillFixture,
): void {
  fixture.repository.acquireTaskLease({
    taskId: fixture.task.taskId,
    expectedTaskVersion: 2,
    expectedBudgetVersion: 2,
    clock: clock("2026-07-25T13:06:00.000Z"),
    lease: {
      leaseToken: "lease:transaction-drill",
      workerId: "worker:transaction-drill",
      processSessionId: "process:transaction-drill",
      bootIdentity: "boot:transaction-drill",
      acquiredAtUtc: "2026-07-25T13:06:00.000Z",
      heartbeatAtUtc: "2026-07-25T13:06:00.000Z",
      expiresAtUtc: "2026-07-25T13:10:00.000Z",
      acquiredMonotonicNanoseconds: 1_000,
      heartbeatMonotonicNanoseconds: 1_000,
      expiresMonotonicNanoseconds: 240_000_001_000,
    },
    evidence: evidence("2026-07-25T13:06:00.000Z", "LEASE_ACQUIRED"),
  });
}

export function startTransactionDrillAttempt(
  fixture: CollectionRunnerTransactionDrillFixture,
): void {
  fixture.repository.startTaskAttempt({
    taskId: fixture.task.taskId,
    expectedTaskVersion: 3,
    expectedBudgetVersion: 2,
    clock: clock("2026-07-25T13:06:00.100Z"),
    claim: {
      attemptId: "attempt:transaction-drill",
      leaseToken: "lease:transaction-drill",
      startedAtUtc: "2026-07-25T13:06:00.100Z",
      adapterVersion: "1.0",
      policyVersion: "1.0",
    },
    evidence: evidence("2026-07-25T13:06:00.100Z", "ATTEMPT_STARTED"),
  });
}

export function markTransactionDrillValidating(
  fixture: CollectionRunnerTransactionDrillFixture,
): void {
  fixture.repository.markTaskValidating({
    taskId: fixture.task.taskId,
    expectedTaskVersion: 4,
    attemptId: "attempt:transaction-drill",
    leaseToken: "lease:transaction-drill",
    clock: clock("2026-07-25T13:06:00.500Z"),
    evidence: evidence("2026-07-25T13:06:00.500Z", "RESPONSE_RECEIVED"),
  });
}

export function createTransactionDrillSnapshot(
  fixture: TransactionDrillEvidenceContext,
): EventContractSourceSnapshot {
  return sourceEngine.createSnapshot({
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    snapshotId: "snapshot:transaction-drill",
    provider: fixture.provider,
    mapping: fixture.mapping,
    capability: EventContractSourceCapability.TopOfBook,
    executionMode: EventContractSourceExecutionMode.Fixture,
    sourceRecordId: fixture.task.admission.sourceRecordId,
    observedAt: "2026-07-25T13:06:00.200Z",
    publishedAt: "2026-07-25T13:06:00.250Z",
    receivedAt: "2026-07-25T13:06:00.300Z",
    normalizedAt: "2026-07-25T13:06:00.400Z",
    payloadFingerprint: "fnv1a64:0123456789abcdef",
    rawPayloadBytes: 2_048,
    recordCount: 1,
  });
}

export function commitTransactionDrillEvidence(
  fixture: TransactionDrillEvidenceContext,
): ReturnType<EventContractCollectionRunnerRepository["commitTaskEvidence"]> {
  const snapshot = createTransactionDrillSnapshot(fixture);
  return fixture.repository.commitTaskEvidence({
    evidenceId: "evidence:transaction-drill",
    taskId: fixture.task.taskId,
    expectedTaskVersion: 5,
    expectedBudgetVersion: 3,
    attemptId: "attempt:transaction-drill",
    leaseToken: "lease:transaction-drill",
    snapshot,
    result: {
      finishedAtUtc: "2026-07-25T13:06:00.500Z",
      receivedAtUtc: snapshot.receivedAt,
      normalizedAtUtc: snapshot.normalizedAt,
      outcomeCode: "NORMALIZED_SUCCESS",
      retryDisposition: "NO_RETRY",
      rawPayloadBytes: snapshot.rawPayloadBytes,
      recordCount: snapshot.recordCount,
      responseFingerprint: snapshot.payloadFingerprint,
      normalizedSnapshotFingerprint: snapshot.fingerprint,
    },
    committedAtUtc: "2026-07-25T13:06:00.600Z",
    evidence: evidence("2026-07-25T13:06:00.600Z", "EVIDENCE_COMMITTED"),
  });
}

export function replayTransactionDrillEvidence(sqliteRoot: string) {
  const store = EventContractCollectionRunnerSqliteStore.open({
    rootDirectory: sqliteRoot,
    applicationBuildFingerprint: TRANSACTION_DRILL_BUILD,
    appliedAtUtc: TRANSACTION_DRILL_APPLIED_AT,
    recoveryInspectedAtUtc: "2026-07-25T13:30:00.000Z",
  });
  const storePath = store.getStorePath();
  store.close();
  const database = new DatabaseSync(storePath);
  try {
    const { provider, mapping, activation, task } =
      createCollectionRunnerTransactionDrillDomain();
    return commitTransactionDrillEvidence({
      repository: createSqliteEventContractCollectionRunnerRepository(database),
      provider,
      mapping,
      task,
    });
  } finally {
    database.close();
  }
}
