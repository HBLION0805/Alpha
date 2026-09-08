import type { OptionsPaperScenario } from "./OptionsPaperTrading";
import type { OptionsPortfolioScenario } from "./OptionsPortfolioRisk";

/** Complete latest state of one modeled account, not independent research runs. */
export interface OptionsPaperPortfolioInput {
  readonly version: "OPTIONS_PAPER_PORTFOLIO_INPUT_V1";
  readonly scenarioId: string;
  readonly origin: OptionsPortfolioScenario["origin"];
  readonly asOf: string;
  readonly historyComplete: boolean;
  readonly modeledCostsReviewed: boolean;
  readonly history: readonly OptionsPaperScenario[];
  readonly candidate: OptionsPaperScenario | null;
  readonly eventReview: OptionsPortfolioScenario["eventReview"];
}
