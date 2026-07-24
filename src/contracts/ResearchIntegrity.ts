export const RESEARCH_INTEGRITY_SCHEMA_VERSION = "1.0" as const;

export enum ResearchIntegrityMode {
  Forward = "FORWARD",
  HistoricalReplay = "HISTORICAL_REPLAY",
}

export enum ResearchEvidenceKind {
  CanonicalQuote = "CANONICAL_QUOTE",
  CanonicalBar = "CANONICAL_BAR",
  News = "NEWS",
  Filing = "FILING",
  EventContractObservation = "EVENT_CONTRACT_OBSERVATION",
  MarketContext = "MARKET_CONTEXT",
  DatasetFeature = "DATASET_FEATURE",
  Outcome = "OUTCOME",
  Settlement = "SETTLEMENT",
}

export enum ResearchEvidenceAvailabilityBasis {
  SourcePublication = "SOURCE_PUBLICATION",
  ProviderReceipt = "PROVIDER_RECEIPT",
  ExchangeIntervalClose = "EXCHANGE_INTERVAL_CLOSE",
  ReviewedPointInTimeArchive = "REVIEWED_POINT_IN_TIME_ARCHIVE",
}

export enum ResearchEvidenceCompletionStatus {
  PointInTime = "POINT_IN_TIME",
  Final = "FINAL",
  Partial = "PARTIAL",
}

export enum ResearchIntegrityStatus {
  Eligible = "ELIGIBLE",
  Blocked = "BLOCKED",
}

export enum ResearchIntegrityAuthorizationStatus {
  ResearchOnly = "RESEARCH_ONLY_NOT_TRADE_AUTHORITY",
}

export enum ResearchIntegrityIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidSchemaVersion = "INVALID_SCHEMA_VERSION",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidVersion = "INVALID_VERSION",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidFingerprint = "INVALID_FINGERPRINT",
  InvalidEnum = "INVALID_ENUM",
  InvalidPolicy = "INVALID_POLICY",
  InvalidTemporalOrder = "INVALID_TEMPORAL_ORDER",
  DuplicateEvidence = "DUPLICATE_EVIDENCE",
  DatasetMembershipMismatch = "DATASET_MEMBERSHIP_MISMATCH",
  DatasetFingerprintMismatch = "DATASET_FINGERPRINT_MISMATCH",
  DatasetNotFrozen = "DATASET_NOT_FROZEN",
  CutoffAfterEvaluation = "CUTOFF_AFTER_EVALUATION",
  OccurrenceAfterCutoff = "OCCURRENCE_AFTER_CUTOFF",
  PublicationAfterCutoff = "PUBLICATION_AFTER_CUTOFF",
  EvidenceUnavailableAtCutoff = "EVIDENCE_UNAVAILABLE_AT_CUTOFF",
  ForwardReceiptAfterCutoff = "FORWARD_RECEIPT_AFTER_CUTOFF",
  ReceiptAfterEvaluation = "RECEIPT_AFTER_EVALUATION",
  MissingPublicationTime = "MISSING_PUBLICATION_TIME",
  InvalidAvailabilityBasis = "INVALID_AVAILABILITY_BASIS",
  InvalidInterval = "INVALID_INTERVAL",
  IncompleteInterval = "INCOMPLETE_INTERVAL",
  IntervalEndsAfterCutoff = "INTERVAL_ENDS_AFTER_CUTOFF",
  OutcomeLeakage = "OUTCOME_LEAKAGE",
}

export interface ResearchIntegrityIssue {
  readonly code: ResearchIntegrityIssueCode;
  readonly field: string;
  readonly evidenceId: string | null;
  readonly message: string;
}

export interface ResearchIntegrityEvidenceInput {
  readonly evidenceId: string;
  readonly kind: ResearchEvidenceKind;
  readonly sourceId: string;
  readonly sourceRecordId: string;
  readonly occurredAt: string;
  readonly publishedAt: string | null;
  readonly availableAt: string;
  readonly receivedAt: string;
  readonly intervalStartsAt: string | null;
  readonly intervalEndsAt: string | null;
  readonly completionStatus: ResearchEvidenceCompletionStatus;
  readonly availabilityBasis: ResearchEvidenceAvailabilityBasis;
  readonly availabilityReference: string;
  readonly outcomeBearing: boolean;
  readonly fingerprint: string;
}

export interface ResearchIntegrityDatasetManifestInput {
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly frozenAt: string;
  readonly evidenceMembers: readonly ResearchIntegrityDatasetMember[];
}

export interface ResearchIntegrityDatasetMember {
  readonly evidenceId: string;
  readonly evidenceFingerprint: string;
}

export interface ResearchIntegrityAuditInput {
  readonly schemaVersion: typeof RESEARCH_INTEGRITY_SCHEMA_VERSION;
  readonly auditId: string;
  readonly researchId: string;
  readonly mode: ResearchIntegrityMode;
  readonly cutoffAt: string;
  readonly evaluatedAt: string;
  readonly dataset: ResearchIntegrityDatasetManifestInput;
  readonly evidence: readonly ResearchIntegrityEvidenceInput[];
}

export interface ResearchIntegrityPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly maximumEvidenceRecords: number;
}

export interface ResearchIntegrityAudit {
  readonly schemaVersion: typeof RESEARCH_INTEGRITY_SCHEMA_VERSION;
  readonly auditId: string;
  readonly researchId: string;
  readonly mode: ResearchIntegrityMode;
  readonly cutoffAt: string;
  readonly evaluatedAt: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly datasetFrozenAt: string;
  readonly datasetFingerprint: string;
  readonly evidenceCount: number;
  readonly status: ResearchIntegrityStatus;
  readonly issues: readonly ResearchIntegrityIssue[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly ruleSetVersion: string;
  readonly authorizationStatus: ResearchIntegrityAuthorizationStatus.ResearchOnly;
  readonly deterministic: true;
  readonly readOnly: true;
  readonly fingerprint: string;
}

export interface ResearchIntegrityValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ResearchIntegrityIssue[];
}
