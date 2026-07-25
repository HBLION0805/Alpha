import { createHash } from "node:crypto";

import {
  CollectionRunnerFixtureAdapterOutcome,
  CollectionRunnerFixtureWorkerOutcome,
  CollectionRunnerPilotState,
  CollectionRunnerRuntimeFoundationErrorCode,
  CollectionRunnerTaskState,
  EventContractSourceExecutionMode,
  type CollectionRunnerFixtureAdapterResult,
  type CollectionRunnerFixtureWorkerResult,
  type CollectionRunnerMonotonicClock,
  type CollectionRunnerPilotActivation,
  type CollectionRunnerRuntimeConfiguration,
  type CollectionRunnerScheduledTask,
  type CollectionRunnerWallClock,
  type CollectionRunnerClockHealthProbe,
  type EventContractSourceCapability,
  type EventContractSourceSnapshot,
} from "../../contracts";
import type {
  CollectionRunnerAttemptResultInput,
  CollectionRunnerBudgetCounters,
  CollectionRunnerClockEvidence,
} from "../../repositories/EventContractCollectionRunnerRepository";
import {
  CollectionRunnerProcessStopBarrier,
  SessionGatedEventContractCollectionRunnerRepository,
} from "../../repositories/SessionGatedEventContractCollectionRunnerRepository";
import { EventContractSourceEngine } from "../event-contract-source/EventContractSourceEngine";
import { EventContractCollectionRunnerEngine } from "../event-contract-collection-runner/EventContractCollectionRunnerEngine";
import {
  CollectionRunnerRuntimeOwnershipHandle,
  EventContractCollectionRunnerRuntimeFoundationError,
  sampleHealthyCollectionRunnerClocks,
} from "./EventContractCollectionRunnerRuntimeFoundation";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const REASON = /^[A-Z][A-Z0-9_]{0,63}$/u;
const FINGERPRINT = /^fnv1a64:[0-9a-f]{16}$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const ACTIVATION_ARTIFACT_KEYS = [
  "schemaVersion",
  "activationId",
  "ownerId",
  "approvedAt",
  "startsAt",
  "stopsAt",
  "frozenPlanId",
  "frozenPlanFingerprint",
  "runnerDefinition",
  "admittedProviderFingerprints",
  "admittedMappingFingerprints",
  "maximumEvents",
  "maximumRequests",
  "state",
  "aggregateVersion",
  "authorizationStatus",
  "deterministic",
  "fingerprint",
] as const;
const TASK_ARTIFACT_KEYS = [
  "schemaVersion",
  "taskId",
  "observationSlot",
  "scheduledAt",
  "deadlineAt",
  "runnerDefinitionVersion",
  "admission",
  "idempotencyKey",
  "state",
  "aggregateVersion",
  "authorizationStatus",
  "deterministic",
  "fingerprint",
] as const;

export interface CollectionRunnerFixtureCancellationPort {
  isCancellationRequested(): boolean;
}

export interface CollectionRunnerFixtureAdapterRequest {
  readonly task: CollectionRunnerScheduledTask;
  readonly attemptId: string;
  readonly requestedAtUtc: string;
  readonly cancellation: CollectionRunnerFixtureCancellationPort;
}

export interface CollectionRunnerFixtureOnlyAdapter {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly policyVersion: string;
  readonly executionMode: EventContractSourceExecutionMode.Fixture;
  readonly providerFingerprint: string;
  readonly mappingFingerprint: string | null;
  readonly capability: EventContractSourceCapability;
  readonly sourceRecordId: string;
  collect(
    request: Readonly<CollectionRunnerFixtureAdapterRequest>,
  ): CollectionRunnerFixtureAdapterResult;
}

export interface CollectionRunnerFixtureWorkerCycleInput {
  readonly activation: CollectionRunnerPilotActivation;
  readonly task: CollectionRunnerScheduledTask;
  readonly expectedTaskVersion: number;
  readonly expectedBudgetVersion: number;
  readonly completedAttemptCount: number;
  readonly workerId: string;
  readonly leaseDurationMilliseconds: number;
}

function fail(
  code: CollectionRunnerRuntimeFoundationErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new EventContractCollectionRunnerRuntimeFoundationError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function identifier(prefix: string, value: unknown): string {
  return `${prefix}:fnv1a64:${fnv1a64(JSON.stringify(value))}`;
}

function parseUtc(value: unknown, field: string): number {
  if (typeof value !== "string" || !UTC_MILLISECOND.test(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      `${field} must be canonical millisecond UTC.`,
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      `${field} must be a real canonical UTC timestamp.`,
    );
  }
  return parsed;
}

function assertPositiveSafeInteger(value: unknown, field: string): void {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      `${field} must be a positive safe integer.`,
    );
  }
}

function asSafeMonotonic(
  value: bigint,
  origin: bigint,
  field: string,
): number {
  const relative = value - origin;
  if (
    relative < 0n ||
    relative > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      `${field} is outside the process-local safe range.`,
    );
  }
  return Number(relative);
}

function addMilliseconds(utc: string, milliseconds: number): string {
  return new Date(Date.parse(utc) + milliseconds).toISOString();
}

function earliestUtc(values: readonly string[]): string {
  return [...values].sort(
    (left, right) =>
      Date.parse(left) - Date.parse(right) || left.localeCompare(right),
  )[0] as string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertExactObjectKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): void {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      `${label} must be an object.`,
    );
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      `${label} fields do not match the immutable artifact contract.`,
    );
  }
}

function validateAdapterResult(
  value: unknown,
  attemptStartedAtUtc: string,
  gateUtc: string,
): CollectionRunnerFixtureAdapterResult {
  if (!isRecord(value)) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Fixture adapter result must be a record.",
    );
  }
  const finishedAt = parseUtc(value.finishedAtUtc, "adapter.finishedAtUtc");
  if (
    finishedAt < Date.parse(attemptStartedAtUtc) ||
    finishedAt > Date.parse(gateUtc)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Fixture adapter result time is outside the claimed attempt.",
    );
  }
  if (value.outcome === CollectionRunnerFixtureAdapterOutcome.Failure) {
    const keys = Object.keys(value).sort();
    const expected = [
      "finishedAtUtc",
      "outcome",
      "outcomeCode",
      "retryable",
    ].sort();
    if (
      keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      typeof value.outcomeCode !== "string" ||
      !REASON.test(value.outcomeCode) ||
      typeof value.retryable !== "boolean"
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Fixture adapter failure does not match the closed contract.",
      );
    }
    return Object.freeze(structuredClone(value)) as unknown as
      CollectionRunnerFixtureAdapterResult;
  }
  if (value.outcome === CollectionRunnerFixtureAdapterOutcome.Snapshot) {
    const keys = Object.keys(value).sort();
    const expected = ["finishedAtUtc", "outcome", "snapshot"].sort();
    if (
      keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index]) ||
      !isRecord(value.snapshot)
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Fixture adapter snapshot does not match the closed contract.",
      );
    }
    return Object.freeze(structuredClone(value)) as unknown as
      CollectionRunnerFixtureAdapterResult;
  }
  fail(
    CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
    "Fixture adapter outcome is invalid.",
  );
}

function validateSnapshotBinding(
  sourceEngine: EventContractSourceEngine,
  snapshotValue: unknown,
  task: CollectionRunnerScheduledTask,
  adapter: CollectionRunnerFixtureOnlyAdapter,
  currentUtc: string,
): EventContractSourceSnapshot {
  let snapshot: EventContractSourceSnapshot;
  try {
    snapshot = sourceEngine.verifySnapshot(snapshotValue);
  } catch (cause) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Fixture snapshot failed source-contract validation.",
      cause,
    );
  }
  if (
    snapshot.executionMode !== EventContractSourceExecutionMode.Fixture ||
    snapshot.providerFingerprint !== task.admission.providerFingerprint ||
    snapshot.providerFingerprint !== adapter.providerFingerprint ||
    snapshot.mappingFingerprint !== task.admission.mappingFingerprint ||
    snapshot.mappingFingerprint !== adapter.mappingFingerprint ||
    snapshot.capability !== task.admission.capability ||
    snapshot.capability !== adapter.capability ||
    snapshot.sourceRecordId !== task.admission.sourceRecordId ||
    snapshot.sourceRecordId !== adapter.sourceRecordId
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.AdapterBindingMismatch,
      "Fixture snapshot does not match the exact admitted task and adapter.",
    );
  }
  if (
    snapshot.rawPayloadBytes > task.admission.bounds.maximumRawPayloadBytes ||
    snapshot.recordCount > task.admission.bounds.maximumRecordCount
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Fixture snapshot exceeds admitted task bounds.",
    );
  }
  const observed = parseUtc(snapshot.observedAt, "snapshot.observedAt");
  const received = parseUtc(snapshot.receivedAt, "snapshot.receivedAt");
  const normalized = parseUtc(snapshot.normalizedAt, "snapshot.normalizedAt");
  if (
    observed > Date.parse(task.admission.evidenceCutoffAt) ||
    received > Date.parse(task.deadlineAt) ||
    normalized > Date.parse(currentUtc)
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Fixture snapshot chronology exceeds the task evidence boundary.",
    );
  }
  return snapshot;
}

function transactionClock(
  wallUtc: string,
  absoluteOffsetMilliseconds: number,
): CollectionRunnerClockEvidence {
  return Object.freeze({
    observedAtUtc: wallUtc,
    absoluteOffsetMilliseconds,
    healthy: true as const,
  });
}

function assertInput(
  input: CollectionRunnerFixtureWorkerCycleInput,
  configuration: CollectionRunnerRuntimeConfiguration,
): void {
  assertExactObjectKeys(
    input.activation,
    ACTIVATION_ARTIFACT_KEYS,
    "Worker activation",
  );
  assertExactObjectKeys(input.task, TASK_ARTIFACT_KEYS, "Worker task");
  const runnerEngine = new EventContractCollectionRunnerEngine();
  let verifiedActivation: CollectionRunnerPilotActivation;
  let verifiedTask: CollectionRunnerScheduledTask;
  try {
    verifiedActivation = runnerEngine.createPilotActivation({
      schemaVersion: input.activation.schemaVersion,
      activationId: input.activation.activationId,
      ownerId: input.activation.ownerId,
      approvedAt: input.activation.approvedAt,
      startsAt: input.activation.startsAt,
      stopsAt: input.activation.stopsAt,
      frozenPlanId: input.activation.frozenPlanId,
      frozenPlanFingerprint: input.activation.frozenPlanFingerprint,
      runnerDefinition: input.activation.runnerDefinition,
      admittedProviderFingerprints:
        input.activation.admittedProviderFingerprints,
      admittedMappingFingerprints:
        input.activation.admittedMappingFingerprints,
      maximumEvents: input.activation.maximumEvents,
      maximumRequests: input.activation.maximumRequests,
    });
    verifiedTask = runnerEngine.createScheduledTask(
      {
        schemaVersion: input.task.schemaVersion,
        taskId: input.task.taskId,
        observationSlot: input.task.observationSlot,
        scheduledAt: input.task.scheduledAt,
        deadlineAt: input.task.deadlineAt,
        runnerDefinitionVersion: input.task.runnerDefinitionVersion,
        admission: input.task.admission,
      },
      verifiedActivation,
    );
  } catch (cause) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Worker activation or task artifact failed deterministic verification.",
      cause,
    );
  }
  if (
    verifiedActivation.fingerprint !== input.activation.fingerprint ||
    verifiedTask.fingerprint !== input.task.fingerprint ||
    verifiedTask.idempotencyKey !== input.task.idempotencyKey
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Worker activation or task artifact fingerprint is invalid.",
    );
  }
  if (
    !IDENTIFIER.test(input.workerId) ||
    !Number.isSafeInteger(input.completedAttemptCount) ||
    input.completedAttemptCount < 0 ||
    input.completedAttemptCount >= input.task.admission.bounds.maximumAttempts
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Worker identity or attempt count is invalid.",
    );
  }
  assertPositiveSafeInteger(
    input.expectedTaskVersion,
    "expectedTaskVersion",
  );
  assertPositiveSafeInteger(
    input.expectedBudgetVersion,
    "expectedBudgetVersion",
  );
  assertPositiveSafeInteger(
    input.leaseDurationMilliseconds,
    "leaseDurationMilliseconds",
  );
  if (
    input.leaseDurationMilliseconds >
    input.task.admission.bounds.requestDeadlineMilliseconds
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Lease duration exceeds the admitted request deadline.",
    );
  }
  if (
    input.activation.activationId !== configuration.activationId ||
    input.task.admission.activationId !== configuration.activationId ||
    input.activation.runnerDefinition.buildFingerprint !==
      configuration.applicationBuildFingerprint ||
    input.activation.runnerDefinition.fingerprint !==
      configuration.runnerDefinitionFingerprint ||
    input.activation.frozenPlanFingerprint !==
      configuration.frozenPlanFingerprint ||
    input.task.admission.frozenPlanFingerprint !==
      configuration.frozenPlanFingerprint ||
    !input.activation.admittedProviderFingerprints.includes(
      configuration.fixtureProviderFingerprint,
    ) ||
    input.task.admission.providerFingerprint !==
      configuration.fixtureProviderFingerprint ||
    input.task.admission.executionMode !==
      EventContractSourceExecutionMode.Fixture ||
    configuration.maximumWorkers !== 1 ||
    configuration.continuousRunPermitted ||
    configuration.networkPermitted
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
      "Worker activation and task do not match immutable fixture configuration.",
    );
  }
}

function validateAdapterBinding(
  adapter: CollectionRunnerFixtureOnlyAdapter,
  task: CollectionRunnerScheduledTask,
): void {
  if (
    !IDENTIFIER.test(adapter.adapterId) ||
    !VERSION.test(adapter.adapterVersion) ||
    !VERSION.test(adapter.policyVersion) ||
    adapter.executionMode !== EventContractSourceExecutionMode.Fixture ||
    !FINGERPRINT.test(adapter.providerFingerprint) ||
    adapter.providerFingerprint !== task.admission.providerFingerprint ||
    adapter.mappingFingerprint !== task.admission.mappingFingerprint ||
    adapter.capability !== task.admission.capability ||
    adapter.sourceRecordId !== task.admission.sourceRecordId ||
    adapter.policyVersion !== task.admission.requestPolicyVersion
  ) {
    fail(
      CollectionRunnerRuntimeFoundationErrorCode.AdapterBindingMismatch,
      "Fixture adapter does not match the exact admitted task.",
    );
  }
}

export class EventContractCollectionRunnerFixtureWorker {
  readonly #monotonicOrigin: bigint;
  readonly #sourceEngine = new EventContractSourceEngine();

  public constructor(
    private readonly repository:
      SessionGatedEventContractCollectionRunnerRepository,
    private readonly ownership: CollectionRunnerRuntimeOwnershipHandle,
    private readonly stopBarrier: CollectionRunnerProcessStopBarrier,
    private readonly configuration: CollectionRunnerRuntimeConfiguration,
    private readonly wallClock: CollectionRunnerWallClock,
    private readonly monotonicClock: CollectionRunnerMonotonicClock,
    private readonly clockHealthProbe: CollectionRunnerClockHealthProbe,
    private readonly adapter: CollectionRunnerFixtureOnlyAdapter,
    private readonly cancellation: CollectionRunnerFixtureCancellationPort,
  ) {
    this.#monotonicOrigin = monotonicClock.nowNanoseconds();
    if (this.#monotonicOrigin < 0n) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Worker monotonic origin is invalid.",
      );
    }
  }

  public runOneCycle(
    input: CollectionRunnerFixtureWorkerCycleInput,
  ): CollectionRunnerFixtureWorkerResult {
    assertInput(input, this.configuration);
    validateAdapterBinding(this.adapter, input.task);
    if (this.stopBarrier.isTripped() || this.cancellation.isCancellationRequested()) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Worker cycle cannot begin after Stop or cancellation.",
      );
    }
    this.ownership.verify();
    const pilot = this.repository.getPilotState(input.activation.activationId);
    const task = this.repository.getTaskState(input.task.taskId);
    const budget = this.repository.getBudgetCounters(input.activation.activationId);
    if (
      pilot?.state !== CollectionRunnerPilotState.Active ||
      task?.state !== CollectionRunnerTaskState.Due ||
      task.aggregateVersion !== input.expectedTaskVersion ||
      budget === null ||
      budget.aggregateVersion !== input.expectedBudgetVersion
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Worker cycle requires exact ACTIVE Pilot, DUE task, and budget versions.",
      );
    }
    this.#assertBudgetAvailable(input, budget);

    const leaseGate = this.#sampleGate();
    this.#assertWithinTaskWindow(input.task, leaseGate.wallClockUtc);
    const leaseToken = identifier("lease", {
      processSessionId: this.ownership.ownership.processSessionId,
      taskId: input.task.taskId,
      taskVersion: input.expectedTaskVersion,
      attemptNumber: input.completedAttemptCount + 1,
    });
    const attemptId = identifier("attempt", {
      leaseToken,
      taskId: input.task.taskId,
      attemptNumber: input.completedAttemptCount + 1,
    });
    const evidenceId = identifier("evidence", {
      attemptId,
      taskId: input.task.taskId,
    });
    const leaseExpiresAtUtc = earliestUtc([
      addMilliseconds(
        leaseGate.wallClockUtc,
        input.leaseDurationMilliseconds,
      ),
      input.task.admission.evidenceCutoffAt,
      input.task.deadlineAt,
      input.activation.stopsAt,
    ]);
    const leaseStartMonotonic = asSafeMonotonic(
      leaseGate.monotonicNanoseconds,
      this.#monotonicOrigin,
      "lease monotonic time",
    );
    const leaseExpiryMonotonic =
      leaseStartMonotonic + input.leaseDurationMilliseconds * 1_000_000;
    if (
      !Number.isSafeInteger(leaseExpiryMonotonic) ||
      Date.parse(leaseExpiresAtUtc) <= Date.parse(leaseGate.wallClockUtc)
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Lease expiry is outside safe task bounds.",
      );
    }

    let leaseAcquired = false;
    let attemptClaimed = false;
    let finalized = false;
    try {
      this.ownership.verify();
      this.repository.acquireTaskLease({
        taskId: input.task.taskId,
        expectedTaskVersion: input.expectedTaskVersion,
        expectedBudgetVersion: input.expectedBudgetVersion,
        clock: transactionClock(
          leaseGate.wallClockUtc,
          leaseGate.health.estimatedAbsoluteUtcOffsetMilliseconds as number,
        ),
        lease: {
          leaseToken,
          workerId: input.workerId,
          processSessionId: this.ownership.ownership.processSessionId,
          bootIdentity: this.ownership.ownership.bootIdentity,
          acquiredAtUtc: leaseGate.wallClockUtc,
          heartbeatAtUtc: leaseGate.wallClockUtc,
          expiresAtUtc: leaseExpiresAtUtc,
          acquiredMonotonicNanoseconds: leaseStartMonotonic,
          heartbeatMonotonicNanoseconds: leaseStartMonotonic,
          expiresMonotonicNanoseconds: leaseExpiryMonotonic,
        },
        evidence: {
          occurredAtUtc: leaseGate.wallClockUtc,
          reasonCode: "FIXTURE_LEASE_ACQUIRED",
        },
      });
      leaseAcquired = true;

      const attemptGate = this.#sampleGate();
      this.#assertWithinTaskWindow(input.task, attemptGate.wallClockUtc);
      this.ownership.verify();
      if (this.stopBarrier.isTripped() || this.cancellation.isCancellationRequested()) {
        fail(
          CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
          "Stop or cancellation won before attempt claim.",
        );
      }
      this.repository.startTaskAttempt({
        taskId: input.task.taskId,
        expectedTaskVersion: input.expectedTaskVersion + 1,
        expectedBudgetVersion: input.expectedBudgetVersion,
        clock: transactionClock(
          attemptGate.wallClockUtc,
          attemptGate.health.estimatedAbsoluteUtcOffsetMilliseconds as number,
        ),
        claim: {
          attemptId,
          leaseToken,
          startedAtUtc: attemptGate.wallClockUtc,
          adapterVersion: this.adapter.adapterVersion,
          policyVersion: this.adapter.policyVersion,
        },
        evidence: {
          occurredAtUtc: attemptGate.wallClockUtc,
          reasonCode: "FIXTURE_ATTEMPT_STARTED",
        },
      });
      attemptClaimed = true;

      let adapterResult: CollectionRunnerFixtureAdapterResult;
      try {
        adapterResult = this.adapter.collect(
          Object.freeze({
            task: input.task,
            attemptId,
            requestedAtUtc: attemptGate.wallClockUtc,
            cancellation: this.cancellation,
          }),
        );
      } catch {
        const exceptionGate = this.#sampleGate();
        adapterResult = Object.freeze({
          outcome: CollectionRunnerFixtureAdapterOutcome.Failure,
          outcomeCode: "FIXTURE_ADAPTER_EXCEPTION",
          retryable: false,
          finishedAtUtc: exceptionGate.wallClockUtc,
        });
      }

      const resultGate = this.#sampleGate();
      const result = validateAdapterResult(
        adapterResult,
        attemptGate.wallClockUtc,
        resultGate.wallClockUtc,
      );
      if (this.cancellation.isCancellationRequested()) {
        const stored = this.#finalizeFailure(
          input,
          attemptId,
          leaseToken,
          resultGate.wallClockUtc,
          resultGate.wallClockUtc,
          "CANCELLED_BY_PROCESS",
          false,
          CollectionRunnerTaskState.Cancelled,
        );
        finalized = true;
        void stored;
        return Object.freeze({
          outcome: CollectionRunnerFixtureWorkerOutcome.Cancelled,
          taskId: input.task.taskId,
          attemptId,
          evidenceId: null,
          reasonCode: "CANCELLED_BY_PROCESS",
          deterministic: true,
        });
      }
      if (result.outcome === CollectionRunnerFixtureAdapterOutcome.Failure) {
        const retryAllowed =
          result.retryable &&
          input.completedAttemptCount + 1 <
            input.task.admission.bounds.maximumAttempts &&
          Date.parse(result.finishedAtUtc) <
            Date.parse(input.task.admission.evidenceCutoffAt);
        this.#finalizeFailure(
          input,
          attemptId,
          leaseToken,
          result.finishedAtUtc,
          resultGate.wallClockUtc,
          result.outcomeCode,
          retryAllowed,
          retryAllowed
            ? CollectionRunnerTaskState.RetryWait
            : CollectionRunnerTaskState.TerminalFailed,
        );
        finalized = true;
        return Object.freeze({
          outcome: retryAllowed
            ? CollectionRunnerFixtureWorkerOutcome.RetryWait
            : CollectionRunnerFixtureWorkerOutcome.TerminalFailed,
          taskId: input.task.taskId,
          attemptId,
          evidenceId: null,
          reasonCode: result.outcomeCode,
          deterministic: true,
        });
      }

      this.ownership.verify();
      this.repository.markTaskValidating({
        taskId: input.task.taskId,
        expectedTaskVersion: input.expectedTaskVersion + 2,
        attemptId,
        leaseToken,
        clock: transactionClock(
          resultGate.wallClockUtc,
          resultGate.health.estimatedAbsoluteUtcOffsetMilliseconds as number,
        ),
        evidence: {
          occurredAtUtc: resultGate.wallClockUtc,
          reasonCode: "FIXTURE_RESPONSE_RECEIVED",
        },
      });
      let snapshot: EventContractSourceSnapshot;
      try {
        snapshot = validateSnapshotBinding(
          this.#sourceEngine,
          result.snapshot,
          input.task,
          this.adapter,
          resultGate.wallClockUtc,
        );
      } catch (cause) {
        if (
          cause instanceof EventContractCollectionRunnerRuntimeFoundationError
        ) {
          this.#finalizeFailure(
            input,
            attemptId,
            leaseToken,
            result.finishedAtUtc,
            resultGate.wallClockUtc,
            "FIXTURE_SNAPSHOT_INVALID",
            false,
            CollectionRunnerTaskState.TerminalFailed,
            3,
          );
          finalized = true;
          return Object.freeze({
            outcome: CollectionRunnerFixtureWorkerOutcome.TerminalFailed,
            taskId: input.task.taskId,
            attemptId,
            evidenceId: null,
            reasonCode: "FIXTURE_SNAPSHOT_INVALID",
            deterministic: true,
          });
        }
        throw cause;
      }

      const commitGate = this.#sampleGate();
      this.#assertWithinTaskWindow(input.task, commitGate.wallClockUtc);
      this.ownership.verify();
      if (this.stopBarrier.isTripped() || this.cancellation.isCancellationRequested()) {
        fail(
          CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
          "Stop or cancellation won before evidence commit.",
        );
      }
      this.repository.commitTaskEvidence({
        evidenceId,
        taskId: input.task.taskId,
        expectedTaskVersion: input.expectedTaskVersion + 3,
        expectedBudgetVersion: input.expectedBudgetVersion + 1,
        attemptId,
        leaseToken,
        snapshot,
        result: {
          finishedAtUtc: result.finishedAtUtc,
          receivedAtUtc: snapshot.receivedAt,
          normalizedAtUtc: snapshot.normalizedAt,
          outcomeCode: "NORMALIZED_SUCCESS",
          retryDisposition: "NO_RETRY",
          rawPayloadBytes: snapshot.rawPayloadBytes,
          recordCount: snapshot.recordCount,
          responseFingerprint: snapshot.payloadFingerprint,
          normalizedSnapshotFingerprint: snapshot.fingerprint,
        },
        committedAtUtc: commitGate.wallClockUtc,
        evidence: {
          occurredAtUtc: commitGate.wallClockUtc,
          reasonCode: "FIXTURE_EVIDENCE_COMMITTED",
        },
      });
      finalized = true;
      return Object.freeze({
        outcome: CollectionRunnerFixtureWorkerOutcome.EvidenceCommitted,
        taskId: input.task.taskId,
        attemptId,
        evidenceId,
        reasonCode: "FIXTURE_EVIDENCE_COMMITTED",
        deterministic: true,
      });
    } catch (cause) {
      if (leaseAcquired && !finalized) {
        this.stopBarrier.trip("WORKER_ATTEMPT_AMBIGUITY");
      }
      if (cause instanceof EventContractCollectionRunnerRuntimeFoundationError) {
        throw cause;
      }
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.WorkerPersistenceFailed,
        "Fixture Worker persistence failed; attempt ambiguity is preserved.",
        cause,
      );
    }
  }

  #sampleGate() {
    return sampleHealthyCollectionRunnerClocks(
      this.configuration,
      this.wallClock,
      this.monotonicClock,
      this.clockHealthProbe,
    );
  }

  #assertBudgetAvailable(
    input: CollectionRunnerFixtureWorkerCycleInput,
    budget: CollectionRunnerBudgetCounters,
  ): void {
    if (
      budget.activationId !== input.activation.activationId ||
      budget.requestsStarted >= input.activation.maximumRequests ||
      budget.evidenceCommitted >= input.activation.maximumEvents
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Fixture Worker budget is exhausted or mismatched.",
      );
    }
  }

  #assertWithinTaskWindow(
    task: CollectionRunnerScheduledTask,
    nowUtc: string,
  ): void {
    const now = parseUtc(nowUtc, "worker clock");
    if (
      now < Date.parse(task.scheduledAt) ||
      now >= Date.parse(task.admission.evidenceCutoffAt) ||
      now >= Date.parse(task.deadlineAt) ||
      now >= Date.parse(task.admission.activationExpiresAt)
    ) {
      fail(
        CollectionRunnerRuntimeFoundationErrorCode.InvalidWorkerInput,
        "Fixture Worker is outside the exact task evidence window.",
      );
    }
  }

  #finalizeFailure(
    input: CollectionRunnerFixtureWorkerCycleInput,
    attemptId: string,
    leaseToken: string,
    finishedAtUtc: string,
    recordedAtUtc: string,
    outcomeCode: string,
    retryAllowed: boolean,
    nextState:
      | CollectionRunnerTaskState.RetryWait
      | CollectionRunnerTaskState.TerminalFailed
      | CollectionRunnerTaskState.Cancelled,
    taskVersionDelta = 2,
  ) {
    this.ownership.verify();
    const result: CollectionRunnerAttemptResultInput = {
      finishedAtUtc,
      receivedAtUtc: null,
      normalizedAtUtc: null,
      outcomeCode,
      retryDisposition: retryAllowed
        ? "BOUNDED_RETRY_ALLOWED"
        : "NO_RETRY",
      rawPayloadBytes: 0,
      recordCount: 0,
      responseFingerprint: null,
      normalizedSnapshotFingerprint: null,
    };
    return this.repository.finalizeTaskFailure({
      taskId: input.task.taskId,
      expectedTaskVersion: input.expectedTaskVersion + taskVersionDelta,
      expectedBudgetVersion: input.expectedBudgetVersion + 1,
      attemptId,
      leaseToken,
      nextState,
      result,
      evidence: {
        occurredAtUtc: recordedAtUtc,
        reasonCode: retryAllowed
          ? "FIXTURE_RETRYABLE_FAILURE"
          : nextState === CollectionRunnerTaskState.Cancelled
            ? "FIXTURE_CANCELLED"
            : "FIXTURE_TERMINAL_FAILURE",
      },
    });
  }
}
