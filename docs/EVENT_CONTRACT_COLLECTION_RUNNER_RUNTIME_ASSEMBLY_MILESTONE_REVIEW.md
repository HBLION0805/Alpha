# Event Contract Collection Runner Runtime Assembly Milestone Review

## Review identity

- Review: `Day15-T3B12-MR1`
- Review date: `2026-07-25`
- Reviewed baseline: `54a5c05ac912f6a2919d8b7dffa5280578b99c5d`
- Registered validation baseline: `2166/2166`
- Focused T3B12 validation: `101/101`
- Scope: Day15-T3B12-T1 through Day15-T3B12-T5
- Authority: architecture and readiness review only

## Executive decision

The T3B12 fixture runtime assembly and recovery foundation is accepted.

It is ready for a separately reviewed **fixture-rehearsal architecture** task.
It is not ready for an executable runtime command, continuous operation,
network-provider use, or a bounded-live Shadow Pilot.

This is a split decision:

- `ASSEMBLY_RECOVERY_FOUNDATION_ACCEPTED`: the deterministic planner,
  authenticated stale-ownership quarantine, single foreground action, and
  real transaction-boundary process drills are accepted.
- `GO_FOR_FIXTURE_REHEARSAL_DESIGN`: Alpha may design one temporary,
  owner-invoked, network-free rehearsal that uses exact frozen fixtures and
  produces reviewable evidence.
- `NO_GO_FOR_EXECUTABLE_RUNTIME`: this review does not authorize a general
  `start`, `step`, service, or reusable runtime command.
- `NO_GO_FOR_CONTINUOUS_RUNTIME`: no timer, wait, polling, retry loop, daemon,
  scheduler loop, or background process is authorized.
- `NO_GO_FOR_BOUNDED_LIVE`: no network provider, future-market discovery, real
  Pilot activation, or dataset-readiness claim is authorized.

## Evidence reviewed

The review inspected:

- the complete T3B12 assembly and recovery specification;
- strict immutable lifecycle, work-snapshot, planner, T6, and terminal-report
  contracts;
- the pure one-action planner and exact gate ordering;
- challenge-bound local Owner authorization and stale-lock classification;
- same-filesystem quarantine guards, immutable receipts, and exact replay;
- the single foreground fixture-step composition and restricted ports;
- T6/fixture/Stop mutual exclusion and terminal-state reread;
- ownership preservation after mutation or cleanup ambiguity;
- all 11 real child-process crash points;
- SQLite/WAL reopen, Stop rollback, prior-session rejection, evidence replay,
  and quarantine replay;
- package commands, exports, provider/network restrictions, credential scans,
  and complete registered validation.

## Readiness matrix

| Gate | Status | Evidence | Decision |
| --- | --- | --- | --- |
| Closed lifecycle and authority ordering | PASS | Strict lifecycle contracts and one composition boundary | Retain |
| Bounded immutable work snapshot | PASS | Exact activation/task/budget/lease/attempt/session identities | Retain |
| Pure one-action planning | PASS | Fixed fail-closed gate order and one closed decision | Retain |
| T6 ownership | PASS | Exact session-gated request; no Worker fall-through | Retain |
| Fixture-only execution | PASS AS PROGRAMMATIC BOUNDARY | At most one injected fixture cycle; no transport construction | Rehearsal design only |
| Terminal safety and cleanup | PASS | Fresh terminal reread, ordered close, ambiguity preservation | Retain |
| Stale ownership recovery | PASS | Exact inspection, local Owner challenge, atomic quarantine | Retain |
| Process-session restart safety | PASS | Durable session evidence survives; old process authority is rejected | Retain |
| Transaction-boundary process kills | PASS | 11 real child-process termination and restart drills | Retain |
| Stop transaction atomicity | PASS | Uncommitted Stop, receipt, and transition state fully rolls back | Retain |
| Durable replay | PASS | T10 evidence and quarantine receipts replay without duplication | Retain |
| Executable lifecycle command | BLOCKED | No reviewed command constructs all concrete ports and invokes the step | Separate design and implementation |
| Fixture rehearsal | BLOCKED PENDING DESIGN | No approved rehearsal manifest, evidence package, or cleanup protocol | T3B13-T1 |
| Continuous operation | BLOCKED | No supervision, wake-up, cross-process Stop signal, or loop authority | Separate future architecture |
| Outbox to T1/T2 integration | BLOCKED | No idempotent consumer or complete observation assembly | Separate integration task |
| Future-market provider admission | BLOCKED | Existing public transport is historical and fixed | Separate provider review |
| Robinhood platform evidence | BLOCKED | No approved automatic quote or fee-preview source | Manual/source design required |
| Dataset qualification | BLOCKED | No prospectively collected qualifying dataset exists | Collection first |
| Commercial operation | BLOCKED | Local SQLite, local verifier, and fixture controls remain research infrastructure | Separate commercial review |

## T3B12 acceptance assessment

| Acceptance criterion | Result |
| --- | --- |
| One composition boundary owns one foreground action | PASS |
| No wait, retry, timer, polling, daemon, or background loop exists | PASS |
| Work snapshots are bounded, sanitized, immutable, and fingerprinted | PASS |
| T6 is deterministic and session gated | PASS |
| T6 cannot invoke a provider in the same step | PASS |
| Fixture composition cannot construct a network transport | PASS |
| Stop outranks every mutation boundary | PASS |
| Shutdown ambiguity preserves recovery evidence | PASS |
| Stale-lock recovery requires exact local Owner authentication | PASS |
| Stale ownership is quarantined and never silently deleted | PASS |
| Prior process authority cannot be reused after restart | PASS |
| Every required real child-process kill drill passes | PASS |
| Terminal output cannot claim success without current evidence | PASS |
| Complete registered validation passes | PASS |
| Fixture rehearsal and later operation remain separately gated | PASS |

## Findings

### Accepted — The T3B11 assembly blockers are closed

T3B12 supplies the previously missing one-action composition, deterministic T6
ownership, authenticated stale-lock quarantine, and OS-process kills through
lease, attempt, validation, T10, Stop, and quarantine boundaries.

These capabilities are accepted as reusable fixture-runtime foundations.

### High — There is still no executable rehearsal boundary

The foreground step is programmatic and receives restricted ports. No reviewed
command currently constructs:

1. one exact immutable rehearsal manifest;
2. one temporary control and SQLite root;
3. one frozen fixture provider composition;
4. one newly authorized process session;
5. one foreground step;
6. one sanitized evidence package;
7. one deterministic cleanup and retention result.

Ad hoc script assembly would recreate the authority-distribution problem that
T3B12 was designed to prevent.

### High — Fixture success would not establish live-source readiness

The fixture path proves deterministic orchestration and recovery only. It does
not prove:

- a future Kalshi market admission policy;
- Robinhood platform quote or fee-preview acquisition;
- cross-source timing coherence;
- operational API reliability;
- complete T1/T2 observation assembly;
- dataset qualification.

A rehearsal report must state these exclusions explicitly.

### High — Continuous runtime authority remains undesigned

One step intentionally exits rather than waiting. A continuous process would
need separately reviewed supervision, wake-up policy, cross-process Stop
notification, suspend/resume clock handling, bounded retry scheduling,
resource retention, terminal reporting, and operator recovery.

Wrapping the current step in a caller loop is prohibited.

### Medium — Outbox evidence has no authoritative consumer

T10 appends a durable sanitized Outbox record, but no reviewed idempotent
consumer assembles T1/T2 observations or acknowledges delivery. A fixture
rehearsal may inspect Outbox identity and chronology but may not claim
observation or dataset completion.

### Medium — Rehearsal evidence and retention need one contract

The next design must define a content-addressed rehearsal package containing
configuration, fixture, expected action, terminal report, SQLite recovery
summary, Outbox identities, validation result, and cleanup disposition without
raw payloads, secrets, probabilities, recommendations, or trading data.

## Required next design task

The recommended next task is:

`Day15-T3B13-T1 — Fixture Rehearsal and Evidence Architecture`

It must be design-only and specify:

1. one owner-invoked, one-run, network-free rehearsal boundary;
2. one immutable content-addressed rehearsal manifest;
3. exact temporary runtime-control and SQLite roots;
4. frozen fixture provider, mapping, Pilot, task, and session identities;
5. one Preflight and one foreground action per invocation;
6. repeatable multi-invocation rehearsal sequencing without an internal loop;
7. Stop, crash, quarantine, restart, and cleanup evidence;
8. sanitized terminal and Outbox evidence packaging;
9. exact pass/fail criteria and retention policy;
10. separate Owner gates for implementation, running the rehearsal, provider
    admission, and bounded-live operation.

## Explicitly prohibited after this review

This review does not authorize:

- an executable runtime command;
- a timer, polling loop, daemon, service, or background runner;
- automatic stale-lock takeover or evidence deletion;
- a network provider request or dynamic market discovery;
- automatic Robinhood access;
- a real Pilot activation;
- Outbox delivery into T1/T2 or dataset qualification;
- probability research, recommendation, sizing, Portfolio mutation, broker,
  order, or execution behavior.

## Owner review recommendation

Approve T3B12-MR1 as:

`ASSEMBLY_RECOVERY_FOUNDATION_ACCEPTED / GO_FOR_FIXTURE_REHEARSAL_DESIGN / NO_GO_FOR_EXECUTABLE_RUNTIME / NO_GO_FOR_CONTINUOUS_RUNTIME / NO_GO_FOR_BOUNDED_LIVE`

Then begin `Day15-T3B13-T1 — Fixture Rehearsal and Evidence Architecture` as a
design-only task. Do not combine design approval with rehearsal execution,
provider admission, bounded-live operation, or trading authority.
