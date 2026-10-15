import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { loadSources } from "../sources.ts";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { renderDigest } from "../digest.ts";
import { renderMacro } from "../macro/render.ts";
import type { MacroReport } from "../macro/build.ts";
import { statSync } from "node:fs";
import { fetchReleaseCalendar, upcoming, type CalendarEvent } from "../ingest/officialCalendar.ts";

const { values } = parseArgs({
  options: { hours: { type: "string", default: "24" }, top: { type: "string", default: "15" }, out: { type: "string" }, "no-calendar": { type: "boolean" }, threshold: { type: "string", default: "60" } },
});
const hours = Number(values.hours);
const now = new Date();
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
const items = store.since(new Date(now.getTime() - hours * 3600_000).toISOString());
const ranked = rank(clusterItems(items), now);
let calendar: CalendarEvent[] = [];
if (!values["no-calendar"]) {
  const year = now.getFullYear();
  const staticPath = new URL(`../../calendar/releases-${year}.json`, import.meta.url);
  const staticEvents = existsSync(staticPath) ? ((JSON.parse(readFileSync(staticPath, "utf8")) as { events: CalendarEvent[] }).events ?? []) : [];
  try {
    const r = await fetchReleaseCalendar(year, staticEvents);
    if (r.errors.length) console.error(`[digest] calendar: ${r.errors.length} live source(s) failed${r.usedStatic ? ", used static snapshot" : ""}`);
    calendar = upcoming(r.events, now, 21);
  } catch (e) {
    console.error("[digest] calendar unavailable:", (e as Error).message);
    calendar = upcoming(staticEvents, now, 21);
  }
}
// macro section from the latest `npm run macro` output, if fresh (< 6h)
let macroSection: string | undefined;
const macroPath = process.env.ALPHA_MACRO_JSON ?? "data/out/macro-latest.json";
if (existsSync(macroPath) && now.getTime() - statSync(macroPath).mtimeMs < 6 * 3600_000) {
  try {
    macroSection = renderMacro(JSON.parse(readFileSync(macroPath, "utf8")) as MacroReport, false);
  } catch (e) {
    console.error("[digest] macro section skipped:", (e as Error).message);
  }
}
const md = renderDigest({ macroSection, ranked, sources: loadSources(), generatedAt: now, hours, top: Number(values.top), alertThreshold: Number(values.threshold), calendar, feedReport: store.feedReport() });
store.close();
if (values.out) {
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out + ".tmp", md);
  renameSync(values.out + ".tmp", values.out); // atomic: readers never see a half-written digest
  console.error(`[digest] wrote ${values.out} (${ranked.length} clusters, ${items.length} items)`);
} else process.stdout.write(md);
