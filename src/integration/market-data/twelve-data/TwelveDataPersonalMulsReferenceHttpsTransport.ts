import type { TwelveDataCredentials } from "./TwelveDataContracts";
import {
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT,
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID,
  type TwelveDataPersonalMulsReferenceRequest,
  type TwelveDataPersonalMulsReferenceResponse,
} from "./TwelveDataPersonalMulsReferenceDiagnostic";
import {
  parseTwelveDataPersonalMulsReferenceProviderError,
  type TwelveDataPersonalMulsReferenceProviderErrorDiagnostic,
} from "./TwelveDataPersonalMulsReferenceErrorDiagnostic";

const APPROVED_HOSTNAME = "api.twelvedata.com";
const EXPECTED_QUERY = Object.freeze([
  ["country", "US"],
  ["format", "JSON"],
  ["outputsize", "1"],
  ["page", "1"],
  ["symbol", "MULS"],
] as const);

export enum TwelveDataPersonalMulsReferenceTransportErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  UnapprovedEndpoint = "UNAPPROVED_ENDPOINT",
  Cancelled = "CANCELLED",
  Timeout = "TIMEOUT",
  NetworkFailure = "NETWORK_FAILURE",
  HttpFailure = "HTTP_FAILURE",
  ResponseTooLarge = "RESPONSE_TOO_LARGE",
  InvalidClock = "INVALID_CLOCK",
}

export class TwelveDataPersonalMulsReferenceTransportError extends Error {
  public constructor(
    public readonly safeCode: TwelveDataPersonalMulsReferenceTransportErrorCode,
    public readonly statusCode?: number,
    public readonly providerError?:
      Readonly<TwelveDataPersonalMulsReferenceProviderErrorDiagnostic>,
  ) {
    super(`Twelve Data MULS reference transport failed: ${safeCode}.`);
    this.name = "TwelveDataPersonalMulsReferenceTransportError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: "provider:twelve-data",
      symbol: "MULS",
      safeCode: this.safeCode,
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
    });
  }
}

export interface TwelveDataPersonalMulsReferenceExecutorResponse {
  readonly statusCode: number;
  readonly body: string;
}

export interface TwelveDataPersonalMulsReferenceRequestExecutor {
  execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<TwelveDataPersonalMulsReferenceExecutorResponse>;
}

export interface TwelveDataPersonalMulsReferenceLiveTransport {
  readonly kind: "LIVE_HTTPS";
  readonly networkCapable: true;
  assertReady(request: Readonly<TwelveDataPersonalMulsReferenceRequest>): void;
  execute(
    request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
    credentials: Readonly<TwelveDataCredentials>,
    signal?: AbortSignal,
  ): Promise<TwelveDataPersonalMulsReferenceResponse>;
}

export interface TwelveDataPersonalMulsReferenceHttpsTransportOptions {
  readonly executor?: TwelveDataPersonalMulsReferenceRequestExecutor;
  readonly clock?: { now(): string };
}

export class TwelveDataPersonalMulsReferenceHttpsTransport
implements TwelveDataPersonalMulsReferenceLiveTransport {
  public readonly kind = "LIVE_HTTPS" as const;
  public readonly networkCapable = true as const;
  readonly #executor: TwelveDataPersonalMulsReferenceRequestExecutor;
  readonly #clock: { now(): string };

  public constructor(
    options: TwelveDataPersonalMulsReferenceHttpsTransportOptions = {},
  ) {
    this.#executor = options.executor ?? new PlatformFetchExecutor();
    this.#clock = options.clock ?? { now: () => new Date().toISOString() };
  }

  public assertReady(
    request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
  ): void {
    validateRequest(request);
  }

  public async execute(
    request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
    credentials: Readonly<TwelveDataCredentials>,
    signal?: AbortSignal,
  ): Promise<TwelveDataPersonalMulsReferenceResponse> {
    validateRequest(request);
    if (signal?.aborted === true) {
      throw new TwelveDataPersonalMulsReferenceTransportError(
        TwelveDataPersonalMulsReferenceTransportErrorCode.Cancelled,
      );
    }

    const target = new URL(request.endpoint);
    for (const [key, value] of request.query) {
      target.searchParams.append(key, value);
    }
    const credential = credentials.revealForTransport();
    const headers = Object.freeze({
      accept: "application/json",
      Authorization: `apikey ${credential}`,
    });

    let response: TwelveDataPersonalMulsReferenceExecutorResponse;
    try {
      response = await this.#executor.execute(
        target,
        headers,
        request.timeoutMs,
        request.maxResponseCharacters,
        signal,
      );
    } catch (error) {
      if (error instanceof TwelveDataPersonalMulsReferenceTransportError) {
        throw error;
      }
      throw new TwelveDataPersonalMulsReferenceTransportError(
        TwelveDataPersonalMulsReferenceTransportErrorCode.NetworkFailure,
      );
    }

    if (!Number.isSafeInteger(response.statusCode)
      || response.statusCode < 100
      || response.statusCode > 599) {
      throw new TwelveDataPersonalMulsReferenceTransportError(
        TwelveDataPersonalMulsReferenceTransportErrorCode.NetworkFailure,
      );
    }
    if (new TextEncoder().encode(response.body).byteLength
      > request.maxResponseCharacters) {
      throw new TwelveDataPersonalMulsReferenceTransportError(
        TwelveDataPersonalMulsReferenceTransportErrorCode.ResponseTooLarge,
      );
    }
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new TwelveDataPersonalMulsReferenceTransportError(
        TwelveDataPersonalMulsReferenceTransportErrorCode.HttpFailure,
        response.statusCode,
        parseTwelveDataPersonalMulsReferenceProviderError(
          response.body,
          [credential],
        ),
      );
    }

    const receivedAt = this.#clock.now();
    if (!isCanonicalTimestamp(receivedAt)) {
      throw new TwelveDataPersonalMulsReferenceTransportError(
        TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidClock,
      );
    }
    return deepFreeze({
      statusCode: response.statusCode,
      receivedAt,
      body: response.body,
    });
  }
}

class PlatformFetchExecutor
implements TwelveDataPersonalMulsReferenceRequestExecutor {
  public async execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<TwelveDataPersonalMulsReferenceExecutorResponse> {
    const controller = new AbortController();
    const onAbort = (): void => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target.toString(), {
        method: "GET",
        headers,
        redirect: "error",
        signal: controller.signal,
      });
      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > maxResponseBytes) {
        throw new TwelveDataPersonalMulsReferenceTransportError(
          TwelveDataPersonalMulsReferenceTransportErrorCode.ResponseTooLarge,
        );
      }
      return { statusCode: response.status, body };
    } catch (error) {
      if (error instanceof TwelveDataPersonalMulsReferenceTransportError) {
        throw error;
      }
      throw new TwelveDataPersonalMulsReferenceTransportError(
        signal?.aborted === true
          ? TwelveDataPersonalMulsReferenceTransportErrorCode.Cancelled
          : controller.signal.aborted
            ? TwelveDataPersonalMulsReferenceTransportErrorCode.Timeout
            : TwelveDataPersonalMulsReferenceTransportErrorCode.NetworkFailure,
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

function validateRequest(
  request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
): void {
  let target: URL;
  try {
    target = new URL(request.endpoint);
  } catch {
    throw new TwelveDataPersonalMulsReferenceTransportError(
      TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidRequest,
    );
  }
  if (request.endpoint !== TWELVE_DATA_PERSONAL_MULS_REFERENCE_ENDPOINT
    || target.protocol !== "https:"
    || target.hostname !== APPROVED_HOSTNAME
    || target.port !== ""
    || target.username !== ""
    || target.password !== ""
    || target.search !== ""
    || target.hash !== "") {
    throw new TwelveDataPersonalMulsReferenceTransportError(
      TwelveDataPersonalMulsReferenceTransportErrorCode.UnapprovedEndpoint,
    );
  }

  const keys = [
    "bodyAllowed", "endpoint", "maxCredits",
    "maxRequests", "maxResponseCharacters", "method", "paginationAllowed",
    "persistenceAllowed", "policyId", "query", "redirectsAllowed",
    "requestId", "retriesAllowed", "timeoutMs",
  ];
  if (request.requestId !== "twelve-data:personal-muls-reference:MULS"
    || request.policyId !== TWELVE_DATA_PERSONAL_MULS_REFERENCE_POLICY_ID
    || request.method !== "GET"
    || request.bodyAllowed !== false
    || request.timeoutMs !== 10_000
    || request.maxResponseCharacters !== 1_000_000
    || request.maxRequests !== 1
    || request.maxCredits !== 1
    || request.redirectsAllowed !== false
    || request.retriesAllowed !== false
    || request.paginationAllowed !== false
    || request.persistenceAllowed !== false
    || JSON.stringify(request.query) !== JSON.stringify(EXPECTED_QUERY)
    || Object.keys(request).sort().join("|") !== keys.sort().join("|")) {
    throw new TwelveDataPersonalMulsReferenceTransportError(
      TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidRequest,
    );
  }
}

function isCanonicalTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
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
