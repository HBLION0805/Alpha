import { createHash } from "node:crypto";
import { OPTIONS_NEWS_DOMAIN_VERSION, NewsEventStatus, NewsEvidenceRelation, NewsImpactHypothesis, type CanonicalNewsEvent, type EventEvidenceLink, type NewsEntityCandidate, type NewsEvidenceRecord, type NewsSourceTier, type SummaryEnvelope, type VerificationTransitionRecord } from "../../contracts/OptionsNewsDomain";

export interface EntityMapping { readonly alias: string; readonly entityId: string; readonly symbol: string; readonly source: string; readonly version: string; readonly effectiveFromUtc: string; readonly effectiveToUtc: string | null; }

export class DeterministicEntityLinker {
  private readonly mappings: readonly EntityMapping[];
  public constructor(mappings: readonly EntityMapping[]) { this.mappings = structuredClone(mappings); }
  public resolve(alias: string, atUtc: string): NewsEntityCandidate {
    const normalized = alias.trim().toLowerCase(); const at = Date.parse(atUtc);
    const matches = this.mappings.filter((m) => m.alias.trim().toLowerCase() === normalized && Date.parse(m.effectiveFromUtc) <= at && (m.effectiveToUtc === null || at < Date.parse(m.effectiveToUtc)));
    if (matches.length === 0) throw new Error("UNKNOWN_ENTITY");
    if (matches.length !== 1) throw new Error("AMBIGUOUS_ENTITY");
    const m = matches[0] as EntityMapping;
    return { entityId: m.entityId, symbol: m.symbol, alias, mappingSource: m.source, mappingVersion: m.version, effectiveFromUtc: m.effectiveFromUtc, effectiveToUtc: m.effectiveToUtc };
  }
}

export function canonicalFingerprint(evidence: Pick<NewsEvidenceRecord, "primaryDocumentFingerprint"|"upstreamOriginId"|"publisherId"|"eventTypeCandidate"|"entityCandidates"|"keyFacts"|"publishedAtUtc">): string {
  const hour = evidence.publishedAtUtc.slice(0, 13);
  const input = { primaryDocumentFingerprint: evidence.primaryDocumentFingerprint, origin: evidence.upstreamOriginId ?? evidence.publisherId, eventType: evidence.eventTypeCandidate, entities: evidence.entityCandidates.map((v) => v.entityId).sort(), facts: Object.fromEntries(Object.entries(evidence.keyFacts).sort(([a],[b]) => a.localeCompare(b))), boundedHourUtc: hour };
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function evidenceFingerprint(record: NewsEvidenceRecord): string { return createHash("sha256").update(JSON.stringify({ origin: record.upstreamOriginId ?? record.publisherId, url: record.originalUrl, facts: Object.fromEntries(Object.entries(record.keyFacts).sort(([a],[b]) => a.localeCompare(b))) })).digest("hex"); }

export function independenceKeys(records: readonly NewsEvidenceRecord[]): readonly string[] { return [...new Set(records.map((v) => v.independenceKey))].sort(); }

export function clusterEvidence(records: readonly NewsEvidenceRecord[]): readonly { readonly canonicalFingerprint: string; readonly evidenceIds: readonly string[]; readonly reasonCode: string; readonly algorithmVersion: string }[] {
  const clusters = new Map<string,string[]>();
  for (const record of records) { const fingerprint = canonicalFingerprint(record); const ids = clusters.get(fingerprint) ?? []; ids.push(record.evidenceId); clusters.set(fingerprint, ids); }
  return [...clusters.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([fingerprint,ids]) => ({ canonicalFingerprint: fingerprint, evidenceIds: [...ids].sort(), reasonCode: "MATCHED_VERSIONED_CANONICAL_INPUTS", algorithmVersion: "options-news-clustering:1.0" }));
}

export function formatEasternTime(utc: string): string {
  if (Number.isNaN(Date.parse(utc))) throw new Error("INVALID_UTC_TIMESTAMP");
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZoneName: "short" }).format(new Date(utc));
}

export function expiryDecision(eventType: string, discoveredAtUtc: string, evaluatedAtUtc: string, ttlSecondsByEventType: Readonly<Record<string,number>>): boolean {
  const ttl = ttlSecondsByEventType[eventType];
  if (ttl === undefined) throw new Error("EXPIRY_POLICY_NOT_FOUND");
  if (!Number.isSafeInteger(ttl) || ttl <= 0) throw new Error("INVALID_EXPIRY_POLICY");
  return Date.parse(evaluatedAtUtc) - Date.parse(discoveredAtUtc) > ttl * 1000;
}

export function verificationDecision(records: readonly NewsEvidenceRecord[], links: readonly EventEvidenceLink[]): { readonly state: NewsEventStatus; readonly confidence: number; readonly reason: string } {
  if (links.some((link) => link.relation === NewsEvidenceRelation.Retracts)) return { state: NewsEventStatus.Retracted, confidence: 1, reason: "AUTHORITATIVE_RETRACTION" };
  if (links.some((link) => link.relation === NewsEvidenceRelation.Conflicts)) return { state: NewsEventStatus.Conflicted, confidence: 0, reason: "CHECKED_FACT_CONFLICT" };
  const supporting = records.filter((record) => record.sourceTier !== ("TIER_3" as NewsSourceTier) && links.some((link) => link.evidenceId === record.evidenceId && (link.relation === NewsEvidenceRelation.Supports || (link.relation === NewsEvidenceRelation.CitesPrimary && link.checkedFacts.length > 0))));
  const tier0 = supporting.some((record) => record.sourceTier === ("TIER_0" as NewsSourceTier) && record.primaryDocumentFingerprint !== null && links.some((link) => link.evidenceId === record.evidenceId && link.relation === NewsEvidenceRelation.Supports && link.checkedFacts.length > 0));
  if (tier0) return { state: NewsEventStatus.Verified, confidence: 1, reason: "TIER_0_PRIMARY_EVIDENCE" };
  const citedPrimary = links.some((link) => link.relation === NewsEvidenceRelation.CitesPrimary && link.checkedFacts.length > 0 && records.some((record) => record.evidenceId === link.evidenceId && record.sourceTier === ("TIER_0" as NewsSourceTier) && record.primaryDocumentFingerprint !== null));
  if (citedPrimary) return { state: NewsEventStatus.Verified, confidence: 0.9, reason: "CITED_PRIMARY_CROSS_CHECK" };
  const factsAgree = supporting.length > 0 && supporting.every((record) => JSON.stringify(Object.fromEntries(Object.entries(record.keyFacts).sort(([a],[b]) => a.localeCompare(b)))) === JSON.stringify(Object.fromEntries(Object.entries(supporting[0]!.keyFacts).sort(([a],[b]) => a.localeCompare(b)))));
  if (factsAgree && independenceKeys(supporting).length >= 2) return { state: NewsEventStatus.Verified, confidence: 0.8, reason: "INDEPENDENT_SOURCE_QUORUM" };
  return { state: NewsEventStatus.Verifying, confidence: 0, reason: "INDEPENDENCE_OR_PRIMARY_NOT_PROVEN" };
}

const allowed: Readonly<Record<NewsEventStatus, readonly NewsEventStatus[]>> = {
  DISCOVERED: [NewsEventStatus.Normalized, NewsEventStatus.Retracted, NewsEventStatus.Expired], NORMALIZED: [NewsEventStatus.Verifying, NewsEventStatus.Retracted, NewsEventStatus.Expired], VERIFYING: [NewsEventStatus.Verified, NewsEventStatus.Conflicted, NewsEventStatus.Unavailable, NewsEventStatus.Retracted, NewsEventStatus.Expired], VERIFIED: [NewsEventStatus.Conflicted, NewsEventStatus.Retracted, NewsEventStatus.Expired], CONFLICTED: [NewsEventStatus.Verifying, NewsEventStatus.Retracted, NewsEventStatus.Expired], UNAVAILABLE: [NewsEventStatus.Verifying, NewsEventStatus.Retracted, NewsEventStatus.Expired], RETRACTED: [], EXPIRED: [],
};

export function transition(eventId: string, from: NewsEventStatus | null, to: NewsEventStatus, reason: string, evidenceIds: readonly string[], atUtc: string): VerificationTransitionRecord {
  if (from !== null && !(allowed[from] as readonly NewsEventStatus[]).includes(to)) throw new Error(`ILLEGAL_NEWS_TRANSITION: ${from}->${to}`);
  if (from === null && to !== NewsEventStatus.Discovered) throw new Error("ILLEGAL_NEWS_TRANSITION: initial state must be DISCOVERED");
  const triggerFingerprint = createHash("sha256").update(JSON.stringify([...evidenceIds].sort())).digest("hex").slice(0,12);
  return { domainVersion: OPTIONS_NEWS_DOMAIN_VERSION, transitionId: `${eventId}:transition:${atUtc}:${to}:${triggerFingerprint}`, eventId, fromState: from, toState: to, transitionReasonCode: reason, triggeringEvidenceIds: [...evidenceIds].sort(), occurredAtUtc: atUtc, verificationRuleVersion: "options-news-verification:1.0", deterministicActor: "options-news-state-machine:1.0" };
}

export function buildCanonicalEvent(records: readonly NewsEvidenceRecord[], summary: SummaryEnvelope, atUtc: string): CanonicalNewsEvent {
  if (records.length === 0) throw new Error("NO_EVIDENCE");
  const ordered = [...records].sort((a,b) => a.evidenceId.localeCompare(b.evidenceId)); const first = ordered[0] as NewsEvidenceRecord; const fingerprint = canonicalFingerprint(first); const id = `news-event:${fingerprint.slice(0,24)}`;
  const links = records.map((record): EventEvidenceLink => ({ domainVersion: OPTIONS_NEWS_DOMAIN_VERSION, linkId: `${id}:link:${record.evidenceId}`, eventId: id, evidenceId: record.evidenceId, relation: NewsEvidenceRelation.Supports, relationshipReasonCode: "MATCHED_CANONICAL_FACTS", checkedFacts: Object.keys(record.keyFacts).sort(), createdAtUtc: atUtc, ruleVersion: "options-news-clustering:1.0" }));
  const decision = verificationDecision(records, links);
  return { domainVersion: OPTIONS_NEWS_DOMAIN_VERSION, eventId: id, canonicalFingerprint: fingerprint, fingerprintAlgorithm: "SHA-256", fingerprintVersion: "options-news-fingerprint:1.0", canonicalFacts: structuredClone(first.keyFacts), linkedEntities: uniqueEntities(ordered), symbols: [...new Set(ordered.flatMap((v) => v.entityCandidates.map((e) => e.symbol)))].sort(), topics: [...new Set(ordered.flatMap((v) => v.topicCandidates))].sort(), eventType: first.eventTypeCandidate, novelty: "NEW", relevance: "UNKNOWN", impactHypothesis: NewsImpactHypothesis.Unknown, verificationStatus: decision.state, verificationConfidence: decision.confidence, supportingEvidenceIds: ordered.map((v) => v.evidenceId), conflictingEvidenceIds: [], retractingEvidenceIds: [], discoveredAtUtc: ordered.map((v) => v.ingestedAtUtc).sort()[0]!, normalizedAtUtc: ordered.map((v) => v.normalizedAtUtc).sort().at(-1)!, verificationStartedAtUtc: atUtc, verifiedAtUtc: decision.state === NewsEventStatus.Verified ? atUtc : null, displayTimezone: "America/New_York", summary, currentStateReasonCode: decision.reason };
}

function uniqueEntities(records: readonly NewsEvidenceRecord[]): readonly NewsEntityCandidate[] { const map = new Map<string, NewsEntityCandidate>(); for (const entity of records.flatMap((v) => v.entityCandidates)) map.set(entity.entityId, structuredClone(entity)); return [...map.values()].sort((a,b) => a.entityId.localeCompare(b.entityId)); }
