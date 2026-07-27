import { loadTwelveDataCredentials } from "./TwelveDataProvider";
import {
  createTwelveDataPersonalMulsReferenceRequest,
  type TwelveDataPersonalMulsReferenceRequest,
} from "./TwelveDataPersonalMulsReferenceDiagnostic";
import {
  TwelveDataPersonalMulsReferenceHttpsTransport,
  TwelveDataPersonalMulsReferenceTransportError,
  TwelveDataPersonalMulsReferenceTransportErrorCode,
  type TwelveDataPersonalMulsReferenceExecutorResponse,
  type TwelveDataPersonalMulsReferenceRequestExecutor,
} from "./TwelveDataPersonalMulsReferenceHttpsTransport";

type Test = readonly [string, () => Promise<void>];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

const API_KEY = "test-twelve-data-live-reference-key";
const credentials = loadTwelveDataCredentials({
  ALPHA_TWELVE_DATA_API_KEY: API_KEY,
});

class CapturingExecutor
implements TwelveDataPersonalMulsReferenceRequestExecutor {
  public calls = 0;
  public target?: URL;
  public headers?: Readonly<Record<string, string>>;
  public timeoutMs?: number;
  public maxResponseBytes?: number;
  public response: TwelveDataPersonalMulsReferenceExecutorResponse = {
    statusCode: 200,
    body: JSON.stringify({ status: "ok", result: { count: 0, list: [] } }),
  };
  public failure?: unknown;

  public async execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
  ): Promise<TwelveDataPersonalMulsReferenceExecutorResponse> {
    this.calls += 1;
    this.target = target;
    this.headers = headers;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    if (this.failure !== undefined) throw this.failure;
    return this.response;
  }
}

function subject(
  executor: CapturingExecutor,
  clock = "2026-07-27T14:00:00.000Z",
): TwelveDataPersonalMulsReferenceHttpsTransport {
  return new TwelveDataPersonalMulsReferenceHttpsTransport({
    executor,
    clock: { now: () => clock },
  });
}

test("exact frozen request executes once against the sole endpoint", async () => {
  const executor = new CapturingExecutor();
  const response = await subject(executor).execute(
    createTwelveDataPersonalMulsReferenceRequest(),
    credentials,
  );
  equal(executor.calls, 1, "calls");
  equal(
    executor.target?.toString(),
    "https://api.twelvedata.com/etfs/list?country=US&format=JSON&outputsize=1&page=1&symbol=MULS",
    "target",
  );
  equal(executor.timeoutMs, 10_000, "timeout");
  equal(executor.maxResponseBytes, 1_000_000, "response bound");
  equal(response.receivedAt, "2026-07-27T14:00:00.000Z", "receipt");
});

test("credential exists only in the authorization header", async () => {
  const executor = new CapturingExecutor();
  await subject(executor).execute(
    createTwelveDataPersonalMulsReferenceRequest(),
    credentials,
  );
  equal(executor.headers?.Authorization, `apikey ${API_KEY}`, "authorization");
  equal(executor.headers?.accept, "application/json", "accept");
  assert(!String(executor.target).includes(API_KEY), "credential leaked to URL");
});

test("alternate host path port and URL credential fail before dispatch", async () => {
  const base = createTwelveDataPersonalMulsReferenceRequest();
  for (const endpoint of [
    "https://example.com/etfs/list",
    "https://api.twelvedata.com/etf",
    "https://api.twelvedata.com:443/etfs/list",
    "https://user:pass@api.twelvedata.com/etfs/list",
    "https://api.twelvedata.com/etfs/list?apikey=secret",
  ]) {
    await expectRejected(
      { ...base, endpoint } as unknown as TwelveDataPersonalMulsReferenceRequest,
      TwelveDataPersonalMulsReferenceTransportErrorCode.UnapprovedEndpoint,
    );
  }
});

test("method query policy and budget substitution fail before dispatch", async () => {
  const base = createTwelveDataPersonalMulsReferenceRequest();
  for (const mutation of [
    { ...base, method: "POST" },
    { ...base, query: [...base.query].reverse() },
    { ...base, query: [...base.query, ["apikey", API_KEY]] },
    { ...base, maxRequests: 2 },
    { ...base, maxCredits: 2 },
    { ...base, timeoutMs: 10_001 },
    { ...base, retriesAllowed: true },
    { ...base, orderAuthority: true },
  ]) {
    await expectRejected(
      mutation as unknown as TwelveDataPersonalMulsReferenceRequest,
      TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidRequest,
    );
  }
});

test("pre-cancelled request executes zero calls", async () => {
  const executor = new CapturingExecutor();
  const controller = new AbortController();
  controller.abort();
  const error = await executeFailure(
    executor,
    TwelveDataPersonalMulsReferenceTransportErrorCode.Cancelled,
    controller.signal,
  );
  equal(error.safeCode,
    TwelveDataPersonalMulsReferenceTransportErrorCode.Cancelled, "code");
  equal(executor.calls, 0, "calls");
});

test("HTTP failure exposes status but never body or credential", async () => {
  const executor = new CapturingExecutor();
  executor.response = { statusCode: 429, body: `unsafe ${API_KEY}` };
  const error = await executeFailure(
    executor,
    TwelveDataPersonalMulsReferenceTransportErrorCode.HttpFailure,
  );
  equal(error.statusCode, 429, "status");
  assert(!JSON.stringify(error).includes(API_KEY), "secret leaked");
});

test("oversized UTF-8 response is terminal", async () => {
  const executor = new CapturingExecutor();
  executor.response = { statusCode: 200, body: "界".repeat(400_000) };
  await executeFailure(
    executor,
    TwelveDataPersonalMulsReferenceTransportErrorCode.ResponseTooLarge,
  );
  equal(executor.calls, 1, "calls");
});

test("unknown executor failure is sanitized and not retried", async () => {
  const executor = new CapturingExecutor();
  executor.failure = new Error(`unsafe ${API_KEY}`);
  const error = await executeFailure(
    executor,
    TwelveDataPersonalMulsReferenceTransportErrorCode.NetworkFailure,
  );
  equal(executor.calls, 1, "calls");
  assert(!JSON.stringify(error).includes(API_KEY), "failure leaked");
});

test("transport timeout and cancellation remain distinct", async () => {
  for (const code of [
    TwelveDataPersonalMulsReferenceTransportErrorCode.Timeout,
    TwelveDataPersonalMulsReferenceTransportErrorCode.Cancelled,
  ]) {
    const executor = new CapturingExecutor();
    executor.failure =
      new TwelveDataPersonalMulsReferenceTransportError(code);
    await executeFailure(executor, code);
    equal(executor.calls, 1, "calls");
  }
});

test("invalid receipt clock fails after exactly one response", async () => {
  const executor = new CapturingExecutor();
  await executeFailure(
    executor,
    TwelveDataPersonalMulsReferenceTransportErrorCode.InvalidClock,
    undefined,
    "2026-07-27T14:00:00Z",
  );
  equal(executor.calls, 1, "calls");
});

async function expectRejected(
  request: Readonly<TwelveDataPersonalMulsReferenceRequest>,
  expected: TwelveDataPersonalMulsReferenceTransportErrorCode,
): Promise<void> {
  const executor = new CapturingExecutor();
  try {
    await subject(executor).execute(request, credentials);
    throw new Error("Expected request rejection.");
  } catch (error) {
    assert(error instanceof TwelveDataPersonalMulsReferenceTransportError,
      "typed error");
    equal(error.safeCode, expected, "safe code");
  }
  equal(executor.calls, 0, "calls");
}

async function executeFailure(
  executor: CapturingExecutor,
  expected: TwelveDataPersonalMulsReferenceTransportErrorCode,
  signal?: AbortSignal,
  clock?: string,
): Promise<TwelveDataPersonalMulsReferenceTransportError> {
  try {
    await subject(executor, clock).execute(
      createTwelveDataPersonalMulsReferenceRequest(),
      credentials,
      signal,
    );
    throw new Error("Expected transport failure.");
  } catch (error) {
    assert(error instanceof TwelveDataPersonalMulsReferenceTransportError,
      "typed error");
    equal(error.safeCode, expected, "safe code");
    return error;
  }
}

async function runTests(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      await run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(
    `Twelve Data MULS reference HTTPS transport tests: ${passed}/${tests.length} passed.`,
  );
}

void runTests();
