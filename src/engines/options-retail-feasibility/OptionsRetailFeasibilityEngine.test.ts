import type {
  OptionsRetailFeasibilityBlockerCode,
  OptionsRetailFeasibilityInput,
  OptionsRetailFeasibilityResult,
} from "../../contracts/OptionsRetailFeasibility";
import { evaluateOptionsRetailFeasibility as evaluate } from "./OptionsRetailFeasibilityEngine";

let passed = 0;
function test(label: string, run: () => void): void { run(); passed++; console.log('PASS ' + label); }
function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Expected ' + JSON.stringify(expected) + '; got ' + JSON.stringify(actual));
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
  quantity: 1, contractMultiplier: 100, bidPerShareCents: 24, askPerShareCents: 25,
  minimumPriceTickCents: 1, roundTripFeesCents: 0, slippageReserveCents: 0,
  mode: "NORMAL", stopLossBps: 2000, rewardMultipleMilliR: 2000,
};
function changed(overrides: Partial<OptionsRetailFeasibilityInput> = {}) { return { ...base, ...overrides }; }

test("$25 premium / 20% stop / 2R is a feasible $5 risk and $10 net gain scenario", () => {
  const output = evaluate(base); const amounts = economics(output);
  equal(output.schemaVersion, "2.0"); equal(output.status, "ECONOMICALLY_FEASIBLE_SCENARIO");
  equal(output.blockers, []); equal(output.executionAllowed, false);
  equal(amounts.normalAllocationBudgetCents, 5000); equal(amounts.premiumCents, 2500);
  equal(amounts.grossStopLossCents, 500); equal(amounts.plannedStopCents, 500);
  equal(amounts.plannedStopBasis, "ENTRY_PREMIUM_PLUS_COSTS"); equal(amounts.plannedStopBps, 2000);
  equal(amounts.plannedRiskBudgetCents, 500); equal(amounts.plannedRiskBudgetBps, 50);
  equal(amounts.netProfitTargetCents, 1000); equal(amounts.grossProfitTargetCents, 1000);
  equal(amounts.indicativeExitLimitPerShareCents, 35); equal(amounts.profitTargetPriceIsIndicative, true);
  equal(amounts.roundedGrossProfitTargetCents, 1000); equal(amounts.roundedNetProfitTargetCents, 1000);
  equal(amounts.stressLossCents, 2500);
});
test("10% and 20% compare explicit risk dollars without claiming either stop is optimal", () => {
  const tighter = economics(evaluate(changed({ stopLossBps: 1000 })));
  const wider = economics(evaluate(base));
  equal(tighter.plannedStopCents, 250); equal(tighter.netProfitTargetCents, 500);
  equal(tighter.indicativeExitLimitPerShareCents, 30);
  equal(wider.plannedStopCents, 500); equal(wider.netProfitTargetCents, 1000);
});
test("1.5R requested gain and upward quote rounding are displayed separately", () => {
  const output = evaluate(changed({ rewardMultipleMilliR: 1500 })); const amounts = economics(output);
  equal(output.status, "ECONOMICALLY_FEASIBLE_SCENARIO");
  equal(amounts.netProfitTargetCents, 750); equal(amounts.grossProfitTargetCents, 750);
  equal(amounts.indicativeExitLimitPerShareCents, 33);
  equal(amounts.roundedGrossProfitTargetCents, 800); equal(amounts.roundedNetProfitTargetCents, 800);
});
test("$50 premium fits allocation but fails both the $25 full-loss cap and $5 planned risk", () => {
  const output = evaluate(changed({ bidPerShareCents: 49, askPerShareCents: 50 }));
  equal(economics(output).plannedStopCents, 1000);
  truth(has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED")); truth(has(output, "PLANNED_RISK_BUDGET_EXCEEDED"));
  truth(!has(output, "ALLOCATION_BUDGET_EXCEEDED"));
});
test("one cent of fees pushes the boundary scenario beyond both independent loss budgets", () => {
  const output = evaluate(changed({ roundTripFeesCents: 1 })); const amounts = economics(output);
  equal(amounts.stressLossCents, 2501); equal(amounts.plannedStopCents, 501);
  truth(has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED")); truth(has(output, "PLANNED_RISK_BUDGET_EXCEEDED"));
});
test("all-in R includes fees/slippage exactly once and targets preserve net R after those costs", () => {
  const output = evaluate(changed({ bidPerShareCents: 19, askPerShareCents: 20, roundTripFeesCents: 10, slippageReserveCents: 20 }));
  const amounts = economics(output);
  equal(output.status, "ECONOMICALLY_FEASIBLE_SCENARIO");
  equal(amounts.grossStopLossCents, 400); equal(amounts.plannedStopCents, 430);
  equal(amounts.capitalRequiredCents, 2010); equal(amounts.stressLossCents, 2010);
  equal(amounts.immediateLiquidationFrictionCents, 130); equal(amounts.remainingStopCapacityCents, 300);
  equal(amounts.netProfitTargetCents, 860); equal(amounts.grossProfitTargetCents, 890);
  equal(amounts.indicativeExitLimitPerShareCents, 29);
  equal(amounts.roundedGrossProfitTargetCents, 900); equal(amounts.roundedNetProfitTargetCents, 870);
});
test("fees alone cannot manufacture additional stop room", () => {
  const free = economics(evaluate(changed({ bidPerShareCents: 19, askPerShareCents: 20 })));
  const costly = economics(evaluate(changed({ bidPerShareCents: 19, askPerShareCents: 20, roundTripFeesCents: 100 })));
  equal(free.remainingStopCapacityCents, costly.remainingStopCapacityCents);
  equal(costly.plannedStopCents, 500); equal(costly.immediateLiquidationFrictionCents, 200);
});
test("known exit slippage can exceed the account risk budget without changing full-premium stress", () => {
  const output = evaluate(changed({ slippageReserveCents: 1 }));
  equal(economics(output).plannedStopCents, 501); equal(economics(output).stressLossCents, 2500);
  truth(has(output, "PLANNED_RISK_BUDGET_EXCEEDED")); truth(!has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
});
test("exactly one full price tick beyond liquidation friction passes the stop check", () => {
  const output = evaluate(changed({ bidPerShareCents: 8, askPerShareCents: 10 }));
  equal(economics(output).remainingStopCapacityCents, 0); truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
  const feasible = evaluate(changed({ bidPerShareCents: 9, askPerShareCents: 10 }));
  equal(economics(feasible).remainingStopCapacityCents, 100); truth(!has(feasible, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("one cent below an extra full tick fails even when costs are zero", () => {
  const output = evaluate(changed({ bidPerShareCents: 9, askPerShareCents: 10, stopLossBps: 1999 }));
  equal(economics(output).grossStopLossCents, 199); equal(economics(output).remainingStopCapacityCents, 99);
  truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("a five-cent tick may consume the entire $5 stop before any additional movement", () => {
  const output = evaluate(changed({ minimumPriceTickCents: 5, bidPerShareCents: 20, askPerShareCents: 25 }));
  equal(economics(output).oneTickLossCents, 500); truth(has(output, "STOP_BUDGET_NOT_EXECUTABLE"));
});
test("full-position quantity is used for loss, spread and indicative target grid", () => {
  const output = evaluate(changed({ quantity: 2, bidPerShareCents: 9, askPerShareCents: 10 }));
  const amounts = economics(output);
  equal(output.status, "ECONOMICALLY_FEASIBLE_SCENARIO");
  equal(amounts.premiumCents, 2000); equal(amounts.plannedStopCents, 400);
  equal(amounts.oneTickLossCents, 200); equal(amounts.immediateLiquidationFrictionCents, 200);
  equal(amounts.remainingStopCapacityCents, 200); equal(amounts.indicativeExitLimitPerShareCents, 14);
  equal(amounts.roundedNetProfitTargetCents, 800);
});
test("net fractional-cent targets round up before the quote grid", () => {
  const output = evaluate(changed({ askPerShareCents: 21, bidPerShareCents: 20, stopLossBps: 1001, rewardMultipleMilliR: 1501 }));
  const amounts = economics(output);
  equal(amounts.grossStopLossCents, 210); equal(amounts.netProfitTargetCents, 316);
  equal(amounts.indicativeExitLimitPerShareCents, 25); equal(amounts.roundedNetProfitTargetCents, 400);
});
test("target cap includes upward tick rounding even when unrounded gain is below 80%", () => {
  const output = evaluate(changed({ bidPerShareCents: 1, askPerShareCents: 1, roundTripFeesCents: 10 }));
  const amounts = economics(output);
  equal(amounts.grossProfitTargetCents, 70); equal(amounts.roundedGrossProfitTargetCents, 100);
  truth(has(output, "PROFIT_TARGET_CAP_EXCEEDED")); equal(output.executionAllowed, false);
});
test("exactly 80% rounded gain is allowed by the target-cap check", () => {
  const output = evaluate(changed({ bidPerShareCents: 5, askPerShareCents: 5, roundTripFeesCents: 60 }));
  equal(economics(output).roundedGrossProfitTargetCents, 400);
  truth(!has(output, "PROFIT_TARGET_CAP_EXCEEDED"));
});
test("fees can require a mathematical target beyond the premium-gain ceiling", () => {
  const output = evaluate(changed({ roundTripFeesCents: 1000 }));
  equal(economics(output).netProfitTargetCents, 3000); equal(economics(output).grossProfitTargetCents, 4000);
  truth(has(output, "PROFIT_TARGET_CAP_EXCEEDED"));
});
for (const symbol of ["GLD", "IBIT"] as const) for (const strategy of ["LONG_CALL", "LONG_PUT"] as const) {
  test(symbol + ' ' + strategy + ' economics never grant execution or verified evidence', () => {
    const output = evaluate(changed({ symbol, strategy }));
    equal(output.status, "ECONOMICALLY_FEASIBLE_SCENARIO"); equal(output.executionAllowed, false);
    equal(output.evidenceOrigin, "MANUAL_SCENARIO"); equal(output.unverifiedRequirements.length, 5);
  });
}
for (const claim of [null, 0, 7999, 8000, 8001, 10000]) {
  test('claimed probability ' + claim + ' cannot increase allocation or change economics', () => {
    const reference = evaluate(changed({ mode: "CONDITIONAL" }));
    const output = evaluate(changed({ mode: "CONDITIONAL", claimedWinProbabilityBps: claim }));
    equal(output.economics, reference.economics); equal(output.blockers, reference.blockers);
    equal(economics(output).requestedAllocationBudgetCents, 10000);
    equal(economics(output).applicableAllocationBudgetCents, 5000);
    truth(has(output, "UNCALIBRATED_WIN_RATE")); equal(output.executionAllowed, false);
  });
}
test("normal-mode probability claims do not change policy", () => {
  const output = evaluate(changed({ claimedWinProbabilityBps: 10000 }));
  equal(output.economics, evaluate(base).economics); equal(output.blockers, evaluate(base).blockers);
});
for (const field of ["roundTripFeesCents", "slippageReserveCents"] as const) {
  test('unknown ' + field + ' makes R and all target values unknown', () => {
    const output = evaluate(changed({ [field]: null })); const amounts = economics(output);
    truth(has(output, "COSTS_UNKNOWN")); equal(amounts.plannedStopCents, null);
    equal(amounts.grossProfitTargetCents, null); equal(amounts.netProfitTargetCents, null);
    equal(amounts.indicativeExitLimitPerShareCents, null); equal(amounts.roundedGrossProfitTargetCents, null);
    equal(amounts.roundedNetProfitTargetCents, null); equal(amounts.immediateLiquidationFrictionCents, null);
    equal(amounts.remainingStopCapacityCents, null); equal(amounts.grossStopLossCents, 500);
    if (field === "roundTripFeesCents") { equal(amounts.capitalRequiredCents, null); equal(amounts.stressLossCents, null); }
    else { equal(amounts.capitalRequiredCents, 2500); equal(amounts.stressLossCents, 2500); }
  });
}
test("equity-based budgets use current equity and round down", () => {
  const amounts = economics(evaluate(changed({ currentEquityCents: 100019 })));
  equal(amounts.normalAllocationBudgetCents, 5000); equal(amounts.plannedRiskBudgetCents, 500);
  const smaller = evaluate(changed({ currentEquityCents: 50000 }));
  equal(economics(smaller).normalAllocationBudgetCents, 2500); equal(economics(smaller).plannedRiskBudgetCents, 250);
  truth(has(smaller, "PLANNED_RISK_BUDGET_EXCEEDED"));
});
test("settled cash is checked independently from equity", () => {
  const output = evaluate(changed({ settledCashCents: 2499 }));
  truth(has(output, "SETTLED_CASH_INSUFFICIENT")); truth(!has(output, "ALLOCATION_BUDGET_EXCEEDED"));
  truth(!has(evaluate(changed({ settledCashCents: 2500 })), "SETTLED_CASH_INSUFFICIENT"));
});
test("unknown fees do not hide known premium-only funding or stress failures", () => {
  const output = evaluate(changed({ askPerShareCents: 51, settledCashCents: 4999, roundTripFeesCents: null }));
  truth(has(output, "COSTS_UNKNOWN")); truth(has(output, "SETTLED_CASH_INSUFFICIENT"));
  truth(has(output, "ALLOCATION_BUDGET_EXCEEDED")); truth(has(output, "LEGACY_MAX_LOSS_LIMIT_EXCEEDED"));
});
test("zero bid represents illiquid liquidation economics, never a free exit", () => {
  const output = evaluate(changed({ bidPerShareCents: 0 }));
  truth(!has(output, "INVALID_INPUT")); equal(economics(output).immediateLiquidationFrictionCents, 2500);
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
  ["crossed quote", { ...base, bidPerShareCents: 26 }],
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
  ["obsolete premium target field", { ...base, profitTargetBps: 5000 }],
  ["stop below 10%", { ...base, stopLossBps: 999 }],
  ["stop above 25%", { ...base, stopLossBps: 2501 }],
  ["fractional stop bps", { ...base, stopLossBps: 1500.5 }],
  ["reward below 1.5R", { ...base, rewardMultipleMilliR: 1499 }],
  ["reward above 2R", { ...base, rewardMultipleMilliR: 2001 }],
  ["fractional reward units", { ...base, rewardMultipleMilliR: 1500.5 }],
  ["caller cannot override account risk budget", { ...base, plannedRiskBudgetBps: 100 }],
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
  input.askPerShareCents = 100; equal(output.scenario?.askPerShareCents, 25);
  assertFrozen(evaluate(null));
});
test("JSON roundtrip preserves numerical diagnostic and execution prohibition", () => {
  const output = evaluate(JSON.parse(JSON.stringify(base)));
  equal(JSON.parse(JSON.stringify(output)), output); equal(output.executionAllowed, false);
  truth(output.disclosures.some((text) => text.includes("not an executable order price")));
  truth(output.disclosures.some((text) => text.includes("not the actual realized outcome")));
});

console.log(`Options Retail Feasibility: ${passed}/${passed} passed.`);
