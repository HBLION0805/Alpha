import {
  CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  CanonicalInstrumentValidationIssueCode,
  InstrumentAssetClass,
  InstrumentIdentifierType,
  InstrumentStatus,
  InstrumentType,
  type CanonicalInstrument,
  type CanonicalInstrumentValidationIssue,
  type CanonicalInstrumentValidationResult,
  type InstrumentIdentifier,
} from "../../contracts/CanonicalInstrument";

const CANONICAL_ID = /^instrument:[a-z0-9][a-z0-9_-]{7,127}$/u;
const PROVIDER_ID = /^provider:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const DISPLAY_SYMBOL = /^[A-Z0-9][A-Z0-9./-]{0,31}$/u;
const CURRENCY = /^[A-Z]{3}$/u;
const EXCHANGE = /^[A-Z0-9][A-Z0-9._-]{1,31}$/u;
const TIMEZONE = /^(?:UTC|[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)*)$/u;

const TYPE_BY_ASSET_CLASS: Readonly<Record<InstrumentAssetClass, InstrumentType>> = Object.freeze({
  [InstrumentAssetClass.Equity]: InstrumentType.CommonStock,
  [InstrumentAssetClass.Etf]: InstrumentType.ExchangeTradedFund,
  [InstrumentAssetClass.Crypto]: InstrumentType.CryptoAsset,
  [InstrumentAssetClass.Index]: InstrumentType.MarketIndex,
});

export class CanonicalInstrumentValidationError extends Error {
  public constructor(public readonly issues: readonly CanonicalInstrumentValidationIssue[]) {
    super("Canonical instrument validation failed.");
    this.name = "CanonicalInstrumentValidationError";
  }
}

export function validateCanonicalInstrument(value: unknown): CanonicalInstrumentValidationResult {
  const issues: CanonicalInstrumentValidationIssue[] = [];
  if (!isRecord(value)) {
    return frozenValidation([
      issue(CanonicalInstrumentValidationIssueCode.InvalidRecord, "$", "Canonical instrument must be an object."),
    ]);
  }

  if (value.schemaVersion !== CANONICAL_INSTRUMENT_SCHEMA_VERSION) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidSchemaVersion, "schemaVersion", "Schema version is unsupported."));
  }
  if (!isCanonicalInstrumentId(value.instrumentId)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidInstrumentId, "instrumentId", "Instrument ID must be an opaque Alpha-owned instrument identifier."));
  }
  if (typeof value.metadataVersion !== "string" || !VERSION.test(value.metadataVersion)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidMetadataVersion, "metadataVersion", "Metadata version is invalid."));
  }
  if (typeof value.displaySymbol !== "string" || !DISPLAY_SYMBOL.test(value.displaySymbol)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidDisplaySymbol, "displaySymbol", "Display symbol is invalid."));
  }
  if (!boundedText(value.displayName, 160)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidDisplayName, "displayName", "Display name is invalid."));
  }

  const assetClassValid = Object.values(InstrumentAssetClass).includes(value.assetClass as InstrumentAssetClass);
  if (!assetClassValid) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.UnsupportedAssetClass, "assetClass", "Asset class is unsupported."));
  }
  const instrumentTypeValid = Object.values(InstrumentType).includes(value.instrumentType as InstrumentType);
  if (!instrumentTypeValid) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.UnsupportedInstrumentType, "instrumentType", "Instrument type is unsupported."));
  }
  if (assetClassValid && instrumentTypeValid
    && TYPE_BY_ASSET_CLASS[value.assetClass as InstrumentAssetClass] !== value.instrumentType) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.IncompatibleClassification, "instrumentType", "Instrument type is incompatible with the asset class."));
  }
  if (!Object.values(InstrumentStatus).includes(value.status as InstrumentStatus)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidStatus, "status", "Instrument status is invalid."));
  }
  if (typeof value.currency !== "string" || !CURRENCY.test(value.currency)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidCurrency, "currency", "Currency must be a three-letter uppercase code."));
  }
  if (value.exchange !== undefined && (typeof value.exchange !== "string" || !EXCHANGE.test(value.exchange))) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidExchange, "exchange", "Exchange must use a canonical Alpha exchange code."));
  }
  if (value.timezone !== undefined && (typeof value.timezone !== "string" || !TIMEZONE.test(value.timezone))) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidTimezone, "timezone", "Timezone must be UTC or a canonical IANA-style identifier."));
  }
  if (!isTimestamp(value.effectiveFrom)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidEffectiveFrom, "effectiveFrom", "Effective time must be a canonical UTC timestamp."));
  }

  return frozenValidation(issues);
}

export function createCanonicalInstrument(value: unknown): CanonicalInstrument {
  const validation = validateCanonicalInstrument(value);
  if (!validation.valid) throw new CanonicalInstrumentValidationError(validation.issues);
  const input = value as CanonicalInstrument;
  return deepFreeze({
    schemaVersion: CANONICAL_INSTRUMENT_SCHEMA_VERSION,
    instrumentId: input.instrumentId,
    metadataVersion: input.metadataVersion,
    displaySymbol: input.displaySymbol,
    displayName: input.displayName,
    assetClass: input.assetClass,
    instrumentType: input.instrumentType,
    status: input.status,
    currency: input.currency,
    ...(input.exchange === undefined ? {} : { exchange: input.exchange }),
    ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
    effectiveFrom: input.effectiveFrom,
  });
}

export function createInstrumentIdentifier(value: unknown): InstrumentIdentifier {
  const issues = validateInstrumentIdentifier(value);
  if (issues.length > 0) throw new CanonicalInstrumentValidationError(issues);
  const input = value as InstrumentIdentifier;
  return deepFreeze(input.identifierType === InstrumentIdentifierType.CanonicalId
    ? { identifierType: input.identifierType, value: input.value }
    : { identifierType: input.identifierType, providerId: input.providerId, value: input.value });
}

export function validateInstrumentIdentifier(value: unknown): readonly CanonicalInstrumentValidationIssue[] {
  if (!isRecord(value)) {
    return deepFreeze([issue(CanonicalInstrumentValidationIssueCode.InvalidIdentifier, "$", "Instrument identifier must be an object.")]);
  }
  if (!Object.values(InstrumentIdentifierType).includes(value.identifierType as InstrumentIdentifierType)) {
    return deepFreeze([issue(CanonicalInstrumentValidationIssueCode.UnsupportedIdentifierType, "identifierType", "Instrument identifier type is unsupported.")]);
  }
  if (value.identifierType === InstrumentIdentifierType.CanonicalId) {
    return deepFreeze(isCanonicalInstrumentId(value.value)
      ? []
      : [issue(CanonicalInstrumentValidationIssueCode.InvalidInstrumentId, "value", "Canonical identifier is invalid.")]);
  }
  const issues: CanonicalInstrumentValidationIssue[] = [];
  if (typeof value.providerId !== "string" || !PROVIDER_ID.test(value.providerId)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidProviderIdentity, "providerId", "Provider identity is invalid."));
  }
  if (!boundedText(value.value, 160)) {
    issues.push(issue(CanonicalInstrumentValidationIssueCode.InvalidIdentifier, "value", "Provider symbol is invalid."));
  }
  return deepFreeze(sortIssues(issues));
}

/** Canonical identity equality ignores display metadata and record version. */
export function canonicalInstrumentIdentityEquals(left: CanonicalInstrument, right: CanonicalInstrument): boolean {
  return left.instrumentId === right.instrumentId;
}

export function serializeCanonicalInstrument(value: CanonicalInstrument): string {
  return JSON.stringify(createCanonicalInstrument(value));
}

export function isCanonicalInstrumentId(value: unknown): value is string {
  return typeof value === "string" && CANONICAL_ID.test(value);
}

function frozenValidation(values: readonly CanonicalInstrumentValidationIssue[]): CanonicalInstrumentValidationResult {
  const issues = sortIssues(values);
  return deepFreeze({ valid: issues.length === 0, issues });
}

function issue(
  code: CanonicalInstrumentValidationIssueCode,
  field: string,
  message: string,
): CanonicalInstrumentValidationIssue {
  return { code, field, message };
}

function sortIssues(values: readonly CanonicalInstrumentValidationIssue[]): CanonicalInstrumentValidationIssue[] {
  return values
    .map((value) => ({ ...value }))
    .sort((left, right) => `${left.code}|${left.field}|${left.message}`.localeCompare(`${right.code}|${right.field}|${right.message}`));
}

function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === "string"
    && value.trim() === value
    && value.length > 0
    && value.length <= maximum
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
