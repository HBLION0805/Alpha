import type { CanonicalInstrument } from "../../../contracts/CanonicalInstrument";
import type { BarInterval, CanonicalBar } from "../../../contracts/CanonicalBar";
import type { CanonicalQuote } from "../../../contracts/CanonicalQuote";

export const ALPACA_PERSONAL_MARKET_DATA_SCHEMA_VERSION = "1.0" as const;
export const ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID = "provider:alpaca-basic-iex" as const;
export const ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE = "ALPHA_ALPACA_API_KEY_ID" as const;
export const ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE = "ALPHA_ALPACA_API_SECRET_KEY" as const;

export enum AlpacaPersonalRequestKind {
  Bars = "BARS",
  LatestQuotes = "LATEST_QUOTES",
}

export enum AlpacaPersonalResponseStatus {
  Valid = "VALID",
  Rejected = "REJECTED",
}

export enum AlpacaPersonalIssueCode {
  InvalidInput = "INVALID_INPUT",
  UndeclaredField = "UNDECLARED_FIELD",
  SymbolSetMismatch = "SYMBOL_SET_MISMATCH",
  InvalidWindow = "INVALID_WINDOW",
  InvalidRequest = "INVALID_REQUEST",
  MalformedJson = "MALFORMED_JSON",
  ProviderError = "PROVIDER_ERROR",
  UnexpectedSymbol = "UNEXPECTED_SYMBOL",
  MissingSymbol = "MISSING_SYMBOL",
  InvalidQuote = "INVALID_QUOTE",
  InvalidBar = "INVALID_BAR",
  PaginationForbidden = "PAGINATION_FORBIDDEN",
}

export interface AlpacaPersonalIssue {
  readonly code: AlpacaPersonalIssueCode;
  readonly field: string;
  readonly message: string;
}

export interface AlpacaPersonalTimeframeWindow {
  readonly interval: BarInterval;
  readonly startTime: string;
  readonly endTime: string;
  readonly maxRecords: number;
}

export interface AlpacaPersonalDryRunInput {
  readonly planId: string;
  readonly symbols: readonly string[];
  readonly windows: readonly AlpacaPersonalTimeframeWindow[];
  readonly plannedAt: string;
}

export interface AlpacaPersonalHttpRequest {
  readonly requestId: string;
  readonly kind: AlpacaPersonalRequestKind;
  readonly method: "GET";
  readonly endpoint:
    | "https://data.alpaca.markets/v2/stocks/bars"
    | "https://data.alpaca.markets/v2/stocks/quotes/latest";
  readonly query: readonly (readonly [string, string])[];
  readonly timeoutMs: 10_000;
  readonly maxResponseBytes: 1_000_000;
}

export interface AlpacaPersonalDryRunPlan {
  readonly schemaVersion: typeof ALPACA_PERSONAL_MARKET_DATA_SCHEMA_VERSION;
  readonly planId: string;
  readonly providerId: typeof ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID;
  readonly feed: "iex";
  readonly coverage: "SINGLE_VENUE";
  readonly symbols: readonly string[];
  readonly requests: readonly AlpacaPersonalHttpRequest[];
  readonly requestBudget: 5;
  readonly networkRequests: 0;
  readonly persistenceWrites: 0;
  readonly automaticRetryAllowed: false;
  readonly paginationAllowed: false;
  readonly pollingAllowed: false;
  readonly streamingAllowed: false;
  readonly tradingApiAllowed: false;
  readonly automatedExecutionAllowed: false;
  readonly warnings: readonly string[];
}

export interface AlpacaPersonalValidatedQuote {
  readonly symbol: string;
  readonly timestamp: string;
  readonly askPrice: string;
  readonly askSizeRoundLots: string;
  readonly bidPrice: string;
  readonly bidSizeRoundLots: string;
  readonly askExchange: string;
  readonly bidExchange: string;
  readonly tape: string;
  readonly conditions: readonly string[];
}

export interface AlpacaPersonalValidatedBar {
  readonly symbol: string;
  readonly timestamp: string;
  readonly open: string;
  readonly high: string;
  readonly low: string;
  readonly close: string;
  readonly volume: string;
  readonly tradeCount: string;
  readonly vwap: string;
}

export interface AlpacaPersonalValidatedResponse {
  readonly status: AlpacaPersonalResponseStatus;
  readonly kind: AlpacaPersonalRequestKind;
  readonly quotes: readonly AlpacaPersonalValidatedQuote[];
  readonly bars: readonly AlpacaPersonalValidatedBar[];
  readonly blockers: readonly AlpacaPersonalIssue[];
  readonly coverage: "SINGLE_VENUE";
  readonly feed: "iex";
}

export interface AlpacaPersonalInstrumentMapping {
  readonly symbol: string;
  readonly canonicalInstrument: CanonicalInstrument;
}

export interface AlpacaPersonalNormalizationPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly closureBufferSeconds: number;
  readonly quoteMaxAgeSeconds: number;
  readonly barMaxAgeSeconds: Readonly<Record<BarInterval, number>>;
  readonly roundLotSize: 100;
}

export interface AlpacaPersonalDailyBarBoundary {
  readonly symbol: string;
  readonly intervalStart: string;
  readonly intervalEnd: string;
  readonly sessionDate: string;
}

export interface AlpacaPersonalQuoteNormalizationContext {
  readonly response: AlpacaPersonalValidatedResponse;
  readonly mappings: readonly AlpacaPersonalInstrumentMapping[];
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly evaluatedAt: string;
  readonly requestId: string;
  readonly policy: AlpacaPersonalNormalizationPolicy;
}

export interface AlpacaPersonalBarNormalizationContext {
  readonly response: AlpacaPersonalValidatedResponse;
  readonly mappings: readonly AlpacaPersonalInstrumentMapping[];
  readonly interval: BarInterval;
  readonly requestStartTime: string;
  readonly requestEndTime: string;
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly evaluatedAt: string;
  readonly requestId: string;
  readonly policy: AlpacaPersonalNormalizationPolicy;
  readonly dailyBoundaries: readonly AlpacaPersonalDailyBarBoundary[];
}

export interface AlpacaPersonalNormalizationResult {
  readonly status: "NORMALIZED" | "REJECTED";
  readonly providerId: typeof ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID;
  readonly quotes: readonly CanonicalQuote[];
  readonly bars: readonly CanonicalBar[];
  readonly blockers: readonly AlpacaPersonalIssue[];
  readonly warnings: readonly string[];
}

export interface AlpacaCredentialDiagnostic {
  readonly environmentVariables: readonly [
    typeof ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
    typeof ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
  ];
  readonly configured: true;
  readonly values: readonly ["[REDACTED]", "[REDACTED]"];
}

export interface AlpacaCredentials {
  revealForTransport(): Readonly<{ readonly keyId: string; readonly secretKey: string }>;
  toRedactedDiagnostic(): AlpacaCredentialDiagnostic;
  toJSON(): AlpacaCredentialDiagnostic;
  toString(): string;
}

export interface AlpacaTransportExecutionOptions {
  readonly signal?: AbortSignal;
}

export interface AlpacaHttpResponse {
  readonly statusCode: number;
  readonly receivedAt: string;
  readonly body: string;
}

export interface AlpacaHttpTransport {
  assertReady(request: Readonly<AlpacaPersonalHttpRequest>): void;
  execute(
    request: Readonly<AlpacaPersonalHttpRequest>,
    credentials: Readonly<AlpacaCredentials>,
    options?: Readonly<AlpacaTransportExecutionOptions>,
  ): Promise<AlpacaHttpResponse>;
}
