import type {
  MarketDataBarResult,
  MarketDataClock,
  MarketDataResult,
} from "../../contracts/MarketData";
import type { MarketDataProviderComposition } from "../../contracts/MarketDataProviderComposition";
import type { MarketDataProviderMetadata } from "../../contracts/MarketDataProviderRegistry";
import { MarketDataBarOrchestrator } from "./MarketDataBarOrchestrator";
import { MarketDataQuoteOrchestrator } from "./MarketDataQuoteOrchestrator";

export { MarketDataConfigurationError } from "./MarketDataQuoteOrchestrator";

/** Small public facade over capability-specific deterministic orchestrators. */
export class MarketDataService {
  private readonly quotes: MarketDataQuoteOrchestrator;
  private readonly bars: MarketDataBarOrchestrator;

  public constructor(
    private readonly composition: MarketDataProviderComposition,
    clock: MarketDataClock,
  ) {
    this.quotes = new MarketDataQuoteOrchestrator(composition, clock);
    this.bars = new MarketDataBarOrchestrator(composition, clock);
  }

  public listProviders(): readonly MarketDataProviderMetadata[] {
    return this.composition.listProviders();
  }

  public getLatestQuote(value: unknown): Promise<MarketDataResult> {
    return this.quotes.getLatestQuote(value);
  }

  public getBars(value: unknown): Promise<MarketDataBarResult> {
    return this.bars.getBars(value);
  }
}
