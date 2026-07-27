import { TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE } from "./TwelveDataContracts";
import {
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION_FLAG,
  TwelveDataPersonalMulsReferenceCommandError,
  createTwelveDataPersonalMulsReferenceCommandInput,
  parseTwelveDataPersonalMulsReferenceCommandArguments,
} from "./TwelveDataPersonalMulsReferenceCommand";
import { TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION } from "./TwelveDataPersonalMulsReferenceLiveOperation";

type Test = readonly [string, () => void];
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

const DATE = "2026-07-27";
const FINGERPRINT = "twelve-data-muls-reference:0123456789abcdef";
const liveArgs = [
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION_FLAG,
  `--authorization-date=${DATE}`,
  `--request-fingerprint=${FINGERPRINT}`,
] as const;

test("no arguments parse only as dry run", () => {
  const result = parseTwelveDataPersonalMulsReferenceCommandArguments([]);
  equal(result.confirmed, false, "confirmed");
  equal(Object.keys(result).length, 1, "keys");
});

test("exact three-part authorization parses independently of order", () => {
  const result = parseTwelveDataPersonalMulsReferenceCommandArguments(
    [...liveArgs].reverse(),
  );
  equal(result.confirmed, true, "confirmed");
  equal(result.authorizationDateUtc, DATE, "date");
  equal(result.requestFingerprint, FINGERPRINT, "fingerprint");
  equal(Object.isFrozen(result), true, "frozen");
});

test("missing duplicate unknown and override arguments fail closed", () => {
  for (const args of [
    [TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION_FLAG],
    [...liveArgs, "--retry"],
    [liveArgs[0], liveArgs[1], liveArgs[1]],
    [liveArgs[0], liveArgs[1], "--symbol=AAPL"],
    [liveArgs[0], "--authorization-date=2026-02-30", liveArgs[2]],
    [liveArgs[0], liveArgs[1],
      "--request-fingerprint=twelve-data-muls-reference:not-a-hash"],
  ]) {
    expectCommandError(() =>
      parseTwelveDataPersonalMulsReferenceCommandArguments(args));
  }
});

test("command input copies only the declared credential", () => {
  const options =
    parseTwelveDataPersonalMulsReferenceCommandArguments(liveArgs);
  const result = createTwelveDataPersonalMulsReferenceCommandInput(options, {
    [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: "test-key",
    UNRELATED_SECRET: "do-not-copy",
  });
  equal(result.confirmed, true, "confirmed");
  equal(result.authorization?.confirmation,
    TWELVE_DATA_PERSONAL_MULS_REFERENCE_CONFIRMATION, "confirmation");
  equal(result.authorization?.operationDateUtc, DATE, "date");
  equal(result.authorization?.requestFingerprint, FINGERPRINT, "fingerprint");
  equal(result.environment?.[TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE],
    "test-key", "key");
  equal(result.environment?.UNRELATED_SECRET, undefined, "unrelated");
  equal(Object.isFrozen(result), true, "input frozen");
  equal(Object.isFrozen(result.authorization), true, "authorization frozen");
  equal(Object.isFrozen(result.environment), true, "environment frozen");
});

test("dry-run options cannot smuggle authorization or authority", () => {
  expectCommandError(() =>
    createTwelveDataPersonalMulsReferenceCommandInput({
      confirmed: false,
      authorizationDateUtc: DATE,
    }, {}));
  expectCommandError(() =>
    createTwelveDataPersonalMulsReferenceCommandInput({
      confirmed: true,
      authorizationDateUtc: DATE,
      requestFingerprint: FINGERPRINT,
      order: "BUY",
    } as unknown as Parameters<
      typeof createTwelveDataPersonalMulsReferenceCommandInput
    >[0], {}));
});

function expectCommandError(run: () => unknown): void {
  try {
    run();
  } catch (error) {
    assert(error instanceof TwelveDataPersonalMulsReferenceCommandError,
      "typed command error");
    return;
  }
  throw new Error("Expected command failure.");
}

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(
  `Twelve Data MULS reference command tests: ${passed}/${tests.length} passed.`,
);
