/**
 * Option-chain fetch window (2026-11-10: the routine fetched 6/34 names). Pure and deterministic: which expirations, which strikes,
 * which instrument ids to quote. Replicates the 2026-11-10 SPY/QQQ/IWM/TLT/GLD/USO files: next 3 expirations >= today (ET),
 * 6 strikes per expiration (3 strictly below spot + 3 at-or-above), calls and puts, quotes in batches of <= 20 ids.
 */
import { addDays } from "../macro/nyse.ts";

export const SELECT_EXPIRATIONS = 3;
/** Soft cap: prefer expirations within this many days; a sparse name still gets its nearest ones (see selectExpirations). */
export const MAX_EXPIRY_DAYS = 60;
export const STRIKES_BELOW = 3;
export const STRIKES_AT_OR_ABOVE = 3;
/** get_option_quotes / get_equity_quotes ids per call. */
export const QUOTE_BATCH = 20;
/** get_option_instruments page size (Robinhood returns 100 with a `next` cursor). */
export const INSTRUMENT_PAGE = 100;

export interface ExpiryOpts { count?: number; maxDays?: number }
export interface StrikeOpts { below?: number; atOrAbove?: number }

const isDate = (d: string) => /^\d{4}-\d\d-\d\d$/.test(d);

/**
 * Nearest `count` (3) expirations on or after `today` (YYYY-MM-DD, ET). Dates past `today + maxDays` are dropped unless that
 * would leave fewer than 2 (or nothing): then the nearest `count` are taken anyway so a sparse name is not skipped.
 */
export function selectExpirations(dates: string[], today: string, opts: ExpiryOpts = {}): string[] {
  const count = opts.count ?? SELECT_EXPIRATIONS, cap = addDays(today, opts.maxDays ?? MAX_EXPIRY_DAYS);
  const future = [...new Set(dates.map((d) => d.trim()).filter((d) => isDate(d) && d >= today))].sort();
  const within = future.filter((d) => d <= cap);
  return (within.length >= Math.min(2, future.length) ? within : future).slice(0, count);
}

/**
 * `below` strikes strictly below spot + `atOrAbove` at-or-above (6 total). A short side is filled from the other side up to the
 * total; fewer unique strikes than that → all of them. Unique, ascending. Invalid spot → [].
 */
export function selectStrikesNearSpot(strikes: number[], spot: number, opts: StrikeOpts = {}): number[] {
  if (!(Number.isFinite(spot) && spot > 0)) return [];
  const nb = opts.below ?? STRIKES_BELOW, na = opts.atOrAbove ?? STRIKES_AT_OR_ABOVE, total = nb + na;
  const u = [...new Set(strikes.filter((k) => Number.isFinite(k) && k > 0))].sort((a, b) => a - b);
  const below = u.filter((k) => k < spot), above = u.filter((k) => k >= spot);
  let b = Math.min(nb, below.length), a = Math.min(na, above.length);
  b = Math.min(below.length, b + (total - b - a)); // fill the below side if above was short
  a = Math.min(above.length, total - b); // fill the above side if below was short
  return [...below.slice(below.length - b), ...above.slice(0, a)];
}

export interface OptionInstrument { id: string; expiration_date: string; strike_price: string; type: "call" | "put"; state?: string; chain_symbol?: string }

/** Instruments of one get_option_instruments page (`{instruments}` or `{data:{instruments}}`) + its `next` cursor. */
export function instrumentPage(page: unknown): { instruments: OptionInstrument[]; next: string | null } {
  const p = (page ?? {}) as { data?: { instruments?: OptionInstrument[]; next?: string | null }; instruments?: OptionInstrument[]; next?: string | null };
  const body = p.data && (p.data.instruments || "next" in p.data) ? p.data : p;
  const next = body.next ?? p.next ?? null;
  return { instruments: Array.isArray(body.instruments) ? body.instruments : [], next: typeof next === "string" && next ? next : null };
}

/** Selected expirations × near-spot strikes (per expiration), calls and puts. Inactive/expired instruments skipped. */
export function selectInstrumentsForQuotes(instruments: OptionInstrument[], spot: number, today: string, opts: ExpiryOpts & StrikeOpts = {}): OptionInstrument[] {
  const live = instruments.filter((i) => i && i.id && (i.state == null || i.state === "active") && (i.type === "call" || i.type === "put"));
  const exps = selectExpirations(live.map((i) => i.expiration_date), today, opts);
  const seen = new Set<string>(), out: OptionInstrument[] = [];
  for (const e of exps) {
    const ofExp = live.filter((i) => i.expiration_date === e);
    const ks = new Set(selectStrikesNearSpot(ofExp.map((i) => Number(i.strike_price)), spot, opts));
    for (const i of ofExp) if (ks.has(Number(i.strike_price)) && !seen.has(i.id)) { seen.add(i.id); out.push(i); }
  }
  return out.sort((a, b) => a.expiration_date.localeCompare(b.expiration_date) || Number(a.strike_price) - Number(b.strike_price) || a.type.localeCompare(b.type));
}

/**
 * Pages so far already hold the selected window? Only trusted when strikes arrive in ascending order (what Robinhood returns with
 * an `expiration_dates` filter): then no later page can add a strike below the ones seen, and every (expiration, right) has enough
 * at-or-above strikes. Unordered pages → false (keep following `next`).
 */
export function windowComplete(instruments: OptionInstrument[], spot: number, expirations: string[], opts: StrikeOpts = {}): boolean {
  if (!expirations.length || !(spot > 0)) return false;
  for (let j = 1; j < instruments.length; j++) if (Number(instruments[j]!.strike_price) < Number(instruments[j - 1]!.strike_price)) return false;
  const nb = opts.below ?? STRIKES_BELOW, na = opts.atOrAbove ?? STRIKES_AT_OR_ABOVE;
  const last = instruments.length ? Number(instruments[instruments.length - 1]!.strike_price) : -Infinity;
  for (const e of expirations) for (const t of ["call", "put"]) {
    const ks = [...new Set(instruments.filter((i) => i.expiration_date === e && i.type === t).map((i) => Number(i.strike_price)))];
    const below = ks.filter((k) => k < spot).length, above = ks.filter((k) => k >= spot).sort((a, b) => a - b);
    const need = nb + na - Math.min(nb, below);
    // need-th at-or-above strike must be strictly below the last strike seen, so its other-right/expiry twin is not on the next page
    if (above.length < need || !(above[need - 1]! < last)) return false;
  }
  return true;
}

export const chunk = <T>(xs: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n)); return out; };

/** One-line policy for --need / --refresh output. */
export const WINDOW_POLICY = `窗口：最近 ${SELECT_EXPIRATIONS} 个到期日（>= 今天 ET，优先 ${MAX_EXPIRY_DAYS} 天内；不足则有几个取几个）× 每个到期日 ${STRIKES_BELOW + STRIKES_AT_OR_ABOVE} 个行权价（${STRIKES_BELOW} 个低于现价 + ${STRIKES_AT_OR_ABOVE} 个 >= 现价，单边不足由另一边补），认购+认沽；期权报价每次 <= ${QUOTE_BATCH} 个 id`;
