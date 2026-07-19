import { canonicalizeHistoricalValue, historicalFingerprint } from "./HistoricalPatternValidation";
import {
  EVENT_REPLAY_SCORE_SCALE,
  EventReplayErrorCategory,
  EventReplayLifecycleStatus,
  ReplayCheckpointType,
  ReplayMissingDataPolicy,
  ReplayQualityStatus,
  type EventReplayError,
  type EventReplayValidation,
  type ReplayCheckpoint,
  type ReplayLifecycleRecord,
  type ReplayQuery,
  type ReplayReview,
  type ReplaySession,
  type ReplaySupersession,
  type ReplayTimeline,
} from "./EventReplay";

const TIMELINE_ID = /^event-replay-timeline:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const SESSION_ID = /^event-replay-session:[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const CHECKPOINT_ID = /^event-replay-checkpoint:[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,179}$/;
const SECRET_KEY = /(api[_-]?key|secret|token|password|credential|private[_-]?key|authorization|bearer)/i;
const PROHIBITED = /\b(backtest(?:ing)?|simulat(?:e|ion|ed) (?:trade|execution|order|broker)|buy|sell|short|long position|trading signal|profit target|expected return|will happen|guarantee(?:d|s)?)\b/i;

const transitions: Readonly<Record<EventReplayLifecycleStatus, ReadonlyArray<EventReplayLifecycleStatus>>> = {
  [EventReplayLifecycleStatus.Proposed]: [EventReplayLifecycleStatus.Validating, EventReplayLifecycleStatus.Rejected],
  [EventReplayLifecycleStatus.Validating]: [EventReplayLifecycleStatus.Ready, EventReplayLifecycleStatus.Rejected],
  [EventReplayLifecycleStatus.Ready]: [EventReplayLifecycleStatus.Replaying, EventReplayLifecycleStatus.Rejected],
  [EventReplayLifecycleStatus.Replaying]: [EventReplayLifecycleStatus.Completed, EventReplayLifecycleStatus.Rejected],
  [EventReplayLifecycleStatus.Completed]: [EventReplayLifecycleStatus.Reviewed, EventReplayLifecycleStatus.Superseded, EventReplayLifecycleStatus.Archived],
  [EventReplayLifecycleStatus.Reviewed]: [EventReplayLifecycleStatus.Superseded, EventReplayLifecycleStatus.Archived],
  [EventReplayLifecycleStatus.Superseded]: [EventReplayLifecycleStatus.Archived],
  [EventReplayLifecycleStatus.Archived]: [],
  [EventReplayLifecycleStatus.Rejected]: [],
};

function err(category: EventReplayErrorCategory, message: string, field?: string): EventReplayError {
  return field === undefined ? { category, message } : { category, message, field };
}
function result(errors: EventReplayError[]): EventReplayValidation { return { valid: errors.length === 0, errors }; }
function nonEmpty(value: string): boolean { return value.trim().length > 0; }
function validTimestamp(value: string): boolean { return Number.isFinite(Date.parse(value)); }
function validScore(value: number): boolean { return Number.isSafeInteger(value) && value >= 0 && value <= EVENT_REPLAY_SCORE_SCALE; }
function unique<T>(values: ReadonlyArray<T>): boolean { return new Set(values).size === values.length; }
function validateMetadata(metadata: Readonly<Record<string, unknown>>, errors: EventReplayError[]): void {
  if (Object.keys(metadata).some((key) => SECRET_KEY.test(key))) errors.push(err(EventReplayErrorCategory.SecretMetadata, "Secret-bearing metadata keys are forbidden.", "metadata"));
}
function hasProhibitedLanguage(values: ReadonlyArray<string>): boolean { return values.some((value) => PROHIBITED.test(value)); }

export function canonicalizeEventReplayValue(value: unknown): string { return canonicalizeHistoricalValue(value); }
export function eventReplayFingerprint(value: unknown): string { return historicalFingerprint(value); }
export function checkpointFingerprint(value: Omit<ReplayCheckpoint, "payloadFingerprint">): string { return eventReplayFingerprint(value); }

export function validateReplayCheckpoint(value: ReplayCheckpoint): EventReplayValidation {
  const errors: EventReplayError[] = [];
  if (!CHECKPOINT_ID.test(value.checkpointId)) errors.push(err(EventReplayErrorCategory.InvalidId, "Checkpoint ID is malformed.", "checkpointId"));
  if (!Number.isSafeInteger(value.sequence) || value.sequence <= 0) errors.push(err(EventReplayErrorCategory.InvalidCheckpoint, "Checkpoint sequence must be a positive safe integer."));
  if (!validTimestamp(value.checkpointTimestamp)) errors.push(err(EventReplayErrorCategory.InvalidTimestamp, "Checkpoint timestamp is invalid."));
  if (!validScore(value.completenessScore) || !validScore(value.confidenceScore)) errors.push(err(EventReplayErrorCategory.InvalidScore, "Checkpoint scores must be 0 through 10,000."));
  if (value.immutable !== true) errors.push(err(EventReplayErrorCategory.InvalidCheckpoint, "Replay checkpoints must be immutable."));
  const { payloadFingerprint: _fingerprint, ...payload } = value;
  if (value.payloadFingerprint !== checkpointFingerprint(payload)) errors.push(err(EventReplayErrorCategory.InvalidCheckpoint, "Checkpoint fingerprint does not match canonical payload."));
  return result(errors);
}

export function validateReplayTimeline(value: ReplayTimeline): EventReplayValidation {
  const errors: EventReplayError[] = [];
  if (!TIMELINE_ID.test(value.timelineId) || value.schemaVersion !== "1.0" || !nonEmpty(value.timelineVersion) || !nonEmpty(value.title)) errors.push(err(EventReplayErrorCategory.InvalidId, "Replay timeline identity is malformed."));
  if (!validTimestamp(value.createdAt)) errors.push(err(EventReplayErrorCategory.InvalidTimestamp, "Timeline creation timestamp is invalid."));
  if (value.events.length === 0) errors.push(err(EventReplayErrorCategory.InvalidTimeline, "Replay timeline requires at least one event."));
  if (value.checkpoints.length === 0) errors.push(err(EventReplayErrorCategory.InvalidCheckpoint, "Replay timeline requires immutable checkpoints."));
  if (!unique(value.events.map((item) => item.eventId)) || !unique(value.observationWindows.map((item) => item.windowId)) || !unique(value.checkpoints.map((item) => item.checkpointId))) errors.push(err(EventReplayErrorCategory.DuplicateId, "Timeline events, windows, and checkpoints require unique identities."));
  const windowIds = new Set(value.observationWindows.map((item) => item.windowId));
  const eventIds = new Set(value.events.map((item) => item.eventId));
  let priorEventTimestamp = Number.NEGATIVE_INFINITY;
  for (const item of value.events) {
    if (!RECORD_ID.test(item.eventId) || !validTimestamp(item.occurredAt) || !nonEmpty(item.title) || !nonEmpty(item.description)) errors.push(err(EventReplayErrorCategory.InvalidTimeline, "Timeline event is malformed.", item.eventId));
    const timestamp = Date.parse(item.occurredAt);
    if (timestamp < priorEventTimestamp) errors.push(err(EventReplayErrorCategory.InvalidTimeline, "Timeline events must be chronological."));
    priorEventTimestamp = timestamp;
    if (item.observationWindowId !== undefined && !windowIds.has(item.observationWindowId)) errors.push(err(EventReplayErrorCategory.InvalidReference, "Timeline event references a missing observation window.", item.eventId));
    if (item.evidenceReferenceIds.length === 0 && !item.missingData) errors.push(err(EventReplayErrorCategory.MissingEvidence, "Non-missing replay events require evidence.", item.eventId));
    if (hasProhibitedLanguage([item.title, item.description, ...item.limitations])) errors.push(err(EventReplayErrorCategory.ProhibitedBehavior, "Replay events cannot contain prediction, backtest, or trading language.", item.eventId));
  }
  for (const window of value.observationWindows) {
    if (!RECORD_ID.test(window.windowId) || !validTimestamp(window.startTimestamp) || !validTimestamp(window.endTimestamp) || Date.parse(window.startTimestamp) > Date.parse(window.endTimestamp) || !nonEmpty(window.label)) errors.push(err(EventReplayErrorCategory.InvalidTimestamp, "Observation window range is invalid.", window.windowId));
  }
  let priorCheckpointTimestamp = Number.NEGATIVE_INFINITY;
  value.checkpoints.forEach((checkpoint, index) => {
    errors.push(...validateReplayCheckpoint(checkpoint).errors);
    if (checkpoint.sequence !== index + 1) errors.push(err(EventReplayErrorCategory.InvalidCheckpoint, "Checkpoint sequence must match timeline order."));
    const timestamp = Date.parse(checkpoint.checkpointTimestamp);
    if (timestamp < priorCheckpointTimestamp) errors.push(err(EventReplayErrorCategory.InvalidCheckpoint, "Checkpoints must be chronological."));
    priorCheckpointTimestamp = timestamp;
    if (checkpoint.eventIds.some((id) => !eventIds.has(id)) || checkpoint.observationWindowIds.some((id) => !windowIds.has(id))) errors.push(err(EventReplayErrorCategory.InvalidReference, "Checkpoint references missing timeline content.", checkpoint.checkpointId));
  });
  if (value.checkpoints[0]?.checkpointType !== ReplayCheckpointType.TimelineStart || value.checkpoints.at(-1)?.checkpointType !== ReplayCheckpointType.TimelineEnd) errors.push(err(EventReplayErrorCategory.InvalidCheckpoint, "Timeline must start and end with explicit checkpoints."));
  const missing = value.events.some((item) => item.missingData);
  if (missing && value.missingDataPolicy === ReplayMissingDataPolicy.FailClosed) errors.push(err(EventReplayErrorCategory.MissingData, "Missing replay data is not allowed under FAIL_CLOSED policy."));
  for (const reference of [...value.historicalEventReferences, ...value.patternReferences, ...value.analogyReferences, ...value.supportingEvidenceReferences]) {
    if (!RECORD_ID.test(reference.referenceId) || !nonEmpty(reference.sourceId) || !nonEmpty(reference.sourceVersion)) errors.push(err(EventReplayErrorCategory.InvalidReference, "Replay reference is malformed."));
    if (reference.resolved && reference.frozenStatus === undefined) errors.push(err(EventReplayErrorCategory.InvalidReference, "Resolved replay references must freeze status."));
  }
  validateMetadata(value.metadata, errors);
  return result(errors);
}

function validateLifecycle(history: ReadonlyArray<ReplayLifecycleRecord>, sessionId: string, status: EventReplayLifecycleStatus, errors: EventReplayError[]): void {
  if (history.length < 4) { errors.push(err(EventReplayErrorCategory.InvalidLifecycle, "Replay session requires proposed, validating, ready, replaying, and completed provenance.")); return; }
  for (let index = 0; index < history.length; index += 1) {
    const item = history[index];
    if (item === undefined || item.sessionId !== sessionId || item.lifecycleSequence !== index + 1 || !validTimestamp(item.occurredAt) || !transitions[item.fromStatus].includes(item.toStatus) || index > 0 && history[index - 1]?.toStatus !== item.fromStatus) errors.push(err(EventReplayErrorCategory.InvalidLifecycle, "Replay lifecycle is invalid."));
  }
  if (history.at(-1)?.toStatus !== status) errors.push(err(EventReplayErrorCategory.InvalidLifecycle, "Replay lifecycle terminal status does not match session status."));
}

export function validateReplaySession(value: ReplaySession): EventReplayValidation {
  const errors: EventReplayError[] = [];
  if (!SESSION_ID.test(value.sessionId) || value.schemaVersion !== "1.0" || !nonEmpty(value.sessionVersion) || !TIMELINE_ID.test(value.timelineReference.timelineId)) errors.push(err(EventReplayErrorCategory.InvalidId, "Replay session identity is malformed."));
  if (value.replayMode !== "DETERMINISTIC_EVIDENCE_RECONSTRUCTION") errors.push(err(EventReplayErrorCategory.ProhibitedBehavior, "Replay mode must remain deterministic evidence reconstruction."));
  if (value.status !== EventReplayLifecycleStatus.Completed) errors.push(err(EventReplayErrorCategory.InvalidLifecycle, "New replay sessions must be COMPLETED."));
  if (!validTimestamp(value.replayedAt)) errors.push(err(EventReplayErrorCategory.InvalidTimestamp, "Replay session timestamp is invalid."));
  if (value.orderedEventIds.length === 0 || value.checkpointIds.length === 0) errors.push(err(EventReplayErrorCategory.InvalidTimeline, "Replay session requires ordered events and checkpoints."));
  if (!validScore(value.statistics.completenessScore) || !validScore(value.statistics.confidenceScore)) errors.push(err(EventReplayErrorCategory.InvalidScore, "Replay statistics scores are invalid."));
  if (value.statistics.qualityStatus !== value.qualityStatus) errors.push(err(EventReplayErrorCategory.InvalidRecord, "Session quality must match statistics quality."));
  if (value.qualityStatus === ReplayQualityStatus.Complete && value.statistics.completenessScore < EVENT_REPLAY_SCORE_SCALE) errors.push(err(EventReplayErrorCategory.InvalidScore, "Complete replay requires full completeness."));
  if (hasProhibitedLanguage(value.limitations)) errors.push(err(EventReplayErrorCategory.ProhibitedBehavior, "Replay limitations cannot contain prediction, backtest, or trading language."));
  validateLifecycle(value.history, value.sessionId, value.status, errors);
  validateMetadata(value.metadata, errors);
  return result(errors);
}

export function validateReplayLifecycle(value: ReplayLifecycleRecord, current: ReplaySession): EventReplayValidation {
  const errors: EventReplayError[] = [];
  if (value.sessionId !== current.sessionId || value.lifecycleSequence !== current.history.length + 1 || value.fromStatus !== current.status || !transitions[current.status].includes(value.toStatus) || !validTimestamp(value.occurredAt)) errors.push(err(EventReplayErrorCategory.InvalidLifecycle, "Replay lifecycle transition is invalid."));
  return result(errors);
}

export function validateReplayReview(value: ReplayReview, current?: ReplaySession): EventReplayValidation {
  const errors: EventReplayError[] = [];
  if (!RECORD_ID.test(value.reviewId) || !validTimestamp(value.createdAt) || !nonEmpty(value.reviewer) || !nonEmpty(value.rationale)) errors.push(err(EventReplayErrorCategory.InvalidRecord, "Replay review is malformed."));
  if (current === undefined || value.sessionId !== current.sessionId || ![EventReplayLifecycleStatus.Completed, EventReplayLifecycleStatus.Reviewed].includes(current.status)) errors.push(err(EventReplayErrorCategory.InvalidLifecycle, "Review requires a completed replay session."));
  return result(errors);
}

export function validateReplaySupersession(value: ReplaySupersession, prior?: ReplaySession, successor?: ReplaySession): EventReplayValidation {
  const errors: EventReplayError[] = [];
  if (!RECORD_ID.test(value.supersessionId) || !validTimestamp(value.createdAt) || !nonEmpty(value.reason) || !nonEmpty(value.ownerReference)) errors.push(err(EventReplayErrorCategory.InvalidRecord, "Replay supersession is malformed."));
  if (prior === undefined || successor === undefined) errors.push(err(EventReplayErrorCategory.RecordNotFound, "Supersession requires prior and successor replay sessions."));
  if (value.priorSessionId === value.successorSessionId) errors.push(err(EventReplayErrorCategory.InvalidReference, "Replay session cannot supersede itself."));
  if (![value.changedTimeline, value.changedEvidence, value.changedCheckpointMethod].some(Boolean)) errors.push(err(EventReplayErrorCategory.InvalidRecord, "Supersession must identify a material replay evidence change."));
  return result(errors);
}

export function validateReplayQuery(value: ReplayQuery): EventReplayValidation {
  const errors: EventReplayError[] = [];
  if (value.offset !== undefined && (!Number.isSafeInteger(value.offset) || value.offset < 0) || value.limit !== undefined && (!Number.isSafeInteger(value.limit) || value.limit <= 0 || value.limit > 1000)) errors.push(err(EventReplayErrorCategory.InvalidPagination, "Pagination requires non-negative offset and limit from 1 through 1,000."));
  const filter = value.filter;
  if (filter?.fromTimestamp !== undefined && !validTimestamp(filter.fromTimestamp) || filter?.toTimestamp !== undefined && !validTimestamp(filter.toTimestamp) || filter?.fromTimestamp !== undefined && filter.toTimestamp !== undefined && Date.parse(filter.fromTimestamp) > Date.parse(filter.toTimestamp)) errors.push(err(EventReplayErrorCategory.InvalidTimestamp, "Replay query timestamp range is invalid."));
  return result(errors);
}

export function throwIfInvalidEventReplay(validation: EventReplayValidation): void {
  if (!validation.valid) {
    const first = validation.errors[0] as EventReplayError;
    const failure = new Error(`${first.category}: ${first.message}`);
    Object.assign(failure, { category: first.category });
    throw failure;
  }
}
