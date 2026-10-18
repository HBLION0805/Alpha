import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../src/options/payoff.ts";
import { paperMark, paperOpen, isHardRefusal, type PaperJournal } from "../src/options/paper.ts";
import { expireEntry } from "../src/options/expire.ts";
import { costBasis } from "../src/options/tpplan.ts";
import { normalizedLegs, normalizeJournalLegs, countsTowardDailyCap, type JournalEntry } from "../src/options/journal.ts";
import { capFlags } from "../src/options/breach.ts";
import { dailyBudget } from "../src/review/card.ts";
import { selectReminders } from "../src/review/mentor.ts";
import { readiness } from "../src/options/readiness.ts";
import { autoSins } from "../src/options/sins.ts";

// covered call: +100 XYZ @ 50.00, −1 XYZ 55C 2026-11-20 @ 1.20
const CC = [{ type: "stock" as const, strike: 50, qty: 100, premium: 50 }, { type: "call" as const, strike: 55, qty: -1, premium: 1.2, expiration: "2026-11-20" }];
const E = (o: Partial<JournalEntry>): JournalEntry => ({ id: "T", symbol: "XYZ", strategy: "covered_call", mode: "paper", kind: "practice", source: "paper_sim", openedAt: "2026-10-16T15:00:00Z", maxLoss: 50, underlyingAtEntry: 50, legs: CC, ...o } as JournalEntry);
const src = (S: number, callMark?: number) => ({ spot: async () => S, chains: callMark == null ? [] : [{ symbol: "XYZ", underlyingPrice: S, asOf: "", source: "t", contracts: [{ type: "call", strike: 55, expiration: "2026-11-20", mark: callMark, bid: null, ask: null, iv: null, delta: null, gamma: null, theta: null, vega: null }] }] }) as never;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.011, `${a} ≠ ${b}`);

test("covered call payoff: stock ×1, option ×100, max loss includes the stock going to 0", () => {
  const a = analyze(CC);
  assert.equal(a.netDebit, 4880);            // 100×50 − 1×1.20×100
  assert.equal(a.maxLoss, -4880);            // S=0: 100×(0−50) + 120
  assert.equal(a.maxGain, 620);              // S≥55: 100×5 + 120
  assert.deepEqual(a.breakevens, [48.8]);    // 50 − 1.20
  assert.equal(a.unboundedUp, false);
  assert.equal(costBasis(CC), 4880);
});
test("covered call mark / expiry: hand-computed values", async () => {
  const m = await paperMark(E({}), src(52, 0.8), new Date("2026-10-19T20:00:00Z"));
  assert.equal(m.value, 5120);               // 100×52 − 1×0.80×100
  assert.equal(m.pnl, 240);                  // 5120 − 4880 = 100×(52−50) + 100×(1.20−0.80)
  assert.equal(m.estimated, false);
  const up = expireEntry(E({}), { XYZ: 57 }, new Date("2026-11-20T21:30:00Z")).entry!;
  assert.equal(up.pnl, 620); assert.equal(up.settlement!.value, 5500); // 5700 − 200
  const down = expireEntry(E({}), { XYZ: 40 }, new Date("2026-11-20T21:30:00Z")).entry!;
  assert.equal(down.pnl, -880);              // 100×(40−50) + 120: stock downside, call expires worthless
});
test("sign: short stock leg loses when price rises (qty × (S − entry), multiplier 1)", async () => {
  const m = await paperMark(E({ legs: [{ type: "stock", strike: 50, qty: -100, premium: 50 }] }), src(52), new Date("2026-10-19T20:00:00Z"));
  assert.equal(m.value, -5200); assert.equal(m.pnl, -200);
});
test("BUG: stock leg logged as { qty, price } (BAC 10/16) was 'entry price unknown' / NaN — now valued at qty × price", async () => {
  const bac = E({ id: "bac", symbol: "BAC", strategy: "long_stock", entryPrice: 52.16, legs: [{ underlying: "BAC", type: "stock", qty: 75, price: 52.16 } as never] });
  const m = await paperMark(bac, src(51.225), new Date("2026-10-16T20:05:00Z"));
  close(m.value, 3841.88);                   // 75 × 51.225
  close(m.pnl, -70.13);                      // 75 × (51.225 − 52.16) = −70.125 (the close-price figure in the BAC exit note)
  assert.deepEqual(m.sources, ["BAC stock yahoo"]);
  const n = normalizedLegs(bac); assert.equal(n[0]!.premium, 52.16); assert.equal(n[0]!.strike, 52.16);
  assert.equal(analyze(n).maxLoss, -3912);   // 75 × 52.16 (stock to 0)
  close(costBasis(n)!, 3912);
  const j = [bac, E({ id: "opt" })]; assert.deepEqual(normalizeJournalLegs(j), ["bac"]); assert.deepEqual(normalizeJournalLegs(j), [], "idempotent");
  // price missing → entryPrice, but only for an all-stock entry (a combo's entryPrice is the net debit)
  assert.equal(normalizedLegs({ entryPrice: 52.16, legs: [{ type: "stock", qty: 75 } as never] })[0]!.premium, 52.16);
  assert.ok(!Number.isFinite(normalizedLegs({ entryPrice: 1.2, legs: [{ type: "stock", qty: 100 } as never, CC[1]!] })[0]!.premium));
  await assert.rejects(paperMark(E({ legs: [{ type: "stock", qty: 100 } as never] }), src(50), new Date()), /entry price unknown/);
});
test("covered call through practice paperOpen: stored max loss = $4,880 incl. stock downside (warn_over_cap), not hard-refused", () => {
  const j: PaperJournal = { capital: 5000, entries: [] }, now = new Date("2026-10-16T15:00:00Z");
  const p = { symbol: "XYZ", strategy: "covered_call", asOf: "2026-10-16", underlyingPrice: 50, thesisHorizonDays: 20, capital: 5000, buyingPower: 10000,
    legs: [{ type: "stock", strike: 50, qty: 100, premium: 50 }, { type: "call", strike: 55, qty: -1, premium: 1.2, expiration: "2026-11-20", openInterest: 5000, bid: 1.15, ask: 1.25 }],
    discipline: { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" }, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, plannedMaxLoss: 50, entryRange: { low: 49, high: 51 }, side: "long" } } as never;
  const card = { id: "card-cc", sym: "XYZ", dir: "bull" as const, thesis: "range", trade: { mechanical: "收盘跌破 46.5", invalidationLevel: 46.5, tpKind: "narrative" } };
  const r = paperOpen(j, p, { now, kind: "practice", card, critique: { at: "x", objections: [], blocks: 0, warns: 0 } });
  assert.ok(r.entry, r.refused.join(" | "));
  assert.equal(r.entry!.maxLoss, 4880); assert.ok(r.entry!.warnTags!.includes("warn_over_cap"));
  assert.equal(r.entry!.legs![0]!.premium, 50); assert.equal(r.entry!.legs![1]!.premium, 1.2);
});
test("false hard-refuse: checklist text containing 'maxLoss' is a warn, only an undefined max loss is hard", () => {
  assert.equal(isHardRefusal("BLOCK multileg_checklist: multi-leg checklist incomplete: maxLoss, maxProfit, breakevens"), false);
  assert.equal(isHardRefusal("期权结构最大亏损未定义 → 只做定义风险"), true);
  assert.equal(isHardRefusal("--kind foo 无效：formal | practice"), true);
  const j: PaperJournal = { capital: 5000, entries: [] }, now = new Date("2026-10-15T14:00:00Z");
  const spread = { symbol: "INTC", strategy: "put_debit_spread", asOf: "2026-10-15", underlyingPrice: 32, thesisHorizonDays: 20, capital: 5000, buyingPower: 20000,
    legs: [{ type: "put", strike: 31, qty: 1, premium: 0.8, expiration: "2026-12-18", openInterest: 5000, bid: 0.78, ask: 0.82 }, { type: "put", strike: 30, qty: -1, premium: 0.45, expiration: "2026-12-18", openInterest: 5000, bid: 0.44, ask: 0.46 }],
    discipline: { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" }, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, plannedMaxLoss: 50, entryRange: { low: 31, high: 33 }, side: "short" } } as never;
  const card = { id: "card-2", sym: "INTC", dir: "bear" as const, thesis: "capex slowdown", trade: { mechanical: "30/30", invalidationLevel: 35, tpKind: "narrative" } };
  const r = paperOpen(j, spread, { now, kind: "practice", card, critique: { at: "x", objections: [], blocks: 0, warns: 0 } });
  assert.ok(r.entry, `was hard-refused: ${r.refused.join(" | ")}`);
  assert.ok(r.entry!.warnDetails!.some((x) => /multileg_checklist/.test(x)), "checklist gap is recorded as a warn");
  assert.equal(r.entry!.maxLoss, 35);        // (0.80 − 0.45) × 100
});

// ---------- mentor_shadow counts toward the $100/day cap (DECISIONS 2026-10-17) ----------
const M = (o: Partial<JournalEntry>) => E({ strategy: "call_debit_spread", legs: [], ...o });
test("daily cap: mentor_shadow losses count (live 🚨, plan-card budget, brief 暴怒/今天结束, readiness day check); real_practice does not", () => {
  const now = new Date("2026-10-15T20:30:00Z");
  const sh = M({ id: "m1", source: "mentor_shadow", closedAt: "2026-10-15T19:00:00Z", pnl: -60 });
  const sh2 = M({ id: "m2", source: "mentor_shadow", closedAt: "2026-10-15T19:30:00Z", pnl: -50 });
  assert.ok(countsTowardDailyCap(sh) && !countsTowardDailyCap(M({ source: "real_practice" })));
  assert.ok(capFlags([sh, sh2], 5000, now).some((x) => /日亏上限/.test(x)), "−$110 > $100");
  assert.ok(!capFlags([sh, M({ ...sh2, source: "real_practice" })], 5000, now).some((x) => /日亏上限/.test(x)));
  assert.deepEqual(dailyBudget([sh, sh2], 5000, now), { used: 110, remaining: 0 });
  const rem = selectReminders({ now: new Date("2026-10-16T11:30:00Z"), verdict: "RESEARCH_OK", leader: "base", previousLeader: "base", regime: "MIXED", previousRegime: "MIXED", events: [], journal: [sh, sh2], capital: 5000 });
  assert.match(rem.find((r) => r.id === "wrath_stop")!.why, /2026-10-15 已实现 \$-110，触发日亏上限 \$100/);
  // readiness: shadow losses add to a formal day's loss (formal −$40 + shadow −$110 = −$150 > $100) but are not readiness trades
  const f = M({ id: "f1", kind: "formal", source: "paper_sim", closedAt: "2026-10-15T18:00:00Z", pnl: -40, commissions: 0 });
  const rd = readiness({ journal: [f, sh, sh2], capital: 5000, shockDates: [] }), lc = rd.criteria.find((c) => c.id === "loss_caps")!;
  assert.ok(lc.missing.some((x) => /2026-10-15 单日亏 \$150/.test(x)), lc.missing.join("|"));
  assert.match(rd.criteria.find((c) => c.id === "sample")!.detail[0]!, /正式模拟交易 1 笔/);
  // 暴怒 tag: own open after the shadow-driven breach
  const after = M({ id: "o", source: "paper_sim", openedAt: "2026-10-15T19:45:00Z" });
  assert.match(autoSins(after, [sh, sh2, after]).find((s) => s.sin === "wrath")!.reason, /含大佬影子单/);
});

// ---------- 2026-10-17 follow-up: real_practice out of every daily-loss consumer; covered-call stock stop ----------
test("daily cap: real_practice losses count nowhere (alert, budget, brief, pretrade, wrath, readiness)", async () => {
  const { dailyLossCheck } = await import("../src/options/discipline.ts");
  const now = new Date("2026-10-15T20:30:00Z");
  const real = M({ id: "r1", source: "real_practice", closedAt: "2026-10-15T18:00:00Z", pnl: -150 });
  const sim = M({ id: "s1", source: "paper_sim", closedAt: "2026-10-15T18:30:00Z", pnl: -60 });
  assert.ok(!capFlags([real, sim], 5000, now).some((x) => /日亏上限/.test(x)));
  assert.deepEqual(dailyBudget([real, sim], 5000, now), { used: 60, remaining: 40 });
  assert.ok(!selectReminders({ now: new Date("2026-10-16T11:30:00Z"), verdict: "RESEARCH_OK", leader: "base", previousLeader: "base", regime: "MIXED", previousRegime: "MIXED", events: [], journal: [real, sim], capital: 5000 }).some((r) => r.id === "wrath_stop"));
  const log = [real, sim].map((e) => ({ id: e.id, openedAt: e.openedAt, closedAt: e.closedAt, pnl: e.pnl, source: e.source }));
  assert.equal(dailyLossCheck(log, "2026-10-15", 5000, 0, 2).severity, "OK");
  assert.equal(dailyLossCheck([...log, { ...log[1]!, id: "s2", pnl: -50 }], "2026-10-15", 5000, 0, 2).severity, "BLOCK", "sim −$110 still blocks");
  const after = M({ id: "o", source: "paper_sim", openedAt: "2026-10-15T19:45:00Z" });
  assert.ok(!(autoSins(after, [real, after]).find((s) => s.sin === "wrath")?.reason ?? "").includes("超日亏上限"));
  const f = M({ id: "f1", kind: "formal", source: "paper_sim", closedAt: "2026-10-15T17:00:00Z", pnl: -40, commissions: 0 });
  assert.ok(!readiness({ journal: [f, real], capital: 5000, shockDates: [] }).criteria.find((c) => c.id === "loss_caps")!.missing.some((x) => /单日亏/.test(x)));
});
test("covered call risk plan: stock stop −7% on the stock leg + 30/30, max loss still stock-to-zero; first trigger applies", async () => {
  const { buildRiskPlan, renderRiskPlan, stopHits } = await import("../src/options/riskplan.ts");
  const r = buildRiskPlan(CC, { hedge: "direct", hedgeDetail: "x", invalidation: "x", capital: 5000, asOf: "2026-10-16" });
  const p = r.draft!;
  assert.equal(p.maxLoss, 4880);
  assert.deepEqual(p.stock, { entry: 50, stopPct: 7, side: "long", stopPrice: 46.5 });  // 50 × 0.93
  assert.deepEqual(p.option, { entryValue: 4880, dteAtEntry: 35, rule3030Date: "2026-10-27", loss30Value: 3416, loss30Pnl: -1464 });
  const txt = renderRiskPlan(p); assert.match(txt, /股票腿机械止损 −7% → 46.5/); assert.match(txt, /30\/30 参考：2026-10-27/); assert.match(txt, /先触发的执行/);
  assert.deepEqual(stopHits(p, { value: 4700, spot: 47 }, "2026-10-20"), []);
  assert.match(stopHits(p, { value: 4560, spot: 46.4 }, "2026-10-20")[0]!, /股票机械止损触发：现价 46.4 ≤ 46.5/);   // stock stop first (100×46.4 − ~80)
  assert.match(stopHits(p, { value: 4900, spot: 50 }, "2026-10-27")[0]!, /30\/30 时间到/);
  assert.equal(buildRiskPlan(CC, { hedge: "direct", hedgeDetail: "x", invalidation: "x", capital: 5000, asOf: "2026-10-16", stopPct: 5 }).draft!.stock!.stopPrice, 47.5);
  // options-only structures get no stock block; stock-only plans unchanged
  assert.equal(buildRiskPlan([CC[1]!, { type: "call", strike: 50, qty: 1, premium: 2.5, expiration: "2026-11-20" }], { hedge: "built_in_spread", hedgeDetail: "x", invalidation: "x", capital: 5000, asOf: "2026-10-16" }).draft!.stock, undefined);
  assert.equal(buildRiskPlan([CC[0]!], { hedge: "direct", hedgeDetail: "x", invalidation: "x", capital: 50000, asOf: "2026-10-16" }).plan!.stock!.stopPrice, 46.5);
  // practice open: exit plan lists both
  const j: PaperJournal = { capital: 5000, entries: [] };
  const prop = { symbol: "XYZ", strategy: "covered_call", asOf: "2026-10-16", underlyingPrice: 50, thesisHorizonDays: 20, capital: 5000, buyingPower: 10000,
    legs: [{ type: "stock", strike: 50, qty: 100, premium: 50 }, { type: "call", strike: 55, qty: -1, premium: 1.2, expiration: "2026-11-20", openInterest: 5000, bid: 1.15, ask: 1.25 }],
    discipline: { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" }, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, plannedMaxLoss: 50, entryRange: { low: 49, high: 51 }, side: "long" } } as never;
  const e = paperOpen(j, prop, { now: new Date("2026-10-16T15:00:00Z"), kind: "practice", card: { id: "c", sym: "XYZ", dir: "bull", thesis: "t", trade: { mechanical: "m", invalidationLevel: 46.5, tpKind: "narrative" } }, critique: { at: "x", objections: [], blocks: 0, warns: 0 } }).entry!;
  assert.ok(e.exitRules.some((x) => /mechanical stop 46.5 \(−7% on the stock leg; with 30\/30 below, first to trigger applies\)/.test(x)), e.exitRules.join(" | "));
  assert.ok(e.exitRules.some((x) => /^30\/30: 2026-10-27/.test(x)));
  assert.equal(e.riskPlan!.maxLoss, 4880);
});
