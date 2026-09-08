import assert from "node:assert/strict";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsPaperPortfolioCommand as run } from "./options-paper-portfolio.mjs";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { paperFixture } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { paperFingerprint } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";

const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T23:55:00.000Z", id = "paper-portfolio-test";
const opts = dir => ({ workspaceRoot: dir, now: () => at });
const savedPath = dir => join(dir, "data/runtime/options-paper-portfolio", id + ".json");
const journalPath = dir => join(dir, "data/runtime/options-paper/sessions.ndjson");
function temporary(work) { const dir = mkdtempSync(join(tmpdir(), "alpha-paper-portfolio-test-")); try { work(dir); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(dir)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-paper-portfolio-test-")) throw Error("UNSAFE_CLEANUP"); rmSync(dir, { recursive: true }); } }
function settings(dir) { const { history, ...s } = run(["--demo"], opts(dir)).input; writeFileSync(join(dir, "settings.json"), JSON.stringify(s)); return s; }
function seed(dir) { settings(dir); withOptionsPaperRepository(dir, r => r.append(paperFixture())); }
let passed = 0; function test(name, work) { work(); passed++; console.log(`PASS ${name}`); }

test("demo retains all outcomes and writes no directory unless saved", () => temporary(dir => {
  const r = run(["--demo"], opts(dir)); assert.equal(r.result.inventory.length, 7); assert.equal(r.result.paper.reviews.length, 5);
  assert.equal(r.result.paper.mistakeNotebook.entries.length, 4); assert.equal(r.result.status, "MODELED_CANDIDATE_BLOCKED"); assert(!existsSync(join(dir, "data")));
}));
test("saved snapshot recovers in a fresh process without original repositories", () => temporary(dir => {
  const saved = run(["--demo", "--save", id], opts(dir)), bytes = readFileSync(savedPath(dir));
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `import { runOptionsPaperPortfolioCommand as run } from ${JSON.stringify(new URL('./options-paper-portfolio.mjs', import.meta.url).href)}; console.log(JSON.stringify(run(['--verify', '${id}'], { workspaceRoot: process.argv[1], now: () => '${at}' })));`, dir], { cwd: root, encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr); assert.equal(JSON.parse(child.stdout).reportFingerprint, saved.reportFingerprint);
  assert.equal(saved.verifiedCurrentJournal, false); assert.deepEqual(readFileSync(savedPath(dir)), bytes); assert(!existsSync(journalPath(dir)));
}));
test("real journal reader recovers latest state without appending plans or quotes", () => temporary(dir => {
  seed(dir); const before = readFileSync(journalPath(dir)); const r = run(["--paper", "settings.json", "--save", id], opts(dir));
  assert.equal(r.tradeCount, 1); assert.equal(r.closedReviews, 1); assert.equal(r.existingJournalAppends, 0);
  assert.deepEqual(readFileSync(journalPath(dir)), before); assert(!existsSync(join(dir, "data/runtime/options-paper/writer.lock")));
  const saved = JSON.parse(readFileSync(savedPath(dir), "utf8")); assert.equal(saved.source.kind, "RECOVERED_PAPER_JOURNAL"); assert.match(saved.source.journalSha256, /^[0-9a-f]{64}$/);
}));
test("existing repository revisions resolve to one final scenario", () => temporary(dir => {
  settings(dir); const s = paperFixture(); withOptionsPaperRepository(dir, r => { r.append({ ...s, quotes: [s.quotes[0]], asOf: s.plan.createdAt }); r.append(s); });
  const r = run(["--paper", "settings.json"], opts(dir)); assert.equal(r.result.inventory.length, 1); assert.equal(r.result.paper.reviews.length, 1);
}));
test("missing store never becomes a fresh funded account", () => temporary(dir => {
  settings(dir); assert.throws(() => run(["--paper", "settings.json"], opts(dir)), /STORE_MISSING/); assert(!existsSync(join(dir, "data")));
}));
test("busy store remains unchanged and its lock is not removed", () => temporary(dir => {
  seed(dir); const lock = join(dir, "data/runtime/options-paper/writer.lock"); writeFileSync(lock, "owned elsewhere"); const b = readFileSync(journalPath(dir));
  assert.throws(() => run(["--paper", "settings.json"], opts(dir)), /STORE_BUSY/); assert.equal(readFileSync(lock, "utf8"), "owned elsewhere"); assert.deepEqual(readFileSync(journalPath(dir)), b);
}));
test("corrupt and truncated journals fail instead of omitting cases", () => temporary(dir => {
  seed(dir); const b = readFileSync(journalPath(dir));
  for (const data of [Buffer.from("PRIVATE_CORRUPTION\n"), b.subarray(0, b.length - 1)]) { writeFileSync(journalPath(dir), data); assert.throws(() => run(["--paper", "settings.json"], opts(dir)), /STORE_RECOVERY_FAILED/); assert.deepEqual(readFileSync(journalPath(dir)), data); }
}));
test("duplicate-key and invalid UTF8 journals fail before repository recovery", () => temporary(dir => {
  seed(dir); const b = readFileSync(journalPath(dir), "utf8");
  for (const data of [b.replace("{", '{"sequence":1,'), Buffer.from([0xff, 0x0a])]) { writeFileSync(journalPath(dir), data); assert.throws(() => run(["--paper", "settings.json"], opts(dir)), /STORE_RECOVERY_FAILED/); }
}));
test("settings cannot smuggle a substituted history into repository mode", () => temporary(dir => {
  seed(dir); const s = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")); writeFileSync(join(dir, "settings.json"), JSON.stringify({ ...s, history: [] }));
  assert.throws(() => run(["--paper", "settings.json"], opts(dir)), /SETTINGS_SHAPE/);
}));
test("explicit input is fingerprinted and unknown event coverage blocks normally", () => temporary(dir => {
  const s = run(["--demo"], opts(dir)).input; writeFileSync(join(dir, "input.json"), JSON.stringify({ ...s, eventReview: null }));
  const r = run(["--input", "input.json", "--save", id], opts(dir)); assert(r.blockers.some(b => b.code === "EVENT_REVIEW_UNKNOWN"));
  assert.equal(JSON.parse(readFileSync(savedPath(dir), "utf8")).source.kind, "LOCAL_INPUT");
}));
test("valid or partially written artifact cannot be overwritten", () => temporary(dir => {
  run(["--demo", "--save", id], opts(dir)); const b = readFileSync(savedPath(dir)); assert.throws(() => run(["--demo", "--save", id], opts(dir)), e => e.code === "EEXIST"); assert.deepEqual(readFileSync(savedPath(dir)), b);
  writeFileSync(savedPath(dir), "partial"); assert.throws(() => run(["--demo", "--save", id], opts(dir)), e => e.code === "EEXIST"); assert.equal(readFileSync(savedPath(dir), "utf8"), "partial");
}));
test("rehashed changed balance or authority is rejected by recomputation", () => temporary(dir => {
  run(["--demo", "--save", id], opts(dir)); const b = readFileSync(savedPath(dir));
  for (const edit of [s => s.result.paper.account.settledCashCents++, s => s.executionAllowed = true, s => s.extra = true]) {
    const s = JSON.parse(b.toString()); edit(s); const { artifactFingerprint, ...body } = s; s.artifactFingerprint = paperFingerprint(body);
    writeFileSync(savedPath(dir), JSON.stringify(s, null, 2) + "\n"); assert.throws(() => run(["--verify", id], opts(dir)), /ARTIFACT_REPLAY_MISMATCH/);
  }
}));
test("duplicate decoded keys, malformed UTF8 and excessive nesting are rejected", () => temporary(dir => {
  const s = JSON.stringify(run(["--demo"], opts(dir)).input);
  for (const data of [s.replace("{", '{"history\\u0043omplete":false,'), Buffer.from([0xff]), "[".repeat(33) + "0" + "]".repeat(33)]) {
    writeFileSync(join(dir, "input.json"), data); assert.throws(() => run(["--input", "input.json"], opts(dir)), /DUPLICATE_JSON_KEY|JSON_ENCODING|JSON_DEPTH/);
  }
}));
test("bounded input and saved artifact limits are enforced before parsing", () => temporary(dir => {
  settings(dir); truncateSync(join(dir, "settings.json"), 16 * 1024 * 1024 + 1); assert.throws(() => run(["--paper", "settings.json"], opts(dir)), /UNSAFE_FILE/);
  run(["--demo", "--save", id], opts(dir)); truncateSync(savedPath(dir), 48 * 1024 * 1024 + 1); assert.throws(() => run(["--verify", id], opts(dir)), /UNSAFE_FILE/);
}));
test("hard links cannot substitute source journal or saved evidence", () => temporary(dir => {
  seed(dir); linkSync(journalPath(dir), join(dir, "alias")); assert.throws(() => run(["--paper", "settings.json"], opts(dir)), /STORE_RECOVERY_FAILED/);
  run(["--demo", "--save", id], opts(dir)); linkSync(savedPath(dir), join(dir, "saved-alias")); assert.throws(() => run(["--verify", id], opts(dir)), /UNSAFE_FILE/);
}));
test("junction and traversal cannot redirect saved artifacts", () => temporary(dir => {
  mkdirSync(join(dir, "other")); mkdirSync(join(dir, "data")); symlinkSync(join(dir, "other"), join(dir, "data/runtime"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => run(["--demo", "--save", id], opts(dir)), /UNSAFE/); assert.deepEqual(readdirSync(join(dir, "other")), []);
  assert.throws(() => run(["--input", "../outside"], opts(dir)), /PATH_ESCAPE/); assert.throws(() => run(["--verify", "../bad"], opts(dir)), /ID/);
}));
test("actual recording clock is distinct from modeled clocks and cannot regress", () => temporary(dir => {
  const s = run(["--demo"], opts(dir)); assert.equal(s.recordedAt, at); assert(s.input.asOf > at);
  let n = 0; assert.throws(() => run(["--demo"], { workspaceRoot: dir, now: () => n++ ? "2026-09-06T00:00:00.000Z" : at }), /RECORDING_CLOCK/);
  run(["--demo", "--save", id], opts(dir)); assert.throws(() => run(["--verify", id], { workspaceRoot: dir, now: () => "2026-09-06T00:00:00.000Z" }), /RECORDING_CLOCK/);
}));
test("no network request or independent research store is required", () => temporary(dir => {
  seed(dir); mkdirSync(join(dir, "data/runtime/options-historical-replay")); const unrelated = join(dir, "data/runtime/options-historical-replay/runs.ndjson"); writeFileSync(unrelated, "must not parse");
  const original = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); };
  try { run(["--paper", "settings.json", "--save", id], opts(dir)); run(["--verify", id], opts(dir)); assert.equal(readFileSync(unrelated, "utf8"), "must not parse"); } finally { globalThis.fetch = original; }
}));
test("help and unsupported arguments cannot create an execution path", () => temporary(dir => {
  for (const args of [[], ["--live"], ["--paper"], ["--input"], ["--demo", "--save"], ["--demo", "--order"], ["--verify", id, "extra"]]) assert.throws(() => run(args, opts(dir)));
  assert.equal(run(["--help"], opts(dir)).executionAllowed, false); assert.deepEqual(readdirSync(dir), []);
}));
test("CLI error response omits raw local paths and malformed input", () => {
  const r = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/options-paper-portfolio.mjs", "--paper", "PRIVATE_PATH_MISSING.json"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 2); assert.equal(JSON.parse(r.stderr).executionAllowed, false); assert(!r.stderr.includes("PRIVATE_PATH_MISSING"));
});
console.log(`${passed}/${passed} tests passed.`);
