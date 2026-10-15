import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { bs, impliedVol, expectedMove, normCdf } from "../src/options/bs.ts";
import { parseChain, fillGreeks, summarizeExpiry, termStructure, constantMaturityIv } from "../src/options/chain.ts";
import { ivEnvironment, initIv, saveIv, loadIv, realizedVol } from "../src/options/ivhistory.ts";
import { selectStrategies, FORBIDDEN, type Direction } from "../src/options/matrix.ts";
import { analyze, build, analyzeTimeSpread, isDefinedRisk, nakedShorts } from "../src/options/payoff.ts";
import { checkBook, stressTest, DEFAULT_RULES, type Book } from "../src/options/rules.ts";
import { preTradeChecks, type Proposal } from "../src/options/pretrade.ts";
import { validateEntry, strategyStats, fullPnl, journalHealth, type JournalEntry } from "../src/options/journal.ts";
import { impliedEventMove, historicalEventMoves, compareEvent, parseEarnings } from "../src/options/events.ts";
import { buildDashboard } from "../src/options/dashboard.ts";
import { parseBars } from "../src/levels.ts";
import { chainFromRobinhood } from "../src/options/robinhood.ts";

const j = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const chain = parseChain(j("./fixtures/spy-chain-robinhood-2026-10-14.json"));
const bars = parseBars(j("./fixtures/spy-daily-robinhood.json"));
const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b} (±${tol})`);

test("normCdf and put-call parity", () => {
  near(normCdf(0), 0.5, 1e-7); near(normCdf(1.96), 0.975, 1e-4);
  const i = { S: 100, K: 100, T: 0.5, sigma: 0.2, r: 0.04, q: 0.01 };
  const c = bs({ ...i, right: "call" }).price, p = bs({ ...i, right: "put" }).price;
  near(c - p, 100 * Math.exp(-0.01 * 0.5) - 100 * Math.exp(-0.04 * 0.5), 1e-6);
});
test("Black-Scholes textbook value (Hull: S=42 K=40 r=10% σ=20% T=0.5 → call 4.76)", () => {
  near(bs({ S: 42, K: 40, T: 0.5, sigma: 0.2, r: 0.1, q: 0, right: "call" }).price, 4.76, 0.01);
  near(bs({ S: 42, K: 40, T: 0.5, sigma: 0.2, r: 0.1, q: 0, right: "put" }).price, 0.81, 0.01);
});
test("impliedVol round-trips", () => {
  const px = bs({ S: 770, K: 790, T: 0.1, sigma: 0.15, right: "call" }).price;
  near(impliedVol(px, { S: 770, K: 790, T: 0.1, right: "call" })!, 0.15, 1e-4);
});
test("BS greeks close to Robinhood's on the real SPY ATM contract", () => {
  const c = chain.contracts.find((x) => x.expiration === "2026-11-20" && x.strike === 770 && x.type === "call")!;
  const g = bs({ S: chain.underlyingPrice, K: 770, T: (Date.parse("2026-11-20T20:00:00Z") - Date.parse(chain.asOf)) / (365 * 864e5), sigma: c.iv!, right: "call" });
  near(g.delta, c.delta!, 0.05); near(g.vega, c.vega!, 0.1); near(g.price, c.mark!, 1.0);
});
test("fillGreeks fills only null greeks (810C on 10-23) and keeps Robinhood values", () => {
  const f = fillGreeks(chain);
  const filled = f.contracts.filter((c) => c.greeksSource === "black_scholes");
  assert.equal(filled.length, 1); assert.equal(filled[0]!.strike, 810);
  assert.ok(filled[0]!.delta! > 0 && filled[0]!.delta! < 0.05);
  const atm = f.contracts.find((c) => c.strike === 770 && c.type === "call" && c.expiration === "2026-11-20")!;
  assert.equal(atm.delta, 0.542876);
});
test("expected move = P·IV·√(d/365) and straddle ≈ 0.8·EM on the real chain", () => {
  near(expectedMove(100, 0.2, 365), 20, 1e-9);
  const s = summarizeExpiry(fillGreeks(chain), "2026-11-20");
  assert.equal(s.atmStrike, 770);
  near(s.straddle! / 0.8, s.expectedMove!, s.expectedMove! * 0.05);
  assert.ok(s.skew25! > 0, "SPY put skew positive");
});
test("term structure + constant-maturity IV", () => {
  const f = fillGreeks(chain); const sums = ["2026-10-23", "2026-11-20"].map((e) => summarizeExpiry(f, e));
  assert.equal(termStructure(sums).shape, "CONTANGO");
  const inv = termStructure([{ ...sums[0]!, atmIv: 0.3 }, sums[1]!]); assert.equal(inv.shape, "INVERTED");
  const iv30 = constantMaturityIv(sums)!; assert.ok(iv30 > sums[0]!.atmIv! && iv30 < sums[1]!.atmIv!);
});
test("IV rank / percentile, 14.3 conflict rule, VIX proxy", () => {
  const h = Array.from({ length: 100 }, (_, i) => 0.1 + i * 0.002); // 0.10..0.298
  const e = ivEnvironment(h, 0.25);
  assert.equal(e.ivRank, 76); assert.equal(e.level, "HIGH");
  assert.equal(ivEnvironment(h, 0.25, undefined, 0.3).level, "MID", "IV rank high but implied < realized → not seller env");
  assert.equal(ivEnvironment(h, 0.11).level, "LOW");
  assert.equal(ivEnvironment([], 0.2, { vix: 25 }).level, "HIGH");
  assert.equal(ivEnvironment([], 0.2).level, "UNKNOWN");
  const db = new DatabaseSync(":memory:"); initIv(db);
  saveIv(db, { symbol: "SPY", date: "2026-10-14", iv30: 0.136, frontIv: 0.12, backIv: 0.14, skew25: 4, source: "t" });
  saveIv(db, { symbol: "SPY", date: "2026-10-14", iv30: 0.14, frontIv: 0.12, backIv: 0.14, skew25: 4, source: "t" });
  assert.deepEqual(loadIv(db, "SPY"), [{ date: "2026-10-14", iv30: 0.14 }]);
  assert.ok(realizedVol(bars.map((b) => b.c))! > 0.03);
});
test("strategy matrix: course cells, never forbidden, CSP/CC optional, NO_TRADE cells, credit last", () => {
  for (const d of ["bull", "bear", "neutral", "big_move", "hedge"] as Direction[]) for (const iv of ["LOW", "MID", "HIGH"] as const) for (const ev of [true, false]) {
    const r = selectStrategies(d, iv, ev);
    assert.ok(r.candidates.length > 0);
    for (const c of r.candidates) { assert.ok(!(FORBIDDEN as readonly string[]).includes(c.structure)); assert.equal(c.definedRisk, true); }
    for (const c of r.candidates.filter((x) => /covered_call|cash_secured_put/.test(x.structure))) assert.equal(c.optional, true);
  }
  assert.equal(selectStrategies("neutral", "LOW", false).candidates[0]!.structure, "NO_TRADE");
  assert.ok(selectStrategies("big_move", "HIGH", false).noTrade);
  assert.equal(selectStrategies("bull", "MID", false).candidates[0]!.structure, "bull_call_debit_spread");
  const hi = selectStrategies("bull", "HIGH", false).candidates;
  assert.ok(hi.findIndex((c) => c.structure === "bull_put_credit_spread") === hi.length - 1, "credit spread de-prioritised");
  assert.ok(selectStrategies("bull", "LOW", true).candidates.every((c) => /spread/.test(c.structure)), "event → spreads only");
  assert.ok(selectStrategies("anything" as never, "UNKNOWN", false).noTrade);
  assert.ok(selectStrategies("bull", "MID", false, { openInterest: 200, bidAskPct: 3 }).candidates.every((c) => /long_|NO_TRADE/.test(c.structure)));
});
test("payoff: iron condor / reverse IC / iron fly / butterfly", () => {
  const ic = analyze(build.ironCondor(730, 750, 790, 810, { pL: 4.04, pS: 6.81, cS: 4.905, cL: 1.02 }));
  near(ic.maxGain!, 665.5, 0.01); near(ic.maxLoss!, -1334.5, 0.01); assert.deepEqual(ic.breakevens, [743.35, 796.65]);
  const ric = analyze(build.reverseIronCondor(730, 750, 790, 810, { pL: 4.04, pS: 6.81, cS: 4.905, cL: 1.02 }));
  near(ric.maxLoss!, -665.5, 0.01); near(ric.maxGain!, 1334.5, 0.01);
  const ifly = analyze(build.ironFly(750, 770, 790, { pL: 6.81, pM: 12.29, cM: 14.605, cL: 4.905 }));
  near(ifly.maxGain!, 1518, 0.01); near(ifly.maxLoss!, -482, 0.01); assert.equal(ifly.breakevens.length, 2);
  const fly = analyze(build.callButterfly(750, 770, 790, { lo: 29.19, mid: 14.605, hi: 4.905 }));
  near(fly.maxLoss!, -488.5, 0.01); near(fly.maxGain!, 1511.5, 0.01); assert.deepEqual(fly.breakevens, [754.88, 785.12]);
});
test("payoff: collar, protective put, naked detection", () => {
  const col = analyze(build.collar(769.6, 730, 810, { put: 4.04, call: 1.02 }));
  near(col.maxLoss!, -(769.6 - 730 + 3.02) * 100, 0.01); near(col.maxGain!, (810 - 769.6 - 3.02) * 100, 0.01);
  const pp = analyze(build.protectivePut(769.6, 730, 4.04));
  near(pp.maxLoss!, -4364, 0.01); assert.equal(pp.maxGain, null); assert.deepEqual(pp.breakevens, [773.64]);
  assert.equal(isDefinedRisk([{ type: "put", strike: 750, qty: -1, premium: 6.81 }]), false, "naked put is not defined-risk for us");
  assert.equal(analyze([{ type: "call", strike: 790, qty: -1, premium: 4.9 }]).maxLoss, null);
  assert.deepEqual(nakedShorts(build.collar(100, 90, 110, { put: 1, call: 1 })), { calls: 0, puts: 0 });
});
test("payoff: calendar / PMCC valued at front expiry", () => {
  const cal = analyzeTimeSpread({ right: "call", frontStrike: 770, backStrike: 770, frontPremium: 5.835, backPremium: 14.605, backIv: 0.135, yearsLeftAtFront: 28 / 365 }, 769.6);
  near(cal.netDebit, 877, 0.01); assert.ok(cal.maxLoss! >= -877.01 && cal.maxLoss! < -800); assert.ok(cal.maxGain! > 0); assert.equal(cal.breakevens.length, 2);
  const pmcc = analyzeTimeSpread({ right: "call", frontStrike: 790, backStrike: 730, frontPremium: 0.285, backPremium: 46.395, backIv: 0.18, yearsLeftAtFront: 28 / 365 }, 769.6);
  assert.ok(pmcc.maxLoss! < 0 && pmcc.maxLoss! >= -4611.01); assert.ok(pmcc.maxGain! > 0);
});
const book: Book = j("../examples/options-book.json");
test("rule card defaults come from the course (13.2/13.3/13.4/D.2) and checks fire", () => {
  assert.equal(DEFAULT_RULES.creditTakeProfitPct, 50); assert.equal(DEFAULT_RULES.creditManageAtDte, 21); assert.equal(DEFAULT_RULES.creditStopMultipleOfCredit, 2);
  assert.equal(DEFAULT_RULES.stressIvX2MaxPct, 5); assert.equal(DEFAULT_RULES.minOpenInterest, 1000); assert.equal(DEFAULT_RULES.undefinedRiskSelling, false);
  const r = checkBook(book);
  assert.equal(r.checks.find((c) => c.rule === "concentration")!.ok, false);
  const naked = checkBook({ ...book, positions: [{ symbol: "SPY", strategy: "short_put", underlyingPrice: 769.6, legs: [{ type: "put", strike: 750, qty: -1, premium: 6.81, expiration: "2026-11-20", iv: 0.16 }] }] });
  assert.equal(naked.checks.find((c) => c.rule === "defined_risk")!.ok, false);
});
test("stress test: −20% & IV+30 / IV×2 / combined", () => {
  const st = stressTest(book);
  assert.ok(st.total.gapDown20 < 0 && st.total.both < 0);
  const bcs = st.rows.find((r) => r.id === "bcs1")!; assert.ok(bcs.gapDown20 >= -bcs.base - 1, "debit spread can't lose more than its value");
});
const hyg: Proposal = j("../examples/options-proposal-hyg-style.json");
const sev = (r: ReturnType<typeof preTradeChecks>, id: string) => r.checks.filter((c) => c.id === id).map((c) => c.severity);
test("pre-trade: HYG/TLT review lessons are enforced", () => {
  const r = preTradeChecks(hyg);
  assert.equal(r.blocked, true);
  assert.deepEqual(sev(r, "assignment_plan"), ["BLOCK"]);
  assert.deepEqual(sev(r, "assignment_buying_power"), ["BLOCK"]);
  assert.ok(sev(r, "near_atm_short").includes("BLOCK"));
  assert.equal(sev(r, "time_buffer")[0], "WARN");
  assert.ok(sev(r, "simultaneous_adverse").length === 1);
  assert.ok(r.checks.every((c) => c.cite.length > 0));
  assert.ok(r.checks.some((c) => /Robinhood/.test(c.detail)));
});
const DISC = { journal: [], openPnlToday: 0, session: { emotion: "ok", sleep: "ok", health: "ok", lifeEvents: "ok" } as const, market: { lowVolume: false, unclearDirection: false, chop: false, poorRR: false }, plannedMaxLoss: 900, entryRange: { low: 760, high: 775 }, side: "long" as const };
test("pre-trade: a far-OTM spread with a plan and enough buying power passes; adjustments need a new decision", () => {
  const ok: Proposal = { ...hyg, symbol: "SPY", strategy: "bull_put_credit_spread", underlyingPrice: 769.6, thesisHorizonDays: 14, buyingPower: 100000,
    legs: [{ type: "put", strike: 730, qty: -1, premium: 4.04, expiration: "2026-11-20", delta: -0.16 }, { type: "put", strike: 720, qty: 1, premium: 2.9, expiration: "2026-11-20", delta: -0.12 }],
    assignmentPlan: { ifAssigned: "close shares next open", protectiveLeg: "exercise/sell 720P same day", buyingPowerNeeded: 73000, exit: "close spread at 2x credit or 21 DTE" },
    checklist: { maxLoss: 886, maxProfit: 114, breakevens: [728.86], maxLossConditions: "SPY ≤ 720 at 2026-11-20 expiry", beforeExpiryPlan: "close at 21 DTE or 2x credit" },
    discipline: DISC };
  const r = preTradeChecks(ok); assert.equal(r.blocked, false, JSON.stringify(r.checks));
  assert.equal(preTradeChecks({ ...ok, adjustmentOf: "t1" }).blocked, true);
  assert.equal(preTradeChecks({ ...ok, adjustmentOf: "t1", newDecision: { thesis: "x", maxLoss: 500, exit: "y", invalidation: "z" } }).blocked, false);
  assert.equal(preTradeChecks({ ...ok, adjustmentOf: "t1", adjustmentCount: 2, newDecision: { thesis: "x", maxLoss: 500, exit: "y", invalidation: "z" } }).blocked, true);
  assert.equal(preTradeChecks({ ...ok, thesisHorizonDays: 60 }).blocked, true, "expiry shorter than the thesis");
});
test("journal: D.3 schema validation, full accounting, assigned follow-up separate, EV", () => {
  const es: JournalEntry[] = j("../examples/options-journal.json");
  assert.deepEqual(es.slice(0, 3).map((e) => validateEntry(e)), [[], [], []]);
  assert.ok(validateEntry(es[3]!).length >= 3);
  const e2 = es[1]!; near(fullPnl(e2), -1050 - 120 - 2.6 - 2.6, 1e-9);
  const withFollow = { ...e2, assignedFollowUp: { shares: 100, costBasis: 88, pnl: 2000 } };
  assert.equal(fullPnl(withFollow), fullPnl(e2), "later recovery of assigned shares never rewrites the trade");
  const st = strategyStats([es[0]!, withFollow, es[2]!]);
  assert.equal(st[0]!.strategy, "iron_condor"); assert.equal(st[0]!.assignedFollowUpPnl, 2000); assert.ok(st[0]!.expectancy < 0);
  assert.equal(journalHealth(es).compliancePct, 67);
});
test("events: variance split, historical moves, verdict, earnings parser", () => {
  const f = fillGreeks(chain); const a = summarizeExpiry(f, "2026-10-23"), b = summarizeExpiry(f, "2026-11-20");
  assert.equal(impliedEventMove(769.6, a, b), null, "front IV below back → no event premium");
  assert.ok(impliedEventMove(769.6, { ...a, atmIv: 0.25 }, b)! > 0);
  const mv = historicalEventMoves(bars, ["2026-10-14"]); assert.equal(mv.length, 1);
  const cal = ["2026-01-13", "2026-02-13", "2026-03-11", "2026-04-10", "2026-11-10"].map((date) => ({ kind: "CPI" as const, title: "CPI", date, timeEt: "08:30", source: "t" }));
  const c = compareEvent("CPI", cal, bars, chain.asOf, 5); assert.equal(c.verdict, "RICH"); assert.equal(c.nextDate, "2026-11-10"); assert.equal(c.exceededPriced, 0);
  assert.equal(parseEarnings(j("./fixtures/earnings-2026-10-15.json"))[0]!.symbol, "TSM");
});
test("dashboard: PPI tomorrow → event yes + NO_TRADE within 48h", () => {
  const cal = [{ kind: "PPI" as const, title: "PPI", date: "2026-10-15", timeEt: "08:30", source: "t" }];
  const d = buildDashboard(chain, { calendar: cal, bars, vix: 16.9, direction: "bull" });
  assert.equal(d.strategy.event, true); assert.ok(d.noTrade.some((x) => /48h/.test(x)));
  assert.equal(d.expiries.length, 2); assert.equal(d.term.shape, "CONTANGO");
});
test("Robinhood MCP join → normalized chain", () => {
  const ch = chainFromRobinhood([{ data: { instruments: [{ id: "a", expiration_date: "2026-11-20", strike_price: "770.0000", type: "call" }] } }],
    [{ data: { results: [{ quote: { instrument_id: "a", bid_price: "14.57", ask_price: "14.64", mark_price: "14.605", implied_volatility: "0.13493", delta: null, updated_at: "2026-10-14T20:14:59Z" } }] } }], "SPY", 769.6);
  assert.equal(ch.contracts[0]!.strike, 770); assert.equal(ch.contracts[0]!.delta, null); assert.equal(ch.asOf, "2026-10-14T20:14:59Z");
});
