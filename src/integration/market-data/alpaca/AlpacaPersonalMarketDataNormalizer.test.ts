import {
  BarFreshnessStatus,
  BarInterval,
  BarMarketCoverage,
  BarQuantityUnit,
} from "../../../contracts/CanonicalBar";
import {
  CanonicalQuoteStatus,
  QuoteQuantityUnit,
} from "../../../contracts/CanonicalQuote";
import {
  AlpacaPersonalIssueCode,
  AlpacaPersonalRequestKind,
  type AlpacaPersonalBarNormalizationContext,
  type AlpacaPersonalNormalizationPolicy,
  type AlpacaPersonalQuoteNormalizationContext,
} from "./AlpacaPersonalMarketDataContracts";
import {
  createAlpacaPersonalInstrumentMappings,
  normalizeAlpacaPersonalBars,
  normalizeAlpacaPersonalQuotes,
} from "./AlpacaPersonalMarketDataNormalizer";
import { ALPACA_PERSONAL_EXACT_SYMBOLS } from "./AlpacaPersonalMarketDataPlanner";
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

const policy: AlpacaPersonalNormalizationPolicy = {
  policyId: "alpaca-personal-normalization:1",
  version: "1.0",
  closureBufferSeconds: 5,
  quoteMaxAgeSeconds: 30,
  barMaxAgeSeconds: {
    [BarInterval.OneMinute]: 120,
    [BarInterval.FiveMinutes]: 600,
    [BarInterval.FifteenMinutes]: 1_800,
    [BarInterval.OneHour]: 7_200,
    [BarInterval.OneDay]: 129_600,
  },
  roundLotSize: 100,
};

const providerQuote = (timestamp = "2026-07-26T13:59:59.123456789Z") => ({
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

const providerBar = (timestamp: string, close: number) => ({
  c: close,
  h: close + 1,
  l: close - 1,
  n: 20,
  o: close - 0.25,
  t: timestamp,
  v: 1_000,
  vw: close,
});

function quoteContext(timestamp = "2026-07-26T13:59:59.123456789Z"): AlpacaPersonalQuoteNormalizationContext {
  const quotes = Object.fromEntries(ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => [symbol, providerQuote(timestamp)]));
  return {
    response: validateAlpacaPersonalMarketDataResponse(
      JSON.stringify({ quotes }),
      AlpacaPersonalRequestKind.LatestQuotes,
      ALPACA_PERSONAL_EXACT_SYMBOLS,
    ),
    mappings: createAlpacaPersonalInstrumentMappings(),
    receivedAt: "2026-07-26T14:00:00.000Z",
    normalizedAt: "2026-07-26T14:00:00.010Z",
    evaluatedAt: "2026-07-26T14:00:00.020Z",
    requestId: "personal-alpaca:quotes:1",
    policy,
  };
}

function barContext(
  rows: readonly ReturnType<typeof providerBar>[],
  interval = BarInterval.FiveMinutes,
  overrides: Partial<AlpacaPersonalBarNormalizationContext> = {},
): AlpacaPersonalBarNormalizationContext {
  const bars = Object.fromEntries(ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => [symbol, rows]));
  return {
    response: validateAlpacaPersonalMarketDataResponse(
      JSON.stringify({ bars, next_page_token: null }),
      AlpacaPersonalRequestKind.Bars,
      ALPACA_PERSONAL_EXACT_SYMBOLS,
    ),
    mappings: createAlpacaPersonalInstrumentMappings(),
    interval,
    requestStartTime: "2026-07-26T13:00:00.000Z",
    requestEndTime: "2026-07-26T14:00:00.000Z",
    receivedAt: "2026-07-26T14:00:00.000Z",
    normalizedAt: "2026-07-26T14:00:00.010Z",
    evaluatedAt: "2026-07-26T14:00:00.020Z",
    requestId: `personal-alpaca:bars:${interval}`,
    policy,
    dailyBoundaries: [],
    ...overrides,
  };
}

test("mapping catalog binds the exact 12 personal symbols", () => {
  equal(
    JSON.stringify(createAlpacaPersonalInstrumentMappings().map((entry) => entry.symbol)),
    JSON.stringify(ALPACA_PERSONAL_EXACT_SYMBOLS),
    "mapping symbols",
  );
});

test("quotes normalize into Canonical Quotes with IEX provenance", () => {
  const result = normalizeAlpacaPersonalQuotes(quoteContext());
  equal(result.status, "NORMALIZED", "status");
  equal(result.quotes.length, 12, "quote count");
  equal(result.quotes[0]?.source.providerId, "provider:alpaca-basic-iex", "provider");
  assert(result.warnings[0]?.includes("not NBBO"), "NBBO warning");
});

test("round-lot quote sizes convert explicitly to base-unit shares", () => {
  const quote = normalizeAlpacaPersonalQuotes(quoteContext()).quotes.find((entry) => entry.instrument.displaySymbol === "MU");
  assert(quote !== undefined, "MU quote missing");
  equal(quote.value.bidSize?.atomicValue, "300", "bid shares");
  equal(quote.value.askSize?.atomicValue, "400", "ask shares");
  equal(quote.value.quantityUnit, QuoteQuantityUnit.BaseUnits, "quantity unit");
});

test("current and stale quote states derive only from policy age", () => {
  const current = normalizeAlpacaPersonalQuotes(quoteContext()).quotes[0];
  const stale = normalizeAlpacaPersonalQuotes({
    ...quoteContext("2026-07-26T13:59:00.000000000Z"),
    receivedAt: "2026-07-26T14:00:00.000Z",
  }).quotes[0];
  equal(current?.status, CanonicalQuoteStatus.Current, "current");
  equal(stale?.status, CanonicalQuoteStatus.Stale, "stale");
});

test("nanosecond source differences survive Canonical millisecond normalization through integrity", () => {
  const left = normalizeAlpacaPersonalQuotes(quoteContext("2026-07-26T13:59:59.123456789Z")).quotes[0];
  const right = normalizeAlpacaPersonalQuotes(quoteContext("2026-07-26T13:59:59.123999999Z")).quotes[0];
  assert(left !== undefined && right !== undefined, "quotes missing");
  equal(left.observationTime, right.observationTime, "millisecond observation");
  assert(left.source.contentIntegrityReference !== right.source.contentIntegrityReference, "raw timestamp integrity collapsed");
  assert(left.fingerprint !== right.fingerprint, "Canonical fingerprints should differ");
});

test("completed PT5M rows become final Canonical Bars", () => {
  const result = normalizeAlpacaPersonalBars(barContext([
    providerBar("2026-07-26T13:45:00.000000000Z", 100),
    providerBar("2026-07-26T13:50:00.000000000Z", 101),
  ]));
  equal(result.status, "NORMALIZED", "status");
  equal(result.bars.length, 24, "bar count");
  equal(result.bars[0]?.interval, BarInterval.FiveMinutes, "interval");
  equal(result.bars[0]?.intervalEnd, "2026-07-26T13:50:00.000Z", "end");
});

test("IEX Bar volume remains base-unit shares with single-venue coverage", () => {
  const result = normalizeAlpacaPersonalBars(barContext([
    providerBar("2026-07-26T13:45:00.000Z", 100),
    providerBar("2026-07-26T13:50:00.000Z", 101),
  ]));
  const bar = result.bars[0];
  equal(bar?.value.volume.atomicValue, "1000", "volume");
  equal(bar?.quantityUnit, BarQuantityUnit.BaseUnits, "unit");
  equal(bar?.quality.marketCoverage, BarMarketCoverage.SingleVenue, "coverage");
  assert(result.warnings[0]?.includes("not consolidated"), "volume warning");
});

test("not-yet-closed PT5M Bar fails closed", () => {
  const result = normalizeAlpacaPersonalBars(barContext([
    providerBar("2026-07-26T13:50:00.000Z", 100),
    providerBar("2026-07-26T13:55:00.000Z", 101),
  ]));
  equal(result.status, "REJECTED", "status");
  assert(result.blockers.some((entry) => entry.code === AlpacaPersonalIssueCode.InvalidBar), "closure blocker");
});

test("stale Bar is preserved explicitly rather than presented as current", () => {
  const result = normalizeAlpacaPersonalBars(barContext(
    [providerBar("2026-07-26T13:40:00.000Z", 100), providerBar("2026-07-26T13:45:00.000Z", 101)],
    BarInterval.FiveMinutes,
    { evaluatedAt: "2026-07-26T14:20:00.000Z", normalizedAt: "2026-07-26T14:00:00.010Z" },
  ));
  equal(result.status, "NORMALIZED", "status");
  assert(result.bars.every((entry) => entry.quality.freshness === BarFreshnessStatus.Stale), "stale state missing");
});

test("P1D rejects guessed 24-hour closure without reviewed boundaries", () => {
  const result = normalizeAlpacaPersonalBars(barContext(
    [providerBar("2026-07-24T04:00:00.000Z", 100), providerBar("2026-07-25T04:00:00.000Z", 101)],
    BarInterval.OneDay,
    {
      requestStartTime: "2026-07-24T00:00:00.000Z",
      requestEndTime: "2026-07-26T00:00:00.000Z",
      receivedAt: "2026-07-27T14:00:00.000Z",
      normalizedAt: "2026-07-27T14:00:00.010Z",
      evaluatedAt: "2026-07-27T14:00:00.020Z",
    },
  ));
  equal(result.status, "REJECTED", "status");
});

test("P1D accepts exact explicit trading-day boundaries", () => {
  const starts = ["2026-07-24T04:00:00.000Z", "2026-07-25T04:00:00.000Z"];
  const dailyBoundaries = ALPACA_PERSONAL_EXACT_SYMBOLS.flatMap((symbol) => starts.map((intervalStart, index) => ({
    symbol,
    intervalStart,
    intervalEnd: index === 0 ? "2026-07-25T04:00:00.000Z" : "2026-07-26T04:00:00.000Z",
    sessionDate: index === 0 ? "2026-07-24" : "2026-07-25",
  })));
  const result = normalizeAlpacaPersonalBars(barContext(
    [providerBar(starts[0]!, 100), providerBar(starts[1]!, 101)],
    BarInterval.OneDay,
    {
      requestStartTime: "2026-07-24T00:00:00.000Z",
      requestEndTime: "2026-07-26T05:00:00.000Z",
      receivedAt: "2026-07-27T14:00:00.000Z",
      normalizedAt: "2026-07-27T14:00:00.010Z",
      evaluatedAt: "2026-07-27T14:00:00.020Z",
      dailyBoundaries,
    },
  ));
  equal(result.status, "NORMALIZED", "status");
  equal(result.bars.length, 24, "bars");
});

test("mapping substitution fails before Canonical construction", () => {
  const context = quoteContext();
  const result = normalizeAlpacaPersonalQuotes({ ...context, mappings: context.mappings.slice(1) });
  equal(result.status, "REJECTED", "status");
  assert(result.blockers.some((entry) => entry.code === AlpacaPersonalIssueCode.SymbolSetMismatch), "mapping blocker");
});

test("rejected provider response cannot cross the normalization boundary", () => {
  const context = quoteContext();
  const rejectedResponse = validateAlpacaPersonalMarketDataResponse(
    JSON.stringify({ quotes: { MU: providerQuote() } }),
    AlpacaPersonalRequestKind.LatestQuotes,
    ALPACA_PERSONAL_EXACT_SYMBOLS,
  );
  const result = normalizeAlpacaPersonalQuotes({ ...context, response: rejectedResponse });
  equal(result.status, "REJECTED", "status");
});

test("invalid receipt-normalization-evaluation chronology fails closed", () => {
  const context = quoteContext();
  const result = normalizeAlpacaPersonalQuotes({
    ...context,
    normalizedAt: "2026-07-26T13:59:59.000Z",
  });
  equal(result.status, "REJECTED", "status");
});

test("Canonical normalization outputs are deeply immutable and non-executing", () => {
  const result = normalizeAlpacaPersonalQuotes(quoteContext());
  assert(Object.isFrozen(result) && Object.isFrozen(result.quotes) && Object.isFrozen(result.quotes[0]), "result not frozen");
  assert(!("order" in result) && !("execute" in result) && !("positionSize" in result), "execution field leaked");
});

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
console.log(`${passed}/${tests.length} Alpaca personal Canonical normalization tests passed.`);
