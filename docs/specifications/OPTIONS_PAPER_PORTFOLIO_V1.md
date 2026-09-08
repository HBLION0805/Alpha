# Paper account and portfolio diagnostics v1

Task OPT-PAPER-PORTFOLIO-1. Reviewed September 7, 2026 against the unchanged
paper replay, repository and portfolio engines. Medium complexity; current
configured model, no delegation. Owner authorized local implementation and Git
delivery. Scope: one new projection engine/contract, bounded CLI, tests and docs.

## Purpose and boundary

Recover the existing single $1,000 modeled account and automatically construct
the existing portfolio scenario. Preserve every disposition, original review,
candidate notebook and plan fingerprint. Do not merge independent historical
research accounts. This is a diagnostic integration, not a journal writer,
broker account reader, market adapter or automatic execution gate.

The input declares origin, assessment clock, modeled history completeness,
cost review, optional manual event review, complete latest paper scenarios and
an optional new initial-quote candidate. Use the original replay validator;
reject history beyond the assessment and reused candidate scenario/plan IDs,
including IDs of cancelled or rejected cases. Bound history to 500 scenarios.
Empty declared history is valid; a missing, busy, unsafe or corrupt repository
is an error and must never become a fresh $1,000 account.

## Projection and candidate checks

Closed fills and reviews come exclusively from original replay. Settlement is
always unknown/unsettled; passing time never creates cash. Open positions keep
original entries and their latest recorded quote; quotes rejected or ignored
by original replay cannot become valid marks through this bridge. Portfolio
freshness/liquidity checks run at the separate declared assessment clock.
Pending orders remain reserved if a later assessment passes their deadline;
only acknowledged original replay state can release a reservation. Cancelled
and no-trade cases remain in the all-case inventory without exposure.

Original modeled high-water equity is a modeled lower bound, not broker peak
evidence. Unknown history, costs and event coverage remain blocking inputs.
An optional candidate is independently previewed by original paper replay using
only its initial quote, preserving existing mistake-notebook and entry guards.
The preview cannot fill a trade or append a plan. Both original portfolio and
paper diagnostics must pass for MODELED_CANDIDATE_WITHIN_LIMITS. No probability,
larger allocation or order authority follows. No candidate means diagnostics
only, even when no blockers occur.

## Reconciliation

The engines deliberately retain their original accounting conventions. Paper
debits exit fees from settled cash and records gross unsettled proceeds;
portfolio nets fees from positive unsettled proceeds. The settled difference
must equal the sum of min(gross exit proceeds, exit fee), with the opposite
unsettled difference. Total cash and realized PnL must reconcile exactly.
Paper also reserves open exit fees, while portfolio only reserves pending
entries. Verify that difference and expose the lesser available settled cash.
Never describe individual cash buckets as equal or credit a balancing entry.

Paper marks include declared adverse exit slippage and may retain an older
mark. Portfolio uses current qualified gross bid marks and can return unknown
equity. Preserve both and label the basis; do not force equity equality or
replace unknown portfolio equity with the older paper mark. Both candidate
checks are necessary. Any unexplained cash/count/review difference is an error.

## Storage and acceptance

Offline CLI: synthetic demo, bounded explicit input, existing-paper-journal plus
bounded settings, and exclusive save/recompute. Strict UTF-8 JSON rejects duplicate
decoded keys and excessive depth. Safe existing storage rejects links, escapes
and oversized files. Repository recovery is bounded and journal bytes must match
before/after; it acquires/releases the original transient lock without appends.
Saved artifacts include exact projected inputs, input/journal hashes, separate
actual construction clocks and deterministic results. Verification recomputes
the saved snapshot without claiming it is the current journal or authenticating
external inputs. Original journals and source artifacts remain byte-identical.

Test cross-ETF exposure, pending deadlines, stale/zero-size/rejected marks,
exit-fee conventions including proceeds below fees, candidate original guards,
all-disposition preservation, source/clock/identity constraints, exclusive
storage, corruption, independent process recovery and repository failures.
Run existing dependency suites and the integrated validation bundle. These
engineering fixtures do not advance the three actual-price paper-flow gates.
