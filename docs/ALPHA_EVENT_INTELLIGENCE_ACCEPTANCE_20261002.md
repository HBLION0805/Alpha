# Employment Situation live acceptance audit — 2026-10-02

## Verdict

NOT ACCEPTED. Scheduled capture execution succeeded; the agreed event-to-historical-decision workflow did not.

The original seven windows (08:20, 08:29, 08:30, 08:31, 08:32, 08:35, 08:40 America/New_York) retained BTC observations. They retained zero BLS Employment Situation release observations, zero historical decision artifacts, and zero predeclared numeric invalidation rules. The 08:20 pre-state retained September 30 GLD/IBIT quotes and explicit underlying-price freshness blockers. It was an actual recording of stale knowledge, not current cross-asset coverage.

## Root causes and bounded repair

1. The collector refreshed and read the three-source supplemental feed (Fed speeches, EIA, CoinDesk) and then searched it for BLS. The existing test supplied a fictional supplemental BLS result, so it missed the real wiring failure.
2. The old generic BLS URL is an indicator overview, not the dedicated Employment Situation release feed. The repaired collector uses the dedicated fixed endpoint listed on the official BLS RSS page: https://www.bls.gov/feed/ .
3. Publisher timestamp metadata is not the same as public release availability. The exact dated archive URL now identifies this release even when its RSS timestamp precedes the scheduled release. The original publisher field remains unchanged; Alpha receipt is never backdated.
4. BLS and BTC retrieval now begin in parallel. One source failure does not erase the other. Missing data is not marked CURRENT; missing market source clocks are never filled with collection time.
5. Earlier pre-event snapshots are no longer discarded by selecting only the latest snapshot. Stale or insufficient pre-state data stays unavailable for current confirmation.
6. Normalized evidence is hidden until both receipt and parsing are complete. A historical decision cannot use evidence parsed after its cutoff.
7. An ordinary quote sample is not a detected price movement. Arrival-order claims require explicit movement-detection metadata; no detector output is fabricated for this live case.

## What was preserved

Before repair, the original case, collector, tests and hashes of all 21 original observations were saved to the private runtime acceptance directory. All 21 original observation files were verified unchanged after repair. No historical decision was manufactured. No expectation or Owner confirmation was changed.

The dedicated feed was first saved as raw evidence during repair at 08:50:16 ET. After correcting event identity matching, the release headline entered the event observation store at 08:53:24.328 ET. This is POST_WINDOW_REPAIR, not proof of on-time collection.

Replay at 08:30:30 and 08:40:02 contains no repaired BLS release and no historical judgment. Replay after the repair receipt can show the late release; it still has no original judgment and no trade authority.

## Verification

- Employment window regressions: 14/14 passed, including the actual fixed transport route with injected HTTP, source failures, parallel start, corrections, timestamp metadata, parsing visibility, retained pre-state history and no false price-lead claims.
- Existing Replay Engine, Replay IO, observation store, pre-state, case materializer and Replay Workbench tests passed.
- Existing public driver IO/CLI: 37/37 passed.
- Workbench: 61/61 passed.
- TypeScript strict no-emit check passed.
- The full alpha:validate bundle was not rerun in this repair turn.

## Remaining acceptance work

Structured official release values and revisions still need verified extraction. The live case still needs actual historical-decision generation bound to predeclared, checkable rules. GLD/IBIT immediate reaction coverage, explicit movement detection, full historical completeness semantics, and a genuine prospective unscheduled case remain incomplete. A later repair or re-analysis must not be used to pass the missed October 2 release window.

No broker accounts, positions or orders were accessed by this repair. executionAllowed remains false. RC1/main is not merged or replaced.
