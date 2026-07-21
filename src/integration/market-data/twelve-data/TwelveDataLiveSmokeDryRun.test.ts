import { TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE, type TwelveDataCredentials, type TwelveDataHttpRequest, type TwelveDataHttpResponse, type TwelveDataHttpTransport } from "./TwelveDataContracts";
import { runInitialTwelveDataLiveSmoke } from "./TwelveDataLiveSmoke";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
async function expectError(run: () => Promise<unknown>, label: string): Promise<void> { try { await run(); } catch { return; } throw new Error(`${label}: expected error.`); }

const SECRET = "fake-dry-run-credential";
const base = {
  confirmed: false,
  startTime: "2026-07-20T14:30:00.000Z",
  endTime: "2026-07-20T14:40:00.000Z",
  environment: { [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: SECRET },
  clock: { now: () => "2026-07-20T14:45:01.000Z" },
} as const;

class CountingTransport implements TwelveDataHttpTransport {
  public calls = 0;
  public async execute(_request: Readonly<TwelveDataHttpRequest>, _credentials: Readonly<TwelveDataCredentials>): Promise<TwelveDataHttpResponse> {
    this.calls += 1;
    throw new Error("Dry run must never call transport.");
  }
}

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  ["dry run validates configuration and reports readiness", async () => { const result = await runInitialTwelveDataLiveSmoke(base); assertEqual(result.mode, "DRY_RUN", "mode"); assertTrue(result.transportReady, "ready"); assertEqual(result.symbol, "AAPL", "symbol"); }],
  ["dry run performs zero HTTP calls", async () => { const transport = new CountingTransport(); const result = await runInitialTwelveDataLiveSmoke({ ...base, transport }); assertEqual(transport.calls, 0, "calls"); assertEqual(result.networkRequests, 0, "reported calls"); }],
  ["dry run output never contains the credential", async () => { const result = await runInitialTwelveDataLiveSmoke(base); assertTrue(!JSON.stringify(result).includes(SECRET), "secret absent"); assertTrue(JSON.stringify(result).includes("[REDACTED]"), "redacted marker"); }],
  ["dry run summary is deterministic for identical input", async () => { const first = await runInitialTwelveDataLiveSmoke(base); const second = await runInitialTwelveDataLiveSmoke(base); assertEqual(JSON.stringify(first), JSON.stringify(second), "summary"); }],
  ["missing credential blocks dry run before transport", async () => { const transport = new CountingTransport(); await expectError(() => runInitialTwelveDataLiveSmoke({ ...base, environment: {}, transport }), "credential"); assertEqual(transport.calls, 0, "calls"); }],
  ["excess live-smoke window fails closed without transport", async () => { const transport = new CountingTransport(); await expectError(() => runInitialTwelveDataLiveSmoke({ ...base, startTime: "2026-07-19T14:30:00.000Z", transport }), "window"); assertEqual(transport.calls, 0, "calls"); }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try { await run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
  }
  console.log(`Twelve Data Live-Smoke Dry-Run tests passed: ${String(passed)}/${String(tests.length)}.`);
}
void main();
