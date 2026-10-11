# Official event sources, stage 1 — October 11, 2026

The Owner's 01:25:20 EDT continuation authorizes actual public-source integration
and bounded automatic retrieval. This first small stage adds TreasuryDirect
upcoming auctions and the Federal Reserve Board receipt-month Speeches calendar.
It does not claim all requested source families are finished.

## Source and persistence contract

The existing source CLI accepts `treasury_auctions` and `fed_events`. The latter
resolves only the official monthly URL for the receipt's New York month. Sources
remain fixed/allowlisted; no caller URL, cookies, credentials, redirects or retries
are enabled. The per-batch maximum remains ten IDs, requests are serial, each
response is capped at 512 KiB/12 seconds and source attempts are at least one hour
apart. The existing runner retains exclusive ownership, request budgets, expiry,
persisted backoff, stop/status/recovery and no catch-up after sleep.

New immutable responses use the separate ignored `event-refreshes` directory.
The earlier ten-source reader and running 4178 preview therefore do not encounter
unknown new receipt IDs. GET/reload reads only. New facts and receipt identities
share the same frozen request snapshot as existing calendar/news coverage. Failed
later acquisitions own latest health; retained facts still point to their own
successful original. Exact retransmissions keep their original links. Saved
weekly plan revisions are not modified; the new events appear in the separate
current-source projection.

Every source saves bytes, HTTP status/selected headers, actual clocks, hash,
parser result, rejected-item counts and partial failures. The first three bounded
discovery reads occurred at 05:27:42.719–05:27:43.087 UTC, all HTTP 200. Two usable
data responses are ingested as `COPIED_DISCOVERY_HTTP_RESPONSE`, retaining the
complete original envelope, its hash and original clocks. This is explicitly
copied evidence, not two additional live requests. Subsequent runner requests use
the direct HTTP transport and the same parser. Original discovery files remain
unchanged under `data/runtime/options-weekly-sources/discovery-20261011`.

## Actual source results and scope

| Family | Implemented scope and denominator | Observed result | Remaining boundary |
|---|---|---|---|
| Treasury/fiscal | One TreasuryDirect upcoming-auctions endpoint; all returned rows | 11 rows parsed; six auctions in October 12–16, three with announcement fields and three published but not yet announced | No complete budget, tax, fiscal-policy or buyback calendar |
| Conferences/speeches | One Fed Board receipt-month Speeches section | Ten rows parsed; four appearances in October 12–16 | Excludes regional banks, other conferences and other sections; cross-month target weeks explicitly partial |
| Existing economic/central-bank calendars | Existing BLS and FOMC journals/receipts | Preserved four BLS events, FOMC checked zero matches | Not all economic releases or central-bank appearances |
| Existing official news | Existing six official feeds plus Fed speeches/EIA and previously saved CoinDesk context | Retained health/clocks; BEA remains partial, 47/48 with one rejected | No automatic promotion of headlines to scheduled facts |
| Company earnings/IR/SEC | Fixed 36-company universe remains the intended denominator | No new live issuer-calendar connector in this stage | Next stage; existing historical references and SEC agency news are not earnings calendars |
| Options/market calendars | Not connected in this stage | NOT_INTEGRATED | Official exchange/product calendars and announcements still to implement; no quote or trade authority |

Treasury identities include CUSIP plus auction date, so reopenings are not merged
by CUSIP alone. Auction, announcement and issue dates are distinct. The parser
uses the observed `auctionDate` schema; an unrecognized future schema fails
explicitly instead of guessing from another date. Announcement fields do not
authenticate an offering independently. Unannounced future schedules are not
labelled completed announcements. No date is inferred.

Fed dates come from the named month/day and actual Speeches rows. Printed times
are preserved in notes with UNKNOWN timezone; no exact UTC conversion is guessed.
An HTML application shell, unexpected month or absent section is an acquisition/
parsing failure, not a zero-event success. All categories remain incomplete and
events remain unverified official-source claims rather than trading signals.

Official references:
- https://www.treasurydirect.gov/auctions/upcoming/
- https://www.treasurydirect.gov/TA_WS/securities/upcoming?format=json
- https://www.federalreserve.gov/newsevents/2026-october.htm

## Minimum local operating plan

The first continuation will use the existing explicit process for at most 12
hours, six-hour per-source spacing and a 20-request budget. Its selected batch is
the eight already implemented official headline feeds plus the two event sources
(ten IDs). The existing BLS/FOMC calendar captures remain independently visible;
they are not part of this ten-ID batch. A later expanded company run must use
explicit batches of at most ten and report unattempted companies. No automatic
whole-universe pass is permitted.

Due times derive from actual receipts, including imported original clocks, so a
new run may first wait rather than immediately repeat fresh reads. The exact run
ID, end time and first eligibility will be saved locally before any unattended
continuation is reported. Stop uses the existing `--stop --run-id <exact ID>`;
read back terminal status to confirm stopping. Closing the process, computer
sleep or offline periods interrupt service; this is not an always-on guarantee.
No cloud plan, OS startup, security change or existing task modification is added.

## Validation and rollout

Deterministic tests cover published versus inferred dates, reopenings, schema
changes, malformed/partial/duplicate rows, dynamic shells, cross-month scope,
original identity after failure, concurrent receipt arrival, exact retransmission,
deadline/cancellation, stale claims, legacy-store isolation and bounded-runner
dispatch. Real-source replay and temporary read-only UI verification are saved
separately. The 4178 preview remains pinned to reviewed `9dd4779` pending review
and a separately coordinated switch; no public deployment or main merge.

Final stage validation: 50 focused tests passed, including 11 new event-source
tests; full bundle 231 components, 5,913 counted tests, zero failures. Temporary
desktop/mobile source-to-UI checks passed with six Treasury and four Fed events,
zero browser/network errors and 25,907 protected files unchanged. The first
temporary browser check ran before the server listened and retained its failed
connection receipt; a readiness-confirmed run passed in a new directory. The old
4178 endpoint was then read back at `9dd4779`, still showing its original four
BLS events and unchanged scope. The temporary event preview was stopped.

Acceptance: `data/runtime/options-weekly-sources/event-stage1-acceptance.json`,
SHA-256 `7ac87cf2345f2eaec3bf141d2a45b690d38b54c9772a87c0d29bb32b3bb4badd`.
The receipt links exact originals, copied envelopes, source view, browser result
and validation logs. No new scheduled source attempt is implied by this acceptance.

## First finite continuation started

Implementation `8c3e089e1e80248e5b2b9a8be6ddab409fbeef69` started run
`f1aa4896-0b42-4ecc-9b89-786e86955dbc` at 05:46:06.353 UTC. Its deadline is
17:46:05.993 UTC (13:46:05.993 EDT); the ten-source, six-hour, 20-request bounds
above are recorded in the manifest. The first eligibility is 09:38:44.499 UTC
(05:38:44.499 EDT), derived from existing receipt clocks. Startup readback at
05:47:01 UTC found PID 23512 present, WAITING, zero attempts and empty stderr.
This confirms startup/waiting only. Actual scheduled acquisition and eventual
terminal acceptance remain pending; they must not be inferred from PID presence.

Local plan, launch and equipped-process readbacks are retained under
`data/runtime/options-weekly-sources/continuation-20261011`. Stop explicitly:

```powershell
npm run options:weekly-sources -- --stop --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id f1aa4896-0b42-4ecc-9b89-786e86955dbc
npm run options:weekly-sources -- --status --workspace C:/projects/Alpha-weekly-source-integration-20261011 --run-id f1aa4896-0b42-4ecc-9b89-786e86955dbc
```

Do not start a second process or change this run's implementation to accelerate
its first eligibility. Stop/verify explicitly before any replacement. The old
two-calendar acceptance run remains expired and its original receipts unchanged.

## Independent review correction

Both target-week endpoints must lie within the captured Fed month. September 28–October 2 against an October receipt now remains PARTIAL_PERIOD, as does October 30–November 3. The same-month no-match case remains distinct. Twelve event-source tests pass after this projection-only correction. Actual target-week Fed rows are one Speech and three Discussions. The existing finite runner retains its loaded 8c3e089 implementation and manifest; no restart, configuration, request parser or acquisition behavior changed. Eight headline sources first become eligible around 09:38 UTC and two event sources around 11:27 UTC. BLS/FOMC calendars are excluded from that ten-ID batch. The 20-request budget can end the run before its 17:46:05.993 UTC deadline.
