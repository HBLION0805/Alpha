/**
 * npm run brief [-- --out data/out/brief-latest.md] [--offline] [--no-alarms]
 * ONE Chinese daily brief (macro + premarket + scenarios + levels + calendar + self-check), ONE verdict.
 * Each series is fetched once (fetchDailyOnce). Also writes data/out/macro-latest.json (digest) and scenarios-latest.json (leader state).
 */
import { fetchGex, renderGex } from "../options/gex.ts";
import { planId } from "../options/planlink.ts";
import { defaultCapital } from "../config.ts";
import { withOpex } from "../macro/opex.ts";
import { writeFileSync, renameSync, mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { parseInput, CalendarFileSchema, EarningsSchema } from "../adapters/schemas.ts";
import { Store } from "../store.ts";
import { clusterItems } from "../cluster.ts";
import { rank } from "../score.ts";
import { refreshMacro, buildMacroReport } from "../macro/build.ts";
import { fetchDailyOnce, fetchCount, type Obs } from "../macro/fetch.ts";
import { OIL_IDS } from "../macro/oil.ts";
import { PM_SERIES, buildPremarket, alarmItems } from "../macro/premarket.ts";
import { buildScenarios, scenarioAlarmItems, type ScenarioId } from "../macro/scenarios.ts";
import { buildBrief, briefVerdict } from "../macro/brief.ts";
import { classifyMatrix, renderMatrix } from "../macro/matrix.ts";
import { buildTradePlan } from "../macro/tradeplan.ts";
import { parseEarnings } from "../options/events.ts";
import { referenceLevels, renderReferenceLevels } from "../levels.ts";
import { loadDailyBars } from "../adapters/bars.ts";
import { ALARM_SOURCES } from "../alerts.ts";
import { fetchReleaseCalendar, type CalendarEvent } from "../ingest/officialCalendar.ts";
import { loadFedSpeakers, renderFedSpeakers } from "../ingest/fedSpeakers.ts";
import { loadMajorEvents } from "../options/majorEvents.ts";
import { fetchLiquidity, liquidityWatch, renderLiquidity } from "../macro/liquidity.ts";

const { values } = parseArgs({ options: { out: { type: "string", default: "data/out/brief-latest.md" }, offline: { type: "boolean" }, "no-alarms": { type: "boolean" }, "no-gex": { type: "boolean" }, tickers: { type: "string", default: process.env.ALPHA_LEVEL_TICKERS ?? "SPY,QQQ,IWM" } } });
const now = new Date();
const store = new Store(process.env.ALPHA_DB ?? "data/alpha-news.sqlite");
const failed: Record<string, string> = {};
// 1) one fetch per series: macro SERIES (into SQLite) and premarket/scenario series share fetchDailyOnce
await refreshMacro(store.db, { offline: values.offline ?? false, log: (s) => console.error(s) });
const since = new Date(now.getTime() - 120 * 86400_000).toISOString().slice(0, 10);
const since400 = new Date(now.getTime() - 400 * 86400_000).toISOString().slice(0, 10);
const data: Record<string, Obs[]> = {};
if (!values.offline) await Promise.all(PM_SERIES.map(async (s) => {
  // oil block needs 50-day SMA + 52-week high → keep ~400 days for those series
  try { data[s.id] = (await fetchDailyOnce(s)).filter((o) => o.t >= (OIL_IDS.includes(s.id) ? since400 : since)); if (!data[s.id]!.length) failed[s.id] = "no data"; } catch (e) { failed[s.id] = (e as Error).message; }
}));
// 【大佬情景对照】 jobs data (FRED; weekly claims, monthly payrolls) — UNKNOWN if the fetch fails
for (const [id, ref] of [["ICSA", "ICSA"], ["PAYEMS", "PAYEMS"]] as const) {
  if (values.offline) break;
  try { data[id] = (await fetchDailyOnce({ id, provider: "fred", ref, label: id, unit: "price", frequency: "daily" })).filter((o) => o.t >= since400); } catch (e) { failed[id] = (e as Error).message; }
}
// 2) calendar, earnings, headlines
const staticPath = new URL(`../../calendar/releases-${now.getFullYear()}.json`, import.meta.url);
let calendar: CalendarEvent[] = existsSync(staticPath) ? (parseInput(CalendarFileSchema, JSON.parse(readFileSync(staticPath, "utf8")), "release calendar").events as CalendarEvent[]) : [];
if (!values.offline) { try { calendar = (await fetchReleaseCalendar(now.getFullYear(), calendar)).events; } catch { /* static fallback */ } }
calendar = withOpex(calendar, now.getFullYear()); // DK: monthly OpEx
const earnings = existsSync("data/in/earnings.json") ? parseEarnings(JSON.parse(readFileSync("data/in/earnings.json", "utf8"))) : null;
const items = store.since(new Date(now.getTime() - 48 * 3600_000).toISOString()).filter((i) => !ALARM_SOURCES.has(i.sourceId));
const ranked = rank(clusterItems(items), now);
const recent = ranked.filter((r) => Date.parse(r.cluster.lastSeen) >= now.getTime() - 12 * 3600_000);
// 3) parts
const macro = buildMacroReport(store.db, recent, calendar, now);
const vPath = "data/out/volume-latest.md";
const volumeLines = existsSync(vPath) && now.getTime() - statSync(vPath).mtimeMs < 20 * 3600_000 ? readFileSync(vPath, "utf8").split("\n").filter((l) => /^- (🚨|⚠️|•)/.test(l) || /Put\/Call/.test(l)).slice(0, 12) : null;
const fedR = await loadFedSpeakers({ offline: values.offline ?? false, now });
const fedLines = fedR.data ? renderFedSpeakers(fedR.data.speeches, fedR.data.blackouts, now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), 14, fedR.status, fedR.data.coverage) : [`- 不可用：${fedR.status}`];
const pm = buildPremarket({ fedLines, now, data, failed, calendar, earnings, headlines: recent.slice(0, 6).map((r) => `${r.score} · ${r.headline}`), regimeLabel: macro.regime.label, volumeLines });
const scPath = "data/out/scenarios-latest.json";
const previousLeader: ScenarioId | null = existsSync(scPath) ? ((JSON.parse(readFileSync(scPath, "utf8")) as { leader?: ScenarioId | null }).leader ?? null) : null;
const sc = buildScenarios({ now, data, calendar, headlines: ranked.slice(0, 40).map((r) => r.headline), earningsCount: earnings?.length ?? null, regimeLabel: macro.regime.label, previousLeader });
let levelsMd: string | null = null;
const planRefs: Record<string, ReturnType<typeof referenceLevels>> = {}; const planB5: Record<string, number | null> = {};
if (!values.offline) {
  const parts: string[] = [];
  for (const t of values.tickers.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)) {
    try { const r = await loadDailyBars(t); planRefs[t] = referenceLevels(r.bars); const b = r.bars; planB5[t] = b.length > 5 ? ((b.at(-1)!.c - b[b.length - 6]!.c) / b[b.length - 6]!.c) * 100 : null; parts.push(renderReferenceLevels(t, referenceLevels(r.bars), r.source === "robinhood" ? "Robinhood" : "Yahoo（无 Robinhood 文件）")); } catch (e) { failed[`levels ${t}`] = (e as Error).message; }
  }
  levelsMd = parts.join("\n");
}
// 今日交易计划 needs TLT levels too (not a default levels ticker)
for (const t of ["SPY", "QQQ", "IWM", "TLT"]) if (!planRefs[t]) { try { const r = await loadDailyBars(t); planRefs[t] = referenceLevels(r.bars); const b = r.bars; planB5[t] = b.length > 5 ? ((b.at(-1)!.c - b[b.length - 6]!.c) / b[b.length - 6]!.c) * 100 : null; } catch { /* candidate shows "没有价位数据" */ } }
const { verdict: v0, reasons: r0 } = briefVerdict({ macro, pm, sc });
const plan = buildTradePlan({ leader: sc.leader, verdict: v0, noTrade: r0, levels: planRefs, data, bars5d: planB5, capital: defaultCapital() });
const mx = classifyMatrix(data);
// dealer gamma (GEX) from CBOE delayed quotes — config/gex.json or ALPHA_GEX_SYMBOLS; failures marked unavailable
const gexCfg = existsSync("config/gex.json") ? JSON.parse(readFileSync("config/gex.json", "utf8")) : { symbols: ["SPY", "QQQ", "NVDA", "SOXL"], days: 45 };
const gexSyms: string[] = (process.env.ALPHA_GEX_SYMBOLS?.split(",").map((x) => x.trim()).filter(Boolean)) ?? gexCfg.symbols;
const gex = values.offline || values["no-gex"] ? [] : await Promise.all(gexSyms.map((s) => fetchGex(s, gexCfg.days ?? 45)));
const planIdLines = plan.qualified.map((c) => `- plan-id：\`${planId(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), c)}\`（paper open --plan-id）`);
// 导师提醒: previous regime (macro-latest.json is overwritten below), paper ledger, official FOMC/CPI/NFP + flagged events
const prevMacroF = "data/out/macro-latest.json", previousRegime = existsSync(prevMacroF) ? (JSON.parse(readFileSync(prevMacroF, "utf8")) as { regime?: { label?: string } }).regime?.label ?? null : null;
const pj = existsSync("data/journal/paper.json") ? JSON.parse(readFileSync("data/journal/paper.json", "utf8")) : { capital: defaultCapital(), entries: [] };
// 流动性观察 (weekly Howell framework; flag only). Per-series timeout + 6h cache; any failure → 数据不可用, never fabricated
let liquidityLines: string[] | undefined, liq: ReturnType<typeof liquidityWatch> | null = null;
try { const L = await fetchLiquidity({ now, offline: values.offline ?? false }); liq = liquidityWatch(L.data, now.toLocaleDateString("en-CA", { timeZone: "America/New_York" })); liquidityLines = renderLiquidity(liq, L.data, L.meta);
  for (const [k, e] of Object.entries(L.meta.errors)) failed[`liquidity ${k}`] = e!; }
catch (e) { failed.liquidity = (e as Error).message; liquidityLines = ["## 1.2 流动性观察（每周 · 只标记）", "", `- 数据不可用（${(e as Error).message}）`, ""]; }
const mentor = { liquidity: liq ? { status: liq.status, label: liq.label, alerts: liq.alerts } : null, events: loadMajorEvents().events, journal: pj.entries ?? [], capital: pj.capital ?? defaultCapital(), previousRegime, previousLeader };
const res = buildBrief({ mentor, liquidityLines, now, macro, pm, sc, levelsMd, planLines: [...plan.lines, ...planIdLines], matrixLines: renderMatrix(mx, sc.leader), gexLines: gex.length ? renderGex(gex) : undefined, calendar, failed });
// 4) alarms into the 30-min alert flow (deduped by guid/url)
if (!values["no-alarms"]) {
  if (pm.alarms.length) store.insert(alarmItems(pm.alarms, now), { stance: "center", tier: 1 }, now);
  if (sc.changed) store.insert(scenarioAlarmItems(sc, previousLeader, now), { stance: "center", tier: 1 }, now);
}
store.close();
const write = (p: string, body: string) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p + ".tmp", body); renameSync(p + ".tmp", p); };
write(values.out, res.md);
write(values.out.replace(/\.md$/, ".json"), JSON.stringify({ generatedAt: now.toISOString(), verdict: res.verdict, reasons: res.reasons, leader: sc.leader, previousLeader, scenarioChanged: sc.changed, plan: plan.qualified.map((c) => ({ ...c, id: planId(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), c) })), gex: gex.map((g) => (g.ok ? { symbol: g.symbol, net: Math.round(g.net), flip: g.flip, callWall: g.callWall, putWall: g.putWall, maxPain: g.maxPain, asOfUtc: g.asOfUtc } : { symbol: g.symbol, error: g.error })), matrix: { best: mx.best.map((b) => b.id), matches: mx.matches, unknown: mx.unknown }, alarms: pm.alarms, liquidity: liq ? { status: liq.status, label: liq.label, alerts: liq.alerts, asOf: liq.now.date } : null, oilVix: { fast: pm.oilVix.fast, driver: pm.oilVix.driver, vix: pm.oilVix.vix.label }, failed }, null, 2) + "\n");
write("data/out/macro-latest.json", JSON.stringify(macro, null, 2) + "\n");
write(scPath, JSON.stringify({ generatedAt: now.toISOString(), leader: sc.leader, previousLeader, changed: sc.changed }, null, 2) + "\n");
process.stdout.write(res.md + "\n");
console.error(`[brief] ${res.verdict} · leader ${sc.leader ?? "none"}${sc.changed ? ` (was ${previousLeader})` : ""} · ${pm.alarms.length} alarm(s) · ${fetchCount()} daily series fetched once · ${Object.keys(failed).length} failed → ${values.out}`);
