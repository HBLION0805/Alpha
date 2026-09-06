import type {
  OptionsRetailFeasibilityBlocker,
  OptionsRetailFeasibilityBlockerCode,
  OptionsRetailFeasibilityEconomics,
  OptionsRetailFeasibilityInput,
  OptionsRetailFeasibilityResult,
} from "../../contracts/OptionsRetailFeasibility";

const REQUIRED_FIELDS = [
  "symbol", "strategy", "currentEquityCents", "settledCashCents", "quantity",
  "contractMultiplier", "bidPerShareCents", "askPerShareCents", "minimumPriceTickCents",
  "roundTripFeesCents", "slippageReserveCents", "mode", "stopLossBps", "rewardMultipleMilliR",
] as const;
const OPTIONAL_FIELDS = ["claimedWinProbabilityBps"] as const;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const UNVERIFIED_REQUIREMENTS = Object.freeze([
  "Broker account type, options permission level and settled-cash provenance",
  "Real-time option-chain provenance, contract identity, executable sizes and trading session",
  "Expiry, exercise, assignment and resulting stock exposure",
  "Aggregate open risk, event risk, daily/weekly losses and drawdown limits",
  "Cost-aware out-of-sample probability of reaching the target before stop or time exit",
]);
const DISCLOSURES = Object.freeze([
  "Manual scenarios are not verified market quotes, trade recommendations or execution permission.",
  "Stops from 10% through 25% of entry premium are offline comparison scenarios. The 20% research default is not a validated live rule.",
  "One R is the planned premium decline plus round-trip fees and the exit slippage reserve; it is capped at 0.5% of current equity and is not a guaranteed maximum loss or fill price.",
  "Entry assumes a limit fill at the stated ask with no entry slippage; the slippage reserve models exit slippage only.",
  "Capital and pre-exercise stress loss include the full round-trip fee reserve. Stress loss is full premium plus fees and excludes stock exposure after exercise.",
  "An explicit zero fee or slippage reserve is an unverified zero-cost scenario assumption.",
  "The requested target is 1.5R through 2R of net cash gain. Costs are added once to derive the required gross premium gain, then the indicative exit is rounded upward to the declared quote tick.",
  "The indicative exit is not an executable order price, verified quote or order recommendation; liquidity and order checks remain unverified.",
  "The 80% premium-gain ceiling applies to the rounded configured target, not the actual realized outcome.",
  "A claimed probability never authorizes conditional allocation or a longer holding period; holding longer requires a separately reviewed thesis and time exit.",
  "The legacy $12.50 event cap is reported only; event-mode assessment is unsupported.",
]);

function immutable<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

function result(
  scenario: OptionsRetailFeasibilityInput | null,
  economics: OptionsRetailFeasibilityEconomics | null,
  blockers: readonly OptionsRetailFeasibilityBlocker[],
): OptionsRetailFeasibilityResult {
  return immutable({
    schemaVersion: "2.0",
    status: blockers.length > 0 ? "NO_TRADE" : "ECONOMICALLY_FEASIBLE_SCENARIO",
    executionAllowed: false,
    evidenceOrigin: "MANUAL_SCENARIO",
    scenario,
    economics,
    blockers,
    unverifiedRequirements: [...UNVERIFIED_REQUIREMENTS],
    disclosures: [...DISCLOSURES],
  });
}

function validate(input: unknown): { scenario: OptionsRetailFeasibilityInput | null; issues: string[] } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { scenario: null, issues: ["Input must be a plain JSON object."] };
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== null && prototype !== Object.prototype) {
    return { scenario: null, issues: ["Input must be a plain JSON object."] };
  }
  const fields = new Set<string>([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key !== "string" || !fields.has(key))) {
    return { scenario: null, issues: ["Input contains unsupported fields."] };
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (keys.some((key) => typeof key !== "string" || !("value" in descriptors[key]!) || !descriptors[key]!.enumerable)) {
    return { scenario: null, issues: ["Input fields must be enumerable JSON data values."] };
  }
  const values = input as Record<string, unknown>;
  const issues: string[] = [];
  for (const key of REQUIRED_FIELDS) {
    if (!Object.hasOwn(values, key)) issues.push(`Missing required field: ${key}.`);
  }
  const integer = (key: string, minimum: number): void => {
    const value = values[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) {
      issues.push(`${key} must be a safe integer of at least ${minimum}.`);
    }
  };
  for (const key of ["currentEquityCents", "quantity", "askPerShareCents", "minimumPriceTickCents"]) integer(key, 1);
  for (const key of ["settledCashCents", "bidPerShareCents"]) integer(key, 0);
  for (const key of ["roundTripFeesCents", "slippageReserveCents"]) {
    if (values[key] !== null) integer(key, 0);
  }
  if (values.symbol !== "GLD" && values.symbol !== "IBIT") issues.push("Only GLD and IBIT are supported.");
  if (values.strategy !== "LONG_CALL" && values.strategy !== "LONG_PUT") issues.push("Only standard long calls and long puts are supported.");
  if (values.contractMultiplier !== 100) issues.push("contractMultiplier must equal 100; adjusted contracts are unsupported.");
  if (values.mode !== "NORMAL" && values.mode !== "CONDITIONAL") issues.push("mode must be NORMAL or CONDITIONAL.");
  integer("stopLossBps", 1000);
  if (typeof values.stopLossBps === "number" && values.stopLossBps > 2500) {
    issues.push("stopLossBps must be 1000 through 2500 for offline comparison.");
  }
  integer("rewardMultipleMilliR", 1500);
  if (typeof values.rewardMultipleMilliR === "number" && values.rewardMultipleMilliR > 2000) {
    issues.push("rewardMultipleMilliR must be 1500 through 2000 of planned all-in R.");
  }
  if (Object.hasOwn(values, "claimedWinProbabilityBps") && values.claimedWinProbabilityBps !== null) {
    integer("claimedWinProbabilityBps", 0);
    if (typeof values.claimedWinProbabilityBps === "number" && values.claimedWinProbabilityBps > 10000) {
      issues.push("claimedWinProbabilityBps must be at most 10000.");
    }
  }
  if (issues.length === 0) {
    const candidate = values as unknown as OptionsRetailFeasibilityInput;
    if (candidate.bidPerShareCents > candidate.askPerShareCents) issues.push("Bid cannot exceed ask.");
    if (candidate.bidPerShareCents % candidate.minimumPriceTickCents !== 0 ||
        candidate.askPerShareCents % candidate.minimumPriceTickCents !== 0) {
      issues.push("Bid and ask must lie on the declared minimum price tick.");
    }
  }
  return { scenario: issues.length === 0 ? { ...values } as unknown as OptionsRetailFeasibilityInput : null, issues };
}

function money(value: bigint): number {
  if (value > MAX_SAFE || value < -MAX_SAFE) throw new Error("NUMERIC_OVERFLOW");
  return Number(value);
}

/** Pure diagnostic. Neither a favorable result nor a caller probability grants execution. */
export function evaluateOptionsRetailFeasibility(input: unknown): OptionsRetailFeasibilityResult {
  const validated = validate(input);
  if (validated.scenario === null) {
    return result(null, null, validated.issues.map((message) => ({ code: "INVALID_INPUT", message })));
  }
  const scenario = validated.scenario;
  const blockers: OptionsRetailFeasibilityBlocker[] = [];
  const block = (code: OptionsRetailFeasibilityBlockerCode, message: string): void => { blockers.push({ code, message }); };
  try {
    const equity = BigInt(scenario.currentEquityCents);
    const quantityMultiplier = BigInt(scenario.quantity) * 100n;
    const premium = BigInt(scenario.askPerShareCents) * quantityMultiplier;
    const tickLoss = BigInt(scenario.minimumPriceTickCents) * quantityMultiplier;
    const grossStop = premium * BigInt(scenario.stopLossBps) / 10000n;
    const riskBudget = equity * 50n / 10000n;
    const normalBudget = equity * 500n / 10000n;
    const requestedBudget = equity * (scenario.mode === "CONDITIONAL" ? 1000n : 500n) / 10000n;
    const fees = scenario.roundTripFeesCents === null ? null : BigInt(scenario.roundTripFeesCents);
    const slippage = scenario.slippageReserveCents === null ? null : BigInt(scenario.slippageReserveCents);
    const capital = fees === null ? null : premium + fees;
    const exitCosts = fees === null || slippage === null ? null : fees + slippage;
    const stop = exitCosts === null ? null : grossStop + exitCosts;
    const friction = fees === null || slippage === null ? null :
      (BigInt(scenario.askPerShareCents) - BigInt(scenario.bidPerShareCents)) * quantityMultiplier + fees + slippage;
    const remainingStop = friction === null || stop === null ? null : stop - friction;
    const netTarget = stop === null ? null : (stop * BigInt(scenario.rewardMultipleMilliR) + 999n) / 1000n;
    const grossTarget = netTarget === null || exitCosts === null ? null : netTarget + exitCosts;
    const exitPrice = grossTarget === null ? null :
      ((premium + grossTarget + tickLoss - 1n) / tickLoss) * BigInt(scenario.minimumPriceTickCents);
    const roundedGrossTarget = exitPrice === null ? null :
      (exitPrice - BigInt(scenario.askPerShareCents)) * quantityMultiplier;
    const roundedNetTarget = roundedGrossTarget === null || exitCosts === null ? null : roundedGrossTarget - exitCosts;
    const nullableMoney = (value: bigint | null): number | null => value === null ? null : money(value);
    const economics: OptionsRetailFeasibilityEconomics = {
      normalAllocationBudgetCents: money(normalBudget),
      requestedAllocationBudgetCents: money(requestedBudget),
      applicableAllocationBudgetCents: money(normalBudget),
      premiumCents: money(premium),
      capitalRequiredCents: nullableMoney(capital),
      plannedStopBasis: "ENTRY_PREMIUM_PLUS_COSTS",
      plannedStopBps: scenario.stopLossBps,
      grossStopLossCents: money(grossStop),
      plannedStopCents: nullableMoney(stop),
      plannedRiskBudgetBps: 50,
      plannedRiskBudgetCents: money(riskBudget),
      oneTickLossCents: money(tickLoss),
      rewardMultipleMilliR: scenario.rewardMultipleMilliR,
      grossProfitTargetCents: nullableMoney(grossTarget),
      netProfitTargetCents: nullableMoney(netTarget),
      indicativeExitLimitPerShareCents: nullableMoney(exitPrice),
      profitTargetPriceIsIndicative: true,
      roundedGrossProfitTargetCents: nullableMoney(roundedGrossTarget),
      roundedNetProfitTargetCents: nullableMoney(roundedNetTarget),
      immediateLiquidationFrictionCents: nullableMoney(friction),
      remainingStopCapacityCents: nullableMoney(remainingStop),
      stressLossCents: nullableMoney(capital),
      legacyNormalMaxLossCents: 2500,
      legacyEventMaxLossCents: 1250,
    };
    if (scenario.mode === "CONDITIONAL") {
      block("UNCALIBRATED_WIN_RATE", "Conditional 10% allocation is blocked: a caller probability is not independently calibrated option-outcome evidence.");
    }
    if (fees === null || slippage === null) block("COSTS_UNKNOWN", "Explicit round-trip fees and exit slippage reserve are required to assess costs.");
    // Premium alone can prove a shortfall even when the fee reserve is unknown.
    if ((capital ?? premium) > normalBudget) block("ALLOCATION_BUDGET_EXCEEDED", "Required capital exceeds the applicable normal 5% allocation ceiling; a conditional request does not raise it.");
    if ((capital ?? premium) > BigInt(scenario.settledCashCents)) block("SETTLED_CASH_INSUFFICIENT", "Required capital exceeds the stated settled cash.");
    if (stop !== null && friction !== null && (friction >= stop || remainingStop! < tickLoss)) {
      block("STOP_BUDGET_NOT_EXECUTABLE", "The planned cash-loss budget cannot absorb stated liquidation friction and at least one full position-sized price tick. Stop fills remain unguaranteed.");
    }
    if (stop !== null && stop > riskBudget) block("PLANNED_RISK_BUDGET_EXCEEDED", "Planned premium decline plus round-trip fees and exit slippage exceeds the fixed 0.5% current-equity risk budget.");
    if (roundedGrossTarget !== null && roundedGrossTarget * 10000n > premium * 8000n) {
      block("PROFIT_TARGET_CAP_EXCEEDED", "The indicative exit rounded to the declared quote tick requires more than the configured 80% premium-gain ceiling.");
    }
    if ((capital ?? premium) > 2500n) block("LEGACY_MAX_LOSS_LIMIT_EXCEEDED", "Full premium plus the fee reserve exceeds the separately recorded $25 normal stress-loss cap; the planned stop does not replace this cap.");
    return result(scenario, economics, blockers);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "NUMERIC_OVERFLOW") throw error;
    return result(scenario, null, [{ code: "NUMERIC_OVERFLOW", message: "Scenario arithmetic exceeds the safe integer-cent output range." }]);
  }
}
