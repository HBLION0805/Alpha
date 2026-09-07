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

- Robinhood data-access preparation: dated public report, bounded offline tool-catalog assessment, anonymous fixed-endpoint HTTP probe and disabled five-tool example; no authentication, quote adapter or market-data connection
- Local research input preparation: source manifest/child/metadata/config linkage, explicit blockers and immutable preparation artifacts; INPUTS_LINKED_FOR_RESEARCH is not market validation
- Dated Robinhood single-execution fee estimates for September 4, 2026 and primary-source contract/calendar/order/account reference; no automatic change to accepted replay fee inputs
- Independent GLD/IBIT historical interval research: frozen counterfactual plans, declared contract/session/cost assumptions, later-snapshot assumed fills, isolated USD 1,000 accounts, all-outcome reviews and candidate lessons using actual recording time
- Bounded local source extraction: one session / up to four declared contracts, source/child hashes and selection/row-count manifest; no actual target-ETF dataset has been acquired
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

Historical research has its own versioned engine and journal. It retains original source clocks and actual import/run-recording clocks; plan and subset selection are retrospective declarations. Every fill is assumed, missing or zero sizes cannot be invented, and unresolved positions remain unresolved. Do not alter the original market-evidence NO_REPLAY gate or old paper/review fingerprints. Research lessons are candidates recorded in actual research time, not verified historical knowledge or authority to change a strategy. See docs/OPTIONS_HISTORICAL_REPLAY_DELIVERY.md for delivery evidence and remaining actual-data requirements.

Preparation links declarations and retains the actual preparation clock; it does not import data, authenticate the parent source, run a replay or grant authority. Preserve accepted preparation artifacts and existing journals. Dated fee estimates cannot silently update frozen plans. See [preparation delivery](docs/OPTIONS_RESEARCH_PREPARATION_DELIVERY.md) and [Robinhood research reference](docs/OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

Robinhood's official Trading MCP now documents options tools, but Alpha is not connected. Its public historical-data description is OHLC, not confirmed historical bid/ask sizes. Assess an authorized read-only capability/schema review before assuming a paid provider is the only data route; public documentation is not account access, entitlement or execution authority.

The data-readiness command inspects local declarations and can make one anonymous fixed-endpoint GET without reading a body or invoking MCP. Its checked-in example remains disabled. After that delivery, the Owner explicitly authorized installing and enabling only get_option_chains, get_option_instruments, get_option_quotes, get_option_historicals and get_equity_quotes, with the Owner completing official login. The host configuration is installed; login completion has not yet been observed. This authorization persists without reconfirmation. Stop before any new-account or paid step. Account/order tools and brokerage transactions remain unauthorized. The five-tool client filter does not narrow server-side permissions or enforce GLD/IBIT arguments. Never relabel a Robinhood response as Cboe evidence; preserve existing journals and fingerprints. See [host setup](docs/OPTIONS_ROBINHOOD_CONNECTION_SETUP.md) for current operational authority and [data-readiness delivery](docs/OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md) for the earlier implementation snapshot.

On 2026-09-06, the Owner deferred paid market data and directed continued local workflow preparation. The earlier capped purchase question is resolved; continue the authorized local work without another procurement request.

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
