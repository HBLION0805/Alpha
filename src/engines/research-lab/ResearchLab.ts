import {
  ResearchQuality, ResearchSourceType, ResearchStatus, createResearchId,
  throwIfInvalidResearch, validateResearchAmendment, validateResearchHistory,
  validateResearchReview, validateResearchSnapshot, validateResearchSupersession,
  type ResearchAmendment, type ResearchAppendResult, type ResearchFilter,
  type ResearchHistory, type ResearchPredictionLinkPolicy,
  type ResearchPredictionLinkResult, type ResearchQuery, type ResearchRecord,
  type ResearchRecordHistory, type ResearchRecordSnapshot, type ResearchReview,
  type ResearchStatistics, type ResearchSummary, type ResearchSupersession,
} from "../../contracts";
import type { ResearchRepository } from "../../repositories";

export interface ResearchClock { now(): string; }
export class SystemResearchClock implements ResearchClock { now(): string { return new Date().toISOString(); } }
function required(repository: ResearchRepository, id: string): ResearchRecord { const record = repository.getById(id); if (record === undefined) throw new Error("RECORD_NOT_FOUND: research record does not exist."); return record; }

export class ResearchLab {
  constructor(private readonly repository: ResearchRepository, private readonly clock: ResearchClock = new SystemResearchClock()) {}

  finalize(snapshot: ResearchRecordSnapshot): ResearchAppendResult<ResearchRecord> {
    const now = this.clock.now(); throwIfInvalidResearch(validateResearchSnapshot(snapshot, now)); const researchId = createResearchId(snapshot);
    const transitions: ReadonlyArray<readonly [ResearchStatus, ResearchStatus, string, string]> = [
      [ResearchStatus.Draft, ResearchStatus.Collecting, snapshot.createdAt, "Research entered evidence collection."],
      [ResearchStatus.Collecting, ResearchStatus.Analyzing, snapshot.createdAt, "Collected evidence entered deterministic analysis."],
      [ResearchStatus.Analyzing, ResearchStatus.Finalized, snapshot.finalizedAt, "Research finalized as authoritative point-in-time evidence."],
    ];
    const history = transitions.map(([fromStatus, toStatus, occurredAt, reason], index): ResearchHistory => ({ historyId: `${researchId}:history:${String(index + 1)}`, researchId, lifecycleSequence: index + 1, fromStatus, toStatus, occurredAt, reason }));
    return this.repository.appendFinalized({ ...structuredClone(snapshot), researchId, status: ResearchStatus.Finalized, history }, now);
  }

  amend(amendment: ResearchAmendment): ResearchAppendResult<ResearchAmendment> { const record = required(this.repository, amendment.researchId); const now = this.clock.now(); throwIfInvalidResearch(validateResearchAmendment(amendment, record, now)); return this.repository.appendAmendment(structuredClone(amendment), now); }
  review(review: ResearchReview): ResearchAppendResult<ResearchReview> { const record = required(this.repository, review.researchId); const now = this.clock.now(); throwIfInvalidResearch(validateResearchReview(review, record, now)); const history = this.historyEvent(record, ResearchStatus.Reviewed, review.createdAt, "Append-only research review completed.", review.reviewId); throwIfInvalidResearch(validateResearchHistory(history, record, now)); return this.repository.appendReview(structuredClone(review), history, now); }
  supersede(value: ResearchSupersession): ResearchAppendResult<ResearchSupersession> { const prior = required(this.repository, value.priorResearchId); const next = required(this.repository, value.newResearchId); const now = this.clock.now(); throwIfInvalidResearch(validateResearchSupersession(value, prior, next, now)); const history = this.historyEvent(prior, ResearchStatus.Superseded, value.createdAt, value.reason, value.supersessionId); throwIfInvalidResearch(validateResearchHistory(history, prior, now)); return this.repository.appendSupersession(structuredClone(value), history, now); }
  archive(researchId: string, occurredAt: string, reason: string): ResearchAppendResult<ResearchHistory> { const record = required(this.repository, researchId); const now = this.clock.now(); const history = this.historyEvent(record, ResearchStatus.Archived, occurredAt, reason); throwIfInvalidResearch(validateResearchHistory(history, record, now)); return this.repository.appendArchive(history, now); }
  get(researchId: string): ResearchRecord | undefined { return this.repository.getById(researchId); }
  query(query: ResearchQuery = {}): ReadonlyArray<ResearchRecord> { return this.repository.query(query); }
  history(researchId: string): ResearchRecordHistory | undefined { return this.repository.getResearchHistory(researchId); }
  related(researchId: string): ReadonlyArray<ResearchRecord> { return this.repository.listRelatedResearch(researchId); }

  summary(researchId: string): ResearchSummary | undefined {
    const history = this.repository.getResearchHistory(researchId); if (history === undefined) return undefined; const record = history.record;
    return { researchId: record.researchId, researchVersion: record.researchVersion, finalizedAt: record.finalizedAt, researchType: record.researchType, title: record.title, status: record.status, conclusion: record.conclusion.statement, confidence: record.confidence.score, ...(record.ticker === undefined ? {} : { ticker: record.ticker }), ...(record.sector === undefined ? {} : { sector: record.sector }), ...(record.theme === undefined ? {} : { theme: record.theme }), tags: structuredClone(record.tags), amendmentCount: history.amendments.length, reviewed: history.reviews.length > 0 };
  }

  predictionEvidence(researchId: string | undefined, policy: ResearchPredictionLinkPolicy): ResearchPredictionLinkResult {
    if (researchId === undefined) return policy.required ? { accepted: false, warnings: ["FINALIZED_RESEARCH_REQUIRED"] } : { accepted: true, warnings: ["RESEARCH_NOT_LINKED"] };
    const record = this.repository.getById(researchId); if (record === undefined) return policy.required ? { accepted: false, warnings: ["RESEARCH_NOT_FOUND"] } : { accepted: true, warnings: ["RESEARCH_NOT_FOUND"] };
    if (![ResearchStatus.Finalized, ResearchStatus.Reviewed].includes(record.status)) return policy.rejectNonFinalized ? { accepted: false, warnings: ["RESEARCH_NOT_CURRENT_FINALIZED"] } : { accepted: true, warnings: ["RESEARCH_NOT_CURRENT_FINALIZED"] };
    return { accepted: true, warnings: [], reference: { researchId: record.researchId, researchVersion: record.researchVersion, frozenStatus: record.status as ResearchStatus.Finalized | ResearchStatus.Reviewed, conclusionSummary: record.conclusion.statement, confidenceScore: record.confidence.score } };
  }

  statistics(filter?: ResearchFilter): ResearchStatistics {
    const records = this.repository.query(filter === undefined ? {} : { filter }); const byCategory: Partial<Record<ResearchRecord["researchType"], number>> = {}; const byStatus: Partial<Record<ResearchStatus, number>> = {}; const byDay: Record<string, number> = {}; const byMonth: Record<string, number> = {}; const bySubject: Record<string, number> = {}; const evidenceBySourceType: Partial<Record<ResearchSourceType, number>> = {}; const sourceReliabilityDistribution: Record<string, number> = {}; const processQualityDistribution: Partial<Record<ResearchQuality, number>> = {}; let reviewedRecords = 0; let supersededRecords = 0; let predictionLinkedRecords = 0; let journalLinkedRecords = 0; let unresolvedQuestionCount = 0; let assumptionCount = 0;
    for (const record of records) { const history = this.repository.getResearchHistory(record.researchId) as ResearchRecordHistory; byCategory[record.researchType] = (byCategory[record.researchType] ?? 0) + 1; byStatus[record.status] = (byStatus[record.status] ?? 0) + 1; const day = record.finalizedAt.slice(0, 10); const month = record.finalizedAt.slice(0, 7); byDay[day] = (byDay[day] ?? 0) + 1; byMonth[month] = (byMonth[month] ?? 0) + 1; const subject = record.ticker ?? record.sector ?? record.theme ?? record.market; if (subject !== undefined) bySubject[subject] = (bySubject[subject] ?? 0) + 1; if (record.references.predictions.length > 0) predictionLinkedRecords += 1; if (record.references.journals.length > 0) journalLinkedRecords += 1; assumptionCount += record.assumptions.length; unresolvedQuestionCount += record.uncertainties.reduce((sum, value) => sum + value.unresolvedQuestions.length, 0); if (record.status === ResearchStatus.Superseded) supersededRecords += 1; if (history.reviews.length > 0) reviewedRecords += 1; for (const source of record.sources) { evidenceBySourceType[source.sourceType] = (evidenceBySourceType[source.sourceType] ?? 0) + 1; const bucket = source.reliabilityScore >= 75 ? "HIGH" : source.reliabilityScore >= 50 ? "MEDIUM" : "LOW"; sourceReliabilityDistribution[bucket] = (sourceReliabilityDistribution[bucket] ?? 0) + 1; } for (const review of history.reviews) processQualityDistribution[review.processQuality] = (processQualityDistribution[review.processQuality] ?? 0) + 1; }
    return { generatedAt: this.clock.now(), totalRecords: records.length, finalizedRecords: records.filter((record) => record.status === ResearchStatus.Finalized).length, reviewedRecords, currentRecords: records.filter((record) => ![ResearchStatus.Superseded, ResearchStatus.Archived].includes(record.status)).length, supersededRecords, predictionLinkedRecords, journalLinkedRecords, unresolvedQuestionCount, assumptionCount, byCategory, byStatus, byDay, byMonth, bySubject, evidenceBySourceType, sourceReliabilityDistribution, processQualityDistribution };
  }

  private historyEvent(record: ResearchRecord, toStatus: ResearchStatus, occurredAt: string, reason: string, referenceId?: string): ResearchHistory { const lifecycleSequence = record.history.length + 1; const base = { historyId: `${record.researchId}:history:${String(lifecycleSequence)}`, researchId: record.researchId, lifecycleSequence, fromStatus: record.status, toStatus, occurredAt, reason }; return referenceId === undefined ? base : { ...base, referenceId }; }
}
