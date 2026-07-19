import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  AIAuditActorType,
  AIAuditRecordType,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  EventReplayAppendStatus,
  EventReplayAuditOperationType,
  EventReplayErrorCategory,
  EventReplayExportDestination,
  EventReplayExportFormat,
  EventReplayExportStatus,
  EventReplayLifecycleStatus,
  PrivacyLevel,
  ReplayCheckpointType,
  ReplayEventPhase,
  ReplayMissingDataPolicy,
  ReplayObservationWindowType,
  ReplayQualityStatus,
  ReplayReferenceType,
  checkpointFingerprint,
  type ReplayCheckpoint,
  type ReplayTimeline,
} from "../../contracts";
import { EventReplayEngine, exportEventReplays, translateEventReplayAuditRecord } from ".";
import { InMemoryEventReplayRepository, LocalNdjsonEventReplayRepository } from "../../repositories";

const tests: Array<{ readonly name: string; readonly run: () => void }> = [];
function test(name: string, run: () => void): void { tests.push({ name, run }); }
const clock = { now: () => "2026-07-19T12:00:00.000Z" };
function assertEqual<T>(actual: T, expected: T, message: string): void { if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`); }
function assertTrue(value: boolean, message: string): void { if (!value) throw new Error(message); }
function assertDeepEqual(actual: unknown, expected: unknown, message: string): void { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`); }
function expectError(action: () => void, expected?: string): void { try { action(); } catch (error: unknown) { const message = error instanceof Error ? error.message : String(error); if (expected !== undefined) assertTrue(message.toLowerCase().includes(expected.toLowerCase()), `Expected "${expected}", received "${message}".`); return; } throw new Error(`Expected error${expected === undefined ? "" : ` containing ${expected}`}.`); }

function checkpoint(input: Omit<ReplayCheckpoint, "payloadFingerprint">): ReplayCheckpoint {
  return { ...input, payloadFingerprint: checkpointFingerprint(input) };
}

function timeline(overrides: Partial<ReplayTimeline> = {}): ReplayTimeline {
  const start = checkpoint({ checkpointId: "event-replay-checkpoint:start", checkpointType: ReplayCheckpointType.TimelineStart, sequence: 1, checkpointTimestamp: "2020-03-01T00:00:00.000Z", phase: ReplayEventPhase.Setup, eventIds: [], observationWindowIds: [], evidenceReferenceIds: ["evidence:source:1"], completenessScore: 10000, confidenceScore: 10000, immutable: true });
  const observation = checkpoint({ checkpointId: "event-replay-checkpoint:obs", checkpointType: ReplayCheckpointType.Observation, sequence: 2, checkpointTimestamp: "2020-03-10T00:00:00.000Z", phase: ReplayEventPhase.Trigger, eventIds: ["event:liquidity-freeze"], observationWindowIds: ["window:one"], evidenceReferenceIds: ["evidence:source:1"], completenessScore: 10000, confidenceScore: 10000, immutable: true });
  const end = checkpoint({ checkpointId: "event-replay-checkpoint:end", checkpointType: ReplayCheckpointType.TimelineEnd, sequence: 3, checkpointTimestamp: "2020-04-01T00:00:00.000Z", phase: ReplayEventPhase.Resolution, eventIds: ["event:policy-response"], observationWindowIds: ["window:one"], evidenceReferenceIds: ["evidence:source:2"], completenessScore: 10000, confidenceScore: 10000, immutable: true });
  return {
    timelineId: "event-replay-timeline:covid-liquidity",
    schemaVersion: "1.0",
    timelineVersion: "1.0.0",
    title: "Liquidity Stress Evidence Replay",
    description: "Deterministic historical evidence reconstruction.",
    historicalEventReferences: [{ referenceId: "ref:historical-event:1", referenceType: ReplayReferenceType.HistoricalEvent, sourceId: "historical-event:covid-shock", sourceVersion: "1.0.0", frozenStatus: "FINALIZED", summary: "Historical shock", resolved: true }],
    patternReferences: [{ referenceId: "ref:pattern:1", referenceType: ReplayReferenceType.HistoricalPattern, sourceId: "historical-pattern:liquidity-stress", sourceVersion: "1.0.0", frozenStatus: "FINALIZED", resolved: true }],
    analogyReferences: [{ referenceId: "ref:analogy:1", referenceType: ReplayReferenceType.HistoricalAnalogy, sourceId: "historical-analogy:liquidity", sourceVersion: "1.0.0", frozenStatus: "REVIEWED", resolved: true }],
    supportingEvidenceReferences: [{ referenceId: "evidence:source:1", referenceType: ReplayReferenceType.SourceEvidence, sourceId: "research-source:one", sourceVersion: "1.0.0", frozenStatus: "FINALIZED", resolved: true }, { referenceId: "evidence:source:2", referenceType: ReplayReferenceType.ResearchLab, sourceId: "research:liquidity", sourceVersion: "1.0.0", frozenStatus: "FINALIZED", resolved: true }],
    observationWindows: [{ windowId: "window:one", windowType: ReplayObservationWindowType.OneMonth, startTimestamp: "2020-03-01T00:00:00.000Z", endTimestamp: "2020-04-01T00:00:00.000Z", label: "One month", evidenceReferenceIds: ["evidence:source:1"] }],
    events: [
      { eventId: "event:liquidity-freeze", occurredAt: "2020-03-10T00:00:00.000Z", phase: ReplayEventPhase.Trigger, title: "Liquidity freeze observed", description: "Historical evidence records funding stress.", observationWindowId: "window:one", evidenceReferenceIds: ["evidence:source:1"], snapshotReferenceIds: ["snapshot:one"], patternReferenceIds: ["ref:pattern:1"], analogyReferenceIds: ["ref:analogy:1"], missingData: false, limitations: ["Evidence is historical context only."] },
      { eventId: "event:policy-response", occurredAt: "2020-03-23T00:00:00.000Z", phase: ReplayEventPhase.Stabilization, title: "Policy response observed", description: "Historical evidence records a response phase.", observationWindowId: "window:one", evidenceReferenceIds: ["evidence:source:2"], snapshotReferenceIds: ["snapshot:two"], patternReferenceIds: ["ref:pattern:1"], analogyReferenceIds: ["ref:analogy:1"], missingData: false, limitations: [] },
    ],
    checkpoints: [start, observation, end],
    missingDataPolicy: ReplayMissingDataPolicy.PreserveGap,
    createdAt: "2026-07-19T10:00:00.000Z",
    createdBy: "owner",
    privacyLevel: PrivacyLevel.Internal,
    retention: AIAuditRetentionClassification.LongTerm,
    correlationId: "corr:replay",
    traceId: "trace:replay",
    metadata: { task: "D6-T5" },
    ...overrides,
  };
}

function makeEngine(): { readonly repository: InMemoryEventReplayRepository; readonly engine: EventReplayEngine } {
  const repository = new InMemoryEventReplayRepository();
  return { repository, engine: new EventReplayEngine(repository, clock) };
}

test("creates timeline and deterministic session", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  const result = engine.runSession({ sessionId: "event-replay-session:one", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  assertEqual(result.status, EventReplayAppendStatus.Appended, "append status");
  assertDeepEqual(result.record.orderedEventIds, ["event:liquidity-freeze", "event:policy-response"], "event order");
  assertEqual(result.record.qualityStatus, ReplayQualityStatus.Complete, "quality");
});

test("rejects non-chronological timeline events", () => {
  const { engine } = makeEngine();
  expectError(() => engine.createTimeline(timeline({ events: [...timeline().events].reverse() })), "INVALID_TIMELINE");
});

test("rejects malformed checkpoint fingerprint", () => {
  const broken = { ...timeline().checkpoints[0]!, payloadFingerprint: "bad" };
  const { engine } = makeEngine();
  expectError(() => engine.createTimeline(timeline({ checkpoints: [broken, ...timeline().checkpoints.slice(1)] })), "INVALID_CHECKPOINT");
});

test("rejects missing data under fail-closed policy", () => {
  const missing = { ...timeline().events[0]!, missingData: true, evidenceReferenceIds: [] };
  const { engine } = makeEngine();
  expectError(() => engine.createTimeline(timeline({ missingDataPolicy: ReplayMissingDataPolicy.FailClosed, events: [missing, timeline().events[1]!] })), "MISSING_DATA");
});

test("preserves missing data as incomplete evidence", () => {
  const missing = { ...timeline().events[0]!, missingData: true, evidenceReferenceIds: [] };
  const { engine } = makeEngine();
  engine.createTimeline(timeline({ events: [missing, timeline().events[1]!] }));
  const result = engine.runSession({ sessionId: "event-replay-session:missing", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  assertEqual(result.record.statistics.missingEventCount, 1, "missing count");
  assertEqual(result.record.statistics.completenessScore, 5000, "completeness");
  assertEqual(result.record.qualityStatus, ReplayQualityStatus.Incomplete, "quality");
});

test("rejects trading and prediction language", () => {
  const bad = { ...timeline().events[0]!, description: "This is a trading signal to buy." };
  const { engine } = makeEngine();
  expectError(() => engine.createTimeline(timeline({ events: [bad, timeline().events[1]!] })), "PROHIBITED_BEHAVIOR");
});

test("rejects unresolved references claiming resolution without status", () => {
  const { engine } = makeEngine();
  expectError(() => engine.createTimeline(timeline({ supportingEvidenceReferences: [{ referenceId: "evidence:bad", referenceType: ReplayReferenceType.SourceEvidence, sourceId: "source:bad", sourceVersion: "1", resolved: true }] })), "INVALID_REFERENCE");
});

test("repository replay is idempotent and conflicts on changed payload", () => {
  const { engine } = makeEngine();
  const value = timeline();
  assertEqual(engine.createTimeline(value).repositorySequence, 1, "sequence");
  assertEqual(engine.createTimeline(value).status, EventReplayAppendStatus.Replayed, "replay");
  expectError(() => engine.createTimeline({ ...value, title: "Changed" }), "IDEMPOTENCY_CONFLICT");
});

test("query filters by reference and quality", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  engine.runSession({ sessionId: "event-replay-session:query", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  assertEqual(engine.query({ filter: { referenceType: ReplayReferenceType.HistoricalPattern, sourceId: "historical-pattern:liquidity-stress" } }).length, 1, "reference query");
  assertEqual(engine.query({ filter: { qualityStatuses: [ReplayQualityStatus.Invalid] } }).length, 0, "quality query");
});

test("review appends lifecycle without rewriting session", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  engine.runSession({ sessionId: "event-replay-session:review", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  engine.review({ reviewId: "review:replay:1", sessionId: "event-replay-session:review", createdAt: "2026-07-19T12:01:00.000Z", reviewer: "owner", decision: "USEFUL_EVIDENCE", rationale: "Useful historical context.", unresolvedQuestionIds: [] });
  assertEqual(engine.get("event-replay-session:review")?.status, EventReplayLifecycleStatus.Reviewed, "reviewed status");
  assertEqual(engine.history("event-replay-session:review")?.reviews.length, 1, "reviews");
});

test("supersession requires material change and prevents cycles", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  engine.runSession({ sessionId: "event-replay-session:old", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  engine.runSession({ sessionId: "event-replay-session:new", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  expectError(() => engine.supersede({ supersessionId: "supersession:none", priorSessionId: "event-replay-session:old", successorSessionId: "event-replay-session:new", createdAt: "2026-07-19T12:02:00.000Z", reason: "No material change.", changedTimeline: false, changedEvidence: false, changedCheckpointMethod: false, ownerReference: "owner" }), "INVALID_RECORD");
  engine.supersede({ supersessionId: "supersession:one", priorSessionId: "event-replay-session:old", successorSessionId: "event-replay-session:new", createdAt: "2026-07-19T12:02:00.000Z", reason: "Evidence improved.", changedTimeline: false, changedEvidence: true, changedCheckpointMethod: false, ownerReference: "owner" });
  expectError(() => engine.supersede({ supersessionId: "supersession:cycle", priorSessionId: "event-replay-session:new", successorSessionId: "event-replay-session:old", createdAt: "2026-07-19T12:03:00.000Z", reason: "Cycle.", changedTimeline: true, changedEvidence: false, changedCheckpointMethod: false, ownerReference: "owner" }), "INVALID_REFERENCE");
});

test("archive moves terminal lifecycle without deleting history", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  engine.runSession({ sessionId: "event-replay-session:archive", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  engine.archive("event-replay-session:archive", "2026-07-19T12:03:00.000Z", "Archive after review window.");
  assertEqual(engine.get("event-replay-session:archive")?.status, EventReplayLifecycleStatus.Archived, "archived status");
  assertEqual(engine.history("event-replay-session:archive")?.lifecycle.at(-1)?.toStatus, EventReplayLifecycleStatus.Archived, "history");
});

test("statistics are deterministic", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  engine.runSession({ sessionId: "event-replay-session:stats", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  const stats = engine.statistics();
  assertEqual(stats.timelineCount, 1, "timeline count");
  assertEqual(stats.sessionCount, 1, "session count");
  assertEqual(stats.averageCompletenessScore, 10000, "average");
  assertEqual(stats.phaseCounts[ReplayEventPhase.Trigger], 1, "phase");
});

test("ranking is stable", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  engine.runSession({ sessionId: "event-replay-session:b", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  engine.runSession({ sessionId: "event-replay-session:a", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  assertDeepEqual(engine.rank().map((item) => item.sessionId), ["event-replay-session:a", "event-replay-session:b"], "rank");
});

test("export enforces privacy policy", () => {
  const { repository, engine } = makeEngine();
  engine.createTimeline(timeline({ privacyLevel: PrivacyLevel.LocalOnly }));
  engine.runSession({ sessionId: "event-replay-session:export", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  const rejected = exportEventReplays(repository, { exportId: "export:one", requestedAt: "2026-07-19T12:00:00.000Z", query: {}, format: EventReplayExportFormat.Json, destination: EventReplayExportDestination.ExternalTransfer }, { allowExternalExports: true, requireSensitiveAuthorization: false, sensitiveAuthorizationReferences: [] });
  assertEqual(rejected.status, EventReplayExportStatus.Rejected, "rejected");
  const exported = exportEventReplays(repository, { exportId: "export:two", requestedAt: "2026-07-19T12:00:00.000Z", query: {}, format: EventReplayExportFormat.Ndjson, destination: EventReplayExportDestination.LocalSnapshot }, { allowExternalExports: false, requireSensitiveAuthorization: false, sensitiveAuthorizationReferences: [] });
  assertEqual(exported.recordCount, 1, "record count");
  assertTrue(exported.content?.includes("event-replay-session:export") === true, "content");
});

test("audit translation is pure and normalized", () => {
  const translation = translateEventReplayAuditRecord({ auditId: "audit:replay:1", operationType: EventReplayAuditOperationType.SessionCompleted, sourceRecordId: "event-replay-session:audit", recordVersion: "1.0.0", timestamp: "2026-07-19T12:00:00.000Z", status: "COMPLETED", reasonCodes: ["REPLAY_COMPLETED"], timelineId: "event-replay-timeline:covid-liquidity", sessionId: "event-replay-session:audit", qualityStatus: ReplayQualityStatus.Complete, statistics: { eventCount: 2, checkpointCount: 3, observationWindowCount: 1, missingEventCount: 0, phaseCounts: {}, completenessScore: 10000, confidenceScore: 10000, qualityStatus: ReplayQualityStatus.Complete, limitationCount: 2 }, limitations: ["Evidence only."], privacyLevel: PrivacyLevel.Internal, retention: AIAuditRetentionClassification.LongTerm, correlationId: "corr", traceId: "trace", policyVersions: { replay: "1.0" }, metadata: {} }, { idempotencyKey: "idem:replay:1", actor: { type: AIAuditActorType.AlphaSubsystem, actorId: "event-replay" }, parentAuditRecordIds: [], relatedAuditRecordIds: [] });
  assertEqual(translation.input.recordType, AIAuditRecordType.EventReplay, "record type");
  assertEqual(translation.input.sourceSubsystem, AIAuditSourceSubsystem.EventReplay, "subsystem");
  assertEqual(translation.input.finalOutcome, "COMPLETED", "outcome");
});

test("local NDJSON repository reloads append-only history", () => {
  const root = mkdtempSync(join(tmpdir(), "alpha-event-replay-"));
  const first = new EventReplayEngine(new LocalNdjsonEventReplayRepository(root, "store"), clock);
  first.createTimeline(timeline());
  first.runSession({ sessionId: "event-replay-session:durable", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" });
  const reloaded = new LocalNdjsonEventReplayRepository(root, "store");
  assertEqual(reloaded.listSessions().length, 1, "reload count");
  assertEqual(reloaded.getSessionById("event-replay-session:durable")?.orderedEventIds.length, 2, "reload order");
});

test("local NDJSON rejects traversal and truncated records", () => {
  expectError(() => new LocalNdjsonEventReplayRepository(tmpdir(), "../bad"), "path traversal");
  const root = mkdtempSync(join(tmpdir(), "alpha-event-replay-corrupt-"));
  writeFileSync(join(root, "bad.ndjson"), "{\"schemaVersion\":\"1.0\"}");
  expectError(() => new LocalNdjsonEventReplayRepository(root, "bad"), "truncated");
});

test("secret metadata is rejected", () => {
  const { engine } = makeEngine();
  expectError(() => engine.createTimeline(timeline({ metadata: { apiKey: "hidden" } })), "SECRET_METADATA");
});

test("does not expose provider broker or live-market behavior", () => {
  const { engine } = makeEngine();
  engine.createTimeline(timeline());
  const session = engine.runSession({ sessionId: "event-replay-session:boundary", sessionVersion: "1.0.0", timelineId: "event-replay-timeline:covid-liquidity" }).record;
  assertEqual(session.replayMode, "DETERMINISTIC_EVIDENCE_RECONSTRUCTION", "mode");
  assertTrue(session.limitations.some((item) => item.includes("no execution")), "boundary");
  assertEqual(Object.keys(session.metadata).includes("provider"), false, "provider");
});

let passed = 0;
for (const entry of tests) {
  try {
    entry.run();
    passed += 1;
    console.log(`PASS ${entry.name}`);
  } catch (error) {
    console.error(`FAIL ${entry.name}`);
    console.error(error);
    throw error;
  }
}
console.log(`Event Replay tests: ${passed}/${tests.length} passed.`);
