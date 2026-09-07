# Robinhood collection closeout v1

Task RH-CLOSEOUT-1. The Owner directed continued development while away, with
automatic collection only. Complete the deterministic acceptance report needed
after the first opening window. Preserve the current 09:30-09:50 schedule,
contracts, original news restoration fields and every accepted source record.

## Problem and reviewed design

The current observation review describes saved frames and their quality, while
automatic request failures live in a separate attempt directory. A zero-frame
result therefore does not explain whether the host never requested data, a
source request failed, or responses were recorded with unusable market data.
The scheduled final step also relies on manually saving command output.

Add a versioned, read-only TypeScript closeout engine and a small local CLI. Load
the existing study and collector attempts through the current hash-checked
storage boundary, taking the collector lock before the study lock when attempts
exist. Export only sanitized attempt summaries and existing frozen plan/frames
to the engine. Do not copy provider bodies into reports or change old parsers.

Divide the declared window into cadence-sized half-open request slots, capped
by the final window end. Keep future/open/elapsed slot phase separate from
request, failure, frame and per-contract usable-observation counts. Before a
slot ends, missing data is pending rather than a missed completed interval.
Requests belong to the slot in which they actually began, never an assumed
timer timestamp. Successful late-received frames remain recorded but retain
their original quality exclusions. Manual and unlinked automatic frames are
identified separately; a missing attempt cannot be inferred to have succeeded.

The report includes declared and elapsed slot counts, unique slots with request
evidence, source failures, saved frames and complete contract observations;
per-contract usable coverage; contiguous completed gaps; original source-quality
blockers; and exact plan/frame/attempt fingerprints. Percentages are diagnostic
coverage only, with a null elapsed denominator before the first completed slot.
All source and recording clocks stay distinct. The original observation review
is retained as a nested unchanged report, not upgraded to replay authority.

New operational lessons describe observed request failures, missing request
evidence and incomplete attempt recording. Their first-known clock is the
actual evidence/report time; they remain candidates with no trade outcome or
permission to change strategy. Source failures never become invented fills,
losses, market inactivity, numerical factor observations or calibrated odds.

`options:robinhood-closeout -- --report <study-id>` recomputes without persisting
a report; `--save <study-id>` exclusively writes a bounded, hash-sealed report
under a separate local report directory and returns a compact receipt. Existing
reports are revalidated at their original assessment clocks and never rewritten.
An input fingerprint identifies the exact prefix used at that recording time;
later frames cannot silently alter an earlier saved report. Bound directory
entries, reject links/oversized files, and fail on corrupt or conflicting data.

After the host restores original news at window end, replace the ad hoc output
save instructions with the tested closeout `--save` command. Do not move the
window or add source calls, another timer, credentials, account access or orders.

## Acceptance

Test pending/partial/end windows, slot boundaries, failed requests with no fake
frames, mixed manual/automatic records, out-of-window and late replies, missing
and repeated observations, full/partial diagnostic coverage, unknown costs and
invariant NO_REPLAY. Test sanitized scope, duplicate/conflicting references,
corrupt reports, idempotent save/reload, original-time recovery after later
records, path/file bounds and unchanged accepted fingerprints. Run focused and
aggregate validation; preflight the real empty opening study without live quote
requests. Update and independently read back the same host heartbeat only after
tests pass, then commit and push under the Owner's standing authorization.
