import {
  COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE,
  DurableFixtureRehearsalFailureDisposition,
  DurableFixtureRehearsalLifecycleState,
  DurableFixtureRehearsalPhase,
  EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION,
  type DurableFixtureRehearsalEvidencePlan,
  type DurableFixtureRehearsalEvidencePlanInput,
  type DurableFixtureRehearsalFailureReceipt,
  type DurableFixtureRehearsalFailureReceiptInput,
  type DurableFixtureRehearsalInvocationReceipt,
  type DurableFixtureRehearsalInvocationReceiptInput,
  type DurableFixtureRehearsalOperationClaim,
  type DurableFixtureRehearsalOperationClaimInput,
  type DurableFixtureRehearsalRegistry,
  type DurableFixtureRehearsalRegistryInput,
  type DurableFixtureRehearsalSnapshot,
  type DurableFixtureRehearsalTransition,
  type DurableFixtureRehearsalTransitionInput,
  type DurableFixtureRehearsalVerificationResult,
} from "../../contracts";
import {
  CollectionRunnerPilotState,
  CollectionRunnerTaskState,
} from "../../contracts/EventContractCollectionRunner";
import {
  CollectionRunnerRuntimeAssemblyAction,
  CollectionRunnerRuntimeStepOutcome,
} from "../../contracts/EventContractCollectionRunnerRuntimeAssembly";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

export enum DurableFixtureRehearsalContractErrorCode {
  InvalidRecord = "INVALID_RECORD",
  InvalidTransition = "INVALID_TRANSITION",
  InvalidAuthority = "INVALID_AUTHORITY",
}

export class DurableFixtureRehearsalContractError extends Error {
  public constructor(
    public readonly code: DurableFixtureRehearsalContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DurableFixtureRehearsalContractError";
  }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function fingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonical(value))}`;
}

function freeze<T>(value: T): Readonly<T> {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function fail(
  code: DurableFixtureRehearsalContractErrorCode,
  message: string,
): never {
  throw new DurableFixtureRehearsalContractError(code, message);
}

function exact(value: unknown, keys: readonly string[], label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, `${label} does not match the closed contract.`);
}

function validUtc(value: string): boolean {
  if (!UTC.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function assertId(value: string, label: string): void {
  if (!ID.test(value)) fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, `${label} is invalid.`);
}

function assertFingerprint(value: string | null, label: string): void {
  if (value !== null && !FP.test(value)) {
    fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, `${label} is invalid.`);
  }
}

function assertPositive(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, `${label} must be a positive safe integer.`);
  }
}

function seal<T extends object>(body: T): Readonly<T & { deterministic: true; fingerprint: string }> {
  const deterministic = { ...body, deterministic: true as const };
  return freeze({ ...deterministic, fingerprint: fingerprint(deterministic) });
}

const TRANSITIONS: Readonly<Record<DurableFixtureRehearsalLifecycleState, readonly DurableFixtureRehearsalLifecycleState[]>> =
  Object.freeze({
    [DurableFixtureRehearsalLifecycleState.Planned]: [
      DurableFixtureRehearsalLifecycleState.Preparing,
    ],
    [DurableFixtureRehearsalLifecycleState.Preparing]: [
      DurableFixtureRehearsalLifecycleState.Prepared,
      DurableFixtureRehearsalLifecycleState.PreparationBlocked,
    ],
    [DurableFixtureRehearsalLifecycleState.Prepared]: [
      DurableFixtureRehearsalLifecycleState.Ready,
    ],
    [DurableFixtureRehearsalLifecycleState.Ready]: [
      DurableFixtureRehearsalLifecycleState.Stepping,
      DurableFixtureRehearsalLifecycleState.Completed,
      DurableFixtureRehearsalLifecycleState.FailedClosed,
      DurableFixtureRehearsalLifecycleState.RecoveryRequired,
    ],
    [DurableFixtureRehearsalLifecycleState.Stepping]: [
      DurableFixtureRehearsalLifecycleState.Ready,
      DurableFixtureRehearsalLifecycleState.Completed,
      DurableFixtureRehearsalLifecycleState.FailedClosed,
      DurableFixtureRehearsalLifecycleState.RecoveryRequired,
    ],
    [DurableFixtureRehearsalLifecycleState.Completed]: [
      DurableFixtureRehearsalLifecycleState.Validated,
      DurableFixtureRehearsalLifecycleState.VerificationFailed,
      DurableFixtureRehearsalLifecycleState.Incomplete,
    ],
    [DurableFixtureRehearsalLifecycleState.Validated]: [
      DurableFixtureRehearsalLifecycleState.EvidenceFrozen,
      DurableFixtureRehearsalLifecycleState.VerificationFailed,
      DurableFixtureRehearsalLifecycleState.Incomplete,
    ],
    [DurableFixtureRehearsalLifecycleState.EvidenceFrozen]: [],
    [DurableFixtureRehearsalLifecycleState.PreparationBlocked]: [],
    [DurableFixtureRehearsalLifecycleState.FailedClosed]: [],
    [DurableFixtureRehearsalLifecycleState.RecoveryRequired]: [],
    [DurableFixtureRehearsalLifecycleState.VerificationFailed]: [],
    [DurableFixtureRehearsalLifecycleState.Incomplete]: [],
  });

export function createDurableFixtureRehearsalRegistry(
  input: DurableFixtureRehearsalRegistryInput,
): DurableFixtureRehearsalRegistry {
  exact(input, [
    "schemaVersion", "rehearsalId", "manifestFingerprint", "buildFingerprint",
    "runnerFingerprint", "frozenPlanFingerprint", "catalogFingerprint",
    "providerFingerprint", "mappingFingerprint", "activationId",
    "taskSetFingerprint", "workspaceIdentity", "storeIdentity",
    "lifecycleState", "lifecycleVersion", "nextInvocationOrdinal",
    "recoveryFingerprint", "maximumInvocations", "scenarioResultFingerprint",
    "executionPackageFingerprint", "nonAuthorityDeclaration", "createdAtUtc",
  ], "durable rehearsal registry");
  if (
    input.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_DURABLE_FIXTURE_REHEARSAL_SCHEMA_VERSION ||
    !Object.values(DurableFixtureRehearsalLifecycleState).includes(input.lifecycleState) ||
    !validUtc(input.createdAtUtc) ||
    input.nonAuthorityDeclaration.trim() === ""
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, "Durable rehearsal registry is invalid.");
  for (const [label, value] of [
    ["rehearsalId", input.rehearsalId],
    ["activationId", input.activationId],
    ["workspaceIdentity", input.workspaceIdentity],
    ["storeIdentity", input.storeIdentity],
  ] as const) assertId(value, label);
  for (const [label, value] of [
    ["manifestFingerprint", input.manifestFingerprint],
    ["buildFingerprint", input.buildFingerprint],
    ["runnerFingerprint", input.runnerFingerprint],
    ["frozenPlanFingerprint", input.frozenPlanFingerprint],
    ["catalogFingerprint", input.catalogFingerprint],
    ["providerFingerprint", input.providerFingerprint],
    ["mappingFingerprint", input.mappingFingerprint],
    ["taskSetFingerprint", input.taskSetFingerprint],
    ["recoveryFingerprint", input.recoveryFingerprint],
  ] as const) assertFingerprint(value, label);
  assertFingerprint(input.scenarioResultFingerprint, "scenarioResultFingerprint");
  assertFingerprint(input.executionPackageFingerprint, "executionPackageFingerprint");
  assertPositive(input.lifecycleVersion, "lifecycleVersion");
  assertPositive(input.nextInvocationOrdinal, "nextInvocationOrdinal");
  assertPositive(input.maximumInvocations, "maximumInvocations");
  if (
    input.maximumInvocations > 16 ||
    input.nextInvocationOrdinal > input.maximumInvocations + 1
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, "Durable rehearsal invocation bounds are invalid.");
  return seal({
    ...structuredClone(input),
    schemaProfile: COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE,
  }) as DurableFixtureRehearsalRegistry;
}

export function createDurableFixtureRehearsalTransition(
  input: DurableFixtureRehearsalTransitionInput,
): DurableFixtureRehearsalTransition {
  exact(input, [
    "transitionId", "rehearsalId", "manifestFingerprint", "ordinal",
    "fromState", "fromVersion", "toState", "reasonCode", "occurredAtUtc",
  ], "durable rehearsal transition");
  assertId(input.transitionId, "transitionId");
  assertId(input.rehearsalId, "rehearsalId");
  assertFingerprint(input.manifestFingerprint, "manifestFingerprint");
  if (
    !Number.isSafeInteger(input.ordinal) ||
    input.ordinal < 0 ||
    !Object.values(DurableFixtureRehearsalLifecycleState).includes(input.fromState) ||
    !Object.values(DurableFixtureRehearsalLifecycleState).includes(input.toState) ||
    !TRANSITIONS[input.fromState].includes(input.toState) ||
    !VERSION.test(input.reasonCode) ||
    !validUtc(input.occurredAtUtc)
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidTransition, "Durable rehearsal transition is invalid.");
  assertPositive(input.fromVersion, "fromVersion");
  return seal({
    ...structuredClone(input),
    toVersion: input.fromVersion + 1,
  }) as DurableFixtureRehearsalTransition;
}

export function createDurableFixtureRehearsalOperationClaim(
  input: DurableFixtureRehearsalOperationClaimInput,
): DurableFixtureRehearsalOperationClaim {
  exact(input, [
    "claimId", "rehearsalId", "manifestFingerprint", "phase",
    "invocationOrdinal", "expectedLifecycleVersion",
    "expectedRecoveryFingerprint", "requestFingerprint", "processSessionId",
    "bootIdentity", "ownerAuthorizationId", "claimedAtUtc",
  ], "durable rehearsal operation claim");
  for (const [label, value] of [
    ["claimId", input.claimId],
    ["rehearsalId", input.rehearsalId],
    ["processSessionId", input.processSessionId],
    ["bootIdentity", input.bootIdentity],
  ] as const) assertId(value, label);
  if (input.ownerAuthorizationId !== null) assertId(input.ownerAuthorizationId, "ownerAuthorizationId");
  assertFingerprint(input.manifestFingerprint, "manifestFingerprint");
  assertFingerprint(input.expectedRecoveryFingerprint, "expectedRecoveryFingerprint");
  assertFingerprint(input.requestFingerprint, "requestFingerprint");
  assertPositive(input.expectedLifecycleVersion, "expectedLifecycleVersion");
  if (
    !Object.values(DurableFixtureRehearsalPhase).includes(input.phase) ||
    !validUtc(input.claimedAtUtc) ||
    (input.phase === DurableFixtureRehearsalPhase.Step) !==
      (input.invocationOrdinal !== null) ||
    (input.invocationOrdinal !== null &&
      (!Number.isSafeInteger(input.invocationOrdinal) ||
        input.invocationOrdinal < 1)) ||
    (input.phase === DurableFixtureRehearsalPhase.Recover) !==
      (input.ownerAuthorizationId !== null)
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidAuthority, "Durable rehearsal claim authority is invalid.");
  return seal(structuredClone(input)) as DurableFixtureRehearsalOperationClaim;
}

export function createDurableFixtureRehearsalInvocationReceipt(
  input: DurableFixtureRehearsalInvocationReceiptInput,
): DurableFixtureRehearsalInvocationReceipt {
  exact(input, [
    "receiptId", "claimId", "rehearsalId", "manifestFingerprint",
    "invocationOrdinal", "selectedAction", "resultingPilotState",
    "resultingTaskState", "outcome", "terminalReportFingerprint",
    "durableTransitionFingerprint", "outboxChronologyFingerprint",
    "recoveryFingerprint", "observedAtUtc",
  ], "durable rehearsal invocation receipt");
  for (const [label, value] of [
    ["receiptId", input.receiptId],
    ["claimId", input.claimId],
    ["rehearsalId", input.rehearsalId],
  ] as const) assertId(value, label);
  for (const [label, value] of [
    ["manifestFingerprint", input.manifestFingerprint],
    ["terminalReportFingerprint", input.terminalReportFingerprint],
    ["outboxChronologyFingerprint", input.outboxChronologyFingerprint],
    ["recoveryFingerprint", input.recoveryFingerprint],
  ] as const) assertFingerprint(value, label);
  assertFingerprint(input.durableTransitionFingerprint, "durableTransitionFingerprint");
  assertPositive(input.invocationOrdinal, "invocationOrdinal");
  if (
    !Object.values(CollectionRunnerRuntimeAssemblyAction).includes(input.selectedAction) ||
    !Object.values(CollectionRunnerPilotState).includes(input.resultingPilotState) ||
    !Object.values(CollectionRunnerTaskState).includes(input.resultingTaskState) ||
    !Object.values(CollectionRunnerRuntimeStepOutcome).includes(input.outcome) ||
    !validUtc(input.observedAtUtc)
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, "Durable rehearsal invocation receipt is invalid.");
  return seal(structuredClone(input)) as DurableFixtureRehearsalInvocationReceipt;
}

export function createDurableFixtureRehearsalFailureReceipt(
  input: DurableFixtureRehearsalFailureReceiptInput,
): DurableFixtureRehearsalFailureReceipt {
  exact(input, [
    "failureId", "claimId", "rehearsalId", "manifestFingerprint", "phase",
    "disposition", "reasonCode", "terminalReportFingerprint",
    "observedRecoveryFingerprint", "occurredAtUtc",
  ], "durable rehearsal failure receipt");
  for (const [label, value] of [
    ["failureId", input.failureId],
    ["claimId", input.claimId],
    ["rehearsalId", input.rehearsalId],
  ] as const) assertId(value, label);
  assertFingerprint(input.manifestFingerprint, "manifestFingerprint");
  assertFingerprint(input.terminalReportFingerprint, "terminalReportFingerprint");
  assertFingerprint(input.observedRecoveryFingerprint, "observedRecoveryFingerprint");
  if (
    !Object.values(DurableFixtureRehearsalPhase).includes(input.phase) ||
    !Object.values(DurableFixtureRehearsalFailureDisposition).includes(input.disposition) ||
    !VERSION.test(input.reasonCode) ||
    !validUtc(input.occurredAtUtc)
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, "Durable rehearsal failure receipt is invalid.");
  return seal(structuredClone(input)) as DurableFixtureRehearsalFailureReceipt;
}

export function createDurableFixtureRehearsalEvidencePlan(
  input: DurableFixtureRehearsalEvidencePlanInput,
): DurableFixtureRehearsalEvidencePlan {
  exact(input, [
    "evidencePlanId", "freezeClaimId", "rehearsalId", "manifestFingerprint",
    "validationReceiptFingerprint", "validationSuiteFingerprint",
    "plannedBackupId", "plannedPackageId", "plannedEnvelopeId",
    "retentionPolicyVersion", "terminalFreezeFingerprint",
    "nonAuthorityDeclaration", "frozenAtUtc",
  ], "durable rehearsal evidence plan");
  for (const [label, value] of [
    ["evidencePlanId", input.evidencePlanId],
    ["freezeClaimId", input.freezeClaimId],
    ["rehearsalId", input.rehearsalId],
    ["plannedBackupId", input.plannedBackupId],
    ["plannedPackageId", input.plannedPackageId],
    ["plannedEnvelopeId", input.plannedEnvelopeId],
  ] as const) assertId(value, label);
  for (const [label, value] of [
    ["manifestFingerprint", input.manifestFingerprint],
    ["validationReceiptFingerprint", input.validationReceiptFingerprint],
    ["validationSuiteFingerprint", input.validationSuiteFingerprint],
    ["terminalFreezeFingerprint", input.terminalFreezeFingerprint],
  ] as const) assertFingerprint(value, label);
  if (
    !VERSION.test(input.retentionPolicyVersion) ||
    input.nonAuthorityDeclaration.trim() === "" ||
    !validUtc(input.frozenAtUtc)
  ) fail(DurableFixtureRehearsalContractErrorCode.InvalidRecord, "Durable rehearsal evidence plan is invalid.");
  return seal(structuredClone(input)) as DurableFixtureRehearsalEvidencePlan;
}

function verifyRecord<T extends { readonly deterministic: true; readonly fingerprint: string }>(
  value: T,
  create: (input: never) => T,
): boolean {
  try {
    const { deterministic, fingerprint: stored, ...input } = value;
    return deterministic === true &&
      create(input as never).fingerprint === stored;
  } catch {
    return false;
  }
}

export function verifyDurableFixtureRehearsalSnapshot(
  snapshot: DurableFixtureRehearsalSnapshot,
): DurableFixtureRehearsalVerificationResult {
  const issues: string[] = [];
  let registry: DurableFixtureRehearsalRegistry | null = null;
  try {
    exact(snapshot, [
      "registry", "transitions", "claims", "invocationReceipts",
      "failureReceipts", "evidencePlan",
    ], "durable rehearsal snapshot");
    const { deterministic: _deterministic, fingerprint: _fingerprint, schemaProfile, ...input } =
      snapshot.registry;
    if (schemaProfile !== COLLECTION_RUNNER_FIXTURE_REHEARSAL_SQLITE_SCHEMA_PROFILE) {
      issues.push("SCHEMA_PROFILE_MISMATCH");
    }
    registry = createDurableFixtureRehearsalRegistry(input);
    if (registry.fingerprint !== snapshot.registry.fingerprint) {
      issues.push("REGISTRY_FINGERPRINT_MISMATCH");
    }
  } catch {
    issues.push("REGISTRY_INVALID");
  }
  if (registry === null) return verificationResult(issues, null, null, null);

  const transitions = [...snapshot.transitions].sort((left, right) => left.toVersion - right.toVersion);
  let state = DurableFixtureRehearsalLifecycleState.Planned;
  let version = 1;
  for (const transition of transitions) {
    const {
      deterministic: transitionDeterministic,
      fingerprint: transitionFingerprint,
      toVersion,
      ...transitionInput
    } = transition;
    let validTransition = false;
    try {
      const rebuilt = createDurableFixtureRehearsalTransition(transitionInput);
      validTransition =
        transitionDeterministic === true &&
        rebuilt.toVersion === toVersion &&
        rebuilt.fingerprint === transitionFingerprint;
    } catch {
      validTransition = false;
    }
    if (!validTransition) {
      issues.push("TRANSITION_INVALID");
      continue;
    }
    if (
      transition.rehearsalId !== registry.rehearsalId ||
      transition.manifestFingerprint !== registry.manifestFingerprint ||
      transition.fromState !== state ||
      transition.fromVersion !== version
    ) {
      issues.push("TRANSITION_HISTORY_MISMATCH");
      continue;
    }
    state = transition.toState;
    version = transition.toVersion;
  }
  if (state !== registry.lifecycleState || version !== registry.lifecycleVersion) {
    issues.push("REGISTRY_PROJECTION_MISMATCH");
  }

  const claimsById = new Map<string, DurableFixtureRehearsalOperationClaim>();
  const claimVersions = new Set<number>();
  for (const claim of snapshot.claims) {
    if (!verifyRecord(claim, createDurableFixtureRehearsalOperationClaim as never)) {
      issues.push("CLAIM_INVALID");
      continue;
    }
    if (
      claim.rehearsalId !== registry.rehearsalId ||
      claim.manifestFingerprint !== registry.manifestFingerprint ||
      claimsById.has(claim.claimId) ||
      claimVersions.has(claim.expectedLifecycleVersion)
    ) issues.push("CLAIM_BINDING_MISMATCH");
    claimsById.set(claim.claimId, claim);
    claimVersions.add(claim.expectedLifecycleVersion);
  }

  const settledClaims = new Set<string>();
  const receiptOrdinals = new Set<number>();
  for (const receipt of snapshot.invocationReceipts) {
    if (!verifyRecord(receipt, createDurableFixtureRehearsalInvocationReceipt as never)) {
      issues.push("INVOCATION_RECEIPT_INVALID");
      continue;
    }
    const claim = claimsById.get(receipt.claimId);
    if (
      claim === undefined ||
      claim.phase !== DurableFixtureRehearsalPhase.Step ||
      claim.invocationOrdinal !== receipt.invocationOrdinal ||
      receipt.rehearsalId !== registry.rehearsalId ||
      receipt.manifestFingerprint !== registry.manifestFingerprint ||
      settledClaims.has(receipt.claimId) ||
      receiptOrdinals.has(receipt.invocationOrdinal)
    ) issues.push("INVOCATION_RECEIPT_BINDING_MISMATCH");
    settledClaims.add(receipt.claimId);
    receiptOrdinals.add(receipt.invocationOrdinal);
  }
  const orderedOrdinals = [...receiptOrdinals].sort((left, right) => left - right);
  if (orderedOrdinals.some((ordinal, index) => ordinal !== index + 1)) {
    issues.push("INVOCATION_ORDINAL_GAP");
  }

  for (const failure of snapshot.failureReceipts) {
    if (!verifyRecord(failure, createDurableFixtureRehearsalFailureReceipt as never)) {
      issues.push("FAILURE_RECEIPT_INVALID");
      continue;
    }
    const claim = claimsById.get(failure.claimId);
    if (
      claim === undefined ||
      claim.phase !== failure.phase ||
      failure.rehearsalId !== registry.rehearsalId ||
      failure.manifestFingerprint !== registry.manifestFingerprint ||
      settledClaims.has(failure.claimId)
    ) issues.push("FAILURE_RECEIPT_BINDING_MISMATCH");
    settledClaims.add(failure.claimId);
  }
  if (snapshot.evidencePlan !== null) {
    const freezeClaim = claimsById.get(snapshot.evidencePlan.freezeClaimId);
    if (
      freezeClaim === undefined ||
      freezeClaim.phase !== DurableFixtureRehearsalPhase.Freeze ||
      settledClaims.has(freezeClaim.claimId)
    ) {
      issues.push("EVIDENCE_PLAN_CLAIM_MISMATCH");
    } else {
      settledClaims.add(freezeClaim.claimId);
    }
  }

  const unresolved = [...claimsById.keys()].filter((id) => !settledClaims.has(id));
  const unresolvedClaims = unresolved
    .map((id) => claimsById.get(id))
    .filter((claim): claim is DurableFixtureRehearsalOperationClaim =>
      claim !== undefined);
  const unresolvedStepping =
    registry.lifecycleState === DurableFixtureRehearsalLifecycleState.Stepping &&
    (
      (
        unresolvedClaims.length === 1 &&
        unresolvedClaims[0]!.phase === DurableFixtureRehearsalPhase.Step
      ) ||
      (
        unresolvedClaims.length === 2 &&
        unresolvedClaims.filter(
          ({ phase }) => phase === DurableFixtureRehearsalPhase.Step,
        ).length === 1 &&
        unresolvedClaims.filter(
          ({ phase }) => phase === DurableFixtureRehearsalPhase.Recover,
        ).length === 1
      )
    );
  if (unresolvedClaims.length > 0 && !unresolvedStepping) {
    issues.push("UNRESOLVED_CLAIM_MISMATCH");
  }
  const nextOrdinal = orderedOrdinals.length + 1;
  if (registry.nextInvocationOrdinal !== nextOrdinal) {
    issues.push("NEXT_INVOCATION_ORDINAL_MISMATCH");
  }

  if (snapshot.evidencePlan === null) {
    if (registry.lifecycleState === DurableFixtureRehearsalLifecycleState.EvidenceFrozen) {
      issues.push("EVIDENCE_PLAN_MISSING");
    }
  } else if (
    !verifyRecord(snapshot.evidencePlan, createDurableFixtureRehearsalEvidencePlan as never) ||
    snapshot.evidencePlan.rehearsalId !== registry.rehearsalId ||
    snapshot.evidencePlan.manifestFingerprint !== registry.manifestFingerprint ||
    registry.lifecycleState !== DurableFixtureRehearsalLifecycleState.EvidenceFrozen
  ) issues.push("EVIDENCE_PLAN_MISMATCH");

  return verificationResult(issues, state, version, nextOrdinal);
}

function verificationResult(
  issues: readonly string[],
  state: DurableFixtureRehearsalLifecycleState | null,
  version: number | null,
  nextOrdinal: number | null,
): DurableFixtureRehearsalVerificationResult {
  const body = {
    valid: issues.length === 0,
    issueCodes: [...new Set(issues)].sort(),
    reconstructedLifecycleState: state,
    reconstructedLifecycleVersion: version,
    nextInvocationOrdinal: nextOrdinal,
    deterministic: true as const,
  };
  return freeze({ ...body, fingerprint: fingerprint(body) });
}
