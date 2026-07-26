import type {
  DurableFixtureRehearsalEnvelopeVerificationResult,
} from "./EventContractCollectionRunnerDurableFixtureRehearsalEvidence";

export const COLLECTION_RUNNER_REHEARSAL_OPERATION_VALIDATION_POLICY =
  "ALPHA_OPERATION_FIXED_VALIDATION_V1" as const;
export const COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY =
  "ALPHA_OPERATION_VALIDATION_RECURSION_GUARD_V1" as const;

export enum CollectionRunnerRehearsalOperationVerificationDisposition {
  Pass = "PASS",
  FailClosed = "FAIL_CLOSED",
  Incomplete = "INCOMPLETE",
}

export interface CollectionRunnerRehearsalOperationValidationRequest {
  readonly receiptId: string;
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly startedAtUtc: string;
}

export interface CollectionRunnerRehearsalOperationValidationReceipt {
  readonly receiptId: string;
  readonly operationId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly validationAuthorityFingerprint: string;
  readonly repositoryCommit: string;
  readonly packageFingerprint: string;
  readonly validationSuiteFingerprint: string;
  readonly validationPolicyVersion:
    typeof COLLECTION_RUNNER_REHEARSAL_OPERATION_VALIDATION_POLICY;
  readonly recursionPolicyVersion:
    typeof COLLECTION_RUNNER_REHEARSAL_OPERATION_RECURSION_POLICY;
  readonly registeredTestTotal: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly exitStatus: number;
  readonly startedAtUtc: string;
  readonly endedAtUtc: string;
  readonly sanitizedOutputDigest: string;
  readonly outputBytes: number;
  readonly networkPermitted: false;
  readonly credentialAccessPermitted: false;
  readonly passed: true;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationFinalVerificationRequest {
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly evidenceRootId: string;
  readonly envelopeFingerprint: string;
  readonly validationReceiptFingerprint: string;
  readonly observedAtUtc: string;
}

export interface CollectionRunnerRehearsalOperationFinalVerificationReport {
  readonly operationId: string;
  readonly manifestFingerprint: string;
  readonly validationReceiptFingerprint: string;
  readonly envelopeVerification:
    DurableFixtureRehearsalEnvelopeVerificationResult;
  readonly disposition:
    CollectionRunnerRehearsalOperationVerificationDisposition;
  readonly issueCodes: readonly string[];
  readonly observedAtUtc: string;
  readonly nonAuthorityDeclaration: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}
