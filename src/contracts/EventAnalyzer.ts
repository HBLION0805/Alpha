export const EVENT_ANALYZER_SCHEMA_VERSION = "2.0" as const;
export const EVENT_ANALYZER_CANDLE_SERIES_SCHEMA_VERSION = "1.0" as const;
export const EVENT_ANALYZER_MAX_ATOMIC_DIGITS = 24 as const;
export const EVENT_ANALYZER_MAX_DECIMAL_SCALE = 8 as const;
export const EVENT_ANALYZER_INSTRUMENT_ID = "instrument:crypto:btc-usd" as const;

export enum EventAnalyzerEventType {
  BtcFifteenMinute = "BTC_15_MINUTE",
}

export enum EventContractSide {
  Yes = "YES",
  No = "NO",
  Up = "UP",
  Down = "DOWN",
}

export enum RecentMomentumClassification {
  Up = "UP",
  Flat = "FLAT",
  Down = "DOWN",
}

export enum EventAnalyzerCandleInterval {
  OneMinute = "PT1M",
}

export enum EventAnalyzerCandleEvidenceQuality {
  Sufficient = "SUFFICIENT",
  LegacyCoarse = "LEGACY_COARSE",
  Insufficient = "INSUFFICIENT",
  Invalid = "INVALID",
}

export enum EventAnalyzerDerivedMomentum {
  StrongUp = "STRONG_UP",
  WeakUp = "WEAK_UP",
  Neutral = "NEUTRAL",
  WeakDown = "WEAK_DOWN",
  StrongDown = "STRONG_DOWN",
  ReversalRiskUpToDown = "REVERSAL_RISK_UP_TO_DOWN",
  ReversalRiskDownToUp = "REVERSAL_RISK_DOWN_TO_UP",
  InsufficientEvidence = "INSUFFICIENT_EVIDENCE",
}

export enum EventAnalyzerRangeExpansion {
  Expanding = "EXPANDING",
  Stable = "STABLE",
  Contracting = "CONTRACTING",
  Unavailable = "UNAVAILABLE",
}

export enum EventAnalyzerFeatureStatus {
  Confirmed = "CONFIRMED",
  NotConfirmed = "NOT_CONFIRMED",
  Unavailable = "UNAVAILABLE",
}

export enum EventAnalyzerVolumeConfirmation {
  Bullish = "BULLISH_RELATIVE_VOLUME",
  Bearish = "BEARISH_RELATIVE_VOLUME",
  None = "NO_CONFIRMATION",
  Unavailable = "UNAVAILABLE",
}

export enum EventAnalyzerCloseLocation {
  NearHighs = "NEAR_HIGHS",
  MidRange = "MID_RANGE",
  NearLows = "NEAR_LOWS",
  Unavailable = "UNAVAILABLE",
}

export enum EventAnalyzerReversalRisk {
  UpToDown = "UP_TO_DOWN",
  DownToUp = "DOWN_TO_UP",
  None = "NONE",
  Unavailable = "UNAVAILABLE",
}

export enum EventAnalyzerContradictionFlag {
  LegacyCoarseMomentumOnly = "LEGACY_COARSE_MOMENTUM_ONLY",
  CandleEvidenceInvalid = "CANDLE_EVIDENCE_INVALID",
  CandleEvidenceInsufficient = "CANDLE_EVIDENCE_INSUFFICIENT",
  StrongBearishStructure = "STRONG_BEARISH_STRUCTURE",
  StrongBullishStructure = "STRONG_BULLISH_STRUCTURE",
  UpToDownReversal = "UP_TO_DOWN_REVERSAL",
  DownToUpReversal = "DOWN_TO_UP_REVERSAL",
  TargetDistanceSmallRelativeToVolatility = "TARGET_DISTANCE_SMALL_RELATIVE_TO_VOLATILITY",
}

export enum EventAnalyzerRecommendation {
  Buy = "BUY",
  Hold = "HOLD",
  NoTrade = "NO_TRADE",
}

export enum EventMarketPriceComparison {
  Underpriced = "UNDERPRICED",
  Fair = "FAIR",
  Overpriced = "OVERPRICED",
}

export enum EventAnalyzerProfitabilityStatus {
  NotEvaluated = "NOT_EVALUATED",
}

export enum EventAnalyzerAuthorizationStatus {
  PrototypeOnly = "PROTOTYPE_ONLY_NOT_AUTHORIZED",
}

export enum EventAnalyzerReasonCode {
  PositiveDistance = "POSITIVE_DISTANCE",
  NegativeDistance = "NEGATIVE_DISTANCE",
  AtTarget = "AT_TARGET",
  MomentumUp = "MOMENTUM_UP",
  MomentumFlat = "MOMENTUM_FLAT",
  MomentumDown = "MOMENTUM_DOWN",
  PositiveEdgeMeetsThreshold = "POSITIVE_EDGE_MEETS_THRESHOLD",
  PositiveEdgeBelowThreshold = "POSITIVE_EDGE_BELOW_THRESHOLD",
  NoPositiveEdge = "NO_POSITIVE_EDGE",
  TooLittleTimeRemaining = "TOO_LITTLE_TIME_REMAINING",
  CandleEvidenceSufficient = "CANDLE_EVIDENCE_SUFFICIENT",
  LegacyCoarseEvidence = "LEGACY_COARSE_EVIDENCE",
  CandleEvidenceInsufficient = "CANDLE_EVIDENCE_INSUFFICIENT",
  CandleEvidenceInvalid = "CANDLE_EVIDENCE_INVALID",
  CandleMomentumOverridesCoarse = "CANDLE_MOMENTUM_OVERRIDES_COARSE",
  SevereCandleContradiction = "SEVERE_CANDLE_CONTRADICTION",
  UnstableDirection = "UNSTABLE_DIRECTION",
  MarketPriceAbovePolicy = "MARKET_PRICE_ABOVE_POLICY",
}

export enum EventAnalyzerValidationIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidEventType = "INVALID_EVENT_TYPE",
  InvalidContractSide = "INVALID_CONTRACT_SIDE",
  InvalidMomentum = "INVALID_MOMENTUM",
  InvalidPrice = "INVALID_PRICE",
  InvalidMarketPrice = "INVALID_MARKET_PRICE",
  InvalidRemainingSeconds = "INVALID_REMAINING_SECONDS",
  InvalidPolicy = "INVALID_POLICY",
  InvalidCandleSeries = "INVALID_CANDLE_SERIES",
  InvalidCandleCount = "INVALID_CANDLE_COUNT",
  InvalidCandleInterval = "INVALID_CANDLE_INTERVAL",
  InvalidCandleTimestamp = "INVALID_CANDLE_TIMESTAMP",
  InvalidCandleChronology = "INVALID_CANDLE_CHRONOLOGY",
  DuplicateCandleTimestamp = "DUPLICATE_CANDLE_TIMESTAMP",
  InvalidCandleOhlc = "INVALID_CANDLE_OHLC",
  InvalidCandleVolume = "INVALID_CANDLE_VOLUME",
  InvalidObservationContext = "INVALID_OBSERVATION_CONTEXT",
  InvalidProvenance = "INVALID_PROVENANCE",
  CurrentPriceMismatch = "CURRENT_PRICE_MISMATCH",
  UnsafeNumericValue = "UNSAFE_NUMERIC_VALUE",
}

export interface EventAnalyzerFixedDecimal {
  readonly atomicValue: string;
  readonly scale: number;
}

export interface EventAnalyzerInput {
  readonly schemaVersion: typeof EVENT_ANALYZER_SCHEMA_VERSION;
  readonly eventType: EventAnalyzerEventType;
  readonly eventId: string;
  readonly instrumentId: typeof EVENT_ANALYZER_INSTRUMENT_ID;
  readonly observationTime: string;
  readonly currentPriceSourceId: string;
  readonly currentPriceSourceRecordId: string;
  readonly currentPriceObservationId: string;
  readonly contractSide: EventContractSide;
  readonly targetPrice: EventAnalyzerFixedDecimal;
  readonly currentPrice: EventAnalyzerFixedDecimal;
  /** Contract price in basis points of one unit: 1 = 0.0001, 10_000 = 1.0000. */
  readonly marketPriceBasisPoints: number;
  readonly remainingSeconds: number;
  readonly recentMomentum?: RecentMomentumClassification;
  readonly candleSeries?: EventAnalyzerCandleSeries;
}

export interface EventAnalyzerOneMinuteCandle {
  readonly timestamp: string;
  readonly open: EventAnalyzerFixedDecimal;
  readonly high: EventAnalyzerFixedDecimal;
  readonly low: EventAnalyzerFixedDecimal;
  readonly close: EventAnalyzerFixedDecimal;
  /** Null means volume was explicitly unavailable; no confirmation may be inferred. */
  readonly volume: EventAnalyzerFixedDecimal | null;
}

export interface EventAnalyzerCandleSeries {
  readonly schemaVersion: typeof EVENT_ANALYZER_CANDLE_SERIES_SCHEMA_VERSION;
  readonly interval: EventAnalyzerCandleInterval.OneMinute;
  /** Every candle timestamp is the inclusive start of its completed PT1M interval. */
  readonly timestampSemantics: "INTERVAL_START";
  readonly eventId: string;
  readonly instrumentId: typeof EVENT_ANALYZER_INSTRUMENT_ID;
  readonly asOfTime: string;
  readonly provenance: EventAnalyzerCandleProvenance;
  readonly candles: readonly EventAnalyzerOneMinuteCandle[];
}

export interface EventAnalyzerCandleProvenance {
  readonly sourceId: string;
  readonly sourceRecordId: string;
  readonly observationId: string;
}

export interface EventAnalyzerPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly eventDurationSeconds: number;
  readonly minimumSecondsForBuy: number;
  readonly maximumDistanceBasisPoints: number;
  readonly maximumDistanceContributionBasisPoints: number;
  readonly momentumAdjustmentBasisPoints: number;
  readonly probabilityFloorBasisPoints: number;
  readonly probabilityCeilingBasisPoints: number;
  readonly minimumBuyEdgeBasisPoints: number;
  readonly maximumBuyMarketPriceBasisPoints: number;
  readonly minimumCandleCount: number;
  readonly maximumCandleCount: number;
  readonly shortWindowCandles: number;
  readonly mediumWindowCandles: number;
  readonly trendThresholdBasisPoints: number;
  readonly strongTrendThresholdBasisPoints: number;
  readonly strongBodyPressureBasisPoints: number;
  readonly closeLocationHighBasisPoints: number;
  readonly closeLocationLowBasisPoints: number;
  readonly rangeExpansionRatioBasisPoints: number;
  readonly accelerationRatioBasisPoints: number;
  readonly relativeVolumeRatioBasisPoints: number;
  readonly strongMomentumContributionBasisPoints: number;
  readonly weakMomentumContributionBasisPoints: number;
  readonly reversalContributionBasisPoints: number;
  readonly volumeContributionBasisPoints: number;
  readonly maximumCandleContributionBasisPoints: number;
}

export interface EventAnalyzerValidationIssue {
  readonly code: EventAnalyzerValidationIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface EventAnalyzerProbabilityEstimate {
  readonly contractSide: EventContractSide;
  readonly basisPoints: number;
  readonly percent: string;
  readonly calibrated: false;
  readonly method: "DETERMINISTIC_HEURISTIC_V2";
}

export interface EventAnalyzerValueComparison {
  readonly fairValueBasisPoints: number;
  readonly fairValueContractPrice: string;
  readonly marketPriceBasisPoints: number;
  readonly marketContractPrice: string;
  readonly comparison: EventMarketPriceComparison;
}

export interface EventAnalyzerEdge {
  readonly basisPoints: number;
  readonly percentagePoints: string;
}

export interface EventAnalyzerCandleAnalysis {
  readonly candleCount: number;
  readonly evidenceQuality: EventAnalyzerCandleEvidenceQuality;
  readonly recentReturnBasisPoints: number | null;
  readonly shortReturnBasisPoints: number | null;
  readonly mediumReturnBasisPoints: number | null;
  readonly averageAbsoluteReturnBasisPoints: number | null;
  readonly bullishCandleCount: number;
  readonly bearishCandleCount: number;
  readonly consecutiveBullishCount: number;
  readonly consecutiveBearishCount: number;
  readonly bullishBodyPressureBasisPoints: number | null;
  readonly bearishBodyPressureBasisPoints: number | null;
  readonly closeLocationBehavior: EventAnalyzerCloseLocation;
  readonly recentRangeExpansion: EventAnalyzerRangeExpansion;
  readonly upsideAcceleration: EventAnalyzerFeatureStatus;
  readonly downsideAcceleration: EventAnalyzerFeatureStatus;
  readonly volumeConfirmation: EventAnalyzerVolumeConfirmation;
  readonly reversalRisk: EventAnalyzerReversalRisk;
  readonly derivedMomentum: EventAnalyzerDerivedMomentum;
  readonly contradictionFlags: readonly EventAnalyzerContradictionFlag[];
  readonly issues: readonly EventAnalyzerValidationIssue[];
  readonly featureVersion: "2.0";
  readonly ruleVersion: string;
}

export interface EventAnalyzerAssessment {
  readonly analysisId: string;
  readonly schemaVersion: typeof EVENT_ANALYZER_SCHEMA_VERSION;
  readonly inputFingerprint: string;
  readonly eventType: EventAnalyzerEventType;
  readonly contractSide: EventContractSide;
  readonly remainingSeconds: number;
  readonly recentMomentum: RecentMomentumClassification | "NOT_SUPPLIED";
  readonly distanceFromTargetBasisPoints: number;
  readonly upProbabilityBasisPoints: number;
  readonly probabilityEstimate: EventAnalyzerProbabilityEstimate;
  readonly valueComparison: EventAnalyzerValueComparison;
  readonly edge: EventAnalyzerEdge;
  readonly candleAnalysis: EventAnalyzerCandleAnalysis;
  readonly recommendation: EventAnalyzerRecommendation;
  readonly reasonCodes: readonly EventAnalyzerReasonCode[];
  readonly riskExplanation: readonly string[];
  readonly profitabilityStatus: EventAnalyzerProfitabilityStatus.NotEvaluated;
  readonly authorizationStatus: EventAnalyzerAuthorizationStatus.PrototypeOnly;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly deterministic: true;
  readonly readOnly: true;
}
