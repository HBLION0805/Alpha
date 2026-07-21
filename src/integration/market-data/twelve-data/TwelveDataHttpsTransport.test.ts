import {
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  TwelveDataTransportKind,
  type TwelveDataHttpRequest,
} from "./TwelveDataContracts";
import {
  TwelveDataHttpsTransport,
  TwelveDataTransportError,
  TwelveDataTransportErrorCode,
  type TwelveDataHttpsRequestExecutor,
  type TwelveDataHttpsExecutorResponse,
} from "./TwelveDataHttpsTransport";
import { loadTwelveDataCredentials } from "./TwelveDataProvider";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
async function expectCode(run: () => Promise<unknown>, code: TwelveDataTransportErrorCode, label: string): Promise<void> { try { await run(); } catch (error: unknown) { if (error instanceof TwelveDataTransportError) { assertEqual(error.safeCode, code, label); return; } throw error; } throw new Error(`${label}: expected error.`); }

const SECRET = "fake-transport-credential";
const credentials = loadTwelveDataCredentials({ [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: SECRET });
const request: TwelveDataHttpRequest = {
  method: "GET",
  endpoint: "https://api.twelvedata.com/time_series",
  query: [["interval", "5min"], ["symbol", "AAPL"]],
  timeoutMs: 10_000,
};

class FakeExecutor implements TwelveDataHttpsRequestExecutor {
  public calls = 0;
  public target?: URL;
  public response: TwelveDataHttpsExecutorResponse = { statusCode: 200, body: JSON.stringify({ status: "ok", values: [] }) };
  public failure?: TwelveDataTransportError | Error;
  public async execute(target: URL): Promise<TwelveDataHttpsExecutorResponse> {
    this.calls += 1;
    this.target = target;
    if (this.failure !== undefined) throw this.failure;
    return this.response;
  }
}

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  ["success returns a live response through one HTTPS executor call", async () => { const executor = new FakeExecutor(); const transport = new TwelveDataHttpsTransport({ executor, clock: { now: () => "2026-07-21T15:00:00.000Z" } }); const response = await transport.execute(request, credentials); assertEqual(executor.calls, 1, "calls"); assertEqual(response.transportKind, TwelveDataTransportKind.Live, "kind"); assertEqual(response.statusCode, 200, "status"); }],
  ["credential is isolated from the public request", async () => { const executor = new FakeExecutor(); await new TwelveDataHttpsTransport({ executor }).execute(request, credentials); assertTrue(!JSON.stringify(request).includes(SECRET), "public request redacted"); assertEqual(executor.target?.searchParams.get("apikey"), SECRET, "boundary injection"); }],
  ["HTTP failure is translated without body leakage", async () => { const executor = new FakeExecutor(); executor.response = { statusCode: 500, body: `unsafe:${SECRET}` }; await expectCode(() => new TwelveDataHttpsTransport({ executor }).execute(request, credentials), TwelveDataTransportErrorCode.HttpFailure, "http"); }],
  ["timeout is translated explicitly", async () => { const executor = new FakeExecutor(); executor.failure = new TwelveDataTransportError(TwelveDataTransportErrorCode.Timeout); await expectCode(() => new TwelveDataHttpsTransport({ executor }).execute(request, credentials), TwelveDataTransportErrorCode.Timeout, "timeout"); }],
  ["pre-cancelled request makes zero HTTP calls", async () => { const executor = new FakeExecutor(); const controller = new AbortController(); controller.abort(); await expectCode(() => new TwelveDataHttpsTransport({ executor }).execute(request, credentials, { signal: controller.signal }), TwelveDataTransportErrorCode.Cancelled, "cancelled"); assertEqual(executor.calls, 0, "calls"); }],
  ["malformed JSON is translated explicitly", async () => { const executor = new FakeExecutor(); executor.response = { statusCode: 200, body: "not-json" }; await expectCode(() => new TwelveDataHttpsTransport({ executor }).execute(request, credentials), TwelveDataTransportErrorCode.MalformedResponse, "json"); }],
  ["provider-declared error is translated without provider narrative", async () => { const executor = new FakeExecutor(); executor.response = { statusCode: 200, body: JSON.stringify({ status: "error", message: `unsafe:${SECRET}` }) }; await expectCode(() => new TwelveDataHttpsTransport({ executor }).execute(request, credentials), TwelveDataTransportErrorCode.ProviderError, "provider"); }],
  ["unapproved host fails before executor invocation", async () => { const executor = new FakeExecutor(); const invalid = { ...request, endpoint: "https://example.com/time_series" } as unknown as TwelveDataHttpRequest; await expectCode(() => new TwelveDataHttpsTransport({ executor }).execute(invalid, credentials), TwelveDataTransportErrorCode.UnapprovedHost, "host"); assertEqual(executor.calls, 0, "calls"); }],
  ["credential in public query is rejected", async () => { const executor = new FakeExecutor(); const invalid = { ...request, query: [...request.query, ["apikey", SECRET] as const] }; await expectCode(() => new TwelveDataHttpsTransport({ executor }).execute(invalid, credentials), TwelveDataTransportErrorCode.InvalidRequest, "public secret"); assertEqual(executor.calls, 0, "calls"); }],
  ["typed error serialization is safe", () => { const error = new TwelveDataTransportError(TwelveDataTransportErrorCode.NetworkFailure); const serialized = JSON.stringify(error); assertTrue(!serialized.includes(SECRET), "secret absent"); assertTrue(!serialized.includes("https://"), "URL absent"); }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try { await run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
  }
  console.log(`Twelve Data HTTPS Transport tests passed: ${String(passed)}/${String(tests.length)}.`);
}
void main();
