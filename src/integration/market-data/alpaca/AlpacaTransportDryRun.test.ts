import { BarInterval } from "../../../contracts/CanonicalBar";
import type {
  AlpacaCredentials,
  AlpacaHttpResponse,
  AlpacaHttpTransport,
  AlpacaPersonalDryRunInput,
  AlpacaPersonalHttpRequest,
  AlpacaTransportExecutionOptions,
} from "./AlpacaPersonalMarketDataContracts";
import { ALPACA_PERSONAL_EXACT_SYMBOLS } from "./AlpacaPersonalMarketDataPlanner";
import { runAlpacaTransportDryRun } from "./AlpacaTransportDryRun";

type Test = readonly [string, () => void];
const tests: Test[] = [];
function test(name: string, run: Test[1]): void { tests.push([name, run]); }
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}

class CountingTransport implements AlpacaHttpTransport {
  public validations = 0;
  public executions = 0;

  public assertReady(_request: Readonly<AlpacaPersonalHttpRequest>): void {
    this.validations += 1;
  }

  public async execute(
    _request: Readonly<AlpacaPersonalHttpRequest>,
    _credentials: Readonly<AlpacaCredentials>,
    _options?: Readonly<AlpacaTransportExecutionOptions>,
  ): Promise<AlpacaHttpResponse> {
    this.executions += 1;
    throw new Error("Dry-run must never execute transport.");
  }
}

function plan(): AlpacaPersonalDryRunInput {
  return {
    planId: "personal-alpaca:transport-dry-run:1",
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

const environment = Object.freeze({
  ALPHA_ALPACA_API_KEY_ID: "PKTESTKEY123456",
  ALPHA_ALPACA_API_SECRET_KEY: "test-secret-key-123456789",
});

test("dry-run validates all five requests and executes zero", () => {
  const transport = new CountingTransport();
  const result = runAlpacaTransportDryRun({ plan: plan(), environment, transport });
  equal(transport.validations, 5, "validations");
  equal(transport.executions, 0, "executions");
  equal(result.networkRequests, 0, "network requests");
  equal(result.persistenceWrites, 0, "writes");
});

test("dry-run output is explicitly non-live and non-authoritative", () => {
  const result = runAlpacaTransportDryRun({ plan: plan(), environment, transport: new CountingTransport() });
  equal(result.mode, "DRY_RUN", "mode");
  equal(result.liveExecutionAuthorized, false, "live authority");
  assert(result.notice.includes("NO TRADING"), "notice");
});

test("credential output is redacted", () => {
  const result = runAlpacaTransportDryRun({ plan: plan(), environment, transport: new CountingTransport() });
  const rendered = JSON.stringify(result);
  assert(rendered.includes("[REDACTED]"), "redaction marker");
  assert(!rendered.includes(environment.ALPHA_ALPACA_API_KEY_ID), "key id leaked");
  assert(!rendered.includes(environment.ALPHA_ALPACA_API_SECRET_KEY), "secret leaked");
});

test("missing credentials fail before transport validation or execution", () => {
  const transport = new CountingTransport();
  try {
    runAlpacaTransportDryRun({ plan: plan(), environment: {}, transport });
    throw new Error("Expected credential failure.");
  } catch {
    equal(transport.validations, 0, "validations");
    equal(transport.executions, 0, "executions");
  }
});

test("dry-run result is deterministic and immutable", () => {
  const first = runAlpacaTransportDryRun({ plan: plan(), environment, transport: new CountingTransport() });
  const second = runAlpacaTransportDryRun({ plan: plan(), environment, transport: new CountingTransport() });
  equal(JSON.stringify(first), JSON.stringify(second), "deterministic output");
  assert(Object.isFrozen(first), "summary frozen");
  assert(Object.isFrozen(first.warnings), "warnings frozen");
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`Alpaca transport dry-run tests passed: ${passed}/${tests.length}`);
