import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { runOptionsBrokerReferenceCommand } from "./options-broker-reference.mjs";

const root = resolve(import.meta.dirname, ".."), taskTempRoot = realpathSync(tmpdir());
const workspace = mkdtempSync(resolve(taskTempRoot, "alpha-broker-reference-"));
const input = JSON.parse(readFileSync(resolve(root, "fixtures/options-broker-reference/buy.example.json"), "utf8"));
let passed = 0;
function test(name, work) { work(); passed++; console.log(`PASS ${name}`); }
try {
  test("reference retains unknown account and excludes execution authority", () => {
    const report = runOptionsBrokerReferenceCommand(["--reference"]);
    assert.equal(report.executionAllowed, false); assert.equal(report.accountType, "UNKNOWN");
    assert.equal(report.optionsApproval, "UNKNOWN"); assert.equal(report.winProbability, null);
    assert.equal(report.researchSession.scheduledClose, "2026-09-04T20:15:00.000Z");
    assert.equal(report.settlementExample.scheduledSettlementDate, "2026-09-08");
    report.findings.length = 0;
    assert(runOptionsBrokerReferenceCommand(["--reference"]).findings.length > 0);
  });
  test("fee command uses supplied total premium and returns schedule estimate", () => {
    writeFileSync(resolve(workspace, "input.json"), JSON.stringify(input));
    const report = runOptionsBrokerReferenceCommand(["--fees", "input.json"], { workspaceRoot: workspace });
    assert.equal(report.status, "ESTIMATED"); assert.equal(report.fees.totalCents, 4);
    assert.equal(report.brokerFeesConfirmed, false);
  });
  test("other dates and fragmented executions do not become estimated broker bills", () => {
    writeFileSync(resolve(workspace, "input.json"), JSON.stringify({ ...input, tradeDate: "2026-09-08", executionCount: 2 }));
    const report = runOptionsBrokerReferenceCommand(["--fees", "input.json"], { workspaceRoot: workspace });
    assert.equal(report.status, "BLOCKED"); assert.equal(report.fees, null);
  });
  test("fatal UTF8 and file bounds fail without substituting input", () => {
    writeFileSync(resolve(workspace, "bad.json"), Buffer.from([0xff]));
    assert.throws(() => runOptionsBrokerReferenceCommand(["--fees", "bad.json"], { workspaceRoot: workspace }));
    writeFileSync(resolve(workspace, "bad.json"), " ".repeat(16 * 1024 + 1));
    assert.throws(() => runOptionsBrokerReferenceCommand(["--fees", "bad.json"], { workspaceRoot: workspace }), /OVERSIZED/);
    assert.throws(() => runOptionsBrokerReferenceCommand(["--fees", "."], { workspaceRoot: workspace }), /INVALID/);
  });
  test("unknown flags fail and help states the supported commands", () => {
    assert.throws(() => runOptionsBrokerReferenceCommand(["--trade"]), /UNSUPPORTED_COMMAND/);
    assert.throws(() => runOptionsBrokerReferenceCommand(["--fees", "--reference"]), /UNSUPPORTED_COMMAND/);
    assert.equal(runOptionsBrokerReferenceCommand(["--help"]).executionAllowed, false);
  });
  test("CLI exits nonzero for malformed input and emits no execution permission", () => {
    const result = spawnSync(process.execPath, [resolve(root, "node_modules/tsx/dist/cli.mjs"), resolve(root, "scripts/options-broker-reference.mjs"), "--fees", "bad.json"], { cwd: workspace, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 2); assert.equal(JSON.parse(result.stderr).executionAllowed, false);
  });
} finally {
  const actual = realpathSync(workspace);
  if (!actual.startsWith(taskTempRoot + sep) || !actual.startsWith(resolve(taskTempRoot, "alpha-broker-reference-"))) throw new Error("UNSAFE_TEST_CLEANUP");
  rmSync(actual, { recursive: true, force: true });
}
console.log(`Options broker reference command: ${passed}/${passed} passed.`);
