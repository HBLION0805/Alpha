import type {
  CollectionRunnerRehearsalOperationPhase,
} from "./EventContractCollectionRunnerRehearsalOperation";

export const EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION =
  "1.0" as const;

export enum CollectionRunnerRehearsalOperationPreflightDisposition {
  Eligible = "ELIGIBLE",
  Blocked = "BLOCKED",
  Incomplete = "INCOMPLETE",
}

export enum CollectionRunnerRehearsalOperationResultDisposition {
  Completed = "COMPLETED",
  FailedClosed = "FAILED_CLOSED",
  RecoveryRequired = "RECOVERY_REQUIRED",
  Incomplete = "INCOMPLETE",
}

export enum CollectionRunnerRehearsalOperationStopMode {
  Graceful = "GRACEFUL",
  Emergency = "EMERGENCY",
}

export interface CollectionRunnerRehearsalOperationPhaseCommandInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION;
  readonly commandId: string;
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly phase: CollectionRunnerRehearsalOperationPhase;
  readonly expectedLifecycleVersion: number;
  readonly expectedInvocationOrdinal: number | null;
  readonly expectedRecoveryFingerprint: string;
  readonly alphaCommit: string;
  readonly rootRegistryFingerprint: string;
  readonly bootIdentity: string;
  readonly processSessionId: string;
  readonly createdAtUtc: string;
  readonly expiresAtUtc: string;
  readonly challengeNonce: string;
}

export interface CollectionRunnerRehearsalOperationPhaseCommand
  extends CollectionRunnerRehearsalOperationPhaseCommandInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationReadinessObservation {
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly observedAtUtc: string;
  readonly alphaCommit: string;
  readonly trackedTreeClean: boolean;
  readonly packageFingerprint: string;
  readonly validationSuiteFingerprint: string;
  readonly registeredTestTotal: number;
  readonly rootRegistryFingerprint: string;
  readonly rootsVerified: boolean;
  readonly fixtureBindingsVerified: boolean;
  readonly networkCapabilityAbsent: boolean;
  readonly credentialCapabilityAbsent: boolean;
  readonly approvalValid: boolean;
  readonly storeState: "ABSENT" | "EXACT" | "MISSING" | "INVALID";
  readonly lifecycleState: string | null;
  readonly lifecycleVersion: number | null;
  readonly nextInvocationOrdinal: number | null;
  readonly recoveryFingerprint: string;
  readonly unresolvedClaim: boolean;
  readonly ownershipAvailable: boolean;
  readonly processStopTripped: boolean;
  readonly durableStopTripped: boolean;
  readonly blockerCodes: readonly string[];
  readonly incompleteCodes: readonly string[];
}

export interface CollectionRunnerRehearsalOperationPreflightReport {
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly requestedPhase: CollectionRunnerRehearsalOperationPhase;
  readonly expectedInvocationOrdinal: number | null;
  readonly disposition: CollectionRunnerRehearsalOperationPreflightDisposition;
  readonly blockerCodes: readonly string[];
  readonly incompleteCodes: readonly string[];
  readonly observedAtUtc: string;
  readonly nonAuthorityDeclaration: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationAuthorizationReceiptInput {
  readonly authorizationId: string;
  readonly commandId: string;
  readonly commandFingerprint: string;
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly phase: CollectionRunnerRehearsalOperationPhase;
  readonly phasePlanOrdinal: number;
  readonly expectedLifecycleVersion: number;
  readonly expectedInvocationOrdinal: number | null;
  readonly expectedRecoveryFingerprint: string;
  readonly authoritySnapshotFingerprint: string;
  readonly ownerId: string;
  readonly ownerAuthorizationReference: string;
  readonly bootIdentity: string;
  readonly processSessionId: string;
  readonly authorizedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly consumedAtUtc: string;
}

export interface CollectionRunnerRehearsalOperationAuthorizationReceipt
  extends CollectionRunnerRehearsalOperationAuthorizationReceiptInput {
  readonly consumed: true;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationPhaseEvidence {
  readonly disposition: CollectionRunnerRehearsalOperationResultDisposition;
  readonly priorLifecycleVersion: number;
  readonly resultingLifecycleVersion: number;
  readonly priorLifecycleFingerprint: string;
  readonly resultingLifecycleFingerprint: string;
  readonly authorityEvidenceFingerprint: string;
  readonly sanitizedOutputDigest: string;
  readonly startedAtUtc: string;
  readonly completedAtUtc: string;
}

export interface CollectionRunnerRehearsalOperationResultReceiptInput {
  readonly resultId: string;
  readonly authorizationId: string;
  readonly authorizationFingerprint: string;
  readonly commandId: string;
  readonly commandFingerprint: string;
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly phase: CollectionRunnerRehearsalOperationPhase;
  readonly phasePlanOrdinal: number;
  readonly expectedInvocationOrdinal: number | null;
  readonly processSessionId: string;
  readonly bootIdentity: string;
  readonly disposition: CollectionRunnerRehearsalOperationResultDisposition;
  readonly priorLifecycleVersion: number;
  readonly resultingLifecycleVersion: number;
  readonly priorLifecycleFingerprint: string;
  readonly resultingLifecycleFingerprint: string;
  readonly authorityEvidenceFingerprint: string;
  readonly sanitizedOutputDigest: string;
  readonly startedAtUtc: string;
  readonly completedAtUtc: string;
  readonly nonAuthorityDeclaration: string;
}

export interface CollectionRunnerRehearsalOperationResultReceipt
  extends CollectionRunnerRehearsalOperationResultReceiptInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationStopReceiptInput {
  readonly stopId: string;
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly commandId: string;
  readonly commandFingerprint: string;
  readonly ownerId: string;
  readonly ownerAuthorizationReference: string;
  readonly mode: CollectionRunnerRehearsalOperationStopMode;
  readonly reasonCode: string;
  readonly requestedAtUtc: string;
}

export interface CollectionRunnerRehearsalOperationStopCommandInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION;
  readonly commandId: string;
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly alphaCommit: string;
  readonly rootRegistryFingerprint: string;
  readonly mode: CollectionRunnerRehearsalOperationStopMode;
  readonly reasonCode: string;
  readonly createdAtUtc: string;
  readonly expiresAtUtc: string;
  readonly challengeNonce: string;
}

export interface CollectionRunnerRehearsalOperationStopCommand
  extends CollectionRunnerRehearsalOperationStopCommandInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationStopReceipt
  extends CollectionRunnerRehearsalOperationStopReceiptInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationStatusReport {
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly observedAtUtc: string;
  readonly approvalValid: boolean;
  readonly approvalExpiresAtUtc: string;
  readonly repositoryReady: boolean;
  readonly rootsReady: boolean;
  readonly storeState: "ABSENT" | "EXACT" | "MISSING" | "INVALID";
  readonly lifecycleState: string | null;
  readonly lifecycleVersion: number | null;
  readonly nextInvocationOrdinal: number | null;
  readonly recoveryRequired: boolean;
  readonly unresolvedClaim: boolean;
  readonly stopTripped: boolean;
  readonly authorizationCount: number;
  readonly resultCount: number;
  readonly latestAuthorizationId: string | null;
  readonly latestResultId: string | null;
  readonly onlyEligibleNextPhase: CollectionRunnerRehearsalOperationPhase | null;
  readonly blockerCodes: readonly string[];
  readonly nonAuthorityDeclaration: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}
