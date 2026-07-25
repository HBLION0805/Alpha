export const COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION = 1 as const;
export const COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION = "1.0" as const;
export const COLLECTION_RUNNER_SQLITE_MIGRATION_NAME = "001_collection_runner_foundation" as const;

export const COLLECTION_RUNNER_SQLITE_TABLES = Object.freeze([
  "activation_budget_counters",
  "attempt_records",
  "attempt_results",
  "normalized_source_evidence",
  "pilot_activation_mappings",
  "pilot_activation_providers",
  "pilot_activations",
  "pilot_transitions",
  "runner_definitions",
  "scheduled_tasks",
  "schema_migrations",
  "task_leases",
  "task_transitions",
  "transactional_outbox",
] as const);

const FINGERPRINT_CHECK = (column: string): string => `
  CHECK (
    length(${column}) = 24
    AND substr(${column}, 1, 8) = 'fnv1a64:'
    AND substr(${column}, 9) NOT GLOB '*[^0-9a-f]*'
  )`;

export const COLLECTION_RUNNER_SQLITE_MIGRATION_V1_SQL = `
CREATE TABLE schema_migrations (
  migration_version INTEGER PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  migration_checksum TEXT NOT NULL,
  applied_at_utc TEXT NOT NULL,
  application_build_fingerprint TEXT NOT NULL,
  schema_contract_version TEXT NOT NULL
) STRICT;

CREATE TABLE runner_definitions (
  runner_definition_id TEXT NOT NULL,
  version TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("fingerprint")},
  build_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("build_fingerprint")},
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  created_at_utc TEXT NOT NULL,
  PRIMARY KEY (runner_definition_id, version)
) STRICT;

CREATE TABLE pilot_activations (
  activation_id TEXT PRIMARY KEY,
  activation_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("activation_fingerprint")},
  owner_id TEXT NOT NULL,
  approved_at_utc TEXT NOT NULL,
  starts_at_utc TEXT NOT NULL,
  stops_at_utc TEXT NOT NULL,
  frozen_plan_id TEXT NOT NULL,
  frozen_plan_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("frozen_plan_fingerprint")},
  runner_definition_id TEXT NOT NULL,
  runner_definition_version TEXT NOT NULL,
  maximum_events INTEGER NOT NULL CHECK (maximum_events > 0),
  maximum_requests INTEGER NOT NULL CHECK (maximum_requests >= maximum_events),
  current_state TEXT NOT NULL CHECK (
    current_state IN (
      'OWNER_APPROVED', 'ACTIVE', 'STOP_REQUESTED', 'STOPPED',
      'REVOKED', 'COMPLETED', 'FAILED_CLOSED'
    )
  ),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (runner_definition_id, runner_definition_version)
    REFERENCES runner_definitions (runner_definition_id, version)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (approved_at_utc <= starts_at_utc),
  CHECK (starts_at_utc < stops_at_utc)
) STRICT;

CREATE UNIQUE INDEX one_operational_pilot
ON pilot_activations ((1))
WHERE current_state IN ('ACTIVE', 'STOP_REQUESTED');

CREATE TABLE pilot_activation_providers (
  activation_id TEXT NOT NULL,
  provider_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("provider_fingerprint")},
  PRIMARY KEY (activation_id, provider_fingerprint),
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE pilot_activation_mappings (
  activation_id TEXT NOT NULL,
  mapping_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("mapping_fingerprint")},
  PRIMARY KEY (activation_id, mapping_fingerprint),
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE pilot_transitions (
  transition_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  activation_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  from_aggregate_version INTEGER NOT NULL,
  to_aggregate_version INTEGER NOT NULL,
  occurred_at_utc TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  transition_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("transition_fingerprint")},
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (activation_id, to_aggregate_version),
  CHECK (to_aggregate_version = from_aggregate_version + 1)
) STRICT;

CREATE TABLE scheduled_tasks (
  task_id TEXT PRIMARY KEY,
  task_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("task_fingerprint")},
  idempotency_key TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("idempotency_key")},
  activation_id TEXT NOT NULL,
  frozen_plan_id TEXT NOT NULL,
  frozen_plan_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("frozen_plan_fingerprint")},
  planned_event_id TEXT NOT NULL,
  observation_slot TEXT NOT NULL,
  source_lane TEXT NOT NULL CHECK (source_lane IN ('PLATFORM', 'EXCHANGE')),
  provider_id TEXT NOT NULL,
  provider_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("provider_fingerprint")},
  mapping_id TEXT,
  mapping_version TEXT,
  mapping_fingerprint TEXT ${FINGERPRINT_CHECK("mapping_fingerprint")},
  capability TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  request_policy_id TEXT NOT NULL,
  request_policy_version TEXT NOT NULL,
  scheduled_at_utc TEXT NOT NULL,
  evidence_cutoff_at_utc TEXT NOT NULL,
  deadline_at_utc TEXT NOT NULL,
  activation_expires_at_utc TEXT NOT NULL,
  maximum_attempts INTEGER NOT NULL CHECK (maximum_attempts BETWEEN 1 AND 2),
  maximum_raw_payload_bytes INTEGER NOT NULL CHECK (maximum_raw_payload_bytes BETWEEN 1 AND 1000000),
  maximum_record_count INTEGER NOT NULL CHECK (maximum_record_count BETWEEN 1 AND 1000),
  request_deadline_milliseconds INTEGER NOT NULL CHECK (request_deadline_milliseconds BETWEEN 1 AND 60000),
  current_state TEXT NOT NULL CHECK (
    current_state IN (
      'SCHEDULED', 'BLOCKED', 'DUE', 'LEASED', 'IN_FLIGHT',
      'VALIDATING', 'RETRY_WAIT', 'COMMITTED', 'MISSED',
      'TERMINAL_FAILED', 'CANCELLED'
    )
  ),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (activation_id, provider_fingerprint)
    REFERENCES pilot_activation_providers (activation_id, provider_fingerprint)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (activation_id, mapping_fingerprint)
    REFERENCES pilot_activation_mappings (activation_id, mapping_fingerprint)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (scheduled_at_utc <= evidence_cutoff_at_utc),
  CHECK (evidence_cutoff_at_utc <= deadline_at_utc),
  CHECK (deadline_at_utc <= activation_expires_at_utc),
  CHECK (
    (
      source_lane = 'EXCHANGE'
      AND mapping_id IS NOT NULL
      AND mapping_version IS NOT NULL
      AND mapping_fingerprint IS NOT NULL
    )
    OR
    (
      source_lane = 'PLATFORM'
      AND mapping_id IS NULL
      AND mapping_version IS NULL
      AND mapping_fingerprint IS NULL
    )
  )
) STRICT;

CREATE INDEX tasks_due_order
ON scheduled_tasks (activation_id, current_state, scheduled_at_utc, task_id);

CREATE INDEX tasks_deadline_order
ON scheduled_tasks (activation_id, current_state, deadline_at_utc, task_id);

CREATE TABLE task_transitions (
  transition_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  from_aggregate_version INTEGER NOT NULL,
  to_aggregate_version INTEGER NOT NULL,
  occurred_at_utc TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  attempt_id TEXT,
  lease_token TEXT,
  transition_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("transition_fingerprint")},
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks (task_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (task_id, to_aggregate_version),
  CHECK (to_aggregate_version = from_aggregate_version + 1)
) STRICT;

CREATE TABLE task_leases (
  task_id TEXT PRIMARY KEY,
  lease_token TEXT NOT NULL UNIQUE,
  worker_id TEXT NOT NULL,
  process_session_id TEXT NOT NULL,
  boot_identity TEXT NOT NULL,
  acquired_at_utc TEXT NOT NULL,
  heartbeat_at_utc TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  acquired_monotonic_nanoseconds INTEGER NOT NULL CHECK (acquired_monotonic_nanoseconds >= 0),
  heartbeat_monotonic_nanoseconds INTEGER NOT NULL CHECK (heartbeat_monotonic_nanoseconds >= 0),
  expires_monotonic_nanoseconds INTEGER NOT NULL CHECK (expires_monotonic_nanoseconds >= 0),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks (task_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (acquired_at_utc <= heartbeat_at_utc),
  CHECK (heartbeat_at_utc < expires_at_utc),
  CHECK (acquired_monotonic_nanoseconds <= heartbeat_monotonic_nanoseconds),
  CHECK (heartbeat_monotonic_nanoseconds < expires_monotonic_nanoseconds)
) STRICT;

CREATE TABLE attempt_records (
  attempt_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 2),
  lease_token TEXT NOT NULL,
  scheduled_at_utc TEXT NOT NULL,
  started_at_utc TEXT NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count = 1),
  adapter_version TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  attempt_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("attempt_fingerprint")},
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks (task_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (task_id, attempt_number),
  CHECK (started_at_utc >= scheduled_at_utc)
) STRICT;

CREATE TABLE attempt_results (
  attempt_id TEXT PRIMARY KEY,
  finished_at_utc TEXT NOT NULL,
  received_at_utc TEXT,
  normalized_at_utc TEXT,
  outcome_code TEXT NOT NULL,
  retry_disposition TEXT NOT NULL,
  raw_payload_bytes INTEGER NOT NULL CHECK (raw_payload_bytes BETWEEN 0 AND 1000000),
  record_count INTEGER NOT NULL CHECK (record_count BETWEEN 0 AND 1000),
  response_fingerprint TEXT ${FINGERPRINT_CHECK("response_fingerprint")},
  normalized_snapshot_fingerprint TEXT ${FINGERPRINT_CHECK("normalized_snapshot_fingerprint")},
  result_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("result_fingerprint")},
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES attempt_records (attempt_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (normalized_at_utc IS NULL OR received_at_utc IS NOT NULL),
  CHECK (normalized_at_utc IS NULL OR normalized_at_utc >= received_at_utc)
) STRICT;

CREATE TABLE normalized_source_evidence (
  evidence_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  task_idempotency_key TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("task_idempotency_key")},
  attempt_id TEXT NOT NULL UNIQUE,
  provider_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("provider_fingerprint")},
  mapping_fingerprint TEXT ${FINGERPRINT_CHECK("mapping_fingerprint")},
  source_snapshot_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("source_snapshot_fingerprint")},
  payload_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("payload_fingerprint")},
  capability TEXT NOT NULL,
  source_lane TEXT NOT NULL CHECK (source_lane IN ('PLATFORM', 'EXCHANGE')),
  observed_at_utc TEXT NOT NULL,
  received_at_utc TEXT NOT NULL,
  normalized_at_utc TEXT NOT NULL,
  raw_payload_bytes INTEGER NOT NULL CHECK (raw_payload_bytes BETWEEN 0 AND 1000000),
  record_count INTEGER NOT NULL CHECK (record_count BETWEEN 1 AND 1000),
  canonical_snapshot_json TEXT NOT NULL
    CHECK (json_valid(canonical_snapshot_json) AND json_type(canonical_snapshot_json) = 'object'),
  committed_at_utc TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks (task_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (attempt_id) REFERENCES attempt_records (attempt_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (observed_at_utc <= received_at_utc),
  CHECK (received_at_utc <= normalized_at_utc),
  CHECK (
    (source_lane = 'EXCHANGE' AND mapping_fingerprint IS NOT NULL)
    OR (source_lane = 'PLATFORM' AND mapping_fingerprint IS NULL)
  )
) STRICT;

CREATE TABLE activation_budget_counters (
  activation_id TEXT PRIMARY KEY,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  events_scheduled INTEGER NOT NULL CHECK (events_scheduled >= 0),
  requests_started INTEGER NOT NULL CHECK (requests_started >= 0),
  bytes_received INTEGER NOT NULL CHECK (bytes_received >= 0),
  records_received INTEGER NOT NULL CHECK (records_received >= 0),
  retries_started INTEGER NOT NULL CHECK (retries_started >= 0),
  evidence_committed INTEGER NOT NULL CHECK (evidence_committed >= 0),
  tasks_missed INTEGER NOT NULL CHECK (tasks_missed >= 0),
  updated_at_utc TEXT NOT NULL,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE transactional_outbox (
  outbox_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  outbox_id TEXT NOT NULL UNIQUE,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  event_type TEXT NOT NULL,
  event_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("event_fingerprint")},
  sanitized_event_json TEXT NOT NULL
    CHECK (json_valid(sanitized_event_json) AND json_type(sanitized_event_json) = 'object'),
  created_at_utc TEXT NOT NULL,
  published_at_utc TEXT,
  publish_attempts INTEGER NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_failure_code TEXT,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)
) STRICT;
`;
