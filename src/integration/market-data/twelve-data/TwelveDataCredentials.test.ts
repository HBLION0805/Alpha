import { TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE } from "./TwelveDataContracts";
import { TwelveDataConfigurationError, loadTwelveDataCredentials } from "./TwelveDataProvider";

function assertTrue(value: boolean, label: string): void { if (!value) throw new Error(`${label}: expected true.`); }
function assertEqual<T>(actual: T, expected: T, label: string): void { if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`); }
function expectError(run: () => unknown, label: string): void { try { run(); } catch (error: unknown) { if (error instanceof TwelveDataConfigurationError) return; throw error; } throw new Error(`${label}: expected error.`); }

const FAKE_SECRET = "fake-live-smoke-credential";
const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["missing credential fails closed", () => expectError(() => loadTwelveDataCredentials({}), "missing")],
  ["blank credential fails closed", () => expectError(() => loadTwelveDataCredentials({ [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: "   " }), "blank")],
  ["valid fake credential is trimmed and available only to transport", () => { const credential = loadTwelveDataCredentials({ [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: `  ${FAKE_SECRET}  ` }); assertEqual(credential.revealForTransport(), FAKE_SECRET, "transport secret"); assertTrue(Object.isFrozen(credential), "immutable handle"); }],
  ["diagnostics and string conversion are redacted", () => { const credential = loadTwelveDataCredentials({ [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: FAKE_SECRET }); const output = `${credential.toString()}|${JSON.stringify(credential.toRedactedDiagnostic())}`; assertTrue(output.includes("[REDACTED]"), "redaction marker"); assertTrue(!output.includes(FAKE_SECRET), "secret absent"); }],
  ["credential serialization cannot reveal secret", () => { const credential = loadTwelveDataCredentials({ [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: FAKE_SECRET }); assertTrue(!JSON.stringify(credential).includes(FAKE_SECRET), "serialized secret absent"); assertEqual(credential.toJSON().environmentVariable, TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE, "environment name"); }],
  ["credential errors never echo supplied secret", () => { const invalid = "secret with forbidden control\n"; try { loadTwelveDataCredentials({ [TWELVE_DATA_API_KEY_ENVIRONMENT_VARIABLE]: invalid }); } catch (error: unknown) { assertTrue(!String(error).includes(invalid), "secret absent from error"); return; } throw new Error("invalid credential should fail"); }],
];

let passed = 0;
for (const [name, run] of tests) {
  try { run(); passed += 1; console.log(`PASS ${name}`); } catch (error: unknown) { console.error(`FAIL ${name}`); throw error; }
}
console.log(`Twelve Data Credential Boundary tests passed: ${String(passed)}/${String(tests.length)}.`);
