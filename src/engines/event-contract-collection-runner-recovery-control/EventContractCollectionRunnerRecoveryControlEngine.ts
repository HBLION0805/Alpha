import {
  COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
  CollectionRunnerClockHealth,
  CollectionRunnerEmergencyStopDirective,
  CollectionRunnerEmergencyStopTrigger,
  CollectionRunnerOwnerDecisionAction,
  CollectionRunnerPilotState,
  CollectionRunnerRecoveryControlIssueCode,
  CollectionRunnerRecoveryDisposition,
  type CollectionRunnerEmergencyStopAssessment,
  type CollectionRunnerEmergencyStopInput,
  type CollectionRunnerLocalOwnerAuthorizationEvidence,
  type CollectionRunnerOwnerRecoveryDecision,
  type CollectionRunnerOwnerRecoveryDecisionInput,
  type CollectionRunnerRecoveryActivation,
  type CollectionRunnerRecoveryAssessment,
  type CollectionRunnerRecoveryAssessmentInput,
} from "../../contracts";

export interface CollectionRunnerRecoveryControlIssue {
  readonly code: CollectionRunnerRecoveryControlIssueCode;
  readonly field: string;
  readonly message: string;
}

export class EventContractCollectionRunnerRecoveryControlValidationError extends Error {
  public constructor(
    public readonly issues: readonly CollectionRunnerRecoveryControlIssue[],
  ) {
    super("Event Contract Collection Runner recovery control validation failed.");
    this.name =
      "EventContractCollectionRunnerRecoveryControlValidationError";
  }
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^(?:fnv1a64:[0-9a-f]{16}|sha256:[0-9a-f]{64})$/u;
const REASON = /^[A-Z][A-Z0-9_]{0,63}$/u;
const TERMINAL_STATES = new Set<CollectionRunnerPilotState>([
  CollectionRunnerPilotState.Stopped,
  CollectionRunnerPilotState.Revoked,
  CollectionRunnerPilotState.Completed,
  CollectionRunnerPilotState.FailedClosed,
]);

const ASSESSMENT_INPUT_KEYS = [
  "schemaVersion",
  "assessmentId",
  "policyVersion",
  "storeId",
  "storePathIdentity",
  "schemaCatalogChecksum",
  "recoveryReportFingerprint",
  "inspectedAtUtc",
  "activation",
  "priorBootIdentity",
  "proposedBootIdentity",
  "proposedProcessSessionId",
  "clockHealth",
  "absoluteClockOffsetMilliseconds",
  "maximumClockOffsetMilliseconds",
  "openLeaseCount",
  "unresolvedAttemptCount",
  "integrityBlockerCodes",
  "restoredStorePendingSwitch",
  "assessedAtUtc",
  "expiresAtUtc",
] as const;
const ASSESSMENT_KEYS = [
  ...ASSESSMENT_INPUT_KEYS,
  "disposition",
  "resumeEligible",
  "ownerDecisionRequired",
  "deterministic",
  "fingerprint",
] as const;
const ACTIVATION_KEYS = [
  "activationId",
  "ownerId",
  "state",
  "aggregateVersion",
  "fingerprint",
  "startsAtUtc",
  "stopsAtUtc",
] as const;
const AUTHORIZATION_KEYS = [
  "authorityKind",
  "ownerId",
  "verifierId",
  "verifierVersion",
  "authorizationReference",
  "challengeFingerprint",
  "verifiedAtUtc",
  "expiresAtUtc",
] as const;
const DECISION_INPUT_KEYS = [
  "schemaVersion",
  "decisionId",
  "assessment",
  "expectedActivationAggregateVersion",
  "ownerAuthorization",
  "action",
  "reasonCode",
  "decidedAtUtc",
  "expiresAtUtc",
  "proposedBootIdentity",
  "proposedProcessSessionId",
  "emergencyStopObserved",
] as const;
const DECISION_KEYS = [
  ...DECISION_INPUT_KEYS,
  "idempotencyKey",
  "authorizesMutation",
  "authorizesResume",
  "deterministic",
  "fingerprint",
] as const;
const STOP_KEYS = ["activationState", "triggers", "evaluatedAtUtc"] as const;
const STOP_ASSESSMENT_KEYS = [
  ...STOP_KEYS,
  "directive",
  "blocksResume",
  "blocksNewWork",
  "deterministic",
  "fingerprint",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  issues: CollectionRunnerRecoveryControlIssue[],
  code: CollectionRunnerRecoveryControlIssueCode,
  field: string,
  message: string,
): void {
  issues.push({ code, field, message });
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
  field: string,
  issues: CollectionRunnerRecoveryControlIssue[],
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
      field,
      "A declared object is required.",
    );
    return false;
  }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issue(
        issues,
        CollectionRunnerRecoveryControlIssueCode.UnknownField,
        `${field}.${key}`,
        "Unknown fields fail closed.",
      );
    }
  }
  for (const key of keys) {
    if (!(key in value)) {
      issue(
        issues,
        CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
        `${field}.${key}`,
        "Required field is missing.",
      );
    }
  }
  return true;
}

function identifier(
  value: unknown,
  field: string,
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidIdentifier,
      field,
      "Identifier is invalid.",
    );
  }
}

function version(
  value: unknown,
  field: string,
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (typeof value !== "string" || !VERSION.test(value)) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidIdentifier,
      field,
      "Version is invalid.",
    );
  }
}

function fingerprintValue(
  value: unknown,
  field: string,
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (typeof value !== "string" || !FINGERPRINT.test(value)) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidFingerprint,
      field,
      "Fingerprint is invalid.",
    );
  }
}

function timestamp(
  value: unknown,
  field: string,
  issues: CollectionRunnerRecoveryControlIssue[],
): number | null {
  if (typeof value !== "string") {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidTimestamp,
      field,
      "Canonical millisecond UTC is required.",
    );
    return null;
  }
  const parsed = Date.parse(value);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) ||
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== value
  ) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidTimestamp,
      field,
      "Canonical millisecond UTC is required.",
    );
    return null;
  }
  return parsed;
}

function enumValue<T extends Record<string, string>>(
  values: T,
  value: unknown,
  field: string,
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (!Object.values(values).includes(value as string)) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidEnum,
      field,
      "Enum value is invalid.",
    );
  }
}

function safeCount(
  value: unknown,
  field: string,
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidBound,
      field,
      "A non-negative safe integer is required.",
    );
  }
}

function fail(issues: CollectionRunnerRecoveryControlIssue[]): void {
  if (issues.length > 0) {
    issues.sort((a, b) =>
      `${a.field}:${a.code}`.localeCompare(`${b.field}:${b.code}`),
    );
    throw new EventContractCollectionRunnerRecoveryControlValidationError(
      deepFreeze(issues),
    );
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
    .join(",")}}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function fingerprint(value: unknown): string {
  return `fnv1a64:${fnv1a64(canonicalize(value))}`;
}

function validateActivation(
  value: unknown,
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (!exactKeys(value, ACTIVATION_KEYS, "activation", issues)) return;
  identifier(value.activationId, "activation.activationId", issues);
  identifier(value.ownerId, "activation.ownerId", issues);
  enumValue(
    CollectionRunnerPilotState,
    value.state,
    "activation.state",
    issues,
  );
  if (
    typeof value.aggregateVersion !== "number" ||
    !Number.isSafeInteger(value.aggregateVersion) ||
    value.aggregateVersion < 1
  ) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidBound,
      "activation.aggregateVersion",
      "Positive aggregate version is required.",
    );
  }
  fingerprintValue(
    value.fingerprint,
    "activation.fingerprint",
    issues,
  );
  const starts = timestamp(value.startsAtUtc, "activation.startsAtUtc", issues);
  const stops = timestamp(value.stopsAtUtc, "activation.stopsAtUtc", issues);
  if (starts !== null && stops !== null && starts >= stops) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidChronology,
      "activation.stopsAtUtc",
      "Activation stop must follow start.",
    );
  }
}

function validateAssessmentInput(
  value: unknown,
  keys: readonly string[],
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (!exactKeys(value, keys, "assessment", issues)) return;
  if (value.schemaVersion !== COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
      "assessment.schemaVersion",
      "Schema version is unsupported.",
    );
  }
  identifier(value.assessmentId, "assessment.assessmentId", issues);
  version(value.policyVersion, "assessment.policyVersion", issues);
  identifier(value.storeId, "assessment.storeId", issues);
  fingerprintValue(
    value.storePathIdentity,
    "assessment.storePathIdentity",
    issues,
  );
  fingerprintValue(
    value.schemaCatalogChecksum,
    "assessment.schemaCatalogChecksum",
    issues,
  );
  fingerprintValue(
    value.recoveryReportFingerprint,
    "assessment.recoveryReportFingerprint",
    issues,
  );
  const inspected = timestamp(
    value.inspectedAtUtc,
    "assessment.inspectedAtUtc",
    issues,
  );
  if (value.activation !== null) validateActivation(value.activation, issues);
  if (value.priorBootIdentity !== null) {
    identifier(
      value.priorBootIdentity,
      "assessment.priorBootIdentity",
      issues,
    );
  }
  identifier(
    value.proposedBootIdentity,
    "assessment.proposedBootIdentity",
    issues,
  );
  identifier(
    value.proposedProcessSessionId,
    "assessment.proposedProcessSessionId",
    issues,
  );
  enumValue(
    CollectionRunnerClockHealth,
    value.clockHealth,
    "assessment.clockHealth",
    issues,
  );
  if (
    value.absoluteClockOffsetMilliseconds !== null &&
    (typeof value.absoluteClockOffsetMilliseconds !== "number" ||
      !Number.isSafeInteger(value.absoluteClockOffsetMilliseconds) ||
      value.absoluteClockOffsetMilliseconds < 0)
  ) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidBound,
      "assessment.absoluteClockOffsetMilliseconds",
      "Clock offset must be null or a non-negative safe integer.",
    );
  }
  safeCount(
    value.maximumClockOffsetMilliseconds,
    "assessment.maximumClockOffsetMilliseconds",
    issues,
  );
  safeCount(value.openLeaseCount, "assessment.openLeaseCount", issues);
  safeCount(
    value.unresolvedAttemptCount,
    "assessment.unresolvedAttemptCount",
    issues,
  );
  if (
    !Array.isArray(value.integrityBlockerCodes) ||
    value.integrityBlockerCodes.some(
      (entry) => typeof entry !== "string" || !REASON.test(entry),
    ) ||
    new Set(value.integrityBlockerCodes).size !==
      value.integrityBlockerCodes.length
  ) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
      "assessment.integrityBlockerCodes",
      "Unique bounded blocker codes are required.",
    );
  }
  if (typeof value.restoredStorePendingSwitch !== "boolean") {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
      "assessment.restoredStorePendingSwitch",
      "Boolean is required.",
    );
  }
  const assessed = timestamp(
    value.assessedAtUtc,
    "assessment.assessedAtUtc",
    issues,
  );
  const expires = timestamp(
    value.expiresAtUtc,
    "assessment.expiresAtUtc",
    issues,
  );
  if (
    inspected !== null &&
    assessed !== null &&
    (assessed < inspected || (expires !== null && assessed >= expires))
  ) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidChronology,
      "assessment.expiresAtUtc",
      "Assessment chronology is invalid.",
    );
  }
}

function dispositionOf(
  value: CollectionRunnerRecoveryAssessmentInput,
): CollectionRunnerRecoveryDisposition {
  if (value.integrityBlockerCodes.length > 0) {
    return CollectionRunnerRecoveryDisposition.FailClosedRequired;
  }
  if (value.restoredStorePendingSwitch) {
    return CollectionRunnerRecoveryDisposition.StoreSwitchRequired;
  }
  const activation = value.activation;
  if (activation === null) {
    return CollectionRunnerRecoveryDisposition.NoResumeRequired;
  }
  if (TERMINAL_STATES.has(activation.state)) {
    return CollectionRunnerRecoveryDisposition.TerminalNoResume;
  }
  if (activation.state === CollectionRunnerPilotState.StopRequested) {
    return CollectionRunnerRecoveryDisposition.StopCompletionOnly;
  }
  if (Date.parse(value.assessedAtUtc) >= Date.parse(activation.stopsAtUtc)) {
    return CollectionRunnerRecoveryDisposition.ActivationExpired;
  }
  if (
    value.clockHealth !== CollectionRunnerClockHealth.Healthy ||
    value.absoluteClockOffsetMilliseconds === null ||
    value.absoluteClockOffsetMilliseconds >
      value.maximumClockOffsetMilliseconds
  ) {
    return CollectionRunnerRecoveryDisposition.FailClosedRequired;
  }
  if (
    activation.state === CollectionRunnerPilotState.Active &&
    (value.openLeaseCount > 0 || value.unresolvedAttemptCount > 0)
  ) {
    return CollectionRunnerRecoveryDisposition.ReconciliationRequired;
  }
  return activation.state === CollectionRunnerPilotState.Active
    ? CollectionRunnerRecoveryDisposition.ResumeEligible
    : CollectionRunnerRecoveryDisposition.NoResumeRequired;
}

function verifyAssessment(
  value: unknown,
): CollectionRunnerRecoveryAssessment {
  const issues: CollectionRunnerRecoveryControlIssue[] = [];
  validateAssessmentInput(value, ASSESSMENT_KEYS, issues);
  fail(issues);
  if (isRecord(value)) {
    const base = Object.fromEntries(
      Object.entries(value).filter(
        ([key]) =>
          ![
            "disposition",
            "resumeEligible",
            "ownerDecisionRequired",
            "deterministic",
            "fingerprint",
          ].includes(key),
      ),
    ) as unknown as CollectionRunnerRecoveryAssessmentInput;
    const expected = dispositionOf(base);
    if (value.disposition !== expected) {
      issue(
        issues,
        CollectionRunnerRecoveryControlIssueCode.InvalidDisposition,
        "assessment.disposition",
        "Disposition does not match deterministic facts.",
      );
    }
    if (value.resumeEligible !== (expected === CollectionRunnerRecoveryDisposition.ResumeEligible)) {
      issue(
        issues,
        CollectionRunnerRecoveryControlIssueCode.InvalidDisposition,
        "assessment.resumeEligible",
        "Resume eligibility does not match disposition.",
      );
    }
    if (value.ownerDecisionRequired !== ![
      CollectionRunnerRecoveryDisposition.NoResumeRequired,
      CollectionRunnerRecoveryDisposition.TerminalNoResume,
    ].includes(expected)) {
      issue(
        issues,
        CollectionRunnerRecoveryControlIssueCode.InvalidDisposition,
        "assessment.ownerDecisionRequired",
        "Owner-decision flag does not match disposition.",
      );
    }
    if (value.deterministic !== true || value.fingerprint !== fingerprint({
      ...base,
      disposition: expected,
      resumeEligible:
        expected === CollectionRunnerRecoveryDisposition.ResumeEligible,
      ownerDecisionRequired: ![
        CollectionRunnerRecoveryDisposition.NoResumeRequired,
        CollectionRunnerRecoveryDisposition.TerminalNoResume,
      ].includes(expected),
      deterministic: true,
    })) {
      issue(
        issues,
        CollectionRunnerRecoveryControlIssueCode.InvalidFingerprint,
        "assessment.fingerprint",
        "Assessment fingerprint is invalid.",
      );
    }
  }
  fail(issues);
  return deepFreeze(structuredClone(value) as CollectionRunnerRecoveryAssessment);
}

function validateAuthorization(
  value: unknown,
  issues: CollectionRunnerRecoveryControlIssue[],
): void {
  if (!exactKeys(value, AUTHORIZATION_KEYS, "ownerAuthorization", issues)) return;
  if (value.authorityKind !== "LOCAL_OWNER_VERIFIED") {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidAuthority,
      "ownerAuthorization.authorityKind",
      "Locally verified owner evidence is required.",
    );
  }
  identifier(value.ownerId, "ownerAuthorization.ownerId", issues);
  identifier(value.verifierId, "ownerAuthorization.verifierId", issues);
  version(value.verifierVersion, "ownerAuthorization.verifierVersion", issues);
  identifier(
    value.authorizationReference,
    "ownerAuthorization.authorizationReference",
    issues,
  );
  fingerprintValue(
    value.challengeFingerprint,
    "ownerAuthorization.challengeFingerprint",
    issues,
  );
  const verified = timestamp(
    value.verifiedAtUtc,
    "ownerAuthorization.verifiedAtUtc",
    issues,
  );
  const expires = timestamp(
    value.expiresAtUtc,
    "ownerAuthorization.expiresAtUtc",
    issues,
  );
  if (verified !== null && expires !== null && verified >= expires) {
    issue(
      issues,
      CollectionRunnerRecoveryControlIssueCode.InvalidChronology,
      "ownerAuthorization.expiresAtUtc",
      "Authorization must expire after verification.",
    );
  }
}

function allowedActions(
  disposition: CollectionRunnerRecoveryDisposition,
): readonly CollectionRunnerOwnerDecisionAction[] {
  const reject = CollectionRunnerOwnerDecisionAction.RejectNoMutation;
  switch (disposition) {
    case CollectionRunnerRecoveryDisposition.ResumeEligible:
      return [
        CollectionRunnerOwnerDecisionAction.ApproveResume,
        CollectionRunnerOwnerDecisionAction.CompleteStop,
        CollectionRunnerOwnerDecisionAction.Revoke,
        CollectionRunnerOwnerDecisionAction.FailClosed,
        reject,
      ];
    case CollectionRunnerRecoveryDisposition.ReconciliationRequired:
    case CollectionRunnerRecoveryDisposition.StopCompletionOnly:
    case CollectionRunnerRecoveryDisposition.ActivationExpired:
      return [
        CollectionRunnerOwnerDecisionAction.CompleteStop,
        CollectionRunnerOwnerDecisionAction.Revoke,
        CollectionRunnerOwnerDecisionAction.FailClosed,
        reject,
      ];
    case CollectionRunnerRecoveryDisposition.FailClosedRequired:
      return [CollectionRunnerOwnerDecisionAction.FailClosed, reject];
    default:
      return [reject];
  }
}

export class EventContractCollectionRunnerRecoveryControlEngine {
  public createRecoveryAssessment(
    value: unknown,
  ): CollectionRunnerRecoveryAssessment {
    const issues: CollectionRunnerRecoveryControlIssue[] = [];
    validateAssessmentInput(value, ASSESSMENT_INPUT_KEYS, issues);
    fail(issues);
    const input = structuredClone(
      value,
    ) as CollectionRunnerRecoveryAssessmentInput;
    const disposition = dispositionOf(input);
    const base = {
      ...input,
      integrityBlockerCodes: [...input.integrityBlockerCodes].sort(),
      disposition,
      resumeEligible:
        disposition === CollectionRunnerRecoveryDisposition.ResumeEligible,
      ownerDecisionRequired: ![
        CollectionRunnerRecoveryDisposition.NoResumeRequired,
        CollectionRunnerRecoveryDisposition.TerminalNoResume,
      ].includes(disposition),
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifyRecoveryAssessment(
    value: unknown,
  ): CollectionRunnerRecoveryAssessment {
    return verifyAssessment(value);
  }

  public createOwnerRecoveryDecision(
    value: unknown,
  ): CollectionRunnerOwnerRecoveryDecision {
    const issues: CollectionRunnerRecoveryControlIssue[] = [];
    if (exactKeys(value, DECISION_INPUT_KEYS, "decision", issues)) {
      if (value.schemaVersion !== COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION) {
        issue(
          issues,
          CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
          "decision.schemaVersion",
          "Schema version is unsupported.",
        );
      }
      identifier(value.decisionId, "decision.decisionId", issues);
      let assessment: CollectionRunnerRecoveryAssessment | undefined;
      try {
        assessment = verifyAssessment(value.assessment);
      } catch (error) {
        if (
          error instanceof
          EventContractCollectionRunnerRecoveryControlValidationError
        ) {
          issues.push(...error.issues);
        }
      }
      validateAuthorization(value.ownerAuthorization, issues);
      enumValue(
        CollectionRunnerOwnerDecisionAction,
        value.action,
        "decision.action",
        issues,
      );
      if (typeof value.reasonCode !== "string" || !REASON.test(value.reasonCode)) {
        issue(
          issues,
          CollectionRunnerRecoveryControlIssueCode.InvalidIdentifier,
          "decision.reasonCode",
          "Bounded reason code is required.",
        );
      }
      const decided = timestamp(value.decidedAtUtc, "decision.decidedAtUtc", issues);
      const expires = timestamp(value.expiresAtUtc, "decision.expiresAtUtc", issues);
      identifier(
        value.proposedBootIdentity,
        "decision.proposedBootIdentity",
        issues,
      );
      identifier(
        value.proposedProcessSessionId,
        "decision.proposedProcessSessionId",
        issues,
      );
      if (typeof value.emergencyStopObserved !== "boolean") {
        issue(
          issues,
          CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
          "decision.emergencyStopObserved",
          "Boolean is required.",
        );
      }
      if (assessment !== undefined && isRecord(value.ownerAuthorization)) {
        const activation = assessment.activation;
        if (
          activation === null ||
          value.ownerAuthorization.ownerId !== activation.ownerId
        ) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.InvalidAuthority,
            "ownerAuthorization.ownerId",
            "Authorization must bind the exact activation owner.",
          );
        }
        if (
          value.expectedActivationAggregateVersion !==
          activation?.aggregateVersion
        ) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.InvalidAuthority,
            "decision.expectedActivationAggregateVersion",
            "Expected activation version does not match assessment.",
          );
        }
        if (
          value.proposedBootIdentity !== assessment.proposedBootIdentity ||
          value.proposedProcessSessionId !==
            assessment.proposedProcessSessionId
        ) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.InvalidAuthority,
            "decision.proposedProcessSessionId",
            "Decision session must match the assessment.",
          );
        }
        if (
          !allowedActions(assessment.disposition).includes(
            value.action as CollectionRunnerOwnerDecisionAction,
          )
        ) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.InvalidDecision,
            "decision.action",
            "Action is not allowed for this recovery disposition.",
          );
        }
        if (
          value.emergencyStopObserved === true &&
          value.action === CollectionRunnerOwnerDecisionAction.ApproveResume
        ) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.EmergencyStopPrecedence,
            "decision.action",
            "Emergency Stop invalidates resume authority.",
          );
        }
        const auth = value.ownerAuthorization as unknown as CollectionRunnerLocalOwnerAuthorizationEvidence;
        if (
          decided !== null &&
          expires !== null &&
          (decided < Date.parse(assessment.assessedAtUtc) ||
            decided >= expires ||
            expires > Date.parse(assessment.expiresAtUtc) ||
            decided < Date.parse(auth.verifiedAtUtc) ||
            expires > Date.parse(auth.expiresAtUtc))
        ) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.InvalidChronology,
            "decision.expiresAtUtc",
            "Decision must fit within assessment and authorization validity.",
          );
        }
      }
    }
    fail(issues);
    const input = structuredClone(value) as CollectionRunnerOwnerRecoveryDecisionInput;
    const idempotencyKey = fingerprint({
      assessmentFingerprint: input.assessment.fingerprint,
      activationId: input.assessment.activation?.activationId ?? "NONE",
      expectedActivationAggregateVersion:
        input.expectedActivationAggregateVersion,
      action: input.action,
      proposedBootIdentity: input.proposedBootIdentity,
      proposedProcessSessionId: input.proposedProcessSessionId,
    });
    const base = {
      ...input,
      idempotencyKey,
      authorizesMutation:
        input.action !== CollectionRunnerOwnerDecisionAction.RejectNoMutation,
      authorizesResume:
        input.action === CollectionRunnerOwnerDecisionAction.ApproveResume,
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifyOwnerRecoveryDecision(
    value: unknown,
  ): CollectionRunnerOwnerRecoveryDecision {
    const issues: CollectionRunnerRecoveryControlIssue[] = [];
    if (exactKeys(value, DECISION_KEYS, "decision", issues)) {
      const input = Object.fromEntries(
        DECISION_INPUT_KEYS.map((key) => [key, value[key]]),
      );
      try {
        const expected = this.createOwnerRecoveryDecision(input);
        if (canonicalize(expected) !== canonicalize(value)) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.InvalidDecision,
            "decision",
            "Decision does not match deterministic input and derived fields.",
          );
        }
      } catch (error) {
        if (
          error instanceof
          EventContractCollectionRunnerRecoveryControlValidationError
        ) {
          issues.push(...error.issues);
        } else {
          throw error;
        }
      }
    }
    fail(issues);
    return deepFreeze(
      structuredClone(value) as CollectionRunnerOwnerRecoveryDecision,
    );
  }

  public evaluateEmergencyStop(
    value: unknown,
  ): CollectionRunnerEmergencyStopAssessment {
    const issues: CollectionRunnerRecoveryControlIssue[] = [];
    if (exactKeys(value, STOP_KEYS, "emergencyStop", issues)) {
      if (value.activationState !== null) {
        enumValue(
          CollectionRunnerPilotState,
          value.activationState,
          "emergencyStop.activationState",
          issues,
        );
      }
      if (
        !Array.isArray(value.triggers) ||
        value.triggers.some(
          (trigger) =>
            !Object.values(CollectionRunnerEmergencyStopTrigger).includes(
              trigger,
            ),
        ) ||
        new Set(value.triggers).size !== value.triggers.length
      ) {
        issue(
          issues,
          CollectionRunnerRecoveryControlIssueCode.InvalidEnum,
          "emergencyStop.triggers",
          "Unique declared stop triggers are required.",
        );
      }
      timestamp(value.evaluatedAtUtc, "emergencyStop.evaluatedAtUtc", issues);
    }
    fail(issues);
    const input = structuredClone(value) as CollectionRunnerEmergencyStopInput;
    const terminal =
      input.activationState !== null &&
      TERMINAL_STATES.has(input.activationState);
    const severe = input.triggers.some((trigger) =>
      [
        CollectionRunnerEmergencyStopTrigger.IntegrityFailure,
        CollectionRunnerEmergencyStopTrigger.DatabaseFailure,
      ].includes(trigger),
    );
    const directive =
      terminal || input.triggers.length === 0
        ? CollectionRunnerEmergencyStopDirective.NoStop
        : severe
          ? CollectionRunnerEmergencyStopDirective.FailClosed
          : CollectionRunnerEmergencyStopDirective.RequestStop;
    const base = {
      ...input,
      triggers: [...input.triggers].sort(),
      directive,
      blocksResume: directive !== CollectionRunnerEmergencyStopDirective.NoStop,
      blocksNewWork:
        directive !== CollectionRunnerEmergencyStopDirective.NoStop,
      deterministic: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifyEmergencyStopAssessment(
    value: unknown,
  ): CollectionRunnerEmergencyStopAssessment {
    const issues: CollectionRunnerRecoveryControlIssue[] = [];
    if (exactKeys(value, STOP_ASSESSMENT_KEYS, "emergencyStop", issues)) {
      const input = Object.fromEntries(
        STOP_KEYS.map((key) => [key, value[key]]),
      );
      try {
        const expected = this.evaluateEmergencyStop(input);
        if (canonicalize(expected) !== canonicalize(value)) {
          issue(
            issues,
            CollectionRunnerRecoveryControlIssueCode.InvalidDisposition,
            "emergencyStop",
            "Emergency Stop assessment does not match deterministic input.",
          );
        }
      } catch (error) {
        if (
          error instanceof
          EventContractCollectionRunnerRecoveryControlValidationError
        ) {
          issues.push(...error.issues);
        } else {
          throw error;
        }
      }
    }
    fail(issues);
    return deepFreeze(
      structuredClone(value) as CollectionRunnerEmergencyStopAssessment,
    );
  }
}
