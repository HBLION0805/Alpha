# Alpha

> A Personal Capital Operating System

Alpha is a pre-alpha decision-support system for protecting, allocating, growing, and compounding capital. It is not a trading bot and does not authorize autonomous capital or trade execution.

## Current Status

Day 8 Intelligence foundations, the Day 9 Canonical Market Domain, and Day 10 Market Data boundary work are complete and pushed. Day11-T1 adds a reviewed, manually bounded Twelve Data HTTPS transport, mandatory network-free dry run, and explicit one-shot confirmation path. No real live API call has been executed; no credential, provider data, persistence, polling, paper trading, decision wiring, or execution behavior is committed.

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

The TypeScript application layer can now invoke one registered read-only Python Risk Engine calculation through a versioned typed client and fixed local subprocess adapter. No dashboard or business consumer is wired to the boundary yet, Python does not invoke TypeScript, and no mutable cross-runtime operation exists. The TypeScript AI infrastructure still uses neutral fixtures only: there is no production provider adapter, provider SDK, credential handling, network/API call, or live AI execution.

Local AI Cost Ledger, Unified Audit, Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, Development Validation Log, Historical Pattern Library, Historical Analogy Engine, and Event Replay NDJSON repositories are single-process development persistence. They are not a production database or cross-repository transaction boundary. Future production persistence and recovery requirements are specified in [Production Persistence and Recovery](docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md), with no production implementation added.

## Architecture Boundary

AI may provide advisory output. Deterministic Alpha systems retain control of calculations, validation, financial permission, reservation state, accounting, evidence, risk, decisions, and capital state. AI does not control portfolio or trade execution.

See [Architecture](docs/ARCHITECTURE.md), [Roadmap](docs/ROADMAP.md), and [Handoff](docs/HANDOFF.md) for current boundaries and next priorities.

Day 5 contracts and boundaries are specified in [Prediction Log](docs/PREDICTION_LOG_SPECIFICATION.md), [Alpha Journal](docs/ALPHA_JOURNAL_SPECIFICATION.md), [Research Lab](docs/RESEARCH_LAB_SPECIFICATION.md), [Strategy Versioning](docs/STRATEGY_VERSIONING_SPECIFICATION.md), and [Development Validation Log](docs/DEVELOPMENT_VALIDATION_LOG_SPECIFICATION.md).

Day 6 development-efficiency rules are specified in [Codex Development Standard](docs/CODEX_DEVELOPMENT_STANDARD.md), [Codex Task Template](docs/CODEX_TASK_TEMPLATE.md), and [Owner Review Template](docs/OWNER_REVIEW_TEMPLATE.md).

Day 6 historical evidence boundaries are specified in [Historical Pattern Library](docs/HISTORICAL_PATTERN_LIBRARY_SPECIFICATION.md), [Historical Analogy Engine](docs/HISTORICAL_ANALOGY_ENGINE_SPECIFICATION.md), and [Event Replay Architecture](docs/EVENT_REPLAY_ARCHITECTURE_SPECIFICATION.md). Historical events and reusable patterns remain historical truth; deterministic analogy results report similarities, differences, missing data, completeness, evidence quality, bias, and limitations for Research Lab review; Event Replay reconstructs caller-supplied historical timelines through immutable checkpoints. Those systems contain no AI similarity scoring, embeddings, vector database, historical-data ingestion, live market integration, prediction, trading recommendation, backtesting, or execution simulation.

The D7-T1 local runtime boundary is specified in [Python-TypeScript Integration Boundary](docs/PYTHON_TYPESCRIPT_INTEGRATION_BOUNDARY.md). TypeScript consumers depend on typed client and transport ports; only the fixed Python entry point knows the explicit operation registry and Python domain implementation. Day 7 also adds read-only validation reporting, a historical evidence product surface, and explicit cross-system evidence links; they do not add a provider, network, dashboard, persistence, recommendation, or capital-execution path.

The deterministic Intelligence Layer direction is documented in [Architecture Checkpoint 1](docs/ARCHITECTURE_CHECKPOINT_1.md). Provider-independent market boundaries are specified in [Market Data Layer](docs/specifications/MARKET_DATA_LAYER.md), [Provider Registry](docs/specifications/PROVIDER_REGISTRY.md), [Twelve Data Bar Adapter](docs/specifications/TWELVE_DATA_ADAPTER.md), and [Twelve Data Live Smoke Transport](docs/specifications/TWELVE_DATA_LIVE_SMOKE.md). They defer a general-purpose Alpha Memory database, automated market retrieval, production persistence, and trading infrastructure.

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

Requirements: Node.js, npm, and Python 3. The integration tests use only the Python standard library.

```text
npm install
npm run typecheck
npm test
npm run alpha:validate
```

`npm test` runs the complete registered validation pipeline, including deterministic TypeScript suites and focused Python integration tests. Coverage includes Strategy Versioning, Development Validation Log, Historical Pattern Library, Historical Analogy Engine, Event Replay, Historical Evidence Product Surface, Cross-System Evidence Linking, Evidence Assessment, Strategy Review, Knowledge Approval, Canonical Market contracts, Market Data, Provider Registry/composition, the fixture-first Twelve Data adapter, and Python-TypeScript Integration.

`npm run alpha:validate` runs the local validation bundle: required-file checks, strict typecheck, aggregate tests, Markdown link/path/fence checks, provider/network/API/credential scans, Python-change scan, runtime-data tracking scan, merge-marker scan, `git diff --check`, and final working-tree warning. Component commands remain individually available.

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
