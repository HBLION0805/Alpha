import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { frontContinuous, wtiFront } from "../src/macro/wtiFront.ts";
import { buildPremarket } from "../src/macro/premarket.ts";
import { buildOil } from "../src/macro/oil.ts";
import { buildOilVix } from "../src/macro/oilvix.ts";
import type { Obs } from "../src/macro/fetch.ts";

const root = new URL("../", import.meta.url);
// trading days up to Mon 2026-10-19 (≥ 260 so the 50-day SMA / 52-week high exist)
const days: string[] = []; for (let t = Date.parse("2025-09-01T12:00:00Z"); days.length < 300; t += 864e5) { const d = new Date(t); if (d.getUTCDay() % 6) days.push(d.toISOString().slice(0, 10)); }
while (days.at(-1)! > "2026-10-19") days.pop();
const tail = days.slice(-7); // 10-09 … 10-19 (incl. the real closes)
const NOV = [91.85, 93.74, 94.14, 95.09, 97.97, 101.41, 100.7], DEC = [90.6, 92.4, 92.9, 93.9, 96.5, 99.02, 97.69];
const base = (n: number) => days.slice(0, days.length - n).map((t, i) => ({ t, v: 80 + (i % 20) * 0.2 }));
/** Yahoo CL=F on 10/19: Nov history, then today's bar is already Dec (spliced) */
const CLF: Obs[] = [...base(7), ...tail.map((t, i) => ({ t, v: i < 6 ? NOV[i]! : DEC[6]! }))];
const FRONT: Obs[] = [...base(7).slice(-20), ...tail.map((t, i) => ({ t, v: NOV[i]! }))]; // CLX26.NYM
const now = new Date("2026-10-19T15:00:00Z");
const pm = (data: Record<string, Obs[]>, oilFront = frontContinuous(data.WTI, FRONT, "CLX26")) => buildPremarket({ now, data, calendar: [], earnings: null, headlines: [], oilFront });

test("frontContinuous: recent window = front contract itself (no roll gap); older CL=F ratio-adjusted; fallback when short", () => {
  assert.equal(wtiFront("2026-10-19").code, "CLX26");
  const fc = frontContinuous(CLF, FRONT, "CLX26");
  assert.equal(fc.series.at(-1)!.v, 100.7); assert.equal(fc.series.length, CLF.length, "same dates");
  const d1 = (fc.series.at(-1)!.v / fc.series.at(-2)!.v - 1) * 100; assert.ok(Math.abs(d1 + 0.70) < 0.01, `1d ${d1}`);
  const raw = (CLF.at(-1)!.v / CLF.at(-2)!.v - 1) * 100; assert.ok(raw < -3.6, "Yahoo CL=F shows the fake roll move");
  assert.match(fc.note, /近月 CLX26（= CNBC @CL\.1）.*Yahoo CL=F 97\.69 已提前换到下月合约，不用/);
  // ratio back-adjustment when the contracts differ at the junction (e.g. after our own switch to Dec on 10/21)
  const DECF: Obs[] = [...days.slice(-20, -7).map((t) => ({ t, v: 79 })), ...tail.map((t, i) => ({ t, v: DEC[i]! })), { t: "2026-10-21", v: 98.2 }];
  const CL21: Obs[] = [...CLF.slice(0, -1), { t: "2026-10-19", v: 100.7 }, { t: "2026-10-20", v: 101.1 }, { t: "2026-10-21", v: 98.2 }];
  const z = frontContinuous(CL21, DECF.filter((o) => o.t !== "2026-10-20").concat([{ t: "2026-10-20", v: 98.6 }]).sort((a, b) => a.t.localeCompare(b.t)), "CLZ26");
  const zd1 = (z.series.at(-1)!.v / z.series.at(-2)!.v - 1) * 100; assert.ok(Math.abs(zd1 - (98.2 / 98.6 - 1) * 100) < 1e-9, "switch day: Dec vs Dec, not Dec vs Nov");
  assert.ok(z.ratio != null && z.ratio !== 1); assert.match(z.note, /更早的历史按 .* 比例/);
  const short = frontContinuous(CLF, FRONT.slice(-3), "CLX26"); assert.equal(short.series, CLF); assert.match(short.note, /数据不足 → 仍用 Yahoo CL=F/);
  assert.equal(frontContinuous(CLF, undefined, "CLX26").series, CLF);
});

test("roll day 2026-10-19: oil block, 快速变动 flag and USDCAD line use the front month — the fake −3.7% is gone", () => {
  const data = { WTI: CLF, USDCAD: [{ t: "2026-10-16", v: 1.40 }, { t: "2026-10-19", v: 1.401 }] };
  const old = buildPremarket({ now, data, calendar: [], earnings: null, headlines: [] });
  assert.match(old.oilLines.join("\n"), /\| WTI \(CL=F\) \| 97\.69 \| -3\.67% \|/); assert.equal(old.oilVix.fast, true, "old input: fake fast move");
  const r = pm(data), md = r.oilLines.join("\n");
  assert.match(md, /\| WTI（近月 CLX26） \| 100\.70 \| -0\.70% \| \+7\.42% \|/);
  assert.match(md, /_WTI = 近月 CLX26（= CNBC @CL\.1）/);
  assert.equal(r.oilVix.fast, false); assert.match(md, /WTI 1日 -0\.70% · 5日 \+7\.42%；/); assert.doesNotMatch(md, /⚡ \*\*快速变动/);
  assert.match(r.mentorLines.join("\n"), /USDCAD 1\.4010 · 1日 \+0\.07% · WTI -0\.70%/);
  assert.deepEqual(r.alarms.filter((a) => /OIL/.test(a.kind)), []);
});

test("roll-day alarms: a spliced −5.5% no longer raises OIL_CRASH; a real front-month spike still raises OIL_SPIKE (same thresholds, same NO_TRADE rule)", () => {
  const crashCL: Obs[] = [...CLF.slice(0, -1), { t: "2026-10-19", v: 101.41 * 0.945 }];
  assert.ok(buildOil({ WTI: crashCL }, { now }).alarms.some((a) => a.kind === "OIL_CRASH"), "old input fires on the splice");
  assert.ok(!pm({ WTI: crashCL }).alarms.some((a) => a.kind === "OIL_CRASH"), "front month −0.70% → no crash alarm");
  const spike: Obs[] = [...FRONT.slice(0, -1), { t: "2026-10-19", v: 101.41 * 1.05 }];
  const r = buildPremarket({ now, data: { WTI: CLF }, calendar: [], earnings: null, headlines: [], oilFront: frontContinuous(CLF, spike, "CLX26") });
  const a = r.alarms.find((x) => x.kind === "OIL_SPIKE")!; assert.ok(a); assert.match(a.title, /WTI 急涨 1日 \+5\.00%/);
  assert.ok(r.noTrade.some((x) => /警报未解除：OIL_SPIKE/.test(x)), "the existing alarm → NO_TRADE rule is unchanged");
  assert.equal(buildOilVix({ WTI: frontContinuous(CLF, FRONT, "CLX26").series }).fast, false);
});

test("only the oil input changes: scenarios / matrix / trade plan / dead-cat still get data.WTI; NO_TRADE, sizing and 能不能睡 code untouched", () => {
  const cli = readFileSync(new URL("src/cli/brief.ts", root), "utf8");
  assert.match(cli, /const oilFront = dcData\.WTI_FRONT\?\.length \? frontContinuous\(data\.WTI, dcData\.WTI_FRONT, front\.code\) : null;/);
  assert.deepEqual(cli.split("\n").filter((l) => /oilFront/.test(l) && !/^\s*\/\//.test(l)).length, 2, "built once, passed only to buildPremarket");
  assert.match(cli, /const pm = buildPremarket\(\{ oilFront, /); assert.doesNotMatch(cli, /data\.WTI = |data\["WTI"\] =/);
  const pmSrc = readFileSync(new URL("src/macro/premarket.ts", root), "utf8").split("\n").filter((l) => /\bOD\b/.test(l)).map((l) => l.trim().slice(0, 40));
  assert.equal(pmSrc.length, 4, pmSrc.join("\n")); // definition + USDCAD line + buildOilVix + buildOil
  for (const f of ["src/macro/scenarios.ts", "src/macro/matrix.ts", "src/macro/tradeplan.ts", "src/macro/risk.ts", "src/macro/sleepday.ts", "src/macro/brief.ts", "src/options/riskplan.ts"])
    assert.doesNotMatch(readFileSync(new URL(f, root), "utf8"), /wtiFront|frontContinuous|oilFront/, f);
  // non-oil premarket output identical with and without the front series
  const data = { WTI: CLF, SPX: CLF.map((o) => ({ ...o, v: 7000 })) };
  const a = buildPremarket({ now, data, calendar: [], earnings: null, headlines: [] }), b = pm(data);
  assert.deepEqual(a.dkLines, b.dkLines); assert.deepEqual(a.mentorLines.filter((l) => !/USDCAD/.test(l)), b.mentorLines.filter((l) => !/USDCAD/.test(l)));
});
