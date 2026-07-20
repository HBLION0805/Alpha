import type {
  CrossSystemEvidenceLinkResult,
  EvidenceAuditMetadata,
  EvidenceEntityResolutionStatus,
  EvidenceEntityType,
  EvidenceReference,
  EvidenceRelationType,
} from "./CrossSystemEvidenceLink";

export const EVIDENCE_ASSESSMENT_SCHEMA_VERSION = "1.0" as const;

export enum EvidenceAssessmentStatus {
  Sufficient = "SUFFICIENT",
  Insufficient = "INSUFFICIENT",
  Conflicting = "CONFLICTING",
  Unavailable = "UNAVAILABLE",
}

export enum EvidenceRequirement {
  Required = "REQUIRED",
  Optional = "OPTIONAL",
}

export enum EvidenceItemResolutionStatus {
  Accepted = "ACCEPTED",
  Unresolved = "UNRESOLVED",
  Unavailable = "UNAVAILABLE",
  Stale = "STALE",
  Conflicting = "CONFLICTING",
  Rejected = "REJECTED",
}

export enum EvidenceDimension {
  Availability = "AVAILABILITY",
  Completeness = "COMPLETENESS",
  Freshness = "FRESHNESS",
  Provenance = "PROVENANCE",
  Consistency = "CONSISTENCY",
  VersionCompatibility = "VERSION_COMPATIBILITY",
}

export enum EvidenceDimensionStatus {
  Satisfied = "SATISFIED",
  Partial = "PARTIAL",
  Failed = "FAILED",
  NotAssessed = "NOT_ASSESSED",
}

export enum EvidenceConflictReason {
  ContradictoryFact = "CONTRADICTORY_FACT",
  IncompatibleObservationWindow = "INCOMPATIBLE_OBSERVATION_WINDOW",
  InconsistentStatus = "INCONSISTENT_STATUS",
  InconsistentVersion = "INCONSISTENT_VERSION",
}

export enum EvidenceAssessmentBlockerCode {
  NoEvidence = "NO_EVIDENCE",
  MinimumRequiredEvidenceNotMet = "MINIMUM_REQUIRED_EVIDENCE_NOT_MET",
  RequiredEvidenceUnresolved = "REQUIRED_EVIDENCE_UNRESOLVED",
  RequiredSourceUnavailable = "REQUIRED_SOURCE_UNAVAILABLE",
  RequiredEvidenceStale = "REQUIRED_EVIDENCE_STALE",
  RequiredFreshnessUnknown = "REQUIRED_FRESHNESS_UNKNOWN",
  RequiredProvenanceMissing = "REQUIRED_PROVENANCE_MISSING",
  RequiredVersionUnverifiable = "REQUIRED_VERSION_UNVERIFIABLE",
  RequiredEvidenceConflicting = "REQUIRED_EVIDENCE_CONFLICTING",
}

export enum EvidenceAssessmentWarningCode {
  OptionalEvidenceUnresolved = "OPTIONAL_EVIDENCE_UNRESOLVED",
  OptionalSourceUnavailable = "OPTIONAL_SOURCE_UNAVAILABLE",
  OptionalEvidenceStale = "OPTIONAL_EVIDENCE_STALE",
  OptionalFreshnessUnknown = "OPTIONAL_FRESHNESS_UNKNOWN",
  OptionalProvenanceMissing = "OPTIONAL_PROVENANCE_MISSING",
  OptionalVersionUnverifiable = "OPTIONAL_VERSION_UNVERIFIABLE",
  OptionalEvidenceConflicting = "OPTIONAL_EVIDENCE_CONFLICTING",
}

export enum EvidenceAssessmentErrorCode {
  MalformedRequest = "MALFORMED_REQUEST",
  MalformedEvidenceReference = "MALFORMED_EVIDENCE_REFERENCE",
  UnsupportedEvidenceType = "UNSUPPORTED_EVIDENCE_TYPE",
  MalformedLinkedEvidence = "MALFORMED_LINKED_EVIDENCE",
  SubjectNotLinked = "SUBJECT_NOT_LINKED",
  DuplicateEvidenceItem = "DUPLICATE_EVIDENCE_ITEM",
  UnmappedEvidenceLink = "UNMAPPED_EVIDENCE_LINK",
  DuplicateConflict = "DUPLICATE_CONFLICT",
  InvalidConflict = "INVALID_CONFLICT",
  InvalidPolicy = "INVALID_POLICY",
  InvalidTimestamp = "INVALID_TIMESTAMP",
}

export interface EvidenceFreshnessRule {
  readonly entityType: EvidenceEntityType;
  readonly maximumAgeSeconds: number;
}

export interface EvidenceAssessmentPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly minimumRequiredEvidence: number;
  readonly requireProvenanceForRequiredEvidence: boolean;
  readonly requireExplicitVersionForRequiredEvidence: boolean;
  readonly freshnessRules: ReadonlyArray<EvidenceFreshnessRule>;
}

export interface EvidenceAssessmentItemInput {
  readonly itemId: string;
  readonly linkId: string;
  readonly requirement: EvidenceRequirement;
  /** Authoritative observation time for the target evidence record. */
  readonly observedAt?: string;
}

export interface EvidenceConflictInput {
  readonly conflictId: string;
  readonly itemIds: ReadonlyArray<string>;
  readonly field: string;
  readonly reason: EvidenceConflictReason;
}

export interface EvidenceAssessmentRequest {
  readonly schemaVersion: typeof EVIDENCE_ASSESSMENT_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly subject: EvidenceReference;
  readonly evaluatedAt: string;
  readonly policy: EvidenceAssessmentPolicy;
  readonly linkedEvidence: CrossSystemEvidenceLinkResult;
  /** Every resolved-link view entry must have exactly one explicit assessment item. */
  readonly evidenceItems: ReadonlyArray<EvidenceAssessmentItemInput>;
  readonly conflicts: ReadonlyArray<EvidenceConflictInput>;
}

export interface EvidenceAssessmentIssue<TCode extends string> {
  readonly code: TCode;
  readonly itemIds: ReadonlyArray<string>;
  readonly message: string;
}

export interface EvidenceDimensionAssessment {
  readonly dimension: EvidenceDimension;
  readonly status: EvidenceDimensionStatus;
  readonly affectedItemIds: ReadonlyArray<string>;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface AssessedEvidenceItem {
  readonly itemId: string;
  readonly linkId: string;
  readonly requirement: EvidenceRequirement;
  readonly relation: EvidenceRelationType;
  readonly source: EvidenceReference;
  readonly target: EvidenceReference;
  readonly sourceResolution: EvidenceEntityResolutionStatus;
  readonly targetResolution: EvidenceEntityResolutionStatus;
  readonly sourceResolvedVersion?: string;
  readonly targetResolvedVersion?: string;
  readonly status: EvidenceItemResolutionStatus;
  readonly observedAt?: string;
  readonly ageSeconds?: number;
  readonly freshnessThresholdSeconds?: number;
  readonly sourceProvenance: EvidenceAuditMetadata;
  readonly targetProvenance: EvidenceAuditMetadata;
  readonly reasonCodes: ReadonlyArray<string>;
}

export interface EvidenceCompletenessMetric {
  readonly numerator: number;
  readonly denominator: number;
}

export interface EvidenceAssessmentMetrics {
  readonly totalEvidenceItems: number;
  readonly requiredEvidenceItems: number;
  readonly optionalEvidenceItems: number;
  readonly acceptedRequiredEvidenceItems: number;
  readonly acceptedOptionalEvidenceItems: number;
  /** A visible count ratio, never a probability or confidence score. */
  readonly requiredCompleteness: EvidenceCompletenessMetric;
}

export interface EvidenceAssessmentTrace {
  readonly correlationIds: ReadonlyArray<string>;
  readonly traceIds: ReadonlyArray<string>;
  readonly auditReferenceIds: ReadonlyArray<string>;
}

export interface EvidenceAssessment {
  readonly schemaVersion: typeof EVIDENCE_ASSESSMENT_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly subject: EvidenceReference;
  readonly evaluatedAt: string;
  readonly overallStatus: EvidenceAssessmentStatus;
  readonly policy: EvidenceAssessmentPolicy;
  readonly evidenceItems: ReadonlyArray<AssessedEvidenceItem>;
  readonly acceptedEvidenceItemIds: ReadonlyArray<string>;
  readonly unresolvedEvidenceItemIds: ReadonlyArray<string>;
  readonly rejectedEvidenceItemIds: ReadonlyArray<string>;
  readonly unavailableEvidenceItemIds: ReadonlyArray<string>;
  readonly staleEvidenceItemIds: ReadonlyArray<string>;
  readonly conflictingEvidenceItemIds: ReadonlyArray<string>;
  readonly blockers: ReadonlyArray<EvidenceAssessmentIssue<EvidenceAssessmentBlockerCode>>;
  readonly warnings: ReadonlyArray<EvidenceAssessmentIssue<EvidenceAssessmentWarningCode>>;
  readonly dimensions: ReadonlyArray<EvidenceDimensionAssessment>;
  readonly metrics: EvidenceAssessmentMetrics;
  readonly conflicts: ReadonlyArray<EvidenceConflictInput>;
  readonly trace: EvidenceAssessmentTrace;
  readonly deterministic: true;
  readonly readOnly: true;
}
