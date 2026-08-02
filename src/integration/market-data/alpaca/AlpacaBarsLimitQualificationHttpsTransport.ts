import type { LiveReadonlyRequestPlanEntry } from "../../../contracts/PersonalDailyScanLiveReadonly";
import type {
  AlpacaBarsLimitQualificationRawResponse,
} from "../../../contracts/AlpacaBarsLimitQualification";
import type { AlpacaCredentials } from "./AlpacaPersonalMarketDataContracts";
import { loadAlpacaCredentials } from "./AlpacaCredentials";
import {
  AlpacaBarsLimitQualificationTransportError,
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

/**
 * Raw product Transport. It owns credential loading and returns only bounded
 * protocol data. It never parses market data or constructs Alpha evidence.
 */
export class AlpacaBarsLimitQualificationHttpsTransport implements AlpacaBarsLimitQualificationRawTransport {
  readonly #fetch: QualificationFetch;
  readonly #credentialLoader: () => AlpacaCredentials;
  readonly #clock: { now(): string };
  #preparedCredentials: AlpacaCredentials | undefined;

  public constructor(options: AlpacaBarsLimitQualificationHttpsTransportOptions = {}) {
    const platformFetch = (globalThis as unknown as { readonly fetch?: QualificationFetch }).fetch;
    this.#fetch = options.fetchFunction ?? platformFetch ?? unavailableFetch;
    this.#credentialLoader = options.credentialLoader ?? (() => loadAlpacaCredentials());
    this.#clock = options.clock ?? { now: () => new Date().toISOString() };
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
