import type { ManualFillValues, ManualLedgerCommand } from "../../contracts/OptionsManualLedger";
export const manualFixtureCreatedAt = "2026-09-01T12:00:00.000Z";
export function manualRegistration(tradeId = "fixture-gld-call"): ManualLedgerCommand {
  return { type: "REGISTER_TRADE", requestId: "register-" + tradeId, tradeId,
    contract: { symbol: "GLD", expiry: "2026-09-18", optionType: "CALL", strikeUsd: "410.00", multiplier: 100 },
    plan: { declaredAt: "2026-09-01T12:00:00.000Z", maxContracts: 3, maxEntryDebitUsd: "50.00", plannedRiskUsd: "5.00", targetNetProfitUsd: "10.00",
      stopPremiumUsd: "0.08", entryDeadlineAt: "2026-09-01T15:00:00.000Z", timeExitAt: "2026-09-04T19:00:00.000Z", thesis: "Synthetic accounting demonstration only." }, activityReference: null };
}
export function manualFill(sequence: number, overrides: Partial<ManualFillValues> = {}): ManualFillValues {
  return { executionSequence: sequence, executedAt: `2026-09-01T14:0${sequence}:00.000Z`, action: sequence === 1 ? "BUY_TO_OPEN" : "SELL_TO_CLOSE",
    quantity: sequence === 1 ? 3 : 1, pricePerShareUsd: sequence === 1 ? "0.10" : "0.15", feesUsd: "0.01",
    externalExecutionRef: "fixture-execution-" + sequence, evidence: { description: "Synthetic evidence, not a broker confirmation.", documentSha256: "a".repeat(64) },
    exitReason: sequence === 1 ? "NOT_APPLICABLE" : "MANUAL", ...overrides };
}
export function manualDemoCommands(): ManualLedgerCommand[] {
  const tradeId = "fixture-gld-call";
  return [manualRegistration(), ...[1, 2, 3, 4].map(n => ({ type: "RECORD_FILL" as const, requestId: "record-fill-" + n, tradeId, fillId: "fixture-fill-" + n, fill: manualFill(n) })),
    { type: "CORRECT_FILL", requestId: "correct-fill-four", tradeId, fillId: "fixture-fill-4", expectedRevision: 1, reason: "Synthetic correction of the final sale price.", replacement: manualFill(4, { pricePerShareUsd: "0.05" }) }];
}
