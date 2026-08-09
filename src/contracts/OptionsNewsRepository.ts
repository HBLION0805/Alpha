import type { CanonicalNewsEvent, EventEvidenceLink, NewsEvidenceRecord, VerificationTransitionRecord } from "./OptionsNewsDomain";

export interface OptionsNewsQuery {
  readonly topics?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly symbols?: readonly string[];
  readonly eventTypes?: readonly string[];
  readonly verificationStatuses?: readonly string[];
  readonly fromUtc?: string;
  readonly toUtc?: string;
}

export interface OptionsNewsRepository {
  putEvidence(record: NewsEvidenceRecord): "APPENDED" | "REPLAYED";
  putEvent(record: CanonicalNewsEvent): "APPENDED" | "REPLAYED" | "UPDATED";
  putLink(record: EventEvidenceLink): "APPENDED" | "REPLAYED";
  putTransition(record: VerificationTransitionRecord): "APPENDED" | "REPLAYED";
  getEvidence(evidenceId: string): NewsEvidenceRecord | undefined;
  getEvent(eventId: string): CanonicalNewsEvent | undefined;
  queryEvents(query?: OptionsNewsQuery): readonly CanonicalNewsEvent[];
  listEvidence(eventId: string): readonly NewsEvidenceRecord[];
  listLinks(eventId: string): readonly EventEvidenceLink[];
  listTransitions(eventId: string): readonly VerificationTransitionRecord[];
}
