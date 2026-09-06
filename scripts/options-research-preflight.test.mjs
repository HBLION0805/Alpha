import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { extractHistoricalQuoteSubset } from "./options-market-extract.mjs";
import { runOptionsResearchPreflightCommand } from "./options-research-preflight.mjs";
import { historicalReplayFixture } from "../src/engines/options-historical-replay/OptionsHistoricalReplayFixtures.ts";
import { marketEvidenceFingerprint } from "../src/engines/options-market-evidence/OptionsMarketEvidenceEngine.ts";

const root = process.cwd(), cli = resolve(root, "scripts/options-research-preflight.mjs"), tsx = resolve(root, "node_modules/tsx/dist/cli.mjs");
const header = "underlying_symbol,quote_datetime,root,expiration,strike,option_type,open,high,low,close,trade_volume,bid_size,bid,ask_size,ask,underlying_bid,underlying_ask";
const row = "GLD,2026-09-04 10:00:00,GLD,2026-09-25,480.00,C,0.20,0.22,0.19,0.21,10,5,0.20,8,0.22,470.00,470.02";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fileHash = (path) => digest(readFileSync(path));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const preparations = (directory) => join(directory, "data/runtime/options-historical-replay/preparations");
const later = (clock) => new Date(Date.parse(clock) + 3_600_000).toISOString();
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`PASS ${name}`); }
async function temp(run) {
  const allowed = realpathSync(tmpdir()), directory = mkdtempSync(join(allowed, "alpha-research-preflight-test-"));
  try { await run(directory); } finally {
    const target = realpathSync(directory); assert.ok(target.startsWith(allowed + sep) && target.includes("alpha-research-preflight-test-"));
    rmSync(target, { recursive: true, force: true });
  }
}
async function fixture(directory, noMatch = false) {
  const source = join(directory, "source.csv"); writeFileSync(source, [header, noMatch ? "AAPL,,,,,,,,,,,,,,,," : row, ...(noMatch ? [] : [row.replace("10:00:00", "10:01:00")])].join("\n") + "\n");
  const base = structuredClone(historicalReplayFixture());
  const extracted = await extractHistoricalQuoteSubset(directory, source, { selectionId: "preflight-io-selection", sessionDate: "2026-09-04", contractKeys: [base.config.contractKey], rationale: "Synthetic retrospective preparation test, not a trading signal." });
  const metadataPath = join(directory, "metadata.json"), configPath = join(directory, "config.json");
  writeJson(metadataPath, base.evidence.metadata); writeJson(configPath, base.config);
  const args = ["--manifest", extracted.manifestPath, "--metadata", metadataPath, "--config", configPath];
  const clock = new Date(Date.parse(extracted.manifest.finishedAt) + 1000).toISOString();
  return { ...extracted, metadataPath, configPath, source, args, clock,
    run: (save = false, at = clock) => runOptionsResearchPreflightCommand([...args, ...(save ? ["--save"] : [])], { workspaceRoot: directory, now: () => at }) };
}
function rehashManifest(path, change) {
  const { fingerprint, ...body } = readJson(path); change(body);
  writeJson(path, { ...body, fingerprint: marketEvidenceFingerprint(body) });
}
function assertNoAuthority(report) {
  assert.equal(report.executionAllowed, false); assert.equal(report.marketValidated, false); assert.equal(report.winProbability, null);
  assert.equal(report.brokerAccountVerified, false); assert.equal(report.originalQualificationUnchanged, true); assert.equal(report.tradesExecuted, 0);
}

await test("coherent inputs link without importing data, running fills or saving an artifact", () => temp(async (directory) => {
  const input = await fixture(directory), result = input.run();
  assert.equal(result.report.status, "INPUTS_LINKED_FOR_RESEARCH"); assertNoAuthority(result.report);
  assert.equal(result.saved, false); assert.equal(result.artifactPath, null); assert.equal(existsSync(preparations(directory)), false);
  assert.equal(result.report.evidenceCandidate.importedAt, input.clock); assert.equal(result.report.sourceOrigin, "SYNTHETIC_FIXTURE");
  assert.equal(result.report.evidenceCandidate.sourceFileSha256, result.report.childSha256);
  assert.equal(result.report.evidenceCandidate.rows[0].snapshotAt, "2026-09-04T14:00:00.000Z");
  assert.equal(result.report.sourceManifest.fingerprint, input.manifest.fingerprint); assert.ok(result.report.nextSteps.length >= 2);
  assert.equal(Object.isFrozen(result.report.evidenceCandidate.rows), true);
}));
await test("owner origin and explicit usage declaration remain unauthenticated research input", () => temp(async (directory) => {
  const input = await fixture(directory), metadata = readJson(input.metadataPath);
  writeJson(input.metadataPath, { ...metadata, origin: "OWNER_PROVIDED_FILE", usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" });
  const report = input.run().report;
  assert.equal(report.status, "INPUTS_LINKED_FOR_RESEARCH"); assert.equal(report.evidenceCandidate.metadata.origin, "OWNER_PROVIDED_FILE"); assertNoAuthority(report);
  writeJson(input.metadataPath, { ...metadata, origin: "OWNER_PROVIDED_FILE", usageDeclaration: "UNKNOWN" });
  assert.ok(input.run().report.blockers.includes("OWNER_USAGE_DECLARATION_MISSING"));
}));
await test("NO_MATCH is a valid blocked report with no invented evidence", () => temp(async (directory) => {
  const input = await fixture(directory, true), report = input.run().report;
  assert.equal(report.status, "BLOCKED"); assert.ok(report.blockers.includes("NO_TARGET_QUOTES"));
  assert.equal(report.evidenceCandidate, null); assert.equal(report.childPath, null); assertNoAuthority(report);
  const saved = input.run(true); assert.equal(saved.changed, true); assert.equal(saved.report.evidenceCandidate, null);
}));
await test("missing contract, session, costs and acknowledgement produce explicit blockers", () => temp(async (directory) => {
  const input = await fixture(directory), config = readJson(input.configPath);
  config.assumptions.contractTerms = null; config.assumptions.session = null; config.assumptions.costs = null; config.assumptions.acknowledgeCounterfactual = false;
  writeJson(input.configPath, config); const blockers = input.run().report.blockers;
  for (const code of ["CONTRACT_ASSUMPTIONS_MISSING", "SESSION_ASSUMPTIONS_MISSING", "COST_ASSUMPTIONS_MISSING", "COUNTERFACTUAL_ACKNOWLEDGEMENT_MISSING"]) assert.ok(blockers.includes(code));
}));
await test("mismatched dataset IDs and undeclared or absent contracts cannot link", () => temp(async (directory) => {
  const input = await fixture(directory), config = readJson(input.configPath);
  writeJson(input.metadataPath, { ...readJson(input.metadataPath), datasetId: "another-dataset" });
  assert.ok(input.run().report.blockers.includes("DATASET_ID_MISMATCH"));
  config.contractKey = "GLD:2026-09-25:CALL:49000"; writeJson(input.configPath, config);
  let blockers = input.run().report.blockers; assert.ok(blockers.includes("SELECTED_CONTRACT_UNDECLARED")); assert.ok(blockers.includes("SELECTED_CONTRACT_MISSING"));
  rehashManifest(input.manifestPath, (body) => { body.selection.contractKeys.push(config.contractKey); body.selection.contractKeys.sort(); body.selectionFingerprint = marketEvidenceFingerprint(body.selection); });
  blockers = input.run().report.blockers; assert.equal(blockers.includes("SELECTED_CONTRACT_UNDECLARED"), false); assert.ok(blockers.includes("SELECTED_CONTRACT_MISSING"));
}));
await test("a coherent different plan/session date is blocked against the extraction date", () => temp(async (directory) => {
  const input = await fixture(directory), config = readJson(input.configPath);
  writeJson(input.configPath, JSON.parse(JSON.stringify(config).replaceAll("2026-09-04", "2026-09-03")));
  const blockers = input.run().report.blockers; assert.ok(blockers.includes("PLAN_DATE_MISMATCH")); assert.ok(blockers.includes("SESSION_DATE_MISMATCH"));
}));
await test("unsupported delivery, interval and contemporaneous-size claims remain blocked", () => temp(async (directory) => {
  const input = await fixture(directory), metadata = readJson(input.metadataPath), config = readJson(input.configPath);
  writeJson(input.metadataPath, { ...metadata, delivery: "INTRADAY_15_MIN_DELAYED", intervalMinutes: 60 });
  config.assumptions.liquidityModel = "REQUIRE_CONTEMPORANEOUS_SIZE"; writeJson(input.configPath, config);
  const blockers = input.run().report.blockers;
  for (const code of ["HISTORICAL_FILE_DELIVERY_REQUIRED", "RESEARCH_INTERVAL_UNSUPPORTED", "CONTEMPORANEOUS_SIZE_UNPROVEN"]) assert.ok(blockers.includes(code));
}));
await test("the manifest-supplied parent path is never opened or followed", () => temp(async (directory) => {
  const input = await fixture(directory);
  rehashManifest(input.manifestPath, (body) => { body.sourcePath = "Z:\\unavailable-parent\\not-accessible.csv"; });
  assert.equal(input.run().report.status, "INPUTS_LINKED_FOR_RESEARCH");
  assert.ok(input.run().report.limitations.some((text) => text.includes("does not open")));
}));
await test("modified child bytes fail before producing a linked or saved report", () => temp(async (directory) => {
  const input = await fixture(directory); appendFileSync(input.quotesPath, "corruption");
  assert.throws(() => input.run(true), /PREFLIGHT_CHILD_HASH_MISMATCH/); assert.equal(existsSync(preparations(directory)), false);
}));
await test("rehashed CRLF child text cannot claim the extractor's LF record normalization", () => temp(async (directory) => {
  const input = await fixture(directory);
  writeFileSync(input.quotesPath, readFileSync(input.quotesPath, "utf8").replaceAll("\n", "\r\n"));
  rehashManifest(input.manifestPath, (body) => { body.childSha256 = "sha256:" + fileHash(input.quotesPath); });
  assert.throws(() => input.run(true), /CHILD_RECORD_NORMALIZATION_MISMATCH/); assert.equal(existsSync(preparations(directory)), false);
}));
await test("owner-provided future snapshots cannot become preparation evidence", () => temp(async (directory) => {
  const input = await fixture(directory);
  writeFileSync(input.quotesPath, readFileSync(input.quotesPath, "utf8").replaceAll("2026-09", "2099-09"));
  rehashManifest(input.manifestPath, (body) => {
    body.selection.sessionDate = "2099-09-04"; body.selection.contractKeys = body.selection.contractKeys.map((key) => key.replace("2026", "2099"));
    body.selectionFingerprint = marketEvidenceFingerprint(body.selection); body.childSha256 = "sha256:" + fileHash(input.quotesPath);
  });
  writeJson(input.configPath, JSON.parse(JSON.stringify(readJson(input.configPath)).replaceAll("2026-09", "2099-09")));
  writeJson(input.metadataPath, { ...readJson(input.metadataPath), origin: "OWNER_PROVIDED_FILE", usageDeclaration: "OWNER_ATTESTED_LOCAL_USE" });
  assert.throws(() => input.run(true), /MARKET_SNAPSHOT_AFTER_IMPORT/); assert.equal(existsSync(preparations(directory)), false);
}));
await test("rehashed manifest count contradictions and omitted fields remain invalid", () => temp(async (directory) => {
  const input = await fixture(directory), original = readJson(input.manifestPath);
  rehashManifest(input.manifestPath, (body) => { body.selectedRowCount++; body.sourceRowCount++; body.normalizedSelectedRowCount++; });
  assert.throws(() => input.run(), /CHILD_SELECTION_OR_COUNT_MISMATCH/);
  writeJson(input.manifestPath, original);
  rehashManifest(input.manifestPath, (body) => { body.sourceRowCount++; });
  assert.throws(() => input.run(), /MANIFEST_COUNT_MISMATCH/);
  writeJson(input.manifestPath, original);
  rehashManifest(input.manifestPath, (body) => { body.redirectChildPath = input.source; });
  assert.throws(() => input.run(), /INVALID_MANIFEST_FIELDS/);
}));
await test("child rows must belong to the declared selection and Eastern date", () => temp(async (directory) => {
  const input = await fixture(directory);
  rehashManifest(input.manifestPath, (body) => { body.selection.sessionDate = "2026-09-03"; body.selectionFingerprint = marketEvidenceFingerprint(body.selection); });
  assert.throws(() => input.run(), /CHILD_SELECTION_OR_COUNT_MISMATCH/);
}));
await test("future, noncanonical and reversed extraction clocks reject even when fully rehashed", () => temp(async (directory) => {
  const input = await fixture(directory), original = readJson(input.manifestPath);
  for (const change of [(body) => { body.finishedAt = later(input.clock); }, (body) => { body.requestedAt = later(body.finishedAt); }, (body) => { body.requestedAt = "2026-09-06T12:00:00Z"; }]) {
    writeJson(input.manifestPath, original); rehashManifest(input.manifestPath, change);
    assert.throws(() => input.run(), /MANIFEST_INTEGRITY_FAILURE/);
  }
}));
await test("manifest selection and complete fingerprint both require exact integrity", () => temp(async (directory) => {
  const input = await fixture(directory), original = readJson(input.manifestPath);
  rehashManifest(input.manifestPath, (body) => { body.selectionFingerprint = "sha256:" + "0".repeat(64); });
  assert.throws(() => input.run(), /SELECTION_INTEGRITY_FAILURE/);
  writeJson(input.manifestPath, { ...original, sourceBytes: original.sourceBytes + 1 });
  assert.throws(() => input.run(), /MANIFEST_INTEGRITY_FAILURE/);
}));
await test("NO_MATCH cannot conceal an unexpected quotes file", () => temp(async (directory) => {
  const input = await fixture(directory, true); writeFileSync(join(input.manifestPath, "..", "quotes.csv"), header);
  assert.throws(() => input.run(), /NO_MATCH_INTEGRITY_FAILURE/);
}));
await test("saved repeats preserve the original preparation and candidate clocks", () => temp(async (directory) => {
  const input = await fixture(directory), first = input.run(true), before = fileHash(first.artifactPath);
  const second = input.run(true, later(input.clock));
  assert.equal(first.changed, true); assert.equal(second.changed, false); assert.equal(second.report.requestedAt, input.clock);
  assert.equal(second.report.evidenceCandidate.importedAt, input.clock); assert.deepEqual(second.report, first.report); assert.equal(fileHash(first.artifactPath), before);
  // JSON presentation is not part of semantic input identity.
  writeFileSync(input.metadataPath, JSON.stringify(readJson(input.metadataPath)));
  assert.equal(input.run(true, later(input.clock)).changed, false);
}));
await test("an idempotent saved read still validates the current child before returning history", () => temp(async (directory) => {
  const input = await fixture(directory), first = input.run(true), before = fileHash(first.artifactPath);
  appendFileSync(input.quotesPath, "bad");
  assert.throws(() => input.run(true, later(input.clock)), /CHILD_HASH_MISMATCH/); assert.equal(fileHash(first.artifactPath), before);
}));
await test("changed configuration or metadata under one run ID conflicts without overwrite", () => temp(async (directory) => {
  const input = await fixture(directory), first = input.run(true), before = fileHash(first.artifactPath), config = readJson(input.configPath);
  writeJson(input.configPath, { ...config, plan: { ...config.plan, thesis: { ...config.plan.thesis, path: "A changed research declaration" } } });
  assert.throws(() => input.run(true, later(input.clock)), /RUN_ID_CONFLICT/); assert.equal(fileHash(first.artifactPath), before);
  writeJson(input.configPath, config); writeJson(input.metadataPath, { ...readJson(input.metadataPath), intervalMinutes: 2 });
  assert.throws(() => input.run(true, later(input.clock)), /RUN_ID_CONFLICT/); assert.equal(fileHash(first.artifactPath), before);
}));
await test("saved tampering fails even with a recomputed full artifact hash", () => temp(async (directory) => {
  const input = await fixture(directory), first = input.run(true), saved = readJson(first.artifactPath);
  saved.report.tradesExecuted = 1; const { fingerprint, ...body } = saved;
  writeJson(first.artifactPath, { ...body, fingerprint: marketEvidenceFingerprint(body) }); const before = fileHash(first.artifactPath);
  assert.throws(() => input.run(true, later(input.clock)), /SAVED_REPORT_REPLAY_MISMATCH/); assert.equal(fileHash(first.artifactPath), before);
}));
await test("partial saved artifacts are retained and never rewritten", () => temp(async (directory) => {
  const input = await fixture(directory), first = input.run(true); writeFileSync(first.artifactPath, '{"partial":'); const before = fileHash(first.artifactPath);
  assert.throws(() => input.run(true, later(input.clock))); assert.equal(fileHash(first.artifactPath), before);
}));
await test("run identifiers are hashed into safe filenames instead of used as paths", () => temp(async (directory) => {
  const input = await fixture(directory), config = { ...readJson(input.configPath), runId: "run/../../external" }; writeJson(input.configPath, config);
  const result = input.run(true); assert.equal(result.artifactPath, join(preparations(directory), digest(config.runId) + ".json"));
}));
await test("manifest location is restricted to the current workspace extract tree", () => temp(async (directory) => {
  const input = await fixture(directory), copy = join(directory, "copied-manifest.json"); writeJson(copy, readJson(input.manifestPath));
  assert.throws(() => runOptionsResearchPreflightCommand(["--manifest", copy, ...input.args.slice(2)], { workspaceRoot: directory, now: () => input.clock }), /MANIFEST_OUTSIDE_EXTRACTS/);
}));
await test("junctions in manifest and preparation directories are rejected", () => temp(async (directory) => {
  const input = await fixture(directory), extractDirectory = resolve(input.manifestPath, ".."), link = resolve(extractDirectory, "..", "linked"); symlinkSync(extractDirectory, link, "junction");
  assert.throws(() => runOptionsResearchPreflightCommand(["--manifest", join(link, "manifest.json"), ...input.args.slice(2)], { workspaceRoot: directory, now: () => input.clock }), /UNSAFE_DIRECTORY/);
  const destination = join(directory, "another-directory"); mkdirSync(destination); symlinkSync(destination, preparations(directory), "junction");
  assert.throws(() => input.run(true), /UNSAFE_DIRECTORY/);
}));
await test("fatal UTF-8 and per-file size limits reject malformed input", () => temp(async (directory) => {
  const input = await fixture(directory), metadata = readJson(input.metadataPath);
  writeFileSync(input.metadataPath, new Uint8Array([0xff, 0xfe])); assert.throws(() => input.run(), /encoded data|encoding/i);
  writeFileSync(input.metadataPath, " ".repeat(16 * 1024 + 1)); assert.throws(() => input.run(), /OVERSIZED_INPUT/);
  writeJson(input.metadataPath, metadata); writeFileSync(input.configPath, " ".repeat(64 * 1024 + 1)); assert.throws(() => input.run(), /OVERSIZED_INPUT/);
}));
await test("a file growing after initial checks cannot cause an unbounded read", () => temp(async (directory) => {
  const input = await fixture(directory), original = fs.readSync;
  let injected = false, requestedBytes = 0;
  try {
    fs.readSync = (...args) => {
      if (args[1].length === 16 * 1024 + 1) {
        requestedBytes += args[3];
        if (!injected) { injected = true; appendFileSync(input.metadataPath, " ".repeat(100_000)); }
      }
      return original(...args);
    };
    syncBuiltinESMExports(); assert.throws(() => input.run(true), /OVERSIZED_INPUT/);
  } finally { fs.readSync = original; syncBuiltinESMExports(); }
  assert.equal(injected, true); assert.ok(requestedBytes <= 16 * 1024 + 1); assert.equal(existsSync(preparations(directory)), false);
}));
await test("changing a file during its bounded read invalidates the captured input", () => temp(async (directory) => {
  const input = await fixture(directory), original = fs.readSync;
  let injected = false;
  try {
    fs.readSync = (...args) => {
      const count = original(...args);
      if (args[1].length === 16 * 1024 + 1 && !injected) { injected = true; appendFileSync(input.metadataPath, " "); }
      return count;
    };
    syncBuiltinESMExports(); assert.throws(() => input.run(true), /INPUT_CHANGED/);
  } finally { fs.readSync = original; syncBuiltinESMExports(); }
  assert.equal(injected, true); assert.equal(existsSync(preparations(directory)), false);
}));
await test("preflight and optional save preserve all three existing journals byte for byte", () => temp(async (directory) => {
  const input = await fixture(directory), journals = ["options-market-evidence/imports.ndjson", "options-paper/sessions.ndjson", "options-historical-replay/runs.ndjson"];
  for (const item of journals) { mkdirSync(join(directory, "data/runtime", item.split("/")[0]), { recursive: true }); writeFileSync(join(directory, "data/runtime", item), "existing-journal\n"); }
  input.run(); input.run(true);
  for (const item of journals) assert.equal(readFileSync(join(directory, "data/runtime", item), "utf8"), "existing-journal\n");
}));
await test("CLI explains boundaries, reads current inputs and rejects unsupported order flags", () => temp(async (directory) => {
  const input = await fixture(directory);
  const result = spawnSync(process.execPath, [tsx, cli, ...input.args], { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).report.tradesExecuted, 0);
  const help = runOptionsResearchPreflightCommand(["--help"], { workspaceRoot: directory }); assert.equal(help.executionAllowed, false);
  for (const args of [[], ["--live"], [...input.args, "--order"], [...input.args, "--save", "--save"], ["--manifest", "--live", ...input.args.slice(2)]]) assert.throws(() => runOptionsResearchPreflightCommand(args, { workspaceRoot: directory }), /UNSUPPORTED_COMMAND/);
}));

console.log(`Options research input preflight: ${passed}/${passed} passed.`);
