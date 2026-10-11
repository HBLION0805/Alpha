# Full fixed-company attempt, IR and SEC stage — October 11, 2026

The Owner authorized bounded checks of the remaining 32 official IR sites and
independent public issuer EDGAR submissions. This stage completes the attempt
matrix, not complete event coverage. The existing finite runner is unchanged.

## Actual calls and retention

Four IR batches (10/10/10/2), four SEC batches (10/10/10/6), and one two-source
Cboe batch made 70 bounded requests. A separate five-request plan selected only
public destinations explicitly present in original redirect headers or page
links: ASML, ServiceNow, Adobe, Applied Materials and Dell. These are independent
saved responses, not silent redirects or retries. No 403 site was retried.
Requests ran 06:11:11–06:17:46 UTC (02:11:11–02:17:46 EDT), one per selected URL,
at least 1.1 seconds apart, 12 seconds and 512 KiB maximum per response. Plans,
75 full envelopes (including partial/failed bodies), and 75 copied imports are
ignored/local under data/runtime/options-weekly-sources/company-stage3. Imports
make no network requests. The earlier seven issuer-stage originals remain exact.

IR denominator: attempted 36/36; parseable named source 11/36; with a target-week
company event 1/36; no match in parsed scope 10/36; failed/unparsed 25/36;
unattempted 0/36. Earlier failed URLs remain visible even when an independent
page parses, producing PARTIAL_SOURCE for AMAT, ADBE and DELL. A successful HTTP
response alone is not semantic coverage. There are twelve parsed IR events in
all returned named sections; only AMAT's October 13 Investor Breakfast
Presentation lies within October 12–16. It is a COMPANY_EVENT, not earnings.
Future MSFT/AMD/KLA/Lam/Arm/WDC/Adobe dates remain exact source claims. Explicit
empty upcoming sections from Broadcom, CrowdStrike and Dell are narrow no-match
results, never proof of no company events anywhere. Printed and machine clocks
are retained separately; unresolved timezone/clock discrepancies never become
inferred UTC times. Historical references and frozen plans remain unchanged.

## SEC identity, metadata and limits

All 36 public data.sec.gov submissions endpoints returned HTTP 200. CIKs came
from the independently hashed saved SEC company_tickers.json original received
2026-10-10T20:36:44.824Z, SHA256
bb1521ff938ce1217343362f335aae521d9978b105229eabef69124ac24bbb1c.
The original 798,703-byte registry was copied locally without a new source read;
its receipt and exact bytes remain available. Every fresh response must agree on
CIK and ticker before parsing. This is independent SEC evidence, never recovery
of an unavailable IR page and never proof of machine authentication.

The projection shows 533 submitted-filing metadata rows accepted in the 30 days
before each original receipt, capped at 100 per company. DELL has 110 qualifying
rows, with ten explicitly omitted from display. ASML retains six rejected old
rows with absent primary documents and/or unsupported historical dates; its
source is PARTIAL_SOURCE. Raw responses retain all rows. NOW has zero matching
recent filings within this source/window; that does not establish no filings or
future events. Full filing/exhibit bodies and paged historical files were not
fetched. Filing date, report date and acceptance clock remain distinct.
No submitted filing is converted into a prospective earnings date or event.

| Company | IR state | IR parsed | Week events | SEC state | SEC 30-day rows shown |
|---|---|---:|---:|---|---:|
| AAPL | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 18 |
| MSFT | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 19 |
| GOOGL | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 21 |
| AMZN | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 6 |
| META | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 15 |
| NVDA | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 11 |
| TSLA | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 2 |
| AVGO | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 8 |
| AMD | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 4 |
| TSM | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 32 |
| ASML | ACQUISITION_FAILED | no | 0 | PARTIAL_SOURCE | 0 |
| AMAT | PARTIAL_SOURCE | yes | 1 | OBTAINED_PENDING_REVIEW | 2 |
| LRCX | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 3 |
| KLAC | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 5 |
| MU | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 5 |
| ARM | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 4 |
| QCOM | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 11 |
| ORCL | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 20 |
| CRM | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 8 |
| NOW | ACQUISITION_FAILED | no | 0 | CHECKED_NO_RECENT_FILINGS | 0 |
| PANW | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 18 |
| CRWD | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 37 |
| ADBE | PARTIAL_SOURCE | yes | 0 | OBTAINED_PENDING_REVIEW | 6 |
| PLTR | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 9 |
| SNOW | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 36 |
| SNPS | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 9 |
| CDNS | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 13 |
| ANET | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 15 |
| CSCO | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 17 |
| VRT | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 14 |
| DELL | PARTIAL_SOURCE | yes | 0 | OBTAINED_PENDING_REVIEW | 100 |
| HPE | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 13 |
| STX | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 29 |
| WDC | CHECKED_NO_MATCH | yes | 0 | OBTAINED_PENDING_REVIEW | 19 |
| APH | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 1 |
| ETN | ACQUISITION_FAILED | no | 0 | OBTAINED_PENDING_REVIEW | 3 |

## External blocks versus local integration gaps

- HTTP 403: AAPL, GOOGL, AMZN, META, NVDA, TSLA, TSM, MU, QCOM, ORCL, CRM, SNOW,
  SNPS, ANET, CSCO, VRT, STX, APH. No bypass or repeated request.
- CDNS request failed before an HTTP status; underlying cause UNKNOWN.
- HPE HTTP 200 exceeded the local 512 KiB response limit. This is a local bound,
  not proof of an external access block or an empty calendar.
- ASML's official migration target has no parsable event dates in saved HTML;
  PLTR is a dynamic shell; PANW/ETN fetched pages remain unadapted event scopes.
- NOW's explicit target returned another redirect. The finite follow-up budget
  ended without automatically following it; this is not a verified external denial.
- Current parsers intentionally accept only observed named sections. General
  article text, search snippets and historical featured events do not fill gaps.

## Cboe product scope

The earlier 12-row options-holiday table remains intact. The 2026 expiration PDF
returned HTTP 200 but exceeded 512 KiB, leaving a saved partial original marked
BODY_TOO_LARGE. No complete pipeline PDF or reliable visual date-to-symbol mapping
was admitted. The separate official document-view context distinguishes equity/
index/ETF/ETN standard expiration, AM-settled index last-trading dates, VIX and
SPX/XSP weekly categories. It is not a contract-level calendar. The official
schedule-notices page returned HTTP 200 but only a dynamic search shell, not a
parsed notice list. These gaps keep options coverage PARTIAL_SOURCE; publication
dates cannot be substituted for effective dates or expiration dates. No hidden
endpoint, larger response cap, or trading-calendar override was introduced.

Official references:
- https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data
- https://cdn.cboe.com/resources/options/Cboe2026OPTIONSCalendar.pdf
- https://www.cboe.com/markets/us/options/notices/schedule-update/

## Operating and rollout boundary

New sources use the existing explicit options:weekly-issuers CLI, not the active
finite runner. SEC refreshes are serial and spaced by 1.1 seconds. All sources
retain at-least-hourly repeat eligibility, ten-ID batches, no redirect, no retry,
and immutable original storage. Source claims are read in the same frozen
snapshot as coverage and metadata lineage. Fixed-source catalog registration
never implies a successful attempt. Per-company IR and SEC counters are separate.

Run f1aa4896-0b42-4ecc-9b89-786e86955dbc still uses loaded 8c3e089, eight existing
headline feeds plus Treasury/Fed events, six-hour intervals, 20 requests and the
17:46:05.993 UTC deadline (budget may end it sooner). BLS/FOMC calendars and these
issuer sources are excluded. No process replacement or schedule change occurred.
4178 remains 9dd4779; earlier stages 4a667a3/4987878 were independently cleared.
This new stage needs its own review before the coordinated preview switch.
Frozen 2dabc114, original technology dirty state, CPI 15:50 and the challenge ledger
remain protected. No source evidence grants quote, Paper-fill or order permission.

## Validation and retained acceptance

Final code passed 78 focused tests (including 12 new company-source tests) and
the full validation bundle: 233 components, 5,941 passed, zero failed. Temporary
4180 desktop/mobile verification passed with no browser/network errors or overflow;
25,907 protected files retained exact hashes. The temporary server was stopped.
4178 still serves 9dd4779. Previous stage originals and completed runner journals
were hash-verified unchanged; the active finite run still has its STARTED/WAITING
records, zero requests and pending first/terminal acceptance. No live Paper gate
advanced. This is engineering validation, not complete source coverage.

Local acceptance: `data/runtime/options-weekly-sources/company-stage3/acceptance.json`
SHA256 `ca7784a27ee9df56535a58b38e641bb95db592f415560ed5bb19256d5a9bd637`.
Raw originals, response failures, source identity copies, UI evidence and receipts
stay ignored/local. Review this stage before the coordinated preview update.
