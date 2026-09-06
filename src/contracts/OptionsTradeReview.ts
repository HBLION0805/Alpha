/** Local closed-trade engineering evidence; no field grants trading authority. */
export type OptionsTradePlanViolation =
  | "DATA_INVALID"
  | "COSTS_UNKNOWN"
  | "SPREAD_LIMIT_EXCEEDED"
  | "EXIT_LIQUIDITY_UNAVAILABLE"
  | "PLAN_CHANGED"
  | "RISK_LIMIT_EXCEEDED";

export interface OptionsClosedTradeReviewInput {
  readonly tradeId: string;
  readonly symbol: "GLD" | "IBIT";
  readonly strategyVersion: string;
  readonly setupKey: string;
  readonly origin: "SYNTHETIC_FIXTURE" | "UNVERIFIED_IMPORT";
  readonly planFingerprint: string;
  readonly entryAt: string;
  readonly exitAt: string;
  readonly exitReason: "TARGET" | "STOP" | "TIME_EXIT";
  readonly entryPremiumCents: number;
  /** Sale proceeds after modeled adverse slippage, before fees. */
  readonly exitProceedsCents: number;
  /** Total entry and exit fees; an explicit zero is a modeling assumption. */
  readonly feesCents: number;
  readonly netPnlCents: number;
  readonly plannedRiskCents: number;
  /** Entry bid/ask difference for the entire position, in cents. */
  readonly entrySpreadCents: number;
  readonly exitLiquidityDelayed: boolean;
  readonly quoteGapObserved: boolean;
  readonly planViolations: readonly OptionsTradePlanViolation[];
}

export type OptionsMistakeGuardCode = OptionsTradePlanViolation;

export interface OptionsTradeCandidateLesson {
  readonly code: OptionsTradePlanViolation | "QUOTE_GAP_OBSERVED" | "EXIT_LIQUIDITY_DELAYED" | "LOSS_EXCEEDED_PLANNED_R";
  readonly classification: "REPORTED_PROCESS_VIOLATION" | "EXECUTION_RISK_TO_REVIEW";
  readonly guardCode: OptionsMistakeGuardCode;
  readonly observation: string;
  readonly nextCheck: string;
  readonly causalStatus: "NOT_ESTABLISHED";
  readonly approvedKnowledge: false;
}

export interface OptionsClosedTradeReview {
  readonly schemaVersion: "1.0";
  readonly reviewId: string;
  readonly input: OptionsClosedTradeReviewInput;
  readonly outcome: "WIN" | "LOSS" | "BREAKEVEN";
  readonly grossPnlCents: number;
  /** Arithmetic net PnL / planned R, not a probability or causal inference. */
  readonly realizedR: number;
  readonly processAssessment: "VIOLATIONS_REPORTED" | "NO_VIOLATIONS_REPORTED";
  readonly facts: readonly string[];
  readonly hypotheses: readonly string[];
  readonly candidateLessons: readonly OptionsTradeCandidateLesson[];
  readonly evidenceClassification: "LOCAL_ENGINEERING_CASE";
  readonly winProbability: null;
  readonly approvedKnowledge: false;
  readonly executionAllowed: false;
  readonly fingerprint: string;
}

export interface OptionsMistakeNotebookEntry {
  readonly lessonId: string;
  readonly symbol: "GLD" | "IBIT";
  readonly strategyVersion: string;
  readonly setupKey: string;
  readonly code: OptionsTradeCandidateLesson["code"];
  readonly classification: OptionsTradeCandidateLesson["classification"];
  readonly guardCode: OptionsMistakeGuardCode;
  readonly observation: string;
  readonly nextCheck: string;
  readonly firstRecordedAt: string;
  readonly lastRecordedAt: string;
  readonly supportingTradeIds: readonly string[];
  readonly occurrenceCount: number;
  readonly causalStatus: "NOT_ESTABLISHED";
  readonly approvedKnowledge: false;
}

export interface OptionsMistakeNotebook {
  readonly schemaVersion: "1.0";
  readonly reviewedTradeCount: number;
  readonly reviews: readonly OptionsClosedTradeReview[];
  readonly entries: readonly OptionsMistakeNotebookEntry[];
  readonly executionAllowed: false;
  readonly fingerprint: string;
}

export interface OptionsMistakeGuardInput {
  readonly symbol: "GLD" | "IBIT";
  readonly strategyVersion: string;
  readonly setupKey: string;
  /** Lessons recorded after this instant cannot influence the decision. */
  readonly asOf: string;
  readonly dataValid: boolean;
  readonly costsKnown: boolean;
  /** Current displayed exit-side liquidity only; future liquidity is unknown. */
  readonly exitLiquidityAvailable: boolean;
  readonly entrySpreadCents: number;
  readonly maxEntrySpreadCents: number;
  readonly planUnchanged: boolean;
  readonly riskWithinLimits: boolean;
}

export interface OptionsMistakeGuardResult {
  readonly schemaVersion: "1.0";
  readonly status: "PASS" | "BLOCKED";
  readonly applicableLessonIds: readonly string[];
  readonly blockers: readonly {
    readonly code: OptionsMistakeGuardCode;
    readonly message: string;
    readonly lessonIds: readonly string[];
  }[];
  readonly executionAllowed: false;
  readonly approvedKnowledge: false;
  readonly futureLiquidityGuaranteed: false;
  readonly strategyWeightsChanged: false;
}
