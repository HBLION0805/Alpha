import type { AIAuditActor, AIAuditMetadata, AIAuditRecordInput, AIAuditRetentionClassification } from "./AIAuditRepository";
import type { PrivacyLevel } from "./AIRouter";

export const EVIDENCE_FUSION_SCHEMA_VERSION = "1.0" as const;

export enum EvidenceFusionSourceType {
  BroadMarketEvidence = "BROAD_MARKET_EVIDENCE",
}

export enum EvidenceFusionSourceState {
  Complete = "COMPLETE",
  Partial = "PARTIAL",
  Stale = "STALE",
  Contradictory = "CONTRADICTORY",
  Insufficient = "INSUFFICIENT",
}

export enum EvidenceFusionCompleteness {
  Complete = "COMPLETE",
  Incomplete = "INCOMPLETE",
  MissingRequired = "MISSING_REQUIRED",
}

export enum EvidenceFusionFreshness {
  Current = "CURRENT",
  Stale = "STALE",
  Unknown = "UNKNOWN",
}

export enum EvidenceFusionQuality {
  Accepted = "ACCEPTED",
  Rejected = "REJECTED",
  Contradictory = "CONTRADICTORY",
}

export enum EvidenceFusionAssessmentStatus {
  Ready = "READY",
  Blocked = "BLOCKED",
}

export enum EvidenceFusionIssueSeverity {
  Blocker = "BLOCKER",
  Warning = "WARNING",
}

export enum EvidenceFusionIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidSource = "INVALID_SOURCE",
  UnsupportedSource = "UNSUPPORTED_SOURCE",
  DuplicateSource = "DUPLICATE_SOURCE",
  InvalidPolicy = "INVALID_POLICY",
  MissingRequiredSource = "MISSING_REQUIRED_SOURCE",
  SourceIncomplete = "SOURCE_INCOMPLETE",
  SourceStale = "SOURCE_STALE",
  SourceFutureDated = "SOURCE_FUTURE_DATED",
  SourceContradictory = "SOURCE_CONTRADICTORY",
  SourceRejected = "SOURCE_REJECTED",
  SourceWarning = "SOURCE_WARNING",
  EvidenceReferencesInsufficient = "EVIDENCE_REFERENCES_INSUFFICIENT",
}

export interface EvidenceFusionTraceReference {
  readonly correlationId: string;
  readonly traceId: string;
  readonly auditReferenceIds: readonly string[];
}

export interface EvidenceFusionSourceIssue {
  readonly code: string;
  readonly field: string;
  readonly message: string;
}

export interface EvidenceFusionProvenance {
  readonly sourceType: EvidenceFusionSourceType;
  readonly sourceAssessmentId: string;
  readonly sourceSchemaVersion: string;
  readonly sourceSnapshotId: string;
  readonly sourceSnapshotFingerprint: string;
  readonly sourcePolicyId: string;
  readonly sourcePolicyVersion: string;
  readonly sourceRuleSetVersion: string;
  readonly sourceFeatureVersion?: string;
  readonly sourceAssessedAt: string;
  readonly sourceCreatedAt: string;
  readonly sourceAuditReferenceIds: readonly string[];
}

/** Provider-neutral evidence input. Additional source types require a new discriminated adapter. */
export interface EvidenceFusionInput {
  readonly schemaVersion: typeof EVIDENCE_FUSION_SCHEMA_VERSION;
  readonly inputId: string;
  readonly sourceType: EvidenceFusionSourceType.BroadMarketEvidence;
  readonly sourceState: EvidenceFusionSourceState;
  readonly evidenceReferences: readonly string[];
  readonly sourceIssues: readonly EvidenceFusionSourceIssue[];
  readonly sourceWarnings: readonly EvidenceFusionSourceIssue[];
  readonly provenance: EvidenceFusionProvenance;
}

export interface EvidenceFusionSourcePolicy {
  readonly sourceType: EvidenceFusionSourceType;
  readonly required: true;
  readonly acceptedSchemaVersion: string;
  readonly requiredState: EvidenceFusionSourceState.Complete;
  readonly maximumAgeSeconds: number;
  readonly minimumEvidenceReferences: number;
}

export interface EvidenceFusionPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly sourcePolicies: readonly EvidenceFusionSourcePolicy[];
}

export interface EvidenceFusionIssue {
  readonly code: EvidenceFusionIssueCode;
  readonly severity: EvidenceFusionIssueSeverity;
  readonly sourceType?: EvidenceFusionSourceType;
  readonly inputId?: string;
  readonly sourceCode?: string;
  readonly message: string;
}

export interface EvidenceFusionContradiction {
  readonly sourceType: EvidenceFusionSourceType;
  readonly inputId: string;
  readonly sourceCode: string;
  readonly message: string;
}

export interface EvidenceFusionSnapshot {
  readonly schemaVersion: typeof EVIDENCE_FUSION_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly fingerprint: string;
  readonly evaluatedAt: string;
  readonly createdAt: string;
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly evidenceReferences: readonly string[];
  readonly completeness: EvidenceFusionCompleteness;
  readonly freshness: EvidenceFusionFreshness;
  readonly quality: EvidenceFusionQuality;
  readonly contradictions: readonly EvidenceFusionContradiction[];
  readonly blockers: readonly EvidenceFusionIssue[];
  readonly warnings: readonly EvidenceFusionIssue[];
  readonly provenance: readonly EvidenceFusionProvenance[];
  readonly trace: EvidenceFusionTraceReference;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface EvidenceFusionAssessmentRequest {
  readonly schemaVersion: typeof EVIDENCE_FUSION_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly snapshotId: string;
  readonly evaluatedAt: string;
  readonly createdAt: string;
  readonly inputs: readonly EvidenceFusionInput[];
  readonly policy: EvidenceFusionPolicy;
  readonly trace: EvidenceFusionTraceReference;
}

export interface EvidenceFusionAssessment {
  readonly schemaVersion: typeof EVIDENCE_FUSION_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly evaluatedAt: string;
  readonly createdAt: string;
  readonly status: EvidenceFusionAssessmentStatus;
  readonly snapshot: EvidenceFusionSnapshot;
}

export interface EvidenceFusionValidationResult {
  readonly valid: boolean;
  readonly issues: readonly EvidenceFusionIssue[];
}

export interface EvidenceFusionAuditTranslationContext {
  readonly recordId: string;
  readonly idempotencyKey: string;
  readonly parentAuditRecordIds: readonly string[];
  readonly relatedAuditRecordIds: readonly string[];
  readonly actor: AIAuditActor;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly metadata?: AIAuditMetadata;
}

export type EvidenceFusionAuditTranslator = (
  assessment: Readonly<EvidenceFusionAssessment>,
  context: Readonly<EvidenceFusionAuditTranslationContext>,
) => AIAuditRecordInput;
