# AI Cost Ledger Specification v1.0

Status: Deterministic append-only foundation implemented

Date: 2026-07-18

## 1. Problem Solved

Alpha's Cost Governor approves estimated cost, the Reservation Manager owns reservation state, and the Execution Coordinator reports provider usage and settlement instructions. Those systems need an independent accounting record that preserves what was reserved, committed, released, expired, cancelled, rejected, overridden, or manually adjusted without letting any caller rewrite history.

The AI Cost Ledger is that accounting boundary. It appends immutable cost events, assigns their accounting order, answers deterministic queries, and analyzes reservation histories for inconsistencies. It never changes the source reservation or silently repairs an accounting problem.

## 2. Expected Value

- Preserve an immutable record of AI operating-cost activity.
- Prevent duplicate entry, operation, idempotency, and execution settlement identities.
- Keep exact original sequence assignments during retries.
- Rebuild cost summaries by currency, time, provider, model, task, request, reservation, and execution.
- Detect missing or inconsistent reservation settlement before live provider integration.
- Provide a narrow persistence port that can later be implemented by a production transactional database.

## 3. Implementation Cost

The foundation adds provider-neutral TypeScript contracts and validation, one deterministic ledger service, an in-memory repository, a local append-only NDJSON repository using the Node standard library, a Reservation Manager instruction translator, focused tests, exports, and documentation.

No package, ORM, database engine, provider SDK, cache, queue, scheduler, or network client was added.

## 4. Operating Cost

The in-memory repository uses local process memory. The local repository uses one canonical JSON record per line and flushes each append to the configured local file. Query and reconciliation operations currently scan retained entries, which is appropriate for Alpha's current single-owner development volume but not high-volume production.

## 5. Why Build It Now

The Reservation Manager now emits explicit lifecycle instructions. Persisting those instructions before a live provider is introduced establishes cost accounting independently from provider behavior and gave the Runtime Workflow and Unified Audit integration stable, reviewable contracts.

## 6. Non-Goals

The Cost Ledger does not:

- Route or select providers or models.
- Approve budgets, overrides, reservations, or requests.
- Execute AI, adapters, retries, or fallbacks.
- Change Reservation Manager state.
- Modify portfolio, risk, trade, or capital records.
- Convert currencies or infer missing usage.
- Delete, replace, reorder, or repair historical entries.
- Automatically persist into the implemented Unified Audit Repository; callers use the explicit translation and append boundary.
- Provide cloud storage, multi-node locking, distributed consensus, encryption, or multi-user authorization.

## 7. Architecture Position

```text
AI Router selects a provider-independent route
  -> AI Cost Governor approves estimated cost
  -> AI Reservation Manager acquires reservation
  -> Cost Ledger appends RESERVATION_ACQUIRED
  -> AI Execution Coordinator invokes one selected adapter
  -> Reservation Manager applies settlement instruction
  -> Cost Ledger appends commit/release/expiration event
  -> Cost Ledger reconciliation analyzes accounting history
  -> Unified Audit Repository persists normalized cross-system evidence through an explicit caller boundary
  -> D4-T11 Runtime Workflow coordinates the sequence
```

The ledger imports neutral instruction contracts only through an explicit translation function. It does not invoke the Reservation Manager or Coordinator.

## 8. Accounting Source of Truth

Ledger entries are the append-only source of truth for historical AI cost events. Reservation Manager records remain the source of truth for current reservation state. Cost Governor policies remain the source of truth for budget authorization.

The ledger does not claim that appending an entry changes a reservation. D4-T11 coordinates the separate reservation mutation and ledger append locally; until a production transactional store exists, failures can still require compensation or reconciliation.

## 9. Append-Only Event Model

Each entry has caller-supplied immutable identity and content plus a repository-assigned sequence. An entry contains:

- Schema and integrity versions.
- Entry, request, optional reservation, optional execution, source operation, and idempotency identities.
- Type, non-negative minor-unit amount, currency, timestamp, and policy version.
- Optional reservation state-before, state-after, and resulting version.
- Optional already-selected provider, model, and task identifiers.
- Reason code, source subsystem, source audit reference, correlation ID, optional trace ID, and scalar non-secret metadata.
- Optional signed manual-adjustment details.
- Sequence, business-order flag, and canonical payload fingerprint assigned or retained by the ledger boundary.

Entries are never updated or deleted.

## 10. Entry Types

Supported types are:

- `RESERVATION_ACQUIRED`
- `USAGE_PARTIALLY_COMMITTED`
- `USAGE_COMMITTED`
- `RESERVATION_RELEASED`
- `RESERVATION_EXPIRED`
- `RESERVATION_CANCELLED`
- `RESERVATION_REJECTED`
- `CRITICAL_OVERRIDE_USED`
- `MANUAL_ADJUSTMENT`

Reservation events require reservation transition states and version. Usage events also require an execution ID.

## 11. Monetary Representation

Normal events use non-negative safe integer minor units and an uppercase currency identifier. Values cannot be fractional, non-finite, unsafe, or negative. The ledger never performs currency conversion and never combines currencies into one numeric total.

Manual adjustments use a dedicated signed safe-integer delta. The normal amount must equal the absolute delta, so standard summaries retain a non-negative event amount while adjustment summaries preserve direction.

All aggregation uses checked safe-integer addition and fails rather than overflowing silently.

## 12. Idempotency and Duplicate Prevention

Every append requires an entry ID, source operation ID, and idempotency key.

- The same key and canonical request payload returns the original applied result and original sequence without another append.
- A changed payload under the same key returns `IDEMPOTENCY_CONFLICT`.
- Duplicate entry IDs return `DUPLICATE_ENTRY`.
- Duplicate source operation IDs return `DUPLICATE_OPERATION`.
- A reservation with a terminal settlement cannot receive another lifecycle settlement.
- An execution ID can contribute one usage settlement event, preventing duplicate provider usage accounting.

No random IDs are generated.

## 13. Sequence Ordering

The repository assigns monotonically increasing positive safe-integer sequences inside its append boundary. Caller timestamps never determine sequence. Equal timestamps remain ordered by sequence.

For one reservation, a timestamp older than its latest appended business event is rejected unless policy explicitly allows it. Allowed events receive `OUT_OF_ORDER_ALLOWED`; their ledger sequence is still the append order. Historical sequence is never renumbered.

## 14. Repository Boundary

`AICostLedgerRepository` supports:

- Atomic sequence assignment and append.
- Lookup by entry ID, idempotency key, and source operation ID.
- Stable listing by sequence range, request, reservation, execution, timestamp range, and provider/model/task filters.
- Latest-sequence and complete ordered export.

The port contains no provider or business-domain behavior. All returned entries are immutable snapshots or defensive copies.

## 15. In-Memory Repository

`InMemoryAICostLedgerRepository` provides deterministic local/test behavior with maps for immutable identities and an ordered entry list. It prevents duplicate entries, operations, idempotency keys, sequences, and execution settlements.

It is not durable, process-safe, or distributed-safe.

## 16. Local Durable Persistence

`LocalNdjsonAICostLedgerRepository` is a lightweight personal-development repository. It uses only Node standard-library filesystem operations.

- Runtime root is supplied by trusted application configuration.
- Ledger IDs accept only a narrow safe character set and cannot traverse directories.
- Recommended location is `data/runtime/ai-cost-ledger/`.
- The runtime directory is ignored by Git.
- Each entry is canonical key-sorted JSON on one newline-terminated line.
- Append opens the file in append mode, writes one complete record, flushes it, and closes the descriptor.
- Existing bytes are not rewritten during append.
- Reload validates every record before exposing the repository.

This repository is suitable only for Alpha's current single-owner, single-process development stage.

## 17. Corruption Behavior

Load fails closed on:

- Malformed JSON.
- Truncated final lines or empty records.
- Unsupported schema, integrity, amount, timestamp, metadata, or transition fields.
- Non-canonical serialization.
- Missing, duplicate, or out-of-order sequences.
- Duplicate entry, operation, idempotency, or execution settlement identities.

Corrupt entries are never skipped or repaired. The repository raises a normalized `AICostLedgerRepositoryCorruptionError`. Path violations raise `AICostLedgerRepositoryPathError`.

## 18. Query Model

Queries may filter by sequence range, request, reservation, execution, explicit timezone-aware timestamp range, provider, model, task, currency, and entry type. Results always retain sequence order and return explicit empty arrays and counts.

Summaries group committed usage by:

- UTC day and month.
- Task type.
- Provider and model.
- Request, reservation, and execution.

Balances separately report acquired, committed, released, expired, cancelled, rejected, override, and signed manual-adjustment amounts for each currency.

Active unresolved reservation IDs are inferred from the latest recorded reservation state and returned in stable ID order.

## 19. Reconciliation Rules

Reservation reconciliation reads events in ledger sequence and reports, without mutation:

- Commit without acquisition.
- Release without an active reservation.
- Expiration without acquisition.
- Duplicate acquisition or terminal settlement.
- Committed usage above acquired amount.
- Committed plus released amount above acquired amount.
- Currency, request, or policy-version conflicts.
- State transition order mismatch.
- Missing final settlement.
- Duplicate execution settlement.
- Non-increasing sequence within the reservation history.

The result includes status, request/currency when known, reserved, committed, released, remaining, terminal state when determinable, ordered issues, source entry references, and an in-memory audit record. Reconciliation never repairs history.

## 20. Manual Adjustment Boundary

Manual adjustments are append-only owner accounting events. They require:

- Policy permission.
- An authorization reference explicitly listed by policy.
- Non-zero signed safe-integer delta.
- Matching absolute event amount and currency.
- Owner reason, target scope, timestamp, correlation ID, and source audit reference.

A manual adjustment never changes or deletes a prior entry. Production owner identity and approval persistence remain future work.

## 21. Audit Requirements

Every append result includes an in-memory audit record with operation and entry identity, timestamp, source subsystem, policy version, validation checks, idempotency disposition, assigned sequence, append status, repository type, balances through the assigned sequence, source audit reference, normalized error, and final result.

Every reconciliation includes ordered issues, balances, source audit references, repository type, and final reconciliation outcome. The Unified Audit Repository can now persist normalized cross-system evidence through an explicit caller boundary; the ledger entry remains the accounting source of truth.

## 22. Privacy and Secret Exclusions

Ledger entries contain identifiers and accounting metadata only. They must never contain prompts, outputs, provider-native payloads, credentials, API keys, authorization headers, passwords, access tokens, or secret material.

Metadata is restricted to scalar values. Policy-controlled validation rejects common secret-bearing key names recursively at this flat boundary.

## 23. Runtime Data Location

The recommended local location is:

```text
data/runtime/ai-cost-ledger/<ledger-id>.ndjson
```

This directory is ignored by Git. Tests use temporary operating-system directories and delete them after each test. No runtime ledger file is committed.

## 24. Migration and Versioning

Every entry has explicit schema and integrity versions. Version 1 repositories accept only `1.0`; unsupported records fail closed. Migrations must be separate, owner-reviewed tools that create a new ledger or append explicit migration evidence. They must never silently rewrite the original ledger.

Policy versions and source audit references must remain resolvable and immutable. A future checkpoint may record the last reconciled sequence, but checkpoints cannot alter historical entries.

## 25. Future Production Database Requirements

A future production repository must preserve the current port while adding:

1. Transactional uniqueness and sequence assignment across processes.
2. Atomic reservation state, operation result, ledger entry, and audit persistence where the runtime workflow requires it.
3. Durable indexing for every supported query dimension.
4. Immutable retention, backup, restore, and verified migration procedures.
5. Strong corruption detection, access controls, encryption, and observability.
6. Accounting checkpoints and provider billing reconciliation.
7. Multi-user authorization and explicit manual-adjustment approvals.
8. Recovery behavior proven against partial writes and process interruption.

No ORM or database technology is selected by this foundation.

## 26. Known Limitations

- The local repository coordinates only one process and one repository instance.
- File append and Reservation Manager mutation are not one transaction.
- Query and reconciliation operations scan in-memory loaded entries.
- An append result audit is not yet durably stored outside the ledger entry.
- The deterministic local Runtime Workflow applies Reservation Manager instructions, but no production transaction or crash-recovery boundary exists.
- No provider billing reconciliation, compaction, archival, encryption, or backup exists.
- The file repository detects corruption but does not recover from it.
