# Robinhood observation to conditional contract comparison

Owner continuation, September 17, 2026. ETF-OBS-01, current model/high reasoning,
medium complexity. Extend the existing desk and frontend; no dependency or source
schedule changes. Alpaca remains optional, not a prerequisite for observations.

The product must distinguish usable descriptive observations from strict setup
qualification. Keep the original adapter, rule engine, audit reports and canonical
guidance byte-for-byte behavior. A new read-only projection consumes verified saved
Robinhood five-minute captures, a matching optional source audit and saved guidance.
It never converts an omitted flag to false or imports strict bars automatically.

## Observation contract

- Recompute source checks. Only complete, regular-session, raw, structurally valid
  prices may supply descriptive calculations; unknown interpolation alone does
  not hide received prices. Explicit synthesized bars or structural errors do.
- Preserve each original candle, source/request/receipt clocks and unknown flags.
  Draw saved candles, mark audited conflicts, label the chart historical and
  unqualified. It is a local rendering of the saved MCP response, not a copy of
  the brokerage website or a live feed.
- Show open-to-last move and a separate trailing 3-versus-12 five-minute close
  comparison. These fixed, untested descriptive windows are 15/60 minutes, not
  calibrated predictors. A conflicting paired close withholds the directional
  comparison; do not pick an interval as correct. Short history remains missing.
- Show the trailing six-bar (30-minute) high/low as future watch references only.
  Withhold them when the matching audit conflicts on relevant high/low fields.
  An absent/unusable audit is explicit, not evidence of agreement. Do not label
  reference levels proven support/resistance or historic profitable triggers.
- Provide two future-only conditions: two subsequent completed five-minute closes
  above the range high (bullish) or below the range low (bearish), with return into
  the range invalidating the idea. These are untested discussion conditions, not
  registered rules, evaluated triggers, instructions to enter, or premium stops.

## Contract comparison

For each condition, compare the same-side saved option sample. Keep every original
canonical blocker and stop/target/cost assumption visible. Sort descriptive sample
fit using existing contract/delta/spread/budget mechanics, then distance to 0.50
absolute delta, shorter allowed DTE, spread, and ID. The delta target is explicitly
an untested comparison assumption, not win probability. Do not increase quantity.
Retain at most three references per side and show all sample/rejection counts.
Show exact quote clocks and warn if option evidence predates the bar-window end;
after-hours/old quotes cannot become current entry limits. Unknown net targets
stay unknown. No time exit is invented. Both scenarios remain unconfirmed.

## Integration and persistence

The existing desk adds the observation projection before its strict-rule section.
Existing source audit/source details remain visible below. No production writes
occur on GET. Add an explicit CLI observation snapshot, copying source/audit/
guidance inputs into the existing append-only store, with fingerprint/recomputation
and copied-only recovery. Bound files and catalogs as before. No new HTTP mutation
or timer is required. Old record kinds and fingerprints remain unchanged.

## Acceptance

Test unknown versus explicit true flags, damaged grids, exact-price trends, short
history, matching versus unrelated audit, conflict suppression, future-source
rejection, deterministic option fit with all original blockers, stale/misaligned
clocks, unknown costs, immutable source inputs, copied-only recovery and English
escaped UI. Inspect desktop/mobile and run dependent suites plus aggregate checks.
Save actual observations as retrospective research; do not claim validation of a
future setup, strategy profitability, or a completed trading qualification gate.

## Website observation boundary

Read-only visits on September 17 showed public GLD/IBIT one-day line charts, not
logged-in candlestick controls. Both pages included Overnight labels and separate
snapshot/statistics values without a precise per-value market clock. Keep those
observations separate from 09:30–16:00 MCP bars; do not merge their values or claim
the website confirmed each candle. Account login/order controls were not used.
