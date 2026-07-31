import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateCurrentStatus } from "./validate-current-status.mjs";

const root = resolve(import.meta.dirname, "..");
const status = JSON.parse(readFileSync(resolve(root, "docs/status/current.json"), "utf8"));
const schema = JSON.parse(readFileSync(resolve(root, "docs/status/current.schema.json"), "utf8"));

const tests = [
  ["the checked-in status and schema pass strict validation", () => {
    assert.deepEqual(validateCurrentStatus(status, schema), { valid: true, issues: [] });
  }],
  ["the implementation baseline cannot masquerade as current HEAD", () => {
    const changed = clone(status);
    changed.source.currentHead = changed.source.source_baseline_commit;
    assertInvalid(changed, schema, "source.currentHead is undeclared.");
  }],
  ["unknown top-level status fields fail closed", () => {
    const changed = clone(status);
    changed.executionAuthority = "GRANTED";
    assertInvalid(changed, schema, "$.executionAuthority is undeclared.");
  }],
  ["unknown nested risk fields fail closed", () => {
    const changed = clone(status);
    changed.riskPolicyRecord.orderAuthority = true;
    assertInvalid(changed, schema, "riskPolicyRecord.orderAuthority is undeclared.");
  }],
  ["recorded risk values cannot drift", () => {
    const changed = clone(status);
    changed.riskPolicyRecord.dailyMaximumLossCents = 2500;
    assertInvalid(changed, schema, "riskPolicyRecord.dailyMaximumLossCents must equal 2000.");
  }],
  ["TypeScript product ownership cannot be reassigned", () => {
    const changed = clone(status);
    changed.runtimeOwnership.productRuntime = "PYTHON";
    assertInvalid(changed, schema, "runtimeOwnership.productRuntime must equal \"TYPESCRIPT\".");
  }],
  ["three capital buckets preserve exact order and identity", () => {
    const changed = clone(status);
    changed.capitalArchitecture.futureBuckets.reverse();
    assertInvalid(changed, schema, "capitalArchitecture.futureBuckets must contain the exact ordered three-bucket model.");
  }],
  ["capital automation and execution authority remain prohibited", () => {
    const changed = clone(status);
    changed.capitalArchitecture.automaticTransfer = "ENABLED";
    changed.riskPolicyRecord.executionAuthority = "TRADING";
    changed.executionBoundaries.paperTrading = "OPEN";
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("capitalArchitecture.automaticTransfer must equal \"PROHIBITED\"."));
    assert(validation.issues.includes("riskPolicyRecord.executionAuthority must equal \"NONE\"."));
    assert(validation.issues.includes("executionBoundaries.paperTrading must equal \"CLOSED\"."));
  }],
  ["network authority remains closed while Phase 1A stays offline-only", () => {
    const changed = clone(status);
    changed.networkAuthority = "LIVE_READ";
    changed.phase1Status = "NOT_STARTED";
    changed.phase1Approval = "GRANTED";
    changed.ownerDailyProductEntry = "AVAILABLE";
    changed.worktreeIsolation.t3b15C5Included = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("networkAuthority must equal \"NONE\"."));
    assert(validation.issues.includes("phase1Status must equal \"IN_PROGRESS\"."));
    assert(validation.issues.includes("phase1Approval must equal \"OFFLINE_ONLY_GRANTED\"."));
    assert(validation.issues.includes("ownerDailyProductEntry must equal \"DRY_RUN_AND_FIXTURE_ONLY\"."));
    assert(validation.issues.includes("worktreeIsolation.t3b15C5Included must equal false."));
  }],
  ["object schemas must reject unknown fields", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.riskPolicyRecord.additionalProperties = true;
    assertInvalid(status, changedSchema, "schema.$defs.riskPolicyRecord object schema must reject additional properties.");
  }],
];

let passed = 0;
for (const [name, test] of tests) {
  try {
    test();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(`Current status validator: ${passed}/${tests.length} tests passed.`);

function assertInvalid(candidateStatus, candidateSchema, expectedIssue) {
  const validation = validateCurrentStatus(candidateStatus, candidateSchema);
  assert.equal(validation.valid, false);
  assert(validation.issues.includes(expectedIssue), validation.issues.join("\n"));
}

function clone(value) {
  return structuredClone(value);
}
