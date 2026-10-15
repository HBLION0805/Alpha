import type { Cluster } from "./types.ts";
import { isBoilerplate } from "./noise.ts";
import { mainClause, tokens } from "./normalize.ts";

export interface Topic {
  id: string;
  label: string;
  weight: number;
  assets: string[];
  pattern: RegExp;
}

/** Macro & asset keywords relevant to US stocks/options, crypto and gold. */
export const TOPICS: Topic[] = [
  { id: "fed", label: "Fed / rates", weight: 20, assets: ["SPY", "QQQ", "TLT", "GLD", "BTC"], pattern: /\b(fed|fomc|federal reserve|powell|rate (cut|hike)s?|interest rates?|monetary policy|basis points?|treasury yields?|yields?)\b/i },
  { id: "inflation", label: "Inflation (CPI/PCE/PPI)", weight: 18, assets: ["SPY", "TLT", "GLD"], pattern: /\b(cpi|pce|ppi|inflation|consumer prices?|producer prices?)\b/i },
  { id: "jobs", label: "Jobs / labor", weight: 16, assets: ["SPY", "TLT"], pattern: /\b(jobs report|payrolls?|nonfarm|unemployment|jobless claims|labor market|employment)\b/i },
  { id: "growth", label: "GDP / growth", weight: 12, assets: ["SPY", "IWM"], pattern: /\b(gdp|recession|retail sales|ism|pmi|consumer spending|economic growth)\b/i },
  { id: "tariffs", label: "Tariffs / trade", weight: 16, assets: ["SPY", "FXI", "EEM"], pattern: /\b(tariffs?|trade (war|deal|talks)|export controls?|sanctions?|duties)\b/i },
  { id: "china", label: "China", weight: 8, assets: ["FXI", "BABA"], pattern: /\b(china|chinese|beijing|xi jinping|yuan|pboc)\b/i },
  { id: "crypto", label: "Crypto", weight: 14, assets: ["BTC", "ETH", "IBIT", "COIN"], pattern: /\b(bitcoin|btc|crypto(currency|currencies)?|ether(eum)?|stablecoins?|coinbase|sec crypto)\b/i },
  { id: "gold", label: "Gold / metals", weight: 14, assets: ["GLD", "GC"], pattern: /\b(gold|bullion|precious metals?|silver)\b/i },
  { id: "oil", label: "Oil / energy", weight: 10, assets: ["USO", "XLE"], pattern: /\b(oil|crude|opec|brent|wti|natural gas)\b/i },
  { id: "earnings", label: "Earnings / guidance", weight: 10, assets: ["single names"], pattern: /\b(earnings|guidance|quarterly results|revenue|beats?|misses?|profit warning)\b/i },
  { id: "markets", label: "Market move", weight: 8, assets: ["SPY", "QQQ", "VIX"], pattern: /\b(stocks?|s&p|nasdaq|dow|wall street|sell-?off|rall(y|ies)|futures|volatility|vix)\b/i },
  { id: "geopolitics", label: "Geopolitics / war", weight: 10, assets: ["GLD", "USO", "VIX"], pattern: /\b(war|missile|strikes?|invasion|ceasefire|military|attack)\b/i },
  { id: "regulation", label: "SEC / regulation", weight: 8, assets: ["sector"], pattern: /\b(sec|regulators?|antitrust|lawsuit|charges?|probe)\b/i },
];

export interface ScoredCluster {
  cluster: Cluster;
  score: number;
  topics: Topic[];
  assets: string[];
  sources: string[];
  stances: string[];
  breakdown: Record<string, number>;
  headline: string;
}

const TIER_POINTS: Record<number, number> = { 1: 20, 2: 12, 3: 6 };

export function scoreCluster(c: Cluster, now = new Date()): ScoredCluster {
  const sources = [...new Set(c.items.map((i) => i.sourceId))];
  const stances = [...new Set(c.items.map((i) => i.stance))];
  // Topics: headline evidence counts fully. Summary-only evidence needs >=2 items (or >=half of a small cluster)
  // and counts a quarter; geopolitics and regulation are headline-only (summaries mention "war"/"SEC" loosely).
  const HEADLINE_ONLY = new Set(["geopolitics", "regulation"]);
  const topicHits = TOPICS.map((t) => {
    const titleHits = c.items.filter((i) => t.pattern.test(i.title)).length;
    const sumHits = HEADLINE_ONLY.has(t.id) ? 0 : c.items.filter((i) => !t.pattern.test(i.title) && t.pattern.test(i.summary)).length;
    const viaSummary = titleHits === 0 && sumHits >= Math.max(2, Math.ceil(c.items.length / 2));
    return { t, titleHits, points: titleHits ? t.weight : viaSummary ? t.weight / 4 : 0 };
  }).filter((h) => h.points > 0);
  const topics = topicHits.map((h) => h.t);
  const bestTier = Math.min(...c.items.map((i) => i.tier));
  const official = c.items.some((i) => i.stance === "us_official");

  const tier = TIER_POINTS[bestTier] ?? 0;
  // topic points: headline matches count fully, summary-only matches half; capped
  const topic = Math.min(35, topicHits.reduce((s, h) => s + h.points, 0));
  const confirmation = Math.min(25, (sources.length - 1) * 6 + (stances.length - 1) * 4);
  const ageH = (now.getTime() - Date.parse(c.lastSeen)) / 3600_000;
  const recency = Math.max(0, 10 - Math.max(0, ageH) * (10 / 24));
  const officialBonus = official ? 10 : 0;
  const breakdown = { tier, topic: Math.round(topic), confirmation, recency: Math.round(recency), official: officialBonus };
  const score = Math.min(100, Math.round(tier + topic + confirmation + recency + officialBonus));

  // headline: the most representative report (shares most tokens with the rest), tier as tiebreak; avoid run-on wire titles
  const tk = c.items.map((i) => tokens(mainClause(i.title)));
  const rep = c.items.map((it, k) => {
    let shared = 0;
    tk.forEach((o, j) => { if (j !== k) for (const t of tk[k]!) if (o.has(t)) shared++; });
    return { it, v: shared / Math.max(1, c.items.length - 1) - it.tier * 0.3 - (it.title.length > 140 ? 2 : 0) };
  });
  const head = rep.sort((a, b) => b.v - a.v || a.it.publishedAt.localeCompare(b.it.publishedAt))[0]!.it;
  return { cluster: c, score, topics, assets: [...new Set(topics.flatMap((t) => t.assets))], sources, stances, breakdown, headline: head.title.length > 160 ? (mainClause(head.title).slice(0, 157) + "…") : head.title };
}

export function rank(clusters: Cluster[], now = new Date()): ScoredCluster[] {
  return clusters
    .map((c) => ({ ...c, items: c.items.filter((i) => !isBoilerplate(i.title)) }))
    .filter((c) => c.items.length > 0)
    .map((c) => scoreCluster(c, now)).sort((a, b) => b.score - a.score || b.cluster.lastSeen.localeCompare(a.cluster.lastSeen));
}
