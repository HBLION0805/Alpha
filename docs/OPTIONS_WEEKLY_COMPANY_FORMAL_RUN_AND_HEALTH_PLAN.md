# Formal six-hour batch and read-only health view plan — October 11, 2026

Status: **PREPARED, NOT STARTED; independent review required**. This document
prepares one executable finite company batch and the next workbench health-view
change. It neither launches a process nor claims that the health panel is already
implemented. Existing 4178 remains the reviewed ae8a88c archive. The original
ten-source process, frozen experiment, CPI/15:50 schedule and challenge ledger
remain unchanged.

## Executable scope, budget and end

[Prepared configuration](config/weekly-company-refresh-formal-20261011.json)
selects **ten unique sources** from the 47-source configurable company universe:

| Family | Selected sources | Reason for selection |
|---|---|---|
| IR | MSFT, AMD, AVGO, AMAT events, ADBE events | Previously parsed official scopes, including next releases and company-event context |
| SEC submissions | AAPL, TSM, MSFT, NVDA, ASML | Independent company metadata, prioritizing AAPL/TSM without pretending their IR pages recovered |

The source interval is **360 minutes**. The single selected batch is `formal-10`,
serial, with a **total maximum of twenty attempts**, not twenty per source or
per round. The intended first eligibility is **2026-10-11 13:40 UTC / 09:40 EDT**;
the absolute cutoff is **20:00 UTC / 16:00 EDT**. In the absence of failures and
delays, this permits at most two visits per selected source, around 13:40 and
19:40 UTC. Each source's second eligibility is calculated from its actual first
request, not from a fabricated shared slot. Budget or explicit stop can end the
process earlier; 403/429 ends the batch, other failed sources disable themselves.
No success count or round completion is promised in advance.

The other **37 configurable company sources are not selected**. The default
catalog's six batches remain available for future explicitly bounded selections,
but they are not queued and no follow-on run is scheduled. Acquiring all 47 once
would require at least 47 requests, exceeding this twenty-request run. Do not
silently chain batches or reset budgets to present complete coverage.

The saved read-only preparation at 07:46:39.803 UTC verified all ten sources'
latest successfully parsed original and six-hour eligibility by 13:40. The three
recent acceptance sources become eligible at 13:30:50.124 (AAPL SEC),
13:30:50.882 (MSFT IR) and 13:30:52.817 (TSM SEC). The other seven become eligible
between 12:11 and 12:18 UTC. Recheck current evidence before actual launch:
another explicit acquisition or a new failure can change eligibility.
The [prepared status](status/weekly-company-formal-preparation.json) records the
exact repair commit, configuration hash and per-source clocks; all actual-run
and six-hour acceptance fields remain NOT STARTED / NOT RUN.

After independent review, the exact command is:

```powershell
npm run options:weekly-company-runner -- --run --workspace C:/projects/Alpha-weekly-source-integration-20261011 --config docs/config/weekly-company-refresh-formal-20261011.json --batch formal-10 --first-at 2026-10-11T13:40:00.000Z --until 2026-10-11T20:00:00.000Z
```

Do not execute it before review clearance. The `preparedWindow` JSON is explicit
preparation metadata; CLI timing comes from the shown `--first-at`/`--until`
arguments. The run must start before its first-at timestamp. If review misses
that point, preserve this unexecuted plan and prepare a new future window; do not
backfill or silently move it. Once launched, retain its run ID, manifest/config
hash, last/next eligibility, every original and terminal receipt. Confirm shutdown
with `--status --run-id` and process identity; do not infer it from a clock alone.

No company process is currently running. The completed dfd9242 three-source
acceptance used a separately pre-hashed **one-hour** configuration; it proves
that bounded due execution occurred, not this six-hour plan or default cadence.
This formal plan's acquisition, repeat-spacing and terminal acceptance are all
**NOT RUN** until actual evidence exists.

## Health panel insertion into the existing workbench

The planned UI belongs in **Weekly plan → Current source coverage**, immediately
before the current-source event list, adjacent to the saved supplement panel.
The code location is `weeklySourcePanel` in `apps/options-workbench/weekly-plan.js`.
It must remain read-only and use the existing combined weekly-source data root.
Page load/reload must never launch a process, acquire a source, create a lock,
write a receipt or offer a start/retry button.

The initial visible summary should distinguish these facts:

| Panel item | Evidence to show now | Meaning |
|---|---|---|
| Existing public-source process | Ten selected sources; original finite deadline; first acquisition pending at last verified readback | Process configuration is separate from acquisition success |
| Company collection | 47 configurable / 0 currently running / 3 sources in completed hourly acceptance | Do not show 47 as actively refreshing |
| Prepared formal batch | 10 selected / 20 maximum requests / 13:40–20:00 UTC / NOT STARTED | Preparation is separate from an active run |
| Company IR coverage | 36 attempted / 11 parsed / 25 failed or unparsed scopes | SEC success does not repair IR coverage |
| Company SEC coverage | 36 parsed metadata sources, with retained partial/rejected/omitted counts | Filing metadata is not future earnings, filing bodies or approved conclusions |
| Annual PDF | Saved reviewed mapping; metadata check disabled; earliest October 18 06:38:22 UTC | No live calendar refresh or contract qualification |

Show UTC and America/New_York clocks together. Every source row needs:
family/company/source ID; official URL and exact scope; configurable versus
selected batch; enabled/disabled reason; last request, receipt and latest parsed
success separately; next eligible time; **next scheduled time only for a verified
active manifest**; budget used/maximum and deadline; last result; original path,
hash and parser/review state. A completed/stopped run gets no next-scheduled
clock even if its sources will later be eligible. An absent, unreadable or
unresolved process owner must display UNKNOWN/INTERRUPTED rather than green.

## Remaining-source health must stay specific

Do not collapse all failures into provider refusal or make the Owner solve local
integration gaps:

- Eighteen original IR denials plus NOW's later official target are HTTP 403
  evidence. Preserve exact URL/receipt clocks and keep them disabled with no
  automatic retry. Do not replace original attempts with a later summary.
- CDNS has no HTTP response; cause remains UNKNOWN.
- HPE's events archive is locally truncated at 2 MiB with unknown full size;
  its separately complete homepage yields historical context only.
- PLTR is a complete client-rendered shell; no bounded browser adapter is
  integrated. It is not a size-limit failure.
- PANW/ETN history and ASML's exact saved release are source-bound one-time
  supplements, not active full event-calendar feeds. Preserve their dates and
  provenance separately from automatic company-source eligibility.
- Cboe dynamic notices remain unparsed. PDF metadata equality does not prove
  fresh bytes, review fresh dates or close the notices gap.

## Implementation and acceptance sequence for the health view

1. Add a bounded **read-only** company-health projection from saved configuration,
   verified issuer history and company/ten-source journals. Keep operational
   process health separate from immutable owner-plan evidence and the current
   source coverage counts. Define an explicit `assessedAt` and retain parse/store
   issues; no future-source receipt may enter an older snapshot.
2. Render the summary and per-source details in the existing panel with escaped
   text/links, useful local/external reasons and last/next clocks. Keep static
   supplements and currently configured sources visually distinct. No collection
   controls or client timer that calls a provider.
3. Verify missing/corrupt stores, disabled PDF despite retained IDs, stopped versus
   interrupted runs, as-of clocks, partial SEC data, 403 versus local truncation,
   unchanged immutable plans, zero GET writes/network calls, desktop/mobile
   overflow and the protected-file baseline.
4. Save the UI change in a separate reviewed commit. Only after independent
   clearance prepare an exact-code temporary preview, verify it, and coordinate
   any later 4178 switch. This plan authorizes no switch now.

This is the concrete next UI plan, not a delivered dashboard claim. The immediate
review package is the PDF-disable correction plus the unstarted finite config;
remaining source acquisition and health-view implementation retain their own
acceptance records.
