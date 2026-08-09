import type { NewsEvidenceRecord } from "../../contracts/OptionsNewsDomain";
import type { NewsProviderAdapter, NewsProviderRequest, NewsTransportRequest } from "../../contracts/OptionsNewsProvider";
import { NewsSourceEligibility, type NewsSourceRegistration, type NewsSourceRegistry } from "../../contracts/OptionsNewsSourceRegistry";
import { OptionsNewsSourceRegistry } from "./OptionsNewsSourceRegistry";

export class OptionsNewsRegistryDriftError extends Error {
  public readonly reasonCode = "REGISTRY_DRIFT" as const;
  public constructor(detail: string) { super(`REGISTRY_DRIFT: ${detail}`); }
}

/** Runtime trust boundary between untrusted adapters and the immutable source registry. */
export class OptionsNewsSourceAuthorization {
  private readonly registry: OptionsNewsSourceRegistry;

  public constructor(registry: NewsSourceRegistry) {
    this.registry = new OptionsNewsSourceRegistry(registry.list());
  }

  public authorizeAdapter(adapter: NewsProviderAdapter, request: NewsProviderRequest): NewsSourceRegistration {
    let registration: NewsSourceRegistration;
    try { registration = this.registry.get(request.sourceId); }
    catch { throw new OptionsNewsRegistryDriftError(`unregistered source ${request.sourceId}`); }
    if (!sameBinding(adapter.source, registration)) throw new OptionsNewsRegistryDriftError(`adapter identity drift for ${request.sourceId}`);
    this.assertActive(registration, request.requestedAtUtc);
    return registration;
  }

  public authorizeTransport(request: NewsTransportRequest, registration: NewsSourceRegistration): void {
    if (request.providerId !== registration.providerId || request.networkEnabled !== false || request.credentialsRequired) {
      throw new OptionsNewsRegistryDriftError(`transport binding drift for ${registration.sourceId}`);
    }
  }

  public authorizeEvidence(records: readonly NewsEvidenceRecord[], registration: NewsSourceRegistration, atUtc: string): void {
    this.assertActive(registration, atUtc);
    for (const record of records) {
      if (record.sourceId !== registration.sourceId || record.providerId !== registration.providerId || record.publisherId !== registration.publisherId || record.sourceTier !== registration.tier || record.sourceFamily !== registration.sourceFamily) {
        throw new OptionsNewsRegistryDriftError(`normalized source identity drift for ${registration.sourceId}`);
      }
      if (!registration.supportedEventTypes.includes(record.eventTypeCandidate) || record.topicCandidates.some((topic) => !registration.supportedTopics.includes(topic))) {
        throw new OptionsNewsRegistryDriftError(`normalized eligibility drift for ${registration.sourceId}`);
      }
      const verifiedOrigin = record.upstreamOriginId ?? record.publisherId;
      if (verifiedOrigin !== registration.originalSourceId) throw new OptionsNewsRegistryDriftError(`upstream origin drift for ${registration.sourceId}`);
      const expectedIndependenceKey = independenceKey(registration, verifiedOrigin);
      if (record.independenceKey !== expectedIndependenceKey) throw new OptionsNewsRegistryDriftError(`independence lineage drift for ${registration.sourceId}`);
    }
  }

  private assertActive(registration: NewsSourceRegistration, atUtc: string): void {
    const instant = canonicalUtc(atUtc);
    const starts = Date.parse(registration.effectiveFromUtc);
    const ends = registration.effectiveToUtc === null ? null : Date.parse(registration.effectiveToUtc);
    if (registration.eligibility === NewsSourceEligibility.Inactive || instant < starts || (ends !== null && instant >= ends)) {
      throw new OptionsNewsRegistryDriftError(`source is not effective and eligible at ${atUtc}`);
    }
  }
}

function independenceKey(registration: NewsSourceRegistration, verifiedOrigin: string): string {
  if (registration.independenceGroupingRule !== "UPSTREAM_ORIGIN_OR_PUBLISHER") throw new OptionsNewsRegistryDriftError(`unsupported independence rule for ${registration.sourceId}`);
  return `origin:${verifiedOrigin}`;
}

function sameBinding(claimed: NewsSourceRegistration, registered: NewsSourceRegistration): boolean {
  return claimed.registryVersion === registered.registryVersion
    && claimed.sourceId === registered.sourceId
    && claimed.providerId === registered.providerId
    && claimed.publisherId === registered.publisherId
    && claimed.tier === registered.tier
    && claimed.sourceFamily === registered.sourceFamily
    && claimed.originalSourceId === registered.originalSourceId
    && equal(claimed.syndicationLineage, registered.syndicationLineage)
    && claimed.independenceGroupingRule === registered.independenceGroupingRule
    && claimed.eligibility === registered.eligibility
    && equal(claimed.supportedEventTypes, registered.supportedEventTypes)
    && equal(claimed.supportedTopics, registered.supportedTopics)
    && claimed.effectiveFromUtc === registered.effectiveFromUtc
    && claimed.effectiveToUtc === registered.effectiveToUtc;
}

function equal(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
function canonicalUtc(value: string): number { const instant = Date.parse(value); if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) || Number.isNaN(instant) || new Date(instant).toISOString() !== value) throw new OptionsNewsRegistryDriftError(`invalid authorization timestamp ${value}`); return instant; }
