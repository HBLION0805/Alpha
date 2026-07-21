import {
  CANONICAL_BAR_SCHEMA_VERSION,
  BarAdjustmentState,
  BarDeliveryTiming,
  BarDerivationStatus,
  BarFreshnessStatus,
  BarMarketCoverage,
  BarQualityReasonCode,
  BarQuantityUnit,
  BarSessionType,
  CanonicalBarStatus,
  type BarDecimal,
  type CanonicalBar,
} from "../../../contracts/CanonicalBar";
import {
  MarketDataIssueCode,
  type MarketDataBarRequest,
  type MarketDataNormalizationIssue,
} from "../../../contracts/MarketData";
import {
  TWELVE_DATA_ADAPTER_ID,
  TWELVE_DATA_PROVIDER_ID,
  TwelveDataTransportKind,
  TwelveDataValidationIssueCode,
  TwelveDataVolumeEvidenceStatus,
  type TwelveDataInstrumentMapping,
  type TwelveDataNormalizationPolicy,
  type TwelveDataNormalizationResult,
  type TwelveDataValidatedResponse,
} from "../../../contracts/TwelveDataAdapter";
import { canonicalBarIntervalDurationMs, createCanonicalBar } from "../../../engines/canonical-bar/CanonicalBar";
import { parseTwelveDataUtcDateTime } from "./TwelveDataResponseValidator";

const DECIMAL = /^(\d+)(?:\.(\d+))?$/u;

export interface TwelveDataBarNormalizationContext {
  readonly request: MarketDataBarRequest;
  readonly mapping: TwelveDataInstrumentMapping;
  readonly response: TwelveDataValidatedResponse;
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly transportKind: TwelveDataTransportKind;
  readonly policy: TwelveDataNormalizationPolicy;
}

/** Maps explicit provider fields into Canonical Bars and rejects ambiguity. */
export function normalizeTwelveDataBars(context: Readonly<TwelveDataBarNormalizationContext>): TwelveDataNormalizationResult {
  if (context.transportKind === TwelveDataTransportKind.Live
    && context.policy.volumeEvidenceStatus !== TwelveDataVolumeEvidenceStatus.OfficiallyVerified) {
    return rejected(issue(MarketDataIssueCode.AmbiguousUnits, "Live equity volume unit is not officially verified."));
  }
  if (context.transportKind === TwelveDataTransportKind.Fixture
    && context.policy.volumeEvidenceStatus === TwelveDataVolumeEvidenceStatus.Unresolved) {
    return rejected(issue(MarketDataIssueCode.AmbiguousUnits, "Fixture volume unit is not explicitly reviewed."));
  }

  const durationMs = canonicalBarIntervalDurationMs(context.request.interval);
  if (durationMs === undefined) return rejected(issue(MarketDataIssueCode.NormalizationRejected, "Bar interval is unsupported."));
  const receivedMs = Date.parse(context.receivedAt);
  const closureMs = context.policy.closureBufferSeconds * 1000;
  const bars: CanonicalBar[] = [];

  try {
    for (const row of context.response.values) {
      const intervalStart = parseTwelveDataUtcDateTime(row.datetime);
      if (intervalStart === undefined) return rejected(issue(MarketDataIssueCode.InvalidTimestamp, "Provider datetime is ambiguous."));
      const intervalEnd = new Date(Date.parse(intervalStart) + durationMs).toISOString();
      if (Date.parse(intervalEnd) > receivedMs - closureMs) {
        return rejected(issue(MarketDataIssueCode.StaleObservation, "Current or not-yet-closed provider bar is rejected."));
      }
      if (Date.parse(intervalStart) < Date.parse(context.request.startTime)
        || Date.parse(intervalStart) > Date.parse(context.request.endTime)) {
        return rejected(issue(MarketDataIssueCode.InvalidRequestWindow, "Provider bar lies outside the requested window."));
      }

      const open = decimal(row.open);
      const high = decimal(row.high);
      const low = decimal(row.low);
      const close = decimal(row.close);
      const volume = decimal(row.volume);
      const freshness = Date.parse(context.request.evaluatedAt) - Date.parse(intervalEnd) > context.policy.maxAgeSeconds * 1000
        ? BarFreshnessStatus.Stale
        : BarFreshnessStatus.Current;
      const reasonCodes = freshness === BarFreshnessStatus.Stale ? [BarQualityReasonCode.StaleInterval] : [];
      const sourceReference = [
        "twelve-data-bar:v1",
        TWELVE_DATA_PROVIDER_ID,
        context.mapping.canonicalInstrument.instrumentId,
        context.mapping.providerExchangeId,
        context.request.interval,
        intervalStart,
        "regular-only",
        "raw",
      ].join(":");
      bars.push(createCanonicalBar({
        schemaVersion: CANONICAL_BAR_SCHEMA_VERSION,
        instrument: context.mapping.canonicalInstrument,
        interval: context.request.interval,
        intervalStart,
        intervalEnd,
        observationTime: intervalEnd,
        receivedAt: context.receivedAt,
        normalizedAt: context.normalizedAt,
        value: { open, high, low, close, volume },
        currency: context.mapping.canonicalInstrument.currency,
        quantityUnit: BarQuantityUnit.BaseUnits,
        status: CanonicalBarStatus.Final,
        session: {
          sessionType: BarSessionType.Unknown,
          sessionDate: intervalStart.slice(0, 10),
          timezone: "UTC",
        },
        adjustment: BarAdjustmentState.Raw,
        quality: {
          policyId: context.policy.policyId,
          policyVersion: context.policy.version,
          evaluatedAt: context.request.evaluatedAt,
          maxAgeSeconds: context.policy.maxAgeSeconds,
          freshness,
          deliveryTiming: BarDeliveryTiming.Delayed,
          marketCoverage: BarMarketCoverage.PartialMarket,
          derivation: BarDerivationStatus.ProviderReported,
          reasonCodes,
        },
        source: {
          providerId: TWELVE_DATA_PROVIDER_ID,
          adapterId: TWELVE_DATA_ADAPTER_ID,
          adapterVersion: "1.0",
          sourceReference,
          contentIntegrityReference: `fnv1a64:${fnv1a64(canonicalize(row))}`,
        },
      }));
    }
  } catch {
    return rejected(issue(MarketDataIssueCode.NormalizationRejected, "Provider bar failed canonical validation."));
  }

  const ordered = bars.sort((left, right) => left.intervalStart.localeCompare(right.intervalStart) || left.barId.localeCompare(right.barId));
  const byId = new Map<string, string>();
  for (const bar of ordered) {
    const prior = byId.get(bar.barId);
    if (prior !== undefined && prior !== bar.fingerprint) {
      return rejected(issue(MarketDataIssueCode.ConflictingFields, "Provider returned conflicting content for one logical bar."));
    }
    byId.set(bar.barId, bar.fingerprint);
  }
  const unique = ordered.filter((bar, index) => ordered.findIndex((candidate) => candidate.barId === bar.barId) === index);
  return deepFreeze({ providerId: TWELVE_DATA_PROVIDER_ID, status: "NORMALIZED", bars: unique, blockers: [], warnings: [] });
}

function decimal(value: string): BarDecimal {
  const match = DECIMAL.exec(value);
  if (!match) throw new Error(TwelveDataValidationIssueCode.InvalidRow);
  return { atomicValue: `${match[1] ?? ""}${match[2] ?? ""}`, scale: (match[2] ?? "").length };
}

function rejected(blocker: MarketDataNormalizationIssue): TwelveDataNormalizationResult {
  return deepFreeze({ providerId: TWELVE_DATA_PROVIDER_ID, status: "REJECTED", bars: [], blockers: [blocker], warnings: [] });
}

function issue(code: MarketDataIssueCode, message: string): MarketDataNormalizationIssue {
  return { code, message };
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
