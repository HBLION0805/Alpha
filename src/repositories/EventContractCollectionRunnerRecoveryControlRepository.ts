import type {
  CollectionRunnerEmergencyStopAssessment,
  CollectionRunnerOwnerRecoveryDecision,
  CollectionRunnerOwnerDecisionAction,
  CollectionRunnerPilotState,
  CollectionRunnerRecoveryAssessment,
} from "../contracts";

export enum CollectionRunnerRecoveryControlRepositoryErrorCode {
  InvalidInput = "INVALID_INPUT",
  NotFound = "NOT_FOUND",
  IdentityConflict = "IDENTITY_CONFLICT",
  VersionConflict = "VERSION_CONFLICT",
  InvalidState = "INVALID_STATE",
  AuthorityMismatch = "AUTHORITY_MISMATCH",
  RecoveryContextMismatch = "RECOVERY_CONTEXT_MISMATCH",
  DecisionConsumed = "DECISION_CONSUMED",
  DecisionInvalidated = "DECISION_INVALIDATED",
  DecisionExpired = "DECISION_EXPIRED",
  EmergencyStopPrecedence = "EMERGENCY_STOP_PRECEDENCE",
  ReconciliationRequired = "RECONCILIATION_REQUIRED",
  TransactionFailed = "TRANSACTION_FAILED",
}

export class CollectionRunnerRecoveryControlRepositoryError extends Error {
  public constructor(
    public readonly code: CollectionRunnerRecoveryControlRepositoryErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerRecoveryControlRepositoryError";
  }
}

export interface PersistRecoveryAssessmentTransaction {
  readonly assessment: CollectionRunnerRecoveryAssessment;
  readonly recordedAtUtc: string;
}

export interface PersistOwnerRecoveryDecisionTransaction {
  readonly decision: CollectionRunnerOwnerRecoveryDecision;
  readonly recordedAtUtc: string;
}

export interface ExecuteOwnerRecoveryDecisionTransaction {
  readonly decisionId: string;
  readonly expectedDecisionFingerprint: string;
  readonly currentRecoveryReportFingerprint: string;
  readonly currentStorePathIdentity: string;
  readonly currentSchemaCatalogChecksum: string;
  readonly executedAtUtc: string;
}

export interface ExecuteEmergencyStopTransaction {
  readonly stopEventId: string;
  readonly idempotencyKey: string;
  readonly activationId: string;
  readonly expectedActivationAggregateVersion: number;
  readonly assessment: CollectionRunnerEmergencyStopAssessment;
  readonly executedAtUtc: string;
}

export interface CollectionRunnerRecoverySessionAuthorization {
  readonly sessionAuthorizationId: string;
  readonly authorizationFingerprint: string;
  readonly decisionId: string;
  readonly assessmentId: string;
  readonly activationId: string;
  readonly expectedActivationAggregateVersion: number;
  readonly bootIdentity: string;
  readonly processSessionId: string;
  readonly authorizedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly revokedAtUtc: string | null;
  readonly revocationReasonCode: string | null;
}

export interface CollectionRunnerControlExecutionReceipt {
  readonly receiptId: string;
  readonly fingerprint: string;
  readonly decisionId: string | null;
  readonly stopEventId: string | null;
  readonly assessmentId: string | null;
  readonly activationId: string;
  readonly action:
    | CollectionRunnerOwnerDecisionAction
    | "EMERGENCY_STOP_REQUESTED"
    | "EMERGENCY_FAIL_CLOSED";
  readonly fromState: CollectionRunnerPilotState;
  readonly toState: CollectionRunnerPilotState;
  readonly fromAggregateVersion: number;
  readonly toAggregateVersion: number;
  readonly sessionAuthorizationId: string | null;
  readonly outboxId: string;
  readonly executedAtUtc: string;
}

export interface EventContractCollectionRunnerRecoveryControlRepository {
  persistRecoveryAssessment(
    transaction: PersistRecoveryAssessmentTransaction,
  ): CollectionRunnerRecoveryAssessment;
  persistOwnerRecoveryDecision(
    transaction: PersistOwnerRecoveryDecisionTransaction,
  ): CollectionRunnerOwnerRecoveryDecision;
  executeOwnerRecoveryDecision(
    transaction: ExecuteOwnerRecoveryDecisionTransaction,
  ): CollectionRunnerControlExecutionReceipt;
  executeEmergencyStop(
    transaction: ExecuteEmergencyStopTransaction,
  ): CollectionRunnerControlExecutionReceipt;
  getRecoveryAssessment(
    assessmentId: string,
  ): CollectionRunnerRecoveryAssessment | null;
  getOwnerRecoveryDecision(
    decisionId: string,
  ): CollectionRunnerOwnerRecoveryDecision | null;
  getSessionAuthorization(
    processSessionId: string,
  ): CollectionRunnerRecoverySessionAuthorization | null;
  getControlExecutionReceipt(
    receiptId: string,
  ): CollectionRunnerControlExecutionReceipt | null;
}
