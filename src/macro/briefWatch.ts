/**
 * Production seam for 【宏观盯盘】+【资金流】. src/cli/brief.ts calls this with the series the brief already fetched.
 * OAS comes only from the macro store's HYOAS stats (FRED BAMLH0A0HYM2). Missing stats stay missing.
 */
import type { Obs } from "./fetch.ts";
import { buildFixedWatchlist, type FixedWatchlist, type FwExtras, type OasReading } from "./fixedWatchlist.ts";
import { addDays } from "./nyse.ts";
import { lastUsCashSession } from "./quoteMeta.ts";

export interface HyOasStats { last: number | null; lastDate: string | null; chg20: number | null }

/** 10Y 1-day change in bp, same unit as premarket chg("UST10Y") (yield level, not a price %). */
export function yield1dBp(o: Obs[] | undefined): number | null {
  if (!o || o.length < 2) return null;
  const a = o[o.length - 2]!.v, b = o.at(-1)!.v;
  return Number.isFinite(a) && Number.isFinite(b) ? (b - a) * 100 : null;
}

export function oasReading(now: Date, hy: HyOasStats | null | undefined): OasReading | null {
  if (!hy || hy.last == null || hy.chg20 == null || !hy.lastDate) return null;
  const asOf = hy.lastDate.slice(0, 10);
  return { source: "fred", asOf, session: "FRED发布", stale: asOf < addDays(lastUsCashSession(now), -5), last: hy.last, chg20Bp: hy.chg20 };
}

export function assembleBriefWatch(series: Record<string, Obs[] | undefined>, extras: Omit<FwExtras, "rates1dBp" | "oas"> & { oas?: HyOasStats | null } = {}): FixedWatchlist {
  const now = extras.now ?? new Date();
  const { oas: hy, ...rest } = extras;
  return buildFixedWatchlist(series, { ...rest, now, rates1dBp: yield1dBp(series.UST10Y), oas: oasReading(now, hy) });
}
