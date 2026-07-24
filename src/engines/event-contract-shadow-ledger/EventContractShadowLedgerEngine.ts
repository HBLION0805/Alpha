import {
  EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION,
  EventContractObservationAuthorizationStatus,
  EventContractObservationSide,
  type EventContractFixedDecimal,
  type EventContractObservationInput,
  type EventContractObservationRecord,
} from "../../contracts/EventContractObservation";
import {
  EVENT_CONTRACT_SHADOW_LEDGER_SCHEMA_VERSION,
  EventContractShadowAuthorizationStatus,
  EventContractShadowErrorCategory,
  EventContractShadowOutcomeStatus,
  type EventContractSettlementInput,
  type EventContractSettlementRecord,
  type EventContractShadowHistory,
  type EventContractShadowLedgerRepository,
  type EventContractShadowQuery,
  type EventContractShadowSideOutcome,
  type EventContractShadowSummary,
} from "../../contracts/EventContractShadowLedger";
import { EventContractObservationEngine } from "../event-contract-observation/EventContractObservationEngine";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const SETTLEMENT_INPUT_KEYS = ["schemaVersion", "settlementId", "observationId", "termsId", "contractId", "settledAt", "winningSide", "settlementSourceId", "settlementSourceRecordId", "evidenceId"] as const;
const SETTLEMENT_RECORD_KEYS = [...SETTLEMENT_INPUT_KEYS, "fingerprint", "authorizationStatus", "deterministic", "readOnly"] as const;
const QUERY_KEYS = ["fromCapturedAt", "toCapturedAt", "settledOnly", "unsettledOnly", "limit", "offset"] as const;
const MONEY_SCALE = 8;

export class EventContractShadowLedgerError extends Error {
  public constructor(public readonly category: EventContractShadowErrorCategory, message: string) {
    super(`${category}: ${message}`);
    this.name = "EventContractShadowLedgerError";
  }
}

export class EventContractShadowLedgerService {
  readonly #repository: EventContractShadowLedgerRepository;
  readonly #observationEngine: EventContractObservationEngine;

  public constructor(repository: EventContractShadowLedgerRepository, observationEngine = new EventContractObservationEngine()) {
    this.#repository = repository;
    this.#observationEngine = observationEngine;
  }

  public capture(input: unknown, acceptedAt: string) {
    assertTimestamp(acceptedAt, "acceptedAt");
    const observation = this.#observationEngine.create(input);
    if (Date.parse(acceptedAt) < Date.parse(observation.capturedAt)) fail(EventContractShadowErrorCategory.InvalidTimestamp, "Repository acceptance cannot predate observation capture.");
    return this.#repository.appendObservation(observation, acceptedAt);
  }

  public settle(input: unknown, acceptedAt: string) {
    assertTimestamp(acceptedAt, "acceptedAt");
    if (!isRecord(input) || typeof input.observationId !== "string") fail(EventContractShadowErrorCategory.InvalidRecord, "Settlement input must identify an observation.");
    const observation = this.#repository.getObservationById(input.observationId);
    if (observation === undefined) fail(EventContractShadowErrorCategory.RecordNotFound, "Observation does not exist.");
    const settlement = createEventContractSettlement(input, observation);
    if (Date.parse(acceptedAt) < Date.parse(settlement.settledAt)) fail(EventContractShadowErrorCategory.InvalidTimestamp, "Repository acceptance cannot predate settlement.");
    return this.#repository.appendSettlement(settlement, acceptedAt);
  }

  public history(observationId: string): EventContractShadowHistory | undefined {
    const observation = this.#repository.getObservationById(observationId);
    if (observation === undefined) return undefined;
    const settlement = this.#repository.getSettlementByObservationId(observationId);
    return deepFreeze({
      observation,
      settlement: settlement ?? null,
      sideOutcomes: settlement === undefined ? [] : deriveEventContractShadowOutcomes(observation, settlement),
    });
  }

  public query(query: EventContractShadowQuery = {}): readonly EventContractShadowHistory[] {
    validateShadowQuery(query);
    const offset = query.offset ?? 0;
    const histories = this.#repository.listObservations()
      .filter((observation) => query.fromCapturedAt === undefined || Date.parse(observation.capturedAt) >= Date.parse(query.fromCapturedAt))
      .filter((observation) => query.toCapturedAt === undefined || Date.parse(observation.capturedAt) <= Date.parse(query.toCapturedAt))
      .map((observation) => this.history(observation.observationId) as EventContractShadowHistory)
      .filter((history) => query.settledOnly !== true || history.settlement !== null)
      .filter((history) => query.unsettledOnly !== true || history.settlement === null)
      .slice(offset, offset + (query.limit ?? Number.MAX_SAFE_INTEGER));
    return deepFreeze(histories);
  }

  public summary(): EventContractShadowSummary {
    const histories = this.query();
    const settled = histories.filter((history) => history.settlement !== null);
    const upNet = settled.flatMap((history) => history.sideOutcomes).filter((outcome) => outcome.side === EventContractObservationSide.Up).reduce((total, outcome) => total + toMoneyAtomic(outcome.netResult), 0n);
    const downNet = settled.flatMap((history) => history.sideOutcomes).filter((outcome) => outcome.side === EventContractObservationSide.Down).reduce((total, outcome) => total + toMoneyAtomic(outcome.netResult), 0n);
    return deepFreeze({
      observationCount: histories.length,
      settledCount: settled.length,
      unsettledCount: histories.length - settled.length,
      upWinCount: settled.filter((history) => history.settlement?.winningSide === EventContractObservationSide.Up).length,
      downWinCount: settled.filter((history) => history.settlement?.winningSide === EventContractObservationSide.Down).length,
      hypotheticalUpNetResult: fromMoneyAtomic(upNet),
      hypotheticalDownNetResult: fromMoneyAtomic(downNet),
      firstObservationAt: histories.at(0)?.observation.capturedAt ?? null,
      lastObservationAt: histories.at(-1)?.observation.capturedAt ?? null,
      authorizationStatus: EventContractShadowAuthorizationStatus.ShadowOnly,
    });
  }
}

export function createEventContractSettlement(input: unknown, observation: Readonly<EventContractObservationRecord>): EventContractSettlementRecord {
  validateStoredEventContractObservation(observation);
  if (!isRecord(input)) fail(EventContractShadowErrorCategory.InvalidRecord, "Settlement input must be an object.");
  assertExactKeys(input, SETTLEMENT_INPUT_KEYS, "settlement input");
  if (input.schemaVersion !== EVENT_CONTRACT_SHADOW_LEDGER_SCHEMA_VERSION) fail(EventContractShadowErrorCategory.InvalidRecord, "Settlement schema version is unsupported.");
  for (const field of ["settlementId", "observationId", "termsId", "contractId", "settlementSourceId", "settlementSourceRecordId", "evidenceId"] as const) assertIdentifier(input[field], field);
  assertTimestamp(input.settledAt, "settledAt");
  if (!isShadowSide(input.winningSide)) fail(EventContractShadowErrorCategory.InvalidRecord, "Winning side must be UP or DOWN.");
  if (input.observationId !== observation.observationId || input.termsId !== observation.contract.termsId || input.contractId !== observation.contract.contractId) fail(EventContractShadowErrorCategory.InvalidReference, "Settlement must match the exact observation, terms, and contract.");
  if (input.settlementSourceId !== observation.contract.settlementSourceId) fail(EventContractShadowErrorCategory.InvalidReference, "Settlement source must match the contract settlement source.");
  if (Date.parse(input.settledAt as string) < Date.parse(observation.contract.evaluatesAt)) fail(EventContractShadowErrorCategory.InvalidTimestamp, "Settlement cannot predate contract evaluation.");
  const base = {
    schemaVersion: EVENT_CONTRACT_SHADOW_LEDGER_SCHEMA_VERSION,
    settlementId: input.settlementId as string,
    observationId: input.observationId as string,
    termsId: input.termsId as string,
    contractId: input.contractId as string,
    settledAt: input.settledAt as string,
    winningSide: input.winningSide as EventContractObservationSide,
    settlementSourceId: input.settlementSourceId as string,
    settlementSourceRecordId: input.settlementSourceRecordId as string,
    evidenceId: input.evidenceId as string,
    authorizationStatus: EventContractShadowAuthorizationStatus.ShadowOnly,
    deterministic: true as const,
    readOnly: true as const,
  };
  return deepFreeze({ ...base, fingerprint: eventContractShadowFingerprint(base) });
}

export function validateStoredEventContractObservation(value: unknown): asserts value is EventContractObservationRecord {
  if (!isRecord(value)) fail(EventContractShadowErrorCategory.InvalidRecord, "Stored observation must be an object.");
  if (value.schemaVersion !== EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION || value.authorizationStatus !== EventContractObservationAuthorizationStatus.ObservationOnly || value.deterministic !== true || value.readOnly !== true) fail(EventContractShadowErrorCategory.InvalidRecord, "Stored observation authority or schema is invalid.");
  const input: EventContractObservationInput = {
    schemaVersion: EVENT_CONTRACT_OBSERVATION_SCHEMA_VERSION,
    observationId: value.observationId as string,
    capturedAt: value.capturedAt as string,
    contract: structuredClone(value.contract) as EventContractObservationInput["contract"],
    referencePrice: structuredClone(value.referencePrice) as EventContractObservationInput["referencePrice"],
    quotes: structuredClone(value.quotes) as EventContractObservationInput["quotes"],
    feePreviews: structuredClone(value.feePreviews) as EventContractObservationInput["feePreviews"],
    evidence: structuredClone(value.evidence) as EventContractObservationInput["evidence"],
  };
  let reconstructed: EventContractObservationRecord;
  try { reconstructed = new EventContractObservationEngine().create(input); }
  catch { fail(EventContractShadowErrorCategory.InvalidRecord, "Stored observation cannot be reconstructed from validated source facts."); }
  if (canonicalizeEventContractShadowValue(reconstructed) !== canonicalizeEventContractShadowValue(value)) fail(EventContractShadowErrorCategory.InvalidRecord, "Stored observation content or fingerprint is invalid.");
}

export function validateStoredEventContractSettlement(value: unknown, observation: Readonly<EventContractObservationRecord>): asserts value is EventContractSettlementRecord {
  if (!isRecord(value)) fail(EventContractShadowErrorCategory.InvalidRecord, "Stored settlement must be an object.");
  assertExactKeys(value, SETTLEMENT_RECORD_KEYS, "stored settlement");
  const input = Object.fromEntries(SETTLEMENT_INPUT_KEYS.map((key) => [key, value[key]]));
  const reconstructed = createEventContractSettlement(input, observation);
  if (canonicalizeEventContractShadowValue(reconstructed) !== canonicalizeEventContractShadowValue(value)) fail(EventContractShadowErrorCategory.InvalidRecord, "Stored settlement content or fingerprint is invalid.");
}

export function deriveEventContractShadowOutcomes(
  observation: Readonly<EventContractObservationRecord>,
  settlement: Readonly<EventContractSettlementRecord>,
): readonly EventContractShadowSideOutcome[] {
  validateStoredEventContractObservation(observation);
  validateStoredEventContractSettlement(settlement, observation);
  return deepFreeze(observation.sideEconomics.map((economics) => {
    const won = economics.side === settlement.winningSide;
    const cost = toMoneyAtomic(economics.allInCost);
    const payout = won ? toMoneyAtomic(economics.maximumPayout) : 0n;
    return {
      observationId: observation.observationId,
      settlementId: settlement.settlementId,
      side: economics.side,
      status: won ? EventContractShadowOutcomeStatus.Won : EventContractShadowOutcomeStatus.Lost,
      quantity: economics.quantity,
      allInCost: normalizeDecimal(economics.allInCost),
      settlementPayout: fromMoneyAtomic(payout),
      netResult: fromMoneyAtomic(payout - cost),
      observationFingerprint: observation.fingerprint,
      settlementFingerprint: settlement.fingerprint,
      authorizationStatus: EventContractShadowAuthorizationStatus.ShadowOnly,
    };
  }).sort((left, right) => left.side === right.side ? 0 : left.side === EventContractObservationSide.Up ? -1 : 1));
}

export function validateShadowQuery(value: unknown): asserts value is EventContractShadowQuery {
  if (!isRecord(value)) fail(EventContractShadowErrorCategory.InvalidRecord, "Query must be an object.");
  assertExactKeys(value, QUERY_KEYS, "query");
  for (const field of ["fromCapturedAt", "toCapturedAt"] as const) if (value[field] !== undefined) assertTimestamp(value[field], field);
  for (const field of ["settledOnly", "unsettledOnly"] as const) if (value[field] !== undefined && typeof value[field] !== "boolean") fail(EventContractShadowErrorCategory.InvalidRecord, `${field} must be boolean.`);
  if (value.settledOnly === true && value.unsettledOnly === true) fail(EventContractShadowErrorCategory.InvalidRecord, "Query cannot require both settled and unsettled records.");
  for (const field of ["limit", "offset"] as const) if (value[field] !== undefined && (!Number.isSafeInteger(value[field]) || (value[field] as number) < (field === "limit" ? 1 : 0))) fail(EventContractShadowErrorCategory.InvalidRecord, `${field} is invalid.`);
  if (Number.isSafeInteger(value.limit) && (value.limit as number) > 10_000) fail(EventContractShadowErrorCategory.InvalidRecord, "Query limit cannot exceed 10,000.");
  if (isTimestamp(value.fromCapturedAt) && isTimestamp(value.toCapturedAt) && Date.parse(value.fromCapturedAt) > Date.parse(value.toCapturedAt)) fail(EventContractShadowErrorCategory.InvalidTimestamp, "Query time range is reversed.");
}

export function canonicalizeEventContractShadowValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeEventContractShadowValue).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonicalizeEventContractShadowValue(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function eventContractShadowFingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  const text = canonicalizeEventContractShadowValue(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}

function toMoneyAtomic(value: EventContractFixedDecimal): bigint {
  return BigInt(value.atomicValue) * (10n ** BigInt(MONEY_SCALE - value.scale));
}

function fromMoneyAtomic(value: bigint): EventContractFixedDecimal {
  return normalizeDecimal({ atomicValue: value.toString(), scale: MONEY_SCALE });
}

function normalizeDecimal(value: EventContractFixedDecimal): EventContractFixedDecimal {
  let atomic = BigInt(value.atomicValue);
  let scale = value.scale;
  while (scale > 0 && atomic % 10n === 0n) { atomic /= 10n; scale -= 1; }
  return { atomicValue: atomic.toString(), scale };
}

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key)).sort();
  if (unknown.length > 0) fail(EventContractShadowErrorCategory.InvalidRecord, `${label} contains undeclared fields: ${unknown.join(", ")}.`);
}

function assertIdentifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) fail(EventContractShadowErrorCategory.InvalidRecord, `${field} is invalid.`);
}

function assertTimestamp(value: unknown, field: string): asserts value is string {
  if (!isTimestamp(value)) fail(EventContractShadowErrorCategory.InvalidTimestamp, `${field} must be canonical UTC with millisecond precision.`);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function isShadowSide(value: unknown): value is EventContractObservationSide {
  return value === EventContractObservationSide.Up || value === EventContractObservationSide.Down;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
