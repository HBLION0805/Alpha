# Robinhood collection closeout delivery

RH-CLOSEOUT-1 adds the deterministic acceptance report needed after automatic
collection. The existing observation review describes quote frames; this report
also accounts for recorded source failures, missing request evidence and each
completed minute of the declared window. It does not evaluate trade success.

## What changed and why

- `RobinhoodCloseoutEngine.ts` combines the unchanged observation review with
  sanitized attempt summaries. Half-open request slots keep future/open/elapsed
  phases separate from request, source-error, frame and usable-contract coverage.
  Coverage has a null denominator until a full slot has elapsed. A failed source
  call never becomes a fabricated quote or evidence of market inactivity.
- Missing completed slots are grouped into contiguous gaps. Each contract retains
  its own usable coverage, so one good quote cannot hide another missing contract.
  Repeated source clocks, stale data, late replies and off-window smoke frames
  keep the existing engine's exclusions. Diagnostic coverage is not win rate.
- The collector exports a reporting reader that takes its existing attempt lock
  before the study lock and validates saved artifacts. Raw provider reply bodies
  stay behind that boundary. Existing preparation/ingestion outputs are unchanged.
- `options-robinhood-closeout.mjs` recomputes reports and optionally saves bounded,
  exclusive, hash-sealed local artifacts. Earlier reports are reconstructed from
  their exact original frame/attempt references and assessment clocks; later data
  cannot rewrite their historical contents. Invalid files and references fail.
- Operational lessons retain actual first-known times, evidence hashes, candidate
  status, null trade outcomes and no strategy-change authority. Existing accepted
  trading lessons and journals remain untouched.
- The scheduled final step restores original news fields first, then invokes the
  tested `--save` command. The opening window, cadence, symbols, contract IDs and
  original restoration snapshot remain unchanged.

See the [reviewed specification](specifications/OPTIONS_ROBINHOOD_CLOSEOUT_V1.md),
[host runbook](OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md) and
[current checkpoint](status/robinhood-closeout.json).

## Validation and remaining work

Focused engine tests cover pending and completed intervals, slot boundaries,
missed windows, source failures, manual and unlinked automatic frames, stale and
repeated observations, late responses, multiple-contract partial coverage, exact
attempt/frame linkage and immutable output. Storage tests cover exclusive save,
retry/recovery, later records, fixed failure summaries, corrupt/rehash/renamed
reports, input changes, hard links, directory bounds, locks and clock rollback.

The real opening-study preflight saves a WAITING_FOR_WINDOW report at its actual
clock, with twenty future slots, no missed completed intervals, no attempts and
no frames. A second read verifies recovery without changing the saved report.
Actual source collection has not happened; the local preflight makes no market
calls. Exact commands, aggregate results, report receipt and host readback are
recorded in the current checkpoint. An initial strict TypeScript callback-narrowing
error was corrected before acceptance; compiler checks remain strict.
The first aggregate run also matched the metadata name `requests` against the
repository's Python HTTP-library pattern. Renaming this sanitized metadata to
`sourceCalls` resolved the false match; the network checker was not weakened.
Final aggregate validation passed 2,601/2,601 tests across 99 components in
42,754 ms. Focused engine and storage tests passed 23/23 and 19/19, respectively;
the existing collector and host tests passed 20/20 and 8/8. The actual host
closeout-prompt update was independently verified at `2026-09-07T03:34:01.831Z`.

The source-quality and NO_REPLAY gates remain intact even if every slot later
passes local diagnostics. Costs, account rules, independent side/size clocks and
execution semantics remain unresolved. Host timing, availability and model usage
limits can still prevent a scheduled run; a missing request record cannot prove
which external cause prevented it. Next examine actual opening-session coverage
and source quality before extending collection or designing a separate replay
adapter. No paid data, credentials, account/order calls or trades are added.

Changes are limited to the new engine/CLI/tests, a reporting export in the
collector, package/validation registration, current documentation and the
heartbeat's final report command. Baseline is `636b280` on
`codex/gld-ibit-options-foundation`; commits and pushes use the Owner's standing
authorization. Runtime reports and source files remain local and ignored by Git.
