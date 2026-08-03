import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PHASE_1A_MERGE_COMMIT = "f565e9e5250cfd2fca5e6ed9c244b3947add7b28";
const PHASE_1B_D2_MERGE_COMMIT = "948192be9eb7d9d5e41abb19e763b73916dbcad4";
const PHASE_1B_D3A_MERGE_COMMIT = "bae51dda65dc55f376cb683f873fa93295ed7e2f";
const PHASE_1B_D3B_DESIGN_MERGE_COMMIT = "14b5a5aac5157f3284368608a84c890606fc5496";
const STATUS_FIELDS = Object.freeze([
  "$schema", "schemaVersion", "statusId", "asOf", "source", "currentMilestone",
  "completed", "inProgress", "blocked", "frozen", "next", "runtimeOwnership",
  "capitalArchitecture", "riskPolicyRecord", "worktreeIsolation",
  "executionBoundaries", "automatedExecutionAllowed", "ownerDailyProductEntry", "validation",
  "networkAuthority", "phase1Status", "phase1Approval", "phase1BStatus", "phase1BDelivery", "phase1BDesign",
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
  if (isRecord(schema)) validateJsonSchemaInstance(status, schema, schema, "$", issues);

  allowOnly(status, STATUS_FIELDS, "$", issues);
  requireExactly(status, STATUS_FIELDS, "$", issues);
  exact(status.$schema, "./current.schema.json", "$schema", issues);
  exact(status.schemaVersion, "1.7", "schemaVersion", issues);
  if (typeof status.statusId !== "string" || !/^alpha-status:[A-Za-z0-9._-]+$/u.test(status.statusId)) {
    issues.push("statusId must be a bounded Alpha status identifier.");
  }
  if (!isCanonicalTimestamp(status.asOf)) issues.push("asOf must be a canonical UTC timestamp.");

  validateExactObject(status.source, "source", {
    branch: "codex/d3b-post-merge-design-status",
    source_baseline_commit: PHASE_1B_D3B_DESIGN_MERGE_COMMIT,
    implementation_baseline: "D3B_POST_MERGE_DESIGN_STATUS_SOURCE_BASELINE_NOT_STATUS_COMMIT_HEAD",
    reviewed_c4_commit: "095657cd5c72d095d9c72b2ec76a580b35e9d3c7",
  }, issues);
  validateExactObject(status.currentMilestone, "currentMilestone", {
    id: "PERSONAL_DAILY_SCAN_PHASE_1B_D3B_IMPLEMENTATION",
    name: "Alpaca Bars Limit Live-Readonly Qualification Protocol Implementation",
    status: "OWNER_APPROVAL_REQUIRED",
  }, issues);
  for (const field of ["completed", "inProgress", "blocked", "frozen", "next"]) {
    validateStatusItems(status[field], field, issues);
  }
  requireStatusItem(status.completed, "PHASE_1B_D2_C1_TRUST_ROOT_CORRECTION", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D1_DESIGN_COMPLETED", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D2_C2_R2_TRUSTED_COMPOSITION_RAW_TRANSPORT_AND_REGISTRY_BINDING", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D3A_OFFLINE_IMPLEMENTATION_MERGED", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D3A_POST_MERGE_CORRECTION_VERIFIED", "completed", issues);
  requireStatusItem(status.completed, "PHASE_1B_D3B_DESIGN_APPROVED_MERGED", "completed", issues);
  requireStatusItem(status.blocked, "PROVIDER_LIMIT_SEMANTICS_UNPROVEN", "blocked", issues);
  requireStatusItem(status.blocked, "PHASE_1B_D2_C3_NOT_STARTED", "blocked", issues);
  if (!Array.isArray(status.inProgress) || status.inProgress.length !== 0) {
    issues.push("inProgress must be empty while D3B implementation awaits Owner approval.");
  }
  requireStatusItem(status.blocked, "PHASE_1B_D3A_REAL_REQUEST_NOT_AUTHORIZED", "blocked", issues);
  requireStatusItem(status.blocked, "PHASE_1B_D3B_IMPLEMENTATION_OWNER_APPROVAL_REQUIRED", "blocked", issues);
  requireStatusItem(status.blocked, "PHASE_1B_D3B_LIVE_RUN_NOT_AUTHORIZED", "blocked", issues);
  requireStatusItem(status.next, "D3B_IMPLEMENTATION_OWNER_APPROVAL_REQUIRED", "next", issues);
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
  exact(status.automatedExecutionAllowed, false, "automatedExecutionAllowed", issues);
  exact(status.ownerDailyProductEntry, "DRY_RUN_AND_FIXTURE_ONLY", "ownerDailyProductEntry", issues);
  validateValidation(status.validation, issues);
  exact(status.networkAuthority, "NOT_GRANTED", "networkAuthority", issues);
  exact(status.phase1Status, "MERGED", "phase1Status", issues);
  exact(status.phase1Approval, "CLOSED", "phase1Approval", issues);
  exact(status.phase1BStatus, "D3A_MERGED_CLOSED_D3B_DESIGN_APPROVED", "phase1BStatus", issues);
  validateExactObject(status.phase1BDelivery, "phase1BDelivery", {
    d1: "DESIGN_COMPLETED",
    d2C1: "MERGED",
    d2C2R2: "MERGED_OFFLINE_ONLY",
    d2C3: "NOT_STARTED",
    d3A: "MERGED_CLOSED",
    d3APostMergeCorrection: "VERIFIED",
    d3B: "DESIGN_APPROVED",
    d3BImplementation: "NOT_STARTED",
    d3BLiveRun: "NOT_AUTHORIZED",
    newsMacro: "NOT_STARTED",
    providerLimitSemantics: "UNPROVEN",
    fiveRequest43Evidence: "STRUCTURAL_TARGET_ONLY",
    realHttpsAcquisition: "NOT_IMPLEMENTED",
    liveNetworkAuthorization: "NOT_GRANTED",
  }, issues);
  validateExactObject(status.phase1BDesign, "phase1BDesign", {
    task: "ALPACA_BARS_LIMIT_LIVE_READONLY_QUALIFICATION_PROTOCOL",
    status: "D3B_DESIGN_APPROVED_IMPLEMENTATION_NOT_STARTED_LIVE_RUN_NOT_AUTHORIZED",
    networkAuthority: "NOT_GRANTED",
    credentialAccess: "PROHIBITED",
    persistenceWrites: 0,
    marketDataAcquisition: "D3B_IMPLEMENTATION_NOT_STARTED",
    trustedOwnerVerificationKey: "PRODUCT_COMPOSITION_ROOT_REQUIRED_FAIL_CLOSED",
    marketScopePolicy: "EXACT_3_QUALIFICATION_REQUESTS_DESIGN_ONLY",
    providerLimitSemantics: "UNPROVEN_FAIL_CLOSED_BEFORE_TRANSPORT",
    compositionRoot: "PRODUCT_FIXED_NO_ARGUMENT_ENTRY_TEST_TRANSPORT_SEPARATE",
    designCommit: "0a8d8668b95c0756d91477f9aa3c7b805bf9ce2b",
    designPullRequest: "MERGED_CLOSED",
    mergeCommit: PHASE_1B_D3B_DESIGN_MERGE_COMMIT,
    mergeTimestamp: "2026-08-02T23:34:45.000Z",
    designApproval: "APPROVED_SEPARATE_FROM_NETWORK_AUTHORIZATION",
    implementationStatus: "NOT_STARTED",
    liveRunStatus: "NOT_AUTHORIZED",
  }, issues);
  exact(status.optionsStatus, "CLOSED", "optionsStatus", issues);
  exact(status.brokerStatus, "CLOSED", "brokerStatus", issues);
  exact(status.paperTradingStatus, "CLOSED", "paperTradingStatus", issues);
  exact(status.orderExecutionStatus, "CLOSED", "orderExecutionStatus", issues);

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
  exact(schema.$id, "https://alpha.local/schemas/project-status/1.7", "schema.$id", issues);
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

function validateJsonSchemaInstance(value, schemaNode, rootSchema, path, issues) {
  if (!isRecord(schemaNode)) {
    issues.push(`${path} schema node must be an object.`);
    return;
  }
  if (typeof schemaNode.$ref === "string") {
    const resolved = resolveLocalSchemaReference(rootSchema, schemaNode.$ref);
    if (resolved === undefined) issues.push(`${path} schema reference ${schemaNode.$ref} cannot be resolved.`);
    else validateJsonSchemaInstance(value, resolved, rootSchema, path, issues);
    return;
  }
  if (Array.isArray(schemaNode.oneOf)) {
    const matches = schemaNode.oneOf.filter((candidate) => {
      const candidateIssues = [];
      validateJsonSchemaInstance(value, candidate, rootSchema, path, candidateIssues);
      return candidateIssues.length === 0;
    });
    if (matches.length !== 1) issues.push(`${path} must match exactly one schema alternative.`);
    return;
  }
  if (Object.hasOwn(schemaNode, "const") && !deepEqual(value, schemaNode.const)) {
    issues.push(`${path} must equal schema const ${JSON.stringify(schemaNode.const)}.`);
  }
  if (Array.isArray(schemaNode.enum) && !schemaNode.enum.some((entry) => deepEqual(value, entry))) {
    issues.push(`${path} must equal one of the schema enum values.`);
  }
  if (schemaNode.type !== undefined && !matchesSchemaType(value, schemaNode.type)) {
    issues.push(`${path} does not match schema type ${JSON.stringify(schemaNode.type)}.`);
    return;
  }
  if (typeof value === "string") {
    if (Number.isSafeInteger(schemaNode.minLength) && value.length < schemaNode.minLength) issues.push(`${path} is shorter than schema minLength.`);
    if (Number.isSafeInteger(schemaNode.maxLength) && value.length > schemaNode.maxLength) issues.push(`${path} is longer than schema maxLength.`);
    if (typeof schemaNode.pattern === "string" && !new RegExp(schemaNode.pattern, "u").test(value)) issues.push(`${path} does not match schema pattern.`);
  }
  if (typeof value === "number" && typeof schemaNode.minimum === "number" && value < schemaNode.minimum) {
    issues.push(`${path} is below schema minimum.`);
  }
  if (Array.isArray(value)) validateJsonSchemaArray(value, schemaNode, rootSchema, path, issues);
  if (isRecord(value)) validateJsonSchemaObject(value, schemaNode, rootSchema, path, issues);
}

function validateJsonSchemaObject(value, schemaNode, rootSchema, path, issues) {
  const required = Array.isArray(schemaNode.required) ? schemaNode.required : [];
  for (const field of required) if (typeof field === "string" && !Object.hasOwn(value, field)) issues.push(`${path}.${field} is required by schema.`);
  const properties = isRecord(schemaNode.properties) ? schemaNode.properties : {};
  if (schemaNode.additionalProperties === false) {
    for (const field of Object.keys(value)) if (!Object.hasOwn(properties, field)) issues.push(`${path}.${field} is not allowed by schema.`);
  }
  for (const [field, childSchema] of Object.entries(properties)) {
    if (Object.hasOwn(value, field)) validateJsonSchemaInstance(value[field], childSchema, rootSchema, `${path}.${field}`, issues);
  }
}

function validateJsonSchemaArray(value, schemaNode, rootSchema, path, issues) {
  if (Number.isSafeInteger(schemaNode.minItems) && value.length < schemaNode.minItems) issues.push(`${path} has fewer items than schema minItems.`);
  if (Number.isSafeInteger(schemaNode.maxItems) && value.length > schemaNode.maxItems) issues.push(`${path} has more items than schema maxItems.`);
  if (schemaNode.uniqueItems === true && new Set(value.map((entry) => JSON.stringify(entry))).size !== value.length) issues.push(`${path} must contain unique items.`);
  const prefix = Array.isArray(schemaNode.prefixItems) ? schemaNode.prefixItems : [];
  prefix.forEach((childSchema, index) => {
    if (index < value.length) validateJsonSchemaInstance(value[index], childSchema, rootSchema, `${path}[${index}]`, issues);
  });
  if (schemaNode.items === false && value.length > prefix.length) issues.push(`${path} contains items forbidden by schema.`);
  else if (isRecord(schemaNode.items)) {
    for (let index = prefix.length; index < value.length; index += 1) {
      validateJsonSchemaInstance(value[index], schemaNode.items, rootSchema, `${path}[${index}]`, issues);
    }
  }
}

function resolveLocalSchemaReference(rootSchema, reference) {
  if (!reference.startsWith("#/")) return undefined;
  let current = rootSchema;
  for (const rawPart of reference.slice(2).split("/")) {
    const part = rawPart.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isRecord(current) || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return isRecord(current) ? current : undefined;
}

function matchesSchemaType(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => type === "null" ? value === null
    : type === "object" ? isRecord(value)
    : type === "array" ? Array.isArray(value)
    : type === "integer" ? Number.isSafeInteger(value)
    : type === "number" ? typeof value === "number" && Number.isFinite(value)
    : type === "string" ? typeof value === "string"
    : type === "boolean" ? typeof value === "boolean"
    : false);
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  const fields = ["phase1aMergedHead", "phase1bD2MergedHead", "phase1bD3AMergedHead", "phase1bD3BDesignMergedHead", "coverageBaseline"];
  allowOnly(value, fields, "validation", issues);
  requireExactly(value, fields, "validation", issues);
  validateValidationResult(value.phase1aMergedHead, "PHASE_1A_MERGED_HEAD", false, "validation.phase1aMergedHead", issues, PHASE_1A_MERGE_COMMIT);
  validateValidationResult(value.phase1bD2MergedHead, "PHASE_1B_D2_MERGED_HEAD", false, "validation.phase1bD2MergedHead", issues, PHASE_1B_D2_MERGE_COMMIT);
  if (isRecord(value.phase1bD2MergedHead)) {
    exact(value.phase1bD2MergedHead.componentCount, 138, "validation.phase1bD2MergedHead.componentCount", issues);
    exact(value.phase1bD2MergedHead.testsExecuted, 2792, "validation.phase1bD2MergedHead.testsExecuted", issues);
    exact(value.phase1bD2MergedHead.passed, 2792, "validation.phase1bD2MergedHead.passed", issues);
  }
  validateValidationResult(value.phase1bD3AMergedHead, "PHASE_1B_D3A_MERGED_HEAD", false, "validation.phase1bD3AMergedHead", issues, PHASE_1B_D3A_MERGE_COMMIT);
  if (isRecord(value.phase1bD3AMergedHead)) {
    exact(value.phase1bD3AMergedHead.componentCount, 139, "validation.phase1bD3AMergedHead.componentCount", issues);
    exact(value.phase1bD3AMergedHead.testsExecuted, 2814, "validation.phase1bD3AMergedHead.testsExecuted", issues);
    exact(value.phase1bD3AMergedHead.passed, 2814, "validation.phase1bD3AMergedHead.passed", issues);
  }
  validateValidationResult(value.phase1bD3BDesignMergedHead, "PHASE_1B_D3B_DESIGN_MERGED_HEAD", false, "validation.phase1bD3BDesignMergedHead", issues, PHASE_1B_D3B_DESIGN_MERGE_COMMIT);
  if (isRecord(value.phase1bD3BDesignMergedHead)) {
    exact(value.phase1bD3BDesignMergedHead.componentCount, 140, "validation.phase1bD3BDesignMergedHead.componentCount", issues);
    exact(value.phase1bD3BDesignMergedHead.testsExecuted, 2833, "validation.phase1bD3BDesignMergedHead.testsExecuted", issues);
    exact(value.phase1bD3BDesignMergedHead.passed, 2833, "validation.phase1bD3BDesignMergedHead.passed", issues);
  }
  validateCoverageBaseline(value.coverageBaseline, issues);
}

function validateValidationResult(value, kind, includesUncommittedCode, path, issues, sourceBaselineCommit = PHASE_1A_MERGE_COMMIT) {
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
  exact(value.source_baseline_commit, sourceBaselineCommit, `${path}.source_baseline_commit`, issues);
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
