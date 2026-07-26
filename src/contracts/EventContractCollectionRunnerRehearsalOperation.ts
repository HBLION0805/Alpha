import type { CollectionRunnerRehearsalFixtureCatalogEntry } from "./EventContractCollectionRunnerFixtureRehearsal";

export const EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION =
  "1.0" as const;
export const COLLECTION_RUNNER_REHEARSAL_OPERATION_COMMAND_IDENTITY =
  "ALPHA_VALIDATE_NPM_CMD_V1" as const;
export const COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION =
  "FIXTURE_REHEARSAL_OPERATION_ONLY_NOT_LIVE_DATA_DATASET_RECOMMENDATION_OR_TRADING_AUTHORITY" as const;
export const COLLECTION_RUNNER_REHEARSAL_OPERATION_REQUIRED_ROOT_COUNT = 6;
export const COLLECTION_RUNNER_REHEARSAL_OPERATION_MAX_PHASES = 32;
export const COLLECTION_RUNNER_REHEARSAL_OPERATION_MAX_RECOVERIES = 4;

export enum CollectionRunnerRehearsalOperationRootPurpose {
  Control = "CONTROL_ROOT",
  Workspace = "WORKSPACE_ROOT",
  Sqlite = "SQLITE_ROOT",
  Backup = "BACKUP_ROOT",
  Evidence = "EVIDENCE_ROOT",
  AlphaRepository = "ALPHA_REPOSITORY_ROOT",
}

export enum CollectionRunnerRehearsalOperationRootCreationPolicy {
  ExistingRegisteredRoot = "EXISTING_REGISTERED_ROOT",
  ExistingReadOnlyRepository = "EXISTING_READ_ONLY_REPOSITORY",
}

export enum CollectionRunnerRehearsalOperationPhase {
  Prepare = "PREPARE",
  Step = "STEP",
  Recover = "RECOVER",
  Validate = "VALIDATE",
  Freeze = "FREEZE",
  Package = "PACKAGE",
  Verify = "VERIFY",
}

export interface CollectionRunnerRehearsalOperationRootRegistrationInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION;
  readonly rootId: string;
  readonly purpose: CollectionRunnerRehearsalOperationRootPurpose;
  readonly canonicalPath: string;
  readonly pathIdentity: string;
  readonly filesystemIdentityFingerprint: string;
  readonly inspectionEvidenceFingerprint: string;
  readonly inspectedAtUtc: string;
  readonly creationPolicy: CollectionRunnerRehearsalOperationRootCreationPolicy;
  readonly linkOrReparsePointDetected: false;
}

export interface CollectionRunnerRehearsalOperationRootRegistration
  extends CollectionRunnerRehearsalOperationRootRegistrationInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationRootRegistryInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly registrations: readonly CollectionRunnerRehearsalOperationRootRegistration[];
}

export interface CollectionRunnerRehearsalOperationRootRegistry
  extends CollectionRunnerRehearsalOperationRootRegistryInput {
  readonly rootRegistryId: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationValidationAuthorityInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly repositoryRootId: string;
  readonly alphaCommit: string;
  readonly cleanTreeRequired: true;
  readonly packageFingerprint: string;
  readonly validationSuiteFingerprint: string;
  readonly registeredTestTotal: number;
  readonly commandIdentity:
    typeof COLLECTION_RUNNER_REHEARSAL_OPERATION_COMMAND_IDENTITY;
  readonly recursionPolicyVersion: string;
  readonly networkPermitted: false;
  readonly credentialAccessPermitted: false;
}

export interface CollectionRunnerRehearsalOperationValidationAuthority
  extends CollectionRunnerRehearsalOperationValidationAuthorityInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationPhasePlanEntry {
  readonly ordinal: number;
  readonly phase: Exclude<
    CollectionRunnerRehearsalOperationPhase,
    CollectionRunnerRehearsalOperationPhase.Recover
  >;
  readonly expectedStepOrdinal: number | null;
}

export interface CollectionRunnerRehearsalOperationRootBinding {
  readonly purpose: CollectionRunnerRehearsalOperationRootPurpose;
  readonly rootId: string;
  readonly rootFingerprint: string;
}

export interface CollectionRunnerRehearsalOperationManifestProposalInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION;
  readonly policyVersion: string;
  readonly rehearsalId: string;
  readonly rehearsalManifestFingerprint: string;
  readonly alphaCommit: string;
  readonly runtimeBuildFingerprint: string;
  readonly fixtureCatalogEntryId: string;
  readonly fixtureCatalogEntryFingerprint: string;
  readonly providerFingerprint: string;
  readonly mappingFingerprint: string;
  readonly runnerDefinitionFingerprint: string;
  readonly frozenPlanFingerprint: string;
  readonly rootRegistryFingerprint: string;
  readonly rootBindings: readonly CollectionRunnerRehearsalOperationRootBinding[];
  readonly validationAuthorityFingerprint: string;
  readonly phasePlan: readonly CollectionRunnerRehearsalOperationPhasePlanEntry[];
  readonly maximumPhaseInvocations: number;
  readonly recoveryPolicyVersion: string;
  readonly maximumRecoveryInvocations: number;
  readonly plannedBackupId: string;
  readonly plannedPackageId: string;
  readonly plannedEnvelopeId: string;
  readonly retentionPolicyVersion: string;
  readonly createdAtUtc: string;
  readonly nonAuthorityDeclaration:
    typeof COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION;
}

export interface CollectionRunnerRehearsalOperationManifestProposal
  extends CollectionRunnerRehearsalOperationManifestProposalInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationOwnerApprovalInput {
  readonly schemaVersion:
    typeof EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION;
  readonly approvalId: string;
  readonly ownerId: string;
  readonly approvedProposalFingerprint: string;
  readonly approvedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly localAuthenticationPolicyVersion: string;
  readonly nonAuthorityDeclaration:
    typeof COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION;
}

export interface CollectionRunnerRehearsalOperationOwnerApproval
  extends CollectionRunnerRehearsalOperationOwnerApprovalInput {
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationManifest {
  readonly proposal: CollectionRunnerRehearsalOperationManifestProposal;
  readonly ownerApproval: CollectionRunnerRehearsalOperationOwnerApproval;
  readonly operationId: string;
  readonly deterministic: true;
  readonly fingerprint: string;
}

export interface CollectionRunnerRehearsalOperationRegistryInput {
  readonly rootRegistry: CollectionRunnerRehearsalOperationRootRegistry;
  readonly fixtureCatalogEntries: readonly CollectionRunnerRehearsalFixtureCatalogEntry[];
  readonly validationAuthorities: readonly CollectionRunnerRehearsalOperationValidationAuthority[];
  readonly manifests: readonly CollectionRunnerRehearsalOperationManifest[];
}

export interface CollectionRunnerRehearsalOperationRegistrySnapshot {
  readonly rootRegistryFingerprint: string;
  readonly fixtureCatalogEntryFingerprints: readonly string[];
  readonly validationAuthorityFingerprints: readonly string[];
  readonly operationManifestFingerprints: readonly string[];
  readonly deterministic: true;
  readonly fingerprint: string;
}
