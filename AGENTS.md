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

- Unified local operational readiness: six independent component recoveries, selected-study coverage, closed-trade and research review checks, separate candidate notebooks and explicit real-price test dependencies. No HTTP, source refresh, journal append, scheduler operation or brokerage inspection. See docs/OPTIONS_OPERATIONAL_READINESS_DELIVERY.md and docs/status/operational-readiness.json.
- Treasury daily real-yield context: five tenors, bounded anonymous current-month XML GET, exact source/actual retrieval clocks, fixed failure codes, separate checksum-linked journal and correction-preserving restart recovery. Daily news/context uses the v2 restoration snapshot; the original news snapshot and frozen opening quote study remain immutable. See docs/OPTIONS_TREASURY_REAL_YIELDS_DELIVERY.md and docs/status/treasury-real-yields.json. No automatic orders or strategy signal.
- Robinhood collection closeout: deterministic completed-slot coverage, source-failure and missing-request diagnostics, per-contract usable data, candidate operational lessons and immutable prefix-bound reports. The final scheduled step uses options:robinhood-closeout -- --save only after restoring original news. Existing engine outputs and all plans/quotes/journals remain unchanged. See docs/OPTIONS_ROBINHOOD_CLOSEOUT_DELIVERY.md and docs/status/robinhood-closeout.json for the latest operational evidence.
- Robinhood automatic collection: the Owner explicitly authorized market-data collection only and questioned the 10:00 start. The existing gld-ibit heartbeat now targets the newly frozen gld-ibit-observe-open-20260908 study for September 8, 2026 09:30-09:50 New York. Its daily news workflow is preserved and restored afterward. The previous 10:00 plan, smoke frame and activation checkpoint remain intact but are superseded operationally. A bounded local CLI records exact quote replies or sanitized failures with immutable recovery. No actual in-window automatic data exists yet. See docs/OPTIONS_ROBINHOOD_OPENING_WINDOW.md and docs/status/robinhood-opening-collection.json.
- Robinhood observation workflow: bounded eight-contract sample screen, immutable prospective selection/window, exact host quote request templates, linked frame recording and restart-verified candidate data-quality lessons. The September 8 study has one excluded out-of-window smoke frame and no usable prospective series. See docs/OPTIONS_ROBINHOOD_OBSERVATION_DELIVERY.md and its dated pre-scheduler docs/status/robinhood-observation.json.
- Robinhood capture assessment: five tools loaded; seven market-only reads returned four stale, over-budget option quotes and 120 interpolated historical bars. Local bounded parser, immutable captures and four candidate data-quality lessons are implemented; no source-specific replay adapter or trade. See docs/OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md and docs/status/robinhood-capture.json.
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

The six fixed public headline feeds and the single Treasury daily real-yield endpoint have direct live read-only access. Separately, the authorized host Robinhood connection exposes five working market-data tools; Alpha's capture, observation and collection CLIs are offline. Other numerical driver connectors, fully qualified GLD/IBIT quote paths, complete portfolio enforcement, calibrated outcomes, account access and order execution are not implemented. Local persistence is single-process. The existing gld-ibit heartbeat shares the bounded quote window, then restores daily 09:00 New York news plus Treasury context using docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V2.json. The original news-only snapshot remains immutable. See docs/HANDOFF.md and docs/status/treasury-real-yields.json for the latest evidence; current.json is a dated older build checkpoint.

Historical research has its own versioned engine and journal. It retains original source clocks and actual import/run-recording clocks; plan and subset selection are retrospective declarations. Every fill is assumed, missing or zero sizes cannot be invented, and unresolved positions remain unresolved. Do not alter the original market-evidence NO_REPLAY gate or old paper/review fingerprints. Research lessons are candidates recorded in actual research time, not verified historical knowledge or authority to change a strategy. See docs/OPTIONS_HISTORICAL_REPLAY_DELIVERY.md for delivery evidence and remaining actual-data requirements.

Preparation links declarations and retains the actual preparation clock; it does not import data, authenticate the parent source, run a replay or grant authority. Preserve accepted preparation artifacts and existing journals. Dated fee estimates cannot silently update frozen plans. See [preparation delivery](docs/OPTIONS_RESEARCH_PREPARATION_DELIVERY.md) and [Robinhood research reference](docs/OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

Robinhood's official Trading MCP connection and five market tools now work. Actual option bid/ask prices, quantities, quote-refresh timestamps, Greeks and historical OHLC fields were inspected. All four sampled quotes were stale and over budget; all 120 sampled bars were interpolated. There is no qualified quote replay path or source-specific execution adapter. Independent side/size timing, underlying alignment, complete contract/calendar evidence and retention terms remain unverified.

The old data-readiness command and current.json remain dated pre-connection checkpoints, not live configuration discovery. The Owner authorized exactly get_option_chains, get_option_instruments, get_option_quotes, get_option_historicals and get_equity_quotes, completed official login, and explicitly accepted the broader official OAuth grant after the agent's consent click was rejected. CLI exit 0 and o_auth were verified; runtime tools and market-only calls subsequently succeeded. The prior local proxy error 10050 is historical, not a current loading blocker. Do not repeat login, restart or consent. Stop before any new-account or paid step. Account/order tool calls and brokerage transactions remain unauthorized. The client filter does not narrow server permissions or enforce GLD/IBIT arguments. See [host setup](docs/OPTIONS_ROBINHOOD_CONNECTION_SETUP.md) and the [latest capture delivery](docs/OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md).

The capture, observation and collection CLIs read local exports and cannot authenticate their source or invoke MCP. They preserve source/request/receipt/recording clocks, exclude interpolation, reuse unchanged budgets with unknown costs, and never authorize replay. Captures, study plans and linked frames are immutable local artifacts; candidate data-quality lessons are not trade outcomes or approved knowledge. Never relabel Robinhood data as Cboe, invent historical fills, or rewrite accepted captures/journals. The explicit collection request authorizes only the two fixed quote calls in docs/OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md and its shared-heartbeat phase changes. At or after window end restore the active docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V2.json before loading collection artifacts; never delete the shared news heartbeat or create a workaround cron. Preserve the original news snapshot and missed windows as gaps. Review eligible-session evidence before a separate paper adapter; no automatic orders are authorized.

On 2026-09-06, the Owner deferred paid market data and directed continued local workflow preparation. The earlier capped purchase question is resolved; continue the authorized local work without another procurement request.

For the current GLD/IBIT work, the Owner explicitly authorized development, saving, commits and pushes without further confirmation. This recorded authorization satisfies the Git workflow above; it does not authorize brokerage transactions.

The latest Owner instruction requests continuous work without individual step reports. Continue independent authorized work and retain detailed evidence in delivery documents; surface only material blockers or information the Owner must supply.

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
