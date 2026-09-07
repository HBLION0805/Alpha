import assert from 'node:assert/strict';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { runRobinhoodCloseoutCommand as closeout } from './options-robinhood-closeout.mjs';
import { runRobinhoodCollectCommand as collect, readRobinhoodCollectionSnapshot } from './options-robinhood-collect.mjs';
import { runRobinhoodObserveCommand as observe } from './options-robinhood-observe.mjs';
import { closeoutRobinhoodCollection } from '../src/engines/options-robinhood-data/RobinhoodCloseoutEngine.ts';

const source = readFileSync('fixtures/options-robinhood-data/capture.synthetic.json', 'utf8');
const config = readFileSync('fixtures/options-robinhood-data/observation-plan.synthetic.json', 'utf8');
const frozenAt = '2026-09-04T14:00:10.000Z', studyId = 'synthetic-observation';
const time = (i, seconds = 0) => new Date(Date.parse('2026-09-04T14:01:00.000Z') + i * 60000 + seconds * 1000).toISOString();
const hash = text => createHash('sha256').update(text).digest('hex');
const rehash = record => { const { artifactSha256, ...body } = record; return { ...body, artifactSha256: hash(JSON.stringify(body)) }; };
function reply(i = 0, failed = false) {
  const outcomes = JSON.parse(source).calls.filter(c => ['get_option_quotes', 'get_equity_quotes'].includes(c.tool));
  for (const c of outcomes) {
    c.requestedAt = time(i); c.receivedAt = time(i, 1);
    if (c.tool === 'get_option_quotes') { c.data.results[0].quote.updated_at = time(i); c.data.results[0].quote.bid_price = '0.18'; c.data.results[0].quote.ask_price = '0.20'; }
    else { c.data.results[0].quote.venue_bid_time = time(i); c.data.results[0].quote.venue_ask_time = time(i); }
  }
  if (failed) { delete outcomes[0].data; outcomes[0].errorCode = 'TOOL_FAILED'; }
  return Buffer.from(JSON.stringify({ schemaVersion: '1.0', attemptId: 'attempt-' + i, outcomes })).toString('base64');
}
let passed = 0;
function test(name, work) {
  const root = mkdtempSync(resolve(tmpdir(), 'alpha-rh-closeout-'));
  const reports = resolve(root, 'data/runtime/options-robinhood-data/collection-reports', studyId);
  const attempts = resolve(root, 'data/runtime/options-robinhood-data/collection-attempts', studyId);
  writeFileSync(resolve(root, 'source.json'), source); writeFileSync(resolve(root, 'config.json'), config);
  const opts = at => ({ workspaceRoot: root, now: () => at });
  observe(['--freeze', 'config.json', '--source', 'source.json'], opts(frozenAt));
  const run = (mode = '--report', at = frozenAt) => closeout([mode, studyId], opts(at));
  const accept = (i = 0, failed = false) => collect(['--accept-base64', studyId, reply(i, failed)], opts(time(i, 2)));
  const savedPath = receipt => resolve(root, receipt.persistence.path);
  try { work({ root, reports, attempts, run, accept, opts, savedPath }); passed++; console.log(`PASS ${name}`); }
  finally { const rel = relative(resolve(tmpdir()), root); if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw Error('Unsafe test cleanup'); rmSync(root, { recursive: true, force: true }); }
}
test('help and unsupported input cannot trigger a source or add arbitrary timestamps', ({ root, opts }) => {
  assert.equal(closeout(['--help'], opts(frozenAt)).networkAccess, false);
  for (const args of [['--order', studyId], ['--save', studyId, '--as-of', frozenAt], ['--save', '../outside']]) assert.throws(() => closeout(args, opts(frozenAt)));
  assert.equal(existsSync(resolve(root, 'outside')), false);
});
test('a pending report creates no collection attempts or report directory', ({ reports, attempts, run }) => {
  const r = run(); assert.equal(r.stage, 'WAITING_FOR_WINDOW'); assert.equal(r.elapsedSlotCount, 0); assert.equal(r.completedCoverage.requestCoverageBps, null);
  assert.equal(existsSync(reports), false); assert.equal(existsSync(attempts), false);
});
test('exclusive save preserves actual assessment time and exact same-time retry', ({ run, savedPath, reports }) => {
  const a = run('--save'), bytes = readFileSync(savedPath(a), 'utf8'), b = run('--save');
  assert.equal(a.persistence.reused, false); assert.equal(b.persistence.reused, true); assert.equal(b.assessedAt, frozenAt);
  assert.equal(readFileSync(savedPath(a), 'utf8'), bytes); assert.equal(readdirSync(reports).length, 1);
});
test('later report saves a new snapshot without rewriting earlier clocks', ({ run, savedPath }) => {
  const a = run('--save'), bytes = readFileSync(savedPath(a), 'utf8'), b = run('--save', time(1));
  assert.notEqual(a.persistence.reportSha256, b.persistence.reportSha256); assert.equal(readFileSync(savedPath(a), 'utf8'), bytes);
  assert.equal(b.elapsedSlotCount, 1); assert.equal(b.completedCoverage.requestCoverageBps, 0);
});
test('old empty-prefix report recovers after a later successful attempt', ({ run, accept, savedPath }) => {
  const a = run('--save'), bytes = readFileSync(savedPath(a), 'utf8'); accept(); const b = run('--save', time(1));
  assert.equal(b.totals.automaticAttempts, 1); assert.equal(b.totals.savedFrames, 1); assert.equal(b.completedCoverage.completeUsableCoverageBps, 10000);
  assert.equal(readFileSync(savedPath(a), 'utf8'), bytes);
});
test('failed and successful records retain separate coverage and immutable histories', ({ run, accept, savedPath }) => {
  accept(0, true); const a = run('--save', time(1)), bytes = readFileSync(savedPath(a), 'utf8'); accept(1);
  const b = run('--save', time(2)); assert.equal(b.totals.sourceFailureAttempts, 1); assert.equal(b.totals.savedFrames, 1);
  assert.equal(b.completedCoverage.requestCoverageBps, 10000); assert.equal(b.completedCoverage.frameCoverageBps, 5000); assert.equal(readFileSync(savedPath(a), 'utf8'), bytes);
});
test('the reporting snapshot excludes raw data and preserves real attempt identity', ({ root, opts, accept }) => {
  accept(0, true); const snapshot = readRobinhoodCollectionSnapshot(studyId, opts(time(1)));
  assert.equal(snapshot.attempts[0].sourceCalls[0].errorCode, 'TOOL_FAILED'); assert.equal(snapshot.attempts[0].attemptId, 'attempt-0');
  assert(!JSON.stringify(snapshot.attempts).includes('results')); assert(!JSON.stringify(snapshot.attempts).includes('replyText')); assert(!Object.hasOwn(snapshot, 'artifact'));
});
test('truncated report artifacts block report and save without repair', ({ run, savedPath }) => {
  const path = savedPath(run('--save')); writeFileSync(path, '{');
  assert.throws(() => run()); assert.throws(() => run('--save')); assert.equal(readFileSync(path, 'utf8'), '{');
});
test('recomputed container hash cannot hide changed coverage arithmetic', ({ run, savedPath }) => {
  const path = savedPath(run('--save')); const record = JSON.parse(readFileSync(path, 'utf8'));
  record.report.completedCoverage.requestCoverageBps = 10000; writeFileSync(path, JSON.stringify(rehash(record)));
  assert.throws(() => run(), /REPORT_REPLAY_MISMATCH/);
});
test('renamed report hash cannot create another valid report identity', ({ run, savedPath, reports }) => {
  const path = savedPath(run('--save')), other = resolve(reports, 'report-' + '0'.repeat(64) + '.json');
  renameSync(path, other); assert.throws(() => run(), /REPORT_REPLAY_MISMATCH/);
});
test('past reports cannot hide a changed underlying attempt', ({ run, accept, attempts }) => {
  accept(0, true); run('--save', time(1)); const path = resolve(attempts, 'attempt-0.json');
  const record = JSON.parse(readFileSync(path, 'utf8')); record.status = 'FRAME_RECORDED'; writeFileSync(path, JSON.stringify(rehash(record)));
  assert.throws(() => run('--report', time(2)), /ATTEMPT_CONFLICT/);
});
test('missing input references cannot be replaced with invented fingerprints', ({ run, savedPath, accept }) => {
  accept(); const path = savedPath(run('--save', time(1))); const record = JSON.parse(readFileSync(path, 'utf8'));
  record.report.input.attemptSha256s[0] = '0'.repeat(64); writeFileSync(path, JSON.stringify(rehash(record)));
  assert.throws(() => run('--report', time(2)), /REPORT_INPUT_REFS/);
});
test('a recomputed report cannot silently omit an earlier attempt from its prefix', ({ run, savedPath, accept, opts, reports }) => {
  accept(0, true); accept(1, true); const path = savedPath(run('--save', time(2)));
  const snapshot = readRobinhoodCollectionSnapshot(studyId, opts(time(2)));
  const record = JSON.parse(readFileSync(path, 'utf8'));
  record.report = closeoutRobinhoodCollection(snapshot.plan, [], [snapshot.attempts[1]], time(2));
  writeFileSync(path, JSON.stringify(rehash(record)));
  renameSync(path, resolve(reports, 'report-' + record.report.reportSha256 + '.json'));
  assert.throws(() => run('--report', time(3)), /REPORT_INPUT_REFS/);
});
test('hard-linked report files are refused', ({ run, savedPath, root }) => {
  const path = savedPath(run('--save')); linkSync(path, resolve(root, 'linked-report.json')); assert.throws(() => run(), /UNSAFE_FILE/);
});
test('unrecognized report directory entries are not ignored', ({ run, reports }) => {
  run('--save'); writeFileSync(resolve(reports, 'partial.tmp'), 'incomplete'); assert.throws(() => run(), /REPORT_DIRECTORY_ENTRY/);
});
test('bounded report directories reject excess entries before reading bodies', ({ run, reports }) => {
  mkdirSync(reports, { recursive: true }); for (let i = 0; i < 121; i++) writeFileSync(resolve(reports, 'report-' + i.toString(16).padStart(64, '0') + '.json'), '{}');
  assert.throws(() => run(), /REPORT_LIMIT/);
});
test('an existing report lock is respected without deletion', ({ run, reports }) => {
  run('--save'); writeFileSync(resolve(reports, 'writer.lock'), 'held'); assert.throws(() => run(), /STUDY_LOCKED/); assert(existsSync(resolve(reports, 'writer.lock')));
});
test('moving the assessment clock backwards cannot hide a later saved report', ({ run }) => {
  run('--save', time(1)); assert.throws(() => run('--report', time(0, 5)), /REPORT_CLOCK_ROLLBACK/);
});
test('a missing automatic attempt stays visible after partial-save recovery', ({ run, accept, attempts, root }) => {
  accept(); const path = resolve(attempts, 'attempt-0.json'); renameSync(path, resolve(root, 'pending-attempt.json'));
  const report = run('--report', time(1)); assert.equal(report.totals.savedFrames, 1); assert.equal(report.totals.automaticAttempts, 0); assert.equal(report.totals.unlinkedAutomaticFrames, 1);
});
console.log(`${passed}/${passed} tests passed.`);
