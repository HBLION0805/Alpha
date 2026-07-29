import {
  PERSONAL_MARKET_DATA_ZERO_COST_PROVIDER_SCREENING_SCHEMA_VERSION,
  PersonalMarketDataZeroCostCandidateDisposition,
  PersonalMarketDataZeroCostCandidateId,
  type PersonalMarketDataZeroCostAuthority,
  type PersonalMarketDataZeroCostCandidate,
  type PersonalMarketDataZeroCostProviderScreening,
} from "../../contracts/PersonalMarketDataZeroCostProviderScreening";
import {
  createPersonalMarketDataProviderQualificationClosure,
  createTwelveDataMulsNotFoundEvidence,
} from "../personal-market-data-provider-qualification-closure/PersonalMarketDataProviderQualificationClosureEngine";
import {
  PERSONAL_MARKET_DATA_SYMBOLS,
} from "../personal-market-data-provider-coverage/PersonalMarketDataProviderCoverageEngine";

const REVIEW_DATE = "2026-07-29" as const;

export class PersonalMarketDataZeroCostProviderScreeningError extends Error {
  public constructor() {
    super("Personal zero-cost market-data provider screening failed.");
    this.name = "PersonalMarketDataZeroCostProviderScreeningError";
  }
}

export function createPersonalMarketDataZeroCostProviderScreening(
  rawC11Closure: unknown,
): PersonalMarketDataZeroCostProviderScreening {
  const expectedClosure = createPersonalMarketDataProviderQualificationClosure(
    createTwelveDataMulsNotFoundEvidence(),
  );
  if (canonicalize(rawC11Closure) !== canonicalize(expectedClosure)
    || PERSONAL_MARKET_DATA_SYMBOLS.length !== 12
    || !PERSONAL_MARKET_DATA_SYMBOLS.includes("MULS")) {
    throw new PersonalMarketDataZeroCostProviderScreeningError();
  }

  const authorities = createAuthorities();
  const candidates = createCandidates();
  const identity = {
    c11ClosureId: expectedClosure.closureId,
    requiredSymbols: PERSONAL_MARKET_DATA_SYMBOLS,
    authorities,
    candidates,
  };
  return deepFreeze({
    schemaVersion:
      PERSONAL_MARKET_DATA_ZERO_COST_PROVIDER_SCREENING_SCHEMA_VERSION,
    screeningId:
      `personal-zero-cost-provider-screening:${fnv1a64(canonicalize(identity))}`,
    evidenceReviewDate: REVIEW_DATE,
    requiredSymbolCount: 12,
    requiredSymbolsIncludeMuls: true,
    authorities,
    candidates,
    completeProviderSelection: "NO_COMPLETE_PROVIDER_SELECTED",
    prioritizedCandidate: PersonalMarketDataZeroCostCandidateId.TradierBrokerage,
    nextTask:
      "DESIGN_TRADIER_READ_ONLY_CREDENTIAL_AND_EXACT_SYMBOL_DIAGNOSTIC",
    networkAuthorized: false,
    credentialUseAuthorized: false,
    brokerageAccountOpeningAuthorized: false,
    subscriptionPurchaseAuthorized: false,
    collectionAuthorized: false,
    recommendationAuthority: false,
    tradingAuthority: false,
    deterministic: true,
    advisoryOnly: true,
  });
}

function createAuthorities(): readonly PersonalMarketDataZeroCostAuthority[] {
  return deepFreeze([
    authority(
      "tradier:brokerage-api-cost",
      "https://production.tradier.com/businesses/fintechs",
      "Personal API access is available to Tradier Brokerage account holders at no API fee.",
    ),
    authority(
      "tradier:market-data",
      "https://docs.tradier.com/docs/market-data",
      "Brokerage accounts receive real-time consolidated US equity and ETF market data; sandbox data is delayed.",
    ),
    authority(
      "tradier:quotes",
      "https://docs.tradier.com/docs/quotes",
      "Quotes document bid, ask, timestamps, exchanges, and bid/ask sizes in hundreds.",
    ),
    authority(
      "tradier:historical-data",
      "https://docs.tradier.com/docs/historical-data",
      "Historical daily candles and one-, five-, and fifteen-minute time-and-sales intervals are documented.",
    ),
    authority(
      "tradier:rate-limits",
      "https://docs.tradier.com/docs/rate-limiting",
      "Production market-data resources are limited to 120 requests per minute per token.",
    ),
    authority(
      "massive:stocks-basic",
      "https://massive.com/pricing?product=stocks",
      "The free Stocks Basic plan documents five calls per minute, EOD data and minute aggregates but not Quotes.",
    ),
    authority(
      "finnhub:free",
      "https://finnhub.io/pricing",
      "The free plan documents 60 calls per minute but omits OHLC history.",
    ),
    authority(
      "finnhub:last-bid-ask",
      "https://finnhub.io/docs/api/stock-bidask",
      "The bid/ask endpoint with volumes and timestamp requires premium access.",
    ),
    authority(
      "alpha-vantage:free",
      "https://www.alphavantage.co/support/",
      "The free service is limited to 25 requests per day and US real-time or delayed market data is premium-only.",
    ),
    authority(
      "fmp:basic",
      "https://site.financialmodelingprep.com/pricing-plans",
      "The free Basic plan permits 250 calls per day and only end-of-day market data.",
    ),
  ]);
}

function createCandidates(): readonly PersonalMarketDataZeroCostCandidate[] {
  return deepFreeze([
    {
      candidateId: PersonalMarketDataZeroCostCandidateId.TradierBrokerage,
      monthlyDataCostUsd: 0,
      brokerageAccountRequired: true,
      credentialMayReachAccountOrTradingSurface: true,
      exactTwelveSymbolCoverage: "UNVERIFIED",
      completedP1dBars: "DOCUMENTED",
      completedPt1hBars: "REQUIRES_REVIEWED_AGGREGATION",
      completedPt15mBars: "DOCUMENTED",
      completedPt5mBars: "DOCUMENTED",
      currentTwoSidedQuote: "DOCUMENTED",
      quoteSizes: "DOCUMENTED_WITH_UNIT",
      requestBudget: "120_PER_MINUTE",
      disposition:
        PersonalMarketDataZeroCostCandidateDisposition.ArchitectureReviewRequired,
      selected: false,
      blockers: [
        "A Tradier Brokerage account is required for real-time market data.",
        "The production credential belongs to a broader brokerage API surface and must be isolated from account and trading endpoints.",
        "Exact coverage for all 12 symbols, including MULS, is unverified.",
        "PT1H requires a reviewed aggregation from completed PT15M bars.",
      ],
      authorityIds: [
        "tradier:brokerage-api-cost",
        "tradier:market-data",
        "tradier:quotes",
        "tradier:historical-data",
        "tradier:rate-limits",
      ],
    },
    rejectedCandidate(
      PersonalMarketDataZeroCostCandidateId.MassiveBasic,
      "5_PER_MINUTE",
      ["The free plan does not include the required current two-sided Quotes."],
      ["massive:stocks-basic"],
      {
        completedP1dBars: "DOCUMENTED",
        completedPt1hBars: "REQUIRES_REVIEWED_AGGREGATION",
        completedPt15mBars: "REQUIRES_REVIEWED_AGGREGATION",
        completedPt5mBars: "REQUIRES_REVIEWED_AGGREGATION",
        currentTwoSidedQuote: "BLOCKED",
        quoteSizes: "BLOCKED",
      },
    ),
    rejectedCandidate(
      PersonalMarketDataZeroCostCandidateId.FinnhubFree,
      "60_PER_MINUTE",
      [
        "The free plan does not document the required OHLC history.",
        "The bid/ask endpoint and quote volumes require premium access.",
      ],
      ["finnhub:free", "finnhub:last-bid-ask"],
    ),
    rejectedCandidate(
      PersonalMarketDataZeroCostCandidateId.AlphaVantageFree,
      "25_PER_DAY",
      [
        "Real-time and 15-minute delayed US market data are premium-only.",
        "Twenty-five daily requests cannot sustain the required intraday workflow.",
      ],
      ["alpha-vantage:free"],
    ),
    rejectedCandidate(
      PersonalMarketDataZeroCostCandidateId.FmpBasic,
      "250_PER_DAY",
      ["The free Basic plan is end-of-day only and does not include intraday charts."],
      ["fmp:basic"],
      { completedP1dBars: "DOCUMENTED" },
    ),
  ]);
}

function rejectedCandidate(
  candidateId: Exclude<
  PersonalMarketDataZeroCostCandidateId,
  PersonalMarketDataZeroCostCandidateId.TradierBrokerage>,
  requestBudget: PersonalMarketDataZeroCostCandidate["requestBudget"],
  blockers: readonly string[],
  authorityIds: readonly string[],
  overrides: Partial<Pick<
  PersonalMarketDataZeroCostCandidate,
  "completedP1dBars" | "completedPt1hBars" | "completedPt15mBars"
  | "completedPt5mBars" | "currentTwoSidedQuote" | "quoteSizes">> = {},
): PersonalMarketDataZeroCostCandidate {
  return {
    candidateId,
    monthlyDataCostUsd: 0,
    brokerageAccountRequired: false,
    credentialMayReachAccountOrTradingSurface: false,
    exactTwelveSymbolCoverage: "UNVERIFIED",
    completedP1dBars: overrides.completedP1dBars ?? "BLOCKED",
    completedPt1hBars: overrides.completedPt1hBars ?? "BLOCKED",
    completedPt15mBars: overrides.completedPt15mBars ?? "BLOCKED",
    completedPt5mBars: overrides.completedPt5mBars ?? "BLOCKED",
    currentTwoSidedQuote: overrides.currentTwoSidedQuote ?? "BLOCKED",
    quoteSizes: overrides.quoteSizes ?? "BLOCKED",
    requestBudget,
    disposition:
      PersonalMarketDataZeroCostCandidateDisposition.RejectedForExactRequirement,
    selected: false,
    blockers,
    authorityIds,
  };
}

function authority(
  authorityId: string,
  url: string,
  assertion: string,
): PersonalMarketDataZeroCostAuthority {
  return { authorityId, url, assertion, reviewedAt: REVIEW_DATE };
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
