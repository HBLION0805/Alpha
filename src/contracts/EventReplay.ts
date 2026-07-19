import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";

export type EventReplayId = string;
export type ReplayTimelineId = string;
export type ReplaySessionId = string;
export type ReplayCheckpointId = string;

export enum EventReplayLifecycleStatus {
  Proposed = "PROPOSED",
  Validating = "VALIDATING",
  Ready = "READY",
  Replaying = "REPLAYING",
  Completed = "COMPLETED",
  Reviewed = "REVIEWED",
  Superseded = "SUPERSEDED",
  Archived = "ARCHIVED",
  Rejected = "REJECTED",
}

export enum ReplayEventPhase {
  Setup = "SETUP",
  PreEvent = "PRE_EVENT",
  Trigger = "TRIGGER",
  ImmediateReaction = "IMMEDIATE_REACTION",
  Stabilization = "STABILIZATION",
  FollowThrough = "FOLLOW_THROUGH",
  Resolution = "RESOLUTION",
  Review = "REVIEW",
}

export enum ReplayObservationWindowType {
  Intraday = "INTRADAY",
  OneDay = "ONE_DAY",
  ThreeDays = "THREE_DAYS",
  OneWeek = "ONE_WEEK",
  OneMonth = "ONE_MONTH",
  ThreeMonths = "THREE_MONTHS",
  OneYear = "ONE_YEAR",
  Custom = "CUSTOM",
}

export enum ReplayCheckpointType {
  TimelineStart = "TIMELINE_START",
  Observation = "OBSERVATION",
  PhaseTransition = "PHASE_TRANSITION",
  EvidenceFreeze = "EVIDENCE_FREEZE",
  TimelineEnd = "TIMELINE_END",
}

export enum ReplayMissingDataPolicy {
  FailClosed = "FAIL_CLOSED",
  PreserveGap = "PRESERVE_GAP",
  RequireReview = "REQUIRE_REVIEW",
  IncompleteResult = "INCOMPLETE_RESULT",
}

export enum ReplayQualityStatus {
  Complete = "COMPLETE",
  Partial = "PARTIAL",
  Incomplete = "INCOMPLETE",
  Invalid = "INVALID",
}

export enum ReplayReferenceType {
  HistoricalEvent = "HISTORICAL_EVENT",
  HistoricalPattern = "HISTORICAL_PATTERN",
  HistoricalAnalogy = "HISTORICAL_ANALOGY",
  ResearchLab = "RESEARCH_LAB",
  PredictionLog = "PREDICTION_LOG",
  AlphaJournal = "ALPHA_JOURNAL",
  SourceEvidence = "SOURCE_EVIDENCE",
  Snapshot = "SNAPSHOT",
}

export enum EventReplayAppendStatus {
  Appended = "APPENDED",
  Replayed = "REPLAYED",
}

export enum EventReplayExportFormat {
  Json = "JSON",
  Ndjson = "NDJSON",
}

export enum EventReplayExportDestination {
  LocalSnapshot = "LOCAL_SNAPSHOT",
  ExternalTransfer = "EXTERNAL_TRANSFER",
}

export enum EventReplayExportStatus {
  Exported = "EXPORTED",
  Rejected = "REJECTED",
}

export enum EventReplayAuditOperationType {
  TimelineCreated = "EVENT_REPLAY_TIMELINE_CREATED",
  SessionStarted = "EVENT_REPLAY_SESSION_STARTED",
  SessionCompleted = "EVENT_REPLAY_SESSION_COMPLETED",
  SessionReviewed = "EVENT_REPLAY_SESSION_REVIEWED",
  SessionSuperseded = "EVENT_REPLAY_SESSION_SUPERSEDED",
  SessionArchived = "EVENT_REPLAY_SESSION_ARCHIVED",
  ExportGenerated = "EVENT_REPLAY_EXPORT_GENERATED",
  ValidationRejected = "EVENT_REPLAY_VALIDATION_REJECTED",
}

export enum EventReplayErrorCategory {
  InvalidRecord = "INVALID_RECORD",
  InvalidId = "INVALID_ID",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidTimeline = "INVALID_TIMELINE",
  InvalidCheckpoint = "INVALID_CHECKPOINT",
  InvalidLifecycle = "INVALID_LIFECYCLE",
  InvalidReference = "INVALID_REFERENCE",
  MissingEvidence = "MISSING_EVIDENCE",
  MissingData = "MISSING_DATA",
  InvalidScore = "INVALID_SCORE",
  InvalidPrivacy = "INVALID_PRIVACY",
  ProhibitedBehavior = "PROHIBITED_BEHAVIOR",
  SecretMetadata = "SECRET_METADATA",
  RecordNotFound = "RECORD_NOT_FOUND",
  DuplicateId = "DUPLICATE_ID",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  ExportRestricted = "EXPORT_RESTRICTED",
  SensitiveExportUnauthorized = "SENSITIVE_EXPORT_UNAUTHORIZED",
  RepositoryCorrupt = "REPOSITORY_CORRUPT",
  InvalidPath = "INVALID_PATH",
  InvalidPagination = "INVALID_PAGINATION",
}

export interface ReplayReference {
  readonly referenceId: string;
  readonly referenceType: ReplayReferenceType;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly frozenStatus?: string;
  readonly summary?: string;
  readonly resolved: boolean;
}

export interface ReplayObservationWindow {
  readonly windowId: string;
  readonly windowType: ReplayObservationWindowType;
  readonly startTimestamp: string;
  readonly endTimestamp: string;
  readonly label: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
}

export interface ReplayTimelineEvent {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly phase: ReplayEventPhase;
  readonly title: string;
  readonly description: string;
  readonly observationWindowId?: string;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly snapshotReferenceIds: ReadonlyArray<string>;
  readonly patternReferenceIds: ReadonlyArray<string>;
  readonly analogyReferenceIds: ReadonlyArray<string>;
  readonly missingData: boolean;
  readonly limitations: ReadonlyArray<string>;
}

export interface ReplayCheckpoint {
  readonly checkpointId: ReplayCheckpointId;
  readonly checkpointType: ReplayCheckpointType;
  readonly sequence: number;
  readonly checkpointTimestamp: string;
  readonly phase: ReplayEventPhase;
  readonly eventIds: ReadonlyArray<string>;
  readonly observationWindowIds: ReadonlyArray<string>;
  readonly evidenceReferenceIds: ReadonlyArray<string>;
  readonly completenessScore: number;
  readonly confidenceScore: number;
  readonly immutable: true;
  readonly payloadFingerprint: string;
}

export interface ReplayTimeline {
  readonly timelineId: ReplayTimelineId;
  readonly schemaVersion: "1.0";
  readonly timelineVersion: string;
  readonly title: string;
  readonly description: string;
  readonly historicalEventReferences: ReadonlyArray<ReplayReference>;
  readonly patternReferences: ReadonlyArray<ReplayReference>;
  readonly analogyReferences: ReadonlyArray<ReplayReference>;
  readonly supportingEvidenceReferences: ReadonlyArray<ReplayReference>;
  readonly observationWindows: ReadonlyArray<ReplayObservationWindow>;
  readonly events: ReadonlyArray<ReplayTimelineEvent>;
  readonly checkpoints: ReadonlyArray<ReplayCheckpoint>;
  readonly missingDataPolicy: ReplayMissingDataPolicy;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata: AIAuditMetadata;
}

export interface ReplayLifecycleRecord {
  readonly historyId: string;
  readonly sessionId: ReplaySessionId;
  readonly lifecycleSequence: number;
  readonly fromStatus: EventReplayLifecycleStatus;
  readonly toStatus: EventReplayLifecycleStatus;
  readonly occurredAt: string;
  readonly reason: string;
  readonly referenceId?: string;
}

export interface ReplayStatistics {
  readonly eventCount: number;
  readonly checkpointCount: number;
  readonly observationWindowCount: number;
  readonly missingEventCount: number;
  readonly phaseCounts: Readonly<Record<string, number>>;
  readonly completenessScore: number;
  readonly confidenceScore: number;
  readonly qualityStatus: ReplayQualityStatus;
  readonly limitationCount: number;
}

export interface ReplaySession {
  readonly sessionId: ReplaySessionId;
  readonly schemaVersion: "1.0";
  readonly sessionVersion: string;
  readonly timelineReference: {
    readonly timelineId: ReplayTimelineId;
    readonly timelineVersion: string;
  };
  readonly replayedAt: string;
  readonly replayMode: "DETERMINISTIC_EVIDENCE_RECONSTRUCTION";
  readonly orderedEventIds: ReadonlyArray<string>;
  readonly checkpointIds: ReadonlyArray<string>;
  readonly statistics: ReplayStatistics;
  readonly qualityStatus: ReplayQualityStatus;
  readonly limitations: ReadonlyArray<string>;
  readonly references: ReadonlyArray<ReplayReference>;
  readonly status: EventReplayLifecycleStatus;
  readonly history: ReadonlyArray<ReplayLifecycleRecord>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly correlationId: string;
  readonly traceId: string;
  readonly metadata: AIAuditMetadata;
}

export interface ReplayReview {
  readonly reviewId: string;
  readonly sessionId: string;
  readonly createdAt: string;
  readonly reviewer: string;
  readonly decision: "USEFUL_EVIDENCE" | "LIMITED_EVIDENCE" | "REJECTED_EVIDENCE";
  readonly rationale: string;
  readonly unresolvedQuestionIds: ReadonlyArray<string>;
}

export interface ReplaySupersession {
  readonly supersessionId: string;
  readonly priorSessionId: string;
  readonly successorSessionId: string;
  readonly createdAt: string;
  readonly reason: string;
  readonly changedTimeline: boolean;
  readonly changedEvidence: boolean;
  readonly changedCheckpointMethod: boolean;
  readonly ownerReference: string;
}

export interface ReplayHistory {
  readonly session: ReplaySession;
  readonly lifecycle: ReadonlyArray<ReplayLifecycleRecord>;
  readonly reviews: ReadonlyArray<ReplayReview>;
  readonly supersessions: ReadonlyArray<ReplaySupersession>;
}

export interface ReplayFilter {
  readonly timelineId?: string;
  readonly statuses?: ReadonlyArray<EventReplayLifecycleStatus>;
  readonly qualityStatuses?: ReadonlyArray<ReplayQualityStatus>;
  readonly referenceType?: ReplayReferenceType;
  readonly sourceId?: string;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly currentOnly?: boolean;
}

export interface ReplayQuery {
  readonly filter?: ReplayFilter;
  readonly offset?: number;
  readonly limit?: number;
}

export interface ReplayRepositoryStatistics {
  readonly generatedAt: string;
  readonly timelineCount: number;
  readonly sessionCount: number;
  readonly sessionsByStatus: Readonly<Record<string, number>>;
  readonly sessionsByQuality: Readonly<Record<string, number>>;
  readonly phaseCounts: Readonly<Record<string, number>>;
  readonly reviewedCount: number;
  readonly supersededCount: number;
  readonly currentCount: number;
  readonly averageCompletenessScore?: number;
  readonly averageConfidenceScore?: number;
  readonly sampleSize: number;
}

export interface EventReplayError {
  readonly category: EventReplayErrorCategory;
  readonly message: string;
  readonly field?: string;
}

export interface EventReplayValidation {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<EventReplayError>;
}

export interface EventReplayAppendResult<T> {
  readonly status: EventReplayAppendStatus;
  readonly record: T;
  readonly repositorySequence: number;
}

export interface EventReplayExportRequest {
  readonly exportId: string;
  readonly requestedAt: string;
  readonly query: ReplayQuery;
  readonly format: EventReplayExportFormat;
  readonly destination: EventReplayExportDestination;
  readonly sensitiveAuthorizationReference?: string;
}

export interface EventReplayExportPolicy {
  readonly allowExternalExports: boolean;
  readonly requireSensitiveAuthorization: boolean;
  readonly sensitiveAuthorizationReferences: ReadonlyArray<string>;
}

export interface EventReplayExportResult {
  readonly status: EventReplayExportStatus;
  readonly exportId: string;
  readonly exportedAt: string;
  readonly format: EventReplayExportFormat;
  readonly recordCount: number;
  readonly content?: string;
  readonly error?: EventReplayError;
}

export interface EventReplayAuditRecord {
  readonly auditId: string;
  readonly operationType: EventReplayAuditOperationType;
  readonly sourceRecordId: string;
  readonly recordVersion?: string;
  readonly timestamp: string;
  readonly status: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly timelineId?: string;
  readonly sessionId?: string;
  readonly qualityStatus?: ReplayQualityStatus;
  readonly statistics?: ReplayStatistics;
  readonly limitations: ReadonlyArray<string>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly correlationId: string;
  readonly traceId: string;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly metadata: AIAuditMetadata;
}

export interface EventReplayAuditTranslationContext {
  readonly idempotencyKey: string;
  readonly actor: AIAuditActor;
  readonly parentAuditRecordIds: ReadonlyArray<string>;
  readonly relatedAuditRecordIds: ReadonlyArray<string>;
}

export interface EventReplayAuditTranslation {
  readonly source: EventReplayAuditRecord;
  readonly input: AIAuditRecordInput;
}

export interface EventReplayRepository {
  appendTimeline(value: ReplayTimeline, acceptedAt: string): EventReplayAppendResult<ReplayTimeline>;
  appendSession(value: ReplaySession, acceptedAt: string): EventReplayAppendResult<ReplaySession>;
  appendReview(value: ReplayReview, history: ReplayLifecycleRecord, acceptedAt: string): EventReplayAppendResult<ReplayReview>;
  appendSupersession(value: ReplaySupersession, history: ReplayLifecycleRecord, acceptedAt: string): EventReplayAppendResult<ReplaySupersession>;
  appendArchive(history: ReplayLifecycleRecord, acceptedAt: string): EventReplayAppendResult<ReplayLifecycleRecord>;
  getTimelineById(id: string): ReplayTimeline | undefined;
  getSessionById(id: string): ReplaySession | undefined;
  getHistory(id: string): ReplayHistory | undefined;
  query(query?: ReplayQuery): ReadonlyArray<ReplaySession>;
  listTimelines(): ReadonlyArray<ReplayTimeline>;
  listSessions(): ReadonlyArray<ReplaySession>;
}

export const EVENT_REPLAY_SCORE_SCALE = 10000 as const;
