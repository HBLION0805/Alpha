# GLD/IBIT Robinhood research reference

Reviewed: **2026-09-06**. Target historical research session: **2026-09-04**.
This is a dated public-source reference for input preparation. It does not
verify the Owner's account, a selected contract, historical order availability,
data entitlements or actual fees/fills. Mutable support pages were inspected on
the review date; an undated page does not establish its historical rollout date.
The existing [historical replay](OPTIONS_HISTORICAL_REPLAY_DELIVERY.md) remains
an independent counterfactual model with assumed fills. Its original outputs,
fixed cost assumptions and the older market-evidence `NO_REPLAY` gate are unchanged.

## Standard contract terms and quote increments

OCC describes standard ETF options as 100 underlying shares per contract,
American exercise and physical delivery on the next business day after exercise.
Corporate actions can change the deliverable. Some expiring weekly products have
earlier closing times than other contracts in their class.
[OCC ETF specifications](https://www.theocc.com/clearance-and-settlement/clearing/etf-options).

For research, retain the existing long-call/long-put, 14-45 DTE, standard
100-share GLD/IBIT restriction. A root equal to GLD or IBIT is only a structural
screen. Actual series listing, multiplier, deliverable and adjustment status
still need contract-specific evidence; a generic ETF page cannot certify them.
Reject unsupported adjusted roots rather than assigning standard terms to them.

Nasdaq's Penny Interval Program rule specifies a one-cent quote increment below
$3 and five cents at or above $3 for participating classes other than its three
all-price penny exceptions. Thus $3.00 belongs to the five-cent tier. NOM's
minimum execution increment is one cent for all series; a quote-grid rule must
not be misrepresented as a universal execution-price rule.
[Nasdaq Options 3, Section 3](https://listingcenter.nasdaq.com/RuleBook/Nasdaq/rules/nasdaq-options-3).

The August 2026 qualifying-securities notice identifies GLD and IBIT in categories
requiring Penny Program membership.
[Nasdaq dated notice](https://www.nasdaqtrader.com/MicroNews.aspx?id=OTA2026-32).
The exact September 4 Cboe BZX reference CSV was also downloaded and inspected:

| OSI root | Reported tick category |
| --- | --- |
| GLD | Pennies to 3.00 |
| IBIT | Pennies to 3.00 |

Source: [Cboe September 4 penny-tick CSV](https://cdn.cboe.com/resources/us/options/market-statistics/penny-tick-type/bzx/bzx_options_rpt_penny_tick_type_20260904.csv),
linked from the [official reference directory](https://www.cboe.com/markets/us/options/market-statistics/penny-tick-types/opt).
The downloaded file has 19,656 bytes and SHA-256
`0dec1fca5ee68599a833b1dd3f0ff21a6b13b857534f119604782aa681bb5458`.
It is retained locally at
`data/runtime/options-historical-replay/source-research/bzx_options_rpt_penny_tick_type_20260904.csv`,
which `git check-ignore` confirms is ignored. This is public contract reference
data; it contains no acquired GLD/IBIT quote path and does not establish that a
chosen strike/expiry existed. The hash identifies retrieved bytes, not a publisher
digital signature.

The existing replay accepts one explicitly declared tick. It does not implement
a dynamic Penny Program schedule. A plan or observed price path crossing the $3
boundary requires additional model support; setting one cent for all prices
would not correctly enforce the reviewed quote rule.

## Sessions, holidays and settlement

**Both GLD and IBIT normally close at 16:15 ET for the reviewed session.**
Nasdaq's November 7, 2025 notice changed IBIT from 16:00 to 16:15, effective
November 10, 2025. Its current exception list includes both products with a
09:30 opening. These sources support scheduled hours, not the absence of
unscheduled halts or series-specific exceptions.
[Effective-date notice](https://www.nasdaqtrader.com/MicroNews.aspx?id=2025-52),
[Nasdaq product hours](https://www.nasdaqtrader.com/Trader.aspx?id=optionshours).

| Date | Supported treatment |
| --- | --- |
| 2026-09-04 | Normal scheduled session: 09:30-16:15 ET, or 13:30-20:15 UTC; use an exclusive close in the research model. |
| 2026-09-07 | Labor Day: closed. |
| 2026-11-27 | Early-close date; exact eligible-option/venue close needs a dated detailed rule. |
| 2026-12-24 | Early-close date; exact eligible-option/venue close needs a dated detailed rule. |

September 4's normal-day classification is an inference from weekday, product
hours and its absence from the official holiday/early-close lists.
[Nasdaq 2026 calendar](https://www.nasdaqtrader.com/Trader.aspx?id=Calendar),
[Cboe 2026 calendar](https://www.cboe.com/about/hours/us-options/).
The calendars' generic 13:00 early-close entry must not be treated as the exact
close for every ETF option: Nasdaq's detailed 2025 holiday notice distinguishes
13:00 and 13:15 schedules, and NYSE's 2026 calendar specifies 13:15 for eligible
options. A deliberately conservative research cutoff of 13:00 is a model choice,
not proof that all trading then ends. Keep the first supported date narrow.
[Nasdaq detailed 2025 precedent](https://www.nasdaqtrader.com/TraderNews.aspx?id=ETA2025-99),
[NYSE 2026 calendar](https://www.nyse.com/trade/hours-calendars).

Robinhood describes ETF and option sales as settling one trading day later,
excluding weekends and market closures. Therefore a normal September 4 sale
has a scheduled settlement date of **Tuesday, September 8, 2026**. This inference
does not confirm an individual account's settlement event or release time.
The isolated same-day replay correctly leaves proceeds unsettled.
[Robinhood T+1 settlements](https://robinhood.com/us/en/support/articles/T1-settlements/),
[Robinhood market holidays](https://robinhood.com/us/en/support/articles/stock-market-holidays/).

## Dated fee assumptions

The reviewed US fee PDF has footer version `20260831-5886092-18771991`.
For ordinary nonprofessional ETF-option orders, its schedule gives:

| Component | Published calculation |
| --- | --- |
| Commission | $0. |
| ORF and OCC combined | $0.04 per contract on each side; do not charge four cents twice. |
| SEC sale fee | $20.60 per $1 million of sale principal, rounded upward to cents; effective April 4, 2026. |
| TAF | $0.00329 per sold contract; subtotal below one cent becomes zero, otherwise nearest cent; $9.79 cap. Effective January 1, 2026. |
| CAT | $0.0003 per contract on each side; subtotal below one cent becomes zero, otherwise nearest cent. |

The October 15, 2026 professional-order fee is outside this research date.
Execution fragmentation can change rounding. No GLD/IBIT-specific surcharge
appears in the reviewed schedule; this is not an account-specific fee guarantee.
[Robinhood US fee schedule](https://cdn.robinhood.com/assets/robinhood/legal/RHF%20Fee%20Schedule.pdf).

SEC's advisory independently dates its rate change; FINRA publishes the 2026 TAF
rate. Robinhood's support article dates its combined ORF/OCC rate to January 10,
2025. The precise start date of the current CAT rate was not established here.
Limit any estimator to the reviewed September 4 date and declared single-execution
scope, with integer arithmetic and separately identified components. It should
return a research estimate and never silently replace a frozen replay fee.
[SEC advisory 2026-2](https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2),
[FINRA fee adjustment schedule](https://www.finra.org/rules-guidance/rule-filings/sr-finra-2024-019/fee-adjustment-schedule),
[Robinhood fee explanations](https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/).

## Order behavior and the simulation boundary

Robinhood documents option stop-market orders for selling to close, with new
orders available from 09:45 ET until the applicable 16:00/16:15 close. Earlier
GTC orders can execute during 09:30-09:45. That page does not establish the exact
bid/ask/last-trade trigger field or its historical rollout date.
[Robinhood option stop-market orders](https://robinhood.com/us/en/support/articles/stop-market-order-options/).

Its sell stop-limit example uses an ask-price or executed-trade condition to
trigger the limit order; execution subsequently needs an acceptable bid and
liquidity. A gap can leave the order unfilled.
[Robinhood option stop-limit orders](https://robinhood.com/us/en/support/articles/stop-limit-order-options/).
Alpha instead observes net liquidation value using sampled bid prices, then
attempts an assumed exit at a later usable snapshot. That is a separate research
mechanism. It does not reconstruct Robinhood stop-limit triggers, a broker-held
protective stop, or intraminute ordering. A target trigger also does not guarantee
a profitable later execution.

The market-order article contains an inconsistent time example: it describes a
15-minute opening delay but includes 09:35, while the FAQ uses 09:45. Retain 09:45
as a conservative operational assumption until clarified, without treating it as
a verified historical API rule.
[Robinhood option market orders](https://robinhood.com/us/en/support/articles/market-order-options/),
[options FAQ](https://robinhood.com/us/en/support/articles/options-trading-faq/).
Native option OCO/bracket availability and atomic cancellation of paired exits
were not verified in primary sources. Do not infer their absence or promise that
the system can place both protective orders safely.

## Account constraints

Robinhood states that its margin-account PDT regime changed on **June 4, 2026**:
the former $25,000 day-trading threshold was replaced by intraday margin controls.
Do not encode the old PDT rule as the current universal Robinhood rule.
[Robinhood day-trading notice](https://robinhood.com/us/en/support/articles/pattern-day-trading/).
FINRA permits other firms to phase in through October 20, 2027, so the broker's
own implementation date matters.
[FINRA Regulatory Notice 26-10](https://www.finra.org/rules-guidance/notices/26-10).

The $2,000 threshold concerns using margin leverage: FINRA explicitly allows a
smaller margin-account balance to trade without borrowing. A $1,000 balance alone
is not grounds for a blanket ban on fully paid long-option research. Actual
Robinhood approval, buying power and restrictions remain unknown.
[FINRA explanation](https://syndication.finra.org/content/understanding-new-intraday-margin-requirements).
Robinhood cash accounts cannot spend unsettled sale proceeds and do not support
Level 3 strategies or rolling. Buying calls or puts is a Level 2 capability,
subject to approval.
[Account types](https://robinhood.com/us/en/support/articles/robinhood-accounts/),
[Level 2 strategies](https://robinhood.com/us/en/support/articles/basic-options-strategies/).

## Public integration documentation checked on September 6

The [developer-documentation root](https://docs.robinhood.com/) redirects to
`/crypto/trading/`, but that does not establish that all official integrations
are crypto-only. Robinhood's current Trading MCP documentation includes these
options tools:

| Tool | Documented capability |
| --- | --- |
| `get_option_historicals` | Historical option OHLC bars over a time range. |
| `get_option_chains` | Option chain lookup. |
| `get_option_instruments` | Contracts filtered by expiration, strike or type. |
| `get_option_quotes` | Real-time option quotes. |

The same surface includes order review, placement and cancellation. The public
summary does not establish historical bid/ask sizes, quote-bar construction,
retention, sampling limits, GLD/IBIT-specific coverage or data entitlements.
Historical OHLC alone cannot replace this replay's bid/ask/size inputs.
[Official Trading MCP tool list](https://robinhood.com/us/en/support/articles/trading-with-your-agent/).

The documented endpoint is `https://agent.robinhood.com/mcp/trading`.
Authentication/onboarding connects a dedicated Agentic account; documented read
access includes all Robinhood accounts, positions, transactions and watchlists,
while trading is confined to the Agentic account. This is materially broader
than anonymous public market-data lookup.
[Official connection and access description](https://robinhood.com/us/en/support/articles/agentic-trading-overview/).
Only public documentation was read here. No connector was installed, account
created, authentication attempted, credentials accessed or account tools called.
An explicitly authorized read-only capability/schema assessment could determine
whether this official source can reduce later data-acquisition needs. It is not
yet evidence that the requested historical quote file is available or free.

## Use in Alpha

Input preparation may link a source manifest, child hash, metadata and frozen
configuration. These references support explicit assumptions; they do not
authenticate owner files or promote them to validated market evidence. Original
quote times, actual extraction/import/research times and retrospective selection
must stay separate. Contract/session/fee uncertainties remain visible even when
the package is internally consistent.

Before a real-price research attempt, the remaining dependency is an entitled
GLD/IBIT quote file plus a documented selected series and assumptions. A successful
preflight does not certify affordability, available size, account eligibility,
execution, a calibrated win probability or a profitable strategy. No quote file
was purchased or acquired as part of this reference research.
