import assert from "node:assert/strict";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { runOptionsReadinessCommand as run, runOptionsContextReadinessCommand as runContext, summarizeReadinessComponent as summarize } from "./options-readiness.mjs";
import { runRobinhoodObserveCommand } from "./options-robinhood-observe.mjs";
import { optionsPaperDemoScenarios } from "../src/engines/options-paper/OptionsPaperFixtures.ts";
import { replayOptionsPaperAccount, appendOptionsPaperScenario } from "../src/engines/options-paper/OptionsPaperTradingEngine.ts";
import { historicalReplayFixture } from "../src/engines/options-historical-replay/OptionsHistoricalReplayFixtures.ts";
import { withOptionsPaperRepository } from "../src/repositories/LocalOptionsPaperRepository.ts";
import { withOptionsHistoricalReplayRepository } from "../src/repositories/LocalOptionsHistoricalReplayRepository.ts";
import { withOptionsMarketEvidenceRepository } from "../src/repositories/LocalOptionsMarketEvidenceRepository.ts";
import { withDriverJournal } from "./lib/options-driver-io.mjs";
import { withTreasuryJournal } from "./lib/options-treasury-io.mjs";
import { treasuryUrl } from "../src/engines/options-treasury/TreasuryRealYieldEngine.ts";
import { withBtcContextJournal } from "./lib/options-btc-context-io.mjs";
import { BTC_CONTEXT_URL } from "../src/engines/options-btc-context/BtcSpotContextEngine.ts";

const root = resolve(import.meta.dirname, ".."), at = "2026-09-07T14:00:00.000Z";
const config = JSON.parse(readFileSync(join(root, "fixtures/options-robinhood-data/observation-plan.synthetic.json"), "utf8")), study = config.studyId;
const read = (directory, clock = () => at) => run(["--report", study], { workspaceRoot: directory, now: clock });
async function temporary(work) {
  const directory = mkdtempSync(join(tmpdir(), "alpha-readiness-test-"));
  try { await work(directory); } finally {
    const rel = relative(realpathSync(tmpdir()), realpathSync(directory));
    if (isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith("alpha-readiness-test-")) throw Error("UNSAFE_TEST_CLEANUP");
    rmSync(directory, { recursive: true });
  }
}
async function seed(directory) {
  for (const [from, to] of [["observation-plan.synthetic.json", "plan.json"], ["capture.synthetic.json", "source.json"]]) copyFileSync(join(root, "fixtures/options-robinhood-data", from), join(directory, to));
  runRobinhoodObserveCommand(["--freeze", "plan.json", "--source", "source.json"], { workspaceRoot: directory, now: () => "2026-09-04T14:00:10.000Z" });
  withOptionsPaperRepository(directory, r => { for (const fixture of optionsPaperDemoScenarios()) r.append(fixture); });
  const research = historicalReplayFixture();
  withOptionsHistoricalReplayRepository(directory, r => r.append(research.config, research.evidence, at));
  withOptionsMarketEvidenceRepository(directory, r => r.append(research.evidence));
  withDriverJournal(directory, s => s.appendBatch([], ["fed", "bls", "bea", "ecb", "ofac", "sec"].map(sourceId => ({ sourceId, status: "EMPTY", observedAt: at, itemsReceived: 0, truncated: false, diagnostic: null }))));
  const input = { requestedAt: at, receivedAt: at, url: treasuryUrl(at), errorCode: null, sourceText: readFileSync(join(root, "fixtures/options-treasury/real-yields.synthetic.xml"), "utf8") };
  await withTreasuryJournal(directory, s => s.append(input, at), at);
}
function files(directory) {
  const result = {};
  const walk = path => { for (const item of readdirSync(path, { withFileTypes: true })) { const p = join(path, item.name); if (item.isDirectory()) walk(p); else result[relative(directory, p)] = createHash("sha256").update(readFileSync(p)).digest("hex"); } };
  walk(directory); return result;
}
function paperReport() { let scenarios = []; for (const s of optionsPaperDemoScenarios()) scenarios = appendOptionsPaperScenario(scenarios, s).scenarios; return replayOptionsPaperAccount(scenarios); }
const readContext = (directory, clock = () => at) => runContext(["--report", study], { workspaceRoot: directory, now: clock });
async function seedBtc(directory, failure = false) {
  const sourceText = readFileSync(join(root, "fixtures/options-btc-context/book.synthetic.json"), "utf8").replace("04:00:00.000000001Z", "13:59:59.000000001Z");
  await withBtcContextJournal(directory, store => store.append({ requestedAt: at, receivedAt: at, url: BTC_CONTEXT_URL, sourceText: failure ? null : sourceText, errorCode: failure ? "NETWORK_FAILED" : null }, at), at);
}
let passed = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
await test("all six repositories recover without appending any source or trade", () => temporary(async directory => {
  await seed(directory); const before = files(directory), r = await read(directory); assert.equal(r.blockedStores.length, 0); assert.equal(r.missingStores.length, 0);
  assert.equal(r.closedPaperReviewCoverage.closed, 5); assert.equal(r.closedPaperReviewCoverage.reviewed, 5); assert.equal(r.candidateNotebooks.paper, 4);
  assert.equal(r.evidence.historical.summary.runCount, 1); assert.equal(r.evidence.imports.summary.decision, "NO_REPLAY"); assert.equal(r.evidence.treasury.summary.ratesBps[5], -10);
  assert.deepEqual(files(directory), before); assert.equal(r.realPriceTestReady, false);
}));
await test("missing workspaces stay missing instead of creating empty journals", () => temporary(async directory => {
  const r = await read(directory); assert.equal(r.missingStores.length, 6); assert.equal(existsSync(join(directory, "data")), false); assert.equal(r.nextStep, "LOCATE_SELECTED_STUDY_EVIDENCE");
}));
await test("damaged paper history is isolated while source reports remain available", () => temporary(async directory => {
  await seed(directory); const path = join(directory, "data/runtime/options-paper/sessions.ndjson"); writeFileSync(path, "{PRIVATE_BODY");
  const before = readFileSync(path, "utf8"), r = await read(directory); assert.deepEqual(r.blockedStores, ["paper"]); assert.equal(r.evidence.paper.errorCode, "RECOVERY_FAILED"); assert.equal(r.evidence.treasury.state, "AVAILABLE"); assert(!JSON.stringify(r).includes("PRIVATE_BODY")); assert.equal(readFileSync(path, "utf8"), before);
}));
await test("busy Treasury storage does not delete the lock or hide paper reviews", () => temporary(async directory => {
  await seed(directory); const lock = join(directory, "data/runtime/options-treasury-rates/writer.lock"); writeFileSync(lock, "held");
  const r = await read(directory); assert.equal(r.evidence.treasury.errorCode, "STORE_BUSY"); assert.equal(r.closedPaperReviewCoverage.consistent, true); assert.equal(readFileSync(lock, "utf8"), "held");
}));
await test("a corrupted selected plan cannot be replaced by saved historical outcomes", () => temporary(async directory => {
  await seed(directory); writeFileSync(join(directory, `data/runtime/options-robinhood-data/studies/${study}/plan.json`), "bad"); const r = await read(directory); assert.equal(r.evidence.collection.state, "BLOCKED"); assert.equal(r.evidence.historical.state, "AVAILABLE"); assert.equal(r.realPriceTradeCount, 0);
}));
await test("hard links are blocked before the legacy repository can read them", () => temporary(async directory => {
  await seed(directory); linkSync(join(directory, "data/runtime/options-paper/sessions.ndjson"), join(directory, "alias.ndjson")); const r = await read(directory); assert.equal(r.evidence.paper.errorCode, "STORE_UNSAFE"); assert.equal(r.evidence.treasury.state, "AVAILABLE");
}));
await test("runtime junctions cannot redirect any component to another directory", () => temporary(async directory => {
  const other = join(directory, "other"); mkdirSync(other); symlinkSync(other, join(directory, "data"), process.platform === "win32" ? "junction" : "dir"); const r = await read(directory); assert.equal(r.blockedStores.length, 6); assert(Object.values(r.evidence).every(e => e.errorCode === "STORE_UNSAFE")); assert.deepEqual(readdirSync(other), []);
}));
await test("oversized journals are marked unsafe without parsing their body", () => temporary(async directory => {
  await seed(directory); truncateSync(join(directory, "data/runtime/options-paper/sessions.ndjson"), 16 * 1024 * 1024 + 1); const r = await read(directory); assert.equal(r.evidence.paper.errorCode, "STORE_UNSAFE"); assert.equal(r.evidence.headlines.state, "AVAILABLE");
}));
await test("readiness never invokes an HTTP source refresh", () => temporary(async directory => {
  await seed(directory); const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("NETWORK_NOT_ALLOWED"); };
  try { const r = await read(directory); assert.equal(r.blockedStores.length, 0); assert.equal(r.networkAccess, false); assert.equal(calls, 0); } finally { globalThis.fetch = original; }
}));
await test("hypothetical future paper dates remain labeled scenario clocks", () => temporary(async directory => {
  await seed(directory); const r = await read(directory); assert.equal(r.evidence.paper.state, "AVAILABLE"); assert.equal(r.paperClockBasis, "SCENARIO_CLOCKS_NOT_BROKER_OR_ACTUAL_RECORDING_TIMES"); assert.equal(r.liveAccountInspected, false);
}));
await test("per-store check times and completion reflect a sequential non-atomic read", () => temporary(async directory => {
  await seed(directory); let ticks = 0; const r = await read(directory, () => new Date(Date.parse(at) + ticks++).toISOString());
  assert(r.evidence.collection.checkedAt < r.evidence.treasury.checkedAt); assert(r.evidence.treasury.checkedAt < r.assessedAt); assert.equal(r.snapshotAtomicAcrossStores, false);
}));
await test("paper summary rejects falsely promoted outcomes and non-target symbols", () => {
  const source = paperReport(); for (const patch of [{ executionAllowed: true }, { marketValidated: true }, { probability: 0.99 }]) assert.throws(() => summarize("paper", { ...source, ...patch }, study, at), /BOUNDARY|AUTHORITY/);
  const invalid = structuredClone(source); invalid.trades[0].symbol = "AAPL"; assert.throws(() => summarize("paper", invalid, study, at), /BOUNDARY/);
});
await test("missing closed-trade reviews are detected by identity, not only count", () => {
  const source = structuredClone(paperReport()); source.reviews[0].input.tradeId = "wrong-trade"; const summary = summarize("paper", source, study, at); assert.equal(summary.summary.reviewCount, 5); assert.equal(summary.summary.missingReviewCount, 1);
});
await test("CLI rejects URLs, custom roots, traversal, collection and trade commands", () => {
  for (const args of [["--refresh"], ["--trade"], ["--report", "../other"], ["--report", "https://example.com"], ["--root", "other"]]) {
    const r = spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), join(root, "scripts/options-readiness.mjs"), ...args], { encoding: "utf8", timeout: 30000 }); assert.equal(r.status, 2); assert.equal(JSON.parse(r.stderr).executionAllowed, false);
  }
});
await test("help makes no workspace or scheduler access", async () => { const result = await run(["--help"], { workspaceRoot: "nonexistent" }); assert.equal(result.networkAccess, false); assert.match(result.meaning, /No source refresh/); });
await test("mid-read clock rollback fails even when the final time has recovered", () => temporary(async directory => {
  let calls = 0; await assert.rejects(read(directory, () => ++calls === 2 ? "2026-09-07T13:59:59.000Z" : at), /CHECK_CLOCK_REGRESSION/);
}));
await test("v2 recovers seven components while leaving every source and trade byte unchanged", () => temporary(async directory => {
  await seed(directory); await seedBtc(directory); const before=files(directory), v1=await read(directory), original=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error("NO_NETWORK");};
  try { const r=await readContext(directory); assert.equal(r.version,"OPTIONS_OPERATIONAL_READINESS_V2"); assert.equal(r.coreReportSha256,v1.reportSha256); assert.equal(r.evidence.btc.state,"AVAILABLE"); assert.equal(r.evidence.btc.summary.midpointUsd,"80000.005"); assert.equal(r.missingStores.length,0); assert.equal(r.blockedStores.length,0); assert.equal(r.closedPaperReviewCoverage.reviewed,5); assert.equal(r.candidateNotebooks.paper,4); assert.deepEqual(files(directory),before); } finally {globalThis.fetch=original;}
}));
await test("v2 missing optional BTC neither creates storage nor changes v1 next work", () => temporary(async directory => {
  await seed(directory); const r=await readContext(directory); assert.deepEqual(r.missingStores,["btc"]); assert.equal(r.nextStep,(await read(directory)).nextStep); assert.equal(existsSync(join(directory,"data/runtime/options-btc-context")),false);
}));
await test("v2 broken BTC journal preserves paper reviews and sanitizes errors", () => temporary(async directory => {
  await seed(directory); await seedBtc(directory); const path=join(directory,"data/runtime/options-btc-context/retrievals.ndjson"); writeFileSync(path,"PRIVATE_BODY"); const r=await readContext(directory); assert.deepEqual(r.blockedStores,["btc"]); assert.equal(r.evidence.btc.errorCode,"RECOVERY_FAILED"); assert.equal(r.closedPaperReviewCoverage.consistent,true); assert.equal(r.evidence.treasury.state,"AVAILABLE"); assert(!JSON.stringify(r).includes("PRIVATE_BODY")); assert.equal(readFileSync(path,"utf8"),"PRIVATE_BODY");
}));
await test("v2 BTC writer lock blocks only BTC and is never removed", () => temporary(async directory => {
  await seed(directory); await seedBtc(directory); const path=join(directory,"data/runtime/options-btc-context/writer.lock"); writeFileSync(path,"held"); const r=await readContext(directory); assert.equal(r.evidence.btc.errorCode,"STORE_BUSY"); assert.equal(readFileSync(path,"utf8"),"held"); assert.equal(r.evidence.paper.state,"AVAILABLE");
}));
await test("v2 BTC source failure remains available storage without a stale price", () => temporary(async directory => {
  await seed(directory); await seedBtc(directory,true); const r=await readContext(directory); assert.equal(r.evidence.btc.state,"AVAILABLE"); assert.equal(r.evidence.btc.summary.status,"FAILED"); assert.equal(r.evidence.btc.summary.midpointUsd,null); assert.equal(r.evidence.btc.summary.displayFreshAtCheck,false); assert.equal(r.contextNextStep,"REVIEW_BTC_SOURCE_FAILURE"); assert.equal(r.blockedStores.length,0);
}));
await test("v2 path checks reject hard-linked BTC data before recovery", () => temporary(async directory => {
  await seed(directory); await seedBtc(directory); linkSync(join(directory,"data/runtime/options-btc-context/retrievals.ndjson"),join(directory,"btc-alias.ndjson")); const r=await readContext(directory); assert.equal(r.evidence.btc.errorCode,"STORE_UNSAFE"); assert.equal(r.evidence.paper.state,"AVAILABLE");
}));
await test("v2 check and completion clocks follow the v1 completion", () => temporary(async directory => {
  await seed(directory); await seedBtc(directory); let ticks=0; const r=await readContext(directory,()=>new Date(Date.parse(at)+ticks++).toISOString()); assert(r.coreAssessedAt<r.evidence.btc.checkedAt); assert(r.evidence.btc.checkedAt<r.assessedAt); ticks=0; await assert.rejects(readContext(directory,()=>++ticks===8?"2026-09-07T13:59:59.000Z":at),/CHECK_CLOCK_ORDER/);
}));
await test("v2 help describes the extension without reading any store", async () => { const r=await runContext(["--help"],{workspaceRoot:"nonexistent"}); assert.equal(r.version,"OPTIONS_OPERATIONAL_READINESS_V2"); assert.match(r.context,/Seven local components/); assert.equal(r.networkAccess,false); });
console.log(`${passed}/${passed} tests passed.`);
