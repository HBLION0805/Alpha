import type { OptionContract, OptionQuote } from "./OptionsContractQuote";

export interface OptionsPaperPlan {
  readonly planId: string;
  readonly strategyVersion: string;
  readonly setupKey: string;
  readonly createdAt: string;
  readonly entryDeadlineAt: string;
  readonly timeExitAt: string;
  readonly entryLimitPerShareCents: number;
  readonly quantity: number;
  readonly stopLossBps: number;
  readonly rewardMultipleMilliR: number;
  readonly entryFeeCents: number;
  readonly exitFeeCents: number;
  readonly exitSlippagePerShareCents: number;
  readonly maxEntrySpreadPerShareCents: number;
  readonly thesis: {
    readonly direction: "BULLISH" | "BEARISH";
    readonly magnitude: string;
    readonly horizon: string;
    readonly volatility: string;
    readonly path: string;
    readonly invalidation: string;
    readonly monthlyContext: string;
    readonly dailySetup: string;
    readonly intradayTrigger: string;
  };
}

export interface OptionsPaperScenario {
  readonly scenarioId: string;
  readonly contract: OptionContract;
  readonly plan: OptionsPaperPlan;
  readonly quotes: readonly OptionQuote[];
  readonly asOf: string;
}

export interface OptionsPaperEvent {
  readonly sequence: number;
  readonly type: string;
  readonly at: string;
  readonly quoteId: string | null;
  readonly amountCents: number;
  readonly detail: string;
}

export interface OptionsPaperFill {
  readonly at: string;
  readonly quoteId: string;
  readonly pricePerShareCents: number;
  readonly quantity: number;
  readonly premiumCents: number;
  readonly feeCents: number;
}
