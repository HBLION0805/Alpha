import {
  PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION_SCHEMA_VERSION,
  PersonalMarketDataResolutionCandidateId,
  PersonalMarketDataResolutionDisposition,
  PersonalMarketDataResolutionGate,
  type PersonalMarketDataAlternativeProviderQualificationPlan,
  type PersonalMarketDataMulsAssetNotFoundEvidence,
  type PersonalMarketDataResolutionCandidate,
} from "../../contracts/PersonalMarketDataAlternativeProviderQualification";
import { PersonalMarketDataProviderId } from "../../contracts/PersonalMarketDataProviderCoverage";
import {
  PERSONAL_MARKET_DATA_INTERVALS,
  PERSONAL_MARKET_DATA_SYMBOLS,
  createPersonalMarketDataProviderCatalog,
} from "../personal-market-data-provider-coverage/PersonalMarketDataProviderCoverageEngine";

export class PersonalMarketDataAlternativeProviderQualificationError extends Error {
  public constructor() {
    super("Personal market-data alternative-provider qualification failed.");
    this.name = "PersonalMarketDataAlternativeProviderQualificationError";
  }
}

export function createMulsAssetNotFoundEvidence(): PersonalMarketDataMulsAssetNotFoundEvidence {
  return deepFreeze({
    schemaVersion: PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION_SCHEMA_VERSION,
    evidenceId: "personal-provider-evidence:alpaca-paper-assets:muls:2026-07-26:asset-not-found",
    providerId: "provider:alpaca-paper-assets",
    symbol: "MULS",
    operationDate: "2026-07-26",
    recordedAt: "2026-07-27T01:05:10.558Z",
    endpointHost: "paper-api.alpaca.markets",
    endpointPath: "/v2/assets/MULS",
    httpStatus: 404,
    safeCode: "ASSET_NOT_FOUND",
    attemptedNetworkRequests: 1,
    completedNetworkRequests: 1,
    retries: 0,
    persistenceWrites: 0,
    accountAccess: false,
    orderAccess: false,
    rawPayloadRetained: false,
    ownerAuthorized: true,
    issuerMappingRetained: true,
  });
}

export function createPersonalMarketDataAlternativeProviderQualificationPlan(
  rawEvidence: unknown,
): PersonalMarketDataAlternativeProviderQualificationPlan {
  const expectedEvidence = createMulsAssetNotFoundEvidence();
  if (canonicalize(rawEvidence) !== canonicalize(expectedEvidence)) {
    throw new PersonalMarketDataAlternativeProviderQualificationError();
  }
  const catalog = createPersonalMarketDataProviderCatalog();
  const alpacaBasic = requiredProvider(catalog, PersonalMarketDataProviderId.AlpacaBasicIex);
  const twelveData = requiredProvider(catalog, PersonalMarketDataProviderId.TwelveDataBasic);
  const alpacaSip = requiredProvider(catalog, PersonalMarketDataProviderId.AlpacaSip);

  const candidates: readonly PersonalMarketDataResolutionCandidate[] = [
    {
      candidateId: PersonalMarketDataResolutionCandidateId.AlpacaBasicIex,
      priority: 0,
      disposition: PersonalMarketDataResolutionDisposition.Rejected,
      monthlyCostUsd: alpacaBasic.monthlyCostUsd,
      selected: false,
      requiredGates: [
        PersonalMarketDataResolutionGate.ExactAssetCoverageProof,
        PersonalMarketDataResolutionGate.ExactLiveSmoke,
      ],
      reasons: [
        "The exact P1D live smoke omitted MULS.",
        "The separately authorized Paper Assets request returned ASSET_NOT_FOUND for MULS.",
        "The complete 12-symbol path remains fail-closed.",
      ],
    },
    {
      candidateId: PersonalMarketDataResolutionCandidateId.TwelveDataBasic,
      priority: 1,
      disposition: PersonalMarketDataResolutionDisposition.QualificationRequired,
      monthlyCostUsd: twelveData.monthlyCostUsd,
      selected: false,
      requiredGates: [
        PersonalMarketDataResolutionGate.ExactSymbolReferenceEvidence,
        PersonalMarketDataResolutionGate.DailyBarAdapter,
        PersonalMarketDataResolutionGate.TwoSidedQuoteContract,
        PersonalMarketDataResolutionGate.RequestBudgetFeasibility,
        PersonalMarketDataResolutionGate.ExactLiveSmoke,
        PersonalMarketDataResolutionGate.OwnerNetworkApproval,
      ],
      reasons: [
        "The current plan is zero-cost and documents US equity and ETF time series.",
        "The current Alpha adapter and evidence do not satisfy the complete daily-Bar and two-sided Quote contract.",
        "Exact MULS coverage remains unverified.",
      ],
    },
    {
      candidateId: PersonalMarketDataResolutionCandidateId.AlpacaSip,
      priority: 2,
      disposition: PersonalMarketDataResolutionDisposition.Deferred,
      monthlyCostUsd: alpacaSip.monthlyCostUsd,
      selected: false,
      requiredGates: [
        PersonalMarketDataResolutionGate.OwnerCostApproval,
        PersonalMarketDataResolutionGate.ExactAssetCoverageProof,
        PersonalMarketDataResolutionGate.SipAdapterReview,
        PersonalMarketDataResolutionGate.ExactLiveSmoke,
        PersonalMarketDataResolutionGate.OwnerNetworkApproval,
      ],
      reasons: [
        "SIP market coverage does not by itself resolve the Paper Assets ASSET_NOT_FOUND result.",
        "No subscription purchase is justified before exact MULS coverage is proven.",
        "The paid path requires separate Owner cost approval.",
      ],
    },
    {
      candidateId: PersonalMarketDataResolutionCandidateId.MultiProviderComposition,
      priority: 3,
      disposition: PersonalMarketDataResolutionDisposition.ArchitectureRequired,
      monthlyCostUsd: null,
      selected: false,
      requiredGates: [
        PersonalMarketDataResolutionGate.MultiProviderArchitectureReview,
        PersonalMarketDataResolutionGate.SymbolCapabilityBinding,
        PersonalMarketDataResolutionGate.CrossProviderFreshnessPolicy,
        PersonalMarketDataResolutionGate.ConflictPolicy,
        PersonalMarketDataResolutionGate.ExactLiveSmoke,
        PersonalMarketDataResolutionGate.OwnerNetworkApproval,
      ],
      reasons: [
        "The personal MVP currently requires one complete exact evidence composition.",
        "A split source must preserve per-symbol provenance, freshness, session, and conflict semantics.",
        "Configuration alone cannot grant multi-provider authority.",
      ],
    },
  ];

  const frozenCandidates = deepFreeze(candidates);
  return deepFreeze({
    schemaVersion: PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION_SCHEMA_VERSION,
    planId: `personal-alternative-provider-plan:${fnv1a64(canonicalize({
      evidenceId: expectedEvidence.evidenceId,
      requiredSymbols: PERSONAL_MARKET_DATA_SYMBOLS,
      requiredIntervals: PERSONAL_MARKET_DATA_INTERVALS,
      candidates: frozenCandidates,
    }))}`,
    evidenceId: expectedEvidence.evidenceId,
    requiredSymbols: [...PERSONAL_MARKET_DATA_SYMBOLS],
    requiredIntervals: [...PERSONAL_MARKET_DATA_INTERVALS],
    candidates: frozenCandidates,
    selection: "NO_PROVIDER_SELECTED",
    recommendedNextTask: "RESEARCH_TWELVE_DATA_MULS_AND_QUOTE_CAPABILITIES_NETWORK_FREE",
    exactSymbolSetMayBeReduced: false,
    networkAuthorized: false,
    subscriptionPurchaseAuthorized: false,
    collectionAuthorized: false,
    recommendationAuthority: false,
    tradingAuthority: false,
    deterministic: true,
    advisoryOnly: true,
  });
}

function requiredProvider(
  catalog: ReturnType<typeof createPersonalMarketDataProviderCatalog>,
  providerId: PersonalMarketDataProviderId,
): ReturnType<typeof createPersonalMarketDataProviderCatalog>[number] {
  const profile = catalog.find((entry) => entry.providerId === providerId);
  if (profile === undefined) throw new PersonalMarketDataAlternativeProviderQualificationError();
  return profile;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
