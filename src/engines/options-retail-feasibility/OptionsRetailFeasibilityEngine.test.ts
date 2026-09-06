import type {
  OptionsRetailFeasibilityBlockerCode,
  OptionsRetailFeasibilityInput,
  OptionsRetailFeasibilityResult,
} from "../../contracts/OptionsRetailFeasibility";
import { evaluateOptionsRetailFeasibility as evaluate } from "./OptionsRetailFeasibilityEngine";

let passed = 0;
function test(label: string, run: () => void): void { run(); passed++; console.log(`PASS ${label}`); }
function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}.`);
}
function truth(value: unknown): asserts value { if (!value) throw new Error("Assertion failed."); }
function has(result: OptionsRetailFeasibilityResult, code: OptionsRetailFeasibilityBlockerCode): boolean {
  return result.blockers.some((blocker) => blocker.code === code);
}
function economics(result: OptionsRetailFeasibilityResult) {
  truth(result.economics !== null); return result.economics;
}
const base: OptionsRetailFeasibilityInput = {
  symbol: "GLD", strategy: "LONG_CALL", currentEquityCents: 100000, settledCashCents: 100000,
  quantity: 1, contractMultiplier: 100, bidPerShareCents: 47, askPerShareCents: 50,
  minimumPriceTickCents: 1, roundTripFeesCents: 0, slippageReserveCents: 0,
  mode: "NORMAL", profitTargetBps: 5000,
};
function changed(overrides: Partial<OptionsRetailFeasibilityInput> = {}) { return { ...base, ...overrides }; }

test("$1000 account / $50 premium means a $1 premium-based stop and $25 gross target", () => {
  const output = evaluate(base); const amounts = economics(output);
  equal(amounts.normalAllocationBudgetCents, 5000); equal(amounts.premiumCents, 5000);
  equal(amounts.plannedStopCents, 100); equal(amounts.plannedStopBasis, "ENTRY_PREMIUM");
  equal(amounts.plannedStopBps, 200); equal(amounts.grossProfitTargetCents, 2500);
  equal(amounts.stressLossCents, 5000); equal(output.status, "NO_TRADE");
});
test("bid $0.47 / ask $0.50 costs $3 to liquidate one standard contract before fees", () => {
  const output = evaluate(base); const amounts = economics(output);
  equal(amounts.immediateLiquidationFrictionCents, 300); equal(amounts.remainingStopCapacityCents, -200);
  equal(amounts.oneTickLossCents, 100); truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
  truth(has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
});
test("$100 conditional premium means $2 stop but no approved increase", () => {
  const output = evaluate(changed({ mode: "CONDITIONAL", askPerShareCents: 100, bidPerShareCents: 100,
    profitTargetBps: 8000, claimedWinProbabilityBps: 10000 }));
  const amounts = economics(output);
  equal(amounts.premiumCents, 10000); equal(amounts.plannedStopCents, 200);
  equal(amounts.grossProfitTargetCents, 8000); equal(amounts.requestedAllocationBudgetCents, 10000);
  equal(amounts.normalAllocationBudgetCents, 5000); equal(amounts.applicableAllocationBudgetCents, 5000);
  truth(has(output, "UNCALIBRATED_WIN_RATE")); truth(has(output, "ALLOCATION_BUDGET_EXCEEDED"));
});
test("zero-spread $25 premium still cannot fit a full $1 tick inside its $0.50 stop", () => {
  const output = evaluate(changed({ askPerShareCents: 25, bidPerShareCents: 25 }));
  const amounts = economics(output);
  equal(amounts.plannedStopCents, 50); equal(amounts.oneTickLossCents, 100);
  equal(amounts.legacyNormalMaxLossCents, 2500); equal(amounts.legacyEventMaxLossCents, 1250);
  truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE")); truth(!has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
});
test("adding one cent of fees to the $25 premium exceeds legacy stress cap", () => {
  const output = evaluate(changed({ askPerShareCents: 25, bidPerShareCents: 25, roundTripFeesCents: 1 }));
  equal(economics(output).stressLossCents, 2501); truth(has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
});
test("all zero-friction integer-cent premiums remain blocked by incompatible stop/tick/cap policies", () => {
  for (let price = 1; price <= 200; price++) {
    const output = evaluate(changed({ bidPerShareCents: price, askPerShareCents: price }));
    equal(output.status, "NO_TRADE");
    truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE") || has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
    truth(output.disclosures.some((message) => message.includes("no scenario can satisfy both")));
  }
});
for (const symbol of ["GLD", "IBIT"] as const) for (const strategy of ["LONG_CALL", "LONG_PUT"] as const) {
  test(`${symbol} ${strategy} is evaluated without granting execution or verified origin`, () => {
    const output = evaluate(changed({ symbol, strategy }));
    truth(!has(output, "INVALID_INPUT")); equal(output.executionAllowed, false);
    equal(output.evidenceOrigin, "MANUAL_SCENARIO"); equal(output.unverifiedRequirements.length, 5);
  });
}
for (const claim of [null, 0, 7999, 8000, 8001, 10000]) {
  test(`claimed probability ${claim} cannot increase allocation or change economics`, () => {
    const reference = evaluate(changed({ mode: "CONDITIONAL" }));
    const output = evaluate(changed({ mode: "CONDITIONAL", claimedWinProbabilityBps: claim }));
    equal(output.economics, reference.economics); equal(output.blockers, reference.blockers);
    truth(has(output, "UNCALIBRATED_WIN_RATE")); equal(output.executionAllowed, false);
  });
}
test("normal-mode 100% probability claim leaves normal policy and economics unchanged", () => {
  const output = evaluate(changed({ claimedWinProbabilityBps: 10000 }));
  equal(output.economics, evaluate(base).economics); equal(output.blockers, evaluate(base).blockers);
});
for (const field of ["roundTripFeesCents", "slippageReserveCents"] as const) {
  test(`unknown ${field} blocks and does not invent a numerical friction or net target`, () => {
    const output = evaluate(changed({ [field]: null })); const amounts = economics(output);
    truth(has(output, "COSTS_UNKNOWN")); equal(amounts.immediateLiquidationFrictionCents, null);
    equal(amounts.netProfitTargetCents, null); equal(amounts.remainingStopCapacityCents, null);
    if (field === "roundTripFeesCents") { equal(amounts.capitalRequiredCents, null); equal(amounts.stressLossCents, null); }
    else { equal(amounts.capitalRequiredCents, 5000); equal(amounts.stressLossCents, 5000); }
  });
}
test("fees and exit slippage have explicitly different capital and stress roles", () => {
  const output = evaluate(changed({ bidPerShareCents: 50, roundTripFeesCents: 10, slippageReserveCents: 20 }));
  const amounts = economics(output);
  equal(amounts.capitalRequiredCents, 5010); equal(amounts.stressLossCents, 5010);
  equal(amounts.immediateLiquidationFrictionCents, 30); equal(amounts.netProfitTargetCents, 2470);
  equal(amounts.remainingStopCapacityCents, 70); truth(has(output, "ALLOCATION_BUDGET_EXCEEDED"));
  truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("a gross target may produce a negative net result after explicit costs", () => {
  const amounts = economics(evaluate(changed({ roundTripFeesCents: 2600, slippageReserveCents: 50 })));
  equal(amounts.grossProfitTargetCents, 2500); equal(amounts.netProfitTargetCents, -150);
});
test("exactly one full tick remaining passes only the stop check", () => {
  const output = evaluate(changed({ askPerShareCents: 100, bidPerShareCents: 99 }));
  equal(economics(output).remainingStopCapacityCents, 100); truth(!has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
  truth(has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED")); equal(output.executionAllowed, false);
});
test("one cent less than a full tick remaining fails the stop check", () => {
  const output = evaluate(changed({ askPerShareCents: 100, bidPerShareCents: 99, slippageReserveCents: 1 }));
  equal(economics(output).remainingStopCapacityCents, 99); truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("friction equal to planned stop is insufficient", () => {
  const output = evaluate(changed({ askPerShareCents: 100, bidPerShareCents: 98 }));
  equal(economics(output).remainingStopCapacityCents, 0); truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("a five-cent quote tick costs $5 per standard contract even at zero spread", () => {
  const output = evaluate(changed({ minimumPriceTickCents: 5, askPerShareCents: 100, bidPerShareCents: 100 }));
  equal(economics(output).oneTickLossCents, 500); truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("all tick and quote movements use full position quantity", () => {
  const output = evaluate(changed({ quantity: 2, askPerShareCents: 100, bidPerShareCents: 99 }));
  const amounts = economics(output);
  equal(amounts.premiumCents, 20000); equal(amounts.plannedStopCents, 400);
  equal(amounts.oneTickLossCents, 200); equal(amounts.immediateLiquidationFrictionCents, 200);
  equal(amounts.remainingStopCapacityCents, 200); truth(!has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("allocation is rounded down from current equity instead of fixed initial $1000", () => {
  const amounts = economics(evaluate(changed({ currentEquityCents: 100019 })));
  equal(amounts.normalAllocationBudgetCents, 5000);
  equal(economics(evaluate(changed({ currentEquityCents: 50000 }))).normalAllocationBudgetCents, 2500);
});
test("fractional-cent gross targets round up conservatively", () => {
  const amounts = economics(evaluate(changed({ askPerShareCents: 3, bidPerShareCents: 3,
    mode: "CONDITIONAL", profitTargetBps: 5111 })));
  equal(amounts.premiumCents, 300); equal(amounts.grossProfitTargetCents, 154);
  equal(amounts.plannedStopCents, 6);
});
test("settled cash is checked separately from equity and premium budget", () => {
  const output = evaluate(changed({ settledCashCents: 4999 }));
  truth(has(output, "SETTLED_CASH_INSUFFICIENT")); truth(!has(output, "ALLOCATION_BUDGET_EXCEEDED"));
  truth(!has(evaluate(changed({ settledCashCents: 5000 })), "SETTLED_CASH_INSUFFICIENT"));
});
test("unknown fees do not hide proven premium-only cash and allocation shortfalls", () => {
  const output = evaluate(changed({ askPerShareCents: 51, settledCashCents: 4999, roundTripFeesCents: null }));
  truth(has(output, "COSTS_UNKNOWN")); truth(has(output, "SETTLED_CASH_INSUFFICIENT"));
  truth(has(output, "ALLOCATION_BUDGET_EXCEEDED")); truth(has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
});
test("zero bid is an explicit illiquid scenario and not an invalid negative quote", () => {
  const output = evaluate(changed({ bidPerShareCents: 0 }));
  truth(!has(output, "INVALID_INPUT")); equal(economics(output).immediateLiquidationFrictionCents, 5000);
  truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});

const invalidInputs: readonly [string, unknown][] = [
  ["unsupported QQQ", { ...base, symbol: "QQQ" }],
  ["unsupported lower-case symbol", { ...base, symbol: "gld" }],
  ["unsupported debit spread", { ...base, strategy: "BULL_CALL_DEBIT_SPREAD" }],
  ["fractional contract", { ...base, quantity: 0.5 }],
  ["zero contracts", { ...base, quantity: 0 }],
  ["nonstandard multiplier", { ...base, contractMultiplier: 10 }],
  ["negative quote", { ...base, bidPerShareCents: -1 }],
  ["crossed quote", { ...base, bidPerShareCents: 51 }],
  ["off-tick bid", { ...base, minimumPriceTickCents: 5 }],
  ["off-tick ask", { ...base, bidPerShareCents: 45, askPerShareCents: 51, minimumPriceTickCents: 5 }],
  ["zero tick", { ...base, minimumPriceTickCents: 0 }],
  ["sub-cent tick", { ...base, minimumPriceTickCents: 0.5 }],
  ["zero ask", { ...base, askPerShareCents: 0, bidPerShareCents: 0 }],
  ["zero equity", { ...base, currentEquityCents: 0 }],
  ["negative settled cash", { ...base, settledCashCents: -1 }],
  ["negative fees", { ...base, roundTripFeesCents: -1 }],
  ["fractional slippage cents", { ...base, slippageReserveCents: 0.1 }],
  ["nonfinite quantity", { ...base, quantity: Infinity }],
  ["NaN equity", { ...base, currentEquityCents: NaN }],
  ["unsafe integer quote", { ...base, askPerShareCents: Number.MAX_SAFE_INTEGER + 1 }],
  ["numeric string", { ...base, quantity: "1" }],
  ["event mode unsupported", { ...base, mode: "EVENT" }],
  ["normal target not 50%", { ...base, profitTargetBps: 5100 }],
  ["conditional target below 50%", { ...base, mode: "CONDITIONAL", profitTargetBps: 4999 }],
  ["conditional target exceeds 80%", { ...base, mode: "CONDITIONAL", profitTargetBps: 8001 }],
  ["fractional target bps", { ...base, mode: "CONDITIONAL", profitTargetBps: 5500.5 }],
  ["probability exceeds 100%", { ...base, claimedWinProbabilityBps: 10001 }],
  ["negative probability", { ...base, claimedWinProbabilityBps: -1 }],
  ["undefined probability is not JSON null", { ...base, claimedWinProbabilityBps: undefined }],
  ["caller cannot override max loss", { ...base, maxLossCents: 10000 }],
  ["caller cannot inject trading permission", { ...base, executionAllowed: true }],
  ["null object", null], ["array", []], ["class instance", new Date(0)],
  ["symbol-key injection", { ...base, [Symbol("override")]: true }],
];
for (const [label, input] of invalidInputs) test(`invalid input rejects ${label}`, () => {
  const output = evaluate(input);
  equal(output.status, "NO_TRADE"); equal(output.executionAllowed, false);
  equal(output.scenario, null); equal(output.economics, null); truth(has(output, "INVALID_INPUT"));
});
test("every required field is required, including explicitly unknown costs", () => {
  for (const key of Object.keys(base)) {
    const input: Record<string, unknown> = { ...base }; delete input[key];
    truth(has(evaluate(input), "INVALID_INPUT"));
  }
});
test("accessors are rejected without invoking their code", () => {
  let invoked = false;
  const input = { ...base };
  Object.defineProperty(input, "quantity", { enumerable: true, get() { invoked = true; return 1; } });
  truth(has(evaluate(input), "INVALID_INPUT")); equal(invoked, false);
});
test("unrecognized nonenumerable values are rejected", () => {
  const input = { ...base }; Object.defineProperty(input, "approval", { value: true });
  truth(has(evaluate(input), "INVALID_INPUT"));
});
test("BigInt intermediate multiplication preserves safe final allocation", () => {
  const amounts = economics(evaluate(changed({ currentEquityCents: Number.MAX_SAFE_INTEGER })));
  equal(amounts.normalAllocationBudgetCents, 450359962737049);
});
for (const [label, input] of [
  ["premium multiplication", changed({ askPerShareCents: Number.MAX_SAFE_INTEGER })],
  ["quantity multiplication", changed({ quantity: Number.MAX_SAFE_INTEGER })],
  ["fee addition", changed({ roundTripFeesCents: Number.MAX_SAFE_INTEGER })],
  ["friction addition", changed({ slippageReserveCents: Number.MAX_SAFE_INTEGER })],
] as const) test(`overflow in ${label} returns no partial economics`, () => {
  const output = evaluate(input);
  equal(output.status, "NO_TRADE"); equal(output.executionAllowed, false);
  equal(output.economics, null); truth(has(output, "NUMERIC_OVERFLOW"));
});
test("all output objects and arrays are deeply frozen without freezing caller input", () => {
  const input = changed(); const output = evaluate(input);
  function assertFrozen(value: unknown): void {
    if (value !== null && typeof value === "object") {
      truth(Object.isFrozen(value)); for (const child of Object.values(value)) assertFrozen(child);
    }
  }
  assertFrozen(output); truth(!Object.isFrozen(input));
  input.askPerShareCents = 100; equal(output.scenario?.askPerShareCents, 50);
  assertFrozen(evaluate(null));
});
test("JSON roundtrip preserves numerical diagnostic and execution prohibition", () => {
  const output = evaluate(JSON.parse(JSON.stringify(base)));
  equal(JSON.parse(JSON.stringify(output)), output); equal(output.executionAllowed, false);
  truth(output.disclosures.some((text) => text.includes("not an executable order price")));
  truth(output.disclosures.some((text) => text.includes("not the actual realized outcome")));
});

console.log(`Options Retail Feasibility: ${passed}/${passed} passed.`);
