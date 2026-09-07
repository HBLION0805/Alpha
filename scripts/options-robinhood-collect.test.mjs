import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { runRobinhoodCollectCommand as collect } from './options-robinhood-collect.mjs';
import { runRobinhoodObserveCommand as observe } from './options-robinhood-observe.mjs';

const source = readFileSync('fixtures/options-robinhood-data/capture.synthetic.json', 'utf8');
const config = readFileSync('fixtures/options-robinhood-data/observation-plan.synthetic.json', 'utf8');
const freezeAt = '2026-09-04T14:00:10.000Z', at = '2026-09-04T14:01:04.000Z';
const encoded = v => Buffer.from(JSON.stringify(v), 'utf8').toString('base64');
const hash = v => createHash('sha256').update(v).digest('hex');
let passed = 0;
function test(name, work) {
  const root = mkdtempSync(resolve(tmpdir(), 'alpha-rh-collect-'));
  writeFileSync(resolve(root, 'source.json'), source); writeFileSync(resolve(root, 'config.json'), config);
  const opts = time => ({ workspaceRoot: root, now: () => time });
  observe(['--freeze', 'config.json', '--source', 'source.json'], opts(freezeAt));
  const call = (args, time = at) => collect(args, opts(time));
  const prep = (time = at) => call(['--prepare', 'synthetic-observation'], time);
  const accept = (reply, time = at) => call(['--accept-base64', 'synthetic-observation', encoded(reply)], time);
  const review = (time = at) => observe(['--review', 'synthetic-observation'], opts(time));
  const attemptDir = resolve(root, 'data/runtime/options-robinhood-data/collection-attempts/synthetic-observation');
  try { work({ root, attemptDir, call, prep, accept, review }); passed++; console.log(`PASS ${name}`); }
  finally { const rel = relative(resolve(tmpdir()), root); if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw Error('Unsafe test cleanup'); rmSync(root, { recursive: true, force: true }); }
}
function reply(index = 0) {
  const outcomes = JSON.parse(source).calls.filter(c => ['get_option_quotes', 'get_equity_quotes'].includes(c.tool));
  for (const c of outcomes) {
    c.requestedAt = new Date(Date.parse('2026-09-04T14:01:01.000Z') + index * 60000).toISOString();
    c.receivedAt = new Date(Date.parse(c.requestedAt) + 1000).toISOString();
    if (c.tool === 'get_option_quotes') c.data.results[0].quote.updated_at = c.requestedAt;
    else { c.data.results[0].quote.venue_bid_time = c.requestedAt; c.data.results[0].quote.venue_ask_time = c.requestedAt; }
  }
  return { schemaVersion: '1.0', attemptId: `attempt-${index}`, outcomes };
}
function failed(index = 0) { const r = reply(index); delete r.outcomes[0].data; r.outcomes[0].errorCode = 'TOOL_FAILED'; return r; }

test('pre-window preparation emits no requests and creates no attempts', ({ prep, attemptDir }) => {
  const r = prep(freezeAt); assert.equal(r.action, 'WAIT'); assert.deepEqual(r.requests, []); assert.equal(existsSync(attemptDir), false);
});
test('ready preparation emits only the exact frozen option and equity arguments', ({ prep }) => {
  const r = prep(); assert.equal(r.action, 'COLLECT'); assert.deepEqual(r.requests.map(v => v.tool), ['get_option_quotes', 'get_equity_quotes']);
  assert.deepEqual(r.requests[1].args, { symbols: ['GLD'] }); assert.equal(r.executionAllowed, false); assert.equal(r.networkAccess, false);
});
test('window end returns FINISH without preparing market calls', ({ prep }) => {
  const r = prep('2026-09-04T14:11:00.000Z'); assert.equal(r.action, 'FINISH'); assert.deepEqual(r.requests, []);
});
test('successful replies use the original catalog and persist a verified source frame', ({ root, accept, review }) => {
  const r = accept(reply()); assert.equal(r.status, 'FRAME_RECORDED'); assert.equal(r.executionAllowed, false); assert.equal(review().frameCount, 1);
  const dir = resolve(root, 'data/runtime/options-robinhood-data/automatic-captures');
  const saved = JSON.parse(readFileSync(resolve(dir, readdirSync(dir)[0]), 'utf8'));
  assert.deepEqual(saved.calls.slice(0, 2), JSON.parse(source).calls.slice(0, 2));
  assert.equal(saved.calls[2].requestedAt, reply().outcomes[0].requestedAt); assert.equal(review().tradeCount, 0);
});
test('repeat delivery preserves first recording time and original file bytes', ({ attemptDir, accept, review }) => {
  accept(reply()); const path = resolve(attemptDir, 'attempt-0.json'), bytes = readFileSync(path, 'utf8');
  const r = accept(reply(), '2026-09-04T14:02:04.000Z'); assert.equal(r.reused, true); assert.equal(r.recordedAt, at); assert.equal(readFileSync(path, 'utf8'), bytes); assert.equal(review().frameCount, 1);
});
test('conflicting attempt IDs cannot overwrite earlier data', ({ accept }) => {
  accept(reply()); const changed = reply(); changed.outcomes[0].data.results[0].quote.bid_price = '0.22';
  assert.throws(() => accept(changed), /ATTEMPT_CONFLICT/);
});
test('one source failure is durable and never becomes a fake successful frame', ({ accept, review, prep }) => {
  const r = accept(failed()); assert.equal(r.status, 'SOURCE_CALL_FAILED'); assert.equal(r.frameSha256, null); assert.equal(review().frameCount, 0);
  const next = prep(); assert.equal(next.sourceFailureCount, 1); assert.equal(next.action, 'WAIT');
});
test('a later successful batch follows a failed attempt without changing its evidence', ({ accept, prep, review }) => {
  accept(failed()); accept(reply(1), '2026-09-04T14:02:04.000Z');
  assert.equal(review('2026-09-04T14:02:04.000Z').frameCount, 1); assert.equal(prep('2026-09-04T14:03:04.000Z').attemptCount, 2);
});
test('failed calls also enforce the minimum collection cadence', ({ accept }) => {
  accept(failed()); const r = failed(); r.attemptId = 'different'; assert.throws(() => accept(r), /ATTEMPT_CADENCE_OR_CLOCK/);
});
test('requests outside the frozen window are rejected before source files are saved', ({ accept, attemptDir }) => {
  const r = reply(); r.outcomes[0].requestedAt = freezeAt;
  assert.throws(() => accept(r), /REQUEST_CLOCK_OR_WINDOW/); assert.equal(existsSync(attemptDir), false);
});
test('actually in-window requests received after close are retained as unusable evidence', ({ accept, review }) => {
  const r = reply(9); r.outcomes.forEach(o => { o.receivedAt = '2026-09-04T14:11:01.000Z'; });
  accept(r, '2026-09-04T14:11:02.000Z'); const result = review('2026-09-04T14:11:03.000Z');
  assert.equal(result.frameCount, 1); assert.equal(result.diagnosticUsableObservations, 0); assert(result.blockers.includes('OUTSIDE_DECLARED_WINDOW'));
});
test('extra symbols unapproved tools and altered instrument selection fail', ({ accept }) => {
  for (const alter of [r => { r.outcomes[1].args.symbols = ['AAPL']; }, r => { r.outcomes[0].tool = 'place_option_order'; }, r => { r.outcomes[0].args.instrument_ids = []; }]) {
    const r = reply(); alter(r); assert.throws(() => accept(r), /REQUEST_SCOPE/);
  }
});
test('missing outcomes and data/error mixtures cannot masquerade as a complete batch', ({ accept }) => {
  const a = reply(); a.outcomes.pop(); assert.throws(() => accept(a), /OUTCOME_COUNT/);
  const b = reply(); b.outcomes[0].errorCode = 'TOOL_FAILED'; assert.throws(() => accept(b), /OUTCOME_SHAPE/);
});
test('failure records cannot smuggle credentials or arbitrary provider error text', ({ accept }) => {
  const a = failed(); a.outcomes[1].data.results[0].quote.access_token = 'DO_NOT_STORE'; assert.throws(() => accept(a), /FORBIDDEN_DATA_FIELD/);
  const b = failed(); b.outcomes[0].errorCode = 'private error body'; assert.throws(() => accept(b), /ERROR_CODE/);
});
test('future receive clocks and clock rollback are rejected', ({ accept, prep }) => {
  const r = reply(); r.outcomes[0].receivedAt = '2026-09-04T14:02:00.000Z'; assert.throws(() => accept(r), /REQUEST_CLOCK_OR_WINDOW/);
  accept(failed()); assert.throws(() => prep('2026-09-04T14:01:03.000Z'), /CLOCK_ROLLBACK/);
});
test('bounded canonical base64 strict UTF-8 and JSON are enforced', ({ call }) => {
  for (const value of ['a;whoami', 'a'.repeat(40000), Buffer.from([0xff]).toString('base64'), Buffer.from('{').toString('base64')]) assert.throws(() => call(['--accept-base64', 'synthetic-observation', value]));
});
test('attempt corruption is detected during preparation', ({ attemptDir, accept, prep }) => {
  accept(failed()); writeFileSync(resolve(attemptDir, 'attempt-0.json'), '{}'); assert.throws(prep, /ARTIFACT_SHAPE/);
});
test('recomputed hash cannot turn a source failure into a frame', ({ attemptDir, accept, prep }) => {
  accept(failed()); const path = resolve(attemptDir, 'attempt-0.json'), record = JSON.parse(readFileSync(path, 'utf8'));
  record.status = 'FRAME_RECORDED'; const { artifactSha256, ...payload } = record;
  writeFileSync(path, JSON.stringify({ ...payload, artifactSha256: hash(JSON.stringify(payload)) })); assert.throws(prep, /ATTEMPT_CONFLICT/);
});
test('partial attempt write recovers the already-saved original frame', ({ attemptDir, root, accept, review }) => {
  const first = accept(reply());
  const path = resolve(attemptDir, 'attempt-0.json');
  // Simulate a crash before the attempt file was created, with its source/frame durable.
  rmSync(path); const again = accept(reply(), '2026-09-04T14:02:04.000Z');
  assert.equal(again.frameSha256, first.frameSha256); assert.equal(review('2026-09-04T14:02:04.000Z').frameCount, 1);
  assert.equal(readdirSync(resolve(root, 'data/runtime/options-robinhood-data/automatic-captures')).length, 1);
});
test('source artifacts are still verified during later attempt reads', ({ root, accept, prep }) => {
  accept(reply()); const dir = resolve(root, 'data/runtime/options-robinhood-data/automatic-captures');
  writeFileSync(resolve(dir, readdirSync(dir)[0]), '{}'); assert.throws(prep, /ATTEMPT_CONFLICT/);
});
console.log(`${passed}/${passed} tests passed.`);
