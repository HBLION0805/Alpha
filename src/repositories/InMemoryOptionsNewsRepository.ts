import type { CanonicalNewsEvent, EventEvidenceLink, NewsEvidenceRecord, VerificationTransitionRecord } from "../contracts/OptionsNewsDomain";
import type { OptionsNewsQuery, OptionsNewsRepository } from "../contracts/OptionsNewsRepository";
import { validateCanonicalNewsEvent, validateEventEvidenceLink, validateNewsEvidenceRecord, validateTransition } from "../engines/options-news/OptionsNewsValidation";

export class InMemoryOptionsNewsRepository implements OptionsNewsRepository {
  private readonly evidence = new Map<string, NewsEvidenceRecord>();
  private readonly events = new Map<string, CanonicalNewsEvent>();
  private readonly links = new Map<string, EventEvidenceLink>();
  private readonly transitions = new Map<string, VerificationTransitionRecord>();
  public putEvidence(record: NewsEvidenceRecord): "APPENDED" | "REPLAYED" { validateNewsEvidenceRecord(record); return putImmutable(this.evidence, record.evidenceId, record); }
  public putEvent(record: CanonicalNewsEvent): "APPENDED" | "REPLAYED" | "UPDATED" { validateCanonicalNewsEvent(record); const existing = this.events.get(record.eventId); if (existing === undefined) { this.events.set(record.eventId, clone(record)); return "APPENDED"; } if (stable(existing) === stable(record)) return "REPLAYED"; if (existing.canonicalFingerprint !== record.canonicalFingerprint) throw new Error("EVENT_IDEMPOTENCY_CONFLICT"); this.events.set(record.eventId, clone(record)); return "UPDATED"; }
  public putLink(record: EventEvidenceLink): "APPENDED" | "REPLAYED" { validateEventEvidenceLink(record); if (!this.events.has(record.eventId) || !this.evidence.has(record.evidenceId)) throw new Error("LINK_REFERENCE_NOT_FOUND"); return putImmutable(this.links, record.linkId, record); }
  public putTransition(record: VerificationTransitionRecord): "APPENDED" | "REPLAYED" { validateTransition(record); if (!this.events.has(record.eventId)) throw new Error("TRANSITION_EVENT_NOT_FOUND"); return putImmutable(this.transitions, record.transitionId, record); }
  public getEvidence(id: string): NewsEvidenceRecord | undefined { return maybeClone(this.evidence.get(id)); }
  public getEvent(id: string): CanonicalNewsEvent | undefined { return maybeClone(this.events.get(id)); }
  public queryEvents(query: OptionsNewsQuery = {}): readonly CanonicalNewsEvent[] { return [...this.events.values()].filter((event) => (!query.topics || query.topics.some((v) => event.topics.includes(v as never))) && (!query.entityIds || query.entityIds.some((v) => event.linkedEntities.some((e) => e.entityId === v))) && (!query.symbols || query.symbols.some((v) => event.symbols.includes(v))) && (!query.eventTypes || query.eventTypes.includes(event.eventType)) && (!query.verificationStatuses || query.verificationStatuses.includes(event.verificationStatus)) && (!query.fromUtc || Date.parse(event.discoveredAtUtc) >= Date.parse(query.fromUtc)) && (!query.toUtc || Date.parse(event.discoveredAtUtc) <= Date.parse(query.toUtc))).sort((a,b) => a.eventId.localeCompare(b.eventId)).map(clone); }
  public listEvidence(eventId: string): readonly NewsEvidenceRecord[] { const ids = new Set(this.listLinks(eventId).map((v) => v.evidenceId)); return [...ids].map((id) => this.evidence.get(id)).filter((v): v is NewsEvidenceRecord => v !== undefined).sort((a,b) => a.evidenceId.localeCompare(b.evidenceId)).map(clone); }
  public listLinks(eventId: string): readonly EventEvidenceLink[] { return [...this.links.values()].filter((v) => v.eventId === eventId).sort((a,b) => a.linkId.localeCompare(b.linkId)).map(clone); }
  public listTransitions(eventId: string): readonly VerificationTransitionRecord[] { return [...this.transitions.values()].filter((v) => v.eventId === eventId).sort((a,b) => Date.parse(a.occurredAtUtc)-Date.parse(b.occurredAtUtc) || a.transitionId.localeCompare(b.transitionId)).map(clone); }
}
function putImmutable<T>(map: Map<string,T>, id: string, value: T): "APPENDED"|"REPLAYED" { const existing = map.get(id); if (existing === undefined) { map.set(id, clone(value)); return "APPENDED"; } if (stable(existing) === stable(value)) return "REPLAYED"; throw new Error("IDEMPOTENCY_CONFLICT"); }
function stable(v: unknown): string { return JSON.stringify(v); }
function clone<T>(v: T): T { return structuredClone(v); }
function maybeClone<T>(v: T | undefined): T | undefined { return v === undefined ? undefined : clone(v); }
