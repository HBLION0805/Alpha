# Public calendar context brief v1

Task: OPT-CALENDAR-BRIEF-1. Reviewed design: 2026-09-07.
Model/effort: current task settings. Complexity: medium. Paid cost: none.

## Purpose

Combine independently recovered BLS release-time and FOMC date-calendar records
into a new read-only English brief. Preserve their different temporal precision.
This is separate from existing readiness v1/v2, operator brief v1, context-cutoff
v1, exports and source engines. No source, host or trade behavior changes.

## Source and chronology boundaries

Accept exact AVAILABLE/MISSING/BLOCKED states with actual ordered check clocks.
Recompute complete histories through their existing source engines at those
check times; malformed history blocks its component rather than hiding the other.
The final brief clock must follow both checks. Bind each source report hash.
No current schedule is promoted from a failed latest source. Last-known clocks,
missing source metadata and overdue refreshes remain visible in source summaries.

Use a common thirty-New-York-date horizon from the final brief's local date.
Include BLS scheduled instants on those dates, even if their scheduled time has
passed today, labeled SCHEDULED_TIME_PASSED rather than claiming actual release.
Keep explicit source cancellation/tentative status. FOMC date intervals overlap
the horizon by date only; confirmation and intraday timing remain unknown.

Group rows by the first date overlapping the horizon. Preserve original source
start/end dates separately. Within a group, keep date-only listings and timed
releases in separate arrays: an unknown time must not become midnight or be
ranked as earlier/later than a known release. Timed entries sort by actual
scheduled UTC time and source ID; date-only entries retain date-derived keys.
No date overlap becomes a trade blackout, risk score, causal direction or signal.

## Command and presentation

New command: options:calendar-brief -- --report [--json], plus --help. Default
English text, optional bound JSON. No custom root/date/source/URL/refresh arguments.
Only the two fixed journals are recovered with existing size/path/hard-link bounds
and before/after byte comparison. Absent stores stay absent; temporary recovery
locks are allowed. No network, source append, report-file creation, credentials,
host change, account/order tools, trade or knowledge promotion.

JSON preserves all selected bounded entries (at most 1,032). Text shows at most
forty with explicit total/shown counts and escaped control/bidi characters. Label
source clocks, source-specific failures and both date precisions. Source content
is data; no HTML or terminal control execution. The final report fingerprint binds
input report hashes, check clocks, selection and rendered text.

## Acceptance

Pure and isolated I/O tests cover instant/date precision, ongoing date spans,
passed scheduled times, source cancellation, empty versus missing/failed histories,
safe output, date boundaries, ordered clocks, independent corruption, no source
writes or network and unchanged old source/report output. Save one actual brief
via a separate explicit shell wrapper after success, verify protected artifacts
and host bytes, then full validation and authorized commit/push.

Allowed changes: new composition and CLI/tests, package/validation registration,
this specification, delivery/checkpoint and focused current documentation. No
existing report, source, host, frozen plan or historical artifact is altered.
