import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { vixBand, vixRegime, VIX_BANDS, VIX_FOOTER, VIX_REGIME, VIX_REGIME_FILE, buildOilVix } from "../src/macro/oilvix.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildMacroReport } from "../src/macro/build.ts";
import { buildScenarios } from "../src/macro/scenarios.ts";
import { briefVerdict } from "../src/macro/brief.ts";
import type { Obs } from "../src/macro/fetch.ts";

const root = new URL("../", import.meta.url);
/** VIX series ending at `end` with the given 1d / 5d % changes */
const V = (end: number, d1 = 0, d5 = 0): Obs[] => { const p1 = end / (1 + d1 / 100), p5 = end / (1 + d5 / 100);
  return [p5, p5, p5, (p5 + p1) / 2, (p5 + p1) / 2, p1, end].map((v, i) => ({ t: `2026-10-${String(9 + i).padStart(2, "0")}`, v })); };

test("bands: 20 and 30 go to the higher band, exactly 40 stays in 30–40", () => {
  const cases: Array<[number, string]> = [[12, "low"], [19.99, "low"], [20, "elevated"], [29.99, "elevated"], [30, "fear"], [40, "fear"], [40.01, "panic"], [82.69, "panic"]];
  for (const [v, b] of cases) assert.equal(vixBand(v), b, String(v));
  assert.deepEqual(Object.values(VIX_BANDS).map((b) => `${b.icon} ${b.zh}`), ["🟢 波动较低", "🟡 波动升高", "🟠 市场恐惧", "🔴 极度恐慌"]);
});
test("line format + notes; >40 overrides the infographic's 分批布局 for phase 1; footer once", () => {
  const r = vixRegime({ VIX: V(24.1, 22, 10) });
  assert.equal(r.lines[0], "- **VIX 分档**（2026-10-15）：VIX 24.10 · 🟡 波动升高（结合趋势，管理仓位） ⚡ 急升 +22% 1d");
  assert.match(r.lines[1]!, /单笔更小、止损更严/);
  assert.match(vixRegime({ VIX: V(15) }).lines.join("\n"), /🟢 波动较低（警惕自满）[\s\S]*保护便宜时可考虑买对冲/);
  assert.match(vixRegime({ VIX: V(33) }).lines.join("\n"), /🟠 市场恐惧[\s\S]*第一阶段优先减仓\/NO_TRADE/);
  const p = vixRegime({ VIX: V(45) }).lines.join("\n");
  assert.match(p, /🔴 极度恐慌[\s\S]*极度恐慌——第一阶段不抄底，少亏优先，NO_TRADE 合理/); assert.match(p, /「分批布局」，不适用于第一阶段/);
  for (const v of [15, 24, 33, 45]) assert.equal(vixRegime({ VIX: V(v) }).lines.join("\n").split(VIX_FOOTER).length - 1, 1);
  assert.ok(p.includes(`](${VIX_REGIME_FILE})`));
});
test("speed: ⚡ 急升 at 1d ≥ +20% or 5d ≥ +35%; ↘ 回落 at 1d ≤ −15% or 5d ≤ −25%; none in between; no history → skipped", () => {
  assert.equal(VIX_REGIME.spike1dPct, 20); assert.equal(VIX_REGIME.spike5dPct, 35);
  assert.equal(vixRegime({ VIX: V(24, 20) }).speed, "spike"); assert.equal(vixRegime({ VIX: V(24, 19.9) }).speed, null);
  assert.equal(vixRegime({ VIX: V(24, 5, 35) }).speed, "spike"); assert.equal(vixRegime({ VIX: V(24, 5, 34.9) }).speed, null);
  assert.match(vixRegime({ VIX: V(30, 25, 40) }).lines[0]!, /⚡ 急升 \+25% 1d · \+40% 5d$/);
  const dn = vixRegime({ VIX: V(18, -15) }); assert.equal(dn.speed, "drop"); assert.match(dn.lines[0]!, /↘ 回落 -15% 1d$/);
  assert.equal(vixRegime({ VIX: V(18, -5, -25) }).speed, "drop"); assert.equal(vixRegime({ VIX: V(18, -14.9, -24.9) }).speed, null);
  const one = vixRegime({ VIX: [{ t: "2026-10-16", v: 21 }] });
  assert.equal(one.band, "elevated"); assert.equal(one.speed, null); assert.match(one.lines.join("\n"), /速度：历史不足，略过/); assert.doesNotMatch(one.lines[0]!, /⚡|↘/);
  const none = vixRegime({}); assert.equal(none.band, null); assert.match(none.lines[0]!, /VIX 数据不可用/);
});
test("brief §4: 分档 block sits above the VIX-vs-index check; display only — same alarms / NO_TRADE / verdict at VIX 15 vs 45", () => {
  const now = new Date("2026-10-19T11:30:00Z");
  const flat = (v: number): Obs[] => Array.from({ length: 7 }, (_, i) => ({ t: `2026-10-${String(9 + i).padStart(2, "0")}`, v }));
  const pmAt = (vix: number) => buildPremarket({ now, data: { VIX: flat(vix), VIX3M: flat(60) }, calendar: [], earnings: null, headlines: [] });
  const lo = pmAt(15), hi = pmAt(45);
  const k = hi.dkLines.join("\n");
  assert.ok(k.indexOf("### VIX 分档（用户分享的信息图 · 只标记）") < k.indexOf("### VIX 与指数是否互相确认"));
  assert.match(k, /VIX 45\.00 · 🔴 极度恐慌/); assert.match(lo.dkLines.join("\n"), /VIX 15\.00 · 🟢 波动较低/);
  assert.deepEqual(hi.alarms, lo.alarms); assert.deepEqual(hi.noTrade, lo.noTrade);
  const macro = buildMacroReport(new DatabaseSync(":memory:"), [], [], now), sc = buildScenarios({ now, data: {}, calendar: [] });
  assert.deepEqual(briefVerdict({ macro, pm: hi, sc }), briefVerdict({ macro, pm: lo, sc }));
  assert.equal(buildOilVix({ VIX: V(45, 30) }).regime.speed, "spike");
});
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : []; });
test("display only (static): the regime is read only by premarket.ts to print §4 lines; not by sizing, alerts, mentor, card, sleep label or brief JSON", () => {
  const src = new URL("src", root).pathname, rel = (p: string) => p.slice(src.length + 1);
  const users = walk(src).filter((f) => rel(f) !== "macro/oilvix.ts" && /vixRegime|vixBand|VIX_BANDS|VIX_REGIME|lines\.regime|\.regime\.(band|speed|level|lines)/.test(readFileSync(f, "utf8"))).map(rel);
  assert.deepEqual(users, ["macro/premarket.ts"]);
  const pmLines = readFileSync(`${src}/macro/premarket.ts`, "utf8").split("\n").filter((l) => /\bregime\b/.test(l) && /ov\./.test(l));
  assert.deepEqual(pmLines.map((l) => l.trim()), ['K.push("", "### VIX 分档（用户分享的信息图 · 只标记）", ...ov.lines.regime);']);
  assert.doesNotMatch(readFileSync(`${src}/macro/sleepday.ts`, "utf8"), /oilvix/);
  assert.doesNotMatch(readFileSync(`${src}/cli/brief.ts`, "utf8"), /oilVix[^\n]*regime|pm\.oilVix\.regime/);
});
test("knowledge/vix-regimes.md: user-shared infographic (not the mentor's), bands, historical closes", () => {
  const t = readFileSync(new URL(VIX_REGIME_FILE, root), "utf8");
  assert.match(t, /用户分享的信息图/); assert.match(t, /不是导师的内容/);
  for (const row of ["| 2002 | 45.08 |", "| 2008–09 | 80.86 |", "| 2011 | 48.00 |", "| 2015 | 40.74 |", "| 2018 | 37.32 |", "| 2020 | 82.69 |", "| 2022 | 36.45 |", "| 2024-08-05 | 38.57 |", "| 2025-04-08 | 52.33 |"]) assert.ok(t.includes(row), row);
  assert.ok(t.includes("20 和 30 都归上一档，正好 40 归 30–40"));
});
