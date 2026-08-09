import { OPTIONS_NEWS_DOMAIN_VERSION, NewsEventStatus, NewsEvidenceRelation, type EventEvidenceLink, type VerificationTransitionRecord } from "../../contracts/OptionsNewsDomain";
import type { OptionsNewsPipelineResult } from "../../contracts/OptionsNewsOperations";
import type { NewsFixtureTransport, NewsProviderAdapter, NewsProviderRequest } from "../../contracts/OptionsNewsProvider";
import type { OptionsNewsRepository } from "../../contracts/OptionsNewsRepository";
import { buildCanonicalEvent, transition } from "./OptionsNewsProcessing";
import { DeterministicNewsSummaryProvider } from "./DeterministicNewsSummary";

export class OptionsNewsPipeline {
  public constructor(private readonly repository: OptionsNewsRepository, private readonly summary = new DeterministicNewsSummaryProvider()) {}
  public run(adapter: NewsProviderAdapter, transport: NewsFixtureTransport, request: NewsProviderRequest, verifiedAtUtc: string): OptionsNewsPipelineResult {
    const raw = transport.execute(adapter.buildRequest(request)); const evidence = adapter.normalize(raw, request);
    if (evidence.length === 0) return { status: NewsEventStatus.Unavailable, eventId: null, reasonCode: "NO_PROVIDER_RECORDS" };
    for (const record of evidence) this.repository.putEvidence(record);
    const candidate = buildCanonicalEvent(evidence, this.summary.summarize({ evidence, generatedAtUtc: verifiedAtUtc }), verifiedAtUtc);
    const previous = this.repository.getEvent(candidate.eventId);
    const combinedEvidence = [...new Map([
      ...(previous?.supportingEvidenceIds ?? []).map((id) => [id, this.repository.getEvidence(id)] as const),
      ...evidence.map((record) => [record.evidenceId, record] as const),
    ].filter((entry): entry is readonly [string, NonNullable<ReturnType<OptionsNewsRepository["getEvidence"]>>] => entry[1] !== undefined)).values()].sort((a,b) => a.evidenceId.localeCompare(b.evidenceId));
    const event = buildCanonicalEvent(combinedEvidence, this.summary.summarize({ evidence: combinedEvidence, generatedAtUtc: verifiedAtUtc }), verifiedAtUtc); this.repository.putEvent(event);
    const links: EventEvidenceLink[] = evidence.map((record) => ({ domainVersion: OPTIONS_NEWS_DOMAIN_VERSION, linkId: `${event.eventId}:link:${record.evidenceId}`, eventId: event.eventId, evidenceId: record.evidenceId, relation: NewsEvidenceRelation.Supports, relationshipReasonCode: "MATCHED_CANONICAL_FACTS", checkedFacts: Object.keys(record.keyFacts).sort(), createdAtUtc: verifiedAtUtc, ruleVersion: "options-news-clustering:1.0" }));
    for (const link of links) this.repository.putLink(link);
    const transitions: VerificationTransitionRecord[] = previous === undefined
      ? [transition(event.eventId,null,NewsEventStatus.Discovered,"FIRST_OBSERVATION",combinedEvidence.map((v)=>v.evidenceId),event.discoveredAtUtc),transition(event.eventId,NewsEventStatus.Discovered,NewsEventStatus.Normalized,"NORMALIZATION_SUCCEEDED",combinedEvidence.map((v)=>v.evidenceId),event.normalizedAtUtc),transition(event.eventId,NewsEventStatus.Normalized,NewsEventStatus.Verifying,"VERIFICATION_STARTED",combinedEvidence.map((v)=>v.evidenceId),event.verificationStartedAtUtc)]
      : [];
    if (previous === undefined && event.verificationStatus !== NewsEventStatus.Verifying) transitions.push(transition(event.eventId,NewsEventStatus.Verifying,event.verificationStatus,event.currentStateReasonCode,combinedEvidence.map((v)=>v.evidenceId),verifiedAtUtc));
    if (previous !== undefined && previous.verificationStatus !== event.verificationStatus) transitions.push(transition(event.eventId,previous.verificationStatus,event.verificationStatus,event.currentStateReasonCode,combinedEvidence.map((v)=>v.evidenceId),verifiedAtUtc));
    for (const record of transitions) this.repository.putTransition(record);
    return { status: event.verificationStatus, eventId: event.eventId, reasonCode: event.currentStateReasonCode };
  }
}
