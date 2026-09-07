# Context cutoff v2 delivery

Task OPT-CONTEXT-CUT-2. September 7, 2026.

The five-source reconstruction now includes FOMC meeting-date receipts. This
addresses a missing source in later decision reviews: a calendar retrieved after
a selected cutoff must not be treated as information already received then.
The original four-source engine and `--at` command remain reproducible.

Run `npm run options:context-cutoff -- --at-v2 2026-09-07T07:32:40.377Z` for the
opt-in report. The cutoff is explicit, canonical UTC and no later than actual
command start. Reports use stored receipts, not source update or meeting dates.
The command does not save reports automatically or retrieve any source.

## Actual local evidence

Measured at **2026-09-07T15:59:33.362Z**:

| Check | Result |
| --- | --- |
| One millisecond before first FOMC receipt, 07:32:40.376 UTC | Zero selected FOMC retrievals |
| Exact first receipt, 07:32:40.377 UTC | One retrieval, 16 listed meetings |
| Full current FOMC history | Two retrievals validated before prefix selection |
| Existing 04:30 UTC v1 context | Original context hash reproduced exactly |
| v2 original-source context link | Matches that same v1 hash |
| Protected runtime, source and host files | All 455 compared hashes unchanged |

Four separate actual reports and a receipt are saved under
`data/runtime/options-readiness/context-cutoff-v2-*`. The old context hash is
`62e925af61c861b5c9b4109c445c96f05db3dcec25cf7443a701ac7858d5d146`.
The newer reconstruction clock changes its artifact hash, not the earlier
receipt-selected context. These are retrospective local reconstructions;
they do not prove that an actual decision used these records.

## Implementation and verification

Changed files: new v2 TypeScript composition/tests; the existing cutoff CLI and
its integration tests; package and validation registration; specification,
delivery/checkpoint and focused README/AGENTS/architecture/decisions/changelog/
roadmap/handoff/operations-index notes.

The v2 engine validates the full FOMC history, filters by receivedAt, preserves
failures and isolates invalid sources. Its context hash excludes later valid
appends and construction clocks; its artifact hash retains actual check times.
Missing/busy/unsafe/corrupt stores remain distinct. Date-only precision, unknown
confirmation/release timing and no-cancellation-inference semantics survive.

Focused commands: TypeScript typecheck; v2 engine tests **15/15**; cutoff CLI
integration tests **23/23**, including existing v1 coverage. Tests exercise
boundary equality, delayed receipts, failures, corrections, later invalid
records, hash stability, locks/links and no source calls/writes. Full-bundle
results and final preservation verification are recorded in
[the delivery checkpoint](status/context-cutoff-v2.json).

No source parser/repository, accepted journal, quote Host, schedule, risk limit
or old output version changed. No paid source, account/order call or modeled
trade ran. Candidate notebooks and actual frozen plans remain intact.

Risk/assumption: receipt clocks are local stored evidence; durable journal append
time, original publisher vintage and all information known to the user remain
unknown. Integrity failure in later stored history deliberately blocks the
component until investigated. Reconstruction supplies neither a trading edge
nor execution authority.

Next is the existing September 8 09:30-09:50 New York collection and quality
review. A source-specific paper adapter still needs eligible observations and
explicit cost/fill assumptions. The context can later be attached to that
reviewed workflow; no adapter qualification is implied here. Git review,
commit and push follow the Owner's standing authorization.

Full validation passed **3137/3137 tests** across 121
components, zero failures, 63,711 ms. All 455 protected hashes still
matched after validation. Warnings were the expected uncommitted-change and
Windows line-ending notices; no source, engine or test failure occurred.
