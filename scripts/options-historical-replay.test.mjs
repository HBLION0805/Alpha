import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs, { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";
import { withOptionsMarketEvidenceRepository } from "../src/repositories/LocalOptionsMarketEvidenceRepository.ts";
import { marketEvidenceFingerprint } from "../src/engines/options-market-evidence/OptionsMarketEvidenceEngine.ts";
import { fixtureHistoricalReplayCases } from "../src/engines/options-historical-replay/OptionsHistoricalReplayFixtures.ts";
import { runOptionsHistoricalReplayCommand } from "./options-historical-replay.mjs";

const root = process.cwd();
const cli = resolve(root, "scripts/options-historical-replay.mjs");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
const journal = (directory) => join(directory, "data/runtime/options-historical-replay/runs.ndjson");
const marketJournal = (directory) => join(directory, "data/runtime/options-market-evidence/imports.ndjson");
const paperJournal = (directory) => join(directory, "data/runtime/options-paper/sessions.ndjson");
const lock = (directory) => join(directory, "data/runtime/options-historical-replay/writer.lock");
const hash = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const seed = () => structuredClone(fixtureHistoricalReplayCases()[0]);
const later = (at) => new Date(Date.parse(at) + 3_600_000).toISOString();
const runCli = (directory, args) => spawnSync(process.execPath, [tsx, cli, ...args], { cwd: directory, encoding: "utf8" });
const json = (result) => { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
const append = (directory, input) => withOptionsHistoricalReplayRepository(directory, (repository) => repository.append(input.config, input.evidence, input.recordedAt));
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function temp(run) {
  const allowed = realpathSync(tmpdir());
  const directory = mkdtempSync(join(allowed, "alpha-historical-replay-test-"));
  try { run(directory); } finally {
    const target = realpathSync(directory);
    assert.ok(target.startsWith(allowed + sep) && target.includes("alpha-historical-replay-test-"));
    rmSync(target, { recursive: true, force: true });
  }
}
function inputFile(directory, config) {
  const path = join(directory, "research-config.json"); writeFileSync(path, JSON.stringify(config), "utf8");
  return ["--input", path];
}
function assertResearchOnly(report) {
  assert.equal(report.executionAllowed, false); assert.equal(report.marketValidated, false); assert.equal(report.winProbability, null);
}

test("help identifies research commands without creating a journal", () => temp((directory) => {
  const help = json(runCli(directory, ["--help"]));
  assert.equal(help.executionAllowed, false); assert.match(JSON.stringify(help), /--record-demo/);
  assert.equal(existsSync(journal(directory)), false);
}));
test("isolated demo records no files and leaves prior paper and market journals untouched", () => temp((directory) => {
  mkdirSync(join(directory, "data/runtime/options-paper"), { recursive: true });
  mkdirSync(join(directory, "data/runtime/options-market-evidence"), { recursive: true });
  writeFileSync(paperJournal(directory), "paper-sentinel\n"); writeFileSync(marketJournal(directory), "market-sentinel\n");
  const paperBefore = hash(paperJournal(directory)), marketBefore = hash(marketJournal(directory));
  const report = json(runCli(directory, ["--demo"]));
  assertResearchOnly(report); assert.equal(report.runCount, fixtureHistoricalReplayCases().length);
  assert.ok(report.closedTradeCount > 0); assert.equal(report.sourceCounts.OWNER_PROVIDED_FILE, 0);
  assert.ok(report.sourceCounts.SYNTHETIC_FIXTURE > 0); assert.ok(report.sourceCounts.MISSING_DATA > 0);
  assert.ok(report.runs.every((run) => run.review));
  assert.equal(report.accountAggregation, "INDEPENDENT_1000_USD_RUNS_NO_SHARED_COMPOUNDING");
  assert.equal(report.mistakeNotebook.approvedKnowledge, false); assert.equal(report.mistakeNotebook.automaticStrategyChanges, false);
  assert.equal(existsSync(journal(directory)), false);
  assert.equal(hash(paperJournal(directory)), paperBefore); assert.equal(hash(marketJournal(directory)), marketBefore);
}));
test("saved demo and fresh report reproduce all results and reviews exactly", () => temp((directory) => {
  const first = json(runCli(directory, ["--record-demo"]));
  assert.equal(first.runsAppended, fixtureHistoricalReplayCases().length);
  assertResearchOnly(first); assert.equal(first.runCount, fixtureHistoricalReplayCases().length);
  const before = hash(journal(directory));
  const second = json(runCli(directory, ["--record-demo"]));
  assert.equal(second.runsAppended, 0); assert.equal(hash(journal(directory)), before);
  const report = json(runCli(directory, ["--report"]));
  assert.deepEqual(report.runs, first.runs); assert.deepEqual(report.mistakeNotebook, first.mistakeNotebook);
  assert.equal(report.closedTradeCount, first.closedTradeCount);
  assert.equal(existsSync(paperJournal(directory)), false); assert.equal(existsSync(marketJournal(directory)), false);
}));
test("empty report does not invent a trade, account result or source dataset", () => temp((directory) => {
  const report = json(runCli(directory, ["--report"]));
  assertResearchOnly(report); assert.equal(report.runCount, 0); assert.equal(report.closedTradeCount, 0);
  assert.deepEqual(report.sourceCounts, { SYNTHETIC_FIXTURE: 0, OWNER_PROVIDED_FILE: 0, MISSING_DATA: 0 });
  assert.equal(existsSync(journal(directory)), false);
}));
test("repository restart preserves full evidence, frozen inputs and separate source clocks", () => temp((directory) => {
  const input = seed(); const first = append(directory, input);
  assert.equal(first.changed, true); assertResearchOnly(first.report);
  const before = hash(journal(directory));
  const run = withOptionsHistoricalReplayRepository(directory, (repository) => repository.readRun(input.config.runId));
  assert.deepEqual(run.config, input.config); assert.deepEqual(run.evidence, input.evidence);
  assert.equal(run.recordedAt, input.recordedAt); assert.equal(run.result.importedAt, input.evidence.importedAt);
  assert.equal(run.result.sourceFileSha256, input.evidence.sourceFileSha256);
  assert.equal(run.result.researchMode, "COUNTERFACTUAL_SNAPSHOT_TIME");
  assert.equal(run.result.selectionStatus, "RETROSPECTIVE_DECLARATION");
  assert.equal(run.result.exitModel, "NEXT_SNAPSHOT_MARKET_EXIT");
  assert.deepEqual(withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), first.report);
  assert.equal(hash(journal(directory)), before);
}));
test("same research payload is idempotent and retains the first recorded clock", () => temp((directory) => {
  const input = seed(); append(directory, input); const before = hash(journal(directory));
  const repeated = append(directory, { ...input, recordedAt: later(input.recordedAt) });
  assert.equal(repeated.changed, false); assert.equal(repeated.report.runCount, 1);
  assert.equal(repeated.report.runs[0].recordedAt, input.recordedAt); assert.equal(hash(journal(directory)), before);
}));
test("new research runs cannot move the saved recording clock backwards", () => temp((directory) => {
  const input = seed(); append(directory, { ...input, recordedAt: later(input.recordedAt) });
  const before = hash(journal(directory));
  const earlier = { ...input, config: { ...input.config, runId: "io-backward-clock" } };
  assert.throws(() => append(directory, earlier), /HISTORICAL_RUN_CLOCK_REGRESSION/);
  assert.equal(hash(journal(directory)), before);
}));
test("a research run cannot use evidence that had not yet been imported", () => temp((directory) => {
  const input = seed(); input.recordedAt = new Date(Date.parse(input.evidence.importedAt) - 1).toISOString();
  assert.throws(() => append(directory, input), /IMPORTED|IMPORT|CLOCK|RECORDED_AT/);
  assert.equal(existsSync(journal(directory)), false);
}));
test("changed frozen plan or evidence cannot replace an accepted run identifier", () => temp((directory) => {
  const input = seed(); append(directory, input); const before = hash(journal(directory));
  const changedPlan = structuredClone(input); changedPlan.config.plan.thesis.path += " Revised after observation.";
  const changedEvidence = structuredClone(input); changedEvidence.evidence.sourceFileSha256 = "sha256:" + "a".repeat(64);
  for (const changed of [changedPlan, changedEvidence]) {
    assert.throws(() => append(directory, changed), /(?:HISTORICAL|REPLAY)_.*CONFLICT/);
    assert.equal(hash(journal(directory)), before);
  }
}));
test("new run identifiers retain changed assumptions as separate research records", () => temp((directory) => {
  const input = seed(); append(directory, input);
  const next = structuredClone(input); next.config.runId = "io-corrected-research-run";
  next.config.plan.thesis.path += " Alternative retrospective hypothesis."; next.recordedAt = later(input.recordedAt);
  const result = append(directory, next);
  assert.equal(result.changed, true); assert.equal(result.report.runCount, 2);
  assert.deepEqual(result.report.runs[0].config, input.config); assertResearchOnly(result.report);
}));
test("candidate lessons use actual research-recording clocks and never historical exit clocks", () => temp((directory) => {
  const gapCase = structuredClone(fixtureHistoricalReplayCases()[1]); append(directory, gapCase);
  const repeat = structuredClone(gapCase); repeat.config.runId = "io-later-gap-research"; repeat.recordedAt = later(gapCase.recordedAt);
  const report = append(directory, repeat).report;
  assert.ok(report.mistakeNotebook.entries.length > 0); assert.deepEqual(report.runs[0].priorResearchLessonIds, []);
  assert.ok(report.runs[1].priorResearchLessonIds.length > 0);
  for (const entry of report.mistakeNotebook.entries) {
    assert.equal(entry.firstRecordedAt, gapCase.recordedAt); assert.equal(entry.lastRecordedAt, repeat.recordedAt);
    assert.equal(entry.approvedKnowledge, false); assert.equal(entry.occurrenceCount, 2);
    assert.deepEqual(entry.supportingRunIds, [gapCase.config.runId, repeat.config.runId]);
  }
}));
test("incomplete exits survive restart without a fabricated closing trade", () => temp((directory) => {
  const pending = structuredClone(fixtureHistoricalReplayCases()[3]);
  const first = append(directory, pending); const before = hash(journal(directory));
  assert.equal(first.report.runs[0].result.status, "EXIT_PENDING"); assert.equal(first.report.closedTradeCount, 0);
  const report = json(runCli(directory, ["--report"]));
  assert.deepEqual(report.runs, first.report.runs); assert.equal(report.closedTradeCount, 0);
  assert.equal(hash(journal(directory)), before);
}));
test("a missing dataset produces a persisted blocked attempt with a process review", () => temp((directory) => {
  const input = seed(); const result = json(runCli(directory, inputFile(directory, input.config)));
  assert.equal(result.changed, true); assertResearchOnly(result.report);
  assert.equal(result.report.runCount, 1); assert.equal(result.report.closedTradeCount, 0);
  assert.equal(result.report.sourceCounts.MISSING_DATA, 1); assert.equal(result.report.runs[0].evidence, null);
  assert.equal(result.report.runs[0].result.status, "BLOCKED"); assert.ok(result.report.runs[0].review);
  assert.equal(existsSync(marketJournal(directory)), false); assert.equal(existsSync(paperJournal(directory)), false);
  assert.deepEqual(json(runCli(directory, ["--report"])).runs, result.report.runs);
}));
test("a failed missing-data attempt cannot be overwritten after its evidence arrives", () => temp((directory) => {
  const input = seed(); const args = inputFile(directory, input.config);
  json(runCli(directory, args)); const before = hash(journal(directory));
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(input.evidence));
  const marketBefore = hash(marketJournal(directory));
  assert.equal(runCli(directory, args).status, 2); assert.equal(hash(journal(directory)), before);
  assert.equal(hash(marketJournal(directory)), marketBefore);
  const newConfig = { ...input.config, runId: "io-after-data-arrived" };
  const next = json(runCli(directory, inputFile(directory, newConfig)));
  assert.equal(next.changed, true); assert.equal(next.report.runCount, 2);
  assert.equal(next.report.runs[0].result.status, "BLOCKED"); assert.equal(next.report.sourceCounts.MISSING_DATA, 1);
  assert.equal(hash(marketJournal(directory)), marketBefore);
}));
test("owner-file research retains original provenance and cannot modify source or paper journals", () => temp((directory) => {
  const input = seed();
  input.evidence.metadata.origin = "OWNER_PROVIDED_FILE"; input.evidence.metadata.usageDeclaration = "OWNER_ATTESTED_LOCAL_USE";
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(input.evidence));
  mkdirSync(join(directory, "data/runtime/options-paper"), { recursive: true }); writeFileSync(paperJournal(directory), "prior-paper\n");
  const marketBefore = hash(marketJournal(directory)), paperBefore = hash(paperJournal(directory));
  const beforeClock = Date.now(); const result = json(runCli(directory, inputFile(directory, input.config))); const afterClock = Date.now();
  assert.equal(result.changed, true); assertResearchOnly(result.report); assert.equal(result.report.sourceCounts.OWNER_PROVIDED_FILE, 1);
  const run = result.report.runs[0];
  assert.equal(run.evidence.metadata.origin, "OWNER_PROVIDED_FILE"); assert.equal(run.evidence.importedAt, input.evidence.importedAt);
  assert.equal(run.evidence.sourceFileSha256, input.evidence.sourceFileSha256);
  assert.equal(run.result.origin, "OWNER_PROVIDED_FILE"); assert.equal(run.result.status, "CLOSED");
  assert.equal(run.review.closedTradeReview.input.origin, "UNVERIFIED_IMPORT");
  assert.ok(Date.parse(run.recordedAt) >= beforeClock && Date.parse(run.recordedAt) <= afterClock);
  assert.equal(hash(marketJournal(directory)), marketBefore); assert.equal(hash(paperJournal(directory)), paperBefore);
}));
test("research results remain self-contained if the imported source journal later becomes unavailable", () => temp((directory) => {
  const input = seed(); withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(input.evidence));
  const first = json(runCli(directory, inputFile(directory, input.config))); const before = hash(journal(directory));
  appendFileSync(marketJournal(directory), '{"broken":');
  const report = json(runCli(directory, ["--report"]));
  assert.deepEqual(report.runs, first.report.runs); assert.equal(hash(journal(directory)), before);
}));
test("corrupt source history blocks new research input instead of pretending data is missing", () => temp((directory) => {
  const input = seed(); withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(input.evidence));
  appendFileSync(marketJournal(directory), '{"broken":'); const before = hash(marketJournal(directory));
  assert.equal(runCli(directory, inputFile(directory, input.config)).status, 2);
  assert.equal(existsSync(journal(directory)), false); assert.equal(hash(marketJournal(directory)), before);
}));
test("config cannot inject research time, capital, results or live authority", () => temp((directory) => {
  const input = seed(); append(directory, input); const before = hash(journal(directory));
  for (const extra of [{ recordedAt: input.recordedAt }, { initialEquityCents: 1_000_000 }, { winProbability: 0.9 }, { executionAllowed: true }, { result: { status: "CLOSED" } }]) {
    const args = inputFile(directory, { ...input.config, runId: "io-invalid-injection", ...extra });
    assert.equal(runCli(directory, args).status, 2); assert.equal(hash(journal(directory)), before);
  }
}));
test("CLI assigns the injected test clock through composition rather than configuration", () => temp((directory) => {
  const input = seed(); const result = runOptionsHistoricalReplayCommand(inputFile(directory, input.config), { workspaceRoot: directory, now: () => input.recordedAt });
  assert.equal(result.changed, true); assert.equal(result.report.runs[0].recordedAt, input.recordedAt);
  assert.equal(result.report.runs[0].result.status, "BLOCKED");
}));
test("malformed, oversized and non-file research configurations cannot create history", () => temp((directory) => {
  const args = inputFile(directory, seed().config);
  for (const text of ["{invalid", "x".repeat(1024 * 1024 + 1)]) {
    writeFileSync(args[1], text); assert.equal(runCli(directory, args).status, 2);
    assert.equal(existsSync(journal(directory)), false);
  }
  assert.equal(runCli(directory, ["--input", directory]).status, 2);
  assert.equal(runCli(directory, ["--input", join(directory, "missing.json")]).status, 2);
}));
test("unsupported order, network and ambiguous CLI flags are rejected", () => temp((directory) => {
  for (const args of [[], ["--live"], ["--order"], ["--refresh"], ["--demo", "--record-demo"], ["--input"], ["--input", "--live"], ["--report", "--input", "a.json"], ["--help", "--live"]]) {
    const result = runCli(directory, args); assert.equal(result.status, 2, JSON.stringify(args));
    assert.equal(JSON.parse(result.stderr).executionAllowed, false);
  }
  assert.equal(existsSync(journal(directory)), false);
}));
test("truncated research journal blocks recovery without changing saved bytes", () => temp((directory) => {
  append(directory, seed()); appendFileSync(journal(directory), '{"partial":'); const before = hash(journal(directory));
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*TRUNCATED|TRUNCATED_.*REPLAY/);
  assert.equal(hash(journal(directory)), before); assert.equal(existsSync(lock(directory)), false);
}));
test("unhashed changes to persisted frozen configuration fail envelope integrity", () => temp((directory) => {
  append(directory, seed()); const batch = JSON.parse(readFileSync(journal(directory), "utf8"));
  batch.run.config.plan.thesis.path += " Tampered.";
  writeFileSync(journal(directory), JSON.stringify(batch) + "\n");
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*INTEGRITY/);
}));
test("fully rehashed invented results fail deterministic simulation replay", () => temp((directory) => {
  append(directory, seed()); const batch = JSON.parse(readFileSync(journal(directory), "utf8"));
  batch.run.result.executionAllowed = true; batch.resultFingerprint = marketEvidenceFingerprint(batch.run.result);
  const { fingerprint, ...body } = batch;
  writeFileSync(journal(directory), JSON.stringify({ ...body, fingerprint: marketEvidenceFingerprint(body) }) + "\n");
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*MISMATCH/);
}));
test("fully rehashed invented review authority fails deterministic review replay", () => temp((directory) => {
  append(directory, seed()); const batch = JSON.parse(readFileSync(journal(directory), "utf8"));
  batch.run.review.executionAllowed = true; batch.reviewFingerprint = marketEvidenceFingerprint(batch.run.review);
  const { fingerprint, ...body } = batch;
  writeFileSync(journal(directory), JSON.stringify({ ...body, fingerprint: marketEvidenceFingerprint(body) }) + "\n");
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*MISMATCH/);
}));
test("omitted first batch and rehashed wrong parent cannot reconstruct a different history", () => temp((directory) => {
  const input = seed(); append(directory, input);
  append(directory, { ...input, config: { ...input.config, runId: "io-second-run" }, recordedAt: later(input.recordedAt) });
  const lines = readFileSync(journal(directory), "utf8").trimEnd().split("\n");
  writeFileSync(journal(directory), lines[1] + "\n");
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*INTEGRITY/);
  const second = JSON.parse(lines[1]); second.previousFingerprint = "sha256:" + "0".repeat(64);
  const { fingerprint, ...body } = second;
  writeFileSync(journal(directory), lines[0] + "\n" + JSON.stringify({ ...body, fingerprint: marketEvidenceFingerprint(body) }) + "\n");
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*INTEGRITY/);
}));
test("oversized journals and more than one thousand batches reject before unbounded parsing", () => temp((directory) => {
  withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport());
  writeFileSync(journal(directory), "x".repeat(16 * 1024 * 1024 + 1));
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*OVERSIZED|OVERSIZED_.*REPLAY/);
  writeFileSync(journal(directory), "{}\n".repeat(1001)); const before = hash(journal(directory));
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*BATCH_LIMIT/);
  assert.equal(hash(journal(directory)), before);
}));
test("existing research writer locks cannot be bypassed or removed", () => temp((directory) => {
  withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()); writeFileSync(lock(directory), "owned-by-another-writer");
  assert.throws(() => append(directory, seed()), /EEXIST/);
  assert.equal(readFileSync(lock(directory), "utf8"), "owned-by-another-writer");
}));
test("repository handles become unusable after their synchronous scope closes", () => temp((directory) => {
  const escaped = withOptionsHistoricalReplayRepository(directory, (repository) => repository);
  const input = seed();
  assert.throws(() => escaped.readReport(), /(?:HISTORICAL|REPLAY)_.*SCOPE_CLOSED/);
  assert.throws(() => escaped.readRun(input.config.runId), /(?:HISTORICAL|REPLAY)_.*SCOPE_CLOSED/);
  assert.throws(() => escaped.append(input.config, input.evidence, input.recordedAt), /(?:HISTORICAL|REPLAY)_.*SCOPE_CLOSED/);
  assert.equal(existsSync(journal(directory)), false);
}));
test("thenable and thrown callbacks release owned locks for checked recovery", () => temp((directory) => {
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, () => ({ then: () => {} })), /SYNCHRONOUS_CALLBACK/);
  assert.equal(existsSync(lock(directory)), false);
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, () => { throw new Error("TEST_CALLBACK_ERROR"); }), /TEST_CALLBACK_ERROR/);
  assert.equal(existsSync(lock(directory)), false); assert.equal(append(directory, seed()).changed, true);
}));
test("an uncertain fsync forbids caught retry until the complete run is recovered", () => temp((directory) => {
  const input = seed(); const original = fs.fsyncSync;
  try {
    fs.fsyncSync = () => { throw new Error("TEST_RESEARCH_FSYNC_FAILURE"); }; syncBuiltinESMExports();
    withOptionsHistoricalReplayRepository(directory, (repository) => {
      assert.throws(() => repository.append(input.config, input.evidence, input.recordedAt), /TEST_RESEARCH_FSYNC_FAILURE/);
      assert.throws(() => repository.append(input.config, input.evidence, input.recordedAt), /(?:HISTORICAL|REPLAY)_.*WRITE_UNCERTAIN/);
      assert.throws(() => repository.readReport(), /(?:HISTORICAL|REPLAY)_.*WRITE_UNCERTAIN/);
      assert.throws(() => repository.readRun(input.config.runId), /(?:HISTORICAL|REPLAY)_.*WRITE_UNCERTAIN/);
    });
  } finally { fs.fsyncSync = original; syncBuiltinESMExports(); }
  assert.equal(existsSync(lock(directory)), false); const before = hash(journal(directory));
  const recovered = append(directory, input); assert.equal(recovered.changed, false); assert.equal(recovered.report.runCount, 1);
  assert.equal(hash(journal(directory)), before);
}));
test("non-directory research storage paths preserve existing user content", () => temp((directory) => {
  const dataPath = join(directory, "data"); writeFileSync(dataPath, "keep-existing-file");
  assert.throws(() => withOptionsHistoricalReplayRepository(directory, (repository) => repository.readReport()), /(?:HISTORICAL|REPLAY)_.*DIRECTORY|UNSAFE_.*REPLAY/);
  assert.equal(readFileSync(dataPath, "utf8"), "keep-existing-file");
}));

console.log(`Options historical replay repository and CLI: ${passed}/${passed} passed.`);
