export interface RobinhoodOptionFeeInput {
  readonly symbol: "GLD" | "IBIT";
  readonly tradeDate: string;
  readonly side: "BUY" | "SELL";
  readonly quantity: number;
  /** Total premium for the execution, in cents; not a per-share quote. */
  readonly grossPremiumCents: number;
  readonly executionCount: number;
  readonly customerClassification: "NONPROFESSIONAL" | "UNKNOWN";
}

export interface RobinhoodOptionFeeComponents {
  readonly commissionCents: number;
  readonly optionsRegulatoryAndOccCents: number;
  readonly secCents: number;
  readonly tradingActivityCents: number;
  readonly consolidatedAuditTrailCents: number;
  readonly totalCents: number;
}

export type RobinhoodOptionFeeBlocker = "TRADE_DATE_OUTSIDE_REVIEWED_PROFILE"
  | "FRAGMENTED_EXECUTIONS_UNSUPPORTED" | "CUSTOMER_CLASSIFICATION_UNKNOWN";

export interface RobinhoodOptionFeeEstimate {
  readonly schemaVersion: "1.0";
  readonly engineVersion: "ROBINHOOD_OPTION_FEE_ESTIMATE_V1";
  readonly status: "ESTIMATED" | "BLOCKED";
  readonly input: RobinhoodOptionFeeInput;
  readonly profile: {
    readonly profileId: "ROBINHOOD_US_ETF_OPTIONS_2026_09_04_V1";
    readonly broker: "ROBINHOOD_US";
    readonly applicableTradeDate: "2026-09-04";
    readonly reviewedOn: "2026-09-06";
    readonly feeScheduleVersion: "20260831";
    readonly executionModel: "SINGLE_EXECUTION";
    readonly currency: "USD";
  };
  readonly sourceReferences: readonly { readonly id: string; readonly title: string; readonly url: string }[];
  readonly blockers: readonly RobinhoodOptionFeeBlocker[];
  readonly fees: RobinhoodOptionFeeComponents | null;
  readonly limitations: readonly string[];
  readonly executionAllowed: false;
  readonly marketValidated: false;
  readonly brokerAccountVerified: false;
  readonly brokerFeesConfirmed: false;
  readonly existingReplayFeeAssumptionsChanged: false;
}

const INPUT_KEYS = ["symbol", "tradeDate", "side", "quantity", "grossPremiumCents", "executionCount", "customerClassification"];
const PROFILE = Object.freeze({
  profileId: "ROBINHOOD_US_ETF_OPTIONS_2026_09_04_V1", broker: "ROBINHOOD_US", applicableTradeDate: "2026-09-04",
  reviewedOn: "2026-09-06", feeScheduleVersion: "20260831", executionModel: "SINGLE_EXECUTION", currency: "USD",
} as const);
const SOURCES = Object.freeze([
  Object.freeze({ id: "ROBINHOOD_US_FEE_SCHEDULE", title: "Robinhood Financial Standard Pricing Fee Schedule, footer version 20260831",
    url: "https://cdn.robinhood.com/assets/robinhood/legal/RHF%20Fee%20Schedule.pdf" }),
  Object.freeze({ id: "ROBINHOOD_US_TRADING_FEES", title: "Trading fees on Robinhood",
    url: "https://robinhood.com/us/en/support/articles/trading-fees-on-robinhood/" }),
  Object.freeze({ id: "SEC_SECTION_31_2026", title: "SEC Section 31 Transaction Fee Rate Advisory for Fiscal Year 2026",
    url: "https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2" }),
  Object.freeze({ id: "FINRA_2026_FEE_SCHEDULE", title: "FINRA Fee Adjustment Schedule",
    url: "https://www.finra.org/rules-guidance/rule-filings/sr-finra-2024-019/fee-adjustment-schedule" }),
]);
const LIMITATIONS = Object.freeze([
  "Public references were reviewed on 2026-09-06; they are not a historical broker trade confirmation.",
  "The profile covers only 2026-09-04 ordinary nonprofessional GLD/IBIT long-option opening purchases or closing sales.",
  "One execution is assumed. Fragmented fills can change rounding and billed fees; unknown execution grouping is unsupported.",
  "SEC fees depend on actual gross sale proceeds. A later exit price needs a new estimate; this is not a fixed exit-fee guarantee.",
  "The combined ORF/OCC charge uses Robinhood's published blended rate, which can differ from underlying exchange charges.",
  "Spread, slippage, taxes, subscriptions and account-specific charges are excluded. Account approval and actual billed fees remain unverified.",
  "The estimate never updates the existing replay's fixed fee assumptions or authorizes a trade.",
]);

function integer(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 1 && value <= maximum;
}
function date(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === `${value}T00:00:00.000Z`;
}
function validateInput(input: unknown): RobinhoodOptionFeeInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error("INVALID_OPTION_FEE_INPUT_FIELDS");
  const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(input);
  if (keys.length !== INPUT_KEYS.length || keys.some((key) => typeof key !== "string" || !INPUT_KEYS.includes(key)
    || !Object.hasOwn(descriptors[key]!, "value") || !descriptors[key]!.enumerable)) throw new Error("INVALID_OPTION_FEE_INPUT_FIELDS");
  const value = input as Record<string, unknown>;
  if ((value.symbol !== "GLD" && value.symbol !== "IBIT") || !date(value.tradeDate)
    || (value.side !== "BUY" && value.side !== "SELL") || !integer(value.quantity, 100)
    || !integer(value.grossPremiumCents, 100_000_000) || !integer(value.executionCount, 100)
    || (value.customerClassification !== "NONPROFESSIONAL" && value.customerClassification !== "UNKNOWN")) throw new Error("INVALID_OPTION_FEE_INPUT");
  return Object.freeze({ symbol: value.symbol, tradeDate: value.tradeDate, side: value.side, quantity: value.quantity,
    grossPremiumCents: value.grossPremiumCents, executionCount: value.executionCount, customerClassification: value.customerClassification });
}
function ceil(numerator: bigint, denominator: bigint): bigint { return (numerator + denominator - 1n) / denominator; }
/** Robinhood's sub-one-cent waiver precedes nearest-cent, half-up rounding. */
function subcentZeroThenNearest(numerator: bigint, denominator: bigint): bigint {
  return numerator < denominator ? 0n : (numerator + denominator / 2n) / denominator;
}

/** Pure dated research arithmetic. No source download, account access or replay mutation. */
export function estimateRobinhoodOptionFees(input: unknown): RobinhoodOptionFeeEstimate {
  const value = validateInput(input), blockers: RobinhoodOptionFeeBlocker[] = [];
  if (value.tradeDate !== PROFILE.applicableTradeDate) blockers.push("TRADE_DATE_OUTSIDE_REVIEWED_PROFILE");
  if (value.executionCount !== 1) blockers.push("FRAGMENTED_EXECUTIONS_UNSUPPORTED");
  if (value.customerClassification !== "NONPROFESSIONAL") blockers.push("CUSTOMER_CLASSIFICATION_UNKNOWN");
  let fees: RobinhoodOptionFeeComponents | null = null;
  if (blockers.length === 0) {
    const quantity = BigInt(value.quantity), gross = BigInt(value.grossPremiumCents), sell = value.side === "SELL";
    const orfOcc = 4n * quantity;
    const sec = sell ? ceil(206n * gross, 10_000_000n) : 0n;
    // At most 100 contracts keeps TAF well below the published per-execution cap.
    const taf = sell ? subcentZeroThenNearest(329n * quantity, 1000n) : 0n;
    const cat = subcentZeroThenNearest(3n * quantity, 100n);
    // Validated bounds keep every result safely representable as integer cents.
    fees = Object.freeze({ commissionCents: 0, optionsRegulatoryAndOccCents: Number(orfOcc), secCents: Number(sec),
      tradingActivityCents: Number(taf), consolidatedAuditTrailCents: Number(cat), totalCents: Number(orfOcc + sec + taf + cat) });
  }
  return Object.freeze({ schemaVersion: "1.0", engineVersion: "ROBINHOOD_OPTION_FEE_ESTIMATE_V1",
    status: fees === null ? "BLOCKED" : "ESTIMATED", input: value, profile: PROFILE, sourceReferences: SOURCES,
    blockers: Object.freeze(blockers), fees, limitations: LIMITATIONS, executionAllowed: false, marketValidated: false,
    brokerAccountVerified: false, brokerFeesConfirmed: false, existingReplayFeeAssumptionsChanged: false });
}
