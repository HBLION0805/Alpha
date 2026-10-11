# Reviewed supplements in the read-only weekly projection — October 11, 2026

The Owner requested visible integration of the reviewed Cboe/PANW evidence and
bounded completion of the remaining non-403 local gaps. This stage adds the
supplements to the existing `weeklyCurrentInputs` frozen request snapshot and
the existing weekly source panel. Reads perform zero network calls and writes.
Original owner-plan snapshots, issuer receipts, source limits and runner remain
unchanged. Exact source/review hashes bind this observed batch; this is not a
new collector, registry service or automatically refreshed source catalog.

## Visible mapping

The current October 12–16 source timeline contains 23 records: the prior 15,
seven reviewed Cboe category/date rows and one ASML announcement. The original
plan timeline remains its saved version. A visible supplemental section shows
each original URL, path, response hash, receipt hash, receipt clock, review clock,
receipt freshness, product/date meaning and retained acquisition problems.

- Cboe October 12, 13, 14, 15: SPX/XSP Weeklys expiration categories only.
- Cboe October 14: VIX Weeklys expiration category only.
- Cboe October 15: last trading day for expiring standard AM-settled equity
  index options only; never an equity/ETF last-trading-day rule.
- Cboe October 16: equity, equity index, ETF and ETN standard-series expiration.
- ASML October 14: Q3 2026 financial-results announcement. Original source says
  release at `07:00 CET` and investor call at `15:00 CET`. These printed clocks
  remain unresolved and are not converted to UTC or silently corrected for DST.

The Cboe PDF, image and visual-review artifact each pass their fixed hash gates.
These dates are category context, subject to change; no individual contract,
exercise cutoff, settlement time, quotation, account or order is qualified.
The independently reviewed PDF mapping remains an attributed Codex page-image
review rather than Owner approval. Dynamic Cboe notices remain unparsed.

Nine historical rows are displayed separately: three PANW featured events,
three HPE Investor Highlights and three ETN Analyst Conferences. None enters the
future-week timeline, increases IR success counts, or verifies occurrence.
HPE's fourth highlight combines two conferences with distinct dates; the
unresolved row is explicitly retained instead of assigning one date to both.

Original issuer-ingestion counters remain 36 attempted, 11 parsed, one company
with a week event, ten no-match within named parsed scopes, 25 failed/unparsed,
zero unattempted. The additional ASML announcement is independently labeled and
increments earnings-event evidence only. This avoids relabeling old failed
URLs or treating PANW/HPE/ETN history as successful upcoming calendars.

## Six-request official follow-up

The saved plan bound this batch to six exact official URLs already present in
original links or Location headers: at most 12 seconds each, 1.1-second spacing,
no credentials, automatic redirects or retries. Only two specific HPE pages
used a separate 2 MiB cap; other pages retained 512 KiB. Generic acquisition
limits and the existing finite runner were not changed.

| Source | Result | What is now usable / what remains |
|---|---|---|
| HPE original homepage | HTTP 200; complete 862,611 bytes | Local original-cap gap repaired. Three exact historical highlights visible; a combined two-date row remains unresolved. No full upcoming-calendar claim. |
| HPE linked news/events | HTTP 200; exceeds dedicated 2 MiB | Partial original retained. This remains a local bounded-acquisition gap, not provider refusal or no events. No more requests. |
| NOW exact second redirect target | HTTP 403 | Redirect adaptation was attempted. This new target provides actual external denial evidence, separately from the earlier redirects; no bypass or retry. |
| ETN linked presentations/webcasts | HTTP 200; complete 187,244 bytes | Three historical conference rows visible. Undated quarterly-result references do not become dated calendar events. |
| ASML linked quarterly results | HTTP 200; complete 216,613 bytes | Explicit October 14 financial-results announcement now visible, with printed CET clocks retained. |
| PLTR linked events page | HTTP 200; complete 6,701 bytes | Still a dynamic shell with no usable event dates. No hidden endpoint, browser bypass or inferred empty calendar. |

All six original envelopes and the immutable request plan stay ignored/local in
`data/runtime/options-weekly-sources/source-projection-stage5`. No original
403 source was retried. The previous 18 denied companies remain denied at their
attempted URLs; NOW's new official target adds one independently observed 403.
CDNS was not retried; its no-response failure remains UNKNOWN.

## Remaining action boundaries

The real external blocks are the 18 prior 403 companies plus NOW's newly denied
target. If the Owner wants those specific dates, an authorized official-page
copy/export they can access, or legitimate access restoration, can supply new
evidence; no login, purchase, subscription or bypass is inferred as required.
CDNS failure cause is unknown, so no specific user fix is justified. HPE's
large event page and PLTR/Cboe dynamic pages remain local integration/data gaps,
not evidence of provider refusal and not user approval requirements. They are
visible limitations; this bounded batch does not repeatedly fetch to eliminate
all gaps. No user action is needed to view the now-integrated usable evidence.

## Integrity and verification

Both reviewed source time and later mapping-review time must be at or before
the assessment clock; events cannot be backdated into an earlier view. Receipt,
raw-body, PDF, rendered-image and visual-review hashes are independently bound.
A damaged supplementary source is displayed as an issue without removing other
valid evidence. Frozen per-request inputs prevent a late file change from
altering one part of a response. Missing supplementary originals do not create
files, make source calls, or manufacture evidence.

The unclosed-comment P2 is separately committed as 9d75ade: both parsers remove
closed comments and comment tails through EOF. Two negative cases were added;
23/23 targeted tests passed, with all 82 old issuer outputs and PANW historical
interpretation unchanged. The new projection has ten focused integrity/UI tests.
Final full-suite and temporary desktop/mobile results are recorded in the stage
status file. No 4178 switch is authorized by the test server or this mapping.

The original 10/12 frozen experiment, CPI workspace/15:50 schedule, challenge
ledger, source cadence, strategy/risk settings and finite runner are preserved.

## Final validation and review handoff

The complete final suite passed: 235 components, 5,962 tests, zero failed.
Focused tests passed 55/55. Two temporary 4180 desktop/mobile runs passed,
including expanded supplement-panel screenshots, all product labels, ASML printed
clocks, source hashes, nine historical rows, no overflow/errors/outbound requests
and blocked writes. All 25,907 protected files retained exact hashes. The temporary
server was stopped; 4178 remains 9dd4779. All 82 prior issuer receipts replay
exactly, and prior source/acceptance artifacts retain their hashes.

Local acceptance: `data/runtime/options-weekly-sources/source-projection-stage5/acceptance.json`
SHA256 `fabc029ff1c066aefbffc264ecbdece81d4d936058cc8694833aa6d99a0484c4`.
Temporary verification configuration is retained under
`data/runtime/options-workbench-development/readonly-preview-supplement-stage5-20261011`.
This mapping is ready for independent review. The final preview candidate is
not finalized until review clears the unclosed-comment fix and this integration;
no active preview switch has occurred.
