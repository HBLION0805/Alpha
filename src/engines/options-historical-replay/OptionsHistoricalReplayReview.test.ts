import { equal, harness, throws, truth } from "../options-market-context/testing/OptionsContextTestSupport";
import { historicalReplayFixture, fixtureHistoricalReplayCases } from "./OptionsHistoricalReplayFixtures";
import { buildHistoricalReplayReport, createHistoricalReplayRun } from "./OptionsHistoricalReplayReview";

const h = harness("Historical replay research review");
const cases = fixtureHistoricalReplayCases();
const runs = () => cases.map((item) => createHistoricalReplayRun(item.config, item.evidence, item.recordedAt));
h.test("every state has a process review without inventing closed trades", () => {
  const report = buildHistoricalReplayReport(runs());
  equal(report.runCount, 7); equal(report.closedTradeCount, 4);
  for (const run of report.runs) {
    equal(run.review.status, run.result.status);
    equal(run.review.closedTradeReview !== null, run.result.status === "CLOSED");
    equal(run.review.winProbability, null); equal(run.review.executionAllowed, false);
  }
});
h.test("normal profitable exit does not invent a mistake or market cause", () => {
  const run = runs()[0]!;
  equal(run.review.closedTradeReview!.outcome, "WIN"); equal(run.review.candidateLessons.length, 0);
  truth(run.review.hypotheses[0]!.includes("not established"));
});
h.test("normal planned loss is reviewed without automatically calling it a mistake", () => {
  const item = historicalReplayFixture("normal-loss", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:02:00", bid: "0.16", ask: "0.17" },
    { quote_datetime: "2026-09-04 10:03:00", bid: "0.16", ask: "0.17" }]);
  const run = createHistoricalReplayRun(item.config, item.evidence, item.recordedAt);
  equal(run.review.closedTradeReview!.outcome, "LOSS"); equal(run.review.candidateLessons.length, 0);
});
h.test("gap loss beyond R produces execution-risk candidates with no approved knowledge", () => {
  const run = runs()[1]!;
  truth(run.review.candidateLessons.some((lesson) => lesson.code === "LOSS_EXCEEDED_PLANNED_R"));
  truth(run.review.candidateLessons.some((lesson) => lesson.code === "QUOTE_GAP_OBSERVED"));
  for (const lesson of run.review.candidateLessons) equal(lesson.approvedKnowledge, false);
});
h.test("target reversal records that a trigger does not secure the planned profit", () => {
  const run = runs()[2]!;
  equal(run.result.exitReason, "TARGET"); truth(run.result.netPnlCents! < 0);
  truth(run.review.candidateLessons.some((lesson) => lesson.code === "TARGET_TRIGGER_NOT_GUARANTEED_PROFIT"));
});
h.test("unresolved position stays unresolved in its review and notebook", () => {
  const run = runs()[3]!;
  equal(run.result.status, "EXIT_PENDING"); equal(run.result.netPnlCents, null);
  equal(run.review.closedTradeReview, null);
  truth(run.review.candidateLessons.some((lesson) => lesson.code === "INCOMPLETE_QUOTE_PATH"));
});
h.test("missing data records the actual obstruction and no trading outcome", () => {
  const run = runs()[5]!;
  equal(run.review.origin, "MISSING_DATA"); equal(run.review.closedTradeReview, null);
  truth(run.review.candidateLessons.some((lesson) => lesson.code === "DATASET_MISSING"));
});
h.test("unresolved runs retain observed gap and delayed-liquidity lessons", () => {
  const item = historicalReplayFixture("unresolved-limitations", [{}, { quote_datetime: "2026-09-04 10:01:00" },
    { quote_datetime: "2026-09-04 10:05:00", bid: "0.16", ask: "0.17" },
    { quote_datetime: "2026-09-04 10:06:00", bid: "0.15", ask: "0.17", bid_size: "0" }]);
  const run = createHistoricalReplayRun(item.config, item.evidence, item.recordedAt);
  equal(run.result.status, "EXIT_PENDING"); truth(run.result.quoteGapObserved); truth(run.result.exitLiquidityDelayed);
  for (const code of ["QUOTE_GAP_OBSERVED", "EXIT_LIQUIDITY_DELAYED", "INCOMPLETE_QUOTE_PATH"]) {
    equal(run.review.candidateLessons.filter((lesson) => lesson.code === code).length, 1);
  }
});
h.test("owner-file mapping preserves original source outside the reused legacy review", () => {
  const item = historicalReplayFixture("owner-mapping");
  const evidence = { ...item.evidence!, metadata: { ...item.evidence!.metadata, origin: "OWNER_PROVIDED_FILE" as const, usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" as const } };
  const run = createHistoricalReplayRun(item.config, evidence, item.recordedAt);
  equal(run.review.origin, "OWNER_PROVIDED_FILE"); equal(run.evidence!.metadata.origin, "OWNER_PROVIDED_FILE");
  equal(run.review.closedTradeReview!.input.origin, "UNVERIFIED_IMPORT");
  equal(run.result.marketValidated, false); equal(run.result.importedAt, evidence.importedAt);
});
h.test("independent runs do not report aggregate account growth or a win rate", () => {
  const report = buildHistoricalReplayReport(runs());
  equal(report.accountAggregation, "INDEPENDENT_1000_USD_RUNS_NO_SHARED_COMPOUNDING");
  equal(report.marketValidated, false); equal(report.winProbability, null);
  equal(report.sourceCounts.OWNER_PROVIDED_FILE, 0); equal(report.sourceCounts.MISSING_DATA, 1);
});
h.test("prior lessons use the real research order and retain distinct supporting run IDs", () => {
  const first = runs()[1]!;
  const second = createHistoricalReplayRun({ ...first.config, runId: "another-gap" }, first.evidence, "2026-09-05T23:00:00.000Z");
  const report = buildHistoricalReplayReport([first, second]);
  equal(report.runs[0]!.priorResearchLessonIds.length, 0); truth(report.runs[1]!.priorResearchLessonIds.length > 0);
  const lesson = report.mistakeNotebook.entries.find((item) => item.code === "LOSS_EXCEEDED_PLANNED_R")!;
  equal(lesson.occurrenceCount, 2); equal(lesson.supportingRunIds, [first.config.runId, "another-gap"]);
  equal(lesson.firstRecordedAt, first.recordedAt); equal(lesson.lastRecordedAt, second.recordedAt);
});
h.test("synthetic lessons cannot silently become owner-file lessons", () => {
  const first = runs()[1]!;
  const evidence = { ...first.evidence!, metadata: { ...first.evidence!.metadata, origin: "OWNER_PROVIDED_FILE" as const, usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" as const } };
  const second = createHistoricalReplayRun({ ...first.config, runId: "owner-gap" }, evidence, "2026-09-05T23:00:00.000Z");
  const report = buildHistoricalReplayReport([first, second]);
  equal(report.runs[1]!.priorResearchLessonIds.length, 0);
  equal(report.mistakeNotebook.entries.filter((item) => item.code === "LOSS_EXCEEDED_PLANNED_R").length, 2);
});
h.test("report rejects rewritten results and duplicate run identities", () => {
  const run = runs()[0]!;
  throws(() => buildHistoricalReplayReport([{ ...run, result: { ...run.result, netPnlCents: 100000 } }]), "HISTORICAL_RUN_REPLAY_MISMATCH");
  throws(() => buildHistoricalReplayReport([run, run]), "HISTORICAL_DUPLICATE_REPORT_RUN");
});
h.test("report rejects later knowledge supplied before an earlier research run", () => {
  const first = runs()[0]!;
  const later = createHistoricalReplayRun({ ...first.config, runId: "later-clock" }, first.evidence, "2026-09-05T23:00:00.000Z");
  throws(() => buildHistoricalReplayReport([later, first]), "HISTORICAL_RUN_CLOCK_REGRESSION");
});
h.test("composition freezes independent copies rather than caller-owned source objects", () => {
  const item = historicalReplayFixture();
  const original = JSON.parse(JSON.stringify(item.evidence));
  const run = createHistoricalReplayRun(item.config, original, item.recordedAt);
  truth(!Object.isFrozen(original)); original.rows[0].bidCents = 1;
  equal(run.evidence!.rows[0]!.bidCents, 19); truth(Object.isFrozen(run.review.candidateLessons));
});
h.finish();
