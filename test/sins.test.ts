import { test } from "node:test";
import assert from "node:assert/strict";
import { autoSins, sinsOf, sinCounts, topSin, entrySinWarnTags } from "../src/options/sins.ts";
import { weeklyReport } from "../src/options/weekly.ts";
import { readiness } from "../src/options/readiness.ts";
import { renderReview } from "../src/options/reviewreport.ts";
import { paperOpen, type PaperJournal } from "../src/options/paper.ts";
import type { JournalEntry } from "../src/options/journal.ts";

const T = (o: Partial<JournalEntry>): JournalEntry => ({ id: "x", symbol: "NVDA", strategy: "call_debit_spread", mode: "paper", kind: "practice", source: "real_practice", openedAt: "2026-10-15T15:00:00Z", maxLoss: 20, legs: [], ...o } as JournalEntry);
const leg = (strike: number, qty: number, premium: number, expiration: string) => ({ type: "call" as const, strike, qty, premium, expiration });
const ids = (e: JournalEntry, all: JournalEntry[]) => autoSins(e, all).map((s) => s.sin);

test("sloth: no pre-written plan; mentor shadow never tagged", () => {
  const a = T({ id: "a", violations: ["no_pre_written_plan"] });
  assert.deepEqual(ids(a, [a]), ["sloth"]);
  const m = T({ id: "m", source: "mentor_shadow", violations: ["no_pre_written_plan", "exceeds_1pct_cap"] });
  assert.deepEqual(autoSins(m, [m]), []); assert.deepEqual(sinsOf(m, [m]), []);
});
test("greed: cheap short-dated lottery (< $0.25, ≤7 DTE) only; tp hit then loss", () => {
  const cheap = T({ id: "c", entryPrice: 0.14, legs: [leg(220, 1, 0.14, "2026-10-16")] });
  assert.ok(ids(cheap, [cheap]).includes("greed"));
  assert.ok(!ids(T({ id: "d", entryPrice: 0.14, legs: [leg(220, 1, 0.14, "2026-11-20")] }), []).includes("greed"), "long-dated is not lottery");
  assert.ok(!ids(T({ id: "e", entryPrice: 0.4, legs: [leg(220, 1, 0.4, "2026-10-16")] }), []).includes("greed"));
  assert.ok(ids(T({ id: "f", legs: [leg(225, 1, 0.31, "2026-10-16"), leg(227.5, -1, 0.12, "2026-10-16")] }), []).includes("greed"), "net debit from legs when entryPrice missing");
  const gave = T({ id: "g", entryPrice: 2, legs: [leg(220, 1, 2, "2026-11-20")], tpHits: [50], closedAt: "2026-10-20T19:00:00Z", pnl: -30 });
  assert.match(autoSins(gave, [gave]).find((s) => s.sin === "greed")!.reason, /止盈提醒已触发/);
});
test("wrath: same-day loss then quick / same-symbol / bigger / after daily cap; not before the loss, not next day, not after a win", () => {
  const loss = T({ id: "L", symbol: "AAPL", openedAt: "2026-10-15T14:00:00Z", closedAt: "2026-10-15T19:12:00Z", pnl: -31, maxLoss: 30 });
  const quick = T({ id: "q", symbol: "IWM", openedAt: "2026-10-15T19:27:00Z" });
  const late = T({ id: "l", symbol: "IWM", openedAt: "2026-10-15T20:40:00Z", maxLoss: 10 });
  const same = T({ id: "s", symbol: "AAPL", openedAt: "2026-10-15T20:40:00Z", maxLoss: 10 });
  const bigger = T({ id: "b", symbol: "QQQ", openedAt: "2026-10-15T20:40:00Z", maxLoss: 60 });
  const before = T({ id: "p", symbol: "IWM", openedAt: "2026-10-15T19:00:00Z" });
  const next = T({ id: "n", symbol: "IWM", openedAt: "2026-10-16T13:40:00Z" });
  const all = [loss, quick, late, same, bigger, before, next];
  assert.ok(ids(quick, all).includes("wrath")); assert.ok(!ids(late, all).includes("wrath"), "2.5h later, other symbol, smaller: no");
  assert.match(autoSins(same, all).find((s) => s.sin === "wrath")!.reason, /同一标的 AAPL/);
  assert.match(autoSins(bigger, all).find((s) => s.sin === "wrath")!.reason, /仓位变大/);
  assert.ok(!ids(before, all).includes("wrath")); assert.ok(!ids(next, all).includes("wrath"));
  const win = T({ id: "w", closedAt: "2026-10-15T19:12:00Z", pnl: 20 });
  assert.ok(!ids(T({ id: "z", openedAt: "2026-10-15T19:20:00Z" }), [win]).includes("wrath"));
  const big = T({ id: "B", symbol: "SPY", source: "paper_sim", closedAt: "2026-10-15T16:00:00Z", pnl: -120 });
  const after = T({ id: "A", symbol: "QQQ", openedAt: "2026-10-15T19:00:00Z", maxLoss: 10 });
  assert.match(autoSins(after, [big, after]).find((s) => s.sin === "wrath")!.reason, /超日亏上限/);
  // real_practice losses never count toward the $5k sim daily cap (DECISIONS 2026-10-17); the own-loss-then-quick-open part still applies to them
  const realBig = T({ ...big, source: "real_practice" }), a3 = T({ id: "A3", symbol: "QQQ", openedAt: "2026-10-15T19:00:00Z", maxLoss: 10 });
  assert.ok(!autoSins(a3, [realBig, a3]).find((s) => s.sin === "wrath")?.reason.includes("超日亏上限"));
  // DECISIONS 2026-10-17: mentor_shadow losses COUNT toward the daily cap → opening after a shadow-driven breach is 暴怒
  assert.match(autoSins(T({ id: "mm", openedAt: "2026-10-15T19:20:00Z" }), [T({ ...big, source: "mentor_shadow" })]).find((s) => s.sin === "wrath")!.reason, /超日亏上限 \$100/);
  assert.ok(!ids(T({ id: "m2", openedAt: "2026-10-15T19:20:00Z" }), [T({ ...big, pnl: -60, source: "mentor_shadow" })]).includes("wrath"), "a shadow loss under the cap is not a reason by itself (it is not your own loss)");
});
test("gluttony: 4th+ own open of the ET day; lust: over cap", () => {
  const xs = [0, 1, 2, 3].map((k) => T({ id: `o${k}`, symbol: `S${k}`, openedAt: `2026-10-15T1${5 + k}:00:00Z` }));
  assert.deepEqual(xs.map((e) => ids(e, xs).includes("gluttony")), [false, false, false, true]);
  const m = T({ id: "m", source: "mentor_shadow", openedAt: "2026-10-15T13:00:00Z" });
  assert.ok(!ids(xs[2]!, [m, ...xs]).includes("gluttony"), "mentor opens don't count");
  assert.ok(ids(T({ id: "c", violations: ["exceeds_1pct_cap"] }), []).includes("lust"));
});
test("manual tags win; --remove rejects an auto candidate", () => {
  const e = T({ id: "a", violations: ["no_pre_written_plan"], closedAt: "2026-10-15T19:00:00Z", pnl: -5,
    behaviorSins: [{ sin: "pride", by: "manual", reason: "怪做市商" }, { sin: "sloth", by: "manual", reason: "复盘确认不是", removed: true }] });
  assert.deepEqual(sinsOf(e, [e]).map((s) => [s.sin, s.by]), [["pride", "manual"]]);
  const r = sinCounts([e], "2026-10-15", "2026-10-15");
  assert.equal(r.find((x) => x.sin === "pride")!.manual, 1); assert.equal(r.find((x) => x.sin === "sloth")!.total, 0);
});
test("weekly: 七宗罪 section, counts per sin, most frequent = next month's focus; daily card shows sins", () => {
  const E = [T({ id: "a", closedAt: "2026-10-15T19:00:00Z", pnl: -5, violations: ["no_pre_written_plan"] }),
    T({ id: "b", openedAt: "2026-10-14T15:00:00Z", closedAt: "2026-10-15T19:00:00Z", pnl: -5, violations: ["no_pre_written_plan"], entryPrice: 0.1, legs: [leg(1, 1, 0.1, "2026-10-16")] })];
  const w = weeklyReport({ entries: E, capital: 5000, from: "2026-10-09", to: "2026-10-15", readiness: readiness({ journal: E, capital: 5000, shockDates: [] }) });
  assert.match(w.md, /八之三、七宗罪/); assert.equal(w.sinTop!.sin, "sloth"); assert.equal(w.sinTop!.total, 2);
  assert.match(w.md, /下个月重点：懒惰（sloth）/); assert.match(w.md, /\| 贪婪 greed \| 1（1\/0） \| 1 \|/);
  assert.equal(topSin(sinCounts([], "2026-10-01", "2026-10-15")), null);
  assert.match(renderReview(E, 5000, "2026-10-15", "2026-10-15"), /七宗罪：懒惰（自动候选）/);
});
test("practice open: wrath / gluttony / lottery become warn_sin_* tags (never a block)", () => {
  const now = new Date("2026-10-15T19:20:00Z");
  const prior = T({ id: "L", source: "paper_sim", symbol: "INTC", openedAt: "2026-10-15T14:00:00Z", closedAt: "2026-10-15T19:10:00Z", pnl: -20 });
  const j: PaperJournal = { capital: 5000, entries: [prior] };
  const p = { symbol: "INTC", strategy: "long_put", asOf: "2026-10-15", underlyingPrice: 32, thesisHorizonDays: 20, capital: 5000, buyingPower: 20000,
    legs: [{ type: "put", strike: 30, qty: 1, premium: 0.2, expiration: "2026-10-16", openInterest: 5000, bid: 0.19, ask: 0.21 }],
    discipline: { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" }, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, plannedMaxLoss: 20, entryRange: { low: 31, high: 33 }, side: "short" } } as never;
  const CARD = { id: "card-1", sym: "INTC", dir: "bear" as const, thesis: "capex slowdown", trade: { mechanical: "30/30", invalidationLevel: 35, tpKind: "short_dated" } };
  const r = paperOpen(j, p, { now, kind: "practice", card: CARD, critique: { at: "x", objections: [], blocks: 0, warns: 0 } });
  assert.ok(r.entry, r.refused.join("|"));
  for (const t of ["warn_sin_wrath", "warn_sin_greed"]) assert.ok(r.entry!.warnTags!.includes(t), `${t} in ${r.entry!.warnTags}`);
  assert.ok(r.entry!.warnDetails!.some((d) => /七宗罪·暴怒/.test(d)));
  assert.deepEqual(entrySinWarnTags(T({ id: "q" }), []).tags, []);
});
