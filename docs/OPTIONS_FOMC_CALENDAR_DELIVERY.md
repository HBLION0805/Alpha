# Official FOMC date-calendar delivery

Task: OPT-FOMC-1. Date: 2026-09-07.

## Change and purpose

Added `FomcCalendarEngine`, pure tests, a synthetic HTML fixture, fixed public
transport, separate local journal and CLI/I/O tests. Added the runtime Git ignore
rule and registered commands and
aggregate validation; updated the overview, architecture, decisions, roadmap and
handoff. The [specification](specifications/OPTIONS_FOMC_CALENDAR_V1.md) preceded code.

The official [Federal Reserve calendar](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
supplies listed meeting date ranges and projection markers. The parser selects
the receipt's New York year and the following year, retains source date labels
and explicitly leaves intraday release times and independent confirmation unknown.
The page-level update date is separate from actual receipt and is not a per-event
publication timestamp. Free-form date notes and linked statements are not parsed.

`npm run options:fomc-calendar -- --refresh` makes one anonymous fixed-URL GET;
`--report` reopens local history. The transport bounds the entire operation to
twelve seconds and 512 KiB, rejects redirects/unsupported encoding/metadata and
sanitizes failures. The separate 32 MiB/366-record journal recomputes every saved
assessment and enforces path, single-writer, scope and uncertain-write guards.
It does not alter source/report versions already accepted by other components.

## Actual source and recovery

The first runtime request began **2026-09-07T07:32:40.219Z** and ended
**07:32:40.377Z**. Source SHA-256:
`5323477f048cac67eae138d0429227712e4a7adf212232860709a0444066f4b4`.
Receipt fingerprint:
`dd5e812a59c54ec5956ff6106292fccaff53777bd47e62a078944e6fe0f98d48`.
Journal SHA-256:
`bc92776d33b468e937ea1a2c935668d3aff7f9f6fc802067d7864c415accb40c`.

Independent recovery matched the saved assessment and all sixteen listed
2026/2027 meeting ranges. The current thirty-date horizon includes September
15-16, marked as associated with economic projections. The source's last-update
date is August 19, 2026; it does not mean Alpha knew these dates then. The prior
inspection is retained separately and was not backdated into the runtime journal.

Runtime files are under `data/runtime/options-fomc-calendar/`: retrievals.ndjson,
refresh.json and recovery.json. Twenty-two protected existing artifacts and the
active v4 heartbeat hash match. No Robinhood, credential, account, order, trade
review or existing source journal was changed. The fixed public source uses no
subscription or paid access.

## Validation, risks and next step

Commands: TypeScript no-emit, 28 pure and 34 isolated I/O tests, one actual refresh,
independent `--report`, protected-file/host hash checks, Git diff review and
`npm run alpha:validate`. Final aggregate: **3,074/3,074 tests**,
118 components, zero failures in 59,293 ms. Measured results are in
[the checkpoint](status/fomc-calendar.json). Source inspection,
fixture tests and the first runtime retrieval/recovery all passed. The first
aggregate run caught the missing Git-ignore rule for the new runtime directory;
the files were untracked, never staged or committed. The exact directory ignore
was added before rerunning validation. An actual-report wrapper also had a console
label typo after writing its checkpoint; independent checkpoint readback passed.

Tests cover year rollover, date precision, cross-month/year ranges, invalid or
overlapping dates, unknown confirmation, missing metadata, bounded non-executing
markup, failed/changed sources, A-to-B-to-A snapshots, independent receipt times,
corrupt/rehashed journals, concurrent writers, deadline/cancellation failures and
safe source/command scope. Source HTML drift fails visibly; it is not silently
repaired or used to manufacture a forecast.

Assumptions and risks: the date-derived key is not an official event UID. Missing
keys cannot prove cancellation/rescheduling. Current public HTML is not original
historical publication evidence. Exact durable append clocks remain unknown;
the row-count/history/byte limits are fixed and visible. A full journal requires
reviewed rotation, not truncation. Thirty-date calendar context is not a calibrated
signal, a precise risk window, complete event coverage or replay/trading authority.

Next: separately integrate this verified source into daily context collection.
The active v4 heartbeat, readiness v1/v2, brief, four-source cutoff and existing
export package do not include FOMC in this standalone delivery. Preserve their
versions and accepted bytes. Review, commit and push use the Owner's standing
authorization; no brokerage transaction is authorized.
