import {
  CANONICAL_BAR_SCHEMA_VERSION,
  BarAdjustmentState,
  BarDeliveryTiming,
  BarDerivationStatus,
  BarFreshnessStatus,
  BarInterval,
  BarMarketCoverage,
  BarQualityReasonCode,
  BarQuantityUnit,
  BarSessionType,
  CanonicalBarStatus,
  type BarDecimal,
} from "../../../contracts/CanonicalBar";
import {
  CANONICAL_QUOTE_SCHEMA_VERSION,
  CanonicalQuoteStatus,
  QuoteQualityReasonCode,
  QuoteQuantityUnit,
  type QuoteDecimal,
} from "../../../contracts/CanonicalQuote";
import { createCanonicalBar, canonicalBarIntervalDurationMs } from "../../../engines/canonical-bar/CanonicalBar";
import { createCanonicalQuote } from "../../../engines/canonical-quote/CanonicalQuote";
import { createResearchVerifiedPersonalWatchlistCatalog } from "../../../engines/personal-watchlist-mapping/PersonalWatchlistMappingRegistry";
import {
  ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
  AlpacaPersonalIssueCode,
  AlpacaPersonalRequestKind,
  AlpacaPersonalResponseStatus,
  type AlpacaPersonalBarNormalizationContext,
  type AlpacaPersonalDailyBarBoundary,
  type AlpacaPersonalInstrumentMapping,
  type AlpacaPersonalIssue,
  type AlpacaPersonalNormalizationResult,
  type AlpacaPersonalQuoteNormalizationContext,
} from "./AlpacaPersonalMarketDataContracts";
import { ALPACA_PERSONAL_EXACT_SYMBOLS } from "./AlpacaPersonalMarketDataPlanner";

export const ALPACA_PERSONAL_MARKET_DATA_ADAPTER_ID = "adapter:alpaca-personal-market-data" as const;
const DECIMAL = /^(\d+)(?:\.(\d+))?$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._/-]{2,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

export function createAlpacaPersonalInstrumentMappings(): readonly AlpacaPersonalInstrumentMapping[] {
  const catalog = createResearchVerifiedPersonalWatchlistCatalog();
  const bySymbol = new Map<string, AlpacaPersonalInstrumentMapping>();
  for (const mapping of catalog.mappings) {
    for (const instrument of [mapping.analysisInstrument, mapping.tradeVehicle]) {
      bySymbol.set(instrument.displaySymbol, {
        symbol: instrument.displaySymbol,
        canonicalInstrument: instrument,
      });
    }
  }
  const mappings = ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => bySymbol.get(symbol));
  if (mappings.some((entry) => entry === undefined)) throw new Error("Personal Alpaca instrument mapping catalog is incomplete.");
  return deepFreeze(mappings as AlpacaPersonalInstrumentMapping[]);
}

export function normalizeAlpacaPersonalQuotes(
  context: Readonly<AlpacaPersonalQuoteNormalizationContext>,
): AlpacaPersonalNormalizationResult {
  const common = validateCommon(context, AlpacaPersonalRequestKind.LatestQuotes);
  if (common.length > 0) return rejected(common);
  const mapping = mappingIndex(context.mappings);
  const quotes = [];
  try {
    for (const row of context.response.quotes) {
      const instrument = mapping.get(row.symbol);
      if (instrument === undefined) return rejected([issue(AlpacaPersonalIssueCode.UnexpectedSymbol, row.symbol, "No exact canonical instrument mapping exists.")]);
      const observationTime = canonicalTimestamp(row.timestamp);
      const ageMs = Date.parse(context.evaluatedAt) - Date.parse(observationTime);
      if (ageMs < 0) return rejected([issue(AlpacaPersonalIssueCode.InvalidQuote, row.symbol, "Quote observation follows evaluation time.")]);
      const stale = ageMs > context.policy.quoteMaxAgeSeconds * 1_000;
      const sourceContent = {
        requestId: context.requestId,
        coverage: "SINGLE_VENUE",
        feed: "iex",
        row,
      };
      quotes.push(createCanonicalQuote({
        schemaVersion: CANONICAL_QUOTE_SCHEMA_VERSION,
        instrument,
        value: {
          bidPrice: fixedDecimal(row.bidPrice),
          askPrice: fixedDecimal(row.askPrice),
          bidSize: roundLotsToBaseUnits(row.bidSizeRoundLots, context.policy.roundLotSize),
          askSize: roundLotsToBaseUnits(row.askSizeRoundLots, context.policy.roundLotSize),
          quantityUnit: QuoteQuantityUnit.BaseUnits,
        },
        currency: instrument.currency,
        status: stale ? CanonicalQuoteStatus.Stale : CanonicalQuoteStatus.Current,
        observationTime,
        receivedAt: context.receivedAt,
        normalizedAt: context.normalizedAt,
        quality: {
          policyId: context.policy.policyId,
          policyVersion: context.policy.version,
          evaluatedAt: context.evaluatedAt,
          maxAgeSeconds: context.policy.quoteMaxAgeSeconds,
          reasonCodes: stale ? [QuoteQualityReasonCode.StaleObservation] : [],
        },
        source: {
          providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
          adapterId: ALPACA_PERSONAL_MARKET_DATA_ADAPTER_ID,
          adapterVersion: "1.0",
          providerInstrumentId: `alpaca:${row.symbol}`,
          providerSymbol: row.symbol,
          sourceReference: `alpaca-iex-quote:${context.requestId}:${row.symbol}:${observationTime}`,
          contentIntegrityReference: `fnv1a64:${fnv1a64(canonicalize(sourceContent))}`,
        },
      }));
    }
  } catch {
    return rejected([issue(AlpacaPersonalIssueCode.InvalidQuote, "quotes", "Validated provider quote failed Canonical construction.")]);
  }
  return deepFreeze({
    status: "NORMALIZED",
    providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
    quotes: quotes.sort((left, right) => left.instrument.displaySymbol.localeCompare(right.instrument.displaySymbol)),
    bars: [],
    blockers: [],
    warnings: ["IEX quotes are single-venue observations and are not NBBO."],
  });
}

export function normalizeAlpacaPersonalBars(
  context: Readonly<AlpacaPersonalBarNormalizationContext>,
): AlpacaPersonalNormalizationResult {
  const common = validateCommon(context, AlpacaPersonalRequestKind.Bars);
  if (common.length > 0) return rejected(common);
  if (!Object.values(BarInterval).includes(context.interval)
    || !isTimestamp(context.requestStartTime) || !isTimestamp(context.requestEndTime)
    || Date.parse(context.requestStartTime) >= Date.parse(context.requestEndTime)) {
    return rejected([issue(AlpacaPersonalIssueCode.InvalidWindow, "requestWindow", "Bar request interval or window is invalid.")]);
  }
  const mapping = mappingIndex(context.mappings);
  const boundaryIndex = dailyBoundaryIndex(context.dailyBoundaries);
  const bars = [];
  const closureThreshold = Date.parse(context.receivedAt) - context.policy.closureBufferSeconds * 1_000;
  try {
    for (const row of context.response.bars) {
      const instrument = mapping.get(row.symbol);
      if (instrument === undefined) return rejected([issue(AlpacaPersonalIssueCode.UnexpectedSymbol, row.symbol, "No exact canonical instrument mapping exists.")]);
      const intervalStart = canonicalTimestamp(row.timestamp);
      const intervalEnd = resolveIntervalEnd(context.interval, row.symbol, intervalStart, boundaryIndex);
      if (intervalEnd === undefined) {
        return rejected([issue(AlpacaPersonalIssueCode.InvalidBar, row.symbol, "Daily Bar requires an exact reviewed session boundary.")]);
      }
      if (Date.parse(intervalEnd) > closureThreshold) {
        return rejected([issue(AlpacaPersonalIssueCode.InvalidBar, row.symbol, "Current or not-yet-closed Bar is rejected.")]);
      }
      if (Date.parse(intervalStart) < Date.parse(context.requestStartTime)
        || Date.parse(intervalStart) > Date.parse(context.requestEndTime)) {
        return rejected([issue(AlpacaPersonalIssueCode.InvalidWindow, row.symbol, "Provider Bar lies outside the exact request window.")]);
      }
      const ageMs = Date.parse(context.evaluatedAt) - Date.parse(intervalEnd);
      const maximumAge = context.policy.barMaxAgeSeconds[context.interval];
      if (!Number.isSafeInteger(maximumAge) || maximumAge < 0 || ageMs < 0) {
        return rejected([issue(AlpacaPersonalIssueCode.InvalidBar, row.symbol, "Bar freshness policy or chronology is invalid.")]);
      }
      const stale = ageMs > maximumAge * 1_000;
      const boundary = boundaryIndex.get(`${row.symbol}|${intervalStart}`);
      const sourceContent = {
        requestId: context.requestId,
        interval: context.interval,
        coverage: "SINGLE_VENUE",
        feed: "iex",
        row,
        ...(boundary === undefined ? {} : { boundary }),
      };
      bars.push(createCanonicalBar({
        schemaVersion: CANONICAL_BAR_SCHEMA_VERSION,
        instrument,
        interval: context.interval,
        intervalStart,
        intervalEnd,
        observationTime: intervalEnd,
        receivedAt: context.receivedAt,
        normalizedAt: context.normalizedAt,
        value: {
          open: fixedDecimal(row.open),
          high: fixedDecimal(row.high),
          low: fixedDecimal(row.low),
          close: fixedDecimal(row.close),
          volume: fixedDecimal(row.volume),
        },
        currency: instrument.currency,
        quantityUnit: BarQuantityUnit.BaseUnits,
        status: CanonicalBarStatus.Final,
        session: {
          sessionType: BarSessionType.Combined,
          sessionDate: boundary?.sessionDate ?? intervalStart.slice(0, 10),
          timezone: "America/New_York",
        },
        adjustment: BarAdjustmentState.Raw,
        quality: {
          policyId: context.policy.policyId,
          policyVersion: context.policy.version,
          evaluatedAt: context.evaluatedAt,
          maxAgeSeconds: maximumAge,
          freshness: stale ? BarFreshnessStatus.Stale : BarFreshnessStatus.Current,
          deliveryTiming: BarDeliveryTiming.RealTime,
          marketCoverage: BarMarketCoverage.SingleVenue,
          derivation: BarDerivationStatus.ProviderReported,
          reasonCodes: stale ? [BarQualityReasonCode.StaleInterval] : [],
        },
        source: {
          providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
          adapterId: ALPACA_PERSONAL_MARKET_DATA_ADAPTER_ID,
          adapterVersion: "1.0",
          sourceReference: `alpaca-iex-bar:${context.requestId}:${row.symbol}:${context.interval}:${intervalStart}`,
          contentIntegrityReference: `fnv1a64:${fnv1a64(canonicalize(sourceContent))}`,
        },
      }));
    }
  } catch {
    return rejected([issue(AlpacaPersonalIssueCode.InvalidBar, "bars", "Validated provider Bar failed Canonical construction.")]);
  }
  return deepFreeze({
    status: "NORMALIZED",
    providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
    quotes: [],
    bars: bars.sort((left, right) => left.instrument.displaySymbol.localeCompare(right.instrument.displaySymbol)
      || left.intervalStart.localeCompare(right.intervalStart)),
    blockers: [],
    warnings: ["IEX volume is single-venue share volume and is not consolidated US market volume."],
  });
}

function validateCommon(
  context: Readonly<AlpacaPersonalQuoteNormalizationContext | AlpacaPersonalBarNormalizationContext>,
  kind: AlpacaPersonalRequestKind,
): AlpacaPersonalIssue[] {
  const issues: AlpacaPersonalIssue[] = [];
  if (context.response.status !== AlpacaPersonalResponseStatus.Valid
    || context.response.kind !== kind
    || context.response.feed !== "iex"
    || context.response.coverage !== "SINGLE_VENUE") {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidInput, "response", "Only a valid exact IEX single-venue response can be normalized."));
  }
  if (!IDENTIFIER.test(context.requestId)
    || !isTimestamp(context.receivedAt) || !isTimestamp(context.normalizedAt) || !isTimestamp(context.evaluatedAt)
    || Date.parse(context.normalizedAt) < Date.parse(context.receivedAt)
    || Date.parse(context.evaluatedAt) < Date.parse(context.normalizedAt)) {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidInput, "timestamps", "Receipt, normalization, and evaluation chronology is invalid."));
  }
  if (!IDENTIFIER.test(context.policy.policyId) || !VERSION.test(context.policy.version)
    || !Number.isSafeInteger(context.policy.closureBufferSeconds) || context.policy.closureBufferSeconds < 0
    || !Number.isSafeInteger(context.policy.quoteMaxAgeSeconds) || context.policy.quoteMaxAgeSeconds < 0
    || context.policy.roundLotSize !== 100) {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidInput, "policy", "Normalization policy is invalid."));
  }
  if (!exactMappings(context.mappings)) {
    issues.push(issue(AlpacaPersonalIssueCode.SymbolSetMismatch, "mappings", "Mappings must bind the exact 11-symbol personal set."));
  }
  return issues;
}

function exactMappings(mappings: readonly AlpacaPersonalInstrumentMapping[]): boolean {
  return mappings.length === ALPACA_PERSONAL_EXACT_SYMBOLS.length
    && mappings.every((entry, index) =>
      entry.symbol === ALPACA_PERSONAL_EXACT_SYMBOLS[index]
      && entry.canonicalInstrument.displaySymbol === entry.symbol);
}

function mappingIndex(mappings: readonly AlpacaPersonalInstrumentMapping[]) {
  return new Map(mappings.map((entry) => [entry.symbol, entry.canonicalInstrument] as const));
}

function dailyBoundaryIndex(boundaries: readonly AlpacaPersonalDailyBarBoundary[]) {
  return new Map(boundaries.map((entry) => [`${entry.symbol}|${entry.intervalStart}`, entry] as const));
}

function resolveIntervalEnd(
  interval: BarInterval,
  symbol: string,
  intervalStart: string,
  boundaries: ReadonlyMap<string, AlpacaPersonalDailyBarBoundary>,
): string | undefined {
  if (interval === BarInterval.OneDay) {
    const boundary = boundaries.get(`${symbol}|${intervalStart}`);
    if (boundary === undefined
      || !isTimestamp(boundary.intervalStart) || !isTimestamp(boundary.intervalEnd)
      || boundary.intervalStart !== intervalStart
      || Date.parse(boundary.intervalEnd) <= Date.parse(intervalStart)
      || !/^\d{4}-\d{2}-\d{2}$/u.test(boundary.sessionDate)) return undefined;
    return boundary.intervalEnd;
  }
  const duration = canonicalBarIntervalDurationMs(interval);
  return duration === undefined ? undefined : new Date(Date.parse(intervalStart) + duration).toISOString();
}

function canonicalTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("invalid timestamp");
  return new Date(parsed).toISOString();
}

function roundLotsToBaseUnits(value: string, roundLotSize: 100): QuoteDecimal {
  if (!/^\d+$/u.test(value)) throw new Error("invalid round lots");
  return { atomicValue: (BigInt(value) * BigInt(roundLotSize)).toString(), scale: 0 };
}

function fixedDecimal(value: string): BarDecimal {
  const match = DECIMAL.exec(value);
  if (match === null) throw new Error("invalid decimal");
  return { atomicValue: `${match[1] ?? ""}${match[2] ?? ""}`, scale: (match[2] ?? "").length };
}

function rejected(blockers: readonly AlpacaPersonalIssue[]): AlpacaPersonalNormalizationResult {
  return deepFreeze({
    status: "REJECTED",
    providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
    quotes: [],
    bars: [],
    blockers: [...blockers].sort((left, right) => `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`)),
    warnings: [],
  });
}

function issue(code: AlpacaPersonalIssueCode, field: string, message: string): AlpacaPersonalIssue {
  return { code, field, message };
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
