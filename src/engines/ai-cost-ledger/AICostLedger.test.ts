import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AICostLedgerAppendStatus,
  AICostLedgerBusinessOrderStatus,
  AICostLedgerEntryType,
  AICostLedgerErrorCategory,
  AICostLedgerReconciliationIssueCode,
  AICostLedgerReconciliationStatus,
  AICostLedgerRepositoryType,
  AICostLedgerSourceSubsystem,
  AITaskType,
  AIReservationLedgerInstructionType,
  AIReservationState,
  canonicalizeAICostLedgerValue,
  type AICostLedgerAppendRequest,
  type AICostLedgerEntry,
  type AICostLedgerEntryInput,
  type AICostLedgerPolicy,
  type AICostLedgerRepository,
  type AICostLedgerRepositoryAppendRequest,
  type AICostLedgerRepositoryAppendResult,
  type AIReservationLedgerInstruction,
} from "../../contracts";
import {
  AICostLedgerRepositoryCorruptionError,
  AICostLedgerRepositoryPathError,
  InMemoryAICostLedgerRepository,
  LocalNdjsonAICostLedgerRepository,
} from "../../repositories";
import {
  DeterministicAICostLedger,
  costLedgerEntryFromReservationInstruction,
} from "./AICostLedger";

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
  result: ReturnType<DeterministicAICostLedger["append"]>,
  category: AICostLedgerErrorCategory,
): void {
  assertEqual(result.status, AICostLedgerAppendStatus.Rejected, "append status");
  assertEqual(result.error?.category, category, "error category");
}

const policy: AICostLedgerPolicy = {
  policyId: "cost-ledger-policy",
  version: "cost-ledger-v1",
  allowOutOfOrderEvents: false,
  allowManualAdjustments: false,
  authorizedManualAdjustmentReferences: [],
  rejectSecretMetadataKeys: true,
};

function entry(
  entryType = AICostLedgerEntryType.ReservationAcquired,
  suffix = "1",
  amount = 1_000,
  timestamp = "2026-07-18T18:00:00.000Z",
): AICostLedgerEntryInput {
  const isUsage = [
    AICostLedgerEntryType.UsagePartiallyCommitted,
    AICostLedgerEntryType.UsageCommitted,
  ].includes(entryType);
  const isTerminal = [
    AICostLedgerEntryType.UsageCommitted,
    AICostLedgerEntryType.ReservationReleased,
    AICostLedgerEntryType.ReservationExpired,
    AICostLedgerEntryType.ReservationCancelled,
    AICostLedgerEntryType.ReservationRejected,
  ].includes(entryType);
  const before =
    entryType === AICostLedgerEntryType.ReservationAcquired ||
    entryType === AICostLedgerEntryType.ReservationCancelled ||
    entryType === AICostLedgerEntryType.ReservationRejected
      ? AIReservationState.Planned
      : entryType === AICostLedgerEntryType.UsagePartiallyCommitted
        ? AIReservationState.Reserved
        : AIReservationState.Reserved;
  const after =
    entryType === AICostLedgerEntryType.ReservationAcquired
      ? AIReservationState.Reserved
      : entryType === AICostLedgerEntryType.UsagePartiallyCommitted
        ? AIReservationState.PartiallyCommitted
        : entryType === AICostLedgerEntryType.UsageCommitted
          ? AIReservationState.Committed
          : entryType === AICostLedgerEntryType.ReservationReleased
            ? AIReservationState.Released
            : entryType === AICostLedgerEntryType.ReservationExpired
              ? AIReservationState.Expired
              : entryType === AICostLedgerEntryType.ReservationCancelled
                ? AIReservationState.Cancelled
                : entryType === AICostLedgerEntryType.ReservationRejected
                  ? AIReservationState.Rejected
                  : undefined;
  const reservationEvent = ![
    AICostLedgerEntryType.CriticalOverrideUsed,
    AICostLedgerEntryType.ManualAdjustment,
  ].includes(entryType);
  return {
    schemaVersion: "1.0",
    integrityVersion: "1.0",
    entryId: `entry-${suffix}`,
    requestId: `request-${suffix}`,
    ...(reservationEvent ? { reservationId: `reservation-${suffix}` } : {}),
    ...(isUsage ? { executionId: `execution-${suffix}` } : {}),
    operationId: `operation-${suffix}`,
    idempotencyKey: `idempotency-${suffix}`,
    entryType,
    amount: { minorUnits: amount, currency: "USD" },
    timestamp,
    policyVersion: "reservation-v1",
    ...(reservationEvent
      ? {
          reservationStateBefore: before,
          reservationStateAfter: after!,
          reservationVersion: isTerminal || isUsage ? 2 : 1,
        }
      : {}),
    providerId: "provider-a",
    modelId: "model-a",
    taskType: AITaskType.Summary,
    reasonCode: entryType,
    sourceSubsystem: AICostLedgerSourceSubsystem.ReservationManager,
    sourceAuditRecordId: `source-audit-${suffix}`,
    correlationId: `correlation-${suffix}`,
    traceId: `trace-${suffix}`,
    metadata: { fixture: true },
  };
}

function request(
  value: AICostLedgerEntryInput,
  requestPolicy = policy,
): AICostLedgerAppendRequest {
  return { entry: value, policy: requestPolicy };
}

function fixture(repository = new InMemoryAICostLedgerRepository()) {
  return { repository, ledger: new DeterministicAICostLedger(repository) };
}

function sequenced(
  input: AICostLedgerEntryInput,
  sequence: number,
): AICostLedgerEntry {
  return {
    ...structuredClone(input),
    sequence,
    businessOrderStatus: AICostLedgerBusinessOrderStatus.InOrder,
    payloadFingerprint: canonicalizeAICostLedgerValue(input),
  };
}

class UnsafeReadRepository implements AICostLedgerRepository {
  readonly repositoryType = AICostLedgerRepositoryType.InMemory;
  constructor(private readonly entries: ReadonlyArray<AICostLedgerEntry>) {}
  appendAtomically(_request: AICostLedgerRepositoryAppendRequest): AICostLedgerRepositoryAppendResult {
    return { appended: false };
  }
  getById(id: string) { return this.entries.find((value) => value.entryId === id); }
  getByIdempotencyKey(key: string) { return this.entries.find((value) => value.idempotencyKey === key); }
  getBySourceOperationId(id: string) { return this.entries.find((value) => value.operationId === id); }
  listBySequenceRange(from: number, to: number) { return this.entries.filter((value) => value.sequence >= from && value.sequence <= to); }
  listByRequestId(id: string) { return this.entries.filter((value) => value.requestId === id); }
  listByReservationId(id: string) { return this.entries.filter((value) => value.reservationId === id); }
  listByExecutionId(id: string) { return this.entries.filter((value) => value.executionId === id); }
  listByTimestampRange(from: string, to: string) { return this.entries.filter((value) => Date.parse(value.timestamp) >= Date.parse(from) && Date.parse(value.timestamp) <= Date.parse(to)); }
  listByProviderModelTask(providerId?: string, modelId?: string, taskType?: AITaskType) {
    return this.entries.filter((value) =>
      (providerId === undefined || value.providerId === providerId) &&
      (modelId === undefined || value.modelId === modelId) &&
      (taskType === undefined || value.taskType === taskType));
  }
  latestSequence() { return Math.max(0, ...this.entries.map((value) => value.sequence)); }
  allEntries() { return structuredClone(this.entries); }
}

function appendLifecycle(
  ledger: DeterministicAICostLedger,
  finalType: AICostLedgerEntryType.UsageCommitted | AICostLedgerEntryType.ReservationReleased,
): void {
  ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "life")));
  if (finalType === AICostLedgerEntryType.UsageCommitted) {
    ledger.append(
      request({
        ...entry(AICostLedgerEntryType.UsageCommitted, "life-commit"),
        requestId: "request-life",
        reservationId: "reservation-life",
      }),
    );
  } else {
    ledger.append(
      request({
        ...entry(AICostLedgerEntryType.UsagePartiallyCommitted, "life-part", 400),
        requestId: "request-life",
        reservationId: "reservation-life",
      }),
    );
    ledger.append(
      request({
        ...entry(AICostLedgerEntryType.ReservationReleased, "life-release", 600),
        requestId: "request-life",
        reservationId: "reservation-life",
        reservationStateBefore: AIReservationState.PartiallyCommitted,
        reservationVersion: 3,
      }),
    );
  }
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "appends a valid reservation acquisition",
    run: () => {
      const result = fixture().ledger.append(request(entry()));
      assertEqual(result.status, AICostLedgerAppendStatus.Appended, "status");
      assertEqual(result.entry?.sequence, 1, "sequence");
    },
  },
  {
    name: "appends a valid usage commitment",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "usage")));
      const result = ledger.append(request({
        ...entry(AICostLedgerEntryType.UsageCommitted, "usage-commit"),
        requestId: "request-usage",
        reservationId: "reservation-usage",
      }));
      assertEqual(result.entry?.entryType, AICostLedgerEntryType.UsageCommitted, "type");
    },
  },
  {
    name: "assigns monotonically increasing sequences",
    run: () => {
      const { ledger } = fixture();
      const first = ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "a")));
      const second = ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "b")));
      assertEqual(first.entry?.sequence, 1, "first");
      assertEqual(second.entry?.sequence, 2, "second");
    },
  },
  {
    name: "orders equal timestamps by sequence",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "b")));
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "a")));
      assertDeepEqual(ledger.query().entries.map((value) => value.entryId), ["entry-b", "entry-a"], "order");
    },
  },
  {
    name: "returns the original result for identical replay",
    run: () => {
      const { ledger, repository } = fixture();
      const value = request(entry());
      const first = ledger.append(value);
      assertDeepEqual(ledger.append(value), first, "replay changed");
      assertEqual(repository.latestSequence(), 1, "duplicate sequence");
    },
  },
  {
    name: "rejects conflicting idempotency payload",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      assertRejected(
        ledger.append(request({ ...entry("RESERVATION_ACQUIRED" as AICostLedgerEntryType), amount: { minorUnits: 999, currency: "USD" } })),
        AICostLedgerErrorCategory.IdempotencyConflict,
      );
    },
  },
  {
    name: "rejects duplicate entry ID",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      assertRejected(
        ledger.append(request({ ...entry(AICostLedgerEntryType.ReservationAcquired, "other"), entryId: "entry-1" })),
        AICostLedgerErrorCategory.DuplicateEntry,
      );
    },
  },
  {
    name: "rejects duplicate source operation ID",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      assertRejected(
        ledger.append(request({ ...entry(AICostLedgerEntryType.ReservationAcquired, "other"), operationId: "operation-1" })),
        AICostLedgerErrorCategory.DuplicateOperation,
      );
    },
  },
  {
    name: "rejects negative normal amount",
    run: () => {
      const { ledger } = fixture();
      assertRejected(
        ledger.append(request({ ...entry(), amount: { minorUnits: -1, currency: "USD" } })),
        AICostLedgerErrorCategory.InvalidAmount,
      );
    },
  },
  {
    name: "rejects unsafe normal amount",
    run: () => {
      const { ledger } = fixture();
      assertRejected(
        ledger.append(request({ ...entry(), amount: { minorUnits: Number.MAX_SAFE_INTEGER + 1, currency: "USD" } })),
        AICostLedgerErrorCategory.InvalidAmount,
      );
    },
  },
  {
    name: "rejects reservation currency mismatch",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      assertRejected(
        ledger.append(request({ ...entry(AICostLedgerEntryType.ReservationReleased, "release"), requestId: "request-1", reservationId: "reservation-1", amount: { minorUnits: 1_000, currency: "EUR" } })),
        AICostLedgerErrorCategory.CurrencyMismatch,
      );
    },
  },
  {
    name: "returns defensive entry copies",
    run: () => {
      const { ledger, repository } = fixture();
      ledger.append(request(entry()));
      const copy = repository.getById("entry-1") as { amount: { minorUnits: number } };
      copy.amount.minorUnits = 1;
      assertEqual(repository.getById("entry-1")?.amount.minorUnits, 1_000, "stored amount");
    },
  },
  {
    name: "queries by request ID",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "2")));
      assertEqual(ledger.query({ requestId: "request-1" }).count, 1, "count");
    },
  },
  {
    name: "queries by reservation ID",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      assertEqual(ledger.query({ reservationId: "reservation-1" }).entries[0]?.entryId, "entry-1", "entry");
    },
  },
  {
    name: "queries by execution ID",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.UsageCommitted, "usage")));
      assertEqual(ledger.query({ executionId: "execution-usage" }).count, 1, "count");
    },
  },
  {
    name: "queries by sequence range",
    run: () => {
      const { ledger } = fixture();
      for (const suffix of ["1", "2", "3"]) ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, suffix)));
      assertDeepEqual(ledger.query({ fromSequence: 2, toSequence: 3 }).entries.map((value) => value.sequence), [2, 3], "range");
    },
  },
  {
    name: "summarizes daily usage deterministically",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.UsageCommitted, "d1", 100, "2026-07-18T23:00:00.000Z")));
      ledger.append(request(entry(AICostLedgerEntryType.UsageCommitted, "d2", 200, "2026-07-19T00:00:00.000Z")));
      assertDeepEqual(ledger.summarize().byDay.map((value) => [value.key, value.committedMinorUnits]), [["2026-07-18", 100], ["2026-07-19", 200]], "daily");
    },
  },
  {
    name: "summarizes monthly usage deterministically",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.UsageCommitted, "m1", 100, "2026-07-31T23:59:59.000Z")));
      ledger.append(request(entry(AICostLedgerEntryType.UsageCommitted, "m2", 200, "2026-08-01T00:00:00.000Z")));
      assertDeepEqual(ledger.summarize().byMonth.map((value) => value.key), ["2026-07", "2026-08"], "months");
    },
  },
  {
    name: "summarizes provider model and task usage",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.UsageCommitted, "summary", 250)));
      const summary = ledger.summarize();
      assertEqual(summary.byProvider[0]?.key, "provider-a", "provider");
      assertEqual(summary.byModel[0]?.key, "model-a", "model");
      assertEqual(summary.byTaskType[0]?.key, AITaskType.Summary, "task");
    },
  },
  {
    name: "keeps different currencies separated",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.CriticalOverrideUsed, "usd", 100)));
      ledger.append(request({ ...entry(AICostLedgerEntryType.CriticalOverrideUsed, "eur", 200), amount: { minorUnits: 200, currency: "EUR" } }));
      assertDeepEqual(ledger.summarize().balances.map((value) => value.currency), ["EUR", "USD"], "currencies");
    },
  },
  {
    name: "detects commit without acquisition",
    run: () => {
      const bad = sequenced(entry(AICostLedgerEntryType.UsageCommitted, "bad"), 1);
      const result = new DeterministicAICostLedger(new UnsafeReadRepository([bad])).reconcileReservation("reservation-bad", "reconcile-1", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertTrue(result.issues.some((value) => value.code === AICostLedgerReconciliationIssueCode.CommitWithoutAcquisition), "missing issue");
    },
  },
  {
    name: "detects over-commit",
    run: () => {
      const acquired = sequenced(entry(AICostLedgerEntryType.ReservationAcquired, "over", 1_000), 1);
      const committed = sequenced({ ...entry(AICostLedgerEntryType.UsageCommitted, "over-commit", 1_001), requestId: "request-over", reservationId: "reservation-over" }, 2);
      const result = new DeterministicAICostLedger(new UnsafeReadRepository([acquired, committed])).reconcileReservation("reservation-over", "reconcile-over", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertTrue(result.issues.some((value) => value.code === AICostLedgerReconciliationIssueCode.CommittedExceedsReserved), "missing overcommit");
    },
  },
  {
    name: "detects committed plus released overflow",
    run: () => {
      const acquired = sequenced(entry(AICostLedgerEntryType.ReservationAcquired, "sum", 1_000), 1);
      const committed = sequenced({ ...entry(AICostLedgerEntryType.UsagePartiallyCommitted, "sum-commit", 700), requestId: "request-sum", reservationId: "reservation-sum" }, 2);
      const released = sequenced({ ...entry(AICostLedgerEntryType.ReservationReleased, "sum-release", 400), requestId: "request-sum", reservationId: "reservation-sum", reservationStateBefore: AIReservationState.PartiallyCommitted }, 3);
      const result = new DeterministicAICostLedger(new UnsafeReadRepository([acquired, committed, released])).reconcileReservation("reservation-sum", "reconcile-sum", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertTrue(result.issues.some((value) => value.code === AICostLedgerReconciliationIssueCode.SettlementExceedsReserved), "missing overflow");
    },
  },
  {
    name: "rejects duplicate execution settlement during append",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.UsagePartiallyCommitted, "dup", 100)));
      assertRejected(
        ledger.append(request({ ...entry(AICostLedgerEntryType.UsageCommitted, "dup-2", 100), executionId: "execution-dup" })),
        AICostLedgerErrorCategory.DuplicateExecutionSettlement,
      );
    },
  },
  {
    name: "rejects a second terminal reservation settlement during append",
    run: () => {
      const { ledger } = fixture();
      appendLifecycle(ledger, AICostLedgerEntryType.UsageCommitted);
      assertRejected(
        ledger.append(
          request({
            ...entry(
              AICostLedgerEntryType.ReservationReleased,
              "life-extra-release",
            ),
            requestId: "request-life",
            reservationId: "reservation-life",
            reservationStateBefore: AIReservationState.Committed,
          }),
        ),
        AICostLedgerErrorCategory.DuplicateReservationSettlement,
      );
    },
  },
  {
    name: "detects duplicate full settlement during reconciliation",
    run: () => {
      const acquired = sequenced(
        entry(AICostLedgerEntryType.ReservationAcquired, "terminal", 1_000),
        1,
      );
      const committed = sequenced(
        {
          ...entry(
            AICostLedgerEntryType.UsageCommitted,
            "terminal-commit",
            1_000,
          ),
          requestId: "request-terminal",
          reservationId: "reservation-terminal",
        },
        2,
      );
      const released = sequenced(
        {
          ...entry(
            AICostLedgerEntryType.ReservationReleased,
            "terminal-release",
            1,
          ),
          requestId: "request-terminal",
          reservationId: "reservation-terminal",
          reservationStateBefore: AIReservationState.Committed,
        },
        3,
      );
      const result = new DeterministicAICostLedger(
        new UnsafeReadRepository([acquired, committed, released]),
      ).reconcileReservation(
        "reservation-terminal",
        "reconcile-terminal",
        "2026-07-18T20:00:00.000Z",
        "ledger-v1",
      );
      assertTrue(
        result.issues.some(
          (value) =>
            value.code ===
            AICostLedgerReconciliationIssueCode.DuplicateFullSettlement,
        ),
        "missing duplicate terminal issue",
      );
    },
  },
  {
    name: "detects duplicate execution settlement during reconciliation",
    run: () => {
      const acquired = sequenced(entry(AICostLedgerEntryType.ReservationAcquired, "exec", 1_000), 1);
      const partial = sequenced({ ...entry(AICostLedgerEntryType.UsagePartiallyCommitted, "exec-part", 400), requestId: "request-exec", reservationId: "reservation-exec", executionId: "execution-repeat" }, 2);
      const final = sequenced({ ...entry(AICostLedgerEntryType.UsageCommitted, "exec-final", 600), requestId: "request-exec", reservationId: "reservation-exec", executionId: "execution-repeat", reservationStateBefore: AIReservationState.PartiallyCommitted }, 3);
      const result = new DeterministicAICostLedger(new UnsafeReadRepository([acquired, partial, final])).reconcileReservation("reservation-exec", "reconcile-exec", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertTrue(result.issues.some((value) => value.code === AICostLedgerReconciliationIssueCode.DuplicateExecutionSettlement), "missing duplicate");
    },
  },
  {
    name: "reports missing terminal settlement",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      const result = ledger.reconcileReservation("reservation-1", "reconcile-open", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertTrue(result.issues.some((value) => value.code === AICostLedgerReconciliationIssueCode.MissingFinalSettlement), "missing open issue");
    },
  },
  {
    name: "reconciles a valid full lifecycle",
    run: () => {
      const { ledger } = fixture();
      appendLifecycle(ledger, AICostLedgerEntryType.UsageCommitted);
      const result = ledger.reconcileReservation("reservation-life", "reconcile-life", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertEqual(result.status, AICostLedgerReconciliationStatus.Reconciled, "status");
      assertEqual(result.terminalState, AIReservationState.Committed, "terminal");
    },
  },
  {
    name: "reconciles partial commit plus release",
    run: () => {
      const { ledger } = fixture();
      appendLifecycle(ledger, AICostLedgerEntryType.ReservationReleased);
      const result = ledger.reconcileReservation("reservation-life", "reconcile-release", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertEqual(result.status, AICostLedgerReconciliationStatus.Reconciled, "status");
      assertEqual(result.committedMinorUnits, 400, "committed");
      assertEqual(result.releasedMinorUnits, 600, "released");
    },
  },
  {
    name: "lists unresolved active reservations",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "b")));
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "a")));
      assertDeepEqual(ledger.listUnresolvedReservationIds(), ["reservation-a", "reservation-b"], "unresolved");
    },
  },
  {
    name: "rejects out-of-order business timestamp by default",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "order", 1_000, "2026-07-18T19:00:00.000Z")));
      assertRejected(
        ledger.append(request({ ...entry(AICostLedgerEntryType.ReservationReleased, "order-release", 1_000, "2026-07-18T18:00:00.000Z"), requestId: "request-order", reservationId: "reservation-order" })),
        AICostLedgerErrorCategory.OutOfOrderEvent,
      );
    },
  },
  {
    name: "flags policy-authorized out-of-order event",
    run: () => {
      const { ledger } = fixture();
      const allowed = { ...policy, allowOutOfOrderEvents: true };
      ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "order", 1_000, "2026-07-18T19:00:00.000Z"), allowed));
      const result = ledger.append(request({ ...entry(AICostLedgerEntryType.ReservationReleased, "order-release", 1_000, "2026-07-18T18:00:00.000Z"), requestId: "request-order", reservationId: "reservation-order" }, allowed));
      assertEqual(result.entry?.businessOrderStatus, AICostLedgerBusinessOrderStatus.OutOfOrderAllowed, "flag");
    },
  },
  {
    name: "rejects secret-bearing metadata key",
    run: () => {
      const { ledger } = fixture();
      assertRejected(
        ledger.append(request({ ...entry(), metadata: { apiKey: "forbidden-fixture" } })),
        AICostLedgerErrorCategory.InvalidRequest,
      );
    },
  },
  {
    name: "rejects malformed schema version",
    run: () => {
      const { ledger } = fixture();
      assertRejected(
        ledger.append(request({ ...entry(), schemaVersion: "2.0" as "1.0" })),
        AICostLedgerErrorCategory.InvalidRequest,
      );
    },
  },
  {
    name: "rejects unauthorized manual adjustment",
    run: () => {
      const { ledger } = fixture();
      const manual = {
        ...entry(AICostLedgerEntryType.ManualAdjustment, "manual", 50),
        sourceSubsystem: AICostLedgerSourceSubsystem.OwnerAdjustment,
        manualAdjustment: { deltaMinorUnits: -50, authorizationReference: "owner-auth-1", ownerReason: "Correct verified billing discrepancy.", targetScope: "monthly" },
      };
      assertRejected(ledger.append(request(manual)), AICostLedgerErrorCategory.ManualAdjustmentNotAllowed);
    },
  },
  {
    name: "appends explicitly authorized signed manual adjustment",
    run: () => {
      const { ledger } = fixture();
      const allowed = { ...policy, allowManualAdjustments: true, authorizedManualAdjustmentReferences: ["owner-auth-1"] };
      const manual = {
        ...entry(AICostLedgerEntryType.ManualAdjustment, "manual", 50),
        sourceSubsystem: AICostLedgerSourceSubsystem.OwnerAdjustment,
        manualAdjustment: { deltaMinorUnits: -50, authorizationReference: "owner-auth-1", ownerReason: "Correct verified billing discrepancy.", targetScope: "monthly" },
      };
      assertEqual(ledger.append(request(manual, allowed)).status, AICostLedgerAppendStatus.Appended, "status");
      assertEqual(ledger.summarize().balances[0]?.manualAdjustmentMinorUnits, -50, "adjustment");
    },
  },
  {
    name: "translates Reservation Manager ledger instruction",
    run: () => {
      const instruction: AIReservationLedgerInstruction = {
        instructionId: "reservation-op:ledger",
        type: AIReservationLedgerInstructionType.ReservationAcquired,
        reservationId: "reservation-translate",
        requestId: "request-translate",
        operationId: "operation-translate",
        idempotencyKey: "idempotency-translate",
        amount: { minorUnits: 100, currency: "USD" },
        stateBefore: AIReservationState.Planned,
        stateAfter: AIReservationState.Reserved,
        timestamp: "2026-07-18T18:00:00.000Z",
        policyVersion: "reservation-v1",
        reason: "Acquire",
        resultingVersion: 1,
      };
      const translated = costLedgerEntryFromReservationInstruction(instruction, {
        entryId: instruction.instructionId,
        sourceAuditRecordId: "reservation-audit",
        correlationId: "correlation-translate",
      });
      assertEqual(translated.entryType, AICostLedgerEntryType.ReservationAcquired, "type");
      assertEqual(translated.sourceSubsystem, AICostLedgerSourceSubsystem.ReservationManager, "source");
    },
  },
  {
    name: "durable repository reload preserves entries",
    run: () => {
      const root = mkdtempSync(join(tmpdir(), "alpha-ledger-"));
      try {
        const first = new LocalNdjsonAICostLedgerRepository(root, "reload-ledger");
        new DeterministicAICostLedger(first).append(request(entry()));
        const reloaded = new LocalNdjsonAICostLedgerRepository(root, "reload-ledger");
        assertEqual(reloaded.getById("entry-1")?.sequence, 1, "reloaded sequence");
      } finally { rmSync(root, { recursive: true, force: true }); }
    },
  },
  {
    name: "durable append preserves prior bytes",
    run: () => {
      const root = mkdtempSync(join(tmpdir(), "alpha-ledger-"));
      try {
        const repository = new LocalNdjsonAICostLedgerRepository(root, "append-ledger");
        const ledger = new DeterministicAICostLedger(repository);
        ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "first")));
        const before = readFileSync(repository.getStoragePath(), "utf8");
        const size = statSync(repository.getStoragePath()).size;
        ledger.append(request(entry(AICostLedgerEntryType.ReservationAcquired, "second")));
        const after = readFileSync(repository.getStoragePath(), "utf8");
        assertTrue(after.startsWith(before), "prior record was rewritten");
        assertTrue(statSync(repository.getStoragePath()).size > size, "file did not grow");
      } finally { rmSync(root, { recursive: true, force: true }); }
    },
  },
  {
    name: "durable repository rejects corrupt JSON",
    run: () => {
      const root = mkdtempSync(join(tmpdir(), "alpha-ledger-"));
      try {
        writeFileSync(join(root, "corrupt.ndjson"), "{not-json}\n");
        let rejected = false;
        try { new LocalNdjsonAICostLedgerRepository(root, "corrupt"); }
        catch (error: unknown) { rejected = error instanceof AICostLedgerRepositoryCorruptionError; }
        assertTrue(rejected, "corruption was not normalized");
      } finally { rmSync(root, { recursive: true, force: true }); }
    },
  },
  {
    name: "durable repository rejects truncated final record",
    run: () => {
      const root = mkdtempSync(join(tmpdir(), "alpha-ledger-"));
      try {
        writeFileSync(join(root, "truncated.ndjson"), "{}");
        let rejected = false;
        try { new LocalNdjsonAICostLedgerRepository(root, "truncated"); }
        catch (error: unknown) { rejected = error instanceof AICostLedgerRepositoryCorruptionError; }
        assertTrue(rejected, "truncation was not rejected");
      } finally { rmSync(root, { recursive: true, force: true }); }
    },
  },
  {
    name: "durable repository rejects path traversal ledger ID",
    run: () => {
      const root = mkdtempSync(join(tmpdir(), "alpha-ledger-"));
      try {
        let rejected = false;
        try { new LocalNdjsonAICostLedgerRepository(root, "../escape"); }
        catch (error: unknown) { rejected = error instanceof AICostLedgerRepositoryPathError; }
        assertTrue(rejected, "traversal was not rejected");
      } finally { rmSync(root, { recursive: true, force: true }); }
    },
  },
  {
    name: "runtime ledger directory is ignored by Git rules",
    run: () => {
      const ignore = readFileSync(".gitignore", "utf8");
      assertTrue(ignore.includes("data/runtime/ai-cost-ledger/"), "runtime directory not ignored");
    },
  },
  {
    name: "append audit contains assigned sequence and repository type",
    run: () => {
      const result = fixture().ledger.append(request(entry()));
      assertEqual(result.auditRecord.assignedSequence, 1, "audit sequence");
      assertEqual(result.auditRecord.repositoryType, AICostLedgerRepositoryType.InMemory, "repository type");
    },
  },
  {
    name: "reconciliation audit contains ordered issues and source references",
    run: () => {
      const { ledger } = fixture();
      ledger.append(request(entry()));
      const result = ledger.reconcileReservation("reservation-1", "reconcile-audit", "2026-07-18T20:00:00.000Z", "ledger-v1");
      assertEqual(result.auditRecord.reconciliationIssues.length, 1, "issues");
      assertDeepEqual(result.auditRecord.sourceAuditReferences, ["source-audit-1"], "references");
    },
  },
  {
    name: "empty query is explicit and deterministic",
    run: () => {
      const result = fixture().ledger.query({ requestId: "missing" });
      assertEqual(result.count, 0, "count");
      assertDeepEqual(result.entries, [], "entries");
      assertEqual(result.latestSequence, 0, "latest");
    },
  },
  {
    name: "inputs are not mutated",
    run: () => {
      const { ledger } = fixture();
      const value = request(entry());
      const before = structuredClone(value);
      ledger.append(value);
      assertDeepEqual(value, before, "input mutated");
    },
  },
  {
    name: "same inputs produce the same ledger result",
    run: () => {
      const left = fixture().ledger.append(request(entry()));
      const right = fixture().ledger.append(request(entry()));
      assertDeepEqual(left, right, "determinism failure");
    },
  },
  {
    name: "implementation contains no provider SDK or network call",
    run: () => {
      const implementation = readFileSync("src/engines/ai-cost-ledger/AICostLedger.ts", "utf8");
      const repository = readFileSync("src/repositories/LocalNdjsonAICostLedgerRepository.ts", "utf8");
      assertTrue(!/from ["'](?:openai|@anthropic|@google)|\bfetch\s*\(|XMLHttpRequest|WebSocket|https?\.request|axios/i.test(`${implementation}\n${repository}`), "forbidden integration");
    },
  },
];

let passed = 0;
for (const test of tests) {
  test.run();
  passed += 1;
}

console.log(`AI Cost Ledger tests passed: ${passed}/${tests.length}`);
