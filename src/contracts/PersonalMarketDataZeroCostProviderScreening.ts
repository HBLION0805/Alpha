export const PERSONAL_MARKET_DATA_ZERO_COST_PROVIDER_SCREENING_SCHEMA_VERSION =
  "1.0" as const;

export enum PersonalMarketDataZeroCostCandidateId {
  TradierBrokerage = "TRADIER_BROKERAGE",
  MassiveBasic = "MASSIVE_BASIC",
  FinnhubFree = "FINNHUB_FREE",
  AlphaVantageFree = "ALPHA_VANTAGE_FREE",
  FmpBasic = "FMP_BASIC",
}

export enum PersonalMarketDataZeroCostCandidateDisposition {
  ArchitectureReviewRequired = "ARCHITECTURE_REVIEW_REQUIRED",
  RejectedForExactRequirement = "REJECTED_FOR_EXACT_REQUIREMENT",
}

export interface PersonalMarketDataZeroCostAuthority {
  readonly authorityId: string;
  readonly url: string;
  readonly assertion: string;
  readonly reviewedAt: "2026-07-29";
}

export interface PersonalMarketDataZeroCostCandidate {
  readonly candidateId: PersonalMarketDataZeroCostCandidateId;
  readonly monthlyDataCostUsd: 0;
  readonly brokerageAccountRequired: boolean;
  readonly credentialMayReachAccountOrTradingSurface: boolean;
  readonly exactTwelveSymbolCoverage: "UNVERIFIED";
  readonly completedP1dBars: "DOCUMENTED" | "BLOCKED";
  readonly completedPt1hBars:
    | "REQUIRES_REVIEWED_AGGREGATION"
    | "DOCUMENTED"
    | "BLOCKED";
  readonly completedPt15mBars:
    | "REQUIRES_REVIEWED_AGGREGATION"
    | "DOCUMENTED"
    | "BLOCKED";
  readonly completedPt5mBars:
    | "REQUIRES_REVIEWED_AGGREGATION"
    | "DOCUMENTED"
    | "BLOCKED";
  readonly currentTwoSidedQuote: "DOCUMENTED" | "PREMIUM_ONLY" | "BLOCKED";
  readonly quoteSizes: "DOCUMENTED_WITH_UNIT" | "PREMIUM_ONLY" | "BLOCKED";
  readonly requestBudget:
    | "120_PER_MINUTE"
    | "60_PER_MINUTE"
    | "5_PER_MINUTE"
    | "25_PER_DAY"
    | "250_PER_DAY";
  readonly disposition: PersonalMarketDataZeroCostCandidateDisposition;
  readonly selected: false;
  readonly blockers: readonly string[];
  readonly authorityIds: readonly string[];
}

export interface PersonalMarketDataZeroCostProviderScreening {
  readonly schemaVersion:
    typeof PERSONAL_MARKET_DATA_ZERO_COST_PROVIDER_SCREENING_SCHEMA_VERSION;
  readonly screeningId: string;
  readonly evidenceReviewDate: "2026-07-29";
  readonly requiredSymbolCount: 12;
  readonly requiredSymbolsIncludeMuls: true;
  readonly authorities: readonly PersonalMarketDataZeroCostAuthority[];
  readonly candidates: readonly PersonalMarketDataZeroCostCandidate[];
  readonly completeProviderSelection: "NO_COMPLETE_PROVIDER_SELECTED";
  readonly prioritizedCandidate:
    PersonalMarketDataZeroCostCandidateId.TradierBrokerage;
  readonly nextTask:
    "DESIGN_TRADIER_READ_ONLY_CREDENTIAL_AND_EXACT_SYMBOL_DIAGNOSTIC";
  readonly networkAuthorized: false;
  readonly credentialUseAuthorized: false;
  readonly brokerageAccountOpeningAuthorized: false;
  readonly subscriptionPurchaseAuthorized: false;
  readonly collectionAuthorized: false;
  readonly recommendationAuthority: false;
  readonly tradingAuthority: false;
  readonly deterministic: true;
  readonly advisoryOnly: true;
}
