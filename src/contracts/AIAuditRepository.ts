import type { AITaskType, PrivacyLevel } from "./AIRouter";

export type AIAuditSequence = number;
export type AIAuditIdempotencyKey = string;
export type AIAuditSchemaVersion = "1.0";
export type AIAuditMetadataValue = string | number | boolean | null;
export type AIAuditMetadata = Readonly<Record<string, AIAuditMetadataValue>>;

export enum AIAuditRecordType {
  RoutingDecision = "ROUTING_DECISION",
  CostGovernorDecision = "COST_GOVERNOR_DECISION",
  ReservationOperation = "RESERVATION_OPERATION",
  ExecutionCoordinatorResult = "EXECUTION_COORDINATOR_RESULT",
  ProviderAdapterResult = "PROVIDER_ADAPTER_RESULT",
  CostLedgerAppend = "COST_LEDGER_APPEND",
  CostLedgerReconciliation = "COST_LEDGER_RECONCILIATION",
  SystemValidation = "SYSTEM_VALIDATION",
  OwnerApproval = "OWNER_APPROVAL",
  Error = "ERROR",
  Warning = "WARNING",
  RuntimeWorkflowResult = "RUNTIME_WORKFLOW_RESULT",
  ResearchRecord = "RESEARCH_RECORD",
  PredictionRecord = "PREDICTION_RECORD",
  DecisionRecord = "DECISION_RECORD",
  TradeRecord = "TRADE_RECORD",
  JournalEntry = "JOURNAL_ENTRY",
  StrategyVersion = "STRATEGY_VERSION",
  DevelopmentValidation = "DEVELOPMENT_VALIDATION",
  HistoricalRecord = "HISTORICAL_RECORD",
  HistoricalAnalogy = "HISTORICAL_ANALOGY",
  EventReplay = "EVENT_REPLAY",
  LearningReview = "LEARNING_REVIEW",
  MarketRegimeAssessment = "MARKET_REGIME_ASSESSMENT",
  BroadMarketEvidenceAssessment = "BROAD_MARKET_EVIDENCE_ASSESSMENT",
  EvidenceFusionAssessment = "EVIDENCE_FUSION_ASSESSMENT",
}

export enum AIAuditSourceSubsystem {
  Router = "AI_ROUTER",
  CostGovernor = "AI_COST_GOVERNOR",
  ReservationManager = "AI_RESERVATION_MANAGER",
  ExecutionCoordinator = "AI_EXECUTION_COORDINATOR",
  ProviderAdapter = "AI_PROVIDER_ADAPTER",
  CostLedger = "AI_COST_LEDGER",
  AuditRepository = "AI_AUDIT_REPOSITORY",
  RuntimeWorkflow = "AI_RUNTIME_WORKFLOW",
  Owner = "OWNER",
  Research = "RESEARCH",
  Prediction = "PREDICTION",
  Decision = "DECISION",
  Trade = "TRADE",
  Journal = "JOURNAL",
  StrategyVersioning = "STRATEGY_VERSIONING",
  DevelopmentValidation = "DEVELOPMENT_VALIDATION",
  HistoricalPatternLibrary = "HISTORICAL_PATTERN_LIBRARY",
  HistoricalAnalogyEngine = "HISTORICAL_ANALOGY_ENGINE",
  EventReplay = "EVENT_REPLAY",
  LearningLoop = "LEARNING_LOOP",
  MarketRegimeEngine = "MARKET_REGIME_ENGINE",
  BroadMarketEvidence = "BROAD_MARKET_EVIDENCE",
  EvidenceFusion = "EVIDENCE_FUSION",
}

export enum AIAuditRetentionClassification {
  ShortTerm = "SHORT_TERM",
  Standard = "STANDARD",
  LongTerm = "LONG_TERM",
  Permanent = "PERMANENT",
  LegalHold = "LEGAL_HOLD",
}

export enum AIAuditActorType {
  Owner = "OWNER",
  AlphaSubsystem = "ALPHA_SUBSYSTEM",
  System = "SYSTEM",
  ScheduledJob = "SCHEDULED_JOB",
}

export enum AIAuditImportOrderStatus {
  InOrder = "IN_ORDER",
  StaleAllowed = "STALE_ALLOWED",
}

export enum AIAuditRepositoryType {
  InMemory = "IN_MEMORY",
  LocalNdjson = "LOCAL_NDJSON",
}

export enum AIAuditAppendStatus {
  Appended = "APPENDED",
  Rejected = "REJECTED",
}

export enum AIAuditTraceStatus {
  Complete = "COMPLETE",
  Incomplete = "INCOMPLETE",
  Inconsistent = "INCONSISTENT",
  Empty = "EMPTY",
}

export enum AIAuditIntegrityStatus {
  Valid = "VALID",
  IssuesDetected = "ISSUES_DETECTED",
}

export enum AIAuditExportStatus {
  Exported = "EXPORTED",
  Rejected = "REJECTED",
}

export enum AIAuditExportFormat {
  Ndjson = "NDJSON",
  JsonArray = "JSON_ARRAY",
}

export enum AIAuditExportDestination {
  LocalSnapshot = "LOCAL_SNAPSHOT",
  ExternalTransfer = "EXTERNAL_TRANSFER",
}

export enum AIAuditTraceEdgeType {
  Parent = "PARENT",
  Related = "RELATED",
}

export enum AIAuditRepositoryErrorCategory {
  InvalidRequest = "INVALID_REQUEST",
  InvalidPolicy = "INVALID_POLICY",
  IdempotencyConflict = "IDEMPOTENCY_CONFLICT",
  DuplicateRecord = "DUPLICATE_RECORD",
  DuplicateSourceIdentity = "DUPLICATE_SOURCE_IDENTITY",
  StaleRecord = "STALE_RECORD",
  PrivacyDowngrade = "PRIVACY_DOWNGRADE",
  ExportRestricted = "EXPORT_RESTRICTED",
  SensitiveExportUnauthorized = "SENSITIVE_EXPORT_UNAUTHORIZED",
  RepositoryConflict = "REPOSITORY_CONFLICT",
  CorruptRepository = "CORRUPT_REPOSITORY",
  InvalidPath = "INVALID_PATH",
  Unknown = "UNKNOWN",
}

export enum AIAuditValidationStatus {
  Passed = "PASSED",
  Failed = "FAILED",
}

export enum AIAuditOperationType {
  Append = "APPEND",
  Trace = "TRACE",
  Integrity = "INTEGRITY",
  Export = "EXPORT",
}

export enum AIAuditIntegrityIssueCode {
  DuplicateRecordId = "DUPLICATE_RECORD_ID",
  DuplicateSequence = "DUPLICATE_SEQUENCE",
  DuplicateIdempotencyKey = "DUPLICATE_IDEMPOTENCY_KEY",
  DuplicateSourceIdentity = "DUPLICATE_SOURCE_IDENTITY",
  MissingParent = "MISSING_PARENT",
  MissingRelatedRecord = "MISSING_RELATED_RECORD",
  CyclicParentReference = "CYCLIC_PARENT_REFERENCE",
  RequestMismatch = "REQUEST_ID_MISMATCH",
  CorrelationMismatch = "CORRELATION_ID_MISMATCH",
  TraceMismatch = "TRACE_ID_MISMATCH",
  ReservationMismatch = "RESERVATION_REFERENCE_MISMATCH",
  ExecutionMismatch = "EXECUTION_REFERENCE_MISMATCH",
  LedgerReferenceMismatch = "LEDGER_REFERENCE_MISMATCH",
  PolicyVersionConflict = "POLICY_VERSION_CONFLICT",
  InvalidSubsystemOrder = "INVALID_SUBSYSTEM_ORDER",
  TerminalResultMissing = "TERMINAL_RESULT_MISSING",
  PrivacyDowngrade = "PRIVACY_DOWNGRADE",
  InvalidRetention = "INVALID_RETENTION_CLASSIFICATION",
  MalformedError = "MALFORMED_NORMALIZED_ERROR",
  SequenceInconsistency = "SEQUENCE_INCONSISTENCY",
  CorruptRecord = "CORRUPT_RECORD",
}

export interface AIAuditNormalizedError {
  readonly category: string;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface AIAuditActor {
  readonly type: AIAuditActorType;
  readonly actorId?: string;
}

export interface AIAuditOwnerApproval {
  readonly approvalId: string;
  readonly ownerReference: string;
  readonly approvedSubject: string;
  readonly decision: "APPROVED" | "REJECTED" | "APPROVED_WITH_CONDITIONS";
  readonly conditions: ReadonlyArray<string>;
  readonly reason: string;
  readonly gitReference?: string;
}

export interface AIAuditRecordInput {
  readonly schemaVersion: AIAuditSchemaVersion;
  readonly recordId: string;
  readonly idempotencyKey: AIAuditIdempotencyKey;
  readonly recordType: AIAuditRecordType;
  readonly sourceSubsystem: AIAuditSourceSubsystem;
  readonly sourceRecordId: string;
  readonly sourceRecordVersion?: string;
  readonly timestamp: string;
  readonly requestId?: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly parentAuditRecordIds: ReadonlyArray<string>;
  readonly relatedAuditRecordIds: ReadonlyArray<string>;
  readonly routingDecisionId?: string;
  readonly budgetDecisionId?: string;
  readonly reservationId?: string;
  readonly executionId?: string;
  readonly ledgerEntryIds: ReadonlyArray<string>;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly taskType?: AITaskType;
  readonly policyVersions: Readonly<Record<string, string>>;
  readonly status: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly error?: AIAuditNormalizedError;
  readonly actor: AIAuditActor;
  readonly ownerApproval?: AIAuditOwnerApproval;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly metadata: AIAuditMetadata;
  readonly payloadIntegrityReference?: string;
  readonly sourceAuditReferences: ReadonlyArray<string>;
  readonly finalOutcome: string;
}

export interface AIAuditRecord extends AIAuditRecordInput {
  readonly sequence: AIAuditSequence;
  readonly importOrderStatus: AIAuditImportOrderStatus;
  readonly payloadFingerprint: string;
}

export interface AIAuditPolicy {
  readonly policyId: string;
  readonly version: string;
  readonly requireUniqueSourceIdentity: boolean;
  readonly allowStaleImports: boolean;
  readonly rejectSecretMetadataKeys: boolean;
  readonly preventPrivacyDowngrade: boolean;
  readonly allowExternalExports: boolean;
  readonly requireSensitiveExportAuthorization: boolean;
  readonly sensitiveExportAuthorizationReferences: ReadonlyArray<string>;
}

export interface AIAuditAppendRequest {
  readonly record: AIAuditRecordInput;
  readonly policy: AIAuditPolicy;
}

export interface AIAuditValidationCheck {
  readonly name: string;
  readonly status: AIAuditValidationStatus;
  readonly reason: string;
}

export interface AIAuditRepositoryError {
  readonly category: AIAuditRepositoryErrorCategory;
  readonly code: string;
  readonly safeMessage: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export interface AIAuditIntegrityIssue {
  readonly code: AIAuditIntegrityIssueCode;
  readonly recordId?: string;
  readonly relatedRecordId?: string;
  readonly sequence?: AIAuditSequence;
  readonly reason: string;
}

export interface AIAuditOperationAuditRecord {
  readonly operationId: string;
  readonly operationType: AIAuditOperationType;
  readonly timestamp: string;
  readonly actor: AIAuditActor;
  readonly policyVersion: string;
  readonly recordId?: string;
  readonly validationChecks: ReadonlyArray<AIAuditValidationCheck>;
  readonly idempotencyOutcome: "NEW" | "REPLAY" | "CONFLICT" | "NOT_APPLICABLE";
  readonly assignedSequence?: AIAuditSequence;
  readonly repositoryType: AIAuditRepositoryType;
  readonly integrityIssues: ReadonlyArray<AIAuditIntegrityIssue>;
  readonly exportRestrictions: ReadonlyArray<string>;
  readonly error?: AIAuditRepositoryError;
  readonly finalResult: "APPLIED" | "REPLAYED" | "REJECTED" | "COMPLETE" | "INCOMPLETE" | "INCONSISTENT" | "VALID" | "ISSUES" | "EXPORTED";
}

export interface AIAuditAppendResult {
  readonly status: AIAuditAppendStatus;
  readonly reasons: ReadonlyArray<string>;
  readonly record?: AIAuditRecord;
  readonly operationAudit: AIAuditOperationAuditRecord;
  readonly error?: AIAuditRepositoryError;
}

export interface AIAuditQuery {
  readonly fromSequence?: number;
  readonly toSequence?: number;
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
  readonly recordTypes?: ReadonlyArray<AIAuditRecordType>;
  readonly sourceSubsystems?: ReadonlyArray<AIAuditSourceSubsystem>;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly reservationId?: string;
  readonly executionId?: string;
  readonly ledgerEntryId?: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly taskType?: AITaskType;
  readonly privacyLevels?: ReadonlyArray<PrivacyLevel>;
}

export interface AIAuditQueryResult {
  readonly records: ReadonlyArray<AIAuditRecord>;
  readonly count: number;
  readonly latestSequence: AIAuditSequence;
}

export interface AIAuditTraceRequest {
  readonly operationId: string;
  readonly requestedAt: string;
  readonly policyVersion: string;
  readonly traceId?: string;
  readonly rootRequestId?: string;
}

export interface AIAuditTraceNode {
  readonly recordId: string;
  readonly missing: boolean;
  readonly sequence?: AIAuditSequence;
  readonly recordType?: AIAuditRecordType;
  readonly sourceSubsystem?: AIAuditSourceSubsystem;
  readonly finalOutcome?: string;
}

export interface AIAuditTraceEdge {
  readonly fromRecordId: string;
  readonly toRecordId: string;
  readonly type: AIAuditTraceEdgeType;
}

export interface AIAuditTrace {
  readonly status: AIAuditTraceStatus;
  readonly traceId?: string;
  readonly rootRequestId?: string;
  readonly nodes: ReadonlyArray<AIAuditTraceNode>;
  readonly edges: ReadonlyArray<AIAuditTraceEdge>;
  readonly rootRecordIds: ReadonlyArray<string>;
  readonly leafRecordIds: ReadonlyArray<string>;
  readonly subsystemProgression: ReadonlyArray<AIAuditSourceSubsystem>;
  readonly issues: ReadonlyArray<AIAuditIntegrityIssue>;
  readonly finalOutcome?: string;
  readonly operationAudit: AIAuditOperationAuditRecord;
}

export interface AIAuditIntegrityCheck {
  readonly operationId: string;
  readonly requestedAt: string;
  readonly policyVersion: string;
  readonly query?: AIAuditQuery;
}

export interface AIAuditIntegrityCheckResult {
  readonly status: AIAuditIntegrityStatus;
  readonly checkedRecordCount: number;
  readonly issues: ReadonlyArray<AIAuditIntegrityIssue>;
  readonly operationAudit: AIAuditOperationAuditRecord;
}

export interface AIAuditExportRequest {
  readonly operationId: string;
  readonly requestedAt: string;
  readonly policyVersion: string;
  readonly query: AIAuditQuery;
  readonly format: AIAuditExportFormat;
  readonly destination: AIAuditExportDestination;
  readonly sensitiveAuthorizationReference?: string;
}

export interface AIAuditExportResult {
  readonly status: AIAuditExportStatus;
  readonly schemaVersion: AIAuditSchemaVersion;
  readonly exportedAt: string;
  readonly format: AIAuditExportFormat;
  readonly records: ReadonlyArray<AIAuditRecord>;
  readonly serialized?: string;
  readonly operationAudit: AIAuditOperationAuditRecord;
  readonly error?: AIAuditRepositoryError;
}

export interface AIAuditRepositoryAppendRequest {
  readonly record: AIAuditRecordInput;
  readonly importOrderStatus: AIAuditImportOrderStatus;
  readonly payloadFingerprint: string;
  readonly enforceSourceUniqueness: boolean;
}

export interface AIAuditRepositoryAppendResult {
  readonly appended: boolean;
  readonly record?: AIAuditRecord;
  readonly conflictCategory?: AIAuditRepositoryErrorCategory;
}

export interface AIAuditRepositoryPort {
  readonly repositoryType: AIAuditRepositoryType;
  appendAtomically(request: AIAuditRepositoryAppendRequest): AIAuditRepositoryAppendResult;
  getById(recordId: string): AIAuditRecord | undefined;
  getByIdempotencyKey(idempotencyKey: string): AIAuditRecord | undefined;
  getBySourceIdentity(sourceSubsystem: AIAuditSourceSubsystem, sourceRecordId: string, sourceRecordVersion?: string): AIAuditRecord | undefined;
  listBySequenceRange(fromInclusive: number, toInclusive: number): ReadonlyArray<AIAuditRecord>;
  listByTimestampRange(fromInclusive: string, toInclusive: string): ReadonlyArray<AIAuditRecord>;
  listByRecordType(recordType: AIAuditRecordType): ReadonlyArray<AIAuditRecord>;
  listBySourceSubsystem(sourceSubsystem: AIAuditSourceSubsystem): ReadonlyArray<AIAuditRecord>;
  listByRequestId(requestId: string): ReadonlyArray<AIAuditRecord>;
  listByCorrelationId(correlationId: string): ReadonlyArray<AIAuditRecord>;
  listByTraceId(traceId: string): ReadonlyArray<AIAuditRecord>;
  listByReservationId(reservationId: string): ReadonlyArray<AIAuditRecord>;
  listByExecutionId(executionId: string): ReadonlyArray<AIAuditRecord>;
  listByLedgerEntryId(ledgerEntryId: string): ReadonlyArray<AIAuditRecord>;
  listByProviderModelTask(providerId?: string, modelId?: string, taskType?: AITaskType): ReadonlyArray<AIAuditRecord>;
  listByPrivacyLevel(privacyLevel: PrivacyLevel): ReadonlyArray<AIAuditRecord>;
  latestSequence(): AIAuditSequence;
  allRecords(): ReadonlyArray<AIAuditRecord>;
}

export interface AIAuditRepository {
  append(request: Readonly<AIAuditAppendRequest>): AIAuditAppendResult;
  query(query?: Readonly<AIAuditQuery>): AIAuditQueryResult;
  reconstructTrace(request: Readonly<AIAuditTraceRequest>): AIAuditTrace;
  checkIntegrity(request: Readonly<AIAuditIntegrityCheck>): AIAuditIntegrityCheckResult;
  exportSnapshot(request: Readonly<AIAuditExportRequest>, policy: Readonly<AIAuditPolicy>): AIAuditExportResult;
}

export interface AIAuditTranslationContext {
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly parentAuditRecordIds: ReadonlyArray<string>;
  readonly relatedAuditRecordIds: ReadonlyArray<string>;
  readonly privacyLevel: PrivacyLevel;
  readonly retention: AIAuditRetentionClassification;
  readonly actor: AIAuditActor;
  readonly metadata?: AIAuditMetadata;
  readonly sourceRecordVersion?: string;
}
