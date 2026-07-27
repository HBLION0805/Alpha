import type { BarInterval } from "./CanonicalBar";

export const PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION_SCHEMA_VERSION = "1.0" as const;

export enum PersonalMarketDataResolutionCandidateId {
  AlpacaBasicIex = "ALPACA_BASIC_IEX",
  TwelveDataBasic = "TWELVE_DATA_BASIC",
  AlpacaSip = "ALPACA_SIP",
  MultiProviderComposition = "MULTI_PROVIDER_COMPOSITION",
}

export enum PersonalMarketDataResolutionDisposition {
  Rejected = "REJECTED",
  QualificationRequired = "QUALIFICATION_REQUIRED",
  Deferred = "DEFERRED",
  ArchitectureRequired = "ARCHITECTURE_REQUIRED",
}

export enum PersonalMarketDataResolutionGate {
  ExactSymbolReferenceEvidence = "EXACT_SYMBOL_REFERENCE_EVIDENCE",
  DailyBarAdapter = "DAILY_BAR_ADAPTER",
  TwoSidedQuoteContract = "TWO_SIDED_QUOTE_CONTRACT",
  RequestBudgetFeasibility = "REQUEST_BUDGET_FEASIBILITY",
  ExactLiveSmoke = "EXACT_LIVE_SMOKE",
  OwnerNetworkApproval = "OWNER_NETWORK_APPROVAL",
  OwnerCostApproval = "OWNER_COST_APPROVAL",
  ExactAssetCoverageProof = "EXACT_ASSET_COVERAGE_PROOF",
  SipAdapterReview = "SIP_ADAPTER_REVIEW",
  MultiProviderArchitectureReview = "MULTI_PROVIDER_ARCHITECTURE_REVIEW",
  SymbolCapabilityBinding = "SYMBOL_CAPABILITY_BINDING",
  CrossProviderFreshnessPolicy = "CROSS_PROVIDER_FRESHNESS_POLICY",
  ConflictPolicy = "CONFLICT_POLICY",
}

export interface PersonalMarketDataMulsAssetNotFoundEvidence {
  readonly schemaVersion: typeof PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION_SCHEMA_VERSION;
  readonly evidenceId: "personal-provider-evidence:alpaca-paper-assets:muls:2026-07-26:asset-not-found";
  readonly providerId: "provider:alpaca-paper-assets";
  readonly symbol: "MULS";
  readonly operationDate: "2026-07-26";
  readonly recordedAt: "2026-07-27T01:05:10.558Z";
  readonly endpointHost: "paper-api.alpaca.markets";
  readonly endpointPath: "/v2/assets/MULS";
  readonly httpStatus: 404;
  readonly safeCode: "ASSET_NOT_FOUND";
  readonly attemptedNetworkRequests: 1;
  readonly completedNetworkRequests: 1;
  readonly retries: 0;
  readonly persistenceWrites: 0;
  readonly accountAccess: false;
  readonly orderAccess: false;
  readonly rawPayloadRetained: false;
  readonly ownerAuthorized: true;
  readonly issuerMappingRetained: true;
}

export interface PersonalMarketDataResolutionCandidate {
  readonly candidateId: PersonalMarketDataResolutionCandidateId;
  readonly priority: 0 | 1 | 2 | 3;
  readonly disposition: PersonalMarketDataResolutionDisposition;
  readonly monthlyCostUsd: number | null;
  readonly selected: false;
  readonly requiredGates: readonly PersonalMarketDataResolutionGate[];
  readonly reasons: readonly string[];
}

export interface PersonalMarketDataAlternativeProviderQualificationPlan {
  readonly schemaVersion: typeof PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION_SCHEMA_VERSION;
  readonly planId: string;
  readonly evidenceId: PersonalMarketDataMulsAssetNotFoundEvidence["evidenceId"];
  readonly requiredSymbols: readonly string[];
  readonly requiredIntervals: readonly BarInterval[];
  readonly candidates: readonly PersonalMarketDataResolutionCandidate[];
  readonly selection: "NO_PROVIDER_SELECTED";
  readonly recommendedNextTask: "RESEARCH_TWELVE_DATA_MULS_AND_QUOTE_CAPABILITIES_NETWORK_FREE";
  readonly exactSymbolSetMayBeReduced: false;
  readonly networkAuthorized: false;
  readonly subscriptionPurchaseAuthorized: false;
  readonly collectionAuthorized: false;
  readonly recommendationAuthority: false;
  readonly tradingAuthority: false;
  readonly deterministic: true;
  readonly advisoryOnly: true;
}
