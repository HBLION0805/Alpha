import type { OptionsStructure, OptionsStructureCandidate, OptionsStructureComparison, OptionsStructureLeg } from "../../contracts/OptionsStructureComparison";
import { validateOptionContract, validateOptionQuote, qualifyOptionQuote } from "../options-contract-quote/OptionsContractQuoteEngine";
import { evaluateOptionsRetailFeasibility } from "../options-retail-feasibility/OptionsRetailFeasibilityEngine";
import { exchangeLocalDate } from "../market-calendar/MarketCalendarValidation";
import { readinessClock, readinessFingerprint } from "../options-readiness/OptionsReadinessEngine";
import { freezePaper } from "../options-paper/OptionsPaperTradingEngine";

export const STRUCTURES: readonly OptionsStructure[] = ["LONG_CALL", "LONG_PUT", "BULL_CALL_DEBIT", "BEAR_PUT_DEBIT", "BULL_PUT_CREDIT", "BEAR_CALL_CREDIT", "LONG_STRADDLE", "LONG_STRANGLE"];
function fail(code: string): never { throw Error("STRUCTURE_COMPARISON_" + code); }
function exact(value: unknown, fields: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail("SHAPE");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some(k => typeof k !== "string" || !fields.includes(k) || !("value" in descriptors[k]!) || !descriptors[k]!.enumerable)) fail("SHAPE");
}
function integer(value: unknown, min: number, max: number) { if (typeof value !== "number" || !Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) fail("INTEGER"); }
function text(value: unknown) { if (typeof value !== "string" || !value.trim() || value.trim() !== value || value.length > 300 || /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028-\u202e\u2066-\u2069]/.test(value)) fail("TEXT"); }
function list(value: unknown, min: number, max: number) { if (!Array.isArray(value) || value.length < min || value.length > max) fail("ARRAY_LIMIT"); }
function money(value: bigint) { const result = Number(value); if (!Number.isSafeInteger(result)) fail("NUMERIC_OVERFLOW"); return result; }
const sign = (leg: OptionsStructureLeg) => leg.side === "BUY" ? 1n : -1n;
const sum = (values: readonly number[]) => money(values.reduce((a, b) => a + BigInt(b), 0n));

function infer(legs: readonly OptionsStructureLeg[]): OptionsStructure {
  const first = legs[0]!;
  if (legs.length === 1 && first.side === "BUY") return first.contract.optionType === "CALL" ? "LONG_CALL" : "LONG_PUT";
  if (legs.length !== 2 || first.contract.contractId === legs[1]!.contract.contractId) fail("UNSUPPORTED_LEGS");
  const ordered = [...legs].sort((a, b) => a.contract.strikePriceCents - b.contract.strikePriceCents), [low, high] = ordered as [OptionsStructureLeg, OptionsStructureLeg];
  if (low.contract.optionType === high.contract.optionType && low.side !== high.side) {
    if (low.contract.optionType === "CALL") return low.side === "BUY" ? "BULL_CALL_DEBIT" : "BEAR_CALL_CREDIT";
    return low.side === "BUY" ? "BULL_PUT_CREDIT" : "BEAR_PUT_DEBIT";
  }
  if (legs.every(l => l.side === "BUY") && first.contract.optionType !== legs[1]!.contract.optionType) {
    const call = legs.find(l => l.contract.optionType === "CALL")!, put = legs.find(l => l.contract.optionType === "PUT")!;
    if (call.contract.strikePriceCents === put.contract.strikePriceCents) return "LONG_STRADDLE";
    if (put.contract.strikePriceCents < call.contract.strikePriceCents) return "LONG_STRANGLE";
  }
  return fail("UNSUPPORTED_LEGS");
}
function validate(value: unknown): OptionsStructureComparison {
  exact(value, ["version", "comparisonId", "origin", "symbol", "asOf", "expiryDate", "referencePriceCents", "initialEquityCents", "availableSettledCashCents", "terminalPricesCents", "candidates"]);
  const s = value as OptionsStructureComparison;
  if (s.version !== "OPTIONS_STRUCTURE_COMPARISON_INPUT_V1" || !["GLD", "IBIT"].includes(s.symbol) || !["SYNTHETIC_FIXTURE", "UNVERIFIED_IMPORT"].includes(s.origin) || s.initialEquityCents !== 100000) fail("SCOPE");
  text(s.comparisonId); readinessClock(s.asOf); readinessClock(s.expiryDate + "T00:00:00.000Z"); integer(s.referencePriceCents, 1, 100_000_000);
  if (s.availableSettledCashCents !== null) integer(s.availableSettledCashCents, 0, 100000);
  list(s.terminalPricesCents, 1, 41); let previous = -1;
  for (const p of s.terminalPricesCents) { integer(p, 0, 100_000_000); if (p <= previous) fail("PRICE_GRID_ORDER"); previous = p; }
  list(s.candidates, 1, 16); const ids = new Set<string>(), contracts = new Map<string, string>(), quoteIds = new Map<string, string>();
  for (const c of s.candidates) {
    exact(c, ["candidateId", "structure", "quantity", "legs", "costs"]); text(c.candidateId);
    if (ids.has(c.candidateId)) fail("DUPLICATE_CANDIDATE"); ids.add(c.candidateId);
    if (!STRUCTURES.includes(c.structure)) fail("UNSUPPORTED_STRUCTURE"); integer(c.quantity, 1, 100); list(c.legs, 1, 2);
    for (const l of c.legs) {
      exact(l, ["side", "contract", "quote"]); if (!["BUY", "SELL"].includes(l.side)) fail("SIDE");
      const contract = validateOptionContract(l.contract);
      if (contract.symbol !== s.symbol || contract.expiryDate !== s.expiryDate) fail("MIXED_CONTRACT_SCOPE");
      if (l.quote !== null) {
        const q = validateOptionQuote(l.quote, contract); if (q.origin !== s.origin) fail("MIXED_ORIGINS");
        if (quoteIds.has(q.quoteId) && quoteIds.get(q.quoteId) !== contract.contractId) fail("QUOTE_ID_REUSE"); quoteIds.set(q.quoteId, contract.contractId);
      }
      const hash = readinessFingerprint({ contract, quote: l.quote });
      if (contracts.has(contract.contractId) && contracts.get(contract.contractId) !== hash) fail("INCONSISTENT_CONTRACT_SNAPSHOT"); contracts.set(contract.contractId, hash);
    }
    if (infer(c.legs) !== c.structure) fail("STRUCTURE_LABEL_MISMATCH");
    exact(c.costs, ["entryFeesCents", "exitFeesCents", "exitSlippageReserveCents", "reference"]);
    for (const v of [c.costs.entryFeesCents, c.costs.exitFeesCents, c.costs.exitSlippageReserveCents]) if (v !== null) integer(v, 0, 1_000_000);
    if (c.costs.reference !== null) text(c.costs.reference);
  }
  return freezePaper(structuredClone(s));
}

function terminal(c: OptionsStructureCandidate, debit: number, reserve: number, prices: readonly number[]) {
  const scale = BigInt(c.quantity) * 100n, cost = BigInt(debit) + BigInt(reserve);
  const pnl = (price: number) => money(c.legs.reduce((total, leg) => {
    const intrinsic = leg.contract.optionType === "CALL" ? Math.max(0, price - leg.contract.strikePriceCents) : Math.max(0, leg.contract.strikePriceCents - price);
    return total + sign(leg) * BigInt(intrinsic) * scale;
  }, -cost));
  const knots = [...new Set([0, ...c.legs.map(l => l.contract.strikePriceCents)])].sort((a, b) => a - b);
  const values = knots.map(pnl), tailSlope = money(c.legs.filter(l => l.contract.optionType === "CALL").reduce((a, l) => a + sign(l) * scale, 0n));
  if (tailSlope < 0) fail("UNBOUNDED_LOSS_STRUCTURE");
  const minimum = Math.min(...values), maximum = tailSlope > 0 ? null : Math.max(...values);
  const roots = new Map<string, { numeratorCents: number; denominator: number }>(), intervals: { startPriceCents: number; endPriceCents: number | null }[] = [];
  function root(n: bigint, d: bigint) {
    if (d < 0n) { n = -n; d = -d; } if (n < 0n) return;
    let a = n, b = d; while (b) { const next = a % b; a = b; b = next; }
    const divisor = a || 1n; n /= divisor; d /= divisor;
    roots.set(n + "/" + d, { numeratorCents: money(n), denominator: money(d) });
  }
  for (let i = 0; i < knots.length; i++) {
    const low = knots[i]!, high = knots[i + 1] ?? null, y = values[i]!;
    const slope = high === null ? tailSlope : money((BigInt(values[i + 1]!) - BigInt(y)) / BigInt(high - low));
    if (y === 0) root(BigInt(low), 1n);
    if (slope === 0) { if (y === 0) intervals.push({ startPriceCents: low, endPriceCents: high }); continue; }
    let n = BigInt(low) * BigInt(slope) - BigInt(y), d = BigInt(slope);
    if (d < 0n) { n = -n; d = -d; }
    if (n >= BigInt(low) * d && (high === null || n <= BigInt(high) * d)) root(n, d);
  }
  const points = [...roots.values()].sort((a, b) => {
    const difference = BigInt(a.numeratorCents) * BigInt(b.denominator) - BigInt(b.numeratorCents) * BigInt(a.denominator);
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
  });
  return { basis: "TERMINAL_INTRINSIC_MINUS_NET_ENTRY_AND_DECLARED_COST_RESERVE", domain: "NONNEGATIVE_UNDERLYING_PRICE",
    minimumPnlCents: minimum, maximumPnlCents: maximum, maximumGainUnbounded: maximum === null,
    maximumLossCents: Math.max(0, -minimum), maximumGainCents: maximum === null ? null : Math.max(0, maximum),
    breakEven: { points, zeroPnlIntervals: intervals, intervalEndpointsMayAlsoAppearAsPoints: true },
    strikeKnots: knots.map(underlyingPriceCents => ({ underlyingPriceCents, netPnlCents: pnl(underlyingPriceCents) })), rightTailSlopeCentsPerUnderlyingCent: tailSlope,
    scenarios: prices.map(underlyingPriceCents => ({ underlyingPriceCents, netPnlCents: pnl(underlyingPriceCents) })) };
}
function candidate(s: OptionsStructureComparison, c: OptionsStructureCandidate) {
  const inputBlockers: { code: string; subject: string }[] = [], block = (code: string, subject = c.candidateId) => inputBlockers.push({ code, subject });
  const dte = (Date.parse(s.expiryDate + "T00:00:00.000Z") - Date.parse(exchangeLocalDate(s.asOf, "America/New_York") + "T00:00:00.000Z")) / 86400000;
  if (dte < 14 || dte > 45) block("DTE_OUTSIDE_RESEARCH_WINDOW");
  for (const leg of c.legs) {
    const q = leg.quote, subject = leg.contract.contractId;
    if (!q) { block("QUOTE_MISSING", subject); continue; }
    for (const code of qualifyOptionQuote(q, leg.contract, s.asOf).reasons) block(code, subject);
    if (q.underlyingPriceCents !== s.referencePriceCents) block("UNDERLYING_REFERENCE_MISMATCH", subject);
    if ((leg.side === "BUY" ? q.askSizeContracts : q.bidSizeContracts) < c.quantity) block("ENTRY_SIDE_SIZE_INSUFFICIENT", subject);
    if ((leg.side === "BUY" ? q.bidSizeContracts : q.askSizeContracts) < c.quantity) block("CLOSING_SIDE_SIZE_INSUFFICIENT", subject);
  }
  const quotes = c.legs.flatMap(l => l.quote ? [l.quote] : []);
  if (new Set(quotes.map(q => q.observedAt)).size > 1) block("LEG_OBSERVATION_CLOCKS_DIFFER");
  if (new Set(quotes.map(q => q.sourceId)).size > 1) block("LEG_SOURCES_DIFFER");
  const { entryFeesCents: entryFee, exitFeesCents: exitFee, exitSlippageReserveCents: slippage, reference } = c.costs;
  if ([entryFee, exitFee, slippage].some(v => v === null)) block("COSTS_UNKNOWN");
  if (reference === null) block("COST_REFERENCE_MISSING");
  const scale = BigInt(c.quantity) * 100n;
  const quoteValues = inputBlockers.some(b => !["COSTS_UNKNOWN", "COST_REFERENCE_MISSING"].includes(b.code)) ? null : {
    grossLongPremiumCents: money(c.legs.filter(l => l.side === "BUY").reduce((a, l) => a + BigInt(l.quote!.askPerShareCents) * scale, 0n)),
    grossShortCreditCents: money(c.legs.filter(l => l.side === "SELL").reduce((a, l) => a + BigInt(l.quote!.bidPerShareCents) * scale, 0n)),
    quotedClosingValueCents: money(c.legs.reduce((a, l) => a + sign(l) * BigInt(l.side === "BUY" ? l.quote!.bidPerShareCents : l.quote!.askPerShareCents) * scale, 0n)),
  };
  const debit = quoteValues ? sum([quoteValues.grossLongPremiumCents, -quoteValues.grossShortCreditCents]) : null;
  const reserve = inputBlockers.length ? null : sum([entryFee!, exitFee!, slippage!]);
  const curve = debit === null || reserve === null ? null : terminal(c, debit, reserve, s.terminalPricesCents);
  const diagnostics: string[] = [];
  const vertical = c.structure.includes("DEBIT") || c.structure.includes("CREDIT"), credit = c.structure.includes("CREDIT");
  if (debit !== null) {
    const width = vertical ? money(BigInt(Math.abs(c.legs[0]!.contract.strikePriceCents - c.legs[1]!.contract.strikePriceCents)) * scale) : null;
    if (credit ? debit >= 0 || -debit >= width! : debit <= 0 || width !== null && debit >= width) diagnostics.push("ANOMALOUS_ENTRY_PREMIUM");
  }
  if (curve && curve.maximumPnlCents !== null && curve.maximumPnlCents <= 0) diagnostics.push("NO_POSITIVE_TERMINAL_PAYOFF");
  if (curve && curve.maximumLossCents > 5000) diagnostics.push("NORMAL_ALLOCATION_BENCHMARK_EXCEEDED");
  if (curve && curve.maximumLossCents > 2500) diagnostics.push("TERMINAL_LOSS_STRESS_BENCHMARK_EXCEEDED");
  if (s.availableSettledCashCents === null) diagnostics.push("AVAILABLE_SETTLED_CASH_UNKNOWN");
  else if (curve && curve.maximumLossCents > s.availableSettledCashCents) diagnostics.push("DECLARED_CASH_BELOW_TERMINAL_RISK_RESERVE");
  const one = c.legs[0]!, single = c.legs.length === 1;
  const singleLegFeasibility = single && quoteValues && s.availableSettledCashCents !== null ? evaluateOptionsRetailFeasibility({ symbol: s.symbol,
    strategy: one.contract.optionType === "CALL" ? "LONG_CALL" : "LONG_PUT", currentEquityCents: s.initialEquityCents, settledCashCents: s.availableSettledCashCents,
    quantity: c.quantity, contractMultiplier: 100, bidPerShareCents: one.quote!.bidPerShareCents, askPerShareCents: one.quote!.askPerShareCents,
    minimumPriceTickCents: one.contract.minimumPriceTickCents, roundTripFeesCents: entryFee === null || exitFee === null || reference === null ? null : sum([entryFee, exitFee]),
    slippageReserveCents: slippage, mode: "NORMAL", stopLossBps: 2000, rewardMultipleMilliR: 2000 }) : null;
  return { candidateId: c.candidateId, structure: c.structure, quantity: c.quantity, dte, inputBlockers,
    calculationStatus: curve ? "CALCULATED_SCENARIO" : "INPUTS_UNUSABLE", diagnostics, quotedEconomics: quoteValues ? { ...quoteValues, netEntryDebitCents: debit,
      netOpeningCashFlowCents: entryFee === null ? null : sum([-debit!, -entryFee]),
      declaredTotalCostReserveCents: reserve, immediateLiquidationFrictionCents: reserve === null ? null : sum([debit!, -quoteValues.quotedClosingValueCents, reserve]) } : null,
    terminal: curve, capitalComparison: { normalAllocationBenchmarkCents: 5000, terminalLossStressBenchmarkCents: 2500,
      modeledTerminalRiskReserveCents: curve?.maximumLossCents ?? null, availableSettledCashCents: s.availableSettledCashCents, brokerCollateralCents: null },
    shortLegStrikeNotionals: c.legs.filter(l => l.side === "SELL").map(l => ({ contractId: l.contract.contractId, notionalCents: money(BigInt(l.contract.strikePriceCents) * scale), maximumAssignmentLoss: false })),
    singleLegFeasibility, multiLegLifecycleImplemented: false, preExpiryValuation: null, selectedForTrading: false, executionAllowed: false };
}

/** Pure scenario comparison. No sorting by return, inferred probability or trade selection. */
export function compareOptionsStructures(value: unknown) {
  const input = validate(value), candidates = input.candidates.map(c => candidate(input, c));
  const body = { version: "OPTIONS_STRUCTURE_COMPARISON_REPORT_V1", comparisonId: input.comparisonId, origin: input.origin, asOf: input.asOf,
    inputSha256: readinessFingerprint(input), symbol: input.symbol, expiryDate: input.expiryDate, referencePriceCents: input.referencePriceCents, candidates,
    calculatedCount: candidates.filter(c => c.terminal !== null).length, uncalculatedCount: candidates.filter(c => c.terminal === null).length,
    status: "RESEARCH_COMPARISON_ONLY", recommendedCandidateId: null, ranking: null, winProbability: null, marketValidated: false,
    brokerAccountInspected: false, accountEligibility: "UNKNOWN", portfolioApplied: false, replayAllowed: false, executionAllowed: false, sizeEscalationAllowed: false,
    limitations: ["Inputs are declarations and bid/ask scenarios, not authenticated quotes, available combined liquidity or fills.",
      "Terminal intrinsic payoffs with cost reserves do not value an early close or model volatility, time decay or price paths.",
      "Theoretical terminal loss and strike notionals do not bound early-assignment, exercise, separately legged execution or temporary stock exposure.",
      "The $50 allocation and $25 stress comparisons are existing research benchmarks, not approval of any multi-leg risk policy or broker collateral.",
      "Single-leg feasibility reuses the existing unvalidated 20% stop and 2R assumptions. Multi-leg stops, R targets and lifecycle are not implemented.",
      "All candidates retain input/diagnostic failures. There is no ranking, selected trade, calibrated probability or portfolio mutation."] };
  return freezePaper({ ...body, reportSha256: readinessFingerprint(body) });
}
