export interface OptionsDriverFactor {
  readonly id: string;
  readonly title: string;
  readonly assets: readonly ("GLD" | "IBIT")[];
  readonly mechanism: string;
  readonly indicators: readonly string[];
  readonly keywords: readonly string[];
  readonly sources: readonly {
    readonly sourceId: string;
    readonly url: string;
    readonly label: string;
    readonly availability: string;
  }[];
  readonly proposedReviewCadence: string;
  readonly limitation: string;
}

/** Source documentation was reviewed on this date; this is not data freshness. */
export const OPTIONS_DRIVER_CATALOG_SOURCE_REVIEW_DATE = "2026-09-06";

function freezeFactor(factor: OptionsDriverFactor): OptionsDriverFactor {
  return Object.freeze({
    ...factor,
    assets: Object.freeze([...factor.assets]),
    indicators: Object.freeze([...factor.indicators]),
    keywords: Object.freeze([...factor.keywords]),
    sources: Object.freeze(factor.sources.map((source) => Object.freeze({ ...source }))),
  });
}

/** Candidate research coverage only. Keywords and mechanisms confer no causal or trade authority. */
export const OPTIONS_DRIVER_FACTORS: readonly OptionsDriverFactor[] = Object.freeze(([
  {
    id: "monetary_policy",
    title: "Monetary policy and forward guidance",
    assets: ["GLD", "IBIT"],
    mechanism: "Policy expectations affect discount rates, currencies and funding conditions. Easing may support demand, while an accompanying growth or funding shock may dominate the response.",
    indicators: ["FOMC decisions and projections", "Policy surprise relative to prior expectations", "Central-bank speeches and minutes", "Balance-sheet policy", "ECB and other major central-bank decisions"],
    keywords: ["fomc", "monetary policy", "interest rate", "rate cut", "rate hike", "federal funds", "central bank", "quantitative easing", "quantitative tightening"],
    sources: [
      { sourceId: "fed", url: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", label: "Federal Reserve meeting calendar and releases", availability: "Public releases and archives; scheduled statements and minutes; connector health is assessed separately." },
      { sourceId: "ecb", url: "https://www.ecb.europa.eu/press/pubbydate/html/index.en.html", label: "European Central Bank publications", availability: "Public dated releases; European coverage does not establish global central-bank coverage." },
    ],
    proposedReviewCadence: "Review the calendar daily; refresh on scheduled decisions and material communications.",
    limitation: "A policy change already expected by markets may have little incremental effect. Headline tone is not a measured policy surprise.",
  },
  {
    id: "real_yields",
    title: "Nominal yields, real yields and the yield curve",
    assets: ["GLD", "IBIT"],
    mechanism: "Real yields alter the opportunity cost of non-income-producing assets; curve changes also carry growth, inflation and funding information. The net effect depends on the cause of the move.",
    indicators: ["Treasury nominal and TIPS real yields", "Curve slope and term premium", "Inflation compensation", "Bond volatility", "Rate changes around macro releases"],
    keywords: ["treasury yield", "real yield", "yield curve", "tips", "term premium", "bond yield", "inflation compensation"],
    sources: [
      { sourceId: "treasury", url: "https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics", label: "Treasury interest-rate statistics", availability: "Public daily closing indicative rates and historical downloads; not executable intraday quotes." },
    ],
    proposedReviewCadence: "Review after each business-day release; use a separately licensed feed for intraday changes.",
    limitation: "Nominal yields alone do not measure real yields. Historical inverse relationships can weaken or reverse.",
  },
  {
    id: "usd_fx",
    title: "US dollar and foreign-exchange conditions",
    assets: ["GLD", "IBIT"],
    mechanism: "Currency moves change dollar-denominated purchasing power and global funding conditions. Dollar strength may weigh on demand, but stress-driven safe-haven demand can produce different joint moves.",
    indicators: ["Broad trade-weighted dollar", "Major bilateral exchange rates", "Emerging-market currency stress", "FX volatility", "Currency intervention announcements"],
    keywords: ["dollar", "foreign exchange", "exchange rate", "currency", "renminbi", "yen", "euro"],
    sources: [
      { sourceId: "fed", url: "https://www.federalreserve.gov/releases/h10/", label: "Federal Reserve H.10 foreign-exchange rates", availability: "Daily observations generally released Monday at 16:15 ET for the preceding business week; holiday shifts apply." },
      { sourceId: "ecb", url: "https://www.ecb.europa.eu/press/pubbydate/html/index.en.html", label: "ECB currency and policy communications", availability: "Public releases; not an intraday FX market feed." },
    ],
    proposedReviewCadence: "Review public releases weekly and relevant currency events when published.",
    limitation: "The public release lag must be retained. A broad dollar index is not interchangeable with a licensed DXY quote.",
  },
  {
    id: "macro_releases",
    title: "Inflation, employment and economic growth",
    assets: ["GLD", "IBIT"],
    mechanism: "Macro news can reprice expected policy, growth and inflation hedging demand. The surprise relative to expectations and revisions matters more than a positive or negative headline alone.",
    indicators: ["CPI and PPI", "PCE inflation", "Employment, wages and unemployment", "JOLTS and jobless claims", "GDP and consumer spending", "Release revisions and survey consensus"],
    keywords: ["consumer price", "producer price", "inflation", "employment", "unemployment", "payroll", "job openings", "gross domestic product", "gdp", "personal income", "consumer spending", "pce", "jobless"],
    sources: [
      { sourceId: "bls", url: "https://www.bls.gov/schedule/2026/home.htm", label: "BLS economic release calendar", availability: "Public monthly release schedule and archives; release times and revisions require explicit records." },
      { sourceId: "bea", url: "https://www.bea.gov/news/schedule", label: "BEA release schedule", availability: "Public monthly and quarterly release schedule; API access requires separate registration." },
    ],
    proposedReviewCadence: "Check upcoming releases daily; capture the first release and each revision at publication.",
    limitation: "Official actuals do not supply a market-consensus forecast. Consensus and point-in-time historical vintages are separate coverage requirements.",
  },
  {
    id: "liquidity_funding",
    title: "Global liquidity, funding and fiscal cash movements",
    assets: ["GLD", "IBIT"],
    mechanism: "Reserve availability, funding stress and government cash movements can change balance-sheet capacity and risk-taking. Liquidity measures are imperfect proxies and do not imply a mechanical price response.",
    indicators: ["Central-bank balance sheets and reserves", "Repo and reverse-repo operations", "Treasury cash balance and financing", "Money-market rates and funding spreads", "Bank credit conditions", "Global liquidity divergence"],
    keywords: ["liquidity", "reserve balances", "balance sheet", "repo", "funding", "treasury general account", "debt issuance", "bank lending"],
    sources: [
      { sourceId: "fed", url: "https://www.federalreserve.gov/releases/h41/", label: "Federal Reserve H.4.1 balance sheet", availability: "Public weekly release, generally Thursday at 16:30 ET; holidays may delay publication." },
      { sourceId: "nyfed", url: "https://www.newyorkfed.org/markets/domestic-market-operations", label: "New York Fed market operations", availability: "Public operation results and archives; cadence varies by operation and requires a dedicated data adapter." },
    ],
    proposedReviewCadence: "Review funding operations each business day and balance sheets at their release cadence.",
    limitation: "Subtracting Treasury cash and reverse repos from Fed assets is not a complete global liquidity model. Missing non-US coverage remains unknown.",
  },
  {
    id: "cross_asset_stress",
    title: "Risk appetite, cross-asset relationships and systemic stress",
    assets: ["GLD", "IBIT"],
    mechanism: "Risk appetite and forced deleveraging can transmit across equity, credit, rates, gold and bitcoin markets. Diversification relationships are regime-dependent and can fail during a cash scramble.",
    indicators: ["Equity-market returns and breadth", "Credit spreads", "Volatility and correlation changes", "Banking and counterparty stress", "Market depth and cash demand", "Commodity and energy shocks"],
    keywords: ["financial stability", "systemic", "bank failure", "credit spread", "risk appetite", "market stress", "volatility", "recession", "liquidity crisis"],
    sources: [
      { sourceId: "fed", url: "https://www.federalreserve.gov/publications/financial-stability-report.htm", label: "Federal Reserve Financial Stability Report", availability: "Public periodic reports and chart data; slow structural context, not a live stress detector." },
      { sourceId: "cboe", url: "https://datashop.cboe.com/options", label: "Cboe market-data products", availability: "Market and options datasets are separately licensed products; purchase and connector readiness are not implied." },
    ],
    proposedReviewCadence: "Review market measures intraday only with qualified data; refresh structural reports on publication.",
    limitation: "Broad-market instruments may be explanatory inputs only. They do not expand the GLD/IBIT trading universe or prove stable correlation.",
  },
  {
    id: "etf_flows_basis",
    title: "ETF holdings, creations, redemptions and tracking basis",
    assets: ["GLD", "IBIT"],
    mechanism: "Fund creations and redemptions can transmit investment demand to the underlying asset. Premiums, discounts and tracking differences can alter ETF returns relative to gold or bitcoin.",
    indicators: ["GLD gold holdings and shares outstanding", "IBIT bitcoin holdings and shares outstanding", "Aggregate competing-fund flows", "NAV premium or discount", "Creation and redemption method", "Trust expenses and tracking error"],
    keywords: ["gld", "ibit", "bitcoin trust", "gold shares", "etf", "fund flow", "redemption", "net asset value", "shares outstanding"],
    sources: [
      { sourceId: "gld", url: "https://www.spdrgoldshares.com/usa/gld/", label: "SPDR Gold Shares issuer data", availability: "Public trust and historical data; individual fields have different publication times and displayed market quotes are delayed." },
      { sourceId: "ibit", url: "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust", label: "iShares Bitcoin Trust issuer data", availability: "Public dated holdings, fund data and documents; not a real-time consolidated ETF-flow feed." },
      { sourceId: "wgc", url: "https://www.gold.org/goldhub/data/gold-etfs-holdings-and-flows", label: "World Gold Council gold ETF holdings and flows", availability: "Published research and downloadable datasets; retain the dataset reporting period and access terms." },
    ],
    proposedReviewCadence: "Review issuer holdings each business day after publication and aggregate research on release.",
    limitation: "A change in asset value is not a fund flow. One issuer does not cover all ETFs; publication and settlement timing differ.",
  },
  {
    id: "gold_official_reserves",
    title: "Gold central-bank reserves and official purchases or sales",
    assets: ["GLD"],
    mechanism: "Official reserve allocation and announced purchases or sales can change structural gold demand. Reporting delays, undisclosed activity and prior expectations limit immediate price interpretation.",
    indicators: ["Reported reserve tonnes", "Net official purchases and sales", "Reserve diversification policy", "Repatriation and custody changes", "Country reporting revisions"],
    keywords: ["gold reserve", "gold purchase", "gold sale", "central bank gold", "reserve diversification", "bullion reserve"],
    sources: [
      { sourceId: "wgc", url: "https://www.gold.org/goldhub/data/gold-reserves-by-country", label: "World Gold Council official gold reserves", availability: "Monthly files usually updated within the first ten days with data about two months in arrears; some countries report later." },
    ],
    proposedReviewCadence: "Review monthly releases and material direct central-bank announcements.",
    limitation: "Reported reserve increases do not identify the exact transaction date or reveal all official demand.",
  },
  {
    id: "gold_physical_supply_demand",
    title: "Gold physical demand, supply and regional market conditions",
    assets: ["GLD"],
    mechanism: "Jewelry, investment, industrial demand, mining and recycling influence the physical balance. High prices may curb consumption while encouraging recycling, and regional constraints can affect premia.",
    indicators: ["Mine output and disruptions", "Recycling supply", "Jewelry and technology demand", "Bar and coin demand", "China and India imports and seasonal demand", "Regional premia, refining and transport constraints"],
    keywords: ["gold demand", "gold supply", "gold mining", "bullion", "jewellery", "jewelry", "gold import", "gold recycling", "gold refinery"],
    sources: [
      { sourceId: "wgc", url: "https://www.gold.org/goldhub/data/gold-demand-by-country", label: "World Gold Council supply and demand data", availability: "Public research and downloadable quarterly data; regional granular data may require separate access and review." },
    ],
    proposedReviewCadence: "Review quarterly fundamentals, relevant customs releases and verified disruption events.",
    limitation: "Slow physical statistics are contextual evidence, not an intraday trigger. Regional premiums need comparable units and delivery terms.",
  },
  {
    id: "derivatives_positioning",
    title: "Futures positioning, leverage, funding and liquidation pressure",
    assets: ["GLD", "IBIT"],
    mechanism: "Crowded positions and leverage can amplify moves when funding or collateral conditions change. Open interest has both long and short sides, so its increase does not by itself identify direction.",
    indicators: ["Gold and bitcoin COT positioning", "Futures basis and curve", "Open interest and volume", "Perpetual funding rates", "Liquidations and margin changes", "Exchange inventories and delivery conditions"],
    keywords: ["commitments of traders", "open interest", "futures", "funding rate", "liquidation", "margin requirement", "basis", "perpetual", "leverage"],
    sources: [
      { sourceId: "cftc", url: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/ReleaseSchedule/index.htm", label: "CFTC Commitments of Traders release schedule", availability: "Public weekly reports generally Friday at 15:30 ET using prior Tuesday positions; holiday delays apply." },
      { sourceId: "cme", url: "https://www.cmegroup.com/market-data/volume-open-interest.html", label: "CME volume and open-interest reports", availability: "Public dated reports; intraday and detailed historical products need separate licensing and acquisition." },
      { sourceId: "deribit", url: "https://docs.deribit.com/api-reference/market-data/public-ticker", label: "Deribit public market-data documentation", availability: "Documents venue-specific market data; requires a separate reviewed connector and does not grant trading access." },
    ],
    proposedReviewCadence: "Review COT weekly; review funding, basis and leverage intraday only when their feeds are qualified.",
    limitation: "Venue coverage is incomplete. Funding and liquidation aggregates can have inconsistent definitions; dealer exposure inferred from open interest is a model estimate.",
  },
  {
    id: "bitcoin_issuance_network",
    title: "Bitcoin issuance, mining and network operation",
    assets: ["IBIT"],
    mechanism: "Issuance changes, mining economics and network disruption can affect available supply and confidence. A known halving schedule does not guarantee a positive price response.",
    indicators: ["Block height and issuance", "Halving block countdown", "Difficulty and hash-rate estimates", "Miner revenue and transaction fees", "Network outages or reorganizations", "Energy costs and mining restrictions"],
    keywords: ["halving", "hash rate", "hashrate", "mining difficulty", "bitcoin mining", "bitcoin miner", "block reward", "bitcoin network", "reorganization"],
    sources: [
      { sourceId: "bitcoin", url: "https://bitcoin.org/en/halving", label: "Bitcoin halving schedule explanation", availability: "Public protocol explanation; the future halving calendar date is an estimate derived from block production." },
      { sourceId: "bitcoin_core", url: "https://bitcoincore.org/en/doc/27.0.0/rpc/", label: "Bitcoin Core versioned RPC documentation", availability: "Requires a synchronized local node or separately reviewed provider; documentation is not a connected node." },
    ],
    proposedReviewCadence: "Review network state by block with a qualified node; summarize mining context daily.",
    limitation: "Hash rate is estimated. Miner behavior and future protocol or policy changes are not fully observable from block counts.",
  },
  {
    id: "bitcoin_onchain_holders",
    title: "Bitcoin on-chain transfers, holders and exchange flows",
    assets: ["IBIT"],
    mechanism: "Changes in coin movement and holder behavior may indicate liquidity shifts, but an on-chain transfer can be internal custody movement rather than a purchase or sale.",
    indicators: ["Transaction activity and fees", "Coin-age distributions", "Large transfers", "Exchange inflows and outflows", "Realized-value and holder-cohort estimates", "Government or corporate holdings and sales disclosures"],
    keywords: ["on-chain", "onchain", "bitcoin transfer", "bitcoin wallet", "exchange inflow", "exchange outflow", "bitcoin holdings", "bitcoin treasury", "whale"],
    sources: [
      { sourceId: "bitcoin_core", url: "https://bitcoincore.org/en/doc/27.0.0/rpc/", label: "Bitcoin Core blockchain RPC documentation", availability: "Raw chain facts require a node; wallet/entity labels and advanced aggregates require independently reviewed analytics." },
      { sourceId: "sec", url: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces", label: "SEC EDGAR company disclosures", availability: "Public filing APIs subject to SEC access policies; issuer disclosures are delayed and incomplete measures of holdings." },
    ],
    proposedReviewCadence: "Review qualified chain aggregates daily and material verified disclosures on publication.",
    limitation: "Addresses are not people. Exchange labels, holder cohorts and realized-value measures contain modeling assumptions and cannot prove trading intent.",
  },
  {
    id: "stablecoin_liquidity",
    title: "Stablecoin circulation, redemption and peg stability",
    assets: ["IBIT"],
    mechanism: "Stablecoin availability and redemption confidence can alter crypto-market funding and settlement. More circulating tokens can facilitate activity but does not automatically represent new bitcoin buying.",
    indicators: ["USDC and USDT circulation", "Issuance and redemption flows", "Reserve reporting", "Peg deviations", "Banking and redemption interruptions", "Cross-chain supply reconciliation"],
    keywords: ["stablecoin", "usdc", "usdt", "tether", "depeg", "mint", "redemption"],
    sources: [
      { sourceId: "circle", url: "https://www.circle.com/transparency", label: "Circle reserve and circulation reporting", availability: "Issuer reports weekly reserves and mint/burn flows with monthly assurance; not a live consolidated liquidity feed." },
      { sourceId: "tether", url: "https://tether.to/en/transparency/", label: "Tether circulation and reserve reporting", availability: "Issuer circulation metrics typically updated daily; assurance reporting has a different cadence." },
    ],
    proposedReviewCadence: "Review daily or weekly issuer updates as available; monitor peg disruption with qualified market data.",
    limitation: "Issuer disclosures require date and scope checks. Chain swaps can double-count apparent supply changes without reconciliation.",
  },
  {
    id: "regulation_security_adoption",
    title: "Regulation, adoption, security and custody",
    assets: ["GLD", "IBIT"],
    mechanism: "Market-access rules, investment adoption and operational failures can change demand, available supply or trust in intermediaries. The affected asset, jurisdiction and legal stage determine the channel.",
    indicators: ["ETF and digital-asset rules", "Legislation and court decisions", "Institutional or corporate adoption", "Custody and exchange incidents", "Protocol vulnerabilities and fixes", "Trust prospectus or fee changes"],
    keywords: ["crypto asset", "digital asset", "bitcoin", "custody", "custodian", "cyber", "hack", "security breach", "regulation", "securities", "prospectus", "exchange outage"],
    sources: [
      { sourceId: "sec", url: "https://www.sec.gov/about/crypto-task-force/crypto-newsroom", label: "SEC crypto newsroom", availability: "Public regulatory announcements; proposals, interpretations and final actions must remain distinct." },
      { sourceId: "gld", url: "https://www.spdrgoldshares.com/usa/gld/", label: "GLD issuer and trust disclosures", availability: "Public fund documents and filings; does not provide comprehensive incident monitoring." },
      { sourceId: "ibit", url: "https://www.ishares.com/us/products/333011/ishares-bitcoin-trust", label: "IBIT issuer and trust disclosures", availability: "Public fund documents and filings; wider crypto operational coverage requires additional verified sources." },
    ],
    proposedReviewCadence: "Review official announcements and verified issuer or operator incidents when published.",
    limitation: "A proposal is not an enacted rule. A reported incident is not independently confirmed merely because a headline matches; jurisdiction and scope may differ.",
  },
  {
    id: "geopolitics_major_events",
    title: "Geopolitics, fiscal politics and major unscheduled events",
    assets: ["GLD", "IBIT"],
    mechanism: "Conflict, sanctions, elections, fiscal disruption, disasters and energy shocks can affect confidence, inflation, supply and funding. Safe-haven demand can coexist with liquidation pressure and later reverse.",
    indicators: ["Conflict escalation and de-escalation", "Sanctions and trade restrictions", "Elections and policy transitions", "Government shutdown and debt-limit events", "Energy, shipping and infrastructure disruption", "Disasters and emergency policy responses"],
    keywords: ["sanction", "war", "conflict", "ceasefire", "tariff", "election", "debt limit", "shutdown", "geopolitical", "emergency", "oil supply", "shipping disruption"],
    sources: [
      { sourceId: "treasury", url: "https://ofac.treasury.gov/recent-actions", label: "Treasury OFAC recent sanctions actions", availability: "Public dated sanctions actions; covers official US action, not all geopolitical events or independent reporting." },
      { sourceId: "fed", url: "https://www.federalreserve.gov/publications/financial-stability-report.htm", label: "Federal Reserve systemic-risk assessment", availability: "Periodic public context; breaking-event coverage requires separately verified primary reporting and source access." },
    ],
    proposedReviewCadence: "Review scheduled political events daily and verified material unscheduled developments on publication.",
    limitation: "An official statement establishes what its publisher said, not every underlying claim. Breaking news requires corroboration, deduplication and uncertainty tracking.",
  },
  {
    id: "options_structure_execution",
    title: "Option pricing, liquidity, expiry and session gaps",
    assets: ["GLD", "IBIT"],
    mechanism: "Option returns depend on the underlying path, entry premium, implied volatility, time, Greeks and executable liquidity. A correct asset-direction view can still lose through decay, volatility repricing or poor fills.",
    indicators: ["Bid/ask, depth, trade size and quote age", "IV versus realized volatility", "Skew and term structure", "Delta, gamma, theta, vega and rho", "Expiry, exercise and assignment conditions", "Event premium and IV crush", "Weekend and overnight gaps", "Fees, slippage, contract multiplier and account permissions"],
    keywords: ["option", "implied volatility", "skew", "term structure", "expiry", "expiration", "assignment", "bid-ask", "spread", "trading hours", "holiday", "halt", "weekend"],
    sources: [
      { sourceId: "oic", url: "https://www.optionseducation.org/referencelibrary/faq/option-price-behavior", label: "Options Industry Council pricing mechanics", availability: "Public educational reference, not option-chain observations or strategy-outcome evidence." },
      { sourceId: "cboe", url: "https://datashop.cboe.com/options", label: "Cboe historical option quotes and analytics", availability: "Licensed datasets can include NBBO, size and optional Greeks; GLD/IBIT contract history requires explicit qualification." },
      { sourceId: "nyse", url: "https://www.nyse.com/trade/hours-calendars", label: "NYSE trading and holiday calendar", availability: "Public calendar with early-close exceptions; each contract and Robinhood eligibility still needs verification." },
      { sourceId: "robinhood", url: "https://robinhood.com/us/en/support/articles/expiration-exercise-and-assignment/", label: "Robinhood expiration, exercise and assignment", availability: "Public broker rules; account permissions, positions and executable prices are not connected." },
    ],
    proposedReviewCadence: "Qualify option quotes before each proposed decision and during a separately authorized monitoring run; review event and expiry calendars daily.",
    limitation: "Stops do not guarantee a fill or loss cap. A held-to-expiry probability is not the probability of reaching a profit target before stop or time exit.",
  },
] satisfies OptionsDriverFactor[]).map(freezeFactor));
