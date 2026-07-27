import type { BarInterval } from "./CanonicalBar";

export const PERSONAL_MARKET_DATA_TWELVE_DATA_QUALIFICATION_SCHEMA_VERSION = "1.0" as const;

export enum PersonalMarketDataTwelveDataCapability {
  ExactMulsReference = "EXACT_MULS_REFERENCE",
  IntradayBars = "INTRADAY_BARS",
  DailyBar = "DAILY_BAR",
  TwoSidedQuote = "TWO_SIDED_QUOTE",
  QuoteSizes = "QUOTE_SIZES",
  BarVolumeUnits = "BAR_VOLUME_UNITS",
  FreeRequestBudget = "FREE_REQUEST_BUDGET",
}

export enum PersonalMarketDataTwelveDataCapabilityStatus {
  NarrowImplementationOnly = "NARROW_IMPLEMENTATION_ONLY",
  Unverified = "UNVERIFIED",
  Blocked = "BLOCKED",
}

export interface PersonalMarketDataTwelveDataCapabilityFinding {
  readonly capability: PersonalMarketDataTwelveDataCapability;
  readonly status: PersonalMarketDataTwelveDataCapabilityStatus;
  readonly evidenceReferences: readonly string[];
  readonly reasons: readonly string[];
}

export interface PersonalMarketDataTwelveDataBudgetAssessment {
  readonly symbols: 12;
  readonly requiredIntervals: 4;
  readonly creditsPerSymbolProduct: 1;
  readonly freeCreditsPerMinute: 8;
  readonly freeCreditsPerDay: 800;
  readonly barOnlyCoverageSnapshotCredits: number;
  readonly minimumMinutesPerBarOnlyCoverageSnapshot: number;
  readonly maximumBarOnlyCoverageSnapshotsPerDay: number;
  readonly regularSessionFiveMinuteCycles: 78;
  readonly fiveMinuteBarCreditsPerCycle: number;
  readonly minimumBarOnlyDailyCadenceCredits: number;
  readonly minimumBarOnlyDailyCreditDeficit: number;
  readonly barOnlyCoverageSnapshotFitsOneMinute: false;
  readonly barOnlyFiveMinuteCadenceFitsFreeDay: false;
}

export interface PersonalMarketDataTwelveDataQualification {
  readonly schemaVersion: typeof PERSONAL_MARKET_DATA_TWELVE_DATA_QUALIFICATION_SCHEMA_VERSION;
  readonly qualificationId: string;
  readonly providerId: "TWELVE_DATA_BASIC";
  readonly evidenceAccessDate: "2026-07-20";
  readonly requiredSymbols: readonly string[];
  readonly requiredIntervals: readonly BarInterval[];
  readonly findings: readonly PersonalMarketDataTwelveDataCapabilityFinding[];
  readonly budget: PersonalMarketDataTwelveDataBudgetAssessment;
  readonly result: "NOT_QUALIFIED_AS_COMPLETE_PROVIDER";
  readonly permittedRole: "BARS_RESEARCH_CANDIDATE_ONLY";
  readonly nextTask: "DESIGN_BOUNDED_TWELVE_DATA_REFERENCE_DIAGNOSTIC";
  readonly exactSymbolSetMayBeReduced: false;
  readonly networkAuthorized: false;
  readonly credentialUseAuthorized: false;
  readonly collectionAuthorized: false;
  readonly recommendationAuthority: false;
  readonly tradingAuthority: false;
  readonly deterministic: true;
  readonly advisoryOnly: true;
}
