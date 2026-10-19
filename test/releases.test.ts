import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { parseCensusCalendar, claimsEvents, federalThursdayHolidays, isMinorRelease, censusCalendarUrl, DOL_CLAIMS_URL, type CalendarEvent } from "../src/ingest/officialCalendar.ts";
import { upcomingHighImpact } from "../src/macro/risk.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief, briefVerdict } from "../src/macro/brief.ts";
import { sleepDay } from "../src/macro/sleepday.ts";
import { loadMajorEvents, TRACKED_EVENTS } from "../src/options/majorEvents.ts";
import { buildCard, type CardInput, type Quote } from "../src/review/card.ts";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const CAL = (JSON.parse(readFileSync(new URL("../calendar/releases-2026.json", import.meta.url), "utf8")) as { events: CalendarEvent[]; sources: string[] });
const MINOR = CAL.events.filter(isMinorRelease), MAJOR = CAL.events.filter((e) => !isMinorRelease(e));

test("Census calendar (real 2026 page): housing starts incl. 2026-10-20 08:30, durables, trade — tier 2, deduped", () => {
  const ev = parseCensusCalendar(fx("census-calendar-2026.html"), censusCalendarUrl(2026));
  const h = ev.filter((e) => e.kind === "HOUSING");
  assert.equal(h.length, 12); assert.ok(h.every((e) => e.timeEt === "08:30" && e.tier === 2));
  assert.deepEqual(h.find((e) => e.date === "2026-10-20"), { kind: "HOUSING", title: "新屋开工/营建许可 Housing starts & building permits (Census)", date: "2026-10-20", timeEt: "08:30", source: censusCalendarUrl(2026), tier: 2 });
  assert.ok(ev.some((e) => e.kind === "DURABLES" && e.date === "2026-10-27")); assert.ok(ev.some((e) => e.kind === "TRADE" && e.date === "2026-11-04"));
  assert.ok(!ev.some((e) => /RETAIL|Sales/.test(e.kind)), "retail already comes from FRED");
});
test("claims: every Thursday 08:30 (inferred), Thanksgiving moved to Wednesday per DOL's official list; holiday Thursday without a listed date skipped", () => {
  const c = claimsEvents(2026);
  assert.ok(c.events.find((e) => e.date === "2026-10-22")!.inferred);
  assert.equal(c.events.find((e) => e.date === "2026-11-26"), undefined);
  const tg = c.events.find((e) => e.date === "2026-11-25")!; assert.equal(tg.inferred, undefined); assert.match(tg.title, /11-26 联邦假日，DOL 官方改到周三/);
  assert.deepEqual(c.skipped, ["2026-01-01（联邦假日，DOL 未列出替代日期 → 不登记）"]);
  assert.ok(c.events.every((e) => e.timeEt === "08:30" && e.tier === 2 && e.source === DOL_CLAIMS_URL));
  assert.equal(c.events.length, 52, "53 Thursdays in 2026 minus New Year's Day");
  const c27 = claimsEvents(2027).events.map((e) => e.date);
  for (const d of ["2027-11-10", "2027-11-24"]) assert.ok(c27.includes(d), d); for (const d of ["2027-11-11", "2027-11-25"]) assert.ok(!c27.includes(d), d);
  assert.deepEqual(federalThursdayHolidays(2026), ["2026-01-01", "2026-11-26"]);
});
test("committed releases-2026.json: tier-2 dates added with official sources; major kinds untouched", () => {
  const has = (k: string, d: string) => CAL.events.some((e) => e.kind === k && e.date === d && e.timeEt === "08:30" && e.tier === 2);
  assert.ok(has("HOUSING", "2026-10-20")); assert.ok(has("CLAIMS", "2026-10-22")); assert.ok(has("CLAIMS", "2026-11-25")); assert.ok(!has("CLAIMS", "2026-11-26"));
  const n = (k: string) => MAJOR.filter((e) => e.kind === k).length;
  assert.deepEqual({ FOMC: n("FOMC"), CPI: n("CPI"), NFP: n("NFP"), PPI: n("PPI"), PCE: n("PCE"), GDP: n("GDP"), RETAIL: n("RETAIL"), JOLTS: n("JOLTS") }, { FOMC: 8, CPI: 12, NFP: 12, PPI: 13, PCE: 13, GDP: 13, RETAIL: 14, JOLTS: 12 });
  assert.ok(MAJOR.every((e) => e.tier === undefined));
  assert.ok(CAL.sources.includes(censusCalendarUrl(2026)) && CAL.sources.includes(DOL_CLAIMS_URL));
});

const parts = (now: Date, calendar: CalendarEvent[]) => {
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], calendar, now);
  return { macro, pm: buildPremarket({ now, data: {}, calendar, earnings: null, headlines: [] }), sc: buildScenarios({ now, data: {}, calendar }) };
};
test("7:30 brief lists today's 8:30 tier-2 prints (今天 8:30：…), marked 次要", () => {
  const tue = new Date("2026-10-20T11:30:00Z"), p = parts(tue, CAL.events);
  const md = buildBrief({ now: tue, ...p, calendar: CAL.events }).md;
  assert.match(md, /- \*\*今天 8:30：新屋开工\/营建许可 Housing starts & building permits \(Census\)\*\*（次要）/);
  assert.match(p.pm.dkLines.join("\n"), /- 08:30 新屋开工\/营建许可.*（次要） \*\*（盘前）\*\*/);
  const thu = new Date("2026-10-22T11:30:00Z");
  assert.match(buildBrief({ now: thu, ...parts(thu, CAL.events), calendar: CAL.events }).md, /- \*\*今天 8:30：初请失业金 Initial jobless claims \(DOL\)\*\*（次要）/);
  const wed = new Date("2026-11-25T12:30:00Z");
  assert.match(buildBrief({ now: wed, ...parts(wed, CAL.events), calendar: CAL.events }).md, /今天 8:30：初请失业金.*官方改到周三/);
});
test("tier-2 releases never trigger the 48h high-impact window, premarket NO_TRADE, verdict, 72h rule or 不能睡", () => {
  for (const iso of ["2026-10-20T11:30:00Z", "2026-10-21T13:00:00Z", "2026-10-22T11:30:00Z", "2026-11-24T13:00:00Z"]) {
    const now = new Date(iso);
    assert.deepEqual(upcomingHighImpact(MINOR, now), []);
    const a = parts(now, MAJOR), b = parts(now, CAL.events);
    assert.deepEqual(b.macro.risk, a.macro.risk, iso); assert.deepEqual(b.pm.noTrade, a.pm.noTrade, iso); assert.deepEqual(b.pm.alarms, a.pm.alarms, iso);
    assert.deepEqual(briefVerdict(b), briefVerdict(a), iso);
  }
  // major events keep their existing behaviour: CPI 2026-11-10 08:30 still trips the 48h window and premarket rule
  const cpiEve = new Date("2026-11-09T14:00:00Z");
  assert.ok(upcomingHighImpact(CAL.events, cpiEve).some((e) => e.kind === "CPI"));
  assert.ok(parts(new Date("2026-11-10T11:30:00Z"), CAL.events).pm.noTrade.some((r) => /盘前重大数据 CPI 08:30/.test(r)));
  // 72h rule + sleep label read knowledge/calendar/major-events (FOMC/CPI/NFP only) — no tier-2 series there
  const me = JSON.parse(readFileSync(TRACKED_EVENTS, "utf8")).events as Array<{ series?: string }>;
  assert.ok(me.every((e) => ["FOMC", "CPI", "NFP"].includes(e.series ?? "")));
  assert.ok(loadMajorEvents().events.every((e) => !["CLAIMS", "HOUSING", "DURABLES", "TRADE"].includes(e.series ?? "")));
  const asSleep = CAL.events.map((e) => ({ dateET: e.date, series: e.kind, title: e.title, timeET: e.timeEt }));
  const sd = (d: string) => sleepDay({ date: d, now: new Date("2026-10-19T11:30:00Z"), events: asSleep, fed: null, trump: null });
  assert.equal(sd("2026-10-20").label, "normal"); assert.equal(sd("2026-10-22").label, "normal"); assert.equal(sd("2026-11-25").label, "sleep");
  assert.equal(sd("2026-11-10").label, "no_sleep", "CPI still 不能睡");
  // the 72h rule's events come only from loadMajorEvents (paper.ts psych ctx); the release calendar only reaches critique via upcomingHighImpact (tier-guarded)
  const paper = readFileSync(new URL("../src/cli/paper.ts", import.meta.url), "utf8");
  assert.match(paper, /const \{ events \} = loadMajorEvents\(\);/); assert.match(paper, /const psych = \{ earnings: loadEarningsBook\(\)\.rows, events,/);
  assert.match(readFileSync(new URL("../src/review/critique.ts", import.meta.url), "utf8"), /upcomingHighImpact\(i\.calendar \?\? \[\], i\.now\)/);
});
test("plan card: tier-2 prints before expiry are listed separately and don't turn §7 to warn", () => {
  const EXP = "2026-10-23", q = (strike: number, bid: number, ask: number): Quote => ({ type: "put", strike, expiration: EXP, bid, ask, src: "t" });
  const NOW = new Date("2026-10-19T14:00:00Z");
  const base = (calendar: CalendarEvent[]): CardInput => ({ now: NOW, sym: "XYZ", dir: "bear", exp: EXP, spot: 100, bars: [], levels: null, quotes: [q(100, 3, 3.2), q(98, 2, 2.2)],
    brief: { generatedAt: NOW.toISOString(), leader: null, verdict: "TRADE", plan: [] }, gex: null, calendar, earnings: [], journal: [], capital: 5000, thesis: "因为 X 所以 Y" });
  const s7 = (c: CalendarEvent[]) => buildCard(base(c)).sections.find((s) => s.n === 7)!;
  const none = s7([]), minor = s7(MINOR);
  assert.equal(minor.status, none.status);
  assert.match(minor.lines.join("\n"), /到期前次要数据（只列出，不算风险）：10-20 新屋开工\/营建许可；10-22 初请失业金/);
  assert.match(minor.lines.join("\n"), /到期前事件：无（官方日历）/);
  assert.equal(s7([{ kind: "CPI", title: "CPI", date: "2026-10-21", timeEt: "08:30", source: "x" }]).status, "warn", "major events still warn");
});
