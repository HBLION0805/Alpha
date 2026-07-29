import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
  ALPACA_PERSONAL_MARKET_DATA_SCHEMA_VERSION,
  AlpacaPersonalIssueCode,
  AlpacaPersonalRequestKind,
  type AlpacaPersonalDryRunInput,
  type AlpacaPersonalDryRunPlan,
  type AlpacaPersonalHttpRequest,
  type AlpacaPersonalIssue,
  type AlpacaPersonalTimeframeWindow,
} from "./AlpacaPersonalMarketDataContracts";

export const ALPACA_PERSONAL_EXACT_SYMBOLS = Object.freeze([
  "MU", "MULL",
  "TSLA", "TSLL", "TSLQ",
  "SPCX", "SPCH", "SSPC",
  "SKHY", "SKUU", "SKDD",
] as const);

const REQUIRED_INTERVALS = Object.freeze([
  BarInterval.OneDay,
  BarInterval.OneHour,
  BarInterval.FifteenMinutes,
  BarInterval.FiveMinutes,
] as const);
const TIMEFRAME = Object.freeze({
  [BarInterval.OneDay]: "1Day",
  [BarInterval.OneHour]: "1Hour",
  [BarInterval.FifteenMinutes]: "15Min",
  [BarInterval.FiveMinutes]: "5Min",
} as const);
const BAR_ENDPOINT = "https://data.alpaca.markets/v2/stocks/bars" as const;
const QUOTE_ENDPOINT = "https://data.alpaca.markets/v2/stocks/quotes/latest" as const;

export class AlpacaPersonalMarketDataPlanError extends Error {
  public constructor(public readonly issues: readonly AlpacaPersonalIssue[]) {
    super("Alpaca personal market-data dry-run planning failed.");
    this.name = "AlpacaPersonalMarketDataPlanError";
  }
}

export function planAlpacaPersonalMarketDataDryRun(rawInput: unknown): AlpacaPersonalDryRunPlan {
  const issues = validateInput(rawInput);
  if (issues.length > 0) throw new AlpacaPersonalMarketDataPlanError(issues);
  const input = rawInput as AlpacaPersonalDryRunInput;
  const symbols = [...input.symbols];
  const requestPlan: AlpacaPersonalHttpRequest[] = REQUIRED_INTERVALS.map((interval) => {
    const window = input.windows.find((entry) => entry.interval === interval)!;
    return deepFreeze({
      requestId: `${input.planId}:bars:${interval}`,
      kind: AlpacaPersonalRequestKind.Bars,
      method: "GET",
      endpoint: BAR_ENDPOINT,
      query: [
        ["symbols", symbols.join(",")],
        ["timeframe", TIMEFRAME[interval]],
        ["start", window.startTime],
        ["end", window.endTime],
        ["limit", String(window.maxRecords)],
        ["adjustment", "raw"],
        ["feed", "iex"],
        ["currency", "USD"],
        ["sort", "asc"],
      ],
      timeoutMs: 10_000,
      maxResponseBytes: 1_000_000,
    });
  });
  requestPlan.push(deepFreeze({
    requestId: `${input.planId}:quotes:latest`,
    kind: AlpacaPersonalRequestKind.LatestQuotes,
    method: "GET",
    endpoint: QUOTE_ENDPOINT,
    query: [
      ["symbols", symbols.join(",")],
      ["feed", "iex"],
      ["currency", "USD"],
    ],
    timeoutMs: 10_000,
    maxResponseBytes: 1_000_000,
  }));
  return deepFreeze({
    schemaVersion: ALPACA_PERSONAL_MARKET_DATA_SCHEMA_VERSION,
    planId: input.planId,
    providerId: ALPACA_PERSONAL_MARKET_DATA_PROVIDER_ID,
    feed: "iex",
    coverage: "SINGLE_VENUE",
    symbols,
    requests: requestPlan,
    requestBudget: 5,
    networkRequests: 0,
    persistenceWrites: 0,
    automaticRetryAllowed: false,
    paginationAllowed: false,
    pollingAllowed: false,
    streamingAllowed: false,
    tradingApiAllowed: false,
    automatedExecutionAllowed: false,
    warnings: [
      "IEX is single-venue evidence; quotes are not NBBO and volume is not consolidated US market volume.",
      "Dry-run only: no credential was read and no network request was made.",
    ],
  });
}

function validateInput(value: unknown): AlpacaPersonalIssue[] {
  if (!isRecord(value)) return [issue(AlpacaPersonalIssueCode.InvalidInput, "$", "Input must be an object.")];
  const issues: AlpacaPersonalIssue[] = [];
  rejectUnknown(value, ["planId", "symbols", "windows", "plannedAt"], "$", issues);
  if (typeof value.planId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:._/-]{2,159}$/u.test(value.planId)
    || !isTimestamp(value.plannedAt)) {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidInput, "$", "Plan identity or time is invalid."));
  }
  if (!Array.isArray(value.symbols)
    || value.symbols.length !== ALPACA_PERSONAL_EXACT_SYMBOLS.length
    || value.symbols.some((symbol, index) => symbol !== ALPACA_PERSONAL_EXACT_SYMBOLS[index])) {
    issues.push(issue(AlpacaPersonalIssueCode.SymbolSetMismatch, "symbols", "Symbols must match the exact ordered personal MVP set."));
  }
  if (!Array.isArray(value.windows)
    || value.windows.length !== REQUIRED_INTERVALS.length
    || new Set(value.windows.map((entry) => isRecord(entry) ? entry.interval : undefined)).size !== REQUIRED_INTERVALS.length) {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidWindow, "windows", "Exactly one window is required for each MVP interval."));
    return sortIssues(issues);
  }
  const windows = value.windows;
  windows.forEach((window, index) => validateWindow(window, `windows[${index}]`, issues));
  if (!REQUIRED_INTERVALS.every((interval) => windows.some((entry) => isRecord(entry) && entry.interval === interval))) {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidWindow, "windows", "Required P1D, PT1H, PT15M, and PT5M windows are incomplete."));
  }
  return sortIssues(issues);
}

function validateWindow(value: unknown, field: string, issues: AlpacaPersonalIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidWindow, field, "Window must be an object."));
    return;
  }
  rejectUnknown(value, ["interval", "startTime", "endTime", "maxRecords"], field, issues);
  if (!REQUIRED_INTERVALS.includes(value.interval as typeof REQUIRED_INTERVALS[number])
    || !isTimestamp(value.startTime) || !isTimestamp(value.endTime)
    || Date.parse(String(value.startTime)) >= Date.parse(String(value.endTime))
    || !Number.isSafeInteger(value.maxRecords) || Number(value.maxRecords) < 2 || Number(value.maxRecords) > 1_000) {
    issues.push(issue(AlpacaPersonalIssueCode.InvalidWindow, field, "Interval, UTC window, or record bound is invalid."));
  }
}

function rejectUnknown(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
  issues: AlpacaPersonalIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(issue(AlpacaPersonalIssueCode.UndeclaredField, `${field}.${key}`, "Field is not declared."));
  }
}

function issue(code: AlpacaPersonalIssueCode, field: string, message: string): AlpacaPersonalIssue {
  return { code, field, message };
}

function sortIssues(issues: readonly AlpacaPersonalIssue[]): AlpacaPersonalIssue[] {
  return issues.map((entry) => ({ ...entry }))
    .sort((left, right) => `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`));
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
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
