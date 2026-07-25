# Event Contract Collection Runner SQLite Schema and Transaction Boundaries v1

## Status

Day15-T3B10-T2 specifies the local SQLite persistence boundary required by the Event Contract Collection Runner. Day15-T3B10-T3A implements its dependency decision, safe open boundary, and first migration in [Event Contract Collection Runner SQLite Dependency and Migration](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_MIGRATION.md). Day15-T3B10-T3B implements named repository operations T2 through T10 plus the explicit T8B validating transition in [Event Contract Collection Runner SQLite Repository](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_REPOSITORY.md).

T3B10-T2 itself is design only. T3A adds the migration foundation and T3B adds a restricted repository adapter, but neither creates an application runtime database or starts a scheduler, clock, lease process, retry loop, worker, provider request, operator command, pilot activation, model, recommendation, broker, order, or execution behavior.

## Purpose

T3B10-T1 established immutable provider-neutral records and deterministic lifecycle validation. T3B10-T2 defines how a future single-host pilot store must preserve those records across process failure without weakening:

- exact source and mapping authority;
- append-only lifecycle history;
- compare-and-swap aggregate versions;
- one-task/one-evidence idempotency;
- bounded attempts and budgets;
- durable leases;
- atomic evidence commit;
- sanitized transactional outbox;
- fail-closed recovery.

This is a local research-pilot design. It is not a production or commercial database claim.

## Design constraints

1. One database file belongs to one local Alpha environment.
2. One writer process owns one active pilot.
3. Read-only inspection may use separate connections.
4. Domain engines validate records before persistence.
5. SQLite enforces structural, uniqueness, reference, and transaction invariants.
6. Persistence does not decide business eligibility, retryability, evidence meaning, or trading action.
7. No raw provider body, URL query, header, credential, provider narrative, portfolio data, probability, recommendation, P&L, or order content is stored.
8. Historical transition and attempt rows are append-only.
9. A committed evidence fingerprint is never overwritten.
10. Recovery exposes ambiguity; it does not manufacture success.

## Database location and ownership

The future implementation stores runtime data below:

```text
data/runtime/event-contract-collection/<store-id>.sqlite3
```

The path must remain Git-ignored and pass the existing safe store-identity and traversal controls. Sidecar `-wal` and `-shm` files belong to the same runtime store and must never be tracked.

Only the SQLite repository adapter opens the database. Domain engines, source adapters, transports, schedulers, and monitoring surfaces receive repository ports, not database handles.

## SQLite compatibility and connection profile

The implementation must verify these capabilities before creating or opening a store:

- SQLite `>= 3.37.0`;
- `STRICT` tables;
- foreign-key enforcement;
- JSON validity functions;
- online backup API support;
- WAL checkpoint support;
- integrity-check pragmas.

Writer connection initialization:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA busy_timeout = 5000;
PRAGMA trusted_schema = OFF;
PRAGMA recursive_triggers = OFF;
PRAGMA temp_store = MEMORY;
```

The implementation must read back and verify every safety-critical pragma. Failure or disagreement blocks the store.

Read-only connections additionally use:

```sql
PRAGMA query_only = ON;
```

The pilot does not support network filesystems, shared folders, multiple writer processes, or a database path outside the approved runtime root.

## Representation rules

### Text

- IDs and versions use the T3B10-T1 validated canonical strings.
- UTC timestamps use canonical millisecond ISO-8601 text.
- fingerprints use lowercase `fnv1a64:` plus 16 hexadecimal characters.
- enum values use the exact contract literals.
- canonical contract snapshots use canonical JSON text only after deterministic validation.

### Integers

- booleans use `INTEGER` constrained to `0` or `1`;
- counters and aggregate versions use positive safe integers;
- byte, record, attempt, request, and event budgets use integers;
- monotonic elapsed values use non-negative integer nanoseconds when representable safely;
- no floating-point value is authoritative.

### Fingerprint check

Every fingerprint column applies the equivalent of:

```sql
CHECK (
  length(fingerprint) = 24
  AND substr(fingerprint, 1, 8) = 'fnv1a64:'
  AND substr(fingerprint, 9) NOT GLOB '*[^0-9a-f]*'
)
```

Database checks validate shape. Repository code recomputes record fingerprints before write and after read.

### Canonical JSON

Canonical JSON columns:

- contain validated normalized Alpha records only;
- pass `json_valid`;
- have JSON type `object`;
- are compared by stored fingerprint, not ad hoc JSON text;
- never contain raw provider responses.

## Schema catalog

The first schema contains 14 tables:

1. `schema_migrations`
2. `runner_definitions`
3. `pilot_activations`
4. `pilot_activation_providers`
5. `pilot_activation_mappings`
6. `pilot_transitions`
7. `scheduled_tasks`
8. `task_transitions`
9. `task_leases`
10. `attempt_records`
11. `attempt_results`
12. `normalized_source_evidence`
13. `activation_budget_counters`
14. `transactional_outbox`

No generic key-value, arbitrary metadata, caller extension, or raw-payload table is allowed.

## Logical schema

The SQL below is normative at the column, key, and constraint level. A later implementation may split statements into numbered migrations but may not silently weaken them.

### Schema migrations

```sql
CREATE TABLE schema_migrations (
  migration_version INTEGER PRIMARY KEY,
  migration_name TEXT NOT NULL UNIQUE,
  migration_checksum TEXT NOT NULL,
  applied_at_utc TEXT NOT NULL,
  application_build_fingerprint TEXT NOT NULL,
  schema_contract_version TEXT NOT NULL
) STRICT;
```

Migration rows are append-only. `PRAGMA user_version` may mirror the current version for diagnostics but is not the source of truth.

### Runner definitions

```sql
CREATE TABLE runner_definitions (
  runner_definition_id TEXT NOT NULL,
  version TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  build_fingerprint TEXT NOT NULL,
  canonical_record_json TEXT NOT NULL CHECK (json_valid(canonical_record_json)),
  created_at_utc TEXT NOT NULL,
  PRIMARY KEY (runner_definition_id, version)
) STRICT;
```

An existing `(runner_definition_id, version)` with the same fingerprint is an idempotent replay. A different fingerprint is an integrity conflict.

### Pilot activations

```sql
CREATE TABLE pilot_activations (
  activation_id TEXT PRIMARY KEY,
  activation_fingerprint TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  approved_at_utc TEXT NOT NULL,
  starts_at_utc TEXT NOT NULL,
  stops_at_utc TEXT NOT NULL,
  frozen_plan_id TEXT NOT NULL,
  frozen_plan_fingerprint TEXT NOT NULL,
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
  canonical_record_json TEXT NOT NULL CHECK (json_valid(canonical_record_json)),
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (runner_definition_id, runner_definition_version)
    REFERENCES runner_definitions (runner_definition_id, version)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (approved_at_utc <= starts_at_utc),
  CHECK (starts_at_utc < stops_at_utc)
) STRICT;
```

The database may contain historical terminal pilots but enforces at most one active operational pilot:

```sql
CREATE UNIQUE INDEX one_operational_pilot
ON pilot_activations ((1))
WHERE current_state IN ('ACTIVE', 'STOP_REQUESTED');
```

Creating an `OWNER_APPROVED` artifact is not pilot activation. The future operator transaction must transition it to `ACTIVE`.

### Admitted provider and mapping sets

```sql
CREATE TABLE pilot_activation_providers (
  activation_id TEXT NOT NULL,
  provider_fingerprint TEXT NOT NULL,
  PRIMARY KEY (activation_id, provider_fingerprint),
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;

CREATE TABLE pilot_activation_mappings (
  activation_id TEXT NOT NULL,
  mapping_fingerprint TEXT NOT NULL,
  PRIMARY KEY (activation_id, mapping_fingerprint),
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) STRICT;
```

These tables are immutable after activation creation. Extending an authority set requires a new activation.

### Pilot transition history

```sql
CREATE TABLE pilot_transitions (
  transition_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  activation_id TEXT NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  from_aggregate_version INTEGER NOT NULL,
  to_aggregate_version INTEGER NOT NULL,
  occurred_at_utc TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  transition_fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY (activation_id) REFERENCES pilot_activations (activation_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (activation_id, to_aggregate_version),
  CHECK (to_aggregate_version = from_aggregate_version + 1)
) STRICT;
```

The application validates the exact T3B10-T1 state edge. The database enforces sequence and uniqueness.

### Scheduled tasks

```sql
CREATE TABLE scheduled_tasks (
  task_id TEXT PRIMARY KEY,
  task_fingerprint TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  activation_id TEXT NOT NULL,
  frozen_plan_id TEXT NOT NULL,
  frozen_plan_fingerprint TEXT NOT NULL,
  planned_event_id TEXT NOT NULL,
  observation_slot TEXT NOT NULL,
  source_lane TEXT NOT NULL CHECK (source_lane IN ('PLATFORM', 'EXCHANGE')),
  provider_id TEXT NOT NULL,
  provider_fingerprint TEXT NOT NULL,
  mapping_id TEXT,
  mapping_version TEXT,
  mapping_fingerprint TEXT,
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
  maximum_raw_payload_bytes INTEGER NOT NULL
    CHECK (maximum_raw_payload_bytes BETWEEN 1 AND 1000000),
  maximum_record_count INTEGER NOT NULL
    CHECK (maximum_record_count BETWEEN 1 AND 1000),
  request_deadline_milliseconds INTEGER NOT NULL
    CHECK (request_deadline_milliseconds BETWEEN 1 AND 60000),
  current_state TEXT NOT NULL CHECK (
    current_state IN (
      'SCHEDULED', 'BLOCKED', 'DUE', 'LEASED', 'IN_FLIGHT',
      'VALIDATING', 'RETRY_WAIT', 'COMMITTED', 'MISSED',
      'TERMINAL_FAILED', 'CANCELLED'
    )
  ),
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version > 0),
  canonical_record_json TEXT NOT NULL CHECK (json_valid(canonical_record_json)),
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
```

The composite foreign keys bind providers and non-null exchange mappings to the activation admission sets. SQLite permits a platform task's nullable mapping reference while the lane `CHECK` requires exchange mappings to be non-null.

Required query indexes:

```sql
CREATE INDEX tasks_due_order
ON scheduled_tasks (activation_id, current_state, scheduled_at_utc, task_id);

CREATE INDEX tasks_deadline_order
ON scheduled_tasks (activation_id, current_state, deadline_at_utc, task_id);
```

### Task transition history

```sql
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
  transition_fingerprint TEXT NOT NULL UNIQUE,
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks (task_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (task_id, to_aggregate_version),
  CHECK (to_aggregate_version = from_aggregate_version + 1)
) STRICT;
```

### Durable task leases

```sql
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
```

Persisted monotonic values are comparable only when `boot_identity` and `process_session_id` match the current clock context. Across process or system restart they are historical evidence, not an expiry oracle. Cross-restart recovery requires:

1. healthy synchronized UTC clock;
2. verified boot/session mismatch handling;
3. persisted UTC expiry;
4. transport timeout plus safety margin;
5. explicit recovery transition;
6. operator resume when task eligibility changes.

### Attempt records

```sql
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
  attempt_fingerprint TEXT NOT NULL UNIQUE,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES scheduled_tasks (task_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  UNIQUE (task_id, attempt_number),
  CHECK (started_at_utc >= scheduled_at_utc)
) STRICT;
```

Attempt claims are immutable and inserted before transport. Results append separately:

```sql
CREATE TABLE attempt_results (
  attempt_id TEXT PRIMARY KEY,
  finished_at_utc TEXT NOT NULL,
  received_at_utc TEXT,
  normalized_at_utc TEXT,
  outcome_code TEXT NOT NULL,
  retry_disposition TEXT NOT NULL,
  raw_payload_bytes INTEGER NOT NULL CHECK (raw_payload_bytes BETWEEN 0 AND 1000000),
  record_count INTEGER NOT NULL CHECK (record_count BETWEEN 0 AND 1000),
  response_fingerprint TEXT,
  normalized_snapshot_fingerprint TEXT,
  result_fingerprint TEXT NOT NULL UNIQUE,
  created_at_utc TEXT NOT NULL,
  FOREIGN KEY (attempt_id) REFERENCES attempt_records (attempt_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CHECK (normalized_at_utc IS NULL OR received_at_utc IS NOT NULL),
  CHECK (normalized_at_utc IS NULL OR normalized_at_utc >= received_at_utc)
) STRICT;
```

Repository validation additionally binds result chronology to the referenced attempt's `started_at_utc`. One claim has at most one immutable result.

### Normalized source evidence

```sql
CREATE TABLE normalized_source_evidence (
  evidence_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  task_idempotency_key TEXT NOT NULL UNIQUE,
  attempt_id TEXT NOT NULL UNIQUE,
  provider_fingerprint TEXT NOT NULL,
  mapping_fingerprint TEXT,
  source_snapshot_fingerprint TEXT NOT NULL UNIQUE,
  payload_fingerprint TEXT NOT NULL,
  capability TEXT NOT NULL,
  source_lane TEXT NOT NULL CHECK (source_lane IN ('PLATFORM', 'EXCHANGE')),
  observed_at_utc TEXT NOT NULL,
  received_at_utc TEXT NOT NULL,
  normalized_at_utc TEXT NOT NULL,
  raw_payload_bytes INTEGER NOT NULL CHECK (raw_payload_bytes BETWEEN 0 AND 1000000),
  record_count INTEGER NOT NULL CHECK (record_count BETWEEN 1 AND 1000),
  canonical_snapshot_json TEXT NOT NULL CHECK (json_valid(canonical_snapshot_json)),
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
```

This table stores normalized Alpha evidence only. `raw_payload_bytes` is a count, not a BLOB or raw body.

### Activation budget counters

```sql
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
```

Counters are a transactional enforcement surface and cached read model. Recovery recomputes them from authoritative task, attempt, and evidence rows and blocks on mismatch.

### Transactional outbox

```sql
CREATE TABLE transactional_outbox (
  outbox_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  outbox_id TEXT NOT NULL UNIQUE,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_fingerprint TEXT NOT NULL UNIQUE,
  sanitized_event_json TEXT NOT NULL CHECK (json_valid(sanitized_event_json)),
  created_at_utc TEXT NOT NULL,
  published_at_utc TEXT,
  publish_attempts INTEGER NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_failure_code TEXT,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version, event_type)
) STRICT;
```

Outbox publication is local sanitized monitoring/audit delivery only. It cannot trigger provider calls, orders, capital mutation, or business-state changes.

## Append-only and mutation policy

Insert-only tables:

- `schema_migrations`;
- `pilot_activation_providers`;
- `pilot_activation_mappings`;
- `pilot_transitions`;
- `task_transitions`;
- `attempt_records`;
- `attempt_results`;
- `normalized_source_evidence`.

Controlled current-state updates:

- `pilot_activations.current_state` and `aggregate_version`;
- `scheduled_tasks.current_state` and `aggregate_version`;
- `task_leases` heartbeat/version or lease deletion;
- `activation_budget_counters`;
- outbox delivery metadata.

The repository exposes named transaction methods, never arbitrary insert/update/delete SQL to callers.

No business or evidence record uses `ON CONFLICT DO UPDATE`. Idempotent replay uses:

1. select by identity;
2. compare exact fingerprint;
3. return existing record only when identical;
4. fail closed on conflict.

## Transaction boundaries

All write workflows use `BEGIN IMMEDIATE` so writer ownership and compare-and-swap checks are established before mutation.

### T1 — Initialize or migrate store

Preconditions:

- no active pilot;
- exclusive local process lock;
- pre-migration backup exists;
- database passes `quick_check`;
- migration checksum chain matches.

Transaction:

1. validate current migration version and checksum;
2. apply exactly one forward migration;
3. append `schema_migrations`;
4. set mirrored `user_version`;
5. commit.

After commit, run full invariant checks. No automatic down migration exists.

### T2 — Register runner definition

Transaction:

1. revalidate and recompute the definition fingerprint;
2. select `(runner_definition_id, version)`;
3. return idempotently if fingerprint matches;
4. fail on different fingerprint;
5. insert definition;
6. append outbox record;
7. commit.

### T3 — Create owner-approved pilot artifact

Transaction:

1. validate the complete activation and runner definition;
2. verify the runner definition exists by exact fingerprint;
3. reject conflicting activation identity;
4. insert `pilot_activations` in `OWNER_APPROVED`, version `1`;
5. insert admitted provider and mapping sets;
6. initialize budget counters;
7. append initial transition/audit evidence and outbox record;
8. commit.

This transaction does not transition the pilot to `ACTIVE`.

### T4 — Materialize all scheduled tasks

One activation's complete frozen task set is inserted in one transaction before activation:

1. verify activation is `OWNER_APPROVED`;
2. verify frozen-plan and runner fingerprints;
3. validate every T3B10-T1 task;
4. verify unique task IDs and idempotency keys;
5. verify provider and exchange mapping admission;
6. verify total event/request budgets;
7. insert all scheduled tasks and initial transition evidence;
8. update scheduled counters with compare-and-swap;
9. append one sanitized batch outbox event;
10. commit.

Partial plan materialization is forbidden.

### T5 — Activate, stop, revoke, or complete pilot

Transaction:

1. load current pilot and expected aggregate version;
2. validate exact T3B10-T1 transition;
3. for activation, verify complete tasks, healthy clock evidence, zero recovery blockers, and no other operational pilot;
4. update current state with `WHERE aggregate_version = ? AND current_state = ?`;
5. require exactly one affected row;
6. append pilot transition;
7. append outbox event;
8. commit.

### T6 — Mark task due or terminal without transport

Transaction:

1. verify active activation, task version, cutoff/deadline, and healthy clock evidence;
2. validate transition;
3. update task by compare-and-swap;
4. update budget/coverage counters if terminal;
5. append transition and outbox event;
6. commit.

Missed evidence remains `MISSED`; no later transaction may attach evidence.

### T7 — Acquire lease

Transaction:

1. verify pilot `ACTIVE`;
2. verify task `DUE`, expected version, deadline, cutoff, attempt budget, and request budget;
3. verify no unexpired lease and no committed evidence;
4. insert one lease token;
5. transition task `DUE -> LEASED`;
6. append transition and outbox event;
7. commit.

Lease acquisition performs no provider request.

### T8 — Start attempt

Transaction immediately before transport:

1. verify current lease token and version;
2. verify task `LEASED`;
3. allocate the next attempt number;
4. insert an immutable attempt claim with `request_count = 1`;
5. transition `LEASED -> IN_FLIGHT`;
6. atomically increment `requests_started`;
7. append transition and outbox event;
8. commit.

The transport may execute only after this durable claim commits.

### T8B — Mark task validating

T3B10-T3B adds this explicit transaction because T10 requires `VALIDATING` while the original T2 sequence did not define the preceding state transition:

1. verify the task is `IN_FLIGHT` with the expected task version;
2. verify the exact current lease token and attempt claim;
3. verify healthy clock evidence remains within cutoff and deadline;
4. transition `IN_FLIGHT -> VALIDATING` by compare-and-swap;
5. append transition and outbox evidence;
6. commit.

T8B performs no provider request, inserts no attempt result, and changes no budget counter.

### T9 — Finalize retryable or terminal failure

Transaction:

1. verify task, lease, attempt claim without a result, and expected versions;
2. insert one immutable sanitized attempt result;
3. validate retry classification outside persistence;
4. transition to `RETRY_WAIT`, `MISSED`, `TERMINAL_FAILED`, or `CANCELLED`;
5. update counters;
6. remove or expire the lease;
7. append transition and outbox event;
8. commit.

The repository cannot infer retryability from provider text.
The final allowed attempt cannot transition to `RETRY_WAIT`; it must enter a terminal state so the store cannot retain an impossible third-attempt path.

### T10 — Atomic normalized-evidence commit

This is the critical transaction:

1. verify pilot is `ACTIVE`;
2. verify task is `VALIDATING`;
3. verify task, lease, attempt, and budget aggregate versions;
4. verify activation, plan, provider, mapping, capability, source lane, policy, cutoff, and deadline identities;
5. verify the attempt claim has no result and remains within task bounds;
6. revalidate the normalized source snapshot and recompute fingerprints;
7. select by task idempotency key;
8. if identical evidence already exists, return the committed result idempotently;
9. if a different fingerprint exists, append no mutation and fail with an integrity incident;
10. insert the immutable attempt result;
11. insert normalized evidence;
12. transition task `VALIDATING -> COMMITTED` by compare-and-swap;
13. increment budget/evidence counters;
14. delete the lease;
15. append task transition and sanitized outbox event;
16. commit.

Any error rolls back all 16 steps. Raw response content is discarded outside the database whether commit succeeds or fails.

### T11 — Heartbeat lease

Transaction:

1. verify current lease token, worker, boot identity, process session, and expected lease version;
2. verify task is `LEASED`, `IN_FLIGHT`, or `VALIDATING`;
3. advance UTC and same-session monotonic heartbeat/expiry;
4. require exactly one affected row;
5. commit.

No heartbeat may revive an expired, replaced, or terminal task.

### T12 — Publish outbox

Outbox delivery uses claim-read-publish-ack semantics. The external publish, if later implemented, occurs outside the database transaction.

Ack transaction:

1. select exact outbox ID and fingerprint;
2. if already published, return idempotently;
3. set `published_at_utc`, increment attempts, and clear failure code;
4. commit.

Outbox backlog never rolls back committed evidence.

## Compare-and-swap rule

Every current-state update has this form:

```sql
UPDATE scheduled_tasks
SET current_state = :next_state,
    aggregate_version = aggregate_version + 1
WHERE task_id = :task_id
  AND current_state = :expected_state
  AND aggregate_version = :expected_version;
```

Exactly one changed row is success. Zero rows is a version/state conflict. More than one row is impossible under the primary key and is treated as corruption if observed.

The transition-history insert and outbox insert occur in the same transaction as the update.

## Crash-point behavior

| Crash point | Durable interpretation | Recovery action |
| --- | --- | --- |
| Before a write transaction | No state change | Re-evaluate safely |
| During a transaction before commit | SQLite rollback | Re-evaluate safely |
| Commit completed but acknowledgement lost | State may be durable | Read by idempotency key and fingerprint |
| After attempt claim, before transport | Attempt claimed, request outcome not started or unknown | Reconcile lease and claim; do not invent success |
| During read-only provider request | Open attempt, outcome unknown | Wait for expiry/safety margin; one bounded retry only if policy permits |
| After response, before evidence transaction | No evidence committed | Discard raw body; retry only within cutoff and attempt budget |
| During atomic evidence commit | Whole transaction commits or rolls back | Query task/evidence idempotency identities |
| After evidence commit, before outbox delivery | Evidence and outbox durable | Publish outbox idempotently |
| During heartbeat | Prior lease version remains or new version commits | Compare token and version |
| During migration | Migration transaction rolls back | Block startup and inspect checksum/integrity |

## Startup recovery

Startup is read-only until all checks pass:

1. acquire exclusive local process lock;
2. verify database path and file identity;
3. verify SQLite version and pragmas;
4. run `quick_check`;
5. verify migration versions and checksums;
6. recompute runner, activation, task, attempt, and evidence fingerprints;
7. verify every current aggregate version has a unique transition history;
8. verify committed tasks have exactly one matching evidence row;
9. verify non-committed terminal tasks have no evidence;
10. verify leases bind non-terminal tasks and exact tokens;
11. recompute budget counters;
12. identify attempt claims without results and expired leases;
13. validate activation, provider, mapping, policy, and frozen-plan lineage;
14. verify outbox fingerprints and backlog;
15. record blockers in memory and expose sanitized diagnostics.

Startup never silently resumes an active pilot after:

- process restart;
- boot-identity change;
- recovered expired lease;
- counter mismatch;
- migration;
- integrity warning;
- clock-health failure.

An explicit future owner/operator resume transaction is required.

## Integrity invariant queries

The implementation must provide read-only invariant checks for at least:

- more than one operational pilot;
- current aggregate version without corresponding transition;
- gaps or duplicates in transition versions;
- task without admitted provider;
- exchange task without admitted mapping;
- platform task with mapping;
- committed task without evidence;
- evidence attached to non-committed or terminal-missing task;
- more than one evidence row per task/idempotency key;
- attempt number above task maximum;
- attempt result with incomplete chronology or no claim;
- lease on terminal task;
- lease token mismatch with transition/attempt;
- budget counter mismatch;
- outbox event missing for a committed transition;
- altered canonical JSON fingerprint;
- unknown enum or schema version;
- raw-payload-like forbidden columns or keys.

Any invariant failure blocks mutation.

## Backup design

The local pilot requires:

- a verified backup before every migration;
- a verified backup immediately before pilot activation;
- an online consistent backup after graceful stop;
- an owner-selected retention count;
- backup manifest containing store ID, schema version, migration checksum, SQLite version, source file identity, backup time, page count, and backup-file digest;
- backups beneath a separate Git-ignored runtime backup directory;
- no copying of a live database with ordinary file-copy commands.

Use the SQLite online backup API or `VACUUM INTO` only through a reviewed implementation. A backup is successful only after opening the backup separately and passing `quick_check`, migration, fingerprint, and invariant validation.

## Restore design

Restore is offline and never overwrites the active store:

1. stop the runner and release the process;
2. choose a manifest-bound backup;
3. restore to a new validated path;
4. open read-only;
5. verify file digest, SQLite version, migration chain, `quick_check`, full `integrity_check`, fingerprints, counters, and invariant queries;
6. compare source/target store identities;
7. require explicit owner approval to switch the configured store path;
8. preserve the prior store for rollback;
9. require explicit operator resume.

A restore never repairs, drops, updates, or invents evidence.

## Corruption and recovery drills

Before a real pilot, network-free tests must demonstrate:

- truncated database file is rejected;
- altered page or malformed database is rejected;
- WAL and main-file backup consistency;
- missing migration or checksum mismatch blocks startup;
- duplicate idempotency key with identical fingerprint replays safely;
- duplicate idempotency key with different fingerprint fails;
- crash before and after every transaction commit boundary;
- stale aggregate version changes zero rows;
- two lease acquisitions cannot both succeed;
- expired-lease recovery preserves abandoned attempt history;
- attempt 3 is impossible;
- committed evidence cannot be overwritten;
- missed task cannot accept evidence;
- outbox delivery is idempotent;
- counter recomputation detects drift;
- backup opens independently;
- restore uses a new path and passes all checks;
- raw payload and secret-shaped fields never enter the database.

Tests use temporary directories only. They perform no network request.

## Security and privacy boundary

The local pilot store is not encrypted, signed, multi-user, or production-hardened. Therefore:

- it stores research evidence only;
- it contains no brokerage session, credential, secret, account, portfolio, order, or personal financial data;
- OS file permissions must restrict the runtime directory;
- logs and outbox events are sanitized;
- exports require a later reviewed boundary;
- commercial deployment remains blocked pending security, privacy, encryption, access-control, retention, and production-database review.

## Implementation task split

T3B10-T2 authorizes no code. A future implementation should remain split:

1. **T3B10-T3A — SQLite dependency decision and migration foundation**
   - select the smallest maintained SQLite binding;
   - pin dependency and runtime requirements;
   - implement safe path/open/pragma/migration checks;
   - add schema and migration tests.
2. **T3B10-T3B — Repository ports and atomic transactions**
   - implement named repository operations and transactions T2 through T10;
   - add idempotency, compare-and-swap, budget, and crash-point tests.
3. **T3B10-T3C — Recovery, backup, restore, and corruption drills**
   - implement read-only startup recovery and integrity reports;
   - implement reviewed backup/restore tooling;
   - complete corruption and restore rehearsals.

T3C is implemented locally in [Event Contract Collection Runner SQLite Recovery](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_RECOVERY.md) and remains pending owner review.

Scheduler, clocks, leases as an active process, retry enforcement, provider composition, monitoring UI, and operator activation remain later separately approved tasks.

## Explicit exclusions

T3B10-T2 does not:

- select or install a Node SQLite library;
- create a `.sqlite3`, `-wal`, or `-shm` file;
- implement SQL, migrations, repositories, ports, or runtime configuration;
- alter current NDJSON repositories;
- start a process or timer;
- invoke a provider or repeat the Kalshi request;
- freeze or activate a real pilot;
- store raw provider data;
- create an observation or mutate the shadow ledger;
- qualify a dataset;
- add AI, probability, recommendation, ranking, sizing, portfolio, broker, order, or execution behavior.

## Acceptance criteria

- every T3B10-T1 record has an explicit storage owner;
- table keys, unique identities, foreign references, bounds, and append-only rules are explicit;
- cross-lane and exact-mapping authority remains enforced;
- migrations are checksum-bound and forward-only;
- all mutation paths are named transactions;
- evidence, attempt, task transition, counters, and outbox commit atomically;
- compare-and-swap semantics and crash outcomes are explicit;
- monotonic time is not misused across restart;
- startup, backup, restore, and corruption behavior fail closed;
- no raw payload or trading authority enters persistence;
- implementation remains split behind later owner approval gates.

## Related specifications

- [Event Contract Collection Runner Architecture](EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md)
- [Event Contract Collection Runner Contracts](EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md)
- [Event Contract Collection Runner SQLite Repository](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_REPOSITORY.md)
- [Event Contract Collection Runner SQLite Recovery](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_RECOVERY.md)
- [Event Contract Source Contracts](EVENT_CONTRACT_SOURCE_CONTRACTS.md)
- [Forward Shadow Collection Control](FORWARD_SHADOW_COLLECTION_CONTROL.md)
- [Production Persistence and Recovery Architecture](../PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md)
