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

- Authoritative portfolio and cash state
- Applying only separately approved future capital-state changes
- Portfolio tracking
- Cash management
- Asset distribution

The Portfolio System does not calculate the Day14 Capital Allocation Recommendation. The Capital Allocation Framework reads an immutable portfolio reference and cannot mutate Portfolio state.

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

## Market Regime Engine Foundation

Day11-T2 adds one provider-independent [Market Regime Engine](specifications/MARKET_REGIME_ENGINE.md) downstream of canonical observations: `canonical market observations -> immutable regime snapshot -> deterministic fixed-decimal features -> versioned rules -> immutable assessment -> Evidence references / Unified Audit translation`. The engine fetches and normalizes nothing and has no dependency on Twelve Data or another provider.

One primary price-structure regime is reported separately from secondary conditions. `HIGH_VOLATILITY` may coexist with `BULL_TREND`, `BEAR_TREND`, `CORRECTION`, `RELIEF_RALLY`, or `RANGE_BOUND`. `DISTRIBUTION_RISK` and `ACCUMULATION_CANDIDATE` require verified volume-unit semantics and verified breadth evidence; price alone cannot produce them. Evidence strength describes deterministic coverage, never probability or expected profitability.

The engine emits no signal, recommendation, plan, risk override, position size, portfolio mutation, or execution instruction. Missing observations, stale/rejected quality, unresolved canonical identity, contradiction, or missing source evidence fails closed as `INSUFFICIENT_EVIDENCE`. Decision Engine, Risk Engine, Evidence Engine, Unified Audit, Strategy Versioning, and authoritative market-data systems retain their existing responsibilities.

## Broad Market Evidence Foundation

Day12-T1 adds the provider-independent [Broad Market Evidence](specifications/BROAD_MARKET_EVIDENCE.md) boundary before future Market Regime consumption: `reviewed Canonical Bar references -> immutable benchmark snapshot -> fixed-decimal features -> deterministic multi-benchmark assessment -> future regime input adapter`. The layer owns benchmark evidence composition, not regime classification.

Reviewed ETF or index Canonical Instrument IDs define explicit required and optional benchmark membership. Deterministic output contains positive/negative/neutral direction facts, agreement/disagreement counts, drawdown, rebound, range, recovery, and bounded volatility facts plus `COMPLETE`, `PARTIAL`, `STALE`, `CONTRADICTORY`, or `INSUFFICIENT` quality. It cannot emit bull, bear, correction, relief-rally, trade, signal, probability, or expected-return outcomes.

Market Regime remains authoritative for environment classification. Day12-T1 adds no live fetch, provider dependency, startup wiring, persistence, Decision/Risk/Portfolio change, AI, or execution path. Unified Audit receives only deterministic translation; it remains the audit authority.

## Evidence Fusion Layer Foundation

Day13-T1 adds [Evidence Fusion](specifications/EVIDENCE_FUSION.md) as the stable composition boundary for future multi-domain evidence: `authoritative evidence assessment -> explicit source adapter -> immutable fusion input -> deterministic policy checks -> immutable fusion snapshot -> future Decision/Risk consumers`.

V1 accepts only `BroadMarketEvidenceAssessment` through a dedicated adapter. Fusion preserves source assessment, snapshot, policy, rule, feature, evidence, and audit references without embedding benchmark observations or provider-native data. Missing, partial, stale, future-dated, contradictory, schema-incompatible, or untraceable required evidence produces a blocked snapshot. Only complete, current, policy-compatible evidence produces `READY`.

Fusion does not score evidence, calculate probability, classify a regime, recommend action, or mutate another domain. Future Decision and Risk integrations may consume only a reviewed Fusion Snapshot, never raw benchmark observations. Day13-T1 adds no consumer wiring, live data, AI, persistence, provider, HTTP, trading, or execution behavior.

## Event Analyzer Console Prototype

Day13-T2 adds an isolated [Event Analyzer Console](specifications/EVENT_ANALYZER_CONSOLE.md): `explicit BTC 15-minute test inputs -> fixed-decimal validation -> deterministic uncalibrated heuristic -> fair value and edge -> prototype recommendation plus risk explanation`.

The prototype supports only YES/NO or UP/DOWN views of one BTC 15-minute target event. Day13-T3 adds a bounded local `PT1M` candle-series boundary and deterministic returns, candle direction, body pressure, close location, range expansion, acceleration, relative-volume, reversal, and richer momentum features. Candle timestamps are completed interval starts; the final candle, observation time, exact scale-normalized current price, canonical instrument, event identity, and bounded local provenance must agree. Malformed, stale, untraceable, insufficient, legacy-only, unstable, or side-contradictory evidence produces `NO_TRADE`.

High probability alone cannot produce `BUY`; sufficient candle evidence, positive edge, acceptable market price, no severe contradiction, and minimum remaining time are separate gates. Prediction accuracy remains separate from profitability, which is explicitly `NOT_EVALUATED` because fees, liquidity, execution, sizing, portfolio state, and outcome are absent.

The console is not the Decision Engine and does not bypass Evidence Fusion or Risk. Every output is `PROTOTYPE_ONLY_NOT_AUTHORIZED`; future production consumption requires a separate evidence, Decision, Risk, owner-approval, and execution design. Local structured JSON is preferred to screenshots because deterministic validation requires exact values and timestamps. No UI, OCR, provider, API, live data, AI, persistence, portfolio mutation, order, or execution path is present.

## Capital Allocation Framework v1.0

Day14-T1 adds the provider-independent [Capital Allocation Framework](specifications/CAPITAL_ALLOCATION_FRAMEWORK.md) construction boundary: `current Portfolio reference + READY Fusion + accepted Market Regime + completed Risk gate -> deterministic validation -> immutable unranked allocation recommendation`.

The framework owns the standardized `AllocationCandidate` and `AllocationRecommendation` envelopes, not their authoritative upstream facts. Portfolio System remains portfolio truth, Evidence Fusion remains evidence-gate truth, Market Regime remains environment truth, and Risk Engine remains risk authority. Runtime objects are recursively allow-listed, eligible candidates bind to the exact gated Fusion record, and Risk must be evaluated no earlier than Fusion and Regime; `CONSTRAINED` Risk requires explicit unique constraints. Candidate ticker is display metadata beside a required canonical instrument ID. Confidence means evidence strength, never probability.

V1 constructs only an eligible-for-review recommendation. It does not rank candidates, calculate suggested weights, optimize a portfolio, decide leverage, produce a trade plan, mutate Portfolio state, or authorize execution. `topCandidates` remains deterministically ordered by Alpha candidate ID and every candidate priority is `UNRANKED`. Suggested weight is an optional validated basis-point placeholder supplied by a future reviewed workflow, never calculated by v1.

Future Leverage Decision and Opportunity Ranking engines remain external downstream extension points. Earnings Research and Capital Rotation may become upstream evidence only through explicit versioned references or adapters. Event Analyzer output is not accepted as upstream allocation authority. No AI, provider, API, persistence, Dashboard, broker, order, or execution path is added.

Capital allocation pipeline:

```text
Reviewed Market Evidence
  -> Evidence Fusion
  -> Risk Engine Review
  -> Capital Allocation Framework
  -> immutable unranked recommendation
  -> future Leverage Decision Engine (external)
  -> future Opportunity Ranking Engine (external)
  -> future owner-approved final allocation
```

## BTC Event Contract Observation Foundation

Day15-T1 adds the first normalized event-market fact boundary:

```text
owner-supplied Robinhood terms
  + declared BRTI reference-price observation
  + exact UP/DOWN quotes
  + exact UP/DOWN fee previews
  + bounded evidence identities
  -> strict validation and chronology
  -> exact fee arithmetic
  -> immutable observation record
```

The exchange contract terms remain settlement truth, the declared settlement source remains reference-price truth, and Robinhood/exchange order previews remain cost truth. The observation boundary owns only the normalized point-in-time capture, deterministic maximum-profit arithmetic, and fee-inclusive break-even probability. It does not estimate the event outcome.

Every nested object is allow-listed. BTC instrument identity, 15-minute window, evaluation method, threshold operator, trading close, evaluation time, reference-price freshness, quote freshness, order-preview freshness, quote-to-preview identity, subtotal, fees, total cost, payout, and evidence type/source/time are validated fail closed. Both UP and DOWN sides are mandatory and are not forced to sum to one dollar.

Every result is `OBSERVATION_ONLY_NOT_TRADE_AUTHORITY`. Day15-T1 adds no calibrated model, recommendation, expected value, sizing, Prediction Log, Trade Outcome Log, persistence, live Robinhood/exchange/BRTI adapter, API, network, credential, OCR, screenshot ingestion, polling, Dashboard, Paper Trading, broker, order, or execution behavior. See [BTC Event Contract Observation](specifications/EVENT_CONTRACT_OBSERVATION.md).

## Event Contract Shadow Ledger

Day15-T2 adds a local, append-only research history after the Day15-T1 observation gate:

```text
validated point-in-time observation
  -> canonical append-only NDJSON
  -> exact official settlement reference
  -> hypothetical UP and DOWN fee-inclusive outcomes
  -> aggregate shadow summary
```

Observation replay is idempotent only when the complete record matches. A settlement must bind to the exact observation, terms, contract, and declared settlement source; one observation can have only one official settlement. Repository sequence, event fingerprints, canonical serialization, timestamps, and stored domain fingerprints are revalidated during reload. Truncated, malformed, non-canonical, reordered, or reference-invalid history fails closed.

The local console accepts owner-supplied JSON only. The ledger is single-process development persistence and emits `SHADOW_ONLY_NOT_TRADE_AUTHORITY`; it does not estimate probability, recommend a side, size capital, contact Robinhood/BRTI, read credentials, place orders, or authorize execution. See [Event Contract Shadow Ledger](specifications/EVENT_CONTRACT_SHADOW_LEDGER.md).

## Research Integrity and Leakage Prevention

Day15-T3A adds a deterministic point-in-time eligibility gate before calibration, backtesting, or model comparison:

- occurrence, source publication, supported availability, and local receipt times remain distinct;
- `FORWARD` research requires both receipt and dataset freeze by the decision cutoff;
- `HISTORICAL_REPLAY` may be assembled later but every exact source version must independently prove it was available by the historical cutoff;
- Canonical Bar evidence must be final and its interval must end by the cutoff;
- outcome-bearing and settlement evidence cannot enter pre-outcome research;
- one frozen manifest binds the exact evidence identities and content fingerprints.

The result is only `ELIGIBLE` or `BLOCKED` for research integrity and always remains `RESEARCH_ONLY_NOT_TRADE_AUTHORITY`. It does not assess sample sufficiency, train or calibrate a model, report probability or returns, recommend a side, size capital, or authorize execution. See [Research Integrity](specifications/RESEARCH_INTEGRITY.md).

## Research Dataset Qualification and Temporal Split

Day15-T3B adds the deterministic dataset gate after individual Day15-T3A audits and before any model research. A collection plan must be frozen strictly before its first event cutoff and enumerate a continuous BTC-USD 15-minute event sequence. Every completed sample must bind the planned event, exact observation and outcome records, feature schema/version, and one eligible Research Integrity audit.

The default policy requires at least 1,000 completed samples, 30 distinct UTC dates, 90% planned-event and outcome coverage, at least 200 observations for each UP/DOWN outcome, and no outcome above 80%. IDs must be unique, feature and integrity-policy versions cannot be mixed, and every outcome must become known only after its event cutoff.

Qualified samples are sorted by event cutoff and split deterministically into chronological 60% training, 20% calibration, and 20% sealed final-test partitions, with four-sample embargo gaps and label-availability checks between partitions. Any issue produces `BLOCKED` with no split. `QUALIFIED` means only that the declared minimum research gate passed; it is not statistical proof, a probability claim, a profitable backtest, or trading authority. See [Research Dataset Qualification](specifications/RESEARCH_DATASET_QUALIFICATION.md).

## Research Shadow Dataset Assembly

Day15-T3B2 adds a narrow offline adapter between the append-only Day15-T2 shadow ledger and the Day15-T3B qualification input. It accepts one owner-supplied frozen plan, explicit event-to-observation bindings, complete Day15-T3A audit inputs, immutable feature versions, and a read-only ledger snapshot. It recomputes each audit and requires the exact observation identity and fingerprint in its evidence before deriving a label exclusively from the official settlement.

Missing or unsettled events remain explicit and produce `BLOCKED`; assembly never repairs history, infers a label, or substitutes a favorable record. `ASSEMBLED` means only that a canonical T3B input was constructed. The existing T3B engine remains the sole dataset qualification and temporal-split authority. The boundary adds no console, repository, automated collection, provider, network, model, probability, recommendation, or execution behavior. See [Research Shadow Dataset Assembly](specifications/RESEARCH_SHADOW_DATASET_ASSEMBLY.md).

## Forward Shadow Collection Control

Day15-T3B3 adds a deterministic control surface before T3B2 assembly. It creates a continuous aligned BTC-USD 15-minute plan from one caller-declared creation time, first future cutoff, and bounded event count. Event IDs are derived from UTC cutoffs, and the result uses the canonical T3B collection-plan contract and fingerprint.

A separate read-only audit projects exact Day15-T2 histories into stable `UPCOMING`, `OVERDUE_MISSING`, `CAPTURED_UNSETTLED`, or `SETTLED_CANDIDATE` states. It lists every matching observation and settled candidate without selecting one; later T3B2 binding remains explicit. The caller-supplied creation time proves only local deterministic coherence, not an externally signed freeze time or guaranteed Robinhood listing. The boundary adds no scheduler, network, provider, persistence, automatic capture, model, recommendation, or execution behavior. See [Forward Shadow Collection Control](specifications/FORWARD_SHADOW_COLLECTION_CONTROL.md).

## Forward Shadow Collection Operator

Day15-T3B4 adds an explicit local operator surface over T3B3. `freeze-plan` constructs a verified plan from caller-authored JSON and creates one new artifact with exclusive file creation; it never overwrites an existing plan. `progress` reconstructs and verifies that artifact before opening one explicitly named, already-existing Day15-T2 ledger, then emits the unchanged T3B3 read-only audit.

The operator surface uses strict option parsing, refuses missing or corrupt ledgers, and does not initialize or mutate ledger storage. It remains single-host development tooling with caller-owned paths, not a production persistence or hostile-filesystem sandbox. It adds no network, provider, credential, polling, scheduler, background capture, research-sample selection, model, recommendation, or execution authority. See [Forward Shadow Collection Operator](specifications/FORWARD_SHADOW_COLLECTION_OPERATOR.md).

## Event Contract Collection Source Architecture

Day15-T3B5 defines the admission boundary for future real event-contract evidence. Robinhood platform facts, exchange-native market facts, official settlement-reference values, and operator-captured evidence remain distinct source classes. A single observation may compose them only while preserving every source identity, record identity, timestamp, and authority.

Because Robinhood may offer contracts from multiple exchanges, a future exchange adapter must prove an exact reviewed platform-to-exchange mapping across exchange, market, contract, side semantics, BTC instrument, event window, threshold, evaluation method, settlement source, and terms version. Similar titles, cutoffs, or target prices cannot establish identity. Exchange quotes cannot be relabeled as Robinhood quotes, and exchange fees cannot stand in for a Robinhood order preview.

The staged release sequence requires provider-neutral source contracts, a fixture-only adapter, a separately approved bounded live-read smoke, collection-runner architecture, and only then a limited forward pilot. Undocumented Robinhood interfaces, authenticated brokerage-session automation, direct adapter-to-ledger writes, and any trading authority are prohibited. See [Event Contract Collection Source Architecture](specifications/EVENT_CONTRACT_COLLECTION_SOURCE_ARCHITECTURE.md).

## Event Contract Source Contracts

Day15-T3B6 implements the provider-neutral contract layer required by T3B5. Immutable provider descriptors declare one source class, bounded capabilities, supported execution modes, official documentation, and either no credential or a read-only data credential. Credential types with brokerage, session, or write authority do not exist.

Exact mapping records bind one exchange provider to explicit Robinhood and exchange-native identities plus complete canonical BTC 15-minute terms. A `REVIEWED_EXACT` mapping is eligible only when all identity and terms fields agree; pending and rejected mappings remain immutable but ineligible.

Source snapshots preserve provider and mapping fingerprints, one declared capability, provenance chronology, payload fingerprint, and bounded byte/record metadata without retaining a raw payload. The default T3B6 policy remains fixture-only. T3B8 adds exactly one separately named bounded-live policy with a 100,000-byte and one-record ceiling; all other live policies remain rejected. Outputs remain research-source evidence, not T1 observations or trade authority. See [Event Contract Source Contracts](specifications/EVENT_CONTRACT_SOURCE_CONTRACTS.md).

## Kalshi Event Contract Fixture Adapter

Day15-T3B7 introduces one concrete fixture-only Kalshi provider and validates the official `KXBTC15M-26JUL232045-45` market together with its `KXBTC15M` series metadata. Its official-evidence correction adds one sanitized fixture from the exact public Robinhood event page. The adapter normalizes exact UTC interval, target, BRTI rule, terms-document references, finalized settlement facts, platform page identity, and content-addressed terms version from bounded static JSON without a runtime transport, credential, network request, persistence path, or raw-payload output.

The exact Robinhood page links directly to Kalshi's `CRYPTO15M` terms and agrees with the Kalshi fixture on the interval, `$64,839.26` target, BRTI source, and complete primary and secondary rules. The mapping preserves each native title separately, the Robinhood page slug, its routable deep-link UUID, and the opaque `ec_id` without assigning undocumented semantics. The output is `NORMALIZED_EXACT_MAPPING`, constructs one T3B6 fixture settlement snapshot, and still has no T1 observation, quote/fee, live-read, or trading authority. See [Kalshi Event Contract Fixture Adapter](specifications/KALSHI_EVENT_CONTRACT_FIXTURE_ADAPTER.md).

## Kalshi Bounded Live-Read Smoke

Day15-T3B8 adds one isolated public HTTPS boundary for `GET /trade-api/v2/markets/KXBTC15M-26JUL232045-45`. The exact endpoint, market, method, timeout, request count, response bytes, and record count are fixed. The path has no credential, query, retry, redirect, polling, scheduling, streaming, persistence, or raw-payload output.

The manual command defaults to network-free dry run. A confirmed invocation requires a separate owner decision and may perform exactly one request. The returned market must pass the complete T3B7 exact-market schema and mapping before the source engine can produce a `BOUNDED_LIVE_READ` settlement snapshot. Kalshi quote fields remain exchange-native and are not surfaced as Robinhood quote or fee evidence. Automated tests inject the transport and never call the network. See [Kalshi Event Contract Bounded Live-Read Smoke](specifications/KALSHI_EVENT_CONTRACT_LIVE_SMOKE.md).

The owner-authorized first request completed successfully with one request, one normalized settlement record, zero retries, zero credentials, and zero persistence writes. This validates the transport and exact mapping for the single historical market only; it does not authorize repetition or scheduling.

## Event Contract Collection Runner Architecture

Day15-T3B9 defines the future continuous collector as a deterministic research orchestrator over frozen plans and already admitted sources. It separates platform and exchange evidence lanes, requires an immutable admission bundle per source task, and preserves missed pre-event evidence as `MISSED` rather than backfilling it.

The architecture defines pilot and task state machines, injected UTC and monotonic clocks, one-worker leases, a maximum of two attempts, strict retry classification, deadlines, budgets, graceful and emergency stop, sanitized health, and crash recovery. A future local pilot uses transactional SQLite with unique idempotency keys and an atomic task/attempt/evidence/outbox commit; existing NDJSON repositories are not sufficient for this concurrency and recovery boundary.

The current Kalshi source can scale exchange-native evidence but cannot automatically supply Robinhood quotes or fee previews. Therefore T3B9 cannot claim complete T1 observations or dataset qualification. It adds no implementation, database, scheduler, background worker, request, or trading authority. See [Event Contract Collection Runner Architecture](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md).

### Runner Contract and State-Validation Foundation

Day15-T3B10-T1 turns the T3B9 authority and lifecycle model into provider-neutral immutable contracts. The deterministic engine constructs and verifies runner definitions, owner-approval evidence, exact per-task admission bundles, and scheduled tasks; derives the complete idempotency identity; and enforces compare-and-swap pilot and task transitions.

The initial ceilings remain one pilot, one worker, one in-flight request, one request per second, two total task attempts, and a one-second clock-offset policy. Exchange tasks require an admitted exact mapping while platform tasks prohibit exchange mapping identity. The implementation adds no current-time decision, clock, lease, retry execution, repository, SQLite store, scheduler, worker, adapter invocation, network request, observation, ledger mutation, model, or trading authority. See [Event Contract Collection Runner Contracts](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md).

### Runner SQLite and Transaction Boundary Design

Day15-T3B10-T2 specifies a single-host local research store using SQLite `STRICT` tables, WAL, `synchronous=FULL`, verified foreign-key enforcement, checksum-bound forward migrations, compare-and-swap aggregate updates, immutable attempt claims/results, unique evidence idempotency, and a transactional outbox.

The critical evidence transaction verifies pilot/task/lease/attempt/budget and exact source authority, appends the attempt result and normalized evidence, moves the task to `COMMITTED`, updates counters, removes the lease, and appends the outbox event in one `BEGIN IMMEDIATE` transaction. The design also separates same-session monotonic timing from restart-safe UTC recovery, defines invariant checks, and requires verified backup, offline restore, and corruption drills. See [Event Contract Collection Runner SQLite](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md).

Day15-T3B10-T3A selects the Node 24.12+ `node:sqlite` standard-library binding for the local research pilot and implements only safe path resolution, hardened database opening, verified connection pragmas, capability/integrity checks, and checksum-bound migration 001. The public store surface exposes no raw database handle or arbitrary mutation method. No third-party SQLite package, application runtime store, repository transaction, scheduler, worker, provider request, pilot activation, or trading authority is added. The binding remains disallowed for commercial/production persistence while Node documents it as active development. See [Event Contract Collection Runner SQLite Dependency and Migration](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_MIGRATION.md).

Day15-T3B10-T3B adds a restricted repository port over that private store. Named `BEGIN IMMEDIATE` transactions implement T2-T10 plus the explicit T8B `IN_FLIGHT -> VALIDATING` bridge, revalidate exact domain/source authority, enforce compare-and-swap versions and bounded attempts, and atomically bind results, normalized evidence, counters, leases, transitions, and sanitized outbox records. The public surface returns immutable sanitized views and exposes neither SQL nor raw canonical JSON. It still creates no application runtime store and starts no scheduler, worker, retry loop, provider request, real pilot, model, recommendation, broker, order, or execution path. See [Event Contract Collection Runner SQLite Repository](specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_REPOSITORY.md).

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
