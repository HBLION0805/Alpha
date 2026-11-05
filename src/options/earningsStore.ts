/**
 * Earnings coverage. Merges data/in/earnings.json (Robinhood get_earnings_calendar, market-wide window) with
 * data/in/earnings-by-symbol.json (Robinhood get_earnings_results per symbol; written by the routine, see
 * docs/ROUTINE_EARNINGS.md). Each row keeps confirmed (company-verified) vs estimated. Never invents a date.
 */
import { existsSync, readFileSync } from "node:fs";
import { parseEarnings } from "./events.ts";

export interface EarningsRow { symbol: string; date: string; timing: string | null; confirmed: boolean | null; source: string }
export interface EarningsBook { rows: EarningsRow[]; fetchedAt: string | null; covered: Set<string> }
type RhResult = { symbol: string; eps?: { actual?: string | null }; report?: { date?: string; timing?: string | null; verified?: boolean } };

export function fromBySymbol(j: { fetchedAt?: string; bySymbol?: Record<string, RhResult[]> }): EarningsRow[] {
  const out: EarningsRow[] = [];
  for (const [sym, rs] of Object.entries(j.bySymbol ?? {})) for (const r of rs ?? []) {
    if (!r.report?.date) continue;
    out.push({ symbol: sym.toUpperCase(), date: r.report.date, timing: r.report.timing ?? null, confirmed: r.report.verified ?? null, source: "robinhood.get_earnings_results" });
  }
  return out;
}

export function mergeEarnings(calendar: Array<{ symbol: string; date: string; timing: string | null; verified?: boolean | null }>, bySymbol: EarningsRow[]): EarningsRow[] {
  const m = new Map<string, EarningsRow>();
  for (const r of calendar) m.set(`${r.symbol}|${r.date}`, { symbol: r.symbol, date: r.date, timing: r.timing, confirmed: r.verified ?? null, source: "robinhood.get_earnings_calendar" });
  for (const r of bySymbol) m.set(`${r.symbol}|${r.date}`, r); // per-symbol lookup is newer/more specific
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Next report on/after `today` (YYYY-MM-DD ET). undefined = symbol never looked up; null = looked up, nothing upcoming. */
export function nextEarnings(book: EarningsBook, sym: string, today: string): EarningsRow | null | undefined {
  const s = sym.toUpperCase();
  const r = book.rows.find((x) => x.symbol === s && x.date >= today);
  return r ?? (book.covered.has(s) ? null : undefined);
}

export function fmtEarnings(r: EarningsRow): string {
  const t = r.timing === "am" ? "盘前 BMO" : r.timing === "pm" ? "盘后 AMC" : "时间未知";
  return `${r.date} ${t} · ${r.confirmed === true ? "公司已确认" : r.confirmed === false ? "**预估（未确认）**" : "确认状态未知"}`;
}

export function loadEarningsBook(dir = "data/in"): EarningsBook {
  const cal = existsSync(`${dir}/earnings.json`) ? (() => { const raw = JSON.parse(readFileSync(`${dir}/earnings.json`, "utf8"));
    const ver = new Map<string, boolean>(); for (const r of (raw?.data?.results ?? raw?.results ?? (Array.isArray(raw) ? raw : [])) as Array<{ symbol: string; verified?: boolean; report?: { verified?: boolean } }>) { const v = r.report?.verified ?? r.verified; if (v != null) ver.set(r.symbol, v); }
    return parseEarnings(raw).map((e) => ({ ...e, verified: ver.get(e.symbol) ?? null })); })() : [];
  const bsF = `${dir}/earnings-by-symbol.json`;
  const bs = existsSync(bsF) ? JSON.parse(readFileSync(bsF, "utf8")) as { fetchedAt?: string; bySymbol?: Record<string, RhResult[]> } : null;
  const rows = mergeEarnings(cal, bs ? fromBySymbol(bs) : []);
  return { rows, fetchedAt: bs?.fetchedAt ?? null, covered: new Set([...Object.keys(bs?.bySymbol ?? {}).map((s) => s.toUpperCase()), ...cal.map((c) => c.symbol)]) };
}

const ETF = new Set(["SPY", "QQQ", "IWM", "DIA", "SMH", "SOXX", "HYG", "TLT", "IEF", "GLD", "GDX", "USO", "BNO", "UUP", "IBIT", "XLP", "VIX", "DRAM"]);
/** Symbols that need a per-symbol lookup: watchlist + journal + pending cards, minus ETFs/indexes. */
export function symbolsNeedingEarnings(syms: string[]): string[] {
  return [...new Set(syms.map((s) => s.toUpperCase()).filter((s) => s && !ETF.has(s)))].sort();
}
