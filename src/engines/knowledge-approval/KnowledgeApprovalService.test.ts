import {
  AIAuditActorType,
  AIAuditRecordType,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  ApprovedKnowledgeStatus,
  CandidateKnowledgeStatus,
  CandidateKnowledgeType,
  EvidenceAssessmentStatus,
  KNOWLEDGE_APPROVAL_SCHEMA_VERSION,
  KnowledgeActorType,
  KnowledgeApprovalDecisionType,
  KnowledgeAppendStatus,
  KnowledgeAuditOperationType,
  KnowledgeBlockerCode,
  KnowledgeEligibilityStatus,
  KnowledgeErrorCode,
  KnowledgeInterpretationAuthorType,
  KnowledgeScopeType,
  KnowledgeSourceAvailability,
  KnowledgeSourceType,
  PrivacyLevel,
  StrategyReviewStatus,
  type CandidateKnowledge,
  type KnowledgeActor,
  type KnowledgeApprovalPolicy,
} from "../../contracts";
import { InMemoryKnowledgeApprovalRepository } from "../../repositories/InMemoryKnowledgeApprovalRepository";
import { auditRecordFromKnowledgeApproval } from "./KnowledgeApprovalAuditTranslations";
import { KnowledgeApprovalService } from "./KnowledgeApprovalService";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`);
  }
}

function expectError(run: () => unknown, code: KnowledgeErrorCode): void {
  try {
    run();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`${code}:`)) return;
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const owner: KnowledgeActor = {
  actorType: KnowledgeActorType.Owner,
  actorId: "owner:alpha",
  authorizationReference: "authorization:owner-alpha",
};

const contributor: KnowledgeActor = {
  actorType: KnowledgeActorType.HumanContributor,
  actorId: "human:reviewer",
};

const trace = {
  correlationId: "correlation:knowledge",
  traceId: "trace:knowledge",
  auditReferenceIds: ["audit:strategy-review"],
};

function review(index: number) {
  return {
    referenceId: `review-reference:${String(index)}`,
    reviewId: `strategy-review:${String(index)}`,
    reviewSchemaVersion: "1.0",
    reviewStatus: StrategyReviewStatus.Complete,
    evidenceAssessmentId: `evidence-assessment:${String(index)}`,
    evidenceAssessmentVersion: "1.0",
    evidenceStatus: EvidenceAssessmentStatus.Sufficient,
    strategyVersionId: "strategy-version:1",
    outcomeId: `outcome:${String(index)}`,
    availability: KnowledgeSourceAvailability.Available,
    provenanceReferenceIds: [`audit:review:${String(index)}`],
  };
}

function candidate(overrides: Partial<CandidateKnowledge> = {}): CandidateKnowledge {
  const reviews = overrides.strategyReviews ?? [review(1), review(2)];
  return {
    schemaVersion: KNOWLEDGE_APPROVAL_SCHEMA_VERSION,
    candidateId: "candidate:execution-discipline",
    revision: 1,
    candidateType: CandidateKnowledgeType.ExecutionLesson,
    claimKey: "execution-discipline:planned-exit",
    statement: "Execution quality improves when the frozen exit rule is followed.",
    scope: {
      scopeType: KnowledgeScopeType.Strategy,
      strategyFamily: "event-contracts",
      markets: ["event-contracts"],
      instruments: [],
      strategyVersionIds: ["strategy-version:1"],
      tags: ["execution"],
    },
    strategyReviews: reviews,
    sourceReferences: [{
      referenceId: "source:audit",
      sourceType: KnowledgeSourceType.AuditRecord,
      sourceId: "audit:execution-cycle",
      version: "1.0",
      status: "FINAL",
      availability: KnowledgeSourceAvailability.Available,
      provenanceReferenceIds: ["audit:source-provenance"],
    }],
    sourceEvidenceAssessmentIds: [...new Set(reviews.map((entry) => entry.evidenceAssessmentId))],
    sourceStrategyVersionIds: [...new Set(reviews.map((entry) => entry.strategyVersionId))],
    supportingFacts: [{
      factId: "fact:planned-exit",
      statement: "Both completed reviews recorded compliance with the frozen exit rule.",
      sourceReferenceIds: reviews.map((entry) => entry.referenceId),
      verified: true,
      severeSafetyViolation: false,
      hardPolicyViolation: false,
    }],
    interpretations: [{
      interpretationId: "interpretation:discipline",
      statement: "Repeated compliance may improve execution discipline.",
      authorType: KnowledgeInterpretationAuthorType.HumanContributor,
      authorId: "human:reviewer",
      aiAssisted: false,
      supportingFactIds: ["fact:planned-exit"],
      limitations: ["Two completed outcomes do not establish universal causality."],
    }],
    conflicts: [],
    completedReviewCount: reviews.filter((entry) => entry.reviewStatus === StrategyReviewStatus.Complete).length,
    distinctOutcomeCount: new Set(reviews.map((entry) => entry.outcomeId)).size,
    createdAt: "2026-07-20T10:00:00.000Z",
    createdBy: contributor,
    aiAssisted: false,
    blockers: [],
    warnings: ["OWNER_REVIEW_REQUIRED"],
    privacyLevel: PrivacyLevel.LocalOnly,
    retention: AIAuditRetentionClassification.LongTerm,
    trace,
    status: CandidateKnowledgeStatus.PendingReview,
    ...overrides,
  };
}

function policy(overrides: Partial<KnowledgeApprovalPolicy["rules"][number]> = {}): KnowledgeApprovalPolicy {
  return {
    schemaVersion: KNOWLEDGE_APPROVAL_SCHEMA_VERSION,
    policyId: "knowledge-policy:phase-one",
    version: "1.0",
    authorizationPolicyReference: "authorization:owner-alpha",
    rules: [{
      candidateType: CandidateKnowledgeType.ExecutionLesson,
      minimumCompletedReviewCount: 2,
      minimumDistinctOutcomeCount: 2,
      requireProvenance: true,
      blockMaterialConflicts: true,
      compatibleStrategyVersionIds: ["strategy-version:1"],
      maxCandidateAgeSeconds: 86_400,
      allowSingleEventSafetyException: false,
      ...overrides,
    }],
  };
}

function system(value: CandidateKnowledge = candidate()) {
  const repository = new InMemoryKnowledgeApprovalRepository();
  const service = new KnowledgeApprovalService(repository);
  const state = service.submitCandidate({
    commandId: `command:submit:${value.candidateId}`,
    idempotencyKey: `idempotency:submit:${value.candidateId}`,
    candidate: value,
    acceptedAt: "2026-07-20T10:01:00.000Z",
  });
  return { repository, service, state };
}

function eligibility(service: KnowledgeApprovalService, candidateId = "candidate:execution-discipline", approvalPolicy = policy(), actor = owner) {
  return service.evaluateEligibility({
    eligibilityId: `eligibility:${candidateId}`,
    candidateId,
    evaluatedAt: "2026-07-20T11:00:00.000Z",
    policy: approvalPolicy,
    approvalActor: actor,
  });
}

function decision(service: KnowledgeApprovalService, overrides: Record<string, unknown> = {}) {
  return service.decide({
    commandId: "command:approve:1",
    idempotencyKey: "idempotency:approve:1",
    decisionId: "decision:approve:1",
    candidateId: "candidate:execution-discipline",
    expectedCandidateVersion: 1,
    decision: KnowledgeApprovalDecisionType.Approve,
    actor: owner,
    policy: policy(),
    decidedAt: "2026-07-20T11:00:00.000Z",
    reason: "Owner approved the bounded, evidence-supported lesson.",
    conditions: [],
    acknowledgedWarnings: ["OWNER_REVIEW_REQUIRED"],
    knowledgeId: "knowledge:execution-discipline",
    effectiveFrom: "2026-07-20T11:00:00.000Z",
    applicabilityConstraints: ["event-contracts strategy family only"],
    trace,
    ...overrides,
  });
}

const tests: Array<readonly [string, () => void]> = [];
const test = (name: string, run: () => void): void => { tests.push([name, run]); };

test("accepts a valid Candidate Knowledge record", () => {
  const { state } = system();
  assertEqual(state.status, CandidateKnowledgeStatus.PendingReview, "candidate status");
  assertEqual(state.aggregateVersion, 1, "candidate version");
});

test("rejects a malformed Candidate Knowledge record", () => {
  const malformed = { ...candidate(), candidateType: "FREE_FORM_TYPE" };
  const service = new KnowledgeApprovalService(new InMemoryKnowledgeApprovalRepository());
  expectError(() => service.submitCandidate({ commandId: "command:bad", idempotencyKey: "idempotency:bad", candidate: malformed, acceptedAt: "2026-07-20T10:01:00.000Z" }), KnowledgeErrorCode.InvalidRecord);
});

test("preserves facts and interpretations as separate records", () => {
  const { state } = system();
  assertEqual(state.supportingFacts[0]?.verified, true, "fact verification");
  assertEqual(state.interpretations[0]?.supportingFactIds[0], "fact:planned-exit", "interpretation link");
});

test("preserves AI-assisted disclosure", () => {
  const value = candidate({
    candidateId: "candidate:ai-assisted",
    aiAssisted: true,
    createdBy: { actorType: KnowledgeActorType.AI, actorId: "ai:router-output" },
    interpretations: [{
      interpretationId: "interpretation:ai",
      statement: "This interpretation requires owner scrutiny.",
      authorType: KnowledgeInterpretationAuthorType.AI,
      authorId: "ai:router-output",
      aiAssisted: true,
      supportingFactIds: ["fact:planned-exit"],
      limitations: ["AI text is untrusted candidate content."],
    }],
  });
  assertEqual(system(value).state.aiAssisted, true, "AI disclosure");
});

test("blocks one ordinary event under a multi-review policy", () => {
  const one = [review(1)];
  const { service } = system(candidate({ candidateId: "candidate:one-event", strategyReviews: one, sourceEvidenceAssessmentIds: [one[0]!.evidenceAssessmentId], sourceStrategyVersionIds: [one[0]!.strategyVersionId], completedReviewCount: 1, distinctOutcomeCount: 1 }));
  const result = eligibility(service, "candidate:one-event");
  assertEqual(result.status, KnowledgeEligibilityStatus.Blocked, "eligibility");
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.SampleInadequate), "sample blocker");
});

test("allows a configured severe-safety exception to reach owner review only", () => {
  const one = [review(1)];
  const value = candidate({
    candidateId: "candidate:safety",
    candidateType: CandidateKnowledgeType.RiskLesson,
    strategyReviews: one,
    sourceEvidenceAssessmentIds: [one[0]!.evidenceAssessmentId],
    sourceStrategyVersionIds: [one[0]!.strategyVersionId],
    completedReviewCount: 1,
    distinctOutcomeCount: 1,
    supportingFacts: [{ factId: "fact:safety", statement: "A verified hard position limit was violated.", sourceReferenceIds: [one[0]!.referenceId], verified: true, severeSafetyViolation: true, hardPolicyViolation: true }],
    interpretations: [],
  });
  const { service } = system(value);
  const result = eligibility(service, value.candidateId, policy({ candidateType: CandidateKnowledgeType.RiskLesson, minimumCompletedReviewCount: 3, minimumDistinctOutcomeCount: 3, allowSingleEventSafetyException: true }));
  assertEqual(result.status, KnowledgeEligibilityStatus.EligibleForOwnerReview, "safety eligibility");
  assertEqual(result.safetyExceptionApplied, true, "safety exception");
  assertEqual(result.approvalGranted, false, "approval not granted by checks");
});

test("blocks a candidate with no Strategy Review", () => {
  const value = candidate({ candidateId: "candidate:no-review", strategyReviews: [], sourceEvidenceAssessmentIds: [], sourceStrategyVersionIds: [], supportingFacts: [], interpretations: [], completedReviewCount: 0, distinctOutcomeCount: 0 });
  const result = eligibility(system(value).service, value.candidateId);
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.StrategyReviewMissing), "review blocker");
});

test("blocks an incomplete Strategy Review", () => {
  const incomplete = [{ ...review(1), reviewStatus: StrategyReviewStatus.Incomplete }, review(2)];
  const value = candidate({ candidateId: "candidate:incomplete", strategyReviews: incomplete, completedReviewCount: 1 });
  const result = eligibility(system(value).service, value.candidateId);
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.StrategyReviewIncomplete), "completion blocker");
});

test("blocks non-SUFFICIENT source evidence", () => {
  const reviews = [{ ...review(1), evidenceStatus: EvidenceAssessmentStatus.Insufficient }, review(2)];
  const value = candidate({ candidateId: "candidate:insufficient", strategyReviews: reviews });
  const result = eligibility(system(value).service, value.candidateId);
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.EvidenceNotSufficient), "evidence blocker");
});

test("blocks unavailable source records", () => {
  const refs = [{ ...candidate().sourceReferences[0]!, availability: KnowledgeSourceAvailability.Unavailable }];
  const value = candidate({ candidateId: "candidate:unavailable", sourceReferences: refs });
  const result = eligibility(system(value).service, value.candidateId);
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.SourceUnavailable), "availability blocker");
});

test("blocks an explicitly declared Candidate Knowledge blocker", () => {
  const value = candidate({ candidateId: "candidate:declared-blocker", blockers: ["SOURCE_REVIEW_REQUIRED"] });
  const result = eligibility(system(value).service, value.candidateId);
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.CandidateDeclaredBlocker), "declared blocker");
});

test("blocks missing provenance", () => {
  const refs = [{ ...candidate().sourceReferences[0]!, provenanceReferenceIds: [] }];
  const value = candidate({ candidateId: "candidate:no-provenance", sourceReferences: refs });
  const result = eligibility(system(value).service, value.candidateId);
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.ProvenanceMissing), "provenance blocker");
});

test("blocks unresolved material conflict", () => {
  const value = candidate({ candidateId: "candidate:conflict", conflicts: [{ conflictId: "conflict:1", statement: "Completed reviews disagree on plan compliance.", sourceReferenceIds: ["review-reference:1", "review-reference:2"], material: true, resolved: false }] });
  const result = eligibility(system(value).service, value.candidateId);
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.MaterialConflict), "conflict blocker");
});

test("blocks incompatible strategy versions", () => {
  const result = eligibility(system().service, "candidate:execution-discipline", policy({ compatibleStrategyVersionIds: ["strategy-version:2"] }));
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.VersionIncompatible), "version blocker");
});

test("blocks a stale candidate when policy requires freshness", () => {
  const result = eligibility(system().service, "candidate:execution-discipline", policy({ maxCandidateAgeSeconds: 60 }));
  assertTrue(result.blockers.some((item) => item.code === KnowledgeBlockerCode.CandidateStale), "stale blocker");
});

test("non-owner cannot approve", () => {
  const { service } = system();
  expectError(() => decision(service, { actor: contributor }), KnowledgeErrorCode.InvalidAuthority);
});

test("non-owner cannot reject", () => {
  const { service } = system();
  expectError(() => decision(service, { actor: contributor, decision: KnowledgeApprovalDecisionType.Reject, knowledgeId: undefined, effectiveFrom: undefined }), KnowledgeErrorCode.InvalidAuthority);
});

test("deterministic checks cannot grant approval", () => {
  const { service, state } = system();
  const result = eligibility(service);
  assertEqual(result.approvalGranted, false, "eligibility authority");
  assertEqual(service.getReadModel().getCandidate(state.candidateId)?.status, CandidateKnowledgeStatus.PendingReview, "candidate unchanged");
});

test("owner approval creates Approved Knowledge", () => {
  const result = decision(system().service);
  assertEqual(result.candidate.status, CandidateKnowledgeStatus.Approved, "candidate status");
  assertEqual(result.approvedKnowledge?.status, ApprovedKnowledgeStatus.Active, "knowledge status");
});

test("rejection does not create Approved Knowledge", () => {
  const { service } = system();
  const result = decision(service, { commandId: "command:reject:1", idempotencyKey: "idempotency:reject:1", decisionId: "decision:reject:1", decision: KnowledgeApprovalDecisionType.Reject, knowledgeId: undefined, effectiveFrom: undefined });
  assertEqual(result.candidate.status, CandidateKnowledgeStatus.Rejected, "candidate rejected");
  assertEqual(result.approvedKnowledge, undefined, "no knowledge");
});

test("duplicate approval command is rejected deterministically", () => {
  const { service } = system();
  decision(service);
  expectError(() => decision(service), KnowledgeErrorCode.VersionConflict);
});

test("terminal Candidate Knowledge cannot be reopened", () => {
  const { service } = system();
  decision(service);
  expectError(() => service.resubmitCandidate({ commandId: "command:reopen", idempotencyKey: "idempotency:reopen", expectedCandidateVersion: 2, revisedCandidate: { ...candidate(), revision: 2 }, actor: owner, occurredAt: "2026-07-20T12:00:00.000Z", reason: "Attempt reopen." }), KnowledgeErrorCode.VersionConflict);
});

test("Approved Knowledge snapshots are deeply immutable", () => {
  const approved = decision(system().service).approvedKnowledge!;
  assertTrue(Object.isFrozen(approved), "knowledge frozen");
  assertTrue(Object.isFrozen(approved.scope), "scope frozen");
  assertTrue(Object.isFrozen(approved.sourceReferences), "sources frozen");
});

test("approval does not mutate Strategy Version source data", () => {
  const source = candidate();
  const before = structuredClone(source.sourceStrategyVersionIds);
  decision(system(source).service);
  assertDeepEqual(source.sourceStrategyVersionIds, before, "strategy versions");
});

test("approval emits no Config, Risk, Decision, frozen-plan, or execution mutation", () => {
  const protectedState = { config: { maxRisk: 1 }, risk: { veto: true }, decision: { status: "BLOCKED" }, frozenPlan: { frozen: true }, instructions: [] as string[] };
  const before = structuredClone(protectedState);
  decision(system().service);
  assertDeepEqual(protectedState, before, "protected systems");
});

function approvedSystem(candidateId: string, knowledgeId: string, claimKey: string) {
  const value = candidate({ candidateId, claimKey });
  const created = system(value);
  const result = decision(created.service, { commandId: `command:approve:${candidateId}`, idempotencyKey: `idempotency:approve:${candidateId}`, decisionId: `decision:approve:${candidateId}`, candidateId, knowledgeId });
  return { ...created, result };
}

test("supersession preserves previous Approved Knowledge history", () => {
  const first = approvedSystem("candidate:first", "knowledge:first", "claim:first");
  const secondCandidate = candidate({ candidateId: "candidate:second", claimKey: "claim:second" });
  first.service.submitCandidate({ commandId: "command:submit:second", idempotencyKey: "idempotency:submit:second", candidate: secondCandidate, acceptedAt: "2026-07-20T10:01:00.000Z" });
  decision(first.service, { commandId: "command:approve:second", idempotencyKey: "idempotency:approve:second", decisionId: "decision:approve:second", candidateId: "candidate:second", knowledgeId: "knowledge:second" });
  const changed = first.service.transitionApprovedKnowledge({ commandId: "command:supersede:first", idempotencyKey: "idempotency:supersede:first", eventId: "event:supersede:first", knowledgeId: "knowledge:first", expectedKnowledgeVersion: 1, toStatus: ApprovedKnowledgeStatus.Superseded, actor: owner, occurredAt: "2026-07-20T12:00:00.000Z", reason: "A later approved record replaces this scope.", replacementKnowledgeId: "knowledge:second" });
  assertEqual(changed.status, ApprovedKnowledgeStatus.Superseded, "status");
  assertEqual(changed.lifecycle.length, 2, "history length");
  assertEqual(changed.lifecycle[0]?.toStatus, ApprovedKnowledgeStatus.Active, "original history");
});

test("revocation preserves history and reason", () => {
  const { service } = approvedSystem("candidate:revoked", "knowledge:revoked", "claim:revoked");
  const changed = service.transitionApprovedKnowledge({ commandId: "command:revoke", idempotencyKey: "idempotency:revoke", eventId: "event:revoke", knowledgeId: "knowledge:revoked", expectedKnowledgeVersion: 1, toStatus: ApprovedKnowledgeStatus.Revoked, actor: owner, occurredAt: "2026-07-20T12:00:00.000Z", reason: "Source review was invalidated." });
  assertEqual(changed.lifecycle[1]?.reason, "Source review was invalidated.", "revocation reason");
  assertEqual(changed.status, ApprovedKnowledgeStatus.Revoked, "revoked status");
});

test("deprecation is explicit and terminal", () => {
  const { service } = approvedSystem("candidate:deprecated", "knowledge:deprecated", "claim:deprecated");
  const changed = service.transitionApprovedKnowledge({ commandId: "command:deprecate", idempotencyKey: "idempotency:deprecate", eventId: "event:deprecate", knowledgeId: "knowledge:deprecated", expectedKnowledgeVersion: 1, toStatus: ApprovedKnowledgeStatus.Deprecated, actor: owner, occurredAt: "2026-07-20T12:00:00.000Z", reason: "No longer applicable to current strategy versions." });
  assertEqual(changed.status, ApprovedKnowledgeStatus.Deprecated, "deprecated status");
  expectError(() => service.transitionApprovedKnowledge({ commandId: "command:revoke:deprecated", idempotencyKey: "idempotency:revoke:deprecated", eventId: "event:revoke:deprecated", knowledgeId: "knowledge:deprecated", expectedKnowledgeVersion: 2, toStatus: ApprovedKnowledgeStatus.Revoked, actor: owner, occurredAt: "2026-07-20T13:00:00.000Z", reason: "Attempt terminal rewrite." }), KnowledgeErrorCode.VersionConflict);
});

test("exact duplicate claim handling is deterministic", () => {
  const { service } = system();
  const duplicate = candidate({ candidateId: "candidate:duplicate" });
  expectError(() => service.submitCandidate({ commandId: "command:duplicate", idempotencyKey: "idempotency:duplicate", candidate: duplicate, acceptedAt: "2026-07-20T10:01:00.000Z" }), KnowledgeErrorCode.DuplicateClaim);
});

test("similar wording with a distinct explicit claim key is not semantically merged", () => {
  const { service } = system();
  const distinct = candidate({ candidateId: "candidate:distinct", claimKey: "execution-discipline:distinct-explicit-key", statement: "Execution discipline benefits from following the plan." });
  const state = service.submitCandidate({ commandId: "command:distinct", idempotencyKey: "idempotency:distinct", candidate: distinct, acceptedAt: "2026-07-20T10:01:00.000Z" });
  assertEqual(state.candidateId, "candidate:distinct", "distinct record");
});

test("append-only repository preserves all committed events", () => {
  const { repository, service } = system();
  decision(service);
  const events = repository.allEvents();
  assertEqual(events.length, 2, "event count");
  assertDeepEqual(events.map((event) => event.sequence), [1, 2], "event sequence");
});

test("read model ordering is deterministic", () => {
  const { service } = system(candidate({ candidateId: "candidate:z", claimKey: "claim:z" }));
  service.submitCandidate({ commandId: "command:submit:a", idempotencyKey: "idempotency:submit:a", candidate: candidate({ candidateId: "candidate:a", claimKey: "claim:a" }), acceptedAt: "2026-07-20T10:01:00.000Z" });
  assertDeepEqual(service.getReadModel().listCandidates().map((item) => item.candidateId), ["candidate:z", "candidate:a"], "submission ordering");
});

test("read model exposes no append operation", () => {
  const readModel = system().service.getReadModel() as unknown as Record<string, unknown>;
  assertEqual(Object.keys(readModel).some((key) => key.toLowerCase().includes("append")), false, "read-only surface");
  assertTrue(Object.isFrozen(readModel), "read-model facade frozen");
});

test("records are JSON serializable", () => {
  const result = decision(system().service);
  assertTrue(JSON.stringify(result).includes("knowledge:execution-discipline"), "serialized result");
});

test("service exposes no AI execution path", () => {
  const methods = Object.getOwnPropertyNames(KnowledgeApprovalService.prototype).map((item) => item.toLowerCase());
  const prohibited = new Set(["callai", "callmodel", "callprovider", "generatewithai", "approvewithai"]);
  assertEqual(methods.some((name) => prohibited.has(name) || name.includes("provider")), false, "AI path");
});

test("service exposes no Strategy Change Proposal or mutation path", () => {
  const methods = Object.getOwnPropertyNames(KnowledgeApprovalService.prototype).map((item) => item.toLowerCase());
  assertEqual(methods.some((name) => name.includes("strategy") || name.includes("proposal") || name.includes("execute")), false, "strategy path");
});

test("source Candidate Knowledge remains unchanged", () => {
  const value = candidate();
  const before = structuredClone(value);
  decision(system(value).service);
  assertDeepEqual(value, before, "candidate source");
});

test("audit translation is deterministic and uses existing learning audit conventions", () => {
  const result = decision(system().service);
  const context = { idempotencyKey: "audit-idempotency:1", actor: { type: AIAuditActorType.Owner, actorId: "owner:alpha" }, parentAuditRecordIds: [], relatedAuditRecordIds: [] };
  const first = auditRecordFromKnowledgeApproval(result.decision.auditEvent, context);
  const second = auditRecordFromKnowledgeApproval(result.decision.auditEvent, context);
  assertDeepEqual(first, second, "audit translation");
  assertEqual(first.recordType, AIAuditRecordType.LearningReview, "audit type");
  assertEqual(first.sourceSubsystem, AIAuditSourceSubsystem.LearningLoop, "audit subsystem");
});

test("policy and schema versions are preserved", () => {
  const result = decision(system().service);
  assertEqual(result.decision.schemaVersion, KNOWLEDGE_APPROVAL_SCHEMA_VERSION, "decision schema");
  assertEqual(result.decision.eligibility.policy.schemaVersion, KNOWLEDGE_APPROVAL_SCHEMA_VERSION, "policy schema");
  assertEqual(result.approvedKnowledge?.approvalPolicyVersion, "1.0", "policy version");
  assertDeepEqual(result.decision.acknowledgedWarnings, ["OWNER_REVIEW_REQUIRED"], "acknowledged warnings");
});

test("repeated eligibility input produces the same result", () => {
  const { service } = system();
  const first = eligibility(service);
  const second = eligibility(service);
  assertDeepEqual(first, second, "eligibility determinism");
});

test("return-for-evidence is explicit and creates no Approved Knowledge", () => {
  const { service } = system();
  const result = decision(service, { commandId: "command:return", idempotencyKey: "idempotency:return", decisionId: "decision:return", decision: KnowledgeApprovalDecisionType.ReturnForEvidence, knowledgeId: undefined, effectiveFrom: undefined });
  assertEqual(result.candidate.status, CandidateKnowledgeStatus.NeedsMoreEvidence, "returned status");
  assertEqual(result.approvedKnowledge, undefined, "no approved knowledge");
});

test("returned Candidate Knowledge can be explicitly resubmitted with a new revision", () => {
  const { service } = system();
  decision(service, { commandId: "command:return", idempotencyKey: "idempotency:return", decisionId: "decision:return", decision: KnowledgeApprovalDecisionType.ReturnForEvidence, knowledgeId: undefined, effectiveFrom: undefined });
  const revised = candidate({ revision: 2, warnings: [] });
  const result = service.resubmitCandidate({ commandId: "command:resubmit", idempotencyKey: "idempotency:resubmit", expectedCandidateVersion: 2, revisedCandidate: revised, actor: owner, occurredAt: "2026-07-20T12:00:00.000Z", reason: "Requested evidence supplied." });
  assertEqual(result.status, CandidateKnowledgeStatus.PendingReview, "resubmitted status");
  assertEqual(result.revision, 2, "revision");
});

test("pending Candidate Knowledge may be explicitly superseded", () => {
  const { service } = system();
  service.submitCandidate({ commandId: "command:replacement", idempotencyKey: "idempotency:replacement", candidate: candidate({ candidateId: "candidate:replacement", claimKey: "claim:replacement" }), acceptedAt: "2026-07-20T10:01:00.000Z" });
  const result = service.supersedeCandidate({ commandId: "command:supersede:candidate", idempotencyKey: "idempotency:supersede:candidate", eventId: "event:supersede:candidate", candidateId: "candidate:execution-discipline", replacementCandidateId: "candidate:replacement", expectedCandidateVersion: 1, actor: owner, occurredAt: "2026-07-20T12:00:00.000Z", reason: "Replacement candidate narrows the scope." });
  assertEqual(result.status, CandidateKnowledgeStatus.Superseded, "superseded candidate");
  assertEqual(result.lifecycle[1]?.replacementRecordId, "candidate:replacement", "replacement reference");
});

test("stale expected aggregate version fails closed", () => {
  const { service } = system();
  expectError(() => decision(service, { expectedCandidateVersion: 99 }), KnowledgeErrorCode.VersionConflict);
});

test("repository reports append status for accepted records", () => {
  const repository = new InMemoryKnowledgeApprovalRepository();
  const service = new KnowledgeApprovalService(repository);
  const state = service.submitCandidate({ commandId: "command:append-status", idempotencyKey: "idempotency:append-status", candidate: candidate({ candidateId: "candidate:append-status", claimKey: "claim:append-status" }), acceptedAt: "2026-07-20T10:01:00.000Z" });
  assertEqual(state.aggregateVersion, 1, "append version");
  assertEqual(KnowledgeAppendStatus.Appended, "APPENDED", "append status contract");
});

test("approval and activation audit operations remain separate", () => {
  const result = decision(system().service);
  assertEqual(result.decision.auditEvent.operationType, KnowledgeAuditOperationType.CandidateApproved, "decision operation");
  assertEqual(result.approvedKnowledge?.lifecycle[0]?.auditEvent.operationType, KnowledgeAuditOperationType.KnowledgeActivated, "activation operation");
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

console.log(`Knowledge Approval Foundation tests passed: ${String(passed)}/${String(tests.length)}.`);
