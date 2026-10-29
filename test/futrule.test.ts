/** DK rule for futures (PR #17) + Engineering Lead review: same-contract 1d, front-contract price levels, back-adjusted multi-day (labelled). No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { frontLevel, futSameChange, contractSeries } from "../src/macro/futContract.ts";
import { mentorSignals } from "../src/macro/mentorSignals.ts";
import { renderDeadCat } from "../src/macro/deadcat.ts";
import { classifyMatrix } from "../src/macro/matrix.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { renderMentorLevels, rollAffectedLevels, type LevelEntry } from "../src/macro/mentorLevels.ts";
import type { Obs } from "../src/macro/fetch.ts";

const days = (n: number, end: string) => { const out: string[] = []; let d = new Date(end + "T12:00:00Z");
  while (out.length < n) { if (d.getUTCDay() % 6) out.unshift(d.toISOString().slice(0, 10)); d = new Date(d.getTime() - 864e5); } return out; };
const D = days(40, "2026-11-19"), today = D.at(-1)!;
const ser = (f: (i: number) => number): Obs[] => D.map((t, i) => ({ t, v: f(i) }));
const brief = readFileSync(new URL("../src/cli/brief.ts", import.meta.url), "utf8");
// SYNTHETIC WTI roll day 2026-11-19: Yahoo already on CLF27 (backwardated −1.6) while the calendar front is still CLZ26.
const CLZ = ser(() => 100.6), CLF = ser((i) => (i === D.length - 1 ? 98.9 : 99.0));
const sc = futSameChange("WTI", "CL=F", { underlyingSymbol: "CLF27.NYM" }, { symbol: "CLF27.NYM", returnedSymbol: "CLF27.NYM", price: 98.9, prevClose: 99.0, at: `${today}T15:00:00Z` },
  { today, state: { WTI: { contract: "CLZ26", since: "2026-10-21", from: "CLX26" } } }).sc!;
const wtiSeries = contractSeries(CLZ, CLF, sc).series;

test("roll-day price threshold: WTI vs 100 uses the NEW front's last price (CLF27 98.90), not the calendar front (CLZ26 100.60)", () => {
  assert.equal(sc.rolled, true);
  const lvl = frontLevel(sc, wtiSeries, { code: "CLZ26", series: CLZ });
  assert.equal(lvl.code, "CLF27"); assert.equal(lvl.series.at(-1)!.v, 98.9);
  const m = mentorSignals({}, { series: lvl.series, src: `WTI ${lvl.src}` });
  assert.equal(m.wti!.above, false); assert.equal(m.wti!.last, 98.9); assert.match(m.wti!.src, /CLF27/);
  const old = mentorSignals({}, { series: CLZ, src: "WTI 近月 CLZ26" }); assert.equal(old.wti!.above, true, "calendar front would say ≥100");
  const dc = renderDeadCat({ WTI_FRONT: lvl.series }).lines.join("\n");
  assert.match(dc, /原油 WTI vs 100[^\n]*98\.90/); assert.doesNotMatch(dc, /重新涨破 100/);
  // no sc → calendar front (a specific contract); nothing → continuous fallback
  assert.equal(frontLevel(null, undefined, { code: "CLZ26", series: CLZ }).code, "CLZ26");
  assert.equal(frontLevel(null, undefined, { code: "CLZ26" }, CLF).src, "连续合约");
});

test("must-fix 1: WTI mentor signal = contract series + the same contract's live quote (no calendar-front mix)", () => {
  assert.match(brief, /const wtiLvl = frontLevel\(futSame\.WTI, data\.WTI, \{ code: front\.code, series: dcData\.WTI_FRONT \}, data\.WTI\)/);
  assert.match(brief, /lWti = liveFirst\(wtiLvl\.series, wtiLvl\.code \? qWti : null, now\)/);
  assert.match(brief, /qFut\("WTI", front\.yahoo\)/, "qWti = futSame.WTI contract when present, else the calendar front itself");
  assert.doesNotMatch(brief, /liveFirst\(dcData\.WTI_FRONT/);
});

test("single-day = same contract: series 1d equals the contract's own change; scenarios/matrix use only multi-day windows", () => {
  assert.ok(Math.abs((wtiSeries.at(-1)!.v / wtiSeries.at(-2)!.v - 1) * 100 - sc.pct1) < 1e-9);
  const raw = (CLF.at(-1)!.v / CLZ.at(-2)!.v - 1) * 100; assert.ok(raw < -1.5, "spliced would be −1.7%");
  for (const f of ["src/macro/scenarios.ts", "src/macro/matrix.ts"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /chg\("(WTI|GOLD|BRENT|ES|NQ|RTY|COPPER)", d\.\w+, 1\)/, f);
  }
});

test("multi-day trends on back-adjusted history are labelled 回溯调整 (matrix + scenarios); unlabelled without adjustment", () => {
  const d = { WTI: wtiSeries, GOLD: ser((i) => 4000 + i * 5), UST10Y: ser((i) => 4 + i * 0.01) };
  const adj = new Set(["WTI", "GOLD"]);
  assert.match(classifyMatrix(d, adj).dims.find((x) => x.dim === "油价")!.detail, /（回溯调整连续合约）$/);
  assert.doesNotMatch(classifyMatrix(d).dims.find((x) => x.dim === "油价")!.detail, /回溯/);
  const now = new Date(`${today}T15:00:00Z`);
  const md = buildScenarios({ now, data: d, adjusted: adj }).md;
  assert.match(md, /WTI 20日 [^\n|]*（回溯调整连续合约）/); assert.match(md, /黄金 20日 [^\n|]*（回溯调整连续合约）/);
  assert.match(brief, /buildScenarios\(\{ adjusted: futAdj,/); assert.match(brief, /classifyMatrix\(data, futAdj\)/);
});

const entry: LevelEntry = { date: "2026-11-18", source: "test", levels: [
  { id: "nq30k", label: "NQ 30000", series: "NQ=F", level: 30000, rule: "close_above", unit: "", meaning: "", quote: "q", checklist: true },
  { id: "wti100", label: "WTI 100", series: "@WTI_FRONT", level: 100, rule: "stay_below", unit: "$", meaning: "", quote: "q" }] };

test("must-fix 2: mentor levels on a roll → n/a (换月影响), so close_above / stay_below cannot flip on a calendar spread", () => {
  const nowR = new Date("2026-11-19T21:30:00Z"); // recap of the 11-18 entry
  const data = { "NQ=F": ser(() => 30100), "@WTI_FRONT": ser(() => 99) };
  const st = { "ML_NQ=F": { contract: "NQH27", since: "2026-11-19", from: "NQZ26" } };
  const aff = rollAffectedLevels(entry, st, { "ML_NQ=F": true }, "CLF27");
  assert.deepEqual(Object.keys(aff).sort(), ["@WTI_FRONT", "NQ=F"]);
  assert.match(aff["NQ=F"]!, /已换月至 NQH27（原 NQZ26）/); assert.match(aff["@WTI_FRONT"]!, /CLZ26 换至 CLF27/);
  const r = renderMentorLevels([entry], data, nowR, undefined, aff);
  assert.ok(r.states.every((s) => s.status === "na" && s.above === null), JSON.stringify(r.states));
  assert.match(r.lines.join("\n"), /n\/a（换月影响：NQ=F 已换月至 NQH27/);
  assert.doesNotMatch(r.lines.join("\n"), /✅ 收在上方|❌ 收在下方/);
  // no roll → judged normally
  const ok = renderMentorLevels([entry], data, nowR, undefined, rollAffectedLevels(entry, { "ML_NQ=F": { contract: "NQZ26", since: "2026-09-15", from: "NQU26" } }, {}, "CLZ26"));
  assert.equal(ok.states.find((s) => s.id === "nq30k")!.status, "ok");
  // state changed after the entry date (later run) still counts
  assert.ok(rollAffectedLevels(entry, { "ML_NQ=F": { contract: "NQH27", since: "2026-11-19", from: "NQZ26" } }, {}, null)["NQ=F"]);
  assert.match(brief, /renderMentorLevels\(lv\.entries, \{ \.\.\.data, \.\.\.lvData \}, now, lv\.error, lvRoll\)/);
  assert.doesNotMatch(brief, /lvData\["@WTI_FRONT"\] = data\.WTI/);
});

test("(a) a failed contract quote shows a visible 数据不完整 flag on the scenario output", () => {
  const now = new Date(`${today}T15:00:00Z`);
  const md = buildScenarios({ now, data: { WTI: wtiSeries }, incomplete: ["GC=F", "HG=F"] }).md;
  assert.match(md, /⚠️ \*\*数据不完整\*\*：GC=F、HG=F 同合约报价失败 → 相关信号为 n\/a/);
  assert.doesNotMatch(buildScenarios({ now, data: { WTI: wtiSeries } }).md, /数据不完整/);
  assert.match(brief, /futIncomplete = values\.offline \? \[\] : \[\.\.\.new Set\(futSrcs\.filter\(\(f\) => !futSame\[f\.id\]\)/);
});

test("(b) first same-contract run: a leader change is labelled, not counted (no scenario alarm, scenarioChanged false)", () => {
  const now = new Date(`${today}T15:00:00Z`), data = { WTI: wtiSeries };
  const base = buildScenarios({ now, data, previousLeader: "zzz" as never });
  assert.equal(base.changed, true);
  const s = buildScenarios({ now, data, previousLeader: "zzz" as never, suppressChange: "首次同合约运行：测试" });
  assert.equal(s.changed, false); assert.match(s.md, /ℹ️ 与上次 `zzz` 不同，但不计为切换：首次同合约运行/);
  assert.match(brief, /const firstFutRun = !values\.offline && !existsSync\(futStatePath\)/);
  assert.match(brief, /suppressChange: firstFutRun \?/);
});
