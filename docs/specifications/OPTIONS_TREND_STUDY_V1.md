# Prospective ETF trend study V1

Owner approved September 17, 2026: freeze a trend-entry/contract-selection rule,
record future signals and independent outcomes, and improve quality/exit checks.
Task TREND-STUDY-01; current model; high reasoning; bounded research development.
This is an untested research protocol, not approved trading knowledge or a new
canonical recommendation. No capital setting, source recurrence, account or order
authority changes. Existing engineering rehearsals remain complete.

## Frozen experiment

Register one immutable cohort before its first regular session, for the next 20
reviewed trading sessions. Server supplies the registration clock. Freeze current
declared settings and a versioned rule object. Record both GLD and IBIT every day,
including missing observations, rejected candidates and no entry. No historical
enrollment, retroactive fills, parameter tuning in place or minimum trade quota.

Use regular-session five-minute traded-ETF bars. The 09:30–10:30 baseline supplies
12-bar/3-bar close means, mean share volume and the final six-bar high/low range.
Require trend alignment and two consecutive closes beyond that fixed range plus
10 bps, with second-bar volume at least 1.2 times baseline mean. Both closes must
stay within 50 bps of the trigger. First qualifying pair per ETF/day is the only
opportunity; do not select a later winner after an earlier blocked match. Entry
decision window 10:40–14:30 New York; early closes shorten it to 70 minutes before
close. Time exit is 20 minutes before regular close (normally 15:40).

The first received source with a full baseline freezes it for the session. Later
changes to overlapping baseline or trigger bars are conflicts, not replacements.
Unknown interpolation permits a labeled shadow pattern observation but blocks
paper enrollment. Structural errors, explicit interpolation, missing intervals,
matching audit conflicts and late receipts block entry. No source gets qualified
by this feature. Latest completed trigger must be received/processed within 60
seconds, and decisions may use only evidence actually stored by their clock.

## Contracts and outcome model

At most one long-option paper opportunity per ETF/day; calls for bullish, puts for
bearish. Same-side sampled contracts only: 14–45 calendar DTE, absolute delta
0.35–0.70 with correct sign, one contract, unchanged allocation range, positive
bid/ask and displayed size, exact ticks, spread <=10% of ask and <=$0.10/share.
Rank by distance to absolute delta 0.50, expiry distance to 21 DTE, spread and ID.
Require a fresh paired ETF/option observation at or after the signal bar close and
received before the decision. A quote preceding that close cannot select a plan.
Preserve every candidate rejection; no winner means no entry, not a losing trade.

Freeze a separate snapshot-paper V3 plan using existing cost/economics/replay code.
Keep saved stop/reward assumptions (currently 20% / net 2R), one-tick exit allowance
and explicitly dated nonprofessional fee illustration. Global unknown actual fees
remain unknown. The selection quote is never an entry fill: only a later source
update, within five minutes and no worse than the frozen ask limit, may model it.
Later independent bid quotes drive stop, net target and time exit. No ETF-bar
high/low or premium interpolation can stand in for a missing quote. ETF range
failure is recorded as a research warning; the modeled exit remains the frozen
premium/time policy. Historical engineering enrollments and journals are untouched.

## Recording, monitoring and frontend

Append-only registration and per-day copied-input reports in an ignored private
store; independently verify hashes and deterministic recomputation. Persist the
first decision, its copied source and plan. Subsequent reports add independent
outcomes without rewriting that decision. Bound file/catalog sizes; reject
concurrent conflicting writes. Read-only views never mutate evidence.

An offline pass on the existing local service tick and before guidance publication
consumes saved evidence only. No new network call, timer, broker tracking expansion
or automation is added. Repeated unchanged input is idempotent. Missed sessions
remain missing after restart; late historical data cannot repair a missed entry.
Expose actual last receipt, overdue exit, unobserved intervals, candidate lessons
and signal/entry/closed counts, separately for each ETF. Results stay estimated,
source-unqualified and not evidence of a validated win probability. Existing sparse
collection cannot satisfy this intraday protocol; show the collection gap explicitly.

## Acceptance

Test registration/calendar boundaries, prospective-only clocks, fixed baseline,
two-close direction/volume/chase, unknown/interpolated/missing/conflicting bars,
late signal/no backfill, deterministic contract rejection/ranking, copied recovery,
repeat-pass idempotency, independent entry/exit, missing bid/time exit/monitor gaps,
restart persistence and escaped English desktop/mobile UI. Run dependency suites,
typecheck and aggregate validation. Freeze a real future cohort with zero invented
signals or fills. Report remaining source/cadence limitations plainly.
