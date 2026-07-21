import { BarInterval } from "../../../contracts/CanonicalBar";
import { TwelveDataValidationIssueCode } from "./TwelveDataContracts";
import { TWELVE_DATA_AAPL_FIXTURE_MAPPING } from "./TwelveDataProvider";
import { parseTwelveDataResponse } from "./TwelveDataResponseParser";
import { validateTwelveDataResponse } from "./TwelveDataResponseValidator";
import { fixtureBody } from "./TwelveDataTestFixtures";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }

function payload(overrides: Record<string, unknown> = {}): unknown {
  const parsed = parseTwelveDataResponse(fixtureBody(overrides));
  if (parsed.payload === undefined) throw new Error("fixture parse failed");
  return parsed.payload;
}
function rejects(value: unknown, code: TwelveDataValidationIssueCode): void {
  const result = validateTwelveDataResponse(value, TWELVE_DATA_AAPL_FIXTURE_MAPPING, BarInterval.FiveMinutes);
  assertEqual(result.status, "INVALID", "status");
  assertTrue(result.blockers.some((entry) => entry.code === code), `issue ${code}`);
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["valid documented response passes", () => assertEqual(validateTwelveDataResponse(payload(), TWELVE_DATA_AAPL_FIXTURE_MAPPING, BarInterval.FiveMinutes).status, "VALID", "status")],
  ["provider error is translated", () => rejects({ status: "error", code: 429, message: "rate limit" }, TwelveDataValidationIssueCode.ProviderError)],
  ["missing metadata fails", () => rejects({ status: "ok", values: [] }, TwelveDataValidationIssueCode.InvalidMetadata)],
  ["empty rows fail", () => rejects(payload({ values: [] }), TwelveDataValidationIssueCode.InvalidRow)],
  ["symbol mismatch fails", () => rejects(payload({ meta: { ...JSON.parse(fixtureBody()).meta, symbol: "MSFT" } }), TwelveDataValidationIssueCode.ProviderIdentityMismatch)],
  ["exchange mismatch fails", () => rejects(payload({ meta: { ...JSON.parse(fixtureBody()).meta, exchange: "NYSE" } }), TwelveDataValidationIssueCode.ProviderIdentityMismatch)],
  ["MIC mismatch fails", () => rejects(payload({ meta: { ...JSON.parse(fixtureBody()).meta, mic_code: "XNYS" } }), TwelveDataValidationIssueCode.ProviderIdentityMismatch)],
  ["interval mismatch fails", () => rejects(payload({ meta: { ...JSON.parse(fixtureBody()).meta, interval: "1min" } }), TwelveDataValidationIssueCode.InvalidMetadata)],
  ["currency mismatch fails", () => rejects(payload({ meta: { ...JSON.parse(fixtureBody()).meta, currency: "EUR" } }), TwelveDataValidationIssueCode.InvalidMetadata)],
  ["ambiguous datetime fails", () => rejects(payload({ values: [{ ...JSON.parse(fixtureBody()).values[0], datetime: "07/20/2026 14:30" }] }), TwelveDataValidationIssueCode.AmbiguousTimestamp)],
  ["invalid decimal fails", () => rejects(payload({ values: [{ ...JSON.parse(fixtureBody()).values[0], open: "NaN" }] }), TwelveDataValidationIssueCode.InvalidRow)],
  ["negative volume fails", () => rejects(payload({ values: [{ ...JSON.parse(fixtureBody()).values[0], volume: "-1" }] }), TwelveDataValidationIssueCode.InvalidRow)],
  ["validated output strips unknown provider fields", () => {
    const source = JSON.parse(fixtureBody()); source.secret = "must-not-leak"; source.values[0].native = "must-not-leak";
    const result = validateTwelveDataResponse(source, TWELVE_DATA_AAPL_FIXTURE_MAPPING, BarInterval.FiveMinutes);
    assertTrue(!JSON.stringify(result).includes("must-not-leak"), "unknown fields absent");
  }],
  ["validated output is immutable", () => assertTrue(Object.isFrozen(validateTwelveDataResponse(payload(), TWELVE_DATA_AAPL_FIXTURE_MAPPING, BarInterval.FiveMinutes)), "frozen")],
];

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Twelve Data Response Validator tests passed: ${String(passed)}/${String(tests.length)}.`);
