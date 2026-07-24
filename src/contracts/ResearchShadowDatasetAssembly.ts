import type { EventContractShadowHistory } from "./EventContractShadowLedger";
import type { ResearchIntegrityAuditInput } from "./ResearchIntegrity";
import type {
  ResearchDatasetCollectionPlan,
  ResearchDatasetQualificationInput,
} from "./ResearchDatasetQualification";

export const RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION = "1.0" as const;

export enum ResearchShadowDatasetAssemblyStatus {
  Assembled = "ASSEMBLED",
  Blocked = "BLOCKED",
}

export enum ResearchShadowDatasetAssemblyAuthorizationStatus {
  ResearchOnly = "SHADOW_DATASET_RESEARCH_ONLY_NOT_MODEL_OR_TRADE_AUTHORITY",
}

export enum ResearchShadowDatasetAssemblyIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidVersion = "INVALID_VERSION",
  DuplicateIdentity = "DUPLICATE_IDENTITY",
  InvalidPlan = "INVALID_PLAN",
  MissingBinding = "MISSING_BINDING",
  UnplannedBinding = "UNPLANNED_BINDING",
  MissingObservation = "MISSING_OBSERVATION",
  ObservationBindingMismatch = "OBSERVATION_BINDING_MISMATCH",
  ObservationCutoffMismatch = "OBSERVATION_CUTOFF_MISMATCH",
  UnsettledObservation = "UNSETTLED_OBSERVATION",
  SettlementBindingMismatch = "SETTLEMENT_BINDING_MISMATCH",
  IntegrityAuditMismatch = "INTEGRITY_AUDIT_MISMATCH",
  FeatureVersionMismatch = "FEATURE_VERSION_MISMATCH",
}

export interface ResearchShadowDatasetAssemblyBinding {
  readonly eventId: string;
  readonly observationId: string;
  readonly featureSchemaVersion: string;
  readonly featureSetVersion: string;
  readonly integrityAuditInput: ResearchIntegrityAuditInput;
}

export interface ResearchShadowDatasetAssemblyInput {
  readonly schemaVersion: typeof RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION;
  readonly assemblyId: string;
  readonly researchId: string;
  readonly qualificationId: string;
  readonly assembledAt: string;
  readonly collectionPlan: ResearchDatasetCollectionPlan;
  readonly bindings: readonly ResearchShadowDatasetAssemblyBinding[];
  readonly histories: readonly EventContractShadowHistory[];
}

export interface ResearchShadowDatasetAssemblyIssue {
  readonly code: ResearchShadowDatasetAssemblyIssueCode;
  readonly field: string;
  readonly eventId: string | null;
  readonly message: string;
}

export interface ResearchShadowDatasetAssemblyMetrics {
  readonly plannedCount: number;
  readonly bindingCount: number;
  readonly includedCount: number;
  readonly missingCount: number;
  readonly unsettledCount: number;
}

export interface ResearchShadowDatasetAssemblyResult {
  readonly schemaVersion: typeof RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION;
  readonly assemblyId: string;
  readonly researchId: string;
  readonly assembledAt: string;
  readonly planId: string;
  readonly planVersion: string;
  readonly planFingerprint: string;
  readonly ledgerSnapshotFingerprint: string;
  readonly status: ResearchShadowDatasetAssemblyStatus;
  readonly metrics: ResearchShadowDatasetAssemblyMetrics;
  readonly issues: readonly ResearchShadowDatasetAssemblyIssue[];
  readonly qualificationInput: ResearchDatasetQualificationInput | null;
  readonly authorizationStatus: ResearchShadowDatasetAssemblyAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly readOnly: true;
  readonly fingerprint: string;
}
