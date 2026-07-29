import {
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_BODY_CHARACTERS,
  TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_MESSAGE_CHARACTERS,
  parseTwelveDataPersonalMulsReferenceProviderError,
  sanitizeTwelveDataPersonalMulsReferenceProviderError,
} from "./TwelveDataPersonalMulsReferenceErrorDiagnostic";

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

const API_KEY = "0123456789abcdef0123456789abcdef";

test("allow-listed provider error fields are immutable", () => {
  const result = parseTwelveDataPersonalMulsReferenceProviderError(
    JSON.stringify({
      status: "error",
      code: 400,
      message: "Invalid request.",
      request_id: "must-not-cross",
    }),
    [API_KEY],
  );
  assert(result !== undefined, "diagnostic");
  equal(result.status, "error", "status");
  equal(result.code, 400, "code");
  equal(result.message, "Invalid request.", "message");
  equal(result.messageTruncated, false, "truncated");
  equal(
    (result as unknown as Record<string, unknown>).request_id,
    undefined,
    "unknown field",
  );
  equal(Object.isFrozen(result), true, "frozen");
});

test("exact and secret-shaped credentials are redacted", () => {
  const result = parseTwelveDataPersonalMulsReferenceProviderError(
    JSON.stringify({
      status: "error",
      message:
        `Rejected ${API_KEY}; apikey=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`,
    }),
    [API_KEY],
  );
  assert(result?.message !== undefined, "message");
  assert(!result.message.includes(API_KEY), "exact key leaked");
  assert(!result.message.includes("aaaaaaaa"), "shaped key leaked");
  assert(result.message.includes("[REDACTED]"), "redaction absent");
});

test("labelled authorization values are redacted", () => {
  const result = parseTwelveDataPersonalMulsReferenceProviderError(
    JSON.stringify({
      message:
        "Authorization: Bearer unsafe-token API key = another-token",
    }),
    [],
  );
  assert(result?.message !== undefined, "message");
  assert(!result.message.includes("unsafe-token"), "authorization leaked");
  assert(!result.message.includes("another-token"), "API key leaked");
});

test("message controls are normalized and length is bounded", () => {
  const result = parseTwelveDataPersonalMulsReferenceProviderError(
    JSON.stringify({
      message: `first\r\nsecond\t${"界".repeat(300)}`,
    }),
    [],
  );
  assert(result?.message !== undefined, "message");
  assert(!/[\r\n\t]/u.test(result.message), "control retained");
  equal(
    Array.from(result.message).length,
    TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_MESSAGE_CHARACTERS,
    "message bound",
  );
  equal(result.messageTruncated, true, "truncated");
});

test("status and code must match their strict allow lists", () => {
  const result = parseTwelveDataPersonalMulsReferenceProviderError(
    JSON.stringify({
      status: "warning",
      code: "400",
      message: "usable",
    }),
    [],
  );
  assert(result !== undefined, "diagnostic");
  equal(result.status, undefined, "status");
  equal(result.code, undefined, "code");
  equal(result.message, "usable", "message");
});

test("unknown and nested values never cross the boundary", () => {
  const result = parseTwelveDataPersonalMulsReferenceProviderError(
    JSON.stringify({
      details: { secret: API_KEY },
      headers: { authorization: API_KEY },
      list: [API_KEY],
    }),
    [API_KEY],
  );
  equal(result, undefined, "unknown-only response");
});

test("malformed non-object empty and oversized bodies are unavailable", () => {
  for (const body of [
    "",
    "not-json",
    "[]",
    JSON.stringify({}),
    "x".repeat(
      TWELVE_DATA_PERSONAL_MULS_REFERENCE_ERROR_MAX_BODY_CHARACTERS + 1,
    ),
  ]) {
    equal(
      parseTwelveDataPersonalMulsReferenceProviderError(body, [API_KEY]),
      undefined,
      "unavailable",
    );
  }
});

test("empty sanitized messages do not create a diagnostic", () => {
  equal(
    parseTwelveDataPersonalMulsReferenceProviderError(
      JSON.stringify({ message: "\r\n\t" }),
      [],
    ),
    undefined,
    "empty message",
  );
});

test("hostile injected diagnostic getters fail closed", () => {
  const hostile = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(hostile, "message", {
    enumerable: true,
    get: () => {
      throw new Error("must-not-cross");
    },
  });
  equal(
    sanitizeTwelveDataPersonalMulsReferenceProviderError(hostile, [API_KEY]),
    undefined,
    "hostile diagnostic",
  );
});

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
  `Twelve Data MULS provider-error diagnostic tests: ${passed}/${tests.length} passed.`,
);
