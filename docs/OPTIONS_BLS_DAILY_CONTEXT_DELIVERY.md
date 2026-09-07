# Daily BLS context integration delivery

Task: OPT-CALENDAR-2. Date: 2026-09-07.

## Changes and purpose

Added the immutable
[v4 restoration snapshot](OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V4.json)
for one BLS calendar report/refresh pair in the existing daily 09:00 New York
workflow. The exact v3 news, Treasury and BTC subflows are retained. Updated
shared phase/prompt/runbook references, preservation attributes, focused host
tests and current overview/architecture/decision/handoff documents. The
[design](specifications/OPTIONS_BLS_DAILY_CONTEXT_V1.md) preceded implementation.

No second automation, task, worker or cron is created. The existing `gld-ibit`
heartbeat remains armed for September 8, 09:30-09:50 New York quote collection,
with the same four contracts, GLD/IBIT equities, cadence and execution boundary.
At the end of the window it restores v4 before reading collection records.
Routine calendar updates remain quiet; absence is not inferred cancellation.

## Validation and preservation

Commands: focused host test, aggregate validation, exact prior snapshot/journal
and Host tick comparisons, official automation update and independent local
readback. Actual counts, recording time, host hash and all-field readback result
are in [the checkpoint](status/bls-daily-context.json).

The bundle passed **2,914/2,914 tests**, 111 components, zero failures in
50,147 ms. The 14 host checks passed. Independent host readback at
**2026-09-07T06:17:40.258Z** matched all eight persisted expected fields; the
host file SHA-256 is
`0c3ff0d2440178c242e36f8a7dd0a7af8f4c9b030992b29c1455c67819ca2fc5`.
Nineteen journal/study/snapshot/checkpoint files matched their preserved hashes.

The Host tick SHA-256 (LF normalized) remains
`2e3a24d5ca223922d001047b58aaa689d17575e60dd0e89908daa14655ec4def`.
V4 binds the unchanged v3 bytes with hash
`5bf04fcbcb951907bc84fa2cd17d0285e5f527ee328a03fb21f151932293ab67`.
The new snapshot hash is
`673364912eb61b2871caa03d899c0ec332d599a2c9b0662727602b6e9b3bae75`.
No new source request, saved quote, trade, review or source-journal append occurs
during integration. Earlier dated delivery snapshots retain their original facts.

## Limits and next step

This enables later local daily work; it does not prove the next wake will run.
The computer, app, network and Codex allowance remain execution dependencies.
No usage reset, account/credential access, paid data, automatic order, risk change
or simulated trade is authorized by this integration.

The source remains the restricted BLS calendar, with no original publication
history, non-BLS/unscheduled-event completeness, actual released values or calibrated
impact. Existing readiness v1/v2 and the saved pre-window export exclude this
new calendar journal. Preserve their semantics if extending those consumers.

Next: use actual opening-window quote evidence for the first data acceptance
result; extend local diagnostics only with explicit source and clock bindings.
Git changes are reviewed and committed/pushed under standing owner authorization
after validation and host verification. No integration failures remain unless
explicitly recorded in the checkpoint.
