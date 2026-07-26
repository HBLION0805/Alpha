import { BarInterval } from "../../../contracts/CanonicalBar";
import {
  AlpacaLiveReadCommandError,
  createAlpacaLiveReadSmokeInput,
  parseAlpacaLiveReadCommandArguments,
} from "./AlpacaPersonalMarketDataLiveSmokeCommand";
import { runAlpacaPersonalMarketDataLiveSmoke } from "./AlpacaPersonalMarketDataLiveSmoke";
import { ALPACA_PERSONAL_EXACT_SYMBOLS } from "./AlpacaPersonalMarketDataPlanner";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}
function expectArgumentFailure(args: readonly string[]): void {
  try {
    parseAlpacaLiveReadCommandArguments(args);
    throw new Error("Expected argument failure.");
  } catch (error) {
    assert(error instanceof AlpacaLiveReadCommandError, "typed command error");
  }
}
function expectInputFailure(
  args: readonly string[],
  testClock: { now(): string },
): void {
  try {
    createAlpacaLiveReadSmokeInput(
      parseAlpacaLiveReadCommandArguments(args), environment, testClock,
    );
    throw new Error("Expected input construction failure.");
  } catch (error) {
    assert(error instanceof AlpacaLiveReadCommandError, "typed command error");
  }
}


const baseArgs = Object.freeze([
  "--session-date=2026-07-24",
  "--daily-start=2026-07-24T04:00:00.000Z",
  "--session-open=2026-07-24T13:30:00.000Z",
  "--session-close=2026-07-24T20:00:00.000Z",
]);
const environment = Object.freeze({
  ALPHA_ALPACA_API_KEY_ID: "PKTESTKEY123456",
  ALPHA_ALPACA_API_SECRET_KEY: "test-secret-key-123456789",
});
const clock = Object.freeze({ now: () => "2026-07-26T20:30:00.000Z" });

const tests: ReadonlyArray<readonly [string, () => void | Promise<void>]> = [
  ["exact completed-session arguments parse as dry run", () => {
    const result = parseAlpacaLiveReadCommandArguments(baseArgs);
    equal(result.confirmed, false, "confirmed");
    equal(result.sessionDate, "2026-07-24", "session date");
  }],
  ["one exact Owner flag enables one confirmed invocation", () => {
    const result = parseAlpacaLiveReadCommandArguments([...baseArgs, "--confirm-alpaca-live-read"]);
    equal(result.confirmed, true, "confirmed");
  }],
  ["missing duplicate and unknown authority fail closed", () => {
    expectArgumentFailure(baseArgs.slice(1));
    expectArgumentFailure([...baseArgs, baseArgs[0]!]);
    expectArgumentFailure([...baseArgs, "--poll"]);
    expectArgumentFailure([...baseArgs, "--confirm-alpaca-live-read", "--confirm-alpaca-live-read"]);
  }],
  ["invalid chronology and mismatched session date fail closed", () => {
    expectArgumentFailure(baseArgs.map((entry) => entry.startsWith("--session-close=")
      ? "--session-close=2026-07-24T13:00:00.000Z" : entry));
    expectArgumentFailure(baseArgs.map((entry) => entry.startsWith("--session-date=")
      ? "--session-date=2026-07-23" : entry));
  }],
  ["future and not-yet-closed sessions fail before input construction", () => {
    expectInputFailure(baseArgs, { now: () => "2026-07-24T20:00:59.999Z" });
    const futureArgs = baseArgs.map((entry) => entry
      .replace("2026-07-24", "2026-07-27"));
    expectInputFailure(futureArgs, { now: () => "2026-07-26T21:00:00.000Z" });
  }],
  ["session is eligible exactly at the closure threshold", () => {
    const input = createAlpacaLiveReadSmokeInput(
      parseAlpacaLiveReadCommandArguments(baseArgs), environment,
      { now: () => "2026-07-24T20:01:00.000Z" },
    );
    equal(input.plan.plannedAt, "2026-07-24T20:01:00.000Z", "single evaluated clock");
  }],
  ["non-canonical command clock fails closed", () => {
    expectInputFailure(baseArgs, { now: () => "2026-07-26T20:30:00Z" });
    expectInputFailure(baseArgs, { now: () => "not-a-timestamp" });
  }],

  ["command constructs fixed windows and exact daily boundaries", () => {
    const input = createAlpacaLiveReadSmokeInput(
      parseAlpacaLiveReadCommandArguments(baseArgs), environment, clock,
    );
    equal(input.plan.windows.length, 4, "window count");
    equal(input.plan.windows[0]?.interval, BarInterval.OneDay, "daily interval");
    equal(input.plan.windows[0]?.endTime, "2026-07-25T04:00:00.000Z", "daily window end");
    equal(input.plan.windows[3]?.maxRecords, 1_000, "five-minute bound");
    equal(input.dailyBoundaries.length, ALPACA_PERSONAL_EXACT_SYMBOLS.length, "boundary count");
    equal(input.dailyBoundaries[0]?.intervalEnd, "2026-07-24T20:00:00.000Z", "reviewed close");
  }],
  ["default command execution remains zero-network dry run", async () => {
    const input = createAlpacaLiveReadSmokeInput(
      parseAlpacaLiveReadCommandArguments(baseArgs), environment, clock,
    );
    const result = await runAlpacaPersonalMarketDataLiveSmoke(input);
    equal(result.mode, "DRY_RUN", "mode");
    equal(result.networkRequests, 0, "network requests");
    equal(result.persistenceWrites, 0, "persistence writes");
    assert(!JSON.stringify(result).includes(environment.ALPHA_ALPACA_API_SECRET_KEY), "secret redacted");
  }],
  ["command copies only the two declared credential variables", () => {
    const mutableEnvironment: Record<string, string | undefined> = {
      ...environment,
      UNRELATED_PROCESS_VALUE: "must-not-cross-boundary",
    };
    const input = createAlpacaLiveReadSmokeInput(parseAlpacaLiveReadCommandArguments(baseArgs), mutableEnvironment, clock);
    assert(input.environment !== mutableEnvironment, "environment copied");
    assert(!("UNRELATED_PROCESS_VALUE" in input.environment!), "unrelated variable excluded");
    assert(Object.isFrozen(input.environment), "credential environment frozen");
  }],

  ["options and constructed input are deeply immutable", () => {
    const options = parseAlpacaLiveReadCommandArguments(baseArgs);
    const input = createAlpacaLiveReadSmokeInput(options, environment, clock);
    assert(Object.isFrozen(options), "options frozen");
    assert(Object.isFrozen(input), "input frozen");
    assert(Object.isFrozen(input.plan.windows), "windows frozen");
    assert(Object.isFrozen(input.dailyBoundaries), "boundaries frozen");
  }],
];

async function main(): Promise<void> {
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
  console.log(`Alpaca live-read command tests passed: ${String(passed)}/${String(tests.length)}.`);
}

void main();
