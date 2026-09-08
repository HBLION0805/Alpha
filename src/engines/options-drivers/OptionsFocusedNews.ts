import type { FocusedHeadline, FocusedNewsHealth } from "../../contracts/OptionsFocusedNews";
import { readinessClock } from "../options-readiness/OptionsReadinessEngine";

export const FOCUSED_NEWS_SOURCES = Object.freeze([
  { id: "fed_speeches", label: "Federal Reserve speeches & testimony", kind: "PRIMARY_PUBLISHER" as const },
  { id: "eia_energy", label: "EIA Today in Energy", kind: "PRIMARY_PUBLISHER" as const },
  { id: "coindesk", label: "CoinDesk reporting", kind: "NEWS_REPORTING" as const },
]);

const macroRules = [
  { id: "rates", label: "Rates & policy", pattern: /\b(?:interest rates?|real yields?|bond yields?|treasury yields?|monetary policy|rate (?:hikes?|cuts?)|FOMC|economic outlook|policy communication)\b/i,
    mechanism: "Rates can alter gold's opportunity cost and Bitcoin's funding conditions; the surprise relative to expectations still needs verification." },
  { id: "inflation_jobs", label: "Inflation & growth", pattern: /\b(?:inflation|CPI|PPI|PCE|payrolls?|employment situation|job openings|unemployment|gross domestic|GDP|economic indicators|consumer price|producer price)\b/i,
    mechanism: "Inflation and growth can change expected policy and risk appetite. A headline alone does not establish the size or direction of the surprise." },
  { id: "fx", label: "Dollar & currencies", pattern: /\b(?:U\.?S\.? dollar|dollar index|DXY|yen|yuan|foreign exchange|currency intervention)\b/i,
    mechanism: "Currency and funding changes may affect dollar-denominated gold and Bitcoin. Correlations can change across regimes." },
  { id: "energy", label: "Oil & inflation pressure", pattern: /\b(?:crude oil|oil prices?|oil suppl(?:y|ies)|Brent|WTI|OPEC|crack spreads?|gasoline prices?)\b/i,
    mechanism: "Energy shocks can feed inflation and rate expectations while also raising safe-haven demand; the net effect can conflict." },
  { id: "geopolitics", label: "Geopolitics & trade", pattern: /\b(?:geopolitic\w*|sanctions?|tariffs?|Hormuz|Iran|Ukraine|war|ceasefire|military escalation)\b/i,
    mechanism: "Conflict or trade shocks can change haven demand, liquidity and energy prices. Gold and Bitcoin need not respond in the same direction." },
  { id: "liquidity", label: "Liquidity & market stress", pattern: /\b(?:liquidity|financial stability|banking crisis|treasury (?:auction|issuance)|risk appetite|risk-off|risk-on|quantitative tightening|quantitative easing)\b/i,
    mechanism: "Funding and risk appetite can affect both assets. Forced selling may overwhelm a directional thesis or option stop." },
];

export function classifyFocusedHeadline(headline: string) {
  if (typeof headline !== "string" || headline.length > 400) throw Error("FOCUSED_NEWS_HEADLINE");
  const gold = /\b(?:gold|bullion|GLD|XAU)\b/i.test(headline) && !/\bgold (?:medals?|awards?)\b/i.test(headline);
  const bitcoin = /\b(?:bitcoin|BTC|IBIT)\b/i.test(headline);
  const macro = macroRules.filter(rule => rule.pattern.test(headline));
  const cryptoSystem = /\b(?:crypto|stablecoins?|USDT|USDC|digital assets?)\b/i.test(headline)
    && /\b(?:regulat\w*|legislation|reserves?|depeg\w*|liquidation\w*|hack\w*|bankrupt\w*|custody|liquidity|market structure)\b/i.test(headline);
  const assets = [...(gold || macro.length ? ["GLD"] : []), ...(bitcoin || macro.length || cryptoSystem ? ["IBIT"] : [])];
  return {
    assets,
    scope: gold || bitcoin ? "DIRECT" : assets.length ? "INDIRECT_MACRO" : "OUT_OF_SCOPE",
    directAssets: [...(gold ? ["GLD"] : []), ...(bitcoin ? ["IBIT"] : [])],
    topics: [...(gold ? ["Gold market"] : []), ...(bitcoin ? ["Bitcoin market"] : []), ...macro.map(r => r.label), ...(cryptoSystem ? ["Crypto system risk"] : [])],
    mechanisms: [...(gold ? ["Gold demand, ETF flows and central-bank activity may affect GLD; reported claims still need source and price confirmation."] : []),
      ...(bitcoin ? ["Bitcoin price, ETF flows and market structure may affect IBIT; a report does not establish an executable option opportunity."] : []),
      ...macro.map(r => r.mechanism), ...(cryptoSystem ? ["Crypto-wide regulation or infrastructure stress may transmit to Bitcoin; token-specific claims are not automatically Bitcoin evidence."] : [])],
    direction: "UNDETERMINED", verifiedFact: false,
  };
}

export function buildFocusedNews(headlines: readonly FocusedHeadline[], health: readonly FocusedNewsHealth[], at: string) {
  readinessClock(at);
  if (headlines.length > 5000 || health.length > 20) throw Error("FOCUSED_NEWS_INPUT_LIMIT");
  const versions = new Map<string, FocusedHeadline>();
  let futureReceipts = 0;
  for (const item of headlines) {
    readinessClock(item.observedAt);
    if (item.publishedAt !== null) readinessClock(item.publishedAt);
    if (item.observedAt > at) { futureReceipts++; continue; }
    const key = `${item.origin}:${item.sourceId}:${item.itemId}`;
    const prior = versions.get(key);
    if (!prior || prior.observedAt < item.observedAt) versions.set(key, item);
  }
  const rows = [...versions.values()].map(item => {
    const relevance = classifyFocusedHeadline(item.headline);
    const elapsed = item.publishedAt === null ? null : Date.parse(at) - Date.parse(item.publishedAt);
    const freshness = item.origin !== "PUBLIC_FEED" ? "SCENARIO" : elapsed === null ? "PUBLICATION_TIME_UNKNOWN" : elapsed < 0 ? "FUTURE_PUBLICATION" : elapsed <= 72 * 3600000 ? "RECENT" : "STALE";
    return { ...item, ...relevance, freshness, evidenceClass: item.sourceId === "coindesk" ? "NEWS_REPORTING" : "PRIMARY_PUBLISHER" };
  }).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.sourceId.localeCompare(b.sourceId) || a.itemId.localeCompare(b.itemId));
  const relevant = rows.filter(item => item.scope !== "OUT_OF_SCOPE");
  return {
    version: "OPTIONS_FOCUSED_NEWS_V1", assessedAt: at, items: relevant,
    counts: { total: rows.length, relevant: relevant.length, excluded: rows.length - relevant.length, futureReceipts,
      direct: relevant.filter(i => i.scope === "DIRECT").length, indirect: relevant.filter(i => i.scope === "INDIRECT_MACRO").length,
      recent: relevant.filter(i => i.freshness === "RECENT").length },
    sources: health.map(s => ({ ...s, refreshOverdue: s.observedAt === null || s.observedAt > at || Date.parse(at) - Date.parse(s.observedAt) > 90 * 60000 })),
    gaps: ["World Gold Council gold demand, central-bank purchases and ETF-flow articles require the scheduled Host web review; no automatic WGC numerical feed is connected.",
      "Geopolitical breaking news, Reuters and broader publisher coverage use bounded Host web review, not a complete continuous newswire.",
      "Live dollar, nominal-yield, oil, ETF-flow, funding and liquidation numerical series are not connected by these headlines.",
      "Headline keywords can miss relevant stories or include irrelevant ones. Sources, dates and underlying articles require review; repeated reports do not prove independent corroboration."],
    executionAllowed: false, calibrated: false,
  };
}
