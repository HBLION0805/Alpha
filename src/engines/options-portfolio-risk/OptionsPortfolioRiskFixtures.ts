import type { OptionsPortfolioScenario } from "../../contracts/OptionsPortfolioRisk";
import { paperFixture } from "../options-paper/OptionsPaperFixtures";
import { replayOptionsPaperAccount } from "../options-paper/OptionsPaperTradingEngine";

/** Synthetic portfolio declarations only. No broker balance or fill is represented. */
export function portfolioDefinition(id = "portfolio-candidate", minute = 2, symbol: "GLD" | "IBIT" = "GLD") {
  const s = paperFixture(id, minute, symbol);
  return { ...s, quotes: [s.quotes[0]!], asOf: s.plan.createdAt };
}
export function portfolioFixture(): OptionsPortfolioScenario {
  const candidate = portfolioDefinition();
  return { version: "OPTIONS_PORTFOLIO_SCENARIO_V1", scenarioId: "portfolio-base", origin: "SYNTHETIC_FIXTURE", asOf: candidate.asOf,
    initialEquityCents: 100000, accountMode: "CASH_SCENARIO", historyComplete: true, modeledCostsReviewed: true, highWaterEquityCents: 100000,
    closedTrades: [], positions: [], pendingEntries: [], candidate,
    eventReview: { receivedAt: candidate.asOf, coverageStartAt: "2026-09-08T13:30:00.000Z", coverageEndAt: "2026-09-08T20:00:00.000Z", reference: "Synthetic event review; no real calendar assurance", events: [] } };
}
export function portfolioClosedFixture(): OptionsPortfolioScenario["closedTrades"][number] {
  const report = replayOptionsPaperAccount([paperFixture("portfolio-closed", 0)]);
  return { input: report.reviews[0]!.input, exitFeeCents: 10, settlement: null };
}
export function portfolioOpenFixture(symbol: "GLD" | "IBIT" = "IBIT"): OptionsPortfolioScenario["positions"][number] {
  const definition = portfolioDefinition("portfolio-open", 0, symbol), asOf = portfolioFixture().asOf;
  return { definition, entryAt: "2026-09-08T14:01:00.000Z", entryPricePerShareCents: 20,
    mark: { ...definition.quotes[0]!, quoteId: "portfolio-mark", observedAt: asOf, receivedAt: asOf } };
}
export function portfolioDemoScenarios(): readonly OptionsPortfolioScenario[] {
  const s = portfolioFixture(), position = portfolioOpenFixture(), closed = portfolioClosedFixture();
  const review = s.eventReview!;
  return [s,
    { ...s, scenarioId: "portfolio-second-position", positions: [position] },
    { ...s, scenarioId: "portfolio-missing-mark", candidate: null, positions: [{ ...position, mark: null }] },
    { ...s, scenarioId: "portfolio-unsettled-sale", closedTrades: [closed] },
    { ...s, scenarioId: "portfolio-date-only-event", eventReview: { ...review, events: [{ eventId: "date-only-fixture", symbols: ["GLD"], receivedAt: s.asOf, reference: "Synthetic date range; no inferred intraday window", precision: "DATE_ONLY", startDate: "2026-09-08", endDate: "2026-09-09" }] } },
    { ...s, scenarioId: "portfolio-overdue-order", pendingEntries: [{ ...portfolioDefinition("pending-order", 0), plan: { ...portfolioDefinition("pending-order", 0).plan, entryDeadlineAt: "2026-09-08T14:01:00.000Z" } }] },
    { ...s, scenarioId: "portfolio-unknown-account", accountMode: "UNKNOWN", historyComplete: false, highWaterEquityCents: null, eventReview: null },
  ];
}
