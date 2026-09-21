import type { TradeThesis, ThesisDraft } from './OptionsTradeThesis';
/** Owner-reported records are never authenticated brokerage events. */
export type ManualLedgerOrigin = "OWNER_REPORTED_UNVERIFIED" | "SYNTHETIC_FIXTURE";
export interface ManualOptionIdentity {
  symbol: "GLD" | "IBIT";
  expiry: string;
  optionType: "CALL" | "PUT";
  strikeUsd: string;
  multiplier: 100;
}
export interface ManualTradePlan {
  declaredAt: string;
  maxContracts: number;
  maxEntryDebitUsd: string;
  plannedRiskUsd: string;
  targetNetProfitUsd: string;
  stopPremiumUsd: string | null;
  entryDeadlineAt: string | null;
  timeExitAt: string | null;
  thesis: string;
  invalidation?: TradeThesis;
  predictionEvidence?: { path: string; fingerprint: string };
}
export interface ManualActivityReference {
  studyId: string;
  studyFingerprint: string;
  candidateId: string;
}
export interface ManualFillValues {
  executionSequence: number;
  executedAt: string;
  action: "BUY_TO_OPEN" | "SELL_TO_CLOSE";
  quantity: number;
  pricePerShareUsd: string;
  feesUsd: string | null;
  externalExecutionRef: string | null;
  evidence: { description: string; documentSha256: string | null } | null;
  exitReason: "NOT_APPLICABLE" | "STOP" | "TARGET" | "TIME" | "MANUAL" | "UNKNOWN";
}
export type ManualLedgerCommand =
  | { type: "SAVE_PLAN_DRAFT"; requestId: string; tradeId: string; draft: ThesisDraft }
  | { type: "SAVE_POSITION_REVIEW"; requestId: string; tradeId: string; review: any }
  | { type: "REGISTER_TRADE"; requestId: string; tradeId: string; contract: ManualOptionIdentity; plan: ManualTradePlan | null; activityReference: ManualActivityReference | null }
  | { type: "RECORD_FILL"; requestId: string; tradeId: string; fillId: string; fill: ManualFillValues }
  | { type: "CORRECT_FILL"; requestId: string; tradeId: string; fillId: string; expectedRevision: number; reason: string; replacement: ManualFillValues | null };
export interface ManualLedgerEvent { sequence: number; recordedAt: string; savedAt: string; command: ManualLedgerCommand }
export interface ManualLedgerInput { ledgerId: string; origin: ManualLedgerOrigin; createdAt: string; events: readonly ManualLedgerEvent[] }
