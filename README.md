# Alpha

> A Personal Capital Operating System

Alpha is a pre-alpha decision-support system for protecting, allocating, growing, and compounding capital. It is not a trading bot and does not authorize autonomous capital or trade execution.

## Current Status

Day 6 has started. D6-T1 Development Efficiency and D6-T2 Production Persistence and Recovery Architecture are complete and pushed. D6-T3 implements the Historical Pattern Library foundation and is awaiting owner review. Day 5 is complete through the Development Validation Log foundation. The current TypeScript aggregate validation baseline is 716/716 tests: 333 AI Infrastructure tests, 273 Day 5 learning-infrastructure tests, 42 Opportunity/Prediction engine tests, and 68 Historical Pattern Library tests.

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

The Python and TypeScript layers are not yet integrated into one runtime. The TypeScript AI infrastructure uses neutral fixtures only: there is no production provider adapter, provider SDK, credential handling, network/API call, or live AI execution.

Local AI Cost Ledger, Unified Audit, Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, Development Validation Log, and Historical Pattern Library NDJSON repositories are single-process development persistence. They are not a production database or cross-repository transaction boundary. Future production persistence and recovery requirements are specified in [Production Persistence and Recovery](docs/PRODUCTION_PERSISTENCE_RECOVERY_SPECIFICATION.md), with no production implementation added.

## Architecture Boundary

AI may provide advisory output. Deterministic Alpha systems retain control of calculations, validation, financial permission, reservation state, accounting, evidence, risk, decisions, and capital state. AI does not control portfolio or trade execution.

See [Architecture](docs/ARCHITECTURE.md), [Roadmap](docs/ROADMAP.md), and [Handoff](docs/HANDOFF.md) for current boundaries and next priorities.

Day 5 contracts and boundaries are specified in [Prediction Log](docs/PREDICTION_LOG_SPECIFICATION.md), [Alpha Journal](docs/ALPHA_JOURNAL_SPECIFICATION.md), [Research Lab](docs/RESEARCH_LAB_SPECIFICATION.md), [Strategy Versioning](docs/STRATEGY_VERSIONING_SPECIFICATION.md), and [Development Validation Log](docs/DEVELOPMENT_VALIDATION_LOG_SPECIFICATION.md).

Day 6 development-efficiency rules are specified in [Codex Development Standard](docs/CODEX_DEVELOPMENT_STANDARD.md), [Codex Task Template](docs/CODEX_TASK_TEMPLATE.md), and [Owner Review Template](docs/OWNER_REVIEW_TEMPLATE.md).

Day 6 historical evidence boundaries are specified in [Historical Pattern Library](docs/HISTORICAL_PATTERN_LIBRARY_SPECIFICATION.md). Historical events and reusable patterns are separate records; facts, observations, interpretations, and inferences remain structurally distinct. No Historical Analogy Engine, Event Replay, historical-data ingestion, live market integration, or prediction behavior is implemented.

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
|   `-- types/           # Minimal local Node standard-library declarations
|-- package.json         # TypeScript validation and test commands
|-- tsconfig.json
|-- AGENTS.md
`-- README.md
```

## TypeScript Setup and Validation

Requirements: Node.js and npm.

```text
npm install
npm run typecheck
npm test
npm run alpha:validate
```

`npm test` runs the complete deterministic TypeScript suite, including the focused Strategy Versioning, Development Validation Log, and Historical Pattern Library suites.

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
