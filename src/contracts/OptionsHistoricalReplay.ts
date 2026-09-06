import type { OptionsMarketEvidence } from "../engines/options-market-evidence/OptionsMarketEvidenceEngine";

export interface OptionsHistoricalReplayConfig {
  readonly schemaVersion: "1.0";
  readonly runId: string;
  readonly datasetId: string;
  readonly contractKey: string;
  readonly plan: {
    readonly strategyVersion: string;
    readonly setupKey: string;
    readonly decisionAt: string;
    readonly entryDeadlineAt: string;
    readonly timeExitAt: string;
    readonly entryLimitPerShareCents: number;
    readonly quantity: number;
    readonly stopLossBps: number;
    readonly rewardMultipleMilliR: number;
    readonly maxEntrySpreadPerShareCents: number;
    readonly thesis: {
      readonly direction: "BULLISH" | "BEARISH";
      readonly magnitude: string;
      readonly horizon: string;
      readonly volatility: string;
      readonly path: string;
      readonly invalidation: string;
      readonly monthlyContext: string;
      readonly dailySetup: string;
      readonly intradayTrigger: string;
    };
  };
  readonly assumptions: {
    readonly contractTerms: null | {
      readonly multiplier: 100;
      readonly deliverable: "STANDARD_100_SHARES_USD";
      readonly exerciseStyle: "AMERICAN";
      readonly minimumPriceTickCents: number;
      readonly reference: string;
    };
    readonly session: null | {
      readonly sessionDate: string;
      readonly marketOpen: string;
      readonly marketClose: string;
      readonly reference: string;
    };
    readonly costs: null | {
      readonly entryFeeCents: number;
      readonly exitFeeCents: number;
      readonly exitSlippagePerShareCents: number;
      readonly reference: string;
    };
    readonly liquidityModel: "REQUIRE_CONTEMPORANEOUS_SIZE" | "ASSUME_RECORDED_SIZE_AVAILABLE";
    readonly acknowledgeCounterfactual: boolean;
  };
}

export interface OptionsHistoricalReplayFill {
  readonly snapshotAt: string;
  /** Zero-based position in the immutable evidence.rows input. */
  readonly rowIndex: number;
  readonly pricePerShareCents: number;
  readonly quantity: number;
  readonly premiumCents: number;
  readonly feeCents: number;
  readonly classification: "ASSUMED_FILL";
}

export interface OptionsHistoricalReplayEvent {
  readonly sequence: number;
  readonly type: string;
  readonly at: string;
  readonly rowIndex: number | null;
  readonly amountCents: number;
  readonly detail: string;
}

export interface OptionsHistoricalReplayResult {
  readonly schemaVersion: "1.0";
  readonly engineVersion: "SAMPLED_OPTIONS_REPLAY_V1";
  readonly runId: string;
  readonly recordedAt: string;
  readonly config: OptionsHistoricalReplayConfig;
  readonly evidenceFingerprint: string | null;
  readonly planFingerprint: string;
  readonly origin: "SYNTHETIC_FIXTURE" | "OWNER_PROVIDED_FILE" | "MISSING_DATA";
  readonly symbol: "GLD" | "IBIT" | null;
  readonly importedAt: string | null;
  readonly sourceFileSha256: string | null;
  readonly researchMode: "COUNTERFACTUAL_SNAPSHOT_TIME";
  readonly selectionStatus: "RETROSPECTIVE_DECLARATION";
  readonly exitModel: "NEXT_SNAPSHOT_MARKET_EXIT";
  readonly sourceQuoteClock: "AMERICA_NEW_YORK_INTERVAL_END";
  /** Last selected source timestamp, including rows outside the modeled session. */
  readonly sourceCoverageThroughAt: string | null;
  /** Last clock actually processed by this bounded run; never beyond session close. */
  readonly evaluatedThroughAt: string | null;
  readonly status: "BLOCKED" | "NO_TRADE" | "ENTRY_PENDING" | "OPEN" | "EXIT_PENDING" | "CLOSED";
  readonly blockers: readonly string[];
  readonly entry: OptionsHistoricalReplayFill | null;
  readonly exit: OptionsHistoricalReplayFill | null;
  readonly exitReason: "TARGET" | "STOP" | "TIME_EXIT" | null;
  readonly triggerAt: string | null;
  readonly plannedRiskCents: number | null;
  readonly netTargetCents: number | null;
  readonly netPnlCents: number | null;
  readonly entrySpreadCents: number | null;
  readonly quoteGapObserved: boolean;
  readonly exitLiquidityDelayed: boolean;
  readonly account: {
    readonly initialEquityCents: 100000;
    readonly settledCashCents: number;
    readonly unsettledCashCents: number;
    readonly reservedCashCents: number;
    readonly openPositionCount: 0 | 1;
    /** Total modeled equity; null when an open position has no usable final bid mark. */
    readonly unrealizedEquityCents: number | null;
  };
  readonly events: readonly OptionsHistoricalReplayEvent[];
  readonly assumptions: OptionsHistoricalReplayConfig["assumptions"];
  readonly limitations: readonly string[];
  readonly executionAllowed: false;
  readonly marketValidated: false;
  readonly winProbability: null;
}

export interface OptionsHistoricalReplayCase {
  readonly config: OptionsHistoricalReplayConfig;
  readonly evidence: OptionsMarketEvidence | null;
  readonly recordedAt: string;
}
