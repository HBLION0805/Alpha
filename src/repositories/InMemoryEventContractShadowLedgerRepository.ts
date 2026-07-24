import {
  EventContractShadowAppendStatus,
  EventContractShadowErrorCategory,
  type EventContractObservationRecord,
  type EventContractSettlementRecord,
  type EventContractShadowAppendResult,
  type EventContractShadowLedgerRepository,
} from "../contracts";
import {
  EventContractShadowLedgerError,
  canonicalizeEventContractShadowValue,
  eventContractShadowFingerprint,
  validateStoredEventContractObservation,
  validateStoredEventContractSettlement,
} from "../engines/event-contract-shadow-ledger";
import type { EventContractShadowRepositoryEvent } from "./EventContractShadowLedgerRepository";

const clone = <T>(value: T): T => deepFreeze(structuredClone(value));
type EventInput = EventContractShadowRepositoryEvent extends infer T
  ? T extends EventContractShadowRepositoryEvent ? Omit<T, "sequence" | "fingerprint"> : never
  : never;

function fail(category: EventContractShadowErrorCategory, message: string): never {
  throw new EventContractShadowLedgerError(category, message);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

export class InMemoryEventContractShadowLedgerRepository implements EventContractShadowLedgerRepository {
  readonly #observations = new Map<string, EventContractObservationRecord>();
  readonly #observationSequences = new Map<string, number>();
  readonly #settlements = new Map<string, EventContractSettlementRecord>();
  readonly #settlementSequences = new Map<string, number>();
  readonly #settlementsByObservation = new Map<string, EventContractSettlementRecord>();
  readonly #events: EventContractShadowRepositoryEvent[] = [];

  public constructor(seedEvents: readonly EventContractShadowRepositoryEvent[] = []) {
    for (const event of seedEvents) this.applySeed(clone(event));
  }

  protected persistEvent(_event: Readonly<EventContractShadowRepositoryEvent>): void {}

  public appendObservation(record: EventContractObservationRecord, acceptedAt: string): EventContractShadowAppendResult<EventContractObservationRecord> {
    const existing = this.#observations.get(record.observationId);
    if (existing !== undefined) return this.replay(existing, record, this.#observationSequences.get(record.observationId), "Observation ID conflict.");
    const event = this.envelope({ schemaVersion: "1.0", eventType: "OBSERVATION_APPENDED", acceptedAt, observation: clone(record) });
    return this.applyObservation(record, event, true);
  }

  public appendSettlement(record: EventContractSettlementRecord, acceptedAt: string): EventContractShadowAppendResult<EventContractSettlementRecord> {
    const existing = this.#settlements.get(record.settlementId);
    if (existing !== undefined) return this.replay(existing, record, this.#settlementSequences.get(record.settlementId), "Settlement ID conflict.");
    if (this.#settlementsByObservation.has(record.observationId)) fail(EventContractShadowErrorCategory.DuplicateSettlement, "Observation already has an official settlement.");
    const event = this.envelope({ schemaVersion: "1.0", eventType: "SETTLEMENT_APPENDED", acceptedAt, settlement: clone(record) });
    return this.applySettlement(record, event, true);
  }

  public getObservationById(id: string): EventContractObservationRecord | undefined {
    const value = this.#observations.get(id);
    return value === undefined ? undefined : clone(value);
  }

  public getSettlementByObservationId(id: string): EventContractSettlementRecord | undefined {
    const value = this.#settlementsByObservation.get(id);
    return value === undefined ? undefined : clone(value);
  }

  public getSettlementById(id: string): EventContractSettlementRecord | undefined {
    const value = this.#settlements.get(id);
    return value === undefined ? undefined : clone(value);
  }

  public listObservations(): readonly EventContractObservationRecord[] {
    return [...this.#observations.entries()]
      .sort(([left], [right]) => (this.#observationSequences.get(left) as number) - (this.#observationSequences.get(right) as number))
      .map(([, value]) => clone(value));
  }

  public allEvents(): readonly EventContractShadowRepositoryEvent[] {
    return this.#events.map(clone);
  }

  private nextSequence(): number {
    const next = this.#events.length + 1;
    if (!Number.isSafeInteger(next)) fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Repository sequence overflow.");
    return next;
  }

  private envelope<T extends EventInput>(input: T): T & Pick<EventContractShadowRepositoryEvent, "sequence" | "fingerprint"> {
    const withSequence = { ...input, sequence: this.nextSequence() };
    return { ...withSequence, fingerprint: eventContractShadowFingerprint(withSequence) } as T & Pick<EventContractShadowRepositoryEvent, "sequence" | "fingerprint">;
  }

  private commit(event: EventContractShadowRepositoryEvent, persist: boolean): void {
    const expectedKeys = event.eventType === "OBSERVATION_APPENDED"
      ? ["acceptedAt", "eventType", "fingerprint", "observation", "schemaVersion", "sequence"]
      : ["acceptedAt", "eventType", "fingerprint", "schemaVersion", "sequence", "settlement"];
    const actualKeys = Object.keys(event).sort();
    const unsigned = { ...event, fingerprint: undefined };
    if (
      event.schemaVersion !== "1.0"
      || JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)
      || !isTimestamp(event.acceptedAt)
      || event.sequence !== this.nextSequence()
      || event.fingerprint !== eventContractShadowFingerprint(unsigned)
    ) {
      fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Repository sequence or fingerprint is invalid.");
    }
    if (persist) this.persistEvent(clone(event));
    this.#events.push(clone(event));
  }

  private replay<T>(existing: T, incoming: T, sequence: number | undefined, message: string): EventContractShadowAppendResult<T> {
    if (sequence !== undefined && canonicalizeEventContractShadowValue(existing) === canonicalizeEventContractShadowValue(incoming)) {
      return { status: EventContractShadowAppendStatus.Replayed, record: clone(existing), repositorySequence: sequence };
    }
    fail(EventContractShadowErrorCategory.IdempotencyConflict, message);
  }

  private applySeed(event: EventContractShadowRepositoryEvent): void {
    if (event.eventType === "OBSERVATION_APPENDED") this.applyObservation(event.observation, event, false);
    else this.applySettlement(event.settlement, event, false);
  }

  private applyObservation(
    record: EventContractObservationRecord,
    event: Extract<EventContractShadowRepositoryEvent, { eventType: "OBSERVATION_APPENDED" }>,
    persist: boolean,
  ): EventContractShadowAppendResult<EventContractObservationRecord> {
    if (this.#observations.has(record.observationId)) fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Duplicate observation in repository history.");
    validateStoredEventContractObservation(record);
    if (Date.parse(event.acceptedAt) < Date.parse(record.capturedAt)) fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Observation acceptance predates capture.");
    this.commit(event, persist);
    this.#observations.set(record.observationId, clone(record));
    this.#observationSequences.set(record.observationId, event.sequence);
    return { status: EventContractShadowAppendStatus.Appended, record: clone(record), repositorySequence: event.sequence };
  }

  private applySettlement(
    record: EventContractSettlementRecord,
    event: Extract<EventContractShadowRepositoryEvent, { eventType: "SETTLEMENT_APPENDED" }>,
    persist: boolean,
  ): EventContractShadowAppendResult<EventContractSettlementRecord> {
    const observation = this.#observations.get(record.observationId);
    if (observation === undefined) fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Settlement precedes or references a missing observation.");
    if (this.#settlements.has(record.settlementId) || this.#settlementsByObservation.has(record.observationId)) fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Duplicate settlement in repository history.");
    validateStoredEventContractSettlement(record, observation);
    if (Date.parse(event.acceptedAt) < Date.parse(record.settledAt)) fail(EventContractShadowErrorCategory.RepositoryCorrupt, "Settlement acceptance predates settlement.");
    this.commit(event, persist);
    this.#settlements.set(record.settlementId, clone(record));
    this.#settlementSequences.set(record.settlementId, event.sequence);
    this.#settlementsByObservation.set(record.observationId, clone(record));
    return { status: EventContractShadowAppendStatus.Appended, record: clone(record), repositorySequence: event.sequence };
  }
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}
