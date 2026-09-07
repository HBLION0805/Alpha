import type { OptionContract, OptionQuote } from "./OptionsContractQuote";

export type OptionsStructure = "LONG_CALL" | "LONG_PUT" | "BULL_CALL_DEBIT" | "BEAR_PUT_DEBIT" |
  "BULL_PUT_CREDIT" | "BEAR_CALL_CREDIT" | "LONG_STRADDLE" | "LONG_STRANGLE";
export interface OptionsStructureLeg {
  readonly side: "BUY" | "SELL";
  readonly contract: OptionContract;
  readonly quote: OptionQuote | null;
}
export interface OptionsStructureCandidate {
  readonly candidateId: string;
  readonly structure: OptionsStructure;
  /** Equal whole-contract quantity on every leg. Ratios are unsupported. */
  readonly quantity: number;
  readonly legs: readonly OptionsStructureLeg[];
  readonly costs: {
    readonly entryFeesCents: number | null;
    readonly exitFeesCents: number | null;
    readonly exitSlippageReserveCents: number | null;
    readonly reference: string | null;
  };
}
/** An independent declared comparison, never a broker balance or a live quote adapter. */
export interface OptionsStructureComparison {
  readonly version: "OPTIONS_STRUCTURE_COMPARISON_INPUT_V1";
  readonly comparisonId: string;
  readonly origin: "SYNTHETIC_FIXTURE" | "UNVERIFIED_IMPORT";
  readonly symbol: "GLD" | "IBIT";
  readonly asOf: string;
  readonly expiryDate: string;
  readonly referencePriceCents: number;
  readonly initialEquityCents: 100000;
  readonly availableSettledCashCents: number | null;
  readonly terminalPricesCents: readonly number[];
  readonly candidates: readonly OptionsStructureCandidate[];
}
