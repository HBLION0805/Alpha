import type { OptionsMarketContext } from "../contracts/OptionsMarketContext";
import { freezeContext } from "../engines/options-market-context/OptionsMarketContextValidation";

/** Read-only references; this projection writes no existing Journal or Evidence repository. */
export function optionsMarketContextEvidence(context: OptionsMarketContext) {
  return freezeContext({namespace: "OPTIONS_MARKET_CONTEXT", contextId: context.contextId, contextFingerprint: context.fingerprint,
    dataOrigin: context.dataOrigin, observedAt: context.asOf,
    references: context.timeframes.map(({series, regime}) => ({interval: series.interval,
      bars: series.references, seriesFingerprint: series.fingerprint, calendarFingerprint: series.calendarFingerprint,
      corporateActionFingerprint: series.corporateActionFingerprint, inputSnapshotId: regime.inputSnapshotId,
      assessmentId: regime.assessmentId, policyId: regime.policyId, policyVersion: regime.policyVersion})),
    readOnly: true, automatedExecutionAllowed: false});
}
