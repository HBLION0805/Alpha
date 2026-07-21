import type { CanonicalInstrument } from "./CanonicalInstrument";

export const CANONICAL_BAR_SCHEMA_VERSION = "1.0" as const;

export enum BarInterval {
  OneMinute = "PT1M",
  FiveMinutes = "PT5M",
  FifteenMinutes = "PT15M",
  OneHour = "PT1H",
  OneDay = "P1D",
}

export enum CanonicalBarStatus {
  Final = "FINAL",
  Partial = "PARTIAL",
}

export enum BarQuantityUnit {
  BaseUnits = "BASE_UNITS",
}

export enum BarSessionType {
  Regular = "REGULAR",
  Extended = "EXTENDED",
  Combined = "COMBINED",
  Continuous = "CONTINUOUS",
  Unknown = "UNKNOWN",
}

export enum BarFreshnessStatus {
  Current = "CURRENT",
  Stale = "STALE",
}

export enum BarDeliveryTiming {
  RealTime = "REAL_TIME",
  Delayed = "DELAYED",
  EndOfDay = "END_OF_DAY",
  Unknown = "UNKNOWN",
}

export enum BarMarketCoverage {
  FullMarket = "FULL_MARKET",
  SingleVenue = "SINGLE_VENUE",
  PartialMarket = "PARTIAL_MARKET",
  Unknown = "UNKNOWN",
}

export enum BarDerivationStatus {
  ProviderReported = "PROVIDER_REPORTED",
  Derived = "DERIVED",
  Unknown = "UNKNOWN",
}

export enum BarAdjustmentState {
  Raw = "RAW",
  SplitAdjusted = "SPLIT_ADJUSTED",
  DividendAdjusted = "DIVIDEND_ADJUSTED",
  FullyAdjusted = "FULLY_ADJUSTED",
  Unknown = "UNKNOWN",
}

export enum BarQualityReasonCode {
  StaleInterval = "STALE_INTERVAL",
  PartialBar = "PARTIAL_BAR",
  UnknownCoverage = "UNKNOWN_COVERAGE",
  DerivedValue = "DERIVED_VALUE",
  UnknownAdjustment = "UNKNOWN_ADJUSTMENT",
}

export interface BarDecimal {
  readonly atomicValue: string;
  readonly scale: number;
}

export interface CanonicalBarValue {
  readonly open: BarDecimal;
  readonly high: BarDecimal;
  readonly low: BarDecimal;
  readonly close: BarDecimal;
  readonly volume: BarDecimal;
}

export interface CanonicalBarSessionMetadata {
  readonly sessionType: BarSessionType;
  readonly sessionDate: string;
  readonly timezone: string;
}

export interface CanonicalBarSourceMetadata {
  readonly providerId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly sourceReference: string;
  readonly contentIntegrityReference: string;
}

export interface CanonicalBarQualityMetadata {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly evaluatedAt: string;
  readonly maxAgeSeconds: number;
  readonly freshness: BarFreshnessStatus;
  readonly deliveryTiming: BarDeliveryTiming;
  readonly marketCoverage: BarMarketCoverage;
  readonly derivation: BarDerivationStatus;
  readonly reasonCodes: readonly BarQualityReasonCode[];
}

export interface BarIdentifier {
  readonly barId: string;
}

export interface CanonicalBarInput {
  readonly schemaVersion: typeof CANONICAL_BAR_SCHEMA_VERSION;
  readonly instrument: CanonicalInstrument;
  readonly interval: BarInterval;
  readonly intervalStart: string;
  readonly intervalEnd: string;
  readonly observationTime: string;
  readonly providerPublishedAt?: string;
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly value: CanonicalBarValue;
  readonly currency: string;
  readonly quantityUnit: BarQuantityUnit;
  readonly status: CanonicalBarStatus;
  readonly session: CanonicalBarSessionMetadata;
  readonly adjustment: BarAdjustmentState;
  readonly quality: CanonicalBarQualityMetadata;
  readonly source: CanonicalBarSourceMetadata;
}

export interface CanonicalBar extends CanonicalBarInput, BarIdentifier {
  readonly fingerprint: string;
}

export enum CanonicalBarValidationIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidBarId = "INVALID_BAR_ID",
  InvalidFingerprint = "INVALID_FINGERPRINT",
  InvalidInstrument = "INVALID_INSTRUMENT",
  UnsupportedInterval = "UNSUPPORTED_INTERVAL",
  InvalidIntervalOrder = "INVALID_INTERVAL_ORDER",
  IntervalDurationMismatch = "INTERVAL_DURATION_MISMATCH",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidTimestampOrder = "INVALID_TIMESTAMP_ORDER",
  InvalidPrice = "INVALID_PRICE",
  InvalidOhlcRelationship = "INVALID_OHLC_RELATIONSHIP",
  InvalidVolume = "INVALID_VOLUME",
  InvalidCurrency = "INVALID_CURRENCY",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  InvalidQuantityUnit = "INVALID_QUANTITY_UNIT",
  InvalidStatus = "INVALID_STATUS",
  InvalidSession = "INVALID_SESSION",
  InvalidAdjustmentState = "INVALID_ADJUSTMENT_STATE",
  InvalidQuality = "INVALID_QUALITY",
  QualityStatusMismatch = "QUALITY_STATUS_MISMATCH",
  DuplicateReasonCode = "DUPLICATE_REASON_CODE",
  InvalidSource = "INVALID_SOURCE",
}

export interface CanonicalBarValidationIssue {
  readonly code: CanonicalBarValidationIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface CanonicalBarValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CanonicalBarValidationIssue[];
}
