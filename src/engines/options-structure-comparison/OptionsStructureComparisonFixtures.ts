import type { OptionsStructure, OptionsStructureCandidate, OptionsStructureComparison, OptionsStructureLeg } from "../../contracts/OptionsStructureComparison";

/** Scripted mathematics examples. Strikes, premiums and source clocks are not market data. */
export function structureComparisonFixture(symbol: "GLD" | "IBIT" = "GLD"): OptionsStructureComparison {
  const price = symbol === "GLD" ? 50000 : 6000, asOf = "2026-09-08T14:00:00.000Z", expiryDate = "2026-10-16";
  function leg(type: "CALL" | "PUT", strike: number, side: "BUY" | "SELL", bid: number): OptionsStructureLeg {
    const contractId = `${symbol}:${expiryDate}:${type}:${strike}`;
    return { side, contract: { contractId, symbol, optionType: type, strikePriceCents: strike, expiryDate, multiplier: 100,
      minimumPriceTickCents: 1, deliverable: "STANDARD_100_SHARES_USD", exerciseStyle: "AMERICAN" },
    quote: { quoteId: `${symbol}:${type}:${strike}:q1`, contractId, observedAt: asOf, receivedAt: asOf, bidPerShareCents: bid, askPerShareCents: bid + 1,
      bidSizeContracts: 10, askSizeContracts: 10, underlyingPriceCents: price, sourceId: "synthetic:structure-comparison-v1", origin: "SYNTHETIC_FIXTURE",
      session: "REGULAR", ivBps: null, deltaBps: null } };
  }
  const call = leg("CALL", price, "BUY", 19), callHigh = leg("CALL", price + 100, "BUY", 11);
  const put = leg("PUT", price, "BUY", 19), putLow = leg("PUT", price - 100, "BUY", 11);
  const sell = (l: OptionsStructureLeg): OptionsStructureLeg => ({ ...l, side: "SELL" });
  const candidate = (structure: OptionsStructure, legs: OptionsStructureLeg[]): OptionsStructureCandidate => ({ candidateId: `${symbol}:${structure}`, structure, quantity: 1, legs,
    costs: { entryFeesCents: legs.length * 10, exitFeesCents: legs.length * 10, exitSlippageReserveCents: 0, reference: "Synthetic fee and zero-slippage assumptions; not verified broker costs" } });
  const candidates = [candidate("LONG_CALL", [call]), candidate("LONG_PUT", [put]), candidate("BULL_CALL_DEBIT", [call, sell(callHigh)]),
    candidate("BEAR_PUT_DEBIT", [put, sell(putLow)]), candidate("BULL_PUT_CREDIT", [sell(put), putLow]), candidate("BEAR_CALL_CREDIT", [sell(call), callHigh]),
    candidate("LONG_STRADDLE", [call, put]), candidate("LONG_STRANGLE", [callHigh, putLow])];
  return { version: "OPTIONS_STRUCTURE_COMPARISON_INPUT_V1", comparisonId: `structure-demo-${symbol.toLowerCase()}`, origin: "SYNTHETIC_FIXTURE", symbol, asOf, expiryDate,
    referencePriceCents: price, initialEquityCents: 100000, availableSettledCashCents: 100000,
    terminalPricesCents: [0, price - 150, price - 100, price - 50, price, price + 50, price + 100, price + 150, price * 2], candidates };
}
export function structureComparisonDemo(): readonly OptionsStructureComparison[] {
  return (["GLD", "IBIT"] as const).map(symbol => {
    const s = structureComparisonFixture(symbol), long = s.candidates[0]!;
    return { ...s, candidates: [...s.candidates,
      { ...long, candidateId: symbol + ":unknown-cost", costs: { ...long.costs, exitFeesCents: null } },
      { ...long, candidateId: symbol + ":larger-quantity", quantity: 3 }] };
  });
}
