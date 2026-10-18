import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { sleepDay, sleepLine, renderSleep, Q, NO_SLEEP_Q, SLEEP_Q, SLEEP_FILE, TRUMP_SCHEDULED_RE, type SleepInput } from "../src/macro/sleepday.ts";
import { NYSE_HOLIDAYS, NYSE_EARLY_CLOSE, isTradingDay, nextTradingDay, prevTradingDay, thanksgiving } from "../src/macro/nyse.ts";
import { opexDate, opexEvents, opexWeek, thirdFriday } from "../src/macro/opex.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief, briefVerdict } from "../src/macro/brief.ts";

const root = new URL("../", import.meta.url);
const POST = "不能睡觉的日子:\n\n每个月的OpEx\n美联储讲话\n老川准备拉屎的时候\n\n可以睡觉的日子：\n\n周一\n美国大部分暑假\n美国圣诞节到新年\n美国感恩节前后几天\n美国长周末公众假期前一天\n";
test("archive: mentor post stored verbatim (exact text + sha256 in manifest); every quoted line is a line of the file", () => {
  const b = readFileSync(new URL(SLEEP_FILE, root));
  assert.equal(b.toString("utf8"), POST);
  const m = JSON.parse(readFileSync(new URL("knowledge/mentor/premarket-routine/manifest.json", root), "utf8"));
  const f = m.files.find((x: { file: string }) => SLEEP_FILE.endsWith(x.file));
  assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256); assert.equal(b.length, f.bytes);
  const lines = POST.split("\n");
  for (const q of [...NO_SLEEP_Q, ...SLEEP_Q]) assert.ok(lines.includes(q), q);
  assert.equal(new Set(Object.values(Q)).size, 8);
});

test("NYSE calendar (nyse.com list): holidays, early closes, Thanksgiving, trading-day stepping", () => {
  for (const y of ["2026", "2027"]) assert.equal(Object.keys(NYSE_HOLIDAYS).filter((d) => d.startsWith(y)).length, 10);
  assert.equal(Object.keys(NYSE_HOLIDAYS).filter((d) => d.startsWith("2028")).length, 9, "no New Year's Day holiday in 2028");
  for (const y of [2026, 2027, 2028]) assert.ok(NYSE_HOLIDAYS[thanksgiving(y)]?.includes("Thanksgiving"));
  assert.ok(NYSE_EARLY_CLOSE["2026-11-27"] && NYSE_EARLY_CLOSE["2026-12-24"] && NYSE_EARLY_CLOSE["2027-11-26"]);
  assert.equal(isTradingDay("2026-07-03"), false); assert.equal(isTradingDay("2026-10-19"), true); assert.equal(isTradingDay("2026-10-18"), false);
  assert.equal(nextTradingDay("2026-12-24"), "2026-12-28"); assert.equal(prevTradingDay("2026-01-20"), "2026-01-16");
});
test("OpEx: holiday 3rd Friday → previous trading day; OpEx week; quad witching months", () => {
  assert.equal(thirdFriday(2026, 5), "2026-06-19"); assert.equal(opexDate(2026, 5), "2026-06-18");
  assert.equal(opexDate(2027, 5), "2027-06-17"); assert.equal(opexDate(2026, 10), "2026-11-20");
  assert.equal(opexEvents(2026).find((e) => e.date.startsWith("2026-06"))!.date, "2026-06-18");
  assert.deepEqual(opexWeek("2026-11-16"), { opex: "2026-11-20", quad: false, monday: "2026-11-16" });
  assert.equal(opexWeek("2026-11-23"), null); assert.equal(opexWeek("2026-12-14")!.quad, true);
});

const EV = [{ dateET: "2026-10-28", series: "FOMC", title: "FOMC 利率决议", timeET: "14:00" }, { dateET: "2026-11-10", series: "CPI", title: "CPI", timeET: "08:30" }, { dateET: "2026-11-06", series: "NFP", title: "NFP", timeET: "08:30" }];
const BO = [{ meetingStart: "2026-10-27", meetingEnd: "2026-10-28", from: "2026-10-17", to: "2026-10-29" }];
const speech = (date: string, speaker = "Christopher J. Waller") => ({ date, timeEt: "10:00", kind: "speech" as const, speaker, role: "Governor", voter: true, topic: "Outlook", location: "", source: "x", sourceKind: "board" as const });
const now = new Date("2026-10-19T11:30:00Z"); // Mon 07:30 ET
const base = (o: Partial<SleepInput> = {}): Omit<SleepInput, "date"> => ({ now, events: EV, fed: { speeches: [], blackouts: BO, coverTo: "2026-12-31", status: "缓存" }, trump: { posts: [], scheduled: [], status: "0 条" }, ...o });
const at = (date: string, o: Partial<SleepInput> = {}) => sleepDay({ ...base(o), date });

test("labels: Monday 可以睡; OpEx 不能睡; quad witching 加强; OpEx week only flagged; FOMC; CPI/NFP (用户补充)", () => {
  const mon = at("2026-10-19"); assert.equal(mon.label, "sleep"); assert.match(sleepLine(mon, "今日"), /😴 可以睡\*\* — 周一（导师：「周一」）/);
  assert.ok(mon.notes.some((n) => /FOMC 静默期/.test(n)));
  const ox = at("2026-11-20"); assert.equal(ox.label, "no_sleep"); assert.equal(ox.strong, false); assert.match(sleepLine(ox, "今日"), /🚨 不能睡\*\* — 月度 OpEx.*「每个月的OpEx」/);
  const quad = at("2026-12-18"); assert.equal(quad.strong, true); assert.match(sleepLine(quad, "今日"), /🚨🚨 不能睡（加强）.*四巫日/);
  const wk = at("2026-11-16"); assert.equal(wk.label, "sleep"); assert.match(sleepLine(wk, "今日"), /⚠️ 本周是 OpEx 周（11\/20 周五到期）/);
  assert.equal(at("2026-11-18").label, "normal"); assert.match(sleepLine(at("2026-11-18"), "今日"), /普通\*\* — 没有触发导师清单 · ⚠️ 本周是 OpEx 周/);
  assert.match(sleepLine(at("2026-10-28"), "x"), /FOMC 利率决议 14:00 ET \+ 主席记者会 14:30 ET（导师：「美联储讲话」）/);
  assert.ok(!at("2026-10-28").notes.some((n) => /静默期/.test(n)), "no blackout note on the meeting day");
  assert.match(sleepLine(at("2026-11-10"), "x"), /CPI 08:30 ET（用户补充）/); assert.match(sleepLine(at("2026-11-06"), "x"), /非农 NFP 08:30 ET（用户补充）/);
  assert.match(sleepLine(at("2026-06-18"), "x"), /提前一天/);
});
test("labels: Thanksgiving week, Christmas–New Year + long-weekend eve + early close, summer, closed day", () => {
  const w = at("2026-11-25"); assert.equal(w.label, "sleep"); assert.match(sleepLine(w, "x"), /感恩节当周.*11\/27 黑色星期五半天.*「美国感恩节前后几天」/);
  assert.equal(at("2026-11-23").label, "sleep"); assert.ok(at("2026-11-27").notes.some((n) => /13:00 收盘/.test(n)));
  const xm = at("2026-12-24"); assert.deepEqual(xm.sleep.map((r) => r.quote), [Q.xmas, Q.longWeekend]); assert.ok(xm.notes.some((n) => /平安夜 13:00/.test(n)));
  assert.match(sleepLine(at("2026-09-04"), "x"), /长周末前一天（9\/7 劳动节 休市，9\/5–9\/7 连休）/);
  assert.match(sleepLine(at("2026-07-02"), "x"), /7–8 月.*7\/3 独立日（补休） 休市/);
  assert.equal(at("2026-11-24").sleep.length, 1, "Tue of Thanksgiving week: not a long-weekend eve");
  const c = at("2026-11-26"); assert.equal(c.label, "closed"); assert.match(sleepLine(c, "x"), /休市/); assert.match(c.notes[0]!, /感恩节/);
  assert.ok(at("2029-03-07").notes.some((n) => /只覆盖 2026–2028/.test(n)));
});
test("conflict: 不能睡 wins and both reasons are shown (Monday + Fed speech; OpEx on a long-weekend eve)", () => {
  const s = at("2026-11-02", { fed: { speeches: [speech("2026-11-02")], blackouts: BO, coverTo: "2026-12-31", status: "缓存" } });
  assert.equal(s.label, "no_sleep");
  assert.match(sleepLine(s, "今日"), /🚨 不能睡\*\* — 联储官员讲话：Governor Christopher J. Waller 10:00 ET（导师：「美联储讲话」） · 可以睡的理由也成立，但不能睡优先：周一（导师：「周一」）/);
  assert.match(sleepLine(at("2027-01-15"), "x"), /月度 OpEx.*不能睡优先：长周末前一天/);
});
test("Fed speakers: missing data / outside coverage → said, never guessed (FOMC days still flagged)", () => {
  const none = at("2026-10-28", { fed: null }); assert.equal(none.label, "no_sleep"); assert.ok(none.notes.some((n) => /讲话数据不可用/.test(n)));
  const out = at("2026-11-03", { fed: { speeches: [speech("2026-11-03")], blackouts: [], coverTo: "2026-10-31", status: "缓存" } });
  assert.equal(out.label, "normal"); assert.ok(out.notes.some((n) => /只覆盖到 2026-10-31/.test(n)));
});
test("Trump: post ≥ 70 within 24h or a scheduled-announcement headline → 不能睡; old / low-score posts and future days → not", () => {
  const post = (h: number, score: number) => ({ at: new Date(now.getTime() - h * 3600_000).toISOString(), score, topics: ["关税/贸易"] });
  const t = (posts: ReturnType<typeof post>[], scheduled: Array<{ at: string; headline: string }> = []) => ({ trump: { posts, scheduled, status: "s" } });
  const hit = at("2026-10-19", t([post(3, 85)])); assert.equal(hit.label, "no_sleep");
  assert.match(sleepLine(hit, "今日"), /川普 24h 内发了 1 条市场相关帖（最高 85 分：关税\/贸易）（导师：「老川准备拉屎的时候」）.*不能睡优先：周一/);
  assert.equal(at("2026-10-19", t([post(30, 90), post(2, 60)])).label, "sleep");
  assert.equal(at("2026-10-20", t([post(3, 85)])).label, "no_sleep", "next trading day too");
  assert.equal(at("2026-11-04", t([post(3, 85)])).noSleep.length, 0); assert.ok(at("2026-11-04").notes.some((n) => /无法预知/.test(n)));
  assert.ok(at("2026-10-19", { trump: null }).notes.some((n) => /川普信号不可用/.test(n)));
  assert.equal(at("2026-10-19", t([], [{ at: now.toISOString(), headline: "Trump to announce new China tariffs on Tuesday" }])).label, "no_sleep");
  for (const h of ["Trump to announce new China tariffs", "Trump is expected to sign executive order", "特朗普将宣布新关税"]) assert.ok(TRUMP_SCHEDULED_RE.test(h), h);
  for (const h of ["Trump announced tariffs yesterday", "Markets fall after Trump post"]) assert.ok(!TRUMP_SCHEDULED_RE.test(h), h);
});
test("render: premarket shows today only; afternoon (≥12:00 ET) and closed days add the next trading day; brief §1 section, verdict unchanged", () => {
  assert.equal(renderSleep(base()).next, null);
  const pmRun = renderSleep(base({ now: new Date("2026-11-25T19:00:00Z") })); assert.equal(pmRun.next!.date, "2026-11-27");
  const sun = renderSleep(base({ now: new Date("2026-10-18T22:52:00Z") })); assert.equal(sun.today.label, "closed"); assert.equal(sun.next!.date, "2026-10-19");
  const md = sun.lines.join("\n");
  assert.match(md, /^### 今日能不能睡（导师清单 · 只标记，不改变结论）/); assert.match(md, /\*\*今日（2026-10-18 周日）：休市\*\*/); assert.match(md, /\*\*下一个交易日（2026-10-19 周一）：😴 可以睡\*\*/);
  assert.ok(md.includes(`](${SLEEP_FILE})`)); for (const q of [...NO_SLEEP_Q, ...SLEEP_Q]) assert.ok(md.includes(`「${q}」`));
  const n = new Date("2026-11-20T12:00:00Z");
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], n), pm = buildPremarket({ now: n, data: {}, calendar: [], earnings: null, headlines: [], regimeLabel: macro.regime.label }), sc = buildScenarios({ now: n, data: {}, calendar: [] });
  const lines = renderSleep(base({ now: n })).lines, with_ = buildBrief({ now: n, macro, pm, sc, calendar: [], sleepLines: lines }), without = buildBrief({ now: n, macro, pm, sc, calendar: [] });
  assert.equal(with_.verdict, without.verdict); assert.deepEqual(with_.reasons, briefVerdict({ macro, pm, sc }).reasons);
  assert.ok(with_.md.indexOf("今日能不能睡") > with_.md.indexOf("## 1. 结论") && with_.md.indexOf("今日能不能睡") < with_.md.indexOf("## 2. 警报"));
  assert.match(with_.md, /🚨 不能睡\*\* — 月度 OpEx/); assert.doesNotMatch(without.md, /今日能不能睡/);
});
