import {
  AIAuditAppendStatus,
  AIAuditActorType,
  AIAuditExportDestination,
  AIAuditExportFormat,
  AIAuditExportStatus,
  AIAuditImportOrderStatus,
  AIAuditIntegrityIssueCode,
  AIAuditIntegrityStatus,
  AIAuditOperationType,
  AIAuditRecordType,
  AIAuditRetentionClassification,
  AIAuditRepositoryErrorCategory,
  AIAuditSourceSubsystem,
  AIAuditTraceEdgeType,
  AIAuditTraceStatus,
  AIAuditValidationStatus,
  PrivacyLevel,
  canonicalizeAIAuditValue,
  validateAIAuditExportEnums,
  validateAIAuditPolicy,
  validateAIAuditQuery,
  validateAIAuditRecord,
  validateAIAuditRecordInput,
  type AIAuditActor,
  type AIAuditAppendRequest,
  type AIAuditAppendResult,
  type AIAuditExportRequest,
  type AIAuditExportResult,
  type AIAuditIntegrityCheck,
  type AIAuditIntegrityCheckResult,
  type AIAuditIntegrityIssue,
  type AIAuditOperationAuditRecord,
  type AIAuditPolicy,
  type AIAuditQuery,
  type AIAuditQueryResult,
  type AIAuditRecord,
  type AIAuditRepository,
  type AIAuditRepositoryError,
  type AIAuditRepositoryPort,
  type AIAuditTrace,
  type AIAuditTraceEdge,
  type AIAuditTraceNode,
  type AIAuditTraceRequest,
  type AIAuditValidationCheck,
} from "../../contracts";

class AuditFailure extends Error {
  constructor(
    readonly category: AIAuditRepositoryErrorCategory,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

const SYSTEM_ACTOR: AIAuditActor = { type: AIAuditActorType.System };
const PRIVACY_RANK: Readonly<Record<PrivacyLevel, number>> = {
  [PrivacyLevel.Public]: 0,
  [PrivacyLevel.Internal]: 1,
  [PrivacyLevel.Sensitive]: 2,
  [PrivacyLevel.LocalOnly]: 3,
};
const TERMINAL_TYPES = new Set<AIAuditRecordType>([
  AIAuditRecordType.ExecutionCoordinatorResult,
  AIAuditRecordType.CostLedgerAppend,
  AIAuditRecordType.CostLedgerReconciliation,
  AIAuditRecordType.OwnerApproval,
  AIAuditRecordType.Error,
  AIAuditRecordType.RuntimeWorkflowResult,
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function validationCheck(name: string, passed: boolean, reason: string): AIAuditValidationCheck {
  return {
    name,
    status: passed ? AIAuditValidationStatus.Passed : AIAuditValidationStatus.Failed,
    reason,
  };
}

function errorFor(failure: unknown, occurredAt: string): AIAuditRepositoryError {
  if (failure instanceof AuditFailure) {
    return {
      category: failure.category,
      code: failure.code,
      safeMessage: failure.message,
      retryable: failure.retryable,
      occurredAt,
    };
  }
  return {
    category: AIAuditRepositoryErrorCategory.InvalidRequest,
    code: "AUDIT_VALIDATION_FAILED",
    safeMessage: failure instanceof Error ? failure.message : "Audit repository request failed validation.",
    retryable: false,
    occurredAt,
  };
}

function issue(
  code: AIAuditIntegrityIssueCode,
  reason: string,
  record?: AIAuditRecord,
  relatedRecordId?: string,
): AIAuditIntegrityIssue {
  return {
    code,
    ...(record === undefined ? {} : { recordId: record.recordId, sequence: record.sequence }),
    ...(relatedRecordId === undefined ? {} : { relatedRecordId }),
    reason,
  };
}

function stableIssues(issues: ReadonlyArray<AIAuditIntegrityIssue>): ReadonlyArray<AIAuditIntegrityIssue> {
  return [...issues].sort(
    (left, right) =>
      (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
      left.code.localeCompare(right.code) ||
      (left.relatedRecordId ?? "").localeCompare(right.relatedRecordId ?? ""),
  );
}

function operationAudit(
  repository: AIAuditRepositoryPort,
  operationId: string,
  operationType: AIAuditOperationType,
  timestamp: string,
  policyVersion: string,
  finalResult: AIAuditOperationAuditRecord["finalResult"],
  options: {
    readonly actor?: AIAuditActor;
    readonly recordId?: string;
    readonly validationChecks?: ReadonlyArray<AIAuditValidationCheck>;
    readonly idempotencyOutcome?: AIAuditOperationAuditRecord["idempotencyOutcome"];
    readonly assignedSequence?: number;
    readonly integrityIssues?: ReadonlyArray<AIAuditIntegrityIssue>;
    readonly exportRestrictions?: ReadonlyArray<string>;
    readonly error?: AIAuditRepositoryError;
  } = {},
): AIAuditOperationAuditRecord {
  return {
    operationId,
    operationType,
    timestamp,
    actor: clone(options.actor ?? SYSTEM_ACTOR),
    policyVersion,
    ...(options.recordId === undefined ? {} : { recordId: options.recordId }),
    validationChecks: clone(options.validationChecks ?? []),
    idempotencyOutcome: options.idempotencyOutcome ?? "NOT_APPLICABLE",
    ...(options.assignedSequence === undefined ? {} : { assignedSequence: options.assignedSequence }),
    repositoryType: repository.repositoryType,
    integrityIssues: clone(options.integrityIssues ?? []),
    exportRestrictions: clone(options.exportRestrictions ?? []),
    ...(options.error === undefined ? {} : { error: options.error }),
    finalResult,
  };
}

function sharesAny(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

function linkedMismatch(
  records: ReadonlyArray<AIAuditRecord>,
  resolve: (recordId: string) => AIAuditRecord | undefined,
): AIAuditIntegrityIssue[] {
  const issues: AIAuditIntegrityIssue[] = [];
  for (const record of records) {
    for (const parentId of record.parentAuditRecordIds) {
      const parent = resolve(parentId);
      if (parent === undefined) {
        issues.push(issue(AIAuditIntegrityIssueCode.MissingParent, "Parent audit record is missing.", record, parentId));
        continue;
      }
      if (record.requestId !== undefined && parent.requestId !== undefined && record.requestId !== parent.requestId) {
        issues.push(issue(AIAuditIntegrityIssueCode.RequestMismatch, "Linked records have different request IDs.", record, parentId));
      }
      if (record.correlationId !== parent.correlationId) {
        issues.push(issue(AIAuditIntegrityIssueCode.CorrelationMismatch, "Linked records have different correlation IDs.", record, parentId));
      }
      if (record.traceId !== parent.traceId) {
        issues.push(issue(AIAuditIntegrityIssueCode.TraceMismatch, "Linked records have different trace IDs.", record, parentId));
      }
      if (record.reservationId !== undefined && parent.reservationId !== undefined && record.reservationId !== parent.reservationId) {
        issues.push(issue(AIAuditIntegrityIssueCode.ReservationMismatch, "Linked records have different reservation IDs.", record, parentId));
      }
      if (record.executionId !== undefined && parent.executionId !== undefined && record.executionId !== parent.executionId) {
        issues.push(issue(AIAuditIntegrityIssueCode.ExecutionMismatch, "Linked records have different execution IDs.", record, parentId));
      }
      if (record.ledgerEntryIds.length > 0 && parent.ledgerEntryIds.length > 0 && !sharesAny(record.ledgerEntryIds, parent.ledgerEntryIds)) {
        issues.push(issue(AIAuditIntegrityIssueCode.LedgerReferenceMismatch, "Linked records have disjoint ledger references.", record, parentId));
      }
      if (PRIVACY_RANK[record.privacyLevel] < PRIVACY_RANK[parent.privacyLevel]) {
        issues.push(issue(AIAuditIntegrityIssueCode.PrivacyDowngrade, "Child record reduces the privacy level of parent evidence.", record, parentId));
      }
      for (const [policyName, version] of Object.entries(record.policyVersions)) {
        const parentVersion = parent.policyVersions[policyName];
        if (parentVersion !== undefined && parentVersion !== version) {
          issues.push(issue(AIAuditIntegrityIssueCode.PolicyVersionConflict, `Linked records disagree on ${policyName}.`, record, parentId));
        }
      }
      const validPredecessors: Partial<Readonly<Record<AIAuditSourceSubsystem, ReadonlyArray<AIAuditSourceSubsystem>>>> = {
        [AIAuditSourceSubsystem.Router]: [AIAuditSourceSubsystem.Router],
        [AIAuditSourceSubsystem.CostGovernor]: [AIAuditSourceSubsystem.Router, AIAuditSourceSubsystem.CostGovernor],
        [AIAuditSourceSubsystem.ReservationManager]: [AIAuditSourceSubsystem.CostGovernor, AIAuditSourceSubsystem.ExecutionCoordinator, AIAuditSourceSubsystem.ReservationManager, AIAuditSourceSubsystem.CostLedger],
        [AIAuditSourceSubsystem.ExecutionCoordinator]: [AIAuditSourceSubsystem.ReservationManager, AIAuditSourceSubsystem.CostLedger, AIAuditSourceSubsystem.ExecutionCoordinator],
        [AIAuditSourceSubsystem.ProviderAdapter]: [AIAuditSourceSubsystem.ExecutionCoordinator],
        [AIAuditSourceSubsystem.CostLedger]: [AIAuditSourceSubsystem.ReservationManager, AIAuditSourceSubsystem.ExecutionCoordinator, AIAuditSourceSubsystem.CostLedger],
      };
      const predecessors = validPredecessors[record.sourceSubsystem];
      if (predecessors !== undefined && !predecessors.includes(parent.sourceSubsystem)) {
        issues.push(issue(AIAuditIntegrityIssueCode.InvalidSubsystemOrder, "Parent subsystem is not a valid predecessor.", record, parentId));
      }
    }
    for (const relatedId of record.relatedAuditRecordIds) {
      if (resolve(relatedId) === undefined) {
        issues.push(issue(AIAuditIntegrityIssueCode.MissingRelatedRecord, "Related audit record is missing.", record, relatedId));
      }
    }
  }
  return issues;
}

function parentCycleIssues(
  records: ReadonlyArray<AIAuditRecord>,
  resolve: (recordId: string) => AIAuditRecord | undefined,
): AIAuditIntegrityIssue[] {
  const issues: AIAuditIntegrityIssue[] = [];
  const emitted = new Set<string>();
  for (const origin of records) {
    const visiting = new Set<string>();
    const walk = (record: AIAuditRecord): void => {
      if (visiting.has(record.recordId)) {
        if (!emitted.has(origin.recordId)) {
          emitted.add(origin.recordId);
          issues.push(issue(AIAuditIntegrityIssueCode.CyclicParentReference, "Parent references contain a cycle.", origin, record.recordId));
        }
        return;
      }
      visiting.add(record.recordId);
      for (const parentId of record.parentAuditRecordIds) {
        const parent = resolve(parentId);
        if (parent !== undefined) walk(parent);
      }
      visiting.delete(record.recordId);
    };
    walk(origin);
  }
  return issues;
}

function inspectRecords(
  records: ReadonlyArray<AIAuditRecord>,
  resolve: (recordId: string) => AIAuditRecord | undefined,
  checkCompleteSequence: boolean,
): ReadonlyArray<AIAuditIntegrityIssue> {
  const issues: AIAuditIntegrityIssue[] = [];
  const ids = new Set<string>();
  const sequences = new Set<number>();
  const idempotency = new Set<string>();
  const sources = new Set<string>();
  const traces = new Map<string, AIAuditRecord[]>();
  const ordered = [...records].sort((left, right) => left.sequence - right.sequence);
  for (const record of ordered) {
    if (!Object.values(AIAuditRetentionClassification).includes(record.retention)) {
      issues.push(issue(AIAuditIntegrityIssueCode.InvalidRetention, "Retention classification is invalid.", record));
    }
    if (
      record.error !== undefined &&
      (
        record.error.category.trim().length === 0 ||
        record.error.code.trim().length === 0 ||
        record.error.safeMessage.trim().length === 0 ||
        !Number.isFinite(Date.parse(record.error.occurredAt))
      )
    ) {
      issues.push(issue(AIAuditIntegrityIssueCode.MalformedError, "Normalized error metadata is malformed.", record));
    }
    try {
      validateAIAuditRecord(record);
    } catch {
      issues.push(issue(AIAuditIntegrityIssueCode.CorruptRecord, "Record contract validation failed.", record));
    }
    if (ids.has(record.recordId)) issues.push(issue(AIAuditIntegrityIssueCode.DuplicateRecordId, "Duplicate record ID.", record));
    ids.add(record.recordId);
    if (sequences.has(record.sequence)) issues.push(issue(AIAuditIntegrityIssueCode.DuplicateSequence, "Duplicate sequence.", record));
    sequences.add(record.sequence);
    if (idempotency.has(record.idempotencyKey)) issues.push(issue(AIAuditIntegrityIssueCode.DuplicateIdempotencyKey, "Duplicate idempotency key.", record));
    idempotency.add(record.idempotencyKey);
    const source = `${record.sourceSubsystem}\u0000${record.sourceRecordId}\u0000${record.sourceRecordVersion ?? ""}`;
    if (sources.has(source)) issues.push(issue(AIAuditIntegrityIssueCode.DuplicateSourceIdentity, "Duplicate source audit identity.", record));
    sources.add(source);
    const trace = traces.get(record.traceId) ?? [];
    trace.push(record);
    traces.set(record.traceId, trace);
  }
  if (checkCompleteSequence) {
    for (let index = 0; index < ordered.length; index += 1) {
      if (ordered[index]?.sequence !== index + 1) {
        issues.push(issue(AIAuditIntegrityIssueCode.SequenceInconsistency, "Sequence is not contiguous from one.", ordered[index]));
      }
    }
  }
  issues.push(...linkedMismatch(ordered, resolve));
  issues.push(...parentCycleIssues(ordered, resolve));
  for (const traceRecords of traces.values()) {
    if (!traceRecords.some((record) => TERMINAL_TYPES.has(record.recordType))) {
      const last = traceRecords[traceRecords.length - 1];
      issues.push(issue(AIAuditIntegrityIssueCode.TerminalResultMissing, "Trace has no terminal outcome record.", last));
    }
  }
  return stableIssues(issues);
}

function queryRecords(records: ReadonlyArray<AIAuditRecord>, query: Readonly<AIAuditQuery>): ReadonlyArray<AIAuditRecord> {
  const fromMs = query.fromTimestamp === undefined ? undefined : Date.parse(query.fromTimestamp);
  const toMs = query.toTimestamp === undefined ? undefined : Date.parse(query.toTimestamp);
  return records.filter((record) => {
    const timestamp = Date.parse(record.timestamp);
    return (
      (query.fromSequence === undefined || record.sequence >= query.fromSequence) &&
      (query.toSequence === undefined || record.sequence <= query.toSequence) &&
      (fromMs === undefined || timestamp >= fromMs) &&
      (toMs === undefined || timestamp <= toMs) &&
      (query.recordTypes === undefined || query.recordTypes.includes(record.recordType)) &&
      (query.sourceSubsystems === undefined || query.sourceSubsystems.includes(record.sourceSubsystem)) &&
      (query.requestId === undefined || record.requestId === query.requestId) &&
      (query.correlationId === undefined || record.correlationId === query.correlationId) &&
      (query.traceId === undefined || record.traceId === query.traceId) &&
      (query.reservationId === undefined || record.reservationId === query.reservationId) &&
      (query.executionId === undefined || record.executionId === query.executionId) &&
      (query.ledgerEntryId === undefined || record.ledgerEntryIds.includes(query.ledgerEntryId)) &&
      (query.providerId === undefined || record.providerId === query.providerId) &&
      (query.modelId === undefined || record.modelId === query.modelId) &&
      (query.taskType === undefined || record.taskType === query.taskType) &&
      (query.privacyLevels === undefined || query.privacyLevels.includes(record.privacyLevel))
    );
  });
}

export class DeterministicAIAuditRepository implements AIAuditRepository {
  constructor(private readonly storage: AIAuditRepositoryPort) {}

  append(request: Readonly<AIAuditAppendRequest>): AIAuditAppendResult {
    const checks: AIAuditValidationCheck[] = [];
    const occurredAt = request.record.timestamp;
    try {
      validateAIAuditPolicy(request.policy);
      checks.push(validationCheck("policy", true, "Audit policy is valid."));
      validateAIAuditRecordInput(request.record, request.policy);
      checks.push(validationCheck("record", true, "Audit record is valid."));
      const fingerprint = canonicalizeAIAuditValue(request.record);
      const replay = this.storage.getByIdempotencyKey(request.record.idempotencyKey);
      if (replay !== undefined) {
        if (replay.payloadFingerprint !== fingerprint) {
          throw new AuditFailure(AIAuditRepositoryErrorCategory.IdempotencyConflict, "AUDIT_IDEMPOTENCY_CONFLICT", "Idempotency key was already used for a different audit record.");
        }
        return {
          status: AIAuditAppendStatus.Appended,
          reasons: ["Existing append result returned for exact idempotent replay."],
          record: replay,
          operationAudit: operationAudit(this.storage, request.record.recordId, AIAuditOperationType.Append, occurredAt, request.policy.version, "REPLAYED", {
            actor: request.record.actor,
            recordId: replay.recordId,
            validationChecks: checks,
            idempotencyOutcome: "REPLAY",
            assignedSequence: replay.sequence,
          }),
        };
      }
      if (this.storage.getById(request.record.recordId) !== undefined) {
        throw new AuditFailure(AIAuditRepositoryErrorCategory.DuplicateRecord, "AUDIT_RECORD_ID_CONFLICT", "Audit record ID already exists.");
      }
      if (
        request.policy.requireUniqueSourceIdentity &&
        this.storage.getBySourceIdentity(request.record.sourceSubsystem, request.record.sourceRecordId, request.record.sourceRecordVersion) !== undefined
      ) {
        throw new AuditFailure(AIAuditRepositoryErrorCategory.DuplicateSourceIdentity, "AUDIT_SOURCE_IDENTITY_CONFLICT", "Source audit identity already exists.");
      }
      const traceRecords = this.storage.listByTraceId(request.record.traceId);
      const stale = traceRecords.some((record) => Date.parse(record.timestamp) > Date.parse(request.record.timestamp));
      if (stale && !request.policy.allowStaleImports) {
        throw new AuditFailure(AIAuditRepositoryErrorCategory.StaleRecord, "AUDIT_STALE_RECORD", "Record timestamp precedes existing evidence in the same trace.");
      }
      if (request.policy.preventPrivacyDowngrade) {
        for (const parentId of request.record.parentAuditRecordIds) {
          const parent = this.storage.getById(parentId);
          if (parent !== undefined && PRIVACY_RANK[request.record.privacyLevel] < PRIVACY_RANK[parent.privacyLevel]) {
            throw new AuditFailure(AIAuditRepositoryErrorCategory.PrivacyDowngrade, "AUDIT_PRIVACY_DOWNGRADE", "Record privacy level is lower than linked parent evidence.");
          }
        }
      }
      checks.push(validationCheck("append_constraints", true, "Idempotency, source identity, ordering, and privacy constraints passed."));
      const appended = this.storage.appendAtomically({
        record: request.record,
        importOrderStatus: stale ? AIAuditImportOrderStatus.StaleAllowed : AIAuditImportOrderStatus.InOrder,
        payloadFingerprint: fingerprint,
        enforceSourceUniqueness: request.policy.requireUniqueSourceIdentity,
      });
      if (!appended.appended || appended.record === undefined) {
        throw new AuditFailure(appended.conflictCategory ?? AIAuditRepositoryErrorCategory.RepositoryConflict, "AUDIT_ATOMIC_APPEND_CONFLICT", "Atomic audit append was rejected by the repository.", true);
      }
      return {
        status: AIAuditAppendStatus.Appended,
        reasons: ["Immutable audit record appended with a monotonic repository sequence."],
        record: appended.record,
        operationAudit: operationAudit(this.storage, request.record.recordId, AIAuditOperationType.Append, occurredAt, request.policy.version, "APPLIED", {
          actor: request.record.actor,
          recordId: request.record.recordId,
          validationChecks: checks,
          idempotencyOutcome: "NEW",
          assignedSequence: appended.record.sequence,
        }),
      };
    } catch (failure: unknown) {
      const error = errorFor(failure, occurredAt);
      checks.push(validationCheck("append", false, error.safeMessage));
      return {
        status: AIAuditAppendStatus.Rejected,
        reasons: [error.safeMessage],
        operationAudit: operationAudit(this.storage, request.record.recordId, AIAuditOperationType.Append, occurredAt, request.policy.version, "REJECTED", {
          actor: request.record.actor,
          recordId: request.record.recordId,
          validationChecks: checks,
          idempotencyOutcome: error.category === AIAuditRepositoryErrorCategory.IdempotencyConflict ? "CONFLICT" : "NEW",
          error,
        }),
        error,
      };
    }
  }

  query(query: Readonly<AIAuditQuery> = {}): AIAuditQueryResult {
    validateAIAuditQuery(query);
    const records = queryRecords(this.storage.allRecords(), query);
    return { records: clone(records), count: records.length, latestSequence: this.storage.latestSequence() };
  }

  reconstructTrace(request: Readonly<AIAuditTraceRequest>): AIAuditTrace {
    if ((request.traceId === undefined) === (request.rootRequestId === undefined)) {
      throw new Error("Trace reconstruction requires exactly one of traceId or rootRequestId.");
    }
    const direct = request.traceId !== undefined
      ? this.storage.listByTraceId(request.traceId)
      : this.storage.listByRequestId(request.rootRequestId as string);
    const selected = new Map<string, AIAuditRecord>(direct.map((record) => [record.recordId, record]));
    const missing = new Set<string>();
    const queue = [...direct];
    while (queue.length > 0) {
      const record = queue.shift() as AIAuditRecord;
      for (const reference of [...record.parentAuditRecordIds, ...record.relatedAuditRecordIds]) {
        if (selected.has(reference) || missing.has(reference)) continue;
        const linked = this.storage.getById(reference);
        if (linked === undefined) missing.add(reference);
        else {
          selected.set(reference, linked);
          queue.push(linked);
        }
      }
    }
    const records = [...selected.values()].sort((left, right) => left.sequence - right.sequence);
    const issues = inspectRecords(records, (id) => this.storage.getById(id), false);
    const nodes: AIAuditTraceNode[] = records.map((record) => ({
      recordId: record.recordId,
      missing: false,
      sequence: record.sequence,
      recordType: record.recordType,
      sourceSubsystem: record.sourceSubsystem,
      finalOutcome: record.finalOutcome,
    }));
    nodes.push(...[...missing].sort().map((recordId) => ({ recordId, missing: true })));
    const edges: AIAuditTraceEdge[] = [];
    for (const record of records) {
      for (const parentId of record.parentAuditRecordIds) edges.push({ fromRecordId: parentId, toRecordId: record.recordId, type: AIAuditTraceEdgeType.Parent });
      for (const relatedId of record.relatedAuditRecordIds) edges.push({ fromRecordId: record.recordId, toRecordId: relatedId, type: AIAuditTraceEdgeType.Related });
    }
    edges.sort((left, right) => left.fromRecordId.localeCompare(right.fromRecordId) || left.toRecordId.localeCompare(right.toRecordId) || left.type.localeCompare(right.type));
    const childIds = new Set(edges.filter((edge) => edge.type === AIAuditTraceEdgeType.Parent).map((edge) => edge.toRecordId));
    const parentIds = new Set(edges.filter((edge) => edge.type === AIAuditTraceEdgeType.Parent).map((edge) => edge.fromRecordId));
    const inconsistent = issues.some((value) => ![AIAuditIntegrityIssueCode.MissingParent, AIAuditIntegrityIssueCode.MissingRelatedRecord, AIAuditIntegrityIssueCode.TerminalResultMissing].includes(value.code));
    const status = records.length === 0
      ? AIAuditTraceStatus.Empty
      : inconsistent
        ? AIAuditTraceStatus.Inconsistent
        : issues.length > 0
          ? AIAuditTraceStatus.Incomplete
          : AIAuditTraceStatus.Complete;
    const final = records[records.length - 1];
    const progression = records.reduce<AIAuditSourceSubsystem[]>((values, record) => {
      if (!values.includes(record.sourceSubsystem)) values.push(record.sourceSubsystem);
      return values;
    }, []);
    return {
      status,
      ...((request.traceId ?? direct[0]?.traceId) === undefined ? {} : { traceId: request.traceId ?? direct[0]?.traceId as string }),
      ...((request.rootRequestId ?? direct[0]?.requestId) === undefined ? {} : { rootRequestId: request.rootRequestId ?? direct[0]?.requestId as string }),
      nodes,
      edges,
      rootRecordIds: nodes.filter((node) => !node.missing && !childIds.has(node.recordId)).map((node) => node.recordId),
      leafRecordIds: nodes.filter((node) => !node.missing && !parentIds.has(node.recordId)).map((node) => node.recordId),
      subsystemProgression: progression,
      issues,
      ...(final === undefined ? {} : { finalOutcome: final.finalOutcome }),
      operationAudit: operationAudit(this.storage, request.operationId, AIAuditOperationType.Trace, request.requestedAt, request.policyVersion, status === AIAuditTraceStatus.Complete ? "COMPLETE" : status === AIAuditTraceStatus.Inconsistent ? "INCONSISTENT" : "INCOMPLETE", { integrityIssues: issues }),
    };
  }

  checkIntegrity(request: Readonly<AIAuditIntegrityCheck>): AIAuditIntegrityCheckResult {
    const records = request.query === undefined ? this.storage.allRecords() : this.query(request.query).records;
    const issues = inspectRecords(records, (id) => this.storage.getById(id), request.query === undefined);
    const status = issues.length === 0 ? AIAuditIntegrityStatus.Valid : AIAuditIntegrityStatus.IssuesDetected;
    return {
      status,
      checkedRecordCount: records.length,
      issues,
      operationAudit: operationAudit(this.storage, request.operationId, AIAuditOperationType.Integrity, request.requestedAt, request.policyVersion, status === AIAuditIntegrityStatus.Valid ? "VALID" : "ISSUES", { integrityIssues: issues }),
    };
  }

  exportSnapshot(request: Readonly<AIAuditExportRequest>, policy: Readonly<AIAuditPolicy>): AIAuditExportResult {
    const restrictions: string[] = [];
    try {
      validateAIAuditPolicy(policy);
      validateAIAuditQuery(request.query);
      validateAIAuditExportEnums(request.format, request.destination);
      const records = this.query(request.query).records;
      if (request.destination === AIAuditExportDestination.ExternalTransfer) {
        if (!policy.allowExternalExports) restrictions.push("Policy forbids external audit exports.");
        if (records.some((record) => record.privacyLevel === PrivacyLevel.LocalOnly)) restrictions.push("LOCAL_ONLY records cannot leave local storage.");
        if (records.some((record) => record.privacyLevel === PrivacyLevel.Sensitive) && policy.requireSensitiveExportAuthorization && (request.sensitiveAuthorizationReference === undefined || !policy.sensitiveExportAuthorizationReferences.includes(request.sensitiveAuthorizationReference))) {
          restrictions.push("SENSITIVE records require an authorized export reference.");
        }
      }
      if (restrictions.length > 0) {
        const category = restrictions.some((value) => value.includes("SENSITIVE")) ? AIAuditRepositoryErrorCategory.SensitiveExportUnauthorized : AIAuditRepositoryErrorCategory.ExportRestricted;
        throw new AuditFailure(category, "AUDIT_EXPORT_RESTRICTED", restrictions.join(" "));
      }
      const serialized = request.format === AIAuditExportFormat.Ndjson
        ? records.map(canonicalizeAIAuditValue).join("\n") + (records.length === 0 ? "" : "\n")
        : canonicalizeAIAuditValue(records);
      return {
        status: AIAuditExportStatus.Exported,
        schemaVersion: "1.0",
        exportedAt: request.requestedAt,
        format: request.format,
        records,
        serialized,
        operationAudit: operationAudit(this.storage, request.operationId, AIAuditOperationType.Export, request.requestedAt, request.policyVersion, "EXPORTED"),
      };
    } catch (failure: unknown) {
      const error = errorFor(failure, request.requestedAt);
      return {
        status: AIAuditExportStatus.Rejected,
        schemaVersion: "1.0",
        exportedAt: request.requestedAt,
        format: request.format,
        records: [],
        operationAudit: operationAudit(this.storage, request.operationId, AIAuditOperationType.Export, request.requestedAt, request.policyVersion, "REJECTED", { exportRestrictions: restrictions, error }),
        error,
      };
    }
  }
}
