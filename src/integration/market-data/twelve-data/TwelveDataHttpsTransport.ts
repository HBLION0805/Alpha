import {
  TWELVE_DATA_PROVIDER_ID,
  TwelveDataTransportKind,
  type TwelveDataCredentials,
  type TwelveDataHttpRequest,
  type TwelveDataHttpResponse,
  type TwelveDataHttpTransport,
  type TwelveDataTransportExecutionOptions,
} from "./TwelveDataContracts";

const APPROVED_ENDPOINT = "https://api.twelvedata.com/time_series";
const APPROVED_HOSTNAME = "api.twelvedata.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 1_000_000;

export enum TwelveDataTransportErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  UnapprovedHost = "UNAPPROVED_HOST",
  NetworkFailure = "NETWORK_FAILURE",
  Timeout = "TIMEOUT",
  Cancelled = "CANCELLED",
  HttpFailure = "HTTP_FAILURE",
  ResponseTooLarge = "RESPONSE_TOO_LARGE",
  MalformedResponse = "MALFORMED_RESPONSE",
  ProviderError = "PROVIDER_ERROR",
}

/** Safe transport failure. Provider bodies, URLs, and credentials are never retained. */
export class TwelveDataTransportError extends Error {
  public constructor(
    public readonly safeCode: TwelveDataTransportErrorCode,
    public readonly retryable = false,
    public readonly statusCode?: number,
  ) {
    super(`Twelve Data live-smoke transport failed: ${safeCode}.`);
    this.name = "TwelveDataTransportError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: TWELVE_DATA_PROVIDER_ID,
      safeCode: this.safeCode,
      retryable: this.retryable,
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
    });
  }
}

export interface TwelveDataHttpsExecutorResponse {
  readonly statusCode: number;
  readonly body: string;
}

/** Injection seam used by network-free tests; it is not exported from the integration barrel. */
export interface TwelveDataHttpsRequestExecutor {
  execute(
    target: URL,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<TwelveDataHttpsExecutorResponse>;
}

export interface TwelveDataHttpsTransportOptions {
  readonly executor?: TwelveDataHttpsRequestExecutor;
  readonly clock?: { now(): string };
}

/** Reviewed one-request HTTPS transport for the manual Twelve Data live-smoke path. */
export class TwelveDataHttpsTransport implements TwelveDataHttpTransport {
  readonly #executor: TwelveDataHttpsRequestExecutor;
  readonly #clock: { now(): string };

  public constructor(options: TwelveDataHttpsTransportOptions = {}) {
    this.#executor = options.executor ?? new PlatformFetchRequestExecutor();
    this.#clock = options.clock ?? { now: () => new Date().toISOString() };
  }

  public assertReady(request: Readonly<TwelveDataHttpRequest>): void {
    validatePublicRequest(request);
  }

  public async execute(
    request: Readonly<TwelveDataHttpRequest>,
    credentials: Readonly<TwelveDataCredentials>,
    options: Readonly<TwelveDataTransportExecutionOptions> = {},
  ): Promise<TwelveDataHttpResponse> {
    validatePublicRequest(request);
    if (options.signal?.aborted === true) {
      throw new TwelveDataTransportError(TwelveDataTransportErrorCode.Cancelled);
    }

    const target = new URL(request.endpoint);
    for (const [key, value] of request.query) target.searchParams.append(key, value);
    target.searchParams.append("apikey", credentials.revealForTransport());

    let response: TwelveDataHttpsExecutorResponse;
    try {
      response = await this.#executor.execute(
        target,
        request.timeoutMs,
        MAX_RESPONSE_BYTES,
        options.signal,
      );
    } catch (error: unknown) {
      if (error instanceof TwelveDataTransportError) throw error;
      throw new TwelveDataTransportError(TwelveDataTransportErrorCode.NetworkFailure);
    }

    if (!Number.isSafeInteger(response.statusCode) || response.statusCode < 100 || response.statusCode > 599) {
      throw new TwelveDataTransportError(TwelveDataTransportErrorCode.NetworkFailure);
    }
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new TwelveDataTransportError(TwelveDataTransportErrorCode.HttpFailure, false, response.statusCode);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      throw new TwelveDataTransportError(TwelveDataTransportErrorCode.MalformedResponse);
    }
    if (isRecord(parsed) && parsed.status === "error") {
      throw new TwelveDataTransportError(TwelveDataTransportErrorCode.ProviderError);
    }

    return deepFreeze({
      statusCode: response.statusCode,
      receivedAt: requireTimestamp(this.#clock.now()),
      transportKind: TwelveDataTransportKind.Live,
      body: response.body,
    });
  }
}

class PlatformFetchRequestExecutor implements TwelveDataHttpsRequestExecutor {
  public execute(
    target: URL,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<TwelveDataHttpsExecutorResponse> {
    return executeWithPlatformFetch(target, timeoutMs, maxResponseBytes, signal);
  }
}

interface FetchResponse {
  readonly status: number;
  text(): Promise<string>;
}

type FetchFunction = (target: string, init: {
  readonly method: "GET";
  readonly headers: Readonly<Record<string, string>>;
  readonly redirect: "error";
  readonly signal: AbortSignal;
}) => Promise<FetchResponse>;

async function executeWithPlatformFetch(
  target: URL,
  timeoutMs: number,
  maxResponseBytes: number,
  signal?: AbortSignal,
): Promise<TwelveDataHttpsExecutorResponse> {
  const fetchFunction = (globalThis as unknown as { readonly fetch?: FetchFunction }).fetch;
  if (fetchFunction === undefined) {
    throw new TwelveDataTransportError(TwelveDataTransportErrorCode.NetworkFailure);
  }
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFunction(target.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    const body = await response.text();
    if (body.length > maxResponseBytes) {
      throw new TwelveDataTransportError(TwelveDataTransportErrorCode.ResponseTooLarge);
    }
    return { statusCode: response.status, body };
  } catch (error: unknown) {
    if (error instanceof TwelveDataTransportError) throw error;
    throw new TwelveDataTransportError(
      signal?.aborted === true
        ? TwelveDataTransportErrorCode.Cancelled
        : controller.signal.aborted ? TwelveDataTransportErrorCode.Timeout : TwelveDataTransportErrorCode.NetworkFailure,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

function validatePublicRequest(request: Readonly<TwelveDataHttpRequest>): void {
  let endpoint: URL;
  try {
    endpoint = new URL(request.endpoint);
  } catch {
    throw new TwelveDataTransportError(TwelveDataTransportErrorCode.InvalidRequest);
  }
  if (request.endpoint !== APPROVED_ENDPOINT
    || endpoint.protocol !== "https:"
    || endpoint.hostname !== APPROVED_HOSTNAME
    || endpoint.port !== ""
    || endpoint.username !== ""
    || endpoint.password !== "") {
    throw new TwelveDataTransportError(TwelveDataTransportErrorCode.UnapprovedHost);
  }
  if (request.method !== "GET"
    || !Number.isSafeInteger(request.timeoutMs)
    || request.timeoutMs < 1
    || request.timeoutMs > MAX_TIMEOUT_MS
    || request.query.some(([key, value]) => key.trim() === "" || value.trim() === "" || key.toLowerCase() === "apikey")
    || new Set(request.query.map(([key]) => key)).size !== request.query.length) {
    throw new TwelveDataTransportError(TwelveDataTransportErrorCode.InvalidRequest);
  }
}

function requireTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new TwelveDataTransportError(TwelveDataTransportErrorCode.NetworkFailure);
  }
  return value;
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

export const TWELVE_DATA_LIVE_SMOKE_HTTP_DEFAULTS = Object.freeze({
  endpoint: APPROVED_ENDPOINT,
  hostname: APPROVED_HOSTNAME,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxResponseBytes: MAX_RESPONSE_BYTES,
});
