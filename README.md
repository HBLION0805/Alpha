# Alpha

> A Personal Capital Operating System

Alpha is a pre-alpha decision-support system for protecting, allocating, growing, and compounding capital. It is not a trading bot and does not authorize autonomous capital or trade execution.

## Current Status

Day 8 Intelligence foundations through Day15-T3B14-MR4 are complete and pushed. Design-only Day15-T3B15-T1 is complete locally and pending Owner review. It defines one exact Owner-gated, fixed-root, actual-Alpha-validation, network-free fixture-rehearsal operation while retaining `NO_GO_FOR_REHEARSAL_EXECUTION`. No command implementation, executable or continuous runtime, real rehearsal, network provider, real Pilot, T1/T2 delivery, recommendation, or trading authority is authorized.

Implemented Python prototype/runtime:

- Portfolio models and calculations
- Terminal dashboard using sample development data
- Deterministic decision rules
- Configuration and deterministic risk limits

Implemented and tested TypeScript foundations:

- Shared contract and repository-port layer
- Opportunity Score Engine v1
- Prediction Engine v1
- Prediction Log repository and deterministic review lifecycle foundation
- Alpha Journal append-only evidence and review foundation
- Research Lab append-only research evidence and review foundation
- Strategy Versioning immutable lifecycle, comparison, activation, and rollback foundation
- Development Validation Log append-only engineering-memory foundation
- Historical Pattern Library append-only historical-event and reusable-pattern foundation
- Historical Analogy Engine deterministic comparison, scoring, ranking, review, and evidence foundation
- Event Replay deterministic timeline, checkpoint, replay-session, export, and audit foundation
- AI Router deterministic planning
- AI Cost Governor enforcement
- AI Provider Adapter interface and registry
- AI Execution Coordinator
- AI Reservation Manager
- AI Cost Ledger
- Unified Audit Repository
- AI Runtime Workflow
- Codex Development Standard, task template, owner review template, and local validation bundle foundation
- Production Persistence and Recovery Architecture specification
- Python-TypeScript Integration Boundary with one registered read-only Risk Engine operation
- Unified Validation Reporting with one normalized local validation result shape
- Historical Evidence Product Surface with a read-only combined historical-evidence view
- Cross-System Evidence Linking with explicit typed, version-aware, read-only links across Prediction, Strategy, Historical Evidence, Event Replay, Outcome, and Journal records
- Evidence Assessment, Strategy Review, and Minimal Knowledge Approval foundations with fail-closed evidence and owner-approval boundaries
- Market Data Layer quote foundation with canonical identities, fixed-decimal values, explicit provider capabilities, provenance, normalization, and deterministic validation
- Market Data Provider Registry foundation with canonical provider metadata, deterministic discovery, immutable results, and explicit capability/asset-class queries
- Canonical Instrument, Canonical Quote, and Canonical Bar foundations with provider-independent identity, fixed-decimal values, explicit time/quality/provenance semantics, and fail-closed validation
- Immutable registry/adapter composition with multi-capability provider binding and capability-specific Quote/Bar orchestration
- Twelve Data fixture-first intraday Bar adapter plus a separately reviewed AAPL/PT5M one-shot HTTPS smoke boundary with redacted environment credentials and fail-closed live-volume semantics
- Market Regime Engine foundation with immutable snapshots, versioned deterministic price rules, primary regimes, independent evidence-gated conditions, explainable reasons, and Unified Audit translation
- Broad Market Evidence foundation with reviewed benchmark membership, fixed-decimal feature facts, deterministic multi-benchmark composition, explicit quality, and Unified Audit translation
- Evidence Fusion foundation with a provider-neutral source adapter, versioned source policy, immutable fail-closed snapshots, and Unified Audit translation
- Event Analyzer console prototype with fixed-decimal BTC 15-minute inputs, bounded local PT1M candle features, explicit evidence quality/reversal risk, a transparent uncalibrated probability heuristic, fair-value/edge comparison, and non-authoritative `BUY`, `HOLD`, or `NO_TRADE` output
- Capital Allocation Framework v1.0 with immutable allocation-candidate/recommendation contracts, evidence-before-allocation and risk-before-allocation validation, deterministic construction, unranked extension points, and explicit non-execution authority
- BTC Event Contract Observation v1 with exact Robinhood contract terms, BRTI reference-price identity, symmetric UP/DOWN quotes and fee previews, deterministic all-in break-even arithmetic, strict evidence binding, and observation-only authority
- BTC Event Contract Shadow Ledger v1 with local JSON capture, canonical append-only NDJSON history, exact observation-to-settlement binding, deterministic hypothetical UP/DOWN net outcomes, and shadow-only authority
- Research Integrity and Leakage Prevention v1 with explicit occurrence/publication/availability/receipt times, forward-versus-historical rules, completed-interval enforcement, frozen dataset manifests, and outcome-leakage blocking
- Research Dataset Qualification and Temporal Split v1 with a pre-event frozen collection plan, integrity-audit binding, deterministic eligibility thresholds, chronological train/calibration/final-test partitions, and explicit embargo gaps
- Research Shadow Dataset Assembly v1 with explicit plan-to-ledger bindings, official-settlement labels, T3A audit lineage, deterministic snapshot fingerprints, and no inferred or repaired samples
- Forward Shadow Collection Control v1 with deterministic continuous plan creation and read-only per-event capture/settlement progress
- Forward Shadow Collection Operator v1 with exclusive local plan freezing and verified read-only progress inspection
- Event Contract Collection Source Architecture v1 with exact cross-venue mapping, source-authority, credential, transport, and staged-release gates
- Event Contract Source Contracts v1 with immutable provider descriptors, exact reviewed mappings, fixture-only source snapshots, provenance chronology, and deterministic fingerprints
- Kalshi BTC 15-minute fixture normalization with exact official market/series validation, reviewed public Robinhood evidence, one exact cross-venue mapping, and one fixture settlement snapshot
- Kalshi bounded live-read smoke foundation with one fixed public market endpoint, zero credentials, strict request/byte/record budgets, injected network-free tests, zero persistence, and a default dry run
- Event Contract Collection Runner architecture with frozen-plan admission, separate platform/exchange lanes, deterministic scheduling and clocks, bounded retry, transactional idempotency, crash recovery, and sanitized monitoring
- Event Contract Collection Runner contracts with immutable runner definitions, owner-approval evidence, exact admission bundles, scheduled-task idempotency, and compare-and-swap pilot/task state validation
- Event Contract Collection Runner SQLite design with strict local-pilot tables, forward-only migrations, atomic evidence commit, durable claim/result history, transactional outbox, recovery, backup, restore, and corruption drills
- Event Contract Collection Runner SQLite migration foundation with Node 24.12+ standard-library binding, safe local paths, verified WAL/foreign-key pragmas, checksum-bound migration 001, exact `STRICT` schema checks, and no repository or runner operation
- Event Contract Collection Runner SQLite repository with named T2-T10/T8B transactions, strict authority binding, compare-and-swap state, durable claims, bounded retry, atomic evidence/outbox commit, and sanitized immutable reads
- Event Contract Collection Runner SQLite recovery with fail-closed startup inspection, manifest-bound online backup, offline restore to a new path, and corruption drills
- Event Contract Collection Runner recovery-control design separating one-time Owner Resume authority from Pilot state, with Emergency Stop precedence and fail-closed race rules
- Recovery-control SQLite schema v2 and restricted named transactions for immutable assessments, owner decisions, one-time session authorizations, Emergency Stop, and atomic execution receipts/outbox evidence
- Local-only Owner recovery command with stdin-only secret handling, `scrypt` verification, exact command challenges, per-write process-session revalidation, and an irreversible in-memory stop barrier
- Network-free recovery-control drills covering two-connection stop/resume ordering, crash/restart invalidation, atomic rollback, and durable-stop failure
- Fixture-only collection-runner runtime foundation with strict immutable configuration, safe local roots, atomic single-process ownership, OS-CSPRNG process identity, process-liveness and boot-identity ports, and separated wall/monotonic/clock-health authority
- Pure deterministic collection-runner scheduling plus one explicit fixture-only Worker cycle with exact adapter binding, bounded retry, cutoff/budget enforcement, cancellation, session-gated persistence, and ambiguity-preserving Stop behavior
- Local collection-runner Operator and Health surface with fail-closed Preflight/Status reports, authenticated graceful/Emergency Stop orchestration, in-process Stop notification, and bounded payload-free SQLite Outbox projection
- Process-level collection-runner drills covering duplicate ownership, forced exit, stale-lock restart, retry timeout, cutoff, Stop precedence, replay conflict, and fail-closed health

The TypeScript application layer can now invoke one registered read-only Python Risk Engine calculation through a versioned typed client and fixed local subprocess adapter. No dashboard or business consumer is wired to the boundary yet, Python does not invoke TypeScript, and no mutable cross-runtime operation exists. The TypeScript AI infrastructure still uses neutral fixtures only: there is no production provider adapter, provider SDK, credential handling, network/API call, or live AI execution.

Local AI Cost Ledger, Unified Audit, Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, Development Validation Log, Historical Pattern Library, Historical Analogy Engine, Event Replay, and Event Contract Shadow Ledger NDJSON repositories are single-process development persistence. They are not a production database or cross-repository transaction boundary. Future production persistence and recovery requirements are specified in [Production Persistence and Recovery](docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md), with no production implementation added.

## Architecture Boundary

AI may provide advisory output. Deterministic Alpha systems retain control of calculations, validation, financial permission, reservation state, accounting, evidence, risk, decisions, and capital state. AI does not control portfolio or trade execution.

See [Architecture](docs/ARCHITECTURE.md), [Roadmap](docs/ROADMAP.md), and [Handoff](docs/HANDOFF.md) for current boundaries and next priorities.

The Runner foundation decision is recorded in [Event Contract Collection Runner Milestone Review](docs/EVENT_CONTRACT_COLLECTION_RUNNER_MILESTONE_REVIEW.md). The fixture-runtime decision is recorded in [Event Contract Collection Runner Runtime Milestone Review](docs/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_MILESTONE_REVIEW.md), the assembly decision in [Event Contract Collection Runner Runtime Assembly Milestone Review](docs/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_MILESTONE_REVIEW.md), the first rehearsal-foundation decision in [Event Contract Collection Runner Fixture Rehearsal Milestone Review](docs/EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_MILESTONE_REVIEW.md), and the current durable-readiness decision in [Event Contract Collection Runner Durable Fixture Rehearsal Milestone Review](docs/EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_MILESTONE_REVIEW.md). The original runtime boundary is defined in [Event Contract Collection Runner Runtime Architecture](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME.md), the assembly boundary in [Event Contract Collection Runner Runtime Assembly and Recovery Architecture](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_RECOVERY.md), the durable rehearsal boundary in [Durable Fixture Rehearsal Composition and Evidence Architecture](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_COMPOSITION.md), and the next operation boundary in [Exact Owner-Gated Network-Free Rehearsal Operation Architecture](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_OWNER_GATED_REHEARSAL_OPERATION.md).

Day 5 contracts and boundaries are specified in [Prediction Log](docs/PREDICTION_LOG_SPECIFICATION.md), [Alpha Journal](docs/ALPHA_JOURNAL_SPECIFICATION.md), [Research Lab](docs/RESEARCH_LAB_SPECIFICATION.md), [Strategy Versioning](docs/STRATEGY_VERSIONING_SPECIFICATION.md), and [Development Validation Log](docs/DEVELOPMENT_VALIDATION_LOG_SPECIFICATION.md).

Day 6 development-efficiency rules are specified in [Codex Development Standard](docs/CODEX_DEVELOPMENT_STANDARD.md), [Codex Task Template](docs/CODEX_TASK_TEMPLATE.md), and [Owner Review Template](docs/OWNER_REVIEW_TEMPLATE.md).

Day 6 historical evidence boundaries are specified in [Historical Pattern Library](docs/HISTORICAL_PATTERN_LIBRARY_SPECIFICATION.md), [Historical Analogy Engine](docs/HISTORICAL_ANALOGY_ENGINE_SPECIFICATION.md), and [Event Replay Architecture](docs/EVENT_REPLAY_ARCHITECTURE_SPECIFICATION.md). Historical events and reusable patterns remain historical truth; deterministic analogy results report similarities, differences, missing data, completeness, evidence quality, bias, and limitations for Research Lab review; Event Replay reconstructs caller-supplied historical timelines through immutable checkpoints. Those systems contain no AI similarity scoring, embeddings, vector database, historical-data ingestion, live market integration, prediction, trading recommendation, backtesting, or execution simulation.

The D7-T1 local runtime boundary is specified in [Python-TypeScript Integration Boundary](docs/PYTHON_TYPESCRIPT_INTEGRATION_BOUNDARY.md). TypeScript consumers depend on typed client and transport ports; only the fixed Python entry point knows the explicit operation registry and Python domain implementation. Day 7 also adds read-only validation reporting, a historical evidence product surface, and explicit cross-system evidence links; they do not add a provider, network, dashboard, persistence, recommendation, or capital-execution path.

The deterministic Intelligence Layer direction is documented in [Architecture Checkpoint 1](docs/ARCHITECTURE_CHECKPOINT_1.md). Provider-independent market boundaries are specified in [Market Data Layer](docs/specifications/MARKET_DATA_LAYER.md), [Provider Registry](docs/specifications/PROVIDER_REGISTRY.md), [Twelve Data Bar Adapter](docs/specifications/TWELVE_DATA_ADAPTER.md), [Twelve Data Live Smoke Transport](docs/specifications/TWELVE_DATA_LIVE_SMOKE.md), [Broad Market Evidence](docs/specifications/BROAD_MARKET_EVIDENCE.md), [Evidence Fusion](docs/specifications/EVIDENCE_FUSION.md), and [Market Regime Engine](docs/specifications/MARKET_REGIME_ENGINE.md). The isolated [Event Analyzer Console](docs/specifications/EVENT_ANALYZER_CONSOLE.md) is a deterministic prototype, not a production Decision or trading path. [Capital Allocation Framework](docs/specifications/CAPITAL_ALLOCATION_FRAMEWORK.md) defines the downstream recommendation envelope without ranking, leverage, portfolio mutation, or execution. [BTC Event Contract Observation](docs/specifications/EVENT_CONTRACT_OBSERVATION.md) owns only normalized point-in-time contract facts and fee arithmetic. [Event Contract Shadow Ledger](docs/specifications/EVENT_CONTRACT_SHADOW_LEDGER.md) persists those facts and exact later settlements for research, without probability or action authority. [Research Integrity](docs/specifications/RESEARCH_INTEGRITY.md) blocks future information, incomplete intervals, outcome contamination, and frozen-dataset mismatch before calibration or backtesting. [Research Dataset Qualification](docs/specifications/RESEARCH_DATASET_QUALIFICATION.md) requires a prospectively frozen event plan, minimum coverage and balance, one feature and integrity-policy lineage, and embargoed chronological partitions before any later model research. [Research Shadow Dataset Assembly](docs/specifications/RESEARCH_SHADOW_DATASET_ASSEMBLY.md) binds that plan to exact settled shadow histories and eligible audits. [Forward Shadow Collection Control](docs/specifications/FORWARD_SHADOW_COLLECTION_CONTROL.md) creates aligned future plans and reports manual capture/settlement progress without adding automatic collection. [Forward Shadow Collection Operator](docs/specifications/FORWARD_SHADOW_COLLECTION_OPERATOR.md) exposes only explicit local plan freezing and verified read-only progress commands. [Event Contract Collection Source Architecture](docs/specifications/EVENT_CONTRACT_COLLECTION_SOURCE_ARCHITECTURE.md) defines exact source and venue mapping before any real-data adapter. [Event Contract Source Contracts](docs/specifications/EVENT_CONTRACT_SOURCE_CONTRACTS.md) enforces that architecture through provider-neutral immutable records. [Kalshi Event Contract Fixture Adapter](docs/specifications/KALSHI_EVENT_CONTRACT_FIXTURE_ADAPTER.md) validates one official BTC 15-minute fixture and one sanitized official Robinhood public-page fixture, content-addresses the linked terms, and qualifies one fixture-only cross-venue settlement snapshot. [Kalshi Event Contract Bounded Live-Read Smoke](docs/specifications/KALSHI_EVENT_CONTRACT_LIVE_SMOKE.md) adds one manually confirmed public GET boundary that defaults to zero-network dry run and writes nothing. [Event Contract Collection Runner Architecture](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_ARCHITECTURE.md) specifies future scheduling, transactional idempotency, recovery, and monitoring. [Event Contract Collection Runner Contracts](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_CONTRACTS.md) implements only provider-neutral records and deterministic lifecycle validation. [Event Contract Collection Runner SQLite](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE.md) specifies the future local pilot store and atomic transaction boundaries without implementing persistence. These foundations defer automatic platform evidence, runner persistence and operation, production collection, commercial persistence, and trading infrastructure.

The T3B10-T3A implementation boundary is specified in [Event Contract Collection Runner SQLite Dependency and Migration](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_MIGRATION.md). T3A implements safe local store opening and migration 001; [T3B](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_SQLITE_REPOSITORY.md) adds the named repository transactions while runner operation remains deferred.

[Event Contract Collection Runner Runtime Assembly and Recovery](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_RECOVERY.md) defines and implements the fixture-only one-action composition boundary, authenticated stale-ownership quarantine, and real child-process transaction recovery drills. Its [milestone review](docs/EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_ASSEMBLY_MILESTONE_REVIEW.md) accepts those foundations for fixture-rehearsal design only. It still exposes no executable runtime command, continuous loop, network provider, real Pilot activation, recommendation, broker, order, or trading authority.

[Event Contract Collection Runner Fixture Rehearsal and Evidence Architecture](docs/specifications/EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL.md) defines the next network-free system rehearsal: one immutable manifest, one allow-listed fixture catalog, isolated temporary state, separate one-action invocations, bounded sanitized evidence packaging, and independent deterministic verification. The design does not implement or run the rehearsal.

## Repository Structure

```text
Alpha/
|-- app/                 # Python portfolio, dashboard, decision, and risk prototype
|-- config/              # Python decision and risk configuration
|-- data/                # Local data; runtime AI ledger/audit paths are Git-ignored
|-- docs/                # Architecture, specifications, roadmap, decisions, and handoff
|-- src/
|   |-- contracts/       # Provider-neutral TypeScript records and validation
|   |-- engines/         # Deterministic business, engineering-memory, and AI engines
|   |-- repositories/    # Repository ports and local append-only implementations
|   |-- integration/     # Typed cross-runtime client and transport adapters
|   `-- types/           # Minimal local Node standard-library declarations
|-- package.json         # TypeScript validation and test commands
|-- tsconfig.json
|-- AGENTS.md
`-- README.md
```

## TypeScript Setup and Validation

Requirements: Node.js 24.12 or newer, npm, and Python 3. The Node requirement supports the local `node:sqlite` migration foundation; the integration tests use only the Python standard library.

```text
npm install
npm run typecheck
npm test
npm run alpha:validate
```

`npm test` runs the complete registered validation pipeline, including deterministic TypeScript suites and focused Python integration tests. Coverage includes Strategy Versioning, Development Validation Log, Historical Pattern Library, Historical Analogy Engine, Event Replay, Historical Evidence Product Surface, Cross-System Evidence Linking, Evidence Assessment, Strategy Review, Knowledge Approval, Canonical Market contracts, Market Data, Provider Registry/composition, the fixture-first Twelve Data adapter, Broad Market Evidence, Evidence Fusion, Market Regime, Event Analyzer, Capital Allocation, BTC Event Contract Observation, Event Contract Shadow Ledger, Research Integrity, Research Dataset Qualification, Research Shadow Dataset Assembly, Forward Shadow Collection Control, Event Contract Source Contracts, and Python-TypeScript Integration.

`npm run alpha:validate` runs the local validation bundle: required-file checks, strict typecheck, aggregate tests, Markdown link/path/fence checks, provider/network/API/credential scans, Python-change scan, runtime-data tracking scan, merge-marker scan, separate unstaged and staged Git whitespace checks, and final working-tree warning. Component commands remain individually available.

## Python Prototype

The terminal prototype imports the third-party `rich` package. Python dependencies are not yet pinned in this repository.

```text
python -m pip install rich
python -m app.main
```

The Python application currently uses sample portfolio data and is not wired to the TypeScript engines or AI infrastructure.

## Development Principles

- Protect capital before pursuing growth.
- Use deterministic software when it is more accurate, faster, and cheaper than AI.
- Keep AI provider-independent and advisory.
- Record important decisions and preserve immutable evidence.
- Specify major subsystem boundaries before implementation.
- Require owner approval before commits, pushes, production adapters, or execution integration.
- Optimize repeated Codex prompt context only when quality, validation, owner authority, and safety boundaries remain intact.
