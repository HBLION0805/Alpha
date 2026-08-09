import { createHash } from "node:crypto";
import { OPTIONS_NEWS_DOMAIN_VERSION, NewsLatencyState, NewsObservationStatus, type NewsEntityCandidate, type NewsEvidenceRecord, type NewsTopic } from "../../contracts/OptionsNewsDomain";
import { NewsTransportMode, type NewsProviderAdapter, type NewsProviderRequest, type NewsTransportRequest } from "../../contracts/OptionsNewsProvider";
import type { NewsSourceRegistration } from "../../contracts/OptionsNewsSourceRegistry";
import { validateNewsEvidenceRecord } from "../../engines/options-news/OptionsNewsValidation";

interface RawNewsItem { readonly id: string; readonly publisher: string; readonly upstreamOriginId: string | null; readonly headline: string; readonly url: string; readonly publishedAt: string; readonly timezone: string; readonly receivedAtUtc: string; readonly ingestedAtUtc: string; readonly normalizedAtUtc: string; readonly entities: readonly NewsEntityCandidate[]; readonly eventType: string; readonly topics: readonly NewsTopic[]; readonly keyFacts: Readonly<Record<string,string>>; readonly primaryDocument: string | null; }

export abstract class FixtureNewsAdapterBase implements NewsProviderAdapter {
  public abstract readonly adapterName: string;
  public readonly adapterVersion = "1.0";
  public constructor(public readonly source: NewsSourceRegistration, private readonly collectionKey: string, private readonly endpointTemplate: string) {}
  public buildRequest(request: NewsProviderRequest, mode: NewsTransportMode = NewsTransportMode.Fixture): NewsTransportRequest {
    if (!request.requestId || request.sourceId !== this.source.sourceId || Number.isNaN(Date.parse(request.requestedAtUtc))) throw new Error("INVALID_PROVIDER_REQUEST");
    if (mode === NewsTransportMode.LiveDisabled) throw new Error("NETWORK_BLOCKED");
    return { mode, providerId: this.source.providerId, endpointTemplate: this.endpointTemplate, query: { symbols: [...request.symbols].sort().join(","), topics: [...request.topics].sort().join(",") }, headers: {}, credentialsRequired: false, networkEnabled: false };
  }
  public normalize(raw: unknown, request: NewsProviderRequest): readonly NewsEvidenceRecord[] {
    const root = strictRecord(raw, ["schemaVersion", this.collectionKey]);
    if (root.schemaVersion !== "fixture-news-1.0" || !Array.isArray(root[this.collectionKey])) throw new Error("INVALID_RAW_RESPONSE");
    const collection = root[this.collectionKey] as unknown[];
    return collection.map((candidate: unknown, index: number) => this.normalizeItem(candidate, request, index));
  }
  private normalizeItem(raw: unknown, request: NewsProviderRequest, index: number): NewsEvidenceRecord {
    const item = strictRecord(raw, ["id","publisher","upstreamOriginId","headline","url","publishedAt","timezone","receivedAtUtc","ingestedAtUtc","normalizedAtUtc","entities","eventType","topics","keyFacts","primaryDocument"]) as unknown as RawNewsItem;
    if (item.publisher !== this.source.publisherId || typeof item.id !== "string" || !Array.isArray(item.entities) || !Array.isArray(item.topics) || typeof item.keyFacts !== "object" || item.keyFacts === null || typeof item.headline !== "string" || typeof item.url !== "string") throw new Error("INVALID_RAW_RESPONSE");
    const payloadHash = hash(raw); const primary = item.primaryDocument === null ? null : hash(item.primaryDocument); const origin = item.upstreamOriginId ?? item.publisher;
    const record: NewsEvidenceRecord = { domainVersion: OPTIONS_NEWS_DOMAIN_VERSION, evidenceId: `news-evidence:${this.source.providerId.split(":")[1]}:${item.id}`, providerObservationId: item.id, sourceId: this.source.sourceId, sourceTier: this.source.tier, providerId: this.source.providerId, publisherId: item.publisher, sourceFamily: this.source.sourceFamily, upstreamOriginId: item.upstreamOriginId, independenceKey: `origin:${origin}`, primaryDocumentFingerprint: primary, originalHeadlineEnglish: item.headline, originalUrl: item.url, originalPublishedAt: item.publishedAt, originalTimezone: item.timezone, publishedAtUtc: new Date(item.publishedAt).toISOString(), receivedAtUtc: item.receivedAtUtc, ingestedAtUtc: item.ingestedAtUtc, normalizedAtUtc: item.normalizedAtUtc, rawPayloadHash: payloadHash, rawPayloadReference: `fixture://${this.source.providerId}/${item.id}#sha256=${payloadHash}`, entityCandidates: structuredClone(item.entities), eventTypeCandidate: item.eventType, topicCandidates: [...item.topics], keyFacts: structuredClone(item.keyFacts), observationStatus: NewsObservationStatus.Unique, adapterName: this.adapterName, adapterVersion: this.adapterVersion, providerSchemaVersion: "fixture-news-1.0", normalizationVersion: "options-news-normalization:1.0", cost: { currency: "USD", estimatedMinorUnits: 0, actualMinorUnits: 0, simulated: true }, latency: latency(item) };
    validateNewsEvidenceRecord(record);
    if (request.sourceId !== record.sourceId || index < 0) throw new Error("REGISTRY_MISMATCH");
    return Object.freeze(record);
  }
}

function latency(item: RawNewsItem): NewsEvidenceRecord["latency"] { const values = [Date.parse(item.publishedAt),Date.parse(item.receivedAtUtc),Date.parse(item.ingestedAtUtc),Date.parse(item.normalizedAtUtc)]; if (values.some(Number.isNaN)) return { state: NewsLatencyState.Unmeasured, reasonCode: "PROVIDER_TIMESTAMPS_INCOMPLETE", publishToProviderReceiveMs: null, providerReceiveToIngestMs: null, ingestToNormalizeMs: null, normalizeToVerifyMs: null, publishToVerifyMs: null }; return { state: NewsLatencyState.Measured, reasonCode: null, publishToProviderReceiveMs: (values[1] as number)-(values[0] as number), providerReceiveToIngestMs: (values[2] as number)-(values[1] as number), ingestToNormalizeMs: (values[3] as number)-(values[2] as number), normalizeToVerifyMs: null, publishToVerifyMs: null }; }
function strictRecord(value: unknown, keys: readonly string[]): Record<string, unknown> { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("INVALID_RAW_RESPONSE"); const actual = Object.keys(value).sort(); const expected = [...keys].sort(); if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("INVALID_RAW_RESPONSE_UNKNOWN_OR_MISSING_FIELDS"); return value as Record<string,unknown>; }
function hash(value: unknown): string { return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex"); }
