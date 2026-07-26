import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";

import {
  COLLECTION_RUNNER_REHEARSAL_OPERATION_COMMAND_IDENTITY,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_MAX_PHASES,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_MAX_RECOVERIES,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION,
  COLLECTION_RUNNER_REHEARSAL_OPERATION_REQUIRED_ROOT_COUNT,
  CollectionRunnerRehearsalOperationPhase,
  CollectionRunnerRehearsalOperationRootCreationPolicy,
  CollectionRunnerRehearsalOperationRootPurpose,
  EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION,
  type CollectionRunnerRehearsalFixtureCatalogEntry,
  type CollectionRunnerRehearsalOperationManifest,
  type CollectionRunnerRehearsalOperationManifestProposal,
  type CollectionRunnerRehearsalOperationManifestProposalInput,
  type CollectionRunnerRehearsalOperationOwnerApproval,
  type CollectionRunnerRehearsalOperationOwnerApprovalInput,
  type CollectionRunnerRehearsalOperationRegistryInput,
  type CollectionRunnerRehearsalOperationRegistrySnapshot,
  type CollectionRunnerRehearsalOperationRootRegistration,
  type CollectionRunnerRehearsalOperationRootRegistrationInput,
  type CollectionRunnerRehearsalOperationRootRegistry,
  type CollectionRunnerRehearsalOperationRootRegistryInput,
  type CollectionRunnerRehearsalOperationValidationAuthority,
  type CollectionRunnerRehearsalOperationValidationAuthorityInput,
} from "../../contracts";
import { createCollectionRunnerRehearsalFixtureCatalogEntry } from "../event-contract-collection-runner-fixture-rehearsal/EventContractCollectionRunnerFixtureRehearsalPreparation";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FP = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const COMMIT = /^[0-9a-f]{40}$/u;

export class CollectionRunnerRehearsalOperationContractError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CollectionRunnerRehearsalOperationContractError";
  }
}

function fail(code: string, message: string): never {
  throw new CollectionRunnerRehearsalOperationContractError(code, message);
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

function timestamp(value: unknown, field: string): number {
  text(value, UTC, field);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail("INVALID_TIMESTAMP", `${field} is invalid.`);
  return parsed;
}

function fingerprint(value: unknown, field: string): asserts value is string {
  text(value, FP, field);
}

function positiveInteger(value: unknown, maximum: number, field: string): asserts value is number {
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

function assertSchema(value: unknown): void {
  if (value !== EVENT_CONTRACT_COLLECTION_RUNNER_REHEARSAL_OPERATION_SCHEMA_VERSION) {
    fail("INVALID_SCHEMA_VERSION", "Unsupported rehearsal operation schema.");
  }
}

const ROOT_KEYS = [
  "schemaVersion", "rootId", "purpose", "canonicalPath", "pathIdentity",
  "filesystemIdentityFingerprint", "inspectionEvidenceFingerprint",
  "inspectedAtUtc", "creationPolicy", "linkOrReparsePointDetected",
] as const;

export function createCollectionRunnerRehearsalOperationRootRegistration(
  input: CollectionRunnerRehearsalOperationRootRegistrationInput,
): CollectionRunnerRehearsalOperationRootRegistration {
  exact(input, ROOT_KEYS, "root registration");
  assertSchema(input.schemaVersion);
  text(input.rootId, ID, "rootId");
  enumValue(CollectionRunnerRehearsalOperationRootPurpose, input.purpose, "purpose");
  enumValue(
    CollectionRunnerRehearsalOperationRootCreationPolicy,
    input.creationPolicy,
    "creationPolicy",
  );
  if (
    input.purpose === CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository
      ? input.creationPolicy !== CollectionRunnerRehearsalOperationRootCreationPolicy.ExistingReadOnlyRepository
      : input.creationPolicy !== CollectionRunnerRehearsalOperationRootCreationPolicy.ExistingRegisteredRoot
  ) {
    fail("INVALID_ROOT_POLICY", "Root purpose and creation policy disagree.");
  }
  if (
    typeof input.canonicalPath !== "string" ||
    resolve(input.canonicalPath) !== input.canonicalPath ||
    input.canonicalPath.includes("\0") ||
    /(?:^|[\\/])\.\.(?:[\\/]|$)/u.test(input.canonicalPath)
  ) {
    fail("INVALID_PATH", "canonicalPath must be an absolute normalized path.");
  }
  text(input.pathIdentity, ID, "pathIdentity");
  fingerprint(input.filesystemIdentityFingerprint, "filesystemIdentityFingerprint");
  fingerprint(input.inspectionEvidenceFingerprint, "inspectionEvidenceFingerprint");
  timestamp(input.inspectedAtUtc, "inspectedAtUtc");
  if (input.linkOrReparsePointDetected !== false) {
    fail("UNSAFE_ROOT", "Link or reparse-point roots are forbidden.");
  }
  const body = structuredClone(input);
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: digest(body),
  }) as CollectionRunnerRehearsalOperationRootRegistration;
}

function pathContains(parent: string, child: string): boolean {
  const canonicalParent = `${resolve(parent).toLocaleLowerCase()}${sep}`;
  return resolve(child).toLocaleLowerCase().startsWith(canonicalParent);
}

export function createCollectionRunnerRehearsalOperationRootRegistry(
  input: CollectionRunnerRehearsalOperationRootRegistryInput,
): CollectionRunnerRehearsalOperationRootRegistry {
  exact(input, ["schemaVersion", "policyVersion", "registrations"], "root registry");
  assertSchema(input.schemaVersion);
  text(input.policyVersion, VERSION, "policyVersion");
  if (
    input.registrations.length !==
    COLLECTION_RUNNER_REHEARSAL_OPERATION_REQUIRED_ROOT_COUNT
  ) {
    fail("INVALID_ROOT_SET", "The exact reviewed root set is required.");
  }
  const registrations = input.registrations.map((entry) => {
    const source = entry as CollectionRunnerRehearsalOperationRootRegistration;
    return createCollectionRunnerRehearsalOperationRootRegistration({
      schemaVersion: source.schemaVersion,
      rootId: source.rootId,
      purpose: source.purpose,
      canonicalPath: source.canonicalPath,
      pathIdentity: source.pathIdentity,
      filesystemIdentityFingerprint: source.filesystemIdentityFingerprint,
      inspectionEvidenceFingerprint: source.inspectionEvidenceFingerprint,
      inspectedAtUtc: source.inspectedAtUtc,
      creationPolicy: source.creationPolicy,
      linkOrReparsePointDetected: source.linkOrReparsePointDetected,
    });
  });
  const purposes = new Set<string>();
  const rootIds = new Set<string>();
  const paths = new Set<string>();
  for (const entry of registrations) {
    const folded = entry.canonicalPath.toLocaleLowerCase();
    if (
      purposes.has(entry.purpose) ||
      rootIds.has(entry.rootId) ||
      paths.has(folded)
    ) {
      fail("DUPLICATE_ROOT", "Root purposes, IDs, and paths must be unique.");
    }
    purposes.add(entry.purpose);
    rootIds.add(entry.rootId);
    paths.add(folded);
  }
  for (const purpose of Object.values(CollectionRunnerRehearsalOperationRootPurpose)) {
    if (!purposes.has(purpose)) fail("INVALID_ROOT_SET", `Missing ${purpose}.`);
  }
  for (let left = 0; left < registrations.length; left += 1) {
    for (let right = left + 1; right < registrations.length; right += 1) {
      const a = registrations[left]!;
      const b = registrations[right]!;
      if (pathContains(a.canonicalPath, b.canonicalPath) || pathContains(b.canonicalPath, a.canonicalPath)) {
        fail("OVERLAPPING_ROOT", "Registered roots must be pairwise disjoint.");
      }
    }
  }
  const ordered = [...registrations].sort((left, right) =>
    left.purpose.localeCompare(right.purpose),
  );
  const body = {
    schemaVersion: input.schemaVersion,
    policyVersion: input.policyVersion,
    registrations: ordered,
  };
  const resultBody = {
    ...body,
    rootRegistryId: `rehearsal-root-registry:${digest(body).slice(7, 39)}`,
    deterministic: true as const,
  };
  return freeze({
    ...resultBody,
    fingerprint: digest(resultBody),
  }) as CollectionRunnerRehearsalOperationRootRegistry;
}

const VALIDATION_KEYS = [
  "schemaVersion", "policyVersion", "repositoryRootId", "alphaCommit",
  "cleanTreeRequired", "packageFingerprint", "validationSuiteFingerprint",
  "registeredTestTotal", "commandIdentity", "recursionPolicyVersion",
  "networkPermitted", "credentialAccessPermitted",
] as const;

export function createCollectionRunnerRehearsalOperationValidationAuthority(
  input: CollectionRunnerRehearsalOperationValidationAuthorityInput,
): CollectionRunnerRehearsalOperationValidationAuthority {
  exact(input, VALIDATION_KEYS, "validation authority");
  assertSchema(input.schemaVersion);
  text(input.policyVersion, VERSION, "policyVersion");
  text(input.repositoryRootId, ID, "repositoryRootId");
  text(input.alphaCommit, COMMIT, "alphaCommit");
  fingerprint(input.packageFingerprint, "packageFingerprint");
  fingerprint(input.validationSuiteFingerprint, "validationSuiteFingerprint");
  positiveInteger(input.registeredTestTotal, 1_000_000, "registeredTestTotal");
  text(input.recursionPolicyVersion, VERSION, "recursionPolicyVersion");
  if (
    input.cleanTreeRequired !== true ||
    input.commandIdentity !== COLLECTION_RUNNER_REHEARSAL_OPERATION_COMMAND_IDENTITY ||
    input.networkPermitted !== false ||
    input.credentialAccessPermitted !== false
  ) {
    fail("INVALID_VALIDATION_AUTHORITY", "Validation authority exceeds the fixed local boundary.");
  }
  const body = structuredClone(input);
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: digest(body),
  }) as CollectionRunnerRehearsalOperationValidationAuthority;
}

const PROPOSAL_KEYS = [
  "schemaVersion", "policyVersion", "rehearsalId",
  "rehearsalManifestFingerprint", "alphaCommit", "runtimeBuildFingerprint",
  "fixtureCatalogEntryId", "fixtureCatalogEntryFingerprint",
  "providerFingerprint", "mappingFingerprint", "runnerDefinitionFingerprint",
  "frozenPlanFingerprint", "rootRegistryFingerprint", "rootBindings",
  "validationAuthorityFingerprint", "phasePlan", "maximumPhaseInvocations",
  "recoveryPolicyVersion", "maximumRecoveryInvocations", "plannedBackupId",
  "plannedPackageId", "plannedEnvelopeId", "retentionPolicyVersion",
  "createdAtUtc", "nonAuthorityDeclaration",
] as const;

export function createCollectionRunnerRehearsalOperationManifestProposal(
  input: CollectionRunnerRehearsalOperationManifestProposalInput,
): CollectionRunnerRehearsalOperationManifestProposal {
  exact(input, PROPOSAL_KEYS, "operation proposal");
  assertSchema(input.schemaVersion);
  for (const [field, value] of [
    ["policyVersion", input.policyVersion],
    ["recoveryPolicyVersion", input.recoveryPolicyVersion],
    ["retentionPolicyVersion", input.retentionPolicyVersion],
  ] as const) text(value, VERSION, field);
  for (const [field, value] of [
    ["rehearsalId", input.rehearsalId],
    ["fixtureCatalogEntryId", input.fixtureCatalogEntryId],
    ["plannedBackupId", input.plannedBackupId],
    ["plannedPackageId", input.plannedPackageId],
    ["plannedEnvelopeId", input.plannedEnvelopeId],
  ] as const) text(value, ID, field);
  text(input.alphaCommit, COMMIT, "alphaCommit");
  for (const [field, value] of Object.entries(input).filter(([key]) =>
    key.endsWith("Fingerprint"),
  )) fingerprint(value, field);
  timestamp(input.createdAtUtc, "createdAtUtc");
  positiveInteger(
    input.maximumPhaseInvocations,
    COLLECTION_RUNNER_REHEARSAL_OPERATION_MAX_PHASES,
    "maximumPhaseInvocations",
  );
  positiveInteger(
    input.maximumRecoveryInvocations,
    COLLECTION_RUNNER_REHEARSAL_OPERATION_MAX_RECOVERIES,
    "maximumRecoveryInvocations",
  );
  if (input.nonAuthorityDeclaration !== COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION) {
    fail("INVALID_AUTHORITY", "The mandatory non-authority declaration is absent.");
  }
  if (
    input.phasePlan.length < 6 ||
    input.phasePlan.length !== input.maximumPhaseInvocations
  ) {
    fail("INVALID_PHASE_PLAN", "Phase plan length must equal the fixed invocation bound.");
  }
  let expectedStepOrdinal = 1;
  input.phasePlan.forEach((entry, index) => {
    exact(entry, ["ordinal", "phase", "expectedStepOrdinal"], `phasePlan[${index}]`);
    if (
      entry.ordinal !== index + 1 ||
      (entry.phase as CollectionRunnerRehearsalOperationPhase) ===
        CollectionRunnerRehearsalOperationPhase.Recover
    ) {
      fail("INVALID_PHASE_PLAN", "Phase plan ordinals and phases are invalid.");
    }
    enumValue(CollectionRunnerRehearsalOperationPhase, entry.phase, `phasePlan[${index}].phase`);
    if (entry.phase === CollectionRunnerRehearsalOperationPhase.Step) {
      if (entry.expectedStepOrdinal !== expectedStepOrdinal) {
        fail("INVALID_PHASE_PLAN", "STEP ordinals must be contiguous.");
      }
      expectedStepOrdinal += 1;
    } else if (entry.expectedStepOrdinal !== null) {
      fail("INVALID_PHASE_PLAN", "Only STEP may bind an expected step ordinal.");
    }
  });
  const phases = input.phasePlan.map((entry) => entry.phase);
  if (
    phases[0] !== CollectionRunnerRehearsalOperationPhase.Prepare ||
    !phases.includes(CollectionRunnerRehearsalOperationPhase.Step) ||
    phases.at(-4) !== CollectionRunnerRehearsalOperationPhase.Validate ||
    phases.at(-3) !== CollectionRunnerRehearsalOperationPhase.Freeze ||
    phases.at(-2) !== CollectionRunnerRehearsalOperationPhase.Package ||
    phases.at(-1) !== CollectionRunnerRehearsalOperationPhase.Verify
  ) {
    fail("INVALID_PHASE_PLAN", "The closed phase order is invalid.");
  }
  if (input.rootBindings.length !== COLLECTION_RUNNER_REHEARSAL_OPERATION_REQUIRED_ROOT_COUNT) {
    fail("INVALID_ROOT_SET", "Proposal must bind the complete root set.");
  }
  const purposes = new Set<string>();
  const roots = new Set<string>();
  input.rootBindings.forEach((binding, index) => {
    exact(binding, ["purpose", "rootId", "rootFingerprint"], `rootBindings[${index}]`);
    enumValue(CollectionRunnerRehearsalOperationRootPurpose, binding.purpose, "root purpose");
    text(binding.rootId, ID, "rootId");
    fingerprint(binding.rootFingerprint, "rootFingerprint");
    if (purposes.has(binding.purpose) || roots.has(binding.rootId)) {
      fail("DUPLICATE_ROOT", "Proposal root bindings must be unique.");
    }
    purposes.add(binding.purpose);
    roots.add(binding.rootId);
  });
  const body = structuredClone(input);
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: digest(body),
  }) as CollectionRunnerRehearsalOperationManifestProposal;
}

const APPROVAL_KEYS = [
  "schemaVersion", "approvalId", "ownerId", "approvedProposalFingerprint",
  "approvedAtUtc", "expiresAtUtc", "localAuthenticationPolicyVersion",
  "nonAuthorityDeclaration",
] as const;

export function createCollectionRunnerRehearsalOperationOwnerApproval(
  input: CollectionRunnerRehearsalOperationOwnerApprovalInput,
): CollectionRunnerRehearsalOperationOwnerApproval {
  exact(input, APPROVAL_KEYS, "operation approval");
  assertSchema(input.schemaVersion);
  text(input.approvalId, ID, "approvalId");
  text(input.ownerId, ID, "ownerId");
  fingerprint(input.approvedProposalFingerprint, "approvedProposalFingerprint");
  const approvedAt = timestamp(input.approvedAtUtc, "approvedAtUtc");
  const expiresAt = timestamp(input.expiresAtUtc, "expiresAtUtc");
  text(input.localAuthenticationPolicyVersion, VERSION, "localAuthenticationPolicyVersion");
  if (expiresAt <= approvedAt) fail("INVALID_CHRONOLOGY", "Approval must expire after approval.");
  if (input.nonAuthorityDeclaration !== COLLECTION_RUNNER_REHEARSAL_OPERATION_NON_AUTHORITY_DECLARATION) {
    fail("INVALID_AUTHORITY", "Approval must preserve the non-authority declaration.");
  }
  const body = structuredClone(input);
  return freeze({
    ...body,
    deterministic: true as const,
    fingerprint: digest(body),
  }) as CollectionRunnerRehearsalOperationOwnerApproval;
}

export function createCollectionRunnerRehearsalOperationManifest(
  proposal: CollectionRunnerRehearsalOperationManifestProposal,
  approval: CollectionRunnerRehearsalOperationOwnerApproval,
): CollectionRunnerRehearsalOperationManifest {
  const { deterministic: proposalDeterministic, fingerprint: proposalFingerprint, ...proposalInput } = proposal;
  const { deterministic: approvalDeterministic, fingerprint: approvalFingerprint, ...approvalInput } = approval;
  if (
    proposalDeterministic !== true ||
    approvalDeterministic !== true ||
    proposalFingerprint !== digest(proposalInput) ||
    approvalFingerprint !== digest(approvalInput)
  ) {
    fail("INVALID_FINGERPRINT", "Proposal or approval fingerprint is invalid.");
  }
  const verifiedProposal = createCollectionRunnerRehearsalOperationManifestProposal(proposalInput);
  const verifiedApproval = createCollectionRunnerRehearsalOperationOwnerApproval(approvalInput);
  if (
    verifiedApproval.approvedProposalFingerprint !== verifiedProposal.fingerprint ||
    Date.parse(verifiedProposal.createdAtUtc) > Date.parse(verifiedApproval.approvedAtUtc)
  ) {
    fail("APPROVAL_MISMATCH", "Owner approval does not bind this proposal.");
  }
  const identityBody = {
    proposalFingerprint: verifiedProposal.fingerprint,
    ownerApprovalFingerprint: verifiedApproval.fingerprint,
  };
  const body = {
    proposal: verifiedProposal,
    ownerApproval: verifiedApproval,
    operationId: `rehearsal-operation:${digest(identityBody).slice(7, 39)}`,
    deterministic: true as const,
  };
  return freeze({
    ...body,
    fingerprint: digest(body),
  }) as CollectionRunnerRehearsalOperationManifest;
}

export function verifyCollectionRunnerRehearsalOperationManifest(
  manifest: CollectionRunnerRehearsalOperationManifest,
): boolean {
  const rebuilt = createCollectionRunnerRehearsalOperationManifest(
    manifest.proposal,
    manifest.ownerApproval,
  );
  return (
    rebuilt.operationId === manifest.operationId &&
    rebuilt.fingerprint === manifest.fingerprint &&
    manifest.deterministic === true
  );
}

function verifyCatalogEntry(entry: CollectionRunnerRehearsalFixtureCatalogEntry): void {
  fingerprint(entry.fingerprint, "fixture catalog entry fingerprint");
  text(entry.catalogEntryId, ID, "fixture catalog entry ID");
  if (entry.deterministic !== true) fail("INVALID_CATALOG", "Fixture catalog entry is not deterministic.");
  const { deterministic: _deterministic, fingerprint: entryFingerprint, ...input } = entry;
  const rebuilt = createCollectionRunnerRehearsalFixtureCatalogEntry(input);
  if (rebuilt.fingerprint !== entryFingerprint) {
    fail("INVALID_CATALOG", "Fixture catalog entry fingerprint is invalid.");
  }
}

export class CollectionRunnerRehearsalOperationRegistry {
  readonly #rootRegistry: CollectionRunnerRehearsalOperationRootRegistry;
  readonly #roots: ReadonlyMap<string, CollectionRunnerRehearsalOperationRootRegistration>;
  readonly #catalog: ReadonlyMap<string, CollectionRunnerRehearsalFixtureCatalogEntry>;
  readonly #validation: ReadonlyMap<string, CollectionRunnerRehearsalOperationValidationAuthority>;
  readonly #operations: ReadonlyMap<string, CollectionRunnerRehearsalOperationManifest>;
  readonly #snapshot: CollectionRunnerRehearsalOperationRegistrySnapshot;

  public constructor(input: CollectionRunnerRehearsalOperationRegistryInput) {
    const {
      rootRegistryId,
      deterministic: registryDeterministic,
      fingerprint: registryFingerprint,
      ...rootRegistryInput
    } = input.rootRegistry;
    this.#rootRegistry = createCollectionRunnerRehearsalOperationRootRegistry(rootRegistryInput);
    if (
      registryDeterministic !== true ||
      rootRegistryId !== this.#rootRegistry.rootRegistryId ||
      registryFingerprint !== this.#rootRegistry.fingerprint
    ) {
      fail("INVALID_ROOT_REGISTRY", "Root registry fingerprint is invalid.");
    }
    this.#roots = new Map(this.#rootRegistry.registrations.map((entry) => [entry.rootId, entry]));
    const catalog = new Map<string, CollectionRunnerRehearsalFixtureCatalogEntry>();
    input.fixtureCatalogEntries.forEach((entry) => {
      verifyCatalogEntry(entry);
      if (catalog.has(entry.catalogEntryId)) fail("DUPLICATE_CATALOG", "Fixture catalog identities must be unique.");
      catalog.set(entry.catalogEntryId, freeze(structuredClone(entry)) as CollectionRunnerRehearsalFixtureCatalogEntry);
    });
    this.#catalog = catalog;
    const validation = new Map<string, CollectionRunnerRehearsalOperationValidationAuthority>();
    input.validationAuthorities.forEach((authority) => {
      const { deterministic, fingerprint: authorityFingerprint, ...authorityInput } = authority;
      const verified = createCollectionRunnerRehearsalOperationValidationAuthority(authorityInput);
      if (deterministic !== true || authorityFingerprint !== verified.fingerprint) {
        fail("INVALID_VALIDATION_AUTHORITY", "Validation authority fingerprint is invalid.");
      }
      if (validation.has(verified.fingerprint)) fail("DUPLICATE_VALIDATION", "Validation authority is duplicated.");
      validation.set(verified.fingerprint, verified);
    });
    this.#validation = validation;
    const operations = new Map<string, CollectionRunnerRehearsalOperationManifest>();
    const rehearsals = new Set<string>();
    input.manifests.forEach((manifest) => {
      if (!verifyCollectionRunnerRehearsalOperationManifest(manifest)) {
        fail("INVALID_MANIFEST", "Operation manifest verification failed.");
      }
      if (operations.has(manifest.operationId) || rehearsals.has(manifest.proposal.rehearsalId)) {
        fail("DUPLICATE_OPERATION", "Operation and rehearsal identities must be unique.");
      }
      this.#verifyBindings(manifest);
      operations.set(manifest.operationId, freeze(structuredClone(manifest)) as CollectionRunnerRehearsalOperationManifest);
      rehearsals.add(manifest.proposal.rehearsalId);
    });
    this.#operations = operations;
    const snapshotBody = {
      rootRegistryFingerprint: this.#rootRegistry.fingerprint,
      fixtureCatalogEntryFingerprints: [...catalog.values()].map((entry) => entry.fingerprint).sort(),
      validationAuthorityFingerprints: [...validation.keys()].sort(),
      operationManifestFingerprints: [...operations.values()].map((entry) => entry.fingerprint).sort(),
      deterministic: true as const,
    };
    this.#snapshot = freeze({
      ...snapshotBody,
      fingerprint: digest(snapshotBody),
    }) as CollectionRunnerRehearsalOperationRegistrySnapshot;
  }

  #verifyBindings(manifest: CollectionRunnerRehearsalOperationManifest): void {
    const proposal = manifest.proposal;
    if (proposal.rootRegistryFingerprint !== this.#rootRegistry.fingerprint) {
      fail("ROOT_REGISTRY_MISMATCH", "Manifest does not bind the registered root registry.");
    }
    for (const binding of proposal.rootBindings) {
      const root = this.#roots.get(binding.rootId);
      if (root === undefined || root.purpose !== binding.purpose || root.fingerprint !== binding.rootFingerprint) {
        fail("ROOT_BINDING_MISMATCH", "Manifest root binding is not registered.");
      }
    }
    const repositoryBinding = proposal.rootBindings.find(
      (binding) => binding.purpose === CollectionRunnerRehearsalOperationRootPurpose.AlphaRepository,
    );
    const authority = this.#validation.get(proposal.validationAuthorityFingerprint);
    if (
      authority === undefined ||
      repositoryBinding === undefined ||
      authority.repositoryRootId !== repositoryBinding.rootId ||
      authority.alphaCommit !== proposal.alphaCommit
    ) {
      fail("VALIDATION_AUTHORITY_MISMATCH", "Manifest validation authority is not registered.");
    }
    const catalog = this.#catalog.get(proposal.fixtureCatalogEntryId);
    if (catalog === undefined || catalog.fingerprint !== proposal.fixtureCatalogEntryFingerprint) {
      fail("CATALOG_MISMATCH", "Manifest fixture catalog entry is not registered.");
    }
    if (
      catalog.runnerDefinition.fingerprint !== proposal.runnerDefinitionFingerprint ||
      catalog.pilotActivation.frozenPlanFingerprint !== proposal.frozenPlanFingerprint ||
      catalog.sourceSnapshot.providerFingerprint !== proposal.providerFingerprint ||
      catalog.sourceSnapshot.mappingFingerprint !== proposal.mappingFingerprint
    ) {
      fail("CATALOG_MISMATCH", "Manifest authority differs from the fixture catalog.");
    }
  }

  public getOperation(operationId: string): CollectionRunnerRehearsalOperationManifest | null {
    text(operationId, ID, "operationId");
    const value = this.#operations.get(operationId);
    return value === undefined
      ? null
      : freeze(structuredClone(value)) as CollectionRunnerRehearsalOperationManifest;
  }

  public getRoot(rootId: string): CollectionRunnerRehearsalOperationRootRegistration | null {
    text(rootId, ID, "rootId");
    const value = this.#roots.get(rootId);
    return value === undefined
      ? null
      : freeze(structuredClone(value)) as CollectionRunnerRehearsalOperationRootRegistration;
  }

  public getValidationAuthority(
    authorityFingerprint: string,
  ): CollectionRunnerRehearsalOperationValidationAuthority | null {
    fingerprint(authorityFingerprint, "authorityFingerprint");
    const value = this.#validation.get(authorityFingerprint);
    return value === undefined
      ? null
      : freeze(structuredClone(value)) as CollectionRunnerRehearsalOperationValidationAuthority;
  }

  public getSnapshot(): CollectionRunnerRehearsalOperationRegistrySnapshot {
    return freeze(structuredClone(this.#snapshot)) as CollectionRunnerRehearsalOperationRegistrySnapshot;
  }
}
