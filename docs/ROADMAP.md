# Alpha Roadmap

Current delivery is GLD/IBIT Options Driver Monitor and Risk v2. The
[machine status](status/current.json) is authoritative. See
[delivery evidence](OPTIONS_FOCUS_V2_DELIVERY.md).

## Implemented

- Six official public headline feeds, local version history, freshness and
  source-health reporting; 16 driver families and 94 cataloged indicators.
- Offline R-based economics, cost/tick checks and conservative risk ceilings.
- Options fixture news/context and reusable canonical/calendar/research/audit
  foundations; unrelated product implementations removed by dependency review.

## Ordered completion work

1. Verified GLD/IBIT option chains: exact contract, strike/expiry/multiplier,
   executable bid/ask and sizes, fees, session status, IV and Greeks.
2. Quantitative macro and asset-specific connectors with point-in-time vintages,
   release calendars, consensus-surprise inputs where licensed, ETF share/flow
   distinction, COT lags, gold reserves and crypto/on-chain provenance.
3. Complete account/portfolio/event/drawdown/expiry risk and account-eligible
   structure comparison, with no-trade outcomes when one contract cannot fit.
4. Locked direction/magnitude/time/volatility/path/risk theses, persistent offline
   paper decisions and net-cost target-before-stop/time-exit outcomes.
5. Walk-forward testing, independent holdouts, calibration, uncertainty and drift
   checks. More headlines cannot substitute for evidence of a trading edge.
6. An Options Dashboard and expanded operational source monitoring. The initial
   hourly Codex heartbeat is configured separately; it requires the local host/app.

No fixed success probability or year-end balance is promised. 10% allocation
escalation and brokerage execution remain closed. Macro/broad-market references
remain contextual inputs; the trading universe stays GLD/IBIT.

Historical Daily Scan, Alpaca and Event Contract plans remain in Git/design
records. They are not pending product work and must not be resumed implicitly.
