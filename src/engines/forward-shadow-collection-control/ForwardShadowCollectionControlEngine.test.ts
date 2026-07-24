import {
  FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
  ForwardShadowCollectionAuthorizationStatus,
  ForwardShadowCollectionEventStatus,
  ForwardShadowCollectionIssueCode,
  ForwardShadowCollectionProgressStatus,
  type ForwardShadowCollectionProgressInput,
} from "../../contracts";
import { InMemoryEventContractShadowLedgerRepository } from "../../repositories/InMemoryEventContractShadowLedgerRepository";
import { EventContractShadowLedgerService } from "../event-contract-shadow-ledger";
import {
  validShadowObservationInput,
  validShadowSettlementInput,
} from "../event-contract-shadow-ledger/EventContractShadowLedger.fixtures";
import {
  ForwardShadowCollectionControlEngine,
  ForwardShadowCollectionControlValidationError,
} from "./ForwardShadowCollectionControlEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}
function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

const engine = new ForwardShadowCollectionControlEngine();

function planRequest(eventCount = 2) {
  return {
    schemaVersion: FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
    planId: "collection-plan:btc-15m:forward:001",
    planVersion: "1.0",
    createdAt: "2026-07-23T20:29:00.000Z",
    firstCutoffAt: "2026-07-23T20:45:00.000Z",
    eventCount,
  } as const;
}

function history(settled: boolean) {
  const repository = new InMemoryEventContractShadowLedgerRepository();
  const ledger = new EventContractShadowLedgerService(repository);
  const observation = ledger.capture(validShadowObservationInput(), "2026-07-23T20:42:28.000Z").record;
  if (settled) ledger.settle(validShadowSettlementInput(), "2026-07-23T20:45:02.000Z");
  const result = ledger.history(observation.observationId);
  if (result === undefined) throw new Error("Fixture history is missing.");
  return result;
}

function progressInput(histories = [history(true)], eventCount = 2, asOfTime = "2026-07-23T20:50:00.000Z"): ForwardShadowCollectionProgressInput {
  return {
    schemaVersion: FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
    auditId: "collection-progress:btc-15m:001",
    asOfTime,
    collectionPlan: engine.createPlan(planRequest(eventCount)).collectionPlan,
    histories,
  };
}

function changed(mutator: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(progressInput()) as unknown as Record<string, unknown>;
  mutator(draft);
  return draft;
}

function expectValidation(value: unknown, code: ForwardShadowCollectionIssueCode): void {
  try { engine.createPlan(value); }
  catch (error) {
    assertTrue(error instanceof ForwardShadowCollectionControlValidationError, "typed validation error");
    assertTrue((error as ForwardShadowCollectionControlValidationError).issues.some((entry) => entry.code === code), `issue ${code}`);
    return;
  }
  throw new Error("Expected validation error.");
}

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["creates an immutable continuous UTC plan", () => {
    const result = engine.createPlan(planRequest());
    assertEqual(result.collectionPlan.plannedEvents[0]?.eventId, "event:btc-15m:20260723-2045", "first event");
    assertEqual(result.collectionPlan.plannedEvents[1]?.cutoffAt, "2026-07-23T21:00:00.000Z", "second cutoff");
    assertTrue(Object.isFrozen(result.collectionPlan.plannedEvents), "frozen events");
    assertEqual(result.authorizationStatus, ForwardShadowCollectionAuthorizationStatus.ResearchOnly, "authority");
  }],
  ["identical plan request is deterministic", () => {
    assertEqual(engine.createPlan(planRequest()).fingerprint, engine.createPlan(planRequest()).fingerprint, "fingerprint");
  }],
  ["plan frozen at first cutoff fails closed", () => {
    expectValidation({ ...planRequest(), createdAt: "2026-07-23T20:45:00.000Z" }, ForwardShadowCollectionIssueCode.PlanFrozenTooLate);
  }],
  ["misaligned first cutoff fails closed", () => {
    expectValidation({ ...planRequest(), firstCutoffAt: "2026-07-23T20:46:00.000Z" }, ForwardShadowCollectionIssueCode.InvalidCutoffAlignment);
  }],
  ["event count is bounded", () => {
    expectValidation({ ...planRequest(), eventCount: 100_001 }, ForwardShadowCollectionIssueCode.InvalidEventCount);
  }],
  ["undeclared plan request field fails closed", () => {
    expectValidation({ ...planRequest(), recommendedSide: "UP" }, ForwardShadowCollectionIssueCode.InvalidRecord);
  }],
  ["settled candidate and overdue missing remain distinct", () => {
    const result = engine.auditProgress(progressInput());
    assertEqual(result.status, ForwardShadowCollectionProgressStatus.InProgress, "status");
    assertEqual(result.events[0]?.status, ForwardShadowCollectionEventStatus.SettledCandidate, "first status");
    assertEqual(result.events[1]?.status, ForwardShadowCollectionEventStatus.Upcoming, "second status");
    assertEqual(result.metrics.settlementCoverageBasisPoints, 5_000, "settlement coverage");
  }],
  ["unsettled capture is explicit", () => {
    const result = engine.auditProgress(progressInput([history(false)], 1));
    assertEqual(result.events[0]?.status, ForwardShadowCollectionEventStatus.CapturedUnsettled, "event status");
    assertEqual(result.metrics.capturedCount, 1, "captured count");
    assertEqual(result.metrics.settledCandidateCount, 0, "settled count");
  }],
  ["complete settled plan becomes ready for explicit binding", () => {
    const result = engine.auditProgress(progressInput([history(true)], 1));
    assertEqual(result.status, ForwardShadowCollectionProgressStatus.ReadyForBinding, "status");
    assertEqual(result.events[0]?.settledObservationIds.length, 1, "settled candidates");
  }],
  ["passed cutoff without observation is overdue missing", () => {
    const result = engine.auditProgress(progressInput([], 1, "2026-07-23T20:46:00.000Z"));
    assertEqual(result.events[0]?.status, ForwardShadowCollectionEventStatus.OverdueMissing, "event status");
    assertEqual(result.metrics.missingCount, 1, "missing count");
  }],
  ["duplicate observation identity blocks progress", () => {
    const item = history(true);
    const result = engine.auditProgress(progressInput([item, item], 1));
    assertEqual(result.status, ForwardShadowCollectionProgressStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ForwardShadowCollectionIssueCode.DuplicateObservation), "duplicate issue");
  }],
  ["tampered observation blocks progress", () => {
    const result = engine.auditProgress(changed((draft) => {
      const histories = draft["histories"] as Array<Record<string, unknown>>;
      const observation = histories[0]!["observation"] as Record<string, unknown>;
      observation["fingerprint"] = "fnv1a64:0000000000000000";
    }));
    assertEqual(result.status, ForwardShadowCollectionProgressStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ForwardShadowCollectionIssueCode.InvalidObservation), "observation issue");
  }],
  ["observation captured after audit time blocks", () => {
    const result = engine.auditProgress(progressInput([history(false)], 1, "2026-07-23T20:40:00.000Z"));
    assertEqual(result.status, ForwardShadowCollectionProgressStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ForwardShadowCollectionIssueCode.ObservationAfterAudit), "future observation issue");
  }],
  ["settlement known after audit time blocks", () => {
    const result = engine.auditProgress(progressInput([history(true)], 1, "2026-07-23T20:44:00.000Z"));
    assertEqual(result.status, ForwardShadowCollectionProgressStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ForwardShadowCollectionIssueCode.SettlementAfterAudit), "future settlement issue");
  }],
  ["plan event identity cannot be rewritten", () => {
    const result = engine.auditProgress(changed((draft) => {
      const plan = draft["collectionPlan"] as Record<string, unknown>;
      (plan["plannedEvents"] as Array<Record<string, unknown>>)[0]!["eventId"] = "event:btc-15m:rewritten";
    }));
    assertEqual(result.status, ForwardShadowCollectionProgressStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ForwardShadowCollectionIssueCode.InvalidPlan), "plan issue");
  }],
  ["history input order cannot change progress fingerprint", () => {
    const input = progressInput([history(true)], 1);
    assertEqual(engine.auditProgress(input).fingerprint, engine.auditProgress({ ...input, histories: [...input.histories].reverse() }).fingerprint, "fingerprint");
  }],
];

for (const [name, run] of tests) run();
console.log(`Forward Shadow Collection Control tests passed: ${tests.length}/${tests.length}.`);
