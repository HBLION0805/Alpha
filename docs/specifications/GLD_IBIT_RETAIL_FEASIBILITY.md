# GLD / IBIT Retail Options Feasibility v1

## Owner request and scope

On 2026-09-06 the Owner restricted the intended trading universe to GLD and
IBIT options on Robinhood, with initial equity of USD 1,000. The Owner explicitly
authorized development, saving, committing and pushing without another approval.
This supersedes earlier development publication restrictions for this work. It
does not authorize account access or trading execution.

Requested normal allocation is at most 5% of current equity. The Owner clarified
that the planned stop is **2% of the position's premium**, not 2% of account equity.
At USD 50 premium this is USD 1. The normal profit target is 50% of entry premium.
Requested conditional allocation is 10% when win probability exceeds 80%, with
a profit target no higher than 80%. Holding longer requires a new, explicit
thesis/time review; confidence alone never extends an option's useful life.

These are requested scenario parameters, not validated profitable rules. No
existing Alpha confidence score or Robinhood expiry probability establishes the
probability of reaching this profit target before the stop or time exit. The
conditional allocation path remains blocked until independent, cost-aware,
out-of-sample GLD/IBIT option-outcome evidence is implemented and reviewed.

## Reviewed implementation design

Implement a pure deterministic, offline feasibility diagnostic, with no network,
credentials, brokerage orders, persistence authority, or trading permission.
It supports standard, integer-quantity, 100-share long calls and long puts only.
Other previously allowed structures remain future work; a debit spread requires
verified Level 3 eligibility and assignment/expiration handling. A manually
entered price is a scenario, never a verified market quote.

Contract inputs: symbol, strategy, current equity and settled cash in cents,
positive integer quantity, standard multiplier, bid/ask and minimum price tick
in cents per share, nonnegative round-trip fees and slippage reserve in cents
(each may explicitly be unknown), normal or conditional mode, target in basis
points, and optional claimed win probability. Reject unknown fields, unsupported
symbols/strategies/multipliers, crossed/negative quotes, noninteger quantities,
off-tick quotes, nonfinite/unsafe integers and arithmetic overflow. Do not invent
account type, permission level, trading session or fee values.

Use integer/BigInt arithmetic and conservative rounding:

- Allocation budget: floor(current equity * 5%); show 10% only as a blocked
  conditional scenario, never an effective approved allocation.
- Premium: ask * 100 * quantity. Capital required includes the explicit fee
  reserve. If this exceeds budget or settled cash, report a blocker.
  Assume a limit entry at the supplied ask with no entry slippage; the slippage
  reserve covers exit only. This assumption is not a prediction of a fill.
- Planned stop: floor(premium * 2%). This is a requested threshold, not a loss cap.
- Profit target: ceil(premium * requested target). Normal target is 50%; a
  conditional target may range from 50% through 80%. This is gross of exit costs;
  disclose the corresponding net gain after round-trip fees and slippage reserve.
  These dollar thresholds are not executable order prices; a future order plan
  must respect the contract's price grid. The 80% ceiling limits the configured
  target, not the actual realized gain or loss.
- Immediate liquidation friction: (ask - bid) * 100 * quantity + fees + slippage.
  Unknown fees/slippage block assessment. Zero explicitly means an assumed zero
  scenario, not a verified zero-cost broker. Require friction strictly below the
  planned stop and at least one full price tick of remaining stop capacity;
  otherwise report STOP_BUDGET_NOT_EXECUTABLE. No market quote alone proves an
  eventual stop fill or a safe trade.
- Stress loss for the long-option premium before exercise: full premium + fees;
  never substitute the planned stop. This excludes stock exposure from exercise;
  exercise handling must be independently checked before any real trade.
- Report the legacy recorded USD 25 normal / USD 12.50 event maximum-loss caps
  as a separate constraint. The Owner has not explicitly replaced these caps.
  The diagnostic conservatively applies the normal USD 25 cap; event mode remains
  unsupported. A USD 50 debit conflicts with that cap even if its stop is USD 1.
- Claimed probability, even 100%, cannot authorize 10% allocation or change risk.

All returned objects are deeply immutable. Return descriptive economic checks
and blockers with `executionAllowed: false` and `evidenceOrigin: MANUAL_SCENARIO`.
The most favorable result is ECONOMICALLY_FEASIBLE_SCENARIO, not TRADE_APPROVED.
Broker permissions, real-time executable liquidity, option-chain provenance,
expiration/assignment, aggregate open risk and calibrated outcomes remain
explicitly unverified. All blockers produce NO_TRADE.

## Validation

Test the exact USD 1,000 / USD 50 / USD 1 example; bid 0.47 and ask 0.50 means
USD 3 immediate spread loss for one contract. Test the USD 25 legacy stress cap,
USD 100 / USD 2 conditional scenario, unsupported assets/fractional contracts,
unknown costs, tick/rounding edges, settlement shortfall, overflow, immutability,
the 80% target ceiling, and that every claimed probability leaves escalation
blocked. Independent design review identified a mathematical incompatibility:
the USD 25 stress cap implies a stop no greater than USD 0.50, while the smallest
whole-cent quote tick on one standard contract costs USD 1. Consequently no
scenario under this unchanged combination can pass. Test and disclose this
incompatibility; never manufacture a passing example by weakening the rules.
Register these tests and command-level regressions in the validation bundle.

## Product completion gates

This diagnostic does not complete the trading system. Remaining work includes
GLD/IBIT underlying-specific calendars and evidence, verified option chains with
contract metadata and executable bid/ask sizes, IV/Greeks/skew/term structure,
six-dimensional trade theses, deterministic account/portfolio risk enforcement,
account-eligible structure comparison and time exits, a persistent paper journal,
cost-aware path replay, and out-of-sample outcome calibration. QQQ Phase 2
fixtures remain benchmark tests and cannot represent GLD/IBIT or their options.
