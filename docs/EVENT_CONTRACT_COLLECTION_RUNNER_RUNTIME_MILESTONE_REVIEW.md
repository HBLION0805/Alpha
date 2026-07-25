# Event Contract Collection Runner Runtime Milestone Review

## Review identity

- Review: `Day15-T3B11-MR1`
- Review date: `2026-07-25`
- Reviewed baseline: `c72a90c672c2297d381cf76238e642034c419f83`
- Registered validation baseline: `2065/2065`
- Focused runtime validation: `78/78`
- Scope: Day15-T3B11-T1 through Day15-T3B11-T5
- Authority: architecture and readiness review only

## Executive decision

The T3B11 fixture-runtime foundation is accepted.

It is not ready to start a fixture runtime, continuous runner, provider
composition, or bounded-live Shadow Pilot.

This is a split decision:

- `FIXTURE_RUNTIME_FOUNDATION_ACCEPTED`: immutable configuration, process
  ownership, clocks, deterministic scheduling, one-cycle fixture Worker,
  Operator/Health, Stop, and initial process drills are accepted as reusable
  foundations.
- `GO_FOR_ASSEMBLY_DESIGN`: Alpha may specify the missing foreground runtime
  assembly and recovery procedure in a separately reviewed design task.
- `NO_GO_FOR_RUNTIME_START`: Alpha may not add or invoke a start command,
  polling loop, timer-driven scheduler, or background service.
- `NO_GO_FOR_BOUNDED_LIVE`: Alpha may not invoke a network provider, activate a
  real Pilot, or claim dataset readiness.

The review found no authority escalation, provider transport, model,
recommendation, portfolio, broker, order, or execution path in T3B11.

## Evidence reviewed

The review inspected:

- the T3B11 runtime architecture and threat model;
- strict fixture-only runtime configuration and canonical local paths;
- atomic single-instance lock ownership and immutable Owner evidence;
- boot, process-session, liveness, wall-clock, monotonic-clock, and
  clock-health boundaries;
- the pure deterministic scheduler and explicit one-cycle fixture Worker;
- recovery-session-gated T7, T8, T8B, T9, and T10 writes;
- bounded retry, cancellation, cutoff, deadline, budget, and ambiguity rules;
- deterministic Preflight, Status, Health, and payload-free Outbox projection;
- authenticated graceful and Emergency Stop behavior;
- duplicate-process, forced-exit, stale-lock restart, timeout, cutoff/deadline,
  Stop, health, and replay drills;
- all T3B11 exports and package commands;
- registered provider, network, credential, scope, and validation checks.

## Readiness matrix

| Gate | Status | Evidence | Decision |
| --- | --- | --- | --- |
| Immutable runtime configuration | PASS | Strict `FIXTURE_ONLY` schema, fingerprints, bounded roots, exact store and activation identity | Retain |
| Single-process ownership | PASS | Atomic lock directory, immutable owner record, duplicate rejection, verified release | Retain |
| Process and clock identity | PASS | OS-CSPRNG process nonce, boot/liveness ports, separate wall/monotonic/health clocks | Retain |
| Deterministic scheduler | PASS | Closed snapshot, stable ordering, one action, no hidden clock or repository access | Retain |
| Fixture-only Worker | PASS AS PRIMITIVE | One caller-invoked cycle, exact adapter binding, session-gated named transactions | Do not start |
| Retry, cutoff, deadline, and budget | PASS | Fail-closed planner/Worker tests and process-drill boundary tests | Retain |
| Owner Stop | PASS | Exact local authentication, irreversible barrier, durable graceful/Emergency adapters, replay checks | Retain |
| Preflight, Status, and Health | PASS AS PROGRAMMATIC SURFACE | Closed deterministic reports and bounded payload-free SQLite projection | No command authority |
| Duplicate and stale-lock behavior | PASS | Real child process, immutable lock evidence, fail-closed restart | No automatic takeover |
| Process-kill transaction coverage | PARTIAL | Ownership-process kill is real; lease/attempt/validation/commit kill points remain simulated or unit-level | Block runtime start |
| Runtime bootstrap and shutdown | BLOCKED | No reviewed composition opens the store, performs recovery, binds the session, starts one cycle, and shuts down | Assembly design required |
| Durable due transition | BLOCKED | Scheduler intentionally cannot execute T6 for `SCHEDULED` or `RETRY_WAIT` tasks | Assembly design required |
| Stale-lock recovery procedure | BLOCKED | Stale locks fail closed; no authenticated inspection/removal or takeover procedure exists | Recovery design required |
| Outbox delivery and T1/T2 assembly | BLOCKED | Read-only projection exists; no idempotent consumer or complete observation assembly exists | Separate integration task |
| Future provider composition | BLOCKED | Fixture Worker cannot instantiate a network transport; historical Kalshi smoke identity is not a future plan | Separate admission review |
| Robinhood platform evidence | BLOCKED | No approved automatic quote or fee-preview source | Manual-gap/source review |
| Commercial operation | BLOCKED | Local SQLite, local verifier, and single-host process controls remain research infrastructure | Separate commercial review |

## T3B11 acceptance assessment

| Acceptance criterion | Result |
| --- | --- |
| One process owns one exact store/Pilot configuration | PASS |
| Duplicate processes fail before mutation | PASS |
| Process identity is not caller-selected or reused after restart | PASS |
| Scheduling inputs and outputs are deterministic | PASS |
| Wall, monotonic, and clock-health authority remain separate | PASS |
| Every Worker write uses the recovery-session gate | PASS |
| Stop remains effective when persistence or notification fails | PASS |
| Fixture-only mode cannot instantiate a network transport | PASS |
| Retries, cutoffs, deadlines, and budgets fail closed | PASS |
| Raw provider data and secrets do not persist through the runtime surface | PASS |
| Status cannot claim health without current safety evidence | PASS |
| Process-kill drills preserve ambiguity and immutable evidence | PARTIAL |
| Exchange-only evidence cannot claim complete T1/T2 readiness | PASS |
| Complete registered validation passes | PASS |
| Later bounded-live work requires separate Owner approval | PASS |

The partial process-kill criterion does not invalidate the reusable foundation,
but it blocks runtime-start authorization.

## Findings

### High — The components are not assembled into one startable runtime

T3B11 intentionally exposes no command or composition root that performs the
complete sequence:

1. validate immutable configuration;
2. acquire ownership;
3. open and verify SQLite;
4. inspect startup recovery;
5. bind a new authorized process session;
6. produce a ready Preflight report;
7. perform an exact T6 due transition where required;
8. select and execute at most one fixture cycle;
9. honor Stop and shutdown timeout;
10. close resources and release only verified clean ownership.

Starting from ad hoc caller code would bypass the reviewed authority ordering.

### High — T6 due-transition ownership is unresolved

The scheduler correctly refuses to acquire `SCHEDULED` and `RETRY_WAIT` tasks.
The existing repository has a T6 transition, but no reviewed runtime component
owns the decision and transaction that materialize `DUE`.

Without this composition, a future loop could either stall permanently or
invent an unauthorized transition.

### High — Real process-kill coverage stops at ownership

T5 proves real duplicate ownership, forced owner exit, immutable stale-lock
evidence, and fail-closed restart. Existing Worker tests preserve ambiguity
through injected failures, but no operating-system child process is killed:

- after lease acquisition;
- after attempt claim;
- during validation;
- after evidence commit but before subsequent acknowledgement.

Those drills require a reviewed foreground composition and real SQLite fixture
store. They must pass before runtime start.

### High — Stale-lock recovery has no authenticated operating procedure

Automatic takeover is correctly prohibited. However, there is no exact local
Owner command that binds process liveness, boot identity, store integrity,
recovery assessment, lock evidence, and a one-time decision before removing or
superseding stale ownership.

Manual filesystem deletion is not an acceptable operating procedure.

### High — No future-market provider or complete platform evidence exists

The fixture Worker has no network authority. The existing Kalshi live-smoke
transport is fixed to one historical market and cannot supply a future plan.
Kalshi evidence also cannot supply the Robinhood quote and fee preview required
for a complete T1 observation.

This blocks bounded-live operation and dataset qualification independently of
runtime assembly.

### Medium — Operator surfaces are programmatic, not an executable lifecycle

Preflight, Status, Health, and Stop logic are deterministic and reusable, but
there is no reviewed local command for the complete lifecycle. T4 does not
authorize a control server, runtime start, automatic activation, or terminal
completion report.

### Medium — Outbox projection is not evidence integration

The projection exposes bounded sanitized identities and chronology only. It
does not deliver Outbox records or assemble T1/T2 observations. Because SQLite
and the shadow ledger do not share a transaction, any later consumer must be
idempotent and replayable.

## Required next design task

The recommended next task is:

`Day15-T3B12-T1 — Fixture Runtime Assembly and Recovery Architecture`

It must be design-only and specify:

1. one foreground composition root and exact startup/shutdown ordering;
2. one explicit local lifecycle command set with no remote server;
3. deterministic ownership of the existing T6 due transition;
4. exact Preflight-to-one-cycle authority binding;
5. graceful and Emergency Stop race behavior and shutdown timeout;
6. authenticated stale-lock inspection and recovery without automatic takeover;
7. real child-process crash points backed by a fixture SQLite store;
8. exact cleanup, restart, replay, and terminal-report evidence;
9. fixture-only enforcement with no network transport construction;
10. separate Owner gates for implementation, fixture rehearsal, provider
    admission, and bounded-live operation.

## Explicitly prohibited after this review

This review does not authorize:

- a runtime start command or background runner;
- a timer, polling loop, daemon, service, or remote-control endpoint;
- automatic stale-lock deletion or takeover;
- a provider request or dynamic market discovery;
- automatic Robinhood access;
- a real Pilot activation;
- Outbox delivery or T1/T2 dataset qualification;
- probability research, recommendation, sizing, portfolio mutation, broker,
  order, or execution behavior.

## Owner review recommendation

Approve T3B11-MR1 as:

`FIXTURE_RUNTIME_FOUNDATION_ACCEPTED / GO_FOR_ASSEMBLY_DESIGN / NO_GO_FOR_RUNTIME_START / NO_GO_FOR_BOUNDED_LIVE`

Then begin `Day15-T3B12-T1` as a design-only task. Do not combine its design
approval with implementation, fixture rehearsal, provider admission, or live
operation.
