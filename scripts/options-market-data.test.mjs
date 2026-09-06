import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { withOptionsMarketEvidenceRepository } from "../src/repositories/LocalOptionsMarketEvidenceRepository.ts";
import { createOptionsMarketEvidence, marketEvidenceFingerprint } from "../src/engines/options-market-evidence/OptionsMarketEvidenceEngine.ts";
import { runOptionsMarketDataCommand } from "./options-market-data.mjs";

const root = process.cwd();
const cli = resolve(root, "scripts/options-market-data.mjs");
const tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
const importedAt = "2026-09-06T14:00:00.000Z";
const laterAt = "2026-09-06T15:00:00.000Z";
const header = "underlying_symbol,quote_datetime,root,expiration,strike,option_type,open,high,low,close,trade_volume,bid_size,bid,ask_size,ask,underlying_bid,underlying_ask";
const quote = (time = "10:00:00", bid = "0.20") => `GLD,2026-09-04 ${time},GLD,2026-09-25,400.00,C,0.20,0.22,0.19,0.21,10,5,${bid},8,0.22,400.00,400.02`;
const csv = `${header}\n${quote()}\n${quote("10:01:00")}\n`;
const metadata = (datasetId = "io-fixture") => ({ datasetId, origin: "SYNTHETIC_FIXTURE", source: "CBOE_DATASHOP_OPTION_QUOTES", usageDeclaration: "SYNTHETIC_TEST_ONLY", intervalMinutes: 1, delivery: "HISTORICAL_FILE" });
const ownerMetadata = (datasetId = "io-owner-file") => ({ ...metadata(datasetId), origin: "OWNER_PROVIDED_FILE", usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" });
const evidence = (id = "io-fixture", text = csv, at = importedAt) => createOptionsMarketEvidence(text, metadata(id), at);
const journal = (directory) => join(directory, "data/runtime/options-market-evidence/imports.ndjson");
const paperJournal = (directory) => join(directory, "data/runtime/options-paper/sessions.ndjson");
const lock = (directory) => join(directory, "data/runtime/options-market-evidence/writer.lock");
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const runCli = (directory, args) => spawnSync(process.execPath, [tsx, cli, ...args], { cwd: directory, encoding: "utf8" });
const json = (result) => { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
function temp(run) {
  const allowed = realpathSync(tmpdir());
  const directory = mkdtempSync(join(allowed, "alpha-market-evidence-test-"));
  try { run(directory); } finally {
    const target = realpathSync(directory);
    assert.ok(target.startsWith(allowed + sep) && target.includes("alpha-market-evidence-test-"));
    rmSync(target, { recursive: true, force: true });
  }
}
function inputFiles(directory, data = csv, declaration = ownerMetadata()) {
  const csvPath = join(directory, "quotes.csv"), metadataPath = join(directory, "metadata.json");
  writeFileSync(csvPath, data, "utf8"); writeFileSync(metadataPath, JSON.stringify(declaration), "utf8");
  return ["--import", csvPath, "--metadata", metadataPath];
}
function assertClosed(report) {
  assert.equal(report.decision, "NO_REPLAY"); assert.equal(report.realPriceReplayReady, false);
  assert.equal(report.tradesExecuted, 0); assert.equal(report.executionAllowed, false);
  assert.equal(report.winProbability, null);
}

test("catalog and help disclose local format scope without creating history", () => temp((directory) => {
  const catalog = json(runCli(directory, ["--catalog"]));
  assert.equal(catalog.executionAllowed, false);
  assert.match(JSON.stringify(catalog), /CBOE_DATASHOP_OPTION_QUOTES/);
  const help = json(runCli(directory, ["--help"]));
  assert.equal(help.executionAllowed, false); assert.match(JSON.stringify(help), /--import/);
  assert.equal(existsSync(journal(directory)), false);
}));
test("synthetic demo remains isolated and cannot rewrite saved paper history", () => temp((directory) => {
  mkdirSync(join(directory, "data/runtime/options-paper"), { recursive: true });
  writeFileSync(paperJournal(directory), "existing-paper-history\n");
  const before = hash(paperJournal(directory));
  const report = json(runCli(directory, ["--demo"]));
  assertClosed(report); assert.ok(report.rowCount > 0);
  assert.ok(report.origins.SYNTHETIC_FIXTURE > 0); assert.equal(report.origins.OWNER_PROVIDED_FILE, 0);
  assert.equal(existsSync(journal(directory)), false); assert.equal(hash(paperJournal(directory)), before);
}));
test("empty saved report is honest about missing datasets and executes no trade", () => temp((directory) => {
  const report = json(runCli(directory, ["--report"]));
  assertClosed(report); assert.equal(report.datasetCount, 0); assert.equal(report.rowCount, 0);
  assert.equal(existsSync(journal(directory)), false); assert.equal(existsSync(paperJournal(directory)), false);
}));
test("append and restart preserve source attribution and deterministic report", () => temp((directory) => {
  const first = withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  assert.equal(first.changed, true); assertClosed(first.report);
  const before = hash(journal(directory));
  const report = withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport());
  assert.deepEqual(report, first.report); assert.equal(report.datasetCount, 1); assert.equal(report.rowCount, 2);
  const saved = withOptionsMarketEvidenceRepository(directory, (repository) => repository.readEvidence("io-fixture"));
  assert.equal(saved.importedAt, importedAt); assert.equal(saved.metadata.source, "CBOE_DATASHOP_OPTION_QUOTES");
  assert.equal(saved.sourceFileSha256, "sha256:" + createHash("sha256").update(csv, "utf8").digest("hex"));
  assert.equal(hash(journal(directory)), before); assert.equal(existsSync(paperJournal(directory)), false);
}));
test("duplicate import is idempotent and preserves the original availability clock", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const before = hash(journal(directory));
  const next = withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence("io-fixture", csv, laterAt)));
  assert.equal(next.changed, false); assert.equal(hash(journal(directory)), before);
  const saved = withOptionsMarketEvidenceRepository(directory, (repository) => repository.readEvidence("io-fixture"));
  assert.equal(saved.importedAt, importedAt); assert.equal(next.report.datasetCount, 1);
}));
test("same dataset identifier cannot silently revise prices or metadata", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const before = hash(journal(directory));
  const priceChange = `${header}\n${quote("10:00:00", "0.19")}\n${quote("10:01:00")}\n`;
  const changedMetadata = createOptionsMarketEvidence(csv, { ...metadata(), intervalMinutes: 2 }, laterAt);
  for (const changed of [evidence("io-fixture", priceChange, laterAt), changedMetadata]) {
    assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(changed)), /MARKET_.*CONFLICT/);
    assert.equal(hash(journal(directory)), before);
  }
}));
test("same normalized rows with changed raw bytes still conflict under one dataset identifier", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const before = hash(journal(directory));
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence("io-fixture", csv.replaceAll("\n", "\r\n"), laterAt))), /MARKET_.*CONFLICT/);
  assert.equal(hash(journal(directory)), before);
}));
test("corrections under a new dataset identifier preserve both imported versions", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const next = withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence("io-correction", csv, laterAt)));
  assert.equal(next.changed, true); assert.equal(next.report.datasetCount, 2);
  assert.ok(withOptionsMarketEvidenceRepository(directory, (repository) => repository.readEvidence("io-fixture")));
  assert.ok(withOptionsMarketEvidenceRepository(directory, (repository) => repository.readEvidence("io-correction")));
}));
test("as-of reports exclude data by ingestion time without backdating historical quotes", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const before = hash(journal(directory));
  const earlier = withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport("2026-09-06T13:59:59.999Z"));
  assert.equal(earlier.datasetCount, 0); assert.equal(earlier.excludedAfterAsOfCount, 1); assertClosed(earlier);
  const at = withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport(importedAt));
  assert.equal(at.datasetCount, 1); assert.equal(hash(journal(directory)), before);
}));
test("new dataset ingestion cannot move the journal clock backwards", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const before = hash(journal(directory));
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence("earlier", csv, "2026-09-05T14:00:00.000Z"))), /MARKET_IMPORT_CLOCK_REGRESSION/);
  assert.equal(hash(journal(directory)), before);
}));
test("local owner-file command hashes exact content and uses the actual import clock", () => temp((directory) => {
  const args = inputFiles(directory);
  const before = Date.now();
  const first = json(runCli(directory, args));
  const after = Date.now();
  assert.equal(first.changed, true); assertClosed(first.report);
  assert.equal(first.report.origins.OWNER_PROVIDED_FILE, 1);
  const saved = withOptionsMarketEvidenceRepository(directory, (repository) => repository.readEvidence("io-owner-file"));
  assert.ok(Date.parse(saved.importedAt) >= before && Date.parse(saved.importedAt) <= after);
  assert.equal(saved.metadata.usageDeclaration, "OWNER_ATTESTED_LOCAL_USE");
  assert.equal(saved.sourceFileSha256, "sha256:" + createHash("sha256").update(csv).digest("hex"));
  assert.equal(saved.rows[0].snapshotAt, "2026-09-04T14:00:00.000Z");
  const fileBefore = hash(journal(directory));
  assert.equal(json(runCli(directory, args)).changed, false); assert.equal(hash(journal(directory)), fileBefore);
  assert.equal(existsSync(paperJournal(directory)), false);
}));
test("test clock injection remains separate from user-provided metadata fields", () => temp((directory) => {
  const args = inputFiles(directory);
  const result = runOptionsMarketDataCommand(args, { workspaceRoot: directory, now: () => importedAt });
  assert.equal(result.changed, true);
  assert.equal(result.report.datasets[0].importedAt, importedAt);
  const before = hash(journal(directory));
  for (const extra of [{ importedAt }, { sourceFileSha256: "0".repeat(64) }, { executionAllowed: true }, { marketVerified: true }]) {
    const invalidArgs = inputFiles(directory, csv, { ...ownerMetadata("injected"), ...extra });
    assert.equal(runCli(directory, invalidArgs).status, 2);
    assert.equal(hash(journal(directory)), before);
  }
}));
test("owner-provided future quote dates fail before any history append", () => temp((directory) => {
  const future = csv.replaceAll("2026-09-04", "2099-09-04").replaceAll("2026-09-25", "2099-09-25");
  const result = runCli(directory, inputFiles(directory, future));
  assert.equal(result.status, 2); assert.match(result.stderr, /MARKET_SNAPSHOT_AFTER_IMPORT/);
  assert.equal(existsSync(journal(directory)), false);
}));
test("missing or malformed metadata cannot mutate a valid saved journal", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const before = hash(journal(directory));
  const args = inputFiles(directory); writeFileSync(args[3], "{invalid", "utf8");
  assert.equal(runCli(directory, args).status, 2); assert.equal(hash(journal(directory)), before);
  assert.equal(runCli(directory, ["--import", args[1], "--metadata", join(directory, "absent.json")]).status, 2);
  assert.equal(hash(journal(directory)), before);
}));
test("malformed CSV and oversized local inputs fail without silent truncation", () => temp((directory) => {
  let args = inputFiles(directory, csv + '"unterminated');
  assert.equal(runCli(directory, args).status, 2); assert.equal(existsSync(journal(directory)), false);
  args = inputFiles(directory, "x".repeat(4 * 1024 * 1024 + 1));
  assert.equal(runCli(directory, args).status, 2); assert.equal(existsSync(journal(directory)), false);
  const directoryInput = runCli(directory, ["--import", directory, "--metadata", args[3]]);
  assert.equal(directoryInput.status, 2); assert.equal(existsSync(journal(directory)), false);
}));
test("UTF-8 BOM bytes remain part of source identity while invalid UTF-8 is rejected", () => temp((directory) => {
  const bomCsv = "\uFEFF" + csv;
  const args = inputFiles(directory, bomCsv);
  const imported = runOptionsMarketDataCommand(args, { workspaceRoot: directory, now: () => importedAt });
  assert.equal(imported.changed, true);
  const saved = withOptionsMarketEvidenceRepository(directory, (repository) => repository.readEvidence("io-owner-file"));
  assert.equal(saved.sourceFileSha256, "sha256:" + createHash("sha256").update(bomCsv, "utf8").digest("hex"));
  const before = hash(journal(directory));
  writeFileSync(args[1], new Uint8Array([0xff, 0xfe, 0x00]));
  assert.equal(runCli(directory, args).status, 2); assert.equal(hash(journal(directory)), before);
}));
test("oversized metadata is rejected before parsing or creating evidence", () => temp((directory) => {
  const args = inputFiles(directory);
  writeFileSync(args[3], " ".repeat(16 * 1024 + 1));
  assert.equal(runCli(directory, args).status, 2); assert.equal(existsSync(journal(directory)), false);
}));
test("unsupported network, execution and ambiguous command flags are rejected", () => temp((directory) => {
  for (const args of [[], ["--live"], ["--refresh"], ["--order"], ["--demo", "--report"], ["--import"], ["--metadata", "x"], ["--report", "--as-of", importedAt], ["--help", "--live"]]) {
    const result = runCli(directory, args); assert.equal(result.status, 2, JSON.stringify(args));
    assert.equal(JSON.parse(result.stderr).executionAllowed, false);
  }
  assert.equal(existsSync(journal(directory)), false);
}));
test("truncated journal blocks recovery and remains byte-for-byte intact", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  appendFileSync(journal(directory), '{"partial":'); const before = hash(journal(directory));
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_.*TRUNCATED|TRUNCATED_.*MARKET/);
  assert.equal(hash(journal(directory)), before); assert.equal(existsSync(lock(directory)), false);
}));
test("modified journal content cannot pass the envelope checksum", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const batch = JSON.parse(readFileSync(journal(directory), "utf8")); batch.evidence.metadata.datasetId = "tampered";
  writeFileSync(journal(directory), JSON.stringify(batch) + "\n"); const before = hash(journal(directory));
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_.*INTEGRITY/);
  assert.equal(hash(journal(directory)), before);
}));
test("rehashed invented replay permission fails deterministic qualification replay", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  const batch = JSON.parse(readFileSync(journal(directory), "utf8"));
  batch.qualification.executionAllowed = true;
  batch.qualificationFingerprint = marketEvidenceFingerprint(batch.qualification);
  const { fingerprint, ...body } = batch;
  writeFileSync(journal(directory), JSON.stringify({ ...body, fingerprint: marketEvidenceFingerprint(body) }) + "\n");
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_.*REPLAY|MARKET_.*QUALIFICATION/);
}));
test("omitted first batch and rehashed wrong parent break journal sequence continuity", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence("second", csv, laterAt)));
  const lines = readFileSync(journal(directory), "utf8").trimEnd().split("\n");
  writeFileSync(journal(directory), lines[1] + "\n");
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_.*INTEGRITY/);
  const second = JSON.parse(lines[1]); second.previousFingerprint = "sha256:" + "0".repeat(64);
  const { fingerprint, ...body } = second;
  writeFileSync(journal(directory), lines[0] + "\n" + JSON.stringify({ ...body, fingerprint: marketEvidenceFingerprint(body) }) + "\n");
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_.*INTEGRITY/);
}));
test("oversized saved journal blocks opening before parsing unbounded content", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport());
  writeFileSync(journal(directory), "x".repeat(16 * 1024 * 1024 + 1));
  const before = hash(journal(directory));
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_.*OVERSIZED|OVERSIZED_.*MARKET/);
  assert.equal(hash(journal(directory)), before);
}));
test("more than one thousand journal batches fail before per-record parsing", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport());
  writeFileSync(journal(directory), "{}\n".repeat(1001));
  const before = hash(journal(directory));
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_JOURNAL_BATCH_LIMIT/);
  assert.equal(hash(journal(directory)), before);
}));
test("an existing writer lock is neither bypassed nor silently removed", () => temp((directory) => {
  withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport());
  writeFileSync(lock(directory), "another-writer");
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence())), /EEXIST/);
  assert.equal(readFileSync(lock(directory), "utf8"), "another-writer");
}));
test("repository handles cannot read or append after their lock scope closes", () => temp((directory) => {
  const escaped = withOptionsMarketEvidenceRepository(directory, (repository) => repository);
  assert.throws(() => escaped.readReport(), /MARKET_.*SCOPE_CLOSED/);
  assert.throws(() => escaped.readEvidence("io-fixture"), /MARKET_.*SCOPE_CLOSED/);
  assert.throws(() => escaped.append(evidence()), /MARKET_.*SCOPE_CLOSED/);
  assert.equal(existsSync(journal(directory)), false);
}));
test("thenable and thrown callbacks release owned locks before later recovery", () => temp((directory) => {
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, () => ({ then: () => {} })), /SYNCHRONOUS_CALLBACK/);
  assert.equal(existsSync(lock(directory)), false);
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, () => { throw new Error("CALLBACK_TEST_FAILURE"); }), /CALLBACK_TEST_FAILURE/);
  assert.equal(existsSync(lock(directory)), false);
  assert.equal(withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence())).changed, true);
}));
test("a failed fsync poisons the active handle until disk history is reopened and checked", () => temp((directory) => {
  const original = fs.fsyncSync;
  try {
    fs.fsyncSync = () => { throw new Error("TEST_FSYNC_FAILURE"); };
    syncBuiltinESMExports();
    withOptionsMarketEvidenceRepository(directory, (repository) => {
      assert.throws(() => repository.append(evidence()), /TEST_FSYNC_FAILURE/);
      assert.throws(() => repository.append(evidence()), /MARKET_WRITE_UNCERTAIN_REOPEN_REQUIRED/);
      assert.throws(() => repository.readReport(), /MARKET_WRITE_UNCERTAIN_REOPEN_REQUIRED/);
      assert.throws(() => repository.readEvidence("io-fixture"), /MARKET_WRITE_UNCERTAIN_REOPEN_REQUIRED/);
    });
  } finally { fs.fsyncSync = original; syncBuiltinESMExports(); }
  assert.equal(existsSync(lock(directory)), false);
  const before = hash(journal(directory));
  const recovered = withOptionsMarketEvidenceRepository(directory, (repository) => repository.append(evidence()));
  assert.equal(recovered.changed, false); assert.equal(recovered.report.datasetCount, 1);
  assert.equal(hash(journal(directory)), before);
}));
test("non-directory runtime paths fail without replacing user content", () => temp((directory) => {
  const dataPath = join(directory, "data"); writeFileSync(dataPath, "keep-existing-file");
  assert.throws(() => withOptionsMarketEvidenceRepository(directory, (repository) => repository.readReport()), /MARKET_.*DIRECTORY|UNSAFE_.*MARKET/);
  assert.equal(readFileSync(dataPath, "utf8"), "keep-existing-file");
}));

console.log(`Options market evidence repository and CLI: ${passed}/${passed} passed.`);
