import { BarInterval } from "../../../contracts/CanonicalBar";
import { TwelveDataExecutionMode } from "./TwelveDataContracts";
import {
  TWELVE_DATA_AAPL_FIXTURE_MAPPING,
  TwelveDataConfigurationError,
  buildTwelveDataHttpRequest,
  validateTwelveDataLiveSmokePolicy,
} from "./TwelveDataProvider";
import { TWELVE_DATA_SPY_TEST_MAPPING, fixtureRequest } from "./TwelveDataTestFixtures";
import { TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY } from "./TwelveDataLiveSmoke";

function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function expectError(run: () => unknown, label: string): void { try { run(); } catch (error: unknown) { if (error instanceof TwelveDataConfigurationError) return; throw error; } throw new Error(`${label}: expected error.`); }
function policy(overrides: Record<string, unknown> = {}): unknown { return { ...TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY, ...overrides }; }

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["approved AAPL PT5M policy is valid", () => assertEqual(validateTwelveDataLiveSmokePolicy(TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY).maxRecords, 10, "records")],
  ["unapproved symbol is rejected", () => expectError(() => buildTwelveDataHttpRequest(fixtureRequest({ maxRecords: 10 }), TWELVE_DATA_SPY_TEST_MAPPING, TwelveDataExecutionMode.BoundedLiveSmoke, TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY), "symbol")],
  ["unapproved interval is rejected", () => expectError(() => buildTwelveDataHttpRequest(fixtureRequest({ maxRecords: 10, interval: BarInterval.OneMinute }), TWELVE_DATA_AAPL_FIXTURE_MAPPING, TwelveDataExecutionMode.BoundedLiveSmoke, TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY), "interval")],
  ["excess record request is rejected instead of clamped", () => expectError(() => buildTwelveDataHttpRequest(fixtureRequest({ maxRecords: 11 }), TWELVE_DATA_AAPL_FIXTURE_MAPPING, TwelveDataExecutionMode.BoundedLiveSmoke, TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY), "records")],
  ["excess lookback is rejected", () => expectError(() => buildTwelveDataHttpRequest(fixtureRequest({ maxRecords: 10, startTime: "2026-07-19T14:30:00.000Z" }), TWELVE_DATA_AAPL_FIXTURE_MAPPING, TwelveDataExecutionMode.BoundedLiveSmoke, TWELVE_DATA_INITIAL_LIVE_SMOKE_POLICY), "lookback")],
  ["request budget must equal one", () => expectError(() => validateTwelveDataLiveSmokePolicy(policy({ maxRequestsPerRun: 2 })), "requests")],
  ["API credit budget must equal one", () => expectError(() => validateTwelveDataLiveSmokePolicy(policy({ maxApiCreditsPerRun: 2 })), "credits")],
  ["official evidence references are mandatory", () => expectError(() => validateTwelveDataLiveSmokePolicy(policy({ officialEvidenceReferences: [] })), "evidence")],
  ["polling and background modes are rejected", () => { expectError(() => validateTwelveDataLiveSmokePolicy(policy({ pollingAllowed: true })), "polling"); expectError(() => validateTwelveDataLiveSmokePolicy(policy({ backgroundExecutionAllowed: true })), "background"); }],
  ["persistence streaming and automatic retry are rejected", () => { expectError(() => validateTwelveDataLiveSmokePolicy(policy({ persistenceAllowed: true })), "persistence"); expectError(() => validateTwelveDataLiveSmokePolicy(policy({ streamingAllowed: true })), "streaming"); expectError(() => validateTwelveDataLiveSmokePolicy(policy({ automaticRetryAllowed: true })), "retry"); }],
];

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Twelve Data Live-Smoke Policy tests passed: ${String(passed)}/${String(tests.length)}.`);
