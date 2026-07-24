import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EventContractObservationSide,
  EventContractShadowAppendStatus,
  EventContractShadowAuthorizationStatus,
  EventContractShadowErrorCategory,
  EventContractShadowOutcomeStatus,
} from "../../contracts";
import {
  InMemoryEventContractShadowLedgerRepository,
  LocalNdjsonEventContractShadowLedgerRepository,
} from "../../repositories";
import {
  EventContractShadowLedgerError,
  EventContractShadowLedgerService,
  canonicalizeEventContractShadowValue,
  createEventContractSettlement,
  deriveEventContractShadowOutcomes,
  eventContractShadowFingerprint,
  validateShadowQuery,
  validateStoredEventContractObservation,
  validateStoredEventContractSettlement,
} from "./EventContractShadowLedgerEngine";
import { EventContractObservationEngine } from "../event-contract-observation";
import { validShadowObservationInput, validShadowSettlementInput } from "./EventContractShadowLedger.fixtures";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: values differ.`);
}

function changed<T>(value: T, update: (draft: Record<string, unknown>) => void): unknown {
  const draft = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  update(draft);
  return draft;
}

function expectCategory(run: () => unknown, category: EventContractShadowErrorCategory): void {
  try { run(); } catch (error: unknown) {
    assertTrue(error instanceof EventContractShadowLedgerError, "typed shadow-ledger error");
    assertEqual((error as EventContractShadowLedgerError).category, category, "error category");
    return;
  }
  throw new Error(`Expected ${category}.`);
}

function fixture() {
  const repository = new InMemoryEventContractShadowLedgerRepository();
  return { repository, service: new EventContractShadowLedgerService(repository) };
}

const acceptedObservationAt = "2026-07-23T20:42:28.000Z";
const acceptedSettlementAt = "2026-07-23T20:45:02.000Z";

const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["capture appends immutable observation", () => {
    const { service } = fixture();
    const result = service.capture(validShadowObservationInput(), acceptedObservationAt);
    assertEqual(result.status, EventContractShadowAppendStatus.Appended, "append status");
    assertTrue(Object.isFrozen(result.record), "observation frozen");
  }],
  ["capture is exact-replay idempotent", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    assertEqual(service.capture(validShadowObservationInput(), acceptedObservationAt).status, EventContractShadowAppendStatus.Replayed, "replay status");
  }],
  ["same observation ID with different content conflicts", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    const alternate = validShadowObservationInput();
    expectCategory(() => service.capture({ ...alternate, referencePrice: { ...alternate.referencePrice, price: { atomicValue: "6474488", scale: 2 } } }, acceptedObservationAt), EventContractShadowErrorCategory.IdempotencyConflict);
  }],
  ["capture acceptance cannot predate capture", () => {
    const { service } = fixture();
    expectCategory(() => service.capture(validShadowObservationInput(), "2026-07-23T20:42:26.999Z"), EventContractShadowErrorCategory.InvalidTimestamp);
  }],
  ["settlement appends after observation", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    assertEqual(service.settle(validShadowSettlementInput(), acceptedSettlementAt).repositorySequence, 2, "settlement sequence");
  }],
  ["settlement requires existing observation", () => {
    const { service } = fixture();
    expectCategory(() => service.settle(validShadowSettlementInput(), acceptedSettlementAt), EventContractShadowErrorCategory.RecordNotFound);
  }],
  ["settlement binds exact terms", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    expectCategory(() => service.settle(changed(validShadowSettlementInput(), (draft) => { draft["termsId"] = "terms:other"; }), acceptedSettlementAt), EventContractShadowErrorCategory.InvalidReference);
  }],
  ["settlement binds exact contract", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    expectCategory(() => service.settle(changed(validShadowSettlementInput(), (draft) => { draft["contractId"] = "contract:other"; }), acceptedSettlementAt), EventContractShadowErrorCategory.InvalidReference);
  }],
  ["settlement binds source", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    expectCategory(() => service.settle(changed(validShadowSettlementInput(), (draft) => { draft["settlementSourceId"] = "source:other"; }), acceptedSettlementAt), EventContractShadowErrorCategory.InvalidReference);
  }],
  ["settlement cannot predate evaluation", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    expectCategory(() => service.settle(changed(validShadowSettlementInput(), (draft) => { draft["settledAt"] = "2026-07-23T20:44:59.999Z"; }), acceptedSettlementAt), EventContractShadowErrorCategory.InvalidTimestamp);
  }],
  ["settlement acceptance cannot predate settlement", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    expectCategory(() => service.settle(validShadowSettlementInput(), "2026-07-23T20:45:00.999Z"), EventContractShadowErrorCategory.InvalidTimestamp);
  }],
  ["settlement rejects undeclared fields", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    expectCategory(() => service.settle(changed(validShadowSettlementInput(), (draft) => { draft["order"] = "BUY"; }), acceptedSettlementAt), EventContractShadowErrorCategory.InvalidRecord);
  }],
  ["same settlement ID exact replay is idempotent", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    service.settle(validShadowSettlementInput(), acceptedSettlementAt);
    assertEqual(service.settle(validShadowSettlementInput(), acceptedSettlementAt).status, EventContractShadowAppendStatus.Replayed, "settlement replay");
  }],
  ["observation permits only one settlement", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    service.settle(validShadowSettlementInput(), acceptedSettlementAt);
    const second = { ...validShadowSettlementInput(), settlementId: "settlement:btc:second" };
    expectCategory(() => service.settle(second, acceptedSettlementAt), EventContractShadowErrorCategory.DuplicateSettlement);
  }],
  ["DOWN win outcome is fee-inclusive", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    service.settle(validShadowSettlementInput(), acceptedSettlementAt);
    const outcomes = service.history(validShadowObservationInput().observationId)?.sideOutcomes ?? [];
    assertEqual(outcomes[0]?.side, EventContractObservationSide.Up, "UP first");
    assertEqual(outcomes[0]?.status, EventContractShadowOutcomeStatus.Lost, "UP lost");
    assertDeepEqual(outcomes[0]?.netResult, { atomicValue: "-467", scale: 2 }, "UP net");
    assertDeepEqual(outcomes[1]?.netResult, { atomicValue: "224", scale: 2 }, "DOWN net");
  }],
  ["UP win outcome is fee-inclusive", () => {
    const observation = new EventContractObservationEngine().create(validShadowObservationInput());
    const settlement = createEventContractSettlement({ ...validShadowSettlementInput(), winningSide: EventContractObservationSide.Up }, observation);
    const outcomes = deriveEventContractShadowOutcomes(observation, settlement);
    assertDeepEqual(outcomes[0]?.netResult, { atomicValue: "9533", scale: 2 }, "UP net");
    assertDeepEqual(outcomes[1]?.netResult, { atomicValue: "-9776", scale: 2 }, "DOWN net");
  }],
  ["history reports unsettled record", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    assertEqual(service.history(validShadowObservationInput().observationId)?.settlement, null, "unsettled");
  }],
  ["query filters settled and unsettled", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    assertEqual(service.query({ unsettledOnly: true }).length, 1, "unsettled count");
    assertEqual(service.query({ settledOnly: true }).length, 0, "settled count");
  }],
  ["query rejects contradictory state filters", () => expectCategory(() => validateShadowQuery({ settledOnly: true, unsettledOnly: true }), EventContractShadowErrorCategory.InvalidRecord)],
  ["query rejects reversed timestamps", () => expectCategory(() => validateShadowQuery({ fromCapturedAt: "2026-07-23T20:43:00.000Z", toCapturedAt: "2026-07-23T20:42:00.000Z" }), EventContractShadowErrorCategory.InvalidTimestamp)],
  ["query rejects oversized limits", () => expectCategory(() => validateShadowQuery({ limit: 10_001 }), EventContractShadowErrorCategory.InvalidRecord)],
  ["summary counts and totals", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    service.settle(validShadowSettlementInput(), acceptedSettlementAt);
    const summary = service.summary();
    assertEqual(summary.observationCount, 1, "observations");
    assertEqual(summary.downWinCount, 1, "DOWN wins");
    assertDeepEqual(summary.hypotheticalUpNetResult, { atomicValue: "-467", scale: 2 }, "UP total");
    assertEqual(summary.authorizationStatus, EventContractShadowAuthorizationStatus.ShadowOnly, "authority");
  }],
  ["stored observation fingerprint is revalidated", () => {
    const observation = new EventContractObservationEngine().create(validShadowObservationInput());
    expectCategory(() => validateStoredEventContractObservation(changed(observation, (draft) => { draft["fingerprint"] = "fnv1a64:0000000000000000"; })), EventContractShadowErrorCategory.InvalidRecord);
  }],
  ["stored settlement fingerprint is revalidated", () => {
    const observation = new EventContractObservationEngine().create(validShadowObservationInput());
    const settlement = createEventContractSettlement(validShadowSettlementInput(), observation);
    expectCategory(() => validateStoredEventContractSettlement(changed(settlement, (draft) => { draft["fingerprint"] = "fnv1a64:0000000000000000"; }), observation), EventContractShadowErrorCategory.InvalidRecord);
  }],
  ["canonicalization is key-order independent", () => assertEqual(canonicalizeEventContractShadowValue({ b: 2, a: 1 }), canonicalizeEventContractShadowValue({ a: 1, b: 2 }), "canonical value")],
  ["fingerprint is deterministic", () => assertEqual(eventContractShadowFingerprint({ a: 1 }), eventContractShadowFingerprint({ a: 1 }), "fingerprint")],
  ["local ledger survives reload", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-shadow-"));
    try {
      const first = new EventContractShadowLedgerService(new LocalNdjsonEventContractShadowLedgerRepository(directory));
      first.capture(validShadowObservationInput(), acceptedObservationAt);
      first.settle(validShadowSettlementInput(), acceptedSettlementAt);
      const second = new EventContractShadowLedgerService(new LocalNdjsonEventContractShadowLedgerRepository(directory));
      assertEqual(second.summary().settledCount, 1, "reloaded settlement");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }],
  ["local ledger rejects truncated records", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-shadow-"));
    try {
      writeFileSync(join(directory, "event-contract-shadow-v1.ndjson"), "{\"schemaVersion\":\"1.0\"}");
      expectCategory(() => new LocalNdjsonEventContractShadowLedgerRepository(directory), EventContractShadowErrorCategory.RepositoryCorrupt);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }],
  ["local ledger rejects malformed records", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-shadow-"));
    try {
      writeFileSync(join(directory, "event-contract-shadow-v1.ndjson"), "not-json\n");
      expectCategory(() => new LocalNdjsonEventContractShadowLedgerRepository(directory), EventContractShadowErrorCategory.RepositoryCorrupt);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }],
  ["local ledger rejects noncanonical records", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-shadow-"));
    try {
      writeFileSync(join(directory, "event-contract-shadow-v1.ndjson"), "{\"sequence\":1, \"schemaVersion\":\"1.0\"}\n");
      expectCategory(() => new LocalNdjsonEventContractShadowLedgerRepository(directory), EventContractShadowErrorCategory.RepositoryCorrupt);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }],
  ["local ledger rejects path traversal", () => {
    const directory = mkdtempSync(join(tmpdir(), "alpha-shadow-"));
    try { expectCategory(() => new LocalNdjsonEventContractShadowLedgerRepository(directory, "../escape"), EventContractShadowErrorCategory.InvalidPath); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }],
  ["returned repository values are defensive clones", () => {
    const { repository, service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    const first = repository.getObservationById(validShadowObservationInput().observationId);
    const second = repository.getObservationById(validShadowObservationInput().observationId);
    assertTrue(first !== second, "distinct clones");
  }],
  ["shadow output contains no recommendation or order authority", () => {
    const { service } = fixture();
    service.capture(validShadowObservationInput(), acceptedObservationAt);
    service.settle(validShadowSettlementInput(), acceptedSettlementAt);
    const serialized = JSON.stringify(service.history(validShadowObservationInput().observationId));
    assertTrue(!serialized.includes("\"recommendation\""), "no recommendation");
    assertTrue(!serialized.includes("\"orderInstruction\""), "no order");
    assertTrue(serialized.includes("SHADOW_ONLY_NOT_TRADE_AUTHORITY"), "shadow authority");
  }],
];

function main(): void {
  let passed = 0;
  for (const [name, run] of tests) {
    try {
      run();
      passed += 1;
      console.log(`PASS ${name}`);
    } catch (error: unknown) {
      console.error(`FAIL ${name}`);
      throw error;
    }
  }
  console.log(`Event Contract Shadow Ledger tests passed: ${String(passed)}/${String(tests.length)}.`);
}

main();
