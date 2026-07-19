# Production Persistence and Recovery Architecture Specification v1.0

Status: Architecture foundation; no production implementation
Date: 2026-07-19
Task: D6-T2 Production Persistence & Recovery Architecture Foundation

## 1. Purpose

Alpha currently has deterministic in-memory repositories and local append-only NDJSON repositories for single-owner development. Those repositories are useful for proving contracts, identity, append-only behavior, corruption detection, and local restart behavior. They are not production persistence.

This specification defines the future production persistence and recovery architecture that must exist before Alpha relies on durable evidence, live provider execution, live market data, broker integration, or integrated business runtime workflows.

This task defines architecture only. It does not implement production persistence, select a database engine, add dependencies, change repository behavior, change business logic, or begin D6-T3.

## 2. Scope

This specification covers future production requirements for:

- Production persistence
- Transaction boundaries
- Crash recovery
- Backup and restore
- Retention and archival
- Data durability
- Integrity verification
- Repository ownership
- Development versus production separation

It applies to current and future durable evidence repositories, including AI Cost Ledger, Unified Audit Repository, Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, Development Validation Log, and future Decision, Trade Outcome, Learning, Historical Pattern, Event Replay, and related evidence stores.

## 3. Non-Goals

D6-T2 does not:

- implement a production database;
- select a specific database, cache, queue, cloud, container, or storage vendor;
- add runtime persistence changes;
- change local NDJSON repositories;
- change Python or TypeScript runtime behavior;
- change AI Router behavior;
- add provider SDKs, live APIs, credentials, broker integration, market-data integration, or cloud storage;
- add migrations, backup jobs, restore tools, retention executors, encryption services, signing services, workers, schedulers, containers, or deployment infrastructure;
- populate the Development Validation Log;
- begin D6-T3.

## 4. Architecture Position

```text
Alpha domain engines and workflow coordinators
        |
        v
Provider-neutral repository ports
        |
        +--> Development repositories
        |       - in-memory
        |       - local append-only NDJSON
        |
        `--> Future production persistence boundary
                - transactional write boundary
                - durable idempotency and execution claims
                - recovery journal or outbox/inbox
                - backup, restore, retention, integrity verification
```

Domain engines must depend on provider-neutral repository ports and contracts, not on a selected storage engine. Production persistence is an infrastructure boundary beneath those ports. It must not become the owner of business policy, routing, budget approval, risk enforcement, portfolio state, trade execution, or AI model selection.

## 5. Development Persistence Boundary

Development persistence includes:

- in-memory repositories used by tests and local deterministic workflows;
- local append-only NDJSON repositories under Git-ignored `data/runtime/` paths;
- one-record-per-line canonical JSON storage where already implemented;
- local corruption detection and fail-closed reload behavior;
- single-owner, single-process assumptions;
- local path traversal protection;
- local append and flush behavior;
- deterministic tests that prove append-only, reload, idempotency, and corruption behavior.

Development persistence intentionally does not provide:

- multi-process safety;
- distributed locking;
- cross-repository transactions;
- production access control;
- encryption at rest;
- tamper-resistant signing;
- backup or restore guarantees;
- retention execution;
- concurrent sequence allocation;
- production crash recovery;
- provider-billing reconciliation;
- external service durability.

The current local NDJSON implementations remain approved for development use. D6-T2 does not replace them.

## 6. Production Persistence Boundary

Production persistence must provide durable evidence storage while preserving existing source-of-truth ownership:

- Reservation Manager owns current AI reservation state.
- AI Cost Ledger owns historical AI cost accounting events.
- Unified Audit Repository owns normalized evidence ordering and trace integrity.
- Prediction Log owns forecast, outcome, and review evidence.
- Alpha Journal owns context, rationale, reflection, and lessons.
- Research Lab owns research evidence, assumptions, uncertainty, conclusions, and reviews.
- Strategy Versioning owns immutable strategy definitions, versions, approval, activation, and rollback evidence.
- Development Validation Log owns structured engineering-task evidence.
- Future Decision and Trade Outcome repositories will own their own final decision and trade result evidence.

Production storage must preserve each repository port's provider-neutral contract. It may add infrastructure guarantees underneath the port, but it must not move domain rules into persistence.

## 7. Transaction Boundary Model

Alpha should use one of two owner-reviewed production transaction patterns for each workflow:

1. Single transactional boundary:
   - One durable transaction records every state change required for a logically atomic workflow step.
   - Uniqueness, sequence assignment, idempotency, operation result, source record, and audit evidence commit together where required.

2. Transactional outbox/inbox boundary:
   - The authoritative source state and an outbox message commit atomically.
   - Idempotent consumers apply downstream ledger, audit, notification, or integration effects.
   - Inbox records prevent duplicate consumption.
   - Poison messages, dead-letter review, replay, and manual reconciliation are explicit.

No production workflow may pretend that separate stores are atomic without one of these reviewed patterns.

## 8. AI Runtime Transaction Requirements

Before live AI provider execution, production persistence must define a crash-safe sequence for:

1. route selection evidence;
2. cost-governance decision;
3. reservation acquisition;
4. reservation acquisition ledger entry;
5. pre-execution audit evidence;
6. durable provider-execution claim;
7. provider execution result or failure evidence;
8. reservation settlement;
9. settlement ledger entry;
10. ledger reconciliation result;
11. final audit trace result;
12. workflow terminal result.

The provider-execution claim is mandatory. Recovery must be able to distinguish:

- provider not invoked;
- provider invocation claimed but not started;
- provider invoked and response persisted;
- provider invoked but response not persisted;
- provider invocation failed before cost-bearing work;
- provider invocation outcome unknown and requiring manual reconciliation.

When outcome is unknown, Alpha must not repeat cost-bearing provider execution automatically.

## 9. Business Evidence Transaction Requirements

Production repositories for Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, Development Validation Log, and future Decision/Trade/Learning systems must preserve append-only evidence and lifecycle integrity.

Examples of atomic write groups:

- Prediction outcome plus lifecycle transition.
- Prediction review start, review completion, and lifecycle transition when the workflow requires them together.
- Journal finalization plus initial lifecycle evidence.
- Research supersession plus successor/prior references.
- Strategy validation, owner approval, activation, and one-active-version enforcement.
- Development validation approval, commit evidence, push evidence, and handoff evidence when recorded as a structured workflow.
- Future final decision record plus references to frozen prediction, strategy, risk, and trade-plan evidence.

If a group cannot commit atomically, the production design must use a reviewed outbox/inbox or recovery model that preserves incomplete state explicitly and makes replay ownership clear.

## 10. Crash Recovery Requirements

Production recovery must be deterministic and evidence-preserving.

Recovery must:

- identify the last durable workflow stage;
- use idempotency keys and operation IDs rather than timestamps or guesses;
- replay only steps proven safe to replay;
- avoid repeating provider, broker, or other cost-bearing/external side effects unless an owner-reviewed execution claim proves they were not invoked;
- append recovery evidence rather than rewriting prior records;
- mark ambiguous external outcomes for manual reconciliation;
- preserve failed, partial, compensated, and warning states;
- reconstruct repository projections from durable source records;
- prove that recovery is repeatable and idempotent.

Recovery must not silently delete, repair, renumber, or rewrite historical evidence.

## 11. Backup Requirements

Production backup design must define:

- backup scope by repository and runtime environment;
- backup cadence and retention class;
- point-in-time consistency requirement;
- encryption and access control expectations;
- integrity manifests;
- restore rehearsal schedule;
- backup failure alerts and owner review;
- separation between source backups and exported reports.

Backups must preserve repository ownership and append-only history. Backup tooling must not become a mutation path for business records.

## 12. Restore Requirements

Production restore must be a reviewed operation with explicit evidence.

Restore design must define:

- restore target environment;
- restore point identity;
- integrity checks before exposure;
- repository sequence and uniqueness validation;
- cross-repository reference validation;
- privacy and retention classification preservation;
- owner approval requirement;
- rollback plan if restore validation fails;
- post-restore reconciliation of external provider, market, broker, and billing references when those systems exist.

A restore must not silently discard accepted records or manufacture missing evidence.

## 13. Retention and Archival Requirements

Current retention fields are metadata only. Production retention must define:

- retention classes and legal-hold behavior;
- which records are permanent evidence;
- which records may be archived;
- which records may be redacted or restricted;
- how append-only correction records preserve prior evidence;
- owner approval for destructive or privacy-sensitive actions;
- export restrictions for `LOCAL_ONLY` and sensitive records;
- audit evidence for every retention action.

Retention execution is deferred until a separate owner-reviewed task. No D6-T2 retention executor is implemented.

## 14. Durability and Integrity Requirements

Production persistence must provide:

- durable commits acknowledged only after storage durability requirements are met;
- monotonic repository sequence assignment under concurrency;
- uniqueness constraints for record IDs, operation IDs, idempotency keys, and source identities;
- canonical payload fingerprints or stronger integrity references;
- schema and policy version validation;
- corruption detection;
- read-only integrity reports;
- migration evidence;
- observability for failed writes, replay, recovery, and reconciliation.

Future tamper-resistant signing, stronger cryptographic hashing, encryption, identity verification, and owner-authentication mechanisms require separate security architecture review.

## 15. Repository Ownership Boundary

Persistence must store and retrieve records; it must not own the meaning of the records.

Rules:

- Router remains the only model selector.
- Cost Governor remains the AI operating-cost approval authority.
- Reservation Manager remains current reservation-state authority.
- Cost Ledger remains monetary historical truth.
- Unified Audit remains normalized evidence and trace truth.
- Prediction Log remains prediction truth.
- Alpha Journal remains context and reflection truth.
- Research Lab remains research truth.
- Strategy Versioning remains strategy truth.
- Development Validation Log remains engineering-memory truth.
- Future Decision Engine and Trade Outcome Log remain separate business authorities.

Cross-repository references must link sources of truth without copying authority.

## 16. Development vs Production

Development:

- optimized for local testing, inspectability, and low operating cost;
- may use in-memory and local NDJSON repositories;
- assumes single owner and single process;
- can fail closed on corruption without automatic repair;
- does not claim backup, restore, encryption, signing, or transaction guarantees.

Production:

- must be durable, recoverable, observable, access-controlled, and owner-reviewable;
- must define transactional or outbox-backed workflows;
- must include backup, restore, retention, migration, and integrity verification;
- must support concurrency according to approved deployment needs;
- must keep provider, market, broker, and credential integrations behind separate reviewed boundaries.

Development repositories may continue to exist after production repositories are added, but production code must not use development persistence by accident.

## 17. Deferred Work

Deferred to later owner-reviewed tasks:

- selecting a production persistence technology;
- implementing production repository adapters;
- implementing transactional outbox/inbox processing;
- implementing durable provider-execution claims;
- implementing backup and restore tooling;
- implementing retention or archival executors;
- implementing encryption, signing, key management, and owner authentication;
- implementing migration tools;
- integrating Python and TypeScript runtime persistence;
- integrating live providers, market data, brokers, or external APIs;
- populating Development Validation Log from Codex reports.

## 18. Validation Rules for Future Production Tasks

Future production persistence tasks must prove:

- no business logic moved into persistence;
- provider-neutral repository ports remain stable or have explicit migration specs;
- local development repositories still work;
- source-of-truth ownership remains unchanged;
- idempotency and uniqueness are deterministic;
- transaction or outbox boundaries are documented and tested;
- crash points have explicit recovery outcomes;
- backup and restore procedures are tested before production use;
- retention behavior is owner-approved;
- no provider, network, credential, broker, or market integration is added without separate approval;
- runtime data remains untracked by Git.

## 19. Known Risks

- Alpha still has no production database or durable multi-repository transaction boundary.
- Local NDJSON repositories remain unencrypted single-process development storage.
- A live provider cannot be safely enabled until durable execution claims and recovery behavior are implemented.
- Future production design must carefully separate evidence recovery from external side-effect replay.
- Backup, restore, retention, encryption, signing, and migration are now specified as requirements but remain unimplemented.

## 20. Success Criteria

D6-T2 succeeds when Alpha has a clear production persistence and recovery architecture foundation while existing local development persistence remains unchanged.

Success does not mean production readiness. It means future implementation tasks have explicit boundaries, transaction requirements, recovery rules, and deferred-work gates before any database, provider, broker, market, or runtime integration is introduced.
