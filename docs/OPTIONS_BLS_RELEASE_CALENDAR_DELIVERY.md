# BLS scheduled-release context delivery

Task: OPT-CALENDAR-1. Date: 2026-09-07.

## What changed and why

Added `BlsReleaseCalendarEngine`, a separate script-owned fixed public transport
and recovery journal, the `options:release-calendar` command, synthetic fixtures
and focused tests. Registered commands/tests and updated architecture, decisions,
roadmap, handoff and README. This supplies future economic release times that
headline history alone does not provide. The
[specification](specifications/OPTIONS_BLS_RELEASE_CALENDAR_V1.md) preceded code.

The restricted parser validates the observed BLS timezone/calendar profile,
unfolds text and converts Eastern times with DST checks. Unknown source metadata,
cancelled/tentative releases, empty schedules and failed latest retrievals remain
distinct. Changes are tied to the receipt of a new snapshot; absence from a
snapshot never implies cancellation. No event proximity becomes a trading signal.

## Actual source and recovery evidence

One standalone inspection of the [official BLS ICS feed](https://www.bls.gov/schedule/news_release/bls.ics)
completed at 06:00:00.864Z. A separate first runtime request began at
**2026-09-07T06:08:21.466Z** and completed at **06:08:21.599Z**. Both returned
80,672 UTF-8 bytes with SHA-256
`92a350111ace106deaab5584e4084366bd367b594a0d0bad116008d82d63e501`.
The runtime record fingerprint is
`7229c7f2bd344c03156d0ad3657c93fdfaec1d8309fd88edbc6c1f929864a850`.

The journaled calendar contains **313 events**. All lack DTSTAMP and
LAST-MODIFIED; receipt time is not retroactive publisher knowledge. Next-seven-day
context includes September 9 employer compensation costs, September 10 PPI and
September 11 CPI/real earnings. These times agree with the
[official September schedule](https://www.bls.gov/schedule/2026/09_sched.htm).

`data/runtime/options-release-calendar/refresh.json` and `recovery.json` retain
the actual command outputs. The source journal is independent of the paper,
historical, headline, Treasury and BTC journals. The earlier evidence-export
package predates this component and remains unchanged; it does not include BLS.

## Validation and remaining limits

Commands: TypeScript no-emit check, both focused calendar suites, one actual
`--refresh`, independent `--report`, protected-artifact hash checks and the
aggregate validation bundle: **2,912/2,912 passed**, 111 components, zero failures,
50,382 ms. This includes 31 pure-calendar and 32 transport/recovery tests.
Final measured results are recorded in
[the checkpoint](status/bls-release-calendar.json).

Focused testing found and corrected an escaped-backslash parser issue; initially
adapted I/O expectations still referred to Treasury fields and were corrected to
the calendar model. Fault tests cover interrupted writes and require explicit
recovery rather than rewriting damaged data. No actual source/recovery failure
occurred. Software tests establish implementation behavior, not strategy accuracy.

Assumptions: a single local writer, the observed BLS ICS subset and installed
America/New_York timezone rules. Schema changes fail visibly. The 26-hour
refresh-age threshold measures retrieval cadence only; original publisher
freshness, non-BLS/unscheduled events, actual released values and surprises remain
unknown. Local checksums are not publisher authentication or off-device backup.

Next: integrate this independently verified source into the existing daily
context workflow while preserving the frozen opening study. This task adds no
automatic calendar refresh, account/order access, fee/risk modification or source
replay. September 8 option collection remains pending and depends on the existing
host/app, network and available Codex execution capacity.

Git: this focused change is reviewed, committed and pushed under the Owner's
standing authorization after validation; see Git history for the final commit.
