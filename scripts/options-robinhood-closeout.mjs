import { existsSync, opendirSync, realpathSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readRobinhoodCollectionSnapshot } from './options-robinhood-collect.mjs';
import { robinhoodObservationStorage as io } from './options-robinhood-observe.mjs';
import { observationId } from '../src/engines/options-robinhood-data/RobinhoodObservationEngine.ts';
import { closeoutRobinhoodCollection } from '../src/engines/options-robinhood-data/RobinhoodCloseoutEngine.ts';

function fail(code) { throw Error('ROBINHOOD_CLOSEOUT_' + code); }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function names(path) {
  const found = [], dir = opendirSync(path);
  try { for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
    if (!entry.isFile() || entry.isSymbolicLink() || (entry.name !== 'writer.lock' && !/^report-[0-9a-f]{64}\.json$/.test(entry.name))) fail('REPORT_DIRECTORY_ENTRY');
    if (entry.name !== 'writer.lock') { found.push(entry.name); if (found.length > 120) fail('REPORT_LIMIT'); }
  } } finally { dir.closeSync(); }
  return found.sort();
}
function restore(root, path, snapshot) {
  const saved = io.unseal(root, path, ['schemaVersion', 'report']);
  if (saved.schemaVersion !== '1.0' || !saved.report?.input || !Array.isArray(saved.report.input.frameSha256s) || !Array.isArray(saved.report.input.attemptSha256s)) fail('REPORT_SHAPE');
  const frameRefs = saved.report.input.frameSha256s, attemptRefs = saved.report.input.attemptSha256s;
  if (frameRefs.length > 120 || attemptRefs.length > 120 || new Set(frameRefs).size !== frameRefs.length || new Set(attemptRefs).size !== attemptRefs.length) fail('REPORT_INPUT_REFS');
  const frames = snapshot.frames.slice(0, frameRefs.length);
  if (!equal(frames.map(f => f.frameSha256), frameRefs)) fail('REPORT_INPUT_REFS');
  const orderedAttempts = [...snapshot.attempts].sort((a, b) =>
    a.sourceCalls.find(r => r.tool === 'get_option_quotes').requestedAt.localeCompare(b.sourceCalls.find(r => r.tool === 'get_option_quotes').requestedAt) || a.attemptId.localeCompare(b.attemptId));
  const attempts = orderedAttempts.slice(0, attemptRefs.length);
  if (!equal(attempts.map(a => a.attemptSha256), attemptRefs)) fail('REPORT_INPUT_REFS');
  const report = closeoutRobinhoodCollection(snapshot.plan, frames, attempts, saved.report.assessedAt);
  if (!equal(saved.report, report) || path !== resolve(path, '..', 'report-' + report.reportSha256 + '.json')) fail('REPORT_REPLAY_MISMATCH');
  if (report.assessedAt > snapshot.assessedAt) fail('REPORT_CLOCK_ROLLBACK');
  return report;
}
export function runRobinhoodCloseoutCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === '--help') return { usage: ['options:robinhood-closeout -- --report <study-id>', 'options:robinhood-closeout -- --save <study-id>'], networkAccess: false, executionAllowed: false };
  if (args.length !== 2 || !['--report', '--save'].includes(args[0])) fail('UNSUPPORTED_COMMAND');
  const root = realpathSync(workspaceRoot), id = observationId(args[1]);
  const target = io.contained(root, resolve(root, 'data/runtime/options-robinhood-data/collection-reports', id));
  const run = (reportNames = []) => {
    const snapshot = readRobinhoodCollectionSnapshot(id, { workspaceRoot: root, now });
    const prior = reportNames.map(name => restore(root, resolve(target, name), snapshot));
    const report = closeoutRobinhoodCollection(snapshot.plan, snapshot.frames, snapshot.attempts, snapshot.assessedAt);
    if (args[0] === '--report') return report;
    const path = io.contained(root, resolve(target, 'report-' + report.reportSha256 + '.json'));
    const reused = prior.some(r => r.reportSha256 === report.reportSha256);
    if (!reused) {
      if (prior.length >= 120) fail('REPORT_LIMIT');
      io.writeExclusive(root, path, io.sealed({ schemaVersion: '1.0', report }));
    }
    return { schemaVersion: '1.0', studyId: id, assessedAt: report.assessedAt, stage: report.stage,
      persistence: { reused, path: relative(root, path), reportSha256: report.reportSha256 },
      declaredSlotCount: report.declaredSlotCount, elapsedSlotCount: report.elapsedSlotCount,
      completedCoverage: report.completedCoverage, totals: report.totals,
      gapIntervalCount: report.gaps.length, candidateOperationalLessonCount: report.operationalLessons.length,
      status: report.status, networkAccess: false, executionAllowed: false, tradeCount: 0 };
  };
  if (args[0] === '--save') io.directory(root, target);
  return existsSync(target) ? io.locked(root, target, () => run(names(target))) : run();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runRobinhoodCloseoutCommand(process.argv.slice(2)), null, 2)); }
  catch (e) { console.error(e instanceof Error && /^(?:ROBINHOOD_(?:CLOSEOUT|COLLECTION|OBSERVATION|CAPTURE)_|OBSERVATION_IO_)[A-Z_]+$/.test(e.message) ? e.message : 'ROBINHOOD_CLOSEOUT_OPERATION_FAILED'); process.exitCode = 1; }
}
