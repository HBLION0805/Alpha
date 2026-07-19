import {
  AlphaJournalAppendStatus,
  AlphaJournalErrorCategory,
  AlphaJournalStatus,
  alphaJournalFingerprint,
  canonicalizeAlphaJournalValue,
  throwIfInvalidAlphaJournal,
  validateAlphaJournalAmendment,
  validateAlphaJournalEntry,
  validateAlphaJournalHistory,
  validateAlphaJournalQuery,
  validateAlphaJournalReview,
  type AlphaJournalAmendment,
  type AlphaJournalAppendResult,
  type AlphaJournalEntry,
  type AlphaJournalEntryHistory,
  type AlphaJournalHistory,
  type AlphaJournalQuery,
  type AlphaJournalReview,
} from "../contracts";
import {
  matchesAlphaJournalQuery,
  type AlphaJournalRepository,
  type AlphaJournalRepositoryEvent,
} from "./AlphaJournalRepository";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fail(category: AlphaJournalErrorCategory, message: string): never {
  throw new Error(`${category}: ${message}`);
}

type WithoutEventMetadata<T> = T extends AlphaJournalRepositoryEvent
  ? Omit<T, "sequence" | "fingerprint">
  : never;
type JournalEventInput = WithoutEventMetadata<AlphaJournalRepositoryEvent>;

export class InMemoryAlphaJournalRepository implements AlphaJournalRepository {
  private readonly originalEntries = new Map<string, AlphaJournalEntry>();
  private readonly currentEntries = new Map<string, AlphaJournalEntry>();
  private readonly entrySequences = new Map<string, number>();
  private readonly amendments = new Map<string, AlphaJournalAmendment>();
  private readonly amendmentSequences = new Map<string, number>();
  private readonly reviews = new Map<string, AlphaJournalReview>();
  private readonly reviewByEntry = new Map<string, AlphaJournalReview>();
  private readonly reviewSequences = new Map<string, number>();
  private readonly archiveSequences = new Map<string, number>();
  private readonly events: AlphaJournalRepositoryEvent[] = [];

  constructor(seedEvents: ReadonlyArray<AlphaJournalRepositoryEvent> = []) {
    for (const event of seedEvents) this.applySeed(clone(event));
  }

  protected persistEvent(_event: Readonly<AlphaJournalRepositoryEvent>): void {}

  private nextSequence(): number {
    const value = this.events.length + 1;
    if (!Number.isSafeInteger(value)) fail(AlphaJournalErrorCategory.RepositoryCorrupt, "repository sequence overflow.");
    return value;
  }

  private commit(event: AlphaJournalRepositoryEvent, persist: boolean): void {
    if (event.sequence !== this.nextSequence()) fail(AlphaJournalErrorCategory.RepositoryCorrupt, "repository sequence is not contiguous.");
    const payload = { ...event, fingerprint: undefined };
    if (event.fingerprint !== alphaJournalFingerprint(payload)) fail(AlphaJournalErrorCategory.RepositoryCorrupt, "event fingerprint is invalid.");
    if (persist) this.persistEvent(clone(event));
    this.events.push(clone(event));
  }

  private applySeed(event: AlphaJournalRepositoryEvent): void {
    switch (event.eventType) {
      case "ENTRY_FINALIZED":
        this.applyFinalized(event.entry, event.acceptedAt, event, false);
        break;
      case "AMENDMENT_APPENDED":
        this.applyAmendment(event.amendment, event.acceptedAt, event, false);
        break;
      case "REVIEW_APPENDED":
        this.applyReview(event.review, event.history, event.acceptedAt, event, false);
        break;
      case "ENTRY_ARCHIVED":
        this.applyArchive(event.history, event.acceptedAt, event, false);
        break;
      default:
        fail(AlphaJournalErrorCategory.RepositoryCorrupt, "unsupported journal event type.");
    }
  }

  private makeEvent<T extends JournalEventInput>(input: T): T & Pick<AlphaJournalRepositoryEvent, "sequence" | "fingerprint"> {
    const withSequence = { ...input, sequence: this.nextSequence() };
    return { ...withSequence, fingerprint: alphaJournalFingerprint({ ...withSequence, fingerprint: undefined }) } as unknown as T & Pick<AlphaJournalRepositoryEvent, "sequence" | "fingerprint">;
  }

  appendFinalized(entry: AlphaJournalEntry, acceptedAt: string): AlphaJournalAppendResult<AlphaJournalEntry> {
    const existing = this.originalEntries.get(entry.entryId);
    if (existing !== undefined) {
      if (canonicalizeAlphaJournalValue(existing) === canonicalizeAlphaJournalValue(entry)) {
        return { status: AlphaJournalAppendStatus.Replayed, record: clone(existing), repositorySequence: this.entrySequences.get(entry.entryId) as number };
      }
      fail(AlphaJournalErrorCategory.IdempotencyConflict, "entry ID already exists with different content.");
    }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "ENTRY_FINALIZED", acceptedAt, entry: clone(entry) });
    return this.applyFinalized(entry, acceptedAt, event, true);
  }

  private applyFinalized(entry: AlphaJournalEntry, acceptedAt: string, event: Extract<AlphaJournalRepositoryEvent, { eventType: "ENTRY_FINALIZED" }>, persist: boolean): AlphaJournalAppendResult<AlphaJournalEntry> {
    if (this.originalEntries.has(entry.entryId)) fail(AlphaJournalErrorCategory.RepositoryCorrupt, "duplicate entry identity in event history.");
    throwIfInvalidAlphaJournal(validateAlphaJournalEntry(entry, acceptedAt));
    this.commit(event, persist);
    this.originalEntries.set(entry.entryId, clone(entry));
    this.currentEntries.set(entry.entryId, clone(entry));
    this.entrySequences.set(entry.entryId, event.sequence);
    return { status: AlphaJournalAppendStatus.Appended, record: clone(entry), repositorySequence: event.sequence };
  }

  appendAmendment(amendment: AlphaJournalAmendment, acceptedAt: string): AlphaJournalAppendResult<AlphaJournalAmendment> {
    const existing = this.amendments.get(amendment.amendmentId);
    if (existing !== undefined) {
      if (canonicalizeAlphaJournalValue(existing) === canonicalizeAlphaJournalValue(amendment)) return { status: AlphaJournalAppendStatus.Replayed, record: clone(existing), repositorySequence: this.amendmentSequences.get(amendment.amendmentId) as number };
      fail(AlphaJournalErrorCategory.IdempotencyConflict, "amendment ID already exists with different content.");
    }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "AMENDMENT_APPENDED", acceptedAt, amendment: clone(amendment) });
    return this.applyAmendment(amendment, acceptedAt, event, true);
  }

  private applyAmendment(amendment: AlphaJournalAmendment, acceptedAt: string, event: Extract<AlphaJournalRepositoryEvent, { eventType: "AMENDMENT_APPENDED" }>, persist: boolean): AlphaJournalAppendResult<AlphaJournalAmendment> {
    if (this.amendments.has(amendment.amendmentId)) fail(AlphaJournalErrorCategory.RepositoryCorrupt, "duplicate amendment identity in event history.");
    const entry = this.currentEntries.get(amendment.entryId);
    if (entry === undefined) fail(AlphaJournalErrorCategory.EntryNotFound, "amendment requires an existing entry.");
    throwIfInvalidAlphaJournal(validateAlphaJournalAmendment(amendment, entry, acceptedAt));
    if (amendment.parentAmendmentId !== undefined) {
      const parent = this.amendments.get(amendment.parentAmendmentId);
      if (parent === undefined || parent.entryId !== amendment.entryId) fail(AlphaJournalErrorCategory.InvalidReference, "parent amendment does not exist for this entry.");
      const visited = new Set<string>([amendment.amendmentId]);
      let current: AlphaJournalAmendment | undefined = parent;
      while (current !== undefined) {
        if (visited.has(current.amendmentId)) fail(AlphaJournalErrorCategory.InvalidReference, "cyclic amendment relationship is forbidden.");
        visited.add(current.amendmentId);
        current = current.parentAmendmentId === undefined ? undefined : this.amendments.get(current.parentAmendmentId);
      }
    }
    this.commit(event, persist);
    this.amendments.set(amendment.amendmentId, clone(amendment));
    this.amendmentSequences.set(amendment.amendmentId, event.sequence);
    return { status: AlphaJournalAppendStatus.Appended, record: clone(amendment), repositorySequence: event.sequence };
  }

  appendReview(review: AlphaJournalReview, history: AlphaJournalHistory, acceptedAt: string): AlphaJournalAppendResult<AlphaJournalReview> {
    const existing = this.reviews.get(review.reviewId);
    if (existing !== undefined) {
      if (canonicalizeAlphaJournalValue(existing) === canonicalizeAlphaJournalValue(review)) return { status: AlphaJournalAppendStatus.Replayed, record: clone(existing), repositorySequence: this.reviewSequences.get(review.reviewId) as number };
      fail(AlphaJournalErrorCategory.IdempotencyConflict, "review ID already exists with different content.");
    }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "REVIEW_APPENDED", acceptedAt, review: clone(review), history: clone(history) });
    return this.applyReview(review, history, acceptedAt, event, true);
  }

  private applyReview(review: AlphaJournalReview, history: AlphaJournalHistory, acceptedAt: string, event: Extract<AlphaJournalRepositoryEvent, { eventType: "REVIEW_APPENDED" }>, persist: boolean): AlphaJournalAppendResult<AlphaJournalReview> {
    if (this.reviews.has(review.reviewId) || this.reviewByEntry.has(review.entryId)) fail(AlphaJournalErrorCategory.DuplicateId, "entry already has a review or review ID is duplicated.");
    const entry = this.currentEntries.get(review.entryId);
    if (entry === undefined) fail(AlphaJournalErrorCategory.EntryNotFound, "review requires an existing entry.");
    throwIfInvalidAlphaJournal(validateAlphaJournalReview(review, entry, acceptedAt));
    throwIfInvalidAlphaJournal(validateAlphaJournalHistory(history, entry, acceptedAt));
    if (history.toStatus !== AlphaJournalStatus.Reviewed || history.referenceId !== review.reviewId) fail(AlphaJournalErrorCategory.InvalidLifecycle, "review history must advance to REVIEWED and reference the review.");
    this.commit(event, persist);
    this.reviews.set(review.reviewId, clone(review));
    this.reviewByEntry.set(review.entryId, clone(review));
    this.reviewSequences.set(review.reviewId, event.sequence);
    this.currentEntries.set(entry.entryId, { ...clone(entry), status: AlphaJournalStatus.Reviewed, history: [...entry.history.map(clone), clone(history)] });
    return { status: AlphaJournalAppendStatus.Appended, record: clone(review), repositorySequence: event.sequence };
  }

  appendArchive(history: AlphaJournalHistory, acceptedAt: string): AlphaJournalAppendResult<AlphaJournalHistory> {
    const existingSequence = this.archiveSequences.get(history.entryId);
    if (existingSequence !== undefined) {
      const existing = this.currentEntries.get(history.entryId)?.history.find((value) => value.toStatus === AlphaJournalStatus.Archived);
      if (existing !== undefined && canonicalizeAlphaJournalValue(existing) === canonicalizeAlphaJournalValue(history)) return { status: AlphaJournalAppendStatus.Replayed, record: clone(existing), repositorySequence: existingSequence };
      fail(AlphaJournalErrorCategory.IdempotencyConflict, "entry already has a different archive event.");
    }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "ENTRY_ARCHIVED", acceptedAt, history: clone(history) });
    return this.applyArchive(history, acceptedAt, event, true);
  }

  private applyArchive(history: AlphaJournalHistory, acceptedAt: string, event: Extract<AlphaJournalRepositoryEvent, { eventType: "ENTRY_ARCHIVED" }>, persist: boolean): AlphaJournalAppendResult<AlphaJournalHistory> {
    if (this.archiveSequences.has(history.entryId)) fail(AlphaJournalErrorCategory.RepositoryCorrupt, "duplicate archive event in history.");
    const entry = this.currentEntries.get(history.entryId);
    if (entry === undefined) fail(AlphaJournalErrorCategory.EntryNotFound, "archive requires an existing entry.");
    throwIfInvalidAlphaJournal(validateAlphaJournalHistory(history, entry, acceptedAt));
    if (history.toStatus !== AlphaJournalStatus.Archived) fail(AlphaJournalErrorCategory.InvalidLifecycle, "archive event must transition to ARCHIVED.");
    this.commit(event, persist);
    this.archiveSequences.set(entry.entryId, event.sequence);
    this.currentEntries.set(entry.entryId, { ...clone(entry), status: AlphaJournalStatus.Archived, history: [...entry.history.map(clone), clone(history)] });
    return { status: AlphaJournalAppendStatus.Appended, record: clone(history), repositorySequence: event.sequence };
  }

  getById(entryId: string): AlphaJournalEntry | undefined {
    const value = this.currentEntries.get(entryId);
    return value === undefined ? undefined : clone(value);
  }

  getAmendment(amendmentId: string): AlphaJournalAmendment | undefined {
    const value = this.amendments.get(amendmentId);
    return value === undefined ? undefined : clone(value);
  }

  getReview(reviewId: string): AlphaJournalReview | undefined {
    const value = this.reviews.get(reviewId);
    return value === undefined ? undefined : clone(value);
  }

  query(query: AlphaJournalQuery = {}): ReadonlyArray<AlphaJournalEntry> {
    throwIfInvalidAlphaJournal(validateAlphaJournalQuery(query));
    return [...this.currentEntries.values()]
      .filter((entry) => matchesAlphaJournalQuery(entry, query))
      .sort((left, right) => (this.entrySequences.get(left.entryId) as number) - (this.entrySequences.get(right.entryId) as number))
      .slice(query.offset ?? 0, (query.offset ?? 0) + (query.limit ?? Number.MAX_SAFE_INTEGER))
      .map(clone);
  }

  getEntryHistory(entryId: string): AlphaJournalEntryHistory | undefined {
    const entry = this.getById(entryId);
    if (entry === undefined) return undefined;
    const amendments = [...this.amendments.values()].filter((value) => value.entryId === entryId).sort((a, b) => (this.amendmentSequences.get(a.amendmentId) as number) - (this.amendmentSequences.get(b.amendmentId) as number)).map(clone);
    const reviews = [...this.reviews.values()].filter((value) => value.entryId === entryId).sort((a, b) => (this.reviewSequences.get(a.reviewId) as number) - (this.reviewSequences.get(b.reviewId) as number)).map(clone);
    return { entry, lifecycle: entry.history.map(clone), amendments, reviews };
  }

  listRelatedEntries(entryId: string): ReadonlyArray<AlphaJournalEntry> {
    const entry = this.currentEntries.get(entryId);
    if (entry === undefined) return [];
    return [...this.currentEntries.values()]
      .filter((candidate) => candidate.entryId !== entryId && (entry.evidence.journalEntries.some((reference) => reference.referenceId === candidate.entryId) || candidate.evidence.journalEntries.some((reference) => reference.referenceId === entryId)))
      .sort((left, right) => (this.entrySequences.get(left.entryId) as number) - (this.entrySequences.get(right.entryId) as number))
      .map(clone);
  }

  allEvents(): ReadonlyArray<AlphaJournalRepositoryEvent> {
    return this.events.map(clone);
  }
}
