/** Risk-first view: what the regime implies per asset class, and when the answer is NO_TRADE. Never a buy/sell signal. */
import { readFileSync } from "node:fs";
import type { Regime } from "./regime.ts";
import type { Confirmation } from "./confirm.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";

export type Stance = "NO_TRADE" | "CAUTION" | "RESEARCH_OK";

export interface KnowledgeRef {
  id: string;
  kind: "item" | "bias" | "prompt";
  title: string;
  text: string; // verbatim from knowledge/catalog.json
}

export interface AssetView {
  asset: "US stocks / options" | "Gold" | "Bitcoin / crypto";
  stance: Stance;
  notes: string[];
}

export interface RiskView {
  overall: Stance;
  noTradeReasons: string[];
  eventRisk: CalendarEvent[];
  assets: AssetView[];
  checklist: string[];
  knowledge: KnowledgeRef[];
}

export const HIGH_IMPACT = new Set(["FOMC", "CPI", "NFP", "PCE", "PPI"]);
export const EVENT_WINDOW_HOURS = 48;

/** Risk-first checklist from the README core principle. Shown with every view. */
export const CHECKLIST = [
  "先写最大亏损（美元）和失效条件，再看机会 / Write max loss ($) and invalidation BEFORE the idea",
  "只用有限风险结构；不裸卖期权 / Defined-risk only; no naked short options",
  "遵守单笔与每日亏损上限 / Respect per-trade and daily loss caps",
  "NO_TRADE 是合法结果 / NO_TRADE is a valid outcome",
  "复盘先看亏损 / Review losses first",
];

/** ET wall-clock → UTC ms for a calendar event (handles EDT/EST by probing the offset). */
export function eventUtcMs(e: CalendarEvent): number {
  const guess = Date.parse(`${e.date}T${e.timeEt}:00Z`);
  const etHour = Number(new Date(guess).toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }));
  const offset = (Number(e.timeEt.slice(0, 2)) - etHour + 24) % 24; // 4 (EDT) or 5 (EST)
  return guess + offset * 3600_000;
}

export function upcomingHighImpact(cal: CalendarEvent[], now: Date, hours = EVENT_WINDOW_HOURS): CalendarEvent[] {
  return cal.filter((e) => HIGH_IMPACT.has(e.kind)).filter((e) => {
    const t = eventUtcMs(e);
    return t >= now.getTime() && t <= now.getTime() + hours * 3600_000;
  });
}

type Catalog = { items: Array<{ id: string; title: string; principle: string; application: string; limits: string }>; psychology: { biases: Array<{ id: string; title: string; prompt: string }>; prompts: Array<{ id: string; title: string; text: string }> } };
let catalogCache: Catalog | null = null;
export function loadCatalog(path = new URL("../../knowledge/catalog.json", import.meta.url)): Catalog {
  return (catalogCache ??= JSON.parse(readFileSync(path, "utf8")) as Catalog);
}

export function knowledgeRef(id: string, cat = loadCatalog()): KnowledgeRef | null {
  const it = cat.items.find((x) => x.id === id);
  if (it) return { id, kind: "item", title: it.title, text: `${it.principle} ${it.application} ${it.limits}` };
  const b = cat.psychology.biases.find((x) => x.id === id);
  if (b) return { id, kind: "bias", title: b.title, text: b.prompt };
  const p = cat.psychology.prompts.find((x) => x.id === id);
  if (p) return { id, kind: "prompt", title: p.title, text: p.text };
  return null;
}

/** Which knowledge entries each trigger links to (ids in knowledge/catalog.json). */
export const KNOWLEDGE_LINKS: Record<string, string[]> = {
  always: ["size", "psych-daily-loss-limit", "loss-aversion"],
  event: ["patience", "psych-72-hours", "recency"],
  mixed: ["uncertainty", "confirmation", "entry-independent"],
  notConfirmed: ["psych-news", "mechanisms", "narrative"],
  stress: ["psych-revenge", "overnight", "fomo"],
};

export function riskView(reg: Regime, confirmations: Array<{ headline: string; c: Confirmation }>, calendar: CalendarEvent[], now = new Date()): RiskView {
  const ax = (id: string) => reg.axes.find((a) => a.id === id)?.label ?? "UNKNOWN";
  const reasons: string[] = [];
  const triggers = new Set(["always"]);
  const ev = upcomingHighImpact(calendar, now);
  if (ev.length) {
    reasons.push(`高影响事件 48 小时内 / high-impact event within ${EVENT_WINDOW_HOURS}h: ${ev.map((e) => `${e.kind} ${e.date} ${e.timeEt} ET`).join(", ")}`);
    triggers.add("event");
  }
  if (reg.label === "MIXED") {
    reasons.push(`信号冲突 / conflicting regime signals (best rule ${reg.candidates[0]?.label} ${reg.confidence})`);
    triggers.add("mixed");
  }
  const nc = confirmations.filter((x) => x.c.verdict === "NOT_CONFIRMED");
  if (nc.length) {
    reasons.push(`市场未确认头条 / market did not confirm: ${nc.map((x) => `"${x.headline.slice(0, 60)}"`).join("; ")}`);
    triggers.add("notConfirmed");
  }
  if (ax("volatility") === "STRESS" || ax("credit") === "WIDENING") {
    reasons.push(`压力 / stress: VIX ${ax("volatility")}, credit ${ax("credit")}`);
    triggers.add("stress");
  }
  const overall: Stance = reasons.length ? "NO_TRADE" : reg.confidence < 0.75 ? "CAUTION" : "RESEARCH_OK";

  const rates = ax("rates"), real = ax("realYields"), usd = ax("usd"), vol = ax("volatility"), credit = ax("credit"), eq = ax("equities"), liq = ax("liquidity");
  const stocks: string[] = [];
  if (rates === "RISING" || real === "RISING") stocks.push("Rising 2Y/real yields pressure long-duration growth/tech multiples; size smaller.");
  if (vol.startsWith("ELEVATED") || vol === "STRESS" || vol.endsWith("_RISING")) stocks.push(`Volatility ${vol}: option premiums richer — prefer defined-risk spreads over long premium; expect wider gaps.`);
  if (credit === "WIDENING") stocks.push("Credit widening historically precedes equity drawdowns; reduce gross exposure.");
  if (eq === "DOWN") stocks.push("SPY below trend: don't buy dips without a fresh, defined invalidation.");
  if (liq === "TIGHT") stocks.push("Financial conditions tighter than average.");
  if (!stocks.length) stocks.push("No macro headwind flagged; stock-specific risk dominates — still define max loss first.");

  const gold: string[] = [];
  if (real === "RISING") gold.push("Real yields rising: the usual headwind for gold (opportunity cost).");
  if (real === "FALLING") gold.push("Real yields falling: supportive backdrop for gold.");
  if (usd === "UP") gold.push("USD rising: headwind for USD-priced gold.");
  if (vol === "STRESS" || credit === "WIDENING") gold.push("Stress regimes can bring gold bids but also forced selling (margin) — expect noise.");
  if (!gold.length) gold.push("Real yields and USD flat: no strong macro tilt for gold.");

  const btc: string[] = [];
  if (liq === "TIGHT" || rates === "RISING") btc.push("Tighter liquidity / rising front-end yields are historically a headwind for crypto beta.");
  if (vol.startsWith("ELEVATED") || vol === "STRESS") btc.push("Equity vol elevated: BTC tends to trade as high-beta risk; 24/7 gaps — use smaller size.");
  if (usd === "UP") btc.push("Strong USD has coincided with weaker crypto.");
  if (!btc.length) btc.push("No macro headwind flagged for crypto; idiosyncratic/flow risk remains high.");

  const per = (notes: string[]): Stance => (overall === "NO_TRADE" ? "NO_TRADE" : notes.length >= 2 ? "CAUTION" : overall);
  const assets: AssetView[] = [
    { asset: "US stocks / options", stance: per(stocks), notes: stocks },
    { asset: "Gold", stance: per(gold), notes: gold },
    { asset: "Bitcoin / crypto", stance: per(btc), notes: btc },
  ];
  const ids = [...new Set([...triggers].flatMap((t) => KNOWLEDGE_LINKS[t] ?? []))];
  const knowledge = ids.map((id) => knowledgeRef(id)).filter((x): x is KnowledgeRef => !!x);
  return { overall, noTradeReasons: reasons, eventRisk: ev, assets, checklist: CHECKLIST, knowledge };
}
