import {
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EventContractObservationEventType,
  EventContractObservationSide,
} from "../../contracts/EventContractObservation";
import type { EventContractShadowHistory } from "../../contracts/EventContractShadowLedger";
import {
  ResearchEvidenceKind,
  ResearchIntegrityAuthorizationStatus,
  ResearchIntegrityStatus,
  type ResearchIntegrityAudit,
} from "../../contracts/ResearchIntegrity";
import {
  RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION,
  ResearchDatasetEventType,
  ResearchDatasetOutcomeLabel,
  type ResearchDatasetQualificationInput,
  type ResearchDatasetSample,
} from "../../contracts/ResearchDatasetQualification";
import {
  RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION,
  ResearchShadowDatasetAssemblyAuthorizationStatus,
  ResearchShadowDatasetAssemblyIssueCode,
  ResearchShadowDatasetAssemblyStatus,
  type ResearchShadowDatasetAssemblyBinding,
  type ResearchShadowDatasetAssemblyInput,
  type ResearchShadowDatasetAssemblyIssue,
  type ResearchShadowDatasetAssemblyResult,
} from "../../contracts/ResearchShadowDatasetAssembly";
import {
  validateStoredEventContractObservation,
  validateStoredEventContractSettlement,
} from "../event-contract-shadow-ledger/EventContractShadowLedgerEngine";
import {
  createResearchCollectionPlanFingerprint,
  validateResearchDatasetQualificationInput,
} from "../research-dataset-qualification/ResearchDatasetQualificationEngine";
import { ResearchIntegrityEngine } from "../research-integrity/ResearchIntegrityEngine";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const INPUT_KEYS = ["schemaVersion", "assemblyId", "researchId", "qualificationId", "assembledAt", "collectionPlan", "bindings", "histories"] as const;
const BINDING_KEYS = ["eventId", "observationId", "featureSchemaVersion", "featureSetVersion", "integrityAuditInput"] as const;
const PLAN_KEYS = ["planId", "planVersion", "frozenAt", "instrumentId", "eventType", "intervalSeconds", "plannedEvents"] as const;
const PLANNED_EVENT_KEYS = ["eventId", "cutoffAt"] as const;
const HISTORY_KEYS = ["observation", "settlement", "sideOutcomes"] as const;

export class ResearchShadowDatasetAssemblyValidationError extends Error {
  public constructor(public readonly issues: readonly ResearchShadowDatasetAssemblyIssue[]) {
    super("Research shadow dataset assembly input validation failed.");
    this.name = "ResearchShadowDatasetAssemblyValidationError";
  }
}

export class ResearchShadowDatasetAssemblyEngine {
  readonly #integrityEngine: ResearchIntegrityEngine;

  public constructor(integrityEngine = new ResearchIntegrityEngine()) {
    this.#integrityEngine = integrityEngine;
  }

  public assemble(value: unknown): ResearchShadowDatasetAssemblyResult {
    const shapeIssues = validateShape(value);
    if (shapeIssues.length > 0) throw new ResearchShadowDatasetAssemblyValidationError(deepFreeze(shapeIssues));
    const input = structuredClone(value) as ResearchShadowDatasetAssemblyInput;
    const issues: ResearchShadowDatasetAssemblyIssue[] = [];
    validatePlanSemantics(input, issues);
    const plannedById = new Map(input.collectionPlan.plannedEvents.map((event) => [event.eventId, event]));
    const historiesByObservation = indexHistories(input.histories, issues);
    const bindingsByEvent = indexBindings(input.bindings, issues);
    const samples: ResearchDatasetSample[] = [];
    let unsettledCount = 0;

    for (const planned of input.collectionPlan.plannedEvents) {
      const binding = bindingsByEvent.get(planned.eventId);
      if (binding === undefined) {
        add(issues, ResearchShadowDatasetAssemblyIssueCode.MissingBinding, "bindings", planned.eventId, "Planned event has no explicit observation and integrity-audit binding.");
        continue;
      }
      const history = historiesByObservation.get(binding.observationId);
      if (history === undefined) {
        add(issues, ResearchShadowDatasetAssemblyIssueCode.MissingObservation, "histories", planned.eventId, "Bound observation is absent from the immutable ledger snapshot.");
        continue;
      }
      const audit = bindObservationAndAudit(history, binding, planned.cutoffAt, input.researchId, input.assembledAt, issues, this.#integrityEngine);
      if (audit === null) continue;
      if (history.settlement === null) {
        unsettledCount += 1;
        add(issues, ResearchShadowDatasetAssemblyIssueCode.UnsettledObservation, "histories.settlement", planned.eventId, "Bound observation has no official settlement.");
        continue;
      }
      try {
        validateStoredEventContractSettlement(history.settlement, history.observation);
      } catch {
        add(issues, ResearchShadowDatasetAssemblyIssueCode.SettlementBindingMismatch, "histories.settlement", planned.eventId, "Settlement cannot be reconstructed against the exact observation.");
        continue;
      }
      if (Date.parse(history.settlement.settledAt) <= Date.parse(planned.cutoffAt)
        || Date.parse(history.settlement.settledAt) > Date.parse(input.assembledAt)) {
        add(issues, ResearchShadowDatasetAssemblyIssueCode.SettlementBindingMismatch, "histories.settlement.settledAt", planned.eventId, "Official outcome must become known strictly after cutoff and no later than assembly.");
        continue;
      }
      samples.push(deepFreeze({
        sampleId: `sample:assembly:${fingerprint({ eventId: planned.eventId, observationId: history.observation.observationId }).slice(8)}`,
        eventId: planned.eventId,
        observationId: history.observation.observationId,
        observationFingerprint: history.observation.fingerprint,
        cutoffAt: planned.cutoffAt,
        outcomeId: history.settlement.settlementId,
        outcomeFingerprint: history.settlement.fingerprint,
        outcomeKnownAt: history.settlement.settledAt,
        label: history.settlement.winningSide === EventContractObservationSide.Up
          ? ResearchDatasetOutcomeLabel.Up
          : ResearchDatasetOutcomeLabel.Down,
        featureSchemaVersion: binding.featureSchemaVersion,
        featureSetVersion: binding.featureSetVersion,
        integrityAudit: audit,
      }));
    }
    for (const binding of input.bindings) {
      if (!plannedById.has(binding.eventId)) add(issues, ResearchShadowDatasetAssemblyIssueCode.UnplannedBinding, "bindings.eventId", binding.eventId, "Binding is absent from the frozen collection plan.");
    }
    if (new Set(input.bindings.map((binding) => binding.featureSchemaVersion)).size > 1
      || new Set(input.bindings.map((binding) => binding.featureSetVersion)).size > 1) {
      add(issues, ResearchShadowDatasetAssemblyIssueCode.FeatureVersionMismatch, "bindings", null, "One assembly cannot mix feature schema or feature-set versions.");
    }

    const qualificationInput: ResearchDatasetQualificationInput = deepFreeze({
      schemaVersion: RESEARCH_DATASET_QUALIFICATION_SCHEMA_VERSION,
      qualificationId: input.qualificationId,
      researchId: input.researchId,
      createdAt: input.assembledAt,
      collectionPlan: structuredClone(input.collectionPlan),
      samples: [...samples].sort(compareSamples),
    });
    const qualificationShape = validateResearchDatasetQualificationInput(qualificationInput);
    if (!qualificationShape.valid) {
      add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidPlan, "collectionPlan", null, "Frozen plan or assembled qualification shape is invalid.");
    }
    const sortedIssues = deepFreeze(issues.sort(compareIssues));
    const planFingerprint = createResearchCollectionPlanFingerprint(input.collectionPlan);
    const ledgerSnapshotFingerprint = fingerprint(input.histories
      .map((history) => ({
        observationId: history.observation.observationId,
        observationFingerprint: history.observation.fingerprint,
        settlementId: history.settlement?.settlementId ?? null,
        settlementFingerprint: history.settlement?.fingerprint ?? null,
      }))
      .sort((left, right) => left.observationId.localeCompare(right.observationId)));
    const base = {
      schemaVersion: RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION,
      assemblyId: input.assemblyId,
      researchId: input.researchId,
      assembledAt: input.assembledAt,
      planId: input.collectionPlan.planId,
      planVersion: input.collectionPlan.planVersion,
      planFingerprint,
      ledgerSnapshotFingerprint,
      status: sortedIssues.length === 0 ? ResearchShadowDatasetAssemblyStatus.Assembled : ResearchShadowDatasetAssemblyStatus.Blocked,
      metrics: {
        plannedCount: input.collectionPlan.plannedEvents.length,
        bindingCount: input.bindings.length,
        includedCount: samples.length,
        missingCount: Math.max(0, input.collectionPlan.plannedEvents.length - samples.length),
        unsettledCount,
      },
      issues: sortedIssues,
      qualificationInput: sortedIssues.length === 0 ? qualificationInput : null,
      authorizationStatus: ResearchShadowDatasetAssemblyAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }
}

function validatePlanSemantics(input: ResearchShadowDatasetAssemblyInput, issues: ResearchShadowDatasetAssemblyIssue[]): void {
  const plan = input.collectionPlan;
  if (plan.instrumentId !== EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID
    || plan.eventType !== ResearchDatasetEventType.BtcFifteenMinute
    || plan.intervalSeconds !== 900
    || Date.parse(plan.frozenAt) >= Date.parse(plan.plannedEvents[0]!.cutoffAt)) {
    add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidPlan, "collectionPlan", null, "Plan must be BTC-USD, continuous 15-minute events, and frozen strictly before the first cutoff.");
  }
  const identities = new Set<string>();
  for (let index = 0; index < plan.plannedEvents.length; index += 1) {
    const event = plan.plannedEvents[index]!;
    if (identities.has(event.eventId)) add(issues, ResearchShadowDatasetAssemblyIssueCode.DuplicateIdentity, "collectionPlan.plannedEvents", event.eventId, "Planned event identities must be unique.");
    identities.add(event.eventId);
    const previous = plan.plannedEvents[index - 1];
    if (previous !== undefined && Date.parse(event.cutoffAt) - Date.parse(previous.cutoffAt) !== 900_000) {
      add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidPlan, "collectionPlan.plannedEvents", event.eventId, "Planned events must form one chronological continuous 15-minute sequence.");
    }
  }
}

function validateShape(value: unknown): ResearchShadowDatasetAssemblyIssue[] {
  const issues: ResearchShadowDatasetAssemblyIssue[] = [];
  if (!isRecord(value)) return [issue(ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, "$", null, "Assembly input must be an object.")];
  exactKeys(issues, value, INPUT_KEYS, "$");
  if (value.schemaVersion !== RESEARCH_SHADOW_DATASET_ASSEMBLY_SCHEMA_VERSION) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidSchemaVersion, "schemaVersion", null, "Schema version is unsupported.");
  for (const field of ["assemblyId", "researchId", "qualificationId"] as const) {
    if (typeof value[field] !== "string" || !IDENTIFIER.test(value[field] as string)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidIdentifier, field, null, `${field} is invalid.`);
  }
  if (!timestamp(value.assembledAt)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidTimestamp, "assembledAt", null, "assembledAt must be canonical UTC.");
  if (!Array.isArray(value.bindings) || !Array.isArray(value.histories)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, "$", null, "Bindings and histories must be arrays.");
  if (Array.isArray(value.bindings)) value.bindings.forEach((binding, index) => {
    if (!isRecord(binding)) return add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, `bindings.${index}`, null, "Binding must be an object.");
    exactKeys(issues, binding, BINDING_KEYS, `bindings.${index}`);
    for (const field of ["eventId", "observationId"] as const) if (typeof binding[field] !== "string" || !IDENTIFIER.test(binding[field] as string)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidIdentifier, `bindings.${index}.${field}`, null, `${field} is invalid.`);
    for (const field of ["featureSchemaVersion", "featureSetVersion"] as const) if (typeof binding[field] !== "string" || !VERSION.test(binding[field] as string)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidVersion, `bindings.${index}.${field}`, null, `${field} is invalid.`);
    if (!isRecord(binding.integrityAuditInput)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, `bindings.${index}.integrityAuditInput`, null, "Integrity audit input must be an object.");
  });
  if (!isRecord(value.collectionPlan)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, "collectionPlan", null, "Collection plan must be an object.");
  else {
    exactKeys(issues, value.collectionPlan, PLAN_KEYS, "collectionPlan");
    if (!Array.isArray(value.collectionPlan.plannedEvents) || value.collectionPlan.plannedEvents.length === 0) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidPlan, "collectionPlan.plannedEvents", null, "Frozen plan must declare at least one event.");
    else value.collectionPlan.plannedEvents.forEach((event, index) => {
      if (!isRecord(event)) return add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidPlan, `collectionPlan.plannedEvents.${index}`, null, "Planned event must be an object.");
      exactKeys(issues, event, PLANNED_EVENT_KEYS, `collectionPlan.plannedEvents.${index}`);
      if (typeof event.eventId !== "string" || !IDENTIFIER.test(event.eventId)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidIdentifier, `collectionPlan.plannedEvents.${index}.eventId`, null, "Planned event identity is invalid.");
      if (!timestamp(event.cutoffAt)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidTimestamp, `collectionPlan.plannedEvents.${index}.cutoffAt`, null, "Planned cutoff must be canonical UTC.");
    });
  }
  if (Array.isArray(value.histories)) value.histories.forEach((history, index) => {
    if (!isRecord(history)) return add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, `histories.${index}`, null, "History must be an object.");
    exactKeys(issues, history, HISTORY_KEYS, `histories.${index}`);
    if (!isRecord(history.observation) || typeof history.observation.observationId !== "string" || typeof history.observation.fingerprint !== "string") add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, `histories.${index}.observation`, null, "History observation identity and fingerprint are required.");
    if (history.settlement !== null && (!isRecord(history.settlement) || typeof history.settlement.settlementId !== "string" || typeof history.settlement.fingerprint !== "string")) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, `histories.${index}.settlement`, null, "History settlement must be null or carry identity and fingerprint.");
    if (!Array.isArray(history.sideOutcomes)) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, `histories.${index}.sideOutcomes`, null, "History side outcomes must be an array.");
  });
  return issues.sort(compareIssues);
}

function indexHistories(histories: readonly EventContractShadowHistory[], issues: ResearchShadowDatasetAssemblyIssue[]): Map<string, EventContractShadowHistory> {
  const indexed = new Map<string, EventContractShadowHistory>();
  for (const history of histories) {
    try { validateStoredEventContractObservation(history.observation); }
    catch {
      add(issues, ResearchShadowDatasetAssemblyIssueCode.ObservationBindingMismatch, "histories.observation", null, "Stored observation cannot be reconstructed.");
      continue;
    }
    if (indexed.has(history.observation.observationId)) add(issues, ResearchShadowDatasetAssemblyIssueCode.DuplicateIdentity, "histories.observation.observationId", null, "Ledger snapshot contains a duplicate observation identity.");
    else indexed.set(history.observation.observationId, history);
  }
  return indexed;
}

function indexBindings(bindings: readonly ResearchShadowDatasetAssemblyBinding[], issues: ResearchShadowDatasetAssemblyIssue[]): Map<string, ResearchShadowDatasetAssemblyBinding> {
  const indexed = new Map<string, ResearchShadowDatasetAssemblyBinding>();
  const observationIds = new Set<string>();
  for (const binding of bindings) {
    if (indexed.has(binding.eventId) || observationIds.has(binding.observationId)) add(issues, ResearchShadowDatasetAssemblyIssueCode.DuplicateIdentity, "bindings", binding.eventId, "Event and observation bindings must be one-to-one.");
    else {
      indexed.set(binding.eventId, binding);
      observationIds.add(binding.observationId);
    }
  }
  return indexed;
}

function bindObservationAndAudit(
  history: EventContractShadowHistory,
  binding: ResearchShadowDatasetAssemblyBinding,
  cutoffAt: string,
  researchId: string,
  assembledAt: string,
  issues: ResearchShadowDatasetAssemblyIssue[],
  integrityEngine: ResearchIntegrityEngine,
): ResearchIntegrityAudit | null {
  const eventId = binding.eventId;
  const observation = history.observation;
  if (observation.contract.instrumentId !== EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID || observation.contract.eventType !== EventContractObservationEventType.BtcFifteenMinute) {
    add(issues, ResearchShadowDatasetAssemblyIssueCode.ObservationBindingMismatch, "histories.observation.contract", eventId, "Observation is not the declared BTC 15-minute contract.");
  }
  if (observation.contract.evaluatesAt !== cutoffAt || observation.contract.tradingClosesAt !== cutoffAt) add(issues, ResearchShadowDatasetAssemblyIssueCode.ObservationCutoffMismatch, "histories.observation.contract.evaluatesAt", eventId, "Observation evaluation and trading close must match the planned cutoff exactly.");
  let audit: ResearchIntegrityAudit;
  try { audit = integrityEngine.assess(binding.integrityAuditInput); }
  catch {
    add(issues, ResearchShadowDatasetAssemblyIssueCode.IntegrityAuditMismatch, "bindings.integrityAuditInput", eventId, "Integrity audit input cannot be reconstructed.");
    return null;
  }
  const matchingObservationEvidence = binding.integrityAuditInput.evidence.filter((evidence) =>
    evidence.kind === ResearchEvidenceKind.EventContractObservation
    && evidence.sourceRecordId === observation.observationId
    && evidence.fingerprint === observation.fingerprint);
  if (audit.researchId !== researchId || audit.cutoffAt !== cutoffAt || audit.status !== ResearchIntegrityStatus.Eligible
    || audit.authorizationStatus !== ResearchIntegrityAuthorizationStatus.ResearchOnly || audit.issues.length !== 0
    || Date.parse(audit.evaluatedAt) > Date.parse(assembledAt) || matchingObservationEvidence.length !== 1) {
    add(issues, ResearchShadowDatasetAssemblyIssueCode.IntegrityAuditMismatch, "bindings.integrityAuditInput", eventId, "Recomputed integrity audit must be eligible, issue-free, research-only, and contain the exact observation identity and fingerprint.");
  }
  const featureVersions = `${binding.featureSchemaVersion}\u0000${binding.featureSetVersion}`;
  if (featureVersions.length === 1) add(issues, ResearchShadowDatasetAssemblyIssueCode.FeatureVersionMismatch, "bindings", eventId, "Feature versions must be explicit.");
  return issues.some((entry) => entry.eventId === eventId) ? null : audit;
}

function exactKeys(issues: ResearchShadowDatasetAssemblyIssue[], value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, field, null, "Object contains undeclared fields.");
  if (allowed.some((key) => !(key in value))) add(issues, ResearchShadowDatasetAssemblyIssueCode.InvalidRecord, field, null, "Object is missing required fields.");
}
function timestamp(value: unknown): value is string { return typeof value === "string" && new Date(value).toISOString() === value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function issue(code: ResearchShadowDatasetAssemblyIssueCode, field: string, eventId: string | null, message: string): ResearchShadowDatasetAssemblyIssue { return { code, field, eventId, message }; }
function add(issues: ResearchShadowDatasetAssemblyIssue[], code: ResearchShadowDatasetAssemblyIssueCode, field: string, eventId: string | null, message: string): void { issues.push(issue(code, field, eventId, message)); }
function compareIssues(left: ResearchShadowDatasetAssemblyIssue, right: ResearchShadowDatasetAssemblyIssue): number { return left.code.localeCompare(right.code) || left.field.localeCompare(right.field) || (left.eventId ?? "").localeCompare(right.eventId ?? "") || left.message.localeCompare(right.message); }
function compareSamples(left: ResearchDatasetSample, right: ResearchDatasetSample): number { return left.cutoffAt.localeCompare(right.cutoffAt) || left.eventId.localeCompare(right.eventId) || left.sampleId.localeCompare(right.sampleId); }
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}
function fingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonicalize(value))) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}
