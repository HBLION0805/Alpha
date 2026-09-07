import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsResearchObservationCommand as run } from "./options-research-observation.mjs";
import { runOptionsResearchProtocolCommand as protocol } from "./options-research-protocol.mjs";
import { runOptionsContextCaptureCommand as capture } from "./options-context-capture.mjs";

const root = resolve(import.meta.dirname, ".."), old = "2026-09-07T20:00:00.000Z", start = Date.parse("2026-09-07T21:00:00.000Z");
const id = "synthetic-saved-observation", protocolId = "synthetic-protocol-storage-v1", captureId = "synthetic-saved-context";
const obs = "data/runtime/options-research-observations/" + id, prot = "data/runtime/options-research-protocols/" + protocolId, ctx = "data/runtime/options-context-captures/" + captureId;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const tick = () => { let i = 0; return () => new Date(start + ++i).toISOString(); };
const save = (d, now = tick()) => run(["--record", "note.json"], { workspaceRoot: d, now });
const verify = (d, now = () => new Date(start + 100).toISOString()) => run(["--verify", id], { workspaceRoot: d, now });
const read = (d, name) => JSON.parse(readFileSync(join(d, obs, name), "utf8"));
const write = (d, name, value) => writeFileSync(join(d, obs, name), JSON.stringify(value, null, 2) + "\n");
function files(d) { const result = {}; function walk(p) { for (const e of readdirSync(p, { withFileTypes: true })) { const q = join(p, e.name); if (e.isDirectory()) walk(q); else result[relative(d, q)] = sha(readFileSync(q)); } } walk(d); return result; }
async function temporary(work) {
  const d = mkdtempSync(join(tmpdir(), "alpha-observation-storage-test-"));
  try { await work(d); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(d)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-observation-storage-test-")) throw Error("UNSAFE_TEST_CLEANUP"); rmSync(d, { recursive: true }); }
}
async function seed(d) {
  copyFileSync(join(root, "fixtures/options-research-protocol/declaration.synthetic.json"), join(d, "protocol.json"));
  protocol(["--register", "protocol.json"], { workspaceRoot: d, now: () => old });
  await capture(["--capture", captureId], { workspaceRoot: d, now: () => old });
  writeFileSync(join(d, "note.json"), JSON.stringify({ version: "OPTIONS_RESEARCH_OBSERVATION_INPUT_V1", observationId: id, protocolId, captureId, symbol: "IBIT", disposition: "NO_TRADE", reason: "Synthetic note. Qualified quotes are unavailable." }, null, 2) + "\n");
}
function rebind(d) { const r = read(d, "receipt.json"), b = readFileSync(join(d, obs, "payload.json")); write(d, "receipt.json", { ...r, payloadSha256: sha(b), payloadBytes: b.length }); }
let passed = 0; async function test(name, work) { await work(); passed++; console.log("PASS " + name); }

await test("post-write clocks follow complete payload and receipt writes", () => temporary(async d => {
  await seed(d); let calls = 0; const result = await save(d, () => { calls++; if (calls === 5) { assert(read(d, "payload.json").inspection); assert(!existsSync(join(d, obs, "receipt.json"))); } if (calls === 7) assert(read(d, "receipt.json").payloadSavedAt); return new Date(start + calls).toISOString(); });
  assert.equal(calls, 9); assert(result.payloadSavedAt > result.observationAt); assert(result.receiptPreparedAt > result.payloadSavedAt); assert(result.verifiedAt > result.receiptPreparedAt); assert.equal(result.observationReceiptVerified, true);
}));
await test("saving retains exact inspection identity and every prerequisite byte", () => temporary(async d => {
  await seed(d); const before = files(d), inspection = await run(["--inspect", "note.json"], { workspaceRoot: d, now: tick() }); const result = await save(d);
  assert.deepEqual(read(d, "payload.json").inspection, inspection); assert.equal(result.inspectionSha256, inspection.artifactSha256);
  for (const [p, hash] of Object.entries(before)) assert.equal(files(d)[p], hash); assert.equal(result.recordSaved, true); assert.equal(result.outcomeState, null); assert.equal(result.sampleCount, 0); assert.equal(result.executionAllowed, false);
}));
await test("BOM source survives recovery after both original inputs become unusable", () => temporary(async d => {
  await seed(d); const bytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), readFileSync(join(d, "note.json")), Buffer.from("\r\n ")]); writeFileSync(join(d, "note.json"), bytes); await save(d);
  writeFileSync(join(d, "note.json"), "UNUSABLE"); writeFileSync(join(d, "protocol.json"), "UNUSABLE"); const r = await verify(d); assert.equal(r.sourceInputRead, false); assert.deepEqual(Buffer.from(read(d, "payload.json").inspection.sourceInputText, "utf8"), bytes);
}));
await test("duplicate ID cannot overwrite a completed observation", () => temporary(async d => {
  await seed(d); await save(d); const before = files(d); await assert.rejects(save(d), /ID_ALREADY_EXISTS/); assert.deepEqual(files(d), before);
}));
await test("empty and receipt-only directories are never resumed", () => temporary(async d => {
  await seed(d); mkdirSync(join(d, obs), { recursive: true }); await assert.rejects(save(d), /ID_ALREADY_EXISTS/); writeFileSync(join(d, obs, "receipt.json"), "original partial");
  const before = files(d); await assert.rejects(save(d), /ID_ALREADY_EXISTS/); await assert.rejects(verify(d), /PAIR_INCOMPLETE_OR_MISSING/); assert.deepEqual(files(d), before);
}));
await test("failed post-payload clock leaves a visible immutable partial pair", () => temporary(async d => {
  await seed(d); let i = 0; await assert.rejects(save(d, () => { if (++i === 5) throw Error("CLOCK_FAILED"); return new Date(start + i).toISOString(); }), /CLOCK_FAILED/);
  assert(existsSync(join(d, obs, "payload.json"))); assert(!existsSync(join(d, obs, "receipt.json"))); const before = files(d); await assert.rejects(save(d), /ID_ALREADY_EXISTS/); assert.deepEqual(files(d), before);
}));
await test("regressing save preparation and verification clocks fail", async () => {
  for (const index of [5, 6, 7, 8, 9]) await temporary(async d => { await seed(d); let i = 0; await assert.rejects(save(d, () => new Date(start + (++i === index ? 0 : i)).toISOString()), /CLOCK_ORDER/); });
});
await test("corrupt bytes and rebound outcome authority fail recomputation", () => temporary(async d => {
  await seed(d); await save(d); const p = read(d, "payload.json"); p.inspection.outcomeState = "CLOSED"; write(d, "payload.json", p); await assert.rejects(verify(d), /PAYLOAD_BYTES_MISMATCH/); rebind(d); await assert.rejects(verify(d), /PAYLOAD_RECOMPUTATION_MISMATCH/);
}));
await test("rebound original verification clocks cannot precede complete receipt preparation", () => temporary(async d => {
  await seed(d); await save(d); const p = read(d, "payload.json"); p.inspection.startedAt = "2026-09-07T18:00:00.000Z"; p.inspection.protocol.verifiedAt = "2026-09-07T19:00:00.000Z"; write(d, "payload.json", p); rebind(d); await assert.rejects(verify(d), /OBSERVATION_CLOCK_ORDER/);
}));
await test("changed receipt identity flags and save clocks fail", () => temporary(async d => {
  await seed(d); await save(d); const r = read(d, "receipt.json"); write(d, "receipt.json", { ...r, externalTimestampAttested: true }); await assert.rejects(verify(d), /RECEIPT_RECOMPUTATION_MISMATCH/);
  write(d, "receipt.json", { ...r, observationId: "foreign" }); await assert.rejects(verify(d), /RECEIPT_ID_OR_VERSION/);
  write(d, "receipt.json", { ...r, payloadSavedAt: old }); await assert.rejects(verify(d), /SAVE_CLOCK_ORDER/);
}));
await test("every missing prerequisite file blocks recovery without repair", async () => {
  for (const p of [prot + "/payload.json", prot + "/receipt.json", ctx + "/payload.json", ctx + "/receipt.json"]) await temporary(async d => { await seed(d); await save(d); unlinkSync(join(d, p)); const before = files(d); await assert.rejects(verify(d), /PAIR_INCOMPLETE_OR_MISSING/); assert.deepEqual(files(d), before); });
});
await test("changed context cannot be replaced by the embedded successful report", () => temporary(async d => {
  await seed(d); await save(d); writeFileSync(join(d, ctx, "payload.json"), "CORRUPT"); await assert.rejects(verify(d), /JSON_ENCODING_OR_STRUCTURE/);
}));
await test("extra entries and hard-linked observation payloads are preserved and rejected", () => temporary(async d => {
  await seed(d); await save(d); writeFileSync(join(d, obs, "extra"), "keep"); await assert.rejects(verify(d), /PAIR_ENTRIES/); linkSync(join(d, obs, "payload.json"), join(d, "alias")); await assert.rejects(verify(d), /UNSAFE_FILE/); assert.equal(readFileSync(join(d, obs, "extra"), "utf8"), "keep");
}));
await test("unsafe storage junction cannot redirect writes", () => temporary(async d => {
  await seed(d); mkdirSync(join(d, "elsewhere")); symlinkSync(join(d, "elsewhere"), join(d, "data/runtime/options-research-observations"), "junction"); await assert.rejects(save(d), /UNSAFE_PATH|UNSAFE_DIRECTORY/); assert.deepEqual(readdirSync(join(d, "elsewhere")), []);
}));
await test("strict payload encoding duplicate keys and size bounds survive storage", () => temporary(async d => {
  await seed(d); await save(d); for (const bytes of [Buffer.from([0xff]), Buffer.from('{"x":1,"x":2}'), Buffer.from('['.repeat(33)+'0'+']'.repeat(33))]) { writeFileSync(join(d, obs, "payload.json"), bytes); await assert.rejects(verify(d), /JSON_ENCODING_OR_STRUCTURE/); }
  truncateSync(join(d, obs, "payload.json"), 128 * 1024 * 1024 + 1); await assert.rejects(verify(d), /UNSAFE_FILE/);
}));
await test("isolated fresh process recovers exactly three pairs without source journals or inputs", () => temporary(async d => temporary(async isolated => {
  await seed(d); const saved = await save(d); for (const base of [obs, prot, ctx]) { mkdirSync(join(isolated, base), { recursive: true }); for (const name of ["payload.json", "receipt.json"]) copyFileSync(join(d, base, name), join(isolated, base, name)); }
  const before = files(isolated); assert.equal(Object.keys(before).length, 6);
  const code = `import {runOptionsResearchObservationCommand as run} from './scripts/options-research-observation.mjs'; console.log(JSON.stringify(await run(['--verify','${id}'],{workspaceRoot:${JSON.stringify(isolated)}})));`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, encoding: "utf8" }); assert.equal(child.status, 0, child.stderr); const r = JSON.parse(child.stdout);
  assert.equal(r.payloadSha256, saved.payloadSha256); assert.equal(r.inspectionSha256, saved.inspectionSha256); assert.equal(r.observationAt, saved.observationAt); assert.equal(r.sourceStoresRead, false); assert.equal(r.outcomeState, null); assert.deepEqual(files(isolated), before);
})));
console.log(`${passed}/${passed} tests passed.`);
