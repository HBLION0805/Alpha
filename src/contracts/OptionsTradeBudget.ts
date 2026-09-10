import type { OptionsRetailFeasibilityInput } from "./OptionsRetailFeasibility";

export interface OptionsTradeBudget {
  version: "OWNER_TRADE_BUDGET_V1" | "OWNER_ALLOCATION_ONLY_V2";
  minCents: number;
  maxCents: number;
}
export type OptionsPlanningFeasibilityInput = OptionsRetailFeasibilityInput & { tradeBudget?: OptionsTradeBudget };
