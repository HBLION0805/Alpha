# Long-option entry research boundaries V1

Owner request: September 16, 2026. Assess the quoted breakout, trend pullback and
pattern-resolution ideas and add usable boundaries to GLD/IBIT guidance.

## Decision and scope

These are three untested candidate setups, not high-win-rate or doubling claims.
They may overlap; do not count them as independent confirming votes. A correct
underlying direction does not by itself establish an option profit. Review IV,
time decay, premium, spread, costs and the planned exit separately.

Add a shared, read-only boundary checklist to existing daily cards and Host brief.
Do not introduce a pattern detector without qualified ETF OHLCV and prospectively
declared parameters. Current price snapshots, sparse official closes, analyst
prose and option candles cannot confirm any setup. Each must remain
NOT_ASSESSABLE, with probability and expected return unknown. This release
records the research rules and missing evidence; it does not activate a new
trading signal or alter canonical guidance decisions.

## Three candidate setups

1. Trend breakout: declare the prior range, bar interval, lookback, close-beyond
   buffer and same-session volume baseline before the trigger. Require a completed
   ETF bar outside the range and the declared confirmation. A return inside the
   range or excessive distance from the trigger invalidates that entry idea.
2. Trend pullback continuation: establish a trend from completed ETF bars; declare
   the retracement zone and maximum depth before the pullback. Require the zone
   to hold and a completed-bar resumption trigger. Breaking the trend structure
   invalidates the idea; touching support alone does not confirm a reversal.
3. Key-level pattern resolution: declare the key level and consolidation bounds
   before the break. Require a completed ETF close beyond the declared boundary
   with its confirmation; a failed break back into the pattern invalidates it.

Interval, lookback, buffers, volume thresholds, chase limit, invalidation price
and exact time exit are not supplied by the quotation. Leave them undeclared;
do not invent fitted thresholds or choose levels after observing the outcome.
Call/put direction must follow the confirmed ETF setup, not an automatic mapping
from a bullish/bearish headline.

## Option and proxy boundaries

- Count saved sampled contracts by the canonical candidate DTE: expired, 0DTE,
  1–13 DTE, existing 14–45 DTE research scope, over 45 DTE, and unknown. Missing
  DTE is unknown, never zero. This is not a complete option-chain census.
- 0DTE requires a separate method and is outside current guidance scope. Merely
  being non-0DTE does not make 1–13 DTE eligible or establish a safe expiry.
- GC/gold spot may provide context for GLD; Bitcoin spot/futures may provide
  context for IBIT. They are not the traded ETF, and their absolute levels,
  volume, sessions and futures roll/basis cannot be copied as ETF triggers.
- Existing quote freshness, spread/size, budget, cost and calendar checks remain.
  Event-driven price moves can be researched prospectively, but neither event
  direction nor favorable post-event option returns are assured. An IV decline
  can offset a favorable underlying move.
- Historical IV context and a move/time/IV scenario remain missing. No numeric
  premium forecast, probability, profit or automatic position is created.
- Keep $100–$500 / $1,000, unknown global fees, all source schedules and the frozen
  September 17 engineering paper plan. A successful paper pipeline does not test
  these patterns. Their future evaluation needs prospectively frozen rules and
  independent outcomes after spreads/costs, including failed/false breakouts.

## References and acceptance

Primary education, reviewed September 16, 2026:
- [OIC option price behavior](https://www.optionseducation.org/referencelibrary/faq/option-price-behavior)
- [Cboe 0DTE overview](https://www.cboe.com/tradable-products/0dte)

Verify DTE boundary/unknown handling, no promotion from prose or option/futures
bars, preservation of source inputs and original actions/costs, escaped English
UI and identical Host/card boundary output. Run decision-card, guidance and
workbench tests, typecheck and repository checks. This small projection does not
change engines, schemas, persistence, source transports or paper semantics.
