import {
  COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
  CollectionRunnerClockHealth,
  CollectionRunnerEmergencyStopDirective,
  CollectionRunnerEmergencyStopTrigger,
  CollectionRunnerOwnerDecisionAction,
  CollectionRunnerPilotState,
  CollectionRunnerRecoveryControlIssueCode,
  CollectionRunnerRecoveryDisposition,
} from "../../contracts";
import {
  EventContractCollectionRunnerRecoveryControlEngine,
  EventContractCollectionRunnerRecoveryControlValidationError,
} from "./EventContractCollectionRunnerRecoveryControlEngine";

const engine = new EventContractCollectionRunnerRecoveryControlEngine();
const FP1 = "fnv1a64:1111111111111111";
const FP2 = "sha256:2222222222222222222222222222222222222222222222222222222222222222";

function activation(
  state = CollectionRunnerPilotState.Active,
): Record<string, unknown> {
  return {
    activationId: "activation:pilot-1",
    ownerId: "owner:alpha",
    state,
    aggregateVersion: 3,
    fingerprint: FP1,
    startsAtUtc: "2026-07-25T12:00:00.000Z",
    stopsAtUtc: "2026-07-25T20:00:00.000Z",
  };
}

function assessmentInput(
  changes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
    assessmentId: "recovery:assessment-1",
    policyVersion: "1.0",
    storeId: "collection-runner",
    storePathIdentity: FP2,
    schemaCatalogChecksum: FP2,
    recoveryReportFingerprint: FP1,
    inspectedAtUtc: "2026-07-25T13:00:00.000Z",
    activation: activation(),
    priorBootIdentity: "boot:old",
    proposedBootIdentity: "boot:new",
    proposedProcessSessionId: "process:new",
    clockHealth: CollectionRunnerClockHealth.Healthy,
    absoluteClockOffsetMilliseconds: 50,
    maximumClockOffsetMilliseconds: 1000,
    openLeaseCount: 0,
    unresolvedAttemptCount: 0,
    integrityBlockerCodes: [],
    restoredStorePendingSwitch: false,
    assessedAtUtc: "2026-07-25T13:00:01.000Z",
    expiresAtUtc: "2026-07-25T13:05:00.000Z",
    ...changes,
  };
}

function ownerAuthorization(
  ownerId = "owner:alpha",
): Record<string, unknown> {
  return {
    authorityKind: "LOCAL_OWNER_VERIFIED",
    ownerId,
    verifierId: "local-owner-verifier",
    verifierVersion: "1.0",
    authorizationReference: "authorization:1",
    challengeFingerprint: FP1,
    verifiedAtUtc: "2026-07-25T13:00:02.000Z",
    expiresAtUtc: "2026-07-25T13:04:00.000Z",
  };
}

function decisionInput(
  assessment = engine.createRecoveryAssessment(assessmentInput()),
  changes: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: COLLECTION_RUNNER_RECOVERY_CONTROL_SCHEMA_VERSION,
    decisionId: "recovery:decision-1",
    assessment,
    expectedActivationAggregateVersion:
      assessment.activation?.aggregateVersion ?? null,
    ownerAuthorization: ownerAuthorization(),
    action: CollectionRunnerOwnerDecisionAction.ApproveResume,
    reasonCode: "OWNER_REVIEWED_RECOVERY",
    decidedAtUtc: "2026-07-25T13:00:03.000Z",
    expiresAtUtc: "2026-07-25T13:03:00.000Z",
    proposedBootIdentity: "boot:new",
    proposedProcessSessionId: "process:new",
    emergencyStopObserved: false,
    ...changes,
  };
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function expectIssue(run: () => unknown, code: CollectionRunnerRecoveryControlIssueCode): void {
  try {
    run();
  } catch (error) {
    assertTrue(
      error instanceof EventContractCollectionRunnerRecoveryControlValidationError,
      "typed validation error",
    );
    assertTrue(
      (error as EventContractCollectionRunnerRecoveryControlValidationError)
        .issues.some((value) => value.code === code),
      `issue ${code}`,
    );
    return;
  }
  throw new Error(`Expected ${code}.`);
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  [
    "healthy active pilot is resume eligible",
    () => {
      const result = engine.createRecoveryAssessment(assessmentInput());
      assertEqual(
        result.disposition,
        CollectionRunnerRecoveryDisposition.ResumeEligible,
        "disposition",
      );
      assertEqual(result.resumeEligible, true, "resume eligible");
      assertTrue(Object.isFrozen(result), "immutable");
    },
  ],
  [
    "no operational pilot requires no resume",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(assessmentInput({ activation: null }))
          .disposition,
        CollectionRunnerRecoveryDisposition.NoResumeRequired,
        "disposition",
      ),
  ],
  [
    "open lease requires reconciliation",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(assessmentInput({ openLeaseCount: 1 }))
          .disposition,
        CollectionRunnerRecoveryDisposition.ReconciliationRequired,
        "disposition",
      ),
  ],
  [
    "stop requested permits stop completion only",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(
          assessmentInput({
            activation: activation(CollectionRunnerPilotState.StopRequested),
          }),
        ).disposition,
        CollectionRunnerRecoveryDisposition.StopCompletionOnly,
        "disposition",
      ),
  ],
  [
    "expired activation cannot resume",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(
          assessmentInput({
            assessedAtUtc: "2026-07-25T20:00:00.000Z",
            expiresAtUtc: "2026-07-25T20:05:00.000Z",
          }),
        ).disposition,
        CollectionRunnerRecoveryDisposition.ActivationExpired,
        "disposition",
      ),
  ],
  [
    "restored store requires a separate switch",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(
          assessmentInput({ restoredStorePendingSwitch: true }),
        ).disposition,
        CollectionRunnerRecoveryDisposition.StoreSwitchRequired,
        "disposition",
      ),
  ],
  [
    "integrity blocker requires fail closed",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(
          assessmentInput({ integrityBlockerCodes: ["COUNTER_DRIFT"] }),
        ).disposition,
        CollectionRunnerRecoveryDisposition.FailClosedRequired,
        "disposition",
      ),
  ],
  [
    "terminal pilot never resumes",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(
          assessmentInput({
            activation: activation(CollectionRunnerPilotState.Stopped),
          }),
        ).disposition,
        CollectionRunnerRecoveryDisposition.TerminalNoResume,
        "disposition",
      ),
  ],
  [
    "unhealthy clock fails closed",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(
          assessmentInput({ clockHealth: CollectionRunnerClockHealth.Unhealthy }),
        ).disposition,
        CollectionRunnerRecoveryDisposition.FailClosedRequired,
        "disposition",
      ),
  ],
  [
    "exact owner can approve eligible resume",
    () => {
      const result = engine.createOwnerRecoveryDecision(decisionInput());
      assertEqual(result.authorizesResume, true, "resume");
      assertEqual(result.authorizesMutation, true, "mutation");
      assertTrue(Object.isFrozen(result), "immutable");
    },
  ],
  [
    "wrong owner cannot authorize recovery",
    () =>
      expectIssue(
        () =>
          engine.createOwnerRecoveryDecision(
            decisionInput(undefined, {
              ownerAuthorization: ownerAuthorization("owner:other"),
            }),
          ),
        CollectionRunnerRecoveryControlIssueCode.InvalidAuthority,
      ),
  ],
  [
    "emergency stop invalidates approved resume",
    () =>
      expectIssue(
        () =>
          engine.createOwnerRecoveryDecision(
            decisionInput(undefined, { emergencyStopObserved: true }),
          ),
        CollectionRunnerRecoveryControlIssueCode.EmergencyStopPrecedence,
      ),
  ],
  [
    "reconciliation cannot directly approve resume",
    () => {
      const assessment = engine.createRecoveryAssessment(
        assessmentInput({ unresolvedAttemptCount: 1 }),
      );
      expectIssue(
        () => engine.createOwnerRecoveryDecision(decisionInput(assessment)),
        CollectionRunnerRecoveryControlIssueCode.InvalidDecision,
      );
    },
  ],
  [
    "terminal assessment permits rejection only",
    () => {
      const assessment = engine.createRecoveryAssessment(
        assessmentInput({
          activation: activation(CollectionRunnerPilotState.Completed),
        }),
      );
      expectIssue(
        () => engine.createOwnerRecoveryDecision(decisionInput(assessment)),
        CollectionRunnerRecoveryControlIssueCode.InvalidDecision,
      );
    },
  ],
  [
    "changed assessment fingerprint is rejected",
    () => {
      const assessment = {
        ...engine.createRecoveryAssessment(assessmentInput()),
        resumeEligible: false,
      };
      expectIssue(
        () => engine.verifyRecoveryAssessment(assessment),
        CollectionRunnerRecoveryControlIssueCode.InvalidDisposition,
      );
    },
  ],
  [
    "malformed and unknown assessment fields fail closed",
    () => {
      expectIssue(
        () => engine.verifyRecoveryAssessment({}),
        CollectionRunnerRecoveryControlIssueCode.InvalidRecord,
      );
      expectIssue(
        () =>
          engine.createRecoveryAssessment(
            assessmentInput({ executeTrade: true }),
          ),
        CollectionRunnerRecoveryControlIssueCode.UnknownField,
      );
    },
  ],
  [
    "owner stop request blocks resume and new work",
    () => {
      const result = engine.evaluateEmergencyStop({
        activationState: CollectionRunnerPilotState.Active,
        triggers: [CollectionRunnerEmergencyStopTrigger.OwnerRequest],
        evaluatedAtUtc: "2026-07-25T13:01:00.000Z",
      });
      assertEqual(
        result.directive,
        CollectionRunnerEmergencyStopDirective.RequestStop,
        "directive",
      );
      assertEqual(result.blocksResume, true, "resume");
      assertEqual(result.blocksNewWork, true, "work");
    },
  ],
  [
    "integrity failure requires failed closed",
    () =>
      assertEqual(
        engine.evaluateEmergencyStop({
          activationState: CollectionRunnerPilotState.Active,
          triggers: [
            CollectionRunnerEmergencyStopTrigger.IntegrityFailure,
          ],
          evaluatedAtUtc: "2026-07-25T13:01:00.000Z",
        }).directive,
        CollectionRunnerEmergencyStopDirective.FailClosed,
        "directive",
      ),
  ],
  [
    "terminal pilot ignores repeated stop request",
    () =>
      assertEqual(
        engine.evaluateEmergencyStop({
          activationState: CollectionRunnerPilotState.Stopped,
          triggers: [CollectionRunnerEmergencyStopTrigger.OwnerRequest],
          evaluatedAtUtc: "2026-07-25T13:01:00.000Z",
        }).directive,
        CollectionRunnerEmergencyStopDirective.NoStop,
        "directive",
      ),
  ],
  [
    "assessment creation is deterministic",
    () =>
      assertEqual(
        engine.createRecoveryAssessment(assessmentInput()).fingerprint,
        engine.createRecoveryAssessment(assessmentInput()).fingerprint,
        "fingerprint",
      ),
  ],
];

let passed = 0;
for (const [name, run] of tests) {
  try {
    run();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}
console.log(
  `Event Contract Collection Runner Recovery Control tests passed: ${String(passed)}/${String(tests.length)}.`,
);
