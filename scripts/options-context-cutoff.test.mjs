import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsContextCutoffCommand as run, loadOptionsContextCutoffHistories } from "./options-context-cutoff.mjs";
import { buildOptionsContextManifest } from "../src/engines/options-readiness/OptionsContextManifest.ts";
import { withDriverJournal } from "./lib/options-driver-io.mjs";
import { withTreasuryJournal } from "./lib/options-treasury-io.mjs";
import { withBtcContextJournal } from "./lib/options-btc-context-io.mjs";
import { withReleaseCalendarJournal } from "./lib/options-release-calendar-io.mjs";
import { withFomcCalendarJournal } from "./lib/options-fomc-calendar-io.mjs";
import { FOMC_CALENDAR_URL } from "../src/engines/options-fomc-calendar/FomcCalendarEngine.ts";
import { createDriverObservation, buildOptionsDriverReport } from "../src/engines/options-drivers/OptionsDriverMonitorEngine.ts";
import { treasuryUrl } from "../src/engines/options-treasury/TreasuryRealYieldEngine.ts";
import { BTC_CONTEXT_URL } from "../src/engines/options-btc-context/BtcSpotContextEngine.ts";
import { RELEASE_CALENDAR_URL } from "../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts";

const root = resolve(import.meta.dirname, ".."), early = "2026-09-07T04:00:01.000Z", cutoff = "2026-09-07T04:30:00.000Z", later = "2026-09-07T05:00:00.000Z", checked = "2026-09-07T06:00:00.000Z";
const paths = { headlines: "options-driver-monitor/refreshes.ndjson", treasury: "options-treasury-rates/retrievals.ndjson", btc: "options-btc-context/retrievals.ndjson", blsCalendar: "options-release-calendar/retrievals.ndjson" };
const file = (directory, id) => join(directory, "data/runtime", paths[id]);
const read = (directory, at = cutoff) => run(["--at", at], { workspaceRoot: directory, now: () => checked });
const fixtures = { treasury: "options-treasury/real-yields.synthetic.xml", btc: "options-btc-context/book.synthetic.json", blsCalendar: "options-release-calendar/calendar.synthetic.ics" };
const source = id => readFileSync(join(root, "fixtures", fixtures[id]), "utf8");
async function temporary(work) {
  const directory = mkdtempSync(join(tmpdir(), "alpha-context-cutoff-test-"));
  try { await work(directory); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(directory)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-context-cutoff-test-")) throw Error("UNSAFE_TEST_CLEANUP"); rmSync(directory, { recursive: true }); }
}
async function seed(directory) {
  const observation = createDriverObservation({ sourceId: "fed", itemId: "cutoff-source", headline: "Monetary policy rates decision", link: "https://www.federalreserve.gov/", publishedAt: "2026-09-06T12:00:00.000Z", observedAt: early, origin: "PUBLIC_FEED" });
  withDriverJournal(directory, s => s.appendBatch([observation], [{ sourceId: "fed", status: "OK", observedAt: early, itemsReceived: 1, truncated: false, diagnostic: null }]));
  await withTreasuryJournal(directory, s => s.append({ requestedAt: early, receivedAt: early, url: treasuryUrl(early), sourceText: source("treasury"), errorCode: null }, early), early);
  await withBtcContextJournal(directory, s => s.append({ requestedAt: early, receivedAt: early, url: BTC_CONTEXT_URL, sourceText: source("btc"), errorCode: null }, early), early);
  await withReleaseCalendarJournal(directory, s => s.append({ requestedAt: later, receivedAt: later, url: RELEASE_CALENDAR_URL, sourceText: source("blsCalendar"), errorCode: null }, later), later);
}
function files(directory) { const result = {}; const walk = p => { for (const e of readdirSync(p, { withFileTypes: true })) { const path = join(p, e.name); if (e.isDirectory()) walk(path); else result[relative(directory, path)] = createHash("sha256").update(readFileSync(path)).digest("hex"); } }; walk(directory); return result; }
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test("four stores recover independently with exact receipt-time selection and unchanged bytes", () => temporary(async d => {
  await seed(d); const before = files(d), r = await read(d); assert.deepEqual(r.blockedStores, []); assert.deepEqual(r.missingStores, []);
  assert.equal(r.context.components.headlines.report.observationsInHistory, 1); assert.equal(r.context.components.treasury.report.retrievalCount, 1); assert.equal(r.context.components.btc.report.retrievalCount, 1); assert.equal(r.context.components.blsCalendar.report.retrievalCount, 0); assert.equal(r.context.components.blsCalendar.state, "AVAILABLE"); assert.deepEqual(files(d), before);
}));
await test("missing stores stay absent without new directories or report files", () => temporary(async d => { const r = await read(d); assert.equal(r.missingStores.length, 4); assert.equal(existsSync(join(d, "data")), false); assert.equal(r.reportFilesCreated, false); }));
await test("later legitimate appends preserve earlier context and older source report hashes", () => temporary(async d => {
  await seed(d); const a = await read(d); await withTreasuryJournal(d, s => s.append({ requestedAt: later, receivedAt: later, url: treasuryUrl(later), sourceText: source("treasury").replace("1.90", "1.91"), errorCode: null }, later), later);
  const b = await run(["--at", cutoff], { workspaceRoot: d, now: () => "2026-09-07T07:00:00.000Z" }); assert.equal(a.contextSha256, b.contextSha256); assert.notEqual(a.artifactSha256, b.artifactSha256);
}));
await test("old headline report behavior is unchanged after using the new consumer", () => temporary(async d => { await seed(d); const original = () => withDriverJournal(d, s => buildOptionsDriverReport(s.observations, s.health, checked)); const a = original(); await read(d); assert.deepEqual(original(), a); }));
await test("corrupt later records block their source without leaking private text", () => temporary(async d => { await seed(d); writeFileSync(file(d, "btc"), "{PRIVATE_SOURCE_ERROR"); const r = await read(d); assert.deepEqual(r.blockedStores, ["btc"]); assert.equal(r.context.components.btc.errorCode, "RECOVERY_FAILED"); assert(!JSON.stringify(r).includes("PRIVATE")); assert.equal(readFileSync(file(d, "btc"), "utf8"), "{PRIVATE_SOURCE_ERROR"); }));
await test("recovered but invalid headline payload blocks before prefix selection", () => temporary(async d => { await seed(d); withDriverJournal(d, s => s.appendBatch([{ PRIVATE: "BAD" }], [])); const r = await read(d); assert.deepEqual(r.blockedStores, ["headlines"]); assert.equal(r.context.components.headlines.errorCode, "HISTORY_VALIDATION_FAILED"); assert(!JSON.stringify(r).includes("PRIVATE")); }));
await test("held source locks are retained and each other store still recovers", () => temporary(async d => { await seed(d); const lock = join(d, "data/runtime/options-treasury-rates/writer.lock"); writeFileSync(lock, "held"); const r = await read(d); assert.deepEqual(r.blockedStores, ["treasury"]); assert.equal(r.context.components.treasury.errorCode, "STORE_BUSY"); assert.equal(readFileSync(lock, "utf8"), "held"); assert.equal(r.context.components.btc.state, "AVAILABLE"); }));
await test("hard-linked source is blocked before any journal recovery", () => temporary(async d => { await seed(d); linkSync(file(d, "headlines"), join(d, "alias")); const r = await read(d); assert.deepEqual(r.blockedStores, ["headlines"]); assert.equal(r.context.components.headlines.errorCode, "STORE_UNSAFE"); }));
await test("oversized calendar is isolated without truncation or repair", () => temporary(async d => { await seed(d); truncateSync(file(d, "blsCalendar"), 32 * 1024 * 1024 + 1); const r = await read(d); assert.deepEqual(r.blockedStores, ["blsCalendar"]); assert.equal(r.context.components.blsCalendar.errorCode, "STORE_UNSAFE"); }));
await test("runtime junction cannot redirect any component into another directory", () => temporary(async d => { const other = join(d, "other"); mkdirSync(other); symlinkSync(other, join(d, "data"), process.platform === "win32" ? "junction" : "dir"); const r = await read(d); assert.equal(r.blockedStores.length, 4); assert.deepEqual(readdirSync(other), []); }));
await test("cutoff reconstruction never invokes network retrieval", () => temporary(async d => { await seed(d); const original = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls++; throw Error("FORBIDDEN"); }; try { assert.equal((await read(d)).networkAccess, false); assert.equal(calls, 0); } finally { globalThis.fetch = original; } }));
await test("failed retrieval by cutoff remains failed after repository recovery", () => temporary(async d => { await seed(d); await withBtcContextJournal(d, s => s.append({ requestedAt: cutoff, receivedAt: cutoff, url: BTC_CONTEXT_URL, sourceText: null, errorCode: "NETWORK_FAILED" }, cutoff), cutoff); const r = await read(d); assert.equal(r.context.components.btc.report.latestRetrieval.status, "FAILED"); assert.equal(r.context.components.btc.report.displayFresh, false); }));
await test("future and malformed cutoff and unsupported arguments fail before filesystem use", () => { const options = { workspaceRoot: join(root, "does-not-exist-cutoff"), now: () => checked }; return Promise.all([
  assert.rejects(run(["--at", "2026-09-08T00:00:00.000Z"], options), /FUTURE_CUTOFF/), assert.rejects(run(["--at", "today"], options), /CLOCK/),
  ...[["--refresh"], ["--at", cutoff, "--root", "other"], ["--at"], ["--url", "https://private.invalid"]].map(args => assert.rejects(run(args, options), /ARGUMENTS/))]); });
await test("recovery clocks cannot regress even for absent stores", () => temporary(async d => { let i = 0; const clocks = [checked, checked, "2026-09-07T05:59:59.000Z"]; await assert.rejects(run(["--at", cutoff], { workspaceRoot: d, now: () => clocks[i++] ?? checked }), /CHECK_CLOCK_ORDER/); assert.deepEqual(readdirSync(d), []); }));
await test("CLI help documents restricted reconstruction without opening any store", () => { const r = spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/options-context-cutoff.mjs"), "--help"], { encoding: "utf8", timeout: 30000 }); assert.equal(r.status, 0); assert.match(JSON.parse(r.stdout).meaning, /No network, source writes/); });
const fomcPath = d => join(d, "data/runtime/options-fomc-calendar/retrievals.ndjson");
const fomcSource = readFileSync(join(root, "fixtures/options-fomc-calendar/calendar.synthetic.html"), "utf8");
const fomcInput = (receivedAt = cutoff) => ({ requestedAt: receivedAt, receivedAt, url: FOMC_CALENDAR_URL, sourceText: fomcSource, errorCode: null });
const appendFomc = (d, input = fomcInput()) => withFomcCalendarJournal(d, s => s.append(input, checked), checked);
const readV2 = (d, at = cutoff) => run(["--at-v2", at], { workspaceRoot: d, now: () => checked });
await test("v2 adds exact FOMC receipts while preserving v1 hashes and all journal bytes", () => temporary(async d => {
  await seed(d); await appendFomc(d); const before = files(d), v1 = await read(d), r = await readV2(d);
  assert.equal(r.context.components.fomcCalendar.report.retrievalCount, 1); assert.equal(r.context.baseContextSha256, v1.contextSha256);
  const { fomcCalendar, ...original } = r.context.components; assert.deepEqual(original, v1.context.components);
  assert.deepEqual(r.blockedStores, []); assert.deepEqual(await read(d), v1); assert.deepEqual(files(d), before);
}));
await test("v2 excludes late calendar receipts and keeps earlier context after a later append", () => temporary(async d => {
  await seed(d); await appendFomc(d, { ...fomcInput(later), requestedAt: early });
  const a = await readV2(d); assert.equal(a.context.components.fomcCalendar.report.retrievalCount, 0);
  await appendFomc(d, { ...fomcInput(checked), sourceText: null, errorCode: "NETWORK_FAILED" });
  assert.equal((await readV2(d)).contextSha256, a.contextSha256);
}));
await test("v2 missing fifth store stays absent and v1 does not inspect a corrupt FOMC store", () => temporary(async d => {
  await seed(d); const before = await read(d), r = await readV2(d); assert.deepEqual(r.missingStores, ["fomcCalendar"]);
  assert(!existsSync(join(d, "data/runtime/options-fomc-calendar")));
  await appendFomc(d); writeFileSync(fomcPath(d), "PRIVATE_CORRUPTION");
  assert.deepEqual(await read(d), before); const blocked = await readV2(d);
  assert.deepEqual(blocked.blockedStores, ["fomcCalendar"]); assert(!JSON.stringify(blocked).includes("PRIVATE"));
  assert.equal(readFileSync(fomcPath(d), "utf8"), "PRIVATE_CORRUPTION");
}));
await test("v2 isolates a busy fifth store and preserves its lock", () => temporary(async d => {
  await seed(d); await appendFomc(d); const lock = join(d, "data/runtime/options-fomc-calendar/writer.lock"); writeFileSync(lock, "held");
  const r = await readV2(d); assert.deepEqual(r.blockedStores, ["fomcCalendar"]); assert.equal(r.context.components.fomcCalendar.errorCode, "STORE_BUSY");
  assert.equal(readFileSync(lock, "utf8"), "held"); assert.equal(r.context.components.headlines.state, "AVAILABLE");
}));
await test("v2 rejects a hard-linked FOMC journal without modifying it", () => temporary(async d => {
  await seed(d); await appendFomc(d); linkSync(fomcPath(d), join(d, "fomc-alias")); const before = files(d), r = await readV2(d);
  assert.equal(r.context.components.fomcCalendar.errorCode, "STORE_UNSAFE"); assert.deepEqual(files(d), before);
}));
await test("v2 validates complete later journal integrity before selecting earlier receipts", () => temporary(async d => {
  await seed(d); await appendFomc(d); await appendFomc(d, fomcInput(later));
  const path = fomcPath(d), text = readFileSync(path, "utf8"); writeFileSync(path, text.slice(0, -1));
  const r = await readV2(d); assert.equal(r.context.components.fomcCalendar.errorCode, "RECOVERY_FAILED");
  assert.equal(r.context.components.fomcCalendar.report, null); assert.equal(readFileSync(path, "utf8"), text.slice(0, -1));
}));
await test("v2 performs no source calls or writes during successful restart recovery", () => temporary(async d => {
  await seed(d); await appendFomc(d); const before = files(d), original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("FORBIDDEN_SOURCE_CALL"); };
  try { const a = await readV2(d); assert.deepEqual(await readV2(d), a); assert.equal(a.sourceAppends, 0); assert.equal(a.context.replayAllowed, false); }
  finally { globalThis.fetch = original; }
  assert.equal(calls, 0); assert.deepEqual(files(d), before);
}));
await test("v2 future cutoff and extra execution arguments fail before filesystem access", () => {
  const options = { workspaceRoot: join(root, "missing-v2-root"), now: () => checked };
  return Promise.all([
    assert.rejects(run(["--at-v2", "2026-09-08T00:00:00.000Z"], options), /FUTURE_CUTOFF/),
    assert.rejects(run(["--at-v2", "today"], options), /CLOCK/),
    assert.rejects(run(["--at-v2", cutoff, "--refresh"], options), /ARGUMENTS/),
  ]);
});
await test("reusable loader composes exact v2 manifest without changing journals or clock sequence", () => temporary(async d => {
  await seed(d); await appendFomc(d); const before = files(d); let clockCalls = 0;
  const loaded = await loadOptionsContextCutoffHistories(cutoff, { workspaceRoot: d, v2: true, now: () => { clockCalls++; return checked; } });
  const result = buildOptionsContextManifest(loaded.histories, cutoff, loaded.constructedAt);
  assert.equal(clockCalls, 7); assert.deepEqual(result.reconstruction, await readV2(d));
  assert.equal(result.manifest.components[3].members.length, 0);
  assert.equal(result.manifest.components[4].members.length, 1);
  assert.equal(result.manifest.prospectiveCaptureReceipt, false); assert.deepEqual(files(d), before);
}));
await test("reusable loader rejects an ambiguous source version before filesystem access", async () => {
  await assert.rejects(loadOptionsContextCutoffHistories(cutoff, { workspaceRoot: join(root, "missing-loader-root"), v2: "true", now: () => checked }), /CONTEXT_CUTOFF_ARGUMENTS/);
});
console.log(`${passed}/${passed} tests passed.`);
