import assert from 'node:assert/strict';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runRobinhoodObserveCommand as run } from './options-robinhood-observe.mjs';

const source = readFileSync('fixtures/options-robinhood-data/capture.synthetic.json', 'utf8');
const config = readFileSync('fixtures/options-robinhood-data/observation-plan.synthetic.json', 'utf8');
const frozenAt = '2026-09-04T14:00:10.000Z', at = '2026-09-04T14:01:03.000Z';
const hash = v => createHash('sha256').update(v).digest('hex');
let passed = 0;
function test(name, work) {
  const root = mkdtempSync(resolve(tmpdir(), 'alpha-rh-observe-'));
  const study = resolve(root, 'data/runtime/options-robinhood-data/studies/synthetic-observation');
  writeFileSync(resolve(root, 'source.json'), source); writeFileSync(resolve(root, 'plan-input.json'), config);
  const call = (args, now = frozenAt) => run(args, { workspaceRoot: root, now: () => now });
  const freeze = () => call(['--freeze', 'plan-input.json', '--source', 'source.json']);
  const record = (text, now = at) => { writeFileSync(resolve(root, 'frame-input.json'), text); return call(['--record', 'synthetic-observation', '--capture', 'frame-input.json'], now); };
  try { work({ root, study, call, freeze, record }); passed++; console.log(`PASS ${name}`); }
  finally {
    const rel = relative(resolve(tmpdir()), resolve(root));
    if (!rel || isAbsolute(rel) || rel.startsWith('..' + sep) || rel === '..') throw new Error('Unsafe cleanup path');
    rmSync(root, { recursive: true, force: true });
  }
}
function capture(index = 0, edit = () => {}) {
  const value = JSON.parse(source); value.captureId = `observation-${index}`;
  value.calls = value.calls.filter(c => c.tool !== 'get_option_historicals');
  for (const c of value.calls.filter(c => ['get_option_quotes', 'get_equity_quotes'].includes(c.tool))) {
    c.requestedAt = new Date(Date.parse('2026-09-04T14:01:00.000Z') + 60000 * index).toISOString();
    c.receivedAt = new Date(Date.parse(c.requestedAt) + 1000).toISOString();
    const q = c.data.results[0].quote;
    if (c.tool === 'get_option_quotes') { q.updated_at = c.requestedAt; q.ask_price = '0.20'; q.bid_price = '0.18'; }
    else { q.venue_bid_time = c.requestedAt; q.venue_ask_time = c.requestedAt; }
  }
  edit(value); return JSON.stringify(value);
}

test('help and screen perform no persistence or network work', ({ root, call }) => {
  assert.equal(call(['--help']).networkAccess, false); assert.equal(call(['--screen', 'source.json']).status, 'NO_TRADE');
  assert.equal(existsSync(resolve(root, 'data')), false);
});
test('unsupported commands cannot inject an as-of time or tool', ({ call }) => {
  for (const args of [['--record'], ['--screen', 'source.json', '--as-of', at], ['--order', 'GLD'], ['--login']]) assert.throws(() => call(args), /UNSUPPORTED_COMMAND/);
});
test('freeze saves original bytes and first recording clock; restart verifies them', ({ study, call, freeze }) => {
  const first = freeze(), before = readFileSync(resolve(study, 'plan.json'), 'utf8');
  const later = call(['--freeze', 'plan-input.json', '--source', 'source.json'], at);
  assert.equal(first.persistence.reused, false); assert.equal(later.persistence.reused, true);
  assert.equal(later.frozenAt, frozenAt); assert.equal(later.assessedAt, at); assert.equal(readFileSync(resolve(study, 'plan.json'), 'utf8'), before);
});
test('completed windows do not require refreezing or backdating', ({ call, freeze }) => {
  freeze(); const r = call(['--freeze', 'plan-input.json', '--source', 'source.json'], '2026-09-05T14:00:00.000Z');
  assert.equal(r.stage, 'WINDOW_ENDED'); assert.equal(r.persistence.reused, true); assert.equal(r.requestReadyNow, false);
});
test('conflicting freeze input cannot replace a saved plan', ({ root, study, freeze }) => {
  freeze(); const before = hash(readFileSync(resolve(study, 'plan.json')));
  writeFileSync(resolve(root, 'plan-input.json'), config + '\n');
  assert.throws(freeze, /ARTIFACT_REPLAY_MISMATCH/); assert.equal(hash(readFileSync(resolve(study, 'plan.json'))), before);
});
test('a full synthetic freeze-record-review sequence preserves two linked frames', ({ study, call, freeze, record }) => {
  freeze(); record(capture()); const second = record(capture(1), '2026-09-04T14:02:03.000Z');
  const r = call(['--review', 'synthetic-observation'], '2026-09-04T14:02:04.000Z');
  assert.equal(r.frameCount, 2); assert.equal(r.diagnosticUsableObservations, 2); assert.equal(r.tradeCount, 0); assert.equal(r.status, 'NO_REPLAY');
  assert.equal(second.persistence.frame.sequence, 2); assert.equal(readdirSync(study).length, 3);
});
test('identical frame repeats verify and reuse without adding evidence', ({ study, freeze, record }) => {
  freeze(); const a = record(capture()), bytes = readFileSync(resolve(study, 'frame-0001.json'), 'utf8');
  const b = record(capture(), '2026-09-04T14:02:03.000Z');
  assert.equal(a.persistence.reused, false); assert.equal(b.persistence.reused, true); assert.equal(b.frameCount, 1);
  assert.equal(b.persistence.frame.recordedAt, at); assert.equal(readFileSync(resolve(study, 'frame-0001.json'), 'utf8'), bytes);
});
test('capture-ID reuse with changed data fails without replacing records', ({ study, freeze, record }) => {
  freeze(); record(capture()); const before = hash(readFileSync(resolve(study, 'frame-0001.json')));
  assert.throws(() => record(capture(0, v => { v.calls.find(c => c.tool === 'get_option_quotes').data.results[0].quote.bid_price = '0.17'; })), /CAPTURE_ID_CONFLICT/);
  assert.equal(hash(readFileSync(resolve(study, 'frame-0001.json'))), before);
});
test('bad market observations and lessons persist across recovery', ({ call, freeze, record }) => {
  freeze(); record(capture(0, v => { v.calls.find(c => c.tool === 'get_option_quotes').data.results = []; }));
  const r = call(['--review', 'synthetic-observation'], at);
  assert.equal(r.frameCount, 1); assert.equal(r.diagnosticUsableObservations, 0); assert.equal(r.candidateLessons[0].firstRecordedAt, at);
  assert.equal(r.candidateLessons[0].tradeOutcome, null); assert.equal(r.candidateLessons[0].strategyChangeAllowed, false);
});
test('altered artifact hash and partial JSON fail on restart', ({ study, call, freeze }) => {
  freeze(); const path = resolve(study, 'plan.json'), original = readFileSync(path, 'utf8');
  writeFileSync(path, original.replace('synthetic-observation', 'renamed-observation'));
  assert.throws(() => call(['--review', 'synthetic-observation']), /ARTIFACT_HASH/);
  writeFileSync(path, '{'); assert.throws(() => call(['--review', 'synthetic-observation']));
});
test('rehashing a changed derived report does not defeat engine replay verification', ({ study, call, freeze, record }) => {
  freeze(); record(capture()); const path = resolve(study, 'frame-0001.json'), artifact = JSON.parse(readFileSync(path, 'utf8'));
  artifact.frame.status = 'MISREPRESENTED'; const { artifactSha256, ...body } = artifact;
  writeFileSync(path, JSON.stringify({ ...body, artifactSha256: hash(JSON.stringify(body)) }));
  assert.throws(() => call(['--review', 'synthetic-observation'], at), /ARTIFACT_REPLAY_MISMATCH/);
});
test('sequence holes and unknown directory entries cannot be ignored', ({ study, call, freeze, record }) => {
  freeze(); record(capture()); renameSync(resolve(study, 'frame-0001.json'), resolve(study, 'frame-0002.json'));
  assert.throws(() => call(['--review', 'synthetic-observation'], at), /FRAME_SEQUENCE_GAP/);
  writeFileSync(resolve(study, 'uncommitted.tmp'), 'partial'); assert.throws(() => call(['--review', 'synthetic-observation'], at), /UNEXPECTED_STUDY_ENTRY/);
});
test('an abandoned writer lock blocks access and is preserved for investigation', ({ study, call, freeze }) => {
  freeze(); writeFileSync(resolve(study, 'writer.lock'), 'preserve');
  assert.throws(() => call(['--review', 'synthetic-observation']), /STUDY_LOCKED/);
  assert.equal(readFileSync(resolve(study, 'writer.lock'), 'utf8'), 'preserve');
});
test('ordinary validation failures release only their own lock', ({ study, freeze, record }) => {
  freeze(); assert.throws(() => record(source), /FRAME_QUOTE_CALL_SCOPE/); assert.equal(existsSync(resolve(study, 'writer.lock')), false);
});
test('path traversal and invalid study identifiers cannot escape the workspace', ({ root, call }) => {
  assert.throws(() => call(['--screen', '../outside.json']), /PATH_OUTSIDE_WORKSPACE/);
  assert.throws(() => call(['--review', '../escape']), /INVALID_ID/);
  assert.throws(() => call(['--screen', root]), /PATH_OUTSIDE_WORKSPACE/);
});
test('oversized inputs invalid UTF-8 and BOM-prefixed bytes fail', ({ root, call }) => {
  const path = resolve(root, 'bad.json'); writeFileSync(path, ' '.repeat(512 * 1024 + 1));
  assert.throws(() => call(['--screen', path]), /UNSAFE_FILE/);
  writeFileSync(path, Buffer.from([0xff])); assert.throws(() => call(['--screen', path]));
  writeFileSync(path, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(source)])); assert.throws(() => call(['--screen', path]), /UTF8_BOM_REFUSED/);
});
test('hard-linked source files and directory junctions are refused', ({ root, call }) => {
  linkSync(resolve(root, 'source.json'), resolve(root, 'hard.json'));
  assert.throws(() => call(['--screen', 'hard.json']), /UNSAFE_FILE/);
  mkdirSync(resolve(root, 'real')); writeFileSync(resolve(root, 'real/source.json'), source);
  symlinkSync(resolve(root, 'real'), resolve(root, 'junction'), 'junction');
  assert.throws(() => call(['--screen', 'junction/source.json']), /LINK_REFUSED/);
});
test('frame hard-links are refused on recovery', ({ study, root, call, freeze, record }) => {
  freeze(); record(capture()); linkSync(resolve(study, 'frame-0001.json'), resolve(root, 'frame-copy.json'));
  assert.throws(() => call(['--review', 'synthetic-observation'], at), /UNSAFE_FILE/);
});
test('template preserves source catalog calls and yields no credentials or execution', ({ call, freeze }) => {
  freeze(); const result = call(['--template', 'synthetic-observation']);
  assert.equal(result.catalogCalls.length, 2); assert.equal(result.next.nextRequests.length, 2);
  assert.equal(result.next.automaticCollectionEnabled, false); assert.equal(result.next.executionAllowed, false);
  assert.deepEqual(result.catalogCalls, JSON.parse(source).calls.slice(0, 2));
});
test('CLI subprocess help has a stable command boundary', () => {
  const result = spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), resolve('scripts/options-robinhood-observe.mjs'), '--help'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).networkAccess, false);
});
console.log(`${passed}/${passed} tests passed.`);
