import {
  KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS,
  KalshiPublicHttpsTransport,
  KalshiPublicTransportError,
  KalshiPublicTransportErrorCode,
  type KalshiPublicHttpRequest,
  type KalshiPublicHttpsRequestExecutor,
} from "./KalshiPublicHttpsTransport";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
async function errorCode(run: () => Promise<unknown>, expected: KalshiPublicTransportErrorCode): Promise<void> {
  try { await run(); } catch (error: unknown) {
    assertTrue(error instanceof KalshiPublicTransportError, "typed error");
    assertEqual((error as KalshiPublicTransportError).safeCode, expected, "error code");
    return;
  }
  throw new Error(`Expected ${expected}.`);
}

const request: KalshiPublicHttpRequest = {
  endpoint: KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.endpoint,
  method: "GET",
  timeoutMs: KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.timeoutMs,
};

class Executor implements KalshiPublicHttpsRequestExecutor {
  public calls = 0;
  public target = "";
  public response = { statusCode: 200, body: "{\"market\":{}}" };
  public failure: Error | undefined;
  public async execute(target: URL): Promise<{ readonly statusCode: number; readonly body: string }> {
    this.calls += 1;
    this.target = target.toString();
    if (this.failure !== undefined) throw this.failure;
    return this.response;
  }
}

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  ["readiness accepts only the reviewed endpoint", () => new KalshiPublicHttpsTransport({ executor: new Executor() }).assertReady(request)],
  ["one execution makes one request", async () => { const executor = new Executor(); await new KalshiPublicHttpsTransport({ executor, clock: { now: () => "2026-07-25T02:00:00.000Z" } }).execute(request); assertEqual(executor.calls, 1, "calls"); }],
  ["request target has no query or credential", async () => { const executor = new Executor(); await new KalshiPublicHttpsTransport({ executor, clock: { now: () => "2026-07-25T02:00:00.000Z" } }).execute(request); assertEqual(executor.target, request.endpoint, "target"); assertTrue(!executor.target.includes("?"), "query absent"); }],
  ["alternate host fails before executor", async () => { const executor = new Executor(); await errorCode(() => new KalshiPublicHttpsTransport({ executor }).execute({ ...request, endpoint: "https://example.com/" }), KalshiPublicTransportErrorCode.UnapprovedHost); assertEqual(executor.calls, 0, "calls"); }],
  ["query string fails before executor", async () => { const executor = new Executor(); await errorCode(() => new KalshiPublicHttpsTransport({ executor }).execute({ ...request, endpoint: `${request.endpoint}?limit=1` }), KalshiPublicTransportErrorCode.UnapprovedHost); assertEqual(executor.calls, 0, "calls"); }],
  ["invalid timeout fails closed", async () => errorCode(() => new KalshiPublicHttpsTransport({ executor: new Executor() }).execute({ ...request, timeoutMs: 20_000 }), KalshiPublicTransportErrorCode.InvalidRequest)],
  ["HTTP failures expose status but no body", async () => { const executor = new Executor(); executor.response = { statusCode: 503, body: "secret provider narrative" }; try { await new KalshiPublicHttpsTransport({ executor }).execute(request); } catch (error: unknown) { const serialized = JSON.stringify(error); assertTrue(!serialized.includes("narrative"), "body absent"); assertTrue(serialized.includes("503"), "status retained"); return; } throw new Error("Expected HTTP error."); }],
  ["oversized response fails closed", async () => { const executor = new Executor(); executor.response = { statusCode: 200, body: "x".repeat(KALSHI_PUBLIC_LIVE_READ_HTTP_DEFAULTS.maxResponseBytes + 1) }; await errorCode(() => new KalshiPublicHttpsTransport({ executor }).execute(request), KalshiPublicTransportErrorCode.ResponseTooLarge); }],
  ["executor failure becomes sanitized network failure", async () => { const executor = new Executor(); executor.failure = new Error("private network narrative"); await errorCode(() => new KalshiPublicHttpsTransport({ executor }).execute(request), KalshiPublicTransportErrorCode.NetworkFailure); }],
  ["pre-aborted request never invokes executor", async () => { const executor = new Executor(); const controller = new AbortController(); controller.abort(); await errorCode(() => new KalshiPublicHttpsTransport({ executor }).execute(request, { signal: controller.signal }), KalshiPublicTransportErrorCode.Cancelled); assertEqual(executor.calls, 0, "calls"); }],
  ["noncanonical receipt time fails safely", async () => errorCode(() => new KalshiPublicHttpsTransport({ executor: new Executor(), clock: { now: () => "not-a-time" } }).execute(request), KalshiPublicTransportErrorCode.NetworkFailure)],
  ["successful response is deeply immutable", async () => { const result = await new KalshiPublicHttpsTransport({ executor: new Executor(), clock: { now: () => "2026-07-25T02:00:00.000Z" } }).execute(request); assertTrue(Object.isFrozen(result), "frozen"); }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try { await run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
  }
  console.log(`Kalshi Public HTTPS Transport tests passed: ${String(passed)}/${String(tests.length)}.`);
}
void main();
