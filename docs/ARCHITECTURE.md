# Alpha Architecture

## Product scope and ownership

Alpha supports decisions about GLD and IBIT options on Robinhood. Capital
preservation and explicit risk precede growth targets. TypeScript owns the
current product logic. Legacy Python, Event Contract/Kalshi, Daily Scan and
fixed-universe Alpaca product implementations have been removed by Owner
instruction. The [machine status](status/current.json) records current authority.

## Context and evidence

`OptionsDriverCatalog` defines 16 economically plausible driver families and 94
indicators. Each has affected assets, conditional mechanism, source references,
proposed review cadence and a limitation. This is an extensible coverage map,
not an exhaustive causal model or a signed scoring rule.

`options-drivers.mjs` is the public-feed composition root. It reads only six
code-owned HTTPS endpoints, with no credentials, redirects or arbitrary URL
input, a 12-second timeout and 512 KiB body limit per request. Its bounded RSS/Atom
parser saves titles and links, not full articles, and rejects entity declarations.

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
Robinhood's documented Trading MCP offers option contract lookup, real-time quotes
and historical OHLC tools, but no connector or authenticated access is implemented.
The public descriptions do not prove historical bid/ask/size coverage or the
Owner's entitlement. The new local readiness assessment prepares a later,
separately authorized review of actual schemas and data. OHLC cannot be relabeled
as quote-side evidence, and an anonymous HTTP result cannot establish connectivity.
The USD 50,000 aspiration never grants a risk override. See the
[v2 specification](specifications/OPTIONS_FOCUS_RISK_AND_DRIVERS_V2.md).
