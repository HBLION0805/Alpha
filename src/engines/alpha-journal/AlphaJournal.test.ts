import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AIAuditActorType,
  AIAuditRecordType,
  AIAuditRetentionClassification,
  AIAuditSourceSubsystem,
  AlphaJournalAmendmentType,
  AlphaJournalAppendStatus,
  AlphaJournalAuditOperationType,
  AlphaJournalAuthorType,
  AlphaJournalEntryType,
  AlphaJournalExportDestination,
  AlphaJournalExportFormat,
  AlphaJournalExportStatus,
  AlphaJournalQuality,
  AlphaJournalReferenceResolution,
  AlphaJournalReferenceType,
  AlphaJournalStatus,
  PredictionAccuracy,
  PredictionProfitability,
  PrivacyLevel,
  createAlphaJournalEntryId,
  type AlphaJournalAmendment,
  type AlphaJournalAuditRecord,
  type AlphaJournalContent,
  type AlphaJournalEntry,
  type AlphaJournalEntrySnapshot,
  type AlphaJournalReview,
} from "../../contracts";
import {
  InMemoryAlphaJournalRepository,
  LocalNdjsonAlphaJournalRepository,
} from "../../repositories";
import {
  AlphaJournal,
  auditRecordFromAlphaJournal,
  exportAlphaJournal,
  type AlphaJournalClock,
} from ".";

interface TestCase { readonly name: string; readonly run: () => void; }

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

function expectError(action: () => void, expected: string): void {
  try { action(); } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    assertTrue(message.includes(expected), `Expected "${expected}", received "${message}".`);
    return;
  }
  throw new Error(`Expected error containing "${expected}".`);
}

class FixedClock implements AlphaJournalClock {
  constructor(private value = "2026-07-18T20:00:00.000Z") {}
  now(): string { return this.value; }
}

function content(overrides: Partial<AlphaJournalContent> = {}): AlphaJournalContent {
  return {
    factualObservations: ["Synthetic market breadth improved."],
    interpretation: "The observation may support a short-lived risk-on regime.",
    assumptions: ["Synthetic inputs are internally consistent."],
    uncertainty: "Duration is unknown.",
    decisionRationale: "Preserve context before any later outcome.",
    plannedAction: "Observe without executing capital.",
    expectedOutcome: "A reviewable evidence record exists.",
    riskNotes: ["No trade or portfolio mutation is authorized."],
    ...overrides,
  };
}

function snapshot(overrides: Partial<AlphaJournalEntrySnapshot> = {}): AlphaJournalEntrySnapshot {
  return {
    schemaVersion: "1.0",
    createdAt: "2026-07-18T14:00:00.000Z",
    eventTimestamp: "2026-07-18T13:59:00.000Z",
    entryType: AlphaJournalEntryType.MarketObservation,
    title: "Synthetic market observation",
    content: content(),
    confidence: 75,
    market: "US",
    ticker: "ALPHA",
    asset: "Synthetic Asset",
    tags: ["market", "synthetic"],
    ownerReference: "owner-1",
    authorType: AlphaJournalAuthorType.Owner,
    privacyLevel: PrivacyLevel.Internal,
    retention: AIAuditRetentionClassification.Permanent,
    evidence: {
      predictions: [{ referenceId: "prediction-1", recordType: AlphaJournalReferenceType.Prediction, resolution: AlphaJournalReferenceResolution.Resolved, version: "v1" }],
      research: [{ referenceId: "research-1", recordType: AlphaJournalReferenceType.Research, resolution: AlphaJournalReferenceResolution.Resolved }],
      decisions: [{ referenceId: "decision-1", recordType: AlphaJournalReferenceType.Decision, resolution: AlphaJournalReferenceResolution.Resolved }],
      trades: [{ referenceId: "trade-1", recordType: AlphaJournalReferenceType.Trade, resolution: AlphaJournalReferenceResolution.Unresolved }],
      strategies: [{ referenceId: "strategy-1", recordType: AlphaJournalReferenceType.Strategy, resolution: AlphaJournalReferenceResolution.Unresolved, version: "v1" }],
      portfolios: [{ referenceId: "portfolio-snapshot-1", recordType: AlphaJournalReferenceType.Portfolio, resolution: AlphaJournalReferenceResolution.Unresolved }],
      audits: [{ referenceId: "audit-1", recordType: AlphaJournalReferenceType.Audit, resolution: AlphaJournalReferenceResolution.Resolved }],
      journalEntries: [],
      developmentValidations: [{ referenceId: "validation-1", recordType: AlphaJournalReferenceType.DevelopmentValidation, resolution: AlphaJournalReferenceResolution.Unresolved }],
    },
    context: {
      capturedAt: "2026-07-18T14:00:00.000Z",
      marketTimestamp: "2026-07-18T13:59:00.000Z",
      portfolioSnapshot: { referenceId: "portfolio-snapshot-1", recordType: AlphaJournalReferenceType.Portfolio, resolution: AlphaJournalReferenceResolution.Unresolved },
      opportunityScore: { opportunityId: "opportunity-1", score: 82, policyVersion: "opportunity-v1" },
      riskSnapshot: { riskAssessmentId: "risk-1", policyVersion: "risk-v1" },
      prediction: { referenceId: "prediction-1", recordType: AlphaJournalReferenceType.Prediction, resolution: AlphaJournalReferenceResolution.Resolved, version: "v1" },
      configurationVersion: "config-v1",
      strategy: { referenceId: "strategy-1", recordType: AlphaJournalReferenceType.Strategy, resolution: AlphaJournalReferenceResolution.Unresolved, version: "v1" },
      policyVersions: { journal: "journal-policy-v1" },
      aiContribution: { routingDecisionId: "route-1", modelId: "model-neutral" },
      sourceDataTimestamps: { synthetic: "2026-07-18T13:58:00.000Z" },
      ownerDecisionState: "OBSERVE",
    },
    correlationId: "correlation-1",
    traceId: "trace-1",
    metadata: { source: "synthetic", verified: true },
    ...overrides,
  };
}

function amendment(entryId: string, overrides: Partial<AlphaJournalAmendment> = {}): AlphaJournalAmendment {
  return {
    amendmentId: `${entryId}:amendment:1`,
    entryId,
    createdAt: "2026-07-18T16:00:00.000Z",
    amendmentType: AlphaJournalAmendmentType.Clarification,
    reason: "Clarify the original observation without replacing it.",
    content: content({ factualObservations: ["Clarifying synthetic observation."] }),
    authorReference: "owner-1",
    evidenceReferences: [{ referenceId: "audit-amendment-evidence", recordType: AlphaJournalReferenceType.Audit, resolution: AlphaJournalReferenceResolution.Resolved }],
    auditReference: { referenceId: "audit-amendment-1", recordType: AlphaJournalReferenceType.Audit, resolution: AlphaJournalReferenceResolution.Resolved },
    ...overrides,
  };
}

function review(entryId: string, overrides: Partial<AlphaJournalReview> = {}): AlphaJournalReview {
  return {
    reviewId: `${entryId}:review:1`,
    entryId,
    createdAt: "2026-07-18T18:00:00.000Z",
    reviewer: "owner-1",
    whatHappened: "The synthetic observation was later reviewed.",
    whatWasExpected: "A short-lived risk-on regime.",
    whatWasCorrect: "Breadth improved.",
    whatWasIncorrect: "Duration was overestimated.",
    controllableFactors: ["Evidence classification"],
    uncontrollableFactors: ["Market response"],
    processQuality: AlphaJournalQuality.Good,
    outcomeQuality: AlphaJournalQuality.Mixed,
    predictionAccuracyReference: { predictionId: "prediction-1", predictionReviewId: "prediction-review-1", accuracy: PredictionAccuracy.PartiallyAccurate },
    tradingProfitabilityReference: { predictionReviewId: "prediction-review-1", profitability: PredictionProfitability.NotApplicable },
    emotionalObservation: "No reactive execution occurred.",
    lessons: [{ lessonId: `${entryId}:lesson:1`, statement: "Separate observation from action.", tags: ["discipline"], futureRuleOrExperiment: "Review breadth duration separately." }],
    futureRuleOrExperiment: "Track synthetic breadth persistence.",
    strategyChangeCandidate: "Candidate only; no automatic strategy mutation.",
    auditReference: { referenceId: "audit-review-1", recordType: AlphaJournalReferenceType.Audit, resolution: AlphaJournalReferenceResolution.Resolved },
    ...overrides,
  };
}

function setup(value = snapshot()): { readonly repository: InMemoryAlphaJournalRepository; readonly journal: AlphaJournal; readonly entry: AlphaJournalEntry } {
  const repository = new InMemoryAlphaJournalRepository();
  const journal = new AlphaJournal(repository, new FixedClock());
  return { repository, journal, entry: journal.finalize(value).record };
}

const tests: ReadonlyArray<TestCase> = [
  { name: "valid finalized journal entry appends", run: () => { const { entry } = setup(); assertEqual(entry.status, AlphaJournalStatus.Finalized, "status"); } },
  { name: "deterministic entry IDs are stable", run: () => assertEqual(createAlphaJournalEntryId(snapshot()), createAlphaJournalEntryId(snapshot()), "ID") },
  { name: "empty authoritative content is rejected", run: () => expectError(() => setup(snapshot({ content: content({ factualObservations: [], interpretation: "", assumptions: [], uncertainty: "", decisionRationale: "", plannedAction: "", expectedOutcome: "", riskNotes: [] }) })), "EMPTY_CONTENT") },
  { name: "future event timestamp is rejected", run: () => expectError(() => setup(snapshot({ eventTimestamp: "2026-07-19T00:00:00.000Z" })), "FUTURE_TIMESTAMP") },
  { name: "confidence outside range is rejected", run: () => expectError(() => setup(snapshot({ confidence: 101 })), "confidence") },
  { name: "PUBLIC journal evidence is rejected", run: () => expectError(() => setup(snapshot({ privacyLevel: PrivacyLevel.Public })), "PUBLIC") },
  { name: "malformed typed reference is rejected", run: () => expectError(() => setup(snapshot({ evidence: { ...snapshot().evidence, predictions: [{ referenceId: "prediction-1", recordType: AlphaJournalReferenceType.Trade as AlphaJournalReferenceType.Prediction, resolution: AlphaJournalReferenceResolution.Resolved }] } })), "mismatched typed reference") },
  { name: "identical append is idempotently replayed", run: () => { const repository = new InMemoryAlphaJournalRepository(); const journal = new AlphaJournal(repository, new FixedClock()); const first = journal.finalize(snapshot()); const second = journal.finalize(snapshot()); assertEqual(first.status, AlphaJournalAppendStatus.Appended, "first"); assertEqual(second.status, AlphaJournalAppendStatus.Replayed, "second"); assertEqual(first.repositorySequence, second.repositorySequence, "sequence"); } },
  { name: "conflicting duplicate entry ID is rejected", run: () => { const { repository, entry } = setup(); expectError(() => repository.appendFinalized({ ...entry, title: "Conflicting title" }, "2026-07-18T20:00:00.000Z"), "IDEMPOTENCY_CONFLICT"); } },
  { name: "finalized entry cannot be overwritten", run: () => { const { journal, entry } = setup(); (entry as { title: string }).title = "Caller overwrite"; assertTrue(journal.get(entry.entryId)?.title !== "Caller overwrite", "stored entry changed"); } },
  { name: "repository has no update overwrite or delete method", run: () => { const repository: object = new InMemoryAlphaJournalRepository(); assertTrue(!("update" in repository) && !("overwrite" in repository) && !("delete" in repository), "mutable operation exposed"); } },
  { name: "review appends separately and advances projection", run: () => { const { journal, entry } = setup(); journal.review(review(entry.entryId)); assertEqual(journal.get(entry.entryId)?.status, AlphaJournalStatus.Reviewed, "status"); assertEqual(journal.history(entry.entryId)?.reviews.length, 1, "review count"); assertEqual(journal.history(entry.entryId)?.entry.content.interpretation, entry.content.interpretation, "original text"); } },
  { name: "review before finalization is rejected", run: () => { const journal = new AlphaJournal(new InMemoryAlphaJournalRepository(), new FixedClock()); expectError(() => journal.review(review("journal:missing")), "ENTRY_NOT_FOUND"); } },
  { name: "duplicate review ID is rejected", run: () => { const { repository, journal, entry } = setup(); const value = review(entry.entryId); journal.review(value); expectError(() => repository.appendReview({ ...value, whatHappened: "Conflict" }, { ...(journal.history(entry.entryId)?.lifecycle[1] as NonNullable<ReturnType<AlphaJournal["history"]>>["lifecycle"][number]) }, "2026-07-18T20:00:00.000Z"), "IDEMPOTENCY_CONFLICT"); } },
  { name: "amendment preserves original entry", run: () => { const { journal, entry } = setup(); journal.amend(amendment(entry.entryId)); assertEqual(journal.get(entry.entryId)?.content.factualObservations[0], "Synthetic market breadth improved.", "original"); assertEqual(journal.history(entry.entryId)?.amendments.length, 1, "amendments"); } },
  { name: "amendment before original entry is rejected", run: () => { const journal = new AlphaJournal(new InMemoryAlphaJournalRepository(), new FixedClock()); expectError(() => journal.amend(amendment("journal:missing")), "ENTRY_NOT_FOUND"); } },
  { name: "identical amendment is replayed", run: () => { const { journal, entry } = setup(); const value = amendment(entry.entryId); assertEqual(journal.amend(value).status, AlphaJournalAppendStatus.Appended, "first"); assertEqual(journal.amend(value).status, AlphaJournalAppendStatus.Replayed, "replay"); } },
  { name: "self-referential amendment is rejected", run: () => { const { journal, entry } = setup(); const value = amendment(entry.entryId); expectError(() => journal.amend({ ...value, parentAmendmentId: value.amendmentId }), "cannot reference itself"); } },
  { name: "archive before an entry exists is rejected", run: () => { const journal = new AlphaJournal(new InMemoryAlphaJournalRepository(), new FixedClock()); expectError(() => journal.archive("journal:missing", "2026-07-18T19:00:00.000Z", "Archive."), "ENTRY_NOT_FOUND"); } },
  { name: "valid archive after finalization succeeds", run: () => { const { journal, entry } = setup(); journal.archive(entry.entryId, "2026-07-18T19:00:00.000Z", "Authoritative entry archived."); assertEqual(journal.get(entry.entryId)?.status, AlphaJournalStatus.Archived, "status"); } },
  { name: "reviewed entry can be archived", run: () => { const { journal, entry } = setup(); journal.review(review(entry.entryId)); journal.archive(entry.entryId, "2026-07-18T19:00:00.000Z", "Reviewed and archived."); assertEqual(journal.get(entry.entryId)?.status, AlphaJournalStatus.Archived, "status"); } },
  { name: "context snapshot is immutable", run: () => { const value = snapshot(); const { journal, entry } = setup(value); (value.context as { ownerDecisionState: string }).ownerDecisionState = "MUTATED"; assertEqual(journal.get(entry.entryId)?.context.ownerDecisionState, "OBSERVE", "context"); } },
  { name: "typed Prediction reference is preserved", run: () => { const { entry } = setup(); assertEqual(entry.evidence.predictions[0]?.referenceId, "prediction-1", "prediction"); } },
  { name: "typed Research reference is preserved", run: () => { const { entry } = setup(); assertEqual(entry.evidence.research[0]?.referenceId, "research-1", "research"); } },
  { name: "typed Trade reference is preserved", run: () => { const { entry } = setup(); assertEqual(entry.evidence.trades[0]?.referenceId, "trade-1", "trade"); } },
  { name: "future system reference remains explicitly unresolved", run: () => { const { entry } = setup(); assertEqual(entry.evidence.strategies[0]?.resolution, AlphaJournalReferenceResolution.Unresolved, "resolution"); } },
  { name: "macro entry does not require ticker or trade", run: () => { const full = snapshot(); const { ticker: _ticker, asset: _asset, ...withoutInstrument } = full; const value: AlphaJournalEntrySnapshot = { ...withoutInstrument, entryType: AlphaJournalEntryType.MarketObservation, evidence: { ...full.evidence, trades: [] } }; const { entry } = setup(value); assertEqual(entry.ticker, undefined, "ticker"); } },
  { name: "query by category works", run: () => { const { journal } = setup(); assertEqual(journal.query({ filter: { entryTypes: [AlphaJournalEntryType.MarketObservation] } }).length, 1, "count"); } },
  { name: "query by ticker works", run: () => { const { journal } = setup(); assertEqual(journal.query({ filter: { ticker: "ALPHA" } }).length, 1, "count"); assertEqual(journal.query({ filter: { ticker: "MISSING" } }).length, 0, "missing"); } },
  { name: "query by prediction reference works", run: () => { const { journal } = setup(); assertEqual(journal.query({ filter: { predictionId: "prediction-1" } }).length, 1, "count"); } },
  { name: "query by research trade and strategy references works", run: () => { const { journal } = setup(); assertEqual(journal.query({ filter: { researchId: "research-1", tradeId: "trade-1", strategyId: "strategy-1" } }).length, 1, "count"); } },
  { name: "query by tag works", run: () => { const { journal } = setup(); assertEqual(journal.query({ filter: { tags: ["market", "synthetic"] } }).length, 1, "count"); } },
  { name: "query by date range works", run: () => { const { journal } = setup(); assertEqual(journal.query({ filter: { fromEventTimestamp: "2026-07-18T13:00:00.000Z", toEventTimestamp: "2026-07-18T14:00:00.000Z" } }).length, 1, "count"); } },
  { name: "query by trace and correlation works", run: () => { const { journal } = setup(); assertEqual(journal.query({ filter: { traceId: "trace-1", correlationId: "correlation-1" } }).length, 1, "count"); } },
  { name: "related-entry query works", run: () => { const repository = new InMemoryAlphaJournalRepository(); const journal = new AlphaJournal(repository, new FixedClock()); const first = journal.finalize(snapshot()).record; const secondSnapshot = snapshot({ createdAt: "2026-07-18T14:01:00.000Z", eventTimestamp: "2026-07-18T14:01:00.000Z", title: "Related entry", evidence: { ...snapshot().evidence, journalEntries: [{ referenceId: first.entryId, recordType: AlphaJournalReferenceType.Journal, resolution: AlphaJournalReferenceResolution.Resolved }] }, context: { ...snapshot().context, capturedAt: "2026-07-18T14:01:00.000Z" } }); const second = journal.finalize(secondSnapshot).record; assertEqual(journal.related(first.entryId)[0]?.entryId, second.entryId, "related"); } },
  { name: "pagination follows repository sequence not timestamps", run: () => { const repository = new InMemoryAlphaJournalRepository(); const journal = new AlphaJournal(repository, new FixedClock()); journal.finalize(snapshot()); const second = journal.finalize(snapshot({ createdAt: "2026-07-18T14:01:00.000Z", title: "Second entry" })).record; assertEqual(journal.query({ offset: 1, limit: 1 })[0]?.entryId, second.entryId, "page"); } },
  { name: "repository sequences increase monotonically", run: () => { const { repository, journal, entry } = setup(); journal.amend(amendment(entry.entryId)); journal.review(review(entry.entryId)); assertDeepEqual(repository.allEvents().map((event) => event.sequence), [1, 2, 3], "sequence"); } },
  { name: "statistics are deterministic", run: () => { const { journal, entry } = setup(); journal.review(review(entry.entryId)); const first = journal.statistics(); const second = journal.statistics(); assertDeepEqual(first, second, "statistics"); assertEqual(first.reviewedEntries, 1, "reviewed"); assertEqual(first.lessonsByTag.discipline, 1, "lesson tag"); assertEqual(first.processQualityDistribution.GOOD, 1, "quality"); } },
  { name: "export ordering is deterministic", run: () => { const { repository } = setup(); const request = { exportId: "export-1", requestedAt: "2026-07-18T20:00:00.000Z", query: {}, format: AlphaJournalExportFormat.Ndjson, destination: AlphaJournalExportDestination.LocalSnapshot }; const policy = { allowExternalExports: false, requireSensitiveAuthorization: true, sensitiveAuthorizationReferences: [] }; assertEqual(exportAlphaJournal(repository, request, policy).content, exportAlphaJournal(repository, request, policy).content, "export"); } },
  { name: "LOCAL_ONLY external export is rejected", run: () => { const { repository } = setup(snapshot({ privacyLevel: PrivacyLevel.LocalOnly })); const result = exportAlphaJournal(repository, { exportId: "export-local", requestedAt: "2026-07-18T20:00:00.000Z", query: {}, format: AlphaJournalExportFormat.Json, destination: AlphaJournalExportDestination.ExternalTransfer }, { allowExternalExports: true, requireSensitiveAuthorization: true, sensitiveAuthorizationReferences: [] }); assertEqual(result.status, AlphaJournalExportStatus.Rejected, "status"); } },
  { name: "sensitive export requires authorization", run: () => { const { repository } = setup(snapshot({ privacyLevel: PrivacyLevel.Sensitive })); const base = { exportId: "export-sensitive", requestedAt: "2026-07-18T20:00:00.000Z", query: {}, format: AlphaJournalExportFormat.Json, destination: AlphaJournalExportDestination.ExternalTransfer }; const policy = { allowExternalExports: true, requireSensitiveAuthorization: true, sensitiveAuthorizationReferences: ["approval-1"] }; assertEqual(exportAlphaJournal(repository, base, policy).status, AlphaJournalExportStatus.Rejected, "rejected"); assertEqual(exportAlphaJournal(repository, { ...base, sensitiveAuthorizationReference: "approval-1" }, policy).status, AlphaJournalExportStatus.Exported, "allowed"); } },
  { name: "secret-bearing metadata is rejected", run: () => expectError(() => setup(snapshot({ metadata: { api_key: "forbidden" } })), "SECRET_METADATA") },
  { name: "local repository reload preserves records", run: () => { const directory = mkdtempSync(join(tmpdir(), "alpha-journal-")); try { const repository = new LocalNdjsonAlphaJournalRepository(directory); const journal = new AlphaJournal(repository, new FixedClock()); const entry = journal.finalize(snapshot()).record; journal.amend(amendment(entry.entryId)); const loaded = new LocalNdjsonAlphaJournalRepository(directory); assertEqual(loaded.getEntryHistory(entry.entryId)?.amendments.length, 1, "amendment"); } finally { rmSync(directory, { recursive: true, force: true }); } } },
  { name: "durable append does not rewrite prior history", run: () => { const directory = mkdtempSync(join(tmpdir(), "alpha-journal-append-")); try { const repository = new LocalNdjsonAlphaJournalRepository(directory); const journal = new AlphaJournal(repository, new FixedClock()); const entry = journal.finalize(snapshot()).record; const path = repository.getStoragePath(); const before = readFileSync(path, "utf8"); journal.amend(amendment(entry.entryId)); const after = readFileSync(path, "utf8"); assertTrue(after.startsWith(before) && after.length > before.length, "append-only file"); } finally { rmSync(directory, { recursive: true, force: true }); } } },
  { name: "truncated NDJSON fails closed", run: () => { const directory = mkdtempSync(join(tmpdir(), "alpha-journal-corrupt-")); try { writeFileSync(join(directory, "alpha-journal-v1.ndjson"), "{}"); expectError(() => new LocalNdjsonAlphaJournalRepository(directory), "truncated"); } finally { rmSync(directory, { recursive: true, force: true }); } } },
  { name: "non-canonical NDJSON fails closed", run: () => { const directory = mkdtempSync(join(tmpdir(), "alpha-journal-noncanonical-")); try { writeFileSync(join(directory, "alpha-journal-v1.ndjson"), '{"sequence":1,"schemaVersion":"1.0"}\n'); expectError(() => new LocalNdjsonAlphaJournalRepository(directory), "non-canonical"); } finally { rmSync(directory, { recursive: true, force: true }); } } },
  { name: "path traversal is rejected", run: () => { const directory = mkdtempSync(join(tmpdir(), "alpha-journal-path-")); try { expectError(() => new LocalNdjsonAlphaJournalRepository(directory, "../escape"), "path traversal"); } finally { rmSync(directory, { recursive: true, force: true }); } } },
  { name: "caller inputs are not mutated", run: () => { const value = snapshot(); const before = JSON.stringify(value); setup(value); assertEqual(JSON.stringify(value), before, "input"); } },
  { name: "defensive copies are returned", run: () => { const { journal, entry } = setup(); const read = journal.get(entry.entryId) as AlphaJournalEntry; (read as { title: string }).title = "mutated"; assertTrue(journal.get(entry.entryId)?.title !== "mutated", "copy"); } },
  { name: "journal-to-audit translation is deterministic", run: () => { const source: AlphaJournalAuditRecord = { auditId: "journal-audit-1", operationType: AlphaJournalAuditOperationType.EntryFinalized, sourceRecordId: "journal-source-1", entryId: "journal-entry-1", timestamp: "2026-07-18T20:00:00.000Z", status: "FINALIZED", reasonCodes: ["ENTRY_FINALIZED"], privacyLevel: PrivacyLevel.Internal, retention: AIAuditRetentionClassification.Permanent, correlationId: "correlation-1", traceId: "trace-1", policyVersions: { journal: "v1" }, metadata: { category: "market" } }; const context = { idempotencyKey: "journal-audit-idempotency-1", actor: { type: AIAuditActorType.Owner, actorId: "owner-1" }, parentAuditRecordIds: [], relatedAuditRecordIds: [] }; const first = auditRecordFromAlphaJournal(source, context); const second = auditRecordFromAlphaJournal(source, context); assertDeepEqual(first, second, "translation"); assertEqual(first.recordType, AIAuditRecordType.JournalEntry, "record type"); assertEqual(first.sourceSubsystem, AIAuditSourceSubsystem.Journal, "subsystem"); } },
  { name: "Prediction Log records are not mutated", run: () => { const prediction = { predictionId: "prediction-1", status: "LOCKED" }; const before = JSON.stringify(prediction); setup(snapshot({ evidence: { ...snapshot().evidence, predictions: [{ referenceId: prediction.predictionId, recordType: AlphaJournalReferenceType.Prediction, resolution: AlphaJournalReferenceResolution.Resolved }] } })); assertEqual(JSON.stringify(prediction), before, "prediction source"); } },
];

let passed = 0;
for (const test of tests) {
  try { test.run(); passed += 1; } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${test.name}: ${message}`);
    throw error;
  }
}
console.log(`Alpha Journal: ${String(passed)}/${String(tests.length)} tests passed.`);
