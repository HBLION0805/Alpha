import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync, existsSync, writeFileSync, readFileSync, linkSync, readdirSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import { runOptionsOutcomeAuditCommand as run } from "./options-outcome-audit.mjs";
import { optionsPaperDemoScenarios } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { historicalReplayFixture } from "../src/engines/options-historical-replay/OptionsHistoricalReplayFixtures.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";
const at = "2026-09-07T17:00:00.000Z", file = "data/runtime/options-paper/sessions.ndjson";
const read = root => run(["--report"], { workspaceRoot: root, now: () => at });
function temporary(work) { const root = mkdtempSync(join(tmpdir(), "alpha-outcome-test-")); try { work(root); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(root)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-outcome-test-")) throw Error("UNSAFE_CLEANUP"); rmSync(root, { recursive: true }); } }
function seed(root) { withOptionsPaperRepository(root, r => { for (const s of optionsPaperDemoScenarios()) r.append(s); }); const f = historicalReplayFixture(); withOptionsHistoricalReplayRepository(root, r => r.append(f.config, f.evidence, f.recordedAt)); }
let passed = 0; function test(name, work) { work(); passed++; console.log(`PASS ${name}`); }
test("restart recovery recomputes original cases and leaves journals unchanged", () => temporary(root => {
  seed(root); const before = readFileSync(join(root, file)), h = readFileSync(join(root, "data/runtime/options-historical-replay/runs.ndjson"));
  const r = read(root); assert.equal(r.components.paper.audit.metrics.closedCount, 5); assert.equal(r.components.historical.audit.metrics.closedCount, 1); assert.deepEqual(r, read(root));
  assert.deepEqual(readFileSync(join(root, file)), before); assert.deepEqual(readFileSync(join(root, "data/runtime/options-historical-replay/runs.ndjson")), h);
}));
test("missing stores are not created", () => temporary(root => { assert.equal(read(root).missingStores.length, 2); assert(!existsSync(join(root, "data"))); }));
test("corruption isolated and sanitized", () => temporary(root => { seed(root); writeFileSync(join(root, file), "PRIVATE_SECRET"); const r = read(root); assert.deepEqual(r.blockedStores, ["paper"]); assert(!JSON.stringify(r).includes("PRIVATE_SECRET")); assert.equal(r.components.historical.state, "AVAILABLE"); }));
test("writer lock preserved", () => temporary(root => { seed(root); const lock = join(root, "data/runtime/options-paper/writer.lock"); writeFileSync(lock, "held"); assert.equal(read(root).components.paper.errorCode, "STORE_BUSY"); assert.equal(readFileSync(lock, "utf8"), "held"); }));
test("hard links rejected before legacy repository access", () => temporary(root => { seed(root); linkSync(join(root, file), join(root, "alias")); assert.equal(read(root).components.paper.errorCode, "STORE_UNSAFE"); }));
test("junctions cannot redirect reads", () => temporary(root => { const other = join(root, "other"); mkdirSync(other); symlinkSync(other, join(root, "data"), process.platform === "win32" ? "junction" : "dir"); assert.equal(read(root).blockedStores.length, 2); assert.deepEqual(readdirSync(other), []); }));
test("no network calls occur", () => temporary(root => { seed(root); const saved = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); }; try { assert.equal(read(root).blockedStores.length, 0); } finally { globalThis.fetch = saved; } }));
test("clock regression rejected", () => temporary(root => { let n = 0; assert.throws(() => run(["--report"], { workspaceRoot: root, now: () => n++ ? "2026-09-06T00:00:00.000Z" : at }), /CLOCK_ORDER/); }));
test("help and strict arguments do not create data", () => temporary(root => { assert(run(["--help"], { workspaceRoot: root }).usage); for (const args of [[], ["--refresh"], ["--report", "extra"]]) assert.throws(() => run(args, { workspaceRoot: root }), /ARGUMENTS/); assert.deepEqual(readdirSync(root), []); }));
console.log(`${passed}/${passed} tests passed.`);
