import { parseInput, EarningsSchema } from "../adapters/schemas.ts";
import type { Bar } from "../levels.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";
import type { ExpirySummary } from "./chain.ts";

export interface Earnings { symbol: string; date: string; timing: string | null }
/** Accepts Robinhood get_earnings_calendar output ({data:{results}} or {results}) or a plain array. */
export function parseEarnings(json: unknown): Earnings[] {
  const rows = parseInput(EarningsSchema, json, "earnings");
  return rows.map((r) => ({ symbol: r.symbol, date: r.report?.date ?? r.date ?? "", timing: r.report?.timing ?? r.timing ?? null })).filter((r) => r.date);
}

/**
 * Event variance split (course ch.6/10): front-expiry total variance minus "ordinary" variance at the
 * back-month IV leaves the variance the market prices for the event day.
 */
export function impliedEventMove(S: number, front: ExpirySummary, back: ExpirySummary): number | null {
  if (front.atmIv == null || back.atmIv == null) return null;
  const tf = front.days / 365;
  const v = front.atmIv ** 2 * tf - back.atmIv ** 2 * Math.max(tf - 1 / 365, 0);
  return v > 0 ? Number((S * Math.sqrt(v)).toFixed(2)) : null;
}

/** Historical actual close-to-close moves on past event dates (daily bars, ET dates). */
export function historicalEventMoves(bars: Bar[], dates: string[]): Array<{ date: string; movePct: number }> {
  const byDate = new Map(bars.map((b, i) => [b.t.slice(0, 10), i]));
  const out: Array<{ date: string; movePct: number }> = [];
  for (const d of dates) {
    const i = byDate.get(d);
    if (i == null || i === 0) continue;
    const prev = bars[i - 1]!.c, cur = bars[i]!.c;
    out.push({ date: d, movePct: Number((((cur - prev) / prev) * 100).toFixed(2)) });
  }
  return out;
}

export interface EventCompare { kind: string; nextDate: string | null; samples: number; avgAbsMovePct: number | null; medianAbsMovePct: number | null; maxAbsMovePct: number | null; exceededPriced: number | null; impliedPct: number | null; verdict: "RICH" | "CHEAP" | "FAIR" | "UNKNOWN" }
/** Implied > 1.25× median actual → options RICH for this event; < 0.8× → CHEAP. */
export function compareEvent(kind: string, events: CalendarEvent[], bars: Bar[], asOf: string, impliedPct: number | null): EventCompare {
  const today = asOf.slice(0, 10);
  const past = events.filter((e) => e.kind === kind && e.date <= today).map((e) => e.date);
  const next = events.filter((e) => e.kind === kind && e.date > today).map((e) => e.date).sort()[0] ?? null;
  const mv = historicalEventMoves(bars, past).map((m) => Math.abs(m.movePct)).sort((a, b) => a - b);
  const avg = mv.length ? mv.reduce((s, x) => s + x, 0) / mv.length : null;
  const med = mv.length ? (mv.length % 2 ? mv[(mv.length - 1) / 2]! : (mv[mv.length / 2 - 1]! + mv[mv.length / 2]!) / 2) : null;
  let verdict: EventCompare["verdict"] = "UNKNOWN";
  if (impliedPct != null && med != null && mv.length >= 3) verdict = impliedPct > med * 1.25 ? "RICH" : impliedPct < med * 0.8 ? "CHEAP" : "FAIR";
  const r = (x: number | null) => (x == null ? null : Number(x.toFixed(2)));
  return { kind, nextDate: next, samples: mv.length, avgAbsMovePct: r(avg), medianAbsMovePct: r(med), maxAbsMovePct: mv.length ? r(mv[mv.length - 1]!) : null, exceededPriced: impliedPct != null ? mv.filter((x) => x > impliedPct).length : null, impliedPct, verdict };
}
