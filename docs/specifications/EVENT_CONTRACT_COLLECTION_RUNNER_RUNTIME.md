# Event Contract Collection Runner Runtime Architecture v1

## Status

Day15-T3B11-T1 specifies the local Shadow Pilot runtime composition required
after the T3B10 foundation milestone review.

This is a design-only task. It does not implement or start a process lock,
clock, scheduler, Worker, timer, adapter composition, control inbox, status
command, provider request, Pilot activation, continuous runner, model,
recommendation, broker, order, or execution behavior.

The reviewed baseline is
`593f0f54804f64bce4808857e901d66f3babd80a`. The T3B10 milestone decision is
`GO_FOR_DESIGN / NO_GO_FOR_OPERATION`.

T3B11-T1 was Owner-approved, committed, and pushed as `6c52284`.
T3B11-T2 now implements the runtime foundation locally, pending Owner review:
strict immutable `FIXTURE_ONLY` configuration, canonical safe roots, atomic
single-instance ownership, canonical owner evidence, injected boot/liveness
ports, OS-CSPRNG process-session minting, and separated wall, monotonic, and
clock-health ports. T2 does not implement or start a scheduler, Worker, timer,
command, adapter, provider request, SQLite mutation, or Pilot.

## Purpose

T3B10 provides durable state machines, transactional idempotency, recovery,
Owner Resume, Emergency Stop, and crash/race evidence. It intentionally does
not define one application process that safely composes those components.

T3B11 defines that missing runtime boundary without widening source, research,
or capital authority.

The runtime coordinates already-authorized collection work. It cannot:

- create or extend a frozen plan;
- approve a provider or mapping;
- create its own Pilot authority;
- discover a market;
- infer missing evidence;
- qualify a dataset;
- choose an action, side, probability, or trade;
- access portfolio, brokerage, order, or execution state.

## Initial operating decision

The first implementation sequence is `FIXTURE_ONLY`.

Even after T3B11-T1 is approved:

- there is no runtime startup authorization;
- the existing Kalshi one-shot transport remains outside the runtime;
- the fixed historical Kalshi market cannot become a future-plan provider;
- no Robinhood source becomes approved;
- no real Pilot may be activated.

Fixture runtime implementation and bounded-live provider admission require
separate Owner approvals.

## Governing rules

1. One runtime process owns one local store and at most one active Pilot.
2. Runtime authority begins only after an exclusive local lock is acquired.
3. The runtime, not a caller, creates the boot/process-session identity.
4. Configuration is immutable, fingerprinted, and validated before the store
   opens.
5. Wall time, monotonic time, and clock health come only from injected ports.
6. Every mutation uses the existing session-gated repository.
7. Every acquisition cycle rechecks Stop, lock, clock, session, Pilot, task,
   cutoff, deadline, and budget authority.
8. A timer may wake the runtime; it may not decide task eligibility.
9. Provider adapters receive no repository, Owner, Portfolio, or trading
   authority.
10. Raw provider bodies remain memory-only and are discarded after validation.
11. Emergency Stop outranks acquisition, retry, provider invocation, and
   evidence commit.
12. A crash preserves ambiguity and reduces coverage; it never fabricates a
   successful sample.

## Runtime topology

```text
Local Owner command
        |
        v
Runtime bootstrap/control boundary
        |
        +--> immutable configuration
        +--> exclusive process lock
        +--> boot/process identity
        +--> wall/monotonic/health clocks
        +--> process stop barrier
        |
        v
Session-gated Runner repository
        |
        +--> deterministic scheduler
        +--> one fixture Worker
        +--> sanitized status/outbox projection
        |
        v
SQLite local research-pilot store
```

The process is an explicit foreground local command in the first
implementation. It is not a service, daemon, login task, scheduled operating
system job, or remotely managed agent.

## Authority roles

### Owner

May separately approve:

- immutable runtime configuration;
- one Runner Definition;
- one frozen plan and Pilot Activation;
- fixture-runtime rehearsal;
- recovery Resume;
- graceful stop, Emergency Stop, revocation, and terminal review;
- later bounded-live provider admission.

The Owner cannot use the runtime command to bypass source or state validation.

### Runtime Bootstrap

May:

- validate exact configuration and paths;
- acquire the single-instance lock;
- obtain trusted boot evidence;
- create a fresh process-session identity;
- open and inspect the configured store;
- initialize the in-memory stop barrier;
- create already-authorized ports and adapters.

It may not create Pilot, plan, provider, mapping, or Resume authority.

### Runtime Coordinator

May call one deterministic acquisition cycle only after all gates pass. It owns
sequencing, not business authority.

### Scheduler

May calculate which already-materialized task is next according to:

- durable task state;
- canonical schedule;
- cutoff and deadline;
- retry eligibility;
- stable task identity ordering.

It cannot materialize tasks, discover events, or move a cutoff.

### Worker

May process one leased task through the existing repository transaction
sequence. It receives one admitted adapter port and one cancellation signal.
It cannot open SQLite or choose another provider.

### Provider Adapter

May return one bounded source result for the exact admitted task. It receives no
repository, configuration file, Owner verifier, lock, Portfolio, recommendation,
or order object.

### Status Projection

May read sanitized durable state and process-local health. It cannot publish
externally, mutate outbox state, or expose raw payloads and secrets.

## Immutable runtime configuration

The first runtime configuration is one strict JSON object loaded from a regular,
non-symlink file beneath an Owner-selected local configuration root.

Required identity fields:

- configuration schema and policy version;
- configuration ID and fingerprint;
- application build fingerprint;
- runtime mode, initially exactly `FIXTURE_ONLY`;
- store root, store ID, and expected store-path identity;
- expected schema catalog checksum;
- Runner Definition ID, version, and fingerprint;
- Pilot Activation ID and fingerprint;
- frozen plan ID and fingerprint;
- admitted provider and mapping fingerprints;
- fixture-composition ID and fingerprint;
- clock, wake-up, lease, request, retry, and shutdown policy versions;
- status-output and local-control-inbox path identities;
- Owner approval reference and expiry.

The configuration contains no:

- secret or verifier-derived key;
- raw provider request or response;
- arbitrary URL, host, method, path, query, header, or market selector;
- dynamically loaded module or executable path;
- Portfolio, recommendation, order, or account field.

Unknown fields fail closed. The runtime freezes the parsed configuration and
uses its fingerprint in lock, process-session, status, and audit identities.

Changing any field requires a new configuration identity and Owner approval.
Reload-on-change is prohibited.

## Single-instance process ownership

### Lock location

The lock is a dedicated directory under an approved local runtime-control root,
separate from the SQLite file and from Git-tracked source.

The stable lock address is derived from:

- store path identity;
- Pilot Activation ID.

The immutable ownership record binds that stable address to the exact runtime
configuration and path fingerprints. Configuration drift therefore contends on
the same lock instead of creating a parallel ownership namespace.

Caller-supplied lock paths are prohibited.

### Acquisition

The implementation must use one atomic create-if-absent operation. The lock
directory contains one immutable canonical ownership record with:

- lock schema version;
- store, configuration, build, and activation identities;
- process ID as diagnostic evidence only;
- trusted boot identity;
- fresh process nonce;
- process-session ID;
- acquired wall and monotonic times;
- ownership-record fingerprint.

The process nonce uses the operating system cryptographic random source.

PID alone never proves ownership because PIDs may be reused.

### Stale locks

A lock is never deleted or stolen automatically.

If a process crashes:

1. the stale lock blocks another runtime;
2. an Owner-authenticated recovery command verifies the configured path;
3. the command verifies that the exact prior process is absent using a reviewed
   process-liveness port;
4. startup recovery inspects the SQLite store;
5. unresolved leases or attempts remain blockers;
6. the stale ownership record is archived, not overwritten;
7. a new lock and process session require fresh identities;
8. an operational Pilot still requires the existing Owner Resume process.

T3B11-T2 must select a concrete cross-platform implementation and test Windows
semantics. This specification does not silently claim that a portable operating
system file lock already exists in Node.

### Lock loss

The runtime verifies lock ownership:

- before each acquisition cycle;
- before provider invocation;
- before every repository mutation;
- before reporting itself healthy.

Missing, changed, or unreadable lock evidence trips the stop barrier and exits
fail closed.

## Boot and process-session identity

The runtime receives boot evidence from an injected `BootIdentityPort`. Tests
use a deterministic fixture. A production or pilot implementation must select a
reviewed local source; unavailable boot evidence blocks startup.

After lock acquisition, the runtime creates:

```text
process session ID =
  fingerprint(
    boot identity
    + process nonce
    + process ID
    + configuration fingerprint
    + application build fingerprint
    + store path identity
    + activation ID
  )
```

The process-session ID is not accepted from a command argument or configuration
file.

On every restart:

- the process nonce changes;
- the process-session ID changes;
- an old session authorization cannot be reused;
- the existing recovery assessment and Owner decision rules remain
  authoritative.

## Clock architecture

Three injected ports are required:

### WallClock

Returns canonical millisecond UTC for schedules, evidence chronology, cutoffs,
deadlines, and durable event time.

### MonotonicClock

Returns process-local monotonic nanoseconds for elapsed time, timeouts, lease
health, and latency. Values are never compared across boot/process identities.

### ClockHealthProbe

Returns:

- observed-at UTC;
- synchronization status;
- estimated absolute UTC offset;
- source and policy version;
- freshness deadline;
- evidence fingerprint.

Clock health is checked:

- during preflight;
- immediately before activation;
- before each acquisition;
- before a retry;
- before evidence commit;
- after operating-system suspend/resume evidence;
- before healthy status is emitted.

Unavailable, stale, or offset-above-policy evidence trips Emergency Stop or
fails closed according to the existing recovery-control policy.

Direct use of `Date.now()`, `new Date()`, hidden timers, or caller timestamps
inside scheduling decisions is prohibited.

## Runtime process state

The process-local lifecycle is separate from durable Pilot state:

```text
CREATED
  -> CONFIG_VALIDATED
  -> LOCK_ACQUIRED
  -> STORE_INSPECTED
  -> OWNER_AUTHORITY_REQUIRED
  -> READY
  -> RUNNING
  -> DRAINING
  -> TERMINATING
  -> TERMINATED

Any non-terminal state
  -> FAILED_CLOSED
```

Rules:

- `READY` does not mean the Pilot is active.
- `RUNNING` requires an exact active Pilot and current process-session
  authorization.
- `DRAINING` acquires no new lease.
- `FAILED_CLOSED` is terminal for the process.
- restarting creates a new process lifecycle; it never reopens the old one.
- process state is diagnostic and cannot override durable Pilot/task state.

## Preflight sequence

The exact startup order is:

1. reject unknown command options;
2. read and strictly validate the immutable configuration;
3. verify configuration and runtime-control paths;
4. acquire the exclusive process lock;
5. obtain boot identity and generate a process nonce;
6. bind the new process-session identity;
7. initialize the irreversible in-memory stop barrier;
8. open the exact SQLite store;
9. verify schema, migration, integrity, build, and store identity;
10. inspect durable Pilot, task, lease, attempt, budget, outbox, and recovery
    state;
11. verify the exact Runner Definition, plan, provider, mapping, and activation
    fingerprints;
12. sample wall, monotonic, and clock-health ports;
13. bind fixture-only provider composition;
14. emit one sanitized preflight result;
15. stop at `OWNER_AUTHORITY_REQUIRED` unless exact activation/session
    authority already exists for this process.

No adapter invocation occurs during preflight.

Preflight is side-effect free except for the process lock, process-local state,
and sanitized local diagnostic output. It does not create a Pilot, task,
provider, mapping, session authorization, or evidence record.

## Deterministic scheduler

The scheduler is a pure planner over immutable inputs:

- current wall and monotonic observations;
- clock-health evidence;
- process and lock identity;
- current Pilot and budget view;
- ordered durable task views;
- retry policy;
- stop-barrier state.

It returns one of:

- `ACQUIRE_EXACT_TASK`;
- `WAIT_UNTIL`;
- `MARK_EXACT_TASK_MISSED`;
- `REQUEST_GRACEFUL_COMPLETION`;
- `TRIP_EMERGENCY_STOP`;
- `FAIL_CLOSED`.

Stable ordering is:

1. earliest required action time;
2. earliest evidence cutoff;
3. earliest deadline;
4. source-lane policy order;
5. task ID.

The scheduler cannot:

- call a clock;
- sleep;
- mutate a repository;
- invoke an adapter;
- discover or materialize a task;
- infer a later timestamp;
- return more than one acquisition.

The runtime wake-up mechanism is only an efficiency mechanism. Every wake-up
recomputes eligibility from authoritative current evidence.

## One acquisition cycle

Before acquiring work, the coordinator checks in order:

1. process stop barrier is clear;
2. lock ownership is exact and current;
3. configuration and build identities are unchanged;
4. clock evidence is healthy and fresh;
5. process-session authorization is current;
6. Pilot remains `ACTIVE`;
7. no durable Emergency Stop exists;
8. request/event/retry/byte/record budgets remain;
9. exact task is due and not past cutoff or deadline;
10. no conflicting lease or in-flight request exists;
11. provider composition exactly matches task admission.

Only then may T7 acquire one lease.

The cycle processes at most one task. It never recursively acquires another task
from inside a Worker completion callback.

## Fixture-only Worker transaction sequence

The initial Worker uses an injected network-free adapter.

The sequence is:

1. T7 atomically acquire the exact process-bound lease;
2. recheck Stop, lock, clock, Pilot, and deadline;
3. T8 persist the attempt claim before adapter invocation;
4. invoke one fixture adapter with a cancellation signal;
5. keep any raw body memory-only;
6. classify transport/fixture outcome through a closed deterministic mapping;
7. on a received result, T8B mark `VALIDATING`;
8. validate source identity, mapping, chronology, schema, size, records, and
   fingerprints;
9. recheck Stop, lock, clock, Pilot, cutoff, deadline, and budgets;
10. T10 atomically commit accepted normalized evidence or T9 atomically record
    failure/retry/terminal state;
11. discard raw data;
12. return one sanitized cycle result.

The adapter never receives a repository handle.

An exception cannot skip T9/T10 determination. If persistence is unavailable,
the process trips the barrier and exits with the durable attempt ambiguity
preserved.

## Retry and waiting

The existing ceiling remains two total attempts.

Retry decisions use closed outcome codes and exact policy versions. Provider
message text cannot grant retry.

Before retry:

- the previous attempt result must be durable;
- the task must be in `RETRY_WAIT`;
- the activation, cutoff, and deadline must remain valid;
- clock evidence must be healthy;
- one retry budget must remain;
- no Stop or lock loss may exist.

Backoff is bounded by monotonic time within the same process identity. If the
process restarts, retry eligibility is reconstructed from durable evidence and
requires recovery review where ambiguity exists.

## Stop and shutdown architecture

### In-process signal

Operating-system termination signals and internal safety failures immediately:

1. trip the process stop barrier;
2. cancel the current adapter through its cancellation port;
3. prevent new lease, attempt, retry, or commit acquisition;
4. begin bounded termination.

### Graceful stop

Graceful stop:

1. trips the no-new-work barrier;
2. requests durable `STOP_REQUESTED`;
3. cancels or finishes only according to current attempt state;
4. records the actual outcome without assuming cancellation succeeded;
5. transitions remaining tasks only through named transactions;
6. completes `STOPPED` only when no unresolved work remains;
7. emits a terminal sanitized report;
8. closes SQLite;
9. archives and releases the lock last.

### External Emergency Stop

T3B11-T4 must select a local authenticated control-signal implementation.

The required semantics are:

1. authenticate the exact Owner or accept a deterministic safety trigger;
2. attempt durable Emergency Stop first;
3. invalidate session authority atomically;
4. notify the owning process through a local-only stop-signal port;
5. the process trips its in-memory barrier and cancels transport;
6. even if notification fails, per-write durable session validation blocks
   further mutation;
7. even if SQLite persistence fails, an authenticated local stop signal still
   trips the process barrier;
8. the unresolved persistence failure remains a restart blocker.

The stop signal contains no secret. It binds exact configuration, store,
activation, process-session, command, and authorization-reference identities.

No general remote-control server, HTTP endpoint, WebSocket, or unauthenticated
control file is allowed.

### Shutdown timeout

Shutdown has one bounded policy time. Expiry never clears a lease or invents an
attempt result. The process closes and leaves durable ambiguity for recovery.

The lock is not released as “clean” unless store close and terminal status
output succeed. A crash leaves a stale lock requiring Owner recovery.

## Local command surface

The planned initial commands are:

- `preflight` — read-only readiness report, except process-lock acquisition and
  release;
- `run-fixture` — foreground fixture-only runtime, separately Owner-approved;
- `status` — sanitized read-only process/store/Pilot view;
- `graceful-stop` — authenticated durable stop request;
- `emergency-stop` — authenticated Stop with local process notification;
- `recover-lock` — authenticated stale-lock recovery after liveness and store
  inspection.

Every command:

- uses strict allow-listed options;
- reads secrets only through standard input when authentication is required;
- accepts no arbitrary executable, module, host, URL, SQL, or query;
- writes no raw provider data;
- returns a structured sanitized result;
- performs only the authority explicitly assigned to that command.

T3B11-T1 does not implement these commands.

## Sanitized status and health

The status projection may expose:

- configuration, build, lock, boot, process-session, and activation
  fingerprints;
- process state and process start time;
- Pilot state and remaining activation time;
- task counts by state and lane;
- budget totals and remaining capacity;
- current lease age and sanitized attempt state;
- last successful receipt/commit times;
- clock status and offset;
- outbox backlog;
- recovery, integrity, and blocker codes;
- stop-barrier state;
- coverage and missed-event counts.

It may not expose:

- raw payload, URL query, header, cookie, token, secret, verifier data;
- account, Portfolio, P&L, position, probability, recommendation, or order data;
- provider narrative or arbitrary exception stacks.

“Healthy” requires all safety gates to be current. A process that cannot verify
the lock, clock, store, session, or Stop state is not healthy.

## Outbox and T1/T2 evidence integration

SQLite committed source snapshots remain authoritative Runner evidence.
Outbox records are notifications, not the evidence source of truth.

A later integration consumer may:

1. read undelivered sanitized outbox identities;
2. load the exact normalized source snapshot through a reviewed read port;
3. wait until all required independent source lanes are present;
4. construct a candidate Day15-T1 observation through the existing engine;
5. append through the Day15-T2 idempotent ledger boundary;
6. record a durable delivery/inbox result only after target acceptance.

Because SQLite and the existing ledger do not share one transaction, the
consumer must be replayable and target writes must be idempotent. A crash
between target append and delivery marking may replay; it may not duplicate or
overwrite evidence.

An exchange-only snapshot cannot be converted into a complete T1 observation.
Missing platform quote or fee evidence remains missing.

T3B11-T1 does not implement this consumer or add a new schema.

## Provider-composition boundary

The first runtime composition is an injected fixture adapter with:

- one exact provider descriptor;
- one exact mapping where required;
- one exact capability;
- one exact source-record identity;
- fixed byte, record, timeout, and attempt limits;
- no network transport.

A later bounded-live composition requires:

- an Owner-reviewed finite set of exact future native market identities;
- official source and terms evidence for each mapping;
- an endpoint policy that cannot discover or substitute another market;
- a separate one-shot smoke review for the new request shape;
- a platform-evidence operating plan;
- independent Owner approval.

The current historical hard-coded Kalshi smoke transport cannot be reused as a
generic runtime provider.

## Failure and recovery matrix

| Failure | Immediate action | Durable result |
| --- | --- | --- |
| Duplicate runtime | Second lock acquisition fails | No store mutation |
| Configuration drift | Fail before store mutation | Existing evidence unchanged |
| Lock loss | Trip barrier and terminate | Recovery blocker |
| Clock unhealthy/stale | Emergency Stop or fail closed | Stop/control evidence when writable |
| Crash before lease | No task mutation | Task remains eligible |
| Crash after lease, before attempt | Preserve lease | Recovery reconciliation |
| Crash after attempt claim | Preserve unknown request outcome | No automatic retry |
| Crash during validation | Raw body discarded | Durable attempt remains unresolved |
| Crash after evidence commit | Committed evidence remains valid | Idempotent replay reads original |
| SQLite write failure | Trip barrier and terminate | Ambiguity remains |
| Provider timeout | Cancel, classify, persist exact outcome if possible | Bounded retry only if eligible |
| Stop before lease | No lease may commit | Stop wins |
| Stop after lease | No request claim may start | Named cancellation/reconciliation |
| Stop after attempt | Cancel without assuming success | No retry until reconciled |
| Status/output failure | Never report healthy | Runtime may continue only if safety policy permits |
| Disk full | Trip barrier, stop acquisition, terminate | Recovery blocker |
| OS suspend/resume | Re-probe boot and clock before work | Fail closed on uncertainty |

## Threat model

### In scope

- duplicate local processes;
- stale or replaced lock records;
- PID reuse;
- configuration tampering and unknown fields;
- symlink, traversal, UNC, and store-path substitution;
- stale process sessions;
- restored-store or schema identity changes;
- wall-clock jump, drift, stale health, and suspend/resume;
- stop/resume and stop/commit races;
- process crash at every repository boundary;
- SQLite busy, rollback, corruption, disk-full, and write failure;
- provider identity, mapping, schema, chronology, size, and fingerprint drift;
- oversized or malformed fixture/provider responses;
- unbounded retry, timer, memory, and status output;
- secret and raw-payload leakage;
- unauthorized lifecycle commands;
- accidental expansion into discovery, Portfolio, recommendation, or trading
  authority.

### Deferred

- hostile multi-user operating-system security;
- malware or an administrator controlling the machine;
- distributed or multi-host coordination;
- remote authentication;
- hardware-backed Owner identity;
- encrypted commercial credential storage;
- production database high availability;
- external monitoring and paging.

Deferred threats block commercial claims but do not weaken the local
single-owner research-pilot boundary.

## Implementation sequence

T3B11 remains separately gated:

1. **T3B11-T1 — Runtime architecture and threat model:** this document only.
2. **T3B11-T2 — Runtime foundation:** implemented locally and pending Owner
   review; immutable configuration, path controls, process ownership,
   boot/process identity, clocks, and network-free tests.
3. **T3B11-T3 — Fixture scheduler and Worker:** pure planner, one acquisition
   cycle, fixture adapter, cancellation, and repository composition.
4. **T3B11-T4 — Operator and health surface:** preflight, status, graceful stop,
   Emergency Stop notification, lock recovery, and outbox projection.
5. **T3B11-T5 — Process drills:** duplicate process, forced child-process exit,
   timeout, cutoff, stop, restart, and replay tests.
6. **T3B11-MR1 — Fixture runtime milestone review.**
7. **Later separately approved work:** exact future-market provider admission
   and bounded-live Shadow Pilot.

No task inherits approval from the previous task.

## T3B11-T2 acceptance requirements

Before T3B11-T2 implementation begins, Owner review must approve:

- exact runtime configuration schema;
- concrete single-instance lock and stale-lock policy;
- boot-identity and process-liveness ports;
- process-session derivation;
- wall/monotonic/clock-health ports;
- path and local-control roots;
- fixture-only enforcement;
- test matrix and prohibited scope.

T3B11-T2 must still start no scheduler, Worker, adapter, timer, provider request,
or Pilot.

## T3B11 milestone acceptance criteria

The fixture runtime milestone may pass only when:

- one process owns one exact store/Pilot configuration;
- duplicate processes fail before mutation;
- process identity cannot be caller-selected or reused after restart;
- all scheduling inputs and outputs are deterministic;
- wall, monotonic, and clock-health authority remain separate;
- every Worker write uses the session gate;
- Stop is effective even when SQLite or process notification fails;
- fixture-only mode cannot instantiate a network transport;
- task retries, cutoffs, deadlines, and budgets remain fail closed;
- raw provider data and secrets never persist;
- status cannot claim health without current safety evidence;
- process-kill drills preserve ambiguity and immutable evidence;
- exchange-only evidence cannot claim complete T1/T2 readiness;
- the complete validation bundle passes;
- a separate Owner review approves any later bounded-live work.

## Explicit exclusions

T3B11-T1 and T3B11-T2 add no:

- operational runtime composition;
- SQLite schema or repository mutation;
- package dependency;
- executable command;
- stale-lock recovery or automatic lock takeover;
- production synchronized-clock source;
- scheduler, Worker, timer, loop, daemon, or service;
- provider adapter or network request;
- market discovery;
- Pilot creation, activation, or Resume;
- Robinhood automation;
- T1/T2 evidence assembly;
- probability, calibration, recommendation, sizing, Portfolio, broker, order, or
  execution behavior.

## Related documents

- [Runner Milestone Review](../EVENT_CONTRACT_COLLECTION_RUNNER_MILESTONE_REVIEW.md)
- [Runner Architecture](EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md)
- [Runner Contracts](EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md)
- [SQLite Repository](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_REPOSITORY.md)
- [SQLite Recovery](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_RECOVERY.md)
- [Recovery Control](EVENT_CONTRACT_COLLECTION_RUNNER_RECOVERY_CONTROL.md)
- [Source Architecture](EVENT_CONTRACT_COLLECTION_SOURCE_ARCHITECTURE.md)
