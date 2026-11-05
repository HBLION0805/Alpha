import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildOilVix, oilDriver, oilSpeed, vixConfirm, OIL_QUOTE, VIX_QUOTE, SQUEEZE_QUOTE, PM_FILE } from "../src/macro/oilvix.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { selectReminders, oilSqueezeLines, RULES } from "../src/review/mentor.ts";
import type { Obs } from "../src/macro/fetch.ts";

const root = new URL("../", import.meta.url);
test("archive: transcript byte-for-byte (sha256), 来源说明 kept, video not in the repo; quotes verbatim", () => {
  const m = JSON.parse(readFileSync(new URL("knowledge/mentor/premarket-routine/manifest.json", root), "utf8"));
  const f = m.files[0], b = readFileSync(new URL(`knowledge/mentor/premarket-routine/${f.file}`, root));
  assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256); assert.equal(f.verbatimChecked, false);
  const t = b.toString("utf8");
  assert.match(t, /^# 导师盘前流程：原油与 VIX/); assert.match(t, /来源说明：由视频模型逐句转录，未与原视频逐字核对；作者名已去除。/);
  for (const q of [OIL_QUOTE, VIX_QUOTE, SQUEEZE_QUOTE]) assert.ok(t.includes(q), q);
  assert.equal(PM_FILE, `knowledge/mentor/premarket-routine/${f.file}`);
  const cat = JSON.parse(readFileSync(new URL("knowledge/catalog.json", root), "utf8"));
  const it = cat.items.find((x: { id: string }) => x.id === "phase2-vix-call-hedge");
  assert.equal(it.status, "MECHANICS_REFERENCE"); assert.match(it.title, /PHASE 2 REFERENCE ONLY \(not enabled\)/);
  assert.ok(cat.sources.some((s: { id: string }) => s.id === "mentor-premarket-oil-vix"));
});

/** series with given 1-day and 5-day % changes at the end (6+ points) */
const S = (d5: number, d1 = d5 / 5): Obs[] => { const end = 100, p1 = end / (1 + d1 / 100), p5 = end / (1 + d5 / 100);
  return [90, 91, p5, (p5 + p1) / 2, (p5 + p1) / 2, (p5 + p1) / 2, p1, end].map((v, i) => ({ t: `2026-10-${String(8 + i).padStart(2, "0")}`, v })); };
const data = (o: { wti?: number; wti1?: number; brent?: number; spx?: number; ndx?: number; hg?: number | null; vix?: number }) => ({
  WTI: S(o.wti ?? 0, o.wti1), BRENT: S(o.brent ?? o.wti ?? 0), SPX: S(o.spx ?? 0), NDX: S(o.ndx ?? o.spx ?? 0), VIX: S(o.vix ?? 0), ...(o.hg === null ? {} : { COPPER: S(o.hg ?? 0) }) });
const close = (a: number | null, b: number) => assert.ok(a != null && Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test("speed: 1d/5d % change; ⚡ at |1d| ≥ 3% or |5d| ≥ 8% (either contract)", () => {
  const s = oilSpeed(data({ wti: 5, wti1: 1 }));
  close(s[0]!.d1, 1); close(s[0]!.d5, 5); assert.equal(s[0]!.fast, false);
  assert.equal(oilSpeed(data({ wti: 2, wti1: -3 }))[0]!.fast, true);
  assert.equal(oilSpeed(data({ wti: 8, wti1: 0.5 }))[0]!.fast, true);
  assert.equal(oilSpeed(data({ wti: 1, brent: -8.5 }))[1]!.fast, true);
  assert.equal(buildOilVix(data({ wti: 1, wti1: 0.2 })).fast, false);
});
test("driver heuristic: all six cases + small move + copper missing → 无法判断 (never filled)", () => {
  assert.equal(oilDriver(data({ wti: 4, spx: 1.5, hg: 2, vix: -6 })).driver, "demand");
  assert.equal(oilDriver(data({ wti: 4, spx: -1.2, hg: 2, vix: 2 })).driver, "supply_shock");
  assert.equal(oilDriver(data({ wti: 4, spx: 0.2, hg: 0, vix: 8 })).driver, "supply_shock", "VIX up alone");
  assert.equal(oilDriver(data({ wti: 4, spx: 0.2, hg: 0, vix: 1 })).driver, "unclear");
  assert.equal(oilDriver(data({ wti: -4, spx: 1, hg: -2, vix: -3 })).driver, "supply_relief");
  assert.equal(oilDriver(data({ wti: -4, spx: -1, hg: -2, vix: 6 })).driver, "demand_weak");
  assert.equal(oilDriver(data({ wti: 1.5, spx: -3, vix: 20 })).driver, "small_move");
  const noCu = oilDriver(data({ wti: 4, spx: 1.5, hg: null, vix: -6 }));
  assert.equal(noCu.driver, "unclear"); assert.match(noCu.why, /铜 HG 数据不可用/); assert.equal(noCu.inputs.hg5, null);
  assert.equal(oilDriver(data({ wti: -4, spx: -1, hg: null, vix: 6 })).driver, "unclear");
  assert.equal(oilDriver({ SPX: S(1) }).driver, "no_data");
});
test("supply shock adds the JETS / XLY pressure note; oil line quotes the mentor verbatim", () => {
  const r = buildOilVix(data({ wti: 9, wti1: 3.5, spx: -2, hg: -1.5, vix: 15 }));
  assert.equal(r.driver, "supply_shock"); assert.equal(r.fast, true);
  const md = r.lines.oil.join("\n");
  assert.match(md, /⚡ \*\*快速变动\*\*/); assert.match(md, /驱动判断（启发式，不是结论）\*\*：\*\*偏供应冲击 \/ 经济负担\*\*/);
  assert.match(md, /承压板块\*\*：航空（JETS）、可选消费（XLY）/); assert.ok(md.includes(`「${OIL_QUOTE}」`));
  assert.ok(!buildOilVix(data({ wti: 4, spx: 1.5, hg: 2, vix: -6 })).lines.oil.join("\n").includes("承压板块"));
  assert.match(buildOilVix(data({ wti: 4, spx: 1.5, hg: null, vix: -6 })).lines.oil.join("\n"), /铜 HG 数据不可用/);
});
test("VIX vs index: 方向确认 / 背离/未确认 / 无法判断", () => {
  assert.equal(vixConfirm(data({ spx: 2, vix: -10 })).zh, "方向确认");
  assert.equal(vixConfirm(data({ spx: -2, vix: 12 })).zh, "方向确认");
  const up = vixConfirm(data({ spx: 2, vix: 8 })); assert.equal(up.label, "diverge"); assert.match(up.why, /指数涨，VIX 也涨/);
  assert.equal(vixConfirm(data({ spx: -2, vix: -6 })).zh, "背离/未确认");
  assert.match(vixConfirm(data({ spx: 2, ndx: -1, vix: -6 })).zh, /指数无明确方向或分化/);
  assert.match(vixConfirm(data({ spx: 2, vix: 1 })).zh, /VIX 基本持平/);
  assert.match(vixConfirm({ SPX: S(1) }).zh, /缺数据/);
  const l = buildOilVix(data({ spx: 2, vix: 8 })).lines.vix.join("\n");
  assert.match(l, /→ \*\*背离\/未确认\*\*/); assert.match(l, /只标记，不改变结论/); assert.ok(l.includes(`「${VIX_QUOTE}」`));
});
test("premarket: oil block + VIX section carry the new lines; no new alarm / NO_TRADE from them", () => {
  const D = data({ wti: 9, wti1: 3.5, spx: -2, hg: -1.5, vix: 15 });
  const pm = buildPremarket({ now: new Date("2026-10-19T12:00:00Z"), data: D });
  assert.ok(pm.oilLines.some((l) => l.includes(OIL_QUOTE))); assert.ok(pm.dkLines.some((l) => /VIX vs 指数/.test(l)));
  assert.equal(pm.oilVix.driver, "supply_shock");
  assert.ok(!pm.alarms.some((a) => /oilvix|驱动|背离/.test(a.title)));
  assert.ok(!pm.noTrade.some((x) => /背离|驱动|快速变动/.test(x)));
});
test("mentor: §1.1 oil_speed on ⚡, vix_confirm on 背离; plan card oil_squeeze only for supply shock + airline/travel/consumer", () => {
  const base = { now: new Date("2026-10-19T11:30:00Z"), verdict: "RESEARCH_OK", leader: "base", previousLeader: "base", regime: "MIXED", previousRegime: "MIXED", events: [], journal: [], capital: 5000 };
  const ids = (oilVix: { fast: boolean; driver: string; vix: string } | null) => selectReminders({ ...base, oilVix }).map((r) => r.id);
  assert.deepEqual(ids({ fast: true, driver: "supply_shock", vix: "diverge" }), ["oil_speed", "vix_confirm"]);
  assert.deepEqual(ids({ fast: false, driver: "demand", vix: "confirm" }), []);
  const line = selectReminders({ ...base, oilVix: { fast: true, driver: "supply_shock", vix: "confirm" } })[0]!.line;
  assert.ok(RULES.oil_speed!.quotes.some((q) => line.includes(q.text)));
  const shock = { driver: "supply_shock" };
  assert.match(oilSqueezeLines("DAL", "", shock)[0]!, /计划涉及「DAL」/);
  assert.match(oilSqueezeLines("SPY", "旅游需求会被油价压住", shock)[0]!, /「旅游」/);
  assert.ok(oilSqueezeLines("JETS", null, shock).join("\n").includes(SQUEEZE_QUOTE));
  assert.deepEqual(oilSqueezeLines("DAL", "airline", { driver: "demand" }), []);
  assert.deepEqual(oilSqueezeLines("NVDA", "AI capex", shock), []);
  assert.deepEqual(oilSqueezeLines("DAL", "", null), []);
});
