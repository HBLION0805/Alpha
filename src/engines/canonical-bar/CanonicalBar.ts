import {
  CANONICAL_BAR_SCHEMA_VERSION,
  BarAdjustmentState,
  BarDeliveryTiming,
  BarDerivationStatus,
  BarFreshnessStatus,
  BarInterval,
  BarMarketCoverage,
  BarQualityReasonCode,
  BarQuantityUnit,
  BarSessionType,
  CanonicalBarStatus,
  CanonicalBarValidationIssueCode,
  type BarDecimal,
  type CanonicalBar,
  type CanonicalBarInput,
  type CanonicalBarQualityMetadata,
  type CanonicalBarSessionMetadata,
  type CanonicalBarSourceMetadata,
  type CanonicalBarValidationIssue,
  type CanonicalBarValidationResult,
  type CanonicalBarValue,
} from "../../contracts/CanonicalBar";
import {
  createCanonicalInstrument,
  validateCanonicalInstrument,
} from "../canonical-instrument/CanonicalInstrument";

const INTEGER = /^-?\d+$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const BAR_ID = /^bar:[a-f0-9]{16}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const SESSION_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TIMEZONE = /^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+)$/u;

const INTRADAY_INTERVAL_MS: Readonly<Partial<Record<BarInterval, number>>> = Object.freeze({
  [BarInterval.OneMinute]: 60_000,
  [BarInterval.FiveMinutes]: 300_000,
  [BarInterval.FifteenMinutes]: 900_000,
  [BarInterval.OneHour]: 3_600_000,
});

export class CanonicalBarValidationError extends Error {
  public constructor(public readonly issues: readonly CanonicalBarValidationIssue[]) {
    super("Canonical bar validation failed.");
    this.name = "CanonicalBarValidationError";
  }
}

export function validateCanonicalBarInput(value: unknown): CanonicalBarValidationResult {
  return frozenValidation(validateInput(value));
}

export function validateCanonicalBar(value: unknown): CanonicalBarValidationResult {
  const issues = validateInput(value);
  if (!isRecord(value) || issues.length > 0) return frozenValidation(issues);

  const input = canonicalInput(value as unknown as CanonicalBarInput);
  const expectedBarId = createCanonicalBarId(input);
  const expectedFingerprint = createCanonicalBarFingerprint(input);
  if (typeof value.barId !== "string" || !BAR_ID.test(value.barId) || value.barId !== expectedBarId) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidBarId, "barId", "Bar ID does not match canonical identity content."));
  }
  if (typeof value.fingerprint !== "string" || !FINGERPRINT.test(value.fingerprint) || value.fingerprint !== expectedFingerprint) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidFingerprint, "fingerprint", "Bar fingerprint does not match canonical content."));
  }
  return frozenValidation(issues);
}

export function createCanonicalBar(value: unknown): CanonicalBar {
  const validation = validateCanonicalBarInput(value);
  if (!validation.valid) throw new CanonicalBarValidationError(validation.issues);
  const input = canonicalInput(value as CanonicalBarInput);
  return deepFreeze({
    barId: createCanonicalBarId(input),
    ...input,
    fingerprint: createCanonicalBarFingerprint(input),
  });
}

export function createCanonicalBarId(value: CanonicalBarInput): string {
  const identity = {
    instrumentId: value.instrument.instrumentId,
    interval: value.interval,
    intervalStart: value.intervalStart,
    intervalEnd: value.intervalEnd,
    sessionType: value.session.sessionType,
    sessionDate: value.session.sessionDate,
    adjustment: value.adjustment,
    providerId: value.source.providerId,
    sourceReference: value.source.sourceReference,
  };
  return `bar:${fnv1a64(canonicalize(identity))}`;
}

export function createCanonicalBarFingerprint(value: CanonicalBarInput): string {
  const input = canonicalInput(value);
  const observationContent = {
    schemaVersion: input.schemaVersion,
    instrumentId: input.instrument.instrumentId,
    interval: input.interval,
    intervalStart: input.intervalStart,
    intervalEnd: input.intervalEnd,
    observationTime: input.observationTime,
    ...(input.providerPublishedAt === undefined ? {} : { providerPublishedAt: input.providerPublishedAt }),
    value: input.value,
    currency: input.currency,
    quantityUnit: input.quantityUnit,
    status: input.status,
    session: input.session,
    adjustment: input.adjustment,
    source: input.source,
  };
  return `fnv1a64:${fnv1a64(canonicalize(observationContent))}`;
}

export function canonicalBarIdentityEquals(left: CanonicalBar, right: CanonicalBar): boolean {
  return left.barId === right.barId;
}

export function canonicalBarContentEquals(left: CanonicalBar, right: CanonicalBar): boolean {
  return left.fingerprint === right.fingerprint;
}

export function canonicalBarFingerprintEquals(left: CanonicalBar, right: CanonicalBar): boolean {
  return left.fingerprint === right.fingerprint;
}

export function serializeCanonicalBar(value: CanonicalBar): string {
  const validation = validateCanonicalBar(value);
  if (!validation.valid) throw new CanonicalBarValidationError(validation.issues);
  return JSON.stringify(createCanonicalBar(value));
}

export function isCanonicalBarId(value: unknown): value is string {
  return typeof value === "string" && BAR_ID.test(value);
}

export function canonicalBarIntervalDurationMs(value: BarInterval): number | undefined {
  return INTRADAY_INTERVAL_MS[value];
}

function validateInput(value: unknown): CanonicalBarValidationIssue[] {
  const issues: CanonicalBarValidationIssue[] = [];
  if (!isRecord(value)) {
    return [issue(CanonicalBarValidationIssueCode.InvalidRecord, "$", "Canonical bar must be an object.")];
  }

  if (value.schemaVersion !== CANONICAL_BAR_SCHEMA_VERSION) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  }
  if (!validateCanonicalInstrument(value.instrument).valid) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidInstrument, "instrument", "Canonical instrument is invalid."));
  }
  validateInterval(value, issues);
  validateValue(value.value, issues);
  if (typeof value.currency !== "string" || !CURRENCY.test(value.currency)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidCurrency, "currency", "Bar currency must be a three-letter uppercase code."));
  } else if (isRecord(value.instrument) && value.currency !== value.instrument.currency) {
    issues.push(issue(CanonicalBarValidationIssueCode.CurrencyMismatch, "currency", "Bar currency must match the canonical instrument currency."));
  }
  if (value.quantityUnit !== BarQuantityUnit.BaseUnits) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidQuantityUnit, "quantityUnit", "Volume quantity unit must be BASE_UNITS."));
  }
  if (!Object.values(CanonicalBarStatus).includes(value.status as CanonicalBarStatus)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidStatus, "status", "Bar status is invalid."));
  }
  validateSession(value.session, issues);
  if (!Object.values(BarAdjustmentState).includes(value.adjustment as BarAdjustmentState)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidAdjustmentState, "adjustment", "Bar adjustment state is invalid."));
  }
  validateTimestamps(value, issues);
  validateQuality(value, issues);
  validateSource(value.source, issues);
  return sortIssues(issues);
}

function validateInterval(value: Record<string, unknown>, issues: CanonicalBarValidationIssue[]): void {
  if (!Object.values(BarInterval).includes(value.interval as BarInterval)) {
    issues.push(issue(CanonicalBarValidationIssueCode.UnsupportedInterval, "interval", "Bar interval is unsupported."));
    return;
  }
  if (!isTimestamp(value.intervalStart) || !isTimestamp(value.intervalEnd)) return;
  const start = Date.parse(value.intervalStart);
  const end = Date.parse(value.intervalEnd);
  if (end <= start) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidIntervalOrder, "intervalEnd", "Interval end must be after interval start."));
    return;
  }
  const expectedDuration = canonicalBarIntervalDurationMs(value.interval as BarInterval);
  if (expectedDuration !== undefined && end - start !== expectedDuration) {
    issues.push(issue(CanonicalBarValidationIssueCode.IntervalDurationMismatch, "intervalEnd", "Intraday interval boundaries must match the declared interval duration."));
  }
}

function validateValue(value: unknown, issues: CanonicalBarValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidRecord, "value", "Bar value must be an object."));
    return;
  }
  const prices = [
    ["open", value.open],
    ["high", value.high],
    ["low", value.low],
    ["close", value.close],
  ] as const;
  for (const [field, decimal] of prices) {
    if (!validDecimal(decimal)) {
      issues.push(issue(CanonicalBarValidationIssueCode.InvalidPrice, `value.${field}`, `${field} must be a non-negative fixed decimal.`));
    }
  }
  if (!validDecimal(value.volume)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidVolume, "value.volume", "Volume must be a non-negative fixed decimal."));
  }
  if (!prices.every(([, decimal]) => validDecimal(decimal))) return;
  const open = value.open as BarDecimal;
  const high = value.high as BarDecimal;
  const low = value.low as BarDecimal;
  const close = value.close as BarDecimal;
  if (compareDecimal(high, open) < 0) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidOhlcRelationship, "value.high", "High must be greater than or equal to open."));
  }
  if (compareDecimal(high, close) < 0) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidOhlcRelationship, "value.high", "High must be greater than or equal to close."));
  }
  if (compareDecimal(low, open) > 0) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidOhlcRelationship, "value.low", "Low must be less than or equal to open."));
  }
  if (compareDecimal(low, close) > 0) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidOhlcRelationship, "value.low", "Low must be less than or equal to close."));
  }
  if (compareDecimal(high, low) < 0) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidOhlcRelationship, "value.high", "High must be greater than or equal to low."));
  }
}

function validateSession(value: unknown, issues: CanonicalBarValidationIssue[]): void {
  if (!isRecord(value)
    || !Object.values(BarSessionType).includes(value.sessionType as BarSessionType)
    || typeof value.sessionDate !== "string" || !SESSION_DATE.test(value.sessionDate) || !validDateOnly(value.sessionDate)
    || typeof value.timezone !== "string" || !TIMEZONE.test(value.timezone)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidSession, "session", "Bar session metadata is invalid."));
  }
}

function validateTimestamps(value: Record<string, unknown>, issues: CanonicalBarValidationIssue[]): void {
  const timestamps = [
    ["intervalStart", value.intervalStart],
    ["intervalEnd", value.intervalEnd],
    ["observationTime", value.observationTime],
    ["providerPublishedAt", value.providerPublishedAt],
    ["receivedAt", value.receivedAt],
    ["normalizedAt", value.normalizedAt],
  ] as const;
  for (const [field, timestamp] of timestamps) {
    if ((field !== "providerPublishedAt" || timestamp !== undefined) && !isTimestamp(timestamp)) {
      issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestamp, field, `${field} must be a canonical UTC timestamp.`));
    }
  }
  if (!isTimestamp(value.intervalStart) || !isTimestamp(value.intervalEnd)
    || !isTimestamp(value.observationTime) || !isTimestamp(value.receivedAt) || !isTimestamp(value.normalizedAt)) return;

  const start = Date.parse(value.intervalStart);
  const end = Date.parse(value.intervalEnd);
  const observed = Date.parse(value.observationTime);
  const received = Date.parse(value.receivedAt);
  const normalized = Date.parse(value.normalizedAt);
  if (observed < start) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "observationTime", "Observation time cannot precede interval start."));
  }
  if (value.status === CanonicalBarStatus.Final && observed < end) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "observationTime", "A final bar must be observed at or after interval end."));
  }
  if (value.status === CanonicalBarStatus.Partial && observed >= end) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "observationTime", "A partial bar must be observed before interval end."));
  }
  if (received < observed) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "receivedAt", "Receipt time cannot precede observation time."));
  }
  if (isTimestamp(value.providerPublishedAt)) {
    const published = Date.parse(value.providerPublishedAt);
    if (published < observed || received < published) {
      issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "providerPublishedAt", "Publication time must be between observation and receipt times."));
    }
  }
  if (normalized < received) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "normalizedAt", "Normalization time cannot precede receipt time."));
  }
}

function validateQuality(value: Record<string, unknown>, issues: CanonicalBarValidationIssue[]): void {
  if (!isRecord(value.quality)
    || typeof value.quality.policyId !== "string" || !IDENTIFIER.test(value.quality.policyId)
    || typeof value.quality.policyVersion !== "string" || !VERSION.test(value.quality.policyVersion)
    || !isTimestamp(value.quality.evaluatedAt)
    || !Number.isSafeInteger(value.quality.maxAgeSeconds) || (value.quality.maxAgeSeconds as number) < 0
    || !Object.values(BarFreshnessStatus).includes(value.quality.freshness as BarFreshnessStatus)
    || !Object.values(BarDeliveryTiming).includes(value.quality.deliveryTiming as BarDeliveryTiming)
    || !Object.values(BarMarketCoverage).includes(value.quality.marketCoverage as BarMarketCoverage)
    || !Object.values(BarDerivationStatus).includes(value.quality.derivation as BarDerivationStatus)
    || !Array.isArray(value.quality.reasonCodes)
    || !value.quality.reasonCodes.every((entry) => Object.values(BarQualityReasonCode).includes(entry as BarQualityReasonCode))) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidQuality, "quality", "Bar quality metadata is invalid."));
    return;
  }
  const reasonCodes = value.quality.reasonCodes as readonly BarQualityReasonCode[];
  if (new Set(reasonCodes).size !== reasonCodes.length) {
    issues.push(issue(CanonicalBarValidationIssueCode.DuplicateReasonCode, "quality.reasonCodes", "Quality reason codes must be unique."));
  }
  if (isTimestamp(value.normalizedAt) && Date.parse(value.quality.evaluatedAt) < Date.parse(value.normalizedAt)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "quality.evaluatedAt", "Quality evaluation cannot precede normalization."));
  }
  if (isTimestamp(value.observationTime)) {
    const ageMs = Date.parse(value.quality.evaluatedAt) - Date.parse(value.observationTime);
    if (ageMs < 0) {
      issues.push(issue(CanonicalBarValidationIssueCode.InvalidTimestampOrder, "quality.evaluatedAt", "Quality evaluation cannot precede observation."));
    } else {
      const stale = ageMs > (value.quality.maxAgeSeconds as number) * 1000;
      if ((stale && value.quality.freshness !== BarFreshnessStatus.Stale)
        || (!stale && value.quality.freshness !== BarFreshnessStatus.Current)
        || (stale && !reasonCodes.includes(BarQualityReasonCode.StaleInterval))
        || (!stale && reasonCodes.includes(BarQualityReasonCode.StaleInterval))) {
        issues.push(issue(CanonicalBarValidationIssueCode.QualityStatusMismatch, "quality.freshness", "Freshness and stale reason must match deterministic observation age."));
      }
    }
  }
  checkReasonMatch(
    value.status === CanonicalBarStatus.Partial,
    reasonCodes.includes(BarQualityReasonCode.PartialBar),
    "status",
    "PARTIAL status and PARTIAL_BAR reason must agree.",
    issues,
  );
  checkReasonMatch(
    value.quality.marketCoverage === BarMarketCoverage.Unknown,
    reasonCodes.includes(BarQualityReasonCode.UnknownCoverage),
    "quality.marketCoverage",
    "UNKNOWN coverage and UNKNOWN_COVERAGE reason must agree.",
    issues,
  );
  checkReasonMatch(
    value.quality.derivation === BarDerivationStatus.Derived,
    reasonCodes.includes(BarQualityReasonCode.DerivedValue),
    "quality.derivation",
    "DERIVED status and DERIVED_VALUE reason must agree.",
    issues,
  );
  checkReasonMatch(
    value.adjustment === BarAdjustmentState.Unknown,
    reasonCodes.includes(BarQualityReasonCode.UnknownAdjustment),
    "adjustment",
    "UNKNOWN adjustment and UNKNOWN_ADJUSTMENT reason must agree.",
    issues,
  );
}

function checkReasonMatch(
  expected: boolean,
  present: boolean,
  field: string,
  message: string,
  issues: CanonicalBarValidationIssue[],
): void {
  if (expected !== present) issues.push(issue(CanonicalBarValidationIssueCode.QualityStatusMismatch, field, message));
}

function validateSource(value: unknown, issues: CanonicalBarValidationIssue[]): void {
  if (!isRecord(value)
    || typeof value.providerId !== "string" || !IDENTIFIER.test(value.providerId)
    || typeof value.adapterId !== "string" || !IDENTIFIER.test(value.adapterId)
    || typeof value.adapterVersion !== "string" || !VERSION.test(value.adapterVersion)
    || !boundedText(value.sourceReference, 500)
    || !boundedText(value.contentIntegrityReference, 500)) {
    issues.push(issue(CanonicalBarValidationIssueCode.InvalidSource, "source", "Canonical bar source metadata is invalid."));
  }
}

function canonicalInput(value: CanonicalBarInput): CanonicalBarInput {
  return {
    schemaVersion: CANONICAL_BAR_SCHEMA_VERSION,
    instrument: createCanonicalInstrument(value.instrument),
    interval: value.interval,
    intervalStart: value.intervalStart,
    intervalEnd: value.intervalEnd,
    observationTime: value.observationTime,
    ...(value.providerPublishedAt === undefined ? {} : { providerPublishedAt: value.providerPublishedAt }),
    receivedAt: value.receivedAt,
    normalizedAt: value.normalizedAt,
    value: canonicalValue(value.value),
    currency: value.currency,
    quantityUnit: value.quantityUnit,
    status: value.status,
    session: canonicalSession(value.session),
    adjustment: value.adjustment,
    quality: canonicalQuality(value.quality),
    source: canonicalSource(value.source),
  };
}

function canonicalValue(value: CanonicalBarValue): CanonicalBarValue {
  return {
    open: { ...value.open },
    high: { ...value.high },
    low: { ...value.low },
    close: { ...value.close },
    volume: { ...value.volume },
  };
}

function canonicalSession(value: CanonicalBarSessionMetadata): CanonicalBarSessionMetadata {
  return {
    sessionType: value.sessionType,
    sessionDate: value.sessionDate,
    timezone: value.timezone,
  };
}

function canonicalQuality(value: CanonicalBarQualityMetadata): CanonicalBarQualityMetadata {
  return {
    policyId: value.policyId,
    policyVersion: value.policyVersion,
    evaluatedAt: value.evaluatedAt,
    maxAgeSeconds: value.maxAgeSeconds,
    freshness: value.freshness,
    deliveryTiming: value.deliveryTiming,
    marketCoverage: value.marketCoverage,
    derivation: value.derivation,
    reasonCodes: [...value.reasonCodes].sort(),
  };
}

function canonicalSource(value: CanonicalBarSourceMetadata): CanonicalBarSourceMetadata {
  return {
    providerId: value.providerId,
    adapterId: value.adapterId,
    adapterVersion: value.adapterVersion,
    sourceReference: value.sourceReference,
    contentIntegrityReference: value.contentIntegrityReference,
  };
}

function validDecimal(value: unknown): value is BarDecimal {
  if (!isRecord(value)
    || typeof value.atomicValue !== "string" || !INTEGER.test(value.atomicValue)
    || !Number.isSafeInteger(value.scale) || (value.scale as number) < 0 || (value.scale as number) > 18) return false;
  return BigInt(value.atomicValue) >= 0n;
}

function compareDecimal(left: BarDecimal, right: BarDecimal): number {
  const scale = Math.max(left.scale, right.scale);
  const leftValue = BigInt(left.atomicValue) * (10n ** BigInt(scale - left.scale));
  const rightValue = BigInt(right.atomicValue) * (10n ** BigInt(scale - right.scale));
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function validDateOnly(value: string): boolean {
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().startsWith(`${value}T`);
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

function frozenValidation(values: readonly CanonicalBarValidationIssue[]): CanonicalBarValidationResult {
  const issues = sortIssues(values);
  return deepFreeze({ valid: issues.length === 0, issues });
}

function issue(code: CanonicalBarValidationIssueCode, field: string, message: string): CanonicalBarValidationIssue {
  return { code, field, message };
}

function sortIssues(values: readonly CanonicalBarValidationIssue[]): CanonicalBarValidationIssue[] {
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
