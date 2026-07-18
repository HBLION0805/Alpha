import {
  AIReservationState,
  type AIReservationCompareAndSetResult,
  type AIReservationOperation,
  type AIReservationRecord,
  type AIReservationRepository,
} from "../contracts";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameIdentity(
  left: AIReservationRecord,
  right: AIReservationRecord,
): boolean {
  return (
    left.reservationId === right.reservationId &&
    left.requestId === right.requestId &&
    left.costGovernorDecisionId === right.costGovernorDecisionId &&
    left.reservedAmount.currency === right.reservedAmount.currency &&
    left.reservedAmount.minorUnits === right.reservedAmount.minorUnits &&
    left.createdAt === right.createdAt &&
    left.expiresAt === right.expiresAt &&
    left.policyVersion === right.policyVersion
  );
}

export class InMemoryAIReservationRepository
  implements AIReservationRepository
{
  private readonly recordsById = new Map<string, AIReservationRecord>();
  private readonly operationsById = new Map<string, AIReservationOperation>();
  private readonly operationsByIdempotencyKey = new Map<
    string,
    AIReservationOperation
  >();

  getById(reservationId: string): AIReservationRecord | undefined {
    const record = this.recordsById.get(reservationId);
    return record === undefined ? undefined : clone(record);
  }

  getByRequestId(requestId: string): ReadonlyArray<AIReservationRecord> {
    return [...this.recordsById.values()]
      .filter((record) => record.requestId === requestId)
      .sort((left, right) => left.reservationId.localeCompare(right.reservationId))
      .map(clone);
  }

  create(record: AIReservationRecord): boolean {
    if (this.recordsById.has(record.reservationId)) {
      return false;
    }
    this.recordsById.set(record.reservationId, clone(record));
    return true;
  }

  compareAndSet(
    reservationId: string,
    expectedVersion: number,
    nextRecord: AIReservationRecord,
  ): AIReservationCompareAndSetResult {
    const current = this.recordsById.get(reservationId);
    if (current === undefined || current.version !== expectedVersion) {
      return {
        updated: false,
        ...(current === undefined ? {} : { current: clone(current) }),
      };
    }
    if (
      !sameIdentity(current, nextRecord) ||
      nextRecord.version !== expectedVersion + 1
    ) {
      throw new Error(
        "Invalid compare-and-set update: identity must be preserved and version must increment by one.",
      );
    }
    this.recordsById.set(reservationId, clone(nextRecord));
    return { updated: true, current: clone(nextRecord) };
  }

  appendOperation(operation: AIReservationOperation): boolean {
    if (
      this.operationsById.has(operation.operationId) ||
      this.operationsByIdempotencyKey.has(operation.idempotencyKey)
    ) {
      return false;
    }
    const stored = clone(operation);
    this.operationsById.set(operation.operationId, stored);
    this.operationsByIdempotencyKey.set(operation.idempotencyKey, stored);
    return true;
  }

  getOperationById(operationId: string): AIReservationOperation | undefined {
    const operation = this.operationsById.get(operationId);
    return operation === undefined ? undefined : clone(operation);
  }

  getOperationByIdempotencyKey(
    idempotencyKey: string,
  ): AIReservationOperation | undefined {
    const operation = this.operationsByIdempotencyKey.get(idempotencyKey);
    return operation === undefined ? undefined : clone(operation);
  }

  listExpiredActive(asOf: string): ReadonlyArray<AIReservationRecord> {
    const asOfMs = Date.parse(asOf);
    if (!Number.isFinite(asOfMs)) {
      throw new Error("Invalid asOf: expected an ISO-8601 timestamp.");
    }
    return [...this.recordsById.values()]
      .filter(
        (record) =>
          [
            AIReservationState.Reserved,
            AIReservationState.PartiallyCommitted,
          ].includes(record.state) &&
          record.expiresAt !== undefined &&
          Date.parse(record.expiresAt) <= asOfMs,
      )
      .sort(
        (left, right) =>
          (left.expiresAt ?? "").localeCompare(right.expiresAt ?? "") ||
          left.reservationId.localeCompare(right.reservationId),
      )
      .map(clone);
  }
}
