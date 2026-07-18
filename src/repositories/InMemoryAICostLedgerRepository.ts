import {
  AICostLedgerEntryType,
  AICostLedgerErrorCategory,
  AICostLedgerRepositoryType,
  validateAICostLedgerEntry,
  type AICostLedgerEntry,
  type AICostLedgerRepository,
  type AICostLedgerRepositoryAppendRequest,
  type AICostLedgerRepositoryAppendResult,
  type AITaskType,
} from "../contracts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isUsageSettlement(entry: AICostLedgerEntry): boolean {
  return [
    AICostLedgerEntryType.UsagePartiallyCommitted,
    AICostLedgerEntryType.UsageCommitted,
  ].includes(entry.entryType);
}

export class InMemoryAICostLedgerRepository
  implements AICostLedgerRepository
{
  readonly repositoryType: AICostLedgerRepositoryType =
    AICostLedgerRepositoryType.InMemory;

  private readonly entries: AICostLedgerEntry[] = [];
  private readonly byId = new Map<string, AICostLedgerEntry>();
  private readonly byIdempotency = new Map<string, AICostLedgerEntry>();
  private readonly byOperation = new Map<string, AICostLedgerEntry>();
  private readonly usageByExecution = new Map<string, AICostLedgerEntry>();

  constructor(seedEntries: ReadonlyArray<AICostLedgerEntry> = []) {
    for (const entry of seedEntries) this.importEntry(entry);
  }

  appendAtomically(
    request: AICostLedgerRepositoryAppendRequest,
  ): AICostLedgerRepositoryAppendResult {
    if (this.byIdempotency.has(request.entry.idempotencyKey)) {
      return {
        appended: false,
        conflictCategory: AICostLedgerErrorCategory.IdempotencyConflict,
      };
    }
    if (this.byId.has(request.entry.entryId)) {
      return {
        appended: false,
        conflictCategory: AICostLedgerErrorCategory.DuplicateEntry,
      };
    }
    if (this.byOperation.has(request.entry.operationId)) {
      return {
        appended: false,
        conflictCategory: AICostLedgerErrorCategory.DuplicateOperation,
      };
    }
    if (
      request.entry.executionId !== undefined &&
      [
        AICostLedgerEntryType.UsagePartiallyCommitted,
        AICostLedgerEntryType.UsageCommitted,
      ].includes(request.entry.entryType) &&
      this.usageByExecution.has(request.entry.executionId)
    ) {
      return {
        appended: false,
        conflictCategory:
          AICostLedgerErrorCategory.DuplicateExecutionSettlement,
      };
    }
    const sequence = this.entries.length + 1;
    if (!Number.isSafeInteger(sequence)) {
      return {
        appended: false,
        conflictCategory: AICostLedgerErrorCategory.RepositoryConflict,
      };
    }
    const entry: AICostLedgerEntry = {
      ...clone(request.entry),
      sequence,
      businessOrderStatus: request.businessOrderStatus,
      payloadFingerprint: request.payloadFingerprint,
    };
    validateAICostLedgerEntry(entry);
    this.persistEntry(entry);
    this.store(entry);
    return { appended: true, entry: clone(entry) };
  }

  protected persistEntry(_entry: Readonly<AICostLedgerEntry>): void {}

  protected importEntry(entry: Readonly<AICostLedgerEntry>): void {
    validateAICostLedgerEntry(entry);
    if (entry.sequence !== this.entries.length + 1) {
      throw new Error("Ledger seed contains a missing or duplicate sequence.");
    }
    if (
      this.byId.has(entry.entryId) ||
      this.byIdempotency.has(entry.idempotencyKey) ||
      this.byOperation.has(entry.operationId) ||
      (entry.executionId !== undefined &&
        isUsageSettlement(entry) &&
        this.usageByExecution.has(entry.executionId))
    ) {
      throw new Error("Ledger seed contains a duplicate immutable identity.");
    }
    this.store(clone(entry));
  }

  private store(entry: AICostLedgerEntry): void {
    const stored = clone(entry);
    this.entries.push(stored);
    this.byId.set(stored.entryId, stored);
    this.byIdempotency.set(stored.idempotencyKey, stored);
    this.byOperation.set(stored.operationId, stored);
    if (stored.executionId !== undefined && isUsageSettlement(stored)) {
      this.usageByExecution.set(stored.executionId, stored);
    }
  }

  getById(entryId: string): AICostLedgerEntry | undefined {
    const entry = this.byId.get(entryId);
    return entry === undefined ? undefined : clone(entry);
  }

  getByIdempotencyKey(idempotencyKey: string): AICostLedgerEntry | undefined {
    const entry = this.byIdempotency.get(idempotencyKey);
    return entry === undefined ? undefined : clone(entry);
  }

  getBySourceOperationId(operationId: string): AICostLedgerEntry | undefined {
    const entry = this.byOperation.get(operationId);
    return entry === undefined ? undefined : clone(entry);
  }

  listBySequenceRange(
    fromInclusive: number,
    toInclusive: number,
  ): ReadonlyArray<AICostLedgerEntry> {
    return this.entries
      .filter(
        (entry) =>
          entry.sequence >= fromInclusive && entry.sequence <= toInclusive,
      )
      .map(clone);
  }

  listByRequestId(requestId: string): ReadonlyArray<AICostLedgerEntry> {
    return this.entries
      .filter((entry) => entry.requestId === requestId)
      .map(clone);
  }

  listByReservationId(reservationId: string): ReadonlyArray<AICostLedgerEntry> {
    return this.entries
      .filter((entry) => entry.reservationId === reservationId)
      .map(clone);
  }

  listByExecutionId(executionId: string): ReadonlyArray<AICostLedgerEntry> {
    return this.entries
      .filter((entry) => entry.executionId === executionId)
      .map(clone);
  }

  listByTimestampRange(
    fromInclusive: string,
    toInclusive: string,
  ): ReadonlyArray<AICostLedgerEntry> {
    const from = Date.parse(fromInclusive);
    const to = Date.parse(toInclusive);
    return this.entries
      .filter((entry) => {
        const value = Date.parse(entry.timestamp);
        return value >= from && value <= to;
      })
      .map(clone);
  }

  listByProviderModelTask(
    providerId?: string,
    modelId?: string,
    taskType?: AITaskType,
  ): ReadonlyArray<AICostLedgerEntry> {
    return this.entries
      .filter(
        (entry) =>
          (providerId === undefined || entry.providerId === providerId) &&
          (modelId === undefined || entry.modelId === modelId) &&
          (taskType === undefined || entry.taskType === taskType),
      )
      .map(clone);
  }

  latestSequence(): number {
    return this.entries.length;
  }

  allEntries(): ReadonlyArray<AICostLedgerEntry> {
    return this.entries.map(clone);
  }
}
