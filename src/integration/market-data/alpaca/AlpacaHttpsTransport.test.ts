import { BarInterval } from "../../../contracts/CanonicalBar";
import { loadAlpacaCredentials } from "./AlpacaCredentials";
import {
  AlpacaTransportError,
  AlpacaTransportErrorCode,
  AlpacaHttpsTransport,
  type AlpacaHttpsExecutorResponse,
  type AlpacaHttpsRequestExecutor,
} from "./AlpacaHttpsTransport";
import {
  AlpacaPersonalRequestKind,
  type AlpacaPersonalDryRunInput,
  type AlpacaPersonalHttpRequest,
} from "./AlpacaPersonalMarketDataContracts";
import {
  ALPACA_PERSONAL_EXACT_SYMBOLS,
  planAlpacaPersonalMarketDataDryRun,
} from "./AlpacaPersonalMarketDataPlanner";

type AsyncTest = readonly [string, () => Promise<void>];
const tests: AsyncTest[] = [];
function test(name: string, run: AsyncTest[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}

const KEY_ID = "PKTESTKEY123456";
const SECRET_KEY = "test-secret-key-123456789";
const credentials = loadAlpacaCredentials({
  ALPHA_ALPACA_API_KEY_ID: KEY_ID,
  ALPHA_ALPACA_API_SECRET_KEY: SECRET_KEY,
});

class CapturingExecutor implements AlpacaHttpsRequestExecutor {
  public calls = 0;
  public target?: URL;
  public headers?: Readonly<Record<string, string>>;
  public response: AlpacaHttpsExecutorResponse = { statusCode: 200, body: JSON.stringify({ bars: {} }) };
  public failure?: unknown;

  public async execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
  ): Promise<AlpacaHttpsExecutorResponse> {
    this.calls += 1;
    this.target = target;
    this.headers = headers;
    if (this.failure !== undefined) throw this.failure;
    return this.response;
  }
}

function input(): AlpacaPersonalDryRunInput {
  return {
    planId: "personal-alpaca:transport-test:1",
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

function firstRequest(): AlpacaPersonalHttpRequest {
  return planAlpacaPersonalMarketDataDryRun(input()).requests[0]!;
}

function transport(executor: CapturingExecutor): AlpacaHttpsTransport {
  return new AlpacaHttpsTransport({
    executor,
    clock: { now: () => "2026-07-26T14:00:01.000Z" },
  });
}

test("valid exact request executes once and returns a bounded response", async () => {
  const executor = new CapturingExecutor();
  const result = await transport(executor).execute(firstRequest(), credentials);
  equal(executor.calls, 1, "executor calls");
  equal(result.statusCode, 200, "status");
  equal(result.receivedAt, "2026-07-26T14:00:01.000Z", "received time");
});

test("credentials appear only in headers and never in the URL", async () => {
  const executor = new CapturingExecutor();
  await transport(executor).execute(firstRequest(), credentials);
  assert(executor.headers?.["APCA-API-KEY-ID"] === KEY_ID, "key header");
  assert(executor.headers?.["APCA-API-SECRET-KEY"] === SECRET_KEY, "secret header");
  const target = executor.target?.toString() ?? "";
  assert(!target.includes(KEY_ID) && !target.includes(SECRET_KEY), "URL leaked credentials");
});

test("unapproved host fails before executor invocation", async () => {
  const executor = new CapturingExecutor();
  const request = { ...firstRequest(), endpoint: "https://evil.example/v2/stocks/bars" } as unknown as AlpacaPersonalHttpRequest;
  await expectTransportError(transport(executor), executor, request, AlpacaTransportErrorCode.UnapprovedHost, 0);
});

test("trading endpoint fails before executor invocation", async () => {
  const executor = new CapturingExecutor();
  const request = { ...firstRequest(), endpoint: "https://data.alpaca.markets/v2/orders" } as unknown as AlpacaPersonalHttpRequest;
  await expectTransportError(transport(executor), executor, request, AlpacaTransportErrorCode.UnapprovedHost, 0);
});

test("SIP substitution fails before executor invocation", async () => {
  const executor = new CapturingExecutor();
  const original = firstRequest();
  const request = { ...original, query: original.query.map(([key, value]) => [key, key === "feed" ? "sip" : value] as const) };
  await expectTransportError(transport(executor), executor, request, AlpacaTransportErrorCode.InvalidRequest, 0);
});

test("undeclared or duplicate query keys fail before executor invocation", async () => {
  const executor = new CapturingExecutor();
  const original = firstRequest();
  const request = { ...original, query: [...original.query, ["secret", SECRET_KEY] as const] };
  await expectTransportError(transport(executor), executor, request, AlpacaTransportErrorCode.InvalidRequest, 0);
  const duplicateExecutor = new CapturingExecutor();
  const duplicate = { ...original, query: [...original.query, ["feed", "iex"] as const] };
  await expectTransportError(transport(duplicateExecutor), duplicateExecutor, duplicate, AlpacaTransportErrorCode.InvalidRequest, 0);
});

test("pre-cancelled request performs zero executor calls", async () => {
  const executor = new CapturingExecutor();
  const controller = new AbortController();
  controller.abort();
  try {
    await transport(executor).execute(firstRequest(), credentials, { signal: controller.signal });
    throw new Error("Expected cancellation.");
  } catch (error) {
    assert(error instanceof AlpacaTransportError, "typed cancellation");
    equal(error.safeCode, AlpacaTransportErrorCode.Cancelled, "code");
    equal(executor.calls, 0, "executor calls");
  }
});

test("typed timeout is preserved and is not retried", async () => {
  const executor = new CapturingExecutor();
  executor.failure = new AlpacaTransportError(AlpacaTransportErrorCode.Timeout);
  await expectTransportError(transport(executor), executor, firstRequest(), AlpacaTransportErrorCode.Timeout, 1);
});

test("unknown executor failure becomes a sanitized network failure", async () => {
  const executor = new CapturingExecutor();
  executor.failure = new Error(`upstream leaked ${SECRET_KEY}`);
  await expectTransportError(transport(executor), executor, firstRequest(), AlpacaTransportErrorCode.NetworkFailure, 1, SECRET_KEY);
});

test("HTTP failure does not expose provider body or credentials", async () => {
  const executor = new CapturingExecutor();
  executor.response = { statusCode: 401, body: `unauthorized ${SECRET_KEY}` };
  await expectTransportError(transport(executor), executor, firstRequest(), AlpacaTransportErrorCode.HttpFailure, 1, SECRET_KEY);
});

test("oversized UTF-8 response fails closed", async () => {
  const executor = new CapturingExecutor();
  executor.response = { statusCode: 200, body: "€".repeat(400_000) };
  await expectTransportError(transport(executor), executor, firstRequest(), AlpacaTransportErrorCode.ResponseTooLarge, 1);
});

test("malformed JSON and provider error envelopes fail closed", async () => {
  const malformed = new CapturingExecutor();
  malformed.response = { statusCode: 200, body: "not-json" };
  await expectTransportError(transport(malformed), malformed, firstRequest(), AlpacaTransportErrorCode.MalformedResponse, 1);
  const provider = new CapturingExecutor();
  provider.response = { statusCode: 200, body: JSON.stringify({ code: 42910000, message: "rate limit" }) };
  await expectTransportError(transport(provider), provider, firstRequest(), AlpacaTransportErrorCode.ProviderError, 1);
});

test("quote request is accepted only with its exact query shape", async () => {
  const executor = new CapturingExecutor();
  executor.response = { statusCode: 200, body: JSON.stringify({ quotes: {} }) };
  const quoteRequest = planAlpacaPersonalMarketDataDryRun(input()).requests
    .find((entry) => entry.kind === AlpacaPersonalRequestKind.LatestQuotes)!;
  await transport(executor).execute(quoteRequest, credentials);
  equal(executor.calls, 1, "executor calls");
});

async function expectTransportError(
  subject: AlpacaHttpsTransport,
  executor: CapturingExecutor,
  request: Readonly<AlpacaPersonalHttpRequest>,
  expected: AlpacaTransportErrorCode,
  expectedCalls: number,
  forbidden?: string,
): Promise<void> {
  try {
    await subject.execute(request, credentials);
    throw new Error("Expected transport failure.");
  } catch (error) {
    assert(error instanceof AlpacaTransportError, "typed transport error");
    equal(error.safeCode, expected, "safe code");
    const rendered = `${error.message}|${JSON.stringify(error)}`;
    if (forbidden !== undefined) assert(!rendered.includes(forbidden), "transport error leaked sensitive content");
  }
  equal(executor.calls, expectedCalls, "executor calls");
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
  console.log(`Alpaca HTTPS transport tests passed: ${passed}/${tests.length}`);
}

void runAll();
