# Isolated CDS / PDS MOCK lifecycle

The existing structure comparator already inferred debit verticals and calculated
long-ask/short-bid opening cost, long-bid/short-ask liquidation value and exact
terminal payoffs. It did not carry positions between observations. This delivery
reuses that arithmetic and the single-leg MOCK journal rather than treating two
independent single-leg fills as a spread.

Supported scope is one equal-quantity pair of standard 100-share American calls
(CDS / BULL_CALL_DEBIT: lower long strike, higher short strike), or puts
(PDS / BEAR_PUT_DEBIT: higher long strike, lower short strike), on the same AAPL,
TSM, QQQ or TSLA symbol and expiry. The frozen plan and every later event must be
synthetic. An eligible existing trial-research opinion must agree with the
direction. This is a fixture handoff, not fresh investment research or a change
to real candidate admission.

The execution model is explicitly `ATOMIC_TWO_LEG_ASSUMPTION`. Entry records
BUY_TO_OPEN at the long ask and SELL_TO_OPEN at the short bid, simultaneously.
Exit records SELL_TO_CLOSE at the long bid minus declared adverse slippage and
BUY_TO_CLOSE at the short ask plus slippage, rounded adversely to each tick.
Actual modeled slippage and fees are recorded per leg. Last prices and midpoints
are never substitutes. Atomic fills and net-debit funding are model assumptions,
not statements about broker complex-order handling or guaranteed combined liquidity.

Both exact identities, source refresh times, receipt times and underlying
observations must align. Both legs must pass the existing quote/session checks;
entry also preserves the existing bounded spread checks and requires opening and
closing size. Unknown MOCK permission, entitlement, funds, risk limits or fees
block entry. Short credit is netted only within the atomic opening transaction;
it does not replenish settled cash or release unrelated reservations. Positive
closing proceeds stay unsettled, and a cash-consuming close cannot overdraw cash.

The existing terminal-payoff engine calculates maximum loss from the net debit
and declared cost reserve. That terminal figure does not cap an adverse early
close, legging, assignment or stock exposure. A modeled early-close loss exceeding
it remains visible. It is neither an execution guarantee nor a real account limit.

The minimal exit scope is frozen same-day time exit or an explicit MOCK close
request. A close request remains pending across missing quotes or liquidity.
No new multi-leg stop/target strategy is introduced. The existing seven-minute
engineering window is reused; it is not a market-study horizon. Expiry-day plans,
cross-day closes, calendar spreads, naked shorts, ratios, scaling, exercise and
assignment are unsupported. Missing quotes retain both modeled legs and unknown
P&L; time passing alone cannot create a close.

Partial-fill or single-leg-fill reports are retained as immutable events and
latch `BLOCKED_UNSUPPORTED_RESIDUAL`. Known modeled positions remain visible and
residual exposure is `UNKNOWN_NOT_CLEARED`. Subsequent full quote pairs cannot
fabricate a balanced fill or clear that state. This is auditable rejection of an
unsupported path, not a residual-position resolution algorithm.

`npm run options:tech-mock-spread -- --help` shows start, append and recovery
commands. Each run uses ignored `data/runtime/options-workbench-development/mock-*`
storage. The extracted shared journal preserves single-leg formats, original
input, event order/hashes, idempotency, actual recording clocks and simulated
source clocks. Complete events publish exclusively after fsync; interrupted
publication and a fresh process recover the same two-leg state. No production
store, source collector, account, CPI workspace, schedule or challenge ledger is
accessed. Runtime originals stay local and ignored.

Focused tests exercise both structures across four symbols, contract/quantity
rejection, independent unknown gates, cash/terminal-risk arithmetic, wrong-side
liquidity, stale/asynchronous/missing quotes, close latching, unsupported residuals,
crashes and duplicate/conflicting retries, tamper rejection, and process restart.
The former single-leg cases remain in the exact full validation combination.
Final counts are in [the checkpoint](status/tech-mock-spreads.json).

Real-price acceptance remains NOT_TESTED. A later increment may define a separate
residual-position reconciliation model; it must preserve this unsupported state
and cannot be inferred from these atomic synthetic examples. Live multi-leg
permission, funding and qualified quote acquisition require separate evidence.
