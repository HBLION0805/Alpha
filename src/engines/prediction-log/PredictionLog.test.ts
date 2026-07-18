import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ConfidenceLevel,
  PredictionAccuracy,
  PredictionCategory,
  PredictionDirection,
  PredictionExportFormat,
  PredictionProfitability,
  PredictionReviewResult,
  PredictionReviewStatus,
  PredictionStatus,
  PredictionSubjectType,
  ReasoningLevel,
  createPredictionId,
  validatePredictionSnapshot,
  type Prediction,
  type PredictionOutcome,
  type PredictionReview,
  type PredictionReviewStart,
  type PredictionSnapshot,
} from "../../contracts";
import {
  InMemoryPredictionLogRepository,
  LocalNdjsonPredictionLogRepository,
} from "../../repositories";
import {
  PredictionLog,
  exportPredictions,
  summarizePrediction,
  translatePrediction,
  type PredictionClock,
} from ".";

interface TestCase {
  readonly name: string;
  readonly run: () => void;
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function assertTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

function expectError(action: () => void, expected: string): void {
  try {
    action();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    assertTrue(message.includes(expected), `Expected error containing "${expected}", received "${message}".`);
    return;
  }
  throw new Error(`Expected error containing "${expected}".`);
}

class FixedClock implements PredictionClock {
  constructor(private value = "2026-07-18T20:00:00.000Z") {}
  now(): string {
    return this.value;
  }
  set(value: string): void {
    this.value = value;
  }
}

function snapshot(overrides: Partial<PredictionSnapshot> = {}): PredictionSnapshot {
  return {
    createdAt: "2026-07-18T14:00:00.000Z",
    predictionType: PredictionSubjectType.Company,
    market: "US",
    ticker: "ALPHA",
    asset: "Synthetic Alpha Asset",
    category: PredictionCategory.Company,
    statement: "Synthetic Alpha Asset will rise over the next five sessions.",
    expectedDirection: PredictionDirection.Up,
    confidence: { value: 80, level: ConfidenceLevel.High, rationale: "Strong synthetic evidence." },
    expectedTimeHorizon: "Five market sessions",
    expectedCatalyst: "Synthetic catalyst",
    evidence: {
      supportingEvidence: ["Synthetic evidence captured before the prediction."],
      researchReferences: [{ researchId: "research-1", researchVersion: "v1" }],
      journalReferences: [],
      auditReferences: [{ auditId: "audit-1", traceId: "trace-1" }],
      strategyReferences: [{ strategyId: "strategy-1", strategyVersion: "v1" }],
      tradeReferences: [],
      reviewReferences: [],
    },
    version: { predictionVersion: "v1", schemaVersion: "1.0" },
    strategy: { strategyId: "strategy-1", strategyVersion: "v1" },
    decisionSnapshot: {
      opportunityScore: { opportunityId: "opportunity-1", score: 82, scoringPolicyVersion: "opportunity-policy-v1" },
      risk: { riskAssessmentId: "risk-1", riskPolicyVersion: "risk-policy-v1", output: { approved: true, score: 20 } },
      routerDecision: { decisionId: "route-1", providerId: "provider-neutral", modelId: "model-neutral" },
      selectedModelId: "model-neutral",
      configurationVersion: "config-v1",
      policyVersion: "prediction-policy-v1",
      reasoningLevel: ReasoningLevel.High,
      predictionTimestamp: "2026-07-18T14:00:00.000Z",
      marketTimestamp: "2026-07-18T13:59:00.000Z",
    },
    owner: "owner-1",
    aiVersion: "ai-runtime-v1",
    reviewRequired: true,
    ...overrides,
  };
}

function outcome(predictionId: string): PredictionOutcome {
  return {
    outcomeId: `${predictionId}:outcome:1`,
    predictionId,
    knownAt: "2026-07-18T17:00:00.000Z",
    marketTimestamp: "2026-07-18T16:59:00.000Z",
    actualDirection: PredictionDirection.Up,
    actualResult: "Synthetic asset rose.",
    benchmarkResult: "Synthetic benchmark was flat.",
    evidenceReferences: [{ auditId: "audit-outcome-1" }],
  };
}

function reviewStart(predictionId: string, outcomeId: string): PredictionReviewStart {
  return {
    reviewId: `${predictionId}:review:1`,
    predictionId,
    outcomeId,
    startedAt: "2026-07-18T18:00:00.000Z",
    reviewer: "owner-1",
    status: PredictionReviewStatus.Started,
  };
}

function review(start: PredictionReviewStart, overrides: Partial<PredictionReview> = {}): PredictionReview {
  return {
    ...start,
    completedAt: "2026-07-18T19:00:00.000Z",
    status: PredictionReviewStatus.Completed,
    accuracy: PredictionAccuracy.Accurate,
    profitability: PredictionProfitability.Unprofitable,
    result: PredictionReviewResult.Validated,
    score: { directionScore: 100, timingScore: 80, magnitudeScore: 75, catalystScore: 90, overallScore: 86.25 },
    accuracyRationale: "The forecast direction occurred.",
    profitabilityRationale: "No trade was required; synthetic example records an unprofitable linked result independently.",
    lessonReferences: [],
    ...overrides,
  };
}

function setup(snapshotValue = snapshot()): {
  readonly repository: InMemoryPredictionLogRepository;
  readonly clock: FixedClock;
  readonly log: PredictionLog;
  readonly prediction: Prediction;
} {
  const repository = new InMemoryPredictionLogRepository();
  const clock = new FixedClock();
  const log = new PredictionLog(repository, clock);
  return { repository, clock, log, prediction: log.createDraft(snapshotValue) };
}

function lockPrediction(log: PredictionLog, predictionId: string): Prediction {
  log.submit(predictionId, "2026-07-18T15:00:00.000Z", "Ready for owner lock.");
  return log.lock(predictionId, "2026-07-18T16:00:00.000Z", "Forecast frozen before outcome.");
}

function completeLifecycle(log: PredictionLog, predictionId: string): Prediction {
  lockPrediction(log, predictionId);
  const outcomeValue = outcome(predictionId);
  log.recordOutcome(outcomeValue);
  const start = reviewStart(predictionId, outcomeValue.outcomeId);
  log.beginReview(start);
  return log.completeReview(review(start));
}

const tests: ReadonlyArray<TestCase> = [
  {
    name: "deterministic IDs are stable for identical snapshots",
    run: () => assertEqual(createPredictionId(snapshot()), createPredictionId(snapshot()), "deterministic ID"),
  },
  {
    name: "deterministic IDs change when immutable evidence changes",
    run: () => assertTrue(createPredictionId(snapshot()) !== createPredictionId(snapshot({ statement: "A different forecast." })), "identity must include immutable content"),
  },
  {
    name: "draft creation records initial history",
    run: () => {
      const { prediction } = setup();
      assertEqual(prediction.status, PredictionStatus.Draft, "status");
      assertEqual(prediction.history.length, 1, "history length");
      assertEqual(prediction.history[0]?.fromStatus, null, "initial from state");
    },
  },
  {
    name: "duplicate prediction IDs are rejected",
    run: () => {
      const { log } = setup();
      expectError(() => log.createDraft(snapshot()), "DUPLICATE_PREDICTION_ID");
    },
  },
  {
    name: "future prediction timestamps are rejected",
    run: () => {
      const future = snapshot({ createdAt: "2026-07-19T00:00:00.000Z", decisionSnapshot: { ...snapshot().decisionSnapshot, predictionTimestamp: "2026-07-19T00:00:00.000Z" } });
      assertTrue(!validatePredictionSnapshot(future, "2026-07-18T20:00:00.000Z").valid, "future timestamp must fail");
    },
  },
  {
    name: "confidence outside zero to one hundred is rejected",
    run: () => expectError(() => setup(snapshot({ confidence: { value: 101, level: ConfidenceLevel.High, rationale: "Invalid." } })), "confidence.value"),
  },
  {
    name: "missing research evidence references are rejected",
    run: () => expectError(() => setup(snapshot({ evidence: { ...snapshot().evidence, researchReferences: [] } })), "evidence.researchReferences"),
  },
  {
    name: "missing audit evidence references are rejected",
    run: () => expectError(() => setup(snapshot({ evidence: { ...snapshot().evidence, auditReferences: [] } })), "evidence.auditReferences"),
  },
  {
    name: "invalid schema versions are rejected",
    run: () => expectError(() => setup(snapshot({ version: { predictionVersion: "v1", schemaVersion: "2.0" as "1.0" } })), "schemaVersion"),
  },
  {
    name: "legal submit and lock transitions succeed",
    run: () => {
      const { log, prediction } = setup();
      const locked = lockPrediction(log, prediction.predictionId);
      assertEqual(locked.status, PredictionStatus.Locked, "status");
      assertEqual(locked.lockedAt, "2026-07-18T16:00:00.000Z", "locked timestamp");
    },
  },
  {
    name: "locking a draft directly is forbidden",
    run: () => {
      const { log, prediction } = setup();
      expectError(() => log.lock(prediction.predictionId, "2026-07-18T16:00:00.000Z", "Illegal skip."), "ILLEGAL_TRANSITION");
    },
  },
  {
    name: "lifecycle timestamps cannot move backward",
    run: () => {
      const { log, prediction } = setup();
      log.submit(prediction.predictionId, "2026-07-18T15:00:00.000Z", "Submitted.");
      expectError(() => log.lock(prediction.predictionId, "2026-07-18T14:30:00.000Z", "Backward."), "timestamp cannot move backward");
    },
  },
  {
    name: "lifecycle timestamps cannot be in the future",
    run: () => {
      const { log, prediction } = setup();
      expectError(() => log.submit(prediction.predictionId, "2026-07-19T00:00:00.000Z", "Future."), "FUTURE_TIMESTAMP");
    },
  },
  {
    name: "input snapshot mutation cannot change stored prediction",
    run: () => {
      const input = snapshot();
      const { log, prediction } = setup(input);
      (input as { statement: string }).statement = "Mutated after append.";
      assertEqual(log.get(prediction.predictionId)?.statement, "Synthetic Alpha Asset will rise over the next five sessions.", "immutable snapshot");
    },
  },
  {
    name: "returned prediction mutation cannot change repository state",
    run: () => {
      const { log, prediction } = setup();
      (prediction as { statement: string }).statement = "Caller mutation.";
      assertTrue(log.get(prediction.predictionId)?.statement !== "Caller mutation.", "defensive read clone");
    },
  },
  {
    name: "outcome cannot be recorded for an unlocked prediction",
    run: () => {
      const { log, prediction } = setup();
      expectError(() => log.recordOutcome(outcome(prediction.predictionId)), "UNLOCKED_REVIEW");
    },
  },
  {
    name: "outcome evidence cannot precede the lock",
    run: () => {
      const { log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      expectError(() => log.recordOutcome({ ...outcome(prediction.predictionId), marketTimestamp: "2026-07-18T15:59:00.000Z" }), "cannot precede the lock");
    },
  },
  {
    name: "recording outcome advances only to outcome known",
    run: () => {
      const { log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      assertEqual(log.recordOutcome(outcome(prediction.predictionId)).status, PredictionStatus.OutcomeKnown, "status");
    },
  },
  {
    name: "duplicate outcomes are rejected",
    run: () => {
      const { repository, log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      const value = outcome(prediction.predictionId);
      log.recordOutcome(value);
      expectError(() => repository.appendOutcome(value), "DUPLICATE_OUTCOME");
    },
  },
  {
    name: "review cannot begin before outcome",
    run: () => {
      const { log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      expectError(() => log.beginReview(reviewStart(prediction.predictionId, "missing-outcome")), "OUTCOME_MISSING");
    },
  },
  {
    name: "review cannot begin before outcome time",
    run: () => {
      const { log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      const value = outcome(prediction.predictionId);
      log.recordOutcome(value);
      expectError(() => log.beginReview({ ...reviewStart(prediction.predictionId, value.outcomeId), startedAt: "2026-07-18T16:30:00.000Z" }), "cannot start before outcome");
    },
  },
  {
    name: "review completion requires a review start",
    run: () => {
      const { log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      const value = outcome(prediction.predictionId);
      log.recordOutcome(value);
      expectError(() => log.completeReview(review(reviewStart(prediction.predictionId, value.outcomeId))), "REVIEW_NOT_STARTED");
    },
  },
  {
    name: "accuracy and profitability remain independent",
    run: () => {
      const { repository, log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      const value = outcome(prediction.predictionId);
      log.recordOutcome(value);
      const start = reviewStart(prediction.predictionId, value.outcomeId);
      log.beginReview(start);
      log.completeReview(review(start));
      assertEqual(repository.getReview(prediction.predictionId)?.accuracy, PredictionAccuracy.Accurate, "accuracy");
      assertEqual(repository.getReview(prediction.predictionId)?.profitability, PredictionProfitability.Unprofitable, "profitability");
    },
  },
  {
    name: "review scores outside range are rejected",
    run: () => {
      const { log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      const value = outcome(prediction.predictionId);
      log.recordOutcome(value);
      const start = reviewStart(prediction.predictionId, value.outcomeId);
      log.beginReview(start);
      expectError(() => log.completeReview(review(start, { score: { directionScore: 101, timingScore: 80, magnitudeScore: 75, catalystScore: 90, overallScore: 86.25 } })), "directionScore");
    },
  },
  {
    name: "archive before review is forbidden",
    run: () => {
      const { log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      expectError(() => log.archive(prediction.predictionId, "2026-07-18T19:30:00.000Z", "Too early."), "ILLEGAL_TRANSITION");
    },
  },
  {
    name: "completed review can be archived",
    run: () => {
      const { log, prediction } = setup();
      completeLifecycle(log, prediction.predictionId);
      assertEqual(log.archive(prediction.predictionId, "2026-07-18T19:30:00.000Z", "Review complete.").status, PredictionStatus.Archived, "status");
    },
  },
  {
    name: "history remains a contiguous append-only sequence",
    run: () => {
      const { log, prediction } = setup();
      completeLifecycle(log, prediction.predictionId);
      assertDeepEqual(log.history(prediction.predictionId).map((entry) => entry.sequence), [1, 2, 3, 4, 5], "history sequence");
    },
  },
  {
    name: "repository exposes no delete or overwrite operation",
    run: () => {
      const repository: object = new InMemoryPredictionLogRepository();
      assertTrue(!("delete" in repository) && !("update" in repository), "repository must be append-only");
    },
  },
  {
    name: "search filters status, ticker, and research reference",
    run: () => {
      const repository = new InMemoryPredictionLogRepository();
      const log = new PredictionLog(repository, new FixedClock());
      const first = log.createDraft(snapshot());
      log.createDraft(snapshot({ createdAt: "2026-07-18T14:01:00.000Z", statement: "Second forecast.", ticker: "BETA", decisionSnapshot: { ...snapshot().decisionSnapshot, predictionTimestamp: "2026-07-18T14:01:00.000Z" }, evidence: { ...snapshot().evidence, researchReferences: [{ researchId: "research-2" }] } }));
      log.submit(first.predictionId, "2026-07-18T15:00:00.000Z", "Submitted.");
      assertEqual(log.search({ filter: { statuses: [PredictionStatus.Submitted], ticker: "ALPHA", researchId: "research-1" } }).length, 1, "filtered count");
    },
  },
  {
    name: "search pagination is stable",
    run: () => {
      const repository = new InMemoryPredictionLogRepository();
      const log = new PredictionLog(repository, new FixedClock());
      log.createDraft(snapshot());
      const second = log.createDraft(snapshot({ createdAt: "2026-07-18T14:01:00.000Z", statement: "Second forecast.", decisionSnapshot: { ...snapshot().decisionSnapshot, predictionTimestamp: "2026-07-18T14:01:00.000Z" } }));
      assertEqual(log.search({ offset: 1, limit: 1 })[0]?.predictionId, second.predictionId, "paged identity");
    },
  },
  {
    name: "statistics separate accuracy rate from profitability rate",
    run: () => {
      const { log, prediction } = setup();
      completeLifecycle(log, prediction.predictionId);
      const metrics = log.statistics().metrics;
      assertEqual(metrics.accuracyRate, 1, "accuracy rate");
      assertEqual(metrics.profitabilityRate, 0, "profitability rate");
      assertEqual(metrics.averageScore, 86.25, "average score");
    },
  },
  {
    name: "statistics respect filters",
    run: () => {
      const { log } = setup();
      assertEqual(log.statistics({ ticker: "MISSING" }).metrics.total, 0, "filtered total");
      assertEqual(log.statistics({ ticker: "ALPHA" }).metrics.total, 1, "matching total");
    },
  },
  {
    name: "summary translation preserves lifecycle meaning",
    run: () => {
      const { log, prediction } = setup();
      completeLifecycle(log, prediction.predictionId);
      const translated = translatePrediction(log.get(prediction.predictionId) as Prediction, "2026-07-18T20:00:00.000Z");
      assertTrue(translated.summary.outcomeKnown && translated.summary.reviewed, "translation flags");
      assertEqual(summarizePrediction(log.get(prediction.predictionId) as Prediction).confidence, 80, "confidence");
    },
  },
  {
    name: "JSON export includes immutable prediction evidence",
    run: () => {
      const { log, prediction } = setup();
      const result = exportPredictions([prediction], PredictionExportFormat.Json, "2026-07-18T20:00:00.000Z");
      assertEqual(result.recordCount, 1, "record count");
      assertTrue(result.content.includes("research-1"), "research evidence");
    },
  },
  {
    name: "NDJSON export is newline terminated",
    run: () => {
      const { prediction } = setup();
      const result = exportPredictions([prediction], PredictionExportFormat.Ndjson, "2026-07-18T20:00:00.000Z");
      assertTrue(result.content.endsWith("\n") && result.content.trim().split("\n").length === 1, "NDJSON framing");
    },
  },
  {
    name: "CSV export escapes prediction statements",
    run: () => {
      const { prediction } = setup(snapshot({ statement: "Rise, then \"hold\"." }));
      const result = exportPredictions([prediction], PredictionExportFormat.Csv, "2026-07-18T20:00:00.000Z");
      assertTrue(result.content.includes('"Rise, then ""hold""."'), "CSV escaping");
    },
  },
  {
    name: "local NDJSON repository reloads complete history and reviews",
    run: () => {
      const directory = mkdtempSync(join(tmpdir(), "alpha-prediction-log-"));
      try {
        const path = join(directory, "prediction-log.ndjson");
        const repository = new LocalNdjsonPredictionLogRepository(path);
        const log = new PredictionLog(repository, new FixedClock());
        const prediction = log.createDraft(snapshot());
        completeLifecycle(log, prediction.predictionId);
        const reloaded = new LocalNdjsonPredictionLogRepository(path);
        assertEqual(reloaded.getById(prediction.predictionId)?.status, PredictionStatus.Reviewed, "reloaded status");
        assertEqual(reloaded.getReview(prediction.predictionId)?.accuracy, PredictionAccuracy.Accurate, "reloaded review");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  },
  {
    name: "local repository rejects truncated data",
    run: () => {
      const directory = mkdtempSync(join(tmpdir(), "alpha-prediction-corrupt-"));
      try {
        const path = join(directory, "prediction-log.ndjson");
        writeFileSync(path, '{"schemaVersion":"1.0"}');
        expectError(() => new LocalNdjsonPredictionLogRepository(path), "truncated final record");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  },
  {
    name: "review records are defensively cloned",
    run: () => {
      const { repository, log, prediction } = setup();
      lockPrediction(log, prediction.predictionId);
      const value = outcome(prediction.predictionId);
      log.recordOutcome(value);
      const start = reviewStart(prediction.predictionId, value.outcomeId);
      log.beginReview(start);
      const completed = review(start);
      log.completeReview(completed);
      (completed as { accuracyRationale: string }).accuracyRationale = "Caller mutation.";
      assertTrue(repository.getReview(prediction.predictionId)?.accuracyRationale !== "Caller mutation.", "review clone");
    },
  },
  {
    name: "decision snapshot survives the full lifecycle unchanged",
    run: () => {
      const { log, prediction } = setup();
      const before = JSON.stringify(prediction.decisionSnapshot);
      completeLifecycle(log, prediction.predictionId);
      assertEqual(JSON.stringify(log.get(prediction.predictionId)?.decisionSnapshot), before, "decision snapshot");
    },
  },
];

let passed = 0;
for (const test of tests) {
  try {
    test.run();
    passed += 1;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL: ${test.name}: ${message}`);
    throw error;
  }
}

console.log(`Prediction Log: ${String(passed)}/${String(tests.length)} tests passed.`);
