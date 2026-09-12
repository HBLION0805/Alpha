# Guidance delivery health

September 12, 2026. Daily guidance now distinguishes saved market receipts,
attributed analysis, and newly issued reports. The frontend, offline command and
Host brief share a read-only projection; existing guidance inputs and all issued
report fingerprints are unchanged. The Owner's allocation policy is unchanged.

The audit checks seven calendar dates of the three fixed 09:50/12:50/15:50 New York
windows, with the reviewed 2026 holiday and early-close calendar. It separates
not-yet-due, pending, absent, claim-only, complete and partial receipts. Capture
association uses the original request start, not the later save time. Synthetic
records cannot satisfy a real capture window. A matching time is not proof of
scheduled execution. Event-dependent reads and full-chain closes are excluded
from this specific denominator. Unknown calendar years remain unknown.

The current capture's returned/requested count and source-clock freshness remain
separate. Analysis must cover both assets with attribution, follow the latest
capture and remain within 24 hours. The published-input fingerprint compares the
exact current capture, quotes and equities; it does not rate interpretation,
qualify execution, or claim that a new report contains new quotes. Corrupt records
fail visibly without changing the independent recommendation engine.

## Actual evidence

The September 8–11 fixed-window inventory has 12 ended windows, three associated
captures and nine without saved captures. Latest market capture: September 10
00:44:10.432 UTC (September 9 evening New York), 34/36 requested contracts,
34 stale quote clocks and two unknown/missing. The last attributed assessment is
00:24:11.678 UTC, before that capture. Later WATCH publications still carry the
same market inputs. These are actual stored observations, not simulated results.

Three corresponding September 10 fixed-window Host turns failed with Codex usage
limit errors before execution. This explains those Host failures, not every other
missing window and not a broker or authentication failure. The market recurrence
still matches the authorized schedule. See the [sanitized Host audit](status/host-delivery-failure-20260912.json)
and [delivery checkpoint](status/guidance-delivery-health.json).

## Acceptance and boundary

`node --import tsx scripts/options-daily-guidance.mjs --delivery-health` reads
saved evidence only. `--host-brief` exposes the same compact health projection.
Daily guidance displays clocks, counts and expandable window details, preserving
the open disclosure on refresh. Relevant tests cover calendar/DST boundaries,
future and late recording, partial/absent/synthetic evidence, published-input
changes, analysis sequencing, corruption, escaping, and no-write CLI recovery.
Final test and local UI evidence are recorded in the checkpoint.

No market call, new polling, schedule change, quota reset, paper enrollment,
account access or order was added. The existing service was restarted to load
the reader. Existing public refresh continues on its original cadence. F02–F04
have better operational diagnostics; all three real-price gates remain open.
The September 10 paper rehearsal remains NO_ENTRY with zero fills. Next work
requires eligible future capture/analysis evidence and event-conditioned planning;
past entry windows must not be backfilled. This does not establish reliable
future Host operation when allowance, host availability or authorization fails.

Design: [reviewed specification](specifications/OPTIONS_GUIDANCE_DELIVERY_HEALTH_V1.md).
