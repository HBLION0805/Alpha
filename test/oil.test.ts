import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOil, OIL_ALARM_SCORE } from "../src/macro/oil.ts";
import { buildPremarket, alarmItems } from "../src/macro/premarket.ts";
import { premarketAlarmAlerts } from "../src/alerts.ts";
import type { Obs } from "../src/macro/fetch.ts";

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2025, 8, 1 + i)).toISOString().slice(0, 10));
const ser = (vals: number[]): Obs[] => days(vals.length).map((t, i) => ({ t, v: vals[i]! }));
const flat = (v: number, n = 300) => ser(Array(n).fill(v));
const withTail = (base: number, tail: number[], n = 300) => ser([...Array(n - tail.length).fill(base), ...tail]);
const now = new Date("2026-10-15T11:30:00Z");
const calm = () => ({ WTI: flat(60), BRENT: flat(70.5), RBOB: flat(1.9), XLE: flat(90), USDCAD: flat(1.38), UST10Y: flat(4.5) });
const kinds = (d: Record<string, Obs[]>, h: string[] = []) => buildOil(d, { now, headlines: h }).alarms.map((a) => `${a.kind}:${a.score}`);

test("oil block: table (level, 1d, 5d, vs 50d SMA, vs 52w high), Brent–WTI spread, gasoline, XLE, USDCAD, transmission", () => {
  const r = buildOil(calm(), { now, calendar: [{ kind: "CPI", title: "CPI", date: "2026-11-10", timeEt: "08:30", source: "x" } as never] });
  const md = r.lines.join("\n");
  for (const k of ["WTI (CL=F)", "Brent (BZ=F)", "RBOB (RB=F)", "XLE", "距 50 日均线", "距 52 周高点", "Brent–WTI 价差** $10.50", "USDCAD 联动", "PPI/CPI", "下一次 CPI：2026-11-10"]) assert.ok(md.includes(k), k);
  assert.equal(r.alarms.length, 0);
  assert.equal(r.spread, 10.5);
});

test("oil alarms: spike 80 (+4% 1d or +10% 5d), crash 70 (−5% 1d), spread widening >$3/5d 65; shipping news adds +5", () => {
  assert.deepEqual(kinds({ ...calm(), WTI: withTail(60, [60, 62.5]) }), ["OIL_SPIKE:80"]);
  assert.deepEqual(kinds({ ...calm(), BRENT: withTail(70.5, [72, 74, 75, 76, 77.6]), WTI: withTail(60, [60, 60, 60, 60, 60]) }), ["OIL_SPIKE:80", "BRENT_WTI_WIDEN:65"]);
  assert.deepEqual(kinds({ ...calm(), WTI: withTail(60, [56.9]), BRENT: withTail(70.5, [67.4]) }), ["OIL_CRASH:70"]);
  assert.deepEqual(kinds({ ...calm(), WTI: withTail(60, [60, 62.5]) }, ["Tanker attacked near Strait of Hormuz"]), ["OIL_SPIKE:85"]);
  assert.deepEqual(kinds({ ...calm(), WTI: withTail(60, [60, 61]) }), [], "+1.7% is not a spike");
  assert.equal(OIL_ALARM_SCORE.OIL_SPIKE, 80);
});

test("transmission reads: inflation pass-through vs growth scare", () => {
  const up = withTail(60, [60, 61, 62, 63, 64, 65]);
  const inf = buildOil({ ...calm(), WTI: up, UST10Y: withTail(4.5, [4.5, 4.52, 4.55, 4.58, 4.6, 4.62]) }, { now }).lines.join("\n");
  assert.match(inf, /通胀传导/);
  const gs = buildOil({ ...calm(), WTI: up, UST10Y: withTail(4.5, [4.5, 4.47, 4.44, 4.41, 4.38, 4.35]) }, { now }).lines.join("\n");
  assert.match(gs, /增长恐慌读法/);
});

test("oil alarms flow into alerts with their own score and the 用户要求 label", () => {
  const data = { ...calm(), WTI: withTail(60, [60, 62.5]) };
  const pm = buildPremarket({ now, data, calendar: [], earnings: null, headlines: ["Houthis strike tanker in Red Sea"] });
  const a = pm.alarms.find((x) => x.kind === "OIL_SPIKE")!;
  assert.equal(a.by, "user"); assert.equal(a.score, 85);
  assert.match(pm.md, /用户要求/);
  const items = alarmItems(pm.alarms, now).map((it, i) => ({ ...it, id: i + 1 }));
  const al = premarketAlarmAlerts(items, { priorAlertScore: () => null }, 60);
  const oil = al.find((x) => /OIL_SPIKE/.test(x.alert.headline))!;
  assert.equal(oil.alert.score, 85);
  assert.ok(oil.alert.topics.includes("shipping") && oil.alert.watch.includes("BZ=F"));
});
