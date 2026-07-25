import type { DatabaseSync } from "node:sqlite";

import type {
  CollectionRunnerRuntimeBudgetProjection,
  CollectionRunnerRuntimeLeaseProjection,
  CollectionRunnerRuntimeOutboxProjection,
  CollectionRunnerRuntimeTaskCount,
} from "../contracts";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;

export interface CollectionRunnerRuntimeStoreProjection {
  readonly activationId: string;
  readonly pilotState: string;
  readonly activationStopsAtUtc: string;
  readonly aggregateVersion: number;
  readonly taskCounts: readonly CollectionRunnerRuntimeTaskCount[];
  readonly budget: CollectionRunnerRuntimeBudgetProjection;
  readonly currentLease: CollectionRunnerRuntimeLeaseProjection | null;
  readonly lastReceiptAtUtc: string | null;
  readonly lastCommitAtUtc: string | null;
  readonly outboxBacklog: number;
  readonly outbox: readonly CollectionRunnerRuntimeOutboxProjection[];
}

export interface EventContractCollectionRunnerRuntimeProjectionRepository {
  readRuntimeProjection(
    activationId: string,
    outboxLimit: number,
  ): CollectionRunnerRuntimeStoreProjection;
}

type SqliteRow = Readonly<Record<string, unknown>>;

function fail(message: string): never {
  throw new Error(`Runtime projection failed closed: ${message}`);
}

function stringValue(row: SqliteRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    return fail(`${key} is invalid.`);
  }
  return value;
}

function nullableString(row: SqliteRow, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  return stringValue(row, key);
}

function integer(row: SqliteRow, key: string): number {
  const value = Number(row[key]);
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(`${key} is invalid.`);
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export class SqliteEventContractCollectionRunnerRuntimeProjectionRepository
  implements EventContractCollectionRunnerRuntimeProjectionRepository
{
  public constructor(private readonly database: DatabaseSync) {}

  public readRuntimeProjection(
    activationId: string,
    outboxLimit: number,
  ): CollectionRunnerRuntimeStoreProjection {
    if (!IDENTIFIER.test(activationId)) fail("activationId is invalid.");
    if (
      !Number.isSafeInteger(outboxLimit) ||
      outboxLimit < 0 ||
      outboxLimit > 100
    ) {
      fail("outboxLimit must be between zero and 100.");
    }
    const pilot = this.database
      .prepare(`
SELECT activation_id, current_state, stops_at_utc, aggregate_version,
       maximum_events, maximum_requests
FROM pilot_activations
WHERE activation_id = ?
`)
      .get(activationId);
    if (pilot === undefined) fail("activation was not found.");

    const taskRows = this.database
      .prepare(`
SELECT source_lane, current_state, COUNT(*) AS task_count
FROM scheduled_tasks
WHERE activation_id = ?
GROUP BY source_lane, current_state
ORDER BY source_lane ASC, current_state ASC
`)
      .all(activationId);
    const budget = this.database
      .prepare(`
SELECT events_scheduled, requests_started, retries_started,
       evidence_committed, tasks_missed
FROM activation_budget_counters
WHERE activation_id = ?
`)
      .get(activationId);
    if (budget === undefined) fail("activation budget was not found.");

    const leaseRows = this.database
      .prepare(`
SELECT l.task_id, l.worker_id, l.acquired_at_utc, l.heartbeat_at_utc,
       l.expires_at_utc
FROM task_leases l
JOIN scheduled_tasks t ON t.task_id = l.task_id
WHERE t.activation_id = ?
ORDER BY l.task_id ASC
`)
      .all(activationId);
    if (leaseRows.length > 1) fail("more than one current lease exists.");

    const times = this.database
      .prepare(`
SELECT
  (
    SELECT MAX(r.received_at_utc)
    FROM attempt_results r
    JOIN attempt_records a ON a.attempt_id = r.attempt_id
    JOIN scheduled_tasks t ON t.task_id = a.task_id
    WHERE t.activation_id = ?
  ) AS last_receipt_at_utc,
  (
    SELECT MAX(e.committed_at_utc)
    FROM normalized_source_evidence e
    JOIN scheduled_tasks t ON t.task_id = e.task_id
    WHERE t.activation_id = ?
  ) AS last_commit_at_utc
`)
      .get(activationId, activationId);
    if (times === undefined) fail("runtime chronology projection failed.");

    const backlogRow = this.database
      .prepare(`
SELECT COUNT(*) AS backlog
FROM transactional_outbox
WHERE published_at_utc IS NULL
`)
      .get();
    if (backlogRow === undefined) fail("outbox backlog projection failed.");

    const outboxRows =
      outboxLimit === 0
        ? []
        : this.database
            .prepare(`
SELECT outbox_sequence, outbox_id, aggregate_type, aggregate_id,
       aggregate_version, event_type, event_fingerprint, created_at_utc,
       published_at_utc, publish_attempts, last_failure_code
FROM transactional_outbox
WHERE published_at_utc IS NULL
ORDER BY outbox_sequence ASC
LIMIT ?
`)
            .all(outboxLimit);

    return deepFreeze({
      activationId: stringValue(pilot, "activation_id"),
      pilotState: stringValue(pilot, "current_state"),
      activationStopsAtUtc: stringValue(pilot, "stops_at_utc"),
      aggregateVersion: integer(pilot, "aggregate_version"),
      taskCounts: taskRows.map((row) => ({
        sourceLane: stringValue(row, "source_lane") as
          | "PLATFORM"
          | "EXCHANGE",
        state: stringValue(row, "current_state"),
        count: integer(row, "task_count"),
      })),
      budget: {
        maximumEvents: integer(pilot, "maximum_events"),
        maximumRequests: integer(pilot, "maximum_requests"),
        eventsScheduled: integer(budget, "events_scheduled"),
        requestsStarted: integer(budget, "requests_started"),
        retriesStarted: integer(budget, "retries_started"),
        evidenceCommitted: integer(budget, "evidence_committed"),
        tasksMissed: integer(budget, "tasks_missed"),
      },
      currentLease:
        leaseRows[0] === undefined
          ? null
          : {
              taskId: stringValue(leaseRows[0], "task_id"),
              workerId: stringValue(leaseRows[0], "worker_id"),
              acquiredAtUtc: stringValue(leaseRows[0], "acquired_at_utc"),
              heartbeatAtUtc: stringValue(leaseRows[0], "heartbeat_at_utc"),
              expiresAtUtc: stringValue(leaseRows[0], "expires_at_utc"),
            },
      lastReceiptAtUtc: nullableString(times, "last_receipt_at_utc"),
      lastCommitAtUtc: nullableString(times, "last_commit_at_utc"),
      outboxBacklog: integer(backlogRow, "backlog"),
      outbox: outboxRows.map((row) => ({
        sequence: integer(row, "outbox_sequence"),
        outboxId: stringValue(row, "outbox_id"),
        aggregateType: stringValue(row, "aggregate_type"),
        aggregateId: stringValue(row, "aggregate_id"),
        aggregateVersion: integer(row, "aggregate_version"),
        eventType: stringValue(row, "event_type"),
        eventFingerprint: stringValue(row, "event_fingerprint"),
        createdAtUtc: stringValue(row, "created_at_utc"),
        publishedAtUtc: nullableString(row, "published_at_utc"),
        publishAttempts: integer(row, "publish_attempts"),
        lastFailureCode: nullableString(row, "last_failure_code"),
      })),
    });
  }
}

export function createSqliteEventContractCollectionRunnerRuntimeProjectionRepository(
  database: DatabaseSync,
): EventContractCollectionRunnerRuntimeProjectionRepository {
  return new SqliteEventContractCollectionRunnerRuntimeProjectionRepository(
    database,
  );
}
