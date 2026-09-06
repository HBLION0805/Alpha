import { readFileSync } from "node:fs";
import { BarAdjustmentState, BarDeliveryTiming, BarDerivationStatus, BarFreshnessStatus, BarInterval,
  BarMarketCoverage, BarQuantityUnit, BarSessionType, CanonicalBarStatus } from "../../../contracts/CanonicalBar";
import { InstrumentAssetClass, InstrumentStatus, InstrumentType, type CanonicalInstrument } from "../../../contracts/CanonicalInstrument";
import { deterministicFingerprint } from "../../../contracts/DeterministicFingerprint";
import { MarketDataCapability, type MarketDataProviderDescriptor } from "../../../contracts/MarketData";
import { MarketDataProviderNamePolicy, MarketDataProviderStatus, type MarketDataProviderMetadata,
  type MarketDataProviderRegistryPolicy } from "../../../contracts/MarketDataProviderRegistry";
import { MarketRegimeVolatilityMetric } from "../../../contracts/MarketRegime";
import type { OptionsBarFixtureBinding } from "../../../contracts/OptionsBarFixtureBinding";
import { OPTIONS_CONTEXT_INTERVALS, type OptionsCandlePolicy, type OptionsContextInterval } from "../../../contracts/OptionsCandlePolicy";
import { VerifiedMarketCalendarSessionStatus, VerifiedMarketDataOrigin, type VerifiedMarketCalendarSessionEvidence } from "../../../contracts/VerifiedMarketSnapshot";
import type { OptionsRawFixtureBar } from "../../../integration/options-market-context/OptionsBarFixtureSchemas";
import { optionsMappingFingerprint } from "../OptionsBarSourceAuthorization";
import { optionsSessionGrid } from "../OptionsCandleSeriesIntegrityEngine";
import { digestContext, fingerprintBody } from "../OptionsMarketContextValidation";

export type FixtureRows = Record<OptionsContextInterval, OptionsRawFixtureBar[]>;
export interface ContextFixture { binding: OptionsBarFixtureBinding; providers: MarketDataProviderMetadata[]; policy: OptionsCandlePolicy; rows: FixtureRows; asOf: string }
export const FIXTURE_POLICY: OptionsCandlePolicy = {
  schemaVersion: "1.0", policyId: "options-candle:fixture", version: "1.0", sessionType: "REGULAR",
  gridVersion: "REGULAR_OPEN_FULL_WINDOWS_V1", pairVersion: "SESSION_LOCAL_INTRADAY_V1",
  annualizationVersion: "REGULAR_SESSION_FIXED_PERIODS_V1", periodsPerYear: {P1D: 252, PT1H: 1512, PT15M: 6552, PT5M: 19656},
  atrWindowN: 3, rvReturnWindowN: 3, volumeSessionWindowN: 2,
  lowRelativeVolumeBps: 8000, highRelativeVolumeBps: 12000,
  maxAgeSeconds: {P1D: 3600, PT1H: 3600, PT15M: 3600, PT5M: 3600}, maxBarsPerSeries: 10000,
  regimePolicy: {policyId: "options-regime:fixture", version: "1.0", ruleSetVersion: "1.0",
    shortTrendWindow: 3, mediumTrendWindow: 5, correctionDrawdownThresholdBasisPoints: 500,
    reliefRallyReboundThresholdBasisPoints: 300, highVolatilityThresholdBasisPoints: 400,
    rangeBoundThresholdBasisPoints: 150, freshnessThresholdSeconds: 3600,
    minimumRequiredObservations: 5, strongEvidenceMinimumObservations: 10,
    volatilityMetric: MarketRegimeVolatilityMetric.MaximumAbsoluteReturnBasisPoints},
};
export const CALENDAR_VECTORS = {
  normal: [["2026-11-23", "14:30", "21:00"], ["2026-11-24", "14:30", "21:00"],
    ["2026-11-25", "14:30", "21:00"], ["2026-11-26", "14:30", "21:00", "holiday"],
    ["2026-11-27", "14:30", "18:00"], ["2026-11-30", "14:30", "21:00"]],
  spring: [["2026-03-04", "14:30", "21:00"], ["2026-03-05", "14:30", "21:00"],
    ["2026-03-06", "14:30", "21:00"], ["2026-03-09", "13:30", "20:00"], ["2026-03-10", "13:30", "20:00"]],
  autumn: [["2026-10-28", "13:30", "20:00"], ["2026-10-29", "13:30", "20:00"],
    ["2026-10-30", "13:30", "20:00"], ["2026-11-02", "14:30", "21:00"], ["2026-11-03", "14:30", "21:00"]],
} as const;

/** Synthetic test data, not historical market observations. No production defaults are registered. */
export function buildContextFixture(vector: keyof typeof CALENDAR_VECTORS = "normal"): ContextFixture {
  const instrument: CanonicalInstrument = {schemaVersion: "1.0", instrumentId: "instrument:00000000000000000000000002",
    metadataVersion: "1.0", displaySymbol: "QQQ", displayName: "QQQ synthetic fixture", assetClass: InstrumentAssetClass.Etf,
    instrumentType: InstrumentType.ExchangeTradedFund, status: InstrumentStatus.Active, currency: "USD",
    exchange: "XNAS", timezone: "America/New_York", effectiveFrom: "2026-01-01T00:00:00.000Z"};
  const provider: MarketDataProviderMetadata = {schemaVersion: "1.0", metadataVersion: "1.0",
    identity: {providerId: "provider:options-fixture", displayName: "Options fixture only"}, status: MarketDataProviderStatus.Active,
    supportedAssetClasses: [InstrumentAssetClass.Etf], capabilities: [MarketDataCapability.Bars], priority: 1,
    defaultEnabled: true, documentationReference: "docs/specifications/OPTIONS_MARKET_CONTEXT_AND_CANDLE_ANALYSIS.md"};
  const registryPolicy: MarketDataProviderRegistryPolicy = {schemaVersion: "1.0", policyId: "registry:options-fixture",
    version: "1.0", displayNamePolicy: MarketDataProviderNamePolicy.RejectDuplicates};
  const descriptor: MarketDataProviderDescriptor = {schemaVersion: "1.0", providerId: provider.identity.providerId,
    adapterId: "adapter:options-fixture", adapterVersion: "1.0", capability: MarketDataCapability.Bars,
    supportedAssetClasses: [InstrumentAssetClass.Etf], supportedBarIntervals: OPTIONS_CONTEXT_INTERVALS};
  const calendar: VerifiedMarketCalendarSessionEvidence[] = CALENDAR_VECTORS[vector].map((entry) => {
    const [date, open, close] = entry;
    const body = {calendarEvidenceId: `calendar-evidence:${date}`, calendarId: "calendar:options-fixture",
      sessionId: `session:${date}:regular`, sessionDate: date, sessionType: "REGULAR" as const, timezone: "America/New_York",
      marketOpen: `${date}T${open}:00.000Z`, marketClose: `${date}T${close}:00.000Z`, closureBufferSeconds: 60,
      status: entry.length === 4 ? VerifiedMarketCalendarSessionStatus.HolidayClosed : VerifiedMarketCalendarSessionStatus.Completed,
      provenanceReference: `fixture:calendar:${date}`, dataOrigin: VerifiedMarketDataOrigin.Fixture};
    return {...body, calendarEvidenceFingerprint: deterministicFingerprint(body)};
  });
  const asOf = new Date(Date.parse(calendar[calendar.length - 1]!.marketClose) + 120000).toISOString();
  const rows = Object.fromEntries(OPTIONS_CONTEXT_INTERVALS.map((interval) => [interval,
    calendar.flatMap((session, sessionIndex) => optionsSessionGrid(session, interval).map((slot, slotIndex): OptionsRawFixtureBar => {
      const close = 10000 + sessionIndex * 500 + slotIndex * 5;
      const price = (value: number) => ({atomicValue: String(value), scale: 2});
      return {providerSymbol: "QQQ.FIXTURE", bar: {schemaVersion: "1.0", instrument, interval,
        intervalStart: slot.start, intervalEnd: slot.end, observationTime: slot.end,
        receivedAt: slot.end, normalizedAt: slot.end,
        value: {open: price(close - 5), high: price(close + 10), low: price(close - 10), close: price(close),
          volume: {atomicValue: String(1000 + slotIndex * 100), scale: 0}},
        currency: "USD", quantityUnit: BarQuantityUnit.BaseUnits, status: CanonicalBarStatus.Final,
        session: {sessionType: BarSessionType.Regular, sessionDate: session.sessionDate, timezone: session.timezone},
        adjustment: BarAdjustmentState.Raw,
        quality: {policyId: "quality:fixture", policyVersion: "1.0", evaluatedAt: slot.end, maxAgeSeconds: 3600,
          freshness: BarFreshnessStatus.Current, deliveryTiming: BarDeliveryTiming.EndOfDay, marketCoverage: BarMarketCoverage.FullMarket,
          derivation: BarDerivationStatus.ProviderReported, reasonCodes: []},
        source: {providerId: descriptor.providerId, adapterId: descriptor.adapterId, adapterVersion: descriptor.adapterVersion,
          sourceReference: "fixture:options-qqq", contentIntegrityReference: "manifest:options-qqq"}}};
    }))])) as FixtureRows;
  const actionBody = {policyId: "actions:fixture", version: "1.0", instrumentId: instrument.instrumentId,
    metadataVersion: instrument.metadataVersion, windowStart: calendar[0]!.marketOpen,
    windowEnd: calendar[calendar.length - 1]!.marketClose, sourceReference: "fixture:actions:none",
    adjustment: "RAW" as const, resolution: "NO_UNRESOLVED_ACTIONS" as const, knownEvents: []};
  const body = {schemaVersion: "1.0" as const, manifestId: "manifest:options-qqq", version: "1.0", dataOrigin: "FIXTURE" as const,
    registryPolicy, registryFingerprint: deterministicFingerprint({policy: registryPolicy, providers: [provider]}),
    descriptor, descriptorFingerprint: deterministicFingerprint(descriptor), instrument, providerSymbol: "QQQ.FIXTURE",
    mappingPolicyId: "mapping:options-fixture", mappingVersion: "1.0", mappingFingerprint: "",
    intervals: OPTIONS_CONTEXT_INTERVALS, calendarId: "calendar:options-fixture", calendarVersion: "1.0",
    calendarFingerprint: deterministicFingerprint(calendar), calendar,
    corporateAction: {...actionBody, fingerprint: deterministicFingerprint(actionBody)},
    contentDigests: Object.fromEntries(OPTIONS_CONTEXT_INTERVALS.map((interval) => [interval, digestContext(rows[interval])])) as Record<OptionsContextInterval,string>,
    provenanceReference: "fixture:options-qqq", effectiveFrom: calendar[0]!.marketOpen,
    effectiveTo: new Date(Date.parse(asOf) + 7 * 86400000).toISOString()};
  body.mappingFingerprint = optionsMappingFingerprint(body);
  return {binding: {...body, fingerprint: deterministicFingerprint(body)}, providers: [provider], policy: FIXTURE_POLICY, rows, asOf};
}
export function loadContextFixture(): ContextFixture {
  const root = "fixtures/options-market-context/qqq-qualified/";
  const manifest = JSON.parse(readFileSync(`${root}manifest.json`, "utf8")) as Omit<ContextFixture,"rows">;
  const rows = Object.fromEntries(OPTIONS_CONTEXT_INTERVALS.map((interval) => [interval,
    JSON.parse(readFileSync(`${root}${interval.toLowerCase()}.json`, "utf8"))])) as FixtureRows;
  return {...manifest, rows};
}
/** Test-only reauthorization lets negative scenarios reach series validation after valid source checks. */
export function rebindTestRows(fixture: ContextFixture): ContextFixture {
  const binding = {...fixture.binding, contentDigests: Object.fromEntries(OPTIONS_CONTEXT_INTERVALS.map((interval) =>
    [interval, digestContext(fixture.rows[interval])])) as Record<OptionsContextInterval,string>};
  return {...fixture, binding: {...binding, fingerprint: fingerprintBody(binding)}};
}
