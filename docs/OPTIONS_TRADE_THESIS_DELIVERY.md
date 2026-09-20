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

## September 20: plan-specific major-event waiting

The original `MAJOR_EVENT_WAIT` blocks candidates from 24 hours before a timed
major release through the first 30 minutes afterwards. Date-only entries retain
their existing conservative behavior. It protects against release uncertainty,
repricing and gaps, but previously had no plan-specific event-exposure exception.
It did not prevent saving a research draft; it prevented that draft's eventual
pre-event candidate comparison from proceeding even after explicit preparation.

**Trade planner / Trade thesis & invalidation / Event approach** now offers
Pre-event anticipation and Post-event confirmation. The implementation reuses
the existing thesis, event condition, `holdThroughEvent`, realization/check times,
stop, target, latest exit, manual fallback, ledger freeze and plan fingerprint.
An optional entry-confirmation attachment records the remaining event-reference,
expectation-or-explicit-absence, differing-basis, scenario and risk acknowledgments.
The existing paper `PRE_EVENT` phase exits before release and is not repurposed
as hold-through permission. There is no second exit engine or new overall state.

No mode and POST_EVENT keep the original wait. Drafts stay saveable, with specific
missing-condition explanations rather than a claim that all pre-event trading
is forbidden. A legacy draft's existing hold/date combination can describe its
research intent on screen; it never grants permission or writes a migration.
`PRE_EVENT_MODE_NOT_CONFIRMED` means the structured formal entry confirmation is
absent, not that an already recorded research-path preference was revoked.

Only a complete, explicitly frozen pre-entry and pre-release plan can remove the
selected event's wait for its exact contract. The current saved calendar must
still identify that release at the same time with usable receipt clocks; changed,
unknown or unavailable timing fails closed. Other major events, other contracts,
quote freshness, costs, source and allocation gates remain independent. Text
completeness does not authenticate prose, establish an edge or turn Owner evidence
into machine-verified facts. No thresholds or risk acknowledgments are supplied.

In **Daily guidance / Candidate checks**, choose **Check saved plan**. The existing
protected local interface resolves the saved key and version itself, reads saved
evidence and shows a separate, read-only comparison. It neither replaces ordinary
issued guidance nor creates a trade, quote refresh or saved check snapshot.
The eligible comparison prominently retains event exposure, accepted gap risk and
the impossibility of stop execution while the option market is closed. All
original independent exits remain in force. Publication fact review and tradable
option-price review remain separate; no opening fill or monitoring is promised.

The existing real research draft was read through this path without modifying it:
PRE_EVENT research intent, DRAFT, not eligible, missing formal confirmations,
contract/quantity/cost and complete independent exit parameters. Historical
versions, source comparisons and the ledger head were verified unchanged. Old
plan recovery remains compatible. No production freeze, fill or position was made.
The existing routine and targeted-quote acceptance states remain unchanged.

Verification found and corrected two local issues: a missing entry deadline was
mislabelled as a closed window; a delayed comparison response could navigate away
from the user's newer page. Missing deadlines now remain explicit, repeat clicks
are disabled while checking, and changed page/data state discards late results.
The final validation, private evidence references and browser results are in the
`eventEntryRevision` section of [the checkpoint](status/trade-thesis.json).

The active workbench restart was rejected by automatic approval review with only
`blocked by policy`; no original process or schedule was changed. Browser/API
acceptance therefore used a temporary instance of the existing workbench with
public collection disabled. Loading the new backend into the original running
instance remains a deployment step, not a completed restart. The temporary
instance is closed after acceptance. No market, public-source or model API calls
were added or initiated for this change; dollar cost remains UNKNOWN.
