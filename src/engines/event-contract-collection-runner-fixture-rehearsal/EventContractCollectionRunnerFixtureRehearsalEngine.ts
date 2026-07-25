import { createHash } from "node:crypto";

import {
  COLLECTION_RUNNER_REHEARSAL_MAX_INVOCATIONS,
  COLLECTION_RUNNER_REHEARSAL_MAX_JSON_BYTES,
  COLLECTION_RUNNER_REHEARSAL_MAX_OUTBOX_RECORDS,
  COLLECTION_RUNNER_REHEARSAL_MAX_PACKAGE_BYTES,
  COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION,
  CollectionRunnerPilotState,
  CollectionRunnerRehearsalFaultScenario,
  CollectionRunnerRehearsalLifecycleState,
  CollectionRunnerRehearsalVerificationDisposition,
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerTaskState,
  EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type CollectionRunnerRehearsalEvidencePackage,
  type CollectionRunnerRehearsalEvidencePackageInput,
  type CollectionRunnerRehearsalInvocationReceipt,
  type CollectionRunnerRehearsalInvocationReceiptInput,
  type CollectionRunnerRehearsalLifecycleTransition,
  type CollectionRunnerRehearsalLifecycleTransitionInput,
  type CollectionRunnerRehearsalManifest,
  type CollectionRunnerRehearsalManifestInput,
  type CollectionRunnerRehearsalPreparationReceipt,
  type CollectionRunnerRehearsalPreparationReceiptInput,
  type CollectionRunnerRehearsalVerificationResult,
} from "../../contracts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/u;

export class CollectionRunnerRehearsalContractError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CollectionRunnerRehearsalContractError";
  }
}

function fail(code: string, message: string): never {
  throw new CollectionRunnerRehearsalContractError(code, message);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: unknown, keys: readonly string[], label: string): void {
  if (!record(value)) fail("INVALID_RECORD", `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail("UNKNOWN_FIELD", `${label} does not match the closed contract.`);
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(",")}}`;
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

function freeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function text(value: unknown, pattern: RegExp, field: string): asserts value is string {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail("INVALID_FIELD", `${field} is invalid.`);
  }
}

function fp(value: unknown, field: string): asserts value is string {
  text(value, FP, field);
}

function positiveInteger(
  value: unknown,
  maximum: number,
  field: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) {
    fail("INVALID_BOUND", `${field} is outside its reviewed bound.`);
  }
}

function enumValue<T extends Record<string, string>>(
  enumeration: T,
  value: unknown,
  field: string,
): void {
  if (!Object.values(enumeration).includes(value as string)) {
    fail("INVALID_ENUM", `${field} is invalid.`);
  }
}

const MANIFEST_KEYS = [
  "schemaVersion", "policyVersion", "scenarioId", "scenarioPurpose",
  "ownerApprovalId", "ownerApprovalFingerprint", "ownerApprovalExpiresAtUtc",
  "buildFingerprint", "runnerFingerprint", "frozenPlanFingerprint",
  "fixtureCatalogFingerprint", "fixturePackageFingerprint", "providerFingerprint",
  "mappingFingerprint", "syntheticActivationFingerprint", "syntheticTaskFingerprint",
  "runtimeConfigurationTemplateFingerprint", "expectedInvocations",
  "expectedPilotState", "expectedTaskState", "expectedOutboxRecordIds",
  "maximumInvocations", "faultScenario", "evidencePackagePolicyVersion",
  "retentionPolicyVersion", "nonAuthorityDeclaration",
] as const;

function validateManifestInput(input: CollectionRunnerRehearsalManifestInput): void {
  exact(input, MANIFEST_KEYS, "manifest");
  if (input.schemaVersion !== EVENT_CONTRACT_COLLECTION_RUNNER_FIXTURE_REHEARSAL_SCHEMA_VERSION) {
    fail("INVALID_SCHEMA_VERSION", "Unsupported rehearsal schema.");
  }
  for (const [field, value] of [
    ["policyVersion", input.policyVersion],
    ["evidencePackagePolicyVersion", input.evidencePackagePolicyVersion],
    ["retentionPolicyVersion", input.retentionPolicyVersion],
  ] as const) text(value, VERSION, field);
  text(input.scenarioId, ID, "scenarioId");
  text(input.scenarioPurpose, /^[A-Za-z0-9][A-Za-z0-9 .,()/_-]{0,199}$/u, "scenarioPurpose");
  text(input.ownerApprovalId, ID, "ownerApprovalId");
  text(input.ownerApprovalExpiresAtUtc, UTC, "ownerApprovalExpiresAtUtc");
  for (const [field, value] of Object.entries(input).filter(([key]) => key.endsWith("Fingerprint"))) {
    fp(value, field);
  }
  positiveInteger(input.maximumInvocations, COLLECTION_RUNNER_REHEARSAL_MAX_INVOCATIONS, "maximumInvocations");
  if (
    input.expectedInvocations.length < 1 ||
    input.expectedInvocations.length > input.maximumInvocations
  ) fail("INVALID_BOUND", "expectedInvocations exceed the manifest bound.");
  input.expectedInvocations.forEach((invocation, index) => {
    exact(invocation, ["ordinal", "action", "resultingTaskState"], `expectedInvocations[${index}]`);
    if (invocation.ordinal !== index + 1) fail("INVALID_ORDINAL", "Invocation ordinals must be contiguous.");
    enumValue(CollectionRunnerRuntimeAssemblyAction, invocation.action, `expectedInvocations[${index}].action`);
    enumValue(CollectionRunnerTaskState, invocation.resultingTaskState, `expectedInvocations[${index}].resultingTaskState`);
  });
  enumValue(CollectionRunnerPilotState, input.expectedPilotState, "expectedPilotState");
  enumValue(CollectionRunnerTaskState, input.expectedTaskState, "expectedTaskState");
  enumValue(CollectionRunnerRehearsalFaultScenario, input.faultScenario, "faultScenario");
  if (input.expectedOutboxRecordIds.length > COLLECTION_RUNNER_REHEARSAL_MAX_OUTBOX_RECORDS) {
    fail("INVALID_BOUND", "Expected Outbox identities exceed the reviewed bound.");
  }
  const outbox = new Set<string>();
  input.expectedOutboxRecordIds.forEach((value, index) => {
    text(value, ID, `expectedOutboxRecordIds[${index}]`);
    if (outbox.has(value)) fail("DUPLICATE_IDENTITY", "Outbox identities must be unique.");
    outbox.add(value);
  });
  if (input.nonAuthorityDeclaration !== COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION) {
    fail("INVALID_AUTHORITY", "The mandatory non-authority declaration is absent.");
  }
}

export function createCollectionRunnerRehearsalManifest(
  input: CollectionRunnerRehearsalManifestInput,
): CollectionRunnerRehearsalManifest {
  validateManifestInput(input);
  const manifestFingerprint = digest(input);
  return freeze({
    ...input,
    expectedInvocations: input.expectedInvocations.map((entry) => ({ ...entry })),
    expectedOutboxRecordIds: [...input.expectedOutboxRecordIds],
    rehearsalId: `rehearsal:${manifestFingerprint.slice(7, 31)}`,
    deterministic: true,
    fingerprint: manifestFingerprint,
  }) as CollectionRunnerRehearsalManifest;
}

export function verifyCollectionRunnerRehearsalManifest(
  manifest: CollectionRunnerRehearsalManifest,
): boolean {
  exact(manifest, [...MANIFEST_KEYS, "rehearsalId", "deterministic", "fingerprint"], "manifest");
  const { rehearsalId, deterministic, fingerprint, ...input } = manifest;
  const rebuilt = createCollectionRunnerRehearsalManifest(input);
  return deterministic === true && rehearsalId === rebuilt.rehearsalId && fingerprint === rebuilt.fingerprint;
}

const TRANSITIONS = new Map<CollectionRunnerRehearsalLifecycleState, ReadonlySet<CollectionRunnerRehearsalLifecycleState>>([
  [CollectionRunnerRehearsalLifecycleState.Planned, new Set([CollectionRunnerRehearsalLifecycleState.Prepared, CollectionRunnerRehearsalLifecycleState.PreparationBlocked])],
  [CollectionRunnerRehearsalLifecycleState.Prepared, new Set([CollectionRunnerRehearsalLifecycleState.Ready, CollectionRunnerRehearsalLifecycleState.PreparationBlocked])],
  [CollectionRunnerRehearsalLifecycleState.Ready, new Set([CollectionRunnerRehearsalLifecycleState.Stepping, CollectionRunnerRehearsalLifecycleState.Completed, CollectionRunnerRehearsalLifecycleState.FailedClosed, CollectionRunnerRehearsalLifecycleState.RecoveryRequired])],
  [CollectionRunnerRehearsalLifecycleState.Stepping, new Set([CollectionRunnerRehearsalLifecycleState.Ready, CollectionRunnerRehearsalLifecycleState.FailedClosed, CollectionRunnerRehearsalLifecycleState.RecoveryRequired])],
  [CollectionRunnerRehearsalLifecycleState.Completed, new Set([CollectionRunnerRehearsalLifecycleState.Packaged, CollectionRunnerRehearsalLifecycleState.VerificationFailed])],
  [CollectionRunnerRehearsalLifecycleState.Packaged, new Set([CollectionRunnerRehearsalLifecycleState.Verified, CollectionRunnerRehearsalLifecycleState.VerificationFailed])],
  [CollectionRunnerRehearsalLifecycleState.Verified, new Set([CollectionRunnerRehearsalLifecycleState.Archived])],
]);

export function createCollectionRunnerRehearsalLifecycleTransition(
  input: CollectionRunnerRehearsalLifecycleTransitionInput,
): CollectionRunnerRehearsalLifecycleTransition {
  exact(input, ["rehearsalId", "manifestFingerprint", "ordinal", "fromState", "fromVersion", "toState", "reasonCode"], "lifecycleTransition");
  text(input.rehearsalId, ID, "rehearsalId");
  fp(input.manifestFingerprint, "manifestFingerprint");
  positiveInteger(input.ordinal, Number.MAX_SAFE_INTEGER, "ordinal");
  positiveInteger(input.fromVersion, Number.MAX_SAFE_INTEGER, "fromVersion");
  text(input.reasonCode, CODE, "reasonCode");
  enumValue(CollectionRunnerRehearsalLifecycleState, input.fromState, "fromState");
  enumValue(CollectionRunnerRehearsalLifecycleState, input.toState, "toState");
  if (!TRANSITIONS.get(input.fromState)?.has(input.toState)) {
    fail("INVALID_TRANSITION", "The rehearsal lifecycle transition is not allowed.");
  }
  const body = { ...input, toVersion: input.fromVersion + 1, deterministic: true as const };
  return freeze({ ...body, fingerprint: digest(body) }) as CollectionRunnerRehearsalLifecycleTransition;
}

export function createCollectionRunnerRehearsalPreparationReceipt(
  manifest: CollectionRunnerRehearsalManifest,
  input: CollectionRunnerRehearsalPreparationReceiptInput,
): CollectionRunnerRehearsalPreparationReceipt {
  if (!verifyCollectionRunnerRehearsalManifest(manifest)) fail("INVALID_MANIFEST", "Manifest verification failed.");
  exact(input, ["rehearsalId", "manifestFingerprint", "fixtureCatalogEntryFingerprint", "runtimeConfigurationFingerprint", "seededStoreFingerprint", "preparationTransitionFingerprint", "workspaceIdentity", "storePathIdentity", "schemaCatalogFingerprint"], "preparationReceipt");
  if (input.rehearsalId !== manifest.rehearsalId || input.manifestFingerprint !== manifest.fingerprint) {
    fail("PREPARATION_MISMATCH", "Preparation receipt does not bind the manifest.");
  }
  for (const [field, value] of Object.entries(input).filter(([key]) => key.endsWith("Fingerprint"))) fp(value, field);
  text(input.workspaceIdentity, ID, "workspaceIdentity");
  fp(input.storePathIdentity, "storePathIdentity");
  const body = { ...input, deterministic: true as const };
  return freeze({ ...body, fingerprint: digest(body) }) as CollectionRunnerRehearsalPreparationReceipt;
}

export function createCollectionRunnerRehearsalInvocationReceipt(
  manifest: CollectionRunnerRehearsalManifest,
  input: CollectionRunnerRehearsalInvocationReceiptInput,
): CollectionRunnerRehearsalInvocationReceipt {
  if (!verifyCollectionRunnerRehearsalManifest(manifest)) fail("INVALID_MANIFEST", "Manifest verification failed.");
  exact(input, ["rehearsalId", "manifestFingerprint", "ordinal", "expectedStateVersion", "recoveryFingerprint", "selectedAction", "resultingTaskState", "outcome", "durableTransitionFingerprint", "terminalReportFingerprint", "processSessionId", "bootIdentity", "observedAtUtc", "elapsedMonotonicMilliseconds"], "invocationReceipt");
  const expected = manifest.expectedInvocations[input.ordinal - 1];
  if (
    input.rehearsalId !== manifest.rehearsalId ||
    input.manifestFingerprint !== manifest.fingerprint ||
    expected === undefined ||
    expected.action !== input.selectedAction ||
    expected.resultingTaskState !== input.resultingTaskState
  ) fail("INVOCATION_MISMATCH", "Invocation receipt does not match the frozen manifest.");
  positiveInteger(input.expectedStateVersion, Number.MAX_SAFE_INTEGER, "expectedStateVersion");
  fp(input.recoveryFingerprint, "recoveryFingerprint");
  fp(input.terminalReportFingerprint, "terminalReportFingerprint");
  if (input.durableTransitionFingerprint !== null) fp(input.durableTransitionFingerprint, "durableTransitionFingerprint");
  text(input.processSessionId, ID, "processSessionId");
  text(input.bootIdentity, ID, "bootIdentity");
  text(input.observedAtUtc, UTC, "observedAtUtc");
  if (!Number.isSafeInteger(input.elapsedMonotonicMilliseconds) || input.elapsedMonotonicMilliseconds < 0) {
    fail("INVALID_BOUND", "elapsedMonotonicMilliseconds is invalid.");
  }
  const body = { ...input, deterministic: true as const };
  return freeze({ ...body, fingerprint: digest(body) }) as CollectionRunnerRehearsalInvocationReceipt;
}

function scenarioTruth(input: CollectionRunnerRehearsalEvidencePackageInput): unknown {
  return {
    manifestFingerprint: input.manifest.fingerprint,
    fixtureCatalogEntryFingerprint: input.fixtureCatalogEntryFingerprint,
    invocations: input.invocationReceipts.map((receipt) => ({
      ordinal: receipt.ordinal,
      selectedAction: receipt.selectedAction,
      resultingTaskState: receipt.resultingTaskState,
      outcome: receipt.outcome,
      durableTransitionFingerprint: receipt.durableTransitionFingerprint,
    })),
    lifecycle: input.lifecycleTransitions.map((transition) => ({
      ordinal: transition.ordinal,
      fromState: transition.fromState,
      toState: transition.toState,
      fromVersion: transition.fromVersion,
      toVersion: transition.toVersion,
    })),
    outbox: input.outboxRecords.map(({ recordId, ordinal, fingerprint }) => ({ recordId, ordinal, fingerprint })),
    terminalSummary: input.terminalSummary,
  };
}

export function createCollectionRunnerRehearsalEvidencePackage(
  input: CollectionRunnerRehearsalEvidencePackageInput,
): CollectionRunnerRehearsalEvidencePackage {
  exact(input, ["manifest", "fixtureCatalogEntryFingerprint", "preparationReceipt", "lifecycleTransitions", "invocationReceipts", "terminalReportFingerprints", "recoveryReportFingerprints", "ownershipReceiptIds", "terminalSummary", "outboxRecords", "sqliteQuickCheckPassed", "sqliteIntegrityCheckPassed", "backupManifestFingerprint", "backupDigest", "validationSuiteFingerprint", "validationPassed", "archiveDisposition", "inventory", "packageBytesExcludingBackup", "workspaceIdentity", "storeIdentity", "packageCreatedAtUtc", "nonAuthorityDeclaration"], "evidencePackage");
  exact(input.preparationReceipt, ["rehearsalId", "manifestFingerprint", "fixtureCatalogEntryFingerprint", "runtimeConfigurationFingerprint", "seededStoreFingerprint", "preparationTransitionFingerprint", "workspaceIdentity", "storePathIdentity", "schemaCatalogFingerprint", "deterministic", "fingerprint"], "preparationReceipt");
  input.lifecycleTransitions.forEach((entry, index) => exact(entry, ["rehearsalId", "manifestFingerprint", "ordinal", "fromState", "fromVersion", "toState", "reasonCode", "toVersion", "deterministic", "fingerprint"], `lifecycleTransitions[${index}]`));
  input.invocationReceipts.forEach((entry, index) => exact(entry, ["rehearsalId", "manifestFingerprint", "ordinal", "expectedStateVersion", "recoveryFingerprint", "selectedAction", "resultingTaskState", "outcome", "durableTransitionFingerprint", "terminalReportFingerprint", "processSessionId", "bootIdentity", "observedAtUtc", "elapsedMonotonicMilliseconds", "deterministic", "fingerprint"], `invocationReceipts[${index}]`));
  exact(input.terminalSummary, ["pilotState", "taskState", "budgetFingerprint", "leaseOpen", "attemptOpen"], "terminalSummary");
  input.outboxRecords.forEach((entry, index) => exact(entry, ["recordId", "ordinal", "occurredAtUtc", "fingerprint"], `outboxRecords[${index}]`));
  input.inventory.forEach((entry, index) => exact(entry, ["relativePath", "byteLength", "digest"], `inventory[${index}]`));
  const scenarioResultFingerprint = digest(scenarioTruth(input));
  const executionPackageFingerprint = digest(input);
  const body = { ...input, scenarioResultFingerprint, executionPackageFingerprint, deterministic: true as const };
  return freeze({ ...body, fingerprint: digest(body) }) as CollectionRunnerRehearsalEvidencePackage;
}

function result(
  disposition: CollectionRunnerRehearsalVerificationDisposition,
  issueCodes: readonly string[],
  scenarioResultFingerprint: string | null,
): CollectionRunnerRehearsalVerificationResult {
  const body = { disposition, issueCodes: [...issueCodes].sort(), scenarioResultFingerprint, deterministic: true as const };
  return freeze({ ...body, fingerprint: digest(body) }) as CollectionRunnerRehearsalVerificationResult;
}

function containsForbiddenKey(value: unknown): boolean {
  const forbidden = /^(credential|secret|cookie|header|url|rawPayload|payload|account|portfolio|pnl|position|probability|recommendation|broker|order|execution)$/iu;
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (!record(value)) return false;
  return Object.entries(value).some(([key, nested]) => forbidden.test(key) || containsForbiddenKey(nested));
}

function jsonRecordWithinBound(value: unknown): boolean {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength <= COLLECTION_RUNNER_REHEARSAL_MAX_JSON_BYTES;
}

export function verifyCollectionRunnerRehearsalEvidencePackage(
  value: CollectionRunnerRehearsalEvidencePackage,
): CollectionRunnerRehearsalVerificationResult {
  try {
    if (!verifyCollectionRunnerRehearsalManifest(value.manifest)) {
      return result(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["MANIFEST_INVALID"], null);
    }
    const issues: string[] = [];
    const incomplete: string[] = [];
    const preparationBody = {
      rehearsalId: value.preparationReceipt.rehearsalId,
      manifestFingerprint: value.preparationReceipt.manifestFingerprint,
      fixtureCatalogEntryFingerprint: value.preparationReceipt.fixtureCatalogEntryFingerprint,
      runtimeConfigurationFingerprint: value.preparationReceipt.runtimeConfigurationFingerprint,
      seededStoreFingerprint: value.preparationReceipt.seededStoreFingerprint,
      preparationTransitionFingerprint: value.preparationReceipt.preparationTransitionFingerprint,
      workspaceIdentity: value.preparationReceipt.workspaceIdentity,
      storePathIdentity: value.preparationReceipt.storePathIdentity,
      schemaCatalogFingerprint: value.preparationReceipt.schemaCatalogFingerprint,
    };
    const verifiedPreparation = createCollectionRunnerRehearsalPreparationReceipt(value.manifest, preparationBody);
    if (
      value.preparationReceipt.deterministic !== true ||
      value.preparationReceipt.fingerprint !== verifiedPreparation.fingerprint ||
      value.fixtureCatalogEntryFingerprint !== value.manifest.fixtureCatalogFingerprint ||
      value.preparationReceipt.fixtureCatalogEntryFingerprint !== value.fixtureCatalogEntryFingerprint
    ) issues.push("PREPARATION_RECEIPT_MISMATCH");
    value.lifecycleTransitions.forEach((transition) => {
      const { toVersion, deterministic, fingerprint, ...transitionInput } = transition;
      const verified = createCollectionRunnerRehearsalLifecycleTransition(transitionInput);
      if (
        deterministic !== true ||
        toVersion !== verified.toVersion ||
        fingerprint !== verified.fingerprint ||
        transition.rehearsalId !== value.manifest.rehearsalId ||
        transition.manifestFingerprint !== value.manifest.fingerprint
      ) issues.push("LIFECYCLE_MISMATCH");
    });
    value.invocationReceipts.forEach((receipt) => {
      const { deterministic, fingerprint, ...receiptInput } = receipt;
      const verified = createCollectionRunnerRehearsalInvocationReceipt(value.manifest, receiptInput);
      if (deterministic !== true || fingerprint !== verified.fingerprint) issues.push("INVOCATION_FINGERPRINT_MISMATCH");
    });
    if (value.nonAuthorityDeclaration !== COLLECTION_RUNNER_REHEARSAL_NON_AUTHORITY_DECLARATION) issues.push("AUTHORITY_DECLARATION_INVALID");
    if (value.invocationReceipts.length > COLLECTION_RUNNER_REHEARSAL_MAX_INVOCATIONS || value.terminalReportFingerprints.length > COLLECTION_RUNNER_REHEARSAL_MAX_INVOCATIONS) issues.push("INVOCATION_BOUND_EXCEEDED");
    if (value.outboxRecords.length > COLLECTION_RUNNER_REHEARSAL_MAX_OUTBOX_RECORDS) issues.push("OUTBOX_BOUND_EXCEEDED");
    if (value.packageBytesExcludingBackup > COLLECTION_RUNNER_REHEARSAL_MAX_PACKAGE_BYTES) issues.push("PACKAGE_BOUND_EXCEEDED");
    if (containsForbiddenKey(value)) issues.push("EXCLUDED_DATA_PRESENT");
    const boundedRecords: readonly unknown[] = [
      value.manifest,
      value.preparationReceipt,
      ...value.lifecycleTransitions,
      ...value.invocationReceipts,
      ...value.outboxRecords,
      ...value.inventory,
      value.terminalSummary,
    ];
    if (boundedRecords.some((entry) => !jsonRecordWithinBound(entry))) issues.push("JSON_RECORD_BOUND_EXCEEDED");
    if (value.invocationReceipts.length !== value.manifest.expectedInvocations.length) incomplete.push("INVOCATIONS_INCOMPLETE");
    if (value.terminalReportFingerprints.length !== value.invocationReceipts.length) incomplete.push("TERMINAL_REPORTS_INCOMPLETE");
    if (value.inventory.length === 0) incomplete.push("INVENTORY_INCOMPLETE");
    if (value.lifecycleTransitions.length === 0) incomplete.push("LIFECYCLE_INCOMPLETE");
    value.terminalReportFingerprints.forEach((entry, index) => fp(entry, `terminalReportFingerprints[${index}]`));
    value.recoveryReportFingerprints.forEach((entry, index) => fp(entry, `recoveryReportFingerprints[${index}]`));
    fp(value.backupManifestFingerprint, "backupManifestFingerprint");
    fp(value.backupDigest, "backupDigest");
    fp(value.validationSuiteFingerprint, "validationSuiteFingerprint");
    fp(value.terminalSummary.budgetFingerprint, "budgetFingerprint");
    enumValue(CollectionRunnerPilotState, value.terminalSummary.pilotState, "terminalSummary.pilotState");
    enumValue(CollectionRunnerTaskState, value.terminalSummary.taskState, "terminalSummary.taskState");
    text(value.archiveDisposition, CODE, "archiveDisposition");
    text(value.workspaceIdentity, ID, "workspaceIdentity");
    text(value.storeIdentity, ID, "storeIdentity");
    text(value.packageCreatedAtUtc, UTC, "packageCreatedAtUtc");
    value.ownershipReceiptIds.forEach((entry, index) => text(entry, ID, `ownershipReceiptIds[${index}]`));
    const outboxIds = new Set<string>();
    value.outboxRecords.forEach((entry, index) => {
      text(entry.recordId, ID, `outboxRecords[${index}].recordId`);
      positiveInteger(entry.ordinal, COLLECTION_RUNNER_REHEARSAL_MAX_OUTBOX_RECORDS, `outboxRecords[${index}].ordinal`);
      text(entry.occurredAtUtc, UTC, `outboxRecords[${index}].occurredAtUtc`);
      fp(entry.fingerprint, `outboxRecords[${index}].fingerprint`);
      if (outboxIds.has(entry.recordId)) issues.push("OUTBOX_DUPLICATE");
      outboxIds.add(entry.recordId);
    });
    value.inventory.forEach((entry, index) => {
      text(entry.relativePath, PATH, `inventory[${index}].relativePath`);
      positiveInteger(entry.byteLength, COLLECTION_RUNNER_REHEARSAL_MAX_JSON_BYTES, `inventory[${index}].byteLength`);
      fp(entry.digest, `inventory[${index}].digest`);
    });
    if (!value.sqliteQuickCheckPassed || !value.sqliteIntegrityCheckPassed || !value.validationPassed) issues.push("VALIDATION_FAILED");
    if (value.terminalSummary.pilotState !== value.manifest.expectedPilotState || value.terminalSummary.taskState !== value.manifest.expectedTaskState || value.terminalSummary.leaseOpen || value.terminalSummary.attemptOpen) issues.push("TERMINAL_SUMMARY_MISMATCH");
    const actualOutbox = value.outboxRecords.map((entry) => entry.recordId);
    if (canonical(actualOutbox) !== canonical(value.manifest.expectedOutboxRecordIds)) issues.push("OUTBOX_MISMATCH");
    const ordinals = value.invocationReceipts.map((receipt) => receipt.ordinal);
    if (ordinals.some((ordinal, index) => ordinal !== index + 1)) issues.push("ORDINAL_MISMATCH");
    value.invocationReceipts.forEach((receipt, index) => {
      const expected = value.manifest.expectedInvocations[index];
      if (!expected || receipt.rehearsalId !== value.manifest.rehearsalId || receipt.manifestFingerprint !== value.manifest.fingerprint || receipt.selectedAction !== expected.action || receipt.resultingTaskState !== expected.resultingTaskState) issues.push("INVOCATION_MISMATCH");
    });
    const scenario = digest(scenarioTruth(value));
    if (scenario !== value.scenarioResultFingerprint) issues.push("SCENARIO_FINGERPRINT_MISMATCH");
    const { fingerprint, deterministic, scenarioResultFingerprint, executionPackageFingerprint, ...input } = value;
    const rebuilt = createCollectionRunnerRehearsalEvidencePackage(input);
    if (deterministic !== true || executionPackageFingerprint !== rebuilt.executionPackageFingerprint || fingerprint !== rebuilt.fingerprint) issues.push("PACKAGE_FINGERPRINT_MISMATCH");
    if (issues.length > 0) return result(CollectionRunnerRehearsalVerificationDisposition.FailClosed, [...new Set(issues)], scenario);
    if (incomplete.length > 0) return result(CollectionRunnerRehearsalVerificationDisposition.Incomplete, incomplete, scenario);
    return result(CollectionRunnerRehearsalVerificationDisposition.Pass, [], scenario);
  } catch {
    return result(CollectionRunnerRehearsalVerificationDisposition.FailClosed, ["MALFORMED_PACKAGE"], null);
  }
}
