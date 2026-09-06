/** Manual, offline economics only; these contracts never grant trading authority. */
export interface OptionsRetailFeasibilityInput {
  readonly symbol: "GLD" | "IBIT";
  readonly strategy: "LONG_CALL" | "LONG_PUT";
  readonly currentEquityCents: number;
  readonly settledCashCents: number;
  readonly quantity: number;
  readonly contractMultiplier: 100;
  readonly bidPerShareCents: number;
  readonly askPerShareCents: number;
  readonly minimumPriceTickCents: number;
  /** Explicit zero is a scenario assumption; null means unknown. */
  readonly roundTripFeesCents: number | null;
  /** Exit slippage only; entry is assumed to fill at the stated ask. */
  readonly slippageReserveCents: number | null;
  readonly mode: "NORMAL" | "CONDITIONAL";
  readonly profitTargetBps: number;
  /** An unverified caller claim cannot authorize larger allocation. */
  readonly claimedWinProbabilityBps?: number | null;
}

export type OptionsRetailFeasibilityBlockerCode =
  | "INVALID_INPUT"
  | "NUMERIC_OVERFLOW"
  | "COSTS_UNKNOWN"
  | "ALLOCATION_BUDGET_EXCEEDED"
  | "SETTLED_CASH_INSUFFICIENT"
  | "STOP_BUDGET_NOT_EXECUTABLE"
  | "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"
  | "UNCALIBRATED_WIN_RATE";

export interface OptionsRetailFeasibilityBlocker {
  readonly code: OptionsRetailFeasibilityBlockerCode;
  readonly message: string;
}

export interface OptionsRetailFeasibilityEconomics {
  readonly normalAllocationBudgetCents: number;
  /** A conditional value is hypothetical and remains blocked. */
  readonly requestedAllocationBudgetCents: number;
  /** The normal 5% ceiling applies even when conditional mode is requested. */
  readonly applicableAllocationBudgetCents: number;
  readonly premiumCents: number;
  readonly capitalRequiredCents: number | null;
  readonly plannedStopBasis: "ENTRY_PREMIUM";
  readonly plannedStopBps: 200;
  readonly plannedStopCents: number;
  readonly oneTickLossCents: number;
  readonly grossProfitTargetCents: number;
  readonly netProfitTargetCents: number | null;
  readonly immediateLiquidationFrictionCents: number | null;
  readonly remainingStopCapacityCents: number | null;
  readonly stressLossCents: number | null;
  readonly legacyNormalMaxLossCents: 2500;
  readonly legacyEventMaxLossCents: 1250;
}

export interface OptionsRetailFeasibilityResult {
  readonly schemaVersion: "1.0";
  readonly status: "NO_TRADE" | "ECONOMICALLY_FEASIBLE_SCENARIO";
  readonly executionAllowed: false;
  readonly evidenceOrigin: "MANUAL_SCENARIO";
  readonly scenario: OptionsRetailFeasibilityInput | null;
  readonly economics: OptionsRetailFeasibilityEconomics | null;
  readonly blockers: readonly OptionsRetailFeasibilityBlocker[];
  readonly unverifiedRequirements: readonly string[];
  readonly disclosures: readonly string[];
}
