import { BarDerivationStatus, BarInterval, BarQuantityUnit, BarSessionType, CanonicalBarStatus, type CanonicalBar } from "../../contracts/CanonicalBar";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import type { OptionsBarFixtureBinding } from "../../contracts/OptionsBarFixtureBinding";
import type { OptionsCandlePolicy, OptionsContextInterval } from "../../contracts/OptionsCandlePolicy";
import type { OptionsQualifiedSeries } from "../../contracts/OptionsMarketContext";
import { MarketCalendarSessionStatus, MarketDataOrigin, type MarketCalendarSessionEvidence } from "../../contracts/MarketCalendar";
import { validateCanonicalBar } from "../canonical-bar/CanonicalBar";
import { latestCompletedTradingSession, validateMarketCalendarEvidence } from "../market-calendar/MarketCalendarValidation";
import { requireAuthorizedOptionsBarBatch } from "./OptionsBarSourceAuthorization";
import { exactFields, fingerprintBody, freezeContext, requireContext, validUtc, validateOptionsCandlePolicy } from "./OptionsMarketContextValidation";

const qualifiedSeriesInstances = new WeakSet<OptionsQualifiedSeries>();

export function requireIssuedOptionsQualifiedSeries(series: OptionsQualifiedSeries): void {
  requireContext(qualifiedSeriesInstances.has(series), "SOURCE_OR_PROVENANCE_DRIFT");
}

/** Grid composition uses explicit calendar open/close; it does not determine trading days. */
export function optionsSessionGrid(session: MarketCalendarSessionEvidence, interval: OptionsContextInterval) {
  if (session.status === MarketCalendarSessionStatus.HolidayClosed) return [];
  const open = Date.parse(session.marketOpen);
  const close = Date.parse(session.marketClose);
  if (interval === BarInterval.OneDay) return [{start: session.marketOpen, end: session.marketClose, slotId: "P1D:0"}];
  const duration = interval === BarInterval.OneHour ? 3600000 : interval === BarInterval.FifteenMinutes ? 900000 : 300000;
  const result: {start: string; end: string; slotId: string}[] = [];
  for (let start = open, slot = 0; start + duration <= close; start += duration, slot++) {
    result.push({start: new Date(start).toISOString(), end: new Date(start + duration).toISOString(), slotId: `${interval}:${slot}`});
  }
  requireContext(result.length > 0 && (interval === BarInterval.OneHour ? (close - open) % duration === 1800000 : (close - open) % duration === 0), "SESSION_CALENDAR_DRIFT");
  return result;
}

export function qualifyOptionsCandleSeries(bars: readonly CanonicalBar[], interval: OptionsContextInterval,
  binding: OptionsBarFixtureBinding, inputPolicy: OptionsCandlePolicy, asOf: string): OptionsQualifiedSeries {
  requireAuthorizedOptionsBarBatch(bars, interval, binding, asOf);
  const policy = validateOptionsCandlePolicy(inputPolicy);
  requireContext(validUtc(asOf) && validateMarketCalendarEvidence(binding.calendar, asOf).valid
    && deterministicFingerprint(binding.calendar) === binding.calendarFingerprint, "SESSION_CALENDAR_DRIFT");
  requireContext(Array.isArray(bars) && bars.length > 0 && bars.length <= policy.maxBarsPerSeries, "INSUFFICIENT_HISTORY");
  const action = binding.corporateAction;
  exactFields(action, ["policyId", "version", "instrumentId", "metadataVersion", "windowStart", "windowEnd", "sourceReference",
    "adjustment", "resolution", "knownEvents", "fingerprint"], "UNRESOLVED_CORPORATE_ACTION");
  requireContext(action.fingerprint === fingerprintBody(action) && action.instrumentId === binding.instrument.instrumentId
    && action.metadataVersion === binding.instrument.metadataVersion && action.adjustment === "RAW"
    && action.resolution === "NO_UNRESOLVED_ACTIONS" && Array.isArray(action.knownEvents) && action.knownEvents.length === 0
    && validUtc(action.windowStart) && validUtc(action.windowEnd)
    && action.sourceReference.length > 0 && action.policyId.length > 0 && action.version.length > 0,
  "UNRESOLVED_CORPORATE_ACTION");
  const sessions = binding.calendar.filter((session) => session.status === MarketCalendarSessionStatus.Completed);
  requireContext(sessions.length > 0 && binding.calendar.every((session, index) => session.calendarId === binding.calendarId
    && session.sessionType === "REGULAR" && session.timezone === "America/New_York"
    && session.dataOrigin === MarketDataOrigin.Fixture
    && (index === 0 || binding.calendar[index - 1]!.sessionDate < session.sessionDate)), "SESSION_CALENDAR_DRIFT");
  const expected = sessions.flatMap((session) => optionsSessionGrid(session, interval).map((slot) => ({session, ...slot})));
  requireContext(expected.length === bars.length, "GAPPED_SERIES");
  const slotIds: string[] = [];
  const sessionIds: string[] = [];
  for (const [index, bar] of bars.entries()) {
    requireContext(validateCanonicalBar(bar).valid && bar.status === CanonicalBarStatus.Final
      && bar.quantityUnit === BarQuantityUnit.BaseUnits && bar.quality.derivation === BarDerivationStatus.ProviderReported,
    "INVALID_CANONICAL_BAR");
    const slot = expected[index]!;
    requireContext(bar.interval === interval && bar.session.sessionType === BarSessionType.Regular
      && bar.session.sessionDate === slot.session.sessionDate && bar.session.timezone === slot.session.timezone,
    "SESSION_CALENDAR_DRIFT");
    requireContext(bar.intervalStart === slot.start && bar.intervalEnd === slot.end, "GAPPED_SERIES");
    requireContext(bar.normalizedAt <= asOf && bar.observationTime <= asOf, "STALE_SERIES");
    requireContext(bar.adjustment === action.adjustment && bar.intervalStart >= action.windowStart
      && bar.intervalEnd <= action.windowEnd, "UNRESOLVED_CORPORATE_ACTION");
    slotIds.push(slot.slotId);
    sessionIds.push(slot.session.sessionId);
  }
  const latest = latestCompletedTradingSession(asOf, binding.calendar);
  const last = bars[bars.length - 1]!;
  requireContext(latest !== undefined && last.session.sessionDate === latest.sessionDate, "STALE_SERIES");
  const ageSeconds = (Date.parse(asOf) - Date.parse(last.intervalEnd)) / 1000;
  requireContext(ageSeconds >= 0 && ageSeconds <= policy.maxAgeSeconds[interval], "STALE_SERIES");
  const body = { interval, bars, references: bars.map((bar) => ({canonicalBarId: bar.barId,
    canonicalBarFingerprint: bar.fingerprint, canonicalInstrumentId: bar.instrument.instrumentId,
    interval: bar.interval, intervalStart: bar.intervalStart, intervalEnd: bar.intervalEnd,
    observationTime: bar.observationTime, sessionDate: bar.session.sessionDate, status: "FINAL" as const,
    freshness: bar.quality.freshness, provenanceReference: bar.source.sourceReference })),
  slotIds, sessionIds, bindingFingerprint: binding.fingerprint, policyFingerprint: deterministicFingerprint(policy),
  calendarFingerprint: binding.calendarFingerprint, corporateActionFingerprint: action.fingerprint, asOf, ageSeconds };
  const qualified = freezeContext({...body, fingerprint: deterministicFingerprint(body)});
  qualifiedSeriesInstances.add(qualified);
  return qualified;
}
