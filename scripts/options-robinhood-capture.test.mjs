import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, mkdirSync, symlinkSync, linkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runRobinhoodCaptureCommand as run } from './options-robinhood-capture.mjs';

const tempRoot = realpathSync(tmpdir()), workspace = mkdtempSync(resolve(tempRoot, 'alpha-rh-capture-'));
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'fixtures/options-robinhood-data/capture.synthetic.json'), 'utf8');
const firstAt = '2026-09-04T14:00:10.000Z', secondAt = '2026-09-04T14:05:00.000Z';
const options = { workspaceRoot: workspace, now: () => firstAt };
let passed = 0;
function test(name, work) { work(); passed++; console.log(`PASS ${name}`); }
function input(id) { const capture = JSON.parse(source); capture.captureId = id; const path = id + '.json'; writeFileSync(resolve(workspace, path), JSON.stringify(capture)); return path; }
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('UNEXPECTED_NETWORK'); };
try {
  test('inspection is read-only and never uses network', () => {
    const path = input('read-only'), before = readdirSync(workspace);
    const r = run(['--inspect', path], options); assert.equal(r.persistence, null); assert.equal(r.executionAllowed, false); assert.deepEqual(readdirSync(workspace), before);
  });
  test('immutable save preserves original clock while each read gets a new assessment', () => {
    const path = input('saved'); const a = run(['--inspect', path, '--save'], options);
    const bytes = readFileSync(resolve(workspace, a.persistence.path), 'utf8');
    const b = run(['--inspect', path, '--save'], { ...options, now: () => secondAt });
    assert.equal(a.persistence.reused, false); assert.equal(b.persistence.reused, true);
    assert.equal(b.persistence.recordedAt, firstAt); assert.equal(b.assessedAt, secondAt);
    assert.equal(bytes, readFileSync(resolve(workspace, b.persistence.path), 'utf8'));
    assert(b.quotes[0].blockers.includes('STALE_AT_ASSESSMENT'));
  });
  test('changed bytes cannot overwrite an accepted capture ID', () => {
    const path = input('changed'); const r = run(['--inspect', path, '--save'], options);
    const prior = readFileSync(resolve(workspace, r.persistence.path), 'utf8');
    writeFileSync(resolve(workspace, path), readFileSync(resolve(workspace, path), 'utf8') + '\n');
    assert.throws(() => run(['--inspect', path, '--save'], options), /CONFLICT_OR_CORRUPTION/);
    assert.equal(readFileSync(resolve(workspace, r.persistence.path), 'utf8'), prior);
  });
  test('partial and tampered artifacts fail without repair or replacement', () => {
    for (const body of ['{', '{}']) {
      const path = input('broken' + body.length), r = run(['--inspect', path, '--save'], options);
      writeFileSync(resolve(workspace, r.persistence.path), body);
      assert.throws(() => run(['--inspect', path, '--save'], options), /CONFLICT_OR_CORRUPTION/);
      assert.equal(readFileSync(resolve(workspace, r.persistence.path), 'utf8'), body);
    }
  });
  test('tampered report checksum is detected on recovery', () => {
    const path = input('report-tamper'), r = run(['--inspect', path, '--save'], options);
    const artifactPath = resolve(workspace, r.persistence.path), artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
    artifact.originalAssessment.executionAllowed = true; writeFileSync(artifactPath, JSON.stringify(artifact));
    assert.throws(() => run(['--inspect', path, '--save'], options), /CONFLICT_OR_CORRUPTION/);
  });
  test('oversized non-UTF8 malformed and directory inputs cannot be inspected or saved', () => {
    for (const bytes of [Buffer.from([0xff]), Buffer.alloc(512 * 1024 + 1), Buffer.from('{')]) {
      writeFileSync(resolve(workspace, 'invalid.json'), bytes);
      assert.throws(() => run(['--inspect', 'invalid.json', '--save'], options), /REJECTED|INVALID_JSON/);
    }
    assert.throws(() => run(['--inspect', 'data'], options), /REJECTED/);
  });
  test('outside-workspace input and hardlinks are refused', () => {
    assert.throws(() => run(['--inspect', '../missing.json'], options), /REJECTED/);
    const path = input('hardlink-source'); linkSync(resolve(workspace, path), resolve(workspace, 'hardlink.json'));
    assert.throws(() => run(['--inspect', 'hardlink.json'], options), /REJECTED/);
  });
  test('output path junction cannot redirect saved evidence', () => {
    const junctionWorkspace = resolve(workspace, 'junction-workspace'), target = resolve(workspace, 'redirected');
    mkdirSync(junctionWorkspace); mkdirSync(target);
    writeFileSync(resolve(junctionWorkspace, 'input.json'), source);
    symlinkSync(target, resolve(junctionWorkspace, 'data'), process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => run(['--inspect', 'input.json', '--save'], { ...options, workspaceRoot: junctionWorkspace }), /SYMLINK_REFUSED/);
    assert.deepEqual(readdirSync(target), []);
  });
  test('command cannot login purchase trade follow URLs or accept extra arguments', () => {
    for (const args of [[], ['--login'], ['--inspect', 'x', '--trade'], ['--inspect', 'x', '--save', 'y'], ['--inspect', '--save']]) assert.throws(() => run(args, options), /UNSUPPORTED_COMMAND/);
    assert.equal(run(['--help'], options).networkAccess, false);
  });
  test('CLI errors do not echo rejected source bodies or credentials', () => {
    const bad = resolve(workspace, 'private.json'); writeFileSync(bad, '{"access_token":"DO_NOT_ECHO"}');
    const result = spawnSync(process.execPath, [resolve(root, 'node_modules/tsx/dist/cli.mjs'), resolve(root, 'scripts/options-robinhood-capture.mjs'), '--inspect', 'private.json'], { cwd: workspace, encoding: 'utf8', windowsHide: true });
    assert.notEqual(result.status, 0); assert(!`${result.stdout}${result.stderr}`.includes('DO_NOT_ECHO')); assert(result.stderr.includes('ROBINHOOD_CAPTURE_FORBIDDEN_DATA_FIELD'));
  });
  console.log(`${passed}/${passed} tests passed.`);
} finally {
  globalThis.fetch = originalFetch;
  const checked = realpathSync(workspace), rel = relative(tempRoot, checked);
  assert(!isAbsolute(rel) && rel.startsWith('alpha-rh-capture-') && !rel.includes(sep));
  rmSync(checked, { recursive: true, force: true });
}
