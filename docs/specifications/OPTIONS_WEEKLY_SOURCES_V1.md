# Weekly source coverage V1

Task WEEKLY-SOURCES-20261011 is an Owner-authorized, isolated development change.
The current coverage projection is separate from immutable weekly plan V1
revisions. A saved review is not automatically amended by new evidence.

## Sources and ownership

An optional ignored `data/runtime/options-weekly-sources/config.json` explicitly
maps `calendars`, `news` and `research` to absolute local workspace roots. Missing
configuration uses the current workspace; never search for or choose another
checkout implicitly. Source roots are read-only. Only the selected development
workspace owns new weekly refresh receipts. GET and page reload never fetch.

Read BLS/FOMC journals with full existing fingerprint/assessment validation,
without writer locks. Read both six-feed driver and focused-news evidence without
the old GLD/IBIT relevance filter. Retain receipt paths, hashes, health and clocks.
Technology research maps as attributed references, never invented earnings dates.
Fixture records cannot count as source coverage. Original SEC filing acceptance
times are not earnings announcement times. No headline completes a category.

## Coverage contract

Each category reports its exact source scope, applicable object count, matched
evidence count, incomplete coverage and reasons. States distinguish NOT_INTEGRATED,
STORE_ABSENT, STALE, ACQUISITION_FAILED, READ_ONLY_RESTRICTED, INVALID_EVIDENCE,
OBTAINED_PENDING_REVIEW and CHECKED_NO_MATCH. The latter applies only to the
specific successfully checked calendar, never all central-bank or economic events.
Source freshness is 26 hours for calendars and 72 hours for headline context;
research is historical attributed evidence, not a current calendar. Unknown event
times stay unknown. Publication after receipt or assessment is excluded from valid
coverage and retained as a visible anomaly. Unknown publication stays unknown.

## Bounded refresh (stage 2)

Explicit CLI only: one sequential attempt per fixed authorized official endpoint,
no redirects, cookies, credentials, retries or new timer. Limit each response to
existing parser bounds and 12 seconds. Keep original response bytes, status,
selected HTTP metadata, request/receipt times, parser result, source hash and
failure before projecting. Preserve duplicate/revised source records, group exact
identity/content duplicates for display only. Publication is not event time.
Enforce a one-hour minimum between attempts per source in this isolated store.
No entire context-service invocation, market call, account, ledger, strategy,
capital setting, automation or deployed-version change.

## Acceptance

Test explicit roots, missing/stale/failed/restricted/invalid evidence, immutable
plan compatibility, bounded readers, future clocks, fixture exclusion, partial
scope and UI escaping/traceability. Stage 2 tests raw replay/integrity, no retries,
cooldown, partial failures and acquisition-to-page evidence. A real successful
calendar check may legitimately have zero events in the target week.
