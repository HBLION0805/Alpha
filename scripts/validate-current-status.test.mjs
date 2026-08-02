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
    changed.automatedExecutionAllowed = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("capitalArchitecture.automaticTransfer must equal \"PROHIBITED\"."));
    assert(validation.issues.includes("riskPolicyRecord.executionAuthority must equal \"NONE\"."));
    assert(validation.issues.includes("executionBoundaries.paperTrading must equal \"CLOSED\"."));
    assert(validation.issues.includes("automatedExecutionAllowed must equal false."));
  }],
  ["merged Phase 1A and offline D2 keep live and execution authority closed", () => {
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
    assert(validation.issues.includes("networkAuthority must equal \"NOT_GRANTED\"."));
    assert(validation.issues.includes("phase1Status must equal \"MERGED\"."));
    assert(validation.issues.includes("phase1Approval must equal \"CLOSED\"."));
    assert(validation.issues.includes("phase1BStatus must equal \"D3A_OFFLINE_IMPLEMENTED_OWNER_REVIEW_REQUIRED\"."));
    assert(validation.issues.includes("phase1BDesign.networkAuthority must equal \"NOT_GRANTED\"."));
    assert(validation.issues.includes("phase1BDesign.credentialAccess must equal \"PROHIBITED\"."));
    assert(validation.issues.includes("phase1BDesign.marketDataAcquisition must equal \"QUALIFICATION_RAW_HTTPS_TRANSPORT_IMPLEMENTED_NOT_EXECUTED\"."));
    assert(validation.issues.includes("optionsStatus must equal \"CLOSED\"."));
    assert(validation.issues.includes("brokerStatus must equal \"CLOSED\"."));
    assert(validation.issues.includes("paperTradingStatus must equal \"CLOSED\"."));
    assert(validation.issues.includes("orderExecutionStatus must equal \"CLOSED\"."));
    assert(validation.issues.includes("executionBoundaries.options must equal \"CLOSED\"."));
    assert(validation.issues.includes("ownerDailyProductEntry must equal \"DRY_RUN_AND_FIXTURE_ONLY\"."));
    assert(validation.issues.includes("worktreeIsolation.t3b15C5Included must equal false."));
  }],
  ["D3A review source and validation cannot drift to another worktree", () => {
    const changed = clone(status);
    changed.source.branch = "codex/personal-daily-scan-phase1a-c4";
    changed.source.source_baseline_commit = changed.source.reviewed_c4_commit;
    changed.currentMilestone.status = "IN_PROGRESS";
    changed.validation.phase1bD2MergedHead.includesUncommittedCode = true;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("source.branch must equal \"codex/phase1b-d3a-alpaca-bars-limit-qualification\"."));
    assert(validation.issues.includes(`source.source_baseline_commit must equal \"${status.source.source_baseline_commit}\".`));
    assert(validation.issues.includes("currentMilestone.status must equal \"OFFLINE_IMPLEMENTED_OWNER_REVIEW_REQUIRED\"."));
    assert(validation.issues.includes("validation.phase1bD2MergedHead.includesUncommittedCode must equal false."));
  }],
  ["post-merge validation does not publish unaudited timing precision", () => {
    const changed = clone(status);
    changed.validation.phase1aMergedHead.durationMs = 88800;
    changed.validation.phase1aMergedHead.wallClockDurationMs = 88800;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.phase1aMergedHead.durationMs must equal null."));
    assert(validation.issues.includes("validation.phase1aMergedHead.wallClockDurationMs must equal null."));
  }],
  ["object schemas must reject unknown fields", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.riskPolicyRecord.additionalProperties = true;
    assertInvalid(status, changedSchema, "schema.$defs.riskPolicyRecord object schema must reject additional properties.");
  }],
  ["the declared JSON Schema baseline const is executed against current status", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.phase1bD2ValidationResult.properties.source_baseline_commit.const = "0000000000000000000000000000000000000000";
    assertInvalid(status, changedSchema, "$.validation.phase1bD2MergedHead.source_baseline_commit must equal schema const \"0000000000000000000000000000000000000000\".");
  }],
  ["the declared JSON Schema registered-test const is executed", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.phase1bD2ValidationResult.properties.testsExecuted.const = 1;
    assertInvalid(status, changedSchema, "$.validation.phase1bD2MergedHead.testsExecuted must equal schema const 1.");
  }],
  ["the declared JSON Schema phase-state const is executed", () => {
    const changedSchema = clone(schema);
    changedSchema.$defs.phase1BDesign.properties.status.const = "D2_COMPLETED";
    assertInvalid(status, changedSchema, "$.phase1BDesign.status must equal schema const \"D2_COMPLETED\".");
  }],
  ["the declared JSON Schema additionalProperties gate rejects unknown status fields", () => {
    const changed = clone(status);
    changed.phase1BDesign.ownerPublicKey = "caller-supplied";
    assertInvalid(changed, schema, "$.phase1BDesign.ownerPublicKey is not allowed by schema.");
  }],
  ["D2 merged-head validation remains committed and exact", () => {
    const changed = clone(status);
    changed.validation.phase1bD2MergedHead.includesUncommittedCode = true;
    changed.validation.phase1bD2MergedHead.testsExecuted = 2736;
    const validation = validateCurrentStatus(changed, schema);
    assert.equal(validation.valid, false);
    assert(validation.issues.includes("validation.phase1bD2MergedHead.includesUncommittedCode must equal false."));
    assert(validation.issues.includes("validation.phase1bD2MergedHead.testsExecuted must equal 2792."));
  }],
  ["Phase 1B D2 trust-root and no-network status cannot be widened", () => {
    const changed = clone(status);
    changed.phase1BDesign.ownerPublicKey = "caller-supplied";
    assertInvalid(changed, schema, "phase1BDesign.ownerPublicKey is undeclared.");
  }],
  ["D3A records offline qualification without granting Provider or network authority", () => {
    assert(status.completed.includes("PHASE_1B_D2_C1_TRUST_ROOT_CORRECTION"));
    assert(status.completed.includes("PHASE_1B_D1_DESIGN_COMPLETED"));
    assert(status.completed.includes("PHASE_1B_D2_C2_R2_TRUSTED_COMPOSITION_RAW_TRANSPORT_AND_REGISTRY_BINDING"));
    assert(status.blocked.includes("PROVIDER_LIMIT_SEMANTICS_UNPROVEN"));
    assert.equal(status.phase1BDelivery.d1, "DESIGN_COMPLETED");
    assert.equal(status.phase1BDelivery.d2C1, "MERGED");
    assert.equal(status.phase1BDelivery.d2C2R2, "MERGED_OFFLINE_ONLY");
    assert.equal(status.phase1BDelivery.d3A, "OFFLINE_IMPLEMENTED_OWNER_REVIEW_REQUIRED");
    assert.equal(status.phase1BDelivery.liveNetworkAuthorization, "NOT_GRANTED");
    assert.equal(status.phase1BDesign.status, "D3A_OFFLINE_IMPLEMENTED_OWNER_REVIEW_REQUIRED");
    assert.equal(status.phase1BDesign.marketScopePolicy, "EXACT_5_REQUESTS_43_EVIDENCE_STRUCTURAL_TARGET_ONLY");
    assert.equal(status.phase1BDesign.providerLimitSemantics, "UNPROVEN_FAIL_CLOSED_BEFORE_TRANSPORT");
    assert.equal(status.phase1BDesign.compositionRoot, "PRODUCT_FIXED_OWNER_VERIFIER_EXACT_ONE_REQUEST_VALIDATOR_AND_PRODUCT_OWNED_RAW_TRANSPORT");
    const changed = clone(status);
    changed.phase1BDesign.trustedOwnerVerificationKey = "CALLER_RUNTIME_INPUT";
    assertInvalid(changed, schema, "phase1BDesign.trustedOwnerVerificationKey must equal \"PRODUCT_COMPOSITION_ROOT_REQUIRED_FAIL_CLOSED\".");
    const missingCorrection = clone(status);
    missingCorrection.blocked = missingCorrection.blocked.filter((item) => item !== "PROVIDER_LIMIT_SEMANTICS_UNPROVEN");
    assertInvalid(missingCorrection, schema, "blocked must include \"PROVIDER_LIMIT_SEMANTICS_UNPROVEN\".");
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
