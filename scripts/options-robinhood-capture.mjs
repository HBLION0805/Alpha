import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assessRobinhoodCapture, ROBINHOOD_CAPTURE_MAX_BYTES } from '../src/engines/options-robinhood-data/RobinhoodCaptureEngine.ts';

const sha = value => createHash('sha256').update(value, 'utf8').digest('hex');
function containedPath(root, path) {
  const target = resolve(root, path), rel = relative(root, target);
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep)) throw new Error('CAPTURE_PATH_OUTSIDE_WORKSPACE');
  let current = root;
  for (const part of rel.split(sep)) {
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('CAPTURE_SYMLINK_REFUSED');
  }
  return target;
}
function readBounded(path, max) {
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > max) throw new Error('CAPTURE_UNSAFE_FILE');
  const same = stat => stat.isFile() && stat.dev === before.dev && stat.ino === before.ino && stat.nlink === 1 && stat.size === before.size && stat.mtimeMs === before.mtimeMs && stat.ctimeMs === before.ctimeMs;
  const fd = openSync(path, 'r');
  try {
    if (!same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error('CAPTURE_FILE_CHANGED');
    const bytes = Buffer.alloc(max + 1);
    let length = 0;
    while (length < bytes.length) { const n = readSync(fd, bytes, length, bytes.length - length, null); if (!n) break; length += n; }
    if (length > max || length !== before.size || !same(fstatSync(fd)) || !same(lstatSync(path))) throw new Error('CAPTURE_FILE_CHANGED');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } finally { closeSync(fd); }
}
function save(root, inputText, report) {
  let directory = root;
  for (const part of ['data', 'runtime', 'options-robinhood-data', 'captures']) {
    directory = containedPath(root, resolve(directory, part));
    if (!existsSync(directory)) { try { mkdirSync(directory); } catch (e) { if (e.code !== 'EEXIST') throw e; } }
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('CAPTURE_UNSAFE_DIRECTORY');
  }
  const path = containedPath(root, resolve(directory, report.captureId + '.json'));
  const payload = { schemaVersion: '1.0', inputText, sourceSha256: report.sourceSha256, recordedAt: report.assessedAt, originalAssessment: report };
  const artifact = { ...payload, artifactSha256: sha(JSON.stringify(payload)) };
  const encoded = JSON.stringify(artifact, null, 2) + '\n';
  if (Buffer.byteLength(encoded) > 2 * 1024 * 1024) throw new Error('CAPTURE_ARTIFACT_LIMIT');
  let fd;
  try { fd = openSync(path, 'wx'); } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    try {
      const old = JSON.parse(readBounded(path, 2 * 1024 * 1024));
      if (Object.keys(old).sort().join(',') !== Object.keys(artifact).sort().join(',')) throw new Error();
      const { artifactSha256, ...prior } = old;
      if (sha(JSON.stringify(prior)) !== artifactSha256 || prior.inputText !== inputText || prior.sourceSha256 !== sha(inputText)) throw new Error();
      const recovered = assessRobinhoodCapture(prior.inputText, prior.recordedAt);
      if (JSON.stringify(recovered) !== JSON.stringify(prior.originalAssessment)) throw new Error();
      return { path: relative(root, path).split(sep).join('/'), recordedAt: prior.recordedAt, reused: true, artifactSha256 };
    } catch { throw new Error('CAPTURE_EXISTING_ARTIFACT_CONFLICT_OR_CORRUPTION'); }
  }
  try { writeFileSync(fd, encoded, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
  return { path: relative(root, path).split(sep).join('/'), recordedAt: payload.recordedAt, reused: false, artifactSha256: artifact.artifactSha256 };
}
export function runRobinhoodCaptureCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === '--help') return { usage: 'options:robinhood-capture -- --inspect <workspace JSON> [--save]', networkAccess: false, executionAllowed: false };
  if (![2, 3].includes(args.length) || args[0] !== '--inspect' || !args[1] || args[1].startsWith('--') || (args.length === 3 && args[2] !== '--save')) throw new Error('CAPTURE_UNSUPPORTED_COMMAND');
  const root = realpathSync(workspaceRoot);
  let inputText;
  try { inputText = readBounded(containedPath(root, args[1]), ROBINHOOD_CAPTURE_MAX_BYTES); } catch { throw new Error('CAPTURE_INPUT_FILE_REJECTED'); }
  const report = assessRobinhoodCapture(inputText, now());
  return { ...report, persistence: args[2] === '--save' ? save(root, inputText, report) : null };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runRobinhoodCaptureCommand(process.argv.slice(2)), null, 2)); }
  catch (e) { console.error(e instanceof Error && /^(?:ROBINHOOD_CAPTURE_|CAPTURE_)[A-Z_]+$/.test(e.message) ? e.message : 'CAPTURE_OPERATION_FAILED'); process.exitCode = 1; }
}
