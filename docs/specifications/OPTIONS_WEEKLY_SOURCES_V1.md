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

## Stage 3 — explicitly bounded process lifecycle

Owner continuation on October 11 authorizes an optional foreground process mode,
not an OS service, cloud automation or automatic workbench startup. The reviewed
stage-2 commit remains `0ba6ba7`; this extension is a separate subsequent commit.

`--run` requires an absolute UTC `--until` within the next 24 hours. Optional
`--first-at` delays the first eligibility check; it cannot override persisted
source cooldown. Intervals are at least 60 minutes; source IDs remain the same
ten-entry official allowlist. A run has an explicit request budget (default 20,
maximum 100), one request at a time and at most the existing 12-second deadline
per request. Each scheduled attempt reuses the existing refresh function and raw
receipt format. GET/reload never starts this mode or fetches sources.

Per-workspace exclusive runner ownership prevents duplicate processes; existing
per-source claims still protect manual refresh. Due times derive from saved
request receipts, including across clean restarts. Consecutive acquisition
failures back off 1, 2, 4, 8, 16, then at most 24 hours at the default hourly interval.
A successful later attempt resets the failure streak. No immediate retry, missed
slot replay or catch-up burst. Unknown/incomplete source storage stops the run.

`--status` is read-only. `--stop --run-id <exact ID>` writes a local stop request,
checked within one second and aborting any active bounded request. Ctrl-C/SIGTERM
also request graceful shutdown. The mandatory expiry and request budget stop the
process automatically. An append-only, fingerprint-linked lifecycle journal
records configuration, start, due execution, results and final reason. A killed
process can leave ownership/in-flight claims: status must say unresolved, not
running successfully. Explicit `--recover --run-id` may release only runner
ownership whose recorded PID is demonstrably absent; source claims remain for
review. No PID-based kill or silent lock theft.

Tests use injected clocks/transports and retain TEST_FIXTURE attribution. Real
bounded background acceptance respects existing hourly cooldown; the run must
terminate by its recorded deadline. Computer sleep, offline periods and process
exit suspend/stop collection; no always-on availability is promised.
