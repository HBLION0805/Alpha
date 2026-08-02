export const LIVE_READONLY_AUTHORIZATION_SCHEMA_VERSION = "1.1" as const;
export const EXCHANGE_CALENDAR_EVIDENCE_SCHEMA_VERSION = "1.0" as const;
export const OWNER_AUTHORIZATION_DOMAIN = "ALPHA_OWNER_NETWORK_AUTHORIZATION_V1\0" as const;
export const EXCHANGE_CALENDAR_DOMAIN = "ALPHA_EXCHANGE_CALENDAR_EVIDENCE_V1\0" as const;

export type LiveReadonlyInterval = "P1D" | "PT1H" | "PT15M" | "PT5M" | "NONE";
export type LiveReadonlyCapability = "BARS" | "LATEST_QUOTES";

export interface LiveReadonlyRequestPlanEntry {
  readonly ordinal: number;
  readonly method: "GET";
  readonly host: "data.alpaca.markets";
  readonly path: "/v2/stocks/bars" | "/v2/stocks/quotes/latest";
  readonly capability: LiveReadonlyCapability;
  readonly interval: LiveReadonlyInterval;
  readonly symbols: readonly string[];
  readonly feed: "iex";
  readonly currency: "USD";
  readonly adjustment: "raw" | "NONE";
  readonly sort: "asc" | "NONE";
  readonly start: string | null;
  readonly end: string | null;
  readonly limit: number | null;
  readonly timeoutMs: number;
  readonly maximumResponseBytes: number;
  readonly maximumEvidenceRecords: number;
  readonly calendarEvidenceFingerprint: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly requestFingerprint: string;
}

export interface OwnerNetworkAuthorizationBody {
  readonly schemaVersion: typeof LIVE_READONLY_AUTHORIZATION_SCHEMA_VERSION;
  readonly authorizationType: "PERSONAL_DAILY_SCAN_LIVE_READONLY";
  readonly authorizationId: string;
  readonly ownerDecisionReference: string;
  readonly executeDate: string;
  readonly validFrom: string;
  readonly expiresAt: string;
  readonly provider: "ALPACA_MARKET_DATA";
  readonly feed: "iex";
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly calendarEvidenceId: string;
  readonly calendarEvidenceFingerprint: string;
  readonly planFingerprint: string;
  readonly maximumNetworkRequests: 5;
  readonly maximumAttemptsPerRequest: 1;
  readonly retryAllowed: false;
  readonly paginationAllowed: false;
  readonly pollingAllowed: false;
  readonly streamingAllowed: false;
  readonly backgroundExecutionAllowed: false;
  readonly credentialReadAllowedAfterPreflightOnly: true;
  readonly persistenceAllowed: false;
  readonly accountAccessAllowed: false;
  readonly positionAccessAllowed: false;
  readonly balanceAccessAllowed: false;
  readonly orderAccessAllowed: false;
  readonly brokerAllowed: false;
  readonly paperTradingAllowed: false;
  readonly automatedExecutionAllowed: false;
  readonly requests: readonly LiveReadonlyRequestPlanEntry[];
}

export interface OwnerApprovalEnvelope {
  readonly manifestSha256: string;
  readonly signatureAlgorithm: "Ed25519";
  readonly ownerKeyId: string;
  readonly ownerPublicKeyFingerprint: string;
  readonly ownerSignature: string;
}

export interface OwnerNetworkAuthorizationManifest {
  readonly authorizationBody: OwnerNetworkAuthorizationBody;
  readonly ownerApprovalEnvelope: OwnerApprovalEnvelope;
}

export interface TrustedOwnerVerificationKey {
  readonly source: "PINNED_PRODUCT_CONFIGURATION";
  readonly ownerKeyId: string;
  readonly publicKeyPem: string;
  readonly publicKeyFingerprint: string;
}

export interface OwnerTrustRootProvider {
  getPinnedOwnerVerificationKey(): TrustedOwnerVerificationKey | undefined;
}

export type ExchangeCalendarSessionStatus = "TRADING_SESSION" | "MARKET_HOLIDAY" | "WEEKEND";

export interface ExchangeCalendarSession {
  readonly sessionDate: string;
  readonly status: ExchangeCalendarSessionStatus;
  readonly marketOpen: string | null;
  readonly marketClose: string | null;
  readonly earlyClose: boolean;
}

export interface ExchangeCalendarBody {
  readonly schemaVersion: typeof EXCHANGE_CALENDAR_EVIDENCE_SCHEMA_VERSION;
  readonly evidenceId: string;
  readonly calendarId: "US_EQUITIES_PRIMARY_SESSION";
  readonly calendarVersion: string;
  readonly producerId: string;
  readonly producerVersion: string;
  readonly authoritySource: string;
  readonly ownerDecisionReference: string;
  readonly timezone: "America/New_York";
  readonly validFrom: string;
  readonly validThrough: string;
  readonly closureBufferSeconds: number;
  readonly sessions: readonly ExchangeCalendarSession[];
}

export interface ExchangeCalendarApprovalEnvelope {
  readonly calendarSha256: string;
  readonly signatureAlgorithm: "Ed25519";
  readonly ownerKeyId: string;
  readonly ownerPublicKeyFingerprint: string;
  readonly ownerSignature: string;
}

export interface ExchangeCalendarEvidence {
  readonly calendarBody: ExchangeCalendarBody;
  readonly ownerApprovalEnvelope: ExchangeCalendarApprovalEnvelope;
}

export type LiveReadonlyMarketPhase =
  | "PRE_MARKET"
  | "REGULAR_SESSION"
  | "POST_CLOSE_BUFFER"
  | "POST_CLOSE"
  | "NON_TRADING_DAY";

export enum LiveReadonlyPreflightIssueCode {
  OwnerAuthorizationVerificationKeyUnavailable = "OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE",
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidAuthorizationManifest = "INVALID_AUTHORIZATION_MANIFEST",
  InvalidAuthorizationWindow = "INVALID_AUTHORIZATION_WINDOW",
  AuthorizationNotYetValid = "AUTHORIZATION_NOT_YET_VALID",
  AuthorizationExpired = "AUTHORIZATION_EXPIRED",
  ExecuteDateConflict = "EXECUTE_DATE_CONFLICT",
  RequestPlanInvalid = "REQUEST_PLAN_INVALID",
  RequestFingerprintMismatch = "REQUEST_FINGERPRINT_MISMATCH",
  PlanFingerprintMismatch = "PLAN_FINGERPRINT_MISMATCH",
  ManifestHashMismatch = "MANIFEST_HASH_MISMATCH",
  OwnerKeyMismatch = "OWNER_AUTHORIZATION_KEY_MISMATCH",
  OwnerPublicKeyFingerprintMismatch = "OWNER_PUBLIC_KEY_FINGERPRINT_MISMATCH",
  OwnerSignatureInvalid = "OWNER_AUTHORIZATION_SIGNATURE_INVALID",
  InvalidCalendarEvidence = "INVALID_EXCHANGE_CALENDAR_EVIDENCE",
  CalendarFingerprintMismatch = "EXCHANGE_CALENDAR_FINGERPRINT_MISMATCH",
  CalendarOwnerApprovalInvalid = "EXCHANGE_CALENDAR_OWNER_APPROVAL_INVALID",
  CalendarEvidenceUnavailable = "EXCHANGE_CALENDAR_EVIDENCE_UNAVAILABLE",
  CalendarEvidenceExpired = "EXCHANGE_CALENDAR_EVIDENCE_EXPIRED",
  CalendarDateConflict = "EXCHANGE_CALENDAR_DATE_CONFLICT",
  CompletedReferenceSessionUnavailable = "COMPLETED_REFERENCE_SESSION_UNAVAILABLE",
}

export interface LiveReadonlySideEffectBoundary {
  readonly attemptedNetworkRequests: 0;
  readonly completedNetworkRequests: 0;
  readonly persistenceWrites: 0;
  readonly automatedExecutionAllowed: false;
}

export interface LiveReadonlyPreflightResult extends LiveReadonlySideEffectBoundary {
  readonly status: "VERIFIED" | "BLOCKED";
  readonly issueCodes: readonly LiveReadonlyPreflightIssueCode[];
  readonly authorizationId: string | null;
  readonly manifestSha256: string | null;
  readonly calendarEvidenceId: string | null;
  readonly calendarFingerprint: string | null;
  readonly marketPhase: LiveReadonlyMarketPhase | null;
  readonly referenceSessionDate: string | null;
  readonly credentialReadPermitted: boolean;
  readonly candidates: readonly never[];
}

export interface LiveReadonlyPreflightInput {
  readonly asOf: string;
  readonly manifest: unknown;
  readonly calendarEvidence: unknown;
}

export interface OwnerAuthorizationVerifier {
  evaluate(input: unknown): LiveReadonlyPreflightResult;
}
