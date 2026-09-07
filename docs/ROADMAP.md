# Alpha Roadmap

Current delivery adds budget screening and a prospective Robinhood observation
workflow with frozen selection, linked quote frames and data-quality reviews.
The first real frame is an excluded out-of-window smoke check. A September 8
observation window is declared, with no automatic collector or eligible series.
See [observation delivery](OPTIONS_ROBINHOOD_OBSERVATION_DELIVERY.md) and
[latest operational status](status/robinhood-observation.json).

The preceding delivery added Robinhood capture assessment and immutable storage.
Host OAuth and all five market tools work. Four actual option quotes were stale
and over budget; 120 sampled historical bars were interpolated. There is no
qualified real-price replay. See [capture delivery](OPTIONS_ROBINHOOD_CAPTURE_DELIVERY.md)
and [latest operational status](status/robinhood-capture.json). The
[machine status](status/current.json) describes the preceding build; the
[host setup](OPTIONS_ROBINHOOD_CONNECTION_SETUP.md) supersedes its installation
and authentication facts only. See
[delivery evidence](OPTIONS_ROBINHOOD_DATA_READINESS_DELIVERY.md),
[previous preparation](OPTIONS_RESEARCH_PREPARATION_DELIVERY.md) and the
[broker reference](OPTIONS_ROBINHOOD_RESEARCH_REFERENCE.md).

## Implemented

- Bounded whole-contract sample screening, immutable prospective plans, exact
  quote request templates, linked frame recording and restart-verified candidate
  data-quality review. Old quotes, missing responses and repeated polls cannot
  become a qualified path. No trade or probability is inferred.
- Network-free Robinhood capture parsing, scope/identity/clock checks, interpolation
  diagnostics, unchanged-budget lower bounds, immutable recovery and four candidate
  data-quality lessons. Seven real market-only calls are recorded separately from
  synthetic tests. No execution adapter or trade review is fabricated.
- Separate data-readiness report and local catalog assessment with five fixed
  candidates, schema fingerprints, unknown hints and pagination blockers. The
  anonymous fixed-endpoint probe cannot invoke tools or establish data readiness.
  Its checked-in example remains disabled; the authorized host copy is enabled
  and OAuth-authenticated. Runtime loading is verified; existing journals remain unchanged.
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
  path-quality reports. Robinhood responses have their own capture identity;
  no Cboe file or qualified historical bid/ask path has been supplied.
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
   market data. Use the new readiness report and offline catalog inspection to
   preserve the dated public review separately from captured evidence. Host login,
   five-tool loading and the first bounded response review are complete. Next
   collect fresh prospective quotes during the frozen eligible-session window;
   screening and the local observation workflow are implemented. No automatic
   collector is enabled. Stop before new-account or paid steps. See
   [host setup](OPTIONS_ROBINHOOD_CONNECTION_SETUP.md). Assess
   authorized read-only Robinhood Trading MCP capabilities and actual response semantics,
   or obtain an entitled local GLD/IBIT quote file. Official MCP documents now
   include option historical OHLC, live quotes and instruments. Runtime schemas
   show quote sides and sizes, but historical bid/ask paths, independent side/size
   event clocks, aligned underlying data and retention terms remain unverified.
   Do not assume paid Cboe data is the only route or substitute OHLC for quotes.
   A client tool filter does not restrict server scope or enforce GLD/IBIT. Design
   a separate source adapter if compatible data is established; never relabel a
   Robinhood response as Cboe evidence or backdate prospective captures.
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
