# Alpha Development Standard v1.0

## Project Overview

Alpha is a Personal Capital Operating System focused on GLD and IBIT options on Robinhood. It supports capital protection through deterministic risk diagnostics, source-attributed market context, and research evidence.

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

- GLD/IBIT source-format market evidence: Cboe DataShop local CSV import, source/time/nullable-liquidity checks, independent integrity journal and explicit NO_REPLAY gate; no actual authorized file or API has been provided
- Local GLD/IBIT options lifecycle: contract/quote inputs, frozen intraday plans, modeled orders/fills/exits, persistent account replay, per-trade reviews and candidate mistake guards; synthetic or unverified imports only
- Options retail feasibility v2: premium stops, all-in planned cash risk, net R targets, whole-contract constraints and separate full-premium stress limits
- Options driver monitor: 16 factor families, 94 catalog indicators, six fixed public headline feeds, versioned local history and explicit coverage gaps
- Options news and market-context fixture infrastructure, canonical data and shared calendar validation
- TypeScript core: contract and repository-port layer, Opportunity Score Engine v1, and Prediction Engine v1
- Alpha AI Infrastructure v1: Router, Cost Governor, Provider Adapter boundary, Execution Coordinator, Reservation Manager, Cost Ledger, Unified Audit Repository, and Runtime Workflow foundations
- Alpha Learning Infrastructure v1: Prediction Log, Alpha Journal, Research Lab, Strategy Versioning, and Development Validation Log foundations
- Historical Evidence Infrastructure: Historical Pattern Library, deterministic Historical Analogy Engine, and Event Replay Architecture foundations
- Day 6 Development Efficiency Standard v1 documentation: Codex development standard, task template, owner review template, and deterministic validation bundle foundation
- Read-only Historical Evidence Product Surface, typed Cross-System Evidence Linking and unified validation reporting

The Owner authorized removal of the unrelated Python, Event Contract/Kalshi and Personal ETF/stock Daily Scan product lanes on 2026-09-06. Their code was removed after dependency review; Git history and historical design records remain. Generic research, history, audit, AI and market-data capabilities remain reusable by Options.

Only the six fixed public headline feeds have live read-only access. Numerical driver connectors, verified GLD/IBIT option chains, complete portfolio enforcement, calibrated outcomes, brokerage access and order execution are not implemented. Local NDJSON persistence is single-process. An hourly Codex heartbeat checks the public feeds while the local computer/app and worktree are available; it does not execute trades. See docs/HANDOFF.md and docs/status/current.json for current evidence.

For the current GLD/IBIT work, the Owner explicitly authorized development, saving, commits and pushes without further confirmation. This recorded authorization satisfies the Git workflow above; it does not authorize brokerage transactions.

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
