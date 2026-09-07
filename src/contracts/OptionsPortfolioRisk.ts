import type { OptionsPaperScenario } from "./OptionsPaperTrading";
import type { OptionQuote } from "./OptionsContractQuote";
import type { OptionsClosedTradeReviewInput } from "./OptionsTradeReview";

/** One complete declared scenario. Never a merge of independent research runs. */
export interface OptionsPortfolioScenario {
  readonly version: "OPTIONS_PORTFOLIO_SCENARIO_V1";
  readonly scenarioId: string;
  readonly origin: "SYNTHETIC_FIXTURE" | "UNVERIFIED_IMPORT";
  readonly asOf: string;
  readonly initialEquityCents: 100000;
  readonly accountMode: "CASH_SCENARIO" | "UNKNOWN";
  readonly historyComplete: boolean;
  readonly modeledCostsReviewed: boolean;
  readonly highWaterEquityCents: number | null;
  readonly closedTrades: readonly {
    readonly input: OptionsClosedTradeReviewInput;
    readonly exitFeeCents: number;
    readonly settlement: { readonly settledAt: string; readonly receivedAt: string; readonly reference: string } | null;
  }[];
  readonly positions: readonly {
    readonly definition: OptionsPaperScenario;
    readonly entryAt: string;
    readonly entryPricePerShareCents: number;
    readonly mark: OptionQuote | null;
  }[];
  readonly pendingEntries: readonly OptionsPaperScenario[];
  readonly candidate: OptionsPaperScenario | null;
  readonly eventReview: {
    readonly receivedAt: string;
    readonly coverageStartAt: string;
    readonly coverageEndAt: string;
    readonly reference: string;
    readonly events: readonly PortfolioRiskEvent[];
  } | null;
}

export type PortfolioRiskEvent = {
  readonly eventId: string;
  readonly symbols: readonly ("GLD" | "IBIT")[];
  readonly receivedAt: string;
  readonly reference: string;
} & ({ readonly precision: "INSTANT"; readonly startAt: string; readonly endAt: string } |
  { readonly precision: "DATE_ONLY"; readonly startDate: string; readonly endDate: string });
