/** Regenerate calendar/releases-<year>.json from live official sources (run occasionally; committed as fallback). */
import { writeFileSync } from "node:fs";
import { fetchReleaseCalendar, parseBeaSchedule, BEA_SCHEDULE_URL } from "../src/ingest/officialCalendar.ts";

const year = Number(process.argv[2] ?? new Date().getFullYear());
const r = await fetchReleaseCalendar(year);
const bea = parseBeaSchedule(await (await fetch(BEA_SCHEDULE_URL)).text(), year);
const fredGdpPce = new Set(r.events.filter((e) => e.kind === "GDP" || e.kind === "PCE").map((e) => e.date));
const beaOnly = bea.filter((e) => !fredGdpPce.has(e.date));
const out = {
  generatedAt: new Date().toISOString(),
  year,
  sources: ["https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "https://fred.stlouisfed.org/releases/calendar (mirrors BLS/BEA/Census schedules; times converted CT→ET)", BEA_SCHEDULE_URL],
  crossCheck: { beaDatesMissingFromFred: beaOnly.map((e) => `${e.date} ${e.title}`) },
  errors: r.errors,
  events: r.events.filter((e) => e.date.startsWith(String(year))),
};
writeFileSync(`calendar/releases-${year}.json`, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote calendar/releases-${year}.json: ${out.events.length} events, errors: ${r.errors.length}, BEA-only: ${beaOnly.length}`);
