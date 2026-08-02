import type { CanonicalBarReference, CanonicalQuoteReference, EvidenceResolution, ProviderRequestAttempt } from "./VerifiedMarketSnapshot";
import type { LiveReadonlyCapability, LiveReadonlyInterval, LiveReadonlyPreflightInput } from "./PersonalDailyScanLiveReadonly";

export const LIVE_READONLY_MARKET_SCOPE_SCHEMA_VERSION = "1.2" as const;
export const LIVE_READONLY_MARKET_SCOPE_POLICY_VERSION = "phase1b-d2-c2-r2:1.0" as const;
export const LIVE_READONLY_PROVIDER_SEMANTICS_SCHEMA_VERSION = "1.0" as const;

export interface LiveReadonlyQueryParameter {
  readonly name: string;
  readonly value: string;
}

export interface LiveReadonlyCompiledRequest {
  readonly ordinal: number;
  readonly requestId: string;
  readonly requestFingerprint: string;
  readonly queryFingerprint: string;
  readonly method: "GET";
  readonly host: "data.alpaca.markets";
  readonly path: "/v2/stocks/bars" | "/v2/stocks/quotes/latest";
  readonly capability: LiveReadonlyCapability;
  readonly interval: LiveReadonlyInterval;
  readonly symbols: readonly string[];
  readonly query: readonly LiveReadonlyQueryParameter[];
  readonly timeoutMs: number;
  readonly maximumResponseBytes: number;
  readonly maximumEvidenceRecords: number;
  readonly calendarEvidenceFingerprint: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
}

export interface LiveReadonlyCompiledPlan {
  readonly schemaVersion: typeof LIVE_READONLY_MARKET_SCOPE_SCHEMA_VERSION;
  readonly policyVersion: typeof LIVE_READONLY_MARKET_SCOPE_POLICY_VERSION;
  readonly authorizationId: string;
  readonly planFingerprint: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly requests: readonly LiveReadonlyCompiledRequest[];
  readonly maximumNetworkRequests: 5;
  readonly retryAllowed: false;
  readonly paginationAllowed: false;
  readonly persistenceAllowed: false;
  readonly automatedExecutionAllowed: false;
}

export interface LiveReadonlyCanonicalBarEvidence {
  readonly capability: "BARS";
  readonly providerSymbol: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly providerSymbolMappingVersion: string;
  readonly providerSymbolMappingFingerprint: string;
  readonly reference: CanonicalBarReference;
}

export interface LiveReadonlyCanonicalQuoteEvidence {
  readonly capability: "LATEST_QUOTES";
  readonly providerSymbol: string;
  readonly mappingRegistryId: string;
  readonly mappingRegistryVersion: string;
  readonly mappingRegistryFingerprint: string;
  readonly providerSymbolMappingVersion: string;
  readonly providerSymbolMappingFingerprint: string;
  readonly reference: CanonicalQuoteReference;
}

export interface LiveReadonlyResponseBatch {
  readonly ordinal: number;
  readonly requestFingerprint: string;
  readonly queryFingerprint: string;
  readonly nextPageToken: string | null;
  readonly responseBytes: number;
  readonly attempt: ProviderRequestAttempt;
  readonly bars: readonly LiveReadonlyCanonicalBarEvidence[];
  readonly quotes: readonly LiveReadonlyCanonicalQuoteEvidence[];
}

export interface LiveReadonlyMarketScopeGateInput {
  readonly compiledPlan: LiveReadonlyCompiledPlan;
  readonly responseBatches: readonly LiveReadonlyResponseBatch[];
  readonly evidenceResolutions: readonly EvidenceResolution[];
}

export enum LiveReadonlyMarketScopeIssueCode {
  InvalidInput = "INVALID_MARKET_SCOPE_INPUT",
  UndeclaredField = "UNDECLARED_FIELD",
  RequestPlanInvalid = "REQUEST_PLAN_INVALID",
  RequestFingerprintMismatch = "REQUEST_FINGERPRINT_MISMATCH",
  QueryMutation = "QUERY_MUTATION",
  RequestBudgetExceeded = "REQUEST_BUDGET_EXCEEDED",
  RequestOrdinalMismatch = "REQUEST_ORDINAL_MISMATCH",
  PaginationForbidden = "PAGINATION_FORBIDDEN",
  ProviderAttemptMismatch = "PROVIDER_REQUEST_ATTEMPT_MISMATCH",
  ResponseScopeMismatch = "RESPONSE_SCOPE_MISMATCH",
  ResponseOrderMismatch = "RESPONSE_ORDER_MISMATCH",
  ResponseBudgetExceeded = "RESPONSE_BUDGET_EXCEEDED",
  BarCountMismatch = "BAR_COUNT_MISMATCH",
  QuoteCountMismatch = "QUOTE_COUNT_MISMATCH",
  IncompleteBar = "INCOMPLETE_BAR",
  EvidenceWindowMismatch = "EVIDENCE_WINDOW_MISMATCH",
  DuplicateEvidence = "DUPLICATE_EVIDENCE",
  FutureEvidence = "FUTURE_EVIDENCE",
  EvidenceResolutionMismatch = "EVIDENCE_RESOLUTION_MISMATCH",
  AuthorizationNotVerified = "OWNER_AUTHORIZATION_NOT_VERIFIED",
  OwnerVerificationKeyUnavailable = "OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE",
  ProviderLimitSemanticsUnproven = "PROVIDER_LIMIT_SEMANTICS_UNPROVEN",
  TransportHttpError = "TRANSPORT_HTTP_ERROR",
  TransportTimeout = "TRANSPORT_TIMEOUT",
  TransportParseFailure = "TRANSPORT_PARSE_FAILURE",
  TransportResponseOversized = "TRANSPORT_RESPONSE_OVERSIZED",
  TransportMultipleAttempts = "TRANSPORT_MULTIPLE_ATTEMPTS",
  TransportFailure = "TRANSPORT_FAILURE",
}

export interface LiveReadonlyMarketScopeResult {
  readonly status: "VERIFIED" | "BLOCKED";
  readonly issueCodes: readonly LiveReadonlyMarketScopeIssueCode[];
  readonly plan: LiveReadonlyCompiledPlan | null;
  readonly canonicalBarReferences: readonly CanonicalBarReference[];
  readonly canonicalQuoteReferences: readonly CanonicalQuoteReference[];
  readonly providerRequestAttempts: readonly ProviderRequestAttempt[];
  readonly evidenceResolutions: readonly EvidenceResolution[];
  readonly barEvidenceCount: number;
  readonly quoteEvidenceCount: number;
  readonly credentialReadPermitted: false;
  readonly candidates: readonly never[];
  readonly attemptedNetworkRequests: number;
  readonly completedNetworkRequests: number;
  readonly persistenceWrites: 0;
  readonly automatedExecutionAllowed: false;
}

export type LiveReadonlyProviderLimitSemanticsStatus =
  | "PROVIDER_LIMIT_SEMANTICS_UNPROVEN"
  | "PROVEN_MULTI_SYMBOL_PER_SYMBOL_EXACT_LIMIT";

export interface LiveReadonlyProviderSemanticsEvidence {
  readonly schemaVersion: typeof LIVE_READONLY_PROVIDER_SEMANTICS_SCHEMA_VERSION;
  readonly evidenceId: string;
  readonly provider: "ALPACA_MARKET_DATA";
  readonly endpoint: "/v2/stocks/bars";
  readonly status: LiveReadonlyProviderLimitSemanticsStatus;
  readonly authoritySource: "PRODUCT_CONFIGURATION" | "STRUCTURAL_FIXTURE_ONLY";
  readonly maximumNetworkRequests: 5;
  readonly paginationAllowed: false;
  readonly evidenceFingerprint: string;
}

export interface LiveReadonlyProviderSemanticsAuthority {
  getProviderSemanticsEvidence(): LiveReadonlyProviderSemanticsEvidence;
}

export interface LiveReadonlyRawResponseHeader {
  readonly name: "content-type" | "content-length" | "x-request-id";
  readonly value: string;
}

/**
 * A Transport result contains only the bounded HTTP lifecycle and raw body.
 * Canonical evidence, provenance, attempts, and resolutions are product-layer
 * responsibilities and cannot cross this boundary from a Transport.
 */
export interface LiveReadonlyRawHttpResponse {
  readonly kind: "RESPONSE";
  readonly ordinal: number;
  readonly requestId: string;
  readonly requestFingerprint: string;
  readonly httpStatus: number;
  readonly headers: readonly LiveReadonlyRawResponseHeader[];
  readonly body: string;
  readonly startedAt: string;
  readonly endedAt: string;
}

export type LiveReadonlyTransportFailureCode =
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "PARSE_FAILURE"
  | "OVERSIZED_RESPONSE"
  | "MULTIPLE_ATTEMPTS";

export interface PersonalDailyScanLiveReadonlyOperation {
  run(input: LiveReadonlyPreflightInput): Promise<LiveReadonlyMarketScopeResult>;
}
