# Alpha Architecture Decisions

## 2026-07-18 - Deterministic AI Runtime Orchestration

### Thin Workflow, Existing Authorities

- Decision: Coordinate the provider-neutral AI lifecycle in one deterministic workflow while leaving Router, Cost Governor, Reservation Manager, Cost Ledger, Unified Audit Repository, and Execution Coordinator authoritative for their existing responsibilities.
- Context or problem: Correct standalone components did not prove safe ordering or identity continuity across a complete request.
- Rationale: A thin orchestration boundary prevents bypass of routing, budget, reservation, accounting, and audit gates without duplicating subsystem policy.
- Consequences: Router remains the only model selector, Cost Ledger remains the monetary source of truth, Unified Audit remains the evidence source of truth, and the workflow owns no capital-domain behavior.

### Replay Boundary Before Provider Invocation

- Decision: Store a canonical complete workflow result by workflow and idempotency identity and return it for exact replay without re-entering orchestration.
- Context or problem: Repository-level idempotency cannot make a repeated external provider invocation harmless.
- Rationale: The workflow result is the minimum local execution-deduplication boundary and makes caller replay deterministic.
- Consequences: The v1 repository is in memory and defensive but not durable. Production requires a durable execution claim that can distinguish not-invoked from invoked-with-unpersisted-response states.

### Explicit Compensation, No Fake Atomicity

- Decision: Report ordered compensation actions and replay/manual-reconciliation dispositions rather than claim rollback across separate repositories.
- Context or problem: Reservation, ledger, audit, workflow, and provider execution do not share a transaction.
- Rationale: Explicit release, ledger replay, audit replay, and manual reconciliation preserve evidence and prevent hidden repeated execution.
- Consequences: A later failure never silently reverses a successful monetary transition or reruns a provider. Production requires a transactional store or reviewed outbox/inbox design before live providers are enabled.

## 2026-07-18 - Unified Append-Only Audit Evidence

### Evidence Index, Not Business Authority

- Decision: Normalize subsystem audit records behind one append-only evidence repository while leaving each source system authoritative for its decisions and state.
- Context or problem: Router, cost, reservation, execution, and ledger audits otherwise cannot be reviewed as one deterministic chain.
- Rationale: Stable cross-system references and trace reconstruction improve review and debugging without coupling source engines or duplicating business logic.
- Consequences: The repository never routes, approves budget, mutates reservations, executes providers, or calculates monetary usage. The Cost Ledger remains the accounting source of truth.

### Repository Sequence and Privacy Boundary

- Decision: Assign atomic monotonic audit sequences independently from timestamps and require privacy and retention classifications on every normalized record.
- Context or problem: Equal or delayed timestamps cannot uniquely order evidence, while unclassified exports could cross local or sensitive boundaries.
- Rationale: Repository order, explicit stale-import policy, privacy downgrade prevention, and export authorization produce deterministic and reviewable behavior.
- Consequences: `LOCAL_ONLY` evidence cannot enter external exports; configured `SENSITIVE` exports require authorization. Retention remains metadata only and no update/delete interface exists.

### Canonical Local Persistence

- Decision: Use canonical append-only NDJSON under a Git-ignored audit runtime directory for current single-owner development.
- Context or problem: Restart-persistent evidence is useful now, but selecting a production database before transactional requirements are reviewed would be premature.
- Rationale: The existing Cost Ledger storage pattern provides a small, inspectable durability proof using only the standard library.
- Consequences: Reload fails on malformed, truncated, duplicate, non-canonical, or sequence-inconsistent data. The implementation is not concurrent-writer safe, encrypted, authenticated, or a production transaction boundary.

## 2026-07-18 - Append-Only AI Cost Accounting

### Ledger Sequence as Accounting Order

- Decision: AI cost events are immutable and ordered by repository-assigned monotonic sequence rather than caller timestamp.
- Context or problem: Equal, stale, retried, or delayed timestamps cannot provide unique accounting order, and rewriting history would hide operational inconsistencies.
- Rationale: Atomic local sequence assignment, immutable caller identities, and canonical payload fingerprints make replay and reconciliation deterministic.
- Consequences: Identical idempotent replay retains the original entry and sequence. Out-of-order business timestamps fail closed unless policy explicitly allows and flags them.

### Local NDJSON Persistence Boundary

- Decision: The current durable local ledger uses canonical newline-delimited JSON under a Git-ignored runtime directory, with strict reload validation and no new dependency.
- Context or problem: Alpha needs restart-persistent accounting during single-owner development without prematurely selecting a production database, ORM, or distributed coordination model.
- Rationale: Append-only standard-library files preserve history, remain inspectable, and prove the persistence port while keeping implementation and operating cost low.
- Consequences: The repository flushes each append and refuses corrupt, truncated, duplicate, non-canonical, or traversal-derived input. It is single-process only; a future transactional store must atomically coordinate reservation, ledger, operation, and audit records.

### Manual Adjustments Are New Authorized Events

- Decision: A manual adjustment is permitted only by explicit policy and authorization reference and is always a new signed append-only event.
- Context or problem: Owner corrections are sometimes necessary, but altering prior entries would destroy the accounting trail.
- Rationale: A dedicated signed delta with reason and target scope preserves both the original event and its correction.
- Consequences: Normal entries remain non-negative. Adjustments cannot delete, replace, convert, or silently repair prior history.

## 2026-07-18 - Deterministic AI Reservation Lifecycle

### Versioned Reservation State Machine

- Decision: Approved Cost Governor plans are acquired and settled only through explicit reservation states with safe integer amount conservation and compare-and-set versions.
- Context or problem: Read-only budget snapshots cannot prevent duplicate acquisition, stale overwrite, double settlement, or indefinitely retained unused amounts.
- Rationale: A small provider-independent state machine makes accounting transitions deterministic and independently testable before any live provider is introduced.
- Consequences: `COMMITTED`, `RELEASED`, `EXPIRED`, `CANCELLED`, and `REJECTED` are terminal. Partial settlement preserves committed usage and releases only the remainder.

### Idempotent Operations and Instruction-Only Ledger Boundary

- Decision: Every mutation requires caller-supplied deterministic operation and idempotency IDs; successful operations return append-only ledger instructions but do not persist Cost Ledger entries.
- Context or problem: Retries must reproduce their original outcome without applying cost twice, while durable cross-system audit storage is not yet approved.
- Rationale: Canonical payload fingerprints, stored original results, operation uniqueness, and optimistic versions provide a clear local transaction boundary without introducing a database prematurely.
- Consequences: The in-memory reservation repository is test/local only and is not distributed-safe. The Cost Ledger can now persist instructions locally, but production storage must atomically persist reservation state, operation results, ledger entries, and audits behind provider-neutral ports.

## 2026-07-18 - Deterministic AI Execution Coordination

### Single-Attempt Coordination

- Decision: The execution coordinator validates immutable Router, Cost Governor, reservation, adapter, health, and trace inputs before invoking exactly one selected adapter.
- Context or problem: A live orchestration layer could otherwise reroute, bypass budget approval, retry without cost visibility, or hide inconsistent references.
- Rationale: A single-attempt deterministic boundary completes the pipeline while preserving upstream ownership and making every outcome auditable.
- Consequences: The coordinator never selects another provider/model or runs a retry loop. Invalid or missing inputs fail closed before adapter execution.

### Instruction-Only Retry and Settlement

- Decision: Retry, return-to-Router, reservation release/retain, and usage commit are returned as deterministic plans and instructions rather than executed side effects.
- Context or problem: Durable reservation and ledger services do not exist, and hidden retries could create unapproved cost.
- Rationale: Explicit instructions preserve future transactional boundaries and owner visibility without pretending persistence or idempotency is solved.
- Consequences: The deterministic local Runtime Workflow now enacts settlement instructions and returns retry/fallback control explicitly. Durable production persistence and recovery remain separate reviewed work.

## 2026-07-18 - AI Provider Adapter Execution Boundary

### Provider-Neutral Execution Contract

- Decision: Future provider integrations must implement a shared request, response, compatibility, health, usage, and normalized-error interface after Router selection and Cost Governor approval.
- Context or problem: Adding a first provider directly to the Router or business modules would expose vendor types and make that provider the implicit execution architecture.
- Rationale: A narrow adapter interface preserves replaceability and keeps core logic independent from SDKs, credentials, and provider-native behavior.
- Consequences: Adapters execute only the selected provider/model and must preserve routing, cost-decision, reservation, trace, and correlation references.

### Coordination and Adapter Separation

- Decision: Adapters report outcomes and retryability but do not route, retry, approve cost, acquire or commit reservations, persist data, or select fallbacks.
- Context or problem: Combining these responsibilities would let vendor integrations bypass deterministic policy and create unclear budget ownership.
- Rationale: The execution coordinator can own a single attempt while the separate Reservation Manager owns reservation lifecycle and adapters remain translation boundaries.
- Consequences: The adapter foundation includes only contracts, validation, an in-memory registry, and a test-local fixture. Production adapters and durable reservation persistence require separate owner-reviewed tasks.

## 2026-07-18 - Deterministic AI Cost Governor Boundary

### Integer Monetary Enforcement

- Decision: AI cost policy is evaluated in non-negative safe integer minor units under one declared currency and scale.
- Context or problem: Floating-point arithmetic and mixed currencies can make exact budget boundaries ambiguous.
- Rationale: Integer arithmetic makes equality, remaining budget, reservations, and audit values deterministic.
- Consequences: The Router boundary converts major-unit estimates once using a 1,000,000-unit scale; invalid, unsafe, or currency-mismatched values fail closed.

### Reservation and Persistence Separation

- Decision: The foundation returns a reservation plan and defines a ledger repository port but performs no persistence or provider execution.
- Context or problem: Reliable production budget enforcement requires durable transactional reservation storage and reconciliation; the implemented in-memory Reservation Manager is not sufficient for that boundary.
- Rationale: Separating pure evaluation from atomic acquisition keeps policy testable while making the future consistency boundary explicit.
- Consequences: An allowed plan is not permission to execute until the Reservation Manager acquires it. Commit, release, and expiry now exist in memory; durable atomic state, ledger, audit, and usage reconciliation remain separate reviewed work.

### Router Integration Boundary

- Decision: Router estimates and aggregate usage are translated through a provider-neutral mapping boundary before governor evaluation.
- Context or problem: Directly embedding budget persistence or provider concerns in the Router would couple planning, enforcement, and execution.
- Rationale: A narrow mapping preserves existing Router behavior and lets both engines evolve behind stable contracts.
- Consequences: Core business logic depends only on neutral contracts; future provider or ledger implementations do not change capital-domain rules.

## 2026-07-18 - Deterministic AI Router Planning Boundary

### Provider-Independent Selection

- Decision: The AI Router planning engine evaluates provider-neutral profiles using hard eligibility constraints followed by deterministic, stable ordering.
- Context or problem: Alpha needs to balance capability, privacy, reliability, latency, context, and cost without coupling business logic to a provider or introducing random routing.
- Rationale: Provider-neutral contracts and explicit rejection and ranking rules allow providers and models to be replaced through configuration while keeping every selection reproducible and auditable.
- Consequences: Provider display names never affect selection, all rejected candidates retain normalized reasons, and identical request, configuration, budget, and clock snapshots produce identical decisions.

### Planning and Execution Separation

- Decision: The minimum Router Engine ends after returning a routing decision, fallback plan, and audit record.
- Context or problem: Combining selection with provider execution would introduce SDK, credential, network, retry, and persistence concerns before the deterministic boundary is proven.
- Rationale: A planning-only engine is easier to validate and preserves the architecture rule that provider adapters remain replaceable infrastructure.
- Consequences: The engine performs no network calls, model invocation, retries, audit persistence, or business action. Those capabilities require separate reviewed tasks.

## 2026-07-16 - Architecture Consistency Review

### Prediction Freeze Placement

- Decision: Finalize and freeze prediction records before the final capital decision and execution.
- Context or problem: Predictions recorded after decisions or execution could be changed with hindsight.
- Rationale: Preserving the original forecast enables an honest comparison between prediction quality, decision quality, execution quality, and outcomes.
- Consequences: Later evidence must be stored as a linked amendment or resolution and must not rewrite the original prediction.

### Decision Engine Ownership

- Decision: Specialized systems own opportunity evaluation, prediction records, instrument ranking, and risk constraints. The Decision Engine combines those outputs and owns the final capital decision and approved trade plan.
- Context or problem: Broad Decision Engine responsibilities overlapped with specialized systems and made ownership unclear.
- Rationale: Explicit boundaries prevent duplicated logic and preserve independent evaluation stages.
- Consequences: The Decision Engine coordinates validated outputs but does not replace upstream evaluation or Risk Engine enforcement.

### Execution Boundary

- Decision: Execution remains external and owner-controlled. Future broker integration must not bypass owner approval, the frozen trade plan, or Risk Engine limits.
- Context or problem: Alpha is a decision-support system, and execution authority must remain explicit.
- Rationale: Owner control and deterministic risk enforcement protect capital and prevent unauthorized automated execution.
- Consequences: Execution automation requires separate approval and must preserve the existing approval and risk boundaries.

### Learning and Strategy Approval

- Decision: The Learning Loop proposes improvements, Strategy Versioning reviews changes, and the owner approves activation or rollback. Automatic production strategy replacement is prohibited.
- Context or problem: Learning outputs must not silently alter active production strategies.
- Rationale: Separating proposal, review, and approval protects historical integrity and prevents reactive strategy changes.
- Consequences: Old strategy versions remain available, and every activation or rollback requires an auditable owner approval.

### Implementation Order

- Decision: Define deterministic record and storage contracts before implementing the new intelligence and learning systems. Add AI Router integration only after deterministic boundaries are stable.
- Context or problem: Implementing orchestration before stable system contracts would create unclear dependencies and provider coupling.
- Rationale: Deterministic contracts provide reliable ownership, validation, storage, and enforcement boundaries.
- Consequences: Record schemas and storage behavior are the next architecture task; AI routing remains downstream work.
