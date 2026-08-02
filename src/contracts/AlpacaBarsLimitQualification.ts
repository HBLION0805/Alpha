import type {
  ExchangeCalendarEvidence,
  LiveReadonlyMarketPhase,
  LiveReadonlyRequestPlanEntry,
  OwnerApprovalEnvelope,
} from "./PersonalDailyScanLiveReadonly";

export const ALPACA_BARS_LIMIT_QUALIFICATION_SCHEMA_VERSION = "1.1" as const;
export const ALPACA_BARS_LIMIT_QUALIFICATION_POLICY_VERSION = "phase1b-d3a-correction:1.0" as const;

export interface AlpacaBarsLimitQualificationAuthorizationBody {
  readonly schemaVersion: typeof ALPACA_BARS_LIMIT_QUALIFICATION_SCHEMA_VERSION;
  readonly authorizationType: "ALPACA_BARS_LIMIT_QUALIFICATION_LIVE_READONLY";
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
  readonly maximumNetworkRequests: 1;
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
  readonly requests: readonly [LiveReadonlyRequestPlanEntry];
}

export interface AlpacaBarsLimitQualificationManifest {
  readonly authorizationBody: AlpacaBarsLimitQualificationAuthorizationBody;
  readonly ownerApprovalEnvelope: OwnerApprovalEnvelope;
}

export interface AlpacaBarsLimitQualificationManifestDraft {
  readonly authorizationBody: AlpacaBarsLimitQualificationAuthorizationBody;
  readonly manifestSha256: string;
  readonly signatureDomain: "ALPHA_OWNER_NETWORK_AUTHORIZATION_V1";
  readonly approvalStatus: "UNSIGNED_OWNER_APPROVAL_REQUIRED";
}

export interface AlpacaBarsLimitQualificationInput {
  readonly asOf: string;
  readonly manifest?: unknown;
  readonly calendarEvidence?: unknown;
}

export type AlpacaBarsLimitProviderSemantics = "UNPROVEN" | "OBSERVED_ONCE_NOT_PROVEN";

export enum AlpacaBarsLimitQualificationIssueCode {
  OwnerNetworkAuthorizationRequired = "OWNER_NETWORK_AUTHORIZATION_REQUIRED",
  OwnerAuthorizationVerificationKeyUnavailable = "OWNER_AUTHORIZATION_VERIFICATION_KEY_UNAVAILABLE",
  OwnerAuthorizationInvalid = "OWNER_AUTHORIZATION_INVALID",
  AuthorizationReplayForbidden = "AUTHORIZATION_REPLAY_FORBIDDEN",
  RequestPlanInvalid = "REQUEST_PLAN_INVALID",
  RequestMutationDetected = "REQUEST_MUTATION_DETECTED",
  CredentialUnavailable = "ALPACA_CREDENTIAL_UNAVAILABLE",
  TransportTimeout = "TRANSPORT_TIMEOUT",
  TransportFailure = "TRANSPORT_FAILURE",
  HttpError = "HTTP_ERROR",
  ResponseTooLarge = "RESPONSE_TOO_LARGE",
  InvalidJson = "INVALID_JSON",
  PaginationForbidden = "PAGINATION_FORBIDDEN",
  ResponseScopeMismatch = "RESPONSE_SCOPE_MISMATCH",
  BarCountMismatch = "BAR_COUNT_MISMATCH",
  InvalidBar = "INVALID_BAR",
}

export interface AlpacaBarsLimitQualificationResult {
  readonly schemaVersion: typeof ALPACA_BARS_LIMIT_QUALIFICATION_SCHEMA_VERSION;
  readonly policyVersion: typeof ALPACA_BARS_LIMIT_QUALIFICATION_POLICY_VERSION;
  readonly status: "BLOCKED" | "QUALIFICATION_OBSERVED";
  readonly issueCodes: readonly AlpacaBarsLimitQualificationIssueCode[];
  readonly authorizationId: string | null;
  readonly manifestSha256: string | null;
  readonly requestFingerprint: string | null;
  readonly marketPhase: LiveReadonlyMarketPhase | null;
  readonly referenceSessionDate: string | null;
  readonly provider: "ALPACA_MARKET_DATA";
  readonly feed: "iex";
  readonly symbols: readonly ["MU", "QQQ"];
  readonly timeframe: "1Day";
  readonly requestedLimit: 2;
  readonly runId: string;
  readonly responseOrigin: "NONE" | "TEST_INJECTED" | "REAL_HTTPS";
  readonly actualObservedBarsBySymbol: Readonly<{ readonly MU: number; readonly QQQ: number }>;
  readonly paginationTokenPresent: boolean;
  readonly responseSymbols: readonly string[];
  readonly providerLimitSemantics: AlpacaBarsLimitProviderSemantics;
  readonly credentialReadPermitted: boolean;
  readonly attemptedNetworkRequests: 0 | 1;
  readonly completedNetworkRequests: 0 | 1;
  readonly networkRequests: 0 | 1;
  readonly persistenceWrites: 0;
  readonly automatedExecutionAllowed: false;
  readonly candidates: readonly never[];
}

export class AlpacaBarsLimitQualificationTransportError extends Error {
  public constructor(public readonly safeCode: "CREDENTIAL_UNAVAILABLE" | "TIMEOUT" | "HTTP_ERROR" | "RESPONSE_TOO_LARGE" | "TRANSPORT_FAILURE") {
    super(`Alpaca Bars limit qualification Transport failed: ${safeCode}.`);
    this.name = "AlpacaBarsLimitQualificationTransportError";
  }
}

export interface AlpacaBarsLimitQualificationRawResponse {
  readonly statusCode: number;
  readonly headers: readonly Readonly<{ readonly name: "content-type" | "content-length" | "x-request-id"; readonly value: string }>[];
  readonly rawBytes: Uint8Array;
  readonly startedAt: string;
  readonly endedAt: string;
}

export interface AlpacaBarsLimitQualificationOperation {
  run(input: AlpacaBarsLimitQualificationInput): Promise<AlpacaBarsLimitQualificationResult>;
}

export interface AlpacaBarsLimitQualificationDraftInput {
  readonly authorizationId: string;
  readonly ownerDecisionReference: string;
  readonly executeDate: string;
  readonly validFrom: string;
  readonly expiresAt: string;
  readonly calendarEvidence: ExchangeCalendarEvidence;
}
