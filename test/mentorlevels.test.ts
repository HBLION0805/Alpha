import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { parseLevels, loadLevels, activeEntry, levelSeries, levelState, renderMentorLevels, checklistItems, levelsJson, phaseOf, LEVELS_FILE, type LevelEntry } from "../src/macro/mentorLevels.ts";
import { wtiFront, clExpiry } from "../src/macro/wtiFront.ts";
import { deadCatChecklist, renderDeadCat } from "../src/macro/deadcat.ts";
import { mentorLevelCardLines } from "../src/review/mentor.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { buildBrief } from "../src/macro/brief.ts";
import type { Obs } from "../src/macro/fetch.ts";

const root = new URL("../", import.meta.url);
const DIR = "knowledge/mentor/market-calls/daily-2026-10-19/";
const HANDLE_SHA = "288f26ff083ffd9c57dd08a1d7828ea87d89ecf47c39bcaa8ba733b6b4ea7a8a";
const at = (et: string) => new Date(`${et}-04:00`); // ET wall clock (EDT)
const o = (...xs: Array<[string, number]>): Obs[] => xs.map(([t, v]) => ({ t, v }));
const { entries } = loadLevels();
const E = entries.find((e) => e.date === "2026-10-19")!;

test("archive: daily stored byte-for-byte (sha256 in manifest), no header, no author handle in any new text", () => {
  const m = JSON.parse(readFileSync(new URL(DIR + "manifest.json", root), "utf8")), f = m.files[0];
  const b = readFileSync(new URL(DIR + f.file, root)); assert.equal(b.length, f.bytes); assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256);
  const t = b.toString("utf8");
  assert.match(t, /^各位早上好，希望大家周末过得愉快。/); assert.match(t, /3\. NQ：30,000点 纳指期货必须收在30,000点以上，才能确认这波不是死猫反弹。\n$/);
  for (const p of [DIR + "article.md", DIR + "README.md", DIR + "manifest.json", LEVELS_FILE, "src/macro/mentorLevels.ts", "src/macro/wtiFront.ts", "docs/MENTOR_DEADCAT.md"]) {
    const c = [...readFileSync(new URL(p, root), "utf8")];
    for (let k = 0; k + 1 < c.length; k++) if (/\p{Script=Han}/u.test(c[k]!) && /\p{Script=Han}/u.test(c[k + 1]!)) assert.notEqual(createHash("sha256").update(c[k]! + c[k + 1]!).digest("hex"), HANDLE_SHA, p);
  }
});
test("levels.json: data-driven, validated; every quote verbatim in its source; a new dated entry needs no code", () => {
  assert.ok(E); assert.deepEqual(E.levels.map((l) => [l.id, l.series, l.level, l.rule]), [["crwv65", "CRWV", 65, "close_above"], ["wti100", "@WTI_FRONT", 100, "stay_below"], ["nq30000", "NQ=F", 30000, "close_above"]]);
  for (const e of entries) { const src = readFileSync(new URL(e.source, root), "utf8"); for (const l of e.levels) assert.ok(src.includes(l.quote), `${e.date} ${l.id}`); if (e.watch) assert.ok(src.includes(e.watch.quote)); }
  assert.throws(() => parseLevels({ entries: [{ date: "2026-10-20", source: "x", levels: [{ id: "a", series: "X", level: "?", rule: "close_above", quote: "q" }] }] }), /bad level/);
  assert.throws(() => parseLevels({}), /no entries/);
  const fut: LevelEntry = { date: "2026-10-22", source: "s", levels: [{ id: "spy700", label: "SPY 700", series: "SPY", level: 700, rule: "close_above", unit: "$", meaning: "m", quote: "q" }] };
  const r = renderMentorLevels(parseLevels({ entries: [...entries, fut] }), { SPY: o(["2026-10-21", 690], ["2026-10-22", 705]) }, at("2026-10-22T11:00"));
  assert.match(r.lines.join("\n"), /大佬今日价位（2026-10-22 日报）.*\n  - 🟢 SPY 700：\$705\.00，在上方 \+5\.00/);
  assert.deepEqual(levelSeries(E).map((x) => x.def.ref), ["CRWV", "CLX26.NYM", "NQ=F"]);
});
test("WTI front month = CNBC @CL.1 (Yahoo CL=F rolls early)", () => {
  assert.equal(clExpiry(2026, 11), "2026-10-20", "Nov-26: 25th is a Sunday → Fri 23rd − 3 business days");
  assert.equal(clExpiry(2026, 12), "2026-11-20");
  assert.equal(wtiFront("2026-10-19").code, "CLX26"); assert.equal(wtiFront("2026-10-20").code, "CLX26"); assert.equal(wtiFront("2026-10-21").yahoo, "CLZ26.NYM");
  assert.equal(wtiFront("2026-12-31").code, "CLG27");
});
test("level states: pre / intraday / closed / next-day recap; close_above vs stay_below; n/a without today's bar", () => {
  const crwv = E.levels[0]!, wti = E.levels[1]!, nq = E.levels[2]!;
  const C = o(["2026-10-16", 61.39], ["2026-10-19", 63.24]);
  assert.equal(phaseOf(at("2026-10-19T09:29")), "pre"); assert.equal(phaseOf(at("2026-10-19T11:00")), "intraday"); assert.equal(phaseOf(at("2026-10-19T16:05")), "closed");
  const i = levelState(crwv, C, "2026-10-19", "intraday", false);
  assert.equal(i.status, "warn"); assert.equal(i.above, false); assert.ok(Math.abs(i.dist! + 1.76) < 1e-9); assert.match(i.text, /\$63\.24，在下方 -1\.76（-2\.71%） — 目前在下方，收盘前必须站回 \$65\.00/);
  const c = levelState(crwv, C, "2026-10-19", "closed", false); assert.equal(c.status, "fail"); assert.equal(c.final, true); assert.match(c.text, /❌ 收盘失守 \$65\.00/);
  assert.equal(levelState(crwv, o(["2026-10-19", 65.1]), "2026-10-19", "closed", false).status, "ok");
  assert.match(levelState(crwv, o(["2026-10-19", 65.1]), "2026-10-19", "intraday", false).text, /目前守住，要看收盘/);
  assert.equal(levelState(wti, o(["2026-10-19", 100.7]), "2026-10-19", "intraday", false).status, "fail", "oil above 100 = danger");
  assert.equal(levelState(wti, o(["2026-10-19", 99.9]), "2026-10-19", "intraday", false).status, "ok");
  assert.equal(levelState(nq, o(["2026-10-19", 30010]), "2026-10-19", "closed", false).status, "ok");
  assert.equal(levelState(crwv, o(["2026-10-16", 61.39]), "2026-10-19", "intraday", false).status, "na", "stale bar intraday → n/a");
  assert.equal(levelState(crwv, undefined, "2026-10-19", "pre", false).status, "na");
  const rc = levelState(crwv, o(["2026-10-19", 66], ["2026-10-20", 60]), "2026-10-19", "pre", true); assert.equal(rc.value, 66, "recap uses the entry day's close"); assert.equal(rc.status, "ok");
  // active entry: today; next trading day recap; gone after that
  assert.equal(activeEntry(entries, at("2026-10-19T08:00"))!.recap, false);
  assert.equal(activeEntry(entries, at("2026-10-20T08:00"))!.recap, true);
  assert.equal(activeEntry(entries, at("2026-10-21T08:00")), null);
});
const LIVE = { CRWV: o(["2026-10-16", 61.39], ["2026-10-19", 63.24]), "@WTI_FRONT": o(["2026-10-16", 101.41], ["2026-10-19", 100.7]), "NQ=F": o(["2026-10-16", 29391.5], ["2026-10-19", 29810]),
  DXY: o(["2026-10-16", 101.84], ["2026-10-19", 101.93]), UST30Y: o(["2026-10-16", 5.437], ["2026-10-19", 5.466]) };
test("block: 3 levels + quotes + the DXY / oil / 30Y line; afternoon run reports the closes; recap next morning", () => {
  const r = renderMentorLevels(entries, LIVE, at("2026-10-19T11:00")), md = r.lines.join("\n");
  assert.match(md, /大佬今日价位（2026-10-19 日报）\*\* — 盘中（未收盘）/);
  assert.match(md, /🟡 CRWV 65：\$63\.24，在下方/); assert.match(md, /🔴 油价 100：\$100\.70，在上方 \+0\.70（\+0\.70%） — 🔴 站上 \$100\.00（近月 CLX26，2026-10-20 到期；= CNBC @CL\.1）/);
  assert.match(md, /🟡 NQ 30,000：29,810，在下方 -190（-0\.63%）/);
  assert.match(md, /看这三个找答案：DXY — \+0\.09% · 油价 ↓ -0\.70%（CLX26） · 30Y ↑ \+2\.9bp（1 日）/);
  assert.match(md, /「盯住 DXY、油价和30年期美债收益率，你就能看到答案。」/);
  assert.doesNotMatch(md, /下午场/);
  const pm = renderMentorLevels(entries, LIVE, at("2026-10-19T16:10")).lines.join("\n");
  assert.match(pm, /— 收盘结果/); assert.match(pm, /下午场：CRWV 65 ❌ 收在下方 · NQ 30,000 ❌ 收在下方/); assert.match(pm, /期货 17:00 ET 才结算/);
  const up = renderMentorLevels(entries, { ...LIVE, CRWV: o(["2026-10-19", 65.4]), "NQ=F": o(["2026-10-19", 30050]) }, at("2026-10-19T16:10")).lines.join("\n");
  assert.match(up, /下午场：CRWV 65 ✅ 收在上方 · NQ 30,000 ✅ 收在上方/);
  const rec = renderMentorLevels(entries, { ...LIVE, CRWV: o(["2026-10-19", 63.5], ["2026-10-20", 64]) }, at("2026-10-20T08:00")).lines.join("\n");
  assert.match(rec, /大佬价位回顾（2026-10-19 日报，按当天收盘）/); assert.match(rec, /回顾：CRWV 65 ❌ 收在下方/); assert.doesNotMatch(rec, /看这三个/);
  // recession combo: oil above 100 while 30Y falls
  assert.match(renderMentorLevels(entries, { ...LIVE, UST30Y: o(["2026-10-16", 5.5], ["2026-10-19", 5.4]) }, at("2026-10-19T11:00")).lines.join("\n"), /衰退信号组合/);
  assert.doesNotMatch(md, /衰退信号组合/);
  // no data / load error → n/a, no throw
  assert.ok(renderMentorLevels(entries, {}, at("2026-10-19T11:00")).states.every((s) => s.status === "na"));
  assert.match(renderMentorLevels([], {}, at("2026-10-19T11:00"), "levels.json missing").lines[0]!, /不可用（levels\.json missing）/);
  assert.deepEqual(renderMentorLevels([], {}, at("2026-10-19T11:00")).lines, []);
  assert.deepEqual(levelsJson(r)!.levels.map((x) => x.status), ["warn", "fail", "warn"]);
});
test("dead-cat checklist: CRWV 65 row added from levels; DK bottom count unchanged; WTI uses the front contract (roll note)", () => {
  const r = renderMentorLevels(entries, LIVE, at("2026-10-19T11:00")), extra = checklistItems(r);
  assert.deepEqual(extra.map((x) => [x.id, x.status]), [["crwv65", "neutral"]]);
  const d = { WTI: o(["2026-10-16", 101.41], ["2026-10-19", 97.69]), WTI_FRONT: LIVE["@WTI_FRONT"], NQ: LIVE["NQ=F"] };
  const dc = renderDeadCat(d, null, extra, r.lines), md = dc.lines.join("\n");
  assert.match(md, /🟡 CRWV 65（大佬 2026-10-19 日报）：\$63\.24，在下方 -1\.76（-2\.71%） — 目前在下方/);
  assert.match(md, /大佬今日价位/); assert.ok(md.indexOf("大佬今日价位") < md.indexOf("【大佬经济情景表】"));
  assert.equal(dc.check.bottom.length, 4); assert.equal(dc.check.items.length, 6);
  const w = deadCatChecklist(d).items.find((x) => x.id === "wti")!;
  assert.equal(w.status, "dead_cat", "front month 100.70 ≥ 100 (CL=F's rolled 97.69 would have read 🟢)"); assert.match(w.value, /100\.70（1日 -0\.70%；Yahoo CL=F 97\.69 已换到下月合约，不用）/);
  assert.equal(deadCatChecklist({ WTI: d.WTI }).items.find((x) => x.id === "wti")!.status, "bottom", "without the front series the old behaviour stays");
});
test("plan card: tech longs get the CRWV 65 quote (with the brief's state); others / bears / other days don't", async () => {
  const st = { date: "2026-10-19", levels: [{ id: "crwv65", value: 63.24, above: false, final: false }] };
  const L = mentorLevelCardLines("NVDA", "bull", "AI 反弹", E, st).join("\n");
  assert.match(L, /做多科技（NVDA）→ 大佬 2026-10-19 日报价位 \*\*CRWV 65\*\*/); assert.match(L, /（简报：CRWV 63\.24，在下方）/);
  assert.match(L, /原文：「这是确认科技股反弹的关键价位，今天收盘前必须守住，并确立为支撑。/);
  assert.match(mentorLevelCardLines("IWM", "bull", "半导体带动", E).join("\n"), /做多科技（半导体）/);
  assert.deepEqual(mentorLevelCardLines("XLP", "bull", "防御", E), []); assert.deepEqual(mentorLevelCardLines("NVDA", "bear", "AI", E), []); assert.deepEqual(mentorLevelCardLines("NVDA", "bull", "", null), []);
  assert.doesNotMatch(mentorLevelCardLines("NVDA", "bull", "", E, { ...st, date: "2026-10-16" }).join("\n"), /简报：/, "stale brief state not shown");
  const { buildCard } = await import("../src/review/card.ts");
  const EXP = "2026-10-23", NOW = at("2026-10-19T11:00"), q = (strike: number, bid: number, ask: number) => ({ type: "call" as const, strike, expiration: EXP, bid, ask, src: "t" });
  const mk = (ml: LevelEntry | null) => buildCard({ now: NOW, sym: "NVDA", dir: "bull", exp: EXP, spot: 100, bars: [], levels: null, quotes: [q(100, 3, 3.2), q(102, 2, 2.2)],
    brief: { generatedAt: NOW.toISOString(), leader: null, verdict: "NO_TRADE", plan: [] }, gex: null, calendar: [], earnings: [], journal: [], capital: 5000, thesis: "财报后突破", mentorLevels: ml });
  const a = mk(E), b = mk(null);
  assert.ok(a.macroTheme?.some((l) => /CRWV 65/.test(l))); assert.ok(!b.macroTheme?.some((l) => /CRWV 65/.test(l)));
  assert.equal(a.verdict, b.verdict); assert.deepEqual(a.failing, b.failing); assert.deepEqual(a.warnTags, b.warnTags); assert.deepEqual(a.trade, b.trade); assert.deepEqual(a.sections, b.sections);
});
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : []; });
test("display only: levels never reach the verdict / NO_TRADE / 48h·72h / alerts / 能不能睡", () => {
  const src = new URL("src", root).pathname, rel = (p: string) => p.slice(src.length + 1);
  const users = walk(src).filter((f) => rel(f) !== "macro/mentorLevels.ts" && /mentorLevels\.ts/.test(readFileSync(f, "utf8"))).map(rel).sort();
  assert.deepEqual(users, ["cli/brief.ts", "cli/card.ts", "cli/paper.ts", "options/scenarioCtx.ts", "review/card.ts", "review/mentor.ts"]);
  for (const f of ["review/card.ts", "review/mentor.ts"]) assert.match(readFileSync(`${src}/${f}`, "utf8"), /import type \{ LevelEntry \} from "\.\.\/macro\/mentorLevels\.ts";/, `${f}: type-only`);
  const code = readFileSync(`${src}/macro/mentorLevels.ts`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /alarm|noTrade|store\.insert|verdict\s*=|import .*(risk|brief|alerts|store|sleepday|psych)\.ts/i);
  for (const f of ["macro/risk.ts", "macro/sleepday.ts", "options/psych.ts", "macro/scenarios.ts", "alerts.ts"]) assert.doesNotMatch(readFileSync(`${src}/${f}`, "utf8"), /mentorLevels|levels\.json|deadcat/, f);
  const n = at("2026-10-19T11:00");
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], n), pm = buildPremarket({ now: n, data: {}, calendar: [], earnings: null, headlines: [], regimeLabel: macro.regime.label }), sc = buildScenarios({ now: n, data: {}, calendar: [] });
  const r = renderMentorLevels(entries, LIVE, n), dc = renderDeadCat({}, null, checklistItems(r), r.lines);
  const a = buildBrief({ now: n, macro, pm, sc, calendar: [], deadCatLines: dc.lines }), b = buildBrief({ now: n, macro, pm, sc, calendar: [] });
  assert.equal(a.verdict, b.verdict); assert.deepEqual(a.reasons, b.reasons); assert.equal(a.md.replace(dc.lines.join("\n") + "\n", ""), b.md);
});
