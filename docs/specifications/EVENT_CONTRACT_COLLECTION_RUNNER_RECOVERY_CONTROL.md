# Event Contract Collection Runner Recovery Control and Emergency Stop v1

## Status

Day15-T3B10-T4 defines the explicit Owner Resume, Emergency Stop, and recovery-decision boundary required after T3C. The owner approved and pushed that design as `bfe4751d39ae3d0a9e4c0bc70d6889198f9f0516`.

Day15-T3B10-T4A implements the provider-neutral immutable control contracts and deterministic validation/classification engine and is committed and pushed as `12848f9621e6d9abf9477cdb5c24260b50351a97`.

Day15-T3B10-T4B implements checksum-bound migration 002 and named recovery-control transactions and is committed and pushed as `529ddbc1fc53a8d93a1beca77bc277e78fac9c2c`.

Day15-T3B10-T4C implements the local authenticated Owner command, process-session repository gate, and immediate in-memory stop barrier and is committed and pushed as `c11cbf844284676ad5dfeee89fd82221cc5282a9`.

Day15-T3B10-T4D implements six network-free stop/resume race, crash/restart, transaction-fault, and durable-stop-failure drills and is committed and pushed as `1b7e9744189cd5028a8cae13bc057954648bbb27`. The drills found and corrected session-revocation fingerprint drift. T4D adds no scheduler/worker operation, provider request, continuous runner, model, recommendation, broker, order, or execution behavior.

## T4A implementation boundary

T4A adds:

- exact recovery-activation, assessment, local-owner-authorization, owner-decision, and Emergency Stop contracts;
- closed enums for recovery dispositions, owner actions, stop triggers/directives, clock health, and validation issues;
- strict unknown-field rejection, UTC chronology, version, identifier, count, fingerprint, and session-binding validation;
- deterministic recovery classification and assessment fingerprint verification;
- exact-owner decision validation with an explicit disposition/action matrix;
- deterministic Emergency Stop evaluation in which integrity/database failure requires fail-closed behavior and all other stop triggers block resume and new work.

T4A produces immutable decision evidence only. `authorizesMutation` and `authorizesResume` are decision facts for a later reviewed executor; they do not open a repository, persist a record, create a runtime session, or mutate Pilot state.

## T4B implementation boundary

T4B adds:

- five `STRICT` tables for assessments, owner decisions, session authorizations, Emergency Stop events, and execution receipts;
- checksum-bound migration 002, with deterministic empty-v1 upgrade and fail-closed populated-v1 behavior until a verified backup exists;
- a restricted recovery-control repository that remains distinct from the ordinary runner repository;
- named atomic transactions for assessment/decision persistence, decision execution, and Emergency Stop execution;
- deterministic verification on both write and read, exact recovery report/store path/schema/Pilot/version binding, and immutable sanitized results;
- one-time decision consumption, session-authorization persistence without `ACTIVE -> ACTIVE`, Emergency Stop precedence, compare-and-swap transitions, authority invalidation, and atomic receipt/outbox evidence.

T4B does not authenticate an operator or activate the session authorization. The ordinary runner repository remains blocked after an operational-pilot restart; T4C owns the authenticated command and process-session gate.

## T4C implementation boundary

T4C adds:

- one local `owner-decision` command over an exact recovery assessment and T4B transaction;
- a pre-provisioned `scrypt` verifier with fixed reviewed parameters and constant-time comparison;
- standard-input-only secret handling, regular non-symlink request/verifier files, generic authentication failures, and no secret persistence or output;
- exact command-fingerprint challenge binding and exact Owner/assessment/Pilot/session chronology;
- a resumed repository wrapper that rejects new definitions, Pilots, and task authority;
- durable session validation before every permitted write, including exact store/recovery/schema/Pilot/process/boot/task identity, expiry, revocation, and Emergency Stop checks;
- an irreversible process-local stop barrier that is set before durable Emergency Stop is attempted.

T4C does not provision or recover Owner credentials, authenticate remotely, start a runtime loop, schedule work, invoke a provider, or grant any trading authority. The verifier remains local research-pilot infrastructure and requires a separate commercial credential-security review.

## T4D implementation boundary

T4D adds:

- deterministic two-connection ordering drills for Stop-before-Resume and Resume-before-Stop;
- restart drills proving that durable evidence survives while the previous recovery context and process session cannot be reused;
- a fault-injected resume transaction proving decision consumption, session insertion, and receipt creation roll back together;
- a durable-stop failure drill proving the in-memory barrier trips before SQLite persistence and remains authoritative for the current process;
- regression coverage proving revoked session records remain readable and fingerprint-coherent after Emergency Stop.

The drill suite uses only temporary local SQLite stores, injected failures, and fixture evidence. It performs no network request, scheduling, worker operation, provider call, credential enrollment, model inference, recommendation, broker action, order, or execution.

## Purpose

T3C correctly blocks writable repository creation when startup finds an operational pilot or any recovery issue. T4 specifies how a future owner-operated control plane may resolve that gate without weakening evidence, state, cutoff, lease, attempt, budget, or emergency-stop authority.

The design follows five rules:

1. recovery analysis is deterministic; recovery authorization belongs only to the owner;
2. resume authorization is separate from the Pilot state machine;
3. terminal Pilot and task states never reopen;
4. Emergency Stop always outranks resume, scheduling, retry, and evidence collection;
5. ambiguity is preserved as evidence and fails closed.

## Why Resume Is Not a Pilot Transition

After restart, a durable pilot may still be `ACTIVE`, while the new process is intentionally mutation-blocked. `ACTIVE -> ACTIVE` would be a fake lifecycle transition and would weaken the existing append-only state machine.

A future resume therefore uses a separate, one-time recovery authorization:

```text
durable Pilot remains ACTIVE
        +
verified Recovery Assessment
        +
Owner Recovery Decision
        +
new boot/process session binding
        =
bounded mutation authorization for that process session
```

The authorization does not extend activation time, increase budgets, change the frozen plan, admit a provider/mapping, reset attempts, revive a terminal task, or prove clock health.

## Roles and authority

### Deterministic Recovery Inspector

May:

- inspect and classify durable state;
- recompute fingerprints and counters;
- identify leases, open attempts, deadlines, blockers, and required actions;
- issue an immutable assessment and deterministic disposition.

May not authorize resume, repair records, infer request success, delete attempts, extend time, or change a state.

### Owner

The exact owner bound to the activation may:

- approve one eligible resume;
- choose stop completion instead of resume;
- revoke the activation;
- accept a separately verified restored-store switch;
- request Emergency Stop.

Owner identity must be locally authenticated by a later reviewed operator boundary. A caller-supplied string alone is not proof of authority.

### Operator Executor

May execute exactly one owner-approved control decision after revalidating every bound version and fingerprint. It cannot alter the decision or select a more permissive outcome.

### Worker

Receives only the resulting bounded session authorization. It has no owner, recovery, stop, restore-switch, or policy authority.

## Immutable control records

### Recovery Assessment

Required fields:

- assessment ID, schema/policy versions, and fingerprint;
- store ID, path identity, schema/migration/catalog identities;
- T3C recovery-report fingerprint and inspection time;
- activation ID, state, aggregate version, fingerprint, start/stop time, and remaining budgets;
- prior and proposed boot identity and process-session identity;
- clock-health evidence and maximum permitted offset;
- open lease and attempt identities with sanitized status;
- expired, ambiguous, committed, missed, and terminal task counts;
- outbox backlog and integrity blocker codes;
- deterministic recovery disposition;
- assessment expiry.

It contains no raw provider body, credential, account, probability, recommendation, P&L, or order content.

### Owner Recovery Decision

Required fields:

- decision ID and idempotency key;
- exact assessment ID and fingerprint;
- exact activation ID and expected aggregate version;
- owner identity and locally verified authorization reference;
- one decision enum;
- bounded reason code;
- decided and expires timestamps;
- one proposed boot/process session;
- decision fingerprint.

Allowed decisions:

- `APPROVE_RESUME`;
- `COMPLETE_STOP`;
- `REVOKE`;
- `FAIL_CLOSED`;
- `REJECT_NO_MUTATION`.

No decision can approve repair, backfill, budget extension, deadline extension, new mapping/provider authority, or terminal-state reopening.

### Control Execution Receipt

Records the exact decision, precondition versions, resulting Pilot/task/lease effects, new session authorization when applicable, and sanitized outbox/audit identities. It is append-only and idempotent.

## Deterministic recovery dispositions

| Durable condition | Disposition | Owner choices |
| --- | --- | --- |
| No operational Pilot and no blockers | `NO_RESUME_REQUIRED` | none |
| `ACTIVE`, within activation window, healthy clock, no lease/open attempt, all invariants valid | `RESUME_ELIGIBLE` | resume, stop, revoke |
| `ACTIVE` with expired lease or attempt without result | `RECONCILIATION_REQUIRED` | stop, revoke, fail closed; resume only after a separate exact reconciliation transaction |
| `STOP_REQUESTED` | `STOP_COMPLETION_ONLY` | complete stop, revoke, fail closed |
| Activation time expired | `ACTIVATION_EXPIRED` | complete/revoke; never resume |
| Restored store verified but not selected | `STORE_SWITCH_REQUIRED` | approve store switch separately; never resume in the same transaction |
| Migration, schema, integrity, fingerprint, authority, evidence, counter, or outbox conflict | `FAIL_CLOSED_REQUIRED` | fail closed or reject without mutation |
| `STOPPED`, `REVOKED`, `COMPLETED`, or `FAILED_CLOSED` | `TERMINAL_NO_RESUME` | none |

`RECONCILIATION_REQUIRED` never assumes whether a provider request happened. An abandoned attempt remains durable. A retry may become eligible only under the existing two-attempt ceiling, retry classification, activation time, cutoff, deadline, and exact owner-approved recovery policy.

## Resume transaction

A future named transaction must:

1. acquire exclusive control ownership;
2. verify the store and current recovery report are unchanged;
3. verify the Pilot remains `ACTIVE` at the expected version;
4. verify the exact owner and unexpired `APPROVE_RESUME` decision;
5. require disposition `RESUME_ELIGIBLE`;
6. verify zero integrity blockers, zero active leases, and zero unresolved attempts;
7. verify activation time, task cutoffs, budgets, and current clock health;
8. bind a new boot identity and process-session identity;
9. consume the decision exactly once;
10. append a recovery authorization, execution receipt, and sanitized outbox event atomically.

Only after commit may the store create a writable repository for that exact process session. Losing the process session invalidates the authorization; it is not reusable after another restart.

## Emergency Stop

### Trigger authority

Emergency Stop may originate from:

- an explicit owner command;
- deterministic integrity failure;
- unhealthy or unavailable clock;
- revoked or expired activation;
- budget breach;
- unsafe lease/attempt ambiguity;
- database write/integrity failure;
- an already durable `STOP_REQUESTED` state.

Automated safety triggers may stop or fail closed, but may never resume.

### Ordering and precedence

On receipt:

1. set an in-memory stop barrier immediately so no new lease or retry starts;
2. attempt one atomic `ACTIVE -> STOP_REQUESTED` transaction with reason evidence;
3. invalidate unconsumed resume decisions and session authorizations;
4. request cancellation of current transport without assuming cancellation succeeded;
5. record the in-flight outcome only through the ordinary sanitized attempt-result boundary;
6. transition remaining non-terminal tasks to `CANCELLED` or `MISSED` using their exact temporal rules;
7. remove leases only through reviewed reconciliation/finalization transactions;
8. when no in-flight or validating task remains, transition `STOP_REQUESTED -> STOPPED`;
9. append control receipt and sanitized audit/outbox evidence.

If step 2 cannot persist, the process still stops acquiring work and exits fail closed. The next startup must expose the unresolved stop as a recovery blocker; it must not infer that the durable Pilot stopped.

### Race rules

- Stop observed before lease commit: lease transaction must fail.
- Stop committed after lease but before request claim: no request may start; task is cancelled through a named transaction.
- Stop committed after request claim: outcome remains unknown until bounded finalization; no retry begins.
- Stop committed during validation: existing T10 requires `ACTIVE`, so evidence commit fails and raw response data is discarded.
- Stop racing with Resume: Stop wins even if Resume was approved but not consumed.
- A committed evidence transaction that wins before Stop remains immutable and valid.

## Terminal and restore rules

- `STOPPED`, `REVOKED`, `COMPLETED`, and `FAILED_CLOSED` never resume.
- Revocation is permanent withdrawal of activation authority.
- `FAILED_CLOSED` is not a pause state and requires a new activation after investigation.
- Restore approval and Resume are two distinct owner decisions and transactions.
- Switching to a restored store preserves the prior store and invalidates all previous process-session authorizations.
- No control action repairs, deletes, rewrites, or fabricates evidence.

## Required persistence and implementation split

A later implementation must remain separately gated:

1. **T4A — control contracts and deterministic decision engine**;
2. **T4B — migration 002 and named control transactions**;
3. **T4C — local authenticated operator commands and process-session gate**;
4. **T4D — network-free stop/resume race and crash drills**.

No scheduler or provider composition may start before all four tasks pass independent owner review.

## Acceptance criteria

- Resume is a one-time process-session authorization, not `ACTIVE -> ACTIVE`;
- only the exact activation owner can authorize eligible resume or store switch;
- automated logic can stop but never resume;
- Emergency Stop outranks all unconsumed resume/retry/acquisition authority;
- unresolved requests and expired leases preserve ambiguity and attempt history;
- terminal states never reopen;
- restore switch and resume remain separate decisions;
- every mutation is named, compare-and-swap, idempotent, and auditable;
- no real runtime or trading authority is introduced.

## Related specifications

- [Runner Architecture](EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md)
- [Runner Contracts](EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md)
- [SQLite Schema and Transactions](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md)
- [SQLite Recovery, Backup, and Restore](EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_RECOVERY.md)
