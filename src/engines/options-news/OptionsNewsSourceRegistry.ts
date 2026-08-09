import { createHash } from "node:crypto";
import { NewsSourceEligibility, OPTIONS_NEWS_SOURCE_REGISTRY_VERSION, type NewsSourceRegistration, type NewsSourceRegistry } from "../../contracts/OptionsNewsSourceRegistry";

export class OptionsNewsSourceRegistry implements NewsSourceRegistry {
  private readonly registrations: ReadonlyMap<string, NewsSourceRegistration>;
  public constructor(values: readonly NewsSourceRegistration[]) {
    const map = new Map<string, NewsSourceRegistration>();
    for (const value of values) {
      validate(value);
      if (map.has(value.sourceId)) throw new Error(`DUPLICATE_SOURCE: ${value.sourceId}`);
      map.set(value.sourceId, freeze(structuredClone(value)));
    }
    this.registrations = map;
  }
  public get(sourceId: string): NewsSourceRegistration { const value = this.registrations.get(sourceId); if (value === undefined) throw new Error(`UNKNOWN_SOURCE: ${sourceId}`); return structuredClone(value); }
  public list(): readonly NewsSourceRegistration[] { return [...this.registrations.values()].sort((a,b) => a.sourceId.localeCompare(b.sourceId)).map((value) => structuredClone(value)); }
  public assertAdapterIdentity(sourceId: string, providerId: string, publisherId: string): NewsSourceRegistration { const value = this.get(sourceId); if (value.providerId !== providerId || value.publisherId !== publisherId) throw new Error("REGISTRY_DRIFT: adapter identity does not match registry"); return value; }
  public fingerprint(): string { return createHash("sha256").update(JSON.stringify(this.list())).digest("hex"); }
}

function validate(v: NewsSourceRegistration): void {
  if (v.registryVersion !== OPTIONS_NEWS_SOURCE_REGISTRY_VERSION || !v.sourceId || !v.providerId || !v.publisherId || !v.sourceFamily || !v.originalSourceId || !v.provenance) throw new Error("INVALID_SOURCE_REGISTRATION");
  if (v.eligibility === NewsSourceEligibility.DiscoveryOnly && v.tier !== "TIER_3") throw new Error("INVALID_SOURCE_ELIGIBILITY");
  if (v.tier === "TIER_3" && v.eligibility !== NewsSourceEligibility.DiscoveryOnly) throw new Error("INVALID_SOURCE_ELIGIBILITY");
  if (v.liveNetworkAuthority !== "BLOCKED" && v.liveNetworkAuthority !== "OWNER_APPROVAL_REQUIRED") throw new Error("INVALID_NETWORK_AUTHORITY");
  if (v.costPerRequestMinorUnits !== null && (!Number.isSafeInteger(v.costPerRequestMinorUnits) || v.costPerRequestMinorUnits < 0)) throw new Error("INVALID_SOURCE_COST");
}
function freeze<T>(value: T): T { if (value !== null && typeof value === "object") { Object.freeze(value); for (const nested of Object.values(value)) freeze(nested); } return value; }
