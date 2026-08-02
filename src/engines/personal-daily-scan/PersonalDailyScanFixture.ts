import {
  BarAdjustmentState,
  BarDeliveryTiming,
  BarDerivationStatus,
  BarFreshnessStatus,
  BarInterval,
  BarMarketCoverage,
  BarQuantityUnit,
  BarSessionType,
  CanonicalBarStatus,
  type CanonicalBar,
} from "../../contracts/CanonicalBar";
import type { CanonicalQuote } from "../../contracts/CanonicalQuote";
import {
  InstrumentAssetClass,
  InstrumentStatus,
  InstrumentType,
  type CanonicalInstrument,
} from "../../contracts/CanonicalInstrument";
import { PersonalCandidateSession } from "../../contracts/PersonalCandidateScan";
import {
  PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION,
  type PersonalMarketDataCompositionRequest,
} from "../../contracts/PersonalMarketDataComposition";
import {
  VERIFIED_MARKET_SNAPSHOT_SCHEMA_VERSION,
  VerifiedMarketCalendarSessionStatus,
  VerifiedMarketDataOrigin,
  VerifiedMarketEvidenceResolutionResult,
  VerifiedMarketEvidenceStatus,
  VerifiedMarketProviderAttemptResult,
  VerifiedMarketProviderCapability,
  type VerifiedMarketSnapshotInput,
  type VerifiedMarketCalendarSessionEvidence,
} from "../../contracts/VerifiedMarketSnapshot";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import {
  approvePersonalWatchlistMappingRegistry,
  createResearchVerifiedPersonalWatchlistCatalog,
} from "../personal-watchlist-mapping/PersonalWatchlistMappingRegistry";
import type { PersonalWatchlistMappingRegistry } from "../../contracts/PersonalWatchlistMapping";
import {
  ALPACA_PERSONAL_EXACT_SYMBOLS,
  planAlpacaPersonalMarketDataDryRun,
} from "../../integration/market-data/alpaca/AlpacaPersonalMarketDataPlanner";
import {
  AlpacaPersonalRequestKind,
  type AlpacaPersonalBarNormalizationContext,
  type AlpacaPersonalNormalizationPolicy,
  type AlpacaPersonalQuoteNormalizationContext,
} from "../../integration/market-data/alpaca/AlpacaPersonalMarketDataContracts";
import {
  createAlpacaPersonalInstrumentMappings,
  normalizeAlpacaPersonalBars,
  normalizeAlpacaPersonalQuotes,
} from "../../integration/market-data/alpaca/AlpacaPersonalMarketDataNormalizer";
import { validateAlpacaPersonalMarketDataResponse } from "../../integration/market-data/alpaca/AlpacaPersonalMarketDataResponseValidator";
import { PersonalDecisionLiquidityStatus } from "../../contracts/PersonalDecision";
import { createCanonicalBar } from "../canonical-bar/CanonicalBar";
import { createCanonicalInstrument } from "../canonical-instrument/CanonicalInstrument";
import {
  compositionBindingFromRequest,
  verifiedEvidenceResolutionFingerprint,
  verifiedMappingRegistryFingerprint,
  verifiedProviderRequestFingerprint,
  verifiedProviderSymbolMappingFingerprint,
} from "../verified-market-snapshot/VerifiedMarketSnapshotEngine";

export const PERSONAL_DAILY_SCAN_FIXTURE_AS_OF =
  "2026-07-28T20:00:10.000Z";
export const PERSONAL_DAILY_SCAN_PROFILE_ID =
  "personal-daily-scan:offline";
export const PERSONAL_DAILY_SCAN_PROFILE_VERSION = "1.0";
export const PERSONAL_DAILY_SCAN_MAPPING_REGISTRY_VERSION = "1.1";
export const PERSONAL_DAILY_SCAN_EVIDENCE_POLICY_VERSION = "1.0";
const AS_OF = PERSONAL_DAILY_SCAN_FIXTURE_AS_OF;
const POLICY: AlpacaPersonalNormalizationPolicy = {
  policyId: "alpaca-personal-normalization:1",
  version: "1.0",
  closureBufferSeconds: 5,
  quoteMaxAgeSeconds: 120,
  barMaxAgeSeconds: {
    [BarInterval.OneMinute]: 120,
    [BarInterval.FiveMinutes]: 1200,
    [BarInterval.FifteenMinutes]: 2700,
    [BarInterval.OneHour]: 10800,
    [BarInterval.OneDay]: 345600,
  },
  roundLotSize: 100,
};
let fixtureObservationBuildCount = 0;

export type OfflinePersonalDailyScanTemporalScenario =
  | "PRE_MARKET_0830"
  | "INTRADAY_1000"
  | "POST_CLOSE"
  | "WEEKEND";

interface OfflinePersonalDailyScanFixtureTiming {
  readonly asOf: string;
  readonly quoteObservationTime: string;
  readonly previousSessionDate: string;
  readonly selectedSessionDate: string;
  readonly currentDate: string;
  readonly currentSessionStatus: VerifiedMarketCalendarSessionStatus;
}

const POST_CLOSE_TIMING: OfflinePersonalDailyScanFixtureTiming = {
  asOf: AS_OF,
  quoteObservationTime: "2026-07-28T19:59:00.000Z",
  previousSessionDate: "2026-07-27",
  selectedSessionDate: "2026-07-28",
  currentDate: "2026-07-28",
  currentSessionStatus: VerifiedMarketCalendarSessionStatus.Completed,
};

export interface OfflinePersonalDailyScanFixture {
  readonly asOf: string;
  readonly snapshotInput: VerifiedMarketSnapshotInput;
  readonly compositionRequest: PersonalMarketDataCompositionRequest;
  readonly mappingRegistry: PersonalWatchlistMappingRegistry;
  readonly bars: readonly CanonicalBar[];
  readonly quotes: readonly CanonicalQuote[];
  readonly benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly macroEvidenceStatus: VerifiedMarketEvidenceStatus;
  readonly volatilityEvidenceStatus: VerifiedMarketEvidenceStatus;
}

/** Planning is safe for dry-run; it has no observation, normalizer, credential, or transport path. */
export function planOfflinePersonalDailyScanDryRun() {
  return planOfflinePersonalDailyScanDryRunForTiming(POST_CLOSE_TIMING);
}

function planOfflinePersonalDailyScanDryRunForTiming(
  timing: OfflinePersonalDailyScanFixtureTiming,
) {
  return planAlpacaPersonalMarketDataDryRun({
    planId: "personal-daily-scan:fixture:1",
    symbols: ALPACA_PERSONAL_EXACT_SYMBOLS,
    plannedAt: timing.asOf,
    windows: windows(timing),
  });
}
export function resetOfflinePersonalDailyScanFixtureBuildCountForTest(): void {
  fixtureObservationBuildCount = 0;
}
export function offlinePersonalDailyScanFixtureBuildCountForTest(): number {
  return fixtureObservationBuildCount;
}

/** Fixture-only data crosses the same Planner -> response validator -> normalizer boundary as future reads. */
export function buildOfflinePersonalDailyScanFixture(): OfflinePersonalDailyScanFixture {
  return buildOfflinePersonalDailyScanFixtureForTiming(POST_CLOSE_TIMING);
}

/** Closed direct-file test seam; no transport, credentials, persistence, or network path exists. */
export function buildOfflinePersonalDailyScanTemporalFixtureForTest(
  scenario: OfflinePersonalDailyScanTemporalScenario,
): OfflinePersonalDailyScanFixture {
  const timingByScenario: Record<
    OfflinePersonalDailyScanTemporalScenario,
    OfflinePersonalDailyScanFixtureTiming
  > = {
    PRE_MARKET_0830: {
      asOf: "2026-07-29T12:30:00.000Z",
      quoteObservationTime: "2026-07-29T12:29:00.000Z",
      previousSessionDate: "2026-07-27",
      selectedSessionDate: "2026-07-28",
      currentDate: "2026-07-29",
      currentSessionStatus: VerifiedMarketCalendarSessionStatus.Scheduled,
    },
    INTRADAY_1000: {
      asOf: "2026-07-29T14:00:00.000Z",
      quoteObservationTime: "2026-07-29T13:59:00.000Z",
      previousSessionDate: "2026-07-27",
      selectedSessionDate: "2026-07-28",
      currentDate: "2026-07-29",
      currentSessionStatus: VerifiedMarketCalendarSessionStatus.Scheduled,
    },
    POST_CLOSE: POST_CLOSE_TIMING,
    WEEKEND: {
      asOf: "2026-08-01T14:00:00.000Z",
      quoteObservationTime: "2026-07-31T19:59:00.000Z",
      previousSessionDate: "2026-07-30",
      selectedSessionDate: "2026-07-31",
      currentDate: "2026-08-01",
      currentSessionStatus:
        VerifiedMarketCalendarSessionStatus.HolidayClosed,
    },
  };
  return buildOfflinePersonalDailyScanFixtureForTiming(
    timingByScenario[scenario],
  );
}

function buildOfflinePersonalDailyScanFixtureForTiming(
  timing: OfflinePersonalDailyScanFixtureTiming,
): OfflinePersonalDailyScanFixture {
  fixtureObservationBuildCount += 1;
  const registry = approvePersonalWatchlistMappingRegistry(
    createResearchVerifiedPersonalWatchlistCatalog(),
    {
      mappingIds: createResearchVerifiedPersonalWatchlistCatalog().mappings.map(
        (mapping) => mapping.mappingId,
      ),
      decidedBy: "owner-fixture",
      decidedAt: "2026-07-28T13:00:00.000Z",
      decisionReference: "owner:fixture:phase1a",
    },
  );
  const plan = planOfflinePersonalDailyScanDryRunForTiming(timing);
  if (plan.networkRequests !== 0 || plan["requests"].length !== 5)
    throw new Error("Fixture planner boundary is invalid.");
  const quotes = normalizeQuotes(
    plan["requests"].find(
      (request) => request.kind === AlpacaPersonalRequestKind.LatestQuotes,
    )!,
    timing,
  );
  const bars = [
    BarInterval.OneDay,
    BarInterval.OneHour,
    BarInterval.FifteenMinutes,
    BarInterval.FiveMinutes,
  ].flatMap((interval) =>
    normalizeBars(
      interval,
    plan["requests"].find(
        (request) =>
          request.kind === AlpacaPersonalRequestKind.Bars &&
          request.requestId.endsWith(`:${interval}`),
      )!,
      timing,
    ),
  );
  const benchmarks = fixtureBenchmarks(timing);
  const candidates = registry.mappings.map((mapping) => ({
    candidateId: `candidate:${mapping.mappingId}`,
    mapping,
    timeframes: [
      BarInterval.OneDay,
      BarInterval.OneHour,
      BarInterval.FifteenMinutes,
      BarInterval.FiveMinutes,
    ].map((interval) => {
      const pair = bars
        .filter(
          (bar) =>
            bar.instrument.instrumentId ===
              mapping.analysisInstrument.instrumentId &&
            bar.interval === interval,
        )
        .sort((a, b) => a.intervalEnd.localeCompare(b.intervalEnd));
      return { interval, start: pair[0]!, end: pair[1]! };
    }),
    quote: quotes.find(
      (quote) =>
        quote.instrument.instrumentId === mapping.tradeVehicle.instrumentId,
    )!,
    liquidity: (() => {
      const quote = quotes.find(
        (item) =>
          item.instrument.instrumentId === mapping.tradeVehicle.instrumentId,
      )!;
      return {
        assessmentId: `liquidity:${quote.quoteId}`,
        quoteId: quote.quoteId,
        quoteFingerprint: quote.fingerprint,
        status: PersonalDecisionLiquidityStatus.Sufficient,
        evaluatedAt: timing.asOf,
        policyId: "personal-liquidity:fixture",
        policyVersion: "1.0",
        evidenceReferences: [quote.source.sourceReference],
      };
    })(),
  }));
  const compositionRequest: PersonalMarketDataCompositionRequest = {
    schemaVersion: PERSONAL_MARKET_DATA_COMPOSITION_SCHEMA_VERSION,
    scanId: "personal-daily-scan:fixture:1",
    profileId: PERSONAL_DAILY_SCAN_PROFILE_ID,
    profileVersion: PERSONAL_DAILY_SCAN_PROFILE_VERSION,
    evaluatedAt: timing.asOf,
    session: PersonalCandidateSession.Intraday,
    mappingRegistry: registry,
    candidates,
  };
  const benchmarkInstrumentIds = benchmarks
    .map((bar) => bar.instrument.instrumentId)
    .sort();
  const snapshotBars = uniqueBars([
    ...bars.filter((bar) =>
      registry.mappings.some(
        (mapping) =>
          mapping.analysisInstrument.instrumentId ===
          bar.instrument.instrumentId,
      ),
    ),
    ...benchmarks,
  ]);
  const snapshotQuotes = quotes.filter((quote) =>
    registry.mappings.some(
      (mapping) =>
        mapping.tradeVehicle.instrumentId === quote.instrument.instrumentId,
    ),
  );
  const providerTrace = buildProviderTrace(
    plan,
    snapshotBars,
    snapshotQuotes,
    registry,
    timing,
  );
  const snapshotInput: VerifiedMarketSnapshotInput = {
    schemaVersion: VERIFIED_MARKET_SNAPSHOT_SCHEMA_VERSION,
    asOf: timing.asOf,
    session: {
      calendarId: "calendar:us-equities:fixture",
      sessionId: `session:${timing.selectedSessionDate}:regular`,
      sessionDate: timing.selectedSessionDate,
      sessionType: "REGULAR",
      timezone: "America/New_York",
    },
    sessionCalendarEvidence: fixtureSessionCalendarEvidence(timing),
    analysisInstrumentIds: [
      ...new Set(
        registry.mappings.map(
          (mapping) => mapping.analysisInstrument.instrumentId,
        ),
      ),
    ].sort(),
    tradeVehicleIds: registry.mappings
      .map((mapping) => mapping.tradeVehicle.instrumentId)
      .sort(),
    benchmarkInstrumentIds,
    canonicalBarReferences: snapshotBars.map(barReference),
    canonicalQuoteReferences: snapshotQuotes.map(quoteReference),
    providerRequestAttempts: providerTrace.providerRequestAttempts,
    evidenceResolutions: providerTrace.evidenceResolutions,
    freshnessQualityPolicy: {
      policyId: POLICY.policyId,
      version: POLICY.version,
      closureBufferSeconds: POLICY.closureBufferSeconds,
      quoteMaxAgeSeconds: POLICY.quoteMaxAgeSeconds,
      barMaxAgeSeconds: {
        [BarInterval.OneDay]: POLICY.barMaxAgeSeconds[BarInterval.OneDay],
        [BarInterval.OneHour]: POLICY.barMaxAgeSeconds[BarInterval.OneHour],
        [BarInterval.FifteenMinutes]:
          POLICY.barMaxAgeSeconds[BarInterval.FifteenMinutes],
        [BarInterval.FiveMinutes]:
          POLICY.barMaxAgeSeconds[BarInterval.FiveMinutes],
      },
    },
    compositionBinding: compositionBindingFromRequest(compositionRequest),
    requiredEvidenceStatus: {
      analysisBars: VerifiedMarketEvidenceStatus.Available,
      tradeVehicleQuotes: VerifiedMarketEvidenceStatus.Available,
      benchmarks: VerifiedMarketEvidenceStatus.Available,
      provenance: VerifiedMarketEvidenceStatus.Available,
    },
    volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
    blockingReasons: [],
  };
  return deepFreeze({
    asOf: timing.asOf,
    snapshotInput,
    compositionRequest,
    mappingRegistry: registry,
    bars,
    quotes,
    benchmarkEvidenceStatus: VerifiedMarketEvidenceStatus.Available,
    macroEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
    volatilityEvidenceStatus: VerifiedMarketEvidenceStatus.Unavailable,
  });
}

function normalizeQuotes(request: {
  readonly requestId: string;
}, timing: OfflinePersonalDailyScanFixtureTiming): readonly CanonicalQuote[] {
  const body = JSON.stringify({
    quotes: Object.fromEntries(
      ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => [
        symbol,
        {
          ap: 101.25,
          as: 4,
          ax: "V",
          bp: 101.2,
          bs: 3,
          bx: "V",
          c: ["R"],
          t: timing.quoteObservationTime,
          z: "C",
        },
      ]),
    ),
  });
  const response = validateAlpacaPersonalMarketDataResponse(
    body,
    AlpacaPersonalRequestKind.LatestQuotes,
    ALPACA_PERSONAL_EXACT_SYMBOLS,
  );
  const result = normalizeAlpacaPersonalQuotes({
    response,
    mappings: createAlpacaPersonalInstrumentMappings(),
    receivedAt: relativeTimestamp(timing.asOf, -5),
    normalizedAt: relativeTimestamp(timing.asOf, -4),
    evaluatedAt: timing.asOf,
    requestId: request.requestId,
    policy: POLICY,
  } satisfies AlpacaPersonalQuoteNormalizationContext);
  if (result.status !== "NORMALIZED")
    throw new Error("Fixture Quotes did not normalize.");
  return result.quotes;
}
function normalizeBars(
  interval: BarInterval,
  request: {
    readonly requestId: string;
    readonly query: readonly (readonly [string, string])[];
  },
  timing: OfflinePersonalDailyScanFixtureTiming,
): readonly CanonicalBar[] {
  const rows = Object.fromEntries(
    ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => [
      symbol,
      rowPair(interval, symbol, timing),
    ]),
  );
  const response = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({ bars: rows, next_page_token: null }),
    AlpacaPersonalRequestKind.Bars,
    ALPACA_PERSONAL_EXACT_SYMBOLS,
  );
  const dailyBoundaries =
    interval === BarInterval.OneDay
      ? ALPACA_PERSONAL_EXACT_SYMBOLS.flatMap((symbol) => [
          {
            symbol,
            intervalStart: marketOpen(timing.previousSessionDate),
            intervalEnd: marketClose(timing.previousSessionDate),
            sessionDate: timing.previousSessionDate,
          },
          {
            symbol,
            intervalStart: marketOpen(timing.selectedSessionDate),
            intervalEnd: marketClose(timing.selectedSessionDate),
            sessionDate: timing.selectedSessionDate,
          },
        ])
      : [];
  const result = normalizeAlpacaPersonalBars({
    response,
    mappings: createAlpacaPersonalInstrumentMappings(),
    interval,
    requestStartTime: queryValue(request, "start"),
    requestEndTime: queryValue(request, "end"),
    receivedAt: relativeTimestamp(timing.asOf, -5),
    normalizedAt: relativeTimestamp(timing.asOf, -4),
    evaluatedAt: timing.asOf,
    requestId: request.requestId,
    policy: POLICY,
    dailyBoundaries,
  } satisfies AlpacaPersonalBarNormalizationContext);
  if (result.status !== "NORMALIZED")
    throw new Error(`Fixture Bars did not normalize for ${interval}.`);
  return result.bars;
}
function rowPair(
  interval: BarInterval,
  symbol: string,
  timing: OfflinePersonalDailyScanFixtureTiming,
) {
  const closes = trend(interval, symbol);
  const starts =
    interval === BarInterval.OneDay
      ? [
          marketOpen(timing.previousSessionDate),
          marketOpen(timing.selectedSessionDate),
        ]
      : interval === BarInterval.OneHour
        ? [
            sessionTime(timing.selectedSessionDate, "17:00:00.000Z"),
            sessionTime(timing.selectedSessionDate, "18:00:00.000Z"),
          ]
        : interval === BarInterval.FifteenMinutes
          ? [
              sessionTime(timing.selectedSessionDate, "19:15:00.000Z"),
              sessionTime(timing.selectedSessionDate, "19:30:00.000Z"),
            ]
          : [
              sessionTime(timing.selectedSessionDate, "19:45:00.000Z"),
              sessionTime(timing.selectedSessionDate, "19:50:00.000Z"),
            ];
  return starts.map((timestamp, index) => ({
    c: closes[index]!,
    h: closes[index]! + 1,
    l: closes[index]! - 1,
    n: 20,
    o: closes[index]! - 0.25,
    t: timestamp,
    v: 1000,
    vw: closes[index]!,
  }));
}
function queryValue(
  request: { readonly query: readonly (readonly [string, string])[] },
  key: string,
): string {
  const value = request.query.find(([name]) => name === key)?.[1];
  if (value === undefined)
    throw new Error(`Fixture request is missing ${key}.`);
  return value;
}
function trend(
  interval: BarInterval,
  symbol: string,
): readonly [number, number] {
  if (symbol === "MU") return [100, 103];
  if (symbol === "TSLA")
    return interval === BarInterval.FiveMinutes ? [100, 100] : [100, 103];
  if (symbol === "SPCX") return [103, 100];
  if (symbol === "SKHY")
    return interval === BarInterval.OneDay ? [100, 103] : [103, 100];
  return [100, 101];
}
function fixtureSessionCalendarEvidence(
  timing: OfflinePersonalDailyScanFixtureTiming,
): readonly VerifiedMarketCalendarSessionEvidence[] {
  const entries = [
    {
      sessionDate: timing.previousSessionDate,
      status: VerifiedMarketCalendarSessionStatus.Completed,
    },
    {
      sessionDate: timing.selectedSessionDate,
      status: VerifiedMarketCalendarSessionStatus.Completed,
    },
    ...(timing.currentDate === timing.selectedSessionDate
      ? []
      : [
          {
            sessionDate: timing.currentDate,
            status: timing.currentSessionStatus,
          },
        ]),
  ];
  return entries.map(({ sessionDate, status }) => {
    const evidence = {
      calendarEvidenceId: `calendar-evidence:us-equities:${sessionDate}`,
      calendarId: "calendar:us-equities:fixture",
      sessionId: `session:${sessionDate}:regular`,
      sessionDate,
      sessionType: "REGULAR" as const,
      timezone: "America/New_York",
      marketOpen: marketOpen(sessionDate),
      marketClose: marketClose(sessionDate),
      closureBufferSeconds: POLICY.closureBufferSeconds,
      status,
      provenanceReference: `fixture-calendar:us-equities:${sessionDate}`,
      dataOrigin: VerifiedMarketDataOrigin.Fixture,
    };
    return {
      ...evidence,
      calendarEvidenceFingerprint: deterministicFingerprint(evidence),
    };
  });
}
function fixtureBenchmarks(
  timing: OfflinePersonalDailyScanFixtureTiming,
): readonly CanonicalBar[] {
  return [
    benchmarkBar(
      "instrument:00000000000000000000000201",
      "QQQ",
      "Invesco QQQ Trust",
      "10000",
      timing,
    ),
    benchmarkBar(
      "instrument:00000000000000000000000202",
      "SMH",
      "VanEck Semiconductor ETF",
      "20000",
      timing,
    ),
  ];
}
function benchmarkBar(
  instrumentId: string,
  symbol: string,
  displayName: string,
  atomicValue: string,
  timing: OfflinePersonalDailyScanFixtureTiming,
): CanonicalBar {
  const instrument: CanonicalInstrument = createCanonicalInstrument({
    schemaVersion: "1.0",
    instrumentId,
    metadataVersion: "fixture-1.0",
    displaySymbol: symbol,
    displayName,
    assetClass: InstrumentAssetClass.Etf,
    instrumentType: InstrumentType.ExchangeTradedFund,
    status: InstrumentStatus.Active,
    currency: "USD",
    exchange: "XNAS",
    timezone: "America/New_York",
    effectiveFrom: "2020-01-01T00:00:00.000Z",
  });
  return createCanonicalBar({
    schemaVersion: "1.0",
    instrument,
    interval: BarInterval.OneDay,
    intervalStart: marketOpen(timing.selectedSessionDate),
    intervalEnd: marketClose(timing.selectedSessionDate),
    observationTime: marketClose(timing.selectedSessionDate),
    receivedAt: relativeTimestamp(timing.asOf, -5),
    normalizedAt: relativeTimestamp(timing.asOf, -4),
    value: {
      open: { atomicValue, scale: 2 },
      high: { atomicValue, scale: 2 },
      low: { atomicValue, scale: 2 },
      close: { atomicValue, scale: 2 },
      volume: { atomicValue: "1000", scale: 0 },
    },
    currency: "USD",
    quantityUnit: BarQuantityUnit.BaseUnits,
    status: CanonicalBarStatus.Final,
    session: {
      sessionType: BarSessionType.Regular,
      sessionDate: timing.selectedSessionDate,
      timezone: "America/New_York",
    },
    adjustment: BarAdjustmentState.Raw,
    quality: {
      policyId: "fixture-benchmark-quality",
      policyVersion: "1.0",
      evaluatedAt: timing.asOf,
      maxAgeSeconds: 345600,
      freshness: BarFreshnessStatus.Current,
      deliveryTiming: BarDeliveryTiming.RealTime,
      marketCoverage: BarMarketCoverage.SingleVenue,
      derivation: BarDerivationStatus.ProviderReported,
      reasonCodes: [],
    },
    source: {
      providerId: "provider:fixture-synthetic",
      adapterId: "fixture-benchmark-adapter",
      adapterVersion: "1.0",
      sourceReference: `fixture-benchmark:${symbol}`,
      contentIntegrityReference: deterministicFingerprint({
        benchmark: symbol,
      }),
    },
  });
}
function windows(timing: OfflinePersonalDailyScanFixtureTiming) {
  return [
    {
      interval: BarInterval.OneDay,
      startTime: marketOpen(timing.previousSessionDate),
      endTime: timing.asOf,
      maxRecords: 60,
    },
    {
      interval: BarInterval.OneHour,
      startTime: sessionTime(timing.selectedSessionDate, "17:00:00.000Z"),
      endTime: timing.asOf,
      maxRecords: 60,
    },
    {
      interval: BarInterval.FifteenMinutes,
      startTime: sessionTime(timing.selectedSessionDate, "19:15:00.000Z"),
      endTime: timing.asOf,
      maxRecords: 60,
    },
    {
      interval: BarInterval.FiveMinutes,
      startTime: sessionTime(timing.selectedSessionDate, "19:45:00.000Z"),
      endTime: timing.asOf,
      maxRecords: 60,
    },
  ];
}
function uniqueBars(bars: readonly CanonicalBar[]) {
  return [...new Map(bars.map((bar) => [bar.barId, bar])).values()];
}
function barReference(bar: CanonicalBar) {
  return {
    canonicalBarId: bar.barId,
    canonicalBarFingerprint: bar.fingerprint,
    canonicalInstrumentId: bar.instrument.instrumentId,
    interval: bar.interval,
    intervalStart: bar.intervalStart,
    intervalEnd: bar.intervalEnd,
    observationTime: bar.observationTime,
    sessionDate: bar.session.sessionDate,
    status: "FINAL" as const,
    freshness:
      bar.quality.freshness === "CURRENT"
        ? ("CURRENT" as const)
        : ("STALE" as const),
    provenanceReference: bar.source.sourceReference,
  } as const;
}
function quoteReference(quote: CanonicalQuote) {
  return {
    canonicalQuoteId: quote.quoteId,
    canonicalQuoteFingerprint: quote.fingerprint,
    canonicalInstrumentId: quote.instrument.instrumentId,
    observationTime: quote.observationTime,
    status: quote.status,
    provenanceReference: quote.source.sourceReference,
  } as const;
}
function buildProviderTrace(
  plan: ReturnType<typeof planAlpacaPersonalMarketDataDryRun>,
  bars: readonly CanonicalBar[],
  quotes: readonly CanonicalQuote[],
  mappingRegistry: PersonalWatchlistMappingRegistry,
  timing: OfflinePersonalDailyScanFixtureTiming,
) {
  const mappingRegistryId = mappingRegistry.registryId;
  const mappingRegistryVersion = mappingRegistry.version;
  const mappingRegistryFingerprint = verifiedMappingRegistryFingerprint({ mappingRegistryId, mappingRegistryVersion });
  const requestAttempts = plan["requests"].map((request) => {
    const capability =
      request.kind === AlpacaPersonalRequestKind.Bars
        ? VerifiedMarketProviderCapability.Bars
        : VerifiedMarketProviderCapability.LatestQuote;
    const interval =
      request.kind === AlpacaPersonalRequestKind.Bars
        ? [
            BarInterval.OneDay,
            BarInterval.OneHour,
            BarInterval.FifteenMinutes,
            BarInterval.FiveMinutes,
          ].find((value) => request.requestId.endsWith(`:${value}`))
        : undefined;
    const descriptor = {
      requestAttemptId: `request-attempt:${request.requestId}`,
      requestId: request.requestId,
      requestedProvider: plan.providerId,
      capability,
      ...(interval === undefined ? {} : { interval }),
      requestedSymbolScope: queryValue(request, "symbols").split(","),
      mappingRegistryId,
      mappingRegistryVersion,
      mappingRegistryFingerprint,
      requestWindowStart:
        request.kind === AlpacaPersonalRequestKind.Bars
          ? queryValue(request, "start")
          : new Date(
              Date.parse(timing.asOf) -
                POLICY.quoteMaxAgeSeconds * 1_000,
            ).toISOString(),
      requestWindowEnd:
        request.kind === AlpacaPersonalRequestKind.Bars
          ? queryValue(request, "end")
          : timing.asOf,
    };
    return {
      ...descriptor,
      actualProvider: plan.providerId,
      requestFingerprint: verifiedProviderRequestFingerprint(descriptor),
      result: VerifiedMarketProviderAttemptResult.Succeeded,
      receivedAt: relativeTimestamp(timing.asOf, -5),
      responseSourceReference: `fixture-response:${request.requestId}`,
      dataOrigin: VerifiedMarketDataOrigin.Fixture,
      adapterUnderTest: "adapter:alpaca-personal-normalizer",
    };
  });
  const benchmarkDescriptor = {
    requestAttemptId:
      "request-attempt:personal-daily-scan:fixture:benchmark-bars:P1D",
    requestId: "personal-daily-scan:fixture:benchmark-bars:P1D",
    requestedProvider: "provider:fixture-synthetic",
    capability: VerifiedMarketProviderCapability.Bars,
    interval: BarInterval.OneDay,
    requestedSymbolScope: ["QQQ", "SMH"],
    mappingRegistryId,
    mappingRegistryVersion,
    mappingRegistryFingerprint,
    requestWindowStart: marketOpen(timing.selectedSessionDate),
    requestWindowEnd: timing.asOf,
  };
  const attempts = [
    ...requestAttempts,
    {
      ...benchmarkDescriptor,
      actualProvider: benchmarkDescriptor.requestedProvider,
      requestFingerprint:
        verifiedProviderRequestFingerprint(benchmarkDescriptor),
      result: VerifiedMarketProviderAttemptResult.Succeeded,
      receivedAt: relativeTimestamp(timing.asOf, -5),
      responseSourceReference:
        "fixture-response:personal-daily-scan:fixture:benchmark-bars:P1D",
      dataOrigin: VerifiedMarketDataOrigin.Fixture,
      adapterUnderTest: "fixture-benchmark-adapter",
    },
  ].map((attempt, index) => ({ ...attempt, attemptOrder: index + 1 }));
  const resolutions = [...bars, ...quotes]
    .map((entry) => {
      const benchmark = entry.source.providerId === "provider:fixture-synthetic";
      const capability =
        "barId" in entry
          ? VerifiedMarketProviderCapability.Bars
          : VerifiedMarketProviderCapability.LatestQuote;
      const interval = "barId" in entry ? entry.interval : undefined;
      const attempt = attempts.find(
        (candidate) =>
          candidate.requestedProvider === entry.source.providerId &&
          candidate.capability === capability &&
          candidate.interval === interval,
      )!;
      const evidenceId = "barId" in entry ? entry.barId : entry.quoteId;
      const providerSymbol = entry.instrument.displaySymbol;
      const providerSymbolMappingVersion = benchmark
        ? "fixture-benchmark:1.0"
        : "personal-watchlist:1.1";
      const providerSymbolMappingFingerprint =
        verifiedProviderSymbolMappingFingerprint({
          canonicalInstrumentId: entry.instrument.instrumentId,
          providerSymbol,
          providerSymbolMappingVersion,
        });
      const resolution = {
        resolutionId: `evidence-resolution:${evidenceId}`,
        result: VerifiedMarketEvidenceResolutionResult.Resolved,
        requestAttemptId: attempt.requestAttemptId,
        evidenceId,
        evidenceFingerprint: entry.fingerprint,
        canonicalInstrumentId: entry.instrument.instrumentId,
        providerSymbol,
        providerSymbolMappingVersion,
        providerSymbolMappingFingerprint,
        mappingRegistryId,
        mappingRegistryVersion,
        mappingRegistryFingerprint,
        capability,
        ...(interval === undefined ? {} : { interval }),
        evidenceWindowStart:
          "barId" in entry ? entry.intervalStart : entry.observationTime,
        evidenceWindowEnd:
          "barId" in entry ? entry.intervalEnd : entry.observationTime,
        observedAt: entry.observationTime,
        provenanceReference: entry.source.sourceReference,
        responseSourceReference: attempt.responseSourceReference,
      };
      return {
        ...resolution,
        resolutionFingerprint:
          verifiedEvidenceResolutionFingerprint(resolution),
      };
    })
    .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));
  return {
    providerRequestAttempts: attempts,
    evidenceResolutions: resolutions,
  } as const;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>))
      deepFreeze(nested);
  }
  return value;
}

function marketOpen(sessionDate: string): string {
  return sessionTime(sessionDate, "13:30:00.000Z");
}

function marketClose(sessionDate: string): string {
  return sessionTime(sessionDate, "20:00:00.000Z");
}

function sessionTime(sessionDate: string, utcTime: string): string {
  return `${sessionDate}T${utcTime}`;
}

function relativeTimestamp(timestamp: string, offsetSeconds: number): string {
  return new Date(
    Date.parse(timestamp) + offsetSeconds * 1_000,
  ).toISOString();
}
