# Robinhood ETF historical response adapter V1

September 17, 2026. Task ETF-SOURCE-01, current model, medium complexity.
Owner restarted the existing market connection and authorized continuation of
ETF trend-to-contract research. No paid dependency or new source schedule.

## Observed contract and scope

The reloaded `get_equity_historicals` schema supports symbols, explicit UTC range,
interval, bounds and adjustment_type. This increment uses only GLD/IBIT,
five-minute regular-session raw prices (`none`). Returned bars are left-edge
labeled and include decimal OHLC, share volume, session and optional interpolated.
The actual September 17 response contains 78 bars per ETF, all with `reg` session,
but omits interpolated on every bar. Omission must remain unknown, including when
volume is positive. A returned bar close is not the official daily settled close.

## Architecture and evidence

Add a pure response adapter alongside the setup engine and extend the existing
setup IO/CLI/view. Save the exact request, response and actual request/receipt
clocks, with copied-input recomputation. Existing plans/imports/reports retain
their original validator and hashes. Original market captures, QQQ fixture
authorization, canonical guidance, paper plans and schedules are unchanged.

Validate requested identity and result uniqueness, interval/bounds, decimal OHLC,
integer share volume, regular-session grids, ascending complete coverage, exact
micro-USD and source clocks. Preserve not-found, empty and omitted results as
explicit gaps. Do not accept malformed numbers, contradictory missing identities,
duplicate results or unexpected symbols. Retain original response even when bar
quality is insufficient. Unknown flags, nonregular sessions, missing/unfinished
bars and invalid OHLC block setup use. Completion inferred from the elapsed bar
window is not independent upstream finality certification.

Show a separate source-observation panel in the existing research desk, with
request/receipt dates, exact OHLC, volume, coverage and a per-bar inspection table.
Descriptions compare first-bar open to last-bar close only when structurally
valid. They are retrospective price observations, not a technical recommendation.
Unknown/interpolated bars are labeled individually, never silently reclassified.
Even locally shape-valid responses retain caller-export provenance limitations.

No automatic import into the strict research store, rule registration, paper
enrollment, official-close insertion or canonical direction promotion. Future
source semantics must be independently resolved before using these records in
prospective rules. No source retry solely to obtain a more convenient response.

## Acceptance

Test missing/true/false flags, wrong session/interval/identity, unfinished or
future bars, precision, gaps/duplicates, invalid OHLC/volume, empty/not-found,
copy-only recovery, tamper rejection and escaped English UI. Record and recover
the actual two-ETF response, preserving all 156 unknown flags. Run focused and
dependent tests, typecheck and aggregate validation; inspect desktop/mobile.
Keep real source receipt separate from source qualification and strategy benefit.
