import type { CollectionRunnerPilotState } from "./EventContractCollectionRunner";

export const COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION = "1.0" as const;

export enum CollectionRunnerClockHealth {
  Healthy = "HEALTHY",
  Unhealthy = "UNHEALTHY",
  Unknown = "UNKNOWN",
}

export enum CollectionRunnerRecoveryDisposition {
  NoResumeRequired = "NO_RESUME_REQUIRED",
  ResumeEligible = "RESUME_ELIGIBLE",
  ReconciliationRequired = "RECONCILIATION_REQUIRED",
  StopCompletionOnly = "STOP_COMPLETION_ONLY",
  ActivationExpired = "ACTIVATION_EXPIRED",
  StoreSwitchRequired = "STORE_SWITCH_REQUIRED",
  FailClosedRequired = "FAIL_CLOSED_REQUIRED",
  TerminalNoResume = "TERMINAL_NO_RESUME",
}

export enum CollectionRunnerOwnerDecisionAction {
  ApproveResume = "APPROVE_RESUME",
  CompleteStop = "COMPLETE_STOP",
  Revoke = "REVOKE",
  FailClosed = "FAIL_CLOSED",
  RejectNoMutation = "REJECT_NO_MUTATION",
}

export enum CollectionRunnerEmergencyStopTrigger {
  OwnerRequest = "OWNER_REQUEST",
  IntegrityFailure = "INTEGRITY_FAILURE",
  ClockUnhealthy = "CLOCK_UNHEALTHY",
  ActivationExpired = "ACTIVATION_EXPIRED",
  ActivationRevoked = "ACTIVATION_REVOKED",
  BudgetBreach = "BUDGET_BREACH",
  LeaseAttemptAmbiguity = "LEASE_ATTEMPT_AMBIGUITY",
  DatabaseFailure = "DATABASE_FAILURE",
  DurableStopRequested = "DURABLE_STOP_REQUESTED",
}

export enum CollectionRunnerEmergencyStopDirective {
  NoStop = "NO_STOP",
  RequestStop = "REQUEST_STOP",
  FailClosed = "FAIL_CLOSED",
}

export enum CollectionRunnerRecoveryControlIssueCode {
  InvalidRecord = "INVALID_RECORD",
  UnknownField = "UNKNOWN_FIELD",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidFingerprint = "INVALID_FINGERPRINT",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidChronology = "INVALID_CHRONOLOGY",
  InvalidEnum = "INVALID_ENUM",
  InvalidBound = "INVALID_BOUND",
  InvalidAuthority = "INVALID_AUTHORITY",
  InvalidDisposition = "INVALID_DISPOSITION",
  InvalidDecision = "INVALID_DECISION",
  TerminalState = "TERMINAL_STATE",
  EmergencyStopPrecedence = "EMERGENCY_STOP_PRECEDENCE",
}

export interface CollectionRunnerRecoveryActivation {
  readonly activationId: string;
  readonly ownerId: string;
  readonly state: CollectionRunnerPilotState;
  readonly aggregateVersion: number;
  readonly fingerprint: string;
  readonly startsAtUtc: string;
  readonly stopsAtUtc: string;
}

export interface CollectionRunnerRecoveryAssessmentInput {
  readonly schemaVersion: typeof COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly policyVersion: string;
  readonly storeId: string;
  readonly storePathIdentity: string;
  readonly schemaCatalogChecksum: string;
  readonly recoveryReportFingerprint: string;
  readonly inspectedAtUtc: string;
  readonly activation: CollectionRunnerRecoveryActivation | null;
  readonly priorBootIdentity: string | null;
  readonly proposedBootIdentity: string;
  readonly proposedProcessSessionId: string;
  readonly clockHealth: CollectionRunnerClockHealth;
  readonly absoluteClockOffsetMilliseconds: number | null;
  readonly maximumClockOffsetMilliseconds: number;
  readonly openLeaseCount: number;
  readonly unresolvedAttemptCount: number;
  readonly integrityBlockerCodes: readonly string[];
  readonly restoredStorePendingSwitch: boolean;
  readonly assessedAtUtc: string;
  readonly expiresAtUtc: string;
}

export interface CollectionRunnerRecoveryAssessment
  extends CollectionRunnerRecoveryAssessmentInput {
  readonly disposition: CollectionRunnerRecoveryDisposition;
  readonly resumeEligible: boolean;
  readonly ownerDecisionRequired: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerLocalOwnerAuthorizationEvidence {
  readonly authorityKind: "LOCAL_OWNER_VERIFIED";
  readonly ownerId: string;
  readonly verifierId: string;
  readonly verifierVersion: string;
  readonly authorizationReference: string;
  readonly challengeFingerprint: string;
  readonly verifiedAtUtc: string;
  readonly expiresAtUtc: string;
}

export interface CollectionRunnerOwnerRecoveryDecisionInput {
  readonly schemaVersion: typeof COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION;
  readonly decisionId: string;
  readonly assessment: CollectionRunnerRecoveryAssessment;
  readonly expectedActivationAggregateVersion: number | null;
  readonly ownerAuthorization: CollectionRunnerLocalOwnerAuthorizationEvidence;
  readonly action: CollectionRunnerOwnerDecisionAction;
  readonly reasonCode: string;
  readonly decidedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly proposedBootIdentity: string;
  readonly proposedProcessSessionId: string;
  readonly emergencyStopObserved: boolean;
}

export interface CollectionRunnerOwnerRecoveryDecision
  extends CollectionRunnerOwnerRecoveryDecisionInput {
  readonly idempotencyKey: string;
  readonly authorizesMutation: boolean;
  readonly authorizesResume: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerEmergencyStopInput {
  readonly activationState: CollectionRunnerPilotState | null;
  readonly triggers: readonly CollectionRunnerEmergencyStopTrigger[];
  readonly evaluatedAtUtc: string;
}

export interface CollectionRunnerEmergencyStopAssessment
  extends CollectionRunnerEmergencyStopInput {
  readonly directive: CollectionRunnerEmergencyStopDirective;
  readonly blocksResume: boolean;
  readonly blocksNewWork: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}
