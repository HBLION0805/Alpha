import { parseTwelveDataResponse } from "./TwelveDataResponseParser";
import { fixtureBody } from "./TwelveDataTestFixtures";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["documented fixture JSON parses", () => assertEqual(parseTwelveDataResponse(fixtureBody()).status, "PARSED", "status")],
  ["malformed JSON is rejected", () => assertEqual(parseTwelveDataResponse("{" ).status, "REJECTED", "status")],
  ["empty body is rejected", () => assertEqual(parseTwelveDataResponse("").status, "REJECTED", "status")],
  ["non-object JSON is rejected", () => assertEqual(parseTwelveDataResponse("[]").status, "REJECTED", "status")],
  ["oversized response is rejected", () => assertEqual(parseTwelveDataResponse(`{"value":"${"x".repeat(2_000_000)}"}`).status, "REJECTED", "status")],
  ["parsed payload is deeply immutable", () => {
    const result = parseTwelveDataResponse(fixtureBody());
    assertTrue(Object.isFrozen(result), "result frozen");
    assertTrue(Object.isFrozen(result.payload), "payload frozen");
  }],
];

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Twelve Data Response Parser tests passed: ${String(passed)}/${String(tests.length)}.`);
