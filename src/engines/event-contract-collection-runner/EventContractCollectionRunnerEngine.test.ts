import {
  EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
  CollectionRunnerIssueCode,
  CollectionRunnerPilotState,
  CollectionRunnerSourceLane,
  CollectionRunnerTaskState,
  EventContractSourceCapability,
  EventContractSourceExecutionMode,
  type CollectionRunnerPilotActivation,
} from "../../contracts";
import {
  EventContractCollectionRunnerEngine,
  EventContractCollectionRunnerValidationError,
} from "./EventContractCollectionRunnerEngine";

const engine = new EventContractCollectionRunnerEngine();
const FP_BUILD = "fnv1a64:1111111111111111";
const FP_PLAN = "fnv1a64:2222222222222222";
const FP_PROVIDER = "fnv1a64:3333333333333333";
const FP_MAPPING = "fnv1a64:4444444444444444";

function definitionInput(): Record<string, unknown> {
  return {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    runnerDefinitionId: "event-contract-runner:pilot",
    version: "1.0",
    buildFingerprint: FP_BUILD,
    supportedCapabilities: [
      EventContractSourceCapability.Settlement,
      EventContractSourceCapability.TopOfBook,
    ],
    maximumActivePilots: 1,
    maximumWorkers: 1,
    maximumInFlightRequests: 1,
    maximumRequestsPerSecond: 1,
    maximumClockOffsetMilliseconds: 1000,
  };
}

function activationInput(): Record<string, unknown> {
  return {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    activationId: "activation:pilot-1",
    ownerId: "owner:alpha",
    approvedAt: "2026-07-24T12:00:00.000Z",
    startsAt: "2026-07-24T13:00:00.000Z",
    stopsAt: "2026-07-25T13:00:00.000Z",
    frozenPlanId: "plan:btc15m:1",
    frozenPlanFingerprint: FP_PLAN,
    runnerDefinition: engine.createRunnerDefinition(definitionInput()),
    admittedProviderFingerprints: [FP_PROVIDER],
    admittedMappingFingerprints: [FP_MAPPING],
    maximumEvents: 10,
    maximumRequests: 20,
  };
}

function activation(): CollectionRunnerPilotActivation {
  return engine.createPilotActivation(activationInput());
}

function taskInput(
  changes: Record<string, unknown> = {},
  admissionChanges: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: EVENT_CONTRACT_COLLECTION_RUNNER_SCHEMA_VERSION,
    taskId: "task:event-1:settlement",
    observationSlot: "settlement",
    scheduledAt: "2026-07-24T13:15:00.000Z",
    deadlineAt: "2026-07-25T12:00:00.000Z",
    runnerDefinitionVersion: "1.0",
    admission: {
      frozenPlanId: "plan:btc15m:1",
      frozenPlanFingerprint: FP_PLAN,
      plannedEventId: "event:btc15m:1",
      evidenceCutoffAt: "2026-07-24T13:30:00.000Z",
      providerId: "provider:exchange",
      providerFingerprint: FP_PROVIDER,
      capability: EventContractSourceCapability.Settlement,
      executionMode: EventContractSourceExecutionMode.BoundedLiveRead,
      sourceLane: CollectionRunnerSourceLane.Exchange,
      mappingId: "mapping:rh:exchange:1",
      mappingVersion: "1.0",
      mappingFingerprint: FP_MAPPING,
      sourceRecordId: "market:btc15m:1",
      requestPolicyId: "policy:bounded:1",
      requestPolicyVersion: "1.0",
      bounds: {
        maximumAttempts: 2,
        maximumRawPayloadBytes: 100_000,
        maximumRecordCount: 1,
        requestDeadlineMilliseconds: 5_000,
      },
      activationId: "activation:pilot-1",
      activationExpiresAt: "2026-07-25T13:00:00.000Z",
      ...admissionChanges,
    },
    ...changes,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

function expectIssue(run: () => unknown, code: CollectionRunnerIssueCode): void {
  try {
    run();
  } catch (error) {
    if (error instanceof EventContractCollectionRunnerValidationError
      && error.issues.some((issue) => issue.code === code)) return;
    throw error;
  }
  throw new Error(`Expected issue ${code}.`);
}

const tests: readonly { readonly name: string; readonly run: () => void }[] = [
  {
    name: "runner definition is normalized immutable and research-only",
    run: () => {
      const result = engine.createRunnerDefinition(definitionInput());
      equal(result.supportedCapabilities[0], EventContractSourceCapability.Settlement, "sorted capabilities");
      assert(Object.isFrozen(result) && Object.isFrozen(result.supportedCapabilities), "definition must be deeply frozen");
      assert(result.readOnlySourceAccess, "source access must be read only");
    },
  },
  {
    name: "runner definition fingerprint is deterministic",
    run: () => {
      const left = engine.createRunnerDefinition(definitionInput());
      const reversed = definitionInput();
      reversed.supportedCapabilities = [...(reversed.supportedCapabilities as string[])].reverse();
      const right = engine.createRunnerDefinition(reversed);
      equal(left.fingerprint, right.fingerprint, "definition fingerprint");
    },
  },
  {
    name: "runner definition rejects unknown fields",
    run: () => expectIssue(
      () => engine.createRunnerDefinition({ ...definitionInput(), leverage: 3 }),
      CollectionRunnerIssueCode.UnknownField,
    ),
  },
  {
    name: "runner definition rejects duplicate capabilities",
    run: () => expectIssue(
      () => engine.createRunnerDefinition({
        ...definitionInput(),
        supportedCapabilities: [EventContractSourceCapability.Settlement, EventContractSourceCapability.Settlement],
      }),
      CollectionRunnerIssueCode.InvalidEnum,
    ),
  },
  {
    name: "runner definition ceilings cannot be widened",
    run: () => expectIssue(
      () => engine.createRunnerDefinition({ ...definitionInput(), maximumWorkers: 2 }),
      CollectionRunnerIssueCode.InvalidBound,
    ),
  },
  {
    name: "runner definition verification detects tampering",
    run: () => {
      const valid = engine.createRunnerDefinition(definitionInput());
      expectIssue(
        () => engine.verifyRunnerDefinition({ ...valid, version: "2.0" }),
        CollectionRunnerIssueCode.InvalidFingerprint,
      );
    },
  },
  {
    name: "pilot activation starts owner-approved at aggregate version one",
    run: () => {
      const result = activation();
      equal(result.state, CollectionRunnerPilotState.OwnerApproved, "activation state");
      equal(result.aggregateVersion, 1, "activation version");
      assert(Object.isFrozen(result.runnerDefinition), "nested definition must remain immutable");
    },
  },
  {
    name: "pilot activation normalizes admitted sets",
    run: () => {
      const input = activationInput();
      input.admittedMappingFingerprints = ["fnv1a64:5555555555555555", FP_MAPPING];
      const result = engine.createPilotActivation(input);
      equal(result.admittedMappingFingerprints[0], FP_MAPPING, "mapping set order");
    },
  },
  {
    name: "pilot activation rejects approval after start",
    run: () => expectIssue(
      () => engine.createPilotActivation({ ...activationInput(), approvedAt: "2026-07-24T14:00:00.000Z" }),
      CollectionRunnerIssueCode.InvalidChronology,
    ),
  },
  {
    name: "pilot activation rejects non-forward stop",
    run: () => expectIssue(
      () => engine.createPilotActivation({ ...activationInput(), stopsAt: "2026-07-24T13:00:00.000Z" }),
      CollectionRunnerIssueCode.InvalidChronology,
    ),
  },
  {
    name: "pilot activation window is bounded to seven days",
    run: () => expectIssue(
      () => engine.createPilotActivation({ ...activationInput(), stopsAt: "2026-08-01T13:00:00.001Z" }),
      CollectionRunnerIssueCode.InvalidBound,
    ),
  },
  {
    name: "pilot activation requires at least one provider",
    run: () => expectIssue(
      () => engine.createPilotActivation({ ...activationInput(), admittedProviderFingerprints: [] }),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "pilot activation rejects duplicate authority fingerprints",
    run: () => expectIssue(
      () => engine.createPilotActivation({ ...activationInput(), admittedProviderFingerprints: [FP_PROVIDER, FP_PROVIDER] }),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "pilot request budget cannot be smaller than event budget",
    run: () => expectIssue(
      () => engine.createPilotActivation({ ...activationInput(), maximumEvents: 10, maximumRequests: 9 }),
      CollectionRunnerIssueCode.InvalidBound,
    ),
  },
  {
    name: "pilot activation rejects nested runner authority tampering",
    run: () => {
      const input = activationInput();
      input.runnerDefinition = { ...(input.runnerDefinition as object), maximumWorkers: 2 };
      expectIssue(() => engine.createPilotActivation(input), CollectionRunnerIssueCode.InvalidBound);
    },
  },
  {
    name: "exchange scheduled task binds exact authority and idempotency",
    run: () => {
      const result = engine.createScheduledTask(taskInput(), activation());
      equal(result.state, CollectionRunnerTaskState.Scheduled, "task state");
      equal(result.aggregateVersion, 1, "task version");
      assert(/^fnv1a64:[a-f0-9]{16}$/u.test(result.idempotencyKey), "idempotency key");
      assert(Object.isFrozen(result.admission.bounds), "task must be deeply frozen");
    },
  },
  {
    name: "scheduled task is deterministic",
    run: () => {
      const active = activation();
      const left = engine.createScheduledTask(taskInput(), active);
      const right = engine.createScheduledTask(taskInput(), active);
      equal(left.fingerprint, right.fingerprint, "task fingerprint");
      equal(left.idempotencyKey, right.idempotencyKey, "idempotency");
    },
  },
  {
    name: "idempotency changes with each identity component",
    run: () => {
      const active = activation();
      const base = engine.createScheduledTask(taskInput(), active).idempotencyKey;
      const variants = [
        taskInput({}, { plannedEventId: "event:btc15m:2" }),
        taskInput({}, { sourceRecordId: "market:btc15m:2" }),
        taskInput({ observationSlot: "settlement:second" }),
        taskInput({ runnerDefinitionVersion: "1.1" }),
      ];
      for (const variant of variants) {
        const customActivation = variant.runnerDefinitionVersion === "1.1"
          ? engine.createPilotActivation({
              ...activationInput(),
              runnerDefinition: engine.createRunnerDefinition({ ...definitionInput(), version: "1.1" }),
            })
          : active;
        assert(engine.createScheduledTask(variant, customActivation).idempotencyKey !== base, "identity change must change idempotency");
      }
    },
  },
  {
    name: "exchange task requires complete mapping identity",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { mappingFingerprint: null }), activation()),
      CollectionRunnerIssueCode.MappingRequired,
    ),
  },
  {
    name: "platform task rejects exchange mapping",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { sourceLane: CollectionRunnerSourceLane.Platform }), activation()),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "platform task without mapping is valid",
    run: () => {
      const input = activationInput();
      input.admittedMappingFingerprints = [];
      const active = engine.createPilotActivation(input);
      const result = engine.createScheduledTask(taskInput({}, {
        sourceLane: CollectionRunnerSourceLane.Platform,
        mappingId: null,
        mappingVersion: null,
        mappingFingerprint: null,
      }), active);
      equal(result.admission.mappingFingerprint, null, "platform mapping");
    },
  },
  {
    name: "task rejects undeclared nested execution field",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { orderSide: "BUY" }), activation()),
      CollectionRunnerIssueCode.UnknownField,
    ),
  },
  {
    name: "task rejects provider not admitted by activation",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { providerFingerprint: "fnv1a64:9999999999999999" }), activation()),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "task rejects mapping not admitted by activation",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { mappingFingerprint: "fnv1a64:9999999999999999" }), activation()),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "task rejects unsupported runner capability",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { capability: EventContractSourceCapability.Trades }), activation()),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "task rejects frozen-plan mismatch",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { frozenPlanFingerprint: "fnv1a64:9999999999999999" }), activation()),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "task rejects activation identity mismatch",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({}, { activationId: "activation:other" }), activation()),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "task rejects runner-definition version mismatch",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({ runnerDefinitionVersion: "2.0" }), activation()),
      CollectionRunnerIssueCode.InvalidAdmission,
    ),
  },
  {
    name: "task rejects scheduling after evidence cutoff",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({ scheduledAt: "2026-07-24T13:31:00.000Z" }), activation()),
      CollectionRunnerIssueCode.InvalidChronology,
    ),
  },
  {
    name: "task rejects deadline before evidence cutoff",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({ deadlineAt: "2026-07-24T13:29:59.999Z" }), activation()),
      CollectionRunnerIssueCode.InvalidChronology,
    ),
  },
  {
    name: "task rejects deadline after activation expiry",
    run: () => expectIssue(
      () => engine.createScheduledTask(taskInput({ deadlineAt: "2026-07-25T13:00:00.001Z" }), activation()),
      CollectionRunnerIssueCode.InvalidChronology,
    ),
  },
  {
    name: "task rejects more than two attempts",
    run: () => {
      const input = taskInput();
      (input.admission as Record<string, unknown>).bounds = {
        ...((input.admission as Record<string, unknown>).bounds as object),
        maximumAttempts: 3,
      };
      expectIssue(() => engine.createScheduledTask(input, activation()), CollectionRunnerIssueCode.InvalidBound);
    },
  },
  {
    name: "task rejects unsafe and non-positive bounds",
    run: () => {
      const input = taskInput();
      (input.admission as Record<string, unknown>).bounds = {
        ...((input.admission as Record<string, unknown>).bounds as object),
        maximumRawPayloadBytes: Number.MAX_SAFE_INTEGER + 1,
        maximumRecordCount: 0,
      };
      expectIssue(() => engine.createScheduledTask(input, activation()), CollectionRunnerIssueCode.InvalidBound);
    },
  },
  {
    name: "all declared pilot transition edges succeed",
    run: () => {
      const edges: readonly [CollectionRunnerPilotState, CollectionRunnerPilotState][] = [
        [CollectionRunnerPilotState.Draft, CollectionRunnerPilotState.OwnerApproved],
        [CollectionRunnerPilotState.OwnerApproved, CollectionRunnerPilotState.Active],
        [CollectionRunnerPilotState.OwnerApproved, CollectionRunnerPilotState.Revoked],
        [CollectionRunnerPilotState.Active, CollectionRunnerPilotState.StopRequested],
        [CollectionRunnerPilotState.Active, CollectionRunnerPilotState.Revoked],
        [CollectionRunnerPilotState.Active, CollectionRunnerPilotState.Completed],
        [CollectionRunnerPilotState.Active, CollectionRunnerPilotState.FailedClosed],
        [CollectionRunnerPilotState.StopRequested, CollectionRunnerPilotState.Stopped],
        [CollectionRunnerPilotState.StopRequested, CollectionRunnerPilotState.Revoked],
        [CollectionRunnerPilotState.StopRequested, CollectionRunnerPilotState.FailedClosed],
      ];
      for (const [current, next] of edges) {
        const result = engine.transitionPilot({
          current: { activationId: "activation:pilot-1", state: current, aggregateVersion: 7 },
          expectedAggregateVersion: 7,
          nextState: next,
        });
        equal(result.state, next, "pilot next state");
        equal(result.aggregateVersion, 8, "pilot next version");
      }
    },
  },
  {
    name: "all declared task transition edges succeed",
    run: () => {
      const edges: readonly [CollectionRunnerTaskState, CollectionRunnerTaskState][] = [
        [CollectionRunnerTaskState.Scheduled, CollectionRunnerTaskState.Blocked],
        [CollectionRunnerTaskState.Scheduled, CollectionRunnerTaskState.Due],
        [CollectionRunnerTaskState.Blocked, CollectionRunnerTaskState.Due],
        [CollectionRunnerTaskState.Due, CollectionRunnerTaskState.Leased],
        [CollectionRunnerTaskState.Leased, CollectionRunnerTaskState.InFlight],
        [CollectionRunnerTaskState.InFlight, CollectionRunnerTaskState.Validating],
        [CollectionRunnerTaskState.InFlight, CollectionRunnerTaskState.RetryWait],
        [CollectionRunnerTaskState.Validating, CollectionRunnerTaskState.Committed],
        [CollectionRunnerTaskState.Validating, CollectionRunnerTaskState.RetryWait],
        [CollectionRunnerTaskState.RetryWait, CollectionRunnerTaskState.Due],
      ];
      const nonterminal = [
        CollectionRunnerTaskState.Scheduled,
        CollectionRunnerTaskState.Blocked,
        CollectionRunnerTaskState.Due,
        CollectionRunnerTaskState.Leased,
        CollectionRunnerTaskState.InFlight,
        CollectionRunnerTaskState.Validating,
        CollectionRunnerTaskState.RetryWait,
      ];
      for (const state of nonterminal) {
        for (const terminal of [
          CollectionRunnerTaskState.Missed,
          CollectionRunnerTaskState.TerminalFailed,
          CollectionRunnerTaskState.Cancelled,
        ]) {
          const result = engine.transitionTask({
            current: { taskId: "task:event-1:settlement", state, aggregateVersion: 3 },
            expectedAggregateVersion: 3,
            nextState: terminal,
          });
          equal(result.state, terminal, "task terminal edge");
        }
      }
      for (const [current, next] of edges) {
        const result = engine.transitionTask({
          current: { taskId: "task:event-1:settlement", state: current, aggregateVersion: 3 },
          expectedAggregateVersion: 3,
          nextState: next,
        });
        equal(result.state, next, "task next state");
        equal(result.aggregateVersion, 4, "task next version");
      }
    },
  },
  {
    name: "stale aggregate version fails closed",
    run: () => expectIssue(
      () => engine.transitionTask({
        current: { taskId: "task:event-1:settlement", state: CollectionRunnerTaskState.Due, aggregateVersion: 3 },
        expectedAggregateVersion: 2,
        nextState: CollectionRunnerTaskState.Leased,
      }),
      CollectionRunnerIssueCode.VersionConflict,
    ),
  },
  {
    name: "same-state transition fails closed",
    run: () => expectIssue(
      () => engine.transitionPilot({
        current: { activationId: "activation:pilot-1", state: CollectionRunnerPilotState.Active, aggregateVersion: 3 },
        expectedAggregateVersion: 3,
        nextState: CollectionRunnerPilotState.Active,
      }),
      CollectionRunnerIssueCode.InvalidTransition,
    ),
  },
  {
    name: "skipped and reverse transitions fail closed",
    run: () => {
      expectIssue(
        () => engine.transitionTask({
          current: { taskId: "task:event-1:settlement", state: CollectionRunnerTaskState.Scheduled, aggregateVersion: 1 },
          expectedAggregateVersion: 1,
          nextState: CollectionRunnerTaskState.Committed,
        }),
        CollectionRunnerIssueCode.InvalidTransition,
      );
      expectIssue(
        () => engine.transitionTask({
          current: { taskId: "task:event-1:settlement", state: CollectionRunnerTaskState.Validating, aggregateVersion: 6 },
          expectedAggregateVersion: 6,
          nextState: CollectionRunnerTaskState.InFlight,
        }),
        CollectionRunnerIssueCode.InvalidTransition,
      );
    },
  },
  {
    name: "terminal pilot and task states cannot transition",
    run: () => {
      expectIssue(
        () => engine.transitionPilot({
          current: { activationId: "activation:pilot-1", state: CollectionRunnerPilotState.Completed, aggregateVersion: 4 },
          expectedAggregateVersion: 4,
          nextState: CollectionRunnerPilotState.Active,
        }),
        CollectionRunnerIssueCode.TerminalState,
      );
      expectIssue(
        () => engine.transitionTask({
          current: { taskId: "task:event-1:settlement", state: CollectionRunnerTaskState.Committed, aggregateVersion: 7 },
          expectedAggregateVersion: 7,
          nextState: CollectionRunnerTaskState.Due,
        }),
        CollectionRunnerIssueCode.TerminalState,
      );
    },
  },
  {
    name: "transition rejects unknown fields and invalid enums",
    run: () => {
      expectIssue(
        () => engine.transitionPilot({
          current: { activationId: "activation:pilot-1", state: CollectionRunnerPilotState.Active, aggregateVersion: 2 },
          expectedAggregateVersion: 2,
          nextState: CollectionRunnerPilotState.StopRequested,
          force: true,
        }),
        CollectionRunnerIssueCode.UnknownField,
      );
      expectIssue(
        () => engine.transitionTask({
          current: { taskId: "task:event-1:settlement", state: "RUNNING", aggregateVersion: 2 },
          expectedAggregateVersion: 2,
          nextState: CollectionRunnerTaskState.Validating,
        }),
        CollectionRunnerIssueCode.InvalidEnum,
      );
    },
  },
];

let passed = 0;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
    console.log(`PASS ${test.name}`);
  } catch (error) {
    console.error(`FAIL ${test.name}`);
    throw error;
  }
}

console.log(`Event Contract Collection Runner tests passed: ${passed}/${tests.length}.`);
