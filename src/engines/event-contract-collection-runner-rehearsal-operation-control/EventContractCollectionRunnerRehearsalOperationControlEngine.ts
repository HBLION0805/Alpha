import { createHash } from "node:crypto";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationPreflightDisposition,
  CollectionRunnerRehearsalOperationResultDisposition,
  CollectionRunnerRehearsalOperationStopMode,
  EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerRehearsalOperationAuthorizationReceipt,
  type CollectionRunnerRehearsalOperationAuthorizationReceiptInput,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationPhaseCommand,
  type CollectionRunnerRehearsalOperationPhaseCommandInput,
  type CollectionRunnerRehearsalOperationPhaseEvidence,
  type CollectionRunnerRehearsalOperationPreflightReport,
  type CollectionRunnerRehearsalOperationReadinessObservation,
  type CollectionRunnerRehearsalOperationResultReceipt,
  type CollectionRunnerRehearsalOperationResultReceiptInput,
  type CollectionRunnerRehearsalOperationStatusReport,
  type CollectionRunnerRehearsalOperationStopReceipt,
  type CollectionRunnerRehearsalOperationValidationReceipt,
  type CollectionRunnerRehearsalOperationStopCommand,
  type CollectionRunnerRehearsalOperationStopCommandInput,
} from "../../contracts";
import type {
  CollectionRunnerLocalOwnerVerifier,
} from "../event-contract-collection-runner-recovery-control/EventContractCollectionRunnerRecoveryControlOperator";
import {
  CollectionRunnerRehearsalOperationRegistry,
} from "../event-contract-collection-runner-rehearsal-operation/EventContractCollectionRunnerRehearsalOperationEngine";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const NONCE = /^[A-Za-z0-9][A-Za-z0-9._-]{15,127}$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_AUTHORIZATION_LIFETIME_MS = 5 * 60 * 1000;

const MUTABLE_PHASES = new Set<CollectionRunnerRehearsalOperationPhase>([
  CollectionRunnerRehearsalOperationPhase.Prepare,
  CollectionRunnerRehearsalOperationPhase.Step,
  CollectionRunnerRehearsalOperationPhase.Freeze,
  CollectionRunnerRehearsalOperationPhase.Package,
  CollectionRunnerRehearsalOperationPhase.Validate,
]);

export enum CollectionRunnerRehearsalOperationControlErrorCode {
  InvalidInput = "INVALID_INPUT",
  UnknownOperation = "UNKNOWN_OPERATION",
  ManifestMismatch = "MANIFEST_MISMATCH",
  PhaseMismatch = "PHASE_MISMATCH",
  PreflightRejected = "PREFLIGHT_REJECTED",
  AuthenticationFailed = "AUTHENTICATION_FAILED",
  StopTripped = "STOP_TRIPPED",
  OwnershipFailed = "OWNERSHIP_FAILED",
  AuthorizationConflict = "AUTHORIZATION_CONFLICT",
  PhaseFailed = "PHASE_FAILED",
  ResultConflict = "RESULT_CONFLICT",
}

export class CollectionRunnerRehearsalOperationControlError extends Error {
  public constructor(
    public readonly code: CollectionRunnerRehearsalOperationControlErrorCode,
    message: string,
    options?: { readonly cause?: unknown },
  ) {
    super(message, options);
    this.name = "CollectionRunnerRehearsalOperationControlError";
  }
}

export interface CollectionRunnerRehearsalOperationControlSnapshot {
  readonly authorizationCount: number;
  readonly resultCount: number;
  readonly latestAuthorization:
    CollectionRunnerRehearsalOperationAuthorizationReceipt | null;
  readonly latestResult: CollectionRunnerRehearsalOperationResultReceipt | null;
  readonly stopReceipt: CollectionRunnerRehearsalOperationStopReceipt | null;
}

export interface CollectionRunnerRehearsalOperationControlRepository {
  readSnapshot(operationId: string):
    CollectionRunnerRehearsalOperationControlSnapshot;
  authorizeAndConsume(
    receipt: CollectionRunnerRehearsalOperationAuthorizationReceipt,
  ): CollectionRunnerRehearsalOperationAuthorizationReceipt;
  appendResult(
    receipt: CollectionRunnerRehearsalOperationResultReceipt,
  ): CollectionRunnerRehearsalOperationResultReceipt;
  appendValidationResult(
    validationReceipt: CollectionRunnerRehearsalOperationValidationReceipt,
    resultReceipt: CollectionRunnerRehearsalOperationResultReceipt,
  ): CollectionRunnerRehearsalOperationResultReceipt;
  appendStop(
    receipt: CollectionRunnerRehearsalOperationStopReceipt,
  ): CollectionRunnerRehearsalOperationStopReceipt;
}

export interface CollectionRunnerRehearsalOperationReadinessPort {
  inspect(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
  ): CollectionRunnerRehearsalOperationReadinessObservation;
}

export interface CollectionRunnerRehearsalOperationStopPort {
  assertClear(operationId: string): void;
  trip(
    operationId: string,
    mode: CollectionRunnerRehearsalOperationStopMode,
    reasonCode: string,
  ): string;
}

export interface CollectionRunnerRehearsalOperationOwnershipHandle {
  releaseClean(): void;
  preserveAmbiguity(): void;
}

export interface CollectionRunnerRehearsalOperationOwnershipPort {
  acquire(
    operationId: string,
    processSessionId: string,
    bootIdentity: string,
  ): CollectionRunnerRehearsalOperationOwnershipHandle;
}

export interface CollectionRunnerRehearsalOperationPhasePort {
  invokeOne(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt,
  ): CollectionRunnerRehearsalOperationPhaseEvidence;
}

export interface CollectionRunnerRehearsalOperationDurableTruthPort {
  observe(
    manifest: CollectionRunnerRehearsalOperationManifest,
    command: CollectionRunnerRehearsalOperationPhaseCommand,
    authorization: CollectionRunnerRehearsalOperationAuthorizationReceipt,
    claimedEvidence: CollectionRunnerRehearsalOperationPhaseEvidence,
  ): CollectionRunnerRehearsalOperationPhaseEvidence;
}

export interface CollectionRunnerRehearsalOperationValidationReceiptStagingPort {
  take(
    fingerprint: string,
  ): CollectionRunnerRehearsalOperationValidationReceipt;
}

export interface CollectionRunnerRehearsalOperationPhaseGateDependencies {
  readonly registry: CollectionRunnerRehearsalOperationRegistry;
  readonly repository: CollectionRunnerRehearsalOperationControlRepository;
  readonly readiness: CollectionRunnerRehearsalOperationReadinessPort;
  readonly verifier: CollectionRunnerLocalOwnerVerifier;
  readonly stop: CollectionRunnerRehearsalOperationStopPort;
  readonly ownership: CollectionRunnerRehearsalOperationOwnershipPort;
  readonly phase: CollectionRunnerRehearsalOperationPhasePort;
  readonly durableTruth: CollectionRunnerRehearsalOperationDurableTruthPort;
  readonly validationReceipts:
    CollectionRunnerRehearsalOperationValidationReceiptStagingPort;
}

function fail(
  code: CollectionRunnerRehearsalOperationControlErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new CollectionRunnerRehearsalOperationControlError(
    code,
    message,
    cause === undefined ? undefined : { cause },
  );
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
    .join(",")}}`;
}

function sha(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(canonical(value), "utf8")
    .digest("hex")}`;
}

function authoritySeal(
  manifest: CollectionRunnerRehearsalOperationManifest,
  command: CollectionRunnerRehearsalOperationPhaseCommand,
  observation: CollectionRunnerRehearsalOperationReadinessObservation,
  validationAuthorityFingerprint: string,
): string {
  return sha({
    commandFingerprint: command.fingerprint,
    manifestFingerprint: manifest.fingerprint,
    validationAuthorityFingerprint,
    alphaCommit: observation.alphaCommit,
    trackedTreeClean: observation.trackedTreeClean,
    packageFingerprint: observation.packageFingerprint,
    validationSuiteFingerprint: observation.validationSuiteFingerprint,
    registeredTestTotal: observation.registeredTestTotal,
    rootRegistryFingerprint: observation.rootRegistryFingerprint,
    rootsVerified: observation.rootsVerified,
    fixtureBindingsVerified: observation.fixtureBindingsVerified,
    networkCapabilityAbsent: observation.networkCapabilityAbsent,
    credentialCapabilityAbsent: observation.credentialCapabilityAbsent,
    approvalValid: observation.approvalValid,
    processStopTripped: observation.processStopTripped,
    durableStopTripped: observation.durableStopTripped,
  });
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

function exact(value: unknown, keys: readonly string[], label: string): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      `${label} must be an object.`,
    );
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      `${label} does not match the closed contract.`,
    );
  }
}

function text(value: unknown, pattern: RegExp, label: string): asserts value is string {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      `${label} is invalid.`,
    );
  }
}

function utc(value: unknown, label: string): number {
  text(value, UTC, label);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      `${label} is not canonical UTC.`,
    );
  }
  return parsed;
}

function safePositive(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      `${label} must be a positive safe integer.`,
    );
  }
}

const COMMAND_KEYS = [
  "schemaVersion", "commandId", "operationId", "manifestFingerprint", "phase",
  "expectedLifecycleVersion", "expectedInvocationOrdinal",
  "expectedRecoveryFingerprint", "alphaCommit", "rootRegistryFingerprint",
  "bootIdentity", "processSessionId", "createdAtUtc", "expiresAtUtc",
  "challengeNonce",
] as const;

export function createCollectionRunnerRehearsalOperationPhaseCommand(
  input: CollectionRunnerRehearsalOperationPhaseCommandInput,
): CollectionRunnerRehearsalOperationPhaseCommand {
  exact(input, COMMAND_KEYS, "phase command");
  if (
    input.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      "Unsupported phase-command schema.",
    );
  }
  for (const [label, value] of [
    ["commandId", input.commandId],
    ["operationId", input.operationId],
    ["bootIdentity", input.bootIdentity],
    ["processSessionId", input.processSessionId],
  ] as const) text(value, ID, label);
  text(input.challengeNonce, NONCE, "challengeNonce");
  text(input.manifestFingerprint, FP, "manifestFingerprint");
  text(input.expectedRecoveryFingerprint, FP, "expectedRecoveryFingerprint");
  text(input.rootRegistryFingerprint, FP, "rootRegistryFingerprint");
  text(input.alphaCommit, COMMIT, "alphaCommit");
  if (
    !Object.values(CollectionRunnerRehearsalOperationPhase).includes(input.phase) ||
    !MUTABLE_PHASES.has(input.phase)
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      "The phase command permits one mutable T3 phase only.",
    );
  }
  safePositive(input.expectedLifecycleVersion, "expectedLifecycleVersion");
  if (
    input.phase === CollectionRunnerRehearsalOperationPhase.Step
      ? (
        input.expectedInvocationOrdinal === null ||
        !Number.isSafeInteger(input.expectedInvocationOrdinal) ||
        input.expectedInvocationOrdinal < 1
      )
      : input.expectedInvocationOrdinal !== null
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      "Expected invocation ordinal does not match the selected phase.",
    );
  }
  const created = utc(input.createdAtUtc, "createdAtUtc");
  const expires = utc(input.expiresAtUtc, "expiresAtUtc");
  if (
    expires <= created ||
    expires - created > MAX_AUTHORIZATION_LIFETIME_MS
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      "Command lifetime exceeds the reviewed five-minute bound.",
    );
  }
  const body = structuredClone(input);
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: sha(body),
  });
}

const STOP_COMMAND_KEYS = [
  "schemaVersion", "commandId", "operationId", "manifestFingerprint",
  "alphaCommit", "rootRegistryFingerprint", "mode", "reasonCode",
  "createdAtUtc", "expiresAtUtc", "challengeNonce",
] as const;

export function createCollectionRunnerRehearsalOperationStopCommand(
  input: CollectionRunnerRehearsalOperationStopCommandInput,
): CollectionRunnerRehearsalOperationStopCommand {
  exact(input, STOP_COMMAND_KEYS, "stop command");
  if (
    input.schemaVersion !==
      EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_CONTROL_SCHEMA_VERSION
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      "Unsupported stop-command schema.",
    );
  }
  text(input.commandId, ID, "commandId");
  text(input.operationId, ID, "operationId");
  text(input.manifestFingerprint, FP, "manifestFingerprint");
  text(input.alphaCommit, COMMIT, "alphaCommit");
  text(input.rootRegistryFingerprint, FP, "rootRegistryFingerprint");
  text(input.reasonCode, /^[A-Z][A-Z0-9_]{0,63}$/u, "reasonCode");
  text(input.challengeNonce, NONCE, "challengeNonce");
  if (!Object.values(CollectionRunnerRehearsalOperationStopMode).includes(input.mode)) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      "Stop mode is invalid.",
    );
  }
  const created = utc(input.createdAtUtc, "createdAtUtc");
  const expires = utc(input.expiresAtUtc, "expiresAtUtc");
  if (
    expires <= created ||
    expires - created > MAX_AUTHORIZATION_LIFETIME_MS
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.InvalidInput,
      "Stop-command lifetime exceeds the reviewed five-minute bound.",
    );
  }
  const body = structuredClone(input);
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: sha(body),
  });
}

function phasePlanOrdinal(
  manifest: CollectionRunnerRehearsalOperationManifest,
  command: CollectionRunnerRehearsalOperationPhaseCommand,
): number {
  const entry = manifest.proposal.phasePlan.find(
    (candidate) =>
      candidate.phase === command.phase &&
      candidate.expectedStepOrdinal === command.expectedInvocationOrdinal,
  );
  if (entry === undefined) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.PhaseMismatch,
      "Selected phase and ordinal are absent from the immutable manifest.",
    );
  }
  return entry.ordinal;
}

function deduplicate(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)].sort());
}

export function createCollectionRunnerRehearsalOperationPreflightReport(
  manifest: CollectionRunnerRehearsalOperationManifest,
  command: CollectionRunnerRehearsalOperationPhaseCommand,
  observation: CollectionRunnerRehearsalOperationReadinessObservation,
  authority: {
    readonly packageFingerprint: string;
    readonly validationSuiteFingerprint: string;
    readonly registeredTestTotal: number;
  },
  control: CollectionRunnerRehearsalOperationControlSnapshot,
): CollectionRunnerRehearsalOperationPreflightReport {
  const requestedPlanOrdinal = phasePlanOrdinal(manifest, command);
  const blockers = [...observation.blockerCodes];
  const incomplete = [...observation.incompleteCodes];
  if (
    observation.operationId !== command.operationId ||
    observation.manifestFingerprint !== command.manifestFingerprint ||
    observation.alphaCommit !== command.alphaCommit ||
    observation.rootRegistryFingerprint !== command.rootRegistryFingerprint ||
    command.operationId !== manifest.operationId ||
    command.manifestFingerprint !== manifest.fingerprint ||
    command.alphaCommit !== manifest.proposal.alphaCommit ||
    command.rootRegistryFingerprint !== manifest.proposal.rootRegistryFingerprint
  ) blockers.push("IDENTITY_MISMATCH");
  if (!observation.trackedTreeClean) blockers.push("TRACKED_TREE_DIRTY");
  if (!observation.rootsVerified) blockers.push("ROOTS_UNVERIFIED");
  if (!observation.fixtureBindingsVerified) blockers.push("FIXTURE_BINDINGS_UNVERIFIED");
  if (!observation.networkCapabilityAbsent) blockers.push("NETWORK_CAPABILITY_PRESENT");
  if (!observation.credentialCapabilityAbsent) blockers.push("CREDENTIAL_CAPABILITY_PRESENT");
  if (!observation.approvalValid) blockers.push("APPROVAL_INVALID");
  if (!observation.ownershipAvailable) blockers.push("OWNERSHIP_UNAVAILABLE");
  if (observation.processStopTripped || observation.durableStopTripped) {
    blockers.push("STOP_TRIPPED");
  }
  if (observation.unresolvedClaim) blockers.push("UNRESOLVED_CLAIM");
  if (control.stopReceipt !== null) blockers.push("STOP_TRIPPED");
  if (control.authorizationCount !== control.resultCount) {
    blockers.push("OPERATION_AUTHORIZATION_UNRESOLVED");
  }
  if (
    control.latestResult !== null &&
    control.latestResult.disposition !==
      CollectionRunnerRehearsalOperationResultDisposition.Completed
  ) {
    blockers.push("PRIOR_OPERATION_RESULT_NOT_COMPLETED");
  }
  if (requestedPlanOrdinal !== control.resultCount + 1) {
    blockers.push("OPERATION_PHASE_ORDER_MISMATCH");
  }
  if (
    observation.packageFingerprint !== authority.packageFingerprint ||
    observation.validationSuiteFingerprint !== authority.validationSuiteFingerprint ||
    observation.registeredTestTotal !== authority.registeredTestTotal
  ) blockers.push("VALIDATION_AUTHORITY_MISMATCH");
  if (
    command.phase === CollectionRunnerRehearsalOperationPhase.Prepare
      ? observation.storeState !== "ABSENT"
      : observation.storeState !== "EXACT"
  ) {
    if (observation.storeState === "MISSING") incomplete.push("STORE_MISSING");
    else blockers.push("STORE_STATE_INVALID");
  }
  if (
    command.phase !== CollectionRunnerRehearsalOperationPhase.Prepare &&
    (
      observation.lifecycleVersion !== command.expectedLifecycleVersion ||
      observation.recoveryFingerprint !== command.expectedRecoveryFingerprint
    )
  ) blockers.push("DURABLE_STATE_MISMATCH");
  if (
    command.phase === CollectionRunnerRehearsalOperationPhase.Step &&
    observation.nextInvocationOrdinal !== command.expectedInvocationOrdinal
  ) blockers.push("INVOCATION_ORDINAL_MISMATCH");
  const blockerCodes = deduplicate(blockers);
  const incompleteCodes = deduplicate(incomplete);
  const disposition = blockerCodes.length > 0
    ? CollectionRunnerRehearsalOperationPreflightDisposition.Blocked
    : incompleteCodes.length > 0
      ? CollectionRunnerRehearsalOperationPreflightDisposition.Incomplete
      : CollectionRunnerRehearsalOperationPreflightDisposition.Eligible;
  const body = {
    operationId: command.operationId,
    manifestFingerprint: command.manifestFingerprint,
    requestedPhase: command.phase,
    expectedInvocationOrdinal: command.expectedInvocationOrdinal,
    disposition,
    blockerCodes,
    incompleteCodes,
    observedAtUtc: observation.observedAtUtc,
    nonAuthorityDeclaration:
      COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
    deterministic: true as const,
  };
  return freeze({ ...body, fingerprint: sha(body) });
}

function authorizationReceipt(
  input: CollectionRunnerRehearsalOperationAuthorizationReceiptInput,
): CollectionRunnerRehearsalOperationAuthorizationReceipt {
  const body = {
    ...structuredClone(input),
    consumed: true as const,
  };
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: sha(body),
  });
}

function resultReceipt(
  input: CollectionRunnerRehearsalOperationResultReceiptInput,
): CollectionRunnerRehearsalOperationResultReceipt {
  const body = structuredClone(input);
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: sha(body),
  });
}

function validatePhaseEvidence(
  evidence: CollectionRunnerRehearsalOperationPhaseEvidence,
  command: CollectionRunnerRehearsalOperationPhaseCommand,
): void {
  exact(
    evidence,
    [
      "disposition", "priorLifecycleVersion", "resultingLifecycleVersion",
      "priorLifecycleFingerprint", "resultingLifecycleFingerprint",
      "authorityEvidenceFingerprint", "sanitizedOutputDigest",
      "startedAtUtc", "completedAtUtc",
    ],
    "phase evidence",
  );
  if (
    !Object.values(CollectionRunnerRehearsalOperationResultDisposition)
      .includes(evidence.disposition)
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.PhaseFailed,
      "Phase evidence disposition is invalid.",
    );
  }
  safePositive(evidence.priorLifecycleVersion, "priorLifecycleVersion");
  safePositive(evidence.resultingLifecycleVersion, "resultingLifecycleVersion");
  for (const [label, value] of [
    ["priorLifecycleFingerprint", evidence.priorLifecycleFingerprint],
    ["resultingLifecycleFingerprint", evidence.resultingLifecycleFingerprint],
    ["authorityEvidenceFingerprint", evidence.authorityEvidenceFingerprint],
    ["sanitizedOutputDigest", evidence.sanitizedOutputDigest],
  ] as const) text(value, FP, label);
  const started = utc(evidence.startedAtUtc, "startedAtUtc");
  const completed = utc(evidence.completedAtUtc, "completedAtUtc");
  if (
    evidence.priorLifecycleVersion !== command.expectedLifecycleVersion ||
    completed < started ||
    started < Date.parse(command.createdAtUtc)
  ) {
    fail(
      CollectionRunnerRehearsalOperationControlErrorCode.PhaseFailed,
      "Phase evidence conflicts with the authorized boundary.",
    );
  }
}

export function createCollectionRunnerRehearsalOperationStatusReport(
  manifest: CollectionRunnerRehearsalOperationManifest,
  observation: CollectionRunnerRehearsalOperationReadinessObservation,
  control: CollectionRunnerRehearsalOperationControlSnapshot,
): CollectionRunnerRehearsalOperationStatusReport {
  const completedOrdinals = new Set<number>();
  if (control.latestResult !== null) {
    for (let ordinal = 1; ordinal <= control.latestResult.phasePlanOrdinal; ordinal += 1) {
      completedOrdinals.add(ordinal);
    }
  }
  const next = manifest.proposal.phasePlan.find(
    (entry) => !completedOrdinals.has(entry.ordinal),
  ) ?? null;
  const blockers = [...observation.blockerCodes];
  if (observation.processStopTripped || observation.durableStopTripped || control.stopReceipt !== null) {
    blockers.push("STOP_TRIPPED");
  }
  if (observation.unresolvedClaim) blockers.push("UNRESOLVED_CLAIM");
  if (control.authorizationCount !== control.resultCount) {
    blockers.push("OPERATION_AUTHORIZATION_UNRESOLVED");
  }
  if (
    control.latestResult !== null &&
    control.latestResult.disposition !==
      CollectionRunnerRehearsalOperationResultDisposition.Completed
  ) {
    blockers.push("PRIOR_OPERATION_RESULT_NOT_COMPLETED");
  }
  const body = {
    operationId: manifest.operationId,
    manifestFingerprint: manifest.fingerprint,
    observedAtUtc: observation.observedAtUtc,
    approvalValid: observation.approvalValid,
    approvalExpiresAtUtc: manifest.ownerApproval.expiresAtUtc,
    repositoryReady:
      observation.alphaCommit === manifest.proposal.alphaCommit &&
      observation.trackedTreeClean,
    rootsReady: observation.rootsVerified,
    storeState: observation.storeState,
    lifecycleState: observation.lifecycleState,
    lifecycleVersion: observation.lifecycleVersion,
    nextInvocationOrdinal: observation.nextInvocationOrdinal,
    recoveryRequired: observation.unresolvedClaim,
    unresolvedClaim: observation.unresolvedClaim,
    stopTripped:
      observation.processStopTripped ||
      observation.durableStopTripped ||
      control.stopReceipt !== null,
    authorizationCount: control.authorizationCount,
    resultCount: control.resultCount,
    latestAuthorizationId: control.latestAuthorization?.authorizationId ?? null,
    latestResultId: control.latestResult?.resultId ?? null,
    onlyEligibleNextPhase:
      blockers.length === 0 && observation.approvalValid ? next?.phase ?? null : null,
    blockerCodes: deduplicate(blockers),
    nonAuthorityDeclaration:
      COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
    deterministic: true as const,
  };
  return freeze({ ...body, fingerprint: sha(body) });
}

export class EventContractCollectionRunnerRehearsalOperationPhaseGate {
  public constructor(
    private readonly dependencies:
      CollectionRunnerRehearsalOperationPhaseGateDependencies,
  ) {
    if (
      dependencies.phase as unknown ===
      dependencies.durableTruth as unknown
    ) {
      throw new Error(
        "Mutation and durable-observation authorities must be independent.",
      );
    }
  }

  public preflight(
    commandValue: CollectionRunnerRehearsalOperationPhaseCommandInput,
  ): CollectionRunnerRehearsalOperationPreflightReport {
    const command =
      createCollectionRunnerRehearsalOperationPhaseCommand(commandValue);
    const manifest = this.#manifest(command);
    const authority = this.dependencies.registry.getValidationAuthority(
      manifest.proposal.validationAuthorityFingerprint,
    );
    if (authority === null) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.ManifestMismatch,
        "Registered validation authority is unavailable.",
      );
    }
    return createCollectionRunnerRehearsalOperationPreflightReport(
      manifest,
      command,
      this.dependencies.readiness.inspect(manifest, command),
      authority,
      this.dependencies.repository.readSnapshot(command.operationId),
    );
  }

  public status(
    commandValue: CollectionRunnerRehearsalOperationPhaseCommandInput,
  ): CollectionRunnerRehearsalOperationStatusReport {
    const command =
      createCollectionRunnerRehearsalOperationPhaseCommand(commandValue);
    const manifest = this.#manifest(command);
    return createCollectionRunnerRehearsalOperationStatusReport(
      manifest,
      this.dependencies.readiness.inspect(manifest, command),
      this.dependencies.repository.readSnapshot(command.operationId),
    );
  }

  public executeOne(
    commandValue: CollectionRunnerRehearsalOperationPhaseCommandInput,
    secret: string,
    invokedAtUtc: string,
  ): CollectionRunnerRehearsalOperationResultReceipt {
    const command =
      createCollectionRunnerRehearsalOperationPhaseCommand(commandValue);
    const invokedAt = utc(invokedAtUtc, "invokedAtUtc");
    if (
      invokedAt < Date.parse(command.createdAtUtc) ||
      invokedAt >= Date.parse(command.expiresAtUtc)
    ) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.AuthenticationFailed,
        "Owner authentication failed.",
      );
    }
    const manifest = this.#manifest(command);
    const preflight = this.preflight(commandValue);
    if (
      preflight.disposition !==
      CollectionRunnerRehearsalOperationPreflightDisposition.Eligible
    ) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.PreflightRejected,
        "Phase preflight is not eligible.",
      );
    }
    let ownerAuthorization: CollectionRunnerLocalOwnerAuthorizationEvidence;
    try {
      ownerAuthorization = this.dependencies.verifier.verify({
        ownerId: manifest.ownerApproval.ownerId,
        secret,
        challengeFingerprint: command.fingerprint,
        verifiedAtUtc: invokedAtUtc,
        expiresAtUtc: command.expiresAtUtc,
      });
    } catch (cause) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.AuthenticationFailed,
        "Owner authentication failed.",
        cause,
      );
    }
    this.dependencies.stop.assertClear(command.operationId);
    let ownership: CollectionRunnerRehearsalOperationOwnershipHandle;
    try {
      ownership = this.dependencies.ownership.acquire(
        command.operationId,
        command.processSessionId,
        command.bootIdentity,
      );
    } catch (cause) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.OwnershipFailed,
        "Exclusive operation ownership is unavailable.",
        cause,
      );
    }
    let authorizationCommitted = false;
    try {
      this.dependencies.stop.assertClear(command.operationId);
      const authority = this.dependencies.registry.getValidationAuthority(
        manifest.proposal.validationAuthorityFingerprint,
      );
      if (authority === null) {
        fail(
          CollectionRunnerRehearsalOperationControlErrorCode.ManifestMismatch,
          "Registered validation authority is unavailable after ownership.",
        );
      }
      const postOwnershipObservation =
        this.dependencies.readiness.inspect(manifest, command);
      const postOwnershipReport =
        createCollectionRunnerRehearsalOperationPreflightReport(
          manifest,
          command,
          {
            ...postOwnershipObservation,
            ownershipAvailable: true,
            blockerCodes: postOwnershipObservation.blockerCodes.filter(
              (code) => code !== "OWNERSHIP_UNAVAILABLE",
            ),
          },
          authority,
          this.dependencies.repository.readSnapshot(command.operationId),
        );
      if (
        postOwnershipReport.disposition !==
        CollectionRunnerRehearsalOperationPreflightDisposition.Eligible
      ) {
        fail(
          CollectionRunnerRehearsalOperationControlErrorCode.PreflightRejected,
          "Authoritative state changed after ownership acquisition.",
        );
      }
      const sealedAuthorityFingerprint = authoritySeal(
        manifest,
        command,
        postOwnershipObservation,
        authority.fingerprint,
      );
      const sealedObservation = this.dependencies.readiness.inspect(
        manifest,
        command,
      );
      const sealedReport = createCollectionRunnerRehearsalOperationPreflightReport(
        manifest,
        command,
        {
          ...sealedObservation,
          ownershipAvailable: true,
          blockerCodes: sealedObservation.blockerCodes.filter(
            (code) => code !== "OWNERSHIP_UNAVAILABLE",
          ),
        },
        authority,
        this.dependencies.repository.readSnapshot(command.operationId),
      );
      if (
        sealedReport.disposition !==
          CollectionRunnerRehearsalOperationPreflightDisposition.Eligible ||
        authoritySeal(
          manifest,
          command,
          sealedObservation,
          authority.fingerprint,
        ) !== sealedAuthorityFingerprint
      ) {
        fail(
          CollectionRunnerRehearsalOperationControlErrorCode.PreflightRejected,
          "Authority seal changed before authorization consumption.",
        );
      }
      this.dependencies.stop.assertClear(command.operationId);
      const ordinal = phasePlanOrdinal(manifest, command);
      const authorization = this.dependencies.repository.authorizeAndConsume(
        authorizationReceipt({
          authorizationId: `operation-authorization:${command.fingerprint.slice(7, 39)}`,
          commandId: command.commandId,
          commandFingerprint: command.fingerprint,
          operationId: command.operationId,
          manifestFingerprint: command.manifestFingerprint,
          phase: command.phase,
          phasePlanOrdinal: ordinal,
          expectedLifecycleVersion: command.expectedLifecycleVersion,
          expectedInvocationOrdinal: command.expectedInvocationOrdinal,
          expectedRecoveryFingerprint: command.expectedRecoveryFingerprint,
          ownerId: ownerAuthorization.ownerId,
          ownerAuthorizationReference:
            ownerAuthorization.authorizationReference,
          bootIdentity: command.bootIdentity,
          processSessionId: command.processSessionId,
          authorizedAtUtc: invokedAtUtc,
          expiresAtUtc: command.expiresAtUtc,
          consumedAtUtc: invokedAtUtc,
        }),
      );
      authorizationCommitted = true;
      this.dependencies.stop.assertClear(command.operationId);
      const claimedEvidence = this.dependencies.phase.invokeOne(
        manifest,
        command,
        authorization,
      );
      validatePhaseEvidence(claimedEvidence, command);
      const evidence = this.dependencies.durableTruth.observe(
        manifest,
        command,
        authorization,
        claimedEvidence,
      );
      validatePhaseEvidence(evidence, command);
      if (canonical(evidence) !== canonical(claimedEvidence)) {
        fail(
          CollectionRunnerRehearsalOperationControlErrorCode.PhaseFailed,
          "Independent durable truth does not match phase evidence.",
        );
      }
      const afterPhaseObservation = this.dependencies.readiness.inspect(
        manifest,
        command,
      );
      const afterPhaseSeal = authoritySeal(
        manifest,
        command,
        afterPhaseObservation,
        authority.fingerprint,
      );
      if (afterPhaseSeal !== sealedAuthorityFingerprint) {
        fail(
          CollectionRunnerRehearsalOperationControlErrorCode.PhaseFailed,
          "Authority seal changed during phase execution.",
        );
      }
      const preparedResult = resultReceipt({
          resultId: `operation-result:${authorization.fingerprint.slice(7, 39)}`,
          authorizationId: authorization.authorizationId,
          authorizationFingerprint: authorization.fingerprint,
          commandId: command.commandId,
          commandFingerprint: command.fingerprint,
          operationId: command.operationId,
          manifestFingerprint: command.manifestFingerprint,
          phase: command.phase,
          phasePlanOrdinal: ordinal,
          expectedInvocationOrdinal: command.expectedInvocationOrdinal,
          processSessionId: command.processSessionId,
          bootIdentity: command.bootIdentity,
          disposition: evidence.disposition,
          priorLifecycleVersion: evidence.priorLifecycleVersion,
          resultingLifecycleVersion: evidence.resultingLifecycleVersion,
          priorLifecycleFingerprint: evidence.priorLifecycleFingerprint,
          resultingLifecycleFingerprint: evidence.resultingLifecycleFingerprint,
          authorityEvidenceFingerprint: evidence.authorityEvidenceFingerprint,
          sanitizedOutputDigest: evidence.sanitizedOutputDigest,
          startedAtUtc: evidence.startedAtUtc,
          completedAtUtc: evidence.completedAtUtc,
          nonAuthorityDeclaration:
            COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
        });
      const result =
        command.phase === CollectionRunnerRehearsalOperationPhase.Validate
          ? this.dependencies.repository.appendValidationResult(
            this.dependencies.validationReceipts.take(
              evidence.authorityEvidenceFingerprint,
            ),
            preparedResult,
          )
          : this.dependencies.repository.appendResult(preparedResult);
      ownership.releaseClean();
      return result;
    } catch (cause) {
      if (authorizationCommitted) ownership.preserveAmbiguity();
      else ownership.releaseClean();
      if (cause instanceof CollectionRunnerRehearsalOperationControlError) {
        throw cause;
      }
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.PhaseFailed,
        authorizationCommitted
          ? "Phase outcome is ambiguous and requires explicit recovery."
          : "Phase failed before authorization.",
        cause,
      );
    }
  }

  public requestStop(
    commandValue: CollectionRunnerRehearsalOperationStopCommandInput,
    secret: string,
    invokedAtUtc: string,
  ): CollectionRunnerRehearsalOperationStopReceipt {
    const command =
      createCollectionRunnerRehearsalOperationStopCommand(commandValue);
    const invokedAt = utc(invokedAtUtc, "invokedAtUtc");
    if (
      invokedAt < Date.parse(command.createdAtUtc) ||
      invokedAt >= Date.parse(command.expiresAtUtc)
    ) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.AuthenticationFailed,
        "Owner authentication failed.",
      );
    }
    const manifest = this.dependencies.registry.getOperation(command.operationId);
    if (
      manifest === null ||
      manifest.fingerprint !== command.manifestFingerprint ||
      manifest.proposal.alphaCommit !== command.alphaCommit ||
      manifest.proposal.rootRegistryFingerprint !== command.rootRegistryFingerprint
    ) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.ManifestMismatch,
        "Stop command does not bind the exact registered manifest.",
      );
    }
    let authorization: CollectionRunnerLocalOwnerAuthorizationEvidence;
    try {
      authorization = this.dependencies.verifier.verify({
        ownerId: manifest.ownerApproval.ownerId,
        secret,
        challengeFingerprint: command.fingerprint,
        verifiedAtUtc: invokedAtUtc,
        expiresAtUtc: command.expiresAtUtc,
      });
    } catch (cause) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.AuthenticationFailed,
        "Owner authentication failed.",
        cause,
      );
    }
    const durableStopEvidence = this.dependencies.stop.trip(
      command.operationId,
      command.mode,
      command.reasonCode,
    );
    text(durableStopEvidence, FP, "durableStopEvidence");
    const body = {
      stopId: `operation-stop:${command.fingerprint.slice(7, 39)}`,
      operationId: command.operationId,
      manifestFingerprint: command.manifestFingerprint,
      commandId: command.commandId,
      commandFingerprint: command.fingerprint,
      ownerId: authorization.ownerId,
      ownerAuthorizationReference: authorization.authorizationReference,
      mode: command.mode,
      reasonCode: command.reasonCode,
      requestedAtUtc: invokedAtUtc,
    };
    return this.dependencies.repository.appendStop(
      freeze({
        ...body,
        deterministic: true as const,
        fingerprint: sha(body),
      }),
    );
  }

  #manifest(
    command: CollectionRunnerRehearsalOperationPhaseCommand,
  ): CollectionRunnerRehearsalOperationManifest {
    const manifest = this.dependencies.registry.getOperation(command.operationId);
    if (manifest === null) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.UnknownOperation,
        "Operation is not registered.",
      );
    }
    if (
      manifest.fingerprint !== command.manifestFingerprint ||
      manifest.proposal.alphaCommit !== command.alphaCommit ||
      manifest.proposal.rootRegistryFingerprint !==
        command.rootRegistryFingerprint
    ) {
      fail(
        CollectionRunnerRehearsalOperationControlErrorCode.ManifestMismatch,
        "Command does not bind the exact registered manifest.",
      );
    }
    phasePlanOrdinal(manifest, command);
    return manifest;
  }
}
