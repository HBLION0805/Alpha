import type {
  EventContractFixedDecimal,
  EventContractObservationRecord,
  EventContractObservationSide,
} from "./EventContractObservation";

export const EVENT_CONTRACT_SHADOW_LEDGER_SCHEMA_VERSION = "1.0" as const;

export enum EventContractShadowAppendStatus {
  Appended = "APPENDED",
  Replayed = "REPLAYED",
}

export enum EventContractShadowOutcomeStatus {
  Won = "WON",
  Lost = "LOST",
}

export enum EventContractShadowAuthorizationStatus {
  ShadowOnly = "SHADOW_ONLY_NOT_TRADE_AUTHORITY",
}

export enum EventContractShadowErrorCategory {
  InvalidRecord = "INVALID_RECORD",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidReference = "INVALID_REFERENCE",
  RecordNotFound = "RECORD_NOT_FOUND",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  DuplicateSettlement = "DUPLICATE_SETTLEMENT",
  RepositoryCorrupt = "REPOSITORY_CORRUPT",
  InvalidPath = "INVALID_PATH",
}

export interface EventContractSettlementInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_SHADOW_LEDGER_SCHEMA_VERSION;
  readonly settlementId: string;
  readonly observationId: string;
  readonly termsId: string;
  readonly contractId: string;
  readonly settledAt: string;
  readonly winningSide: EventContractObservationSide;
  readonly settlementSourceId: string;
  readonly settlementSourceRecordId: string;
  readonly evidenceId: string;
}

export interface EventContractSettlementRecord extends EventContractSettlementInput {
  readonly fingerprint: string;
  readonly authorizationStatus: EventContractShadowAuthorizationStatus.ShadowOnly;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface EventContractShadowSideOutcome {
  readonly observationId: string;
  readonly settlementId: string;
  readonly side: EventContractObservationSide;
  readonly status: EventContractShadowOutcomeStatus;
  readonly quantity: number;
  readonly allInCost: EventContractFixedDecimal;
  readonly settlementPayout: EventContractFixedDecimal;
  readonly netResult: EventContractFixedDecimal;
  readonly observationFingerprint: string;
  readonly settlementFingerprint: string;
  readonly authorizationStatus: EventContractShadowAuthorizationStatus.ShadowOnly;
}

export interface EventContractShadowAppendResult<T> {
  readonly status: EventContractShadowAppendStatus;
  readonly record: T;
  readonly repositorySequence: number;
}

export interface EventContractShadowQuery {
  readonly fromCapturedAt?: string;
  readonly toCapturedAt?: string;
  readonly settledOnly?: boolean;
  readonly unsettledOnly?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface EventContractShadowSummary {
  readonly observationCount: number;
  readonly settledCount: number;
  readonly unsettledCount: number;
  readonly upWinCount: number;
  readonly downWinCount: number;
  readonly hypotheticalUpNetResult: EventContractFixedDecimal;
  readonly hypotheticalDownNetResult: EventContractFixedDecimal;
  readonly firstObservationAt: string | null;
  readonly lastObservationAt: string | null;
  readonly authorizationStatus: EventContractShadowAuthorizationStatus.ShadowOnly;
}

export interface EventContractShadowHistory {
  readonly observation: EventContractObservationRecord;
  readonly settlement: EventContractSettlementRecord | null;
  readonly sideOutcomes: readonly EventContractShadowSideOutcome[];
}

export interface EventContractShadowLedgerRepository {
  appendObservation(record: EventContractObservationRecord, acceptedAt: string): EventContractShadowAppendResult<EventContractObservationRecord>;
  appendSettlement(record: EventContractSettlementRecord, acceptedAt: string): EventContractShadowAppendResult<EventContractSettlementRecord>;
  getObservationById(observationId: string): EventContractObservationRecord | undefined;
  getSettlementByObservationId(observationId: string): EventContractSettlementRecord | undefined;
  getSettlementById(settlementId: string): EventContractSettlementRecord | undefined;
  listObservations(): readonly EventContractObservationRecord[];
}
