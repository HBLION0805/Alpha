# Exact ETF prices and prospective paper verification

September 17, 2026. Owner continuation of the daily-decision milestone.
Design: [V3 scope](specifications/OPTIONS_SNAPSHOT_PRECISION_V3.md).

## Confirmed defect and correction

IBIT observations of `43.195000` at 11:27 New York and `43.335000` at 13:49
were valid fractional-cent prices. The legacy `snapshotCents` conversion rejected
them and produced null. Its generic `UNDERLYING_UNALIGNED` diagnostic combined
price and time failures. The earlier attribution to a 6.18-second clock gap was
incorrect: both observations satisfied the unchanged sixty-second receipt limit.

New V3 plans retain the exact USD string and validate integer micro-USD values.
They independently report invalid prices and missing, future or stale underlying
clocks. Option premiums, ticks, fees, allocation, stop/target and time-exit checks
are unchanged. Frozen V1/V2 plans, source copies, reports and fingerprints retain
their original behavior. The frontend identifies the frozen model and shows
price precision separately from the original reported diagnostic.

## Actual-source evidence

The existing September 17 V2 rehearsal received a later admissible independent
quote at 14:05 New York, with IBIT quoted at a whole-cent price. Its unchanged
plan now has an entry at the 10:20 ask of $1.46 and an exit at $1.37, calculated
from the 14:05 bid of $1.38 less the declared $0.01 exit allowance. One contract
produces a $9.00 gross loss, $0.09 estimated fees and a $9.09 modeled net loss.
The saved closed result and review independently recover using copied sources
alone. This is a prospective engineering paper result, not a brokerage trade.

The planned 11:10 exit was not observed then. The 11:27 and 13:49 rejections and
the full intervening path gap remain visible; no past stop/target or exit was
backfilled. A losing result does not by itself establish a strategy mistake.
The exact-price correction is supported by a reproduced software defect; any
claim about its counterfactual market PnL would require separate evidence.

A separate V3 engineering plan was registered at 14:01, before its 14:05–14:10
entry window and 14:14 time exit. It shares the existing tracked contract ID,
uses one contract and the same $2.10 limit, $0.10 maximum entry spread, $0.01 exit
allowance and dated fee assumptions. Current acceptance and final source clocks
are recorded in [the precision checkpoint](status/snapshot-precision-v3.json).
It accepted the 14:05 ask at $1.40 and independently exited on the 14:14 bid at
$1.36 after the $0.01 allowance. Estimated fees are $0.09 and modeled net PnL is
-$4.09. The exit's actual IBIT source price was `43.405000`: V3 accepted that
fractional-cent observation with the original clock limits intact. The closed
result and review recovered using source copies alone; the nine-minute path gap
remains explicit. Both rehearsals have zero actual trades and uncalibrated outcomes.
The user-triggered reads belong to this conversation; recurring collection was
not changed and no scheduled execution is inferred from them.

## Product boundary and verification

The [daily decision milestone](status/daily-decision-milestone.json) distinguishes
the bounded actual-quote engineering acceptance from strict source/execution
qualification and strategy validation. Both daily cards remain WATCH because
qualified ETF OHLCV/setup evidence and sufficient trend history are missing.
Public failures remain visible; BEA and SEC failed at the natural 14:00 refresh,
while the other four original and three focused feeds succeeded.

Commands run: `node node_modules/tsx/dist/cli.mjs scripts/options-snapshot-paper.test.mjs`
passed 109 tests; `node scripts/alpha-validate.mjs` passed 4,546 reported tests
across 173 components, including strict type checking. Tests cover exact prices,
invalid input, the sixty-second nanosecond boundary, preserved legacy behavior,
prospective V3 enrollment, copied-only recovery and escaped UI diagnostics.
Fifteen existing stored records verified before the new observations; four old
September 17 records also recovered in isolation. The matched local service was
restarted and the actual frontend displayed the precise source values and model
versions at desktop and 390px mobile widths. Private capture and owner-trade files
remain outside Git.
