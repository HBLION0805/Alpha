# Options portfolio risk diagnostics v1

Task OPT-PORTFOLIO-RISK-1. Reviewed design, September 7, 2026.
Owner authorized the next portfolio-risk module, development and Git delivery.
Use the current configured model. Complexity: medium/high; no model delegation.
Allowed scope: new portfolio contract/engine/fixtures, bounded offline CLI and
tests, package/validation registration and focused architecture/delivery docs.

## Scope and assumptions

Create a separate deterministic **declared portfolio scenario**, not a broker
account or another replay of independent historical research accounts. Inputs
must describe one complete cash-account scenario starting with $1,000 and no
external cash flows. SYNTHETIC_FIXTURE and UNVERIFIED_IMPORT remain distinct.
Unknown account mode, incomplete history, unreviewed modeled costs, unknown
high-water equity or missing event review block a favorable assessment.
All statuses remain diagnostic; execution, orders and size escalation stay off.

Preserve the original paper/feasibility engines, all accepted records and the
frozen quote window. Never auto-import historical trial balances or promote
their candidate lessons. No account tools, source refresh or host changes.

## Input and cash accounting

Recompute closed-trade reviews from existing review inputs, with a declared
exit-fee split and optional settlement declaration (settledAt, receivedAt,
reference). Entry premiums and entry fees debit settled cash. Net sale proceeds
remain unsettled until both declaration clocks are at/before assessment; time
passing or T+1 arithmetic does not create a confirmation. A declaration learned
later cannot be applied earlier. A negative net sale amount debits cash at exit.
Sort cash events chronologically, debits before credits at equal clocks, and
flag historical cash deficits; final cash alone cannot hide unfunded entries.

Open holdings contain a frozen existing-style plan/contract/initial-quote
definition, declared entry price/time and nullable current quote. Pending entry
definitions reserve premium at the limit plus both modeled fees. Do not release
reservations because a deadline passed: flag the unconfirmed order state.
Reject duplicate trade/plan IDs across closed, open, pending and candidate cases.
One definition contains exactly its initial decision quote; it is not a later
quote path. No partial fills, short options, spreads, exercise or stock holdings
are supported in this version. Declared fills are not inferred executions.

Check original costs/identity/ticks and quote origin using existing validators.
Unusable/missing/zero exit-side marks leave current equity unknown; retain cash,
unsettled receipts and full premium exposure rather than inventing a mark.
All arithmetic is bounded integer cents with BigInt intermediates.

## Aggregate gates

Retain the existing simulation assumptions: one open position or pending order,
normal 5% allocation, planned 0.5% current-equity R, $25 pre-exercise full-premium
stress limit, 1% initial-equity net daily loss and 5% high-water drawdown. Apply
the same limits to combined open/pending exposure plus a proposed new entry;
GLD and IBIT never offset each other's gross cash or risk by presumed correlation.
Candidate economics reuse the unchanged retail feasibility engine in NORMAL
mode. No claimed probability is accepted as an input.

Report original committed R and the additional loss from a current mark to the
original planned stop separately. Projected daily/drawdown capacity uses at least
the larger of these per holding. Full-premium cost and current-mark-to-zero
exposure remain separate; neither is a post-exercise worst-case guarantee.
Use New York exit dates for realized daily net PnL. Compute consecutive closed
losses descriptively; no new streak/weekly threshold or strategy rule is invented.
Group simultaneous exit clocks; mixed outcomes leave the trailing-loss count
unknown and do not create an arbitrary intermediate realized-equity peak.
Declared high-water equity is augmented by any larger known realized/current
equity, while unseen historical unrealized peaks remain unverified.

## Time and event checks

Entry definitions retain existing intraday 14-45 DTE restrictions. Expired,
expiry-day, overnight or time-exit-overdue holdings and pending deadline gaps
remain exposed and block new-entry diagnostics. Never fabricate a close,
exercise avoidance or broker liquidation. Missing actual session/holiday and
account-specific eligibility evidence remains an explicit live-use limitation.
Usable marks at/beyond the original planned stop or net R target flag an
unconfirmed exit. A favorable account total cannot conceal a reached position
exit condition. No close or settlement is invented from that flag.
Match the existing paper stop's earlier-tick rounding when its percentage price
falls between valid ticks; never widen the stop to fit the unrounded R amount.

Event review is a dated, bounded manual scenario declaration with coverage start/
end and receivedAt. Unknown/old/insufficient coverage is not an event-free window.
An INSTANT record is an explicitly declared blackout interval, not an automatic
padding around a news headline. A DATE_ONLY record keeps its original date range;
overlap with the assessment/holding interval requires review, never an invented
intraday timestamp. Scope events to GLD/IBIT explicitly. Intervals include their
boundaries. Existing BLS/FOMC journals do not silently authorize event windows.

## Delivery and acceptance

CLI supports help, a multi-case synthetic demo and one bounded local JSON input,
plus optional exclusive saved reports in a new ignored portfolio directory.
Save exact input/report, actual recording time and checksums; verify by
recomputing in a new process. No old journal append or account transition occurs.
Unknown/missing evidence and normal risk rejections are explicit results;
malformed inputs, links, corrupt artifacts and unsupported commands fail safely.

Test cash settlement equality/delayed receipt/weekends, chronology, duplicate
receipts and IDs, fees and integer bounds, open/pending aggregation, loss/drawdown
boundaries, unknown/stale/zero-size marks, expiry and time exits, event precision,
New York dates, origin isolation, no authority, file immutability and restart.
Run focused tests, typecheck and aggregate validation; preserve original runtime
and actual host hashes. Save a delivery report before the authorized commit/push.
