import { BarInterval } from "../../contracts/CanonicalBar";
import {
  PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION,
  PersonalMarketDataFeedCoverage,
  PersonalMarketDataProviderCoverageIssueCode,
  PersonalMarketDataProviderId,
  PersonalMarketDataProviderReadiness,
  PersonalMarketDataVerificationStatus,
  type PersonalMarketDataProviderAssessment,
  type PersonalMarketDataProviderBlocker,
  type PersonalMarketDataProviderCoverageIssue,
  type PersonalMarketDataProviderProfile,
  type PersonalMarketDataProviderRequirement,
} from "../../contracts/PersonalMarketDataProviderCoverage";

export const PERSONAL_MARKET_DATA_SYMBOLS = Object.freeze([
  "MU", "MULL",
  "TSLA", "TSLL", "TSLQ",
  "SPCX", "SPCH", "SSPC",
  "SKHY", "SKUU", "SKDD",
] as const);

export const PERSONAL_MARKET_DATA_LEGACY_TWELVE_SYMBOLS = Object.freeze([
  "MU", "MULL", "MULS",
  "TSLA", "TSLL", "TSLQ",
  "SPCX", "SPCH", "SSPC",
  "SKHY", "SKUU", "SKDD",
] as const);

export const PERSONAL_MARKET_DATA_INTERVALS = Object.freeze([
  BarInterval.OneDay,
  BarInterval.OneHour,
  BarInterval.FifteenMinutes,
  BarInterval.FiveMinutes,
] as const);

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._/-]{2,159}$/u;
const HTTPS_URL = /^https:\/\/[^\s]+$/u;

export class PersonalMarketDataProviderCoverageError extends Error {
  public constructor(public readonly issues: readonly PersonalMarketDataProviderCoverageIssue[]) {
    super("Personal market-data provider coverage assessment failed.");
    this.name = "PersonalMarketDataProviderCoverageError";
  }
}

export function createPersonalMarketDataProviderCatalog(): readonly PersonalMarketDataProviderProfile[] {
  const pending = Object.fromEntries(
    PERSONAL_MARKET_DATA_SYMBOLS.map((symbol) => [symbol, PersonalMarketDataVerificationStatus.PendingLiveSmoke]),
  );
  const retrievedAt = "2026-07-26T16:00:00.000Z";
  const authority = (evidenceId: string, url: string, assertion: string) => ({
    evidenceId, url, assertion, retrievedAt,
  });
  return deepFreeze([
    {
      schemaVersion: PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION,
      providerId: PersonalMarketDataProviderId.AlpacaBasicIex,
      displayName: "Alpaca Basic — IEX",
      monthlyCostUsd: 0,
      requiresCredentials: true,
      coverage: PersonalMarketDataFeedCoverage.SingleVenue,
      supportedIntervals: PERSONAL_MARKET_DATA_INTERVALS,
      latestTwoSidedQuoteDocumented: true,
      quoteSizesDocumented: true,
      adapterImplemented: true,
      symbolVerification: pending,
      authorities: [
        authority("alpaca:market-data:basic", "https://alpaca.markets/data", "Basic is a zero-monthly-fee US stock and ETF market-data plan using IEX."),
        authority("alpaca:historical-bars", "https://docs.alpaca.markets/us/v1.4.2/reference/stockbars", "Historical bars document minute, hour, and day aggregations."),
        authority("alpaca:latest-quote", "https://docs.alpaca.markets/us/reference/stocklatestquotesingle-1", "Latest quote provides the best bid and ask; stock quote fields document bid and ask sizes."),
        authority("alpaca:market-data:faq", "https://docs.alpaca.markets/us/docs/market-data-faq", "Free live stock data is IEX-only rather than consolidated SIP."),
      ],
    },
    {
      schemaVersion: PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION,
      providerId: PersonalMarketDataProviderId.AlpacaSip,
      displayName: "Alpaca Algo Trader Plus — SIP",
      monthlyCostUsd: 99,
      requiresCredentials: true,
      coverage: PersonalMarketDataFeedCoverage.ConsolidatedSip,
      supportedIntervals: PERSONAL_MARKET_DATA_INTERVALS,
      latestTwoSidedQuoteDocumented: true,
      quoteSizesDocumented: true,
      adapterImplemented: false,
      symbolVerification: pending,
      authorities: [
        authority("alpaca:market-data:sip", "https://alpaca.markets/data", "Paid plan provides all-US-exchange SIP coverage."),
        authority("alpaca:historical-bars", "https://docs.alpaca.markets/us/v1.4.2/reference/stockbars", "Historical bars document minute, hour, and day aggregations."),
        authority("alpaca:latest-quote", "https://docs.alpaca.markets/us/reference/stocklatestquotesingle-1", "Latest quote provides the best bid and ask; stock quote fields document bid and ask sizes."),
      ],
    },
    {
      schemaVersion: PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION,
      providerId: PersonalMarketDataProviderId.TwelveDataBasic,
      displayName: "Twelve Data Basic",
      monthlyCostUsd: 0,
      requiresCredentials: true,
      coverage: PersonalMarketDataFeedCoverage.PartialMarket,
      supportedIntervals: PERSONAL_MARKET_DATA_INTERVALS,
      latestTwoSidedQuoteDocumented: false,
      quoteSizesDocumented: false,
      adapterImplemented: false,
      symbolVerification: pending,
      authorities: [
        authority("twelve-data:time-series", "https://twelvedata.com/docs/market-data/time-series", "Time series supports required intraday and daily intervals."),
        authority("twelve-data:pricing", "https://twelvedata.com/pricing", "Basic allows eight API credits per minute and 800 per day."),
        authority("twelve-data:us-feed", "https://support.twelvedata.com/en/articles/9935903-us-equities-market-data", "US feed is not represented as consolidated full-market volume."),
      ],
    },
  ]);
}

export function assessPersonalMarketDataProvider(
  rawProfile: unknown,
  rawRequirement: unknown,
): PersonalMarketDataProviderAssessment {
  const issues = [
    ...validateProfile(rawProfile),
    ...validateRequirement(rawRequirement),
  ].sort((left, right) => `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`));
  if (issues.length > 0) throw new PersonalMarketDataProviderCoverageError(issues);
  const profile = rawProfile as PersonalMarketDataProviderProfile;
  const requirement = rawRequirement as PersonalMarketDataProviderRequirement;
  const blockers: PersonalMarketDataProviderBlocker[] = [];

  if (profile.monthlyCostUsd > requirement.maxMonthlyCostUsd) {
    blockers.push(blocker("COST_EXCEEDS_LIMIT", "monthlyCostUsd", "Provider cost exceeds the Owner budget."));
  }
  for (const interval of requirement.requiredIntervals) {
    if (!profile.supportedIntervals.includes(interval)) {
      blockers.push(blocker("INTERVAL_MISSING", "supportedIntervals", `Required interval ${interval} is missing.`));
    }
  }
  if ((requirement.requireTwoSidedQuote && !profile.latestTwoSidedQuoteDocumented)
    || (requirement.requireQuoteSizes && !profile.quoteSizesDocumented)) {
    blockers.push(blocker("QUOTE_CAPABILITY_MISSING", "quote", "Required two-sided quote and size semantics are not documented."));
  }
  for (const symbol of requirement.requiredSymbols) {
    const status = profile.symbolVerification[symbol];
    if (status === PersonalMarketDataVerificationStatus.Failed || status === undefined) {
      blockers.push(blocker("SYMBOL_FAILED", `symbolVerification.${symbol}`, `${symbol} failed or is absent from exact-symbol live verification.`));
    } else if (status !== PersonalMarketDataVerificationStatus.Verified) {
      blockers.push(blocker("SYMBOL_UNVERIFIED", `symbolVerification.${symbol}`, `${symbol} still requires a bounded live smoke check.`));
    }
  }

  const capabilityBlocked = blockers.some((entry) =>
    ["COST_EXCEEDS_LIMIT", "INTERVAL_MISSING", "QUOTE_CAPABILITY_MISSING", "SYMBOL_FAILED"].includes(entry.code));
  let readiness = PersonalMarketDataProviderReadiness.Blocked;
  if (!capabilityBlocked) {
    if (!profile.adapterImplemented) {
      blockers.push(blocker("ADAPTER_NOT_IMPLEMENTED", "adapterImplemented", "A reviewed network adapter is not implemented."));
    }
    if (!requirement.ownerApproved) {
      blockers.push(blocker("OWNER_APPROVAL_MISSING", "ownerApproved", "Owner approval is required before any live smoke request."));
    }
    if (profile.requiresCredentials && !requirement.credentialsAvailable) {
      blockers.push(blocker("CREDENTIALS_MISSING", "credentialsAvailable", "Provider credentials are not available."));
    }
    const pendingOnly = blockers.every((entry) =>
      ["ADAPTER_NOT_IMPLEMENTED", "CREDENTIALS_MISSING", "OWNER_APPROVAL_MISSING", "SYMBOL_UNVERIFIED"].includes(entry.code));
    if (pendingOnly) readiness = PersonalMarketDataProviderReadiness.ReadyForBoundedSmoke;
    if (blockers.length === 0) readiness = PersonalMarketDataProviderReadiness.ReadyForPersonalCollection;
  }

  const warnings = profile.coverage === PersonalMarketDataFeedCoverage.SingleVenue
    ? ["IEX-only observations are single-venue evidence and must not be labeled NBBO or full-market volume."]
    : profile.coverage === PersonalMarketDataFeedCoverage.PartialMarket
      ? ["Partial-market observations must not be labeled consolidated quotes or full-market volume."]
      : [];
  return deepFreeze({
    schemaVersion: PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION,
    assessmentId: `personal-provider-assessment:${fnv1a64(`${profile.providerId}|${requirement.requirementId}|${canonicalize(blockers)}`)}`,
    providerId: profile.providerId,
    readiness,
    coverage: profile.coverage,
    monthlyCostUsd: profile.monthlyCostUsd,
    blockers: blockers.sort((left, right) => `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`)),
    warnings,
    evidenceReferences: profile.authorities.map((entry) => entry.evidenceId).sort(),
    advisoryOnly: true,
    automatedExecutionAllowed: false,
    deterministic: true,
  });
}

function validateProfile(value: unknown): PersonalMarketDataProviderCoverageIssue[] {
  if (!isRecord(value)) return [issue(PersonalMarketDataProviderCoverageIssueCode.InvalidProfile, "$", "Profile must be an object.")];
  const issues: PersonalMarketDataProviderCoverageIssue[] = [];
  rejectUnknown(value, [
    "schemaVersion", "providerId", "displayName", "monthlyCostUsd", "requiresCredentials",
    "coverage", "supportedIntervals", "latestTwoSidedQuoteDocumented", "quoteSizesDocumented",
    "adapterImplemented", "symbolVerification", "authorities",
  ], "profile", issues);
  if (value.schemaVersion !== PERSONAL_MARKET_DATA_PROVIDER_COVERAGE_SCHEMA_VERSION
    || !Object.values(PersonalMarketDataProviderId).includes(value.providerId as PersonalMarketDataProviderId)
    || typeof value.displayName !== "string" || value.displayName.length < 3
    || !Number.isSafeInteger(value.monthlyCostUsd) || Number(value.monthlyCostUsd) < 0
    || typeof value.requiresCredentials !== "boolean"
    || !Object.values(PersonalMarketDataFeedCoverage).includes(value.coverage as PersonalMarketDataFeedCoverage)
    || !Array.isArray(value.supportedIntervals)
    || !value.supportedIntervals.every((entry) => Object.values(BarInterval).includes(entry as BarInterval))
    || typeof value.latestTwoSidedQuoteDocumented !== "boolean"
    || typeof value.quoteSizesDocumented !== "boolean"
    || typeof value.adapterImplemented !== "boolean"
    || !isRecord(value.symbolVerification)
    || !Array.isArray(value.authorities) || value.authorities.length === 0) {
    issues.push(issue(PersonalMarketDataProviderCoverageIssueCode.InvalidProfile, "profile", "Provider profile structure is invalid."));
    return issues;
  }
  for (const [index, authorityValue] of value.authorities.entries()) {
    if (!isRecord(authorityValue)
      || !IDENTIFIER.test(String(authorityValue.evidenceId))
      || !HTTPS_URL.test(String(authorityValue.url))
      || typeof authorityValue.assertion !== "string" || authorityValue.assertion.length < 10
      || !isTimestamp(authorityValue.retrievedAt)) {
      issues.push(issue(PersonalMarketDataProviderCoverageIssueCode.InvalidProfile, `profile.authorities[${index}]`, "Authority evidence is invalid."));
    }
  }
  return issues;
}

function validateRequirement(value: unknown): PersonalMarketDataProviderCoverageIssue[] {
  if (!isRecord(value)) return [issue(PersonalMarketDataProviderCoverageIssueCode.InvalidRequest, "$", "Requirement must be an object.")];
  const issues: PersonalMarketDataProviderCoverageIssue[] = [];
  rejectUnknown(value, [
    "requirementId", "requiredSymbols", "requiredIntervals", "requireTwoSidedQuote",
    "requireQuoteSizes", "maxMonthlyCostUsd", "ownerApproved", "credentialsAvailable",
  ], "requirement", issues);
  if (!IDENTIFIER.test(String(value.requirementId))
    || !Array.isArray(value.requiredSymbols) || value.requiredSymbols.length === 0
    || new Set(value.requiredSymbols).size !== value.requiredSymbols.length
    || !value.requiredSymbols.every((entry) => typeof entry === "string" && /^[A-Z][A-Z0-9.]{0,9}$/u.test(entry))
    || !Array.isArray(value.requiredIntervals) || value.requiredIntervals.length === 0
    || new Set(value.requiredIntervals).size !== value.requiredIntervals.length
    || !value.requiredIntervals.every((entry) => Object.values(BarInterval).includes(entry as BarInterval))
    || typeof value.requireTwoSidedQuote !== "boolean"
    || typeof value.requireQuoteSizes !== "boolean"
    || !Number.isSafeInteger(value.maxMonthlyCostUsd) || Number(value.maxMonthlyCostUsd) < 0
    || typeof value.ownerApproved !== "boolean"
    || typeof value.credentialsAvailable !== "boolean") {
    issues.push(issue(PersonalMarketDataProviderCoverageIssueCode.InvalidRequest, "requirement", "Provider requirement is invalid."));
  }
  return issues;
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
  issues: PersonalMarketDataProviderCoverageIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(issue(PersonalMarketDataProviderCoverageIssueCode.UndeclaredField, `${field}.${key}`, "Field is not declared."));
  }
}

function blocker(code: PersonalMarketDataProviderBlocker["code"], field: string, message: string): PersonalMarketDataProviderBlocker {
  return { code, field, message };
}

function issue(
  code: PersonalMarketDataProviderCoverageIssueCode,
  field: string,
  message: string,
): PersonalMarketDataProviderCoverageIssue {
  return { code, field, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
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

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
