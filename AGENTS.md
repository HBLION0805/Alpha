# Alpha Development Standard v1.0

## Project Overview

Alpha is a Personal Capital Operating System. It is designed to help manage capital through structured portfolio visibility, decision support, configuration, and risk awareness.

This document is the permanent development guide for AI coding agents working on the Alpha project.

## Required Reading

Before major implementation work, agents must inspect:

- README.md
- docs/DEVELOPMENT_STANDARD.md
- docs/CODEX_DEVELOPMENT_STANDARD.md
- docs/ARCHITECTURE.md
- docs/CORE_PRINCIPLES.md
- docs/ROADMAP.md
- docs/HANDOFF.md when it contains current project state

## Mission

- Protect Capital
- Allocate Capital
- Grow Capital
- Compound Capital

## Development Principles

- Never use AI when deterministic software can solve the task more accurately, faster, and cheaper.
- AI provides recommendations; deterministic software performs calculations and enforcement.
- Preserve existing working code.
- Prefer small, reversible changes.
- Never modify unrelated files.
- Do not perform large refactors without explaining the problem, expected benefit, and cost.
- Keep user-facing product text in English.
- Respect existing architecture and patterns.
- Do not silently invent requirements.
- Explain every code change clearly.
- Keep changes focused on the assigned task.
- Define and review a specification before implementing a major new subsystem.

## Testing and Validation

- Run relevant tests after code changes.
- Run the application when useful.
- Report commands executed and their results.
- If tests cannot run, explain exactly why.
- Do not claim success without evidence.

## Git Safety

- Do not commit automatically.
- Do not push automatically.
- Do not create or merge pull requests without owner approval.
- Show the diff before asking for approval.
- Keep changes small and reviewable.

## Development Workflow

Design
|
v
Implementation
|
v
Review
|
v
Testing
|
v
Owner Approval
|
v
Commit
|
v
Push

## Current Implemented Systems

- Python prototype/runtime: Portfolio, terminal Dashboard, Config, Risk Engine, and early deterministic Decision Engine rules
- TypeScript core: contract and repository-port layer, Opportunity Score Engine v1, and Prediction Engine v1
- Alpha AI Infrastructure v1: Router, Cost Governor, Provider Adapter boundary, Execution Coordinator, Reservation Manager, Cost Ledger, Unified Audit Repository, and Runtime Workflow foundations
- Alpha Learning Infrastructure v1: Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, and Development Validation Log foundations
- Historical Evidence Infrastructure: Historical Pattern Library, deterministic Historical Analogy Engine, and Event Replay Architecture foundations
- Day 6 Development Efficiency Standard v1 documentation: Codex development standard, task template, owner review template, and deterministic validation bundle foundation
- Day 7 integration and evidence foundations: versioned local Python-TypeScript read boundary, unified validation reporting, read-only Historical Evidence Product Surface, and typed Cross-System Evidence Linking

The Python and TypeScript surfaces now have one narrow local read-only integration boundary, but they are not a unified product runtime. Day 7 read models and links do not add dashboard wiring, recommendations, automatic learning, mutable cross-runtime operations, or Python-to-TypeScript calls. TypeScript local NDJSON repositories are single-process development persistence. No production AI provider adapter, live AI API integration, live market-data integration, or automated capital execution exists.

## Required Completion Report

After every implementation task, report:

- Files changed
- What changed
- Why it changed
- Tests or commands run
- Test results
- Failures or unresolved issues
- Risks
- Assumptions
- Recommended next step
- Git status
