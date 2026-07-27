import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
  AlpacaPersonalIssueCode,
  AlpacaPersonalRequestKind,
  AlpacaPersonalResponseStatus,
  type AlpacaCredentialDiagnostic,
  type AlpacaHttpTransport,
  type AlpacaPersonalIssue,
  type AlpacaPersonalDailyBarBoundary,
  type AlpacaPersonalDryRunInput,
  type AlpacaPersonalHttpRequest,
  type AlpacaPersonalNormalizationPolicy,
} from "./AlpacaPersonalMarketDataContracts";
import { loadAlpacaCredentials } from "./AlpacaCredentials";
import { AlpacaHttpsTransport } from "./AlpacaHttpsTransport";
import {
  createAlpacaPersonalInstrumentMappings,
  normalizeAlpacaPersonalBars,
  normalizeAlpacaPersonalQuotes,
} from "./AlpacaPersonalMarketDataNormalizer";
import { planAlpacaPersonalMarketDataDryRun } from "./AlpacaPersonalMarketDataPlanner";
import { validateAlpacaPersonalMarketDataResponse } from "./AlpacaPersonalMarketDataResponseValidator";

export const ALPACA_PERSONAL_LIVE_READ_CONFIRMATION_FLAG = "--confirm-alpaca-live-read" as const;

export enum AlpacaLiveReadSmokeErrorCode {
  InvalidApproval = "INVALID_APPROVAL",
  TransportFailed = "TRANSPORT_FAILED",
  ProviderValidationFailed = "PROVIDER_VALIDATION_FAILED",
  CanonicalNormalizationFailed = "CANONICAL_NORMALIZATION_FAILED",
  RequestBindingFailed = "REQUEST_BINDING_FAILED",
}
export interface AlpacaLiveReadFailureDiagnostic {
  readonly requestOrdinal: number;
  readonly requestKind: AlpacaPersonalRequestKind;
  readonly requestScope: "P1D" | "PT1H" | "PT15M" | "PT5M" | "LATEST_QUOTES";
  readonly issueCodes: readonly AlpacaPersonalIssueCode[];
  readonly missingSymbols: readonly string[];
  readonly unexpectedSymbols: readonly string[];
  readonly invalidSymbols: readonly string[];
}


export class AlpacaLiveReadSmokeError extends Error {
  public readonly diagnostic: AlpacaLiveReadFailureDiagnostic | undefined;

  public constructor(
    public readonly safeCode: AlpacaLiveReadSmokeErrorCode,
    public readonly completedNetworkRequests: number,
    public readonly attemptedNetworkRequests = completedNetworkRequests,
    diagnostic?: Readonly<AlpacaLiveReadFailureDiagnostic>,
  ) {
    super(`Alpaca one-shot live-read smoke failed: ${safeCode}.`);
    this.name = "AlpacaLiveReadSmokeError";
    this.diagnostic = diagnostic === undefined ? undefined : deepFreeze({
      ...diagnostic,
      issueCodes: [...diagnostic.issueCodes],
      missingSymbols: [...diagnostic.missingSymbols],
      unexpectedSymbols: [...diagnostic.unexpectedSymbols],
      invalidSymbols: [...diagnostic.invalidSymbols],
    });
  }

  public toJSON(): Readonly<Record<string, unknown>> {
    return deepFreeze({
      providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
      safeCode: this.safeCode,
      completedNetworkRequests: this.completedNetworkRequests,
      attemptedNetworkRequests: this.attemptedNetworkRequests,
      ...(this.diagnostic === undefined ? {} : { diagnostic: this.diagnostic }),
    });
  }
}

export interface AlpacaLiveReadSmokeInput {
  readonly confirmed: boolean;
  readonly plan: AlpacaPersonalDryRunInput;
  readonly policy: AlpacaPersonalNormalizationPolicy;
  readonly dailyBoundaries: readonly AlpacaPersonalDailyBarBoundary[];
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly transport?: AlpacaHttpTransport;
  readonly clock?: { now(): string };
}

export interface AlpacaLiveReadSmokeSummary {
  readonly notice: "LIVE READ ONLY — NO TRADING OR DECISION AUTHORIZATION";
  readonly mode: "DRY_RUN" | "LIVE_READ_SMOKE";
  readonly providerId: typeof ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID;
  readonly planId: string;
  readonly feed: "iex";
  readonly coverage: "SINGLE_VENUE";
  readonly symbolCount: 12;
  readonly requestBudget: 5;
  readonly responseByteBudgetPerRequest: 1_000_000;
  readonly credential: AlpacaCredentialDiagnostic;
  readonly transportReady: true;
  readonly networkRequests: number;
  readonly validatedResponses: number;
  readonly canonicalBarCount: number;
  readonly canonicalQuoteCount: number;
  readonly persistenceWrites: 0;
  readonly rawPayloadExposed: false;
  readonly recommendationAuthority: false;
  readonly tradingAuthority: false;
  readonly warnings: readonly string[];
  readonly elapsedMs: number;
}

export function parseAlpacaLiveReadSmokeArguments(
  args: readonly string[],
): { readonly confirmed: boolean } {
  const confirmations = args.filter((argument) => argument === ALPACA_PERSONAL_LIVE_READ_CONFIRMATION_FLAG);
  if (confirmations.length > 1
    || args.some((argument) => argument !== ALPACA_PERSONAL_LIVE_READ_CONFIRMATION_FLAG)) {
    throw new AlpacaLiveReadSmokeError(AlpacaLiveReadSmokeErrorCode.InvalidApproval, 0);
  }
  return Object.freeze({ confirmed: confirmations.length === 1 });
}

/**
 * Dry-run by default. A confirmed invocation performs exactly the five
 * plan-bound read-only requests, once each, without retry or persistence.
 */
export async function runAlpacaPersonalMarketDataLiveSmoke(
  input: Readonly<AlpacaLiveReadSmokeInput>,
): Promise<AlpacaLiveReadSmokeSummary> {
  const clock = input.clock ?? { now: () => new Date().toISOString() };
  const startedAt = Date.parse(requireTimestamp(clock.now()));
  const credentials = loadAlpacaCredentials(input.environment);
  const plan = planAlpacaPersonalMarketDataDryRun(input.plan);
  const readinessTransport = new AlpacaHttpsTransport({ clock });
  const plannedRequests = plan["requests"];
  for (const request of plannedRequests) readinessTransport.assertReady(request);

  const common = {
    notice: "LIVE READ ONLY — NO TRADING OR DECISION AUTHORIZATION" as const,
    providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
    planId: plan.planId,
    feed: "iex" as const,
    coverage: "SINGLE_VENUE" as const,
    symbolCount: 12 as const,
    requestBudget: 5 as const,
    responseByteBudgetPerRequest: 1_000_000 as const,
    credential: credentials.toRedactedDiagnostic(),
    transportReady: true as const,
    persistenceWrites: 0 as const,
    rawPayloadExposed: false as const,
    recommendationAuthority: false as const,
    tradingAuthority: false as const,
  };

  if (!input.confirmed) {
    return deepFreeze({
      ...common,
      mode: "DRY_RUN",
      networkRequests: 0,
      validatedResponses: 0,
      canonicalBarCount: 0,
      canonicalQuoteCount: 0,
      warnings: [
        "Owner confirmation is absent; no network request was made.",
        "IEX remains single-venue evidence and is not NBBO or consolidated volume.",
      ],
      elapsedMs: elapsed(startedAt, clock.now()),
    });
  }

  const transport = input.transport ?? readinessTransport;
  const mappings = createAlpacaPersonalInstrumentMappings();
  let completedNetworkRequests = 0;
  let validatedResponses = 0;
  let canonicalBarCount = 0;
  let canonicalQuoteCount = 0;
  for (const request of plannedRequests) {
    let response;
    try {
      response = await transport.execute(request, credentials);
    } catch {
      throw new AlpacaLiveReadSmokeError(
        AlpacaLiveReadSmokeErrorCode.TransportFailed,
        completedNetworkRequests,
        completedNetworkRequests + 1,
      );
    }
    completedNetworkRequests += 1;
    const validated = validateAlpacaPersonalMarketDataResponse(
      response.body,
      request.kind,
      plan.symbols,
    );
    if (validated.status !== AlpacaPersonalResponseStatus.Valid) {
      throw new AlpacaLiveReadSmokeError(
        AlpacaLiveReadSmokeErrorCode.ProviderValidationFailed,
        completedNetworkRequests,
        completedNetworkRequests,
        providerFailureDiagnostic(validated.blockers, request, completedNetworkRequests),
      );
    }
    validatedResponses += 1;
    const normalizedAt = requireTimestamp(clock.now());
    if (request.kind === AlpacaPersonalRequestKind.LatestQuotes) {
      const normalized = normalizeAlpacaPersonalQuotes({
        response: validated,
        mappings,
        receivedAt: response.receivedAt,
        normalizedAt,
        evaluatedAt: normalizedAt,
        requestId: request.requestId,
        policy: input.policy,
      });
      if (normalized.status !== "NORMALIZED") {
        throw new AlpacaLiveReadSmokeError(
          AlpacaLiveReadSmokeErrorCode.CanonicalNormalizationFailed,
          completedNetworkRequests,
        );
      }
      canonicalQuoteCount += normalized.quotes.length;
      continue;
    }
    const binding = requestBinding(request, input.plan);
    if (binding === undefined) {
      throw new AlpacaLiveReadSmokeError(
        AlpacaLiveReadSmokeErrorCode.RequestBindingFailed,
        completedNetworkRequests,
      );
    }
    const normalized = normalizeAlpacaPersonalBars({
      response: validated,
      mappings,
      interval: binding.interval,
      requestStartTime: binding.startTime,
      requestEndTime: binding.endTime,
      receivedAt: response.receivedAt,
      normalizedAt,
      evaluatedAt: normalizedAt,
      requestId: request.requestId,
      policy: input.policy,
      dailyBoundaries: input.dailyBoundaries,
    });
    if (normalized.status !== "NORMALIZED") {
      throw new AlpacaLiveReadSmokeError(
        AlpacaLiveReadSmokeErrorCode.CanonicalNormalizationFailed,
        completedNetworkRequests,
      );
    }
    canonicalBarCount += normalized.bars.length;
  }

  if (completedNetworkRequests !== 5 || validatedResponses !== 5) {
    throw new AlpacaLiveReadSmokeError(
      AlpacaLiveReadSmokeErrorCode.RequestBindingFailed,
      completedNetworkRequests,
    );
  }
  return deepFreeze({
    ...common,
    mode: "LIVE_READ_SMOKE",
    networkRequests: completedNetworkRequests,
    validatedResponses,
    canonicalBarCount,
    canonicalQuoteCount,
    warnings: [
      "IEX Quotes are single-venue observations and are not NBBO.",
      "IEX volume is single-venue share volume and is not consolidated US market volume.",
      "Results were not persisted and cannot authorize a recommendation or trade.",
    ],
    elapsedMs: elapsed(startedAt, clock.now()),
  });
}

function providerFailureDiagnostic(
  blockers: readonly AlpacaPersonalIssue[],
  request: Readonly<AlpacaPersonalHttpRequest>,
  requestOrdinal: number,
): AlpacaLiveReadFailureDiagnostic {
  const symbolsFor = (code: AlpacaPersonalIssueCode): readonly string[] => boundedSymbols(
    blockers.filter((blocker) => blocker.code === code).map((blocker) => blocker.field),
  );
  const invalidSymbols = boundedSymbols(blockers
    .filter((blocker) => blocker.code === AlpacaPersonalIssueCode.InvalidBar
      || blocker.code === AlpacaPersonalIssueCode.InvalidQuote)
    .map((blocker) => /^(?:bars|quotes)\.([A-Z][A-Z0-9.]{0,14})/u.exec(blocker.field)?.[1] ?? ""));
  return deepFreeze({
    requestOrdinal,
    requestKind: request.kind,
    requestScope: requestScope(request),
    issueCodes: [...new Set(blockers.map((blocker) => blocker.code))].sort(),
    missingSymbols: symbolsFor(AlpacaPersonalIssueCode.MissingSymbol),
    unexpectedSymbols: symbolsFor(AlpacaPersonalIssueCode.UnexpectedSymbol),
    invalidSymbols,
  });
}

function boundedSymbols(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => /^[A-Z][A-Z0-9.]{0,14}$/u.test(value)))]
    .sort()
    .slice(0, 24);
}

function requestScope(
  request: Readonly<AlpacaPersonalHttpRequest>,
): AlpacaLiveReadFailureDiagnostic["requestScope"] {
  if (request.kind === AlpacaPersonalRequestKind.LatestQuotes) return "LATEST_QUOTES";
  const timeframe = new Map(request.query).get("timeframe");
  if (timeframe === "1Day") return "P1D";
  if (timeframe === "1Hour") return "PT1H";
  if (timeframe === "15Min") return "PT15M";
  return "PT5M";
}

function requestBinding(
  request: Readonly<AlpacaPersonalHttpRequest>,
  input: Readonly<AlpacaPersonalDryRunInput>,
): Readonly<{ interval: BarInterval; startTime: string; endTime: string }> | undefined {
  const timeframe = new Map(request.query).get("timeframe");
  const interval = timeframe === "1Day" ? BarInterval.OneDay
    : timeframe === "1Hour" ? BarInterval.OneHour
    : timeframe === "15Min" ? BarInterval.FifteenMinutes
    : timeframe === "5Min" ? BarInterval.FiveMinutes
    : undefined;
  if (interval === undefined) return undefined;
  const window = input.windows.find((entry) => entry.interval === interval);
  return window === undefined ? undefined : {
    interval,
    startTime: window.startTime,
    endTime: window.endTime,
  };
}

function requireTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new AlpacaLiveReadSmokeError(AlpacaLiveReadSmokeErrorCode.RequestBindingFailed, 0);
  }
  return value;
}

function elapsed(startedAt: number, finishedAt: string): number {
  return Math.max(0, Date.parse(requireTimestamp(finishedAt)) - startedAt);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
