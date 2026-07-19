import {
  ResearchAppendStatus, ResearchErrorCategory, ResearchStatus,
  canonicalizeResearchValue, researchFingerprint, throwIfInvalidResearch,
  validateResearchAmendment, validateResearchHistory, validateResearchQuery,
  validateResearchRecord, validateResearchReview, validateResearchSupersession,
  type ResearchAmendment, type ResearchAppendResult, type ResearchHistory,
  type ResearchQuery, type ResearchRecord, type ResearchRecordHistory,
  type ResearchReview, type ResearchSupersession,
} from "../contracts";
import { matchesResearchQuery, type ResearchRepository, type ResearchRepositoryEvent } from "./ResearchRepository";

const clone = <T>(value: T): T => structuredClone(value);
function fail(category: ResearchErrorCategory, message: string): never { throw new Error(`${category}: ${message}`); }
type EventInput = ResearchRepositoryEvent extends infer T ? T extends ResearchRepositoryEvent ? Omit<T, "sequence" | "fingerprint"> : never : never;

export class InMemoryResearchRepository implements ResearchRepository {
  private readonly originals = new Map<string, ResearchRecord>();
  private readonly current = new Map<string, ResearchRecord>();
  private readonly recordSequences = new Map<string, number>();
  private readonly amendments = new Map<string, ResearchAmendment>();
  private readonly amendmentSequences = new Map<string, number>();
  private readonly reviews = new Map<string, ResearchReview>();
  private readonly reviewByResearch = new Map<string, ResearchReview>();
  private readonly reviewSequences = new Map<string, number>();
  private readonly supersessions = new Map<string, ResearchSupersession>();
  private readonly supersessionByPrior = new Map<string, ResearchSupersession>();
  private readonly supersessionSequences = new Map<string, number>();
  private readonly archiveSequences = new Map<string, number>();
  private readonly events: ResearchRepositoryEvent[] = [];

  constructor(seedEvents: ReadonlyArray<ResearchRepositoryEvent> = []) { for (const event of seedEvents) this.applySeed(clone(event)); }
  protected persistEvent(_event: Readonly<ResearchRepositoryEvent>): void {}
  private nextSequence(): number { const value = this.events.length + 1; if (!Number.isSafeInteger(value)) fail(ResearchErrorCategory.RepositoryCorrupt, "repository sequence overflow."); return value; }
  private makeEvent<T extends EventInput>(input: T): T & Pick<ResearchRepositoryEvent, "sequence" | "fingerprint"> { const withSequence = { ...input, sequence: this.nextSequence() }; return { ...withSequence, fingerprint: researchFingerprint({ ...withSequence, fingerprint: undefined }) } as T & Pick<ResearchRepositoryEvent, "sequence" | "fingerprint">; }
  private commit(event: ResearchRepositoryEvent, persist: boolean): void { if (event.sequence !== this.nextSequence()) fail(ResearchErrorCategory.RepositoryCorrupt, "repository sequence is not contiguous."); if (event.fingerprint !== researchFingerprint({ ...event, fingerprint: undefined })) fail(ResearchErrorCategory.RepositoryCorrupt, "event fingerprint is invalid."); if (persist) this.persistEvent(clone(event)); this.events.push(clone(event)); }
  private applySeed(event: ResearchRepositoryEvent): void {
    switch (event.eventType) {
      case "RESEARCH_FINALIZED": this.applyFinalized(event.record, event.acceptedAt, event, false); break;
      case "AMENDMENT_APPENDED": this.applyAmendment(event.amendment, event.acceptedAt, event, false); break;
      case "REVIEW_APPENDED": this.applyReview(event.review, event.history, event.acceptedAt, event, false); break;
      case "SUPERSESSION_APPENDED": this.applySupersession(event.supersession, event.history, event.acceptedAt, event, false); break;
      case "RESEARCH_ARCHIVED": this.applyArchive(event.history, event.acceptedAt, event, false); break;
      default: fail(ResearchErrorCategory.RepositoryCorrupt, "unsupported research event type.");
    }
  }

  appendFinalized(record: ResearchRecord, acceptedAt: string): ResearchAppendResult<ResearchRecord> {
    const existing = this.originals.get(record.researchId); if (existing !== undefined) { if (canonicalizeResearchValue(existing) === canonicalizeResearchValue(record)) return { status: ResearchAppendStatus.Replayed, record: clone(existing), repositorySequence: this.recordSequences.get(record.researchId) as number }; fail(ResearchErrorCategory.IdempotencyConflict, "research ID already exists with different content."); }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "RESEARCH_FINALIZED", acceptedAt, record: clone(record) }); return this.applyFinalized(record, acceptedAt, event, true);
  }
  private applyFinalized(record: ResearchRecord, acceptedAt: string, event: Extract<ResearchRepositoryEvent, { eventType: "RESEARCH_FINALIZED" }>, persist: boolean): ResearchAppendResult<ResearchRecord> {
    if (this.originals.has(record.researchId)) fail(ResearchErrorCategory.RepositoryCorrupt, "duplicate research identity in event history."); throwIfInvalidResearch(validateResearchRecord(record, acceptedAt)); this.commit(event, persist); this.originals.set(record.researchId, clone(record)); this.current.set(record.researchId, clone(record)); this.recordSequences.set(record.researchId, event.sequence); return { status: ResearchAppendStatus.Appended, record: clone(record), repositorySequence: event.sequence };
  }

  appendAmendment(amendment: ResearchAmendment, acceptedAt: string): ResearchAppendResult<ResearchAmendment> {
    const existing = this.amendments.get(amendment.amendmentId); if (existing !== undefined) { if (canonicalizeResearchValue(existing) === canonicalizeResearchValue(amendment)) return { status: ResearchAppendStatus.Replayed, record: clone(existing), repositorySequence: this.amendmentSequences.get(amendment.amendmentId) as number }; fail(ResearchErrorCategory.IdempotencyConflict, "amendment ID conflict."); }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "AMENDMENT_APPENDED", acceptedAt, amendment: clone(amendment) }); return this.applyAmendment(amendment, acceptedAt, event, true);
  }
  private applyAmendment(amendment: ResearchAmendment, acceptedAt: string, event: Extract<ResearchRepositoryEvent, { eventType: "AMENDMENT_APPENDED" }>, persist: boolean): ResearchAppendResult<ResearchAmendment> {
    if (this.amendments.has(amendment.amendmentId)) fail(ResearchErrorCategory.RepositoryCorrupt, "duplicate amendment in history."); const record = this.current.get(amendment.researchId); if (record === undefined) fail(ResearchErrorCategory.RecordNotFound, "amendment requires existing research."); throwIfInvalidResearch(validateResearchAmendment(amendment, record, acceptedAt));
    if (amendment.parentAmendmentId !== undefined) { const parent = this.amendments.get(amendment.parentAmendmentId); if (parent === undefined || parent.researchId !== amendment.researchId) fail(ResearchErrorCategory.InvalidReference, "parent amendment does not exist for this research."); const visited = new Set<string>([amendment.amendmentId]); let cursor: ResearchAmendment | undefined = parent; while (cursor !== undefined) { if (visited.has(cursor.amendmentId)) fail(ResearchErrorCategory.InvalidReference, "cyclic amendment chain is forbidden."); visited.add(cursor.amendmentId); cursor = cursor.parentAmendmentId === undefined ? undefined : this.amendments.get(cursor.parentAmendmentId); } }
    this.commit(event, persist); this.amendments.set(amendment.amendmentId, clone(amendment)); this.amendmentSequences.set(amendment.amendmentId, event.sequence); return { status: ResearchAppendStatus.Appended, record: clone(amendment), repositorySequence: event.sequence };
  }

  appendReview(review: ResearchReview, history: ResearchHistory, acceptedAt: string): ResearchAppendResult<ResearchReview> {
    const existing = this.reviews.get(review.reviewId); if (existing !== undefined) { if (canonicalizeResearchValue(existing) === canonicalizeResearchValue(review)) return { status: ResearchAppendStatus.Replayed, record: clone(existing), repositorySequence: this.reviewSequences.get(review.reviewId) as number }; fail(ResearchErrorCategory.IdempotencyConflict, "review ID conflict."); }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "REVIEW_APPENDED", acceptedAt, review: clone(review), history: clone(history) }); return this.applyReview(review, history, acceptedAt, event, true);
  }
  private applyReview(review: ResearchReview, history: ResearchHistory, acceptedAt: string, event: Extract<ResearchRepositoryEvent, { eventType: "REVIEW_APPENDED" }>, persist: boolean): ResearchAppendResult<ResearchReview> {
    if (this.reviews.has(review.reviewId) || this.reviewByResearch.has(review.researchId)) fail(ResearchErrorCategory.DuplicateId, "research already has a review or review ID is duplicated."); const record = this.current.get(review.researchId); if (record === undefined) fail(ResearchErrorCategory.RecordNotFound, "review requires existing research."); throwIfInvalidResearch(validateResearchReview(review, record, acceptedAt)); throwIfInvalidResearch(validateResearchHistory(history, record, acceptedAt)); if (history.toStatus !== ResearchStatus.Reviewed || history.referenceId !== review.reviewId) fail(ResearchErrorCategory.InvalidLifecycle, "review history is invalid."); this.commit(event, persist); this.reviews.set(review.reviewId, clone(review)); this.reviewByResearch.set(review.researchId, clone(review)); this.reviewSequences.set(review.reviewId, event.sequence); this.current.set(record.researchId, { ...clone(record), status: ResearchStatus.Reviewed, history: [...record.history.map(clone), clone(history)] }); return { status: ResearchAppendStatus.Appended, record: clone(review), repositorySequence: event.sequence };
  }

  appendSupersession(value: ResearchSupersession, history: ResearchHistory, acceptedAt: string): ResearchAppendResult<ResearchSupersession> {
    const existing = this.supersessions.get(value.supersessionId); if (existing !== undefined) { if (canonicalizeResearchValue(existing) === canonicalizeResearchValue(value)) return { status: ResearchAppendStatus.Replayed, record: clone(existing), repositorySequence: this.supersessionSequences.get(value.supersessionId) as number }; fail(ResearchErrorCategory.IdempotencyConflict, "supersession ID conflict."); }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "SUPERSESSION_APPENDED", acceptedAt, supersession: clone(value), history: clone(history) }); return this.applySupersession(value, history, acceptedAt, event, true);
  }
  private applySupersession(value: ResearchSupersession, history: ResearchHistory, acceptedAt: string, event: Extract<ResearchRepositoryEvent, { eventType: "SUPERSESSION_APPENDED" }>, persist: boolean): ResearchAppendResult<ResearchSupersession> {
    if (this.supersessions.has(value.supersessionId) || this.supersessionByPrior.has(value.priorResearchId)) fail(ResearchErrorCategory.DuplicateId, "prior research already has a supersession or ID is duplicated.");
    const prior = this.current.get(value.priorResearchId); const next = this.current.get(value.newResearchId);
    if (prior === undefined || next === undefined) fail(ResearchErrorCategory.RecordNotFound, "supersession requires both research records.");
    throwIfInvalidResearch(validateResearchSupersession(value, prior, next, acceptedAt));
    const visited = new Set<string>([next.researchId]); let cursor: ResearchRecord | undefined = prior;
    while (cursor !== undefined) { if (visited.has(cursor.researchId)) fail(ResearchErrorCategory.InvalidReference, "cyclic supersession chain is forbidden."); visited.add(cursor.researchId); cursor = cursor.supersedesResearchId === undefined ? undefined : this.current.get(cursor.supersedesResearchId); }
    throwIfInvalidResearch(validateResearchHistory(history, prior, acceptedAt));
    if (history.toStatus !== ResearchStatus.Superseded || history.referenceId !== value.supersessionId) fail(ResearchErrorCategory.InvalidLifecycle, "supersession history is invalid.");
    this.commit(event, persist); this.supersessions.set(value.supersessionId, clone(value)); this.supersessionByPrior.set(value.priorResearchId, clone(value)); this.supersessionSequences.set(value.supersessionId, event.sequence); this.current.set(prior.researchId, { ...clone(prior), status: ResearchStatus.Superseded, history: [...prior.history.map(clone), clone(history)] }); return { status: ResearchAppendStatus.Appended, record: clone(value), repositorySequence: event.sequence };
  }

  appendArchive(history: ResearchHistory, acceptedAt: string): ResearchAppendResult<ResearchHistory> {
    const existingSequence = this.archiveSequences.get(history.researchId); if (existingSequence !== undefined) { const existing = this.current.get(history.researchId)?.history.find((value) => value.toStatus === ResearchStatus.Archived); if (existing !== undefined && canonicalizeResearchValue(existing) === canonicalizeResearchValue(history)) return { status: ResearchAppendStatus.Replayed, record: clone(existing), repositorySequence: existingSequence }; fail(ResearchErrorCategory.IdempotencyConflict, "archive conflict."); }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "RESEARCH_ARCHIVED", acceptedAt, history: clone(history) }); return this.applyArchive(history, acceptedAt, event, true);
  }
  private applyArchive(history: ResearchHistory, acceptedAt: string, event: Extract<ResearchRepositoryEvent, { eventType: "RESEARCH_ARCHIVED" }>, persist: boolean): ResearchAppendResult<ResearchHistory> {
    if (this.archiveSequences.has(history.researchId)) fail(ResearchErrorCategory.RepositoryCorrupt, "duplicate archive event."); const record = this.current.get(history.researchId); if (record === undefined) fail(ResearchErrorCategory.RecordNotFound, "archive requires existing research."); throwIfInvalidResearch(validateResearchHistory(history, record, acceptedAt)); if (history.toStatus !== ResearchStatus.Archived) fail(ResearchErrorCategory.InvalidLifecycle, "archive must transition to ARCHIVED."); this.commit(event, persist); this.archiveSequences.set(record.researchId, event.sequence); this.current.set(record.researchId, { ...clone(record), status: ResearchStatus.Archived, history: [...record.history.map(clone), clone(history)] }); return { status: ResearchAppendStatus.Appended, record: clone(history), repositorySequence: event.sequence };
  }

  getById(id: string): ResearchRecord | undefined { const value = this.current.get(id); return value === undefined ? undefined : clone(value); }
  getAmendment(id: string): ResearchAmendment | undefined { const value = this.amendments.get(id); return value === undefined ? undefined : clone(value); }
  getReview(id: string): ResearchReview | undefined { const value = this.reviews.get(id); return value === undefined ? undefined : clone(value); }
  getSupersession(id: string): ResearchSupersession | undefined { const value = this.supersessions.get(id); return value === undefined ? undefined : clone(value); }
  query(query: ResearchQuery = {}): ReadonlyArray<ResearchRecord> { throwIfInvalidResearch(validateResearchQuery(query)); const offset = query.offset ?? 0; return [...this.current.values()].filter((record) => matchesResearchQuery(record, query)).sort((left, right) => (this.recordSequences.get(left.researchId) as number) - (this.recordSequences.get(right.researchId) as number)).slice(offset, offset + (query.limit ?? Number.MAX_SAFE_INTEGER)).map(clone); }
  getResearchHistory(id: string): ResearchRecordHistory | undefined { const record = this.getById(id); if (record === undefined) return undefined; const amendments = [...this.amendments.values()].filter((value) => value.researchId === id).sort((a, b) => (this.amendmentSequences.get(a.amendmentId) as number) - (this.amendmentSequences.get(b.amendmentId) as number)).map(clone); const reviews = [...this.reviews.values()].filter((value) => value.researchId === id).sort((a, b) => (this.reviewSequences.get(a.reviewId) as number) - (this.reviewSequences.get(b.reviewId) as number)).map(clone); const supersessions = [...this.supersessions.values()].filter((value) => value.priorResearchId === id || value.newResearchId === id).sort((a, b) => (this.supersessionSequences.get(a.supersessionId) as number) - (this.supersessionSequences.get(b.supersessionId) as number)).map(clone); return { record, lifecycle: record.history.map(clone), amendments, reviews, supersessions }; }
  listRelatedResearch(id: string): ReadonlyArray<ResearchRecord> { const record = this.current.get(id); if (record === undefined) return []; return [...this.current.values()].filter((candidate) => candidate.researchId !== id && (record.references.research.some((reference) => reference.referenceId === candidate.researchId) || candidate.references.research.some((reference) => reference.referenceId === id) || record.supersedesResearchId === candidate.researchId || candidate.supersedesResearchId === id)).sort((left, right) => (this.recordSequences.get(left.researchId) as number) - (this.recordSequences.get(right.researchId) as number)).map(clone); }
  allEvents(): ReadonlyArray<ResearchRepositoryEvent> { return this.events.map(clone); }
}
