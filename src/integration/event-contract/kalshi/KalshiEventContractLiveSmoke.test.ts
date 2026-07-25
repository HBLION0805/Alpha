import { EventContractSourceAuthorizationStatus, EventContractSourceExecutionMode } from "../../../contracts";
import { kalshiBtcFifteenMinuteMarketBody } from "./KalshiEventContractTestFixtures";
import {
  parseKalshiLiveReadSmokeArguments,
  runInitialKalshiLiveReadSmoke,
} from "./KalshiEventContractLiveSmoke";
import type {
  KalshiPublicHttpRequest,
  KalshiPublicHttpResponse,
  KalshiPublicHttpTransport,
} from "./KalshiPublicHttpsTransport";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
async function expectError(run: () => Promise<unknown>, label: string): Promise<void> { try { await run(); } catch { return; } throw new Error(`${label}: expected error.`); }
function expectParseError(args: readonly string[]): void { try { parseKalshiLiveReadSmokeArguments(args); } catch { return; } throw new Error("Expected parse error."); }

const clock = { now: () => "2026-07-25T02:00:00.000Z" };

class CountingTransport implements KalshiPublicHttpTransport {
  public calls = 0;
  public body = kalshiBtcFifteenMinuteMarketBody();
  public assertReady(_request: Readonly<KalshiPublicHttpRequest>): void {}
  public async execute(_request: Readonly<KalshiPublicHttpRequest>): Promise<KalshiPublicHttpResponse> {
    this.calls += 1;
    return {
      statusCode: 200,
      receivedAt: "2026-07-25T01:59:59.000Z",
      body: this.body,
    };
  }
}

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  ["no arguments means dry run", () => assertEqual(parseKalshiLiveReadSmokeArguments([]).confirmed, false, "confirmed")],
  ["confirmation must be explicit", () => assertEqual(parseKalshiLiveReadSmokeArguments(["--confirm-live-read"]).confirmed, true, "confirmed")],
  ["unknown and duplicate flags fail closed", () => { expectParseError(["--poll"]); expectParseError(["--confirm-live-read", "--confirm-live-read"]); }],
  ["dry run performs zero transport calls", async () => { const transport = new CountingTransport(); const result = await runInitialKalshiLiveReadSmoke({ confirmed: false, transport, clock }); assertEqual(transport.calls, 0, "calls"); assertEqual(result.networkRequests, 0, "reported calls"); }],
  ["dry run reports fixed budgets and no credential", async () => { const result = await runInitialKalshiLiveReadSmoke({ confirmed: false, clock }); assertEqual(result.requestBudget, 1, "request budget"); assertEqual(result.recordBudget, 1, "record budget"); assertEqual(result.credentialMode, "NONE", "credential"); }],
  ["dry run exposes no payload or persistence path", async () => { const result = await runInitialKalshiLiveReadSmoke({ confirmed: false, clock }); assertEqual(result.rawPayloadExposed, false, "payload"); assertEqual(result.persistenceWrites, 0, "writes"); assertEqual(result.sourceSnapshot, null, "snapshot"); }],
  ["injected confirmed run calls transport exactly once", async () => { const transport = new CountingTransport(); const result = await runInitialKalshiLiveReadSmoke({ confirmed: true, transport, clock }); assertEqual(transport.calls, 1, "calls"); assertEqual(result.networkRequests, 1, "reported calls"); }],
  ["confirmed run binds reviewed exact mapping", async () => { const result = await runInitialKalshiLiveReadSmoke({ confirmed: true, transport: new CountingTransport(), clock }); assertEqual(result.mappingStatus, "REVIEWED_EXACT", "mapping"); assertEqual(result.normalizationStatus, "NORMALIZED_EXACT_MAPPING", "normalization"); }],
  ["confirmed run creates bounded-live research snapshot", async () => { const result = await runInitialKalshiLiveReadSmoke({ confirmed: true, transport: new CountingTransport(), clock }); assertEqual(result.sourceSnapshot?.executionMode, EventContractSourceExecutionMode.BoundedLiveRead, "execution mode"); assertEqual(result.sourceSnapshot?.authorizationStatus, EventContractSourceAuthorizationStatus.ResearchSourceOnly, "authority"); assertEqual(result.sourceSnapshot?.recordCount, 1, "records"); }],
  ["settlement result is normalized without quote authority", async () => { const result = await runInitialKalshiLiveReadSmoke({ confirmed: true, transport: new CountingTransport(), clock }); assertEqual(result.settlementResult, "DOWN", "settlement"); assertTrue(result.warnings.some((warning) => warning.includes("not a Robinhood quote")), "quote warning"); }],
  ["raw provider body is absent from summary", async () => { const result = await runInitialKalshiLiveReadSmoke({ confirmed: true, transport: new CountingTransport(), clock }); const output = JSON.stringify(result); assertTrue(!output.includes("rules_primary"), "rules absent"); assertTrue(!output.includes("64809.04"), "raw value absent"); }],
  ["altered payload fails closed without a snapshot", async () => { const transport = new CountingTransport(); transport.body = transport.body.replace("64839.26", "64839.27"); await expectError(() => runInitialKalshiLiveReadSmoke({ confirmed: true, transport, clock }), "altered payload"); assertEqual(transport.calls, 1, "one call"); }],
  ["malformed payload fails closed", async () => { const transport = new CountingTransport(); transport.body = "not-json"; await expectError(() => runInitialKalshiLiveReadSmoke({ confirmed: true, transport, clock }), "malformed"); }],
  ["summary and snapshot are deeply immutable", async () => { const result = await runInitialKalshiLiveReadSmoke({ confirmed: true, transport: new CountingTransport(), clock }); assertTrue(Object.isFrozen(result), "summary"); assertTrue(Object.isFrozen(result.sourceSnapshot), "snapshot"); }],
];

async function main(): Promise<void> {
  let passed = 0;
  for (const [name, run] of tests) {
    try { await run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
  }
  console.log(`Kalshi Event Contract Live-Smoke tests passed: ${String(passed)}/${String(tests.length)}.`);
}
void main();
