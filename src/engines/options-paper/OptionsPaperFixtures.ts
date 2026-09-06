import type { OptionsPaperScenario } from "../../contracts/OptionsPaperTrading";
import type { OptionQuote } from "../../contracts/OptionsContractQuote";

/** Scripted engineering fixtures. Prices, expiry and thesis are not market observations. */
export function paperFixture(name = "target", minute = 0, symbol: "GLD" | "IBIT" = "GLD"): OptionsPaperScenario {
  const at = (offset: number) => new Date(Date.UTC(2026, 8, 8, 14, minute + offset)).toISOString();
  const optionType = symbol === "GLD" ? "CALL" as const : "PUT" as const;
  const contract = { contractId: `${symbol}:2026-10-16:${optionType}:50000`, symbol, optionType,
    strikePriceCents: 50000, expiryDate: "2026-10-16", multiplier: 100 as const, minimumPriceTickCents: 1,
    deliverable: "STANDARD_100_SHARES_USD" as const, exerciseStyle: "AMERICAN" as const };
  const quote = (index: number, bid = 19, ask = bid + 1, size = 10): OptionQuote => ({
    quoteId: `${name}:q${index}`, contractId: contract.contractId, observedAt: at(index), receivedAt: at(index),
    bidPerShareCents: bid, askPerShareCents: ask, bidSizeContracts: size, askSizeContracts: 10,
    underlyingPriceCents: 50000, sourceId: "synthetic:alpha-lifecycle-v1", origin: "SYNTHETIC_FIXTURE",
    session: "REGULAR", ivBps: 4000, deltaBps: symbol === "GLD" ? 3000 : -3000,
  });
  const plan = { planId: `${name}:plan`, strategyVersion: "research-v1", setupKey: "directional-intraday-fixture",
    createdAt: at(0), entryDeadlineAt: at(2), timeExitAt: at(3), entryLimitPerShareCents: 20,
    quantity: 1, stopLossBps: 2000, rewardMultipleMilliR: 2000, entryFeeCents: 10,
    exitFeeCents: 10, exitSlippagePerShareCents: 0, maxEntrySpreadPerShareCents: 1,
    thesis: { direction: symbol === "GLD" ? "BULLISH" as const : "BEARISH" as const,
      magnitude: "Synthetic modest directional move", horizon: "Intraday engineering scenario",
      volatility: "IV is supplied synthetic context; no validated pricing edge", path: "Scripted quote sequence",
      invalidation: "Predefined premium stop or time exit; thesis invalidation is not automatically inferred",
      monthlyContext: "Synthetic context only", dailySetup: "Synthetic directional setup",
      intradayTrigger: "Subsequent quote and limit-price condition" } };
  return { scenarioId: name, contract, plan, quotes: [quote(0), quote(1), quote(2, 29)], asOf: at(4) };
}

export function optionsPaperDemoScenarios(): readonly OptionsPaperScenario[] {
  const changeLast = (value: OptionsPaperScenario, bid: number, offset = 2, size = 10) => ({ ...value,
    quotes: [...value.quotes.slice(0, 2), { ...value.quotes[2]!, observedAt: new Date(Date.parse(value.plan.createdAt) + offset * 60000).toISOString(),
      receivedAt: new Date(Date.parse(value.plan.createdAt) + offset * 60000).toISOString(), bidPerShareCents: bid, askPerShareCents: bid + 1, bidSizeContracts: size }] });
  const target = paperFixture("demo-target", 0);
  const stop = changeLast(paperFixture("demo-stop", 5, "IBIT"), 16);
  const gap = changeLast(paperFixture("demo-gap", 10), 10);
  const time = changeLast(paperFixture("demo-time", 15, "IBIT"), 21, 3);
  const noFill = paperFixture("demo-no-fill", 20);
  const noFillPath = { ...noFill, quotes: noFill.quotes.map((quote, index) => index ? { ...quote, bidPerShareCents: 24, askPerShareCents: 25 } : quote) };
  const delayed = changeLast(paperFixture("demo-liquidity", 25), 16, 2, 0);
  const pending = { ...delayed, asOf: delayed.plan.timeExitAt };
  const recovered = { ...pending, quotes: [...pending.quotes, { ...pending.quotes[2]!, quoteId: "demo-liquidity:q4",
    observedAt: "2026-09-08T14:29:00.000Z", receivedAt: "2026-09-08T14:29:00.000Z",
    bidPerShareCents: 15, askPerShareCents: 16, bidSizeContracts: 10 }], asOf: "2026-09-08T14:30:00.000Z" };
  const guarded = paperFixture("demo-session-guard", 35);
  return [target, stop, gap, time, noFillPath, pending, recovered, guarded];
}
