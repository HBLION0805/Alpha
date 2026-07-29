export const PERSONAL_MARKET_DATA_PROVIDER_QUALIFICATION_CLOSURE_SCHEMA_VERSION =
  "1.0" as const;

export enum PersonalMarketDataProviderLaneId {
  AlpacaBasicIex = "ALPACA_BASIC_IEX",
  AlpacaSip = "ALPACA_SIP",
  TwelveDataBasic = "TWELVE_DATA_BASIC",
}

export enum PersonalMarketDataProviderLaneDisposition {
  RejectedAsCompleteProvider = "REJECTED_AS_COMPLETE_PROVIDER",
  DeferredPendingCostAndCoverage = "DEFERRED_PENDING_COST_AND_COVERAGE",
}

export interface PersonalMarketDataTwelveDataMulsNotFoundEvidence {
  readonly schemaVersion:
    typeof PERSONAL_MARKET_DATA_PROVIDER_QUALIFICATION_CLOSURE_SCHEMA_VERSION;
  readonly evidenceId:
    "personal-provider-evidence:twelve-data:muls:2026-07-29:symbol-not-found";
  readonly providerId: "provider:twelve-data";
  readonly symbol: "MULS";
  readonly operationDate: "2026-07-29";
  readonly recordedAt: "2026-07-29T01:31:47.618Z";
  readonly requestFingerprint:
    "twelve-data-muls-reference:d531fea31082c867";
  readonly endpointHost: "api.twelvedata.com";
  readonly endpointPath: "/etfs/list";
  readonly httpStatus: 400;
  readonly providerStatus: "error";
  readonly providerCode: 400;
  readonly classification: "SYMBOL_NOT_FOUND";
  readonly messageTruncated: false;
  readonly attemptedNetworkRequests: 1;
  readonly completedNetworkRequests: 1;
  readonly creditsConsumedMaximum: 1;
  readonly retries: 0;
  readonly persistenceWrites: 0;
  readonly accountAccess: false;
  readonly orderAccess: false;
  readonly rawPayloadRetained: false;
  readonly credentialRedacted: true;
  readonly ownerAuthorized: true;
  readonly issuerMappingRetained: true;
}

export interface PersonalMarketDataProviderLaneClosure {
  readonly providerId: PersonalMarketDataProviderLaneId;
  readonly disposition: PersonalMarketDataProviderLaneDisposition;
  readonly selected: false;
  readonly permittedRole:
    | "NO_COMPLETE_PROVIDER_ROLE"
    | "BARS_RESEARCH_CANDIDATE_ONLY"
    | "PAID_CANDIDATE_REQUIRING_EXACT_COVERAGE_PROOF";
  readonly evidenceIds: readonly string[];
  readonly reasons: readonly string[];
}

export interface PersonalMarketDataProviderQualificationClosure {
  readonly schemaVersion:
    typeof PERSONAL_MARKET_DATA_PROVIDER_QUALIFICATION_CLOSURE_SCHEMA_VERSION;
  readonly closureId: string;
  readonly twelveDataEvidenceId:
    PersonalMarketDataTwelveDataMulsNotFoundEvidence["evidenceId"];
  readonly requiredSymbolCount: 12;
  readonly requiredSymbol: "MULS";
  readonly providerLanes: readonly PersonalMarketDataProviderLaneClosure[];
  readonly completeProviderSelection: "NO_COMPLETE_PROVIDER_SELECTED";
  readonly twelveDataExactMulsReference: "FAILED";
  readonly multiProviderComposition: "ARCHITECTURE_REVIEW_REQUIRED";
  readonly recommendedNextTask:
    "RESEARCH_NEXT_ZERO_COST_COMPLETE_PROVIDER_CANDIDATES";
  readonly exactSymbolSetMayBeReduced: false;
  readonly networkAuthorized: false;
  readonly credentialUseAuthorized: false;
  readonly subscriptionPurchaseAuthorized: false;
  readonly collectionAuthorized: false;
  readonly recommendationAuthority: false;
  readonly tradingAuthority: false;
  readonly deterministic: true;
  readonly advisoryOnly: true;
}
