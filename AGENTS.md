# Alpha Development Standard v1.0

## Latest Owner direction — September 8, 2026

The Owner requests daily source refresh and explicit GLD/IBIT advisory views,
with module/frontend developed together, and no development reports. Use
`docs/OPTIONS_DAILY_GUIDANCE_RUNBOOK.md` and its Host snapshot for the new
workflow; check `docs/status/daily-guidance.json` for actual activation evidence.
Public headlines/BTC refresh hourly in the running local workbench; Treasury/BLS/
FOMC retain daily coverage. Only the existing authorized Host reads brokerage
market data. It is not a persistent account connection. No account or order tools,
transactions, paid data, login/consent or quota resets are authorized.
Retain all seven legacy close captures. On the final close restore immutable v6
first, install the new ongoing fields second, then inspect final evidence. Do not
resume cancelled opening/development jobs. Old continuation/report paragraphs
below are historical where they conflict with this newer direction. Candidate
plans remain conditional and may be WATCH; never force a daily trade or fabricate
probability, stops as guaranteed fills, missing data, realized outcomes or lessons.

The Owner's later screenshot request adds focused gold/Bitcoin monitoring:
three supplemental hourly feeds (Fed speeches, EIA energy, CoinDesk), direct and
indirect macro filtering, and bounded daily WGC/issuer/macro Host web review.
See docs/OPTIONS_FOCUSED_NEWS_DELIVERY.md and docs/status/focused-news.json.
Original six-feed journals and all Host schedule/restore fields remain unchanged.
Do not treat screenshot claims or another ChatGPT task as verified source data.

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

- Option candle evidence: pure grid/provenance checks and a read-only adapter
  over unchanged original Robinhood capture artifacts. Event research displays
  gray unknown source OHLC and missing/interpolated gaps with exact tables and
  clocks. The September 8 intraday check returned 240 bars with omitted flags;
  UNKNOWN must not default to noninterpolated. Retrospective history cannot enter
  frozen prospective endpoints or enable technical signals, VWAP, stops, replay
  or probability. No new schedule, source, account or order route. See
  docs/OPTIONS_BAR_QUALITY_DELIVERY.md and docs/status/bar-quality.json.

- Prospective event phase research: immutable GLD/IBIT plans and copied-input
  snapshots compare PRE_ONLY, POST_ONLY and COMBINED using first eligible saved
  quotes, shared event losses and non-recycled sale proceeds. The eighth English
  page and review notebook show windows, blockers, gaps and candidate process
  lessons. Two PPI hypotheses await September 9/10 observations; no future
  outcomes, candle confirmation, stop fills, qualified replay or probability.
  The existing Host rechecks at most six active frozen identities inside its
  unchanged 24-call / 36-quote bounds. No schedule fields, orders, account tools,
  old journals or real-price gate statuses change. See
  docs/OPTIONS_EVENT_RESEARCH_DELIVERY.md and docs/status/event-research.json.

- Local options workbench frontend: six responsive English pages over original local readers and engines, bounded 127.0.0.1 service, exact manual forms with preview/idempotent save/corrections, original event drilldown, candidate notebooks and saved source clocks. Use `npm run options:workbench` or `Start Alpha.cmd`. Owner ledger remains empty; frontend mutation QA is isolated and synthetic. No source refresh, brokerage access, automatic order, new dependency or schedule change. Six UI acceptances do not advance the three open real-price gates. See docs/OPTIONS_WORKBENCH_DELIVERY.md, docs/OPTIONS_WORKBENCH_GUIDE.md and docs/status/workbench.json. This latest frontend direction is conversation-only; older automatic-development activation records below remain historical.

- Owner-reported fill ledger and review desk: separate standard long GLD/IBIT
  accounting with exact FIFO partial closes, unknown fees, durable plan timing,
  append-only corrections and candidate review notes. Owner ledger
  `owner-manual-gld-ibit` starts empty; synthetic examples never become owner
  fills. Saved desk `owner-review-20260907` independently recovers copied manual,
  activity and original paper-account evidence without changing old journals,
  host fields or trading authority. No source authentication, live balance,
  stop-path inference, tax/settlement accounting, calibrated probability or orders.
  See docs/OPTIONS_MANUAL_LEDGER_DELIVERY.md and docs/status/manual-ledger.json.

- Current activity follow-up: the Owner approved research of flagged GLD/IBIT
  contracts as possible future evidence, conditional on validation. Frozen study
  `fomc-activity-20260908` has 224 candidates, 167 distinct controls and 57 unmatched
  cases, with zero future outcomes at registration. Primary references are the
  September 8 and 9 closes; secondary horizons through September 16 and September
  18 expiry comparison remain separate. Offline close-runbook step 7 saves
  assumed-cost reference outcomes and candidate lessons after required v6
  restoration; host schedule/fields and source calls are unchanged. Never infer
  fills, institutions, a validated edge or sizing authority. Existing paper
  engines/journals remain unchanged. See docs/OPTIONS_ACTIVITY_STUDY_DELIVERY.md
  and docs/status/activity-study.json. Current close workflow supersedes the
  historical opening/automatic-development activation descriptions below.

- Latest Owner authorization (September 7, 2026): daily after-close GLD/IBIT full-chain records for September 8–16 at 16:20 New York, September 18 expiry comparison, preserving daily 09:00 context in the existing gld-ibit heartbeat. Use docs/OPTIONS_CHAIN_CLOSE_HOST_V1.json and docs/OPTIONS_CHAIN_CLOSE_RUNBOOK.md; actual eight-field activation evidence is docs/status/chain-close-activation.json. This supersedes all older active quote/development phase descriptions below. Opening collection remains cancelled, development remains conversation-only, and quarter-hour automatic development reports remain disabled. Restore exact immutable v6 after the final September 16 capture attempt or before any work on a later wake; never delete the daily context task. No actual scheduled close capture exists yet.
- Full-chain activity review and local operator board: immutable full source, all-contract and flagged-contract reports, declared volume/OI/peer screening, actual/source clocks, current-day expired lookup, verified saved-board comparisons and original paper-account diagnostics. Baseline: 2,100 contracts/quotes, 224 descriptive candidates, all option refresh dates September 4. No historical volume baseline, verified causes, source-specific replay adapter, calibrated probability, account access or orders. See docs/OPTIONS_CHAIN_REVIEW_DELIVERY.md. The new daily full-chain market authorization expands the old four-contract pilot request scope only; the cancelled pilot's artifacts stay immutable.

- Opening quote pilot cancelled: the latest Owner request cancels September 8 09:30-09:50 New York automatic quote collection. The existing gld-ibit ID now uses only the exact restoreFields in docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V6.json for daily 09:00 context. This overrides all older opening-window and phase-switch instructions below. Do not reinstall armed, collection or development fields, or run a closeout for the cancelled pilot. Keep original plans, runbook and manifests immutable historical evidence. Development continues in this conversation; no automatic development or quarter-hour reports. See docs/OPTIONS_OPENING_COLLECTION_CANCELLATION.md and docs/status/opening-collection-cancellation.json.

- Paper account and portfolio integration: original paper repository recovery projects all latest modeled states into the unchanged portfolio engine; an unrecorded initial-quote candidate also passes original paper/mistake guards. Fee buckets reconcile explicitly, conservative settled cash applies, stale marks retain exposure and passing time never settles proceeds or cancels orders. Exclusive snapshots recompute without journal appends. Real account enforcement and the source adapter remain unsupported. See docs/OPTIONS_PAPER_PORTFOLIO_DELIVERY.md and docs/status/paper-portfolio.json.

- Options sample validation: chronological declared windows, whole information intervals and cross-partition date/episode/evidence/observation reuse checks retain all cases. Existing-journal inventory recomputes originals and preserves unknown feature/outcome-knowledge clocks. Actual inventory has 15 cases, nine closed reviews and zero complete partition inputs. No sealed holdout, independence claim, model, probability or orders. See docs/OPTIONS_SAMPLE_VALIDATION_DELIVERY.md and docs/status/sample-validation.json.

- Declared structure comparisons: eight GLD/IBIT long-option, vertical and purchased-volatility shapes use existing contract/quote validation, explicit costs, exact terminal extrema/rational roots and independent saved/recomputed artifacts. Credit is not free risk capital. Single-leg feasibility is composed unchanged; multi-leg stops, pre-expiry pricing, account/portfolio integration and execution remain unsupported. No ranking, probability or order. See docs/OPTIONS_STRUCTURE_COMPARISON_DELIVERY.md and docs/status/structure-comparison.json.

- Declared portfolio risk diagnostics: independent $1,000 cash scenarios aggregate GLD/IBIT holdings, pending reservations, receipt-time settlements, daily loss/drawdown and manual event coverage; unknown marks preserve exposure. Reached stops/targets flag unconfirmed exits. Exclusive local reports recompute without touching old journals. No live account enforcement, auto-settlement, trade or size authority. See docs/OPTIONS_PORTFOLIO_RISK_DELIVERY.md and docs/status/portfolio-risk.json.

- Local outcome audit, offline dashboard and calendar-inclusive evidence export/recovery v2: original paper/research engines recompute descriptive all-case metrics and candidate evidence; immutable HTML/JSON reads saved stores without source refresh. Export v2 opts into BLS/FOMC journals and isolated calendar recovery while preserving default v1. No calibration, compounded research account, host inspection or orders. See docs/OPTIONS_LOCAL_COMPLETION_DELIVERY.md and docs/status/local-completion.json.
- Journal context cutoff: v1 preserves four-source receipt/discovery-time reconstruction; opt-in v2 adds FOMC dates through the existing calendar engine, without hindsight or historical-decision claims. Use --at for v1 and --at-v2 for v2. See docs/OPTIONS_CONTEXT_CUTOFF_DELIVERY.md and docs/OPTIONS_CONTEXT_CUTOFF_V2_DELIVERY.md. Other readiness/export versions are unchanged.
- Complete synthetic collection-window rehearsals: isolated Host control flow through real local repositories, normal/mixed/slow scenarios, preserved reviews and candidate data-quality lessons. No real host scheduler or market test. See docs/OPTIONS_COLLECTION_REHEARSAL_DELIVERY.md.
- Official FOMC date-calendar context: restricted current/next-year HTML panels, date-only precision, unknown intraday/confirmation metadata, actual receipt journal and daily v5 integration. No calendar-to-trade rule. See docs/OPTIONS_FOMC_DAILY_CONTEXT_DELIVERY.md.
- Readable local operator brief: exact readiness-v2 projection plus independent BLS calendar recovery, selected-window status, source clocks, paper/research reviews and candidate notebooks. No new trade or source request. See docs/OPTIONS_OPERATOR_BRIEF_DELIVERY.md and docs/status/operator-brief.json.
- Local evidence export and isolated recovery rehearsal: immutable selected-study/journal byte packages and existing repository readers in a fresh temporary workspace. The saved pre-window package excludes the later BLS journal. No active restore or off-device backup. See docs/OPTIONS_EVIDENCE_REHEARSAL_DELIVERY.md.
- Unified local operational readiness: v2 recovers seven components including BTC; original six-component v1 remains reproducible. It preserves selected-study coverage, closed-trade and research review checks, separate candidate notebooks and explicit real-price test dependencies. No HTTP, source refresh, journal append, scheduler operation or brokerage inspection. BLS is a separate operator-brief consumer, not silently added to readiness v2. See docs/OPTIONS_BTC_CONTEXT_INTEGRATION_DELIVERY.md.
- Treasury daily real-yield context: five tenors, bounded anonymous current-month XML GET, exact source/actual retrieval clocks, fixed failure codes, separate checksum-linked journal and correction-preserving restart recovery. The active shared daily baseline is v6; v1/v2/v3/v4/v5 snapshots and the frozen opening quote study remain immutable. See docs/OPTIONS_TREASURY_REAL_YIELDS_DELIVERY.md. No automatic orders or strategy signal.
- Public BTC spot context: one Coinbase Exchange BTC-USD level 1 source for IBIT, exact decimal/nanosecond semantics, explicit stale/auction/missing states and a separate journal. Daily snapshot cadence is not continuous coverage or an IBIT conversion. See docs/OPTIONS_BTC_CONTEXT_INTEGRATION_DELIVERY.md.
- Official BLS scheduled-release calendar: bounded public ICS, explicit Eastern/UTC event times, unknown original publication clocks and consecutive-snapshot changes. Missing UIDs are not cancellations. Integrated into daily v5 context; no released values or calibrated event-impact signal. See docs/OPTIONS_BLS_DAILY_CONTEXT_DELIVERY.md and docs/status/bls-daily-context.json.
- Robinhood collection closeout: deterministic completed-slot coverage, source-failure and missing-request diagnostics, per-contract usable data, candidate operational lessons and immutable prefix-bound reports. The final scheduled step uses options:robinhood-closeout -- --save only after restoring the active daily context fields. Existing engine outputs and all plans/quotes/journals remain unchanged. See docs/OPTIONS_ROBINHOOD_CLOSEOUT_DELIVERY.md and docs/status/robinhood-closeout.json for the dated closeout evidence.
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

The six fixed public headline feeds, Treasury daily real yields, Coinbase BTC-USD, BLS release-calendar and FOMC meeting-calendar endpoints have direct live read-only access. Separately, the authorized host Robinhood connection exposes five working market-data tools; Alpha's capture, observation and collection CLIs are offline. Other numerical driver connectors, fully qualified GLD/IBIT quote paths, complete portfolio enforcement, calibrated outcomes, account access and order execution are not implemented. Local persistence is single-process. The existing gld-ibit heartbeat shares the bounded quote window, then restores daily 09:00 New York news, Treasury, BTC, BLS and FOMC context using docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V6.json. All prior restoration snapshots remain immutable. See docs/HANDOFF.md and docs/status/fomc-daily-context.json for current operating evidence; current.json is a dated older build checkpoint. The headline transport now has a total deadline, strict UTF-8, fixed errors and hard-link checks; see docs/OPTIONS_HEADLINE_TRANSPORT_CORRECTION.md.

Historical research has its own versioned engine and journal. It retains original source clocks and actual import/run-recording clocks; plan and subset selection are retrospective declarations. Every fill is assumed, missing or zero sizes cannot be invented, and unresolved positions remain unresolved. Do not alter the original market-evidence NO_REPLAY gate or old paper/review fingerprints. Research lessons are candidates recorded in actual research time, not verified historical knowledge or authority to change a strategy. See docs/OPTIONS_HISTORICAL_REPLAY_DELIVERY.md for delivery evidence and remaining actual-data requirements.

Preparation links declarations and retains the actual preparation clock; it does not import data, authenticate the parent source, run a replay or grant authority. Preserve accepted preparation artifacts and existing journals. Dated fee estimates cannot silently update frozen plans. See [preparation delivery](docs/OPTIONS_RESEARCH_PREPARATION_DELIVERY.md) and [Robinhood research reference](docs/OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

Robinhood's official Trading MCP connection and five market tools now work. Actual option bid/ask prices, quantities, quote-refresh timestamps, Greeks and historical OHLC fields were inspected. All four sampled quotes were stale and over budget; all 120 sampled bars were interpolated. There is no qualified quote replay path or source-specific execution adapter. Independent side/size timing, underlying alignment, complete contract/calendar evidence and retention terms remain unverified.

The old data-readiness command and current.json remain dated pre-connection checkpoints, not live configuration discovery. The Owner authorized exactly get_option_chains, get_option_instruments, get_option_quotes, get_option_historicals and get_equity_quotes, completed official login, and explicitly accepted the broader official OAuth grant after the agent's consent click was rejected. CLI exit 0 and o_auth were verified; runtime tools and market-only calls subsequently succeeded. The prior local proxy error 10050 is historical, not a current loading blocker. Do not repeat login, restart or consent. Stop before any new-account or paid step. Account/order tool calls and brokerage transactions remain unauthorized. The client filter does not narrow server permissions or enforce GLD/IBIT arguments. See [host setup](docs/OPTIONS_ROBINHOOD_CONNECTION_SETUP.md) and the [latest capture delivery](docs/OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md).

The capture, observation and collection CLIs read local exports and cannot authenticate their source or invoke MCP. They preserve source/request/receipt/recording clocks, exclude interpolation, reuse unchanged budgets with unknown costs, and never authorize replay. Captures, study plans and linked frames are immutable local artifacts; candidate data-quality lessons are not trade outcomes or approved knowledge. Never relabel Robinhood data as Cboe, invent historical fills, or rewrite accepted captures/journals. The explicit collection request authorizes only the two fixed quote calls in docs/OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md and its shared-heartbeat phase changes. At or after window end restore the active docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V6.json before loading collection artifacts; never delete the shared news heartbeat or create a workaround cron. Preserve all prior snapshots and missed windows as gaps. Review eligible-session evidence before a separate paper adapter; no automatic orders are authorized.

Keeping the computer awake does not guarantee later Codex wakes when account allowance is exhausted. Do not redeem usage-reset credits or purchase capacity/data. The bounded direct app-server control assessment failed before initialization with Windows error 10050; this is distinct from the working host MCP tools and is not a reason to repeat completed OAuth. No alternative quota-independent collector has been verified or installed. See docs/OPTIONS_HOST_CONTROL_ASSESSMENT.md. Do not start another model task or resume this active task in a second server merely to force a direct-tool route.

On 2026-09-06, the Owner deferred paid market data and directed continued local workflow preparation. The earlier capped purchase question is resolved; continue the authorized local work without another procurement request.

For the current GLD/IBIT work, the Owner explicitly authorized development, saving, commits and pushes without further confirmation. This recorded authorization satisfies the Git workflow above; it does not authorize brokerage transactions.

Latest Owner direction on September 7, 2026: cancel the opening quote pilot and retain daily context only; development continues only in this conversation. This supersedes the prior restoration of opening collection, automatic continuation and every-15-minute progress-report requests. The exact v6 daily fields are active, not armed/collection phases or the V3 development wrapper. Notify only for meaningful market/source changes, new failures, recovery or required user action under the daily prompt. Do not resume quote scheduling, automatic development or periodic reporting without a new Owner request. When reporting development in conversation, retain the fixed ten-workstream comparison and six first-real-price-paper-flow gates from docs/OPTIONS_DEVELOPMENT_PROGRESS.md and docs/status/development-progress.json. Counts remain local acceptance, not a completion percentage or win rate. ETF opening-price screenshots are context, not option bid/ask/size evidence. Actual quote qualification still gates the source adapter; independently scoped local work can continue now. See docs/OPTIONS_OPENING_COLLECTION_CANCELLATION.md for the current operating state.

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
