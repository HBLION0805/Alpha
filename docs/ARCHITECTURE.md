# Alpha Architecture

## Options sample validation (September 7, 2026)

`OptionsSamplePartitionEngine` audits explicit chronological windows and whole
information intervals, retaining excluded cases and cross-partition dependence
conflicts. `OptionsSampleInventory` recomputes original outcomes before exposing
case identity, declared clocks, exact-path reuse and missing sampling metadata.
Both preserve unknown independence, no sealed access and no model authority.
The inventory reuses the extracted, unchanged outcome CLI history-loader sequence;
exclusive artifacts retain their actual clocks and recompute in fresh processes.
See [delivery](OPTIONS_SAMPLE_VALIDATION_DELIVERY.md) and the two linked specs.

## Declared structure comparison (September 7, 2026)

`OptionsStructureComparisonEngine` validates one-symbol, same-expiry declared
alternatives through the existing contract/quote validators. Signed intrinsic
functions, strike knots and the right tail establish exact terminal extrema and
rational break-even prices. Quote-side size, receipt/freshness, fee references
and anomalous premiums remain explicit. Single-leg checks reuse retail
feasibility; multi-leg portfolio accounting, stops, pricing and lifecycle remain
unsupported. A separate offline CLI preserves exclusive scenario/result
artifacts with actual recording clocks and fresh-process recomputation.
No source adapter, ranking, trade, account access or old engine change follows.
See [design](specifications/OPTIONS_STRUCTURE_COMPARISON_V1.md).

## Declared options portfolio diagnostics (September 7, 2026)

The independent `OptionsPortfolioRiskEngine` composes existing paper-definition,
quote, retail-feasibility and closed-review validators. One declared $1,000 cash
scenario supplies its own history, open holdings, pending entries and optional
candidate. Receipt-time cash accounting and aggregate limits do not merge
independent research accounts or mutate their journals. Unknown account evidence,
marks and event coverage remain blocking diagnostics. The bounded offline CLI
saves exclusive artifacts and verifies them through deterministic recomputation.
No broker account, order, calendar-derived blackout or strategy authority is added.
See [design](specifications/OPTIONS_PORTFOLIO_RISK_V1.md) and
[delivery](OPTIONS_PORTFOLIO_RISK_DELIVERY.md).

`OptionsOutcomeAudit` recomputes original paper scenarios and research runs,
then derives exact closed-case arithmetic, all-disposition counts and grouped
candidate evidence. Shared paper cash and independent historical accounts stay
separate. The offline dashboard composes current repository readers, calendar
brief and audit without HTTP or source appends; hashes bind immutable HTML/JSON
snapshots, and repeated paper/research report checks expose cross-read changes.
Export v2 opts into BLS/FOMC paths under the existing bounded I/O and manifest
validation, while the default v1 allowlist and accepted package hashes remain
unchanged. Isolated recovery invokes the calendar reader only for v2 packages.
See [batch specification](specifications/OPTIONS_LOCAL_COMPLETION_BATCH.md).

Opt-in `OptionsContextCutoffV2` composes the unchanged four-source context engine
with FOMC receipt-time selection through its existing calendar report engine.
It validates complete histories before filtering, isolates blocked sources and
binds v1 context, selected-prefix and report hashes. The existing cutoff CLI's
`--at-v2` reads a fifth journal; `--at` retains v1 and never opens that journal.
No source, quote, host, replay or trade authority changes. See
[specification](specifications/OPTIONS_CONTEXT_CUTOFF_V2.md).

## Product scope and ownership

Alpha supports decisions about GLD and IBIT options on Robinhood. Capital
preservation and explicit risk precede growth targets. TypeScript owns the
current product logic. Legacy Python, Event Contract/Kalshi, Daily Scan and
fixed-universe Alpaca product implementations have been removed by Owner
instruction. The [collection status](status/robinhood-closeout.json) records the latest
Robinhood checkpoint; [current.json](status/current.json) retains the prior build.

## Host collection boundary

Daily restoration v6 adds the supported per-command network approval path for
news in a restricted host environment. The public transport recognizes bounded
structured EACCES/EPERM wrappers as FEED_NETWORK_ACCESS_DENIED; the host owns
approval, and the CLI performs one fixed-source attempt. No internal elevation,
retry, endpoint substitution or global permission change is introduced. Prior
snapshots and quote Host code remain unchanged. See
[network recovery](OPTIONS_NEWS_ACCESS_RECOVERY.md).

`options-collection-rehearsal.mjs` binds the hash-checked Host program to isolated
synthetic workspace/study/contract constants. Fake quote ports and in-process
command ports exercise the original local collector and closeout across complete
windows; no shell, network or host mutation is involved. Actual run clocks remain
separate from simulated source/recording clocks. See
[delivery](OPTIONS_COLLECTION_REHEARSAL_DELIVERY.md). The actual Host scheduler,
entitlement, provider latency and unresolved tool calls are not tested by this model.

`options-robinhood-collect.mjs` is a network-free composition root over existing
observation storage. It prepares a fixed quote batch only within the frozen
window and minimum cadence, accepts bounded data-only replies, and saves exact
capture/frame links or sanitized source failures. A writer lock, exclusive
attempt files and checked hashes preserve retries and partial-write recovery.
The observation engine and its existing outputs remain unchanged.

The Codex host invokes two authorized market tools using the tested
[runbook](OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md). Its existing news heartbeat
temporarily schedules the first bounded collection window. Absolute UTC phases
restore the active daily context fields before reading collection records at window end.
The v5 baseline retains news/Treasury/BTC/BLS and adds one FOMC date-calendar refresh;
the original news-only, v2, v3 and v4 restoration snapshots remain immutable.
Host scheduling, source quality and execution authority are separate: an enabled
schedule does not establish a recorded or eligible quote, replay or trade.

`RobinhoodCloseoutEngine` joins the unchanged observation review with validated,
sanitized collector attempt summaries. Request slots separate pending work from
completed gaps, source errors, saved frames and usable contract coverage.
`options-robinhood-closeout.mjs` stores exclusive hash-sealed reports with exact
input prefixes. Recovery recomputes each prior report at its original assessment
clock, even after later frames/attempts arrive. The final host step restores news
before invoking this deterministic save. Coverage has no execution authority.

## Context and evidence

`FomcCalendarEngine` parses a restricted, non-executing public HTML profile for
the receipt's New York year and next-year panel. It keeps date intervals and
projection markers without inventing intraday or confirmed-event timestamps.
Its separate bounded journal retains raw receipt history; consecutive same-year
comparisons do not interpret absent date-derived keys as cancellation. See
[delivery](OPTIONS_FOMC_CALENDAR_DELIVERY.md). Existing BLS, readiness, context
cutoff, brief and export versions are unchanged. The separate
[daily v5 integration](OPTIONS_FOMC_DAILY_CONTEXT_DELIVERY.md) includes FOMC in
the shared 09:00 context branch without changing the quote Host program.

`OptionsContextCutoff` independently validates current headline, Treasury, BTC
and BLS histories before filtering by stored receipt/discovery clocks. It uses
unchanged source engines at the selected cutoff. Its context hash excludes later
unselected records and current check clocks; its artifact hash includes recovery
and construction clocks. Exact append times and actual historical decisions
remain unproven. The bounded read-only CLI does not grant replay authority; see
[delivery](OPTIONS_CONTEXT_CUTOFF_DELIVERY.md).

`OptionsOperatorBrief` projects the unchanged readiness v2 and independently
recovered BLS calendar into plain English text. It recomputes v1/v2 exactly,
retains component check clocks/report hashes and escapes provider control text.
Its command recovers local stores only; calendar failures cannot hide paper
review coverage. This is a separate consumer, not a new readiness/replay gate or
an extension to the existing export format. See
[specification](specifications/OPTIONS_OPERATOR_BRIEF_V1.md).

`BlsReleaseCalendarEngine` owns a restricted BLS ICS profile, verified Eastern
timezone conversion, scheduled events and consecutive-snapshot changes. It keeps
actual receipt time separate from missing source publication metadata. Removed
UIDs are absent observations, not inferred cancellations. A separate bounded
transport/journal stores one official calendar per explicit refresh. Daily v4
context now includes this independent source; readiness v1/v2 and the previous
evidence-export format remain unchanged and exclude its separate journal.
No released values, event-impact scores, calibrated risk windows or order rights
are inferred. See [specification](specifications/OPTIONS_BLS_RELEASE_CALENDAR_V1.md).

`OptionsEvidenceExportEngine` defines exact selected-study and fixed-journal
source mappings, limits and manifest invariants. The script copies raw bytes into
one exclusive local package, checks source inventories before/after copying and
writes the manifest last. Verification never consults current source stores.
This supports record preservation without source writes, semantic-recovery claims,
automatic restore or an off-device backup. See [specification](specifications/OPTIONS_EVIDENCE_EXPORT_V1.md).

`options-evidence-rehearsal.mjs` reconstructs only verified, allowlisted package
data beneath a fresh temporary workspace, then invokes the existing readiness v2
recovery there. It rechecks both package and reconstructed bytes afterward and
retains isolated data for inspection. Missing/corrupt components remain explicit;
no active data, strategy or host configuration is restored or overwritten.

`BtcSpotContextEngine` owns the bounded Coinbase Exchange BTC-USD book schema,
exact decimal/nanosecond arithmetic and consecutive-observation diagnostics.
`options-btc-context.mjs` has one fixed anonymous level 1 GET and a separate
checksum-linked single-writer journal with recovery and uncertain-write guards.
This standalone IBIT context source cannot produce ETF prices, continuous paths,
signals, replay fills or execution authority. Its daily refresh is isolated from
the one-minute option collector. See the
[specification](specifications/OPTIONS_BTC_SPOT_CONTEXT_V1.md).

`options-readiness.mjs` sequentially recovers the selected collection study,
paper account, historical research, imported evidence, headline history and
Treasury history through their existing repositories. The pure
`OptionsReadinessEngine` validates report-bound summaries and check clocks, then
lists storage issues, paper/research review coverage, separate candidate notebook
counts and explicit source/cost/adapter dependencies. It creates no new journal
and performs no network/scheduler operation. A readable journal can still contain
failed source attempts; an unavailable component never hides recovered peers.
The report is not atomic across stores, does not inspect the live host schedule
and never combines independent simulated accounts or emits a trading permission.

The CLI now composes a v2 report through `OptionsContextReadinessEngine`: the exact
v1 report is recomputed and checked, then independent BTC recovery adds one data-only
summary. Original core completion, dependencies, reviews and fingerprints remain
linked; optional BTC issues have a separate context next step. The original v1
engine and exported recovery function remain callable without changed outputs.

`TreasuryRealYieldEngine` parses a strict bounded Treasury Atom/XML subset into
five whole-basis-point daily par real yields. It separates source dates, feed
metadata and actual retrieval clocks; negative yields and missing values retain
their meaning. Reports expose dated observations, consecutive-source-date changes,
missing tenors, failed/empty current retrievals and actual-time revisions. They
do not establish a publication calendar, historical vintage or trading signal.

`options-treasury.mjs` and its script-owned transport issue one anonymous GET for
the current New York month, with a fixed endpoint, deadline and byte limit.
The separate `options-treasury-rates/retrievals.ndjson` journal retains successful
raw XML, sanitized failures, assessments and a checksum chain. Exclusive locking,
path/link/size checks and deterministic recovery protect existing local records.
Its daily scheduler branch is separate from the one-minute option quote branch.
The six-feed headline engine and all accepted option journals remain unchanged.

`OptionsDriverCatalog` defines 16 economically plausible driver families and 94
indicators. Each has affected assets, conditional mechanism, source references,
proposed review cadence and a limitation. This is an extensible coverage map,
not an exhaustive causal model or a signed scoring rule.

`options-drivers.mjs` is the public-feed composition root. It reads only six
code-owned HTTPS endpoints, with no credentials, redirects or arbitrary URL
input, a 12-second timeout and 512 KiB body limit per request. Its bounded RSS/Atom
parser saves titles and links, not full articles, and rejects entity declarations.
The transport now enforces its deadline across headers/body independently of
provider cancellation, validates UTF-8 without replacement and retains fixed
failure codes. Direct journal reads/appends reject hard links as well as unsafe
paths. Existing source URLs, parser outputs and journal hashes are unchanged by
this correction; see [review](OPTIONS_HEADLINE_TRANSPORT_CORRECTION.md).

Every headline binds source, publication time when available, first observation,
origin, content identity and complete-record checksum. The local journal stores
one checksum-linked refresh envelope containing observations and source health.
Consecutive-version dedupe preserves A-to-B-to-A corrections; append order breaks
same-clock ties. A lock excludes concurrent writers. Partial/truncated history
fails visibly, and checksums are explicitly not publisher authentication.

The report recalculates age and candidate tags. Missing, undated, future or stale
observations never count as fresh. Health becomes overdue after one hour;
recent-headline context uses an explicit 72-hour window. A recent headline does
not prove a numeric driver is connected. Direction remains UNDETERMINED,
probability null and executionAllowed false. Historical observations are not a
historical option-outcome dataset. No automatic causal trading recommendation
is derived from keyword counts.

The older Options News subsystem remains fixture-only with deterministic
verification and provider-authority rules. The live headline monitor cannot
promote itself into that subsystem's VERIFIED state.

## Robinhood data-access preparation

`options-robinhood-data.mjs` is a separate capability-preparation composition.
Its report and bounded local tools/list inspection do not connect to a server.
The pure catalog assessment emits only five fixed candidate names, presence,
schema fingerprints, read-only hints, exclusions and pagination; untrusted schemas
and descriptions cannot grant semantic compatibility or execution authority.

The anonymous probe sends one GET to the fixed official endpoint, omits credentials,
refuses redirects and reads no response body. A total 12-second deadline includes
cancellation. Numeric status and authentication-header presence are the only
retained HTTP details. HTTP success is not an authenticated connection or quote.
No mode invokes MCP tools, authenticates, installs configuration or writes journals.

The disabled fixture exposes only chain, instrument, option quote, option historical
and equity quote candidate names. This client filter does not restrict server
OAuth scope or enforce symbols. The future adapter must establish actual schemas,
units, contract linkage, quote and underlying clocks, alignment, liquidity and
rights independently. Historical OHLC is insufficient for sampled execution.
Robinhood responses cannot enter the existing Cboe path under a changed label:
its interval clock and size cutoff are source-specific. Preserve old engines,
accepted records and fingerprints. See [delivery](OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md)
and [specification](specifications/OPTIONS_ROBINHOOD_DATA_READINESS_V1.md).

## Price and calendar foundations

`RobinhoodObservationEngine` composes the unchanged capture parser into two
separate diagnostics: bounded sample affordability screening and prospective
source observations. Frozen contracts and a declared future session window precede
new quote requests. Each frame preserves original precision/clocks, reports missing
or stale sides/sizes, duplicate/regressed/conflicting source times, underlying skew
and collection gaps. Candidate data-quality lessons retain actual recording time.
`options-robinhood-observe.mjs` writes immutable plans and checksum-linked numbered
frames, replay-verifies all prior records and uses an exclusive single-process lock.
Its host request template invokes nothing; no daemon, scheduler or credential store
is added. Passing diagnostics remain NO_REPLAY and cannot populate the non-null
execution semantics of `OptionQuote`. See the
[specification](specifications/OPTIONS_ROBINHOOD_OBSERVATION_V1.md) and
[delivery](OPTIONS_ROBINHOOD_OBSERVATION_DELIVERY.md).

`RobinhoodCaptureEngine` is a separate offline source-response diagnostic.
It consumes at most 512 KiB, twelve declared approved calls and four contracts,
checks UUID/OCC linkage and clocks, separates interpolated bars and reuses retail
economics with unknown costs. Source precision is preserved; age arithmetic uses
milliseconds. A 60-second diagnostic is not a production execution policy.
It always returns NO_REPLAY and cannot alter the old Cboe/paper gates.

`options-robinhood-capture.mjs` optionally stores one exclusive, checksum-bound
artifact beneath the ignored Robinhood captures directory. Recovery verifies
input bytes, original report and recording clock; later assessments still use
actual time. Local files remain declarations, not authenticated provider data.
The authorized host smoke test is separate from this network-free CLI. See
[specification](specifications/OPTIONS_ROBINHOOD_CAPTURE_V1.md) and
[delivery](OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md).

`CboeOptionQuotesCsv` reads bounded local licensed-format files. It preserves
nullable liquidity and exact integer-cent prices, converts interval-end Eastern
timestamps with DST checks, and rejects conflicts at one contract/time. Optional
IV zero is unavailable; optional Greeks remain source decimals. No account or
download connector is implied by this parser.

`OptionsMarketEvidenceEngine` binds source-file SHA-256, metadata, actual
ingestion time and normalized rows. Qualification distinguishes single snapshots
from sampled paths and reports missing fields, gaps, nonstandard roots and
source-owned limitations. Post-2026-06-22 DataShop sizes may describe the last
price change. Intraday delivery is delayed; interval snapshots do not reveal
tick order. Format acceptance cannot confer provenance or execution authority.

`LocalOptionsMarketEvidenceRepository` stores separate bounded hash-linked
imports and recomputes qualification during recovery. Same-ID repeats preserve
first-seen time; corrections require a new ID. Checksums establish local integrity
only. Its CLI has no network or credential access. The integration gate returns
NO_REPLAY pending independent contract/calendar, historical availability and
cost/fill-model qualification. Existing paper inputs, outputs, reviews and
fingerprints are unchanged; importedAt is never substituted for historical time.

`options-market-extract.mjs` streams a bounded local source before import. A
declared selection contains one Eastern session and one to four GLD/IBIT contract
keys. The extractor validates source records, preserves selected cells, normalizes
record separators to LF, and saves parent/child SHA-256, selection and row counts
in a manifest. Source limits are 64 MiB / 250,000 rows; the child retains the
importer's 4 MiB / 10,000-row limits. Empty selections produce NO_MATCH evidence.
Exclusive output creation and integrity checks prevent silent partial rewrites.
Selection remains retrospective and cannot authenticate a source or its usage rights.

`options-research-preflight.mjs` composes the existing validators without changing
their outputs. It verifies a workspace extraction manifest, exact child hash and
counts, session/contract selection, source metadata and frozen configuration.
Only the literal child path under the checked extraction directory is read;
the parent hash is retained as a manifest claim and the parent path is not followed.
Manifest/extraction/preparation chronology is checked. Its evidence candidate uses
the actual preparation clock and is explicitly not a saved market import.

INPUTS_LINKED_FOR_RESEARCH means internally coherent declarations. It does not
certify rights, source identity, contract terms, calendar, costs, affordability,
liquidity or brokerage eligibility. The command cannot append a market/replay
journal or create fills. Optional `--save` publishes an exclusive, bounded artifact
under research `preparations/`, with semantic input identity and full output hash.
Recovery checks current supplied bytes, recomputes the original-clock report and
preserves that clock on an identical repeat. Changed inputs under one run ID and
partial/corrupt artifacts fail visibly.

Canonical Instruments, Quotes, Bars, provider registration/composition and
reusable Twelve Data foundations remain. The old verified-snapshot product
composition depended on removed Daily Scan modules. Its calendar contracts and
validation were extracted unchanged into `MarketCalendar` and
`MarketCalendarValidation`, with dedicated regressions.

QQQ daily/hourly/15m/5m market-context fixtures remain explanatory benchmark
engineering tests. Their existing BroadMarket regime does not represent GLD
or IBIT. Intraday realized-volatility calculations exclude cross-session moves;
IBIT overnight/weekend exposure needs separate data and validation.

## Deterministic retail economics

`OptionsRetailFeasibilityEngine` accepts only standard 100-share integral long
calls/puts in GLD/IBIT manual scenarios. Required inputs include stopLossBps
1000-2500 and rewardMultipleMilliR 1500-2000. The 20% default is explicitly research
configuration, not empirically validated advice.

Planned cash risk R is the gross premium decline plus round-trip fees and exit
slippage reserve. It must fit 0.5% of current equity. Net profit targets are
1.5R-2R, gross targets restore costs, and an indicative exit rounds upward to the
quote grid. The prior 80% gross target ceiling, 5% allocation ceiling and USD 25
full-premium-plus-fees cap remain separate constraints. Unknown costs fail closed.

Entry assumes a limit fill at the stated ask; exit slippage is only a reserve.
No stop guarantees a fill or loss cap. Account eligibility, settled-cash proof,
aggregate exposure, event/drawdown limits, expiry and exercise still require a
complete risk runtime. An economic pass is not trade permission. An AI score
cannot authorize 10% allocation or extend the holding plan.

`OptionsBrokerFeeEngine` provides a separate reference estimate for one ordinary,
nonprofessional GLD/IBIT option execution on 2026-09-04. Integer arithmetic retains
sale-principal-dependent SEC fees and the distinct component rounding rules.
Unsupported dates and fragmented executions are outside its reviewed scope.
`options-broker-reference.mjs` exposes reference/fee commands; it does not modify
the original economics engines or automatically insert costs into a frozen replay.
Contract, session, order and account findings are dated evidence, not account
verification. See [preparation delivery](OPTIONS_RESEARCH_PREPARATION_DELIVERY.md)
and [broker research reference](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

## Independent historical interval research

`OptionsHistoricalReplayEngine` reads validated market evidence through a separate
`SAMPLED_OPTIONS_REPLAY_V1` model. It does not relax the existing NO_REPLAY gate or
reuse the paper account. Each run starts with its own USD 1,000 and one long
GLD/IBIT contract plan, within one declared session and 14-45 DTE. One-minute
through 15-minute historical intervals are supported; delayed intraday delivery
is excluded. A missing dataset produces a recorded BLOCKED result.

`COUNTERFACTUAL_SNAPSHOT_TIME` assumes original interval timestamps are decision
clocks. The actual import/run clocks and source-file/evidence fingerprints remain
unchanged. Plan and subset selection are RETROSPECTIVE_DECLARATION, not proof of
historical information availability or pre-registration. Contract, calendar and
cost references remain owner declarations even when structurally valid.

The engine reuses retail economics before an entry order and again at its modeled
fill. It requires a later ask within the limit, positive prices and sufficient
recorded sizes. Modern Cboe size timing blocks the contemporaneous-size model;
an explicit recorded-size assumption is available for research only. Every fill
is labeled ASSUMED_FILL. Stop, target and time triggers remain sticky; an exit
requires a strictly later usable bid less declared slippage. A target-triggered
exit may lose money. A zero bid can trigger a stop but cannot supply an exit fill.

Events keep observation clocks distinct from the trigger time. Processing stops
at the supplied session close; subsequent source coverage cannot fabricate fills.
Open/pending positions and missing final bid marks remain unresolved. Sale proceeds
stay unsettled, and no aggregate account growth is computed across independent runs.

`OptionsHistoricalReplayReview` reviews blocked, unfilled, open and closed runs.
Closed results reuse the unchanged trade review with explicit owner-file to
UNVERIFIED_IMPORT mapping inside the original provenance wrapper. Observed gaps,
liquidity delays and missing evidence become candidate lessons, not invented market
causes. Notebook links use actual research-recording order and matching source,
symbol, strategy and setup; they do not claim historical foreknowledge or change plans.

`LocalOptionsHistoricalReplayRepository` persists full inputs, evidence, clocks,
results and reviews in its own 16 MiB / 1,000-batch hash-linked journal. Recovery
recomputes results. Same-ID repeats preserve the original recording clock;
changed inputs or a later retry after a missing-data result require a new ID.
Single-writer scope and uncertain-write poisoning prevent stale-state retries.
See the [specification](specifications/OPTIONS_HISTORICAL_REPLAY_V1.md) and
[delivery evidence](OPTIONS_HISTORICAL_REPLAY_DELIVERY.md).

## Reuse and removal

Generic research, historical patterns/analogy/replay, evidence linking, journal,
strategy versioning, deterministic scoring, capital allocation, AI routing,
cost accounting and audit remain available where relevant to gold/BTC context.
Their existence does not prove a profitable options strategy.

The [292-file deletion manifest](OPTIONS_FOCUS_DELETION_MANIFEST.json) binds
removed paths to reviewed baseline 53a905a. Removal included obsolete tests,
exports, CLIs and 83 npm commands. A scope regression checks every surviving
relative import and registered test and prevents deleted product entry points
from reappearing. Historical documents link deleted code to fixed Git snapshots.

## Completion gates

The local trade-process foundation is implemented. `OptionsContractQuoteEngine`
qualifies local contract and quote inputs. `OptionsPaperTradingEngine` reuses
retail economics and adds one-position cash reservations, 14-45 DTE intraday
plans, later-quote fills, sticky stop/time exits and unsettled proceeds. An order
can consume its own reserved cash; a later order cannot reuse sale proceeds.
Net realized session loss is limited to 1% of initial paper equity, with gains
offsetting losses. The high-water drawdown limit is 5%. New R must fit remaining
capacity. These are simulation rules, not validated production recommendations.

`LocalOptionsPaperRepository` saves one scenario revision and replay result per
hash-linked batch, with bounded size and a writer lock. Handles expire when the
lock scope closes. Reopening recomputes outputs. New data must arrive after the
prior as-of cutoff, and new plans cannot displace an unresolved position/order.
No hypothetical fill, settlement credit or exercise result repairs missing data.

`OptionsTradeReviewEngine` reviews all closed trades, including wins and normal
losses. Objective pre-entry checks link time-qualified candidate lessons. Exit
mechanisms and accounting facts do not establish why a market moved. Monthly,
daily and intraday roles are frozen narrative inputs, not learned signal weights.

Verified GLD/IBIT contract metadata and executable option chains, qualified
quantitative driver connectors, complete account/event/settlement/exercise rules,
validated decision signals, independent historical/forward outcomes, calibration
and an Options Dashboard remain to be implemented.
Robinhood host authentication and five-tool loading are verified. A bounded
smoke test returned four stale, unaffordable option quotes and 120 interpolated
historical bars. No source-specific replay adapter, historical bid/ask/size path,
fresh aligned quote stream or retention-rights assessment is established.
OHLC cannot become quote-side evidence; local captures cannot authenticate themselves.
The USD 50,000 aspiration never grants a risk override. See the
[v2 specification](specifications/OPTIONS_FOCUS_RISK_AND_DRIVERS_V2.md).
