import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadSignals, evaluate, evaluateAll, updateState, scorePaths, isDue, dueDates, emptyState, renderCrisis, type SignalDef, type SignalsFile } from "../src/macro/crisisPath.ts";
import type { Obs } from "../src/macro/fetch.ts";

const root = new URL("../", import.meta.url), rd = (p: string) => readFileSync(new URL(p, root), "utf8");
const T = "2026-10-19";
const ser = (vals: number[], end = T, step = 1): Obs[] => vals.map((v, k) => ({ t: new Date(Date.parse(end + "T12:00:00Z") - (vals.length - 1 - k) * step * 864e5).toISOString().slice(0, 10), v }));
const F = loadSignals(), S = (id: string) => F.signals.find((s) => s.id === id)!;

test("archive: report .md + .pdf byte-for-byte (sha256 in manifest); signals carry the report's §8 thresholds", () => {
  const D = "knowledge/macro/crisis-compare-2026-10-19/", m = JSON.parse(rd(D + "manifest.json"));
  assert.equal(m.files.length, 2);
  for (const f of m.files) { const b = readFileSync(new URL(D + f.file, root)); assert.equal(b.length, f.bytes); assert.equal(createHash("sha256").update(b).digest("hex"), f.sha256, f.file); }
  assert.match(rd(D + "crisis-compare-2026-10-19.md"), /## 8\. 确认\/证伪信号清单/);
  const th = Object.fromEntries(F.signals.map((s) => [s.id, s.threshold]));
  assert.deepEqual(th, { hy_oas: 4.5, claims_4wk: 250000, sahm: 0.5, banks_break: -15, cmbs: 9, wti_front: 110, core_cpi_3m: 4, be5y: 2.75, curve_3m10y: 0, stocks_bonds_down: 0, ai_theme_break: -20, vix_spike: 40 });
  assert.deepEqual([...new Set(F.signals.map((s) => s.path))].sort(), ["1929", "1973", "2007", "2020"]);
  assert.equal(S("wti_front").series, "wti_front", "front-month WTI, not CL=F");
});

test("evaluate: 未触发 / 接近 / 触发 per kind; missing or stale data = 无数据", () => {
  const hy = S("hy_oas"), st = (s: SignalDef, d: Record<string, Obs[]>, done = {}) => evaluate(s, d, T, done).status;
  assert.equal(st(hy, { "fred:BAMLH0A0HYM2": ser([3.3]) }), "untriggered"); assert.equal(st(hy, { "fred:BAMLH0A0HYM2": ser([4.2]) }), "near"); assert.equal(st(hy, { "fred:BAMLH0A0HYM2": ser([4.6]) }), "triggered");
  assert.equal(st(hy, {}), "nodata"); assert.equal(st(hy, { "fred:BAMLH0A0HYM2": ser([5], "2026-09-01") }), "nodata", "stale > 10 days");
  assert.equal(st(S("claims_4wk"), { "fred:ICSA": ser([240e3, 255e3, 260e3, 262e3], T, 7) }), "triggered");
  assert.equal(st(S("claims_4wk"), { "fred:ICSA": ser([199e3, 198e3, 200e3, 199e3], T, 7) }), "untriggered");
  assert.equal(st(S("sahm"), { "fred:SAHMREALTIME": ser([0.5], "2026-09-01") }), "triggered");
  const cpi = (x: number) => ({ "fred:CPILFESL": ser([100, 100 * x ** (1 / 3), 100 * x ** (2 / 3), 100 * x], "2026-09-01", 30) });
  assert.equal(st(S("core_cpi_3m"), cpi(1.0105)), "triggered", "≈4.3% ann."); assert.equal(st(S("core_cpi_3m"), cpi(1.0085)), "untriggered", "≈3.4%");
  assert.equal(st(S("be5y"), { "fred:T5YIE": ser([2.8]) }), "triggered"); assert.equal(st(S("curve_3m10y"), { "fred:T10Y3M": ser([-0.1]) }), "triggered"); assert.equal(st(S("curve_3m10y"), { "fred:T10Y3M": ser([0.88]) }), "untriggered");
  const w = S("wti_front");
  assert.equal(st(w, { wti_front: ser([111, 112, 113, 111, 112]) }), "triggered"); assert.equal(st(w, { wti_front: ser([109, 112, 113, 111, 112]) }), "near", "one close below = not sustained");
  assert.equal(st(w, { wti_front: ser([96, 98, 100, 102, 103.56]) }), "untriggered");
  const flat = (n: number, v: number, last: number) => ser([...Array(n - 1).fill(v), last]);
  assert.equal(st(S("banks_break"), { "yahoo:XLF": flat(300, 50, 52), "yahoo:KRE": flat(300, 60, 63) }), "untriggered");
  assert.equal(st(S("banks_break"), { "yahoo:XLF": flat(300, 50, 51), "yahoo:KRE": flat(300, 60, 58) }), "triggered", "KRE below 200DMA");
  assert.equal(evaluate(S("banks_break"), { "yahoo:XLF": flat(300, 50, 51) }, T).note, "缺 KRE（只用了其余）");
  assert.equal(st(S("stocks_bonds_down"), { "yahoo:SPY": flat(30, 100, 99), "yahoo:TLT": flat(30, 90, 88) }), "triggered");
  assert.equal(st(S("stocks_bonds_down"), { "yahoo:SPY": flat(30, 100, 100.5), "yahoo:TLT": flat(30, 90, 88) }), "near");
  assert.equal(st(S("stocks_bonds_down"), { "yahoo:SPY": flat(30, 100, 99) }), "nodata");
  const vix = S("vix_spike");
  assert.equal(st(vix, { "yahoo:^VIX": ser([...Array(20).fill(16), 22, 30, 38, 45, 42]) }), "triggered", "< 20 → > 40 within 10 days");
  assert.equal(st(vix, { "yahoo:^VIX": ser([...Array(20).fill(28), 32, 35, 38, 45, 42]) }), "near", "already elevated: not a sudden spike from < 20");
  assert.equal(st(vix, { "yahoo:^VIX": ser([...Array(25).fill(18.4)]) }), "untriggered");
  const c = S("cmbs"); assert.equal(evaluate(c, {}, T).status, "near"); assert.equal(evaluate(c, {}, "2027-03-01").status, "nodata", "manual reading stale → 请更新");
  assert.equal(evaluate({ ...c, readings: [{ date: "2026-08-31", v: 8.5, source: "x" }, { date: "2026-09-30", v: 9.3, source: "x" }] }, {}, T).status, "triggered");
  // 1929: theme break alone = 接近; with HY OAS 触发 = 触发
  const ai = S("ai_theme_break"), qq = { "yahoo:QQQ": flat(100, 100, 95), "yahoo:NVDA": flat(100, 100, 91), "yahoo:CRWV": flat(100, 100, 44) };
  const hyE = (v: number) => ({ hy_oas: evaluate(hy, { "fred:BAMLH0A0HYM2": ser([v]) }, T) });
  assert.equal(st(ai, qq, hyE(3.31)), "near"); assert.equal(st(ai, qq, hyE(4.8)), "triggered");
  assert.equal(st(ai, { "yahoo:QQQ": flat(100, 100, 95), "yahoo:NVDA": flat(100, 100, 91), "yahoo:CRWV": flat(100, 100, 95) }, hyE(4.8)), "untriggered");
});

const goodData = (hy: number): Record<string, Obs[]> => ({ "fred:BAMLH0A0HYM2": ser([hy]) });
test("state: first 触发 date kept; fetch outage (无数据) changes nothing — no fake switches; re-trigger keeps the first date", () => {
  const one: SignalsFile = { ...F, signals: [S("hy_oas"), S("vix_spike")] };
  let r = updateState(emptyState(), evaluateAll(one, goodData(3.3), "2026-10-19"), "2026-10-19");
  assert.equal(r.state.signals.hy_oas!.status, "untriggered"); assert.deepEqual(r.newlyTriggered, []);
  r = updateState(r.state, evaluateAll(one, { "fred:BAMLH0A0HYM2": ser([4.7], "2026-11-02") }, "2026-11-02"), "2026-11-02");
  assert.deepEqual(r.newlyTriggered, ["hy_oas"]); assert.equal(r.state.signals.hy_oas!.firstTriggered, "2026-11-02");
  const before = JSON.stringify(r.state.signals);
  const out = updateState(r.state, evaluateAll(one, {}, "2026-11-16"), "2026-11-16"); // proxy TLS outage: every fetch failed
  assert.equal(JSON.stringify(out.state.signals), before, "state untouched"); assert.deepEqual(out.transitions, []); assert.deepEqual(out.newlyTriggered, []);
  assert.deepEqual(out.state.runs.at(-1), { date: "2026-11-16", noData: ["hy_oas", "vix_spike"] });
  const md = renderCrisis(one, evaluateAll(one, {}, "2026-11-16"), out.state, new Date("2026-11-16T22:00:00Z"), "2026-11-16", []);
  assert.match(md, /⚪ 无数据（沿用上次：触发）/);
  r = updateState(out.state, evaluateAll(one, { "fred:BAMLH0A0HYM2": ser([4.6], "2026-12-01") }, "2026-12-01"), "2026-12-01");
  assert.deepEqual(r.newlyTriggered, [], "after an outage it is still 触发 — not new");
  r = updateState(r.state, evaluateAll(one, { "fred:BAMLH0A0HYM2": ser([3.9], "2026-12-15") }, "2026-12-15"), "2026-12-15");
  assert.equal(r.state.signals.hy_oas!.clearedAt, "2026-12-15");
  r = updateState(r.state, evaluateAll(one, { "fred:BAMLH0A0HYM2": ser([5.1], "2027-01-04") }, "2027-01-04"), "2027-01-04");
  assert.deepEqual(r.newlyTriggered, ["hy_oas"]); assert.equal(r.state.signals.hy_oas!.firstTriggered, "2026-11-02"); assert.equal(r.state.signals.hy_oas!.lastTriggered, "2027-01-04");
});

test("path scoring: lead = path of the earliest first-trigger; same day → higher score; none → most 接近", () => {
  const st = emptyState(), ev = (id: string, path: string, status: "triggered" | "near" | "untriggered") => ({ id, path, label: id, status, value: 1, display: "", threshold: "", asOf: T });
  const E = F.signals.map((s) => ev(s.id, s.path, "untriggered"));
  const set = (id: string, status: "triggered" | "near", first?: string) => { E.find((e) => e.id === id)!.status = status; if (first) st.signals[id] = { status, firstTriggered: first, lastTriggered: first, clearedAt: null, lastValue: 1, lastAsOf: first, lastGoodRun: first }; };
  assert.equal(scorePaths(F, E, st).lead, "none");
  set("cmbs", "near"); assert.equal(scorePaths(F, E, st).lead, "2007");
  set("be5y", "triggered", "2026-11-02"); set("hy_oas", "triggered", "2026-12-01");
  const a = scorePaths(F, E, st); assert.equal(a.lead, "1973"); assert.deepEqual(a.order.map((o) => o.id), ["be5y", "hy_oas"]);
  set("claims_4wk", "triggered", "2026-11-02"); assert.equal(scorePaths(F, E, st).lead, "2007", "same first day → higher score (2007: 2 trig + 1 near)");
});

test("semi-monthly schedule: 1st / 15th or next NYSE trading day; missed slot catches up", () => {
  assert.deepEqual(dueDates(2026, 11), ["2026-11-02", "2026-11-16"], "Nov 1 and 15 are Sundays");
  assert.deepEqual(dueDates(2027, 1), ["2027-01-04", "2027-01-15"], "Jan 1 holiday, then weekend");
  assert.equal(isDue("2026-10-19", null).due, true, "never run");
  assert.equal(isDue("2026-10-30", "2026-10-19").due, false); assert.equal(isDue("2026-11-02", "2026-10-19").due, true);
  assert.equal(isDue("2026-11-03", "2026-11-02").due, false); assert.equal(isDue("2026-11-20", "2026-11-02").due, true, "missed 11-16 → catch up");
  assert.equal(isDue("2027-01-02", "2026-12-15").due, false); assert.equal(isDue("2027-01-04", "2026-12-15").slot, "2027-01-04");
});

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = `${d}/${f}`; return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : []; });
test("standalone + display only: not in the daily brief, no alerts, no orders; nothing else imports it", () => {
  const src = new URL("src", root).pathname, users = walk(src).filter((f) => !f.endsWith("macro/crisisPath.ts") && /crisisPath/.test(readFileSync(f, "utf8"))).map((f) => f.slice(src.length + 1)).sort();
  assert.deepEqual(users, ["cli/crisisPath.ts"]);
  const cli = rd("src/cli/crisisPath.ts").split("\n").filter((l) => /^import/.test(l)).join("\n");
  assert.doesNotMatch(cli, /alert|notify|order|robinhood|alpaca|store/i);
  assert.match(JSON.parse(rd("package.json")).scripts["crisis-path"], /node src\/cli\/crisisPath\.ts/);
});
