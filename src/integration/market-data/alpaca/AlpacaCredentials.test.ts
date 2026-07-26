import {
  ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE,
  ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE,
} from "./AlpacaPersonalMarketDataContracts";
import { AlpacaConfigurationError, loadAlpacaCredentials } from "./AlpacaCredentials";

type Test = readonly [string, () => void];
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
const validEnvironment = Object.freeze({
  [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: KEY_ID,
  [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: SECRET_KEY,
});

test("loads exactly two local environment credentials", () => {
  const credential = loadAlpacaCredentials(validEnvironment);
  equal(credential.revealForTransport().keyId, KEY_ID, "key id");
  equal(credential.revealForTransport().secretKey, SECRET_KEY, "secret");
});

test("missing key id fails closed without echoing the secret", () => {
  expectSafeFailure({ [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: SECRET_KEY }, SECRET_KEY);
});

test("missing secret fails closed without echoing the key id", () => {
  expectSafeFailure({ [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: KEY_ID }, KEY_ID);
});

test("blank, control-character, and short values fail closed", () => {
  expectSafeFailure({
    [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: "        ",
    [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: SECRET_KEY,
  }, SECRET_KEY);
  expectSafeFailure({
    [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: `${KEY_ID}\n`,
    [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: SECRET_KEY,
  }, SECRET_KEY);
  expectSafeFailure({
    [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: "short",
    [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: SECRET_KEY,
  }, SECRET_KEY);
});

test("identical key id and secret fail closed", () => {
  expectSafeFailure({
    [ALPACA_API_KEY_ID_ENVIRONMENT_VARIABLE]: KEY_ID,
    [ALPACA_API_SECRET_KEY_ENVIRONMENT_VARIABLE]: KEY_ID,
  }, KEY_ID);
});

test("diagnostic, JSON, and string representations are always redacted", () => {
  const credential = loadAlpacaCredentials(validEnvironment);
  const exposed = [
    credential.toString(),
    JSON.stringify(credential),
    JSON.stringify(credential.toRedactedDiagnostic()),
  ].join("|");
  assert(exposed.includes("[REDACTED]"), "redaction marker");
  assert(!exposed.includes(KEY_ID), "key id leaked");
  assert(!exposed.includes(SECRET_KEY), "secret leaked");
});

test("credential object and diagnostics are immutable", () => {
  const credential = loadAlpacaCredentials(validEnvironment);
  assert(Object.isFrozen(credential), "credential must be frozen");
  const diagnostic = credential.toRedactedDiagnostic();
  assert(Object.isFrozen(diagnostic), "diagnostic must be frozen");
  assert(Object.isFrozen(diagnostic.environmentVariables), "environment variables must be frozen");
  assert(Object.isFrozen(diagnostic.values), "redacted values must be frozen");
});

function expectSafeFailure(environment: Readonly<Record<string, string | undefined>>, forbidden: string): void {
  try {
    loadAlpacaCredentials(environment);
    throw new Error("Expected configuration failure.");
  } catch (error) {
    assert(error instanceof AlpacaConfigurationError, "typed configuration error");
    const rendered = `${error.message}|${JSON.stringify(error)}`;
    assert(!rendered.includes(forbidden), "configuration error leaked credential");
  }
}

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
console.log(`Alpaca credentials tests passed: ${passed}/${tests.length}`);
