/**
 * npm run brief [-- --out data/out/brief-latest.md] [--offline] [--no-alarms]
 * ONE Chinese daily brief (macro + premarket + scenarios + levels + calendar + self-check), ONE verdict.
 * Each series is fetched once (fetchDailyOnce). Also writes data/out/macro-latest.json (digest) and scenarios-latest.json (leader state).
 */
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { parseInput, CalendarFileSchema, EarningsSchema } from "../adapters/schemas.ts";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { refreshMacro, buildMacroReport } from "../macro/build.ts";
import { fetchDailyOnce, fetchCount, type Obs } from "../macro/fetch.ts";
import { PM_SERIES, buildPremarket, alarmItems } from "../macro/premarket.ts";
import { buildScenarios, scenarioAlarmItems, type ScenarioId } from "../macro/scenarios.ts";
import { buildBrief } from "../macro/brief.ts";
import { parseEarnings } from "../options/events.ts";
import { referenceLevels, renderReferenceLevels } from "../levels.ts";
import { loadDailyBars } from "../adapters/bars.ts";
import { ALARM_SOURCES } from "../alerts.ts";
import { fetchReleaseCalendar, type CalendarEvent } from "../ingest/officialCalendar.ts";

const { values } = parseArgs({ options: { out: { type: "string", default: "data/out/brief-latest.md" }, offline: { type: "boolean" }, "no-alarms": { type: "boolean" }, tickers: { type: "string", default: process.env.ALPHA_LEVEL_TICKERS ?? "SPY,QQQ,IWM" } } });
const now = new Date();
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
const failed: Record<string, string> = {};
// 1) one fetch per series: macro SERIES (into SQLite) and premarket/scenario series share fetchDailyOnce
await refreshMacro(store.db, { offline: values.offline ?? false, log: (s) => console.error(s) });
const since = new Date(now.getTime() - 120 * 86400_000).toISOString().slice(0, 10);
const data: Record<string, Obs[]> = {};
if (!values.offline) await Promise.all(PM_SERIES.map(async (s) => {
  try { data[s.id] = (await fetchDailyOnce(s)).filter((o) => o.t >= since); if (!data[s.id]!.length) failed[s.id] = "no data"; } catch (e) { failed[s.id] = (e as Error).message; }
}));
// 2) calendar, earnings, headlines
const staticPath = new URL(`../../calendar/releases-${now.getFullYear()}.json`, import.meta.url);
let calendar: CalendarEvent[] = existsSync(staticPath) ? (parseInput(CalendarFileSchema, JSON.parse(readFileSync(staticPath, "utf8")), "release calendar").events as CalendarEvent[]) : [];
if (!values.offline) { try { calendar = (await fetchReleaseCalendar(now.getFullYear(), calendar)).events; } catch { /* static fallback */ } }
const earnings = existsSync("data/in/earnings.json") ? parseEarnings(JSON.parse(readFileSync("data/in/earnings.json", "utf8"))) : null;
const items = store.since(new Date(now.getTime() - 48 * 3600_000).toISOString()).filter((i) => !ALARM_SOURCES.has(i.sourceId));
const ranked = rank(clusterItems(items), now);
const recent = ranked.filter((r) => Date.parse(r.cluster.lastSeen) >= now.getTime() - 12 * 3600_000);
// 3) parts
const macro = buildMacroReport(store.db, recent, calendar, now);
const vPath = "data/out/volume-latest.md";
const volumeLines = existsSync(vPath) && now.getTime() - statSync(vPath).mtimeMs < 20 * 3600_000 ? readFileSync(vPath, "utf8").split("\n").filter((l) => /^- (🚨|⚠️|•)/.test(l) || /Put\/Call/.test(l)).slice(0, 12) : null;
const pm = buildPremarket({ now, data, failed, calendar, earnings, headlines: recent.slice(0, 6).map((r) => `${r.score} · ${r.headline}`), regimeLabel: macro.regime.label, volumeLines });
const scPath = "data/out/scenarios-latest.json";
const previousLeader: ScenarioId | null = existsSync(scPath) ? ((JSON.parse(readFileSync(scPath, "utf8")) as { leader?: ScenarioId | null }).leader ?? null) : null;
const sc = buildScenarios({ now, data, calendar, headlines: ranked.slice(0, 40).map((r) => r.headline), earningsCount: earnings?.length ?? null, regimeLabel: macro.regime.label, previousLeader });
let levelsMd: string | null = null;
if (!values.offline) {
  const parts: string[] = [];
  for (const t of values.tickers.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)) {
    try { const r = await loadDailyBars(t); parts.push(renderReferenceLevels(t, referenceLevels(r.bars), r.source === "robinhood" ? "Robinhood" : "Yahoo（无 Robinhood 文件）")); } catch (e) { failed[`levels ${t}`] = (e as Error).message; }
  }
  levelsMd = parts.join("\n");
}
const res = buildBrief({ now, macro, pm, sc, levelsMd, calendar, failed });
// 4) alarms into the 30-min alert flow (deduped by guid/url)
if (!values["no-alarms"]) {
  if (pm.alarms.length) store.insert(alarmItems(pm.alarms, now), { stance: "center", tier: 1 }, now);
  if (sc.changed) store.insert(scenarioAlarmItems(sc, previousLeader, now), { stance: "center", tier: 1 }, now);
}
store.close();
const write = (p: string, body: string) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p + ".tmp", body); renameSync(p + ".tmp", p); };
write(values.out, res.md);
write(values.out.replace(/\.md$/, ".json"), JSON.stringify({ generatedAt: now.toISOString(), verdict: res.verdict, reasons: res.reasons, leader: sc.leader, previousLeader, scenarioChanged: sc.changed, alarms: pm.alarms, failed }, null, 2) + "\n");
write("data/out/macro-latest.json", JSON.stringify(macro, null, 2) + "\n");
write(scPath, JSON.stringify({ generatedAt: now.toISOString(), leader: sc.leader, previousLeader, changed: sc.changed }, null, 2) + "\n");
process.stdout.write(res.md + "\n");
console.error(`[brief] ${res.verdict} · leader ${sc.leader ?? "none"}${sc.changed ? ` (was ${previousLeader})` : ""} · ${pm.alarms.length} alarm(s) · ${fetchCount()} daily series fetched once · ${Object.keys(failed).length} failed → ${values.out}`);
