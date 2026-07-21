import type { CanonicalInstrument } from "./CanonicalInstrument";

export const CANONICAL_QUOTE_SCHEMA_VERSION = "1.0" as const;

export enum CanonicalQuoteStatus {
  Current = "CURRENT",
  Stale = "STALE",
}

export enum QuoteQuantityUnit {
  BaseUnits = "BASE_UNITS",
}

export enum QuoteQualityReasonCode {
  StaleObservation = "STALE_OBSERVATION",
  MissingSize = "MISSING_SIZE",
}

export interface QuoteDecimal {
  readonly atomicValue: string;
  readonly scale: number;
}

/** One two-sided top-of-market value; this is not an order book or depth model. */
export interface CanonicalQuoteValue {
  readonly bidPrice: QuoteDecimal;
  readonly askPrice: QuoteDecimal;
  readonly bidSize?: QuoteDecimal;
  readonly askSize?: QuoteDecimal;
  readonly quantityUnit?: QuoteQuantityUnit;
}

export interface CanonicalQuoteSourceMetadata {
  readonly providerId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly providerInstrumentId: string;
  readonly providerSymbol: string;
  readonly sourceReference: string;
  readonly contentIntegrityReference: string;
}

export interface CanonicalQuoteQualityMetadata {
  readonly policyId: string;
  readonly policyVersion: string;
  readonly evaluatedAt: string;
  readonly maxAgeSeconds: number;
  readonly reasonCodes: readonly QuoteQualityReasonCode[];
}

export interface QuoteIdentifier {
  readonly quoteId: string;
}

export interface CanonicalQuoteInput {
  readonly schemaVersion: typeof CANONICAL_QUOTE_SCHEMA_VERSION;
  readonly instrument: CanonicalInstrument;
  readonly value: CanonicalQuoteValue;
  readonly currency: string;
  readonly status: CanonicalQuoteStatus;
  readonly observationTime: string;
  readonly providerPublishedAt?: string;
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly quality: CanonicalQuoteQualityMetadata;
  readonly source: CanonicalQuoteSourceMetadata;
}

export interface CanonicalQuote extends CanonicalQuoteInput, QuoteIdentifier {
  readonly fingerprint: string;
}

export enum CanonicalQuoteValidationIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidQuoteId = "INVALID_QUOTE_ID",
  InvalidFingerprint = "INVALID_FINGERPRINT",
  InvalidInstrument = "INVALID_INSTRUMENT",
  InvalidPrice = "INVALID_PRICE",
  InvalidSize = "INVALID_SIZE",
  InvalidQuantityUnit = "INVALID_QUANTITY_UNIT",
  InvalidQuoteRelationship = "INVALID_QUOTE_RELATIONSHIP",
  InvalidCurrency = "INVALID_CURRENCY",
  CurrencyMismatch = "CURRENCY_MISMATCH",
  InvalidStatus = "INVALID_STATUS",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidTimestampOrder = "INVALID_TIMESTAMP_ORDER",
  InvalidQuality = "INVALID_QUALITY",
  QualityStatusMismatch = "QUALITY_STATUS_MISMATCH",
  InvalidSource = "INVALID_SOURCE",
  DuplicateReasonCode = "DUPLICATE_REASON_CODE",
}

export interface CanonicalQuoteValidationIssue {
  readonly code: CanonicalQuoteValidationIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface CanonicalQuoteValidationResult {
  readonly valid: boolean;
  readonly issues: readonly CanonicalQuoteValidationIssue[];
}
