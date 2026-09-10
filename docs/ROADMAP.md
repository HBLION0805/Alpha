# Alpha Roadmap

Current priority order is governed by [the product workflow and daily review](OPTIONS_DAILY_DEVELOPMENT_REVIEW.md):
repair existing data/processing failures, demonstrate an actual-quote paper
lifecycle, complete trend/event-to-contract recommendations with matching frontend,
then improve position tracking and independently evaluate outcomes. Read the
[dated alignment baseline](status/development-alignment-baseline-20260909.json).
The current engineering count is 4 LOCAL_VALIDATED / 4 PARTIAL / 2 NOT_VALIDATED;
older counts and next-step descriptions below are dated history, not current
acceptance. Daily 08:00/21:00 planning/review is enabled as two Owner-approved
standalone tasks; it does not restart automatic coding.

The [snapshot paper adapter](OPTIONS_SNAPSHOT_PAPER_DELIVERY.md) is now locally
implemented with frozen plans, copied-source recovery and candidate reviews.
Workstream 08 advances to PARTIAL; qualified quote and complete real-price evidence
remain missing. The three real-price gates stay open. Earlier adapter-unimplemented
and old independent-loss-cap descriptions below are historical.

[Candidate checks](OPTIONS_CANDIDATE_CHECKS_DELIVERY.md) now make the quote,
cost, allocation and independent loss requirements inspectable and saveable.
This prepares review before the source-specific paper adapter. It does not
advance the three open real-price gates or relax risk to admit a contract.
Next resolve the remaining source/session/cost qualification and use the frozen
event windows as observations arrive; no future return is available yet.

[Option candle evidence](OPTIONS_BAR_QUALITY_DELIVERY.md) now exposes source
provenance and gaps in Event research. The actual 240-bar intraday sample has
unknown interpolation flags. Next qualify those semantics and ETF candle/volume
coverage before enabling technical signals; keep the three real-price gates open.

[Event phase research](OPTIONS_EVENT_RESEARCH_DELIVERY.md) now links prospective
PRE/POST windows, identical tracked contracts, shared risk and candidate process
notes to an eighth page. Next assess the frozen September 9/10 PPI observations
with actual source/receipt clocks; retain unavailable windows and budget blocks.
The two initial call-anticipation hypotheses are unvalidated, not recommended
entries. Dense noninterpolated bars, executable option evidence, full costs and
independent out-of-sample outcomes remain needed. The fixed ten-workstream
comparison remains 4 locally validated / 3 partial / 3 not validated; the six
real-price gates remain 3 available / 3 open.

[Focused gold/Bitcoin news](OPTIONS_FOCUSED_NEWS_DELIVERY.md) extends the nine-feed
headline view with direct/indirect relevance and daily Host web review. It does
not complete numerical ETF-flow, oil, dollar, funding or liquidation connectors,
continuous breaking-news coverage, or any strategy validation gate.

Daily guidance is now implemented alongside its frontend and hourly public
context service. See [delivery](OPTIONS_DAILY_GUIDANCE_DELIVERY.md). Current
recommendations can remain WATCH; broader quantitative coverage, prospective
validation and qualified real-price paper gates remain open. Follow the
[new ongoing runbook](OPTIONS_DAILY_GUIDANCE_RUNBOOK.md) while retaining the
bounded close study. This does not change the fixed ten-workstream counts.

The [six-page frontend phase](OPTIONS_WORKBENCH_DELIVERY.md) is locally complete:
overview, option activity, risk planning, reported trade entry, reviews/notebook
and saved news/calendar. It uses the existing engines and records; its acceptance
is separate from market readiness. The overall baseline remains 4 local validated,
3 partial and 3 not validated. Qualified option evidence, the Robinhood paper
adapter and the first qualified end-to-end run remain open. Next inspect the
authorized close evidence and any genuine reported fills, without inventing
missing quotes, outcomes or a strategy win rate.

The [reported-fill ledger and review desk](OPTIONS_MANUAL_LEDGER_DELIVERY.md)
now support exact manual entry/exit reconciliation, partial closes, correction
history and plan-review candidates before future market data arrives. The owner
ledger starts empty. This advances workstream 07 locally and extends workstream
06; it does not validate live account integration, a signal or a real-price paper
gate. Next use genuine owner-reported fills when supplied and inspect the scheduled
close evidence against the already frozen activity study.

The [frozen activity study](OPTIONS_ACTIVITY_STUDY_DELIVERY.md) now links baseline
selection, distinct nearby controls, daily close evidence, assumed-cost reference
outcomes and candidate lessons. Its 224 cases are registered before future data;
no actual outcome is yet available. Workstream 10 gains bounded local research
infrastructure but remains NOT_VALIDATED for signal evaluation/calibration.
Next inspect the first close and fixed primary comparison; independent future
validation and the three real-price paper gates remain open.

The [full-chain activity and account board](OPTIONS_CHAIN_REVIEW_DELIVERY.md) now
connects the saved diagnostics below to an immutable English operator surface.
All 2,100 GLD/IBIT baseline contracts and 224 descriptive activity candidates are
retained; source quote dates are September 4. The Owner authorized
[seven daily close captures through September 16](OPTIONS_CHAIN_CLOSE_RUNBOOK.md),
now configured in the existing market-only task alongside daily 09:00 context.
Next inspect the first actual close receipt, same-day expired-contract coverage
and recorded-counter comparison. No real-price paper gate advanced.

The [paper account/portfolio bridge](OPTIONS_PAPER_PORTFOLIO_DELIVERY.md) now derives
aggregate diagnostics from the original modeled journal, checks unrecorded
candidates through both original engines and verifies exclusive snapshots.
Workstream 07 advances locally while real account qualification remains partial.
These diagnostics now appear in the local operator review surface,
preserving their saved evidence and explicit unknowns. Actual qualified option
quotes still gate the source-specific adapter and first real-price paper flow.

The Owner [cancelled the opening pilot](OPTIONS_OPENING_COLLECTION_CANCELLATION.md).
The newer close authorization adds only bounded market collection; development
continues in conversation and the opening pilot remains cancelled.
ETF opening-price screenshots can provide context without proving option fills.
The [hypothetical snapshot model](OPTIONS_ROBINHOOD_SNAPSHOT_MODEL_DELIVERY.md) and
all original plans remain historical design/evidence. Counts stay 4 local,
3 partial and 3 unvalidated; no actual-price gate advanced.

The [public source-use review](OPTIONS_ROBINHOOD_SOURCE_USE_REVIEW.md) adds dated
customer/US options agreement evidence while retaining unresolved retention and
clock semantics. Next define hypothetical snapshot fill assumptions without
asserting source qualification. Counts and actual-price gates remain unchanged.

The [Robinhood paper qualification design](OPTIONS_ROBINHOOD_PAPER_QUALIFICATION_DELIVERY.md)
now maps source fields and evidence requirements before a separate adapter.
No implementation or real-price gate advanced; actual eligible quotes and
unresolved source-use/contract/cost evidence remain dependencies.

Selected observation evidence can now be packaged with both prerequisites and
independently recovered without active source stores. See [delivery](OPTIONS_RESEARCH_EVIDENCE_PACKAGE_DELIVERY.md).
No workstream or real-price gate count changes from this operational extension.

Use the [ten-workstream baseline](OPTIONS_DEVELOPMENT_PROGRESS.md) for progress
against total scope and the six first-real-price-paper-flow gates. Observation
storage and three-pair recovery now close local workstream 04. This leaves three
real-price gates open; test counts and module counts are not completion percentages.

The [research observation inspector](OPTIONS_RESEARCH_OBSERVATION_INSPECTION_DELIVERY.md)
now independently resolves declared protocol/context references with actual local
chronology and unchanged original context reports. Observation persistence and
three-pair recovery are next; inspection creates no sample, outcome or trade.

The [research observation design](OPTIONS_RESEARCH_OBSERVATION_DESIGN_DELIVERY.md)
has been reviewed against the two existing storage verifiers. Implementation is
next: read-only reference resolution, then exclusive observation storage and
three-pair recovery. This design creates no records or qualified sample inputs.

The [protocol registration workflow](OPTIONS_RESEARCH_PROTOCOL_REGISTRATION_DELIVERY.md)
now preserves actual post-write registration clocks and independently recovers
the complete declaration. A synthetic isolated rehearsal passed; formal dataset
selection and new decision binding remain open. No active research protocol or
trade was created by the rehearsal.

The [research protocol declaration assessment](OPTIONS_RESEARCH_PROTOCOL_DECLARATION_DELIVERY.md)
now preserves complete definitions and declared chronology while retaining zero
samples and empty-partition blockers. Actual registration storage and subsequent
decision references remain next; no protocol has been registered by this unit.

The [context capture workflow](OPTIONS_CONTEXT_CAPTURE_DELIVERY.md) now saves
and independently recovers five-source payload/receipt pairs. Its first actual
local capture retains 174 source members and a post-payload-write save clock.
Prospective research decision/protocol binding is next; complete predictive
features and qualified real-price paper execution remain separate gaps. The
[member engine](OPTIONS_CONTEXT_MANIFEST_ENGINE_DELIVERY.md) and original
[design](specifications/OPTIONS_CONTEXT_MANIFEST_V1.md) retain their dated evidence.

[Shared continuation](OPTIONS_WORK_CONTINUATION_DELIVERY.md) carries authorized
development between reports while yielding to the pending opening observation.
Actual next-wake execution remains distinct from saved scheduler configuration.

[Sample validation infrastructure](OPTIONS_SAMPLE_VALIDATION_DELIVERY.md) audits
declared time partitions and inventories existing journals. Actual inventory:
15 cases, nine closed reviews, zero complete partition inputs. Feature manifests,
prospective protocol enforcement and an actual sealed evaluation remain open.

[Declared structure comparison](OPTIONS_STRUCTURE_COMPARISON_DELIVERY.md) now
covers eight shapes with exact terminal economics and cost/quote diagnostics.
This is not account-eligible selection, pre-expiry pricing or a multi-leg
lifecycle. Sample partitioning and independent outcome-validation infrastructure
remain useful local work while actual quote qualification is pending.

## September 7, 2026 portfolio diagnostics checkpoint

Completed a separate declared-scenario portfolio module: receipt-time settlement,
pending cash, aggregate GLD/IBIT exposure, daily loss/drawdown and event coverage.
It is a local diagnostic, not full broker-account enforcement. Existing accepted
paper/research ledgers remain unchanged. See [delivery](OPTIONS_PORTFOLIO_RISK_DELIVERY.md).
Independent next work can compare bounded option structures and their cost/risk
tradeoffs; actual-data qualification, a Robinhood paper adapter, account evidence
and out-of-sample calibration remain unfinished. The frozen opening pilot is
still September 8, 09:30-09:50 New York; automatic orders remain disabled.

The [local operations completion batch](OPTIONS_LOCAL_COMPLETION_DELIVERY.md)
delivers the offline dashboard, all-disposition outcome audit and BLS/FOMC
evidence export/recovery v2. These are local operational capabilities. Real
price replay, numerical connectors without sources, qualified signals,
portfolio/account qualification and independent calibration remain open.

[Context cutoff v2](OPTIONS_CONTEXT_CUTOFF_V2_DELIVERY.md) now includes FOMC
receipt history through an opt-in command. Original v1 remains reproducible.
Binding this context to an actual prospective trade plan and qualified quote
path remains subsequent work; reconstruction alone does not prove a decision.

The [FOMC date calendar](OPTIONS_FOMC_CALENDAR_DELIVERY.md) retains listed
current/next-year meetings and actual retrieval history. Daily v5 context now
[integrates this source](OPTIONS_FOMC_DAILY_CONTEXT_DELIVERY.md); existing
readiness/brief/cutoff/export versions do not include it. Date-only listings
cannot be treated as precise trading risk windows.

The [synthetic full-window rehearsal](OPTIONS_COLLECTION_REHEARSAL_DELIVERY.md)
now joins Host control flow to persistent local collection and final reports.
Healthy, mixed-failure and slow-response outcomes are retained independently.
Actual host scheduling and the first in-market quotes remain unverified by this
offline exercise; it does not unlock a real-price trade replay.

The [context cutoff consumer](OPTIONS_CONTEXT_CUTOFF_DELIVERY.md) can now rebuild
local background observations at an explicit historical receipt/discovery cutoff.
It excludes later records without changing source engines or qualifying a trade
replay. Connecting this evidence to prospective trade plans remains separate work.

The [local operator brief](OPTIONS_OPERATOR_BRIEF_DELIVERY.md) now presents the
opening test, review coverage and source context in one readable report. It
composes existing readiness and independent BLS recovery without changing either
version or making a trading decision. Actual opening data remains pending.

The official BLS scheduled-release calendar is now a standalone public context
source with exact Eastern/UTC times, actual receipt history and explicit
schedule-change semantics. The daily v4 workflow integrates it; non-BLS and
unscheduled events remain gaps. See [integration](OPTIONS_BLS_DAILY_CONTEXT_DELIVERY.md).

Immutable local evidence packages now preserve a selected study and fixed
trade/research/context journals. Independent byte verification and explicit
missing-component coverage support retention; off-device backup and automatic
restore remain outside this version. See [delivery](OPTIONS_EVIDENCE_EXPORT_DELIVERY.md).
An isolated [recovery rehearsal](OPTIONS_EVIDENCE_REHEARSAL_DELIVERY.md) now
verifies existing readers can reconstruct the actual package and its trade reviews.

Public single-venue BTC-USD book context is independently connected for IBIT.
Source nanoseconds, exact prices/sizes and actual retrieval clocks are preserved;
auction, missing, crossed and stale data remain explicit. Daily scheduling and
readiness v2 now include BTC; the frozen option study remains unchanged.
See [integration](OPTIONS_BTC_CONTEXT_INTEGRATION_DELIVERY.md).

The unified [operational readiness report](OPTIONS_OPERATIONAL_READINESS_DELIVERY.md)
now joins seven recoverable local components, review coverage and candidate notebooks
without source refreshes or new simulated trades. It separates pending market
collection from source/storage failures and lists the remaining test dependencies.

Treasury daily real-yield context is connected as the first numerical driver
source. Five tenors retain exact source/retrieval clocks and revisions in a
separate journal; daily context monitoring uses a versioned baseline while
preserving the original news snapshot. See [delivery](OPTIONS_TREASURY_REAL_YIELDS_DELIVERY.md)
and [status](status/treasury-real-yields.json). Other numerical driver families
remain incomplete; no trading signal or win-rate claim follows from this source.

Current delivery arms automatic GLD/IBIT quote collection for the frozen September
8, 09:30-09:50 New York observation window. The existing news heartbeat shares
this window and restores its daily 09:00 context schedule afterward. The local
collector and host tick are tested; actual in-window collection is pending.
The deterministic final closeout now distinguishes missing request evidence,
source failures and unusable observations, preserving reports at actual clocks.
See [closeout delivery](OPTIONS_ROBINHOOD_CLOSEOUT_DELIVERY.md) and
[latest operational status](status/robinhood-closeout.json).

The preceding delivery added Robinhood capture assessment and immutable storage.
Host OAuth and all five market tools work. Four actual option quotes were stale
and over budget; 120 sampled historical bars were interpolated. There is no
qualified real-price replay. See [capture delivery](OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md)
and [latest operational status](status/robinhood-capture.json). The
[machine status](status/current.json) describes the preceding build; the
[host setup](OPTIONS_ROBINHOOD_CONNECTION_SETUP.md) supersedes its installation
and authentication facts only. See
[delivery evidence](OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md),
[previous preparation](OPTIONS_RESEARCH_PREPARATION_DELIVERY.md) and the
[broker reference](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

## Implemented

- Deterministic collection closeout with completed-slot and per-contract coverage,
  explicit source/missing-data diagnostics, candidate operational lessons and
  immutable reports bound to original input prefixes and recording clocks.
- Window/cadence-checked quote collection, immutable successful replies and
  sanitized failed attempts, restart recovery and a verified host schedule.
  One frozen diagnostic window only; no source-specific replay or orders.
- Bounded whole-contract sample screening, immutable prospective plans, exact
  quote request templates, linked frame recording and restart-verified candidate
  data-quality review. Old quotes, missing responses and repeated polls cannot
  become a qualified path. No trade or probability is inferred.
- Network-free Robinhood capture parsing, scope/identity/clock checks, interpolation
  diagnostics, unchanged-budget lower bounds, immutable recovery and four candidate
  data-quality lessons. Seven real market-only calls are recorded separately from
  synthetic tests. No execution adapter or trade review is fabricated.
- Separate data-readiness report and local catalog assessment with five fixed
  candidates, schema fingerprints, unknown hints and pagination blockers. The
  anonymous fixed-endpoint probe cannot invoke tools or establish data readiness.
  Its checked-in example remains disabled; the authorized host copy is enabled
  and OAuth-authenticated. Runtime loading is verified; existing journals remain unchanged.
- Manifest/child/metadata/plan preparation with chronology checks and optional
  immutable records. A linked result certifies only coherent declared inputs;
  no market import, replay, account access or trade follows automatically.
- A standalone fee estimate for a single supported September 4, 2026 GLD/IBIT
  execution, with explicit components and rounding. Accepted engine outputs,
  frozen fee assumptions and existing journals remain unchanged.
- A separate counterfactual sampled-replay engine with declared contract/session/
  cost assumptions, later-snapshot assumed fills, isolated USD 1,000 runs,
  unresolved positions and reviews for all outcomes. Actual-time candidate lessons
  remain unapproved; old paper and market-qualification fingerprints are unchanged.
- Bounded extraction of one session and up to four selected contracts with parent/
  child hashes, row counts and a selection manifest. No silent file truncation.
- Documented Cboe DataShop CSV import, source/ingestion history and deterministic
  path-quality reports. Robinhood responses have their own capture identity;
  no Cboe file or qualified historical bid/ask path has been supplied.
- Contract/quote qualification, frozen plans, simulated round trips, persistent
  cash/position recovery and per-trade candidate mistake checks. Local synthetic
  or unverified inputs; intraday plans, one position and 14-45 DTE contracts.
- Six official public headline feeds, local version history, freshness and
  source-health reporting; 16 driver families and 94 cataloged indicators.
- Offline R-based economics, cost/tick checks and conservative risk ceilings.
- Options fixture news/context and reusable canonical/calendar/research/audit
  foundations; unrelated product implementations removed by dependency review.

## Ordered completion work

1. Continue local workflow preparation under the Owner's decision to defer paid
   market data. Use the new readiness report and offline catalog inspection to
   preserve the dated public review separately from captured evidence. Host login,
   five-tool loading and the first bounded response review are complete. Next
   collect fresh prospective quotes during the frozen eligible-session window;
   screening and the local observation workflow are implemented. The first bounded
   collector is armed; assess its actual coverage and gaps before extending it.
   Stop before new-account or paid steps. See
   [host setup](OPTIONS_ROBINHOOD_CONNECTION_SETUP.md). Assess
   authorized read-only Robinhood Trading MCP capabilities and actual response semantics,
   or obtain an entitled local GLD/IBIT quote file. Official MCP documents now
   include option historical OHLC, live quotes and instruments. Runtime schemas
   show quote sides and sizes, but historical bid/ask paths, independent side/size
   event clocks, aligned underlying data and retention terms remain unverified.
   Do not assume paid Cboe data is the only route or substitute OHLC for quotes.
   A client tool filter does not restrict server scope or enforce GLD/IBIT. Design
   a separate source adapter if compatible data is established; never relabel a
   Robinhood response as Cboe evidence or backdate prospective captures.
   Official samples inspected so far contain no GLD/IBIT observations. For a
   supplied file, extract a documented subset, prepare the linked inputs, inspect
   source/contract/session/cost evidence and test affordability before the
   counterfactual run. Unknown sizes still block fills. Separately qualify
   historical availability and execution models; assumptions do not establish fills.
2. Additional quantitative macro and asset-specific connectors with point-in-time vintages,
   release calendars, consensus-surprise inputs where licensed, ETF share/flow
   distinction, COT lags, gold reserves and crypto/on-chain provenance.
3. Complete account/portfolio/event/drawdown/expiry risk and account-eligible
   structure comparison, with no-trade outcomes when one contract cannot fit.
4. Replace manual synthetic thesis inputs with qualified signals and evaluate
   net-cost target-before-stop/time-exit outcomes using independent market data.
5. Walk-forward testing, independent holdouts, calibration, uncertainty and drift
   checks. More headlines cannot substitute for evidence of a trading edge.
6. Expanded operational source monitoring beyond the delivered offline Options
   Dashboard. The shared
   news/collection heartbeat requires the local host/app. Its original news
   schedule is daily 09:00 New York; older hourly descriptions were inaccurate.

No fixed success probability or year-end balance is promised. 10% allocation
escalation and brokerage execution remain closed. Macro/broad-market references
remain contextual inputs; the trading universe stays GLD/IBIT.

Historical Daily Scan, Alpaca and Event Contract plans remain in Git/design
records. They are not pending product work and must not be resumed implicitly.
