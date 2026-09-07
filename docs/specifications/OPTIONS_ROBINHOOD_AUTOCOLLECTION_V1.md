# Robinhood automatic collection v1

Task RH-AUTO-1. The Owner explicitly requests automatic GLD/IBIT market-data
collection and explicitly excludes automatic orders. The host permits only one
active heartbeat per thread, so extend the existing public-news heartbeat under
this explicit authorization. Preserve its daily 09:00 New York news behavior,
and add the frozen September 8, 2026 10:00-10:20 observation window. No new account,
purchase, credential access or workaround standalone cron.

## Reviewed design

The existing source and observation engines, immutable plans/frames and accepted
outputs remain unchanged. A thin collection CLI prepares an exact two-request
batch only when the frozen window and cadence permit it. It reuses the verified
study storage routines. The host calls only get_option_quotes for the four frozen
UUIDs and get_equity_quotes for GLD/IBIT. Both requests retain actual host request
and receipt times. No catalog edits, alternative IDs or historical substitutes.

The host returns two outcomes as bounded base64-encoded UTF-8 JSON. The encoding
is transport quoting, not encryption; the alphabet is safe for a single shell
argument and the CLI accepts at most 20 KiB decoded data. Successful outcomes keep
the exact request arguments and structured response data. Failed outcomes retain
only fixed error codes, never provider error bodies or credentials. The CLI
checks request scope, window and chronology before any record. It assembles the
original catalog calls with the two successful responses, validates the resulting
capture/frame, then invokes the existing immutable record workflow. Failure of
either source call creates a separate attempt record; it cannot become a frame
by inventing an empty successful response.

Attempt records are exclusive, hash-checked local files under a separate bounded
collector directory with a writer lock. Successful retries reuse the original
frame; conflicting bytes under an attempt ID fail. Recording after the window
may retain an actual in-window request received late, as excluded evidence.
No automatic request is prepared outside the window or before the minimum cadence.
The wrapper itself does not authenticate, access the network or enable a scheduler.

Update and read back the existing host heartbeat after testing the workflow. Its
temporary armed schedule is daily 09:00 and 10:00 in the verified host Eastern
timezone: the normal 09:00 branch runs the preserved news prompt, and pre-window
10:00 wakes make no quote calls. The first in-window wake switches the same timer
to a one-minute interval and starts the bounded host tick. On the first wake at
or after window end, restore the exact original news fields before accessing
collection files, then review coverage. This also restores news after a missed
window or an app restart. The UTC guard prevents later or off-session quote calls.
Keep an exact restoration snapshot; never delete the shared heartbeat. Missed or
delayed runs remain gaps; never backfill or claim exact one-minute execution.
Keep the computer awake and desktop app running.

## Acceptance

Test pre-window/closed-window no-op, exact approved requests, successful capture
assembly and restart, one-sided source failure without a fake frame, malformed or
oversized transport, scope/clock mismatch, duplicate conflict, immutable attempts
and preserved old artifacts. Run the real preflight without making closed-market
quote calls; run aggregate validation. Only then update and verify the heartbeat.
Maintain zero trades, no automatic orders, null probability and unchanged budgets.
