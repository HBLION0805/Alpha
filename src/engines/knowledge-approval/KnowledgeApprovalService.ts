import {
  AIAuditRetentionClassification,
  ApprovedKnowledgeStatus,
  CandidateKnowledgeStatus,
  CandidateKnowledgeType,
  EvidenceAssessmentStatus,
  KNOWLEDGE_APPROVAL_SCHEMA_VERSION,
  KnowledgeActorType,
  KnowledgeApprovalDecisionType,
  KnowledgeAuditOperationType,
  KnowledgeBlockerCode,
  KnowledgeCriterionStatus,
  KnowledgeEligibilityCriterion,
  KnowledgeEligibilityStatus,
  KnowledgeErrorCode,
  KnowledgeInterpretationAuthorType,
  KnowledgeLifecycleRecordType,
  KnowledgeScopeType,
  KnowledgeSourceAvailability,
  KnowledgeSourceType,
  PrivacyLevel,
  StrategyReviewStatus,
  type ApprovedKnowledge,
  type ApprovedKnowledgeLifecycleCommand,
  type ApprovedKnowledgeState,
  type CandidateKnowledge,
  type CandidateKnowledgeState,
  type KnowledgeActor,
  type KnowledgeApprovalCommand,
  type KnowledgeApprovalPolicy,
  type KnowledgeApprovalResult,
  type KnowledgeAuditEvent,
  type KnowledgeCandidateResubmissionCommand,
  type KnowledgeCandidateSubmissionCommand,
  type KnowledgeCandidateSupersessionCommand,
  type KnowledgeEligibilityCheck,
  type KnowledgeEligibilityRequest,
  type KnowledgeEligibilityResult,
  type KnowledgeIssue,
  type KnowledgeLifecycleEvent,
  type KnowledgeOwnerDecisionRecord,
  type KnowledgeReadModel,
  type KnowledgeTypeApprovalRule,
} from "../../contracts";
import { knowledgeClaimIdentity } from "../../repositories/InMemoryKnowledgeApprovalRepository";
import type { KnowledgeApprovalRepository } from "../../repositories/KnowledgeApprovalRepository";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_TEXT_LENGTH = 2_000;

const candidateTypes = new Set(Object.values(CandidateKnowledgeType));
const actorTypes = new Set(Object.values(KnowledgeActorType));
const scopeTypes = new Set(Object.values(KnowledgeScopeType));
const sourceTypes = new Set(Object.values(KnowledgeSourceType));
const sourceAvailability = new Set(Object.values(KnowledgeSourceAvailability));
const reviewStatuses = new Set(Object.values(StrategyReviewStatus));
const evidenceStatuses = new Set(Object.values(EvidenceAssessmentStatus));
const privacyLevels = new Set(Object.values(PrivacyLevel));
const retentionValues = new Set(Object.values(AIAuditRetentionClassification));
const decisionTypes = new Set(Object.values(KnowledgeApprovalDecisionType));
const approvedStatuses = new Set(Object.values(ApprovedKnowledgeStatus));

function fail(code: KnowledgeErrorCode, message: string): never {
  throw new Error(`${code}: ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!isObject(value)) fail(KnowledgeErrorCode.InvalidRecord, `${label} must be an object.`);
  return value;
}

function requireString(value: unknown, label: string, identifier = false): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > MAX_TEXT_LENGTH) fail(KnowledgeErrorCode.InvalidRecord, `${label} is invalid.`);
  if (identifier && !IDENTIFIER.test(value)) fail(KnowledgeErrorCode.InvalidIdentifier, `${label} is invalid.`);
  return value;
}

function optionalString(value: unknown, label: string, identifier = false): string | undefined {
  return value === undefined ? undefined : requireString(value, label, identifier);
}

function requireTimestamp(value: unknown, label: string): string {
  const text = requireString(value, label);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== text) fail(KnowledgeErrorCode.InvalidTimestamp, `${label} must be canonical ISO-8601.`);
  return text;
}

function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(KnowledgeErrorCode.InvalidRecord, `${label} must be boolean.`);
  return value;
}

function requireInteger(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) fail(KnowledgeErrorCode.InvalidRecord, `${label} must be a safe integer >= ${String(minimum)}.`);
  return value as number;
}

function requireStringArray(value: unknown, label: string, identifier = false): ReadonlyArray<string> {
  if (!Array.isArray(value)) fail(KnowledgeErrorCode.InvalidRecord, `${label} must be an array.`);
  const result = value.map((entry, index) => requireString(entry, `${label}[${String(index)}]`, identifier));
  if (new Set(result).size !== result.length) fail(KnowledgeErrorCode.DuplicateId, `${label} contains duplicates.`);
  return result;
}

function requireEnum<T extends string>(value: unknown, values: ReadonlySet<string>, label: string): T {
  if (typeof value !== "string" || !values.has(value)) fail(KnowledgeErrorCode.InvalidRecord, `${label} is unsupported.`);
  return value as T;
}

function setEqual(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sortedUnique(values: ReadonlyArray<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

const frozenClone = <T>(value: T): T => deepFreeze(structuredClone(value));

function validateActor(value: unknown, label: string): KnowledgeActor {
  const actor = requireObject(value, label);
  const result: KnowledgeActor = {
    actorType: requireEnum(actor.actorType, actorTypes, `${label}.actorType`),
    actorId: requireString(actor.actorId, `${label}.actorId`, true),
    ...(actor.authorizationReference === undefined ? {} : { authorizationReference: requireString(actor.authorizationReference, `${label}.authorizationReference`, true) }),
  };
  return result;
}

function validateTrace(value: unknown, label: string): CandidateKnowledge["trace"] {
  const trace = requireObject(value, label);
  return {
    correlationId: requireString(trace.correlationId, `${label}.correlationId`, true),
    traceId: requireString(trace.traceId, `${label}.traceId`, true),
    auditReferenceIds: requireStringArray(trace.auditReferenceIds, `${label}.auditReferenceIds`, true),
  };
}

function validateCandidate(value: unknown): CandidateKnowledge {
  const candidate = requireObject(value, "candidate");
  if (candidate.schemaVersion !== KNOWLEDGE_APPROVAL_SCHEMA_VERSION) fail(KnowledgeErrorCode.InvalidRecord, "candidate schemaVersion is unsupported.");
  if (candidate.status !== CandidateKnowledgeStatus.PendingReview) fail(KnowledgeErrorCode.InvalidLifecycle, "candidate snapshot must enter as PENDING_REVIEW.");
  const scopeValue = requireObject(candidate.scope, "candidate.scope");
  const scope = {
    scopeType: requireEnum<KnowledgeScopeType>(scopeValue.scopeType, scopeTypes, "candidate.scope.scopeType"),
    ...(scopeValue.strategyFamily === undefined ? {} : { strategyFamily: requireString(scopeValue.strategyFamily, "candidate.scope.strategyFamily", true) }),
    markets: requireStringArray(scopeValue.markets, "candidate.scope.markets", true),
    instruments: requireStringArray(scopeValue.instruments, "candidate.scope.instruments", true),
    strategyVersionIds: requireStringArray(scopeValue.strategyVersionIds, "candidate.scope.strategyVersionIds", true),
    tags: requireStringArray(scopeValue.tags, "candidate.scope.tags", true),
  };
  const sourceReferencesRaw = candidate.sourceReferences;
  if (!Array.isArray(sourceReferencesRaw)) fail(KnowledgeErrorCode.InvalidReference, "candidate.sourceReferences must be an array.");
  const sourceReferences = sourceReferencesRaw.map((entry, index) => {
    const source = requireObject(entry, `candidate.sourceReferences[${String(index)}]`);
    return {
      referenceId: requireString(source.referenceId, "source.referenceId", true),
      sourceType: requireEnum<KnowledgeSourceType>(source.sourceType, sourceTypes, "source.sourceType"),
      sourceId: requireString(source.sourceId, "source.sourceId", true),
      version: requireString(source.version, "source.version"),
      status: requireString(source.status, "source.status"),
      availability: requireEnum<KnowledgeSourceAvailability>(source.availability, sourceAvailability, "source.availability"),
      provenanceReferenceIds: requireStringArray(source.provenanceReferenceIds, "source.provenanceReferenceIds", true),
    };
  });
  if (new Set(sourceReferences.map((source) => source.referenceId)).size !== sourceReferences.length) fail(KnowledgeErrorCode.DuplicateId, "source reference IDs must be unique.");
  const reviewsRaw = candidate.strategyReviews;
  if (!Array.isArray(reviewsRaw)) fail(KnowledgeErrorCode.InvalidReference, "candidate.strategyReviews must be an array.");
  const strategyReviews = reviewsRaw.map((entry, index) => {
    const review = requireObject(entry, `candidate.strategyReviews[${String(index)}]`);
    return {
      referenceId: requireString(review.referenceId, "review.referenceId", true),
      reviewId: requireString(review.reviewId, "review.reviewId", true),
      reviewSchemaVersion: requireString(review.reviewSchemaVersion, "review.reviewSchemaVersion"),
      reviewStatus: requireEnum<StrategyReviewStatus>(review.reviewStatus, reviewStatuses, "review.reviewStatus"),
      evidenceAssessmentId: requireString(review.evidenceAssessmentId, "review.evidenceAssessmentId", true),
      evidenceAssessmentVersion: requireString(review.evidenceAssessmentVersion, "review.evidenceAssessmentVersion"),
      evidenceStatus: requireEnum<EvidenceAssessmentStatus>(review.evidenceStatus, evidenceStatuses, "review.evidenceStatus"),
      strategyVersionId: requireString(review.strategyVersionId, "review.strategyVersionId", true),
      outcomeId: requireString(review.outcomeId, "review.outcomeId", true),
      availability: requireEnum<KnowledgeSourceAvailability>(review.availability, sourceAvailability, "review.availability"),
      provenanceReferenceIds: requireStringArray(review.provenanceReferenceIds, "review.provenanceReferenceIds", true),
    };
  });
  if (new Set(strategyReviews.map((review) => review.reviewId)).size !== strategyReviews.length) fail(KnowledgeErrorCode.DuplicateId, "strategy review IDs must be unique.");
  const factsRaw = candidate.supportingFacts;
  if (!Array.isArray(factsRaw)) fail(KnowledgeErrorCode.InvalidRecord, "candidate.supportingFacts must be an array.");
  const validSourceIds = new Set([...sourceReferences.map((source) => source.referenceId), ...strategyReviews.map((review) => review.referenceId)]);
  const supportingFacts = factsRaw.map((entry, index) => {
    const fact = requireObject(entry, `candidate.supportingFacts[${String(index)}]`);
    const verified = requireBoolean(fact.verified, "fact.verified");
    const severeSafetyViolation = requireBoolean(fact.severeSafetyViolation, "fact.severeSafetyViolation");
    const hardPolicyViolation = requireBoolean(fact.hardPolicyViolation, "fact.hardPolicyViolation");
    if (!verified && (severeSafetyViolation || hardPolicyViolation)) fail(KnowledgeErrorCode.InvalidRecord, "unverified fact cannot claim a safety or hard-policy violation.");
    const sourceReferenceIds = requireStringArray(fact.sourceReferenceIds, "fact.sourceReferenceIds", true);
    if (sourceReferenceIds.some((id) => !validSourceIds.has(id))) fail(KnowledgeErrorCode.InvalidReference, "fact references an undeclared source.");
    return { factId: requireString(fact.factId, "fact.factId", true), statement: requireString(fact.statement, "fact.statement"), sourceReferenceIds, verified, severeSafetyViolation, hardPolicyViolation };
  });
  if (new Set(supportingFacts.map((fact) => fact.factId)).size !== supportingFacts.length) fail(KnowledgeErrorCode.DuplicateId, "fact IDs must be unique.");
  const factIds = new Set(supportingFacts.map((fact) => fact.factId));
  const interpretationsRaw = candidate.interpretations;
  if (!Array.isArray(interpretationsRaw)) fail(KnowledgeErrorCode.InvalidRecord, "candidate.interpretations must be an array.");
  const interpretations = interpretationsRaw.map((entry, index) => {
    const interpretation = requireObject(entry, `candidate.interpretations[${String(index)}]`);
    const authorType = requireEnum<KnowledgeInterpretationAuthorType>(interpretation.authorType, new Set(Object.values(KnowledgeInterpretationAuthorType)), "interpretation.authorType");
    const aiAssisted = requireBoolean(interpretation.aiAssisted, "interpretation.aiAssisted");
    if (authorType === KnowledgeInterpretationAuthorType.AI && !aiAssisted) fail(KnowledgeErrorCode.InvalidRecord, "AI interpretation must disclose AI assistance.");
    const supportingFactIds = requireStringArray(interpretation.supportingFactIds, "interpretation.supportingFactIds", true);
    if (supportingFactIds.some((id) => !factIds.has(id))) fail(KnowledgeErrorCode.InvalidReference, "interpretation references an undeclared fact.");
    return { interpretationId: requireString(interpretation.interpretationId, "interpretation.interpretationId", true), statement: requireString(interpretation.statement, "interpretation.statement"), authorType, authorId: requireString(interpretation.authorId, "interpretation.authorId", true), aiAssisted, supportingFactIds, limitations: requireStringArray(interpretation.limitations, "interpretation.limitations") };
  });
  if (new Set(interpretations.map((entry) => entry.interpretationId)).size !== interpretations.length) fail(KnowledgeErrorCode.DuplicateId, "interpretation IDs must be unique.");
  const conflictsRaw = candidate.conflicts;
  if (!Array.isArray(conflictsRaw)) fail(KnowledgeErrorCode.InvalidRecord, "candidate.conflicts must be an array.");
  const conflicts = conflictsRaw.map((entry, index) => {
    const conflict = requireObject(entry, `candidate.conflicts[${String(index)}]`);
    const resolved = requireBoolean(conflict.resolved, "conflict.resolved");
    const resolutionReferenceId = optionalString(conflict.resolutionReferenceId, "conflict.resolutionReferenceId", true);
    if (resolved && resolutionReferenceId === undefined) fail(KnowledgeErrorCode.InvalidReference, "resolved conflict requires a resolution reference.");
    const sourceReferenceIds = requireStringArray(conflict.sourceReferenceIds, "conflict.sourceReferenceIds", true);
    if (sourceReferenceIds.some((id) => !validSourceIds.has(id))) fail(KnowledgeErrorCode.InvalidReference, "conflict references an undeclared source.");
    return { conflictId: requireString(conflict.conflictId, "conflict.conflictId", true), statement: requireString(conflict.statement, "conflict.statement"), sourceReferenceIds, material: requireBoolean(conflict.material, "conflict.material"), resolved, ...(resolutionReferenceId === undefined ? {} : { resolutionReferenceId }) };
  });
  if (new Set(conflicts.map((entry) => entry.conflictId)).size !== conflicts.length) fail(KnowledgeErrorCode.DuplicateId, "conflict IDs must be unique.");
  const sourceEvidenceAssessmentIds = requireStringArray(candidate.sourceEvidenceAssessmentIds, "candidate.sourceEvidenceAssessmentIds", true);
  const sourceStrategyVersionIds = requireStringArray(candidate.sourceStrategyVersionIds, "candidate.sourceStrategyVersionIds", true);
  if (!setEqual(sourceEvidenceAssessmentIds, strategyReviews.map((review) => review.evidenceAssessmentId))) fail(KnowledgeErrorCode.InvalidReference, "evidence assessment IDs must match Strategy Review sources.");
  if (!setEqual(sourceStrategyVersionIds, strategyReviews.map((review) => review.strategyVersionId))) fail(KnowledgeErrorCode.InvalidReference, "strategy version IDs must match Strategy Review sources.");
  const completedReviewCount = requireInteger(candidate.completedReviewCount, "candidate.completedReviewCount");
  const distinctOutcomeCount = requireInteger(candidate.distinctOutcomeCount, "candidate.distinctOutcomeCount");
  if (completedReviewCount !== strategyReviews.filter((review) => review.reviewStatus === StrategyReviewStatus.Complete).length) fail(KnowledgeErrorCode.InvalidRecord, "completed review count does not match sources.");
  if (distinctOutcomeCount !== new Set(strategyReviews.map((review) => review.outcomeId)).size) fail(KnowledgeErrorCode.InvalidRecord, "distinct outcome count does not match sources.");
  const createdBy = validateActor(candidate.createdBy, "candidate.createdBy");
  const aiAssisted = requireBoolean(candidate.aiAssisted, "candidate.aiAssisted");
  if ((createdBy.actorType === KnowledgeActorType.AI || interpretations.some((entry) => entry.aiAssisted)) && !aiAssisted) fail(KnowledgeErrorCode.InvalidRecord, "candidate must disclose AI assistance.");
  return {
    schemaVersion: KNOWLEDGE_APPROVAL_SCHEMA_VERSION,
    candidateId: requireString(candidate.candidateId, "candidate.candidateId", true),
    revision: requireInteger(candidate.revision, "candidate.revision", 1),
    candidateType: requireEnum<CandidateKnowledgeType>(candidate.candidateType, candidateTypes, "candidate.candidateType"),
    claimKey: requireString(candidate.claimKey, "candidate.claimKey", true),
    statement: requireString(candidate.statement, "candidate.statement"),
    scope,
    strategyReviews,
    sourceReferences,
    sourceEvidenceAssessmentIds,
    sourceStrategyVersionIds,
    supportingFacts,
    interpretations,
    conflicts,
    completedReviewCount,
    distinctOutcomeCount,
    createdAt: requireTimestamp(candidate.createdAt, "candidate.createdAt"),
    createdBy,
    aiAssisted,
    ...(candidate.proposedSupersedesKnowledgeId === undefined ? {} : { proposedSupersedesKnowledgeId: requireString(candidate.proposedSupersedesKnowledgeId, "candidate.proposedSupersedesKnowledgeId", true) }),
    blockers: requireStringArray(candidate.blockers, "candidate.blockers"),
    warnings: requireStringArray(candidate.warnings, "candidate.warnings"),
    privacyLevel: requireEnum<PrivacyLevel>(candidate.privacyLevel, privacyLevels, "candidate.privacyLevel"),
    retention: requireEnum<AIAuditRetentionClassification>(candidate.retention, retentionValues, "candidate.retention"),
    trace: validateTrace(candidate.trace, "candidate.trace"),
    status: CandidateKnowledgeStatus.PendingReview,
  };
}

function validatePolicy(value: unknown): KnowledgeApprovalPolicy {
  const policy = requireObject(value, "policy");
  if (policy.schemaVersion !== KNOWLEDGE_APPROVAL_SCHEMA_VERSION) fail(KnowledgeErrorCode.InvalidPolicy, "policy schemaVersion is unsupported.");
  if (!Array.isArray(policy.rules) || policy.rules.length === 0) fail(KnowledgeErrorCode.InvalidPolicy, "policy requires at least one type rule.");
  const rules = policy.rules.map((entry, index): KnowledgeTypeApprovalRule => {
    const rule = requireObject(entry, `policy.rules[${String(index)}]`);
    const maxAge = rule.maxCandidateAgeSeconds === undefined ? undefined : requireInteger(rule.maxCandidateAgeSeconds, "rule.maxCandidateAgeSeconds", 1);
    return {
      candidateType: requireEnum<CandidateKnowledgeType>(rule.candidateType, candidateTypes, "rule.candidateType"),
      minimumCompletedReviewCount: requireInteger(rule.minimumCompletedReviewCount, "rule.minimumCompletedReviewCount", 1),
      minimumDistinctOutcomeCount: requireInteger(rule.minimumDistinctOutcomeCount, "rule.minimumDistinctOutcomeCount", 1),
      requireProvenance: requireBoolean(rule.requireProvenance, "rule.requireProvenance"),
      blockMaterialConflicts: requireBoolean(rule.blockMaterialConflicts, "rule.blockMaterialConflicts"),
      compatibleStrategyVersionIds: requireStringArray(rule.compatibleStrategyVersionIds, "rule.compatibleStrategyVersionIds", true),
      ...(maxAge === undefined ? {} : { maxCandidateAgeSeconds: maxAge }),
      allowSingleEventSafetyException: requireBoolean(rule.allowSingleEventSafetyException, "rule.allowSingleEventSafetyException"),
    };
  });
  if (new Set(rules.map((rule) => rule.candidateType)).size !== rules.length) fail(KnowledgeErrorCode.InvalidPolicy, "policy has duplicate candidate-type rules.");
  return {
    schemaVersion: KNOWLEDGE_APPROVAL_SCHEMA_VERSION,
    policyId: requireString(policy.policyId, "policy.policyId", true),
    version: requireString(policy.version, "policy.version"),
    authorizationPolicyReference: requireString(policy.authorizationPolicyReference, "policy.authorizationPolicyReference", true),
    rules,
  };
}

function auditEvent(
  candidate: CandidateKnowledgeState | CandidateKnowledge,
  operationType: KnowledgeAuditOperationType,
  sourceRecordId: string,
  sourceRecordVersion: string,
  timestamp: string,
  status: string,
  reasonCodes: ReadonlyArray<string>,
  actor: KnowledgeActor,
  policyVersions: Readonly<Record<string, string>> = {},
  suffix: string = operationType,
): KnowledgeAuditEvent {
  return frozenClone({
    auditId: `knowledge-audit:${sourceRecordId}:${suffix}`,
    operationType,
    sourceRecordId,
    sourceRecordVersion,
    timestamp,
    status,
    reasonCodes: sortedUnique(reasonCodes),
    actor,
    policyVersions,
    privacyLevel: candidate.privacyLevel,
    retention: candidate.retention,
    trace: candidate.trace,
    metadata: {
      candidate_type: candidate.candidateType,
      ai_assisted: candidate.aiAssisted,
      deterministic: true,
      strategy_mutation: false,
    },
  });
}

function lifecycle(
  candidate: CandidateKnowledgeState | CandidateKnowledge,
  eventId: string,
  recordType: KnowledgeLifecycleRecordType,
  recordId: string,
  aggregateVersion: number,
  fromStatus: CandidateKnowledgeStatus | ApprovedKnowledgeStatus | undefined,
  toStatus: CandidateKnowledgeStatus | ApprovedKnowledgeStatus,
  occurredAt: string,
  actor: KnowledgeActor,
  reason: string,
  referenceId: string,
  audit: KnowledgeAuditEvent,
  replacementRecordId?: string,
): KnowledgeLifecycleEvent {
  return frozenClone({
    eventId,
    recordType,
    recordId,
    aggregateVersion,
    ...(fromStatus === undefined ? {} : { fromStatus }),
    toStatus,
    occurredAt,
    actor,
    reason,
    referenceId,
    ...(replacementRecordId === undefined ? {} : { replacementRecordId }),
    auditEvent: audit,
  });
}

function ownerAuthorized(actor: KnowledgeActor, policy: KnowledgeApprovalPolicy): boolean {
  return actor.actorType === KnowledgeActorType.Owner && actor.authorizationReference === policy.authorizationPolicyReference;
}

export class KnowledgeApprovalService {
  constructor(private readonly repository: KnowledgeApprovalRepository) {}

  getReadModel(): KnowledgeReadModel {
    return Object.freeze({
      getCandidate: (candidateId: string) => this.repository.getCandidate(candidateId),
      getApprovedKnowledge: (knowledgeId: string) => this.repository.getApprovedKnowledge(knowledgeId),
      listCandidates: () => this.repository.listCandidates(),
      listApprovedKnowledge: () => this.repository.listApprovedKnowledge(),
      listCurrentApprovedKnowledge: () => this.repository.listCurrentApprovedKnowledge(),
      getCandidateHistory: (candidateId: string) => this.repository.getCandidateHistory(candidateId),
      getApprovedKnowledgeHistory: (knowledgeId: string) => this.repository.getApprovedKnowledgeHistory(knowledgeId),
    });
  }

  submitCandidate(value: unknown): CandidateKnowledgeState {
    const command = requireObject(value, "submission command");
    const commandId = requireString(command.commandId, "commandId", true);
    const idempotencyKey = requireString(command.idempotencyKey, "idempotencyKey", true);
    const acceptedAt = requireTimestamp(command.acceptedAt, "acceptedAt");
    const candidate = validateCandidate(command.candidate);
    if (Date.parse(candidate.createdAt) > Date.parse(acceptedAt)) fail(KnowledgeErrorCode.InvalidTimestamp, "candidate cannot be created after acceptance.");
    const audit = auditEvent(candidate, KnowledgeAuditOperationType.CandidateSubmitted, candidate.candidateId, String(candidate.revision), acceptedAt, CandidateKnowledgeStatus.PendingReview, ["CANDIDATE_ACCEPTED"], candidate.createdBy);
    const history = lifecycle(candidate, `candidate-event:${candidate.candidateId}:1`, KnowledgeLifecycleRecordType.Candidate, candidate.candidateId, 1, undefined, CandidateKnowledgeStatus.PendingReview, acceptedAt, candidate.createdBy, "Candidate submitted for owner review.", commandId, audit);
    return this.repository.appendCandidate(candidate, history, commandId, idempotencyKey, acceptedAt).record;
  }

  evaluateEligibility(value: unknown): KnowledgeEligibilityResult {
    const requestValue = requireObject(value, "eligibility request");
    const request: KnowledgeEligibilityRequest = {
      eligibilityId: requireString(requestValue.eligibilityId, "eligibilityId", true),
      candidateId: requireString(requestValue.candidateId, "candidateId", true),
      evaluatedAt: requireTimestamp(requestValue.evaluatedAt, "evaluatedAt"),
      policy: validatePolicy(requestValue.policy),
      approvalActor: validateActor(requestValue.approvalActor, "approvalActor"),
    };
    const candidate = this.repository.getCandidate(request.candidateId);
    if (candidate === undefined) fail(KnowledgeErrorCode.CandidateNotFound, "candidate does not exist.");
    const rule = request.policy.rules.find((entry) => entry.candidateType === candidate.candidateType);
    const checks: KnowledgeEligibilityCheck[] = [];
    const blockers: Array<KnowledgeIssue<KnowledgeBlockerCode>> = [];
    const add = (criterion: KnowledgeEligibilityCriterion, passed: boolean, actual: string | number | boolean, required: string | number | boolean, reasonCode: string, sourceReferenceIds: ReadonlyArray<string>, blocker?: KnowledgeBlockerCode): void => {
      checks.push({ criterion, status: passed ? KnowledgeCriterionStatus.Passed : KnowledgeCriterionStatus.Failed, actual, required, sourceReferenceIds: sortedUnique(sourceReferenceIds), reasonCode });
      if (!passed && blocker !== undefined) blockers.push({ code: blocker, message: reasonCode, sourceReferenceIds: sortedUnique(sourceReferenceIds) });
    };
    add(KnowledgeEligibilityCriterion.CandidateLifecycle, candidate.status === CandidateKnowledgeStatus.PendingReview, candidate.status, CandidateKnowledgeStatus.PendingReview, candidate.status === CandidateKnowledgeStatus.PendingReview ? "CANDIDATE_PENDING" : "CANDIDATE_NOT_PENDING", [], KnowledgeBlockerCode.CandidateNotPending);
    add(KnowledgeEligibilityCriterion.CandidateBlockers, candidate.blockers.length === 0, candidate.blockers.length, 0, candidate.blockers.length === 0 ? "NO_DECLARED_BLOCKERS" : "CANDIDATE_DECLARED_BLOCKER", candidate.blockers, KnowledgeBlockerCode.CandidateDeclaredBlocker);
    if (rule === undefined) {
      blockers.push({ code: KnowledgeBlockerCode.PolicyRuleMissing, message: "Policy has no rule for candidate type.", sourceReferenceIds: [] });
      checks.push({ criterion: KnowledgeEligibilityCriterion.SampleAdequacy, status: KnowledgeCriterionStatus.Failed, actual: candidate.candidateType, required: "TYPE_RULE", sourceReferenceIds: [], reasonCode: "POLICY_RULE_MISSING" });
    }
    const reviewIds = candidate.strategyReviews.map((review) => review.referenceId);
    add(KnowledgeEligibilityCriterion.ReviewPresent, candidate.strategyReviews.length > 0, candidate.strategyReviews.length, 1, candidate.strategyReviews.length > 0 ? "REVIEWS_PRESENT" : "REVIEWS_MISSING", reviewIds, KnowledgeBlockerCode.StrategyReviewMissing);
    const reviewsComplete = candidate.strategyReviews.every((review) => review.reviewStatus === StrategyReviewStatus.Complete);
    add(KnowledgeEligibilityCriterion.ReviewCompletion, reviewsComplete, candidate.completedReviewCount, candidate.strategyReviews.length, reviewsComplete ? "REVIEWS_COMPLETE" : "REVIEW_INCOMPLETE", reviewIds, KnowledgeBlockerCode.StrategyReviewIncomplete);
    const sufficient = candidate.strategyReviews.every((review) => review.evidenceStatus === EvidenceAssessmentStatus.Sufficient);
    add(KnowledgeEligibilityCriterion.EvidenceSufficiency, sufficient, sufficient, true, sufficient ? "EVIDENCE_SUFFICIENT" : "EVIDENCE_NOT_SUFFICIENT", reviewIds, KnowledgeBlockerCode.EvidenceNotSufficient);
    const unavailableRefs = [...candidate.strategyReviews.filter((review) => review.availability !== KnowledgeSourceAvailability.Available).map((review) => review.referenceId), ...candidate.sourceReferences.filter((source) => source.availability !== KnowledgeSourceAvailability.Available).map((source) => source.referenceId)];
    add(KnowledgeEligibilityCriterion.SourceAvailability, unavailableRefs.length === 0, unavailableRefs.length, 0, unavailableRefs.length === 0 ? "SOURCES_AVAILABLE" : "SOURCE_UNAVAILABLE", unavailableRefs, KnowledgeBlockerCode.SourceUnavailable);
    const provenanceMissing = rule?.requireProvenance === true
      ? [...candidate.strategyReviews.filter((review) => review.provenanceReferenceIds.length === 0).map((review) => review.referenceId), ...candidate.sourceReferences.filter((source) => source.provenanceReferenceIds.length === 0).map((source) => source.referenceId), ...candidate.supportingFacts.filter((fact) => fact.sourceReferenceIds.length === 0).map((fact) => fact.factId)]
      : [];
    add(KnowledgeEligibilityCriterion.Provenance, provenanceMissing.length === 0, provenanceMissing.length, 0, provenanceMissing.length === 0 ? "PROVENANCE_COMPLETE" : "PROVENANCE_MISSING", provenanceMissing, KnowledgeBlockerCode.ProvenanceMissing);
    const safetyFact = candidate.candidateType === CandidateKnowledgeType.RiskLesson && candidate.supportingFacts.some((fact) => fact.verified && (fact.severeSafetyViolation || fact.hardPolicyViolation));
    const safetyExceptionApplied = rule !== undefined && rule.allowSingleEventSafetyException && safetyFact && candidate.completedReviewCount >= 1 && candidate.distinctOutcomeCount >= 1;
    const requiredReviews = safetyExceptionApplied ? 1 : (rule?.minimumCompletedReviewCount ?? Number.MAX_SAFE_INTEGER);
    const requiredOutcomes = safetyExceptionApplied ? 1 : (rule?.minimumDistinctOutcomeCount ?? Number.MAX_SAFE_INTEGER);
    add(KnowledgeEligibilityCriterion.ReviewCount, candidate.completedReviewCount >= requiredReviews, candidate.completedReviewCount, requiredReviews, candidate.completedReviewCount >= requiredReviews ? "REVIEW_COUNT_MET" : "REVIEW_COUNT_INSUFFICIENT", reviewIds, KnowledgeBlockerCode.ReviewCountInsufficient);
    add(KnowledgeEligibilityCriterion.OutcomeCount, candidate.distinctOutcomeCount >= requiredOutcomes, candidate.distinctOutcomeCount, requiredOutcomes, candidate.distinctOutcomeCount >= requiredOutcomes ? "OUTCOME_COUNT_MET" : "OUTCOME_COUNT_INSUFFICIENT", reviewIds, KnowledgeBlockerCode.OutcomeCountInsufficient);
    const sampleAdequate = candidate.completedReviewCount >= requiredReviews && candidate.distinctOutcomeCount >= requiredOutcomes;
    add(KnowledgeEligibilityCriterion.SampleAdequacy, sampleAdequate, `${String(candidate.completedReviewCount)}/${String(candidate.distinctOutcomeCount)}`, `${String(requiredReviews)}/${String(requiredOutcomes)}`, sampleAdequate ? "SAMPLE_ADEQUATE" : "SAMPLE_INADEQUATE", reviewIds, KnowledgeBlockerCode.SampleInadequate);
    const compatible = rule === undefined || rule.compatibleStrategyVersionIds.length === 0 || candidate.sourceStrategyVersionIds.every((id) => rule.compatibleStrategyVersionIds.includes(id));
    add(KnowledgeEligibilityCriterion.VersionCompatibility, compatible, candidate.sourceStrategyVersionIds.join(","), rule?.compatibleStrategyVersionIds.join(",") ?? "RULE_REQUIRED", compatible ? "VERSIONS_COMPATIBLE" : "VERSION_INCOMPATIBLE", candidate.sourceStrategyVersionIds, KnowledgeBlockerCode.VersionIncompatible);
    const materialConflictIds = rule?.blockMaterialConflicts === true ? candidate.conflicts.filter((conflict) => conflict.material && !conflict.resolved).map((conflict) => conflict.conflictId) : [];
    add(KnowledgeEligibilityCriterion.ConflictFree, materialConflictIds.length === 0, materialConflictIds.length, 0, materialConflictIds.length === 0 ? "NO_MATERIAL_CONFLICT" : "MATERIAL_CONFLICT", materialConflictIds, KnowledgeBlockerCode.MaterialConflict);
    let fresh = true;
    let ageSeconds = 0;
    if (rule?.maxCandidateAgeSeconds !== undefined) {
      ageSeconds = Math.floor((Date.parse(request.evaluatedAt) - Date.parse(candidate.createdAt)) / 1_000);
      if (ageSeconds < 0) fail(KnowledgeErrorCode.InvalidTimestamp, "eligibility evaluation precedes candidate creation.");
      fresh = ageSeconds <= rule.maxCandidateAgeSeconds;
    }
    add(KnowledgeEligibilityCriterion.Freshness, fresh, ageSeconds, rule?.maxCandidateAgeSeconds ?? "NOT_APPLICABLE", fresh ? "CANDIDATE_FRESH" : "CANDIDATE_STALE", [], KnowledgeBlockerCode.CandidateStale);
    const authorized = ownerAuthorized(request.approvalActor, request.policy);
    add(KnowledgeEligibilityCriterion.OwnerAuthorization, authorized, request.approvalActor.actorType, KnowledgeActorType.Owner, authorized ? "OWNER_AUTHORIZED" : "OWNER_AUTHORITY_MISSING", [], KnowledgeBlockerCode.OwnerAuthorityMissing);
    checks.push({ criterion: KnowledgeEligibilityCriterion.SafetyException, status: safetyExceptionApplied ? KnowledgeCriterionStatus.Passed : KnowledgeCriterionStatus.NotApplicable, actual: safetyExceptionApplied, required: rule?.allowSingleEventSafetyException ?? false, sourceReferenceIds: safetyExceptionApplied ? candidate.supportingFacts.filter((fact) => fact.verified && (fact.severeSafetyViolation || fact.hardPolicyViolation)).map((fact) => fact.factId) : [], reasonCode: safetyExceptionApplied ? "SAFETY_EXCEPTION_APPLIED" : "SAFETY_EXCEPTION_NOT_APPLIED" });
    const dedupedBlockers = [...new Map(blockers.map((blocker) => [`${blocker.code}:${blocker.sourceReferenceIds.join(",")}`, blocker])).values()]
      .sort((left, right) => left.code.localeCompare(right.code));
    const status = dedupedBlockers.length === 0 ? KnowledgeEligibilityStatus.EligibleForOwnerReview : KnowledgeEligibilityStatus.Blocked;
    const sourceVersions: Record<string, string> = {};
    for (const review of candidate.strategyReviews) sourceVersions[review.reviewId] = review.reviewSchemaVersion;
    for (const source of candidate.sourceReferences) sourceVersions[source.sourceId] = source.version;
    const audit = auditEvent(candidate, KnowledgeAuditOperationType.EligibilityEvaluated, candidate.candidateId, String(candidate.revision), request.evaluatedAt, status, dedupedBlockers.map((blocker) => blocker.code), request.approvalActor, { [request.policy.policyId]: request.policy.version }, request.eligibilityId);
    return frozenClone({ schemaVersion: KNOWLEDGE_APPROVAL_SCHEMA_VERSION, eligibilityId: request.eligibilityId, candidateId: candidate.candidateId, candidateRevision: candidate.revision, evaluatedAt: request.evaluatedAt, status, policy: request.policy, checks, blockers: dedupedBlockers, warnings: sortedUnique(candidate.warnings), safetyExceptionApplied, sourceVersions, approvalGranted: false, deterministic: true, auditEvent: audit });
  }

  decide(value: unknown): KnowledgeApprovalResult {
    const commandValue = requireObject(value, "approval command");
    const command = this.validateApprovalCommand(commandValue);
    const candidate = this.repository.getCandidate(command.candidateId);
    if (candidate === undefined) fail(KnowledgeErrorCode.CandidateNotFound, "candidate does not exist.");
    if (candidate.aggregateVersion !== command.expectedCandidateVersion) fail(KnowledgeErrorCode.VersionConflict, "candidate version is stale.");
    if (!ownerAuthorized(command.actor, command.policy)) fail(KnowledgeErrorCode.InvalidAuthority, "only an authorized owner may decide candidate knowledge.");
    const allowed = candidate.status === CandidateKnowledgeStatus.PendingReview || (candidate.status === CandidateKnowledgeStatus.NeedsMoreEvidence && command.decision === KnowledgeApprovalDecisionType.Reject);
    if (!allowed) fail(KnowledgeErrorCode.InvalidLifecycle, "candidate is terminal or not eligible for this decision.");
    const eligibility = this.evaluateEligibility({ eligibilityId: `eligibility:${command.decisionId}`, candidateId: candidate.candidateId, evaluatedAt: command.decidedAt, policy: command.policy, approvalActor: command.actor });
    if (command.decision === KnowledgeApprovalDecisionType.Approve && eligibility.status !== KnowledgeEligibilityStatus.EligibleForOwnerReview) fail(KnowledgeErrorCode.ApprovalBlocked, "candidate is not eligible for owner approval.");
    if (command.decision === KnowledgeApprovalDecisionType.Approve && (command.knowledgeId === undefined || command.effectiveFrom === undefined)) fail(KnowledgeErrorCode.InvalidRecord, "approval requires knowledgeId and effectiveFrom.");
    if (command.decision !== KnowledgeApprovalDecisionType.Approve && (command.knowledgeId !== undefined || command.effectiveFrom !== undefined)) fail(KnowledgeErrorCode.InvalidRecord, "non-approval cannot create Approved Knowledge.");
    const targetStatus = command.decision === KnowledgeApprovalDecisionType.Approve ? CandidateKnowledgeStatus.Approved : command.decision === KnowledgeApprovalDecisionType.Reject ? CandidateKnowledgeStatus.Rejected : CandidateKnowledgeStatus.NeedsMoreEvidence;
    const operation = command.decision === KnowledgeApprovalDecisionType.Approve ? KnowledgeAuditOperationType.CandidateApproved : command.decision === KnowledgeApprovalDecisionType.Reject ? KnowledgeAuditOperationType.CandidateRejected : KnowledgeAuditOperationType.EvidenceRequested;
    const audit = auditEvent(candidate, operation, candidate.candidateId, String(candidate.revision), command.decidedAt, targetStatus, eligibility.blockers.map((blocker) => blocker.code), command.actor, { [command.policy.policyId]: command.policy.version }, command.decisionId);
    const decision: KnowledgeOwnerDecisionRecord = frozenClone({ schemaVersion: KNOWLEDGE_APPROVAL_SCHEMA_VERSION, decisionId: command.decisionId, commandId: command.commandId, idempotencyKey: command.idempotencyKey, candidateId: candidate.candidateId, candidateRevision: candidate.revision, decision: command.decision, actor: command.actor, policyId: command.policy.policyId, policyVersion: command.policy.version, eligibility, blockers: eligibility.blockers, warnings: sortedUnique([...candidate.warnings, ...eligibility.warnings]), acknowledgedWarnings: command.acknowledgedWarnings, reason: command.reason, conditions: command.conditions, decidedAt: command.decidedAt, sourceVersions: eligibility.sourceVersions, trace: command.trace, auditEvent: audit });
    const candidateHistory = lifecycle(candidate, `candidate-event:${candidate.candidateId}:${String(candidate.aggregateVersion + 1)}`, KnowledgeLifecycleRecordType.Candidate, candidate.candidateId, candidate.aggregateVersion + 1, candidate.status, targetStatus, command.decidedAt, command.actor, command.reason, command.decisionId, audit);
    let approved: ApprovedKnowledge | undefined;
    let approvedLifecycle: KnowledgeLifecycleEvent | undefined;
    if (command.decision === KnowledgeApprovalDecisionType.Approve && command.knowledgeId !== undefined && command.effectiveFrom !== undefined) {
      if (Date.parse(command.effectiveFrom) < Date.parse(command.decidedAt)) fail(KnowledgeErrorCode.InvalidTimestamp, "effectiveFrom cannot precede approval.");
      approved = frozenClone({ schemaVersion: KNOWLEDGE_APPROVAL_SCHEMA_VERSION, knowledgeId: command.knowledgeId, knowledgeVersion: 1, knowledgeType: candidate.candidateType, claimKey: candidate.claimKey, statement: candidate.statement, scope: candidate.scope, supportingCandidateIds: [candidate.candidateId], sourceStrategyReviewIds: sortedUnique(candidate.strategyReviews.map((review) => review.reviewId)), sourceEvidenceAssessmentIds: candidate.sourceEvidenceAssessmentIds, sourceStrategyVersionIds: candidate.sourceStrategyVersionIds, sourceReferences: candidate.sourceReferences, supportingFactIds: sortedUnique(candidate.supportingFacts.filter((fact) => fact.verified).map((fact) => fact.factId)), approvalDecisionId: decision.decisionId, approvalPolicyId: command.policy.policyId, approvalPolicyVersion: command.policy.version, approvedAt: command.decidedAt, approvedBy: command.actor, effectiveFrom: command.effectiveFrom, applicabilityConstraints: command.applicabilityConstraints, ...(candidate.proposedSupersedesKnowledgeId === undefined ? {} : { supersedesKnowledgeId: candidate.proposedSupersedesKnowledgeId }), warnings: decision.warnings, privacyLevel: candidate.privacyLevel, retention: candidate.retention, trace: command.trace, status: ApprovedKnowledgeStatus.Active });
      const activationAudit = auditEvent(candidate, KnowledgeAuditOperationType.KnowledgeActivated, approved.knowledgeId, "1", command.decidedAt, ApprovedKnowledgeStatus.Active, ["OWNER_APPROVED_KNOWLEDGE"], command.actor, { [command.policy.policyId]: command.policy.version }, command.decisionId);
      approvedLifecycle = lifecycle(candidate, `knowledge-event:${approved.knowledgeId}:1`, KnowledgeLifecycleRecordType.ApprovedKnowledge, approved.knowledgeId, 1, undefined, ApprovedKnowledgeStatus.Active, command.decidedAt, command.actor, command.reason, command.decisionId, activationAudit);
    }
    this.repository.appendDecision(decision, candidateHistory, approved, approvedLifecycle, command.commandId, command.idempotencyKey, command.decidedAt);
    const candidateState = this.repository.getCandidate(candidate.candidateId) as CandidateKnowledgeState;
    const approvedState = approved === undefined ? undefined : this.repository.getApprovedKnowledge(approved.knowledgeId);
    return frozenClone({ decision, candidate: candidateState, ...(approvedState === undefined ? {} : { approvedKnowledge: approvedState }) });
  }

  resubmitCandidate(value: unknown): CandidateKnowledgeState {
    const raw = requireObject(value, "resubmission command");
    const command: KnowledgeCandidateResubmissionCommand = {
      commandId: requireString(raw.commandId, "commandId", true),
      idempotencyKey: requireString(raw.idempotencyKey, "idempotencyKey", true),
      expectedCandidateVersion: requireInteger(raw.expectedCandidateVersion, "expectedCandidateVersion", 1),
      revisedCandidate: validateCandidate(raw.revisedCandidate),
      actor: validateActor(raw.actor, "actor"),
      occurredAt: requireTimestamp(raw.occurredAt, "occurredAt"),
      reason: requireString(raw.reason, "reason"),
    };
    const current = this.repository.getCandidate(command.revisedCandidate.candidateId);
    if (current === undefined) fail(KnowledgeErrorCode.CandidateNotFound, "candidate does not exist.");
    this.assertOwnerLifecycleActor(command.actor);
    if (current.aggregateVersion !== command.expectedCandidateVersion || current.status !== CandidateKnowledgeStatus.NeedsMoreEvidence) fail(KnowledgeErrorCode.VersionConflict, "candidate is not at the expected evidence-return state.");
    const audit = auditEvent(command.revisedCandidate, KnowledgeAuditOperationType.CandidateResubmitted, current.candidateId, String(command.revisedCandidate.revision), command.occurredAt, CandidateKnowledgeStatus.PendingReview, ["CANDIDATE_RESUBMITTED"], command.actor);
    const history = lifecycle(current, `candidate-event:${current.candidateId}:${String(current.aggregateVersion + 1)}`, KnowledgeLifecycleRecordType.Candidate, current.candidateId, current.aggregateVersion + 1, current.status, CandidateKnowledgeStatus.PendingReview, command.occurredAt, command.actor, command.reason, command.commandId, audit);
    return this.repository.appendCandidateResubmission(command.revisedCandidate, history, command.commandId, command.idempotencyKey, command.occurredAt).record;
  }

  supersedeCandidate(value: unknown): CandidateKnowledgeState {
    const raw = requireObject(value, "candidate supersession command");
    const command: KnowledgeCandidateSupersessionCommand = { commandId: requireString(raw.commandId, "commandId", true), idempotencyKey: requireString(raw.idempotencyKey, "idempotencyKey", true), eventId: requireString(raw.eventId, "eventId", true), candidateId: requireString(raw.candidateId, "candidateId", true), replacementCandidateId: requireString(raw.replacementCandidateId, "replacementCandidateId", true), expectedCandidateVersion: requireInteger(raw.expectedCandidateVersion, "expectedCandidateVersion", 1), actor: validateActor(raw.actor, "actor"), occurredAt: requireTimestamp(raw.occurredAt, "occurredAt"), reason: requireString(raw.reason, "reason") };
    this.assertOwnerLifecycleActor(command.actor);
    const current = this.repository.getCandidate(command.candidateId);
    if (current === undefined) fail(KnowledgeErrorCode.CandidateNotFound, "candidate does not exist.");
    if (current.aggregateVersion !== command.expectedCandidateVersion || ![CandidateKnowledgeStatus.PendingReview, CandidateKnowledgeStatus.NeedsMoreEvidence].includes(current.status)) fail(KnowledgeErrorCode.VersionConflict, "candidate cannot be superseded from current state.");
    const audit = auditEvent(current, KnowledgeAuditOperationType.CandidateSuperseded, current.candidateId, String(current.revision), command.occurredAt, CandidateKnowledgeStatus.Superseded, ["CANDIDATE_SUPERSEDED"], command.actor);
    const history = lifecycle(current, command.eventId, KnowledgeLifecycleRecordType.Candidate, current.candidateId, current.aggregateVersion + 1, current.status, CandidateKnowledgeStatus.Superseded, command.occurredAt, command.actor, command.reason, command.commandId, audit, command.replacementCandidateId);
    return this.repository.appendCandidateSupersession(history, command.commandId, command.idempotencyKey, command.occurredAt).record;
  }

  transitionApprovedKnowledge(value: unknown): ApprovedKnowledgeState {
    const raw = requireObject(value, "knowledge lifecycle command");
    const toStatus = requireEnum<ApprovedKnowledgeStatus>(raw.toStatus, approvedStatuses, "toStatus");
    if (toStatus === ApprovedKnowledgeStatus.Active) fail(KnowledgeErrorCode.InvalidLifecycle, "ACTIVE is not a transition target.");
    const command: ApprovedKnowledgeLifecycleCommand = { commandId: requireString(raw.commandId, "commandId", true), idempotencyKey: requireString(raw.idempotencyKey, "idempotencyKey", true), eventId: requireString(raw.eventId, "eventId", true), knowledgeId: requireString(raw.knowledgeId, "knowledgeId", true), expectedKnowledgeVersion: requireInteger(raw.expectedKnowledgeVersion, "expectedKnowledgeVersion", 1), toStatus, actor: validateActor(raw.actor, "actor"), occurredAt: requireTimestamp(raw.occurredAt, "occurredAt"), reason: requireString(raw.reason, "reason"), ...(raw.replacementKnowledgeId === undefined ? {} : { replacementKnowledgeId: requireString(raw.replacementKnowledgeId, "replacementKnowledgeId", true) }) };
    this.assertOwnerLifecycleActor(command.actor);
    const current = this.repository.getApprovedKnowledge(command.knowledgeId);
    if (current === undefined) fail(KnowledgeErrorCode.KnowledgeNotFound, "approved knowledge does not exist.");
    if (current.aggregateVersion !== command.expectedKnowledgeVersion || current.status !== ApprovedKnowledgeStatus.Active) fail(KnowledgeErrorCode.VersionConflict, "approved knowledge is terminal or stale.");
    if (toStatus === ApprovedKnowledgeStatus.Superseded && command.replacementKnowledgeId === undefined) fail(KnowledgeErrorCode.ReplacementRequired, "supersession requires replacement knowledge.");
    const candidate = this.repository.getCandidate(current.supportingCandidateIds[0] as string);
    if (candidate === undefined) fail(KnowledgeErrorCode.RepositoryCorrupt, "approved knowledge candidate is missing.");
    const operation = toStatus === ApprovedKnowledgeStatus.Superseded ? KnowledgeAuditOperationType.KnowledgeSuperseded : toStatus === ApprovedKnowledgeStatus.Deprecated ? KnowledgeAuditOperationType.KnowledgeDeprecated : KnowledgeAuditOperationType.KnowledgeRevoked;
    const audit = auditEvent(candidate, operation, current.knowledgeId, String(current.knowledgeVersion), command.occurredAt, toStatus, [toStatus], command.actor, { [current.approvalPolicyId]: current.approvalPolicyVersion }, command.eventId);
    const history = lifecycle(candidate, command.eventId, KnowledgeLifecycleRecordType.ApprovedKnowledge, current.knowledgeId, current.aggregateVersion + 1, current.status, toStatus, command.occurredAt, command.actor, command.reason, command.commandId, audit, command.replacementKnowledgeId);
    return this.repository.appendKnowledgeTransition(history, command.commandId, command.idempotencyKey, command.occurredAt).record;
  }

  private assertOwnerLifecycleActor(actor: KnowledgeActor): void {
    if (actor.actorType !== KnowledgeActorType.Owner || actor.authorizationReference === undefined) fail(KnowledgeErrorCode.InvalidAuthority, "only an explicitly authorized owner may change lifecycle state.");
  }

  private validateApprovalCommand(raw: Record<string, unknown>): KnowledgeApprovalCommand {
    const decision = requireEnum<KnowledgeApprovalDecisionType>(raw.decision, decisionTypes, "decision");
    return {
      commandId: requireString(raw.commandId, "commandId", true),
      idempotencyKey: requireString(raw.idempotencyKey, "idempotencyKey", true),
      decisionId: requireString(raw.decisionId, "decisionId", true),
      candidateId: requireString(raw.candidateId, "candidateId", true),
      expectedCandidateVersion: requireInteger(raw.expectedCandidateVersion, "expectedCandidateVersion", 1),
      decision,
      actor: validateActor(raw.actor, "actor"),
      policy: validatePolicy(raw.policy),
      decidedAt: requireTimestamp(raw.decidedAt, "decidedAt"),
      reason: requireString(raw.reason, "reason"),
      conditions: requireStringArray(raw.conditions, "conditions"),
      acknowledgedWarnings: requireStringArray(raw.acknowledgedWarnings, "acknowledgedWarnings"),
      ...(raw.knowledgeId === undefined ? {} : { knowledgeId: requireString(raw.knowledgeId, "knowledgeId", true) }),
      ...(raw.effectiveFrom === undefined ? {} : { effectiveFrom: requireTimestamp(raw.effectiveFrom, "effectiveFrom") }),
      applicabilityConstraints: requireStringArray(raw.applicabilityConstraints, "applicabilityConstraints"),
      trace: validateTrace(raw.trace, "trace"),
    };
  }
}

export function submitKnowledgeCandidate(service: KnowledgeApprovalService, command: Readonly<KnowledgeCandidateSubmissionCommand>): CandidateKnowledgeState {
  return service.submitCandidate(command);
}

export function knowledgeClaimKey(candidate: Readonly<CandidateKnowledge>): string {
  return knowledgeClaimIdentity(candidate);
}
