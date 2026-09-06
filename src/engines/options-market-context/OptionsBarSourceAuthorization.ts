import { BarAdjustmentState, type CanonicalBar } from "../../contracts/CanonicalBar";
import { InstrumentAssetClass } from "../../contracts/CanonicalInstrument";
import { deterministicFingerprint } from "../../contracts/DeterministicFingerprint";
import { MarketDataCapability } from "../../contracts/MarketData";
import { MarketDataProviderQueryScope, type MarketDataProviderMetadata } from "../../contracts/MarketDataProviderRegistry";
import type { OptionsBarFixtureBinding } from "../../contracts/OptionsBarFixtureBinding";
import { OPTIONS_CONTEXT_INTERVALS, type OptionsContextInterval } from "../../contracts/OptionsCandlePolicy";
import { FixtureOptionsBarAdapter } from "../../integration/options-market-context/FixtureOptionsBarAdapter";
import { parseOptionsRawFixture } from "../../integration/options-market-context/OptionsBarFixtureSchemas";
import { validateCanonicalInstrument } from "../canonical-instrument/CanonicalInstrument";
import { ImmutableMarketDataProviderComposition } from "../market-data-provider-composition/MarketDataProviderComposition";
import { InMemoryMarketDataProviderRegistry } from "../market-data-provider-registry/MarketDataProviderRegistry";
import { copyContext, digestContext, exactFields, fingerprintBody, freezeContext, requireContext, validId, validUtc } from "./OptionsMarketContextValidation";

const authorizedBarBatches = new WeakMap<readonly CanonicalBar[], {
  readonly binding: OptionsBarFixtureBinding;
  readonly interval: OptionsContextInterval;
  readonly source: OptionsBarSourceAuthorization;
}>();

/** A matching digest is evidence, not authority to qualify a caller-created batch. */
export function requireAuthorizedOptionsBarBatch(bars: readonly CanonicalBar[], interval: OptionsContextInterval,
  binding: OptionsBarFixtureBinding, asOf: string): void {
  const authorization = authorizedBarBatches.get(bars);
  requireContext(authorization !== undefined && authorization.binding === binding
    && authorization.interval === interval, "SOURCE_OR_PROVENANCE_DRIFT");
  authorization.source.preauthorize(asOf);
}

export function optionsMappingFingerprint(binding: Pick<OptionsBarFixtureBinding, "providerSymbol" | "instrument" | "mappingPolicyId" | "mappingVersion" | "descriptor">): string {
  return deterministicFingerprint({ providerId: binding.descriptor.providerId, providerSymbol: binding.providerSymbol,
    instrumentId: binding.instrument.instrumentId, metadataVersion: binding.instrument.metadataVersion,
    policyId: binding.mappingPolicyId, version: binding.mappingVersion });
}

/** Trusted construction is isolated from the untrusted per-run fixture input. */
export class OptionsBarSourceAuthorization {
  public readonly binding: OptionsBarFixtureBinding;
  public readonly adapter: FixtureOptionsBarAdapter;
  private readonly registry: InMemoryMarketDataProviderRegistry;
  private readonly composition: ImmutableMarketDataProviderComposition;
  public constructor(input: OptionsBarFixtureBinding, providers: readonly MarketDataProviderMetadata[]) {
    exactFields(input, ["schemaVersion", "manifestId", "version", "dataOrigin", "registryPolicy", "registryFingerprint",
      "descriptor", "descriptorFingerprint", "instrument", "providerSymbol", "mappingPolicyId", "mappingVersion",
      "mappingFingerprint", "intervals", "calendarId", "calendarVersion", "calendarFingerprint", "calendar", "corporateAction",
      "contentDigests", "provenanceReference", "effectiveFrom", "effectiveTo", "fingerprint"]);
    exactFields(input.registryPolicy, ["schemaVersion", "policyId", "version", "displayNamePolicy"], "SOURCE_OR_PROVENANCE_DRIFT");
    exactFields(input.descriptor, ["schemaVersion", "providerId", "adapterId", "adapterVersion", "capability",
      "supportedAssetClasses", "supportedBarIntervals"], "SOURCE_OR_PROVENANCE_DRIFT");
    exactFields(input.corporateAction, ["policyId", "version", "instrumentId", "metadataVersion", "windowStart", "windowEnd",
      "sourceReference", "adjustment", "resolution", "knownEvents", "fingerprint"], "UNRESOLVED_CORPORATE_ACTION");
    requireContext([input.corporateAction.policyId, input.corporateAction.version, input.corporateAction.sourceReference].every(validId)
      && Array.isArray(input.corporateAction.knownEvents) && input.corporateAction.knownEvents.every(validId), "UNRESOLVED_CORPORATE_ACTION");
    requireContext(input.schemaVersion === "1.0" && input.dataOrigin === "FIXTURE"
      && input.fingerprint === fingerprintBody(input) && validateCanonicalInstrument(input.instrument).valid
      && input.instrument.assetClass === InstrumentAssetClass.Etf
      && input.instrument.displaySymbol === "QQQ" && input.instrument.currency === "USD"
      && [input.manifestId, input.version, input.providerSymbol, input.mappingPolicyId, input.mappingVersion,
        input.calendarId, input.calendarVersion, input.provenanceReference].every(validId)
      && validUtc(input.effectiveFrom) && validUtc(input.effectiveTo) && input.effectiveFrom < input.effectiveTo
      && JSON.stringify(input.intervals) === JSON.stringify(OPTIONS_CONTEXT_INTERVALS)
      && JSON.stringify(input.descriptor.supportedBarIntervals) === JSON.stringify(OPTIONS_CONTEXT_INTERVALS)
      && input.mappingFingerprint === optionsMappingFingerprint(input)
      && input.descriptorFingerprint === deterministicFingerprint(input.descriptor)
      && input.calendarFingerprint === deterministicFingerprint(input.calendar), "SOURCE_OR_PROVENANCE_DRIFT");
    exactFields(input.contentDigests, OPTIONS_CONTEXT_INTERVALS);
    requireContext(Object.values(input.contentDigests).every((digest) => /^sha256:[a-f0-9]{64}$/u.test(digest)), "SOURCE_OR_PROVENANCE_DRIFT");
    this.binding = copyContext(input);
    this.registry = new InMemoryMarketDataProviderRegistry(providers, input.registryPolicy);
    this.adapter = new FixtureOptionsBarAdapter(this.binding);
    this.composition = new ImmutableMarketDataProviderComposition(this.registry, [], [this.adapter]);
    requireContext(input.registryFingerprint === deterministicFingerprint({policy: input.registryPolicy,
      providers: this.registry.listProviders(MarketDataProviderQueryScope.All)}), "SOURCE_OR_PROVENANCE_DRIFT");
  }
  public preauthorize(asOf: string): void {
    const binding = this.binding;
    requireContext(validUtc(asOf) && asOf >= binding.effectiveFrom && asOf <= binding.effectiveTo, "SOURCE_OR_PROVENANCE_DRIFT");
    this.registry.requireEnabledProvider(binding.descriptor.providerId);
    this.registry.requireCapability(binding.descriptor.providerId, MarketDataCapability.Bars);
    this.registry.requireAssetClass(binding.descriptor.providerId, InstrumentAssetClass.Etf);
    requireContext(this.composition.getBarAdapter(binding.descriptor.providerId) === this.adapter
      && deterministicFingerprint(this.adapter.getDescriptor()) === binding.descriptorFingerprint,
    "SOURCE_OR_PROVENANCE_DRIFT");
  }
  public authorize(interval: OptionsContextInterval, raw: unknown, bars: readonly CanonicalBar[]): void {
    const binding = this.binding;
    const rows = parseOptionsRawFixture(raw);
    requireContext(rows.length === bars.length && digestContext(raw) === binding.contentDigests[interval], "SOURCE_OR_PROVENANCE_DRIFT");
    requireContext(digestContext(this.adapter.normalizeFixture(raw)) === digestContext(bars), "SOURCE_OR_PROVENANCE_DRIFT");
    for (const [index, bar] of bars.entries()) {
      requireContext(rows[index]!.providerSymbol === binding.providerSymbol
        && optionsMappingFingerprint(binding) === binding.mappingFingerprint
        && deterministicFingerprint(bar.instrument) === deterministicFingerprint(binding.instrument)
        && bar.interval === interval && bar.source.providerId === binding.descriptor.providerId
        && bar.intervalStart >= binding.effectiveFrom && bar.normalizedAt <= binding.effectiveTo
        && bar.source.adapterId === binding.descriptor.adapterId && bar.source.adapterVersion === binding.descriptor.adapterVersion
        && bar.source.sourceReference === binding.provenanceReference
        && bar.source.contentIntegrityReference === binding.manifestId, "SOURCE_OR_PROVENANCE_DRIFT");
      requireContext(bar.adjustment === BarAdjustmentState.Raw, "UNRESOLVED_CORPORATE_ACTION");
    }
    freezeContext(bars);
    authorizedBarBatches.set(bars, {binding, interval, source: this});
  }
}
