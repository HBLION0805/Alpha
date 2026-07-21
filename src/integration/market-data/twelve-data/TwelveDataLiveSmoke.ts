import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  MARKET_DATA_SCHEMA_VERSION,
  MarketDataBarMode,
  MarketDataCapability,
  MarketDataOperation,
  type MarketDataBarRequest,
} from "../../../contracts/MarketData";
import {
  MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
  MarketDataProviderNamePolicy,
} from "../../../contracts/MarketDataProviderRegistry";
import { ImmutableMarketDataProviderComposition } from "../../../engines/market-data-provider-composition/MarketDataProviderComposition";
import { InMemoryMarketDataProviderRegistry } from "../../../engines/market-data-provider-registry/MarketDataProviderRegistry";
import { MarketDataService } from "../../../engines/market-data/MarketDataService";
import { TwelveDataBarAdapter } from "./TwelveDataBarAdapter";
import {
  TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
  TWELVE_DATA_PROVIDER_ID,
  TwelveDataExecutionMode,
  TwelveDataVolumeEvidenceStatus,
  type TwelveDataHttpTransport,
  type TwelveDataCredentialDiagnostic,
  type TwelveDataLiveSmokePolicy,
} from "./TwelveDataContracts";
import { TwelveDataHttpsTransport } from "./TwelveDataHttpsTransport";
import {
  TWELVE_DATA_AAPL_FIXTURE_MAPPING,
  TWELVE_DATA_PROVIDER_METADATA,
  loadTwelveDataCredentials,
} from "./TwelveDataProvider";

export const TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY: TwelveDataLiveSmokePolicy = deepFreeze({
  schemaVersion: TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
  policyId: "twelve-data-live-smoke:aapl-pt5m:1",
  version: "1.0",
  allowedProviderId: TWELVE_DATA_PROVIDER_ID,
  allowedSymbols: ["AAPL"],
  allowedIntervals: [BarInterval.FiveMinutes],
  maxSymbolsPerRun: 1,
  maxRequestsPerRun: 1,
  maxLookbackSeconds: 23_400,
  maxRecords: 10,
  maxApiCreditsPerRun: 1,
  officialEvidenceReferences: [
    "docs/research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md",
    "docs/specifications/TWELVE_DATA_ADAPTER.md",
  ],
  executionKind: "MANUAL_ONE_SHOT",
  pollingAllowed: false,
  persistenceAllowed: false,
  streamingAllowed: false,
  automaticRetryAllowed: false,
  backgroundExecutionAllowed: false,
  secretLoggingAllowed: false,
});

export interface TwelveDataLiveSmokeInput {
  readonly confirmed: boolean;
  readonly startTime: string;
  readonly endTime: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly transport?: TwelveDataHttpTransport;
  readonly clock?: { now(): string };
}

export interface TwelveDataLiveSmokeSummary {
  readonly notice: "LIVE SMOKE ONLY — NO TRADING OR DECISION AUTHORIZATION";
  readonly mode: "DRY_RUN" | "LIVE_SMOKE";
  readonly providerId: typeof TWELVE_DATA_PROVIDER_ID;
  readonly symbol: "AAPL";
  readonly canonicalInstrumentId: string;
  readonly interval: BarInterval.FiveMinutes;
  readonly startTime: string;
  readonly endTime: string;
  readonly maxRecords: 10;
  readonly requestBudget: 1;
  readonly apiCreditBudget: 1;
  readonly credential: TwelveDataCredentialDiagnostic;
  readonly transportReady: true;
  readonly networkRequests: 0 | 1;
  readonly canonicalAcceptance: "NOT_ATTEMPTED" | "ACCEPTED" | "BLOCKED_UNVERIFIED_VOLUME" | "REJECTED";
  readonly acceptedBars: number;
  readonly earliestBar?: string | undefined;
  readonly latestBar?: string | undefined;
  readonly validationStatus: string;
  readonly qualityStatus: string;
  readonly duplicateCount: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly elapsedMs: number;
}

export function parseTwelveDataLiveSmokeArguments(args: readonly string[]): {
  readonly confirmed: boolean;
  readonly startTime: string;
  readonly endTime: string;
} {
  const confirmed = args.includes("--confirm-live-smoke");
  const startTime = singleArgument(args, "--start=");
  const endTime = singleArgument(args, "--end=");
  const known = args.every((argument) => argument === "--confirm-live-smoke"
    || argument.startsWith("--start=")
    || argument.startsWith("--end="));
  if (!known || startTime === undefined || endTime === undefined) {
    throw new Error("Usage: live smoke requires one explicit --start=<UTC>, one --end=<UTC>, and optional --confirm-live-smoke.");
  }
  return { confirmed, startTime, endTime };
}

/** Validates the bounded run. Network is reached only when confirmed is true. */
export async function runInitialTwelveDataLiveSmoke(
  input: Readonly<TwelveDataLiveSmokeInput>,
): Promise<TwelveDataLiveSmokeSummary> {
  const clock = input.clock ?? { now: () => new Date().toISOString() };
  const startedAt = Date.parse(requireTimestamp(clock.now(), "clock"));
  const credentials = loadTwelveDataCredentials(input.environment);
  const request = buildInitialSmokeRequest(input.startTime, input.endTime, clock.now());
  const readinessTransport = new TwelveDataHttpsTransport({ clock });
  const adapterRequest = readinessAdapter(request, credentials, input.transport ?? readinessTransport, clock);
  readinessTransport.assertReady(adapterRequest.adapter.buildRequest(request));

  const common = {
    notice: "LIVE SMOKE ONLY — NO TRADING OR DECISION AUTHORIZATION" as const,
    providerId: TWELVE_DATA_PROVIDER_ID,
    symbol: "AAPL" as const,
    canonicalInstrumentId: TWELVE_DATA_AAPL_FIXTURE_MAPPING.canonicalInstrument.instrumentId,
    interval: BarInterval.FiveMinutes as const,
    startTime: request.startTime,
    endTime: request.endTime,
    maxRecords: 10 as const,
    requestBudget: 1 as const,
    apiCreditBudget: 1 as const,
    credential: credentials.toRedactedDiagnostic(),
    transportReady: true as const,
  };

  if (!input.confirmed) {
    return deepFreeze({
      ...common,
      mode: "DRY_RUN",
      networkRequests: 0,
      canonicalAcceptance: "NOT_ATTEMPTED",
      acceptedBars: 0,
      validationStatus: "NOT_RUN",
      qualityStatus: "NOT_RUN",
      duplicateCount: 0,
      blockers: [],
      warnings: ["Confirmation flag absent; no network request was made."],
      elapsedMs: elapsed(startedAt, clock.now()),
    });
  }

  const result = await adapterRequest.service.getBars(request);
  const volumeBlocked = result.blockers.some((blocker) => blocker.code === "AMBIGUOUS_UNITS");
  const earliestBar = result.data[0]?.intervalStart;
  const latestBar = result.data.at(-1)?.intervalStart;
  return deepFreeze({
    ...common,
    mode: "LIVE_SMOKE",
    networkRequests: 1,
    canonicalAcceptance: result.status === "ACCEPTED"
      ? "ACCEPTED"
      : volumeBlocked ? "BLOCKED_UNVERIFIED_VOLUME" : "REJECTED",
    acceptedBars: result.data.length,
    ...(earliestBar === undefined ? {} : { earliestBar }),
    ...(latestBar === undefined ? {} : { latestBar }),
    validationStatus: result.validation.status,
    qualityStatus: result.qualityStatus,
    duplicateCount: result.duplicateCount,
    blockers: result.blockers.map((blocker) => blocker.code).sort(),
    warnings: result.warnings.map((warning) => warning.code).sort(),
    elapsedMs: elapsed(startedAt, clock.now()),
  });
}

function readinessAdapter(
  _request: MarketDataBarRequest,
  credentials: ReturnType<typeof loadTwelveDataCredentials>,
  transport: TwelveDataHttpTransport,
  clock: { now(): string },
) {
  const adapter = new TwelveDataBarAdapter({
    credentials,
    transport,
    mappings: [TWELVE_DATA_AAPL_FIXTURE_MAPPING],
    policy: {
      schemaVersion: TWELVE_DATA_ADAPTER_SCHEMA_VERSION,
      policyId: "twelve-data-live-bar-normalization:1",
      version: "1.0",
      closureBufferSeconds: 120,
      maxAgeSeconds: 3_600,
      allowedAssetClasses: TWELVE_DATA_PROVIDER_METADATA.supportedAssetClasses,
      allowedIntervals: [BarInterval.FiveMinutes],
      volumeEvidenceStatus: TwelveDataVolumeEvidenceStatus.Unresolved,
    },
    executionMode: TwelveDataExecutionMode.BoundedLiveSmoke,
    liveSmokePolicy: TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY,
    clock,
  });
  const registry = new InMemoryMarketDataProviderRegistry([TWELVE_DATA_PROVIDER_METADATA], {
    schemaVersion: MARKET_DATA_PROVIDER_REGISTRY_SCHEMA_VERSION,
    policyId: "registry:twelve-data-live-smoke:1",
    version: "1.0",
    displayNamePolicy: MarketDataProviderNamePolicy.RejectDuplicates,
  });
  const composition = new ImmutableMarketDataProviderComposition(registry, [], [adapter]);
  return { adapter, service: new MarketDataService(composition, clock) };
}

function buildInitialSmokeRequest(startTime: string, endTime: string, now: string): MarketDataBarRequest {
  requireTimestamp(startTime, "startTime");
  requireTimestamp(endTime, "endTime");
  requireTimestamp(now, "clock");
  return deepFreeze({
    schemaVersion: MARKET_DATA_SCHEMA_VERSION,
    requestId: "request:twelve-data:live-smoke:aapl-pt5m:1",
    operation: MarketDataOperation.Bars,
    providerId: TWELVE_DATA_PROVIDER_ID,
    barMode: MarketDataBarMode.Intraday,
    instrument: { instrumentId: TWELVE_DATA_AAPL_FIXTURE_MAPPING.canonicalInstrument.instrumentId },
    interval: BarInterval.FiveMinutes,
    startTime,
    endTime,
    maxRecords: 10,
    requestedAt: now,
    evaluatedAt: now,
    policy: {
      schemaVersion: MARKET_DATA_SCHEMA_VERSION,
      policyId: "market-data-live-smoke:aapl-pt5m:1",
      version: "1.0",
      allowedProviderIds: [TWELVE_DATA_PROVIDER_ID],
      requiredCapabilities: [MarketDataCapability.Bars],
      maxRecords: 10,
      maxLookbackSeconds: 23_400,
    },
    trace: { correlationId: "correlation:twelve-data:live-smoke:aapl-pt5m:1" },
  });
}

function requireTimestamp(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error(`${field} must be an explicit canonical UTC timestamp.`);
  }
  return value;
}

function singleArgument(args: readonly string[], prefix: string): string | undefined {
  const values = args.filter((argument) => argument.startsWith(prefix)).map((argument) => argument.slice(prefix.length));
  return values.length === 1 && values[0] !== "" ? values[0] : undefined;
}

function elapsed(startedAt: number, finishedAt: string): number {
  return Math.max(0, Date.parse(requireTimestamp(finishedAt, "clock")) - startedAt);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
