# Reported debit-spread opening reviews

## Closing evidence extension — September 17

A later Owner clarification can be appended as V3, copying and hashing the exact
V2 input and retaining its complete evidence. This version records the Owner's
statement that sales were manual after observing losses; it cannot authenticate
order initiation or prove a stop violation. It supersedes V2 only in the current
view and does not overwrite either earlier case. Recovery is bounded to V3 → V2
→ V1; arbitrary recursive revisions and conflicting successors are rejected.

Owner supplied subsequent closing screenshots and one additional round trip.
V2 copies the original V1 input unchanged with its hash, adds source-linked
openings and full-quantity spread-level closes, and supersedes only the displayed
case. V1 files/results remain immutable and independently recoverable. Reject
duplicate/partial/oversold closes, wrong chronology, unequal amounts and mismatch
with the screenshot's reported gross result. This bounded extension does not
support partial exits, adjustments, assignment or tax accounting.

Preserve cropped closing-leg prices as null; a displayed net spread fill can be
matched without inventing either missing leg price. Compute matched gross PnL,
estimated round-trip charges/net, and a minute-precision operation timeline.
Actual fees/net remain unknown. Do not identify an order as broker liquidation,
stop execution or manual execution without evidence. Losing sales do not establish
an earlier trigger or avoided-loss counterfactual. Record staggered directional
exits and a new same-asset entry soon after a reported loss as review candidates,
not proof of revenge trading. Never combine the superseded opening view with the
closing review into duplicate positions or PnL.

Reviewed before implementation, September 17, 2026. Owner requested review and
mistake-notebook recording of supplied brokerage screenshots. This focused
extension supports that request without expanding the long-only fill ledger.

## Scope and evidence

Keep each standard GLD/IBIT debit vertical as a two-leg opening record, with equal
whole-contract quantities and the same expiry within each vertical. Preserve the
reported minute, timezone, context-inferred year and estimated-fee label. Copy and
hash supplied screenshots in private ignored runtime storage. Screenshot
transcription is Owner-supplied evidence, not authenticated brokerage history.
There is no automatic screenshot parser, order route, quote call or polling.

Compute exact integer-cent opening debit, leg-price reconciliation, estimated
outlay and each vertical's gross terminal breakeven / maximum payoff references.
These terminal references assume intact standard 100-share deliverables; exercise,
assignment, legging and early-close execution can add risks outside that model.
Never sum per-position maximum profits into a portfolio forecast. Missing closing
executions, actual fees, original plans and account values remain unknown. Never
mark the position open, closed or worthless merely from an opening screenshot or
the passage of its expiry date. No realized PnL, win rate or causal loss conclusion.

## Checks and integration

The existing journal and review pages display a separate read-only spread panel.
The mistake notebook adds evidence-gap / process-check candidates: combined debit,
opposite directional exposure, mismatched expiries, absent original plan and
closing evidence, and unresolved account capital. Opposite positions are not
automatically credited as a hedge. Flat-path examples explicitly use each separate
expiry and cannot be presented as one common-expiry PnL curve. Checks do not create
approved strategy rules, reinstate cancelled caps or infer motivation.

Store immutable case inputs, report and source files with checksums and independent
recomputation on read. A malformed case is visible as a recovery failure, not
silently skipped. Private amounts and screenshots never enter Git. Old ledgers,
paper enrollments, reports, allocation settings, sources and schedules stay intact.

## Acceptance

Test two-leg arithmetic, both direction formulas, different-expiry checks, unknown
actual fees and closing state, invalid/unequal legs, duplicate identity, bounds,
future or invalid dates, HTML escaping, source tampering and copied-only recovery.
Inspect journal and notebook UI using saved Owner-supplied evidence. No real-price
paper gate advances through this feature.
