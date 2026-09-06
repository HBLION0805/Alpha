import type { BarDecimal, CanonicalBar } from "./CanonicalBar";
import type { MarketRegimeAssessment, RegimeInputSnapshot } from "./MarketRegime";
import type { OptionsContextInterval } from "./OptionsCandlePolicy";
import type { CanonicalBarReference } from "./VerifiedMarketSnapshot";

export type OptionsContextRejectionCode =
  | "INVALID_CONTRACT" | "INVALID_POLICY" | "INVALID_CANONICAL_BAR"
  | "SOURCE_OR_PROVENANCE_DRIFT" | "SESSION_CALENDAR_DRIFT"
  | "GAPPED_SERIES" | "STALE_SERIES" | "UNRESOLVED_CORPORATE_ACTION"
  | "INSUFFICIENT_HISTORY" | "INSUFFICIENT_VOLUME_BASELINE"
  | "NUMERIC_OVERFLOW" | "TIMEFRAME_REGIME_BINDING_DRIFT" | "REPLAY_CONFLICT";
export interface OptionsQualifiedSeries {
  readonly interval: OptionsContextInterval;
  readonly bars: readonly CanonicalBar[];
  readonly references: readonly CanonicalBarReference[];
  readonly slotIds: readonly string[];
  readonly sessionIds: readonly string[];
  readonly bindingFingerprint: string;
  readonly policyFingerprint: string;
  readonly calendarFingerprint: string;
  readonly corporateActionFingerprint: string;
  readonly asOf: string;
  readonly ageSeconds: number;
  readonly fingerprint: string;
}
export interface OptionsTechnicalFeatures {
  readonly interval: OptionsContextInterval;
  readonly qualifiedSeriesFingerprint: string;
  readonly policyFingerprint: string;
  readonly atr: BarDecimal;
  readonly atrVersion: "WILDER_ATR_V1";
  readonly trueRanges: readonly BarDecimal[];
  readonly returnPpb: readonly string[];
  readonly returnBarIds: readonly string[];
  readonly qualifiedReturnCount: number;
  readonly rvWindowReturnCount: number;
  readonly annualizedVolatilityPpb: string;
  readonly annualizedVolatilityBps: number;
  readonly rvVersion: "SAMPLE_SIMPLE_RETURN_RV_V1";
  readonly annualizationVersion: "REGULAR_SESSION_FIXED_PERIODS_V1";
  readonly periodsPerYear: number;
  readonly volume: {
    readonly baseline: BarDecimal;
    readonly relativeVolumeBps: number;
    readonly category: "BELOW_BASELINE" | "WITHIN_BASELINE" | "ABOVE_BASELINE";
    readonly slotId: string;
    readonly sessionIds: readonly string[];
    readonly policyId: string;
    readonly policyVersion: string;
    readonly policyFingerprint: string;
  };
}
export interface OptionsTimeframeRegimeBinding {
  readonly interval: OptionsContextInterval;
  readonly qualifiedSeriesFingerprint: string;
  readonly inputSnapshotId: string;
  readonly inputSnapshotFingerprint: string;
  readonly assessmentId: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly snapshot: RegimeInputSnapshot;
  readonly assessment: MarketRegimeAssessment;
}
export interface OptionsTimeframeContext {
  readonly series: OptionsQualifiedSeries;
  readonly features: OptionsTechnicalFeatures;
  readonly regime: OptionsTimeframeRegimeBinding;
}
export interface OptionsMarketContext {
  readonly schemaVersion: "1.0";
  readonly contextId: string;
  readonly fingerprint: string;
  readonly asOf: string;
  readonly dataOrigin: "FIXTURE";
  readonly instrumentId: string;
  readonly bindingFingerprint: string;
  readonly policyFingerprint: string;
  readonly timeframes: readonly OptionsTimeframeContext[];
  readonly agreement: "AGREEMENT" | "DISAGREEMENT";
  readonly automatedExecutionAllowed: false;
}
export interface OptionsMarketContextHealth {
  readonly stage: "AUTHORIZATION" | "NORMALIZATION" | "QUALIFICATION" | "FEATURES" | "COMPOSITION" | "PERSISTENCE" | "COMPLETE";
  readonly bindingFingerprint: string;
  readonly calendarFingerprint: string;
  readonly corporateActionFingerprint: string;
  readonly normalizedBarCount: number;
  readonly normalizedBarReferences: readonly { readonly barId: string; readonly fingerprint: string }[];
  readonly qualifiedSeriesCount: number;
  readonly featureCount: number;
  readonly validContextWriteCount: number;
  readonly networkRequestCount: 0;
  readonly credentialReadCount: 0;
  readonly realCostCents: 0;
  readonly latencyStatus: "UNMEASURED_FIXTURE";
}
export type OptionsMarketContextResult = {
  readonly status: "ACCEPTED";
  readonly context: OptionsMarketContext;
  readonly queryResult: readonly OptionsMarketContext[];
  readonly health: OptionsMarketContextHealth;
} | {
  readonly status: "REJECTED";
  readonly reasonCode: OptionsContextRejectionCode;
  readonly queryResult: readonly [];
  readonly health: OptionsMarketContextHealth;
};
