import {
  ApprovedKnowledgeStatus,
  CandidateKnowledgeStatus,
  KnowledgeAppendStatus,
  KnowledgeErrorCode,
  KnowledgeLifecycleRecordType,
  type ApprovedKnowledge,
  type ApprovedKnowledgeState,
  type CandidateKnowledge,
  type CandidateKnowledgeState,
  type KnowledgeAppendResult,
  type KnowledgeLifecycleEvent,
  type KnowledgeOwnerDecisionRecord,
  type KnowledgeScope,
} from "../contracts";
import type { KnowledgeApprovalRepository, KnowledgeRepositoryEvent } from "./KnowledgeApprovalRepository";

const clone = <T>(value: T): T => structuredClone(value);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

const frozenClone = <T>(value: T): T => deepFreeze(clone(value));

function fail(code: KnowledgeErrorCode, message: string): never {
  throw new Error(`${code}: ${message}`);
}

export function canonicalizeKnowledgeValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeKnowledgeValue).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, nested]) => nested !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalizeKnowledgeValue(nested)}`).join(",")}}`;
}

export function knowledgeFingerprint(value: unknown): string {
  const input = canonicalizeKnowledgeValue(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function normalizedScope(scope: KnowledgeScope): KnowledgeScope {
  const sorted = (values: ReadonlyArray<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    scopeType: scope.scopeType,
    ...(scope.strategyFamily === undefined ? {} : { strategyFamily: scope.strategyFamily }),
    markets: sorted(scope.markets),
    instruments: sorted(scope.instruments),
    strategyVersionIds: sorted(scope.strategyVersionIds),
    tags: sorted(scope.tags),
  };
}

export function knowledgeClaimIdentity(candidate: Pick<CandidateKnowledge, "candidateType" | "claimKey" | "scope">): string {
  return canonicalizeKnowledgeValue({
    candidateType: candidate.candidateType,
    claimKey: candidate.claimKey,
    scope: normalizedScope(candidate.scope),
  });
}

type EventInput = KnowledgeRepositoryEvent extends infer T
  ? T extends KnowledgeRepositoryEvent
    ? Omit<T, "sequence" | "fingerprint">
    : never
  : never;

export class InMemoryKnowledgeApprovalRepository implements KnowledgeApprovalRepository {
  private readonly candidates = new Map<string, CandidateKnowledgeState>();
  private readonly candidateSequences = new Map<string, number>();
  private readonly claimIdentities = new Map<string, string>();
  private readonly knowledge = new Map<string, ApprovedKnowledgeState>();
  private readonly knowledgeSequences = new Map<string, number>();
  private readonly decisions = new Map<string, KnowledgeOwnerDecisionRecord>();
  private readonly commandIds = new Set<string>();
  private readonly idempotencyKeys = new Set<string>();
  private readonly events: KnowledgeRepositoryEvent[] = [];

  private nextSequence(): number {
    const sequence = this.events.length + 1;
    if (!Number.isSafeInteger(sequence)) fail(KnowledgeErrorCode.RepositoryCorrupt, "repository sequence overflow.");
    return sequence;
  }

  private makeEvent<T extends EventInput>(input: T): T & Pick<KnowledgeRepositoryEvent, "sequence" | "fingerprint"> {
    const withSequence = { ...clone(input), sequence: this.nextSequence() };
    return { ...withSequence, fingerprint: knowledgeFingerprint(withSequence) } as T & Pick<KnowledgeRepositoryEvent, "sequence" | "fingerprint">;
  }

  private assertCommandAvailable(commandId: string, idempotencyKey: string): void {
    if (this.commandIds.has(commandId)) fail(KnowledgeErrorCode.DuplicateCommand, "command ID already exists.");
    if (this.idempotencyKeys.has(idempotencyKey)) fail(KnowledgeErrorCode.IdempotencyConflict, "idempotency key already exists.");
  }

  private commit(event: KnowledgeRepositoryEvent): void {
    if (event.sequence !== this.nextSequence()) fail(KnowledgeErrorCode.RepositoryCorrupt, "repository sequence is not contiguous.");
    const expected = knowledgeFingerprint({ ...event, fingerprint: undefined });
    if (event.fingerprint !== expected) fail(KnowledgeErrorCode.RepositoryCorrupt, "repository event fingerprint is invalid.");
    this.events.push(clone(event));
    this.commandIds.add(event.commandId);
    this.idempotencyKeys.add(event.idempotencyKey);
  }

  appendCandidate(
    candidate: CandidateKnowledge,
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<CandidateKnowledgeState> {
    this.assertCommandAvailable(commandId, idempotencyKey);
    if (this.candidates.has(candidate.candidateId)) fail(KnowledgeErrorCode.DuplicateId, "candidate ID already exists.");
    const claimIdentity = knowledgeClaimIdentity(candidate);
    if (this.claimIdentities.has(claimIdentity)) fail(KnowledgeErrorCode.DuplicateClaim, "exact candidate claim identity already exists.");
    if (lifecycle.recordType !== KnowledgeLifecycleRecordType.Candidate || lifecycle.recordId !== candidate.candidateId || lifecycle.aggregateVersion !== 1 || lifecycle.fromStatus !== undefined || lifecycle.toStatus !== CandidateKnowledgeStatus.PendingReview) {
      fail(KnowledgeErrorCode.InvalidLifecycle, "candidate submission lifecycle is invalid.");
    }
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "CANDIDATE_SUBMITTED", commandId, idempotencyKey, acceptedAt, candidate: clone(candidate), lifecycle: clone(lifecycle) });
    this.commit(event);
    const state = { ...clone(candidate), status: CandidateKnowledgeStatus.PendingReview, aggregateVersion: 1, lifecycle: [clone(lifecycle)] } satisfies CandidateKnowledgeState;
    this.candidates.set(candidate.candidateId, state);
    this.candidateSequences.set(candidate.candidateId, event.sequence);
    this.claimIdentities.set(claimIdentity, candidate.candidateId);
    return frozenClone({ status: KnowledgeAppendStatus.Appended, record: state, repositorySequences: [event.sequence] });
  }

  appendCandidateResubmission(
    candidate: CandidateKnowledge,
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<CandidateKnowledgeState> {
    this.assertCommandAvailable(commandId, idempotencyKey);
    const current = this.candidates.get(candidate.candidateId);
    if (current === undefined) fail(KnowledgeErrorCode.CandidateNotFound, "candidate does not exist.");
    if (current.status !== CandidateKnowledgeStatus.NeedsMoreEvidence || candidate.revision !== current.revision + 1 || knowledgeClaimIdentity(candidate) !== knowledgeClaimIdentity(current)) {
      fail(KnowledgeErrorCode.InvalidLifecycle, "candidate resubmission is invalid.");
    }
    this.assertLifecycle(lifecycle, KnowledgeLifecycleRecordType.Candidate, candidate.candidateId, current.aggregateVersion, current.status, CandidateKnowledgeStatus.PendingReview);
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "CANDIDATE_RESUBMITTED", commandId, idempotencyKey, acceptedAt, candidate: clone(candidate), lifecycle: clone(lifecycle) });
    this.commit(event);
    const state = { ...clone(candidate), status: CandidateKnowledgeStatus.PendingReview, aggregateVersion: lifecycle.aggregateVersion, lifecycle: [...current.lifecycle.map(clone), clone(lifecycle)] } satisfies CandidateKnowledgeState;
    this.candidates.set(candidate.candidateId, state);
    return frozenClone({ status: KnowledgeAppendStatus.Appended, record: state, repositorySequences: [event.sequence] });
  }

  appendDecision(
    decision: KnowledgeOwnerDecisionRecord,
    candidateLifecycle: KnowledgeLifecycleEvent,
    approvedKnowledge: ApprovedKnowledge | undefined,
    knowledgeLifecycle: KnowledgeLifecycleEvent | undefined,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<KnowledgeOwnerDecisionRecord> {
    this.assertCommandAvailable(commandId, idempotencyKey);
    if (this.decisions.has(decision.decisionId)) fail(KnowledgeErrorCode.DuplicateId, "decision ID already exists.");
    const current = this.candidates.get(decision.candidateId);
    if (current === undefined) fail(KnowledgeErrorCode.CandidateNotFound, "candidate does not exist.");
    this.assertLifecycle(candidateLifecycle, KnowledgeLifecycleRecordType.Candidate, current.candidateId, current.aggregateVersion, current.status, candidateLifecycle.toStatus);
    if (approvedKnowledge === undefined !== (knowledgeLifecycle === undefined)) fail(KnowledgeErrorCode.InvalidRecord, "approved knowledge and lifecycle must be supplied together.");
    if (approvedKnowledge !== undefined && knowledgeLifecycle !== undefined) {
      if (this.knowledge.has(approvedKnowledge.knowledgeId)) fail(KnowledgeErrorCode.DuplicateId, "approved knowledge ID already exists.");
      this.assertLifecycle(knowledgeLifecycle, KnowledgeLifecycleRecordType.ApprovedKnowledge, approvedKnowledge.knowledgeId, 0, undefined, ApprovedKnowledgeStatus.Active);
    }
    const event = this.makeEvent({
      schemaVersion: "1.0",
      eventType: "DECISION_RECORDED",
      commandId,
      idempotencyKey,
      acceptedAt,
      decision: clone(decision),
      candidateLifecycle: clone(candidateLifecycle),
      ...(approvedKnowledge === undefined ? {} : { approvedKnowledge: clone(approvedKnowledge) }),
      ...(knowledgeLifecycle === undefined ? {} : { knowledgeLifecycle: clone(knowledgeLifecycle) }),
    });
    this.commit(event);
    const candidateState = { ...clone(current), status: candidateLifecycle.toStatus as CandidateKnowledgeStatus, aggregateVersion: candidateLifecycle.aggregateVersion, lifecycle: [...current.lifecycle.map(clone), clone(candidateLifecycle)] } satisfies CandidateKnowledgeState;
    this.candidates.set(current.candidateId, candidateState);
    this.decisions.set(decision.decisionId, clone(decision));
    if (approvedKnowledge !== undefined && knowledgeLifecycle !== undefined) {
      const knowledgeState = { ...clone(approvedKnowledge), status: ApprovedKnowledgeStatus.Active, aggregateVersion: 1, lifecycle: [clone(knowledgeLifecycle)] } satisfies ApprovedKnowledgeState;
      this.knowledge.set(approvedKnowledge.knowledgeId, knowledgeState);
      this.knowledgeSequences.set(approvedKnowledge.knowledgeId, event.sequence);
    }
    return frozenClone({ status: KnowledgeAppendStatus.Appended, record: decision, repositorySequences: [event.sequence] });
  }

  appendCandidateSupersession(
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<CandidateKnowledgeState> {
    this.assertCommandAvailable(commandId, idempotencyKey);
    const current = this.candidates.get(lifecycle.recordId);
    if (current === undefined) fail(KnowledgeErrorCode.CandidateNotFound, "candidate does not exist.");
    if (lifecycle.replacementRecordId === undefined || !this.candidates.has(lifecycle.replacementRecordId)) fail(KnowledgeErrorCode.ReplacementRequired, "replacement candidate must exist.");
    this.assertLifecycle(lifecycle, KnowledgeLifecycleRecordType.Candidate, current.candidateId, current.aggregateVersion, current.status, CandidateKnowledgeStatus.Superseded);
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "CANDIDATE_SUPERSEDED", commandId, idempotencyKey, acceptedAt, lifecycle: clone(lifecycle) });
    this.commit(event);
    const state = { ...clone(current), status: CandidateKnowledgeStatus.Superseded, aggregateVersion: lifecycle.aggregateVersion, lifecycle: [...current.lifecycle.map(clone), clone(lifecycle)] } satisfies CandidateKnowledgeState;
    this.candidates.set(current.candidateId, state);
    return frozenClone({ status: KnowledgeAppendStatus.Appended, record: state, repositorySequences: [event.sequence] });
  }

  appendKnowledgeTransition(
    lifecycle: KnowledgeLifecycleEvent,
    commandId: string,
    idempotencyKey: string,
    acceptedAt: string,
  ): KnowledgeAppendResult<ApprovedKnowledgeState> {
    this.assertCommandAvailable(commandId, idempotencyKey);
    const current = this.knowledge.get(lifecycle.recordId);
    if (current === undefined) fail(KnowledgeErrorCode.KnowledgeNotFound, "approved knowledge does not exist.");
    if (lifecycle.toStatus === ApprovedKnowledgeStatus.Superseded) {
      const replacement = lifecycle.replacementRecordId === undefined ? undefined : this.knowledge.get(lifecycle.replacementRecordId);
      if (replacement === undefined || replacement.status !== ApprovedKnowledgeStatus.Active) fail(KnowledgeErrorCode.ReplacementRequired, "active replacement knowledge must exist.");
    }
    this.assertLifecycle(lifecycle, KnowledgeLifecycleRecordType.ApprovedKnowledge, current.knowledgeId, current.aggregateVersion, current.status, lifecycle.toStatus);
    const event = this.makeEvent({ schemaVersion: "1.0", eventType: "KNOWLEDGE_TRANSITIONED", commandId, idempotencyKey, acceptedAt, lifecycle: clone(lifecycle) });
    this.commit(event);
    const state = { ...clone(current), status: lifecycle.toStatus as ApprovedKnowledgeStatus, aggregateVersion: lifecycle.aggregateVersion, lifecycle: [...current.lifecycle.map(clone), clone(lifecycle)] } satisfies ApprovedKnowledgeState;
    this.knowledge.set(current.knowledgeId, state);
    return frozenClone({ status: KnowledgeAppendStatus.Appended, record: state, repositorySequences: [event.sequence] });
  }

  private assertLifecycle(
    lifecycle: KnowledgeLifecycleEvent,
    recordType: KnowledgeLifecycleRecordType,
    recordId: string,
    currentVersion: number,
    currentStatus: CandidateKnowledgeStatus | ApprovedKnowledgeStatus | undefined,
    expectedToStatus: CandidateKnowledgeStatus | ApprovedKnowledgeStatus,
  ): void {
    if (lifecycle.recordType !== recordType || lifecycle.recordId !== recordId || lifecycle.aggregateVersion !== currentVersion + 1 || lifecycle.fromStatus !== currentStatus || lifecycle.toStatus !== expectedToStatus) {
      fail(KnowledgeErrorCode.VersionConflict, "lifecycle aggregate version or status is stale.");
    }
  }

  getCandidate(candidateId: string): CandidateKnowledgeState | undefined {
    const value = this.candidates.get(candidateId);
    return value === undefined ? undefined : frozenClone(value);
  }

  getApprovedKnowledge(knowledgeId: string): ApprovedKnowledgeState | undefined {
    const value = this.knowledge.get(knowledgeId);
    return value === undefined ? undefined : frozenClone(value);
  }

  getDecision(decisionId: string): KnowledgeOwnerDecisionRecord | undefined {
    const value = this.decisions.get(decisionId);
    return value === undefined ? undefined : frozenClone(value);
  }

  findCandidateByClaimIdentity(claimIdentity: string): CandidateKnowledgeState | undefined {
    const candidateId = this.claimIdentities.get(claimIdentity);
    return candidateId === undefined ? undefined : this.getCandidate(candidateId);
  }

  listCandidates(): ReadonlyArray<CandidateKnowledgeState> {
    return [...this.candidates.values()]
      .sort((left, right) => (this.candidateSequences.get(left.candidateId) as number) - (this.candidateSequences.get(right.candidateId) as number))
      .map(frozenClone);
  }

  listApprovedKnowledge(): ReadonlyArray<ApprovedKnowledgeState> {
    return [...this.knowledge.values()]
      .sort((left, right) => (this.knowledgeSequences.get(left.knowledgeId) as number) - (this.knowledgeSequences.get(right.knowledgeId) as number))
      .map(frozenClone);
  }

  listCurrentApprovedKnowledge(): ReadonlyArray<ApprovedKnowledgeState> {
    return this.listApprovedKnowledge().filter((value) => value.status === ApprovedKnowledgeStatus.Active);
  }

  getCandidateHistory(candidateId: string): ReadonlyArray<KnowledgeLifecycleEvent> {
    return this.getCandidate(candidateId)?.lifecycle ?? [];
  }

  getApprovedKnowledgeHistory(knowledgeId: string): ReadonlyArray<KnowledgeLifecycleEvent> {
    return this.getApprovedKnowledge(knowledgeId)?.lifecycle ?? [];
  }

  allEvents(): ReadonlyArray<KnowledgeRepositoryEvent> {
    return this.events.map(frozenClone);
  }
}
