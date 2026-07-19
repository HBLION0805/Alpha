import type {
  AlphaJournalAmendment,
  AlphaJournalAppendResult,
  AlphaJournalEntry,
  AlphaJournalEntryHistory,
  AlphaJournalHistory,
  AlphaJournalQuery,
  AlphaJournalReview,
} from "../contracts";

export type AlphaJournalRepositoryEvent =
  | {
      readonly schemaVersion: "1.0";
      readonly sequence: number;
      readonly fingerprint: string;
      readonly eventType: "ENTRY_FINALIZED";
      readonly acceptedAt: string;
      readonly entry: AlphaJournalEntry;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly sequence: number;
      readonly fingerprint: string;
      readonly eventType: "AMENDMENT_APPENDED";
      readonly acceptedAt: string;
      readonly amendment: AlphaJournalAmendment;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly sequence: number;
      readonly fingerprint: string;
      readonly eventType: "REVIEW_APPENDED";
      readonly acceptedAt: string;
      readonly review: AlphaJournalReview;
      readonly history: AlphaJournalHistory;
    }
  | {
      readonly schemaVersion: "1.0";
      readonly sequence: number;
      readonly fingerprint: string;
      readonly eventType: "ENTRY_ARCHIVED";
      readonly acceptedAt: string;
      readonly history: AlphaJournalHistory;
    };

export interface AlphaJournalRepository {
  appendFinalized(
    entry: AlphaJournalEntry,
    acceptedAt: string,
  ): AlphaJournalAppendResult<AlphaJournalEntry>;
  appendAmendment(
    amendment: AlphaJournalAmendment,
    acceptedAt: string,
  ): AlphaJournalAppendResult<AlphaJournalAmendment>;
  appendReview(
    review: AlphaJournalReview,
    history: AlphaJournalHistory,
    acceptedAt: string,
  ): AlphaJournalAppendResult<AlphaJournalReview>;
  appendArchive(
    history: AlphaJournalHistory,
    acceptedAt: string,
  ): AlphaJournalAppendResult<AlphaJournalHistory>;
  getById(entryId: string): AlphaJournalEntry | undefined;
  getAmendment(amendmentId: string): AlphaJournalAmendment | undefined;
  getReview(reviewId: string): AlphaJournalReview | undefined;
  query(query?: AlphaJournalQuery): ReadonlyArray<AlphaJournalEntry>;
  getEntryHistory(entryId: string): AlphaJournalEntryHistory | undefined;
  listRelatedEntries(entryId: string): ReadonlyArray<AlphaJournalEntry>;
  allEvents(): ReadonlyArray<AlphaJournalRepositoryEvent>;
}

export function matchesAlphaJournalQuery(
  entry: AlphaJournalEntry,
  query: AlphaJournalQuery = {},
): boolean {
  const filter = query.filter;
  if (filter === undefined) return true;
  const hasReference = (
    values: ReadonlyArray<{ readonly referenceId: string }>,
    id: string | undefined,
  ): boolean => id === undefined || values.some((reference) => reference.referenceId === id);
  return (
    (filter.fromEventTimestamp === undefined || Date.parse(entry.eventTimestamp) >= Date.parse(filter.fromEventTimestamp)) &&
    (filter.toEventTimestamp === undefined || Date.parse(entry.eventTimestamp) <= Date.parse(filter.toEventTimestamp)) &&
    (filter.entryTypes === undefined || filter.entryTypes.includes(entry.entryType)) &&
    (filter.statuses === undefined || filter.statuses.includes(entry.status)) &&
    (filter.ticker === undefined || entry.ticker === filter.ticker) &&
    (filter.asset === undefined || entry.asset === filter.asset) &&
    hasReference(entry.evidence.predictions, filter.predictionId) &&
    hasReference(entry.evidence.research, filter.researchId) &&
    hasReference(entry.evidence.trades, filter.tradeId) &&
    hasReference(entry.evidence.strategies, filter.strategyId) &&
    (filter.tags === undefined || filter.tags.every((tag) => entry.tags.includes(tag))) &&
    (filter.correlationId === undefined || entry.correlationId === filter.correlationId) &&
    (filter.traceId === undefined || entry.traceId === filter.traceId) &&
    (filter.privacyLevels === undefined || filter.privacyLevels.includes(entry.privacyLevel))
  );
}
