import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync, readdirSync, existsSync, symlinkSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runOptionsDashboardCommand as run } from "./options-dashboard.mjs";
import { buildDashboardReport, renderDashboard } from "./lib/options-dashboard-render.mjs";
import { readinessFingerprint } from "../src/engines/options-readiness/OptionsReadinessEngine.ts";
import { runRobinhoodObserveCommand } from "./options-robinhood-observe.mjs";
import { optionsPaperDemoScenarios, paperFixture } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { historicalReplayFixture } from "../src/engines/options-historical-replay/OptionsHistoricalReplayFixtures.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";
const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T18:00:00.000Z", css = readFileSync(join(root, "scripts/lib/options-dashboard.css"), "utf8");
const study = JSON.parse(readFileSync(join(root, "fixtures/options-robinhood-data/observation-plan.synthetic.json"), "utf8")).studyId;
const opts = dir => ({ workspaceRoot: dir, now: () => at });
const build = (dir, id = "test-snapshot") => run(["--build", study, id], opts(dir));
const saved = (dir, id = "test-snapshot") => JSON.parse(readFileSync(join(dir, `data/runtime/options-dashboard/${id}/report.json`), "utf8"));
async function temporary(work) { const dir = mkdtempSync(join(tmpdir(), "alpha-dashboard-test-")); try { await work(dir); } finally { const rel = relative(realpathSync(tmpdir()), realpathSync(dir)); if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-dashboard-test-")) throw Error("UNSAFE_CLEANUP"); rmSync(dir, { recursive: true }); } }
function seed(dir, injection = false) {
  for (const [from, to] of [["observation-plan.synthetic.json", "plan.json"], ["capture.synthetic.json", "source.json"]]) copyFileSync(join(root, "fixtures/options-robinhood-data", from), join(dir, to));
  runRobinhoodObserveCommand(["--freeze", "plan.json", "--source", "source.json"], { workspaceRoot: dir, now: () => "2026-09-04T14:00:10.000Z" });
  withOptionsPaperRepository(dir, r => { if (injection) { const s = paperFixture(); r.append({ ...s, plan: { ...s.plan, setupKey: '</td><script>alert("private")</script>' } }); } else for (const s of optionsPaperDemoScenarios()) r.append(s); });
  const f = historicalReplayFixture(); withOptionsHistoricalReplayRepository(dir, r => r.append(f.config, f.evidence, f.recordedAt));
}
function sourceBytes(dir) { const result = {}; function walk(p) { for (const e of readdirSync(p, { withFileTypes: true })) { if (e.name === "options-dashboard") continue; const file = join(p, e.name); if (e.isDirectory()) walk(file); else result[relative(dir, file)] = createHash("sha256").update(readFileSync(file)).digest("hex"); } } walk(dir); return result; }
let passed = 0; async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test("saved dashboard reconciles reviews and exact original report hashes", () => temporary(async dir => {
  seed(dir); const before = sourceBytes(dir), result = await build(dir), r = saved(dir), html = readFileSync(join(dir, result.path), "utf8");
  assert.equal(r.outcomes.components.paper.audit.metrics.closedCount, 5); assert(r.crossReportChecks.every(c => c.state === "MATCHED")); assert.match(html, /Real-price testing is not ready/); assert.match(html, /Candidate mistake notebook/);
  assert.deepEqual(sourceBytes(dir), before); assert.equal(r.realPriceTestReady, false); assert.equal(r.hostSchedule, "NOT_INSPECTED");
  for (const f of result.manifest.files) { const bytes = readFileSync(join(dir, "data/runtime/options-dashboard/test-snapshot", f.name)); assert.equal(bytes.length, f.bytes); assert.equal(createHash("sha256").update(bytes).digest("hex"), f.sha256); }
}));
await test("empty workspace produces explicit missing evidence without source journals", () => temporary(async dir => {
  const result = await build(dir), r = saved(dir); assert.equal(r.readiness.missingStores.length, 7); assert.equal(r.calendar.missingStores.length, 2); assert(!existsSync(join(dir, "data/runtime/options-paper"))); assert.match(readFileSync(join(dir, result.path), "utf8"), /Selected study evidence unavailable/);
}));
await test("corrupt paper store remains visible alongside independent research", () => temporary(async dir => {
  seed(dir); writeFileSync(join(dir, "data/runtime/options-paper/sessions.ndjson"), "PRIVATE_SECRET"); const result = await build(dir); assert.deepEqual(result.blockedStores.outcomes, ["paper"]); const html = readFileSync(join(dir, result.path), "utf8"); assert(!html.includes("PRIVATE_SECRET")); assert.match(html, /RECOVERY FAILED/); assert.equal(saved(dir).outcomes.components.historical.state, "AVAILABLE");
}));
await test("hostile case text is escaped and cannot create executable markup", () => temporary(async dir => {
  seed(dir, true); const result = await build(dir), html = readFileSync(join(dir, result.path), "utf8"); assert(!html.includes("<script>")); assert(html.includes("&lt;script&gt;")); assert.match(html, /default-src 'none'/); assert.match(html, /connect-src 'none'/); assert(!/<(?:script|iframe|img|form)\b/i.test(html));
}));
await test("inline style is bound by CSP and page has no remote asset dependency", () => temporary(async dir => {
  const result = await build(dir), html = readFileSync(join(dir, result.path), "utf8"); const digest = createHash("sha256").update(css).digest("base64"); assert(html.includes(`style-src 'sha256-${digest}'`)); assert(!/\b(?:src|href)=["']https?:/i.test(html)); assert.match(html, /Skip to operational snapshot/); assert.match(css, /prefers-reduced-motion/);
}));
await test("repeated snapshot IDs cannot overwrite valid or partial artifacts", () => temporary(async dir => {
  const result = await build(dir), bytes = readFileSync(join(dir, result.path)); await assert.rejects(build(dir), error => error.code === "EEXIST"); assert.deepEqual(readFileSync(join(dir, result.path)), bytes);
}));
await test("output parent junction cannot redirect dashboard writes", () => temporary(async dir => {
  const other = join(dir, "other"); mkdirSync(other); mkdirSync(join(dir, "data/runtime"), { recursive: true }); symlinkSync(other, join(dir, "data/runtime/options-dashboard"), process.platform === "win32" ? "junction" : "dir"); await assert.rejects(build(dir), /UNSAFE/); assert.deepEqual(readdirSync(other), []);
}));
await test("rebuilding different snapshots does not refresh network sources", () => temporary(async dir => {
  seed(dir); const previous = globalThis.fetch; globalThis.fetch = () => { throw Error("NETWORK_FORBIDDEN"); }; try { await build(dir, "snapshot-one"); await build(dir, "snapshot-two"); assert.deepEqual(saved(dir, "snapshot-one"), saved(dir, "snapshot-two")); } finally { globalThis.fetch = previous; }
}));
await test("tampered source reports and authority flags fail rendering", () => temporary(async dir => {
  await build(dir); const r = saved(dir); r.readiness.realPriceTestReady = true; assert.throws(() => renderDashboard(r, css), /REPORT_HASH/);
  const { reportSha256, ...body } = r.readiness; r.readiness.reportSha256 = readinessFingerprint(body); assert.throws(() => renderDashboard(r, css), /AUTHORITY/);
}));
await test("cross-read changes are surfaced instead of falsely merged as consistent", () => temporary(async dir => {
  seed(dir); await build(dir); const r = saved(dir); r.readiness.evidence.paper.reportSha256 = "a".repeat(64); const { reportSha256, ...body } = r.readiness; r.readiness.reportSha256 = readinessFingerprint(body);
  const fresh = buildDashboardReport(r.readiness, r.calendar, r.outcomes, at); assert.equal(fresh.crossReportChecks[0].state, "CHANGED_DURING_READ"); assert.match(renderDashboard(fresh, css), /CHANGED DURING READ/);
}));
await test("construction clocks and command arguments are strict", () => temporary(async dir => {
  await build(dir); const r = saved(dir); assert.throws(() => buildDashboardReport(r.readiness, r.calendar, r.outcomes, "2026-09-06T00:00:00.000Z"), /CLOCK_ORDER/);
  for (const args of [["--refresh"], ["--build", study, "../escape"], ["--build", study, "valid", "extra"]]) await assert.rejects(run(args, opts(dir)));
  assert((await run(["--help"], opts(dir))).usage);
}));
console.log(`${passed}/${passed} tests passed.`);
