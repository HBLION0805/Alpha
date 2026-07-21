# Alpha Architecture

> Alpha System Architecture

---

# Vision

Alpha is a Personal Capital Operating System designed to help protect, allocate, grow, and compound capital over the long term.

Alpha is not a trading bot.

Alpha is not an automatic execution system.

Alpha is a decision-support platform that helps its owner make disciplined financial decisions.

---

# Mission

The mission of Alpha is to transform small amounts of capital into long-term wealth through:

- Capital protection
- Intelligent allocation
- Disciplined execution
- Continuous learning
- Long-term compounding

Short-term trading exists only to support long-term investing.

---

# System Philosophy

Protect Capital
|
v
Allocate Capital
|
v
Grow Capital
|
v
Compound Capital

---

# Core Architecture

Alpha consists of the following major systems.

## Current Runtime Boundary

Alpha currently has two implementation surfaces connected by one narrow local read-only boundary:

- The Python prototype/runtime contains local portfolio models, a terminal dashboard using sample data, deterministic risk calculations, configuration, and early stock/event-contract decision rules.
- The TypeScript core contains record contracts, repository ports, implemented Opportunity and Prediction engines, AI Infrastructure v1, the Day 5 learning foundations, the Historical Pattern Library, the Historical Analogy Engine foundation, the Event Replay Architecture foundation, and Day 7 read-only validation, evidence-surface, and cross-system-linking foundations.

The TypeScript application layer may invoke only the registered `risk.calculate_limits` operation through a versioned client and transport port. A fixed local subprocess entry point validates and dispatches the request to the existing Python Risk Engine. No dashboard or product consumer uses the boundary yet. Python does not invoke TypeScript, and TypeScript does not modify Python portfolio, risk, decision, or trade state.

## Python-TypeScript Integration Boundary

Responsible for:

- Preserving a versioned provider-independent request and response contract across runtimes
- Keeping TypeScript consumers independent from Python modules, commands, exceptions, and serialization details
- Restricting invocation to an explicit immutable Python operation registry
- Validating requests and responses on both sides
- Normalizing validation, compatibility, domain, transport, timeout, protocol, and internal failures
- Returning minimal request, operation, duration, status, contract-version, and completion metadata without logging payloads

The initial transport starts a configured Python executable without a shell and always invokes the fixed `app.integration.entrypoint` module. JSON passes through stdin/stdout under bounded timeout and output limits. The transport is replaceable behind a TypeScript port.

The only v1 operation is the read-only deterministic Risk Engine limit summary. The boundary owns translation and validation only; Python Risk Engine retains calculation authority. There is no dashboard integration, mutable operation, service deployment, remote network, retry loop, AI call, provider SDK, credential, broker, live-market source, or cross-runtime transaction.

## Production Persistence and Recovery

Responsible for:

- Defining future durable repository, transaction, crash-recovery, backup, restore, retention, and integrity requirements
- Preserving the existing development persistence model while making clear that local NDJSON is not production storage
- Requiring transactional or reviewed outbox/inbox boundaries before production workflows depend on multi-repository durability
- Requiring crash-safe execution claims before any live provider, broker, market, or other external side effect can be enabled
- Keeping repository persistence beneath provider-neutral ports without moving domain logic into storage

D6-T2 defines this architecture in `docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md`. It does not implement a database, change local repositories, change runtime behavior, add provider/network/credential integration, or begin D6-T3.

## Portfolio System

Responsible for:

- Capital allocation
- Portfolio tracking
- Cash management
- Asset distribution

---

## Dashboard

Responsible for:

- Daily overview
- Opportunity monitoring
- Portfolio status
- Risk status

---

## Decision Engine

Responsible for:

- Combining research, opportunity, prediction, instrument, and risk outputs
- Producing the final capital decision
- Producing and preserving the final decision record
- Producing an approved trade plan when action is justified

The Decision Engine does not replace the specialized evaluation systems. It coordinates their outputs and may return WAIT, Cash, or NO TRADE.

---

## Config System

Responsible for:

- Global configuration
- Strategy settings
- Risk parameters
- System options

---

## Risk Engine

Responsible for:

- Position sizing
- Maximum daily loss
- Portfolio exposure
- Capital preservation

---

## Research Framework

Responsible for:

- Research methodology
- Evidence and source standards
- Separation of verified facts, inferences, assumptions, and unknowns
- Scenario and confidence requirements
- Research report structure

---

## Opportunity Score Engine

Responsible for:

- Evaluating opportunity quality
- Determining whether an opportunity deserves further consideration
- Tracking opportunity state and confidence
- Advancing, waiting, rejecting, or archiving opportunities

The Opportunity Score Engine evaluates the opportunity itself. It does not select an execution instrument.

---

## Instrument Ranking Engine

Responsible for:

- Comparing eligible execution instruments
- Evaluating execution quality and holding-period suitability
- Ranking instruments by capital protection, risk-adjusted return, and execution quality
- Returning WAIT or Cash when no instrument is suitable

---

## AI Infrastructure v1 Flow

```text
Provider-neutral advisory request
  -> AI Router
  -> AI Cost Governor
  -> AI Reservation Manager
  -> AI Cost Ledger reservation append
  -> Unified Audit pre-execution evidence
  -> AI Execution Coordinator
  -> AI Provider Adapter boundary
  -> Reservation settlement
  -> Cost Ledger settlement and reconciliation
  -> Unified Audit final trace
```

Router selects models deterministically. Cost Governor decides whether AI operating cost is permitted. Reservation Manager owns current reservation state. Cost Ledger is the monetary source of truth for historical AI cost events. Unified Audit Repository is the evidence-ordering and trace-integrity source of truth. Runtime Workflow coordinates these authorities without replacing them.

The current adapter boundary has no production adapter, SDK, credentials, network transport, or live model call. Neutral test fixtures prove the contract only. AI output remains advisory and cannot approve or mutate portfolio, risk, decision, trade, or strategy state.

---

## AI Router

Responsible for:

- Deterministically planning the most appropriate eligible AI model
- Balancing capability, cost, and speed
- Remaining provider-independent
- Supporting future AI models without redesign

The current Router stops at selection, fallback planning, and in-memory audit generation. It does not call providers.

---

## AI Cost Governor

Responsible for:

- Deterministically evaluating estimated AI cost before execution
- Enforcing versioned per-request, daily, monthly, task, provider, and model budgets
- Accounting for committed and reserved usage
- Requiring low-cost mode at soft thresholds and rejecting hard-limit breaches
- Returning bounded critical-override decisions, reservation plans, and audit records

The AI Cost Governor is provider-independent and uses integer minor-unit arithmetic. It returns plans but does not acquire reservations, ingest live usage, or call providers.

---

## AI Reservation Manager

Responsible for:

- Atomically acquiring an approved Cost Governor reservation plan in one repository boundary
- Applying versioned commit, partial commit, release, expiration, cancellation, and rejection transitions
- Enforcing idempotency, amount conservation, currency identity, and optimistic concurrency
- Returning append-only Cost Ledger instructions and complete in-memory audits
- Providing a deterministic in-memory repository for tests and local use

The manager does not approve cost, route, execute AI, call providers, or persist a durable ledger. The in-memory repository is not durable or distributed-safe. A production replacement must preserve the same port while transacting reservation state, operation history, ledger entries, and audit records atomically.

---

## AI Cost Ledger

Responsible for:

- Appending immutable reservation, usage, release, expiration, override, and manual-adjustment accounting events
- Assigning deterministic monotonic accounting sequences independently from caller timestamps
- Preventing duplicate entry, operation, idempotency, and execution-settlement identities
- Returning stable currency-separated queries and usage summaries
- Reconciliation that reports reservation accounting inconsistencies without changing source state
- Providing in-memory and local append-only NDJSON repository implementations behind a durable persistence port

The Cost Ledger is the source of truth for historical AI cost events, while the Reservation Manager remains the source of truth for current reservation state. The local file repository is single-process personal-development storage, not a production transactional database. It contains no prompts, credentials, provider payloads, routing logic, budget approval, or capital-domain state.

---

## Unified Audit Repository

Responsible for:

- Preserving normalized append-only evidence from AI subsystem audit records
- Assigning one deterministic audit sequence independently from source timestamps
- Correlating request, route, budget, reservation, execution, and ledger references
- Reconstructing stable traces and reporting missing, cyclic, or conflicting evidence
- Enforcing privacy-aware in-memory export and retention metadata boundaries
- Providing in-memory and local canonical NDJSON repositories behind a durable port

The Audit Repository is an evidence index, not a business or accounting engine. Source systems retain ownership of their decisions and state, and the AI Cost Ledger remains the monetary source of truth. Local audit persistence is single-process development storage; it contains no raw prompts, credentials, provider-native payloads, network code, or update/delete path.

---

## Development Validation Log

Responsible for:

- Preserving immutable engineering-task records for requested goals, approved scope, inspections, implementation, structured tests, validations, warnings, defects, risks, assumptions, owner review, approval/rejection, Git milestones, handoff, lessons, and follow-ups
- Enforcing deterministic `PLANNED -> IN_PROGRESS -> IMPLEMENTED -> VALIDATED -> OWNER_REVIEWED -> APPROVED -> COMMITTED -> PUSHED -> HANDED_OFF -> CLOSED` evidence ordering with terminal rejected/blocked/cancelled states
- Keeping environment warnings distinct from code failures and requiring explicit owner exceptions for blocking failed validation
- Recording verified branch, base/commit/push/synchronization evidence supplied by a caller without executing or replacing Git
- Providing sequence-ordered queries, task histories, summaries, statistics, privacy-aware export, pure Unified Audit translation, and defensive in-memory/canonical local NDJSON repositories

Git remains the source of truth for code and version history. Unified Audit remains normalized cross-system trace truth. HANDOFF and CHANGELOG remain project-state and released-capability summaries. Alpha Journal remains context/reflection truth. Development Validation Log owns detailed structured engineering-memory evidence only; it stores no full diffs, huge raw logs, or secrets.

The repository exposes no update, overwrite, delete, Git execution, issue creation, provider, network, live-market, broker, capital-state, or Python integration. Local persistence is unencrypted single-owner, single-process development storage. A future, separately approved integration task may define how task reports populate these contracts; that integration is planned and has not started.

---

## Development Efficiency Standard

Responsible for:

- Centralizing repeated Codex implementation, validation, reporting, owner-review, and Git-safety rules
- Defining a context-loading hierarchy so future tasks can use shorter prompts without losing relevant authority documents
- Preserving quality-first model selection, deterministic-software-first behavior, provider independence, runtime-data boundaries, and owner approval authority
- Providing a concise task template, owner review template, and deterministic local validation bundle

The Development Efficiency Standard is documentation and workflow guidance only. It does not modify Python or TypeScript runtime behavior, automate owner approval, populate the Development Validation Log, execute Git commits or pushes, add provider/network/credential integration, or change capital-domain logic.

---

## AI Provider Adapter Boundary

Responsible for:

- Defining provider-neutral execution requests and normalized responses
- Verifying compatibility with an already-selected provider and model
- Reporting provider-neutral capabilities and static health metadata
- Normalizing output, usage, timeout, cancellation, and provider failures
- Registering adapter interfaces deterministically by provider ID

Adapters do not own routing, budget approval, retries, reservation or ledger state, persistence, or business logic. The current foundation contains no production adapter, provider SDK, credential, network call, or health polling.

---

## AI Execution Coordinator

Responsible for:

- Validating Router, Cost Governor, reservation, adapter, health, and trace preconditions
- Invoking exactly one already-selected provider adapter
- Validating normalized output, usage, latency, cost, and reference integrity
- Returning deterministic retry or return-to-Router recommendations
- Returning reservation and usage settlement instructions
- Producing an in-memory execution audit record

The coordinator does not reroute, run retry loops, persist records, mutate reservations or ledgers, or call any production provider. The current foundation uses only neutral test fixtures.

---

## AI Runtime Workflow

Responsible for:

- Coordinating one provider-neutral request through Router, Cost Governor, reservation, accounting, audit, Coordinator, settlement, reconciliation, and final trace validation
- Enforcing deterministic stage ordering, caller-supplied identity, immutable inputs, and fail-closed subsystem boundaries
- Applying at most one explicit low-cost reroute while leaving Router as the only model selector
- Persisting an idempotent in-memory workflow result so replay cannot repeat provider execution or monetary state changes
- Reporting explicit compensation and replay instructions when separate repositories cannot change atomically

The workflow coordinates existing subsystem authorities; it does not own business policy, select hidden fallbacks, recompute accounting truth, repair history, or contain provider integrations. The current foundation uses only injected repositories and neutral fixture adapters. Before live provider use, production design requires a crash-safe durable execution claim plus transactional or reviewed outbox-backed workflow, reservation, ledger, and audit persistence.

---

## Prediction Log

Responsible for:

- Appending deterministic prediction identities and immutable evidence snapshots before outcome
- Enforcing Draft -> Submitted -> Locked -> Outcome Known -> Reviewed -> Archived transitions
- Preserving immutable opportunity, risk, Router, model, configuration, policy, and timestamp decision context
- Appending outcomes and reviews without changing the original forecast
- Measuring prediction accuracy independently from trade profitability
- Providing defensive in-memory and local NDJSON repositories, filtering, statistics, translation, and export
- Supporting later comparison with decisions, trade outcomes, learning, journals, research, and strategy versions through references

The implemented local repository is single-owner, single-process development persistence. It exposes no delete or overwrite path and contains no live market, provider, broker, portfolio, or trade execution integration. Outcome/review compound appends are not a production transaction boundary.

---

## Trade Outcome Log (Planned)

Responsible for:

- Recording completed trade results
- Comparing planned and actual execution
- Separating prediction quality, execution quality, and profitability
- Preserving risk, adherence, attribution, and lesson records

---

## Knowledge Approval and Future Strategy Change Boundary

Responsible for:

- Preserving Candidate Knowledge derived from completed Strategy Reviews without treating it as approved truth
- Enforcing versioned evidence, provenance, sample, compatibility, conflict, and owner-authority gates
- Recording immutable Approved Knowledge plus supersession, deprecation, and revocation history
- Requiring a separate Strategy Change Proposal and normal Strategy Versioning approval before any future strategy change

The architecture is defined in `docs/specifications/KNOWLEDGE_APPROVAL_LAYER.md`. Its governing rule is “No Strategy Change Without Approved Knowledge.” Deterministic checks may block or establish eligibility for owner review, but they cannot approve knowledge. AI may assist drafting and objection discovery but cannot approve, reject, resolve evidence blockers, or mutate strategy. Approved Knowledge is necessary for a future change proposal but does not itself require or authorize a change.

---

## Alpha Journal

Responsible for:

- Preserving immutable point-in-time observations, rationale, assumptions, uncertainty, actions, and expected outcomes
- Appending finalized authoritative entries, amendments, reviews, lessons, and archive history without overwrite or deletion
- Linking Prediction, Research, Decision, Trade, Strategy, Portfolio, Audit, Journal, and Development Validation evidence without taking ownership
- Preserving immutable opportunity, risk, prediction, configuration, strategy, policy, Router/model, market, portfolio, and owner-decision context when available
- Enforcing privacy-aware deterministic query, statistics, summary, export, and Unified Audit translation boundaries
- Providing defensive in-memory and canonical local NDJSON repositories

Drafts are workspace state outside the authoritative repository. Prediction Log remains the prediction source of truth; Journal records explanation, context, reflection, and lessons and cannot mutate predictions or strategies. The local repository is single-owner, single-process development persistence with no encryption, multi-writer safety, or production transaction guarantee.

---

## Strategy Versioning

Responsible for:

- Preserving immutable strategy definitions, version snapshots, semantic lineage, status history, changes, validation, approval, activation, suspension, retirement, and performance evidence
- Enforcing the authoritative `PROPOSED -> VALIDATING -> APPROVED -> ACTIVE -> SUSPENDED -> RETIRED -> ARCHIVED` lifecycle, with explicit owner rejection and no reverse transitions
- Classifying changes as PATCH, MINOR, or MAJOR and validating the exact semantic-version increment against the declared change set
- Linking frozen Research, Prediction, Journal, Decision, Risk, Trade, Audit, Backtest, Validation, and Event Replay references without taking ownership of those records
- Comparing two versions deterministically across behavior, parameters, constraints, risk, evidence, validation, and performance
- Freezing the exact active version, ruleset fingerprint, parameters, risk-policy reference, decision timestamp, and owner approval into a provider-neutral trade-plan contract
- Supporting rollback only by proposing, validating, approving, and activating a new version that explicitly references the trusted and failed versions
- Providing defensive in-memory and canonical append-only local NDJSON repositories, privacy-aware export, statistics, and pure Unified Audit translation

Draft editing remains workspace state outside the authoritative repository. Only the owner may approve or reject a version, activation must be an owner action backed by matching owner approval, and AI can propose or analyze but cannot approve or activate. Suspension, retirement, and rollback use explicit policy/evidence records rather than hidden state changes. One active version per strategy definition is enforced by default. Suspension blocks new plan snapshots but does not rewrite an already frozen snapshot, and retirement never deletes historical evidence.

Strategy Versioning owns strategy truth only. Prediction Log owns prediction truth, Research Lab owns research truth, Alpha Journal owns context and reflection truth, and Unified Audit owns normalized trace truth. This foundation defines a trade-plan freeze contract but contains no trade repository, execution path, broker integration, live market source, provider SDK, network call, credential handling, or Python runtime integration. Local persistence is single-owner, single-process development storage.

---

## Research Lab

Responsible for:

- Preserving immutable point-in-time questions, sources, evidence, assumptions, uncertainty, thesis, conclusions, confidence, and scenarios
- Appending finalized research, amendments, reviews, supersession, and archive history without overwrite or deletion
- Linking Prediction, Journal, Strategy, Portfolio, Audit, Historical Pattern, Research, Decision, Trade, Development Validation, market-snapshot, catalyst, and future Event Replay evidence without taking ownership
- Enforcing deterministic identity, lifecycle, query, statistics, privacy-aware export, and Unified Audit translation
- Providing defensive in-memory and canonical local NDJSON repositories

Draft collection and analysis remain workspace state outside the authoritative repository. Research Lab is research truth, Prediction Log is prediction truth, Alpha Journal is context and reflection truth, and Unified Audit is normalized trace truth. The foundation has no live source retrieval, market-data API, provider integration, or business execution. Local persistence is single-owner, single-process development storage.

---

## Historical Pattern Library

Responsible for:

- Preserving immutable historical events with explicit date precision, categories, regimes, observation windows, asset reactions, source evidence, uncertainty, disputed interpretations, and frozen subsystem references
- Preserving reusable historical patterns as records distinct from their supporting events, with qualifying conditions, causal-mechanism classification, counterexamples, regime dependencies, limitations, invalidation conditions, and minimum support counts
- Keeping historical facts, quantitative observations, source claims, interpretations, inferences, hypotheses, disputed claims, counterevidence, and unknowns structurally distinct
- Appending event/pattern amendments and reviews plus pattern supersession and archive history without update, overwrite, or deletion
- Providing deterministic queries, related-record traversal, pagination, statistics, privacy-aware export, pure Unified Audit translation, and defensive in-memory/canonical local NDJSON repositories
- Freezing stable record/version/status/summary references for Research Lab and future consumers without mutating their records

Historical Pattern Library is historical-event and reusable-pattern truth. Research Lab remains current structured-research truth, Prediction Log remains prediction truth, Alpha Journal remains context/reflection truth, Strategy Versioning remains strategy truth, and Unified Audit remains normalized trace truth.

The library does not fetch historical prices, ingest live data, calculate external market values, compare current events, predict outcomes, backtest, replay timelines, execute providers, or authorize capital decisions. The separate Historical Analogy Engine may read frozen finalized records without modifying historical truth. Event Replay may reference finalized historical records without modifying historical truth. Local persistence is unencrypted single-owner, single-process development storage governed by the production boundary in `docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md`.

---

## Historical Analogy Engine

Responsible for:

- Freezing caller-supplied current-situation snapshots and exact finalized Historical Event or Historical Pattern candidates
- Applying owner-approved immutable weight profiles and explicit missing-data policies
- Comparing typed dimensions through transparent integer basis-point arithmetic
- Keeping similarity, difference, completeness, evidence quality, candidate quality, and comparison confidence separate
- Reporting strongest similarities, strongest differences, missing dimensions, exclusions, historical outcome observations, regime differences, limitations, bias risks, and invalidation conditions
- Ranking eligible completed comparisons deterministically with stable candidate and analogy identity tie-breaking
- Preserving append-only request, snapshot, profile, result, review, amendment, supersession, archive, query, statistics, export, and Unified Audit evidence
- Providing defensive in-memory and canonical local NDJSON repositories under a Git-ignored runtime path

Historical Pattern Library remains historical truth. Research Lab remains interpretation truth. Prediction Log and Strategy Versioning may later freeze reviewed analogy evidence but are not mutated. Decision Engine cannot treat raw similarity as an automatic decision, and Risk Engine constraints cannot be bypassed.

The engine performs no AI scoring, embeddings, semantic search, vector database, external search, live data retrieval, prediction, trade recommendation, backtest, Event Replay, provider/network call, broker integration, or capital-state mutation. Local persistence is unencrypted single-owner, single-process development storage.

---

## Event Replay Architecture

Responsible for:

- Preserving deterministic historical-event replay timelines from caller-supplied evidence
- Freezing chronological events, observation windows, immutable checkpoints, references, provenance, missing-data policy, completeness, confidence, quality, and limitations
- Creating replay sessions that reconstruct ordered evidence without prediction, execution simulation, strategy optimization, or capital authority
- Linking Historical Events, Historical Patterns, Historical Analogies, Research Lab, Prediction Log, Alpha Journal, snapshots, and source evidence without taking ownership
- Providing defensive in-memory and canonical local NDJSON repositories, privacy-aware export, statistics, lifecycle review/supersession/archive, and pure Unified Audit translation

Event Replay is evidence reconstruction only. Historical Pattern Library remains historical truth, Historical Analogy Engine remains comparison truth, Research Lab remains interpretation truth, and Decision/Risk/Portfolio/Trade systems retain their existing authority. The foundation has no backtesting, trading simulation, live market-data source, provider SDK, network/API code, broker integration, Python runtime integration, or production persistence.

---

## Historical Evidence Product Surface

Responsible for:

- Presenting existing Historical Pattern, Historical Analogy, and Event Replay records through one deterministic read-only response
- Preserving already-recorded strategy, prediction, confidence, limitation, and replay-reference metadata without recalculation
- Reporting unavailable replay timelines explicitly without mutating source records

The product surface is an adapter over existing repository read ports. Historical Pattern Library, Historical Analogy Engine, and Event Replay retain authority. It performs no historical reasoning, ranking, recommendation, AI call, persistence, dashboard presentation, or source-record mutation.

---

## Cross-System Evidence Linking

Responsible for:

- Validating explicit typed links among Prediction, Strategy Version, Historical Pattern, Historical Analogy, Event Replay, Prediction Outcome, and Journal Entry records
- Resolving fixed repository read ports into deterministic, version-aware, read-only link results
- Preserving relation type, source/target identity, resolution status, source status, trace/audit metadata, and explicit missing or unavailable states

Cross-System Evidence Linking is a link resolver, not a graph database, source authority, inference engine, or persistence layer. It follows the dependency direction `authoritative repositories -> narrow read adapters -> linking/product surfaces -> future consumers`. It never discovers relationships from text, uses fuzzy matching, recursively explores a graph, changes domain records, or invokes arbitrary repositories.

---

## Evidence Assessment and Evaluation Layer

This layer consumes explicit evidence links without changing source ownership:

1. Evidence Assessment Foundation is implemented, reviewed, and committed. It calculates published completeness, availability, freshness, consistency, version-compatibility, provenance, and limitation indicators from explicit evidence.
2. Strategy Review Foundation is implemented, reviewed, committed, and pushed. It evaluates one explicitly completed prediction/plan/execution/outcome cycle across separate prediction-quality, execution-quality, risk-discipline, and realized-profitability dimensions. It accepts normalized read snapshots only; a future durable Trade Outcome Log remains required for production outcome authority and multi-cycle performance evaluation.
3. Knowledge Approval Layer separates facts, interpretations, Candidate Knowledge, owner decisions, Approved Knowledge, Strategy Change Proposals, and Strategy Versions. The local D8-T3B foundation implements deterministic eligibility, owner-only decisions, append-only in-memory lifecycle records, a read-only projection, and audit translation; no strategy mutation is authorized.

“No Evidence, No Decision” is the entry gate to downstream decision evaluation. A request must fail closed when required evidence is `INSUFFICIENT`, `CONFLICTING`, or `UNAVAILABLE`; only an explicitly `SUFFICIENT` assessment under a traceable versioned policy may proceed. Sufficiency is necessary but does not itself produce a recommendation or authorize action. Decision evaluation, Risk Engine review, frozen-plan requirements, owner approval, and execution controls remain separate downstream gates.

The Evidence Assessment, Strategy Review, and bounded local Knowledge Approval foundations are committed and pushed. Production persistence, cryptographic authorization, Strategy Change Proposals, AI drafting, and broad retrieval remain unimplemented. AI cannot create facts, override evidence or policy blockers, approve knowledge, activate a strategy, bypass Risk/Decision controls, or authorize capital action. A general-purpose Alpha Memory database is not approved because it would duplicate existing authorities; a future read-only knowledge-retrieval policy requires a concrete consumer and production persistence/privacy review.

---

## Market Data Layer Foundation

D9-T1 adds a quote-first provider boundary: `future provider -> provider adapter -> raw response -> explicit normalization -> deterministic validation -> canonical Market Data result -> future read-only consumers`. Canonical instrument IDs belong to Alpha; provider symbols remain source metadata. Fixed-decimal prices preserve precision, and observation, publication, receipt, normalization, evaluation, and processing times remain distinct.

The layer returns explicit transport, normalization, validation, operation, and quality states. Invalid, incomplete, stale, unavailable, unsupported, out-of-order, or conflicting data fails closed. The foundation adds no live provider, network/API code, credential, persistence, automatic fallback, downstream Evidence/Replay wiring, paper trading, recommendation, Risk/Decision behavior, Dashboard behavior, broker, or execution path. See [Market Data Layer](specifications/MARKET_DATA_LAYER.md).

D9-T2 adds the separate immutable [Provider Registry](specifications/PROVIDER_REGISTRY.md) as the provider-discovery metadata authority. It owns canonical provider identity, status, declared capabilities and asset classes, static discovery priority, default enablement, and documentation references. Adapter descriptors describe implementation compatibility only. The registry holds no adapters, performs no calls, and has no selection, routing, fallback, reflection, AI, or runtime registration path.

Day10-T3B adds a separate immutable composition boundary between registry metadata and runtime adapters. It verifies provider ID, lifecycle/default enablement, declared capability, and asset-class compatibility without making the registry instantiate adapters. One provider may bind distinct Quote and Bar adapters; duplicates fail per provider ID plus capability. `MarketDataService` remains a small compatibility facade over separate Quote and Bar orchestrators. There is no universal provider adapter, automatic provider selection, routing, or fallback.

D9-T3 through D9-T5 complete the Canonical Market Domain with one authoritative [Canonical Instrument](specifications/CANONICAL_INSTRUMENT.md), [Canonical Quote](specifications/CANONICAL_QUOTE.md), and [Canonical Bar](specifications/CANONICAL_BAR.md). Provider symbols are adapter-owned mappings rather than canonical identity. Quote and Bar values remain immutable, fixed-decimal, timestamp-explicit, quality-aware, and provenance-preserving. Bar identity excludes OHLCV content so later corrections can retain logical identity while changing the content fingerprint.

Day 10 External World Integration began with evidence and policy, then committed the [Twelve Data provider-specific fixture adapter foundation](specifications/TWELVE_DATA_ADAPTER.md). Provider authentication, payloads, symbols, limits, and errors remain inside the integration boundary; provider-native schemas are not global shared contracts. Canonical normalization cannot upgrade partial-market data to full-market, infer NBBO, fabricate timestamps or units, or hide unresolved quality. Quote and Bar observation fingerprints exclude local receipt/normalization/evaluation metadata, while logical identity remains stable across provider content corrections.

Day11-T1 adds the narrowly allow-listed [Twelve Data Live Smoke Transport](specifications/TWELVE_DATA_LIVE_SMOKE.md) behind the existing port. It is reachable only through an explicit manual command, defaults to a network-free dry run, requires `--confirm-live-smoke`, accepts only AAPL/PT5M, one request, 10 records, one API credit, and at most one regular trading day, and has no retry, polling, persistence, streaming, scheduling, or downstream domain wiring. Automated validation injects fake executors and makes zero live calls. Because official live equity-volume units remain unresolved, provider transport/parser success cannot yield accepted Canonical Bars.

---

# Event Contract Framework

Event contracts are considered a temporary capital-building tool.

Their purpose is:

- Build capital
- Generate stable cash flow
- Improve execution discipline

They are NOT Alpha's final investment objective.

---

# Long-Term Investment Framework

As capital grows, Alpha gradually shifts toward:

- High-quality stocks
- Long-term ownership
- Dividend growth
- Capital appreciation

The percentage allocated to event contracts should decrease as long-term investments increase.

---

# Design Principles

Every module must satisfy:

- Small and independent
- Easy to test
- Easy to replace
- Easy to expand

Large refactoring should be avoided whenever possible.

---

# Decision Intelligence and Learning Flow

Research Framework
|
v
Opportunity Score Engine
|
v
Prediction Log (Forecast Freeze)
|
v
Instrument Ranking Engine
|
v
Evidence Assessment Gate
|
v
Decision Engine Evaluation
|
v
Risk Engine Review
|
v
Permitted Downstream Action, If Any
|
v
Execution
|
v
Trade Outcome Log (planned)
|
v
Strategy Review Foundation
|
v
Candidate Knowledge (local foundation)
|
v
Owner Knowledge Approval (local foundation)
|
v
Approved Knowledge (local foundation)
|
v
Strategy Change Proposal (future separate gate)
|
v
Strategy Versioning
|
v
Future Decision Improvement

The Prediction Log precedes the final decision and execution so Alpha can preserve the original forecast without hindsight changes.

The Portfolio System and Config System provide control inputs across the flow. Required evidence must pass the deterministic Evidence Assessment gate before Decision Engine evaluation. The Risk Engine may then reject or constrain a proposed decision before any downstream action is permitted. The Dashboard presents state and outputs but does not own decision logic. The Alpha Journal may summarize decisions and lessons but does not replace source records.

Execution is currently an external, owner-controlled action. Future broker integration must not bypass owner approval, the approved trade plan, or Risk Engine limits.

Strategy Review does not make the durable Trade Outcome Log production-ready. It reviews only explicit finalized read snapshots, preserves prediction quality, execution quality, risk discipline, and profitability independently, and cannot reopen a completed trade or change a strategy.

Knowledge approval occurs only after completed Strategy Review. One outcome may create a candidate but does not normally create durable Approved Knowledge. Approved Knowledge remains informational until a separate Strategy Change Proposal passes its own validation and owner approval and becomes a new immutable Strategy Version. Existing active or frozen plans are never mutated by this learning path.

---

# Future Expansion

Future systems may include:

- Production-grade transactional AI workflow, reservation, ledger, and audit persistence or a reviewed outbox architecture
- Durable provider-execution claims and provider-billing reconciliation
- Production provider adapters and durable, crash-recoverable runtime workflow execution
- Historical Analogy Engine product integration and production hardening
- Event Replay product integration and production hardening
- Portfolio Analytics
- Backtesting Engine
- Mobile Dashboard
- Multi-Broker Support

---

# Architecture Goal

Alpha should remain maintainable for many years.

Every new feature must strengthen the system instead of increasing unnecessary complexity.
