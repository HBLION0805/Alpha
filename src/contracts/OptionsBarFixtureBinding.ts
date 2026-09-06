import type { CanonicalInstrument } from "./CanonicalInstrument";
import type { MarketDataProviderDescriptor } from "./MarketData";
import type { MarketDataProviderRegistryPolicy } from "./MarketDataProviderRegistry";
import type { VerifiedMarketCalendarSessionEvidence } from "./VerifiedMarketSnapshot";
import type { OptionsContextInterval } from "./OptionsCandlePolicy";

export interface OptionsCorporateActionQualification {
  readonly policyId: string;
  readonly version: string;
  readonly instrumentId: string;
  readonly metadataVersion: string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly sourceReference: string;
  readonly adjustment: "RAW";
  readonly resolution: "NO_UNRESOLVED_ACTIONS";
  readonly knownEvents: readonly string[];
  readonly fingerprint: string;
}
export interface OptionsBarFixtureBinding {
  readonly schemaVersion: "1.0";
  readonly manifestId: string;
  readonly version: string;
  readonly dataOrigin: "FIXTURE";
  readonly registryPolicy: MarketDataProviderRegistryPolicy;
  readonly registryFingerprint: string;
  readonly descriptor: MarketDataProviderDescriptor;
  readonly descriptorFingerprint: string;
  readonly instrument: CanonicalInstrument;
  readonly providerSymbol: string;
  readonly mappingPolicyId: string;
  readonly mappingVersion: string;
  readonly mappingFingerprint: string;
  readonly intervals: readonly OptionsContextInterval[];
  readonly calendarId: string;
  readonly calendarVersion: string;
  readonly calendarFingerprint: string;
  readonly calendar: readonly VerifiedMarketCalendarSessionEvidence[];
  readonly corporateAction: OptionsCorporateActionQualification;
  readonly contentDigests: Readonly<Record<OptionsContextInterval, string>>;
  readonly provenanceReference: string;
  readonly effectiveFrom: string;
  readonly effectiveTo: string;
  readonly fingerprint: string;
}
