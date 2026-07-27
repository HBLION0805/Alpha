import { loadAlpacaCredentials } from "./AlpacaCredentials";
import {
  ALPACA_PERSONAL_MULS_ASSET_ENDPOINT,
  createAlpacaPersonalMulsAssetMetadataRequest,
  type AlpacaPersonalAssetMetadataRequest,
} from "./AlpacaPersonalAssetMetadataDiagnostic";
import {
  AlpacaPersonalAssetMetadataHttpsTransport,
  AlpacaPersonalAssetMetadataTransportError,
  AlpacaPersonalAssetMetadataTransportErrorCode,
  type AlpacaPersonalAssetMetadataExecutorResponse,
  type AlpacaPersonalAssetMetadataRequestExecutor,
} from "./AlpacaPersonalAssetMetadataTransport";

type Test = readonly [string, () => Promise<void>];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
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

class CapturingExecutor implements AlpacaPersonalAssetMetadataRequestExecutor {
  public calls = 0;
  public target?: URL;
  public headers?: Readonly<Record<string, string>>;
  public timeoutMs?: number;
  public maxResponseBytes?: number;
  public response: AlpacaPersonalAssetMetadataExecutorResponse = {
    statusCode: 200,
    body: JSON.stringify({ status: "active" }),
  };
  public failure?: unknown;

  public async execute(
    target: URL,
    headers: Readonly<Record<string, string>>,
    timeoutMs: number,
    maxResponseBytes: number,
  ): Promise<AlpacaPersonalAssetMetadataExecutorResponse> {
    this.calls += 1;
    this.target = target;
    this.headers = headers;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    if (this.failure !== undefined) throw this.failure;
    return this.response;
  }
}

function transport(executor: CapturingExecutor): AlpacaPersonalAssetMetadataHttpsTransport {
  return new AlpacaPersonalAssetMetadataHttpsTransport({
    executor,
    clock: { now: () => "2026-07-26T22:30:00.000Z" },
  });
}

test("exact request executes once against the fixed Paper host", async () => {
  const executor = new CapturingExecutor();
  const result = await transport(executor).execute(createAlpacaPersonalMulsAssetMetadataRequest(), credentials);
  equal(executor.calls, 1, "calls");
  equal(executor.target?.toString(), ALPACA_PERSONAL_MULS_ASSET_ENDPOINT, "target");
  equal(executor.timeoutMs, 10_000, "timeout");
  equal(executor.maxResponseBytes, 65_536, "response size");
  equal(result.receivedAt, "2026-07-26T22:30:00.000Z", "received time");
});

test("credentials exist only in headers and never in the URL", async () => {
  const executor = new CapturingExecutor();
  await transport(executor).execute(createAlpacaPersonalMulsAssetMetadataRequest(), credentials);
  equal(executor.headers?.["APCA-API-KEY-ID"], KEY_ID, "key header");
  equal(executor.headers?.["APCA-API-SECRET-KEY"], SECRET_KEY, "secret header");
  const target = executor.target?.toString() ?? "";
  assert(!target.includes(KEY_ID) && !target.includes(SECRET_KEY), "URL leaked credentials");
});

test("alternate host and live host fail before executor", async () => {
  await expectFailure(
    { ...createAlpacaPersonalMulsAssetMetadataRequest(), endpoint: "https://evil.example/v2/assets/MULS" } as unknown as AlpacaPersonalAssetMetadataRequest,
    AlpacaPersonalAssetMetadataTransportErrorCode.UnapprovedHost,
  );
  await expectFailure(
    { ...createAlpacaPersonalMulsAssetMetadataRequest(), endpoint: "https://api.alpaca.markets/v2/assets/MULS" } as unknown as AlpacaPersonalAssetMetadataRequest,
    AlpacaPersonalAssetMetadataTransportErrorCode.UnapprovedHost,
  );
});

test("orders account and position paths fail before executor", async () => {
  for (const endpoint of [
    "https://paper-api.alpaca.markets/v2/orders",
    "https://paper-api.alpaca.markets/v2/account",
    "https://paper-api.alpaca.markets/v2/positions/MULS",
  ]) {
    await expectFailure(
      { ...createAlpacaPersonalMulsAssetMetadataRequest(), endpoint } as unknown as AlpacaPersonalAssetMetadataRequest,
      AlpacaPersonalAssetMetadataTransportErrorCode.UnapprovedHost,
    );
  }
});

test("symbol query method body and bound substitution fail before executor", async () => {
  const base = createAlpacaPersonalMulsAssetMetadataRequest();
  const mutations: unknown[] = [
    { ...base, endpoint: "https://paper-api.alpaca.markets/v2/assets/MULL" },
    { ...base, endpoint: `${base.endpoint}?symbol=MULS` },
    { ...base, method: "POST" },
    { ...base, bodyAllowed: true },
    { ...base, timeoutMs: 20_000 },
    { ...base, maxResponseBytes: 1_000_000 },
    { ...base, query: [["status", "active"]] },
    { ...base, orderAuthority: true },
  ];
  for (const mutation of mutations) {
    await expectFailure(
      mutation as AlpacaPersonalAssetMetadataRequest,
      mutation instanceof URL
        ? AlpacaPersonalAssetMetadataTransportErrorCode.UnapprovedHost
        : undefined,
    );
  }
});

test("pre-cancelled request executes zero calls", async () => {
  const executor = new CapturingExecutor();
  const controller = new AbortController();
  controller.abort();
  try {
    await transport(executor).execute(createAlpacaPersonalMulsAssetMetadataRequest(), credentials, controller.signal);
    throw new Error("Expected cancellation.");
  } catch (error) {
    assert(error instanceof AlpacaPersonalAssetMetadataTransportError, "typed error");
    equal(error.safeCode, AlpacaPersonalAssetMetadataTransportErrorCode.Cancelled, "code");
  }
  equal(executor.calls, 0, "calls");
});

test("HTTP failure preserves only status and no body", async () => {
  const executor = new CapturingExecutor();
  executor.response = { statusCode: 404, body: `provider body ${SECRET_KEY}` };
  const error = await executeFailure(executor, AlpacaPersonalAssetMetadataTransportErrorCode.HttpFailure);
  equal(error.statusCode, 404, "status");
  assert(!JSON.stringify(error).includes(SECRET_KEY), "body leaked");
});

test("oversized UTF-8 response fails closed", async () => {
  const executor = new CapturingExecutor();
  executor.response = { statusCode: 200, body: "界".repeat(30_000) };
  await executeFailure(executor, AlpacaPersonalAssetMetadataTransportErrorCode.ResponseTooLarge);
});

test("unknown executor failure is sanitized and not retried", async () => {
  const executor = new CapturingExecutor();
  executor.failure = new Error(`network leaked ${SECRET_KEY}`);
  const error = await executeFailure(executor, AlpacaPersonalAssetMetadataTransportErrorCode.NetworkFailure);
  equal(executor.calls, 1, "calls");
  assert(!JSON.stringify(error).includes(SECRET_KEY), "error leaked");
});

test("invalid receipt clock fails after one response", async () => {
  const executor = new CapturingExecutor();
  const subject = new AlpacaPersonalAssetMetadataHttpsTransport({
    executor,
    clock: { now: () => "2026-07-26T22:30:00Z" },
  });
  try {
    await subject.execute(createAlpacaPersonalMulsAssetMetadataRequest(), credentials);
    throw new Error("Expected invalid clock.");
  } catch (error) {
    assert(error instanceof AlpacaPersonalAssetMetadataTransportError, "typed error");
    equal(error.safeCode, AlpacaPersonalAssetMetadataTransportErrorCode.InvalidClock, "code");
  }
  equal(executor.calls, 1, "calls");
});

async function expectFailure(
  request: Readonly<AlpacaPersonalAssetMetadataRequest>,
  expected?: AlpacaPersonalAssetMetadataTransportErrorCode,
): Promise<void> {
  const executor = new CapturingExecutor();
  try {
    await transport(executor).execute(request, credentials);
    throw new Error("Expected request rejection.");
  } catch (error) {
    assert(error instanceof AlpacaPersonalAssetMetadataTransportError, "typed error");
    if (expected !== undefined) equal(error.safeCode, expected, "code");
  }
  equal(executor.calls, 0, "calls");
}

async function executeFailure(
  executor: CapturingExecutor,
  expected: AlpacaPersonalAssetMetadataTransportErrorCode,
): Promise<AlpacaPersonalAssetMetadataTransportError> {
  try {
    await transport(executor).execute(createAlpacaPersonalMulsAssetMetadataRequest(), credentials);
    throw new Error("Expected transport failure.");
  } catch (error) {
    assert(error instanceof AlpacaPersonalAssetMetadataTransportError, "typed error");
    equal(error.safeCode, expected, "code");
    return error;
  }
}

async function runAll(): Promise<void> {
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
  console.log(`Alpaca MULS asset-metadata transport tests: ${passed}/${tests.length} passed.`);
}

void runAll();
