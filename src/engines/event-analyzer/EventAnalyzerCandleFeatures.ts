import {
  EVENT_ANALYZER_CANDLE_SERIES_SCHEMA_VERSION,
  EVENT_ANALYZER_INSTRUMENT_ID,
  EVENT_ANALYZER_MAX_ATOMIC_DIGITS,
  EVENT_ANALYZER_MAX_DECIMAL_SCALE,
  EventAnalyzerCandleEvidenceQuality,
  EventAnalyzerCandleInterval,
  EventAnalyzerCloseLocation,
  EventAnalyzerContradictionFlag,
  EventAnalyzerDerivedMomentum,
  EventAnalyzerFeatureStatus,
  EventAnalyzerRangeExpansion,
  EventAnalyzerReversalRisk,
  EventAnalyzerValidationIssueCode,
  EventAnalyzerVolumeConfirmation,
  type EventAnalyzerCandleAnalysis,
  type EventAnalyzerCandleSeries,
  type EventAnalyzerFixedDecimal,
  type EventAnalyzerInput,
  type EventAnalyzerOneMinuteCandle,
  type EventAnalyzerPolicy,
  type EventAnalyzerValidationIssue,
} from "../../contracts/EventAnalyzer";

const INTEGER = /^-?(?:0|[1-9]\d*)$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const SERIES_KEYS = ["schemaVersion", "interval", "timestampSemantics", "eventId", "instrumentId", "asOfTime", "provenance", "candles"] as const;
const PROVENANCE_KEYS = ["sourceId", "sourceRecordId", "observationId"] as const;
const CANDLE_KEYS = ["timestamp", "open", "high", "low", "close", "volume"] as const;

export function analyzeEventCandles(series: unknown, input: Readonly<EventAnalyzerInput>, policy: Readonly<EventAnalyzerPolicy>): EventAnalyzerCandleAnalysis {
  const issues = validateSeries(series, input, policy);
  const candleCount = isRecord(series) && Array.isArray(series.candles) ? series.candles.length : 0;
  if (issues.length > 0) return unavailableAnalysis(candleCount, EventAnalyzerCandleEvidenceQuality.Invalid, issues, policy.ruleSetVersion);
  const candles = (series as EventAnalyzerCandleSeries).candles;
  if (candles.length < policy.minimumCandleCount) return unavailableAnalysis(candles.length, EventAnalyzerCandleEvidenceQuality.Insufficient, [
    issue(EventAnalyzerValidationIssueCode.InvalidCandleCount, "candleSeries.candles", `At least ${String(policy.minimumCandleCount)} one-minute candles are required.`),
  ], policy.ruleSetVersion);

  try {
  const returns = candles.slice(1).map((candle, index) => changeBasisPoints(candles[index]!.close, candle.close));
  const recentReturn = changeBasisPoints(candles[0]!.close, candles.at(-1)!.close);
  const short = windowReturn(candles, policy.shortWindowCandles);
  const medium = windowReturn(candles, policy.mediumWindowCandles);
  const averageAbsoluteReturn = average(returns.map(Math.abs));
  const directions = candles.map(candleDirection);
  const bullishCount = directions.filter((value) => value > 0).length;
  const bearishCount = directions.filter((value) => value < 0).length;
  const consecutiveBullish = endingCount(directions, 1);
  const consecutiveBearish = endingCount(directions, -1);
  const pressure = bodyPressure(candles);
  const closeLocation = closeLocationBehavior(candles, policy);
  const rangeExpansion = rangeExpansionStatus(candles, policy);
  const upsideAcceleration = accelerationStatus(returns, 1, policy);
  const downsideAcceleration = accelerationStatus(returns, -1, policy);
  const volumeConfirmation = relativeVolumeConfirmation(candles, short, policy);
  const reversalRisk = reversalStatus(candles, short, consecutiveBullish, consecutiveBearish, policy);
  const derivedMomentum = classifyMomentum(short, medium, pressure, consecutiveBullish, consecutiveBearish, upsideAcceleration, downsideAcceleration, reversalRisk, policy);
  const contradictionFlags = generalContradictions(derivedMomentum, reversalRisk);

  return deepFreeze({
    candleCount: candles.length,
    evidenceQuality: EventAnalyzerCandleEvidenceQuality.Sufficient,
    recentReturnBasisPoints: recentReturn,
    shortReturnBasisPoints: short,
    mediumReturnBasisPoints: medium,
    averageAbsoluteReturnBasisPoints: averageAbsoluteReturn,
    bullishCandleCount: bullishCount,
    bearishCandleCount: bearishCount,
    consecutiveBullishCount: consecutiveBullish,
    consecutiveBearishCount: consecutiveBearish,
    bullishBodyPressureBasisPoints: pressure.bullish,
    bearishBodyPressureBasisPoints: pressure.bearish,
    closeLocationBehavior: closeLocation,
    recentRangeExpansion: rangeExpansion,
    upsideAcceleration,
    downsideAcceleration,
    volumeConfirmation,
    reversalRisk,
    derivedMomentum,
    contradictionFlags,
    issues: [],
    featureVersion: "2.0",
    ruleVersion: policy.ruleSetVersion,
  });
  } catch {
    return unavailableAnalysis(candles.length, EventAnalyzerCandleEvidenceQuality.Invalid, [
      issue(EventAnalyzerValidationIssueCode.UnsafeNumericValue, "candleSeries", "Candle calculations exceed the bounded deterministic integer domain."),
    ], policy.ruleSetVersion);
  }
}

export function legacyCandleAnalysis(ruleVersion: string): EventAnalyzerCandleAnalysis {
  return deepFreeze({
    ...emptyAnalysis(),
    evidenceQuality: EventAnalyzerCandleEvidenceQuality.LegacyCoarse,
    contradictionFlags: [EventAnalyzerContradictionFlag.LegacyCoarseMomentumOnly],
    issues: [],
    featureVersion: "2.0",
    ruleVersion,
  });
}

function validateSeries(value: unknown, input: Readonly<EventAnalyzerInput>, policy: Readonly<EventAnalyzerPolicy>): readonly EventAnalyzerValidationIssue[] {
  const issues: EventAnalyzerValidationIssue[] = [];
  if (!isRecord(value)) return [issue(EventAnalyzerValidationIssueCode.InvalidCandleSeries, "candleSeries", "Candle series must be an object.")];
  validateExactKeys(issues, value, SERIES_KEYS, "candleSeries");
  if (value.schemaVersion !== EVENT_ANALYZER_CANDLE_SERIES_SCHEMA_VERSION) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleSeries, "candleSeries.schemaVersion", "Candle-series schema version is unsupported."));
  if (value.interval !== EventAnalyzerCandleInterval.OneMinute) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleInterval, "candleSeries.interval", "Only PT1M candles are supported."));
  if (value.timestampSemantics !== "INTERVAL_START") issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleTimestamp, "candleSeries.timestampSemantics", "PT1M timestamps must represent interval start."));
  if (value.instrumentId !== EVENT_ANALYZER_INSTRUMENT_ID || value.instrumentId !== input.instrumentId) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidObservationContext, "candleSeries.instrumentId", "Candle and current-price instrument identity must match BTC-USD."));
  if (typeof value.eventId !== "string" || !IDENTIFIER.test(value.eventId) || value.eventId !== input.eventId) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidObservationContext, "candleSeries.eventId", "Candle and current-price event identity must match."));
  const asOf = timestamp(value.asOfTime);
  if (asOf === null) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleTimestamp, "candleSeries.asOfTime", "asOfTime must be an explicit canonical UTC timestamp."));
  const observation = timestamp(input.observationTime);
  if (asOf !== null && observation !== null && asOf !== observation) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidObservationContext, "candleSeries.asOfTime", "Candle asOfTime must equal the authoritative observation time."));
  if (!isRecord(value.provenance)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, "candleSeries.provenance", "Bounded provenance is required."));
  else {
    validateExactKeys(issues, value.provenance, PROVENANCE_KEYS, "candleSeries.provenance", EventAnalyzerValidationIssueCode.InvalidProvenance);
    for (const field of ["sourceId", "sourceRecordId", "observationId"] as const) if (typeof value.provenance[field] !== "string" || !IDENTIFIER.test(value.provenance[field])) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, `candleSeries.provenance.${field}`, "Provenance identity is invalid."));
    if (value.provenance.sourceId !== input.currentPriceSourceId) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, "candleSeries.provenance.sourceId", "Candle and current-price source identity must match."));
    if (value.provenance.sourceRecordId !== input.currentPriceSourceRecordId) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, "candleSeries.provenance.sourceRecordId", "Candle and current-price source-record identity must match."));
    if (value.provenance.observationId !== input.currentPriceObservationId) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidProvenance, "candleSeries.provenance.observationId", "Candle and current-price observation identity must match."));
  }
  if (!Array.isArray(value.candles)) return sortIssues([...issues, issue(EventAnalyzerValidationIssueCode.InvalidCandleSeries, "candleSeries.candles", "Candles must be an array.")]);
  if (value.candles.length > policy.maximumCandleCount) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleCount, "candleSeries.candles", `At most ${String(policy.maximumCandleCount)} candles are allowed.`));
  const seen = new Set<string>();
  let previous: number | null = null;
  value.candles.forEach((entry, index) => {
    const field = `candleSeries.candles[${String(index)}]`;
    if (!isRecord(entry)) { issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleSeries, field, "Candle must be an object.")); return; }
    validateExactKeys(issues, entry, CANDLE_KEYS, field);
    const observed = timestamp(entry.timestamp);
    if (observed === null) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleTimestamp, `${field}.timestamp`, "Timestamp must be explicit canonical UTC."));
    if (typeof entry.timestamp === "string") {
      if (seen.has(entry.timestamp)) issues.push(issue(EventAnalyzerValidationIssueCode.DuplicateCandleTimestamp, `${field}.timestamp`, "Duplicate candle timestamp is not allowed."));
      seen.add(entry.timestamp);
    }
    if (observed !== null && asOf !== null && observed > asOf) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleTimestamp, `${field}.timestamp`, "Candle timestamp cannot be after asOfTime."));
    if (observed !== null && previous !== null) {
      if (observed <= previous) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleChronology, `${field}.timestamp`, "Candles must be strictly chronological."));
      else if (observed - previous !== 60_000) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleInterval, `${field}.timestamp`, "Adjacent PT1M candles must be exactly 60 seconds apart."));
    }
    if (observed !== null) previous = observed;
    const prices = [entry.open, entry.high, entry.low, entry.close];
    if (!prices.every(isPositiveDecimal)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidPrice, field, "OHLC values must be positive fixed decimals."));
    else if (compareDecimal(entry.high as EventAnalyzerFixedDecimal, entry.open as EventAnalyzerFixedDecimal) < 0
      || compareDecimal(entry.high as EventAnalyzerFixedDecimal, entry.close as EventAnalyzerFixedDecimal) < 0
      || compareDecimal(entry.low as EventAnalyzerFixedDecimal, entry.open as EventAnalyzerFixedDecimal) > 0
      || compareDecimal(entry.low as EventAnalyzerFixedDecimal, entry.close as EventAnalyzerFixedDecimal) > 0
      || compareDecimal(entry.high as EventAnalyzerFixedDecimal, entry.low as EventAnalyzerFixedDecimal) < 0) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleOhlc, field, "Candle OHLC relationships are invalid."));
    if (entry.volume !== null && !isNonNegativeDecimal(entry.volume)) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleVolume, `${field}.volume`, "Volume must be a non-negative fixed decimal or explicit null."));
  });
  const finalEntry = value.candles.at(-1);
  if (isRecord(finalEntry) && asOf !== null) {
    const finalTime = timestamp(finalEntry.timestamp);
    if (finalTime !== null && finalTime !== asOf - 60_000) issues.push(issue(EventAnalyzerValidationIssueCode.InvalidCandleTimestamp, "candleSeries.candles.final.timestamp", "Final candle must be the immediately preceding completed PT1M interval."));
    if (isPositiveDecimal(finalEntry.close) && compareDecimal(finalEntry.close, input.currentPrice) !== 0) issues.push(issue(EventAnalyzerValidationIssueCode.CurrentPriceMismatch, "currentPrice", "Current price must exactly equal the latest accepted candle close after scale normalization."));
  }
  return sortIssues(issues);
}

function unavailableAnalysis(count: number, quality: EventAnalyzerCandleEvidenceQuality, issues: readonly EventAnalyzerValidationIssue[], ruleVersion: string): EventAnalyzerCandleAnalysis {
  return deepFreeze({
    ...emptyAnalysis(),
    candleCount: count,
    evidenceQuality: quality,
    contradictionFlags: [quality === EventAnalyzerCandleEvidenceQuality.Invalid ? EventAnalyzerContradictionFlag.CandleEvidenceInvalid : EventAnalyzerContradictionFlag.CandleEvidenceInsufficient],
    issues: sortIssues(issues),
    featureVersion: "2.0",
    ruleVersion,
  });
}

function emptyAnalysis() {
  return {
    candleCount: 0,
    recentReturnBasisPoints: null,
    shortReturnBasisPoints: null,
    mediumReturnBasisPoints: null,
    averageAbsoluteReturnBasisPoints: null,
    bullishCandleCount: 0,
    bearishCandleCount: 0,
    consecutiveBullishCount: 0,
    consecutiveBearishCount: 0,
    bullishBodyPressureBasisPoints: null,
    bearishBodyPressureBasisPoints: null,
    closeLocationBehavior: EventAnalyzerCloseLocation.Unavailable,
    recentRangeExpansion: EventAnalyzerRangeExpansion.Unavailable,
    upsideAcceleration: EventAnalyzerFeatureStatus.Unavailable,
    downsideAcceleration: EventAnalyzerFeatureStatus.Unavailable,
    volumeConfirmation: EventAnalyzerVolumeConfirmation.Unavailable,
    reversalRisk: EventAnalyzerReversalRisk.Unavailable,
    derivedMomentum: EventAnalyzerDerivedMomentum.InsufficientEvidence,
  } as const;
}

function windowReturn(candles: readonly EventAnalyzerOneMinuteCandle[], count: number): number { const window = candles.slice(-Math.min(count, candles.length)); return changeBasisPoints(window[0]!.close, window.at(-1)!.close); }
function candleDirection(candle: EventAnalyzerOneMinuteCandle): number { return compareDecimal(candle.close, candle.open); }
function endingCount(values: readonly number[], direction: 1 | -1): number { let count = 0; for (let index = values.length - 1; index >= 0 && values[index] === direction; index -= 1) count += 1; return count; }

function bodyPressure(candles: readonly EventAnalyzerOneMinuteCandle[]): { bullish: number; bearish: number } {
  const scale = Math.max(...candles.flatMap((candle) => [candle.open.scale, candle.close.scale]));
  let bullish = 0n; let bearish = 0n;
  for (const candle of candles) { const body = scaledAtomic(candle.close, scale) - scaledAtomic(candle.open, scale); if (body > 0n) bullish += body; else bearish -= body; }
  const total = bullish + bearish;
  if (total === 0n) return { bullish: 5_000, bearish: 5_000 };
  const bullishShare = safeBigIntToNumber((bullish * 10_000n) / total, "bodyPressure");
  return { bullish: bullishShare, bearish: 10_000 - bullishShare };
}

function closeLocationBehavior(candles: readonly EventAnalyzerOneMinuteCandle[], policy: EventAnalyzerPolicy): EventAnalyzerCloseLocation {
  const locations = candles.map((candle) => { const scale = Math.max(candle.high.scale, candle.low.scale, candle.close.scale); const range = scaledAtomic(candle.high, scale) - scaledAtomic(candle.low, scale); return range === 0n ? 5_000 : safeBigIntToNumber(((scaledAtomic(candle.close, scale) - scaledAtomic(candle.low, scale)) * 10_000n) / range, "closeLocation"); });
  const value = average(locations);
  return value >= policy.closeLocationHighBasisPoints ? EventAnalyzerCloseLocation.NearHighs : value <= policy.closeLocationLowBasisPoints ? EventAnalyzerCloseLocation.NearLows : EventAnalyzerCloseLocation.MidRange;
}

function rangeExpansionStatus(candles: readonly EventAnalyzerOneMinuteCandle[], policy: EventAnalyzerPolicy): EventAnalyzerRangeExpansion {
  const ranges = candles.map((candle) => changeBasisPoints(candle.low, candle.high));
  const recent = average(ranges.slice(-2)); const prior = average(ranges.slice(0, -2));
  if (prior <= 0) return EventAnalyzerRangeExpansion.Stable;
  const ratio = safeRatioBasisPoints(recent, prior, "rangeExpansion");
  if (ratio >= policy.rangeExpansionRatioBasisPoints) return EventAnalyzerRangeExpansion.Expanding;
  if (ratio <= Math.trunc(100_000_000 / policy.rangeExpansionRatioBasisPoints)) return EventAnalyzerRangeExpansion.Contracting;
  return EventAnalyzerRangeExpansion.Stable;
}

function accelerationStatus(returns: readonly number[], direction: 1 | -1, policy: EventAnalyzerPolicy): EventAnalyzerFeatureStatus {
  if (returns.length < 2) return EventAnalyzerFeatureStatus.Unavailable;
  const last = returns.at(-1)!; const previous = returns.at(-2)!;
  const aligned = direction === 1 ? last > 0 && previous > 0 : last < 0 && previous < 0;
  if (!aligned) return EventAnalyzerFeatureStatus.NotConfirmed;
  const expanding = BigInt(Math.abs(last)) * 10_000n >= BigInt(Math.abs(previous)) * BigInt(policy.accelerationRatioBasisPoints);
  const persistent = returns.slice(-3).length === 3 && returns.slice(-3).every((value) => direction === 1 ? value > 0 : value < 0);
  return expanding || persistent ? EventAnalyzerFeatureStatus.Confirmed : EventAnalyzerFeatureStatus.NotConfirmed;
}

function relativeVolumeConfirmation(candles: readonly EventAnalyzerOneMinuteCandle[], shortReturn: number, policy: EventAnalyzerPolicy): EventAnalyzerVolumeConfirmation {
  if (candles.some((candle) => candle.volume === null)) return EventAnalyzerVolumeConfirmation.Unavailable;
  const values = candles.map((candle) => candle.volume as EventAnalyzerFixedDecimal);
  const scale = Math.max(...values.map((value) => value.scale));
  const recent = averageBigInt(values.slice(-2).map((value) => scaledAtomic(value, scale)));
  const prior = averageBigInt(values.slice(0, -2).map((value) => scaledAtomic(value, scale)));
  if (prior <= 0n || recent * 10_000n < prior * BigInt(policy.relativeVolumeRatioBasisPoints)) return EventAnalyzerVolumeConfirmation.None;
  return shortReturn > 0 ? EventAnalyzerVolumeConfirmation.Bullish : shortReturn < 0 ? EventAnalyzerVolumeConfirmation.Bearish : EventAnalyzerVolumeConfirmation.None;
}

function reversalStatus(candles: readonly EventAnalyzerOneMinuteCandle[], shortReturn: number, consecutiveBullish: number, consecutiveBearish: number, policy: EventAnalyzerPolicy): EventAnalyzerReversalRisk {
  const pivot = candles.length - policy.shortWindowCandles;
  if (pivot <= 0) return EventAnalyzerReversalRisk.None;
  const priorReturn = changeBasisPoints(candles[0]!.close, candles[pivot]!.close);
  const recent = candles.slice(-policy.shortWindowCandles);
  const lowerStructure = monotonic(recent, -1);
  const higherStructure = monotonic(recent, 1);
  if (priorReturn >= policy.trendThresholdBasisPoints && shortReturn <= -policy.trendThresholdBasisPoints && consecutiveBearish >= 2 && lowerStructure) return EventAnalyzerReversalRisk.UpToDown;
  if (priorReturn <= -policy.trendThresholdBasisPoints && shortReturn >= policy.trendThresholdBasisPoints && consecutiveBullish >= 2 && higherStructure) return EventAnalyzerReversalRisk.DownToUp;
  return EventAnalyzerReversalRisk.None;
}

function monotonic(candles: readonly EventAnalyzerOneMinuteCandle[], direction: 1 | -1): boolean {
  for (let index = 1; index < candles.length; index += 1) {
    const high = compareDecimal(candles[index]!.high, candles[index - 1]!.high);
    const close = compareDecimal(candles[index]!.close, candles[index - 1]!.close);
    if (direction === -1 ? high >= 0 || close >= 0 : high <= 0 || close <= 0) return false;
  }
  return true;
}

function classifyMomentum(shortReturn: number, mediumReturn: number, pressure: { bullish: number; bearish: number }, consecutiveBullish: number, consecutiveBearish: number, upside: EventAnalyzerFeatureStatus, downside: EventAnalyzerFeatureStatus, reversal: EventAnalyzerReversalRisk, policy: EventAnalyzerPolicy): EventAnalyzerDerivedMomentum {
  if (reversal === EventAnalyzerReversalRisk.UpToDown) return EventAnalyzerDerivedMomentum.ReversalRiskUpToDown;
  if (reversal === EventAnalyzerReversalRisk.DownToUp) return EventAnalyzerDerivedMomentum.ReversalRiskDownToUp;
  if (shortReturn <= -policy.strongTrendThresholdBasisPoints && mediumReturn < 0 && consecutiveBearish >= 2 && (pressure.bearish >= policy.strongBodyPressureBasisPoints || downside === EventAnalyzerFeatureStatus.Confirmed)) return EventAnalyzerDerivedMomentum.StrongDown;
  if (shortReturn >= policy.strongTrendThresholdBasisPoints && mediumReturn > 0 && consecutiveBullish >= 2 && (pressure.bullish >= policy.strongBodyPressureBasisPoints || upside === EventAnalyzerFeatureStatus.Confirmed)) return EventAnalyzerDerivedMomentum.StrongUp;
  if (shortReturn <= -policy.trendThresholdBasisPoints || pressure.bearish > 5_500) return EventAnalyzerDerivedMomentum.WeakDown;
  if (shortReturn >= policy.trendThresholdBasisPoints || pressure.bullish > 5_500) return EventAnalyzerDerivedMomentum.WeakUp;
  return EventAnalyzerDerivedMomentum.Neutral;
}

function generalContradictions(momentum: EventAnalyzerDerivedMomentum, reversal: EventAnalyzerReversalRisk): readonly EventAnalyzerContradictionFlag[] {
  const flags: EventAnalyzerContradictionFlag[] = [];
  if (momentum === EventAnalyzerDerivedMomentum.StrongDown) flags.push(EventAnalyzerContradictionFlag.StrongBearishStructure);
  if (momentum === EventAnalyzerDerivedMomentum.StrongUp) flags.push(EventAnalyzerContradictionFlag.StrongBullishStructure);
  if (reversal === EventAnalyzerReversalRisk.UpToDown) flags.push(EventAnalyzerContradictionFlag.UpToDownReversal);
  if (reversal === EventAnalyzerReversalRisk.DownToUp) flags.push(EventAnalyzerContradictionFlag.DownToUpReversal);
  return deepFreeze(flags.sort());
}

function changeBasisPoints(from: EventAnalyzerFixedDecimal, to: EventAnalyzerFixedDecimal): number { const scale = Math.max(from.scale, to.scale); return safeBigIntToNumber(((scaledAtomic(to, scale) - scaledAtomic(from, scale)) * 10_000n) / scaledAtomic(from, scale), "changeBasisPoints"); }
function compareDecimal(left: EventAnalyzerFixedDecimal, right: EventAnalyzerFixedDecimal): number { const scale = Math.max(left.scale, right.scale); const a = scaledAtomic(left, scale); const b = scaledAtomic(right, scale); return a < b ? -1 : a > b ? 1 : 0; }
function scaledAtomic(value: EventAnalyzerFixedDecimal, scale: number): bigint { return BigInt(value.atomicValue) * (10n ** BigInt(scale - value.scale)); }
function isPositiveDecimal(value: unknown): value is EventAnalyzerFixedDecimal { return isBoundedDecimal(value) && BigInt(value.atomicValue) > 0n; }
function isNonNegativeDecimal(value: unknown): value is EventAnalyzerFixedDecimal { return isBoundedDecimal(value) && !value.atomicValue.startsWith("-") && BigInt(value.atomicValue) >= 0n; }
function isBoundedDecimal(value: unknown): value is EventAnalyzerFixedDecimal { return isRecord(value) && typeof value.atomicValue === "string" && INTEGER.test(value.atomicValue) && value.atomicValue.replace("-", "").length <= EVENT_ANALYZER_MAX_ATOMIC_DIGITS && Number.isSafeInteger(value.scale) && (value.scale as number) >= 0 && (value.scale as number) <= EVENT_ANALYZER_MAX_DECIMAL_SCALE; }
function timestamp(value: unknown): number | null { if (typeof value !== "string") return null; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null; }
function average(values: readonly number[]): number { if (values.length === 0) return 0; for (const value of values) assertSafeInteger(value, "average"); return safeBigIntToNumber(values.reduce((total, value) => total + BigInt(value), 0n) / BigInt(values.length), "average"); }
function averageBigInt(values: readonly bigint[]): bigint { return values.length === 0 ? 0n : values.reduce((total, value) => total + value, 0n) / BigInt(values.length); }
function issue(code: EventAnalyzerValidationIssueCode, field: string, message: string): EventAnalyzerValidationIssue { return { code, field, message }; }
function sortIssues(values: readonly EventAnalyzerValidationIssue[]): readonly EventAnalyzerValidationIssue[] { return deepFreeze([...values].sort((a, b) => a.code.localeCompare(b.code) || a.field.localeCompare(b.field) || a.message.localeCompare(b.message))); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function deepFreeze<T>(value: T): T { if (typeof value === "object" && value !== null && !Object.isFrozen(value)) { Object.freeze(value); for (const nested of Object.values(value)) deepFreeze(nested); } return value; }
function validateExactKeys(issues: EventAnalyzerValidationIssue[], value: Record<string, unknown>, allowed: readonly string[], field: string, code = EventAnalyzerValidationIssueCode.InvalidCandleSeries): void { for (const key of Object.keys(value).filter((entry) => !allowed.includes(entry)).sort()) issues.push(issue(code, `${field}.${key}`, "Undeclared candle evidence fields are not permitted.")); }
function safeRatioBasisPoints(numerator: number, denominator: number, label: string): number { assertSafeInteger(numerator, label); assertSafeInteger(denominator, label); return safeBigIntToNumber((BigInt(numerator) * 10_000n) / BigInt(denominator), label); }
function assertSafeInteger(value: number, label: string): void { if (!Number.isSafeInteger(value) || !Number.isFinite(value)) throw new Error(`Unsafe deterministic integer in ${label}.`); }
function safeBigIntToNumber(value: bigint, label: string): number { if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error(`Unsafe deterministic integer in ${label}.`); return Number(value); }
