import type {
  ResearchAmendment, ResearchAppendResult, ResearchHistory, ResearchQuery,
  ResearchRecord, ResearchRecordHistory, ResearchReview, ResearchSupersession,
} from "../contracts";

export type ResearchRepositoryEvent =
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "RESEARCH_FINALIZED"; readonly acceptedAt: string; readonly record: ResearchRecord }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "AMENDMENT_APPENDED"; readonly acceptedAt: string; readonly amendment: ResearchAmendment }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "REVIEW_APPENDED"; readonly acceptedAt: string; readonly review: ResearchReview; readonly history: ResearchHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "SUPERSESSION_APPENDED"; readonly acceptedAt: string; readonly supersession: ResearchSupersession; readonly history: ResearchHistory }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "RESEARCH_ARCHIVED"; readonly acceptedAt: string; readonly history: ResearchHistory };

export interface ResearchRepository {
  appendFinalized(record: ResearchRecord, acceptedAt: string): ResearchAppendResult<ResearchRecord>;
  appendAmendment(amendment: ResearchAmendment, acceptedAt: string): ResearchAppendResult<ResearchAmendment>;
  appendReview(review: ResearchReview, history: ResearchHistory, acceptedAt: string): ResearchAppendResult<ResearchReview>;
  appendSupersession(supersession: ResearchSupersession, history: ResearchHistory, acceptedAt: string): ResearchAppendResult<ResearchSupersession>;
  appendArchive(history: ResearchHistory, acceptedAt: string): ResearchAppendResult<ResearchHistory>;
  getById(researchId: string): ResearchRecord | undefined;
  getAmendment(amendmentId: string): ResearchAmendment | undefined;
  getReview(reviewId: string): ResearchReview | undefined;
  getSupersession(supersessionId: string): ResearchSupersession | undefined;
  getResearchHistory(researchId: string): ResearchRecordHistory | undefined;
  query(query?: ResearchQuery): ReadonlyArray<ResearchRecord>;
  listRelatedResearch(researchId: string): ReadonlyArray<ResearchRecord>;
  allEvents(): ReadonlyArray<ResearchRepositoryEvent>;
}

export function matchesResearchQuery(record: ResearchRecord, query: ResearchQuery = {}): boolean {
  const filter = query.filter; if (filter === undefined) return true;
  const eventAt = record.eventTimestamp ?? record.finalizedAt;
  const has = (values: ReadonlyArray<{ readonly referenceId: string }>, id: string | undefined): boolean => id === undefined || values.some((reference) => reference.referenceId === id);
  return (filter.fromEventTimestamp === undefined || Date.parse(eventAt) >= Date.parse(filter.fromEventTimestamp))
    && (filter.toEventTimestamp === undefined || Date.parse(eventAt) <= Date.parse(filter.toEventTimestamp))
    && (filter.researchTypes === undefined || filter.researchTypes.includes(record.researchType))
    && (filter.statuses === undefined || filter.statuses.includes(record.status))
    && (filter.currentOnly !== true || !["SUPERSEDED", "ARCHIVED"].includes(record.status))
    && (filter.market === undefined || record.market === filter.market)
    && (filter.ticker === undefined || record.ticker === filter.ticker)
    && (filter.asset === undefined || record.asset === filter.asset)
    && (filter.company === undefined || record.company === filter.company)
    && (filter.sector === undefined || record.sector === filter.sector)
    && (filter.industry === undefined || record.industry === filter.industry)
    && (filter.theme === undefined || record.theme === filter.theme)
    && (filter.catalystId === undefined || record.catalysts.some((value) => value.catalystId === filter.catalystId))
    && has(record.references.predictions, filter.predictionId)
    && has(record.references.journals, filter.journalId)
    && has(record.references.strategies, filter.strategyId)
    && has(record.references.historicalPatterns, filter.historicalPatternId)
    && (filter.tags === undefined || filter.tags.every((tag) => record.tags.includes(tag)))
    && (filter.correlationId === undefined || record.correlationId === filter.correlationId)
    && (filter.traceId === undefined || record.traceId === filter.traceId);
}
