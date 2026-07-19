import {
  EventReplayLifecycleStatus,
  ReplayQualityStatus,
  type EventReplayRepository,
  type ReplayQuery,
  type ReplaySession,
} from "../contracts";

export type EventReplayRepositoryEvent =
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "TIMELINE_APPENDED"; readonly acceptedAt: string; readonly timeline: import("../contracts").ReplayTimeline }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "SESSION_APPENDED"; readonly acceptedAt: string; readonly session: import("../contracts").ReplaySession }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "REVIEW_APPENDED"; readonly acceptedAt: string; readonly review: import("../contracts").ReplayReview; readonly history: import("../contracts").ReplayLifecycleRecord }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "SUPERSESSION_APPENDED"; readonly acceptedAt: string; readonly supersession: import("../contracts").ReplaySupersession; readonly history: import("../contracts").ReplayLifecycleRecord }
  | { readonly schemaVersion: "1.0"; readonly sequence: number; readonly fingerprint: string; readonly eventType: "ARCHIVE_APPENDED"; readonly acceptedAt: string; readonly history: import("../contracts").ReplayLifecycleRecord };

export function matchesEventReplayQuery(value: ReplaySession, query: ReplayQuery = {}): boolean {
  const filter = query.filter;
  if (filter === undefined) return true;
  return (filter.timelineId === undefined || value.timelineReference.timelineId === filter.timelineId)
    && (filter.statuses === undefined || filter.statuses.includes(value.status))
    && (filter.qualityStatuses === undefined || filter.qualityStatuses.includes(value.qualityStatus))
    && (filter.referenceType === undefined || value.references.some((reference) => reference.referenceType === filter.referenceType))
    && (filter.sourceId === undefined || value.references.some((reference) => reference.sourceId === filter.sourceId))
    && (filter.fromTimestamp === undefined || Date.parse(value.replayedAt) >= Date.parse(filter.fromTimestamp))
    && (filter.toTimestamp === undefined || Date.parse(value.replayedAt) <= Date.parse(filter.toTimestamp))
    && (filter.currentOnly !== true || ![EventReplayLifecycleStatus.Superseded, EventReplayLifecycleStatus.Archived].includes(value.status));
}

const qualityRank: Readonly<Record<ReplayQualityStatus, number>> = {
  [ReplayQualityStatus.Complete]: 3,
  [ReplayQualityStatus.Partial]: 2,
  [ReplayQualityStatus.Incomplete]: 1,
  [ReplayQualityStatus.Invalid]: 0,
};

export function compareEventReplaySession(a: ReplaySession, b: ReplaySession): number {
  return qualityRank[b.qualityStatus] - qualityRank[a.qualityStatus]
    || b.statistics.completenessScore - a.statistics.completenessScore
    || b.statistics.confidenceScore - a.statistics.confidenceScore
    || a.timelineReference.timelineId.localeCompare(b.timelineReference.timelineId)
    || a.sessionId.localeCompare(b.sessionId);
}

export type EventReplayRepositoryPort = EventReplayRepository;
