import { BarInterval } from "../../contracts/CanonicalBar";
import {
  PERSONAL_MARKET_DATA_TWELVE_DATA_QUALIFICATION_SCHEMA_VERSION,
  PersonalMarketDataTwelveDataCapability,
  PersonalMarketDataTwelveDataCapabilityStatus,
  type PersonalMarketDataTwelveDataBudgetAssessment,
  type PersonalMarketDataTwelveDataCapabilityFinding,
  type PersonalMarketDataTwelveDataQualification,
} from "../../contracts/PersonalMarketDataTwelveDataQualification";
import {
  PERSONAL_MARKET_DATA_INTERVALS,
  PERSONAL_MARKET_DATA_SYMBOLS,
} from "../personal-market-data-provider-coverage/PersonalMarketDataProviderCoverageEngine";
import {
  createMulsAssetNotFoundEvidence,
  createPersonalMarketDataAlternativeProviderQualificationPlan,
} from "../personal-market-data-alternative-provider-qualification/PersonalMarketDataAlternativeProviderQualificationEngine";

const OFFICIAL_REVIEW =
  "docs/research/TWELVE_DATA_OFFICIAL_EVIDENCE_AND_BAR_SEMANTICS.md";
const ADAPTER_SPEC = "docs/specifications/TWELVE_DATA_ADAPTER.md";
const LIVE_SMOKE_SPEC = "docs/specifications/TWELVE_DATA_LIVE_SMOKE.md";
const C5_SPEC =
  "docs/specifications/PERSONAL_MARKET_DATA_ALTERNATIVE_PROVIDER_QUALIFICATION.md";

export class PersonalMarketDataTwelveDataQualificationError extends Error {
  public constructor() {
    super("Twelve Data personal market-data qualification failed.");
    this.name = "PersonalMarketDataTwelveDataQualificationError";
  }
}

export function createPersonalMarketDataTwelveDataQualification(
  rawC5Plan: unknown,
): PersonalMarketDataTwelveDataQualification {
  const expectedPlan = createPersonalMarketDataAlternativeProviderQualificationPlan(
    createMulsAssetNotFoundEvidence(),
  );
  if (canonicalize(rawC5Plan) !== canonicalize(expectedPlan)) {
    throw new PersonalMarketDataTwelveDataQualificationError();
  }

  const findings: readonly PersonalMarketDataTwelveDataCapabilityFinding[] = [
    finding(
      PersonalMarketDataTwelveDataCapability.ExactMulsReference,
      PersonalMarketDataTwelveDataCapabilityStatus.Unverified,
      [OFFICIAL_REVIEW, C5_SPEC],
      [
        "Official broad ETF coverage does not prove the exact MULS reference.",
        "No Twelve Data reference or market-data request for MULS has been authorized or executed.",
      ],
    ),
    finding(
      PersonalMarketDataTwelveDataCapability.IntradayBars,
      PersonalMarketDataTwelveDataCapabilityStatus.NarrowImplementationOnly,
      [OFFICIAL_REVIEW, ADAPTER_SPEC],
      [
        "The reviewed provider contract and current adapter support PT5M, PT15M, and PT1H.",
        "The adapter has only a built-in AAPL fixture mapping and does not implement the exact 12-symbol registry.",
      ],
    ),
    finding(
      PersonalMarketDataTwelveDataCapability.DailyBar,
      PersonalMarketDataTwelveDataCapabilityStatus.Blocked,
      [OFFICIAL_REVIEW, ADAPTER_SPEC],
      [
        "P1D is intentionally rejected by the current adapter.",
        "Daily time-series rows are not automatically accepted as confirmed official EOD closes.",
      ],
    ),
    finding(
      PersonalMarketDataTwelveDataCapability.TwoSidedQuote,
      PersonalMarketDataTwelveDataCapabilityStatus.Unverified,
      [OFFICIAL_REVIEW, ADAPTER_SPEC],
      [
        "The reviewed implementation exposes Bars only.",
        "No reviewed Twelve Data contract proves Alpha's exact bid, ask, timestamp, and provenance requirements.",
      ],
    ),
    finding(
      PersonalMarketDataTwelveDataCapability.QuoteSizes,
      PersonalMarketDataTwelveDataCapabilityStatus.Unverified,
      [OFFICIAL_REVIEW, ADAPTER_SPEC],
      [
        "No reviewed evidence establishes exact bid-size and ask-size fields.",
        "No reviewed evidence establishes the quantity unit or conversion rule for those fields.",
      ],
    ),
    finding(
      PersonalMarketDataTwelveDataCapability.BarVolumeUnits,
      PersonalMarketDataTwelveDataCapabilityStatus.Blocked,
      [OFFICIAL_REVIEW, LIVE_SMOKE_SPEC],
      [
        "The official evidence does not establish live equity volume as Alpha BASE_UNITS.",
        "The current normalizer therefore rejects live Canonical Bars with unresolved volume units.",
      ],
    ),
    finding(
      PersonalMarketDataTwelveDataCapability.FreeRequestBudget,
      PersonalMarketDataTwelveDataCapabilityStatus.Blocked,
      [OFFICIAL_REVIEW],
      [
        "The four required Bar intervals alone cost 48 credits for one 12-symbol coverage snapshot.",
        "The free eight-credit minute limit needs at least six minutes even before Quote credits are counted.",
        "The PT5M Bars alone plus one observation of each slower interval require at least 972 credits per day; Quote credits are excluded.",
      ],
    ),
  ];
  const budget = createBudgetAssessment();
  const identity = {
    providerId: "TWELVE_DATA_BASIC",
    requiredSymbols: PERSONAL_MARKET_DATA_SYMBOLS,
    requiredIntervals: PERSONAL_MARKET_DATA_INTERVALS,
    findings,
    budget,
  };

  return deepFreeze({
    schemaVersion: PERSONAL_MARKET_DATA_TWELVE_DATA_QUALIFICATION_SCHEMA_VERSION,
    qualificationId: `personal-twelve-data-qualification:${fnv1a64(canonicalize(identity))}`,
    providerId: "TWELVE_DATA_BASIC",
    evidenceAccessDate: "2026-07-20",
    requiredSymbols: [...PERSONAL_MARKET_DATA_SYMBOLS],
    requiredIntervals: [...PERSONAL_MARKET_DATA_INTERVALS],
    findings,
    budget,
    result: "NOT_QUALIFIED_AS_COMPLETE_PROVIDER",
    permittedRole: "BARS_RESEARCH_CANDIDATE_ONLY",
    nextTask: "DESIGN_BOUNDED_TWELVE_DATA_REFERENCE_DIAGNOSTIC",
    exactSymbolSetMayBeReduced: false,
    networkAuthorized: false,
    credentialUseAuthorized: false,
    collectionAuthorized: false,
    recommendationAuthority: false,
    tradingAuthority: false,
    deterministic: true,
    advisoryOnly: true,
  });
}

function createBudgetAssessment(): PersonalMarketDataTwelveDataBudgetAssessment {
  const symbols = PERSONAL_MARKET_DATA_SYMBOLS.length;
  const requiredIntervals = PERSONAL_MARKET_DATA_INTERVALS.length;
  const creditsPerSymbolProduct = 1;
  const freeCreditsPerMinute = 8;
  const freeCreditsPerDay = 800;
  const barOnlyCoverageSnapshotCredits =
    symbols * requiredIntervals * creditsPerSymbolProduct;
  const minimumMinutesPerBarOnlyCoverageSnapshot =
    Math.ceil(barOnlyCoverageSnapshotCredits / freeCreditsPerMinute);
  const maximumBarOnlyCoverageSnapshotsPerDay =
    Math.floor(freeCreditsPerDay / barOnlyCoverageSnapshotCredits);
  const regularSessionFiveMinuteCycles = 78;
  const fiveMinuteBarCreditsPerCycle = symbols;
  const oneDailyHourlyAndFifteenMinuteObservationPerSymbol = symbols * 3;
  const minimumBarOnlyDailyCadenceCredits =
    regularSessionFiveMinuteCycles * fiveMinuteBarCreditsPerCycle
    + oneDailyHourlyAndFifteenMinuteObservationPerSymbol;
  return deepFreeze({
    symbols: 12,
    requiredIntervals: 4,
    creditsPerSymbolProduct: 1,
    freeCreditsPerMinute: 8,
    freeCreditsPerDay: 800,
    barOnlyCoverageSnapshotCredits,
    minimumMinutesPerBarOnlyCoverageSnapshot,
    maximumBarOnlyCoverageSnapshotsPerDay,
    regularSessionFiveMinuteCycles,
    fiveMinuteBarCreditsPerCycle,
    minimumBarOnlyDailyCadenceCredits,
    minimumBarOnlyDailyCreditDeficit: minimumBarOnlyDailyCadenceCredits - freeCreditsPerDay,
    barOnlyCoverageSnapshotFitsOneMinute: false,
    barOnlyFiveMinuteCadenceFitsFreeDay: false,
  });
}

function finding(
  capability: PersonalMarketDataTwelveDataCapability,
  status: PersonalMarketDataTwelveDataCapabilityStatus,
  evidenceReferences: readonly string[],
  reasons: readonly string[],
): PersonalMarketDataTwelveDataCapabilityFinding {
  return deepFreeze({ capability, status, evidenceReferences, reasons });
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
