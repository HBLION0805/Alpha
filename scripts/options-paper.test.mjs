import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, realpathSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, sep, join } from "node:path";
import { spawnSync } from "node:child_process";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { optionsPaperDemoScenarios, paperFixture } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { paperFingerprint } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";

const root = process.cwd();
const cli = resolve(root, "scripts/options-paper.mjs");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function temp(run) {
  const allowed = realpathSync(tmpdir());
  const directory = mkdtempSync(join(allowed, "alpha-paper-test-"));
  try { run(directory); } finally {
    const target = realpathSync(directory);
    assert.ok(target.startsWith(allowed + sep) && target.includes("alpha-paper-test-"));
    rmSync(target, { recursive: true, force: true });
  }
}
const journal = (directory) => join(directory, "data/runtime/options-paper/sessions.ndjson");
const runCli = (directory, args) => spawnSync(process.execPath, [tsx, cli, ...args], { cwd: directory, encoding: "utf8" });
function json(result) { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }
const fileHash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

test("local demo runs without writing a journal or claiming market performance", () => temp((directory) => {
  const report = json(runCli(directory, ["--demo"]));
  assert.equal(report.account.equityCents, 99000);
  assert.equal(report.reviews.length, 5);
  assert.equal(report.marketValidated, false); assert.equal(report.executionAllowed, false);
  assert.equal(report.probability, null); assert.equal(existsSync(journal(directory)), false);
}));
test("persistent demo and restart report reconcile exactly, with no duplicate second run", () => temp((directory) => {
  const first = json(runCli(directory, ["--record-demo"]));
  assert.equal(first.batchesAppended, 8);
  const before = fileHash(journal(directory));
  const second = json(runCli(directory, ["--record-demo"]));
  assert.equal(second.batchesAppended, 0);
  assert.equal(fileHash(journal(directory)), before);
  const report = json(runCli(directory, ["--report"]));
  assert.deepEqual(report.account, first.account);
  assert.deepEqual(report.mistakeNotebook, first.mistakeNotebook);
  assert.equal(report.trades.length, 7);
  assert.equal(report.trades.at(-1).status, "NO_TRADE");
}));
test("demo resumes an existing pending exit across fresh repository instances", () => temp((directory) => {
  for (const input of optionsPaperDemoScenarios().slice(0, 6)) withOptionsPaperRepository(directory, (repository) => repository.append(input));
  const pending = withOptionsPaperRepository(directory, (repository) => repository.readReport());
  assert.equal(pending.account.openPositionCount, 1);
  assert.equal(pending.trades.at(-1).pendingExitReason, "STOP");
  const resumed = json(runCli(directory, ["--record-demo"]));
  assert.equal(resumed.batchesAppended, 2); assert.equal(resumed.account.openPositionCount, 0);
  assert.equal(resumed.account.equityCents, 99000);
}));
test("scenario file command saves exactly one closed trade and subsequent report", () => temp((directory) => {
  const input = join(directory, "scenario.json"); writeFileSync(input, JSON.stringify(paperFixture()));
  const result = json(runCli(directory, ["--input", input]));
  assert.equal(result.changed, true); assert.equal(result.report.reviews.length, 1);
  assert.equal(json(runCli(directory, ["--input", input])).changed, false);
}));
test("invalid input is rejected without changing saved history", () => temp((directory) => {
  withOptionsPaperRepository(directory, (repository) => repository.append(paperFixture()));
  const before = fileHash(journal(directory));
  const input = join(directory, "invalid.json"); writeFileSync(input, JSON.stringify({ ...paperFixture(), executionAllowed: true }));
  assert.equal(runCli(directory, ["--input", input]).status, 2);
  assert.equal(fileHash(journal(directory)), before);
}));
test("live order flags and malformed CLI arguments are rejected", () => temp((directory) => {
  for (const args of [["--live"], ["--order"], ["--demo", "--record-demo"], ["--input"], []]) assert.equal(runCli(directory, args).status, 2);
}));
test("corrupt, fully rehashed invented result fails deterministic replay", () => temp((directory) => {
  withOptionsPaperRepository(directory, (repository) => repository.append(paperFixture()));
  const batch = JSON.parse(readFileSync(journal(directory), "utf8"));
  batch.result.account.equityCents += 1000;
  batch.resultFingerprint = paperFingerprint(batch.result);
  const { fingerprint, ...body } = batch;
  writeFileSync(journal(directory), JSON.stringify({ ...body, fingerprint: paperFingerprint(body) }) + "\n");
  assert.throws(() => withOptionsPaperRepository(directory, (repository) => repository.readReport()), /PAPER_REPLAY_MISMATCH/);
}));
test("truncated journal remains intact and blocks recovery", () => temp((directory) => {
  withOptionsPaperRepository(directory, (repository) => repository.append(paperFixture()));
  appendFileSync(journal(directory), '{"partial":');
  const before = fileHash(journal(directory));
  assert.throws(() => withOptionsPaperRepository(directory, (repository) => repository.readReport()), /TRUNCATED_PAPER_JOURNAL/);
  assert.equal(fileHash(journal(directory)), before);
}));
test("hash chain and sequence reject modified parent and omitted batches", () => temp((directory) => {
  for (const input of optionsPaperDemoScenarios().slice(0, 2)) withOptionsPaperRepository(directory, (repository) => repository.append(input));
  const lines = readFileSync(journal(directory), "utf8").trimEnd().split("\n");
  writeFileSync(journal(directory), lines[1] + "\n");
  assert.throws(() => withOptionsPaperRepository(directory, (repository) => repository.readReport()), /PAPER_BATCH_INTEGRITY_FAILURE/);
}));
test("an existing writer lock cannot be silently removed or bypassed", () => temp((directory) => {
  withOptionsPaperRepository(directory, (repository) => repository.readReport());
  const lock = join(directory, "data/runtime/options-paper/writer.lock"); writeFileSync(lock, "owned");
  assert.throws(() => withOptionsPaperRepository(directory, (repository) => repository.append(paperFixture())), /EEXIST/);
  assert.equal(readFileSync(lock, "utf8"), "owned");
}));
test("repository handles cannot write or read after lock scope closes", () => temp((directory) => {
  const escaped = withOptionsPaperRepository(directory, (repository) => repository);
  assert.throws(() => escaped.append(paperFixture()), /PAPER_REPOSITORY_SCOPE_CLOSED/);
  assert.throws(() => escaped.readReport(), /PAPER_REPOSITORY_SCOPE_CLOSED/);
  assert.throws(() => escaped.readScenario("target"), /PAPER_REPOSITORY_SCOPE_CLOSED/);
}));
test("thenable callback cannot claim asynchronous lock ownership", () => temp((directory) => {
  assert.throws(() => withOptionsPaperRepository(directory, () => ({ then: () => {} })), /REQUIRES_SYNCHRONOUS_CALLBACK/);
  withOptionsPaperRepository(directory, (repository) => repository.append(paperFixture()));
}));
test("frozen plan changes cannot replace a saved open position", () => temp((directory) => {
  const fixture = paperFixture();
  const pending = { ...fixture, quotes: fixture.quotes.slice(0, 2), asOf: fixture.quotes[1].receivedAt };
  withOptionsPaperRepository(directory, (repository) => repository.append(pending));
  const before = fileHash(journal(directory));
  assert.throws(() => withOptionsPaperRepository(directory, (repository) => repository.append({ ...fixture, plan: { ...fixture.plan, stopLossBps: 2500 } })), /PAPER_HISTORY_REWRITE_REJECTED/);
  assert.equal(fileHash(journal(directory)), before);
}));
test("a new scenario cannot displace an open position or prevent its recovery", () => temp((directory) => {
  const fixture = paperFixture();
  const pending = { ...fixture, quotes: fixture.quotes.slice(0, 2), asOf: fixture.quotes[1].receivedAt };
  withOptionsPaperRepository(directory, (repository) => repository.append(pending));
  assert.throws(() => withOptionsPaperRepository(directory, (repository) => repository.append(paperFixture("another", 5))), /ACTIVE_PAPER_SCENARIO_REQUIRES_RESUME/);
  assert.equal(withOptionsPaperRepository(directory, (repository) => repository.append(fixture)).report.account.openPositionCount, 0);
}));
test("padded identifiers are rejected before any unclosable position is saved", () => temp((directory) => {
  const fixture = paperFixture();
  assert.throws(() => withOptionsPaperRepository(directory, (repository) => repository.append({ ...fixture, scenarioId: " bad " })), /INVALID_PAPER_SCENARIO/);
  assert.equal(existsSync(journal(directory)), false);
}));
test("report reading leaves journal byte-for-byte unchanged", () => temp((directory) => {
  withOptionsPaperRepository(directory, (repository) => repository.append(paperFixture()));
  const before = fileHash(journal(directory)); json(runCli(directory, ["--report"]));
  assert.equal(fileHash(journal(directory)), before);
}));
console.log(`Options paper repository and CLI: ${passed}/${passed} passed.`);
