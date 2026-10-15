/**
 * Trump posts (Truth Social mirror + X file) — core alert source, user request 2026-10-15.
 * A market-relevant post is itself the event: it bypasses multi-outlet confirmation. Direct market topic → ≥70;
 * tariff / Fed / war ACTION → ≥85. Non-market posts (rallies, media attacks, endorsements) → null (ignored).
 * Alerts quote the post verbatim + link + likely assets + 「宣布≠执行，等市场确认」. One post seen on both
 * platforms alerts once (normalized-text key).
 */
import type { Store } from "./store.ts";
import type { Alert } from "./alerts.ts";

export const TRUMP_SOURCES = new Set(["trump_truth", "trump_x"]);
export const TRUMP_NOTE = "宣布≠执行，等市场确认";
interface T { id: string; label: string; re: RegExp; assets: string[]; action?: RegExp }
export const TRUMP_TOPICS: T[] = [
  { id: "tariff", label: "关税/贸易", re: /\b(tariffs?|duties|trade (deal|war|agreement|deficit)|reciprocal|import tax|export controls?)\b/i, assets: ["SPY", "QQQ", "FXI", "DXY"],
    action: /\b(\d+(\.\d+)?\s?%|percent|impos(e|ed|ing)|rais(e|ed|ing)|increas(e|ed|ing)|effective|will be (charged|paying|applied)|starting|paus(e|ed|ing)|suspend(ed|ing)?|lift(ed|ing)?|terminat(e|ed|ing)|cancel(l)?(ed|ing)?)\b/i },
  { id: "china", label: "中国/台湾", re: /\b(china|chinese|xi jinping|president xi|beijing|ccp|taiwan)\b/i, assets: ["FXI", "KWEB", "SPY"] },
  { id: "fed", label: "美联储/利率", re: /\b(fed|federal reserve|powell|interest rates?|rate cuts?|cut rates|too late|fomc)\b/i, assets: ["TLT", "DXY", "SPY", "GLD"],
    action: /\b(fire|fired|firing|replace|replaced|remove|removed|resign|terminate)\b[^.]{0,60}\b(powell|chairman|fed)\b|\bpowell\b[^.]{0,60}\b(fired|out|resign|replaced|terminated)\b|\b(cut|lower)\s+(interest\s+)?rates\s+(now|immediately|by)\b|\bnew fed chair(man)?\b/i },
  { id: "energy", label: "石油/伊朗/霍尔木兹", re: /\b(oil|opec|crude|gasoline|drill(ing)?|iran(ian)?|hormuz|saudi|venezuela(n)?|pipeline|lng)\b/i, assets: ["USO", "XLE", "GLD"] },
  { id: "sanctions", label: "制裁", re: /\bsanction(s|ed|ing)?\b/i, assets: ["USO", "FXI", "DXY"] },
  { id: "war", label: "战争/军事", re: /\b(war|military|troops|missiles?|bomb(s|ed|ing)?|strikes?|struck|attack(s|ed|ing)?|invade|invasion|ceasefire|navy|warships?|nuclear|blockade)\b/i, assets: ["GLD", "VIX", "USO", "SPY"],
    action: /\b(we (will|have|just)|i have (ordered|authorized)|ordered|authorized|launched|have begun|will begin|declare(d)?)\b[^.]{0,80}\b(strikes?|attacks?|bomb(s|ing)?|war|military action|blockade|invasion|troops)\b|\bdeclare war\b|\bsuccessful (attack|strike)s?\b/i },
  { id: "deal", label: "协议/谈判", re: /\b(deal|agreement|negotiat(e|ion|ions|ing)|summit|peace)\b/i, assets: ["SPY"] },
  { id: "crypto", label: "加密货币", re: /\b(bitcoin|btc|crypto(currency)?|stablecoins?|digital assets?)\b/i, assets: ["IBIT", "COIN"] },
  { id: "markets", label: "股市", re: /\b(stock market|dow|s&p|nasdaq|stocks)\b/i, assets: ["SPY", "QQQ"] },
];
/** company / ticker mentions → tickers */
const COMPANIES: Array<[RegExp, string]> = [[/\bapple\b/i, "AAPL"], [/\btesla\b/i, "TSLA"], [/\bnvidia\b/i, "NVDA"], [/\bintel\b/i, "INTC"], [/\bboeing\b/i, "BA"], [/\bamazon\b/i, "AMZN"], [/\bmicrosoft\b/i, "MSFT"], [/\bgoogle|alphabet\b/i, "GOOGL"], [/\bmeta\b|\bfacebook\b/i, "META"], [/\bexxon\b/i, "XOM"], [/\bchevron\b/i, "CVX"], [/\blockheed\b/i, "LMT"], [/\bu\.?s\.? steel\b/i, "X"], [/\btiktok\b/i, "BDNC (private)"], [/\bgeneral motors|\bgm\b/i, "GM"], [/\bford\b/i, "F"], [/\bpfizer\b/i, "PFE"], [/\bwalmart\b/i, "WMT"], [/\bjpmorgan|jp morgan\b/i, "JPM"], [/\btsmc|taiwan semiconductor\b/i, "TSM"], [/\bglobalfoundries\b/i, "GFS"]];
const NON_MARKET = /\b(complete and total endorsement|endorsement|vote for|get out and vote|rally|fake news|failing new york times|cnn|msnbc|abc fake|nbc|polls?|primary|witch hunt|happy birthday|congratulations)\b/i;

export interface TrumpScore { score: number; topics: Array<{ id: string; label: string }>; assets: string[]; action: string | null }
/** Text with links stripped; empty / media-only posts have no market content. */
export const postText = (t: string) => t.replace(/<[^>]+>/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
export const isMediaOnly = (t: string) => /^(image|video) post from\b/i.test(t.trim()) || postText(t).length < 12;
/** Full post text: the mirror's title is truncated (~300 chars) or generic ("Post from …"); the summary has the body. "RT: url" prefix kept as 转发. */
export function fullText(i: { title: string; summary: string }): string {
  const t = postText(i.title), s = postText(i.summary.replace(/^RT:\s*https?:\/\/\S+\s*/, "")).replace(/\s*View (image|video)$/i, "");
  const generic = /^(image |video )?post from\b/i.test(t);
  return generic ? s : s.length > t.length ? s : t;
}
export const isRepost = (i: { summary: string }) => /^RT:\s/.test(i.summary);

export function scoreTrumpPost(raw: string): TrumpScore | null {
  if (isMediaOnly(raw)) return null;
  const t = postText(raw);
  const hits = TRUMP_TOPICS.filter((x) => x.re.test(t));
  const tickers = [...new Set([...COMPANIES.filter(([re]) => re.test(t)).map(([, k]) => k), ...[...t.matchAll(/\$([A-Z]{1,5})\b/g)].map((m) => m[1]!)])];
  const action = hits.find((x) => x.action?.test(t)) ?? null;
  // "deal"/"markets" alone are too generic for a political account; need a second market topic or a ticker
  // "war" vocabulary alone (e.g. "Ballroom and Military Complex") is not market news: it needs a second topic or an action
  const strong = hits.filter((x) => x.id !== "deal" && x.id !== "markets" && x.id !== "war");
  if (!action && !strong.length && !tickers.length) return null;
  if (!action && NON_MARKET.test(t)) return null;
  const topics = [...hits.map((x) => ({ id: x.id, label: x.label })), ...(tickers.length ? [{ id: "ticker", label: "个股/公司" }] : [])];
  const score = Math.min(95, (action ? 85 : 70) + 3 * Math.max(0, topics.length - 1));
  return { score, topics, assets: [...new Set([...tickers, ...hits.flatMap((x) => x.assets)])].slice(0, 8), action: action?.id ?? null };
}

export const postKey = (t: string) => postText(t).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").slice(0, 160);
const PLATFORM: Record<string, string> = { trump_truth: "Truth Social", trump_x: "X" };
type Item = { id: number; sourceId: string; title: string; summary: string; url: string; publishedAt: string };

/** One alert per post (deduped across Truth Social and X by normalized text); store-deduped like every alert. */
export function trumpAlerts(items: Item[], store: Pick<Store, "priorAlertScore">, threshold: number, sinceMs: number): Array<{ alert: Alert; itemIds: number[] }> {
  const groups = new Map<string, Item[]>();
  for (const i of items.filter((x) => TRUMP_SOURCES.has(x.sourceId) && !isMediaOnly(fullText(x)))) {
    const k = postKey(fullText(i)); if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  const out: Array<{ alert: Alert; itemIds: number[] }> = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    if (!g.some((i) => Date.parse(i.publishedAt) >= sinceMs)) continue;
    const s = scoreTrumpPost(fullText(g[0]!));
    if (!s || s.score < threshold || store.priorAlertScore(g.map((i) => i.id)) !== null) continue;
    const quote = fullText(g[0]!);
    const plats = [...new Set(g.map((i) => PLATFORM[i.sourceId] ?? i.sourceId))];
    out.push({ itemIds: g.map((i) => i.id), alert: {
      score: s.score, headline: `川普${isRepost(g[0]!) ? "转发" : "发帖"}（${plats.join(" + ")}）：${s.topics.map((x) => x.label).join("、")}${s.action ? " · 行动级" : ""}`,
      topics: ["trump", ...s.topics.map((x) => x.id)], watch: s.assets, sources: plats.map((p) => `Trump ${p}`), stances: ["us_official"],
      firstSeen: g[0]!.publishedAt, lastSeen: g.at(-1)!.publishedAt, escalation: false,
      links: g.map((i) => ({ source: PLATFORM[i.sourceId] ?? i.sourceId, title: quote, url: i.url })),
      quote, note: `可能影响：${s.assets.join("、") || "—"}。${TRUMP_NOTE}`,
    } });
  }
  return out;
}
