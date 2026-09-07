import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsResearchObservationCommand as run, validateOptionsResearchObservation as validate } from "./options-research-observation.mjs";
import { runOptionsResearchProtocolCommand as protocol } from "./options-research-protocol.mjs";
import { runOptionsContextCaptureCommand as capture } from "./options-context-capture.mjs";
import { withBtcContextJournal } from "./lib/options-btc-context-io.mjs";
import { BTC_CONTEXT_URL } from "../src/engines/options-btc-context/BtcSpotContextEngine.ts";
import { readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";

const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T20:00:00.000Z", later = "2026-09-07T21:00:00.000Z";
const protocolId = "synthetic-protocol-storage-v1", captureId = "synthetic-observation-context";
const protocolPath = "data/runtime/options-research-protocols/" + protocolId;
const contextPath = "data/runtime/options-context-captures/" + captureId;
const fixture = () => ({ version: "OPTIONS_RESEARCH_OBSERVATION_INPUT_V1", observationId: "synthetic-observation-1", protocolId, captureId, symbol: "GLD", disposition: "OBSERVE_ONLY", reason: "Synthetic observation; no qualified option quote or trade." });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const clock = () => { let i = 0; return () => new Date(Date.parse(later) + ++i).toISOString(); };
const inspect = (d, now = clock()) => run(["--inspect", "observation.json"], { workspaceRoot: d, now });
function files(d) { const result = {}; function walk(p) { for (const e of readdirSync(p, { withFileTypes: true })) { const q = join(p, e.name); if (e.isDirectory()) walk(q); else result[relative(d, q)] = sha(readFileSync(q)); } } walk(d); return result; }
async function temporary(work) {
  const d = mkdtempSync(join(tmpdir(), "alpha-observation-test-"));
  try { await work(d); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(d)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-observation-test-")) throw Error("UNSAFE_TEST_CLEANUP"); rmSync(d, { recursive: true }); }
}
async function seed(d, registrationAt = at) {
  writeFileSync(join(d, "protocol.json"), readFileSync(join(root, "fixtures/options-research-protocol/declaration.synthetic.json")));
  protocol(["--register", "protocol.json"], { workspaceRoot: d, now: () => registrationAt });
  await capture(["--capture", captureId], { workspaceRoot: d, now: () => at });
  writeFileSync(join(d, "observation.json"), JSON.stringify(fixture(), null, 2) + "\n");
}
let passed = 0; async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }

await test("help and unsupported recording or clock arguments never read workspace", async () => {
  const opts = { workspaceRoot: join(root, "missing-observation-root") }; assert.equal((await run(["--help"], opts)).recordSaved, false);
  for (const args of [["--record", "x"], ["--verify", "x"], ["--inspect", "x", "--at", at], ["--inspect"]]) await assert.rejects(run(args, opts), /ARGUMENTS/);
});
await test("exact input rejects scope authority clocks unsafe IDs and absent reasons", () => {
  for (const extra of ["observationAt", "executionAllowed", "winProbability", "outcomeState", "featuresKnownAt"]) assert.throws(() => validate({ ...fixture(), [extra]: null }), /SHAPE/);
  for (const [key, value] of [["symbol", "BTC"], ["disposition", "BUY"], ["version", "v2"], ["protocolId", "../escape"], ["captureId", "CON"], ["reason", " "]]) assert.throws(() => validate({ ...fixture(), [key]: value }));
});
await test("getters unknown symbols and nonplain objects are rejected without execution", () => {
  let calls = 0; const v = fixture(); Object.defineProperty(v, "reason", { enumerable: true, get: () => { calls++; return "bad"; } }); assert.throws(() => validate(v), /SHAPE/); assert.equal(calls, 0);
  assert.throws(() => validate({ ...fixture(), [Symbol("authority")]: true }), /SHAPE/); assert.throws(() => validate(Object.assign(Object.create(null), fixture())), /SHAPE/);
});
await test("bounded reason preserves multiline Unicode and immutable cloned input", () => {
  for (const reason of ["\uD800", "bad\u0000text", "bad\u007f", "x".repeat(16_385)]) assert.throws(() => validate({ ...fixture(), reason }), /REASON_TEXT/);
  const input = { ...fixture(), reason: "Line one\r\nLine two\t🟡" }, r = validate(input); assert.deepEqual(r, input); assert(Object.isFrozen(r)); assert(!Object.isFrozen(input));
});
await test("invalid declaration is rejected before loading absent dependencies", () => temporary(async d => {
  writeFileSync(join(d, "observation.json"), JSON.stringify({ ...fixture(), symbol: "SPY" })); await assert.rejects(inspect(d), /SYMBOL_SCOPE/); assert.deepEqual(readdirSync(d), ["observation.json"]);
}));
await test("real verifiers bind both pairs and inspection changes no files", () => temporary(async d => {
  await seed(d); const before = files(d), r = await inspect(d); assert.deepEqual(files(d), before); assert(!existsSync(join(d, "data/runtime/options-research-observations")));
  assert.equal(r.protocol.payloadSha256, sha(readFileSync(join(d, protocolPath, "payload.json")))); assert.equal(r.context.receiptSha256, sha(readFileSync(join(d, contextPath, "receipt.json"))));
  assert.deepEqual(r.contextReport, JSON.parse(readFileSync(join(d, contextPath, "payload.json"), "utf8")).report);
  assert(r.observationAt > r.protocol.verifiedAt); assert(r.observationAt > r.context.verifiedAt); assert.equal(r.contextFreshnessAssessedAt, at); assert.equal(r.contextAgeAtObservationMs, 3600004);
  assert.equal(r.contextFreshnessAtObservationProven, false); assert.equal(r.context.missingStores.length, 5); assert.equal(r.observationInsideDeclaredWindow, false);
}));
await test("IBIT no-trade inspection creates neither an outcome nor a sample", () => temporary(async d => {
  await seed(d); writeFileSync(join(d, "observation.json"), JSON.stringify({ ...fixture(), symbol: "IBIT", disposition: "NO_TRADE" })); const r = await inspect(d);
  for (const key of ["featureWindowStartAt", "featuresKnownAt", "episodeId", "outcomeState", "outcomeKnownAt", "winProbability", "payloadSavedAt"]) assert.equal(r[key], null);
  for (const key of ["recordSaved", "sampleInputGenerated", "featureCompletenessProven", "historicalDecisionProven", "heldOutAccessSealed", "executionAllowed", "replayAllowed", "networkAccess", "sourceStoresRead"]) assert.equal(r[key], false);
  assert.equal(r.sampleCount, 0); assert.equal(r.sourceJournalAppends, 0); const { artifactSha256, ...body } = r; assert.equal(artifactSha256, readinessFingerprint(body)); assert(Object.isFrozen(r.contextReport));
}));
await test("BOM whitespace and raw source hash survive inspection", () => temporary(async d => {
  await seed(d); const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), readFileSync(join(d, "observation.json")), Buffer.from("\r\n ")]); writeFileSync(join(d, "observation.json"), bytes);
  const r = await inspect(d); assert.deepEqual(Buffer.from(r.sourceInputText, "utf8"), bytes); assert.equal(r.sourceInputSha256, sha(bytes)); assert.equal(r.sourceInputBytes, bytes.length);
}));
await test("equal or regressing observation and verification clocks fail", () => temporary(async d => {
  await seed(d); await assert.rejects(inspect(d, () => later), /OBSERVATION_CLOCK_ORDER/);
  for (const index of [2, 3, 4]) { let i = 0; await assert.rejects(inspect(d, () => new Date(Date.parse(later) + (++i === index ? 0 : i)).toISOString()), /OBSERVATION_CLOCK_ORDER/); }
}));
await test("missing or incomplete prerequisite pairs cannot be replaced with flags", () => temporary(async d => {
  writeFileSync(join(d, "observation.json"), JSON.stringify(fixture())); await assert.rejects(inspect(d), /PAIR_INCOMPLETE_OR_MISSING/);
  mkdirSync(join(d, protocolPath), { recursive: true }); writeFileSync(join(d, protocolPath, "receipt.json"), '{"registrationReceiptVerified":true}'); await assert.rejects(inspect(d), /PAIR_INCOMPLETE_OR_MISSING/);
}));
await test("edited dependency with rebound byte hash still fails original recomputation", () => temporary(async d => {
  await seed(d); const p = join(d, protocolPath, "payload.json"), value = JSON.parse(readFileSync(p, "utf8")); value.assessment.registered = true;
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); writeFileSync(p, bytes); const receiptPath = join(d, protocolPath, "receipt.json"), receipt = JSON.parse(readFileSync(receiptPath, "utf8")); receipt.payloadSha256 = sha(bytes); receipt.payloadBytes = bytes.length; writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  await assert.rejects(inspect(d), /PAYLOAD_RECOMPUTATION_MISMATCH/);
}));
await test("dependency changes after verification or at observation are detected", async () => {
  for (const index of [3, 4]) await temporary(async d => { await seed(d); let i = 0; const now = () => { if (++i === index) writeFileSync(join(d, protocolPath, "payload.json"), "changed"); return new Date(Date.parse(later) + i).toISOString(); }; await assert.rejects(inspect(d, now), /DEPENDENCY_CHANGED/); });
});
await test("input replacement during inspection is rejected", () => temporary(async d => {
  await seed(d); let i = 0; await assert.rejects(inspect(d, () => { if (++i === 4) writeFileSync(join(d, "observation.json"), "changed"); return new Date(Date.parse(later) + i).toISOString(); }), /INPUT_CHANGED/);
}));
await test("late registration remains visible and does not assign partitions", () => temporary(async d => {
  const late = "2026-09-08T15:00:00.000Z"; await seed(d, late); let i = 0; const r = await inspect(d, () => new Date(Date.parse(late) + ++i).toISOString());
  assert(r.diagnostics.includes("LATE_PROTOCOL_PAYLOAD")); assert(r.diagnostics.includes("PROTOCOL_RECEIPT_PREPARED_AT_OR_AFTER_FIRST_WINDOW")); assert.equal(r.observationInsideDeclaredWindow, true); assert.equal(r.sampleCount, 0); assert.equal(r.protocol.registrationReceiptVerified, true);
}));
await test("strict JSON encoding duplicate keys depth and input size fail without writes", () => temporary(async d => {
  for (const bytes of [Buffer.from([0xff]), Buffer.from('{"x":1,"x":2}'), Buffer.from('['.repeat(33)+'0'+']'.repeat(33))]) { writeFileSync(join(d, "observation.json"), bytes); await assert.rejects(inspect(d), /JSON_ENCODING_OR_STRUCTURE/); }
  truncateSync(join(d, "observation.json"), 256 * 1024 + 1); await assert.rejects(inspect(d), /UNSAFE_FILE/); assert.deepEqual(readdirSync(d), ["observation.json"]);
}));
await test("hard-linked input and prerequisite payloads are rejected", () => temporary(async d => {
  await seed(d); linkSync(join(d, protocolPath, "payload.json"), join(d, "alias")); await assert.rejects(inspect(d), /UNSAFE_FILE/); linkSync(join(d, "observation.json"), join(d, "input-alias")); await assert.rejects(inspect(d), /UNSAFE_FILE/);
}));
await test("path escape and junction cannot redirect dependency reads", () => temporary(async d => {
  writeFileSync(join(d, "observation.json"), JSON.stringify(fixture())); mkdirSync(join(d, "data")); mkdirSync(join(d, "elsewhere")); symlinkSync(join(d, "elsewhere"), join(d, "data/runtime"), "junction");
  await assert.rejects(inspect(d), /UNSAFE_PATH|UNSAFE_DIRECTORY/); await assert.rejects(run(["--inspect", "../outside"], { workspaceRoot: d }), /OPTIONS_EXPORT_/); assert.deepEqual(readdirSync(join(d, "elsewhere")), []);
}));
await test("saved stale BTC report is preserved and current source stores are not read", () => temporary(async d => {
  const receivedAt = "2026-09-07T04:00:00.000Z";
  await withBtcContextJournal(d, s => s.append({ requestedAt: receivedAt, receivedAt, url: BTC_CONTEXT_URL, sourceText: readFileSync(join(root, "fixtures/options-btc-context/book.synthetic.json"), "utf8"), errorCode: null }, receivedAt), receivedAt);
  await seed(d); const savedReport = JSON.parse(readFileSync(join(d, contextPath, "payload.json"), "utf8")).report;
  const originalFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error("FORBIDDEN_NETWORK"); };
  try { const r = await inspect(d); assert.deepEqual(r.contextReport, savedReport); assert.equal(r.context.memberCount, 1); assert.equal(r.contextFreshnessAtObservationProven, false); } finally { globalThis.fetch = originalFetch; }
}));
await test("fresh process resolves only two saved pairs and declaration with identical identity", () => temporary(async d => {
  await seed(d); writeFileSync(join(d, "protocol.json"), "UNUSABLE ORIGINAL INPUT"); const before = files(d), expected = await inspect(d);
  const code = `import {runOptionsResearchObservationCommand as run} from './scripts/options-research-observation.mjs'; let i=0; console.log(JSON.stringify(await run(['--inspect','observation.json'],{workspaceRoot:${JSON.stringify(d)},now:()=>new Date(Date.parse('${later}')+ ++i).toISOString()})));`;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).artifactSha256, expected.artifactSha256); assert.deepEqual(files(d), before);
}));
console.log(`${passed}/${passed} tests passed.`);
