# Alpha Roadmap

Current delivery adds research input preparation, dated Robinhood fee estimates
and public-source broker references to the historical research workflow. The
[machine status](status/current.json) is authoritative. See
[delivery evidence](OPTIONS_RESEARCH_PREPARATION_DELIVERY.md) and the
[broker reference](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

## Implemented

- Manifest/child/metadata/plan preparation with chronology checks and optional
  immutable records. A linked result certifies only coherent declared inputs;
  no market import, replay, account access or trade follows automatically.
- A standalone fee estimate for a single supported September 4, 2026 GLD/IBIT
  execution, with explicit components and rounding. Accepted engine outputs,
  frozen fee assumptions and existing journals remain unchanged.
- A separate counterfactual sampled-replay engine with declared contract/session/
  cost assumptions, later-snapshot assumed fills, isolated USD 1,000 runs,
  unresolved positions and reviews for all outcomes. Actual-time candidate lessons
  remain unapproved; old paper and market-qualification fingerprints are unchanged.
- Bounded extraction of one session and up to four selected contracts with parent/
  child hashes, row counts and a selection manifest. No silent file truncation.
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

1. Continue local workflow preparation under the Owner's decision to defer paid
   market data. Assess authorized read-only Robinhood Trading MCP capabilities and schemas,
   or obtain an entitled local GLD/IBIT quote file. Official MCP documents now
   include option historical OHLC, live quotes and instruments; it is not
   connected, and historical bid/ask sizes or access terms remain unverified.
   Do not assume paid Cboe data is the only route or substitute OHLC for quotes.
   Official samples inspected so far contain no GLD/IBIT observations. For a
   supplied file, extract a documented subset, prepare the linked inputs, inspect
   source/contract/session/cost evidence and test affordability before the
   counterfactual run. Unknown sizes still block fills. Separately qualify
   historical availability and execution models; assumptions do not establish fills.
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
