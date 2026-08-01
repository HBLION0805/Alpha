import type {
  BarFreshnessStatus,
  BarInterval,
  CanonicalBarStatus,
} from "./CanonicalBar";
import type {
  PersonalDecisionDecimal,
  PersonalDecisionInstrument,
  PersonalDecisionLiquidityStatus,
  PersonalDecisionMarketDataStatus,
  PersonalDecisionMarketInput,
  PersonalDecisionThesisDirection,
} from "./PersonalDecision";

export const PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION = "1.0" as const;

export enum PersonalCandidateSession {
  PreMarket = "PRE_MARKET",
  Opening = "OPENING",
  Intraday = "INTRADAY",
  Closing = "CLOSING",
}

export enum PersonalCandidateMappingStatus {
  Reviewed = "REVIEWED",
  Pending = "PENDING",
  Rejected = "REJECTED",
}

export enum PersonalCandidateExposure {
  Bullish = "BULLISH",
  Bearish = "BEARISH",
}

export enum PersonalCandidateTimeframeDirection {
  Up = "UP",
  Down = "DOWN",
  Flat = "FLAT",
}

export enum PersonalCandidateCompletedSessionValidity {
  Valid = "VALID",
  Invalid = "INVALID",
}

export enum PersonalCandidateStructure {
  AlignedBullish = "ALIGNED_BULLISH",
  AlignedBearish = "ALIGNED_BEARISH",
  BullishAwaitingTrigger = "BULLISH_AWAITING_TRIGGER",
  BearishAwaitingTrigger = "BEARISH_AWAITING_TRIGGER",
  Mixed = "MIXED",
}

export enum PersonalCandidateStatus {
  ReadyForDecision = "READY_FOR_DECISION",
  WatchTrigger = "WATCH_TRIGGER",
  Excluded = "EXCLUDED",
}

export enum PersonalCandidateBlockerCode {
  MappingNotReviewed = "MAPPING_NOT_REVIEWED",
  MappingEvidenceMissing = "MAPPING_EVIDENCE_MISSING",
  TimeframeDataStale = "TIMEFRAME_DATA_STALE",
  TimeframeObservationTooOld = "TIMEFRAME_OBSERVATION_TOO_OLD",
  TimeframeCompletedSessionInvalid = "TIMEFRAME_COMPLETED_SESSION_INVALID",
  TimeframeEvidenceMissing = "TIMEFRAME_EVIDENCE_MISSING",
  PartialBarNotAllowed = "PARTIAL_BAR_NOT_ALLOWED",
  TimeframeStructureMixed = "TIMEFRAME_STRUCTURE_MIXED",
  TriggerNotConfirmed = "TRIGGER_NOT_CONFIRMED",
  ExposureMismatch = "EXPOSURE_MISMATCH",
  MarketDataNotCurrent = "MARKET_DATA_NOT_CURRENT",
  MarketDataTooOld = "MARKET_DATA_TOO_OLD",
  SpreadTooWide = "SPREAD_TOO_WIDE",
  LiquidityNotSufficient = "LIQUIDITY_NOT_SUFFICIENT",
}

export enum PersonalCandidateReasonCode {
  MappingGatePassed = "MAPPING_GATE_PASSED",
  TimeframeDataGatePassed = "TIMEFRAME_DATA_GATE_PASSED",
  ContextAndSetupAligned = "CONTEXT_AND_SETUP_ALIGNED",
  TriggerConfirmed = "TRIGGER_CONFIRMED",
  TriggerPending = "TRIGGER_PENDING",
  ExposureMatched = "EXPOSURE_MATCHED",
  MarketGatePassed = "MARKET_GATE_PASSED",
  ReadyForFullDecisionEvaluation = "READY_FOR_FULL_DECISION_EVALUATION",
}

export interface PersonalCandidateInstrument {
  readonly instrumentId: string;
  readonly symbol: string;
  readonly assetClass: "EQUITY" | "ETF" | "INDEX";
  readonly currency: string;
}

export interface PersonalCandidateMapping {
  readonly mappingId: string;
  readonly version: string;
  readonly status: PersonalCandidateMappingStatus;
  readonly exposure: PersonalCandidateExposure;
  readonly evidenceReferences: readonly string[];
}

export interface PersonalCandidateBarEndpoint {
  readonly barId: string;
  readonly fingerprint: string;
  readonly intervalEnd: string;
  readonly close: PersonalDecisionDecimal;
}

export interface PersonalCandidateTimeframeInput {
  readonly interval: BarInterval;
  readonly start: PersonalCandidateBarEndpoint;
  readonly end: PersonalCandidateBarEndpoint;
  readonly status: CanonicalBarStatus;
  readonly completedSessionValidity: PersonalCandidateCompletedSessionValidity;
  readonly freshness: BarFreshnessStatus;
  readonly evidenceReferences: readonly string[];
}

export interface PersonalCandidateQuoteInput {
  readonly snapshotId: string;
  readonly observedAt: string;
  readonly status: PersonalDecisionMarketDataStatus;
  readonly spreadBasisPoints: number;
  readonly liquidity: PersonalDecisionLiquidityStatus;
}

export interface PersonalCandidateInput {
  readonly candidateId: string;
  readonly themeId: string;
  readonly analysisInstrument: PersonalCandidateInstrument;
  readonly tradeVehicle: PersonalDecisionInstrument;
  readonly mapping: PersonalCandidateMapping;
  readonly timeframes: readonly PersonalCandidateTimeframeInput[];
  readonly quote: PersonalCandidateQuoteInput;
}

export interface PersonalCandidateScanRequest {
  readonly schemaVersion: typeof PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION;
  readonly scanId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly evaluatedAt: string;
  readonly session: PersonalCandidateSession;
  readonly candidates: readonly PersonalCandidateInput[];
}

export interface PersonalCandidateTimeframePolicy {
  readonly interval: BarInterval;
  readonly flatThresholdBasisPoints: number;
  readonly maximumObservationAgeSeconds: number;
}

export interface PersonalCandidateScanPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly maximumCandidates: number;
  readonly maximumMarketDataAgeSeconds: number;
  readonly maximumSpreadBasisPoints: number;
  readonly timeframePolicies: readonly PersonalCandidateTimeframePolicy[];
}

export interface PersonalCandidateTimeframeAssessment {
  readonly interval: BarInterval;
  readonly startBarId: string;
  readonly endBarId: string;
  readonly returnBasisPoints: number;
  readonly direction: PersonalCandidateTimeframeDirection;
  readonly evidenceReferences: readonly string[];
}

export interface PersonalCandidateDecisionSeed {
  readonly instrument: PersonalDecisionInstrument;
  readonly market: PersonalDecisionMarketInput;
  /** MVP-T2 buys the reviewed vehicle; inverse exposure remains mapping metadata. */
  readonly direction: PersonalDecisionThesisDirection.Long;
  readonly sourceScanId: string;
  readonly sourceCandidateId: string;
}

export interface PersonalCandidateResult {
  readonly candidateId: string;
  readonly themeId: string;
  readonly analysisInstrument: PersonalCandidateInstrument;
  readonly tradeVehicle: PersonalDecisionInstrument;
  readonly exposure: PersonalCandidateExposure;
  readonly structure: PersonalCandidateStructure;
  readonly status: PersonalCandidateStatus;
  readonly timeframeAssessments: readonly PersonalCandidateTimeframeAssessment[];
  readonly blockerCodes: readonly PersonalCandidateBlockerCode[];
  readonly reasonCodes: readonly PersonalCandidateReasonCode[];
  readonly decisionSeed?: PersonalCandidateDecisionSeed;
}

export interface PersonalCandidateScanResult {
  readonly schemaVersion: typeof PERSONAL_CANDIDATE_SCAN_SCHEMA_VERSION;
  readonly scanId: string;
  readonly resultId: string;
  readonly inputFingerprint: string;
  readonly evaluatedAt: string;
  readonly session: PersonalCandidateSession;
  readonly candidates: readonly PersonalCandidateResult[];
  readonly readyCount: number;
  readonly watchCount: number;
  readonly excludedCount: number;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly unranked: true;
  readonly advisoryOnly: true;
  readonly automatedExecutionAllowed: false;
  readonly deterministic: true;
  readonly readOnly: true;
}

export enum PersonalCandidateValidationIssueCode {
  InvalidRequest = "INVALID_REQUEST",
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidEnum = "INVALID_ENUM",
  InvalidDecimal = "INVALID_DECIMAL",
  InvalidArray = "INVALID_ARRAY",
  InvalidBasisPoints = "INVALID_BASIS_POINTS",
  InvalidTimeframeSet = "INVALID_TIMEFRAME_SET",
  DuplicateCandidate = "DUPLICATE_CANDIDATE",
  InvalidPolicy = "INVALID_POLICY",
}

export interface PersonalCandidateValidationIssue {
  readonly code: PersonalCandidateValidationIssueCode;
  readonly field: string;
  readonly message: string;
}
