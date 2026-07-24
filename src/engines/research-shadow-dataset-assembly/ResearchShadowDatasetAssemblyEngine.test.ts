import {
  RESEARCH_INTEGRITY_SCHEMA_VERSION,
  RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION,
  ResearchDatasetEventType,
  ResearchEvidenceAvailabilityBasis,
  ResearchEvidenceCompletionStatus,
  ResearchEvidenceKind,
  ResearchIntegrityMode,
  ResearchShadowDatasetAssemblyIssueCode,
  ResearchShadowDatasetAssemblyStatus,
  type ResearchShadowDatasetAssemblyInput,
} from "../../contracts";
import { InMemoryEventContractShadowLedgerRepository } from "../../repositories/InMemoryEventContractShadowLedgerRepository";
import { EventContractShadowLedgerService } from "../event-contract-shadow-ledger";
import {
  validShadowObservationInput,
  validShadowSettlementInput,
} from "../event-contract-shadow-ledger/EventContractShadowLedger.fixtures";
import { ResearchIntegrityEngine } from "../research-integrity";
import {
  ResearchShadowDatasetAssemblyEngine,
  ResearchShadowDatasetAssemblyValidationError,
} from "./ResearchShadowDatasetAssemblyEngine";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}.`);
}
function assertTrue(value: boolean, label: string): void {
  if (!value) throw new Error(`${label}: expected true.`);
}

function validInput(settled = true): ResearchShadowDatasetAssemblyInput {
  const repository = new InMemoryEventContractShadowLedgerRepository();
  const ledger = new EventContractShadowLedgerService(repository);
  const observation = ledger.capture(validShadowObservationInput(), "2026-07-23T20:42:28.000Z").record;
  if (settled) ledger.settle(validShadowSettlementInput(), "2026-07-23T20:45:02.000Z");
  const history = ledger.history(observation.observationId);
  if (history === undefined) throw new Error("Fixture history missing.");
  const evidenceFingerprint = observation.fingerprint;
  const integrityAuditInput = {
    schemaVersion: RESEARCH_INTEGRITY_SCHEMA_VERSION,
    auditId: "audit:assembly:001",
    researchId: "research:btc-15m:assembly:001",
    mode: ResearchIntegrityMode.Forward,
    cutoffAt: observation.contract.evaluatesAt,
    evaluatedAt: "2026-07-23T20:45:10.000Z",
    dataset: {
      datasetId: "dataset:features:btc-15m:001",
      datasetVersion: "1.0",
      frozenAt: "2026-07-23T20:42:28.000Z",
      evidenceMembers: [{ evidenceId: "evidence:feature:001", evidenceFingerprint }],
    },
    evidence: [{
      evidenceId: "evidence:feature:001",
      kind: ResearchEvidenceKind.EventContractObservation,
      sourceId: "source:event-contract-shadow",
      sourceRecordId: observation.observationId,
      occurredAt: observation.capturedAt,
      publishedAt: null,
      availableAt: observation.capturedAt,
      receivedAt: observation.capturedAt,
      intervalStartsAt: null,
      intervalEndsAt: null,
      completionStatus: ResearchEvidenceCompletionStatus.PointInTime,
      availabilityBasis: ResearchEvidenceAvailabilityBasis.ProviderReceipt,
      availabilityReference: "receipt:event-contract-shadow:001",
      outcomeBearing: false,
      fingerprint: evidenceFingerprint,
    }],
  } as const;
  new ResearchIntegrityEngine().assess(integrityAuditInput);
  const eventId = "event:btc-15m:20260723-2045";
  return {
    schemaVersion: RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION,
    assemblyId: "assembly:btc-15m:001",
    researchId: "research:btc-15m:assembly:001",
    qualificationId: "qualification:btc-15m:assembly:001",
    assembledAt: "2026-07-23T20:46:00.000Z",
    collectionPlan: {
      planId: "collection-plan:btc-15m:001",
      planVersion: "1.0",
      frozenAt: "2026-07-23T20:29:00.000Z",
      instrumentId: "instrument:crypto:btc-usd",
      eventType: ResearchDatasetEventType.BtcFifteenMinute,
      intervalSeconds: 900,
      plannedEvents: [{ eventId, cutoffAt: observation.contract.evaluatesAt }],
    },
    bindings: [{
      eventId,
      observationId: observation.observationId,
      featureSchemaVersion: "1.0",
      featureSetVersion: "btc-15m-features-1.0",
      integrityAuditInput,
    }],
    histories: [history],
  };
}

function changed(mutator: (draft: Record<string, unknown>) => void, settled = true): unknown {
  const draft = structuredClone(validInput(settled)) as unknown as Record<string, unknown>;
  mutator(draft);
  return draft;
}

const engine = new ResearchShadowDatasetAssemblyEngine();
const tests: ReadonlyArray<readonly [string, () => void]> = [
  ["settled ledger history assembles canonical qualification input", () => {
    const result = engine.assemble(validInput());
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Assembled, "status");
    assertEqual(result.metrics.includedCount, 1, "included");
    assertEqual(result.qualificationInput?.samples[0]?.label, "DOWN", "label");
    assertEqual(result.qualificationInput?.samples[0]?.outcomeId, "settlement:btc:20260723-2045", "outcome");
  }],
  ["unsettled observation blocks without inventing a label", () => {
    const result = engine.assemble(validInput(false));
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Blocked, "status");
    assertEqual(result.qualificationInput, null, "qualification input");
    assertTrue(result.issues.some((entry) => entry.code === ResearchShadowDatasetAssemblyIssueCode.UnsettledObservation), "unsettled issue");
  }],
  ["missing binding remains visible", () => {
    const result = engine.assemble(changed((draft) => { draft["bindings"] = []; }));
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ResearchShadowDatasetAssemblyIssueCode.MissingBinding), "missing issue");
  }],
  ["cutoff mismatch blocks exact event binding", () => {
    const result = engine.assemble(changed((draft) => {
      const plan = draft["collectionPlan"] as Record<string, unknown>;
      (plan["plannedEvents"] as Array<Record<string, unknown>>)[0]!["cutoffAt"] = "2026-07-23T21:00:00.000Z";
    }));
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ResearchShadowDatasetAssemblyIssueCode.ObservationCutoffMismatch), "cutoff issue");
  }],
  ["plan frozen at first cutoff blocks", () => {
    const result = engine.assemble(changed((draft) => {
      const plan = draft["collectionPlan"] as Record<string, unknown>;
      plan["frozenAt"] = "2026-07-23T20:45:00.000Z";
    }));
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ResearchShadowDatasetAssemblyIssueCode.InvalidPlan), "plan issue");
  }],
  ["audit from another research identity blocks", () => {
    const result = engine.assemble(changed((draft) => {
      const binding = (draft["bindings"] as Array<Record<string, unknown>>)[0]!;
      (binding["integrityAuditInput"] as Record<string, unknown>)["researchId"] = "research:other";
    }));
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ResearchShadowDatasetAssemblyIssueCode.IntegrityAuditMismatch), "audit issue");
  }],
  ["audit for a different observation fingerprint blocks", () => {
    const result = engine.assemble(changed((draft) => {
      const binding = (draft["bindings"] as Array<Record<string, unknown>>)[0]!;
      const auditInput = binding["integrityAuditInput"] as Record<string, unknown>;
      const evidence = (auditInput["evidence"] as Array<Record<string, unknown>>)[0]!;
      const dataset = auditInput["dataset"] as Record<string, unknown>;
      const member = (dataset["evidenceMembers"] as Array<Record<string, unknown>>)[0]!;
      evidence["fingerprint"] = "fnv1a64:0000000000000000";
      member["evidenceFingerprint"] = "fnv1a64:0000000000000000";
    }));
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ResearchShadowDatasetAssemblyIssueCode.IntegrityAuditMismatch), "audit fingerprint issue");
  }],
  ["duplicate observation binding blocks", () => {
    const input = validInput();
    const duplicate = structuredClone(input.bindings[0]!);
    const result = engine.assemble({ ...input, bindings: [input.bindings[0], { ...duplicate, eventId: "event:btc-15m:other" }] });
    assertEqual(result.status, ResearchShadowDatasetAssemblyStatus.Blocked, "status");
    assertTrue(result.issues.some((entry) => entry.code === ResearchShadowDatasetAssemblyIssueCode.DuplicateIdentity), "duplicate issue");
  }],
  ["unknown authority-bearing field is rejected", () => {
    try {
      engine.assemble({ ...validInput(), recommendedSide: "DOWN" });
    } catch (error) {
      assertTrue(error instanceof ResearchShadowDatasetAssemblyValidationError, "typed validation error");
      return;
    }
    throw new Error("Expected validation error.");
  }],
  ["assembly is deterministic under history order", () => {
    const input = validInput();
    assertEqual(engine.assemble(input).fingerprint, engine.assemble({ ...input, histories: [...input.histories].reverse() }).fingerprint, "fingerprint");
  }],
];

for (const [name, run] of tests) run();
console.log(`Research Shadow Dataset Assembly tests passed: ${tests.length}/${tests.length}.`);
