import {
  EVENT_REPLAY_SCORE_SCALE,
  EventReplayErrorCategory,
  EventReplayLifecycleStatus,
  ReplayCheckpointType,
  ReplayMissingDataPolicy,
  ReplayQualityStatus,
  throwIfInvalidEventReplay,
  validateReplayLifecycle,
  validateReplayReview,
  validateReplaySession,
  validateReplayTimeline,
  type EventReplayAppendResult,
  type EventReplayRepository,
  type ReplayHistory,
  type ReplayLifecycleRecord,
  type ReplayQuery,
  type ReplayRepositoryStatistics,
  type ReplayReview,
  type ReplaySession,
  type ReplayStatistics,
  type ReplaySupersession,
  type ReplayTimeline,
} from "../../contracts";
import { compareEventReplaySession } from "../../repositories/EventReplayRepository";

export interface EventReplayClock { now(): string; }
export class SystemEventReplayClock implements EventReplayClock { now(): string { return new Date().toISOString(); } }

export interface ReplaySessionInput {
  readonly sessionId: string;
  readonly sessionVersion: string;
  readonly timelineId: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

function fail(category: EventReplayErrorCategory, message: string): never { const error = new Error(`${category}: ${message}`); Object.assign(error, { category }); throw error; }
function roundRatio(numerator: number, denominator: number): number { if (!Number.isSafeInteger(numerator) || numerator < 0 || !Number.isSafeInteger(denominator) || denominator <= 0) fail(EventReplayErrorCategory.InvalidScore, "Replay fixed-scale arithmetic received invalid integers."); const product = numerator * EVENT_REPLAY_SCORE_SCALE; if (!Number.isSafeInteger(product)) fail(EventReplayErrorCategory.InvalidScore, "Replay fixed-scale arithmetic overflow."); return Math.min(EVENT_REPLAY_SCORE_SCALE, Math.floor((product + Math.floor(denominator / 2)) / denominator)); }
function qualityFor(completeness: number, confidence: number): ReplayQualityStatus { if (completeness === EVENT_REPLAY_SCORE_SCALE && confidence >= 8000) return ReplayQualityStatus.Complete; if (completeness >= 7000 && confidence >= 5000) return ReplayQualityStatus.Partial; if (completeness > 0 && confidence > 0) return ReplayQualityStatus.Incomplete; return ReplayQualityStatus.Invalid; }

export class EventReplayEngine {
  constructor(
    private readonly repository: EventReplayRepository,
    private readonly clock: EventReplayClock = new SystemEventReplayClock(),
  ) {}

  createTimeline(value: ReplayTimeline): EventReplayAppendResult<ReplayTimeline> {
    throwIfInvalidEventReplay(validateReplayTimeline(value));
    return this.repository.appendTimeline(structuredClone(value), this.clock.now());
  }

  runSession(input: ReplaySessionInput): EventReplayAppendResult<ReplaySession> {
    const timeline = this.repository.getTimelineById(input.timelineId);
    if (timeline === undefined) fail(EventReplayErrorCategory.RecordNotFound, "Replay timeline does not exist.");
    throwIfInvalidEventReplay(validateReplayTimeline(timeline));
    const orderedEvents = [...timeline.events].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.eventId.localeCompare(b.eventId));
    if (orderedEvents.map((event) => event.eventId).join("\u0000") !== timeline.events.map((event) => event.eventId).join("\u0000")) fail(EventReplayErrorCategory.InvalidTimeline, "Replay timeline event order is not canonical.");
    const orderedCheckpoints = [...timeline.checkpoints].sort((a, b) => a.sequence - b.sequence);
    if (orderedCheckpoints[0]?.checkpointType !== ReplayCheckpointType.TimelineStart || orderedCheckpoints.at(-1)?.checkpointType !== ReplayCheckpointType.TimelineEnd) fail(EventReplayErrorCategory.InvalidCheckpoint, "Replay requires start and end checkpoints.");
    const statistics = this.timelineStatistics(timeline);
    if (timeline.missingDataPolicy === ReplayMissingDataPolicy.FailClosed && statistics.missingEventCount > 0) fail(EventReplayErrorCategory.MissingData, "Replay cannot run with missing data under FAIL_CLOSED policy.");
    const now = this.clock.now();
    const history: ReplayLifecycleRecord[] = [
      { historyId: `${input.sessionId}:history:1`, sessionId: input.sessionId, lifecycleSequence: 1, fromStatus: EventReplayLifecycleStatus.Proposed, toStatus: EventReplayLifecycleStatus.Validating, occurredAt: now, reason: "Replay session entered deterministic validation." },
      { historyId: `${input.sessionId}:history:2`, sessionId: input.sessionId, lifecycleSequence: 2, fromStatus: EventReplayLifecycleStatus.Validating, toStatus: EventReplayLifecycleStatus.Ready, occurredAt: now, reason: "Timeline evidence and checkpoints validated." },
      { historyId: `${input.sessionId}:history:3`, sessionId: input.sessionId, lifecycleSequence: 3, fromStatus: EventReplayLifecycleStatus.Ready, toStatus: EventReplayLifecycleStatus.Replaying, occurredAt: now, reason: "Deterministic reconstruction started without simulation or prediction." },
      { historyId: `${input.sessionId}:history:4`, sessionId: input.sessionId, lifecycleSequence: 4, fromStatus: EventReplayLifecycleStatus.Replaying, toStatus: EventReplayLifecycleStatus.Completed, occurredAt: now, reason: "Chronological evidence reconstruction completed." },
    ];
    const session: ReplaySession = {
      sessionId: input.sessionId,
      schemaVersion: "1.0",
      sessionVersion: input.sessionVersion,
      timelineReference: { timelineId: timeline.timelineId, timelineVersion: timeline.timelineVersion },
      replayedAt: now,
      replayMode: "DETERMINISTIC_EVIDENCE_RECONSTRUCTION",
      orderedEventIds: orderedEvents.map((event) => event.eventId),
      checkpointIds: orderedCheckpoints.map((checkpoint) => checkpoint.checkpointId),
      statistics,
      qualityStatus: statistics.qualityStatus,
      limitations: [
        "Replay reconstructs historical evidence only and is not prediction.",
        "Replay creates no execution, optimization, or trading authority.",
        ...timeline.events.flatMap((event) => event.limitations),
      ],
      references: [...timeline.historicalEventReferences, ...timeline.patternReferences, ...timeline.analogyReferences, ...timeline.supportingEvidenceReferences].map((value) => structuredClone(value)),
      status: EventReplayLifecycleStatus.Completed,
      history,
      privacyLevel: timeline.privacyLevel,
      retention: timeline.retention,
      correlationId: timeline.correlationId,
      traceId: timeline.traceId,
      metadata: structuredClone(input.metadata ?? {}),
    };
    throwIfInvalidEventReplay(validateReplaySession(session));
    return this.repository.appendSession(session, now);
  }

  review(value: ReplayReview): EventReplayAppendResult<ReplayReview> {
    const current = this.requiredSession(value.sessionId);
    const history = this.lifecycle(current, EventReplayLifecycleStatus.Reviewed, value.createdAt, "Replay evidence review appended.", value.reviewId);
    throwIfInvalidEventReplay(validateReplayLifecycle(history, current));
    throwIfInvalidEventReplay(validateReplayReview(value, current));
    return this.repository.appendReview(structuredClone(value), history, this.clock.now());
  }

  supersede(value: ReplaySupersession): EventReplayAppendResult<ReplaySupersession> {
    const prior = this.requiredSession(value.priorSessionId);
    this.requiredSession(value.successorSessionId);
    const history = this.lifecycle(prior, EventReplayLifecycleStatus.Superseded, value.createdAt, value.reason, value.supersessionId);
    throwIfInvalidEventReplay(validateReplayLifecycle(history, prior));
    return this.repository.appendSupersession(structuredClone(value), history, this.clock.now());
  }

  archive(id: string, occurredAt: string, reason: string): EventReplayAppendResult<ReplayLifecycleRecord> {
    const current = this.requiredSession(id);
    const history = this.lifecycle(current, EventReplayLifecycleStatus.Archived, occurredAt, reason);
    throwIfInvalidEventReplay(validateReplayLifecycle(history, current));
    return this.repository.appendArchive(history, this.clock.now());
  }

  get(id: string): ReplaySession | undefined { return this.repository.getSessionById(id); }
  history(id: string): ReplayHistory | undefined { return this.repository.getHistory(id); }
  query(query: ReplayQuery = {}): ReadonlyArray<ReplaySession> { return this.repository.query(query); }
  rank(query: ReplayQuery = {}, maximumResultCount = 10): ReadonlyArray<ReplaySession> { if (!Number.isSafeInteger(maximumResultCount) || maximumResultCount <= 0 || maximumResultCount > 1000) fail(EventReplayErrorCategory.InvalidPagination, "Replay rank limit must be from 1 through 1,000."); return this.repository.query(query).filter((item) => item.qualityStatus !== ReplayQualityStatus.Invalid && ![EventReplayLifecycleStatus.Rejected, EventReplayLifecycleStatus.Archived].includes(item.status)).sort(compareEventReplaySession).slice(0, maximumResultCount).map((item) => structuredClone(item)); }

  timelineStatistics(timeline: ReplayTimeline): ReplayStatistics {
    const phaseCounts: Record<string, number> = {};
    let evidenceCount = 0; let missingEventCount = 0; let limitationCount = 0;
    for (const event of timeline.events) { phaseCounts[event.phase] = (phaseCounts[event.phase] ?? 0) + 1; evidenceCount += event.evidenceReferenceIds.length; if (event.missingData) missingEventCount += 1; limitationCount += event.limitations.length; }
    const completenessScore = timeline.events.length === 0 ? 0 : roundRatio(timeline.events.length - missingEventCount, timeline.events.length);
    const evidenceBearingEvents = timeline.events.filter((event) => event.evidenceReferenceIds.length > 0).length;
    const confidenceScore = timeline.events.length === 0 ? 0 : roundRatio(evidenceBearingEvents, timeline.events.length);
    return { eventCount: timeline.events.length, checkpointCount: timeline.checkpoints.length, observationWindowCount: timeline.observationWindows.length, missingEventCount, phaseCounts, completenessScore, confidenceScore, qualityStatus: qualityFor(completenessScore, confidenceScore), limitationCount };
  }

  statistics(): ReplayRepositoryStatistics {
    const timelines = this.repository.listTimelines(); const sessions = this.repository.listSessions(); const sessionsByStatus: Record<string, number> = {}; const sessionsByQuality: Record<string, number> = {}; const phaseCounts: Record<string, number> = {};
    let reviewedCount = 0; let completenessTotal = 0; let confidenceTotal = 0;
    for (const session of sessions) { sessionsByStatus[session.status] = (sessionsByStatus[session.status] ?? 0) + 1; sessionsByQuality[session.qualityStatus] = (sessionsByQuality[session.qualityStatus] ?? 0) + 1; for (const [phase, count] of Object.entries(session.statistics.phaseCounts)) phaseCounts[phase] = (phaseCounts[phase] ?? 0) + count; if (session.status === EventReplayLifecycleStatus.Reviewed || (this.repository.getHistory(session.sessionId)?.reviews.length ?? 0) > 0) reviewedCount += 1; completenessTotal += session.statistics.completenessScore; confidenceTotal += session.statistics.confidenceScore; }
    const sampleSize = sessions.length; const supersededCount = sessions.filter((session) => session.status === EventReplayLifecycleStatus.Superseded).length; const currentCount = sessions.filter((session) => ![EventReplayLifecycleStatus.Superseded, EventReplayLifecycleStatus.Archived].includes(session.status)).length; const base = { generatedAt: this.clock.now(), timelineCount: timelines.length, sessionCount: sessions.length, sessionsByStatus, sessionsByQuality, phaseCounts, reviewedCount, supersededCount, currentCount, sampleSize };
    return sampleSize === 0 ? base : { ...base, averageCompletenessScore: Math.floor((completenessTotal + Math.floor(sampleSize / 2)) / sampleSize), averageConfidenceScore: Math.floor((confidenceTotal + Math.floor(sampleSize / 2)) / sampleSize) };
  }

  private requiredSession(id: string): ReplaySession { const value = this.repository.getSessionById(id); if (value === undefined) fail(EventReplayErrorCategory.RecordNotFound, "Replay session does not exist."); return value; }
  private lifecycle(value: ReplaySession, toStatus: EventReplayLifecycleStatus, occurredAt: string, reason: string, referenceId?: string): ReplayLifecycleRecord { const base = { historyId: `${value.sessionId}:history:${String(value.history.length + 1)}`, sessionId: value.sessionId, lifecycleSequence: value.history.length + 1, fromStatus: value.status, toStatus, occurredAt, reason }; return referenceId === undefined ? base : { ...base, referenceId }; }
}
