import type { OptionsCandleRepository } from "../contracts/OptionsCandleRepository";
import type { OptionsMarketContext } from "../contracts/OptionsMarketContext";
import { requireIssuedOptionsMarketContext } from "../engines/options-market-context/OptionsMultiTimeframeContextEngine";
import { fingerprintBody, requireContext, validUtc } from "../engines/options-market-context/OptionsMarketContextValidation";

export class InMemoryOptionsMarketContextRepository implements OptionsCandleRepository {
  private readonly contexts = new Map<string, OptionsMarketContext>();
  public put(context: OptionsMarketContext): "INSERTED" | "REPLAY" {
    requireContext(typeof context === "object" && context !== null
      && context.fingerprint === fingerprintBody(context) && context.dataOrigin === "FIXTURE"
      && context.automatedExecutionAllowed === false, "INVALID_CONTRACT");
    const existing = this.contexts.get(context.contextId);
    if (existing !== undefined) {
      requireContext(existing.fingerprint === context.fingerprint, "REPLAY_CONFLICT");
    }
    requireIssuedOptionsMarketContext(context);
    if (existing !== undefined) return "REPLAY";
    this.contexts.set(context.contextId, context);
    return "INSERTED";
  }
  public query(instrumentId: string, from: string, to: string): readonly OptionsMarketContext[] {
    requireContext(validUtc(from) && validUtc(to) && from <= to, "INVALID_CONTRACT");
    return Object.freeze([...this.contexts.values()].filter((context) => context.instrumentId === instrumentId
      && context.asOf >= from && context.asOf <= to).sort((a,b) => a.asOf.localeCompare(b.asOf) || a.contextId.localeCompare(b.contextId)));
  }
}
