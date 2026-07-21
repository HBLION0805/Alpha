import { env as processEnvironment } from "node:process";
import {
  CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  InstrumentAssetClass,
  InstrumentStatus,
  InstrumentType,
  type CanonicalInstrument,
} from "../../../contracts/CanonicalInstrument";
import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  MarketDataProviderStatus,
  type MarketDataProviderMetadata,
} from "../../../contracts/MarketDataProviderRegistry";
import { MarketDataCapability } from "../../../contracts/MarketData";
import {
  TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  TWELVE_DATA_PROVIDER_ID,
  TwelveDataExecutionMode,
  TwelveDataMappingReviewStatus,
  TwelveDataValidationIssueCode,
  TwelveDataVolumeEvidenceStatus,
  type TwelveDataCredentials,
  type TwelveDataHttpRequest,
  type TwelveDataInstrumentMapping,
  type TwelveDataLiveSmokePolicy,
  type TwelveDataNormalizationPolicy,
} from "./TwelveDataContracts";
import type { MarketDataBarRequest } from "../../../contracts/MarketData";
import { validateCanonicalInstrument } from "../../../engines/canonical-instrument/CanonicalInstrument";

const SECRET = /^[\x21-\x7e]{8,512}$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const EXCHANGE = /^[A-Z0-9][A-Z0-9 ._-]{1,31}$/u;
const SUPPORTED_SYMBOLS = new Set(["AAPL", "SPY"]);
const INTERVALS: Readonly<Record<BarInterval, string | undefined>> = Object.freeze({
  [BarInterval.OneMinute]: "1min",
  [BarInterval.FiveMinutes]: "5min",
  [BarInterval.FifteenMinutes]: "15min",
  [BarInterval.OneHour]: "1h",
  [BarInterval.OneDay]: undefined,
});

export class TwelveDataConfigurationError extends Error {
  public constructor(
    public readonly code: TwelveDataValidationIssueCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "TwelveDataConfigurationError";
  }
}

class RedactedTwelveDataCredentials implements TwelveDataCredentials {
  readonly #apiKey: string;

  public constructor(apiKey: string) {
    this.#apiKey = apiKey;
    Object.freeze(this);
  }

  public revealForTransport(): string {
    return this.#apiKey;
  }

  public toRedactedDiagnostic() {
    return Object.freeze({
      environmentVariable: TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
      configured: true as const,
      value: "[REDACTED]" as const,
    });
  }

  public toJSON() {
    return this.toRedactedDiagnostic();
  }

  public toString(): string {
    return `${TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE}=[REDACTED]`;
  }
}

export const TWELVE_DATA_PROVIDER_METADATA: MarketDataProviderMetadata = deepFreeze({
  schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  metadataVersion: "1.0",
  identity: { providerId: TWELVE_DATA_PROVIDER_ID, displayName: "Twelve Data" },
  status: MarketDataProviderStatus.Active,
  supportedAssetClasses: [InstrumentAssetClass.Equity, InstrumentAssetClass.Etf],
  capabilities: [MarketDataCapability.Bars],
  priority: 100,
  defaultEnabled: true,
  documentationReference: "docs/specifications/TWELVE_DATA_ADAPTER.md",
});

const AAPL_INSTRUMENT: CanonicalInstrument = deepFreeze({
  schemaVersion: CANONICAL_INSTRUMENT_SCHEMA_VERSION,
  instrumentId: "instrument:00000000000000000000000001",
  metadataVersion: "1.0",
  displaySymbol: "AAPL",
  displayName: "Apple Inc.",
  assetClass: InstrumentAssetClass.Equity,
  instrumentType: InstrumentType.CommonStock,
  status: InstrumentStatus.Active,
  currency: "USD",
  exchange: "XNAS",
  timezone: "America/New_York",
  effectiveFrom: "2026-07-20T00:00:00.000Z",
});

/** The only built-in approved mapping. SPY requires a separately reviewed mapping at composition time. */
export const TWELVE_DATA_AAPL_FIXTURE_MAPPING: TwelveDataInstrumentMapping = deepFreeze({
  schemaVersion: TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
  mappingId: "mapping:twelve-data:aapl:xnas:1",
  mappingVersion: "1.0",
  providerId: TWELVE_DATA_PROVIDER_ID,
  providerSymbol: "AAPL",
  providerExchangeId: "NASDAQ",
  providerMic: "XNAS",
  providerAssetType: "Common Stock",
  canonicalInstrument: AAPL_INSTRUMENT,
  effectiveFrom: "2026-07-20T00:00:00.000Z",
  sourceReference: "docs/research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md#symbol-mapping-policy",
  reviewStatus: TwelveDataMappingReviewStatus.Approved,
});

export function loadTwelveDataCredentials(
  environment: Readonly<Record<string, string | undefined>> = processEnvironment,
): TwelveDataCredentials {
  const rawApiKey = environment[TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE];
  const apiKey = rawApiKey?.trim();
  if (typeof apiKey !== "string" || !SECRET.test(apiKey)) {
    throw new TwelveDataConfigurationError(
      TwelveDataValidationIssueCode.InvalidCredentials,
      `${TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE} is missing or malformed.`,
    );
  }
  return new RedactedTwelveDataCredentials(apiKey);
}

export function validateTwelveDataMapping(value: unknown): TwelveDataInstrumentMapping {
  if (!isRecord(value)
    || value.schemaVersion !== TWELVE_DATA_ADAPTER_SCHEMA_VERSION
    || !IDENTIFIER.test(String(value.mappingId ?? ""))
    || !IDENTIFIER.test(String(value.mappingVersion ?? ""))
    || value.providerId !== TWELVE_DATA_PROVIDER_ID
    || typeof value.providerSymbol !== "string" || !SUPPORTED_SYMBOLS.has(value.providerSymbol)
    || typeof value.providerExchangeId !== "string" || !EXCHANGE.test(value.providerExchangeId)
    || typeof value.providerMic !== "string" || !EXCHANGE.test(value.providerMic)
    || !["Common Stock", "ETF"].includes(String(value.providerAssetType))
    || !validateCanonicalInstrument(value.canonicalInstrument).valid
    || !isTimestamp(value.effectiveFrom)
    || typeof value.sourceReference !== "string" || value.sourceReference.length === 0
    || !Object.values(TwelveDataMappingReviewStatus).includes(value.reviewStatus as TwelveDataMappingReviewStatus)) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.UnsupportedInstrument, "Instrument mapping is malformed.");
  }
  const mapping = value as unknown as TwelveDataInstrumentMapping;
  if ((mapping.providerAssetType === "Common Stock" && mapping.canonicalInstrument.assetClass !== InstrumentAssetClass.Equity)
    || (mapping.providerAssetType === "ETF" && mapping.canonicalInstrument.assetClass !== InstrumentAssetClass.Etf)) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.UnsupportedAssetClass, "Provider and canonical asset classes disagree.");
  }
  return deepFreeze(clone(mapping));
}

export function validateTwelveDataPolicy(value: unknown): TwelveDataNormalizationPolicy {
  if (!isRecord(value)
    || value.schemaVersion !== TWELVE_DATA_ADAPTER_SCHEMA_VERSION
    || !IDENTIFIER.test(String(value.policyId ?? ""))
    || !IDENTIFIER.test(String(value.version ?? ""))
    || !Number.isSafeInteger(value.closureBufferSeconds) || (value.closureBufferSeconds as number) < 120
    || !Number.isSafeInteger(value.maxAgeSeconds) || (value.maxAgeSeconds as number) < 0
    || !Array.isArray(value.allowedAssetClasses) || value.allowedAssetClasses.length === 0
    || !value.allowedAssetClasses.every((entry) => [InstrumentAssetClass.Equity, InstrumentAssetClass.Etf].includes(entry as InstrumentAssetClass))
    || !Array.isArray(value.allowedIntervals) || value.allowedIntervals.length === 0
    || !value.allowedIntervals.every((entry) => INTERVALS[entry as BarInterval] !== undefined)
    || !Object.values(TwelveDataVolumeEvidenceStatus).includes(value.volumeEvidenceStatus as TwelveDataVolumeEvidenceStatus)) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.InvalidRequest, "Twelve Data normalization policy is malformed.");
  }
  return deepFreeze(clone(value as unknown as TwelveDataNormalizationPolicy));
}

export function buildTwelveDataHttpRequest(
  request: Readonly<MarketDataBarRequest>,
  mapping: Readonly<TwelveDataInstrumentMapping>,
  mode: TwelveDataExecutionMode,
  liveSmokePolicy?: Readonly<TwelveDataLiveSmokePolicy>,
): TwelveDataHttpRequest {
  const providerInterval = INTERVALS[request.interval];
  if (providerInterval === undefined) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.UnsupportedInterval, "Interval is unsupported by the first adapter slice.");
  }
  if (mapping.reviewStatus !== TwelveDataMappingReviewStatus.Approved) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.MappingNotApproved, "Instrument mapping is not approved.");
  }
  if (mode === TwelveDataExecutionMode.BoundedLiveSmoke) {
    const smoke = validateTwelveDataLiveSmokePolicy(liveSmokePolicy);
    const lookbackSeconds = (Date.parse(request.endTime) - Date.parse(request.startTime)) / 1000;
    if (request.providerId !== smoke.allowedProviderId
      || !smoke.allowedSymbols.includes(mapping.providerSymbol)
      || !smoke.allowedIntervals.includes(request.interval)
      || request.maxRecords > smoke.maxRecords
      || lookbackSeconds > smoke.maxLookbackSeconds
      || smoke.maxApiCreditsPerRun < 1) {
      throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.SmokeLimitExceeded, "Request exceeds the approved bounded live-smoke policy.");
    }
  }
  const query: Array<readonly [string, string]> = [
    ["adjust", "none"],
    ["end_date", providerDateTime(request.endTime)],
    ["exchange", mapping.providerExchangeId],
    ["interval", providerInterval],
    ["order", "asc"],
    ["outputsize", String(request.maxRecords)],
    ["prepost", "false"],
    ["start_date", providerDateTime(request.startTime)],
    ["symbol", mapping.providerSymbol],
    ["timezone", "UTC"],
  ];
  return deepFreeze({
    method: "GET",
    endpoint: "https://api.twelvedata.com/time_series",
    query: query.sort(([left], [right]) => left.localeCompare(right)),
    timeoutMs: 10_000,
  });
}

export function validateTwelveDataLiveSmokePolicy(value: unknown): TwelveDataLiveSmokePolicy {
  if (!isRecord(value)
    || value.schemaVersion !== TWELVE_DATA_ADAPTER_SCHEMA_VERSION
    || !IDENTIFIER.test(String(value.policyId ?? ""))
    || !IDENTIFIER.test(String(value.version ?? ""))
    || value.allowedProviderId !== TWELVE_DATA_PROVIDER_ID
    || !Array.isArray(value.allowedSymbols) || value.allowedSymbols.length !== 1 || value.allowedSymbols[0] !== "AAPL"
    || !Array.isArray(value.allowedIntervals) || value.allowedIntervals.length !== 1 || value.allowedIntervals[0] !== BarInterval.FiveMinutes
    || value.maxSymbolsPerRun !== 1
    || value.maxRequestsPerRun !== 1
    || !Number.isSafeInteger(value.maxLookbackSeconds) || (value.maxLookbackSeconds as number) < 1 || (value.maxLookbackSeconds as number) > 23_400
    || !Number.isSafeInteger(value.maxRecords) || (value.maxRecords as number) < 1 || (value.maxRecords as number) > 10
    || value.maxApiCreditsPerRun !== 1
    || !Array.isArray(value.officialEvidenceReferences) || value.officialEvidenceReferences.length === 0
    || !value.officialEvidenceReferences.every((entry) => typeof entry === "string" && entry.startsWith("docs/") && entry.length <= 240)
    || value.executionKind !== "MANUAL_ONE_SHOT"
    || value.pollingAllowed !== false
    || value.persistenceAllowed !== false
    || value.streamingAllowed !== false
    || value.automaticRetryAllowed !== false
    || value.backgroundExecutionAllowed !== false
    || value.secretLoggingAllowed !== false) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.SmokeLimitExceeded, "Bounded live-smoke policy is malformed.");
  }
  return deepFreeze(clone(value as unknown as TwelveDataLiveSmokePolicy));
}

export function findTwelveDataMapping(
  mappings: readonly TwelveDataInstrumentMapping[],
  instrumentId: string,
): TwelveDataInstrumentMapping {
  const matches = mappings.map(validateTwelveDataMapping)
    .filter((mapping) => mapping.canonicalInstrument.instrumentId === instrumentId);
  if (matches.length !== 1) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.UnsupportedInstrument, "Instrument mapping must resolve exactly once.");
  }
  const mapping = matches[0]!;
  if (mapping.reviewStatus !== TwelveDataMappingReviewStatus.Approved) {
    throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.MappingNotApproved, "Instrument mapping is not approved.");
  }
  return mapping;
}

function providerDateTime(value: string): string {
  if (!isTimestamp(value)) throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.InvalidWindow, "Request window timestamp is invalid.");
  return value.slice(0, 19).replace("T", " ");
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T;
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)])) as T;
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
