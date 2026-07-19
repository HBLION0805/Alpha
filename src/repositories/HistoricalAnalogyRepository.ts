import {
  AnalogyQualityClassification,
  HistoricalAnalogyStatus,
  HistoricalCandidateType,
  type AnalogyQuery,
  type HistoricalAnalogyRecord,
} from "../contracts";

export type HistoricalAnalogyRepositoryEvent =
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "REQUEST_APPENDED"; readonly acceptedAt: string; readonly request: import("../contracts").HistoricalAnalogyRequest }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "SNAPSHOT_APPENDED"; readonly acceptedAt: string; readonly snapshot: import("../contracts").CurrentSituationSnapshot }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "WEIGHT_PROFILE_APPENDED"; readonly acceptedAt: string; readonly profile: import("../contracts").AnalogyWeightProfile }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "ANALOGY_APPENDED"; readonly acceptedAt: string; readonly analogy: import("../contracts").HistoricalAnalogyRecord }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "REVIEW_APPENDED"; readonly acceptedAt: string; readonly review: import("../contracts").AnalogyReview; readonly history: import("../contracts").HistoricalAnalogyLifecycle }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "AMENDMENT_APPENDED"; readonly acceptedAt: string; readonly amendment: import("../contracts").AnalogyAmendment }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "SUPERSESSION_APPENDED"; readonly acceptedAt: string; readonly supersession: import("../contracts").AnalogySupersession; readonly history: import("../contracts").HistoricalAnalogyLifecycle }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "ARCHIVE_APPENDED"; readonly acceptedAt: string; readonly history: import("../contracts").HistoricalAnalogyLifecycle };

export function matchesHistoricalAnalogyQuery(value: HistoricalAnalogyRecord, query: AnalogyQuery = {}): boolean {
  const filter = query.filter;
  if (filter === undefined) return true;
  const candidate = value.candidateReference;
  return (filter.currentSnapshotId === undefined || value.currentSnapshotReference.snapshotId === filter.currentSnapshotId)
    && (filter.historicalEventId === undefined || candidate.candidateType === HistoricalCandidateType.Event && candidate.recordId === filter.historicalEventId)
    && (filter.historicalPatternId === undefined || candidate.candidateType === HistoricalCandidateType.Pattern && candidate.recordId === filter.historicalPatternId)
    && (filter.weightProfileId === undefined || value.weightProfileReference.profileId === filter.weightProfileId)
    && (filter.researchId === undefined || value.researchReference?.researchId === filter.researchId)
    && (filter.statuses === undefined || filter.statuses.includes(value.status))
    && (filter.qualityClassifications === undefined || filter.qualityClassifications.includes(value.quality.classification))
    && (filter.minimumSimilarityScore === undefined || value.score.normalizedSimilarityScore >= filter.minimumSimilarityScore)
    && (filter.maximumSimilarityScore === undefined || value.score.normalizedSimilarityScore <= filter.maximumSimilarityScore)
    && (filter.minimumCompletenessScore === undefined || value.score.completenessScore >= filter.minimumCompletenessScore)
    && (filter.maximumCompletenessScore === undefined || value.score.completenessScore <= filter.maximumCompletenessScore)
    && (filter.fromTimestamp === undefined || Date.parse(value.comparisonTimestamp) >= Date.parse(filter.fromTimestamp))
    && (filter.toTimestamp === undefined || Date.parse(value.comparisonTimestamp) <= Date.parse(filter.toTimestamp))
    && (filter.currentOnly !== true || ![HistoricalAnalogyStatus.Superseded, HistoricalAnalogyStatus.Archived].includes(value.status));
}

const qualityRank: Readonly<Record<AnalogyQualityClassification, number>> = {
  [AnalogyQualityClassification.High]: 4,
  [AnalogyQualityClassification.Moderate]: 3,
  [AnalogyQualityClassification.Low]: 2,
  [AnalogyQualityClassification.Insufficient]: 1,
  [AnalogyQualityClassification.Invalid]: 0,
};

export function compareHistoricalAnalogyRank(a: HistoricalAnalogyRecord, b: HistoricalAnalogyRecord): number {
  const criticalA = a.strongestDifferences.filter((item) => item.severity === "CRITICAL").length;
  const criticalB = b.strongestDifferences.filter((item) => item.severity === "CRITICAL").length;
  return qualityRank[b.quality.classification] - qualityRank[a.quality.classification]
    || b.score.completenessScore - a.score.completenessScore
    || b.score.evidenceQualityScore - a.score.evidenceQualityScore
    || b.score.normalizedSimilarityScore - a.score.normalizedSimilarityScore
    || criticalA - criticalB
    || a.candidateReference.recordId.localeCompare(b.candidateReference.recordId)
    || a.analogyId.localeCompare(b.analogyId);
}
