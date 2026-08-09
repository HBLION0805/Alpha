import type { CanonicalNewsEvent, EventEvidenceLink, NewsEvidenceRecord, VerificationTransitionRecord } from "../contracts/OptionsNewsDomain";

/** Controlled, read-only projection into existing Evidence/Journal vocabulary; it does not mutate either legacy contract. */
export interface OptionsNewsEvidenceJournalProjection {
  readonly schemaVersion: "options-news-evidence-journal-projection:1.0";
  readonly namespace: "OPTIONS_NEWS";
  readonly subjectId: string;
  readonly evidenceReferences: readonly { readonly referenceId: string; readonly rawPayloadHash: string; readonly sourceId: string }[];
  readonly linkReferences: readonly string[];
  readonly transitionReferences: readonly string[];
  readonly provenance: readonly string[];
  readonly readOnly: true;
}

export class OptionsNewsEvidenceJournalAdapter {
  public project(event: CanonicalNewsEvent, evidence: readonly NewsEvidenceRecord[], links: readonly EventEvidenceLink[], transitions: readonly VerificationTransitionRecord[]): OptionsNewsEvidenceJournalProjection {
    return { schemaVersion: "options-news-evidence-journal-projection:1.0", namespace: "OPTIONS_NEWS", subjectId: event.eventId, evidenceReferences: evidence.map((v) => ({ referenceId: v.evidenceId, rawPayloadHash: v.rawPayloadHash, sourceId: v.sourceId })).sort((a,b) => a.referenceId.localeCompare(b.referenceId)), linkReferences: links.map((v) => v.linkId).sort(), transitionReferences: transitions.map((v) => v.transitionId).sort(), provenance: [...new Set(evidence.map((v) => v.rawPayloadReference))].sort(), readOnly: true };
  }
}
