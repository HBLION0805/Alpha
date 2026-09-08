# Option candle evidence delivery

September 8, 2026. [Specification](specifications/OPTIONS_BAR_QUALITY_V1.md) and
[dated verification](status/bar-quality.json). The Event research page now shows
saved GLD/IBIT option candles with explicit provenance, missing intervals and
source clocks. This extends the existing page; no new trading lane is added.

## Actual source check

Five authorized market-only calls resolved GLD/IBIT chains, rechecked the four
frozen October 9 contracts and retrieved one minute history for 14:27-15:27 New
York (end excluded). The four contracts are GLD $403 call/put and IBIT $44.50
call/put. The response arrived at 19:27:13 UTC and the original capture writer
saved it at 19:27:26.639 UTC on September 8.

All four histories contain 60 bars, 240 total. Every interpolation flag is
omitted: zero explicit false flags, zero explicit true flags, 240 unknown flags.
The prices change, but that does not prove the missing flags mean false. No
complete-window return or trend signal is enabled from this sample. This is
different from the old off-session sample whose bars were explicitly interpolated.

The source remains under the original immutable capture format at
`data/runtime/options-robinhood-data/captures/event-bars-20260908-1927.json`.
Artifact SHA-256:
`53e629c2042c5b5f6f729aa39f2d139c0790303dcd585fcf549facac2de23b26`.
The reader verifies the original source/record hashes and recomputes the original
assessment before deriving its display. A hash verifies local consistency, not
provider authenticity. Existing captures and original NO_REPLAY outputs remain.

## Behavior and boundaries

- A complete grid of explicitly noninterpolated source bars permits only an exact
  descriptive option-price return. It never enables a signal or execution.
- Unknown source candles are gray; explicit noninterpolated candles are colored;
  missing/interpolated intervals are gaps. The expandable table retains every
  source price and slot status. No line bridges gaps.
- Leading, internal and trailing gaps, missing responses, unsupported session
  envelopes and incomplete provenance remain visible. Latest means latest saved
  historical market capture; the desk does not substitute an older cleaner one.
- Option OHLC has no bar volume, historical bid/ask sizes or intrabar ordering.
  It does not provide ETF candles, VWAP, executable stops, event causality or a
  calibrated win rate. Weekday hours are not verified exchange-calendar evidence.
- These retrospective histories do not enter the frozen PRE/POST observations.
  The two PPI studies remain WAITING; the owner ledger has zero trades.

No new source schedule or Host fields were installed. Public hourly refresh and
the seven authorized close captures remain in place. No account/order calls,
paid data, new dependency or source-specific execution adapter were added. The
fixed progress view stays 4 locally validated / 3 partial / 3 not validated,
with 3 available / 3 open first-real-price-paper-flow gates.

## Validation and use

```powershell
npm run options:bar-quality -- --report
npm run options:bar-quality -- --inspect data/runtime/options-robinhood-data/captures/event-bars-20260908-1927.json
npm run test:options-bar-quality
npm test
```

The new commands only read local artifacts. Use the original
`options:robinhood-capture -- --inspect <local-input.json> --save` command for
authorized saved exports. There is no HTTP fetch/import or order endpoint.

35 focused tests passed. The aggregate passed 4,022 tests across 159 components,
including TypeScript, transport, secrets, Markdown and whitespace checks.
Desktop and 390x844 viewport checks displayed all 240 unknown candles, four
contract cards and 60 rows in an expanded contract table, with no page overflow
or console errors. The service was restarted with hourly public refresh enabled;
stored captures and both prospective studies recovered without journal appends.

Next qualify the source's omitted-flag semantics or obtain explicitly declared
noninterpolated evidence through an authorized source. ETF candle/volume data
and executable option quote paths still require separate qualification. Continue
assessing the frozen PPI windows when their actual records arrive; a complete
chart alone cannot advance the paper-trading gates.
