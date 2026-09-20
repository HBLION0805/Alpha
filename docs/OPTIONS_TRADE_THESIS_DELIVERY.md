# Original trade thesis and position exit checks

September 19, 2026. The existing **Trade planner** now has **Trade thesis &
invalidation**. This is an operational connection to **Trade journal / Position
watch**, not an educational questionnaire. Existing Macro playbook remains a link.

## Use

1. Calculate the existing scenario and choose **Copy scenario to thesis plan**,
   or enter the original contract, budget, stop, target and time exit directly.
2. Choose an optional closing-entry/opening-review preference. Declare trading
   date, realization window, next manual check, event exposure and interruption
   arrangement. Times are explicit UTC with New York display/calendar checks.
3. Enable only the relevant price, numeric-event or Owner-confirmed conditions.
   Supply their basis, comparison, trigger method and missing-evidence action.
   **Save plan draft** preserves incomplete work. **Preview frozen plan**, then
   **Confirm & freeze plan**, records the unchanged snapshot before entry.
4. Record actual reported fills using the existing journal. The position check
   reads the original plan and saved market evidence on demand. Optional exit-cost
   assumptions retain their existing meaning and never become actual fees.
5. **Save evaluation snapshot** preserves the result and necessary evidence.
   Optional sourced Owner evidence can use a saved macro comparison. Explicitly
   confirm units, vintage and source; narrative judgments remain manual. Corrections
   refer to an earlier review and append a note. Reported action is separate from
   reported fill; nothing closes automatically.
   After a reported closing fill, open the trade under **Recorded positions** to
   inspect the same saved evaluations alongside the original plan and fills.

## Deterministic behavior and evidence limits

- ETF/option touch comparisons use exact money and the existing Position watch
  age policy. Option identity/size/valuation checks remain unchanged. Missing
  option bids do not block a separately valid ETF fact or time exit.
- Completed ETF closes require the existing five-minute validator, the explicitly
  selected consecutive count, completed bars and qualified conflict-free evidence.
  The current Robinhood unknown interpolation flags and four historical conflicts
  remain disqualifying. No imported source is promoted by this feature.
- Numeric event comparisons require matching event, metric/adjustment, period,
  unit, release vintage and source. The expectation's actual local freeze time
  must precede release. Current actual releases remain **Owner-confirmed**, not
  machine-authenticated. Conflicting vintage values stay unknown; no favorable
  fallback. Future receipts are excluded from earlier evaluations.
- Pending checks are distinguished from missing evidence after the check time.
  SUPPORTED is neither entry approval nor an add-on permission. A realization
  deadline calls for review; only the original independently declared exit
  thresholds establish an exit. No new percentage or duration is defaulted.
- Any independent stop/target/time/expiry/invalidation reason produces **Exit
  condition triggered — manual action required**. Saved reasons survive later
  rebounds, stale data and restarts. Unknown prices never produce a current loss.
  **Hold under original plan** requires assessable relevant checks; otherwise the
  page requests manual verification.

## Storage, compatibility and boundaries

Drafts, frozen plans and reviews use the existing hash-linked manual ledger and
its original limits. Confirmation freezes the registration, including before any
reported entry. Later reported entry clocks expose retrospective declarations;
they cannot be backdated into prospective evidence. Old plans show **Not
configured**, and their report fingerprints remain unchanged. No spread is routed
through single-leg calculations. No scheduled evaluation writes are introduced;
refresh and preview remain read-only. Stored observations are private runtime data.

The UI exposes original next check, last actual evaluation, source/receipt clocks
and coverage gaps. The timing preference neither forces daily trades nor requires
next-open liquidation. No automatic opening collection or alert is enabled.
Host V4, 09:00/15:50 schedule, source budgets, capital settings, frozen research and
the separate first natural collection acceptance remain unchanged.

## Verification

Final validation and browser receipts are recorded in
[the checkpoint](status/trade-thesis.json). All examples are isolated synthetic
records, not Owner positions, market observations or returns. No production plan,
evaluation or fill was created for acceptance. This improves original-condition
discipline and traceability; no strategy edge or profitability is established.

Implementation is a bounded cross-layer change: a condition checker, two additive
ledger commands, saved-source projection and two existing-page sections. There is
no new database, scheduler, API/model service or pricing engine. Incremental market
and model/API collection calls are zero; no paid service was added. Dollar costs
remain unverified. Actual live opening coverage remains unverified.
