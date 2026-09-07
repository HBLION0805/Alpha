import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsBriefCommand as run } from "./options-brief.mjs";
import { runOptionsContextReadinessCommand } from "./options-readiness.mjs";
import { withReleaseCalendarJournal } from "./lib/options-release-calendar-io.mjs";
import { withTreasuryJournal } from "./lib/options-treasury-io.mjs";
import { treasuryUrl } from "../src/engines/options-treasury/TreasuryRealYieldEngine.ts";
import { RELEASE_CALENDAR_URL } from "../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { optionsPaperDemoScenarios } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { runRobinhoodObserveCommand } from "./options-robinhood-observe.mjs";

const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T14:00:00.000Z";
const study = JSON.parse(readFileSync(join(root, "fixtures/options-robinhood-data/observation-plan.synthetic.json"), "utf8")).studyId;
const read = directory => run(["--report", study], { workspaceRoot: directory, now: () => at });
const file = directory => join(directory, "data/runtime/options-release-calendar/retrievals.ndjson");
const source = readFileSync(join(root, "fixtures/options-release-calendar/calendar.synthetic.ics"), "utf8");
async function temporary(work) {
  const directory = mkdtempSync(join(tmpdir(), "alpha-brief-test-"));
  try { await work(directory); } finally {
    const rel = relative(realpathSync(tmpdir()), realpathSync(directory));
    if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-brief-test-")) throw Error("UNSAFE_TEST_CLEANUP");
    rmSync(directory, { recursive: true });
  }
}
async function seed(directory) {
  for (const [from, to] of [["observation-plan.synthetic.json", "plan.json"], ["capture.synthetic.json", "source.json"]]) copyFileSync(join(root, "fixtures/options-robinhood-data", from), join(directory, to));
  runRobinhoodObserveCommand(["--freeze", "plan.json", "--source", "source.json"], { workspaceRoot: directory, now: () => "2026-09-04T14:00:10.000Z" });
  withOptionsPaperRepository(directory, r => { for (const f of optionsPaperDemoScenarios()) r.append(f); });
  await withTreasuryJournal(directory, s => s.append({ requestedAt: at, receivedAt: at, url: treasuryUrl(at), sourceText: readFileSync(join(root, "fixtures/options-treasury/real-yields.synthetic.xml"), "utf8"), errorCode: null }, at), at);
  await withReleaseCalendarJournal(directory, s => s.append({ requestedAt: at, receivedAt: at, url: RELEASE_CALENDAR_URL, sourceText: source, errorCode: null }, at), at);
}
function files(directory) {
  const result = {}; const walk = path => { for (const e of readdirSync(path, { withFileTypes: true })) { const p = join(path, e.name); if (e.isDirectory()) walk(p); else result[relative(directory, p)] = createHash("sha256").update(readFileSync(p)).digest("hex"); } }; walk(directory); return result;
}
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test("brief composes actual repository recovery without modifying any source bytes", () => temporary(async directory => {
  await seed(directory); const before = files(directory), r = await read(directory); assert.equal(r.blockedStores.length, 0); assert.equal(r.calendarState, "AVAILABLE");
  assert.match(r.text, /Local simulated closed trades: 5; stored reviews: 5; missing or unmatched closed-trade reviews: 0/);
  assert.match(r.text, /Candidate lessons: paper 4/); assert.match(r.text, /5Y -0.10%/); assert.match(r.text, /Consumer Price Index/);
  assert.deepEqual(files(directory), before);
}));
await test("absent eight stores stay absent without creating directories", () => temporary(async directory => {
  const r = await read(directory); assert.equal(r.missingStores.length, 8); assert.equal(existsSync(join(directory, "data")), false); assert.match(r.text, /review coverage: unknown/);
}));
await test("calendar corruption is isolated and cannot inject private error text", () => temporary(async directory => {
  await seed(directory); writeFileSync(file(directory), "{PRIVATE_CALENDAR_PAYLOAD"); const r = await read(directory); assert.deepEqual(r.blockedStores, ["blsCalendar"]); assert.equal(r.calendarErrorCode, "RECOVERY_FAILED"); assert(!r.text.includes("PRIVATE")); assert.match(r.text, /closed trades: 5/); assert.equal(readFileSync(file(directory), "utf8"), "{PRIVATE_CALENDAR_PAYLOAD");
}));
await test("a held calendar lock stays held while the rest of the brief recovers", () => temporary(async directory => {
  await seed(directory); const lock = join(directory, "data/runtime/options-release-calendar/writer.lock"); writeFileSync(lock, "held"); const r = await read(directory); assert.equal(r.calendarErrorCode, "STORE_BUSY"); assert.equal(readFileSync(lock, "utf8"), "held"); assert.match(r.text, /stored reviews: 5/);
}));
await test("hard links and oversized calendar stores are blocked before recovery", () => temporary(async directory => {
  await seed(directory); linkSync(file(directory), join(directory, "alias")); assert.equal((await read(directory)).calendarErrorCode, "STORE_UNSAFE");
}));
await test("oversized calendar file does not get parsed or rewritten", () => temporary(async directory => {
  await seed(directory); truncateSync(file(directory), 32 * 1024 * 1024 + 1); assert.equal((await read(directory)).calendarErrorCode, "STORE_UNSAFE");
}));
await test("runtime junctions cannot redirect the calendar or other sources", () => temporary(async directory => {
  const other = join(directory, "other"); mkdirSync(other); symlinkSync(other, join(directory, "data"), process.platform === "win32" ? "junction" : "dir"); const r = await read(directory); assert.equal(r.blockedStores.length, 8); assert.equal(r.calendarErrorCode, "STORE_UNSAFE"); assert.deepEqual(readdirSync(other), []);
}));
await test("brief never invokes source retrieval", () => temporary(async directory => {
  await seed(directory); const original = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls++; throw Error("FORBIDDEN"); };
  try { assert.equal((await read(directory)).networkAccess, false); assert.equal(calls, 0); } finally { globalThis.fetch = original; }
}));
await test("failed latest source survives recovery without current calendar events", () => temporary(async directory => {
  await seed(directory); await withReleaseCalendarJournal(directory, s => s.append({ requestedAt: at, receivedAt: at, url: RELEASE_CALENDAR_URL, sourceText: null, errorCode: "NETWORK_FAILED" }, at), at);
  const r = await read(directory); assert.equal(r.calendarState, "AVAILABLE"); assert.match(r.text, /Latest attempt: FAILED/); assert(!r.text.includes("Consumer Price Index")); assert.match(r.text, /Last-known calendar exists/);
}));
await test("the original v2 report and its fingerprint remain unchanged", () => temporary(async directory => {
  await seed(directory); const before = await runOptionsContextReadinessCommand(["--report", study], { workspaceRoot: directory, now: () => at }); const r = await read(directory);
  const after = await runOptionsContextReadinessCommand(["--report", study], { workspaceRoot: directory, now: () => at }); assert.deepEqual(after, before); assert.equal(r.coreReportSha256, before.reportSha256);
}));
await test("invalid scope, format, refresh and injected shell arguments fail before reading", () => temporary(async directory => {
  for (const args of [["--refresh"], ["--report", study, "--format", "html"], ["--report", "../escape"], ["--report", study, "--root"], ["--report", study, "--json", "extra"]]) await assert.rejects(run(args, { workspaceRoot: directory, now: () => at }), /ARGUMENTS|STUDY_ID/);
  assert.deepEqual(readdirSync(directory), []);
}));
await test("CLI help is local and states fixed read-only purpose", () => {
  const r = spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/options-brief.mjs"), "--help"], { encoding: "utf8", timeout: 30000 }); assert.equal(r.status, 0); assert.match(JSON.parse(r.stdout).meaning, /No network, source appends/);
});
console.log(`${passed}/${passed} tests passed.`);
