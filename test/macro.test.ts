import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFredCsv, parseYahooChart, parseCoinbaseCandles, parseRobinhoodQuotes, type Obs } from "../src/macro/fetch.ts";
import { computeStats, type SeriesStats } from "../src/macro/stats.ts";
import { classifyAxes, classifyRegime } from "../src/macro/regime.ts";
import { confirmReaction, headlineDirection } from "../src/macro/confirm.ts";
import { riskView, upcomingHighImpact, knowledgeRef, eventUtcMs } from "../src/macro/risk.ts";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

test("parsers: FRED csv (skips blanks), Yahoo chart, Coinbase candles, Robinhood quotes", () => {
  const f = parseFredCsv(fx("fred-dgs2.csv"));
  assert.ok(f.length >= 5 && f.every((o) => Number.isFinite(o.v)));
  assert.deepEqual(parseFredCsv("observation_date,X\n2026-10-12,\n2026-10-13,4.79\n"), [{ t: "2026-10-13", v: 4.79 }]);
  const y = parseYahooChart(JSON.parse(fx("yahoo-spy.json")), true);
  assert.ok(y.length >= 4 && /^\d{4}-\d\d-\d\d$/.test(y[0]!.t));
  assert.deepEqual(parseCoinbaseCandles([[1792022400, 1, 2, 1.5, 1.8, 10], [1791936000, 1, 2, 1.5, 1.7, 10]], true).map((o) => o.v), [1.7, 1.8]);
  assert.deepEqual(parseRobinhoodQuotes({ data: { results: [{ symbol: "SPY", last_trade_price: "769.60" }, { symbol: "GLD", mark_price: 376 }] } }), { SPY: 769.6, GLD: 376 });
});

const series = (start: number, step: number, n = 300): Obs[] => Array.from({ length: n }, (_, i) => ({ t: `d${String(i).padStart(4, "0")}`, v: start + step * i }));

test("stats: bp changes for yields, % for prices, z-scores defined", () => {
  const s = computeStats("UST2Y", series(4, 0.01), true);
  assert.equal(s.chg1, 1);
  assert.equal(s.chg20, 20);
  const p = computeStats("SPY", series(100, 0, 300).map((o, i) => ({ ...o, v: i === 299 ? 110 : 100 })), false);
  assert.equal(p.chg1, 10);
  assert.ok(p.z20! > 3);
});

function mkStats(over: Record<string, Partial<SeriesStats>>): Record<string, SeriesStats> {
  const base = (id: string): SeriesStats => ({ id, last: 1, lastDate: "2026-10-14", chg1: 0, chg5: 0, chg20: 0, z20: 0, zLevel: 0, ma50: null, n: 300 });
  const ids = ["UST2Y", "FEDFUNDS", "DXY", "REAL10Y", "BE5Y", "VIX", "HYOAS", "NFCI", "SPY"];
  return Object.fromEntries(ids.map((id) => [id, { ...base(id), ...(over[id] ?? {}) }]));
}

test("regime: risk-off when vol, credit, equities and liquidity all stressed", () => {
  const r = classifyRegime(classifyAxes(mkStats({ VIX: { last: 32, chg5: 40 }, HYOAS: { last: 5, chg20: 80 }, SPY: { last: 90, ma50: 100, chg20: -8 }, NFCI: { last: 0.3 }, UST2Y: { last: 3.6 }, FEDFUNDS: { last: 4 } })));
  assert.equal(r.label, "RISK_OFF");
  assert.equal(r.confidence, 1);
  assert.ok(r.support.some((s) => s.includes("credit spreads widening")));
});

test("regime: risk-on vs disinflation-easing compatible; hawkish when 2Y/real/USD rise", () => {
  const on = classifyRegime(classifyAxes(mkStats({ VIX: { last: 13 }, SPY: { last: 110, ma50: 100, chg20: 4 }, NFCI: { last: -0.5 }, UST2Y: { last: 4, chg20: -30 }, FEDFUNDS: { last: 4.2 }, HYOAS: { chg20: -25 } })));
  assert.ok(["RISK_ON", "DISINFLATION_EASING"].includes(on.label), on.label);
  const hawk = classifyRegime(classifyAxes(mkStats({ UST2Y: { last: 4.8, chg20: 35 }, FEDFUNDS: { last: 4 }, REAL10Y: { chg20: 30 }, DXY: { chg20: 2.5 }, VIX: { last: 18 }, SPY: { last: 100, ma50: 100, chg20: 0 } })));
  assert.equal(hawk.label, "HAWKISH_TIGHTENING");
});

test("regime: conflicting signals → MIXED (today's real setup: calm vol + SPY up, but credit widening, real yields up, hikes priced)", () => {
  const r = classifyRegime(classifyAxes(mkStats({ UST2Y: { last: 4.79, chg20: 14 }, FEDFUNDS: { last: 3.88 }, DXY: { last: 102.1, chg20: 1.8 }, REAL10Y: { last: 2.88, chg20: 28 }, BE5Y: { chg20: -5 }, VIX: { last: 16.9, chg5: 11.9 }, HYOAS: { last: 3.16, chg20: 40 }, NFCI: { last: -0.49 }, SPY: { last: 769.6, ma50: 768.6, chg20: 2.06 } })));
  assert.equal(r.label, "MIXED");
});

test("regime: missing axes are ignored, never counted as support", () => {
  const st = mkStats({ VIX: { last: 32 } });
  delete (st as Record<string, unknown>).HYOAS;
  const axes = classifyAxes(st);
  assert.ok(axes.find((a) => a.id === "credit")!.missing);
  assert.ok(!classifyRegime(axes).support.some((s) => s.includes("credit")));
});

test("headline direction", () => {
  assert.equal(headlineDirection(["Consumer inflation rose faster than expected in September"]).dir, "HAWKISH");
  assert.equal(headlineDirection(["Inflation cools more than expected; rate cuts back in play"]).dir, "DOVISH");
  assert.equal(headlineDirection(["Bloom Energy Stock Slides Amid High Oil Prices"]).dir, "UNKNOWN");
});

const mkBars = (base: number, after: number, t0 = "2026-10-14T12:00:00.000Z", t1 = "2026-10-14T16:00:00.000Z"): Obs[] => [{ t: t0, v: base }, { t: t1, v: after }];

test("confirmation: hawkish CPI with yields up, USD up, gold/SPY/BTC down → CONFIRMED", () => {
  const intr = { ZT: mkBars(102, 101.8), DXY: mkBars(100, 100.5), GOLD: mkBars(4000, 3950), SPY: mkBars(700, 690), BTC: mkBars(80000, 78000), UST10Y_MKT: mkBars(5, 5.08) };
  const c = confirmReaction(["CPI rose faster than expected"], "2026-10-14T12:30:00.000Z", intr, 6, new Date("2026-10-15T00:00:00Z"));
  assert.equal(c.verdict, "CONFIRMED");
  assert.equal(c.moves.filter((m) => m.result === "CONSISTENT").length, 6);
});

test("confirmation: market moves the other way → NOT_CONFIRMED; flat → UNCLEAR", () => {
  const opp = { ZT: mkBars(102, 102.3), DXY: mkBars(100, 99.5), GOLD: mkBars(4000, 4060), SPY: mkBars(700, 705), BTC: mkBars(80000, 80100) };
  assert.equal(confirmReaction(["CPI rose faster than expected"], "2026-10-14T12:30:00.000Z", opp, 6, new Date("2026-10-15T00:00:00Z")).verdict, "NOT_CONFIRMED");
  const flat = { ZT: mkBars(102, 102), DXY: mkBars(100, 100.05), GOLD: mkBars(4000, 4001), SPY: mkBars(700, 700.5) };
  assert.equal(confirmReaction(["CPI rose faster than expected"], "2026-10-14T12:30:00.000Z", flat, 6, new Date("2026-10-15T00:00:00Z")).verdict, "UNCLEAR");
});

test("confirmation on real 2026-10-14 CPI intraday bars: mixed reaction (yields fell, SPY/BTC fell) → UNCLEAR", () => {
  const intr = JSON.parse(fx("intraday-2026-10-14.json")) as Record<string, Obs[]>;
  const c = confirmReaction(["Consumer inflation rose faster than expected in September, CPI report shows"], "2026-10-14T12:33:00.000Z", intr, 6, new Date("2026-10-15T01:00:00Z"));
  assert.equal(c.direction, "HAWKISH");
  assert.equal(c.verdict, "UNCLEAR");
  assert.equal(c.moves.find((m) => m.series === "SPY")!.result, "CONSISTENT");
  assert.equal(c.moves.find((m) => m.series === "ZT")!.result, "INCONSISTENT");
});

test("risk: event within 48h forces NO_TRADE and links verbatim knowledge", () => {
  const reg = classifyRegime(classifyAxes(mkStats({ VIX: { last: 13 }, SPY: { last: 110, ma50: 100, chg20: 4 }, NFCI: { last: -0.5 }, UST2Y: { last: 4 }, FEDFUNDS: { last: 4 } })));
  const cal = [{ kind: "PPI" as const, title: "PPI", date: "2026-10-15", timeEt: "08:30", source: "x" }, { kind: "FOMC" as const, title: "FOMC", date: "2026-10-28", timeEt: "14:00", source: "x" }];
  const now = new Date("2026-10-15T01:00:00Z");
  assert.equal(eventUtcMs(cal[0]!), Date.parse("2026-10-15T12:30:00Z"));
  assert.deepEqual(upcomingHighImpact(cal, now).map((e) => e.kind), ["PPI"]);
  const v = riskView(reg, [], cal, now);
  assert.equal(v.overall, "NO_TRADE");
  assert.ok(v.assets.every((a) => a.stance === "NO_TRADE"));
  const cat = JSON.parse(fx("../../knowledge/catalog.json")) as { items: Array<{ id: string; principle: string }> };
  const patience = v.knowledge.find((k) => k.id === "patience")!;
  assert.ok(patience.text.startsWith(cat.items.find((i) => i.id === "patience")!.principle));
  assert.ok(knowledgeRef("loss-aversion")!.text.includes("realizing a loss"));
  const calm = riskView(reg, [], [], now);
  assert.notEqual(calm.overall, "NO_TRADE");
});
