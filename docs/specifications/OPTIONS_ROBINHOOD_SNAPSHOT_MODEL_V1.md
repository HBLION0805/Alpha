# Robinhood hypothetical snapshot model v1

OPT-RH-SNAPSHOT-MODEL-1. September 7, 2026. Design and arithmetic review only.
Current configured model; no delegation. Scope: one independent GLD/IBIT long
call or long put case, using saved opening observations after their review.
Expected work: one bounded development unit. Allowed changes: this specification,
delivery/checkpoint and current handoff/roadmap/progress links. No executable
adapter, source refresh, active case, account lookup or order is added here.

## Purpose and prerequisites

Define one reproducible hypothetical fill policy before source-specific code.
The [qualification specification](OPTIONS_ROBINHOOD_PAPER_QUALIFICATION_V1.md)
and [source-use assessment](../OPTIONS_ROBINHOOD_SOURCE_USE_REVIEW.md) still
apply. This document does not establish any missing source or account evidence.
All original engines, journals, limits, source clocks and reports remain intact.

The first proposed mode is RETROSPECTIVE_RECEIPT_SNAPSHOT_RESEARCH. A research
plan selected after viewing a path retains its actual registration clock and a
separate declared decision time on the original capture receipt timeline. It
never becomes a prior real decision. Prospective operation needs a separately
reviewed mode and earlier recorded plan; no mode toggle can certify it here.

Before implementation, inspect the completed frozen study through its original
readers, following restore-v6-before-evidence ordering. Retain every attempt,
excluded frame and blocker. Complete collection is not source qualification.
Use an isolated $1,000 hypothetical account per case and do not compound cases
or append to the existing paper/research account histories.

## Input and timing policy

The future input binds the immutable study/contract, original capture/frame
hashes, loaded-schema hash, source profile version, declared plan, cost references
and actual research recording time. It must carry exact source nanoseconds,
request/receipt/recording clocks and raw decimal lineage outside the legacy
millisecond quote type. No Robinhood-to-Cboe relabeling or lossy precision mapping.

Use the original collection sequence as evidence order; validate clocks without
sorting conflicts into a plausible path. Filter only a declared selected contract
and interval, retaining every exclusion. No observations outside the frozen
window or declared regular session can create modeled events/fills. Require
window start <= decision < entry deadline < time exit < window/session end.
Interval end is exclusive. Distinct source events within one millisecond must remain distinct;
if a downstream model cannot express them, report UNSUPPORTED_PRECISION.

A baseline must have been received by the declared decision time. Each usable
entry candidate must be a different snapshot, received strictly after that time
and before the frozen entry deadline, with a strictly newer source refresh clock
than both baseline and declared decision time. A delayed pre-decision quote
cannot supply a later modeled fill merely because it arrived later. Preserve
original source freshness and underlying-alignment checks at receipt.

Missing, repeated, regressed and conflicting clocks retain their original reasons.
The shared refresh clock cannot establish independent option-side/size event
times. Known missing timestamps cannot be replaced with request time. A complete
60-second polling cadence does not reveal intervening prices or queue events.

## Entry and economics

Require explicit standard contract/session evidence, integer contracts, exact
integer-cent prices on the declared tick and coherent positive bid/ask. Entry
requires both displayed sizes to cover the full quantity, sufficient spread and
the unchanged retail feasibility engine. Partial fills are unsupported; do not
split quantity or infer liquidity from volume, mark, OHLC or interpolation.

Freeze the entry limit and full round-trip fee reserve before evaluation. On a
later eligible snapshot, ask at or below the limit supplies an ASSUMED_FILL at
that ask, with no modeled entry slippage. Recompute feasibility using that ask
and bid before consuming cash. This is a limit-style displayed-quote assumption,
not proof the market would fill it. Ask above limit or failed economics retains
an unfilled attempt; it does not select a cheaper replacement contract.

Use the original feasibility result for capital, full-premium stress, planned R,
target and costs. Costs must be explicit; zero remains a declared scenario,
never an inferred fee waiver. Retain normal 5% allocation, 0.5% planned cash risk,
the separate $25 full-premium stress ceiling, 10%-25% research stop range,
1.5R-2R net target range and the existing target cap. These are existing software
assumptions, not new investment advice or permission to raise risk. Conditional
10% sizing remains blocked regardless of a caller's claimed probability.

At the modeled fill, recompute R/target using actual assumed ask and frozen plan
parameters. Reserve exit fees and retain the immutable pre-fill reservation
calculation. Recalculation cannot change the stop percentage or requested R.

## Trigger and later-fill state machine

States: BLOCKED, NO_ENTRY, ENTRY_PENDING, OPEN, EXIT_PENDING, CLOSED. A fill
requires valid prerequisites; BLOCKED is not NO_ENTRY and neither is a winner.
Preserve a pending entry/reservation when evidence ends before its deadline.
Once the supported evaluation horizon reaches the entry deadline, record no
entry and release the reservation; never use the later research recording clock
to manufacture historical deadline coverage.

After entry, define the premium stop bid as
`ceil(ask * (10000 - stopLossBps) / (10000 * tick)) * tick` using exact integer
arithmetic. This adopts the existing paper engine's earlier tick-rounded stop;
it can trigger before mathematical full R is lost. Planned R remains the
unchanged all-in feasibility denominator, not a promised maximum loss.

For an otherwise usable observed bid, hypothetical net liquidation value is
`max(0, bid - exitSlippage) * quantity * 100 - entryPremium - entryFee - exitFee`.
Slippage is adverse, nonnegative and on tick; the zero floor is a declared model
assumption, not an observed zero-price execution. Fees are charged exactly once.
Use that value for the net target comparison. A known zero bid may indicate a
stop, but zero/missing/insufficient size cannot supply an assumed exit fill.

The entry snapshot cannot trigger or fill an exit. At a subsequent received
snapshot: preserve an existing exit reason first; otherwise a reached time exit
takes precedence, then the premium stop, then net target. Freeze the first
reason. Stop/target comparisons can trigger on a valid bid with insufficient
size, but execution remains pending. A time threshold needs no fabricated bid;
record its scheduled threshold separately from when it was first recognized.

**No trigger snapshot can supply its own exit fill.** Require another snapshot
with both a strictly later receipt and a strictly newer source refresh clock
than the trigger observation, and source refresh strictly after trigger recognition
time on the receipt timeline. The same recognition-time condition applies to a
time trigger without a quote. Delayed pre-trigger refreshes cannot become later
fills merely by arriving afterward. Exit requires
a positive valid on-tick bid and full displayed bid size, passing the retained
source quality/alignment checks. A missing ask is usable only if the original
validated source profile explicitly supports it; no parser relaxation occurs.

The first such later snapshot supplies bid minus modeled slippage. A target
reason stays TARGET even if the later fill loses money. A stop fill can exceed
planned R. Time exits do not authorize out-of-session fills. If no later usable
snapshot exists, preserve EXIT_PENDING, exposure and missing mark; do not force
liquidation at the last price, window end or expiration.

## Gaps, accounting and review

Record missing requests separately from failed responses and unusable observations.
An entry waits through gaps only until its fixed deadline; an already open case
can recognize a later observed threshold but cannot reconstruct whether a stop
or target happened first inside the gap. Retain this path uncertainty even if a
later hypothetical exit can be computed. No interpolation, inferred high/low
crossing or overnight extension fills the missing information.

The selected evidence horizon is independent of actual research recording time.
At its end, pending states remain pending unless a scheduled deadline is covered.
Unknown final marks produce unknown equity, not zero exposure. At a modeled
exit, debit exit fees from cash, credit proceeds as unsettled, release the fee
reservation and reconcile total cash to initial equity plus net PnL. Do not
settle proceeds automatically or reuse them in another independent case.

Retain all cases and original model events in a future separate immutable store.
Closed cases need a recomputed review at actual research time; no-entry and
unresolved cases retain diagnostics without fake realized PnL. Candidate lessons
must distinguish source failure, model assumption, risk exclusion and observed
path. A single case does not establish causal strategy failure, approved knowledge,
calibrated win rate or permission to size up. Recovery must recheck every original
dependency and recompute arithmetic before declaring the saved result intact.

## Review examples and implementation acceptance

Synthetic arithmetic only, with one 100-share contract, ask $0.18, bid $0.17,
$0.10 fee per side, $0.01/share exit slippage, 20% premium stop, 1.5R target and
$0.01 tick: original feasibility gives $18.20 capital, $4.80 planned R and $7.20
net target. The proposed stop bid rounds to $0.15. A later $0.27 bid would show
$7.80 net and trigger TARGET; a following $0.17 bid would model a $2.20 loss.
A stop trigger followed by a $0.11 bid would model an $8.20 loss. Neither is a
guaranteed outcome, a strategy recommendation or a test of Robinhood fills.

Implementation acceptance must cover: both symbols/types; missing prerequisites;
exact source precision; repeated/conflicting/regressed clocks; delayed baseline;
entry at deadline; limit improvement and risk recalculation; unsupported partial
size; wide spread/cost exclusion; zero bid; trigger without size; time trigger
through gaps; distinct later fill; target reversal; stop loss beyond R; no later
quote; unresolved mark; receipt/source clock divergence; horizon before deadline;
out-of-session data; immutable dependency recovery; cash/fee reconciliation and
all-disposition review. Synthetic tests can validate code only.

Design review compared the existing paper engine, interval research engine and
retail feasibility contract. They have different timing semantics; this new
profile may not silently change either engine or reuse an old engine identifier.
Actual eligible-series review is still required before the source adapter. If
no further independent work is useful beforehand, use the existing waiting
phase and continue requested quarter-hour overall-progress reports.
