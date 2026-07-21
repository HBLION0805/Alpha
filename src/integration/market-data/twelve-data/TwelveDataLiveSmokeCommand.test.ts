import {
  TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE,
  TwelveDataTransportKind,
  type TwelveDataCredentials,
  type TwelveDataHttpRequest,
  type TwelveDataHttpResponse,
  type TwelveDataHttpTransport,
} from "./TwelveDataContracts";
import { fixtureBody } from "./TwelveDataTestFixtures";
import { parseTwelveDataLiveSmokeArguments, runInitialTwelveDataLiveSmoke } from "./TwelveDataLiveSmoke";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function expectParseError(args: readonly string[], label: string): void { try { parseTwelveDataLiveSmokeArguments(args); } catch { return; } throw new Error(`${label}: expected error.`); }

const SECRET = "fake-manual-smoke-credential";
const args = ["--start=2026-07-20T14:30:00.000Z", "--end=2026-07-20T14:40:00.000Z"];
const base = {
  startTime: "2026-07-20T14:30:00.000Z",
  endTime: "2026-07-20T14:40:00.000Z",
  environment: { [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: SECRET },
  clock: { now: () => "2026-07-20T14:45:01.000Z" },
} as const;

class LiveFixtureTransport implements TwelveDataHttpTransport {
  public calls = 0;
  public async execute(_request: Readonly<TwelveDataHttpRequest>, _credentials: Readonly<TwelveDataCredentials>): Promise<TwelveDataHttpResponse> {
    this.calls += 1;
    return { statusCode: 200, receivedAt: "2026-07-20T14:45:00.000Z", transportKind: TwelveDataTransportKind.Live, body: fixtureBody() };
  }
}

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  ["missing confirmation parses as dry run", () => assertEqual(parseTwelveDataLiveSmokeArguments(args).confirmed, false, "confirmation")],
  ["manual confirmation flag is explicit", () => assertEqual(parseTwelveDataLiveSmokeArguments([...args, "--confirm-live-smoke"]).confirmed, true, "confirmation")],
  ["missing window or unknown flags are refused", () => { expectParseError(["--confirm-live-smoke"], "window"); expectParseError([...args, "--poll"], "unknown"); }],
  ["fake-authorized manual run invokes transport exactly once", async () => { const transport = new LiveFixtureTransport(); const result = await runInitialTwelveDataLiveSmoke({ ...base, confirmed: true, transport }); assertEqual(transport.calls, 1, "calls"); assertEqual(result.networkRequests, 1, "reported calls"); assertEqual(result.mode, "LIVE_SMOKE", "mode"); }],
  ["unverified live volume blocks canonical acceptance", async () => { const transport = new LiveFixtureTransport(); const result = await runInitialTwelveDataLiveSmoke({ ...base, confirmed: true, transport }); assertEqual(result.canonicalAcceptance, "BLOCKED_UNVERIFIED_VOLUME", "acceptance"); assertEqual(result.acceptedBars, 0, "bars"); assertTrue(result.blockers.includes("AMBIGUOUS_UNITS"), "volume blocker"); }],
  ["manual output is sanitized and contains no raw provider payload", async () => { const transport = new LiveFixtureTransport(); const result = await runInitialTwelveDataLiveSmoke({ ...base, confirmed: true, transport }); const output = JSON.stringify(result); assertTrue(!output.includes(SECRET), "secret absent"); assertTrue(!output.includes("mic_code"), "provider payload absent"); assertTrue(!output.includes("224.1000"), "raw value absent"); }],
  ["manual output carries the no-authorization warning", async () => { const result = await runInitialTwelveDataLiveSmoke({ ...base, confirmed: false }); assertTrue(result.notice.includes("NO TRADING OR DECISION AUTHORIZATION"), "notice"); }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try { await run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
  }
  console.log(`Twelve Data Manual Live-Smoke Command tests passed: ${String(passed)}/${String(tests.length)}.`);
}
void main();
