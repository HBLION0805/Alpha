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
The USD 50,000 aspiration never grants a risk override. See the
[v2 specification](specifications/OPTIONS_FOCUS_RISK_AND_DRIVERS_V2.md).
