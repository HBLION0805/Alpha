import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { OPTIONS_CONTEXT_INTERVALS, type OptionsCandlePolicy } from "../../contracts/OptionsCandlePolicy";
import type { OptionsMarketContext, OptionsTimeframeContext } from "../../contracts/OptionsMarketContext";
import { requireIssuedOptionsQualifiedSeries } from "./OptionsCandleSeriesIntegrityEngine";
import { validateOptionsRegimeBinding } from "./OptionsMarketRegimeInputAdapter";
import { calculateOptionsTechnicalFeatures } from "./OptionsTechnicalFeatureEngine";
import { digestContext, exactFields, fingerprintBody, freezeContext, requireContext, validateOptionsCandlePolicy } from "./OptionsMarketContextValidation";

const composedContextInstances = new WeakSet<OptionsMarketContext>();

/** In-memory write capability; deserialized output must be reconstructed from authorized inputs. */
export function requireIssuedOptionsMarketContext(context: OptionsMarketContext): void {
  requireContext(composedContextInstances.has(context), "INVALID_CONTRACT");
}

export function composeOptionsMarketContext(timeframes: readonly OptionsTimeframeContext[], inputPolicy: OptionsCandlePolicy): OptionsMarketContext {
  const policy = validateOptionsCandlePolicy(inputPolicy);
  requireContext(Array.isArray(timeframes) && timeframes.length === OPTIONS_CONTEXT_INTERVALS.length, "INSUFFICIENT_HISTORY");
  for (const timeframe of timeframes) {
    exactFields(timeframe, ["series", "features", "regime"]);
    requireIssuedOptionsQualifiedSeries(timeframe.series as OptionsTimeframeContext["series"]);
  }
  const first = timeframes[0]!.series;
  for (const [index, timeframe] of timeframes.entries()) {
    const series = timeframe.series;
    requireContext(series.interval === OPTIONS_CONTEXT_INTERVALS[index] && series.fingerprint === fingerprintBody(series)
      && series.asOf === first.asOf && series.bindingFingerprint === first.bindingFingerprint
      && series.policyFingerprint === deterministicFingerprint(policy)
      && series.calendarFingerprint === first.calendarFingerprint && series.corporateActionFingerprint === first.corporateActionFingerprint
      && series.bars[0]!.instrument.instrumentId === first.bars[0]!.instrument.instrumentId, "SOURCE_OR_PROVENANCE_DRIFT");
    requireContext(digestContext(timeframe.features) === digestContext(calculateOptionsTechnicalFeatures(series, policy)),
      "SOURCE_OR_PROVENANCE_DRIFT");
    validateOptionsRegimeBinding(timeframe.regime, series, policy.regimePolicy);
  }
  const body = {schemaVersion: "1.0" as const, asOf: first.asOf, dataOrigin: "FIXTURE" as const,
    instrumentId: first.bars[0]!.instrument.instrumentId, bindingFingerprint: first.bindingFingerprint,
    policyFingerprint: first.policyFingerprint, timeframes,
    agreement: new Set(timeframes.map((timeframe) => timeframe.regime.assessment.primaryRegime)).size === 1 ? "AGREEMENT" as const : "DISAGREEMENT" as const,
    automatedExecutionAllowed: false as const};
  const contextId = `options-context:${deterministicFingerprint({asOf: first.asOf, binding: first.bindingFingerprint, policy: first.policyFingerprint}).slice(8)}`;
  const context = freezeContext({...body, contextId, fingerprint: deterministicFingerprint({...body, contextId})});
  composedContextInstances.add(context);
  return context;
}
