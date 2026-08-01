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
  ["merged Phase 1A exposes only offline modes and keeps later authority closed", () => {
    const changed = clone(status);
    changed.networkAuthority = "LIVE_READ";
    changed.phase1Status = "IN_PROGRESS";
    changed.phase1Approval = "GRANTED";
    changed.phase1BStatus = "STARTED";
    changed.phase1BDesign.networkAuthority = "GRANTED";
    changed.phase1BDesign.credentialAccess = "ALLOWED";
    changed.phase1BDesign.marketDataAcquisition = "IMPLEMENTED";
    changed.optionsStatus = "STARTED";
    changed.brokerStatus = "STARTED";
    changed.paperTradingStatus = "STARTED";
    changed.orderExecutionStatus = "STARTED";
    changed.executionBoundaries.options = "OPEN";
    changed.ownerDailyProductEntry = "AVAILABLE";
    changed.worktreeIsolation.t3b15C5Included = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("networkAuthority must equal \"OWNER_NETWORK_AUTHORIZATION_REQUIRED\"."));
    assert(validation.issues.includes("phase1Status must equal \"MERGED\"."));
    assert(validation.issues.includes("phase1Approval must equal \"OFFLINE_AVAILABLE\"."));
    assert(validation.issues.includes("phase1BStatus must equal \"NOT_STARTED\"."));
    assert(validation.issues.includes("phase1BDesign.networkAuthority must equal \"NONE\"."));
    assert(validation.issues.includes("phase1BDesign.credentialAccess must equal \"PROHIBITED\"."));
    assert(validation.issues.includes("phase1BDesign.marketDataAcquisition must equal \"NOT_IMPLEMENTED\"."));
    assert(validation.issues.includes("optionsStatus must equal \"NOT_STARTED\"."));
    assert(validation.issues.includes("brokerStatus must equal \"NOT_STARTED\"."));
    assert(validation.issues.includes("paperTradingStatus must equal \"NOT_STARTED\"."));
    assert(validation.issues.includes("orderExecutionStatus must equal \"NOT_STARTED\"."));
    assert(validation.issues.includes("executionBoundaries.options must equal \"CLOSED\"."));
    assert(validation.issues.includes("ownerDailyProductEntry must equal \"DRY_RUN_AND_FIXTURE_ONLY\"."));
    assert(validation.issues.includes("worktreeIsolation.t3b15C5Included must equal false."));
  }],
  ["post-merge source and validation cannot drift back to a review worktree", () => {
    const changed = clone(status);
    changed.source.branch = "codex/personal-daily-scan-phase1a-c4";
    changed.source.source_baseline_commit = changed.source.reviewed_c4_commit;
    changed.currentMilestone.status = "IN_PROGRESS";
    changed.validation.phase1aWorkingTree = clone(changed.validation.headBaseline);
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("source.branch must equal \"main\"."));
    assert(validation.issues.includes(`source.source_baseline_commit must equal \"${status.source.source_baseline_commit}\".`));
    assert(validation.issues.includes("currentMilestone.status must equal \"OWNER_REVIEW_REQUIRED\"."));
    assert(validation.issues.includes("validation.phase1aWorkingTree must be null after the Phase 1A merge."));
  }],
  ["post-merge validation does not publish unaudited timing precision", () => {
    const changed = clone(status);
    changed.validation.headBaseline.durationMs = 88800;
    changed.validation.headBaseline.wallClockDurationMs = 88800;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.headBaseline.durationMs must equal null."));
    assert(validation.issues.includes("validation.headBaseline.wallClockDurationMs must equal null."));
  }],
  ["object schemas must reject unknown fields", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.riskPolicyRecord.additionalProperties = true;
    assertInvalid(status, changedSchema, "schema.$defs.riskPolicyRecord object schema must reject additional properties.");
  }],
  ["D2 working-tree validation remains uncommitted and exact", () => {
    const changed = clone(status);
    changed.validation.phase1bD2WorkingTree.includesUncommittedCode = false;
    changed.validation.phase1bD2WorkingTree.testsExecuted = 2736;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.phase1bD2WorkingTree.includesUncommittedCode must equal true."));
    assert(validation.issues.includes("validation.phase1bD2WorkingTree.testsExecuted must equal 2760."));
  }],
  ["Phase 1B D2 trust-root and no-network status cannot be widened", () => {
    const changed = clone(status);
    changed.phase1BDesign.ownerPublicKey = "caller-supplied";
    assertInvalid(changed, schema, "phase1BDesign.ownerPublicKey is undeclared.");
  }],
  ["D2-C1 records the caller-controlled trust-root blocker without granting authority", () => {
    assert(status.inProgress.includes("PHASE_1B_D2_C1_TRUST_ROOT_CORRECTION"));
    assert(status.blocked.includes("CALLER_CONTROLLED_OWNER_TRUST_ROOT"));
    assert.equal(status.phase1BDesign.status, "D2_C1_IMPLEMENTED_OFFLINE_OWNER_REVIEW_REQUIRED");
    const changed = clone(status);
    changed.phase1BDesign.trustedOwnerVerificationKey = "CALLER_RUNTIME_INPUT";
    assertInvalid(changed, schema, "phase1BDesign.trustedOwnerVerificationKey must equal \"PRODUCT_COMPOSITION_ROOT_REQUIRED_FAIL_CLOSED\".");
    const missingCorrection = clone(status);
    missingCorrection.blocked = missingCorrection.blocked.filter((item) => item !== "CALLER_CONTROLLED_OWNER_TRUST_ROOT");
    assertInvalid(missingCorrection, schema, "blocked must include \"CALLER_CONTROLLED_OWNER_TRUST_ROOT\".");
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
