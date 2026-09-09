# Gold driver cross-check delivery

Owner request: September 9, 2026. Nine screenshots reviewed as a proposed
framework, not verified market observations. The original catalog already has
16 families and 94 indicators. This delivery adds a separate explicit crosswalk,
not 21 new numerical connections.

## Findings and corrections

The screenshots identify useful rate/FX, macro, positioning and structural
channels. Their ranking is conditional on horizon and market regime. WGC GRAM
examines changing historical relationships and residuals; it is not a universal
intraday priority or a causal trading rule. Nominal yields differ from real
yields; breakeven also includes inflation-risk and liquidity premia (Fed).
Treasury buybacks support cash management and liquidity, not a guaranteed rate
cut or a replacement for monetary policy (TreasuryDirect).

Official buying creates no guaranteed floor. Flows can be price-setting rather
than merely an amplifier. COT has delayed publication and trader categories do
not establish trade intent (CFTC). A gold-price view must pass separate option
IV, time-decay and executable-cost checks (OIC). The five review profiles below
are Alpha research choices, not source-calibrated weights.

## Complete screenshot crosswalk and added checks

CATALOGED means the broad area existed in the original catalog, not that every
listed subindicator had data. PARTIAL means expansion was needed. NOT_EXPLICIT
identifies a missing dedicated checklist; existing generic capabilities remain.

| Screenshot area | Gold review area | Existing families | Prior catalog coverage | Explicit additions |
| --- | --- | --- | --- | --- |
| 1 | Real yields and rate decomposition | real_yields | CATALOGED | 5Y / 10Y TIPS changes; Separate policy expectations, term premium and TIPS liquidity |
| 2 | Dollar and FX | usd_fx | CATALOGED | DXY versus broad trade-weighted USD; EURUSD / USDJPY and dollar funding pressure |
| 3 | Fed path and liquidity policy | monetary_policy, liquidity_funding | CATALOGED | Pre/post-event futures or OIS repricing; Statement, projections and press conference as separate phases |
| 4 | Inflation and expectations | macro_releases, real_yields | CATALOGED | Headline / core, monthly / annual and revisions; Surprise relative to a timestamped consensus |
| 5 | Employment and growth | macro_releases | CATALOGED | ADP versus official payrolls; ISM manufacturing / services, retail sales and revisions |
| 6 | Oil, commodities and supply shocks | cross_asset_stress, geopolitics_major_events | PARTIAL | Brent / WTI change versus price level; Supply shock versus demand-led inflation; Natural gas, freight, food and copper context |
| 7 | Treasury auctions, buybacks and fiscal supply | liquidity_funding, real_yields, geopolitics_major_events | PARTIAL | Auction stop yield versus when-issued yield; Bid-to-cover, indirect bidders and dealer allocation; Refunding, settlement, TGA, issuance mix and buyback results |
| 8 | Risk appetite and financial stress | cross_asset_stress, geopolitics_major_events | CATALOGED | VIX, MOVE, credit spreads and funding stress; Haven demand versus forced cash raising |
| 9 | Gold ETF flows and holdings | etf_flows_basis | CATALOGED | Shares / tonnes changes separately from NAV valuation; Global versus GLD-only flows and reporting lag |
| 10 | Futures positioning and leverage | derivatives_positioning, options_structure_execution | CATALOGED | Gross and net COT by trader category, position date versus release date; Separate volume, open interest, new exposure and rolls |
| 11 | Physical and regional gold demand | gold_physical_supply_demand | CATALOGED | China / India demand, import rules and local FX; Shanghai / London premia after unit, tax and delivery adjustment |
| 12 | Central-bank gold purchases and sales | gold_official_reserves | CATALOGED | Purchases and sales, revisions and disclosure lag; Reserve diversification and sovereign credibility |
| 13 | Mine supply, recycling and costs | gold_physical_supply_demand | CATALOGED | Mine costs, recycling elasticity and producer hedging; Refinery, transport, sanctions and export restrictions |
| 14 | Gold / GLD price path and technical confirmation | options_structure_execution | NOT_EXPLICIT | Trend over intraday / daily / weekly horizons; Session VWAP, opening range, prior highs/lows, realized volatility; Breakout hold / failure and volume confirmation |
| Added | Event surprise and what was already priced | macro_releases, monetary_policy | PARTIAL | Timestamped forecast distribution, prior print and revisions; First release versus later revision; Immediate reaction versus sustained reaction |
| Added | Causal overlap, regimes and unexplained moves | macro_releases, monetary_policy, real_yields, usd_fx | NOT_EXPLICIT | Group one event and its rate / FX responses; Compare competing mechanisms; Keep unexplained residuals unknown |
| Added | Forced liquidation and collateral | liquidity_funding, cross_asset_stress, derivatives_positioning | PARTIAL | Exchange margin notices and effective dates; Repo stress, collateral calls and position unwinds |
| Added | Gold delivery, lease rates and market basis | derivatives_positioning, gold_physical_supply_demand | PARTIAL | Lease rates, spot/futures curve and EFP; Registered versus eligible stocks, delivery and contract rolls |
| Added | Sessions, benchmarks and rebalancing | options_structure_execution, derivatives_positioning | PARTIAL | Asia / London / New York overlap and benchmark auctions; Holiday liquidity, futures roll, expiry and month/quarter-end |
| Added | Spot gold to GLD transmission | etf_flows_basis, regulation_security_adoption | CATALOGED | Gold per share, expenses and NAV premium / discount; Align spot, ETF and option quote timestamps |
| Added | Gold direction to option outcome | options_structure_execution | CATALOGED | Event IV, skew, term structure and IV crush; Delta / gamma / theta / vega, spread, depth and time exit |

## Declared review order

- **Intraday review**: Event surprise and what was already priced → Real yields and rate decomposition → Dollar and FX → Gold / GLD price path and technical confirmation → Forced liquidation and collateral → Oil, commodities and supply shocks → Gold direction to option outcome
- **Scheduled event review**: Event surprise and what was already priced → Fed path and liquidity policy → Real yields and rate decomposition → Dollar and FX → Gold / GLD price path and technical confirmation → Gold direction to option outcome
- **Multi-week / structural review**: Real yields and rate decomposition → Fed path and liquidity policy → Central-bank gold purchases and sales → Gold ETF flows and holdings → Treasury auctions, buybacks and fiscal supply → Physical and regional gold demand → Mine supply, recycling and costs
- **Haven-shock review**: Risk appetite and financial stress → Dollar and FX → Forced liquidation and collateral → Oil, commodities and supply shocks → Gold / GLD price path and technical confirmation → Gold direction to option outcome
- **Cash-stress review**: Forced liquidation and collateral → Dollar and FX → Risk appetite and financial stress → Real yields and rate decomposition → Futures positioning and leverage → Gold / GLD price path and technical confirmation → Gold direction to option outcome

One event and its Fed/rates/USD reactions must not count as independent causes.
Gold-specific relationships cannot automatically be copied to IBIT.

## Actual saved evidence

Snapshot 2026-09-09T23:04:39.971Z. All nine news sources returned OK in their latest
records; BEA retains partial-feed limitations. Only the real-yield area has
partial numerical context in the 21-area checklist: 10Y TIPS 2.43%, source date
September 4, received September 8 at 13:00:51.031 UTC. It is old daily context,
not September 9 intraday data. DXY, nominal-yield reactions, auction when-issued
comparisons, flows, positioning and underlying OHLCV remain numerical gaps.
Calendar/quote samples remain partial and preserve original clocks.

All 20 preserved artifacts from the prior capital-preflight checkpoint match
their original hashes. Owner ledger remains empty with its original head.
Raw evidence: `data/runtime/options-workbench-development/gold-framework-evidence-20260909.json`; SHA-256 `8b057ea8483ec9f7cd734d0f849873ef8dde5b09a609e711ad3ce5fce72a0e1f`.

## Files and behavior

- `src/engines/options-drivers/OptionsGoldFramework.ts`: immutable mapped checks,
  conditional explanations, declared priorities and references.
- `scripts/lib/options-gold-framework.mjs`: read-only existing-state projection.
- `apps/options-workbench/gold-framework.js`: expandable English factor desk.
- Existing workbench state/page/export, Host brief and static asset allowlist
  integrate the new desk. Focused-news rules add fiscal/macro/collateral terms.
- Specification, runbook, entry docs and aggregate validation register the change.

## Validation and limits

33 new tests and 45 focused-news tests pass. Aggregate validation: 4,181 tests
passed, no failures; strict TypeScript passes. Desktop width 1265/scroll 1265;
mobile viewport 390x844 gives content width 375/scroll 375. Profiles, rate
provenance and Treasury details open correctly; browser errors: zero. The
temporary viewport was reset. Initial test import and calendar-shape mismatches
were fixed before final validation.

No source coverage or trading qualification is inferred from these tests.
The fixed ten-workstream state remains 4 LOCAL_VALIDATED / 3 PARTIAL /
3 NOT_VALIDATED; first real-price flow gates remain 3 local available / 3 open.
News/macro coverage remains PARTIAL. Next prioritize synchronized nominal
yields/USD and event actual-versus-consensus evidence under source terms, then
qualified underlying OHLCV. The separate cancelled-old-capital-plan instruction
is still pending implementation; this task changes no saved risk setting.

## Primary references reviewed September 9

- [CFTC: Commitments of Traders methodology and release timing](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm)
- [World Gold Council: Gold Return Attribution Model](https://www.gold.org/goldhub/tools/gold-return-attribution-model)
- [Federal Reserve: Tips from TIPS](https://www.federalreserve.gov/econres/notes/feds-notes/tips-from-tips-update-and-discussions-20190521.html)
- [TreasuryDirect: Treasury securities buyback FAQs](https://www.treasurydirect.gov/help-center/faqs/buyback-faqs/)
- [CME: Understanding margin changes](https://www.cmegroup.com/education/articles-and-reports/understanding-margin-changes)
- [Options Industry Council: Options pricing](https://www.optionseducation.org/optionsoverview/options-pricing)

Reference dates describe this review, not live feed freshness. GLD issuer web
pages attempted in this turn were unavailable, so no new issuer numbers were
imported or claimed as verified.
