# Routine market schedule reduced to 15:50

The Owner's September 12 table removes routine 09:50 and 12:50 GLD/IBIT sampling.
The existing gld-ibit heartbeat was updated through the app and all eight persisted
fields matched the new [Host V2](OPTIONS_DAILY_GUIDANCE_HOST_V2.json) on readback.
It has 26 daily wakes: hourly :20, daily 09:00 and daily 15:50. The router restricts
the routine market sample to weekdays at 15:50; the first affected weekday is
September 14. A scheduled wake is not proof of successful market collection.

Conditional event-day 10:20–15:20 hourly samples, the seven 16:20 full-chain closes
through September 16, hourly public/news work and daily context are retained.
The final close still restores immutable v6 first, then V2 ongoing fields; the
cancelled routine times cannot be restored by the documented continuation.

One dated schedule is shared by routing and delivery diagnostics. Dates before
September 13 retain their three expected windows and recorded failures; newer
dates expect only 15:50. The frontend uses the diagnostic description and next
window. Holiday/early-close exclusions and unreviewed-year blocking remain.
The immutable V1 Host fields, original market/paper records and both development
review tasks are preserved. No market call, enrollment or order was added.

Validation and actual readback are recorded in
[the checkpoint](status/guidance-schedule-v2.json). This change reduces the schedule;
it does not fix Codex allowance failures, prove unattended operation, or advance
any real-price trading gate. See [design](specifications/OPTIONS_GUIDANCE_SCHEDULE_V2.md).
