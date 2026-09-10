# Daily public context after a late startup

Task: OPTIONS_CONTEXT_LATE_START_V1, September 10, 2026. Scope: existing public
context service, its regression tests, calendar freshness in the existing frontend,
and current delivery records. This is a bounded defect correction, not a new source.

## Observed defect and intended behavior

September 9 has no daily claim or receipt. The hourly receipt series resumes at
22:00 UTC (18:00 New York), after a daytime gap. The service's undocumented
`minute < 1080` condition excluded the daily sources from that point until the next
09:00. BLS/FOMC therefore retained their September 8 receipts. This evidence shows
an unattempted window; it does not establish a provider or network failure, or why
the host was absent.

Keep the documented start at 09:00 New York and the once-per-local-date claim.
Allow the unattempted current-day Treasury/BLS/FOMC read until local midnight.
Use that local date for the claim directory, so UTC midnight cannot duplicate it.
Existing daytime claims retain the same paths. A failed or unfinished existing
claim still prevents automatic retry; preserve its original evidence. Before
09:00 on a new local date, do not backfill the previous day's slot.

The News & calendar page must display each calendar's latest attempt, last known
successful receipt, overdue/failed/unavailable state and source link beside events.
An available local component does not establish a current source read. Dates remain
saved schedules, not verified released economic values or intraday FOMC times.

## Acceptance

- A late same-day startup reads the three original daily sources exactly once.
- Completed, failed and unfinished claims remain immutable and suppress repeats.
- Summer/winter UTC-midnight, local-midnight and concurrent-worker cases retain
  local-date uniqueness and original hourly/focused/macro behavior.
- Visible calendar coverage distinguishes stale, failed, missing and current reads.
- Run focused service, macro, news/frontend and workbench checks plus typecheck.
  Inspect actual source receipts separately from synthetic tests.

The current missing source record may be checked with one explicit actual-time
read using each existing fixed public CLI. This does not create historical receipts
or revise the missed September 9 window. Brokerage, all three app automations,
paper assumptions and original journals are unchanged.

## Delivered evidence

At 2026-09-10 04:34 UTC, one explicit current-time read of each existing fixed
CLI succeeded: Treasury 04:34:02.002Z, BLS 04:34:02.315Z, FOMC 04:34:02.695Z.
The last known calendar receipts advanced from September 8; their overdue flags
cleared. Current guidance no longer has CALENDAR_COVERAGE_UNAVAILABLE. Both ETFs
remain WATCH for the other original evidence/event blockers. No released PPI/CPI
value or qualified trade is inferred.

The three original journal byte prefixes match their saved hashes. BLS/FOMC each
appended one row (3 to 4); Treasury appended one (4 to 5). The missing September 9
daily claim was not invented. All three app automation files retain their hashes.

Focused checks: context service 14, focused news/UI 48, macro context 57, workbench
57, guidance 65 and calendar brief 12: 253 passed, zero failed. Typecheck passed.
The full unrelated suite was not rerun for this bounded correction. Actual browser
inspection confirmed current source labels and September 10 00:34 EDT attempt and
success clocks next to saved PPI/CPI entries.

The exact workspace process/listener was rechecked before restarting only that
workbench through the approved launcher. The corrected background service is
loaded; its next natural daily run is still unobserved. The explicit read above
does not prove later scheduler execution. F01 remains PARTIAL, engineering counts
remain 4/4/2, and three real-price gates remain open. See the
[actual checkpoint](status/context-late-start.json).
