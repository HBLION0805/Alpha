import { OPTIONS_DRIVER_FACTORS } from "./OptionsDriverCatalog";

const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};

export const GOLD_FRAMEWORK_REFERENCES = freeze([
  { id: "cot", title: "CFTC: Commitments of Traders methodology and release timing", url: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm" },
  { id: "wgc", title: "World Gold Council: Gold Return Attribution Model", url: "https://www.gold.org/goldhub/tools/gold-return-attribution-model" },
  { id: "tips", title: "Federal Reserve: Tips from TIPS", url: "https://www.federalreserve.gov/econres/notes/feds-notes/tips-from-tips-update-and-discussions-20190521.html" },
  { id: "buybacks", title: "TreasuryDirect: Treasury securities buyback FAQs", url: "https://www.treasurydirect.gov/help-center/faqs/buyback-faqs/" },
  { id: "margin", title: "CME: Understanding margin changes", url: "https://www.cmegroup.com/education/articles-and-reports/understanding-margin-changes" },
  { id: "options", title: "Options Industry Council: Options pricing", url: "https://www.optionseducation.org/optionsoverview/options-pricing" },
]);

export interface GoldReviewArea {
  id: string;
  screenshotArea: number | null;
  title: string;
  familyIds: readonly string[];
  priorCoverage: "CATALOGED" | "PARTIAL" | "NOT_EXPLICIT";
  addedChecks: readonly string[];
  interpretation: string;
  gap: string;
  references: readonly string[];
  headlinePattern: string;
}

const area = (id: string, screenshotArea: number | null, title: string, familyIds: string[],
  priorCoverage: GoldReviewArea["priorCoverage"], addedChecks: string[], interpretation: string,
  gap: string, references: string[], headlinePattern: string): GoldReviewArea =>
  ({ id, screenshotArea, title, familyIds, priorCoverage, addedChecks, interpretation, gap, references, headlinePattern });

/** Review priorities and mechanisms are declared research hypotheses, never fitted weights. */
export const GOLD_REVIEW_AREAS: readonly GoldReviewArea[] = freeze([
  area("real_rates", 1, "Real yields and rate decomposition", ["real_yields"], "CATALOGED",
    ["5Y / 10Y TIPS changes", "Separate policy expectations, term premium and TIPS liquidity"],
    "Rising real yields can raise gold's opportunity cost. Nominal 10Y alone is insufficient; breakeven includes risk and liquidity premia.",
    "Daily real-yield estimates only; no intraday nominal/TIPS pair or clean expected-inflation series.", ["tips", "wgc"], "real yields?|TIPS|treasury yields?|term premium|breakeven"),
  area("dollar", 2, "Dollar and FX", ["usd_fx"], "CATALOGED",
    ["DXY versus broad trade-weighted USD", "EURUSD / USDJPY and dollar funding pressure"],
    "USD strength often raises the hurdle for gold, but both can rise during stress. Different dollar indexes are not interchangeable.",
    "No numerical DXY or intraday FX series connected.", ["wgc"], "dollar|DXY|yen|yuan|foreign exchange"),
  area("fed_path", 3, "Fed path and liquidity policy", ["monetary_policy", "liquidity_funding"], "CATALOGED",
    ["Pre/post-event futures or OIS repricing", "Statement, projections and press conference as separate phases"],
    "An expected cut is not new easing information. Growth and funding shocks can dominate the same policy announcement.",
    "Speeches and date calendar are context; no numerical futures/OIS probability curve.", ["wgc"], "FOMC|Fed|federal funds|rate cuts?|rate hikes?|monetary policy"),
  area("inflation", 4, "Inflation and expectations", ["macro_releases", "real_yields"], "CATALOGED",
    ["Headline / core, monthly / annual and revisions", "Surprise relative to a timestamped consensus"],
    "Hot inflation can hurt gold through tighter expected policy or support it if real purchasing power erodes. Read the rate response.",
    "No actual-versus-consensus numerical release history; calendar dates are not released values.", ["tips"], "inflation|CPI|PPI|PCE|consumer price|producer price|wages?"),
  area("growth_jobs", 5, "Employment and growth", ["macro_releases"], "CATALOGED",
    ["ADP versus official payrolls", "ISM manufacturing / services, retail sales and revisions"],
    "Separate growth, inflation and policy channels; weak growth can also trigger liquidation rather than an immediate gold rally.",
    "No connected release-vintage or consensus series for payrolls, claims, ISM, retail sales or GDP.", ["wgc"], "payroll|jobless|unemployment|JOLTS|ADP|ISM|retail sales|GDP|employment"),
  area("energy", 6, "Oil, commodities and supply shocks", ["cross_asset_stress", "geopolitics_major_events"], "PARTIAL",
    ["Brent / WTI change versus price level", "Supply shock versus demand-led inflation", "Natural gas, freight, food and copper context"],
    "Oil-led inflation, tighter policy and haven demand may pull gold in different directions; a high oil level alone is not a gold signal.",
    "EIA news is connected; continuous commodity, freight and inflation-surprise values are not.", ["tips"], "oil|Brent|WTI|OPEC|natural gas|freight|shipping|copper|grain"),
  area("treasury_supply", 7, "Treasury auctions, buybacks and fiscal supply", ["liquidity_funding", "real_yields", "geopolitics_major_events"], "PARTIAL",
    ["Auction stop yield versus when-issued yield", "Bid-to-cover, indirect bidders and dealer allocation", "Refunding, settlement, TGA, issuance mix and buyback results"],
    "A tail or strong auction needs a comparable when-issued quote and subsequent rates reaction. Treasury cash/liquidity buybacks are not Fed QE or a guaranteed yield decline.",
    "No auction, when-issued, buyback-result or fiscal cash-flow numerical adapter.", ["buybacks"], "treasury|auction|buybacks?|refunding|deficit|debt ceiling|debt limit"),
  area("risk_stress", 8, "Risk appetite and financial stress", ["cross_asset_stress", "geopolitics_major_events"], "CATALOGED",
    ["VIX, MOVE, credit spreads and funding stress", "Haven demand versus forced cash raising"],
    "Gold can initially be sold to meet cash needs. An equity selloff does not establish a hedge response.",
    "News only; no live cross-asset stress or correlation panel.", ["wgc", "margin"], "VIX|MOVE|credit spread|banking|financial stability|war|ceasefire|risk-off"),
  area("etf_flows", 9, "Gold ETF flows and holdings", ["etf_flows_basis"], "CATALOGED",
    ["Shares / tonnes changes separately from NAV valuation", "Global versus GLD-only flows and reporting lag"],
    "Investment flows can be price-setting, not merely an amplifier. Rising assets under management can reflect price appreciation rather than inflows.",
    "Issuer/WGC review is manual Host context; no automatically reconciled numerical flow history.", ["wgc"], "gold ETF|GLD|IAU|gold flows|gold holdings"),
  area("positioning", 10, "Futures positioning and leverage", ["derivatives_positioning", "options_structure_execution"], "CATALOGED",
    ["Gross and net COT by trader category, position date versus release date", "Separate volume, open interest, new exposure and rolls"],
    "Every contract has two sides. Volume/OI cannot identify an institution's intent or prove dealer gamma; crowded positions can persist.",
    "No current COT, dealer inventory or gold futures positioning series.", ["cot", "margin", "wgc"], "COT|commitments of traders|COMEX|open interest|gold futures|margin"),
  area("physical_demand", 11, "Physical and regional gold demand", ["gold_physical_supply_demand"], "CATALOGED",
    ["China / India demand, import rules and local FX", "Shanghai / London premia after unit, tax and delivery adjustment"],
    "Income and affordability influence consumption. Local premiums are not comparable without FX, purity and delivery terms.",
    "No numerical customs, regional premium or jewelry-demand connector.", ["wgc"], "gold demand|gold import|Shanghai|India|jewellery|jewelry|bullion"),
  area("official_demand", 12, "Central-bank gold purchases and sales", ["gold_official_reserves"], "CATALOGED",
    ["Purchases and sales, revisions and disclosure lag", "Reserve diversification and sovereign credibility"],
    "Official demand can support a structural thesis but creates no guaranteed price floor. A reported reserve change is not today's transaction.",
    "No connected official-reserve numerical history; reports can be delayed or incomplete.", ["wgc"], "gold reserves?|central.bank gold|gold purchases?|gold sales?|reserve diversification"),
  area("physical_supply", 13, "Mine supply, recycling and costs", ["gold_physical_supply_demand"], "CATALOGED",
    ["Mine costs, recycling elasticity and producer hedging", "Refinery, transport, sanctions and export restrictions"],
    "Supply usually provides slower context. A disruption may matter faster; production cost is not a hard market floor.",
    "No connected mine-cost, recycling or producer-hedge numerical series.", ["wgc"], "gold mining|gold supply|gold recycling|refiner|producer hedging"),
  area("technical", 14, "Gold / GLD price path and technical confirmation", ["options_structure_execution"], "NOT_EXPLICIT",
    ["Trend over intraday / daily / weekly horizons", "Session VWAP, opening range, prior highs/lows, realized volatility", "Breakout hold / failure and volume confirmation"],
    "Technical evidence tests entry timing and thesis invalidation; an option candle is not a GLD underlying candle or a volume-qualified VWAP.",
    "Saved option candles lack qualified underlying OHLCV and can have unknown interpolation. No computed GLD VWAP or breakout signal.", ["wgc", "options"], "gold|GLD|XAU"),
  area("surprise_vintage", null, "Event surprise and what was already priced", ["macro_releases", "monetary_policy"], "PARTIAL",
    ["Timestamped forecast distribution, prior print and revisions", "First release versus later revision", "Immediate reaction versus sustained reaction"],
    "Surprise is actual minus the pre-release expectation using the same unit and definition. Do not reconstruct a forecast with later information.",
    "Point-in-time consensus distributions, first-release values and synchronized reaction windows missing.", ["tips", "wgc"], "CPI|PPI|PCE|payroll|FOMC|revision|forecast"),
  area("causal_overlap", null, "Causal overlap, regimes and unexplained moves", ["macro_releases", "monetary_policy", "real_yields", "usd_fx"], "NOT_EXPLICIT",
    ["Group one event and its rate / FX responses", "Compare competing mechanisms", "Keep unexplained residuals unknown"],
    "CPI, Fed repricing, yields and USD may describe one transmission chain. Five agreeing headlines are not five independent votes; priorities change with regime and horizon.",
    "No calibrated causal model, fitted weights or validated regime detector.", ["wgc", "tips"], "inflation|Fed|yield|dollar|gold"),
  area("cash_liquidation", null, "Forced liquidation and collateral", ["liquidity_funding", "cross_asset_stress", "derivatives_positioning"], "PARTIAL",
    ["Exchange margin notices and effective dates", "Repo stress, collateral calls and position unwinds"],
    "Funding demand can overwhelm haven buying. Margin changes apply to both sides; direction needs price and positioning evidence.",
    "No real-time funding, margin-call or forced-order evidence.", ["margin"], "margin|collateral|liquidation|repo|funding stress"),
  area("delivery_basis", null, "Gold delivery, lease rates and market basis", ["derivatives_positioning", "gold_physical_supply_demand"], "PARTIAL",
    ["Lease rates, spot/futures curve and EFP", "Registered versus eligible stocks, delivery and contract rolls"],
    "A widening basis may reflect financing or location constraints. Warehouse category changes alone do not prove a squeeze or missing gold.",
    "No synchronized spot/futures, lease-rate, EFP or inventory history.", ["margin"], "gold lease|EFP|COMEX|backwardation|contango|gold delivery|gold inventories"),
  area("sessions", null, "Sessions, benchmarks and rebalancing", ["options_structure_execution", "derivatives_positioning"], "PARTIAL",
    ["Asia / London / New York overlap and benchmark auctions", "Holiday liquidity, futures roll, expiry and month/quarter-end"],
    "Thin depth and positioning adjustments can amplify moves without a new macro story. Session patterns require historical validation.",
    "No synchronized multi-venue trade/volume coverage or validated session effect.", ["wgc", "options"], "gold auction|gold benchmark|gold fixing|gold expiry|gold rollover|gold rebalancing"),
  area("gld_tracking", null, "Spot gold to GLD transmission", ["etf_flows_basis", "regulation_security_adoption"], "CATALOGED",
    ["Gold per share, expenses and NAV premium / discount", "Align spot, ETF and option quote timestamps"],
    "Do not use a fixed spot-gold-to-GLD conversion. Holdings, share count, expenses, currency and session timing must match.",
    "Saved GLD quote is partial context; current matched spot/NAV/share-gold inputs missing.", ["wgc"], "GLD|gold shares|gold trust|net asset value"),
  area("option_economics", null, "Gold direction to option outcome", ["options_structure_execution"], "CATALOGED",
    ["Event IV, skew, term structure and IV crush", "Delta / gamma / theta / vega, spread, depth and time exit"],
    "A bullish gold thesis can lose in a call through decay, IV decline or spread costs. Target-before-stop probability needs path evidence, not expiry delta.",
    "Bounded saved option samples exist; qualified execution, continuous IV history and calibrated outcomes missing.", ["options"], "GLD|gold options?|implied volatility|IV crush"),
]);

export const GOLD_REVIEW_PROFILES = freeze([
  { id: "intraday", title: "Intraday review", order: ["surprise_vintage", "real_rates", "dollar", "technical", "cash_liquidation", "energy", "option_economics"] },
  { id: "event", title: "Scheduled event review", order: ["surprise_vintage", "fed_path", "real_rates", "dollar", "technical", "option_economics"] },
  { id: "structural", title: "Multi-week / structural review", order: ["real_rates", "fed_path", "official_demand", "etf_flows", "treasury_supply", "physical_demand", "physical_supply"] },
  { id: "haven", title: "Haven-shock review", order: ["risk_stress", "dollar", "cash_liquidation", "energy", "technical", "option_economics"] },
  { id: "cash_stress", title: "Cash-stress review", order: ["cash_liquidation", "dollar", "risk_stress", "real_rates", "positioning", "technical", "option_economics"] },
]);

export function goldFrameworkCatalog() {
  return {
    version: "OPTIONS_GOLD_FRAMEWORK_V1", referenceReviewDate: "2026-09-09",
    tradeUniverse: ["GLD", "IBIT"], targetAsset: "GLD",
    originalCatalog: { families: OPTIONS_DRIVER_FACTORS.length, indicators: OPTIONS_DRIVER_FACTORS.reduce((n, f) => n + f.indicators.length, 0) },
    areas: GOLD_REVIEW_AREAS, profiles: GOLD_REVIEW_PROFILES, references: GOLD_FRAMEWORK_REFERENCES,
    currentRegime: "UNDETERMINED", direction: "UNDETERMINED", weightMethod: "DECLARED_REVIEW_ORDER_NOT_FITTED_WEIGHTS",
    calibratedProbability: null, executionAllowed: false,
  };
}
