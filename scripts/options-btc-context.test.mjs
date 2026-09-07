import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { appendFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { retrieveBtcContext, withBtcContextJournal } from "./lib/options-btc-context-io.mjs";
import { reportBtcContext, btcContextFingerprint, BTC_CONTEXT_URL } from "../src/engines/options-btc-context/BtcSpotContextEngine.ts";

const root = resolve(import.meta.dirname, ".."), source = readFileSync(join(root, "fixtures/options-btc-context/book.synthetic.json"), "utf8");
const at = "2026-09-07T04:00:01.000Z", later = "2026-09-07T04:01:01.000Z";
const input = (time = at) => ({ requestedAt: time, receivedAt: time, url: BTC_CONTEXT_URL, sourceText: source, errorCode: null });
const response = (body = source, extra = {}) => new Response(body, { headers: { "content-type": "application/json; charset=UTF-8" }, ...extra });
const retrieve = fetchImplementation => retrieveBtcContext({ fetchImplementation, clock: () => at });
const journal = (directory, operation, time = later) => withBtcContextJournal(directory, operation, time);
async function temporary(work) {
  const directory = mkdtempSync(join(tmpdir(), "alpha-btc-test-"));
  try { await work(directory); } finally {
    const rel = relative(tmpdir(), directory);
    if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-btc-test-")) throw Error("UNSAFE_TEST_CLEANUP");
    rmSync(directory, { recursive: true });
  }
}
function rewrite(path, change, rehash = false) {
  const records = readFileSync(path, "utf8").trimEnd().split("\n").map(JSON.parse);
  change(records);
  if (rehash) { let previous = null; for (const record of records) { record.previousFingerprint = previous; const { fingerprint, ...body } = record; record.fingerprint = btcContextFingerprint(body); previous = record.fingerprint; } }
  writeFileSync(path, records.map(r => JSON.stringify(r)).join("\n") + "\n");
}
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test("one fixed public BTC-USD call has no credentials or redirects", async () => {
  let count = 0; const r = await retrieve(async (url, options) => { count++; assert.equal(url, BTC_CONTEXT_URL); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "manual"); assert(!Object.keys(options.headers).some(k => /authorization|cookie/i.test(k))); return response(); });
  assert.equal(count, 1); assert.equal(r.assessment.status, "OBSERVED_CONTEXT"); assert.equal(r.input.sourceText, source);
});
await test("source and receipt clocks are sampled independently", async () => { let ticks = 0; const r = await retrieveBtcContext({ clock: () => ticks++ ? later : at, fetchImplementation: async () => response() }); assert.equal(r.input.requestedAt, at); assert.equal(r.input.receivedAt, later); assert.equal(r.assessment.status, "UNUSABLE_CONTEXT"); });
await test("bad request clocks and configuration fail before a call", async () => { let calls = 0; const fetchImplementation = async () => { calls++; return response(); }; await assert.rejects(retrieveBtcContext({ clock: () => "bad", fetchImplementation }), /CLOCK/); for (const deadlineMs of [0, 12001, NaN, 1.5]) await assert.rejects(retrieveBtcContext({ deadlineMs, fetchImplementation }), /CONFIGURATION/); assert.equal(calls, 0); });
await test("status errors and redirects never read provider bodies", async () => { for (const status of [302, 401, 429, 500]) { let read = false; const r = await retrieve(async () => ({ status, get body() { read = true; throw Error("secret"); } })); assert.equal(r.input.errorCode, "HTTP_STATUS"); assert.equal(read, false); } assert.equal((await retrieve(async () => ({ status: 200, redirected: true }))).input.errorCode, "HTTP_STATUS"); });
await test("network failures are sanitized fixed-code evidence", async () => { const r = await retrieve(async () => { throw Error("PRIVATE_INSTRUCTION"); }); assert.equal(r.input.errorCode, "NETWORK_FAILED"); assert(!JSON.stringify(r).includes("PRIVATE")); });
await test("content type and declared body limits reject before parsing", async () => { for (const [headers, code] of [[{ "content-type": "text/html" }, "CONTENT_TYPE"], [{ "content-type": "application/json; charset=latin1" }, "CONTENT_TYPE"], [{ "content-type": "application/json", "content-length": "16385" }, "BODY_TOO_LARGE"]]) assert.equal((await retrieve(async () => response("private", { headers }))).input.errorCode, code); });
await test("streamed overflow and UTF8 corruption cannot become source evidence", async () => { assert.equal((await retrieve(async () => response("x".repeat(16385)))).input.errorCode, "BODY_TOO_LARGE"); assert.equal((await retrieve(async () => response(new Uint8Array([0xc3, 0x28])))).input.errorCode, "INVALID_UTF8"); });
await test("empty body and malformed source return distinct sanitized failures", async () => { assert.equal((await retrieve(async () => response(""))).input.errorCode, "BODY_MISSING"); const r = await retrieve(async () => response('{"instructions":"IGNORE_LIMITS"}')); assert.equal(r.input.errorCode, "SOURCE_SCHEMA"); assert.equal(r.input.sourceText, null); assert(!JSON.stringify(r).includes("IGNORE")); });
await test("well-formed unusable books keep original evidence", async () => { const raw = source.replace('"bids":[["80000.00","0.12345678",3]]', '"bids":[]'); const r = await retrieve(async () => response(raw)); assert.equal(r.assessment.status, "UNUSABLE_CONTEXT"); assert.equal(r.input.sourceText, raw); });
await test("a stalled HTTP operation is bounded by the total deadline", async () => { const r = await retrieveBtcContext({ fetchImplementation: () => new Promise(() => {}), clock: () => at, deadlineMs: 5 }); assert.equal(r.input.errorCode, "DEADLINE_EXCEEDED"); });
await test("a stalled response body shares the total deadline", async () => { const r = await retrieveBtcContext({ fetchImplementation: async () => response(new ReadableStream({ start() {} })), clock: () => at, deadlineMs: 5 }); assert.equal(r.input.errorCode, "DEADLINE_EXCEEDED"); });
await test("receipt rollback fails before journal input is returned", async () => { let ticks = 0; await assert.rejects(retrieveBtcContext({ fetchImplementation: async () => response(), clock: () => ticks++ ? at : later }), /CLOCK_ROLLBACK/); });
await test("append and reopen reproduce raw source, hash chain and assessment", () => temporary(async directory => {
  let path, receipt; await journal(directory, store => { path = store.path; receipt = store.append(input(), at); });
  const bytes = readFileSync(path); await journal(directory, store => { assert.equal(store.previousFingerprint, receipt.fingerprint); assert.equal(store.inputs[0].sourceText, source); assert.equal(reportBtcContext(store.inputs, later).retrievalCount, 1); }); assert.deepEqual(readFileSync(path), bytes);
}));
await test("input mutation after append cannot change accepted state", () => temporary(async directory => { const original = input(); await journal(directory, store => { store.append(original, at); original.sourceText = "changed"; }); await journal(directory, store => assert.equal(store.inputs[0].sourceText, source)); }));
await test("writer lock blocks concurrent ownership without deleting it", () => temporary(async directory => { await journal(directory, async store => { await assert.rejects(journal(directory, () => {}), error => error.code === "EEXIST"); assert(existsSync(join(store.directory, "writer.lock"))); }); }));
await test("escaped append capability expires after success and after exception", () => temporary(async directory => { let append; await journal(directory, store => { append = store.append; }); assert.throws(() => append(input(), at), /SCOPE_CLOSED/); await assert.rejects(journal(directory, store => { append = store.append; throw Error("test"); }), /test/); assert.throws(() => append(input(), at), /SCOPE_CLOSED/); }));
await test("complete write followed by fsync failure poisons retries and recovers once", () => temporary(async directory => {
  await journal(directory, store => { const original = fs.fsyncSync; fs.fsyncSync = () => { throw Error("TEST_SYNC_FAILURE"); }; syncBuiltinESMExports(); try { assert.throws(() => store.append(input(), at), /TEST_SYNC_FAILURE/); } finally { fs.fsyncSync = original; syncBuiltinESMExports(); } assert.throws(() => store.append(input(), at), /UNCERTAIN/); });
  await journal(directory, store => assert.equal(store.inputs.length, 1));
}));
await test("partial append stays intact, poisons retries and blocks restart", () => temporary(async directory => {
  let path; await journal(directory, store => { path = store.path; const original = fs.appendFileSync; fs.appendFileSync = (file, line, options) => { original(file, line.slice(0, 30), options); throw Error("TEST_PARTIAL"); }; syncBuiltinESMExports(); try { assert.throws(() => store.append(input(), at), /TEST_PARTIAL/); } finally { fs.appendFileSync = original; syncBuiltinESMExports(); } assert.throws(() => store.append(input(), at), /UNCERTAIN/); });
  const bytes = readFileSync(path); await assert.rejects(journal(directory, () => {}), /TRUNCATED/); assert.deepEqual(readFileSync(path), bytes);
}));
await test("tampered checksums and recomputed false assessments both fail", () => temporary(async directory => {
  let path; await journal(directory, store => { path = store.path; store.append(input(), at); }); const valid = readFileSync(path);
  rewrite(path, rows => { rows[0].assessment.midpointUsd = "1"; }); await assert.rejects(journal(directory, () => {}), /INTEGRITY/);
  writeFileSync(path, valid); rewrite(path, rows => { rows[0].assessment.midpointUsd = "1"; }, true); await assert.rejects(journal(directory, () => {}), /ASSESSMENT/);
}));
await test("corrupt shape and oversize journal block without rewriting", () => temporary(async directory => {
  let path; await journal(directory, store => { path = store.path; }); for (const content of ["null\n", "{bad}\n", "x".repeat(16 * 1024 * 1024 + 1)]) { writeFileSync(path, content); await assert.rejects(journal(directory, () => {})); assert.equal(readFileSync(path, "utf8"), content); }
}));
await test("hard-linked journal is rejected", () => temporary(async directory => { let path; await journal(directory, store => { path = store.path; store.append(input(), at); }); linkSync(path, join(directory, "other.ndjson")); await assert.rejects(journal(directory, () => {}), /UNSAFE/); }));
await test("directory junction cannot redirect a context journal", () => temporary(async directory => { const external = join(directory, "outside"), runtime = join(directory, "data", "runtime"); mkdirSync(external); mkdirSync(runtime, { recursive: true }); symlinkSync(external, join(runtime, "options-btc-context"), "junction"); await assert.rejects(journal(directory, () => {}), /UNSAFE/); assert.equal(existsSync(join(external, "writer.lock")), false); }));
await test("overlapping chronology is rejected before bytes change", () => temporary(async directory => { let path; await journal(directory, store => { path = store.path; store.append(input(later), later); }); const bytes = readFileSync(path); await journal(directory, store => assert.throws(() => store.append(input(), later), /HISTORY_CLOCK/)); assert.deepEqual(readFileSync(path), bytes); }));
await test("sanitized failure records recover independently of old usable prices", () => temporary(async directory => { await journal(directory, store => { store.append(input(), at); store.append({ ...input(later), sourceText: null, errorCode: "NETWORK_FAILED" }, later); }); await journal(directory, store => { const r = reportBtcContext(store.inputs, later); assert.equal(r.latestRetrieval.status, "FAILED"); assert.equal(r.lastKnownObservation.fromLatestRetrieval, false); }); }));
await test("CLI rejects arbitrary products, URLs and arguments without network", () => { for (const args of [["--url", "https://example.invalid"], ["--refresh", "ETH-USD"], ["--unknown"]]) { const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/options-btc-context.mjs", ...args], { cwd: root, encoding: "utf8" }); assert.equal(result.status, 2); assert.equal(JSON.parse(result.stderr.trim()).code, "BTC_CONTEXT_ARGUMENTS"); } const help = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/options-btc-context.mjs", "--help"], { cwd: root, encoding: "utf8" }); assert.equal(help.status, 0); assert(help.stdout.includes("Single venue")); });
console.log(`${passed}/${passed} tests passed.`);
