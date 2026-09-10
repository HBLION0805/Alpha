# Alpha

Latest macro context: [official rates, dollar and inflation benchmarks](docs/OPTIONS_MACRO_CONTEXT_DELIVERY.md).
News & calendar now shows dated Treasury nominal yields, Fed broad USD/FX and
Cleveland Fed model estimates. Daily collection is after 17:00 New York while
Alpha runs. Broad USD is not DXY; model error is not market-consensus surprise.

Gold research: [factor cross-check and horizon priorities](docs/OPTIONS_GOLD_FRAMEWORK_DELIVERY.md).
News & calendar maps all 14 Owner framework areas and seven added checks to
existing coverage. Saved daily values, news leads and missing feeds stay distinct.

Current planning policy: [owner cancellation of legacy loss caps](docs/OPTIONS_OWNER_ALLOCATION_DELIVERY.md).
Daily guidance and Trade planner use $100–$500 per trade / $1,000 declared equity.
Legacy loss caps are removed; costs, stops and full-premium exposure remain visible.

Collector startup: [network access and actual source receipts](docs/OPTIONS_COLLECTOR_STARTUP_CORRECTION.md).
Local interface availability does not prove a successful public-data refresh;
News & calendar displays actual source health and receipt clocks.
The [September 8 recovery check](docs/OPTIONS_COLLECTOR_STARTUP_DELIVERY.md)
verified the next automatic hourly news/BTC read while retaining failed records.

Latest planner addition: [fees and exit-allowance comparisons](docs/OPTIONS_COST_DESK_DELIVERY.md).
Compare declared costs or an explicit dated rate assumption across four adverse
exit allowances. Original settings and independent risk caps remain unchanged.

Current allocation: [owner-declared $100–$500 per trade](docs/OPTIONS_TRADE_BUDGET_DELIVERY.md)
with $1,000 total capital. Independent planned-loss and stress caps remain;
budget membership alone does not qualify a trade.

Latest planning step: [candidate quote, cost and risk checks](docs/OPTIONS_CANDIDATE_CHECKS_DELIVERY.md).
Daily guidance now separates premium affordability from all-in allocation,
planned loss and full-premium stress, with inspectable blockers and independently
recoverable check snapshots. Passing local checks does not qualify paper fills.

Latest evidence check: [option candles and provenance](docs/OPTIONS_BAR_QUALITY_DELIVERY.md).
Event research now shows saved option OHLC, missing intervals and unknown
interpolation flags. Retrospective candles do not become prospective outcomes.

Latest research: [before/after event comparison](docs/OPTIONS_EVENT_RESEARCH_DELIVERY.md).
The eighth page freezes GLD/IBIT observation rules, follows the same contracts,
compares three separate reference scenarios with a shared event risk allowance,
and adds process notes to Reviews & lessons. Research plans are not trade advice.

Latest news expansion: [focused gold / Bitcoin monitoring](docs/OPTIONS_FOCUSED_NEWS_DELIVERY.md).
Nine fixed RSS feeds, relevant macro filtering and a daily attributed Host web
review now share the News & calendar page. Missing numerical coverage remains
explicit; other ChatGPT tasks are not synchronized.

Latest development: [daily guidance and public context refresh](docs/OPTIONS_DAILY_GUIDANCE_DELIVERY.md). The seventh page is the default landing view. Public headlines/BTC refresh hourly while Alpha runs; the existing Host provides scheduled market-only quote reads. See the [current runbook](docs/OPTIONS_DAILY_GUIDANCE_RUNBOOK.md). No automated orders or calibrated win-rate claim.

Latest local delivery: [six-page options workbench](docs/OPTIONS_WORKBENCH_DELIVERY.md).
Run `npm run options:workbench` and open **http://127.0.0.1:4173**, or double-click
`Start Alpha.cmd`. The [workbench guide](docs/OPTIONS_WORKBENCH_GUIDE.md) covers
filters, planning, reported fills, corrections, reviews and saved news/calendar.
It reads local evidence and records manual declarations; it cannot place orders.

Underlying systems include the [owner-reported fill ledger and consolidated review desk](docs/OPTIONS_MANUAL_LEDGER_DELIVERY.md),
alongside [frozen activity follow-up and matched-control reviews](docs/OPTIONS_ACTIVITY_STUDY_DELIVERY.md),
building on [GLD/IBIT full-chain activity and account review](docs/OPTIONS_CHAIN_REVIEW_DELIVERY.md),
with [daily close collection through September 16](docs/OPTIONS_CHAIN_CLOSE_RUNBOOK.md).
The cancelled opening pilot and automatic development remain disabled. No automatic orders.

A focused decision-support system for **GLD and IBIT options on Robinhood**.
Alpha combines attributable context, explicit uncertainty and deterministic
risk arithmetic. It promises no return and has no order-execution authority.

Start with the [dated operations index](docs/OPTIONS_CURRENT_OPERATIONS.md) for
the current daily context schedule, completed capabilities and remaining real-price
test dependencies. It links original evidence without changing historical clocks.

## Current capabilities

- **Reported-fill accounting and review:** manual GLD/IBIT long-option entries,
  partial exits, exact fees, append-only corrections and plan-deviation candidate
  notes. `npm run options:manual-ledger -- --verify owner-manual-gld-ibit` checks
  the initially empty owner ledger. [Recording guide](docs/OPTIONS_MANUAL_LEDGER_GUIDE.md).
  `options:review-desk` saves an independently recoverable English view of manual
  records, activity cases and separate original paper-account diagnostics.
- **Prospective activity follow-up:** 224 frozen candidates, 167 distinct controls
  and all 57 unmatched cases. `npm run options:activity-study -- --update fomc-activity-20260908`
  reads saved close boards, retains assumed-cost reference outcomes and candidate
  lessons, and verifies immutable reports. Zero future outcomes currently exist;
  this does not establish profitability or run paper trades.
  [Study and commands](docs/OPTIONS_ACTIVITY_STUDY_DELIVERY.md).

- **Daily market context:** the Owner cancelled the opening quote pilot. Daily
  09:00 New York context remains active. Development continues in this conversation;
  automatic development and quarter-hour reports are disabled.
  [Current daily-context and bounded close schedule](docs/OPTIONS_CHAIN_CLOSE_RUNBOOK.md).

- **Paper account and portfolio integration:** `npm run options:paper-portfolio -- --demo`
  reconstructs one modeled account, checks combined GLD/IBIT exposure and previews
  a candidate through existing risk and mistake guards. It reconciles fee buckets
  and saves independently recoverable snapshots without appending trades.
  [Delivery and journal usage](docs/OPTIONS_PAPER_PORTFOLIO_DELIVERY.md).

- **Sample partition and journal inventory:** chronological declared windows
  reject overlapping information and reused cross-group evidence. The inventory
  retains all existing cases and missing point-in-time sampling facts. Neither
  command seals a holdout or calculates a calibrated win rate.
  [Delivery](docs/OPTIONS_SAMPLE_VALIDATION_DELIVERY.md).

- **Declared structure comparisons:** `npm run options:structures -- --demo`
  compares eight single-leg, vertical and purchased-volatility structures on
  GLD/IBIT, with exact terminal payoffs, cost/friction diagnostics and unknown
  account eligibility. Saved comparisons recompute without ranking a trade or
  implementing multi-leg execution. [Delivery](docs/OPTIONS_STRUCTURE_COMPARISON_DELIVERY.md).

- **Declared portfolio risk diagnostics:** `npm run options:portfolio-risk -- --demo`
  combines GLD/IBIT holdings, pending reservations, settlement receipts, daily
  losses, drawdown and manual event coverage in one $1,000 cash scenario. Saved
  reports recompute in a fresh process. This is not live account enforcement.
  [Delivery](docs/OPTIONS_PORTFOLIO_RISK_DELIVERY.md),
  [specification](docs/specifications/OPTIONS_PORTFOLIO_RISK_V1.md).

- The [local completion batch](docs/OPTIONS_LOCAL_COMPLETION_DELIVERY.md) adds
  an offline operator dashboard, recomputed all-outcome audit and opt-in v2
  evidence packages including both BLS and FOMC journals. It preserves old
  reports, independent research accounts and candidate-only lessons. Run
  `npm run options:dashboard -- --build <study-id> <new-snapshot-id>` to read
  saved stores into a new local HTML/JSON snapshot; this does not refresh data.

The [first-opening handoff](docs/OPTIONS_FIRST_OPENING_HANDOFF.md) records the
latest local collection preflight, preserved reviews, active schedule and the
evidence still needed before a Robinhood real-price paper test.
The [loaded schema assessment](docs/OPTIONS_ROBINHOOD_SCHEMA_SEMANTICS.md) separates
documented contract quantities and refresh clocks from unverified fill/timing semantics.

- A separate local calendar brief combines BLS release times and FOMC date ranges
  with explicit missing metadata, source health and unknown intraday timing. It
  preserves existing report formats and gives no trade signal. See
  [delivery](docs/OPTIONS_CALENDAR_BRIEF_DELIVERY.md).

- A standalone Federal Reserve meeting calendar preserves date-only FOMC ranges,
  projection markers, actual receipts and explicit unknown confirmation/intraday
  timing. Its first official retrieval and restart recovery are verified, and
  daily v5 context includes it. See [integration](docs/OPTIONS_FOMC_DAILY_CONTEXT_DELIVERY.md).
- Complete synthetic collection-window rehearsals join the checked-in Host tick,
  local collector, persistent observation records and final coverage/lesson reports.
  Normal, mixed-failure and slow-response scenarios retain explicit simulated
  clocks and isolated evidence. See [delivery](docs/OPTIONS_COLLECTION_REHEARSAL_DELIVERY.md).
- Historical context can be reconstructed at an explicit UTC cutoff using only
  stored receipt/discovery clocks. Later observations are excluded, failures are
  preserved and each current history is validated first. This does not prove an
  actual historical decision or permit a replay. See [delivery](docs/OPTIONS_CONTEXT_CUTOFF_DELIVERY.md).
- Opt-in context reconstruction v2 adds FOMC date calendars to the same receipt
  cutoff, preserving the original four-source output and unknown release times.
  See [v2 delivery](docs/OPTIONS_CONTEXT_CUTOFF_V2_DELIVERY.md).
- One readable local test brief joins the selected collection window, source
  clocks, review coverage, candidate notebooks and upcoming BLS releases. It
  preserves readiness v2 and performs no source refresh or trade. See
  [delivery](docs/OPTIONS_OPERATOR_BRIEF_DELIVERY.md).
- Public BLS release schedules preserve Eastern/UTC event times, actual retrieval
  clocks and changed or missing event identities. One actual calendar and restart
  recovery are verified. The existing daily 09:00 context workflow includes this
  independent source; see [integration](docs/OPTIONS_BLS_DAILY_CONTEXT_DELIVERY.md).
- Local evidence exports preserve exact selected-study, review and context bytes
  with a verifiable manifest. Verification is independent of current source stores;
  this is a local copy, not an off-device backup. See [delivery](docs/OPTIONS_EVIDENCE_EXPORT_DELIVERY.md).
- Isolated recovery rehearsals reconstruct verified package data in a fresh
  temporary workspace and run the existing repository readers. The first actual
  rehearsal recovered all five closed-trade reviews. See [rehearsal](docs/OPTIONS_EVIDENCE_REHEARSAL_DELIVERY.md).
- Public BTC-USD context for IBIT: exact single-venue bid/ask and
  aggregate sizes, nanosecond source clocks, actual retrieval history and explicit
  stale/auction/missing-data checks. Daily collection and readiness v2 integrate
  this source. See [integration](docs/OPTIONS_BTC_CONTEXT_INTEGRATION_DELIVERY.md).
- One local readiness report joins actual recovery of the selected quote study,
  paper reviews, historical research, imported evidence, headlines, Treasury and BTC
  context. Missing/busy/corrupt stores stay separate; it lists the dependencies
  before a real-price test without inventing a readiness score or win probability.
  See [delivery](docs/OPTIONS_OPERATIONAL_READINESS_DELIVERY.md).
- Public Treasury daily real-yield context for GLD/IBIT: five tenors, exact
  basis-point values, separate source and retrieval clocks, correction history,
  bounded local recovery and explicit failed/empty states. This is one numerical
  source, not a calibrated signal. See [delivery](docs/OPTIONS_TREASURY_REAL_YIELDS_DELIVERY.md).
- Collection acceptance reports distinguish elapsed coverage, missing request
  evidence, source-call failures and unusable quotes. Reports and candidate
  operational lessons retain exact input hashes and original assessment clocks;
  diagnostic coverage never becomes a strategy win rate.
- Automatic Robinhood collection is armed for September 8, 2026, 09:30-09:50
  a.m. New York: GLD/IBIT equity quotes and four frozen option contracts, with a
  target sixty-second cadence. The existing news heartbeat temporarily shares
  this window, then restores daily 09:00 news, Treasury, BTC, BLS and FOMC calendar checks. Actual
  market collection is pending; the local computer and Codex app must be running.
- Robinhood budget screening and prospective observation records: bounded sample
  screening, immutable contract/window selection, linked quote frames, source-time
  and underlying alignment checks, restart verification and candidate data-quality
  lessons. Eight contracts were sampled; all quotes were stale. The first actual
  out-of-window frame is retained as failed evidence. No source-specific replay
  or automatic orders are enabled.
- Robinhood capture assessment: the authorized five-tool connection returned
  four real GLD/IBIT option quotes and 120 historical bars. The bounded local
  parser records stale prices, interpolation, linkage and budget blockers, with
  immutable capture recovery and candidate data-quality lessons. All four sampled
  quotes are stale and over budget; all sampled bars are interpolated. No replay.
- Robinhood data-access preparation: dated public capabilities, bounded local
  tool-catalog inspection, one anonymous endpoint check and a disabled example.
  This older preparation report does not discover the now-authenticated host;
  no qualified replay adapter or actual-price trade replay is established.
- Research input preparation links an extraction manifest, exact child bytes,
  source metadata and frozen plan, with optional immutable local records.
  INPUTS_LINKED_FOR_RESEARCH means coherent declarations, not validated trading inputs.
- A dated Robinhood fee reference estimates one ordinary GLD/IBIT option execution
  on September 4, 2026, preserving component rounding and sale-proceeds dependence.
  It does not automatically change existing replay fees.
- Independent historical interval research: frozen GLD/IBIT plans, explicit
  contract/session/cost assumptions, later-snapshot modeled fills, unresolved
  positions and a process review for every outcome. Runs use isolated USD 1,000
  accounts and remain counterfactual; no qualified historical bid/ask path is available.
- Bounded extraction of one session and up to four declared contracts from a
  larger local CSV, retaining source/child hashes, selection and row-count manifest.
- Source-labeled Cboe DataShop option CSV import, exact prices and Eastern-time
  normalization, missing-data checks and a separate integrity-checked history.
  The Owner has Robinhood; its responses stay in a separate source capture.
  Cboe file parsing does not establish real-price replay readiness.
- A complete local simulated trade lifecycle: GLD/IBIT contract/quote inputs,
  frozen plans, risk checks, cash reservations, modeled fills/exits and recovery.
- Every closed trade receives a review and candidate mistake checks for future
  entries. Synthetic or unverified imports only; no calibrated win rate.
- Intraday plans, 14-45 day expiries, one position and separate unsettled proceeds.
- Six official public headline feeds: Federal Reserve, BLS, BEA, ECB, OFAC and SEC.
- An extensible catalog of 16 driver families and 94 indicators, with mechanisms,
  primary sources, expected release cadence and coverage limitations.
- Bounded one-shot refresh, local version history, correction-preserving dedupe,
  timestamp checks, source health and candidate relevance tags.
- Offline options economics using 10%-25% premium-stop comparison, a 20% research
  default, net 1.5R-2R targets, integer contracts, costs and price-grid checks.
- Fixed 5% allocation ceiling, 0.5% equity planned cash-risk budget and the
  separately retained USD 25 full-premium stress cap. Conditional escalation is closed.
- Fixture-only options news verification and QQQ benchmark market context.
- Reusable canonical market data, calendar validation, Twelve Data integration
  foundations, historical evidence, journal, research, audit and AI cost controls.

The 20% stop is a research choice, not a validated optimal live rule. R includes
round-trip fees and exit slippage; it remains a planned loss, not a guaranteed
fill. A USD 25 premium with zero assumed costs, 20% stop and 2R has a USD 5 planned
loss and USD 10 net profit target. No passing diagnostic authorizes a trade.

The USD 1,000-to-USD 50,000 year-end aspiration is a scenario only and cannot
increase risk limits. Read [current delivery](docs/OPTIONS_ROBINHOOD_CLOSEOUT_DELIVERY.md),
the [opening-window correction](docs/OPTIONS_ROBINHOOD_OPENING_WINDOW.md),
the [observation delivery](docs/OPTIONS_ROBINHOOD_OBSERVATION_DELIVERY.md),
the [capture delivery](docs/OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md),
the [previous preparation delivery](docs/OPTIONS_RESEARCH_PREPARATION_DELIVERY.md),
the [dated broker reference](docs/OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md)
and the latest [collection status](docs/status/robinhood-closeout.json). The older
[build status](docs/status/current.json) remains a dated pre-connection checkpoint.

The Owner's current direction is to defer paid market data and continue preparing
the local workflow. No data purchase is pending.

## Run locally

Node.js 24.12 or later is required. Install locked dependencies with
`npm ci`, then run:

| Command | Purpose |
| --- | --- |
| `npm run options:brief -- --report gld-ibit-observe-open-20260908` | Print a readable local collection, review and source-context brief; add `--json` for bound report hashes |
| `npm run options:calendar-brief -- --report` | Print a separate thirty-date BLS/FOMC calendar brief with explicit temporal precision; add `--json` for bound source hashes |
| `npm run options:release-calendar -- --refresh` | Retrieve and preserve one public BLS scheduled-release calendar |
| `npm run options:release-calendar -- --report` | Read upcoming releases, schedule changes, unknown metadata and collection age |
| `npm run options:evidence-rehearsal -- --rehearse <package-id>` | Test repository recovery in a fresh temporary workspace while preserving active data and the source package |
| `npm run options:evidence-export -- --create <study-id> <package-id>` | Create one immutable local copy of the selected study and fixed journals |
| `npm run options:evidence-export -- --verify <package-id>` | Independently verify every copied byte against its bounded manifest |
| `npm run options:btc-context -- --refresh` | Read one public Coinbase BTC-USD level 1 snapshot as IBIT context and save it locally |
| `npm run options:btc-context -- --report` | Recover source/receipt clocks, context health and changes between consecutive saved snapshots |
| `npm run options:readiness -- --report gld-ibit-observe-open-20260908` | Recover seven local components, preserve v1 review coverage and show real-price test dependencies plus optional BTC context |
| `npm run options:treasury -- --refresh` | Read Treasury's current-month daily real yields once and save source history |
| `npm run options:treasury -- --report` | Recompute local retrieval health, dated yields and revisions without network access |
| `npm run options:robinhood-closeout -- --report gld-ibit-observe-open-20260908` | Recompute request, failure and usable-data coverage without saving a report |
| `npm run options:robinhood-closeout -- --save gld-ibit-observe-open-20260908` | Save an immutable actual-time acceptance report and return its receipt |
| `npm run options:robinhood-collect -- --prepare gld-ibit-observe-open-20260908` | Check the frozen collection window and cadence; only the authorized host tick invokes market tools |
| `npm run options:robinhood-observe -- --help` | Screen samples, freeze a prospective study, record exact quote captures and review gaps/lessons |
| `npm run options:robinhood-capture -- --inspect <JSON> [--save]` | Assess a bounded capture at actual time; optionally preserve an immutable local record |
| `npm run options:robinhood-data -- --report` | Show dated capabilities, missing field semantics and the disabled example |
| `npm run options:robinhood-data -- --inspect-tools <JSON>` | Inspect a bounded local tools/list declaration without connecting |
| `npm run options:robinhood-data -- --probe-public` | Check the fixed public endpoint once without authentication or reading its body |
| `npm run options:research-preflight -- --manifest <JSON> --metadata <JSON> --config <JSON>` | Check source/selection/plan linkage without importing or replaying |
| `npm run options:research-preflight -- --manifest <JSON> --metadata <JSON> --config <JSON> --save` | Preserve an immutable preparation record with its original clock |
| `npm run options:broker-reference -- --reference` | Show the dated broker research scope and limits |
| `npm run options:broker-reference -- --fees <JSON>` | Estimate fees for one supported September 4, 2026 execution |
| `npm run options:historical-replay -- --demo` | Run isolated synthetic historical research cases without saving |
| `npm run options:historical-replay -- --record-demo` | Save synthetic research runs, reviews and candidate lessons separately |
| `npm run options:historical-replay -- --input <config JSON>` | Look up an imported dataset and record a research result, including missing-data blockers |
| `npm run options:historical-replay -- --report` | Recompute independent research runs and their candidate notebook |
| `npm run options:market-extract -- --input <CSV> --selection <JSON>` | Extract a declared session/contract subset with an integrity manifest |
| `npm run options:market-data -- --catalog` | Inspect reviewed source options and access limitations |
| `npm run options:market-data -- --demo` | Inspect synthetic quote-path qualification without saving |
| `npm run options:market-data -- --import <CSV> --metadata <JSON>` | Save a supported local file with explicit origin and usage declaration |
| `npm run options:market-data -- --report` | Recompute saved data-quality reports; no fill simulation |
| `npm run options:paper -- --demo` | Run scripted round trips and failure cases without saving |
| `npm run options:paper -- --record-demo` | Save the demo, including restart/resume and trade reviews |
| `npm run options:paper -- --input fixtures/options-paper/gld-target.json` | Append one local scenario |
| `npm run options:paper -- --report` | Recompute saved trades, balances, reviews and mistake notebook |
| `npm run options:feasibility -- --demo` | Compare illustrative options risk/R scenarios |
| `npm run options:feasibility -- --input fixtures/options-retail-feasibility/gld-normal.json` | Check one manually supplied scenario |
| `npm run options:drivers -- --catalog` | Show all driver families, indicators and source gaps |
| `npm run options:drivers -- --refresh` | Read six fixed public feeds once and save local history |
| `npm run options:drivers -- --report` | Reassess saved headlines and freshness without network access |
| `npm run options:drivers -- --demo` | Demonstrate candidate tagging with a labeled synthetic observation |
| `npm run alpha:validate` | Run all surviving tests, strict typecheck, scope and documentation checks |

Headline refreshes are stored in `data/runtime/options-driver-monitor/refreshes.ndjson`
inside the checkout, excluded from Git. Each refresh is one checksum-linked
append containing both observations and source health. A damaged/truncated
journal or existing writer lock blocks the command; never delete a lock without
first checking whether another monitor is running. History is bounded at 16 MiB;
rotation/export requires a reviewed operation rather than silent deletion.

## Boundaries

Preparation validates child hashes, selected contracts/dates, metadata, plan
linkage and chronology. Saved artifacts live under the ignored research
`preparations/` directory. Same-ID repeats preserve the first clock; changed inputs
or corrupt/partial artifacts fail. Parent source hashes remain linked manifest
claims because preparation does not reread the parent. A linked package does not
certify rights, contract listing, affordability, liquidity, fees or an account.
It neither imports evidence nor runs a trade simulation. The separate fee estimator
is limited to its reviewed date and single-execution assumptions; old journals,
engine outputs and frozen cost inputs remain unchanged.

Historical research lives in `data/runtime/options-historical-replay/runs.ndjson`.
It preserves source snapshot times, actual import time and actual run-recording
time separately. Contract selection and historical decisions are retrospective
declarations. Its `COUNTERFACTUAL_SNAPSHOT_TIME` model uses later-snapshot ask
entries and bid-minus-slippage exits; every fill is `ASSUMED_FILL`. A target
trigger does not guarantee the final profit. Missing exits remain unresolved,
and independent USD 1,000 runs never compound into a shared account.

The strict size model blocks modern Cboe size timing. The optional recorded-size
assumption still requires positive sufficient quantities; it never invents missing
liquidity. Every research outcome receives a review. Candidate lessons use actual
research-recording time, preserve source origin, and cannot change frozen plans
or approve a strategy. See the [configuration example](fixtures/options-historical-replay/config.example.json).

Extraction accepts at most 64 MiB / 250,000 source rows and produces at most
4 MiB / 10,000 selected rows. It writes a manifest beneath the separate research
directory, records the original source hash and normalizes record separators to
LF. No match produces a manifest rather than an invented dataset. Existing or
partial outputs cannot be overwritten. The [selection example](fixtures/options-historical-replay/selection.example.json)
contains illustrative identities, not selected trades or independently verified listings.

Market evidence is stored separately in `data/runtime/options-market-evidence/`.
Its importer supports the documented Cboe DataShop format, not dashboard scraping.
See the [metadata example](fixtures/options-market-evidence/metadata.example.json)
and [import instructions](docs/OPTIONS_MARKET_EVIDENCE_DELIVERY.md). A source name
and local checksum do not prove publisher identity or data rights. Unknown sizes,
sampled paths and delivery limitations remain explicit. Until contract/calendar,
availability and cost/fill-model evidence is qualified, its original gate returns
`NO_REPLAY` and zero trades. The separate research model does not change that gate
or the old paper/review output fingerprints. There is no adapter into the older
paper engine that backdates historical quotes or fills missing liquidity.

A public headline is an unverified source assertion. Keyword tags only suggest
which factors deserve review; they do not establish causality, direction or
probability. Coverage remains incomplete. Treasury real yields and BTC
spot context are connected; verified GLD/IBIT option chains, complete portfolio-risk
runtime, calibrated market-validated option-outcome replay and the Options Dashboard
remain unfinished.

Robinhood's current official Trading MCP documents option historical OHLC bars,
real-time quotes and contract lookup. Alpha has no verified quote adapter. Public
documentation does not establish historical bid/ask sizes, retention or GLD/IBIT
entitlements. The new preparation command separates documented tools, local
catalog declarations and unresolved response semantics. Its five-tool filter is
client-side only; it cannot narrow server authorization or enforce GLD/IBIT inputs.
The [example](fixtures/options-robinhood-data/codex.disabled.example.toml) stays
disabled. The Owner subsequently authorized the five-tool host connection and
official login and explicitly accepted the broader connection grant. The enabled
host copy is installed; OAuth completion and `o_auth` status are verified, with
the same five tools. Runtime loading and the first bounded market-data smoke
test now succeeded. Option side prices, sizes and quote-refresh timestamps are
present; independent side/size clocks and retention rights remain unverified.
New-account and paid steps remain excluded. See the
[host setup record](docs/OPTIONS_ROBINHOOD_CONNECTION_SETUP.md).
An eventual Robinhood adapter needs separate source semantics; responses cannot
be relabeled as Cboe evidence. OHLC cannot substitute for missing quote-side data.
See [data readiness](docs/OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md).

Local paper history lives in `data/runtime/options-paper/sessions.ndjson`, excluded
from Git. Each batch preserves its input, result and review. Reopening recomputes
results and checks the hash chain. Damage or an existing writer lock blocks the
command; do not erase history or locks to bypass a failure. Only the latest active
scenario can resume by appending quotes received after its previous as-of time.
Frozen plans and earlier quotes cannot change. Synthetic and imported cases
cannot share one account. Sale proceeds remain unsettled; no settlement is invented.

The refresh commands are one-shot. The existing `gld-ibit` Codex heartbeat preserves
the daily 09:00 New York news workflow and adds Treasury and BTC context while sharing the bounded quote
window described in the collection runbook. It
requires the local computer and app to remain available; no server daemon is
installed. Meaningful related changes and source failures are the notification
criteria.
The headline monitor performs no account lookup, credential use, paid subscription, brokerage paper account or
order operation is performed. Original news fixtures retain their separate verification
rules; live headlines cannot inherit their verified status.

## Focused architecture

The Owner authorized removal of obsolete Event Contract/Kalshi, legacy Python,
Daily Scan and fixed-stock-universe Alpaca business lanes. 292 files were removed
with dependency checks; see the [deletion manifest](docs/OPTIONS_FOCUS_DELETION_MANIFEST.json).
Reusable macro and broad-market evidence is retained as context for gold/BTC,
never as permission to trade another asset. Historical design documents and
Git history remain audit records, not active product entry points.

See [architecture](docs/ARCHITECTURE.md), [roadmap](docs/ROADMAP.md),
[handoff](docs/HANDOFF.md) and [v2 specification](docs/specifications/OPTIONS_FOCUS_RISK_AND_DRIVERS_V2.md).
