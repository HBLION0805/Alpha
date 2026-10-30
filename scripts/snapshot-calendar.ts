/** Regenerate calendar/releases-<year>.json from live official sources (run occasionally; committed as fallback). */
import { writeFileSync } from "node:fs";
import { fetchReleaseCalendar, parseBeaSchedule, BEA_SCHEDULE_URL, parseCensusCalendar, censusCalendarUrl, claimsEvents, DOL_CLAIMS_URL, eciEvents, BLS_ECI_URL, isMinorRelease } from "../src/ingest/officialCalendar.ts";

const year = Number(process.argv[2] ?? new Date().getFullYear());
const r = await fetchReleaseCalendar(year);
const bea = parseBeaSchedule(await (await fetch(BEA_SCHEDULE_URL)).text(), year);
const fredGdpPce = new Set(r.events.filter((e) => e.kind === "GDP" || e.kind === "PCE").map((e) => e.date));
const beaOnly = bea.filter((e) => !fredGdpPce.has(e.date));
// tier-2 08:30 releases: Census calendar (housing starts, durables, trade) + DOL claims rule/exception list
const census = parseCensusCalendar(await (await fetch(censusCalendarUrl(year), { headers: { "user-agent": "Mozilla/5.0" } })).text(), censusCalendarUrl(year));
const claims = claimsEvents(year);
const out = {
  generatedAt: new Date().toISOString(),
  year,
  sources: ["https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", "https://fred.stlouisfed.org/releases/calendar (mirrors BLS/BEA/Census schedules; times converted CT→ET)", BEA_SCHEDULE_URL, censusCalendarUrl(year), DOL_CLAIMS_URL, BLS_ECI_URL],
  claimsSkipped: claims.skipped,
  crossCheck: { beaDatesMissingFromFred: beaOnly.map((e) => `${e.date} ${e.title}`) },
  errors: r.errors,
  events: [...r.events.filter((e) => !isMinorRelease(e)), ...census, ...claims.events, ...eciEvents(year)].filter((e) => e.date.startsWith(String(year))).sort((a, b) => (a.date + a.timeEt).localeCompare(b.date + b.timeEt)),
};
writeFileSync(`calendar/releases-${year}.json`, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote calendar/releases-${year}.json: ${out.events.length} events, errors: ${r.errors.length}, BEA-only: ${beaOnly.length}`);
