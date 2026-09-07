import assert from "node:assert/strict";
import fs, { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync, readdirSync, mkdirSync, linkSync, symlinkSync, truncateSync, existsSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsPortfolioRiskCommand as run } from "./options-portfolio-risk.mjs";
import { portfolioFixture } from "../src/engines/options-portfolio-risk/OptionsPortfolioRiskFixtures.ts";
import { readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T18:00:00.000Z", id = "portfolio-test";
const opts = dir => ({ workspaceRoot: dir, now: () => at });
const savedPath = dir => join(dir, "data/runtime/options-portfolio-risk", id + ".json");
function temporary(work) { const dir = mkdtempSync(join(tmpdir(), "alpha-portfolio-test-")); try { work(dir); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(dir)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-portfolio-test-")) throw Error("UNSAFE_CLEANUP"); rmSync(dir, { recursive: true }); } }
function seed(dir) { writeFileSync(join(dir, "scenario.json"), JSON.stringify(portfolioFixture(), null, 2) + "\n"); }
let passed = 0; function test(name, work) { work(); passed++; console.log(`PASS ${name}`); }
test("unsaved demo computes seven cases without creating a data directory", () => temporary(dir => { const r = run(["--demo"], opts(dir)); assert.equal(r.cases.length, 7); assert.equal(r.cases.filter(c => c.result.status === "SCENARIO_BLOCKED").length, 5); assert(!existsSync(join(dir, "data"))); }));
test("saving then restarting recomputes exact reports without changing their bytes", () => temporary(dir => {
  const saved = run(["--demo", "--save", id], opts(dir)), bytes = readFileSync(savedPath(dir)), r = run(["--verify", id], opts(dir));
  assert.equal(r.artifactSha256, saved.artifactSha256); assert.equal(r.caseCount, 7); assert.deepEqual(readFileSync(savedPath(dir)), bytes); assert.equal(r.recordedAt, at);
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `import { runOptionsPortfolioRiskCommand as run } from ${JSON.stringify(new URL('./options-portfolio-risk.mjs', import.meta.url).href)}; console.log(JSON.stringify(run(['--verify', '${id}'], { workspaceRoot: process.argv[1], now: () => '${at}' })));`, dir], { cwd: root, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr); assert.equal(JSON.parse(child.stdout).artifactSha256, saved.artifactSha256);
}));
test("local input source bytes are hashed without mutation", () => temporary(dir => {
  seed(dir); const bytes = readFileSync(join(dir, "scenario.json")), r = run(["--input", "scenario.json", "--save", id], opts(dir)); assert.equal(r.caseCount, 1); assert.deepEqual(readFileSync(join(dir, "scenario.json")), bytes);
  const artifact = JSON.parse(readFileSync(savedPath(dir), "utf8")); assert.equal(artifact.source.kind, "LOCAL_FILE"); assert.match(artifact.source.sha256, /^[0-9a-f]{64}$/);
}));
test("risk-blocked input saves as a normal diagnostic outcome", () => temporary(dir => {
  writeFileSync(join(dir, "scenario.json"), JSON.stringify({ ...portfolioFixture(), accountMode: "UNKNOWN" })); const r = run(["--input", "scenario.json", "--save", id], opts(dir)); assert.equal(r.blockedScenarios, 1); assert.equal(r.status, "PORTFOLIO_ARTIFACT_SAVED_AND_RECOMPUTED");
}));
test("valid and corrupt existing artifact IDs cannot be overwritten", () => temporary(dir => {
  run(["--demo", "--save", id], opts(dir)); const bytes = readFileSync(savedPath(dir)); assert.throws(() => run(["--demo", "--save", id], opts(dir)), e => e.code === "EEXIST"); assert.deepEqual(readFileSync(savedPath(dir)), bytes);
  writeFileSync(savedPath(dir), "partial"); assert.throws(() => run(["--demo", "--save", id], opts(dir)), e => e.code === "EEXIST"); assert.equal(readFileSync(savedPath(dir), "utf8"), "partial");
}));
test("rehashing cannot conceal a changed risk result during verification", () => temporary(dir => {
  run(["--demo", "--save", id], opts(dir)); const r = JSON.parse(readFileSync(savedPath(dir), "utf8")); r.cases[0].result.account.settledCashCents++; const { artifactSha256, ...body } = r; r.artifactSha256 = readinessFingerprint(body); writeFileSync(savedPath(dir), JSON.stringify(r, null, 2) + "\n"); assert.throws(() => run(["--verify", id], opts(dir)), /ARTIFACT_REPLAY_MISMATCH/);
}));
test("altered authority and extra fields fail even with a recomputed outer hash", () => temporary(dir => {
  run(["--demo", "--save", id], opts(dir)); const r = JSON.parse(readFileSync(savedPath(dir), "utf8")); r.executionAllowed = true; const { artifactSha256, ...body } = r; r.artifactSha256 = readinessFingerprint(body); writeFileSync(savedPath(dir), JSON.stringify(r, null, 2) + "\n"); assert.throws(() => run(["--verify", id], opts(dir)), /ARTIFACT_REPLAY_MISMATCH/);
}));
test("duplicate decoded JSON keys cannot silently replace risk fields", () => temporary(dir => {
  seed(dir); const original = readFileSync(join(dir, "scenario.json"), "utf8");
  for (const prefix of ['"historyComplete":false,', '"history\\u0043omplete":false,']) { writeFileSync(join(dir, "scenario.json"), original.replace("{", "{" + prefix)); assert.throws(() => run(["--input", "scenario.json"], opts(dir)), /DUPLICATE_JSON_KEY/); }
}));
test("invalid UTF8 malformed JSON and excessive nesting fail without data writes", () => temporary(dir => {
  for (const bytes of [Buffer.from([0xc3, 0x28]), Buffer.from("{PRIVATE_BODY"), Buffer.from("[".repeat(33) + "0" + "]".repeat(33))]) { writeFileSync(join(dir, "scenario.json"), bytes); assert.throws(() => run(["--input", "scenario.json"], opts(dir)), /JSON_(ENCODING|DEPTH)/); } assert(!existsSync(join(dir, "data")));
}));
test("oversized input and artifact are refused before parsing", () => temporary(dir => {
  seed(dir); truncateSync(join(dir, "scenario.json"), 2 * 1024 * 1024 + 1); assert.throws(() => run(["--input", "scenario.json"], opts(dir)), /UNSAFE_FILE/);
  run(["--demo", "--save", id], opts(dir)); truncateSync(savedPath(dir), 12 * 1024 * 1024 + 1); assert.throws(() => run(["--verify", id], opts(dir)), /UNSAFE_FILE/);
}));
test("hard-linked inputs and artifacts are rejected", () => temporary(dir => {
  seed(dir); linkSync(join(dir, "scenario.json"), join(dir, "alias")); assert.throws(() => run(["--input", "scenario.json"], opts(dir)), /UNSAFE_FILE/);
  run(["--demo", "--save", id], opts(dir)); linkSync(savedPath(dir), join(dir, "artifact-alias")); assert.throws(() => run(["--verify", id], opts(dir)), /UNSAFE_FILE/);
}));
test("output junction cannot redirect writes", () => temporary(dir => {
  const other = join(dir, "other"); mkdirSync(other); mkdirSync(join(dir, "data")); symlinkSync(other, join(dir, "data/runtime"), process.platform === "win32" ? "junction" : "dir"); assert.throws(() => run(["--demo", "--save", id], opts(dir)), /UNSAFE/); assert.deepEqual(readdirSync(other), []);
}));
test("workspace path escapes and invalid saved IDs cannot be used", () => temporary(dir => {
  assert.throws(() => run(["--input", "../outside.json"], opts(dir)), /PATH_ESCAPE/); assert.throws(() => run(["--demo", "--save", "../bad"], opts(dir)), /ID/); assert.throws(() => run(["--verify", "../bad"], opts(dir)), /ID/);
}));
test("a failed fsync leaves its artifact intact and is never auto-retried", () => temporary(dir => {
  const original = fs.fsyncSync; fs.fsyncSync = () => { throw Error("PRIVATE_FAILURE"); }; syncBuiltinESMExports();
  try { assert.throws(() => run(["--demo", "--save", id], opts(dir)), /PRIVATE_FAILURE/); assert(existsSync(savedPath(dir))); } finally { fs.fsyncSync = original; syncBuiltinESMExports(); }
  assert.throws(() => run(["--demo", "--save", id], opts(dir)), e => e.code === "EEXIST");
}));
test("no network or other runtime journal is touched", () => temporary(dir => {
  mkdirSync(join(dir, "data/runtime/options-paper"), { recursive: true }); const journal = join(dir, "data/runtime/options-paper/sessions.ndjson"); writeFileSync(journal, "protected journal bytes");
  const original = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); }; try { run(["--demo", "--save", id], opts(dir)); run(["--verify", id], opts(dir)); assert.equal(readFileSync(journal, "utf8"), "protected journal bytes"); } finally { globalThis.fetch = original; }
}));
test("actual recording clock and hypothetical assessment clock remain separate", () => temporary(dir => {
  const r = run(["--demo"], opts(dir)); assert.equal(r.recordedAt, at); assert(r.cases.every(c => c.scenario.asOf > r.recordedAt));
  let n = 0; assert.throws(() => run(["--demo"], { workspaceRoot: dir, now: () => n++ ? "2026-09-06T00:00:00.000Z" : at }), /RECORDING_CLOCK/);
  run(["--demo", "--save", id], opts(dir)); assert.throws(() => run(["--verify", id], { workspaceRoot: dir, now: () => "2026-09-06T00:00:00.000Z" }), /RECORDING_CLOCK/);
}));
test("unsupported command paths and help never add execution capabilities", () => temporary(dir => {
  for (const args of [[], ["--live"], ["--demo", "--save"], ["--input"], ["--demo", "--save", id, "--order"], ["--verify", id, "extra"]]) assert.throws(() => run(args, opts(dir)));
  assert.equal(run(["--help"], opts(dir)).executionAllowed, false); assert.deepEqual(readdirSync(dir), []);
}));
test("CLI sanitizes parser and filesystem failures", () => {
  const r = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/options-portfolio-risk.mjs", "--input", "PRIVATE_PATH_DOES_NOT_EXIST.json"], { cwd: root, encoding: "utf8" }); assert.equal(r.status, 2); assert.equal(JSON.parse(r.stderr).executionAllowed, false); assert(!r.stderr.includes("PRIVATE_PATH_DOES_NOT_EXIST"));
});
console.log(`${passed}/${passed} tests passed.`);
