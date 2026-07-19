import {
  AlphaJournalEntryType,
  AlphaJournalQuality,
  AlphaJournalStatus,
  createAlphaJournalEntryId,
  throwIfInvalidAlphaJournal,
  validateAlphaJournalAmendment,
  validateAlphaJournalHistory,
  validateAlphaJournalReview,
  validateAlphaJournalSnapshot,
  type AlphaJournalAmendment,
  type AlphaJournalAppendResult,
  type AlphaJournalEntry,
  type AlphaJournalEntryHistory,
  type AlphaJournalEntrySnapshot,
  type AlphaJournalFilter,
  type AlphaJournalHistory,
  type AlphaJournalQuery,
  type AlphaJournalReview,
  type AlphaJournalStatistics,
  type AlphaJournalSummary,
} from "../../contracts";
import type { AlphaJournalRepository } from "../../repositories";

export interface AlphaJournalClock {
  now(): string;
}

export class SystemAlphaJournalClock implements AlphaJournalClock {
  now(): string {
    return new Date().toISOString();
  }
}

function requiredEntry(repository: AlphaJournalRepository, entryId: string): AlphaJournalEntry {
  const entry = repository.getById(entryId);
  if (entry === undefined) throw new Error("ENTRY_NOT_FOUND: journal entry does not exist.");
  return entry;
}

export class AlphaJournal {
  constructor(
    private readonly repository: AlphaJournalRepository,
    private readonly clock: AlphaJournalClock = new SystemAlphaJournalClock(),
  ) {}

  finalize(snapshot: AlphaJournalEntrySnapshot): AlphaJournalAppendResult<AlphaJournalEntry> {
    const now = this.clock.now();
    throwIfInvalidAlphaJournal(validateAlphaJournalSnapshot(snapshot, now));
    const entryId = createAlphaJournalEntryId(snapshot);
    const history: AlphaJournalHistory = {
      historyId: `${entryId}:history:1`,
      entryId,
      lifecycleSequence: 1,
      fromStatus: AlphaJournalStatus.Draft,
      toStatus: AlphaJournalStatus.Finalized,
      occurredAt: snapshot.createdAt,
      reason: "Journal entry finalized as authoritative point-in-time evidence.",
    };
    const entry: AlphaJournalEntry = {
      ...structuredClone(snapshot),
      entryId,
      status: AlphaJournalStatus.Finalized,
      history: [history],
    };
    return this.repository.appendFinalized(entry, now);
  }

  amend(amendment: AlphaJournalAmendment): AlphaJournalAppendResult<AlphaJournalAmendment> {
    const entry = requiredEntry(this.repository, amendment.entryId);
    const now = this.clock.now();
    throwIfInvalidAlphaJournal(validateAlphaJournalAmendment(amendment, entry, now));
    return this.repository.appendAmendment(structuredClone(amendment), now);
  }

  review(review: AlphaJournalReview): AlphaJournalAppendResult<AlphaJournalReview> {
    const entry = requiredEntry(this.repository, review.entryId);
    const now = this.clock.now();
    throwIfInvalidAlphaJournal(validateAlphaJournalReview(review, entry, now));
    const history = this.historyEvent(entry, AlphaJournalStatus.Reviewed, review.createdAt, "Append-only journal review completed.", review.reviewId);
    throwIfInvalidAlphaJournal(validateAlphaJournalHistory(history, entry, now));
    return this.repository.appendReview(structuredClone(review), history, now);
  }

  archive(entryId: string, occurredAt: string, reason: string): AlphaJournalAppendResult<AlphaJournalHistory> {
    const entry = requiredEntry(this.repository, entryId);
    const now = this.clock.now();
    const history = this.historyEvent(entry, AlphaJournalStatus.Archived, occurredAt, reason);
    throwIfInvalidAlphaJournal(validateAlphaJournalHistory(history, entry, now));
    return this.repository.appendArchive(history, now);
  }

  get(entryId: string): AlphaJournalEntry | undefined {
    return this.repository.getById(entryId);
  }

  query(query: AlphaJournalQuery = {}): ReadonlyArray<AlphaJournalEntry> {
    return this.repository.query(query);
  }

  history(entryId: string): AlphaJournalEntryHistory | undefined {
    return this.repository.getEntryHistory(entryId);
  }

  related(entryId: string): ReadonlyArray<AlphaJournalEntry> {
    return this.repository.listRelatedEntries(entryId);
  }

  summary(entryId: string): AlphaJournalSummary | undefined {
    const history = this.repository.getEntryHistory(entryId);
    if (history === undefined) return undefined;
    const entry = history.entry;
    return {
      entryId: entry.entryId,
      eventTimestamp: entry.eventTimestamp,
      entryType: entry.entryType,
      title: entry.title,
      status: entry.status,
      ...(entry.market === undefined ? {} : { market: entry.market }),
      ...(entry.ticker === undefined ? {} : { ticker: entry.ticker }),
      ...(entry.asset === undefined ? {} : { asset: entry.asset }),
      tags: structuredClone(entry.tags),
      reviewed: history.reviews.length > 0,
      amendmentCount: history.amendments.length,
    };
  }

  statistics(filter?: AlphaJournalFilter): AlphaJournalStatistics {
    const entries = this.repository.query(filter === undefined ? {} : { filter });
    const histories = entries.map((entry) => this.repository.getEntryHistory(entry.entryId) as AlphaJournalEntryHistory);
    const byCategory: Partial<Record<AlphaJournalEntryType, number>> = {};
    const byDay: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byTickerOrAsset: Record<string, number> = {};
    const lessonsByTag: Record<string, number> = {};
    const processQualityDistribution: Partial<Record<AlphaJournalQuality, number>> = {};
    let reviewedEntries = 0;
    let predictionLinkedEntries = 0;
    let strategyLinkedEntries = 0;
    for (const history of histories) {
      const entry = history.entry;
      byCategory[entry.entryType] = (byCategory[entry.entryType] ?? 0) + 1;
      const day = entry.eventTimestamp.slice(0, 10);
      const month = entry.eventTimestamp.slice(0, 7);
      byDay[day] = (byDay[day] ?? 0) + 1;
      byMonth[month] = (byMonth[month] ?? 0) + 1;
      const subject = entry.ticker ?? entry.asset;
      if (subject !== undefined) byTickerOrAsset[subject] = (byTickerOrAsset[subject] ?? 0) + 1;
      if (entry.evidence.predictions.length > 0) predictionLinkedEntries += 1;
      if (entry.evidence.strategies.length > 0) strategyLinkedEntries += 1;
      if (history.reviews.length > 0) reviewedEntries += 1;
      for (const review of history.reviews) {
        processQualityDistribution[review.processQuality] = (processQualityDistribution[review.processQuality] ?? 0) + 1;
        for (const lesson of review.lessons) for (const tag of lesson.tags) lessonsByTag[tag] = (lessonsByTag[tag] ?? 0) + 1;
      }
    }
    return {
      generatedAt: this.clock.now(),
      totalEntries: entries.length,
      reviewedEntries,
      unreviewedEntries: entries.length - reviewedEntries,
      predictionLinkedEntries,
      strategyLinkedEntries,
      byCategory,
      byDay,
      byMonth,
      byTickerOrAsset,
      lessonsByTag,
      processQualityDistribution,
    };
  }

  private historyEvent(
    entry: AlphaJournalEntry,
    toStatus: AlphaJournalStatus,
    occurredAt: string,
    reason: string,
    referenceId?: string,
  ): AlphaJournalHistory {
    const lifecycleSequence = entry.history.length + 1;
    const base = {
      historyId: `${entry.entryId}:history:${String(lifecycleSequence)}`,
      entryId: entry.entryId,
      lifecycleSequence,
      fromStatus: entry.status,
      toStatus,
      occurredAt,
      reason,
    };
    return referenceId === undefined ? base : { ...base, referenceId };
  }
}
