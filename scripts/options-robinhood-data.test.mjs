import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { probeRobinhoodPublicEndpoint, runOptionsRobinhoodDataCommand } from "./options-robinhood-data.mjs";
import { ROBINHOOD_DATA_ENDPOINT, ROBINHOOD_DATA_TOOL_NAMES } from "../src/engines/options-robinhood-data/RobinhoodDataReadinessEngine.ts";

const root = resolve(import.meta.dirname, ".."), taskTempRoot = realpathSync(tmpdir());
const workspace = mkdtempSync(resolve(taskTempRoot, "alpha-robinhood-data-"));
const clock = () => "2026-09-06T23:00:00.000Z";
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
function boundaries(report) {
  for (const key of ["executionAllowed", "marketDataConnected", "accountAccessPerformed", "schemaSemanticsVerified"]) assert.equal(report[key], false);
  assert.equal(report.actualQuoteReplay, "NOT_RUN"); assert.equal(report.winProbability, null);
}
function response(status = 401, challenge = true, cancel = async () => {}) {
  return { status, redirected: false, headers: { has: (name) => { assert.equal(name, "www-authenticate"); return challenge; }, get: () => { throw new Error("PRIVATE_HEADER_MUST_NOT_BE_READ"); } },
    body: { cancel }, json: () => { throw new Error("BODY_MUST_NOT_BE_READ"); }, text: () => { throw new Error("BODY_MUST_NOT_BE_READ"); } };
}
try {
  await test("report and help never fetch or write and retain every readiness boundary", async () => {
    const before = readdirSync(workspace);
    for (const args of [[], ["--report"], ["--help"]]) boundaries(await runOptionsRobinhoodDataCommand(args, { workspaceRoot: workspace, fetchImplementation: () => { throw new Error("UNEXPECTED_NETWORK"); } }));
    assert.deepEqual(readdirSync(workspace), before);
    const report = await runOptionsRobinhoodDataCommand([]);
    assert.equal(report.runtimeSchemas, "NOT_OBTAINED"); assert.equal(report.configurationInstalled, false);
    report.candidateTools.length = 0; report.requirements[0].needed = "changed";
    const restored = await runOptionsRobinhoodDataCommand([]);
    assert.equal(restored.candidateTools.length, 5); assert.notEqual(restored.requirements[0].needed, "changed");
  });
  await test("disabled config contains the exact candidate filter with no token or account fields", () => {
    const text = readFileSync(resolve(root, "fixtures/options-robinhood-data/codex.disabled.example.toml"), "utf8");
    const assignments = text.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && !line.startsWith("["));
    const values = Object.fromEntries(assignments.map((line) => { const at = line.indexOf("="); return [line.slice(0, at).trim(), line.slice(at + 1).trim()]; }));
    assert.deepEqual(Object.keys(values).sort(), ["url", "enabled", "required", "enabled_tools", "startup_timeout_sec", "tool_timeout_sec"].sort());
    assert.equal(JSON.parse(values.url), ROBINHOOD_DATA_ENDPOINT); assert.equal(values.enabled, "false"); assert.equal(values.required, "false");
    assert.deepEqual(JSON.parse(values.enabled_tools), [...ROBINHOOD_DATA_TOOL_NAMES]);
  });
  await test("empty local catalog is reviewed without network or journal writes", async () => {
    writeFileSync(resolve(workspace, "tools.json"), JSON.stringify({ tools: [] }));
    const before = readdirSync(workspace);
    const report = await runOptionsRobinhoodDataCommand(["--inspect-tools", "tools.json"], { workspaceRoot: workspace, fetchImplementation: () => { throw new Error("UNEXPECTED_NETWORK"); } });
    boundaries(report); assert.equal(report.status, "LOCAL_CATALOG_REVIEW_ONLY"); assert(report.blockers.length > 0);
    assert.deepEqual(readdirSync(workspace), before);
  });
  await test("local input bytes encoding directories and malformed content are rejected without disclosure", async () => {
    for (const value of [Buffer.from([0xff]), "x".repeat(512 * 1024 + 1), '{"private":"DO_NOT_ECHO"', '{"tools":"invalid"}']) {
      writeFileSync(resolve(workspace, "bad.json"), value);
      await assert.rejects(runOptionsRobinhoodDataCommand(["--inspect-tools", "bad.json"], { workspaceRoot: workspace }), { message: "ROBINHOOD_CATALOG_INPUT_REJECTED" });
    }
    await assert.rejects(runOptionsRobinhoodDataCommand(["--inspect-tools", "."], { workspaceRoot: workspace }), /INPUT_REJECTED/);
  });
  await test("unknown commands URLs auth and save flags cannot expand the command", async () => {
    for (const args of [["--login"], ["--probe-public", "https://example.com"], ["--probe-public", "--token", "private"], ["--inspect-tools", "--report"], ["--report", "--save"]]) {
      await assert.rejects(runOptionsRobinhoodDataCommand(args), /UNSUPPORTED_COMMAND/);
    }
  });
  await test("anonymous probe uses exactly one fixed GET without cookies auth redirect or body", async () => {
    let calls = 0, canceled = false;
    const report = await probeRobinhoodPublicEndpoint({ now: clock, fetchImplementation: async (url, options) => {
      calls++; assert.equal(url, ROBINHOOD_DATA_ENDPOINT);
      assert.deepEqual(Object.keys(options).sort(), ["method", "credentials", "redirect", "signal", "headers"].sort());
      assert.equal(options.method, "GET"); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "manual");
      assert(options.signal instanceof AbortSignal); assert.deepEqual(Object.keys(options.headers).sort(), ["Accept", "User-Agent"]);
      return response(401, true, async () => { canceled = true; });
    } });
    assert.equal(calls, 1); assert(canceled); boundaries(report); assert.equal(report.status, "AUTHENTICATION_REQUIRED");
    assert.equal(report.authenticationChallengePresent, true); assert.equal(report.authenticationAttempted, false);
    assert.equal(report.mcpSessionInitialized, false); assert.equal(report.responseBodyRead, false);
  });
  for (const [code, expected] of [[200, "ENDPOINT_RESPONDED_SCHEMA_UNVERIFIED"], [204, "ENDPOINT_RESPONDED_SCHEMA_UNVERIFIED"], [401, "AUTHENTICATION_REQUIRED"], [403, "ACCESS_DENIED"], [301, "REDIRECT_REFUSED"], [307, "REDIRECT_REFUSED"], [404, "HTTP_UNAVAILABLE"], [405, "HTTP_UNAVAILABLE"], [429, "HTTP_UNAVAILABLE"], [500, "HTTP_UNAVAILABLE"]]) {
    await test(`HTTP ${code} remains only ${expected} without data or auth permission`, async () => {
      const report = await probeRobinhoodPublicEndpoint({ now: clock, fetchImplementation: async () => response(code, false) });
      assert.equal(report.status, expected); assert.equal(report.httpStatus, code); boundaries(report);
    });
  }
  await test("network errors cannot leak error text headers or URLs", async () => {
    const report = await probeRobinhoodPublicEndpoint({ now: clock, fetchImplementation: async () => { throw new Error("DO_NOT_ECHO_PRIVATE_TOKEN"); } });
    assert.equal(report.status, "NETWORK_UNAVAILABLE"); assert.equal(report.httpStatus, null); assert(!JSON.stringify(report).includes("DO_NOT_ECHO")); boundaries(report);
  });
  await test("a transport that ignores AbortSignal still meets the total deadline", async () => {
    let signal;
    const report = await probeRobinhoodPublicEndpoint({ now: clock, timeoutMs: 5, fetchImplementation: (_, options) => { signal = options.signal; return new Promise(() => {}); } });
    assert.equal(report.status, "NETWORK_UNAVAILABLE"); assert.equal(signal.aborted, true); boundaries(report);
  });
  await test("unresponsive response cancellation is covered by the same deadline", async () => {
    const report = await probeRobinhoodPublicEndpoint({ now: clock, timeoutMs: 5, fetchImplementation: async () => response(200, false, () => new Promise(() => {})) });
    assert.equal(report.status, "NETWORK_UNAVAILABLE"); boundaries(report);
  });
  await test("unexpected followed redirects and invalid HTTP values cannot look reachable", async () => {
    for (const value of [{ ...response(200), redirected: true }, response(999), response(NaN)]) {
      assert.equal((await probeRobinhoodPublicEndpoint({ now: clock, fetchImplementation: async () => value })).status, "NETWORK_UNAVAILABLE");
    }
  });
  await test("invalid or backward clocks and timeout overrides fail rather than fabricate timestamps", async () => {
    await assert.rejects(probeRobinhoodPublicEndpoint({ now: () => "invalid" }), /INVALID_CLOCK/);
    let at = 0;
    await assert.rejects(probeRobinhoodPublicEndpoint({ now: () => ["2026-09-06T23:01:00.000Z", clock()][at++], fetchImplementation: async () => response() }), /INVALID_CLOCK/);
    for (const timeoutMs of [0, -1, 12_001, NaN, 1.5]) await assert.rejects(probeRobinhoodPublicEndpoint({ timeoutMs }), /INVALID_TIMEOUT/);
  });
  await test("CLI malformed inputs use exit2 and cannot echo private contents or paths", () => {
    const result = spawnSync(process.execPath, [resolve(root, "node_modules/tsx/dist/cli.mjs"), resolve(root, "scripts/options-robinhood-data.mjs"), "--inspect-tools", "PRIVATE_DO_NOT_ECHO.json"], { cwd: workspace, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 2); assert(!result.stderr.includes("PRIVATE_DO_NOT_ECHO")); boundaries(JSON.parse(result.stderr));
  });
} finally {
  const actual = realpathSync(workspace);
  if (!actual.startsWith(taskTempRoot + sep) || !actual.startsWith(resolve(taskTempRoot, "alpha-robinhood-data-"))) throw new Error("UNSAFE_TEST_CLEANUP");
  rmSync(actual, { recursive: true, force: true });
}
console.log(`Robinhood data readiness command: ${passed}/${passed} passed.`);
