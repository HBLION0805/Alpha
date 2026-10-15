# Declared options structure comparison v1

Task OPT-STRUCTURE-COMPARE-1. Reviewed design, September 7, 2026.
Owner continuation follows declared portfolio diagnostics. Use the current
configured model; no delegation. Complexity: medium/high. Scope: new typed
input, deterministic engine/fixtures, bounded offline CLI/tests and delivery
docs. Preserve original engines, portfolios, journals, host and frozen studies.

## Product boundary

Compare declared alternatives, not recommended orders: LONG_CALL, LONG_PUT,
BULL_CALL_DEBIT, BEAR_PUT_DEBIT, BULL_PUT_CREDIT, BEAR_CALL_CREDIT, LONG_STRADDLE
and LONG_STRANGLE. One request contains 1-16 candidates for one GLD/IBIT symbol,
one expiry and one declared underlying reference price, with 1-41 terminal
prices. It represents a separate $1,000 scenario, never the user's live balance.
Each candidate has 1-2 legs, the same whole-contract quantity on each leg,
standard 100-share American contracts and declared entry/exit fees and exit
slippage reserve. No naked short, ratio, calendar, stock or mixed-ETF structure.
Identify the structure from legs and reject a conflicting label.

Use existing contract/quote validation and simulation freshness checks. Missing
quotes, future receipts, stale/closed quotes, insufficient entry or closing-side
size and inconsistent cross-leg observed clocks/reference prices prevent numeric
economic assessment. All legs must use the request origin; each alternative
must use one source ID and consistent observed clocks across its own legs.
Equal declared clocks do not prove simultaneous executable basket liquidity.
14-45 DTE remains the current research window. Synthetic future scenario clocks
are allowed; actual report recording times remain separate and never backdated.

## Arithmetic and interpretation

Entry uses asks for buys and bids for sells. Immediate liquidation uses bids
for longs and asks to repurchase shorts. This is a quoted scenario, not a fill.
Sum position quantities with multiplier 100 and BigInt intermediate arithmetic.
Unknown fees/reserves or missing reference keep net economics unknown. Explicit
zero costs require a reference and remain an assumption.

At every nonnegative terminal underlying price, sum signed intrinsic values
and subtract net entry debit plus declared round-trip fees/slippage reserve.
This is a terminal intrinsic-value model with a cost reserve, not a mark before
expiry or an exercise/assignment simulation. Evaluate zero, all strikes and
the right-tail slope to determine extrema; a finite display grid cannot bound
an unbounded call upside. Expose signed minimum/maximum PnL, nonnegative maximum
loss/gain and exact rational break-even prices; retain zero-PnL intervals.
Roots below zero are excluded. Do not round fractional-cent roots into targets.
Debit/credit price signs or vertical premiums outside (0, strike width) are
flagged as anomalous economics, not a free-profit opportunity.

Show gross long premium, short credit, net opening cash, current quoted closing
value, immediate liquidation friction and modeled terminal risk reserve.
Compare that reserve with the existing $50 normal allocation and $25 stress
benchmarks and optional declared available settled cash. These are comparison
diagnostics, not broker collateral requirements or bounds on intermediate
exposure. Short-leg strike notionals are disclosed separately, not presented
as a maximum possible assignment loss. Broker collateral and eligibility stay
unknown. Naked shorts and a separately legged execution are unsupported.

For single long options only, compose unchanged retail feasibility in NORMAL
mode with the existing unvalidated 20% stop and 2R research assumptions.
For multi-leg alternatives, planned stop/R, pre-expiry prices, stop execution,
portfolio integration and lifecycle support remain unimplemented. Do not apply
a debit-premium stop to a credit spread or change old portfolio risk gates.
No ranking, preferred candidate, allocation escalation, win probability,
calibration, news-based trade signal or strategy approval is produced.

## Persistence, tests and acceptance

CLI: --demo [--save <new-id>], --input <workspace-json> [--save <new-id>],
--verify <saved-id>, --help. Use a new ignored directory, existing bounded safe
I/O, strict UTF-8/duplicate-key/depth checks, exclusive artifacts and exact
recomputation in a separate process. No active journal writes, HTTP, quote tool,
account tool, scheduler change or order. Preserve input and report clocks and
source hashes. Readable English comparison text retains all candidate blockers.

Test all eight structures on both ETFs; bounded versus unbounded tails,
fractional roots, zero intervals, unavailable costs, quote clocks and sizes,
wrong identities/origins/labels, mixed expiries, ratio/naked shorts, fee erosion,
credit collateral interpretation, missing cash, negative premium anomalies,
quantity scaling and independent direct-payoff checks. Exercise corrupt/rehash
modified artifacts, links, duplicate JSON keys, bounds, immutability, no network
or source writes and restart. Run typecheck and full validation after focused
checks. Retain original runtime/host hashes and document measured outcomes.

## Primary references inspected for this design

Public pages inspected September 7, 2026. No actual account eligibility or quote
was read, and no dated fee assumption was updated.

- [OIC bull call spread](https://www.optionseducation.org/strategies/all-strategies/bull-call-spread-debit-call-spread): equal expiry, ordered call strikes, capped terminal profit and expiry/assignment caveats.
- [OIC bear put spread](https://www.optionseducation.org/strategies/all-strategies/bear-put-spread): long higher-strike and short lower-strike puts.
- [OIC long straddle](https://www.optionseducation.org/strategies/all-strategies/long-straddle): two purchased premiums, time/volatility dependence and asymmetric domain bound at zero.
- [OIC long strangle](https://www.optionseducation.org/strategies/all-strategies/long-strangle-long-combination): lower put and higher call strikes.
- [Robinhood collateral](https://robinhood.com/us/en/support/articles/360001227606/): credit-spread collateral and pending reservations are distinct from premium receipts.
- [Robinhood advanced strategies](https://robinhood.com/us/en/support/articles/advanced-options-strategies/): multi-leg mechanics do not establish this user's permissions or guarantee a complete combined exit.
