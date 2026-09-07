# Public BLS release calendar v1

Task: OPT-CALENDAR-1. Reviewed design: 2026-09-07.
Model/effort: current owner-selected task settings. Complexity: medium.
Expected work: one bounded source, local recovery and relevant fault tests; no paid cost.

## Purpose and authority

Expose upcoming official BLS release times as GLD/IBIT context. The calendar
contains scheduled events, not released values, surprise measurements, price
predictions, a comprehensive event inventory or trading permission. A quiet
calendar never means trading is safe. Do not change frozen option studies,
fees, risk rules, replay gates, existing journals or host scheduling in this task.

## Source and reviewed evidence

The [BLS September calendar](https://www.bls.gov/schedule/2026/09_sched.htm)
links the fixed public [ICS feed](https://www.bls.gov/schedule/news_release/bls.ics)
and identifies release times as Eastern. The actual anonymous inspection at
2026-09-07T06:00:00.864Z returned 80,672 UTF-8 bytes, SHA-256
`92a350111ace106deaab5584e4084366bd367b594a0d0bad116008d82d63e501`,
with 313 events and an explicit US-Eastern daylight/standard definition.
Events have UID, SEQUENCE, DTSTART, SUMMARY and zero duration. The inspected
feed omits DTSTAMP and LAST-MODIFIED; retain those clocks as unknown. Inspection
is separate from the first journaled runtime retrieval.

Use [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) for line unfolding,
escaped text and calendar identity semantics. This deliberately limited BLS
profile is not a general RFC-compliant calendar implementation. It accepts
the observed LF format and CRLF, optional UTC creation metadata and explicit
event status. Reject unsupported recurrence, alarms, duplicate properties,
duplicate UIDs, unknown timezones, changed timezone rules and malformed dates.
Preserve source titles as data. Never follow URLs or interpret source text as code.

## Deterministic core

- Parse one VCALENDAR, the observed US-Eastern VTIMEZONE and at most 1,000
  VEVENTs, within 512 KiB, 20,000 physical lines and 4,096 characters per unfolded
  line. Validate nesting and exact supported property sets.
- Convert Eastern event timestamps using America/New_York and require exactly
  one matching UTC candidate. Reject nonexistent or ambiguous DST wall times.
  Retain original DTSTART text and timezone beside UTC. No floating times,
  all-day assumptions, date rollover or fixed year-round UTC offset.
- Record actual request/receipt clocks and raw-body SHA. Optional DTSTAMP and
  LAST-MODIFIED remain separate from scheduled release time; no invented original
  publication or historical knowledge date. Missing metadata is explicit.
- Retain successful snapshots and sanitized failures in receipt order. Reports
  identify additions, changed UID versions and missing prior UIDs between
  consecutive successful snapshots. Missing means absent from this snapshot,
  never automatically cancelled. Explicit CANCELLED/TENTATIVE remain distinct.
  Same-UID sequence regression is reported, not hidden. Failed snapshots break
  consecutive comparisons; do not silently skip them.
- Current upcoming events come only from the latest successful retrieval if
  that retrieval is also the latest attempt. A latest failure provides a
  separately labeled last-known snapshot, not a fresh current schedule.
- Report events in the half-open next seven-day interval and same New York
  day, with a 26-hour operational refresh-age threshold. This threshold measures
  our retrieval age, not publisher timeliness or a trading risk window.
- Static exact-title tags identify CPI, PPI, Employment Situation, JOLTS, ECI,
  import/export prices and productivity; other BLS titles remain visible.
  Tags confer no direction, impact magnitude, probability or strategy weight.
- All results retain executionAllowed=false, replayAllowed=false,
  winProbability=null and coverageComplete=false.

## Transport and persistence

One anonymous GET to the fixed feed, no redirects, credentials, URL overrides,
retries or background process. A total deadline up to 12 seconds covers headers
and body; enforce UTF-8, content type, advertised and streamed byte limits.
Errors expose only fixed codes. New account or paid steps remain out of scope.

A separate options-release-calendar/retrievals.ndjson journal follows existing
Treasury/BTC patterns: exclusive single-writer lock, 32 MiB / 366 retrieval cap,
hash chain, deterministic recomputation, immutable caller inputs and actual
request/receipt clocks. Append-time ordering is checked, but a separate disk-write
timestamp is not stored. Truncation, unsafe paths/links or uncertain writes require
review/recovery; no automatic repair or rotation. Append capability expires on
callback exit. Existing accepted files are untouched.

CLI: options:release-calendar -- --refresh|--report|--help. Report is local only.
Independent source and recovery checks must precede any later daily integration.

## Allowed changes and acceptance

New calendar engine/tests, script transport/journal/CLI/tests and synthetic
fixtures; package/validation registration; focused architecture, decision,
roadmap, handoff and delivery/status documentation. No unrelated refactor.

Tests must exercise DST, boundaries, unknown clocks, unsupported ICS constructs,
corrections/removals/failures, bounded transport, recovery and write faults.
Verify one actual refresh and restart readback; preserve prior journal/study/
snapshot hashes and the active heartbeat. Run the relevant suite and validation
bundle before the standing-authorized commit/push. Market observation remains
pending for September 8; software tests do not establish a strategy success rate.
