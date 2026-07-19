# Alpha

> A Personal Capital Operating System

Alpha is a pre-alpha decision-support system for protecting, allocating, growing, and compounding capital. It is not a trading bot and does not authorize autonomous capital or trade execution.

## Current Status

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
- AI Router deterministic planning
- AI Cost Governor enforcement
- AI Provider Adapter interface and registry
- AI Execution Coordinator
- AI Reservation Manager
- AI Cost Ledger
- Unified Audit Repository
- AI Runtime Workflow

The Python and TypeScript layers are not yet integrated into one runtime. The TypeScript AI infrastructure uses neutral fixtures only: there is no production provider adapter, provider SDK, credential handling, network/API call, or live AI execution.

Local AI Cost Ledger, Unified Audit, Prediction Log, Alpha Journal, and Research Lab NDJSON repositories are single-process development persistence. They are not a production database or cross-repository transaction boundary.

## Architecture Boundary

AI may provide advisory output. Deterministic Alpha systems retain control of calculations, validation, financial permission, reservation state, accounting, evidence, risk, decisions, and capital state. AI does not control portfolio or trade execution.

See [Architecture](docs/ARCHITECTURE.md), [Roadmap](docs/ROADMAP.md), and [Handoff](docs/HANDOFF.md) for current boundaries and next priorities.

## Repository Structure

```text
Alpha/
|-- app/                 # Python portfolio, dashboard, decision, and risk prototype
|-- config/              # Python decision and risk configuration
|-- data/                # Local data; runtime AI ledger/audit paths are Git-ignored
|-- docs/                # Architecture, specifications, roadmap, decisions, and handoff
|-- src/
|   |-- contracts/       # Provider-neutral TypeScript records and validation
|   |-- engines/         # Deterministic Opportunity, Prediction, Journal, Research, and AI engines
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
```

`npm test` runs the complete deterministic TypeScript suite, including the focused Research Lab suite.

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
