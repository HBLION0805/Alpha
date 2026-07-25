import {
  EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
  EventContractSourceCapability,
  EventContractSourceExecutionMode,
  type EventContractSourceMapping,
  type EventContractSourceProvider,
  type EventContractSourceSnapshot,
} from "../../../contracts";
import {
  EventContractSourceEngine,
  INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY,
} from "../../../engines";
import { KalshiEventContractFixtureAdapter } from "./KalshiEventContractFixtureAdapter";
import {
  KALSHI_EVENT_CONTRACT_PROVIDER_ID,
  KalshiEventContractFixtureStatus,
} from "./KalshiEventContractFixtureContracts";
import {
  kalshiBtcFifteenMinuteSeriesBody,
  robinhoodBtcFifteenMinuteEventBody,
} from "./KalshiEventContractReviewedEvidence";
import {
  KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS,
  KalshiPublicHttpsTransport,
  type KalshiPublicHttpRequest,
  type KalshiPublicHttpTransport,
} from "./KalshiPublicHttpsTransport";

export const KALSHI_INITIAL_LIVE_READ_POLICY = deepFreeze({
  policyId: "kalshi-live-read:KXBTC15M-26JUL232045-45:1",
  version: "1.0",
  marketTicker: KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.marketTicker,
  endpoint: KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.endpoint,
  maxRequestsPerRun: 1 as const,
  maxResponseBytes: KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.maxResponseBytes,
  maxRecords: 1 as const,
  timeoutMs: KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.timeoutMs,
  executionKind: "MANUAL_ONE_SHOT" as const,
  credentialMode: "NONE" as const,
  pollingAllowed: false as const,
  persistenceAllowed: false as const,
  streamingAllowed: false as const,
  automaticRetryAllowed: false as const,
  backgroundExecutionAllowed: false as const,
  officialEvidenceReferences: [
    "https://docs.kalshi.com/api-reference/market/get-market",
    "docs/specifications/KALSHI_EVENT_CONTRACT_LIVE_SMOKE.md",
  ],
});

export interface KalshiLiveReadSmokeInput {
  readonly confirmed: boolean;
  readonly transport?: KalshiPublicHttpTransport;
  readonly clock?: { now(): string };
}

export interface KalshiLiveReadSmokeSummary {
  readonly notice: "LIVE READ ONLY — NO TRADING OR DECISION AUTHORIZATION";
  readonly mode: "DRY_RUN" | "LIVE_READ_SMOKE";
  readonly providerId: typeof KALSHI_EVENT_CONTRACT_PROVIDER_ID;
  readonly marketTicker: typeof KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.marketTicker;
  readonly capability: EventContractSourceCapability.Settlement;
  readonly requestBudget: 1;
  readonly responseByteBudget: number;
  readonly recordBudget: 1;
  readonly credentialMode: "NONE";
  readonly transportReady: true;
  readonly networkRequests: 0 | 1;
  readonly persistenceWrites: 0;
  readonly mappingStatus: "NOT_ATTEMPTED" | "REVIEWED_EXACT";
  readonly normalizationStatus: "NOT_ATTEMPTED" | "NORMALIZED_EXACT_MAPPING";
  readonly sourceSnapshot: EventContractSourceSnapshot | null;
  readonly settlementResult: "NOT_ATTEMPTED" | "UP" | "DOWN";
  readonly rawPayloadExposed: false;
  readonly warnings: readonly string[];
  readonly elapsedMs: number;
}

export function parseKalshiLiveReadSmokeArguments(
  args: readonly string[],
): { readonly confirmed: boolean } {
  const confirmation = args.filter((argument) => argument === "--confirm-live-read");
  if (confirmation.length > 1 || args.some((argument) => argument !== "--confirm-live-read")) {
    throw new Error("Usage: Kalshi live read accepts only one optional --confirm-live-read flag.");
  }
  return { confirmed: confirmation.length === 1 };
}

/** Dry-run by default. A confirmed call performs exactly one public GET. */
export async function runInitialKalshiLiveReadSmoke(
  input: Readonly<KalshiLiveReadSmokeInput>,
): Promise<KalshiLiveReadSmokeSummary> {
  const clock = input.clock ?? { now: () => new Date().toISOString() };
  const startedAt = Date.parse(requireTimestamp(clock.now()));
  const request: KalshiPublicHttpRequest = deepFreeze({
    endpoint: KALSHI_INITIAL_LIVE_READ_POLICY.endpoint,
    method: "GET",
    timeoutMs: KALSHI_INITIAL_LIVE_READ_POLICY.timeoutMs,
  });
  const readinessTransport = new KalshiPublicHttpsTransport({ clock });
  readinessTransport.assertReady(request);

  const common = {
    notice: "LIVE READ ONLY — NO TRADING OR DECISION AUTHORIZATION" as const,
    providerId: KALSHI_EVENT_CONTRACT_PROVIDER_ID,
    marketTicker: KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.marketTicker,
    capability: EventContractSourceCapability.Settlement as const,
    requestBudget: 1 as const,
    responseByteBudget: KALSHI_INITIAL_LIVE_READ_POLICY.maxResponseBytes,
    recordBudget: 1 as const,
    credentialMode: "NONE" as const,
    transportReady: true as const,
    persistenceWrites: 0 as const,
    rawPayloadExposed: false as const,
  };

  if (!input.confirmed) {
    return deepFreeze({
      ...common,
      mode: "DRY_RUN",
      networkRequests: 0,
      mappingStatus: "NOT_ATTEMPTED",
      normalizationStatus: "NOT_ATTEMPTED",
      sourceSnapshot: null,
      settlementResult: "NOT_ATTEMPTED",
      warnings: ["Confirmation flag absent; no network request was made."],
      elapsedMs: elapsed(startedAt, clock.now()),
    });
  }

  const transport = input.transport ?? readinessTransport;
  const response = await transport.execute(request);
  const normalizedAt = requireTimestamp(clock.now());
  const fixture = new KalshiEventContractFixtureAdapter().normalize({
    marketBody: response.body,
    seriesBody: kalshiBtcFifteenMinuteSeriesBody(),
    robinhoodBody: robinhoodBtcFifteenMinuteEventBody(),
    observedAt: providerObservedAt(response.body, response.receivedAt),
    receivedAt: response.receivedAt,
    normalizedAt,
  });
  if (fixture.status !== KalshiEventContractFixtureStatus.NormalizedExactMapping) {
    throw new Error("Kalshi live-read payload failed the reviewed exact-market schema.");
  }

  const liveEngine = new EventContractSourceEngine(
    INITIAL_BOUNDED_EVENT_CONTRACT_LIVE_READ_POLICY,
  );
  const liveProvider = createLiveProvider(liveEngine, fixture.provider);
  const liveMapping = createLiveMapping(liveEngine, fixture.mapping, liveProvider);
  const sourceSnapshot = liveEngine.createSnapshot({
    schemaVersion: EVENT_CONTRACT_SOURCE_SCHEMA_VERSION,
    snapshotId: `snapshot:kalshi:live-read:${KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.marketTicker}`,
    provider: liveProvider,
    mapping: liveMapping,
    capability: EventContractSourceCapability.Settlement,
    executionMode: EventContractSourceExecutionMode.BoundedLiveRead,
    sourceRecordId: `kalshi:market:${KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.marketTicker}`,
    observedAt: providerObservedAt(response.body, response.receivedAt),
    publishedAt: null,
    receivedAt: response.receivedAt,
    normalizedAt,
    payloadFingerprint: fingerprint(JSON.parse(response.body) as unknown),
    rawPayloadBytes: new TextEncoder().encode(response.body).length,
    recordCount: 1,
  });

  return deepFreeze({
    ...common,
    mode: "LIVE_READ_SMOKE",
    networkRequests: 1,
    mappingStatus: "REVIEWED_EXACT",
    normalizationStatus: "NORMALIZED_EXACT_MAPPING",
    sourceSnapshot,
    settlementResult: fixture.settlement.result,
    warnings: [
      "Kalshi settlement evidence is not a Robinhood quote or fee observation.",
      "The result was not persisted and cannot authorize a recommendation or trade.",
    ],
    elapsedMs: elapsed(startedAt, clock.now()),
  });
}

function createLiveProvider(
  engine: EventContractSourceEngine,
  fixtureProvider: EventContractSourceProvider,
): EventContractSourceProvider {
  return engine.createProvider({
    schemaVersion: fixtureProvider.schemaVersion,
    providerId: fixtureProvider.providerId,
    displayName: fixtureProvider.displayName,
    sourceClass: fixtureProvider.sourceClass,
    exchangeId: fixtureProvider.exchangeId,
    capabilities: fixtureProvider.capabilities,
    executionModes: [
      EventContractSourceExecutionMode.Fixture,
      EventContractSourceExecutionMode.BoundedLiveRead,
    ],
    credentialMode: fixtureProvider.credentialMode,
    documentationReferences: fixtureProvider.documentationReferences,
    active: fixtureProvider.active,
  });
}

function createLiveMapping(
  engine: EventContractSourceEngine,
  fixtureMapping: EventContractSourceMapping,
  provider: EventContractSourceProvider,
): EventContractSourceMapping {
  return engine.createMapping({
    schemaVersion: fixtureMapping.schemaVersion,
    mappingId: fixtureMapping.mappingId,
    version: fixtureMapping.version,
    createdAt: fixtureMapping.createdAt,
    reviewStatus: fixtureMapping.reviewStatus,
    reviewedAt: fixtureMapping.reviewedAt,
    reviewerId: fixtureMapping.reviewerId,
    evidenceIds: fixtureMapping.evidenceIds,
    provider,
    robinhoodIdentity: fixtureMapping.robinhoodIdentity,
    externalIdentity: fixtureMapping.externalIdentity,
    robinhoodTerms: fixtureMapping.robinhoodTerms,
    externalTerms: fixtureMapping.externalTerms,
  });
}

function providerObservedAt(body: string, fallback: string): string {
  try {
    const parsed = JSON.parse(body) as { readonly market?: { readonly updated_time?: unknown } };
    if (typeof parsed.market?.updated_time !== "string") return requireTimestamp(fallback);
    const time = Date.parse(parsed.market.updated_time);
    return Number.isFinite(time) ? new Date(time).toISOString() : requireTimestamp(fallback);
  } catch {
    return requireTimestamp(fallback);
  }
}

function requireTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("Kalshi live-read chronology requires canonical UTC timestamps.");
  }
  return value;
}

function elapsed(startedAt: number, finishedAt: string): number {
  return Math.max(0, Date.parse(requireTimestamp(finishedAt)) - startedAt);
}

function fingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonicalize(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`).join(",")}}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
