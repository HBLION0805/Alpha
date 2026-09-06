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
  "roundTripFeesCents", "slippageReserveCents", "mode", "profitTargetBps",
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
  "With the current $25 stress cap, a 2% premium stop, and cent-denominated standard 100-share ticks, no scenario can satisfy both stop executability and the stress cap.",
  "The requested stop is 2% of entry premium, not account equity, and is not a guaranteed maximum loss or fill price.",
  "Entry assumes a limit fill at the stated ask with no entry slippage; the slippage reserve models exit slippage only.",
  "Capital and pre-exercise stress loss include the full round-trip fee reserve. Stress loss is full premium plus fees and excludes stock exposure after exercise.",
  "An explicit zero fee or slippage reserve is an unverified zero-cost scenario assumption.",
  "The gross profit target is a mathematical threshold, not an executable order price; independent tick rounding and order checks would be required.",
  "The 80% conditional target ceiling limits the configured target, not the actual realized outcome.",
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
    schemaVersion: "1.0",
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
  integer("profitTargetBps", 5000);
  if (typeof values.profitTargetBps === "number" &&
      (values.profitTargetBps > 8000 || (values.mode === "NORMAL" && values.profitTargetBps !== 5000))) {
    issues.push("Normal profit target must be 5000 bps; conditional target must be 5000 through 8000 bps.");
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
    const stop = premium * 200n / 10000n;
    const normalBudget = equity * 500n / 10000n;
    const requestedBudget = equity * (scenario.mode === "CONDITIONAL" ? 1000n : 500n) / 10000n;
    const grossTarget = (premium * BigInt(scenario.profitTargetBps) + 9999n) / 10000n;
    const fees = scenario.roundTripFeesCents === null ? null : BigInt(scenario.roundTripFeesCents);
    const slippage = scenario.slippageReserveCents === null ? null : BigInt(scenario.slippageReserveCents);
    const capital = fees === null ? null : premium + fees;
    const friction = fees === null || slippage === null ? null :
      BigInt(scenario.askPerShareCents - scenario.bidPerShareCents) * quantityMultiplier + fees + slippage;
    const remainingStop = friction === null ? null : stop - friction;
    const netTarget = fees === null || slippage === null ? null : grossTarget - fees - slippage;
    const nullableMoney = (value: bigint | null): number | null => value === null ? null : money(value);
    const economics: OptionsRetailFeasibilityEconomics = {
      normalAllocationBudgetCents: money(normalBudget),
      requestedAllocationBudgetCents: money(requestedBudget),
      applicableAllocationBudgetCents: money(normalBudget),
      premiumCents: money(premium),
      capitalRequiredCents: nullableMoney(capital),
      plannedStopBasis: "ENTRY_PREMIUM",
      plannedStopBps: 200,
      plannedStopCents: money(stop),
      oneTickLossCents: money(tickLoss),
      grossProfitTargetCents: money(grossTarget),
      netProfitTargetCents: nullableMoney(netTarget),
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
    if (tickLoss > stop || (friction !== null && (friction >= stop || remainingStop! < tickLoss))) {
      block("STOP_BUDGET_NOT_EXECUTABLE", "The 2% premium stop cannot absorb stated liquidation friction and at least one full position-sized price tick. Stop fills remain unguaranteed.");
    }
    if ((capital ?? premium) > 2500n) block("LEGACY_MAX_LOSS_LIMIT_EXCEEDED", "Full premium plus the fee reserve exceeds the separately recorded $25 normal stress-loss cap; the planned stop does not replace this cap.");
    return result(scenario, economics, blockers);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "NUMERIC_OVERFLOW") throw error;
    return result(scenario, null, [{ code: "NUMERIC_OVERFLOW", message: "Scenario arithmetic exceeds the safe integer-cent output range." }]);
  }
}
