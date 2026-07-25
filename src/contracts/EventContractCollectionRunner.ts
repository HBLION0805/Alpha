import type {
  EventContractSourceCapability,
  EventContractSourceExecutionMode,
} from "./EventContractSource";

export const EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION = "1.0" as const;

export enum CollectionRunnerAuthorizationStatus {
  ResearchOnly = "COLLECTION_RUNNER_RESEARCH_ONLY_NOT_MODEL_OR_TRADE_AUTHORITY",
}

export enum CollectionRunnerSourceLane {
  Platform = "PLATFORM",
  Exchange = "EXCHANGE",
}

export enum CollectionRunnerPilotState {
  Draft = "DRAFT",
  OwnerApproved = "OWNER_APPROVED",
  Active = "ACTIVE",
  StopRequested = "STOP_REQUESTED",
  Stopped = "STOPPED",
  Revoked = "REVOKED",
  Completed = "COMPLETED",
  FailedClosed = "FAILED_CLOSED",
}

export enum CollectionRunnerTaskState {
  Scheduled = "SCHEDULED",
  Blocked = "BLOCKED",
  Due = "DUE",
  Leased = "LEASED",
  InFlight = "IN_FLIGHT",
  Validating = "VALIDATING",
  RetryWait = "RETRY_WAIT",
  Committed = "COMMITTED",
  Missed = "MISSED",
  TerminalFailed = "TERMINAL_FAILED",
  Cancelled = "CANCELLED",
}

export enum CollectionRunnerIssueCode {
  InvalidRecord = "INVALID_RECORD",
  UnknownField = "UNKNOWN_FIELD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidVersion = "INVALID_VERSION",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidChronology = "INVALID_CHRONOLOGY",
  InvalidFingerprint = "INVALID_FINGERPRINT",
  InvalidEnum = "INVALID_ENUM",
  InvalidBound = "INVALID_BOUND",
  InvalidAuthority = "INVALID_AUTHORITY",
  InvalidAdmission = "INVALID_ADMISSION",
  MappingRequired = "MAPPING_REQUIRED",
  InvalidTransition = "INVALID_TRANSITION",
  VersionConflict = "VERSION_CONFLICT",
  TerminalState = "TERMINAL_STATE",
}

export interface CollectionRunnerBounds {
  readonly maximumAttempts: number;
  readonly maximumRawPayloadBytes: number;
  readonly maximumRecordCount: number;
  readonly requestDeadlineMilliseconds: number;
}

export interface CollectionRunnerDefinitionInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION;
  readonly runnerDefinitionId: string;
  readonly version: string;
  readonly buildFingerprint: string;
  readonly supportedCapabilities: readonly EventContractSourceCapability[];
  readonly maximumActivePilots: 1;
  readonly maximumWorkers: 1;
  readonly maximumInFlightRequests: 1;
  readonly maximumRequestsPerSecond: 1;
  readonly maximumClockOffsetMilliseconds: 1000;
}

export interface CollectionRunnerDefinition extends CollectionRunnerDefinitionInput {
  readonly authorizationStatus: CollectionRunnerAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly readOnlySourceAccess: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerPilotActivationInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION;
  readonly activationId: string;
  readonly ownerId: string;
  readonly approvedAt: string;
  readonly startsAt: string;
  readonly stopsAt: string;
  readonly frozenPlanId: string;
  readonly frozenPlanFingerprint: string;
  readonly runnerDefinition: CollectionRunnerDefinition;
  readonly admittedProviderFingerprints: readonly string[];
  readonly admittedMappingFingerprints: readonly string[];
  readonly maximumEvents: number;
  readonly maximumRequests: number;
}

export interface CollectionRunnerPilotActivation extends CollectionRunnerPilotActivationInput {
  readonly state: CollectionRunnerPilotState.OwnerApproved;
  readonly aggregateVersion: 1;
  readonly authorizationStatus: CollectionRunnerAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerAdmissionBundle {
  readonly frozenPlanId: string;
  readonly frozenPlanFingerprint: string;
  readonly plannedEventId: string;
  readonly evidenceCutoffAt: string;
  readonly providerId: string;
  readonly providerFingerprint: string;
  readonly capability: EventContractSourceCapability;
  readonly executionMode: EventContractSourceExecutionMode;
  readonly sourceLane: CollectionRunnerSourceLane;
  readonly mappingId: string | null;
  readonly mappingVersion: string | null;
  readonly mappingFingerprint: string | null;
  readonly sourceRecordId: string;
  readonly requestPolicyId: string;
  readonly requestPolicyVersion: string;
  readonly bounds: CollectionRunnerBounds;
  readonly activationId: string;
  readonly activationExpiresAt: string;
}

export interface CollectionRunnerScheduledTaskInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION;
  readonly taskId: string;
  readonly observationSlot: string;
  readonly scheduledAt: string;
  readonly deadlineAt: string;
  readonly runnerDefinitionVersion: string;
  readonly admission: CollectionRunnerAdmissionBundle;
}

export interface CollectionRunnerScheduledTask extends CollectionRunnerScheduledTaskInput {
  readonly idempotencyKey: string;
  readonly state: CollectionRunnerTaskState.Scheduled;
  readonly aggregateVersion: 1;
  readonly authorizationStatus: CollectionRunnerAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerPilotStateRecord {
  readonly activationId: string;
  readonly state: CollectionRunnerPilotState;
  readonly aggregateVersion: number;
}

export interface CollectionRunnerTaskStateRecord {
  readonly taskId: string;
  readonly state: CollectionRunnerTaskState;
  readonly aggregateVersion: number;
}

export interface CollectionRunnerPilotTransitionInput {
  readonly current: CollectionRunnerPilotStateRecord;
  readonly expectedAggregateVersion: number;
  readonly nextState: CollectionRunnerPilotState;
}

export interface CollectionRunnerTaskTransitionInput {
  readonly current: CollectionRunnerTaskStateRecord;
  readonly expectedAggregateVersion: number;
  readonly nextState: CollectionRunnerTaskState;
}

export interface CollectionRunnerIssue {
  readonly code: CollectionRunnerIssueCode;
  readonly field: string;
  readonly message: string;
}
