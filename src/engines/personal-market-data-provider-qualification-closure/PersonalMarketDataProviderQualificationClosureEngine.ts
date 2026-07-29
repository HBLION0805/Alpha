import {
  PERSONAL_MARKET_DATA_PROVIDER_QUALIFICATION_CLOSURE_SCHEMA_VERSION,
  PersonalMarketDataProviderLaneDisposition,
  PersonalMarketDataProviderLaneId,
  type PersonalMarketDataProviderLaneClosure,
  type PersonalMarketDataProviderQualificationClosure,
  type PersonalMarketDataTwelveDataMulsNotFoundEvidence,
} from "../../contracts/PersonalMarketDataProviderQualificationClosure";
import {
  createMulsAssetNotFoundEvidence,
  createPersonalMarketDataAlternativeProviderQualificationPlan,
} from "../personal-market-data-alternative-provider-qualification/PersonalMarketDataAlternativeProviderQualificationEngine";
import {
  createPersonalMarketDataTwelveDataQualification,
} from "../personal-market-data-twelve-data-qualification/PersonalMarketDataTwelveDataQualificationEngine";
import {
  PERSONAL_MARKET_DATA_LEGACY_TWELVE_SYMBOLS,
} from "../personal-market-data-provider-coverage/PersonalMarketDataProviderCoverageEngine";

export class PersonalMarketDataProviderQualificationClosureError extends Error {
  public constructor() {
    super("Personal market-data provider qualification closure failed.");
    this.name = "PersonalMarketDataProviderQualificationClosureError";
  }
}

export function createTwelveDataMulsNotFoundEvidence():
PersonalMarketDataTwelveDataMulsNotFoundEvidence {
  return deepFreeze({
    schemaVersion:
      PERSONAL_MARKET_DATA_PROVIDER_QUALIFICATION_CLOSURE_SCHEMA_VERSION,
    evidenceId:
      "personal-provider-evidence:twelve-data:muls:2026-07-29:symbol-not-found",
    providerId: "provider:twelve-data",
    symbol: "MULS",
    operationDate: "2026-07-29",
    recordedAt: "2026-07-29T01:31:47.618Z",
    requestFingerprint: "twelve-data-muls-reference:d531fea31082c867",
    endpointHost: "api.twelvedata.com",
    endpointPath: "/etfs/list",
    httpStatus: 400,
    providerStatus: "error",
    providerCode: 400,
    classification: "SYMBOL_NOT_FOUND",
    messageTruncated: false,
    attemptedNetworkRequests: 1,
    completedNetworkRequests: 1,
    creditsConsumedMaximum: 1,
    retries: 0,
    persistenceWrites: 0,
    accountAccess: false,
    orderAccess: false,
    rawPayloadRetained: false,
    credentialRedacted: true,
    ownerAuthorized: true,
    issuerMappingRetained: true,
  });
}

export function createPersonalMarketDataProviderQualificationClosure(
  rawEvidence: unknown,
): PersonalMarketDataProviderQualificationClosure {
  const evidence = createTwelveDataMulsNotFoundEvidence();
  if (canonicalize(rawEvidence) !== canonicalize(evidence)) {
    throw new PersonalMarketDataProviderQualificationClosureError();
  }

  const c5Plan = createPersonalMarketDataAlternativeProviderQualificationPlan(
    createMulsAssetNotFoundEvidence(),
  );
  const c6Qualification =
    createPersonalMarketDataTwelveDataQualification(c5Plan);
  if (c5Plan.selection !== "NO_PROVIDER_SELECTED"
    || c6Qualification.result !== "NOT_QUALIFIED_AS_COMPLETE_PROVIDER"
    || c6Qualification.permittedRole !== "BARS_RESEARCH_CANDIDATE_ONLY"
    || PERSONAL_MARKET_DATA_LEGACY_TWELVE_SYMBOLS.length !== 12
    || !PERSONAL_MARKET_DATA_LEGACY_TWELVE_SYMBOLS.includes("MULS")) {
    throw new PersonalMarketDataProviderQualificationClosureError();
  }

  const providerLanes: readonly PersonalMarketDataProviderLaneClosure[] = [
    {
      providerId: PersonalMarketDataProviderLaneId.AlpacaBasicIex,
      disposition:
        PersonalMarketDataProviderLaneDisposition.RejectedAsCompleteProvider,
      selected: false,
      permittedRole: "NO_COMPLETE_PROVIDER_ROLE",
      evidenceIds: [
        createMulsAssetNotFoundEvidence().evidenceId,
        c5Plan.planId,
      ],
      reasons: [
        "The Owner-authorized P1D read omitted MULS.",
        "The separately authorized Paper Assets read returned ASSET_NOT_FOUND.",
        "The exact 12-symbol requirement cannot fail open.",
      ],
    },
    {
      providerId: PersonalMarketDataProviderLaneId.TwelveDataBasic,
      disposition:
        PersonalMarketDataProviderLaneDisposition.RejectedAsCompleteProvider,
      selected: false,
      permittedRole: "BARS_RESEARCH_CANDIDATE_ONLY",
      evidenceIds: [
        evidence.evidenceId,
        c6Qualification.qualificationId,
      ],
      reasons: [
        "The Owner-authorized ETF reference read returned SYMBOL_NOT_FOUND for MULS.",
        "P1D, two-sided Quote, quantity, and free-budget blockers remain open.",
        "Narrow Bars research cannot be promoted to complete-provider authority.",
      ],
    },
    {
      providerId: PersonalMarketDataProviderLaneId.AlpacaSip,
      disposition:
        PersonalMarketDataProviderLaneDisposition.DeferredPendingCostAndCoverage,
      selected: false,
      permittedRole: "PAID_CANDIDATE_REQUIRING_EXACT_COVERAGE_PROOF",
      evidenceIds: [
        "alpaca:market-data:sip",
        createMulsAssetNotFoundEvidence().evidenceId,
      ],
      reasons: [
        "A paid SIP feed does not prove that Alpaca resolves exact MULS metadata.",
        "No SIP adapter or exact 12-symbol smoke has passed review.",
        "Subscription purchase requires separate Owner cost approval.",
      ],
    },
  ];

  const identity = {
    twelveDataEvidenceId: evidence.evidenceId,
    requiredSymbols: PERSONAL_MARKET_DATA_LEGACY_TWELVE_SYMBOLS,
    providerLanes,
  };
  return deepFreeze({
    schemaVersion:
      PERSONAL_MARKET_DATA_PROVIDER_QUALIFICATION_CLOSURE_SCHEMA_VERSION,
    closureId:
      `personal-provider-qualification-closure:${fnv1a64(canonicalize(identity))}`,
    twelveDataEvidenceId: evidence.evidenceId,
    requiredSymbolCount: 12,
    requiredSymbol: "MULS",
    providerLanes,
    completeProviderSelection: "NO_COMPLETE_PROVIDER_SELECTED",
    twelveDataExactMulsReference: "FAILED",
    multiProviderComposition: "ARCHITECTURE_REVIEW_REQUIRED",
    recommendedNextTask: "RESEARCH_NEXT_ZERO_COST_COMPLETE_PROVIDER_CANDIDATES",
    exactSymbolSetMayBeReduced: false,
    networkAuthorized: false,
    credentialUseAuthorized: false,
    subscriptionPurchaseAuthorized: false,
    collectionAuthorized: false,
    recommendationAuthority: false,
    tradingAuthority: false,
    deterministic: true,
    advisoryOnly: true,
  });
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
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}
