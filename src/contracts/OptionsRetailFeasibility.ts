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
  /** Offline comparison range 10%-25%; 20% is an unvalidated research default. */
  readonly stopLossBps: number;
  /** Net cash profit target in thousandths of planned all-in R: 1500 through 2000. */
  readonly rewardMultipleMilliR: number;
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
  | "PLANNED_RISK_BUDGET_EXCEEDED"
  | "PROFIT_TARGET_CAP_EXCEEDED"
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
  readonly plannedStopBasis: "ENTRY_PREMIUM_PLUS_COSTS";
  readonly plannedStopBps: number;
  readonly grossStopLossCents: number;
  /** One R: gross premium decline plus round-trip fees and exit slippage reserve. */
  readonly plannedStopCents: number | null;
  readonly plannedRiskBudgetBps: 50;
  readonly plannedRiskBudgetCents: number;
  readonly oneTickLossCents: number;
  readonly rewardMultipleMilliR: number;
  /** Mathematical premium gain required to retain the requested net R target. */
  readonly grossProfitTargetCents: number | null;
  readonly netProfitTargetCents: number | null;
  readonly indicativeExitLimitPerShareCents: number | null;
  readonly profitTargetPriceIsIndicative: true;
  readonly roundedGrossProfitTargetCents: number | null;
  readonly roundedNetProfitTargetCents: number | null;
  readonly immediateLiquidationFrictionCents: number | null;
  readonly remainingStopCapacityCents: number | null;
  readonly stressLossCents: number | null;
  readonly legacyNormalMaxLossCents: 2500;
  readonly legacyEventMaxLossCents: 1250;
}

export interface OptionsRetailFeasibilityResult {
  readonly schemaVersion: "2.0";
  readonly status: "NO_TRADE" | "ECONOMICALLY_FEASIBLE_SCENARIO";
  readonly executionAllowed: false;
  readonly evidenceOrigin: "MANUAL_SCENARIO";
  readonly scenario: OptionsRetailFeasibilityInput | null;
  readonly economics: OptionsRetailFeasibilityEconomics | null;
  readonly blockers: readonly OptionsRetailFeasibilityBlocker[];
  readonly unverifiedRequirements: readonly string[];
  readonly disclosures: readonly string[];
}
