const APPROVED_MARKET_TICKER = "KXBTC15M-26JUL232045-45";
const APPROVED_ENDPOINT = `https://external-api.kalshi.com/trade-api/v2/markets/${APPROVED_MARKET_TICKER}`;
const APPROVED_HOSTNAME = "external-api.kalshi.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 100_000;

export enum KalshiPublicTransportErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  UnapprovedHost = "UNAPPROVED_HOST",
  NetworkFailure = "NETWORK_FAILURE",
  Timeout = "TIMEOUT",
  Cancelled = "CANCELLED",
  HttpFailure = "HTTP_FAILURE",
  ResponseTooLarge = "RESPONSE_TOO_LARGE",
}

export class KalshiPublicTransportError extends Error {
  public constructor(
    public readonly safeCode: KalshiPublicTransportErrorCode,
    public readonly statusCode?: number,
  ) {
    super(`Kalshi bounded live-read transport failed: ${safeCode}.`);
    this.name = "KalshiPublicTransportError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: "provider:kalshi:public-api",
      safeCode: this.safeCode,
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
    });
  }
}

export interface KalshiPublicHttpRequest {
  readonly endpoint: string;
  readonly method: "GET";
  readonly timeoutMs: number;
}

export interface KalshiPublicHttpResponse {
  readonly statusCode: number;
  readonly receivedAt: string;
  readonly body: string;
}

export interface KalshiPublicHttpTransport {
  assertReady(request: Readonly<KalshiPublicHttpRequest>): void;
  execute(
    request: Readonly<KalshiPublicHttpRequest>,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<KalshiPublicHttpResponse>;
}

export interface KalshiPublicHttpsExecutorResponse {
  readonly statusCode: number;
  readonly body: string;
}

export interface KalshiPublicHttpsRequestExecutor {
  execute(
    target: URL,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<KalshiPublicHttpsExecutorResponse>;
}

export interface KalshiPublicHttpsTransportOptions {
  readonly executor?: KalshiPublicHttpsRequestExecutor;
  readonly clock?: { now(): string };
}

/** One-request, public, exact-market HTTPS boundary. */
export class KalshiPublicHttpsTransport implements KalshiPublicHttpTransport {
  readonly #executor: KalshiPublicHttpsRequestExecutor;
  readonly #clock: { now(): string };

  public constructor(options: KalshiPublicHttpsTransportOptions = {}) {
    this.#executor = options.executor ?? new PlatformFetchRequestExecutor();
    this.#clock = options.clock ?? { now: () => new Date().toISOString() };
  }

  public assertReady(request: Readonly<KalshiPublicHttpRequest>): void {
    validateRequest(request);
  }

  public async execute(
    request: Readonly<KalshiPublicHttpRequest>,
    options: Readonly<{ signal?: AbortSignal }> = {},
  ): Promise<KalshiPublicHttpResponse> {
    validateRequest(request);
    if (options.signal?.aborted === true) {
      throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.Cancelled);
    }

    let response: KalshiPublicHttpsExecutorResponse;
    try {
      response = await this.#executor.execute(
        new URL(request.endpoint),
        request.timeoutMs,
        MAX_RESPONSE_BYTES,
        options.signal,
      );
    } catch (error: unknown) {
      if (error instanceof KalshiPublicTransportError) throw error;
      throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.NetworkFailure);
    }

    if (!Number.isSafeInteger(response.statusCode)
      || response.statusCode < 100
      || response.statusCode > 599) {
      throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.NetworkFailure);
    }
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new KalshiPublicTransportError(
        KalshiPublicTransportErrorCode.HttpFailure,
        response.statusCode,
      );
    }
    if (new TextEncoder().encode(response.body).length > MAX_RESPONSE_BYTES) {
      throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.ResponseTooLarge);
    }

    return deepFreeze({
      statusCode: response.statusCode,
      receivedAt: requireTimestamp(this.#clock.now()),
      body: response.body,
    });
  }
}

class PlatformFetchRequestExecutor implements KalshiPublicHttpsRequestExecutor {
  public execute(
    target: URL,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<KalshiPublicHttpsExecutorResponse> {
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
): Promise<KalshiPublicHttpsExecutorResponse> {
  const fetchFunction = (globalThis as unknown as { readonly fetch?: FetchFunction }).fetch;
  if (fetchFunction === undefined) {
    throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.NetworkFailure);
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
    if (new TextEncoder().encode(body).length > maxResponseBytes) {
      throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.ResponseTooLarge);
    }
    return { statusCode: response.status, body };
  } catch (error: unknown) {
    if (error instanceof KalshiPublicTransportError) throw error;
    throw new KalshiPublicTransportError(
      signal?.aborted === true
        ? KalshiPublicTransportErrorCode.Cancelled
        : controller.signal.aborted
          ? KalshiPublicTransportErrorCode.Timeout
          : KalshiPublicTransportErrorCode.NetworkFailure,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

function validateRequest(request: Readonly<KalshiPublicHttpRequest>): void {
  let endpoint: URL;
  try {
    endpoint = new URL(request.endpoint);
  } catch {
    throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.InvalidRequest);
  }
  if (request.endpoint !== APPROVED_ENDPOINT
    || endpoint.protocol !== "https:"
    || endpoint.hostname !== APPROVED_HOSTNAME
    || endpoint.port !== ""
    || endpoint.username !== ""
    || endpoint.password !== ""
    || endpoint.search !== ""
    || endpoint.hash !== "") {
    throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.UnapprovedHost);
  }
  if (request.method !== "GET"
    || !Number.isSafeInteger(request.timeoutMs)
    || request.timeoutMs < 1
    || request.timeoutMs > MAX_TIMEOUT_MS) {
    throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.InvalidRequest);
  }
}

function requireTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new KalshiPublicTransportError(KalshiPublicTransportErrorCode.NetworkFailure);
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export const KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS = Object.freeze({
  endpoint: APPROVED_ENDPOINT,
  hostname: APPROVED_HOSTNAME,
  marketTicker: APPROVED_MARKET_TICKER,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxResponseBytes: MAX_RESPONSE_BYTES,
});
