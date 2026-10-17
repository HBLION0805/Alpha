# Declared structure comparison delivery

Task OPT-STRUCTURE-COMPARE-1. September 7, 2026.
Base commit: `ba48874`. The Owner requested the next independent module after
declared portfolio diagnostics and previously authorized saving, commits and
pushes. Initial worktree was clean. This delivers a comparison module; it does
not complete the entire system or start a trade.

## Behavior and use

Compare LONG_CALL, LONG_PUT, BULL_CALL_DEBIT, BEAR_PUT_DEBIT, BULL_PUT_CREDIT,
BEAR_CALL_CREDIT, LONG_STRADDLE and LONG_STRANGLE. Each request uses one GLD/IBIT
symbol, common expiry, declared reference price and separate $1,000 scenario.
Contracts are standard American 100-share options with equal whole quantities.
The engine infers structure from legs and rejects mismatched labels, ratio or
naked shorts, mixed expiries/ETFs and inconsistent reused contract snapshots.
See [specification and primary references](specifications/OPTIONS_STRUCTURE_COMPARISON_V1.md).

```text
npm run options:structures -- --demo
npm run options:structures -- --demo --save <new-id>
npm run options:structures -- --input fixtures/options-structure-comparison/comparison.synthetic.json --save <new-id>
npm run options:structures -- --verify <saved-id>
```

Entry uses buy asks and sell bids. A quoted simultaneous liquidation uses long
bids and short repurchase asks. Both relevant sizes, receipt/freshness checks,
consistent cross-leg clocks/source and the declared underlying are required.
Unknown or unusable inputs stay explicit; fees/slippage require a declaration
reference even when zero. Consistent timestamps are not proof of executable
combined liquidity or independently synchronized side/size clocks.

Signed intrinsic payoffs minus entry and cost reserves are evaluated at zero,
all strikes and the unbounded right tail. Exact reduced rational break-even
prices and flat zero-PnL intervals survive; display scenarios do not define the
extrema. An all-loss terminal payoff is retained, not hidden by a zero-clamped
maximum gain. Debit/credit premium anomalies are flagged, not recommended.

Only single-leg alternatives compose the unchanged retail feasibility engine
using its unvalidated 20% stop and 2R research assumptions. No multi-leg stop,
target, valuation before expiration, assignment/exercise, separately legged
execution or lifecycle is inferred. The $50 allocation/$25 terminal-stress
benchmarks compare declared quantities; no favorable comparison establishes
broker collateral, an allowed multi-leg policy or portfolio capacity.

## Actual local rehearsal

Recorded **2026-09-07T18:28:18.712Z**:
`data/runtime/options-structure-comparison/structure-rehearsal-20260907.json`,
artifact hash `6409fc36a6ffce3ddb01f32307eaaf2fcc29abdb9c265eacd33ca826be80dc6b`.
It contains two synthetic comparisons, ten candidates each: eight shapes,
one unavailable-cost alternative and one larger-quantity alternative. Eighteen
are calculable, two are cost-unknown. These are not execution or outcome counts.

The local JSON example was independently saved as `structure-input-20260907`,
hash `f27b156c33300164446a1998b3827d43c7a3d89ae46234cef22e2f436fac18b4`.
Both artifacts recomputed in separate CLI processes. Actual recording clocks
are September 7; the September 8 quote/scenario clocks are hypothetical.

| Synthetic GLD alternative | Net entry debit (negative = credit) | Terminal maximum loss including declared reserve | Diagnostic |
| --- | --- | --- | --- |
| Long call | $20.00 | $20.20 | Single-leg research economics composed |
| Bull call debit spread | $9.00 | $9.40 | Capped terminal gain $90.60; no multi-leg lifecycle |
| Bull put credit spread | -$7.00 | $93.40 | Exceeds $50/$25 comparison benchmarks |
| Long straddle | $40.00 | $40.40 | Exceeds $25 terminal stress benchmark |
| Long strangle | $24.00 | $24.40 | Benchmark comparison does not approve an entry |
| Missing fee declaration | $20.00 quoted | Unknown | No net payoff curve is produced |
| Three long calls | $60.00 | $60.20 | Exceeds $50/$25 comparison benchmarks |

All strikes, prices, fees and reserves above are synthetic. The $7 credit does
not release $93.40 of theoretical exposure. Actual broker collateral and
temporary assignment exposure are unknown. The terminal loss figure is not a
guarantee about an early close or resulting stock positions. No structure is
ranked, selected or assigned a success probability.

## Files, review and validation

- New typed input: `src/contracts/OptionsStructureComparison.ts`.
- New engine, builders and tests under `src/engines/options-structure-comparison/`.
- New bounded offline CLI and tests: `scripts/options-structures.mjs` and
  `scripts/options-structures.test.mjs`.
- Example: `fixtures/options-structure-comparison/comparison.synthetic.json`.
- Narrow `.gitignore`, package scripts and aggregate registration; specification,
  this delivery/checkpoint and focused README/architecture/decisions/changelog/
  roadmap/handoff/operations/AGENTS notes.

Focused engine tests: **43/43**; I/O tests: **16/16**; TypeScript typecheck
passed. Tests include all eight structures on both ETFs, independent direct-leg
arithmetic over a dense price grid, extrema outside displayed points, exact
fractional roots, zero intervals, fee erosion, price-sign/width anomalies,
liquidity/clock/origin/identity/quantity checks and unchanged single-leg outputs.
Storage tests cover unknown evidence, actual-versus-hypothetical clocks,
duplicate decoded JSON keys, strict UTF-8/depth/size limits, links, immutable
artifacts, rehash-modified outputs, synthetic-demo provenance and restart.
No test can certify real liquidity, account permission or strategy profitability.

The full validation result and protected source/host hashes are recorded in
[the delivery checkpoint](status/structure-comparison.json). Runtime files remain
ignored; no old portfolio, paper/research, review, source, dashboard, export or
frozen collection record is rewritten. No live source/account/order call occurs.
Public OIC and Robinhood educational/reference pages were inspected; they did
not update any fee, account declaration, risk policy or market evidence.

Final aggregate validation: **3,297/3,297 tests across 129 components**, zero
failures, 67,003 ms. The bundle passed TypeScript and repository checks. Its
warnings were the expected uncommitted working tree and Windows LF/CRLF
conversion notices, reviewed before commit. No implementation test failed.
Post-validation SHA-256 comparison confirmed **502/502 protected files
unchanged**, including the actual shared host automation file. The host hash
remains `f1fad742f21584171c41d738e744a58e1f27f2be9c518a5d29a6936cbb713310`.
Both saved artifacts also recomputed identically in separate CLI processes.

## Limits and next step

This is independently declared terminal mathematics, not options pricing over
time. Volatility, time decay, early exits, exercise, assignment, stock delivery,
combined execution and account-specific margin are not modeled. The existing
portfolio engine remains long-single-leg only; this module cannot extend it
by relabeling a spread as a cheap long premium. Hashes prove local consistency,
not provider authenticity or an original brokerage event. Local-file source
byte hashes are retained references, not signatures; verification uses saved
inputs without asserting availability of the original file.

Independent holdout/sample-partition validation is useful further local work.
Actual eligible-session source evidence, retention/size/timing qualification,
account declarations and costs still precede a Robinhood paper adapter and any
market validation. The September 8 09:30-09:50 New York opening collection and
v6 daily restoration stay unchanged. Automatic orders, brokerage transactions,
10% size escalation, paid data and account tools remain outside this task.

Git delivery follows the Owner's standing authorization after diff review and
validation; final revision and repository status are confirmed in the conversation.
