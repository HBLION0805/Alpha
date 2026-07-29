import {
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  TWELVE_DATA_PROVIDER_ID,
  type TwelveDataCredentialDiagnostic,
} from "./TwelveDataContracts";
import {
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID,
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL,
  createTwelveDataPersonalMulsReferenceRequest,
  createTwelveDataPersonalMulsReferenceRequestFingerprint,
  validateTwelveDataPersonalMulsReferenceResponse,
  type TwelveDataPersonalMulsReferenceValidation,
} from "./TwelveDataPersonalMulsReferenceDiagnostic";
import {
  TwelveDataPersonalMulsReferenceTransportError,
  TwelveDataPersonalMulsReferenceTransportErrorCode,
  type TwelveDataPersonalMulsReferenceLiveTransport,
} from "./TwelveDataPersonalMulsReferenceHttpsTransport";
import {
  sanitizeTwelveDataPersonalMulsReferenceProviderError,
  type TwelveDataPersonalMulsReferenceProviderErrorDiagnostic,
} from "./TwelveDataPersonalMulsReferenceErrorDiagnostic";
import { loadTwelveDataCredentials } from "./TwelveDataProvider";

export const TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION =
  "CONFIRM_LIVE_REFERENCE_DIAGNOSTIC" as const;

export interface TwelveDataPersonalMulsReferenceOwnerAuthorization {
  readonly confirmation:
    typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION;
  readonly operationDateUtc: string;
  readonly requestFingerprint: string;
}

export interface TwelveDataPersonalMulsReferenceLiveOperationInput {
  readonly confirmed: boolean;
  readonly authorization?:
    Readonly<TwelveDataPersonalMulsReferenceOwnerAuthorization>;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly transport?: TwelveDataPersonalMulsReferenceLiveTransport;
  readonly signal?: AbortSignal;
  readonly clock?: { now(): string };
}

export enum TwelveDataPersonalMulsReferenceLiveErrorCode {
  InvalidInput = "INVALID_INPUT",
  InvalidAuthorization = "INVALID_AUTHORIZATION",
  InvalidConfiguration = "INVALID_CONFIGURATION",
  Cancelled = "CANCELLED",
  Timeout = "TIMEOUT",
  NetworkFailure = "NETWORK_FAILURE",
  HttpFailure = "HTTP_FAILURE",
  ResponseTooLarge = "RESPONSE_TOO_LARGE",
  InvalidClock = "INVALID_CLOCK",
}

export class TwelveDataPersonalMulsReferenceLiveError extends Error {
  public constructor(
    public readonly safeCode:
      TwelveDataPersonalMulsReferenceLiveErrorCode,
    public readonly attemptedNetworkRequests: 0 | 1,
    public readonly completedNetworkRequests: 0 | 1,
    public readonly statusCode?: number,
    public readonly providerError?:
      Readonly<TwelveDataPersonalMulsReferenceProviderErrorDiagnostic>,
  ) {
    super(`Twelve Data MULS live reference operation failed: ${safeCode}.`);
    this.name = "TwelveDataPersonalMulsReferenceLiveError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: TWELVE_DATA_PROVIDER_ID,
      symbol: TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL,
      safeCode: this.safeCode,
      attemptedNetworkRequests: this.attemptedNetworkRequests,
      completedNetworkRequests: this.completedNetworkRequests,
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
      ...(this.providerError === undefined
        ? {}
        : { providerError: this.providerError }),
    });
  }
}

export interface TwelveDataPersonalMulsReferenceLiveSummary {
  readonly notice:
    "REFERENCE DATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY";
  readonly mode: "DRY_RUN" | "LIVE_READ";
  readonly providerId: typeof TWELVE_DATA_PROVIDER_ID;
  readonly policyId: typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID;
  readonly symbol: typeof TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL;
  readonly endpointHost: "api.twelvedata.com";
  readonly endpointPath: "/etfs/list";
  readonly requestFingerprint: string;
  readonly authorizationState: "ABSENT" | "VALID";
  readonly authorizationDateUtc?: string;
  readonly requestBudget: 1;
  readonly creditBudget: 1;
  readonly networkRequests: 0 | 1;
  readonly completedNetworkRequests: 0 | 1;
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
  readonly elapsedMs: number;
  readonly warnings: readonly string[];
}

export async function runTwelveDataPersonalMulsReferenceLiveOperation(
  input: Readonly<TwelveDataPersonalMulsReferenceLiveOperationInput>,
): Promise<TwelveDataPersonalMulsReferenceLiveSummary> {
  validateInput(input);
  const clock = input.clock ?? { now: () => new Date().toISOString() };
  const startedAt = requireTimestamp(clock.now());
  const credentials = loadTwelveDataCredentials(
    copyCredentialEnvironment(input.environment),
  );
  const request = createTwelveDataPersonalMulsReferenceRequest();
  const requestFingerprint =
    createTwelveDataPersonalMulsReferenceRequestFingerprint(request);
  const transport = input.transport ?? await defaultTransport(clock);
  if (transport.kind !== "LIVE_HTTPS" || transport.networkCapable !== true) {
    throw new TwelveDataPersonalMulsReferenceLiveError(
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidConfiguration,
      0,
      0,
    );
  }
  try {
    transport.assertReady(request);
  } catch {
    throw new TwelveDataPersonalMulsReferenceLiveError(
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidConfiguration,
      0,
      0,
    );
  }

  const common = {
    notice:
      "REFERENCE DATA READ ONLY -- NO MARKET DATA, ACCOUNT, OR TRADING AUTHORITY" as const,
    providerId: TWELVE_DATA_PROVIDER_ID,
    policyId: TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID,
    symbol: TWELVE_DATA_PERSONAL_MULS_REFERENCE_SYMBOL,
    endpointHost: "api.twelvedata.com" as const,
    endpointPath: "/etfs/list" as const,
    requestFingerprint,
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
    if (input.authorization !== undefined) {
      throw new TwelveDataPersonalMulsReferenceLiveError(
        TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidAuthorization,
        0,
        0,
      );
    }
    return deepFreeze({
      ...common,
      mode: "DRY_RUN",
      authorizationState: "ABSENT",
      networkRequests: 0,
      completedNetworkRequests: 0,
      validatedResponses: 0,
      elapsedMs: elapsed(startedAt, requireTimestamp(clock.now())),
      warnings: [
        "Owner authorization is absent; no network request was made.",
        "Copy the exact request fingerprint before requesting live authorization.",
        "Reference presence cannot qualify Bars, Quotes, quantities, or budget.",
      ],
    });
  }

  const operationDateUtc = validateAuthorization(
    input.authorization,
    requestFingerprint,
    startedAt,
  );

  let response: Awaited<ReturnType<typeof transport.execute>>;
  try {
    response = await transport.execute(request, credentials, input.signal);
  } catch (error) {
    throw translateTransportError(error, credentials.revealForTransport());
  }
  const parsed = validateTwelveDataPersonalMulsReferenceResponse(response.body);
  return deepFreeze({
    ...common,
    mode: "LIVE_READ",
    authorizationState: "VALID",
    authorizationDateUtc: operationDateUtc,
    networkRequests: 1,
    completedNetworkRequests: 1,
    validatedResponses: parsed.resultCode === "RESPONSE_INVALID" ? 0 : 1,
    validation: parsed,
    elapsedMs: elapsed(startedAt, requireTimestamp(clock.now())),
    warnings: [
      "Reference-directory presence is not market-data coverage.",
      "Every T3G-C6 blocker remains active except exact reference presence if confirmed.",
      "Another real attempt requires a new Owner authorization.",
    ],
  });
}

function validateAuthorization(
  authorization:
    Readonly<TwelveDataPersonalMulsReferenceOwnerAuthorization> | undefined,
  requestFingerprint: string,
  startedAt: string,
): string {
  if (!isRecord(authorization)
    || Object.keys(authorization).sort().join("|")
      !== ["confirmation", "operationDateUtc", "requestFingerprint"]
        .sort().join("|")
    || authorization.confirmation
      !== TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION
    || !/^\d{4}-\d{2}-\d{2}$/u.test(authorization.operationDateUtc)
    || authorization.operationDateUtc !== startedAt.slice(0, 10)
    || authorization.requestFingerprint !== requestFingerprint) {
    throw new TwelveDataPersonalMulsReferenceLiveError(
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidAuthorization,
      0,
      0,
    );
  }
  return authorization.operationDateUtc;
}

function translateTransportError(
  error: unknown,
  credential: string,
): TwelveDataPersonalMulsReferenceLiveError {
  if (!(error instanceof TwelveDataPersonalMulsReferenceTransportError)) {
    return new TwelveDataPersonalMulsReferenceLiveError(
      TwelveDataPersonalMulsReferenceLiveErrorCode.NetworkFailure,
      1,
      0,
    );
  }
  const code = {
    [TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidRequest]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidConfiguration,
    [TwelveDataPersonalMulsReferenceTransportErrorCode.UnapprovedEndpoint]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidConfiguration,
    [TwelveDataPersonalMulsReferenceTransportErrorCode.Cancelled]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.Cancelled,
    [TwelveDataPersonalMulsReferenceTransportErrorCode.Timeout]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.Timeout,
    [TwelveDataPersonalMulsReferenceTransportErrorCode.NetworkFailure]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.NetworkFailure,
    [TwelveDataPersonalMulsReferenceTransportErrorCode.HttpFailure]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.HttpFailure,
    [TwelveDataPersonalMulsReferenceTransportErrorCode.ResponseTooLarge]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.ResponseTooLarge,
    [TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidClock]:
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidClock,
  } as const;
  const completed = error.safeCode ===
    TwelveDataPersonalMulsReferenceTransportErrorCode.HttpFailure
    || error.safeCode ===
      TwelveDataPersonalMulsReferenceTransportErrorCode.ResponseTooLarge
    || error.safeCode ===
      TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidClock
    ? 1
    : 0;
  const providerError =
    sanitizeTwelveDataPersonalMulsReferenceProviderError(
      error.providerError,
      [credential],
    );
  return new TwelveDataPersonalMulsReferenceLiveError(
    code[error.safeCode],
    error.safeCode ===
      TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidRequest
      || error.safeCode ===
        TwelveDataPersonalMulsReferenceTransportErrorCode.UnapprovedEndpoint
      ? 0
      : 1,
    completed,
    error.statusCode,
    providerError,
  );
}

function validateInput(
  input: Readonly<TwelveDataPersonalMulsReferenceLiveOperationInput>,
): void {
  if (!isRecord(input)
    || typeof input.confirmed !== "boolean"
    || Object.keys(input).some((key) =>
      !["authorization", "clock", "confirmed", "environment", "signal", "transport"]
        .includes(key))) {
    throw new TwelveDataPersonalMulsReferenceLiveError(
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidInput,
      0,
      0,
    );
  }
}

function copyCredentialEnvironment(
  environment: Readonly<Record<string, string | undefined>> | undefined,
): Readonly<Record<string, string | undefined>> {
  return Object.freeze({
    [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]:
      environment?.[TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE],
  });
}

async function defaultTransport(
  clock: { now(): string },
): Promise<TwelveDataPersonalMulsReferenceLiveTransport> {
  const module =
    await import("./TwelveDataPersonalMulsReferenceHttpsTransport");
  return new module.TwelveDataPersonalMulsReferenceHttpsTransport({ clock });
}

function requireTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new TwelveDataPersonalMulsReferenceLiveError(
      TwelveDataPersonalMulsReferenceLiveErrorCode.InvalidClock,
      0,
      0,
    );
  }
  return value;
}

function elapsed(startedAt: string, finishedAt: string): number {
  return Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
