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

Actual bounded-process acceptance is recorded separately in ignored runtime.
The live run must be checked after its expiry before claiming completion.
