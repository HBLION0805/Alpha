import type { OptionsMarketContext } from "./OptionsMarketContext";

export interface OptionsCandleRepository {
  put(context: OptionsMarketContext): "INSERTED" | "REPLAY";
  query(instrumentId: string, from: string, to: string): readonly OptionsMarketContext[];
}
