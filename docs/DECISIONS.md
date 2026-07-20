# Alpha Architecture Decisions

## 2026-07-19 - D7-T1 Python-TypeScript Integration Boundary

### Contract and Port Before Runtime Implementation

- Decision: TypeScript application code depends on a versioned typed client and transport port, while a fixed Python entry point owns request dispatch to existing Python domain engines.
- Reason: Consumers must not depend on Python modules, shell commands, raw stdout, or Python exceptions, and the transport must remain replaceable.
- Consequence: The local subprocess is an adapter only. A future service transport can replace it without changing business consumers or registered operation contracts.

### Closed Operation Registry

- Decision: Python executes only exact operations in an immutable registry, beginning with the read-only `risk.calculate_limits` operation over the existing deterministic Risk Engine.
- Reason: Arbitrary module/function execution would create command-execution risk, weak validation, and unstable coupling; duplicating the risk calculation in TypeScript would create competing business logic.
- Consequence: New operations require mirrored contracts, validation, registration, focused tests, and architecture review. Caller-selected imports, module paths, functions, and process arguments are prohibited.

### Local Subprocess Foundation

- Decision: Use a fixed no-shell local subprocess with bounded JSON stdin/stdout, timeout, and output size for the current single-owner local runtime.
- Reason: Alpha already has a local Python prototype and TypeScript core, while HTTP, deployment, authentication, background services, and network operations are not justified for one read-only capability.
- Consequence: The synchronous adapter is not a production service boundary. Remote transport, retries, process supervision, mutable operations, cross-runtime transactions, and product wiring remain separate owner-reviewed work.

## 2026-07-19 - Day 6 Milestone Closeout

### Historical Evidence Infrastructure Completed for Local Foundations

- Decision: Close Day 6 with Codex workflow rules, production persistence architecture, Historical Pattern Library, Historical Analogy Engine, and Event Replay Architecture recorded as complete local foundations.
- Reason: The five Day 6 tasks establish development workflow, production-readiness boundaries, and deterministic historical evidence primitives without expanding into production systems.
- Consequence: Day 7 can plan integration work from stable documentation and contracts, but no Day 7 implementation is included in the closeout.

### Production Boundaries Remain Closed

- Decision: Keep production persistence, live provider adapters, live market data, broker integration, backtesting, execution simulation, Python/TypeScript runtime integration, and automated capital execution as future owner-reviewed work.
- Reason: Day 6 intentionally defined or implemented foundations only; production behavior requires separate architecture, validation, and owner approval.
- Consequence: Current repositories remain local single-owner development persistence, and Alpha remains a decision-support system with owner-controlled execution.

## 2026-07-19 - D6-T5 Event Replay Architecture Foundation

### Evidence Reconstruction, Not Backtesting

- Decision: Implement Event Replay as deterministic reconstruction of caller-supplied historical timelines, observation windows, and immutable checkpoints.
- Reason: Alpha needs stable chronology and replay provenance before research or learning systems cite event timelines.
- Consequence: Replay reports completeness, confidence, quality, missing data, and limitations, but it does not calculate returns, simulate execution, optimize strategy, or predict future outcomes.

### References Without Ownership Transfer

- Decision: Event Replay may freeze references to Historical Events, Historical Patterns, Historical Analogies, Research Lab, Prediction Log, Alpha Journal, snapshots, and supporting source evidence.
- Reason: Replay evidence should connect existing sources of truth without rewriting or replacing them.
- Consequence: Historical Pattern Library remains historical truth, Historical Analogy Engine remains comparison truth, Research Lab remains interpretation truth, and Decision/Risk/Portfolio/Trade systems retain authority.

### Local Append-Only Foundation

- Decision: Provide defensive in-memory and canonical local NDJSON repositories under `data/runtime/event-replays/` with no update, overwrite, or delete path.
- Reason: This matches Alpha's development persistence convention while avoiding premature production storage choices.
- Consequence: Local replay storage remains unencrypted single-owner, single-process development persistence. No provider, network, live-market, broker, Python, production persistence, or Day 7 work is added.

## 2026-07-19 - D6-T4 Historical Analogy Engine Foundation

### Deterministic Comparison, Not Prediction

- Decision: Compare frozen current-situation dimensions against exact finalized Historical Event or Historical Pattern versions with transparent integer basis-point arithmetic.
- Reason: Reproducible comparison evidence reduces subjective analogy while preventing AI-generated scoring or hidden model behavior from becoming authoritative.
- Consequence: Similarity, difference, completeness, evidence quality, candidate quality, and comparison confidence are separate; no score implies causation, future return, or a trading signal.

### Explicit Missing Data and Bias

- Decision: Every weight profile declares one missing-data policy, and every result preserves missing weight, exclusions, material differences, bias risks, and limitations.
- Reason: Treating unknown input as a neutral match would inflate similarity and conceal evidence weakness.
- Consequence: Required missing data may fail closed, be penalized, remain incomplete, or require review; high similarity with low completeness cannot be high quality.

### Frozen Authority Boundaries

- Decision: Historical Pattern Library remains historical truth and Research Lab remains interpretation truth; analogy records freeze exact candidate, snapshot, profile, method, and limitation evidence without mutating consumers.
- Reason: Comparison must not rewrite historical evidence or become an implicit Prediction, Strategy, Decision, or Risk override.
- Consequence: Later candidate, snapshot, profile, or method changes create a new analogy and append-only supersession. Prediction/Strategy references are compatibility boundaries only.

### Local Append-Only Foundation

- Decision: Provide defensive in-memory and canonical local NDJSON repositories under `data/runtime/historical-analogies/` with no update, overwrite, or delete path.
- Reason: The established development convention proves ordering, replay, corruption handling, privacy-aware export, and audit translation without selecting production storage.
- Consequence: Local storage remains unencrypted single-owner, single-process development persistence. No AI provider, network, embedding, vector database, live market data, Event Replay, broker, Python, or production persistence is added.

## 2026-07-19 - D6-T3 Historical Pattern Library Foundation

### Separate Historical Events from Reusable Patterns

- Decision: Historical Event records preserve what happened and under which regime; Historical Pattern records preserve reusable evidence-backed structures derived from one or more events.
- Reason: Treating an event as a pattern would hide sample size, exceptions, regime dependence, and the difference between observation and generalization.
- Consequence: Patterns require supporting finalized events and limitations, never claim guaranteed recurrence, and cannot become predictions or trading decisions.

### Preserve Fact and Interpretation Boundaries

- Decision: Store historical facts, quantitative observations, source claims, interpretations, inferences, hypotheses, disputed claims, counterevidence, and unknowns as distinct classifications.
- Reason: Historical narratives are exposed to hindsight and causal overstatement; confidence alone cannot convert an inference into fact.
- Consequence: Deterministic validation requires source evidence for factual claims and rejects structurally detectable inference-as-fact and guaranteed-recurrence language.

### Append-Only Historical Authority

- Decision: Finalized historical records are immutable; corrections, reviews, supersession, and archive state append new records without update, overwrite, or deletion.
- Reason: Later research or reinterpretation must not rewrite what evidence and classification were authoritative at an earlier time.
- Consequence: Repository sequence is authoritative, prior records remain visible, supersession rejects cycles, and local NDJSON remains development persistence only.

### Future Analogy Boundary

- Decision: Define only frozen queries and a provider-neutral input boundary for a future Historical Analogy Engine.
- Reason: Stable evidence contracts are needed now, but comparison, replay, backtesting, prediction, and capital decisions require separate specifications and owner review.
- Consequence: D6-T3 adds no analogy scoring, Event Replay, live data, provider/network integration, automated prediction, trading authority, or D6-T4 work.

## 2026-07-19 - D6-T2 Production Persistence and Recovery Architecture

### Architecture Before Production Storage

- Decision: Define production persistence, transaction, crash-recovery, backup, restore, retention, durability, integrity, and repository-ownership requirements before selecting or implementing any production storage technology.
- Reason: Alpha's current repositories are intentionally local and single-process; production durability affects evidence integrity, external side effects, owner review, and future capital safety.
- Consequence: D6-T2 adds architecture only. No production database, runtime persistence change, provider integration, network/API code, credential path, broker integration, or market integration is added.

### Preserve Development Persistence

- Decision: Keep existing in-memory and local NDJSON repositories as development persistence while documenting that they are not production storage.
- Reason: The local repositories remain valuable for deterministic tests and inspectable single-owner development.
- Consequence: Future production repositories must preserve provider-neutral ports and must not break local development repositories.

### Transaction or Outbox Required

- Decision: Production workflows must use either a single transactional boundary or a reviewed transactional outbox/inbox boundary for multi-step durable state.
- Reason: Separate repository appends cannot be treated as atomic, especially before live provider execution or future broker/market integrations.
- Consequence: Future implementation tasks must define crash points, replay ownership, idempotent consumers, poison/dead-letter handling, and manual reconciliation before production use.

### Durable Execution Claims

- Decision: Live provider execution requires a durable execution claim before any cost-bearing invocation.
- Reason: Recovery must distinguish not-invoked from invoked-but-not-persisted states without guessing or repeating external side effects.
- Consequence: Production providers remain blocked until durable execution claims and recovery behavior are implemented and owner-reviewed.

## 2026-07-19 - D6-T1 Development Efficiency Standard v1

### Quality-First Token Optimization

- Decision: Centralize repeated Codex execution, validation, reporting, owner-review, and Git-safety rules in `docs/CODEX_DEVELOPMENT_STANDARD.md`.
- Reason: Future tasks can use shorter prompts only after stable requirements are version-controlled and unambiguous.
- Consequence: Token optimization is accepted only when architecture quality, implementation quality, test coverage, validation rigor, owner review, auditability, and safety boundaries remain intact.

### Context Layers and Prompt Compression

- Decision: Use a five-layer context hierarchy covering permanent core context, architecture context, subsystem context, task context, and evidence context.
- Reason: Loading every specification for every task wastes context, but omitting relevant authority documents creates architecture drift.
- Consequence: Future prompts may reference the Codex standard and task template for stable rules, while uncertainty still requires targeted inspection rather than guessing.

### Validation Bundle Boundary

- Decision: Add a dependency-free local `npm run alpha:validate` bundle for existing safe checks while preserving individual commands.
- Reason: Alpha's validation workflow has become repetitive enough to centralize locally without adding dependencies, network access, provider SDKs, credentials, runtime-data mutation, or Git side effects.
- Consequence: The bundle is a convenience wrapper only. It does not replace task-specific validation judgment, owner approval, commits, pushes, or Development Validation Log persistence.

### D6-T2 Boundary

- Decision: D6-T1 does not begin Development Validation Log report integration, production persistence work, historical engines, or Python/TypeScript runtime integration.
- Reason: Those areas require separate specifications and owner review.
- Consequence: At D6-T1 completion, Day 6 had started but D6-T2 had not started. D6-T2 is now recorded as a separate architecture decision above.

## 2026-07-19 - Day 5 Learning Infrastructure Milestone

### Local Evidence Foundations Completed

- Decision: Close Day 5 with Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, and Development Validation Log implemented as deterministic provider-neutral TypeScript foundations.
- Reason: Together they establish distinct sources of truth for predictions, context and reflection, research, strategy lineage, and engineering-task evidence without transferring authority between systems.
- Consequence: The milestone provides contracts, validators, deterministic engines, focused tests, in-memory repositories, and local append-only NDJSON repositories where specified. It does not claim production persistence, cross-repository transactions, live data, provider execution, or Python/TypeScript runtime integration.

### Production and Day 6 Boundary

- Decision: Record Day 6 priorities as proposed follow-up work only; do not treat them as implemented or approved by the Day 5 closeout.
- Reason: Production hardening and development-workflow integration require separate specifications, owner review, and explicit scope.
- Consequence: Day 6 has not started. Current foundations remain single-owner local development systems, and all capital, provider, network, credential, and external-execution boundaries remain unchanged.

### Milestone References

- Prediction Log: `9677838c930c05d900eb8fa5c3b05af5bfa09a4a`
- Alpha Journal: `2098353a41215d70fcb02fff61f34e930a5ecea8`
- Research Lab: `41105b70254d94d9058fa9f4b958cbfbd8a3d579`
- Strategy Versioning: `50686a955930a182b49d6d9b02381d74974c71e2`
- Development Validation Log: `cc9fb3fb47b467764ee9227993e77047a5c1a11d`

## 2026-07-18 - Development Validation Log Foundation

### Structured Engineering Memory, Not a Git Replacement

- Decision: Development Validation Log is the append-only authority for structured task, scope, validation, warning, defect, risk, owner-decision, Git-reference, handoff, lesson, and follow-up evidence.
- Context or problem: Git proves code history but does not preserve the complete requested goal, validation meaning, environment warnings, accepted risks, approval conditions, and follow-up context.
- Rationale: One immutable sequence-ordered record per engineering event preserves historical intent without copying raw diffs or logs.
- Consequences: Git remains code/version-history truth, Unified Audit remains trace truth, HANDOFF/CHANGELOG remain summaries, Alpha Journal remains reflection truth, and issue tracking remains future external work.

### Deterministic Lifecycle and Owner Authority

- Decision: Enforce ordered task evidence from PLANNED through implementation, validation, owner review, approval, commit, push, handoff, and close; require owner identity for review/approval/rejection; reject AI owner impersonation.
- Context or problem: Recording approval, commit, or push out of order would make workflow evidence misleading and weaken the existing owner-controlled Git process.
- Rationale: Explicit status transitions and category-specific requirements make every milestone independently reviewable.
- Consequences: Blocking failures prevent approval unless an immutable owner exception names the evidence, reason, and follow-up. Environment warnings remain distinct from code failures.

### Git Evidence Is Supplied, Never Executed

- Decision: Store structured branch, base commit, resulting commit, message, remote, push, synchronization, and working-tree evidence supplied by the workflow; never invoke Git from the subsystem.
- Context or problem: A record repository that performs Git operations would mix evidence ownership with side effects and duplicate Git authority.
- Rationale: Pure reference validation preserves a narrow deterministic boundary and supports local tests without repository mutation.
- Consequences: The caller remains responsible for verifying external Git facts. The log detects internal conflicts but does not fetch, commit, push, tag, or repair history.

### Local Persistence and Day 6 Boundary

- Decision: Provide defensive in-memory and canonical append-only local NDJSON repositories only; defer report-convention and automation integration to a separately reviewed Day 6 task.
- Context or problem: Alpha needs a structured record target before defining a future Codex development standard, but must not begin that standard implicitly.
- Rationale: Existing local event-store patterns prove identity, sequence, replay, privacy, export, corruption, and path behavior at low cost.
- Consequences: Files are unencrypted, single-process development storage without cross-system transactions. No `CODEX_DEVELOPMENT_STANDARD`, provider/network integration, business-logic mutation, or future-task creation is included.

## 2026-07-18 - Strategy Versioning Foundation

### Immutable Authority and Semantic Lineage

- Decision: Strategy Versioning is the sole authority for immutable strategy definitions, version snapshots, semantic lineage, lifecycle history, and explicit changes.
- Context or problem: Mutable strategy settings cannot prove which rules, parameters, assumptions, evidence, or risk boundaries governed a historical decision.
- Rationale: Content-derived identity, direct-parent lineage, exact PATCH/MINOR/MAJOR enforcement, and append-only events prevent hindsight rewriting.
- Consequences: Draft editing remains outside the authoritative repository. Published versions are never updated or deleted, and material changes require evidence.

### Owner-Controlled Lifecycle and Active-Version Invariant

- Decision: Authoritative versions begin PROPOSED; validation and approval are separate; only the owner can approve or reject; activation requires passed validation and valid owner approval; at most one version per definition is ACTIVE.
- Context or problem: AI or subsystem self-approval would collapse recommendation and authority, while multiple active versions would make decision provenance ambiguous.
- Rationale: Explicit lifecycle gates preserve human control and deterministic eligibility.
- Consequences: AI may propose or analyze but cannot approve or activate. Suspension blocks new plan freezes, rejection remains visible, and retirement preserves history.

### Trade-Plan Freeze and Rollback Policy

- Decision: A new trade plan may reference only an ACTIVE strategy and freezes its exact version, ruleset fingerprint, parameters, risk-policy reference, decision timestamp, and owner approval. Rollback always creates a new version.
- Context or problem: Referencing a mutable or merely latest strategy would let later changes silently alter historical intent.
- Rationale: Frozen references preserve the rule set used at decision time; a new rollback version preserves both failure and recovery evidence.
- Consequences: The foundation defines a contract only. It adds no trade repository, broker, execution, or automatic restoration path.

### Evidence Ownership, Performance, and Local Persistence

- Decision: Link external evidence through typed frozen references, keep prediction accuracy, trading profitability, and process quality metrics separate, and provide only in-memory plus canonical local NDJSON persistence in v1.
- Context or problem: Copying source records would create conflicting authorities, blended performance would hide causes, and production integration is not yet approved.
- Rationale: References and separated metric groups preserve provenance; narrow append-only repositories prove behavior without operational overclaim.
- Consequences: Prediction Log, Research Lab, Alpha Journal, and Unified Audit retain their ownership. Local files remain unencrypted, single-process development storage with no provider, network, live-market, credential, or cross-repository transaction guarantee.

## 2026-07-18 - Research Lab Foundation

### Append-Only Research Authority

- Decision: Research Lab is the source of truth for structured point-in-time research evidence and conclusions; authoritative records begin finalized and are never updated or deleted.
- Context or problem: The prior generic Research placeholder exposed create, update, and delete operations and could not preserve what evidence justified a conclusion before later information arrived.
- Rationale: Canonical content-derived identity, complete draft-to-finalized provenance, immutable evidence, and separate amendments, reviews, and supersession preserve historical honesty.
- Consequences: Draft collection and analysis remain workspace state. Finalized and superseded research, sources, assumptions, counterevidence, and uncertainty remain retrievable.

### Evidence Ownership and Frozen References

- Decision: Research Lab links to Prediction Log, Alpha Journal, Unified Audit, and future Strategy/Historical systems only through stable typed resolved/unresolved references.
- Context or problem: Copying or mutating records across systems would create conflicting authorities and allow later research to rewrite locked predictions.
- Rationale: Frozen research version, status, conclusion, and confidence references give downstream systems sufficient evidence without transferring ownership.
- Consequences: Prediction Log remains prediction truth, Alpha Journal remains context/reflection truth, Unified Audit remains normalized trace truth, and future Strategy Versioning remains the only strategy-state authority.

### Local Persistence and External Integration Boundary

- Decision: Research Lab v1 provides deterministic in-memory and canonical append-only local NDJSON repositories only.
- Context or problem: Alpha needs reviewable local evidence before approving production storage, live sources, or provider integrations.
- Rationale: A narrow single-process repository proves validation, ordering, replay, privacy, and corruption behavior without network or operational complexity.
- Consequences: Local files are unencrypted and not multi-writer or transactionally coordinated. No market-data API, scraping, provider SDK, credential, AI generation, Strategy Versioning, historical engine, or business execution is included.

## 2026-07-18 - Alpha Journal Foundation

### Authoritative Evidence, Not Mutable Notes

- Decision: Store only finalized Journal entries in the authoritative repository; keep draft workspace behavior outside the append-only port.
- Context or problem: Mutable draft and finalized records in one repository would blur when a note becomes evidence and permit hindsight overwrite.
- Rationale: Finalization as the first event produces a clear evidence boundary while append-only reviews, amendments, and archive history preserve later knowledge honestly.
- Consequences: There is no update, overwrite, or delete interface. Reviews and amendments never replace original text or context.

### Typed Evidence Without Ownership Transfer

- Decision: Link Prediction, Research, Decision, Trade, Strategy, Portfolio, Audit, Journal, and Development Validation records through stable typed resolved/unresolved references.
- Context or problem: Copying external records into Journal would duplicate sources of truth, while untyped IDs would weaken traceability.
- Rationale: Typed references preserve subsystem ownership and support future systems that do not exist yet.
- Consequences: Prediction Log remains prediction truth. Journal cannot mutate predictions, strategies, trades, decisions, or portfolio state.

### Privacy-Aware Local Event Store

- Decision: Use deterministic in-memory and canonical local NDJSON event repositories with non-public defaults and restricted export.
- Context or problem: Personal evidence can be sensitive and needs inspectable durability before a production database is selected.
- Rationale: Existing Alpha event-store conventions provide monotonic ordering, idempotency, defensive copies, strict reload, and low operating cost without new dependencies.
- Consequences: `LOCAL_ONLY` cannot be externally exported and sensitive export may require authorization. Local files remain unencrypted, single-process, and non-production.

## 2026-07-18 - Prediction Log Repository and Review Lifecycle

### Prediction as Immutable Evidence

- Decision: Treat the canonical prediction snapshot as immutable evidence identified deterministically from its complete canonical content.
- Context or problem: Mutable status, amendment, resolution, and deletion operations could allow hindsight changes and weaken later learning evidence.
- Rationale: Append-only lifecycle events preserve what Alpha expected before outcome while still allowing state reconstruction and review.
- Consequences: The repository exposes no delete or overwrite path. Outcome, review, and archival information is appended as new linked records.

### Accuracy and Profitability Separation

- Decision: Store and aggregate prediction accuracy independently from trading profitability.
- Context or problem: A correct forecast does not guarantee profitable execution, and profitability does not prove forecast quality.
- Rationale: Separate classifications and rationales allow future Learning Loop and Trade Outcome analysis to attribute forecast, decision, execution, and position-sizing quality honestly.
- Consequences: No component may derive one measurement from the other. Not-applicable and indeterminate cases remain explicit.

### Local Event-Store Boundary

- Decision: Use defensive in-memory storage and append-only local NDJSON event persistence for the Day 5 foundation.
- Context or problem: Alpha needs reviewable local prediction history before selecting a production database or integrating later business systems.
- Rationale: A versioned event envelope proves the repository port and restart reconstruction with no new dependency or external service.
- Consequences: The local store is single-owner and single-process only. It does not provide cross-record transactions, signing, encryption, backup, multi-writer coordination, or production crash recovery.

## 2026-07-18 - Alpha AI Infrastructure v1 Milestone

### Provider-Independent Foundation Completed

- Decision: Accept AI Infrastructure v1 as the implemented and tested deterministic foundation spanning Router, Cost Governor, Provider Adapter boundary, Execution Coordinator, Reservation Manager, Cost Ledger, Unified Audit Repository, and Runtime Workflow.
- Rationale: Provider-neutral contracts and explicit subsystem authority prevent the first live provider from defining Alpha's business, budget, accounting, or audit architecture.
- Consequences: The milestone contains no production adapter or live API integration. AI remains advisory and cannot mutate capital state.

### Production Provider Gate

- Decision: Do not add or enable a production provider until durable execution claims and transactional or reviewed outbox/inbox behavior for workflow, reservation, ledger, and audit state receive owner review.
- Rationale: Repository-level idempotency cannot safely infer whether a cost-bearing external call occurred before a crash.
- Consequences: Production credentials, adapters, billing reconciliation, health polling, and rollout remain separate future tasks.

### Specification and Local Persistence Policy

- Decision: Major subsystems require an approved specification before implementation. Local canonical NDJSON is approved only for current single-owner, single-process development.
- Rationale: Specifications stabilize ownership and failure boundaries; local files provide inspectable development durability without pretending to be a production database.
- Consequences: Cost Ledger remains monetary truth and Unified Audit Repository remains evidence truth. Local persistence provides no cross-repository transaction, encryption, backup, archival, or multi-writer safety.

### Milestone References

- AI Router foundation: `3e47739ffb956621fdba8c22b39e023ac544eb27`
- AI Cost Governor foundation: `20993926a532e91625807df1ff7a760dd4b7a397`
- Alpha AI Infrastructure v1: `780ca3a9ebd889cab05c479f0a7270cf08f61f8e`

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
- Consequences: Day 4 followed this order through AI Infrastructure v1. Future major subsystems must continue to stabilize specifications, record ownership, and persistence behavior before orchestration or external integration.
