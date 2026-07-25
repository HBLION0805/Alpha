# Event Contract Collection Runner Milestone Review

## Review identity

- Review: `Day15-T3B10-MR1`
- Review date: `2026-07-25`
- Reviewed baseline: `1b7e9744189cd5028a8cae13bc057954648bbb27`
- Registered validation baseline: `1993/1993`
- Scope: Day15-T3B9 through Day15-T3B10-T4D
- Authority: architecture and readiness review only

## Executive decision

The Event Contract Collection Runner foundation is ready to enter a separately
reviewed **Shadow Pilot Runtime Architecture** task.

It is **not ready to start a fixture worker, continuous runner, or bounded-live
Shadow Pilot**.

This is a split decision:

- `GO_FOR_DESIGN`: Alpha may specify the next runtime composition and operator
  boundary.
- `NO_GO_FOR_OPERATION`: Alpha may not yet schedule work, invoke a provider,
  activate a Pilot, or continuously collect evidence.

The implemented foundation has strong authority, transaction, recovery, and
Emergency Stop behavior. The remaining blockers are concentrated in the
runtime composition and source-operating layers rather than the SQLite state
machine.

## Evidence reviewed

The review inspected:

- runner architecture and provider-neutral contracts;
- exact Pilot and task state validation;
- SQLite migrations and schema identity;
- named atomic repository transactions;
- startup recovery, backup, restore, and corruption drills;
- Owner Resume and Emergency Stop contracts;
- authenticated local Owner command and process-session repository gate;
- stop/resume ordering, crash/restart, and transaction-failure drills;
- registered validation, provider/network restrictions, and current commands.

## Readiness matrix

| Gate | Status | Evidence | Decision |
| --- | --- | --- | --- |
| Authority and immutable admission | PASS | Frozen plan, owner activation, provider/mapping fingerprints, closed state machines | Retain |
| Transactional idempotency | PASS | Named SQLite transactions, compare-and-swap versions, unique identities, atomic evidence/outbox commit | Retain |
| Budget and attempt enforcement | PASS | Durable counters, maximum two attempts, rollback tests | Retain |
| Startup recovery and integrity | PASS | Mutation-blocking recovery report, backup/restore, corruption drills | Retain |
| Owner Resume and Emergency Stop | PASS | One-time session authorization, authenticated local command, per-write gate, stop barrier | Retain |
| Race and crash evidence | PASS FOR FOUNDATION | Both durable orderings, restart invalidation, injected rollback and stop-persistence failure | Add later OS-process drills |
| Runtime process ownership | BLOCKED | No reviewed single-instance process lock or runtime identity issuer | T3B11-T1/T2 |
| Scheduler, clocks, leases, and worker | BLOCKED | Contracts exist; no runtime composition or acquisition loop exists | T3B11-T1/T3 |
| Operator lifecycle surface | BLOCKED | Recovery `owner-decision` exists; ordinary start, status, graceful stop, and direct Emergency Stop commands do not | T3B11-T1/T4 |
| Provider composition | BLOCKED | Current public Kalshi transport is fixed to one historical market | New exact bounded provider policy required |
| Platform evidence lane | BLOCKED | No approved automatic Robinhood quote or fee-preview source | Manual-gap plan required |
| Observation and ledger integration | BLOCKED | Source snapshots can be stored, but no reviewed runner-to-T1/T2 assembly path exists | Separate integration task |
| Monitoring and outbox consumption | BLOCKED | Durable outbox exists; no health projection, publisher, or operator alert surface exists | T3B11-T1/T4 |
| Commercial operation | BLOCKED | Local SQLite and local verifier are research-pilot infrastructure only | Separate commercial review |

## Findings

### High — There is no runtime authority owner

The repository can enforce a supplied process session, but Alpha has no
reviewed process that exclusively owns:

- the application runtime store;
- the boot and process-session identity;
- the process-local stop barrier;
- the one active Pilot;
- the injected wall and monotonic clocks;
- shutdown and restart sequencing.

Starting a worker before this boundary exists would distribute authority across
ad hoc command code.

### High — Single-host does not yet mean single-process

The architecture permits one worker, but no process lock or equivalent
single-instance mechanism prevents two local processes from attempting to own
the same Pilot. SQLite serializes transactions, but it does not by itself
define which process is the authorized runtime owner.

### High — Current provider capability cannot operate a future plan

The reviewed Kalshi HTTPS transport is intentionally fixed to
`KXBTC15M-26JUL232045-45`. It proves one bounded public request and cannot read
arbitrary future plan records. Dynamic discovery remains prohibited.

A future provider boundary must therefore consume only an owner-reviewed,
finite set of exact native market identities. It must not widen the current
transport into unrestricted market discovery.

### High — Complete T1/T2 evidence remains unavailable automatically

Kalshi may supply exchange-native evidence, but it cannot supply the
Robinhood-displayed quote or fee preview required by the current observation
contract. No approved automatic Robinhood platform source exists.

The first pilot must either:

- remain an exchange-lane infrastructure rehearsal that makes no dataset
  qualification claim; or
- use a separately reviewed manual platform-evidence procedure.

### Medium — Operator control is recovery-focused, not Pilot-focused

The current local command authenticates recovery decisions. It does not provide
a complete ordinary lifecycle surface for:

- preflight;
- activate;
- status;
- graceful stop;
- direct Emergency Stop;
- terminal completion report.

These commands must share one exact runtime configuration and must not gain
provider, model, or trading authority.

### Medium — Durable outbox evidence has no consumer

Transactions append sanitized outbox records, but no read model or publisher
turns them into operator health, alerts, or the later T1/T2 assembly workflow.
The first implementation should be read-only and local; external messaging is
not required for a research pilot.

### Medium — Fault drills do not simulate an operating-system kill

T4D proves transaction ordering and fail-closed restart behavior with two SQLite
connections, injected transaction failure, and close/reopen. It does not yet
kill a live child process between lease, attempt, validation, and evidence
commit boundaries.

That test belongs after a fixture-only worker exists.

## Required next architecture task

The next task is:

`Day15-T3B11-T1 — Shadow Pilot Runtime Architecture`

It must specify, without starting a runtime:

1. one local process owner and one non-blocking single-instance lock;
2. immutable runtime configuration and build identity;
3. injected wall clock, monotonic clock, and clock-health port;
4. deterministic scheduler and one-worker acquisition cycle;
5. fixture-only provider composition before any bounded-live composition;
6. exact startup, preflight, activation, graceful stop, Emergency Stop, and
   shutdown ordering;
7. local sanitized status and outbox read models;
8. runner-source-snapshot to T1/T2 integration ownership;
9. network-free child-process crash and duplicate-runtime test plan;
10. separate Owner gates for fixture rehearsal and bounded-live operation.

## Proposed implementation sequence

1. `T3B11-T1` — runtime architecture and threat model; design only.
2. `T3B11-T2` — immutable runtime configuration, process ownership, clocks, and
   single-instance lock; network-free.
3. `T3B11-T3` — deterministic scheduler and fixture-only worker composition;
   no real provider.
4. `T3B11-T4` — local preflight/status/stop surface and sanitized health/outbox
   projection.
5. `T3B11-T5` — child-process crash, duplicate-runtime, cutoff, timeout, and
   graceful/Emergency Stop drills.
6. `T3B11-MR1` — independent fixture-runtime milestone review.
7. Later separately approved work — exact future-market provider admission and
   a bounded-live Shadow Pilot.

## Explicitly prohibited after this review

This review does not authorize:

- scheduler or worker startup;
- a background service or continuous loop;
- a real provider request;
- dynamic market discovery;
- automatic Robinhood access;
- a real Pilot activation;
- probability research or dataset qualification;
- recommendation, sizing, portfolio mutation, broker, order, or execution
  behavior.

## Owner review recommendation

Approve this milestone as:

`FOUNDATION_ACCEPTED / RUNTIME_DESIGN_ONLY`

Then begin `Day15-T3B11-T1`. Do not combine design approval with fixture-worker
implementation or bounded-live authorization.
