import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, opendirSync, readSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessRobinhoodCapture, ROBINHOOD_CAPTURE_MAX_BYTES } from '../src/engines/options-robinhood-data/RobinhoodCaptureEngine.ts';
import { assessRobinhoodObservationFrame, freezeRobinhoodObservationPlan, observationClock, observationId, OBSERVATION_MAX_FRAMES, reviewRobinhoodObservationStudy, screenRobinhoodCaptures } from '../src/engines/options-robinhood-data/RobinhoodObservationEngine.ts';

const ARTIFACT_LIMIT = 2 * 1024 * 1024;
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
function fail(code) { throw new Error('OBSERVATION_IO_' + code); }
function contained(root, path) {
  const target = resolve(root, path), rel = relative(root, target);
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) fail('PATH_OUTSIDE_WORKSPACE');
  let cursor = root;
  for (const part of rel.split(sep)) {
    cursor = resolve(cursor, part);
    // lstat also detects a dangling link; existsSync alone would hide one.
    try { if (lstatSync(cursor).isSymbolicLink()) fail('LINK_REFUSED'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}
function read(root, path, max) {
  const target = contained(root, path), before = lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > max) fail('UNSAFE_FILE');
  const same = s => s.isFile() && s.dev === before.dev && s.ino === before.ino && s.nlink === 1 && s.size === before.size && s.mtimeMs === before.mtimeMs && s.ctimeMs === before.ctimeMs;
  const fd = openSync(target, 'r');
  try {
    if (!same(fstatSync(fd)) || !same(lstatSync(target))) fail('FILE_CHANGED');
    const bytes = Buffer.alloc(max + 1); let length = 0;
    while (length < bytes.length) { const n = readSync(fd, bytes, length, bytes.length - length, null); if (!n) break; length += n; }
    if (length > max || length !== before.size || !same(fstatSync(fd)) || !same(lstatSync(target))) fail('FILE_CHANGED');
    if (length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail('UTF8_BOM_REFUSED');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } finally { closeSync(fd); }
}
function directory(root, path) {
  const target = contained(root, path); let cursor = root;
  for (const part of relative(root, target).split(sep)) {
    cursor = contained(root, resolve(cursor, part));
    try { mkdirSync(cursor); } catch (e) { if (e.code !== 'EEXIST') throw e; }
    if (!lstatSync(cursor).isDirectory()) fail('UNSAFE_DIRECTORY');
  }
  return target;
}
function writeExclusive(root, path, artifact) {
  const text = JSON.stringify(artifact, null, 2) + '\n';
  if (Buffer.byteLength(text) > ARTIFACT_LIMIT) fail('ARTIFACT_LIMIT');
  const fd = openSync(contained(root, path), 'wx');
  try { writeFileSync(fd, text, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
}
function sealed(payload) { return { ...payload, artifactSha256: hash(JSON.stringify(payload)) }; }
function unseal(root, path, expectedKeys) {
  const value = JSON.parse(read(root, path, ARTIFACT_LIMIT));
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== [...expectedKeys, 'artifactSha256'].sort().join(',')) fail('ARTIFACT_SHAPE');
  const { artifactSha256, ...payload } = value;
  if (hash(JSON.stringify(payload)) !== artifactSha256) fail('ARTIFACT_HASH');
  return value;
}
function assertEqual(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) fail('ARTIFACT_REPLAY_MISMATCH'); }
function studyPath(root, id) { return contained(root, resolve(root, 'data/runtime/options-robinhood-data/studies', observationId(id))); }
function locked(root, study, work) {
  const path = contained(root, resolve(study, 'writer.lock'));
  let fd; try { fd = openSync(path, 'wx'); } catch (e) { if (e.code === 'EEXIST') fail('STUDY_LOCKED'); throw e; }
  try { writeFileSync(fd, 'Single-process study operation. Investigate an abandoned lock before removing it.\n'); fsyncSync(fd); return work(); }
  finally { closeSync(fd); unlinkSync(path); }
}
function loadStudy(root, study) {
  const artifact = unseal(root, resolve(study, 'plan.json'), ['schemaVersion', 'configText', 'sourceText', 'plan']);
  if (artifact.schemaVersion !== '1.0') fail('ARTIFACT_VERSION');
  const plan = freezeRobinhoodObservationPlan(artifact.configText, artifact.sourceText, artifact.plan.frozenAt);
  assertEqual(plan, artifact.plan);
  if (study !== studyPath(root, plan.studyId)) fail('STUDY_ID_MISMATCH');
  // Refuse unrecognized or excess entries instead of silently ignoring a partial write.
  const names = [], dir = opendirSync(study);
  try { for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
    if (names.length >= OBSERVATION_MAX_FRAMES + 2) fail('DIRECTORY_LIMIT');
    if (!entry.isFile() || entry.isSymbolicLink() || !/^(?:plan\.json|writer\.lock|frame-\d{4}\.json)$/.test(entry.name)) fail('UNEXPECTED_STUDY_ENTRY');
    names.push(entry.name);
  } } finally { dir.closeSync(); }
  const files = names.filter(n => n.startsWith('frame-')).sort(), frames = [], sources = [];
  for (const [index, name] of files.entries()) {
    if (name !== `frame-${String(index + 1).padStart(4, '0')}.json`) fail('FRAME_SEQUENCE_GAP');
    const saved = unseal(root, resolve(study, name), ['schemaVersion', 'inputText', 'frame']);
    if (saved.schemaVersion !== '1.0') fail('ARTIFACT_VERSION');
    const recovered = assessRobinhoodObservationFrame(plan, saved.inputText, saved.frame.recordedAt, frames);
    assertEqual(recovered, saved.frame); frames.push(recovered); sources.push(saved.inputText);
  }
  return { plan, frames, sources, artifact };
}

export function runRobinhoodObserveCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === '--help') return { usage: [
    'options:robinhood-observe -- --screen <capture JSON> [more captures, max 16]',
    'options:robinhood-observe -- --freeze <plan JSON> --source <capture JSON>',
    'options:robinhood-observe -- --record <study-id> --capture <capture JSON>',
    'options:robinhood-observe -- --review <study-id>',
    'options:robinhood-observe -- --template <study-id>',
  ], networkAccess: false, automaticCollectionEnabled: false, executionAllowed: false };
  const root = realpathSync(workspaceRoot);
  if (args[0] === '--screen' && args.length >= 2 && args.length <= 17 && args.slice(1).every(v => !v.startsWith('--'))) {
    const inputs = args.slice(1).map(path => read(root, path, ROBINHOOD_CAPTURE_MAX_BYTES));
    return screenRobinhoodCaptures(inputs, now());
  }
  if (args.length === 4 && args[0] === '--freeze' && args[2] === '--source') {
    const configText = read(root, args[1], 16384), sourceText = read(root, args[3], ROBINHOOD_CAPTURE_MAX_BYTES);
    let config; try { config = JSON.parse(configText); } catch { fail('CONFIG_JSON'); }
    const study = studyPath(root, config.studyId);
    // Existing freezes recover at their original clock, even after the window ends.
    if (existsSync(study)) return locked(root, study, () => {
      const old = loadStudy(root, study); assertEqual([old.artifact.configText, old.artifact.sourceText], [configText, sourceText]);
      return { ...reviewRobinhoodObservationStudy(old.plan, old.frames, now()), persistence: { reused: true, planPath: relative(root, resolve(study, 'plan.json')) } };
    });
    const plan = freezeRobinhoodObservationPlan(configText, sourceText, now());
    directory(root, study);
    return locked(root, study, () => {
      writeExclusive(root, resolve(study, 'plan.json'), sealed({ schemaVersion: '1.0', configText, sourceText, plan }));
      return { ...reviewRobinhoodObservationStudy(plan, [], plan.frozenAt), persistence: { reused: false, planPath: relative(root, resolve(study, 'plan.json')) } };
    });
  }
  if ((args.length === 2 && ['--review', '--template'].includes(args[0])) || (args.length === 4 && args[0] === '--record' && args[2] === '--capture')) {
    const study = studyPath(root, args[1]);
    return locked(root, study, () => {
      const { plan, frames, sources, artifact } = loadStudy(root, study);
      if (args[0] === '--template') {
        const catalog = JSON.parse(artifact.sourceText).calls.filter(c => ['get_option_chains', 'get_option_instruments'].includes(c.tool));
        const ids = plan.contracts.map(c => c.id), selected = new Set(ids);
        // Preserve complete catalog response bytes. A superset cannot become a fabricated server subset.
        const selectedCalls = catalog.filter(c => c.tool === 'get_option_chains' || c.data.instruments.some(v => selected.has(v.id)));
        const sourceIds = selectedCalls.filter(c => c.tool === 'get_option_instruments').flatMap(c => c.data.instruments.map(v => v.id));
        if (sourceIds.length !== selected.size || sourceIds.some(id => !selected.has(id))) fail('TEMPLATE_NEEDS_EXACT_CATALOG');
        return { studyId: plan.studyId, declaredOrigin: plan.declaredOrigin, catalogCalls: selectedCalls,
          next: reviewRobinhoodObservationStudy(plan, frames, now()), instructions: 'Use the preserved catalog plus the two exact host quote responses. Keep original request/receipt clocks; provide a new captureId. Do not fabricate response data. This command does not invoke tools.' };
      }
      if (args[0] === '--review') return reviewRobinhoodObservationStudy(plan, frames, now());
      const inputText = read(root, args[3], ROBINHOOD_CAPTURE_MAX_BYTES), recordedAt = observationClock(now());
      const parsed = assessRobinhoodCapture(inputText, recordedAt);
      const prior = frames.findIndex(f => f.captureId === parsed.captureId);
      if (prior >= 0) {
        if (sources[prior] !== inputText) fail('CAPTURE_ID_CONFLICT');
        return { ...reviewRobinhoodObservationStudy(plan, frames, recordedAt), persistence: { reused: true, frame: frames[prior] } };
      }
      const frame = assessRobinhoodObservationFrame(plan, inputText, recordedAt, frames);
      writeExclusive(root, resolve(study, `frame-${String(frame.sequence).padStart(4, '0')}.json`), sealed({ schemaVersion: '1.0', inputText, frame }));
      return { ...reviewRobinhoodObservationStudy(plan, [...frames, frame], recordedAt), persistence: { reused: false, frame } };
    });
  }
  fail('UNSUPPORTED_COMMAND');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runRobinhoodObserveCommand(process.argv.slice(2)), null, 2)); }
  catch (e) { console.error(e instanceof Error && /^(?:OBSERVATION_IO_|ROBINHOOD_(?:OBSERVATION|CAPTURE)_)[A-Z_]+$/.test(e.message) ? e.message : 'OBSERVATION_IO_OPERATION_FAILED'); process.exitCode = 1; }
}
