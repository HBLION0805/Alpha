import type {
  EventContractEvaluationMethod,
  EventContractFixedDecimal,
  EventContractObservationEventType,
  EventContractThresholdOperator,
} from "./EventContractObservation";

export const EVENT_CONTRACT_SOURCE_SCHEMA_VERSION = "1.0" as const;

export enum EventContractSourceClass {
  Platform = "PLATFORM",
  Exchange = "EXCHANGE",
  SettlementReference = "SETTLEMENT_REFERENCE",
  OperatorEvidence = "OPERATOR_EVIDENCE",
}

export enum EventContractSourceCapability {
  MarketDiscovery = "MARKET_DISCOVERY",
  ContractTerms = "CONTRACT_TERMS",
  TopOfBook = "TOP_OF_BOOK",
  Trades = "TRADES",
  Settlement = "SETTLEMENT",
  ReferencePrice = "REFERENCE_PRICE",
}

export enum EventContractSourceExecutionMode {
  Fixture = "FIXTURE",
  BoundedLiveRead = "BOUNDED_LIVE_READ",
}

export enum EventContractSourceCredentialMode {
  None = "NONE",
  ReadOnlyDataCredential = "READ_ONLY_DATA_CREDENTIAL",
}

export enum EventContractSourceMappingReviewStatus {
  Pending = "PENDING",
  ReviewedExact = "REVIEWED_EXACT",
  Rejected = "REJECTED",
}

export enum EventContractSourceAuthorizationStatus {
  ResearchSourceOnly = "RESEARCH_SOURCE_ONLY_NOT_OBSERVATION_OR_TRADE_AUTHORITY",
}

export enum EventContractSourceIssueCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidIdentifier = "INVALID_IDENTIFIER",
  InvalidVersion = "INVALID_VERSION",
  InvalidTimestamp = "INVALID_TIMESTAMP",
  InvalidFingerprint = "INVALID_FINGERPRINT",
  InvalidProvider = "INVALID_PROVIDER",
  InvalidCapability = "INVALID_CAPABILITY",
  InvalidCredentialMode = "INVALID_CREDENTIAL_MODE",
  InvalidExecutionMode = "INVALID_EXECUTION_MODE",
  InvalidMapping = "INVALID_MAPPING",
  MappingMismatch = "MAPPING_MISMATCH",
  MappingNotEligible = "MAPPING_NOT_ELIGIBLE",
  InvalidTerms = "INVALID_TERMS",
  InvalidChronology = "INVALID_CHRONOLOGY",
  InvalidBound = "INVALID_BOUND",
  UnauthorizedLiveRead = "UNAUTHORIZED_LIVE_READ",
}

export interface EventContractSourceProviderInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_SOURCE_SCHEMA_VERSION;
  readonly providerId: string;
  readonly displayName: string;
  readonly sourceClass: EventContractSourceClass;
  readonly exchangeId: string | null;
  readonly capabilities: readonly EventContractSourceCapability[];
  readonly executionModes: readonly EventContractSourceExecutionMode[];
  readonly credentialMode: EventContractSourceCredentialMode;
  readonly documentationReferences: readonly string[];
  readonly active: boolean;
}

export interface EventContractSourceProvider extends EventContractSourceProviderInput {
  readonly fingerprint: string;
  readonly authorizationStatus: EventContractSourceAuthorizationStatus.ResearchSourceOnly;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface EventContractSourceTerms {
  readonly title: string;
  readonly termsVersion: string;
  readonly eventType: EventContractObservationEventType;
  readonly instrumentId: string;
  readonly outcomePair: string;
  readonly windowStartsAt: string;
  readonly tradingClosesAt: string;
  readonly evaluatesAt: string;
  readonly evaluationMethod: EventContractEvaluationMethod;
  readonly thresholdOperator: EventContractThresholdOperator;
  readonly targetPrice: EventContractFixedDecimal;
  readonly settlementSourceId: string;
}

export interface RobinhoodEventContractSourceIdentity {
  readonly exchangeId: string;
  readonly marketId: string;
  readonly contractId: string;
  readonly termsId: string;
}

export interface ExternalEventContractSourceIdentity {
  readonly providerId: string;
  readonly exchangeId: string;
  readonly eventId: string;
  readonly marketId: string;
  readonly contractId: string;
  readonly nativeTicker: string;
}

export interface EventContractSourceMappingInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_SOURCE_SCHEMA_VERSION;
  readonly mappingId: string;
  readonly version: string;
  readonly createdAt: string;
  readonly reviewStatus: EventContractSourceMappingReviewStatus;
  readonly reviewedAt: string | null;
  readonly reviewerId: string | null;
  readonly evidenceIds: readonly string[];
  readonly provider: EventContractSourceProvider;
  readonly robinhoodIdentity: RobinhoodEventContractSourceIdentity;
  readonly externalIdentity: ExternalEventContractSourceIdentity;
  readonly robinhoodTerms: EventContractSourceTerms;
  readonly externalTerms: EventContractSourceTerms;
}

export interface EventContractSourceMapping extends EventContractSourceMappingInput {
  readonly eligibleForCollection: boolean;
  readonly fingerprint: string;
  readonly authorizationStatus: EventContractSourceAuthorizationStatus.ResearchSourceOnly;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface EventContractSourceSnapshotInput {
  readonly schemaVersion: typeof EVENT_CONTRACT_SOURCE_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly provider: EventContractSourceProvider;
  readonly mapping: EventContractSourceMapping | null;
  readonly capability: EventContractSourceCapability;
  readonly executionMode: EventContractSourceExecutionMode;
  readonly sourceRecordId: string;
  readonly observedAt: string;
  readonly publishedAt: string | null;
  readonly receivedAt: string;
  readonly normalizedAt: string;
  readonly payloadFingerprint: string;
  readonly rawPayloadBytes: number;
  readonly recordCount: number;
}

export interface EventContractSourceSnapshot extends EventContractSourceSnapshotInput {
  readonly providerFingerprint: string;
  readonly mappingFingerprint: string | null;
  readonly fingerprint: string;
  readonly authorizationStatus: EventContractSourceAuthorizationStatus.ResearchSourceOnly;
  readonly deterministic: true;
  readonly readOnly: true;
}

export interface EventContractSourcePolicy {
  readonly policyId: string;
  readonly version: string;
  readonly ruleSetVersion: string;
  readonly allowedSnapshotExecutionModes: readonly EventContractSourceExecutionMode[];
  readonly maximumRawPayloadBytes: number;
  readonly maximumRecordCount: number;
}

export interface EventContractSourceIssue {
  readonly code: EventContractSourceIssueCode;
  readonly field: string;
  readonly message: string;
}
