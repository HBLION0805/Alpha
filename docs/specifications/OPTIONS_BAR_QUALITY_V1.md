# Option candle evidence v1

Reviewed for implementation, September 8, 2026. The next event-research step
qualifies saved option OHLC evidence and exposes its actual limitations in the
existing frontend. GLD/IBIT only; no new schedule, source, account or order route.

Reuse the immutable Robinhood capture format, original validator and exclusive
capture writer. A new pure projection runs after the original assessment and
retains its NO_REPLAY status. A read-only desk verifies the saved source hash,
artifact hash and original assessment before deriving charts. No accepted capture,
event registration, journal or outcome is rewritten.

For each requested contract/window, retain its own instrument identity, interval,
request/receipt/recording clocks and every expected slot. Minute and five-minute
windows must be aligned, closed and within one weekday 09:30-16:00 New York
envelope. This envelope does not verify holidays, early closes or halts. Out-of-
envelope requests remain explicit unsupported coverage rather than invented bars.
Missing contracts, leading/trailing/internal gaps, interpolated=true and omitted
interpolation flags remain separate. Explicit false is a source declaration, not
independent proof of trades. Unknown never defaults to false. Do not infer the
flag from changing OHLC prices, a complete grid or a null/absent not_found list.

All raw prices remain exact strings. A descriptive open-to-final-close return
is available only for a complete grid of explicit noninterpolated bars from a
standard contract. Return arithmetic is an exact rational number of basis points.
No VWAP (bar volume is absent), ETF candle trend, event causality, stop/target
ordering, executable return or probability is derived. Even a complete OHLC grid
does not expose bid/ask, size or intrabar ordering.

The Event research page displays the latest saved market-origin capture, not the
latest favorable/complete capture, with receipt age and exact range. Synthetic
captures are counted separately. It shows raw unknown-flag candles in gray,
explicit noninterpolated candles in color and missing/interpolated slots as gaps;
it never joins across gaps. Accessible slot tables retain all source prices and
statuses. Studies and candle evidence remain separate: retrospective histories
cannot fill frozen prospective endpoints or authorize guidance.

The bounded reader accepts at most 100 saved capture artifacts, validates all
entries and never silently falls back after corruption. CLI --report and
--inspect read saved artifacts only. There is no network or mutating HTTP route.
The original options:robinhood-capture command remains the import/save path.

Acceptance: original semantics preserved; meaningful gap/interpolation/clock/
identity/decimal/hash/recovery tests; frontend escaping and mobile rendering;
actual bounded five-tool market capture with retained unknown metadata; focused
and aggregate checks; unchanged ledger, studies and scheduler evidence.
