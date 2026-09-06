# GLD / IBIT Options Focus v2 delivery

Date: 2026-09-06. This report supersedes the historical retail feasibility v1
policy. The Owner authorized development, removal of unrelated product code,
saving, commits and pushes. No personal trading experience or profitable edge
is claimed. The deliverable is a tested research/monitoring foundation; the
complete live options decision product remains unfinished.

## Stop and reward assessment

There is no universally appropriate premium stop. A 10% decline may reflect
the spread, ordinary volatility or an IV change rather than thesis failure.
The reference stop is now **20% as a research default**, with 10%-25% inputs for
comparison, not a proven optimal policy. Option prices also depend on strike,
time and volatility: [OIC option price behavior](https://www.optionseducation.org/referencelibrary/faq/option-price-behavior).

The more useful control is planned cash loss relative to the account. The v2
diagnostic limits all-in planned R to **0.5% of current equity**: USD 5 for a
USD 1,000 account. Five percent allocation is a ceiling, not required spending.
The separate retained USD 25 full-premium-plus-fees cap can be stricter.
An affordable whole contract may not exist; no trade is a valid result.

| Illustrative premium | Premium stop | Gross stop, before costs | 1.5R-2R net target if costs are zero |
| --- | --- | --- | --- |
| USD 25 | 10% | USD 2.50 | USD 3.75-5.00 |
| USD 25 | 20% | USD 5.00 | USD 7.50-10.00 |
| USD 50 | 20% | USD 10.00 | USD 15.00-20.00; blocked by current risk limits |

R includes round-trip fees and an exit-slippage reserve. Target cash gain is a
multiple of that R; indicative premium exit prices restore costs and round up
to the quote grid. Whole-contract ticks, friction and the 80% gross target
ceiling are checked separately. Unknown costs block the diagnostic. The USD 25
demo explicitly assumes zero costs; real fees can require a smaller premium.

Stop prices do not guarantee execution or maximum loss. A purchased option may
lose its entire premium. See [Robinhood options stop orders](https://robinhood.com/us/en/support/articles/stop-market-order-options/).
Changing a stop after entry to avoid recognizing a loss is not part of the
policy. An underlying thesis exit, time exit, event review and liquidity check
are still needed before a live decision engine can be complete.

A claimed 80% probability cannot enable 10% allocation or a longer holding
period. The relevant outcome is reaching the net target before stop/time exit,
not expiry profitability or an AI confidence score. No calibrated GLD/IBIT
option-outcome dataset currently establishes that probability.

## The year-end aspiration

USD 1,000 to USD 50,000 is **50 times capital, or a 4,900% gain**. From the next
regular session on 2026-09-08 through 2026-12-31 there are 81 exchange sessions,
including the shortened sessions. Calendar source:
[NYSE holidays and hours](https://www.nyse.com/trade/hours-calendars).
The required compounded net gain is approximately **4.9482% per session**.

For perspective only, a hypothetical 1% account risk and 2R win gives 2% account
growth before costs. Eighty-one consecutive such wins yield about USD 4,973,
not USD 50,000. Reaching 50 times capital at 2% per win requires 198 consecutive
wins; at the implemented 0.5% planned risk and 2R, the idealized 1% per-win path
requires 394. These illustrations ignore losing trades, costs, discrete
contracts and the retained absolute stress cap, so they overstate what the
current constraints permit. They are not frequency recommendations or forecasts.

An extreme outcome is mathematically possible, but there is no evidence here
that it is a realistic planning assumption. The aspiration cannot change risk
limits or justify a promise of stable returns. Durable participation can mean
holding cash while waiting for an eligible opportunity.

## Driver coverage and actual connections

The catalog contains **16 families, 94 indicators and 34 primary-source
references**. It is extensible and explicitly non-exhaustive. Conditional
mechanisms can change with the market regime; multiple headlines can describe
the same event and are not independent evidence.

| Families | Examples |
| --- | --- |
| Monetary policy; real yields; USD/FX; macro releases | Rate decisions, expected policy, inflation, employment, growth and release revisions |
| Liquidity/funding; cross-asset stress | Central-bank balance sheets, funding markets, risk appetite, credit stress |
| ETF flows/basis; gold official reserves; gold physical supply/demand | GLD/IBIT shares and NAV, creation/redemption, central-bank purchases, mine supply and jewelry demand |
| Derivatives positioning; Bitcoin issuance/network; on-chain holders | Futures leverage, liquidations, COT, miners, halving, network events and attributed exchange flows |
| Stablecoin liquidity; regulation/security/adoption; geopolitics/major events | Issuance/redemption, legislation, enforcement, hacks, sanctions and conflict |
| Options structure/execution | IV versus realized movement, skew, term structure, Greeks, spread, depth, expiry and session gaps |

Numeric sources have different publication lags and licensing constraints.
For example, [CFTC COT](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm)
is not a live positioning feed, and [gold reserve data](https://www.gold.org/goldhub/data/gold-reserves-by-country)
must preserve its reporting lag. ETF asset-value growth is not automatically
a cash inflow. These distinctions are recorded in the catalog.

Six official public headline endpoints were actually tested with HTTP 200:
Federal Reserve, BLS, BEA, ECB, OFAC and SEC. The first application refresh at
2026-09-06T20:10:22.898Z persisted **118 observations**: 20, 1, 47, 15, 10 and 25
respectively. BEA had one rejected item, exposed in its diagnostic. These
counts establish a read-only connection and saved history, not fresh coverage
of every factor. No numerical driver connector is implemented yet.

A second actual refresh at 2026-09-06T20:25:15.779Z saved zero duplicate
observations and a new batch of six source-health records. All six sources
remained OK; the historical observation count stayed 118.

The monitor uses fixed HTTPS endpoints, request time/size limits, no redirects
or credentials, bounded RSS/Atom parsing and title-only persistence. It preserves
first-seen versions and corrections, detects changed/corrupt local history,
prevents concurrent writers and reports source failures and stale evidence.
Hashes prove local consistency, not publisher authenticity. Matching a keyword
produces a candidate factor tag only. Output direction remains UNDETERMINED,
probability null, coverage incomplete and executionAllowed false.

Local history is excluded from Git. An hourly Codex heartbeat, id `gld-ibit`,
is active for this task and reports meaningful relevant changes, source
failures/recovery or required action. It requires the local computer, app and
worktree to remain available; see [Codex automations](https://learn.chatgpt.com/docs/automations).
The command itself remains one-shot, and no brokerage operation is scheduled.

## Files and scope review

- Risk contract, engine, fixtures and CLI implement the new R-based arithmetic.
- Options driver contract, catalog, engine, public I/O helper, CLI and tests add
  explicit coverage and operational source history.
- Shared market-calendar contract/validator were extracted before deleting the
  old Daily Scan composition; Options consumers retain the same validation.
- **292 obsolete files and 83 npm commands** were removed from Event Contract/
  Kalshi, legacy Python and Personal ETF/stock Daily Scan lanes. The exact paths
  and reasons are in the [deletion manifest](OPTIONS_FOCUS_DELETION_MANIFEST.json).
- Package exports, aggregate registrations, current architecture, handoff,
  roadmap, status schema/validator and historical code links were reconciled.

Generic history/replay, journal, research, audit, AI cost controls, canonical
market data and Twelve Data foundations remain useful dependencies. QQQ
fixtures are contextual engineering tests and cannot authorize another trading
asset. Historical design documents and Git history remain audit records.

## Validation and publication

`npm.cmd run alpha:validate` passed: **75 components, 1,896 tests executed,
1,896 passed, zero failed**, aggregate duration 21,185 ms. This includes strict
TypeScript checks, every surviving registered suite, scope/import checks,
documentation links, credential/runtime-data scans and staged/unstaged whitespace
checks. The ignored local log is `alpha-options-focus-v2-validation.log`.
Warnings were the expected uncommitted working tree and Git LF-to-CRLF notices;
there were no validation failures. The smaller count than the historical 3,145
reflects removed unrelated suites, not skipped surviving tests.

Focused risk tests passed 82/82 and CLI tests 6/6; the final aggregate includes
driver engine 28/28, driver I/O/CLI 16/16, calendar 14/14 and current-status 40/40.
Actual public-feed refresh was tested twice separately from deterministic tests.
The authoritative current result is `currentDeliveryValidation` in
[machine status](status/current.json); old milestone counts remain historical.

Changes are prepared for an Owner-authorized commit and push on
`codex/gld-ibit-options-foundation`. Baseline is
`53a905a5f8360afeea1d24eaa084110f6ef85bdc`; the containing Git commit records this
delivery. Publication completion and the resulting commit are reported in the
task after push, rather than embedded as a self-referential commit hash here.

Independent review exercised version reversions, as-of behavior, same-clock
corrections, local corruption, locking and bounded transport. It identified a
health-status string-coercion hole; the implementation now requires a string
and includes an array/object regression. No live account or order test is run.

## Remaining work and assumptions

Next priority is verified GLD/IBIT option-chain data, contract metadata and
complete portfolio risk, followed by quantitative driver connectors, locked
six-dimensional decisions, persistent paper records, cost-aware path replay,
calibration and an Options Dashboard. Public headline connectivity does not
complete those systems or establish a trading edge. Input fees, quoted liquidity
and any hypothetical option are not independently verified by the diagnostic.

The 20% stop, 0.5% planned risk and R target are conservative research choices,
not empirically optimized live recommendations. Existing stress caps remain
separate. More coverage is useful only when point-in-time provenance, revisions,
latency and independent outcome evaluation are preserved.
