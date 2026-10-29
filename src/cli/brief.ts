/**
 * npm run brief [-- --out data/out/brief-latest.md] [--offline] [--no-alarms]
 * ONE Chinese daily brief (macro + premarket + scenarios + levels + calendar + self-check), ONE verdict.
 * Each series is fetched once (fetchDailyOnce). Also writes data/out/macro-latest.json (digest) and scenarios-latest.json (leader state).
 */
import { newRiskOpened } from "../options/riskCap.ts";
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
import { loadEarningsWeeks, renderEarningsWeek } from "../macro/earningsWeek.ts";
import { fetchLiquidity, liquidityWatch, renderLiquidity } from "../macro/liquidity.ts";
import { renderSleep, sleepJson, TRUMP_SCHEDULED_RE, TRUMP_MIN_SCORE } from "../macro/sleepday.ts";
import { addDays, etDate } from "../macro/nyse.ts";
import { trumpSignal } from "../trump.ts";
import { DEADCAT_SERIES, renderDeadCat, deadCatJson } from "../macro/deadcat.ts";
import { loadLevels, activeEntry, levelSeries, renderMentorLevels, rollAffectedLevels, checklistItems, levelsJson } from "../macro/mentorLevels.ts";
import { wtiFront, frontContinuous } from "../macro/wtiFront.ts";
import { loadGeoEvents, geoReminderLines, geoCalendarLines } from "../macro/geoEvents.ts";
import { loadFollowups, loadFollowupInputs, followupLines } from "../macro/eventFollowup.ts";
import { ratesLines, regimeOilContract, loadManual } from "../macro/ratesRegime.ts";
import { paperEquity } from "../options/confidence.ts";
import { yahooDaily } from "../adapters/yahoo.ts";
import { runScenarios, suggestHedge, renderScenarioTable } from "../options/scenarioEngine.ts";
import { entryInput } from "../options/scenarioCtx.ts";
import { entryCapUsd } from "../options/confidence.ts";
import { mentorSignals, renderMentorSignals, mentorSignalsJson, liveFirst } from "../macro/mentorSignals.ts";
import { yahooQuote, yahooFutQuote } from "../adapters/yahoo.ts";
import { OFFLINE_OIL_NOTE, type OilId } from "../macro/oilContract.ts";
import { frontLevel, futSameChange, futNote, contractSeries, mergeFrontState, isFutures, parseContract, OFFLINE_FUT_NOTE, type FrontState, type SameContract } from "../macro/futContract.ts";
import { briefArchivePath } from "../macro/briefArchive.ts";
import { paperGate, renderGate } from "../macro/paperGate.ts";

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
// 原油同合约涨跌 (src/macro/oilContract.ts): front contract = underlyingSymbol of BZ=F / CL=F; 1d = that contract's price ÷ ITS
// previous close. Never the continuous daily bars (they splice contracts on roll days → fake OIL_CRASH). Brief + alarms both use it.
// 期货同合约涨跌 (src/macro/futContract.ts; docs/FUTURES_SAME_CONTRACT.md): for EVERY Yahoo =F series in the brief (premarket,
// dead-cat, mentor levels) the front contract = underlyingSymbol of the continuous quote; 1d = that contract's price ÷ ITS previous
// close. Never the continuous daily bars (they splice contracts on roll days → fake moves / alarms). Oil (WTI/BRENT) is one client.
const futStatePath = "data/out/futures-front.json", legacyOilState = "data/out/oil-front.json";
const readJson = (f: string) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) as FrontState : null; } catch { return null; } };
const firstFutRun = !values.offline && !existsSync(futStatePath); // first run after the same-contract merge
let futState: FrontState = mergeFrontState(readJson(futStatePath), readJson(legacyOilState));
type FutSrc = { id: string; cont: string; get: () => Obs[] | undefined; set: (o: Obs[]) => void };
const futSrcs: FutSrc[] = [
  ...PM_SERIES.filter((d) => d.provider === "yahoo" && isFutures(d.ref)).map((d) => ({ id: d.id, cont: d.ref, get: () => data[d.id], set: (o: Obs[]) => { data[d.id] = o; } })),
  ...DEADCAT_SERIES.filter((d) => d.provider === "yahoo" && isFutures(d.ref)).map((d) => ({ id: d.id, cont: d.ref, get: () => dcData[d.id], set: (o: Obs[]) => { dcData[d.id] = o; } })),
  ...(lvActive ? levelSeries(lvActive.entry) : []).filter((x) => isFutures(x.def.ref)).map((x) => ({ id: `ML_${x.key}`, cont: x.def.ref, get: () => lvData[x.key], set: (o: Obs[]) => { lvData[x.key] = o; } })),
];
const futSame: Record<string, SameContract | null> = {}, futBars: Record<string, Obs[] | undefined> = {}, futNotes: Record<string, string> = {};
const futQuote = (sym: string) => yahooFutQuote(sym).catch((e) => { failed[`fut quote ${sym}`] = (e as Error).message; return null; });
if (!values.offline) {
  const today = etDate(now), conts = [...new Set(futSrcs.map((f) => f.cont))];
  const cq = Object.fromEntries(await Promise.all(conts.map(async (c) => [c, await futQuote(c)] as const)));
  const kq = Object.fromEntries(await Promise.all(conts.map(async (c) => { const u = cq[c]?.underlyingSymbol; return [c, parseContract(u) ? await futQuote(u!) : null] as const; })));
  for (const f of futSrcs) {
    const r = futSameChange(f.id, f.cont, cq[f.cont] ?? null, kq[f.cont] ?? null, { today, state: futState });
    futState = r.state; futSame[f.id] = r.sc;
    const prevBar = f.get()?.filter((o) => o.t.slice(0, 10) < today).at(-1)?.v ?? null;
    futNotes[f.id] = r.sc ? futNote(f.cont, r.sc, prevBar) : r.note;
  }
  await Promise.all([...new Set(futSrcs.map((f) => futSame[f.id]?.contract).filter((c): c is string => !!c))].map(async (c) => {
    try { const bars = (await fetchDailyOnce({ id: `${c}_CONTRACT`, provider: "yahoo", ref: c, label: c, unit: "price", frequency: "daily" })).filter((o) => o.t >= since400);
      for (const f of futSrcs) if (futSame[f.id]?.contract === c) futBars[f.id] = bars; } catch (e) { failed[`fut bars ${c}`] = (e as Error).message; } }));
}
const oilSame: Partial<Record<OilId, SameContract | null>> = {}, oilNotes: string[] = [], oilBars: Partial<Record<OilId, Obs[]>> = {};
if (!values.offline) for (const id of ["WTI", "BRENT"] as const) { oilSame[id] = futSame[id] ?? null; oilBars[id] = futBars[id]; if (futNotes[id]) oilNotes.push(futNotes[id]!.replace(/^(CL|BZ)=F = /, id === "WTI" ? "WTI = " : "Brent = ")); }
// History must be the SAME contract as the 1d change: WTI's own bars, or the calendar front only when it is that same contract.
// Missing → null → premarket shows 5日 / 均线 / 52周 n/a and fires no 5d alarm (never the spliced CL=F / BZ=F bars).
// Offline: no quotes → legacy continuous method (labelled OFFLINE_OIL_NOTE).
const sameBars = (id: OilId, alt?: { code: string; bars?: Obs[] }) => { const sc = oilSame[id]; if (!sc) return null;
  const bars = oilBars[id]?.length ? oilBars[id] : alt && alt.code === sc.code ? alt.bars : undefined;
  const fs = bars?.length ? frontContinuous(data[id], bars, sc.code) : null; return fs?.junction != null ? fs : null; };
const oilFront = values.offline ? (dcData.WTI_FRONT?.length ? frontContinuous(data.WTI, dcData.WTI_FRONT, front.code) : null) : sameBars("WTI", { code: front.code, bars: dcData.WTI_FRONT });
const brentFront = values.offline ? null : sameBars("BRENT");
if (values.offline) oilNotes.push(OFFLINE_OIL_NOTE);
for (const [id, fs] of [["WTI", oilFront], ["BRENT", brentFront]] as const) if (!values.offline && oilSame[id] && !fs) oilNotes.push(`${oilSame[id]!.code} 合约日线不可用 → 5日 / 50日均线 / 52周高点 n/a，不触发 5日警报（不用连续合约日线）`);
// every futures consumer (premarket ④ ES/NQ/RTY, gold, copper, RBOB, scenarios, matrix, dead-cat EWF, mentor levels, mentor signals) now
// reads the same-contract series; missing → price only / empty → n/a, no alarm. Offline: old continuous method, labelled.
const futRollLines: string[] = values.offline ? [OFFLINE_FUT_NOTE] : futSrcs.filter((f) => f.id !== "WTI" && f.id !== "BRENT" && (futSame[f.id]?.rolled || !futSame[f.id] || !futBars[f.id]?.length)).map((f) => futNotes[f.id] + (futSame[f.id] && !futBars[f.id]?.length ? `；${futSame[f.id]!.code} 合约日线不可用 → 5日等 n/a` : ""));
// DK rule: single-day = same contract; multi-day / MA / 52w = contract tail + back-adjusted continuous history (labelled 回溯调整)
const futAdj = new Set<string>(), futIncomplete = values.offline ? [] : [...new Set(futSrcs.filter((f) => !futSame[f.id]).map((f) => f.cont))];
if (!values.offline) for (const f of futSrcs) { const r = contractSeries(f.get(), futBars[f.id], futSame[f.id]); f.set(r.series); if (r.full) futAdj.add(f.id); }
// price-level thresholds (WTI 100/98 in mentor signals, dead-cat, mentor levels): current front's last price; roll day → new front wins
const wtiLvl = frontLevel(futSame.WTI, data.WTI, { code: front.code, series: dcData.WTI_FRONT }, data.WTI);
if (!values.offline && futSame.WTI && data.WTI?.length) dcData.WTI_FRONT = data.WTI; // mentor levels keep their own (entry-date) contract; rolls → n/a below
const earningsWeekLines = renderEarningsWeek(loadEarningsWeeks(new URL("../../knowledge/calendar/", import.meta.url)), now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
const pm = buildPremarket({ oilFront, brentFront, oilSame: values.offline ? undefined : oilSame, oilNotes, futNotes: futRollLines, fedLines, earningsWeekLines, now, data, failed, calendar, earnings, headlines: recent.slice(0, 6).map((r) => `${r.score} · ${r.headline}`), regimeLabel: macro.regime.label, volumeLines });
const scPath = "data/out/scenarios-latest.json";
const previousLeader: ScenarioId | null = existsSync(scPath) ? ((JSON.parse(readFileSync(scPath, "utf8")) as { leader?: ScenarioId | null }).leader ?? null) : null;
const sc = buildScenarios({ adjusted: futAdj, incomplete: futIncomplete, suppressChange: firstFutRun ? "首次同合约运行：期货历史按回溯调整比例整体移动，并非真实行情变化（只此一次）" : null, now, data, calendar, headlines: ranked.slice(0, 40).map((r) => r.headline), earningsCount: earnings?.length ?? null, regimeLabel: macro.regime.label, previousLeader });
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
// 导师框架信号 + 纸面交易闸门 (paper only; user-approved 2026-10-22)
// live-first inputs (Yahoo v8 chart meta regularMarketPrice): daily bars lag intraday; stale → labelled with timestamp
const q = async (sym: string) => (values.offline ? null : await yahooQuote(sym).catch((e) => { failed[`live ${sym}`] = (e as Error).message; return null; }));
// futures live quotes = the underlyingSymbol contract itself (same contract as the series); no contract → no live quote
const qFut = (id: string, fb?: string) => (futSame[id] ? q(futSame[id]!.contract) : fb && !values.offline ? q(fb) : Promise.resolve(null));
const [qNq, qWti, qVix, qGold] = await Promise.all([qFut("NQ"), qFut("WTI", front.yahoo), q("^VIX"), qFut("GOLD")]);
const sigBase = { ...lvData, ...dcData, ...data };
const lNq = liveFirst(sigBase.NQ, qNq, now), lWti = liveFirst(wtiLvl.series, wtiLvl.code ? qWti : null, now), lVix = liveFirst(sigBase.VIX, qVix, now), lGold = liveFirst(sigBase.GOLD, qGold, now);
const msig = mentorSignals({ ...sigBase, NQ: lNq.series, VIX: lVix.series, GOLD: lGold.series }, lWti.series.length ? { series: lWti.series, src: wtiLvl.code ? `WTI ${wtiLvl.src}` : "CL=F" } : null, { nq: lNq.stamp, wti: lWti.stamp, vix: lVix.stamp, gold: lGold.stamp });
const today0 = etDate(now);
const lossToday = -(pj0.entries ?? []).filter((e: { mode?: string; source?: string; closedAt?: string; pnl?: number }) => e.mode === "paper" && e.source !== "real_practice" && e.closedAt && e.pnl != null && etDate(new Date(e.closedAt)) === today0).reduce((s: number, e: { pnl?: number }) => s + (e.pnl ?? 0), 0);
const gate = paperGate({ now, verdict: v0, reasons: r0, leader: sc.leader, candidates: plan.candidates, levels: planRefs, data: { ...data, ...dcData, VIX: lVix.series, NQ: lNq.series }, signals: msig, equity: equity0, lossToday, newRiskToday: newRiskOpened((pj0.entries ?? []).filter((e: { mode?: string }) => e.mode === "paper"), today0).usd });
const mx = classifyMatrix(data, futAdj);
const lvRoll = lvActive && !values.offline ? rollAffectedLevels(lvActive.entry, futState, Object.fromEntries(Object.entries(futSame).map(([k, v]) => [k, !!v?.rolled])), futSame.WTI?.code) : {};
const mlv = renderMentorLevels(lv.entries, { ...data, ...lvData }, now, lv.error, lvRoll);
const dc = renderDeadCat({ ...data, ...dcData }, mx, checklistItems(mlv), mlv.lines);
// dealer gamma (GEX) from CBOE delayed quotes — config/gex.json or ALPHA_GEX_SYMBOLS; failures marked unavailable
const gexCfg = existsSync("config/gex.json") ? JSON.parse(readFileSync("config/gex.json", "utf8")) : { symbols: ["SPY", "QQQ", "NVDA", "SOXL"], days: 45 };
const gexSyms: string[] = (process.env.ALPHA_GEX_SYMBOLS?.split(",").map((x) => x.trim()).filter(Boolean)) ?? gexCfg.symbols;
const gex = values.offline || values["no-gex"] ? [] : await Promise.all(gexSyms.map((s) => fetchGex(s, gexCfg.days ?? 45)));
const gateItem = gate.card ? { ticker: gate.card.ticker, side: gate.card.side, structure: gate.card.structure, trigger: gate.card.trigger, entryZone: gate.card.entryZone, stop: gate.card.stop, invalidation: "§2.0 纸面交易闸门卡", size: `$${gate.card.riskUsd}`, confirm: { score: 0, of: 4, factors: [] }, qualifies: true, why: "paper gate" } : null;
const planOut = [...plan.qualified, ...(gateItem && !plan.qualified.some((c) => c.ticker === gateItem.ticker && c.side === gateItem.side) ? [gateItem] : [])];
const gateIdLine = gateItem ? [`- 闸门卡 plan-id：\`${planId(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), gateItem)}\`（\`npm run paper -- open --plan-id …\` 默认记为正式单，计入 30 笔）`, ""] : [];
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
const res = buildBrief({ mentorSignalLines: renderMentorSignals(msig), gateLines: [...renderGate(gate), ...gateIdLine], ratesLines: rLines, followupLines: followupLines(fu.followups, loadFollowupInputs(), now), geo: { reminder: geoReminderLines(geoF.events, now), calendar: geoCalendarLines(geoF.events, now) }, mentor, liquidityLines, sleepLines: sleep.lines, now, macro, pm, sc, levelsMd, planLines: [...plan.lines, ...planIdLines, ...(scenarioLines.length ? ["", "#### 情景推演（持仓，只显示）", "", ...scenarioLines] : [])], matrixLines: renderMatrix(mx, sc.leader), deadCatLines: dc.lines, gexLines: gex.length ? renderGex(gex) : undefined, calendar, failed });
// 4) alarms into the 30-min alert flow (deduped by guid/url)
if (!values["no-alarms"]) {
  if (pm.alarms.length) store.insert(alarmItems(pm.alarms, now), { stance: "center", tier: 1 }, now);
  if (sc.changed) store.insert(scenarioAlarmItems(sc, previousLeader, now), { stance: "center", tier: 1 }, now);
}
store.close();
const write = (p: string, body: string) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p + ".tmp", body); renameSync(p + ".tmp", p); };
write(values.out, res.md);
// dated archive of the premarket (07:00–09:29 ET) / close (16:00–18:59 ET) brief; brief-latest.md is still the one to send
const archive = briefArchivePath(now, dirname(values.out)); if (archive) write(archive, res.md);
if (!values.offline) write(futStatePath, JSON.stringify(futState, null, 2) + "\n");
write(values.out.replace(/\.md$/, ".json"), JSON.stringify({ generatedAt: now.toISOString(), verdict: res.verdict, reasons: res.reasons, leader: sc.leader, previousLeader, scenarioChanged: sc.changed, plan: planOut.map((c) => ({ ...c, id: planId(now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }), c) })), gex: gex.map((g) => (g.ok ? { symbol: g.symbol, net: Math.round(g.net), flip: g.flip, callWall: g.callWall, putWall: g.putWall, maxPain: g.maxPain, asOfUtc: g.asOfUtc } : { symbol: g.symbol, error: g.error })), matrix: { best: mx.best.map((b) => b.id), matches: mx.matches, unknown: mx.unknown }, alarms: pm.alarms, futures: Object.fromEntries(Object.entries(futSame).map(([k, v]) => [k, v ? { contract: v.contract, pct1: v.pct1, rolled: v.rolled, label: v.label } : null])), liquidity: liq ? { status: liq.status, label: liq.label, alerts: liq.alerts, asOf: liq.now.date } : null, sleep: sleepJson(sleep), todayReleases, deadCat: { ...deadCatJson(dc, { ...data, ...dcData }), mentorLevels: levelsJson(mlv) }, paperGate: gate, mentorSignals: mentorSignalsJson(msig), oilVix: { fast: pm.oilVix.fast, driver: pm.oilVix.driver, vix: pm.oilVix.vix.label }, failed }, null, 2) + "\n");
write("data/out/macro-latest.json", JSON.stringify(macro, null, 2) + "\n");
write(scPath, JSON.stringify({ generatedAt: now.toISOString(), leader: sc.leader, previousLeader, changed: sc.changed }, null, 2) + "\n");
process.stdout.write(res.md + "\n");
console.error(`[brief] ${res.verdict} · paper gate ${gate.decision}${gate.card ? ` ${gate.card.ticker} ${gate.card.side} $${gate.card.riskUsd}` : ""} · leader ${sc.leader ?? "none"}${sc.changed ? ` (was ${previousLeader})` : ""} · ${pm.alarms.length} alarm(s) · ${fetchCount()} daily series fetched once · ${Object.keys(failed).length} failed → ${values.out}${archive ? ` + ${archive}` : ""}`);
