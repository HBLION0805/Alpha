import { MarketDataAdapterErrorCategory, MarketDataNormalizationStatus, MarketDataProviderHealthStatus,
  type MarketDataBarProviderAdapter, type MarketDataBarRequest, type MarketDataRawResponse } from "../../contracts/MarketData";
import type { OptionsBarFixtureBinding } from "../../contracts/OptionsBarFixtureBinding";
import { createCanonicalBar } from "../../engines/canonical-bar/CanonicalBar";
import { copyContext, requireContext } from "../../engines/options-market-context/OptionsMarketContextValidation";
import { parseOptionsRawFixture } from "./OptionsBarFixtureSchemas";

/** This adapter has no transport or credential port. Composition owns its source binding. */
export class FixtureOptionsBarAdapter implements MarketDataBarProviderAdapter {
  private readonly binding: OptionsBarFixtureBinding;
  public constructor(binding: OptionsBarFixtureBinding) { this.binding = copyContext(binding); }
  public getDescriptor() { return this.binding.descriptor; }
  public getHealth() {
    return { providerId: this.binding.descriptor.providerId, status: MarketDataProviderHealthStatus.Available,
      observedAt: this.binding.effectiveFrom, reason: "FIXTURE_ONLY" };
  }
  public async fetchBars(_request: MarketDataBarRequest): Promise<MarketDataRawResponse> {
    throw new Error("FIXTURE_INPUT_REQUIRED_NO_NETWORK");
  }
  public normalizeFixture(value: unknown) {
    const rows = parseOptionsRawFixture(value);
    for (const row of rows) requireContext(row.providerSymbol === this.binding.providerSymbol, "SOURCE_OR_PROVENANCE_DRIFT");
    return rows.map((row) => createCanonicalBar(row.bar));
  }
  public normalizeBars(raw: MarketDataRawResponse, request: MarketDataBarRequest) {
    requireContext(raw.providerId === this.binding.descriptor.providerId && request.providerId === raw.providerId
      && request.instrument.instrumentId === this.binding.instrument.instrumentId, "SOURCE_OR_PROVENANCE_DRIFT");
    const bars = this.normalizeFixture(raw.payload);
    requireContext(bars.every((bar) => bar.interval === request.interval), "SOURCE_OR_PROVENANCE_DRIFT");
    return { providerId: raw.providerId, status: MarketDataNormalizationStatus.Normalized as const,
      bars, duplicateCount: 0, blockers: [], warnings: [] };
  }
  public normalizeError(_error: unknown, request: MarketDataBarRequest, occurredAt: string) {
    return { providerId: request.providerId, category: MarketDataAdapterErrorCategory.MalformedResponse,
      safeCode: "FIXTURE_REJECTED", safeMessage: "Fixture normalization failed.", retryable: false, occurredAt };
  }
}
