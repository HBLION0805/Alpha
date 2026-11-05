/** npm run flash -- --slot 0830|0900 [--out-dir data/out] [--offline]. Writes <journal>/flash/flash-<slot>-<YYYY-MM-DD>.json (persistent)
 *  + a copy at data/out/flash-<slot>-<YYYY-MM-DD>.json (regenerable; QA C2 checks it).
 *  Market quotes from Yahoo (per-symbol failures recorded, never invented); releases from calendar/releases-<year>.json + BLS ECI list. */
import { parseArgs } from "node:util";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { yahooQuote } from "../adapters/yahoo.ts";
import { eciEvents, type CalendarEvent } from "../ingest/officialCalendar.ts";
import { etDate } from "../macro/nyse.ts";
import { basename } from "node:path";
import { flashRel, journalPath, writeAtomic } from "../storage/paths.ts";
import { FLASH_SYMBOLS, buildFlash, flashPath, type FlashQuote, type FlashSlot } from "../flash/flash.ts";

const { values } = parseArgs({ options: { slot: { type: "string", default: "0830" }, "out-dir": { type: "string", default: "data/out" }, offline: { type: "boolean" } } });
if (values.slot !== "0830" && values.slot !== "0900") throw new Error(`--slot must be 0830 or 0900 (got ${values.slot})`);
const now = new Date(), date = etDate(now), year = Number(date.slice(0, 4));
const calF = `calendar/releases-${year}.json`;
const calendar: CalendarEvent[] = [...(existsSync(calF) ? (JSON.parse(readFileSync(calF, "utf8")).events as CalendarEvent[]) : []), ...eciEvents(year)];
const seen = new Set<string>(), cal = calendar.filter((e) => { const k = `${e.kind}|${e.date}`; return seen.has(k) ? false : (seen.add(k), true); });
const quotes: Record<string, FlashQuote | Error> = {};
await Promise.all(Object.entries(FLASH_SYMBOLS).map(async ([k, sym]) => {
  if (values.offline) { quotes[k] = new Error("offline"); return; }
  try { quotes[k] = await yahooQuote(sym); } catch (e) { quotes[k] = e as Error; }
}));
const f = buildFlash({ date, slot: values.slot as FlashSlot, now, calendar: cal, quotes });
const out = flashPath(values["out-dir"]!, f.slot, date), kept = journalPath(flashRel(basename(out))), body = JSON.stringify(f, null, 2) + "\n";
writeAtomic(kept, body); // persistent snapshot first
mkdirSync(values["out-dir"]!, { recursive: true }); writeFileSync(out + ".tmp", body); renameSync(out + ".tmp", out);
console.error(`[flash] ${f.slot} ${date}: ${f.releases.length} release(s), ${Object.keys(FLASH_SYMBOLS).length - f.failed.length}/${Object.keys(FLASH_SYMBOLS).length} quotes → ${kept} + ${out}`);
