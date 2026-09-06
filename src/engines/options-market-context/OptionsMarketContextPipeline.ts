import type { MarketDataProviderMetadata } from "../../contracts/MarketDataProviderRegistry";
import type { OptionsBarFixtureBinding } from "../../contracts/OptionsBarFixtureBinding";
import type { OptionsCandleRepository } from "../../contracts/OptionsCandleRepository";
import { OPTIONS_CONTEXT_INTERVALS, type OptionsCandlePolicy } from "../../contracts/OptionsCandlePolicy";
import type { OptionsMarketContextHealth, OptionsMarketContextResult } from "../../contracts/OptionsMarketContext";
import { CanonicalBarValidationError } from "../canonical-bar/CanonicalBar";
import { OptionsBarSourceAuthorization } from "./OptionsBarSourceAuthorization";
import { qualifyOptionsCandleSeries } from "./OptionsCandleSeriesIntegrityEngine";
import { bindOptionsMarketRegime } from "./OptionsMarketRegimeInputAdapter";
import { composeOptionsMarketContext } from "./OptionsMultiTimeframeContextEngine";
import { calculateOptionsTechnicalFeatures } from "./OptionsTechnicalFeatureEngine";
import { exactFields, freezeContext, OptionsContextError, requireContext, validateOptionsCandlePolicy } from "./OptionsMarketContextValidation";

export class OptionsMarketContextPipeline {
  private readonly source: OptionsBarSourceAuthorization;
  private readonly policy: OptionsCandlePolicy;
  public constructor(binding: OptionsBarFixtureBinding, providers: readonly MarketDataProviderMetadata[],
    policy: OptionsCandlePolicy, private readonly repository: OptionsCandleRepository) {
    this.source = new OptionsBarSourceAuthorization(binding, providers);
    this.policy = validateOptionsCandlePolicy(policy);
  }
  public run(input: unknown, asOf: string): OptionsMarketContextResult {
    const binding = this.source.binding;
    let stage: OptionsMarketContextHealth["stage"] = "AUTHORIZATION";
    let normalizedBarCount = 0, qualifiedSeriesCount = 0, featureCount = 0, validContextWriteCount = 0;
    const normalizedBarReferences: {barId: string; fingerprint: string}[] = [];
    const health = (): OptionsMarketContextHealth => freezeContext({stage, bindingFingerprint: binding.fingerprint,
      calendarFingerprint: binding.calendarFingerprint, corporateActionFingerprint: binding.corporateAction.fingerprint,
      normalizedBarCount, normalizedBarReferences, qualifiedSeriesCount, featureCount, validContextWriteCount,
      networkRequestCount: 0, credentialReadCount: 0, realCostCents: 0, latencyStatus: "UNMEASURED_FIXTURE"});
    try {
      this.source.preauthorize(asOf);
      exactFields(input, OPTIONS_CONTEXT_INTERVALS);
      stage = "NORMALIZATION";
      const normalized = OPTIONS_CONTEXT_INTERVALS.map((interval) => {
        requireContext(Array.isArray(input[interval]) && input[interval].length <= this.policy.maxBarsPerSeries, "INVALID_CONTRACT");
        const bars = this.source.adapter.normalizeFixture(input[interval]);
        normalizedBarCount += bars.length;
        normalizedBarReferences.push(...bars.map(({barId, fingerprint}) => ({barId, fingerprint})));
        this.source.authorize(interval, input[interval], bars);
        return {interval, bars};
      });
      stage = "QUALIFICATION";
      const series = normalized.map(({bars, interval}) => {
        const qualified = qualifyOptionsCandleSeries(bars, interval, binding, this.policy, asOf);
        qualifiedSeriesCount++;
        return qualified;
      });
      stage = "FEATURES";
      const timeframes = series.map((item) => {
        const features = calculateOptionsTechnicalFeatures(item, this.policy);
        featureCount++;
        return {series: item, features, regime: bindOptionsMarketRegime(item, this.policy.regimePolicy)};
      });
      stage = "COMPOSITION";
      const context = composeOptionsMarketContext(timeframes, this.policy);
      stage = "PERSISTENCE";
      validContextWriteCount = this.repository.put(context) === "INSERTED" ? 1 : 0;
      const queryResult = this.repository.query(context.instrumentId, asOf, asOf);
      stage = "COMPLETE";
      return freezeContext({status: "ACCEPTED", context, queryResult, health: health()});
    } catch (error) {
      const reasonCode = error instanceof OptionsContextError ? error.code
        : error instanceof CanonicalBarValidationError ? "INVALID_CANONICAL_BAR" : undefined;
      if (reasonCode === undefined) throw error;
      return freezeContext({status: "REJECTED", reasonCode, queryResult: [], health: health()});
    }
  }
}
