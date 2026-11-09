/**
 * Adapter: daily OHLCV bars. Primary = Robinhood get_equity_historicals saved by the routine as data/in/<TICKER>-bars.json
 * (validated with zod); fallback = Yahoo via adapters/yahoo.ts. Callers get plain Bar[] plus where it came from.
 *
 * get_equity_historicals can append a bar for a session that has not closed: `interpolated: true`, or volume 0 with
 * open = high = low = close. Those are not closes. They are dropped on write and on read, and a file whose last bar
 * is one of them (or otherwise has no volume) still needs a re-fetch.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { issues } from "./schemas.ts";
import { yahooDaily } from "./yahoo.ts";
import type { Bar } from "../levels.ts";

const n = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)]).transform(Number);
const Row = z.looseObject({
  t: z.string().optional(), begins_at: z.string().optional(), timestamp: z.string().optional(), date: z.string().optional(),
  o: n.optional(), open: n.optional(), open_price: n.optional(), h: n.optional(), high: n.optional(), high_price: n.optional(),
  l: n.optional(), low: n.optional(), low_price: n.optional(), c: n.optional(), close: n.optional(), close_price: n.optional(),
  v: n.nullish(), volume: n.nullish(),
});
export const BarsSchema = z.array(Row).min(1);

const SERIES_KEYS = new Set(["bars", "historicals", "data_points"]);

function asRecord(row: unknown): Record<string, unknown> | null {
  return row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : null;
}
function numish(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return null;
}
function firstNum(row: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (row[k] == null || row[k] === "") continue;
    const v = numish(row[k]);
    if (v != null) return v;
  }
  return null;
}
/** Same coercion as parseBars (`v ?? volume ?? 0`, non-numeric → 0). */
export function resolvedVolume(row: unknown): number {
  const r = asRecord(row);
  if (!r) return 0;
  const raw = r.v != null && r.v !== "" ? r.v : r.volume != null && r.volume !== "" ? r.volume : 0;
  return numish(raw) ?? 0;
}
/** Not a completed session: explicit Robinhood gap-fill, or a zero-volume print whose OHLC are identical. */
export function isPlaceholderBar(row: unknown): boolean {
  const r = asRecord(row);
  if (!r) return false;
  if (r.interpolated === true) return true;
  const o = firstNum(r, ["o", "open", "open_price"]);
  const h = firstNum(r, ["h", "high", "high_price"]);
  const l = firstNum(r, ["l", "low", "low_price"]);
  const c = firstNum(r, ["c", "close", "close_price"]);
  return o != null && o === h && h === l && l === c && resolvedVolume(row) === 0;
}
/** No usable share volume (missing, null, or 0). A ranged bar with volume 0 is kept on read but must be re-fetched. */
export function barLacksVolume(row: unknown): boolean {
  return resolvedVolume(row) === 0;
}

function isSeries(v: unknown): v is unknown[] {
  return Array.isArray(v) && v.some((row) => {
    const r = asRecord(row);
    return !!r && ("begins_at" in r || "open_price" in r || "close_price" in r || "open" in r || "close" in r || "o" in r || "c" in r || "t" in r);
  });
}
/** Copy of a historicals payload with placeholder bars removed. Bar arrays stay in place; the rest of the envelope is kept. */
export function stripPlaceholderBars(json: unknown): unknown {
  if (Array.isArray(json)) return isSeries(json) ? json.filter((row) => !isPlaceholderBar(row)) : json.map(stripPlaceholderBars);
  const r = asRecord(json);
  if (!r) return json;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (SERIES_KEYS.has(k) && Array.isArray(v)) out[k] = v.filter((row) => !isPlaceholderBar(row));
    else out[k] = stripPlaceholderBars(v);
  }
  return out;
}

const TICKER = /^[A-Z0-9.^][A-Z0-9.^=-]{0,15}$/;
export function barsFilePath(ticker: string, dir = "data/in"): { upper: string; lower: string; existing: string | null } {
  const sym = ticker.trim().toUpperCase();
  if (!TICKER.test(sym)) throw new Error(`bars: bad ticker ${ticker}`);
  const upper = `${dir}/${sym}-bars.json`, lower = `${dir}/${sym.toLowerCase()}-bars.json`;
  return { upper, lower, existing: existsSync(upper) ? upper : existsSync(lower) ? lower : null };
}
/** Atomic write of data/in/<TICKER>-bars.json after placeholder bars are removed. */
export function writeBarsFile(ticker: string, json: unknown, dir = "data/in"): string {
  const p = barsFilePath(ticker, dir).upper;
  mkdirSync(dir, { recursive: true });
  writeFileSync(p + ".tmp", JSON.stringify(stripPlaceholderBars(json)) + "\n");
  renameSync(p + ".tmp", p);
  return p;
}

function barStamp(row: unknown): string {
  const r = asRecord(row);
  if (!r) return "";
  const t = r.t ?? r.begins_at ?? r.timestamp ?? r.date;
  return typeof t === "string" ? t : "";
}
function latestRawBar(arr: unknown[]): unknown {
  let best = arr[0], bestT = barStamp(best);
  for (let i = 1; i < arr.length; i++) {
    const row = arr[i], t = barStamp(row);
    if (t >= bestT) { best = row; bestT = t; }
  }
  return best;
}
/**
 * True when this payload cannot satisfy a refresh for session `through` (YYYY-MM-DD).
 * A completed bar on or after that date can be skipped. A last bar that is a placeholder or has no volume cannot,
 * even when its date is already `through`.
 */
export function rawBarsNeedRefresh(json: unknown, through: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) throw new Error("bars: through must be YYYY-MM-DD");
  const arr = unwrap(json);
  if (!Array.isArray(arr) || arr.length === 0) return true;
  const last = latestRawBar(arr);
  if (last == null || isPlaceholderBar(last) || barLacksVolume(last)) return true;
  return barStamp(last).slice(0, 10) < through;
}
/** Missing, unreadable, placeholder, no volume, or last completed bar before `through`. */
export function barsNeedRefresh(ticker: string, through: string, dir = "data/in"): boolean {
  const file = barsFilePath(ticker, dir).existing;
  if (!file) return true;
  try { return rawBarsNeedRefresh(JSON.parse(readFileSync(file, "utf8")), through); }
  catch (e) { if ((e as Error).message === "bars: through must be YYYY-MM-DD") throw e; return true; }
}
export function symbolsNeedingBarsRefresh(symbols: string[], through: string, dir = "data/in"): string[] {
  return symbols.filter((s) => barsNeedRefresh(s, through, dir));
}

/** Unwrap MCP envelopes: {data:{results:[{symbol,bars:[...]}]}} / {results:[...]} / {bars|historicals|data_points} / plain array. */
function unwrap(json: unknown): unknown {
  let root = json;
  for (let i = 0; i < 4 && root && !Array.isArray(root); i++) {
    const r = root as Record<string, unknown>;
    root = r.bars ?? r.historicals ?? r.data_points ?? (Array.isArray(r.results) ? (r.results[0] as unknown) : undefined) ?? r.data;
  }
  return root;
}

export function parseBars(json: unknown): Bar[] {
  const arr = unwrap(json);
  if (!Array.isArray(arr)) throw new Error("bars: expected an array or {bars|historicals|data_points} — provide Robinhood get_equity_historicals output");
  const kept = arr.filter((row) => !isPlaceholderBar(row));
  if (!kept.length) throw new Error("bars: no valid OHLC rows");
  const errs = issues(BarsSchema, kept);
  if (errs.length) throw new Error(`bars: ${errs.slice(0, 3).join("; ")}`);
  const rows = BarsSchema.parse(kept);
  const bars = rows.map((b) => ({
    t: String(b.t ?? b.begins_at ?? b.timestamp ?? b.date ?? ""),
    o: Number(b.o ?? b.open ?? b.open_price), h: Number(b.h ?? b.high ?? b.high_price),
    l: Number(b.l ?? b.low ?? b.low_price), c: Number(b.c ?? b.close ?? b.close_price),
    v: Number(b.v ?? b.volume ?? 0) || 0,
  }));
  const ok = bars.filter((b) => [b.o, b.h, b.l, b.c].every(Number.isFinite) && b.h >= b.l);
  if (!ok.length) throw new Error("bars: no valid OHLC rows");
  return ok.sort((a, b) => a.t.localeCompare(b.t));
}

export interface LoadedBars { bars: Bar[]; source: "robinhood" | "yahoo"; note?: string }
/** data/in/<TICKER>-bars.json first; Yahoo if the file is missing, invalid, or the last real bar is older than maxAgeHours. Placeholder bars are ignored, so an unfinished session cannot look fresh. */
export async function loadDailyBars(ticker: string, dir = "data/in", maxAgeHours = 30, now = new Date()): Promise<LoadedBars> {
  let file: string | null = null;
  try { file = barsFilePath(ticker, dir).existing; } catch { file = null; }
  let note: string | undefined;
  if (file) {
    try {
      const bars = parseBars(JSON.parse(readFileSync(file, "utf8")));
      const age = (now.getTime() - Date.parse(bars.at(-1)!.t)) / 3600_000;
      if (age <= maxAgeHours + 72) return { bars, source: "robinhood" }; // weekend/holiday slack
      note = `${file} stale (last bar ${bars.at(-1)!.t.slice(0, 10)})`;
    } catch (e) { note = `${file}: ${(e as Error).message}`; }
  } else note = `${dir}/${ticker.toUpperCase()}-bars.json missing`;
  console.error(`[bars] WARN ${ticker.toUpperCase()}: ${note} → Yahoo fallback (routine should refresh data/in/${ticker.toUpperCase()}-bars.json)`);
  const y = await yahooDaily(ticker, 400);
  return { bars: y.filter((b) => b.v > 0 || /^\^/.test(ticker)).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })), source: "yahoo", note: `${note} → Yahoo fallback` };
}
