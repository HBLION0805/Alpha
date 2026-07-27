import {
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  TWELVE_DATA_PROVIDER_ID,
  type TwelveDataCredentialDiagnostic,
  type TwelveDataCredentials,
} from "./TwelveDataContracts";
import { loadTwelveDataCredentials } from "./TwelveDataProvider";

export const TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID =
  "twelve-data:personal-muls-reference:1" as const;
export const TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT =
  "https://api.twelvedata.com/etfs/list" as const;
export const TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL = "MULS" as const;

const MAX_RESPONSE_CHARACTERS = 1_000_000;
const TIMEOUT_MS = 10_000;
const ALLOWED_TOP_LEVEL_KEYS = Object.freeze(["result", "status"] as const);
const ALLOWED_RESULT_KEYS = Object.freeze(["count", "list"] as const);
const ALLOWED_RECORD_KEYS = Object.freeze([
  "symbol", "name", "country", "mic_code", "fund_family", "fund_type",
] as const);

export interface TwelveDataPersonalMulsReferenceRequest {
  readonly requestId: "twelve-data:personal-muls-reference:MULS";
  readonly policyId: typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID;
  readonly method: "GET";
  readonly endpoint: typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT;
  readonly query: readonly [
    readonly ["country", "US"],
    readonly ["format", "JSON"],
    readonly ["outputsize", "1"],
    readonly ["page", "1"],
    readonly ["symbol", "MULS"],
  ];
  readonly bodyAllowed: false;
  readonly timeoutMs: 10_000;
  readonly maxResponseCharacters: 1_000_000;
  readonly maxRequests: 1;
  readonly maxCredits: 1;
  readonly redirectsAllowed: false;
  readonly retriesAllowed: false;
  readonly paginationAllowed: false;
  readonly persistenceAllowed: false;
}

export interface TwelveDataPersonalMulsReferenceResponse {
  readonly statusCode: number;
  readonly receivedAt: string;
  readonly body: string;
}

export interface TwelveDataPersonalMulsReferenceTransport {
  readonly kind: "FIXTURE_ONLY";
  readonly networkCapable: false;
  assertReady(request: Readonly<TwelveDataPersonalMulsReferenceRequest>): void;
  execute(
    request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
    credentials: Readonly<TwelveDataCredentials>,
    signal?: AbortSignal,
  ): Promise<TwelveDataPersonalMulsReferenceResponse>;
}

export enum TwelveDataPersonalMulsReferenceResultCode {
  ReferenceConfirmed = "REFERENCE_CONFIRMED",
  ReferenceNotFound = "REFERENCE_NOT_FOUND",
  ReferenceAmbiguous = "REFERENCE_AMBIGUOUS",
  ReferenceIdentityMismatch = "REFERENCE_IDENTITY_MISMATCH",
  ProviderRejected = "PROVIDER_REJECTED",
  HttpFailure = "HTTP_FAILURE",
  TransportFailure = "TRANSPORT_FAILURE",
  ResponseInvalid = "RESPONSE_INVALID",
}

export interface TwelveDataPersonalMulsReferenceObservation {
  readonly symbol: typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL;
  readonly country: "US";
  readonly micCode: string;
  readonly assetDirectory: "ETF";
}

export interface TwelveDataPersonalMulsReferenceValidation {
  readonly resultCode: TwelveDataPersonalMulsReferenceResultCode;
  readonly observation?: TwelveDataPersonalMulsReferenceObservation;
}

export enum TwelveDataPersonalMulsReferenceErrorCode {
  InvalidInput = "INVALID_INPUT",
  MissingTransport = "MISSING_TRANSPORT",
  HttpFailure = "HTTP_FAILURE",
  TransportFailure = "TRANSPORT_FAILURE",
  ResponseInvalid = "RESPONSE_INVALID",
}

export class TwelveDataPersonalMulsReferenceError extends Error {
  public constructor(
    public readonly safeCode: TwelveDataPersonalMulsReferenceErrorCode,
    public readonly attemptedNetworkRequests: 0 | 1,
    public readonly completedNetworkRequests: 0 | 1,
  ) {
    super(`Twelve Data MULS reference diagnostic failed: ${safeCode}.`);
    this.name = "TwelveDataPersonalMulsReferenceError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: TWELVE_DATA_PROVIDER_ID,
      symbol: TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL,
      safeCode: this.safeCode,
      attemptedNetworkRequests: this.attemptedNetworkRequests,
      completedNetworkRequests: this.completedNetworkRequests,
    });
  }
}

export interface TwelveDataPersonalMulsReferenceDiagnosticInput {
  readonly confirmed: boolean;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly transport?: TwelveDataPersonalMulsReferenceTransport;
  readonly signal?: AbortSignal;
}

export interface TwelveDataPersonalMulsReferenceDiagnosticSummary {
  readonly notice: "REFERENCE DATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY";
  readonly mode: "DRY_RUN" | "FIXTURE_REHEARSAL";
  readonly providerId: typeof TWELVE_DATA_PROVIDER_ID;
  readonly policyId: typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID;
  readonly symbol: typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL;
  readonly endpointHost: "api.twelvedata.com";
  readonly endpointPath: "/etfs/list";
  readonly requestFingerprint: string;
  readonly requestBudget: 1;
  readonly creditBudget: 1;
  readonly networkRequests: 0;
  readonly transportInvocations: 0 | 1;
  readonly validatedResponses: 0 | 1;
  readonly credential: TwelveDataCredentialDiagnostic;
  readonly validation?: TwelveDataPersonalMulsReferenceValidation;
  readonly persistenceWrites: 0;
  readonly retries: 0;
  readonly paginationRequests: 0;
  readonly rawPayloadExposed: false;
  readonly marketDataAuthority: false;
  readonly collectionAuthority: false;
  readonly recommendationAuthority: false;
  readonly tradingAuthority: false;
  readonly warnings: readonly string[];
}

export function createTwelveDataPersonalMulsReferenceRequest():
TwelveDataPersonalMulsReferenceRequest {
  return deepFreeze({
    requestId: "twelve-data:personal-muls-reference:MULS",
    policyId: TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID,
    method: "GET",
    endpoint: TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT,
    query: [
      ["country", "US"],
      ["format", "JSON"],
      ["outputsize", "1"],
      ["page", "1"],
      ["symbol", "MULS"],
    ],
    bodyAllowed: false,
    timeoutMs: TIMEOUT_MS,
    maxResponseCharacters: MAX_RESPONSE_CHARACTERS,
    maxRequests: 1,
    maxCredits: 1,
    redirectsAllowed: false,
    retriesAllowed: false,
    paginationAllowed: false,
    persistenceAllowed: false,
  });
}

export function validateTwelveDataPersonalMulsReferenceResponse(
  body: unknown,
): TwelveDataPersonalMulsReferenceValidation {
  if (typeof body !== "string" || body.length === 0
    || body.length > MAX_RESPONSE_CHARACTERS) {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid);
  }
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid);
  }
  if (!isRecord(value)) {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid);
  }
  if (value.status === "error") {
    return providerErrorShape(value)
      ? validation(TwelveDataPersonalMulsReferenceResultCode.ProviderRejected)
      : validation(TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid);
  }
  if (hasUnknownKeys(value, ALLOWED_TOP_LEVEL_KEYS)
    || value.status !== "ok"
    || !isRecord(value.result)
    || hasUnknownKeys(value.result, ALLOWED_RESULT_KEYS)
    || !Number.isSafeInteger(value.result.count)
    || Number(value.result.count) < 0
    || !Array.isArray(value.result.list)) {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid);
  }
  const count = Number(value.result.count);
  const list = value.result.list;
  if (count === 0 && list.length === 0) {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ReferenceNotFound);
  }
  if (count !== 1 || list.length !== 1) {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ReferenceAmbiguous);
  }
  const record = list[0];
  if (!validRecordShape(record)) {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid);
  }
  const country = record.country === "US" || record.country === "United States";
  const micCode = record.mic_code;
  const mic = typeof micCode === "string" && /^[A-Z0-9]{4}$/u.test(micCode);
  if (record.symbol !== TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL || !country || !mic) {
    return validation(TwelveDataPersonalMulsReferenceResultCode.ReferenceIdentityMismatch);
  }
  return validation(TwelveDataPersonalMulsReferenceResultCode.ReferenceConfirmed, {
    symbol: TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL,
    country: "US",
    micCode,
    assetDirectory: "ETF",
  });
}

export async function runTwelveDataPersonalMulsReferenceDiagnostic(
  input: Readonly<TwelveDataPersonalMulsReferenceDiagnosticInput>,
): Promise<TwelveDataPersonalMulsReferenceDiagnosticSummary> {
  validateInput(input);
  const credentials = loadTwelveDataCredentials(copyCredentialEnvironment(input.environment));
  const request = createTwelveDataPersonalMulsReferenceRequest();
  const common = {
    notice: "REFERENCE DATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY" as const,
    providerId: TWELVE_DATA_PROVIDER_ID,
    policyId: TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID,
    symbol: TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL,
    endpointHost: "api.twelvedata.com" as const,
    endpointPath: "/etfs/list" as const,
    requestFingerprint: `twelve-data-muls-reference:${fnv1a64(canonicalize(request))}`,
    requestBudget: 1 as const,
    creditBudget: 1 as const,
    credential: credentials.toRedactedDiagnostic(),
    persistenceWrites: 0 as const,
    retries: 0 as const,
    paginationRequests: 0 as const,
    rawPayloadExposed: false as const,
    marketDataAuthority: false as const,
    collectionAuthority: false as const,
    recommendationAuthority: false as const,
    tradingAuthority: false as const,
  };
  if (!input.confirmed) {
    return deepFreeze({
      ...common,
      mode: "DRY_RUN",
      networkRequests: 0,
      transportInvocations: 0,
      validatedResponses: 0,
      warnings: [
        "Owner confirmation is absent; no transport was invoked.",
        "Reference presence cannot qualify Bars, Quotes, quantities, or budget.",
      ],
    });
  }
  if (input.transport === undefined) {
    throw new TwelveDataPersonalMulsReferenceError(
      TwelveDataPersonalMulsReferenceErrorCode.MissingTransport, 0, 0,
    );
  }
  if (input.transport.kind !== "FIXTURE_ONLY" || input.transport.networkCapable !== false) {
    throw new TwelveDataPersonalMulsReferenceError(
      TwelveDataPersonalMulsReferenceErrorCode.InvalidInput, 0, 0,
    );
  }
  try {
    input.transport.assertReady(request);
  } catch {
    throw new TwelveDataPersonalMulsReferenceError(
      TwelveDataPersonalMulsReferenceErrorCode.InvalidInput, 0, 0,
    );
  }
  let response: TwelveDataPersonalMulsReferenceResponse;
  try {
    response = await input.transport.execute(request, credentials, input.signal);
  } catch {
    throw new TwelveDataPersonalMulsReferenceError(
      TwelveDataPersonalMulsReferenceErrorCode.TransportFailure, 0, 0,
    );
  }
  if (!validTransportResponse(response)) {
    throw new TwelveDataPersonalMulsReferenceError(
      TwelveDataPersonalMulsReferenceErrorCode.ResponseInvalid, 0, 0,
    );
  }
  if (response.statusCode < 200 || response.statusCode > 299) {
    throw new TwelveDataPersonalMulsReferenceError(
      TwelveDataPersonalMulsReferenceErrorCode.HttpFailure, 0, 0,
    );
  }
  const parsed = validateTwelveDataPersonalMulsReferenceResponse(response.body);
  return deepFreeze({
    ...common,
    mode: "FIXTURE_REHEARSAL",
    networkRequests: 0,
    transportInvocations: 1,
    validatedResponses: parsed.resultCode ===
      TwelveDataPersonalMulsReferenceResultCode.ResponseInvalid ? 0 : 1,
    validation: parsed,
    warnings: [
      "Reference-directory presence is not market-data coverage.",
      "Every T3G-C6 blocker remains active except exact reference presence if confirmed.",
    ],
  });
}

function validateInput(input: Readonly<TwelveDataPersonalMulsReferenceDiagnosticInput>): void {
  if (!isRecord(input)
    || typeof input.confirmed !== "boolean"
    || Object.keys(input).some((key) =>
      !["confirmed", "environment", "transport", "signal"].includes(key))) {
    throw new TwelveDataPersonalMulsReferenceError(
      TwelveDataPersonalMulsReferenceErrorCode.InvalidInput, 0, 0,
    );
  }
}

function validRecordShape(value: unknown): value is Record<string, string> {
  return isRecord(value)
    && !hasUnknownKeys(value, ALLOWED_RECORD_KEYS)
    && ALLOWED_RECORD_KEYS.every((key) =>
      typeof value[key] === "string" && value[key].length > 0 && value[key].length <= 240);
}

function providerErrorShape(value: Record<string, unknown>): boolean {
  return !hasUnknownKeys(value, ["status", "code", "message"])
    && value.status === "error"
    && (typeof value.code === "number" || typeof value.code === "string")
    && typeof value.message === "string"
    && value.message.length > 0
    && value.message.length <= 500;
}

function validTransportResponse(
  value: TwelveDataPersonalMulsReferenceResponse,
): boolean {
  return isRecord(value)
    && Object.keys(value).every((key) => ["statusCode", "receivedAt", "body"].includes(key))
    && Number.isSafeInteger(value.statusCode)
    && value.statusCode >= 100 && value.statusCode <= 599
    && typeof value.receivedAt === "string"
    && Number.isFinite(Date.parse(value.receivedAt))
    && new Date(value.receivedAt).toISOString() === value.receivedAt
    && typeof value.body === "string"
    && value.body.length <= MAX_RESPONSE_CHARACTERS;
}

function copyCredentialEnvironment(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): Readonly<Record<string, string | undefined>> {
  return Object.freeze({
    [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]:
      environment?.[TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE],
  });
}

function validation(
  resultCode: TwelveDataPersonalMulsReferenceResultCode,
  observation?: TwelveDataPersonalMulsReferenceObservation,
): TwelveDataPersonalMulsReferenceValidation {
  return deepFreeze(observation === undefined ? { resultCode } : { resultCode, observation });
}

function hasUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
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
