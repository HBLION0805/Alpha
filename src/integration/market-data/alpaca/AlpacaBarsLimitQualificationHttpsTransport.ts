import type { LiveReadonlyRequestPlanEntry } from "../../../contracts/PersonalDailyScanLiveReadonly";
import type {
  AlpacaBarsLimitQualificationRawResponse,
} from "../../../contracts/AlpacaBarsLimitQualification";
import { AlpacaBarsLimitQualificationTransportError } from "../../../contracts/AlpacaBarsLimitQualification";
import type { AlpacaCredentials } from "./AlpacaPersonalMarketDataContracts";
import { loadAlpacaCredentials } from "./AlpacaCredentials";
import {
  assertAlpacaBarsLimitQualificationDispatchPermit,
  type AlpacaBarsLimitQualificationRawTransport,
} from "../../../engines/personal-daily-scan/AlpacaBarsLimitQualification";

const ENDPOINT = "https://data.alpaca.markets/v2/stocks/bars";
const QUERY_ORDER = Object.freeze(["symbols", "timeframe", "start", "end", "limit", "adjustment", "feed", "currency", "sort"] as const);

interface QualificationFetchHeaders {
  get(name: string): string | null;
}

interface QualificationFetchReader {
  read(): Promise<Readonly<{ readonly done: boolean; readonly value?: Uint8Array }>>;
  cancel(): Promise<void>;
}

interface QualificationFetchResponse {
  readonly status: number;
  readonly headers: QualificationFetchHeaders;
  readonly body: { getReader(): QualificationFetchReader } | null;
}

type QualificationFetch = (target: string, init: Readonly<{
  readonly method: "GET";
  readonly headers: Readonly<Record<string, string>>;
  readonly redirect: "error";
  readonly signal: AbortSignal;
}>) => Promise<QualificationFetchResponse>;

export interface AlpacaBarsLimitQualificationHttpsTransportOptions {
  readonly fetchFunction?: QualificationFetch;
  readonly credentialLoader?: () => AlpacaCredentials;
  readonly clock?: { now(): string };
}

export interface AlpacaBarsLimitQualificationTransportLifecycle {
  readonly attemptedNetworkRequests: 0 | 1;
  readonly completedNetworkRequests: 0 | 1;
  readonly networkRequests: 0 | 1;
}

interface MutableTransportLifecycle {
  attemptedNetworkRequests: 0 | 1;
  completedNetworkRequests: 0 | 1;
  networkRequests: 0 | 1;
}

const PRODUCT_TRANSPORTS = new WeakSet<object>();
const TRANSPORT_LIFECYCLES = new WeakMap<object, MutableTransportLifecycle>();
const ZERO_LIFECYCLE: AlpacaBarsLimitQualificationTransportLifecycle = Object.freeze({
  attemptedNetworkRequests: 0,
  completedNetworkRequests: 0,
  networkRequests: 0,
});

/**
 * Raw product Transport. It owns credential loading and returns only bounded
 * protocol data. It never parses market data or constructs Alpha evidence.
 */
export class AlpacaBarsLimitQualificationHttpsTransport implements AlpacaBarsLimitQualificationRawTransport {
  readonly #fetch: QualificationFetch;
  readonly #credentialLoader: () => AlpacaCredentials;
  readonly #clock: { now(): string };
  #preparedCredentials: AlpacaCredentials | undefined;

  public constructor(options?: AlpacaBarsLimitQualificationHttpsTransportOptions) {
    const resolvedOptions = options ?? {};
    const platformFetch = (globalThis as unknown as { readonly fetch?: QualificationFetch }).fetch;
    this.#fetch = resolvedOptions.fetchFunction ?? platformFetch ?? unavailableFetch;
    this.#credentialLoader = resolvedOptions.credentialLoader ?? (() => loadAlpacaCredentials());
    this.#clock = resolvedOptions.clock ?? { now: () => new Date().toISOString() };
    TRANSPORT_LIFECYCLES.set(this, { attemptedNetworkRequests: 0, completedNetworkRequests: 0, networkRequests: 0 });
    if (options === undefined) PRODUCT_TRANSPORTS.add(this);
  }

  public prepareCredentialsAfterAuthorization(): void {
    try {
      this.#preparedCredentials = this.#credentialLoader();
    } catch {
      throw new AlpacaBarsLimitQualificationTransportError("CREDENTIAL_UNAVAILABLE");
    }
  }

  public async dispatchOnce(
    request: LiveReadonlyRequestPlanEntry,
    permit: unknown,
  ): Promise<AlpacaBarsLimitQualificationRawResponse> {
    assertAlpacaBarsLimitQualificationDispatchPermit(permit);
    const target = exactTarget(request);
    const credentials = this.#preparedCredentials?.revealForTransport();
    this.#preparedCredentials = undefined;
    if (credentials === undefined) throw new AlpacaBarsLimitQualificationTransportError("CREDENTIAL_UNAVAILABLE");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    const startedAt = requireTimestamp(this.#clock.now());
    try {
      markDispatchStarted(this);
      const response = await this.#fetch(target, {
        method: "GET",
        headers: Object.freeze({
          accept: "application/json",
          "APCA-API-KEY-ID": credentials.keyId,
          "APCA-API-SECRET-KEY": credentials.secretKey,
        }),
        redirect: "error",
        signal: controller.signal,
      });
      const rawBytes = await readBounded(response.body, request.maximumResponseBytes);
      return Object.freeze({
        statusCode: response.status,
        headers: allowListedHeaders(response.headers),
        rawBytes,
        startedAt,
        endedAt: requireTimestamp(this.#clock.now()),
      });
    } catch (error) {
      if (error instanceof AlpacaBarsLimitQualificationTransportError) throw error;
      throw new AlpacaBarsLimitQualificationTransportError(controller.signal.aborted ? "TIMEOUT" : "TRANSPORT_FAILURE");
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Only a default-constructed Transport owned by the product composition root
 * receives the real-HTTPS capability. Any injected constructor option makes
 * the instance test-only, even when it exercises the same request builder.
 */
export function isAlpacaBarsLimitQualificationProductTransport(value: unknown): boolean {
  return typeof value === "object" && value !== null && PRODUCT_TRANSPORTS.has(value);
}

export function readAlpacaBarsLimitQualificationProductTransportLifecycle(
  value: unknown,
): AlpacaBarsLimitQualificationTransportLifecycle {
  if (!isAlpacaBarsLimitQualificationProductTransport(value)) return ZERO_LIFECYCLE;
  return lifecycleSnapshot(value as object);
}

export function markAlpacaBarsLimitQualificationProductResponseAccepted(value: unknown): void {
  if (!isAlpacaBarsLimitQualificationProductTransport(value)) return;
  const lifecycle = TRANSPORT_LIFECYCLES.get(value as object);
  if (lifecycle?.attemptedNetworkRequests === 1) lifecycle.completedNetworkRequests = 1;
}

function markDispatchStarted(value: object): void {
  const lifecycle = TRANSPORT_LIFECYCLES.get(value);
  if (lifecycle === undefined || lifecycle.attemptedNetworkRequests === 1) {
    throw new AlpacaBarsLimitQualificationTransportError("TRANSPORT_FAILURE");
  }
  lifecycle.attemptedNetworkRequests = 1;
  lifecycle.networkRequests = 1;
}

function lifecycleSnapshot(value: object): AlpacaBarsLimitQualificationTransportLifecycle {
  const lifecycle = TRANSPORT_LIFECYCLES.get(value);
  if (lifecycle === undefined) return ZERO_LIFECYCLE;
  return Object.freeze({
    attemptedNetworkRequests: lifecycle.attemptedNetworkRequests,
    completedNetworkRequests: lifecycle.completedNetworkRequests,
    networkRequests: lifecycle.networkRequests,
  });
}

function exactTarget(request: LiveReadonlyRequestPlanEntry): string {
  if (request.ordinal !== 1 || request.method !== "GET" || request.host !== "data.alpaca.markets" ||
      request.path !== "/v2/stocks/bars" || request.capability !== "BARS" || request.interval !== "P1D" ||
      JSON.stringify(request.symbols) !== JSON.stringify(["MU", "QQQ"]) || request.limit !== 2 ||
      request.feed !== "iex" || request.adjustment !== "raw" || request.sort !== "asc" ||
      request.currency !== "USD" || request.start === null || request.end === null) {
    throw new AlpacaBarsLimitQualificationTransportError("TRANSPORT_FAILURE");
  }
  const values = Object.freeze({
    symbols: request.symbols.join(","),
    timeframe: "1Day",
    start: request.start,
    end: request.end,
    limit: String(request.limit),
    adjustment: request.adjustment,
    feed: request.feed,
    currency: request.currency,
    sort: request.sort,
  });
  const target = new URL(ENDPOINT);
  for (const name of QUERY_ORDER) target.searchParams.append(name, values[name]);
  return target.toString();
}

async function readBounded(
  body: QualificationFetchResponse["body"],
  maximumResponseBytes: number,
): Promise<Uint8Array> {
  if (body === null) throw new AlpacaBarsLimitQualificationTransportError("TRANSPORT_FAILURE");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (!(chunk.value instanceof Uint8Array)) throw new AlpacaBarsLimitQualificationTransportError("TRANSPORT_FAILURE");
    size += chunk.value.byteLength;
    if (size > maximumResponseBytes) {
      await reader.cancel();
      throw new AlpacaBarsLimitQualificationTransportError("RESPONSE_TOO_LARGE");
    }
    chunks.push(chunk.value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

function allowListedHeaders(headers: QualificationFetchHeaders): AlpacaBarsLimitQualificationRawResponse["headers"] {
  const output: Array<{ readonly name: "content-type" | "content-length" | "x-request-id"; readonly value: string }> = [];
  for (const name of ["content-type", "content-length", "x-request-id"] as const) {
    const value = headers.get(name);
    if (value !== null) output.push(Object.freeze({ name, value: value.slice(0, 512) }));
  }
  return Object.freeze(output);
}

function requireTimestamp(value: string): string {
  if (!Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) {
    throw new AlpacaBarsLimitQualificationTransportError("TRANSPORT_FAILURE");
  }
  return value;
}

function unavailableFetch(): Promise<never> {
  return Promise.reject(new AlpacaBarsLimitQualificationTransportError("TRANSPORT_FAILURE"));
}
