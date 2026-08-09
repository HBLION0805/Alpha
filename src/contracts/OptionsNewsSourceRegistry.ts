import type { NewsSourceTier, NewsTopic } from "./OptionsNewsDomain";

export const OPTIONS_NEWS_SOURCE_REGISTRY_VERSION = "1.0" as const;
export enum NewsSourceEligibility { Eligible = "ELIGIBLE", DiscoveryOnly = "DISCOVERY_ONLY", Inactive = "INACTIVE" }
export enum NewsNetworkAuthority { Blocked = "BLOCKED", OwnerApprovalRequired = "OWNER_APPROVAL_REQUIRED" }

export interface NewsSourceRegistration {
  readonly registryVersion: typeof OPTIONS_NEWS_SOURCE_REGISTRY_VERSION;
  readonly sourceId: string;
  readonly providerId: string;
  readonly publisherId: string;
  readonly tier: NewsSourceTier;
  readonly sourceFamily: string;
  readonly originalSourceId: string;
  readonly syndicationLineage: readonly string[];
  readonly independenceGroupingRule: "UPSTREAM_ORIGIN_OR_PUBLISHER";
  readonly eligibility: NewsSourceEligibility;
  readonly supportedEventTypes: readonly string[];
  readonly supportedTopics: readonly NewsTopic[];
  readonly costPerRequestMinorUnits: number | null;
  readonly rateLimitDescription: string;
  readonly credentialsRequiredForLive: boolean;
  readonly liveNetworkAuthority: NewsNetworkAuthority;
  readonly effectiveFromUtc: string;
  readonly effectiveToUtc: string | null;
  readonly provenance: string;
}

export interface NewsSourceRegistry {
  get(sourceId: string): NewsSourceRegistration;
  list(): readonly NewsSourceRegistration[];
  assertAdapterIdentity(sourceId: string, providerId: string, publisherId: string): NewsSourceRegistration;
  fingerprint(): string;
}
