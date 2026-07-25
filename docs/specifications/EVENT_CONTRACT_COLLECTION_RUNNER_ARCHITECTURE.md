# Event Contract Collection Runner Architecture v1

## Status

Day15-T3B9 specifies the deterministic architecture required before Alpha may implement a continuously operating event-contract evidence collector.

This task is architecture only. It adds no scheduler, worker, retry loop, database, provider request, market discovery, persistence, background process, probability model, recommendation, broker, order, or execution behavior.

## Purpose

The runner must make bounded forward research collection operationally credible without weakening the existing source-authority and research-integrity gates.

It coordinates when an already admitted source may be read and how validated evidence would be committed. It does not decide what to trade, select an opportunity, infer missing evidence, repair failed samples, or change a strategy.

## Governing principles

1. No collection without a prospectively frozen plan.
2. No exchange collection without an exact eligible platform-to-exchange mapping.
3. No source may inherit another source's identity, time, fee, quote, or authority.
4. No missed pre-event evidence may be backfilled after its availability cutoff.
5. Transport delivery may be at least once; committed evidence must be idempotent.
6. A worker lease is execution coordination, not capital or trading authority.
7. Raw provider bodies remain in-memory only and are discarded after validation.
8. A runner failure must reduce dataset coverage, never fabricate a successful sample.

## Current feasibility boundary

The approved Kalshi public source can provide exchange-native market and settlement evidence. It cannot prove:

- the contemporaneous Robinhood-displayed bid or ask;
- a Robinhood order preview or platform/exchange fee amount;
- that a future Robinhood contract uses a particular exchange without exact contract evidence;
- the platform observation time for facts not exposed by the approved public page.

Therefore, an automated Kalshi lane alone cannot create a complete Day15-T1 observation or a qualified Day15-T3B dataset. T3B9 must preserve two independent lanes:

```text
Exchange lane
  -> exact mapped public exchange source
  -> exchange-native quote/terms/settlement evidence
  -> source snapshot

Platform lane
  -> approved Robinhood public source or reviewed operator evidence
  -> Robinhood quote and fee-preview evidence
  -> platform source snapshot

Both complete and temporally eligible
  -> separate canonical observation assembly task
  -> Day15-T1 validation
  -> Day15-T2 append-only shadow ledger
```

No platform source is currently approved for automatic quote or fee capture. Until that changes, the platform lane remains manual and incomplete by design.

## Authority model

### Owner

The owner alone may:

- approve a runner implementation milestone;
- activate a frozen pilot plan;
- set the pilot start and terminal stop time;
- authorize an admitted provider and mapping set;
- stop or revoke the pilot;
- approve movement from T3B9 architecture to T3B10 pilot.

### Collection Control

The existing Forward Shadow Collection Control remains authoritative for planned event identities and cutoffs. The runner may read an immutable frozen plan; it cannot create, extend, repair, or replace one.

### Admission Gate

For every scheduled source task, the gate requires an immutable admission bundle containing:

- frozen plan ID and fingerprint;
- exact planned-event ID and evidence cutoff;
- provider ID and fingerprint;
- capability and execution mode;
- exact reviewed mapping ID, version, and fingerprint when exchange-authoritative;
- provider-native source-record identity;
- endpoint/request-template policy ID and version;
- source-specific maximum attempts, bytes, records, and deadline;
- owner-approved pilot activation ID and expiry.

Missing, stale, superseded, inactive, mismatched, or expired authority blocks the task before transport.

### Runner

The runner owns only orchestration state:

- determine which admitted task is due;
- acquire one bounded worker lease;
- invoke one admitted read-only adapter;
- validate the result;
- atomically commit normalized evidence and attempt history;
- emit sanitized health and audit events.

It cannot select a side, calculate probability or expected value, size capital, read portfolio state, mutate a strategy, submit an order, or invoke a brokerage interface.

## Immutable runner records

### Runner Definition

One versioned definition declares:

- stable runner identity and schema version;
- supported source capabilities;
- hard concurrency and rate ceilings;
- clock-health policy;
- lease and recovery policy;
- retry classifier and backoff policy;
- retention and redaction policy;
- monitoring and alert policy;
- implementation build fingerprint.

### Pilot Activation

An activation binds:

- owner identity and approval time;
- frozen collection-plan fingerprint;
- runner-definition fingerprint;
- admitted provider and mapping fingerprints;
- UTC start and stop times;
- event and request budgets;
- emergency-stop state.

Activation is immutable. Extension requires a new activation.

### Scheduled Source Task

Each task binds one planned event, one source, one capability, one provider-native record, and one cutoff/deadline. Its idempotency key is:

```text
plan fingerprint
+ planned-event ID
+ provider fingerprint
+ mapping fingerprint or NONE
+ capability
+ source-record ID
+ observation slot
+ runner-definition version
```

### Attempt Record

Every attempt appends:

- task and lease identity;
- attempt number;
- scheduled, started, finished, receipt, and normalization times;
- sanitized outcome code;
- request, byte, and record budget consumption;
- retry classification;
- adapter and policy versions;
- response fingerprint when a body was received;
- normalized snapshot fingerprint when accepted.

It contains no raw response, URL query, header, credential, provider narrative, portfolio data, or trading instruction.

### Commit Record

One accepted source snapshot is committed once per task idempotency key. A conflicting fingerprint is a terminal integrity incident, never an overwrite.

## State machines

### Pilot

```text
DRAFT
  -> OWNER_APPROVED
  -> ACTIVE
  -> STOP_REQUESTED
  -> STOPPED

OWNER_APPROVED or ACTIVE
  -> REVOKED

ACTIVE
  -> COMPLETED
  -> FAILED_CLOSED
```

There is no automatic restart from a terminal state.

### Scheduled source task

```text
SCHEDULED
  -> BLOCKED
  -> DUE
  -> LEASED
  -> IN_FLIGHT
  -> VALIDATING
  -> COMMITTED

IN_FLIGHT or VALIDATING
  -> RETRY_WAIT
  -> DUE

SCHEDULED, DUE, RETRY_WAIT, or leased recovery
  -> MISSED
  -> TERMINAL_FAILED
  -> CANCELLED
```

`COMMITTED`, `MISSED`, `TERMINAL_FAILED`, and `CANCELLED` are terminal. State transitions are append-only and compare expected aggregate versions.

## Scheduling and clock policy

The runner uses two injected clocks:

- canonical UTC wall clock for evidence chronology and deadlines;
- monotonic elapsed-time clock for timeout, lease, and latency measurement.

Before activation and every acquisition cycle, a clock-health port reports OS synchronization status and estimated UTC offset. Pre-event evidence acquisition fails closed when absolute offset exceeds one second or health is unavailable.

Tasks are created only from the complete frozen plan before activation. The runner performs no dynamic event discovery. Wake-up timing may be operationally imprecise, but evidence eligibility is determined only from recorded source availability, receipt time, and cutoff—not from intended schedule time.

Missed pre-event observation slots become `MISSED`. They are never reconstructed from later quotes, candlesticks, screenshots, or final outcomes. Settlement tasks may have a separate post-event deadline because settlement is inherently outcome-bearing and cannot enter pre-event features.

## Concurrency, leases, and shutdown

The initial architecture permits:

- one active pilot;
- one worker process;
- one in-flight request;
- one provider request per second;
- no parallel task for the same idempotency key.

A durable lease has owner, acquired, expires, and heartbeat times plus an aggregate version. Expired leases may be recovered only after transport timeout plus a safety margin. Recovery appends a new attempt; it does not delete or rewrite the abandoned attempt.

Graceful shutdown stops new leases, cancels the current transport, records the outcome, flushes the current transaction, and terminates. Emergency stop sets the pilot to `STOP_REQUESTED` before cancellation. Startup never silently resumes an expired or revoked activation.

## Retry policy

The hard architecture ceiling is two total attempts per task: the initial attempt plus one retry.

Retryable:

- timeout;
- connection failure;
- HTTP `429`;
- HTTP `500` through `599`;
- worker crash with an expired lease and no committed evidence.

Never retryable:

- mapping, identity, terms, chronology, schema, fingerprint, or unknown-field failure;
- HTTP `400`, `401`, `403`, or `404`;
- unapproved host, method, path, query, market, credential, or capability;
- response over byte or record limits;
- revoked/expired activation;
- evidence cutoff or task deadline exceeded;
- conflicting committed fingerprint.

Backoff is bounded and recorded. It must not cross an evidence cutoff or terminal deadline. The runner never converts a non-retryable error into a retry by string matching a provider message.

## Storage architecture

### Local pilot store

T3B10 should use a local single-host SQLite store in WAL mode, not the existing NDJSON repositories, because the runner requires:

- transactions across task state, attempt history, evidence commit, and outbox records;
- unique idempotency constraints;
- compare-and-swap aggregate versions;
- durable leases and crash recovery;
- deterministic migrations and integrity checks.

This is a pilot storage decision, not a production or commercial database claim.

### Atomic commit

One transaction must:

1. verify active pilot, task, lease, expected versions, and unspent budgets;
2. append the completed attempt;
3. insert the normalized source snapshot under a unique idempotency key;
4. transition the task to `COMMITTED`;
5. increment counters;
6. append a sanitized audit/outbox event.

Any failure rolls back the whole transaction. Raw provider bodies are never inserted.

### Repository boundaries

Separate ports own:

- runner definitions and activations;
- scheduled tasks and transitions;
- leases;
- attempts;
- normalized source evidence;
- budget counters;
- transactional outbox;
- health read models.

Adapters and transports receive no repository handle. They return results to the orchestrator, which performs the single atomic commit.

## Recovery and integrity

On startup, the recovery service:

1. validates schema migration and database integrity;
2. reconstructs the active activation and aggregate versions;
3. verifies frozen-plan, provider, mapping, runner, and policy fingerprints;
4. reconciles expired leases;
5. recomputes budget counters from append-only attempts;
6. detects committed evidence without terminal tasks or terminal tasks without evidence;
7. blocks operation on any conflict;
8. requires explicit operator resume when recovery changes task eligibility.

The service never repairs evidence content, changes timestamps, substitutes provider identities, or marks a missed task successful.

## Monitoring and audit

The health surface exposes only:

- pilot state and remaining time;
- task counts by state and capability;
- request, byte, record, and retry budgets used;
- last successful receipt and commit times;
- clock health and offset;
- current lease age;
- consecutive failure count;
- coverage and missed-event ratios;
- sanitized blocker codes;
- outbox backlog and database integrity state.

Alerts are required for:

- clock unhealthy or offset above one second;
- activation near expiry;
- repeated provider failure;
- any mapping/schema/fingerprint conflict;
- missed pre-event evidence;
- budget exhaustion;
- expired lease;
- outbox backlog;
- database integrity failure;
- emergency stop.

Monitoring has no raw payload, secret, recommendation, predicted probability, P&L, or execution action.

## T3B10 pilot admission requirements

T3B10 remains blocked until implementation tasks separately deliver and validate:

1. provider-neutral runner contracts and state validation;
2. SQLite schema, migrations, transaction tests, backup, restore, and corruption drills;
3. deterministic scheduler, injected clocks, lease manager, retry classifier, and budget governor;
4. one adapter composition with no market discovery;
5. sanitized monitoring and operator stop/resume commands;
6. network-free crash, replay, duplicate, timeout, cutoff, and recovery tests;
7. owner-selected frozen plan and explicit activation;
8. a platform-evidence operating plan that acknowledges current manual gaps.

The first pilot must be short, shadow-only, single-host, and independently reviewed before extension.

## Explicit exclusions

T3B9 does not authorize:

- implementation or execution of the runner;
- dynamic Robinhood or Kalshi market discovery;
- undocumented Robinhood interfaces, authenticated brokerage sessions, or scraping;
- automatic mapping approval;
- automated Robinhood quote or fee capture;
- backfilling missed pre-event evidence;
- raw-response persistence;
- more than one worker, provider, or active pilot;
- streaming or WebSocket transport;
- AI, probability research, backtesting, recommendation, ranking, sizing, portfolio mutation, broker, order, or execution.

## Acceptance criteria

- authority, identity, and source lanes remain separate;
- task, pilot, attempt, lease, and commit state machines are explicit;
- cutoffs, clock health, retryability, budgets, and missed-event behavior fail closed;
- persistence has transactional idempotency and crash-recovery design;
- no raw provider payload or trading authority crosses the boundary;
- the automatic-platform-evidence gap remains visible;
- T3B10 has explicit prerequisites and a separate owner approval gate;
- architecture, roadmap, decisions, changelog, handoff, and validation agree.

## Related specifications

- [Event Contract Collection Source Architecture](EVENT_CONTRACT_COLLECTION_SOURCE_ARCHITECTURE.md)
- [Event Contract Source Contracts](EVENT_CONTRACT_SOURCE_CONTRACTS.md)
- [Forward Shadow Collection Control](FORWARD_SHADOW_COLLECTION_CONTROL.md)
- [Forward Shadow Collection Operator](FORWARD_SHADOW_COLLECTION_OPERATOR.md)
- [Kalshi Event Contract Bounded Live-Read Smoke](KALSHI_EVENT_CONTRACT_LIVE_SMOKE.md)
- [Research Integrity](RESEARCH_INTEGRITY.md)
- [Research Dataset Qualification](RESEARCH_DATASET_QUALIFICATION.md)
