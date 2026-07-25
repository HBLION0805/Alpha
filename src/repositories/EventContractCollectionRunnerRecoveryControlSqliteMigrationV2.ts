import { COLLECTION_RUNNER_SQLITE_TABLES as V1_TABLES } from "./EventContractCollectionRunnerSqliteMigrationV1";

export const COLLECTION_RUNNER_SQLITE_SCHEMA_VERSION = 2 as const;
export const COLLECTION_RUNNER_SQLITE_SCHEMA_CONTRACT_VERSION = "2.0" as const;
export const COLLECTION_RUNNER_SQLITE_MIGRATION_V2_NAME =
  "002_collection_runner_recovery_control" as const;

export const COLLECTION_RUNNER_SQLITE_TABLES = Object.freeze(
  [
    ...V1_TABLES,
    "control_execution_receipts",
    "emergency_stop_events",
    "owner_recovery_decisions",
    "recovery_assessments",
    "recovery_session_authorizations",
  ].sort(),
);

const FINGERPRINT_CHECK = (column: string): string => `
  CHECK (
    (
      length(${column}) = 24
      AND substr(${column}, 1, 8) = 'fnv1a64:'
      AND substr(${column}, 9) NOT GLOB '*[^0-9a-f]*'
    )
    OR
    (
      length(${column}) = 71
      AND substr(${column}, 1, 7) = 'sha256:'
      AND substr(${column}, 8) NOT GLOB '*[^0-9a-f]*'
    )
  )`;

export const COLLECTION_RUNNER_SQLITE_MIGRATION_V2_SQL = `
CREATE TABLE recovery_assessments (
  assessment_id TEXT PRIMARY KEY,
  assessment_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("assessment_fingerprint")},
  policy_version TEXT NOT NULL,
  store_id TEXT NOT NULL,
  store_path_identity TEXT NOT NULL ${FINGERPRINT_CHECK("store_path_identity")},
  schema_catalog_checksum TEXT NOT NULL ${FINGERPRINT_CHECK("schema_catalog_checksum")},
  recovery_report_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("recovery_report_fingerprint")},
  activation_id TEXT,
  activation_aggregate_version INTEGER,
  owner_id TEXT,
  disposition TEXT NOT NULL CHECK (
    disposition IN (
      'NO_RESUME_REQUIRED', 'RESUME_ELIGIBLE', 'RECONCILIATION_REQUIRED',
      'STOP_COMPLETION_ONLY', 'ACTIVATION_EXPIRED', 'STORE_SWITCH_REQUIRED',
      'FAIL_CLOSED_REQUIRED', 'TERMINAL_NO_RESUME'
    )
  ),
  proposed_boot_identity TEXT NOT NULL,
  proposed_process_session_id TEXT NOT NULL,
  assessed_at_utc TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (
    (activation_id IS NULL AND activation_aggregate_version IS NULL AND owner_id IS NULL)
    OR
    (activation_id IS NOT NULL AND activation_aggregate_version > 0 AND owner_id IS NOT NULL)
  ),
  CHECK (assessed_at_utc < expires_at_utc)
) STRICT;

CREATE TABLE owner_recovery_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("decision_fingerprint")},
  idempotency_key TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("idempotency_key")},
  assessment_id TEXT NOT NULL,
  assessment_fingerprint TEXT NOT NULL ${FINGERPRINT_CHECK("assessment_fingerprint")},
  activation_id TEXT NOT NULL,
  expected_activation_aggregate_version INTEGER NOT NULL
    CHECK (expected_activation_aggregate_version > 0),
  owner_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (
    action IN (
      'APPROVE_RESUME', 'COMPLETE_STOP', 'REVOKE',
      'FAIL_CLOSED', 'REJECT_NO_MUTATION'
    )
  ),
  proposed_boot_identity TEXT NOT NULL,
  proposed_process_session_id TEXT NOT NULL,
  decided_at_utc TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  created_at_utc TEXT NOT NULL,
  consumed_at_utc TEXT,
  invalidated_at_utc TEXT,
  invalidation_reason_code TEXT,
  FOREIGN KEY (assessment_id) REFERENCES recovery_assessments (assessment_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (decided_at_utc < expires_at_utc),
  CHECK (
    (invalidated_at_utc IS NULL AND invalidation_reason_code IS NULL)
    OR
    (invalidated_at_utc IS NOT NULL AND invalidation_reason_code IS NOT NULL)
  ),
  CHECK (consumed_at_utc IS NULL OR invalidated_at_utc IS NULL)
) STRICT;

CREATE TABLE recovery_session_authorizations (
  session_authorization_id TEXT PRIMARY KEY,
  authorization_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("authorization_fingerprint")},
  decision_id TEXT NOT NULL UNIQUE,
  assessment_id TEXT NOT NULL,
  activation_id TEXT NOT NULL,
  expected_activation_aggregate_version INTEGER NOT NULL
    CHECK (expected_activation_aggregate_version > 0),
  boot_identity TEXT NOT NULL,
  process_session_id TEXT NOT NULL UNIQUE,
  authorized_at_utc TEXT NOT NULL,
  expires_at_utc TEXT NOT NULL,
  revoked_at_utc TEXT,
  revocation_reason_code TEXT,
  FOREIGN KEY (decision_id) REFERENCES owner_recovery_decisions (decision_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (assessment_id) REFERENCES recovery_assessments (assessment_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (authorized_at_utc < expires_at_utc),
  CHECK (
    (revoked_at_utc IS NULL AND revocation_reason_code IS NULL)
    OR
    (revoked_at_utc IS NOT NULL AND revocation_reason_code IS NOT NULL)
  )
) STRICT;

CREATE TABLE emergency_stop_events (
  stop_event_id TEXT PRIMARY KEY,
  stop_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("stop_fingerprint")},
  idempotency_key TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("idempotency_key")},
  activation_id TEXT NOT NULL,
  expected_activation_aggregate_version INTEGER NOT NULL
    CHECK (expected_activation_aggregate_version > 0),
  directive TEXT NOT NULL CHECK (directive IN ('REQUEST_STOP', 'FAIL_CLOSED')),
  trigger_codes_json TEXT NOT NULL
    CHECK (json_valid(trigger_codes_json) AND json_type(trigger_codes_json) = 'array'),
  evaluated_at_utc TEXT NOT NULL,
  executed_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE control_execution_receipts (
  receipt_id TEXT PRIMARY KEY,
  receipt_fingerprint TEXT NOT NULL UNIQUE ${FINGERPRINT_CHECK("receipt_fingerprint")},
  decision_id TEXT UNIQUE,
  stop_event_id TEXT UNIQUE,
  assessment_id TEXT,
  activation_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  from_aggregate_version INTEGER NOT NULL CHECK (from_aggregate_version > 0),
  to_aggregate_version INTEGER NOT NULL CHECK (to_aggregate_version > 0),
  session_authorization_id TEXT UNIQUE,
  outbox_id TEXT NOT NULL UNIQUE,
  executed_at_utc TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL
    CHECK (json_valid(canonical_record_json) AND json_type(canonical_record_json) = 'object'),
  FOREIGN KEY (decision_id) REFERENCES owner_recovery_decisions (decision_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (stop_event_id) REFERENCES emergency_stop_events (stop_event_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (assessment_id) REFERENCES recovery_assessments (assessment_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (session_authorization_id)
    REFERENCES recovery_session_authorizations (session_authorization_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  FOREIGN KEY (outbox_id) REFERENCES transactional_outbox (outbox_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK ((decision_id IS NOT NULL) != (stop_event_id IS NOT NULL))
) STRICT;

CREATE INDEX recovery_assessments_activation_order
ON recovery_assessments (activation_id, assessed_at_utc, assessment_id);

CREATE INDEX recovery_decisions_activation_status
ON owner_recovery_decisions (
  activation_id, consumed_at_utc, invalidated_at_utc, expires_at_utc, decision_id
);

CREATE INDEX recovery_sessions_activation_status
ON recovery_session_authorizations (
  activation_id, revoked_at_utc, expires_at_utc, process_session_id
);
`;
