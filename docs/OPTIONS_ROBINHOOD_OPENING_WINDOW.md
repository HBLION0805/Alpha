# Robinhood opening-window correction

The Owner questioned why automatic collection starts at 10:00 instead of the
09:30 New York market open. The earlier 10:00 choice was a bounded test schedule,
not a collector requirement. The first diagnostic window now covers September
8, 2026, 09:30-09:50 New York (13:30-13:50 UTC), retaining its twenty-minute length
and target sixty-second cadence. Cboe lists regular options trading from 09:30
Eastern and September 7, 2026 as a holiday.
[Cboe hours and holidays](https://www.cboe.com/about/hours/us-options).

## Reviewed change

Freeze a new study, `gld-ibit-observe-open-20260908`, using the same four contracts,
source catalog, calendar declaration and quality rules at the actual current
time. Preserve the old plan, smoke frame, activation checkpoint and all journals
byte-for-byte. The old window is superseded operationally, never rewritten or
used to backdate observations. No new quote is requested before the window.

Update the existing gld-ibit heartbeat's armed schedule to daily 09:00 and 09:30,
retaining the exact original news restoration snapshot. Pre-window 09:00 news
checks remain; 09:30 no-op wakes before September 8 do not duplicate them. During
13:30-13:50 UTC on September 8 switch to the existing minute collection phase.
At or after the cutoff restore original daily news fields before reading any
collection records. The normal 09:50 completion does not repeat that day's
09:00 news run. No second heartbeat, cron, account access or orders.

The host runbook and isolated test clocks must match the new study and hash.
Verify the prospective freeze, pre-window WAIT, exact arguments, phase fields,
original restoration snapshot and preserved hashes. Run relevant host/collection
tests and aggregate validation, read back the actual host update, then commit and
push under existing Owner authority. Scheduling does not guarantee an exact
09:30:00 tick or establish fresh quotes before the first actual run.

The [opening checkpoint](status/robinhood-opening-collection.json) records the
actual freeze, activation readback and validation evidence. The earlier
[automatic collection delivery](OPTIONS_ROBINHOOD_AUTOCOLLECTION_DELIVERY.md) and
[activation checkpoint](status/robinhood-autocollection.json) retain the historical
10:00 schedule. The latest checkpoint supersedes only that operational schedule.

## Delivery evidence

The new study was frozen at `2026-09-07T03:05:12.104Z`, with plan SHA-256
`8e60f2a53ea47be83c30024e20d7a8ae1cc63fe1dca69ba8bc0e8540420f5c8d`.
Preflight at `2026-09-07T03:06:12.058Z` returned WAIT, zero source requests, zero
attempts and zero frames. The ACTIVE host configuration was independently read
back at `2026-09-07T03:07:43.164Z`; its exact hash is in the opening checkpoint.
Both studies retain identical source bytes, selected contracts and calendar.
The original restoration snapshot and four protected artifact hashes are intact.

`npm run test:options-robinhood-collection-host` passed 8/8 and
`npm run test:options-robinhood-collect` passed 20/20. `npm run alpha:validate`
passed 2,559/2,559 tests across 97 components in 42,237 ms. Scope, phase fields,
twenty-minute duration, prospective clocks and exact study/hash bindings were
also checked locally; no production engine behavior changed. Only operational
runbook/prompt/phase fields, matching host-test constants, current documentation
and the new opening checkpoint changed. Original accepted checkpoints are retained.

Actual in-window collection remains pending. Host wakeup latency and source
availability may cause missing samples; the opening tick is a scheduled target,
not a guarantee of an exact-second response. No new market calls, paid steps,
account/order access or trades occurred. Next review the first window's actual
coverage and quality. Git baseline is `8cadbc7` on
`codex/gld-ibit-options-foundation`; commit/push use the Owner's standing authority.
