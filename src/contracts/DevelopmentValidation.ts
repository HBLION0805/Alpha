import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";

export enum DevelopmentValidationRecordType {
  TaskCreated = "TASK_CREATED",
  InspectionCompleted = "INSPECTION_COMPLETED",
  ImplementationCompleted = "IMPLEMENTATION_COMPLETED",
  ValidationRun = "VALIDATION_RUN",
  ValidationPassed = "VALIDATION_PASSED",
  ValidationFailed = "VALIDATION_FAILED",
  OwnerReview = "OWNER_REVIEW",
  OwnerApproval = "OWNER_APPROVAL",
  OwnerRejection = "OWNER_REJECTION",
  DefectFound = "DEFECT_FOUND",
  RiskIdentified = "RISK_IDENTIFIED",
  AssumptionRecorded = "ASSUMPTION_RECORDED",
  ScopeChange = "SCOPE_CHANGE",
  CompensationAction = "COMPENSATION_ACTION",
  CommitCreated = "COMMIT_CREATED",
  PushCompleted = "PUSH_COMPLETED",
  HandoffCompleted = "HANDOFF_COMPLETED",
  LessonLearned = "LESSON_LEARNED",
  FollowUpRequired = "FOLLOW_UP_REQUIRED",
  EnvironmentWarning = "ENVIRONMENT_WARNING",
}

export enum DevelopmentTaskStatus {
  Planned = "PLANNED",
  InProgress = "IN_PROGRESS",
  Implemented = "IMPLEMENTED",
  Validated = "VALIDATED",
  OwnerReviewed = "OWNER_REVIEWED",
  Approved = "APPROVED",
  Committed = "COMMITTED",
  Pushed = "PUSHED",
  HandedOff = "HANDED_OFF",
  Closed = "CLOSED",
  Rejected = "REJECTED",
  Blocked = "BLOCKED",
  Cancelled = "CANCELLED",
}

export enum DevelopmentActorType {
  Owner = "OWNER",
  Architect = "ARCHITECT",
  AiAgent = "AI_AGENT",
  AlphaSubsystem = "ALPHA_SUBSYSTEM",
  System = "SYSTEM",
  ScheduledJob = "SCHEDULED_JOB",
}

export enum DevelopmentTestResult {
  Passed = "PASSED",
  Failed = "FAILED",
  Warning = "WARNING",
  Skipped = "SKIPPED",
}

export enum DevelopmentValidationCheckResult {
  Passed = "PASSED",
  Failed = "FAILED",
  Warning = "WARNING",
  Skipped = "SKIPPED",
}

export enum DevelopmentDefectSeverity {
  Critical = "CRITICAL",
  High = "HIGH",
  Medium = "MEDIUM",
  Low = "LOW",
}

export enum DevelopmentDefectStatus {
  Open = "OPEN",
  Resolved = "RESOLVED",
  Accepted = "ACCEPTED",
  Deferred = "DEFERRED",
}

export enum DevelopmentOwnerDecision {
  Approved = "APPROVED",
  ApprovedWithConditions = "APPROVED_WITH_CONDITIONS",
  Rejected = "REJECTED",
  ChangesRequired = "CHANGES_REQUIRED",
}

export enum DevelopmentRiskDecision {
  Pending = "PENDING",
  Accepted = "ACCEPTED",
  Rejected = "REJECTED",
}

export enum DevelopmentPushStatus {
  Succeeded = "SUCCEEDED",
  Failed = "FAILED",
  Partial = "PARTIAL",
  NotAttempted = "NOT_ATTEMPTED",
}

export enum DevelopmentWorkingTreeState {
  Clean = "CLEAN",
  Dirty = "DIRTY",
  Unknown = "UNKNOWN",
}

export enum DevelopmentFollowUpStatus {
  Pending = "PENDING",
  Completed = "COMPLETED",
  Cancelled = "CANCELLED",
}

export enum DevelopmentAppendStatus {
  Appended = "APPENDED",
  Replayed = "REPLAYED",
}

export enum DevelopmentExportFormat {
  Json = "JSON",
  Ndjson = "NDJSON",
}

export enum DevelopmentExportDestination {
  LocalSnapshot = "LOCAL_SNAPSHOT",
  ExternalTransfer = "EXTERNAL_TRANSFER",
}

export enum DevelopmentExportStatus {
  Exported = "EXPORTED",
  Rejected = "REJECTED",
}

export enum DevelopmentValidationErrorCategory {
  InvalidRecord = "INVALID_RECORD",
  InvalidId = "INVALID_ID",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  FutureTimestamp = "FUTURE_TIMESTAMP",
  DuplicateId = "DUPLICATE_ID",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  TaskNotFound = "TASK_NOT_FOUND",
  InvalidLifecycle = "INVALID_LIFECYCLE",
  ValidationRequired = "VALIDATION_REQUIRED",
  ReviewRequired = "REVIEW_REQUIRED",
  ApprovalRequired = "APPROVAL_REQUIRED",
  InvalidOwnerDecision = "INVALID_OWNER_DECISION",
  InvalidGitReference = "INVALID_GIT_REFERENCE",
  InvalidCounts = "INVALID_COUNTS",
  InvalidReference = "INVALID_REFERENCE",
  InvalidPrivacy = "INVALID_PRIVACY",
  SecretMetadata = "SECRET_METADATA",
  ExportRestricted = "EXPORT_RESTRICTED",
  SensitiveExportUnauthorized = "SENSITIVE_EXPORT_UNAUTHORIZED",
  RepositoryCorrupt = "REPOSITORY_CORRUPT",
  InvalidPath = "INVALID_PATH",
}

export interface DevelopmentTaskReference {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly projectDay: string;
}

export interface DevelopmentScope {
  readonly summary: string;
  readonly allowedPaths: ReadonlyArray<string>;
  readonly restrictions: ReadonlyArray<string>;
  readonly nonGoals: ReadonlyArray<string>;
}

export interface DevelopmentFileChange {
  readonly path: string;
  readonly changeType: "CREATED" | "MODIFIED" | "DELETED";
  readonly summary: string;
}

export interface DevelopmentTestRun {
  readonly testRunId: string;
  readonly logicalName: string;
  readonly command?: string;
  readonly suite: string;
  readonly subsystem: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly result: DevelopmentTestResult;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly environment: string;
  readonly warnings: ReadonlyArray<string>;
  readonly failureSummary?: string;
  readonly evidenceReference?: string;
  readonly rerunOfTestRunId?: string;
  readonly blocksApproval: boolean;
}

export interface DevelopmentValidationCheck {
  readonly checkId: string;
  readonly name: string;
  readonly result: DevelopmentValidationCheckResult;
  readonly summary: string;
  readonly evidenceReference?: string;
  readonly blocksApproval: boolean;
}

export interface DevelopmentFailure {
  readonly failureId: string;
  readonly category: string;
  readonly summary: string;
  readonly evidenceReference?: string;
  readonly blocking: boolean;
}

export interface DevelopmentEnvironmentWarning {
  readonly warningId: string;
  readonly warningType: string;
  readonly message: string;
  readonly environment: string;
  readonly evidenceReference?: string;
}

export interface DevelopmentDefect {
  readonly defectId: string;
  readonly severity: DevelopmentDefectSeverity;
  readonly affectedSubsystem: string;
  readonly description: string;
  readonly reproductionEvidence: string;
  readonly status: DevelopmentDefectStatus;
  readonly blocking: boolean;
  readonly resolutionReference?: string;
}

export interface DevelopmentRisk {
  readonly riskId: string;
  readonly description: string;
  readonly impact: string;
  readonly likelihood?: number;
  readonly decision: DevelopmentRiskDecision;
  readonly blocking: boolean;
  readonly mitigation: string;
  readonly ownerDecision?: string;
}

export interface DevelopmentAssumption {
  readonly assumptionId: string;
  readonly statement: string;
  readonly rationale: string;
  readonly validated: boolean;
  readonly invalidationCondition: string;
}

export interface DevelopmentOwnerReview {
  readonly reviewId: string;
  readonly reviewedTaskId: string;
  readonly reviewedAt: string;
  readonly reviewedFiles: ReadonlyArray<string>;
  readonly diffReference?: string;
  readonly decision: DevelopmentOwnerDecision;
  readonly conditions: ReadonlyArray<string>;
  readonly concerns: ReadonlyArray<string>;
  readonly acceptedRiskIds: ReadonlyArray<string>;
  readonly requiredFollowUpIds: ReadonlyArray<string>;
  readonly ownerReference: string;
  readonly gitReference?: string;
}

export interface DevelopmentValidationException {
  readonly exceptionId: string;
  readonly acceptedByOwner: string;
  readonly acceptedAt: string;
  readonly validationIds: ReadonlyArray<string>;
  readonly reason: string;
  readonly followUpReference: string;
}

export interface DevelopmentOwnerApproval {
  readonly approvalId: string;
  readonly taskId: string;
  readonly decidedAt: string;
  readonly ownerReference: string;
  readonly decision: DevelopmentOwnerDecision.Approved | DevelopmentOwnerDecision.ApprovedWithConditions | DevelopmentOwnerDecision.Rejected;
  readonly conditions: ReadonlyArray<string>;
  readonly reason: string;
  readonly reviewId: string;
  readonly gitReference?: string;
  readonly acceptedValidationException?: DevelopmentValidationException;
}

export interface DevelopmentCommitReference {
  readonly commitHash: string;
  readonly commitMessage: string;
  readonly branch: string;
  readonly baseCommit: string;
  readonly createdAt: string;
}

export interface DevelopmentPushReference {
  readonly remote: string;
  readonly branch: string;
  readonly status: DevelopmentPushStatus;
  readonly pushedAt: string;
  readonly localCommit: string;
  readonly remoteCommit: string;
  readonly synchronized: boolean;
}

export interface DevelopmentGitReference {
  readonly branch: string;
  readonly baseCommit: string;
  readonly workingTreeState: DevelopmentWorkingTreeState;
  readonly remote?: string;
  readonly commit?: DevelopmentCommitReference;
  readonly push?: DevelopmentPushReference;
  readonly milestoneTag?: string;
}

export interface DevelopmentHandoffReference {
  readonly handoffId: string;
  readonly documentPath: string;
  readonly completedAt: string;
  readonly summary: string;
}

export interface DevelopmentFollowUp {
  readonly followUpId: string;
  readonly taskReference: string;
  readonly priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly reason: string;
  readonly dependency?: string;
  readonly recommendedProjectDay?: string;
  readonly status: DevelopmentFollowUpStatus;
  readonly completionReference?: string;
}

export interface DevelopmentLesson {
  readonly lessonId: string;
  readonly statement: string;
  readonly evidenceReferences: ReadonlyArray<string>;
  readonly recommendedApplication: string;
}

export interface DevelopmentValidationRecordSnapshot extends DevelopmentTaskReference {
  readonly recordId: string;
  readonly schemaVersion: "1.0";
  readonly recordType: DevelopmentValidationRecordType;
  readonly timestamp: string;
  readonly actorType: DevelopmentActorType;
  readonly ownerReference?: string;
  readonly requestedGoal: string;
  readonly approvedScope: DevelopmentScope;
  readonly filesCreated: ReadonlyArray<string>;
  readonly filesModified: ReadonlyArray<string>;
  readonly filesDeleted: ReadonlyArray<string>;
  readonly fileChanges: ReadonlyArray<DevelopmentFileChange>;
  readonly implementationSummary: string;
  readonly testsRequested: ReadonlyArray<string>;
  readonly testRuns: ReadonlyArray<DevelopmentTestRun>;
  readonly validationChecks: ReadonlyArray<DevelopmentValidationCheck>;
  readonly failures: ReadonlyArray<DevelopmentFailure>;
  readonly defects: ReadonlyArray<DevelopmentDefect>;
  readonly environmentWarnings: ReadonlyArray<DevelopmentEnvironmentWarning>;
  readonly risks: ReadonlyArray<DevelopmentRisk>;
  readonly assumptions: ReadonlyArray<DevelopmentAssumption>;
  readonly ownerReview?: DevelopmentOwnerReview;
  readonly ownerApproval?: DevelopmentOwnerApproval;
  readonly gitReference?: DevelopmentGitReference;
  readonly handoffReference?: DevelopmentHandoffReference;
  readonly followUps: ReadonlyArray<DevelopmentFollowUp>;
  readonly lessons: ReadonlyArray<DevelopmentLesson>;
  readonly priorRecordId?: string;
  readonly amendmentOfRecordId?: string;
  readonly nonCodeTask: boolean;
  readonly correlationId: string;
  readonly traceId: string;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly status: DevelopmentTaskStatus;
  readonly sourceAuditReferences: ReadonlyArray<string>;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly metadata: AIAuditMetadata;
}

export interface DevelopmentValidationRecord extends DevelopmentValidationRecordSnapshot {
  readonly sequence: number;
  readonly payloadFingerprint: string;
}

export interface DevelopmentTaskLifecycle {
  readonly initialStatus: DevelopmentTaskStatus.Planned;
  readonly allowedTransitions: Readonly<Record<DevelopmentTaskStatus, ReadonlyArray<DevelopmentTaskStatus>>>;
}

export interface DevelopmentFilter {
  readonly taskId?: string;
  readonly projectDay?: string;
  readonly recordTypes?: ReadonlyArray<DevelopmentValidationRecordType>;
  readonly statuses?: ReadonlyArray<DevelopmentTaskStatus>;
  readonly ownerDecisions?: ReadonlyArray<DevelopmentOwnerDecision>;
  readonly commitHash?: string;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly failedValidationsOnly?: boolean;
  readonly openDefectsOnly?: boolean;
  readonly acceptedRisksOnly?: boolean;
  readonly pendingFollowUpsOnly?: boolean;
}

export interface DevelopmentQuery {
  readonly filter?: DevelopmentFilter;
  readonly offset?: number;
  readonly limit?: number;
}

export interface DevelopmentSummary {
  readonly taskId: string;
  readonly taskTitle: string;
  readonly projectDay: string;
  readonly latestStatus: DevelopmentTaskStatus;
  readonly recordCount: number;
  readonly validationPassed: number;
  readonly validationFailed: number;
  readonly openDefectCount: number;
  readonly acceptedRiskCount: number;
  readonly pendingFollowUpCount: number;
  readonly commitHash?: string;
  readonly pushed: boolean;
}

export interface DevelopmentStatistics {
  readonly generatedAt: string;
  readonly taskCount: number;
  readonly recordCount: number;
  readonly tasksByStatus: Readonly<Partial<Record<DevelopmentTaskStatus, number>>>;
  readonly tasksByProjectDay: Readonly<Record<string, number>>;
  readonly validationsPassed: number;
  readonly validationsFailed: number;
  readonly testCountsBySubsystem: Readonly<Record<string, { readonly passed: number; readonly failed: number; readonly skipped: number }>>;
  readonly defectsBySeverity: Readonly<Partial<Record<DevelopmentDefectSeverity, number>>>;
  readonly openDefectCount: number;
  readonly acceptedRiskCount: number;
  readonly tasksRequiringFollowUp: number;
  readonly reviewToApprovalDurationMs: Readonly<Record<string, number>>;
  readonly implementationToPushDurationMs: Readonly<Record<string, number>>;
  readonly commitsByMilestone: Readonly<Record<string, number>>;
  readonly environmentWarningsByType: Readonly<Record<string, number>>;
}

export interface DevelopmentHistory {
  readonly task: DevelopmentTaskReference;
  readonly records: ReadonlyArray<DevelopmentValidationRecord>;
  readonly currentStatus: DevelopmentTaskStatus;
}

export interface DevelopmentValidationError {
  readonly category: DevelopmentValidationErrorCategory;
  readonly message: string;
  readonly field?: string;
}

export interface DevelopmentValidationResult {
  readonly valid: boolean;
  readonly errors: ReadonlyArray<DevelopmentValidationError>;
}

export interface DevelopmentAppendResult {
  readonly status: DevelopmentAppendStatus;
  readonly record: DevelopmentValidationRecord;
  readonly repositorySequence: number;
}

export interface DevelopmentExportRequest {
  readonly exportId: string;
  readonly requestedAt: string;
  readonly query: DevelopmentQuery;
  readonly format: DevelopmentExportFormat;
  readonly destination: DevelopmentExportDestination;
  readonly sensitiveAuthorizationReference?: string;
}

export interface DevelopmentExportPolicy {
  readonly allowExternalExports: boolean;
  readonly requireSensitiveAuthorization: boolean;
  readonly sensitiveAuthorizationReferences: ReadonlyArray<string>;
}

export interface DevelopmentExportResult {
  readonly status: DevelopmentExportStatus;
  readonly exportId: string;
  readonly exportedAt: string;
  readonly format: DevelopmentExportFormat;
  readonly recordCount: number;
  readonly content?: string;
  readonly error?: DevelopmentValidationError;
}

export interface DevelopmentAuditTranslationContext {
  readonly idempotencyKey: string;
  readonly actor: AIAuditActor;
  readonly parentAuditRecordIds: ReadonlyArray<string>;
  readonly relatedAuditRecordIds: ReadonlyArray<string>;
}

export type DevelopmentAuditTranslation = (
  source: Readonly<DevelopmentValidationRecord>,
  context: Readonly<DevelopmentAuditTranslationContext>,
) => AIAuditRecordInput;

export const DEFAULT_DEVELOPMENT_TASK_LIFECYCLE: DevelopmentTaskLifecycle = {
  initialStatus: DevelopmentTaskStatus.Planned,
  allowedTransitions: {
    [DevelopmentTaskStatus.Planned]: [DevelopmentTaskStatus.InProgress, DevelopmentTaskStatus.Blocked, DevelopmentTaskStatus.Cancelled],
    [DevelopmentTaskStatus.InProgress]: [DevelopmentTaskStatus.Implemented, DevelopmentTaskStatus.Blocked, DevelopmentTaskStatus.Cancelled],
    [DevelopmentTaskStatus.Implemented]: [DevelopmentTaskStatus.Validated, DevelopmentTaskStatus.Blocked, DevelopmentTaskStatus.Cancelled],
    [DevelopmentTaskStatus.Validated]: [DevelopmentTaskStatus.OwnerReviewed, DevelopmentTaskStatus.Blocked, DevelopmentTaskStatus.Cancelled],
    [DevelopmentTaskStatus.OwnerReviewed]: [DevelopmentTaskStatus.Approved, DevelopmentTaskStatus.Rejected, DevelopmentTaskStatus.Blocked, DevelopmentTaskStatus.Cancelled],
    [DevelopmentTaskStatus.Approved]: [DevelopmentTaskStatus.Committed, DevelopmentTaskStatus.HandedOff, DevelopmentTaskStatus.Blocked, DevelopmentTaskStatus.Cancelled],
    [DevelopmentTaskStatus.Committed]: [DevelopmentTaskStatus.Pushed, DevelopmentTaskStatus.Blocked],
    [DevelopmentTaskStatus.Pushed]: [DevelopmentTaskStatus.HandedOff],
    [DevelopmentTaskStatus.HandedOff]: [DevelopmentTaskStatus.Closed],
    [DevelopmentTaskStatus.Closed]: [],
    [DevelopmentTaskStatus.Rejected]: [],
    [DevelopmentTaskStatus.Blocked]: [],
    [DevelopmentTaskStatus.Cancelled]: [],
  },
};
