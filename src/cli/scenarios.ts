/** npm run scenarios [-- --out data/out/scenarios-latest.md] [--fixture data.json] [--no-alarms]. Re-run at 16:30 ET; alerts when the leading scenario changes. */
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { parseInput, CalendarFileSchema, EarningsSchema } from "../adapters/schemas.ts";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { fetchDaily, type Obs } from "../macro/fetch.ts";
import { PM_SERIES } from "../macro/premarket.ts";
import { buildScenarios, scenarioAlarmItems, type ScenarioId } from "../macro/scenarios.ts";
import { ALARM_SOURCES } from "../alerts.ts";
import type { CalendarEvent } from "../ingest/officialCalendar.ts";

const { values } = parseArgs({ options: { out: { type: "string", default: "data/out/scenarios-latest.md" }, fixture: { type: "string" }, "no-alarms": { type: "boolean" } } });
const now = new Date();
const since = new Date(now.getTime() - 120 * 86400_000).toISOString().slice(0, 10);
let data: Record<string, Obs[]> = {}; const failed: Record<string, string> = {};
if (values.fixture) data = JSON.parse(readFileSync(values.fixture, "utf8"));
else await Promise.all(PM_SERIES.map(async (s) => {
  try { data[s.id] = (await fetchDaily(s, since)).filter((o) => o.t >= since); } catch (e) { failed[s.id] = (e as Error).message; }
}));
const calPath = new URL(`../../calendar/releases-${now.getFullYear()}.json`, import.meta.url);
const calendar = existsSync(calPath) ? (parseInput(CalendarFileSchema, JSON.parse(readFileSync(calPath, "utf8")), "release calendar").events as CalendarEvent[]) : [];
const earningsCount = existsSync("data/in/earnings.json") ? parseInput(EarningsSchema, JSON.parse(readFileSync("data/in/earnings.json", "utf8")), "earnings.json").length : null;
const regimeLabel = existsSync("data/out/macro-latest.json") ? ((JSON.parse(readFileSync("data/out/macro-latest.json", "utf8")) as { regime?: { label?: string } }).regime?.label ?? null) : null;
const jsonPath = values.out.replace(/\.md$/, ".json");
const previousLeader: ScenarioId | null = existsSync(jsonPath) ? ((JSON.parse(readFileSync(jsonPath, "utf8")) as { leader?: ScenarioId | null }).leader ?? null) : null;
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
const items = store.since(new Date(now.getTime() - 48 * 3600_000).toISOString()).filter((i) => !ALARM_SOURCES.has(i.sourceId));
const headlines = rank(clusterItems(items), now).slice(0, 40).map((r) => r.headline);
const res = buildScenarios({ now, data, calendar, headlines, earningsCount, regimeLabel, previousLeader });
if (!values["no-alarms"] && res.changed) store.insert(scenarioAlarmItems(res, previousLeader, now), { stance: "center", tier: 1 }, now);
store.close();
const md = res.md + (Object.keys(failed).length ? `\n\n_数据失败：${Object.entries(failed).map(([k, v]) => `${k} (${v})`).join("; ")}_` : "");
mkdirSync(dirname(values.out), { recursive: true });
writeFileSync(values.out + ".tmp", md); renameSync(values.out + ".tmp", values.out);
writeFileSync(jsonPath + ".tmp", JSON.stringify({ generatedAt: now.toISOString(), leader: res.leader, previousLeader, changed: res.changed, ranked: res.ranked.map((x) => ({ id: x.s.id, weight: x.weight, score: x.score, pro: x.pro.map((p) => p.id), con: x.con.map((p) => p.id) })), noTrade: res.noTrade, failed }, null, 2) + "\n");
renameSync(jsonPath + ".tmp", jsonPath);
process.stdout.write(md + "\n");
console.error(`[scenarios] leader ${res.leader ?? "none"}${res.changed ? ` (changed from ${previousLeader})` : ""}, ${Object.keys(failed).length} failed → ${values.out}`);
