import {
  EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
  EventContractObservationEventType,
} from "../../contracts/EventContractObservation";
import type { EventContractShadowHistory } from "../../contracts/EventContractShadowLedger";
import {
  FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
  ForwardShadowCollectionAuthorizationStatus,
  ForwardShadowCollectionEventStatus,
  ForwardShadowCollectionIssueCode,
  ForwardShadowCollectionProgressStatus,
  type ForwardShadowCollectionEventProgress,
  type ForwardShadowCollectionIssue,
  type ForwardShadowCollectionPlanRequest,
  type ForwardShadowCollectionProgressInput,
  type ForwardShadowCollectionProgressResult,
  type FrozenForwardShadowCollectionPlan,
} from "../../contracts/ForwardShadowCollectionControl";
import {
  ResearchDatasetEventType,
  type ResearchDatasetCollectionPlan,
} from "../../contracts/ResearchDatasetQualification";
import {
  validateStoredEventContractObservation,
  validateStoredEventContractSettlement,
} from "../event-contract-shadow-ledger/EventContractShadowLedgerEngine";
import { createResearchCollectionPlanFingerprint } from "../research-dataset-qualification/ResearchDatasetQualificationEngine";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u;
const VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const FINGERPRINT = /^fnv1a64:[a-f0-9]{16}$/u;
const MAX_EVENTS = 100_000;
const INTERVAL_MILLISECONDS = 900_000;
const PLAN_REQUEST_KEYS = ["schemaVersion", "planId", "planVersion", "createdAt", "firstCutoffAt", "eventCount"] as const;
const PROGRESS_INPUT_KEYS = ["schemaVersion", "auditId", "asOfTime", "collectionPlan", "histories"] as const;
const PLAN_KEYS = ["planId", "planVersion", "frozenAt", "instrumentId", "eventType", "intervalSeconds", "plannedEvents"] as const;
const PLANNED_EVENT_KEYS = ["eventId", "cutoffAt"] as const;
const HISTORY_KEYS = ["observation", "settlement", "sideOutcomes"] as const;
const FROZEN_PLAN_KEYS = ["schemaVersion", "createdAt", "collectionPlan", "planFingerprint", "authorizationStatus", "deterministic", "readOnly", "fingerprint"] as const;

export class ForwardShadowCollectionControlValidationError extends Error {
  public constructor(public readonly issues: readonly ForwardShadowCollectionIssue[]) {
    super("Forward shadow collection control input validation failed.");
    this.name = "ForwardShadowCollectionControlValidationError";
  }
}

export class ForwardShadowCollectionControlEngine {
  public createPlan(value: unknown): FrozenForwardShadowCollectionPlan {
    const issues = validatePlanRequest(value);
    if (issues.length > 0) throw new ForwardShadowCollectionControlValidationError(deepFreeze(issues));
    const input = structuredClone(value) as ForwardShadowCollectionPlanRequest;
    const firstCutoff = Date.parse(input.firstCutoffAt);
    const collectionPlan: ResearchDatasetCollectionPlan = deepFreeze({
      planId: input.planId,
      planVersion: input.planVersion,
      frozenAt: input.createdAt,
      instrumentId: EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID,
      eventType: ResearchDatasetEventType.BtcFifteenMinute,
      intervalSeconds: 900,
      plannedEvents: Array.from({ length: input.eventCount }, (_, index) => {
        const cutoffAt = new Date(firstCutoff + index * INTERVAL_MILLISECONDS).toISOString();
        return { eventId: eventId(cutoffAt), cutoffAt };
      }),
    });
    const planFingerprint = createResearchCollectionPlanFingerprint(collectionPlan);
    const base = {
      schemaVersion: FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
      createdAt: input.createdAt,
      collectionPlan,
      planFingerprint,
      authorizationStatus: ForwardShadowCollectionAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public auditProgress(value: unknown): ForwardShadowCollectionProgressResult {
    const shapeIssues = validateProgressShape(value);
    if (shapeIssues.length > 0) throw new ForwardShadowCollectionControlValidationError(deepFreeze(shapeIssues));
    const input = structuredClone(value) as ForwardShadowCollectionProgressInput;
    const issues: ForwardShadowCollectionIssue[] = [];
    validatePlan(input.collectionPlan, issues);
    if (Date.parse(input.asOfTime) < Date.parse(input.collectionPlan.frozenAt)) {
      add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, "asOfTime", null, "Progress audit cannot predate the plan freeze.");
    }
    const plannedByCutoff = new Map(input.collectionPlan.plannedEvents.map((event) => [event.cutoffAt, event]));
    const candidates = new Map<string, EventContractShadowHistory[]>();
    const seenObservationIds = new Set<string>();
    let unplannedObservationCount = 0;

    for (const history of input.histories) {
      const observationId = history.observation.observationId;
      if (seenObservationIds.has(observationId)) {
        add(issues, ForwardShadowCollectionIssueCode.DuplicateObservation, "histories.observation.observationId", observationId, "Ledger snapshot contains a duplicate observation identity.");
        continue;
      }
      seenObservationIds.add(observationId);
      try { validateStoredEventContractObservation(history.observation); }
      catch {
        add(issues, ForwardShadowCollectionIssueCode.InvalidObservation, "histories.observation", observationId, "Stored observation cannot be reconstructed.");
        continue;
      }
      if (Date.parse(history.observation.capturedAt) > Date.parse(input.asOfTime)) {
        add(issues, ForwardShadowCollectionIssueCode.ObservationAfterAudit, "histories.observation.capturedAt", observationId, "Progress audit cannot use an observation captured after asOfTime.");
        continue;
      }
      if (history.settlement !== null) {
        try { validateStoredEventContractSettlement(history.settlement, history.observation); }
        catch {
          add(issues, ForwardShadowCollectionIssueCode.InvalidSettlement, "histories.settlement", observationId, "Stored settlement cannot be reconstructed against its observation.");
          continue;
        }
        if (Date.parse(history.settlement.settledAt) > Date.parse(input.asOfTime)) {
          add(issues, ForwardShadowCollectionIssueCode.SettlementAfterAudit, "histories.settlement.settledAt", observationId, "Progress audit cannot use a settlement known after asOfTime.");
          continue;
        }
      }
      const planned = plannedByCutoff.get(history.observation.contract.evaluatesAt);
      const exactContract = planned !== undefined
        && history.observation.contract.tradingClosesAt === planned.cutoffAt
        && history.observation.contract.instrumentId === EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID
        && history.observation.contract.eventType === EventContractObservationEventType.BtcFifteenMinute;
      if (!exactContract || planned === undefined) {
        unplannedObservationCount += 1;
        continue;
      }
      const entries = candidates.get(planned.eventId) ?? [];
      entries.push(history);
      candidates.set(planned.eventId, entries);
    }

    const events: ForwardShadowCollectionEventProgress[] = input.collectionPlan.plannedEvents.map((planned) => {
      const matches = [...(candidates.get(planned.eventId) ?? [])]
        .sort((left, right) => left.observation.capturedAt.localeCompare(right.observation.capturedAt) || left.observation.observationId.localeCompare(right.observation.observationId));
      const observationIds = matches.map((history) => history.observation.observationId);
      const settledObservationIds = matches
        .filter((history) => history.settlement !== null)
        .map((history) => history.observation.observationId);
      let status: ForwardShadowCollectionEventStatus;
      if (settledObservationIds.length > 0) status = ForwardShadowCollectionEventStatus.SettledCandidate;
      else if (observationIds.length > 0) status = ForwardShadowCollectionEventStatus.CapturedUnsettled;
      else if (Date.parse(planned.cutoffAt) > Date.parse(input.asOfTime)) status = ForwardShadowCollectionEventStatus.Upcoming;
      else status = ForwardShadowCollectionEventStatus.OverdueMissing;
      return deepFreeze({ eventId: planned.eventId, cutoffAt: planned.cutoffAt, status, observationIds, settledObservationIds });
    });
    const upcomingCount = count(events, ForwardShadowCollectionEventStatus.Upcoming);
    const missingCount = count(events, ForwardShadowCollectionEventStatus.OverdueMissing);
    const capturedCount = events.filter((event) => event.observationIds.length > 0).length;
    const settledCandidateCount = count(events, ForwardShadowCollectionEventStatus.SettledCandidate);
    const sortedIssues = deepFreeze(issues.sort(compareIssues));
    const planFingerprint = createResearchCollectionPlanFingerprint(input.collectionPlan);
    const ledgerSnapshotFingerprint = fingerprint(input.histories.map((history) => ({
      observationId: history.observation.observationId,
      observationFingerprint: history.observation.fingerprint,
      settlementId: history.settlement?.settlementId ?? null,
      settlementFingerprint: history.settlement?.fingerprint ?? null,
    })).sort((left, right) => left.observationId.localeCompare(right.observationId)));
    const status = sortedIssues.length > 0
      ? ForwardShadowCollectionProgressStatus.Blocked
      : settledCandidateCount === input.collectionPlan.plannedEvents.length
        ? ForwardShadowCollectionProgressStatus.ReadyForBinding
        : ForwardShadowCollectionProgressStatus.InProgress;
    const base = {
      schemaVersion: FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
      auditId: input.auditId,
      asOfTime: input.asOfTime,
      planId: input.collectionPlan.planId,
      planVersion: input.collectionPlan.planVersion,
      planFingerprint,
      ledgerSnapshotFingerprint,
      status,
      metrics: {
        plannedCount: events.length,
        upcomingCount,
        missingCount,
        capturedCount,
        settledCandidateCount,
        unplannedObservationCount,
        coverageBasisPoints: basisPoints(capturedCount, events.length),
        settlementCoverageBasisPoints: basisPoints(settledCandidateCount, events.length),
      },
      events: deepFreeze(events),
      issues: sortedIssues,
      authorizationStatus: ForwardShadowCollectionAuthorizationStatus.ResearchOnly,
      deterministic: true as const,
      readOnly: true as const,
    };
    return deepFreeze({ ...base, fingerprint: fingerprint(base) });
  }

  public verifyPlanArtifact(value: unknown): FrozenForwardShadowCollectionPlan {
    const shapeIssues = validateFrozenPlanShape(value);
    if (shapeIssues.length > 0) throw new ForwardShadowCollectionControlValidationError(deepFreeze(shapeIssues));
    const artifact = structuredClone(value) as FrozenForwardShadowCollectionPlan;
    const issues: ForwardShadowCollectionIssue[] = [];
    validatePlan(artifact.collectionPlan, issues);
    const expectedPlanFingerprint = createResearchCollectionPlanFingerprint(artifact.collectionPlan);
    const { fingerprint: declaredFingerprint, ...base } = artifact;
    if (artifact.createdAt !== artifact.collectionPlan.frozenAt
      || artifact.planFingerprint !== expectedPlanFingerprint
      || declaredFingerprint !== fingerprint(base)) {
      add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, "$", null, "Frozen plan artifact content or fingerprint is invalid.");
    }
    if (issues.length > 0) throw new ForwardShadowCollectionControlValidationError(deepFreeze(issues.sort(compareIssues)));
    return deepFreeze(artifact);
  }
}

function validatePlanRequest(value: unknown): ForwardShadowCollectionIssue[] {
  const issues: ForwardShadowCollectionIssue[] = [];
  if (!isRecord(value)) return [issue(ForwardShadowCollectionIssueCode.InvalidRecord, "$", null, "Plan request must be an object.")];
  exactKeys(issues, value, PLAN_REQUEST_KEYS, "$");
  if (value.schemaVersion !== FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION) add(issues, ForwardShadowCollectionIssueCode.InvalidSchemaVersion, "schemaVersion", null, "Schema version is unsupported.");
  identifier(issues, value.planId, "planId");
  if (typeof value.planVersion !== "string" || !VERSION.test(value.planVersion)) add(issues, ForwardShadowCollectionIssueCode.InvalidVersion, "planVersion", null, "Plan version is invalid.");
  for (const field of ["createdAt", "firstCutoffAt"] as const) if (!timestamp(value[field])) add(issues, ForwardShadowCollectionIssueCode.InvalidTimestamp, field, null, `${field} must be canonical UTC.`);
  if (!Number.isSafeInteger(value.eventCount) || (value.eventCount as number) < 1 || (value.eventCount as number) > MAX_EVENTS) add(issues, ForwardShadowCollectionIssueCode.InvalidEventCount, "eventCount", null, `Event count must be within 1..${String(MAX_EVENTS)}.`);
  if (timestamp(value.firstCutoffAt) && !alignedCutoff(value.firstCutoffAt)) add(issues, ForwardShadowCollectionIssueCode.InvalidCutoffAlignment, "firstCutoffAt", null, "First cutoff must align to an exact UTC 15-minute boundary.");
  if (timestamp(value.createdAt) && timestamp(value.firstCutoffAt) && Date.parse(value.createdAt) >= Date.parse(value.firstCutoffAt)) add(issues, ForwardShadowCollectionIssueCode.PlanFrozenTooLate, "createdAt", null, "Plan must be created strictly before its first cutoff.");
  return issues.sort(compareIssues);
}

function validateProgressShape(value: unknown): ForwardShadowCollectionIssue[] {
  const issues: ForwardShadowCollectionIssue[] = [];
  if (!isRecord(value)) return [issue(ForwardShadowCollectionIssueCode.InvalidRecord, "$", null, "Progress input must be an object.")];
  exactKeys(issues, value, PROGRESS_INPUT_KEYS, "$");
  if (value.schemaVersion !== FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION) add(issues, ForwardShadowCollectionIssueCode.InvalidSchemaVersion, "schemaVersion", null, "Schema version is unsupported.");
  identifier(issues, value.auditId, "auditId");
  if (!timestamp(value.asOfTime)) add(issues, ForwardShadowCollectionIssueCode.InvalidTimestamp, "asOfTime", null, "asOfTime must be canonical UTC.");
  if (!isRecord(value.collectionPlan)) add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, "collectionPlan", null, "Collection plan must be an object.");
  else {
    exactKeys(issues, value.collectionPlan, PLAN_KEYS, "collectionPlan");
    identifier(issues, value.collectionPlan.planId, "collectionPlan.planId");
    if (typeof value.collectionPlan.planVersion !== "string" || !VERSION.test(value.collectionPlan.planVersion)) add(issues, ForwardShadowCollectionIssueCode.InvalidVersion, "collectionPlan.planVersion", null, "Plan version is invalid.");
    if (!timestamp(value.collectionPlan.frozenAt)) add(issues, ForwardShadowCollectionIssueCode.InvalidTimestamp, "collectionPlan.frozenAt", null, "Plan freeze time must be canonical UTC.");
    if (value.collectionPlan.instrumentId !== EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID || value.collectionPlan.eventType !== ResearchDatasetEventType.BtcFifteenMinute || value.collectionPlan.intervalSeconds !== 900) add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, "collectionPlan", null, "Plan must declare the BTC-USD 15-minute boundary.");
    if (!Array.isArray(value.collectionPlan.plannedEvents) || value.collectionPlan.plannedEvents.length === 0) add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, "collectionPlan.plannedEvents", null, "Plan must contain events.");
    else if (value.collectionPlan.plannedEvents.length > MAX_EVENTS) add(issues, ForwardShadowCollectionIssueCode.InvalidEventCount, "collectionPlan.plannedEvents", null, `Plan cannot exceed ${String(MAX_EVENTS)} events.`);
    else value.collectionPlan.plannedEvents.forEach((event, index) => {
      if (!isRecord(event)) return add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, `collectionPlan.plannedEvents.${String(index)}`, null, "Planned event must be an object.");
      exactKeys(issues, event, PLANNED_EVENT_KEYS, `collectionPlan.plannedEvents.${String(index)}`);
      identifier(issues, event.eventId, `collectionPlan.plannedEvents.${String(index)}.eventId`);
      if (!timestamp(event.cutoffAt)) add(issues, ForwardShadowCollectionIssueCode.InvalidTimestamp, `collectionPlan.plannedEvents.${String(index)}.cutoffAt`, null, "Cutoff must be canonical UTC.");
    });
  }
  if (!Array.isArray(value.histories)) add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, "histories", null, "Histories must be an array.");
  else value.histories.forEach((history, index) => {
    if (!isRecord(history)) return add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, `histories.${String(index)}`, null, "History must be an object.");
    exactKeys(issues, history, HISTORY_KEYS, `histories.${String(index)}`);
    if (!isRecord(history.observation) || typeof history.observation.observationId !== "string" || typeof history.observation.fingerprint !== "string") add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, `histories.${String(index)}.observation`, null, "Observation identity and fingerprint are required.");
    if (history.settlement !== null && (!isRecord(history.settlement) || typeof history.settlement.settlementId !== "string" || typeof history.settlement.fingerprint !== "string")) add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, `histories.${String(index)}.settlement`, null, "Settlement must be null or carry identity and fingerprint.");
    if (!Array.isArray(history.sideOutcomes)) add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, `histories.${String(index)}.sideOutcomes`, null, "Side outcomes must be an array.");
  });
  return issues.sort(compareIssues);
}

function validateFrozenPlanShape(value: unknown): ForwardShadowCollectionIssue[] {
  const issues: ForwardShadowCollectionIssue[] = [];
  if (!isRecord(value)) return [issue(ForwardShadowCollectionIssueCode.InvalidRecord, "$", null, "Frozen plan artifact must be an object.")];
  exactKeys(issues, value, FROZEN_PLAN_KEYS, "$");
  if (value.schemaVersion !== FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION
    || value.authorizationStatus !== ForwardShadowCollectionAuthorizationStatus.ResearchOnly
    || value.deterministic !== true || value.readOnly !== true) {
    add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, "$", null, "Frozen plan schema or authority is invalid.");
  }
  if (!timestamp(value.createdAt)) add(issues, ForwardShadowCollectionIssueCode.InvalidTimestamp, "createdAt", null, "Creation time must be canonical UTC.");
  if (typeof value.planFingerprint !== "string" || !FINGERPRINT.test(value.planFingerprint)
    || typeof value.fingerprint !== "string" || !FINGERPRINT.test(value.fingerprint)) {
    add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, "fingerprint", null, "Frozen plan fingerprints are invalid.");
  }
  const progressShape = validateProgressShape({
    schemaVersion: FORWARD_SHADOW_COLLECTION_CONTROL_SCHEMA_VERSION,
    auditId: "artifact-validation",
    asOfTime: value.createdAt,
    collectionPlan: value.collectionPlan,
    histories: [],
  });
  issues.push(...progressShape);
  return issues.sort(compareIssues);
}

function validatePlan(plan: ResearchDatasetCollectionPlan, issues: ForwardShadowCollectionIssue[]): void {
  if (plan.instrumentId !== EVENT_CONTRACT_OBSERVATION_INSTRUMENT_ID || plan.eventType !== ResearchDatasetEventType.BtcFifteenMinute || plan.intervalSeconds !== 900
    || Date.parse(plan.frozenAt) >= Date.parse(plan.plannedEvents[0]!.cutoffAt)) {
    add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, "collectionPlan", null, "Plan identity, interval, or freeze chronology is invalid.");
  }
  const identities = new Set<string>();
  plan.plannedEvents.forEach((event, index) => {
    if (identities.has(event.eventId) || event.eventId !== eventId(event.cutoffAt)) add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, `collectionPlan.plannedEvents.${String(index)}`, event.eventId, "Event identity must be unique and derived from its cutoff.");
    identities.add(event.eventId);
    const previous = plan.plannedEvents[index - 1];
    if (!alignedCutoff(event.cutoffAt) || (previous !== undefined && Date.parse(event.cutoffAt) - Date.parse(previous.cutoffAt) !== INTERVAL_MILLISECONDS)) add(issues, ForwardShadowCollectionIssueCode.InvalidPlan, `collectionPlan.plannedEvents.${String(index)}.cutoffAt`, event.eventId, "Events must be one continuous aligned 15-minute sequence.");
  });
}

function eventId(cutoffAt: string): string {
  const date = cutoffAt.slice(0, 10).replace(/-/gu, "");
  const time = cutoffAt.slice(11, 16).replace(":", "");
  return `event:btc-15m:${date}-${time}`;
}
function alignedCutoff(value: string): boolean {
  const date = new Date(value);
  return date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0 && date.getUTCMinutes() % 15 === 0;
}
function basisPoints(numerator: number, denominator: number): number { return denominator === 0 ? 0 : Math.floor((numerator * 10_000) / denominator); }
function count(events: readonly ForwardShadowCollectionEventProgress[], status: ForwardShadowCollectionEventStatus): number { return events.filter((event) => event.status === status).length; }
function identifier(issues: ForwardShadowCollectionIssue[], value: unknown, field: string): void { if (typeof value !== "string" || !IDENTIFIER.test(value)) add(issues, ForwardShadowCollectionIssueCode.InvalidIdentifier, field, null, `${field} is invalid.`); }
function timestamp(value: unknown): value is string { return typeof value === "string" && new Date(value).toISOString() === value; }
function exactKeys(issues: ForwardShadowCollectionIssue[], value: Record<string, unknown>, allowed: readonly string[], field: string): void {
  const allowedSet = new Set<string>(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key)) || allowed.some((key) => !(key in value))) add(issues, ForwardShadowCollectionIssueCode.InvalidRecord, field, null, "Object fields do not match the declared contract.");
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function issue(code: ForwardShadowCollectionIssueCode, field: string, recordId: string | null, message: string): ForwardShadowCollectionIssue { return { code, field, recordId, message }; }
function add(issues: ForwardShadowCollectionIssue[], code: ForwardShadowCollectionIssueCode, field: string, recordId: string | null, message: string): void { issues.push(issue(code, field, recordId, message)); }
function compareIssues(left: ForwardShadowCollectionIssue, right: ForwardShadowCollectionIssue): number { return left.code.localeCompare(right.code) || left.field.localeCompare(right.field) || (left.recordId ?? "").localeCompare(right.recordId ?? "") || left.message.localeCompare(right.message); }
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
