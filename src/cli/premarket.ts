/** npm run premarket [-- --offline-fixture file.json] [--out data/out/premarket-latest.md]. Chinese premarket report: 【大佬流程】 + 【DK 补充】. */
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { fetchDaily, type Obs } from "../macro/fetch.ts";
import { PM_SERIES, buildPremarket, alarmItems } from "../macro/premarket.ts";
import { ALARM_SOURCES } from "../alerts.ts";
import { statSync } from "node:fs";
import { parseEarnings } from "../options/events.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";

const { values } = parseArgs({ options: { out: { type: "string", default: "data/out/premarket-latest.md" }, fixture: { type: "string" }, "no-alarms": { type: "boolean" } } });
const now = new Date();
const since = new Date(now.getTime() - 120 * 86400_000).toISOString().slice(0, 10);
let data: Record<string, Obs[]> = {}; const failed: Record<string, string> = {};
if (values.fixture) data = JSON.parse(readFileSync(values.fixture, "utf8"));
else await Promise.all(PM_SERIES.map(async (s) => {
  try { data[s.id] = (await fetchDaily(s, since)).filter((o) => o.t >= since); if (!data[s.id]!.length) failed[`${s.id} (${s.provider}:${s.ref})`] = "no data"; }
  catch (e) { failed[`${s.id} (${s.provider}:${s.ref})`] = (e as Error).message; }
}));
const calPath = new URL(`../../calendar/releases-${now.getFullYear()}.json`, import.meta.url);
const calendar: CalendarEvent[] = existsSync(calPath) ? (JSON.parse(readFileSync(calPath, "utf8")) as { events: CalendarEvent[] }).events : [];
const earnings = existsSync("data/in/earnings.json") ? parseEarnings(JSON.parse(readFileSync("data/in/earnings.json", "utf8"))) : null;
const regimeLabel = existsSync("data/out/macro-latest.json") ? ((JSON.parse(readFileSync("data/out/macro-latest.json", "utf8")) as { regime?: { label?: string } }).regime?.label ?? null) : null;
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
const items = store.since(new Date(now.getTime() - 12 * 3600_000).toISOString()).filter((i) => !ALARM_SOURCES.has(i.sourceId));
const headlines = rank(clusterItems(items), now).slice(0, 6).map((r) => `${r.score} · ${r.headline}`);
// prior-session volume anomalies (npm run volume, run just before this in run.sh)
const vPath = "data/out/volume-latest.md";
const volumeLines = existsSync(vPath) && now.getTime() - statSync(vPath).mtimeMs < 20 * 3600_000 ? readFileSync(vPath, "utf8").split("\n").filter((l) => /^- (🚨|⚠️|•)/.test(l) || /Put\/Call/.test(l)).slice(0, 12) : null;
const res = buildPremarket({ now, data, failed, calendar, earnings, headlines, regimeLabel, volumeLines });
if (!values["no-alarms"] && res.alarms.length) store.insert(alarmItems(res.alarms, now), { stance: "center", tier: 1 }, now);
store.close();
mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(values.out + ".tmp", res.md); renameSync(values.out + ".tmp", values.out);
writeFileSync(values.out.replace(/\.md$/, ".json") + ".tmp", JSON.stringify({ generatedAt: now.toISOString(), alarms: res.alarms, noTrade: res.noTrade, failed }, null, 2) + "\n");
renameSync(values.out.replace(/\.md$/, ".json") + ".tmp", values.out.replace(/\.md$/, ".json"));
process.stdout.write(res.md + "\n");
console.error(`[premarket] ${res.alarms.length} alarm(s), ${Object.keys(failed).length} failed series → ${values.out}`);
