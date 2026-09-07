import { compareOptionsStructures as compare, STRUCTURES } from "./OptionsStructureComparisonEngine";
import { structureComparisonFixture, structureComparisonDemo } from "./OptionsStructureComparisonFixtures";
import { readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
import { evaluateOptionsRetailFeasibility } from "../options-retail-feasibility/OptionsRetailFeasibilityEngine";
import type { OptionsStructureComparison } from "../../contracts/OptionsStructureComparison";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); };
const ok = (v: unknown) => { if (!v) throw Error("Expected truthy"); };
function throws(work: () => unknown, code = "") { let caught; try { work(); } catch (error) { caught = error; } if (!(caught instanceof Error) || !caught.message.includes(code)) throw Error("Expected failure " + code); }
const fixture = () => structuredClone(structureComparisonFixture());
function one(index = 0): OptionsStructureComparison { const s = fixture(); return { ...s, candidates: [s.candidates[index]!] }; }
function edit(s: OptionsStructureComparison, update: (value: any) => void): OptionsStructureComparison { const copy = structuredClone(s); update(copy); return copy; }
const first = (s = one()) => compare(s).candidates[0]!;
const codes = (s: OptionsStructureComparison) => first(s).inputBlockers.map(b => b.code);
let passed = 0; function test(name: string, work: () => void) { work(); passed++; console.log(`PASS ${name}`); }

for (const symbol of ["GLD", "IBIT"] as const) for (const [index, structure] of STRUCTURES.entries()) test(`${symbol} ${structure} extrema agree with independent closed-form formulas`, () => {
  const s = structureComparisonFixture(symbol), c = s.candidates[index]!, r = compare({ ...s, candidates: [c] }).candidates[0]!, p = s.referencePriceCents;
  const losses = [2020, 2020, 940, 940, 9340, 9340, 4040, 2440], gains = [null, p * 100 - 2020, 9060, 9060, 660, 660, null, null];
  eq(r.structure, structure); eq(r.terminal!.maximumLossCents, losses[index]); eq(r.terminal!.maximumGainCents, gains[index]); eq(r.terminal!.maximumGainUnbounded, gains[index] === null);
  const offsets = [[20.2], [-20.2], [9.4], [-9.4], [-6.6], [6.6], [-40.4, 40.4], [-124.4, 124.4]][index]!;
  eq(r.terminal!.breakEven.points.map(v => v.numeratorCents / v.denominator), offsets.map(x => p + x));
  eq(r.executionAllowed, false); eq(r.multiLegLifecycleImplemented, false);
});
test("the display grid cannot cap unlimited upside or hide zero-price put maximum", () => {
  const call = first({ ...one(), terminalPricesCents: [50000] }); eq(call.terminal!.maximumGainCents, null); eq(call.terminal!.scenarios.length, 1);
  eq(first({ ...one(1), terminalPricesCents: [50000] }).terminal!.maximumGainCents, 4997980);
});
test("piecewise outputs agree with independent direct-leg arithmetic over a dense grid", () => {
  for (const s of [structureComparisonFixture("GLD"), structureComparisonFixture("IBIT")]) {
    const r = compare(s);
    for (const [i, c] of s.candidates.entries()) for (let price = s.referencePriceCents - 200; price <= s.referencePriceCents + 200; price += 10) {
      const x = first({ ...s, candidates: [c], terminalPricesCents: [price] }).terminal!.scenarios[0]!.netPnlCents;
      const expected = c.legs.reduce((sum, leg) => sum + (leg.side === "BUY" ? 1 : -1) * (Math.max(0, leg.contract.optionType === "CALL" ? price - leg.contract.strikePriceCents : leg.contract.strikePriceCents - price) - (leg.side === "BUY" ? leg.quote!.askPerShareCents : leg.quote!.bidPerShareCents)) * c.quantity * 100, -c.costs.entryFeesCents! - c.costs.exitFeesCents! - c.costs.exitSlippageReserveCents!);
      eq(x, expected); ok(x >= r.candidates[i]!.terminal!.minimumPnlCents); if (r.candidates[i]!.terminal!.maximumPnlCents !== null) ok(x <= r.candidates[i]!.terminal!.maximumPnlCents!);
    }
  }
});
test("opening credit is not free capital and exposes short-strike notional", () => {
  const r = first(one(4)); eq(r.quotedEconomics!.netEntryDebitCents, -700); eq(r.quotedEconomics!.netOpeningCashFlowCents, 680);
  eq(r.capitalComparison.modeledTerminalRiskReserveCents, 9340); eq(r.capitalComparison.brokerCollateralCents, null); eq(r.shortLegStrikeNotionals[0]!.notionalCents, 5000000);
  ok(r.diagnostics.includes("NORMAL_ALLOCATION_BENCHMARK_EXCEEDED")); ok(r.diagnostics.includes("TERMINAL_LOSS_STRESS_BENCHMARK_EXCEEDED"));
});
test("each leg uses the correct entry and liquidation quote side", () => {
  eq(first(one(2)).quotedEconomics, { grossLongPremiumCents: 2000, grossShortCreditCents: 1100, quotedClosingValueCents: 700,
    netEntryDebitCents: 900, netOpeningCashFlowCents: -920, declaredTotalCostReserveCents: 40, immediateLiquidationFrictionCents: 240 });
  eq(first(one(5)).quotedEconomics!.quotedClosingValueCents, -900); eq(first(one(5)).quotedEconomics!.immediateLiquidationFrictionCents, 240);
});
test("unknown costs keep gross quotes but cannot produce net curves", () => {
  for (const key of ["entryFeesCents", "exitFeesCents", "exitSlippageReserveCents"]) {
    const r = first(edit(one(), s => { s.candidates[0].costs[key] = null; })); eq(r.terminal, null); ok(r.quotedEconomics); ok(r.inputBlockers.some(b => b.code === "COSTS_UNKNOWN"));
  }
});
test("explicit zero costs need a declared reference", () => {
  const s = edit(one(), s => { Object.assign(s.candidates[0].costs, { entryFeesCents: 0, exitFeesCents: 0, exitSlippageReserveCents: 0 }); });
  eq(first(s).terminal!.maximumLossCents, 2000); eq(first(edit(s, s => { s.candidates[0].costs.reference = null; })).terminal, null);
});
test("fees can eliminate all terminal profit without falsely showing a profitable structure", () => {
  const r = first(edit(one(2), s => { s.candidates[0].costs.entryFeesCents = 9200; s.candidates[0].costs.exitFeesCents = 0; }));
  eq(r.terminal!.maximumPnlCents, -100); eq(r.terminal!.maximumGainCents, 0); eq(r.terminal!.breakEven.points, []); ok(r.diagnostics.includes("NO_POSITIVE_TERMINAL_PAYOFF"));
});
test("zero-profit flat tails and intervals are preserved", () => {
  const r = first(edit(one(2), s => { s.candidates[0].costs.entryFeesCents = 9100; s.candidates[0].costs.exitFeesCents = 0; }));
  eq(r.terminal!.breakEven.points, [{ numeratorCents: 50100, denominator: 1 }]); eq(r.terminal!.breakEven.zeroPnlIntervals, [{ startPriceCents: 50100, endPriceCents: null }]);
});
test("fractional-cent break-even roots remain exact reduced fractions", () => {
  const r = first(edit(one(), s => { s.candidates[0].quantity = 3; })); eq(r.terminal!.breakEven.points, [{ numeratorCents: 750301, denominator: 15 }]);
});
test("roots outside nonnegative underlying prices are excluded", () => {
  const r = first(edit(one(1), s => { s.candidates[0].legs[0].quote.bidPerShareCents = 50000; s.candidates[0].legs[0].quote.askPerShareCents = 50001; }));
  eq(r.terminal!.breakEven.points, []); eq(r.terminal!.maximumGainCents, 0);
});
test("scaling all leg quantities and cost reserves scales PnL and keeps break-even", () => {
  const s = fixture(), r = compare(s), scaled = compare(edit(s, s => { for (const c of s.candidates) { c.quantity *= 3; c.costs.entryFeesCents *= 3; c.costs.exitFeesCents *= 3; } }));
  for (let i = 0; i < r.candidates.length; i++) { eq(scaled.candidates[i]!.terminal!.maximumLossCents, 3 * r.candidates[i]!.terminal!.maximumLossCents); eq(scaled.candidates[i]!.terminal!.breakEven, r.candidates[i]!.terminal!.breakEven); }
});
test("missing quotes do not become zero-cost options", () => {
  const r = first(edit(one(), s => { s.candidates[0].legs[0].quote = null; })); eq(r.quotedEconomics, null); eq(r.terminal, null); eq(r.inputBlockers[0]!.code, "QUOTE_MISSING");
});
test("stale quotes and future receipts are unavailable without backdating", () => {
  ok(codes(edit(one(), s => { s.asOf = "2026-09-08T14:01:00.001Z"; })).includes("OPTION_QUOTE_STALE"));
  ok(codes(edit(one(), s => { s.candidates[0].legs[0].quote.receivedAt = "2026-09-08T14:00:00.001Z"; })).includes("OPTION_QUOTE_NOT_YET_RECEIVED"));
  eq(first({ ...one(), asOf: "2026-09-08T14:01:00.000Z" }).calculationStatus, "CALCULATED_SCENARIO");
});
test("closed sessions and DTE outside existing research window block comparison inputs", () => {
  ok(codes(edit(one(), s => { s.candidates[0].legs[0].quote.session = "CLOSED"; })).includes("OPTION_QUOTE_SESSION_CLOSED"));
  ok(codes({ ...one(), asOf: "2026-10-16T14:00:00.000Z" }).includes("DTE_OUTSIDE_RESEARCH_WINDOW"));
});
test("entry and close side liquidity are required for longs and shorts", () => {
  for (const index of [0, 2]) for (const side of ["bidSizeContracts", "askSizeContracts"]) {
    const r = first(edit(one(index), s => { const legs = s.candidates[0].legs; legs[legs.length - 1].quote[side] = 0; })); eq(r.terminal, null); ok(r.inputBlockers.some(b => b.code.endsWith("SIZE_INSUFFICIENT")));
  }
});
test("cross-leg clocks sources and underlying references cannot be silently aligned", () => {
  ok(codes(edit(one(2), s => { const q = s.candidates[0].legs[1].quote; q.observedAt = "2026-09-08T13:59:59.999Z"; })).includes("LEG_OBSERVATION_CLOCKS_DIFFER"));
  ok(codes(edit(one(2), s => { s.candidates[0].legs[1].quote.sourceId = "synthetic:other"; })).includes("LEG_SOURCES_DIFFER"));
  ok(codes(edit(one(2), s => { s.candidates[0].legs[1].quote.underlyingPriceCents++; })).includes("UNDERLYING_REFERENCE_MISMATCH"));
});
test("settled cash unknown or below risk reserve remains diagnostic", () => {
  const unknown = first({ ...one(), availableSettledCashCents: null }); ok(unknown.terminal); eq(unknown.singleLegFeasibility, null); ok(unknown.diagnostics.includes("AVAILABLE_SETTLED_CASH_UNKNOWN"));
  ok(first({ ...one(), availableSettledCashCents: 2019 }).diagnostics.includes("DECLARED_CASH_BELOW_TERMINAL_RISK_RESERVE"));
});
test("anomalous vertical price signs never become free-profit recommendations", () => {
  const r = first(edit(one(2), s => { Object.assign(s.candidates[0].legs[1].quote, { bidPerShareCents: 120, askPerShareCents: 121 }); }));
  eq(r.terminal!.maximumLossCents, 0); ok(r.diagnostics.includes("ANOMALOUS_ENTRY_PREMIUM")); eq(r.selectedForTrading, false);
});
test("single-leg feasibility is the original engine output with unchanged assumptions", () => {
  const s = one(), c = s.candidates[0]!, q = c.legs[0]!.quote!, r = first(s);
  eq(r.singleLegFeasibility, evaluateOptionsRetailFeasibility({ symbol: "GLD", strategy: "LONG_CALL", currentEquityCents: 100000, settledCashCents: 100000,
    quantity: 1, contractMultiplier: 100, bidPerShareCents: q.bidPerShareCents, askPerShareCents: q.askPerShareCents, minimumPriceTickCents: 1,
    roundTripFeesCents: 20, slippageReserveCents: 0, mode: "NORMAL", stopLossBps: 2000, rewardMultipleMilliR: 2000 }));
  eq(first(one(2)).singleLegFeasibility, null);
});
test("naked shorts ratios labels mixed underlyings and expiries are rejected", () => {
  throws(() => compare(edit(one(), s => { s.candidates[0].legs[0].side = "SELL"; })), "UNSUPPORTED_LEGS");
  throws(() => compare(edit(one(2), s => { s.candidates[0].legs[0].quantity = 2; })), "SHAPE");
  throws(() => compare(edit(one(2), s => { s.candidates[0].structure = "BEAR_CALL_CREDIT"; })), "LABEL_MISMATCH");
  throws(() => compare(edit(one(), s => { s.symbol = "IBIT"; })), "MIXED_CONTRACT_SCOPE");
  throws(() => compare(edit(one(), s => { s.expiryDate = "2026-10-17"; })), "MIXED_CONTRACT_SCOPE");
});
test("contract snapshots and quote IDs cannot be changed between alternatives", () => {
  throws(() => compare(edit(fixture(), s => { s.candidates[2].legs[0] = structuredClone(s.candidates[2].legs[0]); s.candidates[2].legs[0].quote.askPerShareCents++; })), "INCONSISTENT_CONTRACT_SNAPSHOT");
  throws(() => compare(edit(one(2), s => { s.candidates[0].legs[1].quote.quoteId = s.candidates[0].legs[0].quote.quoteId; })), "QUOTE_ID_REUSE");
});
test("unverified inputs retain provenance without becoming market validated", () => {
  const s = edit(one(), s => { s.origin = "UNVERIFIED_IMPORT"; const q = s.candidates[0].legs[0].quote; q.origin = s.origin; q.sourceId = "import:manual-declaration"; });
  const r = compare(s); eq(r.origin, "UNVERIFIED_IMPORT"); eq(r.marketValidated, false); eq(r.replayAllowed, false);
  throws(() => compare(edit(s, s => { s.origin = "SYNTHETIC_FIXTURE"; })), "MIXED_ORIGINS");
});
test("bounds duplicate IDs unsafe integer values and invented authority fields fail", () => {
  for (const value of [0, 1.5, 101, Number.NaN]) throws(() => compare(edit(one(), s => { s.candidates[0].quantity = value; })), "INTEGER");
  throws(() => compare(edit(fixture(), s => { s.candidates[1].candidateId = s.candidates[0].candidateId; })), "DUPLICATE_CANDIDATE");
  throws(() => compare(edit(one(), s => { s.terminalPricesCents = [50000, 50000]; })), "PRICE_GRID_ORDER");
  throws(() => compare(edit(one(), s => { s.terminalPricesCents = Array.from({ length: 42 }, (_, i) => i); })), "ARRAY_LIMIT");
  throws(() => compare(edit(one(), s => { s.claimedWinProbability = 0.99; })), "SHAPE");
  throws(() => compare(edit(one(), s => { s.candidates[0].costs.entryFeesCents = -0; })), "INTEGER");
});
test("caller input is unchanged and returned nested comparison is frozen and fingerprinted", () => {
  const s = fixture(), before = readinessFingerprint(s), r = compare(s), { reportSha256, ...body } = r;
  eq(readinessFingerprint(s), before); eq(reportSha256, readinessFingerprint(body)); eq(compare(s), r); ok(Object.isFrozen(r.candidates[0]!.terminal!.breakEven.points));
  eq(r.ranking, null); eq(r.recommendedCandidateId, null); eq(r.winProbability, null); eq(r.portfolioApplied, false); eq(r.sizeEscalationAllowed, false);
});
test("demos retain both unavailable costs and larger over-budget alternatives", () => {
  for (const s of structureComparisonDemo()) { const r = compare(s); eq(r.calculatedCount, 9); eq(r.uncalculatedCount, 1); eq(r.candidates[9]!.quantity, 3); ok(r.candidates[9]!.diagnostics.includes("NORMAL_ALLOCATION_BENCHMARK_EXCEEDED")); }
});
test("leg order cannot change structure identity or exact payoff", () => {
  const s = fixture(), original = compare(s), reordered = compare(edit(s, s => { for (const c of s.candidates) c.legs.reverse(); }));
  for (let i = 0; i < original.candidates.length; i++) { eq(reordered.candidates[i]!.structure, original.candidates[i]!.structure); eq(reordered.candidates[i]!.terminal, original.candidates[i]!.terminal); eq(reordered.candidates[i]!.quotedEconomics, original.candidates[i]!.quotedEconomics); }
});
test("premium equal to or larger than vertical width is flagged for debit and credit", () => {
  const debit = first(edit(one(2), s => { Object.assign(s.candidates[0].legs[0].quote, { bidPerShareCents: 110, askPerShareCents: 111 }); }));
  ok(debit.diagnostics.includes("ANOMALOUS_ENTRY_PREMIUM")); ok(debit.diagnostics.includes("NO_POSITIVE_TERMINAL_PAYOFF"));
  const credit = first(edit(one(5), s => { Object.assign(s.candidates[0].legs[0].quote, { bidPerShareCents: 112, askPerShareCents: 113 }); }));
  ok(credit.diagnostics.includes("ANOMALOUS_ENTRY_PREMIUM")); eq(credit.singleLegFeasibility, null); eq(credit.selectedForTrading, false);
});
console.log(`${passed}/${passed} tests passed.`);
