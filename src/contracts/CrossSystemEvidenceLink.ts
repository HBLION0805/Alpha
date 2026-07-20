export enum EvidenceEntityType {
  Prediction = "PREDICTION",
  StrategyVersion = "STRATEGY_VERSION",
  HistoricalPattern = "HISTORICAL_PATTERN",
  HistoricalAnalogy = "HISTORICAL_ANALOGY",
  EventReplay = "EVENT_REPLAY",
  PredictionOutcome = "PREDICTION_OUTCOME",
  JournalEntry = "JOURNAL_ENTRY",
}

export enum EvidenceRelationType {
  UsedStrategy = "USED_STRATEGY",
  SupportedBy = "SUPPORTED_BY",
  ComparedWith = "COMPARED_WITH",
  ReplayedBy = "REPLAYED_BY",
  ResultedIn = "RESULTED_IN",
  DocumentedBy = "DOCUMENTED_BY",
  LearnedFrom = "LEARNED_FROM",
}

export enum EvidenceEntityResolutionStatus {
  Resolved = "RESOLVED",
  Unresolved = "UNRESOLVED",
  RepositoryUnavailable = "REPOSITORY_UNAVAILABLE",
  VersionMismatch = "VERSION_MISMATCH",
  VersionUnavailable = "VERSION_UNAVAILABLE",
}

export enum EvidenceLinkResolutionStatus {
  Resolved = "RESOLVED",
  Unresolved = "UNRESOLVED",
}

export enum EvidenceLinkWarningCode {
  EntityNotFound = "ENTITY_NOT_FOUND",
  RepositoryUnavailable = "REPOSITORY_UNAVAILABLE",
  VersionMismatch = "VERSION_MISMATCH",
  VersionUnavailable = "VERSION_UNAVAILABLE",
}

export enum EvidenceLinkErrorCode {
  MalformedRequest = "MALFORMED_REQUEST",
  MalformedReference = "MALFORMED_REFERENCE",
  UnsupportedEntityType = "UNSUPPORTED_ENTITY_TYPE",
  UnsupportedRelationType = "UNSUPPORTED_RELATION_TYPE",
  InvalidRelationPairing = "INVALID_RELATION_PAIRING",
  DuplicateLinkId = "DUPLICATE_LINK_ID",
}

export interface EvidenceReference {
  readonly entityType: EvidenceEntityType;
  readonly entityId: string;
  readonly version?: string;
}

export interface EvidenceLink {
  readonly linkId: string;
  readonly source: EvidenceReference;
  readonly relation: EvidenceRelationType;
  readonly target: EvidenceReference;
}

export interface CrossSystemEvidenceLinkRequest {
  readonly links: ReadonlyArray<EvidenceLink>;
}

export interface EvidenceAuditMetadata {
  readonly correlationIds: ReadonlyArray<string>;
  readonly traceIds: ReadonlyArray<string>;
  readonly auditReferenceIds: ReadonlyArray<string>;
}

export interface EvidenceLinkWarning {
  readonly code: EvidenceLinkWarningCode;
  readonly endpoint: "SOURCE" | "TARGET";
  readonly entityType: EvidenceEntityType;
  readonly entityId: string;
  readonly message: string;
}

export interface EvidenceEntityResolution {
  readonly reference: EvidenceReference;
  readonly status: EvidenceEntityResolutionStatus;
  readonly resolvedVersion?: string;
  readonly recordStatus?: string;
  readonly audit: EvidenceAuditMetadata;
  readonly warnings: ReadonlyArray<EvidenceLinkWarning>;
}

export interface ResolvedEvidenceLink {
  readonly linkId: string;
  readonly source: EvidenceEntityResolution;
  readonly relation: EvidenceRelationType;
  readonly target: EvidenceEntityResolution;
  readonly status: EvidenceLinkResolutionStatus;
  readonly warnings: ReadonlyArray<EvidenceLinkWarning>;
}

export interface CrossSystemEvidenceLinkResult {
  readonly links: ReadonlyArray<ResolvedEvidenceLink>;
  readonly warnings: ReadonlyArray<EvidenceLinkWarning>;
  readonly deterministic: true;
  readonly readOnly: true;
}
