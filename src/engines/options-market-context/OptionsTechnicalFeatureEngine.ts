import { BarInterval, type BarDecimal } from "../../contracts/CanonicalBar";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import type { OptionsCandlePolicy } from "../../contracts/OptionsCandlePolicy";
import type { OptionsQualifiedSeries, OptionsTechnicalFeatures } from "../../contracts/OptionsMarketContext";
import { fingerprintBody, freezeContext, requireContext, validateOptionsCandlePolicy } from "./OptionsMarketContextValidation";

const INPUT_LIMIT = (1n << 255n) - 1n;
const INTERMEDIATE_LIMIT = (1n << 511n) - 1n;
function abs(value: bigint): bigint { return value < 0n ? -value : value; }
function bounded(value: bigint): bigint {
  requireContext(abs(value) <= INTERMEDIATE_LIMIT, "NUMERIC_OVERFLOW");
  return value;
}
function atomic(value: BarDecimal, scale: number): bigint {
  const result = BigInt(value.atomicValue) * 10n ** BigInt(scale - value.scale);
  requireContext(abs(result) <= INPUT_LIMIT, "NUMERIC_OVERFLOW");
  return result;
}
function safeNumber(value: bigint): number {
  requireContext(abs(value) <= BigInt(Number.MAX_SAFE_INTEGER), "NUMERIC_OVERFLOW");
  return Number(value);
}
export function integerSqrtFloor(value: bigint): bigint {
  requireContext(value >= 0n, "NUMERIC_OVERFLOW");
  bounded(value);
  if (value < 2n) return value;
  let current = value;
  let next = (current + 1n) / 2n;
  while (next < current) { current = next; next = (current + value / current) / 2n; }
  return current;
}

/** Recomputes Wilder state from the entire qualified history; accepts no external state. */
export function calculateOptionsTechnicalFeatures(series: OptionsQualifiedSeries, inputPolicy: OptionsCandlePolicy): OptionsTechnicalFeatures {
  const policy = validateOptionsCandlePolicy(inputPolicy);
  requireContext(series.fingerprint === fingerprintBody(series)
    && series.policyFingerprint === deterministicFingerprint(policy), "SOURCE_OR_PROVENANCE_DRIFT");
  const bars = series.bars;
  requireContext(bars.length >= policy.atrWindowN, "INSUFFICIENT_HISTORY");
  const scale = bars.reduce((maximum, bar) => Math.max(maximum, bar.value.open.scale, bar.value.high.scale,
    bar.value.low.scale, bar.value.close.scale), 0);
  const allVolumeScale = bars.reduce((maximum, bar) => Math.max(maximum, bar.value.volume.scale), 0);
  for (const bar of bars) {
    atomic(bar.value.open, scale);
    atomic(bar.value.volume, allVolumeScale);
  }
  const trueRanges: bigint[] = [];
  const returns: bigint[] = [];
  const returnBarIds: string[] = [];
  for (const [index, bar] of bars.entries()) {
    const high = atomic(bar.value.high, scale);
    const low = atomic(bar.value.low, scale);
    const close = atomic(bar.value.close, scale);
    requireContext(close > 0n, "INVALID_CANONICAL_BAR");
    const previous = bars[index - 1];
    const paired = previous !== undefined && (series.interval === BarInterval.OneDay
      || (previous.session.sessionDate === bar.session.sessionDate && previous.intervalEnd === bar.intervalStart));
    let tr = bounded(high - low);
    if (paired && previous !== undefined) {
      const priorClose = atomic(previous.value.close, scale);
      requireContext(priorClose > 0n, "INVALID_CANONICAL_BAR");
      tr = [tr, abs(high - priorClose), abs(low - priorClose)].reduce((left, right) => left > right ? left : right);
      returns.push(bounded(bounded(close - priorClose) * 1_000_000_000n) / priorClose);
      returnBarIds.push(bar.barId);
    }
    trueRanges.push(tr);
  }
  const sum = (values: readonly bigint[]): bigint => values.reduce((acc, item) => bounded(acc + item), 0n);
  const atrN = BigInt(policy.atrWindowN);
  let atr = sum(trueRanges.slice(0, policy.atrWindowN)) / atrN;
  for (const tr of trueRanges.slice(policy.atrWindowN)) atr = bounded(bounded(atr * (atrN - 1n)) + tr) / atrN;
  requireContext(returns.length >= policy.rvReturnWindowN, "INSUFFICIENT_HISTORY");
  const window = returns.slice(-policy.rvReturnWindowN);
  const mean = sum(window) / BigInt(window.length);
  const variance = sum(window.map((item) => bounded(bounded(item - mean) ** 2n))) / BigInt(window.length - 1);
  const volatility = integerSqrtFloor(bounded(variance * BigInt(policy.periodsPerYear[series.interval])));

  const last = bars[bars.length - 1]!;
  const slotId = series.slotIds[bars.length - 1]!;
  const candidates = bars.map((bar, index) => ({ bar, index })).filter(({bar, index}) =>
    bar.session.sessionDate < last.session.sessionDate && series.slotIds[index] === slotId);
  const baseline = candidates.slice(-policy.volumeSessionWindowN);
  requireContext(baseline.length === policy.volumeSessionWindowN
    && new Set(baseline.map(({bar}) => bar.session.sessionDate)).size === baseline.length, "INSUFFICIENT_VOLUME_BASELINE");
  const volumeScale = Math.max(last.value.volume.scale, ...baseline.map(({bar}) => bar.value.volume.scale));
  const baselineAtomic = sum(baseline.map(({bar}) => atomic(bar.value.volume, volumeScale))) / BigInt(baseline.length);
  requireContext(baselineAtomic > 0n, "INSUFFICIENT_VOLUME_BASELINE");
  const ratio = safeNumber(bounded(atomic(last.value.volume, volumeScale) * 10000n) / baselineAtomic);
  return freezeContext({
    interval: series.interval, qualifiedSeriesFingerprint: series.fingerprint, policyFingerprint: series.policyFingerprint,
    atr: { atomicValue: atr.toString(), scale }, atrVersion: "WILDER_ATR_V1",
    trueRanges: trueRanges.map((value) => ({atomicValue: value.toString(), scale})),
    returnPpb: returns.map(String), returnBarIds, qualifiedReturnCount: returns.length,
    rvWindowReturnCount: window.length, annualizedVolatilityPpb: volatility.toString(),
    annualizedVolatilityBps: safeNumber(volatility / 100000n), rvVersion: "SAMPLE_SIMPLE_RETURN_RV_V1",
    annualizationVersion: policy.annualizationVersion, periodsPerYear: policy.periodsPerYear[series.interval],
    volume: { baseline: {atomicValue: baselineAtomic.toString(), scale: volumeScale}, relativeVolumeBps: ratio,
      category: ratio <= policy.lowRelativeVolumeBps ? "BELOW_BASELINE" : ratio >= policy.highRelativeVolumeBps ? "ABOVE_BASELINE" : "WITHIN_BASELINE",
      slotId, sessionIds: baseline.map(({index}) => series.sessionIds[index]!),
      policyId: policy.policyId, policyVersion: policy.version, policyFingerprint: series.policyFingerprint },
  });
}
