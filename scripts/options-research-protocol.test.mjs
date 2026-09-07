import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsResearchProtocolCommand as run } from "./options-research-protocol.mjs";
const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T20:00:00.000Z", id = "synthetic-protocol-storage-v1";
const fixture = readFileSync(join(root, "fixtures/options-research-protocol/declaration.synthetic.json"));
const base = d => join(d, "data/runtime/options-research-protocols", id);
const opts = d => ({ workspaceRoot: d, now: () => at });
const save = d => run(["--register", "input.json"], opts(d));
const verify = d => run(["--verify", id], opts(d));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = (d, name) => JSON.parse(readFileSync(join(base(d), name), "utf8"));
const writeJson = (d, name, value) => writeFileSync(join(base(d), name), JSON.stringify(value, null, 2) + "\n");
function files(d) { const result = {}; function walk(p) { for (const e of readdirSync(p, { withFileTypes: true })) { const q = join(p, e.name); if (e.isDirectory()) walk(q); else result[relative(d, q)] = sha(readFileSync(q)); } } walk(d); return result; }
function temporary(work) {
  const d = mkdtempSync(join(tmpdir(), "alpha-protocol-storage-test-"));
  try { writeFileSync(join(d, "input.json"), fixture); return work(d); }
  finally { const rel = relative(realpathSync(tmpdir()), realpathSync(d)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-protocol-storage-test-")) throw Error("UNSAFE_TEST_CLEANUP"); rmSync(d, { recursive: true }); }
}
let passed = 0; function test(name, work) { work(); passed++; console.log(`PASS ${name}`); }
test("help and invalid time or execution arguments never access a missing workspace", () => {
  const options = opts(join(root, "missing-protocol-root")); assert.equal(run(["--help"], options).executionAllowed, false);
  for (const args of [["--register", "input.json", "--at", at], ["--register"], ["--order"], ["--verify", "../escape"]]) assert.throws(() => run(args, options));
});
test("inspection returns only a declared-clock assessment without registration", () => temporary(d => {
  const before = files(d), r = run(["--inspect", "input.json"], opts(d)); assert.equal(r.registered, false); assert.equal(r.registrationClockBasis, "DECLARED_UNVERIFIED"); assert.deepEqual(files(d), before);
}));
test("registration reads save clock only after payload fsync helper completes", () => temporary(d => {
  let calls = 0; const now = () => { calls++; if (calls === 3) { assert(json(d, "payload.json").assessment.declarationSha256); assert.equal(existsSync(join(base(d), "receipt.json")), false); } if (calls === 5) assert(json(d, "receipt.json").payloadSavedAt); return new Date(Date.parse(at) + calls).toISOString(); };
  const r = run(["--register", "input.json"], { workspaceRoot: d, now }); assert.equal(calls, 5); assert(r.payloadSavedAt > r.preparedAt); assert(r.receiptPreparedAt > r.payloadSavedAt); assert(r.verifiedAt > r.receiptPreparedAt); assert.equal(r.registrationReceiptVerified, true);
}));
test("exact original source bytes and complete definitions survive registration", () => temporary(d => {
  const r = save(d), p = json(d, "payload.json"); assert.equal(p.sourceInputText, fixture.toString("utf8")); assert.equal(p.sourceInputSha256, sha(fixture)); assert.equal(p.sourceInputBytes, fixture.length);
  assert.deepEqual(readFileSync(join(d, "input.json")), fixture); assert.equal(r.sampleCount, 0); assert.deepEqual(r.emptyPartitionBlockers, ["EMPTY_TRAIN", "EMPTY_VALIDATION", "EMPTY_HOLDOUT"]); assert.equal(r.featureCompletenessProven, false);
}));
test("UTF-8 BOM and whitespace retain exact input bytes and source hash", () => temporary(d => {
  const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fixture, Buffer.from("\r\n ")]); writeFileSync(join(d, "input.json"), bytes);
  save(d); const p = json(d, "payload.json"); assert.deepEqual(Buffer.from(p.sourceInputText, "utf8"), bytes); assert.equal(p.sourceInputSha256, sha(bytes)); assert.equal(p.sourceInputBytes, bytes.length); assert.equal(verify(d).registrationReceiptVerified, true);
}));
test("payload saved exactly at or after first window remains late", () => temporary(d => {
  const first = JSON.parse(fixture).windows.TRAIN.startAt; let calls = 0;
  const r = run(["--register", "input.json"], { workspaceRoot: d, now: () => ++calls < 3 ? at : first });
  assert.equal(r.timing, "LATE_PAYLOAD_FREEZE"); assert.equal(r.payloadSavedAt, first); assert.equal(r.registrationReceiptVerified, true);
}));
test("receipt prepared after window start never inherits an earlier payload timestamp", () => temporary(d => {
  const first = JSON.parse(fixture).windows.TRAIN.startAt; let calls = 0;
  const r = run(["--register", "input.json"], { workspaceRoot: d, now: () => ++calls < 4 ? at : first });
  assert.equal(r.payloadFrozenBeforeFirstWindow, true); assert.equal(r.receiptPreparedBeforeFirstWindow, false); assert.equal(r.receiptPreparedAt, first);
}));
test("same protocol ID cannot overwrite or revise an existing registration", () => temporary(d => {
  save(d); const v = JSON.parse(fixture); v.featureDefinition.content += " Changed."; writeFileSync(join(d, "input.json"), JSON.stringify(v)); const before = files(d); assert.throws(() => save(d), /ID_ALREADY_EXISTS/); assert.deepEqual(files(d), before);
}));
test("post-write failures retain incomplete payload without later repair", () => temporary(d => {
  let count = 0; assert.throws(() => run(["--register", "input.json"], { workspaceRoot: d, now: () => { if (++count === 3) throw Error("CLOCK_FAILURE"); return at; } }), /CLOCK_FAILURE/);
  assert(existsSync(join(base(d), "payload.json"))); assert(!existsSync(join(base(d), "receipt.json"))); const before = files(d); assert.throws(() => save(d), /ID_ALREADY_EXISTS/); assert.throws(() => verify(d), /PAIR_INCOMPLETE_OR_MISSING/); assert.deepEqual(files(d), before);
}));
test("empty and receipt-only directories are preserved as incomplete attempts", () => temporary(d => {
  mkdirSync(base(d), { recursive: true }); assert.throws(() => save(d), /ID_ALREADY_EXISTS/); writeFileSync(join(base(d), "receipt.json"), "old partial"); const before = files(d); assert.throws(() => verify(d), /PAIR_INCOMPLETE_OR_MISSING/); assert.throws(() => save(d), /ID_ALREADY_EXISTS/); assert.deepEqual(files(d), before);
}));
test("save preparation and verification clocks cannot regress", () => {
  for (const index of [2, 3, 4]) temporary(d => { let count = 0; assert.throws(() => run(["--register", "input.json"], { workspaceRoot: d, now: () => ++count === index ? "2026-09-07T19:59:59.999Z" : at }), /CLOCK_ORDER/); });
  temporary(d => { save(d); assert.throws(() => run(["--verify", id], { workspaceRoot: d, now: () => "2026-09-07T19:59:59.999Z" }), /CLOCK_ORDER/); });
});
test("corrupt bytes and rebound edited assessment are independently rejected", () => temporary(d => {
  save(d); const p = json(d, "payload.json"); p.assessment.registered = true; writeJson(d, "payload.json", p); assert.throws(() => verify(d), /PAYLOAD_BYTES_MISMATCH/);
  const r = json(d, "receipt.json"), bytes = readFileSync(join(base(d), "payload.json")); r.payloadSha256 = sha(bytes); r.payloadBytes = bytes.length; writeJson(d, "receipt.json", r); assert.throws(() => verify(d), /PAYLOAD_RECOMPUTATION_MISMATCH/);
}));
test("receipt chronology claims and foreign IDs cannot override recomputation", () => temporary(d => {
  save(d); const r = json(d, "receipt.json"); writeJson(d, "receipt.json", { ...r, payloadFrozenBeforeFirstWindow: false }); assert.throws(() => verify(d), /RECEIPT_RECOMPUTATION_MISMATCH/); writeJson(d, "receipt.json", { ...r, protocolId: "foreign" }); assert.throws(() => verify(d), /RECEIPT_ID_OR_VERSION/);
}));
test("ambiguous JSON invalid UTF-8 and deep source input create no registration", () => temporary(d => {
  for (const bytes of [Buffer.from('{"x":1,"x":2}'), Buffer.from([0xff]), Buffer.from('['.repeat(33)+'0'+']'.repeat(33))]) { writeFileSync(join(d, "input.json"), bytes); assert.throws(() => save(d), /JSON_ENCODING_OR_STRUCTURE/); assert(!existsSync(base(d))); }
}));
test("oversized and hard-linked source files are rejected before registration", () => temporary(d => {
  truncateSync(join(d, "input.json"), 256 * 1024 + 1); assert.throws(() => save(d), /UNSAFE_FILE/); writeFileSync(join(d, "input.json"), fixture); linkSync(join(d, "input.json"), join(d, "input-alias")); assert.throws(() => save(d), /UNSAFE_FILE/); assert(!existsSync(base(d)));
}));
test("unsafe destination junction cannot redirect registration writes", () => temporary(d => {
  mkdirSync(join(d, "data")); mkdirSync(join(d, "unrelated")); symlinkSync(join(d, "unrelated"), join(d, "data/runtime"), "junction"); assert.throws(() => save(d), /UNSAFE_PATH|UNSAFE_DIRECTORY/); assert.deepEqual(readdirSync(join(d, "unrelated")), []);
}));
test("hard-linked payload and extra pair entries remain rejected without repair", () => temporary(d => {
  save(d); writeFileSync(join(base(d), "extra"), "keep"); assert.throws(() => verify(d), /PAIR_ENTRIES/); linkSync(join(base(d), "payload.json"), join(d, "alias")); assert.throws(() => verify(d), /UNSAFE_FILE/); assert.equal(readFileSync(join(base(d), "extra"), "utf8"), "keep");
}));
test("isolated fresh process verifies only saved pair without original input", () => temporary(d => temporary(isolated => {
  const saved = save(d); mkdirSync(base(isolated), { recursive: true }); for (const name of ["payload.json", "receipt.json"]) copyFileSync(join(base(d), name), join(base(isolated), name)); writeFileSync(join(isolated, "input.json"), "UNUSABLE");
  const code = `import {runOptionsResearchProtocolCommand as run} from './scripts/options-research-protocol.mjs'; console.log(JSON.stringify(run(['--verify','${id}'],{workspaceRoot:${JSON.stringify(isolated)}})));`;
  const r = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, encoding: "utf8" }); assert.equal(r.status, 0, r.stderr); const report = JSON.parse(r.stdout); assert.equal(report.declarationSha256, saved.declarationSha256); assert.equal(report.sourceInputRead, false); assert.equal(report.executionAllowed, false); assert.equal(report.decisionRecorded, false);
})));
console.log(`${passed}/${passed} tests passed.`);
