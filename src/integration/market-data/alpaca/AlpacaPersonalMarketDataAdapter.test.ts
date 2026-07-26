import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  AlpacaPersonalIssueCode,
  AlpacaPersonalRequestKind,
  AlpacaPersonalResponseStatus,
  type AlpacaPersonalDryRunInput,
} from "./AlpacaPersonalMarketDataContracts";
import {
  ALPACA_PERSONAL_EXACT_SYMBOLS,
  AlpacaPersonalMarketDataPlanError,
  planAlpacaPersonalMarketDataDryRun,
} from "./AlpacaPersonalMarketDataPlanner";
import { validateAlpacaPersonalMarketDataResponse } from "./AlpacaPersonalMarketDataResponseValidator";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}

function input(): AlpacaPersonalDryRunInput {
  return {
    planId: "personal-alpaca:dry-run:1",
    symbols: ALPACA_PERSONAL_EXACT_SYMBOLS,
    plannedAt: "2026-07-26T14:00:00.000Z",
    windows: [
      { interval: BarInterval.OneDay, startTime: "2026-06-01T00:00:00.000Z", endTime: "2026-07-26T00:00:00.000Z", maxRecords: 60 },
      { interval: BarInterval.OneHour, startTime: "2026-07-20T13:30:00.000Z", endTime: "2026-07-26T14:00:00.000Z", maxRecords: 200 },
      { interval: BarInterval.FifteenMinutes, startTime: "2026-07-25T13:30:00.000Z", endTime: "2026-07-26T14:00:00.000Z", maxRecords: 200 },
      { interval: BarInterval.FiveMinutes, startTime: "2026-07-26T13:30:00.000Z", endTime: "2026-07-26T14:00:00.000Z", maxRecords: 100 },
    ],
  };
}

const quote = (timestamp = "2026-07-26T13:59:59.000Z") => ({
  ap: 101.25,
  as: 4,
  ax: "V",
  bp: 101.2,
  bs: 3,
  bx: "V",
  c: ["R"],
  t: timestamp,
  z: "C",
});

const bar = (timestamp: string, close: number) => ({
  c: close,
  h: close + 1,
  l: close - 1,
  n: 20,
  o: close - 0.25,
  t: timestamp,
  v: 1_000,
  vw: close,
});

test("dry-run creates exactly four bars requests and one quote request", () => {
  const result = planAlpacaPersonalMarketDataDryRun(input());
  equal(result.requests.length, 5, "request count");
  equal(result.requests.filter((entry) => entry.kind === AlpacaPersonalRequestKind.Bars).length, 4, "bars count");
  equal(result.requests.at(-1)?.kind, AlpacaPersonalRequestKind.LatestQuotes, "quote request");
});

test("every request fixes IEX and the exact ordered symbol set", () => {
  const result = planAlpacaPersonalMarketDataDryRun(input());
  for (const request of result.requests) {
    assert(request.query.some(([key, value]) => key === "feed" && value === "iex"), "feed must be IEX");
    assert(request.query.some(([key, value]) => key === "symbols" && value === ALPACA_PERSONAL_EXACT_SYMBOLS.join(",")), "symbol set mismatch");
  }
});

test("bar requests map exact canonical intervals and use raw ascending data", () => {
  const result = planAlpacaPersonalMarketDataDryRun(input());
  const timeframes = result.requests.slice(0, 4).map((request) => request.query.find(([key]) => key === "timeframe")?.[1]);
  equal(JSON.stringify(timeframes), JSON.stringify(["1Day", "1Hour", "15Min", "5Min"]), "timeframes");
  for (const request of result.requests.slice(0, 4)) {
    assert(request.query.some(([key, value]) => key === "adjustment" && value === "raw"), "raw adjustment");
    assert(request.query.some(([key, value]) => key === "sort" && value === "asc"), "ascending order");
  }
});

test("dry-run has zero network, persistence, trading, retry, pagination, polling, and streaming authority", () => {
  const result = planAlpacaPersonalMarketDataDryRun(input());
  equal(result.networkRequests, 0, "network");
  equal(result.persistenceWrites, 0, "writes");
  equal(result.tradingApiAllowed, false, "trading");
  equal(result.automaticRetryAllowed, false, "retry");
  equal(result.paginationAllowed, false, "pagination");
  equal(result.pollingAllowed, false, "polling");
  equal(result.streamingAllowed, false, "streaming");
  equal(result.automatedExecutionAllowed, false, "execution");
});

test("dry-run warns that IEX is not NBBO or consolidated volume", () => {
  const result = planAlpacaPersonalMarketDataDryRun(input());
  assert(result.warnings.some((entry) => entry.includes("not NBBO")), "NBBO warning missing");
});

test("symbol substitution fails closed", () => {
  const value = input();
  expectPlanIssue(
    { ...value, symbols: value.symbols.map((symbol) => symbol === "SPCH" ? "SPY" : symbol) },
    AlpacaPersonalIssueCode.SymbolSetMismatch,
  );
});

test("missing interval fails closed", () => {
  const value = input();
  expectPlanIssue({ ...value, windows: value.windows.slice(1) }, AlpacaPersonalIssueCode.InvalidWindow);
});

test("unbounded record request fails closed", () => {
  const value = input();
  expectPlanIssue(
    { ...value, windows: value.windows.map((window) => ({ ...window, maxRecords: 10_000 })) },
    AlpacaPersonalIssueCode.InvalidWindow,
  );
});

test("undeclared leverage or order field fails closed", () => {
  expectPlanIssue({ ...input(), orderType: "MARKET" }, AlpacaPersonalIssueCode.UndeclaredField);
});

test("valid exact latest quotes response is accepted without widening coverage", () => {
  const body = JSON.stringify({ quotes: { MU: quote(), MULL: quote() } });
  const result = validateAlpacaPersonalMarketDataResponse(body, AlpacaPersonalRequestKind.LatestQuotes, ["MU", "MULL"]);
  equal(result.status, AlpacaPersonalResponseStatus.Valid, "status");
  equal(result.quotes.length, 2, "quotes");
  equal(result.feed, "iex", "feed");
  equal(result.coverage, "SINGLE_VENUE", "coverage");
});

test("provider nanosecond UTC timestamps remain valid at the provider boundary", () => {
  const result = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({ quotes: { MU: quote("2026-07-26T13:59:59.123456789Z") } }),
    AlpacaPersonalRequestKind.LatestQuotes,
    ["MU"],
  );
  equal(result.status, AlpacaPersonalResponseStatus.Valid, "status");
  equal(result.quotes[0]?.timestamp, "2026-07-26T13:59:59.123456789Z", "timestamp");
});

test("quote response with missing symbol fails closed", () => {
  const result = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({ quotes: { MU: quote() } }),
    AlpacaPersonalRequestKind.LatestQuotes,
    ["MU", "MULL"],
  );
  assert(result.blockers.some((entry) => entry.code === AlpacaPersonalIssueCode.MissingSymbol), "missing symbol blocker");
});

test("crossed quote or unknown quote field fails closed", () => {
  const crossed = { ...quote(), bp: 102, extension: "BUY" };
  const result = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({ quotes: { MU: crossed } }),
    AlpacaPersonalRequestKind.LatestQuotes,
    ["MU"],
  );
  assert(result.blockers.some((entry) => entry.code === AlpacaPersonalIssueCode.InvalidQuote), "invalid quote blocker");
});

test("valid bounded chronological bars response is accepted", () => {
  const result = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({
      bars: {
        MU: [
          bar("2026-07-26T13:30:00.000Z", 100),
          bar("2026-07-26T13:35:00.000Z", 101),
        ],
      },
      next_page_token: null,
    }),
    AlpacaPersonalRequestKind.Bars,
    ["MU"],
  );
  equal(result.status, AlpacaPersonalResponseStatus.Valid, "status");
  equal(result.bars.length, 2, "bars");
});

test("nonempty page token fails rather than automatically fetching another page", () => {
  const result = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({
      bars: { MU: [bar("2026-07-26T13:30:00.000Z", 100), bar("2026-07-26T13:35:00.000Z", 101)] },
      next_page_token: "secret-page",
    }),
    AlpacaPersonalRequestKind.Bars,
    ["MU"],
  );
  assert(result.blockers.some((entry) => entry.code === AlpacaPersonalIssueCode.PaginationForbidden), "pagination blocker");
});

test("malformed JSON and provider error envelopes are sanitized and rejected", () => {
  const malformed = validateAlpacaPersonalMarketDataResponse("{", AlpacaPersonalRequestKind.Bars, ["MU"]);
  const provider = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({ code: 401, message: "credential detail" }),
    AlpacaPersonalRequestKind.LatestQuotes,
    ["MU"],
  );
  assert(malformed.blockers.some((entry) => entry.code === AlpacaPersonalIssueCode.MalformedJson), "malformed blocker");
  assert(provider.blockers.some((entry) => entry.code === AlpacaPersonalIssueCode.ProviderError), "provider blocker");
  assert(!JSON.stringify(provider).includes("credential detail"), "provider narrative leaked");
});

test("plans and validated responses are deeply immutable", () => {
  const plan = planAlpacaPersonalMarketDataDryRun(input());
  const response = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({ quotes: { MU: quote() } }),
    AlpacaPersonalRequestKind.LatestQuotes,
    ["MU"],
  );
  assert(Object.isFrozen(plan) && Object.isFrozen(plan.requests) && Object.isFrozen(plan.requests[0]?.query), "plan not frozen");
  assert(Object.isFrozen(response) && Object.isFrozen(response.quotes), "response not frozen");
});

function expectPlanIssue(value: unknown, code: AlpacaPersonalIssueCode): void {
  try {
    planAlpacaPersonalMarketDataDryRun(value);
  } catch (error) {
    assert(error instanceof AlpacaPersonalMarketDataPlanError, "wrong error type");
    assert(error.issues.some((entry) => entry.code === code), `missing issue ${code}`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`${passed}/${tests.length} Alpaca personal market-data adapter tests passed.`);
