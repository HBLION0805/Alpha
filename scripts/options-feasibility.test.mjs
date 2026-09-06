import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
function run(args = []) {
  return spawnSync(process.execPath, [resolve(root, "node_modules/tsx/dist/cli.mjs"), resolve(root, "scripts/options-feasibility.mjs"), ...args], { cwd: root, encoding: "utf8", timeout: 30000 });
}
const tests = [
  ["demo exposes exact premium stop basis and blocks both scenarios", () => {
    const result = run(["--demo"]);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.pricesAreIllustrative, true);
    assert.equal(body.executionAllowed, false);
    assert.equal(body.scenarios.length, 2);
    assert.deepEqual(body.scenarios.map(({ result: r }) => r.economics.plannedStopCents), [100, 200]);
    for (const { result: r } of body.scenarios) {
      assert.equal(r.status, "NO_TRADE");
      assert.equal(r.executionAllowed, false);
      assert.equal(r.evidenceOrigin, "MANUAL_SCENARIO");
    }
  }],
  ["manual JSON path produces one deterministic diagnostic", () => {
    const result = run(["--input", "fixtures/options-retail-feasibility/gld-normal.json"]);
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.economics.immediateLiquidationFrictionCents, 300);
    assert.equal(body.economics.stressLossCents, 5000);
  }],
  ["help describes the offline boundary", () => {
    const result = run(["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /manual scenarios, not verified quotes/);
  }],
  ["live and unknown arguments are rejected", () => {
    for (const args of [["--live"], ["--demo", "--live"], ["--input"], ["--input", "--demo"]]) {
      const result = run(args);
      assert.equal(result.status, 2);
      assert.equal(JSON.parse(result.stderr).executionAllowed, false);
    }
  }],
  ["missing file is an input error", () => {
    const result = run(["--input", "fixtures/options-retail-feasibility/missing.json"]);
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stderr).status, "INPUT_ERROR");
  }],
  ["malformed and oversized scenario files are rejected", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-options-feasibility-"));
    try {
      const path = join(directory, "input.json");
      for (const content of ["{", " ".repeat(65537)]) {
        writeFileSync(path, content);
        const result = run(["--input", path]);
        assert.equal(result.status, 2);
        assert.equal(JSON.parse(result.stderr).status, "INPUT_ERROR");
      }
    } finally {
      // Only the exact directory created by this test is removed.
      rmSync(directory, { recursive: true });
    }
  }],
];
for (const [name, test] of tests) {
  test();
  console.log(`PASS ${name}`);
}
console.log(`Options Feasibility CLI: ${tests.length}/${tests.length} tests passed.`);
