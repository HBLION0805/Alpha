/**
 * Adapter: daily OHLCV bars. Primary = Robinhood get_equity_historicals saved by the routine as data/in/<TICKER>-bars.json
 * (validated with zod); fallback = Yahoo via adapters/yahoo.ts. Callers get plain Bar[] plus where it came from.
 */
import { existsSync, readFileSync } from "node:fs";
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
  const errs = issues(BarsSchema, arr);
  if (errs.length) throw new Error(`bars: ${errs.slice(0, 3).join("; ")}`);
  const rows = BarsSchema.parse(arr);
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
/** data/in/<TICKER>-bars.json first; Yahoo if the file is missing, invalid, or older than maxAgeHours. */
export async function loadDailyBars(ticker: string, dir = "data/in", maxAgeHours = 30, now = new Date()): Promise<LoadedBars> {
  const p = `${dir}/${ticker.toUpperCase()}-bars.json`, pl = `${dir}/${ticker.toLowerCase()}-bars.json`;
  const file = existsSync(p) ? p : existsSync(pl) ? pl : null;
  let note: string | undefined;
  if (file) {
    try {
      const bars = parseBars(JSON.parse(readFileSync(file, "utf8")));
      const age = (now.getTime() - Date.parse(bars.at(-1)!.t)) / 3600_000;
      if (age <= maxAgeHours + 72) return { bars, source: "robinhood" }; // weekend/holiday slack
      note = `${file} stale (last bar ${bars.at(-1)!.t.slice(0, 10)})`;
    } catch (e) { note = `${file}: ${(e as Error).message}`; }
  } else note = `${p} missing`;
  const y = await yahooDaily(ticker, 400);
  return { bars: y.filter((b) => b.v > 0 || /^\^/.test(ticker)).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v })), source: "yahoo", note: `${note} → Yahoo fallback` };
}
