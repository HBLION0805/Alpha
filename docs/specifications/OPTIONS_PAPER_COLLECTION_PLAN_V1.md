# Paper plan and collection timing

Task: connect the next prospective paper rehearsal to the existing capture times.
The paper form still advertises cancelled morning/midday reads. One ordinary
15:50 capture cannot supply both an entry and a later independent time exit.

Use the dated guidance schedule and reviewed paper session with the current saved
BLS/FOMC calendar to compare a validated plan with nominal Host wakes. Preserve
the distinction between routine reads and event-day conditional reads. Only major
events whose saved dates include the plan date support the conditional branch;
the daily guidance event wait period is not the collection condition. Retain
date-only events as date-only. Missing/overdue calendar evidence stays unconfirmed.

List New York and UTC clocks, nominal entry wakes, later time-exit wakes and a
distinct ordered pair when one exists. A wake at the decision boundary is not
proof of an eligible quote; receipt/source clocks still belong to the fill engine.
The 16:20 full-chain study is not an input to this adapter and must not be counted
as a paper exit. Holidays, early closes, DST and pre/post schedule-change dates
use existing deterministic calendar/schedule policy. Unknown years stay blocked.

This is a planning comparison, not a scheduler, new trading gate or a guarantee
of delivery. Sparse paths can miss stops/targets. Enrollment, six-ID priority,
quotes, costs and actual source eligibility remain separate checks. Manual paper
registration/enrollment and all frozen reports keep their original semantics.
Expose the comparison in a new read-only CLI preview, the existing frontend
preview and frozen-plan display. Never change canonical saved paper reports.

After tests, prepare a new explicitly labeled engineering rehearsal only if a
future entry and later exit are covered by the existing schedule. Freeze all
assumptions before its window; no trade recommendation or real order is implied.
The former September 10 NO_ENTRY result and source cutoffs remain immutable.

Acceptance: single-wake gap, valid distinct pair, conditional event date versus
wait period, unknown/overdue calendars, exact boundaries, holiday/early-close/DST,
unchanged old report recovery, protected API and matching escaped English UI.
Production activation must record actual registration/enrollment/tracking and
zero modeled fills initially. No price is backfilled and no real-price gate passes.
