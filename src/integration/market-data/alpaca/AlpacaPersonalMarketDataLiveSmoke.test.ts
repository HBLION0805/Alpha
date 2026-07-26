import { BarInterval } from "../../../contracts/CanonicalBar";
import type {
  AlpacaCredentials,
  AlpacaHttpResponse,
  AlpacaHttpTransport,
  AlpacaPersonalDailyBarBoundary,
  AlpacaPersonalDryRunInput,
  AlpacaPersonalHttpRequest,
  AlpacaPersonalNormalizationPolicy,
  AlpacaTransportExecutionOptions,
} from "./AlpacaPersonalMarketDataContracts";
import {
  ALPACA_PERSONAL_LIVE_READ_CONFIRMATION_FLAG,
  AlpacaLiveReadSmokeError,
  AlpacaLiveReadSmokeErrorCode,
  parseAlpacaLiveReadSmokeArguments,
  runAlpacaPersonalMarketDataLiveSmoke,
} from "./AlpacaPersonalMarketDataLiveSmoke";
import { ALPACA_PERSONAL_EXACT_SYMBOLS } from "./AlpacaPersonalMarketDataPlanner";

type AsyncTest = readonly [string, () => Promise<void>];
const tests: AsyncTest[] = [];
function test(name: string, run: AsyncTest[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}

const SECRET = "test-secret-key-123456789";
const RECEIVED_AT = "2026-07-26T18:00:00.000Z";
const environment = Object.freeze({
  ALPHA_ALPACA_API_KEY_ID: "PKTESTKEY123456",
  ALPHA_ALPACA_API_SECRET_KEY: SECRET,
});

const windows = Object.freeze([
  { interval: BarInterval.OneDay, startTime: "2026-06-01T00:00:00.000Z", endTime: "2026-07-26T00:00:00.000Z", maxRecords: 60 },
  { interval: BarInterval.OneHour, startTime: "2026-07-20T13:30:00.000Z", endTime: "2026-07-26T14:00:00.000Z", maxRecords: 200 },
  { interval: BarInterval.FifteenMinutes, startTime: "2026-07-25T13:30:00.000Z", endTime: "2026-07-26T14:00:00.000Z", maxRecords: 200 },
  { interval: BarInterval.FiveMinutes, startTime: "2026-07-26T13:30:00.000Z", endTime: "2026-07-26T14:00:00.000Z", maxRecords: 100 },
] as const);

function plan(): AlpacaPersonalDryRunInput {
  return {
    planId: "personal-alpaca:live-read-smoke:1",
    symbols: ALPACA_PERSONAL_EXACT_SYMBOLS,
    plannedAt: "2026-07-26T17:59:00.000Z",
    windows,
  };
}

const policy: AlpacaPersonalNormalizationPolicy = Object.freeze({
  policyId: "alpaca-personal:live-read-normalization:1",
  version: "1.0",
  closureBufferSeconds: 0,
  quoteMaxAgeSeconds: 86_400,
  barMaxAgeSeconds: Object.freeze({
    [BarInterval.OneMinute]: 31_536_000,
    [BarInterval.FiveMinutes]: 31_536_000,
    [BarInterval.FifteenMinutes]: 31_536_000,
    [BarInterval.OneHour]: 31_536_000,
    [BarInterval.OneDay]: 31_536_000,
  }),
  roundLotSize: 100,
});

const dailyBoundaries: readonly AlpacaPersonalDailyBarBoundary[] = Object.freeze(
  ALPACA_PERSONAL_EXACT_SYMBOLS.flatMap((symbol) => [
    {
      symbol,
      intervalStart: "2026-06-01T00:00:00.000Z",
      intervalEnd: "2026-06-01T20:00:00.000Z",
      sessionDate: "2026-06-01",
    },
    {
      symbol,
      intervalStart: "2026-06-02T00:00:00.000Z",
      intervalEnd: "2026-06-02T20:00:00.000Z",
      sessionDate: "2026-06-02",
    },
  ]),
);

class FixtureTransport implements AlpacaHttpTransport {
  public calls = 0;
  public validatedCredentials = 0;
  public invalidFirstResponse = false;
  public failure?: unknown;

  public assertReady(_request: Readonly<AlpacaPersonalHttpRequest>): void {}

  public async execute(
    request: Readonly<AlpacaPersonalHttpRequest>,
    credentials: Readonly<AlpacaCredentials>,
    _options?: Readonly<AlpacaTransportExecutionOptions>,
  ): Promise<AlpacaHttpResponse> {
    this.calls += 1;
    const secret = credentials.revealForTransport();
    if (secret.keyId === environment.ALPHA_ALPACA_API_KEY_ID && secret.secretKey === SECRET) {
      this.validatedCredentials += 1;
    }
    if (this.failure !== undefined) throw this.failure;
    return {
      statusCode: 200,
      receivedAt: RECEIVED_AT,
      body: this.invalidFirstResponse && this.calls === 1
        ? JSON.stringify({ bars: {}, next_page_token: null })
        : responseBody(request),
    };
  }
}

const clock = Object.freeze({ now: () => RECEIVED_AT });

test("no confirmation remains a zero-network dry run", async () => {
  const transport = new FixtureTransport();
  const result = await runAlpacaPersonalMarketDataLiveSmoke({
    confirmed: false, plan: plan(), policy, dailyBoundaries, environment, transport, clock,
  });
  equal(result.mode, "DRY_RUN", "mode");
  equal(result.networkRequests, 0, "reported requests");
  equal(transport.calls, 0, "transport calls");
});

test("only the exact single confirmation flag is accepted", async () => {
  equal(parseAlpacaLiveReadSmokeArguments([]).confirmed, false, "default");
  equal(parseAlpacaLiveReadSmokeArguments([ALPACA_PERSONAL_LIVE_READ_CONFIRMATION_FLAG]).confirmed, true, "confirmed");
  expectArgumentFailure(["--confirm-live-smoke"]);
  expectArgumentFailure([ALPACA_PERSONAL_LIVE_READ_CONFIRMATION_FLAG, ALPACA_PERSONAL_LIVE_READ_CONFIRMATION_FLAG]);
});

test("confirmed run executes exactly five requests once each", async () => {
  const transport = new FixtureTransport();
  const result = await runAlpacaPersonalMarketDataLiveSmoke({
    confirmed: true, plan: plan(), policy, dailyBoundaries, environment, transport, clock,
  });
  equal(result.mode, "LIVE_READ_SMOKE", "mode");
  equal(result.networkRequests, 5, "reported requests");
  equal(transport.calls, 5, "transport calls");
  equal(transport.validatedCredentials, 5, "credential bindings");
});

test("all responses cross strict validation and Canonical normalization", async () => {
  const result = await runAlpacaPersonalMarketDataLiveSmoke({
    confirmed: true, plan: plan(), policy, dailyBoundaries, environment,
    transport: new FixtureTransport(), clock,
  });
  equal(result.validatedResponses, 5, "validated responses");
  equal(result.canonicalBarCount, 96, "canonical bars");
  equal(result.canonicalQuoteCount, 12, "canonical quotes");
});

test("missing exact symbol stops after the first response without retry", async () => {
  const transport = new FixtureTransport();
  transport.invalidFirstResponse = true;
  await expectSmokeFailure(
    () => runAlpacaPersonalMarketDataLiveSmoke({
      confirmed: true, plan: plan(), policy, dailyBoundaries, environment, transport, clock,
    }),
    AlpacaLiveReadSmokeErrorCode.ProviderValidationFailed,
    1,
  );
  equal(transport.calls, 1, "transport calls");
});

test("missing reviewed P1D boundaries stops after the first response", async () => {
  const transport = new FixtureTransport();
  await expectSmokeFailure(
    () => runAlpacaPersonalMarketDataLiveSmoke({
      confirmed: true, plan: plan(), policy, dailyBoundaries: [], environment, transport, clock,
    }),
    AlpacaLiveReadSmokeErrorCode.CanonicalNormalizationFailed,
    1,
  );
  equal(transport.calls, 1, "transport calls");
});

test("transport failure is not retried", async () => {
  const transport = new FixtureTransport();
  transport.failure = new Error(`provider leaked ${SECRET}`);
  try {
    await runAlpacaPersonalMarketDataLiveSmoke({
      confirmed: true, plan: plan(), policy, dailyBoundaries, environment, transport, clock,
    });
    throw new Error("Expected transport failure.");
  } catch (error) {
    assert(error instanceof AlpacaLiveReadSmokeError, "typed error");
    equal(error.safeCode, AlpacaLiveReadSmokeErrorCode.TransportFailed, "safe code");
    equal(error.completedNetworkRequests, 0, "completed requests");
    equal(error.attemptedNetworkRequests, 1, "attempted requests");
    assert(!error.message.includes(SECRET), "secret leaked");
  }
  equal(transport.calls, 1, "transport calls");
});

test("summary contains no credential or raw provider payload", async () => {
  const result = await runAlpacaPersonalMarketDataLiveSmoke({
    confirmed: true, plan: plan(), policy, dailyBoundaries, environment,
    transport: new FixtureTransport(), clock,
  });
  const rendered = JSON.stringify(result);
  assert(!rendered.includes(SECRET), "secret leaked");
  assert(!rendered.includes("\"bars\""), "raw bars leaked");
  assert(!rendered.includes("\"quotes\""), "raw quotes leaked");
  equal(result.rawPayloadExposed, false, "raw payload");
});

test("result explicitly carries zero persistence and zero trading authority", async () => {
  const result = await runAlpacaPersonalMarketDataLiveSmoke({
    confirmed: true, plan: plan(), policy, dailyBoundaries, environment,
    transport: new FixtureTransport(), clock,
  });
  equal(result.persistenceWrites, 0, "writes");
  equal(result.recommendationAuthority, false, "recommendation authority");
  equal(result.tradingAuthority, false, "trading authority");
  assert(result.notice.includes("NO TRADING"), "notice");
});

test("summary and nested diagnostics are immutable", async () => {
  const result = await runAlpacaPersonalMarketDataLiveSmoke({
    confirmed: false, plan: plan(), policy, dailyBoundaries, environment,
    transport: new FixtureTransport(), clock,
  });
  assert(Object.isFrozen(result), "summary");
  assert(Object.isFrozen(result.credential), "credential");
  assert(Object.isFrozen(result.warnings), "warnings");
});

function responseBody(request: Readonly<AlpacaPersonalHttpRequest>): string {
  if (request.kind === "LATEST_QUOTES") {
    return JSON.stringify({
      quotes: Object.fromEntries(ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => [symbol, {
        ap: 101.25, as: 4, ax: "V", bp: 101.2, bs: 3, bx: "V",
        c: ["R"], t: "2026-07-26T17:59:59.000Z", z: "C",
      }])),
    });
  }
  const timeframe = new Map(request.query).get("timeframe");
  const timestamps = timeframe === "1Day"
    ? ["2026-06-01T00:00:00.000Z", "2026-06-02T00:00:00.000Z"]
    : timeframe === "1Hour"
      ? ["2026-07-20T13:30:00.000Z", "2026-07-20T14:30:00.000Z"]
      : timeframe === "15Min"
        ? ["2026-07-25T13:30:00.000Z", "2026-07-25T13:45:00.000Z"]
        : ["2026-07-26T13:30:00.000Z", "2026-07-26T13:35:00.000Z"];
  return JSON.stringify({
    bars: Object.fromEntries(ALPACA_PERSONAL_EXACT_SYMBOLS.map((symbol) => [symbol, timestamps.map((timestamp, index) => ({
      c: 100 + index, h: 101 + index, l: 99 + index, n: 20, o: 100,
      t: timestamp, v: 1_000, vw: 100.25 + index,
    }))])),
    next_page_token: null,
  });
}

function expectArgumentFailure(args: readonly string[]): void {
  try {
    parseAlpacaLiveReadSmokeArguments(args);
    throw new Error("Expected argument failure.");
  } catch (error) {
    assert(error instanceof AlpacaLiveReadSmokeError, "typed argument error");
    equal(error.safeCode, AlpacaLiveReadSmokeErrorCode.InvalidApproval, "safe code");
  }
}

async function expectSmokeFailure(
  run: () => Promise<unknown>,
  safeCode: AlpacaLiveReadSmokeErrorCode,
  completedNetworkRequests: number,
): Promise<void> {
  try {
    await run();
    throw new Error("Expected smoke failure.");
  } catch (error) {
    assert(error instanceof AlpacaLiveReadSmokeError, "typed smoke error");
    equal(error.safeCode, safeCode, "safe code");
    equal(error.completedNetworkRequests, completedNetworkRequests, "completed requests");
    assert(!JSON.stringify(error).includes(SECRET), "secret leaked");
  }
}

async function runAll(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      await run();
      passed += 1;
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`Alpaca one-shot live-read smoke tests passed: ${passed}/${tests.length}`);
}

void runAll();
