import {
  AIAuditRepositoryErrorCategory,
  AIAuditRepositoryType,
  validateAIAuditRecord,
  type AIAuditRecord,
  type AIAuditRepositoryAppendRequest,
  type AIAuditRepositoryAppendResult,
  type AIAuditRepositoryPort,
  type AIAuditRecordType,
  type AIAuditSourceSubsystem,
  type AITaskType,
  type PrivacyLevel,
} from "../contracts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sourceKey(
  subsystem: AIAuditSourceSubsystem,
  recordId: string,
  version?: string,
): string {
  return `${subsystem}\u0000${recordId}\u0000${version ?? ""}`;
}

export class InMemoryAIAuditRepository implements AIAuditRepositoryPort {
  readonly repositoryType: AIAuditRepositoryType =
    AIAuditRepositoryType.InMemory;
  private readonly records: AIAuditRecord[] = [];
  private readonly byId = new Map<string, AIAuditRecord>();
  private readonly byIdempotency = new Map<string, AIAuditRecord>();
  private readonly bySource = new Map<string, AIAuditRecord>();

  constructor(seedRecords: ReadonlyArray<AIAuditRecord> = []) {
    for (const record of seedRecords) this.importRecord(record);
  }

  appendAtomically(
    request: AIAuditRepositoryAppendRequest,
  ): AIAuditRepositoryAppendResult {
    if (this.byIdempotency.has(request.record.idempotencyKey)) {
      return {
        appended: false,
        conflictCategory: AIAuditRepositoryErrorCategory.IdempotencyConflict,
      };
    }
    if (this.byId.has(request.record.recordId)) {
      return {
        appended: false,
        conflictCategory: AIAuditRepositoryErrorCategory.DuplicateRecord,
      };
    }
    const identity = sourceKey(
      request.record.sourceSubsystem,
      request.record.sourceRecordId,
      request.record.sourceRecordVersion,
    );
    if (request.enforceSourceUniqueness && this.bySource.has(identity)) {
      return {
        appended: false,
        conflictCategory:
          AIAuditRepositoryErrorCategory.DuplicateSourceIdentity,
      };
    }
    const sequence = this.records.length + 1;
    if (!Number.isSafeInteger(sequence)) {
      return {
        appended: false,
        conflictCategory: AIAuditRepositoryErrorCategory.RepositoryConflict,
      };
    }
    const record: AIAuditRecord = {
      ...clone(request.record),
      sequence,
      importOrderStatus: request.importOrderStatus,
      payloadFingerprint: request.payloadFingerprint,
    };
    validateAIAuditRecord(record);
    this.persistRecord(record);
    this.store(record);
    return { appended: true, record: clone(record) };
  }

  protected persistRecord(_record: Readonly<AIAuditRecord>): void {}

  protected importRecord(record: Readonly<AIAuditRecord>): void {
    validateAIAuditRecord(record);
    if (record.sequence !== this.records.length + 1) {
      throw new Error("Audit seed contains a missing or duplicate sequence.");
    }
    if (
      this.byId.has(record.recordId) ||
      this.byIdempotency.has(record.idempotencyKey)
    ) {
      throw new Error("Audit seed contains a duplicate immutable identity.");
    }
    this.store(clone(record));
  }

  private store(record: AIAuditRecord): void {
    const stored = clone(record);
    this.records.push(stored);
    this.byId.set(stored.recordId, stored);
    this.byIdempotency.set(stored.idempotencyKey, stored);
    const identity = sourceKey(
      stored.sourceSubsystem,
      stored.sourceRecordId,
      stored.sourceRecordVersion,
    );
    if (!this.bySource.has(identity)) this.bySource.set(identity, stored);
  }

  getById(recordId: string): AIAuditRecord | undefined {
    const record = this.byId.get(recordId);
    return record === undefined ? undefined : clone(record);
  }

  getByIdempotencyKey(idempotencyKey: string): AIAuditRecord | undefined {
    const record = this.byIdempotency.get(idempotencyKey);
    return record === undefined ? undefined : clone(record);
  }

  getBySourceIdentity(
    subsystem: AIAuditSourceSubsystem,
    recordId: string,
    version?: string,
  ): AIAuditRecord | undefined {
    const record = this.bySource.get(sourceKey(subsystem, recordId, version));
    return record === undefined ? undefined : clone(record);
  }

  listBySequenceRange(from: number, to: number): ReadonlyArray<AIAuditRecord> {
    return this.records
      .filter((record) => record.sequence >= from && record.sequence <= to)
      .map(clone);
  }

  listByTimestampRange(from: string, to: string): ReadonlyArray<AIAuditRecord> {
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    return this.records
      .filter((record) => {
        const value = Date.parse(record.timestamp);
        return value >= fromMs && value <= toMs;
      })
      .map(clone);
  }

  listByRecordType(type: AIAuditRecordType): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.recordType === type).map(clone);
  }

  listBySourceSubsystem(
    subsystem: AIAuditSourceSubsystem,
  ): ReadonlyArray<AIAuditRecord> {
    return this.records
      .filter((record) => record.sourceSubsystem === subsystem)
      .map(clone);
  }

  listByRequestId(requestId: string): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.requestId === requestId).map(clone);
  }

  listByCorrelationId(correlationId: string): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.correlationId === correlationId).map(clone);
  }

  listByTraceId(traceId: string): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.traceId === traceId).map(clone);
  }

  listByReservationId(reservationId: string): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.reservationId === reservationId).map(clone);
  }

  listByExecutionId(executionId: string): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.executionId === executionId).map(clone);
  }

  listByLedgerEntryId(ledgerEntryId: string): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.ledgerEntryIds.includes(ledgerEntryId)).map(clone);
  }

  listByProviderModelTask(
    providerId?: string,
    modelId?: string,
    taskType?: AITaskType,
  ): ReadonlyArray<AIAuditRecord> {
    return this.records
      .filter(
        (record) =>
          (providerId === undefined || record.providerId === providerId) &&
          (modelId === undefined || record.modelId === modelId) &&
          (taskType === undefined || record.taskType === taskType),
      )
      .map(clone);
  }

  listByPrivacyLevel(privacy: PrivacyLevel): ReadonlyArray<AIAuditRecord> {
    return this.records.filter((record) => record.privacyLevel === privacy).map(clone);
  }

  latestSequence(): number {
    return this.records.length;
  }

  allRecords(): ReadonlyArray<AIAuditRecord> {
    return this.records.map(clone);
  }
}
