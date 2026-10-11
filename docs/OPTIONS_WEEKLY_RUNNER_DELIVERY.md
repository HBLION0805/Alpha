# Bounded weekly source process

Owner continuation on October 11 authorizes this separate development extension
after `0ba6ba7`; the four source-projection corrections were independently saved
as `f92814b4253132b6cdea037548a643d1cbec7b8b`.

## Operating contract

The existing `options:weekly-sources` CLI now has `--run`, `--status`, `--stop`
and `--recover`. A run needs an explicit UTC end time within 24 hours and accepts
only the existing official source IDs. The default interval is 60 minutes,
minimum 60, maximum 1,440; default request budget 20, maximum 100. A source attempt
uses the existing raw-receipt writer and at most a 12-second deadline, shortened
to the remaining run lifetime. Stop/expiry aborts an active request and preserves
its partial/failure receipt. No immediate retry is performed.

Failures are read from saved source receipts across clean restarts. At the default
hourly interval, consecutive failures delay the next attempt by 1, 2, 4, 8, 16,
then at most 24 hours. A success resets the streak. Waiting does not repeatedly
parse the source archive; the local stop/deadline check runs once per second.
The next due check re-reads history before any request. Missed slots are not replayed.

A workspace runner ownership file rejects a second instance. Existing source
claims still protect manual refresh. Every run keeps a manifest with implementation
hashes and a fingerprint-linked event journal. Status distinguishes a terminal
result, an unresolved interrupted run, and mere presence of a PID; PID presence
alone is not proof of healthy collection.

These are explicit process commands, not a cloud task, OS service or system startup
registration. The workbench and page reload never start the process. Closing the
process stops collection; sleep/offline time is not covered by an always-on promise.
No market source, account, order, challenge ledger or original schedule is changed.

## Commands

Use the intended isolated workspace explicitly. Supply real future UTC timestamps
for `--first-at` and `--until`; these placeholders are not runnable dates.

```powershell
npm run options:weekly-sources -- --run --workspace C:/projects/Alpha-weekly-source-integration-20261011 --sources bls_calendar,fomc_calendar --first-at <UTC-ISO-MILLISECONDS> --until <UTC-ISO-MILLISECONDS> --interval-minutes 60 --max-attempts 4
npm run options:weekly-sources -- --status --workspace C:/projects/Alpha-weekly-source-integration-20261011
npm run options:weekly-sources -- --stop --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id <EXACT-RUN-ID>
npm run options:weekly-sources -- --status --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id <EXACT-RUN-ID>
```

`--run` remains in the invoking terminal; Ctrl-C requests graceful stop. A caller
may explicitly launch it hidden in the background with an end time. `--stop`
records a request, not a claim that shutdown has already happened: inspect its
terminal journal/status afterward. Historical status requires the exact run ID.

After an abrupt process kill, `--recover --run-id <EXACT-RUN-ID>` can release only
runner ownership whose PID is demonstrably absent. It never kills another process
or removes an in-flight source claim. Such source claims remain a review blocker;
they must not be silently deleted to obtain another attempt.

## Validation

Full regression: 230 components, 5,902 counted tests, zero failures. New runner
tests pass 12/12, including delayed execution, expiry, concurrent ownership,
stop/cancellation, clean restart cooldown, persisted backoff, unfinished source
claims, actual child interruption/recovery and sleep-like clock jumps. The focused
weekly/source review suite passes 25/25 separately.

The isolated background failure-recovery fixture uses a simulated clock and
injected HTTP responses, explicitly marked TEST_FIXTURE. Requests occurred at
logical hours 05:00, 06:00 and 08:00 after two 503 results, then one success;
the process stopped at its three-request budget. These are not live-source results.

Actual bounded-process acceptance completed on October 11 using implementation
`f9504fa2cd5822b61bbde5101fee746b7b1b9755`. Run
`2df44345-611b-42c0-bab2-b94ba1a370cc` issued exactly two requests: BLS at
04:38:50.044 UTC and FOMC at 04:38:50.255 UTC (00:38:50 America/New_York).
Both returned HTTP 200 and immutable `OBTAINED_PENDING_REVIEW` receipts. No retry
occurred. The process recorded `EXPIRED` at 04:39:25.003 UTC (00:39:25 EDT), after
the original scheduled end, and subsequently disappeared. Runner ownership and
both source claims were released. The earlier real duplicate rejection, explicit
stop and clean restart are retained as separate evidence; they were not repeated
to manufacture extra acquisitions.

The local acceptance receipt is
`data/runtime/options-weekly-sources/stage3-acceptance/real-lifecycle-acceptance.json`,
SHA-256 `fade04f6e7ecb0a9a663c3ea0dac7e484dccb32cd6376f3c565e3f701a3b4b34`.
It verifies implementation hashes, linked lifecycle events, source fingerprints,
hourly spacing, process absence, released ownership and no incomplete source
claims. All 18 original acceptance files and 25,907 protected baseline files
retain their hashes. Raw receipts, logs and the acceptance remain ignored/local.

This validates one finite official-source process lifecycle. It does not establish
unattended operation across sleep/offline periods, source interpretation, trading
research quality, market quotes or Paper execution. The existing 4178 preview
pinned `2dabc11486f0217fe001a6102ead13a8fa539f51` at runner acceptance, denied
filesystem writes and outbound requests, and had zero blocked network attempts.
After independent review closed the concurrent-provenance follow-up, the approved
local full-UI preview switched to `9dd4779`; see
[the separate preview acceptance](OPTIONS_WEEKLY_PREVIEW_DELIVERY.md). This did
not restart the runner. Original schedules and challenge records are unchanged.
