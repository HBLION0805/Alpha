import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsContextCaptureCommand as run, CONTEXT_CAPTURE_MAX_BYTES } from "./options-context-capture.mjs";
import { withBtcContextJournal } from "./lib/options-btc-context-io.mjs";
import { BTC_CONTEXT_URL } from "../src/engines/options-btc-context/BtcSpotContextEngine.ts";

const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T20:00:00.000Z", id = "test-capture-1";
const base = d => join(d, "data/runtime/options-context-captures", id);
const options = d => ({ workspaceRoot: d, now: () => at });
const save = d => run(["--capture", id], options(d));
const verify = d => run(["--verify", id], options(d));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = (d, name) => JSON.parse(readFileSync(join(base(d), name), "utf8"));
const writeJson = (d, name, value) => writeFileSync(join(base(d), name), JSON.stringify(value, null, 2) + "\n");
function files(d) { const result = {}; function walk(p) { for (const e of readdirSync(p, { withFileTypes: true })) { const q = join(p, e.name); if (e.isDirectory()) walk(q); else result[relative(d, q)] = sha(readFileSync(q)); } } walk(d); return result; }
async function temporary(work) {
  const d = mkdtempSync(join(tmpdir(), "alpha-context-capture-test-"));
  try { await work(d); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(d)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-context-capture-test-")) throw Error("UNSAFE_TEST_CLEANUP"); rmSync(d, { recursive: true }); }
}
async function seed(d) {
  const receivedAt = "2026-09-07T04:00:00.000Z";
  await withBtcContextJournal(d, s => s.append({ requestedAt: receivedAt, receivedAt, url: BTC_CONTEXT_URL, sourceText: readFileSync(join(root, "fixtures/options-btc-context/book.synthetic.json"), "utf8"), errorCode: null }, receivedAt), receivedAt);
}
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }

await test("help and rejected arguments do not touch a missing workspace", async () => {
  const opts = options(join(root, "missing-capture-root")); assert.equal((await run(["--help"], opts)).executionAllowed, false);
  for (const args of [["--capture", id, "--at", at], ["--inspect", at], ["--verify"], ["--refresh"], ["--capture", "../escape"]]) await assert.rejects(run(args, opts));
});
await test("inspect missing stores creates no capture or source directory", () => temporary(async d => {
  const r = await run(["--inspect"], options(d)); assert.equal(r.manifest.memberCount, 0); assert.equal(r.manifest.prospectiveCaptureReceipt, false); assert.deepEqual(readdirSync(d), []);
}));
await test("actual save clock is read only after complete payload write and before receipt", () => temporary(async d => {
  await seed(d); let calls = 0;
  const now = () => {
    calls++;
    if (calls === 9) { assert(json(d, "payload.json").report.manifestSha256); assert.equal(existsSync(join(base(d), "receipt.json")), false); }
    if (calls === 11) assert(json(d, "receipt.json").payloadSavedAt);
    return new Date(Date.parse(at) + calls).toISOString();
  };
  const r = await run(["--capture", id], { workspaceRoot: d, now });
  assert.equal(calls, 11); assert(r.payloadSavedAt > r.constructedAt); assert(r.receiptPreparedAt > r.payloadSavedAt); assert(r.verifiedAt > r.receiptPreparedAt);
  assert.equal(r.memberCount, 1); assert.equal(r.captureReceiptVerified, true); assert.equal(r.historicalDecisionProven, false);
}));
await test("capture retains source bytes and verification reads only its immutable pair", () => temporary(async d => {
  await seed(d); const before = files(d), saved = await save(d);
  for (const [p, hash] of Object.entries(before)) assert.equal(files(d)[p], hash);
  const originalFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error("FORBIDDEN_SOURCE_CALL"); };
  try { const r = await verify(d); assert.equal(r.payloadSha256, saved.payloadSha256); assert.equal(r.sourceStoresRead, false); assert.equal(r.networkAccess, false); }
  finally { globalThis.fetch = originalFetch; }
}));
await test("isolated new-process recovery works without any active source journal", () => temporary(async d => temporary(async isolated => {
  await seed(d); const saved = await save(d); mkdirSync(base(isolated), { recursive: true });
  for (const name of ["payload.json", "receipt.json"]) cpSync(join(base(d), name), join(base(isolated), name));
  const code = `import {runOptionsContextCaptureCommand as run} from './scripts/options-context-capture.mjs'; console.log(JSON.stringify(await run(['--verify', '${id}'], {workspaceRoot:${JSON.stringify(isolated)}})));`;
  const result = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const r = JSON.parse(result.stdout); assert.equal(r.manifestSha256, saved.manifestSha256); assert.equal(r.memberCount, 1); assert.equal(r.sourceStoresRead, false);
})));
await test("duplicate capture never overwrites either accepted file", () => temporary(async d => {
  await save(d); const before = files(d); await assert.rejects(save(d), /ID_ALREADY_EXISTS/); assert.deepEqual(files(d), before);
}));
await test("existing receipt-only and empty directories remain incomplete without repair", () => temporary(async d => {
  mkdirSync(base(d), { recursive: true }); await assert.rejects(save(d), /ID_ALREADY_EXISTS/);
  writeFileSync(join(base(d), "receipt.json"), "old-partial"); const before = files(d);
  await assert.rejects(save(d), /ID_ALREADY_EXISTS/); await assert.rejects(verify(d), /PAIR_INCOMPLETE_OR_MISSING/); assert.deepEqual(files(d), before);
}));
await test("post-write clock failure preserves payload and prevents reuse of partial ID", () => temporary(async d => {
  let count = 0; await assert.rejects(run(["--capture", id], { workspaceRoot: d, now: () => { if (++count === 9) throw Error("SIMULATED_CLOCK_FAILURE"); return at; } }), /SIMULATED_CLOCK_FAILURE/);
  assert.equal(existsSync(join(base(d), "payload.json")), true); assert.equal(existsSync(join(base(d), "receipt.json")), false);
  const before = files(d); await assert.rejects(save(d), /ID_ALREADY_EXISTS/); await assert.rejects(verify(d), /PAIR_INCOMPLETE_OR_MISSING/); assert.deepEqual(files(d), before);
}));
await test("regressed payload-save clock cannot produce a completed receipt", () => temporary(async d => {
  let count = 0; await assert.rejects(run(["--capture", id], { workspaceRoot: d, now: () => ++count === 9 ? "2026-09-07T19:59:59.999Z" : at }), /SAVE_CLOCK_ORDER/);
  assert.equal(existsSync(join(base(d), "receipt.json")), false);
}));
await test("corrupt payload bytes are rejected without repair", () => temporary(async d => {
  await save(d); writeFileSync(join(base(d), "payload.json"), "{}\n"); const before = files(d); await assert.rejects(verify(d), /PAYLOAD_ID_OR_VERSION/); assert.deepEqual(files(d), before);
}));
await test("edited report with rebound outer byte hash still fails original engine recomputation", () => temporary(async d => {
  await save(d); const p = json(d, "payload.json"); p.report.manifest.memberCount = 99; writeJson(d, "payload.json", p);
  const r = json(d, "receipt.json"), bytes = readFileSync(join(base(d), "payload.json")); r.payloadSha256 = sha(bytes); r.payloadBytes = bytes.length; writeJson(d, "receipt.json", r);
  await assert.rejects(verify(d), /PAYLOAD_RECOMPUTATION_MISMATCH/);
}));
await test("receipt flags and foreign capture IDs cannot alter verified semantics", () => temporary(async d => {
  await save(d); const r = json(d, "receipt.json"); writeJson(d, "receipt.json", { ...r, externalTimestampAttested: true }); await assert.rejects(verify(d), /RECEIPT_RECOMPUTATION_MISMATCH/);
  writeJson(d, "receipt.json", { ...r, captureId: "different-capture" }); await assert.rejects(verify(d), /RECEIPT_ID_OR_VERSION/);
}));
await test("duplicate keys invalid UTF-8 and excessive JSON depth remain rejected", () => temporary(async d => {
  await save(d); for (const bytes of [Buffer.from('{"x":1,"x":2}'), Buffer.from([0xff]), Buffer.from('['.repeat(33)+'0'+']'.repeat(33))]) {
    writeFileSync(join(base(d), "receipt.json"), bytes); await assert.rejects(verify(d), /JSON_ENCODING_OR_STRUCTURE/);
  }
}));
await test("oversized payload is rejected before parsing and never truncated", () => temporary(async d => {
  await save(d); truncateSync(join(base(d), "payload.json"), CONTEXT_CAPTURE_MAX_BYTES + 1); await assert.rejects(verify(d), /UNSAFE_FILE/);
}));
await test("hard-linked payload is rejected without touching its alias", () => temporary(async d => {
  await save(d); const alias = join(d, "alias.json"); linkSync(join(base(d), "payload.json"), alias); const before = readFileSync(alias);
  await assert.rejects(verify(d), /UNSAFE_FILE/); assert.deepEqual(readFileSync(alias), before);
}));
await test("extra pair entries are preserved and rejected", () => temporary(async d => {
  await save(d); writeFileSync(join(base(d), "extra.txt"), "keep"); await assert.rejects(verify(d), /PAIR_ENTRIES/); assert.equal(readFileSync(join(base(d), "extra.txt"), "utf8"), "keep");
}));
await test("runtime junction cannot redirect capture writes or pair recovery", () => temporary(async d => {
  const target = join(d, "unrelated"); mkdirSync(target); mkdirSync(join(d, "data")); symlinkSync(target, join(d, "data/runtime"), "junction");
  await assert.rejects(save(d), /UNSAFE_PATH|UNSAFE_DIRECTORY/); await assert.rejects(verify(d), /UNSAFE_PATH/);
  assert.deepEqual(readdirSync(target), []);
}));
await test("verification clock cannot precede receipt preparation", () => temporary(async d => {
  await save(d); await assert.rejects(run(["--verify", id], { workspaceRoot: d, now: () => "2026-09-07T19:59:59.999Z" }), /VERIFICATION_CLOCK_ORDER/);
}));
await test("missing and corrupt stores are retained as gaps in a valid local capture", () => temporary(async d => {
  const source = join(d, "data/runtime/options-btc-context"); mkdirSync(source, { recursive: true }); writeFileSync(join(source, "retrievals.ndjson"), "PRIVATE_CORRUPT_JOURNAL");
  const r = await save(d); assert.deepEqual(r.blockedStores, ["btc"]); assert.equal(r.missingStores.length, 4); assert.equal(r.memberCount, 0); assert.equal(r.globalKnowledgeCoverageComplete, false);
  assert(!JSON.stringify(r).includes("PRIVATE")); assert.equal(readFileSync(join(source, "retrievals.ndjson"), "utf8"), "PRIVATE_CORRUPT_JOURNAL");
}));
console.log(`${passed}/${passed} tests passed.`);
