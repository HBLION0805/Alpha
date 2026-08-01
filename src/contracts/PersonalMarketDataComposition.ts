import type { CanonicalBar, BarInterval } from "./CanonicalBar";
import type { CanonicalQuote } from "./CanonicalQuote";
import type {
  PersonalCandidateScanRequest,
  PersonalCandidateSession,
} from "./PersonalCandidateScan";
import type { PersonalDecisionLiquidityStatus } from "./PersonalDecision";
import type {
  PersonalWatchlistMapping,
  PersonalWatchlistMappingRegistry,
} from "./PersonalWatchlistMapping";

export const PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION = "1.0" as const;

export interface PersonalMarketDataTimeframeBinding {
  readonly interval: BarInterval;
  readonly start: CanonicalBar;
  readonly end: CanonicalBar;
}

export interface PersonalMarketDataLiquidityAssessment {
  readonly assessmentId: string;
  readonly quoteId: string;
  readonly quoteFingerprint: string;
  readonly status: PersonalDecisionLiquidityStatus;
  readonly evaluatedAt: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly evidenceReferences: readonly string[];
}

export interface PersonalMarketDataCandidateObservation {
  readonly candidateId: string;
  readonly mapping: PersonalWatchlistMapping;
  readonly timeframes: readonly PersonalMarketDataTimeframeBinding[];
  readonly quote: CanonicalQuote;
  readonly liquidity: PersonalMarketDataLiquidityAssessment;
}

export interface PersonalMarketDataCompositionRequest {
  readonly schemaVersion: typeof PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION;
  readonly scanId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly evaluatedAt: string;
  readonly session: PersonalCandidateSession;
  readonly mappingRegistry: PersonalWatchlistMappingRegistry;
  readonly candidates: readonly PersonalMarketDataCandidateObservation[];
}

export interface PersonalMarketDataCompositionResult {
  readonly schemaVersion: typeof PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION;
  readonly compositionId: string;
  readonly inputFingerprint: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly scanRequest: PersonalCandidateScanRequest;
  readonly evidenceReferences: readonly string[];
  readonly advisoryOnly: true;
  readonly automatedExecutionAllowed: false;
  readonly deterministic: true;
  readonly readOnly: true;
}

export enum PersonalMarketDataCompositionIssueCode {
  InvalidRequest = "INVALID_REQUEST",
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidMappingRegistry = "INVALID_MAPPING_REGISTRY",
  MappingNotRegistered = "MAPPING_NOT_REGISTERED",
  MappingNotApproved = "MAPPING_NOT_APPROVED",
  InvalidTimeframeSet = "INVALID_TIMEFRAME_SET",
  InvalidCanonicalBar = "INVALID_CANONICAL_BAR",
  BarInstrumentMismatch = "BAR_INSTRUMENT_MISMATCH",
  BarIntervalMismatch = "BAR_INTERVAL_MISMATCH",
  BarChronologyInvalid = "BAR_CHRONOLOGY_INVALID",
  BarSessionMismatch = "BAR_SESSION_MISMATCH",
  InvalidCanonicalQuote = "INVALID_CANONICAL_QUOTE",
  QuoteInstrumentMismatch = "QUOTE_INSTRUMENT_MISMATCH",
  LiquidityBindingMismatch = "LIQUIDITY_BINDING_MISMATCH",
  InvalidLiquidityAssessment = "INVALID_LIQUIDITY_ASSESSMENT",
}

export interface PersonalMarketDataCompositionIssue {
  readonly code: PersonalMarketDataCompositionIssueCode;
  readonly field: string;
  readonly message: string;
}
