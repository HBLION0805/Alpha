# Candidate checks v1

Task OPT-CANDIDATE-CHECKS-1. Owner approved continued development on September 8,
2026. Implement the module and English frontend together. This unit composes
the existing daily-guidance and retail-feasibility engines without changing
their policies, outputs, source collectors, schedules or immutable records.

## Reviewed scope

Expose every sampled GLD/IBIT candidate through grouped checks: captured scope,
session, contract, quote clocks, prices/spread, size, delta, trend/news, calendar,
declared costs, allocation, planned loss, full-premium stress, reward and declared
cash. Preserve every original blocker. A passed check means only that the named
local condition passed; unknown costs, incomplete evidence and hard rejections
remain distinct. Never use a percentage score or aggregate pass count as a win
probability. The existing 14–45 DTE, 5% allocation and independent risk caps stay.

Show exact original economics, source/receipt/assessment clocks and next actions.
Support asset and premium-budget filters, retaining excluded counts and an empty
result explanation. Premium-only affordability is not all-in feasibility. Read
costs from the existing explicit planning-assumption workflow; never default
missing fees/slippage to zero or silently save an unfinished cost draft.

The pure projection lives independently of Guidance v1 so old recommendation
fingerprints remain reproducible. Saved check snapshots copy the normalized
guidance input and source-path references, bind the original guidance output,
and recompute independently after restart. These references are lineage, not
authentication of a provider or proof of fills. Original raw captures stay intact.
Saving checks is an explicit same-origin local action; GET never writes a record.
No candidate-check record authorizes the Robinhood paper adapter. Independent
side/size timing, full series/session evidence, source-use evidence and a reviewed
execution model remain unresolved. Account values and costs remain declarations.

## Acceptance

Exercise affordable-but-over-risk cases, unknown/zero costs, spread consuming the
stop, missing prices/sizes/clocks, event waits, insufficient trend, absent candidates
and all-original-blocker preservation. Test independent restart recomputation,
tampering even after rehash, future clocks, unsafe paths/links, read-only HTTP,
protected snapshot saves, frontend filters, escaped text and draft preservation.
Run strict typecheck, focused/dependency tests, aggregate validation and desktop/
phone browser checks. Save actual-data evidence with its actual assessment clock;
stale/off-hours observations must remain blocked. Do not count a blocked review
as an entry-to-exit run or advance any of the three open real-price gates.

This is the first unit of the approved real-price paper-flow work. Enable a
source-specific paper path only after its separate evidence requirements pass;
the current unit makes those limitations reviewable rather than overriding them.
