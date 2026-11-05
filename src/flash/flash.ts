/** 08:30 / 09:00 数据快报 snapshot (QA C2): today's official releases + a fixed market strip, written as JSON
 *  to data/out/flash-<HHMM>-<YYYY-MM-DD>.json. Pure builder here; the CLI (src/cli/flash.ts) does the fetching. */
import { isMinorRelease, type CalendarEvent } from "../ingest/officialCalendar.ts";

/** short key → Yahoo symbol (same strip as the routine's old /workspace/alpha-data-flash/*.txt) */
export const FLASH_SYMBOLS: Record<string, string> = {
  ES: "ES=F", NQ: "NQ=F", RTY: "RTY=F", SPY: "SPY", QQQ: "QQQ", IWM: "IWM", ZT: "ZT=F", TNX: "^TNX",
  DXY: "DX-Y.NYB", CL: "CL=F", BZ: "BZ=F", GC: "GC=F", VIX: "^VIX", BTC: "BTC-USD",
};
export type FlashSlot = "0830" | "0900";
export interface FlashQuote { price: number; at: string; prevClose: number | null }
export interface FlashFile {
  date: string; slot: FlashSlot; generatedAt: string;
  releases: Array<{ timeEt: string; kind: string; title: string; tier: 1 | 2; source: string }>;
  market_yahoo: Record<string, { price: number; at: string; prev: number | null; chgPct: number | null } | { error: string }>;
  failed: string[];
}
export const flashPath = (outDir: string, slot: FlashSlot, date: string) => `${outDir}/flash-${slot}-${date}.json`;

export function buildFlash(i: { date: string; slot: FlashSlot; now: Date; calendar: CalendarEvent[]; quotes: Record<string, FlashQuote | Error> }): FlashFile {
  const releases = i.calendar.filter((e) => e.date === i.date).sort((a, b) => a.timeEt.localeCompare(b.timeEt))
    .map((e) => ({ timeEt: e.timeEt, kind: e.kind, title: e.title, tier: (isMinorRelease(e) ? 2 : 1) as 1 | 2, source: e.source }));
  const market_yahoo: FlashFile["market_yahoo"] = {}, failed: string[] = [];
  for (const k of Object.keys(FLASH_SYMBOLS)) {
    const q = i.quotes[k];
    if (!q || q instanceof Error) { market_yahoo[k] = { error: q ? q.message : "no data" }; failed.push(k); continue; }
    const chgPct = q.prevClose ? Math.round((q.price / q.prevClose - 1) * 10_000) / 100 : null;
    market_yahoo[k] = { price: q.price, at: q.at, prev: q.prevClose, chgPct };
  }
  return { date: i.date, slot: i.slot, generatedAt: i.now.toISOString(), releases, market_yahoo, failed };
}
