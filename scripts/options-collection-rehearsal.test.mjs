import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runOptionsCollectionRehearsalCommand as run, collectionRehearsalInternals as internal } from './options-collection-rehearsal.mjs';
import { runRobinhoodCloseoutCommand } from './options-robinhood-closeout.mjs';

const root = resolve(import.meta.dirname, '..'), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const protectedFiles = ['docs/OPTIONS_ROBINHOOD_AUTOCOLLECTION_RUNBOOK.md', 'docs/OPTIONS_ROBINHOOD_HEARTBEAT_PHASES.json', 'docs/OPTIONS_MARKET_CONTEXT_HEARTBEAT_RESTORE_V4.json', 'fixtures/options-robinhood-data/capture.synthetic.json', 'fixtures/options-robinhood-data/observation-plan.synthetic.json', 'scripts/options-robinhood-collect.mjs', 'scripts/options-robinhood-observe.mjs', 'scripts/options-robinhood-closeout.mjs'];
const before = Object.fromEntries(protectedFiles.map(p => [p, hash(readFileSync(join(root, p)))]));
const document = readFileSync(join(root, protectedFiles[0]), 'utf8'), body = internal.hostBody(document);
let passed = 0, receipt, networkCalls = 0;
async function test(name, work) { await work(); passed++; console.log(`PASS ${name}`); }
function scenario(name) { const item = receipt.scenarios.find(s => s.scenario === name); return JSON.parse(readFileSync(join(item.scenarioDirectory, 'rehearsal.json'), 'utf8')); }
try {
  await test('unsupported commands cannot choose an output root source or simulation clock', async () => { for (const args of [[], ['--run', '--root', '../escape'], ['--refresh'], ['--run', '--at', '2026-09-08']]) await assert.rejects(run(args), /ARGUMENTS/); });
  await test('unrecognized or altered host programs fail before dynamic execution', () => { assert.throws(() => internal.hostBody('No code'), /HOST_BLOCK/); assert.throws(() => internal.hostBody(document.replace('const study =', 'const alteredStudy =')), /HOST_PROGRAM_CHANGED/); assert.throws(() => internal.hostBody(document + '\n```javascript\nthrow Error("UNTRUSTED")\n```'), /HOST_BLOCK/); assert.throws(() => internal.bindHost(body + ';', 'dir', 'study', 'f'.repeat(64)), /HOST_PROGRAM_CHANGED/); });
  await test('test bindings change only fixed literals while retaining the original program hash', () => { const r = internal.bindHost(body, 'synthetic-directory', 'synthetic-study', 'a'.repeat(64)); assert.equal(r.controlFlowChanged, false); assert.equal(r.originalHostSha256, hash(body)); assert.equal(r.syntheticHostSha256, hash(r.body)); assert.equal(r.substitutions.length, 4); assert(r.body.includes('args:{symbols:["GLD","IBIT"]}')); assert(r.body.includes('Promise.all(expected.map')); assert(!r.body.includes('gld-ibit-observe-open-20260908')); });
  await test('fixture expansion remains synthetic with four contracts and both target ETFs', () => { const f = internal.fixture('synthetic-test'); assert.equal(f.source.declaredOrigin, 'SYNTHETIC'); assert.equal(f.config.calendar.dataOrigin, 'FIXTURE'); assert.equal(f.config.instrumentIds.length, 4); assert.deepEqual(f.equityTemplate.results.map(r => r.quote.symbol), ['GLD', 'IBIT']); assert(!f.source.calls.some(c => c.tool === 'get_option_historicals')); });
  await test('all fixed windows exercise actual local repositories without network access', async () => {
    const original = globalThis.fetch; globalThis.fetch = async () => { networkCalls++; throw Error('NETWORK_FORBIDDEN'); };
    try { receipt = await run(['--run']); } finally { globalThis.fetch = original; }
    assert.equal(receipt.status, 'ENGINEERING_REHEARSAL_PASSED'); assert.equal(receipt.scenarioCount, 3); assert.equal(networkCalls, 0); assert.equal(receipt.realSourceCalls, 0); assert.equal(receipt.shellCalls, 0);
  });
  await test('healthy window records all twenty complete four-contract slots', () => { const s = scenario('healthy'); assert.deepEqual(s.counts, { attempts: 20, failures: 0, frames: 20, usableSlots: 20, usableObservations: 80 }); assert.deepEqual(s.gaps, []); assert.equal(s.fakeSourceCalls, 40); assert.equal(s.operationalLessons.length, 0); });
  await test('mixed window distinguishes two source failures from missing requests and invalid frames', () => {
    const s = scenario('mixed'); assert.deepEqual(s.counts, { attempts: 19, failures: 2, frames: 17, usableSlots: 13, usableObservations: 58 });
    assert.equal(s.gaps.filter(g => g.reason === 'NO_RECORDED_REQUEST').reduce((n, g) => n + g.slotCount, 0), 1);
    assert.equal(s.gaps.filter(g => g.reason === 'NO_RECORDED_FRAME').reduce((n, g) => n + g.slotCount, 0), 3);
    assert.equal(s.gaps.filter(g => g.reason === 'NO_COMPLETE_USABLE_CONTRACT_SET').reduce((n, g) => n + g.slotCount, 0), 7);
    assert.deepEqual(s.operationalLessons.map(l => l.code), ['SOURCE_FAILURE_IS_NOT_MARKET_INACTIVITY', 'SCHEDULE_GAPS_CANNOT_BE_BACKFILLED_WITH_ASSUMED_QUOTES']);
  });
  await test('late final response is saved as excluded evidence without being shifted into the window', () => {
    const s = scenario('mixed'); assert.equal(s.simulatedAssessedAt, '2026-09-04T14:21:05.000Z');
    assert.equal(s.sourceOutcomes.filter(r => r.slot === 19).length, 2); assert(s.sourceOutcomes.filter(r => r.slot === 19).every(r => r.receivedAt === s.simulatedAssessedAt));
    assert(s.sourceBlockerCounts.some(c => c.code === 'OUTSIDE_DECLARED_WINDOW' && c.frameCount === 1));
  });
  await test('slow response model skips busy wakes and never converts stale samples into usable quotes', () => { const s = scenario('slow'); assert.deepEqual(s.counts, { attempts: 10, failures: 0, frames: 10, usableSlots: 0, usableObservations: 0 }); assert.equal(s.events.filter(e => e.skipped === 'PRIOR_TICK_BUSY_IN_DECLARED_MODEL').length, 10); assert.equal(s.completedCoverage.requestCoverageBps, 5000); assert.equal(s.completedCoverage.completeUsableCoverageBps, 0); assert(s.sourceBlockerCounts.some(c => /STALE/.test(c.code))); });
  await test('saved closeouts reopen identically and same-clock saves reuse their original files', () => { for (const item of receipt.scenarios) { const s = scenario(item.scenario), r = runRobinhoodCloseoutCommand(['--report', s.studyId], { workspaceRoot: item.scenarioDirectory, now: () => s.simulatedAssessedAt }); assert.equal(r.reportSha256, item.finalReportSha256); assert.equal(item.preWindowBytesUnchanged, true); assert.equal(item.sameClockSaveReused, true); } });
  await test('candidate lessons retain scenario clocks and cannot assert actual trade causes', () => { for (const name of ['mixed', 'slow']) { const s = scenario(name); for (const l of [...s.operationalLessons, ...s.observationLessons]) { assert.equal(l.status, 'CANDIDATE_DATA_QUALITY_RULE'); assert.equal(l.tradeOutcome, null); assert.equal(l.strategyChangeAllowed, false); assert((l.firstKnownAt ?? l.firstRecordedAt).startsWith('2026-09-04')); } assert.equal(s.tradeCount, 0); } assert.match(receipt.clockBasis, /SEPARATE_ACTUAL_RUN_CLOCKS/); assert(receipt.actualStartedAt <= receipt.actualCompletedAt); });
  await test('provider errors and guides cannot leak into any retained rehearsal file', () => { const walk = directory => { for (const e of readdirSync(directory, { withFileTypes: true })) { const p = join(directory, e.name); if (e.isDirectory()) walk(p); else assert(!/INJECTED_PRIVATE_PROVIDER_MESSAGE|INJECTED_UNTRUSTED_GUIDE/.test(readFileSync(p, 'utf8'))); } }; walk(receipt.evidenceDirectory); });
  await test('receipt is hash-bound and cannot claim live scheduler or transaction success', () => { const { receiptSha256, ...payload } = receipt; assert.equal(receiptSha256, hash(JSON.stringify(payload))); assert.equal(receipt.hostSchedulerActuallyTested, false); assert.equal(receipt.sourceThatNeverSettlesTested, false); assert.equal(receipt.activeSourceAppends, 0); assert.equal(receipt.hostMutations, 0); assert.equal(receipt.executionAllowed, false); assert.equal(receipt.realPriceReplayReady, false); assert.equal(receipt.winProbability, null); assert.equal(receipt.sourceOrigin, 'SYNTHETIC'); });
  await test('production inputs and program bytes stay unchanged after the complete rehearsal', () => { for (const [p, sha] of Object.entries(before)) assert.equal(hash(readFileSync(join(root, p))), sha); });
  await test('CLI help describes fixed synthetic temporary evidence and no market calls', () => { const r = spawnSync(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), join(root, 'scripts/options-collection-rehearsal.mjs'), '--help'], { encoding: 'utf8', timeout: 30000 }); assert.equal(r.status, 0); assert.match(JSON.parse(r.stdout).meaning, /No network, shell/); });
} finally {
  if (receipt) { const rel = relative(realpathSync(tmpdir()), realpathSync(receipt.evidenceDirectory)); if (isAbsolute(rel) || rel.startsWith('..') || !rel.startsWith('alpha-collection-rehearsal-')) throw Error('UNSAFE_TEST_CLEANUP'); rmSync(receipt.evidenceDirectory, { recursive: true }); }
}
console.log(`${passed}/${passed} tests passed.`);
