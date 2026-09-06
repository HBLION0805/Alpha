# Alpha Roadmap

Current delivery adds the GLD/IBIT market-evidence import and qualification gate. The
[machine status](status/current.json) is authoritative. See
[delivery evidence](OPTIONS_MARKET_EVIDENCE_DELIVERY.md).

## Implemented

- Documented Cboe DataShop CSV import, source/ingestion history and deterministic
  path-quality reports. Actual data access remains unavailable: the Owner has
  Robinhood only and no authorized API or historical file has been supplied.
- Contract/quote qualification, frozen plans, simulated round trips, persistent
  cash/position recovery and per-trade candidate mistake checks. Local synthetic
  or unverified inputs; intraday plans, one position and 14-45 DTE contracts.
- Six official public headline feeds, local version history, freshness and
  source-health reporting; 16 driver families and 94 cataloged indicators.
- Offline R-based economics, cost/tick checks and conservative risk ceilings.
- Options fixture news/context and reusable canonical/calendar/research/audit
  foundations; unrelated product implementations removed by dependency review.

## Ordered completion work

1. Obtain authorized GLD/IBIT option observations through a licensed local file
   or entitled read-only provider. Then qualify contract metadata, calendars,
   historical availability, fees and a versioned sampled-path fill model before
   producing real-price simulations. The new gate explicitly identifies these gaps.
2. Quantitative macro and asset-specific connectors with point-in-time vintages,
   release calendars, consensus-surprise inputs where licensed, ETF share/flow
   distinction, COT lags, gold reserves and crypto/on-chain provenance.
3. Complete account/portfolio/event/drawdown/expiry risk and account-eligible
   structure comparison, with no-trade outcomes when one contract cannot fit.
4. Replace manual synthetic thesis inputs with qualified signals and evaluate
   net-cost target-before-stop/time-exit outcomes using independent market data.
5. Walk-forward testing, independent holdouts, calibration, uncertainty and drift
   checks. More headlines cannot substitute for evidence of a trading edge.
6. An Options Dashboard and expanded operational source monitoring. The initial
   hourly Codex heartbeat is configured separately; it requires the local host/app.

No fixed success probability or year-end balance is promised. 10% allocation
escalation and brokerage execution remain closed. Macro/broad-market references
remain contextual inputs; the trading universe stays GLD/IBIT.

Historical Daily Scan, Alpaca and Event Contract plans remain in Git/design
records. They are not pending product work and must not be resumed implicitly.
