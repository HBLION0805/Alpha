import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import type { Bar } from "../levels.ts";
import { type Chain, fillGreeks, expirations, summarizeExpiry, termStructure, constantMaturityIv, type ExpirySummary } from "./chain.ts";
import { ivEnvironment, realizedVol, type IvEnv } from "./ivhistory.ts";
import { selectStrategies, type Direction } from "./matrix.ts";
import { impliedEventMove, compareEvent, type Earnings, type EventCompare } from "./events.ts";

/** Releases that move SPY options pricing; any of them inside the front expiry = "event yes". */
export const MAJOR = ["CPI", "FOMC", "NFP", "PCE", "PPI"];

export interface OptionsDashboard {
  symbol: string; asOf: string; underlyingPrice: number; source?: string;
  expiries: ExpirySummary[]; term: ReturnType<typeof termStructure>; iv30: number | null; ivEnv: IvEnv;
  greeksFilled: number; events: Array<{ date: string; timeEt: string; kind: string; title: string; insideFront: boolean }>;
  earnings: Earnings[]; eventCompare: EventCompare[]; impliedEventMovePct: number | null; normalDayPct: number | null;
  strategy: ReturnType<typeof selectStrategies> & { direction: Direction; event: boolean };
  noTrade: string[];
}

export function buildDashboard(raw: Chain, opts: { calendar: CalendarEvent[]; earnings?: Earnings[]; bars?: Bar[]; ivHistory?: number[]; vix?: number | null; direction?: Direction; horizonDays?: number }): OptionsDashboard {
  const ch = fillGreeks(raw);
  const greeksFilled = ch.contracts.filter((c) => c.greeksSource === "black_scholes").length;
  const expiries = expirations(ch).map((e) => summarizeExpiry(ch, e));
  const term = termStructure(expiries);
  const iv30 = constantMaturityIv(expiries);
  const realized20 = opts.bars?.length ? realizedVol(opts.bars.map((b) => b.c)) : null;
  const ivEnv: IvEnv = iv30 != null ? ivEnvironment(opts.ivHistory ?? [], iv30, { vix: opts.vix ?? null }, realized20) : { ivRank: null, ivPercentile: null, n: 0, level: "UNKNOWN", note: "no ATM IV", realized20, impliedVsRealized: null };
  const today = ch.asOf.slice(0, 10);
  const front = expiries[0];
  const horizonEnd = new Date(Date.parse(today) + (opts.horizonDays ?? 30) * 86400_000).toISOString().slice(0, 10);
  const events = opts.calendar.filter((e) => e.date > today && e.date <= horizonEnd).sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ date: e.date, timeEt: e.timeEt, kind: e.kind, title: e.title, insideFront: !!front && e.date <= front.expiration }));
  const evInFront = events.some((e) => e.insideFront && MAJOR.includes(e.kind));
  const iem = expiries.length >= 2 ? impliedEventMove(ch.underlyingPrice, expiries[0]!, expiries[expiries.length - 1]!) : null;
  const impliedEventMovePct = iem != null ? Number(((iem / ch.underlyingPrice) * 100).toFixed(2)) : null;
  const normalDayPct = iv30 != null ? Number(((iv30 / Math.sqrt(252)) * 100).toFixed(2)) : null;
  const eventCompare = opts.bars?.length ? ["CPI", "FOMC", "NFP"].map((k) => compareEvent(k, opts.calendar, opts.bars!, ch.asOf, impliedEventMovePct ?? normalDayPct)) : [];
  const direction = opts.direction ?? "neutral";
  const atm = front ? ch.contracts.filter((c) => c.expiration === front.expiration && c.strike === front.atmStrike) : [];
  const oi = atm.length ? Math.min(...atm.map((c) => c.openInterest ?? Infinity)) : null;
  const spr = atm.length ? Math.max(...atm.map((c) => (c.bid != null && c.ask != null && c.ask > 0 ? ((c.ask - c.bid) / ((c.ask + c.bid) / 2)) * 100 : 0))) : null;
  const strategy = { ...selectStrategies(direction, ivEnv.level, evInFront, { openInterest: Number.isFinite(oi) ? oi : null, bidAskPct: spr }), direction, event: evInFront };
  const noTrade: string[] = [];
  const in48h = events.filter((e) => Date.parse(e.date) - Date.parse(today) <= 2 * 86400_000 && MAJOR.includes(e.kind));
  if (in48h.length) noTrade.push(`event risk within 48h: ${in48h.map((e) => `${e.kind} ${e.date}`).join(", ")}`);
  if (term.shape === "INVERTED" && !evInFront) noTrade.push("term structure inverted with no scheduled event — stress regime, don't sell vol");
  if (ivEnv.level === "UNKNOWN") noTrade.push("IV environment unknown");
  if (strategy.noTrade) noTrade.push("strategy matrix cell is 不做 (附录 D.1)");
  return { symbol: ch.symbol, asOf: ch.asOf, underlyingPrice: ch.underlyingPrice, source: ch.source, expiries, term, iv30, ivEnv, greeksFilled, events, earnings: opts.earnings ?? [], eventCompare, impliedEventMovePct, normalDayPct, strategy, noTrade };
}

const pct = (x: number | null) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
export function renderDashboard(d: OptionsDashboard, extra: string[] = []): string {
  const L: string[] = [];
  L.push(`# 期权仪表盘 Options dashboard — ${d.symbol} @ ${d.underlyingPrice}`, "", `As of ${d.asOf}${d.source ? ` · source: ${d.source}` : ""}`, "");
  L.push("## 事件日历与 IV 仪表盘 / Event calendar & IV (期权课 10 章 / 附录 D.4)", "");
  L.push(`- IV30 (ATM, constant-maturity): **${pct(d.iv30)}** · IV env: **${d.ivEnv.level}** (rank ${d.ivEnv.ivRank ?? "—"}, pct ${d.ivEnv.ivPercentile ?? "—"}; ${d.ivEnv.note})`);
  L.push(`- 20d realized: ${pct(d.ivEnv.realized20)} · implied vs realized: **${d.ivEnv.impliedVsRealized ?? "—"}** (14.3: 冲突时以隐含 vs 实际为准)`);
  L.push(`- Term structure: **${d.term.shape}** (front ${pct(d.term.frontIv)} → back ${pct(d.term.backIv)}, ${d.term.slopePts ?? "—"} vol pts)`);
  L.push(d.impliedEventMovePct != null ? `- Implied event-day move (variance split front vs back): ±${d.impliedEventMovePct}%` : `- No event premium in front expiry (front IV ≤ back); ordinary-day move from IV30/√252: ±${d.normalDayPct ?? "—"}% (used as "Implied" below)`);
  L.push(`- Greeks filled by Black-Scholes (Robinhood null): ${d.greeksFilled}`, "");
  L.push("| Expiry | DTE | ATM K | ATM IV | Straddle | 1σ EM (P·IV·√(d/365)) | Straddle/0.8 | 25Δ skew (put−call, pts) |", "|---|---|---|---|---|---|---|---|");
  for (const e of d.expiries) L.push(`| ${e.expiration} | ${e.days} | ${e.atmStrike} | ${pct(e.atmIv)} | ${e.straddle ?? "—"} | ±${e.expectedMove ?? "—"} (${e.expectedMovePct ?? "—"}%) | ±${e.straddleImpliedMove ?? "—"} | ${e.skew25 ?? "—"} |`);
  L.push("", "### Upcoming events", "");
  if (!d.events.length) L.push("- none in horizon");
  for (const e of d.events) L.push(`- ${e.date} ${e.timeEt} ET — **${e.kind}** ${e.title}${e.insideFront ? " · inside front expiry" : ""}`);
  if (d.earnings.length) { L.push("", "### Earnings (Robinhood calendar)", ""); for (const e of d.earnings) L.push(`- ${e.date} ${e.timing ?? ""} — ${e.symbol}`); }
  if (d.eventCompare.length) {
    L.push("", "### Event implied vs historical actual (SPY close-to-close on event day)", "", "| Event | Next | Samples | Median |move| | Avg |move| | Max |move| | Implied | Exceeded priced | Verdict |", "|---|---|---|---|---|---|---|---|---|");
    for (const c of d.eventCompare) L.push(`| ${c.kind} | ${c.nextDate ?? "—"} | ${c.samples} | ${c.medianAbsMovePct ?? "—"}% | ${c.avgAbsMovePct ?? "—"}% | ${c.maxAbsMovePct ?? "—"}% | ${c.impliedPct ?? "—"}% | ${c.exceededPriced ?? "—"}/${c.samples} | ${c.verdict} |`);
  }
  L.push("", `## 策略选择矩阵 / Strategy matrix (期权课 14.4 / 附录 D.1) — view: ${d.strategy.direction}, IV ${d.ivEnv.level}, event ${d.strategy.event ? "yes" : "no"}`, "");
  for (const c of d.strategy.candidates) L.push(`- **${c.structure}** ${c.zh} — ${c.why}${c.optional ? ` · OPTIONAL (${c.requires})` : c.requires ? ` · requires ${c.requires}` : ""}${c.strikes ? ` · 执行价 ${c.strikes} · 到期 ${c.expiry}` : ""} _(${c.cite})_`);
  for (const n of d.strategy.notes) L.push(`- _${n}_`);
  L.push("", "## NO_TRADE", "");
  L.push(d.noTrade.length ? d.noTrade.map((x) => `- ⛔ ${x}`).join("\n") : "- no blocking condition (still define max loss + invalidation first)");
  return [...L, ...extra].join("\n") + "\n";
}
