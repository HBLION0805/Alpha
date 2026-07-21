import {
  CANONICAL_QUOTE_SCHEMA_VERSION,
  CanonicalQuoteStatus,
  CanonicalQuoteValidationIssueCode,
  QuoteQualityReasonCode,
  QuoteQuantityUnit,
  type CanonicalQuote,
  type CanonicalQuoteInput,
  type CanonicalQuoteSourceMetadata,
  type CanonicalQuoteValidationIssue,
  type CanonicalQuoteValidationResult,
  type CanonicalQuoteValue,
  type QuoteDecimal,
} from "../../contracts/CanonicalQuote";
import {
  createCanonicalInstrument,
  validateCanonicalInstrument,
} from "../canonical-instrument/CanonicalInstrument";

const INTEGER = /^-?\d+$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const QUOTE_ID = /^quote:[a-f0-9]{16}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

export class CanonicalQuoteValidationError extends Error {
  public constructor(public readonly issues: readonly CanonicalQuoteValidationIssue[]) {
    super("Canonical quote validation failed.");
    this.name = "CanonicalQuoteValidationError";
  }
}

export function validateCanonicalQuoteInput(value: unknown): CanonicalQuoteValidationResult {
  return frozenValidation(validateInput(value));
}

export function validateCanonicalQuote(value: unknown): CanonicalQuoteValidationResult {
  const issues = validateInput(value);
  if (!isRecord(value) || issues.length > 0) return frozenValidation(issues);

  const input = canonicalInput(value as unknown as CanonicalQuoteInput);
  const expectedQuoteId = createCanonicalQuoteId(input);
  const expectedFingerprint = createCanonicalQuoteFingerprint(input);
  if (typeof value.quoteId !== "string" || !QUOTE_ID.test(value.quoteId) || value.quoteId !== expectedQuoteId) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidQuoteId, "quoteId", "Quote ID does not match canonical identity content."));
  }
  if (typeof value.fingerprint !== "string" || !FINGERPRINT.test(value.fingerprint) || value.fingerprint !== expectedFingerprint) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidFingerprint, "fingerprint", "Quote fingerprint does not match canonical content."));
  }
  return frozenValidation(issues);
}

export function createCanonicalQuote(value: unknown): CanonicalQuote {
  const validation = validateCanonicalQuoteInput(value);
  if (!validation.valid) throw new CanonicalQuoteValidationError(validation.issues);
  const input = canonicalInput(value as CanonicalQuoteInput);
  return deepFreeze({
    quoteId: createCanonicalQuoteId(input),
    ...input,
    fingerprint: createCanonicalQuoteFingerprint(input),
  });
}

export function createCanonicalQuoteId(value: CanonicalQuoteInput): string {
  const identity = {
    instrumentId: value.instrument.instrumentId,
    providerId: value.source.providerId,
    observationTime: value.observationTime,
    sourceReference: value.source.sourceReference,
  };
  return `quote:${fnv1a64(canonicalize(identity))}`;
}

export function createCanonicalQuoteFingerprint(value: CanonicalQuoteInput): string {
  return `fnv1a64:${fnv1a64(canonicalize(canonicalInput(value)))}`;
}

export function canonicalQuoteIdentityEquals(left: CanonicalQuote, right: CanonicalQuote): boolean {
  return left.quoteId === right.quoteId;
}

export function canonicalQuoteContentEquals(left: CanonicalQuote, right: CanonicalQuote): boolean {
  return left.fingerprint === right.fingerprint;
}

export function serializeCanonicalQuote(value: CanonicalQuote): string {
  const validation = validateCanonicalQuote(value);
  if (!validation.valid) throw new CanonicalQuoteValidationError(validation.issues);
  return JSON.stringify(createCanonicalQuote(value));
}

export function isCanonicalQuoteId(value: unknown): value is string {
  return typeof value === "string" && QUOTE_ID.test(value);
}

function validateInput(value: unknown): CanonicalQuoteValidationIssue[] {
  const issues: CanonicalQuoteValidationIssue[] = [];
  if (!isRecord(value)) {
    return [issue(CanonicalQuoteValidationIssueCode.InvalidRecord, "$", "Canonical quote must be an object.")];
  }

  if (value.schemaVersion !== CANONICAL_QUOTE_SCHEMA_VERSION) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  }
  if (!validateCanonicalInstrument(value.instrument).valid) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidInstrument, "instrument", "Canonical instrument is invalid."));
  }
  validateValue(value.value, issues);
  if (typeof value.currency !== "string" || !CURRENCY.test(value.currency)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidCurrency, "currency", "Quote currency must be a three-letter uppercase code."));
  } else if (isRecord(value.instrument) && value.currency !== value.instrument.currency) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.CurrencyMismatch, "currency", "Quote currency must match the canonical instrument currency."));
  }
  if (!Object.values(CanonicalQuoteStatus).includes(value.status as CanonicalQuoteStatus)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidStatus, "status", "Quote status is invalid."));
  }

  const timestamps = [
    ["observationTime", value.observationTime],
    ["providerPublishedAt", value.providerPublishedAt],
    ["receivedAt", value.receivedAt],
    ["normalizedAt", value.normalizedAt],
  ] as const;
  for (const [field, timestamp] of timestamps) {
    if ((field !== "providerPublishedAt" || timestamp !== undefined) && !isTimestamp(timestamp)) {
      issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidTimestamp, field, `${field} must be a canonical UTC timestamp.`));
    }
  }
  validateTimestampOrder(value, issues);
  validateQuality(value, issues);
  validateSource(value.source, issues);
  return sortIssues(issues);
}

function validateValue(value: unknown, issues: CanonicalQuoteValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidRecord, "value", "Quote value must be an object."));
    return;
  }
  if (!validDecimal(value.bidPrice, false)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidPrice, "value.bidPrice", "Bid price must be a positive fixed decimal."));
  }
  if (!validDecimal(value.askPrice, false)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidPrice, "value.askPrice", "Ask price must be a positive fixed decimal."));
  }
  if (validDecimal(value.bidPrice, false) && validDecimal(value.askPrice, false)
    && compareDecimal(value.bidPrice, value.askPrice) > 0) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidQuoteRelationship, "value.bidPrice", "Bid price cannot exceed ask price."));
  }
  const anySize = value.bidSize !== undefined || value.askSize !== undefined || value.quantityUnit !== undefined;
  if (anySize && (value.bidSize === undefined || value.askSize === undefined || value.quantityUnit !== QuoteQuantityUnit.BaseUnits)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidQuantityUnit, "value.quantityUnit", "Bid size, ask size, and base-unit quantity must be supplied together."));
  } else if (anySize && (!validDecimal(value.bidSize, true) || !validDecimal(value.askSize, true))) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidSize, "value.bidSize", "Quote sizes must be non-negative fixed decimals."));
  }
}

function validateTimestampOrder(value: Record<string, unknown>, issues: CanonicalQuoteValidationIssue[]): void {
  if (!isTimestamp(value.observationTime) || !isTimestamp(value.receivedAt) || !isTimestamp(value.normalizedAt)) return;
  const observation = Date.parse(value.observationTime);
  const received = Date.parse(value.receivedAt);
  const normalized = Date.parse(value.normalizedAt);
  if (received < observation) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidTimestampOrder, "receivedAt", "Receipt time cannot precede observation time."));
  }
  if (isTimestamp(value.providerPublishedAt)) {
    const published = Date.parse(value.providerPublishedAt);
    if (published < observation || received < published) {
      issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidTimestampOrder, "providerPublishedAt", "Publication time must be between observation and receipt times."));
    }
  }
  if (normalized < received) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidTimestampOrder, "normalizedAt", "Normalization time cannot precede receipt time."));
  }
}

function validateQuality(value: Record<string, unknown>, issues: CanonicalQuoteValidationIssue[]): void {
  if (!isRecord(value.quality)
    || typeof value.quality.policyId !== "string" || !IDENTIFIER.test(value.quality.policyId)
    || typeof value.quality.policyVersion !== "string" || !VERSION.test(value.quality.policyVersion)
    || !isTimestamp(value.quality.evaluatedAt)
    || !Number.isSafeInteger(value.quality.maxAgeSeconds) || (value.quality.maxAgeSeconds as number) < 0
    || !Array.isArray(value.quality.reasonCodes)
    || !value.quality.reasonCodes.every((entry) => Object.values(QuoteQualityReasonCode).includes(entry as QuoteQualityReasonCode))) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidQuality, "quality", "Quote quality metadata is invalid."));
    return;
  }
  if (new Set(value.quality.reasonCodes).size !== value.quality.reasonCodes.length) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.DuplicateReasonCode, "quality.reasonCodes", "Quality reason codes must be unique."));
  }
  if (isTimestamp(value.normalizedAt) && Date.parse(value.quality.evaluatedAt) < Date.parse(value.normalizedAt)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidTimestampOrder, "quality.evaluatedAt", "Quality evaluation cannot precede normalization."));
  }
  if (!isTimestamp(value.observationTime)) return;
  const ageMs = Date.parse(value.quality.evaluatedAt) - Date.parse(value.observationTime);
  if (ageMs < 0) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidTimestampOrder, "quality.evaluatedAt", "Quality evaluation cannot precede observation."));
    return;
  }
  const stale = ageMs > (value.quality.maxAgeSeconds as number) * 1000;
  const reasonCodes = value.quality.reasonCodes as readonly QuoteQualityReasonCode[];
  if ((stale && value.status !== CanonicalQuoteStatus.Stale)
    || (!stale && value.status !== CanonicalQuoteStatus.Current)
    || (stale && !reasonCodes.includes(QuoteQualityReasonCode.StaleObservation))
    || (!stale && reasonCodes.includes(QuoteQualityReasonCode.StaleObservation))) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.QualityStatusMismatch, "status", "Quote status must match deterministic freshness quality."));
  }
  const hasSizes = isRecord(value.value) && value.value.bidSize !== undefined && value.value.askSize !== undefined;
  if ((hasSizes && reasonCodes.includes(QuoteQualityReasonCode.MissingSize))
    || (!hasSizes && !reasonCodes.includes(QuoteQualityReasonCode.MissingSize))) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.QualityStatusMismatch, "quality.reasonCodes", "Missing-size quality reason must match quote value completeness."));
  }
}

function validateSource(value: unknown, issues: CanonicalQuoteValidationIssue[]): void {
  if (!isRecord(value)
    || typeof value.providerId !== "string" || !IDENTIFIER.test(value.providerId)
    || typeof value.adapterId !== "string" || !IDENTIFIER.test(value.adapterId)
    || typeof value.adapterVersion !== "string" || !VERSION.test(value.adapterVersion)
    || !boundedText(value.providerInstrumentId, 160)
    || !boundedText(value.providerSymbol, 160)
    || !boundedText(value.sourceReference, 500)
    || !boundedText(value.contentIntegrityReference, 500)) {
    issues.push(issue(CanonicalQuoteValidationIssueCode.InvalidSource, "source", "Canonical source metadata is invalid."));
  }
}

function canonicalInput(value: CanonicalQuoteInput): CanonicalQuoteInput {
  return {
    schemaVersion: CANONICAL_QUOTE_SCHEMA_VERSION,
    instrument: createCanonicalInstrument(value.instrument),
    value: canonicalValue(value.value),
    currency: value.currency,
    status: value.status,
    observationTime: value.observationTime,
    ...(value.providerPublishedAt === undefined ? {} : { providerPublishedAt: value.providerPublishedAt }),
    receivedAt: value.receivedAt,
    normalizedAt: value.normalizedAt,
    quality: {
      policyId: value.quality.policyId,
      policyVersion: value.quality.policyVersion,
      evaluatedAt: value.quality.evaluatedAt,
      maxAgeSeconds: value.quality.maxAgeSeconds,
      reasonCodes: [...value.quality.reasonCodes].sort(),
    },
    source: canonicalSource(value.source),
  };
}

function canonicalValue(value: CanonicalQuoteValue): CanonicalQuoteValue {
  return {
    bidPrice: { ...value.bidPrice },
    askPrice: { ...value.askPrice },
    ...(value.bidSize === undefined ? {} : { bidSize: { ...value.bidSize } }),
    ...(value.askSize === undefined ? {} : { askSize: { ...value.askSize } }),
    ...(value.quantityUnit === undefined ? {} : { quantityUnit: value.quantityUnit }),
  };
}

function canonicalSource(value: CanonicalQuoteSourceMetadata): CanonicalQuoteSourceMetadata {
  return {
    providerId: value.providerId,
    adapterId: value.adapterId,
    adapterVersion: value.adapterVersion,
    providerInstrumentId: value.providerInstrumentId,
    providerSymbol: value.providerSymbol,
    sourceReference: value.sourceReference,
    contentIntegrityReference: value.contentIntegrityReference,
  };
}

function validDecimal(value: unknown, allowZero: boolean): value is QuoteDecimal {
  if (!isRecord(value)
    || typeof value.atomicValue !== "string" || !INTEGER.test(value.atomicValue)
    || !Number.isSafeInteger(value.scale) || (value.scale as number) < 0 || (value.scale as number) > 18) return false;
  const numeric = BigInt(value.atomicValue);
  return allowZero ? numeric >= 0n : numeric > 0n;
}

function compareDecimal(left: QuoteDecimal, right: QuoteDecimal): number {
  const scale = Math.max(left.scale, right.scale);
  const leftValue = BigInt(left.atomicValue) * (10n ** BigInt(scale - left.scale));
  const rightValue = BigInt(right.atomicValue) * (10n ** BigInt(scale - right.scale));
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function frozenValidation(values: readonly CanonicalQuoteValidationIssue[]): CanonicalQuoteValidationResult {
  const issues = sortIssues(values);
  return deepFreeze({ valid: issues.length === 0, issues });
}

function issue(code: CanonicalQuoteValidationIssueCode, field: string, message: string): CanonicalQuoteValidationIssue {
  return { code, field, message };
}

function sortIssues(values: readonly CanonicalQuoteValidationIssue[]): CanonicalQuoteValidationIssue[] {
  return values.map((value) => ({ ...value }))
    .sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= maximum
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
