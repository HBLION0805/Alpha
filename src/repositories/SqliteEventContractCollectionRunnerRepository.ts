import type { DatabaseSync } from "node:sqlite";

import {
  CollectionRunnerPilotState,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  type CollectionRunnerDefinition,
  type CollectionRunnerPilotActivation,
  type CollectionRunnerScheduledTask,
} from "../contracts/EventContractCollectionRunner";
import type { EventContractSourceSnapshot } from "../contracts/EventContractSource";
import { EventContractCollectionRunnerEngine } from "../engines/event-contract-collection-runner/EventContractCollectionRunnerEngine";
import {
  DEFAULT_EVENT_CONTRACT_SOURCE_POLICY,
  EventContractSourceEngine,
  INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY,
} from "../engines/event-contract-source/EventContractSourceEngine";
import { EventContractSourceExecutionMode } from "../contracts/EventContractSource";
import {
  CollectionRunnerRepositoryError,
  CollectionRunnerRepositoryErrorCode,
  type AcquireTaskLeaseTransaction,
  type CollectionRunnerAttemptResultInput,
  type CollectionRunnerBudgetCounters,
  type CollectionRunnerClockEvidence,
  type CollectionRunnerLeaseInput,
  type CollectionRunnerStoredAttemptResult,
  type CollectionRunnerStoredEvidence,
  type CollectionRunnerTransactionEvidence,
  type CommitTaskEvidenceTransaction,
  type CreatePilotArtifactTransaction,
  type EventContractCollectionRunnerRepository,
  type FinalizeTaskFailureTransaction,
  type MaterializeTasksTransaction,
  type MarkTaskValidatingTransaction,
  type RegisterRunnerDefinitionTransaction,
  type StartTaskAttemptTransaction,
  type TransitionPilotTransaction,
  type TransitionTaskTransaction,
} from "./EventContractCollectionRunnerRepository";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const UTC_MILLISECOND =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

type Row = Readonly<Record<string, unknown>>;

interface TaskRow extends Row {
  readonly task_id: string;
  readonly task_fingerprint: string;
  readonly idempotency_key: string;
  readonly activation_id: string;
  readonly frozen_plan_id: string;
  readonly frozen_plan_fingerprint: string;
  readonly planned_event_id: string;
  readonly observation_slot: string;
  readonly source_lane: string;
  readonly provider_id: string;
  readonly provider_fingerprint: string;
  readonly mapping_id: string | null;
  readonly mapping_version: string | null;
  readonly mapping_fingerprint: string | null;
  readonly capability: string;
  readonly execution_mode: string;
  readonly source_record_id: string;
  readonly request_policy_id: string;
  readonly request_policy_version: string;
  readonly scheduled_at_utc: string;
  readonly evidence_cutoff_at_utc: string;
  readonly deadline_at_utc: string;
  readonly activation_expires_at_utc: string;
  readonly maximum_attempts: number;
  readonly maximum_raw_payload_bytes: number;
  readonly maximum_record_count: number;
  readonly request_deadline_milliseconds: number;
  readonly current_state: CollectionRunnerTaskState;
  readonly aggregate_version: number;
  readonly canonical_record_json: string;
}

interface PilotRow extends Row {
  readonly activation_id: string;
  readonly activation_fingerprint: string;
  readonly current_state: CollectionRunnerPilotState;
  readonly aggregate_version: number;
  readonly starts_at_utc: string;
  readonly stops_at_utc: string;
  readonly frozen_plan_id: string;
  readonly frozen_plan_fingerprint: string;
  readonly runner_definition_id: string;
  readonly runner_definition_version: string;
  readonly maximum_events: number;
  readonly maximum_requests: number;
  readonly canonical_record_json: string;
}

interface LeaseRow extends Row {
  readonly task_id: string;
  readonly lease_token: string;
  readonly worker_id: string;
  readonly process_session_id: string;
  readonly boot_identity: string;
  readonly acquired_at_utc: string;
  readonly heartbeat_at_utc: string;
  readonly expires_at_utc: string;
  readonly acquired_monotonic_nanoseconds: number;
  readonly heartbeat_monotonic_nanoseconds: number;
  readonly expires_monotonic_nanoseconds: number;
  readonly aggregate_version: number;
}

interface AttemptRow extends Row {
  readonly attempt_id: string;
  readonly task_id: string;
  readonly attempt_number: number;
  readonly lease_token: string;
  readonly scheduled_at_utc: string;
  readonly started_at_utc: string;
  readonly request_count: number;
  readonly adapter_version: string;
  readonly policy_version: string;
  readonly attempt_fingerprint: string;
  readonly created_at_utc: string;
}

const REGISTER_KEYS = ["definition", "evidence"] as const;
const PILOT_KEYS = ["activation", "evidence"] as const;
const MATERIALIZE_KEYS = [
  "activationId",
  "expectedBudgetVersion",
  "tasks",
  "evidence",
] as const;
const PILOT_TRANSITION_KEYS = [
  "activationId",
  "expectedAggregateVersion",
  "nextState",
  "clock",
  "recoveryBlockerCount",
  "evidence",
] as const;
const TASK_TRANSITION_KEYS = [
  "taskId",
  "expectedAggregateVersion",
  "nextState",
  "clock",
  "expectedBudgetVersion",
  "evidence",
] as const;
const ACQUIRE_KEYS = [
  "taskId",
  "expectedTaskVersion",
  "expectedBudgetVersion",
  "clock",
  "lease",
  "evidence",
] as const;
const START_KEYS = [
  "taskId",
  "expectedTaskVersion",
  "expectedBudgetVersion",
  "clock",
  "claim",
  "evidence",
] as const;
const VALIDATING_KEYS = [
  "taskId",
  "expectedTaskVersion",
  "attemptId",
  "leaseToken",
  "clock",
  "evidence",
] as const;
const FINALIZE_KEYS = [
  "taskId",
  "expectedTaskVersion",
  "expectedBudgetVersion",
  "attemptId",
  "leaseToken",
  "nextState",
  "result",
  "evidence",
] as const;
const COMMIT_KEYS = [
  "evidenceId",
  "taskId",
  "expectedTaskVersion",
  "expectedBudgetVersion",
  "attemptId",
  "leaseToken",
  "snapshot",
  "result",
  "committedAtUtc",
  "evidence",
] as const;
const EVIDENCE_KEYS = ["occurredAtUtc", "reasonCode"] as const;
const CLOCK_KEYS = [
  "observedAtUtc",
  "absoluteOffsetMilliseconds",
  "healthy",
] as const;
const LEASE_KEYS = [
  "leaseToken",
  "workerId",
  "processSessionId",
  "bootIdentity",
  "acquiredAtUtc",
  "heartbeatAtUtc",
  "expiresAtUtc",
  "acquiredMonotonicNanoseconds",
  "heartbeatMonotonicNanoseconds",
  "expiresMonotonicNanoseconds",
] as const;
const CLAIM_KEYS = [
  "attemptId",
  "leaseToken",
  "startedAtUtc",
  "adapterVersion",
  "policyVersion",
] as const;
const RESULT_KEYS = [
  "finishedAtUtc",
  "receivedAtUtc",
  "normalizedAtUtc",
  "outcomeCode",
  "retryDisposition",
  "rawPayloadBytes",
  "recordCount",
  "responseFingerprint",
  "normalizedSnapshotFingerprint",
] as const;

function repositoryError(
  code: CollectionRunnerRepositoryErrorCode,
  message: string,
  cause?: unknown,
): CollectionRunnerRepositoryError {
  return new CollectionRunnerRepositoryError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} must be a record.`,
    );
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} fields do not match the transaction contract.`,
    );
  }
}

function assertIdentifier(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} is invalid.`,
    );
  }
}

function assertVersion(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !VERSION.test(value)) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} is invalid.`,
    );
  }
}

function assertFingerprint(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} is invalid.`,
    );
  }
}

function parseUtc(value: unknown, label: string): number {
  if (typeof value !== "string" || !UTC_MILLISECOND.test(value)) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} must be canonical UTC.`,
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} must be a real canonical UTC time.`,
    );
  }
  return parsed;
}

function assertPositiveInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} must be a positive safe integer.`,
    );
  }
}

function assertNonnegativeInteger(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      `${label} must be a non-negative safe integer.`,
    );
  }
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function fingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalize(value))}`;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value as Record<string, unknown>)) {
      freeze(entry);
    }
  }
  return value;
}

function parseCanonicalJson<T>(value: unknown, label: string): T {
  if (typeof value !== "string") {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.IdentityConflict,
      `${label} canonical record is unavailable.`,
    );
  }
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.IdentityConflict,
      `${label} canonical record is invalid.`,
      error,
    );
  }
}

function validateEvidence(value: unknown): CollectionRunnerTransactionEvidence {
  exactKeys(value, EVIDENCE_KEYS, "transaction evidence");
  parseUtc(value.occurredAtUtc, "evidence.occurredAtUtc");
  assertIdentifier(value.reasonCode, "evidence.reasonCode");
  return value as unknown as CollectionRunnerTransactionEvidence;
}

function validateClock(value: unknown): CollectionRunnerClockEvidence {
  exactKeys(value, CLOCK_KEYS, "clock evidence");
  parseUtc(value.observedAtUtc, "clock.observedAtUtc");
  assertNonnegativeInteger(
    value.absoluteOffsetMilliseconds,
    "clock.absoluteOffsetMilliseconds",
  );
  if (value.healthy !== true || value.absoluteOffsetMilliseconds > 1_000) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      "Clock evidence is unhealthy or exceeds the runner ceiling.",
    );
  }
  return value as unknown as CollectionRunnerClockEvidence;
}

function validateLease(value: unknown): CollectionRunnerLeaseInput {
  exactKeys(value, LEASE_KEYS, "lease");
  assertIdentifier(value.leaseToken, "lease.leaseToken");
  assertIdentifier(value.workerId, "lease.workerId");
  assertIdentifier(value.processSessionId, "lease.processSessionId");
  assertIdentifier(value.bootIdentity, "lease.bootIdentity");
  const acquired = parseUtc(value.acquiredAtUtc, "lease.acquiredAtUtc");
  const heartbeat = parseUtc(value.heartbeatAtUtc, "lease.heartbeatAtUtc");
  const expires = parseUtc(value.expiresAtUtc, "lease.expiresAtUtc");
  assertNonnegativeInteger(
    value.acquiredMonotonicNanoseconds,
    "lease.acquiredMonotonicNanoseconds",
  );
  assertNonnegativeInteger(
    value.heartbeatMonotonicNanoseconds,
    "lease.heartbeatMonotonicNanoseconds",
  );
  assertNonnegativeInteger(
    value.expiresMonotonicNanoseconds,
    "lease.expiresMonotonicNanoseconds",
  );
  if (
    acquired > heartbeat ||
    heartbeat >= expires ||
    value.acquiredMonotonicNanoseconds > value.heartbeatMonotonicNanoseconds ||
    value.heartbeatMonotonicNanoseconds >= value.expiresMonotonicNanoseconds
  ) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      "Lease chronology is invalid.",
    );
  }
  return value as unknown as CollectionRunnerLeaseInput;
}

function validateResult(
  value: unknown,
  startedAtUtc: string,
  task: TaskRow,
): CollectionRunnerAttemptResultInput {
  exactKeys(value, RESULT_KEYS, "attempt result");
  const started = parseUtc(startedAtUtc, "attempt.startedAtUtc");
  const finished = parseUtc(value.finishedAtUtc, "result.finishedAtUtc");
  const received =
    value.receivedAtUtc === null
      ? null
      : parseUtc(value.receivedAtUtc, "result.receivedAtUtc");
  const normalized =
    value.normalizedAtUtc === null
      ? null
      : parseUtc(value.normalizedAtUtc, "result.normalizedAtUtc");
  assertIdentifier(value.outcomeCode, "result.outcomeCode");
  assertIdentifier(value.retryDisposition, "result.retryDisposition");
  assertNonnegativeInteger(value.rawPayloadBytes, "result.rawPayloadBytes");
  assertNonnegativeInteger(value.recordCount, "result.recordCount");
  if (
    value.rawPayloadBytes > task.maximum_raw_payload_bytes ||
    value.recordCount > task.maximum_record_count
  ) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.BudgetExceeded,
      "Attempt result exceeds task byte or record bounds.",
    );
  }
  for (const [entry, label] of [
    [value.responseFingerprint, "result.responseFingerprint"],
    [
      value.normalizedSnapshotFingerprint,
      "result.normalizedSnapshotFingerprint",
    ],
  ] as const) {
    if (entry !== null) assertFingerprint(entry, label);
  }
  if (
    finished < started ||
    (received !== null && received < started) ||
    (normalized !== null && (received === null || normalized < received))
  ) {
    throw repositoryError(
      CollectionRunnerRepositoryErrorCode.InvalidInput,
      "Attempt result chronology is invalid.",
    );
  }
  return value as unknown as CollectionRunnerAttemptResultInput;
}

function rowChanges(result: Readonly<{ readonly changes: number | bigint }>): number {
  return Number(result.changes);
}

export class SqliteEventContractCollectionRunnerRepository
  implements EventContractCollectionRunnerRepository
{
  readonly #runner = new EventContractCollectionRunnerEngine();

  public constructor(private readonly database: DatabaseSync) {}

  public registerRunnerDefinition(
    transaction: RegisterRunnerDefinitionTransaction,
  ): CollectionRunnerDefinition {
    exactKeys(transaction, REGISTER_KEYS, "register definition transaction");
    const evidence = validateEvidence(transaction.evidence);
    let definition: CollectionRunnerDefinition;
    try {
      definition = this.#runner.verifyRunnerDefinition(transaction.definition);
    } catch (error) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "Runner definition failed deterministic validation.",
        error,
      );
    }
    return this.#transaction(() => {
      const existing = this.#definitionRow(
        definition.runnerDefinitionId,
        definition.version,
      );
      if (existing !== undefined) {
        if (existing.fingerprint !== definition.fingerprint) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.IdentityConflict,
            "Runner definition identity already has a different fingerprint.",
          );
        }
        return this.#decodeDefinition(existing);
      }
      this.database
        .prepare(`
INSERT INTO runner_definitions (
  runner_definition_id, version, fingerprint, build_fingerprint,
  canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?)
`)
        .run(
          definition.runnerDefinitionId,
          definition.version,
          definition.fingerprint,
          definition.buildFingerprint,
          canonicalize(definition),
          evidence.occurredAtUtc,
        );
      this.#appendOutbox(
        "RUNNER_DEFINITION",
        `${definition.runnerDefinitionId}:${definition.version}`,
        1,
        "RUNNER_DEFINITION_REGISTERED",
        evidence.occurredAtUtc,
        { fingerprint: definition.fingerprint },
      );
      return definition;
    });
  }

  public createPilotArtifact(
    transaction: CreatePilotArtifactTransaction,
  ): CollectionRunnerPilotActivation {
    exactKeys(transaction, PILOT_KEYS, "create pilot transaction");
    const evidence = validateEvidence(transaction.evidence);
    let activation: CollectionRunnerPilotActivation;
    try {
      const input = transaction.activation;
      activation = this.#runner.createPilotActivation({
        schemaVersion: input.schemaVersion,
        activationId: input.activationId,
        ownerId: input.ownerId,
        approvedAt: input.approvedAt,
        startsAt: input.startsAt,
        stopsAt: input.stopsAt,
        frozenPlanId: input.frozenPlanId,
        frozenPlanFingerprint: input.frozenPlanFingerprint,
        runnerDefinition: input.runnerDefinition,
        admittedProviderFingerprints: input.admittedProviderFingerprints,
        admittedMappingFingerprints: input.admittedMappingFingerprints,
        maximumEvents: input.maximumEvents,
        maximumRequests: input.maximumRequests,
      });
      if (activation.fingerprint !== input.fingerprint) {
        throw new Error("activation fingerprint mismatch");
      }
    } catch (error) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "Pilot artifact failed deterministic validation.",
        error,
      );
    }
    return this.#transaction(() => {
      const definition = this.#definitionRow(
        activation.runnerDefinition.runnerDefinitionId,
        activation.runnerDefinition.version,
      );
      if (
        definition === undefined ||
        definition.fingerprint !== activation.runnerDefinition.fingerprint
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
          "Pilot runner definition is not registered by exact fingerprint.",
        );
      }
      const existing = this.#pilotRow(activation.activationId);
      if (existing !== undefined) {
        if (existing.activation_fingerprint !== activation.fingerprint) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.IdentityConflict,
            "Pilot activation identity already has a different fingerprint.",
          );
        }
        return this.#decodeActivation(existing);
      }
      this.database
        .prepare(`
INSERT INTO pilot_activations (
  activation_id, activation_fingerprint, owner_id, approved_at_utc,
  starts_at_utc, stops_at_utc, frozen_plan_id, frozen_plan_fingerprint,
  runner_definition_id, runner_definition_version, maximum_events,
  maximum_requests, current_state, aggregate_version,
  canonical_record_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
        .run(
          activation.activationId,
          activation.fingerprint,
          activation.ownerId,
          activation.approvedAt,
          activation.startsAt,
          activation.stopsAt,
          activation.frozenPlanId,
          activation.frozenPlanFingerprint,
          activation.runnerDefinition.runnerDefinitionId,
          activation.runnerDefinition.version,
          activation.maximumEvents,
          activation.maximumRequests,
          activation.state,
          activation.aggregateVersion,
          canonicalize(activation),
          evidence.occurredAtUtc,
        );
      const providerInsert = this.database.prepare(`
INSERT INTO pilot_activation_providers (activation_id, provider_fingerprint)
VALUES (?, ?)
`);
      for (const provider of activation.admittedProviderFingerprints) {
        providerInsert.run(activation.activationId, provider);
      }
      const mappingInsert = this.database.prepare(`
INSERT INTO pilot_activation_mappings (activation_id, mapping_fingerprint)
VALUES (?, ?)
`);
      for (const mapping of activation.admittedMappingFingerprints) {
        mappingInsert.run(activation.activationId, mapping);
      }
      this.database
        .prepare(`
INSERT INTO activation_budget_counters (
  activation_id, aggregate_version, events_scheduled, requests_started,
  bytes_received, records_received, retries_started, evidence_committed,
  tasks_missed, updated_at_utc
) VALUES (?, 1, 0, 0, 0, 0, 0, 0, 0, ?)
`)
        .run(activation.activationId, evidence.occurredAtUtc);
      this.#appendPilotTransition(
        activation.activationId,
        CollectionRunnerPilotState.Draft,
        activation.state,
        0,
        1,
        evidence,
      );
      this.#appendOutbox(
        "PILOT",
        activation.activationId,
        1,
        "PILOT_OWNER_APPROVED",
        evidence.occurredAtUtc,
        { activationFingerprint: activation.fingerprint },
      );
      return activation;
    });
  }

  public materializeTasks(
    transaction: MaterializeTasksTransaction,
  ): readonly CollectionRunnerScheduledTask[] {
    exactKeys(transaction, MATERIALIZE_KEYS, "materialize tasks transaction");
    assertIdentifier(transaction.activationId, "activationId");
    assertPositiveInteger(
      transaction.expectedBudgetVersion,
      "expectedBudgetVersion",
    );
    const evidence = validateEvidence(transaction.evidence);
    if (!Array.isArray(transaction.tasks) || transaction.tasks.length === 0) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "A complete non-empty task set is required.",
      );
    }
    return this.#transaction(() => {
      const pilot = this.#requirePilot(transaction.activationId);
      if (pilot.current_state !== CollectionRunnerPilotState.OwnerApproved) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Tasks may be materialized only for an owner-approved pilot.",
        );
      }
      const activation = this.#decodeActivation(pilot);
      const tasks = transaction.tasks.map((task) => {
        try {
          const constructed = this.#runner.createScheduledTask(
            {
              schemaVersion: task.schemaVersion,
              taskId: task.taskId,
              observationSlot: task.observationSlot,
              scheduledAt: task.scheduledAt,
              deadlineAt: task.deadlineAt,
              runnerDefinitionVersion: task.runnerDefinitionVersion,
              admission: task.admission,
            },
            activation,
          );
          if (
            constructed.fingerprint !== task.fingerprint ||
            constructed.idempotencyKey !== task.idempotencyKey
          ) {
            throw new Error("task fingerprint mismatch");
          }
          return constructed;
        } catch (error) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.InvalidInput,
            "Scheduled task failed deterministic validation.",
            error,
          );
        }
      });
      const taskIds = new Set(tasks.map(({ taskId }) => taskId));
      const idempotencyKeys = new Set(
        tasks.map(({ idempotencyKey }) => idempotencyKey),
      );
      if (
        taskIds.size !== tasks.length ||
        idempotencyKeys.size !== tasks.length ||
        tasks.length > pilot.maximum_events ||
        tasks.reduce(
          (sum, task) => sum + task.admission.bounds.maximumAttempts,
          0,
        ) > pilot.maximum_requests
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
          "Task set is duplicate-bearing or exceeds pilot event/request budgets.",
        );
      }
      const existing = this.database
        .prepare(`
SELECT task_id, task_fingerprint
FROM scheduled_tasks
WHERE activation_id = ?
ORDER BY task_id
`)
        .all(pilot.activation_id);
      if (existing.length > 0) {
        const expected = [...tasks]
          .sort((left, right) => left.taskId.localeCompare(right.taskId))
          .map(({ taskId, fingerprint: taskFingerprint }) => ({
            task_id: taskId,
            task_fingerprint: taskFingerprint,
          }));
        if (canonicalize(existing) !== canonicalize(expected)) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.IdentityConflict,
            "Activation already has a different materialized task set.",
          );
        }
        return freeze(tasks);
      }
      const budget = this.#requireBudget(pilot.activation_id);
      if (
        budget.aggregateVersion !== transaction.expectedBudgetVersion ||
        budget.eventsScheduled !== 0
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.VersionConflict,
          "Budget version is stale or tasks were already materialized.",
        );
      }
      for (const task of tasks) {
        this.#insertTask(task, evidence.occurredAtUtc);
        this.#appendTaskTransition(
          task.taskId,
          "NOT_MATERIALIZED",
          task.state,
          0,
          1,
          evidence,
          null,
          null,
        );
      }
      const changed = rowChanges(
        this.database
          .prepare(`
UPDATE activation_budget_counters
SET events_scheduled = ?,
    aggregate_version = aggregate_version + 1,
    updated_at_utc = ?
WHERE activation_id = ? AND aggregate_version = ? AND events_scheduled = 0
`)
          .run(
            tasks.length,
            evidence.occurredAtUtc,
            pilot.activation_id,
            transaction.expectedBudgetVersion,
          ),
      );
      this.#requireOneChange(changed, "Task materialization budget CAS failed.");
      this.#appendOutbox(
        "PILOT",
        pilot.activation_id,
        1,
        "TASK_SET_MATERIALIZED",
        evidence.occurredAtUtc,
        {
          taskCount: tasks.length,
          taskSetFingerprint: fingerprint(
            tasks.map(({ taskId, fingerprint: value }) => ({
              taskId,
              fingerprint: value,
            })),
          ),
        },
      );
      return freeze(tasks);
    });
  }

  public transitionPilot(
    transaction: TransitionPilotTransaction,
  ): Readonly<{
    activationId: string;
    state: CollectionRunnerPilotState;
    aggregateVersion: number;
  }> {
    exactKeys(transaction, PILOT_TRANSITION_KEYS, "pilot transition transaction");
    assertIdentifier(transaction.activationId, "activationId");
    assertPositiveInteger(
      transaction.expectedAggregateVersion,
      "expectedAggregateVersion",
    );
    assertNonnegativeInteger(
      transaction.recoveryBlockerCount,
      "recoveryBlockerCount",
    );
    const clock = validateClock(transaction.clock);
    const evidence = validateEvidence(transaction.evidence);
    return this.#transaction(() => {
      const pilot = this.#requirePilot(transaction.activationId);
      if (pilot.aggregate_version !== transaction.expectedAggregateVersion) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.VersionConflict,
          "Pilot aggregate version is stale.",
        );
      }
      let next;
      try {
        next = this.#runner.transitionPilot({
          current: {
            activationId: pilot.activation_id,
            state: pilot.current_state,
            aggregateVersion: pilot.aggregate_version,
          },
          expectedAggregateVersion: transaction.expectedAggregateVersion,
          nextState: transaction.nextState,
        });
      } catch (error) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Pilot transition failed deterministic validation.",
          error,
        );
      }
      if (transaction.nextState === CollectionRunnerPilotState.Active) {
        const observed = parseUtc(clock.observedAtUtc, "clock.observedAtUtc");
        if (
          observed < parseUtc(pilot.starts_at_utc, "pilot.startsAt") ||
          observed >= parseUtc(pilot.stops_at_utc, "pilot.stopsAt") ||
          transaction.recoveryBlockerCount !== 0
        ) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.InvalidState,
            "Pilot activation time or recovery gate is not satisfied.",
          );
        }
        const budget = this.#requireBudget(pilot.activation_id);
        const taskCount = Number(
          this.database
            .prepare(`
SELECT count(*) AS count FROM scheduled_tasks WHERE activation_id = ?
`)
            .get(pilot.activation_id)?.count ?? 0,
        );
        if (
          taskCount === 0 ||
          taskCount !== budget.eventsScheduled ||
          taskCount > pilot.maximum_events
        ) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.InvalidState,
            "Pilot task materialization is incomplete.",
          );
        }
        const other = this.database
          .prepare(`
SELECT activation_id
FROM pilot_activations
WHERE activation_id <> ?
  AND current_state IN ('ACTIVE', 'STOP_REQUESTED')
LIMIT 1
`)
          .get(pilot.activation_id);
        if (other !== undefined) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.InvalidState,
            "Another operational pilot already exists.",
          );
        }
      }
      const changed = rowChanges(
        this.database
          .prepare(`
UPDATE pilot_activations
SET current_state = ?, aggregate_version = aggregate_version + 1
WHERE activation_id = ? AND current_state = ? AND aggregate_version = ?
`)
          .run(
            next.state,
            pilot.activation_id,
            pilot.current_state,
            transaction.expectedAggregateVersion,
          ),
      );
      this.#requireOneChange(changed, "Pilot compare-and-swap failed.");
      this.#appendPilotTransition(
        pilot.activation_id,
        pilot.current_state,
        next.state,
        pilot.aggregate_version,
        next.aggregateVersion,
        evidence,
      );
      this.#appendOutbox(
        "PILOT",
        pilot.activation_id,
        next.aggregateVersion,
        "PILOT_STATE_CHANGED",
        evidence.occurredAtUtc,
        { fromState: pilot.current_state, toState: next.state },
      );
      return freeze(next);
    });
  }

  public transitionTask(
    transaction: TransitionTaskTransaction,
  ): Readonly<{
    taskId: string;
    state: CollectionRunnerTaskState;
    aggregateVersion: number;
  }> {
    exactKeys(transaction, TASK_TRANSITION_KEYS, "task transition transaction");
    assertIdentifier(transaction.taskId, "taskId");
    assertPositiveInteger(
      transaction.expectedAggregateVersion,
      "expectedAggregateVersion",
    );
    assertPositiveInteger(
      transaction.expectedBudgetVersion,
      "expectedBudgetVersion",
    );
    const clock = validateClock(transaction.clock);
    const evidence = validateEvidence(transaction.evidence);
    const allowed = [
      CollectionRunnerTaskState.Due,
      CollectionRunnerTaskState.Missed,
      CollectionRunnerTaskState.TerminalFailed,
      CollectionRunnerTaskState.Cancelled,
    ] as const;
    if (!allowed.includes(transaction.nextState as (typeof allowed)[number])) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "T6 permits only DUE or terminal-without-transport states.",
      );
    }
    return this.#transaction(() => {
      const task = this.#requireTask(transaction.taskId);
      this.#requireActivePilot(task.activation_id);
      const observed = parseUtc(clock.observedAtUtc, "clock.observedAtUtc");
      if (
        transaction.nextState === CollectionRunnerTaskState.Due &&
        (observed < parseUtc(task.scheduled_at_utc, "task.scheduledAt") ||
          observed > parseUtc(task.evidence_cutoff_at_utc, "task.cutoff") ||
          observed > parseUtc(task.deadline_at_utc, "task.deadline"))
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.DeadlineExceeded,
          "Task is not inside its due window.",
        );
      }
      if (
        transaction.nextState === CollectionRunnerTaskState.Missed &&
        observed < parseUtc(task.evidence_cutoff_at_utc, "task.cutoff")
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Task cannot be marked missed before its evidence cutoff.",
        );
      }
      const next = this.#transitionTaskRow(
        task,
        transaction.expectedAggregateVersion,
        transaction.nextState,
        evidence,
        null,
        null,
      );
      if (transaction.nextState === CollectionRunnerTaskState.Missed) {
        this.#updateBudget(
          task.activation_id,
          transaction.expectedBudgetVersion,
          evidence.occurredAtUtc,
          { tasksMissed: 1 },
        );
      } else {
        const budget = this.#requireBudget(task.activation_id);
        if (budget.aggregateVersion !== transaction.expectedBudgetVersion) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.VersionConflict,
            "Budget version is stale.",
          );
        }
      }
      return next;
    });
  }

  public acquireTaskLease(
    transaction: AcquireTaskLeaseTransaction,
  ): Readonly<CollectionRunnerLeaseInput & {
    taskId: string;
    aggregateVersion: 1;
  }> {
    exactKeys(transaction, ACQUIRE_KEYS, "acquire lease transaction");
    assertIdentifier(transaction.taskId, "taskId");
    assertPositiveInteger(
      transaction.expectedTaskVersion,
      "expectedTaskVersion",
    );
    assertPositiveInteger(
      transaction.expectedBudgetVersion,
      "expectedBudgetVersion",
    );
    const clock = validateClock(transaction.clock);
    const lease = validateLease(transaction.lease);
    const evidence = validateEvidence(transaction.evidence);
    if (lease.acquiredAtUtc !== clock.observedAtUtc) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "Lease acquisition time must equal clock observation time.",
      );
    }
    return this.#transaction(() => {
      const task = this.#requireTask(transaction.taskId);
      this.#requireActivePilot(task.activation_id);
      if (task.current_state !== CollectionRunnerTaskState.Due) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Only a DUE task can be leased.",
        );
      }
      this.#assertTaskWindow(task, clock.observedAtUtc);
      const budget = this.#requireBudget(task.activation_id);
      const pilot = this.#requirePilot(task.activation_id);
      if (
        budget.aggregateVersion !== transaction.expectedBudgetVersion ||
        budget.requestsStarted >= pilot.maximum_requests
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
          "Request budget is stale or exhausted.",
        );
      }
      const attemptCount = this.#attemptCount(task.task_id);
      if (attemptCount >= task.maximum_attempts) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
          "Task attempt budget is exhausted.",
        );
      }
      if (
        this.database
          .prepare("SELECT 1 FROM task_leases WHERE task_id = ?")
          .get(task.task_id) !== undefined ||
        this.database
          .prepare("SELECT 1 FROM normalized_source_evidence WHERE task_id = ?")
          .get(task.task_id) !== undefined
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.LeaseConflict,
          "Task already has a lease or committed evidence.",
        );
      }
      this.database
        .prepare(`
INSERT INTO task_leases (
  task_id, lease_token, worker_id, process_session_id, boot_identity,
  acquired_at_utc, heartbeat_at_utc, expires_at_utc,
  acquired_monotonic_nanoseconds, heartbeat_monotonic_nanoseconds,
  expires_monotonic_nanoseconds, aggregate_version
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`)
        .run(
          task.task_id,
          lease.leaseToken,
          lease.workerId,
          lease.processSessionId,
          lease.bootIdentity,
          lease.acquiredAtUtc,
          lease.heartbeatAtUtc,
          lease.expiresAtUtc,
          lease.acquiredMonotonicNanoseconds,
          lease.heartbeatMonotonicNanoseconds,
          lease.expiresMonotonicNanoseconds,
        );
      this.#transitionTaskRow(
        task,
        transaction.expectedTaskVersion,
        CollectionRunnerTaskState.Leased,
        evidence,
        null,
        lease.leaseToken,
      );
      return freeze({ taskId: task.task_id, ...lease, aggregateVersion: 1 });
    });
  }

  public startTaskAttempt(
    transaction: StartTaskAttemptTransaction,
  ): Readonly<{
    attemptId: string;
    taskId: string;
    attemptNumber: number;
    attemptFingerprint: string;
  }> {
    exactKeys(transaction, START_KEYS, "start attempt transaction");
    exactKeys(transaction.claim, CLAIM_KEYS, "attempt claim");
    assertIdentifier(transaction.taskId, "taskId");
    assertPositiveInteger(
      transaction.expectedTaskVersion,
      "expectedTaskVersion",
    );
    assertPositiveInteger(
      transaction.expectedBudgetVersion,
      "expectedBudgetVersion",
    );
    const clock = validateClock(transaction.clock);
    const evidence = validateEvidence(transaction.evidence);
    assertIdentifier(transaction.claim.attemptId, "claim.attemptId");
    assertIdentifier(transaction.claim.leaseToken, "claim.leaseToken");
    assertVersion(transaction.claim.adapterVersion, "claim.adapterVersion");
    assertVersion(transaction.claim.policyVersion, "claim.policyVersion");
    parseUtc(transaction.claim.startedAtUtc, "claim.startedAtUtc");
    if (transaction.claim.startedAtUtc !== clock.observedAtUtc) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "Attempt start time must equal clock observation time.",
      );
    }
    return this.#transaction(() => {
      const task = this.#requireTask(transaction.taskId);
      this.#requireActivePilot(task.activation_id);
      if (task.current_state !== CollectionRunnerTaskState.Leased) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Only a LEASED task can start an attempt.",
        );
      }
      this.#assertTaskWindow(task, clock.observedAtUtc);
      const lease = this.#requireLease(
        task.task_id,
        transaction.claim.leaseToken,
        clock.observedAtUtc,
      );
      const attemptNumber = this.#attemptCount(task.task_id) + 1;
      if (attemptNumber > task.maximum_attempts) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
          "Task attempt budget is exhausted.",
        );
      }
      const budget = this.#requireBudget(task.activation_id);
      const pilot = this.#requirePilot(task.activation_id);
      if (
        budget.aggregateVersion !== transaction.expectedBudgetVersion ||
        budget.requestsStarted >= pilot.maximum_requests
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
          "Activation request budget is stale or exhausted.",
        );
      }
      const claimRecord = {
        attemptId: transaction.claim.attemptId,
        taskId: task.task_id,
        attemptNumber,
        leaseToken: lease.lease_token,
        scheduledAtUtc: task.scheduled_at_utc,
        startedAtUtc: transaction.claim.startedAtUtc,
        requestCount: 1,
        adapterVersion: transaction.claim.adapterVersion,
        policyVersion: transaction.claim.policyVersion,
      };
      if (claimRecord.policyVersion !== task.request_policy_version) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
          "Attempt policy version does not match the scheduled task.",
        );
      }
      const attemptFingerprint = fingerprint(claimRecord);
      try {
        this.database
          .prepare(`
INSERT INTO attempt_records (
  attempt_id, task_id, attempt_number, lease_token, scheduled_at_utc,
  started_at_utc, request_count, adapter_version, policy_version,
  attempt_fingerprint, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
`)
          .run(
            claimRecord.attemptId,
            claimRecord.taskId,
            claimRecord.attemptNumber,
            claimRecord.leaseToken,
            claimRecord.scheduledAtUtc,
            claimRecord.startedAtUtc,
            claimRecord.adapterVersion,
            claimRecord.policyVersion,
            attemptFingerprint,
            evidence.occurredAtUtc,
          );
      } catch (error) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AttemptConflict,
          "Attempt identity or number already exists.",
          error,
        );
      }
      this.#transitionTaskRow(
        task,
        transaction.expectedTaskVersion,
        CollectionRunnerTaskState.InFlight,
        evidence,
        claimRecord.attemptId,
        lease.lease_token,
      );
      this.#updateBudget(
        task.activation_id,
        transaction.expectedBudgetVersion,
        evidence.occurredAtUtc,
        { requestsStarted: 1 },
      );
      return freeze({
        attemptId: claimRecord.attemptId,
        taskId: task.task_id,
        attemptNumber,
        attemptFingerprint,
      });
    });
  }

  public finalizeTaskFailure(
    transaction: FinalizeTaskFailureTransaction,
  ): CollectionRunnerStoredAttemptResult {
    exactKeys(transaction, FINALIZE_KEYS, "finalize failure transaction");
    assertIdentifier(transaction.taskId, "taskId");
    assertIdentifier(transaction.attemptId, "attemptId");
    assertIdentifier(transaction.leaseToken, "leaseToken");
    assertPositiveInteger(
      transaction.expectedTaskVersion,
      "expectedTaskVersion",
    );
    assertPositiveInteger(
      transaction.expectedBudgetVersion,
      "expectedBudgetVersion",
    );
    const evidence = validateEvidence(transaction.evidence);
    return this.#transaction(() => {
      const task = this.#requireTask(transaction.taskId);
      this.#requireActivePilot(task.activation_id);
      if (
        task.current_state !== CollectionRunnerTaskState.InFlight &&
        task.current_state !== CollectionRunnerTaskState.Validating
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Failure may finalize only an IN_FLIGHT or VALIDATING task.",
        );
      }
      const lease = this.#requireLease(
        task.task_id,
        transaction.leaseToken,
        evidence.occurredAtUtc,
      );
      const attempt = this.#requireAttempt(
        transaction.attemptId,
        task.task_id,
        lease.lease_token,
      );
      if (this.#attemptResultExists(attempt.attempt_id)) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AttemptConflict,
          "Attempt already has an immutable result.",
        );
      }
      const result = validateResult(
        transaction.result,
        attempt.started_at_utc,
        task,
      );
      if (
        transaction.nextState === CollectionRunnerTaskState.RetryWait &&
        attempt.attempt_number >= task.maximum_attempts
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.BudgetExceeded,
          "Final allowed attempt cannot transition back to RETRY_WAIT.",
        );
      }
      const storedResult = this.#insertAttemptResult(
        attempt.attempt_id,
        result,
        evidence.occurredAtUtc,
      );
      this.#transitionTaskRow(
        task,
        transaction.expectedTaskVersion,
        transaction.nextState,
        evidence,
        attempt.attempt_id,
        lease.lease_token,
      );
      this.#updateBudget(
        task.activation_id,
        transaction.expectedBudgetVersion,
        evidence.occurredAtUtc,
        {
          bytesReceived: result.rawPayloadBytes,
          recordsReceived: result.recordCount,
          retriesStarted:
            transaction.nextState === CollectionRunnerTaskState.RetryWait ? 1 : 0,
          tasksMissed:
            transaction.nextState === CollectionRunnerTaskState.Missed ? 1 : 0,
        },
      );
      this.#deleteLease(task.task_id, lease.lease_token);
      return storedResult;
    });
  }

  public markTaskValidating(
    transaction: MarkTaskValidatingTransaction,
  ): Readonly<{
    taskId: string;
    state: CollectionRunnerTaskState.Validating;
    aggregateVersion: number;
  }> {
    exactKeys(transaction, VALIDATING_KEYS, "mark validating transaction");
    assertIdentifier(transaction.taskId, "taskId");
    assertIdentifier(transaction.attemptId, "attemptId");
    assertIdentifier(transaction.leaseToken, "leaseToken");
    assertPositiveInteger(
      transaction.expectedTaskVersion,
      "expectedTaskVersion",
    );
    const clock = validateClock(transaction.clock);
    const evidence = validateEvidence(transaction.evidence);
    return this.#transaction(() => {
      const task = this.#requireTask(transaction.taskId);
      this.#requireActivePilot(task.activation_id);
      if (task.current_state !== CollectionRunnerTaskState.InFlight) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Only an IN_FLIGHT task can enter VALIDATING.",
        );
      }
      this.#assertTaskWindow(task, clock.observedAtUtc);
      const lease = this.#requireLease(
        task.task_id,
        transaction.leaseToken,
        clock.observedAtUtc,
      );
      const attempt = this.#requireAttempt(
        transaction.attemptId,
        task.task_id,
        lease.lease_token,
      );
      if (this.#attemptResultExists(attempt.attempt_id)) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AttemptConflict,
          "Attempt already has an immutable result.",
        );
      }
      const next = this.#transitionTaskRow(
        task,
        transaction.expectedTaskVersion,
        CollectionRunnerTaskState.Validating,
        evidence,
        attempt.attempt_id,
        lease.lease_token,
      );
      return freeze({
        taskId: next.taskId,
        state: CollectionRunnerTaskState.Validating,
        aggregateVersion: next.aggregateVersion,
      });
    });
  }

  public commitTaskEvidence(
    transaction: CommitTaskEvidenceTransaction,
  ): CollectionRunnerStoredEvidence {
    exactKeys(transaction, COMMIT_KEYS, "commit evidence transaction");
    assertIdentifier(transaction.evidenceId, "evidenceId");
    assertIdentifier(transaction.taskId, "taskId");
    assertIdentifier(transaction.attemptId, "attemptId");
    assertIdentifier(transaction.leaseToken, "leaseToken");
    assertPositiveInteger(
      transaction.expectedTaskVersion,
      "expectedTaskVersion",
    );
    assertPositiveInteger(
      transaction.expectedBudgetVersion,
      "expectedBudgetVersion",
    );
    parseUtc(transaction.committedAtUtc, "committedAtUtc");
    const evidence = validateEvidence(transaction.evidence);
    return this.#transaction(() => {
      const task = this.#requireTask(transaction.taskId);
      const snapshot = this.#verifySnapshot(transaction.snapshot, task);
      this.#assertSnapshotAuthority(snapshot, task);
      const claimedAttempt = this.#requireAttempt(
        transaction.attemptId,
        task.task_id,
        transaction.leaseToken,
      );
      const validatedResult = validateResult(
        transaction.result,
        claimedAttempt.started_at_utc,
        task,
      );
      const existing = this.#evidenceByTaskId(transaction.taskId);
      if (existing !== null) {
        const resultRow = this.database
          .prepare("SELECT result_fingerprint FROM attempt_results WHERE attempt_id = ?")
          .get(claimedAttempt.attempt_id);
        const expectedResultFingerprint = fingerprint({
          attemptId: claimedAttempt.attempt_id,
          ...validatedResult,
          createdAtUtc: evidence.occurredAtUtc,
        });
        if (
          existing.evidenceId !== transaction.evidenceId ||
          existing.attemptId !== transaction.attemptId ||
          existing.sourceSnapshotFingerprint !== snapshot.fingerprint ||
          existing.payloadFingerprint !== snapshot.payloadFingerprint ||
          existing.committedAtUtc !== transaction.committedAtUtc ||
          resultRow?.result_fingerprint !== expectedResultFingerprint
        ) {
          throw repositoryError(
            CollectionRunnerRepositoryErrorCode.EvidenceConflict,
            "Task already has different committed evidence.",
          );
        }
        return existing;
      }
      this.#requireActivePilot(task.activation_id);
      if (task.current_state !== CollectionRunnerTaskState.Validating) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.InvalidState,
          "Evidence may commit only for a VALIDATING task.",
        );
      }
      const lease = this.#requireLease(
        task.task_id,
        transaction.leaseToken,
        evidence.occurredAtUtc,
      );
      const attempt = claimedAttempt;
      if (this.#attemptResultExists(attempt.attempt_id)) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AttemptConflict,
          "Attempt already has an immutable result.",
        );
      }
      const result = validatedResult;
      if (
        result.normalizedSnapshotFingerprint !== snapshot.fingerprint ||
        result.rawPayloadBytes !== snapshot.rawPayloadBytes ||
        result.recordCount !== snapshot.recordCount ||
        result.receivedAtUtc !== snapshot.receivedAt ||
        result.normalizedAtUtc !== snapshot.normalizedAt ||
        (result.responseFingerprint !== null &&
          result.responseFingerprint !== snapshot.payloadFingerprint)
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
          "Attempt result does not bind exactly to the normalized snapshot.",
        );
      }
      if (
        parseUtc(snapshot.observedAt, "snapshot.observedAt") >
          parseUtc(task.evidence_cutoff_at_utc, "task.cutoff") ||
        parseUtc(snapshot.normalizedAt, "snapshot.normalizedAt") >
          parseUtc(task.deadline_at_utc, "task.deadline")
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.DeadlineExceeded,
          "Snapshot falls outside the task evidence window.",
        );
      }
      this.#insertAttemptResult(
        attempt.attempt_id,
        result,
        evidence.occurredAtUtc,
      );
      const storedEvidence: CollectionRunnerStoredEvidence = freeze({
        evidenceId: transaction.evidenceId,
        taskId: task.task_id,
        taskIdempotencyKey: task.idempotency_key,
        attemptId: attempt.attempt_id,
        providerFingerprint: snapshot.providerFingerprint,
        mappingFingerprint: snapshot.mappingFingerprint,
        sourceSnapshotFingerprint: snapshot.fingerprint,
        payloadFingerprint: snapshot.payloadFingerprint,
        capability: snapshot.capability,
        sourceLane: task.source_lane,
        observedAtUtc: snapshot.observedAt,
        receivedAtUtc: snapshot.receivedAt,
        normalizedAtUtc: snapshot.normalizedAt,
        rawPayloadBytes: snapshot.rawPayloadBytes,
        recordCount: snapshot.recordCount,
        committedAtUtc: transaction.committedAtUtc,
      });
      this.database
        .prepare(`
INSERT INTO normalized_source_evidence (
  evidence_id, task_id, task_idempotency_key, attempt_id,
  provider_fingerprint, mapping_fingerprint, source_snapshot_fingerprint,
  payload_fingerprint, capability, source_lane, observed_at_utc,
  received_at_utc, normalized_at_utc, raw_payload_bytes, record_count,
  canonical_snapshot_json, committed_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
        .run(
          storedEvidence.evidenceId,
          storedEvidence.taskId,
          storedEvidence.taskIdempotencyKey,
          storedEvidence.attemptId,
          storedEvidence.providerFingerprint,
          storedEvidence.mappingFingerprint,
          storedEvidence.sourceSnapshotFingerprint,
          storedEvidence.payloadFingerprint,
          storedEvidence.capability,
          storedEvidence.sourceLane,
          storedEvidence.observedAtUtc,
          storedEvidence.receivedAtUtc,
          storedEvidence.normalizedAtUtc,
          storedEvidence.rawPayloadBytes,
          storedEvidence.recordCount,
          canonicalize(snapshot),
          storedEvidence.committedAtUtc,
        );
      this.#transitionTaskRow(
        task,
        transaction.expectedTaskVersion,
        CollectionRunnerTaskState.Committed,
        evidence,
        attempt.attempt_id,
        lease.lease_token,
      );
      this.#updateBudget(
        task.activation_id,
        transaction.expectedBudgetVersion,
        evidence.occurredAtUtc,
        {
          bytesReceived: snapshot.rawPayloadBytes,
          recordsReceived: snapshot.recordCount,
          evidenceCommitted: 1,
        },
      );
      this.#deleteLease(task.task_id, lease.lease_token);
      return storedEvidence;
    });
  }

  public getRunnerDefinition(
    runnerDefinitionId: string,
    version: string,
  ): CollectionRunnerDefinition | null {
    assertIdentifier(runnerDefinitionId, "runnerDefinitionId");
    assertVersion(version, "version");
    const row = this.#definitionRow(runnerDefinitionId, version);
    return row === undefined ? null : this.#decodeDefinition(row);
  }

  public getPilotState(
    activationId: string,
  ): Readonly<{
    activationId: string;
    state: CollectionRunnerPilotState;
    aggregateVersion: number;
  }> | null {
    assertIdentifier(activationId, "activationId");
    const row = this.#pilotRow(activationId);
    return row === undefined
      ? null
      : freeze({
          activationId: row.activation_id,
          state: row.current_state,
          aggregateVersion: row.aggregate_version,
        });
  }

  public getTaskState(
    taskId: string,
  ): Readonly<{
    taskId: string;
    state: CollectionRunnerTaskState;
    aggregateVersion: number;
  }> | null {
    assertIdentifier(taskId, "taskId");
    const row = this.#taskRow(taskId);
    return row === undefined
      ? null
      : freeze({
          taskId: row.task_id,
          state: row.current_state,
          aggregateVersion: row.aggregate_version,
        });
  }

  public getBudgetCounters(
    activationId: string,
  ): CollectionRunnerBudgetCounters | null {
    assertIdentifier(activationId, "activationId");
    const row = this.database
      .prepare(`
SELECT * FROM activation_budget_counters WHERE activation_id = ?
`)
      .get(activationId);
    return row === undefined ? null : this.#budgetFromRow(row);
  }

  public getEvidenceByTaskId(taskId: string): CollectionRunnerStoredEvidence | null {
    assertIdentifier(taskId, "taskId");
    return this.#evidenceByTaskId(taskId);
  }

  #transaction<T>(run: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = run();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.database.exec("ROLLBACK");
      } catch {
        // Preserve the original transaction error.
      }
      if (error instanceof CollectionRunnerRepositoryError) throw error;
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.TransactionFailed,
        "Collection runner SQLite transaction failed and was rolled back.",
        error,
      );
    }
  }

  #definitionRow(id: string, version: string): Row | undefined {
    return this.database
      .prepare(`
SELECT * FROM runner_definitions
WHERE runner_definition_id = ? AND version = ?
`)
      .get(id, version);
  }

  #decodeDefinition(row: Row): CollectionRunnerDefinition {
    const definition = parseCanonicalJson<CollectionRunnerDefinition>(
      row.canonical_record_json,
      "runner definition",
    );
    try {
      return this.#runner.verifyRunnerDefinition(definition);
    } catch (error) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.IdentityConflict,
        "Stored runner definition failed deterministic verification.",
        error,
      );
    }
  }

  #pilotRow(id: string): PilotRow | undefined {
    return this.database
      .prepare("SELECT * FROM pilot_activations WHERE activation_id = ?")
      .get(id) as unknown as PilotRow | undefined;
  }

  #requirePilot(id: string): PilotRow {
    const row = this.#pilotRow(id);
    if (row === undefined) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.NotFound,
        "Pilot activation was not found.",
      );
    }
    return row;
  }

  #requireActivePilot(id: string): PilotRow {
    const pilot = this.#requirePilot(id);
    if (pilot.current_state !== CollectionRunnerPilotState.Active) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidState,
        "Pilot is not ACTIVE.",
      );
    }
    return pilot;
  }

  #decodeActivation(row: PilotRow): CollectionRunnerPilotActivation {
    const activation = parseCanonicalJson<CollectionRunnerPilotActivation>(
      row.canonical_record_json,
      "pilot activation",
    );
    try {
      const verified = this.#runner.createPilotActivation({
        schemaVersion: activation.schemaVersion,
        activationId: activation.activationId,
        ownerId: activation.ownerId,
        approvedAt: activation.approvedAt,
        startsAt: activation.startsAt,
        stopsAt: activation.stopsAt,
        frozenPlanId: activation.frozenPlanId,
        frozenPlanFingerprint: activation.frozenPlanFingerprint,
        runnerDefinition: activation.runnerDefinition,
        admittedProviderFingerprints: activation.admittedProviderFingerprints,
        admittedMappingFingerprints: activation.admittedMappingFingerprints,
        maximumEvents: activation.maximumEvents,
        maximumRequests: activation.maximumRequests,
      });
      if (
        verified.fingerprint !== row.activation_fingerprint ||
        activation.fingerprint !== verified.fingerprint
      ) {
        throw new Error("stored activation fingerprint mismatch");
      }
      return verified;
    } catch (error) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.IdentityConflict,
        "Stored pilot activation failed deterministic verification.",
        error,
      );
    }
  }

  #taskRow(id: string): TaskRow | undefined {
    return this.database
      .prepare("SELECT * FROM scheduled_tasks WHERE task_id = ?")
      .get(id) as unknown as TaskRow | undefined;
  }

  #requireTask(id: string): TaskRow {
    const row = this.#taskRow(id);
    if (row === undefined) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.NotFound,
        "Scheduled task was not found.",
      );
    }
    return row;
  }

  #insertTask(task: CollectionRunnerScheduledTask, createdAtUtc: string): void {
    const admission = task.admission;
    this.database
      .prepare(`
INSERT INTO scheduled_tasks (
  task_id, task_fingerprint, idempotency_key, activation_id,
  frozen_plan_id, frozen_plan_fingerprint, planned_event_id,
  observation_slot, source_lane, provider_id, provider_fingerprint,
  mapping_id, mapping_version, mapping_fingerprint, capability,
  execution_mode, source_record_id, request_policy_id,
  request_policy_version, scheduled_at_utc, evidence_cutoff_at_utc,
  deadline_at_utc, activation_expires_at_utc, maximum_attempts,
  maximum_raw_payload_bytes, maximum_record_count,
  request_deadline_milliseconds, current_state, aggregate_version,
  canonical_record_json, created_at_utc
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
  ?, ?, ?, ?, ?, ?, ?, ?
)
`)
      .run(
        task.taskId,
        task.fingerprint,
        task.idempotencyKey,
        admission.activationId,
        admission.frozenPlanId,
        admission.frozenPlanFingerprint,
        admission.plannedEventId,
        task.observationSlot,
        admission.sourceLane,
        admission.providerId,
        admission.providerFingerprint,
        admission.mappingId,
        admission.mappingVersion,
        admission.mappingFingerprint,
        admission.capability,
        admission.executionMode,
        admission.sourceRecordId,
        admission.requestPolicyId,
        admission.requestPolicyVersion,
        task.scheduledAt,
        admission.evidenceCutoffAt,
        task.deadlineAt,
        admission.activationExpiresAt,
        admission.bounds.maximumAttempts,
        admission.bounds.maximumRawPayloadBytes,
        admission.bounds.maximumRecordCount,
        admission.bounds.requestDeadlineMilliseconds,
        task.state,
        task.aggregateVersion,
        canonicalize(task),
        createdAtUtc,
      );
  }

  #transitionTaskRow(
    task: TaskRow,
    expectedVersion: number,
    nextState: CollectionRunnerTaskState,
    evidence: CollectionRunnerTransactionEvidence,
    attemptId: string | null,
    leaseToken: string | null,
  ): Readonly<{
    taskId: string;
    state: CollectionRunnerTaskState;
    aggregateVersion: number;
  }> {
    if (task.aggregate_version !== expectedVersion) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.VersionConflict,
        "Task aggregate version is stale.",
      );
    }
    let next;
    try {
      next = this.#runner.transitionTask({
        current: {
          taskId: task.task_id,
          state: task.current_state,
          aggregateVersion: task.aggregate_version,
        },
        expectedAggregateVersion: expectedVersion,
        nextState,
      });
    } catch (error) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidState,
        "Task transition failed deterministic validation.",
        error,
      );
    }
    const changed = rowChanges(
      this.database
        .prepare(`
UPDATE scheduled_tasks
SET current_state = ?, aggregate_version = aggregate_version + 1
WHERE task_id = ? AND current_state = ? AND aggregate_version = ?
`)
        .run(next.state, task.task_id, task.current_state, expectedVersion),
    );
    this.#requireOneChange(changed, "Task compare-and-swap failed.");
    this.#appendTaskTransition(
      task.task_id,
      task.current_state,
      next.state,
      task.aggregate_version,
      next.aggregateVersion,
      evidence,
      attemptId,
      leaseToken,
    );
    this.#appendOutbox(
      "TASK",
      task.task_id,
      next.aggregateVersion,
      "TASK_STATE_CHANGED",
      evidence.occurredAtUtc,
      { fromState: task.current_state, toState: next.state },
    );
    return freeze(next);
  }

  #requireOneChange(changes: number, message: string): void {
    if (changes !== 1) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.VersionConflict,
        message,
      );
    }
  }

  #requireBudget(activationId: string): CollectionRunnerBudgetCounters {
    const budget = this.getBudgetCounters(activationId);
    if (budget === null) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.NotFound,
        "Activation budget counters were not found.",
      );
    }
    return budget;
  }

  #budgetFromRow(row: Row): CollectionRunnerBudgetCounters {
    return freeze({
      activationId: String(row.activation_id),
      aggregateVersion: Number(row.aggregate_version),
      eventsScheduled: Number(row.events_scheduled),
      requestsStarted: Number(row.requests_started),
      bytesReceived: Number(row.bytes_received),
      recordsReceived: Number(row.records_received),
      retriesStarted: Number(row.retries_started),
      evidenceCommitted: Number(row.evidence_committed),
      tasksMissed: Number(row.tasks_missed),
      updatedAtUtc: String(row.updated_at_utc),
    });
  }

  #updateBudget(
    activationId: string,
    expectedVersion: number,
    updatedAtUtc: string,
    changes: Readonly<{
      requestsStarted?: number;
      bytesReceived?: number;
      recordsReceived?: number;
      retriesStarted?: number;
      evidenceCommitted?: number;
      tasksMissed?: number;
    }>,
  ): void {
    const changed = rowChanges(
      this.database
        .prepare(`
UPDATE activation_budget_counters
SET requests_started = requests_started + ?,
    bytes_received = bytes_received + ?,
    records_received = records_received + ?,
    retries_started = retries_started + ?,
    evidence_committed = evidence_committed + ?,
    tasks_missed = tasks_missed + ?,
    aggregate_version = aggregate_version + 1,
    updated_at_utc = ?
WHERE activation_id = ? AND aggregate_version = ?
`)
        .run(
          changes.requestsStarted ?? 0,
          changes.bytesReceived ?? 0,
          changes.recordsReceived ?? 0,
          changes.retriesStarted ?? 0,
          changes.evidenceCommitted ?? 0,
          changes.tasksMissed ?? 0,
          updatedAtUtc,
          activationId,
          expectedVersion,
        ),
    );
    this.#requireOneChange(changed, "Budget compare-and-swap failed.");
  }

  #requireLease(
    taskId: string,
    token: string,
    observedAtUtc: string,
  ): LeaseRow {
    const row = this.database
      .prepare("SELECT * FROM task_leases WHERE task_id = ?")
      .get(taskId) as unknown as LeaseRow | undefined;
    if (row === undefined || row.lease_token !== token) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.LeaseConflict,
        "Task lease token does not match.",
      );
    }
    if (
      parseUtc(observedAtUtc, "observedAtUtc") >=
      parseUtc(row.expires_at_utc, "lease.expiresAtUtc")
    ) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.LeaseConflict,
        "Task lease is expired.",
      );
    }
    return row;
  }

  #deleteLease(taskId: string, token: string): void {
    const changed = rowChanges(
      this.database
        .prepare("DELETE FROM task_leases WHERE task_id = ? AND lease_token = ?")
        .run(taskId, token),
    );
    if (changed !== 1) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.LeaseConflict,
        "Task lease changed before deletion.",
      );
    }
  }

  #attemptCount(taskId: string): number {
    return Number(
      this.database
        .prepare("SELECT count(*) AS count FROM attempt_records WHERE task_id = ?")
        .get(taskId)?.count ?? 0,
    );
  }

  #requireAttempt(attemptId: string, taskId: string, leaseToken: string): AttemptRow {
    const row = this.database
      .prepare("SELECT * FROM attempt_records WHERE attempt_id = ?")
      .get(attemptId) as unknown as AttemptRow | undefined;
    if (
      row === undefined ||
      row.task_id !== taskId ||
      row.lease_token !== leaseToken
    ) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.AttemptConflict,
        "Attempt claim does not bind to the task and lease.",
      );
    }
    return row;
  }

  #attemptResultExists(attemptId: string): boolean {
    return (
      this.database
        .prepare("SELECT 1 FROM attempt_results WHERE attempt_id = ?")
        .get(attemptId) !== undefined
    );
  }

  #insertAttemptResult(
    attemptId: string,
    result: CollectionRunnerAttemptResultInput,
    createdAtUtc: string,
  ): CollectionRunnerStoredAttemptResult {
    const base = { attemptId, ...result, createdAtUtc };
    const resultFingerprint = fingerprint(base);
    this.database
      .prepare(`
INSERT INTO attempt_results (
  attempt_id, finished_at_utc, received_at_utc, normalized_at_utc,
  outcome_code, retry_disposition, raw_payload_bytes, record_count,
  response_fingerprint, normalized_snapshot_fingerprint,
  result_fingerprint, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        attemptId,
        result.finishedAtUtc,
        result.receivedAtUtc,
        result.normalizedAtUtc,
        result.outcomeCode,
        result.retryDisposition,
        result.rawPayloadBytes,
        result.recordCount,
        result.responseFingerprint,
        result.normalizedSnapshotFingerprint,
        resultFingerprint,
        createdAtUtc,
      );
    return freeze({ ...base, resultFingerprint });
  }

  #verifySnapshot(
    snapshot: EventContractSourceSnapshot,
    task: TaskRow,
  ): EventContractSourceSnapshot {
    try {
      const engine =
        snapshot.executionMode === EventContractSourceExecutionMode.BoundedLiveRead
          ? new EventContractSourceEngine(
              INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY,
            )
          : new EventContractSourceEngine();
      const policy =
        snapshot.executionMode === EventContractSourceExecutionMode.BoundedLiveRead
          ? INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY
          : DEFAULT_EVENT_CONTRACT_SOURCE_POLICY;
      if (
        task.request_policy_id !== policy.policyId ||
        task.request_policy_version !== policy.version
      ) {
        throw repositoryError(
          CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
          "Task request policy is not the reviewed source policy.",
        );
      }
      return engine.verifySnapshot(snapshot);
    } catch (error) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.InvalidInput,
        "Source snapshot failed deterministic validation.",
        error,
      );
    }
  }

  #assertSnapshotAuthority(
    snapshot: EventContractSourceSnapshot,
    task: TaskRow,
  ): void {
    if (
      snapshot.providerFingerprint !== task.provider_fingerprint ||
      snapshot.mappingFingerprint !== task.mapping_fingerprint ||
      snapshot.capability !== task.capability ||
      snapshot.executionMode !== task.execution_mode ||
      snapshot.sourceRecordId !== task.source_record_id ||
      (task.source_lane === CollectionRunnerSourceLane.Exchange &&
        snapshot.mapping === null) ||
      (task.source_lane === CollectionRunnerSourceLane.Platform &&
        snapshot.mapping !== null)
    ) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.AuthorityMismatch,
        "Source snapshot does not match task authority.",
      );
    }
  }

  #evidenceByTaskId(taskId: string): CollectionRunnerStoredEvidence | null {
    const row = this.database
      .prepare(`
SELECT * FROM normalized_source_evidence WHERE task_id = ?
`)
      .get(taskId);
    if (row === undefined) return null;
    return freeze({
      evidenceId: String(row.evidence_id),
      taskId: String(row.task_id),
      taskIdempotencyKey: String(row.task_idempotency_key),
      attemptId: String(row.attempt_id),
      providerFingerprint: String(row.provider_fingerprint),
      mappingFingerprint:
        row.mapping_fingerprint === null ? null : String(row.mapping_fingerprint),
      sourceSnapshotFingerprint: String(row.source_snapshot_fingerprint),
      payloadFingerprint: String(row.payload_fingerprint),
      capability: String(row.capability),
      sourceLane: String(row.source_lane),
      observedAtUtc: String(row.observed_at_utc),
      receivedAtUtc: String(row.received_at_utc),
      normalizedAtUtc: String(row.normalized_at_utc),
      rawPayloadBytes: Number(row.raw_payload_bytes),
      recordCount: Number(row.record_count),
      committedAtUtc: String(row.committed_at_utc),
    });
  }

  #appendPilotTransition(
    activationId: string,
    fromState: string,
    toState: string,
    fromVersion: number,
    toVersion: number,
    evidence: CollectionRunnerTransactionEvidence,
  ): void {
    const transition = {
      activationId,
      fromState,
      toState,
      fromVersion,
      toVersion,
      occurredAtUtc: evidence.occurredAtUtc,
      reasonCode: evidence.reasonCode,
    };
    this.database
      .prepare(`
INSERT INTO pilot_transitions (
  activation_id, from_state, to_state, from_aggregate_version,
  to_aggregate_version, occurred_at_utc, reason_code,
  transition_fingerprint
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        activationId,
        fromState,
        toState,
        fromVersion,
        toVersion,
        evidence.occurredAtUtc,
        evidence.reasonCode,
        fingerprint(transition),
      );
  }

  #appendTaskTransition(
    taskId: string,
    fromState: string,
    toState: string,
    fromVersion: number,
    toVersion: number,
    evidence: CollectionRunnerTransactionEvidence,
    attemptId: string | null,
    leaseToken: string | null,
  ): void {
    const transition = {
      taskId,
      fromState,
      toState,
      fromVersion,
      toVersion,
      occurredAtUtc: evidence.occurredAtUtc,
      reasonCode: evidence.reasonCode,
      attemptId,
      leaseToken,
    };
    this.database
      .prepare(`
INSERT INTO task_transitions (
  task_id, from_state, to_state, from_aggregate_version,
  to_aggregate_version, occurred_at_utc, reason_code,
  attempt_id, lease_token, transition_fingerprint
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        taskId,
        fromState,
        toState,
        fromVersion,
        toVersion,
        evidence.occurredAtUtc,
        evidence.reasonCode,
        attemptId,
        leaseToken,
        fingerprint(transition),
      );
  }

  #appendOutbox(
    aggregateType: string,
    aggregateId: string,
    aggregateVersion: number,
    eventType: string,
    createdAtUtc: string,
    payload: Readonly<Record<string, unknown>>,
  ): void {
    const event = {
      aggregateType,
      aggregateId,
      aggregateVersion,
      eventType,
      createdAtUtc,
      payload,
    };
    const eventFingerprint = fingerprint(event);
    this.database
      .prepare(`
INSERT INTO transactional_outbox (
  outbox_id, aggregate_type, aggregate_id, aggregate_version,
  event_type, event_fingerprint, sanitized_event_json, created_at_utc
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
      .run(
        `outbox:${eventFingerprint}`,
        aggregateType,
        aggregateId,
        aggregateVersion,
        eventType,
        eventFingerprint,
        canonicalize(event),
        createdAtUtc,
      );
  }

  #assertTaskWindow(task: TaskRow, observedAtUtc: string): void {
    const observed = parseUtc(observedAtUtc, "clock.observedAtUtc");
    if (
      observed > parseUtc(task.evidence_cutoff_at_utc, "task.cutoff") ||
      observed > parseUtc(task.deadline_at_utc, "task.deadline")
    ) {
      throw repositoryError(
        CollectionRunnerRepositoryErrorCode.DeadlineExceeded,
        "Task evidence cutoff or deadline has passed.",
      );
    }
  }
}

export function createSqliteEventContractCollectionRunnerRepository(
  database: DatabaseSync,
): EventContractCollectionRunnerRepository {
  return new SqliteEventContractCollectionRunnerRepository(database);
}
