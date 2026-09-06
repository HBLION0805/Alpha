import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { MarketRegimeDataQualityStatus, RegimeBenchmarkScope, RegimeCanonicalIdentityStatus,
  RegimeObservationQualityStatus, type MarketRegimePolicy } from "../../contracts/MarketRegime";
import type { OptionsQualifiedSeries, OptionsTimeframeRegimeBinding } from "../../contracts/OptionsMarketContext";
import { createRegimeInputSnapshot, MarketRegimeEngine } from "../market-regime/MarketRegimeEngine";
import { freezeContext, requireContext } from "./OptionsMarketContextValidation";

export function bindOptionsMarketRegime(series: OptionsQualifiedSeries, policy: MarketRegimePolicy): OptionsTimeframeRegimeBinding {
  const snapshot = createRegimeInputSnapshot({schemaVersion: "1.0", snapshotId: `options-regime:${series.fingerprint.slice(8)}`,
    benchmark: {status: RegimeCanonicalIdentityStatus.Resolved, instrumentId: series.bars[0]!.instrument.instrumentId,
      assetClass: InstrumentAssetClass.Etf, scope: RegimeBenchmarkScope.BroadMarket},
    observationWindow: {start: series.bars[0]!.intervalStart, end: series.bars[series.bars.length - 1]!.intervalEnd},
    observations: series.bars.map((bar) => ({observationId: bar.barId, observedAt: bar.intervalEnd,
      close: bar.value.close, qualityStatus: RegimeObservationQualityStatus.Accepted, evidenceReferences: [bar.fingerprint]})),
    dataQualityStatus: MarketRegimeDataQualityStatus.Accepted, requestedSecondaryConditions: [],
    evidenceReferences: [series.fingerprint, series.calendarFingerprint, series.corporateActionFingerprint],
    trace: {correlationId: `options-context:${series.interval}`, traceId: `options-trace:${series.fingerprint.slice(8)}`,
      auditReferenceIds: [series.bindingFingerprint]}, createdAt: series.asOf});
  const assessment = new MarketRegimeEngine().assess({schemaVersion: "1.0", assessmentId: `options-assessment:${series.fingerprint.slice(8)}`,
    snapshot, policy, assessedAt: series.asOf, createdAt: series.asOf});
  return freezeContext({interval: series.interval, qualifiedSeriesFingerprint: series.fingerprint,
    inputSnapshotId: snapshot.snapshotId, inputSnapshotFingerprint: snapshot.fingerprint, assessmentId: assessment.assessmentId,
    policyId: policy.policyId, policyVersion: policy.version, ruleSetVersion: policy.ruleSetVersion, snapshot, assessment});
}
export function validateOptionsRegimeBinding(binding: OptionsTimeframeRegimeBinding, series: OptionsQualifiedSeries, policy: MarketRegimePolicy): void {
  // Recompute using the authoritative engine; internally consistent substituted assessments cannot pass.
  const expected = bindOptionsMarketRegime(series, policy);
  requireContext(deterministicFingerprint(expected) === deterministicFingerprint(binding), "TIMEFRAME_REGIME_BINDING_DRIFT");
}
