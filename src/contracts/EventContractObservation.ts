export const EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION = "1.0" as const;
export const EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID = "instrument:crypto:btc-usd" as const;
export const EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR = "UP_DOWN" as const;
export const EVENT_CONTRACT_OBSERVATION_MAX_ATOMIC_DIGITS = 24 as const;
export const EVENT_CONTRACT_OBSERVATION_MAX_DECIMAL_SCALE = 8 as const;

export enum EventContractObservationEventType {
  BtcFifteenMinute = "BTC_15_MINUTE",
}

export enum EventContractPlatform {
  Robinhood = "ROBINHOOD",
}

export enum EventContractObservationSide {
  Up = "UP",
  Down = "DOWN",
}

export enum EventContractEvaluationMethod {
  AtScheduledTime = "AT_SCHEDULED_TIME",
  TouchDuringWindow = "TOUCH_DURING_WINDOW",
}

export enum EventContractThresholdOperator {
  Above = "ABOVE",
  AtOrAbove = "AT_OR_ABOVE",
  Below = "BELOW",
  AtOrBelow = "AT_OR_BELOW",
}

export enum EventContractEvidenceKind {
  Terms = "TERMS",
  ReferencePrice = "REFERENCE_PRICE",
  Quote = "QUOTE",
  FeePreview = "FEE_PREVIEW",
}

export enum EventContractObservationAuthorizationStatus {
  ObservationOnly = "OBSERVATION_ONLY_NOT_TRADE_AUTHORITY",
}

export enum EventContractObservationIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidContract = "INVALID_CONTRACT",
  InvalidSettlementTerms = "INVALID_SETTLEMENT_TERMS",
  InvalidFixedDecimal = "INVALID_FIXED_DECIMAL",
  InvalidQuote = "INVALID_QUOTE",
  InvalidFeePreview = "INVALID_FEE_PREVIEW",
  InvalidEvidence = "INVALID_EVIDENCE",
  MissingSide = "MISSING_SIDE",
  DuplicateSide = "DUPLICATE_SIDE",
  StaleObservation = "STALE_OBSERVATION",
  FutureObservation = "FUTURE_OBSERVATION",
  MismatchedReference = "MISMATCHED_REFERENCE",
  ArithmeticMismatch = "ARITHMETIC_MISMATCH",
  NoPossibleProfit = "NO_POSSIBLE_PROFIT",
  UnsafeNumericValue = "UNSAFE_NUMERIC_VALUE",
  InvalidPolicy = "INVALID_POLICY",
}

export interface EventContractFixedDecimal {
  readonly atomicValue: string;
  readonly scale: number;
}

export interface EventContractSettlementTerms {
  readonly termsId: string;
  readonly termsVersion: string;
  readonly platform: EventContractPlatform.Robinhood;
  readonly exchangeId: string;
  readonly marketId: string;
  readonly contractId: string;
  readonly title: string;
  readonly eventType: EventContractObservationEventType.BtcFifteenMinute;
  readonly instrumentId: typeof EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID;
  readonly outcomePair: typeof EVENT_CONTRACT_OBSERVATION_OUTCOME_PAIR;
  readonly windowStartsAt: string;
  readonly tradingClosesAt: string;
  readonly evaluatesAt: string;
  readonly evaluationMethod: EventContractEvaluationMethod;
  readonly thresholdOperator: EventContractThresholdOperator;
  readonly targetPrice: EventContractFixedDecimal;
  readonly settlementSourceId: string;
  readonly settlementSourceName: string;
  readonly termsSourceId: string;
  readonly termsSourceRecordId: string;
  readonly termsEvidenceId: string;
}

export interface EventContractReferencePriceObservation {
  readonly price: EventContractFixedDecimal;
  readonly observedAt: string;
  readonly sourceId: string;
  readonly sourceRecordId: string;
  readonly evidenceId: string;
}

export interface EventContractSideQuote {
  readonly side: EventContractObservationSide;
  readonly bidPriceBasisPoints: number | null;
  readonly askPriceBasisPoints: number;
  readonly observedAt: string;
  readonly sourceId: string;
  readonly sourceRecordId: string;
  readonly evidenceId: string;
}

export interface EventContractFeePreview {
  readonly side: EventContractObservationSide;
  readonly quoteSourceRecordId: string;
  readonly quantity: number;
  readonly contractPriceBasisPoints: number;
  readonly capturedAt: string;
  readonly contractSubtotal: EventContractFixedDecimal;
  readonly robinhoodCommission: EventContractFixedDecimal;
  readonly exchangeFee: EventContractFixedDecimal;
  readonly otherFees: EventContractFixedDecimal;
  readonly totalCost: EventContractFixedDecimal;
  readonly maximumPayout: EventContractFixedDecimal;
  readonly feeSourceId: string;
  readonly feeSourceRecordId: string;
  readonly evidenceId: string;
}

export interface EventContractObservationEvidence {
  readonly evidenceId: string;
  readonly kind: EventContractEvidenceKind;
  readonly capturedAt: string;
  readonly sourceId: string;
  readonly sourceRecordId: string;
}

export interface EventContractObservationInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION;
  readonly observationId: string;
  readonly capturedAt: string;
  readonly contract: EventContractSettlementTerms;
  readonly referencePrice: EventContractReferencePriceObservation;
  readonly quotes: readonly EventContractSideQuote[];
  readonly feePreviews: readonly EventContractFeePreview[];
  readonly evidence: readonly EventContractObservationEvidence[];
}

export interface EventContractObservationPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly eventDurationSeconds: number;
  readonly maximumReferencePriceAgeMilliseconds: number;
  readonly maximumQuoteAgeMilliseconds: number;
  readonly maximumFeePreviewAgeMilliseconds: number;
  readonly maximumQuantity: number;
}

export interface EventContractSideEconomics {
  readonly side: EventContractObservationSide;
  readonly quoteSourceRecordId: string;
  readonly quantity: number;
  readonly contractPriceBasisPoints: number;
  readonly contractSubtotal: EventContractFixedDecimal;
  readonly totalFees: EventContractFixedDecimal;
  readonly allInCost: EventContractFixedDecimal;
  readonly maximumPayout: EventContractFixedDecimal;
  readonly maximumProfit: EventContractFixedDecimal;
  readonly breakEvenProbabilityBasisPoints: number;
  readonly quoteEvidenceId: string;
  readonly feeEvidenceId: string;
}

export interface EventContractObservationRecord {
  readonly schemaVersion: typeof EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION;
  readonly observationId: string;
  readonly capturedAt: string;
  readonly remainingSeconds: number;
  readonly contract: EventContractSettlementTerms;
  readonly referencePrice: EventContractReferencePriceObservation;
  readonly quotes: readonly EventContractSideQuote[];
  readonly feePreviews: readonly EventContractFeePreview[];
  readonly evidence: readonly EventContractObservationEvidence[];
  readonly sideEconomics: readonly EventContractSideEconomics[];
  readonly fingerprint: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly authorizationStatus: EventContractObservationAuthorizationStatus.ObservationOnly;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface EventContractObservationIssue {
  readonly code: EventContractObservationIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface EventContractObservationValidationResult {
  readonly valid: boolean;
  readonly issues: readonly EventContractObservationIssue[];
}
