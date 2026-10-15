import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { loadSources } from "../sources.ts";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { renderDigest } from "../digest.ts";
import { fetchFomcCalendar, upcoming, type CalendarEvent } from "../ingest/officialCalendar.ts";

const { values } = parseArgs({ options: { hours: { type: "string", default: "24" }, top: { type: "string", default: "15" }, out: { type: "string" }, "no-calendar": { type: "boolean" } } });
const hours = Number(values.hours);
const now = new Date();
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
const items = store.since(new Date(now.getTime() - hours * 3600_000).toISOString());
const ranked = rank(clusterItems(items), now);
let calendar: CalendarEvent[] = [];
if (!values["no-calendar"]) {
  try {
    calendar = upcoming(await fetchFomcCalendar(), now, 60);
  } catch (e) {
    console.error("calendar unavailable:", (e as Error).message);
  }
}
const md = renderDigest({ ranked, sources: loadSources(), generatedAt: now, hours, top: Number(values.top), calendar, feedReport: store.feedReport() });
store.close();
if (values.out) {
  writeFileSync(values.out, md);
  console.log(`wrote ${values.out}`);
} else console.log(md);
