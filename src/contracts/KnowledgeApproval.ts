import type {
  AIAuditActor,
  AIAuditMetadata,
  AIAuditRecordInput,
  AIAuditRetentionClassification,
} from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";
import type { EvidenceAssessmentStatus } from "./EvidenceEngine";
import type { StrategyReviewStatus } from "./StrategyReview";

export const KNOWLEDGE_APPROVAL_SCHEMA_VERSION = "1.0" as const;

export enum CandidateKnowledgeType {
  Observation = "OBSERVATION",
  PredictionLesson = "PREDICTION_LESSON",
  ExecutionLesson = "EXECUTION_LESSON",
  RiskLesson = "RISK_LESSON",
  ProfitabilityObservation = "PROFITABILITY_OBSERVATION",
  DataQualityIssue = "DATA_QUALITY_ISSUE",
  ProcessImprovement = "PROCESS_IMPROVEMENT",
}

export enum CandidateKnowledgeStatus {
  PendingReview = "PENDING_REVIEW",
  NeedsMoreEvidence = "NEEDS_MORE_EVIDENCE",
  Approved = "APPROVED",
  Rejected = "REJECTED",
  Superseded = "SUPERSEDED",
}

export enum ApprovedKnowledgeStatus {
  Active = "ACTIVE",
  Superseded = "SUPERSEDED",
  Deprecated = "DEPRECATED",
  Revoked = "REVOKED",
}

export enum KnowledgeActorType {
  Owner = "OWNER",
  HumanContributor = "HUMAN_CONTRIBUTOR",
  AI = "AI",
  AlphaSubsystem = "ALPHA_SUBSYSTEM",
}

export enum KnowledgeInterpretationAuthorType {
  Owner = "OWNER",
  HumanContributor = "HUMAN_CONTRIBUTOR",
  AI = "AI",
  AlphaSubsystem = "ALPHA_SUBSYSTEM",
}

export enum KnowledgeScopeType {
  Global = "GLOBAL",
  Strategy = "STRATEGY",
  Market = "MARKET",
  Instrument = "INSTRUMENT",
  Process = "PROCESS",
}

export enum KnowledgeSourceType {
  StrategyReview = "STRATEGY_REVIEW",
  EvidenceAssessment = "EVIDENCE_ASSESSMENT",
  StrategyVersion = "STRATEGY_VERSION",
  RiskRecord = "RISK_RECORD",
  AuditRecord = "AUDIT_RECORD",
}

export enum KnowledgeSourceAvailability {
  Available = "AVAILABLE",
  Unavailable = "UNAVAILABLE",
}

export enum KnowledgeEligibilityStatus {
  EligibleForOwnerReview = "ELIGIBLE_FOR_OWNER_REVIEW",
  Blocked = "BLOCKED",
}

export enum KnowledgeEligibilityCriterion {
  CandidateLifecycle = "CANDIDATE_LIFECYCLE",
  CandidateBlockers = "CANDIDATE_BLOCKERS",
  ReviewPresent = "REVIEW_PRESENT",
  ReviewCompletion = "REVIEW_COMPLETION",
  EvidenceSufficiency = "EVIDENCE_SUFFICIENCY",
  SourceAvailability = "SOURCE_AVAILABILITY",
  Provenance = "PROVENANCE",
  ReviewCount = "REVIEW_COUNT",
  OutcomeCount = "OUTCOME_COUNT",
  SampleAdequacy = "SAMPLE_ADEQUACY",
  VersionCompatibility = "VERSION_COMPATIBILITY",
  ConflictFree = "CONFLICT_FREE",
  Freshness = "FRESHNESS",
  OwnerAuthorization = "OWNER_AUTHORIZATION",
  SafetyException = "SAFETY_EXCEPTION",
}

export enum KnowledgeCriterionStatus {
  Passed = "PASSED",
  Failed = "FAILED",
  NotApplicable = "NOT_APPLICABLE",
}

export enum KnowledgeApprovalDecisionType {
  Approve = "APPROVE",
  Reject = "REJECT",
  ReturnForEvidence = "RETURN_FOR_EVIDENCE",
}

export enum KnowledgeLifecycleRecordType {
  Candidate = "CANDIDATE",
  ApprovedKnowledge = "APPROVED_KNOWLEDGE",
}

export enum KnowledgeAuditOperationType {
  CandidateSubmitted = "CANDIDATE_SUBMITTED",
  EligibilityEvaluated = "ELIGIBILITY_EVALUATED",
  EvidenceRequested = "EVIDENCE_REQUESTED",
  CandidateResubmitted = "CANDIDATE_RESUBMITTED",
  CandidateApproved = "CANDIDATE_APPROVED",
  CandidateRejected = "CANDIDATE_REJECTED",
  CandidateSuperseded = "CANDIDATE_SUPERSEDED",
  KnowledgeActivated = "KNOWLEDGE_ACTIVATED",
  KnowledgeSuperseded = "KNOWLEDGE_SUPERSEDED",
  KnowledgeDeprecated = "KNOWLEDGE_DEPRECATED",
  KnowledgeRevoked = "KNOWLEDGE_REVOKED",
  ValidationRejected = "VALIDATION_REJECTED",
}

export enum KnowledgeAppendStatus {
  Appended = "APPENDED",
  Replayed = "REPLAYED",
}

export enum KnowledgeErrorCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidPolicy = "INVALID_POLICY",
  InvalidLifecycle = "INVALID_LIFECYCLE",
  InvalidAuthority = "INVALID_AUTHORITY",
  CandidateNotFound = "CANDIDATE_NOT_FOUND",
  KnowledgeNotFound = "KNOWLEDGE_NOT_FOUND",
  DuplicateId = "DUPLICATE_ID",
  DuplicateClaim = "DUPLICATE_CLAIM",
  DuplicateCommand = "DUPLICATE_COMMAND",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  VersionConflict = "VERSION_CONFLICT",
  ApprovalBlocked = "APPROVAL_BLOCKED",
  ReplacementRequired = "REPLACEMENT_REQUIRED",
  InvalidReference = "INVALID_REFERENCE",
  RepositoryCorrupt = "REPOSITORY_CORRUPT",
}

export enum KnowledgeBlockerCode {
  CandidateNotPending = "CANDIDATE_NOT_PENDING",
  CandidateDeclaredBlocker = "CANDIDATE_DECLARED_BLOCKER",
  StrategyReviewMissing = "STRATEGY_REVIEW_MISSING",
  StrategyReviewIncomplete = "STRATEGY_REVIEW_INCOMPLETE",
  EvidenceNotSufficient = "EVIDENCE_NOT_SUFFICIENT",
  SourceUnavailable = "SOURCE_UNAVAILABLE",
  ProvenanceMissing = "PROVENANCE_MISSING",
  ReviewCountInsufficient = "REVIEW_COUNT_INSUFFICIENT",
  OutcomeCountInsufficient = "OUTCOME_COUNT_INSUFFICIENT",
  SampleInadequate = "SAMPLE_INADEQUATE",
  VersionIncompatible = "VERSION_INCOMPATIBLE",
  MaterialConflict = "MATERIAL_CONFLICT",
  CandidateStale = "CANDIDATE_STALE",
  OwnerAuthorityMissing = "OWNER_AUTHORITY_MISSING",
  PolicyRuleMissing = "POLICY_RULE_MISSING",
  ActiveContradiction = "ACTIVE_CONTRADICTION",
}

export interface KnowledgeActor {
  readonly actorType: KnowledgeActorType;
  readonly actorId: string;
  readonly authorizationReference?: string;
}

export interface KnowledgeScope {
  readonly scopeType: KnowledgeScopeType;
  readonly strategyFamily?: string;
  readonly markets: ReadonlyArray<string>;
  readonly instruments: ReadonlyArray<string>;
  readonly strategyVersionIds: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<string>;
}

export interface KnowledgeSourceReference {
  readonly referenceId: string;
  readonly sourceType: KnowledgeSourceType;
  readonly sourceId: string;
  readonly version: string;
  readonly status: string;
  readonly availability: KnowledgeSourceAvailability;
  readonly provenanceReferenceIds: ReadonlyArray<string>;
}

export interface KnowledgeStrategyReviewSource {
  readonly referenceId: string;
  readonly reviewId: string;
  readonly reviewSchemaVersion: string;
  readonly reviewStatus: StrategyReviewStatus;
  readonly evidenceAssessmentId: string;
  readonly evidenceAssessmentVersion: string;
  readonly evidenceStatus: EvidenceAssessmentStatus;
  readonly strategyVersionId: string;
  readonly outcomeId: string;
  readonly availability: KnowledgeSourceAvailability;
  readonly provenanceReferenceIds: ReadonlyArray<string>;
}

export interface KnowledgeFact {
  readonly factId: string;
  readonly statement: string;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly verified: boolean;
  readonly severeSafetyViolation: boolean;
  readonly hardPolicyViolation: boolean;
}

export interface KnowledgeInterpretation {
  readonly interpretationId: string;
  readonly statement: string;
  readonly authorType: KnowledgeInterpretationAuthorType;
  readonly authorId: string;
  readonly aiAssisted: boolean;
  readonly supportingFactIds: ReadonlyArray<string>;
  readonly limitations: ReadonlyArray<string>;
}

export interface KnowledgeConflict {
  readonly conflictId: string;
  readonly statement: string;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly material: boolean;
  readonly resolved: boolean;
  readonly resolutionReferenceId?: string;
}

export interface KnowledgeTraceMetadata {
  readonly correlationId: string;
  readonly traceId: string;
  readonly auditReferenceIds: ReadonlyArray<string>;
}

export interface CandidateKnowledge {
  readonly schemaVersion: typeof KNOWLEDGE_APPROVAL_SCHEMA_VERSION;
  readonly candidateId: string;
  readonly revision: number;
  readonly candidateType: CandidateKnowledgeType;
  readonly claimKey: string;
  readonly statement: string;
  readonly scope: KnowledgeScope;
  readonly strategyReviews: ReadonlyArray<KnowledgeStrategyReviewSource>;
  readonly sourceReferences: ReadonlyArray<KnowledgeSourceReference>;
  readonly sourceEvidenceAssessmentIds: ReadonlyArray<string>;
  readonly sourceStrategyVersionIds: ReadonlyArray<string>;
  readonly supportingFacts: ReadonlyArray<KnowledgeFact>;
  readonly interpretations: ReadonlyArray<KnowledgeInterpretation>;
  readonly conflicts: ReadonlyArray<KnowledgeConflict>;
  readonly completedReviewCount: number;
  readonly distinctOutcomeCount: number;
  readonly createdAt: string;
  readonly createdBy: KnowledgeActor;
  readonly aiAssisted: boolean;
  readonly proposedSupersedesKnowledgeId?: string;
  readonly blockers: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly trace: KnowledgeTraceMetadata;
  readonly status: CandidateKnowledgeStatus.PendingReview;
}

export interface KnowledgeTypeApprovalRule {
  readonly candidateType: CandidateKnowledgeType;
  readonly minimumCompletedReviewCount: number;
  readonly minimumDistinctOutcomeCount: number;
  readonly requireProvenance: boolean;
  readonly blockMaterialConflicts: boolean;
  readonly compatibleStrategyVersionIds: ReadonlyArray<string>;
  readonly maxCandidateAgeSeconds?: number;
  readonly allowSingleEventSafetyException: boolean;
}

export interface KnowledgeApprovalPolicy {
  readonly schemaVersion: typeof KNOWLEDGE_APPROVAL_SCHEMA_VERSION;
  readonly policyId: string;
  readonly version: string;
  readonly authorizationPolicyReference: string;
  readonly rules: ReadonlyArray<KnowledgeTypeApprovalRule>;
}

export interface KnowledgeEligibilityCheck {
  readonly criterion: KnowledgeEligibilityCriterion;
  readonly status: KnowledgeCriterionStatus;
  readonly actual: string | number | boolean;
  readonly required: string | number | boolean;
  readonly sourceReferenceIds: ReadonlyArray<string>;
  readonly reasonCode: string;
}

export interface KnowledgeIssue<TCode extends string> {
  readonly code: TCode;
  readonly message: string;
  readonly sourceReferenceIds: ReadonlyArray<string>;
}

export interface KnowledgeAuditEvent {
  readonly auditId: string;
  readonly operationType: KnowledgeAuditOperationType;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion: string;
  readonly timestamp: string;
  readonly status: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly actor: KnowledgeActor;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly trace: KnowledgeTraceMetadata;
  readonly metadata: AIAuditMetadata;
}

export interface KnowledgeEligibilityRequest {
  readonly eligibilityId: string;
  readonly candidateId: string;
  readonly evaluatedAt: string;
  readonly policy: KnowledgeApprovalPolicy;
  readonly approvalActor: KnowledgeActor;
}

export interface KnowledgeCandidateSubmissionCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly candidate: CandidateKnowledge;
  readonly acceptedAt: string;
}

export interface KnowledgeEligibilityResult {
  readonly schemaVersion: typeof KNOWLEDGE_APPROVAL_SCHEMA_VERSION;
  readonly eligibilityId: string;
  readonly candidateId: string;
  readonly candidateRevision: number;
  readonly evaluatedAt: string;
  readonly status: KnowledgeEligibilityStatus;
  readonly policy: KnowledgeApprovalPolicy;
  readonly checks: ReadonlyArray<KnowledgeEligibilityCheck>;
  readonly blockers: ReadonlyArray<KnowledgeIssue<KnowledgeBlockerCode>>;
  readonly warnings: ReadonlyArray<string>;
  readonly safetyExceptionApplied: boolean;
  readonly sourceVersions: Readonly<Record<string, string>>;
  readonly approvalGranted: false;
  readonly deterministic: true;
  readonly auditEvent: KnowledgeAuditEvent;
}

export interface KnowledgeApprovalCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly decisionId: string;
  readonly candidateId: string;
  readonly expectedCandidateVersion: number;
  readonly decision: KnowledgeApprovalDecisionType;
  readonly actor: KnowledgeActor;
  readonly policy: KnowledgeApprovalPolicy;
  readonly decidedAt: string;
  readonly reason: string;
  readonly conditions: ReadonlyArray<string>;
  readonly acknowledgedWarnings: ReadonlyArray<string>;
  readonly knowledgeId?: string;
  readonly effectiveFrom?: string;
  readonly applicabilityConstraints: ReadonlyArray<string>;
  readonly trace: KnowledgeTraceMetadata;
}

export interface KnowledgeOwnerDecisionRecord {
  readonly schemaVersion: typeof KNOWLEDGE_APPROVAL_SCHEMA_VERSION;
  readonly decisionId: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly candidateId: string;
  readonly candidateRevision: number;
  readonly decision: KnowledgeApprovalDecisionType;
  readonly actor: KnowledgeActor;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly eligibility: KnowledgeEligibilityResult;
  readonly blockers: ReadonlyArray<KnowledgeIssue<KnowledgeBlockerCode>>;
  readonly warnings: ReadonlyArray<string>;
  readonly acknowledgedWarnings: ReadonlyArray<string>;
  readonly reason: string;
  readonly conditions: ReadonlyArray<string>;
  readonly decidedAt: string;
  readonly sourceVersions: Readonly<Record<string, string>>;
  readonly trace: KnowledgeTraceMetadata;
  readonly auditEvent: KnowledgeAuditEvent;
}

export interface ApprovedKnowledge {
  readonly schemaVersion: typeof KNOWLEDGE_APPROVAL_SCHEMA_VERSION;
  readonly knowledgeId: string;
  readonly knowledgeVersion: number;
  readonly knowledgeType: CandidateKnowledgeType;
  readonly claimKey: string;
  readonly statement: string;
  readonly scope: KnowledgeScope;
  readonly supportingCandidateIds: ReadonlyArray<string>;
  readonly sourceStrategyReviewIds: ReadonlyArray<string>;
  readonly sourceEvidenceAssessmentIds: ReadonlyArray<string>;
  readonly sourceStrategyVersionIds: ReadonlyArray<string>;
  readonly sourceReferences: ReadonlyArray<KnowledgeSourceReference>;
  readonly supportingFactIds: ReadonlyArray<string>;
  readonly approvalDecisionId: string;
  readonly approvalPolicyId: string;
  readonly approvalPolicyVersion: string;
  readonly approvedAt: string;
  readonly approvedBy: KnowledgeActor;
  readonly effectiveFrom: string;
  readonly applicabilityConstraints: ReadonlyArray<string>;
  readonly supersedesKnowledgeId?: string;
  readonly warnings: ReadonlyArray<string>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly trace: KnowledgeTraceMetadata;
  readonly status: ApprovedKnowledgeStatus.Active;
}

export interface KnowledgeLifecycleEvent {
  readonly eventId: string;
  readonly recordType: KnowledgeLifecycleRecordType;
  readonly recordId: string;
  readonly aggregateVersion: number;
  readonly fromStatus?: CandidateKnowledgeStatus | ApprovedKnowledgeStatus;
  readonly toStatus: CandidateKnowledgeStatus | ApprovedKnowledgeStatus;
  readonly occurredAt: string;
  readonly actor: KnowledgeActor;
  readonly reason: string;
  readonly referenceId: string;
  readonly replacementRecordId?: string;
  readonly auditEvent: KnowledgeAuditEvent;
}

export type CandidateKnowledgeState = Omit<CandidateKnowledge, "status"> & {
  readonly status: CandidateKnowledgeStatus;
  readonly aggregateVersion: number;
  readonly lifecycle: ReadonlyArray<KnowledgeLifecycleEvent>;
};

export type ApprovedKnowledgeState = Omit<ApprovedKnowledge, "status"> & {
  readonly status: ApprovedKnowledgeStatus;
  readonly aggregateVersion: number;
  readonly lifecycle: ReadonlyArray<KnowledgeLifecycleEvent>;
};

export interface KnowledgeApprovalResult {
  readonly decision: KnowledgeOwnerDecisionRecord;
  readonly candidate: CandidateKnowledgeState;
  readonly approvedKnowledge?: ApprovedKnowledgeState;
}

export interface KnowledgeCandidateResubmissionCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly expectedCandidateVersion: number;
  readonly revisedCandidate: CandidateKnowledge;
  readonly actor: KnowledgeActor;
  readonly occurredAt: string;
  readonly reason: string;
}

export interface KnowledgeCandidateSupersessionCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly eventId: string;
  readonly candidateId: string;
  readonly replacementCandidateId: string;
  readonly expectedCandidateVersion: number;
  readonly actor: KnowledgeActor;
  readonly occurredAt: string;
  readonly reason: string;
}

export interface ApprovedKnowledgeLifecycleCommand {
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly eventId: string;
  readonly knowledgeId: string;
  readonly expectedKnowledgeVersion: number;
  readonly toStatus: ApprovedKnowledgeStatus.Superseded | ApprovedKnowledgeStatus.Deprecated | ApprovedKnowledgeStatus.Revoked;
  readonly actor: KnowledgeActor;
  readonly occurredAt: string;
  readonly reason: string;
  readonly replacementKnowledgeId?: string;
}

export interface KnowledgeAppendResult<T> {
  readonly status: KnowledgeAppendStatus;
  readonly record: T;
  readonly repositorySequences: ReadonlyArray<number>;
}

export interface KnowledgeReadModel {
  getCandidate(candidateId: string): CandidateKnowledgeState | undefined;
  getApprovedKnowledge(knowledgeId: string): ApprovedKnowledgeState | undefined;
  listCandidates(): ReadonlyArray<CandidateKnowledgeState>;
  listApprovedKnowledge(): ReadonlyArray<ApprovedKnowledgeState>;
  listCurrentApprovedKnowledge(): ReadonlyArray<ApprovedKnowledgeState>;
  getCandidateHistory(candidateId: string): ReadonlyArray<KnowledgeLifecycleEvent>;
  getApprovedKnowledgeHistory(knowledgeId: string): ReadonlyArray<KnowledgeLifecycleEvent>;
}

export interface KnowledgeAuditTranslationContext {
  readonly idempotencyKey: string;
  readonly actor: AIAuditActor;
  readonly parentAuditRecordIds: ReadonlyArray<string>;
  readonly relatedAuditRecordIds: ReadonlyArray<string>;
}

export type KnowledgeAuditTranslation = (
  source: Readonly<KnowledgeAuditEvent>,
  context: Readonly<KnowledgeAuditTranslationContext>,
) => AIAuditRecordInput;
