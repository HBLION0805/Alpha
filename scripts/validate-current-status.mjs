import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE_COMMIT = "f565e9e5250cfd2fca5e6ed9c244b3947add7b28";
const STATUS_FIELDS = Object.freeze([
  "$schema", "schemaVersion", "statusId", "asOf", "source", "currentMilestone",
  "completed", "inProgress", "blocked", "frozen", "next", "runtimeOwnership",
  "capitalArchitecture", "riskPolicyRecord", "worktreeIsolation",
  "executionBoundaries", "ownerDailyProductEntry", "validation",
  "networkAuthority", "phase1Status", "phase1Approval", "phase1BStatus", "phase1BDesign",
  "optionsStatus", "brokerStatus", "paperTradingStatus", "orderExecutionStatus",
]);
const STATUS_ITEM = /^[A-Z0-9][A-Z0-9_:-]{2,159}$/u;

export class CurrentStatusValidationError extends Error {
  constructor(issues) {
    super(`Alpha current status is invalid:\n- ${issues.join("\n- ")}`);
    this.name = "CurrentStatusValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

export function validateCurrentStatus(status, schema) {
  const issues = [];
  validateSchema(schema, issues);
  if (!isRecord(status)) {
    issues.push("$ must be an object.");
    return result(issues);
  }

  allowOnly(status, STATUS_FIELDS, "$", issues);
  requireExactly(status, STATUS_FIELDS, "$", issues);
  exact(status.$schema, "./current.schema.json", "$schema", issues);
  exact(status.schemaVersion, "1.2", "schemaVersion", issues);
  if (typeof status.statusId !== "string" || !/^alpha-status:[A-Za-z0-9._-]+$/u.test(status.statusId)) {
    issues.push("statusId must be a bounded Alpha status identifier.");
  }
  if (!isCanonicalTimestamp(status.asOf)) issues.push("asOf must be a canonical UTC timestamp.");

  validateExactObject(status.source, "source", {
    branch: "main",
    source_baseline_commit: BASE_COMMIT,
    implementation_baseline: "PHASE_1A_STATUS_MERGE_COMMIT_NOT_D2_HEAD",
    reviewed_c4_commit: "095657cd5c72d095d9c72b2ec76a580b35e9d3c7",
  }, issues);
  validateExactObject(status.currentMilestone, "currentMilestone", {
    id: "PERSONAL_DAILY_SCAN_PHASE_1B_D2",
    name: "Authorization and Exchange Calendar Contracts",
    status: "OWNER_REVIEW_REQUIRED",
  }, issues);
  for (const field of ["completed", "inProgress", "blocked", "frozen", "next"]) {
    validateStatusItems(status[field], field, issues);
  }
  requireStatusItem(status.inProgress, "PHASE_1B_D2_C1_TRUST_ROOT_CORRECTION", "inProgress", issues);
  requireStatusItem(status.blocked, "CALLER_CONTROLLED_OWNER_TRUST_ROOT", "blocked", issues);
  requireStatusItem(status.blocked, "PHASE_1B_D2_C2_NOT_STARTED", "blocked", issues);
  requireStatusItem(status.blocked, "PHASE_1B_D2_C3_NOT_STARTED", "blocked", issues);
  requireStatusItem(status.next, "OWNER_REVIEW_PHASE_1B_D2_C1_TRUST_ROOT_CORRECTION", "next", issues);
  validateExactObject(status.runtimeOwnership, "runtimeOwnership", {
    productRuntime: "TYPESCRIPT",
    pythonRole: "RESEARCH_PROTOTYPE_AND_STATISTICAL_VALIDATION_ONLY",
    pythonDashboardStatus: "DEPRECATED_AS_PRODUCT_ENTRY_PROTOTYPE_ONLY",
    riskAuthority: "TYPESCRIPT_UNIFIED_SHORT_TERM_RISK_AUTHORITY_PLANNED",
  }, issues);
  validateCapitalArchitecture(status.capitalArchitecture, issues);
  validateRiskPolicyRecord(status.riskPolicyRecord, issues);
  validateExactObject(status.worktreeIsolation, "worktreeIsolation", {
    originalWorktree: "FROZEN",
    t3b15C5Included: false,
    alphaAuditPacketIncluded: false,
  }, issues);
  validateExactObject(status.executionBoundaries, "executionBoundaries", {
    network: "CLOSED",
    options: "CLOSED",
    broker: "CLOSED",
    paperTrading: "CLOSED",
    orderExecution: "CLOSED",
  }, issues);
  exact(status.ownerDailyProductEntry, "DRY_RUN_AND_FIXTURE_ONLY", "ownerDailyProductEntry", issues);
  validateValidation(status.validation, issues);
  exact(status.networkAuthority, "OWNER_NETWORK_AUTHORIZATION_REQUIRED", "networkAuthority", issues);
  exact(status.phase1Status, "MERGED", "phase1Status", issues);
  exact(status.phase1Approval, "OFFLINE_AVAILABLE", "phase1Approval", issues);
  exact(status.phase1BStatus, "NOT_STARTED", "phase1BStatus", issues);
  validateExactObject(status.phase1BDesign, "phase1BDesign", {
    task: "AUTHORIZATION_AND_EXCHANGE_CALENDAR_CONTRACTS",
    status: "D2_C1_IMPLEMENTED_OFFLINE_OWNER_REVIEW_REQUIRED",
    networkAuthority: "NONE",
    credentialAccess: "PROHIBITED",
    marketDataAcquisition: "NOT_IMPLEMENTED",
    trustedOwnerVerificationKey: "PRODUCT_COMPOSITION_ROOT_REQUIRED_FAIL_CLOSED",
  }, issues);
  exact(status.optionsStatus, "NOT_STARTED", "optionsStatus", issues);
  exact(status.brokerStatus, "NOT_STARTED", "brokerStatus", issues);
  exact(status.paperTradingStatus, "NOT_STARTED", "paperTradingStatus", issues);
  exact(status.orderExecutionStatus, "NOT_STARTED", "orderExecutionStatus", issues);

  return result(issues);
}

export function loadAndValidateCurrentStatus(rootDirectory) {
  const statusPath = resolve(rootDirectory, "docs/status/current.json");
  const status = JSON.parse(readFileSync(statusPath, "utf8"));
  const schemaPath = resolve(dirname(statusPath), "current.schema.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  const validation = validateCurrentStatus(status, schema);
  if (!validation.valid) throw new CurrentStatusValidationError(validation.issues);
  return Object.freeze({ status, schema, statusPath, schemaPath });
}

function validateSchema(schema, issues) {
  if (!isRecord(schema)) {
    issues.push("schema must be an object.");
    return;
  }
  exact(schema.$schema, "https://json-schema.org/draft/2020-12/schema", "schema.$schema", issues);
  exact(schema.$id, "https://alpha.local/schemas/project-status/1.2", "schema.$id", issues);
  exact(schema.type, "object", "schema.type", issues);
  exact(schema.additionalProperties, false, "schema.additionalProperties", issues);
  if (!Array.isArray(schema.required) || !sameStringSet(schema.required, STATUS_FIELDS)) {
    issues.push("schema.required must contain the exact current-status fields.");
  }
  if (!isRecord(schema.properties) || !sameStringSet(Object.keys(schema.properties), STATUS_FIELDS)) {
    issues.push("schema.properties must contain the exact current-status fields.");
  }
  inspectObjectSchemas(schema, "schema", issues);
}

function inspectObjectSchemas(value, path, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectObjectSchemas(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  if (value.type === "object" && value.additionalProperties !== false) {
    issues.push(`${path} object schema must reject additional properties.`);
  }
  for (const [key, nested] of Object.entries(value)) {
    inspectObjectSchemas(nested, `${path}.${key}`, issues);
  }
}

function validateCapitalArchitecture(value, issues) {
  if (!isRecord(value)) {
    issues.push("capitalArchitecture must be an object.");
    return;
  }
  const fields = [
    "status", "legacyField", "futureBuckets", "legacyMigration",
    "transferPolicy", "automaticAllocation", "automaticMigration",
    "automaticTransfer",
  ];
  allowOnly(value, fields, "capitalArchitecture", issues);
  requireExactly(value, fields, "capitalArchitecture", issues);
  exact(value.status, "COMPATIBILITY_ARCHITECTURE_ONLY", "capitalArchitecture.status", issues);
  exact(value.legacyField, "capital_usd", "capitalArchitecture.legacyField", issues);
  const buckets = ["OPERATING_CAPITAL", "LONG_TERM_COMPOUNDING_CAPITAL", "CASH_RESERVE"];
  if (!Array.isArray(value.futureBuckets) || JSON.stringify(value.futureBuckets) !== JSON.stringify(buckets)) {
    issues.push("capitalArchitecture.futureBuckets must contain the exact ordered three-bucket model.");
  }
  exact(value.legacyMigration, "EXPLICIT_OWNER_APPROVAL_REQUIRED", "capitalArchitecture.legacyMigration", issues);
  exact(value.transferPolicy, "NOT_DEFINED", "capitalArchitecture.transferPolicy", issues);
  exact(value.automaticAllocation, "PROHIBITED", "capitalArchitecture.automaticAllocation", issues);
  exact(value.automaticMigration, "PROHIBITED", "capitalArchitecture.automaticMigration", issues);
  exact(value.automaticTransfer, "PROHIBITED", "capitalArchitecture.automaticTransfer", issues);
}

function validateRiskPolicyRecord(value, issues) {
  const expected = {
    policyVersion: "phase0-owner-record-2026-07-29",
    status: "RECORDED_NOT_ENFORCED",
    executionAuthority: "NONE",
    currency: "USD",
    etfMaximumPlannedLossCents: 800,
    eventMaximumCostRiskCents: 500,
    dailyMaximumLossCents: 2000,
    weeklyMaximumLossCents: 4000,
    totalDrawdownPauseCents: 8000,
    initialLeveragedEtfPositionLimitBasisPoints: 1000,
    maximumConcurrentShortTermThemes: 1,
  };
  validateExactObject(value, "riskPolicyRecord", expected, issues);
}

function validateValidation(value, issues) {
  if (!isRecord(value)) {
    issues.push("validation must be an object.");
    return;
  }
  const fields = ["headBaseline", "phase1aWorkingTree", "phase1bD2WorkingTree", "coverageBaseline"];
  allowOnly(value, fields, "validation", issues);
  requireExactly(value, fields, "validation", issues);
  validateValidationResult(value.headBaseline, "PHASE_1A_MERGED_HEAD", false, "validation.headBaseline", issues);
  if (value.phase1aWorkingTree !== null) {
    issues.push("validation.phase1aWorkingTree must be null after the Phase 1A merge.");
  }
  validateValidationResult(value.phase1bD2WorkingTree, "PHASE_1B_D2_UNCOMMITTED_WORKING_TREE", true, "validation.phase1bD2WorkingTree", issues);
  if (isRecord(value.phase1bD2WorkingTree)) {
    exact(value.phase1bD2WorkingTree.componentCount, 137, "validation.phase1bD2WorkingTree.componentCount", issues);
    exact(value.phase1bD2WorkingTree.testsExecuted, 2760, "validation.phase1bD2WorkingTree.testsExecuted", issues);
    exact(value.phase1bD2WorkingTree.passed, 2760, "validation.phase1bD2WorkingTree.passed", issues);
  }
  validateCoverageBaseline(value.coverageBaseline, issues);
}

function validateValidationResult(value, kind, includesUncommittedCode, path, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  const fields = [
    "kind", "source_baseline_commit", "includesUncommittedCode", "command", "status",
    "componentCount", "testsExecuted", "passed", "failed", "durationMs",
    "wallClockDurationMs",
  ];
  allowOnly(value, fields, path, issues);
  requireExactly(value, fields, path, issues);
  exact(value.kind, kind, `${path}.kind`, issues);
  exact(value.source_baseline_commit, BASE_COMMIT, `${path}.source_baseline_commit`, issues);
  exact(value.includesUncommittedCode, includesUncommittedCode, `${path}.includesUncommittedCode`, issues);
  exact(value.command, "npm.cmd run alpha:validate", `${path}.command`, issues);
  exact(value.status, "PASSED", `${path}.status`, issues);
  for (const field of ["componentCount", "testsExecuted", "passed"]) {
    if (!Number.isSafeInteger(value[field]) || value[field] <= 0) issues.push(`${path}.${field} must be a positive integer.`);
  }
  exact(value.durationMs, null, `${path}.durationMs`, issues);
  exact(value.wallClockDurationMs, null, `${path}.wallClockDurationMs`, issues);
  exact(value.failed, 0, `${path}.failed`, issues);
  if (Number.isSafeInteger(value.testsExecuted) && Number.isSafeInteger(value.passed) && value.testsExecuted !== value.passed) {
    issues.push(`${path}.passed must equal testsExecuted when status is PASSED.`);
  }
}

function validateCoverageBaseline(value, issues) {
  if (!isRecord(value)) {
    issues.push("validation.coverageBaseline must be an object.");
    return;
  }
  const fields = ["metric", "status", "registeredTests", "instrumentedCodeCoverage"];
  allowOnly(value, fields, "validation.coverageBaseline", issues);
  requireExactly(value, fields, "validation.coverageBaseline", issues);
  exact(value.metric, "REGISTERED_VALIDATION_EXECUTION", "validation.coverageBaseline.metric", issues);
  exact(value.status, "ESTABLISHED", "validation.coverageBaseline.status", issues);
  if (!isRecord(value.registeredTests)) {
    issues.push("validation.coverageBaseline.registeredTests must be an object.");
  } else {
    const testFields = ["executed", "passed", "failed"];
    allowOnly(value.registeredTests, testFields, "validation.coverageBaseline.registeredTests", issues);
    requireExactly(value.registeredTests, testFields, "validation.coverageBaseline.registeredTests", issues);
    if (!Number.isSafeInteger(value.registeredTests.executed) || value.registeredTests.executed <= 0) {
      issues.push("validation.coverageBaseline.registeredTests.executed must be positive.");
    }
    exact(value.registeredTests.passed, value.registeredTests.executed, "validation.coverageBaseline.registeredTests.passed", issues);
    exact(value.registeredTests.failed, 0, "validation.coverageBaseline.registeredTests.failed", issues);
  }
  validateExactObject(value.instrumentedCodeCoverage, "validation.coverageBaseline.instrumentedCodeCoverage", {
    status: "NOT_AVAILABLE",
    reasonCode: "NO_REGISTERED_INSTRUMENTER_AND_V8_ENV_INCOMPATIBLE_WITH_SECURITY_DRILL",
  }, issues);
}

function validateStatusItems(value, path, issues) {
  if (!Array.isArray(value) || value.length > 32 || new Set(value).size !== value.length) {
    issues.push(`${path} must be a unique bounded array.`);
    return;
  }
  if (value.some((item) => typeof item !== "string" || !STATUS_ITEM.test(item))) {
    issues.push(`${path} contains an invalid status identifier.`);
  }
}

function requireStatusItem(value, expected, path, issues) {
  if (!Array.isArray(value) || !value.includes(expected)) {
    issues.push(`${path} must include ${JSON.stringify(expected)}.`);
  }
}

function validateExactObject(value, path, expected, issues) {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object.`);
    return;
  }
  const fields = Object.keys(expected);
  allowOnly(value, fields, path, issues);
  requireExactly(value, fields, path, issues);
  for (const [field, expectedValue] of Object.entries(expected)) {
    exact(value[field], expectedValue, `${path}.${field}`, issues);
  }
}

function allowOnly(value, allowedFields, path, issues) {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) issues.push(`${path}.${field} is undeclared.`);
  }
}

function requireExactly(value, requiredFields, path, issues) {
  for (const field of requiredFields) {
    if (!Object.hasOwn(value, field)) issues.push(`${path}.${field} is required.`);
  }
}

function exact(actual, expected, path, issues) {
  if (actual !== expected) issues.push(`${path} must equal ${JSON.stringify(expected)}.`);
}

function sameStringSet(left, right) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function isCanonicalTimestamp(value) {
  return typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(Date.parse(value)).toISOString() === value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function result(issues) {
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze([...issues].sort()),
  });
}

const isMain = process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    loadAndValidateCurrentStatus(root);
    console.log("Alpha current status validation passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
