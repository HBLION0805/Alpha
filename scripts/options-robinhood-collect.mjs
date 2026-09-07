import { existsSync, opendirSync, realpathSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runRobinhoodObserveCommand, robinhoodObservationStorage as io } from './options-robinhood-observe.mjs';
import { assessRobinhoodObservationFrame, observationClock, observationId, observationSha, reviewRobinhoodObservationStudy } from '../src/engines/options-robinhood-data/RobinhoodObservationEngine.ts';

const MAX_REPLY_BYTES = 20 * 1024;
function fail(code) { throw new Error('ROBINHOOD_COLLECTION_' + code); }
function keys(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) fail('INVALID_FIELDS');
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function safeData(value, depth = 0, count = { n: 0 }) {
  if (++count.n > 5000 || depth > 16) fail('DATA_STRUCTURE_LIMIT');
  if (typeof value === 'string' && value.length > 4096) fail('DATA_STRUCTURE_LIMIT');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (/token|password|secret|authorization|cookie|account|orders?|positions?|__proto__|^constructor$|^prototype$/i.test(key)) fail('FORBIDDEN_DATA_FIELD');
    safeData(child, depth + 1, count);
  }
}
function requests(plan) { return [
  { tool: 'get_option_quotes', args: { instrument_ids: plan.contracts.map(c => c.id) } },
  { tool: 'get_equity_quotes', args: { symbols: [...new Set(plan.contracts.map(c => c.symbol))].sort() } },
]; }
function state(root, id) { const path = io.studyPath(root, id); return io.locked(root, path, () => io.loadStudy(root, path)); }
function decode(encoded) {
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_REPLY_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail('TRANSPORT_LIMIT_OR_ENCODING');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > MAX_REPLY_BYTES || bytes.toString('base64') !== encoded || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) fail('TRANSPORT_LIMIT_OR_ENCODING');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
function validateReply(text, plan, at) {
  let reply; try { reply = JSON.parse(text); } catch { fail('INVALID_REPLY_JSON'); }
  keys(reply, ['schemaVersion', 'attemptId', 'outcomes']);
  if (reply.schemaVersion !== '1.0') fail('REPLY_VERSION');
  observationId(reply.attemptId);
  if (!Array.isArray(reply.outcomes) || reply.outcomes.length !== 2) fail('OUTCOME_COUNT');
  const expected = requests(plan), seen = new Set();
  for (const outcome of reply.outcomes) {
    keys(outcome, ['tool', 'args', 'requestedAt', 'receivedAt', 'data', 'errorCode']);
    const match = expected.find(v => v.tool === outcome.tool);
    if (!match || seen.has(outcome.tool) || !same(match.args, outcome.args)) fail('REQUEST_SCOPE');
    seen.add(outcome.tool);
    observationClock(outcome.requestedAt); observationClock(outcome.receivedAt);
    if (outcome.requestedAt < plan.windowStartAt || outcome.requestedAt >= plan.windowEndAt || outcome.requestedAt <= plan.frozenAt ||
        outcome.receivedAt < outcome.requestedAt || outcome.receivedAt > at) fail('REQUEST_CLOCK_OR_WINDOW');
    const hasData = Object.hasOwn(outcome, 'data'), hasError = Object.hasOwn(outcome, 'errorCode');
    if (hasData === hasError) fail('OUTCOME_SHAPE');
    if (hasError && !['TOOL_FAILED', 'TOOL_UNAVAILABLE', 'RESPONSE_SHAPE_UNAVAILABLE'].includes(outcome.errorCode)) fail('ERROR_CODE');
    if (hasData) { keys(outcome.data, ['results']); if (!Array.isArray(outcome.data.results)) fail('OUTCOME_SHAPE'); safeData(outcome.data); }
  }
  return reply;
}
function attemptNames(path) {
  const names = [], dir = opendirSync(path);
  try { for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
    if (!entry.isFile() || entry.isSymbolicLink() || (!/^[a-z0-9][a-z0-9_-]{0,79}\.json$/.test(entry.name) && entry.name !== 'writer.lock')) fail('UNEXPECTED_COLLECTOR_ENTRY');
    if (entry.name !== 'writer.lock') { names.push(entry.name); if (names.length > 120) fail('ATTEMPT_LIMIT'); }
  } } finally { dir.closeSync(); }
  return names.sort();
}
function captureTextFor(plan, artifact, reply) {
  const catalog = JSON.parse(artifact.sourceText).calls.filter(c => ['get_option_chains', 'get_option_instruments'].includes(c.tool));
  const selected = new Set(plan.contracts.map(c => c.id));
  const calls = catalog.filter(c => c.tool === 'get_option_chains' || c.data.instruments.some(v => selected.has(v.id)));
  const captureId = 'auto-' + observationSha(plan.studyId + ':' + reply.attemptId).slice(0,40);
  return { captureId, text: JSON.stringify({ schemaVersion: '1.0', captureId, declaredOrigin: plan.declaredOrigin, calls: [...calls, ...reply.outcomes] }, null, 2) + '\n' };
}
function readAttempt(root, path, { plan, frames, artifact }) {
  const old = io.unseal(root, path, ['schemaVersion', 'planSha256', 'replyText', 'recordedAt', 'status', 'frameSha256', 'capturePath', 'failedTools']);
  if (old.schemaVersion !== '1.0' || old.planSha256 !== plan.planSha256) fail('ATTEMPT_CONFLICT');
  observationClock(old.recordedAt);
  const reply = validateReply(old.replyText, plan, old.recordedAt);
  if (basename(path) !== reply.attemptId + '.json') fail('ATTEMPT_CONFLICT');
  const failedTools = reply.outcomes.filter(o => o.errorCode).map(o => ({ tool: o.tool, errorCode: o.errorCode }));
  if (!same(old.failedTools, failedTools) || old.status !== (failedTools.length ? 'SOURCE_CALL_FAILED' : 'FRAME_RECORDED')) fail('ATTEMPT_CONFLICT');
  if (failedTools.length) { if (old.frameSha256 !== null || old.capturePath !== null) fail('ATTEMPT_CONFLICT'); }
  else {
    const input = captureTextFor(plan, artifact, reply), frame = frames.find(f => f.captureId === input.captureId);
    if (!frame || frame.frameSha256 !== old.frameSha256 || frame.sourceSha256 !== observationSha(input.text) ||
        typeof old.capturePath !== 'string' || io.read(root, old.capturePath, 512*1024) !== input.text) fail('ATTEMPT_CONFLICT');
  }
  return { old, reply };
}
export function runRobinhoodCollectCommand(args, { workspaceRoot = process.cwd(), now = () => new Date().toISOString() } = {}) {
  if (args.length === 1 && args[0] === '--help') return { usage: ['options:robinhood-collect -- --prepare <study-id>', 'options:robinhood-collect -- --accept-base64 <study-id> <reply>'], networkAccess: false, executionAllowed: false };
  if (!((args.length === 2 && args[0] === '--prepare') || (args.length === 3 && args[0] === '--accept-base64'))) fail('UNSUPPORTED_COMMAND');
  const root = realpathSync(workspaceRoot), id = observationId(args[1]);
  if (args[0] === '--prepare') {
    const snapshot = state(root, id), { plan, frames } = snapshot, at = observationClock(now()), review = reviewRobinhoodObservationStudy(plan, frames, at);
    const dir = io.contained(root, resolve(root, 'data/runtime/options-robinhood-data/collection-attempts', id));
    const attempts = existsSync(dir) ? io.locked(root, dir, () => attemptNames(dir).map(name => readAttempt(root, resolve(dir, name), snapshot))) : [];
    if (attempts.some(v => v.old.recordedAt > at)) fail('CLOCK_ROLLBACK');
    const lastRequest = Math.max(0, ...attempts.flatMap(v => v.reply.outcomes.map(o => Date.parse(o.requestedAt))));
    const nextMs = Math.max(lastRequest + 60000, review.nextRequestAt ? Date.parse(review.nextRequestAt) : Infinity);
    const ready = review.requestReadyNow && Date.parse(at) >= nextMs && attempts.length < 120;
    return { schemaVersion: '1.0', studyId: id, preparedAt: at, planSha256: plan.planSha256,
      windowStartAt: plan.windowStartAt, windowEndAt: plan.windowEndAt, nextRequestAt: Number.isFinite(nextMs) && nextMs < Date.parse(plan.windowEndAt) ? new Date(nextMs).toISOString() : null,
      action: review.stage === 'WINDOW_ENDED' || review.stage === 'FRAME_LIMIT_REACHED' || attempts.length >= 120 ? 'FINISH' : ready ? 'COLLECT' : 'WAIT',
      requests: ready ? requests(plan) : [], attemptCount: attempts.length, sourceFailureCount: attempts.filter(v => v.old.failedTools.length).length,
      frameCount: frames.length, usableObservations: review.diagnosticUsableObservations,
      status: 'NO_REPLAY', networkAccess: false, executionAllowed: false };
  }
  const replyText = decode(args[2]), priorState = state(root, id);
  // Reject malformed scope/time before creating a collector directory or source artifact.
  const reply = validateReply(replyText, priorState.plan, observationClock(now()));
  const dir = io.directory(root, resolve(root, 'data/runtime/options-robinhood-data/collection-attempts', id));
  return io.locked(root, dir, () => {
    const path = io.contained(root, resolve(dir, reply.attemptId + '.json'));
    const snapshot = state(root, id), { plan, frames, artifact } = snapshot, recordedAt = observationClock(now());
    validateReply(replyText, plan, recordedAt);
    if (existsSync(path)) {
      const { old } = readAttempt(root, path, snapshot);
      if (old.replyText !== replyText) fail('ATTEMPT_CONFLICT');
      return { status: old.status, reused: true, recordedAt: old.recordedAt, frameSha256: old.frameSha256, failedTools: old.failedTools, executionAllowed: false };
    }
    const previous = attemptNames(dir).map(name => readAttempt(root, resolve(dir, name), snapshot));
    if (previous.length >= 120) fail('ATTEMPT_LIMIT');
    const lastRequest = Math.max(0, ...previous.flatMap(v => v.reply.outcomes.map(o => Date.parse(o.requestedAt))));
    if (previous.some(v => v.old.recordedAt > recordedAt) || reply.outcomes.some(o => Date.parse(o.requestedAt) - lastRequest < 60000)) fail('ATTEMPT_CADENCE_OR_CLOCK');
    const failedTools = reply.outcomes.filter(o => o.errorCode).map(o => ({ tool: o.tool, errorCode: o.errorCode }));
    let frameSha256 = null, capturePath = null;
    if (failedTools.length === 0) {
      const { captureId, text: inputText } = captureTextFor(plan, artifact, reply);
      const oldFrame = frames.find(f => f.captureId === captureId);
      // Recovery after source/frame save but before the attempt record was durable.
      if (!oldFrame) assessRobinhoodObservationFrame(plan, inputText, recordedAt, frames);
      else if (oldFrame.sourceSha256 !== observationSha(inputText)) fail('ATTEMPT_CONFLICT');
      const captureDir = io.directory(root, resolve(root, 'data/runtime/options-robinhood-data/automatic-captures'));
      const sourcePath = io.contained(root, resolve(captureDir, captureId + '.json'));
      if (existsSync(sourcePath)) { if (io.read(root, sourcePath, 512*1024) !== inputText) fail('CAPTURE_CONFLICT'); }
      else io.writeExclusive(root, sourcePath, JSON.parse(inputText));
      capturePath = relative(root, sourcePath);
      const saved = runRobinhoodObserveCommand(['--record', id, '--capture', sourcePath], { workspaceRoot: root, now: () => recordedAt });
      frameSha256 = saved.persistence.frame.frameSha256;
    }
    const record = { schemaVersion: '1.0', planSha256: plan.planSha256, replyText, recordedAt,
      status: failedTools.length ? 'SOURCE_CALL_FAILED' : 'FRAME_RECORDED', frameSha256, capturePath, failedTools };
    io.writeExclusive(root, path, io.sealed(record));
    return { status: record.status, reused: false, recordedAt, frameSha256, failedTools, executionAllowed: false };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(runRobinhoodCollectCommand(process.argv.slice(2)), null, 2)); }
  catch (e) { console.error(e instanceof Error && /^(?:ROBINHOOD_(?:COLLECTION|OBSERVATION|CAPTURE)_|OBSERVATION_IO_)[A-Z_]+$/.test(e.message) ? e.message : 'ROBINHOOD_COLLECTION_OPERATION_FAILED'); process.exitCode = 1; }
}
