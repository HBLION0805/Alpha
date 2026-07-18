import {
  AIReservationErrorCategory,
  AIReservationLedgerInstructionType,
  AIReservationOperationType,
  AIReservationResultStatus,
  AIReservationState,
  BudgetReservationStatus,
  CostDecisionReason,
  CostDecisionStatus,
  type AIAcquireReservationRequest,
  type AICommitReservationRequest,
  type AIExpireReservationRequest,
  type AIReleaseReservationRequest,
  type AIReservationPolicy,
  type BudgetReservation,
  type CostGovernorDecision,
} from "../../contracts";
import { InMemoryAIReservationRepository } from "../../repositories";
import { DeterministicAIReservationManager } from "./AIReservationManager";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(
      `${message}: expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

function assertRejected(
  result: ReturnType<DeterministicAIReservationManager["process"]>,
  category: AIReservationErrorCategory,
): void {
  assertEqual(result.status, AIReservationResultStatus.Rejected, "result status");
  assertEqual(result.error?.category, category, "error category");
}

const createdAt = "2026-07-18T18:00:00.000Z";
const expiresAt = "2026-07-18T19:00:00.000Z";
const policy: AIReservationPolicy = {
  policyId: "reservation-policy",
  version: "reservation-v1",
  allowPartialCommit: true,
  expiration: {
    allowAdministrativeEarlyExpiration: false,
    allowCommitAfterExpiration: false,
  },
};

function plan(
  minorUnits = 1_000,
  currency = "USD",
  reservationId = "reservation-1",
  requestId = "request-1",
): BudgetReservation {
  return {
    reservationId,
    requestId,
    amount: { minorUnits, currency },
    applicableScopes: [],
    createdAt,
    expiresAt,
    status: BudgetReservationStatus.Planned,
    policyVersion: policy.version,
  };
}

function decision(reservationPlan = plan()): CostGovernorDecision {
  return {
    decisionId: `${reservationPlan.requestId}:cost:${policy.version}`,
    requestId: reservationPlan.requestId,
    timestamp: createdAt,
    policyVersion: policy.version,
    status: CostDecisionStatus.Allowed,
    reasons: [CostDecisionReason.AllHardLimitsSatisfied],
    estimatedCost: { ...reservationPlan.amount },
    scopeEvaluations: [],
    unavailableScopes: [],
    lowCostRequired: false,
    requiredOverrideMinorUnits: 0,
    reservation: structuredClone(reservationPlan),
  };
}

function acquireRequest(
  overrides: Partial<AIAcquireReservationRequest> = {},
): AIAcquireReservationRequest {
  const reservationPlan = plan();
  return {
    operationId: "operation-acquire-1",
    idempotencyKey: "idem-acquire-1",
    operationType: AIReservationOperationType.Acquire,
    reservationId: reservationPlan.reservationId,
    requestId: reservationPlan.requestId,
    timestamp: createdAt,
    expectedVersion: 0,
    policy,
    reason: "Reserve approved estimated cost.",
    costDecision: decision(reservationPlan),
    reservationPlan,
    ...overrides,
  };
}

function commitRequest(
  overrides: Partial<AICommitReservationRequest> = {},
): AICommitReservationRequest {
  return {
    operationId: "operation-commit-1",
    idempotencyKey: "idem-commit-1",
    operationType: AIReservationOperationType.Commit,
    reservationId: "reservation-1",
    requestId: "request-1",
    timestamp: "2026-07-18T18:10:00.000Z",
    expectedVersion: 1,
    policy,
    reason: "Commit actual provider usage.",
    executionId: "execution-1",
    actualUsage: { minorUnits: 1_000, currency: "USD" },
    ...overrides,
  };
}

function releaseRequest(
  overrides: Partial<AIReleaseReservationRequest> = {},
): AIReleaseReservationRequest {
  return {
    operationId: "operation-release-1",
    idempotencyKey: "idem-release-1",
    operationType: AIReservationOperationType.Release,
    reservationId: "reservation-1",
    requestId: "request-1",
    timestamp: "2026-07-18T18:15:00.000Z",
    expectedVersion: 1,
    policy,
    reason: "Release unused reserved budget.",
    ...overrides,
  };
}

function expireRequest(
  overrides: Partial<AIExpireReservationRequest> = {},
): AIExpireReservationRequest {
  return {
    operationId: "operation-expire-1",
    idempotencyKey: "idem-expire-1",
    operationType: AIReservationOperationType.Expire,
    reservationId: "reservation-1",
    requestId: "request-1",
    timestamp: expiresAt,
    expectedVersion: 1,
    policy,
    reason: "Expire stale reservation.",
    administrative: false,
    ...overrides,
  };
}

function fixture(): {
  repository: InMemoryAIReservationRepository;
  manager: DeterministicAIReservationManager;
} {
  const repository = new InMemoryAIReservationRepository();
  return {
    repository,
    manager: new DeterministicAIReservationManager(repository),
  };
}

function acquiredFixture() {
  const value = fixture();
  const result = value.manager.process(acquireRequest());
  assertEqual(result.status, AIReservationResultStatus.Applied, "acquire setup");
  return value;
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "acquires an approved planned reservation",
    run: () => {
      const { manager } = fixture();
      const result = manager.process(acquireRequest());
      assertEqual(result.record?.state, AIReservationState.Reserved, "state");
      assertEqual(result.record?.version, 1, "version");
      assertEqual(result.record?.remainingAmount.minorUnits, 1_000, "remaining");
    },
  },
  {
    name: "replays an identical acquire exactly",
    run: () => {
      const { manager } = fixture();
      const request = acquireRequest();
      const first = manager.process(request);
      assertDeepEqual(manager.process(request), first, "replayed result changed");
    },
  },
  {
    name: "rejects duplicate acquire under a different idempotency key",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(
          acquireRequest({ operationId: "acquire-2", idempotencyKey: "idem-2" }),
        ),
        AIReservationErrorCategory.DuplicateReservation,
      );
    },
  },
  {
    name: "rejects empty operation identity",
    run: () => {
      const { manager } = fixture();
      assertRejected(
        manager.process(acquireRequest({ operationId: "" })),
        AIReservationErrorCategory.InvalidRequest,
      );
    },
  },
  {
    name: "rejects a negative reservation amount",
    run: () => {
      const { manager } = fixture();
      const badPlan = plan(-1);
      assertRejected(
        manager.process(
          acquireRequest({ reservationPlan: badPlan, costDecision: decision(badPlan) }),
        ),
        AIReservationErrorCategory.AmountInvalid,
      );
    },
  },
  {
    name: "rejects an unsafe reservation amount",
    run: () => {
      const { manager } = fixture();
      const badPlan = plan(Number.MAX_SAFE_INTEGER + 1);
      assertRejected(
        manager.process(
          acquireRequest({ reservationPlan: badPlan, costDecision: decision(badPlan) }),
        ),
        AIReservationErrorCategory.AmountInvalid,
      );
    },
  },
  {
    name: "rejects cost decision currency mismatch",
    run: () => {
      const { manager } = fixture();
      const reservationPlan = plan();
      const costDecision = decision(reservationPlan);
      const mismatched = {
        ...costDecision,
        estimatedCost: { minorUnits: 1_000, currency: "EUR" },
      };
      assertRejected(
        manager.process(acquireRequest({ reservationPlan, costDecision: mismatched })),
        AIReservationErrorCategory.CurrencyMismatch,
      );
    },
  },
  {
    name: "fully commits exact actual usage",
    run: () => {
      const { manager } = acquiredFixture();
      const result = manager.process(commitRequest());
      assertEqual(result.record?.state, AIReservationState.Committed, "state");
      assertEqual(result.record?.committedAmount.minorUnits, 1_000, "committed");
      assertEqual(result.record?.remainingAmount.minorUnits, 0, "remaining");
    },
  },
  {
    name: "partially commits actual usage",
    run: () => {
      const { manager } = acquiredFixture();
      const result = manager.process(
        commitRequest({ actualUsage: { minorUnits: 400, currency: "USD" } }),
      );
      assertEqual(result.record?.state, AIReservationState.PartiallyCommitted, "state");
      assertEqual(result.record?.remainingAmount.minorUnits, 600, "remaining");
    },
  },
  {
    name: "rejects commit exceeding remaining reservation",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(
          commitRequest({ actualUsage: { minorUnits: 1_001, currency: "USD" } }),
        ),
        AIReservationErrorCategory.AmountExceedsReservation,
      );
    },
  },
  {
    name: "replays an identical commit without double spend",
    run: () => {
      const { manager, repository } = acquiredFixture();
      const request = commitRequest();
      const first = manager.process(request);
      assertDeepEqual(manager.process(request), first, "commit replay changed");
      assertEqual(repository.getById("reservation-1")?.version, 2, "version");
    },
  },
  {
    name: "rejects conflicting commit payload under the same key",
    run: () => {
      const { manager } = acquiredFixture();
      manager.process(
        commitRequest({ actualUsage: { minorUnits: 400, currency: "USD" } }),
      );
      assertRejected(
        manager.process(
          commitRequest({ actualUsage: { minorUnits: 500, currency: "USD" } }),
        ),
        AIReservationErrorCategory.IdempotencyConflict,
      );
    },
  },
  {
    name: "supports partial then final commit across distinct executions",
    run: () => {
      const { manager } = acquiredFixture();
      manager.process(
        commitRequest({ actualUsage: { minorUnits: 400, currency: "USD" } }),
      );
      const final = manager.process(
        commitRequest({
          operationId: "commit-2",
          idempotencyKey: "commit-idem-2",
          expectedVersion: 2,
          executionId: "execution-2",
          actualUsage: { minorUnits: 600, currency: "USD" },
        }),
      );
      assertEqual(final.record?.state, AIReservationState.Committed, "state");
      assertEqual(final.record?.version, 3, "version");
    },
  },
  {
    name: "releases a fully unused reservation",
    run: () => {
      const { manager } = acquiredFixture();
      const result = manager.process(releaseRequest());
      assertEqual(result.record?.state, AIReservationState.Released, "state");
      assertEqual(result.record?.releasedAmount.minorUnits, 1_000, "released");
    },
  },
  {
    name: "replays an identical release exactly once",
    run: () => {
      const { manager, repository } = acquiredFixture();
      const request = releaseRequest();
      const first = manager.process(request);
      assertDeepEqual(manager.process(request), first, "release replay changed");
      assertEqual(repository.getById("reservation-1")?.version, 2, "version");
    },
  },
  {
    name: "preserves committed usage when releasing remainder",
    run: () => {
      const { manager } = acquiredFixture();
      manager.process(
        commitRequest({ actualUsage: { minorUnits: 400, currency: "USD" } }),
      );
      const result = manager.process(
        releaseRequest({ expectedVersion: 2, executionId: "execution-1" }),
      );
      assertEqual(result.record?.committedAmount.minorUnits, 400, "committed");
      assertEqual(result.record?.releasedAmount.minorUnits, 600, "released");
    },
  },
  {
    name: "rejects release from committed terminal state",
    run: () => {
      const { manager } = acquiredFixture();
      manager.process(commitRequest());
      assertRejected(
        manager.process(releaseRequest({ expectedVersion: 2 })),
        AIReservationErrorCategory.InvalidStateTransition,
      );
    },
  },
  {
    name: "expires reservation at its deadline",
    run: () => {
      const { manager } = acquiredFixture();
      const result = manager.process(expireRequest());
      assertEqual(result.record?.state, AIReservationState.Expired, "state");
      assertEqual(result.record?.releasedAmount.minorUnits, 1_000, "released");
    },
  },
  {
    name: "rejects early expiration",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(
          expireRequest({ timestamp: "2026-07-18T18:59:59.999Z" }),
        ),
        AIReservationErrorCategory.NotExpired,
      );
    },
  },
  {
    name: "replays expiration exactly once",
    run: () => {
      const { manager, repository } = acquiredFixture();
      const request = expireRequest();
      const first = manager.process(request);
      assertDeepEqual(manager.process(request), first, "expire replay changed");
      assertEqual(repository.getById("reservation-1")?.version, 2, "version");
    },
  },
  {
    name: "rejects stale expected version",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(commitRequest({ expectedVersion: 0 })),
        AIReservationErrorCategory.VersionConflict,
      );
    },
  },
  {
    name: "increments version once per applied transition",
    run: () => {
      const { manager } = acquiredFixture();
      const partial = manager.process(
        commitRequest({ actualUsage: { minorUnits: 100, currency: "USD" } }),
      );
      assertEqual(partial.record?.version, 2, "partial version");
      const release = manager.process(
        releaseRequest({ expectedVersion: 2, executionId: "execution-1" }),
      );
      assertEqual(release.record?.version, 3, "release version");
    },
  },
  {
    name: "is deterministic across fresh repositories",
    run: () => {
      const left = fixture().manager.process(acquireRequest());
      const right = fixture().manager.process(acquireRequest());
      assertDeepEqual(left, right, "fresh runs differ");
    },
  },
  {
    name: "does not mutate caller input",
    run: () => {
      const { manager } = fixture();
      const request = acquireRequest();
      const before = structuredClone(request);
      manager.process(request);
      assertDeepEqual(request, before, "input mutated");
    },
  },
  {
    name: "repository returns defensive record copies",
    run: () => {
      const { repository } = acquiredFixture();
      const copy = repository.getById("reservation-1") as {
        remainingAmount: { minorUnits: number };
      };
      copy.remainingAmount.minorUnits = 1;
      assertEqual(repository.getById("reservation-1")?.remainingAmount.minorUnits, 1_000, "stored amount");
    },
  },
  {
    name: "repository prevents duplicate atomic create",
    run: () => {
      const { repository } = acquiredFixture();
      const stored = repository.getById("reservation-1");
      assertTrue(stored !== undefined, "missing stored record");
      assertEqual(repository.create(stored!), false, "duplicate create");
    },
  },
  {
    name: "repository supports operation lookup by key and ID",
    run: () => {
      const { repository } = acquiredFixture();
      assertEqual(repository.getOperationByIdempotencyKey("idem-acquire-1")?.operationId, "operation-acquire-1", "key lookup");
      assertEqual(repository.getOperationById("operation-acquire-1")?.idempotencyKey, "idem-acquire-1", "ID lookup");
    },
  },
  {
    name: "applied result always emits a ledger instruction",
    run: () => {
      const result = fixture().manager.process(acquireRequest());
      assertTrue(result.ledgerInstruction !== undefined, "missing instruction");
      assertEqual(result.ledgerInstruction?.type, AIReservationLedgerInstructionType.ReservationAcquired, "instruction type");
    },
  },
  {
    name: "every result includes structured audit metadata",
    run: () => {
      const result = fixture().manager.process(acquireRequest());
      assertEqual(result.auditRecord.operationId, result.operationId, "operation audit");
      assertTrue(result.auditRecord.validationChecks.length > 0, "validation audit");
    },
  },
  {
    name: "rejects mismatched Cost Governor decision identity",
    run: () => {
      const { manager } = fixture();
      const reservationPlan = plan();
      const costDecision = { ...decision(reservationPlan), requestId: "other" };
      assertRejected(
        manager.process(acquireRequest({ costDecision })),
        AIReservationErrorCategory.ReservationMismatch,
      );
    },
  },
  {
    name: "rejects operation request identity mismatch",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(commitRequest({ requestId: "other-request" })),
        AIReservationErrorCategory.ReservationMismatch,
      );
    },
  },
  {
    name: "rejects duplicate execution reference after partial commit",
    run: () => {
      const { manager } = acquiredFixture();
      manager.process(
        commitRequest({ actualUsage: { minorUnits: 400, currency: "USD" } }),
      );
      assertRejected(
        manager.process(
          commitRequest({
            operationId: "commit-other",
            idempotencyKey: "commit-other-key",
            expectedVersion: 2,
            executionId: "execution-1",
            actualUsage: { minorUnits: 600, currency: "USD" },
          }),
        ),
        AIReservationErrorCategory.ExecutionReferenceMismatch,
      );
    },
  },
  {
    name: "rejects release with an unrelated execution reference",
    run: () => {
      const { manager } = acquiredFixture();
      manager.process(
        commitRequest({ actualUsage: { minorUnits: 400, currency: "USD" } }),
      );
      assertRejected(
        manager.process(
          releaseRequest({
            expectedVersion: 2,
            executionId: "execution-other",
          }),
        ),
        AIReservationErrorCategory.ExecutionReferenceMismatch,
      );
    },
  },
  {
    name: "rejects duplicate operation ID with a different key",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(
          releaseRequest({ operationId: "operation-acquire-1", idempotencyKey: "new-key" }),
        ),
        AIReservationErrorCategory.RepositoryConflict,
      );
    },
  },
  {
    name: "rejects commit currency mismatch",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(commitRequest({ actualUsage: { minorUnits: 1_000, currency: "EUR" } })),
        AIReservationErrorCategory.CurrencyMismatch,
      );
    },
  },
  {
    name: "rejects zero actual usage",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(commitRequest({ actualUsage: { minorUnits: 0, currency: "USD" } })),
        AIReservationErrorCategory.AmountInvalid,
      );
    },
  },
  {
    name: "rejects unsafe actual usage",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(commitRequest({ actualUsage: { minorUnits: Number.MAX_SAFE_INTEGER + 1, currency: "USD" } })),
        AIReservationErrorCategory.AmountInvalid,
      );
    },
  },
  {
    name: "rejects commit after expiration by default",
    run: () => {
      const { manager } = acquiredFixture();
      assertRejected(
        manager.process(commitRequest({ timestamp: expiresAt })),
        AIReservationErrorCategory.ReservationExpired,
      );
    },
  },
  {
    name: "allows policy-authorized administrative early expiration",
    run: () => {
      const repository = new InMemoryAIReservationRepository();
      const manager = new DeterministicAIReservationManager(repository);
      const administrativePolicy: AIReservationPolicy = {
        ...policy,
        version: "reservation-administrative-v1",
        expiration: { ...policy.expiration, allowAdministrativeEarlyExpiration: true },
      };
      const reservationPlan = {
        ...plan(),
        policyVersion: administrativePolicy.version,
      };
      const costDecision = {
        ...decision(reservationPlan),
        decisionId: "request-1:cost:reservation-administrative-v1",
        policyVersion: administrativePolicy.version,
        reservation: reservationPlan,
      };
      manager.process(
        acquireRequest({
          policy: administrativePolicy,
          reservationPlan,
          costDecision,
        }),
      );
      const result = manager.process(
        expireRequest({
          timestamp: "2026-07-18T18:30:00.000Z",
          administrative: true,
          policy: administrativePolicy,
        }),
      );
      assertEqual(result.record?.state, AIReservationState.Expired, "state");
    },
  },
  {
    name: "allows commit after expiration when original policy permits",
    run: () => {
      const repository = new InMemoryAIReservationRepository();
      const manager = new DeterministicAIReservationManager(repository);
      const permissive: AIReservationPolicy = {
        ...policy,
        version: "reservation-v2",
        expiration: { ...policy.expiration, allowCommitAfterExpiration: true },
      };
      const reservationPlan = { ...plan(), policyVersion: permissive.version };
      const costDecision = {
        ...decision(reservationPlan),
        decisionId: "request-1:cost:reservation-v2",
        policyVersion: permissive.version,
        reservation: reservationPlan,
      };
      manager.process(acquireRequest({ policy: permissive, reservationPlan, costDecision }));
      const result = manager.process(commitRequest({ policy: permissive, timestamp: expiresAt }));
      assertEqual(result.record?.state, AIReservationState.Committed, "state");
    },
  },
  {
    name: "rejects partial commit when policy disables it",
    run: () => {
      const repository = new InMemoryAIReservationRepository();
      const manager = new DeterministicAIReservationManager(repository);
      const noPartial: AIReservationPolicy = { ...policy, version: "no-partial", allowPartialCommit: false };
      const reservationPlan = { ...plan(), policyVersion: noPartial.version };
      const costDecision = {
        ...decision(reservationPlan),
        decisionId: "request-1:cost:no-partial",
        policyVersion: noPartial.version,
        reservation: reservationPlan,
      };
      manager.process(acquireRequest({ policy: noPartial, reservationPlan, costDecision }));
      assertRejected(
        manager.process(commitRequest({ policy: noPartial, actualUsage: { minorUnits: 400, currency: "USD" } })),
        AIReservationErrorCategory.InvalidStateTransition,
      );
    },
  },
  {
    name: "records a cancelled planning outcome idempotently",
    run: () => {
      const { manager } = fixture();
      const base = acquireRequest();
      const request = { ...base, operationType: AIReservationOperationType.Cancel as const };
      const first = manager.process(request);
      assertEqual(first.record?.state, AIReservationState.Cancelled, "state");
      assertDeepEqual(manager.process(request), first, "cancel replay changed");
    },
  },
  {
    name: "records an explicitly rejected planning outcome",
    run: () => {
      const { manager } = fixture();
      const base = acquireRequest();
      const result = manager.process({
        ...base,
        operationType: AIReservationOperationType.Reject,
      });
      assertEqual(result.record?.state, AIReservationState.Rejected, "state");
      assertEqual(result.record?.releasedAmount.minorUnits, 1_000, "released");
    },
  },
  {
    name: "lists expired active reservations in stable order",
    run: () => {
      const repository = new InMemoryAIReservationRepository();
      const manager = new DeterministicAIReservationManager(repository);
      for (const suffix of ["b", "a"]) {
        const reservationPlan = plan(1_000, "USD", `reservation-${suffix}`, `request-${suffix}`);
        manager.process(
          acquireRequest({
            operationId: `acquire-${suffix}`,
            idempotencyKey: `key-${suffix}`,
            reservationId: reservationPlan.reservationId,
            requestId: reservationPlan.requestId,
            reservationPlan,
            costDecision: decision(reservationPlan),
          }),
        );
      }
      assertDeepEqual(
        repository.listExpiredActive(expiresAt).map((record) => record.reservationId),
        ["reservation-a", "reservation-b"],
        "expired order",
      );
    },
  },
  {
    name: "repository compare-and-set rejects stale writes",
    run: () => {
      const { repository } = acquiredFixture();
      const record = repository.getById("reservation-1");
      assertTrue(record !== undefined, "record missing");
      const result = repository.compareAndSet("reservation-1", 0, { ...record!, version: 1 });
      assertEqual(result.updated, false, "stale CAS");
      assertEqual(result.current?.version, 1, "current version");
    },
  },
  {
    name: "maintains the reservation amount conservation invariant",
    run: () => {
      const { manager } = acquiredFixture();
      manager.process(
        commitRequest({ actualUsage: { minorUnits: 350, currency: "USD" } }),
      );
      const result = manager.process(
        releaseRequest({ expectedVersion: 2, executionId: "execution-1" }),
      );
      const record = result.record!;
      assertEqual(
        record.committedAmount.minorUnits + record.releasedAmount.minorUnits + record.remainingAmount.minorUnits,
        record.reservedAmount.minorUnits,
        "amount conservation",
      );
    },
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`AI Reservation Manager tests passed: ${passed}/${tests.length}`);
