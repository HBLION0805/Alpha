import type { MarketDataBarProviderAdapter, MarketDataProviderAdapter } from "./MarketData";
import type { MarketDataProviderMetadata, MarketDataProviderRegistry } from "./MarketDataProviderRegistry";

export enum MarketDataCompositionScope {
  EnabledActiveOnly = "ENABLED_ACTIVE_ONLY",
  AdministrativeTest = "ADMINISTRATIVE_TEST",
}

export interface MarketDataProviderComposition {
  readonly registry: MarketDataProviderRegistry;
  readonly scope: MarketDataCompositionScope;
  listProviders(): readonly MarketDataProviderMetadata[];
  getProvider(providerId: string): MarketDataProviderMetadata | undefined;
  getQuoteAdapter(providerId: string): MarketDataProviderAdapter | undefined;
  getBarAdapter(providerId: string): MarketDataBarProviderAdapter | undefined;
}
