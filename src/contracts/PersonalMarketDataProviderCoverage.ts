import type { BarInterval } from "./CanonicalBar";

export const PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION = "1.0" as const;

export enum PersonalMarketDataProviderId {
  AlpacaBasicIex = "ALPACA_BASIC_IEX",
  AlpacaSip = "ALPACA_SIP",
  TwelveDataBasic = "TWELVE_DATA_BASIC",
}

export enum PersonalMarketDataFeedCoverage {
  SingleVenue = "SINGLE_VENUE",
  PartialMarket = "PARTIAL_MARKET",
  ConsolidatedSip = "CONSOLIDATED_SIP",
}

export enum PersonalMarketDataVerificationStatus {
  PendingLiveSmoke = "PENDING_LIVE_SMOKE",
  Verified = "VERIFIED",
  Failed = "FAILED",
}

export enum PersonalMarketDataProviderReadiness {
  Blocked = "BLOCKED",
  ReadyForBoundedSmoke = "READY_FOR_BOUNDED_SMOKE",
  ReadyForPersonalCollection = "READY_FOR_PERSONAL_COLLECTION",
}

export interface PersonalMarketDataProviderAuthority {
  readonly evidenceId: string;
  readonly url: string;
  readonly assertion: string;
  readonly retrievedAt: string;
}

export interface PersonalMarketDataProviderProfile {
  readonly schemaVersion: typeof PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION;
  readonly providerId: PersonalMarketDataProviderId;
  readonly displayName: string;
  readonly monthlyCostUsd: number;
  readonly requiresCredentials: boolean;
  readonly coverage: PersonalMarketDataFeedCoverage;
  readonly supportedIntervals: readonly BarInterval[];
  readonly latestTwoSidedQuoteDocumented: boolean;
  readonly quoteSizesDocumented: boolean;
  readonly adapterImplemented: boolean;
  readonly symbolVerification: Readonly<Record<string, PersonalMarketDataVerificationStatus>>;
  readonly authorities: readonly PersonalMarketDataProviderAuthority[];
}

export interface PersonalMarketDataProviderRequirement {
  readonly requirementId: string;
  readonly requiredSymbols: readonly string[];
  readonly requiredIntervals: readonly BarInterval[];
  readonly requireTwoSidedQuote: boolean;
  readonly requireQuoteSizes: boolean;
  readonly maxMonthlyCostUsd: number;
  readonly ownerApproved: boolean;
  readonly credentialsAvailable: boolean;
}

export interface PersonalMarketDataProviderBlocker {
  readonly code:
    | "ADAPTER_NOT_IMPLEMENTED"
    | "COST_EXCEEDS_LIMIT"
    | "CREDENTIALS_MISSING"
    | "INTERVAL_MISSING"
    | "OWNER_APPROVAL_MISSING"
    | "QUOTE_CAPABILITY_MISSING"
    | "SYMBOL_FAILED"
    | "SYMBOL_UNVERIFIED";
  readonly field: string;
  readonly message: string;
}

export interface PersonalMarketDataProviderAssessment {
  readonly schemaVersion: typeof PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION;
  readonly assessmentId: string;
  readonly providerId: PersonalMarketDataProviderId;
  readonly readiness: PersonalMarketDataProviderReadiness;
  readonly coverage: PersonalMarketDataFeedCoverage;
  readonly monthlyCostUsd: number;
  readonly blockers: readonly PersonalMarketDataProviderBlocker[];
  readonly warnings: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly advisoryOnly: true;
  readonly automatedExecutionAllowed: false;
  readonly deterministic: true;
}

export enum PersonalMarketDataProviderCoverageIssueCode {
  InvalidRequest = "INVALID_REQUEST",
  UndeclaredField = "UNDECLARED_FIELD",
  InvalidProfile = "INVALID_PROFILE",
}

export interface PersonalMarketDataProviderCoverageIssue {
  readonly code: PersonalMarketDataProviderCoverageIssueCode;
  readonly field: string;
  readonly message: string;
}
