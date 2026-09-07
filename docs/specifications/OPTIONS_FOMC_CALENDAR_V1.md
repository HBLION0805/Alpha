# Official FOMC date-calendar context v1

Task: OPT-FOMC-1. Reviewed design: 2026-09-07.
Model/effort: current task settings. Complexity: medium. Paid cost: none.

## Scope and source evidence

Add one standalone free read-only context source for GLD/IBIT:
https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm.
The observed public page contains year panels with month/day labels, optional
projection markers and a page-level last-update date. It also says meeting dates
are tentative until confirmed at the immediately preceding meeting. The page does
not establish an exact intraday decision time for each listed meeting.

An inspection at 2026-09-07T07:22:53.127Z through .276Z received 166,936 bytes,
SHA-256 49e8e7e136efa5ada2a5f61776b9f92da5ed9004bb8dca6a39132081660e3b57.
This is source-format inspection, not a previously imported runtime observation.
Inspect exact HTML rather than inventing an API/ICS URL or parsing search snippets.

## Deterministic representation

Parse only the calendar panels for the New York year of actual receipt and the
next year if present. Require the current-year panel. Explicitly retain missing
next-year coverage; do not silently parse other years or dates in free-form notes.
Validate known panel/row/month/day structure, bounded row counts, unique and
chronologically ordered date intervals. Support same-month day ranges, adjacent
cross-month ranges and explicit single-day notation-vote/unscheduled labels.
Unsupported or malformed structure must fail visibly rather than drop rows.

Preserve original month/day label, projection marker, date-only start/end,
calendar year, deterministic date-derived key and fixed kind. The key is not an
official stable event UID. Page last-update date is nullable and never used as a
receipt or per-event publication clock. All per-event intraday times, confirmation
status and original publication times remain explicitly unknown. No 14:00 or
press-conference time is inferred. Strip non-content scripts/styles/comments;
never execute HTML, follow links or interpret provider text as instructions.

Report latest attempt separately from last-known success. A latest failure does
not promote old dates as the current schedule. Select current/upcoming overlaps
with today through the next thirty New York calendar dates, using date precision
only. Twenty-six-hour collection freshness does not authenticate publisher dates.
Compare only consecutive successful snapshots from the same selected year set:
added/absent date keys and changed projection flags. Missing keys are not proof
of cancellation or rescheduling. Keep all raw snapshots, including A-to-B-to-A.
No numerical forecast, causal direction, probability, trade-risk window or order.

## Transport and persistence

Exactly one anonymous fixed-URL GET per explicit refresh, no redirects, login,
URL override, retries, paid steps or link following. Twelve-second total deadline,
512 KiB source cap, strict UTF-8, bounded HTML content type and content length,
nonblocking stream cancellation and fixed sanitized error codes.

Use a separate options-fomc-calendar/retrievals.ndjson journal, 32 MiB/366-record
bounds, actual request/receipt clocks, integrity chaining, assessment recomputation,
one writer, scope and uncertain-write guards, path and hard-link safety. Existing
source journals and report engines are unchanged. Exact durable append time is
not recorded and must remain unknown. No claim that current dates were known
before their actual saved receipt clocks or that local hashes authenticate source.

CLI: options:fomc-calendar -- --refresh, --report, --help. No arbitrary date,
path, provider, credential or URL arguments. Daily host integration, readiness,
operator brief, context-cutoff and export formats are separate follow-up work;
none is silently widened in this standalone source delivery.

## Validation and allowed changes

Add a synthetic HTML fixture with explicit origin, pure engine and focused tests,
isolated transport/journal/CLI tests, one actual runtime retrieval and independent
recovery. Validate date precision, missing metadata, selected year scope, unknown
confirmation, same/cross-month intervals, malformed/duplicate/hidden content,
source identity/clock integrity, failures, revisions, history limits and safe I/O.
Compare actual parsed dates with the official page; verify protected source/host
hashes and run the aggregate validation before authorized commit/push.

Allowed changes: new source engine/tests, fixed transport/journal/CLI/tests,
synthetic fixture, package and validation registration, focused specification,
delivery and current-state documentation. No existing study/quote source or
heartbeat mutation, live trade, automatic order or knowledge promotion.
The new runtime directory must be excluded from Git in .gitignore before delivery.
