import type {
  DurableFixtureRehearsalEvidencePlan,
  DurableFixtureRehearsalSnapshot,
} from "./EventContractCollectionRunnerDurableFixtureRehearsal";

export const DURABLE_FIXTURE_REHEARSAL_EVIDENCE_VERSION = "1.0" as const;
export const DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY =
  "ALPHA_FIXED_LOCAL_VALIDATION_V1" as const;
export const DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY =
  "FIXTURE_ONLY_NO_PROVIDER_NO_CAPITAL_AUTHORITY" as const;

export enum DurableFixtureRehearsalEvidenceDisposition {
  Pass = "PASS",
  FailClosed = "FAIL_CLOSED",
  Incomplete = "INCOMPLETE",
}

export interface DurableFixtureRehearsalValidationReceiptInput {
  readonly receiptId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly repositoryCommit: string;
  readonly validationPolicyVersion:
    typeof DURABLE_FIXTURE_REHEARSAL_VALIDATION_POLICY;
  readonly validationSuiteFingerprint: string;
  readonly registeredTestTotal: number;
  readonly exitStatus: number;
  readonly startedAtUtc: string;
  readonly endedAtUtc: string;
  readonly sanitizedOutputDigest: string;
}

export interface DurableFixtureRehearsalValidationReceipt
  extends DurableFixtureRehearsalValidationReceiptInput {
  readonly passed: boolean;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalBackupManifestInput {
  readonly backupId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly storeIdentity: string;
  readonly schemaProfile: "FIXTURE_REHEARSAL_V3";
  readonly migrationNames: readonly [
    "001_collection_runner_core",
    "002_collection_runner_recovery_control",
    "003_fixture_rehearsal_durability",
  ];
  readonly schemaCatalogChecksum: string;
  readonly terminalFreezeFingerprint: string;
  readonly sourceFileIdentity: string;
  readonly backupFileIdentity: string;
  readonly pageCount: number;
  readonly backupBytes: number;
  readonly backupDigest: string;
  readonly createdAtUtc: string;
  readonly retentionPolicyVersion: string;
  readonly nonAuthorityDeclaration:
    typeof DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY;
}

export interface DurableFixtureRehearsalBackupManifest
  extends DurableFixtureRehearsalBackupManifestInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalEnvelopeManifestInput {
  readonly envelopeId: string;
  readonly rehearsalId: string;
  readonly manifestFingerprint: string;
  readonly evidencePlanFingerprint: string;
  readonly backupManifestFingerprint: string;
  readonly validationReceiptFingerprint: string;
  readonly snapshotFingerprint: string;
  readonly backupBytes: number;
  readonly backupDigest: string;
  readonly packageBytesExcludingBackup: number;
  readonly packageInventory: readonly {
    readonly relativePath: string;
    readonly byteLength: number;
    readonly digest: string;
  }[];
  readonly publishedAtUtc: string;
  readonly nonAuthorityDeclaration:
    typeof DURABLE_FIXTURE_REHEARSAL_EVIDENCE_NON_AUTHORITY;
}

export interface DurableFixtureRehearsalEnvelopeManifest
  extends DurableFixtureRehearsalEnvelopeManifestInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface DurableFixtureRehearsalFrozenEvidence {
  readonly evidencePlan: DurableFixtureRehearsalEvidencePlan;
  readonly validationReceipt: DurableFixtureRehearsalValidationReceipt;
  readonly snapshot: DurableFixtureRehearsalSnapshot;
}

export interface DurableFixtureRehearsalEnvelopeVerificationResult {
  readonly disposition: DurableFixtureRehearsalEvidenceDisposition;
  readonly issueCodes: readonly string[];
  readonly envelopeFingerprint: string | null;
  readonly manifestFingerprint: string | null;
  readonly scenarioResultFingerprint: string | null;
  readonly deterministic: true;
  readonly fingerprint: string;
}
