# AI Reservation Manager Specification v1.0

Status: Deterministic in-memory foundation implemented

## 1. Problem Solved

An approved AI Cost Governor decision is only a plan. Without an atomic lifecycle boundary, two callers could acquire the same plan, retry a settlement twice, overwrite a newer state, or leave unused budget counted forever. The AI Reservation Manager turns one approved plan into a versioned reservation record and applies explicit acquire, commit, release, expiration, cancellation, and rejection transitions.

The manager owns reservation state. It does not approve cost, select a model, execute a provider request, or persist accounting entries.

## 2. Expected Value

- Prevent duplicate reservation acquisition and double commitment in one repository boundary.
- Reconcile approved estimated cost with caller-supplied actual usage.
- Release unused budget deterministically.
- Make retries safe through operation idempotency.
- Expose every successful accounting mutation as an append-only ledger instruction.
- Preserve enough audit evidence to explain every applied or rejected operation.

## 3. Implementation and Operating Cost

The foundation adds provider-neutral TypeScript contracts, one deterministic state machine, one in-memory repository, focused tests, and documentation. It adds no runtime dependency, provider SDK, database, cache, scheduler, network client, or background process.

Local operating cost is bounded by the number of reservation and operation records retained in memory. Production storage, retention, indexing, cleanup, and availability costs remain deliberately unimplemented.

## 4. Why Build It Now

Alpha already has deterministic Router, Cost Governor, Provider Adapter, and single-attempt Execution Coordinator foundations. Reservation acquisition and settlement are the missing accounting boundary between cost approval and provider execution. Establishing this boundary before live adapters prevents provider integration from defining budget behavior accidentally.

## 5. Non-Goals

The Reservation Manager does not:

- Route or select providers or models.
- Approve or override a Cost Governor decision.
- Execute AI or call an adapter.
- Retry provider execution.
- Convert currency or infer absent actual usage.
- Write a Cost Ledger or durable audit repository.
- Access credentials, HTTP, sockets, files, external caches, or databases.
- Implement locks, threads, distributed transactions, or a scheduler.
- Mutate portfolio, risk, trade, or other capital-domain state.

## 6. Architecture Position

```text
AI Router
  -> AI Cost Governor returns approved PLANNED reservation
  -> AI Reservation Manager atomically acquires RESERVED record
  -> AI Execution Coordinator validates acquired reservation
  -> Provider Adapter performs one selected execution
  -> AI Execution Coordinator emits settlement instructions
  -> AI Reservation Manager commits usage and/or releases remainder
  -> AI Cost Ledger appends ledger entries
  -> Unified Audit Repository may persist normalized audit records through an explicit caller boundary
```

The manager depends only on Cost Governor reservation contracts and its own repository port. It does not import or invoke the Execution Coordinator or Provider Adapter implementation.

## 7. Contracts

The public boundary defines:

- `AIReservationManager` with one discriminated `process` operation.
- `AIReservationRepository` for records, compare-and-set updates, operation history, and expiration queries.
- `AIReservationRecord`, state, version, amount totals, expiry, policy version, and committed execution references.
- Acquire, commit, release, expire, cancel, and reject request variants.
- Normalized results, errors, validation checks, ledger instructions, and audit records.
- `AIReservationPolicy` for partial commit and expiration decisions.

All IDs and timestamps are supplied by the caller. No random ID or wall-clock source is used.

## 8. State Model

States are:

- `PLANNED`: Cost Governor plan before repository creation.
- `RESERVED`: approved amount acquired with no committed usage.
- `PARTIALLY_COMMITTED`: some actual usage committed; a positive remainder is reserved.
- `COMMITTED`: all reserved amount committed as actual usage.
- `RELEASED`: all uncommitted remainder released; committed usage, if any, is preserved.
- `EXPIRED`: an eligible active reservation expired; its remainder was released.
- `CANCELLED`: a planned reservation was cancelled before acquisition.
- `REJECTED`: a planned reservation was explicitly rejected before acquisition.

`PLANNED` is an external pre-persistence state. Successful acquire, cancel, or reject creates the first stored record at version 1.

## 9. Valid Transitions

| From | Operation | To |
|---|---|---|
| `PLANNED` | acquire | `RESERVED` |
| `PLANNED` | cancel | `CANCELLED` |
| `PLANNED` | reject | `REJECTED` |
| `RESERVED` | full commit | `COMMITTED` |
| `RESERVED` | partial commit | `PARTIALLY_COMMITTED` |
| `RESERVED` | release | `RELEASED` |
| `RESERVED` | expire | `EXPIRED` |
| `PARTIALLY_COMMITTED` | final commit | `COMMITTED` |
| `PARTIALLY_COMMITTED` | additional partial commit | `PARTIALLY_COMMITTED` |
| `PARTIALLY_COMMITTED` | release remainder | `RELEASED` |
| `PARTIALLY_COMMITTED` | expire remainder | `EXPIRED` |

`COMMITTED`, `RELEASED`, `EXPIRED`, `CANCELLED`, and `REJECTED` are terminal. Incompatible transitions fail closed without mutation.

## 10. Monetary Invariants

All amounts use one non-empty currency and non-negative safe integer minor units. Acquire and commit amounts must be positive. Zero actual usage is not a commit and is rejected; callers release the reservation instead.

For every stored record:

```text
committed + released + remaining = reserved
```

No operation performs floating-point accumulation or currency conversion. Commit cannot exceed the remaining amount. Equality is exact and produces `COMMITTED`.

## 11. Acquire Behavior

Acquire requires an allowed Cost Governor status and the exact attached `PLANNED` reservation. Request ID, reservation ID, estimated amount, currency, policy version, creation time, optional expiry, and the decision's reservation copy must match. Expiry must follow creation.

The repository rejects an existing reservation ID and any prior reservation record for the same request. A success creates `RESERVED` version 1, with the approved amount both reserved and remaining, and returns a `RESERVATION_ACQUIRED` instruction plus audit record.

## 12. Commit and Partial Commit Behavior

Commit requires an existing `RESERVED` or `PARTIALLY_COMMITTED` record, matching request and policy references, the current expected version, a matching execution reference, and explicit positive actual usage in the reservation currency.

Usage equal to the remaining amount produces `COMMITTED`. Lower usage produces `PARTIALLY_COMMITTED` only when policy permits partial commit. Each execution ID may contribute usage exactly once; an identical idempotent replay returns the original result, while reusing that execution ID under a new operation is rejected. A later partial or final commit therefore represents a distinct execution/settlement reference. Commit at or after expiry is rejected unless the acquired policy version explicitly permits finalization after expiry.

The manager never estimates or invents actual usage.

## 13. Release Behavior

Release always releases the entire uncommitted remainder. From `RESERVED`, it produces `RELEASED`. From `PARTIALLY_COMMITTED`, it requires the associated execution ID, preserves committed usage, releases the remainder, and produces `RELEASED`. It never converts committed usage back into available budget.

Release from a terminal state is rejected. A success emits `RESERVATION_RELEASED` for the amount released by that operation.

## 14. Expiration Behavior

Expire uses the caller-supplied operation timestamp. It applies only to `RESERVED` or `PARTIALLY_COMMITTED` records at or after `expiresAt`. Administrative early expiration is allowed only when both the request and the acquired policy version permit it.

A success preserves committed usage, releases the complete remainder, changes state to `EXPIRED`, and emits `RESERVATION_EXPIRED`. No scheduler is included. The repository can list active records eligible at a supplied timestamp in stable expiry/ID order.

## 15. Cancellation and Rejection

Cancel and reject apply only to an approved, exact `PLANNED` input before a record exists. They create terminal version 1 records so the request cannot later be acquired silently. The planned amount is represented as released, leaving zero remaining and preserving the amount-conservation invariant.

## 16. Idempotency

Every operation requires a caller-supplied operation ID and idempotency key. The manager creates a canonical, key-sorted fingerprint of the complete payload.

- Same key, operation type, and payload returns the stored original result without another mutation or ledger instruction.
- Same key with any changed payload returns `IDEMPOTENCY_CONFLICT`.
- Reusing an operation ID under a different key returns a repository conflict.
- Operation history stores original applied and normalized rejected results after structural request validation.
- Execution references and state/version checks prevent a provider execution from silently consuming the reservation twice.

No random values participate in replay decisions.

## 17. Optimistic Concurrency

All stored mutations use compare-and-set by expected version. Acquire, cancel, and reject require expected version 0 and create version 1. Each later successful transition increments the version by exactly one.

A stale expected version returns `VERSION_CONFLICT`, includes the current version when safe, and never overwrites current state. This is deterministic optimistic concurrency, not a distributed lock.

## 18. Repository Boundary

The repository port supports:

- Get by reservation ID.
- Stable get by request ID.
- Atomic duplicate-protected create.
- Compare-and-set update by version.
- Append-only operation record.
- Operation lookup by ID and idempotency key.
- Stable listing of expired active reservations.

`InMemoryAIReservationRepository` uses defensive structured copies. It is appropriate only for tests and local deterministic use. It is not durable, process-safe, multi-node safe, or distributed-transaction safe.

## 19. Ledger Instruction Boundary

Every applied operation returns one instruction with deterministic caller-derived identity and:

- Reservation, request, optional execution, operation, and idempotency references.
- Delta amount and currency.
- State before and after.
- Timestamp, policy version, reason, and resulting version.

Instruction types are `RESERVATION_ACQUIRED`, `USAGE_PARTIALLY_COMMITTED`, `USAGE_COMMITTED`, `RESERVATION_RELEASED`, `RESERVATION_EXPIRED`, `RESERVATION_CANCELLED`, and `RESERVATION_REJECTED`.

The instruction is not itself a persisted ledger entry. The implemented Cost Ledger translation boundary can append it idempotently and deduplicate by operation, instruction, idempotency, and execution identity.

## 20. Audit Requirements

Every result includes an in-memory audit record containing reservation, request, operation, operation type, timestamp, idempotency reference, policy version, before/after state and version, all amount totals, expiry, ordered validation checks, decision reasons, normalized error where present, ledger instruction reference where applied, and final result.

Audit output contains no prompt, response content, credential, provider-native error, or secret.

## 21. Integration Sequence

1. Router creates a provider-independent deterministic routing decision.
2. Cost Governor evaluates the estimate and returns an approved `PLANNED` reservation.
3. Reservation Manager acquires it and returns a `RESERVED` record.
4. Execution Coordinator receives that acquired record and invokes one selected adapter.
5. Coordinator returns explicit usage commit and reservation release/retain/expire instructions.
6. Workflow maps those instructions to idempotent Reservation Manager operations.
7. AI Cost Ledger persists returned ledger instructions through its explicit translation boundary.
8. Unified Audit Repository persists normalized governor, execution, reservation, ledger, and workflow evidence.

The AI Runtime Workflow now supplies the direct provider-neutral wiring between Coordinator settlement instructions and Reservation Manager operations.

## 22. Known Limitations

- State and operation history disappear when the process exits.
- Atomicity is limited to one in-memory repository instance.
- Record mutation and operation-history append are not one durable database transaction.
- Policy bodies are identified by version and therefore require immutable version governance.
- Runtime translation exists for the deterministic local workflow, but no production transaction or crash-recovery boundary exists.
- Local append-only ledger and normalized audit persistence exist; production transaction coordination, provider billing reconciliation, cleanup, backup, and recovery do not.
- No external-execution idempotency store prevents duplicate provider calls; the manager only prevents duplicate reservation settlement.

## 23. Future Durable Persistence Requirements

Before production provider execution, replace the in-memory repository behind the unchanged port with owner-reviewed storage that provides:

1. A single transaction for state compare-and-set, operation result append, ledger entry append, and audit persistence.
2. Uniqueness constraints for reservation ID, request reservation, operation ID, idempotency key, and ledger instruction ID.
3. Durable replay of original results and safe recovery after partial failure.
4. Indexed expiration claiming with multi-worker concurrency control.
5. Immutable policy-version retrieval and accounting-timezone metadata.
6. Retention, backup, restoration, observability, and reconciliation controls.
7. Provider billing reconciliation and explicit handling for reported cost above reservation.
8. A durable workflow execution claim that preserves the implemented acquire-before-execution and exactly-once settlement behavior across process failure.

Distributed locking is not required if the durable implementation provides equivalent transactional uniqueness and compare-and-set guarantees.
