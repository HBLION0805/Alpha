# AI Unified Audit Repository Specification v1.0

Status: Deterministic foundation implemented on 2026-07-18
Task: D4-T10
Runtime data: `data/runtime/ai-audit/`

## Problem Solved

Alpha's Router, Cost Governor, Reservation Manager, Execution Coordinator, Provider Adapter boundary, and Cost Ledger produce separate audit evidence. Without a shared evidence index, an owner cannot reliably reconstruct one request across those subsystem boundaries or detect broken links, conflicting references, and missing outcomes.

The Unified Audit Repository accepts normalized records, assigns one repository order, preserves immutable evidence, supports stable filtered review, reconstructs cross-system traces, and reports integrity issues. It does not reinterpret source decisions or become a business system.

## Expected Value, Cost, and Timing

- Expected value: one deterministic evidence trail for review, debugging, owner approval, future replay, and future learning systems.
- Implementation cost: small provider-neutral contracts, a deterministic service, translation functions, an in-memory repository, and a standard-library NDJSON repository.
- Operating cost: local disk space and one flush per durable append; no AI, provider, network, database, or hosted-service cost.
- Why now: Router through Cost Ledger already emit separate audit records. Establishing the normalization boundary before live providers prevents provider-native payloads and mutable operational state from becoming the de facto audit architecture.

## Architecture Position

```text
Router audit -------------------+
Cost Governor audit ------------+
Reservation Manager audit ------+--> translation --> Unified Audit Repository --> query / trace / integrity / export
Execution Coordinator audit ----+
Cost Ledger audit --------------+
Future normalized evidence -----+
```

Subsystems remain independent and are not coupled to repository implementation. Callers explicitly translate and append source records after the owning subsystem returns them.

## Responsibility and Source of Truth

The repository owns:

- immutable normalized audit evidence;
- atomic monotonic audit sequence assignment within one repository instance;
- audit identity and idempotency enforcement;
- stable queries and immutable exports;
- trace reconstruction and non-mutating integrity reports;
- privacy and retention metadata enforcement at the repository boundary.

It does not own routing, cost approval, reservation state, provider execution, retries, accounting calculations, portfolio state, risk calculations, or trades. Source systems remain authoritative for their own decisions and state.

The AI Cost Ledger remains the accounting source of truth for monetary usage. A Cost Ledger audit record in this repository is evidence that a ledger operation occurred; it is not a substitute balance, transaction, or accounting event.

## Non-Goals

- No provider execution, provider SDK, credential, API, HTTP client, socket, or network transmission.
- No raw prompt, provider-native payload, access token, secret, or credential storage.
- No update, delete, silent repair, redaction, archival, or retention-deletion workflow.
- No encryption, identity verification, owner authentication, or digital signatures yet.
- No cloud database, ORM, distributed sequence allocator, or multi-writer transaction implementation.
- No business calculations, AI execution, portfolio mutation, or trade execution.
- No implementation of future research, prediction, decision, journal, strategy, or learning behavior.

## Append-Only Record Model

`AIAuditRecordInput` contains caller evidence; the repository adds `sequence`, `importOrderStatus`, and a canonical `payloadFingerprint`. Required normalized fields include:

- schema, record, idempotency, source-record, correlation, and trace identities;
- record type, source subsystem, source version, timestamp, actor, status, and final outcome;
- parent and related audit references;
- safe request, routing, budget, reservation, execution, ledger, provider, model, and task references where applicable;
- policy versions, normalized reason codes and normalized error metadata;
- required privacy and retention classifications;
- flat scalar metadata, payload integrity reference, and source audit references.

The model deliberately excludes raw prompts and general nested payloads. Metadata accepts only scalar values. Secret-bearing metadata keys are rejected when policy requires, which is the default foundation behavior.

No repository interface exposes update or delete. Future correction or redaction must be represented by a new linked append-only record and preserve the original evidence.

## Record Types

Current normalized types are:

- `ROUTING_DECISION`
- `COST_GOVERNOR_DECISION`
- `RESERVATION_OPERATION`
- `EXECUTION_COORDINATOR_RESULT`
- `PROVIDER_ADAPTER_RESULT`
- `COST_LEDGER_APPEND`
- `COST_LEDGER_RECONCILIATION`
- `RUNTIME_WORKFLOW_RESULT`
- `SYSTEM_VALIDATION`
- `OWNER_APPROVAL`
- `ERROR`
- `WARNING`

`RUNTIME_WORKFLOW_RESULT` is the terminal normalized evidence record for the deterministic AI Runtime Workflow. Reserved future-compatible types are `RESEARCH_RECORD`, `PREDICTION_RECORD`, `DECISION_RECORD`, `TRADE_RECORD`, `JOURNAL_ENTRY`, `STRATEGY_VERSION`, and `LEARNING_REVIEW`. Their presence in the enum is not an implementation of those future systems.

## Privacy and Retention

Privacy classification is required and reuses Alpha's existing levels:

- `PUBLIC`
- `INTERNAL`
- `SENSITIVE`
- `LOCAL_ONLY`

The repository rejects a child record whose privacy level is lower than its stored parent when downgrade prevention is enabled. `LOCAL_ONLY` records cannot be included in an external-transfer export. External `SENSITIVE` exports require an authorization reference when policy requires it. Exports are returned in memory only; this foundation never sends them over a network.

Retention classification is required: `SHORT_TERM`, `STANDARD`, `LONG_TERM`, `PERMANENT`, or `LEGAL_HOLD`. Retention is descriptive metadata only. This version does not delete, archive, expire, encrypt, or move records.

## Idempotency and Immutable Identity

Every append carries both an idempotency key and an immutable source identity (`sourceSubsystem + sourceRecordId + sourceRecordVersion`).

- An identical idempotency replay returns the stored record and original sequence.
- Reuse of an idempotency key with a different canonical payload is rejected.
- Duplicate audit record IDs are rejected.
- Duplicate source identities are rejected when the active policy requires uniqueness.
- Caller-supplied deterministic IDs are required; the repository generates no random ID.
- Append results include an in-memory operation audit describing `NEW`, `REPLAY`, or `CONFLICT`.

## Deterministic Sequencing

The repository assigns monotonically increasing safe-integer sequence numbers atomically at its storage boundary. Sequence, not timestamp, is repository order. Equal timestamps retain append order. Queries, traces, and exports use stable sequence order.

If a record timestamp precedes existing evidence in the same trace, the append fails unless `allowStaleImports` is explicit. An accepted stale record is marked `STALE_ALLOWED`; it is not moved into timestamp order. Integrity checks report sequence gaps and never renumber history.

## Repository Boundary

`AIAuditRepositoryPort` supports atomic append and deterministic retrieval by:

- record ID, idempotency key, and source identity;
- sequence and timestamp ranges;
- record type and source subsystem;
- request, correlation, and trace ID;
- reservation, execution, and ledger-entry references;
- provider, model, and task type;
- privacy level;
- latest sequence and all records.

`DeterministicAIAuditRepository` supplies policy enforcement, normalized append results, compound queries, trace reconstruction, integrity checks, and snapshot export. Repository-returned records and service results are defensively copied.

## Local Durable Persistence

Two repository ports are implemented:

1. `InMemoryAIAuditRepository` for deterministic tests and local ephemeral use.
2. `LocalNdjsonAIAuditRepository` for current single-owner restart persistence.

The durable repository stores canonical one-record-per-line JSON under `data/runtime/ai-audit/`, which is Git-ignored. It appends and flushes each record without rewriting prior bytes. On reload it validates every line, schema, canonical serialization, sequence, record ID, and idempotency identity. It rejects malformed JSON, truncation, empty lines, non-canonical records, sequence inconsistency, and duplicate identities rather than skipping them.

Store IDs use a restricted identifier and are resolved beneath the configured root to prevent directory traversal. Tests use temporary directories and remove them after use. No audit runtime records are committed.

Local NDJSON is suitable only for single-process, single-owner development. It provides no lock coordination, cross-file transaction, encryption, backup protocol, concurrent-writer safety, or tamper-resistant signature.

## Trace Reconstruction

A trace request specifies exactly one trace ID or root request ID. Reconstruction:

1. selects matching records;
2. expands stored parent and related references;
3. orders real nodes by audit sequence;
4. emits explicit missing nodes;
5. builds stable parent and related edges;
6. identifies roots, leaves, subsystem progression, and the last determinable final outcome;
7. runs integrity inspection over the collected evidence.

Statuses are `COMPLETE`, `INCOMPLETE`, `INCONSISTENT`, or `EMPTY`. A missing reference or absent terminal result is incomplete. A cycle, reference conflict, policy conflict, privacy downgrade, or invalid subsystem predecessor is inconsistent. A trace need not contain every subsystem.

## Integrity Checks

Integrity checks are deterministic, read-only reports. The current foundation detects:

- duplicate record, sequence, idempotency, and source identities;
- missing parent and related records;
- cyclic parent references;
- linked request, correlation, trace, reservation, execution, and ledger mismatches;
- linked policy-version conflicts;
- obvious invalid subsystem predecessors;
- absent terminal outcomes;
- privacy downgrades;
- malformed records and normalized errors through contract validation;
- non-contiguous complete-repository sequence;
- durable corruption during reload.

Issues identify the record, related record, sequence, code, and safe reason when available. No integrity check edits or repairs stored evidence.

## Export Behavior

Exports accept the same filters as queries, an injected export timestamp, format, and destination classification. Supported in-memory formats are canonical NDJSON and a canonical JSON array.

Records remain sequence ordered and are defensively copied. `LOCAL_ONLY` records cannot enter external-transfer output. `SENSITIVE` records require a policy-authorized reference when configured. Policy can forbid all external-transfer exports. A rejected export contains no serialized records. The repository performs no transmission and writes no export file.

## Translation Boundaries

Narrow pure functions translate current Router, Cost Governor, Reservation Manager, Execution Coordinator, and Cost Ledger append/reconciliation audit contracts. They preserve source audit ID, timestamp, policy versions, safe references, normalized status/reasons/errors, and final outcome. They add only caller-provided correlation, relationship, actor, privacy, retention, and safe metadata context.

Translations do not mutate sources and do not copy raw requests, prompts, outputs, provider payloads, or nested private data. Subsystem engines are unchanged and do not depend on the repository.

## Owner Approval Records

`OWNER_APPROVAL` records require an owner actor and contain approval ID, owner reference, approved subject, decision, conditions, reason, optional Git reference, timestamp, related records, privacy, retention, and policy metadata. This is evidence storage only; owner identity and authorization are not verified in v1.

## Repository Operation Audits and Recursion Prevention

Append, trace reconstruction, integrity check, and export return an in-memory `AIAuditOperationAuditRecord`. It contains operation identity/type, timestamp, actor, policy, validation, idempotency outcome, assigned sequence, repository type, integrity issues, export restrictions, normalized error, and final result.

These operation audits are not recursively persisted. A caller may deliberately normalize and append one later, but the service never auto-appends its own audit result. This prevents infinite audit recursion and hidden writes.

## Corruption Behavior

Durable corruption fails repository construction with a normalized typed corruption error. The implementation does not skip, truncate, rewrite, repair, reorder, or renumber suspect records. Recovery requires an explicit future owner-reviewed process that preserves the original evidence.

## Versioning and Migration

The current schema version is `1.0`; each record also carries a source-record version and policy versions. A future schema change must use an explicit new version, deterministic reader/migration rules, compatibility tests, and an append-only migration audit. Existing lines must not be edited in place.

## Future Production Storage Requirements

A production repository must preserve the same provider-neutral port while adding:

- transactional atomicity with Reservation Manager and Cost Ledger workflows where required;
- safe concurrent writers and database-assigned monotonic order;
- durable idempotency and uniqueness constraints;
- encryption at rest, access control, backup, recovery, and retention enforcement;
- tamper evidence, signed owner approvals, observability, and migration tooling;
- explicit failure and reconciliation behavior without silent repair.

That replacement must not move routing, budget, reservation, execution, accounting, portfolio, or trading logic into persistence.

## Known Limitations

- Local sequence atomicity is process-local; NDJSON is not multi-writer safe.
- Privacy enforcement is classification and export gating, not encryption.
- Secret detection is key-name based and cannot prove arbitrary values are safe.
- Payload integrity references are caller/source references, not cryptographic signatures.
- Subsystem ordering checks intentionally cover only unambiguous invalid predecessors.
- A terminal-record heuristic cannot prove that every business workflow is semantically complete.
- Related references are not automatically required for every record type.
- No automated retention, redaction, archival, authentication, transmission, or production database exists.
