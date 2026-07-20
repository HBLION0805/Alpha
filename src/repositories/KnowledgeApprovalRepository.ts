import type {
  ApprovedKnowledge,
  ApprovedKnowledgeState,
  CandidateKnowledge,
  CandidateKnowledgeState,
  KnowledgeAppendResult,
  KnowledgeLifecycleEvent,
  KnowledgeOwnerDecisionRecord,
  KnowledgeReadModel,
} from "../contracts";

interface KnowledgeRepositoryEventBase {
  readonly schemaVersion: "1.0";
  readonly sequence: number;
  readonly fingerprint: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly acceptedAt: string;
}

export type KnowledgeRepositoryEvent =
  | (KnowledgeRepositoryEventBase & {
      readonly eventType: "CANDIDATE_SUBMITTED";
      readonly candidate: CandidateKnowledge;
      readonly lifecycle: KnowledgeLifecycleEvent;
    })
  | (KnowledgeRepositoryEventBase & {
      readonly eventType: "CANDIDATE_RESUBMITTED";
      readonly candidate: CandidateKnowledge;
      readonly lifecycle: KnowledgeLifecycleEvent;
    })
  | (KnowledgeRepositoryEventBase & {
      readonly eventType: "DECISION_RECORDED";
      readonly decision: KnowledgeOwnerDecisionRecord;
      readonly candidateLifecycle: KnowledgeLifecycleEvent;
      readonly approvedKnowledge?: ApprovedKnowledge;
      readonly knowledgeLifecycle?: KnowledgeLifecycleEvent;
    })
  | (KnowledgeRepositoryEventBase & {
      readonly eventType: "CANDIDATE_SUPERSEDED";
      readonly lifecycle: KnowledgeLifecycleEvent;
    })
  | (KnowledgeRepositoryEventBase & {
      readonly eventType: "KNOWLEDGE_TRANSITIONED";
      readonly lifecycle: KnowledgeLifecycleEvent;
    });

export interface KnowledgeApprovalRepository extends KnowledgeReadModel {
  appendCandidate(
    candidate: CandidateKnowledge,
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<CandidateKnowledgeState>;

  appendCandidateResubmission(
    candidate: CandidateKnowledge,
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<CandidateKnowledgeState>;

  appendDecision(
    decision: KnowledgeOwnerDecisionRecord,
    candidateLifecycle: KnowledgeLifecycleEvent,
    approvedKnowledge: ApprovedKnowledge | undefined,
    knowledgeLifecycle: KnowledgeLifecycleEvent | undefined,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<KnowledgeOwnerDecisionRecord>;

  appendCandidateSupersession(
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<CandidateKnowledgeState>;

  appendKnowledgeTransition(
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<ApprovedKnowledgeState>;

  getDecision(decisionId: string): KnowledgeOwnerDecisionRecord | undefined;
  findCandidateByClaimIdentity(claimIdentity: string): CandidateKnowledgeState | undefined;
  allEvents(): ReadonlyArray<KnowledgeRepositoryEvent>;
}
