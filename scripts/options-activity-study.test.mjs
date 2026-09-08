import assert from "node:assert/strict";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { runOptionsActivityStudyCommand as run } from "./options-activity-study.mjs";
import { runOptionsChainReviewCommand as chain } from "./options-chain-review.mjs";
import { activityStudyFixture } from "../src/engines/options-robinhood-data/OptionsActivityStudyFixtures.ts";

const base = "data/runtime/options-activity-studies/test-study", baselineAt = "2026-09-07T20:22:00.000Z", at = "2026-09-08T01:00:00.000Z";
const opts = (root, time = at) => ({workspaceRoot: root, now: () => time});
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("PASS " + name); }
function temp(fn) {
  const root = mkdtempSync(join(tmpdir(), "alpha-activity-test-"));
  try { return fn(root); } finally {
    const rel = relative(realpathSync(tmpdir()), realpathSync(root));
    if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-activity-test-")) throw Error("UNSAFE_CLEANUP");
    rmSync(root, {recursive: true});
  }
}
function board(root, sessionDate = null) {
  const f = activityStudyFixture(sessionDate), id = sessionDate ? "close-" + sessionDate.replaceAll("-", "") : "baseline";
  writeFileSync(join(root, "source.json"), JSON.stringify(f));
  return chain(["--build", "source.json", id], opts(root, sessionDate ? sessionDate + "T20:22:00.000Z" : baselineAt));
}
function seed(root) { board(root); return run(["--register", "baseline", "test-study"], opts(root)); }
function update(root, time = at) { return run(["--update", "test-study"], opts(root, time)); }
function report(root, saved) { return JSON.parse(readFileSync(join(root, saved.path.replace("review.md", "report.json")), "utf8")); }
test("registration preserves baseline bytes and survives a fresh process", () => temp(root => {
  const saved = seed(root); assert.equal(saved.counts.candidates, 4);
  const source = readFileSync(join(root, "data/runtime/options-chain-survey/baseline/capture.json"), "utf8");
  assert.equal(JSON.parse(readFileSync(join(root, base, "payload.json"), "utf8")).baselineSourceText, source);
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `import {runOptionsActivityStudyCommand as run} from ${JSON.stringify(new URL("./options-activity-study.mjs", import.meta.url).href)}; console.log(JSON.stringify(run(['--verify','test-study'],{workspaceRoot:process.argv[1],now:()=> '${at}'})));`, root], {cwd: resolve(import.meta.dirname, ".."), encoding: "utf8"});
  assert.equal(child.status, 0, child.stderr); assert.equal(JSON.parse(child.stdout).studyFingerprint, saved.studyFingerprint);
  assert(!existsSync(join(root, "data/runtime/options-paper")));
}));
test("registration is exclusive and cannot overwrite a study", () => temp(root => { seed(root); const before = readFileSync(join(root, base, "payload.json")); assert.throws(() => run(["--register", "baseline", "test-study"], opts(root)), /EEXIST/); assert.deepEqual(readFileSync(join(root, base, "payload.json")), before); }));
test("late registration fails before creating the study", () => temp(root => { board(root); assert.throws(() => run(["--register", "baseline", "test-study"], opts(root, "2026-09-08T19:45:00.000Z")), /REGISTRATION_CLOCK/); assert(!existsSync(join(root, base))); }));
test("a deadline crossed during payload save leaves an unaccepted partial artifact", () => temp(root => {
  board(root); let reads = 0;
  assert.throws(() => run(["--register", "baseline", "test-study"], {workspaceRoot:root, now:()=> ++reads <= 2 ? "2026-09-08T19:44:59.000Z" : "2026-09-08T19:45:00.000Z"}), /PROSPECTIVE_SAVE_DEADLINE/);
  assert(existsSync(join(root, base, "payload.json"))); assert(!existsSync(join(root, base, "receipt.json"))); assert.throws(() => run(["--verify", "test-study"], opts(root)));
}));
for (const f of ["payload.json", "receipt.json"]) test("tampered " + f + " fails recomputation", () => temp(root => { seed(root); const path = join(root, base, f); writeFileSync(path, readFileSync(path, "utf8") + " "); assert.throws(() => run(["--verify", "test-study"], opts(root)), /RECOMPUTATION/); }));
test("missing receipt and unexpected entries fail recovery", () => temp(root => { seed(root); writeFileSync(join(root, base, "unexpected.json"), "{}"); assert.throws(() => run(["--verify", "test-study"], opts(root)), /ENTRIES/); }));
test("hard linked study payload is rejected", () => temp(root => { seed(root); linkSync(join(root, base, "payload.json"), join(root, "copy.json")); assert.throws(() => run(["--verify", "test-study"], opts(root)), /UNSAFE_FILE/); }));
test("path traversal and reserved identifiers are rejected", () => temp(root => { for (const id of ["../escape", "con", "C:/elsewhere"]) assert.throws(() => run(["--verify", id], opts(root))); assert.equal(readdirSync(root).length, 0); }));
test("waiting report retains all cases and a repeated update is a verified no-op", () => temp(root => {
  seed(root); const a = update(root), r = report(root, a); assert.equal(r.status, "AWAITING_FUTURE_CLOSES"); assert.equal(r.cases.length, 4); assert.equal(r.counts.primaryEvaluableCandidates, 0);
  const b = update(root, "2026-09-08T02:00:00.000Z"); assert.equal(b.status, "ACTIVITY_INPUT_STATE_UNCHANGED"); assert.equal(b.reportFingerprint, a.reportFingerprint); assert.equal(readdirSync(join(root, base, "reports")).length, 1);
}));
test("elapsed missing windows produce a new immutable missing-data report", () => temp(root => { seed(root); const a = update(root), b = update(root, "2026-09-08T22:00:00.000Z"); assert.notEqual(a.reportId, b.reportId); assert(report(root, b).cases[0].outcomes[0].candidate.reason.includes("SESSION_BOARD_MISSING")); assert.equal(readdirSync(join(root, base, "reports")).length, 2); }));
test("entry and exit updates save outcomes reviews and exact source copies", () => temp(root => {
  seed(root); const initial = update(root); board(root, "2026-09-08"); const entry = update(root, "2026-09-08T20:22:00.000Z"); assert.equal(entry.counts.primaryEvaluableCandidates, 0);
  board(root, "2026-09-09"); const result = update(root, "2026-09-09T20:22:00.000Z"), r = report(root, result); assert.equal(r.counts.primaryEvaluableCandidates, 4); assert(r.candidateLessons.some(l => l.code === "NEGATIVE_REFERENCE_OUTCOME"));
  assert.deepEqual(readFileSync(join(root, result.path.replace("review.md", "close-20260909.json"))), readFileSync(join(root, "data/runtime/options-chain-survey/close-20260909/capture.json")));
  assert.equal(run(["--verify-report", "test-study", initial.reportId], opts(root)).counts.observedSessions, 0);
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `import {runOptionsActivityStudyCommand as run} from ${JSON.stringify(new URL("./options-activity-study.mjs", import.meta.url).href)}; console.log(JSON.stringify(run(['--verify-report','test-study',process.argv[2]],{workspaceRoot:process.argv[1],now:()=> '2026-09-09T20:22:00.000Z'})));`, root, result.reportId], {cwd: resolve(import.meta.dirname, ".."), encoding: "utf8"});
  assert.equal(child.status, 0, child.stderr); assert.equal(JSON.parse(child.stdout).reportFingerprint, result.reportFingerprint);
}));
test("seven-session fixture remains descriptive and independent of paper stores", () => temp(root => {
  seed(root); for (const day of ["08", "09", "10", "11", "14", "15", "16"]) board(root, "2026-09-" + day);
  const result = update(root, "2026-09-16T20:22:00.000Z"), r = report(root, result); assert.equal(r.counts.observedSessions, 7); assert.equal(r.cases[0].outcomes.length, 18); assert.equal(r.validatedEdge, false); assert.equal(r.actualTrades, 0); assert.equal(r.winProbability, null); assert(!existsSync(join(root, "data/runtime/options-paper")));
}));
test("future saved board cannot be used early", () => temp(root => { seed(root); board(root, "2026-09-09"); assert.throws(() => update(root), /CLOCK_ORDER/); }));
test("partial close board fails without silently discarding the session", () => temp(root => { seed(root); mkdirSync(join(root, "data/runtime/options-chain-survey/close-20260908")); assert.throws(() => update(root, "2026-09-08T20:22:00.000Z")); assert(!existsSync(join(root, base, "reports"))); }));
test("failed attempt without a board remains an absent session", () => temp(root => { seed(root); writeFileSync(join(root, "data/runtime/options-chain-survey/close-20260908-attempt.json"), "{}"); const r = report(root, update(root, "2026-09-08T22:00:00.000Z")); assert.equal(r.counts.observedSessions, 0); }));
for (const f of ["report.json", "inputs.json", "review.md", "close-20260908.json"]) test("tampered report artifact " + f + " is rejected", () => temp(root => {
  seed(root); board(root, "2026-09-08"); const a = update(root, "2026-09-08T20:22:00.000Z"), path = join(root, a.path.replace("review.md", f)); writeFileSync(path, readFileSync(path, "utf8") + " "); assert.throws(() => run(["--verify-report", "test-study", a.reportId], opts(root, "2026-09-08T20:22:00.000Z")));
}));
test("partial report is never overwritten to conceal interruption", () => temp(root => { seed(root); const a = update(root); const path = join(root, a.path.replace("review.md", "report.json")); writeFileSync(path, "{}"); assert.throws(() => update(root), /REPORT_RECOMPUTATION/); assert.equal(readFileSync(path, "utf8"), "{}"); }));
test("report recovery uses preserved bytes after source boards become unavailable", () => temp(root => { seed(root); board(root, "2026-09-08"); board(root, "2026-09-09"); const a = update(root, "2026-09-09T20:22:00.000Z"); renameSync(join(root, "data/runtime/options-chain-survey"), join(root, "data/runtime/original-source-unavailable")); const b = run(["--verify-report", "test-study", a.reportId], opts(root, "2026-09-09T20:22:00.000Z")); assert.equal(a.reportFingerprint, b.reportFingerprint); }));
test("invalid UTF8 and duplicate decoded study keys fail safely", () => temp(root => { seed(root); const p = join(root, base, "receipt.json"); writeFileSync(p, Buffer.from([0xff])); assert.throws(() => run(["--verify", "test-study"], opts(root))); writeFileSync(p, '{"a":1,"\\u0061":2}'); assert.throws(() => run(["--verify", "test-study"], opts(root)), /JSON_KEY/); }));
test("extra report entries cannot hide unrecomputed content", () => temp(root => { seed(root); const a = update(root); writeFileSync(join(root, a.path.replace("review.md", "other.json")), "{}"); assert.throws(() => update(root), /ENTRIES/); }));
console.log(`${passed}/${passed} tests passed.`);
