import {
  DevelopmentAppendStatus,
  DevelopmentValidationErrorCategory,
  canonicalizeDevelopmentValue,
  developmentFingerprint,
  throwIfInvalidDevelopment,
  validateDevelopmentQuery,
  validateDevelopmentRecord,
  validateDevelopmentSnapshot,
  validateDevelopmentTransition,
  type DevelopmentAppendResult,
  type DevelopmentHistory,
  type DevelopmentQuery,
  type DevelopmentValidationRecord,
  type DevelopmentValidationRecordSnapshot,
} from "../contracts";
import { matchesDevelopmentQuery, type DevelopmentValidationRepository } from "./DevelopmentValidationRepository";

const clone = <T>(value: T): T => structuredClone(value);
function fail(category: DevelopmentValidationErrorCategory, message: string): never { throw new Error(`${category}: ${message}`); }

export class InMemoryDevelopmentValidationRepository implements DevelopmentValidationRepository {
  private readonly records = new Map<string, DevelopmentValidationRecord>();
  private readonly ordered: DevelopmentValidationRecord[] = [];
  private readonly taskRecords = new Map<string, DevelopmentValidationRecord[]>();

  constructor(seedRecords: ReadonlyArray<DevelopmentValidationRecord> = []) {
    for (const record of seedRecords) this.applySeed(clone(record));
  }

  protected persistRecord(_record: Readonly<DevelopmentValidationRecord>): void {}

  private nextSequence(): number {
    const sequence = this.ordered.length + 1;
    if (!Number.isSafeInteger(sequence)) fail(DevelopmentValidationErrorCategory.RepositoryCorrupt, "repository sequence overflow.");
    return sequence;
  }

  append(snapshot: DevelopmentValidationRecordSnapshot, acceptedAt: string): DevelopmentAppendResult {
    const existing = this.records.get(snapshot.recordId);
    if (existing !== undefined) {
      const { sequence: _sequence, payloadFingerprint: _fingerprint, ...storedSnapshot } = existing;
      if (canonicalizeDevelopmentValue(storedSnapshot) === canonicalizeDevelopmentValue(snapshot)) return { status: DevelopmentAppendStatus.Replayed, record: clone(existing), repositorySequence: existing.sequence };
      fail(DevelopmentValidationErrorCategory.IdempotencyConflict, "record ID already exists with different content.");
    }
    throwIfInvalidDevelopment(validateDevelopmentSnapshot(snapshot, acceptedAt));
    const history = this.taskRecords.get(snapshot.taskId) ?? [];
    throwIfInvalidDevelopment(validateDevelopmentTransition(snapshot, history));
    const sequence = this.nextSequence();
    const withoutFingerprint = { ...clone(snapshot), sequence };
    const record: DevelopmentValidationRecord = { ...withoutFingerprint, payloadFingerprint: developmentFingerprint({ ...withoutFingerprint, payloadFingerprint: undefined }) };
    return this.applyRecord(record, acceptedAt, true);
  }

  private applySeed(record: DevelopmentValidationRecord): void {
    this.applyRecord(record, record.timestamp, false);
  }

  private applyRecord(record: DevelopmentValidationRecord, acceptedAt: string, persist: boolean): DevelopmentAppendResult {
    if (this.records.has(record.recordId)) fail(DevelopmentValidationErrorCategory.RepositoryCorrupt, "duplicate record ID in repository history.");
    if (record.sequence !== this.nextSequence()) fail(DevelopmentValidationErrorCategory.RepositoryCorrupt, "repository sequence is not contiguous.");
    throwIfInvalidDevelopment(validateDevelopmentRecord(record, acceptedAt));
    const history = this.taskRecords.get(record.taskId) ?? [];
    const { sequence: _sequence, payloadFingerprint: _fingerprint, ...snapshot } = record;
    throwIfInvalidDevelopment(validateDevelopmentTransition(snapshot, history));
    if (persist) this.persistRecord(clone(record));
    this.records.set(record.recordId, clone(record));
    this.ordered.push(clone(record));
    this.taskRecords.set(record.taskId, [...history.map(clone), clone(record)]);
    return { status: DevelopmentAppendStatus.Appended, record: clone(record), repositorySequence: record.sequence };
  }

  getById(recordId: string): DevelopmentValidationRecord | undefined {
    const value = this.records.get(recordId);
    return value === undefined ? undefined : clone(value);
  }

  getTaskHistory(taskId: string): DevelopmentHistory | undefined {
    const records = this.taskRecords.get(taskId);
    if (records === undefined || records.length === 0) return undefined;
    const first = records[0] as DevelopmentValidationRecord;
    const latest = records.at(-1) as DevelopmentValidationRecord;
    return { task: { taskId: first.taskId, taskTitle: first.taskTitle, projectDay: first.projectDay }, records: records.map(clone), currentStatus: latest.status };
  }

  query(query: DevelopmentQuery = {}): ReadonlyArray<DevelopmentValidationRecord> {
    throwIfInvalidDevelopment(validateDevelopmentQuery(query));
    const offset = query.offset ?? 0;
    return this.ordered.filter((record) => matchesDevelopmentQuery(record, query)).slice(offset, offset + (query.limit ?? Number.MAX_SAFE_INTEGER)).map(clone);
  }

  allRecords(): ReadonlyArray<DevelopmentValidationRecord> {
    return this.ordered.map(clone);
  }
}
