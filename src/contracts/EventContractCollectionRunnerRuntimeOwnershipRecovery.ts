import type { CollectionRunnerPilotState } from "./EventContractCollectionRunner";
import type { CollectionRunnerLocalOwnerAuthorizationEvidence } from "./EventContractCollectionRunnerRecoveryControl";
import type { CollectionRunnerRuntimeOwnership } from "./EventContractCollectionRunnerRuntime";

export const EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION =
  "1.0" as const;

export enum CollectionRunnerRuntimeOwnershipLiveness {
  Live = "LIVE",
  NotLive = "NOT_LIVE",
  Unknown = "UNKNOWN",
}

export enum CollectionRunnerRuntimeOwnershipRecoveryDisposition {
  OwnershipActive = "OWNERSHIP_ACTIVE",
  StaleCandidate = "STALE_CANDIDATE",
  PriorBootStaleCandidate = "PRIOR_BOOT_STALE_CANDIDATE",
  LivenessUncertain = "LIVENESS_UNCERTAIN",
  LockEvidenceInvalid = "LOCK_EVIDENCE_INVALID",
  StoreRecoveryBlocked = "STORE_RECOVERY_BLOCKED",
  StoppedRecoveryOnly = "STOPPED_RECOVERY_ONLY",
}

export enum CollectionRunnerRuntimeOwnershipRecoveryAction {
  QuarantineStaleOwnership = "QUARANTINE_STALE_OWNERSHIP",
}

export interface CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence {
  readonly storePathIdentity: string;
  readonly recoveryReportFingerprint: string;
  readonly storeIdentityVerified: boolean;
  readonly integrityVerified: boolean;
  readonly pilotState: CollectionRunnerPilotState | null;
  readonly openLeaseCount: number;
  readonly openAttemptCount: number;
  readonly durableEmergencyStopObserved: boolean;
}

export interface CollectionRunnerRuntimeOwnershipRecoveryInspectionInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION;
  readonly configurationFingerprint: string;
  readonly pathFingerprint: string;
  readonly lockDirectoryIdentity: string;
  readonly lockEvidenceFingerprint: string;
  readonly ownership: CollectionRunnerRuntimeOwnership | null;
  readonly currentBootIdentity: string;
  readonly processLiveness: CollectionRunnerRuntimeOwnershipLiveness;
  readonly storeEvidence: CollectionRunnerRuntimeOwnershipRecoveryStoreEvidence;
  readonly inspectedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly policyVersion: string;
}

export interface CollectionRunnerRuntimeOwnershipRecoveryAssessment
  extends CollectionRunnerRuntimeOwnershipRecoveryInspectionInput {
  readonly disposition: CollectionRunnerRuntimeOwnershipRecoveryDisposition;
  readonly eligibleForOwnerReview: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeOwnershipRecoveryCommand {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION;
  readonly commandId: string;
  readonly ownerId: string;
  readonly expectedAssessmentFingerprint: string;
  readonly action:
    CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership;
  readonly reasonCode: string;
  readonly decidedAtUtc: string;
  readonly expiresAtUtc: string;
}

export interface CollectionRunnerRuntimeOwnershipRecoveryDecision {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION;
  readonly commandId: string;
  readonly assessmentFingerprint: string;
  readonly ownershipFingerprint: string;
  readonly action:
    CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership;
  readonly reasonCode: string;
  readonly ownerAuthorization: CollectionRunnerLocalOwnerAuthorizationEvidence;
  readonly decidedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRuntimeOwnershipRecoveryReceipt {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_RUNTIME_OWNERSHIP_RECOVERY_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly commandId: string;
  readonly assessmentFingerprint: string;
  readonly decisionFingerprint: string;
  readonly ownershipFingerprint: string;
  readonly lockDirectoryIdentity: string;
  readonly quarantineDirectoryIdentity: string;
  readonly ownerAuthorizationReference: string;
  readonly action:
    CollectionRunnerRuntimeOwnershipRecoveryAction.QuarantineStaleOwnership;
  readonly quarantinedAtUtc: string;
  readonly preservesOwnerRecord: true;
  readonly preservesRecoveryReceipt: true;
  readonly authorizesPilotResume: false;
  readonly authorizesRuntimeStart: false;
  readonly deterministic: true;
  readonly fingerprint: string;
}
