# Local paper finalization and saved process review

September 12, 2026. F05/F07 correction: the enrolled September 10 engineering
plan has expired without an automatic report. The current Host-only finalization
path cannot finish while the Host is unavailable. No missed quote can be recovered
as a prospective observation by acquiring it later.

## Design reviewed before implementation

Reuse the existing public service's non-overlapping minute tick. Before its
network refresh, run the existing offline `observePaperPlans(root, null, at)`
pass. It can finalize only already-enrolled expired windows, up to the existing
six-plan bound. It cannot enroll plans, obtain quotes, alter frozen assumptions
or touch the Owner ledger. Source copies retain the original window cutoff;
the actual finalization time is never backdated. Stable `auto-final` identity
and independent verification remain the authority.

The public service retains a compact in-memory last-check status and sanitized
failure results. Expose it through the workbench's read-only state endpoint.
Paper failures must not block public refresh; public failures must not erase a
completed local paper result. Restart resets service-status clocks, never saved
outcomes. GET requests themselves make no writes. No new timer, task, source
schedule, endpoint or account/order permission is added. The existing minute
tick can be delayed by another active pass and requires the service to be running.

Project each saved automatic report into a concise process review: actual saving
time, source cutoff, modeled fills, known PnL/exposure, in-window quote count,
observed blocker counts and a concrete next check. No entry is not a losing trade;
an open position is unresolved; a completed snapshot is not a verified fill.
Keep these explanatory projections outside frozen fingerprints and show the
saved result separately from the current reassessment. Candidate lessons remain
unapproved; no market-cause inference or performance claim follows a data gap.

## Acceptance

Verify no-entry, unresolved exposure and completed-model projections; late-source
exclusion; repeat/restart idempotence; cancelled and not-yet-expired plans; exact
pre-existing record preservation; paper/public failure isolation; truthful service
status; unchanged read-only HTTP behavior; English frontend and notebook recovery.
Recover the actual expired enrollment with zero new market calls, retain zero
real trades and leave all three real-price gates open.
