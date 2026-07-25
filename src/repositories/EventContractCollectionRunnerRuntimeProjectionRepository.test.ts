import { DatabaseSync } from "node:sqlite";

import {
  SqliteEventContractCollectionRunnerRuntimeProjectionRepository,
} from "./EventContractCollectionRunnerRuntimeProjectionRepository";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
CREATE TABLE pilot_activations (
  activation_id TEXT PRIMARY KEY,
  current_state TEXT NOT NULL,
  stops_at_utc TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  maximum_events INTEGER NOT NULL,
  maximum_requests INTEGER NOT NULL
) STRICT;
CREATE TABLE scheduled_tasks (
  task_id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL,
  source_lane TEXT NOT NULL,
  current_state TEXT NOT NULL
) STRICT;
CREATE TABLE activation_budget_counters (
  activation_id TEXT PRIMARY KEY,
  events_scheduled INTEGER NOT NULL,
  requests_started INTEGER NOT NULL,
  retries_started INTEGER NOT NULL,
  evidence_committed INTEGER NOT NULL,
  tasks_missed INTEGER NOT NULL
) STRICT;
CREATE TABLE task_leases (
  task_id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  acquired_at_utc TEXT NOT NULL,
  heartbeat_at_utc TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL
) STRICT;
CREATE TABLE attempt_records (
  attempt_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL
) STRICT;
CREATE TABLE attempt_results (
  attempt_id TEXT PRIMARY KEY,
  received_at_utc TEXT
) STRICT;
CREATE TABLE normalized_source_evidence (
  evidence_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  committed_at_utc TEXT NOT NULL
) STRICT;
CREATE TABLE transactional_outbox (
  outbox_sequence INTEGER PRIMARY KEY,
  outbox_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_fingerprint TEXT NOT NULL,
  sanitized_event_json TEXT NOT NULL,
  created_at_utc TEXT NOT NULL,
  published_at_utc TEXT,
  publish_attempts INTEGER NOT NULL,
  last_failure_code TEXT
) STRICT;
INSERT INTO pilot_activations VALUES
  ('activation:test', 'ACTIVE', '2026-07-25T15:00:00.000Z', 3, 10, 20);
INSERT INTO scheduled_tasks VALUES
  ('task:1', 'activation:test', 'PLATFORM', 'DUE'),
  ('task:2', 'activation:test', 'EXCHANGE', 'COMMITTED');
INSERT INTO activation_budget_counters VALUES
  ('activation:test', 2, 1, 0, 1, 0);
INSERT INTO task_leases VALUES
  ('task:1', 'worker:1', '2026-07-25T13:59:00.000Z',
   '2026-07-25T13:59:30.000Z', '2026-07-25T14:00:30.000Z');
INSERT INTO attempt_records VALUES ('attempt:1', 'task:2');
INSERT INTO attempt_results VALUES
  ('attempt:1', '2026-07-25T13:58:00.000Z');
INSERT INTO normalized_source_evidence VALUES
  ('evidence:1', 'task:2', '2026-07-25T13:58:30.000Z');
INSERT INTO transactional_outbox VALUES
  (1, 'outbox:1', 'TASK', 'task:1', 2, 'TASK_DUE',
   'fnv1a64:aaaaaaaaaaaaaaaa', '{"secret":"must-not-project"}',
   '2026-07-25T13:57:00.000Z', NULL, 0, NULL),
  (2, 'outbox:2', 'TASK', 'task:2', 4, 'EVIDENCE_COMMITTED',
   'fnv1a64:bbbbbbbbbbbbbbbb', '{"payload":"must-not-project"}',
   '2026-07-25T13:58:30.000Z', '2026-07-25T13:59:00.000Z', 1, NULL);
`);
  return db;
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "SQLite runtime projection is bounded sanitized and immutable",
    () => {
      const db = database();
      try {
        const projection =
          new SqliteEventContractCollectionRunnerRuntimeProjectionRepository(
            db,
          ).readRuntimeProjection("activation:test", 10);
        assertEqual(projection.pilotState, "ACTIVE", "pilot");
        assertEqual(projection.taskCounts.length, 2, "task counts");
        assertEqual(projection.outboxBacklog, 1, "backlog");
        assertEqual(projection.outbox.length, 1, "unpublished only");
        assertEqual(
          "sanitizedEventJson" in projection.outbox[0]!,
          false,
          "no event body",
        );
        assertTrue(Object.isFrozen(projection.outbox), "immutable");
      } finally {
        db.close();
      }
    },
  ],
  [
    "zero outbox limit returns counts without entries",
    () => {
      const db = database();
      try {
        const projection =
          new SqliteEventContractCollectionRunnerRuntimeProjectionRepository(
            db,
          ).readRuntimeProjection("activation:test", 0);
        assertEqual(projection.outboxBacklog, 1, "backlog");
        assertEqual(projection.outbox.length, 0, "entries");
      } finally {
        db.close();
      }
    },
  ],
  [
    "unknown activation fails closed",
    () => {
      const db = database();
      try {
        let failed = false;
        try {
          new SqliteEventContractCollectionRunnerRuntimeProjectionRepository(
            db,
          ).readRuntimeProjection("activation:missing", 10);
        } catch {
          failed = true;
        }
        assertEqual(failed, true, "missing activation");
      } finally {
        db.close();
      }
    },
  ],
  [
    "outbox projection limit is bounded",
    () => {
      const db = database();
      try {
        let failed = false;
        try {
          new SqliteEventContractCollectionRunnerRuntimeProjectionRepository(
            db,
          ).readRuntimeProjection("activation:test", 101);
        } catch {
          failed = true;
        }
        assertEqual(failed, true, "limit");
      } finally {
        db.close();
      }
    },
  ],
];

let passed = 0;
for (const [name, run] of tests) {
  run();
  passed += 1;
  console.log(`PASS ${name}`);
}
console.log(
  `Event Contract Collection Runner Runtime Projection tests passed: ${String(passed)}/${String(tests.length)}.`,
);
