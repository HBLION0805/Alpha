import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, existsSync, writeFileSync, readFileSync, linkSync, readdirSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { runOptionsSampleInventoryCommand as run } from "./options-sample-inventory.mjs";
import { runOptionsOutcomeAuditCommand } from "./options-outcome-audit.mjs";
import { optionsPaperDemoScenarios } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { historicalReplayFixture } from "../src/engines/options-historical-replay/OptionsHistoricalReplayFixtures.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";
import { readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
const at = "2026-09-07T19:00:00.000Z", root = resolve(import.meta.dirname, ".."), paperPath = "data/runtime/options-paper/sessions.ndjson", historicalPath = "data/runtime/options-historical-replay/runs.ndjson";
const options = workspaceRoot => ({ workspaceRoot, now: () => at });
const file = dir => join(dir, "data/runtime/options-sample-partition/inventory-test.json");
const read = dir => run(["--report"], options(dir)), save = dir => run(["--report", "--save", "inventory-test"], options(dir));
function temporary(work) { const dir = mkdtempSync(join(tmpdir(), "alpha-sample-inventory-")); try { work(dir); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(dir)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-sample-inventory-")) throw Error("UNSAFE_CLEANUP"); rmSync(dir, { recursive: true }); } }
function seed(dir) { withOptionsPaperRepository(dir, r => { for (const s of optionsPaperDemoScenarios()) r.append(s); }); const f = historicalReplayFixture(); withOptionsHistoricalReplayRepository(dir, r => r.append(f.config, f.evidence, f.recordedAt)); }
let passed = 0; function test(name, work) { work(); passed++; console.log("PASS " + name); }
test("read-only inventory reconciles all cases with unchanged outcome audit and journal bytes", () => temporary(dir => {
  seed(dir); const p = readFileSync(join(dir, paperPath)), h = readFileSync(join(dir, historicalPath)), original = runOptionsOutcomeAuditCommand(["--report"], options(dir));
  const r = read(dir); assert.equal(r.totalCases, 8); assert.equal(r.closedReviews, 6); assert.equal(r.sourceOutcomeAuditSha256, original.artifactSha256); assert.equal(r.completePartitionInputCount, 0);
  assert.deepEqual(readFileSync(join(dir, paperPath)), p); assert.deepEqual(readFileSync(join(dir, historicalPath)), h); assert(!existsSync(join(dir, "data/runtime/options-sample-partition")));
}));
test("missing stores are not created by default and remain explicit when saved", () => temporary(dir => {
  assert.deepEqual(read(dir).missingStores, ["paper", "historical"]); assert(!existsSync(join(dir, "data"))); const r = save(dir);
  assert.equal(r.totalCases, 0); assert.deepEqual(r.missingStores, ["paper", "historical"]); assert(!existsSync(join(dir, "data/runtime/options-paper")));
}));
test("corrupt source is isolated and raw payloads are excluded", () => temporary(dir => {
  seed(dir); writeFileSync(join(dir, paperPath), "PRIVATE_SECRET"); const r = save(dir); assert.deepEqual(r.blockedStores, ["paper"]); assert.equal(r.totalCases, 1); assert(!readFileSync(file(dir), "utf8").includes("PRIVATE_SECRET"));
}));
test("writer lock and hard links remain blocked before repository access", () => temporary(dir => {
  seed(dir); const lock = join(dir, "data/runtime/options-paper/writer.lock"); writeFileSync(lock, "held"); assert.equal(read(dir).components[0].errorCode, "STORE_BUSY"); assert.equal(readFileSync(lock, "utf8"), "held");
  linkSync(join(dir, historicalPath), join(dir, "history-alias")); assert.equal(read(dir).components[1].errorCode, "STORE_UNSAFE");
}));
test("junctions cannot redirect source reads or saved artifacts", () => temporary(dir => {
  const other = join(dir, "other"); mkdirSync(other); symlinkSync(other, join(dir, "data"), process.platform === "win32" ? "junction" : "dir"); assert.equal(read(dir).blockedStores.length, 2); assert.throws(() => save(dir), /UNSAFE_PATH/); assert.deepEqual(readdirSync(other), []);
}));
test("saved inventories recompute exact bytes without reopening active journals", () => temporary(dir => {
  seed(dir); const r = save(dir), before = readFileSync(file(dir)); writeFileSync(join(dir, paperPath), "later unrelated active corruption");
  const verify = run(["--verify", "inventory-test"], options(dir)); assert.equal(verify.artifactSha256, r.artifactSha256); assert.equal(verify.totalCases, 8); assert.deepEqual(verify.blockedStores, []); assert.deepEqual(readFileSync(file(dir)), before);
}));
test("fresh process verifies histories and report without source repository files", () => temporary(dir => {
  seed(dir); save(dir); writeFileSync(join(dir, paperPath), "unreadable now"); writeFileSync(join(dir, historicalPath), "unreadable now");
  const code = `import{runOptionsSampleInventoryCommand as run}from ${JSON.stringify(pathToFileURL(join(root, "scripts/options-sample-inventory.mjs")).href)};console.log(JSON.stringify(run(['--verify','inventory-test'],{workspaceRoot:${JSON.stringify(dir)},now:()=>${JSON.stringify(at)}})));`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, encoding: "utf8" }); assert.equal(child.status, 0, child.stderr); assert.equal(JSON.parse(child.stdout).totalCases, 8);
}));
test("existing or partial saved IDs are never overwritten", () => temporary(dir => {
  save(dir); const bytes = readFileSync(file(dir)); assert.throws(() => save(dir), error => error.code === "EEXIST"); assert.deepEqual(readFileSync(file(dir)), bytes);
  writeFileSync(join(dir, "data/runtime/options-sample-partition/partial.json"), "partial"); assert.throws(() => run(["--report", "--save", "partial"], options(dir)), error => error.code === "EEXIST");
}));
test("rehashing a changed inventory or source result cannot bypass recomputation", () => temporary(dir => {
  seed(dir); save(dir); const original = JSON.parse(readFileSync(file(dir), "utf8"));
  for (const change of [r => r.inventory.completePartitionInputCount = 100, r => r.histories.historical.payload[0].result.netPnlCents = 999999]) {
    const r = structuredClone(original); change(r); const { artifactSha256, ...body } = r; r.artifactSha256 = readinessFingerprint(body); writeFileSync(file(dir), JSON.stringify(r, null, 2) + "\n"); assert.throws(() => run(["--verify", "inventory-test"], options(dir)), /ARTIFACT_REPLAY_MISMATCH/);
  }
}));
test("strict UTF8 duplicate keys and hardlinked artifacts are rejected", () => temporary(dir => {
  save(dir); const bytes = readFileSync(file(dir)); writeFileSync(file(dir), bytes.toString().replace('"executionAllowed": false', '"executionAllowed": true, "executionAllowed": false')); assert.throws(() => run(["--verify", "inventory-test"], options(dir)), /DUPLICATE_JSON_KEY/);
  writeFileSync(file(dir), Buffer.from([0xc3, 0x28])); assert.throws(() => run(["--verify", "inventory-test"], options(dir)), /JSON_ENCODING/);
  writeFileSync(file(dir), bytes); linkSync(file(dir), join(dir, "artifact-alias")); assert.throws(() => run(["--verify", "inventory-test"], options(dir)), /UNSAFE_FILE/);
}));
test("actual clocks cannot regress during load save or verify", () => temporary(dir => {
  let n = 0; assert.throws(() => run(["--report"], { workspaceRoot: dir, now: () => n++ ? "2026-09-06T00:00:00.000Z" : at }), /CLOCK_ORDER/);
  n = 0; assert.throws(() => run(["--report", "--save", "inventory-test"], { workspaceRoot: dir, now: () => ++n > 4 ? "2026-09-06T00:00:00.000Z" : at }), /RECORDING_CLOCK/);
  save(dir); assert.throws(() => run(["--verify", "inventory-test"], { workspaceRoot: dir, now: () => "2026-09-06T00:00:00.000Z" }), /RECORDING_CLOCK/);
}));
test("no network source refresh or learning mutation occurs", () => temporary(dir => {
  seed(dir); const before = readFileSync(join(dir, paperPath)), previous = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); };
  try { save(dir); run(["--verify", "inventory-test"], options(dir)); assert.deepEqual(readFileSync(join(dir, paperPath)), before); } finally { globalThis.fetch = previous; }
}));
test("help and invalid CLI errors are bounded and sanitized", () => temporary(dir => {
  assert(run(["--help"], { workspaceRoot: "missing" }).usage); for (const args of [[], ["--refresh"], ["--report", "extra"], ["--report", "--save", "../escape"], ["--verify", "con"]]) assert.throws(() => run(args, options(dir)));
  const child = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/options-sample-inventory.mjs", "--refresh", "PRIVATE_PAYLOAD"], { cwd: root, encoding: "utf8" }); assert.equal(child.status, 2); assert(!child.stderr.includes("PRIVATE_PAYLOAD")); assert.equal(JSON.parse(child.stderr).executionAllowed, false); assert.deepEqual(readdirSync(dir), []);
}));
console.log(`${passed}/${passed} tests passed.`);
