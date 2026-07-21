import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataAdapterErrorCategory,
  MarketDataCapability,
  MarketDataIssueCode,
  MarketDataNormalizationStatus,
  MarketDataProviderHealthStatus,
  type MarketDataAdapterError,
  type MarketDataBarNormalizationResult,
  type MarketDataBarProviderAdapter,
  type MarketDataBarRequest,
  type MarketDataProviderDescriptor,
  type MarketDataProviderHealth,
  type MarketDataRawResponse,
} from "../../../contracts/MarketData";
import {
  TWELVE_DATA_ADAPTER_ID,
  TWELVE_DATA_PROVIDER_ID,
  TwelveDataExecutionMode,
  TwelveDataTransportKind,
  TwelveDataValidationIssueCode,
  type TwelveDataBarAdapterDependencies,
  type TwelveDataHttpRequest,
  type TwelveDataHttpResponse,
} from "../../../contracts/TwelveDataAdapter";
import { InstrumentAssetClass } from "../../../contracts/CanonicalInstrument";
import { normalizeTwelveDataBars } from "./TwelveDataBarNormalizer";
import { parseTwelveDataResponse } from "./TwelveDataResponseParser";
import { validateTwelveDataResponse } from "./TwelveDataResponseValidator";
import {
  TwelveDataConfigurationError,
  buildTwelveDataHttpRequest,
  findTwelveDataMapping,
  validateTwelveDataMapping,
  validateTwelveDataPolicy,
} from "./TwelveDataProvider";

const DESCRIPTOR: MarketDataProviderDescriptor = deepFreeze({
  schemaVersion: MARKET_DATA_SCHEMA_VERSION,
  adapterId: TWELVE_DATA_ADAPTER_ID,
  adapterVersion: "1.0",
  providerId: TWELVE_DATA_PROVIDER_ID,
  enabled: true,
  capabilities: [MarketDataCapability.Bars],
  supportedAssetClasses: [InstrumentAssetClass.Equity, InstrumentAssetClass.Etf],
});

interface RawEnvelope {
  readonly body: string;
  readonly transportKind: TwelveDataTransportKind;
}

/** Provider-specific Bar adapter. Provider payloads never cross its public normalization boundary. */
export class TwelveDataBarAdapter implements MarketDataBarProviderAdapter {
  readonly #credentials: TwelveDataBarAdapterDependencies["credentials"];
  readonly #transport: TwelveDataBarAdapterDependencies["transport"];
  readonly #mappings: TwelveDataBarAdapterDependencies["mappings"];
  readonly #policy: TwelveDataBarAdapterDependencies["policy"];
  readonly #executionMode: TwelveDataBarAdapterDependencies["executionMode"];
  readonly #clock: TwelveDataBarAdapterDependencies["clock"];

  public constructor(dependencies: TwelveDataBarAdapterDependencies) {
    if (!Object.values(TwelveDataExecutionMode).includes(dependencies.executionMode)) {
      throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.InvalidRequest, "Execution mode is invalid.");
    }
    if (typeof dependencies.credentials.apiKey !== "string" || dependencies.credentials.apiKey.length < 8) {
      throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.InvalidCredentials, "Credentials are malformed.");
    }
    const mappings = dependencies.mappings.map(validateTwelveDataMapping);
    if (new Set(mappings.map((mapping) => mapping.canonicalInstrument.instrumentId)).size !== mappings.length) {
      throw new TwelveDataConfigurationError(TwelveDataValidationIssueCode.UnsupportedInstrument, "Duplicate canonical instrument mappings are forbidden.");
    }
    this.#credentials = deepFreeze({ ...dependencies.credentials });
    this.#transport = dependencies.transport;
    this.#mappings = deepFreeze(mappings);
    this.#policy = validateTwelveDataPolicy(dependencies.policy);
    this.#executionMode = dependencies.executionMode;
    this.#clock = dependencies.clock;
  }

  public getDescriptor(): MarketDataProviderDescriptor {
    return DESCRIPTOR;
  }

  public getHealth(): MarketDataProviderHealth {
    return deepFreeze({
      providerId: TWELVE_DATA_PROVIDER_ID,
      status: MarketDataProviderHealthStatus.Available,
      observedAt: this.#clock.now(),
      reason: "Configured transport is available; no provider health polling is performed.",
    });
  }

  public buildRequest(request: Readonly<MarketDataBarRequest>): TwelveDataHttpRequest {
    const mapping = findTwelveDataMapping(this.#mappings, request.instrument.instrumentId);
    return buildTwelveDataHttpRequest(request, mapping, this.#executionMode);
  }

  public async fetchBars(request: Readonly<MarketDataBarRequest>): Promise<MarketDataRawResponse> {
    const httpRequest = this.buildRequest(request);
    const response = await this.#transport.execute(httpRequest, this.#credentials);
    validateTransportResponse(response);
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new TwelveDataTransportError(`HTTP_${String(response.statusCode)}`, response.statusCode === 429 || response.statusCode >= 500);
    }
    const payload: RawEnvelope = deepFreeze({ body: response.body, transportKind: response.transportKind });
    return deepFreeze({ providerId: TWELVE_DATA_PROVIDER_ID, receivedAt: response.receivedAt, payload });
  }

  public normalizeBars(
    raw: Readonly<MarketDataRawResponse>,
    request: Readonly<MarketDataBarRequest>,
  ): MarketDataBarNormalizationResult {
    if (raw.providerId !== TWELVE_DATA_PROVIDER_ID || !isRawEnvelope(raw.payload)) {
      return rejected(MarketDataIssueCode.InvalidProviderIdentity, "Raw Twelve Data envelope is invalid.");
    }
    const mapping = findTwelveDataMapping(this.#mappings, request.instrument.instrumentId);
    const parsed = parseTwelveDataResponse(raw.payload.body);
    if (parsed.status === "REJECTED" || parsed.payload === undefined) {
      return rejected(MarketDataIssueCode.NormalizationRejected, parsed.blockers[0]?.message ?? "Provider JSON parsing failed.");
    }
    const validation = validateTwelveDataResponse(parsed.payload, mapping, request.interval);
    if (validation.status === "INVALID" || validation.data === undefined) {
      const providerError = validation.blockers.some((blocker) => blocker.code === TwelveDataValidationIssueCode.ProviderError);
      return rejected(providerError ? MarketDataIssueCode.TransportFailure : MarketDataIssueCode.NormalizationRejected,
        validation.blockers[0]?.message ?? "Provider response validation failed.");
    }
    const normalized = normalizeTwelveDataBars({
      request,
      mapping,
      response: validation.data,
      receivedAt: raw.receivedAt,
      normalizedAt: this.#clock.now(),
      transportKind: raw.payload.transportKind,
      policy: this.#policy,
    });
    return deepFreeze({
      providerId: normalized.providerId,
      status: normalized.status === "NORMALIZED" ? MarketDataNormalizationStatus.Normalized : MarketDataNormalizationStatus.Rejected,
      bars: normalized.bars,
      blockers: normalized.blockers,
      warnings: normalized.warnings,
    });
  }

  public normalizeError(
    error: unknown,
    _request: Readonly<MarketDataBarRequest>,
    occurredAt: string,
  ): MarketDataAdapterError {
    const transportError = error instanceof TwelveDataTransportError ? error : undefined;
    const configurationError = error instanceof TwelveDataConfigurationError ? error : undefined;
    return deepFreeze({
      providerId: TWELVE_DATA_PROVIDER_ID,
      category: configurationError === undefined ? MarketDataAdapterErrorCategory.TransportFailure : MarketDataAdapterErrorCategory.InvalidRequest,
      safeCode: transportError?.safeCode ?? configurationError?.code ?? "TWELVE_DATA_REQUEST_FAILED",
      safeMessage: configurationError === undefined ? "Twelve Data request failed safely." : "Twelve Data request is not permitted by adapter policy.",
      retryable: transportError?.retryable ?? false,
      occurredAt,
    });
  }
}

class TwelveDataTransportError extends Error {
  public constructor(public readonly safeCode: string, public readonly retryable: boolean) {
    super("Twelve Data transport failed.");
    this.name = "TwelveDataTransportError";
  }
}

function validateTransportResponse(value: TwelveDataHttpResponse): void {
  if (!Number.isSafeInteger(value.statusCode) || value.statusCode < 100 || value.statusCode > 599
    || !isTimestamp(value.receivedAt)
    || !Object.values(TwelveDataTransportKind).includes(value.transportKind)
    || typeof value.body !== "string") {
    throw new TwelveDataTransportError("INVALID_HTTP_RESPONSE", false);
  }
}

function isRawEnvelope(value: unknown): value is RawEnvelope {
  return isRecord(value) && typeof value.body === "string"
    && Object.values(TwelveDataTransportKind).includes(value.transportKind as TwelveDataTransportKind);
}

function rejected(code: MarketDataIssueCode, message: string): MarketDataBarNormalizationResult {
  return deepFreeze({
    providerId: TWELVE_DATA_PROVIDER_ID,
    status: MarketDataNormalizationStatus.Rejected,
    bars: [],
    blockers: [{ code, message }],
    warnings: [],
  });
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
