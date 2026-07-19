import { AIAuditRetentionClassification } from "./AIAuditRepository";
import { PrivacyLevel } from "./AIRouter";
import {
  DEFAULT_DEVELOPMENT_TASK_LIFECYCLE,
  DevelopmentActorType,
  DevelopmentDefectSeverity,
  DevelopmentDefectStatus,
  DevelopmentExportDestination,
  DevelopmentExportFormat,
  DevelopmentFollowUpStatus,
  DevelopmentOwnerDecision,
  DevelopmentPushStatus,
  DevelopmentRiskDecision,
  DevelopmentTaskStatus,
  DevelopmentTestResult,
  DevelopmentValidationCheckResult,
  DevelopmentValidationErrorCategory,
  DevelopmentValidationRecordType,
  DevelopmentWorkingTreeState,
  type DevelopmentHistory,
  type DevelopmentQuery,
  type DevelopmentTestRun,
  type DevelopmentValidationError,
  type DevelopmentValidationRecord,
  type DevelopmentValidationRecordSnapshot,
  type DevelopmentValidationResult,
} from "./DevelopmentValidation";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const PATH_PATTERN = /^(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[^\u0000]+$/;
const GIT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/i;
const SECRET_KEY_PATTERN = /(api.?key|secret|password|credential|authorization|bearer|private.?key|access.?token)/i;

export function canonicalizeDevelopmentValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return '"[Undefined]"';
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(`[${String(value)}]`);
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeDevelopmentValue).join(",")}]`;
  if (typeof value === "object") return `{${Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonicalizeDevelopmentValue(entry)}`).join(",")}}`;
  return JSON.stringify(String(value));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function developmentFingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalizeDevelopmentValue(value))}`;
}

function add(errors: DevelopmentValidationError[], category: DevelopmentValidationErrorCategory, message: string, field?: string): void {
  errors.push(field === undefined ? { category, message } : { category, message, field });
}

function nonEmpty(errors: DevelopmentValidationError[], field: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, `${field} must be non-empty.`, field);
}

function id(errors: DevelopmentValidationError[], field: string, value: string): void {
  nonEmpty(errors, field, value);
  if (typeof value === "string" && !ID_PATTERN.test(value)) add(errors, DevelopmentValidationErrorCategory.InvalidId, `${field} contains unsupported characters.`, field);
}

function timestamp(errors: DevelopmentValidationError[], field: string, value: string, now: string, allowFuture = false): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/(Z|[+-]\d{2}:\d{2})$/.test(value)) add(errors, DevelopmentValidationErrorCategory.InvalidTimestamp, `${field} must be an ISO-8601 timestamp with timezone.`, field);
  else if (!allowFuture && parsed > Date.parse(now)) add(errors, DevelopmentValidationErrorCategory.FutureTimestamp, `${field} cannot be in the future.`, field);
}

function strings(errors: DevelopmentValidationError[], field: string, values: ReadonlyArray<string>, paths = false): void {
  if (!Array.isArray(values)) { add(errors, DevelopmentValidationErrorCategory.InvalidRecord, `${field} must be an array.`, field); return; }
  for (const value of values) {
    nonEmpty(errors, field, value);
    if (paths && !PATH_PATTERN.test(value)) add(errors, DevelopmentValidationErrorCategory.InvalidReference, `${field} contains an invalid path.`, field);
  }
  if (new Set(values).size !== values.length) add(errors, DevelopmentValidationErrorCategory.DuplicateId, `${field} contains duplicates.`, field);
}

function metadata(errors: DevelopmentValidationError[], values: Readonly<Record<string, unknown>>): void {
  for (const [key, value] of Object.entries(values)) {
    id(errors, "metadata key", key);
    if (SECRET_KEY_PATTERN.test(key)) add(errors, DevelopmentValidationErrorCategory.SecretMetadata, "secret-bearing metadata keys are prohibited.", `metadata.${key}`);
    if (value !== null && typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isSafeInteger(value))) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "metadata values must be scalar and finite.", `metadata.${key}`);
  }
}

function counts(errors: DevelopmentValidationError[], run: DevelopmentTestRun): void {
  const values = [run.passedCount, run.failedCount, run.skippedCount];
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) add(errors, DevelopmentValidationErrorCategory.InvalidCounts, "test counts must be non-negative safe integers.", "testRuns");
  if (run.result === DevelopmentTestResult.Passed && (run.failedCount !== 0 || run.passedCount === 0)) add(errors, DevelopmentValidationErrorCategory.InvalidCounts, "PASSED test run requires at least one pass and no failures.", "testRuns");
  if (run.result === DevelopmentTestResult.Failed && run.failedCount === 0) add(errors, DevelopmentValidationErrorCategory.InvalidCounts, "FAILED test run requires at least one failure.", "testRuns");
  if (run.result === DevelopmentTestResult.Warning && run.failedCount !== 0) add(errors, DevelopmentValidationErrorCategory.InvalidCounts, "WARNING test run cannot contain failed tests.", "testRuns");
  if (run.result === DevelopmentTestResult.Skipped && (run.passedCount !== 0 || run.failedCount !== 0 || run.skippedCount === 0)) add(errors, DevelopmentValidationErrorCategory.InvalidCounts, "SKIPPED test run must contain only skipped tests.", "testRuns");
}

function validateTestRun(errors: DevelopmentValidationError[], run: DevelopmentTestRun, now: string): void {
  id(errors, "testRunId", run.testRunId);
  nonEmpty(errors, "test logicalName", run.logicalName);
  nonEmpty(errors, "test suite", run.suite);
  nonEmpty(errors, "test subsystem", run.subsystem);
  timestamp(errors, "test startedAt", run.startedAt, now);
  timestamp(errors, "test completedAt", run.completedAt, now);
  if (Date.parse(run.completedAt) < Date.parse(run.startedAt)) add(errors, DevelopmentValidationErrorCategory.InvalidTimestamp, "test completion cannot precede start.", "testRuns");
  if (!Object.values(DevelopmentTestResult).includes(run.result)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "test result is invalid.", "testRuns");
  strings(errors, "test warnings", run.warnings);
  if (run.result === DevelopmentTestResult.Failed && (run.failureSummary === undefined || run.failureSummary.trim().length === 0)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "failed test requires a failure summary.", "testRuns");
  if (run.rerunOfTestRunId !== undefined) id(errors, "rerunOfTestRunId", run.rerunOfTestRunId);
  counts(errors, run);
}

function validateGit(errors: DevelopmentValidationError[], snapshot: DevelopmentValidationRecordSnapshot, now: string): void {
  const git = snapshot.gitReference;
  if (git === undefined) return;
  if (!GIT_REF_PATTERN.test(git.branch)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "Git branch is invalid.", "gitReference.branch");
  if (!COMMIT_PATTERN.test(git.baseCommit)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "base commit is invalid.", "gitReference.baseCommit");
  if (!Object.values(DevelopmentWorkingTreeState).includes(git.workingTreeState)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "working tree state is invalid.");
  if (git.remote !== undefined && !GIT_REF_PATTERN.test(git.remote)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "remote is invalid.");
  if (git.commit !== undefined) {
    if (!COMMIT_PATTERN.test(git.commit.commitHash) || !COMMIT_PATTERN.test(git.commit.baseCommit)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "commit hash or base commit is invalid.");
    nonEmpty(errors, "commit message", git.commit.commitMessage);
    timestamp(errors, "commit createdAt", git.commit.createdAt, now);
    if (git.commit.branch !== git.branch || git.commit.baseCommit !== git.baseCommit) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "commit branch/base must match Git reference.");
  }
  if (git.push !== undefined) {
    timestamp(errors, "push pushedAt", git.push.pushedAt, now);
    if (!Object.values(DevelopmentPushStatus).includes(git.push.status) || git.push.branch !== git.branch || git.remote === undefined || git.push.remote !== git.remote) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "push branch/remote is inconsistent.");
    if (!COMMIT_PATTERN.test(git.push.localCommit) || !COMMIT_PATTERN.test(git.push.remoteCommit)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "push commit identity is invalid.");
    if (git.push.synchronized && (git.push.status !== DevelopmentPushStatus.Succeeded || git.push.localCommit !== git.push.remoteCommit)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "synchronized push requires successful equal local and remote commits.");
    if (git.commit !== undefined && git.push.localCommit !== git.commit.commitHash) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "push local commit must match commit reference.");
  }
}

export function validateDevelopmentSnapshot(snapshot: DevelopmentValidationRecordSnapshot, now: string): DevelopmentValidationResult {
  const errors: DevelopmentValidationError[] = [];
  if (snapshot.schemaVersion !== "1.0") add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "schemaVersion must be 1.0.");
  id(errors, "recordId", snapshot.recordId); id(errors, "taskId", snapshot.taskId);
  nonEmpty(errors, "taskTitle", snapshot.taskTitle); nonEmpty(errors, "projectDay", snapshot.projectDay);
  if (!Object.values(DevelopmentValidationRecordType).includes(snapshot.recordType)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "record type is invalid.");
  if (!Object.values(DevelopmentTaskStatus).includes(snapshot.status)) add(errors, DevelopmentValidationErrorCategory.InvalidLifecycle, "task status is invalid.");
  if (!Object.values(DevelopmentActorType).includes(snapshot.actorType)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "actor type is invalid.");
  timestamp(errors, "timestamp", snapshot.timestamp, now);
  nonEmpty(errors, "requestedGoal", snapshot.requestedGoal); nonEmpty(errors, "approvedScope.summary", snapshot.approvedScope.summary);
  strings(errors, "approvedScope.allowedPaths", snapshot.approvedScope.allowedPaths, true); strings(errors, "approvedScope.restrictions", snapshot.approvedScope.restrictions); strings(errors, "approvedScope.nonGoals", snapshot.approvedScope.nonGoals);
  strings(errors, "filesCreated", snapshot.filesCreated, true); strings(errors, "filesModified", snapshot.filesModified, true); strings(errors, "filesDeleted", snapshot.filesDeleted, true);
  const allFiles = [...snapshot.filesCreated, ...snapshot.filesModified, ...snapshot.filesDeleted]; if (new Set(allFiles).size !== allFiles.length) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "a file cannot appear in multiple change lists.");
  for (const change of snapshot.fileChanges) { if (!PATH_PATTERN.test(change.path)) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "file change path is invalid."); nonEmpty(errors, "fileChange.summary", change.summary); const expected = change.changeType === "CREATED" ? snapshot.filesCreated : change.changeType === "MODIFIED" ? snapshot.filesModified : snapshot.filesDeleted; if (!expected.includes(change.path)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "file change must appear in its matching file list."); }
  nonEmpty(errors, "implementationSummary", snapshot.implementationSummary); strings(errors, "testsRequested", snapshot.testsRequested);
  const testIds = new Set<string>(); for (const run of snapshot.testRuns) { validateTestRun(errors, run, now); if (testIds.has(run.testRunId)) add(errors, DevelopmentValidationErrorCategory.DuplicateId, "duplicate test run ID."); testIds.add(run.testRunId); }
  const checkIds = new Set<string>(); for (const check of snapshot.validationChecks) { id(errors, "checkId", check.checkId); nonEmpty(errors, "validation check name", check.name); nonEmpty(errors, "validation check summary", check.summary); if (!Object.values(DevelopmentValidationCheckResult).includes(check.result)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "validation check result is invalid."); if (checkIds.has(check.checkId)) add(errors, DevelopmentValidationErrorCategory.DuplicateId, "duplicate validation check ID."); checkIds.add(check.checkId); }
  for (const failure of snapshot.failures) { id(errors, "failureId", failure.failureId); nonEmpty(errors, "failure category", failure.category); nonEmpty(errors, "failure summary", failure.summary); }
  for (const warning of snapshot.environmentWarnings) { id(errors, "warningId", warning.warningId); nonEmpty(errors, "warning type", warning.warningType); nonEmpty(errors, "warning message", warning.message); nonEmpty(errors, "warning environment", warning.environment); }
  for (const defect of snapshot.defects) { id(errors, "defectId", defect.defectId); if (!Object.values(DevelopmentDefectSeverity).includes(defect.severity) || !Object.values(DevelopmentDefectStatus).includes(defect.status)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "defect severity/status is invalid."); nonEmpty(errors, "defect subsystem", defect.affectedSubsystem); nonEmpty(errors, "defect description", defect.description); nonEmpty(errors, "defect reproduction", defect.reproductionEvidence); if (defect.status === DevelopmentDefectStatus.Resolved && defect.resolutionReference === undefined) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "resolved defect requires resolution reference."); }
  for (const risk of snapshot.risks) { id(errors, "riskId", risk.riskId); nonEmpty(errors, "risk description", risk.description); nonEmpty(errors, "risk impact", risk.impact); nonEmpty(errors, "risk mitigation", risk.mitigation); if (!Object.values(DevelopmentRiskDecision).includes(risk.decision)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "risk decision is invalid."); if (risk.likelihood !== undefined && (!Number.isFinite(risk.likelihood) || risk.likelihood < 0 || risk.likelihood > 100)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "risk likelihood must be 0-100."); if (risk.decision === DevelopmentRiskDecision.Accepted && (risk.ownerDecision === undefined || risk.ownerDecision.trim().length === 0)) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "accepted risk requires owner decision."); }
  for (const assumption of snapshot.assumptions) { id(errors, "assumptionId", assumption.assumptionId); nonEmpty(errors, "assumption statement", assumption.statement); nonEmpty(errors, "assumption rationale", assumption.rationale); nonEmpty(errors, "assumption invalidationCondition", assumption.invalidationCondition); }
  for (const followUp of snapshot.followUps) { id(errors, "followUpId", followUp.followUpId); nonEmpty(errors, "follow-up task", followUp.taskReference); nonEmpty(errors, "follow-up reason", followUp.reason); if (!Object.values(DevelopmentFollowUpStatus).includes(followUp.status)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "follow-up status is invalid."); if (followUp.status === DevelopmentFollowUpStatus.Completed && followUp.completionReference === undefined) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "completed follow-up requires completion reference."); }
  for (const lesson of snapshot.lessons) { id(errors, "lessonId", lesson.lessonId); nonEmpty(errors, "lesson statement", lesson.statement); strings(errors, "lesson evidence", lesson.evidenceReferences); nonEmpty(errors, "lesson recommendedApplication", lesson.recommendedApplication); }
  if (snapshot.ownerReview !== undefined) { id(errors, "reviewId", snapshot.ownerReview.reviewId); if (snapshot.ownerReview.reviewedTaskId !== snapshot.taskId) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "owner review task does not match."); timestamp(errors, "owner review reviewedAt", snapshot.ownerReview.reviewedAt, now); strings(errors, "owner review files", snapshot.ownerReview.reviewedFiles, true); if (!Object.values(DevelopmentOwnerDecision).includes(snapshot.ownerReview.decision)) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "owner review decision is invalid."); id(errors, "owner review ownerReference", snapshot.ownerReview.ownerReference); }
  if (snapshot.ownerApproval !== undefined) { id(errors, "approvalId", snapshot.ownerApproval.approvalId); if (snapshot.ownerApproval.taskId !== snapshot.taskId) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "owner approval task does not match."); timestamp(errors, "owner approval decidedAt", snapshot.ownerApproval.decidedAt, now); id(errors, "owner approval ownerReference", snapshot.ownerApproval.ownerReference); id(errors, "owner approval reviewId", snapshot.ownerApproval.reviewId); nonEmpty(errors, "owner approval reason", snapshot.ownerApproval.reason); if (![DevelopmentOwnerDecision.Approved, DevelopmentOwnerDecision.ApprovedWithConditions, DevelopmentOwnerDecision.Rejected].includes(snapshot.ownerApproval.decision)) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "owner approval decision is invalid."); if (snapshot.ownerApproval.acceptedValidationException !== undefined) { const exception = snapshot.ownerApproval.acceptedValidationException; id(errors, "exceptionId", exception.exceptionId); id(errors, "exception acceptedByOwner", exception.acceptedByOwner); timestamp(errors, "exception acceptedAt", exception.acceptedAt, now); strings(errors, "exception validationIds", exception.validationIds); nonEmpty(errors, "exception reason", exception.reason); nonEmpty(errors, "exception followUpReference", exception.followUpReference); if (exception.acceptedByOwner !== snapshot.ownerApproval.ownerReference) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "validation exception owner must match approval owner."); } }
  if (snapshot.ownerReference !== undefined) id(errors, "ownerReference", snapshot.ownerReference);
  if (snapshot.priorRecordId !== undefined) id(errors, "priorRecordId", snapshot.priorRecordId); if (snapshot.amendmentOfRecordId !== undefined) id(errors, "amendmentOfRecordId", snapshot.amendmentOfRecordId);
  strings(errors, "sourceAuditReferences", snapshot.sourceAuditReferences); for (const [key, value] of Object.entries(snapshot.policyVersions)) { id(errors, "policy key", key); id(errors, `policyVersions.${key}`, value); }
  id(errors, "correlationId", snapshot.correlationId); id(errors, "traceId", snapshot.traceId); metadata(errors, snapshot.metadata);
  if (!Object.values(PrivacyLevel).includes(snapshot.privacyLevel) || snapshot.privacyLevel === PrivacyLevel.Public) add(errors, DevelopmentValidationErrorCategory.InvalidPrivacy, "development validation evidence cannot be PUBLIC by default.");
  if (!Object.values(AIAuditRetentionClassification).includes(snapshot.retention)) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "retention is invalid.");
  validateGit(errors, snapshot, now);
  const requirements: Partial<Record<DevelopmentValidationRecordType, boolean>> = { [DevelopmentValidationRecordType.DefectFound]: snapshot.defects.length > 0, [DevelopmentValidationRecordType.RiskIdentified]: snapshot.risks.length > 0, [DevelopmentValidationRecordType.AssumptionRecorded]: snapshot.assumptions.length > 0, [DevelopmentValidationRecordType.FollowUpRequired]: snapshot.followUps.length > 0, [DevelopmentValidationRecordType.LessonLearned]: snapshot.lessons.length > 0, [DevelopmentValidationRecordType.EnvironmentWarning]: snapshot.environmentWarnings.length > 0, [DevelopmentValidationRecordType.OwnerReview]: snapshot.ownerReview !== undefined, [DevelopmentValidationRecordType.OwnerApproval]: snapshot.ownerApproval !== undefined, [DevelopmentValidationRecordType.OwnerRejection]: snapshot.ownerApproval !== undefined, [DevelopmentValidationRecordType.CommitCreated]: snapshot.gitReference?.commit !== undefined, [DevelopmentValidationRecordType.PushCompleted]: snapshot.gitReference?.push !== undefined, [DevelopmentValidationRecordType.HandoffCompleted]: snapshot.handoffReference !== undefined };
  if (snapshot.recordType in requirements && requirements[snapshot.recordType] !== true) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, `${snapshot.recordType} is missing required structured evidence.`);
  return { valid: errors.length === 0, errors };
}

function latestReview(history: ReadonlyArray<DevelopmentValidationRecord>) { return [...history].reverse().find((record) => record.ownerReview !== undefined)?.ownerReview; }
function latestCommit(history: ReadonlyArray<DevelopmentValidationRecord>) { return [...history].reverse().find((record) => record.gitReference?.commit !== undefined)?.gitReference?.commit; }

export function validateDevelopmentTransition(snapshot: DevelopmentValidationRecordSnapshot, history: ReadonlyArray<DevelopmentValidationRecord>): DevelopmentValidationResult {
  const errors: DevelopmentValidationError[] = [];
  if (history.length === 0) {
    if (snapshot.recordType !== DevelopmentValidationRecordType.TaskCreated || snapshot.status !== DevelopmentTaskStatus.Planned || snapshot.priorRecordId !== undefined) add(errors, DevelopmentValidationErrorCategory.InvalidLifecycle, "first task record must be TASK_CREATED at PLANNED without prior record.");
    return { valid: errors.length === 0, errors };
  }
  const latest = history.at(-1) as DevelopmentValidationRecord;
  if (latest.taskId !== snapshot.taskId || latest.taskTitle !== snapshot.taskTitle || latest.projectDay !== snapshot.projectDay) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "task identity cannot change across history.");
  if (snapshot.priorRecordId !== latest.recordId) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "record must reference the latest task record.");
  if ([DevelopmentTaskStatus.Closed, DevelopmentTaskStatus.Rejected, DevelopmentTaskStatus.Blocked, DevelopmentTaskStatus.Cancelled].includes(latest.status)) add(errors, DevelopmentValidationErrorCategory.InvalidLifecycle, "terminal task status cannot accept later records.");
  if (snapshot.status !== latest.status && !DEFAULT_DEVELOPMENT_TASK_LIFECYCLE.allowedTransitions[latest.status].includes(snapshot.status)) add(errors, DevelopmentValidationErrorCategory.InvalidLifecycle, "task lifecycle transition is invalid.");
  const privacyOrder = { [PrivacyLevel.Public]: 0, [PrivacyLevel.Internal]: 1, [PrivacyLevel.Sensitive]: 2, [PrivacyLevel.LocalOnly]: 3 }; if (privacyOrder[snapshot.privacyLevel] < privacyOrder[latest.privacyLevel]) add(errors, DevelopmentValidationErrorCategory.InvalidPrivacy, "task history cannot downgrade privacy.");
  const expectedStatus: Partial<Record<DevelopmentValidationRecordType, DevelopmentTaskStatus>> = { [DevelopmentValidationRecordType.InspectionCompleted]: DevelopmentTaskStatus.InProgress, [DevelopmentValidationRecordType.ImplementationCompleted]: DevelopmentTaskStatus.Implemented, [DevelopmentValidationRecordType.ValidationPassed]: DevelopmentTaskStatus.Validated, [DevelopmentValidationRecordType.OwnerReview]: DevelopmentTaskStatus.OwnerReviewed, [DevelopmentValidationRecordType.OwnerApproval]: DevelopmentTaskStatus.Approved, [DevelopmentValidationRecordType.OwnerRejection]: DevelopmentTaskStatus.Rejected, [DevelopmentValidationRecordType.CommitCreated]: DevelopmentTaskStatus.Committed, [DevelopmentValidationRecordType.PushCompleted]: DevelopmentTaskStatus.Pushed, [DevelopmentValidationRecordType.HandoffCompleted]: DevelopmentTaskStatus.HandedOff };
  const expected = expectedStatus[snapshot.recordType]; if (expected !== undefined && snapshot.status !== expected) add(errors, DevelopmentValidationErrorCategory.InvalidLifecycle, `${snapshot.recordType} must result in ${expected}.`);
  const implementationIndex = history.findIndex((record) => record.recordType === DevelopmentValidationRecordType.ImplementationCompleted);
  if ([DevelopmentValidationRecordType.ValidationRun, DevelopmentValidationRecordType.ValidationPassed, DevelopmentValidationRecordType.ValidationFailed].includes(snapshot.recordType) && implementationIndex < 0) add(errors, DevelopmentValidationErrorCategory.ValidationRequired, "validation cannot occur before implementation.");
  if (snapshot.recordType === DevelopmentValidationRecordType.ValidationRun && snapshot.testRuns.length === 0 && snapshot.validationChecks.length === 0) add(errors, DevelopmentValidationErrorCategory.ValidationRequired, "validation run requires structured test or check evidence.");
  if (snapshot.recordType === DevelopmentValidationRecordType.ValidationPassed && !snapshot.testRuns.some((run) => run.result === DevelopmentTestResult.Passed) && !snapshot.validationChecks.some((check) => check.result === DevelopmentValidationCheckResult.Passed)) add(errors, DevelopmentValidationErrorCategory.ValidationRequired, "validation pass requires passed evidence.");
  if (snapshot.recordType === DevelopmentValidationRecordType.ValidationPassed && (snapshot.testRuns.some((run) => run.result === DevelopmentTestResult.Failed) || snapshot.validationChecks.some((check) => check.result === DevelopmentValidationCheckResult.Failed))) add(errors, DevelopmentValidationErrorCategory.ValidationRequired, "validation pass record contains failed evidence.");
  if (snapshot.recordType === DevelopmentValidationRecordType.ValidationFailed && !snapshot.testRuns.some((run) => run.result === DevelopmentTestResult.Failed) && !snapshot.validationChecks.some((check) => check.result === DevelopmentValidationCheckResult.Failed)) add(errors, DevelopmentValidationErrorCategory.ValidationRequired, "validation failure record requires failed evidence.");
  if ([DevelopmentValidationRecordType.OwnerReview, DevelopmentValidationRecordType.OwnerApproval, DevelopmentValidationRecordType.OwnerRejection].includes(snapshot.recordType) && (snapshot.actorType !== DevelopmentActorType.Owner || snapshot.ownerReference === undefined)) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "owner decisions require OWNER actor and owner reference.");
  if (snapshot.recordType === DevelopmentValidationRecordType.OwnerReview && snapshot.ownerReview?.ownerReference !== snapshot.ownerReference) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "owner review identity must match the record owner.");
  if ([DevelopmentValidationRecordType.OwnerApproval, DevelopmentValidationRecordType.OwnerRejection].includes(snapshot.recordType)) {
    const review = latestReview(history); if (review === undefined) add(errors, DevelopmentValidationErrorCategory.ReviewRequired, "approval or rejection requires prior owner review."); else if (snapshot.ownerApproval?.reviewId !== review.reviewId || snapshot.ownerApproval.ownerReference !== snapshot.ownerReference) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "approval must reference the latest matching owner review.");
    const blockingIds = history.flatMap((record) => [...record.testRuns.filter((run) => run.result === DevelopmentTestResult.Failed && run.blocksApproval).map((run) => run.testRunId), ...record.validationChecks.filter((check) => check.result === DevelopmentValidationCheckResult.Failed && check.blocksApproval).map((check) => check.checkId), ...record.failures.filter((failure) => failure.blocking).map((failure) => failure.failureId)]);
    if (snapshot.recordType === DevelopmentValidationRecordType.OwnerApproval && blockingIds.length > 0) { const accepted = snapshot.ownerApproval?.acceptedValidationException?.validationIds ?? []; if (!blockingIds.every((value) => accepted.includes(value))) add(errors, DevelopmentValidationErrorCategory.ApprovalRequired, "blocking failures require explicit owner-accepted exception."); }
  }
  if (snapshot.recordType === DevelopmentValidationRecordType.OwnerApproval && ![DevelopmentOwnerDecision.Approved, DevelopmentOwnerDecision.ApprovedWithConditions].includes(snapshot.ownerApproval?.decision as DevelopmentOwnerDecision)) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "OWNER_APPROVAL requires an approved decision.");
  if (snapshot.recordType === DevelopmentValidationRecordType.OwnerRejection && snapshot.ownerApproval?.decision !== DevelopmentOwnerDecision.Rejected) add(errors, DevelopmentValidationErrorCategory.InvalidOwnerDecision, "OWNER_REJECTION requires a rejected decision.");
  if (snapshot.recordType === DevelopmentValidationRecordType.CommitCreated && latest.status !== DevelopmentTaskStatus.Approved) add(errors, DevelopmentValidationErrorCategory.ApprovalRequired, "commit cannot be recorded before approval.");
  if (snapshot.recordType === DevelopmentValidationRecordType.PushCompleted) { const commit = latestCommit(history); const push = snapshot.gitReference?.push; if (latest.status !== DevelopmentTaskStatus.Committed || commit === undefined) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "push cannot be recorded before commit."); else if (push?.localCommit !== commit.commitHash || snapshot.gitReference?.baseCommit !== commit.baseCommit || snapshot.gitReference.branch !== commit.branch) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "push evidence conflicts with recorded commit."); if (push?.status !== DevelopmentPushStatus.Succeeded || push.synchronized !== true) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "PUSH_COMPLETED requires successful synchronized push evidence."); }
  if (snapshot.recordType === DevelopmentValidationRecordType.HandoffCompleted && latest.status !== DevelopmentTaskStatus.Pushed && !(snapshot.nonCodeTask && latest.status === DevelopmentTaskStatus.Approved)) add(errors, DevelopmentValidationErrorCategory.InvalidLifecycle, "handoff requires PUSHED or an explicit approved non-code task.");
  if (snapshot.amendmentOfRecordId !== undefined && !history.some((record) => record.recordId === snapshot.amendmentOfRecordId)) add(errors, DevelopmentValidationErrorCategory.InvalidReference, "amendment target does not exist in task history.");
  const priorGit = [...history].reverse().find((record) => record.gitReference !== undefined)?.gitReference; if (priorGit !== undefined && snapshot.gitReference !== undefined && (snapshot.gitReference.branch !== priorGit.branch || snapshot.gitReference.baseCommit !== priorGit.baseCommit)) add(errors, DevelopmentValidationErrorCategory.InvalidGitReference, "Git branch/base conflicts with earlier task evidence.");
  return { valid: errors.length === 0, errors };
}

export function validateDevelopmentRecord(record: DevelopmentValidationRecord, now: string): DevelopmentValidationResult {
  const { sequence: _sequence, payloadFingerprint: _fingerprint, ...snapshot } = record;
  const base = validateDevelopmentSnapshot(snapshot, now); const errors = [...base.errors];
  if (!Number.isSafeInteger(record.sequence) || record.sequence <= 0) add(errors, DevelopmentValidationErrorCategory.RepositoryCorrupt, "record sequence must be a positive safe integer.");
  if (record.payloadFingerprint !== developmentFingerprint({ ...record, payloadFingerprint: undefined })) add(errors, DevelopmentValidationErrorCategory.RepositoryCorrupt, "record fingerprint is invalid.");
  return { valid: errors.length === 0, errors };
}

export function validateDevelopmentQuery(query: DevelopmentQuery): DevelopmentValidationResult {
  const errors: DevelopmentValidationError[] = []; const offset = query.offset ?? 0; const limit = query.limit ?? Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit <= 0) add(errors, DevelopmentValidationErrorCategory.InvalidRecord, "query pagination is invalid.");
  const from = query.filter?.fromTimestamp; const to = query.filter?.toTimestamp; if (from !== undefined && !Number.isFinite(Date.parse(from))) add(errors, DevelopmentValidationErrorCategory.InvalidTimestamp, "query from timestamp is invalid."); if (to !== undefined && !Number.isFinite(Date.parse(to))) add(errors, DevelopmentValidationErrorCategory.InvalidTimestamp, "query to timestamp is invalid."); if (from !== undefined && to !== undefined && Date.parse(from) > Date.parse(to)) add(errors, DevelopmentValidationErrorCategory.InvalidTimestamp, "query timestamp range is invalid.");
  return { valid: errors.length === 0, errors };
}

export function throwIfInvalidDevelopment(validation: DevelopmentValidationResult): void {
  if (!validation.valid) { const first = validation.errors[0]; throw new Error(`${first?.category ?? DevelopmentValidationErrorCategory.InvalidRecord}: ${first?.message ?? "development validation failed."}`); }
}
