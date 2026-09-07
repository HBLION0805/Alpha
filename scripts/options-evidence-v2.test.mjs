import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync, existsSync, linkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { runOptionsEvidenceExportCommand as exportRun } from "./options-evidence-export.mjs";
import { runOptionsEvidenceRehearsalCommand as rehearse } from "./options-evidence-rehearsal.mjs";
import { runRobinhoodObserveCommand } from "./options-robinhood-observe.mjs";
import { runOptionsCalendarBriefCommand as brief } from "./options-calendar-brief.mjs";
import { withReleaseCalendarJournal } from "./lib/options-release-calendar-io.mjs";
import { withFomcCalendarJournal } from "./lib/options-fomc-calendar-io.mjs";
import { RELEASE_CALENDAR_URL } from "../src/engines/options-release-calendar/BlsReleaseCalendarEngine.ts";
import { FOMC_CALENDAR_URL } from "../src/engines/options-fomc-calendar/FomcCalendarEngine.ts";
import { exportSourcePolicy, EXPORT_VERSION_V2, validateExportManifest, exportFingerprint } from "../src/engines/options-evidence-export/OptionsEvidenceExportEngine.ts";
const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T17:00:00.000Z";
const study = JSON.parse(readFileSync(join(root, "fixtures/options-robinhood-data/observation-plan.synthetic.json"), "utf8")).studyId;
const bls = "data/runtime/options-release-calendar/retrievals.ndjson", fomc = "data/runtime/options-fomc-calendar/retrievals.ndjson";
async function temporary(work) { const dir = mkdtempSync(join(tmpdir(), "alpha-evidence-v2-test-")); try { await work(dir); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(dir)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-evidence-v2-test-")) throw Error("UNSAFE_CLEANUP"); rmSync(dir, { recursive: true }); } }
async function seed(dir, calendars = true) {
  for (const [from, to] of [["observation-plan.synthetic.json", "plan.json"], ["capture.synthetic.json", "source.json"]]) copyFileSync(join(root, "fixtures/options-robinhood-data", from), join(dir, to));
  runRobinhoodObserveCommand(["--freeze", "plan.json", "--source", "source.json"], { workspaceRoot: dir, now: () => "2026-09-04T14:00:10.000Z" });
  if (calendars) for (const [reader, url, file] of [[withReleaseCalendarJournal, RELEASE_CALENDAR_URL, "options-release-calendar/calendar.synthetic.ics"], [withFomcCalendarJournal, FOMC_CALENDAR_URL, "options-fomc-calendar/calendar.synthetic.html"]]) await reader(dir, s => s.append({ requestedAt: at, receivedAt: at, url, sourceText: readFileSync(join(root, "fixtures", file), "utf8"), errorCode: null }, at), at);
}
const opts = dir => ({ workspaceRoot: dir, now: () => at, temporaryParent: dir });
const manifestPath = (dir, id) => join(dir, `data/runtime/options-evidence-exports/${id}/manifest.json`);
let passed = 0; async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test("v1 excludes calendars and remains unchanged when a v2 package is created", () => temporary(async dir => {
  await seed(dir); const old = exportRun(["--create", study, "old-package"], opts(dir)), bytes = readFileSync(manifestPath(dir, "old-package"));
  const current = exportRun(["--create-v2", study, "new-package"], opts(dir)); assert.equal(current.fileCount, old.fileCount + 2); assert.equal(current.exportVersion, EXPORT_VERSION_V2);
  assert.deepEqual(readFileSync(manifestPath(dir, "old-package")), bytes); assert.equal(exportRun(["--verify", "old-package"], opts(dir)).manifestSha256, old.manifestSha256);
  const m = JSON.parse(readFileSync(manifestPath(dir, "new-package"), "utf8")); assert(m.files.some(f => f.component === "blsCalendar")); assert(m.files.some(f => f.component === "fomcCalendar"));
}));
await test("v2 restores exact calendars and the same derived calendar report without HTTP", () => temporary(async dir => {
  await seed(dir); const expected = await brief(["--report"], opts(dir)), bytes = [bls, fomc].map(f => readFileSync(join(dir, f)));
  exportRun(["--create-v2", study, "calendar-package"], opts(dir)); const previous = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); };
  try { const r = await rehearse(["--rehearse", "calendar-package"], opts(dir)); assert.equal(r.status, "RESTORED_COMPONENTS_READABLE"); assert.deepEqual(r.calendarReport, expected); assert.equal(r.activeRuntimeRestored, false);
    for (const [i, f] of [bls, fomc].entries()) { assert.deepEqual(readFileSync(join(r.isolatedWorkspace, f)), bytes[i]); assert.deepEqual(readFileSync(join(dir, f)), bytes[i]); }
  } finally { globalThis.fetch = previous; }
}));
await test("missing calendar journals remain missing and never borrow later active data", () => temporary(async dir => {
  await seed(dir, false); const e = exportRun(["--create-v2", study, "missing-package"], opts(dir)); assert(e.missingComponents.includes("blsCalendar")); assert(e.missingComponents.includes("fomcCalendar"));
  const r = await rehearse(["--rehearse", "missing-package"], opts(dir)); assert.deepEqual(r.calendarReport.missingStores, ["bls", "fomc"]); assert(!existsSync(join(r.isolatedWorkspace, bls)));
}));
await test("corrupt archived calendar is byte-valid but fails semantic recovery independently", () => temporary(async dir => {
  await seed(dir); writeFileSync(join(dir, fomc), "PRIVATE_BODY"); exportRun(["--create-v2", study, "bad-calendar"], opts(dir)); const r = await rehearse(["--rehearse", "bad-calendar"], opts(dir));
  assert.equal(r.status, "REHEARSAL_HAS_BLOCKED_COMPONENTS"); assert.deepEqual(r.calendarReport.blockedStores, ["fomc"]); assert.equal(r.calendarReport.sources.bls.state, "AVAILABLE"); assert(!JSON.stringify(r).includes("PRIVATE_BODY"));
}));
await test("calendar lock blocks copy and remains intact", () => temporary(async dir => {
  await seed(dir); const lock = join(dir, "data/runtime/options-fomc-calendar/writer.lock"); writeFileSync(lock, "held"); assert.throws(() => exportRun(["--create-v2", study, "locked-calendar"], opts(dir)), /SOURCE_LOCKED/); assert.equal(readFileSync(lock, "utf8"), "held");
}));
await test("calendar hard link blocks v2 without changing v1 behavior", () => temporary(async dir => {
  await seed(dir); linkSync(join(dir, bls), join(dir, "alias")); assert.throws(() => exportRun(["--create-v2", study, "linked-calendar"], opts(dir)), /UNSAFE_FILE/); assert.equal(exportRun(["--create", study, "legacy-package"], opts(dir)).status, "PACKAGE_BYTES_VERIFIED");
}));
await test("version-specific mapping refuses calendar paths in v1 and all other files in v2", () => {
  assert.throws(() => exportSourcePolicy(study, bls), /SOURCE_SCOPE/); assert.equal(exportSourcePolicy(study, bls, EXPORT_VERSION_V2).maxBytes, 32 * 1024 * 1024);
  assert.throws(() => exportSourcePolicy(study, "data/runtime/options-fomc-calendar/private.json", EXPORT_VERSION_V2), /SOURCE_SCOPE/);
});
await test("rehashing cannot relabel v2 calendar payloads as legacy manifest", () => temporary(async dir => {
  await seed(dir); exportRun(["--create-v2", study, "version-package"], opts(dir)); const m = JSON.parse(readFileSync(manifestPath(dir, "version-package"), "utf8"));
  m.version = "OPTIONS_LOCAL_EVIDENCE_EXPORT_V1"; const { manifestSha256, ...body } = m; m.manifestSha256 = exportFingerprint(body); assert.throws(() => validateExportManifest(m), /SOURCE_SCOPE/);
}));
await test("v2 calendar clock checks advance before rehearsal completion", () => temporary(async dir => {
  await seed(dir); exportRun(["--create-v2", study, "clock-package"], opts(dir)); let tick = 0; const r = await rehearse(["--rehearse", "clock-package"], { ...opts(dir), now: () => new Date(Date.parse(at) + tick++).toISOString() });
  assert(r.report.assessedAt < r.calendarReport.assessedAt); assert(r.calendarReport.assessedAt < r.completedAt);
}));
console.log(`${passed}/${passed} tests passed.`);
