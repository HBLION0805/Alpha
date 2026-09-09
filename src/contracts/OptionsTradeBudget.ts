import type { OptionsRetailFeasibilityInput } from "./OptionsRetailFeasibility";

export interface OptionsTradeBudget {
  version: "OWNER_TRADE_BUDGET_V1";
  minCents: number;
  maxCents: number;
}
export type OptionsPlanningFeasibilityInput = OptionsRetailFeasibilityInput & { tradeBudget?: OptionsTradeBudget };
