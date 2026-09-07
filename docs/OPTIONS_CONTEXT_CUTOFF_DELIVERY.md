# Journal context cutoff delivery

Task: OPT-CONTEXT-CUT-1. Date: 2026-09-07.

## Change and purpose

Added `OptionsContextCutoff`, its pure tests, `scripts/options-context-cutoff.mjs`
and I/O tests, plus package/validation registration. Updated the README,
architecture, decisions, changelog, roadmap and handoff. The
[specification](specifications/OPTIONS_CONTEXT_CUTOFF_V1.md) preceded implementation.

The command `npm run options:context-cutoff -- --at <canonical-UTC-time>` first
validates each complete current journal, then builds source reports using only
observations whose stored receipt/discovery clocks meet the selected cutoff.
Request start and source publication/economic dates cannot move a later receipt
earlier. Failures and correction order survive selection. Source errors remain
independent, fixed and explicit; corrupt later records are never silently skipped.

Stable context fingerprints bind selected input prefixes and reports. A separate
artifact fingerprint binds actual component checks and construction time. The
command performs no network access, appends, repairs, trades or report-file writes.
Its normal recovery uses temporary writer locks. A separate explicit wrapper saved
the actual result after successful recovery without overwriting any prior report.

## Actual local result

Reconstruction at **2026-09-07T07:02:03.795Z**, cutoff
**2026-09-07T04:30:00.000Z**, is saved in
`data/runtime/options-readiness/context-cutoff-0430.json`.

All four current stores recovered. Selected context contains **118 headline
observations, one Treasury retrieval, zero BTC retrievals and zero BLS calendars**.
BTC and BLS were first received later and do not enter the earlier context.
Context SHA-256: `62e925af61c861b5c9b4109c445c96f05db3dcec25cf7443a701ac7858d5d146`.
Artifact SHA-256: `9c9d2ceff85fbc3eecfdfdf579a0038208dd41c4a763e60355b7a81651938a9a`.

Twenty-one protected source/study/report files and the active v4 heartbeat hash
matched before and after reconstruction. All existing trade reviews and candidate
notebooks remain byte-identical. There was no source request or new trade.

## Validation and limitations

Commands: `npm run typecheck`, the focused TypeScript and I/O suites, the actual
local reconstruction wrapper, protected-file/host hash verification, Git diff
checks and `npm run alpha:validate`. The aggregate passed **2,997/2,997 tests**,
115 components, zero failures in 53,072 ms. Measured results are in
[the checkpoint](status/context-cutoff.json).

The 27 pure and 15 I/O tests cover delayed receipt, publication-date substitution,
cutoff equality, later-append invariance, source failures, invalid future history,
correction order, clock regressions, independent feed completion order, missing/
busy/corrupt/unsafe sources, unknown metadata and no network or source writes.
An initial test referenced the wrong Treasury last-known field and was corrected;
review also made headline ordering per source to match parallel feed completion.

Assumptions and risks: this is a reconstruction performed now. Stored clocks do
not prove exact durable append time, original publisher vintage, complete past
knowledge or an actual historical decision. Sequential recovery is not an atomic
cross-store snapshot. Each source retains its original gaps, stale-data rules and
fixed size/history bounds. Earlier context does not grant replay/trading authority
or establish strategy win probability. Current readiness/export versions remain
unchanged. No paid step, host change, credentials or account/order tool is involved.

Next: qualify actual opening-window quotes and execution assumptions before using
the context consumer in a separately specified real-price replay. Git changes are
reviewed, committed and pushed under the Owner's standing authorization after
validation; accepted runtime sources and host configuration remain unchanged.
