# Frozen option activity follow-up

Delivered September 7, 2026 New York. The Owner approved testing whether the
observed activity candidates can provide useful future option research evidence.
This subsystem freezes the cases before future data, compares nearby controls,
retains costs and failures, and saves independently recoverable candidate reviews.

## Actual registered study

`fomc-activity-20260908` was registered at `2026-09-08T02:06:12.694Z`, with a
post-payload-write receipt at `2026-09-08T02:06:13.077Z`, before the first declared
reference window. It preserves the verified baseline bytes and assessment clock:
2,100 contracts, **224 candidates, 167 distinct controls, 57 unmatched candidates**.
Source quotes are still September 4; registration does not backdate knowledge.

Study fingerprint:
`sha256:10f3ed20b968a31d0da0b1635b9653d422bde88164a5a9c59583f8040e4359bc`.
The initial report was recorded at `2026-09-08T02:06:51.865Z` with fingerprint
`sha256:684264f2af931e027df1ef440d5c631273c2b2dc82c8de332381225f2a437fb5`.
There are **zero future session boards and zero evaluable primary outcomes**.
Its 135 candidate notes concern currently known matching, expiry and small-OI
limitations; they are not 135 failed trades or approved mistake rules.

See [dated machine evidence](status/activity-study.json) and the
[specification reviewed before implementation](specifications/OPTIONS_ACTIVITY_STUDY_V1.md).

## Interpretation

The fixed primary comparison is September 8 closing Ask to September 9 closing
Bid for one hypothetical long contract. Later declared dates through September 16
are secondary horizons. September 18 expiry contracts have separate cohort
summaries. Calls and puts both use long-premium references; activity does not
identify buying, selling, spreads, institutions or the cause of a price move.

The complete report retains every candidate and control, source clocks, raw
reported counters, each price/cost outcome, unavailable reasons and paired
differences. The readable `review.md` shows every primary case. Missing/stale
quotes, insufficient displayed sizes, expired contracts and over-$50 entries
remain visible. Entry is never shifted later to rescue a failed case. There is
no invented expiry settlement, intraday stop/target path or compounded account.

Spread-only, illustrative base and stress scenarios are separate. Base assumes
$0.50 fee and $0.01/share adverse allowance per side; stress assumes $1 and
$0.02/share. These are declared sensitivity inputs, not verified Robinhood fees.
Positive reference returns alone cannot establish a tradable edge: source and
execution qualification, independent samples, dependence-aware analysis and a
future out-of-sample evaluation remain required. No 80% probability or allocation
increase is produced. Multiple contracts share the same market shocks.

## Implementation and operation

- `OptionsActivityStudy.ts` reuses the chain engine without changing its outputs.
  It freezes deterministic control selection and uses exact micro-dollar math,
  bounded integer return projections and explicit unavailable outcomes.
- `options-activity-study.mjs` reuses the existing exclusive safe-file helpers and
  baseline board verifier. Study payload/receipt and copied report inputs recover
  independently of the original source directories. Partial writes, hardlinks,
  tampering, future input clocks and unsafe paths fail closed.
- The [daily close runbook](OPTIONS_CHAIN_CLOSE_RUNBOOK.md) invokes only the
  offline update after normal capture, and after required final-day v6
  restoration. It adds no source calls, host fields or schedule. Identical input
  state verifies the existing report; new data or elapsed missing windows create
  a new immutable report. Previously saved reports retain their original clocks.
- Existing paper/research journals, reviews, notebooks, original 14–45 DTE paper
  eligibility, full-chain baseline, host manifest and v6 snapshots are preserved.
  Local storage is single-process and checksum/recomputation-based; it cannot
  authenticate the source or prevent a privileged user from replacing all files.

Commands:

```text
npm run options:activity-study -- --verify fomc-activity-20260908
npm run options:activity-study -- --update fomc-activity-20260908
npm run options:activity-study -- --verify-report fomc-activity-20260908 state-32262936e743da633884bdf7226651ce2bb21bac220579521db1a8387fe9e03b
npm run test:options-activity-study
npm run test:options-activity-study-storage
npm run typecheck
npm run alpha:validate
```

The new tests cover frozen selection, costs and exact prices, winning/losing/
unavailable cases, identity changes, quote/receipt windows, independent process
recovery, seven-session synthetic flow, immutable states and damaged artifacts.
Full validation and preservation results are recorded in the dated status file.
Final bundle: **3,672/3,672 tests passed across 150 components**, including 42
new engine tests and 24 storage/integration tests. TypeScript and Git whitespace
checks passed; 538 protected files and the active host hash were unchanged.
The first bundle caught missing Git-ignore entries for the new runtime folders;
those entries were added and the full bundle passed on rerun. No runtime source
or report was staged or pushed. Initial failure and final logs remain local.

The ten-workstream baseline remains **4 LOCAL_VALIDATED / 3 PARTIAL /
3 NOT_VALIDATED**. Workstream 10 now has a locally tested prospective descriptive
study, but signal validity/calibration acceptance is still NOT_VALIDATED.
The first-real-price-paper view remains three local components available and
three open gates: qualified quotes, source-specific adapter and actual-data run.
Next inspect the September 8 actual close evidence and then the September 9
primary comparison, retaining every missing or unsuccessful case.
