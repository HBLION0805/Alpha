import {
  ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
  AlpacaPersonalRequestKind,
  type AlpacaCredentials,
  type AlpacaHttpResponse,
  type AlpacaHttpTransport,
  type AlpacaPersonalHttpRequest,
  type AlpacaTransportExecutionOptions,
} from "./AlpacaPersonalMarketDataContracts";
import { ALPACA_PERSONAL_EXACT_SYMBOLS } from "./AlpacaPersonalMarketDataPlanner";

const BARS_ENDPOINT = "https://data.alpaca.markets/v2/stocks/bars";
const QUOTES_ENDPOINT = "https://data.alpaca.markets/v2/stocks/quotes/latest";
const APPROVED_HOSTNAME = "data.alpaca.markets";
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_TIMEOUT_MS = 10_000;

export enum AlpacaTransportErrorCode {
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

export class AlpacaTransportError extends Error {
  public constructor(
    public readonly safeCode: AlpacaTransportErrorCode,
    public readonly retryable = false,
    public readonly statusCode?: number,
  ) {
    super(`Alpaca market-data transport failed: ${safeCode}.`);
    this.name = "AlpacaTransportError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
      safeCode: this.safeCode,
      retryable: this.retryable,
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
    });
  }
}

export interface AlpacaHttpsExecutorResponse {
  readonly statusCode: number;
  readonly body: string;
}

export interface AlpacaHttpsRequestExecutor {
  execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<AlpacaHttpsExecutorResponse>;
}

export interface AlpacaHttpsTransportOptions {
  readonly executor?: AlpacaHttpsRequestExecutor;
  readonly clock?: { now(): string };
}

export class AlpacaHttpsTransport implements AlpacaHttpTransport {
  readonly #executor: AlpacaHttpsRequestExecutor;
  readonly #clock: { now(): string };

  public constructor(options: AlpacaHttpsTransportOptions = {}) {
    this.#executor = options.executor ?? new PlatformFetchRequestExecutor();
    this.#clock = options.clock ?? { now: () => new Date().toISOString() };
  }

  public assertReady(request: Readonly<AlpacaPersonalHttpRequest>): void {
    validateRequest(request);
  }

  public async execute(
    request: Readonly<AlpacaPersonalHttpRequest>,
    credentials: Readonly<AlpacaCredentials>,
    options: Readonly<AlpacaTransportExecutionOptions> = {},
  ): Promise<AlpacaHttpResponse> {
    validateRequest(request);
    if (options.signal?.aborted === true) throw new AlpacaTransportError(AlpacaTransportErrorCode.Cancelled);
    const target = new URL(request.endpoint);
    for (const [key, value] of request.query) target.searchParams.append(key, value);
    const secret = credentials.revealForTransport();
    const headers = Object.freeze({
      accept: "application/json",
      "APCA-API-KEY-ID": secret.keyId,
      "APCA-API-SECRET-KEY": secret.secretKey,
    });
    let response: AlpacaHttpsExecutorResponse;
    try {
      response = await this.#executor.execute(target, headers, request.timeoutMs, request.maxResponseBytes, options.signal);
    } catch (error) {
      if (error instanceof AlpacaTransportError) throw error;
      throw new AlpacaTransportError(AlpacaTransportErrorCode.NetworkFailure);
    }
    if (new TextEncoder().encode(response.body).byteLength > request.maxResponseBytes) {
      throw new AlpacaTransportError(AlpacaTransportErrorCode.ResponseTooLarge);
    }
    if (!Number.isSafeInteger(response.statusCode) || response.statusCode < 100 || response.statusCode > 599) {
      throw new AlpacaTransportError(AlpacaTransportErrorCode.NetworkFailure);
    }
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new AlpacaTransportError(AlpacaTransportErrorCode.HttpFailure, false, response.statusCode);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      throw new AlpacaTransportError(AlpacaTransportErrorCode.MalformedResponse);
    }
    if (isRecord(parsed) && ("code" in parsed || "message" in parsed)) {
      throw new AlpacaTransportError(AlpacaTransportErrorCode.ProviderError);
    }
    return deepFreeze({
      statusCode: response.statusCode,
      receivedAt: requireTimestamp(this.#clock.now()),
      body: response.body,
    });
  }
}

class PlatformFetchRequestExecutor implements AlpacaHttpsRequestExecutor {
  public execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<AlpacaHttpsExecutorResponse> {
    return executeWithPlatformFetch(target, headers, timeoutMs, maxResponseBytes, signal);
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
  headers: Readonly<Record<string, string>>,
  timeoutMs: number,
  maxResponseBytes: number,
  signal?: AbortSignal,
): Promise<AlpacaHttpsExecutorResponse> {
  const fetchFunction = (globalThis as unknown as { readonly fetch?: FetchFunction }).fetch;
  if (fetchFunction === undefined) throw new AlpacaTransportError(AlpacaTransportErrorCode.NetworkFailure);
  const controller = new AbortController();
  const onAbort = (): void => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFunction(target.toString(), {
      method: "GET",
      headers,
      redirect: "error",
      signal: controller.signal,
    });
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > maxResponseBytes) {
      throw new AlpacaTransportError(AlpacaTransportErrorCode.ResponseTooLarge);
    }
    return { statusCode: response.status, body };
  } catch (error) {
    if (error instanceof AlpacaTransportError) throw error;
    throw new AlpacaTransportError(
      signal?.aborted === true
        ? AlpacaTransportErrorCode.Cancelled
        : controller.signal.aborted ? AlpacaTransportErrorCode.Timeout : AlpacaTransportErrorCode.NetworkFailure,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

function validateRequest(request: Readonly<AlpacaPersonalHttpRequest>): void {
  let endpoint: URL;
  try {
    endpoint = new URL(request.endpoint);
  } catch {
    throw new AlpacaTransportError(AlpacaTransportErrorCode.InvalidRequest);
  }
  if (![BARS_ENDPOINT, QUOTES_ENDPOINT].includes(request.endpoint)
    || endpoint.protocol !== "https:" || endpoint.hostname !== APPROVED_HOSTNAME
    || endpoint.port !== "" || endpoint.username !== "" || endpoint.password !== "") {
    throw new AlpacaTransportError(AlpacaTransportErrorCode.UnapprovedHost);
  }
  if (request.method !== "GET" || request.timeoutMs !== MAX_TIMEOUT_MS
    || request.maxResponseBytes !== MAX_RESPONSE_BYTES
    || new Set(request.query.map(([key]) => key)).size !== request.query.length
    || request.query.some(([key, value]) => key.trim() === "" || value.trim() === "")) {
    throw new AlpacaTransportError(AlpacaTransportErrorCode.InvalidRequest);
  }
  const query = new Map(request.query);
  if (query.get("symbols") !== ALPACA_PERSONAL_EXACT_SYMBOLS.join(",")
    || query.get("feed") !== "iex" || query.get("currency") !== "USD") {
    throw new AlpacaTransportError(AlpacaTransportErrorCode.InvalidRequest);
  }
  if (request.kind === AlpacaPersonalRequestKind.LatestQuotes) {
    if (request.endpoint !== QUOTES_ENDPOINT || !exactKeys(query, ["symbols", "feed", "currency"])) {
      throw new AlpacaTransportError(AlpacaTransportErrorCode.InvalidRequest);
    }
    return;
  }
  if (request.kind !== AlpacaPersonalRequestKind.Bars
    || request.endpoint !== BARS_ENDPOINT
    || !exactKeys(query, ["symbols", "timeframe", "start", "end", "limit", "adjustment", "feed", "currency", "sort"])
    || !["1Day", "1Hour", "15Min", "5Min"].includes(query.get("timeframe") ?? "")
    || query.get("adjustment") !== "raw" || query.get("sort") !== "asc"
    || !canonicalTimestamp(query.get("start")) || !canonicalTimestamp(query.get("end"))
    || Date.parse(query.get("start")!) >= Date.parse(query.get("end")!)
    || !boundedInteger(query.get("limit"), 2, 1_000)) {
    throw new AlpacaTransportError(AlpacaTransportErrorCode.InvalidRequest);
  }
}

function exactKeys(query: ReadonlyMap<string, string>, expected: readonly string[]): boolean {
  return query.size === expected.length && expected.every((key) => query.has(key));
}

function canonicalTimestamp(value: string | undefined): boolean {
  if (value === undefined) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number): boolean {
  return value !== undefined && /^\d+$/u.test(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function requireTimestamp(value: string): string {
  if (!canonicalTimestamp(value)) throw new AlpacaTransportError(AlpacaTransportErrorCode.NetworkFailure);
  return value;
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

export const ALPACA_HTTPS_TRANSPORT_DEFAULTS = Object.freeze({
  barsEndpoint: BARS_ENDPOINT,
  quotesEndpoint: QUOTES_ENDPOINT,
  hostname: APPROVED_HOSTNAME,
  timeoutMs: MAX_TIMEOUT_MS,
  maxResponseBytes: MAX_RESPONSE_BYTES,
});
