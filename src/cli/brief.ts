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
import { renderSleep, sleepJson, TRUMP_SCHEDULED_RE, TRUMP_MIN_SCORE } from "../macro/sleepday.ts";
import { addDays, etDate } from "../macro/nyse.ts";
import { trumpSignal } from "../trump.ts";
import { DEADCAT_SERIES, renderDeadCat, deadCatJson } from "../macro/deadcat.ts";
import { loadLevels, activeEntry, levelSeries, renderMentorLevels, checklistItems, levelsJson } from "../macro/mentorLevels.ts";
import { wtiFront, frontContinuous } from "../macro/wtiFront.ts";
import { loadGeoEvents, geoReminderLines, geoCalendarLines } from "../macro/geoEvents.ts";
import { loadFollowups, loadFollowupInputs, followupLines } from "../macro/eventFollowup.ts";
import { ratesLines, regimeOilContract, loadManual } from "../macro/ratesRegime.ts";
import { paperEquity } from "../options/confidence.ts";
import { yahooDaily } from "../adapters/yahoo.ts";
import { runScenarios, suggestHedge, renderScenarioTable } from "../options/scenarioEngine.ts";
import { entryInput } from "../options/scenarioCtx.ts";
import { entryCapUsd } from "../options/confidence.ts";

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
// 大佬 10/19 死猫 vs 见底 (display only): extra ETFs in their own record so the premarket / matrix inputs stay unchanged
const dcData: Record<string, Obs[]> = {};
const front = wtiFront(etDate(now));
if (!values.offline) await Promise.all([...DEADCAT_SERIES, { id: "WTI_FRONT", provider: "yahoo" as const, ref: front.yahoo, label: `WTI 近月 ${front.code}`, unit: "price" as const, frequency: "daily" as const }].map(async (s) => { try { dcData[s.id] = (await fetchDailyOnce(s)).filter((o) => o.t >= since); } catch (e) { failed[`deadcat ${s.id}`] = (e as Error).message; } }));
// 大佬今日价位 (knowledge/mentor/market-calls/levels.json; display only): series keyed by the level's `series` string
const lv = loadLevels(), lvActive = activeEntry(lv.entries, now), lvData: Record<string, Obs[]> = {};
if (!values.offline && lvActive) await Promise.all(levelSeries(lvActive.entry).map(async ({ key, def }) => { try { lvData[key] = (await fetchDailyOnce(def)).filter((o) => o.t >= since); } catch (e) { failed[`levels ${key}`] = (e as Error).message; } }));
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
const oilFront = dcData.WTI_FRONT?.length ? frontContinuous(data.WTI, dcData.WTI_FRONT, front.code) : null; // oil block / alarms / 快速变动 only
const pm = buildPremarket({ oilFront, fedLines, now, data, failed, calendar, earnings, headlines: recent.slice(0, 6).map((r) => `${r.score} · ${r.headline}`), regimeLabel: macro.regime.label, volumeLines });
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
const pj0 = existsSync("data/journal/paper.json") ? JSON.parse(readFileSync("data/journal/paper.json", "utf8")) : { capital: defaultCapital(), entries: [] };
const equity0 = paperEquity(pj0.entries ?? [], pj0.capital ?? defaultCapital()); // per-trade cap = confidence tier × live paper equity
const plan = buildTradePlan({ leader: sc.leader, verdict: v0, noTrade: r0, levels: planRefs, data, bars5d: planB5, capital: equity0 });
const mx = classifyMatrix(data);
const mlv = renderMentorLevels(lv.entries, { ...data, ...lvData }, now, lv.error);
const dc = renderDeadCat({ ...data, ...dcData }, mx, checklistItems(mlv), mlv.lines);
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
// 今日能不能睡 (mentor list; flag only): official FOMC/CPI/NFP, Fed speakers cache (Board + regional, 14-day window), Trump posts + news in the store
const trumpSig = trumpSignal(store.since(new Date(now.getTime() - 48 * 3600_000).toISOString()), now, TRUMP_MIN_SCORE); // X + Truth Social, cross-posts merged
const fmtEt = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: "America/New_York" }).slice(0, 16) + " ET";
const sleep = renderSleep({ now, events: mentor.events,
  fed: fedR.data ? { speeches: fedR.data.speeches, blackouts: fedR.data.blackouts, coverTo: addDays(etDate(new Date(fedR.data.fetchedAt)), 14), status: fedR.status } : null,
  trump: { posts: trumpSig.posts, scheduled: ranked.filter((r) => Date.parse(r.cluster.lastSeen) >= now.getTime() - 24 * 3600_000 && TRUMP_SCHEDULED_RE.test(r.headline)).map((r) => ({ at: r.cluster.lastSeen, headline: r.headline })),
    status: trumpSig.status } });
// today's releases (incl. tier-2 08:30 prints) for the 8:30 数据快报 routine
const todayReleases = calendar.filter((e) => e.date === etDate(now)).sort((a, b) => a.timeEt.localeCompare(b.timeEt)).map((e) => ({ timeEt: e.timeEt, kind: e.kind, title: e.title, tier: e.tier ?? 1 }));
// 地缘/选举事件: display + 72h reminder only (kept out of calendar/mentor.events on purpose)
const geoF = loadGeoEvents(); if (geoF.error) failed.geoEvents = geoF.error;
const fu = loadFollowups(); if (fu.error) failed.eventFollowups = fu.error; // 事件跟进: display only
// 情景推演（持仓）: compact tables for open simulated positions (display only; online only — needs live bars)
const scenarioLines: string[] = [];
if (!values.offline) for (const e of (pj0.entries ?? []).filter((x: { mode?: string; closedAt?: string; source?: string }) => x.mode === "paper" && !x.closedAt && x.source !== "real_practice")) {
  try { const bars = await yahooDaily(e.symbol, 400), spot = bars.at(-1)?.c; if (spot == null) continue;
    const rq = existsSync("data/in/rh-option-quotes.json") ? JSON.parse(readFileSync("data/in/rh-option-quotes.json", "utf8")).quotes ?? [] : [];
    const inp = entryInput(e, { spot, asOf: now.toISOString(), bars: bars as never, quotes: rq, mentor: loadLevels().entries, capUsd: entryCapUsd(e, pj0.capital ?? defaultCapital()) });
    if (inp) { const r = runScenarios(inp); scenarioLines.push(...renderScenarioTable(r, "情景推演"), `- 对冲建议：${suggestHedge(inp, r).text}`, ""); } }
  catch (err) { failed[`scenario ${e.id}`] = (err as Error).message; }
}
// 利率/油价/美元 联动 (display only): 2Y FRED, 10Y ^TNX, 30Y ^TYX, DXY from PM_SERIES; regime oil = front (next contract on/after expiry day)
const rOil = regimeOilContract(etDate(now)); let rOilData: Obs[] = [];
if (!values.offline) try { rOilData = (await fetchDailyOnce({ id: "WTI_REGIME", provider: "yahoo", ref: rOil.yahoo, label: rOil.code, unit: "price", frequency: "daily" })).filter((o) => o.t >= since); } catch (e) { failed[`rates oil ${rOil.code}`] = (e as Error).message; }
const rLines = ratesLines({ y2: data.UST2Y, y10: data.UST10Y?.length ? data.UST10Y : data.UST10Y_FRED, y30: data.UST30Y?.length ? data.UST30Y : data.UST30Y_FRED, dxy: data.DXY, oil: rOilData.length ? rOilData : dcData.WTI_FRONT, oilCode: rOilData.length ? rOil.code : front.code, manual: loadManual() });
const res = buildBrief({ ratesLines: rLines, followupLines: followupLines(fu.followups, loadFollowupInputs(), now), geo: { reminder: geoReminderLines(geoF.events, now), calendar: geoCalendarLines(geoF.events, now) }, mentor, liquidityLines, sleepLines: sleep.lines, now, macro, pm, sc, levelsMd, planLines: [...plan.lines, ...planIdLines, ...(scenarioLines.length ? ["", "#### 情景推演（持仓，只显示）", "", ...scenarioLines] : [])], matrixLines: renderMatrix(mx, sc.leader), deadCatLines: dc.lines, gexLines: gex.length ? renderGex(gex) : undefined, calendar, failed });
// 4) alarms into the 30-min alert flow (deduped by guid/url)
if (!values["no-alarms"]) {
  if (pm.alarms.length) store.insert(alarmItems(pm.alarms, now), { stance: "center", tier: 1 }, now);
  if (sc.changed) store.insert(scenarioAlarmItems(sc, previousLeader, now), { stance: "center", tier: 1 }, now);
}
store.close();
const write = (p: string, body: string) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p + ".tmp", body); renameSync(p + ".tmp", p); };
write(values.out, res.md);
write(values.out.replace(/\.md$/, ".json"), JSON.stringify({ generatedAt: now.toISOString(), verdict: res.verdict, reasons: res.reasons, leader: sc.leader, previousLeader, scenarioChanged: sc.changed, plan: plan.qualified.map((c) => ({ ...c, id: planId(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), c) })), gex: gex.map((g) => (g.ok ? { symbol: g.symbol, net: Math.round(g.net), flip: g.flip, callWall: g.callWall, putWall: g.putWall, maxPain: g.maxPain, asOfUtc: g.asOfUtc } : { symbol: g.symbol, error: g.error })), matrix: { best: mx.best.map((b) => b.id), matches: mx.matches, unknown: mx.unknown }, alarms: pm.alarms, liquidity: liq ? { status: liq.status, label: liq.label, alerts: liq.alerts, asOf: liq.now.date } : null, sleep: sleepJson(sleep), todayReleases, deadCat: { ...deadCatJson(dc, { ...data, ...dcData }), mentorLevels: levelsJson(mlv) }, oilVix: { fast: pm.oilVix.fast, driver: pm.oilVix.driver, vix: pm.oilVix.vix.label }, failed }, null, 2) + "\n");
write("data/out/macro-latest.json", JSON.stringify(macro, null, 2) + "\n");
write(scPath, JSON.stringify({ generatedAt: now.toISOString(), leader: sc.leader, previousLeader, changed: sc.changed }, null, 2) + "\n");
process.stdout.write(res.md + "\n");
console.error(`[brief] ${res.verdict} · leader ${sc.leader ?? "none"}${sc.changed ? ` (was ${previousLeader})` : ""} · ${pm.alarms.length} alarm(s) · ${fetchCount()} daily series fetched once · ${Object.keys(failed).length} failed → ${values.out}`);
