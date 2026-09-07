import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync, linkSync, mkdirSync, symlinkSync, truncateSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { runOptionsSamplePartitionCommand as run } from "./options-sample-partition.mjs";
import { samplePartitionFixture } from "../src/engines/options-sample-partition/OptionsSamplePartitionFixtures.ts";
import { readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T19:00:00.000Z", base = "data/runtime/options-sample-partition";
const options = dir => ({ workspaceRoot: dir, now: () => at });
function temporary(work) { const dir = mkdtempSync(join(tmpdir(), "alpha-partitions-test-")); try { work(dir); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(dir)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-partitions-test-")) throw Error("UNSAFE_TEST_CLEANUP"); rmSync(dir, { recursive: true }); } }
function input(dir, data = samplePartitionFixture()) { const bytes = Buffer.from(JSON.stringify(data, null, 2) + "\n"); writeFileSync(join(dir, "input.json"), bytes); return bytes; }
const save = dir => run(["--demo", "--save", "test-artifact"], options(dir));
const file = dir => join(dir, base, "test-artifact.json");
let passed = 0; function test(name, work) { work(); passed++; console.log(`PASS ${name}`); }
test("read-only demo retains all supplied samples without creating directories or journals", () => temporary(dir => {
  const r = run(["--demo"], options(dir)); assert.equal(r.cases.length, 2); assert.equal(r.cases[0].result.counts.assigned, 6); assert.equal(r.cases[1].result.counts.blocked, 3); assert.deepEqual(readdirSync(dir), []); assert.equal(r.executionAllowed, false);
}));
test("exclusive demo save and verification retain exact bytes and clocks", () => temporary(dir => {
  const r = save(dir), before = readFileSync(file(dir)), v = run(["--verify", "test-artifact"], options(dir));
  assert.equal(r.status, "SAMPLE_PARTITION_ARTIFACT_SAVED_AND_RECOMPUTED"); assert.equal(v.artifactSha256, r.artifactSha256); assert.equal(v.recordedAt, at); assert.equal(v.sampleCounts[0].counts.assigned, 6); assert.equal(v.sampleCounts[1].counts.blocked, 3); assert.deepEqual(readFileSync(file(dir)), before);
}));
test("saved local input keeps original input hash and source bytes", () => temporary(dir => {
  const bytes = input(dir); run(["--input", "input.json", "--save", "test-artifact"], options(dir)); const saved = JSON.parse(readFileSync(file(dir), "utf8"));
  assert.equal(saved.source.kind, "LOCAL_FILE"); assert.equal(saved.source.sha256, createHash("sha256").update(bytes).digest("hex")); assert.deepEqual(readFileSync(join(dir, "input.json")), bytes); assert.equal(saved.cases.length, 1); assert.equal(saved.cases[0].input.samples[0].decisionAt, "2026-09-08T14:00:00.000Z");
}));
test("a separate process can recompute the saved partition audit without its source input file", () => temporary(dir => {
  input(dir); run(["--input", "input.json", "--save", "test-artifact"], options(dir)); writeFileSync(join(dir, "input.json"), "later changed local input");
  const code = `import {runOptionsSamplePartitionCommand as run} from ${JSON.stringify(pathToFileURL(join(root, "scripts/options-sample-partition.mjs")).href)}; console.log(JSON.stringify(run(['--verify','test-artifact'],{workspaceRoot:${JSON.stringify(dir)},now:()=>${JSON.stringify(at)}})));`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, encoding: "utf8" }); assert.equal(child.status, 0, child.stderr); assert.equal(JSON.parse(child.stdout).status, "SAMPLE_PARTITION_ARTIFACT_RECOMPUTED");
}));
test("existing valid and partial artifact IDs cannot be overwritten", () => temporary(dir => {
  save(dir); const bytes = readFileSync(file(dir)); assert.throws(() => save(dir), error => error.code === "EEXIST"); assert.deepEqual(readFileSync(file(dir)), bytes);
  writeFileSync(join(dir, base, "partial-artifact.json"), "partial"); assert.throws(() => run(["--demo", "--save", "partial-artifact"], options(dir)), error => error.code === "EEXIST");
}));
test("changed results fail recomputation even if the envelope was rehashed", () => temporary(dir => {
  save(dir); const saved = JSON.parse(readFileSync(file(dir), "utf8")); saved.cases[0].result.counts.blocked = 200;
  const { artifactSha256, ...body } = saved; saved.artifactSha256 = readinessFingerprint(body); writeFileSync(file(dir), JSON.stringify(saved, null, 2) + "\n");
  assert.throws(() => run(["--verify", "test-artifact"], options(dir)), /ARTIFACT_REPLAY_MISMATCH/);
}));
test("synthetic-demo provenance cannot be relabeled onto a changed declaration", () => temporary(dir => {
  save(dir); const saved = JSON.parse(readFileSync(file(dir), "utf8")); saved.cases[0].input.datasetId = "different-demo"; writeFileSync(file(dir), JSON.stringify(saved, null, 2) + "\n");
  assert.throws(() => run(["--verify", "test-artifact"], options(dir)), /DEMO_INPUT_MISMATCH/);
}));
test("duplicate decoded input keys are rejected before partition use", () => temporary(dir => {
  const text = input(dir).toString().replace('"minimumGapMs": 86400000', '"minimumGapMs": 1, "minimumGapM\\u0073": 86400000'); writeFileSync(join(dir, "input.json"), text);
  assert.throws(() => run(["--input", "input.json"], options(dir)), /DUPLICATE_JSON_KEY/); assert(!existsSync(join(dir, "data")));
}));
test("duplicate saved keys cannot hide extra authority fields", () => temporary(dir => {
  save(dir); writeFileSync(file(dir), readFileSync(file(dir), "utf8").replace('"executionAllowed": false', '"executionAllowed": true, "executionAllowed": false'));
  assert.throws(() => run(["--verify", "test-artifact"], options(dir)), /DUPLICATE_JSON_KEY/);
}));
test("strict UTF-8 depth and file-size limits fail before output creation", () => temporary(dir => {
  writeFileSync(join(dir, "input.json"), Buffer.from([0xc3, 0x28])); assert.throws(() => run(["--input", "input.json"], options(dir)), /JSON_ENCODING/);
  writeFileSync(join(dir, "input.json"), "[".repeat(33) + "0" + "]".repeat(33)); assert.throws(() => run(["--input", "input.json"], options(dir)), /JSON_DEPTH/);
  truncateSync(join(dir, "input.json"), 1024 * 1024 + 1); assert.throws(() => run(["--input", "input.json"], options(dir)), /UNSAFE_FILE/); assert(!existsSync(join(dir, "data")));
}));
test("input and saved hard links are rejected without following aliases", () => temporary(dir => {
  input(dir); linkSync(join(dir, "input.json"), join(dir, "alias")); assert.throws(() => run(["--input", "input.json"], options(dir)), /UNSAFE_FILE/);
  save(dir); linkSync(file(dir), join(dir, "artifact-alias")); assert.throws(() => run(["--verify", "test-artifact"], options(dir)), /UNSAFE_FILE/);
}));
test("runtime junctions cannot redirect saved output", () => temporary(dir => {
  const other = join(dir, "other"); mkdirSync(other); symlinkSync(other, join(dir, "data"), process.platform === "win32" ? "junction" : "dir"); assert.throws(() => save(dir), /UNSAFE_PATH/); assert.deepEqual(readdirSync(other), []);
}));
test("recording clocks cannot regress and verification cannot precede recording", () => temporary(dir => {
  let count = 0; assert.throws(() => run(["--demo"], { workspaceRoot: dir, now: () => count++ ? "2026-09-07T18:59:59.999Z" : at }), /RECORDING_CLOCK/);
  save(dir); assert.throws(() => run(["--verify", "test-artifact"], { workspaceRoot: dir, now: () => "2026-09-07T18:59:59.999Z" }), /RECORDING_CLOCK/);
}));
test("no HTTP or existing journal writes occur", () => temporary(dir => {
  mkdirSync(join(dir, "data/runtime/options-paper"), { recursive: true }); const journal = join(dir, "data/runtime/options-paper/sessions.ndjson"); writeFileSync(journal, "untouched prior evidence");
  const previous = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); }; try { save(dir); run(["--verify", "test-artifact"], options(dir)); assert.equal(readFileSync(journal, "utf8"), "untouched prior evidence"); } finally { globalThis.fetch = previous; }
}));
test("unknown source hashes malformed records and extra fields fail verification", () => temporary(dir => {
  save(dir); const original = JSON.parse(readFileSync(file(dir), "utf8"));
  for (const change of [r => { r.source.kind = "ROBINHOOD_LIVE"; }, r => { r.unexpected = true; }, r => { r.cases = []; }]) { const copy = structuredClone(original); change(copy); writeFileSync(file(dir), JSON.stringify(copy, null, 2) + "\n"); assert.throws(() => run(["--verify", "test-artifact"], options(dir))); }
}));
test("help and invalid command paths cannot create data or expose raw input errors", () => temporary(dir => {
  assert(run(["--help"], { workspaceRoot: "missing" }).usage);
  for (const args of [[], ["--refresh"], ["--demo", "--save", "../escape"], ["--demo", "extra"], ["--input", "../outside.json"], ["--verify", "con"]]) assert.throws(() => run(args, options(dir)));
  const child = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/options-sample-partition.mjs", "--refresh", "PRIVATE_BODY"], { cwd: root, encoding: "utf8" }); assert.equal(child.status, 2); assert(!child.stderr.includes("PRIVATE_BODY")); assert.equal(JSON.parse(child.stderr).executionAllowed, false); assert.deepEqual(readdirSync(dir), []);
}));
console.log(`${passed}/${passed} tests passed.`);
