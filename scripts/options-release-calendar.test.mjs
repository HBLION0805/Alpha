import assert from "node:assert/strict";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { appendFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { retrieveReleaseCalendar, withReleaseCalendarJournal } from "./lib/options-release-calendar-io.mjs";
import { reportReleaseCalendar, releaseCalendarFingerprint, releaseCalendarUrl } from "../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts";

const root = resolve(import.meta.dirname, ".."), ics = readFileSync(join(root, "fixtures/options-release-calendar/calendar.synthetic.ics"), "utf8");
const at = "2026-09-07T03:00:00.000Z", later = "2026-09-07T04:00:00.000Z";
const input = (sourceText = ics, time = at) => ({ requestedAt: time, receivedAt: time, url: releaseCalendarUrl(time), sourceText, errorCode: null });
const response = (body = ics, extra = {}) => new Response(body, { headers: { "content-type": "text/calendar; charset=UTF-8" }, ...extra });
const retrieve = fetchImplementation => retrieveReleaseCalendar({ fetchImplementation, clock: () => at });
const journal = (directory, operation, time = later) => withReleaseCalendarJournal(directory, operation, time);
async function temporary(work) {
  const directory = mkdtempSync(join(tmpdir(), "alpha-release-calendar-test-"));
  try { await work(directory); } finally {
    const rel = relative(tmpdir(), directory);
    if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-release-calendar-test-")) throw Error("UNSAFE_TEST_CLEANUP");
    rmSync(directory, { recursive: true });
  }
}
function rewrite(path, change, rehash = false) {
  const records = readFileSync(path, "utf8").trimEnd().split("\n").map(JSON.parse);
  change(records);
  if (rehash) { let previous = null; for (const record of records) { record.previousFingerprint = previous; const { fingerprint, ...body } = record; record.fingerprint = releaseCalendarFingerprint(body); previous = record.fingerprint; } }
  writeFileSync(path, records.map(r => JSON.stringify(r)).join("\n") + "\n");
}
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test("one fixed BLS calendar request omits credentials and forbids redirects", async () => {
  let count = 0; const r = await retrieve(async (url, options) => { count++; assert.equal(url, releaseCalendarUrl(at)); assert.equal(options.credentials, "omit"); assert.equal(options.redirect, "manual"); assert(!Object.keys(options.headers).some(k => /authorization|cookie/i.test(k))); return response(); });
  assert.equal(count, 1); assert.equal(r.assessment.status, "OBSERVED_SCHEDULE"); assert.equal(r.input.sourceText, ics);
});
await test("request and receipt preserve separate actual clock samples", async () => {
  let ticks = 0; const r = await retrieveReleaseCalendar({ clock: () => ticks++ ? later : at, fetchImplementation: async () => response() });
  assert.equal(r.input.requestedAt, at); assert.equal(r.input.receivedAt, later);
});
await test("request scope is validated before HTTP starts", async () => {
  let calls = 0; await assert.rejects(retrieveReleaseCalendar({ clock: () => "bad", fetchImplementation: async () => { calls++; return response(); } }), /CLOCK/); assert.equal(calls, 0);
});
await test("provider errors are sanitized without reading bodies or following redirects", async () => {
  for (const status of [302, 401, 429, 500]) { let read = false; const r = await retrieve(async () => ({ status, get body() { read = true; throw Error("secret"); } })); assert.equal(r.input.errorCode, "HTTP_STATUS"); assert.equal(r.input.sourceText, null); assert.equal(read, false); }
});
await test("network exceptions retain a fixed code without provider details", async () => { const r = await retrieve(async () => { throw Error("PRIVATE_TOKEN_VALUE"); }); assert.equal(r.input.errorCode, "NETWORK_FAILED"); assert(!JSON.stringify(r).includes("PRIVATE")); });
await test("mismatched types and declared size overflow reject", async () => {
  for (const [headers, code] of [[{ "content-type": "text/html" }, "CONTENT_TYPE"], [{ "content-type": "application/ics; charset=latin1" }, "CONTENT_TYPE"], [{ "content-type": "text/calendar", "content-length": "524289" }, "BODY_TOO_LARGE"]]) assert.equal((await retrieve(async () => response("private", { headers }))).input.errorCode, code);
});
await test("decoded streaming size is bounded even without Content-Length", async () => { const r = await retrieve(async () => response("x".repeat(524289))); assert.equal(r.input.errorCode, "BODY_TOO_LARGE"); assert.equal(r.input.sourceText, null); });
await test("malformed UTF-8 fails rather than using replacement characters", async () => { const r = await retrieve(async () => response(new Uint8Array([0xc3, 0x28]))); assert.equal(r.input.errorCode, "INVALID_UTF8"); });
await test("empty body and empty valid calendar are distinct", async () => { assert.equal((await retrieve(async () => response(""))).input.errorCode, "BODY_MISSING"); const r = await retrieve(async () => response(ics.replace(/BEGIN:VEVENT\n[\s\S]*?END:VEVENT\n/g, ""))); assert.equal(r.assessment.status, "EMPTY_SCHEDULE"); assert.equal(r.input.errorCode, null); });
await test("malformed source is health only and cannot leak instructions", async () => { const r = await retrieve(async () => response("<feed>PRIVATE_INSTRUCTION</feed>")); assert.equal(r.input.errorCode, "SOURCE_SCHEMA"); assert.equal(r.input.sourceText, null); assert(!JSON.stringify(r).includes("PRIVATE")); });
await test("a stalled HTTP operation is cut off by a bounded deadline", async () => { const r = await retrieveReleaseCalendar({ fetchImplementation: () => new Promise(() => {}), clock: () => at, deadlineMs: 5 }); assert.equal(r.input.errorCode, "DEADLINE_EXCEEDED"); });
await test("a stalled body is bounded by the same request deadline", async () => { const r = await retrieveReleaseCalendar({ fetchImplementation: async () => ({ status: 200, headers: new Headers({ "content-type": "text/calendar" }), body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => {} }) } }), clock: () => at, deadlineMs: 5 }); assert.equal(r.input.errorCode, "DEADLINE_EXCEEDED"); });
await test("clock rollback fails rather than recording invented receipt time", async () => { let i = 0; await assert.rejects(retrieveReleaseCalendar({ fetchImplementation: async () => response(), clock: () => i++ ? at : later }), /CLOCK_ROLLBACK/); });
await test("journal stores exact source, assessment and a linked restartable history", () => temporary(async directory => {
  let path, first; await journal(directory, s => { path = s.path; first = s.append(input(), at); });
  await journal(directory, s => { assert.equal(s.inputs[0].sourceText, ics); assert.equal(s.previousFingerprint, first.fingerprint); s.append(input(ics.replace("20260910T083000", "20260910T100000"), later), later); });
  await journal(directory, s => { assert.equal(s.inputs.length, 2); assert.equal(reportReleaseCalendar(s.inputs, later).comparison.changes.length, 1); });
  const records = readFileSync(path, "utf8").trimEnd().split("\n").map(JSON.parse); assert.equal(records[1].previousFingerprint, records[0].fingerprint);
}));
await test("failed source attempts survive recovery but cannot carry raw errors", () => temporary(async directory => {
  const r = await retrieve(async () => { throw Error("private"); }); await journal(directory, s => s.append(r.input, at));
  await journal(directory, s => { assert.equal(s.inputs[0].sourceText, null); assert.equal(reportReleaseCalendar(s.inputs, later).latestRetrieval.status, "FAILED"); });
}));
await test("checksum damage and truncated tail fail without rewriting history", () => temporary(async directory => {
  let path; await journal(directory, s => { path = s.path; s.append(input(), at); }); const original = readFileSync(path, "utf8");
  rewrite(path, rs => { rs[0].input.sourceText += " "; }); await assert.rejects(journal(directory, () => {}), /INTEGRITY/);
  writeFileSync(path, original); appendFileSync(path, "{"); await assert.rejects(journal(directory, () => {}), /TRUNCATED/); assert.equal(readFileSync(path, "utf8"), original + "{");
}));
await test("rehashed stored assessments must still match recomputed calendar", () => temporary(async directory => {
  let path; await journal(directory, s => { path = s.path; s.append(input(), at); }); rewrite(path, rs => { rs[0].assessment.events[0].scheduledAt = "2026-09-10T14:00:00.000Z"; }, true);
  await assert.rejects(journal(directory, () => {}), /ASSESSMENT/);
}));
await test("rehashed unknown envelope fields remain invalid", () => temporary(async directory => {
  let path; await journal(directory, s => { path = s.path; s.append(input(), at); }); rewrite(path, rs => { rs[0].extra = true; }, true); await assert.rejects(journal(directory, () => {}), /INTEGRITY/);
}));
await test("concurrent writers fail without removing the held lock", () => temporary(async directory => {
  await journal(directory, async s => { await assert.rejects(journal(directory, () => {}), /EEXIST/); assert(existsSync(join(s.directory, "writer.lock"))); });
  await journal(directory, () => {});
}));
await test("callback errors release only this writer's lock", () => temporary(async directory => {
  await assert.rejects(journal(directory, () => { throw Error("CALLBACK_FAILED"); }), /CALLBACK_FAILED/); await journal(directory, () => {});
}));
await test("stale or overlapping retrieval clocks cannot be appended", () => temporary(async directory => {
  await journal(directory, s => { s.append(input(ics, later), later); assert.throws(() => s.append(input(), later), /HISTORY_CLOCK/); }); await journal(directory, s => assert.equal(s.inputs.length, 1));
}));
await test("recovery rejects stored observations from the future", () => temporary(async directory => {
  await journal(directory, s => s.append(input(ics, later), later)); await assert.rejects(journal(directory, () => {}, at), /HISTORY_CLOCK/);
}));
await test("A to B to A revisions and first sightings survive restarts", () => temporary(async directory => {
  const third = "2026-09-07T05:00:00.000Z";
  await journal(directory, s => s.append(input(), at)); await journal(directory, s => s.append(input(ics.replace("20260910T083000", "20260910T100000"), later), later));
  await journal(directory, s => s.append(input(ics, third), third), third);
  await journal(directory, s => { const r = reportReleaseCalendar(s.inputs, third); assert.equal(r.retrievalCount, 3); assert.equal(r.comparison.changes.length, 1); assert.equal(r.comparison.changes[0].observedAt, third); }, third);
}));
await test("a hard-linked journal is rejected before append", () => temporary(async directory => {
  let path; await journal(directory, s => { path = s.path; s.append(input(), at); }); linkSync(path, join(directory, "alias.ndjson")); await assert.rejects(journal(directory, () => {}), /UNSAFE/);
}));
await test("directory junctions cannot redirect the runtime journal", () => temporary(async directory => {
  const target = join(directory, "other"), data = join(directory, "data"); mkdirSync(target); symlinkSync(target, data, process.platform === "win32" ? "junction" : "dir"); await assert.rejects(journal(directory, () => {}), /UNSAFE_STORE_DIRECTORY/);
}));
await test("oversized journals fail before parsing or reading body", () => temporary(async directory => {
  let path; await journal(directory, s => { path = s.path; s.append(input(), at); }); truncateSync(path, 32 * 1024 * 1024 + 1); await assert.rejects(journal(directory, () => {}), /OVERSIZED/);
}));
await test("caller mutation does not change staged history used by append", () => temporary(async directory => {
  await journal(directory, s => { const original = input(); s.append(original, at); original.sourceText = "corrupt"; s.inputs.push(input("corrupt")); s.append(input(ics, later), later); });
  await journal(directory, s => { assert.equal(s.inputs.length, 2); assert.equal(s.inputs[0].sourceText, ics); });
}));
await test("CLI rejects arbitrary URLs, dates, roots and trading modes before any retrieval", () => {
  for (const args of [["--url", "https://example.com"], ["--refresh", "--date", "2026-09-01"], ["--root", "other"], ["--trade"]]) {
    const r = spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/options-release-calendar.mjs"), ...args], { encoding: "utf8", timeout: 30000 });
    assert.equal(r.status, 2); assert.equal(JSON.parse(r.stderr.trim()).code, "RELEASE_CALENDAR_ARGUMENTS");
  }
});
await test("CLI help is local and states source limits", () => {
  const r = spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/options-release-calendar.mjs"), "--help"], { encoding: "utf8", timeout: 30000 }); assert.equal(r.status, 0); assert.match(r.stdout, /Scheduled releases only/);
});
await test("append capability expires when the writer callback has returned", () => temporary(async directory => {
  const escaped = await journal(directory, s => s);
  assert.throws(() => escaped.append(input(), at), /SCOPE_CLOSED/);
  await journal(directory, s => assert.equal(s.inputs.length, 0));
}));
await test("uncertain persistence blocks another append until verified recovery", () => temporary(async directory => {
  await journal(directory, s => {
    const original = fs.fsyncSync;
    fs.fsyncSync = () => { throw Error("SIMULATED_SYNC_FAILURE"); }; syncBuiltinESMExports();
    try { assert.throws(() => s.append(input(), at), /SIMULATED_SYNC_FAILURE/); }
    finally { fs.fsyncSync = original; syncBuiltinESMExports(); }
    assert.throws(() => s.append(input(ics, later), later), /WRITE_UNCERTAIN/);
  });
  await journal(directory, s => { assert.equal(s.inputs.length, 1); s.append(input(ics, later), later); });
  await journal(directory, s => assert.equal(s.inputs.length, 2));
}));
await test("partial append faults leave the journal for explicit recovery review", () => temporary(async directory => {
  let path;
  await journal(directory, s => {
    path = s.path;
    const original = fs.appendFileSync;
    fs.appendFileSync = (file, body, options) => { original(file, String(body).slice(0, 15), options); throw Error("SIMULATED_PARTIAL_WRITE"); }; syncBuiltinESMExports();
    try { assert.throws(() => s.append(input(), at), /SIMULATED_PARTIAL_WRITE/); }
    finally { fs.appendFileSync = original; syncBuiltinESMExports(); }
    assert.throws(() => s.append(input(), at), /WRITE_UNCERTAIN/);
  });
  const bytes = readFileSync(path);
  await assert.rejects(journal(directory, () => {}), /TRUNCATED/);
  assert.deepEqual(readFileSync(path), bytes);
}));
console.log(`${passed}/${passed} tests passed.`);
