import {
  ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
  ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
  type AlpacaCredentialDiagnostic,
  type AlpacaCredentials,
} from "./AlpacaPersonalMarketDataContracts";
import { loadAlpacaCredentials } from "./AlpacaCredentials";

export const ALPACA_PERSONAL_ASSET_METADATA_PROVIDER_ID = "provider:alpaca-paper-assets" as const;
export const ALPACA_PERSONAL_MULS_SYMBOL = "MULS" as const;
export const ALPACA_PERSONAL_MULS_ASSET_ENDPOINT = "https://paper-api.alpaca.markets/v2/assets/MULS" as const;

const MAX_RESPONSE_BYTES = 65_536;
const TIMEOUT_MS = 10_000;
const APPROVED_EXCHANGES = Object.freeze([
  "AMEX", "ARCA", "BATS", "NASDAQ", "NYSE", "NYSEARCA", "OTC",
] as const);
const ALLOWED_RESPONSE_KEYS = Object.freeze([
  "id", "class", "exchange", "symbol", "name", "status", "tradable",
  "marginable", "maintenance_margin_requirement", "shortable",
  "easy_to_borrow", "fractionable", "attributes", "borrow_status",
] as const);

export interface AlpacaPersonalAssetMetadataRequest {
  readonly requestId: "personal-alpaca:asset-metadata:MULS";
  readonly method: "GET";
  readonly endpoint: typeof ALPACA_PERSONAL_MULS_ASSET_ENDPOINT;
  readonly query: readonly [];
  readonly bodyAllowed: false;
  readonly timeoutMs: 10_000;
  readonly maxResponseBytes: 65_536;
}

export interface AlpacaPersonalAssetMetadataResponse {
  readonly statusCode: number;
  readonly receivedAt: string;
  readonly body: string;
}

export interface AlpacaPersonalAssetMetadataTransport {
  assertReady(request: Readonly<AlpacaPersonalAssetMetadataRequest>): void;
  execute(
    request: Readonly<AlpacaPersonalAssetMetadataRequest>,
    credentials: Readonly<AlpacaCredentials>,
    signal?: AbortSignal,
  ): Promise<AlpacaPersonalAssetMetadataResponse>;
}

export enum AlpacaPersonalAssetMetadataClassification {
  ActiveTradableNms = "ACTIVE_TRADABLE_NMS",
  ActiveNonTradableNms = "ACTIVE_NON_TRADABLE_NMS",
  Inactive = "INACTIVE",
  OtcUnsupported = "OTC_UNSUPPORTED",
}

export interface AlpacaPersonalAssetMetadataObservation {
  readonly symbol: typeof ALPACA_PERSONAL_MULS_SYMBOL;
  readonly assetClass: "us_equity";
  readonly exchange: typeof APPROVED_EXCHANGES[number];
  readonly status: "active" | "inactive";
  readonly tradable: boolean;
  readonly classification: AlpacaPersonalAssetMetadataClassification;
}

export enum AlpacaPersonalAssetMetadataErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  TransportFailed = "TRANSPORT_FAILED",
  AssetNotFound = "ASSET_NOT_FOUND",
  ResponseInvalid = "RESPONSE_INVALID",
}

export class AlpacaPersonalAssetMetadataError extends Error {
  public constructor(
    public readonly safeCode: AlpacaPersonalAssetMetadataErrorCode,
    public readonly attemptedNetworkRequests: 0 | 1,
    public readonly completedNetworkRequests: 0 | 1,
  ) {
    super(`Alpaca MULS asset-metadata diagnostic failed: ${safeCode}.`);
    this.name = "AlpacaPersonalAssetMetadataError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: ALPACA_PERSONAL_ASSET_METADATA_PROVIDER_ID,
      symbol: ALPACA_PERSONAL_MULS_SYMBOL,
      safeCode: this.safeCode,
      attemptedNetworkRequests: this.attemptedNetworkRequests,
      completedNetworkRequests: this.completedNetworkRequests,
    });
  }
}

export interface AlpacaPersonalAssetMetadataDiagnosticInput {
  readonly confirmed: boolean;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly transport?: AlpacaPersonalAssetMetadataTransport;
}

export interface AlpacaPersonalAssetMetadataDiagnosticSummary {
  readonly notice: "ASSET METADATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY";
  readonly mode: "DRY_RUN" | "LIVE_READ";
  readonly providerId: typeof ALPACA_PERSONAL_ASSET_METADATA_PROVIDER_ID;
  readonly symbol: typeof ALPACA_PERSONAL_MULS_SYMBOL;
  readonly endpointHost: "paper-api.alpaca.markets";
  readonly requestBudget: 1;
  readonly networkRequests: 0 | 1;
  readonly validatedResponses: 0 | 1;
  readonly credential: AlpacaCredentialDiagnostic;
  readonly observation?: AlpacaPersonalAssetMetadataObservation;
  readonly persistenceWrites: 0;
  readonly rawPayloadExposed: false;
  readonly marketDataAuthority: false;
  readonly recommendationAuthority: false;
  readonly tradingAuthority: false;
  readonly warnings: readonly string[];
}

export function createAlpacaPersonalMulsAssetMetadataRequest(): AlpacaPersonalAssetMetadataRequest {
  return deepFreeze({
    requestId: "personal-alpaca:asset-metadata:MULS",
    method: "GET",
    endpoint: ALPACA_PERSONAL_MULS_ASSET_ENDPOINT,
    query: [],
    bodyAllowed: false,
    timeoutMs: TIMEOUT_MS,
    maxResponseBytes: MAX_RESPONSE_BYTES,
  });
}

export async function runAlpacaPersonalMulsAssetMetadataDiagnostic(
  input: Readonly<AlpacaPersonalAssetMetadataDiagnosticInput>,
): Promise<AlpacaPersonalAssetMetadataDiagnosticSummary> {
  if (!isRecord(input) || typeof input.confirmed !== "boolean"
    || Object.keys(input).some((key) => !["confirmed", "environment", "transport"].includes(key))) {
    throw new AlpacaPersonalAssetMetadataError(AlpacaPersonalAssetMetadataErrorCode.InvalidRequest, 0, 0);
  }
  const credentials = loadAlpacaCredentials(copyCredentialEnvironment(input.environment));
  const request = createAlpacaPersonalMulsAssetMetadataRequest();
  const transport = input.transport ?? await defaultTransport();
  transport.assertReady(request);
  const common = {
    notice: "ASSET METADATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY" as const,
    providerId: ALPACA_PERSONAL_ASSET_METADATA_PROVIDER_ID,
    symbol: ALPACA_PERSONAL_MULS_SYMBOL,
    endpointHost: "paper-api.alpaca.markets" as const,
    requestBudget: 1 as const,
    credential: credentials.toRedactedDiagnostic(),
    persistenceWrites: 0 as const,
    rawPayloadExposed: false as const,
    marketDataAuthority: false as const,
    recommendationAuthority: false as const,
    tradingAuthority: false as const,
  };
  if (!input.confirmed) {
    return deepFreeze({
      ...common,
      mode: "DRY_RUN",
      networkRequests: 0,
      validatedResponses: 0,
      warnings: [
        "Owner confirmation is absent; no network request was made.",
        "Asset metadata cannot establish IEX Bar or Quote coverage.",
      ],
    });
  }
  let response: AlpacaPersonalAssetMetadataResponse;
  try {
    response = await transport.execute(request, credentials);
  } catch (error) {
    const statusCode = transportStatusCode(error);
    throw new AlpacaPersonalAssetMetadataError(
      statusCode === 404
        ? AlpacaPersonalAssetMetadataErrorCode.AssetNotFound
        : AlpacaPersonalAssetMetadataErrorCode.TransportFailed,
      1,
      statusCode === undefined ? 0 : 1,
    );
  }
  const observation = validateAlpacaPersonalMulsAssetMetadataResponse(response.body);
  if (observation === undefined) {
    throw new AlpacaPersonalAssetMetadataError(
      AlpacaPersonalAssetMetadataErrorCode.ResponseInvalid,
      1,
      1,
    );
  }
  return deepFreeze({
    ...common,
    mode: "LIVE_READ",
    networkRequests: 1,
    validatedResponses: 1,
    observation,
    warnings: [
      "Asset metadata does not prove an IEX trade, Bar, Quote, liquidity, or ETF classification.",
      "T3G-C3 provider qualification remains blocked until separately reviewed evidence changes it.",
    ],
  });
}

export function validateAlpacaPersonalMulsAssetMetadataResponse(
  body: unknown,
): AlpacaPersonalAssetMetadataObservation | undefined {
  if (typeof body !== "string" || body.length === 0
    || new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (!isRecord(value) || Object.keys(value).some((key) => !ALLOWED_RESPONSE_KEYS.includes(
    key as typeof ALLOWED_RESPONSE_KEYS[number],
  ))) return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value.id))
    || value.class !== "us_equity"
    || !APPROVED_EXCHANGES.includes(value.exchange as typeof APPROVED_EXCHANGES[number])
    || value.symbol !== ALPACA_PERSONAL_MULS_SYMBOL
    || typeof value.name !== "string" || value.name.length < 3 || value.name.length > 200
    || !/^[\x20-\x7e]+$/u.test(value.name)
    || !["active", "inactive"].includes(String(value.status))
    || typeof value.tradable !== "boolean"
    || !validOptionalAssetFields(value)) return undefined;
  const status = value.status as "active" | "inactive";
  const exchange = value.exchange as typeof APPROVED_EXCHANGES[number];
  const classification = status === "inactive"
    ? AlpacaPersonalAssetMetadataClassification.Inactive
    : exchange === "OTC"
      ? AlpacaPersonalAssetMetadataClassification.OtcUnsupported
      : value.tradable
        ? AlpacaPersonalAssetMetadataClassification.ActiveTradableNms
        : AlpacaPersonalAssetMetadataClassification.ActiveNonTradableNms;
  return deepFreeze({
    symbol: ALPACA_PERSONAL_MULS_SYMBOL,
    assetClass: "us_equity",
    exchange,
    status,
    tradable: value.tradable,
    classification,
  });
}

function validOptionalAssetFields(value: Record<string, unknown>): boolean {
  const booleans = ["marginable", "shortable", "easy_to_borrow", "fractionable"];
  if (booleans.some((key) => key in value && typeof value[key] !== "boolean")) return false;
  if ("maintenance_margin_requirement" in value
    && (typeof value.maintenance_margin_requirement !== "number"
      || !Number.isFinite(value.maintenance_margin_requirement)
      || value.maintenance_margin_requirement < 0)) return false;
  if ("attributes" in value && (!Array.isArray(value.attributes)
    || value.attributes.length > 32
    || !value.attributes.every((entry) => typeof entry === "string" && /^[a-z0-9_]{1,64}$/u.test(entry)))) return false;
  return !("borrow_status" in value
    && (typeof value.borrow_status !== "string" || !/^[A-Za-z0-9_ -]{1,64}$/u.test(value.borrow_status)));
}

function copyCredentialEnvironment(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): Readonly<Record<string, string | undefined>> {
  return Object.freeze({
    [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: environment?.[ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE],
    [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: environment?.[ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE],
  });
}

async function defaultTransport(): Promise<AlpacaPersonalAssetMetadataTransport> {
  const module = await import("./AlpacaPersonalAssetMetadataTransport");
  return new module.AlpacaPersonalAssetMetadataHttpsTransport();
}

function transportStatusCode(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "statusCode" in error
    && Number.isSafeInteger((error as { readonly statusCode?: unknown }).statusCode)
    ? Number((error as { readonly statusCode: number }).statusCode)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
