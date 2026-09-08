# Full-chain activity review, account board and daily close delivery

September 7, 2026 New York. Source baseline: `a0bf29a`.

Alpha now preserves and reviews a complete authorized GLD/IBIT option-chain
snapshot, displays all active-volume candidates and original modeled-account
diagnostics, and has the Owner-authorized seven-session daily close schedule
configured. No real scheduled closing capture has occurred yet.

## Delivered behavior and purpose

- `RobinhoodChainSurvey.ts` checks scope, pagination, UUID joins, clocks, decimal
  values and missing/invalid quote quality; it retains all contracts. Declared
  absolute volume, volume/OI and cross-sectional median flags identify review
  candidates without asserting historical abnormality, direction or causes.
- `RobinhoodChainComparison.ts` compares independently recomputed saved captures,
  retaining added/absent IDs and both counters. Unchanged, regressed or unknown
  quote clocks suppress derived changes. Differences across dates are not extra
  traded volume and do not independently establish the volume/OI session.
- `options-chain-review.mjs` saves exclusive bounded UTF8/JSON/raw/HTML/manifest
  artifacts and recomputes them in a fresh process. Its optional paper section
  calls the original paper/portfolio verifier and preserves the exact artifact.
  Originals and source journals are not modified. The CLI itself has no MCP.
- `options-chain-review-render.mjs` provides the English local operator board:
  expiry/strike map, every flagged contract, all-case tables, evidence limitations,
  existing cash/risk blockers and reviews. Source strings are escaped; there are
  no scripts, external assets, forms or order controls.
- `options-chain-close-host.mjs` is an injectable bounded host orchestration
  function with four allowlisted market reads, active plus same-day expired
  enumeration, 20-contract batches, failure retention and actual clocks. The
  local time router keeps morning context and after-close records separate.

The spec was reviewed before implementation and amended when the Owner explicitly
authorized daily closing records. Original paper, portfolio, quote-pilot and
market-evidence engines remain unchanged. No source-specific execution adapter,
brokerage account access, strategy calibration or auto-orders were added.

## Actual baseline evidence

The full [dated analysis](OPTIONS_FOMC_CHAIN_BASELINE_20260907.md) documents the
individual-expiry ranges, largest-volume examples, flagged-contract interpretation
and primary exchange/Fed/BLS/OIC sources. Actual source calls: two chain requests,
22 instrument pages, 106 option-quote batches and one equity-quote request (131
market reads, zero account/order reads).

Raw capture: `data/runtime/options-chain-survey/fomc-baseline-20260907.raw.json`,
5,447,714 bytes. Board: `data/runtime/options-chain-survey/fomc-baseline-review-20260907/index.html`.
Created September 8 00:32:51.753 UTC. Board fingerprint:
`sha256:ad0164eac58f18636778344f60cb8874674c9b7e025e6c948eab9083739c230c`.
All 2,100 instruments have matching quotes (1,606 GLD, 494 IBIT); all quote-refresh
dates are September 4. The 224 flagged candidates include 58 from September 18.
No quote qualifies as a current or future-session observation.

The saved original paper-account section retains seven cases, five closed
reviews and four candidate lessons. Its synthetic $990 equity and $899 conservative
available cash remain independent from the actual market snapshots. Existing
daily-loss, unknown event review and cost-review blockers remain visible. These
are not the Owner's brokerage balances or losses. No newly closed trade exists
from which to invent a new success/failure review or trading mistake lesson.

## Scheduling and verification

[Host manifest](OPTIONS_CHAIN_CLOSE_HOST_V1.json), [runbook](OPTIONS_CHAIN_CLOSE_RUNBOOK.md)
and [actual activation](status/chain-close-activation.json) specify the existing
gld-ibit heartbeat. September 8, 9, 10, 11, 14, 15 and 16 close at 16:20 New York;
original daily 09:00 context remains. The app accepted and persisted all eight
checked fields. Independent dateutil recurrence expansion selected exactly the
two requested clock times; weekend afternoon wakes yield without source reads.
End-of-series restoration uses immutable v6, never deletion of the news task.
The cancelled opening pilot, scheduled development and quarter-hour development
reports remain disabled. No paid source or new task was created.

Tests cover all-case preservation, pagination, duplicate/wrong IDs, clocks,
missing/zero values, exact median arithmetic, expired contracts, source failures,
HTML injection, immutable/tampered/hard-linked artifacts, original paper recovery,
comparison suppression, host function closure and actual-time routing. Commands:

```text
npm run typecheck
npm run test:options-chain-survey
npm run test:options-chain-review
node node_modules/tsx/dist/cli.mjs scripts/options-chain-review.mjs --verify fomc-baseline-review-20260907
node scripts/alpha-validate.mjs
```

See [delivery checkpoint](status/chain-review.json) for final counts, preservation
and validation output. Early type diagnostics and documentation-link checks were
corrected before final validation. Browser visual inspection verified the landing
metrics, expiry navigation and expanded IBIT September 11 activity table. Its
first two calls showed the retained $46/$47 quotes, volume/OI and source clocks.
No actual scheduled close or official closing-tape validation is claimed.

## Limits, assumptions and next step

The five listed GLD maxima are exercise-price strikes, not forecasts. Listing
mechanics explain plausible differences; exact listing/addition reasons remain
unknown. A reported option refresh clock is not independent volume/OI dating.
The historical-bars tool has no historical volume field, and prints/multi-leg
linkage are absent. Causes remain hypotheses. Daily closing snapshots cannot
validate intraday stop execution or win rates. The source contracts are not
silently inserted into the original 14–45 DTE paper lane.

Host execution depends on app, computer, network, tool availability and allowance.
The activation test establishes configuration only. Missed sessions are gaps;
old quotes never become new prices. A source call already running may outlast
the collector's request-start deadline. Interrupted exclusive artifacts are kept
for investigation rather than overwritten or automatically retried.

The fixed ten-workstream totals remain 4 local / 3 partial / 3 unvalidated.
Collection and operator integration advanced within their existing partial
workstreams; the six first-real-price gates remain three local components plus
three open gates. Next review the first actual closing receipt, expired coverage,
clock freshness and reported-counter comparison. Qualification of quotes, costs,
account rules and a source-specific paper adapter remains separate work.

Git delivery stages only focused source, tests, commands and documentation;
runtime market captures and generated boards remain local and ignored.
