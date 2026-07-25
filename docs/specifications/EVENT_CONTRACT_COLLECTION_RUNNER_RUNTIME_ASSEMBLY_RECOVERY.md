# Event Contract Collection Runner Runtime Assembly and Recovery Architecture v1

## Status

Day15-T3B12-T1 is committed and pushed as
`5791a2a69776861ff22464aada2eb72511cb20ce`.

Day15-T3B12-T2 is committed and pushed as
`5ca4c7e25d1f2ef7f927f88330974a659669a176`.

Day15-T3B12-T3 is committed and pushed as
`ddbbe52cb32eeff60bdd48a1e9a1d87c3d7d6677`.

Day15-T3B12-T4 is committed and pushed as
`285ec30f9e820d5eee6c7b142261eb000e0a023a`.

Day15-T3B12-T5 implements 11 real child-process transaction-boundary drills
locally and is pending Owner review. Complete Alpha validation passes
`2166/2166`.

It follows the T3B11-MR1 decision:

`FIXTURE_RUNTIME_FOUNDATION_ACCEPTED / GO_FOR_ASSEMBLY_DESIGN / NO_GO_FOR_RUNTIME_START / NO_GO_FOR_BOUNDED_LIVE`

The T3B12-T5 reviewed baseline is
`285ec30f9e820d5eee6c7b142261eb000e0a023a`.

This task validates process-loss recovery around the programmatic foreground
step and existing SQLite transactions. Its kill controls exist only in test
fixtures. It exposes no production crash command, executable runtime command,
timer, loop, daemon, service, provider request, Pilot activation, Outbox
delivery, model, recommendation, broker, order, or execution behavior.

## Purpose

T3B11 provides individually reviewed runtime primitives:

- immutable fixture-only configuration and safe local paths;
- atomic process ownership and minted process identity;
- separate wall, monotonic, and clock-health authority;
- a pure deterministic scheduler;
- one explicitly invoked fixture-only Worker cycle;
- session-gated named SQLite transactions;
- deterministic Preflight, Status, Health, and Stop behavior;
- initial duplicate-process, forced-exit, timeout, cutoff, Stop, restart, and
  replay drills.

Those components are not yet one operating boundary. T3B12 defines how a later
implementation may compose them without distributing authority into command
code or silently creating continuous operation.

## Initial assembly decision

The first assembled form is a **single foreground fixture step**.

One invocation may perform at most one scheduler action and then exit. It:

- does not sleep until a future task;
- does not poll;
- does not repeat;
- does not schedule itself;
- does not run in the background;
- does not instantiate a network transport;
- does not create, activate, extend, or resume a Pilot without existing exact
  Owner authority.

This deliberately trades throughput for reviewability. A later timer or
continuous runner requires a separate architecture and Owner approval.

## Authority topology

```text
Immutable runtime configuration
              |
              v
Atomic process ownership ----> immutable ownership evidence
              |
              v
SQLite readiness + startup recovery inspection
              |
              +---- blocked ----> sanitized recovery report only
              |
              v
Exact process-session authorization
              |
              v
Fail-closed Preflight
              |
              v
Bounded runtime work snapshot
              |
              v
Pure one-action planner
     |             |              |
     v             v              v
T6 transition   one Fixture     Stop/close/
only            Worker cycle    no-op
     \             |              /
      \            |             /
       +-----------+------------+
                   |
                   v
Sanitized terminal step report
                   |
                   v
Verified clean release or preserved ambiguity
```

No caller may skip a phase or inject a later-phase object directly into the
composition root.

## Runtime assembly roles

### Foreground Composition Root

May:

- parse one closed command envelope;
- load one immutable configuration file;
- acquire one exact ownership lock;
- construct reviewed local ports;
- open one exact SQLite store;
- run startup recovery inspection;
- bind one exact authorized process session;
- create the session-gated repository;
- produce Preflight and one bounded work snapshot;
- execute at most one deterministic action;
- produce one sanitized terminal report;
- close resources in defined order.

May not:

- create provider, mapping, plan, Pilot, or recovery authority;
- accept a caller-selected process-session ID;
- issue arbitrary SQL;
- invoke more than one Worker cycle;
- wait for future work;
- retry the composition;
- delete a stale lock;
- invoke a network adapter.

### Runtime Work Snapshot Repository

A later implementation requires one new restricted read-only port because the
current repository can read a task only by known task ID.

The port returns a bounded immutable snapshot containing:

- exact activation ID, Pilot state, aggregate version, and stop time;
- exact task ID, lane, state, aggregate version, required action, cutoff,
  deadline, retry eligibility, attempt count, and immutable task fingerprint;
- exact budget counters and aggregate version;
- current lease and open-attempt identities without provider payload;
- recovery-session authorization identity and expiry;
- durable Emergency Stop state;
- snapshot observation time and deterministic fingerprint.

It must:

- require the exact configured activation;
- return all nonterminal tasks needed for deterministic ordering;
- enforce the frozen plan's reviewed maximum task count;
- use fixed allow-listed SQL;
- return no raw payload, normalized evidence body, secret, URL, header, account,
  probability, recommendation, position, or order data;
- perform no mutation.

### Runtime Action Planner

The planner is pure. It receives only the validated work snapshot, exact
ownership/configuration checks, clock snapshot, process Stop state, and fixture
mode.

It returns exactly one closed action:

- `FAIL_CLOSED`;
- `TRIP_EMERGENCY_STOP`;
- `REQUEST_GRACEFUL_COMPLETION`;
- `TRANSITION_EXACT_TASK_DUE`;
- `MARK_EXACT_TASK_MISSED`;
- `EXECUTE_EXACT_FIXTURE_TASK`;
- `WAIT_AND_EXIT`;
- `COMPLETE_AND_EXIT`.

`WAIT_AND_EXIT` contains the next relevant UTC time for reporting only. It
never sleeps or arranges another invocation.

### Due Transition Executor

The existing T6 repository transaction remains the only mutation boundary for
`SCHEDULED -> DUE`, `RETRY_WAIT -> DUE`, and terminal-without-transport
transitions.

The executor:

- accepts only a planner-produced exact action;
- rechecks ownership, Stop, configuration, session, clock, Pilot, task,
  cutoff/deadline, retry eligibility, and budget;
- binds exact task and budget aggregate versions;
- emits deterministic transition evidence;
- calls `transitionTask` through the session-gated repository;
- returns after one transaction;
- never invokes the Worker in the same step.

Separating T6 from T7 ensures a crash after `DUE` cannot be confused with a
provider request.

### Fixture Cycle Executor

The executor accepts only `EXECUTE_EXACT_FIXTURE_TASK` and delegates one cycle
to the existing T3B11 fixture Worker.

It cannot construct a transport. The exact adapter must:

- declare fixture-only capability;
- match the admitted provider, mapping, request-policy, and fixture
  fingerprints;
- expose no URL, credential, network client, repository, Owner, Portfolio, or
  execution authority.

### Terminal Reporter

Returns one immutable sanitized record containing:

- configuration, path, store, lock, boot, process-session, activation, and
  build fingerprints;
- command and step identity;
- start/end UTC and monotonic elapsed time;
- Preflight health and blocker codes;
- selected action, task ID when present, and deterministic reason;
- whether a durable mutation was attempted and its sanitized receipt identity;
- Stop/barrier state;
- cleanup disposition;
- ambiguity and recovery-required flags;
- report fingerprint.

It contains no secret, provider payload, arbitrary exception text, probability,
recommendation, Portfolio, broker, order, or execution data.

## Closed lifecycle state machine

```text
CREATED
  -> CONFIGURATION_VERIFIED
  -> OWNERSHIP_ACQUIRED
  -> STORE_INSPECTED
  -> SESSION_AUTHORIZED
  -> PREFLIGHT_READY
  -> ACTION_SELECTED
  -> ACTION_EXECUTING
  -> REPORTING
  -> CLOSING
  -> CLOSED
```

Failure branches:

```text
CREATED/CONFIGURATION_VERIFIED
  -> START_BLOCKED

OWNERSHIP_ACQUIRED/STORE_INSPECTED
  -> RECOVERY_BLOCKED

SESSION_AUTHORIZED/PREFLIGHT_READY/ACTION_SELECTED/ACTION_EXECUTING
  -> FAILED_CLOSED

Any state
  -> STOPPING
  -> CLOSING
```

Rules:

- states never move backward;
- `START_BLOCKED`, `RECOVERY_BLOCKED`, `FAILED_CLOSED`, and `CLOSED` are
  terminal for one invocation;
- only `PREFLIGHT_READY` may select an action;
- only `ACTION_SELECTED` may invoke a mutation executor;
- one invocation records at most one planner action;
- a failed or ambiguous mutation never releases ownership as a verified clean
  shutdown.

## Startup sequence

The exact startup order is:

1. validate process arguments without reading secrets;
2. read one regular, non-symlink immutable configuration file;
3. construct and verify canonical runtime-control and SQLite paths;
4. acquire the exact atomic ownership lock;
5. mint the process nonce and process-session identity;
6. open SQLite through the hardened store boundary;
7. verify schema, migrations, pragmas, store identity, and integrity;
8. run deterministic startup recovery inspection;
9. stop and report if any non-resumable blocker exists;
10. verify or execute separately supplied exact Owner recovery authority for
    this new process session;
11. construct the session-gated repository and read-only work-snapshot port;
12. sample wall, monotonic, and clock-health evidence;
13. verify durable Stop and process-local Stop state;
14. produce Preflight;
15. continue only when Preflight is ready.

The store does not become writable before steps 8 through 10 succeed.

Configuration mismatch, lock contention, malformed ownership evidence, store
substitution, schema drift, clock uncertainty, stale session, Stop, or expired
activation ends the invocation without selecting work.

## One-step execution sequence

After ready Preflight:

1. read one bounded work snapshot;
2. revalidate its fingerprint and exact activation identity;
3. sample fresh clock evidence;
4. run the pure action planner;
5. if the action is `WAIT_AND_EXIT` or `COMPLETE_AND_EXIT`, write no mutation;
6. if the action is Stop-related, use the reviewed Stop boundary and exit;
7. if the action is T6, execute exactly one session-gated transition and exit;
8. if the action is fixture work, invoke exactly one existing Worker cycle;
9. re-read Stop and exact durable state required for the terminal report;
10. report, close, and release only when cleanup is verified clean.

No action falls through into a second planner call.

## Command architecture

T3B12-T1 implements no commands. A later separately approved implementation
may expose only local foreground commands:

### `preflight`

- acquires ownership;
- inspects store/recovery/session/clock authority;
- performs no task or Pilot mutation;
- emits one sanitized report;
- releases ownership only on verified clean close.

### `step`

- performs the full startup sequence;
- selects and executes at most one action;
- accepts fixture mode only;
- exits after one terminal report.

### `status`

- is read-only and does not claim live runtime health unless it owns and
  verifies the exact lock/session;
- an offline invocation reports `OFFLINE_INSPECTION`, not `HEALTHY`;
- exposes only the reviewed bounded projection.

### `stop`

- authenticates the exact local Owner using stdin-only secret handling;
- persists graceful or Emergency Stop before any best-effort process
  notification;
- writes one fingerprint-bound local Stop signal containing no secret;
- cannot start, resume, or mutate ordinary task state.

### `recover-ownership`

- is a separately authenticated offline recovery command;
- never shares authority with `step`;
- preserves old ownership evidence in quarantine;
- cannot open an ordinary writable runner repository.

No command may accept raw JSON business records, arbitrary paths outside the
resolved roots, provider credentials, URLs, SQL, process-session IDs, or
unstated extension fields.

## Local Stop signal

T4's in-memory notification cannot by itself cross process boundaries. A later
assembly implementation may add one local immutable Stop-signal record under
the runtime-control root.

The record binds:

- schema and policy versions;
- configuration, path, store, activation, lock, boot, and process-session
  identities;
- Stop command and authorization-reference identities;
- mode, reason, request time, expiry, and fingerprint.

Rules:

- durable SQLite Stop is authoritative;
- the local record contains no authentication secret;
- creation is atomic and exact replay is idempotent;
- a different replay fails closed;
- the target process checks the record before T6, lease, attempt, validation,
  and commit boundaries;
- absence of notification cannot override durable Stop;
- unauthenticated creation cannot grant authority and at most causes
  availability loss after strict identity validation;
- no HTTP server, socket listener, WebSocket, named remote API, or general
  command inbox is introduced.

## Shutdown and cleanup

Shutdown uses a fixed reviewed monotonic timeout.

Order:

1. trip or observe the process Stop barrier;
2. permit no new T6, lease, or attempt;
3. request fixture cancellation when an adapter is active;
4. persist an exact outcome only when it is known;
5. preserve unresolved lease/attempt ambiguity;
6. produce the terminal report when possible;
7. close repository and SQLite handles;
8. verify ownership again;
9. release ownership only after a clean, non-ambiguous close.

Timeout expiry:

- does not delete a lease;
- does not infer request failure or success;
- does not mark evidence committed;
- does not clear Stop;
- leaves ownership evidence and durable ambiguity for recovery;
- terminates the foreground process with a non-success status.

## Authenticated stale-lock recovery

Automatic stale-lock deletion or takeover remains prohibited.

### Eligibility evidence

The recovery inspector must bind:

- exact immutable configuration and path fingerprints;
- exact lock directory and owner-record fingerprint;
- recorded boot identity, PID, process nonce, process session, activation, and
  acquisition time;
- current boot identity;
- current process-liveness observation;
- exact SQLite store path identity;
- current read-only recovery and integrity report;
- durable Pilot, lease, attempt, and Stop summaries;
- inspection time, expiry, policy version, and evidence fingerprint.

Classification:

| Condition | Disposition |
| --- | --- |
| Same boot and exact process is live | `OWNERSHIP_ACTIVE` |
| Same boot and process is not live | `STALE_CANDIDATE` |
| Different verified boot identity | `PRIOR_BOOT_STALE_CANDIDATE` |
| PID or boot evidence unavailable | `LIVENESS_UNCERTAIN` |
| Lock record malformed, replaced, linked, or identity-mismatched | `LOCK_EVIDENCE_INVALID` |
| Store integrity or identity fails | `STORE_RECOVERY_BLOCKED` |
| Durable Emergency Stop exists | `STOPPED_RECOVERY_ONLY` |

Only `STALE_CANDIDATE` and `PRIOR_BOOT_STALE_CANDIDATE` may reach Owner review.

### Owner decision

The Owner command challenge binds the complete eligibility evidence and one
action:

`QUARANTINE_STALE_OWNERSHIP`

It may not authorize:

- deleting evidence;
- resuming a Pilot;
- creating a process session;
- resetting a lease or attempt;
- changing a task;
- switching a restored store;
- starting a runtime.

The secret is read only from stdin and is never persisted or printed.

### Quarantine transaction

Filesystem operations use one exact control root and a per-lock atomic recovery
guard.

Order:

1. create the recovery guard atomically;
2. re-read and revalidate all eligibility evidence;
3. verify the unexpired exact Owner decision;
4. write an immutable recovery receipt inside the existing lock directory;
5. flush the receipt;
6. atomically rename the lock directory into an allow-listed quarantine
   directory on the same filesystem;
7. preserve the owner record and receipt indefinitely under retention policy;
8. release the recovery guard;
9. return the deterministic receipt.

No recursive deletion occurs. Exact replay returns the existing receipt.
Changed replay, destination conflict, rename ambiguity, or crash before
verified completion fails closed.

A new runtime invocation may acquire a new lock only after quarantine completed
and only with a newly minted process identity. Pilot Resume remains a separate
SQLite Owner decision.

## Crash and replay drill architecture

The first implementation must use real child processes and temporary fixture
SQLite stores. It performs no network request.

Required kill points:

| Kill point | Expected restart evidence |
| --- | --- |
| Before lock | No ownership or store mutation |
| After lock, before store open | Immutable stale ownership; store unchanged |
| After store inspection, before session authorization | Stale ownership; no writable session |
| After session authorization, before action | New process cannot reuse old session |
| After T6 commit | Task remains durably `DUE`; no lease or attempt |
| After lease commit, before attempt | Lease ambiguity requires reconciliation |
| After attempt claim, before adapter result | Unknown request outcome; no automatic retry |
| During validation | Raw fixture body absent; durable attempt unresolved |
| After T10 commit, before report | Evidence remains committed; replay returns original |
| During Stop persistence | Barrier/Stop ordering remains fail closed |
| After quarantine rename, before command output | Exact replay finds the same recovery receipt |

The parent harness may terminate only its own reviewed child process after an
explicit fixture checkpoint. Production code may expose checkpoint observation
through an injected fixture-only test port, but may not contain a crash command
or unrestricted fault-injection API.

## Failure policy

| Failure | Required result |
| --- | --- |
| Duplicate ownership | Exit before SQLite mutation |
| Snapshot version conflict | Exit; next invocation may re-read |
| T6 conflict | Exit without Worker invocation |
| Stop before T6/T7/T8/T8B/T10 | Stop wins |
| SQLite busy beyond fixed bound | Fail closed; no local retry loop |
| Clock unhealthy or suspend/resume uncertainty | Stop or fail closed |
| Output/report failure after mutation | Preserve durable result; restart reads original |
| Cleanup ambiguity | Preserve lock and require recovery |
| Quarantine ambiguity | Preserve guard/evidence and fail closed |
| Unknown exception | Sanitize output, trip barrier after mutation authority began |

## Data and secret boundaries

Runtime control storage may contain only:

- immutable configuration and ownership evidence;
- sanitized Stop signal;
- stale-lock recovery evidence and receipts;
- sanitized terminal reports when separately approved.

It may never contain:

- Owner secrets or verifier material;
- provider credentials, headers, cookies, or query strings;
- raw provider or fixture bodies;
- account, Portfolio, P&L, position, probability, recommendation, or order
  data;
- arbitrary exception stacks.

SQLite remains authoritative for Pilot/task/budget/lease/attempt/evidence and
durable Stop state. Runtime-control files cannot override SQLite authority.

## Implementation sequence

T3B12 remains separately gated:

1. **T3B12-T1 — Assembly and recovery architecture:** completed and pushed.
2. **T3B12-T2 — Contracts and pure planners:** lifecycle contracts, bounded
   work-snapshot port, closed action planner, T6 executor contract, and
   sanitized terminal reports; completed and pushed.
3. **T3B12-T3 — Authenticated ownership recovery:** inspection, Owner decision,
   atomic quarantine, idempotent receipt, and crash tests; completed and
   pushed; no runtime step.
4. **T3B12-T4 — Single foreground fixture step:** reviewed composition root and
   restricted local Preflight, Step, Status, and Stop boundaries; completed
   and pushed; exactly one action, no timer, loop, network, or Pilot
   activation.
5. **T3B12-T5 — Transaction-boundary process drills:** real child-process kills
   before/after startup ownership and at T6/T7/T8/validation/session/T10/Stop/
   quarantine boundaries; implemented locally and pending Owner review.
6. **T3B12-MR1 — Assembly and recovery milestone review.**
7. **Later separately approved work:** fixture rehearsal, continuous runtime
   architecture, future-market provider admission, and bounded-live Pilot.

Approval of one task grants no authority to begin the next.

## Acceptance criteria

T3B12 may pass only when:

- one composition root owns the entire startup-to-close sequence;
- the first executable form performs exactly one foreground action;
- no wait, retry, timer, polling, daemon, or background loop exists;
- the work snapshot is complete, bounded, sanitized, immutable, and
  fingerprinted;
- T6 selection is deterministic and T6 execution uses the session gate;
- a T6 step cannot invoke a provider in the same invocation;
- fixture Worker composition cannot instantiate a network transport;
- Stop is rechecked before every mutation and evidence commit;
- shutdown timeout preserves ambiguity;
- stale-lock recovery requires exact Owner authentication;
- stale ownership is quarantined, never silently deleted;
- process identity and recovery authorization cannot be reused after restart;
- every required real child-process kill drill passes;
- terminal reports cannot claim health or success without current evidence;
- complete Alpha validation passes;
- a separate Owner review approves any fixture rehearsal or later operation.

## Explicit exclusions

T3B12-T1/T2 add no:

- TypeScript or Python business code;
- package dependency;
- executable command;
- runtime start or Pilot activation;
- timer, sleep, retry loop, daemon, service, or scheduler loop;
- automatic stale-lock recovery or evidence deletion;
- arbitrary filesystem mutation;
- network provider, market discovery, or Robinhood automation;
- Outbox delivery or T1/T2 assembly;
- probability research, recommendation, sizing, Portfolio, broker, order, or
  execution authority.

## Owner review recommendation

Review the T3B12-T5 transaction-boundary process drills. If approved and
pushed, begin T3B12-MR1 as a separately gated milestone review. Do not combine
T3B12-T5 approval with continuous runtime, fixture rehearsal, provider
admission, or live operation.
