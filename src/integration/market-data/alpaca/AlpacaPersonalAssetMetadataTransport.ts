import type { AlpacaCredentials } from "./AlpacaPersonalMarketDataContracts";
import {
  ALPACA_PERSONAL_ASSET_METADATA_PROVIDER_ID,
  ALPACA_PERSONAL_MULS_ASSET_ENDPOINT,
  type AlpacaPersonalAssetMetadataRequest,
  type AlpacaPersonalAssetMetadataResponse,
  type AlpacaPersonalAssetMetadataTransport,
} from "./AlpacaPersonalAssetMetadataDiagnostic";

const APPROVED_HOSTNAME = "paper-api.alpaca.markets";
const TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 65_536;

export enum AlpacaPersonalAssetMetadataTransportErrorCode {
  InvalidRequest = "INVALID_REQUEST",
  UnapprovedHost = "UNAPPROVED_HOST",
  Cancelled = "CANCELLED",
  Timeout = "TIMEOUT",
  NetworkFailure = "NETWORK_FAILURE",
  HttpFailure = "HTTP_FAILURE",
  ResponseTooLarge = "RESPONSE_TOO_LARGE",
  InvalidClock = "INVALID_CLOCK",
}

export class AlpacaPersonalAssetMetadataTransportError extends Error {
  public constructor(
    public readonly safeCode: AlpacaPersonalAssetMetadataTransportErrorCode,
    public readonly statusCode?: number,
  ) {
    super(`Alpaca asset-metadata transport failed: ${safeCode}.`);
    this.name = "AlpacaPersonalAssetMetadataTransportError";
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      providerId: ALPACA_PERSONAL_ASSET_METADATA_PROVIDER_ID,
      safeCode: this.safeCode,
      ...(this.statusCode === undefined ? {} : { statusCode: this.statusCode }),
    });
  }
}

export interface AlpacaPersonalAssetMetadataExecutorResponse {
  readonly statusCode: number;
  readonly body: string;
}

export interface AlpacaPersonalAssetMetadataRequestExecutor {
  execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<AlpacaPersonalAssetMetadataExecutorResponse>;
}

export interface AlpacaPersonalAssetMetadataHttpsTransportOptions {
  readonly executor?: AlpacaPersonalAssetMetadataRequestExecutor;
  readonly clock?: { now(): string };
}

export class AlpacaPersonalAssetMetadataHttpsTransport implements AlpacaPersonalAssetMetadataTransport {
  readonly #executor: AlpacaPersonalAssetMetadataRequestExecutor;
  readonly #clock: { now(): string };

  public constructor(options: AlpacaPersonalAssetMetadataHttpsTransportOptions = {}) {
    this.#executor = options.executor ?? new PlatformFetchExecutor();
    this.#clock = options.clock ?? { now: () => new Date().toISOString() };
  }

  public assertReady(request: Readonly<AlpacaPersonalAssetMetadataRequest>): void {
    validateRequest(request);
  }

  public async execute(
    request: Readonly<AlpacaPersonalAssetMetadataRequest>,
    credentials: Readonly<AlpacaCredentials>,
    signal?: AbortSignal,
  ): Promise<AlpacaPersonalAssetMetadataResponse> {
    validateRequest(request);
    if (signal?.aborted === true) {
      throw new AlpacaPersonalAssetMetadataTransportError(
        AlpacaPersonalAssetMetadataTransportErrorCode.Cancelled,
      );
    }
    const secret = credentials.revealForTransport();
    const headers = Object.freeze({
      accept: "application/json",
      "APCA-API-KEY-ID": secret.keyId,
      "APCA-API-SECRET-KEY": secret.secretKey,
    });
    let response: AlpacaPersonalAssetMetadataExecutorResponse;
    try {
      response = await this.#executor.execute(
        new URL(request.endpoint), headers, request.timeoutMs, request.maxResponseBytes, signal,
      );
    } catch (error) {
      if (error instanceof AlpacaPersonalAssetMetadataTransportError) throw error;
      throw new AlpacaPersonalAssetMetadataTransportError(
        AlpacaPersonalAssetMetadataTransportErrorCode.NetworkFailure,
      );
    }
    if (new TextEncoder().encode(response.body).byteLength > request.maxResponseBytes) {
      throw new AlpacaPersonalAssetMetadataTransportError(
        AlpacaPersonalAssetMetadataTransportErrorCode.ResponseTooLarge,
      );
    }
    if (!Number.isSafeInteger(response.statusCode) || response.statusCode < 100 || response.statusCode > 599) {
      throw new AlpacaPersonalAssetMetadataTransportError(
        AlpacaPersonalAssetMetadataTransportErrorCode.NetworkFailure,
      );
    }
    if (response.statusCode < 200 || response.statusCode > 299) {
      throw new AlpacaPersonalAssetMetadataTransportError(
        AlpacaPersonalAssetMetadataTransportErrorCode.HttpFailure,
        response.statusCode,
      );
    }
    const receivedAt = this.#clock.now();
    if (!isCanonicalTimestamp(receivedAt)) {
      throw new AlpacaPersonalAssetMetadataTransportError(
        AlpacaPersonalAssetMetadataTransportErrorCode.InvalidClock,
      );
    }
    return deepFreeze({ statusCode: response.statusCode, receivedAt, body: response.body });
  }
}

class PlatformFetchExecutor implements AlpacaPersonalAssetMetadataRequestExecutor {
  public async execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
    signal?: AbortSignal,
  ): Promise<AlpacaPersonalAssetMetadataExecutorResponse> {
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
        throw new AlpacaPersonalAssetMetadataTransportError(
          AlpacaPersonalAssetMetadataTransportErrorCode.ResponseTooLarge,
        );
      }
      return { statusCode: response.status, body };
    } catch (error) {
      if (error instanceof AlpacaPersonalAssetMetadataTransportError) throw error;
      throw new AlpacaPersonalAssetMetadataTransportError(
        signal?.aborted === true
          ? AlpacaPersonalAssetMetadataTransportErrorCode.Cancelled
          : controller.signal.aborted
            ? AlpacaPersonalAssetMetadataTransportErrorCode.Timeout
            : AlpacaPersonalAssetMetadataTransportErrorCode.NetworkFailure,
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

function validateRequest(request: Readonly<AlpacaPersonalAssetMetadataRequest>): void {
  let target: URL;
  try {
    target = new URL(request.endpoint);
  } catch {
    throw new AlpacaPersonalAssetMetadataTransportError(
      AlpacaPersonalAssetMetadataTransportErrorCode.InvalidRequest,
    );
  }
  if (request.endpoint !== ALPACA_PERSONAL_MULS_ASSET_ENDPOINT
    || target.protocol !== "https:" || target.hostname !== APPROVED_HOSTNAME
    || target.port !== "" || target.username !== "" || target.password !== ""
    || target.search !== "" || target.hash !== "") {
    throw new AlpacaPersonalAssetMetadataTransportError(
      AlpacaPersonalAssetMetadataTransportErrorCode.UnapprovedHost,
    );
  }
  if (request.requestId !== "personal-alpaca:asset-metadata:MULS"
    || request.method !== "GET" || request.bodyAllowed !== false
    || request.timeoutMs !== TIMEOUT_MS || request.maxResponseBytes !== MAX_RESPONSE_BYTES
    || !Array.isArray(request.query) || request.query.length !== 0
    || Object.keys(request).sort().join("|") !== [
      "bodyAllowed", "endpoint", "maxResponseBytes", "method", "query", "requestId", "timeoutMs",
    ].sort().join("|")) {
    throw new AlpacaPersonalAssetMetadataTransportError(
      AlpacaPersonalAssetMetadataTransportErrorCode.InvalidRequest,
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
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
